from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.app import create_app
from app.config import Settings
from app.engines.alert_engine import (
    MGANN_FVG_DEFAULT_MAX_ZONE_AGE,
    MGANN_FVG_DEFAULT_MIN_GAP_TICKS,
    MGANN_FVG_DEFAULT_RETEST_TOLERANCE_TICKS,
    MGANN_FVG_DEFAULT_SWING_SIZE,
    MGANN_FVG_RETEST,
    MGANN_FVG_RETEST_TIMEFRAME,
    MGANN_FVG_RETEST_TIMEFRAMES,
    MGANN_BREAK_LS,
    MGANN_SWEEP,
    MGANN_BIG_TRADE_SWEEP,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_CONFIRMATION_BARS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_CUTS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_LOOKBACK_BARS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_LOOKBACK,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_MULTIPLIER,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_SWING_SIZE,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_TIMEFRAME,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_LOOKBACK,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_MULTIPLIER,
    SMC_DEFAULT_LOOKAHEAD_BARS,
    SMC_DEFAULT_MAX_BARS,
    SMC_DEFAULT_PAUSE_ON_INSIDE_BARS,
    SMC_DEFAULT_RETEST_TOLERANCE_TICKS,
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
                        "retestToleranceTicks": 20,
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
            assert (
                body["params"]["retestToleranceTicks"]
                == SMC_DEFAULT_RETEST_TOLERANCE_TICKS
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
            assert (
                patched_body["params"]["retestToleranceTicks"]
                == SMC_DEFAULT_RETEST_TOLERANCE_TICKS
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
def test_rest_alerts_accept_and_normalize_mgann_break_ls_params(
    tmp_path: Path,
):
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
                    "type": MGANN_BREAK_LS,
                    "params": {
                        "bigTradeThreshold": 70,
                        "requireBigTrade": True,
                        "historySignalLimit": 2500,
                        "direction": "highs",
                        "repeat": True,
                    },
                },
            )

            assert created.status_code == 201
            body = created.json()
            assert body["type"] == MGANN_BREAK_LS
            assert "direction" not in body["params"]
            assert "historySignalLimit" not in body["params"]
            assert body["params"]["requireBigTrade"] is True
            assert body["params"]["bigTradeThreshold"] == 70
            assert body["params"]["timeframe"] == MGANN_BIG_TRADE_SWEEP_DEFAULT_TIMEFRAME
            assert (
                body["params"]["volumeLookback"]
                == MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_LOOKBACK
            )
            assert (
                body["params"]["volumeMultiplier"]
                == MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_MULTIPLIER
            )
            assert (
                body["params"]["spreadLookback"]
                == MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_LOOKBACK
            )
            assert (
                body["params"]["spreadMultiplier"]
                == MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_MULTIPLIER
            )
            assert (
                body["params"]["swingSize"]
                == MGANN_BIG_TRADE_SWEEP_DEFAULT_SWING_SIZE
            )
            assert (
                body["params"]["pivotLookbackBars"]
                == MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_LOOKBACK_BARS
            )
            assert (
                body["params"]["minPivotCuts"]
                == MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_CUTS
            )
            assert (
                body["params"]["confirmationBars"]
                == MGANN_BIG_TRADE_SWEEP_DEFAULT_CONFIRMATION_BARS
            )
            assert body["params"]["repeat"] is True

            legacy = client.post(
                "/api/alerts",
                json={
                    "symbol": "GC",
                    "type": MGANN_BREAK_LS,
                    "params": {
                        "bigTradeThreshold": 70,
                        "swingSize": 2,
                    },
                },
            )
            assert legacy.status_code == 201
            assert (
                legacy.json()["params"]["swingSize"]
                == MGANN_BIG_TRADE_SWEEP_DEFAULT_SWING_SIZE
            )
    finally:
        cache.close()


@pytest.mark.integration
def test_rest_alerts_accept_legacy_mgann_aliases_as_break_ls(
    tmp_path: Path,
):
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
                    "type": MGANN_SWEEP,
                    "params": {
                        "bigTradeThreshold": 70,
                        "repeat": True,
                    },
                },
            )

            assert created.status_code == 201
            body = created.json()
            assert body["type"] == MGANN_BREAK_LS
            assert body["params"]["requireBigTrade"] is False
            assert body["params"]["bigTradeThreshold"] == 70
            assert body["params"]["timeframe"] == MGANN_BIG_TRADE_SWEEP_DEFAULT_TIMEFRAME
            assert (
                body["params"]["volumeLookback"]
                == MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_LOOKBACK
            )
            assert (
                body["params"]["volumeMultiplier"]
                == MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_MULTIPLIER
            )
            assert (
                body["params"]["spreadLookback"]
                == MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_LOOKBACK
            )
            assert (
                body["params"]["spreadMultiplier"]
                == MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_MULTIPLIER
            )
            assert (
                body["params"]["swingSize"]
                == MGANN_BIG_TRADE_SWEEP_DEFAULT_SWING_SIZE
            )
            assert (
                body["params"]["pivotLookbackBars"]
                == MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_LOOKBACK_BARS
            )
            assert (
                body["params"]["minPivotCuts"]
                == MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_CUTS
            )
            assert (
                body["params"]["confirmationBars"]
                == MGANN_BIG_TRADE_SWEEP_DEFAULT_CONFIRMATION_BARS
            )
            assert body["params"]["repeat"] is True

            legacy_bigtrade = client.post(
                "/api/alerts",
                json={
                    "symbol": "GC",
                    "type": MGANN_BIG_TRADE_SWEEP,
                    "params": {"bigTradeThreshold": 80},
                },
            )
            assert legacy_bigtrade.status_code == 201
            legacy_body = legacy_bigtrade.json()
            assert legacy_body["type"] == MGANN_BREAK_LS
            assert legacy_body["params"]["requireBigTrade"] is True
            assert legacy_body["params"]["bigTradeThreshold"] == 80
    finally:
        cache.close()


@pytest.mark.integration
def test_rest_alerts_accept_and_normalize_mgann_fvg_retest_params(tmp_path: Path):
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
                    "type": MGANN_FVG_RETEST,
                    "params": {
                        "repeat": True,
                    },
                },
            )

            assert created.status_code == 201
            body = created.json()
            assert body["type"] == MGANN_FVG_RETEST
            assert body["params"]["timeframe"] == MGANN_FVG_RETEST_TIMEFRAME
            assert body["params"]["swingSize"] == MGANN_FVG_DEFAULT_SWING_SIZE
            assert body["params"]["maxZoneAge"] == MGANN_FVG_DEFAULT_MAX_ZONE_AGE
            assert body["params"]["minGapTicks"] == MGANN_FVG_DEFAULT_MIN_GAP_TICKS
            assert (
                body["params"]["retestToleranceTicks"]
                == MGANN_FVG_DEFAULT_RETEST_TOLERANCE_TICKS
            )
            assert body["params"]["repeat"] is True

            legacy = client.post(
                "/api/alerts",
                json={
                    "symbol": "GC",
                    "type": MGANN_FVG_RETEST,
                    "params": {
                        "swingSize": 2,
                    },
                },
            )
            assert legacy.status_code == 201
            assert legacy.json()["params"]["swingSize"] == MGANN_FVG_DEFAULT_SWING_SIZE

            created_m1 = client.post(
                "/api/alerts",
                json={
                    "symbol": "GC",
                    "type": MGANN_FVG_RETEST,
                    "params": {
                        "timeframe": "1m",
                        "repeat": True,
                    },
                },
            )
            assert created_m1.status_code == 201
            assert created_m1.json()["params"]["timeframe"] == "1m"
            assert set(MGANN_FVG_RETEST_TIMEFRAMES) == {"1m", "5m"}
    finally:
        cache.close()

@pytest.mark.integration
def test_rest_alerts_reject_invalid_mgann_fvg_retest_timeframe(tmp_path: Path):
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
                    "type": MGANN_FVG_RETEST,
                    "params": {"timeframe": "15m"},
                },
            )
            assert resp.status_code == 422
    finally:
        cache.close()
