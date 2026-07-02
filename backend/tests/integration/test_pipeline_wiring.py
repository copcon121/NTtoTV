"""Integration tests for the full pipeline wiring (tasks 20.1, 20.2).

Covers the ingest -> engines -> registry -> frontend pipeline assembled by
:class:`~app.pipeline.Pipeline` and the live `/ws/nt` + `/ws/chart` transport:

* `/ws/nt` accept + receive of trade frames (Req 4.1);
* an accepted NT trade drives the Bar_Aggregator, VolumeDelta, and BigTrade
  engines, persists their outputs to the Cache_Store, and enqueues `/ws/chart`
  events on the registry (Req 9.3, 20.1);
* raw ticks are recorded to the Tick_Store on ingestion (Req 4.5);
* NT startup subscribes to the active source contract via Control_Commands (Req 1.5);
* an NT status frame is forwarded to subscribed clients (Req 20.1, 20.3).
"""

from __future__ import annotations

import asyncio

import pytest

from app.engines.contract_resolver import ContractResolver
from app.engines.alert_engine import (
    Alert,
    MGANN_FVG_RETEST,
    SMC_EXTERNAL_BREAK_BIG_TRADE,
)
from app.engines.fvg_signal_engine import FvgSignalEngine
from app.ingest.control_plane import ControlPlaneCoordinator
from app.models.canonical import NormalizedTrade, Side
from app.models.messages import (
    ControlAction,
    ControlCommand,
    EventType,
    NTStatusEvent,
    StatusState,
)
from app.pipeline import Pipeline
from app.registry.registry import ChartClient, OutboundEvent, WebSocketRegistry
from app.storage.cache_store import CacheStore
from app.storage.records import BarRecord, VolumeDeltaRecord
from app.storage.tick_store import TickStore

_SYMBOL = "GC"
_CANDIDATES = ["GC 08-26", "GC 10-26", "GC 12-26"]
_ACTIVE = "GC 08-26"
_BASE = 1_730_419_200_000
_MINUTE_MS = 60_000


@pytest.fixture()
def pipeline_env(tmp_path):
    cache = CacheStore(tmp_path / "app.sqlite")
    tick_store = TickStore(tmp_path / "ticks")
    resolver = ContractResolver(_CANDIDATES)
    resolver.set_manual_override(_ACTIVE)
    registry = WebSocketRegistry()
    # Capture outbound events instead of flushing through a socket.
    captured: list[OutboundEvent] = []
    registry.enqueue = captured.append  # type: ignore[assignment]
    pipeline = Pipeline(
        registry=registry,
        cache=cache,
        tick_store=tick_store,
        resolver=resolver,
        symbol=_SYMBOL,
    )
    try:
        yield pipeline, cache, tick_store, resolver, captured
    finally:
        tick_store.close()
        cache.close()


def _trade(time_ms, price, volume, seq, contract=_ACTIVE, bid=None, ask=None):
    return NormalizedTrade(
        symbol=_SYMBOL,
        contract=contract,
        time=time_ms,
        price=price,
        volume=volume,
        bid=bid if bid is not None else price - 0.1,
        ask=ask if ask is not None else price + 0.1,
        best_bid=None,
        best_ask=None,
        sequence=seq,
    )


def _classified_trade(time_ms, price, volume, seq, side: Side):
    bid = price if side is Side.SELL else price - 0.1
    ask = price if side is Side.BUY else price + 0.1
    return _trade(time_ms, price, volume, seq, bid=bid, ask=ask)

def _native_fvg_bar(
    engine: FvgSignalEngine,
    minute: int,
    open_price: float,
    close_price: float,
    delta: int,
) -> None:
    volume = max(1, abs(delta))
    if delta > 0:
        rows = [(open_price, 0, 1), (close_price, 0, max(1, volume - 1))]
    elif delta < 0:
        rows = [(open_price, 1, 0), (close_price, max(1, volume - 1), 0)]
    else:
        rows = [(open_price, 5, 0), (close_price, 0, 5)]
    engine.on_closed_bar(
        symbol=_SYMBOL,
        contract=_SYMBOL,
        time=_BASE + minute * _MINUTE_MS,
        open=open_price,
        high=max(open_price, close_price),
        low=min(open_price, close_price),
        close=close_price,
        rows=rows,
    )


@pytest.mark.integration
def test_accepted_trade_runs_engines_persists_and_streams(pipeline_env):
    pipeline, cache, tick_store, resolver, captured = pipeline_env

    async def run():
        await pipeline.on_trade(_trade(_BASE + 1_000, 2345.0, 40, seq=0, ask=2345.0))
        await pipeline.on_trade(_trade(_BASE + 2_000, 2345.1, 5, seq=1, ask=2345.1))

    asyncio.run(run())

    # Raw ticks recorded to the Tick_Store (before any throttling). (Req 4.5)
    ticks = list(tick_store.read_range(_ACTIVE, _BASE, _BASE + 60_000))
    assert len(ticks) == 2

    # Chart cache is keyed by the logical GC contract. Raw ticks retain the
    # original NT source contract, but derived history is contractless for UI.
    bars = cache.read_bars(_SYMBOL, _ACTIVE, "1m", None, None, 10)
    assert bars == []
    chart_bars = cache.read_bars(_SYMBOL, _SYMBOL, "1m", None, None, 10)
    assert chart_bars and chart_bars[-1].volume == 45

    # VolumeDelta persists from the tick path; footprint is native-bar only.
    vd = cache.read_volume_delta(_SYMBOL, _ACTIVE, "1m", None, None, 10)
    assert vd == []
    chart_vd = cache.read_volume_delta(_SYMBOL, _SYMBOL, "1m", None, None, 10)
    assert chart_vd and chart_vd[-1].volume == 45
    fp = cache.read_footprint_bars(_SYMBOL, _ACTIVE, "1m", None, None, 10)
    assert fp == []
    chart_fp = cache.read_footprint_bars(_SYMBOL, _SYMBOL, "1m", None, None, 10)
    assert chart_fp == []

    # Outbound events enqueued for /ws/chart, excluding tick-derived footprint.
    types = {e.event_type for e in captured}
    assert EventType.BAR_UPDATE in types
    assert EventType.VOLUME_DELTA_UPDATE in types
    assert EventType.FOOTPRINT_UPDATE not in types
    assert any(
        e.event_type == EventType.BAR_UPDATE and e.payload["contract"] == _SYMBOL
        for e in captured
    )


@pytest.mark.integration
def test_pipeline_persists_and_streams_fvg_signals_as_chart_contract(pipeline_env):
    pipeline, cache, _, _, captured = pipeline_env
    seq = 0

    async def send(minute: int, offset: int, price: float, volume: int, side: Side):
        nonlocal seq
        seq += 1
        await pipeline.on_trade(
            _classified_trade(
                _BASE + minute * _MINUTE_MS + offset,
                price,
                volume,
                seq,
                side,
            )
        )

    async def send_bar(minute: int, open_price: float, close_price: float, delta: int):
        if delta > 0:
            await send(minute, 0, open_price, 1, Side.BUY)
            await send(minute, 100, close_price, max(1, delta - 1), Side.BUY)
        elif delta < 0:
            volume = abs(delta)
            await send(minute, 0, open_price, 1, Side.SELL)
            await send(minute, 100, close_price, max(1, volume - 1), Side.SELL)
        else:
            await send(minute, 0, open_price, 5, Side.SELL)
            await send(minute, 100, close_price, 5, Side.BUY)

    async def run():
        for minute, delta in enumerate([0, 5, 0, 5, 0, 5, 0, 5, -30, -10]):
            open_price = 99.0 + (minute % 2) * 0.1
            close_price = open_price + (0.1 if delta >= 0 else -0.1)
            await send_bar(minute, open_price, close_price, delta)
        await send_bar(10, 100.0, 100.5, 10)
        await send_bar(11, 100.6, 101.0, 100)
        await send_bar(12, 100.7, 100.8, 5)
        await send_bar(13, 100.8, 100.9, 5)

    asyncio.run(run())

    events = [
        event
        for event in captured
        if event.event_type == EventType.FVG_SIGNAL_UPDATE
    ]
    assert any(
        event.payload["contract"] == _SYMBOL
        and event.payload["phase"] == "preview"
        for event in events
    )
    assert any(
        event.payload["contract"] == _SYMBOL
        and event.payload["phase"] == "confirmed"
        for event in events
    )
    rows = cache.read_fvg_signals(_SYMBOL, _SYMBOL, "1m", None, None, 10)
    assert len(rows) == 1
    assert rows[0].contract == _SYMBOL
    assert rows[0].pulse == 5
    assert cache.read_fvg_signals(_SYMBOL, _ACTIVE, "1m", None, None, 10) == []


@pytest.mark.integration
def test_pipeline_streams_native_fvg_preview_without_persisting(tmp_path):
    cache = CacheStore(tmp_path / "app.sqlite")
    tick_store = TickStore(tmp_path / "ticks")
    resolver = ContractResolver(_CANDIDATES)
    resolver.set_manual_override(_ACTIVE)
    registry = WebSocketRegistry()
    captured: list[OutboundEvent] = []
    registry.enqueue = captured.append  # type: ignore[assignment]
    native_fvg = FvgSignalEngine()
    for minute, delta in enumerate([0, 5, 0, 5, 0, 5, 0, 5, -30, -10]):
        open_price = 99.0 + (minute % 2) * 0.1
        close_price = open_price + (0.1 if delta >= 0 else -0.1)
        _native_fvg_bar(native_fvg, minute, open_price, close_price, delta)
    _native_fvg_bar(native_fvg, 10, 100.0, 100.5, 10)
    _native_fvg_bar(native_fvg, 11, 100.6, 101.0, 100)

    pipeline = Pipeline(
        registry=registry,
        cache=cache,
        tick_store=tick_store,
        resolver=resolver,
        symbol=_SYMBOL,
        native_fvg_signal=native_fvg,
        enable_tick_fvg_signal=False,
    )

    try:
        async def run():
            await pipeline.on_trade(
                _classified_trade(
                    _BASE + 12 * _MINUTE_MS,
                    100.7,
                    1,
                    1,
                    Side.BUY,
                )
            )

        asyncio.run(run())

        events = [
            event.payload
            for event in captured
            if event.event_type == EventType.FVG_SIGNAL_UPDATE
        ]
        assert events
        assert events[-1]["contract"] == _SYMBOL
        assert events[-1]["phase"] == "preview"
        assert events[-1]["time"] == _BASE + 11 * _MINUTE_MS
        assert events[-1]["pulse"] == 5
        assert cache.read_fvg_signals(_SYMBOL, _SYMBOL, "1m", None, None, 10) == []
    finally:
        tick_store.close()
        cache.close()


@pytest.mark.integration
def test_pipeline_hydrates_open_cached_bar_on_start(tmp_path):
    cache = CacheStore(tmp_path / "app.sqlite")
    tick_store = TickStore(tmp_path / "ticks")
    resolver = ContractResolver(_CANDIDATES)
    resolver.set_manual_override(_ACTIVE)
    registry = WebSocketRegistry()
    captured: list[OutboundEvent] = []
    registry.enqueue = captured.append  # type: ignore[assignment]
    cache.upsert_bar(
        BarRecord(
            symbol=_SYMBOL,
            contract=_SYMBOL,
            timeframe="1m",
            time=_BASE,
            open=100.0,
            high=102.0,
            low=99.0,
            close=101.0,
            volume=10,
            closed=False,
        )
    )
    cache.upsert_volume_delta(
        VolumeDeltaRecord(
            symbol=_SYMBOL,
            contract=_SYMBOL,
            timeframe="1m",
            time=_BASE,
            volume=10,
            buy_volume=10,
            sell_volume=0,
            delta=10,
            delta_high=10,
            delta_low=10,
            open_delta=10,
            close_delta=10,
        )
    )
    pipeline = Pipeline(
        registry=registry,
        cache=cache,
        tick_store=tick_store,
        resolver=resolver,
        symbol=_SYMBOL,
    )
    try:
        async def run():
            await pipeline.on_trade(_trade(_BASE + 1_000, 103.0, 5, seq=0, ask=103.0))

        asyncio.run(run())

        chart_bars = cache.read_bars(_SYMBOL, _SYMBOL, "1m", None, None, 10)
        assert chart_bars[-1].time == _BASE
        assert chart_bars[-1].open == 100.0
        assert chart_bars[-1].high == 103.0
        assert chart_bars[-1].low == 99.0
        assert chart_bars[-1].close == 103.0
        assert chart_bars[-1].volume == 15

        chart_vd = cache.read_volume_delta(_SYMBOL, _SYMBOL, "1m", None, None, 10)
        assert chart_vd[-1].time == _BASE
        assert chart_vd[-1].volume == 15
        assert chart_vd[-1].buy_volume == 15
        assert chart_vd[-1].close_delta == 15
    finally:
        tick_store.close()
        cache.close()


def _smc_alert(repeat=True):
    params = {
        "bigTradeThreshold": 50,
        "swingLength": 50,
        "lookaheadBars": 5,
        "effectiveLookaheadBars": 5,
        "maxBars": 20,
        "pauseOnInsideBars": True,
    }
    if repeat:
        params["repeat"] = True
    return Alert(
        id="smc",
        symbol=_SYMBOL,
        type=SMC_EXTERNAL_BREAK_BIG_TRADE,
        params=params,
    )


async def _feed_ohlc_bar(pipeline, index, open_, high, low, close, seq):
    base = _BASE + index * 60_000
    for offset, price in (
        (1_000, open_),
        (2_000, high),
        (3_000, low),
        (4_000, close),
    ):
        await pipeline.on_trade(
            _trade(base + offset, price, 1, seq=seq, ask=price)
        )
        seq += 1
    return seq

async def _feed_m5_ohlc_bar(pipeline, index, open_, high, low, close, seq):
    base = _BASE + index * 5 * 60_000
    for offset, price in (
        (1_000, open_),
        (60_000, high),
        (120_000, low),
        (240_000, close),
    ):
        await pipeline.on_trade(
            _trade(base + offset, price, 1, seq=seq, ask=price)
        )
        seq += 1
    return seq


async def _feed_bullish_external_break_setup(pipeline):
    seq = 0
    seq = await _feed_ohlc_bar(pipeline, 0, 95, 99, 91, 95, seq)
    seq = await _feed_ohlc_bar(pipeline, 1, 95, 100, 90, 95, seq)
    for i in range(2, 52):
        seq = await _feed_ohlc_bar(pipeline, i, 95, 99, 91, 95, seq)
    seq = await _feed_ohlc_bar(pipeline, 52, 95, 102, 94, 101, seq)
    return seq


@pytest.mark.integration
def test_big_trade_emitted_after_merge_and_filter(pipeline_env):
    pipeline, cache, tick_store, resolver, captured = pipeline_env

    async def run():
        # Two same-(time,side) buys merge to 35 >= MinVolume 30 -> emit on flush
        # when a later timestamp arrives.
        await pipeline.on_trade(_trade(_BASE + 1_000, 2345.0, 20, seq=0, ask=2345.0))
        await pipeline.on_trade(_trade(_BASE + 1_000, 2345.0, 15, seq=1, ask=2345.0))
        await pipeline.on_trade(_trade(_BASE + 2_000, 2345.0, 1, seq=2, ask=2345.0))

    asyncio.run(run())

    big = cache.read_big_trades(_SYMBOL, _ACTIVE, None, None, 10)
    assert big == []
    chart_big = cache.read_big_trades(_SYMBOL, _SYMBOL, None, None, 10)
    assert chart_big and chart_big[0].volume == 35
    assert any(e.event_type == EventType.BIG_TRADE for e in captured)


@pytest.mark.integration
def test_parallel_source_contract_is_recorded_but_not_charted(pipeline_env):
    pipeline, cache, tick_store, resolver, captured = pipeline_env

    async def run():
        await pipeline.on_trade(_trade(_BASE + 1_000, 2345.0, 10, seq=0))
        await pipeline.on_trade(
            _trade(_BASE + 2_000, 2346.0, 15, seq=0, contract="GC 10-26")
        )

    asyncio.run(run())

    assert len(list(tick_store.read_range(_ACTIVE, _BASE, _BASE + 60_000))) == 1
    assert len(list(tick_store.read_range("GC 10-26", _BASE, _BASE + 60_000))) == 1
    chart_bars = cache.read_bars(_SYMBOL, _SYMBOL, "1m", None, None, 10)
    assert chart_bars and chart_bars[-1].volume == 10
    assert all(
        event.payload.get("contract") == _SYMBOL
        for event in captured
        if event.event_type in {
            EventType.BAR_UPDATE,
            EventType.VOLUME_DELTA_UPDATE,
            EventType.FOOTPRINT_UPDATE,
            EventType.BIG_TRADE,
        }
    )


@pytest.mark.integration
def test_source_contract_switch_after_active_source_goes_quiet(pipeline_env):
    pipeline, cache, tick_store, resolver, captured = pipeline_env

    async def run():
        await pipeline.on_trade(_trade(_BASE + 1_000, 2345.0, 10, seq=0))
        await pipeline.on_trade(
            _trade(_BASE + 20_000, 2346.0, 15, seq=0, contract="GC 10-26")
        )

    asyncio.run(run())

    assert len(list(tick_store.read_range(_ACTIVE, _BASE, _BASE + 60_000))) == 1
    assert len(list(tick_store.read_range("GC 10-26", _BASE, _BASE + 60_000))) == 1
    chart_bars = cache.read_bars(_SYMBOL, _SYMBOL, "1m", None, None, 10)
    assert chart_bars and chart_bars[-1].volume == 25


@pytest.mark.integration
def test_status_frame_forwarded_to_clients(pipeline_env):
    pipeline, cache, tick_store, resolver, captured = pipeline_env

    async def run():
        await pipeline.on_status(
            NTStatusEvent(
                source="nt_addon",
                state=StatusState.CONNECTED,
                time=_BASE,
            )
        )

    asyncio.run(run())
    status_events = [e for e in captured if e.event_type == EventType.STATUS]
    assert status_events
    assert status_events[0].payload["state"] == "connected"


@pytest.mark.integration
def test_backend_sends_alert_text_when_no_chart_client(tmp_path):
    cache = CacheStore(tmp_path / "app.sqlite")
    tick_store = TickStore(tmp_path / "ticks")
    resolver = ContractResolver(_CANDIDATES)
    resolver.set_manual_override(_ACTIVE)
    registry = WebSocketRegistry()
    captured: list[OutboundEvent] = []
    sent = []
    registry.enqueue = captured.append  # type: ignore[assignment]
    pipeline = Pipeline(
        registry=registry,
        cache=cache,
        tick_store=tick_store,
        resolver=resolver,
        symbol=_SYMBOL,
        send_alert_text=sent.append,
    )
    try:
        pipeline.alert_engine.upsert(
            Alert(
                id="cross",
                symbol=_SYMBOL,
                type="price_crosses_level",
                params={"level": 100.0},
            )
        )

        async def run():
            await pipeline.on_trade(_trade(_BASE + 1_000, 99.0, 1, seq=0))
            await pipeline.on_trade(_trade(_BASE + 2_000, 101.0, 1, seq=1))

        asyncio.run(run())

        assert [event.alert_id for event in sent] == ["cross"]
        assert any(e.event_type == EventType.ALERT_EVENT for e in captured)
    finally:
        tick_store.close()
        cache.close()


@pytest.mark.integration
def test_backend_skips_alert_text_fallback_when_chart_client_connected(tmp_path):
    cache = CacheStore(tmp_path / "app.sqlite")
    tick_store = TickStore(tmp_path / "ticks")
    resolver = ContractResolver(_CANDIDATES)
    resolver.set_manual_override(_ACTIVE)
    registry = WebSocketRegistry()
    captured: list[OutboundEvent] = []
    sent = []
    registry.enqueue = captured.append  # type: ignore[assignment]
    pipeline = Pipeline(
        registry=registry,
        cache=cache,
        tick_store=tick_store,
        resolver=resolver,
        symbol=_SYMBOL,
        send_alert_text=sent.append,
    )
    try:
        pipeline.alert_engine.upsert(
            Alert(
                id="cross",
                symbol=_SYMBOL,
                type="price_crosses_level",
                params={"level": 100.0},
            )
        )

        async def run():
            await registry.register(ChartClient("chart-1", lambda _payload: None))
            await pipeline.on_trade(_trade(_BASE + 1_000, 99.0, 1, seq=0))
            await pipeline.on_trade(_trade(_BASE + 2_000, 101.0, 1, seq=1))

        asyncio.run(run())

        assert sent == []
        assert any(e.event_type == EventType.ALERT_EVENT for e in captured)
    finally:
        tick_store.close()
        cache.close()


@pytest.mark.integration
def test_pipeline_smc_strategy_alert_fires_on_qualifying_big_trade(pipeline_env):
    pipeline, cache, tick_store, resolver, captured = pipeline_env
    pipeline.alert_engine.upsert(_smc_alert())

    async def run():
        seq = await _feed_bullish_external_break_setup(pipeline)
        await pipeline.on_trade(
            _trade(_BASE + 53 * 60_000 + 1_000, 101.5, 80, seq=seq, ask=101.5)
        )
        await pipeline.on_trade(
            _trade(_BASE + 53 * 60_000 + 2_000, 101.6, 1, seq=seq + 1, ask=101.6)
        )

    asyncio.run(run())

    alerts = [e.payload for e in captured if e.event_type == EventType.ALERT_EVENT]
    assert alerts
    assert alerts[-1]["alertType"] == SMC_EXTERNAL_BREAK_BIG_TRADE
    assert alerts[-1]["level"] == 100
    assert "big trade 80 > 50" in alerts[-1]["message"]


@pytest.mark.integration
def test_pipeline_smc_strategy_alert_cancels_on_reclaim_without_alert(pipeline_env):
    pipeline, cache, tick_store, resolver, captured = pipeline_env
    pipeline.alert_engine.upsert(_smc_alert())

    async def run():
        seq = await _feed_bullish_external_break_setup(pipeline)
        seq = await _feed_ohlc_bar(pipeline, 53, 101, 102, 99, 100, seq)
        await pipeline.on_trade(
            _trade(_BASE + 54 * 60_000 + 1_000, 100.5, 1, seq=seq, ask=100.5)
        )
        await pipeline.on_trade(
            _trade(_BASE + 54 * 60_000 + 2_000, 101.5, 80, seq=seq + 1, ask=101.5)
        )
        await pipeline.on_trade(
            _trade(_BASE + 54 * 60_000 + 3_000, 101.6, 1, seq=seq + 2, ask=101.6)
        )

    asyncio.run(run())

    alerts = [
        e.payload
        for e in captured
        if e.event_type == EventType.ALERT_EVENT
        and e.payload["alertType"] == SMC_EXTERNAL_BREAK_BIG_TRADE
    ]
    assert alerts == []


@pytest.mark.integration
def test_pipeline_mgann_fvg_retest_alert_fires_on_m5_closed_bar(pipeline_env):
    pipeline, cache, tick_store, resolver, captured = pipeline_env
    pipeline.alert_engine.upsert(
        Alert(
            id="mgann",
            symbol=_SYMBOL,
            type=MGANN_FVG_RETEST,
            params={"repeat": True},
        )
    )

    async def run():
        seq = 0
        bars = [
            (100.0, 101.0, 100.0, 100.5),
            (100.5, 102.0, 100.5, 101.8),
            (101.8, 103.0, 101.5, 102.8),
            (102.8, 104.0, 102.0, 103.0),
            (103.0, 105.0, 103.0, 104.5),
            (104.5, 104.0, 102.5, 103.0),
            (103.0, 103.0, 101.8, 102.0),
            (101.3, 102.0, 101.1, 101.4),
            (101.4, 102.2, 101.1, 101.8),
            (101.8, 103.0, 101.4, 102.8),
            (102.8, 104.0, 102.5, 103.8),
        ]
        for index, bar in enumerate(bars):
            seq = await _feed_m5_ohlc_bar(pipeline, index, *bar, seq)

    asyncio.run(run())

    alerts = [
        e.payload
        for e in captured
        if e.event_type == EventType.ALERT_EVENT
        and e.payload["alertType"] == MGANN_FVG_RETEST
    ]
    assert alerts
    assert alerts[-1]["level"] == 101.25
    assert "M5 bullish FVG retest by mGann wave" in alerts[-1]["message"]


@pytest.mark.integration
def test_control_plane_subscribes_active_contract_on_first_sync(pipeline_env):
    pipeline, cache, tick_store, resolver, captured = pipeline_env
    sent: list[ControlCommand] = []

    async def run():
        cp = ControlPlaneCoordinator(sent.append)
        pipeline.set_control_plane(cp)
        # First observe seeds activity; the control plane diffs {} -> active.
        await pipeline.on_trade(_trade(_BASE + 1_000, 2345.0, 5, seq=0))

    asyncio.run(run())
    subscribed = {c.contract for c in sent if c.action is ControlAction.SUBSCRIBE}
    assert subscribed == {_ACTIVE}
