"""Per-user saved workspace persistence."""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

from .connection import SingleWriter


class WorkspaceStore:
    def __init__(self, writer: SingleWriter, reader: Callable[[], Any]) -> None:
        self._writer = writer
        self._reader = reader

    def list(self, user_id: str) -> list[dict[str, Any]]:
        conn = self._reader()
        try:
            rows = conn.execute(
                "SELECT id, name, payload, created_at, updated_at FROM workspaces "
                "WHERE user_id = ? ORDER BY updated_at DESC, id",
                (user_id,),
            ).fetchall()
            return [_from_row(row) for row in rows]
        finally:
            conn.close()

    def read(self, user_id: str, workspace_id: str) -> dict[str, Any] | None:
        conn = self._reader()
        try:
            row = conn.execute(
                "SELECT id, name, payload, created_at, updated_at FROM workspaces "
                "WHERE user_id = ? AND id = ?",
                (user_id, workspace_id),
            ).fetchone()
            return None if row is None else _from_row(row)
        finally:
            conn.close()

    def create(self, user_id: str, workspace: dict[str, Any], limit: int) -> bool:
        cursor = self._writer.execute(
            """INSERT INTO workspaces(id, user_id, name, payload, created_at, updated_at)
               SELECT ?, ?, ?, ?, ?, ?
               WHERE (SELECT COUNT(*) FROM workspaces WHERE user_id = ?) < ?
               ON CONFLICT(user_id, id) DO NOTHING""",
            (
                workspace["id"], user_id, workspace["name"],
                json.dumps(workspace["payload"], separators=(",", ":")),
                workspace["createdAt"], workspace["updatedAt"], user_id, limit,
            ),
        )
        return cursor.rowcount > 0

    def update(
        self, user_id: str, workspace_id: str, *,
        name: str | None, payload: dict[str, Any] | None, updated_at: int,
    ) -> dict[str, Any] | None:
        serialized = None if payload is None else json.dumps(payload, separators=(",", ":"))

        def write(conn):
            row = conn.execute(
                """UPDATE workspaces
                   SET name = COALESCE(?, name), payload = COALESCE(?, payload), updated_at = ?
                   WHERE user_id = ? AND id = ?
                   RETURNING id, name, payload, created_at, updated_at""",
                (name, serialized, updated_at, user_id, workspace_id),
            ).fetchone()
            return None if row is None else _from_row(row)

        return self._writer.write(write)

    def delete(self, user_id: str, workspace_id: str) -> bool:
        cursor = self._writer.execute(
            "DELETE FROM workspaces WHERE user_id = ? AND id = ?",
            (user_id, workspace_id),
        )
        return cursor.rowcount > 0


def _from_row(row) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "name": str(row["name"]),
        "payload": json.loads(row["payload"]),
        "createdAt": int(row["created_at"]),
        "updatedAt": int(row["updated_at"]),
    }

