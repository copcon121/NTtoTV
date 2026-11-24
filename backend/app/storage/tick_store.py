"""Tick_Store: per-contract, day-sharded raw tick/quote writer.

Persists every accepted raw trade and quote to a per-contract, day-sharded
SQLite file at ``data/ticks/GC/<contract>/YYYY-MM-DD.sqlite`` where
``<contract>`` is the filesystem-sanitized originating Candidate_Contract
identifier and ``YYYY-MM-DD`` is the UTC calendar day of the event's
Canonical_Timestamp. Each shard runs in WAL mode and holds a ``ticks`` table
and a ``quotes`` table. (Requirements 7.1, 7.2, 7.3)

Day-sharding keeps each tick file bounded and makes the read-back path used by
rebuild/audit jobs a matter of scanning the shards that cover a requested time
range. (Requirement 8.5)

``shard_path`` is a deterministic, **pure** function of the contract identifier
and the UTC calendar day: it computes a path without touching the filesystem,
so it always maps the same ``(contract, day)`` to the same path (validated by
Property 11 in task 3.3). Sanitization is likewise deterministic.

Writes go through the shared :class:`~app.storage.connection.SingleWriter`
single-writer abstraction (one writer per shard database, busy_timeout +
retry), and reads use ``connect_reader`` so REST/rebuild readers run
concurrently with the ingest writer under WAL. (Requirement 7.3)

Retention is enforced by :meth:`TickStore.purge_expired`, which deletes whole
shard files (and their ``-wal``/``-shm`` sidecars) once their UTC calendar day
falls outside the configured calendar-day window. Day-sharding makes retention a cheap
whole-file delete rather than a ``DELETE`` + ``VACUUM``. (Requirements 7.4, 7.5)
"""

from __future__ import annotations

import hashlib
import logging
import threading
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Iterator

from ..config import settings
from ..models import NormalizedQuote, NormalizedTrade, Side, from_canonical_ms
from .connection import DEFAULT_BUSY_TIMEOUT_MS, SingleWriter, connect, connect_reader

__all__ = [
    "TickStore",
    "sanitize_contract",
    "trade_event_key",
    "quote_event_key",
    "SYMBOL",
    "TICK_SHARD_SCHEMA",
]

logger = logging.getLogger(__name__)

# Sidecar files SQLite creates alongside a WAL database. They are deleted with
# the shard so retention leaves no orphaned write-ahead log / shared-memory
# files behind.
_WAL_SIDECAR_SUFFIXES = ("-wal", "-shm")

# The platform charts a single user-facing symbol; the shard tree is rooted at
# ``<ticks_dir>/GC``. (Requirement 10.1; design Tick_Store path)
SYMBOL = "GC"

# Characters preserved verbatim in a sanitized contract directory name. Every
# other character (spaces, path separators, Windows-reserved characters, etc.)
# is replaced by a single underscore. This keeps ``GC 08-26`` -> ``GC_08-26``
# while remaining safe across Windows and POSIX filesystems.
_SAFE_EXTRA = frozenset("-_.")


def sanitize_contract(contract: str) -> str:
    """Map a contract identifier to a deterministic, filesystem-safe dir name.

    Pure function: alphanumeric characters and ``- _ .`` are kept; any other
    character is replaced by ``_``. For example ``"GC 08-26"`` -> ``"GC_08-26"``.
    The original identifier is preserved elsewhere (Cache_Store metadata); this
    is only the on-disk directory name. (design: Tick_Store sanitization)
    """
    return "".join(c if (c.isalnum() or c in _SAFE_EXTRA) else "_" for c in contract)


def _key_part(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, float):
        return f"{value:.10f}"
    return str(value)


def _event_key(kind: str, *parts: object) -> str:
    payload = "|".join((kind, *(_key_part(part) for part in parts)))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def trade_event_key(
    sequence: int,
    time: int,
    price: float,
    volume: int,
    bid: float | None,
    ask: float | None,
    best_bid: float | None,
    best_ask: float | None,
    time_ticks: int | None = None,
) -> str:
    """Return the stable storage key for a raw trade event.

    The stream ``sequence`` is included but is not the sole key. Playback,
    reconnects and exchange replay can reset sequence numbering; including
    timestamp and payload prevents unrelated rows from overwriting each other.
    Exact replays of the same event still collapse to one row.
    """
    return _event_key(
        "trade",
        sequence,
        time,
        price,
        volume,
        bid,
        ask,
        best_bid,
        best_ask,
        time_ticks,
    )


def _stored_trade_event_key(t: NormalizedTrade) -> str:
    legacy = trade_event_key(
        t.sequence,
        t.time,
        t.price,
        t.volume,
        t.bid,
        t.ask,
        t.best_bid,
        t.best_ask,
        t.time_ticks,
    )
    if t.source == "rithmic":
        return legacy
    return _event_key(
        "trade-source",
        t.source,
        legacy,
        t.source_time_nanos,
        t.aggressor_order_id,
        t.passive_order_id,
    )


def quote_event_key(
    sequence: int,
    time: int,
    bid: float | None,
    ask: float | None,
    bid_size: int | None,
    ask_size: int | None,
) -> str:
    """Return the stable storage key for a raw quote snapshot."""
    return _event_key("quote", sequence, time, bid, ask, bid_size, ask_size)


def _stored_quote_event_key(q: NormalizedQuote) -> str:
    legacy = quote_event_key(
        q.sequence,
        q.time,
        q.bid,
        q.ask,
        q.bid_size,
        q.ask_size,
    )
    if q.source == "rithmic":
        return legacy
    return _event_key("quote-source", q.source, legacy)


# Each day shard contains a ``ticks`` table and a ``quotes`` table. (Req 7.2)
TICK_SHARD_SCHEMA = """
CREATE TABLE IF NOT EXISTS ticks (
    event_key  TEXT    NOT NULL,
    sequence   INTEGER NOT NULL,
    time       INTEGER NOT NULL,
    price      REAL    NOT NULL,
    volume     INTEGER NOT NULL,
    bid        REAL,
    ask        REAL,
    best_bid   REAL,
    best_ask   REAL,
    time_ticks INTEGER,
    source     TEXT    NOT NULL DEFAULT 'rithmic',
    source_time_nanos INTEGER,
    bridge_time INTEGER,
    received_at INTEGER,
    side       TEXT,
    aggressor_order_id TEXT,
    passive_order_id TEXT,
    execution_start INTEGER NOT NULL DEFAULT 0,
    execution_end INTEGER NOT NULL DEFAULT 0,
    otc INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (event_key)
);
CREATE INDEX IF NOT EXISTS idx_ticks_time ON ticks(time);
CREATE INDEX IF NOT EXISTS idx_ticks_sequence ON ticks(sequence);

CREATE TABLE IF NOT EXISTS quotes (
    event_key  TEXT    NOT NULL,
    sequence   INTEGER NOT NULL,
    time       INTEGER NOT NULL,
    bid        REAL,
    ask        REAL,
    bid_size   INTEGER,
    ask_size   INTEGER,
    source     TEXT    NOT NULL DEFAULT 'rithmic',
    bridge_time INTEGER,
    received_at INTEGER,
    PRIMARY KEY (event_key)
);
CREATE INDEX IF NOT EXISTS idx_quotes_time ON quotes(time);
CREATE INDEX IF NOT EXISTS idx_quotes_sequence ON quotes(sequence);
"""

_INSERT_TRADE_SQL = (
    "INSERT INTO ticks "
    "(event_key, sequence, time, price, volume, bid, ask, best_bid, best_ask, "
    "time_ticks, source, source_time_nanos, bridge_time, received_at, side, "
    "aggressor_order_id, passive_order_id, execution_start, execution_end, otc) "
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
    "ON CONFLICT(event_key) DO UPDATE SET "
    "sequence=excluded.sequence, time=excluded.time, price=excluded.price, "
    "volume=excluded.volume, bid=excluded.bid, ask=excluded.ask, "
    "best_bid=excluded.best_bid, best_ask=excluded.best_ask, "
    "time_ticks=excluded.time_ticks, source=excluded.source, "
    "source_time_nanos=excluded.source_time_nanos, bridge_time=excluded.bridge_time, "
    "received_at=excluded.received_at, side=excluded.side, "
    "aggressor_order_id=excluded.aggressor_order_id, "
    "passive_order_id=excluded.passive_order_id, "
    "execution_start=excluded.execution_start, execution_end=excluded.execution_end, "
    "otc=excluded.otc"
)

_INSERT_QUOTE_SQL = (
    "INSERT INTO quotes "
    "(event_key, sequence, time, bid, ask, bid_size, ask_size, source, bridge_time, received_at) "
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
    "ON CONFLICT(event_key) DO UPDATE SET "
    "sequence=excluded.sequence, time=excluded.time, bid=excluded.bid, "
    "ask=excluded.ask, bid_size=excluded.bid_size, ask_size=excluded.ask_size, "
    "source=excluded.source, bridge_time=excluded.bridge_time, received_at=excluded.received_at"
)


class TickStore:
    """Day-sharded writer/reader for raw trades and quotes. (Requirement 7)

    Each ``(contract, UTC day)`` maps to its own SQLite shard database. Writers
    are created lazily per shard and cached as :class:`SingleWriter` instances
    so writes are serialized per shard and safe to call across the async
    ingestion task and any reader threads. WAL mode lets REST/rebuild readers
    query a shard concurrently with the writer. (design: Concurrency Model)
    """

    def __init__(
        self,
        ticks_dir: Path | str | None = None,
        *,
        busy_timeout_ms: int = DEFAULT_BUSY_TIMEOUT_MS,
    ) -> None:
        self._ticks_dir = Path(ticks_dir) if ticks_dir is not None else settings.ticks_dir
        self._busy_timeout_ms = busy_timeout_ms
        self._writers: dict[Path, SingleWriter] = {}
        self._lock = threading.RLock()

    # -- pure path resolution -------------------------------------------------

    def shard_path(self, contract: str, day: date) -> Path:
        """Resolve the shard path for ``contract`` on UTC calendar ``day``.

        PURE function of ``(contract, day)`` (and the store's configured ticks
        directory): performs no filesystem access. Returns
        ``<ticks_dir>/GC/<sanitized_contract>/YYYY-MM-DD.sqlite``. Days differ
        across a UTC midnight, so timestamps on opposite sides of midnight
        resolve to different shards. (Requirement 7.1; Property 11)
        """
        return (
            self._ticks_dir
            / SYMBOL
            / sanitize_contract(contract)
            / f"{day.isoformat()}.sqlite"
        )

    # -- writes ---------------------------------------------------------------

    def record_trade(self, t: NormalizedTrade) -> None:
        """Record a raw trade to the shard for its Canonical_Timestamp's UTC day.

        Creates the shard (directory + WAL database + tables) on demand. The
        ``side`` column is left ``NULL`` here; classification is performed by
        the VolumeDelta engine, not at raw-record time. (Requirements 7.1, 7.2)
        """
        day = from_canonical_ms(t.time).date()
        writer = self._writer_for(self.shard_path(t.contract, day))
        writer.execute(_INSERT_TRADE_SQL, self._trade_params(t))

    def record_trades(self, trades: list[NormalizedTrade]) -> None:
        """Record trades in shard-local batches for high-throughput capture."""
        if not trades:
            return
        batches: dict[Path, list[tuple[object, ...]]] = {}
        for trade in trades:
            day = from_canonical_ms(trade.time).date()
            path = self.shard_path(trade.contract, day)
            batches.setdefault(path, []).append(self._trade_params(trade))
        for path, rows in batches.items():
            self._writer_for(path).executemany(_INSERT_TRADE_SQL, rows)

    def record_quote(self, q: NormalizedQuote) -> None:
        """Record a raw quote to the shard for its Canonical_Timestamp's UTC day.

        Creates the shard on demand. (Requirements 7.1, 7.2)
        """
        day = from_canonical_ms(q.time).date()
        writer = self._writer_for(self.shard_path(q.contract, day))
        writer.execute(_INSERT_QUOTE_SQL, self._quote_params(q))

    def record_quotes(self, quotes: list[NormalizedQuote]) -> None:
        """Record quotes in shard-local batches for high-throughput capture."""
        if not quotes:
            return
        batches: dict[Path, list[tuple[object, ...]]] = {}
        for quote in quotes:
            day = from_canonical_ms(quote.time).date()
            path = self.shard_path(quote.contract, day)
            batches.setdefault(path, []).append(self._quote_params(quote))
        for path, rows in batches.items():
            self._writer_for(path).executemany(_INSERT_QUOTE_SQL, rows)

    @staticmethod
    def _trade_params(t: NormalizedTrade) -> tuple[object, ...]:
        return (
            _stored_trade_event_key(t),
            t.sequence,
            t.time,
            t.price,
            t.volume,
            t.bid,
            t.ask,
            t.best_bid,
            t.best_ask,
            t.time_ticks,
            t.source,
            t.source_time_nanos,
            t.bridge_time,
            t.received_at,
            None if t.side is None else t.side.value,
            t.aggressor_order_id,
            t.passive_order_id,
            int(t.execution_start),
            int(t.execution_end),
            int(t.otc),
        )

    @staticmethod
    def _quote_params(q: NormalizedQuote) -> tuple[object, ...]:
        return (
            _stored_quote_event_key(q),
            q.sequence,
            q.time,
            q.bid,
            q.ask,
            q.bid_size,
            q.ask_size,
            q.source,
            q.bridge_time,
            q.received_at,
        )

    # -- reads ----------------------------------------------------------------

    def read_range(
        self, contract: str, frm: int, to: int, *, source: str | None = "rithmic"
    ) -> Iterator[NormalizedTrade]:
        """Yield recorded trades for ``contract`` in ``[frm, to]`` (inclusive).

        Spans the day shards covering the requested Canonical_Timestamp range
        and returns trades in ascending ``(time, sequence)`` order. This is the
        rebuild/audit source path. (Requirement 8.5)

        Shards that do not exist are skipped (no empty shard is created on
        read). If ``frm > to`` the range is empty.
        """
        if frm > to:
            return

        day = from_canonical_ms(frm).date()
        end_day = from_canonical_ms(to).date()

        while day <= end_day:
            path = self.shard_path(contract, day)
            day += timedelta(days=1)
            if not path.exists():
                continue
            conn = connect_reader(path, busy_timeout_ms=self._busy_timeout_ms)
            try:
                tick_columns = self._table_columns(conn, "ticks")
                time_ticks_expr = (
                    "time_ticks"
                    if "time_ticks" in tick_columns
                    else "NULL AS time_ticks"
                )
                optional = {
                    "source": "source" if "source" in tick_columns else "'rithmic' AS source",
                    "source_time_nanos": (
                        "source_time_nanos"
                        if "source_time_nanos" in tick_columns
                        else "NULL AS source_time_nanos"
                    ),
                    "bridge_time": (
                        "bridge_time" if "bridge_time" in tick_columns else "NULL AS bridge_time"
                    ),
                    "received_at": (
                        "received_at" if "received_at" in tick_columns else "NULL AS received_at"
                    ),
                    "side": "side" if "side" in tick_columns else "NULL AS side",
                    "aggressor_order_id": (
                        "aggressor_order_id"
                        if "aggressor_order_id" in tick_columns
                        else "NULL AS aggressor_order_id"
                    ),
                    "passive_order_id": (
                        "passive_order_id"
                        if "passive_order_id" in tick_columns
                        else "NULL AS passive_order_id"
                    ),
                    "execution_start": (
                        "execution_start"
                        if "execution_start" in tick_columns
                        else "0 AS execution_start"
                    ),
                    "execution_end": (
                        "execution_end"
                        if "execution_end" in tick_columns
                        else "0 AS execution_end"
                    ),
                    "otc": "otc" if "otc" in tick_columns else "0 AS otc",
                }
                has_source = "source" in tick_columns
                if source is not None and not has_source and source != "rithmic":
                    continue
                source_clause = "" if source is None or not has_source else " AND source = ?"
                params: tuple[object, ...] = (
                    (frm, to)
                    if source is None or not has_source
                    else (frm, to, source)
                )
                rows = conn.execute(
                    "SELECT sequence, time, price, volume, bid, ask, "
                    f"best_bid, best_ask, {time_ticks_expr}, "
                    f"{', '.join(optional.values())} FROM ticks "
                    f"WHERE time BETWEEN ? AND ?{source_clause} "
                    "ORDER BY time ASC, sequence ASC, event_key ASC",
                    params,
                ).fetchall()
            finally:
                conn.close()
            for row in rows:
                yield NormalizedTrade(
                    symbol=SYMBOL,
                    contract=contract,
                    time=row["time"],
                    price=row["price"],
                    volume=row["volume"],
                    bid=row["bid"],
                    ask=row["ask"],
                    best_bid=row["best_bid"],
                    best_ask=row["best_ask"],
                    sequence=row["sequence"],
                    time_ticks=row["time_ticks"],
                    source=row["source"],
                    source_time_nanos=row["source_time_nanos"],
                    bridge_time=row["bridge_time"],
                    received_at=row["received_at"],
                    side=None if row["side"] is None else Side(row["side"]),
                    aggressor_order_id=row["aggressor_order_id"],
                    passive_order_id=row["passive_order_id"],
                    execution_start=bool(row["execution_start"]),
                    execution_end=bool(row["execution_end"]),
                    otc=bool(row["otc"]),
                )

    def read_second_ohlc(
        self,
        contract: str,
        frm: int,
        to: int,
        *,
        source: str | None = "rithmic",
    ) -> Iterator[tuple[int, float, float, float, float]]:
        """Yield exact one-second trade OHLC rows for fast engine warm-up.

        Open/close follow the raw ``(time, sequence, event_key)`` ordering while
        high/low cover every accepted trade in the second.  Aggregation happens
        inside SQLite so a 24-hour replay does not materialize every tick in
        Python memory.
        """

        if frm > to:
            return

        day = from_canonical_ms(frm).date()
        end_day = from_canonical_ms(to).date()
        while day <= end_day:
            path = self.shard_path(contract, day)
            day += timedelta(days=1)
            if not path.exists():
                continue
            conn = connect_reader(path, busy_timeout_ms=self._busy_timeout_ms)
            try:
                columns = self._table_columns(conn, "ticks")
                has_source = "source" in columns
                if source is not None and not has_source and source != "rithmic":
                    continue
                source_clause = "" if source is None or not has_source else " AND source = ?"
                params: tuple[object, ...] = (
                    (frm, to)
                    if source is None or not has_source
                    else (frm, to, source)
                )
                rows = conn.execute(
                    """
                    WITH ranked AS (
                        SELECT
                            CAST(time / 1000 AS INTEGER) * 1000 AS bucket,
                            price,
                            ROW_NUMBER() OVER (
                                PARTITION BY CAST(time / 1000 AS INTEGER)
                                ORDER BY time ASC, sequence ASC, event_key ASC
                            ) AS first_rank,
                            ROW_NUMBER() OVER (
                                PARTITION BY CAST(time / 1000 AS INTEGER)
                                ORDER BY time DESC, sequence DESC, event_key DESC
                            ) AS last_rank
                        FROM ticks
                        WHERE time BETWEEN ? AND ?
                    """
                    + source_clause
                    + """
                    )
                    SELECT
                        bucket,
                        MAX(CASE WHEN first_rank=1 THEN price END) AS open,
                        MAX(price) AS high,
                        MIN(price) AS low,
                        MAX(CASE WHEN last_rank=1 THEN price END) AS close
                    FROM ranked
                    GROUP BY bucket
                    ORDER BY bucket ASC
                    """,
                    params,
                ).fetchall()
            finally:
                conn.close()
            for row in rows:
                yield (
                    int(row["bucket"]),
                    float(row["open"]),
                    float(row["high"]),
                    float(row["low"]),
                    float(row["close"]),
                )

    def read_quotes(
        self, contract: str, frm: int, to: int, *, source: str | None = "rithmic"
    ) -> Iterator[NormalizedQuote]:
        """Yield recorded quotes for ``contract`` in ``[frm, to]`` (inclusive).

        Mirrors :meth:`read_range` for the ``quotes`` table, ascending by
        ``(time, sequence)``. Used by the rebuild path to reconstruct the
        prevailing bid/ask book for trade classification. (Req 8.5, 13.2, 13.3)
        """
        if frm > to:
            return

        day = from_canonical_ms(frm).date()
        end_day = from_canonical_ms(to).date()

        while day <= end_day:
            path = self.shard_path(contract, day)
            day += timedelta(days=1)
            if not path.exists():
                continue
            conn = connect_reader(path, busy_timeout_ms=self._busy_timeout_ms)
            try:
                columns = self._table_columns(conn, "quotes")
                has_source = "source" in columns
                if source is not None and not has_source and source != "rithmic":
                    continue
                source_expr = "source" if has_source else "'rithmic' AS source"
                bridge_expr = (
                    "bridge_time" if "bridge_time" in columns else "NULL AS bridge_time"
                )
                received_expr = (
                    "received_at" if "received_at" in columns else "NULL AS received_at"
                )
                source_clause = "" if source is None or not has_source else " AND source = ?"
                params: tuple[object, ...] = (
                    (frm, to) if source is None or not has_source else (frm, to, source)
                )
                rows = conn.execute(
                    "SELECT sequence, time, bid, ask, bid_size, ask_size, "
                    f"{source_expr}, {bridge_expr}, {received_expr} "
                    f"FROM quotes WHERE time BETWEEN ? AND ?{source_clause} "
                    "ORDER BY time ASC, sequence ASC, event_key ASC",
                    params,
                ).fetchall()
            finally:
                conn.close()
            for row in rows:
                yield NormalizedQuote(
                    symbol=SYMBOL,
                    contract=contract,
                    time=row["time"],
                    bid=row["bid"],
                    ask=row["ask"],
                    bid_size=row["bid_size"] if row["bid_size"] is not None else 0,
                    ask_size=row["ask_size"] if row["ask_size"] is not None else 0,
                    sequence=row["sequence"],
                    source=row["source"],
                    bridge_time=row["bridge_time"],
                    received_at=row["received_at"],
                )

    # -- retention ------------------------------------------------------------

    def purge_expired(
        self, now: datetime, retention_days: int = settings.tick_retention_days
    ) -> list[Path]:
        """Delete shard files outside the latest ``retention_days`` UTC days.

        Walks the ``<ticks_dir>/GC/<contract>/YYYY-MM-DD.sqlite`` tree and
        removes any shard whose UTC calendar day falls outside the most recent
        ``retention_days`` calendar days including ``now``'s UTC day. Because
        each day is its own SQLite file,
        retention is a cheap **whole-file delete** (no ``DELETE`` + ``VACUUM``)
        that also removes the ``-wal``/``-shm`` sidecars and evicts any cached
        :class:`SingleWriter` for the shard. (Requirements 7.4, 7.5)

        Semantics:

        * ``retention_days=2`` keeps exactly today and yesterday in UTC.
          Older shards are deleted. (Requirement 7.4)
        * Future-dated shards are never deleted.
        * ``retention_days`` must be at least ``1``.
        * **Idempotent**: re-running after a purge — or against an already
          deleted shard — is a no-op; missing files are ignored.
        * Each removal is logged.

        ``now`` may be naive (interpreted as UTC) or timezone-aware (converted
        to UTC). Returns the list of removed shard paths in ascending order.
        """
        if retention_days < 1:
            raise ValueError("retention_days must be >= 1")
        now_day = self._utc_date(now)
        cutoff_day = now_day - timedelta(days=retention_days - 1)

        root = self._ticks_dir / SYMBOL
        if not root.exists():
            return []

        removed: list[Path] = []
        for shard in sorted(root.glob("*/*.sqlite")):
            day = self._parse_shard_day(shard)
            if day is None:
                continue
            # Keep future shards and the configured latest calendar-day window;
            # delete only days older than the first retained day.
            if day > now_day or day >= cutoff_day:
                continue
            self._remove_shard(shard)
            removed.append(shard)
        return removed

    # -- lifecycle ------------------------------------------------------------

    def close(self) -> None:
        """Close all cached shard writer connections."""
        with self._lock:
            for writer in self._writers.values():
                writer.close()
            self._writers.clear()

    def __enter__(self) -> "TickStore":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    # -- internals ------------------------------------------------------------

    @staticmethod
    def _utc_date(moment: datetime) -> date:
        """Return the UTC calendar day of ``moment``.

        Naive datetimes are treated as already-UTC; aware datetimes are
        converted to UTC first so the day boundary is computed consistently.
        """
        if moment.tzinfo is not None:
            moment = moment.astimezone(timezone.utc)
        return moment.date()

    @staticmethod
    def _parse_shard_day(shard: Path) -> date | None:
        """Parse the ``YYYY-MM-DD`` UTC day from a shard filename, or ``None``.

        Files whose stem is not a valid ISO date are ignored, so unrelated
        files under the tree never cause a purge error.
        """
        try:
            return date.fromisoformat(shard.stem)
        except ValueError:
            return None

    def _remove_shard(self, shard: Path) -> None:
        """Delete a shard file, its WAL sidecars, and any cached writer.

        Closes and evicts a cached :class:`SingleWriter` for the shard first so
        we are not deleting a file out from under an open write connection, then
        unlinks the database and its ``-wal``/``-shm`` sidecars. Missing files
        are ignored, keeping the purge idempotent. Logs the removal.
        """
        with self._lock:
            writer = self._writers.pop(shard, None)
        if writer is not None:
            writer.close()

        for path in (shard, *self._sidecar_paths(shard)):
            try:
                path.unlink()
            except FileNotFoundError:
                # Already gone (e.g. -wal/-shm absent, or concurrent purge):
                # deleting an already-deleted shard is a no-op. (Req 7.5)
                pass

        logger.info("purged expired tick shard %s", shard)

    @staticmethod
    def _sidecar_paths(shard: Path) -> tuple[Path, ...]:
        """Return the ``-wal``/``-shm`` sidecar paths for a shard database."""
        return tuple(
            shard.with_name(shard.name + suffix)
            for suffix in _WAL_SIDECAR_SUFFIXES
        )

    def _writer_for(self, path: Path) -> SingleWriter:
        """Return a cached :class:`SingleWriter` for ``path``, creating the shard.

        Opens a WAL connection (creating the parent directory tree and shard
        database on first use), applies the ``ticks``/``quotes`` schema, and
        wraps it in a single-writer guard. (Requirement 7.3)
        """
        with self._lock:
            writer = self._writers.get(path)
            if writer is not None:
                return writer
            conn = connect(
                path,
                busy_timeout_ms=self._busy_timeout_ms,
                check_same_thread=False,
            )
            writer = SingleWriter(conn)
            writer.executescript(TICK_SHARD_SCHEMA)
            self._migrate_legacy_sequence_primary_keys(writer)
            self._migrate_tick_time_ticks(writer)
            self._migrate_tick_source_fields(writer)
            self._migrate_quote_source_fields(writer)
            self._writers[path] = writer
            return writer

    def _migrate_legacy_sequence_primary_keys(self, writer: SingleWriter) -> None:
        """Migrate pre-event-key shards whose primary key was only sequence."""

        def op(conn) -> None:
            self._migrate_legacy_ticks(conn)
            self._migrate_legacy_quotes(conn)

        writer.write(op)

    @staticmethod
    def _table_columns(conn, table: str) -> set[str]:
        return {str(row["name"]) for row in conn.execute(f"PRAGMA table_info({table})")}

    @classmethod
    def _migrate_legacy_ticks(cls, conn) -> None:
        if "event_key" in cls._table_columns(conn, "ticks"):
            return
        conn.execute("ALTER TABLE ticks RENAME TO ticks_legacy_sequence_pk")
        conn.execute(
            """
            CREATE TABLE ticks (
                event_key  TEXT    NOT NULL,
                sequence   INTEGER NOT NULL,
                time       INTEGER NOT NULL,
                price      REAL    NOT NULL,
                volume     INTEGER NOT NULL,
                bid        REAL,
                ask        REAL,
                best_bid   REAL,
                best_ask   REAL,
                time_ticks INTEGER,
                side       TEXT,
                PRIMARY KEY (event_key)
            )
            """
        )
        rows = conn.execute(
            "SELECT sequence, time, price, volume, bid, ask, best_bid, best_ask, side "
            "FROM ticks_legacy_sequence_pk ORDER BY time ASC, sequence ASC"
        ).fetchall()
        conn.executemany(
            "INSERT OR IGNORE INTO ticks "
            "(event_key, sequence, time, price, volume, bid, ask, best_bid, best_ask, time_ticks, side) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                (
                    trade_event_key(
                        row["sequence"],
                        row["time"],
                        row["price"],
                        row["volume"],
                        row["bid"],
                        row["ask"],
                        row["best_bid"],
                        row["best_ask"],
                        None,
                    ),
                    row["sequence"],
                    row["time"],
                    row["price"],
                    row["volume"],
                    row["bid"],
                    row["ask"],
                    row["best_bid"],
                    row["best_ask"],
                    None,
                    row["side"],
                )
                for row in rows
            ),
        )
        conn.execute("DROP TABLE ticks_legacy_sequence_pk")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ticks_time ON ticks(time)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ticks_sequence ON ticks(sequence)")

    def _migrate_tick_time_ticks(self, writer: SingleWriter) -> None:
        """Add optional source tick precision to existing tick shards."""

        def op(conn) -> None:
            columns = self._table_columns(conn, "ticks")
            if "time_ticks" not in columns:
                conn.execute("ALTER TABLE ticks ADD COLUMN time_ticks INTEGER")

        writer.write(op)

    def _migrate_tick_source_fields(self, writer: SingleWriter) -> None:
        columns = {
            "source": "TEXT NOT NULL DEFAULT 'rithmic'",
            "source_time_nanos": "INTEGER",
            "bridge_time": "INTEGER",
            "received_at": "INTEGER",
            "aggressor_order_id": "TEXT",
            "passive_order_id": "TEXT",
            "execution_start": "INTEGER NOT NULL DEFAULT 0",
            "execution_end": "INTEGER NOT NULL DEFAULT 0",
            "otc": "INTEGER NOT NULL DEFAULT 0",
        }

        def op(conn) -> None:
            existing = self._table_columns(conn, "ticks")
            for name, ddl in columns.items():
                if name not in existing:
                    conn.execute(f"ALTER TABLE ticks ADD COLUMN {name} {ddl}")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_ticks_source_time ON ticks(source, time)")

        writer.write(op)

    def _migrate_quote_source_fields(self, writer: SingleWriter) -> None:
        columns = {
            "source": "TEXT NOT NULL DEFAULT 'rithmic'",
            "bridge_time": "INTEGER",
            "received_at": "INTEGER",
        }

        def op(conn) -> None:
            existing = self._table_columns(conn, "quotes")
            for name, ddl in columns.items():
                if name not in existing:
                    conn.execute(f"ALTER TABLE quotes ADD COLUMN {name} {ddl}")
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_quotes_source_time ON quotes(source, time)"
            )

        writer.write(op)

    @classmethod
    def _migrate_legacy_quotes(cls, conn) -> None:
        if "event_key" in cls._table_columns(conn, "quotes"):
            return
        conn.execute("ALTER TABLE quotes RENAME TO quotes_legacy_sequence_pk")
        conn.execute(
            """
            CREATE TABLE quotes (
                event_key  TEXT    NOT NULL,
                sequence   INTEGER NOT NULL,
                time       INTEGER NOT NULL,
                bid        REAL,
                ask        REAL,
                bid_size   INTEGER,
                ask_size   INTEGER,
                PRIMARY KEY (event_key)
            )
            """
        )
        rows = conn.execute(
            "SELECT sequence, time, bid, ask, bid_size, ask_size "
            "FROM quotes_legacy_sequence_pk ORDER BY time ASC, sequence ASC"
        ).fetchall()
        conn.executemany(
            "INSERT OR IGNORE INTO quotes "
            "(event_key, sequence, time, bid, ask, bid_size, ask_size) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                (
                    quote_event_key(
                        row["sequence"],
                        row["time"],
                        row["bid"],
                        row["ask"],
                        row["bid_size"],
                        row["ask_size"],
                    ),
                    row["sequence"],
                    row["time"],
                    row["bid"],
                    row["ask"],
                    row["bid_size"],
                    row["ask_size"],
                )
                for row in rows
            ),
        )
        conn.execute("DROP TABLE quotes_legacy_sequence_pk")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_quotes_time ON quotes(time)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_quotes_sequence ON quotes(sequence)")
