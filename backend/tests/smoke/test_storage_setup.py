"""Smoke tests for the SQLite storage setup (task 3.8).

Verify the durable-storage foundations are wired correctly:

* A Tick_Store day shard, created on first write, holds a ``ticks`` table and a
  ``quotes`` table and runs in SQLite WAL mode. (Requirements 7.2, 7.3)
* The Cache_Store database contains all ten expected tables and runs in WAL
  mode. (Requirements 8.1, 7.3)

These guard the storage schema/configuration, not engine behavior.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from app.models import NormalizedQuote, NormalizedTrade, from_canonical_ms
from app.storage.cache_store import CACHE_TABLES, CacheStore
from app.storage.tick_store import TickStore

# A fixed Canonical_Timestamp (ms since epoch UTC): 2026-08-03T12:00:00Z.
_TS_MS = 1_754_222_400_000
_CONTRACT = "GC 08-26"


def _table_names(db_path: Path) -> set[str]:
    """Return the user table names in the SQLite database at ``db_path``."""
    conn = sqlite3.connect(str(db_path))
    try:
        rows = conn.execute(
            "SELECT name FROM sqlite_master "
            "WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).fetchall()
        return {r[0] for r in rows}
    finally:
        conn.close()


def _journal_mode(db_path: Path) -> str:
    """Return the persisted journal mode of the SQLite database at ``db_path``."""
    conn = sqlite3.connect(str(db_path))
    try:
        return str(conn.execute("PRAGMA journal_mode").fetchone()[0]).lower()
    finally:
        conn.close()


@pytest.mark.smoke
def test_tick_shard_has_ticks_and_quotes_tables_in_wal_mode(tmp_path):
    """A created tick shard holds ``ticks`` + ``quotes`` tables and is WAL.

    Recording a trade (and a quote) creates the day shard on demand; the shard
    file must expose both raw tables and operate in WAL mode. (Req 7.2, 7.3)
    """
    store = TickStore(ticks_dir=tmp_path)
    day = from_canonical_ms(_TS_MS).date()
    try:
        store.record_trade(
            NormalizedTrade(
                symbol="GC",
                contract=_CONTRACT,
                time=_TS_MS,
                price=2345.6,
                volume=3,
                bid=2345.5,
                ask=2345.7,
                best_bid=2345.5,
                best_ask=2345.7,
                sequence=1,
            )
        )
        store.record_quote(
            NormalizedQuote(
                symbol="GC",
                contract=_CONTRACT,
                time=_TS_MS,
                bid=2345.5,
                ask=2345.7,
                bid_size=12,
                ask_size=9,
                sequence=2,
            )
        )
    finally:
        store.close()

    shard = store.shard_path(_CONTRACT, day)
    assert shard.exists(), "recording a trade should create the day shard"

    tables = _table_names(shard)
    assert "ticks" in tables
    assert "quotes" in tables

    assert _journal_mode(shard) == "wal"


@pytest.mark.smoke
def test_cache_store_has_all_expected_tables_in_wal_mode(tmp_path):
    """The Cache_Store contains all ten expected tables and is WAL. (Req 8.1, 7.3)"""
    db_path = tmp_path / "app.sqlite"
    store = CacheStore(db_path)
    try:
        assert store.journal_mode() == "wal"
        assert store.table_names() >= set(CACHE_TABLES)
    finally:
        store.close()

    # Ten tables are expected per the current schema.
    assert len(CACHE_TABLES) == 10
    # Re-open independently to confirm the schema/mode persisted to disk.
    assert _table_names(db_path) >= set(CACHE_TABLES)
    assert _journal_mode(db_path) == "wal"
