import pytest
from fastapi.testclient import TestClient

from app.app import create_app
from app.config import Settings
from app.engines.alert_engine import MGANN_BREAK_LS, MGANN_SWEEP
from app.models import Side
from app.rest.contract_state import ContractStateStore
from app.storage.cache_store import CacheStore
from app.storage.records import AlertRecord, BarRecord, BigTradeRecord

_SYMBOL = "GC"
_CONTRACT = "GC"
_ACTIVE = "GC 08-26"
_STEP = 60_000


@pytest.fixture()
def env(tmp_path):
    settings = Settings(
        data_dir=tmp_path,
        supported_symbols=(_SYMBOL,),
        gc_candidate_contracts=(_ACTIVE,),
    )
    cache = CacheStore(tmp_path / "app.sqlite")
    app = create_app()
    app.state.contract_state = ContractStateStore(cache, settings=settings)
    try:
        with TestClient(app) as client:
            yield client, cache
    finally:
        cache.close()


def _bar(index: int, open_: float, high: float, low: float, close: float, volume: int):
    return BarRecord(
        symbol=_SYMBOL,
        contract=_CONTRACT,
        timeframe="1m",
        time=index * _STEP,
        open=open_,
        high=high,
        low=low,
        close=close,
        volume=volume,
        closed=True,
    )


@pytest.mark.integration
def test_mgann_break_ls_signals_replays_profile_alert(env):
    client, cache = env
    cache.upsert_alert(
        AlertRecord(
            id="a_mgann",
            profile_id="hieu",
            symbol=_SYMBOL,
            type=MGANN_BREAK_LS,
            params={
                "requireBigTrade": True,
                "bigTradeThreshold": 70,
                "timeframe": "1m",
                "minVolume": 0,
                "volumeLookback": 2,
                "volumeMultiplier": 2,
                "minSpreadTicks": 0,
                "spreadLookback": 2,
                "spreadMultiplier": 2,
                "swingSize": 1,
                "pivotLookbackBars": 20,
                "minPivotCuts": 1,
                "pivotToleranceTicks": 5,
                "minPivotWickTicks": 2,
                "confirmationBars": 2,
                "breakTicks": 0,
                "repeat": True,
            },
            enabled=True,
            created_at=1,
            updated_at=1,
        )
    )
    cache.upsert_bars(
        [
            _bar(0, 100.0, 100.2, 99.5, 100.0, 100),
            _bar(1, 100.0, 101.0, 98.5, 99.0, 100),
            _bar(2, 99.0, 99.5, 97.0, 98.0, 100),
            _bar(3, 98.0, 100.0, 97.5, 98.8, 100),
            _bar(4, 98.8, 99.0, 96.0, 96.5, 100),
            _bar(5, 96.5, 102.5, 96.0, 102.2, 500),
        ]
    )
    cache.upsert_big_trade(
        BigTradeRecord(
            symbol=_SYMBOL,
            contract=_CONTRACT,
            time=5 * _STEP + 10_000,
            price=102.0,
            volume=80,
            side=Side.BUY,
            trade_id=1,
        )
    )

    resp = client.get(
        "/api/signals/mgann-break-ls",
        params={
            "symbol": _SYMBOL,
            "contract": _CONTRACT,
            "tf": "1m",
            "profileId": "hieu",
            "from": 5 * _STEP,
            "to": 5 * _STEP,
            "warmupBars": 20,
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert len(body["signals"]) == 1
    signal = body["signals"][0]
    assert signal["id"] == "a_mgann:hist:300000:1"
    assert signal["alertId"] == "a_mgann"
    assert signal["time"] == 300000
    assert signal["price"] == 102.5
    assert signal["direction"] == 1
    assert signal["text"] == "Break L"
    assert signal["cutTime"] == 180000
    assert signal["cutCount"] == 1
    assert signal["bigTradeVolume"] == 80
    assert signal["barVolume"] == 500
    assert signal["barSpread"] == pytest.approx(5.7)
    assert signal["avgVolume"] == 100.0
    assert signal["avgSpread"] == pytest.approx(1.55)


@pytest.mark.integration
def test_mgann_sweep_signals_replay_without_big_trade(env):
    client, cache = env
    cache.upsert_alert(
        AlertRecord(
            id="a_mgann_no_bt",
            profile_id="hieu",
            symbol=_SYMBOL,
            type=MGANN_SWEEP,
            params={
                "timeframe": "1m",
                "minVolume": 0,
                "volumeLookback": 2,
                "volumeMultiplier": 2,
                "minSpreadTicks": 0,
                "spreadLookback": 2,
                "spreadMultiplier": 2,
                "swingSize": 1,
                "pivotLookbackBars": 20,
                "minPivotCuts": 1,
                "pivotToleranceTicks": 5,
                "minPivotWickTicks": 2,
                "confirmationBars": 2,
                "breakTicks": 0,
                "repeat": True,
            },
            enabled=True,
            created_at=1,
            updated_at=1,
        )
    )
    cache.upsert_bars(
        [
            _bar(0, 100.0, 100.2, 99.5, 100.0, 100),
            _bar(1, 100.0, 101.0, 98.5, 99.0, 100),
            _bar(2, 99.0, 99.5, 97.0, 98.0, 100),
            _bar(3, 98.0, 100.0, 97.5, 98.8, 100),
            _bar(4, 98.8, 99.0, 96.0, 96.5, 100),
            _bar(5, 96.5, 102.5, 96.0, 102.2, 500),
        ]
    )

    resp = client.get(
        "/api/signals/mgann-big-trade-sweep",
        params={
            "symbol": _SYMBOL,
            "contract": _CONTRACT,
            "tf": "1m",
            "profileId": "hieu",
            "from": 5 * _STEP,
            "to": 5 * _STEP,
            "warmupBars": 20,
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert len(body["signals"]) == 1
    signal = body["signals"][0]
    assert signal["id"] == "a_mgann_no_bt:hist:300000:1"
    assert signal["alertId"] == "a_mgann_no_bt"
    assert signal["bigTradeVolume"] == 0
    assert signal["barVolume"] == 500
