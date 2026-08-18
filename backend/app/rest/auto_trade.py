"""Authenticated controls for server-side mGann automatic trading."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request

from ..config import settings as default_settings
from ..models.auto_trade import AutoTradeSettingsRecord
from ..models.auth import AuthenticatedUser
from ..models.timestamp import now_ms
from ..mt5.manager import Mt5Manager
from ..storage.cache_store import CacheStore
from .alerts import get_cache
from .auth import get_current_user
from .errors import bad_request, conflict, not_found

router = APIRouter(prefix="/api/auto-trade", tags=["auto-trade"])

_DEFAULT_VOLUME_LOTS = 0.1


def _manager(request: Request) -> Mt5Manager:
    runtime = getattr(request.app.state, "runtime", None)
    if runtime is not None:
        return runtime.mt5_manager
    manager = getattr(request.app.state, "mt5_manager", None)
    if manager is None:
        manager = Mt5Manager()
        request.app.state.mt5_manager = manager
    return manager


def _settings(request: Request):
    runtime = getattr(request.app.state, "runtime", None)
    return getattr(runtime, "settings", getattr(request.app.state, "settings", default_settings))


@router.get("")
async def get_auto_trade_settings(
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    settings = cache.auto_trade.read(user.id) or AutoTradeSettingsRecord(
        user_id=user.id,
        volume_lots=_DEFAULT_VOLUME_LOTS,
    )
    return {"settings": _to_dict(settings)}


@router.put("")
async def update_auto_trade_settings(
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    body = await _json_body(request)
    current = cache.auto_trade.read(user.id) or AutoTradeSettingsRecord(
        user_id=user.id,
        volume_lots=_DEFAULT_VOLUME_LOTS,
    )
    long_enabled = _boolean(body, "longEnabled", current.long_enabled)
    short_enabled = _boolean(body, "shortEnabled", current.short_enabled)
    volume_lots = _number(body, "volumeLots", current.volume_lots)
    if volume_lots < 0.01:
        raise bad_request("volumeLots must be at least 0.01", field="volumeLots")

    # Enabling can lead directly to a live market order, so validate the exact
    # connected account, terminal trading flags, and broker lot increment now.
    if long_enabled or short_enabled:
        account = cache.users.read_mt5_account(user.id)
        if account is None:
            raise not_found("MT5 account is not connected", field="account")
        settings = _settings(request)
        if settings.mt5_backend != "fake" and not settings.trading_enabled:
            raise conflict("Trading is disabled", field="trading")
        if account.trade_mode == "live" and not settings.live_trading_enabled:
            raise conflict("Live trading is disabled", field="trading")
        try:
            with _manager(request).account_session(cache, account) as backend:
                info = backend.symbol_info(user.id, account.id, account.symbol_broker)
        except Exception as exc:
            raise conflict(f"MT5 connect failed: {exc}", field="account")
        if not _valid_lot(volume_lots, info.min_lot, info.max_lot, info.lot_step):
            raise bad_request("Volume is outside broker limits or lot step", field="volumeLots")

    settings = cache.auto_trade.upsert(
        AutoTradeSettingsRecord(
            user_id=user.id,
            long_enabled=long_enabled,
            short_enabled=short_enabled,
            volume_lots=volume_lots,
            updated_at=now_ms(),
        )
    )
    return {"settings": _to_dict(settings)}


async def _json_body(request: Request) -> dict[str, Any]:
    try:
        body = await request.json()
    except Exception:
        raise bad_request("Request body must be valid JSON")
    if not isinstance(body, dict):
        raise bad_request("Request body must be a JSON object")
    return body


def _boolean(body: dict[str, Any], field: str, fallback: bool) -> bool:
    value = body.get(field, fallback)
    if not isinstance(value, bool):
        raise bad_request(f"Field {field!r} must be boolean", field=field)
    return value


def _number(body: dict[str, Any], field: str, fallback: float) -> float:
    value = body.get(field, fallback)
    if not isinstance(value, (int, float)):
        raise bad_request(f"Field {field!r} must be a number", field=field)
    value = float(value)
    if value != value or value in (float("inf"), float("-inf")):
        raise bad_request(f"Field {field!r} must be finite", field=field)
    return value


def _valid_lot(volume: float, min_lot: float, max_lot: float, step: float) -> bool:
    if volume < min_lot or volume > max_lot:
        return False
    steps = round((volume - min_lot) / step)
    return abs(min_lot + steps * step - volume) <= 1e-9


def _to_dict(settings: AutoTradeSettingsRecord) -> dict[str, Any]:
    return {
        "longEnabled": settings.long_enabled,
        "shortEnabled": settings.short_enabled,
        "volumeLots": settings.volume_lots,
        "updatedAt": settings.updated_at,
    }
