"""Unit tests for the Bar_Aggregator (task 7.1).

Example-based coverage of OHLCV bucketization and bar updates: bucket flooring
for intraday timeframes and the 1D UTC-calendar-day boundary, opening/updating
the current bar per timeframe, and producing ``bar_update`` outputs with the
``closed`` flag set when a new bucket opens.

Covers Requirements 9.1 (timeframes), 9.2 (per-TF update), 9.3 (bar_update +
closed flag), 9.4/9.5 (UTC bucketization, 1D = UTC calendar day).
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.engines.bar_aggregator import SUPPORTED_TFS, BarAggregator
from app.models.canonical import NormalizedTrade
from app.models.timestamp import to_canonical_ms

SYMBOL = "GC"
CONTRACT = "GC 08-26"


def _trade(time_ms: int, price: float, volume: int, sequence: int = 0) -> NormalizedTrade:
    return NormalizedTrade(
        symbol=SYMBOL,
        contract=CONTRACT,
        time=time_ms,
        price=price,
        volume=volume,
        bid=None,
        ask=None,
        best_bid=None,
        best_ask=None,
        sequence=sequence,
    )


def _ms(*args: int) -> int:
    return to_canonical_ms(datetime(*args, tzinfo=timezone.utc))


# --- supported timeframes ------------------------------------------------------


@pytest.mark.unit
def test_supported_timeframes_match_design():
    assert SUPPORTED_TFS == ["1m", "3m", "5m", "15m", "30m", "1h", "4h", "1D"]


@pytest.mark.unit
def test_on_trade_emits_one_update_per_timeframe_on_first_trade():
    agg = BarAggregator()
    updates = agg.on_trade(_trade(_ms(2025, 1, 2, 3, 4, 5), 2345.6, 3))
    # First trade opens a bar in every supported timeframe.
    assert len(updates) == len(SUPPORTED_TFS)
    assert {u.tf for u in updates} == set(SUPPORTED_TFS)
    assert all(u.closed is False for u in updates)


# --- bucketization (Req 9.4, 9.5) ----------------------------------------------


@pytest.mark.unit
def test_bucket_start_floors_intraday_to_interval_multiple():
    agg = BarAggregator()
    # 03:04:05.678 floors to 03:04:00 for 1m.
    ts = _ms(2025, 1, 2, 3, 4, 5) + 678
    assert agg.bucket_start(ts, "1m") == _ms(2025, 1, 2, 3, 4, 0)
    # 03:04 floors to 03:00 for 5m and 03:00 for 15m/30m/1h.
    assert agg.bucket_start(_ms(2025, 1, 2, 3, 4, 0), "5m") == _ms(2025, 1, 2, 3, 0, 0)
    assert agg.bucket_start(_ms(2025, 1, 2, 3, 7, 0), "5m") == _ms(2025, 1, 2, 3, 5, 0)
    assert agg.bucket_start(_ms(2025, 1, 2, 3, 47, 0), "15m") == _ms(2025, 1, 2, 3, 45, 0)
    assert agg.bucket_start(_ms(2025, 1, 2, 3, 47, 0), "30m") == _ms(2025, 1, 2, 3, 30, 0)
    assert agg.bucket_start(_ms(2025, 1, 2, 3, 47, 0), "1h") == _ms(2025, 1, 2, 3, 0, 0)


@pytest.mark.unit
def test_bucket_start_4h_floors_to_four_hour_utc_multiple():
    agg = BarAggregator()
    # 03:59 -> 00:00, 05:00 -> 04:00, 23:59 -> 20:00 (UTC, anchored at midnight).
    assert agg.bucket_start(_ms(2025, 1, 2, 3, 59, 0), "4h") == _ms(2025, 1, 2, 0, 0, 0)
    assert agg.bucket_start(_ms(2025, 1, 2, 5, 0, 0), "4h") == _ms(2025, 1, 2, 4, 0, 0)
    assert agg.bucket_start(_ms(2025, 1, 2, 23, 59, 0), "4h") == _ms(2025, 1, 2, 20, 0, 0)


@pytest.mark.unit
def test_bucket_start_1d_floors_to_utc_calendar_day():
    agg = BarAggregator()
    midnight = _ms(2025, 1, 2, 0, 0, 0)
    assert agg.bucket_start(_ms(2025, 1, 2, 0, 0, 0), "1D") == midnight
    assert agg.bucket_start(_ms(2025, 1, 2, 13, 37, 42) + 123, "1D") == midnight
    assert agg.bucket_start(_ms(2025, 1, 2, 23, 59, 59) + 999, "1D") == midnight
    # Next day rolls to the next midnight.
    assert agg.bucket_start(_ms(2025, 1, 3, 0, 0, 0), "1D") == _ms(2025, 1, 3, 0, 0, 0)


@pytest.mark.unit
def test_bucket_start_pre_epoch_floors_toward_negative_infinity():
    agg = BarAggregator()
    # 30s before epoch is in the 1m bucket starting at -60_000 ms.
    assert agg.bucket_start(-30_000, "1m") == -60_000
    # Exactly on a boundary stays put.
    assert agg.bucket_start(-60_000, "1m") == -60_000


@pytest.mark.unit
def test_bucket_start_rejects_unknown_timeframe():
    agg = BarAggregator()
    with pytest.raises(ValueError):
        agg.bucket_start(0, "2m")


# --- OHLCV update within a bucket (Req 9.2) ------------------------------------


@pytest.mark.unit
def test_current_bar_accumulates_ohlcv_within_one_bucket():
    agg = BarAggregator()
    base = _ms(2025, 1, 2, 3, 4, 0)
    agg.on_trade(_trade(base + 1_000, 100.0, 2))
    agg.on_trade(_trade(base + 2_000, 105.0, 3))  # new high
    agg.on_trade(_trade(base + 3_000, 95.0, 1))   # new low
    agg.on_trade(_trade(base + 4_000, 101.0, 4))  # close

    bar = agg.current_bar(CONTRACT, "1m")
    assert bar is not None
    assert bar.time == base
    assert bar.open == 100.0
    assert bar.high == 105.0
    assert bar.low == 95.0
    assert bar.close == 101.0
    assert bar.volume == 2 + 3 + 1 + 4


@pytest.mark.unit
def test_updates_within_bucket_are_not_closed():
    agg = BarAggregator()
    base = _ms(2025, 1, 2, 3, 4, 0)
    agg.on_trade(_trade(base + 1_000, 100.0, 2))
    updates = agg.on_trade(_trade(base + 2_000, 101.0, 1))
    one_m = [u for u in updates if u.tf == "1m"]
    assert len(one_m) == 1
    assert one_m[0].closed is False
    assert one_m[0].bar.close == 101.0
    assert one_m[0].bar.volume == 3


# --- bucket roll closes the prior bar (Req 9.3) --------------------------------


@pytest.mark.unit
def test_new_bucket_closes_prior_1m_bar_and_opens_new_one():
    agg = BarAggregator()
    first = _ms(2025, 1, 2, 3, 4, 30)   # 03:04 bucket
    second = _ms(2025, 1, 2, 3, 5, 10)  # 03:05 bucket
    agg.on_trade(_trade(first, 100.0, 2))
    updates = agg.on_trade(_trade(second, 110.0, 5))

    one_m = [u for u in updates if u.tf == "1m"]
    # Expect exactly two 1m updates: prior bar closed, then new bar opened.
    assert len(one_m) == 2
    closed, opened = one_m
    assert closed.closed is True
    assert closed.bar.time == _ms(2025, 1, 2, 3, 4, 0)
    assert closed.bar.open == 100.0
    assert closed.bar.close == 100.0
    assert closed.bar.volume == 2

    assert opened.closed is False
    assert opened.bar.time == _ms(2025, 1, 2, 3, 5, 0)
    assert opened.bar.open == 110.0
    assert opened.bar.volume == 5


@pytest.mark.unit
def test_minute_roll_does_not_close_coarser_timeframes():
    agg = BarAggregator()
    first = _ms(2025, 1, 2, 3, 1, 30)   # 03:01 1m bucket, 03:00 5m bucket
    second = _ms(2025, 1, 2, 3, 2, 10)  # 03:02 1m bucket, 03:00 5m bucket
    agg.on_trade(_trade(first, 100.0, 2))
    updates = agg.on_trade(_trade(second, 110.0, 5))

    # The 1m bucket rolls (03:01 -> 03:02) so 1m closes + opens.
    one_m = [u for u in updates if u.tf == "1m"]
    assert len(one_m) == 2
    assert [u.closed for u in one_m] == [True, False]

    # Both trades share the 03:00 5m bucket, so 5m only updates (no close).
    five_m = [u for u in updates if u.tf == "5m"]
    assert len(five_m) == 1
    assert five_m[0].closed is False
    assert five_m[0].bar.time == _ms(2025, 1, 2, 3, 0, 0)
    assert five_m[0].bar.volume == 7  # both trades in the same 5m bucket


@pytest.mark.unit
def test_day_roll_closes_the_1d_bar():
    agg = BarAggregator()
    day1 = _ms(2025, 1, 2, 23, 59, 0)
    day2 = _ms(2025, 1, 3, 0, 0, 30)
    agg.on_trade(_trade(day1, 100.0, 2))
    updates = agg.on_trade(_trade(day2, 110.0, 3))

    one_d = [u for u in updates if u.tf == "1D"]
    assert len(one_d) == 2
    closed, opened = one_d
    assert closed.closed is True
    assert closed.bar.time == _ms(2025, 1, 2, 0, 0, 0)
    assert opened.closed is False
    assert opened.bar.time == _ms(2025, 1, 3, 0, 0, 0)


# --- emitted snapshots are independent of later mutation -----------------------


@pytest.mark.unit
def test_emitted_bar_snapshot_is_not_mutated_by_later_trades():
    agg = BarAggregator()
    base = _ms(2025, 1, 2, 3, 4, 0)
    updates = agg.on_trade(_trade(base + 1_000, 100.0, 2))
    one_m = next(u for u in updates if u.tf == "1m")
    # Fold another trade into the same bucket; the earlier snapshot must not change.
    agg.on_trade(_trade(base + 2_000, 200.0, 5))
    assert one_m.bar.close == 100.0
    assert one_m.bar.volume == 2
    assert one_m.bar.high == 100.0


@pytest.mark.unit
def test_current_bar_returns_none_before_any_trade():
    agg = BarAggregator()
    assert agg.current_bar(CONTRACT, "1m") is None


@pytest.mark.unit
def test_current_bar_snapshot_is_a_copy():
    agg = BarAggregator()
    base = _ms(2025, 1, 2, 3, 4, 0)
    agg.on_trade(_trade(base, 100.0, 2))
    snapshot = agg.current_bar(CONTRACT, "1m")
    assert snapshot is not None
    snapshot.close = 999.0  # mutate the copy
    again = agg.current_bar(CONTRACT, "1m")
    assert again is not None
    assert again.close == 100.0


# --- out-of-order trade for an already-closed bucket is ignored ----------------


@pytest.mark.unit
def test_out_of_order_trade_into_closed_bucket_is_ignored_for_that_tf():
    agg = BarAggregator()
    first = _ms(2025, 1, 2, 3, 4, 30)
    second = _ms(2025, 1, 2, 3, 6, 10)  # opens 03:06 1m bar, closing 03:04
    agg.on_trade(_trade(first, 100.0, 2))
    agg.on_trade(_trade(second, 110.0, 3))
    # A late trade timestamped back in the 03:04 1m bucket.
    late = _ms(2025, 1, 2, 3, 4, 45)
    updates = agg.on_trade(_trade(late, 50.0, 9))
    one_m = [u for u in updates if u.tf == "1m"]
    # No 1m update produced; the current 1m bar (03:06) is untouched.
    assert one_m == []
    current = agg.current_bar(CONTRACT, "1m")
    assert current is not None
    assert current.time == _ms(2025, 1, 2, 3, 6, 0)
    assert current.volume == 3


@pytest.mark.unit
def test_multiple_contracts_keep_independent_bars():
    agg = BarAggregator()
    base = _ms(2025, 1, 2, 3, 4, 0)
    other = NormalizedTrade(
        symbol=SYMBOL,
        contract="GC 10-26",
        time=base + 1_000,
        price=500.0,
        volume=7,
        bid=None,
        ask=None,
        best_bid=None,
        best_ask=None,
        sequence=0,
    )
    agg.on_trade(_trade(base + 1_000, 100.0, 2))
    agg.on_trade(other)
    bar_a = agg.current_bar(CONTRACT, "1m")
    bar_b = agg.current_bar("GC 10-26", "1m")
    assert bar_a is not None and bar_a.volume == 2
    assert bar_b is not None and bar_b.volume == 7
