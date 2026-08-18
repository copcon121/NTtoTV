from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.app import create_app
from app.config import Settings, settings as default_settings
from app.engines.basis_engine import BasisEngine
from app.mt5.manager import Mt5Manager
from app.rest.contract_state import ContractStateStore
from app.storage.cache_store import CacheStore


@pytest.fixture()
def client(tmp_path):
    settings = Settings(
        data_dir=tmp_path,
        mt5_backend="fake",
        credential_key="fake-local-development-key",
    )
    cache = CacheStore(tmp_path / "app.sqlite")
    app = create_app(lifespan=False)
    app.state.contract_state = ContractStateStore(cache, settings=settings)
    app.state.basis_engine = BasisEngine(settings=settings)
    app.state.mt5_manager = Mt5Manager(settings=settings)
    app.state.settings = settings
    try:
        with TestClient(app) as c:
            yield c
    finally:
        cache.close()


def _registration(username: str, password: str) -> dict[str, str]:
    payload = {"username": username, "password": password}
    if default_settings.invite_code:
        payload["inviteCode"] = default_settings.invite_code
    return payload


@pytest.mark.integration
def test_auto_trade_settings_require_mt5_to_enable_and_persist_lot(client):
    assert client.post("/api/auth/register", json=_registration("auto", "pw")).status_code == 200

    initial = client.get("/api/auto-trade")
    assert initial.status_code == 200
    assert initial.json()["settings"] == {
        "longEnabled": False,
        "shortEnabled": False,
        "volumeLots": 0.1,
        "updatedAt": 0,
    }

    locked = client.put(
        "/api/auto-trade",
        json={"longEnabled": True, "shortEnabled": False, "volumeLots": 0.2},
    )
    assert locked.status_code == 404

    assert client.post(
        "/api/mt5/connect",
        json={
            "login": 1,
            "password": "fake",
            "server": "Fake-Demo",
            "symbolBroker": "XAUUSDm",
        },
    ).status_code == 200

    saved = client.put(
        "/api/auto-trade",
        json={"longEnabled": True, "shortEnabled": False, "volumeLots": 0.2},
    )
    assert saved.status_code == 200
    assert saved.json()["settings"] == {
        "longEnabled": True,
        "shortEnabled": False,
        "volumeLots": 0.2,
        "updatedAt": saved.json()["settings"]["updatedAt"],
    }
    assert saved.json()["settings"]["updatedAt"] > 0
    assert client.get("/api/auto-trade").json()["settings"]["volumeLots"] == 0.2
