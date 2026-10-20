from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.app import create_app
from app.engines.trend_analyzer import TrendAnalyzerConfig, TrendAnalyzerEngine


@pytest.mark.integration
def test_trend_analyzer_history_exposes_points_markers_and_reference_settings():
    engine = TrendAnalyzerEngine(
        [TrendAnalyzerConfig(instance=1, candle_buckets=1, multiplier=0.0)]
    )
    rows = [
        (second * 1_000, price, price, price, price)
        for second, price in [
            *[(value, 100.0) for value in range(10)],
            *[(value, 110.0) for value in range(10, 20)],
        ]
    ]
    engine.seed_seconds(rows, through_time=20_000, source_contract="GC 12-26")

    app = create_app(lifespan=False)
    app.state.runtime = SimpleNamespace(
        pipeline=SimpleNamespace(trend_analyzer=engine)
    )
    with TestClient(app) as client:
        response = client.get(
            "/api/trend-analyzer",
            params={"symbol": "GC", "contract": "GC", "from": 0, "to": 20_000},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["sourceContract"] == "GC 12-26"
    assert payload["settings"] == {
        "candleInterval": "5m",
        "numberOfCandles": 15,
        "multiplier": 3.0,
        "switchTicks": 3,
    }
    assert payload["points"]
    assert any(marker["kind"] == "trend_change" for marker in payload["markers"])

