"""Owner-only AI Scan provider configuration and connectivity test."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from starlette.concurrency import run_in_threadpool

from ..ai_client import chat_completion
from ..ai_config import AiConfigError, AiScanConfigStore
from ..config import settings
from ..models.auth import AuthenticatedUser
from .errors import validation_error
from .rithmic_admin import _json_object, _require_owner, _require_same_origin

router = APIRouter(prefix="/api/admin/ai-scan", tags=["admin", "ai-scan"])


def get_ai_scan_config_store(request: Request) -> AiScanConfigStore:
    store = getattr(request.app.state, "ai_scan_config_store", None)
    if store is None:
        runtime = getattr(request.app.state, "runtime", None)
        store = AiScanConfigStore(getattr(runtime, "settings", settings))
        request.app.state.ai_scan_config_store = store
    return store


@router.get("")
async def get_ai_scan_config(
    request: Request,
    _owner: AuthenticatedUser = Depends(_require_owner),
):
    return {"config": get_ai_scan_config_store(request).load().public()}


@router.put("")
async def save_ai_scan_config(
    request: Request,
    _owner: AuthenticatedUser = Depends(_require_owner),
):
    _require_same_origin(request)
    body = await _json_object(request)
    try:
        config = get_ai_scan_config_store(request).save(body)
    except AiConfigError as exc:
        raise validation_error(str(exc), field=exc.field) from exc
    return {"ok": True, "config": config.public()}


@router.post("/test")
async def test_ai_scan_config(
    request: Request,
    _owner: AuthenticatedUser = Depends(_require_owner),
):
    _require_same_origin(request)
    body = await _json_object(request)
    try:
        config = get_ai_scan_config_store(request).parse(body)
    except AiConfigError as exc:
        raise validation_error(str(exc), field=exc.field) from exc
    reply = await run_in_threadpool(chat_completion, config, [{"role": "user", "content": "Chỉ trả lời OK"}])
    return {**reply.public(), "model": config.model, "endpoint": config.endpoint}
