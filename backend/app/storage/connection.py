"""SQLite connection helpers and the single-writer abstraction.

Both the Cache_Store (`data/app.sqlite`) and the day-sharded Tick_Store operate
in SQLite **WAL** mode so that REST read handlers can run concurrently with the
single ingestion writer (Requirement 7.3). SQLite itself permits only one
writer at a time, so writes are funneled through a :class:`SingleWriter` that:

* owns one dedicated write connection,
* guards it with a re-entrant lock so it is safe to call from multiple threads,
* sets a ``busy_timeout`` PRAGMA so SQLite blocks (rather than failing) while a
  lock is held, and
* additionally retries transient ``database is locked`` / ``database is busy``
  errors with exponential backoff as a belt-and-suspenders layer.

This module is storage-agnostic: the Cache_Store (task 3.1) uses it now, and the
Tick_Store (task 3.2) reuses the same primitives. It intentionally contains no
schema or table-specific logic.
"""

from __future__ import annotations

import sqlite3
import threading
import time
from collections.abc import Callable, Iterable, Sequence
from contextlib import contextmanager
from pathlib import Path
from typing import Any, TypeVar

__all__ = [
    "DEFAULT_BUSY_TIMEOUT_MS",
    "connect",
    "connect_reader",
    "SingleWriter",
]

# Default time (ms) SQLite will wait for a held lock before raising. Generous
# enough to absorb normal write contention between the ingest writer and
# transient readers without surfacing transient lock errors. (Req 7.3)
DEFAULT_BUSY_TIMEOUT_MS = 5000

# Application-level retry defaults, layered on top of ``busy_timeout``.
_DEFAULT_MAX_RETRIES = 5
_DEFAULT_RETRY_BASE_DELAY_S = 0.05

T = TypeVar("T")


def _apply_common_pragmas(conn: sqlite3.Connection, busy_timeout_ms: int) -> None:
    """Apply PRAGMAs shared by reader and writer connections."""
    conn.execute(f"PRAGMA busy_timeout = {int(busy_timeout_ms)}")
    # alert_events references alerts(id) ON DELETE CASCADE; enforce it per
    # connection (SQLite defaults foreign-key enforcement off).
    conn.execute("PRAGMA foreign_keys = ON")


def connect(
    path: str | Path,
    *,
    busy_timeout_ms: int = DEFAULT_BUSY_TIMEOUT_MS,
    check_same_thread: bool = True,
) -> sqlite3.Connection:
    """Open a WAL-mode SQLite connection, creating parent directories as needed.

    Enabling WAL is a database-level, persistent setting; doing it on the writer
    connection is sufficient for the whole database, but applying it here is
    idempotent and keeps each connection self-describing. ``journal_mode=WAL``
    allows concurrent readers alongside the single writer. (Requirement 7.3)

    ``check_same_thread`` is forwarded to :func:`sqlite3.connect`; the
    :class:`SingleWriter` opens its connection with ``check_same_thread=False``
    because the writer's own lock provides the cross-thread safety guarantee.
    """
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(p), check_same_thread=check_same_thread)
    conn.row_factory = sqlite3.Row
    _apply_common_pragmas(conn, busy_timeout_ms)
    conn.execute("PRAGMA journal_mode = WAL")
    # WAL pairs well with NORMAL synchronous: durable across application crashes
    # while avoiding an fsync on every commit. (Acceptable for cache/tick data.)
    conn.execute("PRAGMA synchronous = NORMAL")
    return conn


def connect_reader(
    path: str | Path,
    *,
    busy_timeout_ms: int = DEFAULT_BUSY_TIMEOUT_MS,
    check_same_thread: bool = True,
) -> sqlite3.Connection:
    """Open a read connection to an existing WAL database.

    Readers do not set ``journal_mode`` (the database is already WAL once the
    writer has initialized it), avoiding any attempt to take a write lock just
    to query. WAL permits these readers to run concurrently with the single
    writer. (Requirement 7.3)
    """
    p = Path(path)
    conn = sqlite3.connect(str(p), check_same_thread=check_same_thread)
    conn.row_factory = sqlite3.Row
    _apply_common_pragmas(conn, busy_timeout_ms)
    return conn


def _is_locked_error(exc: sqlite3.OperationalError) -> bool:
    """Return True for transient SQLite lock/busy errors worth retrying."""
    msg = str(exc).lower()
    return "locked" in msg or "busy" in msg


class SingleWriter:
    """Serialize all writes to a single SQLite connection.

    SQLite supports only one writer at a time; WAL allows concurrent readers.
    This abstraction enforces the single-writer model: one connection, one lock,
    and retry-with-backoff on transient lock contention. Callers obtain a
    :class:`SingleWriter` from the owning store (e.g. ``CacheStore.writer``) and
    never open competing write connections.

    Higher-level keyed-upsert logic (task 3.6) builds on :meth:`execute`,
    :meth:`executemany`, and :meth:`write`; this class deliberately knows nothing
    about specific tables.
    """

    def __init__(
        self,
        conn: sqlite3.Connection,
        *,
        max_retries: int = _DEFAULT_MAX_RETRIES,
        retry_base_delay_s: float = _DEFAULT_RETRY_BASE_DELAY_S,
    ) -> None:
        self._conn = conn
        self._lock = threading.RLock()
        self._max_retries = max_retries
        self._retry_base_delay_s = retry_base_delay_s

    @property
    def connection(self) -> sqlite3.Connection:
        """The underlying write connection.

        Prefer :meth:`execute` / :meth:`write`; direct access is provided for
        read-back within the writer thread and for store initialization.
        """
        return self._conn

    def _retrying(self, fn: Callable[[], T]) -> T:
        """Run ``fn`` under busy_timeout, retrying transient lock errors.

        ``fn`` must be safe to run more than once. The callers below either run
        a single statement (re-runnable) or wrap work in a transaction that is
        rolled back before the next attempt, so retries always start clean.
        """
        attempt = 0
        while True:
            try:
                return fn()
            except sqlite3.OperationalError as exc:
                if not _is_locked_error(exc) or attempt >= self._max_retries:
                    raise
                # Exponential backoff: 50ms, 100ms, 200ms, ... bounded by
                # max_retries. busy_timeout already absorbs most contention;
                # this handles the residual.
                time.sleep(self._retry_base_delay_s * (2**attempt))
                attempt += 1

    def execute(
        self, sql: str, params: Sequence[Any] = ()
    ) -> sqlite3.Cursor:
        """Execute and commit a single write statement, retrying on lock errors."""
        with self._lock:

            def op() -> sqlite3.Cursor:
                cur = self._conn.execute(sql, params)
                self._conn.commit()
                return cur

            return self._retrying(op)

    def executemany(
        self, sql: str, seq_of_params: Iterable[Sequence[Any]]
    ) -> sqlite3.Cursor:
        """Execute and commit a batched write, retrying on lock errors.

        The parameter iterable is materialized so a retry can replay it.
        """
        rows = list(seq_of_params)
        with self._lock:

            def op() -> sqlite3.Cursor:
                cur = self._conn.executemany(sql, rows)
                self._conn.commit()
                return cur

            return self._retrying(op)

    def executescript(self, script: str) -> None:
        """Execute a multi-statement script in one transaction (e.g. schema DDL)."""
        with self._lock:

            def op() -> None:
                self._conn.executescript(script)
                self._conn.commit()

            self._retrying(op)

    def write(self, fn: Callable[[sqlite3.Connection], T]) -> T:
        """Run ``fn(connection)`` inside a single transaction with retry.

        Commits on success; on a transient lock error the transaction is rolled
        back and the whole callable is retried from a clean state. Non-lock
        exceptions roll back and propagate. This is the seam upsert/range-write
        logic (task 3.6) will build on.
        """
        with self._lock:

            def op() -> T:
                try:
                    result = fn(self._conn)
                    self._conn.commit()
                    return result
                except BaseException:
                    self._conn.rollback()
                    raise

            return self._retrying(op)

    @contextmanager
    def transaction(self):
        """Context manager yielding the write connection within a transaction.

        Relies on the connection-level ``busy_timeout`` for lock waits (a partial
        transaction cannot be safely auto-retried). Commits on clean exit, rolls
        back on exception.
        """
        with self._lock:
            try:
                yield self._conn
                self._conn.commit()
            except BaseException:
                self._conn.rollback()
                raise

    def close(self) -> None:
        """Close the underlying write connection."""
        with self._lock:
            self._conn.close()
