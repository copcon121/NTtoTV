from __future__ import annotations

import asyncio

import pytest

from app.config import Settings
from app.engines.alert_engine import (
    MGANN_BREAK_LS,
    SUPERTREND_DIRECTION_CHANGE,
    Alert,
)
from app.engines.contract_resolver import ContractResolver
from app.models import BarUpdate, NormalizedTrade, OHLCVBar, Side
from app.models.messages import EventType, VolumeDeltaUpdate
from app.models.timestamp import now_ms
from app.pipeline import Pipeline
from app.registry import WebSocketRegistry
from app.storage import CacheStore, TickStore
from app.storage.records import BarRecord, VolumeDeltaRecord

_SYMBOL = "GC"
_SOURCE = "GC 08-26"
_BASE = 1_753_200_000_000


def _bookmap_orderflow(volume: int, price: float) -> dict:
    return {
        "buyVolume": volume,
        "sellVolume": 0,
        "delta": volume,
        "deltaHigh": volume,
        "deltaLow": 0,
        "openDelta": 0,
        "closeDelta": volume,
        "rows": [{"price": price, "bid": 0, "ask": volume}],
    }


def _pipeline(tmp_path, *, preferred="bookmap"):
    settings = Settings(
        data_dir=tmp_path,
        supported_symbols=(_SYMBOL,),
        gc_candidate_contracts=(_SOURCE,),
        market_data_preferred_source=preferred,
        bookmap_qualify_ms=2_000,
        bookmap_stale_ms=5_000,
        bookmap_recover_ms=10_000,
        market_data_min_hold_ms=30_000,
        nt_feed_stale_ms=10_000,
    )
    cache = CacheStore(tmp_path / "app.sqlite")
    ticks = TickStore(tmp_path / "ticks")
    resolver = ContractResolver([_SOURCE])
    resolver.set_manual_override(_SOURCE)
    captured = []
    registry = WebSocketRegistry()
    registry.enqueue = captured.append  # type: ignore[assignment]
    pipeline = Pipeline(
        registry=registry,
        cache=cache,
        tick_store=ticks,
        resolver=resolver,
        settings=settings,
        symbol=_SYMBOL,
    )
    return pipeline, cache, ticks, captured


@pytest.mark.unit
def test_bookmap_requires_continuous_heartbeat_contract_and_complete_bar(tmp_path):
    pipeline, cache, ticks, _ = _pipeline(tmp_path)
    try:
        now = _BASE
        bookmap = pipeline._feed_states["bookmap"]
        bookmap.connected = True
        bookmap.last_heartbeat_at = now
        bookmap.healthy_since = now - 1_999
        bookmap.contract = _SOURCE
        bookmap.bar_ready = True
        asyncio.run(pipeline._evaluate_source_selection(now))
        assert pipeline._active_feed is None

        bookmap.healthy_since = now - 2_000
        asyncio.run(pipeline._evaluate_source_selection(now))
        assert pipeline._active_feed == "bookmap"
    finally:
        ticks.close()
        cache.close()


@pytest.mark.unit
def test_bookmap_stale_falls_back_to_recent_nt_and_recovery_is_hysteretic(tmp_path):
    pipeline, cache, ticks, _ = _pipeline(tmp_path)
    try:
        now = _BASE
        pipeline._active_feed = "bookmap"
        pipeline._source_switched_at = now - 60_000
        bookmap = pipeline._feed_states["bookmap"]
        bookmap.connected = True
        bookmap.last_heartbeat_at = now - 5_001
        bookmap.healthy_since = now - 60_000
        bookmap.contract = _SOURCE
        bookmap.bar_ready = True
        nt = pipeline._feed_states["nt"]
        nt.connected = True
        nt.last_heartbeat_at = now
        nt.healthy_since = now - 60_000

        asyncio.run(pipeline._evaluate_source_selection(now))
        assert pipeline._active_feed == "nt"
        assert pipeline._source_switch_reason == "bookmap_stale"

        bookmap.last_heartbeat_at = now + 1_000
        bookmap.healthy_since = now - 8_000
        asyncio.run(pipeline._evaluate_source_selection(now + 1_000))
        assert pipeline._active_feed == "nt"

        pipeline._source_switched_at = now - 30_000
        bookmap.healthy_since = now - 10_000
        asyncio.run(pipeline._evaluate_source_selection(now + 1_000))
        assert pipeline._active_feed == "bookmap"
        assert pipeline._source_switch_reason == "bookmap_recovered"
    finally:
        ticks.close()
        cache.close()


@pytest.mark.unit
def test_bookmap_sequence_gap_stays_unready_until_full_orderflow_snapshot(tmp_path):
    pipeline, cache, ticks, _ = _pipeline(tmp_path, preferred="nt")
    try:
        state = pipeline._feed_states["bookmap"]
        state.bar_ready = True

        # Heartbeat/bar channels have independent sequences; losing one of
        # those frames must not imply that a trade is missing from the ladder.
        pipeline.note_bookmap_sequence_gap()
        assert state.orderflow_gap_pending is False
        assert state.bar_ready is True

        def trade(sequence: int, offset: int) -> NormalizedTrade:
            return NormalizedTrade(
                symbol=_SYMBOL,
                contract=_SOURCE,
                time=_BASE + offset,
                price=2400.0,
                volume=1,
                bid=None,
                ask=None,
                best_bid=None,
                best_ask=None,
                sequence=sequence,
                source="bookmap",
                side=Side.BUY,
            )

        async def create_trade_gap() -> None:
            await pipeline.on_bookmap_trade(trade(1, 100))
            await pipeline.on_bookmap_trade(trade(3, 300))

        asyncio.run(create_trade_gap())
        assert state.orderflow_gap_pending is True

        asyncio.run(
            pipeline.on_bookmap_heartbeat(
                {
                    "contract": _SOURCE,
                    "time": _BASE,
                    "hasCurrentBar": True,
                    "partialStart": False,
                }
            )
        )
        assert state.bar_ready is False

        asyncio.run(
            pipeline.on_bookmap_bar(
                {
                    "contract": _SOURCE,
                    "tf": "1m",
                    "time": _BASE,
                    "bridgeTime": _BASE + 1_000,
                    "lastEventTimeNanos": (_BASE + 900) * 1_000_000,
                    "open": 2400.0,
                    "high": 2400.1,
                    "low": 2399.9,
                    "close": 2400.0,
                    "volume": 10,
                    "buyVolume": 6,
                    "sellVolume": 4,
                    "delta": 2,
                    "deltaHigh": 3,
                    "deltaLow": -1,
                    "openDelta": 0,
                    "closeDelta": 2,
                    "closed": False,
                    "partialStart": False,
                    "snapshot": True,
                    "rows": [{"price": 2400.0, "bid": 4, "ask": 6}],
                }
            )
        )
        assert state.orderflow_gap_pending is False
        assert state.bar_ready is True
    finally:
        ticks.close()
        cache.close()


@pytest.mark.unit
def test_nt_stale_does_not_bypass_bookmap_recovery_hysteresis(tmp_path):
    pipeline, cache, ticks, _ = _pipeline(tmp_path)
    try:
        now = _BASE
        pipeline._active_feed = "nt"
        pipeline._source_switched_at = now - 29_999
        nt = pipeline._feed_states["nt"]
        nt.connected = False
        nt.last_heartbeat_at = now - 10_001
        bookmap = pipeline._feed_states["bookmap"]
        bookmap.connected = True
        bookmap.last_heartbeat_at = now
        bookmap.healthy_since = now - 10_000
        bookmap.contract = _SOURCE
        bookmap.bar_ready = True

        asyncio.run(pipeline._evaluate_source_selection(now))
        assert pipeline._active_feed == "nt"

        pipeline._source_switched_at = now - 30_000
        asyncio.run(pipeline._evaluate_source_selection(now))
        assert pipeline._active_feed == "bookmap"
        assert pipeline._source_switch_reason == "nt_stale"
    finally:
        ticks.close()
        cache.close()


@pytest.mark.unit
def test_snapshot_bar_does_not_pollute_live_latency_metrics(tmp_path):
    pipeline, cache, ticks, _ = _pipeline(tmp_path, preferred="nt")
    try:
        asyncio.run(
            pipeline.on_bookmap_bar(
                {
                    "contract": _SOURCE,
                    "tf": "1m",
                    "time": _BASE - 60_000,
                    "bridgeTime": _BASE,
                    "lastEventTimeNanos": (_BASE - 1) * 1_000_000,
                    "open": 100.0,
                    "high": 101.0,
                    "low": 99.0,
                    "close": 100.5,
                    "volume": 10,
                    **_bookmap_orderflow(10, 100.5),
                    "closed": True,
                    "partialStart": False,
                    "snapshot": True,
                }
            )
        )
        state = pipeline._feed_states["bookmap"]
        assert list(state.event_lags) == []
        assert list(state.transport_lags) == []
        assert list(state.bar_close_lags) == []
    finally:
        ticks.close()
        cache.close()


@pytest.mark.unit
def test_invalid_bookmap_ladder_is_rejected_before_engine_seed(tmp_path):
    pipeline, cache, ticks, _ = _pipeline(tmp_path, preferred="nt")
    try:
        update = BarUpdate(
            symbol=_SYMBOL,
            contract=_SYMBOL,
            tf="1m",
            bar=OHLCVBar(
                time=_BASE,
                open=2400.0,
                high=2400.1,
                low=2399.9,
                close=2400.0,
                volume=10,
            ),
            closed=False,
            source="bookmap",
        )
        payload = {"volume": 10, **_bookmap_orderflow(10, 2400.0)}
        payload["rows"] = [{"price": 2400.0, "bid": 0, "ask": 9}]
        with pytest.raises(ValueError, match="conserve"):
            pipeline._reconcile_bookmap_orderflow(payload, update)
        assert (
            pipeline._source_vds["bookmap"]["1m"].current_update(_SYMBOL)
            is None
        )
        assert pipeline._source_footprints["bookmap"].current_update(_SYMBOL) is None
    finally:
        ticks.close()
        cache.close()


@pytest.mark.unit
def test_nt_native_bar_close_latency_is_reported(tmp_path):
    pipeline, cache, ticks, _ = _pipeline(tmp_path, preferred="nt")
    try:
        pipeline.note_nt_native_bar(_BASE, _BASE + 61_500)
        status = pipeline.market_data_status_dict()
        assert status["sources"]["nt"]["barCloseLagMs"]["p95"] == 1_500
    finally:
        ticks.close()
        cache.close()


@pytest.mark.unit
def test_nt_native_orderflow_uses_bar_time_owner_not_arrival_source(tmp_path):
    pipeline, cache, ticks, _ = _pipeline(tmp_path)
    try:
        pipeline._active_feed = "bookmap"
        cache.upsert_bar(
            BarRecord(
                symbol=_SYMBOL,
                contract=_SYMBOL,
                timeframe="1m",
                time=_BASE,
                open=2400.0,
                high=2400.1,
                low=2399.9,
                close=2400.0,
                volume=10,
                closed=True,
                source="nt",
            )
        )
        assert pipeline.accept_nt_native_orderflow(
            symbol=_SYMBOL,
            contract=_SYMBOL,
            tf="1m",
            bar_time=_BASE,
        )
        assert not pipeline.accept_nt_native_orderflow(
            symbol=_SYMBOL,
            contract=_SYMBOL,
            tf="1m",
            bar_time=_BASE,
            source_contract="GC 06-26",
        )

        cache.upsert_bar(
            BarRecord(
                symbol=_SYMBOL,
                contract=_SYMBOL,
                timeframe="1m",
                time=_BASE,
                open=2400.0,
                high=2400.1,
                low=2399.9,
                close=2400.0,
                volume=10,
                closed=True,
                source="bookmap",
            )
        )
        pipeline._active_feed = "nt"
        assert not pipeline.accept_nt_native_orderflow(
            symbol=_SYMBOL,
            contract=_SYMBOL,
            tf="1m",
            bar_time=_BASE,
        )
    finally:
        ticks.close()
        cache.close()


@pytest.mark.unit
def test_bookmap_primary_owns_live_delta_and_footprint_while_nt_stays_warm(tmp_path):
    pipeline, cache, ticks, captured = _pipeline(tmp_path)
    try:
        now = now_ms()
        state = pipeline._feed_states["bookmap"]
        state.connected = True
        state.last_heartbeat_at = now
        state.healthy_since = now - 60_000
        state.contract = _SOURCE
        state.bar_ready = True
        pipeline._active_feed = "bookmap"
        pipeline._source_switched_at = now - 60_000

        bookmap_trade = NormalizedTrade(
            symbol=_SYMBOL,
            contract=_SOURCE,
            time=_BASE + 1_000,
            price=2400.0,
            volume=7,
            bid=None,
            ask=None,
            best_bid=None,
            best_ask=None,
            sequence=1,
            source="bookmap",
            side=Side.SELL,
        )
        inactive_nt_trade = NormalizedTrade(
            symbol=_SYMBOL,
            contract=_SOURCE,
            time=_BASE + 2_000,
            price=2400.1,
            volume=50,
            bid=2400.0,
            ask=2400.1,
            best_bid=2400.0,
            best_ask=2400.1,
            sequence=1,
        )

        async def run():
            await pipeline.on_bookmap_trade(bookmap_trade)
            await pipeline.on_trade(inactive_nt_trade)

        asyncio.run(run())

        delta = cache.read_volume_delta(_SYMBOL, _SYMBOL, "1m", limit=1)
        assert len(delta) == 1
        assert (delta[0].buy_volume, delta[0].sell_volume, delta[0].delta) == (
            0,
            7,
            -7,
        )
        footprint_events = [
            event
            for event in captured
            if event.event_type == EventType.FOOTPRINT_UPDATE
        ]
        assert footprint_events
        assert footprint_events[-1].payload["rows"] == [
            {"price": 2400.0, "bid": 7, "ask": 0, "imbalance": None}
        ]

        # Both feeds remain raw-recorded even though only Bookmap may write the
        # shared derived cache while it is active.
        raw = list(ticks.read_range(_SOURCE, _BASE, _BASE + 60_000, source=None))
        assert {trade.source for trade in raw} == {"bookmap", "nt"}

        authoritative = {
            "contract": _SOURCE,
            "tf": "1m",
            "time": _BASE,
            "bridgeTime": now,
            "lastEventTimeNanos": (_BASE + 59_000) * 1_000_000,
            "open": 2400.0,
            "high": 2400.2,
            "low": 2399.9,
            "close": 2400.1,
            "volume": 12,
            "buyVolume": 5,
            "sellVolume": 7,
            "delta": -2,
            "deltaHigh": 0,
            "deltaLow": -7,
            "openDelta": 0,
            "closeDelta": -2,
            "closed": True,
            "partialStart": False,
            "snapshot": False,
            "rows": [
                {"price": 2400.1, "bid": 0, "ask": 5},
                {"price": 2400.0, "bid": 7, "ask": 0},
            ],
        }
        asyncio.run(pipeline.on_bookmap_bar(authoritative))

        levels = cache.read_footprint_levels(_SYMBOL, _SYMBOL, _BASE, "1m")
        assert [(row.price, row.bid_volume, row.ask_volume) for row in levels] == [
            (2400.1, 0, 5),
            (2400.0, 7, 0),
        ]

        # A later authoritative replacement removes levels no longer present.
        corrected = dict(authoritative)
        corrected["rows"] = [{"price": 2400.1, "bid": 2, "ask": 10}]
        corrected["buyVolume"] = 10
        corrected["sellVolume"] = 2
        corrected["delta"] = 8
        corrected["deltaHigh"] = 8
        corrected["closeDelta"] = 8
        asyncio.run(pipeline.on_bookmap_bar(corrected))
        levels = cache.read_footprint_levels(_SYMBOL, _SYMBOL, _BASE, "1m")
        assert [(row.price, row.bid_volume, row.ask_volume) for row in levels] == [
            (2400.1, 2, 10)
        ]
    finally:
        ticks.close()
        cache.close()


@pytest.mark.unit
def test_bookmap_snapshot_that_promotes_source_is_persisted(tmp_path):
    pipeline, cache, ticks, _ = _pipeline(tmp_path)
    try:
        now = now_ms()
        state = pipeline._feed_states["bookmap"]
        state.connected = True
        state.last_heartbeat_at = now
        state.healthy_since = now - 60_000
        state.contract = _SOURCE
        state.bar_ready = True
        pipeline._active_feed = None

        asyncio.run(
            pipeline.on_bookmap_bar(
                {
                    "contract": _SOURCE,
                    "tf": "1m",
                    "time": _BASE,
                    "bridgeTime": now,
                    "lastEventTimeNanos": (_BASE + 59_000) * 1_000_000,
                    "open": 2400.0,
                    "high": 2400.1,
                    "low": 2399.9,
                    "close": 2400.1,
                    "volume": 2,
                    **_bookmap_orderflow(2, 2400.1),
                    "closed": True,
                    "partialStart": False,
                    "snapshot": False,
                }
            )
        )

        assert pipeline._active_feed == "bookmap"
        levels = cache.read_footprint_levels(_SYMBOL, _SYMBOL, _BASE, "1m")
        assert [(row.price, row.bid_volume, row.ask_volume) for row in levels] == [
            (2400.1, 0, 2)
        ]
    finally:
        ticks.close()
        cache.close()


@pytest.mark.unit
def test_bookmap_tick_close_cannot_overwrite_authoritative_snapshot(tmp_path):
    pipeline, cache, ticks, _ = _pipeline(tmp_path)
    try:
        now = now_ms()
        state = pipeline._feed_states["bookmap"]
        state.connected = True
        state.last_heartbeat_at = now
        state.healthy_since = now - 60_000
        state.contract = _SOURCE
        state.bar_ready = True
        pipeline._active_feed = "bookmap"
        pipeline._source_switched_at = now - 60_000

        asyncio.run(
            pipeline.on_bookmap_bar(
                {
                    "contract": _SOURCE,
                    "tf": "1m",
                    "time": _BASE,
                    "bridgeTime": now,
                    "lastEventTimeNanos": (_BASE + 59_000) * 1_000_000,
                    "open": 2400.0,
                    "high": 2400.1,
                    "low": 2399.9,
                    "close": 2400.1,
                    "volume": 12,
                    "buyVolume": 5,
                    "sellVolume": 7,
                    "delta": -2,
                    "deltaHigh": 0,
                    "deltaLow": -7,
                    "openDelta": 0,
                    "closeDelta": -2,
                    "closed": True,
                    "partialStart": False,
                    "snapshot": False,
                    "rows": [
                        {"price": 2400.1, "bid": 0, "ask": 5},
                        {"price": 2400.0, "bid": 7, "ask": 0},
                    ],
                }
            )
        )

        # Simulate a delayed tick path holding an incomplete pre-snapshot
        # ladder when the next trade crosses the minute boundary.
        pipeline._source_footprints["bookmap"].seed_bar(
            _SYMBOL,
            symbol=_SYMBOL,
            time=_BASE,
            open=2400.0,
            high=2400.0,
            low=2400.0,
            close=2400.0,
            rows=[(2400.0, 7, 0)],
        )
        asyncio.run(
            pipeline.on_bookmap_trade(
                NormalizedTrade(
                    symbol=_SYMBOL,
                    contract=_SOURCE,
                    time=_BASE + 60_000,
                    price=2400.1,
                    volume=1,
                    bid=None,
                    ask=None,
                    best_bid=None,
                    best_ask=None,
                    sequence=1,
                    source="bookmap",
                    side=Side.BUY,
                )
            )
        )

        levels = cache.read_footprint_levels(_SYMBOL, _SYMBOL, _BASE, "1m")
        assert [(row.price, row.bid_volume, row.ask_volume) for row in levels] == [
            (2400.1, 0, 5),
            (2400.0, 7, 0),
        ]
    finally:
        ticks.close()
        cache.close()


@pytest.mark.unit
def test_bookmap_closed_bar_footprint_persisted_without_bridge_orderflow(tmp_path):
    """When a Bookmap trade crosses a minute boundary the just-closed bar's
    footprint ladder must be persisted to the delta-profile cache even when the
    bridge bar snapshot never carries embedded order-flow fields.

    This is the path that keeps the session-daily histogram on the chart
    current after the source has been switched to Bookmap.
    """
    pipeline, cache, ticks, _ = _pipeline(tmp_path)
    try:
        now = now_ms()
        state = pipeline._feed_states["bookmap"]
        state.connected = True
        state.last_heartbeat_at = now
        state.healthy_since = now - 60_000
        state.contract = _SOURCE
        state.bar_ready = True
        pipeline._active_feed = "bookmap"
        pipeline._source_switched_at = now - 60_000

        # Trade within minute _BASE — forming bar, nothing persisted yet.
        asyncio.run(
            pipeline.on_bookmap_trade(
                NormalizedTrade(
                    symbol=_SYMBOL,
                    contract=_SOURCE,
                    time=_BASE + 30_000,
                    price=2400.0,
                    volume=7,
                    bid=None,
                    ask=None,
                    best_bid=None,
                    best_ask=None,
                    sequence=1,
                    source="bookmap",
                    side=Side.SELL,
                )
            )
        )

        # No closed bar yet → footprint cache stays empty.
        assert cache.read_footprint_bars(_SYMBOL, _SYMBOL, "1m") == []

        # Trade in the next minute closes the _BASE bar.  The live-tick path
        # must capture and persist the closed bar's footprint ladder.
        asyncio.run(
            pipeline.on_bookmap_trade(
                NormalizedTrade(
                    symbol=_SYMBOL,
                    contract=_SOURCE,
                    time=_BASE + 60_000,
                    price=2400.1,
                    volume=5,
                    bid=None,
                    ask=None,
                    best_bid=None,
                    best_ask=None,
                    sequence=2,
                    source="bookmap",
                    side=Side.BUY,
                )
            )
        )

        fp_bars = cache.read_footprint_bars(_SYMBOL, _SYMBOL, "1m")
        assert len(fp_bars) == 1
        assert fp_bars[0].time == _BASE
        assert fp_bars[0].bar_delta == -7  # 0 buy − 7 sell

        levels = cache.read_footprint_levels(_SYMBOL, _SYMBOL, _BASE, "1m")
        assert [
            (lvl.price, lvl.bid_volume, lvl.ask_volume) for lvl in levels
        ] == [(2400.0, 7, 0)]
    finally:
        ticks.close()
        cache.close()


@pytest.mark.unit
def test_legacy_bookmap_bar_rebuilds_footprint_from_raw_ticks(tmp_path):
    pipeline, cache, ticks, _ = _pipeline(tmp_path)
    try:
        now = now_ms()
        state = pipeline._feed_states["bookmap"]
        state.connected = True
        state.last_heartbeat_at = now
        state.healthy_since = now - 60_000
        state.contract = _SOURCE
        state.bar_ready = True
        pipeline._active_feed = "bookmap"
        pipeline._source_switched_at = now - 60_000

        async def feed_raw_ticks() -> None:
            await pipeline.on_bookmap_trade(
                NormalizedTrade(
                    symbol=_SYMBOL,
                    contract=_SOURCE,
                    time=_BASE + 10_000,
                    price=2400.0,
                    volume=7,
                    bid=None,
                    ask=None,
                    best_bid=None,
                    best_ask=None,
                    sequence=1,
                    source="bookmap",
                    side=Side.SELL,
                )
            )
            await pipeline.on_bookmap_trade(
                NormalizedTrade(
                    symbol=_SYMBOL,
                    contract=_SOURCE,
                    time=_BASE + 20_000,
                    price=2399.9,
                    volume=5,
                    bid=None,
                    ask=None,
                    best_bid=None,
                    best_ask=None,
                    sequence=2,
                    source="bookmap",
                    side=Side.BUY,
                )
            )

        asyncio.run(feed_raw_ticks())
        asyncio.run(
            pipeline.on_bookmap_bar(
                {
                    "contract": _SOURCE,
                    "tf": "1m",
                    "time": _BASE,
                    "bridgeTime": now,
                    "lastEventTimeNanos": (_BASE + 59_000) * 1_000_000,
                    "open": 2400.0,
                    "high": 2400.0,
                    "low": 2399.9,
                    "close": 2399.9,
                    "volume": 12,
                    "closed": True,
                    "partialStart": False,
                    "snapshot": False,
                }
            )
        )

        fp_bar = cache.read_footprint_bars(_SYMBOL, _SYMBOL, "1m")[0]
        assert fp_bar.bar_delta == -2
        levels = cache.read_footprint_levels(_SYMBOL, _SYMBOL, _BASE, "1m")
        assert [(row.price, row.bid_volume, row.ask_volume) for row in levels] == [
            (2400.0, 7, 0),
            (2399.9, 0, 5),
        ]
    finally:
        ticks.close()
        cache.close()


@pytest.mark.unit
def test_authoritative_bookmap_minute_repairs_higher_rollup(tmp_path):
    pipeline, cache, ticks, _ = _pipeline(tmp_path, preferred="nt")
    try:
        for minute, close in enumerate((100.0, 101.0, 102.0)):
            cache.upsert_bar(
                BarRecord(
                    symbol=_SYMBOL,
                    contract=_SYMBOL,
                    timeframe="1m",
                    time=_BASE + minute * 60_000,
                    open=close,
                    high=close,
                    low=close,
                    close=close,
                    volume=10,
                    closed=True,
                    source="nt",
                )
            )
        corrected = BarUpdate(
            symbol=_SYMBOL,
            contract=_SYMBOL,
            tf="1m",
            bar=OHLCVBar(
                time=_BASE + 60_000,
                open=101.0,
                high=105.0,
                low=99.0,
                close=104.0,
                volume=20,
            ),
            closed=True,
            source="bookmap",
        )

        updates = pipeline._bookmap_rollup_updates(corrected)
        m5 = next(update for update in updates if update.tf == "5m")
        assert m5.bar.open == 100.0
        assert m5.bar.high == 105.0
        assert m5.bar.low == 99.0
        assert m5.bar.close == 102.0
        assert m5.bar.volume == 40
        assert m5.source == "bookmap"
    finally:
        ticks.close()
        cache.close()


@pytest.mark.unit
def test_authoritative_bookmap_delta_repairs_higher_timeframes(tmp_path):
    pipeline, cache, ticks, _ = _pipeline(tmp_path, preferred="nt")
    try:
        bucket = (_BASE // 300_000) * 300_000
        for minute, values in enumerate(
            (
                # volume, buy, sell, high, low, close
                (10, 8, 2, 6, 0, 6),
                (6, 1, 5, 1, -4, -4),
            )
        ):
            cache.upsert_volume_delta(
                VolumeDeltaRecord(
                    symbol=_SYMBOL,
                    contract=_SYMBOL,
                    timeframe="1m",
                    time=bucket + minute * 60_000,
                    volume=values[0],
                    buy_volume=values[1],
                    sell_volume=values[2],
                    delta=values[5],
                    delta_high=values[3],
                    delta_low=values[4],
                    open_delta=0,
                    close_delta=values[5],
                )
            )

        corrected = VolumeDeltaUpdate(
            symbol=_SYMBOL,
            contract=_SYMBOL,
            tf="1m",
            time=bucket + 120_000,
            volume=10,
            buy_volume=7,
            sell_volume=3,
            delta=4,
            delta_high=5,
            delta_low=-1,
            open_delta=0,
            close_delta=4,
        )
        updates = pipeline._bookmap_delta_rollup_updates(corrected)
        m5 = next(update for update in updates if update.tf == "5m")
        assert (
            m5.volume,
            m5.buy_volume,
            m5.sell_volume,
            m5.delta,
            m5.delta_high,
            m5.delta_low,
        ) == (26, 16, 10, 6, 7, 0)

        next_tick = pipeline._source_vds["bookmap"]["5m"].on_trade(
            NormalizedTrade(
                symbol=_SYMBOL,
                contract=_SYMBOL,
                time=bucket + 180_000,
                price=2400.0,
                volume=2,
                bid=None,
                ask=None,
                best_bid=None,
                best_ask=None,
                sequence=1,
                source="bookmap",
                side=Side.SELL,
            )
        )
        assert next_tick is not None
        assert (next_tick.volume, next_tick.delta, next_tick.delta_high) == (28, 4, 7)
    finally:
        ticks.close()
        cache.close()


@pytest.mark.unit
def test_nt_native_delta_correction_survives_the_next_fallback_tick(tmp_path):
    pipeline, cache, ticks, _ = _pipeline(tmp_path, preferred="nt")
    try:
        bucket = (_BASE // 300_000) * 300_000
        pipeline._active_feed = "nt"

        def nt_trade(time_ms: int, volume: int, side: Side) -> NormalizedTrade:
            return NormalizedTrade(
                symbol=_SYMBOL,
                contract=_SYMBOL,
                time=time_ms,
                price=2400.0,
                volume=volume,
                bid=2399.9,
                ask=2400.0,
                best_bid=2399.9,
                best_ask=2400.0,
                sequence=time_ms,
                source="nt",
                side=side,
            )

        asyncio.run(
            pipeline._run_trade_engines(
                nt_trade(bucket + 10_000, 10, Side.BUY), source="nt"
            )
        )
        assert cache.read_volume_delta(_SYMBOL, _SYMBOL, "5m", limit=1)[0].delta == 10

        corrected_m1 = VolumeDeltaUpdate(
            symbol=_SYMBOL,
            contract=_SYMBOL,
            tf="1m",
            time=bucket,
            volume=10,
            buy_volume=0,
            sell_volume=10,
            delta=-10,
            delta_high=0,
            delta_low=-10,
            open_delta=0,
            close_delta=-10,
        )
        corrected_m5 = VolumeDeltaUpdate(
            symbol=_SYMBOL,
            contract=_SYMBOL,
            tf="5m",
            time=bucket,
            volume=10,
            buy_volume=0,
            sell_volume=10,
            delta=-10,
            delta_high=0,
            delta_low=-10,
            open_delta=0,
            close_delta=-10,
        )
        pipeline._persist_derived_batch(
            [], [corrected_m1, corrected_m5], [], []
        )
        pipeline.reconcile_nt_native_orderflow(corrected_m1, [corrected_m5])

        asyncio.run(
            pipeline._run_trade_engines(
                nt_trade(bucket + 60_100, 1, Side.SELL), source="nt"
            )
        )
        corrected = cache.read_volume_delta(_SYMBOL, _SYMBOL, "5m", limit=1)[0]
        assert (corrected.volume, corrected.delta, corrected.delta_low) == (11, -11, -11)
    finally:
        ticks.close()
        cache.close()


@pytest.mark.unit
def test_authoritative_bookmap_rollup_survives_next_raw_trade(tmp_path):
    pipeline, cache, ticks, _ = _pipeline(tmp_path)
    try:
        # 2026-07-22 22:00 UTC is the session/day open; 10:00 UTC is the
        # containing H4 bucket for the mid-session Bookmap attach scenario.
        day_start = 1_784_757_600_000
        h4_start = 1_784_800_800_000
        corrected_minute = 1_784_813_400_000
        for bar_time, open_price, high, low, close, volume in (
            (day_start, 90.0, 91.0, 89.0, 90.5, 10),
            (h4_start, 100.0, 101.0, 99.0, 100.5, 20),
        ):
            cache.upsert_bar(
                BarRecord(
                    symbol=_SYMBOL,
                    contract=_SYMBOL,
                    timeframe="1m",
                    time=bar_time,
                    open=open_price,
                    high=high,
                    low=low,
                    close=close,
                    volume=volume,
                    closed=True,
                    source="nt",
                )
            )

        live_now = now_ms()
        bookmap = pipeline._feed_states["bookmap"]
        bookmap.connected = True
        bookmap.healthy_since = live_now - 5_000
        bookmap.contract = _SOURCE
        bookmap.bar_ready = True
        pipeline._active_feed = "bookmap"

        asyncio.run(
            pipeline.on_bookmap_bar(
                {
                    "contract": _SOURCE,
                    "tf": "1m",
                    "time": corrected_minute,
                    "bridgeTime": live_now,
                    "lastEventTimeNanos": (corrected_minute + 59_000) * 1_000_000,
                    "open": 105.0,
                    "high": 105.0,
                    "low": 104.0,
                    "close": 104.5,
                    "volume": 30,
                    **_bookmap_orderflow(30, 104.5),
                    "closed": True,
                    "partialStart": False,
                    "snapshot": True,
                }
            )
        )
        asyncio.run(
            pipeline._run_trade_engines(
                NormalizedTrade(
                    symbol=_SYMBOL,
                    contract=_SYMBOL,
                    time=corrected_minute + 60_100,
                    price=106.0,
                    volume=5,
                    bid=105.9,
                    ask=106.0,
                    best_bid=105.9,
                    best_ask=106.0,
                    sequence=1,
                    source="bookmap",
                    received_at=live_now + 100,
                    side=Side.BUY,
                    aggressor_order_id="A",
                ),
                source="bookmap",
            )
        )

        h4 = cache.read_bars(_SYMBOL, _SYMBOL, "4h", limit=1)[0]
        assert (h4.open, h4.high, h4.low, h4.close, h4.volume) == (
            100.0,
            106.0,
            99.0,
            106.0,
            55,
        )
        day = cache.read_bars(_SYMBOL, _SYMBOL, "1D", limit=1)[0]
        assert (day.open, day.high, day.low, day.close, day.volume) == (
            90.0,
            106.0,
            89.0,
            106.0,
            65,
        )
    finally:
        ticks.close()
        cache.close()


@pytest.mark.unit
@pytest.mark.parametrize(
    "reconnect_snapshots",
    [False, True],
    ids=["incremental-state", "replayed-after-reconnect"],
)
def test_authoritative_bookmap_closed_bar_emits_mgann_break_alert(
    tmp_path,
    reconnect_snapshots,
):
    pipeline, cache, ticks, captured = _pipeline(tmp_path)
    try:
        pipeline.alert_engine.upsert(
            Alert(
                id="mgann-break",
                symbol=_SYMBOL,
                type=MGANN_BREAK_LS,
                params={
                    "repeat": True,
                    "requireBigTrade": False,
                    "bigTradeThreshold": 70,
                    "timeframe": "1m",
                    "volumeDeltaLookback": 2,
                    "volumeDeltaMultiplier": 2,
                    "minSpreadTicks": 0,
                    "spreadLookback": 2,
                    "spreadMultiplier": 2,
                    "swingSize": 1,
                    "pivotLookbackBars": 20,
                    "minPivotCuts": 1,
                    "confirmationBars": 2,
                    "breakTicks": 0,
                },
            )
        )
        live_now = now_ms()
        bookmap = pipeline._feed_states["bookmap"]
        bookmap.connected = True
        bookmap.last_heartbeat_at = live_now
        bookmap.healthy_since = live_now - 5_000
        bookmap.contract = _SOURCE
        bookmap.bar_ready = True
        pipeline._active_feed = "bookmap"

        async def send_bar(
            index: int,
            open_: float,
            high: float,
            low: float,
            close: float,
            volume: int,
            *,
            snapshot: bool = False,
        ) -> None:
            bar_time = _BASE + index * 60_000
            await pipeline.on_bookmap_bar(
                {
                    "contract": _SOURCE,
                    "tf": "1m",
                    "time": bar_time,
                    "bridgeTime": live_now + index,
                    "lastEventTimeNanos": (bar_time + 59_000) * 1_000_000,
                    "open": open_,
                    "high": high,
                    "low": low,
                    "close": close,
                    "volume": volume,
                    **_bookmap_orderflow(volume, close),
                    "closed": True,
                    "partialStart": False,
                    "snapshot": snapshot,
                }
            )

        async def run():
            for index, bar in enumerate(
                [
                    (100.0, 100.2, 99.5, 100.0, 100),
                    (100.0, 101.0, 98.5, 99.0, 100),
                    (99.0, 99.5, 97.0, 98.0, 100),
                    (98.0, 100.0, 97.5, 98.8, 100),
                    (98.8, 99.0, 96.0, 96.5, 100),
                    (96.5, 102.5, 96.0, 102.2, 500),
                ]
            ):
                await send_bar(
                    index,
                    *bar,
                    snapshot=reconnect_snapshots and index < 5,
                )

        asyncio.run(run())

        alerts = [
            event.payload
            for event in captured
            if event.event_type == EventType.ALERT_EVENT
        ]
        assert len(alerts) == 1
        assert alerts[0]["alertId"] == "mgann-break"
        assert alerts[0]["alertType"] == MGANN_BREAK_LS
        assert alerts[0]["direction"] == 1
        assert "Break L internal CHoCH" in alerts[0]["message"]
        rows = cache.read_alert_events("mgann-break")
        assert [row.time for row in rows] == [_BASE + 5 * 60_000]
    finally:
        ticks.close()
        cache.close()


@pytest.mark.unit
def test_switch_resyncs_two_snapshots_without_emitting_alerts(tmp_path):
    pipeline, cache, ticks, captured = _pipeline(tmp_path, preferred="nt")
    try:
        snapshots = []
        for minute in (0, 1):
            snapshots.append(
                BarUpdate(
                    symbol=_SYMBOL,
                    contract=_SYMBOL,
                    tf="1m",
                    bar=OHLCVBar(
                        time=_BASE + minute * 60_000,
                        open=100.0 + minute,
                        high=101.0 + minute,
                        low=99.0 + minute,
                        close=100.5 + minute,
                        volume=10 + minute,
                    ),
                    closed=minute == 0,
                    source="bookmap",
                )
            )
        pipeline._remember_source_updates("bookmap", snapshots)
        asyncio.run(pipeline._switch_feed("bookmap", "test_resync", _BASE + 90_000))

        rows = cache.read_bars(_SYMBOL, _SYMBOL, "1m", limit=2)
        assert len(rows) == 2
        assert {row.source for row in rows} == {"bookmap"}
        assert all(event.payload["type"] == "bar_update" for event in captured)
        conn = cache.reader()
        try:
            switch = conn.execute(
                "SELECT from_source, to_source, reason FROM market_source_switches"
            ).fetchone()
        finally:
            conn.close()
        assert tuple(switch) == ("nt", "bookmap", "test_resync")
    finally:
        ticks.close()
        cache.close()


@pytest.mark.unit
def test_supertrend_uses_authoritative_bookmap_closes_once(tmp_path):
    pipeline, cache, ticks, captured = _pipeline(tmp_path)
    try:
        pipeline.alert_engine.upsert(
            Alert(
                id="supertrend",
                symbol=_SYMBOL,
                type=SUPERTREND_DIRECTION_CHANGE,
                params={
                    "timeframe": "1m",
                    "period": 1,
                    "multiplier": 1.0,
                    "atrMethod": "rma",
                    "source": "hl2",
                    "direction": "both",
                    "repeat": True,
                },
            )
        )
        live_now = now_ms()
        state = pipeline._feed_states["bookmap"]
        state.connected = True
        state.last_heartbeat_at = live_now
        state.healthy_since = live_now - 60_000
        state.contract = _SOURCE
        state.bar_ready = True
        pipeline._active_feed = "bookmap"

        def payload(index, open_, high, low, close, *, snapshot=False):
            bar_time = _BASE + index * 60_000
            return {
                "contract": _SOURCE,
                "tf": "1m",
                "time": bar_time,
                "bridgeTime": live_now + index,
                "lastEventTimeNanos": (bar_time + 59_000) * 1_000_000,
                "open": open_,
                "high": high,
                "low": low,
                "close": close,
                "volume": 10,
                **_bookmap_orderflow(10, close),
                "closed": True,
                "partialStart": False,
                "snapshot": snapshot,
            }

        first = payload(0, 10.0, 11.0, 9.0, 10.0)
        reversal = payload(1, 8.0, 9.0, 7.0, 7.9)
        asyncio.run(pipeline.on_bookmap_bar(first))
        asyncio.run(pipeline.on_bookmap_bar(reversal))
        asyncio.run(pipeline.on_bookmap_bar(reversal))
        asyncio.run(
            pipeline.on_bookmap_bar(
                payload(1, 8.0, 9.0, 7.0, 7.9, snapshot=True)
            )
        )

        events = [
            event.payload
            for event in captured
            if event.event_type == EventType.ALERT_EVENT
            and event.payload["alertId"] == "supertrend"
        ]
        assert len(events) == 1
        assert events[0]["direction"] == -1
        assert events[0]["time"] == _BASE + 60_000
        assert len(cache.read_alert_events("supertrend")) == 1
    finally:
        ticks.close()
        cache.close()


@pytest.mark.unit
def test_contract_roll_and_playback_rewind_reset_supertrend_differently(
    tmp_path, monkeypatch
):
    pipeline, cache, ticks, _ = _pipeline(tmp_path, preferred="nt")
    calls = []
    monkeypatch.setattr(
        pipeline.alert_engine,
        "reset_supertrend",
        lambda **kwargs: calls.append(kwargs),
    )
    try:
        switch_time = _BASE + 30_000
        pipeline._switch_chart_source("GC 10-26", switch_time)
        pipeline._reset_contract("GC 10-26")

        assert calls == [{"warm_from": switch_time}, {}]
    finally:
        ticks.close()
        cache.close()
