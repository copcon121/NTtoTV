"""Cache_Store: the single main SQLite database at ``data/app.sqlite``.

The Cache_Store holds metadata, OHLCV bars, order-flow summaries (volume delta
and footprint), big trades, alerts, and alert events. It operates in WAL mode
and routes every write through a single-writer abstraction so REST readers can
query concurrently with the ingest writer. (Requirements 7.3, 8.1)

Bars and order-flow summaries are keyed by ``(symbol, contract, timeframe,
time)`` per Requirement 8.2; this module establishes that schema. The keyed
last-write-wins upserts and keyed range reads (task 3.6) are implemented in the
focused :mod:`app.storage.keyed_store` collaborator and surfaced here as thin
delegations on :class:`CacheStore`.
"""

from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path

from ..config import Settings, settings as default_settings
from .alert_store import AlertStore
from .connection import SingleWriter, connect, connect_reader
from .keyed_store import KeyedStore
from .order_store import OrderStore
from .profile_store import ProfileStore
from .records import (
    AlertEventRecord,
    AlertRecord,
    BarRecord,
    BigTradeRecord,
    FootprintBarRecord,
    FootprintLevelRecord,
    FvgSignalRecord,
    ProfileRecord,
    VolumeDeltaRecord,
)
from .user_store import UserStore

__all__ = ["CacheStore", "CACHE_SCHEMA", "CACHE_TABLES"]

# The ten tables the Cache_Store must contain (Requirements 8.1, 8.2, 4.4,
# 14.3/14.4, 15, 16, 17.3). Kept as a constant so smoke tests and callers can
# assert the schema without re-parsing DDL.
CACHE_TABLES: tuple[str, ...] = (
    "metadata",
    "profiles",
    "stream_gaps",
    "bars",
    "orderflow_volume_delta",
    "footprint_bars",
    "footprint_levels",
    "fvg_signals",
    "big_trades",
    "alerts",
    "alert_events",
)

# Schema DDL. Mirrors the design's Cache_Store section verbatim in structure.
# Bars and order-flow summaries use the composite primary key
# (symbol, contract, timeframe, time) so task 3.6's last-write-wins upserts have
# a natural key. (Req 8.2)
CACHE_SCHEMA = """
-- Stream + app metadata, including Active_Contract state and per-stream
-- highest-sequence bookmarks. (Req 8.1)
CREATE TABLE IF NOT EXISTS metadata (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Server-side frontend profiles. Active_Contract remains global metadata.
CREATE TABLE IF NOT EXISTS profiles (
    id         TEXT PRIMARY KEY,
    user_id    TEXT,
    name       TEXT NOT NULL,
    payload    TEXT NOT NULL,          -- JSON
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Recorded Stream_Gap detections. (Req 4.4)
CREATE TABLE IF NOT EXISTS stream_gaps (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol      TEXT NOT NULL,
    contract    TEXT NOT NULL,
    channel     TEXT NOT NULL,         -- trade | quote
    gap_from    INTEGER NOT NULL,      -- last good sequence
    gap_to      INTEGER NOT NULL,      -- received sequence
    missing     INTEGER NOT NULL,      -- gap_to - gap_from - 1
    time        INTEGER NOT NULL       -- Canonical_Timestamp of detection
);

-- OHLCV bars keyed by (symbol, contract, timeframe, time). (Req 8.2, 9.1)
CREATE TABLE IF NOT EXISTS bars (
    symbol    TEXT    NOT NULL,
    contract  TEXT    NOT NULL,
    timeframe TEXT    NOT NULL,        -- 1m,3m,5m,15m,30m,1h,4h,1D
    time      INTEGER NOT NULL,        -- bucket start, Canonical_Timestamp
    open      REAL    NOT NULL,
    high      REAL    NOT NULL,
    low       REAL    NOT NULL,
    close     REAL    NOT NULL,
    volume    INTEGER NOT NULL,
    closed    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (symbol, contract, timeframe, time)
);

-- Per-bar volume delta summary keyed by (symbol, contract, timeframe, time).
-- (Req 8.2, 13.1)
CREATE TABLE IF NOT EXISTS orderflow_volume_delta (
    symbol      TEXT NOT NULL,
    contract    TEXT NOT NULL,
    timeframe   TEXT NOT NULL,
    time        INTEGER NOT NULL,
    volume      INTEGER NOT NULL,
    buy_volume  INTEGER NOT NULL,
    sell_volume INTEGER NOT NULL,
    delta       INTEGER NOT NULL,
    delta_high  INTEGER NOT NULL,
    delta_low   INTEGER NOT NULL,
    open_delta  INTEGER NOT NULL,
    close_delta INTEGER NOT NULL,
    PRIMARY KEY (symbol, contract, timeframe, time)
);

-- Footprint bar header (M1). (Req 8.2, 14.4)
CREATE TABLE IF NOT EXISTS footprint_bars (
    symbol             TEXT NOT NULL,
    contract           TEXT NOT NULL,
    timeframe          TEXT NOT NULL DEFAULT '1m',
    time               INTEGER NOT NULL,
    poc                REAL,
    open_price         REAL,
    high_price         REAL,
    low_price          REAL,
    close_price        REAL,
    poc_volume         INTEGER NOT NULL DEFAULT 0,
    vah                REAL,
    val                REAL,
    bar_delta          INTEGER NOT NULL,
    buy_pct            REAL NOT NULL,
    sell_pct           REAL NOT NULL,
    unfinished_high    INTEGER NOT NULL DEFAULT 0,
    unfinished_low     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (symbol, contract, timeframe, time)
);

-- Footprint ladder cells: one row per price level per bar. (Req 14.3)
CREATE TABLE IF NOT EXISTS footprint_levels (
    symbol     TEXT NOT NULL,
    contract   TEXT NOT NULL,
    timeframe  TEXT NOT NULL DEFAULT '1m',
    time       INTEGER NOT NULL,       -- footprint bar time
    price      REAL NOT NULL,          -- price level (grouped per GroupTicksPerLevel)
    bid_volume INTEGER NOT NULL,       -- volume traded at bid (sell-side)
    ask_volume INTEGER NOT NULL,       -- volume traded at ask (buy-side)
    imbalance  TEXT,                   -- 'bid' | 'ask' | NULL
    PRIMARY KEY (symbol, contract, timeframe, time, price)
);

-- Confirmed FVG signal grader candle colors (M1).
CREATE TABLE IF NOT EXISTS fvg_signals (
    symbol         TEXT NOT NULL,
    contract       TEXT NOT NULL,
    timeframe      TEXT NOT NULL DEFAULT '1m',
    time           INTEGER NOT NULL,
    direction      INTEGER NOT NULL,
    level          INTEGER NOT NULL,
    pulse          INTEGER NOT NULL,
    top            REAL NOT NULL,
    bottom         REAL NOT NULL,
    breakout_ratio REAL NOT NULL,
    PRIMARY KEY (symbol, contract, timeframe, time)
);

-- Big trades (merged tape entries). (Req 8.2, 15)
CREATE TABLE IF NOT EXISTS big_trades (
    symbol    TEXT NOT NULL,
    contract  TEXT NOT NULL,
    time      INTEGER NOT NULL,        -- Canonical_Timestamp (merge key)
    price     REAL NOT NULL,
    volume    INTEGER NOT NULL,        -- merged volume
    side      TEXT NOT NULL,           -- buy | sell
    trade_id  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (symbol, contract, time, side, trade_id)
);

-- Alerts. (Req 16)
CREATE TABLE IF NOT EXISTS alerts (
    id         TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL DEFAULT 'default',
    symbol     TEXT NOT NULL,
    type       TEXT NOT NULL,
    params     TEXT NOT NULL,          -- JSON
    enabled    INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Alert events (audit log). (Req 17.3)
CREATE TABLE IF NOT EXISTS alert_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id   TEXT NOT NULL,
    profile_id TEXT NOT NULL DEFAULT 'default',
    symbol     TEXT NOT NULL,
    contract   TEXT NOT NULL,
    time       INTEGER NOT NULL,
    price      REAL,
    message    TEXT NOT NULL,
    FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
);

-- Secondary indexes for the common range/lookup access patterns.
CREATE INDEX IF NOT EXISTS idx_bars_range
    ON bars(symbol, contract, timeframe, time);
CREATE INDEX IF NOT EXISTS idx_volume_delta_range
    ON orderflow_volume_delta(symbol, contract, timeframe, time);
CREATE INDEX IF NOT EXISTS idx_big_trades_range
    ON big_trades(symbol, contract, time);
CREATE INDEX IF NOT EXISTS idx_stream_gaps_stream
    ON stream_gaps(symbol, contract, channel, time);
CREATE INDEX IF NOT EXISTS idx_alert_events_alert
    ON alert_events(alert_id, time);

-- Local users + sessions for order-on-chart auth.
CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_expires
    ON sessions(user_id, expires_at);

-- One active MT5 account config per local user for the first trading slice.
CREATE TABLE IF NOT EXISTS user_mt5_accounts (
    id                 TEXT PRIMARY KEY,
    user_id            TEXT NOT NULL UNIQUE,
    login              INTEGER NOT NULL,
    server             TEXT NOT NULL,
    symbol_broker      TEXT NOT NULL,
    password_encrypted TEXT NOT NULL,
    terminal_path      TEXT,
    trade_mode         TEXT NOT NULL DEFAULT 'demo',
    created_at         INTEGER NOT NULL,
    updated_at         INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
    id                         TEXT PRIMARY KEY,
    user_id                    TEXT NOT NULL,
    account_id                 TEXT NOT NULL,
    source                     TEXT NOT NULL,
    symbol_internal            TEXT NOT NULL,
    contract_internal          TEXT NOT NULL,
    source_contract            TEXT,
    symbol_broker              TEXT NOT NULL,
    side                       TEXT NOT NULL,
    kind                       TEXT NOT NULL,
    volume_lots                REAL NOT NULL,
    gc_anchored                INTEGER NOT NULL,
    status                     TEXT NOT NULL,
    idempotency_key            TEXT NOT NULL,
    created_at                 INTEGER NOT NULL,
    updated_at                 INTEGER NOT NULL,
    version                    INTEGER NOT NULL DEFAULT 1,
    entry_gc                   REAL,
    sl_gc                      REAL,
    tp_gc                      REAL,
    entry_broker               REAL,
    sl_broker                  REAL,
    tp_broker                  REAL,
    fill_price_broker          REAL,
    fill_price_gc_estimate     REAL,
    basis_at_submit            REAL,
    basis_at_last_sync         REAL,
    basis_at_fill              REAL,
    basis_stale_at_submit      INTEGER NOT NULL DEFAULT 0,
    broker_order_ticket        INTEGER,
    broker_position_ticket     INTEGER,
    broker_deal_ticket         INTEGER,
    reject_reason              TEXT,
    last_broker_error_code     TEXT,
    last_broker_error_message  TEXT,
    submitted_at               INTEGER,
    filled_at                  INTEGER,
    closed_at                  INTEGER,
    last_sync_at               INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_orders_user_status
    ON orders(user_id, status, updated_at);

CREATE TABLE IF NOT EXISTS order_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload    TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_order_events_order
    ON order_events(order_id, created_at);
"""


class CacheStore:
    """The main Cache_Store database (`data/app.sqlite`).

    Initializes the WAL database and schema and owns the process's single write
    connection via :attr:`writer`. REST read handlers open independent read
    connections through :meth:`reader`, relying on WAL for concurrency with the
    writer. (Requirements 7.3, 8.1)

    This class is the storage seam for later tasks: the Tick_Store (3.2),
    keyed upserts (3.6), the sequence validator's gap recording (6.2), and alert
    persistence (18.x) all go through the same single-writer abstraction.
    """

    def __init__(self, db_path: str | Path) -> None:
        self._db_path = Path(db_path)
        # The single write connection is opened with check_same_thread=False;
        # SingleWriter's lock provides the cross-thread safety guarantee.
        write_conn = connect(self._db_path, check_same_thread=False)
        self._writer = SingleWriter(write_conn)
        self._init_schema()
        # Keyed upsert/range-read collaborator (task 3.6). It shares this
        # store's single-writer seam and opens independent WAL readers for
        # concurrent range reads. (Req 8.2, 8.3)
        self._keyed = KeyedStore(self._writer, self.reader)
        # Alert CRUD + alert-event audit persistence (task 18.1). Shares the
        # same single-writer seam and WAL reader factory. (Req 16, 17.3, 18.8-11)
        self._alerts = AlertStore(self._writer, self.reader)
        self._profiles = ProfileStore(self._writer, self.reader)
        self._users = UserStore(self._writer, self.reader)
        self._orders = OrderStore(self._writer, self.reader)

    @classmethod
    def open(cls, settings: Settings | None = None) -> "CacheStore":
        """Open the Cache_Store at the configured ``data/app.sqlite`` path."""
        s = settings or default_settings
        return cls(s.cache_db_path)

    @property
    def db_path(self) -> Path:
        return self._db_path

    @property
    def writer(self) -> SingleWriter:
        """The single-writer abstraction guarding all writes."""
        return self._writer

    def _init_schema(self) -> None:
        """Create all Cache_Store tables and indexes if absent (idempotent)."""
        self._writer.executescript(CACHE_SCHEMA)
        self._migrate_footprint_bars()
        self._migrate_profiles_and_alerts()
        self._migrate_big_trades()

    def _migrate_footprint_bars(self) -> None:
        """Add v2 footprint panel/profile columns to existing cache files."""
        rows = self._writer.connection.execute("PRAGMA table_info(footprint_bars)").fetchall()
        existing = {str(r["name"]) for r in rows}
        columns: dict[str, str] = {
            "open_price": "REAL",
            "high_price": "REAL",
            "low_price": "REAL",
            "close_price": "REAL",
            "poc_volume": "INTEGER NOT NULL DEFAULT 0",
            "vah": "REAL",
            "val": "REAL",
        }
        for name, ddl in columns.items():
            if name not in existing:
                self._writer.execute(
                    f"ALTER TABLE footprint_bars ADD COLUMN {name} {ddl}"
                )

    def _migrate_profiles_and_alerts(self) -> None:
        """Add profile support columns/indexes to existing cache files."""
        rows = self._writer.connection.execute("PRAGMA table_info(profiles)").fetchall()
        existing = {str(r["name"]) for r in rows}
        if "user_id" not in existing:
            self._writer.execute("ALTER TABLE profiles ADD COLUMN user_id TEXT")
        for table in ("alerts", "alert_events"):
            rows = self._writer.connection.execute(f"PRAGMA table_info({table})").fetchall()
            existing = {str(r["name"]) for r in rows}
            if "profile_id" not in existing:
                self._writer.execute(
                    f"ALTER TABLE {table} "
                    "ADD COLUMN profile_id TEXT NOT NULL DEFAULT 'default'"
                )
        self._writer.executescript(
            """
            CREATE INDEX IF NOT EXISTS idx_profiles_user
                ON profiles(user_id, updated_at);
            CREATE INDEX IF NOT EXISTS idx_alerts_profile_symbol
                ON alerts(profile_id, symbol, created_at);
            CREATE INDEX IF NOT EXISTS idx_alert_events_profile_time
                ON alert_events(profile_id, time);
            """
        )

    def _migrate_big_trades(self) -> None:
        """Add the NT-style trade_id key to existing big-trade cache files."""
        rows = self._writer.connection.execute("PRAGMA table_info(big_trades)").fetchall()
        existing = {str(r["name"]) for r in rows}
        if "trade_id" in existing:
            return

        def op(conn):
            conn.execute("DROP INDEX IF EXISTS idx_big_trades_range")
            conn.execute("ALTER TABLE big_trades RENAME TO big_trades_old")
            conn.execute(
                """
                CREATE TABLE big_trades (
                    symbol    TEXT NOT NULL,
                    contract  TEXT NOT NULL,
                    time      INTEGER NOT NULL,
                    price     REAL NOT NULL,
                    volume    INTEGER NOT NULL,
                    side      TEXT NOT NULL,
                    trade_id  INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (symbol, contract, time, side, trade_id)
                )
                """
            )
            conn.execute(
                """
                INSERT INTO big_trades
                    (symbol, contract, time, price, volume, side, trade_id)
                SELECT symbol, contract, time, price, volume, side, 0
                FROM big_trades_old
                """
            )
            conn.execute("DROP TABLE big_trades_old")
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_big_trades_range
                    ON big_trades(symbol, contract, time)
                """
            )

        self._writer.write(op)

    def reader(self):
        """Open a new read-only-style connection for concurrent reads (WAL)."""
        return connect_reader(self._db_path)

    def table_names(self) -> set[str]:
        """Return the set of user tables present in the database."""
        conn = self.reader()
        try:
            rows = conn.execute(
                "SELECT name FROM sqlite_master "
                "WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            ).fetchall()
            return {r["name"] for r in rows}
        finally:
            conn.close()

    def journal_mode(self) -> str:
        """Return the active journal mode (expected ``wal``)."""
        row = self._writer.connection.execute("PRAGMA journal_mode").fetchone()
        return str(row[0]).lower()

    # -- metadata key/value store ---------------------------------------------
    #
    # The ``metadata`` table is the general-purpose key/value store for app and
    # stream state, including the Active_Contract state surfaced by the REST
    # contracts endpoints (Req 18.2, 18.3) and per-stream highest-sequence
    # bookmarks. These thin helpers keep callers (e.g. the REST contract-state
    # accessor) from embedding SQL.

    def get_metadata(self, key: str) -> str | None:
        """Return the stored value for ``key``, or ``None`` if absent."""
        conn = self.reader()
        try:
            row = conn.execute(
                "SELECT value FROM metadata WHERE key = ?", (key,)
            ).fetchone()
            return None if row is None else str(row["value"])
        finally:
            conn.close()

    def set_metadata(self, key: str, value: str, updated_at: int) -> None:
        """Upsert ``key`` -> ``value`` with the given Canonical_Timestamp.

        Last-write-wins on the ``key`` primary key.
        """
        self._writer.execute(
            "INSERT INTO metadata (key, value, updated_at) VALUES (?, ?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value, "
            "updated_at = excluded.updated_at",
            (key, value, updated_at),
        )

    # -- keyed upserts + range reads (task 3.6) -------------------------------
    #
    # Thin delegations to the KeyedStore collaborator. They expose last-write-
    # wins upserts keyed by (symbol, contract, timeframe, time) -- big trades by
    # (symbol, contract, time, side, trade_id) -- and keyed range reads used by
    # the history/order-flow endpoints. (Requirements 8.2, 8.3, 8.4)

    @property
    def keyed(self) -> KeyedStore:
        """The keyed upsert/range-read collaborator."""
        return self._keyed

    def upsert_derived_batch(
        self,
        *,
        bars: Iterable[BarRecord] = (),
        volume_deltas: Iterable[VolumeDeltaRecord] = (),
        footprint_bar: FootprintBarRecord | None = None,
        footprint_bars: Iterable[FootprintBarRecord] = (),
        footprint_levels: Iterable[FootprintLevelRecord] = (),
        fvg_signals: Iterable[FvgSignalRecord] = (),
        big_trades: Iterable[BigTradeRecord] = (),
    ) -> None:
        self._keyed.upsert_derived_batch(
            bars=bars,
            volume_deltas=volume_deltas,
            footprint_bar=footprint_bar,
            footprint_bars=footprint_bars,
            footprint_levels=footprint_levels,
            fvg_signals=fvg_signals,
            big_trades=big_trades,
        )

    def upsert_bar(self, bar: BarRecord) -> None:
        self._keyed.upsert_bar(bar)

    def upsert_bars(self, bars: Iterable[BarRecord]) -> None:
        self._keyed.upsert_bars(bars)

    def read_bars(
        self,
        symbol: str,
        contract: str,
        timeframe: str,
        frm: int | None = None,
        to: int | None = None,
        limit: int | None = None,
    ) -> list[BarRecord]:
        return self._keyed.read_bars(symbol, contract, timeframe, frm, to, limit)

    def upsert_volume_delta(self, rec: VolumeDeltaRecord) -> None:
        self._keyed.upsert_volume_delta(rec)

    def upsert_volume_deltas(self, recs: Iterable[VolumeDeltaRecord]) -> None:
        self._keyed.upsert_volume_deltas(recs)

    def read_volume_delta(
        self,
        symbol: str,
        contract: str,
        timeframe: str,
        frm: int | None = None,
        to: int | None = None,
        limit: int | None = None,
    ) -> list[VolumeDeltaRecord]:
        return self._keyed.read_volume_delta(
            symbol, contract, timeframe, frm, to, limit
        )

    def upsert_footprint_bar(self, rec: FootprintBarRecord) -> None:
        self._keyed.upsert_footprint_bar(rec)

    def upsert_footprint_levels(self, recs: Iterable[FootprintLevelRecord]) -> None:
        self._keyed.upsert_footprint_levels(recs)

    def read_footprint_bars(
        self,
        symbol: str,
        contract: str,
        timeframe: str = "1m",
        frm: int | None = None,
        to: int | None = None,
        limit: int | None = None,
    ) -> list[FootprintBarRecord]:
        return self._keyed.read_footprint_bars(
            symbol, contract, timeframe, frm, to, limit
        )

    def read_footprint_levels(
        self,
        symbol: str,
        contract: str,
        time: int,
        timeframe: str = "1m",
    ) -> list[FootprintLevelRecord]:
        return self._keyed.read_footprint_levels(symbol, contract, time, timeframe)

    def read_footprint_levels_range(
        self,
        symbol: str,
        contract: str,
        timeframe: str,
        frm: int,
        to: int,
    ) -> list[FootprintLevelRecord]:
        return self._keyed.read_footprint_levels_range(
            symbol, contract, timeframe, frm, to
        )

    def upsert_fvg_signal(self, rec: FvgSignalRecord) -> None:
        self._keyed.upsert_fvg_signal(rec)

    def upsert_fvg_signals(self, recs: Iterable[FvgSignalRecord]) -> None:
        self._keyed.upsert_fvg_signals(recs)

    def read_fvg_signals(
        self,
        symbol: str,
        contract: str,
        timeframe: str = "1m",
        frm: int | None = None,
        to: int | None = None,
        limit: int | None = None,
    ) -> list[FvgSignalRecord]:
        return self._keyed.read_fvg_signals(
            symbol, contract, timeframe, frm, to, limit
        )

    def upsert_big_trade(self, rec: BigTradeRecord) -> None:
        self._keyed.upsert_big_trade(rec)

    def upsert_big_trades(self, recs: Iterable[BigTradeRecord]) -> None:
        self._keyed.upsert_big_trades(recs)

    def replace_big_trades(
        self,
        symbol: str,
        contract: str,
        frm: int,
        to: int,
        recs: Iterable[BigTradeRecord],
    ) -> None:
        self._keyed.replace_big_trades(symbol, contract, frm, to, recs)

    def read_big_trades(
        self,
        symbol: str,
        contract: str,
        frm: int | None = None,
        to: int | None = None,
        limit: int | None = None,
    ) -> list[BigTradeRecord]:
        return self._keyed.read_big_trades(symbol, contract, frm, to, limit)

    # -- alert CRUD + alert-event audit (task 18.1) ---------------------------
    #
    # Thin delegations to the AlertStore collaborator. Alert definitions persist
    # to the ``alerts`` table (upsert keyed by ``id``); the alert-event audit log
    # persists to ``alert_events``. (Req 16.2, 16.3, 17.3, 18.8-18.11)

    @property
    def alerts(self) -> AlertStore:
        """The alert CRUD / alert-event persistence collaborator."""
        return self._alerts

    @property
    def profiles(self) -> ProfileStore:
        """The frontend-profile persistence collaborator."""
        return self._profiles

    @property
    def users(self) -> UserStore:
        """The local auth / MT5-account persistence collaborator."""
        return self._users

    @property
    def orders(self) -> OrderStore:
        """The order-on-chart persistence collaborator."""
        return self._orders

    def upsert_profile(self, profile: ProfileRecord) -> None:
        self._profiles.upsert_profile(profile)

    def read_profile(
        self, profile_id: str, user_id: str | None = None
    ) -> ProfileRecord | None:
        return self._profiles.read_profile(profile_id, user_id)

    def read_profiles(self, user_id: str | None = None) -> list[ProfileRecord]:
        return self._profiles.read_profiles(user_id)

    def delete_profile(self, profile_id: str, user_id: str | None = None) -> bool:
        return self._profiles.delete_profile(profile_id, user_id)

    def upsert_alert(self, alert: AlertRecord) -> None:
        self._alerts.upsert_alert(alert)

    def read_alert(
        self, alert_id: str, profile_id: str | None = None
    ) -> AlertRecord | None:
        return self._alerts.read_alert(alert_id, profile_id)

    def read_alerts(
        self, symbol: str | None = None, profile_id: str | None = "default"
    ) -> list[AlertRecord]:
        return self._alerts.read_alerts(symbol, profile_id)

    def delete_alert(self, alert_id: str, profile_id: str | None = None) -> bool:
        return self._alerts.delete_alert(alert_id, profile_id)

    def insert_alert_event(self, event: AlertEventRecord) -> int:
        return self._alerts.insert_alert_event(event)

    def read_alert_events(
        self, alert_id: str | None = None, profile_id: str | None = None
    ) -> list[AlertEventRecord]:
        return self._alerts.read_alert_events(alert_id, profile_id)

    def close(self) -> None:
        """Close the write connection."""
        self._writer.close()

    def __enter__(self) -> "CacheStore":
        return self

    def __exit__(self, *exc_info: object) -> None:
        self.close()
