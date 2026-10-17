"""Compact persistence for Bookmap liquidity signals and line lifecycles.

The store intentionally does not retain raw full-depth updates.  The Bookmap
bridge reduces those updates to threshold events plus start/update/end records
for persistent liquidity lines.  Keeping this data in a dedicated WAL database
makes the feature removable and gives it an independent 24-hour retention
policy without increasing the raw tick shards or the main chart cache.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .connection import SingleWriter, connect, connect_reader

__all__ = ["LiquidityStore"]


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
"""


class LiquidityStore:
    """Single-writer SQLite store for one-day liquidity chart data."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self._writer = SingleWriter(connect(self.path, check_same_thread=False))
        self._writer.executescript(_SCHEMA)

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
                        strength, snapshot
                    ) VALUES(
                        :symbol, :contract, :source_contract, :source_sequence,
                        :event_time, :event_kind, :action, :side, :price, :size,
                        :previous_size, :change_size, :threshold, :dom_distance,
                        :strength, :snapshot
                    )
                    """,
                    values,
                )
                return

            line_id = str(payload["lineId"])
            started_at = int(payload.get("lineStartTime") or payload["time"])
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
        finally:
            conn.close()

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
            }
            for row in line_rows
        ]
        return events, lines

    def purge_before(self, cutoff_ms: int) -> tuple[int, int]:
        """Delete expired markers and completed lines; keep still-active lines."""

        def write(conn) -> tuple[int, int]:
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

    def close(self) -> None:
        self._writer.close()
