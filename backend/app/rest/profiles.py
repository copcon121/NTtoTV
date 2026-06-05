"""REST_API endpoints for server-side chart profiles."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request, Response

from ..models.timestamp import now_ms
from ..storage.cache_store import CacheStore
from ..storage.records import ProfileRecord
from .alerts import get_cache
from .errors import bad_request, not_found, validation_error

router = APIRouter(prefix="/api", tags=["profiles"])


def _normalize_profile_id(profile_id: str) -> str:
    profile_id = profile_id.strip()
    if not profile_id:
        raise validation_error("Missing or invalid profile id", field="profileId")
    return profile_id


def _profile_to_dict(
    rec: ProfileRecord, *, include_payload: bool = True
) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": rec.id,
        "name": rec.name,
        "createdAt": rec.created_at,
        "updatedAt": rec.updated_at,
    }
    if include_payload:
        out["payload"] = rec.payload
    return out


@router.get("/profiles")
async def list_profiles(cache: CacheStore = Depends(get_cache)) -> dict[str, Any]:
    """Return saved profile metadata."""
    return {
        "profiles": [
            _profile_to_dict(profile, include_payload=False)
            for profile in cache.read_profiles()
        ]
    }


@router.get("/profiles/{profile_id}")
async def get_profile(
    profile_id: str,
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    """Return one saved profile payload."""
    profile_id = _normalize_profile_id(profile_id)
    rec = cache.read_profile(profile_id)
    if rec is None:
        raise not_found(f"Unknown profile id {profile_id!r}", field="profileId")
    return {"profile": _profile_to_dict(rec)}


@router.put("/profiles/{profile_id}")
async def save_profile(
    profile_id: str,
    request: Request,
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    """Create or replace a saved profile payload."""
    profile_id = _normalize_profile_id(profile_id)
    try:
        body = await request.json()
    except Exception:
        raise bad_request("Request body must be valid JSON")
    if not isinstance(body, dict):
        raise bad_request("Request body must be a JSON object")

    payload = body.get("payload")
    if not isinstance(payload, dict):
        raise validation_error("'payload' must be an object", field="payload")
    raw_name = body.get("name", profile_id)
    if raw_name is not None and not isinstance(raw_name, str):
        raise validation_error("'name' must be a string", field="name")
    name = (raw_name or profile_id).strip() or profile_id

    now = now_ms()
    existing = cache.read_profile(profile_id)
    rec = ProfileRecord(
        id=profile_id,
        name=name,
        payload=payload,
        created_at=existing.created_at if existing is not None else now,
        updated_at=now,
    )
    cache.upsert_profile(rec)
    return {"profile": _profile_to_dict(rec)}


@router.delete("/profiles/{profile_id}", status_code=204)
async def delete_profile(
    profile_id: str,
    cache: CacheStore = Depends(get_cache),
) -> Response:
    """Delete one saved profile."""
    profile_id = _normalize_profile_id(profile_id)
    if not cache.delete_profile(profile_id):
        raise not_found(f"Unknown profile id {profile_id!r}", field="profileId")
    return Response(status_code=204)
