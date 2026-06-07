"""MT5 account endpoints backed by the safe fake manager by default."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request

from ..config import settings as default_settings
from ..models.auth import AuthenticatedUser
from ..storage.cache_store import CacheStore
from .alerts import get_cache
from .auth import get_current_user
from .errors import bad_request, not_found

router = APIRouter(prefix="/api/mt5", tags=["mt5"])


def _runtime_manager(request: Request):
    runtime = getattr(request.app.state, "runtime", None)
    if runtime is not None:
        return runtime.mt5_manager
    manager = getattr(request.app.state, "mt5_manager", None)
    if manager is None:
        from ..mt5.manager import Mt5Manager

        manager = Mt5Manager()
        request.app.state.mt5_manager = manager
    return manager


@router.post("/connect")
async def connect_mt5(
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    try:
        body = await request.json()
    except Exception:
        raise bad_request("Request body must be valid JSON")
    if not isinstance(body, dict):
        raise bad_request("Request body must be a JSON object")
    login = body.get("login")
    password = body.get("password")
    server = body.get("server")
    symbol = body.get("symbolBroker", default_settings.default_broker_symbol)
    terminal = body.get("terminalPath")
    if not isinstance(login, int):
        raise bad_request("Missing or invalid field 'login'", field="login")
    if not isinstance(password, str) or not password:
        raise bad_request("Missing or invalid field 'password'", field="password")
    if not isinstance(server, str) or not server:
        raise bad_request("Missing or invalid field 'server'", field="server")
    if not isinstance(symbol, str) or not symbol:
        raise bad_request("Missing or invalid field 'symbolBroker'", field="symbolBroker")
    if terminal is not None and not isinstance(terminal, str):
        raise bad_request("'terminalPath' must be a string", field="terminalPath")

    key = default_settings.credential_key
    if key is None and default_settings.mt5_backend == "fake":
        key = "fake-local-development-key"
    if not key:
        raise bad_request("Missing NTTOTV_CREDENTIAL_KEY", field="credentialKey")
    account = cache.users.upsert_mt5_account(
        user_id=user.id,
        login=login,
        password=password,
        server=server,
        symbol_broker=symbol,
        terminal_path=terminal,
        credential_key=key,
        trade_mode="demo",
    )
    return {"account": _account_to_dict(account)}


@router.get("/status")
async def mt5_status(
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    account = cache.users.read_mt5_account(user.id)
    return {
        "connected": account is not None,
        "account": None if account is None else _account_to_dict(account),
    }


@router.get("/account")
async def mt5_account(
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    account = cache.users.read_mt5_account(user.id)
    if account is None:
        raise not_found("MT5 account is not connected", field="account")
    info = _runtime_manager(request).backend.account_info(user.id, account.id)
    return {
        "account": {
            "accountId": info.account_id,
            "login": account.login,
            "server": account.server,
            "tradeMode": info.trade_mode,
            "currency": info.currency,
            "balance": info.balance,
            "equity": info.equity,
            "margin": info.margin,
            "freeMargin": info.free_margin,
        }
    }


@router.get("/symbol")
async def mt5_symbol(
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    account = cache.users.read_mt5_account(user.id)
    if account is None:
        raise not_found("MT5 account is not connected", field="account")
    info = _runtime_manager(request).backend.symbol_info(
        user.id, account.id, account.symbol_broker
    )
    return {
        "symbol": {
            "symbol": info.symbol,
            "digits": info.digits,
            "tickSize": info.tick_size,
            "minLot": info.min_lot,
            "maxLot": info.max_lot,
            "lotStep": info.lot_step,
            "stopsLevel": info.stops_level,
            "pipValue": info.pip_value,
        }
    }


def _account_to_dict(account) -> dict[str, Any]:
    return {
        "accountId": account.id,
        "login": account.login,
        "server": account.server,
        "symbolBroker": account.symbol_broker,
        "tradeMode": account.trade_mode,
        "createdAt": account.created_at,
        "updatedAt": account.updated_at,
    }
