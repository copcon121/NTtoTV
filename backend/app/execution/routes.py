"""Same-origin, authenticated execution API. Secrets are accepted only on connect."""

from __future__ import annotations

import json
import time
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from ..config import settings
from ..rest.alerts import get_cache
from ..rest.auth import get_current_user
from .client import ExecutionError, uint64
from .service import ExecutionService

router = APIRouter(tags=["execution"])


def get_execution(request: Request, cache=Depends(get_cache)) -> ExecutionService:
    service = getattr(request.app.state, "execution_service", None)
    if service is None:
        service = ExecutionService(cache, settings)
        request.app.state.execution_service = service
    return service


async def body(request: Request):
    origin = request.headers.get("origin")
    if origin and urlsplit(origin).netloc != request.url.netloc:
        raise ExecutionError("FORBIDDEN", "Cross-origin execution is not allowed", 403)
    if request.headers.get("sec-fetch-site") == "cross-site":
        raise ExecutionError("FORBIDDEN", "Cross-site execution is not allowed", 403)
    raw = await request.body()
    if len(raw) > 16 * 1024:
        raise ExecutionError("BAD_REQUEST", "Execution request is too large", 413)
    try:
        result = json.loads(raw) if raw else {}
        if not isinstance(result, dict):
            raise ValueError()
        return result
    except (ValueError, TypeError):
        raise ExecutionError("BAD_REQUEST", "Request must be a JSON object", 400) from None


@router.get("/api/execution")
async def capability():
    return dict(enabled=True, mode="exness", profiles=[], perProfile=True)


@router.post("/api/execution/connect")
async def connect(request: Request, user=Depends(get_current_user), service=Depends(get_execution)):
    payload = await body(request)
    # Rate-limit expensive connection/key verification without retaining key inputs.
    attempts = getattr(request.app.state, "execution_connect_attempts", {})
    request.app.state.execution_connect_attempts = attempts
    now = time.monotonic()
    recent = [at for at in attempts.get(user.id, []) if now-at < 60]
    if len(recent) >= 5:
        raise ExecutionError("REQUEST_RATE_LIMIT", "Wait before another connection attempt", 429)
    attempts[user.id] = recent+[now]
    account = await service.connect(user.id, payload)
    return {"account": account, "symbol": service.symbol(user.id)}


@router.get("/api/execution/status")
async def status(user=Depends(get_current_user), service=Depends(get_execution)):
    account = service.account(user.id)
    return dict(connected=bool(account and account.get("connected")), account=account,
                error=account.get("error") if account else None)


@router.post("/api/execution/acknowledge-uncertain")
async def acknowledge_uncertain(request: Request, user=Depends(get_current_user), service=Depends(get_execution)):
    payload = await body(request)
    if not isinstance(payload.get("key"), str):
        raise ExecutionError("BAD_REQUEST", "Operation key is required", 400)
    return {"account": await service.acknowledge_uncertain(user.id, payload["key"])}


@router.get("/api/execution/operations/{identifier}")
async def get_operation(identifier: str, user=Depends(get_current_user), service=Depends(get_execution)):
    return {"operation": service.get_operation(user.id, identifier)}


@router.get("/api/execution/account")
async def account(user=Depends(get_current_user), service=Depends(get_execution)):
    return {"account": service.account(user.id)}


@router.get("/api/execution/symbol")
async def symbol(user=Depends(get_current_user), service=Depends(get_execution)):
    return {"symbol": service.symbol(user.id)}


@router.get("/api/execution/open-trades")
async def open_trades(user=Depends(get_current_user), service=Depends(get_execution)):
    return service.open_trades(user.id)


@router.get("/api/execution/state")
async def state(user=Depends(get_current_user), service=Depends(get_execution)):
    session = service.sessions.get(user.id)
    trades = service.open_trades(user.id)
    return dict(account=service.account(user.id), trades=trades,
                orders=service.orders(user.id, trades=trades) if session else [],
                trailings=service.store.trailings(user.id), actionError=session.action_error if session else None)


@router.post("/api/execution/positions/{ticket}/close")
async def close_position(ticket: str, request: Request, user=Depends(get_current_user), service=Depends(get_execution)):
    payload = await body(request)
    return await service.close(user.id, position_id=uint64(ticket), volume=payload.get("volumeLots"),
                               close_fifty_percent=bool(payload.get("closeFiftyPercent")),
                               key=payload.get("idempotencyKey"))


@router.patch("/api/execution/positions/{ticket}", status_code=202)
async def patch_position(ticket: str, request: Request, user=Depends(get_current_user), service=Depends(get_execution)):
    payload = await body(request)
    result = await service.patch(user.id, payload, position_id=uint64(ticket))
    pos = next((p for p in service.open_trades(user.id)["positions"] if p["brokerPositionTicket"] == ticket), None)
    res = {"position": pos} if pos else {}
    if isinstance(result, dict) and "operation" in result:
        res["operation"] = result["operation"]
    elif isinstance(result, dict) and "key" in result:
        res["operation"] = result
    return res


@router.patch("/api/execution/orders/{ticket}", status_code=202)
async def patch_pending(ticket: str, request: Request, user=Depends(get_current_user), service=Depends(get_execution)):
    payload = await body(request)
    result = await service.patch(user.id, payload, broker_order_id=uint64(ticket))
    match_ord = next((o for o in service.open_trades(user.id)["orders"] if o["brokerOrderTicket"] == ticket), None)
    res = {"order": match_ord} if match_ord else {}
    if isinstance(result, dict) and "operation" in result:
        res["operation"] = result["operation"]
    elif isinstance(result, dict) and "key" in result:
        res["operation"] = result
    return res


@router.delete("/api/execution/orders/{ticket}")
async def cancel_pending(ticket: str, request: Request, user=Depends(get_current_user), service=Depends(get_execution)):
    payload = await body(request)
    return await service.cancel(user.id, broker_order_id=uint64(ticket), key=payload.get("idempotencyKey"))


@router.get("/api/orders")
async def orders(openOnly: bool = True, user=Depends(get_current_user), service=Depends(get_execution)):
    if user.id not in service.sessions:
        return {"orders": []}
    return {"orders": service.orders(user.id, openOnly)}


@router.post("/api/orders", status_code=202)
async def submit(request: Request, user=Depends(get_current_user), service=Depends(get_execution)):
    return {"order": await service.submit(user.id, await body(request))}


@router.get("/api/orders/{order_id}")
async def get_order(order_id: str, user=Depends(get_current_user), service=Depends(get_execution)):
    order = next((o for o in service.orders(user.id, open_only=False) if o["id"] == order_id), None)
    if order is None:
        raise ExecutionError("NOT_FOUND", "Order not found", 404)
    return {"order": order}


@router.patch("/api/orders/{order_id}", status_code=202)
async def patch_order(order_id: str, request: Request, user=Depends(get_current_user), service=Depends(get_execution)):
    return {"order": await service.patch(user.id, await body(request), order_id=order_id)}


@router.delete("/api/orders/{order_id}", status_code=202)
async def cancel_order(order_id: str, request: Request, user=Depends(get_current_user), service=Depends(get_execution)):
    payload = await body(request)
    return {"order": await service.cancel(user.id, order_id=order_id, key=payload.get("idempotencyKey"))}


@router.post("/api/orders/{order_id}/close", status_code=202)
async def close_order(order_id: str, request: Request, user=Depends(get_current_user), service=Depends(get_execution)):
    payload = await body(request)
    return {"order": await service.close(user.id, order_id=order_id, volume=payload.get("volumeLots"),
                                         close_fifty_percent=bool(payload.get("closeFiftyPercent")),
                                         key=payload.get("idempotencyKey"))}


@router.get("/api/supertrend-trailing")
async def trailings(user=Depends(get_current_user), service=Depends(get_execution)):
    return {"trailings": service.store.trailings(user.id)}


@router.put("/api/supertrend-trailing/{segment}/{target}")
async def trailing(segment: str, target: str, request: Request, user=Depends(get_current_user), service=Depends(get_execution)):
    if segment not in {"orders", "positions"}:
        raise ExecutionError("NOT_FOUND", "Unknown trailing target", 404)
    return {"trailing": service.set_trailing(user.id, "order" if segment == "orders" else "position", target, await body(request))}


@router.delete("/api/supertrend-trailing/{segment}/{target}")
async def delete_trailing(segment: str, target: str, request: Request, user=Depends(get_current_user), service=Depends(get_execution)):
    await body(request)
    if segment not in {"orders", "positions"}:
        raise ExecutionError("NOT_FOUND", "Unknown trailing target", 404)
    service.store.delete_trailing(user.id, "order" if segment == "orders" else "position", target)
    return {"ok": True}


def install_exness_execution(app):
    app.include_router(router)

    @app.exception_handler(ExecutionError)
    async def error(request, exc):
        detail = {"code": exc.code, "message": str(exc)}
        if exc.diagnostics:
            detail["diagnostics"] = exc.diagnostics
        return JSONResponse({"error": detail}, status_code=exc.status,
                            headers={"Cache-Control": "no-store"})

    @app.middleware("http")
    async def private_execution(request, call_next):
        response = await call_next(request)
        if request.url.path.startswith(("/api/execution", "/api/orders", "/api/supertrend-trailing")):
            response.headers["Cache-Control"] = "no-store"
        return response
