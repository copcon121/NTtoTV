"""MT5 account endpoints backed by the safe fake manager by default."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, Request

from ..config import settings as default_settings
from ..engines.basis_engine import BasisEngine
from ..engines.symbol_map import SymbolMap
from ..models.auth import AuthenticatedUser
from ..models.orders import OrderKind, OrderRecord, OrderSide, OrderSource, OrderStatus
from ..models.timestamp import now_ms
from ..storage.cache_store import CacheStore
from .alerts import get_cache
from .auth import get_current_user
from .errors import ApiError, bad_request, conflict, not_found

router = APIRouter(prefix="/api/mt5", tags=["mt5"])

_AUTO_SYMBOL_SENTINELS = {"", "auto", "auto-detect", "autodetect", "detect"}
_BROKER_SYMBOL_CANDIDATES = ("XAUUSD", "XAUUSDm", "XAUUSDc")


@router.get("/terminals")
async def mt5_terminals(
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user),
) -> dict[str, Any]:
    """Detect running MT5 terminal processes on this machine."""
    terminals = await asyncio.to_thread(_detect_terminals)
    return {"terminals": terminals}


def _detect_terminals() -> list[dict[str, Any]]:
    import json as _json
    import subprocess as _sp

    try:
        result = _sp.run(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "Get-Process terminal64 -ErrorAction SilentlyContinue "
                "| Select-Object Id, Path, MainWindowTitle "
                "| ConvertTo-Json -Compress",
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode != 0 or not result.stdout.strip():
            return []
    except Exception:
        return []
    try:
        data = _json.loads(result.stdout)
    except (ValueError, _json.JSONDecodeError):
        return []
    # PowerShell returns a single object (not array) when there is only one
    # matching process.
    if isinstance(data, dict):
        data = [data]
    if not isinstance(data, list):
        return []
    out: list[dict[str, Any]] = []
    for entry in data:
        path = str(entry.get("Path") or "")
        title = str(entry.get("MainWindowTitle") or "")
        login = _parse_login_from_title(title)
        server = _parse_server_from_title(title)
        if not path:
            continue
        out.append({"path": path, "login": login, "server": server, "title": title})
    return out


def _parse_login_from_title(title: str) -> int | None:
    """Extract login from ``'NNN - Server - ...'`` window title."""
    if not title:
        return None
    part = title.split(" - ", 1)[0].strip()
    try:
        return int(part)
    except (ValueError, IndexError):
        return None


def _parse_server_from_title(title: str) -> str | None:
    """Extract server from ``'NNN - Server - ...'`` window title."""
    if not title:
        return None
    parts = title.split(" - ")
    if len(parts) >= 2:
        server = parts[1].strip()
        return server if server else None
    return None


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


def _basis(request: Request) -> BasisEngine:
    runtime = getattr(request.app.state, "runtime", None)
    if runtime is not None:
        return runtime.basis_engine
    basis = getattr(request.app.state, "basis_engine", None)
    if basis is None:
        basis = BasisEngine()
        request.app.state.basis_engine = basis
    return basis


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

    def _blocking_connect():
        connect_session = getattr(manager, "connect_account_session", None)
        if callable(connect_session):
            session = connect_session(
                login=login,
                password=password,
                server=server,
                terminal_path=terminal,
            )
        else:
            session = manager.backend_session()
        with session as backend:
            if not callable(connect_session):
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
        return info, symbol

    try:
        info, symbol = await asyncio.to_thread(_blocking_connect)
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


@router.get("/open-trades")
async def mt5_open_trades(
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    account = cache.users.read_mt5_account(user.id)
    if account is None:
        raise not_found("MT5 account is not connected", field="account")
    basis = _basis(request)
    manager = _runtime_manager(request)

    def _blocking():
        with manager.account_session(cache, account) as backend:
            symbol_info = backend.symbol_info(user.id, account.id, account.symbol_broker)
            symbol_map = SymbolMap.from_info(symbol_info)
            _refresh_basis_from_broker_tick(
                basis,
                backend,
                user.id,
                account.id,
                account.symbol_broker,
            )
            positions = [
                _position_to_dict(row, basis, symbol_map, account.symbol_broker)
                for row in backend.positions(user.id, account.id)
                if _matches_symbol(row, account.symbol_broker)
            ]
            orders = [
                _pending_order_to_dict(row, basis, symbol_map, account.symbol_broker)
                for row in backend.orders(user.id, account.id)
                if _matches_symbol(row, account.symbol_broker)
            ]
        return positions, orders

    try:
        positions, orders = await asyncio.to_thread(_blocking)
    except ApiError:
        raise
    except Exception as exc:
        raise bad_request(f"MT5 open trades failed: {exc}", field="account")
    return {"positions": positions, "orders": orders}


@router.post("/positions/{ticket}/close")
async def mt5_close_position(
    ticket: int,
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    account = cache.users.read_mt5_account(user.id)
    if account is None:
        raise not_found("MT5 account is not connected", field="account")
    manager = _runtime_manager(request)

    def _blocking():
        with manager.account_session(cache, account) as backend:
            row = _find_ticket(
                backend.positions(user.id, account.id),
                ticket,
                account.symbol_broker,
                field="brokerPositionTicket",
            )
            order = _order_from_position_row(row, user.id, account.id, account.symbol_broker)
            return backend.close_position(order)

    try:
        result = await asyncio.to_thread(_blocking)
    except ApiError:
        raise
    except Exception as exc:
        raise conflict(f"MT5 close failed: {exc}", field="account")
    if not result.accepted:
        raise conflict(result.error_message or "Broker rejected close", field="brokerPositionTicket")
    return {"brokerPositionTicket": ticket, "closed": True}


@router.patch("/positions/{ticket}")
async def mt5_patch_position(
    ticket: int,
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    body = await _json_body(request)
    account = cache.users.read_mt5_account(user.id)
    if account is None:
        raise not_found("MT5 account is not connected", field="account")
    basis = _basis(request)
    try:
        with _runtime_manager(request).account_session(cache, account) as backend:
            symbol_info = backend.symbol_info(user.id, account.id, account.symbol_broker)
            symbol_map = SymbolMap.from_info(symbol_info)
            _refresh_basis_from_broker_tick(
                basis,
                backend,
                user.id,
                account.id,
                account.symbol_broker,
            )
            row = _find_ticket(
                backend.positions(user.id, account.id),
                ticket,
                account.symbol_broker,
                field="brokerPositionTicket",
            )
            order = _order_from_position_row(row, user.id, account.id, account.symbol_broker)
            if "slGc" in body:
                order.sl_broker = _nullable_gc_to_broker(body, "slGc", basis, symbol_map)
            if "tpGc" in body:
                order.tp_broker = _nullable_gc_to_broker(body, "tpGc", basis, symbol_map)
            result = backend.modify_order(order)
            updated = _find_ticket(
                backend.positions(user.id, account.id),
                ticket,
                account.symbol_broker,
                field="brokerPositionTicket",
                required=False,
            )
    except ApiError:
        raise
    except Exception as exc:
        raise conflict(f"MT5 position modify failed: {exc}", field="account")
    if not result.accepted:
        raise conflict(result.error_message or "Broker rejected modification", field="brokerPositionTicket")
    return {
        "position": _position_to_dict(
            updated or _position_row_from_order(order),
            basis,
            symbol_map,
            account.symbol_broker,
        )
    }


@router.delete("/orders/{ticket}")
async def mt5_cancel_order(
    ticket: int,
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    account = cache.users.read_mt5_account(user.id)
    if account is None:
        raise not_found("MT5 account is not connected", field="account")
    try:
        with _runtime_manager(request).account_session(cache, account) as backend:
            row = _find_ticket(
                backend.orders(user.id, account.id),
                ticket,
                account.symbol_broker,
                field="brokerOrderTicket",
            )
            order = _order_from_pending_row(row, user.id, account.id, account.symbol_broker)
            result = backend.cancel_order(order)
    except ApiError:
        raise
    except Exception as exc:
        raise conflict(f"MT5 cancel failed: {exc}", field="account")
    if not result.accepted:
        raise conflict(result.error_message or "Broker rejected cancellation", field="brokerOrderTicket")
    return {"brokerOrderTicket": ticket, "cancelled": True}


@router.patch("/orders/{ticket}")
async def mt5_patch_order(
    ticket: int,
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    body = await _json_body(request)
    account = cache.users.read_mt5_account(user.id)
    if account is None:
        raise not_found("MT5 account is not connected", field="account")
    basis = _basis(request)
    try:
        with _runtime_manager(request).account_session(cache, account) as backend:
            symbol_info = backend.symbol_info(user.id, account.id, account.symbol_broker)
            symbol_map = SymbolMap.from_info(symbol_info)
            _refresh_basis_from_broker_tick(
                basis,
                backend,
                user.id,
                account.id,
                account.symbol_broker,
            )
            row = _find_ticket(
                backend.orders(user.id, account.id),
                ticket,
                account.symbol_broker,
                field="brokerOrderTicket",
            )
            order = _order_from_pending_row(row, user.id, account.id, account.symbol_broker)
            if "entryGc" in body:
                entry = _number_or_bad_request(body, "entryGc")
                if entry is None:
                    raise bad_request("'entryGc' cannot be null for pending orders", field="entryGc")
                order.entry_broker = _gc_to_broker(entry, basis, symbol_map)
            if "slGc" in body:
                order.sl_broker = _nullable_gc_to_broker(body, "slGc", basis, symbol_map)
            if "tpGc" in body:
                order.tp_broker = _nullable_gc_to_broker(body, "tpGc", basis, symbol_map)
            result = backend.modify_order(order)
            updated = _find_ticket(
                backend.orders(user.id, account.id),
                ticket,
                account.symbol_broker,
                field="brokerOrderTicket",
                required=False,
            )
    except ApiError:
        raise
    except Exception as exc:
        raise conflict(f"MT5 order modify failed: {exc}", field="account")
    if not result.accepted:
        raise conflict(result.error_message or "Broker rejected modification", field="brokerOrderTicket")
    return {
        "order": _pending_order_to_dict(
            updated or _pending_row_from_order(order),
            basis,
            symbol_map,
            account.symbol_broker,
        )
    }


@router.get("/status")
async def mt5_status(
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    account = cache.users.read_mt5_account(user.id)
    if account is None:
        return {"connected": False, "account": None}
    manager = _runtime_manager(request)

    def _blocking():
        with manager.account_session(cache, account) as backend:
            info = backend.account_info(user.id, account.id)
            backend.symbol_info(user.id, account.id, account.symbol_broker)
        return info

    try:
        info = await asyncio.to_thread(_blocking)
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
        info = await asyncio.to_thread(_verified_account_info, request, cache, user, account)
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
    manager = _runtime_manager(request)

    def _blocking():
        with manager.account_session(cache, account) as backend:
            return backend.symbol_info(user.id, account.id, account.symbol_broker)

    try:
        info = await asyncio.to_thread(_blocking)
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


async def _json_body(request: Request) -> dict[str, Any]:
    try:
        body = await request.json()
    except Exception:
        raise bad_request("Request body must be valid JSON")
    if not isinstance(body, dict):
        raise bad_request("Request body must be a JSON object")
    return body


def _refresh_basis_from_broker_tick(
    basis: BasisEngine,
    backend,
    user_id: str,
    account_id: str,
    symbol_broker: str,
) -> None:
    tick = backend.symbol_tick(user_id, account_id, symbol_broker)
    basis.update_broker_mid((tick.bid + tick.ask) / 2, tick.time)


def _matches_symbol(row: dict[str, Any], symbol_broker: str) -> bool:
    symbol = row.get("symbol")
    return not symbol or symbol == symbol_broker


def _find_ticket(
    rows: list[dict[str, Any]],
    ticket: int,
    symbol_broker: str,
    *,
    field: str,
    required: bool = True,
) -> dict[str, Any] | None:
    for row in rows:
        if int(row.get("ticket") or 0) == int(ticket) and _matches_symbol(row, symbol_broker):
            return row
    if required:
        raise not_found(f"Unknown MT5 {field} {ticket}", field=field)
    return None


def _number_or_bad_request(body: dict[str, Any], field: str) -> float | None:
    value = body.get(field)
    if value is None:
        return None
    if not isinstance(value, (int, float)):
        raise bad_request(f"Field {field!r} must be a number", field=field)
    return float(value)


def _gc_to_broker(value: float, basis: BasisEngine, symbol: SymbolMap) -> float:
    converted = basis.to_broker(value, symbol)
    if converted.stale:
        raise conflict("GC/XAU basis is stale; trading is paused", field="basis")
    return converted.price


def _nullable_gc_to_broker(
    body: dict[str, Any],
    field: str,
    basis: BasisEngine,
    symbol: SymbolMap,
) -> float | None:
    value = _number_or_bad_request(body, field)
    return None if value is None else _gc_to_broker(value, basis, symbol)


def _broker_to_gc(
    value: Any,
    basis: BasisEngine,
    symbol: SymbolMap,
) -> float | None:
    if not isinstance(value, (int, float)):
        return None
    numeric = float(value)
    if numeric == 0:
        return None
    return basis.from_broker(numeric, symbol).price


def _basis_stale(basis: BasisEngine) -> bool:
    return basis.snapshot().stale


def _position_to_dict(
    row: dict[str, Any],
    basis: BasisEngine,
    symbol: SymbolMap,
    symbol_broker: str,
) -> dict[str, Any]:
    ticket = int(row.get("ticket") or 0)
    return {
        "brokerPositionTicket": ticket,
        "orderId": row.get("orderId"),
        "symbolBroker": row.get("symbol") or symbol_broker,
        "side": _row_side(row),
        "volumeLots": float(row.get("volumeLots") or 0.0),
        "entryBroker": float(row.get("entryBroker") or 0.0),
        "entryGcEstimate": _broker_to_gc(row.get("entryBroker"), basis, symbol),
        "slBroker": _zero_to_none(row.get("slBroker")),
        "tpBroker": _zero_to_none(row.get("tpBroker")),
        "slGc": _broker_to_gc(row.get("slBroker"), basis, symbol),
        "tpGc": _broker_to_gc(row.get("tpBroker"), basis, symbol),
        "profit": row.get("profit"),
        "basisStale": _basis_stale(basis),
        "updatedAt": int(row.get("time") or now_ms()),
    }


def _pending_order_to_dict(
    row: dict[str, Any],
    basis: BasisEngine,
    symbol: SymbolMap,
    symbol_broker: str,
) -> dict[str, Any]:
    ticket = int(row.get("ticket") or 0)
    return {
        "brokerOrderTicket": ticket,
        "orderId": row.get("orderId"),
        "symbolBroker": row.get("symbol") or symbol_broker,
        "side": _row_side(row),
        "kind": _row_kind(row),
        "volumeLots": float(row.get("volumeLots") or 0.0),
        "entryBroker": float(row.get("entryBroker") or 0.0),
        "entryGc": _broker_to_gc(row.get("entryBroker"), basis, symbol),
        "slBroker": _zero_to_none(row.get("slBroker")),
        "tpBroker": _zero_to_none(row.get("tpBroker")),
        "slGc": _broker_to_gc(row.get("slBroker"), basis, symbol),
        "tpGc": _broker_to_gc(row.get("tpBroker"), basis, symbol),
        "basisStale": _basis_stale(basis),
        "updatedAt": int(row.get("time") or now_ms()),
    }


def _row_side(row: dict[str, Any]) -> str:
    side = row.get("side")
    if side in (OrderSide.BUY.value, OrderSide.SELL.value):
        return side
    type_code = int(row.get("type") if row.get("type") is not None else -1)
    if type_code in (0, 2, 4, 6):
        return OrderSide.BUY.value
    if type_code in (1, 3, 5, 7):
        return OrderSide.SELL.value
    raise bad_request("MT5 ticket has unknown side", field="side")


def _row_kind(row: dict[str, Any]) -> str:
    kind = row.get("kind")
    if kind in (OrderKind.LIMIT.value, OrderKind.STOP.value):
        return kind
    type_code = int(row.get("type") if row.get("type") is not None else -1)
    if type_code in (2, 3):
        return OrderKind.LIMIT.value
    if type_code in (4, 5, 6, 7):
        return OrderKind.STOP.value
    raise bad_request("MT5 ticket has unknown pending order type", field="kind")


def _zero_to_none(value: Any) -> float | None:
    if not isinstance(value, (int, float)):
        return None
    numeric = float(value)
    return None if numeric == 0 else numeric


def _order_from_position_row(
    row: dict[str, Any],
    user_id: str,
    account_id: str,
    symbol_broker: str,
) -> OrderRecord:
    ticket = int(row.get("ticket") or 0)
    return OrderRecord(
        id=f"mt5pos_{ticket}",
        user_id=user_id,
        account_id=account_id,
        source=OrderSource.API,
        symbol_internal="GC",
        contract_internal="GC",
        source_contract=None,
        symbol_broker=symbol_broker,
        side=OrderSide(_row_side(row)),
        kind=OrderKind.MARKET,
        volume_lots=float(row.get("volumeLots") or 0.0),
        gc_anchored=True,
        status=OrderStatus.FILLED,
        idempotency_key=f"manual-position-{ticket}",
        created_at=int(row.get("time") or now_ms()),
        updated_at=now_ms(),
        entry_broker=_zero_to_none(row.get("entryBroker")),
        sl_broker=_zero_to_none(row.get("slBroker")),
        tp_broker=_zero_to_none(row.get("tpBroker")),
        broker_position_ticket=ticket,
    )


def _order_from_pending_row(
    row: dict[str, Any],
    user_id: str,
    account_id: str,
    symbol_broker: str,
) -> OrderRecord:
    ticket = int(row.get("ticket") or 0)
    return OrderRecord(
        id=f"mt5order_{ticket}",
        user_id=user_id,
        account_id=account_id,
        source=OrderSource.API,
        symbol_internal="GC",
        contract_internal="GC",
        source_contract=None,
        symbol_broker=symbol_broker,
        side=OrderSide(_row_side(row)),
        kind=OrderKind(_row_kind(row)),
        volume_lots=float(row.get("volumeLots") or 0.0),
        gc_anchored=True,
        status=OrderStatus.WORKING,
        idempotency_key=f"manual-order-{ticket}",
        created_at=int(row.get("time") or now_ms()),
        updated_at=now_ms(),
        entry_broker=_zero_to_none(row.get("entryBroker")),
        sl_broker=_zero_to_none(row.get("slBroker")),
        tp_broker=_zero_to_none(row.get("tpBroker")),
        broker_order_ticket=ticket,
    )


def _position_row_from_order(order: OrderRecord) -> dict[str, Any]:
    return {
        "ticket": order.broker_position_ticket,
        "symbol": order.symbol_broker,
        "side": order.side.value,
        "volumeLots": order.volume_lots,
        "entryBroker": order.entry_broker,
        "slBroker": order.sl_broker,
        "tpBroker": order.tp_broker,
        "time": order.updated_at,
    }


def _pending_row_from_order(order: OrderRecord) -> dict[str, Any]:
    return {
        "ticket": order.broker_order_ticket,
        "symbol": order.symbol_broker,
        "side": order.side.value,
        "kind": order.kind.value,
        "volumeLots": order.volume_lots,
        "entryBroker": order.entry_broker,
        "slBroker": order.sl_broker,
        "tpBroker": order.tp_broker,
        "time": order.updated_at,
    }


def _account_to_dict(account, info=None) -> dict[str, Any]:
    out = {
        "accountId": account.id,
        "login": account.login,
        "server": account.server,
        "symbolBroker": account.symbol_broker,
        "terminalPath": getattr(account, "terminal_path", None),
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
