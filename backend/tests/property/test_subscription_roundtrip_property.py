"""Property test for subscription round-trip routing (task 8.2, design Property 8).

Property 8 asserts that for *any* set of clients with arbitrary subscription
sets and *any* stream of outbound events, each client receives exactly the
events whose ``(type, symbol)`` it is currently subscribed to; after a client
unsubscribes from a type it receives no further events of that type, and
re-subscribing restores delivery.

The test is model-based. It generates a fixed pool of registered clients and an
arbitrary interleaved sequence of operations:

* ``subscribe(client, symbol, event_types)`` — additive per symbol (Req 5.4);
* ``unsubscribe(client, event_types)`` — symbol-agnostic removal, matching the
  :class:`~app.registry.WebSocketRegistry` implementation and Req 5.5;
* ``broadcast(symbol, event_type)`` — emits one outbound event.

An in-memory oracle mirrors each client's ``symbol -> {event_types}`` state. On
every broadcast the test asserts each client received the event **iff** the
oracle says it currently wants that ``(symbol, event_type)``, so unsubscribe
(stop) and re-subscribe (restore) are exercised across the whole stream.

Uses the design-mandated Hypothesis ``gc`` profile (>= 100 examples).

**Validates: Requirements 5.1, 5.4, 5.5**
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.models.messages import EventType
from app.registry import ChartClient, OutboundEvent, WebSocketRegistry

# Small pools so independently-generated subscribe/unsubscribe/broadcast ops
# collide on the same (client, symbol, event_type) often, genuinely exercising
# stop/restore rather than always-disjoint sets.
_SYMBOLS = ("GC", "SI", "CL")
_EVENT_TYPES = (
    EventType.BAR_UPDATE,
    EventType.QUOTE_UPDATE,
    EventType.VOLUME_DELTA_UPDATE,
    EventType.FOOTPRINT_UPDATE,
    EventType.BIG_TRADE,
    EventType.ALERT_EVENT,
    EventType.STATUS,
)


class FakeTransport:
    """Records every payload handed to a client's ``send`` callable."""

    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []

    def __call__(self, payload: dict[str, Any]) -> None:
        self.sent.append(payload)


_event_type_list = st.lists(
    st.sampled_from(_EVENT_TYPES), min_size=1, max_size=len(_EVENT_TYPES), unique=True
).map(tuple)


@st.composite
def scenarios(draw: st.DrawFn):
    """Generate (n_clients, ops) with ops referencing valid client indices."""
    n_clients = draw(st.integers(min_value=1, max_value=4))

    subscribe_op = st.tuples(
        st.just("sub"),
        st.integers(min_value=0, max_value=n_clients - 1),
        st.sampled_from(_SYMBOLS),
        _event_type_list,
    )
    unsubscribe_op = st.tuples(
        st.just("unsub"),
        st.integers(min_value=0, max_value=n_clients - 1),
        _event_type_list,
    )
    broadcast_op = st.tuples(
        st.just("bcast"),
        st.sampled_from(_SYMBOLS),
        st.sampled_from(_EVENT_TYPES),
    )
    ops = draw(
        st.lists(
            st.one_of(subscribe_op, unsubscribe_op, broadcast_op),
            min_size=1,
            max_size=40,
        )
    )
    return n_clients, ops


def _make_event(symbol: str, event_type: EventType, nonce: int) -> OutboundEvent:
    """A routable outbound event; payload content is irrelevant to routing."""
    return OutboundEvent(
        event_type=event_type,
        symbol=symbol,
        payload={"type": event_type.value, "symbol": symbol, "n": nonce},
        key=nonce,
    )


# Feature: gc-chart-platform, Property 8: Clients receive only their subscribed event types (subscribe/unsubscribe round-trip)
@pytest.mark.property
@given(scenario=scenarios())
def test_property_8_subscription_round_trip(scenario) -> None:
    n_clients, ops = scenario
    reg = WebSocketRegistry()
    client_ids = [f"c{i}" for i in range(n_clients)]
    transports: dict[str, FakeTransport] = {}

    # Oracle: client_id -> {symbol -> set of subscribed event types}, mirroring
    # the registry's additive subscribe and symbol-agnostic unsubscribe.
    model: dict[str, dict[str, set[EventType]]] = {cid: {} for cid in client_ids}

    async def run() -> None:
        for cid in client_ids:
            t = FakeTransport()
            transports[cid] = t
            await reg.register(ChartClient(cid, t))

        nonce = 0
        for op in ops:
            kind = op[0]
            if kind == "sub":
                _, idx, symbol, events = op
                cid = client_ids[idx]
                await reg.subscribe(cid, symbol, events)
                model[cid].setdefault(symbol, set()).update(events)
            elif kind == "unsub":
                _, idx, events = op
                cid = client_ids[idx]
                await reg.unsubscribe(cid, events)
                # Symbol-agnostic removal across all symbols (Req 5.5).
                for symbol in list(model[cid]):
                    model[cid][symbol] -= set(events)
                    if not model[cid][symbol]:
                        del model[cid][symbol]
            else:  # "bcast"
                _, symbol, event_type = op
                before = {cid: len(transports[cid].sent) for cid in client_ids}
                nonce += 1
                delivered = await reg.broadcast(
                    _make_event(symbol, event_type, nonce)
                )

                expected_recipients = 0
                for cid in client_ids:
                    wants = event_type in model[cid].get(symbol, set())
                    got = len(transports[cid].sent) - before[cid]
                    # Each client receives the event iff it currently subscribes
                    # to that (symbol, event_type) -- exactly once if so.
                    assert got == (1 if wants else 0)
                    if wants:
                        expected_recipients += 1
                        assert transports[cid].sent[-1]["n"] == nonce
                # broadcast reports exactly the number of subscribed recipients.
                assert delivered == expected_recipients

    asyncio.run(run())
