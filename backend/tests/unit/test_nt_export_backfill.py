from __future__ import annotations

from datetime import timezone
from pathlib import Path

import pytest

from app.backfill.nt_export import (
    NtExportPaths,
    import_nt_export_derived_cache,
    import_nt_export_gap,
    iter_last_trades,
    iter_quotes,
    parse_nt_timestamp,
)
from app.models import NormalizedTrade
from app.storage.cache_store import CacheStore
from app.storage.records import BarRecord, VolumeDeltaRecord
from app.storage.tick_store import TickStore


_SYMBOL = "GC"
_CONTRACT = "GC 08-26"
_CHART_CONTRACT = "GC"


def _write(path: Path, text: str) -> Path:
    path.write_text(text.strip() + "\n", encoding="utf-8")
    return path


@pytest.mark.unit
def test_parse_nt_timestamp_uses_fractional_100ns_digits_as_utc_ms():
    assert parse_nt_timestamp("20260602 000000 0440000", timezone.utc) == 1_780_358_400_044
    assert parse_nt_timestamp("20260602 085736 2080000", timezone.utc) == 1_780_390_656_208


@pytest.mark.unit
def test_iter_last_trades_parses_trade_snapshot(tmp_path: Path):
    last = _write(
        tmp_path / "GC 08-26.Last.txt",
        "20260602 000000 0440000;4514.4;4514.1;4514.4;3",
    )

    trades = list(iter_last_trades(last, _SYMBOL, _CONTRACT, timezone.utc, None, None))

    assert len(trades) == 1
    assert trades[0].time == 1_780_358_400_044
    assert trades[0].price == 4514.4
    assert trades[0].bid == 4514.1
    assert trades[0].ask == 4514.4
    assert trades[0].volume == 3
    assert trades[0].sequence == 1


@pytest.mark.unit
def test_iter_quotes_merges_bid_and_ask_exports(tmp_path: Path):
    bid = _write(
        tmp_path / "GC 08-26.Bid.txt",
        """
        20260602 000000 0160000;4514;;;3
        20260602 000000 0440000;4514.2;;;1
        """,
    )
    ask = _write(
        tmp_path / "GC 08-26.Ask.txt",
        """
        20260602 000000 0200000;4514.5;;;2
        20260602 000000 0480000;4514.6;;;2
        """,
    )

    quotes = list(iter_quotes(bid, ask, _SYMBOL, _CONTRACT, timezone.utc, None, None))

    assert [(q.time, q.bid, q.ask, q.bid_size, q.ask_size) for q in quotes] == [
        (1_780_358_400_020, 4514.0, 4514.5, 3, 2),
        (1_780_358_400_044, 4514.2, 4514.5, 1, 2),
        (1_780_358_400_048, 4514.2, 4514.6, 1, 2),
    ]


@pytest.mark.unit
def test_iter_quotes_stops_side_files_after_to_bound(tmp_path: Path):
    bid = _write(
        tmp_path / "GC 08-26.Bid.txt",
        """
        20260602 000000 0160000;4514.0;;;3
        20260602 000001 0000000;bad-price;;;1
        """,
    )
    ask = _write(
        tmp_path / "GC 08-26.Ask.txt",
        """
        20260602 000000 0200000;4514.5;;;2
        20260602 000001 0000000;bad-price;;;1
        """,
    )
    to = parse_nt_timestamp("20260602 000000 0500000", timezone.utc)

    quotes = list(iter_quotes(bid, ask, _SYMBOL, _CONTRACT, timezone.utc, None, to))

    assert [(q.time, q.bid, q.ask, q.bid_size, q.ask_size) for q in quotes] == [
        (1_780_358_400_020, 4514.0, 4514.5, 3, 2),
    ]


@pytest.mark.unit
def test_import_nt_export_gap_writes_raw_and_rebuilds_cache(tmp_path: Path):
    last = _write(
        tmp_path / "GC 08-26.Last.txt",
        """
        20260602 000000 0480000;4514.4;4514.1;4514.4;20
        20260602 000000 0480000;4514.5;4514.2;4514.5;15
        20260602 000100 0000000;4515.0;4514.8;4515.0;2
        """,
    )
    bid = _write(
        tmp_path / "GC 08-26.Bid.txt",
        """
        20260602 000000 0160000;4514.0;;;3
        20260602 000000 0440000;4514.2;;;1
        20260602 000100 0000000;4514.8;;;1
        """,
    )
    ask = _write(
        tmp_path / "GC 08-26.Ask.txt",
        """
        20260602 000000 0200000;4514.5;;;2
        20260602 000000 0480000;4514.6;;;2
        20260602 000100 0000000;4515.0;;;1
        """,
    )

    summary = import_nt_export_gap(
        paths=NtExportPaths(last=last, bid=bid, ask=ask),
        symbol=_SYMBOL,
        contract=_CONTRACT,
        ticks_dir=tmp_path / "ticks",
        cache_db_path=tmp_path / "app.sqlite",
        export_tz=timezone.utc,
    )

    assert summary.trades == 3
    assert summary.quotes == 5
    assert summary.raw_trades_after == 3
    assert summary.raw_quotes_after == 5
    assert summary.rebuilt_bars >= 2
    assert summary.rebuilt_footprint_bars == 2
    assert summary.rebuilt_big_trades == 1

    store = TickStore(tmp_path / "ticks")
    cache = CacheStore(tmp_path / "app.sqlite")
    try:
        raw = list(store.read_range(_CONTRACT, summary.range_from, summary.range_to))
        assert [t.price for t in raw] == [4514.4, 4514.5, 4515.0]

        bars = cache.read_bars(_SYMBOL, _CONTRACT, "1m")
        first = next(b for b in bars if b.time == 1_780_358_400_000)
        assert first.open == 4514.4
        assert first.high == 4514.5
        assert first.low == 4514.4
        assert first.close == 4514.5
        assert first.volume == 35

        big_trades = cache.read_big_trades(_SYMBOL, _CONTRACT)
        assert [(bt.time, bt.price, bt.volume, bt.side.value) for bt in big_trades] == [
            (1_780_358_400_048, 4514.5, 35, "buy")
        ]
    finally:
        store.close()
        cache.close()


@pytest.mark.unit
def test_import_nt_export_derived_cache_writes_bars_and_delta_only(tmp_path: Path):
    last = _write(
        tmp_path / "GC 08-26.Last.txt",
        """
        20260602 000000 0480000;4514.4;4514.1;4514.4;20
        20260602 000000 0480000;4514.5;4514.2;4514.5;15
        20260602 000100 0000000;4515.0;4514.8;4515.0;2
        """,
    )

    summary = import_nt_export_derived_cache(
        last_paths=[last],
        symbol=_SYMBOL,
        contract=_CONTRACT,
        cache_db_path=tmp_path / "app.sqlite",
        export_tz=timezone.utc,
    )

    assert summary.trades == 3
    assert summary.source_contract == _CONTRACT
    assert summary.contract == _CHART_CONTRACT
    assert summary.bars >= 2
    assert summary.volume_deltas >= 2
    assert not (tmp_path / "ticks").exists()

    cache = CacheStore(tmp_path / "app.sqlite")
    try:
        for tf in ("1m", "3m", "5m", "15m", "30m", "1h", "4h", "1D"):
            assert cache.read_bars(_SYMBOL, _CHART_CONTRACT, tf)
            assert cache.read_volume_delta(_SYMBOL, _CHART_CONTRACT, tf)

        bars = cache.read_bars(_SYMBOL, _CHART_CONTRACT, "1m")
        assert [(b.time, b.open, b.high, b.low, b.close, b.volume) for b in bars] == [
            (1_780_358_400_000, 4514.4, 4514.5, 4514.4, 4514.5, 35),
            (1_780_358_460_000, 4515.0, 4515.0, 4515.0, 4515.0, 2),
        ]

        delta = cache.read_volume_delta(_SYMBOL, _CHART_CONTRACT, "1m")
        assert [(d.time, d.buy_volume, d.sell_volume, d.delta) for d in delta] == [
            (1_780_358_400_000, 35, 0, 35),
            (1_780_358_460_000, 2, 0, 2),
        ]
    finally:
        cache.close()


@pytest.mark.unit
def test_import_nt_export_derived_cache_can_clear_existing_bar_delta_range(tmp_path: Path):
    last = _write(
        tmp_path / "GC 08-26.Last.txt",
        """
        20260602 000000 0480000;4514.4;4514.1;4514.4;20
        20260602 000200 0480000;4514.8;4514.6;4514.8;5
        """,
    )
    cache = CacheStore(tmp_path / "app.sqlite")
    try:
        stale_time = 1_780_358_460_000
        cache.upsert_bar(
            BarRecord(
                symbol=_SYMBOL,
                contract=_CHART_CONTRACT,
                timeframe="1m",
                time=stale_time,
                open=1,
                high=1,
                low=1,
                close=1,
                volume=1,
                closed=True,
            )
        )
        cache.upsert_volume_delta(
            VolumeDeltaRecord(
                symbol=_SYMBOL,
                contract=_CHART_CONTRACT,
                timeframe="1m",
                time=stale_time,
                volume=1,
                buy_volume=1,
                sell_volume=0,
                delta=1,
                delta_high=1,
                delta_low=0,
                open_delta=0,
                close_delta=1,
            )
        )
    finally:
        cache.close()

    import_nt_export_derived_cache(
        last_paths=[last],
        symbol=_SYMBOL,
        contract=_CONTRACT,
        cache_db_path=tmp_path / "app.sqlite",
        export_tz=timezone.utc,
        clear_derived_range=True,
    )

    cache = CacheStore(tmp_path / "app.sqlite")
    try:
        assert [b.time for b in cache.read_bars(_SYMBOL, _CHART_CONTRACT, "1m")] == [
            1_780_358_400_000,
            1_780_358_520_000,
        ]
        assert [
            d.time for d in cache.read_volume_delta(_SYMBOL, _CHART_CONTRACT, "1m")
        ] == [1_780_358_400_000, 1_780_358_520_000]
    finally:
        cache.close()


@pytest.mark.unit
def test_import_nt_export_gap_honors_raw_from_bound(tmp_path: Path):
    last = _write(
        tmp_path / "GC 08-26.Last.txt",
        """
        20260601 000000 0480000;4514.4;4514.1;4514.4;20
        20260604 000000 0480000;4515.0;4514.8;4515.0;2
        """,
    )
    bid = _write(
        tmp_path / "GC 08-26.Bid.txt",
        """
        20260601 000000 0440000;4514.2;;;1
        20260604 000000 0440000;4514.8;;;1
        """,
    )
    ask = _write(
        tmp_path / "GC 08-26.Ask.txt",
        """
        20260601 000000 0480000;4514.6;;;2
        20260604 000000 0480000;4515.0;;;1
        """,
    )
    cutoff = parse_nt_timestamp("20260604 000000 0000000", timezone.utc)

    summary = import_nt_export_gap(
        paths=NtExportPaths(last=last, bid=bid, ask=ask),
        symbol=_SYMBOL,
        contract=_CONTRACT,
        ticks_dir=tmp_path / "ticks",
        cache_db_path=None,
        frm=cutoff,
        export_tz=timezone.utc,
        rebuild=False,
    )

    assert summary.trades == 1
    assert summary.quotes == 2
    store = TickStore(tmp_path / "ticks")
    try:
        old = list(store.read_range(_CONTRACT, cutoff - 10_000, cutoff - 1))
        recent = list(store.read_range(_CONTRACT, cutoff, cutoff + 10_000))
        old_quotes = list(store.read_quotes(_CONTRACT, cutoff - 10_000, cutoff - 1))
        recent_quotes = list(store.read_quotes(_CONTRACT, cutoff, cutoff + 10_000))
        assert old == []
        assert old_quotes == []
        assert [(t.time, t.price, t.volume) for t in recent] == [
            (1_780_531_200_048, 4515.0, 2)
        ]
        assert [(q.time, q.bid, q.ask) for q in recent_quotes] == [
            (1_780_531_200_044, 4514.8, 4514.6),
            (1_780_531_200_048, 4514.8, 4515.0),
        ]
    finally:
        store.close()


@pytest.mark.unit
def test_import_replace_range_deletes_stale_raw_rows(tmp_path: Path):
    stale_time = parse_nt_timestamp("20260602 000000 0440000", timezone.utc)
    store = TickStore(tmp_path / "ticks")
    try:
        store.record_trade(
            NormalizedTrade(
                symbol=_SYMBOL,
                contract=_CONTRACT,
                time=stale_time,
                price=1.0,
                volume=1,
                bid=None,
                ask=None,
                best_bid=None,
                best_ask=None,
                sequence=99,
            )
        )
    finally:
        store.close()

    last = _write(
        tmp_path / "GC 08-26.Last.txt",
        "20260602 000000 0440000;4514.4;4514.1;4514.4;3",
    )

    summary = import_nt_export_gap(
        paths=NtExportPaths(last=last),
        symbol=_SYMBOL,
        contract=_CONTRACT,
        ticks_dir=tmp_path / "ticks",
        cache_db_path=None,
        mode="replace-range",
        export_tz=timezone.utc,
        rebuild=False,
    )

    assert summary.deleted_trades == 1
    assert summary.raw_trades_after == 1

    store = TickStore(tmp_path / "ticks")
    try:
        raw = list(store.read_range(_CONTRACT, stale_time, stale_time))
        assert [(t.price, t.volume) for t in raw] == [(4514.4, 3)]
    finally:
        store.close()
