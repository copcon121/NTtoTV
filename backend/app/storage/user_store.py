"""User, session, and MT5 account persistence for local trading access."""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import sqlite3
from collections.abc import Callable

from ..models.auth import AuthenticatedUser, SessionRecord, UserRecord
from ..models.mt5 import Mt5AccountRecord
from ..models.timestamp import now_ms
from .connection import SingleWriter

__all__ = [
    "SESSION_COOKIE",
    "UserStore",
    "hash_password",
    "verify_password",
    "hash_session_token",
]

SESSION_COOKIE = "nttotv_session"
_PBKDF2_ITERATIONS = 210_000
_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000


def hash_password(password: str, *, salt: bytes | None = None) -> str:
    salt = salt or os.urandom(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS
    )
    return "pbkdf2_sha256${}${}${}".format(
        _PBKDF2_ITERATIONS,
        base64.urlsafe_b64encode(salt).decode("ascii"),
        base64.urlsafe_b64encode(digest).decode("ascii"),
    )


def verify_password(password: str, encoded: str) -> bool:
    try:
        scheme, iterations, salt_b64, digest_b64 = encoded.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        salt = base64.urlsafe_b64decode(salt_b64.encode("ascii"))
        expected = base64.urlsafe_b64decode(digest_b64.encode("ascii"))
        actual = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt, int(iterations)
        )
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _seal_secret(secret: str, key: str) -> str:
    """Encrypt-ish local credential storage with stdlib primitives.

    This keeps credentials out of plaintext without adding a runtime dependency.
    A later hardening pass can replace this with `cryptography.fernet` while
    preserving the store API.
    """
    key_bytes = hashlib.sha256(key.encode("utf-8")).digest()
    payload = secret.encode("utf-8")
    stream = _keystream(key_bytes, len(payload))
    ciphertext = bytes(a ^ b for a, b in zip(payload, stream))
    mac = hmac.new(key_bytes, ciphertext, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(mac + ciphertext).decode("ascii")


def _unseal_secret(sealed: str, key: str) -> str:
    key_bytes = hashlib.sha256(key.encode("utf-8")).digest()
    raw = base64.urlsafe_b64decode(sealed.encode("ascii"))
    if len(raw) < hashlib.sha256().digest_size:
        raise ValueError("sealed secret is invalid")
    mac = raw[: hashlib.sha256().digest_size]
    ciphertext = raw[hashlib.sha256().digest_size :]
    expected = hmac.new(key_bytes, ciphertext, hashlib.sha256).digest()
    if not hmac.compare_digest(mac, expected):
        raise ValueError("sealed secret authentication failed")
    stream = _keystream(key_bytes, len(ciphertext))
    payload = bytes(a ^ b for a, b in zip(ciphertext, stream))
    return payload.decode("utf-8")


def _keystream(key: bytes, length: int) -> bytes:
    out = bytearray()
    counter = 0
    while len(out) < length:
        out.extend(hashlib.sha256(key + counter.to_bytes(4, "big")).digest())
        counter += 1
    return bytes(out[:length])


def _row_to_user(row: sqlite3.Row) -> UserRecord:
    return UserRecord(
        id=str(row["id"]),
        username=str(row["username"]),
        password_hash=str(row["password_hash"]),
        created_at=int(row["created_at"]),
    )


def _row_to_account(row: sqlite3.Row) -> Mt5AccountRecord:
    return Mt5AccountRecord(
        id=str(row["id"]),
        user_id=str(row["user_id"]),
        login=int(row["login"]),
        server=str(row["server"]),
        symbol_broker=str(row["symbol_broker"]),
        password_encrypted=str(row["password_encrypted"]),
        terminal_path=row["terminal_path"],
        trade_mode=str(row["trade_mode"]),
        created_at=int(row["created_at"]),
        updated_at=int(row["updated_at"]),
    )


class UserStore:
    def __init__(self, writer: SingleWriter, reader: Callable[[], sqlite3.Connection]):
        self._writer = writer
        self._reader = reader

    def has_users(self) -> bool:
        conn = self._reader()
        try:
            row = conn.execute("SELECT 1 FROM users LIMIT 1").fetchone()
            return row is not None
        finally:
            conn.close()

    def create_user(self, username: str, password: str) -> UserRecord:
        user = UserRecord(
            id=f"user_{secrets.token_hex(12)}",
            username=username.strip(),
            password_hash=hash_password(password),
            created_at=now_ms(),
        )
        self._writer.execute(
            "INSERT INTO users (id, username, password_hash, created_at) "
            "VALUES (?, ?, ?, ?)",
            (user.id, user.username, user.password_hash, user.created_at),
        )
        return user

    def read_user(self, user_id: str) -> UserRecord | None:
        conn = self._reader()
        try:
            row = conn.execute(
                "SELECT id, username, password_hash, created_at FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()
            return None if row is None else _row_to_user(row)
        finally:
            conn.close()

    def read_user_by_username(self, username: str) -> UserRecord | None:
        conn = self._reader()
        try:
            row = conn.execute(
                "SELECT id, username, password_hash, created_at "
                "FROM users WHERE lower(username) = lower(?)",
                (username.strip(),),
            ).fetchone()
            return None if row is None else _row_to_user(row)
        finally:
            conn.close()

    def read_first_user(self) -> UserRecord | None:
        conn = self._reader()
        try:
            row = conn.execute(
                "SELECT id, username, password_hash, created_at "
                "FROM users ORDER BY created_at, id LIMIT 1"
            ).fetchone()
            return None if row is None else _row_to_user(row)
        finally:
            conn.close()

    def authenticate(self, username: str, password: str) -> UserRecord | None:
        user = self.read_user_by_username(username)
        if user is None or not verify_password(password, user.password_hash):
            return None
        return user

    def create_session(self, user_id: str, ttl_ms: int = _SESSION_TTL_MS) -> str:
        token = secrets.token_urlsafe(32)
        rec = SessionRecord(
            token_hash=hash_session_token(token),
            user_id=user_id,
            created_at=now_ms(),
            expires_at=now_ms() + ttl_ms,
        )
        self._writer.execute(
            "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) "
            "VALUES (?, ?, ?, ?)",
            (rec.token_hash, rec.user_id, rec.created_at, rec.expires_at),
        )
        return token

    def read_session_user(self, token: str | None) -> AuthenticatedUser | None:
        if not token:
            return None
        token_hash = hash_session_token(token)
        current = now_ms()
        conn = self._reader()
        try:
            row = conn.execute(
                "SELECT u.id, u.username FROM sessions s "
                "JOIN users u ON u.id = s.user_id "
                "WHERE s.token_hash = ? AND s.expires_at > ?",
                (token_hash, current),
            ).fetchone()
            if row is None:
                return None
            return AuthenticatedUser(id=str(row["id"]), username=str(row["username"]))
        finally:
            conn.close()

    def delete_session(self, token: str | None) -> None:
        if not token:
            return
        self._writer.execute(
            "DELETE FROM sessions WHERE token_hash = ?", (hash_session_token(token),)
        )

    def upsert_mt5_account(
        self,
        *,
        user_id: str,
        login: int,
        password: str,
        server: str,
        symbol_broker: str,
        credential_key: str,
        terminal_path: str | None = None,
        trade_mode: str = "demo",
    ) -> Mt5AccountRecord:
        now = now_ms()
        existing = self.read_mt5_account(user_id)
        account = Mt5AccountRecord(
            id=existing.id if existing is not None else f"acct_{secrets.token_hex(10)}",
            user_id=user_id,
            login=int(login),
            server=server,
            symbol_broker=symbol_broker,
            password_encrypted=_seal_secret(password, credential_key),
            terminal_path=terminal_path,
            trade_mode=trade_mode,
            created_at=existing.created_at if existing is not None else now,
            updated_at=now,
        )
        self._writer.execute(
            "INSERT INTO user_mt5_accounts "
            "(id, user_id, login, server, symbol_broker, password_encrypted, "
            " terminal_path, trade_mode, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(user_id) DO UPDATE SET "
            "login=excluded.login, server=excluded.server, "
            "symbol_broker=excluded.symbol_broker, "
            "password_encrypted=excluded.password_encrypted, "
            "terminal_path=excluded.terminal_path, trade_mode=excluded.trade_mode, "
            "updated_at=excluded.updated_at",
            (
                account.id,
                account.user_id,
                account.login,
                account.server,
                account.symbol_broker,
                account.password_encrypted,
                account.terminal_path,
                account.trade_mode,
                account.created_at,
                account.updated_at,
            ),
        )
        return account

    def read_mt5_account(self, user_id: str) -> Mt5AccountRecord | None:
        conn = self._reader()
        try:
            row = conn.execute(
                "SELECT id, user_id, login, server, symbol_broker, "
                "password_encrypted, terminal_path, trade_mode, created_at, updated_at "
                "FROM user_mt5_accounts WHERE user_id = ?",
                (user_id,),
            ).fetchone()
            return None if row is None else _row_to_account(row)
        finally:
            conn.close()

    def read_mt5_password(self, user_id: str, credential_key: str) -> str | None:
        account = self.read_mt5_account(user_id)
        if account is None:
            return None
        return _unseal_secret(account.password_encrypted, credential_key)

    def read_mt5_accounts(self) -> list[Mt5AccountRecord]:
        conn = self._reader()
        try:
            rows = conn.execute(
                "SELECT id, user_id, login, server, symbol_broker, "
                "password_encrypted, terminal_path, trade_mode, created_at, updated_at "
                "FROM user_mt5_accounts ORDER BY updated_at DESC"
            ).fetchall()
            return [_row_to_account(row) for row in rows]
        finally:
            conn.close()
