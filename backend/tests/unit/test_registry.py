"""Unit tests for the WebSocket_Registry registration + subscription core (8.1).

Example-based coverage of client registration on ``/ws/chart`` (Req 5.1),
per-client ``(symbol, event_types)`` subscription tracking, ``subscribe``
beginning event delivery (Req 5.4), and ``unsubscribe`` stopping it (Req 5.5).

The registry is exercised with an injected fake ``send`` transport (no live
WebSocket). Async coroutines are driven with ``asyncio.run``.
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from app.models.messages import EventType
from app.registry import ChartClient, WebSocketRegistry


class FakeTransport:
    """Records payloads handed to a client's ``send`` callable.

    Not invoked by task 8.1 (registration + subscription only); present to
    confirm the registry stores a usable transport seam for the broadcast path.
    """

    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []

    def __call__(self, payload: dict[str, Any]) -> None:
        self.sent.append(payload)


def _client(client_id: str = "c1") -> ChartClient:
    return ChartClient(client_id, FakeTransport())


# --- registration -------------------------------------------------------------


@pytest.mark.unit
def test_register_adds_client():
    reg = WebSocketRegistry()
    client = _client("c1")

    asyncio.run(reg.register(client))

    assert reg.client_count == 1
    assert "c1" in reg
    assert reg.get("c1") is client


@pytest.mark.unit
def test_register_duplicate_id_raises():
    reg = WebSocketRegistry()
    asyncio.run(reg.register(_client("dup")))

    with pytest.raises(ValueError):
        asyncio.run(reg.register(_client("dup")))


@pytest.mark.unit
def test_unregister_removes_and_returns_client():
    reg = WebSocketRegistry()
    client = _client("c1")
    asyncio.run(reg.register(client))

    removed = asyncio.run(reg.unregister("c1"))

    assert removed is client
    assert reg.client_count == 0
    assert "c1" not in reg


@pytest.mark.unit
def test_unregister_unknown_returns_none():
    reg = WebSocketRegistry()
    assert asyncio.run(reg.unregister("ghost")) is None


@pytest.mark.unit
def test_clients_snapshot_preserves_registration_order():
    reg = WebSocketRegistry()
    asyncio.run(reg.register(_client("a")))
    asyncio.run(reg.register(_client("b")))
    asyncio.run(reg.register(_client("c")))

    assert [c.id for c in reg.clients] == ["a", "b", "c"]


# --- subscribe (Req 5.4) ------------------------------------------------------


@pytest.mark.unit
def test_subscribe_tracks_event_types_for_symbol():
    reg = WebSocketRegistry()
    asyncio.run(reg.register(_client("c1")))

    asyncio.run(
        reg.subscribe("c1", "GC", [EventType.BAR_UPDATE, EventType.QUOTE_UPDATE])
    )

    assert reg.wants("c1", "GC", EventType.BAR_UPDATE) is True
    assert reg.wants("c1", "GC", EventType.QUOTE_UPDATE) is True
    assert reg.wants("c1", "GC", EventType.BIG_TRADE) is False


@pytest.mark.unit
def test_subscribe_accepts_string_event_literals():
    reg = WebSocketRegistry()
    asyncio.run(reg.register(_client("c1")))

    asyncio.run(reg.subscribe("c1", "GC", ["bar_update", "footprint_update"]))

    assert reg.wants("c1", "GC", EventType.BAR_UPDATE) is True
    assert reg.wants("c1", "GC", EventType.FOOTPRINT_UPDATE) is True


@pytest.mark.unit
def test_subscribe_is_additive_and_idempotent():
    reg = WebSocketRegistry()
    asyncio.run(reg.register(_client("c1")))

    asyncio.run(reg.subscribe("c1", "GC", [EventType.BAR_UPDATE]))
    asyncio.run(reg.subscribe("c1", "GC", [EventType.BAR_UPDATE, EventType.BIG_TRADE]))

    subs = reg.get("c1").subscriptions
    assert subs["GC"] == frozenset({EventType.BAR_UPDATE, EventType.BIG_TRADE})


@pytest.mark.unit
def test_subscribe_separates_symbols():
    reg = WebSocketRegistry()
    asyncio.run(reg.register(_client("c1")))

    asyncio.run(reg.subscribe("c1", "GC", [EventType.BAR_UPDATE]))
    asyncio.run(reg.subscribe("c1", "SI", [EventType.QUOTE_UPDATE]))

    assert reg.wants("c1", "GC", EventType.BAR_UPDATE) is True
    assert reg.wants("c1", "GC", EventType.QUOTE_UPDATE) is False
    assert reg.wants("c1", "SI", EventType.QUOTE_UPDATE) is True
    assert reg.wants("c1", "SI", EventType.BAR_UPDATE) is False


@pytest.mark.unit
def test_subscribe_filters_timeframe_scoped_events():
    reg = WebSocketRegistry()
    asyncio.run(reg.register(_client("c1")))

    asyncio.run(
        reg.subscribe(
            "c1",
            "GC",
            [EventType.BAR_UPDATE, EventType.QUOTE_UPDATE],
            timeframe="1m",
        )
    )

    assert reg.wants("c1", "GC", EventType.BAR_UPDATE, "1m") is True
    assert reg.wants("c1", "GC", EventType.BAR_UPDATE, "5m") is False
    assert reg.wants("c1", "GC", EventType.QUOTE_UPDATE, "5m") is True


@pytest.mark.unit
def test_subscribe_empty_event_types_creates_no_symbol_entry():
    reg = WebSocketRegistry()
    asyncio.run(reg.register(_client("c1")))

    asyncio.run(reg.subscribe("c1", "GC", []))

    assert reg.get("c1").subscriptions == {}


@pytest.mark.unit
def test_subscribe_unknown_client_raises():
    reg = WebSocketRegistry()
    with pytest.raises(KeyError):
        asyncio.run(reg.subscribe("ghost", "GC", [EventType.BAR_UPDATE]))


@pytest.mark.unit
def test_subscribe_unknown_event_literal_raises():
    reg = WebSocketRegistry()
    asyncio.run(reg.register(_client("c1")))
    with pytest.raises(ValueError):
        asyncio.run(reg.subscribe("c1", "GC", ["not_a_real_event"]))


# --- unsubscribe (Req 5.5) ----------------------------------------------------


@pytest.mark.unit
def test_unsubscribe_stops_sending_event_type():
    reg = WebSocketRegistry()
    asyncio.run(reg.register(_client("c1")))
    asyncio.run(
        reg.subscribe("c1", "GC", [EventType.BAR_UPDATE, EventType.QUOTE_UPDATE])
    )

    asyncio.run(reg.unsubscribe("c1", [EventType.QUOTE_UPDATE]))

    assert reg.wants("c1", "GC", EventType.QUOTE_UPDATE) is False
    assert reg.wants("c1", "GC", EventType.BAR_UPDATE) is True


@pytest.mark.unit
def test_unsubscribe_removes_only_selected_timeframe():
    reg = WebSocketRegistry()
    asyncio.run(reg.register(_client("c1")))
    asyncio.run(reg.subscribe("c1", "GC", [EventType.BAR_UPDATE], timeframe="1m"))
    asyncio.run(reg.subscribe("c1", "GC", [EventType.BAR_UPDATE], timeframe="5m"))

    asyncio.run(
        reg.unsubscribe(
            "c1", [EventType.BAR_UPDATE], symbol="GC", timeframe="1m"
        )
    )

    assert reg.wants("c1", "GC", EventType.BAR_UPDATE, "1m") is False
    assert reg.wants("c1", "GC", EventType.BAR_UPDATE, "5m") is True


@pytest.mark.unit
def test_unsubscribe_is_symbol_agnostic():
    # Req 5.5: the unsubscribed event type stops for the client across symbols.
    reg = WebSocketRegistry()
    asyncio.run(reg.register(_client("c1")))
    asyncio.run(reg.subscribe("c1", "GC", [EventType.STATUS, EventType.BAR_UPDATE]))
    asyncio.run(reg.subscribe("c1", "SI", [EventType.STATUS]))

    asyncio.run(reg.unsubscribe("c1", [EventType.STATUS]))

    assert reg.wants("c1", "GC", EventType.STATUS) is False
    assert reg.wants("c1", "SI", EventType.STATUS) is False
    assert reg.wants("c1", "GC", EventType.BAR_UPDATE) is True


@pytest.mark.unit
def test_unsubscribe_drops_symbol_when_empty():
    reg = WebSocketRegistry()
    asyncio.run(reg.register(_client("c1")))
    asyncio.run(reg.subscribe("c1", "GC", [EventType.BAR_UPDATE]))

    asyncio.run(reg.unsubscribe("c1", [EventType.BAR_UPDATE]))

    assert reg.get("c1").subscriptions == {}


@pytest.mark.unit
def test_unsubscribe_unknown_event_type_is_noop():
    reg = WebSocketRegistry()
    asyncio.run(reg.register(_client("c1")))
    asyncio.run(reg.subscribe("c1", "GC", [EventType.BAR_UPDATE]))

    asyncio.run(reg.unsubscribe("c1", [EventType.BIG_TRADE]))

    assert reg.wants("c1", "GC", EventType.BAR_UPDATE) is True


@pytest.mark.unit
def test_unsubscribe_unknown_client_raises():
    reg = WebSocketRegistry()
    with pytest.raises(KeyError):
        asyncio.run(reg.unsubscribe("ghost", [EventType.BAR_UPDATE]))


# --- subscribe / unsubscribe round-trip ---------------------------------------


@pytest.mark.unit
def test_subscribe_unsubscribe_round_trip_restores_empty_state():
    reg = WebSocketRegistry()
    asyncio.run(reg.register(_client("c1")))
    events = [EventType.BAR_UPDATE, EventType.QUOTE_UPDATE, EventType.BIG_TRADE]

    asyncio.run(reg.subscribe("c1", "GC", events))
    asyncio.run(reg.unsubscribe("c1", events))

    assert reg.get("c1").subscriptions == {}
    for et in events:
        assert reg.wants("c1", "GC", et) is False


@pytest.mark.unit
def test_wants_false_for_unknown_client():
    reg = WebSocketRegistry()
    assert reg.wants("ghost", "GC", EventType.BAR_UPDATE) is False


@pytest.mark.unit
def test_per_client_subscriptions_are_isolated():
    reg = WebSocketRegistry()
    asyncio.run(reg.register(_client("c1")))
    asyncio.run(reg.register(_client("c2")))

    asyncio.run(reg.subscribe("c1", "GC", [EventType.BAR_UPDATE]))

    assert reg.wants("c1", "GC", EventType.BAR_UPDATE) is True
    assert reg.wants("c2", "GC", EventType.BAR_UPDATE) is False


# --- heartbeat + broadcast isolation (task 8.5) -------------------------------
#
# Covers Req 6.1 (ping every interval), Req 6.3 (drop clients with no pong
# within the timeout), and Req 6.4 (one client's send failure removes only that
# client and never aborts the broadcast). All timing is driven through the
# registry's injectable clock/sleep so tests never wait 30/60s in real time.

from app.models.messages import EventType as _ET  # noqa: E402
from app.registry import OutboundEvent  # noqa: E402


class FailingTransport:
    """A send callable that raises on every call (a dead connection)."""

    def __init__(self) -> None:
        self.calls = 0

    def __call__(self, payload: dict[str, Any]) -> None:
        self.calls += 1
        raise ConnectionResetError("client socket is dead")


class CloseRecorder:
    """Records whether a client's close hook was invoked."""

    def __init__(self) -> None:
        self.closed = 0

    def __call__(self) -> None:
        self.closed += 1


class ManualClock:
    """A clock whose value is advanced explicitly by the test."""

    def __init__(self, start: float = 0.0) -> None:
        self.now = float(start)

    def __call__(self) -> float:
        return self.now


def _bar_event(symbol: str = "GC") -> OutboundEvent:
    payload = {"type": "bar_update", "symbol": symbol, "tf": "1m"}
    return OutboundEvent(
        event_type=_ET.BAR_UPDATE, symbol=symbol, payload=payload, key=("1m", 0)
    )


# --- broadcast isolation (Req 6.4) --------------------------------------------


@pytest.mark.unit
def test_broadcast_delivers_to_subscribed_clients_only():
    reg = WebSocketRegistry()
    t_yes = FakeTransport()
    t_no = FakeTransport()
    asyncio.run(reg.register(ChartClient("yes", t_yes)))
    asyncio.run(reg.register(ChartClient("no", t_no)))
    asyncio.run(reg.subscribe("yes", "GC", [EventType.BAR_UPDATE]))

    delivered = asyncio.run(reg.broadcast(_bar_event()))

    assert delivered == 1
    assert len(t_yes.sent) == 1
    assert t_no.sent == []


@pytest.mark.unit
def test_broadcast_isolates_failing_client_and_continues():
    # Req 6.4: an exception sending to one client removes only that dead client
    # and the broadcast continues to the rest.
    reg = WebSocketRegistry()
    ok1, bad, ok2 = FakeTransport(), FailingTransport(), FakeTransport()
    asyncio.run(reg.register(ChartClient("ok1", ok1)))
    asyncio.run(reg.register(ChartClient("bad", bad)))
    asyncio.run(reg.register(ChartClient("ok2", ok2)))
    for cid in ("ok1", "bad", "ok2"):
        asyncio.run(reg.subscribe(cid, "GC", [EventType.BAR_UPDATE]))

    delivered = asyncio.run(reg.broadcast(_bar_event()))

    # The two healthy clients received the event; the failing one was dropped.
    assert delivered == 2
    assert len(ok1.sent) == 1
    assert len(ok2.sent) == 1
    assert bad.calls == 1
    assert "bad" not in reg
    assert reg.client_count == 2


@pytest.mark.unit
def test_broadcast_drops_failing_client_and_invokes_close_hook():
    reg = WebSocketRegistry()
    closer = CloseRecorder()
    asyncio.run(reg.register(ChartClient("bad", FailingTransport(), closer)))
    asyncio.run(reg.subscribe("bad", "GC", [EventType.BAR_UPDATE]))

    delivered = asyncio.run(reg.broadcast(_bar_event()))

    assert delivered == 0
    assert "bad" not in reg
    assert closer.closed == 1


@pytest.mark.unit
def test_broadcast_supports_async_send():
    reg = WebSocketRegistry()
    received: list[dict[str, Any]] = []

    async def async_send(payload: dict[str, Any]) -> None:
        received.append(payload)

    asyncio.run(reg.register(ChartClient("c1", async_send)))
    asyncio.run(reg.subscribe("c1", "GC", [EventType.BAR_UPDATE]))

    delivered = asyncio.run(reg.broadcast(_bar_event()))

    assert delivered == 1
    assert len(received) == 1


@pytest.mark.unit
def test_broadcast_drops_async_client_that_exceeds_send_timeout():
    closer = CloseRecorder()

    async def slow_send(_payload: dict[str, Any]) -> None:
        await asyncio.sleep(60)

    reg = WebSocketRegistry(send_timeout_s=0.001)
    asyncio.run(reg.register(ChartClient("slow", slow_send, closer)))
    asyncio.run(reg.subscribe("slow", "GC", [EventType.BAR_UPDATE]))

    delivered = asyncio.run(reg.broadcast(_bar_event()))

    assert delivered == 0
    assert "slow" not in reg
    assert closer.closed == 1


@pytest.mark.unit
def test_broadcast_all_clients_failing_removes_all():
    reg = WebSocketRegistry()
    asyncio.run(reg.register(ChartClient("a", FailingTransport())))
    asyncio.run(reg.register(ChartClient("b", FailingTransport())))
    for cid in ("a", "b"):
        asyncio.run(reg.subscribe(cid, "GC", [EventType.BAR_UPDATE]))

    delivered = asyncio.run(reg.broadcast(_bar_event()))

    assert delivered == 0
    assert reg.client_count == 0


# --- heartbeat ping (Req 6.1) -------------------------------------------------


@pytest.mark.unit
def test_heartbeat_tick_pings_every_client():
    reg = WebSocketRegistry()
    t1, t2 = FakeTransport(), FakeTransport()
    asyncio.run(reg.register(ChartClient("c1", t1)))
    asyncio.run(reg.register(ChartClient("c2", t2)))

    asyncio.run(reg.heartbeat_tick(now=0.0))

    assert len(t1.sent) == 1
    assert len(t2.sent) == 1
    assert t1.sent[0]["type"] == "ping"
    assert t2.sent[0]["type"] == "ping"


@pytest.mark.unit
def test_heartbeat_default_interval_and_timeout_from_settings():
    # Defaults come from settings: ping 30s, pong timeout 60s.
    reg = WebSocketRegistry()
    assert reg.ping_interval_s == 30.0
    assert reg.pong_timeout_s == 60.0


# --- heartbeat stale-pong drop (Req 6.3) --------------------------------------


@pytest.mark.unit
def test_heartbeat_drops_client_with_stale_pong():
    # A client whose last pong is older than the pong timeout is closed/removed.
    clock = ManualClock(0.0)
    reg = WebSocketRegistry(pong_timeout_s=60.0, clock=clock)
    closer = CloseRecorder()
    asyncio.run(reg.register(ChartClient("stale", FakeTransport(), closer)))

    # Advance past the pong timeout without any pong, then tick.
    asyncio.run(reg.heartbeat_tick(now=61.0))

    assert "stale" not in reg
    assert closer.closed == 1


@pytest.mark.unit
def test_heartbeat_keeps_client_within_timeout():
    clock = ManualClock(0.0)
    reg = WebSocketRegistry(pong_timeout_s=60.0, clock=clock)
    t = FakeTransport()
    asyncio.run(reg.register(ChartClient("fresh", t)))

    # Exactly at the timeout boundary (not strictly greater) -> kept and pinged.
    asyncio.run(reg.heartbeat_tick(now=60.0))

    assert "fresh" in reg
    assert t.sent[-1]["type"] == "ping"


@pytest.mark.unit
def test_note_pong_keeps_client_alive():
    clock = ManualClock(0.0)
    reg = WebSocketRegistry(pong_timeout_s=60.0, clock=clock)
    asyncio.run(reg.register(ChartClient("c1", FakeTransport())))

    # A pong arrives at t=50s; at t=100s the client is still within 60s of it.
    clock.now = 50.0
    reg.note_pong("c1")
    asyncio.run(reg.heartbeat_tick(now=100.0))

    assert "c1" in reg


@pytest.mark.unit
def test_note_pong_unknown_client_is_noop():
    reg = WebSocketRegistry()
    # Must not raise and must not create phantom state.
    reg.note_pong("ghost")
    assert "ghost" not in reg


@pytest.mark.unit
def test_heartbeat_drops_only_stale_clients():
    clock = ManualClock(0.0)
    reg = WebSocketRegistry(pong_timeout_s=60.0, clock=clock)
    fresh_t, stale_t = FakeTransport(), FakeTransport()
    asyncio.run(reg.register(ChartClient("fresh", fresh_t)))
    asyncio.run(reg.register(ChartClient("stale", stale_t)))

    # "fresh" pongs at t=70s; "stale" never pongs after registration at t=0.
    clock.now = 70.0
    reg.note_pong("fresh")
    asyncio.run(reg.heartbeat_tick(now=80.0))

    assert "fresh" in reg
    assert "stale" not in reg
    # The survivor still gets pinged this tick.
    assert fresh_t.sent[-1]["type"] == "ping"


# --- heartbeat_loop drives ticks via injectable sleep -------------------------


@pytest.mark.unit
def test_heartbeat_loop_pings_each_interval():
    # Drive a few iterations through a fake sleep, then cancel cleanly.
    reg = WebSocketRegistry(ping_interval_s=30.0, sleep=_counting_sleep(limit=3))
    t = FakeTransport()
    asyncio.run(reg.register(ChartClient("c1", t)))

    asyncio.run(_run_until_stop(reg.heartbeat_loop()))

    # One ping per interval slept (3 iterations before the sleep stops the loop).
    assert len(t.sent) == 3
    assert all(p["type"] == "ping" for p in t.sent)


def _counting_sleep(limit: int):
    """A fake ``sleep`` that returns immediately ``limit`` times, then stops.

    Raises ``_StopLoop`` after ``limit`` sleeps so the otherwise-infinite
    ``heartbeat_loop`` terminates deterministically without real waiting.
    """

    state = {"n": 0}

    async def sleep(_delay: float) -> None:
        if state["n"] >= limit:
            raise _StopLoop
        state["n"] += 1

    return sleep


class _StopLoop(Exception):
    """Sentinel used to break the heartbeat loop in tests."""


async def _run_until_stop(coro) -> None:
    try:
        await coro
    except _StopLoop:
        return
