"""Property test for OHLCV aggregation invariants (task 7.2, design Property 14).

Generates arbitrary trade tick streams (non-decreasing Canonical_Timestamps,
as guaranteed upstream by the sequence validator) and feeds them through the
:class:`~app.engines.bar_aggregator.BarAggregator`. For every supported
timeframe and every produced bar it asserts the aggregation invariants and
correct UTC bucketization:

* ``low <= min(open, close)`` and ``high >= max(open, close)`` and ``low <= high``;
* ``low == min`` and ``high == max`` of the constituent trade prices;
* ``volume == sum`` of constituent trade volumes;
* ``open == first`` trade price in the bucket, ``close == last``;
* each bar's ``time`` equals the timeframe-floored bucket start (intraday floored
  to multiples of their interval; ``1D`` floored to the UTC calendar day);
* every trade lands in exactly one bucket (the bucket partition is total and
  disjoint per timeframe).

**Validates: Requirements 9.1, 9.4, 9.5**
"""

from __future__ import annotations

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.engines.bar_aggregator import SUPPORTED_TFS, BarAggregator, _TF_MS
from app.models.canonical import NormalizedTrade
from app.models.messages import BarUpdate, OHLCVBar

CONTRACT = "GC 08-26"
SYMBOL = "GC"

# Span timestamps across ~3 days so that even the coarsest timeframes (4h, 1D)
# see multiple buckets. ms since epoch UTC.
_MAX_SPAN_MS = 3 * 24 * 60 * 60 * 1000


@st.composite
def trade_streams(draw: st.DrawFn) -> list[NormalizedTrade]:
    """Generate a stream of trades with non-decreasing timestamps.

    Builds ``n`` trades whose times are cumulative non-negative gaps from a
    random base, mirroring the monotonic arrival the aggregator expects. Prices
    are exact picks (no arithmetic) so min/max/open/close compare exactly;
    volumes are positive integers.
    """
    n = draw(st.integers(min_value=1, max_value=60))
    base = draw(st.integers(min_value=0, max_value=_MAX_SPAN_MS))
    # Gaps include 0 (same-ms clusters) up to a few hours so buckets roll.
    gaps = draw(
        st.lists(
            st.integers(min_value=0, max_value=2 * 60 * 60 * 1000),
            min_size=n,
            max_size=n,
        )
    )
    prices = draw(
        st.lists(
            st.floats(
                min_value=0.01,
                max_value=100_000.0,
                allow_nan=False,
                allow_infinity=False,
            ),
            min_size=n,
            max_size=n,
        )
    )
    volumes = draw(
        st.lists(st.integers(min_value=1, max_value=10_000), min_size=n, max_size=n)
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
                bid=None,
                ask=None,
                best_bid=None,
                best_ask=None,
                sequence=i,
            )
        )
    return trades


def _final_bars_per_tf(
    trades: list[NormalizedTrade],
) -> dict[str, dict[int, OHLCVBar]]:
    """Feed trades and collect the final bar state per (tf, bucket time).

    Every ``on_trade`` emits a ``bar_update`` snapshot for each affected bar; the
    last snapshot recorded for a given ``(tf, bar.time)`` is that bar's final
    state (a ``closed=True`` snapshot for rolled buckets, or the latest
    ``closed=False`` snapshot for the still-open bucket).
    """
    agg = BarAggregator()
    final: dict[str, dict[int, OHLCVBar]] = {tf: {} for tf in SUPPORTED_TFS}
    for t in trades:
        updates: list[BarUpdate] = agg.on_trade(t)
        for u in updates:
            final[u.tf][u.bar.time] = u.bar
    return final


# Feature: gc-chart-platform, Property 14: OHLCV bars satisfy aggregation invariants and correct bucketization
@pytest.mark.property
@given(trades=trade_streams())
def test_property_14_ohlcv_aggregation_invariants(trades: list[NormalizedTrade]):
    agg = BarAggregator()

    # Every trade lands in exactly one bucket per timeframe: bucket_start is a
    # total function placing the trade within [bucket, bucket + interval).
    for t in trades:
        for tf in SUPPORTED_TFS:
            interval = _TF_MS[tf]
            bucket = agg.bucket_start(t.time, tf)
            assert bucket % interval == 0  # aligned to UTC boundary
            assert bucket <= t.time < bucket + interval

    final = _final_bars_per_tf(trades)

    for tf in SUPPORTED_TFS:
        interval = _TF_MS[tf]

        # Independently reconstruct expected per-bucket bars from the trades.
        expected: dict[int, list[NormalizedTrade]] = {}
        for t in trades:
            bucket = agg.bucket_start(t.time, tf)
            expected.setdefault(bucket, []).append(t)

        # The aggregator must produce exactly the same set of bucket times.
        assert set(final[tf].keys()) == set(expected.keys())

        for bucket, bucket_trades in expected.items():
            bar = final[tf][bucket]
            prices = [t.price for t in bucket_trades]
            vols = [t.volume for t in bucket_trades]

            # Bucket time equals the timeframe-floored bucket start.
            assert bar.time == bucket

            # OHLC selection invariants.
            assert bar.open == prices[0]
            assert bar.close == prices[-1]
            assert bar.high == max(prices)
            assert bar.low == min(prices)

            # Ordering invariants between O/H/L/C.
            assert bar.low <= bar.high
            assert bar.low <= min(bar.open, bar.close)
            assert bar.high >= max(bar.open, bar.close)

            # Volume conservation.
            assert bar.volume == sum(vols)
