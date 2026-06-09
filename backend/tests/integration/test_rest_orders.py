from __future__ import annotations

from contextlib import contextmanager

import pytest
from fastapi.testclient import TestClient

from app.app import create_app
from app.config import Settings
from app.engines.basis_engine import BasisEngine
from app.models.mt5 import Mt5AccountInfo, Mt5OrderResult, Mt5SymbolInfo, Mt5Tick
from app.models.orders import OrderKind, OrderRecord
from app.models.timestamp import now_ms
from app.rest.contract_state import ContractStateStore
from app.storage.cache_store import CacheStore


class _Manager:
    def __init__(self, backend) -> None:
        self.backend = backend

    def credential_key(self) -> str:
        return "fake-local-development-key"

    @contextmanager
    def backend_session(self):
        yield self.backend

    @contextmanager
    def account_session(self, cache, account):
        connector = getattr(self.backend, "connect_account", None)
        if callable(connector):
            password = cache.users.read_mt5_password(
                account.user_id,
                self.credential_key(),
            )
            connector(
                login=account.login,
                password=password or "",
                server=account.server,
                terminal_path=account.terminal_path,
            )
        yield self.backend


class _StrictSymbolBackend:
    def __init__(self) -> None:
        self.active_login = 1
        self.placed_logins: list[int] = []
        self.placed_orders: list[OrderRecord] = []
        self.closed_orders: list[OrderRecord] = []

    def connect_account(
        self,
        *,
        login: int,
        password: str,
        server: str,
        terminal_path: str | None = None,
    ) -> None:
        self.active_login = int(login)

    def account_info(self, user_id: str, account_id: str) -> Mt5AccountInfo:
        return Mt5AccountInfo(
            account_id=account_id,
            login=self.active_login,
            server="Fake-Demo",
            trade_mode="demo",
            currency="USD",
            balance=10_000.0,
            equity=10_000.0,
            margin=0.0,
            free_margin=10_000.0,
        )

    def symbol_info(self, user_id: str, account_id: str, symbol: str) -> Mt5SymbolInfo:
        if symbol != "XAUUSDm":
            raise RuntimeError(f"Unknown MT5 symbol {symbol!r}")
        return Mt5SymbolInfo(
            symbol=symbol,
            digits=3,
            tick_size=0.001,
            min_lot=0.01,
            max_lot=50.0,
            lot_step=0.01,
            stops_level=0.5,
            pip_value=1.0,
        )

    def symbol_tick(self, user_id: str, account_id: str, symbol: str) -> Mt5Tick:
        return Mt5Tick(symbol=symbol, bid=2350.0, ask=2350.1, time=now_ms())

    def place_order(self, order: OrderRecord) -> Mt5OrderResult:
        self.placed_logins.append(self.active_login)
        self.placed_orders.append(order)
        return Mt5OrderResult(
            accepted=True,
            status="filled",
            broker_position_ticket=self.active_login,
            fill_price=2350.1,
        )

    def modify_order(self, order: OrderRecord) -> Mt5OrderResult:
        return Mt5OrderResult(accepted=True, status=order.status.value)

    def cancel_order(self, order: OrderRecord) -> Mt5OrderResult:
        return Mt5OrderResult(accepted=True, status="cancelled")

    def close_position(self, order: OrderRecord) -> Mt5OrderResult:
        self.closed_orders.append(order)
        return Mt5OrderResult(accepted=True, status="closed")

    def orders(self, user_id: str, account_id: str) -> list[dict]:
        return []

    def positions(self, user_id: str, account_id: str) -> list[dict]:
        return []


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
def test_mt5_status_reports_verified_balance(client: TestClient):
    _login_and_connect(client)

    status = client.get("/api/mt5/status")

    assert status.status_code == 200
    body = status.json()
    assert body["connected"] is True
    assert body["account"]["balance"] == 10_000.0
    assert body["account"]["equity"] == 10_000.0
    assert body["account"]["currency"] == "USD"


@pytest.mark.integration
def test_mt5_connect_does_not_persist_invalid_symbol(client: TestClient):
    client.app.state.mt5_manager = _Manager(_StrictSymbolBackend())
    assert client.post(
        "/api/auth/login", json={"username": "local", "password": "local"}
    ).status_code == 200

    good = client.post(
        "/api/mt5/connect",
        json={
            "login": 1,
            "password": "fake",
            "server": "Fake-Demo",
            "symbolBroker": "XAUUSDm",
        },
    )
    assert good.status_code == 200

    bad = client.post(
        "/api/mt5/connect",
        json={
            "login": 1,
            "password": "fake",
            "server": "Fake-Demo",
            "symbolBroker": "XAUUSD",
        },
    )
    assert bad.status_code == 400
    assert "Unknown MT5 symbol 'XAUUSD'" in bad.json()["error"]["message"]

    status = client.get("/api/mt5/status")
    assert status.status_code == 200
    assert status.json()["connected"] is True
    assert status.json()["account"]["symbolBroker"] == "XAUUSDm"


@pytest.mark.integration
def test_mt5_connect_auto_detects_symbol_when_omitted(client: TestClient):
    client.app.state.mt5_manager = _Manager(_StrictSymbolBackend())
    assert client.post(
        "/api/auth/login", json={"username": "local", "password": "local"}
    ).status_code == 200

    detected = client.post(
        "/api/mt5/connect",
        json={
            "login": 1,
            "password": "fake",
            "server": "Fake-Demo",
        },
    )

    assert detected.status_code == 200
    assert detected.json()["account"]["symbolBroker"] == "XAUUSDm"


@pytest.mark.integration
def test_two_users_place_orders_with_their_own_mt5_logins(client: TestClient):
    backend = _StrictSymbolBackend()
    client.app.state.mt5_manager = _Manager(backend)

    assert client.post(
        "/api/auth/register", json={"username": "alice", "password": "pw"}
    ).status_code == 200
    assert client.post(
        "/api/mt5/connect",
        json={
            "login": 11,
            "password": "fake",
            "server": "Fake-Demo",
            "symbolBroker": "XAUUSDm",
        },
    ).status_code == 200
    current = now_ms()
    client.app.state.basis_engine.update_gc(2350.0, current)
    client.app.state.basis_engine.update_broker_mid(2350.05, current)
    alice_order = client.post(
        "/api/orders",
        json={
            "source": "market_bar",
            "side": "buy",
            "kind": "market",
            "volumeLots": 0.1,
            "idempotencyKey": "alice-order",
        },
    )
    assert alice_order.status_code == 200
    assert alice_order.json()["order"]["brokerPositionTicket"] == 11

    assert client.post("/api/auth/logout").status_code == 200
    assert client.post(
        "/api/auth/register", json={"username": "bob", "password": "pw"}
    ).status_code == 200
    assert client.post(
        "/api/mt5/connect",
        json={
            "login": 22,
            "password": "fake",
            "server": "Fake-Demo",
            "symbolBroker": "XAUUSDm",
        },
    ).status_code == 200
    current = now_ms()
    client.app.state.basis_engine.update_gc(2350.0, current)
    client.app.state.basis_engine.update_broker_mid(2350.05, current)
    bob_order = client.post(
        "/api/orders",
        json={
            "source": "market_bar",
            "side": "sell",
            "kind": "market",
            "volumeLots": 0.1,
            "idempotencyKey": "bob-order",
        },
    )
    assert bob_order.status_code == 200
    assert bob_order.json()["order"]["brokerPositionTicket"] == 22
    assert backend.placed_logins == [11, 22]


@pytest.mark.integration
def test_market_order_distances_are_anchored_to_broker_tick(client: TestClient):
    backend = _StrictSymbolBackend()
    client.app.state.mt5_manager = _Manager(backend)
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

    resp = client.post(
        "/api/orders",
        json={
            "source": "market_bar",
            "side": "buy",
            "kind": "market",
            "volumeLots": 0.1,
            "entryGc": 9999.0,
            "slDistanceGc": 3,
            "tpDistanceGc": 6,
            "idempotencyKey": "market-stops-anchor",
        },
    )

    assert resp.status_code == 200
    placed = backend.placed_orders[-1]
    assert placed.entry_broker == 2350.1
    assert placed.sl_broker == 2347.1
    assert placed.tp_broker == 2356.1


@pytest.mark.integration
def test_market_order_fill_estimate_uses_current_raw_basis(client: TestClient):
    backend = _StrictSymbolBackend()
    client.app.state.mt5_manager = _Manager(backend)
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
    current = now_ms()
    client.app.state.basis_engine.update_gc(2374.05, current)

    resp = client.post(
        "/api/orders",
        json={
            "source": "market_bar",
            "side": "sell",
            "kind": "market",
            "volumeLots": 0.1,
            "idempotencyKey": "market-current-raw-basis",
        },
    )

    assert resp.status_code == 200
    order = resp.json()["order"]
    assert order["basisAtSubmit"] == pytest.approx(-24.0)
    assert order["basisAtFill"] == pytest.approx(-24.0)
    assert order["entryGc"] == 2374.0
    assert order["fillPriceGcEstimate"] == 2374.1


@pytest.mark.integration
def test_market_order_reference_gc_bootstraps_basis(client: TestClient):
    backend = _StrictSymbolBackend()
    client.app.state.mt5_manager = _Manager(backend)
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

    resp = client.post(
        "/api/orders",
        json={
            "source": "market_bar",
            "side": "sell",
            "kind": "market",
            "volumeLots": 0.1,
            "referenceGc": 2374.05,
            "idempotencyKey": "market-reference-basis",
        },
    )

    assert resp.status_code == 200
    order = resp.json()["order"]
    assert order["basisAtSubmit"] == pytest.approx(-24.0)
    assert order["basisAtFill"] == pytest.approx(-24.0)
    assert order["entryGc"] == 2374.0
    assert order["fillPriceGcEstimate"] == 2374.1


@pytest.mark.integration
def test_chart_bracket_uses_reference_gc_to_convert_pending_price(client: TestClient):
    backend = _StrictSymbolBackend()
    client.app.state.mt5_manager = _Manager(backend)
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

    resp = client.post(
        "/api/orders",
        json={
            "source": "chart_bracket",
            "side": "buy",
            "kind": "stop",
            "volumeLots": 0.1,
            "referenceGc": 2370.0,
            "entryGc": 2360.0,
            "slGc": 2355.0,
            "tpGc": 2372.0,
            "idempotencyKey": "chart-reference",
        },
    )

    assert resp.status_code == 200
    order = resp.json()["order"]
    assert order["kind"] == "limit"
    assert order["entryBroker"] == 2340.05
    assert order["slBroker"] == 2335.05
    assert order["tpBroker"] == 2352.05
    placed = backend.placed_orders[-1]
    assert placed.kind is OrderKind.LIMIT


@pytest.mark.integration
def test_orders_require_auth(client: TestClient):
    resp = client.get("/api/orders")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.integration
def test_orders_require_mt5_account(client: TestClient):
    assert client.post(
        "/api/auth/register", json={"username": "local", "password": "local"}
    ).status_code == 200
    resp = client.post(
        "/api/orders",
        json={
            "source": "market_bar",
            "side": "buy",
            "kind": "market",
            "volumeLots": 0.1,
            "idempotencyKey": "missing-mt5",
        },
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["field"] == "account"


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
def test_open_order_list_reconciles_manual_mt5_close(client: TestClient):
    backend = _StrictSymbolBackend()
    client.app.state.mt5_manager = _Manager(backend)
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

    created = client.post(
        "/api/orders",
        json={
            "source": "market_bar",
            "side": "buy",
            "kind": "market",
            "volumeLots": 0.1,
            "idempotencyKey": "manual-close-reconcile",
        },
    )
    assert created.status_code == 200

    open_orders = client.get("/api/orders?openOnly=true")

    assert open_orders.status_code == 200
    assert open_orders.json()["orders"] == []
    all_orders = client.get("/api/orders").json()["orders"]
    assert all_orders[0]["status"] == "closed"


@pytest.mark.integration
def test_close_order_treats_missing_broker_position_as_closed(client: TestClient):
    backend = _StrictSymbolBackend()
    client.app.state.mt5_manager = _Manager(backend)
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
    created = client.post(
        "/api/orders",
        json={
            "source": "market_bar",
            "side": "buy",
            "kind": "market",
            "volumeLots": 0.1,
            "idempotencyKey": "manual-close-button",
        },
    )
    order = created.json()["order"]

    closed = client.post(f"/api/orders/{order['id']}/close")

    assert closed.status_code == 200
    assert closed.json()["order"]["status"] == "closed"
    assert backend.closed_orders == []


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
