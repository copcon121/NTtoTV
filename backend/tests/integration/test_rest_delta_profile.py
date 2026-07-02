from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.app import create_app
from app.config import Settings
from app.rest.contract_state import ContractStateStore
from app.rest.orderflow import MAX_ROWS
from app.storage.cache_store import CacheStore
from app.storage.records import BarRecord, FootprintBarRecord, FootprintLevelRecord


_SYMBOL = "GC"
_CHART_CONTRACT = "GC"
_CANDIDATES = ("GC 08-26",)
_T0 = 1_780_358_400_000


@pytest.fixture()
def client(tmp_path):
    settings = Settings(
        data_dir=tmp_path,
        supported_symbols=(_SYMBOL,),
        gc_candidate_contracts=_CANDIDATES,
    )
    cache = CacheStore(tmp_path / "app.sqlite")
    state = ContractStateStore(cache, settings=settings)

    app = create_app()
    app.state.contract_state = state
    try:
        with TestClient(app) as c:
            yield c, cache
    finally:
        cache.close()


def _bar(time: int) -> FootprintBarRecord:
    return FootprintBarRecord(
        symbol=_SYMBOL,
        contract=_CHART_CONTRACT,
        timeframe="1m",
        time=time,
        poc=None,
        bar_delta=0,
        buy_pct=0,
        sell_pct=0,
    )


def _ohlcv_bar(
    time: int,
    *,
    low: float,
    high: float,
    volume: int,
) -> BarRecord:
    return BarRecord(
        symbol=_SYMBOL,
        contract=_CHART_CONTRACT,
        timeframe="1m",
        time=time,
        open=low,
        high=high,
        low=low,
        close=high,
        volume=volume,
        closed=True,
    )


def _level(time: int, price: float, bid: int, ask: int) -> FootprintLevelRecord:
    return FootprintLevelRecord(
        symbol=_SYMBOL,
        contract=_CHART_CONTRACT,
        timeframe="1m",
        time=time,
        price=price,
        bid_volume=bid,
        ask_volume=ask,
    )


@pytest.mark.integration
def test_delta_profile_aggregates_m1_footprint_ladders(client):
    c, cache = client
    cache.upsert_derived_batch(
        footprint_bars=[_bar(_T0), _bar(_T0 + 60_000)],
        footprint_levels=[
            _level(_T0, 4514.0, 10, 2),
            _level(_T0, 4514.1, 1, 7),
            _level(_T0 + 60_000, 4514.0, 0, 5),
            _level(_T0 + 60_000, 4514.2, 2, 4),
        ],
    )

    resp = c.get(
        "/api/orderflow/delta-profile",
        params={
            "symbol": _SYMBOL,
            "contract": _CHART_CONTRACT,
            "from": _T0,
            "to": _T0 + 60_000,
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["contract"] == _CHART_CONTRACT
    assert body["source"] == "footprint_cache"
    assert body["coveredBars"] == 2
    assert body["totalVolume"] == 31
    assert body["totalDelta"] == 5
    assert body["maxAbsDelta"] == 6
    assert body["poc"] == 4514.0
    assert body["vah"] == 4514.1
    assert body["val"] == 4514.0
    assert body["developingPoc"] == [
        {"time": _T0, "price": 4514.0},
        {"time": _T0 + 60_000, "price": 4514.0},
    ]
    assert body["rows"] == [
        {
            "price": 4514.2,
            "bidVolume": 2,
            "askVolume": 4,
            "totalVolume": 6,
            "delta": 2,
        },
        {
            "price": 4514.1,
            "bidVolume": 1,
            "askVolume": 7,
            "totalVolume": 8,
            "delta": 6,
        },
        {
            "price": 4514.0,
            "bidVolume": 10,
            "askVolume": 7,
            "totalVolume": 17,
            "delta": -3,
        },
    ]


@pytest.mark.integration
def test_delta_profile_minute_bar_source_matches_standard_minute_profile(client):
    c, cache = client
    cache.upsert_bars(
        [
            _ohlcv_bar(_T0, low=4514.0, high=4514.2, volume=9),
            _ohlcv_bar(_T0 + 60_000, low=4514.1, high=4514.2, volume=8),
        ]
    )

    resp = c.get(
        "/api/orderflow/delta-profile",
        params={
            "symbol": _SYMBOL,
            "contract": _CHART_CONTRACT,
            "from": _T0,
            "to": _T0 + 60_000,
            "source": "minute_bars",
            "valueAreaPct": 68,
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "minute_bars"
    assert body["coveredBars"] == 2
    assert body["totalVolume"] == 17
    assert body["totalDelta"] == 0
    assert body["poc"] == 4514.2
    assert body["vah"] == 4514.2
    assert body["val"] == 4514.1
    assert body["developingPoc"] == [
        {"time": _T0, "price": 4514.2},
        {"time": _T0 + 60_000, "price": 4514.2},
    ]
    assert body["rows"] == [
        {
            "price": 4514.2,
            "bidVolume": 0,
            "askVolume": 0,
            "totalVolume": 7,
            "delta": 0,
        },
        {
            "price": 4514.1,
            "bidVolume": 0,
            "askVolume": 0,
            "totalVolume": 7,
            "delta": 0,
        },
        {
            "price": 4514.0,
            "bidVolume": 0,
            "askVolume": 0,
            "totalVolume": 3,
            "delta": 0,
        },
    ]


@pytest.mark.integration
def test_delta_profile_groups_rows_by_requested_tick_count(client):
    c, cache = client
    cache.upsert_derived_batch(
        footprint_bars=[_bar(_T0), _bar(_T0 + 60_000)],
        footprint_levels=[
            _level(_T0, 4514.0, 10, 2),
            _level(_T0, 4514.1, 1, 7),
            _level(_T0 + 60_000, 4514.0, 0, 5),
            _level(_T0 + 60_000, 4514.2, 2, 4),
        ],
    )

    resp = c.get(
        "/api/orderflow/delta-profile",
        params={
            "symbol": _SYMBOL,
            "contract": _CHART_CONTRACT,
            "from": _T0,
            "to": _T0 + 60_000,
            "rowTicks": 2,
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["rowTicks"] == 2
    assert body["totalDelta"] == 5
    assert body["rows"] == [
        {
            "price": 4514.2,
            "bidVolume": 2,
            "askVolume": 4,
            "totalVolume": 6,
            "delta": 2,
        },
        {
            "price": 4514.0,
            "bidVolume": 11,
            "askVolume": 14,
            "totalVolume": 25,
            "delta": 3,
        },
    ]


@pytest.mark.integration
def test_delta_profile_empty_range_returns_empty_profile(client):
    c, _cache = client

    resp = c.get(
        "/api/orderflow/delta-profile",
        params={
            "symbol": _SYMBOL,
            "contract": _CHART_CONTRACT,
            "from": _T0,
            "to": _T0 + 60_000,
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["coveredBars"] == 0
    assert body["poc"] is None
    assert body["rows"] == []


@pytest.mark.integration
def test_delta_profile_invalid_range_is_400(client):
    c, _cache = client

    resp = c.get(
        "/api/orderflow/delta-profile",
        params={
            "symbol": _SYMBOL,
            "contract": _CHART_CONTRACT,
            "from": _T0 + 60_000,
            "to": _T0,
        },
    )

    assert resp.status_code == 400
    err = resp.json()["error"]
    assert err["code"] == "BAD_REQUEST"
    assert err["field"] == "from"


@pytest.mark.integration
def test_delta_profile_rejects_ranges_over_5000_m1_bars(client):
    c, cache = client
    cache.upsert_derived_batch(
        footprint_bars=[_bar(_T0 + i * 60_000) for i in range(MAX_ROWS + 1)]
    )

    resp = c.get(
        "/api/orderflow/delta-profile",
        params={
            "symbol": _SYMBOL,
            "contract": _CHART_CONTRACT,
            "from": _T0,
            "to": _T0 + MAX_ROWS * 60_000,
        },
    )

    assert resp.status_code == 400
    err = resp.json()["error"]
    assert err["code"] == "BAD_REQUEST"
    assert err["field"] == "to"
