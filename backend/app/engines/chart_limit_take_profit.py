"""Tick-driven partial take profit for configured manual chart orders.

The chart order bracket keeps its broker-side SL and final TP. Once a filled
market or limit reaches +1R in GC price space, this engine closes one half of
the managed volume and records a durable event so later ticks (and backend
restarts) cannot repeat the partial close. Configured orders then arm the
existing confirmed-bar SuperTrend trailing rule for the remaining position.
"""

from __future__ import annotations

import logging
import math
from dataclasses import replace

from ..models.messages import EventType
from ..models.orders import (
    OrderEventRecord,
    OrderKind,
    OrderRecord,
    OrderSide,
    OrderSource,
    OrderStatus,
    order_to_dict,
)
from ..models.supertrend_trailing import SupertrendTrailingRecord
from ..models.timestamp import now_ms
from ..mt5.manager import Mt5Manager
from ..registry.registry import OutboundEvent, WebSocketRegistry
from ..storage.cache_store import CacheStore
from .manual_supertrend_trailing import prime_supertrend_trailing

__all__ = ["ChartLimitTakeProfitEngine"]

logger = logging.getLogger(__name__)

_PARTIAL_TAKE_PROFIT_EVENT = "chart_limit_partial_take_profit_1r"
_AUTO_SUPERTREND_ARMED_EVENT = "chart_order_auto_supertrend_armed_after_1r"


class ChartLimitTakeProfitEngine:
    """Close 50% of an enabled manual market/limit at its first +1R touch."""

    def __init__(
        self,
        cache: CacheStore,
        mt5_manager: Mt5Manager,
        registry: WebSocketRegistry | None = None,
    ) -> None:
        self._cache = cache
        self._mt5 = mt5_manager
        self._registry = registry

    def take_profit_at_1r(self, gc_price: float) -> int:
        if not math.isfinite(gc_price):
            return 0

        changed = 0
        for account in self._cache.users.read_mt5_accounts():
            open_orders = self._cache.orders.list_open_for_account(
                account.user_id, account.id
            )
            already_taken = {
                order.id
                for order in self._cache.orders.list_open_for_account_with_event(
                    account.user_id,
                    account.id,
                    _PARTIAL_TAKE_PROFIT_EVENT,
                )
            }
            already_armed = {
                order.id
                for order in self._cache.orders.list_open_for_account_with_event(
                    account.user_id,
                    account.id,
                    _AUTO_SUPERTREND_ARMED_EVENT,
                )
            }
            # If persistence failed after a successful broker close, retry only
            # the local trailing arm. The durable armed event also lets a user
            # manually disable trailing later without it being re-enabled.
            for order in open_orders:
                if (
                    order.id in already_taken
                    and order.id not in already_armed
                    and order.auto_supertrend_after_1r_enabled
                ):
                    self._arm_auto_supertrend(order)
            candidates = [
                order
                for order in open_orders
                if order.take_profit_1r_enabled
                and order.source in {OrderSource.CHART_BRACKET, OrderSource.MARKET_BAR}
                and order.kind in {OrderKind.MARKET, OrderKind.LIMIT}
                and order.status is OrderStatus.FILLED
                and order.broker_position_ticket is not None
                and order.id not in already_taken
                and _has_reached_one_r(order, gc_price)
            ]
            if not candidates:
                continue

            try:
                with self._mt5.account_session(self._cache, account) as backend:
                    symbol = backend.symbol_info(
                        account.user_id, account.id, account.symbol_broker
                    )
                    positions = backend.positions(account.user_id, account.id)
                    for order in candidates:
                        position = _find_position(
                            positions,
                            order.broker_position_ticket,
                            account.symbol_broker,
                        )
                        if position is None:
                            continue
                        broker_volume = _positive_number(position.get("volumeLots"))
                        if broker_volume is None:
                            continue
                        managed_volume = min(order.volume_lots, broker_volume)
                        close_volume = _half_close_volume(
                            managed_volume,
                            min_lot=symbol.min_lot,
                            lot_step=symbol.lot_step,
                        )
                        if close_volume is None:
                            continue
                        if self._close_half(
                            order,
                            backend,
                            gc_price=gc_price,
                            close_volume=close_volume,
                        ):
                            changed += 1
            except Exception as exc:
                logger.warning(
                    "chart limit 1R take profit skipped for account %s: %s",
                    account.id,
                    exc,
                )
        return changed

    def _close_half(
        self,
        order: OrderRecord,
        backend,
        *,
        gc_price: float,
        close_volume: float,
    ) -> bool:
        close_request = replace(order, volume_lots=close_volume)
        try:
            result = backend.close_position(close_request)
        except Exception as exc:
            self._audit(
                order,
                "chart_limit_partial_take_profit_1r_exception",
                {"errorMessage": str(exc)},
            )
            return False
        if not result.accepted:
            self._audit(
                order,
                "chart_limit_partial_take_profit_1r_rejected",
                {
                    "errorCode": result.error_code,
                    "errorMessage": result.error_message,
                },
            )
            return False

        original_volume = order.volume_lots
        updated = replace(order)
        updated.volume_lots = round(max(0.0, original_volume - close_volume), 10)
        updated.broker_deal_ticket = (
            result.broker_deal_ticket or updated.broker_deal_ticket
        )
        updated.last_broker_error_code = None
        updated.last_broker_error_message = None
        updated.updated_at = now_ms()
        self._cache.orders.update(updated)
        self._audit(
            updated,
            _PARTIAL_TAKE_PROFIT_EVENT,
            {
                "gcPrice": gc_price,
                "oneRPrice": _one_r_price(updated),
                "entryGc": updated.entry_gc,
                "slGc": updated.sl_gc,
                "originalVolumeLots": original_volume,
                "closedVolumeLots": close_volume,
                "remainingVolumeLots": updated.volume_lots,
            },
        )
        if updated.auto_supertrend_after_1r_enabled:
            self._arm_auto_supertrend(updated)
        self._emit_order(updated)
        return True

    def _arm_auto_supertrend(self, order: OrderRecord) -> bool:
        if order.broker_position_ticket is None:
            return False
        if (
            order.trailing_timeframe is None
            or order.trailing_period is None
            or order.trailing_multiplier is None
            or order.trailing_atr_method is None
            or order.trailing_source is None
        ):
            return False
        current = self._cache.supertrend_trailing.read(
            order.user_id, "order", order.id
        )
        if current is None:
            now = now_ms()
            record = SupertrendTrailingRecord(
                user_id=order.user_id,
                account_id=order.account_id,
                target_type="order",
                target_id=order.id,
                broker_position_ticket=order.broker_position_ticket,
                side=order.side.value,
                timeframe=order.trailing_timeframe,
                period=order.trailing_period,
                multiplier=order.trailing_multiplier,
                atr_method=order.trailing_atr_method,
                source=order.trailing_source,
                created_at=now,
                updated_at=now,
            )
            try:
                self._cache.supertrend_trailing.upsert(
                    prime_supertrend_trailing(self._cache, record)
                )
            except Exception as exc:
                logger.warning(
                    "auto SuperTrend arm failed for order %s: %s", order.id, exc
                )
                return False
        self._audit(
            order,
            _AUTO_SUPERTREND_ARMED_EVENT,
            {
                "timeframe": order.trailing_timeframe,
                "period": order.trailing_period,
                "multiplier": order.trailing_multiplier,
                "atrMethod": order.trailing_atr_method,
                "source": order.trailing_source,
                "existing": current is not None,
            },
        )
        return True

    def _audit(self, order: OrderRecord, event_type: str, payload: dict) -> None:
        self._cache.orders.append_event(
            OrderEventRecord(
                order_id=order.id,
                user_id=order.user_id,
                event_type=event_type,
                payload=payload,
                created_at=now_ms(),
            )
        )

    def _emit_order(self, order: OrderRecord) -> None:
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


def _one_r_price(order: OrderRecord) -> float | None:
    if order.entry_gc is None or order.sl_gc is None:
        return None
    risk = (
        order.entry_gc - order.sl_gc
        if order.side is OrderSide.BUY
        else order.sl_gc - order.entry_gc
    )
    if risk <= 0:
        return None
    raw = order.entry_gc + risk if order.side is OrderSide.BUY else order.entry_gc - risk
    return round(raw * 10) / 10


def _has_reached_one_r(order: OrderRecord, gc_price: float) -> bool:
    one_r = _one_r_price(order)
    if one_r is None:
        return False
    return gc_price >= one_r if order.side is OrderSide.BUY else gc_price <= one_r


def _half_close_volume(
    volume: float,
    *,
    min_lot: float,
    lot_step: float,
) -> float | None:
    """Return a broker-valid close near 50% while leaving a valid remainder."""
    if not all(math.isfinite(value) and value > 0 for value in (volume, min_lot, lot_step)):
        return None
    max_close = volume - min_lot
    if max_close < min_lot - 1e-9:
        return None

    # Prefer the broker step at or below half.  For an odd number of lot steps
    # this is slightly under 50%, which is safer than closing the larger half.
    steps = math.floor((volume / 2.0 + 1e-12) / lot_step)
    close_volume = round(steps * lot_step, 10)
    if close_volume < min_lot - 1e-9:
        close_volume = min_lot
    if close_volume > max_close + 1e-9:
        close_volume = math.floor((max_close + 1e-12) / lot_step) * lot_step
        close_volume = round(close_volume, 10)
    if close_volume < min_lot - 1e-9:
        return None

    remaining = round(volume - close_volume, 10)
    if remaining < min_lot - 1e-9:
        return None
    if not _is_step_aligned(close_volume, lot_step):
        return None
    if not _is_step_aligned(remaining, lot_step):
        return None
    return close_volume


def _is_step_aligned(volume: float, step: float) -> bool:
    return abs(volume / step - round(volume / step)) <= 1e-7


def _find_position(
    rows: list[dict], ticket: int, symbol_broker: str
) -> dict | None:
    for row in rows:
        if int(row.get("ticket") or 0) != int(ticket):
            continue
        symbol = row.get("symbol")
        if not symbol or symbol == symbol_broker:
            return row
    return None


def _positive_number(value) -> float | None:
    if not isinstance(value, (int, float)) or not math.isfinite(float(value)):
        return None
    number = float(value)
    return number if number > 0 else None
