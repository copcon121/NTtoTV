"""Unit tests for the Cache_Store schema and WAL connection management (task 3.1).

Covers Requirements 7.3 (WAL mode) and 8.1 (the main database stores metadata,
bars, order-flow summaries, alerts, and alert events) plus the single-writer
abstraction with busy_timeout retry.
"""

from __future__ import annotations

import sqlite3
import threading

import pytest

from app.config import Settings
from app.storage import CACHE_TABLES, CacheStore, connect, connect_reader
from app.storage.connection import SingleWriter

EXPECTED_TABLES = {
    "metadata",
    "profiles",
    "stream_gaps",
    "bars",
    "orderflow_volume_delta",
    "footprint_bars",
    "footprint_levels",
    "big_trades",
    "alerts",
    "alert_events",
}


@pytest.fixture()
def cache_store(tmp_path):
    store = CacheStore(tmp_path / "app.sqlite")
    try:
        yield store
    finally:
        store.close()


@pytest.mark.unit
def test_creates_database_file(tmp_path):
    db_path = tmp_path / "nested" / "app.sqlite"
    store = CacheStore(db_path)
    try:
        assert db_path.exists()
    finally:
        store.close()


@pytest.mark.unit
def test_all_cache_tables_created(cache_store):
    assert cache_store.table_names() >= EXPECTED_TABLES
    # The module constant agrees with the tables actually created.
    assert set(CACHE_TABLES) == EXPECTED_TABLES


@pytest.mark.unit
def test_wal_mode_enabled(cache_store):
    assert cache_store.journal_mode() == "wal"


@pytest.mark.unit
def test_open_uses_configured_path(tmp_path):
    s = Settings(data_dir=tmp_path)
    store = CacheStore.open(s)
    try:
        assert store.db_path == s.cache_db_path
        assert store.db_path.exists()
    finally:
        store.close()


@pytest.mark.unit
def test_init_is_idempotent(tmp_path):
    db_path = tmp_path / "app.sqlite"
    first = CacheStore(db_path)
    first.writer.execute(
        "INSERT INTO metadata(key, value, updated_at) VALUES (?, ?, ?)",
        ("active_contract", "GC 08-26", 1730313600000),
    )
    first.close()

    # Re-opening must not drop existing data or fail on existing tables.
    second = CacheStore(db_path)
    try:
        assert second.table_names() >= EXPECTED_TABLES
        row = second.reader().execute(
            "SELECT value FROM metadata WHERE key = ?", ("active_contract",)
        ).fetchone()
        assert row["value"] == "GC 08-26"
    finally:
        second.close()


@pytest.mark.unit
def test_bars_primary_key_is_keyed_tuple(cache_store):
    # (symbol, contract, timeframe, time) is the documented composite key (Req 8.2).
    cache_store.writer.execute(
        "INSERT INTO bars(symbol, contract, timeframe, time, open, high, low, "
        "close, volume) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ("GC", "GC 08-26", "1m", 1730313600000, 1.0, 2.0, 0.5, 1.5, 10),
    )
    with pytest.raises(sqlite3.IntegrityError):
        cache_store.writer.execute(
            "INSERT INTO bars(symbol, contract, timeframe, time, open, high, low, "
            "close, volume) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ("GC", "GC 08-26", "1m", 1730313600000, 9.0, 9.0, 9.0, 9.0, 99),
        )


@pytest.mark.unit
def test_alert_events_cascade_on_alert_delete(cache_store):
    w = cache_store.writer
    w.execute(
        "INSERT INTO alerts(id, symbol, type, params, enabled, created_at, "
        "updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ("a1", "GC", "price_crosses_level", "{}", 1, 1, 1),
    )
    w.execute(
        "INSERT INTO alert_events(alert_id, symbol, contract, time, price, "
        "message) VALUES (?, ?, ?, ?, ?, ?)",
        ("a1", "GC", "GC 08-26", 1730313600000, 2346.0, "crossed"),
    )
    w.execute("DELETE FROM alerts WHERE id = ?", ("a1",))

    conn = cache_store.reader()
    try:
        count = conn.execute("SELECT COUNT(*) FROM alert_events").fetchone()[0]
        assert count == 0
    finally:
        conn.close()


@pytest.mark.unit
def test_reader_sees_committed_writes_concurrently(cache_store):
    # WAL allows a concurrent reader to observe committed writes (Req 7.3).
    cache_store.writer.execute(
        "INSERT INTO metadata(key, value, updated_at) VALUES (?, ?, ?)",
        ("auto_resolution", "true", 1),
    )
    reader = cache_store.reader()
    try:
        row = reader.execute(
            "SELECT value FROM metadata WHERE key = ?", ("auto_resolution",)
        ).fetchone()
        assert row["value"] == "true"
    finally:
        reader.close()


# --- Single-writer abstraction -------------------------------------------------


@pytest.mark.unit
def test_busy_timeout_pragma_applied(tmp_path):
    conn = connect(tmp_path / "x.sqlite", busy_timeout_ms=1234)
    try:
        assert conn.execute("PRAGMA busy_timeout").fetchone()[0] == 1234
    finally:
        conn.close()


@pytest.mark.unit
def test_reader_connection_does_not_create_write_lock(tmp_path):
    # Establish WAL via a writer first, then a reader can attach.
    w = connect(tmp_path / "x.sqlite")
    w.execute("CREATE TABLE t(x INTEGER)")
    w.commit()
    r = connect_reader(tmp_path / "x.sqlite")
    try:
        assert r.execute("SELECT count(*) FROM t").fetchone()[0] == 0
    finally:
        r.close()
        w.close()


@pytest.mark.unit
def test_single_writer_write_callable_commits(tmp_path):
    conn = connect(tmp_path / "x.sqlite", check_same_thread=False)
    writer = SingleWriter(conn)
    writer.executescript("CREATE TABLE t(x INTEGER)")

    def insert(c):
        c.execute("INSERT INTO t(x) VALUES (1)")
        c.execute("INSERT INTO t(x) VALUES (2)")

    writer.write(insert)
    assert conn.execute("SELECT COUNT(*) FROM t").fetchone()[0] == 2
    writer.close()


@pytest.mark.unit
def test_single_writer_rolls_back_on_error(tmp_path):
    conn = connect(tmp_path / "x.sqlite", check_same_thread=False)
    writer = SingleWriter(conn)
    writer.executescript("CREATE TABLE t(x INTEGER PRIMARY KEY)")
    writer.execute("INSERT INTO t(x) VALUES (1)")

    def bad(c):
        c.execute("INSERT INTO t(x) VALUES (2)")
        c.execute("INSERT INTO t(x) VALUES (1)")  # duplicate PK -> IntegrityError

    with pytest.raises(sqlite3.IntegrityError):
        writer.write(bad)

    # The failed transaction must leave only the original row.
    assert conn.execute("SELECT COUNT(*) FROM t").fetchone()[0] == 1
    writer.close()


@pytest.mark.unit
def test_single_writer_is_thread_safe(tmp_path):
    conn = connect(tmp_path / "x.sqlite", check_same_thread=False)
    writer = SingleWriter(conn)
    writer.executescript("CREATE TABLE t(x INTEGER)")

    def worker(n):
        for i in range(50):
            writer.execute("INSERT INTO t(x) VALUES (?)", (n * 1000 + i,))

    threads = [threading.Thread(target=worker, args=(n,)) for n in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert conn.execute("SELECT COUNT(*) FROM t").fetchone()[0] == 200
    writer.close()
