"""Conservative order/account reconciliation against the broker backend."""

from __future__ import annotations

import logging

from ..models.messages import EventType
from ..models.orders import OrderEventRecord, OrderKind, OrderSide, OrderStatus, order_to_dict
from ..models.timestamp import now_ms
from ..mt5.manager import Mt5Manager
from ..registry.registry import OutboundEvent, WebSocketRegistry
from ..storage.cache_store import CacheStore

__all__ = ["ReconciliationEngine"]

logger = logging.getLogger(__name__)
MISSING_MARKET_POSITION_GRACE_MS = 10_000
BROKER_PENDING_ORDER_STATUSES = {
    OrderStatus.SUBMITTED,
    OrderStatus.WORKING,
    OrderStatus.SYNC_PAUSED,
    OrderStatus.SYNC_ERROR,
}


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
            open_orders = self._cache.orders.list_open_for_account(
                account.user_id, account.id
            )
            if not open_orders:
                continue
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
                    for order in open_orders:
                        changed = False
                        current_time = now_ms()
                        if (
                            order.status in {OrderStatus.FILLED, OrderStatus.SYNC_ERROR}
                            and order.broker_position_ticket is None
                        ):
                            matched_position = _match_broker_position(
                                order,
                                broker_positions.values(),
                            )
                            if matched_position is not None:
                                order.broker_position_ticket = int(
                                    matched_position["ticket"]
                                )
                                if order.status is OrderStatus.SYNC_ERROR:
                                    order.status = OrderStatus.FILLED
                                    order.last_broker_error_code = None
                                    order.last_broker_error_message = None
                                order.updated_at = now_ms()
                                changed = True
                            elif (
                                order.kind is OrderKind.MARKET
                                and (
                                    order.broker_order_ticket is None
                                    or order.broker_order_ticket not in broker_orders
                                )
                                and current_time - (
                                    order.filled_at
                                    or order.submitted_at
                                    or order.created_at
                                )
                                >= MISSING_MARKET_POSITION_GRACE_MS
                            ):
                                order.status = OrderStatus.CLOSED
                                order.closed_at = current_time
                                order.updated_at = current_time
                                changed = True
                        if (
                            order.status in BROKER_PENDING_ORDER_STATUSES
                            and order.broker_order_ticket is not None
                            and order.broker_position_ticket is None
                            and order.broker_order_ticket not in broker_orders
                        ):
                            order.status = OrderStatus.CANCELLED
                            order.updated_at = current_time
                            changed = True
                        if (
                            order.status in {OrderStatus.FILLED, OrderStatus.SYNC_ERROR}
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


def _match_broker_position(order, positions) -> dict | None:
    expected_suffix = order.id.replace("_", "")[-12:]
    candidates: list[tuple[float, int, dict]] = []
    for row in positions:
        ticket = row.get("ticket")
        if ticket is None:
            continue
        symbol = row.get("symbol")
        if symbol and symbol != order.symbol_broker:
            continue
        side = row.get("side")
        if side in (OrderSide.BUY.value, OrderSide.SELL.value) and side != order.side.value:
            continue
        volume = row.get("volumeLots")
        if isinstance(volume, (int, float)) and volume > 0:
            if abs(float(volume) - order.volume_lots) > 1e-9:
                continue

        score = 0.0
        identifier = row.get("identifier")
        row_order_id = row.get("orderId")
        if row_order_id == order.id:
            score += 120.0
        if order.broker_position_ticket is not None and ticket == order.broker_position_ticket:
            score += 110.0
        if order.broker_order_ticket is not None and (
            ticket == order.broker_order_ticket or identifier == order.broker_order_ticket
        ):
            score += 100.0
        if order.broker_deal_ticket is not None and (
            ticket == order.broker_deal_ticket or identifier == order.broker_deal_ticket
        ):
            score += 80.0
        comment = str(row.get("comment") or "")
        if expected_suffix and expected_suffix in comment.replace("_", ""):
            score += 40.0
        if row.get("magic") == 240606:
            score += 20.0
        fill_price = order.fill_price_broker or order.entry_broker
        entry = row.get("entryBroker")
        if isinstance(fill_price, (int, float)) and isinstance(entry, (int, float)):
            score += max(0.0, 10.0 - min(10.0, abs(float(entry) - float(fill_price))))
        timestamp = int(row.get("time") or 0)
        candidates.append((score, timestamp, row))
    if not candidates:
        return None
    candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
    best_score, _, best = candidates[0]
    if best_score > 0 or len(candidates) == 1:
        return best
    return None
