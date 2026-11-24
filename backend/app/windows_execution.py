"""Transport for one-time Windows profile migration over a loopback-only SSH tunnel.

No execution relay or broker trading routes are mounted.
Windows profile import is accessed strictly on user sign-in.
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request as UrlRequest, build_opener

from .storage.user_store import SESSION_COOKIE

REMOTE_COOKIE = "nttotv_windows_session"
PROFILE_TERMINALS = {
    "hieu": r"C:\Program Files\MetaTrader 5\terminal64.exe",
    "hai": r"C:\MT5Hai\terminal64.exe",
}


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
