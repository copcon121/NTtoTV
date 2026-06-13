from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.app import create_app
from app.config import Settings
from app.engines.alert_engine import (
    SMC_DEFAULT_LOOKAHEAD_BARS,
    SMC_DEFAULT_MAX_BARS,
    SMC_DEFAULT_PAUSE_ON_INSIDE_BARS,
    SMC_DEFAULT_SWING_LENGTH,
    SMC_EXTERNAL_BREAK_BIG_TRADE,
)
from app.rest.contract_state import ContractStateStore
from app.storage.cache_store import CacheStore


@pytest.mark.integration
def test_rest_alerts_accept_and_normalize_smc_strategy_params(tmp_path: Path):
    settings = Settings(
        data_dir=tmp_path,
        supported_symbols=("GC",),
        gc_candidate_contracts=("GC 08-26",),
    )
    cache = CacheStore(tmp_path / "app.sqlite")
    app = create_app()
    app.state.contract_state = ContractStateStore(cache, settings=settings)
    try:
        with TestClient(app) as client:
            created = client.post(
                "/api/alerts",
                json={
                    "symbol": "GC",
                    "type": SMC_EXTERNAL_BREAK_BIG_TRADE,
                    "params": {
                        "bigTradeThreshold": 75,
                        "swingLength": 2,
                        "lookaheadBars": 9,
                        "effectiveLookaheadBars": 9,
                        "maxBars": 40,
                        "pauseOnInsideBars": False,
                        "repeat": True,
                    },
                },
            )
            assert created.status_code == 201
            body = created.json()
            assert body["type"] == SMC_EXTERNAL_BREAK_BIG_TRADE
            assert body["params"]["bigTradeThreshold"] == 75
            assert body["params"]["swingLength"] == SMC_DEFAULT_SWING_LENGTH
            assert body["params"]["lookaheadBars"] == SMC_DEFAULT_LOOKAHEAD_BARS
            assert (
                body["params"]["effectiveLookaheadBars"]
                == SMC_DEFAULT_LOOKAHEAD_BARS
            )
            assert body["params"]["maxBars"] == SMC_DEFAULT_MAX_BARS
            assert (
                body["params"]["pauseOnInsideBars"]
                is SMC_DEFAULT_PAUSE_ON_INSIDE_BARS
            )
            assert body["params"]["repeat"] is True

            patched = client.patch(
                f"/api/alerts/{body['id']}",
                json={
                    "params": {
                        "bigTradeThreshold": 60,
                        "repeat": False,
                    }
                },
            )
            assert patched.status_code == 200
            patched_body = patched.json()
            assert patched_body["params"]["bigTradeThreshold"] == 60
            assert patched_body["params"]["swingLength"] == SMC_DEFAULT_SWING_LENGTH
            assert patched_body["params"]["lookaheadBars"] == SMC_DEFAULT_LOOKAHEAD_BARS
            assert (
                patched_body["params"]["effectiveLookaheadBars"]
                == SMC_DEFAULT_LOOKAHEAD_BARS
            )
            assert patched_body["params"]["maxBars"] == SMC_DEFAULT_MAX_BARS
            assert (
                patched_body["params"]["pauseOnInsideBars"]
                is SMC_DEFAULT_PAUSE_ON_INSIDE_BARS
            )
            assert patched_body["params"]["repeat"] is False
    finally:
        cache.close()


@pytest.mark.integration
def test_rest_alerts_reject_invalid_smc_strategy_threshold(tmp_path: Path):
    settings = Settings(
        data_dir=tmp_path,
        supported_symbols=("GC",),
        gc_candidate_contracts=("GC 08-26",),
    )
    cache = CacheStore(tmp_path / "app.sqlite")
    app = create_app()
    app.state.contract_state = ContractStateStore(cache, settings=settings)
    try:
        with TestClient(app) as client:
            resp = client.post(
                "/api/alerts",
                json={
                    "symbol": "GC",
                    "type": SMC_EXTERNAL_BREAK_BIG_TRADE,
                    "params": {"bigTradeThreshold": 0},
                },
            )
            assert resp.status_code == 422
    finally:
        cache.close()
