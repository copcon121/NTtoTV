from __future__ import annotations

from contextlib import contextmanager

import pytest
from fastapi.testclient import TestClient

from app.app import create_app
from app.config import Settings
from app.engines.basis_engine import BasisEngine
from app.models.mt5 import Mt5AccountInfo, Mt5OrderResult, Mt5SymbolInfo, Mt5Tick
from app.models.orders import OrderRecord
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
        yield self.backend


class _ManualTradeBackend:
    def __init__(self) -> None:
        self.positions_by_ticket = {
            7001: {
                "ticket": 7001,
                "symbol": "XAUUSDm",
                "side": "buy",
                "volumeLots": 0.1,
                "entryBroker": 2350.1,
                "slBroker": 2347.1,
                "tpBroker": 2356.1,
                "profit": 12.5,
                "time": 1000,
            }
        }
        self.orders_by_ticket = {
            8001: {
                "ticket": 8001,
                "symbol": "XAUUSDm",
                "side": "sell",
                "kind": "limit",
                "volumeLots": 0.2,
                "entryBroker": 2360.0,
                "slBroker": 2365.0,
                "tpBroker": 2350.0,
                "time": 2000,
            }
        }
        self.modified_orders: list[OrderRecord] = []

    def account_info(self, user_id: str, account_id: str) -> Mt5AccountInfo:
        return Mt5AccountInfo(
            account_id=account_id,
            login=1,
            server="Fake-Demo",
            trade_mode="demo",
            currency="USD",
            balance=10_000.0,
            equity=10_012.5,
            margin=0.0,
            free_margin=10_000.0,
        )

    def symbol_info(self, user_id: str, account_id: str, symbol: str) -> Mt5SymbolInfo:
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
        return Mt5Tick(symbol=symbol, bid=2350.0, ask=2350.2, time=now_ms())

    def place_order(self, order: OrderRecord) -> Mt5OrderResult:
        return Mt5OrderResult(False, "rejected")

    def modify_order(self, order: OrderRecord) -> Mt5OrderResult:
        self.modified_orders.append(order)
        if order.broker_position_ticket in self.positions_by_ticket:
            row = self.positions_by_ticket[order.broker_position_ticket]
            row["slBroker"] = order.sl_broker
            row["tpBroker"] = order.tp_broker
            row["time"] = now_ms()
        if order.broker_order_ticket in self.orders_by_ticket:
            row = self.orders_by_ticket[order.broker_order_ticket]
            row["entryBroker"] = order.entry_broker
            row["slBroker"] = order.sl_broker
            row["tpBroker"] = order.tp_broker
            row["time"] = now_ms()
        return Mt5OrderResult(True, order.status.value)

    def cancel_order(self, order: OrderRecord) -> Mt5OrderResult:
        self.orders_by_ticket.pop(order.broker_order_ticket, None)
        return Mt5OrderResult(True, "cancelled")

    def close_position(self, order: OrderRecord) -> Mt5OrderResult:
        self.positions_by_ticket.pop(order.broker_position_ticket, None)
        return Mt5OrderResult(True, "closed")

    def orders(self, user_id: str, account_id: str) -> list[dict]:
        return list(self.orders_by_ticket.values())

    def positions(self, user_id: str, account_id: str) -> list[dict]:
        return list(self.positions_by_ticket.values())


@pytest.fixture()
def client(tmp_path):
    settings = Settings(data_dir=tmp_path)
    cache = CacheStore(tmp_path / "app.sqlite")
    app = create_app(lifespan=False)
    app.state.contract_state = ContractStateStore(cache, settings=settings)
    app.state.basis_engine = BasisEngine(settings=settings)
    backend = _ManualTradeBackend()
    app.state.mt5_manager = _Manager(backend)
    try:
        with TestClient(app) as c:
            yield c, backend
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
def test_mt5_open_trades_returns_manual_positions_and_orders(client):
    c, _backend = client
    _login_and_connect(c)
    c.app.state.basis_engine.update_gc(2374.1, now_ms())

    resp = c.get("/api/mt5/open-trades")

    assert resp.status_code == 200
    body = resp.json()
    assert body["positions"][0]["brokerPositionTicket"] == 7001
    assert body["positions"][0]["entryGcEstimate"] == 2374.1
    assert body["orders"][0]["brokerOrderTicket"] == 8001
    assert body["orders"][0]["entryGc"] == 2384.0


@pytest.mark.integration
def test_mt5_manual_position_patch_and_close(client):
    c, backend = client
    _login_and_connect(c)
    c.app.state.basis_engine.update_gc(2374.1, now_ms())

    patched = c.patch("/api/mt5/positions/7001", json={"slGc": 2370.0, "tpGc": None})

    assert patched.status_code == 200
    row = backend.positions_by_ticket[7001]
    assert row["slBroker"] == 2346.0
    assert row["tpBroker"] is None

    closed = c.post("/api/mt5/positions/7001/close")

    assert closed.status_code == 200
    assert 7001 not in backend.positions_by_ticket


@pytest.mark.integration
def test_mt5_manual_order_patch_and_cancel(client):
    c, backend = client
    _login_and_connect(c)
    c.app.state.basis_engine.update_gc(2374.1, now_ms())

    patched = c.patch(
        "/api/mt5/orders/8001",
        json={"entryGc": 2381.0, "slGc": 2385.0, "tpGc": None},
    )

    assert patched.status_code == 200
    row = backend.orders_by_ticket[8001]
    assert row["entryBroker"] == 2357.0
    assert row["slBroker"] == 2361.0
    assert row["tpBroker"] is None

    cancelled = c.delete("/api/mt5/orders/8001")

    assert cancelled.status_code == 200
    assert 8001 not in backend.orders_by_ticket


@pytest.mark.integration
def test_mt5_open_trades_requires_auth(client):
    c, _backend = client
    resp = c.get("/api/mt5/open-trades")
    assert resp.status_code == 401
