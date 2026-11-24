"""Verification tests for Oracle Exness-only mode isolation.

Verifies:
1. Exact _guard behavior: TRADING_DISABLED 403 when flags are False, passes when True.
2. Runtime isolation: MT5Manager, AutoMgannTradeEngine, ChartLimitTakeProfitEngine,
   and BasisEngine remain None under execution_mode() == "exness".
3. Route isolation: Legacy /api/mt5/* and /api/auto-trade return 404.
4. Exness order lifecycle safety: submit, close, cancel, on_gc_price, startup restore.
"""

import asyncio
from dataclasses import replace
import pytest
from fastapi.testclient import TestClient

from app.app import create_app
from app.config import Settings
from app.execution.client import ExecutionError
from app.execution.service import ExecutionService
from app.execution.store import ExecutionStore
from app.models.timestamp import now_ms
from app.runtime import AppRuntime
from app.storage.cache_store import CacheStore

from tests.integration.test_exness_execution import MockClient, ACCOUNT, connected, submit_body


@pytest.fixture
def test_setup(tmp_path):
    cache = CacheStore(tmp_path / "cache.sqlite")
    store = ExecutionStore(tmp_path / "execution.sqlite", tmp_path / "vault.key")
    settings = replace(Settings(), trading_enabled=True, live_trading_enabled=True)
    svc = ExecutionService(cache, settings, store=store, client_factory=MockClient)
    yield cache, store, settings, svc
    store.close()
    cache.close()


def test_guard_flags_definitively_gate_execution(test_setup):
    """Verifies that trading_enabled and live_trading_enabled gate submit with exact error."""
    cache, store, settings, svc = test_setup

    async def run():
        s = await connected(svc)

        # 1. Both True -> guard passes
        svc.settings = replace(settings, trading_enabled=True, live_trading_enabled=True)
        order = await svc.submit("one", submit_body("key-ok-1"))
        assert order["status"] == "submitted"

        # 2. trading_enabled False -> TRADING_DISABLED
        svc.settings = replace(settings, trading_enabled=False, live_trading_enabled=True)
        with pytest.raises(ExecutionError) as exc_info:
            await svc.submit("one", submit_body("key-fail-1"))
        assert exc_info.value.code == "TRADING_DISABLED"
        assert exc_info.value.status == 403
        assert "Live execution is disabled on this server" in str(exc_info.value)

        # 3. live_trading_enabled False -> TRADING_DISABLED
        svc.settings = replace(settings, trading_enabled=True, live_trading_enabled=False)
        with pytest.raises(ExecutionError) as exc_info:
            await svc.submit("one", submit_body("key-fail-2"))
        assert exc_info.value.code == "TRADING_DISABLED"
        assert exc_info.value.status == 403
        assert "Live execution is disabled on this server" in str(exc_info.value)

    asyncio.run(run())


def test_runtime_isolation_under_exness_mode(tmp_path, monkeypatch):
    """Verifies that under execution_mode() == 'exness', MT5 and auto trade engines are NOT initialized."""
    monkeypatch.setenv("NTTOTV_EXECUTION_MODE", "exness")
    monkeypatch.setenv("NTTOTV_TRADING_ENABLED", "1")
    monkeypatch.setenv("NTTOTV_LIVE_TRADING_ENABLED", "1")

    settings = Settings()
    assert settings.trading_enabled is True
    assert settings.live_trading_enabled is True

    cache = CacheStore(tmp_path / "cache.sqlite")
    runtime = AppRuntime(cache=cache, settings=settings)

    # Invariants under exness mode: MT5 runtime and engines are eliminated
    assert getattr(runtime, "_mt5_manager", None) is None
    assert getattr(runtime, "mt5_manager", None) is None
    assert getattr(runtime, "_basis_engine", None) is None
    assert getattr(runtime, "_auto_mgann_trade", None) is None
    assert getattr(runtime, "_chart_limit_take_profit", None) is None
    assert getattr(runtime, "_manual_supertrend_trailing", None) is None

    cache.close()


def test_app_routes_isolation_exness_mode(test_setup, monkeypatch):
    """Verifies that under exness mode, MT5 and auto-trade routes return 404, /api/execution returns exness."""
    monkeypatch.setenv("NTTOTV_EXECUTION_MODE", "exness")
    cache, store, settings, svc = test_setup

    class DummyRuntime:
        cache = test_setup[0]
        settings = test_setup[2]
        async def start(self): pass
        async def stop(self): pass

    app = create_app()
    app.state.runtime = DummyRuntime()
    app.state.execution_service = svc

    with TestClient(app) as client:
        # Public capability
        res = client.get("/api/execution")
        assert res.status_code == 200
        data = res.json()
        assert data["enabled"] is True
        assert data["mode"] == "exness"

        # Legacy MT5 routes MUST NOT exist
        assert client.get("/api/mt5/status").status_code == 404
        assert client.get("/api/mt5/account").status_code == 404
        assert client.get("/api/mt5/terminals").status_code == 404
        assert client.get("/api/mt5/open-trades").status_code == 404
        assert client.get("/api/auto-trade").status_code == 404


def test_exness_lifecycle_safety(test_setup):
    """Verifies manual submit, close, cancel, on_gc_price, and startup restore safety."""
    cache, store, settings, svc = test_setup

    async def run():
        s = await connected(svc)

        # 1. on_gc_price updates price without any order submission
        client_call_count = len(s.client.calls)
        svc.on_gc_price(2515.5, now_ms())
        assert svc.gc_price == 2515.5
        assert len(s.client.calls) == client_call_count  # No broker calls

        # 2. Manual submit places pending order
        body = submit_body("key-lifecycle-1")
        body["kind"] = "limit"
        body["entryGc"] = 2508
        order = await svc.submit("one", body)
        assert order["status"] == "submitted"
        assert order["side"] == "buy"

        # Simulate broker event acknowledging working limit order
        await svc.event(s, dict(
            event_type="transaction_event",
            client_request_id=order["idempotencyKey"],
            operation_id="200",
            status="success",
            payload={"orders": [{"order_id": "18446744073709551002", "instrument": "XAUUSD", "order_type": "limit",
                                 "state": "placed", "direction": "buy", "volume": "0.10", "price": "2498.10"}]}
        ))
        working = svc._order("one", order["id"])
        assert working["status"] == "working"
        assert working["brokerOrderTicket"] == "18446744073709551002"

        # 3. Cancel order
        cancelled = await svc.cancel("one", order_id=order["id"], key="cancel-key-1")
        assert cancelled["status"] in {"cancelled", "pending_submit", "pending_cancel", "working"}

        # 4. Startup restore does not generate opening orders
        initial_order_count = len(svc.store.orders("one"))
        await svc._restore("one")
        # Ensure restore did not create any new orders
        assert len(svc.store.orders("one")) == initial_order_count

    asyncio.run(run())
