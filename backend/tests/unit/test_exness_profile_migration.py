import asyncio
import json

import pytest

from app.execution.profile_migration import import_windows_profile
from app.storage.cache_store import CacheStore
from app.windows_execution import WindowsExecutionBridge, RelayReply


@pytest.mark.unit
def test_successful_legacy_profile_login_imports_only_the_own_workspace(tmp_path, monkeypatch):
    monkeypatch.setenv("NTTOTV_EXECUTION_MODE", "exness")
    monkeypatch.setenv("NTTOTV_WINDOWS_EXECUTION_URL", "http://127.0.0.1:18080")
    cache = CacheStore(tmp_path/"cache.sqlite")
    owner = cache.users.create_user("admin", "owner-test-password")
    calls = []
    async def send(self, method, path, **kwargs):
        calls.append((method, path))
        if path.endswith("/login"):
            return RelayReply(200, b'{"user":{"username":"hieu"}}', cookies=("nttotv_session=fixture-token; HttpOnly",))
        if path == "/api/me/profile":
            return RelayReply(200, json.dumps({"profile": {"payload": {"version": 1, "timeframe": "5m"}}}).encode())
        return RelayReply(200, b"{}")
    monkeypatch.setattr(WindowsExecutionBridge, "send", send)
    user = asyncio.run(import_windows_profile(cache, "hieu", "user-test-password"))
    assert user.username == "hieu"
    assert cache.read_profile(user.id, user.id).payload["timeframe"] == "5m"
    assert cache.users.read_first_user().id == owner.id
    assert calls == [("POST", "/api/auth/login"), ("GET", "/api/me/profile"), ("POST", "/api/auth/logout")]
    calls.clear()
    assert asyncio.run(import_windows_profile(cache, "hieu", "other-password")) is None
    assert asyncio.run(import_windows_profile(cache, "admin", "wrong-password")) is None
    assert calls == []
    cache.close()


@pytest.mark.unit
def test_local_https_login_uses_a_secure_session_cookie(tmp_path):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.rest.auth import router
    from app.rest.alerts import get_cache
    cache = CacheStore(tmp_path/"cache.sqlite")
    cache.users.create_user("alice", "test-password")
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_cache] = lambda: cache
    with TestClient(app, base_url="https://fixture.test") as client:
        response = client.post("/api/auth/login", json={"username": "alice", "password": "test-password"})
        assert response.status_code == 200
        cookie = response.headers.get_list("set-cookie")[0]
        assert "Secure" in cookie and "HttpOnly" in cookie and "SameSite=lax" in cookie
    cache.close()
