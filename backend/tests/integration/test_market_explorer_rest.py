from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.app import create_app
from app.config import Settings
from app.rest.contract_state import ContractStateStore
from app.storage.cache_store import CacheStore


@pytest.fixture()
def client(tmp_path):
    settings = Settings(
        data_dir=tmp_path,
        supported_symbols=("GC",),
        gc_candidate_contracts=("GC 12-26",),
    )
    cache = CacheStore(tmp_path / "app.sqlite")
    app = create_app()
    app.state.contract_state = ContractStateStore(cache, settings=settings)
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        cache.close()


@pytest.mark.integration
def test_market_explorer_defaults_and_settings_round_trip(client) -> None:
    response = client.get("/api/market-explorer/settings")
    assert response.status_code == 200
    settings = response.json()["settings"]
    assert settings["halftimeSeconds"] == 60
    assert settings["signal"]["displayMode"] == "standard"
    assert settings["volumeSpike"]["triggerVolume"] == 800
    assert settings["absorption"]["triggerVolume"] == 1000
    assert "telegramNotification" not in settings["signal"]

    settings["halftimeSeconds"] = 45
    settings["signal"]["displayMode"] = "immediately"
    saved = client.put("/api/market-explorer/settings", json=settings)
    assert saved.status_code == 200
    assert saved.json()["settings"]["halftimeSeconds"] == 45
    assert (
        client.get("/api/market-explorer/settings").json()["settings"]["signal"][
            "displayMode"
        ]
        == "immediately"
    )


@pytest.mark.integration
def test_market_explorer_rejects_invalid_threshold_and_returns_empty_cold_history(
    client,
) -> None:
    response = client.get("/api/market-explorer/settings")
    settings = response.json()["settings"]
    settings["signal"]["askLevel"] = 0
    invalid = client.put("/api/market-explorer/settings", json=settings)
    assert invalid.status_code == 400
    assert invalid.json()["error"]["field"] == "signal.askLevel"

    history = client.get(
        "/api/market-explorer",
        params={"symbol": "GC", "contract": "GC", "from": 1, "to": 2},
    )
    assert history.status_code == 200
    assert history.json()["samples"] == []
    assert history.json()["signals"] == []
