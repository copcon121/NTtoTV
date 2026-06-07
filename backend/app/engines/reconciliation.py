"""Conservative order/account reconciliation against the broker backend."""

from __future__ import annotations

import logging

from ..models.messages import EventType
from ..models.orders import OrderEventRecord, OrderStatus, order_to_dict
from ..models.timestamp import now_ms
from ..mt5.manager import Mt5Manager
from ..registry.registry import OutboundEvent, WebSocketRegistry
from ..storage.cache_store import CacheStore

__all__ = ["ReconciliationEngine"]

logger = logging.getLogger(__name__)


class ReconciliationEngine:
    def __init__(
        self,
        cache: CacheStore,
        mt5_manager: Mt5Manager,
        registry: WebSocketRegistry | None = None,
    ) -> None:
        self._cache = cache
        self._mt5 = mt5_manager
        self._registry = registry

    def run_once(self) -> int:
        updates = 0
        for account in self._cache.users.read_mt5_accounts():
            try:
                with self._mt5.account_session(self._cache, account) as backend:
                    broker_orders = {
                        row.get("ticket"): row
                        for row in backend.orders(account.user_id, account.id)
                    }
                    broker_positions = {
                        row.get("ticket"): row
                        for row in backend.positions(account.user_id, account.id)
                    }
                    for order in self._cache.orders.list_open_for_account(
                        account.user_id, account.id
                    ):
                        changed = False
                        if (
                            order.status is OrderStatus.WORKING
                            and order.broker_order_ticket is not None
                            and order.broker_order_ticket not in broker_orders
                        ):
                            order.status = OrderStatus.CANCELLED
                            order.updated_at = now_ms()
                            changed = True
                        if (
                            order.status is OrderStatus.FILLED
                            and order.broker_position_ticket is not None
                            and order.broker_position_ticket not in broker_positions
                        ):
                            order.status = OrderStatus.CLOSED
                            order.closed_at = now_ms()
                            order.updated_at = order.closed_at
                            changed = True
                        if changed:
                            self._cache.orders.update(order)
                            self._cache.orders.append_event(
                                OrderEventRecord(
                                    order_id=order.id,
                                    user_id=order.user_id,
                                    event_type="reconciled",
                                    payload=order_to_dict(order),
                                    created_at=now_ms(),
                                )
                            )
                            self._emit_order(order)
                            updates += 1
                    self._emit_account(account, backend)
            except Exception as exc:
                logger.debug("skipping MT5 reconciliation for account %s: %s", account.id, exc)
        return updates

    def _emit_order(self, order) -> None:
        if self._registry is None:
            return
        self._registry.enqueue(
            OutboundEvent(
                event_type=EventType.ORDER_UPDATE,
                symbol=order.symbol_internal,
                payload={
                    "type": "order_update",
                    "symbol": order.symbol_internal,
                    "order": order_to_dict(order),
                },
                key=order.id,
                user_id=order.user_id,
            )
        )

    def _emit_account(self, account, backend) -> None:
        if self._registry is None:
            return
        info = backend.account_info(account.user_id, account.id)
        payload = {
            "type": "account_update",
            "symbol": "GC",
            "account": {
                "accountId": account.id,
                "tradeMode": info.trade_mode,
                "balance": info.balance,
                "equity": info.equity,
                "freeMargin": info.free_margin,
                "updatedAt": now_ms(),
            },
        }
        self._registry.enqueue(
            OutboundEvent(
                event_type=EventType.ACCOUNT_UPDATE,
                symbol="GC",
                payload=payload,
                key=account.id,
                user_id=account.user_id,
            )
        )
