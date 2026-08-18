"""SQLite persistence for server-side mGann automatic trading settings."""

from __future__ import annotations

import sqlite3
from collections.abc import Callable

from ..models.auto_trade import AutoTradeSettingsRecord
from .connection import SingleWriter

__all__ = ["AutoTradeStore"]


def _row_to_settings(row: sqlite3.Row) -> AutoTradeSettingsRecord:
    return AutoTradeSettingsRecord(
        user_id=str(row["user_id"]),
        long_enabled=bool(row["long_enabled"]),
        short_enabled=bool(row["short_enabled"]),
        volume_lots=float(row["volume_lots"]),
        updated_at=int(row["updated_at"]),
    )


class AutoTradeStore:
    def __init__(self, writer: SingleWriter, reader: Callable[[], sqlite3.Connection]):
        self._writer = writer
        self._reader = reader

    def read(self, user_id: str) -> AutoTradeSettingsRecord | None:
        conn = self._reader()
        try:
            row = conn.execute(
                "SELECT user_id, long_enabled, short_enabled, volume_lots, updated_at "
                "FROM auto_trade_settings WHERE user_id = ?",
                (user_id,),
            ).fetchone()
            return None if row is None else _row_to_settings(row)
        finally:
            conn.close()

    def read_enabled(self) -> list[AutoTradeSettingsRecord]:
        conn = self._reader()
        try:
            rows = conn.execute(
                "SELECT user_id, long_enabled, short_enabled, volume_lots, updated_at "
                "FROM auto_trade_settings "
                "WHERE long_enabled = 1 OR short_enabled = 1 "
                "ORDER BY updated_at, user_id"
            ).fetchall()
            return [_row_to_settings(row) for row in rows]
        finally:
            conn.close()

    def upsert(self, settings: AutoTradeSettingsRecord) -> AutoTradeSettingsRecord:
        self._writer.execute(
            "INSERT INTO auto_trade_settings "
            "(user_id, long_enabled, short_enabled, volume_lots, updated_at) "
            "VALUES (?, ?, ?, ?, ?) "
            "ON CONFLICT(user_id) DO UPDATE SET "
            "long_enabled=excluded.long_enabled, "
            "short_enabled=excluded.short_enabled, "
            "volume_lots=excluded.volume_lots, "
            "updated_at=excluded.updated_at",
            (
                settings.user_id,
                int(settings.long_enabled),
                int(settings.short_enabled),
                settings.volume_lots,
                settings.updated_at,
            ),
        )
        return settings
