"""Unit tests for the Tick_Store day-sharded writer (task 3.2).

Cover shard-path resolution (purity + sanitization + UTC day boundaries),
on-demand shard creation with the ``ticks``/``quotes`` tables in WAL mode, and
the record -> read_range round-trip that the rebuild path relies on.
(Requirements 7.1, 7.2, 7.3, 8.5)
"""

from __future__ import annotations

import sqlite3
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pytest

from app.models import NormalizedQuote, NormalizedTrade, from_canonical_ms, to_canonical_ms
from app.storage import TickStore, sanitize_contract
from app.storage.tick_store import SYMBOL


def _ms(year, month, day, hour=0, minute=0, second=0, micro=0) -> int:
    return to_canonical_ms(
        datetime(year, month, day, hour, minute, second, micro, tzinfo=timezone.utc)
    )


def _trade(contract: str, time_ms: int, sequence: int, price: float = 2345.6, volume: int = 3):
    return NormalizedTrade(
        symbol="GC",
        contract=contract,
        time=time_ms,
        price=price,
        volume=volume,
        bid=price - 0.1,
        ask=price + 0.1,
        best_bid=price - 0.1,
        best_ask=price + 0.1,
        sequence=sequence,
    )


def _quote(contract: str, time_ms: int, sequence: int):
    return NormalizedQuote(
        symbol="GC",
        contract=contract,
        time=time_ms,
        bid=2345.5,
        ask=2345.7,
        bid_size=12,
        ask_size=9,
        sequence=sequence,
    )


@pytest.fixture
def store(tmp_path: Path) -> TickStore:
    ts = TickStore(ticks_dir=tmp_path / "ticks")
    yield ts
    ts.close()


@pytest.mark.unit
def test_sanitize_contract_replaces_unsafe_chars():
    assert sanitize_contract("GC 08-26") == "GC_08-26"
    assert sanitize_contract("GC/08:26") == "GC_08_26"
    # Alphanumerics and - _ . are preserved.
    assert sanitize_contract("ES_12.25") == "ES_12.25"


@pytest.mark.unit
def test_shard_path_matches_documented_layout(tmp_path: Path):
    store = TickStore(ticks_dir=tmp_path / "ticks")
    p = store.shard_path("GC 08-26", date(2026, 8, 1))
    expected = tmp_path / "ticks" / "GC" / "GC_08-26" / "2026-08-01.sqlite"
    assert p == expected


@pytest.mark.unit
def test_shard_path_is_pure(tmp_path: Path):
    store = TickStore(ticks_dir=tmp_path / "ticks")
    a = store.shard_path("GC 08-26", date(2026, 8, 1))
    b = store.shard_path("GC 08-26", date(2026, 8, 1))
    # Same inputs -> identical output, with no filesystem side effects.
    assert a == b
    assert not a.exists()


@pytest.mark.unit
def test_shard_path_differs_across_utc_midnight(tmp_path: Path):
    store = TickStore(ticks_dir=tmp_path / "ticks")
    before = store.shard_path("GC 08-26", _utc_day(_ms(2026, 8, 1, 23, 59, 59, 999_000)))
    after = store.shard_path("GC 08-26", _utc_day(_ms(2026, 8, 2, 0, 0, 0, 0)))
    assert before != after


def _utc_day(ms: int) -> date:
    return from_canonical_ms(ms).date()


@pytest.mark.unit
def test_record_trade_creates_shard_with_tables_in_wal(store: TickStore):
    t = _trade("GC 08-26", _ms(2026, 8, 1, 12), sequence=1)
    store.record_trade(t)

    path = store.shard_path("GC 08-26", date(2026, 8, 1))
    assert path.exists()

    conn = sqlite3.connect(str(path))
    try:
        mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
        assert mode.lower() == "wal"

        tables = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        assert {"ticks", "quotes"} <= tables
    finally:
        conn.close()


@pytest.mark.unit
def test_record_quote_creates_shard(store: TickStore):
    q = _quote("GC 08-26", _ms(2026, 8, 1, 9), sequence=5)
    store.record_quote(q)
    path = store.shard_path("GC 08-26", date(2026, 8, 1))
    assert path.exists()

    conn = sqlite3.connect(str(path))
    try:
        rows = conn.execute(
            "SELECT sequence, time, bid, ask, bid_size, ask_size FROM quotes"
        ).fetchall()
    finally:
        conn.close()
    assert rows == [(5, q.time, 2345.5, 2345.7, 12, 9)]


@pytest.mark.unit
def test_record_and_read_range_round_trip(store: TickStore):
    contract = "GC 08-26"
    t1 = _trade(contract, _ms(2026, 8, 1, 10), sequence=1, price=2345.6, volume=2)
    t2 = _trade(contract, _ms(2026, 8, 1, 11), sequence=2, price=2346.0, volume=5)
    store.record_trade(t1)
    store.record_trade(t2)

    out = list(store.read_range(contract, _ms(2026, 8, 1, 0), _ms(2026, 8, 1, 23)))
    assert [r.sequence for r in out] == [1, 2]
    assert out[0].price == 2345.6 and out[0].volume == 2
    assert out[1].price == 2346.0 and out[1].volume == 5


@pytest.mark.unit
def test_read_range_spans_multiple_day_shards(store: TickStore):
    contract = "GC 08-26"
    d1 = _trade(contract, _ms(2026, 8, 1, 23, 59), sequence=1)
    d2 = _trade(contract, _ms(2026, 8, 2, 0, 1), sequence=2)
    d3 = _trade(contract, _ms(2026, 8, 3, 12), sequence=3)
    store.record_trade(d1)
    store.record_trade(d2)
    store.record_trade(d3)

    # Two distinct shard files were created.
    assert store.shard_path(contract, date(2026, 8, 1)).exists()
    assert store.shard_path(contract, date(2026, 8, 2)).exists()
    assert store.shard_path(contract, date(2026, 8, 3)).exists()

    out = list(store.read_range(contract, _ms(2026, 8, 1, 0), _ms(2026, 8, 3, 23)))
    assert [r.sequence for r in out] == [1, 2, 3]


@pytest.mark.unit
def test_read_range_respects_inclusive_bounds(store: TickStore):
    contract = "GC 08-26"
    early = _trade(contract, _ms(2026, 8, 1, 8), sequence=1)
    mid = _trade(contract, _ms(2026, 8, 1, 12), sequence=2)
    late = _trade(contract, _ms(2026, 8, 1, 18), sequence=3)
    for t in (early, mid, late):
        store.record_trade(t)

    out = list(store.read_range(contract, _ms(2026, 8, 1, 12), _ms(2026, 8, 1, 18)))
    assert [r.sequence for r in out] == [2, 3]


@pytest.mark.unit
def test_read_range_missing_shard_yields_nothing(store: TickStore):
    out = list(store.read_range("GC 99-99", _ms(2026, 8, 1, 0), _ms(2026, 8, 1, 23)))
    assert out == []
    # Read of an absent shard must not create the file.
    assert not store.shard_path("GC 99-99", date(2026, 8, 1)).exists()


@pytest.mark.unit
def test_read_range_empty_when_from_after_to(store: TickStore):
    contract = "GC 08-26"
    store.record_trade(_trade(contract, _ms(2026, 8, 1, 12), sequence=1))
    out = list(store.read_range(contract, _ms(2026, 8, 2, 0), _ms(2026, 8, 1, 0)))
    assert out == []


@pytest.mark.unit
def test_records_route_to_per_contract_shards(store: TickStore):
    a = _trade("GC 08-26", _ms(2026, 8, 1, 12), sequence=1)
    b = _trade("GC 10-26", _ms(2026, 8, 1, 12), sequence=1)
    store.record_trade(a)
    store.record_trade(b)

    assert store.shard_path("GC 08-26", date(2026, 8, 1)).exists()
    assert store.shard_path("GC 10-26", date(2026, 8, 1)).exists()

    only_a = list(store.read_range("GC 08-26", _ms(2026, 8, 1, 0), _ms(2026, 8, 1, 23)))
    assert [r.contract for r in only_a] == ["GC 08-26"]


# -- retention purge (task 3.4) ------------------------------------------------


def _make_shard(store: TickStore, contract: str, day: date) -> Path:
    """Create a real shard file (with tables) for ``contract`` on ``day``."""
    ms = to_canonical_ms(datetime(day.year, day.month, day.day, 12, tzinfo=timezone.utc))
    store.record_trade(_trade(contract, ms, sequence=1))
    path = store.shard_path(contract, day)
    assert path.exists()
    return path


@pytest.mark.unit
def test_purge_deletes_shards_older_than_retention(store: TickStore):
    now = datetime(2026, 8, 1, 12, tzinfo=timezone.utc)
    old = _make_shard(store, "GC 08-26", date(2026, 1, 1))  # ~212 days old
    recent = _make_shard(store, "GC 08-26", date(2026, 7, 30))  # 2 days old

    removed = store.purge_expired(now, retention_days=90)

    assert removed == [old]
    assert not old.exists()
    assert recent.exists()


@pytest.mark.unit
def test_purge_keeps_shard_exactly_at_retention_boundary(store: TickStore):
    now = datetime(2026, 8, 1, 12, tzinfo=timezone.utc)
    # Exactly 90 days before now's UTC day is kept; 91 days is deleted.
    at_boundary = _make_shard(store, "GC 08-26", date(2026, 8, 1) - timedelta(days=90))
    just_outside = _make_shard(store, "GC 08-26", date(2026, 8, 1) - timedelta(days=91))

    removed = store.purge_expired(now, retention_days=90)

    assert removed == [just_outside]
    assert at_boundary.exists()
    assert not just_outside.exists()


@pytest.mark.unit
def test_purge_never_deletes_todays_shard(store: TickStore):
    now = datetime(2026, 8, 1, 12, tzinfo=timezone.utc)
    today = _make_shard(store, "GC 08-26", date(2026, 8, 1))

    # Even with an absurdly short retention, today's shard survives.
    removed = store.purge_expired(now, retention_days=0)

    assert removed == []
    assert today.exists()


@pytest.mark.unit
def test_purge_is_idempotent(store: TickStore):
    now = datetime(2026, 8, 1, 12, tzinfo=timezone.utc)
    old = _make_shard(store, "GC 08-26", date(2026, 1, 1))

    first = store.purge_expired(now, retention_days=90)
    second = store.purge_expired(now, retention_days=90)

    assert first == [old]
    assert second == []  # nothing left to delete
    assert not old.exists()


@pytest.mark.unit
def test_purge_removes_wal_sidecars(store: TickStore):
    now = datetime(2026, 8, 1, 12, tzinfo=timezone.utc)
    old = _make_shard(store, "GC 08-26", date(2026, 1, 1))
    # The open WAL writer leaves -wal/-shm sidecars next to the shard.
    wal = old.with_name(old.name + "-wal")
    shm = old.with_name(old.name + "-shm")
    assert wal.exists() and shm.exists()

    store.purge_expired(now, retention_days=90)

    assert not old.exists()
    assert not wal.exists()
    assert not shm.exists()


@pytest.mark.unit
def test_purge_evicts_cached_writer(store: TickStore):
    now = datetime(2026, 8, 1, 12, tzinfo=timezone.utc)
    old = _make_shard(store, "GC 08-26", date(2026, 1, 1))
    # record_trade left a cached SingleWriter for the shard.
    assert old in store._writers

    store.purge_expired(now, retention_days=90)

    assert old not in store._writers
    assert not old.exists()


@pytest.mark.unit
def test_purge_accepts_naive_datetime_as_utc(store: TickStore):
    naive_now = datetime(2026, 8, 1, 12)  # no tzinfo -> treated as UTC
    old = _make_shard(store, "GC 08-26", date(2026, 1, 1))
    recent = _make_shard(store, "GC 08-26", date(2026, 7, 30))

    removed = store.purge_expired(naive_now, retention_days=90)

    assert removed == [old]
    assert recent.exists()


@pytest.mark.unit
def test_purge_no_ticks_root_is_noop(tmp_path: Path):
    store = TickStore(ticks_dir=tmp_path / "ticks")  # never written to
    try:
        assert store.purge_expired(datetime(2026, 8, 1, tzinfo=timezone.utc)) == []
    finally:
        store.close()


@pytest.mark.unit
def test_purge_ignores_non_iso_filenames(store: TickStore):
    now = datetime(2026, 8, 1, 12, tzinfo=timezone.utc)
    _make_shard(store, "GC 08-26", date(2026, 8, 1))  # ensures the tree exists
    stray = store._ticks_dir / SYMBOL / "GC_08-26" / "not-a-date.sqlite"
    stray.write_bytes(b"")

    removed = store.purge_expired(now, retention_days=90)

    assert removed == []
    assert stray.exists()  # unparseable names are left untouched
