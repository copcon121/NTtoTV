"""Unit tests for the WebSocket_Registry throttled coalescing flush loop (8.3).

Example-based coverage of:

* coalescing queued outbound events by ``(type, symbol, key)`` so only the
  latest state per key is emitted (Req 5.3);
* per-type coalescing sub-key extraction (:func:`coalescing_subkey`);
* flush delivering each coalesced event only to clients whose subscriptions
  ``want`` it (Req 5.2, 5.4, 5.5);
* the flush loop running on an **injectable clock/sleep** at a jittered
  100-125ms cadence so tests never sleep in real time (Req 5.3).

The registry is exercised with injected fakes (a fake transport, a fake clock,
and a fake ``sleep``); no real WebSocket or wall-clock delay is involved. Async
coroutines are driven with ``asyncio.run``.
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from app.models.canonical import Side
from app.models.messages import (
    BarUpdate,
    BigTrade,
    EventType,
    OHLCVBar,
    Ping,
    QuoteUpdate,
)
from app.registry import (
    ChartClient,
    OutboundEvent,
    WebSocketRegistry,
    coalescing_subkey,
)


class FakeTransport:
    """Records payloads handed to a client's ``send`` callable."""

    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []

    def __call__(self, payload: dict[str, Any]) -> None:
        self.sent.append(payload)


class FakeClock:
    """A manually advanced monotonic clock (seconds)."""

    def __init__(self, start: float = 0.0) -> None:
        self.now = start

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


def _bar(symbol: str, tf: str, bar_time: int, close: float) -> BarUpdate:
    return BarUpdate(
        symbol=symbol,
        contract="GC 08-26",
        tf=tf,
        bar=OHLCVBar(time=bar_time, open=1.0, high=2.0, low=0.5, close=close, volume=10),
        closed=False,
    )


def _make_client(reg: WebSocketRegistry, client_id: str) -> FakeTransport:
    transport = FakeTransport()
    asyncio.run(reg.register(ChartClient(client_id, transport)))
    return transport


# --- coalescing sub-key extraction --------------------------------------------


@pytest.mark.unit
def test_coalescing_subkey_per_event_type():
    bar = _bar("GC", "1m", 1_000, 100.0).to_dict()
    assert coalescing_subkey(bar) == ("bar_update", "1m", 1_000)

    quote = QuoteUpdate(
        symbol="GC", contract="GC 08-26", time=5, bid=1.0, ask=2.0,
        bid_size=3, ask_size=4,
    ).to_dict()
    assert coalescing_subkey(quote) == ("quote_update", "GC 08-26")

    big = BigTrade(
        symbol="GC", contract="GC 08-26", trade_id=3, time=9, price=2345.6, volume=65,
        side=Side.BUY,
    ).to_dict()
    assert coalescing_subkey(big) == ("big_trade", 3, 9, 2345.6, "buy")


@pytest.mark.unit
def test_coalescing_subkey_unknown_type_falls_back_to_none():
    assert coalescing_subkey({"type": "totally_unknown"}) is None


# --- enqueue coalescing (Req 5.3) ---------------------------------------------


@pytest.mark.unit
def test_enqueue_coalesces_same_key_to_latest_state():
    reg = WebSocketRegistry()

    reg.enqueue(OutboundEvent.from_message(_bar("GC", "1m", 1_000, 100.0)))
    reg.enqueue(OutboundEvent.from_message(_bar("GC", "1m", 1_000, 101.0)))
    reg.enqueue(OutboundEvent.from_message(_bar("GC", "1m", 1_000, 102.0)))

    # Three updates to the same (type, symbol, tf, bar time) collapse to one.
    assert reg.pending_count == 1


@pytest.mark.unit
def test_enqueue_keeps_distinct_keys_separate():
    reg = WebSocketRegistry()

    reg.enqueue(OutboundEvent.from_message(_bar("GC", "1m", 1_000, 100.0)))
    reg.enqueue(OutboundEvent.from_message(_bar("GC", "1m", 2_000, 100.0)))  # other bar
    reg.enqueue(OutboundEvent.from_message(_bar("GC", "5m", 1_000, 100.0)))  # other tf
    reg.enqueue(OutboundEvent.from_message(_bar("SI", "1m", 1_000, 100.0)))  # other symbol

    assert reg.pending_count == 4


@pytest.mark.unit
def test_flush_emits_latest_state_per_key():
    reg = WebSocketRegistry()
    transport = _make_client(reg, "c1")
    asyncio.run(reg.subscribe("c1", "GC", [EventType.BAR_UPDATE]))

    reg.enqueue(OutboundEvent.from_message(_bar("GC", "1m", 1_000, 100.0)))
    reg.enqueue(OutboundEvent.from_message(_bar("GC", "1m", 1_000, 999.0)))

    delivered = asyncio.run(reg.flush())

    assert delivered == 1
    assert len(transport.sent) == 1
    assert transport.sent[0]["bar"]["close"] == 999.0  # latest state wins


@pytest.mark.unit
def test_flush_preserves_first_seen_order_across_coalescing():
    reg = WebSocketRegistry()
    transport = _make_client(reg, "c1")
    asyncio.run(reg.subscribe("c1", "GC", [EventType.BAR_UPDATE]))

    reg.enqueue(OutboundEvent.from_message(_bar("GC", "1m", 1_000, 1.0)))
    reg.enqueue(OutboundEvent.from_message(_bar("GC", "1m", 2_000, 2.0)))
    # Coalesce the first slot; it must keep its original (first) position.
    reg.enqueue(OutboundEvent.from_message(_bar("GC", "1m", 1_000, 1.5)))

    asyncio.run(reg.flush())

    times = [m["bar"]["time"] for m in transport.sent]
    assert times == [1_000, 2_000]
    assert transport.sent[0]["bar"]["close"] == 1.5


@pytest.mark.unit
def test_flush_clears_pending():
    reg = WebSocketRegistry()
    _make_client(reg, "c1")
    asyncio.run(reg.subscribe("c1", "GC", [EventType.BAR_UPDATE]))

    reg.enqueue(OutboundEvent.from_message(_bar("GC", "1m", 1_000, 1.0)))
    asyncio.run(reg.flush())

    assert reg.pending_count == 0
    # A second flush with nothing pending is a no-op.
    assert asyncio.run(reg.flush()) == 0


# --- recipient selection via wants (Req 5.2, 5.4, 5.5) ------------------------


@pytest.mark.unit
def test_flush_delivers_only_to_subscribed_clients():
    reg = WebSocketRegistry()
    sub = _make_client(reg, "subscribed")
    unsub = _make_client(reg, "unsubscribed")
    other_sym = _make_client(reg, "other_symbol")

    asyncio.run(reg.subscribe("subscribed", "GC", [EventType.BAR_UPDATE]))
    asyncio.run(reg.subscribe("unsubscribed", "GC", [EventType.QUOTE_UPDATE]))
    asyncio.run(reg.subscribe("other_symbol", "SI", [EventType.BAR_UPDATE]))

    reg.enqueue(OutboundEvent.from_message(_bar("GC", "1m", 1_000, 1.0)))
    asyncio.run(reg.flush())

    assert len(sub.sent) == 1
    assert unsub.sent == []  # wrong event type
    assert other_sym.sent == []  # wrong symbol


@pytest.mark.unit
def test_flush_delivers_only_selected_timeframe():
    reg = WebSocketRegistry()
    transport = _make_client(reg, "c1")
    asyncio.run(
        reg.subscribe("c1", "GC", [EventType.BAR_UPDATE], timeframe="1m")
    )

    reg.enqueue(OutboundEvent.from_message(_bar("GC", "1m", 1_000, 1.0)))
    reg.enqueue(OutboundEvent.from_message(_bar("GC", "5m", 1_000, 1.0)))
    delivered = asyncio.run(reg.flush())

    assert delivered == 1
    assert [payload["tf"] for payload in transport.sent] == ["1m"]


@pytest.mark.unit
def test_flush_fans_out_to_all_subscribers():
    reg = WebSocketRegistry()
    a = _make_client(reg, "a")
    b = _make_client(reg, "b")
    asyncio.run(reg.subscribe("a", "GC", [EventType.BAR_UPDATE]))
    asyncio.run(reg.subscribe("b", "GC", [EventType.BAR_UPDATE]))

    reg.enqueue(OutboundEvent.from_message(_bar("GC", "1m", 1_000, 1.0)))
    delivered = asyncio.run(reg.flush())

    assert delivered == 2
    assert len(a.sent) == 1
    assert len(b.sent) == 1


@pytest.mark.unit
def test_flush_isolates_dead_client_and_keeps_loop_healthy():
    class FailingTransport:
        def __init__(self) -> None:
            self.calls = 0

        def __call__(self, payload: dict[str, Any]) -> None:
            self.calls += 1
            raise ConnectionResetError("client socket is dead")

    reg = WebSocketRegistry()
    healthy = _make_client(reg, "healthy")
    failing = FailingTransport()
    asyncio.run(reg.register(ChartClient("dead", failing)))
    asyncio.run(reg.subscribe("healthy", "GC", [EventType.BAR_UPDATE]))
    asyncio.run(reg.subscribe("dead", "GC", [EventType.BAR_UPDATE]))

    reg.enqueue(OutboundEvent.from_message(_bar("GC", "1m", 1_000, 1.0)))
    delivered = asyncio.run(reg.flush())

    assert delivered == 1
    assert len(healthy.sent) == 1
    assert failing.calls == 1
    assert "dead" not in reg
    assert reg.pending_count == 0

    # A later flush still reaches the surviving client; the previous send
    # failure did not kill the flush path.
    reg.enqueue(OutboundEvent.from_message(_bar("GC", "1m", 2_000, 2.0)))
    delivered2 = asyncio.run(reg.flush())
    assert delivered2 == 1
    assert [m["bar"]["time"] for m in healthy.sent] == [1_000, 2_000]


# --- from_message symbol handling ---------------------------------------------


@pytest.mark.unit
def test_from_message_requires_symbol_for_symbolless_messages():
    # ping has no symbol; without an explicit symbol= it must raise.
    with pytest.raises(ValueError):
        OutboundEvent.from_message(Ping(time=1))

    event = OutboundEvent.from_message(Ping(time=1), symbol="GC")
    assert event.symbol == "GC"
    assert event.event_type == EventType.PING


# --- flush_loop on an injectable clock (Req 5.3) ------------------------------


@pytest.mark.unit
def test_flush_loop_uses_injected_sleep_within_interval_bounds():
    sleeps: list[float] = []

    async def fake_sleep(delay: float) -> None:
        sleeps.append(delay)

    clock = FakeClock()
    reg = WebSocketRegistry(clock=clock, sleep=fake_sleep)
    transport = _make_client(reg, "c1")
    asyncio.run(reg.subscribe("c1", "GC", [EventType.BAR_UPDATE]))

    reg.enqueue(OutboundEvent.from_message(_bar("GC", "1m", 1_000, 1.0)))
    asyncio.run(reg.flush_loop(max_iterations=1))

    # Default midpoint jitter -> 112.5ms; always within [100ms, 125ms].
    assert len(sleeps) == 1
    assert 0.100 <= sleeps[0] <= 0.125
    assert len(transport.sent) == 1


@pytest.mark.unit
def test_flush_loop_respects_jitter_bounds_at_extremes():
    sleeps: list[float] = []

    async def fake_sleep(delay: float) -> None:
        sleeps.append(delay)

    # rng pinned to 0.0 -> min bound; then 1.0 -> max bound.
    rng_values = iter([0.0, 1.0])
    reg = WebSocketRegistry(
        clock=FakeClock(),
        sleep=fake_sleep,
        rng=lambda: next(rng_values),
    )
    asyncio.run(reg.flush_loop(max_iterations=2))

    assert sleeps[0] == pytest.approx(0.100)
    assert sleeps[1] == pytest.approx(0.125)


@pytest.mark.unit
def test_flush_loop_advances_clock_and_records_last_flush():
    clock = FakeClock(start=1000.0)

    async def fake_sleep(delay: float) -> None:
        clock.advance(delay)  # simulate time passing during the sleep

    reg = WebSocketRegistry(clock=clock, sleep=fake_sleep)
    transport = _make_client(reg, "c1")
    asyncio.run(reg.subscribe("c1", "GC", [EventType.BAR_UPDATE]))

    # Enqueue + coalesce across the loop: only the latest state per key flushes.
    reg.enqueue(OutboundEvent.from_message(_bar("GC", "1m", 1_000, 1.0)))
    reg.enqueue(OutboundEvent.from_message(_bar("GC", "1m", 1_000, 5.0)))
    asyncio.run(reg.flush_loop(max_iterations=3))

    # Exactly one coalesced delivery happened (on the first iteration); later
    # iterations had nothing pending.
    assert len(transport.sent) == 1
    assert transport.sent[0]["bar"]["close"] == 5.0
    assert reg.last_flush_at is not None
    assert reg.last_flush_at >= 1000.0


@pytest.mark.unit
def test_flush_loop_supports_async_transport():
    class AsyncTransport:
        def __init__(self) -> None:
            self.sent: list[dict[str, Any]] = []

        async def __call__(self, payload: dict[str, Any]) -> None:
            self.sent.append(payload)

    async def fake_sleep(delay: float) -> None:
        return None

    reg = WebSocketRegistry(clock=FakeClock(), sleep=fake_sleep)
    transport = AsyncTransport()
    asyncio.run(reg.register(ChartClient("c1", transport)))
    asyncio.run(reg.subscribe("c1", "GC", [EventType.BAR_UPDATE]))

    reg.enqueue(OutboundEvent.from_message(_bar("GC", "1m", 1_000, 1.0)))
    asyncio.run(reg.flush_loop(max_iterations=1))

    assert len(transport.sent) == 1


@pytest.mark.unit
def test_invalid_interval_bounds_raise():
    with pytest.raises(ValueError):
        WebSocketRegistry(min_interval_ms=125.0, max_interval_ms=100.0)
    with pytest.raises(ValueError):
        WebSocketRegistry(min_interval_ms=0.0)
