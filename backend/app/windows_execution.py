"""Relay authenticated execution to Windows over a loopback-only SSH tunnel.

Windows remains authoritative for sessions, profile ownership and order state.
No broker credentials or account bindings are copied to the Linux database.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import socket
from dataclasses import dataclass
from http.cookies import SimpleCookie
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request as UrlRequest, build_opener

from fastapi import Request
from starlette.responses import JSONResponse, Response

from .models.auth import AuthenticatedUser
from .storage.user_store import SESSION_COOKIE

REMOTE_COOKIE = "nttotv_windows_session"
PROFILE_TERMINALS = {
    "hieu": r"C:\Program Files\MetaTrader 5\terminal64.exe",
    "hai": r"C:\MT5Hai\terminal64.exe",
}
_TRADING_PATH = re.compile(
    r"/api/(?:mt5(?:/(?:status|account|symbol|terminals|open-trades|connect|"
    r"positions/\d+(?:/close)?|orders/\d+))?|orders(?:/[A-Za-z0-9_-]+(?:/close)?)?|"
    r"supertrend-trailing(?:/(?:orders|positions)/[A-Za-z0-9_-]+)?)"
)
_AUTH_PATHS = {"/api/auth/me", "/api/auth/refresh", "/api/auth/logout", "/api/auth/password"}


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


@dataclass
class RelayReply:
    status: int
    body: bytes
    content_type: str = "application/json"
    cookies: tuple[str, ...] = ()

    def json(self) -> Any:
        return json.loads(self.body)


def _error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse({"error": {"code": code, "message": message}}, status_code=status)


class WindowsExecutionBridge:
    def __init__(self, base_url: str) -> None:
        parsed = urlsplit(base_url)
        if (
            parsed.scheme != "http" or parsed.hostname != "127.0.0.1"
            or not parsed.port or parsed.username or parsed.password
            or parsed.path not in {"", "/"} or parsed.query or parsed.fragment
        ):
            raise ValueError("Windows execution URL must be an HTTP loopback origin")
        self.base_url = base_url.rstrip("/")

    async def send(
        self, method: str, path: str, *, token: str | None = None, body: bytes = b""
    ) -> RelayReply:
        return await asyncio.to_thread(self._send, method, path, token, body)

    def _send(self, method: str, path: str, token: str | None, body: bytes) -> RelayReply:
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if token:
            headers["Cookie"] = f"{SESSION_COOKIE}={token}"
        req = UrlRequest(
            self.base_url + path, data=body if method not in {"GET", "HEAD"} else None,
            headers=headers, method=method,
        )
        # Ignore HTTP_PROXY and never follow a redirect off the private channel.
        opener = build_opener(ProxyHandler({}), _NoRedirect())
        try:
            upstream = opener.open(req, timeout=40)
        except HTTPError as exc:
            upstream = exc
        with upstream:
            return RelayReply(
                upstream.code, upstream.read(4 * 1024 * 1024),
                upstream.headers.get("Content-Type", "application/json"),
                tuple(upstream.headers.get_all("Set-Cookie", [])),
            )

    async def identity(self, token: str) -> AuthenticatedUser | None:
        reply = await self.send("GET", "/api/auth/me", token=token)
        if reply.status != 200:
            return None
        user = reply.json().get("user", {})
        if str(user.get("username", "")).casefold() not in PROFILE_TERMINALS or not user.get("id"):
            return None
        return AuthenticatedUser(
            id=user["id"], username=user["username"],
            must_change_password=bool(user.get("mustChangePassword", False)),
        )

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path.rstrip("/")
        token = request.cookies.get(REMOTE_COOKIE)
        trading = bool(_TRADING_PATH.fullmatch(path))
        if path == "/api/execution":
            return JSONResponse({"enabled": True, "mode": "windows", "profiles": list(PROFILE_TERMINALS)})
        # Never substitute a Windows identity for Oracle's owner/Admin identity.
        if path.startswith("/api/admin/"):
            return await call_next(request)
        body = b""
        login = False
        if path in {"/api/auth/login", "/api/auth/register"} and request.method == "POST":
            body = await request.body()
            try:
                payload = json.loads(body)
                name = str(payload.get("username", "")).strip().casefold()
            except (ValueError, AttributeError):
                return _error(400, "BAD_REQUEST", "Request body must be a JSON object")
            login = name in PROFILE_TERMINALS
            if login and path.endswith("/register"):
                return _error(409, "CONFLICT", "Sign in with your existing Windows profile")
            if not login:
                response = await call_next(request)
                if response.status_code < 300:
                    response.delete_cookie(REMOTE_COOKIE)
                return response
        relay = trading or (bool(token) and (path in _AUTH_PATHS or path == "/api/me/profile")) or login
        if not relay:
            return await call_next(request)
        if path == "/api/auth/logout" and token:
            try:
                await self.send("POST", path, token=token)
            except (URLError, OSError):
                pass
            response = JSONResponse({"ok": True})
            response.delete_cookie(REMOTE_COOKIE)
            return response
        mutation_sent = False
        try:
            user = None
            if token and not login:
                user = await self.identity(token)
                if user is not None:
                    request.state.execution_user = user
            if not relay:
                return await call_next(request)
            if not login and user is None:
                return _error(401, "UNAUTHORIZED", "Sign in with your Windows profile to trade")
            if user and user.must_change_password and path not in _AUTH_PATHS:
                return _error(403, "PASSWORD_CHANGE_REQUIRED", "Password change required")
            if request.method not in {"GET", "HEAD"}:
                origin = request.headers.get("origin")
                if origin and urlsplit(origin).netloc != request.url.netloc:
                    return _error(403, "FORBIDDEN", "Cross-origin execution is not allowed")
                body = body or await request.body()
                if len(body) > 1024 * 1024:
                    return _error(413, "BAD_REQUEST", "Request body is too large")
            if user and path == "/api/mt5/connect":
                try:
                    payload = json.loads(body)
                    terminal = str(payload.get("terminalPath", "")).strip().replace("/", "\\").casefold()
                except (ValueError, AttributeError):
                    return _error(400, "BAD_REQUEST", "Request body must be a JSON object")
                expected = PROFILE_TERMINALS[user.username.casefold()]
                if terminal != expected.casefold():
                    return _error(403, "FORBIDDEN", "This terminal belongs to another profile")
            query = f"?{request.url.query}" if request.url.query else ""
            mutation_sent = trading and request.method not in {"GET", "HEAD"}
            reply = await self.send(request.method, path + query, token=None if login else token, body=body)
            if login and reply.status == 200:
                result_user = reply.json().get("user", {})
                if str(result_user.get("username", "")).casefold() != name:
                    return _error(502, "EXECUTION_UNAVAILABLE", "Windows returned an unexpected profile")
            if path == "/api/mt5/terminals" and reply.status == 200 and user:
                result = reply.json()
                expected = PROFILE_TERMINALS[user.username.casefold()].casefold()
                result["terminals"] = [
                    terminal for terminal in result.get("terminals", [])
                    if str(terminal.get("path", "")).casefold() == expected
                ]
                reply.body = json.dumps(result).encode()
            response = Response(reply.body, status_code=reply.status, headers={
                "Content-Type": reply.content_type, "Cache-Control": "no-store",
            })
            for header in reply.cookies:
                cookies = SimpleCookie()
                cookies.load(header)
                if SESSION_COOKIE in cookies:
                    cookie = cookies[SESSION_COOKIE]
                    response.set_cookie(
                        REMOTE_COOKIE, cookie.value,
                        max_age=int(cookie["max-age"]) if cookie["max-age"] else None,
                        httponly=True, secure=request.url.scheme == "https", samesite="lax",
                    )
            if login and reply.status == 200:
                response.delete_cookie(SESSION_COOKIE)
            if path == "/api/auth/logout":
                response.delete_cookie(REMOTE_COOKIE)
            return response
        except (URLError, OSError, socket.timeout, ValueError):
            # Never retry a mutation: its broker result may already exist on Windows.
            if mutation_sent:
                return _error(504, "EXECUTION_UNCERTAIN", "Windows did not confirm the result; check orders before retrying")
            return _error(503, "EXECUTION_UNAVAILABLE", "The private Windows connection is unavailable")


def install_windows_execution(app) -> None:
    base_url = os.getenv("NTTOTV_WINDOWS_EXECUTION_URL", "").strip()
    if base_url:
        bridge = WindowsExecutionBridge(base_url)
        app.state.windows_execution = bridge
        app.middleware("http")(bridge.dispatch)
    else:
        @app.get("/api/execution")
        def execution_disabled():
            return {"enabled": False, "mode": "disabled", "profiles": []}
