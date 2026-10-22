"""Owner-only REST controls for configuring the Rithmic-only runtime."""

from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Request

from ..models.auth import AuthenticatedUser
from ..rithmic.admin_config import RithmicAdminConfigError
from ..storage.cache_store import CacheStore
from .alerts import get_cache
from .auth import get_current_user
from .errors import ApiError, ErrorCode, bad_request, conflict, validation_error

router = APIRouter(prefix="/api/admin/rithmic", tags=["admin", "rithmic"])


def _runtime(request: Request):
    runtime = getattr(request.app.state, "runtime", None)
    if runtime is None:
        raise ApiError(503, ErrorCode.INTERNAL, "Runtime is not available")
    return runtime


def _require_owner(
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> AuthenticatedUser:
    owner = cache.users.read_first_user()
    if owner is None or owner.id != user.id:
        raise ApiError(403, ErrorCode.FORBIDDEN, "Owner access is required")
    return user


def _require_same_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if not origin:
        return
    origin_host = urlparse(origin).netloc.lower()
    request_host = request.headers.get("host", "").lower()
    if origin_host != request_host:
        raise ApiError(403, ErrorCode.FORBIDDEN, "Cross-origin admin request denied")


async def _json_object(request: Request) -> dict[str, Any]:
    try:
        body = await request.json()
    except Exception:
        raise bad_request("Request body must be valid JSON")
    if not isinstance(body, dict):
        raise bad_request("Request body must be a JSON object")
    return body


def _config_error(exc: RithmicAdminConfigError) -> ApiError:
    return validation_error(str(exc), field=exc.field)


@router.get("")
async def get_rithmic_admin(
    request: Request,
    _owner: AuthenticatedUser = Depends(_require_owner),
) -> dict[str, Any]:
    try:
        return _runtime(request).rithmic_admin_snapshot()
    except RithmicAdminConfigError as exc:
        raise _config_error(exc)


@router.put("")
async def save_rithmic_admin(
    request: Request,
    _owner: AuthenticatedUser = Depends(_require_owner),
) -> dict[str, Any]:
    _require_same_origin(request)
    body = await _json_object(request)
    try:
        config = _runtime(request).save_rithmic_admin_config(body)
    except RithmicAdminConfigError as exc:
        raise _config_error(exc)
    return {"ok": True, "config": config}


@router.post("/test")
async def test_rithmic_admin(
    request: Request,
    _owner: AuthenticatedUser = Depends(_require_owner),
) -> dict[str, Any]:
    _require_same_origin(request)
    runtime = _runtime(request)
    if runtime.rithmic_service is not None and runtime.rithmic_service.running:
        raise conflict("Disconnect the active Rithmic session before running a login test")
    body = await _json_object(request)
    try:
        return await runtime.test_rithmic_admin_config(body)
    except RithmicAdminConfigError as exc:
        raise _config_error(exc)


@router.post("/connect")
async def connect_rithmic_admin(
    request: Request,
    _owner: AuthenticatedUser = Depends(_require_owner),
) -> dict[str, Any]:
    _require_same_origin(request)
    try:
        snapshot = await _runtime(request).connect_rithmic_from_admin()
    except RithmicAdminConfigError as exc:
        raise _config_error(exc)
    connection = snapshot.get("connection")
    ok = bool(connection.get("ok")) if isinstance(connection, dict) else True
    return {"ok": ok, **snapshot}


@router.post("/disconnect")
async def disconnect_rithmic_admin(
    request: Request,
    _owner: AuthenticatedUser = Depends(_require_owner),
) -> dict[str, Any]:
    _require_same_origin(request)
    try:
        snapshot = await _runtime(request).disconnect_rithmic_from_admin()
    except RithmicAdminConfigError as exc:
        raise _config_error(exc)
    return {"ok": True, **snapshot}
