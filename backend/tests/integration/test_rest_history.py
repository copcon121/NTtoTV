"""Integration tests for the history endpoint (task 10.2).

Covers ``GET /api/history`` for both the cache path (``source:"cache"``, most
recent up-to-5,000 precomputed bars) and the rebuild path (``source:"rebuild"``,
aggregated from raw Tick_Store ticks on a cache miss), the optional ``contract``
defaulting to the Active_Contract, and unknown-identifier error responses
(Req 18.4, 11.4, 11.5, 18.12). These exercise the real FastAPI app via the
TestClient against a temporary Cache_Store and Tick_Store.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.app import create_app
from app.config import Settings
from app.models import NormalizedTrade
from app.rest.contract_state import ContractStateStore
from app.rest.routes import HISTORY_CACHE_CAP
from app.storage.cache_store import CacheStore
from app.storage.records import BarRecord
from app.storage.tick_store import TickStore

_SYMBOL = "GC"
_CANDIDATES = ("GC 08-26", "GC 10-26", "GC 12-26")
_ACTIVE = "GC 08-26"

# A fixed UTC anchor (2024-11-01T00:00:00Z) so bucket boundaries are stable.
_BASE_MS = 1_730_419_200_000
_MINUTE_MS = 60_000


@pytest.fixture()
def env(tmp_path):
    """A TestClient wired to temporary Cache_Store + Tick_Store instances."""
    settings = Settings(
        data_dir=tmp_path,
        supported_symbols=(_SYMBOL,),
        gc_candidate_contracts=_CANDIDATES,
    )
    cache = CacheStore(tmp_path / "app.sqlite")
    state = ContractStateStore(cache, settings=settings)
    tick_store = TickStore(tmp_path / "ticks")

    app = create_app()
    app.state.contract_state = state
    app.state.tick_store = tick_store
    try:
        with TestClient(app) as client:
            yield client, cache, tick_store
    finally:
        tick_store.close()
        cache.close()


def _bar(time_ms: int, *, close: float, volume: int) -> BarRecord:
    return BarRecord(
        symbol=_SYMBOL,
        contract=_ACTIVE,
        timeframe="1m",
        time=time_ms,
        open=close,
        high=close,
        low=close,
        close=close,
        volume=volume,
        closed=True,
    )


def _trade(time_ms: int, *, price: float, volume: int, seq: int) -> NormalizedTrade:
    return NormalizedTrade(
        symbol=_SYMBOL,
        contract=_ACTIVE,
        time=time_ms,
        price=price,
        volume=volume,
        bid=price - 0.1,
        ask=price + 0.1,
        best_bid=price - 0.1,
        best_ask=price + 0.1,
        sequence=seq,
    )


# -- cache path (Req 11.4) ----------------------------------------------------


@pytest.mark.integration
def test_history_cache_hit_returns_source_cache(env):
    client, cache, _ = env
    bars = [
        _bar(_BASE_MS + i * _MINUTE_MS, close=2345.0 + i, volume=10 + i)
        for i in range(3)
    ]
    cache.upsert_bars(bars)

    resp = client.get("/api/history", params={"symbol": "GC", "tf": "1m"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["symbol"] == "GC"
    assert body["contract"] == _ACTIVE  # defaulted to Active_Contract (Req 18.4)
    assert body["tf"] == "1m"
    assert body["source"] == "cache"
    # Bars are returned ascending by time, with the OHLCV wire shape.
    times = [b["time"] for b in body["bars"]]
    assert times == [_BASE_MS, _BASE_MS + _MINUTE_MS, _BASE_MS + 2 * _MINUTE_MS]
    assert set(body["bars"][0].keys()) == {
        "time",
        "open",
        "high",
        "low",
        "close",
        "volume",
    }


@pytest.mark.integration
def test_history_cache_caps_at_5000_most_recent(env):
    client, cache, _ = env
    # Insert more than the cap; the endpoint must return the most recent 5,000.
    total = HISTORY_CACHE_CAP + 25
    cache.upsert_bars(
        _bar(_BASE_MS + i * _MINUTE_MS, close=1.0 + i, volume=1) for i in range(total)
    )

    resp = client.get("/api/history", params={"symbol": "GC", "tf": "1m"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "cache"
    assert len(body["bars"]) == HISTORY_CACHE_CAP
    # The most recent bars are kept, returned ascending.
    last_time = _BASE_MS + (total - 1) * _MINUTE_MS
    assert body["bars"][-1]["time"] == last_time
    assert body["bars"][0]["time"] == _BASE_MS + (total - HISTORY_CACHE_CAP) * _MINUTE_MS


@pytest.mark.integration
def test_history_limit_is_capped_to_5000(env):
    client, cache, _ = env
    cache.upsert_bars(_bar(_BASE_MS + i * _MINUTE_MS, close=1.0, volume=1) for i in range(3))

    resp = client.get(
        "/api/history",
        params={"symbol": "GC", "tf": "1m", "limit": 100_000},
    )
    assert resp.status_code == 200
    # Only 3 bars exist; an over-cap limit is accepted and clamped, not an error.
    assert len(resp.json()["bars"]) == 3


# -- rebuild path (Req 11.5, 8.5) ---------------------------------------------


@pytest.mark.integration
def test_history_cache_miss_rebuilds_from_ticks(env):
    client, _, tick_store = env
    # No cached bars; record raw ticks across two 1m buckets.
    bucket0 = _BASE_MS
    bucket1 = _BASE_MS + _MINUTE_MS
    tick_store.record_trade(_trade(bucket0 + 1_000, price=2345.0, volume=5, seq=1))
    tick_store.record_trade(_trade(bucket0 + 2_000, price=2346.0, volume=3, seq=2))
    tick_store.record_trade(_trade(bucket0 + 3_000, price=2344.0, volume=2, seq=3))
    tick_store.record_trade(_trade(bucket1 + 1_000, price=2347.0, volume=4, seq=4))

    resp = client.get(
        "/api/history",
        params={"symbol": "GC", "tf": "1m", "from": bucket0, "to": bucket1 + _MINUTE_MS},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "rebuild"
    assert body["contract"] == _ACTIVE
    bars = body["bars"]
    assert [b["time"] for b in bars] == [bucket0, bucket1]
    # First bucket OHLCV aggregated from its three ticks.
    first = bars[0]
    assert first["open"] == 2345.0
    assert first["high"] == 2346.0
    assert first["low"] == 2344.0
    assert first["close"] == 2344.0
    assert first["volume"] == 10
    # Second bucket has a single tick.
    assert bars[1] == {
        "time": bucket1,
        "open": 2347.0,
        "high": 2347.0,
        "low": 2347.0,
        "close": 2347.0,
        "volume": 4,
    }


@pytest.mark.integration
def test_history_empty_when_no_cache_and_no_ticks(env):
    client, _, _ = env
    resp = client.get(
        "/api/history",
        params={"symbol": "GC", "tf": "1m", "from": _BASE_MS, "to": _BASE_MS + _MINUTE_MS},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "rebuild"
    assert body["bars"] == []


# -- contract defaulting + validation (Req 18.4, 18.12) -----------------------


@pytest.mark.integration
def test_history_explicit_contract_is_echoed(env):
    client, cache, _ = env
    cache.upsert_bar(
        BarRecord(
            symbol=_SYMBOL,
            contract="GC 10-26",
            timeframe="1m",
            time=_BASE_MS,
            open=1.0,
            high=1.0,
            low=1.0,
            close=1.0,
            volume=1,
            closed=True,
        )
    )
    resp = client.get(
        "/api/history",
        params={"symbol": "GC", "tf": "1m", "contract": "GC 10-26"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["contract"] == "GC 10-26"
    assert body["source"] == "cache"


@pytest.mark.integration
def test_history_chart_contract_alias_is_accepted(env):
    client, cache, _ = env
    cache.upsert_bar(
        BarRecord(
            symbol=_SYMBOL,
            contract=_SYMBOL,
            timeframe="1m",
            time=_BASE_MS,
            open=1.0,
            high=2.0,
            low=1.0,
            close=2.0,
            volume=10,
            closed=True,
        )
    )

    resp = client.get(
        "/api/history",
        params={"symbol": "GC", "tf": "1m", "contract": "GC"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["contract"] == "GC"
    assert body["source"] == "cache"
    assert body["bars"][0]["close"] == 2.0


@pytest.mark.integration
def test_history_unknown_symbol_is_404(env):
    client, _, _ = env
    resp = client.get("/api/history", params={"symbol": "ZZ", "tf": "1m"})
    assert resp.status_code == 404
    err = resp.json()["error"]
    assert err["code"] == "NOT_FOUND"
    assert err["field"] == "symbol"


@pytest.mark.integration
def test_history_unknown_timeframe_is_404(env):
    client, _, _ = env
    resp = client.get("/api/history", params={"symbol": "GC", "tf": "2m"})
    assert resp.status_code == 404
    err = resp.json()["error"]
    assert err["code"] == "NOT_FOUND"
    assert err["field"] == "tf"
    assert "2m" in err["message"]


@pytest.mark.integration
def test_history_unknown_contract_is_404(env):
    client, _, _ = env
    resp = client.get(
        "/api/history",
        params={"symbol": "GC", "tf": "1m", "contract": "GC 99-99"},
    )
    assert resp.status_code == 404
    err = resp.json()["error"]
    assert err["code"] == "NOT_FOUND"
    assert err["field"] == "contract"


@pytest.mark.integration
def test_history_missing_tf_is_400(env):
    client, _, _ = env
    resp = client.get("/api/history", params={"symbol": "GC"})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "BAD_REQUEST"


@pytest.mark.integration
def test_history_inverted_range_is_400(env):
    client, _, _ = env
    resp = client.get(
        "/api/history",
        params={"symbol": "GC", "tf": "1m", "from": _BASE_MS + _MINUTE_MS, "to": _BASE_MS},
    )
    assert resp.status_code == 400
    err = resp.json()["error"]
    assert err["code"] == "BAD_REQUEST"
    assert err["field"] == "from"
