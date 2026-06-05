"""Property test for timeframe roll-up consistency (task 7.3, design Property 15).

Generates arbitrary trade tick streams and verifies that every coarser-timeframe
bar produced by the :class:`~app.engines.bar_aggregator.BarAggregator` equals the
aggregation of the finer-timeframe bars spanning the same interval:

* ``open`` from the first (earliest) constituent finer bar;
* ``close`` from the last (latest) constituent finer bar;
* ``high`` as the maximum of the finer highs, ``low`` as the minimum of the finer lows;
* ``volume`` as the sum of the finer volumes.

This is checked for every (finer, coarser) supported-timeframe pair whose
coarser interval is an exact integer multiple of the finer interval (so the
finer buckets perfectly tile the coarser bucket given the shared UTC epoch
anchor), e.g. five 1m bars roll up into one 5m bar.

**Validates: Requirements 9.2**
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

_MAX_SPAN_MS = 3 * 24 * 60 * 60 * 1000

# All (finer, coarser) pairs where the coarser interval is an exact multiple of
# the finer one -- the only pairs for which a clean roll-up is well defined.
_ROLLUP_PAIRS: list[tuple[str, str]] = [
    (finer, coarser)
    for finer in SUPPORTED_TFS
    for coarser in SUPPORTED_TFS
    if _TF_MS[finer] < _TF_MS[coarser] and _TF_MS[coarser] % _TF_MS[finer] == 0
]


@st.composite
def trade_streams(draw: st.DrawFn) -> list[NormalizedTrade]:
    """Generate a non-decreasing-timestamp trade stream (see Property 14 test)."""
    n = draw(st.integers(min_value=1, max_value=60))
    base = draw(st.integers(min_value=0, max_value=_MAX_SPAN_MS))
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
    """Feed trades; return the final bar state per (tf, bucket time)."""
    agg = BarAggregator()
    final: dict[str, dict[int, OHLCVBar]] = {tf: {} for tf in SUPPORTED_TFS}
    for t in trades:
        updates: list[BarUpdate] = agg.on_trade(t)
        for u in updates:
            final[u.tf][u.bar.time] = u.bar
    return final


# Feature: gc-chart-platform, Property 15: Coarser timeframes are consistent roll-ups of finer ones
@pytest.mark.property
@given(trades=trade_streams())
def test_property_15_coarser_tf_is_rollup_of_finer(trades: list[NormalizedTrade]):
    final = _final_bars_per_tf(trades)

    for finer, coarser in _ROLLUP_PAIRS:
        coarser_ms = _TF_MS[coarser]
        finer_bars = final[finer]
        coarser_bars = final[coarser]

        # Group the finer bars by the coarser bucket that contains them.
        groups: dict[int, list[OHLCVBar]] = {}
        for time_ms, bar in finer_bars.items():
            coarser_bucket = (time_ms // coarser_ms) * coarser_ms
            groups.setdefault(coarser_bucket, []).append(bar)

        # The set of coarser bars equals the set of finer-bar roll-up groups.
        assert set(coarser_bars.keys()) == set(groups.keys())

        for coarser_bucket, members in groups.items():
            members_in_time_order = sorted(members, key=lambda b: b.time)
            expected_open = members_in_time_order[0].open
            expected_close = members_in_time_order[-1].close
            expected_high = max(b.high for b in members)
            expected_low = min(b.low for b in members)
            expected_volume = sum(b.volume for b in members)

            rolled = coarser_bars[coarser_bucket]
            assert rolled.open == expected_open
            assert rolled.close == expected_close
            assert rolled.high == expected_high
            assert rolled.low == expected_low
            assert rolled.volume == expected_volume
