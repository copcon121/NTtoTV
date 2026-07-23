from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.app import create_app


class _Registry:
    def __init__(self) -> None:
        self.events = []

    def enqueue(self, event) -> None:
        self.events.append(event)


@pytest.mark.unit
def test_bookmap_si_ingest_enqueues_chart_event():
    app = create_app(lifespan=False)
    registry = _Registry()
    app.state.runtime = SimpleNamespace(registry=registry)

    payload = {
        "symbol": "GC",
        "contract": "GC",
        "alias": "GCQ6@RITHMIC",
        "eventKind": "iceberg",
        "eventType": "DETECTION",
        "time": 1730313600123,
        "price": 2345.6,
        "rawPrice": 23456,
        "size": 12.0,
        "rawSize": 12,
        "totalSize": 47.0,
        "rawTotalSize": 47,
        "isBid": True,
        "orderId": "abc-123",
    }

    with TestClient(app) as client:
        response = client.post("/api/bookmap/si/events", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert len(registry.events) == 1
    queued = registry.events[0]
    assert queued.event_type.value == "bookmap_si_event"
    assert queued.symbol == "GC"
    assert queued.payload["eventKind"] == "iceberg"
    assert queued.payload["orderId"] == "abc-123"
