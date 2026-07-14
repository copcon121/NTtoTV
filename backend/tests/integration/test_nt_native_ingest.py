"""Integration coverage for the NinjaTrader native chart bridge endpoint."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.app import create_app
from app.config import Settings
from app.engines.fvg_signal_engine import FvgSignalEngine
from app.rest.contract_state import ContractStateStore
from app.storage.cache_store import CacheStore
from app.storage.records import BarRecord, VolumeDeltaRecord
from app.storage.tick_store import TickStore


_SYMBOL = "GC"
_ACTIVE = "GC"
_SOURCE = "GC 08-26"
_BASE_MS = 1_730_419_200_000


class _Registry:
    def __init__(self) -> None:
        self.events = []

    def enqueue(self, event) -> None:
        self.events.append(event)


class _Runtime:
    def __init__(self, cache: CacheStore) -> None:
        self.cache = cache
        self.registry = _Registry()
        self.native_fvg = FvgSignalEngine()
        self.native_fvg_seeded = set()

    async def start(self) -> None:
        return None

    async def stop(self) -> None:
        return None


def test_native_bar_upserts_cache_and_enqueues_updates(tmp_path):
    settings = Settings(
        data_dir=tmp_path,
        supported_symbols=(_SYMBOL,),
        gc_candidate_contracts=(_SOURCE,),
    )
    cache = CacheStore(tmp_path / "app.sqlite")
    tick_store = TickStore(tmp_path / "ticks")
    runtime = _Runtime(cache)
    app = create_app(lifespan=False)
    app.state.runtime = runtime
    app.state.contract_state = ContractStateStore(cache, settings=settings)
    app.state.tick_store = tick_store

    try:
        with TestClient(app) as client:
            resp = client.post(
                "/api/nt/native-bar",
                json={
                    "symbol": _SYMBOL,
                    "contract": _ACTIVE,
                    "sourceContract": _SOURCE,
                    "tf": "1m",
                    "time": _BASE_MS,
                    "open": 2400.0,
                    "high": 2400.4,
                    "low": 2399.8,
                    "close": 2400.2,
                    "volume": 21,
                    "buyVolume": 13,
                    "sellVolume": 8,
                    "delta": 5,
                    "deltaHigh": 7,
                    "deltaLow": -2,
                    "openDelta": 0,
                    "closeDelta": 5,
                    "rows": [
                        {"price": 2400.4, "bid": 2, "ask": 8},
                        {"price": 2400.2, "bid": 6, "ask": 5},
                    ],
                },
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["ok"] is True
        assert body["contract"] == _ACTIVE
        assert body["rows"] == 2

        bars = cache.read_bars(_SYMBOL, _ACTIVE, "1m", limit=1)
        assert len(bars) == 1
        assert bars[0].time == _BASE_MS
        assert bars[0].volume == 21
        assert bars[0].closed is True

        deltas = cache.read_volume_delta(_SYMBOL, _ACTIVE, "1m", limit=1)
        assert len(deltas) == 1
        assert deltas[0].delta == 5
        assert deltas[0].buy_volume == 13
        assert deltas[0].sell_volume == 8

        footprint_bars = cache.read_footprint_bars(_SYMBOL, _ACTIVE, "1m", limit=1)
        assert len(footprint_bars) == 1
        assert footprint_bars[0].bar_delta == 5
        assert footprint_bars[0].poc == 2400.2

        levels = cache.read_footprint_levels(_SYMBOL, _ACTIVE, _BASE_MS, "1m")
        assert [(row.price, row.bid_volume, row.ask_volume) for row in levels] == [
            (2400.4, 2, 8),
            (2400.2, 6, 5),
        ]

        assert [event.payload["type"] for event in runtime.registry.events[:3]] == [
            "bar_update",
            "volume_delta_update",
            "footprint_update",
        ]
        assert ("bar_update", "3m") in [
            (event.payload["type"], event.payload.get("tf"))
            for event in runtime.registry.events
        ]
        assert ("volume_delta_update", "3m") in [
            (event.payload["type"], event.payload.get("tf"))
            for event in runtime.registry.events
        ]
    finally:
        tick_store.close()
        cache.close()

def test_native_m1_history_rolls_up_chart_timeframes(tmp_path):
    settings = Settings(
        data_dir=tmp_path,
        supported_symbols=(_SYMBOL,),
        gc_candidate_contracts=(_SOURCE,),
    )
    cache = CacheStore(tmp_path / "app.sqlite")
    tick_store = TickStore(tmp_path / "ticks")
    runtime = _Runtime(cache)
    app = create_app(lifespan=False)
    app.state.runtime = runtime
    app.state.contract_state = ContractStateStore(cache, settings=settings)
    app.state.tick_store = tick_store

    payloads = [
        {
            "time": _BASE_MS,
            "open": 100.0,
            "high": 102.0,
            "low": 99.0,
            "close": 101.0,
            "volume": 10,
            "buyVolume": 6,
            "sellVolume": 4,
            "delta": 2,
            "deltaHigh": 3,
            "deltaLow": -1,
            "openDelta": 1,
            "closeDelta": 2,
        },
        {
            "time": _BASE_MS + 60_000,
            "open": 101.0,
            "high": 105.0,
            "low": 100.0,
            "close": 104.0,
            "volume": 20,
            "buyVolume": 7,
            "sellVolume": 13,
            "delta": -6,
            "deltaHigh": 1,
            "deltaLow": -7,
            "openDelta": -2,
            "closeDelta": -6,
        },
        {
            "time": _BASE_MS + 120_000,
            "open": 104.0,
            "high": 106.0,
            "low": 103.0,
            "close": 105.0,
            "volume": 30,
            "buyVolume": 20,
            "sellVolume": 10,
            "delta": 10,
            "deltaHigh": 12,
            "deltaLow": -3,
            "openDelta": 3,
            "closeDelta": 10,
        },
    ]

    try:
        with TestClient(app) as client:
            for payload in payloads:
                resp = client.post(
                    "/api/nt/native-bar",
                    json={
                        "symbol": _SYMBOL,
                        "contract": _ACTIVE,
                        "sourceContract": _SOURCE,
                        "tf": "1m",
                        "rows": [],
                        **payload,
                    },
                )
                assert resp.status_code == 200

        for tf in ("3m", "5m", "15m", "30m", "1h", "4h", "1D"):
            bars = cache.read_bars(_SYMBOL, _ACTIVE, tf, limit=1)
            assert len(bars) == 1
            assert bars[0].open == 100.0
            assert bars[0].high == 106.0
            assert bars[0].low == 99.0
            assert bars[0].close == 105.0
            assert bars[0].volume == 60

            deltas = cache.read_volume_delta(_SYMBOL, _ACTIVE, tf, limit=1)
            assert len(deltas) == 1
            assert deltas[0].volume == 60
            assert deltas[0].buy_volume == 33
            assert deltas[0].sell_volume == 27
            assert deltas[0].delta == 6
            assert deltas[0].delta_high == 8
            assert deltas[0].delta_low == -7
            assert deltas[0].open_delta == 1
            assert deltas[0].close_delta == 6

        event_slots = [
            (event.payload["type"], event.payload.get("tf"))
            for event in runtime.registry.events
        ]
        assert ("bar_update", "5m") in event_slots
        assert ("volume_delta_update", "5m") in event_slots
    finally:
        tick_store.close()
        cache.close()


def test_native_rollup_ignores_invalid_zero_rows(tmp_path):
    settings = Settings(
        data_dir=tmp_path,
        supported_symbols=(_SYMBOL,),
        gc_candidate_contracts=(_SOURCE,),
    )
    cache = CacheStore(tmp_path / "app.sqlite")
    tick_store = TickStore(tmp_path / "ticks")
    runtime = _Runtime(cache)
    app = create_app(lifespan=False)
    app.state.runtime = runtime
    app.state.contract_state = ContractStateStore(cache, settings=settings)
    app.state.tick_store = tick_store

    zero_time = _BASE_MS + 60_000
    cache.upsert_bar(
        BarRecord(
            symbol=_SYMBOL,
            contract=_ACTIVE,
            timeframe="1m",
            time=zero_time,
            open=0.0,
            high=0.0,
            low=0.0,
            close=0.0,
            volume=0,
            closed=True,
        )
    )
    cache.upsert_volume_delta(
        VolumeDeltaRecord(
            symbol=_SYMBOL,
            contract=_ACTIVE,
            timeframe="1m",
            time=zero_time,
            volume=0,
            buy_volume=0,
            sell_volume=0,
            delta=0,
            delta_high=0,
            delta_low=0,
            open_delta=0,
            close_delta=0,
        )
    )

    valid_payload = {
        "symbol": _SYMBOL,
        "contract": _ACTIVE,
        "sourceContract": _SOURCE,
        "tf": "1m",
        "time": _BASE_MS,
        "open": 2400.0,
        "high": 2400.4,
        "low": 2399.8,
        "close": 2400.2,
        "volume": 21,
        "buyVolume": 13,
        "sellVolume": 8,
        "delta": 5,
        "deltaHigh": 7,
        "deltaLow": -2,
        "openDelta": 0,
        "closeDelta": 5,
        "rows": [],
    }
    invalid_payload = {
        **valid_payload,
        "open": 0.0,
        "high": 0.0,
        "low": 0.0,
        "close": 0.0,
        "volume": 0,
        "buyVolume": 0,
        "sellVolume": 0,
        "delta": 0,
        "deltaHigh": 0,
        "deltaLow": 0,
        "closeDelta": 0,
    }

    try:
        with TestClient(app) as client:
            valid = client.post("/api/nt/native-bar", json=valid_payload)
            assert valid.status_code == 200
            event_count = len(runtime.registry.events)

            ignored = client.post("/api/nt/native-bar", json=invalid_payload)
            assert ignored.status_code == 200
            assert ignored.json()["ignored"] == "invalid_ohlcv"
            assert len(runtime.registry.events) == event_count

        day_bars = cache.read_bars(_SYMBOL, _ACTIVE, "1D", limit=1)
        assert len(day_bars) == 1
        assert day_bars[0].open == 2400.0
        assert day_bars[0].high == 2400.4
        assert day_bars[0].low == 2399.8
        assert day_bars[0].close == 2400.2
        assert day_bars[0].volume == 21

        day_deltas = cache.read_volume_delta(_SYMBOL, _ACTIVE, "1D", limit=1)
        assert len(day_deltas) == 1
        assert day_deltas[0].volume == 21
        assert day_deltas[0].buy_volume == 13
        assert day_deltas[0].sell_volume == 8
        assert day_deltas[0].delta == 5
    finally:
        tick_store.close()
        cache.close()


def test_native_bar_drives_fvg_grader_from_finalized_footprint(tmp_path):
    settings = Settings(
        data_dir=tmp_path,
        supported_symbols=(_SYMBOL,),
        gc_candidate_contracts=(_SOURCE,),
    )
    cache = CacheStore(tmp_path / "app.sqlite")
    tick_store = TickStore(tmp_path / "ticks")
    runtime = _Runtime(cache)
    app = create_app(lifespan=False)
    app.state.runtime = runtime
    app.state.contract_state = ContractStateStore(cache, settings=settings)
    app.state.tick_store = tick_store

    def native_payload(minute: int, open_price: float, close_price: float, delta: int):
        volume = max(1, abs(delta))
        if delta > 0:
            rows = [
                {"price": open_price, "bid": 0, "ask": 1},
                {"price": close_price, "bid": 0, "ask": max(1, volume - 1)},
            ]
            buy_volume = volume
            sell_volume = 0
        elif delta < 0:
            rows = [
                {"price": open_price, "bid": 1, "ask": 0},
                {"price": close_price, "bid": max(1, volume - 1), "ask": 0},
            ]
            buy_volume = 0
            sell_volume = volume
        else:
            rows = [
                {"price": open_price, "bid": 5, "ask": 0},
                {"price": close_price, "bid": 0, "ask": 5},
            ]
            buy_volume = 5
            sell_volume = 5
            volume = 10
        return {
            "symbol": _SYMBOL,
            "contract": _ACTIVE,
            "sourceContract": _SOURCE,
            "tf": "1m",
            "time": _BASE_MS + minute * 60_000,
            "open": open_price,
            "high": max(open_price, close_price),
            "low": min(open_price, close_price),
            "close": close_price,
            "volume": volume,
            "buyVolume": buy_volume,
            "sellVolume": sell_volume,
            "delta": delta,
            "deltaHigh": max(delta, 0),
            "deltaLow": min(delta, 0),
            "openDelta": 0,
            "closeDelta": delta,
            "rows": rows,
        }

    try:
        with TestClient(app) as client:
            for minute, delta in enumerate([0, 5, 0, 5, 0, 5, 0, 5, -30, -10]):
                open_price = 99.0 + (minute % 2) * 0.1
                close_price = open_price + (0.1 if delta >= 0 else -0.1)
                assert client.post(
                    "/api/nt/native-bar",
                    json=native_payload(minute, open_price, close_price, delta),
                ).status_code == 200
            for payload in [
                native_payload(10, 100.0, 100.5, 10),
                native_payload(11, 100.6, 101.0, 100),
                native_payload(12, 100.7, 100.8, 5),
            ]:
                resp = client.post("/api/nt/native-bar", json=payload)
                assert resp.status_code == 200

        signals = cache.read_fvg_signals(_SYMBOL, _ACTIVE, "1m", limit=10)
        assert len(signals) == 1
        signal = signals[0]
        assert signal.time == _BASE_MS + 11 * 60_000
        assert signal.pulse == 5

        fvg_events = [
            event.payload
            for event in runtime.registry.events
            if event.payload["type"] == "fvg_signal_update"
        ]
        assert fvg_events[-1]["phase"] == "confirmed"
        assert fvg_events[-1]["time"] == signal.time
    finally:
        tick_store.close()
        cache.close()
