from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.app import create_app
from app.config import Settings
from app.rest.contract_state import ContractStateStore
from app.storage.cache_store import CacheStore
from app.storage.records import BarRecord

_SYMBOL = "GC"
_BASE_MS = 1_730_419_200_000
_MINUTE_MS = 60_000


@pytest.fixture()
def env(tmp_path):
    settings = Settings(
        data_dir=tmp_path,
        supported_symbols=(_SYMBOL,),
        gc_candidate_contracts=("GC 08-26",),
    )
    cache = CacheStore(tmp_path / "app.sqlite")
    state = ContractStateStore(cache, settings=settings)
    app = create_app()
    app.state.contract_state = state
    try:
        with TestClient(app) as client:
            yield client, cache
    finally:
        cache.close()


def _bar(index: int) -> BarRecord:
    close = 2345.0 + index * 0.1
    return BarRecord(
        symbol=_SYMBOL,
        contract=_SYMBOL,
        timeframe="1m",
        time=_BASE_MS + index * _MINUTE_MS,
        open=close,
        high=close + 0.2,
        low=close - 0.2,
        close=close,
        volume=10,
        closed=True,
    )


@pytest.mark.integration
def test_baseline_signals_endpoint_reads_logical_chart_cache(env):
    client, cache = env
    cache.upsert_bars(_bar(i) for i in range(20))

    resp = client.get(
        "/api/smc-ai/baseline-signals",
        params={
            "symbol": _SYMBOL,
            "contract": _SYMBOL,
            "tf": "1m",
            "from": _BASE_MS,
            "to": _BASE_MS + 19 * _MINUTE_MS,
            "warmupBars": 0,
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["symbol"] == _SYMBOL
    assert body["contract"] == _SYMBOL
    assert body["tf"] == "1m"
    assert body["source"] == "baseline-cache"
    assert body["signals"] == []
    assert body["summary"]["evaluatedBars"] == 20


@pytest.mark.integration
def test_baseline_signals_rejects_non_m1_timeframe(env):
    client, _ = env

    resp = client.get(
        "/api/smc-ai/baseline-signals",
        params={"symbol": _SYMBOL, "tf": "5m"},
    )

    assert resp.status_code == 404
    assert resp.json()["error"]["field"] == "tf"
