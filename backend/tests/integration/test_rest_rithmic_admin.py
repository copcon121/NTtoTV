from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient

from app.app import create_app
from app.config import Settings
from app.rest import auth as auth_routes
from app.rest.contract_state import ContractStateStore
from app.storage.cache_store import CacheStore


class _Runtime:
    def __init__(self) -> None:
        self.rithmic_service = None
        self.saved = None
        self.calls: list[str] = []
        self.connect_outcome = None
        self.config = {
            "stored": False,
            "user": "",
            "passwordConfigured": False,
        }

    def rithmic_admin_snapshot(self):
        return {
            "config": self.config,
            "runtime": {
                "marketServiceRunning": False,
                "historyServiceRunning": False,
                "marketData": {"preferredSource": "rithmic"},
            },
        }

    def save_rithmic_admin_config(self, body):
        self.calls.append("save")
        self.saved = body
        self.config = {
            **self.config,
            "stored": True,
            "user": body.get("user", ""),
            "passwordConfigured": bool(body.get("password")),
        }
        return self.config

    async def test_rithmic_admin_config(self, body):
        self.calls.append("test")
        return {"ok": True, "result": {"tickerPlant": {"ok": True}, "historyPlant": {"ok": True}}}

    async def connect_rithmic_from_admin(self):
        self.calls.append("connect")
        snapshot = self.rithmic_admin_snapshot()
        if self.connect_outcome is not None:
            snapshot["connection"] = self.connect_outcome
        return snapshot

    async def disconnect_rithmic_from_admin(self):
        self.calls.append("disconnect")
        return self.rithmic_admin_snapshot()


@pytest.fixture()
def admin_env(tmp_path, monkeypatch: pytest.MonkeyPatch):
    settings = Settings(data_dir=tmp_path, invite_code=None)
    monkeypatch.setattr(auth_routes, "default_settings", settings)
    cache = CacheStore(tmp_path / "app.sqlite")
    runtime = _Runtime()
    app = create_app(lifespan=False)
    app.state.contract_state = ContractStateStore(cache, settings=settings)
    app.state.runtime = runtime
    try:
        with TestClient(app) as client:
            yield client, runtime
    finally:
        cache.close()


@pytest.mark.integration
def test_admin_requires_authentication_and_owner(admin_env) -> None:
    client, _runtime = admin_env
    assert client.get("/api/admin/rithmic").status_code == 401

    assert client.post("/api/auth/login", json={"username": "owner", "password": "pw"}).status_code == 200
    assert client.get("/api/admin/rithmic").status_code == 200

    assert client.post("/api/auth/logout").status_code == 200
    time.sleep(0.002)
    assert client.post("/api/auth/register", json={"username": "guest", "password": "pw"}).status_code == 200
    denied = client.get("/api/admin/rithmic")
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "FORBIDDEN"


@pytest.mark.integration
def test_admin_save_test_connect_disconnect_surface(admin_env) -> None:
    client, runtime = admin_env
    client.post("/api/auth/login", json={"username": "owner", "password": "pw"})

    saved = client.put(
        "/api/admin/rithmic",
        json={"user": "paper-user", "password": "do-not-echo"},
    )
    assert saved.status_code == 200
    assert "password" not in saved.json()["config"]
    assert "do-not-echo" not in saved.text

    assert client.post("/api/admin/rithmic/test", json={}).status_code == 200
    assert client.post("/api/admin/rithmic/connect").status_code == 200
    assert client.post("/api/admin/rithmic/disconnect").status_code == 200
    assert runtime.calls == ["save", "test", "connect", "disconnect"]


@pytest.mark.integration
def test_admin_rejects_cross_origin_mutation(admin_env) -> None:
    client, runtime = admin_env
    client.post("/api/auth/login", json={"username": "owner", "password": "pw"})

    response = client.put(
        "/api/admin/rithmic",
        headers={"Origin": "https://attacker.example"},
        json={"user": "paper-user"},
    )

    assert response.status_code == 403
    assert runtime.calls == []


@pytest.mark.integration
def test_admin_connect_reports_confirmed_login_failure(admin_env) -> None:
    client, runtime = admin_env
    client.post("/api/auth/login", json={"username": "owner", "password": "pw"})
    runtime.connect_outcome = {
        "ok": False,
        "state": "failed",
        "message": "Ticker Plant: login rejected rpCode=['13']",
    }

    response = client.post("/api/admin/rithmic/connect")

    assert response.status_code == 200
    assert response.json()["ok"] is False
    assert response.json()["connection"]["state"] == "failed"
