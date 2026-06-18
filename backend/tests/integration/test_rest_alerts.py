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
    SMC_ZONE_DEFAULT_FVG_AUTO_THRESHOLD,
    SMC_ZONE_DEFAULT_FVG_THRESHOLD_LOOKBACK,
    SMC_ZONE_DEFAULT_FVG_THRESHOLD_MULTIPLIER,
    SMC_ZONE_DEFAULT_FVG_VOLUME_CONFIRMATION,
    SMC_ZONE_DEFAULT_MAX_ZONE_AGE,
    SMC_ZONE_TOUCH_BIG_TRADE,
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


@pytest.mark.integration
def test_rest_alerts_accept_and_normalize_smc_zone_touch_params(tmp_path: Path):
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
                    "type": SMC_ZONE_TOUCH_BIG_TRADE,
                    "params": {
                        "bigTradeThreshold": 30,
                        "swingLength": 2,
                        "maxZoneAge": 20,
                        "fvgAutoThreshold": False,
                        "fvgThresholdLookback": 10,
                        "fvgThresholdMultiplier": 0.5,
                        "fvgVolumeConfirmation": True,
                        "repeat": True,
                    },
                },
            )

            assert created.status_code == 201
            body = created.json()
            assert body["type"] == SMC_ZONE_TOUCH_BIG_TRADE
            assert body["params"]["bigTradeThreshold"] == 30
            assert body["params"]["swingLength"] == SMC_DEFAULT_SWING_LENGTH
            assert body["params"]["maxZoneAge"] == SMC_ZONE_DEFAULT_MAX_ZONE_AGE
            assert (
                body["params"]["fvgAutoThreshold"]
                is SMC_ZONE_DEFAULT_FVG_AUTO_THRESHOLD
            )
            assert (
                body["params"]["fvgThresholdLookback"]
                == SMC_ZONE_DEFAULT_FVG_THRESHOLD_LOOKBACK
            )
            assert (
                body["params"]["fvgThresholdMultiplier"]
                == SMC_ZONE_DEFAULT_FVG_THRESHOLD_MULTIPLIER
            )
            assert (
                body["params"]["fvgVolumeConfirmation"]
                is SMC_ZONE_DEFAULT_FVG_VOLUME_CONFIRMATION
            )
            assert body["params"]["repeat"] is True
    finally:
        cache.close()
