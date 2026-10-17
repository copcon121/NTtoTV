from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.app import create_app
from app.storage.cache_store import CacheStore
from app.storage.liquidity_store import LiquidityStore


@pytest.mark.integration
def test_liquidity_history_returns_markers_lines_and_timeframe_bucket(tmp_path):
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
            "size": 700,
            "previousSize": 200,
            "change": 500,
            "threshold": 300,
            "domDistance": 20,
            "strength": 1.66,
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
            "lineStartTime": 300_000,
        }
    )
    app = create_app(lifespan=False)
    app.state.liquidity_store = store
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

    assert response.status_code == 200
    body = response.json()
    assert body["events"][0]["bucketTime"] == 300_000
    assert body["lines"][0]["lineId"] == "ask:42050:300000"
    assert body["lines"][0]["active"] is True
    assert bad.status_code == 400
    assert bad.json()["error"]["field"] == "tf"


@pytest.mark.integration
def test_liquidity_settings_are_validated_and_persisted(tmp_path):
    cache = CacheStore(tmp_path / "app.sqlite")
    app = create_app(lifespan=False)
    app.state.cache = cache
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
    finally:
        cache.close()

    assert defaults.status_code == 200
    assert defaults.json()["settings"]["relativeTrigger"] == 300
    assert updated.status_code == 200
    assert updated.json()["settings"]["relativeEnabled"] is False
    assert updated.json()["settings"]["relativeTrigger"] == 425
    assert updated.json()["settings"]["absoluteTrigger"] == 500
    assert updated.json()["settings"]["longTermMinAgeSeconds"] == 45
    assert updated.json()["appliedToBookmap"] is False
    assert persisted.json()["settings"] == updated.json()["settings"]
    assert invalid.status_code == 400
    assert invalid.json()["error"]["field"] == "absoluteDomTo"
