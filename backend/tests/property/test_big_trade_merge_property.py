"""Property test for BigTrade merge + filter (task 16.2, design Property 20).

Generates arbitrary trade streams (non-decreasing Canonical_Timestamps) and
feeds them through the :class:`~app.engines.big_trade_engine.BigTradeEngine`.
It asserts that emitted groups match a small oracle for the local NT
BigTradeIndicator's ``currentTrade`` merge: adjacent same-time/same-side prints
merge, a side change finalizes the current group, and the volume filter governs
emission. (Req 15.2, 15.4)

**Validates: Requirements 15.2, 15.4**
"""

from __future__ import annotations

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.engines.big_trade_engine import BigTradeEngine
from app.models.canonical import NormalizedTrade, Side

CONTRACT = "GC 08-26"
SYMBOL = "GC"
_GRID = [round(100.0 + 0.1 * i, 1) for i in range(8)]


@st.composite
def trade_streams(draw: st.DrawFn) -> list[NormalizedTrade]:
    """Generate trades with non-decreasing timestamps clustered on a few stamps."""
    n = draw(st.integers(min_value=1, max_value=40))
    # Few distinct timestamps so multiple trades share a (ts, side) group.
    times = sorted(
        draw(st.lists(st.integers(min_value=0, max_value=5), min_size=n, max_size=n))
    )
    prices = draw(st.lists(st.sampled_from(_GRID), min_size=n, max_size=n))
    volumes = draw(st.lists(st.integers(min_value=1, max_value=40), min_size=n, max_size=n))
    bids = draw(
        st.lists(st.one_of(st.none(), st.sampled_from(_GRID)), min_size=n, max_size=n)
    )
    asks = draw(
        st.lists(st.one_of(st.none(), st.sampled_from(_GRID)), min_size=n, max_size=n)
    )
    trades: list[NormalizedTrade] = []
    for i in range(n):
        trades.append(
            NormalizedTrade(
                symbol=SYMBOL,
                contract=CONTRACT,
                time=times[i] * 1000,
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


# Feature: gc-chart-platform, Property 20: BigTrade merge is deterministic and the volume filter governs emission
@pytest.mark.property
@given(trades=trade_streams())
def test_property_20_merge_and_filter(trades: list[NormalizedTrade]):
    engine = BigTradeEngine()  # MinVolume=30, MaxVolume=-1, filter on
    emitted = engine.merge_stream(trades)

    # Every emitted trade satisfies the volume filter.
    for b in emitted:
        assert b.volume >= 30  # MinVolume default
        assert b.contract == CONTRACT and b.symbol == SYMBOL

    # Independently classify with the NT BigTrade rule set, then merge with
    # the same adjacent-currentTrade rule and compare emitted groups.
    expected = _expected_emissions(trades, min_volume=30)
    got = [(b.trade_id, b.time, b.side, b.volume, b.price) for b in emitted]
    assert got == expected


def _expected_emissions(
    trades: list[NormalizedTrade], *, min_volume: int
) -> list[tuple[int, int, Side, int, float]]:
    """Replay classification + NT currentTrade merge to get emitted groups."""
    prev_price: float | None = None
    last_side: Side | None = None
    current: dict[str, object] | None = None
    trade_id = 0
    emitted: list[tuple[int, int, Side, int, float]] = []

    def finalize() -> None:
        nonlocal current
        if current is None:
            return
        volume = int(current["volume"])
        if volume >= min_volume:
            emitted.append(
                (
                    int(current["trade_id"]),
                    int(current["time"]),
                    current["side"],  # type: ignore[arg-type]
                    volume,
                    float(current["price"]),
                )
            )
        current = None

    for t in trades:
        if t.ask is not None and t.ask > 0 and t.price >= t.ask:
            side = Side.BUY
        elif t.bid is not None and t.bid > 0 and t.price <= t.bid:
            side = Side.SELL
        elif t.bid is not None and t.bid > 0 and t.ask is not None and t.ask > 0:
            dist_ask = abs(t.price - t.ask)
            dist_bid = abs(t.price - t.bid)
            if dist_ask < dist_bid:
                side = Side.BUY
            elif dist_bid < dist_ask:
                side = Side.SELL
            elif prev_price is not None and t.price > prev_price:
                side = Side.BUY
            elif prev_price is not None and t.price < prev_price:
                side = Side.SELL
            elif last_side is not None:
                side = last_side
            else:
                prev_price = t.price
                continue
        elif prev_price is not None and t.price > prev_price:
            side = Side.BUY
        elif prev_price is not None and t.price < prev_price:
            side = Side.SELL
        elif last_side is not None:
            side = last_side
        else:
            prev_price = t.price
            continue
        prev_price = t.price
        last_side = side

        if current is not None and t.time < int(current["time"]):
            continue
        if (
            current is not None
            and t.time == int(current["time"])
            and side == current["side"]
        ):
            current["volume"] = int(current["volume"]) + t.volume
            current["price"] = t.price
        else:
            finalize()
            trade_id += 1
            current = {
                "trade_id": trade_id,
                "time": t.time,
                "side": side,
                "volume": t.volume,
                "price": t.price,
            }
    finalize()
    return emitted
