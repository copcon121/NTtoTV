"""Local session auth endpoints for trading features."""

from __future__ import annotations

import hmac
from typing import Any

from fastapi import APIRouter, Depends, Request, Response

from ..config import settings as default_settings
from ..models.auth import AuthenticatedUser
from ..storage.cache_store import CacheStore
from ..storage.user_store import SESSION_COOKIE
from .alerts import get_cache
from .errors import ApiError, ErrorCode, bad_request, conflict

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _user_to_dict(user: AuthenticatedUser) -> dict[str, str]:
    return {"id": user.id, "username": user.username}


def current_user_optional(
    request: Request, cache: CacheStore = Depends(get_cache)
) -> AuthenticatedUser | None:
    return cache.users.read_session_user(request.cookies.get(SESSION_COOKIE))


def get_current_user(
    user: AuthenticatedUser | None = Depends(current_user_optional),
) -> AuthenticatedUser:
    if user is None:
        raise ApiError(401, ErrorCode.UNAUTHORIZED, "Authentication required")
    return user


@router.post("/login")
async def login(
    request: Request,
    response: Response,
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    username, password = await _credentials(request)

    # Local-first bootstrap: the first successful login creates the first user.
    if not cache.users.has_users():
        rec = cache.users.create_user(username, password)
    else:
        rec = cache.users.authenticate(username, password)
        if rec is None:
            raise ApiError(401, ErrorCode.UNAUTHORIZED, "Invalid username or password")

    token = cache.users.create_session(rec.id)
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        samesite="lax",
        max_age=12 * 60 * 60,
    )
    return {"user": {"id": rec.id, "username": rec.username}}


@router.post("/register")
async def register(
    request: Request,
    response: Response,
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    username, password, body = await _credentials_body(request)
    _guard_invite_code(body)
    if cache.users.read_user_by_username(username) is not None:
        raise conflict("Username already exists", field="username")
    rec = cache.users.create_user(username, password)
    token = cache.users.create_session(rec.id)
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        samesite="lax",
        max_age=12 * 60 * 60,
    )
    return {"user": {"id": rec.id, "username": rec.username}}


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    cache: CacheStore = Depends(get_cache),
) -> dict[str, bool]:
    cache.users.delete_session(request.cookies.get(SESSION_COOKIE))
    response.delete_cookie(SESSION_COOKIE)
    return {"ok": True}


@router.post("/refresh")
async def refresh(
    request: Request,
    response: Response,
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    user = cache.users.read_session_user(request.cookies.get(SESSION_COOKIE))
    if user is None:
        raise ApiError(401, ErrorCode.UNAUTHORIZED, "Authentication required")
    cache.users.delete_session(request.cookies.get(SESSION_COOKIE))
    token = cache.users.create_session(user.id)
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        samesite="lax",
        max_age=12 * 60 * 60,
    )
    return {"user": _user_to_dict(user)}


@router.get("/me")
async def me(user: AuthenticatedUser = Depends(get_current_user)) -> dict[str, Any]:
    return {"user": _user_to_dict(user)}


async def _credentials(request: Request) -> tuple[str, str]:
    username, password, _body = await _credentials_body(request)
    return username, password


async def _credentials_body(request: Request) -> tuple[str, str, dict[str, Any]]:
    try:
        body = await request.json()
    except Exception:
        raise bad_request("Request body must be valid JSON")
    if not isinstance(body, dict):
        raise bad_request("Request body must be a JSON object")
    username = body.get("username")
    password = body.get("password")
    if not isinstance(username, str) or not username.strip():
        raise bad_request("Missing or invalid field 'username'", field="username")
    if not isinstance(password, str) or not password:
        raise bad_request("Missing or invalid field 'password'", field="password")
    return username.strip(), password, body


def _guard_invite_code(body: dict[str, Any]) -> None:
    expected = default_settings.invite_code
    if not expected:
        return
    provided = body.get("inviteCode")
    if not isinstance(provided, str) or not hmac.compare_digest(
        provided.strip(),
        expected,
    ):
        raise ApiError(
            401,
            ErrorCode.UNAUTHORIZED,
            "Invalid invite code",
            field="inviteCode",
        )
