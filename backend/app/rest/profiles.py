"""REST_API endpoints for server-side chart profiles."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request, Response

from ..models.auth import AuthenticatedUser
from ..models.timestamp import now_ms
from ..storage.cache_store import CacheStore
from ..storage.records import ProfileRecord
from .alerts import get_cache
from .auth import get_current_user
from .errors import bad_request, not_found, validation_error

router = APIRouter(prefix="/api", tags=["profiles"])
DEFAULT_PROFILE_ID = "default"


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


def _empty_user_profile(user: AuthenticatedUser) -> ProfileRecord:
    return ProfileRecord(
        id=user.id,
        user_id=user.id,
        name=user.username,
        payload={},
        created_at=0,
        updated_at=0,
    )


def _read_or_seed_user_profile(
    cache: CacheStore, user: AuthenticatedUser
) -> ProfileRecord:
    existing = cache.profiles.read_user_default_profile(user.id)
    if existing is not None:
        return existing

    first_user = cache.users.read_first_user()
    legacy = cache.read_profile(DEFAULT_PROFILE_ID)
    if first_user is not None and first_user.id == user.id and legacy is not None:
        now = now_ms()
        seeded = ProfileRecord(
            id=user.id,
            user_id=user.id,
            name=legacy.name,
            payload=legacy.payload,
            created_at=now,
            updated_at=now,
        )
        cache.upsert_profile(seeded)
        return seeded

    return _empty_user_profile(user)


@router.get("/me/profile")
async def get_my_profile(
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    """Return the authenticated user's default chart workspace."""
    return {"profile": _profile_to_dict(_read_or_seed_user_profile(cache, user))}


@router.put("/me/profile")
async def save_my_profile(
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    """Create or replace the authenticated user's default chart workspace."""
    try:
        body = await request.json()
    except Exception:
        raise bad_request("Request body must be valid JSON")
    if not isinstance(body, dict):
        raise bad_request("Request body must be a JSON object")

    payload = body.get("payload")
    if not isinstance(payload, dict):
        raise validation_error("'payload' must be an object", field="payload")
    raw_name = body.get("name", user.username)
    if raw_name is not None and not isinstance(raw_name, str):
        raise validation_error("'name' must be a string", field="name")
    name = (raw_name or user.username).strip() or user.username

    now = now_ms()
    existing = cache.profiles.read_user_default_profile(user.id)
    rec = ProfileRecord(
        id=user.id,
        user_id=user.id,
        name=name,
        payload=payload,
        created_at=existing.created_at if existing is not None else now,
        updated_at=now,
    )
    cache.upsert_profile(rec)
    return {"profile": _profile_to_dict(rec)}


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
