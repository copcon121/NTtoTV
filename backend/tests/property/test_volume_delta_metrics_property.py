"""Property test for VolumeDelta per-bar metrics (task 14.3, design Property 17).

Generates arbitrary trade streams (non-decreasing Canonical_Timestamps spanning
several 1m buckets, as guaranteed upstream by the sequence validator) and feeds
them through the :class:`~app.engines.volume_delta_engine.VolumeDeltaEngine`. For
the final state of every bar it asserts the per-bar conservation invariants:

* ``volume == buyVolume + sellVolume``;
* ``delta == buyVolume - sellVolume``;
* ``closeDelta == delta``;
* ``deltaHigh`` / ``deltaLow`` are the running max / min of the intrabar
  cumulative-delta series, and therefore
  ``deltaLow <= openDelta <= deltaHigh`` and
  ``deltaLow <= closeDelta <= deltaHigh``.

And in CumulativeDelta mode (Req 13.7) it asserts that the cumulative delta
across bars equals the running sum of the per-bar deltas: each bar's reported
``cumulativeDelta`` equals the sum of all completed bars' final deltas plus the
current bar's running delta, so the final bar's ``cumulativeDelta`` equals the
total of every bar's delta.

**Validates: Requirements 13.1, 13.7**
"""

from __future__ import annotations

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.engines.volume_delta_engine import VolumeDeltaEngine, VolumeDeltaMode
from app.models.canonical import NormalizedTrade, Side
from app.models.messages import VolumeDeltaUpdate

CONTRACT = "GC 08-26"
SYMBOL = "GC"

# Discrete price grid so equality with bid/ask/prev (the classification rule
# boundaries) is sampled often, exercising every classification branch.
_GRID = [round(100.0 + 0.1 * i, 1) for i in range(11)]
# Span a handful of 1m buckets so cumulative-across-bars is exercised.
_MAX_GAP_MS = 90_000  # up to 1.5 min between trades -> buckets roll


@st.composite
def trade_streams(draw: st.DrawFn) -> list[NormalizedTrade]:
    """Generate a stream of trades with non-decreasing timestamps."""
    n = draw(st.integers(min_value=1, max_value=40))
    base = draw(st.integers(min_value=0, max_value=10_000_000))
    gaps = draw(
        st.lists(st.integers(min_value=0, max_value=_MAX_GAP_MS), min_size=n, max_size=n)
    )
    prices = draw(st.lists(st.sampled_from(_GRID), min_size=n, max_size=n))
    volumes = draw(
        st.lists(st.integers(min_value=1, max_value=1_000), min_size=n, max_size=n)
    )
    # bid/ask may be absent (None) or a grid price, independently per trade, so
    # the bid/ask-lean and uptick/downtick fallback paths both get exercised.
    bids = draw(
        st.lists(
            st.one_of(st.none(), st.sampled_from(_GRID)), min_size=n, max_size=n
        )
    )
    asks = draw(
        st.lists(
            st.one_of(st.none(), st.sampled_from(_GRID)), min_size=n, max_size=n
        )
    )

    trades: list[NormalizedTrade] = []
    t = base
    for i in range(n):
        t += gaps[i]
        trades.append(
            NormalizedTrade(
                symbol=SYMBOL,
                contract=CONTRACT,
                time=t,
                price=prices[i],
                volume=volumes[i],
                bid=bids[i],
                ask=asks[i],
                best_bid=None,
                best_ask=None,
                sequence=i,
            )
        )
    return trades


def _final_updates_in_order(
    engine: VolumeDeltaEngine, trades: list[NormalizedTrade]
) -> list[VolumeDeltaUpdate]:
    """Feed trades and return the final update for each bucket, in bucket order.

    Every ``on_trade`` emits a snapshot for the current bar; the last snapshot
    seen for a given bucket time is that bar's final state.
    """
    final: dict[int, VolumeDeltaUpdate] = {}
    order: list[int] = []
    for t in trades:
        u = engine.on_trade(t)
        assert u is not None  # min_trade_size=0: no trade is filtered
        if u.time not in final:
            order.append(u.time)
        final[u.time] = u
    return [final[time] for time in order]


# Feature: gc-chart-platform, Property 17: VolumeDelta per-bar metrics are conserved (including cumulative mode)
@pytest.mark.property
@given(trades=trade_streams())
def test_property_17_per_bar_metrics_conserved(trades: list[NormalizedTrade]):
    delta_engine = VolumeDeltaEngine(mode=VolumeDeltaMode.DELTA)
    bars = _final_updates_in_order(delta_engine, trades)

    for bar in bars:
        # Volume conservation: total == buy + sell. (Req 13.1)
        assert bar.volume == bar.buy_volume + bar.sell_volume
        # Delta definition: buy - sell, and closeDelta mirrors it. (Req 13.1)
        assert bar.delta == bar.buy_volume - bar.sell_volume
        assert bar.close_delta == bar.delta

        # deltaHigh/deltaLow bound the open and close of the cumulative series.
        assert bar.delta_low <= bar.delta_high
        assert bar.delta_low <= bar.open_delta <= bar.delta_high
        assert bar.delta_low <= bar.close_delta <= bar.delta_high

        # In Delta mode no cumulative value is reported. (Req 13.6)
        assert bar.cumulative_delta is None

    # Independently reconstruct the per-bar cumulative-delta series from the
    # raw trades (replaying the ordered classification rules) and confirm the
    # engine's high/low/open/close match the running max/min exactly. (Req 13.1)
    expected = _expected_bars(trades)
    assert {b.time for b in bars} == set(expected.keys())
    for bar in bars:
        exp = expected[bar.time]
        assert bar.buy_volume == exp["buy"]
        assert bar.sell_volume == exp["sell"]
        assert bar.delta == exp["close"]
        assert bar.open_delta == exp["open"]
        assert bar.delta_high == exp["high"]
        assert bar.delta_low == exp["low"]

    # CumulativeDelta mode: cumulative across bars == running sum of per-bar
    # deltas. (Req 13.7)
    cum_engine = VolumeDeltaEngine(mode=VolumeDeltaMode.CUMULATIVE)
    cum_bars = _final_updates_in_order(cum_engine, trades)

    running = 0
    for bar in cum_bars:
        assert bar.cumulative_delta is not None
        # Each bar's cumulativeDelta == sum of prior bars' final deltas + this
        # bar's running delta.
        assert bar.cumulative_delta == running + bar.delta
        running += bar.delta
    # The last bar's cumulativeDelta equals the total of every bar's delta.
    if cum_bars:
        assert cum_bars[-1].cumulative_delta == sum(b.delta for b in cum_bars)


def _expected_bars(trades: list[NormalizedTrade]) -> dict[int, dict[str, int]]:
    """Replay the ordered classification rules to derive per-bar metrics.

    Classification state (prev_price / last_side) is continuous across bar
    boundaries, mirroring the engine. Returns, per bucket time, the buy/sell
    volume and the open/high/low/close of the intrabar cumulative-delta series.
    """
    interval = 60_000  # 1m default timeframe
    prev_price: float | None = None
    last_side: Side | None = None
    bars: dict[int, dict[str, int]] = {}

    for t in trades:
        # Ordered rule set (Req 13.2-13.5).
        if t.ask is not None and t.price >= t.ask:
            side = Side.BUY
        elif t.bid is not None and t.price <= t.bid:
            side = Side.SELL
        elif prev_price is not None and t.price > prev_price:
            side = Side.BUY
        elif prev_price is not None and t.price < prev_price:
            side = Side.SELL
        elif last_side is not None:
            side = last_side
        else:
            side = Side.BUY
        prev_price = t.price
        last_side = side

        signed = t.volume if side is Side.BUY else -t.volume
        bucket = (t.time // interval) * interval
        bar = bars.get(bucket)
        if bar is None:
            bars[bucket] = {
                "buy": t.volume if side is Side.BUY else 0,
                "sell": t.volume if side is Side.SELL else 0,
                "open": signed,
                "high": signed,
                "low": signed,
                "close": signed,
            }
        else:
            if side is Side.BUY:
                bar["buy"] += t.volume
            else:
                bar["sell"] += t.volume
            bar["close"] += signed
            bar["high"] = max(bar["high"], bar["close"])
            bar["low"] = min(bar["low"], bar["close"])

    return bars
