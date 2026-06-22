"""Integration tests for the order-flow + big-trade REST endpoints (tasks 14.4, 15.3, 16.3).

Covers ``GET /api/orderflow/volume-delta`` (Req 18.5), ``GET /api/orderflow/footprint``
(Req 18.6), and ``GET /api/big-trades`` (Req 18.7): persisted reads, the optional
``contract`` defaulting to the Active_Contract (Req 18.4), the footprint
``count`` default of 3, and unknown-identifier error responses (Req 18.12).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.app import create_app
from app.config import Settings
from app.models import NormalizedTrade, Side
from app.models.messages import ImbalanceSide
from app.rest.contract_state import ContractStateStore
from app.storage.cache_store import CacheStore
from app.storage.records import (
    BigTradeRecord,
    FootprintBarRecord,
    FootprintLevelRecord,
    FvgSignalRecord,
    VolumeDeltaRecord,
)
from app.storage.tick_store import TickStore

_SYMBOL = "GC"
_CANDIDATES = ("GC 08-26", "GC 10-26", "GC 12-26")
_ACTIVE = "GC 08-26"
_BASE_MS = 1_730_419_200_000
_MINUTE_MS = 60_000


@pytest.fixture()
def env(tmp_path):
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
            yield client, cache
    finally:
        tick_store.close()
        cache.close()


# -- volume-delta (Req 18.5) --------------------------------------------------


@pytest.mark.integration
def test_volume_delta_returns_persisted_bars(env):
    client, cache = env
    cache.upsert_volume_delta(
        VolumeDeltaRecord(
            symbol=_SYMBOL,
            contract=_ACTIVE,
            timeframe="1m",
            time=_BASE_MS,
            volume=14,
            buy_volume=8,
            sell_volume=6,
            delta=2,
            delta_high=6,
            delta_low=1,
            open_delta=3,
            close_delta=2,
        )
    )
    resp = client.get("/api/orderflow/volume-delta", params={"symbol": "GC", "tf": "1m"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["contract"] == _ACTIVE  # defaulted to Active_Contract
    assert body["tf"] == "1m"
    assert len(body["bars"]) == 1
    bar = body["bars"][0]
    assert bar["delta"] == 2 and bar["buyVolume"] == 8 and bar["sellVolume"] == 6


@pytest.mark.integration
def test_volume_delta_chart_contract_alias_is_accepted(env):
    client, cache = env
    cache.upsert_volume_delta(
        VolumeDeltaRecord(
            symbol=_SYMBOL,
            contract=_SYMBOL,
            timeframe="1m",
            time=_BASE_MS,
            volume=14,
            buy_volume=8,
            sell_volume=6,
            delta=2,
            delta_high=6,
            delta_low=1,
            open_delta=3,
            close_delta=2,
        )
    )

    resp = client.get(
        "/api/orderflow/volume-delta",
        params={"symbol": "GC", "tf": "1m", "contract": "GC"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["contract"] == "GC"
    assert body["source"] == "cache"
    assert body["bars"][0]["delta"] == 2


@pytest.mark.integration
def test_volume_delta_unknown_symbol_is_404(env):
    client, _ = env
    resp = client.get("/api/orderflow/volume-delta", params={"symbol": "ZZ", "tf": "1m"})
    assert resp.status_code == 404
    assert resp.json()["error"]["field"] == "symbol"


@pytest.mark.integration
def test_volume_delta_unknown_tf_is_404(env):
    client, _ = env
    resp = client.get("/api/orderflow/volume-delta", params={"symbol": "GC", "tf": "2m"})
    assert resp.status_code == 404
    assert resp.json()["error"]["field"] == "tf"


# -- footprint (Req 18.6) -----------------------------------------------------


@pytest.mark.integration
def test_fvg_signals_returns_confirmed_chart_contract_rows(env):
    client, cache = env
    cache.upsert_fvg_signal(
        FvgSignalRecord(
            symbol=_SYMBOL,
            contract=_SYMBOL,
            timeframe="1m",
            time=_BASE_MS,
            direction=1,
            level=5,
            pulse=5,
            top=2346.0,
            bottom=2345.5,
            breakout_ratio=1.8,
        )
    )

    resp = client.get(
        "/api/orderflow/fvg-signals",
        params={"symbol": _SYMBOL, "contract": _SYMBOL, "tf": "1m"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["contract"] == _SYMBOL
    assert body["tf"] == "1m"
    assert body["signals"] == [
        {
            "time": _BASE_MS,
            "direction": 1,
            "level": 5,
            "pulse": 5,
            "top": 2346.0,
            "bottom": 2345.5,
            "breakoutRatio": 1.8,
            "phase": "confirmed",
        }
    ]


@pytest.mark.integration
def test_fvg_signals_rejects_non_m1_timeframe(env):
    client, _ = env
    resp = client.get(
        "/api/orderflow/fvg-signals",
        params={"symbol": _SYMBOL, "contract": _SYMBOL, "tf": "5m"},
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["field"] == "tf"


def _seed_footprint_bar(cache: CacheStore, time_ms: int) -> None:
    cache.upsert_footprint_bar(
        FootprintBarRecord(
            symbol=_SYMBOL,
            contract=_ACTIVE,
            timeframe="1m",
            time=time_ms,
            poc=100.1,
            bar_delta=5,
            buy_pct=0.6,
            sell_pct=0.4,
            unfinished_high=False,
            unfinished_low=True,
        )
    )
    cache.upsert_footprint_levels(
        [
            FootprintLevelRecord(
                symbol=_SYMBOL,
                contract=_ACTIVE,
                timeframe="1m",
                time=time_ms,
                price=100.1,
                bid_volume=2,
                ask_volume=7,
                imbalance=ImbalanceSide.ASK,
            ),
            FootprintLevelRecord(
                symbol=_SYMBOL,
                contract=_ACTIVE,
                timeframe="1m",
                time=time_ms,
                price=100.0,
                bid_volume=4,
                ask_volume=0,
                imbalance=None,
            ),
        ]
    )


@pytest.mark.integration
def test_footprint_returns_last_count_bars_with_ladders(env):
    client, cache = env
    for i in range(5):
        _seed_footprint_bar(cache, _BASE_MS + i * _MINUTE_MS)

    resp = client.get("/api/orderflow/footprint", params={"symbol": "GC"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["contract"] == _ACTIVE
    # Default count is 5, matching the NT footprint panel default.
    assert len(body["bars"]) == 5
    times = [b["time"] for b in body["bars"]]
    assert times == [_BASE_MS + i * _MINUTE_MS for i in range(5)]
    first = body["bars"][0]
    assert first["poc"] == 100.1
    # Ladder rows present, descending price, with imbalance side surfaced.
    rows = first["rows"]
    assert [r["price"] for r in rows] == [100.1, 100.0]
    assert rows[0]["imbalance"] == "ask"


@pytest.mark.integration
def test_footprint_count_param_limits_bars(env):
    client, cache = env
    for i in range(5):
        _seed_footprint_bar(cache, _BASE_MS + i * _MINUTE_MS)
    resp = client.get("/api/orderflow/footprint", params={"symbol": "GC", "count": 2})
    assert resp.status_code == 200
    assert len(resp.json()["bars"]) == 2


@pytest.mark.integration
def test_footprint_unknown_contract_is_404(env):
    client, _ = env
    resp = client.get(
        "/api/orderflow/footprint", params={"symbol": "GC", "contract": "GC 99-99"}
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["field"] == "contract"


# -- big trades (Req 18.7) ----------------------------------------------------


@pytest.mark.integration
def test_big_trades_returns_persisted_rows(env):
    client, cache = env
    cache.upsert_big_trade(
        BigTradeRecord(
            symbol=_SYMBOL,
            contract=_ACTIVE,
            time=_BASE_MS,
            price=2345.6,
            volume=35,
            side=Side.BUY,
        )
    )
    resp = client.get("/api/big-trades", params={"symbol": "GC"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["contract"] == _ACTIVE
    assert len(body["trades"]) == 1
    tr = body["trades"][0]
    assert tr["volume"] == 35 and tr["side"] == "buy" and tr["price"] == 2345.6


@pytest.mark.integration
def test_big_trades_default_load_uses_cache_when_available(env):
    client, cache = env
    tick_store: TickStore = client.app.state.tick_store
    cache.upsert_big_trade(
        BigTradeRecord(
            symbol=_SYMBOL,
            contract=_ACTIVE,
            time=_BASE_MS,
            price=2345.6,
            volume=35,
            side=Side.BUY,
        )
    )
    tick_store.record_trade(
        NormalizedTrade(
            symbol=_SYMBOL,
            contract=_ACTIVE,
            time=_BASE_MS + 1_000,
            price=100.0,
            volume=40,
            bid=99.9,
            ask=100.0,
            best_bid=None,
            best_ask=None,
            sequence=1,
        )
    )

    resp = client.get("/api/big-trades", params={"symbol": "GC"})

    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "cache"
    assert len(body["trades"]) == 1
    assert body["trades"][0]["price"] == 2345.6


@pytest.mark.integration
def test_big_trades_rebuilds_from_ticks_when_raw_ticks_exist(env):
    client, cache = env
    tick_store: TickStore = client.app.state.tick_store
    stale_time = _BASE_MS + 1_000
    cache.upsert_big_trade(
        BigTradeRecord(
            symbol=_SYMBOL,
            contract=_ACTIVE,
            time=stale_time,
            price=99.0,
            volume=99,
            side=Side.SELL,
        )
    )
    tick_store.record_trade(
        NormalizedTrade(
            symbol=_SYMBOL,
            contract=_ACTIVE,
            time=stale_time,
            price=100.0,
            volume=20,
            bid=99.9,
            ask=100.0,
            best_bid=None,
            best_ask=None,
            sequence=1,
        )
    )
    tick_store.record_trade(
        NormalizedTrade(
            symbol=_SYMBOL,
            contract=_ACTIVE,
            time=stale_time,
            price=100.1,
            volume=15,
            bid=99.9,
            ask=100.0,
            best_bid=None,
            best_ask=None,
            sequence=2,
        )
    )

    resp = client.get(
        "/api/big-trades",
        params={"symbol": "GC", "from": _BASE_MS, "to": _BASE_MS + 2_000},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["source"] == "rebuild"
    assert body["trades"] == [
        {
            "tradeId": 1,
            "time": stale_time,
            "price": 100.1,
            "volume": 35,
            "side": "buy",
        }
    ]
    refreshed = cache.read_big_trades(_SYMBOL, _ACTIVE, _BASE_MS, _BASE_MS + 2_000)
    assert [(r.trade_id, r.price, r.volume, r.side) for r in refreshed] == [
        (1, 100.1, 35, Side.BUY)
    ]


@pytest.mark.integration
def test_big_trades_explicit_contract_is_echoed(env):
    client, cache = env
    cache.upsert_big_trade(
        BigTradeRecord(
            symbol=_SYMBOL,
            contract="GC 10-26",
            time=_BASE_MS,
            price=1.0,
            volume=40,
            side=Side.SELL,
        )
    )
    resp = client.get("/api/big-trades", params={"symbol": "GC", "contract": "GC 10-26"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["contract"] == "GC 10-26"
    assert len(body["trades"]) == 1


@pytest.mark.integration
def test_big_trades_unknown_symbol_is_404(env):
    client, _ = env
    resp = client.get("/api/big-trades", params={"symbol": "ZZ"})
    assert resp.status_code == 404
    assert resp.json()["error"]["field"] == "symbol"
