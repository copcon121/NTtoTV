from __future__ import annotations

import json
from urllib.error import URLError

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.windows_execution import (
    PROFILE_TERMINALS, REMOTE_COOKIE, RelayReply, WindowsExecutionBridge,
)


@pytest.fixture
def relay():
    app = FastAPI()
    bridge = WindowsExecutionBridge("http://127.0.0.1:18080")
    calls = []

    async def send(method, path, *, token=None, body=b""):
        calls.append((method, path, token, body))
        if path == "/api/auth/me":
            if token not in {"session-hieu", "session-hai", "session-other"}:
                return RelayReply(401, b"{}")
            name = token.removeprefix("session-")
            return RelayReply(200, json.dumps({"user": {"id": name, "username": name}}).encode())
        if path == "/api/auth/login":
            name = json.loads(body)["username"].strip().lower()
            return RelayReply(200, json.dumps({"user": {"id": name, "username": name}}).encode(),
                              cookies=(f"nttotv_session=session-{name}; HttpOnly; Max-Age=600; Path=/",))
        if path == "/api/mt5/terminals":
            return RelayReply(200, json.dumps({"terminals": [{"path": p} for p in PROFILE_TERMINALS.values()]}).encode())
        return RelayReply(200, json.dumps({"profile": token, "path": path}).encode())

    bridge.send = send
    app.middleware("http")(bridge.dispatch)

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/admin/test")
    def admin():
        return {"owner": "local"}

    @app.post("/api/auth/login")
    def local_login():
        return {"user": {"username": "admin"}}

    with TestClient(app, base_url="https://oracle.test") as client:
        yield client, bridge, calls


@pytest.mark.integration
@pytest.mark.parametrize("name", ["hieu", "Hai"])
def test_windows_login_uses_separate_secure_cookie(relay, name):
    client, bridge, calls = relay
    response = client.post("/api/auth/login", json={"username": name, "password": "test-only"})
    assert response.status_code == 200
    assert client.cookies.get(REMOTE_COOKIE) == f"session-{name.lower()}"
    assert client.cookies.get("nttotv_session") is None
    cookie = response.headers.get_list("set-cookie")[0]
    assert all(flag in cookie for flag in ("Secure", "HttpOnly", "SameSite=lax"))


@pytest.mark.integration
def test_two_profiles_keep_their_sessions_and_terminals_separate(relay):
    client, bridge, calls = relay
    for name in ("hieu", "hai", "hieu"):
        client.cookies.set(REMOTE_COOKIE, f"session-{name}")
        response = client.get("/api/mt5/account")
        assert response.json()["profile"] == f"session-{name}"
        choices = client.get("/api/mt5/terminals").json()["terminals"]
        assert choices == [{"path": PROFILE_TERMINALS[name]}]


@pytest.mark.integration
def test_wrong_terminal_is_rejected_before_connect(relay):
    client, bridge, calls = relay
    client.cookies.set(REMOTE_COOKIE, "session-hai")
    response = client.post("/api/mt5/connect", json={"terminalPath": PROFILE_TERMINALS["hieu"]})
    assert response.status_code == 403
    assert not any(path == "/api/mt5/connect" for _, path, _, _ in calls)


@pytest.mark.integration
@pytest.mark.parametrize("token", [None, "invalid", "session-other"])
def test_only_authenticated_allowed_windows_profiles_can_trade(relay, token):
    client, bridge, calls = relay
    if token:
        client.cookies.set(REMOTE_COOKIE, token)
    # A local owner cookie never grants access to a Windows MT5 account.
    client.cookies.set("nttotv_session", "local-owner")
    assert client.post("/api/orders", json={"user_id": "hieu"}).status_code == 401
    assert not any(path == "/api/orders" for _, path, _, _ in calls)


@pytest.mark.integration
def test_order_identity_and_idempotency_body_are_forwarded_unchanged(relay):
    client, bridge, calls = relay
    client.cookies.set(REMOTE_COOKIE, "session-hai")
    body = {"idempotencyKey": "keep-this-key", "side": "buy", "volumeLots": 0.01}
    assert client.post("/api/orders", json=body).status_code == 200
    method, path, token, encoded = calls[-1]
    assert (method, path, token) == ("POST", "/api/orders", "session-hai")
    assert json.loads(encoded) == body


@pytest.mark.integration
def test_mutation_timeout_is_not_retried_and_public_chart_survives(relay):
    client, bridge, calls = relay
    original = bridge.send

    async def fail(method, path, **kwargs):
        if path == "/api/auth/me":
            return await original(method, path, **kwargs)
        calls.append((method, path, kwargs.get("token"), b""))
        raise URLError("offline")

    bridge.send = fail
    client.cookies.set(REMOTE_COOKIE, "session-hieu")
    assert client.get("/api/health").json() == {"status": "ok"}
    response = client.post("/api/orders", json={"idempotencyKey": "once"})
    assert response.status_code == 504
    assert response.json()["error"]["code"] == "EXECUTION_UNCERTAIN"
    assert sum(path == "/api/orders" for _, path, _, _ in calls) == 1
    assert client.post("/api/auth/logout").status_code == 200
    assert "Max-Age=0" in client.post("/api/auth/logout").headers.get("set-cookie", "")


@pytest.mark.integration
def test_admin_stays_local_and_login_clears_windows_cookie(relay):
    client, bridge, calls = relay
    client.cookies.set(REMOTE_COOKIE, "session-hieu")
    assert client.get("/api/admin/test").json() == {"owner": "local"}
    assert not calls
    response = client.post("/api/auth/login", json={"username": "admin", "password": "fake"})
    assert response.json()["user"]["username"] == "admin"
    assert REMOTE_COOKIE in response.headers["set-cookie"]
    assert not calls


@pytest.mark.integration
def test_cross_origin_mutation_is_rejected(relay):
    client, bridge, calls = relay
    client.cookies.set(REMOTE_COOKIE, "session-hieu")
    assert client.post("/api/orders", headers={"Origin": "https://other.test"}, json={}).status_code == 403
    assert not any(path == "/api/orders" for _, path, _, _ in calls)


@pytest.mark.unit
@pytest.mark.parametrize("url", ["https://127.0.0.1:18080", "http://public.test:18080", "http://user:pass@127.0.0.1:18080", "http://127.0.0.1:18080/path"])
def test_relay_requires_a_loopback_origin(url):
    with pytest.raises(ValueError):
        WindowsExecutionBridge(url)
