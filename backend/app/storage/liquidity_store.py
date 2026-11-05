"""Compact persistence for depth-derived liquidity signals and line lifecycles.

The store intentionally does not retain raw full-depth updates. Bookmap reduces
them in its bridge and direct Rithmic reduces them in the backend; only threshold
events plus start/update/end records cross this boundary. Keeping this data in a
dedicated WAL database gives it an independent 24-hour retention policy without
increasing the raw tick shards or the main chart cache.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable, Mapping

from ..models.icebergs import IcebergUpdate
from ..models.si_stops import SiStopChain
from .connection import SingleWriter, connect, connect_reader

__all__ = ["LiquidityStore", "ICEBERG_RETENTION_MS"]
ICEBERG_RETENTION_MS = 48 * 60 * 60 * 1000
SI_STOP_RETENTION_MS = ICEBERG_RETENTION_MS


_SCHEMA = """
CREATE TABLE IF NOT EXISTS liquidity_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    contract TEXT NOT NULL,
    source_contract TEXT NOT NULL,
    source_sequence INTEGER NOT NULL,
    event_time INTEGER NOT NULL,
    event_kind TEXT NOT NULL,
    action TEXT NOT NULL,
    side TEXT NOT NULL,
    price REAL NOT NULL,
    size INTEGER NOT NULL,
    previous_size INTEGER NOT NULL,
    change_size INTEGER NOT NULL,
    threshold INTEGER NOT NULL,
    dom_distance INTEGER,
    strength REAL NOT NULL,
    line_id TEXT,
    line_start_time INTEGER,
    snapshot INTEGER NOT NULL DEFAULT 0,
    UNIQUE(source_contract, source_sequence, event_time)
);

CREATE INDEX IF NOT EXISTS idx_liquidity_events_range
ON liquidity_events(symbol, contract, event_time);

CREATE TABLE IF NOT EXISTS liquidity_lines (
    symbol TEXT NOT NULL,
    contract TEXT NOT NULL,
    source_contract TEXT NOT NULL,
    line_id TEXT NOT NULL,
    side TEXT NOT NULL,
    price REAL NOT NULL,
    started_at INTEGER NOT NULL,
    last_at INTEGER NOT NULL,
    ended_at INTEGER,
    current_size INTEGER NOT NULL,
    peak_size INTEGER NOT NULL,
    threshold INTEGER NOT NULL,
    dom_distance INTEGER,
    active INTEGER NOT NULL,
    PRIMARY KEY(symbol, contract, line_id)
);

CREATE INDEX IF NOT EXISTS idx_liquidity_lines_range
ON liquidity_lines(symbol, contract, started_at, ended_at);

CREATE TABLE IF NOT EXISTS liquidity_line_samples (
    symbol TEXT NOT NULL,
    contract TEXT NOT NULL,
    line_id TEXT NOT NULL,
    event_time INTEGER NOT NULL,
    size INTEGER NOT NULL,
    active INTEGER NOT NULL,
    PRIMARY KEY(symbol, contract, line_id, event_time),
    FOREIGN KEY(symbol, contract, line_id)
        REFERENCES liquidity_lines(symbol, contract, line_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_liquidity_samples_range
ON liquidity_line_samples(symbol, contract, event_time);

CREATE TABLE IF NOT EXISTS iceberg_states (
    symbol TEXT NOT NULL,
    contract TEXT NOT NULL,
    source_contract TEXT NOT NULL,
    session_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    event_time INTEGER NOT NULL,
    detected_time INTEGER NOT NULL,
    executed_volume INTEGER NOT NULL,
    source_sequence INTEGER NOT NULL,
    payload TEXT NOT NULL,
    PRIMARY KEY(symbol, contract, source_contract, session_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_iceberg_states_range
ON iceberg_states(symbol, contract, source_contract, event_time);

CREATE TABLE IF NOT EXISTS si_stop_chains (
    symbol TEXT NOT NULL,
    contract TEXT NOT NULL,
    source_contract TEXT NOT NULL,
    session_id TEXT NOT NULL,
    chain_id TEXT NOT NULL,
    event_time INTEGER NOT NULL,
    executed_volume INTEGER NOT NULL,
    source_sequence INTEGER NOT NULL,
    payload TEXT NOT NULL,
    PRIMARY KEY(symbol, contract, source_contract, session_id, chain_id)
);
CREATE INDEX IF NOT EXISTS idx_si_stop_chains_range
ON si_stop_chains(symbol, contract, source_contract, event_time);
"""


class LiquidityStore:
    """One-day liquidity signals and two-day compact iceberg lifecycles."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self._writer = SingleWriter(connect(self.path, check_same_thread=False))
        self._writer.executescript(_SCHEMA)
        self._migrate_event_line_fields()

    def _migrate_event_line_fields(self) -> None:
        """Keep long-term touch lineage in databases created before v2."""

        rows = self._writer.connection.execute(
            "PRAGMA table_info(liquidity_events)"
        ).fetchall()
        existing = {str(row["name"]) for row in rows}
        for name, ddl in {
            "line_id": "TEXT",
            "line_start_time": "INTEGER",
        }.items():
            if name not in existing:
                self._writer.execute(
                    f"ALTER TABLE liquidity_events ADD COLUMN {name} {ddl}"
                )

    def record(self, payload: dict[str, Any]) -> None:
        """Persist one validated bridge event, idempotently by source sequence."""

        event_kind = str(payload["eventKind"])
        action = str(payload["action"])
        values = {
            "symbol": str(payload["symbol"]),
            "contract": str(payload["contract"]),
            "source_contract": str(payload.get("sourceContract") or payload["contract"]),
            "source_sequence": int(payload["sequence"]),
            "event_time": int(payload["time"]),
            "event_kind": event_kind,
            "action": action,
            "side": str(payload["side"]),
            "price": float(payload["price"]),
            "size": int(payload.get("size") or 0),
            "previous_size": int(payload.get("previousSize") or 0),
            "change_size": int(payload.get("change") or 0),
            "threshold": int(payload.get("threshold") or 0),
            "dom_distance": (
                None
                if payload.get("domDistance") is None
                else int(payload["domDistance"])
            ),
            "strength": float(payload.get("strength") or 0.0),
            "line_id": (
                None if payload.get("lineId") is None else str(payload["lineId"])
            ),
            "line_start_time": (
                None
                if payload.get("lineStartTime") is None
                else int(payload["lineStartTime"])
            ),
            "snapshot": 1 if bool(payload.get("snapshot", False)) else 0,
        }

        def write(conn) -> None:
            if event_kind != "long_term":
                conn.execute(
                    """
                    INSERT OR IGNORE INTO liquidity_events(
                        symbol, contract, source_contract, source_sequence,
                        event_time, event_kind, action, side, price, size,
                        previous_size, change_size, threshold, dom_distance,
                        strength, line_id, line_start_time, snapshot
                    ) VALUES(
                        :symbol, :contract, :source_contract, :source_sequence,
                        :event_time, :event_kind, :action, :side, :price, :size,
                        :previous_size, :change_size, :threshold, :dom_distance,
                        :strength, :line_id, :line_start_time, :snapshot
                    )
                    """,
                    values,
                )
                return

            line_id = str(payload["lineId"])
            started_at = int(
                payload["lineStartTime"]
                if payload.get("lineStartTime") is not None else payload["time"]
            )
            active = 0 if action == "end" else 1
            ended_at = int(payload["time"]) if action == "end" else None
            conn.execute(
                """
                INSERT INTO liquidity_lines(
                    symbol, contract, source_contract, line_id, side, price,
                    started_at, last_at, ended_at, current_size, peak_size,
                    threshold, dom_distance, active
                ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(symbol, contract, line_id) DO UPDATE SET
                    source_contract=excluded.source_contract,
                    side=excluded.side,
                    price=excluded.price,
                    started_at=MIN(liquidity_lines.started_at, excluded.started_at),
                    last_at=MAX(liquidity_lines.last_at, excluded.last_at),
                    ended_at=excluded.ended_at,
                    current_size=excluded.current_size,
                    peak_size=MAX(liquidity_lines.peak_size, excluded.peak_size),
                    threshold=excluded.threshold,
                    dom_distance=excluded.dom_distance,
                    active=excluded.active
                WHERE excluded.last_at >= liquidity_lines.last_at
                """,
                (
                    values["symbol"],
                    values["contract"],
                    values["source_contract"],
                    line_id,
                    values["side"],
                    values["price"],
                    started_at,
                    values["event_time"],
                    ended_at,
                    values["size"],
                    max(values["size"], values["previous_size"]),
                    values["threshold"],
                    values["dom_distance"],
                    active,
                ),
            )
            # Only reduced tracker updates are retained, never raw depth. A
            # snapshot records the state at receipt, not an invented history
            # back to lineStartTime. End samples stop the previous segment.
            conn.execute(
                """
                INSERT INTO liquidity_line_samples(
                    symbol, contract, line_id, event_time, size, active
                ) VALUES(?, ?, ?, ?, ?, ?)
                ON CONFLICT(symbol, contract, line_id, event_time) DO UPDATE SET
                    size=excluded.size, active=excluded.active
                """,
                (values["symbol"], values["contract"], line_id,
                 values["event_time"], values["size"], active),
            )

        self._writer.write(write)

    def read(
        self,
        symbol: str,
        contract: str,
        start: int,
        end: int,
        *,
        limit: int = 10_000,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Read marker events and line intervals intersecting ``[start, end]``."""

        safe_limit = max(1, min(int(limit), 20_000))
        conn = connect_reader(self.path)
        try:
            conn.execute("BEGIN")
            event_rows = conn.execute(
                """
                SELECT * FROM liquidity_events
                WHERE symbol=? AND contract=? AND event_time BETWEEN ? AND ?
                ORDER BY event_time ASC, id ASC
                LIMIT ?
                """,
                (symbol, contract, int(start), int(end), safe_limit),
            ).fetchall()
            line_rows = conn.execute(
                """
                SELECT * FROM liquidity_lines
                WHERE symbol=? AND contract=?
                  AND started_at <= ?
                  AND (ended_at IS NULL OR ended_at >= ?)
                ORDER BY started_at ASC, price ASC
                LIMIT ?
                """,
                (symbol, contract, int(end), int(start), safe_limit),
            ).fetchall()
            # Bound response size; retain a carry-in sample at the left edge.
            # Missing older samples stay unknown rather than being backfilled
            # with the latest size. Readers share one SQLite snapshot.
            sample_rows = conn.execute(
                """
                SELECT s.* FROM liquidity_line_samples s
                JOIN liquidity_lines l USING(symbol, contract, line_id)
                WHERE s.symbol=? AND s.contract=? AND s.event_time<=?
                  AND l.started_at<=? AND (l.ended_at IS NULL OR l.ended_at>=?)
                  AND (s.event_time>=? OR s.event_time=(
                    SELECT MAX(p.event_time) FROM liquidity_line_samples p
                    WHERE p.symbol=s.symbol AND p.contract=s.contract
                      AND p.line_id=s.line_id AND p.event_time<?
                  ))
                ORDER BY s.event_time DESC, s.line_id
                LIMIT 100000
                """,
                (symbol, contract, int(end), int(end), int(start), int(start), int(start)),
            ).fetchall()
        finally:
            conn.close()

        samples: dict[str, list[dict[str, Any]]] = {}
        for row in reversed(sample_rows):
            samples.setdefault(str(row["line_id"]), []).append({
                "time": int(row["event_time"]),
                "size": int(row["size"]),
                "active": bool(row["active"]),
            })

        events = [
            {
                "sequence": int(row["source_sequence"]),
                "time": int(row["event_time"]),
                "eventKind": str(row["event_kind"]),
                "action": str(row["action"]),
                "side": str(row["side"]),
                "price": float(row["price"]),
                "size": int(row["size"]),
                "previousSize": int(row["previous_size"]),
                "change": int(row["change_size"]),
                "threshold": int(row["threshold"]),
                "domDistance": (
                    None if row["dom_distance"] is None else int(row["dom_distance"])
                ),
                "strength": float(row["strength"]),
                "lineId": None if row["line_id"] is None else str(row["line_id"]),
                "lineStartTime": (
                    None
                    if row["line_start_time"] is None
                    else int(row["line_start_time"])
                ),
            }
            for row in event_rows
        ]
        lines = [
            {
                "lineId": str(row["line_id"]),
                "side": str(row["side"]),
                "price": float(row["price"]),
                "startedAt": int(row["started_at"]),
                "lastAt": int(row["last_at"]),
                "endedAt": None if row["ended_at"] is None else int(row["ended_at"]),
                "currentSize": int(row["current_size"]),
                "peakSize": int(row["peak_size"]),
                "threshold": int(row["threshold"]),
                "domDistance": (
                    None if row["dom_distance"] is None else int(row["dom_distance"])
                ),
                "active": bool(row["active"]),
                "samples": samples.get(str(row["line_id"]), []),
            }
            for row in line_rows
        ]
        return events, lines

    def record_icebergs(self, payloads: Iterable[dict[str, Any]]) -> None:
        """Keep the latest compact state per exchange order and feed session."""
        updates = [IcebergUpdate.from_dict(payload) for payload in payloads]

        def write(conn) -> None:
            conn.executemany(
                """
                INSERT INTO iceberg_states(
                    symbol, contract, source_contract, session_id, order_id,
                    event_time, detected_time, executed_volume, source_sequence, payload
                ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(symbol, contract, source_contract, session_id, order_id)
                DO UPDATE SET event_time=excluded.event_time,
                    detected_time=excluded.detected_time,
                    executed_volume=excluded.executed_volume,
                    source_sequence=excluded.source_sequence, payload=excluded.payload
                WHERE excluded.source_sequence > iceberg_states.source_sequence
                """,
                [(row.symbol, row.contract, row.source_contract, row.session_id, row.order_id,
                  row.time, row.detected_time, row.executed_volume, row.sequence,
                  json.dumps(row.to_dict(), separators=(",", ":"))) for row in updates],
            )

        if updates:
            self._writer.write(write)

    def read_icebergs(
        self, symbol: str, contract: str, source_contract: str, start: int, end: int,
        *, limit: int = 5000, min_volume: int = 1,
    ) -> list[dict[str, Any]]:
        """Read retained order lifecycles intersecting the requested time range."""
        conn = connect_reader(self.path)
        try:
            rows = conn.execute(
                """
                SELECT payload FROM iceberg_states
                WHERE symbol=? AND contract=? AND source_contract=?
                  AND event_time>=? AND detected_time<=? AND executed_volume>=?
                ORDER BY event_time DESC, source_sequence DESC, session_id DESC, order_id DESC
                LIMIT ?
                """,
                (symbol, contract, source_contract, int(start), int(end), int(min_volume),
                 max(1, min(int(limit), 5000))),
            ).fetchall()
            return [json.loads(row["payload"]) for row in reversed(rows)]
        finally:
            conn.close()

    def purge_icebergs_before(self, cutoff_ms: int) -> int:
        return int(self._writer.execute(
            "DELETE FROM iceberg_states WHERE event_time < ?", (int(cutoff_ms),)
        ).rowcount)

    def record_si_stops(self, payloads: Iterable[dict[str, Any]]) -> None:
        rows = [SiStopChain.from_dict(payload) for payload in payloads]
        if not rows:
            return

        def write(conn) -> None:
            conn.executemany(
                """INSERT OR IGNORE INTO si_stop_chains(
                    symbol, contract, source_contract, session_id, chain_id,
                    event_time, executed_volume, source_sequence, payload
                ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                [(r.symbol, r.contract, r.source_contract, r.session_id, r.chain_id,
                  r.time, r.executed_volume, r.sequence,
                  json.dumps(r.to_dict(), separators=(",", ":"))) for r in rows],
            )

        self._writer.write(write)

    def read_si_stops(self, symbol: str, contract: str, source_contract: str,
                      start: int, end: int, *, limit: int = 5000,
                      min_volume: int = 1) -> list[dict[str, Any]]:
        conn = connect_reader(self.path)
        try:
            rows = conn.execute(
                """SELECT payload FROM si_stop_chains
                WHERE symbol=? AND contract=? AND source_contract=?
                  AND event_time BETWEEN ? AND ? AND executed_volume>=?
                ORDER BY event_time DESC, source_sequence DESC, chain_id DESC LIMIT ?""",
                (symbol, contract, source_contract, int(start), int(end), int(min_volume),
                 max(1, min(int(limit), 5000))),
            ).fetchall()
            return [json.loads(row["payload"]) for row in reversed(rows)]
        finally:
            conn.close()

    def purge_si_stops_before(self, cutoff_ms: int) -> int:
        return int(self._writer.execute(
            "DELETE FROM si_stop_chains WHERE event_time < ?", (int(cutoff_ms),)
        ).rowcount)

    def purge_before(self, cutoff_ms: int) -> tuple[int, int]:
        """Delete expired markers and completed lines; keep still-active lines."""

        def write(conn) -> tuple[int, int]:
            # One anchor per surviving line carries its size into the retained
            # window, even if the book has stayed unchanged for a long time.
            conn.execute(
                """
                DELETE FROM liquidity_line_samples
                WHERE event_time<? AND event_time<(
                    SELECT MAX(p.event_time) FROM liquidity_line_samples p
                    WHERE p.symbol=liquidity_line_samples.symbol
                      AND p.contract=liquidity_line_samples.contract
                      AND p.line_id=liquidity_line_samples.line_id
                      AND p.event_time<?
                )
                """,
                (int(cutoff_ms), int(cutoff_ms)),
            )
            events = conn.execute(
                "DELETE FROM liquidity_events WHERE event_time < ?", (int(cutoff_ms),)
            ).rowcount
            lines = conn.execute(
                """
                DELETE FROM liquidity_lines
                WHERE active=0 AND ended_at IS NOT NULL AND ended_at < ?
                """,
                (int(cutoff_ms),),
            ).rowcount
            return int(events), int(lines)

        return self._writer.write(write)

    def clear_history(self, event_kinds: Iterable[str]) -> tuple[int, int]:
        """Delete history produced by detector groups whose settings changed."""

        kinds = set(event_kinds)
        unknown = kinds.difference({"relative", "absolute", "long_term"})
        if unknown:
            raise ValueError(f"Unknown liquidity event kinds: {sorted(unknown)!r}")
        marker_kinds = sorted(kinds.intersection({"relative", "absolute"}))
        clear_lines = "long_term" in kinds
        if clear_lines:
            marker_kinds.append("long_term_touch")
        if not marker_kinds and not clear_lines:
            return 0, 0

        def write(conn) -> tuple[int, int]:
            deleted_events = 0
            if marker_kinds:
                placeholders = ",".join("?" for _ in marker_kinds)
                deleted_events = conn.execute(
                    f"DELETE FROM liquidity_events WHERE event_kind IN ({placeholders})",
                    marker_kinds,
                ).rowcount
            if clear_lines and "relative" not in kinds:
                deleted_events += conn.execute(
                    """
                    DELETE FROM liquidity_events
                    WHERE event_kind='relative' AND line_id IS NOT NULL
                    """
                ).rowcount
            deleted_lines = 0
            if clear_lines:
                deleted_lines = conn.execute("DELETE FROM liquidity_lines").rowcount
            return int(deleted_events), int(deleted_lines)

        return self._writer.write(write)

    def prune_to_settings(
        self,
        settings: Mapping[str, bool | int],
    ) -> tuple[int, int]:
        """Remove legacy rows that could not have been emitted by current settings."""

        def write(conn) -> tuple[int, int]:
            deleted_events = 0
            for kind, prefix in (("relative", "relative"), ("absolute", "absolute")):
                if not bool(settings[f"{prefix}Enabled"]):
                    deleted_events += conn.execute(
                        "DELETE FROM liquidity_events WHERE event_kind=?",
                        (kind,),
                    ).rowcount
                    continue
                deleted_events += conn.execute(
                    """
                    DELETE FROM liquidity_events
                    WHERE event_kind=?
                      AND line_id IS NULL
                      AND (
                        threshold<>?
                        OR dom_distance IS NULL
                        OR dom_distance<?
                        OR dom_distance>?
                      )
                    """,
                    (
                        kind,
                        int(settings[f"{prefix}Trigger"]),
                        int(settings[f"{prefix}DomFrom"]),
                        int(settings[f"{prefix}DomTo"]),
                    ),
                ).rowcount

            if bool(settings["longTermEnabled"]):
                deleted_events += conn.execute(
                    """
                    DELETE FROM liquidity_events
                    WHERE event_kind='long_term_touch' AND threshold<>?
                    """,
                    (int(settings["longTermTrigger"]),),
                ).rowcount
                if bool(settings["relativeEnabled"]):
                    deleted_events += conn.execute(
                        """
                        DELETE FROM liquidity_events
                        WHERE event_kind='relative'
                          AND line_id IS NOT NULL
                          AND threshold<>?
                        """,
                        (int(settings["longTermTrigger"]),),
                    ).rowcount
                deleted_lines = conn.execute(
                    "DELETE FROM liquidity_lines WHERE threshold<>?",
                    (int(settings["longTermTrigger"]),),
                ).rowcount
            else:
                deleted_events += conn.execute(
                    "DELETE FROM liquidity_events WHERE event_kind='long_term_touch'"
                ).rowcount
                deleted_events += conn.execute(
                    """
                    DELETE FROM liquidity_events
                    WHERE event_kind='relative' AND line_id IS NOT NULL
                    """
                ).rowcount
                deleted_lines = conn.execute("DELETE FROM liquidity_lines").rowcount
            return int(deleted_events), int(deleted_lines)

        return self._writer.write(write)

    def close(self) -> None:
        self._writer.close()
