"""Unit tests for canonical models and Canonical_Timestamp helpers (task 2.2).

Example-based coverage of the ms-since-epoch-UTC conversions, ISO-8601
equivalence, boundary values (epoch 0, sub-millisecond flooring, large and
pre-epoch values), naive-as-UTC handling, and the comparison helpers used by
merge/parity logic, plus ``NormalizedTrade`` / ``NormalizedQuote`` construction.

Covers Requirements 1.1 (normalized trade fields) and 1.2 (normalized quote
fields), and the Canonical_Timestamp definition shared by both.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.models.canonical import NormalizedQuote, NormalizedTrade, Side
from app.models.timestamp import (
    MS_PER_SECOND,
    compare,
    earliest,
    from_canonical_ms,
    from_iso8601,
    is_after,
    is_before,
    is_same_instant,
    latest,
    now_ms,
    to_canonical_ms,
    to_iso8601,
)

# --- ms <-> UTC datetime round-trips ------------------------------------------


@pytest.mark.unit
def test_epoch_datetime_is_zero_ms():
    epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
    assert to_canonical_ms(epoch) == 0


@pytest.mark.unit
def test_from_canonical_ms_zero_is_epoch():
    dt = from_canonical_ms(0)
    assert dt == datetime(1970, 1, 1, tzinfo=timezone.utc)
    assert dt.tzinfo == timezone.utc


@pytest.mark.unit
def test_known_instant_round_trip():
    # 2025-01-02T03:04:05.678Z -> ms and back.
    dt = datetime(2025, 1, 2, 3, 4, 5, 678_000, tzinfo=timezone.utc)
    ms = to_canonical_ms(dt)
    assert ms == 1735787045678
    assert from_canonical_ms(ms) == dt


@pytest.mark.unit
@pytest.mark.parametrize(
    "ms",
    [0, 1, 999, 1000, 1730313600000, 1735787045678, 4102444800000],
)
def test_ms_to_datetime_round_trip(ms):
    # ms -> datetime -> ms is the identity for any integer ms.
    assert to_canonical_ms(from_canonical_ms(ms)) == ms


@pytest.mark.unit
def test_datetime_round_trip_at_millisecond_resolution():
    dt = datetime(2026, 6, 30, 23, 59, 59, 123_000, tzinfo=timezone.utc)
    assert from_canonical_ms(to_canonical_ms(dt)) == dt


# --- ISO-8601 equivalence ------------------------------------------------------


@pytest.mark.unit
def test_to_iso8601_has_millisecond_precision_and_utc_offset():
    iso = to_iso8601(1735787045678)
    assert iso == "2025-01-02T03:04:05.678+00:00"


@pytest.mark.unit
def test_to_iso8601_epoch():
    assert to_iso8601(0) == "1970-01-01T00:00:00.000+00:00"


@pytest.mark.unit
def test_from_iso8601_with_explicit_utc_offset():
    assert from_iso8601("2025-01-02T03:04:05.678+00:00") == 1735787045678


@pytest.mark.unit
def test_from_iso8601_with_z_suffix():
    # ``Z`` is accepted by datetime.fromisoformat on 3.11+ and means UTC.
    assert from_iso8601("2025-01-02T03:04:05.678Z") == 1735787045678


@pytest.mark.unit
def test_from_iso8601_naive_is_interpreted_as_utc():
    # No offset -> treated as UTC (matches naive-as-UTC handling).
    assert from_iso8601("2025-01-02T03:04:05.678") == 1735787045678


@pytest.mark.unit
def test_from_iso8601_non_utc_offset_is_normalized_to_utc():
    # 03:04:05.678+02:00 == 01:04:05.678Z
    expected = from_iso8601("2025-01-02T01:04:05.678+00:00")
    assert from_iso8601("2025-01-02T03:04:05.678+02:00") == expected


@pytest.mark.unit
@pytest.mark.parametrize("ms", [0, 1735787045678, 1730313600000, 999])
def test_iso8601_round_trip(ms):
    assert from_iso8601(to_iso8601(ms)) == ms


# --- boundary values & flooring ------------------------------------------------


@pytest.mark.unit
def test_sub_millisecond_is_floored_toward_epoch():
    # 1.678999 ms worth of microseconds -> floored to 1 ms.
    dt = datetime(1970, 1, 1, 0, 0, 0, 1999, tzinfo=timezone.utc)
    assert to_canonical_ms(dt) == 1


@pytest.mark.unit
def test_sub_millisecond_floor_on_realistic_instant():
    dt = datetime(2025, 1, 2, 3, 4, 5, 678_950, tzinfo=timezone.utc)
    # 678_950 microseconds -> 678 ms (truncated, not rounded).
    assert to_canonical_ms(dt) == 1735787045678


@pytest.mark.unit
def test_large_far_future_value_is_exact():
    # Year 2286-ish; exercises that integer math stays exact for large values.
    ms = 9_999_999_999_999
    assert to_canonical_ms(from_canonical_ms(ms)) == ms


@pytest.mark.unit
def test_pre_epoch_negative_value_round_trips():
    # One second before the epoch.
    pre = datetime(1969, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
    assert to_canonical_ms(pre) == -1000
    assert from_canonical_ms(-1000) == pre


@pytest.mark.unit
def test_pre_epoch_with_sub_second_floors_toward_negative_infinity():
    # 500ms before epoch -> -500 ms, and back exactly.
    dt = datetime(1969, 12, 31, 23, 59, 59, 500_000, tzinfo=timezone.utc)
    assert to_canonical_ms(dt) == -500
    assert from_canonical_ms(-500) == dt


@pytest.mark.unit
def test_ms_per_second_constant():
    assert MS_PER_SECOND == 1000


# --- naive-as-UTC handling -----------------------------------------------------


@pytest.mark.unit
def test_naive_datetime_treated_as_utc():
    naive = datetime(2025, 1, 2, 3, 4, 5, 678_000)
    aware = datetime(2025, 1, 2, 3, 4, 5, 678_000, tzinfo=timezone.utc)
    assert to_canonical_ms(naive) == to_canonical_ms(aware)


@pytest.mark.unit
def test_aware_non_utc_datetime_converted_before_measuring():
    tz_plus2 = timezone(timedelta(hours=2))
    aware = datetime(2025, 1, 2, 5, 4, 5, 678_000, tzinfo=tz_plus2)
    # 05:04:05+02:00 == 03:04:05Z
    assert to_canonical_ms(aware) == 1735787045678


@pytest.mark.unit
def test_now_ms_is_close_to_current_utc():
    before = to_canonical_ms(datetime.now(timezone.utc))
    value = now_ms()
    after = to_canonical_ms(datetime.now(timezone.utc))
    assert before <= value <= after


# --- comparison helpers used by merge/parity logic -----------------------------


@pytest.mark.unit
def test_compare_three_way():
    assert compare(1, 2) == -1
    assert compare(2, 1) == 1
    assert compare(5, 5) == 0


@pytest.mark.unit
def test_is_before_and_is_after_are_strict():
    assert is_before(1, 2) is True
    assert is_before(2, 2) is False
    assert is_after(2, 1) is True
    assert is_after(2, 2) is False


@pytest.mark.unit
def test_is_same_instant_equality():
    # The equality used by BigTrade merge keys / parity comparisons.
    assert is_same_instant(1730313600000, 1730313600000) is True
    assert is_same_instant(1730313600000, 1730313600001) is False


@pytest.mark.unit
def test_comparison_helpers_consistent_with_compare():
    for a, b in [(1, 2), (2, 1), (7, 7), (-5, 3), (0, 0)]:
        c = compare(a, b)
        assert is_before(a, b) == (c < 0)
        assert is_after(a, b) == (c > 0)
        assert is_same_instant(a, b) == (c == 0)


@pytest.mark.unit
def test_earliest_and_latest_select_extremes():
    values = [1730313600000, 1730313600005, 1730313599999]
    assert earliest(*values) == 1730313599999
    assert latest(*values) == 1730313600005


@pytest.mark.unit
def test_earliest_latest_single_value():
    assert earliest(42) == 42
    assert latest(42) == 42


@pytest.mark.unit
def test_earliest_latest_require_at_least_one_timestamp():
    with pytest.raises(ValueError):
        earliest()
    with pytest.raises(ValueError):
        latest()


# --- canonical model construction ---------------------------------------------


@pytest.mark.unit
def test_normalized_trade_construction_holds_all_required_fields():
    trade = NormalizedTrade(
        symbol="GC",
        contract="GC 08-26",
        time=1730313600000,
        price=2346.5,
        volume=3,
        bid=2346.4,
        ask=2346.6,
        best_bid=2346.4,
        best_ask=2346.6,
        sequence=1,
    )
    assert trade.symbol == "GC"
    assert trade.contract == "GC 08-26"
    assert trade.time == 1730313600000
    assert trade.price == 2346.5
    assert trade.volume == 3
    assert trade.bid == 2346.4
    assert trade.ask == 2346.6
    assert trade.best_bid == 2346.4
    assert trade.best_ask == 2346.6
    assert trade.sequence == 1


@pytest.mark.unit
def test_normalized_trade_allows_missing_snapshot_fields():
    trade = NormalizedTrade(
        symbol="GC",
        contract="GC 08-26",
        time=1730313600000,
        price=2346.5,
        volume=1,
        bid=None,
        ask=None,
        best_bid=None,
        best_ask=None,
        sequence=7,
    )
    assert trade.bid is None
    assert trade.ask is None
    assert trade.best_bid is None
    assert trade.best_ask is None


@pytest.mark.unit
def test_normalized_quote_construction_holds_all_required_fields():
    quote = NormalizedQuote(
        symbol="GC",
        contract="GC 08-26",
        time=1730313600000,
        bid=2346.4,
        ask=2346.6,
        bid_size=10,
        ask_size=12,
        sequence=2,
    )
    assert quote.symbol == "GC"
    assert quote.contract == "GC 08-26"
    assert quote.time == 1730313600000
    assert quote.bid == 2346.4
    assert quote.ask == 2346.6
    assert quote.bid_size == 10
    assert quote.ask_size == 12
    assert quote.sequence == 2


@pytest.mark.unit
def test_trade_time_is_a_canonical_timestamp_round_tripping_to_utc():
    # The model's ``time`` field is a Canonical_Timestamp, so it interoperates
    # with the helpers used downstream for bucketing/merge.
    dt = datetime(2024, 10, 30, 20, 0, 0, tzinfo=timezone.utc)
    trade = NormalizedTrade(
        symbol="GC",
        contract="GC 12-24",
        time=to_canonical_ms(dt),
        price=2700.0,
        volume=1,
        bid=2699.9,
        ask=2700.1,
        best_bid=2699.9,
        best_ask=2700.1,
        sequence=1,
    )
    assert from_canonical_ms(trade.time) == dt


@pytest.mark.unit
def test_side_enum_serializes_to_wire_literals():
    assert Side.BUY.value == "buy"
    assert Side.SELL.value == "sell"
    assert str(Side.BUY) == "buy"
    assert str(Side.SELL) == "sell"
    # str-valued enum compares/serializes as its literal.
    assert Side("buy") is Side.BUY
    assert Side("sell") is Side.SELL
