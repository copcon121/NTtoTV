"""Server-side frontend profile persistence.

Profiles are keyed by a caller-provided ``profile_id`` and store the frontend's
chart/indicator/drawing payload as JSON. The active contract remains global and
is intentionally not part of a profile payload.
"""

from __future__ import annotations

import json
from collections.abc import Callable

from .connection import SingleWriter
from .records import ProfileRecord

__all__ = ["ProfileStore"]


_UPSERT_PROFILE = """
INSERT INTO profiles (id, name, payload, created_at, updated_at)
VALUES (?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
    name=excluded.name,
    payload=excluded.payload,
    updated_at=excluded.updated_at
"""


def _row_to_profile(row) -> ProfileRecord:
    return ProfileRecord(
        id=str(row["id"]),
        name=str(row["name"]),
        payload=json.loads(row["payload"]),
        created_at=int(row["created_at"]),
        updated_at=int(row["updated_at"]),
    )


class ProfileStore:
    """Persist and read frontend profiles through the shared Cache_Store DB."""

    def __init__(self, writer: SingleWriter, reader: Callable[[], object]) -> None:
        self._writer = writer
        self._reader = reader

    def upsert_profile(self, profile: ProfileRecord) -> None:
        self._writer.execute(
            _UPSERT_PROFILE,
            (
                profile.id,
                profile.name,
                json.dumps(profile.payload, sort_keys=True),
                int(profile.created_at),
                int(profile.updated_at),
            ),
        )

    def read_profile(self, profile_id: str) -> ProfileRecord | None:
        conn = self._reader()
        try:
            row = conn.execute(
                "SELECT id, name, payload, created_at, updated_at "
                "FROM profiles WHERE id = ?",
                (profile_id,),
            ).fetchone()
            return None if row is None else _row_to_profile(row)
        finally:
            conn.close()

    def read_profiles(self) -> list[ProfileRecord]:
        conn = self._reader()
        try:
            rows = conn.execute(
                "SELECT id, name, payload, created_at, updated_at "
                "FROM profiles ORDER BY updated_at DESC, id"
            ).fetchall()
            return [_row_to_profile(row) for row in rows]
        finally:
            conn.close()

    def delete_profile(self, profile_id: str) -> bool:
        cur = self._writer.execute("DELETE FROM profiles WHERE id = ?", (profile_id,))
        return cur.rowcount > 0
