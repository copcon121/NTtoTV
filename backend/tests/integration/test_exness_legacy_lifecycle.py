import asyncio
import json
from contextlib import asynccontextmanager
from dataclasses import replace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import Settings
from app.app import create_app
from app.execution.client import ExecutionError
from app.execution.routes import get_execution, install_exness_execution
from app.execution.service import ExecutionService
from app.execution.store import ExecutionStore
from app.execution.monitor import connection_status, probe_connections
from app.models.auth import AuthenticatedUser
from app.models.timestamp import now_ms
from app.storage.records import BarRecord
from app.rest.auth import get_current_user
from app.rest.alerts import get_cache
from app.rest.errors import install_error_handlers
from app.storage.cache_store import CacheStore

ACCOUNT = "18446744073709551000"
POSITION = "18446744073709551001"
ORDER = "18446744073709551002"


class MockClient:
    def __init__(self, api_key, secret, account_id, gateway):
        self.account_id, self.gateway = account_id, gateway
        self.origin, self.limits, self.calls, self.fail = None, {}, [], None
        self.snapshot = dict(orders=[], positions=[], account_state={"balance": "1000", "equity": "1000", "used_margin": "0"})

    @property
    def trading_path(self): return f"/v1/trading/accounts/{self.account_id}"
    @property
    def config_path(self): return f"/v1/configuration/accounts/{self.account_id}"
    async def discover(self): self.origin = "https://fixture.exness.com"

    async def request(self, method, path, body=None, *, idempotency=""):
        self.calls.append((method, path, body, idempotency))
        if method != "GET":
            if self.fail: raise self.fail
            return {"operation_id": str(100+len(self.calls)), "client_request_id": idempotency, "status": "accepted"}
        if path.endswith("/account"):
            return {"account_id": self.account_id, "settings": {"currency": "USD", "trade_mode": "enabled", "account_status": "active", "execution_mode": "market"}}
        if path.endswith("/limits"): return {"limits": {}}
        if path.endswith("/instruments"): return {"instruments": ["XAUUSD", "EURUSD"]}
        if path.endswith("/conditions"):
            return {"instrument": "XAUUSD", "quote_currency": "USD", "contract_size": "100", "point_digits": 2,
                "volume_min": "0.01", "volume_max": "100", "volume_step": "0.01", "exec_mode": "market", "trade_mode": "enabled"}
        if path.endswith("/snapshot"): return self.snapshot
        return {"status": "pending"}

    @asynccontextmanager
    async def stream(self, kind):
        # The fixture drives the state machine explicitly, without a real socket.
        await asyncio.Event().wait()
        yield None


@pytest.fixture
def service(tmp_path):
    cache = CacheStore(tmp_path/"cache.sqlite")
    store = ExecutionStore(tmp_path/"execution.sqlite", tmp_path/"vault.key")
    result = ExecutionService(cache, replace(Settings(), trading_enabled=True, live_trading_enabled=True), store=store, client_factory=MockClient)
    yield result
    store.close()
    cache.close()


async def connected(service, user="one", account=ACCOUNT):
    await service.connect(user, {"apiKey": "exnsk-test-only", "apiSecret": "mock-only", "accountId": account})
    s = service.sessions[user]
    for task in s.tasks: task.cancel()
    await asyncio.gather(*s.tasks, return_exceptions=True)
    s.tasks = []
    s.synced = s.events_live = s.ticks_live = True
    s.tick, s.tick_at = {"bid": 2500, "ask": 2500.2}, now_ms()
    service.on_gc_price(2510, now_ms())
    return s


def submit_body(key="test-create-1", **extra):
    return dict(source="market_bar", side="buy", kind="market", volumeLots=.1, referenceGc=2510,
        slDistanceGc=2, tpDistanceGc=4, gcAnchored=True, idempotencyKey=key, **extra)


async def filled(service, s, order, volume="0.10"):
    await service.event(s, dict(event_type="transaction_event", client_request_id=order["idempotencyKey"], operation_id="200",
        status="success", payload={"orders": [{"order_id": ORDER, "position_id": POSITION, "order_type": "market", "state": "filled"}],
        "positions": [{"position_id": POSITION, "instrument": "XAUUSD", "state": "open", "direction": "buy", "volume": volume, "open_price": "2500.20"}]}))


@pytest.mark.integration
def test_market_open_ack_is_pending_and_final_event_preserves_64bit_ids(service):
    async def run():
        s = await connected(service)
        order = await service.submit("one", submit_body())
        assert order["status"] == "submitted" and order.get("brokerPositionTicket") is None
        method, path, payload, key = s.client.calls[-1]
        assert path.endswith("/positions") and method == "POST"
        assert payload["volume"] == "0.1" and payload["stop_loss_price"] == "2498.20"
        await filled(service, s, order)
        saved = service.orders("one")[0]
        assert saved["status"] == "filled" and saved["brokerPositionTicket"] == POSITION
        assert service.open_trades("one")["positions"][0]["brokerPositionTicket"] == POSITION
        assert service.symbol("one")["pipValue"] == 1
    asyncio.run(run())


@pytest.mark.integration
def test_create_is_idempotent_and_mismatched_reuse_is_rejected(service):
    async def run():
        s = await connected(service)
        first = await service.submit("one", submit_body())
        second = await service.submit("one", submit_body())
        assert first["id"] == second["id"]
        assert sum(m != "GET" for m, *_ in s.client.calls) == 1
        with pytest.raises(ExecutionError, match="different request"):
            changed = submit_body(); changed["volumeLots"] = .2
            await service.submit("one", changed)
    asyncio.run(run())


@pytest.mark.integration
def test_post_ack_rejection_is_not_a_fill(service):
    async def run():
        s = await connected(service)
        order = await service.submit("one", submit_body())
        await service.event(s, dict(event_type="transaction_event", client_request_id=order["idempotencyKey"], status="rejected",
            error_message="TRADING_RULE_INSUFFICIENT_MARGIN", payload={}))
        assert service.orders("one", False)[0]["status"] == "rejected"
        assert not s.positions
    asyncio.run(run())


@pytest.mark.integration
def test_lost_ack_remains_uncertain_and_never_resubmits_or_opens_another_order(service):
    async def run():
        s = await connected(service)
        s.client.fail = ExecutionError("EXECUTION_UNAVAILABLE", "mock transport timeout", 503)
        result = await service.submit("one", submit_body())
        assert result["status"] == "sync_paused"
        await service.submit("one", submit_body())
        with pytest.raises(ExecutionError, match="previous broker action"):
            await service.submit("one", submit_body("another-create"))
        assert sum(m != "GET" for m, *_ in s.client.calls) == 1
    asyncio.run(run())


@pytest.mark.integration
def test_partial_close_uses_query_and_waits_for_final_volume(service):
    async def run():
        s = await connected(service)
        order = await service.submit("one", submit_body())
        await filled(service, s, order)
        result = await service.close("one", order_id=order["id"], volume=.05, key="close-half-once")
        assert result["volumeLots"] == .1
        assert s.client.calls[-1][0:3] == ("DELETE", s.client.trading_path+f"/positions/{POSITION}?volume=0.05", None)
        await service.event(s, dict(event_type="transaction_event", client_request_id="close-half-once", status="success",
            payload={"positions": [{"position_id": POSITION, "instrument": "XAUUSD", "state": "open", "direction": "buy", "volume": "0.05", "open_price": "2500.20"}]}))
        assert service.orders("one")[0]["volumeLots"] == .05
    asyncio.run(run())


@pytest.mark.integration
def test_protection_has_its_own_order_id_and_preserves_omitted_tp(service):
    async def run():
        s = await connected(service)
        order = await service.submit("one", submit_body())
        await filled(service, s, order)
        s.orders["999"] = {"order_id": "999", "position_id": POSITION, "order_type": "sltp", "state": "placed", "take_profit_price": "2504.20"}
        await service.patch("one", {"slGc": 2510.1}, order_id=order["id"])
        method, path, payload, _ = s.client.calls[-1]
        assert method == "PATCH" and path.endswith("/orders/999")
        assert set(payload) == {"stop_loss_price"}
    asyncio.run(run())


@pytest.mark.integration
def test_profiles_are_isolated_and_account_binding_is_unique(service):
    async def run():
        s = await connected(service)
        order = await service.submit("one", submit_body())
        other = await connected(service, "two", "123456")
        assert service.orders("two") == []
        with pytest.raises(ExecutionError, match="not found"):
            service._order("two", order["id"])
        with pytest.raises(ExecutionError, match="not found"):
            await service.close("two", position_id=POSITION)
        with pytest.raises(ExecutionError, match="another profile"):
            await service.connect("two", dict(apiKey="test-key", apiSecret="mock", accountId=ACCOUNT))
    asyncio.run(run())


@pytest.mark.integration
def test_http_surface_requires_user_and_never_returns_saved_secrets(service):
    app = FastAPI()
    install_error_handlers(app)
    install_exness_execution(app)
    app.dependency_overrides[get_execution] = lambda: service
    app.dependency_overrides[get_cache] = lambda: service.cache
    with TestClient(app) as client:
        assert client.post("/api/execution/connect", json={}).status_code == 401
        app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser("one", "one")
        response = client.post("/api/execution/connect", json={"accountId": ACCOUNT, "apiKey": "exnsk-test-only", "apiSecret": "mock-only"})
        assert response.status_code == 200
        assert "exnsk-test-only" not in response.text and "mock-only" not in response.text
        assert "no-store" in response.headers["cache-control"]
        assert client.get("/api/execution/account").json()["account"]["accountId"] == ACCOUNT
        assert client.post("/api/execution/connect", headers={"origin": "https://evil.test"}, json={}).status_code == 403


@pytest.mark.integration
def test_one_r_partial_waits_for_confirmation_and_duplicate_event_does_not_repeat(service):
    async def run():
        s = await connected(service)
        body = submit_body(takeProfit1rEnabled=True)
        body["gcAnchored"] = False
        order = await service.submit("one", body)
        await filled(service, s, order)
        service.on_gc_price(2513, now_ms())
        await service._manage(s)
        await service._manage(s)
        partials = [call for call in s.client.calls if call[0] == "DELETE"]
        assert len(partials) == 1
        event = dict(event_type="transaction_event", operation_id="555", client_request_id="partial1r-"+order["id"],
            status="success", payload={"positions": [{"position_id": POSITION, "instrument": "XAUUSD", "state": "open", "direction": "buy", "volume": "0.05", "open_price": "2500.20"}]})
        await service.event(s, event)
        version = service.orders("one")[0]["version"]
        await service.event(s, event)
        assert service.orders("one")[0]["version"] == version
        await service._manage(s)
        assert len([call for call in s.client.calls if call[0] == "DELETE"]) == 1
        assert service.orders("one")[0]["partial1rDone"] is True
    asyncio.run(run())


@pytest.mark.integration
def test_stale_basis_blocks_entry_but_not_explicit_risk_reduction(service):
    async def run():
        s = await connected(service)
        order = await service.submit("one", submit_body())
        await filled(service, s, order)
        service.gc_at = now_ms()-10_000
        with pytest.raises(ExecutionError, match="fresh"):
            await service.submit("one", submit_body("new-key-stale"))
        await service.close("one", position_id=POSITION)
        assert s.client.calls[-1][0] == "DELETE"
    asyncio.run(run())


@pytest.mark.integration
def test_event_queued_before_rest_ack_is_correlated(service):
    async def run():
        s = await connected(service)
        original = s.client.request
        pending = []
        async def early(method, path, body=None, **kwargs):
            if method == "POST":
                pending.append(asyncio.create_task(service.event(s, dict(event_type="transaction_event",
                    operation_id="777", client_request_id=kwargs["idempotency"], status="success",
                    payload={"orders": [{"order_id": ORDER, "order_type": "limit", "instrument": "XAUUSD", "direction": "buy", "state": "placed", "volume": "0.1", "price": "2490"}]}))))
                await asyncio.sleep(0)
            return await original(method, path, body, **kwargs)
        s.client.request = early
        order = await service.submit("one", submit_body())
        await asyncio.gather(*pending)
        assert service._order("one", order["id"])["status"] == "working"
        assert service.store.operation("one", "test-create-1")["state"] == "confirmed"
    asyncio.run(run())


@pytest.mark.integration
def test_confirmed_bar_supertrend_submits_one_close_and_does_not_mark_closed_on_ack(service):
    async def run():
        s = await connected(service)
        order = await service.submit("one", submit_body())
        await filled(service, s, order)
        start = now_ms()//60_000*60_000 - 20*60_000
        for i in range(20):
            price = 2500+i
            service.cache.upsert_bar(BarRecord("GC", "GC", "1m", start+i*60_000, price, price+1, price-1, price+.5, 10, True))
        service.set_trailing("one", "order", order["id"], dict(timeframe="1m", period=2, multiplier=1, atrMethod="rma", source="hl2"))
        service.cache.upsert_bar(BarRecord("GC", "GC", "1m", start+20*60_000, 2519, 2520, 2480, 2481, 10, True))
        saved = service._order("one", order["id"]); saved["gcAnchored"] = False; service.store.save_order("one", saved)
        await service._manage(s)
        await service._manage(s)
        assert len([c for c in s.client.calls if c[0] == "DELETE"]) == 1
        assert service._order("one", order["id"])["status"] == "filled"
    asyncio.run(run())


@pytest.mark.integration
def test_explicit_unknown_result_review_refreshes_snapshot_without_resubmission(service):
    async def run():
        s = await connected(service)
        s.client.fail = ExecutionError("EXECUTION_UNAVAILABLE", "mock timeout", 503)
        result = await service.submit("one", submit_body())
        assert service.account("one")["uncertainActions"][0]["key"] == "test-create-1"
        s.client.snapshot["positions"] = [{"position_id": POSITION, "instrument": "XAUUSD", "state": "open", "direction": "buy", "volume": "0.10", "open_price": "2500.20"}]
        s.client.fail = None
        await service.acknowledge_uncertain("one", "test-create-1")
        assert service.store.operation("one", "test-create-1")["state"] == "reviewed"
        assert service._order("one", result["id"])["status"] == "unlinked"
        assert service.open_trades("one")["positions"][0]["brokerPositionTicket"] == POSITION
        assert len([c for c in s.client.calls if c[0] != "GET"]) == 1
    asyncio.run(run())


@pytest.mark.integration
def test_exness_app_lifespan_starts_and_stops_execution_without_mt5(service, monkeypatch):
    monkeypatch.setenv("NTTOTV_EXECUTION_MODE", "exness")
    class Runtime:
        cache, settings = service.cache, service.settings
        async def start(self): pass
        async def stop(self): pass
    app = create_app()
    app.state.runtime = Runtime()
    # Use the preconstructed test service so the application never opens runtime data.
    app.state.execution_service = service
    app.dependency_overrides[get_cache] = lambda: service.cache
    with TestClient(app) as client:
        assert client.get("/api/execution").json()["mode"] == "exness"
        assert client.get("/api/execution/account").status_code == 401


@pytest.mark.integration
def test_connection_probe_only_reads_api_and_never_reads_or_exposes_credentials(service, monkeypatch):
    async def run():
        s = await connected(service)
        s.client.calls.clear()
        def forbidden(*args, **kwargs):
            raise AssertionError("Diagnostic must not read credential storage")
        monkeypatch.setattr(service.store, "account", forbidden)
        s.tick_at = now_ms()-2*24*60*60*1000
        s.websocket_snapshots = 1
        result = await probe_connections(service)
        assert [c[0] for c in s.client.calls] == ["GET"]*4
        assert all(c["ok"] for c in result["profiles"][0]["readOnlyChecks"])
        assert result["profiles"][0]["eventsConnected"] is True
        assert result["profiles"][0]["ticksConnected"] is True
        assert result["profiles"][0]["quoteAgeSeconds"] >= 24*60*60
        serialized = json.dumps(result)
        assert ACCOUNT not in serialized and POSITION not in serialized
        assert "exnsk-test-only" not in serialized and "mock-only" not in serialized
        assert "balance" not in serialized and "apiSecret" not in serialized
    asyncio.run(run())


@pytest.mark.integration
def test_account_state_event_uses_nested_state_and_diagnostics_redact_unknown_data(service):
    async def run():
        s = await connected(service)
        await service.event(s, {"event_type": "account_state_event", "payload": {
            "account_state": {"equity": "1001.25"}}})
        assert s.account_state["equity"] == "1001.25"
        assert "account_state" not in s.account_state
        diagnostic = service._stream_response({"code": 3000, "error_message": "secret-value",
            "id": ACCOUNT, "apiSecret": "secret-value", "payload": {"balance": "1000"}})
        assert diagnostic == {"fields": ["code", "error_message", "id", "payload"],
            "code": 3000, "error": "UNRECOGNIZED_ERROR"}
        assert "secret-value" not in json.dumps(diagnostic) and ACCOUNT not in json.dumps(diagnostic)
    asyncio.run(run())


@pytest.mark.integration
@pytest.mark.parametrize("kind", ["events", "ticks"])
@pytest.mark.parametrize("ack", [200, "200"])
def test_subscription_ack_keeps_stream_open_and_consumes_following_data(service, kind, ack):
    async def run():
        s = await connected(service)
        s.synced, s.tick, s.tick_at = False, {}, 0
        ready = asyncio.Event()
        class Socket:
            async def send(self, raw): pass
            async def frames(self):
                yield json.dumps({"id": "transactions" if kind == "events" else "ticks", "code": ack})
                if kind == "events":
                    yield json.dumps({"event_type": "trading_state_snapshot", "payload": s.client.snapshot})
                    yield json.dumps({"event_type": "account_state_event", "payload": {"account_state": {"equity": "1001.25"}}})
                else:
                    yield json.dumps({"instrument": "XAUUSD", "bid": 2500, "ask": 2500.2, "timestamp": "2026-11-20T22:00:00Z"})
                ready.set()
                await asyncio.Event().wait()
            def __aiter__(self): return self.frames()
        @asynccontextmanager
        async def stream(requested):
            assert requested == kind
            yield Socket()
        s.client.stream = stream
        task = asyncio.create_task(service._events(s) if kind == "events" else service._ticks(s))
        try:
            await asyncio.wait_for(ready.wait(), 2)
            if kind == "events":
                assert s.events_live and s.synced and s.websocket_snapshots == 1
                assert s.account_state["equity"] == "1001.25"
            else:
                assert s.ticks_live and s.tick["bid"] == 2500 and s.tick_at > 0
            assert s.events_reconnects == s.ticks_reconnects == 0
        finally:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
    asyncio.run(run())


@pytest.mark.integration
def test_subscription_failure_keeps_public_code_without_upstream_text(service):
    with pytest.raises(ExecutionError) as caught:
        service._subscription_reply({"code": 4004, "error_message": "MARKET_NO_QUOTES", "detail": ACCOUNT})
    assert caught.value.code == "MARKET_NO_QUOTES"
    assert ACCOUNT not in str(caught.value)


@pytest.mark.integration
def test_close_single_click_transitions_order_and_removes_position(service):
    async def run():
        s = await connected(service)
        order = await service.submit("one", submit_body(key="test-close-1"))
        await filled(service, s, order)
        assert len(service.open_trades("one")["positions"]) == 1

        res = await service.close("one", order_id=order["id"], key="close-test-1")
        assert res.get("operation") is not None
        assert res["operation"]["state"] == "pending"

        trades = service.open_trades("one")
        assert trades["positions"][0].get("pendingAction") is not None
        assert trades["positions"][0]["pendingAction"]["action"] == "close"

        await service.event(s, dict(
            event_type="transaction_event",
            operation_id=int(res["operation"]["operationId"] or 102),
            client_request_id="close-test-1",
            status="success",
            payload={"positions": [{"position_id": POSITION, "state": "closed"}]}
        ))

        saved_order = service._order("one", order["id"])
        assert saved_order["status"] == "closed"
        assert len(service.open_trades("one")["positions"]) == 0
    asyncio.run(run())


@pytest.mark.integration
def test_deal_close_event_removes_position_from_open_trades(service):
    async def run():
        s = await connected(service)
        order = await service.submit("one", submit_body(key="test-deal-close"))
        await filled(service, s, order)
        assert len(service.open_trades("one")["positions"]) == 1

        await service.event(s, dict(
            event_type="transaction_event",
            operation_id="888",
            status="success",
            payload={"deals": [{"deal_id": "999", "position_id": POSITION, "type": "close"}]}
        ))

        assert len(service.open_trades("one")["positions"]) == 0
    asyncio.run(run())


@pytest.mark.integration
def test_break_even_sets_sl_to_exact_broker_open_price_regardless_of_basis_shift(service):
    async def run():
        s = await connected(service)
        order = await service.submit("one", submit_body(key="test-be-1"))
        await filled(service, s, order)

        service.on_gc_price(2515, now_ms())

        res = await service.patch("one", {"breakEven": True, "idempotencyKey": "be-patch-1"}, order_id=order["id"])

        method, path, payload, key = s.client.calls[-1]
        assert method in {"POST", "PATCH"}
        assert payload["stop_loss_price"] == "2500.20"
    asyncio.run(run())


@pytest.mark.integration
def test_tp_fifty_percent_calculates_half_and_validates_min_volume(service):
    async def run():
        s = await connected(service)
        order = await service.submit("one", submit_body(key="test-tp50-1"))
        await filled(service, s, order, volume="0.10")

        res = await service.close("one", order_id=order["id"], close_fifty_percent=True, key="tp50-close-1")
        method, path, payload, key = s.client.calls[-1]
        assert method == "DELETE"
        assert "volume=0.05" in path

        s.positions[POSITION]["volume"] = "0.01"
        with pytest.raises(ExecutionError) as exc:
            await service.close("one", order_id=order["id"], close_fifty_percent=True, key="tp50-close-2")
        assert exc.value.code == "BAD_REQUEST"
        assert "is below broker minimum" in str(exc.value)
    asyncio.run(run())


@pytest.mark.integration
def test_buffered_event_before_ack_correlation(service):
    async def run():
        s = await connected(service)
        ack_op_id = "777"
        ack_key = "test-race-key"

        s.buffered_events.append(dict(
            event_type="transaction_event",
            operation_id=777,
            status="success",
            payload={"orders": [{"order_id": ORDER, "position_id": POSITION, "order_type": "market", "state": "filled"}],
                     "positions": [{"position_id": POSITION, "instrument": "XAUUSD", "state": "open", "direction": "buy", "volume": "0.10", "open_price": "2500.20"}]}
        ))

        orig_request = s.client.request
        async def mock_req(method, path, body=None, *, idempotency=""):
            if method != "GET" and idempotency == ack_key:
                return {"operation_id": ack_op_id, "client_request_id": idempotency, "status": "accepted"}
            return await orig_request(method, path, body, idempotency=idempotency)
        s.client.request = mock_req

        order = await service.submit("one", submit_body(key=ack_key))

        op = service.store.operation("one", ack_key)
        assert op["state"] == "confirmed"
        saved = service.orders("one")[0]
        assert saved["status"] == "filled"
    asyncio.run(run())


@pytest.mark.integration
def test_update_tp_succeeds_without_pending_blocking(service):
    async def run():
        s = await connected(service)
        order = await service.submit("one", submit_body(key="test-tp-multi"))
        await filled(service, s, order)

        res1 = await service.patch("one", {"tpGc": 2514.0, "idempotencyKey": "tp-update-1"}, order_id=order["id"])
        op1_id = res1["operation"]["operationId"]
        await service.event(s, dict(
            event_type="transaction_event",
            operation_id=int(op1_id or 101),
            client_request_id="tp-update-1",
            status="success",
            payload={"orders": [{"order_id": "99901", "position_id": POSITION, "order_type": "sltp", "state": "placed", "take_profit_price": "2504.20"}]}
        ))

        res2 = await service.patch("one", {"tpGc": 2516.0, "idempotencyKey": "tp-update-2"}, order_id=order["id"])
        assert res2.get("operation") is not None
        assert res2["operation"]["state"] == "pending"
    asyncio.run(run())


@pytest.mark.integration
def test_get_operation_read_only_status_endpoint(service):
    async def run():
        s = await connected(service)
        order = await service.submit("one", submit_body(key="test-op-status-key"))

        op_by_key = service.get_operation("one", "test-op-status-key")
        assert op_by_key["key"] == "test-op-status-key"
        assert op_by_key["state"] == "pending"
        assert op_by_key["action"] == "open"
        assert "apiKey" not in op_by_key and "apiSecret" not in op_by_key

        op_id = op_by_key["operationId"]
        op_by_id = service.get_operation("one", op_id)
        assert op_by_id["key"] == "test-op-status-key"
        assert op_by_id["operationId"] == op_id
    asyncio.run(run())


@pytest.mark.integration
def test_poll_operations_recovers_dropped_event_via_status_get(service):
    async def run():
        s = await connected(service)
        order = await service.submit("one", submit_body(key="test-poll-recovery"))
        service.store.writer.execute(
            "UPDATE execution_operations SET created_at = ? WHERE user_id = ? AND key = ?",
            (now_ms() - 4000, "one", "test-poll-recovery")
        )
        service.store.update_operation("one", "test-poll-recovery", "pending", "999")

        orig_request = s.client.request
        async def poll_request(method, path, body=None, *, idempotency=""):
            if method == "GET" and path.endswith("/operations/999"):
                return {"status": "success", "operation_id": "999"}
            if method == "GET" and path.endswith("/snapshot"):
                return {"orders": [], "positions": [{"position_id": POSITION, "instrument": "XAUUSD", "state": "open", "direction": "buy", "volume": "0.10", "open_price": "2500.20"}],
                        "account_state": {"balance": "1000"}}
            return await orig_request(method, path, body, idempotency=idempotency)
        s.client.request = poll_request

        await service._poll_operations(s)
        op_recovered = service.store.operation("one", "test-poll-recovery")
        assert op_recovered["state"] == "confirmed"
    asyncio.run(run())


@pytest.mark.integration
def test_partial_and_full_close_events_with_closing_deals(service):
    async def run():
        s = await connected(service)
        order = await service.submit("one", submit_body(key="order-partial-guard"))
        await service.event(s, dict(event_type="transaction_event", operation_id="201", status="success",
                                    client_request_id="order-partial-guard",
                                    payload={"positions": [{"position_id": POSITION, "instrument": "XAUUSD", "state": "open",
                                                            "direction": "buy", "volume": "0.10", "open_price": "2500.00"}]}))
        assert POSITION in s.positions
        assert s.positions[POSITION]["volume"] == "0.10"

        # 1. Partial close (TP 50%) - event contains closing Deal AND open position with remaining volume
        close_res = await service.close("one", order_id=order["id"], close_fifty_percent=True, key="partial-50-key")
        assert close_res.get("operation") is not None
        assert close_res["operation"]["state"] == "pending"

        # Exness emits closing deal: Deal.type == "close" on partial close
        await service.event(s, dict(event_type="transaction_event", operation_id="202", status="success",
                                    client_request_id="partial-50-key",
                                    payload={"deals": [{"deal_id": "deal-p1", "position_id": POSITION, "type": "close", "volume": "0.05"}],
                                             "positions": [{"position_id": POSITION, "instrument": "XAUUSD", "state": "open",
                                                            "direction": "buy", "volume": "0.05", "open_price": "2500.00"}]}))
        # Deal.type=close alone must NOT imply position gone; position must remain open with remaining 0.05 volume
        assert POSITION in s.positions
        assert s.positions[POSITION]["volume"] == "0.05"
        open_trades = service.open_trades("one")
        assert len(open_trades["positions"]) == 1
        assert open_trades["positions"][0]["volumeLots"] == 0.05
        local_order = service._order("one", order["id"])
        assert local_order["status"] == "filled"
        assert local_order["volumeLots"] == 0.05

        # 2. Another partial close where event payload omits positions, but closing Deal is present
        # Reconcile via snapshot preserves position
        orig_request = s.client.request
        async def snap_request(method, path, body=None, *, idempotency=""):
            if method == "GET" and path.endswith("/snapshot"):
                return {"orders": [], "positions": [{"position_id": POSITION, "instrument": "XAUUSD", "state": "open",
                                                      "direction": "buy", "volume": "0.03", "open_price": "2500.00"}],
                        "account_state": {"balance": "1000"}}
            return await orig_request(method, path, body, idempotency=idempotency)
        s.client.request = snap_request

        await service.close("one", order_id=order["id"], volume=0.02, key="partial-2-key")
        await service.event(s, dict(event_type="transaction_event", operation_id="203", status="success",
                                    client_request_id="partial-2-key",
                                    payload={"deals": [{"deal_id": "deal-p2", "position_id": POSITION, "type": "close", "volume": "0.02"}],
                                             "positions": []}))
        # Position is still preserved from reconciled snapshot!
        assert POSITION in s.positions
        assert s.positions[POSITION]["volume"] == "0.03"

        # 3. Full close - event also contains closing Deal, but full close request confirmed
        await service.close("one", order_id=order["id"], key="full-close-key")
        await service.event(s, dict(event_type="transaction_event", operation_id="204", status="success",
                                    client_request_id="full-close-key",
                                    payload={"deals": [{"deal_id": "deal-f1", "position_id": POSITION, "type": "close", "volume": "0.03"}],
                                             "positions": [{"position_id": POSITION, "state": "closed"}]}))
        assert POSITION not in s.positions
        assert len(service.open_trades("one")["positions"]) == 0
        final_order = service._order("one", order["id"])
        assert final_order["status"] == "closed"
    asyncio.run(run())


@pytest.mark.integration
def test_get_operation_validation_and_isolation(service):
    async def run():
        s = await connected(service)
        await service.submit("one", submit_body(key="valid-op-key-1"))

        # Valid lookup
        op = service.get_operation("one", "valid-op-key-1")
        assert op["key"] == "valid-op-key-1"

        # Invalid identifier format (special chars, space) raises 400
        with pytest.raises(ExecutionError) as exc_info:
            service.get_operation("one", "invalid/identifier!@#")
        assert exc_info.value.status == 400

        # Non-existent operation raises 404
        with pytest.raises(ExecutionError) as exc_info:
            service.get_operation("one", "non-existent-op-key")
        assert exc_info.value.status == 404
    asyncio.run(run())


