"""Auth/session models for local order-on-chart access."""

from __future__ import annotations

from dataclasses import dataclass

from .timestamp import CanonicalTimestamp

__all__ = ["AuthenticatedUser", "UserRecord", "SessionRecord"]


@dataclass(slots=True)
class AuthenticatedUser:
    id: str
    username: str
    must_change_password: bool = False


@dataclass(slots=True)
class UserRecord:
    id: str
    username: str
    password_hash: str
    created_at: CanonicalTimestamp
    must_change_password: bool = False


@dataclass(slots=True)
class SessionRecord:
    token_hash: str
    user_id: str
    created_at: CanonicalTimestamp
    expires_at: CanonicalTimestamp
