import pytest
from fastapi.testclient import TestClient

from app.app import create_app
from app.config import Settings
from app.engines.alert_engine import MGANN_BIG_TRADE_SWEEP
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
def test_mgann_big_trade_sweep_signals_replays_profile_alert(env):
    client, cache = env
    cache.upsert_alert(
        AlertRecord(
            id="a_mgann",
            profile_id="hieu",
            symbol=_SYMBOL,
            type=MGANN_BIG_TRADE_SWEEP,
            params={
                "bigTradeThreshold": 70,
                "timeframe": "1m",
                "minVolume": 0,
                "volumeLookback": 20,
                "volumeMultiplier": 2,
                "minSpreadTicks": 0,
                "spreadLookback": 20,
                "spreadMultiplier": 2,
                "swingSize": 1,
                "pivotLookbackBars": 20,
                "minPivotCuts": 2,
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
            _bar(0, 99.5, 100.0, 98.0, 99.0, 100),
            _bar(1, 99.0, 102.0, 98.5, 101.5, 100),
            _bar(2, 101.5, 101.0, 99.0, 99.5, 100),
            _bar(3, 99.5, 100.0, 97.5, 98.5, 100),
            _bar(4, 98.5, 103.0, 98.0, 102.5, 100),
            _bar(5, 102.5, 104.0, 101.0, 103.5, 100),
            _bar(6, 103.5, 103.0, 99.0, 100.0, 100),
            _bar(7, 100.0, 101.0, 98.2, 99.0, 100),
            _bar(8, 99.0, 105.0, 98.0, 103.0, 500),
        ]
    )
    cache.upsert_big_trade(
        BigTradeRecord(
            symbol=_SYMBOL,
            contract=_CONTRACT,
            time=8 * _STEP + 10_000,
            price=104.8,
            volume=80,
            side=Side.BUY,
            trade_id=1,
        )
    )

    resp = client.get(
        "/api/signals/mgann-big-trade-sweep",
        params={
            "symbol": _SYMBOL,
            "contract": _CONTRACT,
            "tf": "1m",
            "profileId": "hieu",
            "from": 8 * _STEP,
            "to": 8 * _STEP,
            "warmupBars": 20,
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert len(body["signals"]) == 1
    signal = body["signals"][0]
    assert signal["id"] == "a_mgann:hist:480000:1"
    assert signal["alertId"] == "a_mgann"
    assert signal["time"] == 480000
    assert signal["price"] == 105.0
    assert signal["direction"] == 1
    assert signal["text"] == "Break L"
    assert signal["cutTime"] == 480000
    assert signal["cutCount"] == 2
    assert signal["bigTradeVolume"] == 80
    assert signal["barVolume"] == 500
    assert signal["barSpread"] == 7.0
    assert signal["avgVolume"] == 100.0
    assert signal["avgSpread"] == pytest.approx(3.1)
