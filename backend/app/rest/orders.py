"""Order-on-chart REST API."""

from __future__ import annotations

from dataclasses import replace
import secrets
from typing import Any

from fastapi import APIRouter, Depends, Request

from ..config import settings as default_settings
from ..engines.basis_engine import BasisEngine
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
from .errors import bad_request, conflict, not_found
from .routes import get_contract_state

router = APIRouter(prefix="/api/orders", tags=["orders"])


def _manager(request: Request) -> Mt5Manager:
    runtime = getattr(request.app.state, "runtime", None)
    if runtime is not None:
        return runtime.mt5_manager
    manager = getattr(request.app.state, "mt5_manager", None)
    if manager is None:
        manager = Mt5Manager()
        request.app.state.mt5_manager = manager
    return manager


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
    openOnly: bool = False,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
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

    mt5 = _manager(request).backend
    symbol_info = mt5.symbol_info(user.id, account.id, account.symbol_broker)
    symbol_map = SymbolMap.from_info(symbol_info)
    _guard_trading(account.trade_mode)
    _guard_volume(volume, symbol_info.min_lot, symbol_info.max_lot, symbol_info.lot_step)

    basis = _basis(request)
    tick = mt5.symbol_tick(user.id, account.id, account.symbol_broker)
    basis.update_broker_mid((tick.bid + tick.ask) / 2, tick.time)

    entry_gc = _optional_number(body, "entryGc")
    sl_gc = _optional_number(body, "slGc")
    tp_gc = _optional_number(body, "tpGc")
    if kind is not OrderKind.MARKET and entry_gc is None:
        raise bad_request("'entryGc' is required for pending orders", field="entryGc")
    if kind is OrderKind.MARKET and entry_gc is None:
        snap = basis.from_broker(tick.ask if side is OrderSide.BUY else tick.bid, symbol_map)
        entry_gc = snap.price
    if sl_gc is None and "slDistanceGc" in body:
        distance = _required_number(body, "slDistanceGc")
        sl_gc = entry_gc - distance if side is OrderSide.BUY else entry_gc + distance
    if tp_gc is None and "tpDistanceGc" in body:
        distance = _required_number(body, "tpDistanceGc")
        tp_gc = entry_gc + distance if side is OrderSide.BUY else entry_gc - distance

    entry_broker = None if entry_gc is None else basis.to_broker(entry_gc, symbol_map)
    sl_broker = None if sl_gc is None else basis.to_broker(sl_gc, symbol_map)
    tp_broker = None if tp_gc is None else basis.to_broker(tp_gc, symbol_map)
    if any(c is not None and c.stale for c in (entry_broker, sl_broker, tp_broker)):
        raise conflict("GC/XAU basis is stale; trading is paused", field="basis")
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

    result = mt5.place_order(order)
    order.submitted_at = now_ms()
    order.updated_at = order.submitted_at
    if result.accepted:
        order.status = OrderStatus(result.status)
        order.broker_order_ticket = result.broker_order_ticket
        order.broker_position_ticket = result.broker_position_ticket
        order.broker_deal_ticket = result.broker_deal_ticket
        order.fill_price_broker = result.fill_price
        if result.fill_price is not None:
            order.fill_price_gc_estimate = basis.from_broker(result.fill_price, symbol_map).price
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
    mt5 = _manager(request).backend
    symbol_info = mt5.symbol_info(user.id, account.id, account.symbol_broker)
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
    result = mt5.modify_order(candidate)
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
    result = _manager(request).backend.cancel_order(order)
    if not result.accepted:
        raise conflict(result.error_message or "Broker rejected cancellation")
    order.status = OrderStatus.CANCELLED
    order.updated_at = now_ms()
    cache.orders.update(order)
    cache.orders.append_event(OrderEventRecord(order.id, user.id, "cancelled", {}, now_ms()))
    _enqueue_order_update(request, order)
    return {"order": order_to_dict(order)}


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
    result = _manager(request).backend.close_position(order)
    if not result.accepted:
        raise conflict(result.error_message or "Broker rejected close")
    order.status = OrderStatus.CLOSED
    order.broker_deal_ticket = result.broker_deal_ticket or order.broker_deal_ticket
    order.closed_at = now_ms()
    order.updated_at = order.closed_at
    cache.orders.update(order)
    cache.orders.append_event(OrderEventRecord(order.id, user.id, "closed", {}, now_ms()))
    _enqueue_order_update(request, order)
    return {"order": order_to_dict(order)}


async def _json_body(request: Request) -> dict[str, Any]:
    try:
        body = await request.json()
    except Exception:
        raise bad_request("Request body must be valid JSON")
    if not isinstance(body, dict):
        raise bad_request("Request body must be a JSON object")
    return body


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
