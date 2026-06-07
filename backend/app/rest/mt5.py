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

_AUTO_SYMBOL_SENTINELS = {"", "auto", "auto-detect", "autodetect", "detect"}
_BROKER_SYMBOL_CANDIDATES = ("XAUUSD", "XAUUSDm", "XAUUSDc")


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


def _credential_key(request: Request) -> str:
    try:
        return _runtime_manager(request).credential_key()
    except RuntimeError as exc:
        raise bad_request(str(exc), field="credentialKey")


def _verified_account_info(request: Request, cache: CacheStore, user, account):
    with _runtime_manager(request).account_session(cache, account) as backend:
        return backend.account_info(user.id, account.id)


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
    symbol_value = body.get("symbolBroker")
    terminal = body.get("terminalPath")
    if not isinstance(login, int):
        raise bad_request("Missing or invalid field 'login'", field="login")
    if not isinstance(password, str) or not password:
        raise bad_request("Missing or invalid field 'password'", field="password")
    if not isinstance(server, str) or not server:
        raise bad_request("Missing or invalid field 'server'", field="server")
    if terminal is not None and not isinstance(terminal, str):
        raise bad_request("'terminalPath' must be a string", field="terminalPath")
    requested_symbol = _requested_symbol(symbol_value)

    manager = _runtime_manager(request)
    try:
        with manager.backend_session() as backend:
            connector = getattr(backend, "connect_account", None)
            if callable(connector):
                connector(
                    login=login,
                    password=password,
                    server=server,
                    terminal_path=terminal,
                )
            info = backend.account_info(user.id, "pending")
            symbol = _resolve_broker_symbol(
                backend,
                user.id,
                "pending",
                requested_symbol,
                server=info.server or server,
            )
    except Exception as exc:
        raise bad_request(f"MT5 connect failed: {exc}", field="account")
    key = _credential_key(request)
    account = cache.users.upsert_mt5_account(
        user_id=user.id,
        login=login,
        password=password,
        server=server,
        symbol_broker=symbol,
        terminal_path=terminal,
        credential_key=key,
        trade_mode=info.trade_mode,
    )
    return {"account": _account_to_dict(account, info)}


def _requested_symbol(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise bad_request("'symbolBroker' must be a string", field="symbolBroker")
    symbol = value.strip()
    if symbol.lower() in _AUTO_SYMBOL_SENTINELS:
        return None
    return symbol


def _resolve_broker_symbol(
    backend,
    user_id: str,
    account_id: str,
    requested_symbol: str | None,
    *,
    server: str,
) -> str:
    if requested_symbol is not None:
        backend.symbol_info(user_id, account_id, requested_symbol)
        return requested_symbol

    tried: list[str] = []
    for candidate in _auto_symbol_candidates(server):
        tried.append(candidate)
        try:
            backend.symbol_info(user_id, account_id, candidate)
            return candidate
        except Exception:
            continue
    raise RuntimeError(
        "Could not auto-detect broker symbol; tried " + ", ".join(tried)
    )


def _auto_symbol_candidates(server: str) -> list[str]:
    server_lower = server.lower()
    if "cent" in server_lower:
        preferred = ["XAUUSDc", "XAUUSD", "XAUUSDm"]
    elif "trial" in server_lower:
        preferred = ["XAUUSDm", "XAUUSD", "XAUUSDc"]
    else:
        preferred = ["XAUUSD", "XAUUSDm", "XAUUSDc"]
    return _unique_symbols(
        [*preferred, default_settings.default_broker_symbol, *_BROKER_SYMBOL_CANDIDATES]
    )


def _unique_symbols(values: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for value in values:
        symbol = value.strip()
        if not symbol or symbol in seen:
            continue
        seen.add(symbol)
        out.append(symbol)
    return out


@router.get("/status")
async def mt5_status(
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    account = cache.users.read_mt5_account(user.id)
    if account is None:
        return {"connected": False, "account": None}
    try:
        with _runtime_manager(request).account_session(cache, account) as backend:
            info = backend.account_info(user.id, account.id)
            backend.symbol_info(user.id, account.id, account.symbol_broker)
    except Exception as exc:
        return {
            "connected": False,
            "account": _account_to_dict(account),
            "error": str(exc),
        }
    return {
        "connected": True,
        "account": _account_to_dict(account, info),
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
    try:
        info = _verified_account_info(request, cache, user, account)
    except Exception as exc:
        raise bad_request(f"MT5 connect failed: {exc}", field="account")
    return {"account": _account_to_dict(account, info)}


@router.get("/symbol")
async def mt5_symbol(
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    account = cache.users.read_mt5_account(user.id)
    if account is None:
        raise not_found("MT5 account is not connected", field="account")
    try:
        with _runtime_manager(request).account_session(cache, account) as backend:
            info = backend.symbol_info(user.id, account.id, account.symbol_broker)
    except Exception as exc:
        raise bad_request(f"MT5 connect failed: {exc}", field="account")
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


def _account_to_dict(account, info=None) -> dict[str, Any]:
    out = {
        "accountId": account.id,
        "login": account.login,
        "server": account.server,
        "symbolBroker": account.symbol_broker,
        "tradeMode": account.trade_mode,
        "createdAt": account.created_at,
        "updatedAt": account.updated_at,
    }
    if info is not None:
        out.update(
            {
                "login": info.login,
                "server": info.server or account.server,
                "tradeMode": info.trade_mode,
                "currency": info.currency,
                "balance": info.balance,
                "equity": info.equity,
                "margin": info.margin,
                "freeMargin": info.free_margin,
            }
        )
    return out
