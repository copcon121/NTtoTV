"""SQLite persistence for user-enabled manual SuperTrend trailing rules."""

from __future__ import annotations

import sqlite3
from collections.abc import Callable

from ..models.supertrend_trailing import SupertrendTrailingRecord
from .connection import SingleWriter

__all__ = ["SupertrendTrailingStore"]


_COLUMNS = (
    "user_id, account_id, target_type, target_id, broker_position_ticket, side, "
    "timeframe, period, multiplier, atr_method, source, created_at, updated_at, "
    "last_bar_time, last_line"
)


def _row_to_record(row: sqlite3.Row) -> SupertrendTrailingRecord:
    return SupertrendTrailingRecord(
        user_id=str(row["user_id"]),
        account_id=str(row["account_id"]),
        target_type=str(row["target_type"]),
        target_id=str(row["target_id"]),
        broker_position_ticket=int(row["broker_position_ticket"]),
        side=str(row["side"]),
        timeframe=str(row["timeframe"]),
        period=int(row["period"]),
        multiplier=float(row["multiplier"]),
        atr_method=str(row["atr_method"]),
        source=str(row["source"]),
        created_at=int(row["created_at"]),
        updated_at=int(row["updated_at"]),
        last_bar_time=(
            None if row["last_bar_time"] is None else int(row["last_bar_time"])
        ),
        last_line=None if row["last_line"] is None else float(row["last_line"]),
    )


class SupertrendTrailingStore:
    def __init__(self, writer: SingleWriter, reader: Callable[[], sqlite3.Connection]):
        self._writer = writer
        self._reader = reader

    def upsert(self, record: SupertrendTrailingRecord) -> SupertrendTrailingRecord:
        placeholders = ", ".join("?" for _ in _COLUMNS.split(", "))
        self._writer.execute(
            f"INSERT INTO supertrend_trailing ({_COLUMNS}) VALUES ({placeholders}) "
            "ON CONFLICT(user_id, target_type, target_id) DO UPDATE SET "
            "account_id = excluded.account_id, "
            "broker_position_ticket = excluded.broker_position_ticket, "
            "side = excluded.side, timeframe = excluded.timeframe, "
            "period = excluded.period, multiplier = excluded.multiplier, "
            "atr_method = excluded.atr_method, source = excluded.source, "
            "updated_at = excluded.updated_at, last_bar_time = excluded.last_bar_time, "
            "last_line = excluded.last_line",
            (
                record.user_id,
                record.account_id,
                record.target_type,
                record.target_id,
                record.broker_position_ticket,
                record.side,
                record.timeframe,
                record.period,
                record.multiplier,
                record.atr_method,
                record.source,
                record.created_at,
                record.updated_at,
                record.last_bar_time,
                record.last_line,
            ),
        )
        return record

    def read(
        self, user_id: str, target_type: str, target_id: str
    ) -> SupertrendTrailingRecord | None:
        conn = self._reader()
        try:
            row = conn.execute(
                f"SELECT {_COLUMNS} FROM supertrend_trailing "
                "WHERE user_id = ? AND target_type = ? AND target_id = ?",
                (user_id, target_type, target_id),
            ).fetchone()
            return None if row is None else _row_to_record(row)
        finally:
            conn.close()

    def list_for_user(self, user_id: str) -> list[SupertrendTrailingRecord]:
        conn = self._reader()
        try:
            rows = conn.execute(
                f"SELECT {_COLUMNS} FROM supertrend_trailing "
                "WHERE user_id = ? ORDER BY created_at, target_type, target_id",
                (user_id,),
            ).fetchall()
            return [_row_to_record(row) for row in rows]
        finally:
            conn.close()

    def list_for_timeframe(self, timeframe: str) -> list[SupertrendTrailingRecord]:
        conn = self._reader()
        try:
            rows = conn.execute(
                f"SELECT {_COLUMNS} FROM supertrend_trailing "
                "WHERE timeframe = ? ORDER BY account_id, created_at",
                (timeframe,),
            ).fetchall()
            return [_row_to_record(row) for row in rows]
        finally:
            conn.close()

    def update_progress(
        self,
        user_id: str,
        target_type: str,
        target_id: str,
        *,
        bar_time: int,
        line: float | None,
        updated_at: int,
    ) -> None:
        self._writer.execute(
            "UPDATE supertrend_trailing SET last_bar_time = ?, last_line = ?, "
            "updated_at = ? WHERE user_id = ? AND target_type = ? AND target_id = ?",
            (bar_time, line, updated_at, user_id, target_type, target_id),
        )

    def delete(self, user_id: str, target_type: str, target_id: str) -> bool:
        cur = self._writer.execute(
            "DELETE FROM supertrend_trailing "
            "WHERE user_id = ? AND target_type = ? AND target_id = ?",
            (user_id, target_type, target_id),
        )
        return cur.rowcount > 0

    def delete_for_order(self, user_id: str, order_id: str) -> bool:
        return self.delete(user_id, "order", order_id)

    def delete_for_position(self, user_id: str, ticket: int) -> bool:
        return self.delete(user_id, "position", str(int(ticket)))
