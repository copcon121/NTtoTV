"""Alert CRUD and alert-event persistence for the Cache_Store.

Task 18.1 persists alert definitions and the alert-event audit log to the
Cache_Store ``alerts`` and ``alert_events`` tables (Req 16.2, 16.3, 17.3, 18.8-
18.11). This is a focused collaborator that :class:`~app.storage.cache_store.
CacheStore` delegates to, built on the shared single-writer seam
(:class:`~app.storage.connection.SingleWriter`) for writes and independent WAL
reader connections for reads — mirroring :class:`~app.storage.keyed_store.
KeyedStore`.

Alert ``params`` are a structured dict in memory and persisted as JSON text in
the ``params`` column. Serialization uses sorted keys so the round-trip is
stable and order-independent. Creating an alert is an idempotent upsert on the
``id`` primary key (last-write-wins), and PATCH updates only the supplied fields
(``enabled`` and/or ``params``), leaving the others unchanged (Req 18.10).
"""

from __future__ import annotations

import json
from collections.abc import Callable

from .connection import SingleWriter
from .records import AlertEventRecord, AlertRecord

__all__ = ["AlertStore"]


_UPSERT_ALERT = """
INSERT INTO alerts
    (id, profile_id, symbol, type, params, enabled, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
    profile_id=excluded.profile_id,
    symbol=excluded.symbol,
    type=excluded.type,
    params=excluded.params,
    enabled=excluded.enabled,
    updated_at=excluded.updated_at
"""

_INSERT_ALERT_EVENT = """
INSERT INTO alert_events
    (alert_id, profile_id, symbol, contract, time, price, message)
VALUES (?, ?, ?, ?, ?, ?, ?)
"""


def _row_to_alert(row) -> AlertRecord:
    """Map an ``alerts`` table row to an :class:`AlertRecord`."""
    return AlertRecord(
        id=str(row["id"]),
        profile_id=str(row["profile_id"]),
        symbol=str(row["symbol"]),
        type=str(row["type"]),
        params=json.loads(row["params"]),
        enabled=bool(row["enabled"]),
        created_at=int(row["created_at"]),
        updated_at=int(row["updated_at"]),
    )


def _row_to_event(row) -> AlertEventRecord:
    """Map an ``alert_events`` table row to an :class:`AlertEventRecord`."""
    return AlertEventRecord(
        id=int(row["id"]),
        alert_id=str(row["alert_id"]),
        profile_id=str(row["profile_id"]),
        symbol=str(row["symbol"]),
        contract=str(row["contract"]),
        time=int(row["time"]),
        price=None if row["price"] is None else float(row["price"]),
        message=str(row["message"]),
    )


class AlertStore:
    """Persist and read alert definitions and the alert-event audit log.

    Writes funnel through the shared :class:`SingleWriter`; reads open
    independent WAL reader connections via the ``reader`` factory so REST reads
    run concurrently with the ingest writer. (Req 7.3, 8.1)
    """

    def __init__(self, writer: SingleWriter, reader: Callable[[], object]) -> None:
        self._writer = writer
        self._reader = reader

    # -- alert definitions ----------------------------------------------------

    def upsert_alert(self, alert: AlertRecord) -> None:
        """Insert or last-write-wins update an alert by ``id`` (Req 16.2)."""
        self._writer.execute(
            _UPSERT_ALERT,
            (
                alert.id,
                alert.profile_id,
                alert.symbol,
                alert.type,
                json.dumps(alert.params, sort_keys=True),
                1 if alert.enabled else 0,
                int(alert.created_at),
                int(alert.updated_at),
            ),
        )

    def read_alert(
        self, alert_id: str, profile_id: str | None = None
    ) -> AlertRecord | None:
        """Return the alert with ``id``, or ``None`` if absent (Req 18.10/18.11)."""
        conn = self._reader()
        try:
            if profile_id is None:
                row = conn.execute(
                    "SELECT id, profile_id, symbol, type, params, enabled, "
                    "created_at, updated_at FROM alerts WHERE id = ?",
                    (alert_id,),
                ).fetchone()
            else:
                row = conn.execute(
                    "SELECT id, profile_id, symbol, type, params, enabled, "
                    "created_at, updated_at FROM alerts "
                    "WHERE id = ? AND profile_id = ?",
                    (alert_id, profile_id),
                ).fetchone()
            return None if row is None else _row_to_alert(row)
        finally:
            conn.close()

    def read_alerts(
        self, symbol: str | None = None, profile_id: str | None = "default"
    ) -> list[AlertRecord]:
        """Return all alerts (optionally filtered by ``symbol``). (Req 18.8)

        Ordered by ``created_at`` then ``id`` for a stable, deterministic list.
        """
        conn = self._reader()
        try:
            if symbol is None and profile_id is None:
                rows = conn.execute(
                    "SELECT id, profile_id, symbol, type, params, enabled, created_at, "
                    "updated_at FROM alerts ORDER BY created_at, id"
                ).fetchall()
            elif symbol is None:
                rows = conn.execute(
                    "SELECT id, profile_id, symbol, type, params, enabled, created_at, "
                    "updated_at FROM alerts WHERE profile_id = ? "
                    "ORDER BY created_at, id",
                    (profile_id,),
                ).fetchall()
            elif profile_id is None:
                rows = conn.execute(
                    "SELECT id, profile_id, symbol, type, params, enabled, created_at, "
                    "updated_at FROM alerts WHERE symbol = ? ORDER BY created_at, id",
                    (symbol,),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT id, profile_id, symbol, type, params, enabled, created_at, "
                    "updated_at FROM alerts WHERE symbol = ? AND profile_id = ? "
                    "ORDER BY created_at, id",
                    (symbol, profile_id),
                ).fetchall()
            return [_row_to_alert(r) for r in rows]
        finally:
            conn.close()

    def delete_alert(self, alert_id: str, profile_id: str | None = None) -> bool:
        """Delete the alert with ``id``; return ``True`` if a row was removed.

        Associated ``alert_events`` cascade-delete via the foreign key. (Req 16.3)
        """
        if profile_id is None:
            cur = self._writer.execute("DELETE FROM alerts WHERE id = ?", (alert_id,))
        else:
            cur = self._writer.execute(
                "DELETE FROM alerts WHERE id = ? AND profile_id = ?",
                (alert_id, profile_id),
            )
        return cur.rowcount > 0

    # -- alert events (audit log) ---------------------------------------------

    def insert_alert_event(self, event: AlertEventRecord) -> int:
        """Persist an alert-event audit row; return its assigned id. (Req 17.3)"""
        cur = self._writer.execute(
            _INSERT_ALERT_EVENT,
            (
                event.alert_id,
                event.profile_id,
                event.symbol,
                event.contract,
                int(event.time),
                event.price,
                event.message,
            ),
        )
        return int(cur.lastrowid)

    def read_alert_events(
        self, alert_id: str | None = None, profile_id: str | None = None
    ) -> list[AlertEventRecord]:
        """Return persisted alert events (optionally for one ``alert_id``).

        Ordered by event time then id for a stable chronological audit view.
        """
        conn = self._reader()
        try:
            if alert_id is None and profile_id is None:
                rows = conn.execute(
                    "SELECT id, alert_id, profile_id, symbol, contract, time, price, message "
                    "FROM alert_events ORDER BY time, id"
                ).fetchall()
            elif alert_id is None:
                rows = conn.execute(
                    "SELECT id, alert_id, profile_id, symbol, contract, time, price, message "
                    "FROM alert_events WHERE profile_id = ? ORDER BY time, id",
                    (profile_id,),
                ).fetchall()
            elif profile_id is None:
                rows = conn.execute(
                    "SELECT id, alert_id, profile_id, symbol, contract, time, price, message "
                    "FROM alert_events WHERE alert_id = ? ORDER BY time, id",
                    (alert_id,),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT id, alert_id, profile_id, symbol, contract, time, price, message "
                    "FROM alert_events WHERE alert_id = ? AND profile_id = ? "
                    "ORDER BY time, id",
                    (alert_id, profile_id),
                ).fetchall()
            return [_row_to_event(r) for r in rows]
        finally:
            conn.close()
