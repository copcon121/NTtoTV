from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.app import create_app


@pytest.mark.integration
def test_market_data_status_returns_pipeline_snapshot():
    expected = {
        "type": "market_data_status",
        "symbol": "GC",
        "time": 1_753_200_000_000,
        "activeSource": "bookmap",
        "preferredSource": "bookmap",
        "switchedAt": 1_753_199_990_000,
        "reason": "bookmap_recovered",
        "sources": {
            "bookmap": {"heartbeatAgeMs": 120, "eventLagP95Ms": 85},
            "nt": {"heartbeatAgeMs": 300, "eventLagP95Ms": 156},
        },
    }
    pipeline = SimpleNamespace(market_data_status_dict=lambda: expected)
    app = create_app(lifespan=False)
    app.state.runtime = SimpleNamespace(pipeline=pipeline)

    with TestClient(app) as client:
        response = client.get("/api/market-data/status")

    assert response.status_code == 200
    assert response.json() == expected


@pytest.mark.integration
def test_rithmic_option_probe_is_loopback_only_and_uses_runtime_session():
    class _RithmicService:
        async def probe_options(self, **kwargs):
            return {
                "source": "rithmic",
                "underlying": kwargs["underlying_symbol"],
                "exchange": kwargs["exchange"],
                "requestedExpiries": ["20261124"],
                "instrumentCount": 2,
            }

    app = create_app(lifespan=False)
    app.state.runtime = SimpleNamespace(rithmic_service=_RithmicService())

    with TestClient(app) as client:
        response = client.post(
            "/api/market-data/rithmic/options/probe",
            params={"underlying": "GCZ6", "exchange": "COMEX", "max_expiries": 1},
        )
        proxied = client.post(
            "/api/market-data/rithmic/options/probe",
            headers={"x-forwarded-for": "203.0.113.10"},
        )

    assert response.status_code == 200
    assert response.json()["underlying"] == "GCZ6"
    assert response.json()["instrumentCount"] == 2
    assert proxied.status_code == 404
