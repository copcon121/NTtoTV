from __future__ import annotations

import asyncio

import pytest

from app.config import Settings
from app.engines.contract_resolver import ContractResolver
from app.models import BarUpdate, NormalizedTrade, OHLCVBar, Side
from app.models.timestamp import now_ms
from app.pipeline import Pipeline
from app.registry import WebSocketRegistry
from app.storage import CacheStore, TickStore
from app.storage.records import BarRecord

_SYMBOL = "GC"
_SOURCE = "GC 08-26"
_BASE = 1_753_200_000_000


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
