"""Integration tests for the full pipeline wiring (tasks 20.1, 20.2).

Covers the ingest -> engines -> registry -> frontend pipeline assembled by
:class:`~app.pipeline.Pipeline` and the live `/ws/nt` + `/ws/chart` transport:

* `/ws/nt` accept + receive of trade frames (Req 4.1);
* an accepted Active_Contract trade drives the Bar_Aggregator, VolumeDelta,
  Footprint, and BigTrade engines, persists their outputs to the Cache_Store,
  and enqueues `/ws/chart` events on the registry (Req 9.3, 20.1);
* raw ticks are recorded to the Tick_Store on ingestion (Req 4.5);
* NT startup subscribes to all candidate contracts via Control_Commands (Req 1.5);
* an NT status frame is forwarded to subscribed clients (Req 20.1, 20.3).
"""

from __future__ import annotations

import asyncio

import pytest

from app.engines.contract_resolver import ContractResolver
from app.engines.alert_engine import Alert
from app.ingest.control_plane import ControlPlaneCoordinator
from app.models.canonical import NormalizedTrade
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
from app.storage.tick_store import TickStore

_SYMBOL = "GC"
_CANDIDATES = ["GC 08-26", "GC 10-26", "GC 12-26"]
_ACTIVE = "GC 08-26"
_BASE = 1_730_419_200_000


@pytest.fixture()
def pipeline_env(tmp_path):
    cache = CacheStore(tmp_path / "app.sqlite")
    tick_store = TickStore(tmp_path / "ticks")
    resolver = ContractResolver(_CANDIDATES)
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


@pytest.mark.integration
def test_accepted_trade_runs_engines_persists_and_streams(pipeline_env):
    pipeline, cache, tick_store, resolver, captured = pipeline_env

    async def run():
        # Force the active contract so engines fire deterministically.
        resolver.set_manual_override(_ACTIVE)
        await pipeline.on_trade(_trade(_BASE + 1_000, 2345.0, 40, seq=0, ask=2345.0))
        await pipeline.on_trade(_trade(_BASE + 2_000, 2345.1, 5, seq=1, ask=2345.1))

    asyncio.run(run())

    # Raw ticks recorded to the Tick_Store (before any throttling). (Req 4.5)
    ticks = list(tick_store.read_range(_ACTIVE, _BASE, _BASE + 60_000))
    assert len(ticks) == 2

    # Bars persisted to the Cache_Store. (Req 9.3)
    bars = cache.read_bars(_SYMBOL, _ACTIVE, "1m", None, None, 10)
    assert bars and bars[-1].volume == 45

    # VolumeDelta + footprint persisted.
    vd = cache.read_volume_delta(_SYMBOL, _ACTIVE, "1m", None, None, 10)
    assert vd and vd[-1].volume == 45
    fp = cache.read_footprint_bars(_SYMBOL, _ACTIVE, "1m", None, None, 10)
    assert fp

    # Outbound events enqueued for /ws/chart, including bar + order-flow types.
    types = {e.event_type for e in captured}
    assert EventType.BAR_UPDATE in types
    assert EventType.VOLUME_DELTA_UPDATE in types
    assert EventType.FOOTPRINT_UPDATE in types


@pytest.mark.integration
def test_big_trade_emitted_after_merge_and_filter(pipeline_env):
    pipeline, cache, tick_store, resolver, captured = pipeline_env

    async def run():
        resolver.set_manual_override(_ACTIVE)
        # Two same-(time,side) buys merge to 35 >= MinVolume 30 -> emit on flush
        # when a later timestamp arrives.
        await pipeline.on_trade(_trade(_BASE + 1_000, 2345.0, 20, seq=0, ask=2345.0))
        await pipeline.on_trade(_trade(_BASE + 1_000, 2345.0, 15, seq=1, ask=2345.0))
        await pipeline.on_trade(_trade(_BASE + 2_000, 2345.0, 1, seq=2, ask=2345.0))

    asyncio.run(run())

    big = cache.read_big_trades(_SYMBOL, _ACTIVE, None, None, 10)
    assert big and big[0].volume == 35
    assert any(e.event_type == EventType.BIG_TRADE for e in captured)


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
            resolver.set_manual_override(_ACTIVE)
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
            resolver.set_manual_override(_ACTIVE)
            await pipeline.on_trade(_trade(_BASE + 1_000, 99.0, 1, seq=0))
            await pipeline.on_trade(_trade(_BASE + 2_000, 101.0, 1, seq=1))

        asyncio.run(run())

        assert sent == []
        assert any(e.event_type == EventType.ALERT_EVENT for e in captured)
    finally:
        tick_store.close()
        cache.close()


@pytest.mark.integration
def test_control_plane_subscribes_all_candidates_on_first_sync(pipeline_env):
    pipeline, cache, tick_store, resolver, captured = pipeline_env
    sent: list[ControlCommand] = []

    async def run():
        cp = ControlPlaneCoordinator(sent.append)
        pipeline.set_control_plane(cp)
        # First observe seeds activity; the control plane diffs {} -> all candidates.
        await pipeline.on_trade(_trade(_BASE + 1_000, 2345.0, 5, seq=0))

    asyncio.run(run())
    subscribed = {c.contract for c in sent if c.action is ControlAction.SUBSCRIBE}
    assert subscribed == set(_CANDIDATES)
