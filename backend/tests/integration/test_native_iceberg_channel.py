"""Direct MBO signals stay separate from primary-source candle arbitration."""

import asyncio
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.app import create_app
from app.engines.contract_resolver import ContractResolver
from app.models.messages import EventType, IcebergUpdate, Subscribe
from app.pipeline import Pipeline
from app.registry.registry import WebSocketRegistry, coalescing_subkey
from app.storage.cache_store import CacheStore
from app.storage.liquidity_store import ICEBERG_RETENTION_MS, LiquidityStore
from app.storage.tick_store import TickStore


def _event(**patch):
    return {
        "type": "iceberg_update", "symbol": "GC", "contract": "GC",
        "source": "rithmic", "sourceContract": "GC 12-26",
        "sessionId": "session-1", "orderId": "order-1", "side": "buy",
        "price": 2700.0, "time": 2000, "firstSeenTime": 1000,
        "detectedTime": 2000, "lastTradeTime": 1999, "endTime": None,
        "executedVolume": 11, "displayedSize": 0, "refillCount": 0,
        "status": "active", "detectionReason": "overfill", "sequence": 1,
        "method": "native", **patch,
    }


@pytest.fixture
def iceberg_pipeline(tmp_path, monkeypatch):
    monkeypatch.setattr("app.pipeline.now_ms", lambda: 3000)
    cache = CacheStore(tmp_path / "app.sqlite")
    ticks = TickStore(tmp_path / "ticks")
    resolver = ContractResolver(["GC 12-26", "GC 10-26"])
    resolver.set_manual_override("GC 12-26")
    registry = WebSocketRegistry()
    captured = []
    registry.enqueue = captured.append
    store = LiquidityStore(tmp_path / "liquidity.sqlite")
    pipeline = Pipeline(registry=registry, cache=cache, tick_store=ticks, resolver=resolver, liquidity_store=store)
    pipeline._active_feed = "bookmap"
    yield pipeline, captured
    store.close()
    ticks.close()
    cache.close()


@pytest.mark.integration
def test_rithmic_detections_publish_while_bookmap_owns_candles(iceberg_pipeline):
    pipeline, captured = iceberg_pipeline

    async def scenario():
        await pipeline.on_rithmic_connect({
            "contract": "GC 12-26", "icebergSessionId": "session-1",
            "icebergSynchronized": True,
        })
        await pipeline.on_rithmic_icebergs([_event(), _event(sequence=2, executedVolume=20)])
        # A stale update must not roll back the current accumulated volume.
        await pipeline.on_rithmic_icebergs([_event(sequence=1, executedVolume=11)])
        # Another physical expiry must not appear on this chart.
        await pipeline.on_rithmic_icebergs([_event(sourceContract="GC 10-26", orderId="wrong")])

    asyncio.run(scenario())
    assert pipeline._active_feed == "bookmap"
    updates = [event for event in captured if event.event_type == EventType.ICEBERG_UPDATE]
    assert len(updates) == 2
    assert updates[-1].payload["executedVolume"] == 20
    snapshot = pipeline.iceberg_snapshot()
    assert snapshot["synchronized"]
    assert len(snapshot["icebergs"]) == 1
    assert snapshot["icebergs"][0]["executedVolume"] == 20
    assert pipeline.iceberg_snapshot(min_volume=21)["icebergs"] == []
    assert pipeline.iceberg_snapshot(frm=2001)["icebergs"] == []


@pytest.mark.integration
def test_session_identity_and_completed_lifecycle_are_preserved(iceberg_pipeline):
    pipeline, captured = iceberg_pipeline

    async def scenario():
        await pipeline.on_rithmic_icebergs([
            _event(),
            _event(sequence=2, status="invalidated", endTime=3000, time=3000),
            _event(sessionId="session-2", sequence=1),
            _event(orderId="order-2", sequence=3),
        ])

    asyncio.run(scenario())
    rows = pipeline.iceberg_snapshot()["icebergs"]
    assert len(rows) == 3
    assert any(row["status"] == "invalidated" for row in rows)
    assert coalescing_subkey(captured[0].payload) == coalescing_subkey(captured[1].payload)
    assert coalescing_subkey(captured[0].payload) != coalescing_subkey(captured[2].payload)
    assert coalescing_subkey(captured[0].payload) != coalescing_subkey(captured[3].payload)
    parsed = Subscribe.from_dict({"type": "subscribe", "symbol": "GC", "events": ["iceberg_update"]})
    assert parsed.events == [EventType.ICEBERG_UPDATE]
    assert IcebergUpdate.from_dict(_event()).to_dict() == _event()


@pytest.mark.integration
def test_iceberg_rest_bootstrap_and_query_validation(iceberg_pipeline):
    pipeline, _ = iceberg_pipeline
    asyncio.run(pipeline.on_rithmic_icebergs([_event()]))
    app = create_app(lifespan=False)
    app.state.runtime = SimpleNamespace(pipeline=pipeline)
    with TestClient(app) as client:
        response = client.get("/api/orderflow/icebergs?symbol=GC&contract=GC&min_volume=10")
        assert response.status_code == 200
        assert response.json()["historyMode"] == "persistent"
        assert response.json()["retentionHours"] == 48
        assert len(response.json()["icebergs"]) == 1
        assert client.get("/api/orderflow/icebergs?min_volume=12").json()["icebergs"] == []
        assert client.get("/api/orderflow/icebergs?contract=GC%2012-26").status_code == 404
        assert client.get("/api/orderflow/icebergs?symbol=INVALID").status_code == 404
        assert client.get("/api/orderflow/icebergs?from=10&to=9").status_code == 400
        assert client.get("/api/orderflow/icebergs?limit=5001").status_code == 400


@pytest.mark.integration
def test_iceberg_history_is_bounded(iceberg_pipeline):
    pipeline, _ = iceberg_pipeline
    asyncio.run(pipeline.on_rithmic_icebergs([
        _event(orderId=str(index), sequence=index + 1) for index in range(5002)
    ]))
    rows = pipeline.iceberg_snapshot(limit=5000)["icebergs"]
    assert len(rows) == 5000
    assert rows[0]["orderId"] == "2"


@pytest.mark.integration
def test_restart_restores_history_without_reviving_old_active_orders(iceberg_pipeline):
    pipeline, _ = iceberg_pipeline
    asyncio.run(pipeline.on_rithmic_icebergs([
        _event(),
        _event(orderId="ended", sequence=2, time=2500, status="executed", endTime=2500),
    ]))
    store = LiquidityStore(pipeline._liquidity_store.path)
    try:
        # Replayed older updates cannot overwrite a persisted final state.
        store.record_icebergs([_event(orderId="ended", sequence=1, executedVolume=1)])
        restarted = Pipeline(registry=WebSocketRegistry(), cache=pipeline._cache,
                             tick_store=pipeline._tick_store, resolver=pipeline._resolver,
                             liquidity_store=store)
        snapshot = restarted.iceberg_snapshot()
        assert snapshot["historyMode"] == "persistent"
        rows = {row["orderId"]: row for row in snapshot["icebergs"]}
        assert rows["order-1"]["status"] == "invalidated"
        assert rows["order-1"]["endTime"] == 2000
        assert rows["ended"]["status"] == "executed"
        assert rows["ended"]["executedVolume"] == 11
        asyncio.run(restarted.on_rithmic_connect({
            "contract": "GC 12-26", "icebergSessionId": "session-2", "icebergSynchronized": True,
        }))
        asyncio.run(restarted.on_rithmic_icebergs([_event(sessionId="session-2", time=2800)]))
        snapshot = restarted.iceberg_snapshot()
        assert len(snapshot["icebergs"]) == 3
        assert [row["sessionId"] for row in snapshot["icebergs"] if row["status"] == "active"] == ["session-2"]
        assert len(restarted.iceberg_snapshot(min_volume=12)["icebergs"]) == 0
    finally:
        store.close()


@pytest.mark.integration
def test_iceberg_retention_is_48_hours_and_filters_before_limiting(iceberg_pipeline, monkeypatch):
    pipeline, _ = iceberg_pipeline
    now = 3 * ICEBERG_RETENTION_MS
    monkeypatch.setattr("app.pipeline.now_ms", lambda: now)
    cutoff = now - ICEBERG_RETENTION_MS
    asyncio.run(pipeline.on_rithmic_icebergs([
        _event(orderId="expired", time=cutoff - 1, detectedTime=cutoff - 1),
        _event(orderId="boundary", time=cutoff, detectedTime=cutoff, executedVolume=100),
        _event(orderId="yesterday", time=now - 30 * 3_600_000, detectedTime=now - 30 * 3_600_000),
        _event(orderId="new-small", time=now - 1, detectedTime=now - 1),
        _event(sourceContract="GC 10-26", orderId="wrong", time=now, detectedTime=now),
    ]))
    assert {row["orderId"] for row in pipeline.iceberg_snapshot()["icebergs"]} == {"boundary", "yesterday", "new-small"}
    assert pipeline.iceberg_snapshot(limit=1, min_volume=50)["icebergs"][0]["orderId"] == "boundary"
    assert pipeline._liquidity_store.purge_icebergs_before(cutoff) == 1
    stored = pipeline._liquidity_store.read_icebergs("GC", "GC", "GC 12-26", 0, now)
    assert {row["orderId"] for row in stored} == {"boundary", "yesterday", "new-small"}
