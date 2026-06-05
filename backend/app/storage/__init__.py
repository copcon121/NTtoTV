"""Storage: the day-sharded Tick_Store and the single Cache_Store.

Tick_Store persists raw trades/quotes to per-contract, day-sharded SQLite files
at `data/ticks/GC/<contract>/YYYY-MM-DD.sqlite` (WAL, 90-day retention).
Cache_Store stores metadata, bars, order-flow summaries, alerts, and alert
events in `data/app.sqlite` (WAL). (Requirements 7, 8)

Both stores share the WAL connection helpers and the :class:`SingleWriter`
single-writer abstraction (one writer, concurrent readers, busy_timeout retry)
defined in :mod:`app.storage.connection`.
"""

from __future__ import annotations

from .alert_store import AlertStore
from .cache_store import CACHE_TABLES, CacheStore
from .connection import DEFAULT_BUSY_TIMEOUT_MS, SingleWriter, connect, connect_reader
from .keyed_store import KeyedStore
from .profile_store import ProfileStore
from .records import (
    AlertEventRecord,
    AlertRecord,
    BarRecord,
    BigTradeRecord,
    FootprintBarRecord,
    FootprintLevelRecord,
    ProfileRecord,
    VolumeDeltaRecord,
)
from .tick_store import SYMBOL, TICK_SHARD_SCHEMA, TickStore, sanitize_contract

__all__ = [
    "CacheStore",
    "CACHE_TABLES",
    "KeyedStore",
    "AlertStore",
    "ProfileStore",
    "BarRecord",
    "VolumeDeltaRecord",
    "FootprintBarRecord",
    "FootprintLevelRecord",
    "BigTradeRecord",
    "ProfileRecord",
    "AlertRecord",
    "AlertEventRecord",
    "SingleWriter",
    "connect",
    "connect_reader",
    "DEFAULT_BUSY_TIMEOUT_MS",
    "TickStore",
    "sanitize_contract",
    "SYMBOL",
    "TICK_SHARD_SCHEMA",
]
