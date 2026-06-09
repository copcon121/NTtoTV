"""Order-on-chart REST API."""

from __future__ import annotations

import asyncio
from contextlib import contextmanager
from dataclasses import replace
import logging
import secrets
from typing import Any, Iterator

from fastapi import APIRouter, Depends, Request

from ..config import settings as default_settings
from ..engines.basis_engine import BasisEngine, ConvertedPrice
from ..engines.reconciliation import ReconciliationEngine
from ..engines.symbol_map import SymbolMap
from ..models.auth import AuthenticatedUser
from ..models.orders import (
    OrderEventRecord,
    OrderKind,
    OrderRecord,
    OrderSide,
    OrderSource,
    OrderStatus,
    order_to_dict,
)
from ..models.timestamp import now_ms
from ..models.messages import EventType
from ..mt5.manager import Mt5Manager
from ..registry.registry import OutboundEvent
from ..storage.cache_store import CacheStore
from .alerts import get_cache
from .auth import get_current_user
from .contract_state import ContractStateStore
from .errors import ApiError, bad_request, conflict, not_found
from .routes import get_contract_state

router = APIRouter(prefix="/api/orders", tags=["orders"])
logger = logging.getLogger(__name__)


def _manager(request: Request) -> Mt5Manager:
    runtime = getattr(request.app.state, "runtime", None)
    if runtime is not None:
        return runtime.mt5_manager
    manager = getattr(request.app.state, "mt5_manager", None)
    if manager is None:
        manager = Mt5Manager()
        request.app.state.mt5_manager = manager
    return manager


def _reconcile_user_account(
    request: Request,
    cache: CacheStore,
    user: AuthenticatedUser,
) -> None:
    account = cache.users.read_mt5_account(user.id)
    if account is None:
        return
    try:
        runtime = getattr(request.app.state, "runtime", None)
        reconciliation = getattr(runtime, "reconciliation", None)
        if reconciliation is not None:
            reconciliation.run_account(account)
            return
        ReconciliationEngine(cache, _manager(request)).run_account(account)
    except Exception as exc:
        logger.debug("open order reconciliation skipped for user %s: %s", user.id, exc)


def _basis(request: Request) -> BasisEngine:
    runtime = getattr(request.app.state, "runtime", None)
    if runtime is not None:
        return runtime.basis_engine
    basis = getattr(request.app.state, "basis_engine", None)
    if basis is None:
        basis = BasisEngine()
        request.app.state.basis_engine = basis
    return basis


@router.get("")
async def list_orders(
    request: Request,
    openOnly: bool = False,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    if openOnly:
        await asyncio.to_thread(_reconcile_user_account, request, cache, user)
    orders = cache.orders.list_for_user(user.id, open_only=openOnly)
    return {"orders": [order_to_dict(order) for order in orders]}


@router.post("")
async def create_order(
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
    state: ContractStateStore = Depends(get_contract_state),
) -> dict[str, Any]:
    body = await _json_body(request)
    account = cache.users.read_mt5_account(user.id)
    if account is None:
        raise not_found("MT5 account is not connected", field="account")

    idempotency = _required_str(body, "idempotencyKey")
    existing = cache.orders.read_by_idempotency(user.id, idempotency)
    if existing is not None:
        return {"order": order_to_dict(existing), "idempotent": True}

    side = OrderSide(_required_str(body, "side"))
    kind = OrderKind(_required_str(body, "kind"))
    source = OrderSource(str(body.get("source", OrderSource.API.value)))
    volume = _required_number(body, "volumeLots")
    gc_anchored = bool(body.get("gcAnchored", True))

    with _mt5_session(request, cache, account) as mt5:
        try:
            symbol_info = mt5.symbol_info(user.id, account.id, account.symbol_broker)
        except Exception as exc:
            raise conflict(f"MT5 symbol lookup failed: {exc}", field="symbolBroker")
        symbol_map = SymbolMap.from_info(symbol_info)
        _guard_trading(account.trade_mode)
        _guard_volume(volume, symbol_info.min_lot, symbol_info.max_lot, symbol_info.lot_step)

        basis = _basis(request)
        entry_gc = _optional_number(body, "entryGc")
        reference_gc = _optional_number(body, "referenceGc")
        sl_gc = _optional_number(body, "slGc")
        tp_gc = _optional_number(body, "tpGc")
        try:
            tick = mt5.symbol_tick(user.id, account.id, account.symbol_broker)
        except Exception as exc:
            raise conflict(f"MT5 tick lookup failed: {exc}", field="symbolBroker")
        if kind is OrderKind.MARKET and reference_gc is not None:
            basis.update_gc(reference_gc, tick.time)
        basis.update_broker_mid((tick.bid + tick.ask) / 2, tick.time)

        market_entry_broker: float | None = None
        sl_distance: float | None = None
        tp_distance: float | None = None
        if kind is not OrderKind.MARKET and entry_gc is None:
            raise bad_request("'entryGc' is required for pending orders", field="entryGc")
        if kind is OrderKind.MARKET:
            market_entry_broker = tick.ask if side is OrderSide.BUY else tick.bid
            snap = basis.from_broker(market_entry_broker, symbol_map)
            entry_gc = snap.price
        if sl_gc is None and "slDistanceGc" in body:
            sl_distance = _required_number(body, "slDistanceGc")
            sl_gc = entry_gc - sl_distance if side is OrderSide.BUY else entry_gc + sl_distance
        if tp_gc is None and "tpDistanceGc" in body:
            tp_distance = _required_number(body, "tpDistanceGc")
            tp_gc = entry_gc + tp_distance if side is OrderSide.BUY else entry_gc - tp_distance

        broker_mid = (tick.bid + tick.ask) / 2
        chart_reference = (
            _broker_reference(reference_gc, broker_mid, symbol_map)
            if kind is not OrderKind.MARKET and reference_gc is not None
            else None
        )

        entry_broker = (
            None
            if entry_gc is None
            else _to_broker_with_reference(entry_gc, chart_reference, symbol_map)
            if chart_reference is not None
            else basis.to_broker(entry_gc, symbol_map)
        )
        if market_entry_broker is not None:
            basis_snap = basis.snapshot()
            entry_broker = ConvertedPrice(
                price=symbol_map.round_price(market_entry_broker),
                raw_price=market_entry_broker,
                basis=basis_snap.basis,
                stale=basis_snap.stale,
                warning=basis_snap.warning,
            )
        sl_broker = (
            None
            if sl_gc is None
            else _to_broker_with_reference(sl_gc, chart_reference, symbol_map)
            if chart_reference is not None
            else basis.to_broker(sl_gc, symbol_map)
        )
        if kind is OrderKind.MARKET and sl_distance is not None and entry_broker is not None:
            sl_broker = _market_distance_level(
                entry_broker,
                symbol_map,
                side,
                sl_distance,
                stop_kind="sl",
            )
        tp_broker = (
            None
            if tp_gc is None
            else _to_broker_with_reference(tp_gc, chart_reference, symbol_map)
            if chart_reference is not None
            else basis.to_broker(tp_gc, symbol_map)
        )
        if kind is OrderKind.MARKET and tp_distance is not None and entry_broker is not None:
            tp_broker = _market_distance_level(
                entry_broker,
                symbol_map,
                side,
                tp_distance,
                stop_kind="tp",
            )
        if any(c is not None and c.stale for c in (entry_broker, sl_broker, tp_broker)):
            raise conflict("GC/XAU basis is stale; trading is paused", field="basis")
        if source is OrderSource.CHART_BRACKET and kind is not OrderKind.MARKET and entry_broker is not None:
            kind = _pending_kind_for_broker_price(side, entry_broker.price, tick)
        _guard_stops(entry_broker.price if entry_broker else None, sl_broker.price if sl_broker else None, tp_broker.price if tp_broker else None, symbol_info.stops_level)

        now = now_ms()
        order = OrderRecord(
            id=f"ord_{secrets.token_hex(12)}",
            user_id=user.id,
            account_id=account.id,
            source=source,
            symbol_internal="GC",
            contract_internal="GC",
            source_contract=state.active_contract("GC") if state.is_known_symbol("GC") else None,
            symbol_broker=account.symbol_broker,
            side=side,
            kind=kind,
            volume_lots=volume,
            gc_anchored=gc_anchored,
            status=OrderStatus.PENDING_SUBMIT,
            idempotency_key=idempotency,
            created_at=now,
            updated_at=now,
            entry_gc=entry_gc,
            sl_gc=sl_gc,
            tp_gc=tp_gc,
            entry_broker=None if entry_broker is None else entry_broker.price,
            sl_broker=None if sl_broker is None else sl_broker.price,
            tp_broker=None if tp_broker is None else tp_broker.price,
            basis_at_submit=(entry_broker or sl_broker or tp_broker).basis if (entry_broker or sl_broker or tp_broker) else None,
            basis_at_last_sync=(entry_broker or sl_broker or tp_broker).basis if (entry_broker or sl_broker or tp_broker) else None,
        )
        cache.orders.create(order)
        cache.orders.append_event(OrderEventRecord(order.id, user.id, "created", order_to_dict(order), now))

        try:
            result = mt5.place_order(order)
        except Exception as exc:
            order.status = OrderStatus.REJECTED
            order.reject_reason = str(exc)
            order.last_broker_error_message = str(exc)
            order.updated_at = now_ms()
            cache.orders.update(order)
            cache.orders.append_event(
                OrderEventRecord(
                    order.id,
                    user.id,
                    "broker_exception",
                    {"errorMessage": str(exc)},
                    now_ms(),
                )
            )
            _enqueue_order_update(request, order)
            raise conflict(f"MT5 order failed: {exc}", field="account")
    order.submitted_at = now_ms()
    order.updated_at = order.submitted_at
    if result.accepted:
        order.status = OrderStatus(result.status)
        order.broker_order_ticket = result.broker_order_ticket
        order.broker_position_ticket = result.broker_position_ticket
        order.broker_deal_ticket = result.broker_deal_ticket
        order.fill_price_broker = result.fill_price
        if result.fill_price is not None:
            fill_gc = basis.from_broker(result.fill_price, symbol_map)
            order.fill_price_gc_estimate = fill_gc.price
            order.basis_at_fill = fill_gc.basis
            order.filled_at = order.updated_at
    else:
        order.status = OrderStatus.REJECTED
        order.reject_reason = result.error_message
        order.last_broker_error_code = result.error_code
        order.last_broker_error_message = result.error_message
    cache.orders.update(order)
    cache.orders.append_event(
        OrderEventRecord(
            order.id,
            user.id,
            "broker_result",
            {"accepted": result.accepted, "status": result.status},
            now_ms(),
        )
    )
    _enqueue_order_update(request, order)
    return {"order": order_to_dict(order), "idempotent": False}


@router.get("/{order_id}")
async def get_order(
    order_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    order = cache.orders.read(order_id, user.id)
    if order is None:
        raise not_found(f"Unknown order {order_id!r}", field="orderId")
    return {"order": order_to_dict(order)}


@router.patch("/{order_id}")
async def patch_order(
    order_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    body = await _json_body(request)
    order = cache.orders.read(order_id, user.id)
    if order is None:
        raise not_found(f"Unknown order {order_id!r}", field="orderId")
    expected = body.get("expectedVersion")
    if expected is not None and int(expected) != order.version:
        raise conflict("Order version conflict", field="expectedVersion")
    candidate = replace(order)
    if "entryGc" in body:
        if order.status is OrderStatus.FILLED:
            raise conflict("Filled positions cannot modify entry", field="entryGc")
        candidate.entry_gc = _optional_number(body, "entryGc")
    if "slGc" in body:
        candidate.sl_gc = _optional_number(body, "slGc")
    if "tpGc" in body:
        candidate.tp_gc = _optional_number(body, "tpGc")
    account = cache.users.read_mt5_account(user.id)
    if account is None:
        raise not_found("MT5 account is not connected", field="account")
    with _mt5_session(request, cache, account) as mt5:
        try:
            symbol_info = mt5.symbol_info(user.id, account.id, account.symbol_broker)
        except Exception as exc:
            raise conflict(f"MT5 symbol lookup failed: {exc}", field="symbolBroker")
        symbol_map = SymbolMap.from_info(symbol_info)
        basis = _basis(request)
        entry_broker = None if candidate.entry_gc is None else basis.to_broker(candidate.entry_gc, symbol_map)
        sl_broker = None if candidate.sl_gc is None else basis.to_broker(candidate.sl_gc, symbol_map)
        tp_broker = None if candidate.tp_gc is None else basis.to_broker(candidate.tp_gc, symbol_map)
        if any(c is not None and c.stale for c in (entry_broker, sl_broker, tp_broker)):
            raise conflict("GC/XAU basis is stale; trading is paused", field="basis")
        _guard_stops(
            entry_broker.price if entry_broker else candidate.entry_broker,
            sl_broker.price if sl_broker else None,
            tp_broker.price if tp_broker else None,
            symbol_info.stops_level,
        )
        if entry_broker is not None:
            candidate.entry_broker = entry_broker.price
        if sl_broker is not None:
            candidate.sl_broker = sl_broker.price
        if tp_broker is not None:
            candidate.tp_broker = tp_broker.price
        converted = entry_broker or sl_broker or tp_broker
        if converted is not None:
            candidate.basis_at_last_sync = converted.basis
        candidate.updated_at = now_ms()
        candidate.last_sync_at = candidate.updated_at
        try:
            result = mt5.modify_order(candidate)
        except Exception as exc:
            order.status = OrderStatus.SYNC_ERROR
            order.last_broker_error_message = str(exc)
            order.updated_at = now_ms()
            cache.orders.update(order)
            cache.orders.append_event(
                OrderEventRecord(
                    order.id,
                    user.id,
                    "modify_exception",
                    {"errorMessage": str(exc)},
                    now_ms(),
                )
            )
            _enqueue_order_update(request, order)
            raise conflict(f"MT5 modify failed: {exc}", field="account")
    if not result.accepted:
        order.status = OrderStatus.SYNC_ERROR
        order.last_broker_error_code = result.error_code
        order.last_broker_error_message = result.error_message
        order.updated_at = now_ms()
        cache.orders.update(order)
        cache.orders.append_event(
            OrderEventRecord(
                order.id,
                user.id,
                "modify_rejected",
                {
                    "errorCode": result.error_code,
                    "errorMessage": result.error_message,
                },
                now_ms(),
            )
        )
        _enqueue_order_update(request, order)
        raise conflict(result.error_message or "Broker rejected modification")
    cache.orders.update(candidate)
    cache.orders.append_event(OrderEventRecord(candidate.id, user.id, "modified", order_to_dict(candidate), now_ms()))
    _enqueue_order_update(request, candidate)
    return {"order": order_to_dict(candidate)}


@router.delete("/{order_id}")
async def cancel_order(
    order_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    order = cache.orders.read(order_id, user.id)
    if order is None:
        raise not_found(f"Unknown order {order_id!r}", field="orderId")
    account = cache.users.read_mt5_account(user.id)
    if account is None:
        raise not_found("MT5 account is not connected", field="account")
    with _mt5_session(request, cache, account) as mt5:
        if _broker_order_missing(mt5, user.id, account, order):
            return _mark_order_cancelled(request, cache, order, event_type="reconciled")
        try:
            result = mt5.cancel_order(order)
        except Exception as exc:
            if _broker_order_missing(mt5, user.id, account, order):
                return _mark_order_cancelled(request, cache, order, event_type="reconciled")
            raise conflict(f"MT5 cancel failed: {exc}", field="account")
    if not result.accepted:
        with _mt5_session(request, cache, account) as mt5:
            if _broker_order_missing(mt5, user.id, account, order):
                return _mark_order_cancelled(request, cache, order, event_type="reconciled")
        raise conflict(result.error_message or "Broker rejected cancellation")
    return _mark_order_cancelled(request, cache, order, event_type="cancelled")


@router.post("/{order_id}/close")
async def close_order(
    order_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    order = cache.orders.read(order_id, user.id)
    if order is None:
        raise not_found(f"Unknown order {order_id!r}", field="orderId")
    account = cache.users.read_mt5_account(user.id)
    if account is None:
        raise not_found("MT5 account is not connected", field="account")
    with _mt5_session(request, cache, account) as mt5:
        if _broker_position_missing(mt5, user.id, account, order):
            return _mark_order_closed(request, cache, order, event_type="reconciled")
        try:
            result = mt5.close_position(order)
        except Exception as exc:
            if _broker_position_missing(mt5, user.id, account, order):
                return _mark_order_closed(request, cache, order, event_type="reconciled")
            raise conflict(f"MT5 close failed: {exc}", field="account")
    if not result.accepted:
        with _mt5_session(request, cache, account) as mt5:
            if _broker_position_missing(mt5, user.id, account, order):
                return _mark_order_closed(request, cache, order, event_type="reconciled")
        raise conflict(result.error_message or "Broker rejected close")
    order.broker_deal_ticket = result.broker_deal_ticket or order.broker_deal_ticket
    return _mark_order_closed(request, cache, order, event_type="closed")


def _mark_order_closed(
    request: Request,
    cache: CacheStore,
    order: OrderRecord,
    *,
    event_type: str,
) -> dict[str, Any]:
    order.status = OrderStatus.CLOSED
    order.last_broker_error_code = None
    order.last_broker_error_message = None
    order.closed_at = now_ms()
    order.updated_at = order.closed_at
    cache.orders.update(order)
    cache.orders.append_event(
        OrderEventRecord(order.id, order.user_id, event_type, order_to_dict(order), now_ms())
    )
    _enqueue_order_update(request, order)
    return {"order": order_to_dict(order)}


def _mark_order_cancelled(
    request: Request,
    cache: CacheStore,
    order: OrderRecord,
    *,
    event_type: str,
) -> dict[str, Any]:
    order.status = OrderStatus.CANCELLED
    order.last_broker_error_code = None
    order.last_broker_error_message = None
    order.updated_at = now_ms()
    cache.orders.update(order)
    cache.orders.append_event(
        OrderEventRecord(order.id, order.user_id, event_type, order_to_dict(order), now_ms())
    )
    _enqueue_order_update(request, order)
    return {"order": order_to_dict(order)}


def _broker_position_missing(
    mt5,
    user_id: str,
    account,
    order: OrderRecord,
) -> bool:
    ticket = order.broker_position_ticket
    if ticket is None:
        return False
    try:
        rows = mt5.positions(user_id, account.id)
    except Exception:
        return False
    return not _ticket_exists(rows, ticket, order.symbol_broker)


def _broker_order_missing(
    mt5,
    user_id: str,
    account,
    order: OrderRecord,
) -> bool:
    ticket = order.broker_order_ticket
    if ticket is None:
        return False
    try:
        rows = mt5.orders(user_id, account.id)
    except Exception:
        return False
    return not _ticket_exists(rows, ticket, order.symbol_broker)


def _ticket_exists(rows: list[dict[str, Any]], ticket: int, symbol_broker: str) -> bool:
    for row in rows:
        if int(row.get("ticket") or 0) != int(ticket):
            continue
        symbol = row.get("symbol")
        if not symbol or symbol == symbol_broker:
            return True
    return False


async def _json_body(request: Request) -> dict[str, Any]:
    try:
        body = await request.json()
    except Exception:
        raise bad_request("Request body must be valid JSON")
    if not isinstance(body, dict):
        raise bad_request("Request body must be a JSON object")
    return body


@contextmanager
def _mt5_session(request: Request, cache: CacheStore, account) -> Iterator[Any]:
    try:
        with _manager(request).account_session(cache, account) as backend:
            yield backend
    except ApiError:
        raise
    except Exception as exc:
        raise conflict(f"MT5 connect failed: {exc}", field="account")


def _required_str(body: dict[str, Any], field: str) -> str:
    value = body.get(field)
    if not isinstance(value, str) or not value:
        raise bad_request(f"Missing or invalid field {field!r}", field=field)
    return value


def _required_number(body: dict[str, Any], field: str) -> float:
    value = body.get(field)
    if not isinstance(value, (int, float)):
        raise bad_request(f"Missing or invalid field {field!r}", field=field)
    return float(value)


def _optional_number(body: dict[str, Any], field: str) -> float | None:
    value = body.get(field)
    if value is None:
        return None
    if not isinstance(value, (int, float)):
        raise bad_request(f"Field {field!r} must be a number", field=field)
    return float(value)


def _market_distance_level(
    entry: ConvertedPrice,
    symbol: SymbolMap,
    side: OrderSide,
    distance: float,
    *,
    stop_kind: str,
) -> ConvertedPrice:
    if stop_kind == "sl":
        raw = entry.price - distance if side is OrderSide.BUY else entry.price + distance
    else:
        raw = entry.price + distance if side is OrderSide.BUY else entry.price - distance
    return ConvertedPrice(
        price=symbol.round_price(raw),
        raw_price=raw,
        basis=entry.basis,
        stale=entry.stale,
        warning=entry.warning,
    )


def _broker_reference(
    reference_gc: float,
    broker_mid: float,
    symbol: SymbolMap,
) -> ConvertedPrice:
    basis = broker_mid - reference_gc
    return ConvertedPrice(
        price=symbol.round_price(broker_mid),
        raw_price=broker_mid,
        basis=basis,
        stale=False,
    )


def _to_broker_with_reference(
    level_gc: float,
    reference: ConvertedPrice,
    symbol: SymbolMap,
) -> ConvertedPrice:
    raw = level_gc + reference.basis
    return ConvertedPrice(
        price=symbol.round_price(raw),
        raw_price=raw,
        basis=reference.basis,
        stale=reference.stale,
        warning=reference.warning,
    )


def _pending_kind_for_broker_price(side: OrderSide, entry_broker: float, tick) -> OrderKind:
    if side is OrderSide.BUY:
        return OrderKind.LIMIT if entry_broker < float(tick.ask) else OrderKind.STOP
    return OrderKind.LIMIT if entry_broker > float(tick.bid) else OrderKind.STOP


def _guard_trading(trade_mode: str) -> None:
    if default_settings.mt5_backend != "fake" and not default_settings.trading_enabled:
        raise conflict("Trading is disabled", field="trading")
    if trade_mode == "live" and not default_settings.live_trading_enabled:
        raise conflict("Live trading is disabled", field="trading")


def _guard_volume(volume: float, min_lot: float, max_lot: float, step: float) -> None:
    if volume < min_lot or volume > max_lot:
        raise bad_request("Volume is outside broker limits", field="volumeLots")
    steps = round((volume - min_lot) / step)
    normalized = min_lot + steps * step
    if abs(normalized - volume) > 1e-9:
        raise bad_request("Volume does not align to broker lot step", field="volumeLots")


def _guard_stops(
    entry: float | None, sl: float | None, tp: float | None, stops_level: float
) -> None:
    if entry is None:
        return
    if sl is not None and abs(entry - sl) < stops_level:
        raise bad_request("Stop loss is inside broker stops level", field="slGc")
    if tp is not None and abs(tp - entry) < stops_level:
        raise bad_request("Take profit is inside broker stops level", field="tpGc")


def _enqueue_order_update(request: Request, order: OrderRecord) -> None:
    runtime = getattr(request.app.state, "runtime", None)
    if runtime is None:
        return
    try:
        runtime.registry.enqueue(
            OutboundEvent(
                event_type=EventType.ORDER_UPDATE,
                symbol=order.symbol_internal,
                payload={"type": "order_update", "symbol": order.symbol_internal, "order": order_to_dict(order)},
                key=order.id,
                user_id=order.user_id,
            )
        )
    except Exception:
        return
