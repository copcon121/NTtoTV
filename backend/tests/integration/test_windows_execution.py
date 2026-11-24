from __future__ import annotations

import json
import pytest
from fastapi.testclient import TestClient

from app.app import create_app
from app.execution import execution_mode
from app.execution.profile_migration import import_windows_profile
from app.storage.cache_store import CacheStore
from app.windows_execution import PROFILE_TERMINALS, RelayReply, WindowsExecutionBridge


@pytest.mark.integration
def test_windows_mode_fails_closed_as_disabled_even_when_url_persists(monkeypatch):
    """When NTTOTV_EXECUTION_MODE=windows is configured with an old Windows execution URL,

    execution_mode() must fail closed to 'disabled', and /api/execution must serve
    disabled status with no MT5 or order routes mounted and no relay calls.
    """
    monkeypatch.setenv("NTTOTV_EXECUTION_MODE", "windows")
    monkeypatch.setenv("NTTOTV_WINDOWS_EXECUTION_URL", "http://127.0.0.1:18080")

    assert execution_mode() == "disabled"

    app = create_app(lifespan=False)
    with TestClient(app, base_url="https://oracle.test") as client:
        # /api/execution reports disabled mode only
        res = client.get("/api/execution")
        assert res.status_code == 200
        assert res.json() == {"enabled": False, "mode": "disabled", "profiles": []}

        # Trading and MT5 routes are strictly not found (404)
        assert client.get("/api/mt5/account").status_code == 404
        assert client.post("/api/mt5/connect", json={"terminalPath": "C:\\test"}).status_code == 404
        assert client.post("/api/orders", json={"symbol": "GC"}).status_code == 404
        assert client.get("/api/orders").status_code == 404

        # Health and standard platform endpoints remain healthy
        health = client.get("/api/health")
        assert health.status_code == 200
        assert health.json().get("status") == "ok"


@pytest.mark.integration
def test_unset_execution_mode_defaults_to_exness_ignoring_windows_url(monkeypatch):
    """Unset NTTOTV_EXECUTION_MODE must default to exness, never autodetecting windows."""
    monkeypatch.delenv("NTTOTV_EXECUTION_MODE", raising=False)
    monkeypatch.setenv("NTTOTV_WINDOWS_EXECUTION_URL", "http://127.0.0.1:18080")

    assert execution_mode() == "exness"


@pytest.mark.integration
def test_explicit_disabled_execution_mode(monkeypatch):
    """Explicit NTTOTV_EXECUTION_MODE=disabled must serve disabled execution."""
    monkeypatch.setenv("NTTOTV_EXECUTION_MODE", "disabled")
    monkeypatch.delenv("NTTOTV_WINDOWS_EXECUTION_URL", raising=False)

    assert execution_mode() == "disabled"

    app = create_app(lifespan=False)
    with TestClient(app, base_url="https://oracle.test") as client:
        res = client.get("/api/execution")
        assert res.status_code == 200
        assert res.json() == {"enabled": False, "mode": "disabled", "profiles": []}


@pytest.mark.integration
def test_invalid_execution_mode_raises_value_error(monkeypatch):
    monkeypatch.setenv("NTTOTV_EXECUTION_MODE", "invalid_mode")
    with pytest.raises(ValueError, match="NTTOTV_EXECUTION_MODE must be exness or disabled"):
        execution_mode()


@pytest.mark.integration
def test_profile_migration_transport_preserved_without_trade_relay(tmp_path, monkeypatch):
    """Profile migration uses dedicated transport without trade relay."""
    monkeypatch.setenv("NTTOTV_EXECUTION_MODE", "exness")
    monkeypatch.setenv("NTTOTV_PROFILE_MIGRATION_URL", "http://127.0.0.1:18080")

    cache = CacheStore(tmp_path / "cache.sqlite")
    calls = []

    async def send(self, method, path, **kwargs):
        calls.append((method, path))
        if path.endswith("/login"):
            return RelayReply(200, b'{"user":{"username":"hieu"}}', cookies=("nttotv_session=fixture-token; HttpOnly",))
        if path == "/api/me/profile":
            return RelayReply(200, json.dumps({"profile": {"payload": {"version": 1, "timeframe": "1m"}}}).encode())
        return RelayReply(200, b"{}")

    monkeypatch.setattr(WindowsExecutionBridge, "send", send)

    import asyncio
    user = asyncio.run(import_windows_profile(cache, "hieu", "pass123"))
    assert user is not None
    assert user.username == "hieu"
    assert cache.read_profile(user.id, user.id).payload["timeframe"] == "1m"

    # Only profile migration paths were called; no trade execution paths exist
    assert calls == [("POST", "/api/auth/login"), ("GET", "/api/me/profile"), ("POST", "/api/auth/logout")]
    cache.close()
