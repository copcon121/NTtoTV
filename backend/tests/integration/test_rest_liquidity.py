from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.app import create_app
from app.storage.cache_store import CacheStore
from app.storage.liquidity_store import LiquidityStore


@pytest.mark.integration
def test_liquidity_history_returns_markers_lines_and_timeframe_bucket(tmp_path):
    store = LiquidityStore(tmp_path / "liquidity.sqlite")
    cache = CacheStore(tmp_path / "app.sqlite")
    store.record(
        {
            "symbol": "GC",
            "contract": "GC",
            "sourceContract": "GCZ6.COMEX@RITHMIC",
            "sequence": 1,
            "time": 310_123,
            "eventKind": "relative",
            "action": "added",
            "side": "bid",
            "price": 4200.1,
            "size": 700,
            "previousSize": 200,
            "change": 500,
            "threshold": 50,
            "domDistance": 20,
            "strength": 1.66,
        }
    )
    store.record(
        {
            "symbol": "GC",
            "contract": "GC",
            "sourceContract": "GCZ6.COMEX@RITHMIC",
            "sequence": 3,
            "time": 320_123,
            "eventKind": "relative",
            "action": "removed",
            "side": "ask",
            "price": 4200.2,
            "size": 10,
            "previousSize": 20,
            "change": 10,
            "threshold": 10,
            "domDistance": 20,
            "strength": 1.0,
        }
    )
    store.record(
        {
            "symbol": "GC",
            "contract": "GC",
            "sourceContract": "GCZ6.COMEX@RITHMIC",
            "sequence": 2,
            "time": 330_000,
            "eventKind": "long_term",
            "action": "start",
            "side": "ask",
            "price": 4205.0,
            "size": 650,
            "previousSize": 650,
            "change": 0,
            "threshold": 500,
            "domDistance": 12,
            "strength": 1.3,
            "lineId": "ask:42050:300000",
            "lineStartTime": -14_100_000,
        }
    )
    store.record(
        {
            "symbol": "GC",
            "contract": "GC",
            "sourceContract": "GCZ6.COMEX@RITHMIC",
            "sequence": 4,
            "time": 350_000,
            "eventKind": "relative",
            "action": "removed",
            "side": "bid",
            "price": 4198.0,
            "size": 0,
            "previousSize": 12,
            "change": 12,
            "threshold": 500,
            "domDistance": 0,
            "strength": 0.24,
            "lineId": "bid:41980:349000",
            "lineStartTime": 349_000,
        }
    )
    store.record(
        {
            "symbol": "GC",
            "contract": "GC",
            "sourceContract": "GCZ6.COMEX@RITHMIC",
            "sequence": -1,
            "time": 340_000,
            "eventKind": "long_term_touch",
            "action": "touch",
            "side": "ask",
            "price": 4205.0,
            "size": 5,
            "previousSize": 650,
            "change": 5,
            "threshold": 500,
            "domDistance": 12,
            "strength": 5.0,
            "lineId": "ask:42050:300000",
            "lineStartTime": -14_100_000,
        }
    )
    app = create_app(lifespan=False)
    app.state.liquidity_store = store
    app.state.cache = cache
    try:
        with TestClient(app) as client:
            response = client.get(
                "/api/liquidity",
                params={
                    "symbol": "GC",
                    "contract": "GC",
                    "tf": "5m",
                    "from": 0,
                    "to": 600_000,
                },
            )
            bad = client.get("/api/liquidity", params={"tf": "15m"})
    finally:
        store.close()
        cache.close()

    assert response.status_code == 200
    body = response.json()
    assert len(body["events"]) == 2
    assert body["events"][0]["bucketTime"] == 300_000
    assert body["events"][0]["threshold"] == 50
    assert body["events"][1]["eventKind"] == "long_term_touch"
    assert body["events"][1]["size"] == 5
    assert body["events"][1]["lineStartTime"] == -14_100_000
    assert body["lines"][0]["lineId"] == "ask:42050:300000"
    assert body["lines"][0]["active"] is True
    assert bad.status_code == 400
    assert bad.json()["error"]["field"] == "tf"


@pytest.mark.integration
def test_liquidity_settings_are_validated_and_persisted(tmp_path):
    cache = CacheStore(tmp_path / "app.sqlite")
    store = LiquidityStore(tmp_path / "liquidity.sqlite")
    store.record(
        {
            "symbol": "GC",
            "contract": "GC",
            "sourceContract": "GCZ6.COMEX@RITHMIC",
            "sequence": 1,
            "time": 310_123,
            "eventKind": "relative",
            "action": "added",
            "side": "bid",
            "price": 4200.1,
            "size": 100,
            "previousSize": 50,
            "change": 50,
            "threshold": 50,
            "domDistance": 20,
            "strength": 1.0,
        }
    )
    store.record(
        {
            "symbol": "GC",
            "contract": "GC",
            "sourceContract": "GCZ6.COMEX@RITHMIC",
            "sequence": 2,
            "time": 320_000,
            "eventKind": "long_term",
            "action": "start",
            "side": "ask",
            "price": 4205.0,
            "size": 650,
            "previousSize": 650,
            "change": 0,
            "threshold": 500,
            "domDistance": 12,
            "strength": 1.3,
            "lineId": "ask:42050:300000",
            "lineStartTime": 300_000,
        }
    )
    app = create_app(lifespan=False)
    app.state.cache = cache
    app.state.liquidity_store = store
    try:
        with TestClient(app) as client:
            defaults = client.get("/api/liquidity/settings")
            updated = client.put(
                "/api/liquidity/settings",
                json={
                    "relativeEnabled": False,
                    "relativeTrigger": 425,
                    "relativeDomFrom": 12,
                    "relativeDomTo": 64,
                    "longTermMinAgeSeconds": 45,
                },
            )
            persisted = client.get("/api/liquidity/settings")
            invalid = client.put(
                "/api/liquidity/settings",
                json={"absoluteDomFrom": 20, "absoluteDomTo": 10},
            )
            raw_events, raw_lines = store.read("GC", "GC", 0, 400_000)
    finally:
        cache.close()
        store.close()

    assert defaults.status_code == 200
    assert defaults.json()["settings"]["relativeTrigger"] == 50
    assert defaults.json()["settings"]["relativeDomFrom"] == 20
    assert defaults.json()["settings"]["relativeDomTo"] == 100
    assert defaults.json()["settings"]["longTermMinAgeSeconds"] == 4 * 60 * 60
    assert updated.status_code == 200
    assert updated.json()["settings"]["relativeEnabled"] is False
    assert updated.json()["settings"]["relativeTrigger"] == 425
    assert updated.json()["settings"]["absoluteTrigger"] == 500
    assert updated.json()["settings"]["longTermMinAgeSeconds"] == 45
    assert updated.json()["appliedTo"] == ["rithmic"]
    assert updated.json()["historyCleared"] == []
    assert updated.json()["historyRefiltered"] == ["relative", "long_term"]
    assert updated.json()["historyDeleted"] == {"events": 0, "lines": 0}
    assert [event["eventKind"] for event in raw_events] == ["relative"]
    assert [line["lineId"] for line in raw_lines] == ["ask:42050:300000"]
    assert persisted.json()["settings"] == updated.json()["settings"]
    assert invalid.status_code == 400
    assert invalid.json()["error"]["field"] == "absoluteDomTo"
