from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.app import create_app


@pytest.mark.integration
def test_removed_ingest_and_trading_routes_are_not_registered() -> None:
    app = create_app(lifespan=False)
    paths = {getattr(route, "path", None) for route in app.routes}

    assert "/ws/chart" in paths
    assert "/ws/nt" not in paths
    assert "/ws/bookmap" not in paths
    assert "/ws/nt-capture" not in paths
    assert "/api/nt/native-bar" not in paths
    assert not any(str(path).startswith("/api/mt5") for path in paths if path)
    assert not any(str(path).startswith("/api/orders") for path in paths if path)


@pytest.mark.integration
def test_readiness_is_503_until_pipeline_is_synchronized() -> None:
    app = create_app(lifespan=False)
    pipeline = SimpleNamespace(
        is_ready=lambda: False,
        market_data_status_dict=lambda: {
            "type": "market_data_status",
            "preferredSource": "rithmic",
            "sources": {"rithmic": {"connected": False}},
            "historySync": {"state": "connecting", "pendingRanges": []},
        },
    )
    app.state.runtime = SimpleNamespace(pipeline=pipeline)

    with TestClient(app) as client:
        response = client.get("/api/ready")

    assert response.status_code == 503
    assert response.json()["ready"] is False


@pytest.mark.integration
def test_readiness_is_200_after_both_plants_are_ready() -> None:
    app = create_app(lifespan=False)
    pipeline = SimpleNamespace(
        is_ready=lambda: True,
        market_data_status_dict=lambda: {
            "type": "market_data_status",
            "preferredSource": "rithmic",
            "sources": {"rithmic": {"connected": True}},
            "historySync": {"state": "synced", "pendingRanges": []},
        },
    )
    app.state.runtime = SimpleNamespace(pipeline=pipeline)

    with TestClient(app) as client:
        response = client.get("/api/ready")

    assert response.status_code == 200
    assert response.json()["ready"] is True
