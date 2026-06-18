"""SQLite store for analyst snapshots and reports."""

from __future__ import annotations

import json
from pathlib import Path

from ..models.timestamp import now_ms
from ..storage.connection import SingleWriter, connect, connect_reader
from .poi_models import PoiEvent, PoiZone
from .schemas import AnalystReport, MarketStateSnapshot

ANALYST_AUTO_SEND_ENABLED_KEY = "auto_send_enabled"
ANALYST_EVENT_AI_ENABLED_PREFIX = "event_ai_enabled"

ANALYST_SCHEMA = """
CREATE TABLE IF NOT EXISTS analyst_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS market_state_snapshots (
    id            TEXT PRIMARY KEY,
    symbol        TEXT NOT NULL,
    contract      TEXT NOT NULL,
    snapshot_time INTEGER NOT NULL,
    payload       TEXT NOT NULL,
    created_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_market_state_snapshots_latest
    ON market_state_snapshots(symbol, contract, snapshot_time);

CREATE TABLE IF NOT EXISTS llm_analyst_reports (
    id                    TEXT PRIMARY KEY,
    snapshot_id           TEXT NOT NULL,
    symbol                TEXT NOT NULL,
    contract              TEXT NOT NULL,
    created_at            INTEGER NOT NULL,
    bias                  TEXT NOT NULL,
    decision              TEXT NOT NULL,
    confidence            REAL NOT NULL,
    risk_state            TEXT NOT NULL,
    allowed_to_alert      INTEGER NOT NULL,
    allowed_to_auto_trade INTEGER NOT NULL DEFAULT 0,
    payload               TEXT NOT NULL,
    FOREIGN KEY(snapshot_id) REFERENCES market_state_snapshots(id)
);

CREATE INDEX IF NOT EXISTS idx_llm_analyst_reports_latest
    ON llm_analyst_reports(symbol, contract, created_at);

CREATE TABLE IF NOT EXISTS poi_zones (
    zone_id              TEXT PRIMARY KEY,
    symbol               TEXT NOT NULL,
    contract             TEXT NOT NULL,
    timeframe            TEXT NOT NULL,
    side                 TEXT NOT NULL,
    kind                 TEXT NOT NULL,
    top                  REAL NOT NULL,
    bottom               REAL NOT NULL,
    mid                  REAL NOT NULL,
    created_at           INTEGER NOT NULL,
    status               TEXT NOT NULL,
    pd_zone              TEXT NOT NULL,
    bias_aligned         INTEGER NOT NULL,
    distance_to_price    REAL NOT NULL,
    contains_price       INTEGER NOT NULL,
    touch_count          INTEGER NOT NULL DEFAULT 0,
    last_touched_at      INTEGER,
    last_state_change_at INTEGER,
    last_event_at        INTEGER,
    updated_at           INTEGER NOT NULL,
    payload              TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_poi_zones_symbol
    ON poi_zones(symbol, contract, status, updated_at);

CREATE TABLE IF NOT EXISTS poi_events (
    event_id              TEXT PRIMARY KEY,
    zone_id               TEXT NOT NULL,
    event_type            TEXT NOT NULL,
    symbol                TEXT NOT NULL,
    contract              TEXT NOT NULL,
    snapshot_time         INTEGER NOT NULL,
    input_snapshot_json   TEXT NOT NULL,
    provider_name         TEXT NOT NULL,
    provider_mode         TEXT NOT NULL,
    response_json         TEXT,
    decision              TEXT,
    confidence            REAL,
    allowed_to_auto_trade INTEGER NOT NULL DEFAULT 0,
    error                 TEXT,
    latency_ms            INTEGER,
    deduped               INTEGER NOT NULL DEFAULT 0,
    created_at            INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_poi_events_latest
    ON poi_events(symbol, contract, created_at);

CREATE INDEX IF NOT EXISTS idx_poi_events_dedupe
    ON poi_events(zone_id, event_type, created_at);

CREATE TABLE IF NOT EXISTS analyst_provider_errors (
    id            TEXT PRIMARY KEY,
    zone_id       TEXT,
    event_type    TEXT,
    provider_name TEXT NOT NULL,
    provider_mode TEXT NOT NULL,
    error         TEXT NOT NULL,
    created_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analyst_provider_errors_latest
    ON analyst_provider_errors(created_at);
"""


class AnalystStore:
    """Owns the isolated analyst.sqlite database."""

    def __init__(self, db_path: str | Path) -> None:
        self._db_path = Path(db_path)
        self._writer = SingleWriter(
            connect(self._db_path, check_same_thread=False)
        )
        self._writer.executescript(ANALYST_SCHEMA)

    @property
    def db_path(self) -> Path:
        return self._db_path

    def reader(self):
        return connect_reader(self._db_path)

    def get_bool_setting(self, key: str, default: bool) -> bool:
        conn = self.reader()
        try:
            row = conn.execute(
                "SELECT value FROM analyst_settings WHERE key = ?",
                (key,),
            ).fetchone()
            if row is None:
                return default
            return str(row["value"]).lower() in {"1", "true", "yes", "on"}
        finally:
            conn.close()

    def set_bool_setting(self, key: str, value: bool) -> None:
        self._writer.execute(
            """
            INSERT INTO analyst_settings (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at
            """,
            (key, "1" if value else "0", now_ms()),
        )

    def get_event_ai_enabled(
        self,
        user_id: str,
        profile_id: str,
        *,
        default: bool = False,
    ) -> bool:
        return self.get_bool_setting(
            _event_ai_setting_key(user_id, profile_id),
            default,
        )

    def set_event_ai_enabled(
        self,
        user_id: str,
        profile_id: str,
        enabled: bool,
    ) -> None:
        self.set_bool_setting(
            _event_ai_setting_key(user_id, profile_id),
            enabled,
        )

    def any_event_ai_enabled(self) -> bool:
        conn = self.reader()
        try:
            row = conn.execute(
                """
                SELECT 1 FROM analyst_settings
                WHERE key LIKE ? AND lower(value) IN ('1', 'true', 'yes', 'on')
                LIMIT 1
                """,
                (f"{ANALYST_EVENT_AI_ENABLED_PREFIX}:%",),
            ).fetchone()
            return row is not None
        finally:
            conn.close()

    def event_ai_enabled_profile_ids(self) -> list[str]:
        conn = self.reader()
        try:
            rows = conn.execute(
                """
                SELECT key FROM analyst_settings
                WHERE key LIKE ? AND lower(value) IN ('1', 'true', 'yes', 'on')
                """,
                (f"{ANALYST_EVENT_AI_ENABLED_PREFIX}:%",),
            ).fetchall()
            profile_ids: set[str] = set()
            prefix = f"{ANALYST_EVENT_AI_ENABLED_PREFIX}:"
            for row in rows:
                key = str(row["key"])
                if not key.startswith(prefix):
                    continue
                _, _, profile_id = key.removeprefix(prefix).partition(":")
                if profile_id:
                    profile_ids.add(profile_id)
            return sorted(profile_ids)
        finally:
            conn.close()

    def insert_snapshot(self, snapshot: MarketStateSnapshot) -> None:
        payload = json.dumps(snapshot.to_dict(), separators=(",", ":"))
        self._writer.execute(
            """
            INSERT INTO market_state_snapshots
                (id, symbol, contract, snapshot_time, payload, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                payload = excluded.payload,
                created_at = excluded.created_at
            """,
            (
                snapshot.snapshot_id,
                snapshot.symbol,
                snapshot.contract,
                snapshot.snapshot_time,
                payload,
                snapshot.snapshot_time,
            ),
        )

    def insert_report(self, report: AnalystReport) -> None:
        payload = json.dumps(report.to_dict(), separators=(",", ":"))
        self._writer.execute(
            """
            INSERT INTO llm_analyst_reports
                (
                    id, snapshot_id, symbol, contract, created_at, bias,
                    decision, confidence, risk_state, allowed_to_alert,
                    allowed_to_auto_trade, payload
                )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                payload = excluded.payload,
                confidence = excluded.confidence,
                risk_state = excluded.risk_state,
                allowed_to_alert = excluded.allowed_to_alert,
                allowed_to_auto_trade = excluded.allowed_to_auto_trade
            """,
            (
                report.report_id,
                report.snapshot_id,
                report.symbol,
                report.contract,
                report.created_at,
                report.bias,
                report.decision,
                report.confidence,
                report.risk_state,
                1 if report.allowed_to_alert else 0,
                0,
                payload,
            ),
        )

    def latest_report(
        self, symbol: str = "GC", contract: str = "GC"
    ) -> AnalystReport | None:
        conn = self.reader()
        try:
            row = conn.execute(
                """
                SELECT payload FROM llm_analyst_reports
                WHERE symbol = ? AND contract = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (symbol, contract),
            ).fetchone()
            if row is None:
                return None
            return AnalystReport.from_dict(json.loads(str(row["payload"])))
        finally:
            conn.close()

    def reports(
        self,
        symbol: str = "GC",
        contract: str = "GC",
        *,
        limit: int = 20,
    ) -> list[AnalystReport]:
        conn = self.reader()
        try:
            rows = conn.execute(
                """
                SELECT payload FROM llm_analyst_reports
                WHERE symbol = ? AND contract = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (symbol, contract, int(limit)),
            ).fetchall()
            return [
                AnalystReport.from_dict(json.loads(str(row["payload"])))
                for row in rows
            ]
        finally:
            conn.close()

    def upsert_poi_zone(self, zone: PoiZone) -> None:
        payload = json.dumps(zone.to_dict(), separators=(",", ":"))
        self._writer.execute(
            """
            INSERT INTO poi_zones
                (
                    zone_id, symbol, contract, timeframe, side, kind, top,
                    bottom, mid, created_at, status, pd_zone, bias_aligned,
                    distance_to_price, contains_price, touch_count,
                    last_touched_at, last_state_change_at, last_event_at,
                    updated_at, payload
                )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(zone_id) DO UPDATE SET
                status = excluded.status,
                pd_zone = excluded.pd_zone,
                bias_aligned = excluded.bias_aligned,
                distance_to_price = excluded.distance_to_price,
                contains_price = excluded.contains_price,
                touch_count = excluded.touch_count,
                last_touched_at = excluded.last_touched_at,
                last_state_change_at = excluded.last_state_change_at,
                last_event_at = excluded.last_event_at,
                updated_at = excluded.updated_at,
                payload = excluded.payload
            """,
            (
                zone.zone_id,
                zone.symbol,
                zone.contract,
                zone.timeframe,
                zone.side,
                zone.kind,
                zone.top,
                zone.bottom,
                zone.mid,
                zone.created_at,
                zone.status,
                zone.pd_zone,
                1 if zone.bias_aligned else 0,
                zone.distance_to_price,
                1 if zone.contains_price else 0,
                zone.touch_count,
                zone.last_touched_at,
                zone.last_state_change_at,
                zone.last_event_at,
                now_ms(),
                payload,
            ),
        )

    def get_poi_zone(self, zone_id: str) -> PoiZone | None:
        conn = self.reader()
        try:
            row = conn.execute(
                "SELECT payload FROM poi_zones WHERE zone_id = ?",
                (zone_id,),
            ).fetchone()
            if row is None:
                return None
            return PoiZone.from_dict(json.loads(str(row["payload"])))
        finally:
            conn.close()

    def poi_zones(
        self,
        symbol: str = "GC",
        contract: str = "GC",
    ) -> list[PoiZone]:
        conn = self.reader()
        try:
            rows = conn.execute(
                """
                SELECT payload FROM poi_zones
                WHERE symbol = ? AND contract = ?
                ORDER BY updated_at DESC
                """,
                (symbol, contract),
            ).fetchall()
            return [PoiZone.from_dict(json.loads(str(row["payload"]))) for row in rows]
        finally:
            conn.close()

    def latest_poi_event_time(self, zone_id: str, event_type: str) -> int | None:
        conn = self.reader()
        try:
            row = conn.execute(
                """
                SELECT created_at FROM poi_events
                WHERE zone_id = ? AND event_type = ?
                  AND provider_mode = 'real' AND deduped = 0
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (zone_id, event_type),
            ).fetchone()
            if row is None:
                return None
            return int(row["created_at"])
        finally:
            conn.close()

    def latest_poi_symbol_event_time(
        self,
        symbol: str,
        contract: str,
    ) -> int | None:
        conn = self.reader()
        try:
            row = conn.execute(
                """
                SELECT created_at FROM poi_events
                WHERE symbol = ? AND contract = ?
                  AND provider_mode = 'real' AND deduped = 0
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (symbol, contract),
            ).fetchone()
            if row is None:
                return None
            return int(row["created_at"])
        finally:
            conn.close()

    def insert_poi_event(self, event: PoiEvent) -> None:
        self._writer.execute(
            """
            INSERT INTO poi_events
                (
                    event_id, zone_id, event_type, symbol, contract,
                    snapshot_time, input_snapshot_json, provider_name,
                    provider_mode, response_json, decision, confidence,
                    allowed_to_auto_trade, error, latency_ms, deduped, created_at
                )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(event_id) DO NOTHING
            """,
            (
                event.event_id,
                event.zone_id,
                event.event_type,
                event.symbol,
                event.contract,
                event.snapshot_time,
                json.dumps(event.input_snapshot, separators=(",", ":")),
                event.provider_name,
                event.provider_mode,
                (
                    None
                    if event.response is None
                    else json.dumps(event.response, separators=(",", ":"))
                ),
                event.decision,
                event.confidence,
                0,
                event.error,
                event.latency_ms,
                1 if event.deduped else 0,
                event.created_at,
            ),
        )
        if event.error:
            self._writer.execute(
                """
                INSERT INTO analyst_provider_errors
                    (
                        id, zone_id, event_type, provider_name, provider_mode,
                        error, created_at
                    )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO NOTHING
                """,
                (
                    f"{event.event_id}:error",
                    event.zone_id,
                    event.event_type,
                    event.provider_name,
                    event.provider_mode,
                    event.error,
                    event.created_at,
                ),
            )

    def poi_events(
        self,
        symbol: str = "GC",
        contract: str = "GC",
        *,
        limit: int = 50,
    ) -> list[PoiEvent]:
        conn = self.reader()
        try:
            rows = conn.execute(
                """
                SELECT * FROM poi_events
                WHERE symbol = ? AND contract = ?
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (symbol, contract, int(limit)),
            ).fetchall()
            events: list[PoiEvent] = []
            for row in rows:
                raw_response = row["response_json"]
                events.append(
                    PoiEvent(
                        event_id=str(row["event_id"]),
                        zone_id=str(row["zone_id"]),
                        event_type=str(row["event_type"]),
                        symbol=str(row["symbol"]),
                        contract=str(row["contract"]),
                        snapshot_time=int(row["snapshot_time"]),
                        input_snapshot=json.loads(str(row["input_snapshot_json"])),
                        provider_name=str(row["provider_name"]),
                        provider_mode=str(row["provider_mode"]),
                        response=(
                            None
                            if raw_response is None
                            else json.loads(str(raw_response))
                        ),
                        decision=(
                            None if row["decision"] is None else str(row["decision"])
                        ),
                        confidence=(
                            None
                            if row["confidence"] is None
                            else float(row["confidence"])
                        ),
                        allowed_to_auto_trade=False,
                        error=None if row["error"] is None else str(row["error"]),
                        latency_ms=(
                            None if row["latency_ms"] is None else int(row["latency_ms"])
                        ),
                        deduped=bool(row["deduped"]),
                        created_at=int(row["created_at"]),
                    )
                )
            return events
        finally:
            conn.close()

    def close(self) -> None:
        self._writer.close()


def _event_ai_setting_key(user_id: str, profile_id: str) -> str:
    clean_user = (user_id or "unknown").replace(":", "_")
    clean_profile = (profile_id or "default").strip() or "default"
    clean_profile = clean_profile.replace(":", "_")
    return f"{ANALYST_EVENT_AI_ENABLED_PREFIX}:{clean_user}:{clean_profile}"
