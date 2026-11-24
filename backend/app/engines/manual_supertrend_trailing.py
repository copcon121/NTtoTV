"""Server-side SuperTrend trailing exits for manually opened positions.

The trailing level is virtual: an existing broker SL is left untouched and the
position is closed only after the configured chart bar closes across the
confirmed SuperTrend line. Automatic mGann orders are explicitly excluded.
"""

from __future__ import annotations

import logging
from dataclasses import replace

from ..models.messages import EventType, OHLCVBar
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
from .supertrend import SupertrendBar, SupertrendConfig, SupertrendPoint, SupertrendState

__all__ = [
    "ManualSupertrendTrailingEngine",
    "prime_supertrend_trailing",
    "supertrend_trailing_activation_error",
    "supertrend_trailing_to_dict",
]

logger = logging.getLogger(__name__)

_WARMUP_BARS = 5_000


def supertrend_trailing_to_dict(record: SupertrendTrailingRecord) -> dict:
    return {
        "targetType": record.target_type,
        "targetId": record.target_id,
        "brokerPositionTicket": record.broker_position_ticket,
        "side": record.side,
        "timeframe": record.timeframe,
        "period": record.period,
        "multiplier": record.multiplier,
        "atrMethod": record.atr_method,
        "source": record.source,
        "lastBarTime": record.last_bar_time,
        "lastLine": record.last_line,
        "createdAt": record.created_at,
        "updatedAt": record.updated_at,
    }


def prime_supertrend_trailing(
    cache: CacheStore, record: SupertrendTrailingRecord
) -> SupertrendTrailingRecord:
    """Bind a newly armed rule to the latest confirmed cached bar.

    This prevents activation from replaying an old crossing as though it had
    happened after the user pressed the button.
    """
    point = _latest_point(cache, record, through_time=None)
    if point is not None:
        record.last_bar_time = point.time
        record.last_line = point.value
    return record


def supertrend_trailing_activation_error(
    cache: CacheStore, record: SupertrendTrailingRecord
) -> str | None:
    """Return a user-facing reason when the current market is on the wrong side."""
    point, price = _current_market_point(cache, record)
    if point is None or point.value is None or price is None:
        return "SuperTrend does not have enough current chart data yet"
    if record.side == OrderSide.BUY.value:
        if point.trend != 1 or price <= point.value:
            return (
                "Cannot enable BUY trailing: price must be above the green "
                "SuperTrend line"
            )
        return None
    if record.side == OrderSide.SELL.value:
        if point.trend != -1 or price >= point.value:
            return (
                "Cannot enable SELL trailing: price must be below the red "
                "SuperTrend line"
            )
        return None
    return "SuperTrend trailing position side is invalid"


class ManualSupertrendTrailingEngine:
    def __init__(
        self,
        cache: CacheStore,
        mt5_manager: Mt5Manager,
        registry: WebSocketRegistry | None = None,
    ) -> None:
        self._cache = cache
        self._mt5 = mt5_manager
        self._registry = registry

    def on_closed_bar(self, timeframe: str, bar: OHLCVBar) -> int:
        """Advance matching rules and close positions crossed on this bar."""
        rules = [
            rule
            for rule in self._cache.supertrend_trailing.list_for_timeframe(timeframe)
            if rule.last_bar_time is None or bar.time > rule.last_bar_time
        ]
        if not rules:
            return 0

        point_cache: dict[tuple[int, float, str, str], SupertrendPoint | None] = {}
        closed = 0
        for rule in rules:
            key = (rule.period, rule.multiplier, rule.atr_method, rule.source)
            if key not in point_cache:
                point_cache[key] = _latest_point(
                    self._cache, rule, through_time=bar.time
                )
            point = point_cache[key]
            line = None if point is None else point.value
            # Checkpoint before broker I/O. Duplicate closed-bar snapshots can
            # never submit duplicate close requests; a broker rejection may be
            # retried on the next confirmed bar if the close remains crossed.
            self._cache.supertrend_trailing.update_progress(
                rule.user_id,
                rule.target_type,
                rule.target_id,
                bar_time=bar.time,
                line=line,
                updated_at=now_ms(),
            )
            if line is None or not _closed_across(rule.side, bar.close, line):
                continue
            if self._close_rule(rule, bar, line):
                closed += 1
        return closed

    def _close_rule(
        self, rule: SupertrendTrailingRecord, bar: OHLCVBar, line: float
    ) -> bool:
        account = self._cache.users.read_mt5_account(rule.user_id)
        if account is None or account.id != rule.account_id:
            self._delete(rule)
            return False
        try:
            with self._mt5.account_session(self._cache, account) as backend:
                positions = backend.positions(rule.user_id, account.id)
                position = _find_position(
                    positions, rule.broker_position_ticket, account.symbol_broker
                )
                if position is None:
                    self._delete(rule)
                    return False
                order = self._close_order_for(rule, position, account.symbol_broker)
                if order is None:
                    self._delete(rule)
                    return False
                result = backend.close_position(order)
        except Exception as exc:
            logger.warning(
                "manual SuperTrend trailing close failed for %s %s: %s",
                rule.target_type,
                rule.target_id,
                exc,
            )
            self._audit_failure(rule, str(exc))
            return False
        if not result.accepted:
            self._audit_failure(rule, result.error_message or "broker rejected close")
            return False

        if rule.target_type == "order":
            saved = self._cache.orders.read(rule.target_id, rule.user_id)
            if saved is not None:
                saved.status = OrderStatus.CLOSED
                saved.broker_deal_ticket = (
                    result.broker_deal_ticket or saved.broker_deal_ticket
                )
                saved.closed_at = now_ms()
                saved.updated_at = saved.closed_at
                self._cache.orders.update(saved)
                self._cache.orders.append_event(
                    OrderEventRecord(
                        order_id=saved.id,
                        user_id=saved.user_id,
                        event_type="manual_supertrend_trailing_exit",
                        payload={
                            "barTime": bar.time,
                            "barClose": bar.close,
                            "supertrend": line,
                            "timeframe": rule.timeframe,
                        },
                        created_at=now_ms(),
                    )
                )
                self._emit_order(saved)
        self._delete(rule)
        return True

    def _close_order_for(
        self,
        rule: SupertrendTrailingRecord,
        position: dict,
        symbol_broker: str,
    ) -> OrderRecord | None:
        volume = float(position.get("volumeLots") or 0.0)
        if volume <= 0:
            return None
        if rule.target_type == "order":
            order = self._cache.orders.read(rule.target_id, rule.user_id)
            if (
                order is None
                or order.source is OrderSource.AUTO_MGANN
                or order.status not in {OrderStatus.FILLED, OrderStatus.SYNC_ERROR}
                or order.broker_position_ticket != rule.broker_position_ticket
            ):
                return None
            return replace(order, volume_lots=volume)
        if rule.target_type != "position":
            return None
        return OrderRecord(
            id=f"mt5pos_{rule.broker_position_ticket}",
            user_id=rule.user_id,
            account_id=rule.account_id,
            source=OrderSource.API,
            symbol_internal="GC",
            contract_internal="GC",
            source_contract=None,
            symbol_broker=symbol_broker,
            side=OrderSide(rule.side),
            kind=OrderKind.MARKET,
            volume_lots=volume,
            gc_anchored=True,
            status=OrderStatus.FILLED,
            idempotency_key=f"manual-position-{rule.broker_position_ticket}",
            created_at=int(position.get("time") or now_ms()),
            updated_at=now_ms(),
            entry_broker=_positive_or_none(position.get("entryBroker")),
            sl_broker=_positive_or_none(position.get("slBroker")),
            tp_broker=_positive_or_none(position.get("tpBroker")),
            broker_position_ticket=rule.broker_position_ticket,
        )

    def _audit_failure(self, rule: SupertrendTrailingRecord, message: str) -> None:
        if rule.target_type != "order":
            return
        order = self._cache.orders.read(rule.target_id, rule.user_id)
        if order is None:
            return
        self._cache.orders.append_event(
            OrderEventRecord(
                order_id=order.id,
                user_id=order.user_id,
                event_type="manual_supertrend_trailing_exit_failed",
                payload={"errorMessage": message, "timeframe": rule.timeframe},
                created_at=now_ms(),
            )
        )

    def _delete(self, rule: SupertrendTrailingRecord) -> None:
        self._cache.supertrend_trailing.delete(
            rule.user_id, rule.target_type, rule.target_id
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


def _latest_point(
    cache: CacheStore,
    rule: SupertrendTrailingRecord,
    *,
    through_time: int | None,
) -> SupertrendPoint | None:
    state = SupertrendState(
        SupertrendConfig(
            period=rule.period,
            multiplier=rule.multiplier,
            atr_method=rule.atr_method,
            source=rule.source,
        )
    )
    for row in cache.read_bars(
        "GC",
        "GC",
        rule.timeframe,
        to=through_time,
        limit=_WARMUP_BARS,
    ):
        if not row.closed or (through_time is not None and row.time > through_time):
            continue
        state.on_closed_bar(
            SupertrendBar(
                time=row.time,
                open=row.open,
                high=row.high,
                low=row.low,
                close=row.close,
            )
        )
    return state.last_point


def _current_market_point(
    cache: CacheStore, rule: SupertrendTrailingRecord
) -> tuple[SupertrendPoint | None, float | None]:
    """Calculate the displayed line, including the latest forming bar preview."""
    state = SupertrendState(
        SupertrendConfig(
            period=rule.period,
            multiplier=rule.multiplier,
            atr_method=rule.atr_method,
            source=rule.source,
        )
    )
    point: SupertrendPoint | None = None
    price: float | None = None
    for row in cache.read_bars(
        "GC", "GC", rule.timeframe, limit=_WARMUP_BARS
    ):
        bar = SupertrendBar(
            time=row.time,
            open=row.open,
            high=row.high,
            low=row.low,
            close=row.close,
        )
        point = state.on_closed_bar(bar) if row.closed else state.preview(bar)
        price = float(row.close)
    return point, price


def _closed_across(side: str, close: float, line: float) -> bool:
    if side == OrderSide.BUY.value:
        return float(close) < float(line)
    if side == OrderSide.SELL.value:
        return float(close) > float(line)
    return False


def _find_position(rows: list[dict], ticket: int, symbol_broker: str) -> dict | None:
    for row in rows:
        if int(row.get("ticket") or 0) != int(ticket):
            continue
        symbol = row.get("symbol")
        if not symbol or symbol == symbol_broker:
            return row
    return None


def _positive_or_none(value) -> float | None:
    if not isinstance(value, (int, float)) or float(value) == 0:
        return None
    return float(value)
