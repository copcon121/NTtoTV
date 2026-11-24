import asyncio
import json
import pytest
from decimal import Decimal
from dataclasses import replace

from app.config import Settings
from app.execution.client import PUBLIC_API_ERRORS, ExecutionError
from app.execution.service import ExecutionService, BrokerSession
from app.execution.store import ExecutionStore
from app.models.timestamp import now_ms
from app.storage.cache_store import CacheStore

ACCOUNT_ID = "18446744073709551000"

class MockClient:
    def __init__(self, poll_response=None):
        self.account_id = ACCOUNT_ID
        self.gateway = "https://fixture.exness.com"
        self.origin = "https://fixture.exness.com"
        self.limits = {}
        self.calls = []
        self.poll_response = poll_response or {"status": "pending"}
        self.trading_path = f"/v1/trading/accounts/{self.account_id}"
        self.config_path = f"/v1/configuration/accounts/{self.account_id}"
        self.snapshot = dict(orders=[], positions=[], account_state={"balance": "366.90", "equity": "366.90", "used_margin": "0"})

    async def request(self, method, path, body=None, *, idempotency=""):
        self.calls.append((method, path, body, idempotency))
        if method == "GET":
            if path.endswith("/snapshot"):
                return self.snapshot
            if "/operations/" in path:
                return self.poll_response
            return {"status": "pending"}
        return {"operation_id": "101", "client_request_id": idempotency, "status": "accepted"}


def create_session(tmp_path, condition_overrides=None, settings_overrides=None, poll_response=None):
    cache = CacheStore(tmp_path / "cache.sqlite")
    store = ExecutionStore(tmp_path / "exec.sqlite", tmp_path / "v.key")
    client = MockClient(poll_response=poll_response)
    service = ExecutionService(cache, replace(Settings(), trading_enabled=True, live_trading_enabled=True),
                               store=store, client_factory=lambda *a, **k: client)
    condition = {
        "instrument": "XAUUSD", "quote_currency": "USD", "contract_size": "100",
        "point_digits": 2, "volume_min": "0.01", "volume_max": "100",
        "volume_step": "0.01", "exec_mode": "market", "trade_mode": "enabled"
    }
    if condition_overrides:
        condition.update(condition_overrides)
    settings = {"currency": "USD", "execution_mode": "market"}
    if settings_overrides:
        settings.update(settings_overrides)
    s = BrokerSession("user1", client, condition["instrument"], settings, condition, {})
    s.synced = s.events_live = s.ticks_live = True
    s.tick, s.tick_at = {"bid": 3619.0, "ask": 3619.2}, now_ms()
    service.sessions["user1"] = s
    service.on_gc_price(3619.1, now_ms())
    return service, s, client, store


@pytest.mark.integration
def test_risk30_sl5_tp15_buy_payload_and_event_rejection(tmp_path):
    """Verify Risk $30, SL 5, TP 15 BUY payload translation and WebSocket event error extraction."""
    async def run():
        service, s, client, store = create_session(tmp_path)
        
        # BUY submit
        order = await service.submit("user1", {
            "source": "market_bar", "side": "buy", "kind": "market",
            "volumeLots": 0.06, "slDistanceGc": 5, "tpDistanceGc": 15,
            "idempotencyKey": "test-buy-risk30"
        })
        assert order["volumeLots"] == 0.06
        method, path, payload, key = client.calls[-1]
        assert method == "POST" and path.endswith("/positions")
        assert payload["instrument"] == "XAUUSD"
        assert payload["side"] == "buy"
        assert payload["volume"] == "0.06"
        assert payload["stop_loss_price"] == "3614.20"  # ask 3619.20 - 5.0
        assert payload["take_profit_price"] == "3634.20"  # ask 3619.20 + 15.0

        # Deliver rejection via WebSocket event with error dict (e.g. insufficient margin)
        msg = {
            "event_type": "transaction_event",
            "client_request_id": key,
            "status": "rejected",
            "error": {"code": "TRADING_RULE_INSUFFICIENT_MARGIN", "message": "Not enough margin"}
        }
        await service.event(s, msg)
        assert s.action_error == "TRADING_RULE_INSUFFICIENT_MARGIN"
        saved = service.orders("user1", False)[0]
        assert saved["status"] == "rejected"
        assert saved["rejectReason"] == "TRADING_RULE_INSUFFICIENT_MARGIN"
        assert not s.positions, "Rejected order must never become a fill or open position"
    asyncio.run(run())


@pytest.mark.integration
def test_risk30_sl5_tp15_sell_payload_and_event_rejection(tmp_path):
    """Verify Risk $30, SL 5, TP 15 SELL payload translation and WebSocket event error extraction."""
    async def run():
        service, s, client, store = create_session(tmp_path)
        
        # SELL submit
        order = await service.submit("user1", {
            "source": "market_bar", "side": "sell", "kind": "market",
            "volumeLots": 0.06, "slDistanceGc": 5, "tpDistanceGc": 15,
            "idempotencyKey": "test-sell-risk30"
        })
        assert order["volumeLots"] == 0.06
        method, path, payload, key = client.calls[-1]
        assert method == "POST" and path.endswith("/positions")
        assert payload["instrument"] == "XAUUSD"
        assert payload["side"] == "sell"
        assert payload["volume"] == "0.06"
        assert payload["stop_loss_price"] == "3624.00"  # bid 3619.00 + 5.0
        assert payload["take_profit_price"] == "3604.00"  # bid 3619.00 - 15.0

        # Deliver rejection with string error in payload
        msg = {
            "event_type": "transaction_event",
            "client_request_id": key,
            "status": "rejected",
            "payload": {"error": "TRADING_RULE_INVALID_PRICE_LEVELS"}
        }
        await service.event(s, msg)
        assert s.action_error == "TRADING_RULE_INVALID_PRICE_LEVELS"
        saved = service.orders("user1", False)[0]
        assert saved["status"] == "rejected"
        assert saved["rejectReason"] == "TRADING_RULE_INVALID_PRICE_LEVELS"
    asyncio.run(run())


@pytest.mark.integration
def test_operation_poller_error_extraction(tmp_path):
    """Verify that _poll_operations extracts error dict from GET /operations/{id}."""
    async def run():
        poll_resp = {
            "operation_id": "101",
            "status": "rejected",
            "error": {"code": "TRADING_RULE_INSUFFICIENT_MARGIN", "message": "Account margin depleted"}
        }
        service, s, client, store = create_session(tmp_path, poll_response=poll_resp)
        
        order = await service.submit("user1", {
            "source": "market_bar", "side": "buy", "kind": "market",
            "volumeLots": 0.06, "slDistanceGc": 5, "tpDistanceGc": 15,
            "idempotencyKey": "test-poll-risk30"
        })
        
        # Fast-forward created_at to trigger poller (> 3000ms age)
        op = store.operation("user1", "test-poll-risk30")
        store.writer.execute("UPDATE execution_operations SET created_at=? WHERE key=?",
                             (now_ms() - 5000, "test-poll-risk30"))
        
        # Trigger real operation polling entry point
        await service._poll_operations(s)
        
        assert s.action_error == "TRADING_RULE_INSUFFICIENT_MARGIN"
        saved = service.orders("user1", False)[0]
        assert saved["status"] == "rejected"
        assert saved["rejectReason"] == "TRADING_RULE_INSUFFICIENT_MARGIN"
        assert not s.positions
    asyncio.run(run())


@pytest.mark.integration
def test_unknown_or_secret_text_safely_falls_back(tmp_path):
    """Verify that arbitrary or sensitive upstream text falls back to generic message without leaking."""
    async def run():
        service, s, client, store = create_session(tmp_path)
        
        order = await service.submit("user1", {
            "source": "market_bar", "side": "buy", "kind": "market",
            "volumeLots": 0.06, "slDistanceGc": 5, "tpDistanceGc": 15,
            "idempotencyKey": "test-leak-safety"
        })
        key = client.calls[-1][3]
        
        # Broker returns unrecognized error text that might contain URL or sensitive info
        msg = {
            "event_type": "transaction_event",
            "client_request_id": key,
            "status": "rejected",
            "error": {"code": "CUSTOM_INTERNAL_ERR", "message": "https://api.exness.com?secret_token=SECRET"}
        }
        await service.event(s, msg)
        # Must fall back safely without leaking secret
        assert s.action_error == "Exness rejected the action"
        assert "SECRET" not in s.action_error
    asyncio.run(run())


@pytest.mark.integration
def test_broker_volume_min_rejects_sub_minimum_sizing(tmp_path):
    """Verify that when broker metadata enforces a higher minimum (e.g. minLot=0.10),
    a volume of 0.06 is rejected by the backend guard, protecting broker rules."""
    async def run():
        # Condition where volume_min = 0.10
        service, s, client, store = create_session(tmp_path, condition_overrides={"volume_min": "0.10"})
        
        with pytest.raises(ExecutionError, match="outside Exness minimum, maximum or lot step"):
            await service.submit("user1", {
                "source": "market_bar", "side": "buy", "kind": "market",
                "volumeLots": 0.06, "slDistanceGc": 5, "tpDistanceGc": 15,
                "idempotencyKey": "test-min-vol-reject"
            })
    asyncio.run(run())


@pytest.mark.integration
def test_broker_volume_step_arithmetic(tmp_path):
    """Verify valid volume step arithmetic across lot step variants."""
    async def run():
        service, s, client, store = create_session(tmp_path, condition_overrides={"volume_step": "0.01", "volume_min": "0.01"})
        v = service.volume(s, 0.06)
        assert v == "0.06"
        
        # Invalid step
        with pytest.raises(ExecutionError, match="outside Exness minimum, maximum or lot step"):
            service.volume(s, 0.065)
    asyncio.run(run())
