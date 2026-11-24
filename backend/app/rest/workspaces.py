"""Authenticated workspace CRUD."""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, Request

from ..models.auth import AuthenticatedUser
from ..models.timestamp import now_ms
from ..rest.auth import get_current_user
from ..rest.errors import bad_request, not_found, validation_error
from ..storage.cache_store import CacheStore
from .alerts import get_cache

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])
MAX_WORKSPACES_PER_USER = 30
PANEL_TYPES = {"chart", "footprint", "marketProfile", "liquidity", "aiScan", "alerts", "tradingAccount"}


def _validate_name(value: Any) -> str:
    if not isinstance(value, str) or not value.strip():
        raise validation_error("name must be a non-empty string", field="name")
    return value.strip()[:80]


def _validate_payload(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise validation_error("payload must be an object", field="payload")
    panels = value.get("panels", [])
    if not isinstance(panels, list) or len(panels) > 12:
        raise validation_error("panels must be an array with at most 12 entries", field="payload.panels")
    if any(
        not isinstance(panel, dict) or not isinstance(panel.get("type"), str)
        or panel["type"] not in PANEL_TYPES or not isinstance(panel.get("id"), str)
        or not panel["id"]
        for panel in panels
    ):
        raise validation_error("each panel needs an ID and supported type", field="payload.panels")
    if len({panel["id"] for panel in panels}) != len(panels):
        raise validation_error("panel IDs must be unique", field="payload.panels")
    if sum(panel["type"] == "chart" for panel in panels) > 4:
        raise validation_error("a workspace can have up to four charts", field="payload.panels")
    return value


@router.get("")
async def list_workspaces(
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    return {"workspaces": cache.workspaces.list(user.id)}


@router.post("")
async def create_workspace(
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    try:
        body = await request.json()
    except Exception as exc:
        raise bad_request("Request body must be valid JSON") from exc
    if not isinstance(body, dict):
        raise bad_request("Request body must be a JSON object")
    bootstrap = body.get("bootstrap") is True
    now = now_ms()
    workspace = {
        "id": "default" if bootstrap else str(uuid4()),
        "name": _validate_name(body.get("name")),
        "payload": _validate_payload(body.get("payload")),
        "createdAt": now,
        "updatedAt": now,
    }
    if cache.workspaces.create(user.id, workspace, MAX_WORKSPACES_PER_USER):
        return {"workspace": workspace}
    if bootstrap:
        existing = cache.workspaces.read(user.id, workspace["id"])
        if existing is not None:
            return {"workspace": existing}
    raise validation_error("workspace limit reached", field="workspaces")


@router.get("/{workspace_id}")
async def get_workspace(
    workspace_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    workspace = cache.workspaces.read(user.id, workspace_id)
    if workspace is None:
        raise not_found("Unknown workspace", field="workspaceId")
    return {"workspace": workspace}


@router.put("/{workspace_id}")
async def update_workspace(
    workspace_id: str,
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    try:
        body = await request.json()
    except Exception as exc:
        raise bad_request("Request body must be valid JSON") from exc
    if not isinstance(body, dict):
        raise bad_request("Request body must be a JSON object")
    workspace = cache.workspaces.update(
        user.id, workspace_id,
        name=_validate_name(body["name"]) if "name" in body else None,
        payload=_validate_payload(body["payload"]) if "payload" in body else None,
        updated_at=now_ms(),
    )
    if workspace is None:
        raise not_found("Unknown workspace", field="workspaceId")
    return {"workspace": workspace}


@router.delete("/{workspace_id}", status_code=204)
async def delete_workspace(
    workspace_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
):
    if not cache.workspaces.delete(user.id, workspace_id):
        raise not_found("Unknown workspace", field="workspaceId")
