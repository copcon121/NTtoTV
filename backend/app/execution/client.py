"""Exness Ed25519 signing and transport. No credentials enter errors or logs."""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import re
import time
from contextlib import asynccontextmanager
from collections import defaultdict, deque
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

APPLICATION_USER_AGENT = "GCFlow/0.1 (Exness Trading API connector)"
EXNESS_WS_PROTOCOL = "exness-ws-protocol"
PUBLIC_API_ERRORS = frozenset("""
SYSTEM_RATE_LIMIT SYSTEM_TEMPORARY_UNAVAILABLE SYSTEM_INTERNAL_ERROR
AUTH_INVALID_API_KEY AUTH_INVALID_SIGNATURE AUTH_PERMISSION_DENIED AUTH_RATE_LIMIT
ACCOUNT_NOT_FOUND ACCOUNT_DISABLED ACCOUNT_CLOSE_ONLY
REQUEST_INVALID REQUEST_INVALID_PARAMETERS REQUEST_INVALID_PRICE REQUEST_INVALID_TIMEFRAME
REQUEST_INVALID_TIME_RANGE REQUEST_INVALID_COUNT REQUEST_INVALID_LIMIT REQUEST_INVALID_CURSOR
REQUEST_INVALID_PRICE_TYPE REQUEST_INVALID_FILTER_COMBINATION REQUEST_UNSUPPORTED_MEDIA_TYPE
REQUEST_METHOD_NOT_ALLOWED REQUEST_ORDER_NOT_FOUND REQUEST_POSITION_NOT_FOUND REQUEST_OPERATION_NOT_FOUND REQUEST_RATE_LIMIT
MARKET_INSTRUMENT_NOT_FOUND MARKET_TRADE_DISABLED MARKET_CLOSE_ONLY MARKET_SESSION_CLOSED MARKET_NO_QUOTES
TRADING_RULE_INVALID_VOLUME TRADING_RULE_VOLUME_TOO_SMALL TRADING_RULE_VOLUME_TOO_LARGE
TRADING_RULE_INVALID_VOLUME_STEP TRADING_RULE_INVALID_REMAINING_VOLUME TRADING_RULE_INVALID_PRICE_LEVELS
TRADING_RULE_INSUFFICIENT_MARGIN TRADING_RULE_MARGIN_LEVEL_TOO_LOW TRADING_RULE_OPERATION_RESTRICTED
TRADING_RULE_TOO_MANY_PENDING_ORDERS TRADING_RULE_TOO_MANY_OPEN_POSITIONS
EXECUTION_REQUOTE EXECUTION_REJECTED
""".split())


class ExecutionError(Exception):
    def __init__(self, code: str, message: str, status: int = 409, *, diagnostics: dict | None = None):
        self.code, self.status = code, status
        self.diagnostics = diagnostics or {}
        super().__init__(message)


def request_stage(path: str) -> str:
    path = path.split("?", 1)[0]
    if path == "/v1/trading/access-point":
        return "host discovery"
    if path.startswith("/v1/configuration/"):
        for suffix, label in (("/account", "account verification"), ("/limits", "API limits"),
                              ("/instruments", "instrument list"), ("/conditions", "instrument conditions")):
            if path.endswith(suffix):
                return label
    if path.endswith("/snapshot"):
        return "account snapshot"
    return "API request"


def upstream_http_error(status: int, raw: bytes, url: str) -> ExecutionError:
    """Keep public API codes, without echoing arbitrary upstream body text.

    Gateway problem responses can be JSON too: Cloudflare's error_name/detail
    fields are not Trader API error_message codes. Never label them order rejects.
    """
    parsed = urlsplit(url)
    diagnostics = {"upstreamStatus": status, "host": parsed.hostname, "stage": request_stage(parsed.path)}
    code = None
    try:
        payload = json.loads(raw)
        error = payload.get("error", payload) if isinstance(payload, dict) else None
        if isinstance(error, dict):
            for name in ("error_message", "message", "code"):
                candidate = error.get(name)
                if isinstance(candidate, str) and candidate in PUBLIC_API_ERRORS:
                    code = candidate
                    break
    except (ValueError, TypeError):
        pass
    if code is None:
        if status == 403:
            code = "EXNESS_GATEWAY_DENIED"
            detail = "Gateway denied the connection before a recognized Trading API response"
        else:
            code = "EXNESS_HTTP_ERROR"
            detail = "Upstream returned no recognized Exness API error code"
    else:
        detail = code
    message = f"Exness {diagnostics['stage']}: {detail} (HTTP {status}; {parsed.hostname})"
    return ExecutionError(code, message, status if status < 500 else 503, diagnostics=diagnostics)


def uint64(value) -> str:
    value = str(value)
    if not re.fullmatch(r"[0-9]{1,20}", value) or not 0 < int(value) < 2**64:
        raise ExecutionError("BAD_REQUEST", "Account and broker IDs must be positive UInt64 strings", 400)
    return value


def trusted_origin(value: str) -> str:
    try:
        url = urlsplit(value.strip())
        host = (url.hostname or "").lower()
        allowed = any(host == domain or host.endswith("." + domain)
                      for domain in ("exness.com", "exness-api.com"))
        if (url.scheme != "https" or not allowed or url.port not in {None, 443}
                or url.username or url.password or url.path not in {"", "/"}
                or url.query or url.fragment):
            raise ValueError()
    except ValueError:
        raise ExecutionError("BAD_REQUEST", "Gateway must be an HTTPS Exness hostname", 400) from None
    return "https://" + host


def load_signing_key(secret: str) -> Ed25519PrivateKey:
    try:
        if "-----BEGIN PRIVATE KEY-----" in secret:
            middle = secret.split("-----BEGIN PRIVATE KEY-----", 1)[1].split("-----END PRIVATE KEY-----", 1)[0]
            pem = "-----BEGIN PRIVATE KEY-----\n" + "".join(middle.split()) + "\n-----END PRIVATE KEY-----\n"
            key = serialization.load_pem_private_key(pem.encode(), password=None)
            if not isinstance(key, Ed25519PrivateKey):
                raise ValueError()
            return key
        raw = bytes.fromhex(secret.strip())
        if len(raw) not in {32, 64}:
            raise ValueError()
        key = Ed25519PrivateKey.from_private_bytes(raw[:32])
        if len(raw) == 64 and key.public_key().public_bytes_raw() != raw[32:]:
            raise ValueError()
        return key
    except (ValueError, TypeError, IndexError):
        raise ExecutionError("BAD_REQUEST", "API secret must be an Ed25519 private key (Exness hex or PKCS8 PEM)", 400) from None


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def encode_body(body) -> bytes:
    return b"" if body is None else json.dumps(body, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode()


def sign_headers(api_key: str, key: Ed25519PrivateKey, method: str, path: str,
                 body: bytes = b"", idempotency: str = "", *, timestamp: int | None = None) -> dict:
    method = method.upper()
    if not path.startswith("/v1/") or "#" in path or "\r" in path or "\n" in path:
        raise ExecutionError("BAD_REQUEST", "Invalid API request path", 400)
    if method != "GET" and not re.fullmatch(r"[A-Za-z0-9._~-]{5,128}", idempotency):
        raise ExecutionError("BAD_REQUEST", "Invalid idempotency key", 400)
    stamp = int(time.time() * 1000) if timestamp is None else timestamp
    payload = encode_body(dict(api_key=api_key, idempotency_key=idempotency, timestamp=stamp,
                               sign_version=1, method=method, path=path, body_hash=b64(hashlib.sha256(body).digest())))
    return {"EXN-API-KEY": api_key, "EXN-IDEMPOTENCY-KEY": idempotency,
            "EXN-TIMESTAMP": str(stamp), "EXN-SIGN-VERSION": "1", "EXN-DATA": b64(payload),
            "EXN-SIGN": b64(key.sign(payload)), "Content-Type": "application/json", "Accept": "application/json",
            "User-Agent": APPLICATION_USER_AGENT}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class ExnessClient:
    def __init__(self, api_key: str, secret: str, account_id: str,
                 gateway: str = "https://api.exness.com"):
        if not re.fullmatch(r"[A-Za-z0-9_.-]{8,512}", api_key):
            raise ExecutionError("BAD_REQUEST", "Invalid API key identifier", 400)
        self._api_key, self._key = api_key, load_signing_key(secret)
        self.account_id, self.gateway = uint64(account_id), trusted_origin(gateway)
        self.origin: str | None = None
        self.limits: dict = {}
        self._sent = defaultdict(deque)

    @property
    def trading_path(self):
        return f"/v1/trading/accounts/{self.account_id}"

    @property
    def config_path(self):
        return f"/v1/configuration/accounts/{self.account_id}"

    def _budget(self, method: str, path: str) -> None:
        # Account-global and method quotas are shared by all actions on this client.
        rest = self.limits.get("rest", {})
        rules = [("global", rest.get("global_account_rate", {}))]
        for item in rest.get("methods", []):
            pattern = re.sub(r"\{[^}]+\}", "[^/]+", item.get("path", ""))
            if item.get("http_method", "").upper() == method and re.fullmatch(pattern, path.split("?", 1)[0]):
                rules.append((item["api_operation_id"], item.get("rate_limit", {})))
        now = time.monotonic()
        for name, rule in rules:
            count = rule.get("requests", rule.get("limit"))
            seconds = rule.get("period_seconds", rule.get("window_seconds"))
            if not count or not seconds:
                continue
            queue = self._sent[name]
            while queue and queue[0] <= now - seconds:
                queue.popleft()
            if len(queue) >= count:
                raise ExecutionError("REQUEST_RATE_LIMIT", "Exness request budget reached; wait before trying again", 429)
        for name, _ in rules:
            self._sent[name].append(now)

    async def discover(self) -> None:
        path = f"/v1/trading/access-point?account_id={self.account_id}"
        origins = [self.gateway]
        if self.gateway == "https://api.exness.com":
            origins.append("https://api.exness-api.com")
        for index, origin in enumerate(origins):
            try:
                result = await self.request("GET", path, origin=origin)
                if str(result.get("account_id")) != self.account_id:
                    raise ExecutionError("EXECUTION_UNAVAILABLE", "Exness discovery returned a different account", 502)
                self.origin = trusted_origin(result["access_point"])
                return
            except ExecutionError as exc:
                unavailable = exc.status in {502, 503, 504} or exc.code == "EXNESS_GATEWAY_DENIED"
                if not unavailable or index == len(origins) - 1:
                    raise

    async def request(self, method: str, path: str, body=None, *, idempotency: str = "", origin: str | None = None):
        selected = origin or self.origin
        if selected is None:
            raise ExecutionError("EXECUTION_UNAVAILABLE", "Resolve the account Access Point first", 503)
        encoded = encode_body(body)
        self._budget(method.upper(), path)
        headers = sign_headers(self._api_key, self._key, method, path, encoded, idempotency)
        return await asyncio.to_thread(self._http, selected + path, method, headers, encoded)

    def _http(self, url, method, headers, body):
        req = Request(url, data=body if body else None, headers=headers, method=method)
        try:
            with build_opener(ProxyHandler({}), NoRedirect()).open(req, timeout=15) as response:
                return json.loads(response.read(4 * 1024 * 1024))
        except HTTPError as exc:
            try:
                raw = exc.read(32 * 1024)
            finally:
                exc.close()
            raise upstream_http_error(exc.code, raw, url) from None
        except (URLError, OSError, ValueError):
            raise ExecutionError("EXECUTION_UNAVAILABLE", "Exness did not confirm the request; reconnect and check account state", 503) from None

    @asynccontextmanager
    async def stream(self, kind: str):
        from websockets.asyncio.client import connect
        path = f"/v1/server-events/accounts/{self.account_id}/ws/{kind}"
        headers = sign_headers(self._api_key, self._key, "GET", path)
        async with connect(self.origin.replace("https://", "wss://", 1) + path,
                           additional_headers=headers, proxy=None, open_timeout=15,
                           subprotocols=[EXNESS_WS_PROTOCOL], compression=None,
                           ping_interval=20, ping_timeout=20, max_size=4 * 1024 * 1024) as ws:
            yield ws
