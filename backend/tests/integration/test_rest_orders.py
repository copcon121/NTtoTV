from __future__ import annotations

from contextlib import contextmanager
from concurrent.futures import ThreadPoolExecutor
from threading import Event

import pytest
from fastapi.testclient import TestClient

from app.app import create_app
from app.config import Settings, settings as default_settings
from app.engines.basis_engine import BasisEngine
from app.models.mt5 import Mt5AccountInfo, Mt5OrderResult, Mt5SymbolInfo, Mt5Tick
from app.models.orders import OrderKind, OrderRecord
from app.models.timestamp import now_ms
from app.mt5.manager import Mt5Manager
from app.rest.contract_state import ContractStateStore
from app.storage.cache_store import CacheStore
from app.storage.records import BarRecord


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


class _PositionTrackingBackend(_StrictSymbolBackend):
    def __init__(self) -> None:
        super().__init__()
        self.positions_by_ticket: dict[int, dict] = {}

    def place_order(self, order: OrderRecord) -> Mt5OrderResult:
        result = super().place_order(order)
        ticket = int(result.broker_position_ticket or self.active_login)
        self.positions_by_ticket[ticket] = {
            "ticket": ticket,
            "symbol": order.symbol_broker,
            "side": order.side.value,
            "volumeLots": order.volume_lots,
            "entryBroker": result.fill_price or order.entry_broker or 2350.1,
            "time": now_ms(),
        }
        return result

    def close_position(self, order: OrderRecord) -> Mt5OrderResult:
        self.closed_orders.append(order)
        if order.broker_position_ticket in self.positions_by_ticket:
            row = self.positions_by_ticket[order.broker_position_ticket]
            remaining = float(row["volumeLots"]) - order.volume_lots
            if remaining > 1e-9:
                row["volumeLots"] = round(remaining, 10)
                row["time"] = now_ms()
            else:
                self.positions_by_ticket.pop(order.broker_position_ticket, None)
        return Mt5OrderResult(accepted=True, status="closed")

    def positions(self, user_id: str, account_id: str) -> list[dict]:
        return list(self.positions_by_ticket.values())


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
def test_user_can_switch_login_on_their_existing_terminal_path(client: TestClient):
    client.app.state.mt5_manager = _Manager(_StrictSymbolBackend())
    assert client.post(
        "/api/auth/login", json={"username": "local", "password": "local"}
    ).status_code == 200
    terminal_path = r"C:\MT5\terminal64.exe"

    first = client.post(
        "/api/mt5/connect",
        json={
            "login": 11,
            "password": "fake",
            "server": "Fake-Demo",
            "symbolBroker": "XAUUSDm",
            "terminalPath": terminal_path,
        },
    )
    switched = client.post(
        "/api/mt5/connect",
        json={
            "login": 22,
            "password": "fake",
            "server": "Fake-Demo-2",
            "symbolBroker": "XAUUSDm",
            "terminalPath": terminal_path,
        },
    )

    assert first.status_code == 200
    assert switched.status_code == 200
    assert switched.json()["account"]["login"] == 22


@pytest.mark.integration
def test_user_cannot_switch_terminal_assigned_to_another_user(client: TestClient):
    terminal_path = r"C:\MT5\terminal64.exe"
    assert client.post(
        "/api/auth/register", json=_registration("terminal-owner", "pw")
    ).status_code == 200
    assert client.post(
        "/api/mt5/connect",
        json={
            "login": 11,
            "password": "fake",
            "server": "Fake-Demo",
            "symbolBroker": "XAUUSDm",
            "terminalPath": terminal_path,
        },
    ).status_code == 200
    assert client.post("/api/auth/logout").status_code == 200
    assert client.post(
        "/api/auth/register", json=_registration("terminal-contender", "pw")
    ).status_code == 200

    rejected = client.post(
        "/api/mt5/connect",
        json={
            "login": 22,
            "password": "fake",
            "server": "Fake-Demo-2",
            "symbolBroker": "XAUUSDm",
            "terminalPath": terminal_path,
        },
    )

    assert rejected.status_code == 400
    assert "assigned to another user's account 11" in rejected.json()["error"]["message"]


@pytest.mark.integration
def test_configured_terminal_can_only_be_used_by_its_named_user(client: TestClient):
    terminal_path = r"C:\Program Files\MetaTrader 5\terminal64.exe"
    assert client.post(
        "/api/auth/register", json=_registration("hieu", "pw")
    ).status_code == 200
    allowed = client.post(
        "/api/mt5/connect",
        json={
            "login": 263466221,
            "password": "fake",
            "server": "Exness-MT5Real37",
            "symbolBroker": "XAUUSDm",
            "terminalPath": terminal_path,
        },
    )
    assert allowed.status_code == 200

    assert client.post("/api/auth/logout").status_code == 200
    assert client.post(
        "/api/auth/register", json=_registration("someone-else", "pw")
    ).status_code == 200
    rejected = client.post(
        "/api/mt5/connect",
        json={
            "login": 263466221,
            "password": "fake",
            "server": "Exness-MT5Real37",
            "symbolBroker": "XAUUSDm",
            "terminalPath": terminal_path,
        },
    )

    assert rejected.status_code == 400
    assert "reserved for user hieu" in rejected.json()["error"]["message"]


@pytest.mark.integration
def test_two_users_place_orders_with_their_own_mt5_logins(client: TestClient):
    backend = _StrictSymbolBackend()
    client.app.state.mt5_manager = _Manager(backend)

    assert client.post(
        "/api/auth/register", json=_registration("alice", "pw")
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
        "/api/auth/register", json=_registration("bob", "pw")
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
            "takeProfit1rEnabled": True,
            "takeProfitR": 1.5,
            "autoSupertrendAfter1rEnabled": True,
            "trailingTimeframe": "5m",
            "trailingPeriod": 14,
            "trailingMultiplier": 2.5,
            "trailingAtrMethod": "sma",
            "trailingSource": "close",
            "idempotencyKey": "market-stops-anchor",
        },
    )

    assert resp.status_code == 200
    placed = backend.placed_orders[-1]
    assert placed.entry_broker == 2350.1
    assert placed.sl_broker == 2347.1
    assert placed.tp_broker == 2356.1
    assert placed.gc_anchored is False
    assert placed.take_profit_1r_enabled is True
    assert placed.take_profit_r == 1.5
    assert placed.auto_supertrend_after_1r_enabled is True
    assert placed.trailing_timeframe == "5m"
    assert placed.trailing_period == 14
    assert placed.trailing_multiplier == 2.5
    assert placed.trailing_atr_method == "sma"
    assert placed.trailing_source == "close"
    assert resp.json()["order"]["takeProfit1rEnabled"] is True
    assert resp.json()["order"]["takeProfitR"] == 1.5
    listed = client.get("/api/orders").json()["orders"]
    assert next(row for row in listed if row["id"] == placed.id)["takeProfitR"] == 1.5
    assert resp.json()["order"]["autoSupertrendAfter1rEnabled"] is True


@pytest.mark.integration
@pytest.mark.parametrize("field,value", [("slDistanceGc", 0), ("slDistanceGc", -3), ("tpDistanceGc", -6), ("slDistanceGc", True), ("slDistanceGc", 0.05)])
def test_invalid_market_distances_do_not_reach_broker(client, field, value):
    backend = _StrictSymbolBackend()
    client.app.state.mt5_manager = _Manager(backend)
    _login_and_connect(client)
    payload = dict(source="market_bar", side="buy", kind="market", volumeLots=0.1,
                   slDistanceGc=3, tpDistanceGc=6, idempotencyKey="bad-distance")
    payload[field] = value
    response = client.post("/api/orders", json=payload)
    assert response.status_code == 400
    assert backend.placed_orders == []


@pytest.mark.integration
def test_market_worker_bracket_is_saved_and_tp_edit_preserves_sl(client):
    class MovedQuoteBackend(_StrictSymbolBackend):
        def place_order(self, order):
            result = super().place_order(order)
            result.submitted_entry_price = 2351.1
            result.submitted_sl_price = 2348.1
            result.submitted_tp_price = 2357.1
            result.fill_price = 2351.1
            return result

    backend = MovedQuoteBackend()
    client.app.state.mt5_manager = _Manager(backend)
    _login_and_connect(client)
    response = client.post("/api/orders", json=dict(
        source="market_bar", side="buy", kind="market", volumeLots=0.1,
        referenceGc=2360, slDistanceGc=3, tpDistanceGc=6, idempotencyKey="moved-quote",
    ))
    assert response.status_code == 200
    order = response.json()["order"]
    assert order["entryBroker"] == 2351.1
    assert order["slBroker"] == 2348.1
    assert order["tpBroker"] == 2357.1
    assert order["gcAnchored"] is False
    client.app.state.basis_engine.update_gc(2365)
    patched = client.patch(f"/api/orders/{order['id']}", json={"tpGc": 2380})
    assert patched.status_code == 200
    after = patched.json()["order"]
    assert after["slBroker"] == order["slBroker"]
    assert after["entryBroker"] == order["entryBroker"]


@pytest.mark.integration
def test_submission_claim_catches_duplicate_after_stale_lookup(client, monkeypatch):
    backend = _StrictSymbolBackend()
    client.app.state.mt5_manager = _Manager(backend)
    _login_and_connect(client)
    payload = dict(source="market_bar", side="buy", kind="market", volumeLots=0.1,
                   slDistanceGc=3, tpDistanceGc=6, idempotencyKey="stale-lookup")
    first = client.post("/api/orders", json=payload)
    assert first.status_code == 200
    store = client.app.state.contract_state.cache.orders
    read = store.read_by_idempotency
    lookups = []

    def stale_read(user_id, key):
        lookups.append(key)
        return None if len(lookups) == 1 else read(user_id, key)

    monkeypatch.setattr(store, "read_by_idempotency", stale_read)
    second = client.post("/api/orders", json=payload)
    assert second.status_code == 200
    assert second.json()["idempotent"] is True
    assert second.json()["order"]["id"] == first.json()["order"]["id"]
    assert len(backend.placed_orders) == 1


@pytest.mark.integration
def test_lost_broker_reply_remains_reconcilable_and_is_not_resubmitted(client):
    class LostReplyBackend(_PositionTrackingBackend):
        def place_order(self, order):
            result = super().place_order(order)
            self.positions_by_ticket[result.broker_position_ticket]["orderId"] = order.id
            raise RuntimeError("worker reply lost")

    backend = LostReplyBackend()
    client.app.state.mt5_manager = _Manager(backend)
    _login_and_connect(client)
    payload = dict(source="market_bar", side="buy", kind="market", volumeLots=0.1,
                   slDistanceGc=3, tpDistanceGc=6, idempotencyKey="lost-reply")
    first = client.post("/api/orders", json=payload)
    assert first.status_code == 409
    assert "outcome is unknown" in first.json()["error"]["message"]
    retry = client.post("/api/orders", json=payload)
    assert retry.status_code == 200
    assert retry.json()["idempotent"] is True
    assert retry.json()["order"]["status"] == "sync_error"
    listed = client.get("/api/orders?openOnly=true")
    assert listed.status_code == 200
    assert listed.json()["orders"][0]["status"] == "filled"
    assert len(backend.placed_orders) == 1


@pytest.mark.integration
@pytest.mark.parametrize("value", [0, -1, 0.01, True, "2", None])
def test_partial_take_profit_rejects_invalid_r(client: TestClient, value):
    _login_and_connect(client)
    response = client.post(
        "/api/orders",
        json={
            "source": "market_bar",
            "side": "buy",
            "kind": "market",
            "volumeLots": 0.1,
            "takeProfit1rEnabled": True,
            "takeProfitR": value,
            "idempotencyKey": "invalid-partial-r",
        },
    )
    assert response.status_code == 400
    assert "takeProfitR" in response.text


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
        "/api/auth/register", json=_registration("local", "local")
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
@pytest.mark.parametrize(
    "action, broker_method",
    [
        ("create", "place_order"),
        ("close", "close_position"),
        ("patch", "modify_order"),
        ("cancel", "cancel_order"),
        ("mt5_close", "close_position"),
        ("mt5_patch_position", "modify_order"),
        ("mt5_patch_order", "modify_order"),
        ("mt5_cancel", "cancel_order"),
    ],
)
def test_slow_broker_does_not_block_health(
    client: TestClient, monkeypatch, action: str, broker_method: str
):
    _login_and_connect(client)
    pending = action in {"cancel", "mt5_patch_order", "mt5_cancel"}
    payload = {
        "source": "chart_bracket" if pending else "market_bar",
        "side": "buy",
        "kind": "limit" if pending else "market",
        "volumeLots": 0.1,
        "entryGc": 2349.0,
        "slGc": 2346.0,
        "tpGc": 2355.0,
        "idempotencyKey": "slow-broker",
    }
    method, path, body = "POST", "/api/orders", payload
    if action != "create":
        created = client.post("/api/orders", json=payload)
        assert created.status_code == 200
        order = created.json()["order"]
        app_path = f"/api/orders/{order['id']}"
        position_path = f"/api/mt5/positions/{order['brokerPositionTicket']}"
        pending_path = f"/api/mt5/orders/{order['brokerOrderTicket']}"
        method, path, body = {
            "close": ("POST", app_path + "/close", {}),
            "patch": ("PATCH", app_path, {"slGc": 2346.5}),
            "cancel": ("DELETE", app_path, None),
            "mt5_close": ("POST", position_path + "/close", {}),
            "mt5_patch_position": ("PATCH", position_path, {"slGc": 2346.5}),
            "mt5_patch_order": ("PATCH", pending_path, {"slGc": 2346.5}),
            "mt5_cancel": ("DELETE", pending_path, None),
        }[action]

    entered, release = Event(), Event()
    backend = client.app.state.mt5_manager.backend
    original = getattr(backend, broker_method)

    def slow_broker(order):
        entered.set()
        assert release.wait(10), "Test did not release broker call"
        return original(order)

    monkeypatch.setattr(backend, broker_method, slow_broker)
    with ThreadPoolExecutor(max_workers=2) as pool:
        operation = pool.submit(client.request, method, path, json=body)
        try:
            assert entered.wait(5), "Request did not reach broker"
            # This must complete while the broker operation is still blocked.
            health = pool.submit(client.get, "/api/health")
            assert health.result(timeout=2).status_code == 200
        finally:
            release.set()
        assert operation.result(timeout=5).status_code == 200


@pytest.mark.integration
def test_concurrent_order_retries_wait_for_original_broker_result(
    client: TestClient, monkeypatch
):
    _login_and_connect(client)
    payload = {
        "source": "market_bar",
        "side": "buy",
        "kind": "market",
        "volumeLots": 0.1,
        "idempotencyKey": "concurrent-retry",
    }
    backend = client.app.state.mt5_manager.backend
    original = backend.place_order
    entered, release = Event(), Event()
    placed = []

    def slow_place(order):
        placed.append(order.id)
        entered.set()
        assert release.wait(10), "Test did not release broker call"
        return original(order)

    monkeypatch.setattr(backend, "place_order", slow_place)
    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(client.post, "/api/orders", json=payload)
        try:
            assert entered.wait(5)
            retry = pool.submit(client.post, "/api/orders", json=payload)
            assert client.get("/api/health").status_code == 200
        finally:
            release.set()
        first_response = first.result(timeout=5)
        retry_response = retry.result(timeout=5)
    assert first_response.status_code == retry_response.status_code == 200
    first_order = first_response.json()["order"]
    assert retry_response.json()["order"] == first_order
    assert first_order["status"] == "filled"
    assert retry_response.json()["idempotent"] is True
    assert placed == [first_order["id"]]


@pytest.mark.integration
def test_supertrend_trailing_arms_manual_order_and_rejects_auto_ls(client: TestClient):
    _login_and_connect(client)
    cache = client.app.state.contract_state._cache
    cache.upsert_bar(
        BarRecord(
            symbol="GC",
            contract="GC",
            timeframe="1m",
            time=60_000,
            open=100.0,
            high=101.0,
            low=99.0,
            close=100.0,
            volume=10,
            closed=True,
            source="bookmap",
        )
    )
    payload = {
        "side": "buy",
        "kind": "market",
        "volumeLots": 0.1,
    }
    manual = client.post(
        "/api/orders",
        json={
            **payload,
            "source": "market_bar",
            "idempotencyKey": "manual-trailing",
        },
    ).json()["order"]
    config = {
        "timeframe": "1m",
        "period": 1,
        "multiplier": 3,
        "atrMethod": "rma",
        "source": "hl2",
    }

    armed = client.put(
        f"/api/supertrend-trailing/orders/{manual['id']}", json=config
    )
    assert armed.status_code == 200
    assert armed.json()["trailing"]["targetId"] == manual["id"]
    assert armed.json()["trailing"]["timeframe"] == "1m"
    listed = client.get("/api/supertrend-trailing")
    assert [row["targetId"] for row in listed.json()["trailings"]] == [manual["id"]]

    disabled = client.delete(
        f"/api/supertrend-trailing/orders/{manual['id']}"
    )
    assert disabled.status_code == 200
    assert client.get("/api/supertrend-trailing").json()["trailings"] == []

    cache.upsert_bar(
        BarRecord(
            symbol="GC",
            contract="GC",
            timeframe="1m",
            time=120_000,
            open=100.0,
            high=100.0,
            low=89.0,
            close=90.0,
            volume=10,
            closed=True,
            source="bookmap",
        )
    )
    wrong_side = client.post(
        "/api/orders",
        json={
            **payload,
            "source": "market_bar",
            "idempotencyKey": "manual-trailing-wrong-side",
        },
    ).json()["order"]
    rejected_side = client.put(
        f"/api/supertrend-trailing/orders/{wrong_side['id']}", json=config
    )
    assert rejected_side.status_code == 409
    assert "above the green SuperTrend line" in rejected_side.json()["error"]["message"]
    assert client.get("/api/supertrend-trailing").json()["trailings"] == []

    auto = client.post(
        "/api/orders",
        json={
            **payload,
            "source": "auto_mgann",
            "idempotencyKey": "auto-no-manual-trailing",
        },
    ).json()["order"]
    rejected = client.put(
        f"/api/supertrend-trailing/orders/{auto['id']}", json=config
    )
    assert rejected.status_code == 409
    assert "does not apply to Auto L/S" in rejected.json()["error"]["message"]


@pytest.mark.integration
def test_close_order_accepts_partial_volume(client: TestClient):
    backend = _PositionTrackingBackend()
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
            "idempotencyKey": "partial-close",
        },
    )
    assert created.status_code == 200
    order = created.json()["order"]

    closed = client.post(f"/api/orders/{order['id']}/close", json={"volumeLots": 0.05})

    assert closed.status_code == 200
    body = closed.json()["order"]
    assert body["status"] == "filled"
    assert body["volumeLots"] == 0.05
    assert backend.closed_orders[-1].volume_lots == 0.05
    assert backend.positions_by_ticket[1]["volumeLots"] == 0.05


class _BreakEvenBackend(_PositionTrackingBackend):
    def __init__(self):
        super().__init__()
        self.bid = 3957.0
        self.modified = []

    def symbol_tick(self, user_id, account_id, symbol):
        return Mt5Tick(symbol=symbol, bid=self.bid, ask=self.bid + 0.065, time=now_ms())

    def place_order(self, order):
        result = super().place_order(order)
        result.fill_price = 3957.065
        self.positions_by_ticket[1].update(entryBroker=result.fill_price,
            slBroker=order.sl_broker, tpBroker=order.tp_broker)
        return result

    def modify_order(self, order):
        self.modified.append((order.sl_broker, order.tp_broker, order.volume_lots))
        self.positions_by_ticket[order.broker_position_ticket].update(
            slBroker=order.sl_broker, tpBroker=order.tp_broker)
        return Mt5OrderResult(True, order.status.value)


@pytest.mark.integration
@pytest.mark.parametrize("side", ["buy", "sell"])
@pytest.mark.parametrize("deleted_tp", [False, True])
def test_partial_close_then_be_uses_broker_fill_and_preserves_current_tp(client, side, deleted_tp):
    backend = _BreakEvenBackend()
    client.app.state.mt5_manager = _Manager(backend)
    _login_and_connect(client)
    created = client.post("/api/orders", json={
        "source": "market_bar", "side": side, "kind": "market",
        "volumeLots": 0.1, "referenceGc": 3966.6, "slDistanceGc": 3,
        "tpDistanceGc": 6, "gcAnchored": False, "idempotencyKey": "partial-be",
    })
    assert created.status_code == 200
    order = created.json()["order"]
    route = f"/api/orders/{order['id']}"
    closed = client.post(route + "/close", json={"volumeLots": 0.05})
    assert closed.status_code == 200
    backend.bid = 3970 if side == "buy" else 3940
    client.app.state.basis_engine.update_gc(3978, now_ms())
    row = backend.positions_by_ticket[1]
    live_tp = None if deleted_tp else (4000.125 if side == "buy" else 3918.42)
    row["tpBroker"] = live_tp

    # The old BE payload re-converts the fill's GC coordinate using today's
    # basis, and therefore submits a different broker stop.
    legacy = client.patch(route, json={"slGc": order["fillPriceGcEstimate"]})
    assert legacy.status_code == 200
    assert backend.modified[-1][0] != pytest.approx(row["entryBroker"])
    row["tpBroker"] = live_tp

    response = client.patch(route, json={"breakEven": True})
    assert response.status_code == 200
    assert backend.modified[-1] == (pytest.approx(3957.065), live_tp, 0.05)
    saved = response.json()["order"]
    assert saved["slBroker"] == pytest.approx(saved["fillPriceBroker"])
    assert saved["slGc"] == saved["fillPriceGcEstimate"]
    assert saved["tpBroker"] == live_tp
    assert saved["volumeLots"] == 0.05
    assert saved["fillPriceBroker"] == order["fillPriceBroker"]

    count = len(backend.modified)
    assert client.patch(route, json={"breakEven": True, "expectedVersion": order["version"]}).status_code == 409
    assert client.patch(route, json={"breakEven": True, "slGc": 4000}).status_code == 400
    backend.positions_by_ticket.clear()
    assert client.patch(route, json={"breakEven": True}).status_code == 409
    assert len(backend.modified) == count


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


@pytest.mark.integration
def test_order_patch_refreshes_basis_from_current_broker_tick(client: TestClient):
    backend = _StrictSymbolBackend()
    client.app.state.mt5_manager = _Manager(backend)
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
            "idempotencyKey": "idem-stale-before-patch",
        },
    )
    assert created.status_code == 200
    order = created.json()["order"]

    # Reproduce a drag after the five-second basis window has expired. The
    # patch endpoint must refresh XAU from MT5 instead of waiting for the next
    # open-trades poll before it accepts the modification.
    client.app.state.basis_engine.update_gc(2350.0, 1)
    assert client.app.state.basis_engine.snapshot().stale is True

    patched = client.patch(
        f"/api/orders/{order['id']}",
        json={"slGc": 2346.5, "expectedVersion": order["version"]},
    )

    assert patched.status_code == 200
    updated = patched.json()["order"]
    assert updated["slGc"] == 2346.5
    assert updated["slBroker"] == pytest.approx(2346.55)
    assert client.app.state.basis_engine.snapshot().stale is False


@pytest.mark.integration
@pytest.mark.parametrize("kind", ["market", "limit"])
@pytest.mark.parametrize("field", ["slGc", "tpGc"])
def test_order_patch_preserves_other_broker_levels_after_basis_change(
    client: TestClient, kind: str, field: str
):
    _login_and_connect(client)
    created = client.post(
        "/api/orders",
        json={
            "source": "chart_bracket",
            "side": "buy",
            "kind": kind,
            "volumeLots": 0.1,
            "entryGc": 2349.0,
            "slGc": 2346.0,
            "tpGc": 2355.0,
            "gcAnchored": False,
            "idempotencyKey": f"patch-preserve-{kind}-{field}",
        },
    )
    assert created.status_code == 200
    original = created.json()["order"]
    client.app.state.basis_engine.update_gc(2374.05, now_ms())

    level = 2370.0 if field == "slGc" else 2380.0
    response = client.patch(f"/api/orders/{original['id']}", json={field: level})

    assert response.status_code == 200
    updated = response.json()["order"]
    assert updated[field] == level
    assert updated[field.replace("Gc", "Broker")] == pytest.approx(level - 24.0)
    for untouched in {"entryGc", "slGc", "tpGc"} - {field}:
        assert updated[untouched] == original[untouched]
        broker_field = untouched.replace("Gc", "Broker")
        assert updated[broker_field] == original[broker_field]

    cleared = client.patch(f"/api/orders/{original['id']}", json={field: None})
    assert cleared.status_code == 200
    assert cleared.json()["order"][field.replace("Gc", "Broker")] is None
