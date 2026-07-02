"""Unit tests for keyed upserts and range reads (task 3.6).

Covers the last-write-wins upserts keyed by ``(symbol, contract, timeframe,
time)`` (big trades by ``(symbol, contract, time, side, trade_id)``) and the
keyed range reads used by the history/order-flow endpoints. (Requirements 8.2,
8.3, 8.4)

These are example-based unit tests; the universal last-write-wins property is
exercised separately by the property test in task 3.7.
"""

from __future__ import annotations

import pytest

from app.models import ImbalanceSide, Side
from app.storage import (
    BarRecord,
    BigTradeRecord,
    CacheStore,
    FootprintBarRecord,
    FootprintLevelRecord,
    FvgSignalRecord,
    VolumeDeltaRecord,
)


@pytest.fixture()
def store(tmp_path):
    s = CacheStore(tmp_path / "app.sqlite")
    try:
        yield s
    finally:
        s.close()


def _bar(time: int, *, close: float = 1.5, volume: int = 10, closed: bool = False):
    return BarRecord(
        symbol="GC",
        contract="GC 08-26",
        timeframe="1m",
        time=time,
        open=1.0,
        high=2.0,
        low=0.5,
        close=close,
        volume=volume,
        closed=closed,
    )


# --- bars ---------------------------------------------------------------------


@pytest.mark.unit
def test_upsert_bar_inserts_then_reads_back(store):
    store.upsert_bar(_bar(1_000))
    rows = store.read_bars("GC", "GC 08-26", "1m")
    assert len(rows) == 1
    assert rows[0].time == 1_000
    assert rows[0].close == 1.5
    assert rows[0].closed is False


@pytest.mark.unit
def test_upsert_bar_is_last_write_wins(store):
    store.upsert_bar(_bar(1_000, close=1.5, volume=10, closed=False))
    # Re-write the same key with new non-key values.
    store.upsert_bar(_bar(1_000, close=9.9, volume=99, closed=True))

    rows = store.read_bars("GC", "GC 08-26", "1m")
    assert len(rows) == 1  # no duplicate row for the same key
    assert rows[0].close == 9.9
    assert rows[0].volume == 99
    assert rows[0].closed is True


@pytest.mark.unit
def test_read_bars_returns_ascending_time(store):
    store.upsert_bars([_bar(3_000), _bar(1_000), _bar(2_000)])
    rows = store.read_bars("GC", "GC 08-26", "1m")
    assert [r.time for r in rows] == [1_000, 2_000, 3_000]


@pytest.mark.unit
def test_read_bars_range_is_inclusive(store):
    store.upsert_bars([_bar(t) for t in (1_000, 2_000, 3_000, 4_000)])
    rows = store.read_bars("GC", "GC 08-26", "1m", frm=2_000, to=3_000)
    assert [r.time for r in rows] == [2_000, 3_000]


@pytest.mark.unit
def test_read_bars_limit_returns_most_recent_ascending(store):
    store.upsert_bars([_bar(t) for t in (1_000, 2_000, 3_000, 4_000, 5_000)])
    rows = store.read_bars("GC", "GC 08-26", "1m", limit=2)
    # Most recent 2, still returned ascending.
    assert [r.time for r in rows] == [4_000, 5_000]


@pytest.mark.unit
def test_read_bars_isolated_by_key_prefix(store):
    store.upsert_bar(_bar(1_000))
    # Different timeframe and different contract must not bleed into the read.
    store.upsert_bar(
        BarRecord("GC", "GC 08-26", "5m", 1_000, 1, 2, 0, 1, 1)
    )
    store.upsert_bar(
        BarRecord("GC", "GC 10-26", "1m", 1_000, 1, 2, 0, 1, 1)
    )
    rows = store.read_bars("GC", "GC 08-26", "1m")
    assert len(rows) == 1
    assert rows[0].contract == "GC 08-26" and rows[0].timeframe == "1m"


# --- volume delta -------------------------------------------------------------


def _vd(time: int, *, delta: int = 5):
    return VolumeDeltaRecord(
        symbol="GC",
        contract="GC 08-26",
        timeframe="1m",
        time=time,
        volume=100,
        buy_volume=60,
        sell_volume=40,
        delta=delta,
        delta_high=12,
        delta_low=-3,
        open_delta=0,
        close_delta=delta,
    )


@pytest.mark.unit
def test_volume_delta_upsert_and_last_write_wins(store):
    store.upsert_volume_delta(_vd(1_000, delta=5))
    store.upsert_volume_delta(_vd(1_000, delta=-7))
    rows = store.read_volume_delta("GC", "GC 08-26", "1m")
    assert len(rows) == 1
    assert rows[0].delta == -7
    assert rows[0].close_delta == -7


@pytest.mark.unit
def test_volume_delta_range_and_limit(store):
    store.upsert_volume_deltas([_vd(t) for t in (1_000, 2_000, 3_000)])
    assert [r.time for r in store.read_volume_delta("GC", "GC 08-26", "1m")] == [
        1_000,
        2_000,
        3_000,
    ]
    recent = store.read_volume_delta("GC", "GC 08-26", "1m", limit=1)
    assert [r.time for r in recent] == [3_000]


# --- footprint (bars + levels) ------------------------------------------------


@pytest.mark.unit
def test_footprint_bar_upsert_last_write_wins(store):
    store.upsert_footprint_bar(
        FootprintBarRecord("GC", "GC 08-26", "1m", 1_000, 2345.6, 5, 55.0, 45.0)
    )
    store.upsert_footprint_bar(
        FootprintBarRecord(
            "GC", "GC 08-26", "1m", 1_000, 2350.0, -3, 40.0, 60.0,
            unfinished_high=True, unfinished_low=True,
        )
    )
    bars = store.read_footprint_bars("GC", "GC 08-26", "1m")
    assert len(bars) == 1
    assert bars[0].poc == 2350.0
    assert bars[0].bar_delta == -3
    assert bars[0].unfinished_high is True and bars[0].unfinished_low is True


@pytest.mark.unit
def test_footprint_levels_upsert_and_read_descending_price(store):
    store.upsert_footprint_levels(
        [
            FootprintLevelRecord(
                "GC", "GC 08-26", "1m", 1_000, 2345.5, 28, 3, ImbalanceSide.BID
            ),
            FootprintLevelRecord(
                "GC", "GC 08-26", "1m", 1_000, 2345.7, 5, 30, ImbalanceSide.ASK
            ),
            FootprintLevelRecord("GC", "GC 08-26", "1m", 1_000, 2345.6, 22, 18, None),
        ]
    )
    levels = store.read_footprint_levels("GC", "GC 08-26", 1_000)
    assert [lvl.price for lvl in levels] == [2345.7, 2345.6, 2345.5]
    assert levels[0].imbalance is ImbalanceSide.ASK
    assert levels[2].imbalance is ImbalanceSide.BID
    assert levels[1].imbalance is None


@pytest.mark.unit
def test_footprint_level_last_write_wins(store):
    rec = FootprintLevelRecord("GC", "GC 08-26", "1m", 1_000, 2345.5, 1, 1, None)
    store.upsert_footprint_levels([rec])
    store.upsert_footprint_levels(
        [FootprintLevelRecord(
            "GC", "GC 08-26", "1m", 1_000, 2345.5, 50, 60, ImbalanceSide.ASK
        )]
    )
    levels = store.read_footprint_levels("GC", "GC 08-26", 1_000)
    assert len(levels) == 1
    assert levels[0].bid_volume == 50 and levels[0].ask_volume == 60
    assert levels[0].imbalance is ImbalanceSide.ASK


@pytest.mark.unit
def test_footprint_before_after_helpers_return_bounded_ascending_rows(store):
    for time in (1_000, 2_000, 3_000, 4_000, 5_000):
        store.upsert_footprint_bar(
            FootprintBarRecord("GC", "GC 08-26", "1m", time, 2345.6, 5, 55.0, 45.0)
        )

    before = store.read_footprint_bars_before("GC", "GC 08-26", "1m", 4_000, 2)
    after = store.read_footprint_bars_after("GC", "GC 08-26", "1m", 2_000, 2)

    assert [bar.time for bar in before] == [2_000, 3_000]
    assert [bar.time for bar in after] == [3_000, 4_000]


# --- big trades ---------------------------------------------------------------


@pytest.mark.unit
def test_big_trade_upsert_keyed_by_time_and_side(store):
    # Same time, different side -> two distinct rows.
    store.upsert_big_trade(
        BigTradeRecord("GC", "GC 08-26", 1_000, 2345.6, 65, Side.BUY)
    )
    store.upsert_big_trade(
        BigTradeRecord("GC", "GC 08-26", 1_000, 2345.5, 40, Side.SELL)
    )
    rows = store.read_big_trades("GC", "GC 08-26")
    assert len(rows) == 2
    assert {r.side for r in rows} == {Side.BUY, Side.SELL}


@pytest.mark.unit
def test_big_trade_last_write_wins_on_same_key(store):
    store.upsert_big_trade(
        BigTradeRecord("GC", "GC 08-26", 1_000, 2345.6, 65, Side.BUY, trade_id=1)
    )
    store.upsert_big_trade(
        BigTradeRecord("GC", "GC 08-26", 1_000, 2346.0, 130, Side.BUY, trade_id=1)
    )
    rows = store.read_big_trades("GC", "GC 08-26")
    assert len(rows) == 1
    assert rows[0].volume == 130 and rows[0].price == 2346.0


@pytest.mark.unit
def test_big_trade_same_time_side_distinguished_by_trade_id(store):
    store.upsert_big_trade(
        BigTradeRecord("GC", "GC 08-26", 1_000, 2345.6, 65, Side.BUY, trade_id=1)
    )
    store.upsert_big_trade(
        BigTradeRecord("GC", "GC 08-26", 1_000, 2345.8, 40, Side.BUY, trade_id=3)
    )
    rows = store.read_big_trades("GC", "GC 08-26")
    assert [(r.trade_id, r.price, r.volume) for r in rows] == [
        (1, 2345.6, 65),
        (3, 2345.8, 40),
    ]


@pytest.mark.unit
def test_big_trade_range_and_limit(store):
    for t in (1_000, 2_000, 3_000):
        store.upsert_big_trade(
            BigTradeRecord("GC", "GC 08-26", t, 1.0, 50, Side.BUY)
        )
    assert [r.time for r in store.read_big_trades("GC", "GC 08-26")] == [
        1_000,
        2_000,
        3_000,
    ]
    in_range = store.read_big_trades("GC", "GC 08-26", frm=2_000, to=3_000)
    assert [r.time for r in in_range] == [2_000, 3_000]
    recent = store.read_big_trades("GC", "GC 08-26", limit=1)
    assert [r.time for r in recent] == [3_000]


@pytest.mark.unit
def test_replace_big_trades_removes_stale_rows_in_range(store):
    store.upsert_big_trades(
        [
            BigTradeRecord("GC", "GC 08-26", 1_000, 1.0, 50, Side.BUY, trade_id=0),
            BigTradeRecord("GC", "GC 08-26", 2_000, 1.0, 50, Side.SELL, trade_id=0),
            BigTradeRecord("GC", "GC 08-26", 9_000, 1.0, 50, Side.BUY, trade_id=0),
        ]
    )
    store.replace_big_trades(
        "GC",
        "GC 08-26",
        1_000,
        2_000,
        [
            BigTradeRecord(
                "GC", "GC 08-26", 1_500, 2.0, 60, Side.BUY, trade_id=11
            )
        ],
    )
    rows = store.read_big_trades("GC", "GC 08-26")
    assert [(r.time, r.trade_id, r.price) for r in rows] == [
        (1_500, 11, 2.0),
        (9_000, 0, 1.0),
    ]


@pytest.mark.unit
def test_upsert_derived_batch_persists_complete_trade_snapshot(store):
    footprint_bar = FootprintBarRecord(
        "GC", "GC 08-26", "1m", 1_000, 2345.6, 5, 55.0, 45.0
    )
    footprint_level = FootprintLevelRecord(
        "GC", "GC 08-26", "1m", 1_000, 2345.6, 10, 20, ImbalanceSide.ASK
    )
    fvg_signal = FvgSignalRecord(
        "GC", "GC 08-26", "1m", 1_000, 1, 3, 3, 2346.0, 2345.5, 1.7
    )
    big_trade = BigTradeRecord("GC", "GC 08-26", 1_000, 2345.6, 65, Side.BUY)

    store.upsert_derived_batch(
        bars=[_bar(1_000)],
        volume_deltas=[_vd(1_000)],
        footprint_bar=footprint_bar,
        footprint_levels=[footprint_level],
        fvg_signals=[fvg_signal],
        big_trades=[big_trade],
    )

    assert store.read_bars("GC", "GC 08-26", "1m") == [_bar(1_000)]
    assert store.read_volume_delta("GC", "GC 08-26", "1m") == [_vd(1_000)]
    assert store.read_footprint_bars("GC", "GC 08-26") == [footprint_bar]
    assert store.read_footprint_levels("GC", "GC 08-26", 1_000) == [
        footprint_level
    ]
    assert store.read_fvg_signals("GC", "GC 08-26", "1m") == [fvg_signal]
    assert store.read_big_trades("GC", "GC 08-26") == [big_trade]


@pytest.mark.unit
def test_empty_reads_return_empty_list(store):
    assert store.read_bars("GC", "GC 08-26", "1m") == []
    assert store.read_volume_delta("GC", "GC 08-26", "1m") == []
    assert store.read_footprint_bars("GC", "GC 08-26") == []
    assert store.read_footprint_levels("GC", "GC 08-26", 1_000) == []
    assert store.read_fvg_signals("GC", "GC 08-26", "1m") == []
    assert store.read_big_trades("GC", "GC 08-26") == []
    # Upserting an empty batch is a no-op.
    store.upsert_bars([])
    assert store.read_bars("GC", "GC 08-26", "1m") == []
