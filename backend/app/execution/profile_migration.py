"""One-time import of a user's own Windows workspace on successful sign-in.

Only the two established trading profiles are eligible. Existing Oracle users,
including the owner, are always authenticated locally and are never replaced.
Broker credentials, orders and terminal state are not requested or imported.
"""

from __future__ import annotations

import json
import os
from http.cookies import SimpleCookie

from ..models.timestamp import now_ms
from ..rest.errors import ApiError
from ..storage.records import ProfileRecord
from ..storage.user_store import SESSION_COOKIE
from ..windows_execution import PROFILE_TERMINALS, WindowsExecutionBridge
from . import execution_mode


async def import_windows_profile(cache, username, password):
    address = (
        os.getenv("NTTOTV_PROFILE_MIGRATION_URL")
        or os.getenv("NTTOTV_WINDOWS_EXECUTION_URL", "")
    ).strip()
    if (execution_mode() != "exness" or not address or username.casefold() not in PROFILE_TERMINALS
            or cache.users.read_user_by_username(username) is not None):
        return None
    bridge = WindowsExecutionBridge(address)
    token = None
    try:
        reply = await bridge.send("POST", "/api/auth/login", body=json.dumps(dict(username=username, password=password)).encode())
        if reply.status != 200:
            return None
        remote = reply.json().get("user", {})
        if str(remote.get("username", "")).casefold() != username.casefold() or remote.get("mustChangePassword"):
            return None
        for header in reply.cookies:
            cookies = SimpleCookie()
            cookies.load(header)
            if SESSION_COOKIE in cookies:
                token = cookies[SESSION_COOKIE].value
        if not token:
            return None
        profile_reply = await bridge.send("GET", "/api/me/profile", token=token)
        if profile_reply.status != 200:
            raise ValueError()
        payload = profile_reply.json().get("profile", {}).get("payload")
        if not isinstance(payload, dict):
            raise ValueError()
        # Network verification completes before creating the local identity.
        existing = cache.users.read_user_by_username(username)
        if existing is not None:
            return cache.users.authenticate(username, password)
        user = cache.users.create_user(username, password)
        now = now_ms()
        cache.upsert_profile(ProfileRecord(id=user.id, user_id=user.id, name=user.username,
            payload=payload, created_at=now, updated_at=now))
        return user
    except (OSError, ValueError):
        raise ApiError(503, "PROFILE_IMPORT_UNAVAILABLE", "Existing profile sign-in is temporarily unavailable; try again when Windows is online") from None
    finally:
        if token:
            try:
                await bridge.send("POST", "/api/auth/logout", token=token)
            except OSError:
                pass
