"""REST controls for manual-position SuperTrend trailing exits."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request

from ..engines.bar_aggregator import SUPPORTED_TFS
from ..engines.manual_supertrend_trailing import (
    prime_supertrend_trailing,
    supertrend_trailing_activation_error,
    supertrend_trailing_to_dict,
)
from ..engines.supertrend import SupertrendConfig
from ..models.auth import AuthenticatedUser
from ..models.orders import OrderSource, OrderStatus
from ..models.supertrend_trailing import SupertrendTrailingRecord
from ..models.timestamp import now_ms
from ..mt5.manager import Mt5Manager
from ..storage.cache_store import CacheStore
from .alerts import get_cache
from .auth import get_current_user
from .errors import bad_request, conflict, not_found

router = APIRouter(prefix="/api/supertrend-trailing", tags=["orders"])


@router.get("")
async def list_supertrend_trailing(
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    return {
        "trailings": [
            supertrend_trailing_to_dict(record)
            for record in cache.supertrend_trailing.list_for_user(user.id)
        ]
    }


@router.put("/orders/{order_id}")
async def enable_order_supertrend_trailing(
    order_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    body = await _json_body(request)
    timeframe, config = _config(body)
    order = cache.orders.read(order_id, user.id)
    if order is None:
        raise not_found(f"Unknown order {order_id!r}", field="orderId")
    if order.source is OrderSource.AUTO_MGANN:
        raise conflict("SuperTrend trailing does not apply to Auto L/S orders", field="orderId")
    if (
        order.status not in {OrderStatus.FILLED, OrderStatus.SYNC_ERROR}
        or order.broker_position_ticket is None
    ):
        raise conflict("SuperTrend trailing requires an open position", field="orderId")
    account = cache.users.read_mt5_account(user.id)
    if account is None or account.id != order.account_id:
        raise not_found("MT5 account is not connected", field="account")
    _require_open_position(
        request,
        cache,
        account,
        order.broker_position_ticket,
    )
    current = cache.supertrend_trailing.read(user.id, "order", order.id)
    now = now_ms()
    record = SupertrendTrailingRecord(
        user_id=user.id,
        account_id=account.id,
        target_type="order",
        target_id=order.id,
        broker_position_ticket=order.broker_position_ticket,
        side=order.side.value,
        timeframe=timeframe,
        period=config.period,
        multiplier=config.multiplier,
        atr_method=config.atr_method,
        source=config.source,
        created_at=current.created_at if current is not None else now,
        updated_at=now,
    )
    activation_error = supertrend_trailing_activation_error(cache, record)
    if activation_error is not None:
        raise conflict(activation_error, field="supertrend")
    record = prime_supertrend_trailing(cache, record)
    cache.supertrend_trailing.upsert(record)
    return {"trailing": supertrend_trailing_to_dict(record)}


@router.delete("/orders/{order_id}")
async def disable_order_supertrend_trailing(
    order_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    cache.supertrend_trailing.delete_for_order(user.id, order_id)
    return {"disabled": True}


@router.put("/positions/{ticket}")
async def enable_position_supertrend_trailing(
    ticket: int,
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    body = await _json_body(request)
    timeframe, config = _config(body)
    account = cache.users.read_mt5_account(user.id)
    if account is None:
        raise not_found("MT5 account is not connected", field="account")

    # The raw-position route must not be usable to bypass the order-source
    # guard for an Auto L/S position.
    for order in cache.orders.list_open_for_account(user.id, account.id):
        if order.broker_position_ticket != ticket:
            continue
        if order.source is OrderSource.AUTO_MGANN:
            raise conflict(
                "SuperTrend trailing does not apply to Auto L/S orders",
                field="brokerPositionTicket",
            )
        raise conflict(
            "Use the app-order trailing target for this position",
            field="brokerPositionTicket",
        )

    row = _require_open_position(request, cache, account, ticket)
    side = _position_side(row)
    current = cache.supertrend_trailing.read(user.id, "position", str(ticket))
    now = now_ms()
    record = SupertrendTrailingRecord(
        user_id=user.id,
        account_id=account.id,
        target_type="position",
        target_id=str(ticket),
        broker_position_ticket=ticket,
        side=side,
        timeframe=timeframe,
        period=config.period,
        multiplier=config.multiplier,
        atr_method=config.atr_method,
        source=config.source,
        created_at=current.created_at if current is not None else now,
        updated_at=now,
    )
    activation_error = supertrend_trailing_activation_error(cache, record)
    if activation_error is not None:
        raise conflict(activation_error, field="supertrend")
    record = prime_supertrend_trailing(cache, record)
    cache.supertrend_trailing.upsert(record)
    return {"trailing": supertrend_trailing_to_dict(record)}


@router.delete("/positions/{ticket}")
async def disable_position_supertrend_trailing(
    ticket: int,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    cache.supertrend_trailing.delete_for_position(user.id, ticket)
    return {"disabled": True}


def _manager(request: Request) -> Mt5Manager:
    runtime = getattr(request.app.state, "runtime", None)
    if runtime is not None:
        return runtime.mt5_manager
    manager = getattr(request.app.state, "mt5_manager", None)
    if manager is None:
        manager = Mt5Manager()
        request.app.state.mt5_manager = manager
    return manager


def _require_open_position(request, cache, account, ticket: int) -> dict:
    try:
        with _manager(request).account_session(cache, account) as backend:
            rows = backend.positions(account.user_id, account.id)
    except Exception as exc:
        raise conflict(f"MT5 position lookup failed: {exc}", field="account")
    for row in rows:
        if int(row.get("ticket") or 0) != int(ticket):
            continue
        symbol = row.get("symbol")
        if not symbol or symbol == account.symbol_broker:
            return row
    raise not_found("MT5 position is no longer open", field="brokerPositionTicket")


def _position_side(row: dict) -> str:
    side = row.get("side")
    if side in {"buy", "sell"}:
        return str(side)
    type_code = int(row.get("type") if row.get("type") is not None else -1)
    if type_code in {0, 2, 4, 6}:
        return "buy"
    if type_code in {1, 3, 5, 7}:
        return "sell"
    raise bad_request("MT5 position has unknown side", field="side")


def _config(body: dict[str, Any]) -> tuple[str, SupertrendConfig]:
    timeframe = str(body.get("timeframe") or "")
    if timeframe not in SUPPORTED_TFS:
        raise bad_request("Unsupported trailing timeframe", field="timeframe")
    period = body.get("period")
    if isinstance(period, bool) or not isinstance(period, int):
        raise bad_request("period must be an integer", field="period")
    try:
        multiplier = float(body.get("multiplier"))
    except (TypeError, ValueError):
        raise bad_request("multiplier must be a number", field="multiplier")
    try:
        config = SupertrendConfig(
            period=period,
            multiplier=multiplier,
            atr_method=str(body.get("atrMethod") or ""),
            source=str(body.get("source") or ""),
        )
    except ValueError as exc:
        raise bad_request(str(exc), field="supertrend")
    return timeframe, config


async def _json_body(request: Request) -> dict[str, Any]:
    try:
        body = await request.json()
    except Exception:
        raise bad_request("Request body must be valid JSON")
    if not isinstance(body, dict):
        raise bad_request("Request body must be a JSON object")
    return body
