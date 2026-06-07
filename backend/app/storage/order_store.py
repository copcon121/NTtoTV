"""SQLite order/audit persistence for order-on-chart."""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Callable

from ..models.orders import (
    OrderEventRecord,
    OrderKind,
    OrderRecord,
    OrderSide,
    OrderSource,
    OrderStatus,
)
from .connection import SingleWriter

__all__ = ["OrderStore"]


_ORDER_COLUMNS = (
    "id, user_id, account_id, source, symbol_internal, contract_internal, "
    "source_contract, symbol_broker, side, kind, volume_lots, gc_anchored, "
    "status, idempotency_key, created_at, updated_at, version, entry_gc, sl_gc, "
    "tp_gc, entry_broker, sl_broker, tp_broker, fill_price_broker, "
    "fill_price_gc_estimate, basis_at_submit, basis_at_last_sync, basis_at_fill, "
    "basis_stale_at_submit, broker_order_ticket, broker_position_ticket, "
    "broker_deal_ticket, reject_reason, last_broker_error_code, "
    "last_broker_error_message, submitted_at, filled_at, closed_at, last_sync_at"
)


def _row_to_order(row: sqlite3.Row) -> OrderRecord:
    return OrderRecord(
        id=str(row["id"]),
        user_id=str(row["user_id"]),
        account_id=str(row["account_id"]),
        source=OrderSource(str(row["source"])),
        symbol_internal=str(row["symbol_internal"]),
        contract_internal=str(row["contract_internal"]),
        source_contract=row["source_contract"],
        symbol_broker=str(row["symbol_broker"]),
        side=OrderSide(str(row["side"])),
        kind=OrderKind(str(row["kind"])),
        volume_lots=float(row["volume_lots"]),
        gc_anchored=bool(row["gc_anchored"]),
        status=OrderStatus(str(row["status"])),
        idempotency_key=str(row["idempotency_key"]),
        created_at=int(row["created_at"]),
        updated_at=int(row["updated_at"]),
        version=int(row["version"]),
        entry_gc=row["entry_gc"],
        sl_gc=row["sl_gc"],
        tp_gc=row["tp_gc"],
        entry_broker=row["entry_broker"],
        sl_broker=row["sl_broker"],
        tp_broker=row["tp_broker"],
        fill_price_broker=row["fill_price_broker"],
        fill_price_gc_estimate=row["fill_price_gc_estimate"],
        basis_at_submit=row["basis_at_submit"],
        basis_at_last_sync=row["basis_at_last_sync"],
        basis_at_fill=row["basis_at_fill"],
        basis_stale_at_submit=bool(row["basis_stale_at_submit"]),
        broker_order_ticket=row["broker_order_ticket"],
        broker_position_ticket=row["broker_position_ticket"],
        broker_deal_ticket=row["broker_deal_ticket"],
        reject_reason=row["reject_reason"],
        last_broker_error_code=row["last_broker_error_code"],
        last_broker_error_message=row["last_broker_error_message"],
        submitted_at=row["submitted_at"],
        filled_at=row["filled_at"],
        closed_at=row["closed_at"],
        last_sync_at=row["last_sync_at"],
    )


def _order_params(o: OrderRecord) -> tuple[object, ...]:
    return (
        o.id,
        o.user_id,
        o.account_id,
        o.source.value,
        o.symbol_internal,
        o.contract_internal,
        o.source_contract,
        o.symbol_broker,
        o.side.value,
        o.kind.value,
        o.volume_lots,
        1 if o.gc_anchored else 0,
        o.status.value,
        o.idempotency_key,
        o.created_at,
        o.updated_at,
        o.version,
        o.entry_gc,
        o.sl_gc,
        o.tp_gc,
        o.entry_broker,
        o.sl_broker,
        o.tp_broker,
        o.fill_price_broker,
        o.fill_price_gc_estimate,
        o.basis_at_submit,
        o.basis_at_last_sync,
        o.basis_at_fill,
        1 if o.basis_stale_at_submit else 0,
        o.broker_order_ticket,
        o.broker_position_ticket,
        o.broker_deal_ticket,
        o.reject_reason,
        o.last_broker_error_code,
        o.last_broker_error_message,
        o.submitted_at,
        o.filled_at,
        o.closed_at,
        o.last_sync_at,
    )


class OrderStore:
    def __init__(self, writer: SingleWriter, reader: Callable[[], sqlite3.Connection]):
        self._writer = writer
        self._reader = reader

    def create(self, order: OrderRecord) -> OrderRecord:
        placeholders = ", ".join("?" for _ in range(len(_order_params(order))))
        self._writer.execute(
            f"INSERT INTO orders ({_ORDER_COLUMNS}) VALUES ({placeholders})",
            _order_params(order),
        )
        return order

    def read(self, order_id: str, user_id: str | None = None) -> OrderRecord | None:
        conn = self._reader()
        try:
            where = "id = ?"
            params: list[object] = [order_id]
            if user_id is not None:
                where += " AND user_id = ?"
                params.append(user_id)
            row = conn.execute(
                f"SELECT {_ORDER_COLUMNS} FROM orders WHERE {where}", params
            ).fetchone()
            return None if row is None else _row_to_order(row)
        finally:
            conn.close()

    def read_by_idempotency(
        self, user_id: str, idempotency_key: str
    ) -> OrderRecord | None:
        conn = self._reader()
        try:
            row = conn.execute(
                f"SELECT {_ORDER_COLUMNS} FROM orders "
                "WHERE user_id = ? AND idempotency_key = ?",
                (user_id, idempotency_key),
            ).fetchone()
            return None if row is None else _row_to_order(row)
        finally:
            conn.close()

    def list_for_user(
        self,
        user_id: str,
        *,
        open_only: bool = False,
        limit: int = 100,
    ) -> list[OrderRecord]:
        params: list[object] = [user_id]
        where = "user_id = ?"
        if open_only:
            where += " AND status IN ('pending_submit','submitted','working','filled','sync_paused','sync_error')"
        params.append(int(limit))
        conn = self._reader()
        try:
            rows = conn.execute(
                f"SELECT {_ORDER_COLUMNS} FROM orders WHERE {where} "
                "ORDER BY updated_at DESC LIMIT ?",
                params,
            ).fetchall()
            return [_row_to_order(row) for row in rows]
        finally:
            conn.close()

    def list_open_for_account(
        self, user_id: str, account_id: str
    ) -> list[OrderRecord]:
        conn = self._reader()
        try:
            rows = conn.execute(
                f"SELECT {_ORDER_COLUMNS} FROM orders "
                "WHERE user_id = ? AND account_id = ? "
                "AND status IN ('pending_submit','submitted','working','filled','sync_paused','sync_error') "
                "ORDER BY updated_at DESC",
                (user_id, account_id),
            ).fetchall()
            return [_row_to_order(row) for row in rows]
        finally:
            conn.close()

    def update(self, order: OrderRecord) -> OrderRecord:
        order.version += 1
        assignments = ", ".join(
            f"{column.strip()} = ?"
            for column in _ORDER_COLUMNS.split(", ")
            if column.strip() != "id"
        )
        values = list(_order_params(order))[1:] + [order.id]
        self._writer.execute(f"UPDATE orders SET {assignments} WHERE id = ?", values)
        return order

    def append_event(self, event: OrderEventRecord) -> int:
        cur = self._writer.execute(
            "INSERT INTO order_events "
            "(order_id, user_id, event_type, payload, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (
                event.order_id,
                event.user_id,
                event.event_type,
                json.dumps(event.payload, sort_keys=True),
                event.created_at,
            ),
        )
        return int(cur.lastrowid)
