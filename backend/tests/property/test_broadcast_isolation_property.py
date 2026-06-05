"""Property test for per-client broadcast isolation (task 8.6, design Property 10).

Property 10 asserts that for *any* set of connected clients in which an arbitrary
subset raises an exception on send, every healthy client still receives the
event, every failing client is removed from the registry, and no exception
propagates out of the broadcast.

The test generates a fixed pool of clients, each flagged healthy or failing, all
subscribed to the broadcast event. It then broadcasts one event through
:meth:`~app.registry.WebSocketRegistry.broadcast` and asserts:

* the call returns normally (no exception escapes — Req 6.4);
* every healthy subscribed client received the payload exactly once;
* every failing client was removed from the registry and had its close hook
  invoked;
* the return value equals the number of healthy recipients; and
* a follow-up broadcast reaches exactly the surviving healthy clients (the dead
  ones stay removed).

Uses the design-mandated Hypothesis ``gc`` profile (>= 100 examples).

**Validates: Requirements 6.4**
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.models.messages import EventType
from app.registry import ChartClient, OutboundEvent, WebSocketRegistry

_SYMBOL = "GC"
_EVENT_TYPE = EventType.BAR_UPDATE


class HealthyTransport:
    """A send callable that records payloads (a live connection)."""

    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []

    def __call__(self, payload: dict[str, Any]) -> None:
        self.sent.append(payload)


class FailingTransport:
    """A send callable that always raises (a dead connection)."""

    def __init__(self) -> None:
        self.calls = 0

    def __call__(self, payload: dict[str, Any]) -> None:
        self.calls += 1
        raise ConnectionResetError("client socket is dead")


class CloseRecorder:
    """Records how many times a client's close hook was invoked."""

    def __init__(self) -> None:
        self.closed = 0

    def __call__(self) -> None:
        self.closed += 1


def _event(nonce: int) -> OutboundEvent:
    return OutboundEvent(
        event_type=_EVENT_TYPE,
        symbol=_SYMBOL,
        payload={"type": _EVENT_TYPE.value, "symbol": _SYMBOL, "n": nonce},
        key=nonce,
    )


# Feature: gc-chart-platform, Property 10: Broadcast failures are isolated per client
@pytest.mark.property
@given(
    health=st.lists(st.booleans(), min_size=1, max_size=8),
    subscribe_all=st.booleans(),
)
def test_property_10_broadcast_failures_are_isolated(health, subscribe_all) -> None:
    reg = WebSocketRegistry()
    healthy_transports: dict[str, HealthyTransport] = {}
    failing_transports: dict[str, FailingTransport] = {}
    closers: dict[str, CloseRecorder] = {}

    async def run() -> None:
        # Build the client pool: each index is healthy (True) or failing (False).
        for i, ok in enumerate(health):
            cid = f"c{i}"
            closer = CloseRecorder()
            closers[cid] = closer
            if ok:
                t = HealthyTransport()
                healthy_transports[cid] = t
                await reg.register(ChartClient(cid, t, closer))
            else:
                t = FailingTransport()
                failing_transports[cid] = t
                await reg.register(ChartClient(cid, t, closer))
            await reg.subscribe(cid, _SYMBOL, [_EVENT_TYPE])

        # One broadcast against the mixed pool. It must return normally; any
        # send exception is caught and isolated per client (Req 6.4).
        delivered = await reg.broadcast(_event(1))

        # Every healthy client received the event exactly once.
        for cid, t in healthy_transports.items():
            assert len(t.sent) == 1
            assert t.sent[0]["n"] == 1
            assert cid in reg  # healthy clients are retained

        # Every failing client was removed and closed; its send was attempted.
        for cid, t in failing_transports.items():
            assert t.calls == 1
            assert cid not in reg  # the dead connection was removed
            assert closers[cid].closed == 1

        # The return value equals the number of healthy recipients.
        assert delivered == len(healthy_transports)
        assert reg.client_count == len(healthy_transports)

        # A second broadcast reaches exactly the survivors; the removed clients
        # stay removed and never receive further events.
        delivered2 = await reg.broadcast(_event(2))
        assert delivered2 == len(healthy_transports)
        for t in healthy_transports.values():
            assert [p["n"] for p in t.sent] == [1, 2]

    asyncio.run(run())
