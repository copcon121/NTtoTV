"""Property test for throttled coalescing flush (task 8.4, design Property 9).

Property 9 asserts that for *any* inbound event rate driven against a virtual
clock, the spacing between consecutive flushes stays within the closed interval
``[100ms, 125ms]`` whenever work is pending, and multiple updates sharing the
same coalescing key ``(type, symbol, key)`` within one interval collapse into a
single emitted update carrying the **latest** state.

The test drives :meth:`~app.registry.WebSocketRegistry.flush_loop` against an
**injectable clock/sleep** so no real time elapses:

* ``sleep`` records every delay the loop waits and advances a fake clock by that
  amount, so the recorded delays *are* the inter-flush spacing. Each must lie in
  ``[0.100s, 0.125s]`` (Req 5.3, 14.8).
* ``rng`` is fed arbitrary fractions in ``[0, 1]`` so the jittered interval is
  exercised across its whole range, including the bounds.

Coalescing is exercised by enqueuing an arbitrary sequence of events drawn from
a small key pool (so collisions are frequent): the first flush must deliver
exactly one payload per distinct coalescing key, each carrying the latest state
enqueued for that key (an in-memory oracle of last-write-per-key).

Uses the design-mandated Hypothesis ``gc`` profile (>= 100 examples).

**Validates: Requirements 5.3, 14.8**
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.models.messages import EventType
from app.registry import ChartClient, OutboundEvent, WebSocketRegistry

_MIN_INTERVAL_S = 0.100
_MAX_INTERVAL_S = 0.125

# Small pools so independently-generated events collide on the same coalescing
# key, making latest-state-wins coalescing the property under test.
_SYMBOLS = ("GC", "SI")
_EVENT_TYPES = (
    EventType.BAR_UPDATE,
    EventType.VOLUME_DELTA_UPDATE,
    EventType.FOOTPRINT_UPDATE,
)
_KEYS = (0, 1, 2)


class FakeTransport:
    """Records every payload handed to a client's ``send`` callable."""

    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []

    def __call__(self, payload: dict[str, Any]) -> None:
        self.sent.append(payload)


class FakeClock:
    """A manually advanced monotonic clock (seconds)."""

    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


# (symbol, event_type, key, state) — state is the per-key payload value whose
# latest occurrence must survive coalescing.
_event = st.tuples(
    st.sampled_from(_SYMBOLS),
    st.sampled_from(_EVENT_TYPES),
    st.sampled_from(_KEYS),
    st.integers(min_value=0, max_value=10_000),
)


# Feature: gc-chart-platform, Property 9: UI streaming and footprint redraws are throttled within 100-125ms with coalescing
@pytest.mark.property
@given(
    events=st.lists(_event, min_size=1, max_size=40),
    fractions=st.lists(
        st.floats(min_value=0.0, max_value=1.0, allow_nan=False),
        min_size=1,
        max_size=8,
    ),
)
def test_property_9_throttle_and_coalesce(events, fractions) -> None:
    sleeps: list[float] = []
    clock = FakeClock()
    rng_iter = iter(fractions)

    async def fake_sleep(delay: float) -> None:
        sleeps.append(delay)
        clock.advance(delay)  # the slept time is the inter-flush spacing

    def rng() -> float:
        # The loop pulls one fraction per iteration; never exhausted because the
        # loop runs exactly len(fractions) iterations.
        return next(rng_iter)

    reg = WebSocketRegistry(clock=clock, sleep=fake_sleep, rng=rng)
    transport = FakeTransport()

    # A single client subscribed to every (symbol, event_type) used, so it is a
    # recipient for every coalesced key.
    used_types = sorted({et for _s, et, _k, _v in events}, key=lambda e: e.value)

    async def run() -> None:
        await reg.register(ChartClient("c1", transport))
        for symbol in _SYMBOLS:
            await reg.subscribe("c1", symbol, used_types)

        # Oracle: latest state per distinct coalescing key (type, symbol, key).
        # The coalescing key is embedded in the payload so each delivered event
        # can be matched back to its slot precisely.
        latest: dict[tuple[str, str, int], int] = {}
        for symbol, event_type, key, state in events:
            payload = {
                "type": event_type.value,
                "symbol": symbol,
                "key": key,
                "state": state,
            }
            reg.enqueue(
                OutboundEvent(
                    event_type=event_type, symbol=symbol, payload=payload, key=key
                )
            )
            latest[(event_type.value, symbol, key)] = state

        # Run one loop iteration per supplied jitter fraction.
        await reg.flush_loop(max_iterations=len(fractions))

        # (a) Throttling: every flush waited a jittered interval within bounds.
        assert len(sleeps) == len(fractions)
        for delay in sleeps:
            assert _MIN_INTERVAL_S <= delay <= _MAX_INTERVAL_S

        # (b) Coalescing: the first flush emitted exactly one payload per
        # distinct key, each carrying the latest enqueued state for that key.
        assert len(transport.sent) == len(latest)
        received: dict[tuple[str, str, int], int] = {}
        for payload in transport.sent:
            slot = (payload["type"], payload["symbol"], payload["key"])
            # No key is delivered twice within one flush.
            assert slot not in received
            received[slot] = payload["state"]
        assert received == latest

    asyncio.run(run())
