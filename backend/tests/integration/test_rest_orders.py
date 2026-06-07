from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.app import create_app
from app.config import Settings
from app.engines.basis_engine import BasisEngine
from app.rest.contract_state import ContractStateStore
from app.storage.cache_store import CacheStore


@pytest.fixture()
def client(tmp_path):
    settings = Settings(data_dir=tmp_path)
    cache = CacheStore(tmp_path / "app.sqlite")
    app = create_app(lifespan=False)
    app.state.contract_state = ContractStateStore(cache, settings=settings)
    app.state.basis_engine = BasisEngine(settings=settings)
    try:
        with TestClient(app) as c:
            yield c
    finally:
        cache.close()


def _login_and_connect(client: TestClient) -> None:
    assert client.post(
        "/api/auth/login", json={"username": "local", "password": "local"}
    ).status_code == 200
    assert client.post(
        "/api/mt5/connect",
        json={
            "login": 1,
            "password": "fake",
            "server": "Fake-Demo",
            "symbolBroker": "XAUUSDm",
        },
    ).status_code == 200


@pytest.mark.integration
def test_orders_require_auth(client: TestClient):
    resp = client.get("/api/orders")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.integration
def test_market_order_lifecycle_with_fake_mt5(client: TestClient):
    _login_and_connect(client)

    resp = client.post(
        "/api/orders",
        json={
            "source": "market_bar",
            "side": "buy",
            "kind": "market",
            "volumeLots": 0.1,
            "slDistanceGc": 3,
            "tpDistanceGc": 6,
            "idempotencyKey": "idem-1",
        },
    )

    assert resp.status_code == 200
    order = resp.json()["order"]
    assert order["status"] == "filled"
    assert order["brokerPositionTicket"] is not None

    again = client.post(
        "/api/orders",
        json={
            "source": "market_bar",
            "side": "buy",
            "kind": "market",
            "volumeLots": 0.1,
            "idempotencyKey": "idem-1",
        },
    )
    assert again.status_code == 200
    assert again.json()["idempotent"] is True
    assert again.json()["order"]["id"] == order["id"]

    closed = client.post(f"/api/orders/{order['id']}/close")
    assert closed.status_code == 200
    assert closed.json()["order"]["status"] == "closed"


@pytest.mark.integration
def test_pending_order_patch_uses_expected_version(client: TestClient):
    _login_and_connect(client)

    created = client.post(
        "/api/orders",
        json={
            "source": "chart_bracket",
            "side": "buy",
            "kind": "limit",
            "volumeLots": 0.1,
            "entryGc": 2349.0,
            "slGc": 2346.0,
            "tpGc": 2355.0,
            "idempotencyKey": "idem-pending",
        },
    )
    assert created.status_code == 200
    order = created.json()["order"]
    assert order["status"] == "working"

    patched = client.patch(
        f"/api/orders/{order['id']}",
        json={"slGc": 2346.5, "expectedVersion": order["version"]},
    )
    assert patched.status_code == 200
    updated = patched.json()["order"]
    assert updated["slGc"] == 2346.5
    assert updated["version"] == order["version"] + 1

    conflict = client.patch(
        f"/api/orders/{order['id']}",
        json={"slGc": 2347.0, "expectedVersion": order["version"]},
    )
    assert conflict.status_code == 409
