"""WebSocket_Registry core: client registration + subscription management.

This module implements the registration and per-client subscription-tracking
core of the WebSocket_Registry (task 8.1). A :class:`ChartClient` models one
connected ``/ws/chart`` Frontend client (an id, an injectable send callable,
and its per-``(symbol, event_types)`` subscription state). A
:class:`WebSocketRegistry` holds the connected clients and applies
subscribe/unsubscribe requests against each client's subscription state.

Scope of this module (task 8.1):

* register a connected client and stream subscribed events to it (Req 5.1)
* track per-client subscriptions keyed by ``(symbol, event_types)``
* ``subscribe`` adds requested event types for a symbol (Req 5.4)
* ``unsubscribe`` removes event types so they stop being sent (Req 5.5)

Added by task 8.3 (this module): the throttled **coalescing flush loop**.
:class:`OutboundEvent` is the envelope queued for streaming; ``enqueue``
coalesces queued events by ``(type, symbol, key)`` (keeping only the latest
state per key), and ``flush``/``flush_loop`` drain the pending batch every
100-125ms against an **injectable clock/sleep** so tests never sleep in real
time. On flush each coalesced event is delivered to the clients whose
subscriptions ``want`` it (via the existing :meth:`ChartClient.wants`).

Intentionally **out of scope** here and integrated by a later task (left as a
clear seam): heartbeat (ping every 30s, drop after 60s with no pong) and
per-client broadcast **isolation** (``broadcast`` with per-client try/except)
-- task 8.5. The flush loop delivers via the private :meth:`_dispatch` seam so
task 8.5 can route delivery through an isolating ``broadcast`` without changing
the coalescing core. The client's transport is an injected ``send`` callable
rather than a live ``WebSocket``, so the registry is fully exercisable with a
fake transport / no real socket. (Requirements 5.1, 5.2, 5.3, 5.4, 5.5)
"""

from __future__ import annotations

import asyncio
import inspect
import logging
import time
from collections.abc import Hashable
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Iterable, Mapping

from ..config import settings
from ..models.messages import (
    AlertEvent,
    BarUpdate,
    BigTrade,
    ChartStatusEvent,
    EventType,
    FootprintUpdate,
    Ping,
    QuoteUpdate,
    VolumeDeltaUpdate,
)
from ..models.timestamp import now_ms

logger = logging.getLogger(__name__)

__all__ = [
    "SendCallable",
    "CloseCallable",
    "ChartClient",
    "OutboundEvent",
    "WebSocketRegistry",
    "coalescing_subkey",
]

# Sentinel marking "derive this field from the message" in
# :meth:`OutboundEvent.from_message`; distinct from a caller passing ``None``.
_DERIVE: Any = object()

# A client's transport. Injected so the registry needs no live WebSocket; a
# fake (e.g. ``list.append`` wrapped to accept a dict) suffices for tests. The
# callable may be synchronous or asynchronous; the broadcast path (task 8.5)
# awaits awaitable results.
SendCallable = Callable[[dict[str, Any]], Awaitable[None] | None]

# A client's connection-close hook. Optional; injected so the heartbeat path
# (task 8.5) can close the underlying ``/ws/chart`` socket when a client is
# dropped for failing to pong within the timeout (Req 6.3) -- without the
# registry depending on a live WebSocket. May be synchronous or asynchronous;
# awaitable results are awaited. A fake recorder suffices for tests.
CloseCallable = Callable[[], Awaitable[None] | None]


def _coerce_event_types(event_types: Iterable[EventType | str]) -> set[EventType]:
    """Normalize an iterable of event types into a ``set[EventType]``.

    Accepts both :class:`EventType` members and their wire string values (e.g.
    ``"bar_update"``) so callers may pass the design's ``list[str]`` shape or
    the decoded ``Subscribe.events`` (``list[EventType]``) interchangeably.
    Raises ``ValueError`` for an unknown event-type literal.
    """

    coerced: set[EventType] = set()
    for et in event_types:
        coerced.add(et if isinstance(et, EventType) else EventType(et))
    return coerced


# Typed Backend -> client messages the registry knows how to stream. Each
# exposes ``to_dict`` (wire shape) and a ``type`` discriminator.
OutboundMessage = (
    BarUpdate
    | QuoteUpdate
    | VolumeDeltaUpdate
    | FootprintUpdate
    | BigTrade
    | AlertEvent
    | ChartStatusEvent
    | Ping
)

_TIMEFRAME_SCOPED_EVENT_TYPES = frozenset(
    {
        EventType.BAR_UPDATE,
        EventType.VOLUME_DELTA_UPDATE,
        EventType.FOOTPRINT_UPDATE,
    }
)


def coalescing_subkey(payload: Mapping[str, Any]) -> Hashable:
    """Derive the per-type coalescing sub-key from a wire ``payload``.

    The full coalescing key is ``(type, symbol, sub-key)`` (see
    :attr:`OutboundEvent.coalescing_key`); this function computes the third
    component, which identifies *which state slot* an event updates so that
    successive updates to the same slot collapse to the newest. The extraction
    is defined per event type, cohesive with the design's
    ``coalesced by (type, symbol, key)``:

    * ``bar_update`` -> ``(tf, bar.time)`` -- successive updates of the same
      timeframe bar (same bar open time) collapse to the latest OHLCV state.
    * ``volume_delta_update`` -> ``(tf, time)`` -- latest delta state per bar.
    * ``footprint_update`` -> ``(tf, time)`` -- latest ladder/metrics per bar.
    * ``quote_update`` -> ``contract`` -- latest quote per contract (symbol is
      already in the outer key).
    * ``big_trade`` -> ``(tradeId, time, price, side)`` -- each distinct reconstructed
      trade is its own slot (big trades are discrete, not overwritten state).
    * ``alert_event`` -> ``(alertId, time)`` -- each distinct alert firing is
      its own slot.
    * ``status`` -> ``state`` -- only the latest status per state matters.
    * ``ping`` -> ``time`` -- heartbeat; latest pending ping wins.

    Unknown types fall back to ``None`` (coalesce to a single latest event for
    that ``(type, symbol)``), which is safe and never raises.
    """

    t = payload.get("type")
    if t == "bar_update":
        return ("bar_update", payload["tf"], payload["bar"]["time"])
    if t == "volume_delta_update":
        return ("volume_delta_update", payload["tf"], payload["time"])
    if t == "footprint_update":
        return ("footprint_update", payload["tf"], payload["time"])
    if t == "quote_update":
        return ("quote_update", payload["contract"])
    if t == "big_trade":
        return (
            "big_trade",
            payload.get("tradeId", 0),
            payload["time"],
            payload["price"],
            payload["side"],
        )
    if t == "alert_event":
        return ("alert_event", payload["alertId"], payload["time"])
    if t == "status":
        return ("status", payload["state"])
    if t == "ping":
        return ("ping",)
    return None


@dataclass(slots=True)
class OutboundEvent:
    """An outbound `/ws/chart` event queued for the coalescing flush. (Req 5.2)

    Wraps the wire ``payload`` (the dict produced by a message's ``to_dict``)
    together with the routing/coalescing facets the registry needs:

    * ``event_type`` and ``symbol`` select recipients via
      :meth:`ChartClient.wants` on flush.
    * ``key`` is the per-type coalescing sub-key (see
      :func:`coalescing_subkey`); together they form
      :attr:`coalescing_key` ``= (event_type, symbol, key)``. Enqueuing a new
      event with an existing :attr:`coalescing_key` overwrites the pending one
      so only the latest state per key is flushed. (Req 5.3)
    """

    event_type: EventType
    symbol: str
    payload: dict[str, Any]
    key: Hashable = None

    @property
    def coalescing_key(self) -> tuple[EventType, str, Hashable]:
        """The ``(type, symbol, key)`` slot this event coalesces into."""

        return (self.event_type, self.symbol, self.key)

    @classmethod
    def from_message(
        cls,
        message: OutboundMessage,
        *,
        symbol: str = _DERIVE,
        key: Hashable = _DERIVE,
    ) -> "OutboundEvent":
        """Build an :class:`OutboundEvent` from a typed Backend->client message.

        Serializes ``message`` to its wire ``payload`` and derives
        ``event_type`` from the ``type`` discriminator, ``symbol`` from the
        payload (override via ``symbol`` for messages without one, e.g.
        ``status``/``ping``), and the coalescing ``key`` via
        :func:`coalescing_subkey` (override via ``key``). Raises ``ValueError``
        when no symbol can be determined.
        """

        payload = message.to_dict()
        event_type = EventType(payload["type"])
        resolved_symbol = payload.get("symbol") if symbol is _DERIVE else symbol
        if resolved_symbol is None:
            raise ValueError(
                f"{payload['type']!r} message has no symbol; pass symbol= explicitly"
            )
        resolved_key = coalescing_subkey(payload) if key is _DERIVE else key
        return cls(
            event_type=event_type,
            symbol=resolved_symbol,
            payload=payload,
            key=resolved_key,
        )


class ChartClient:
    """A single connected ``/ws/chart`` Frontend client. (Req 5.1)

    Holds the client ``id``, the injected ``send`` transport callable, and the
    per-``(symbol, event_types)`` subscription state. Subscription state is a
    mapping of ``symbol -> set[EventType]``: each symbol a client subscribes to
    carries the set of event types it currently wants for that symbol.

    The ``send`` callable is not invoked by task 8.1 (registration +
    subscription only); it is used by the broadcast/flush path (tasks 8.3/8.5).
    The optional ``close`` hook lets the heartbeat path (task 8.5) close the
    underlying ``/ws/chart`` socket when this client is dropped for failing to
    pong within the timeout (Req 6.3); it defaults to ``None`` (no-op) so the
    registry remains exercisable with a fake transport and no live socket.
    """

    __slots__ = ("_id", "_send", "_close", "_subscriptions", "_timeframes")

    def __init__(
        self, client_id: str, send: SendCallable, close: CloseCallable | None = None
    ) -> None:
        self._id = client_id
        self._send = send
        self._close = close
        # symbol -> set of subscribed event types. A symbol key exists only
        # while the client has at least one subscribed event type for it.
        self._subscriptions: dict[str, set[EventType]] = {}
        # (symbol, timeframe-scoped event type) -> selected timeframes. ``None``
        # means wildcard for compatibility with clients that omit ``tf``.
        self._timeframes: dict[tuple[str, EventType], set[str] | None] = {}

    @property
    def id(self) -> str:
        """The client's unique identifier."""

        return self._id

    @property
    def send(self) -> SendCallable:
        """The injected transport callable (used by the broadcast path, 8.5)."""

        return self._send

    @property
    def close(self) -> CloseCallable | None:
        """Optional connection-close hook (used when dropped, task 8.5)."""

        return self._close

    @property
    def subscriptions(self) -> Mapping[str, frozenset[EventType]]:
        """Read-only snapshot of subscriptions as ``symbol -> event types``."""

        return {sym: frozenset(ets) for sym, ets in self._subscriptions.items()}

    def subscribe(
        self,
        symbol: str,
        event_types: Iterable[EventType | str],
        timeframe: str | None = None,
    ) -> None:
        """Add ``event_types`` to this client's subscriptions for ``symbol``.

        Idempotent: re-subscribing an already-subscribed event type is a no-op.
        An empty ``event_types`` does not create a symbol entry. (Req 5.4)
        """

        coerced = _coerce_event_types(event_types)
        if not coerced:
            return
        self._subscriptions.setdefault(symbol, set()).update(coerced)
        for event_type in coerced & _TIMEFRAME_SCOPED_EVENT_TYPES:
            key = (symbol, event_type)
            if timeframe is None:
                self._timeframes[key] = None
                continue
            tracked = self._timeframes.get(key)
            if tracked is not None:
                tracked.add(timeframe)
            elif key not in self._timeframes:
                self._timeframes[key] = {timeframe}

    def unsubscribe(
        self,
        event_types: Iterable[EventType | str],
        *,
        symbol: str | None = None,
        timeframe: str | None = None,
    ) -> None:
        """Remove ``event_types`` from this client across all symbols. (Req 5.5)

        Matches Requirement 5.5's symbol-agnostic phrasing ("stop sending the
        unsubscribed event types to that client") and the design's
        ``unsubscribe(client_id, event_types)`` signature: the given event types
        stop being sent regardless of symbol. A symbol whose set becomes empty
        is dropped so it is no longer considered subscribed. Removing an event
        type that was not subscribed is a no-op.
        """

        coerced = _coerce_event_types(event_types)
        if not coerced:
            return
        for subscribed_symbol in list(self._subscriptions):
            if symbol is not None and subscribed_symbol != symbol:
                continue
            remaining = set(self._subscriptions[subscribed_symbol])
            for event_type in coerced:
                if event_type not in remaining:
                    continue
                key = (subscribed_symbol, event_type)
                if (
                    timeframe is not None
                    and event_type in _TIMEFRAME_SCOPED_EVENT_TYPES
                    and key in self._timeframes
                ):
                    tracked = self._timeframes[key]
                    if tracked is None:
                        continue
                    tracked.discard(timeframe)
                    if tracked:
                        continue
                self._timeframes.pop(key, None)
                remaining.discard(event_type)
            if remaining:
                self._subscriptions[subscribed_symbol] = remaining
            else:
                del self._subscriptions[subscribed_symbol]

    def wants(
        self,
        symbol: str,
        event_type: EventType | str,
        timeframe: str | None = None,
    ) -> bool:
        """Whether this client currently wants ``event_type`` for ``symbol``.

        Used by the broadcast/flush path (tasks 8.3/8.5) to select recipients.
        """

        et = event_type if isinstance(event_type, EventType) else EventType(event_type)
        if et not in self._subscriptions.get(symbol, frozenset()):
            return False
        if et not in _TIMEFRAME_SCOPED_EVENT_TYPES or timeframe is None:
            return True
        tracked = self._timeframes.get((symbol, et))
        return tracked is None or timeframe in tracked


class WebSocketRegistry:
    """Holds connected ``/ws/chart`` clients and manages subscriptions. (Req 5)

    Task 8.1 responsibilities: register clients on connect (Req 5.1), track each
    client's per-``(symbol, event_types)`` subscriptions, and apply
    subscribe/unsubscribe requests (Req 5.4, 5.5).

    Task 8.3 (this class) adds the throttled **coalescing flush loop**:
    :meth:`enqueue` queues an :class:`OutboundEvent`, coalescing by
    ``(type, symbol, key)`` so only the latest state per key is retained;
    :meth:`flush` drains the pending batch and delivers each event to the
    clients whose subscriptions :meth:`~ChartClient.wants` it; :meth:`flush_loop`
    runs :meth:`flush` every 100-125ms against an **injectable clock/sleep** so
    tests need not sleep in real time. (Req 5.2, 5.3)

    The heartbeat (ping 30s / drop after 60s) and per-client broadcast
    isolation (task 8.5) build on the client inventory and the :meth:`_dispatch`
    delivery seam exposed here.

    The flush interval is jittered within ``[min_interval_ms, max_interval_ms]``
    (default 100-125ms, Req 5.3). ``clock`` returns the current time in seconds
    (defaults to :func:`time.monotonic`) and ``sleep`` awaits a delay in seconds
    (defaults to :func:`asyncio.sleep`); both are injectable for deterministic
    tests. ``rng`` supplies the per-interval jitter in ``[0, 1]`` (defaults to a
    midpoint ``0.5`` so the interval is reproducible unless overridden).

    Task 8.5 (this class) adds the **heartbeat** and per-client **broadcast
    isolation**. :meth:`broadcast` delivers one event to every client that
    :meth:`~ChartClient.wants` it, wrapping each client's ``send`` in its own
    ``try``/``except`` so a failure removes only that dead client and never
    aborts the broadcast to the rest (Req 6.4). :meth:`heartbeat_tick` sends a
    ``ping`` to every client (Req 6.1) and drops any client whose last pong is
    older than the pong timeout (Req 6.3); :meth:`note_pong` records a client's
    pong arrival (called by the ``/ws/chart`` receive loop on a ``pong`` frame,
    Req 6.2). :meth:`heartbeat_loop` runs :meth:`heartbeat_tick` every
    ``ping_interval_s`` seconds against the same injectable ``clock``/``sleep``
    so tests never wait 30/60s in real time. The ping interval
    (``ping_interval_s``, default 30s) and pong timeout (``pong_timeout_s``,
    default 60s) come from :data:`app.config.settings` unless overridden.
    """

    def __init__(
        self,
        *,
        min_interval_ms: float = 100.0,
        max_interval_ms: float = 125.0,
        ping_interval_s: float | None = None,
        pong_timeout_s: float | None = None,
        send_timeout_s: float = 0.25,
        clock: Callable[[], float] | None = None,
        sleep: Callable[[float], Awaitable[None]] | None = None,
        rng: Callable[[], float] | None = None,
    ) -> None:
        if not 0 < min_interval_ms <= max_interval_ms:
            raise ValueError(
                "require 0 < min_interval_ms <= max_interval_ms, got "
                f"{min_interval_ms} / {max_interval_ms}"
            )
        resolved_ping = (
            float(settings.chart_ping_interval_s)
            if ping_interval_s is None
            else float(ping_interval_s)
        )
        resolved_pong = (
            float(settings.chart_pong_timeout_s)
            if pong_timeout_s is None
            else float(pong_timeout_s)
        )
        if resolved_ping <= 0:
            raise ValueError(f"ping_interval_s must be > 0, got {resolved_ping}")
        if resolved_pong <= 0:
            raise ValueError(f"pong_timeout_s must be > 0, got {resolved_pong}")
        if send_timeout_s <= 0:
            raise ValueError(f"send_timeout_s must be > 0, got {send_timeout_s}")
        self._clients: dict[str, ChartClient] = {}
        self._min_interval_ms = float(min_interval_ms)
        self._max_interval_ms = float(max_interval_ms)
        self._ping_interval_s = resolved_ping
        self._pong_timeout_s = resolved_pong
        self._send_timeout_s = float(send_timeout_s)
        self._clock = clock if clock is not None else time.monotonic
        self._sleep = sleep if sleep is not None else asyncio.sleep
        self._rng = rng if rng is not None else (lambda: 0.5)
        # Pending coalesced events, keyed by (type, symbol, key). Insertion
        # order is preserved (dict) so flush emits in first-seen order while
        # always carrying the latest state per key.
        self._pending: dict[tuple[EventType, str, Hashable], OutboundEvent] = {}
        # Per-client last-pong time, in the same units as ``clock`` (seconds).
        # A client's entry is seeded at registration and refreshed by
        # ``note_pong``; the heartbeat drops clients whose entry is too old.
        self._last_pong: dict[str, float] = {}
        # Clock reading of the last flush_loop flush (None until first flush).
        self._last_flush_at: float | None = None

    # -- registration ----------------------------------------------------------

    async def register(self, client: ChartClient) -> None:
        """Register a connected client so it can receive events. (Req 5.1)

        Raises ``ValueError`` if a client with the same id is already
        registered, surfacing accidental duplicate registration.
        """

        if client.id in self._clients:
            raise ValueError(f"client already registered: {client.id!r}")
        self._clients[client.id] = client
        # Seed the client's last-pong time so a freshly registered client is
        # not immediately considered stale before its first ping/pong round.
        self._last_pong[client.id] = self._clock()

    async def unregister(self, client_id: str) -> ChartClient | None:
        """Remove a client (e.g. on disconnect); return it, or ``None``.

        Idempotent: unregistering an unknown client returns ``None``. The
        heartbeat/broadcast-isolation path (task 8.5) reuses this to drop dead
        clients.
        """

        self._last_pong.pop(client_id, None)
        return self._clients.pop(client_id, None)

    def get(self, client_id: str) -> ChartClient | None:
        """Return the registered client for ``client_id`` or ``None``."""

        return self._clients.get(client_id)

    def __contains__(self, client_id: object) -> bool:
        return client_id in self._clients

    @property
    def clients(self) -> tuple[ChartClient, ...]:
        """All currently registered clients (snapshot, registration order)."""

        return tuple(self._clients.values())

    @property
    def client_count(self) -> int:
        """Number of currently registered clients."""

        return len(self._clients)

    # -- subscription management -----------------------------------------------

    def _require(self, client_id: str) -> ChartClient:
        client = self._clients.get(client_id)
        if client is None:
            raise KeyError(f"unknown client: {client_id!r}")
        return client

    async def subscribe(
        self,
        client_id: str,
        symbol: str,
        event_types: Iterable[EventType | str],
        timeframe: str | None = None,
    ) -> None:
        """Begin sending ``event_types`` for ``symbol`` to a client. (Req 5.4)

        Raises ``KeyError`` if ``client_id`` is not registered.
        """

        self._require(client_id).subscribe(symbol, event_types, timeframe)

    async def unsubscribe(
        self,
        client_id: str,
        event_types: Iterable[EventType | str],
        *,
        symbol: str | None = None,
        timeframe: str | None = None,
    ) -> None:
        """Stop sending ``event_types`` to a client. (Req 5.5)

        Symbol-agnostic, matching Req 5.5 and the design signature: the event
        types stop being sent for every symbol the client had them on. Raises
        ``KeyError`` if ``client_id`` is not registered.
        """

        self._require(client_id).unsubscribe(
            event_types, symbol=symbol, timeframe=timeframe
        )

    def wants(
        self,
        client_id: str,
        symbol: str,
        event_type: EventType | str,
        timeframe: str | None = None,
    ) -> bool:
        """Whether a registered client wants ``event_type`` for ``symbol``.

        Returns ``False`` for an unknown client. Recipient selection helper for
        the broadcast/flush path (tasks 8.3/8.5).
        """

        client = self._clients.get(client_id)
        return client is not None and client.wants(symbol, event_type, timeframe)

    # -- heartbeat + broadcast isolation (task 8.5) ----------------------------

    @property
    def ping_interval_s(self) -> float:
        """Seconds between heartbeat pings (Req 6.1)."""

        return self._ping_interval_s

    @property
    def pong_timeout_s(self) -> float:
        """Seconds a client may go without a pong before being dropped (Req 6.3)."""

        return self._pong_timeout_s

    def note_pong(self, client_id: str, *, at: float | None = None) -> None:
        """Record that ``client_id`` sent a pong. (Req 6.2)

        Called by the ``/ws/chart`` receive loop whenever a ``pong`` frame
        arrives. Refreshes the client's last-pong time (in ``clock`` units,
        seconds) so the heartbeat watchdog keeps it alive. ``at`` overrides the
        recorded time (defaults to the registry ``clock``). Unknown clients are
        ignored (a pong from an already-dropped client is harmless).
        """

        if client_id not in self._clients:
            return
        self._last_pong[client_id] = self._clock() if at is None else float(at)

    async def _safe_send(self, client: ChartClient, payload: dict[str, Any]) -> bool:
        """Send ``payload`` to one client, isolating any failure. (Req 6.4)

        Returns ``True`` on success. On any exception the dead client is
        unregistered (and its close hook invoked) and ``False`` is returned, so
        the caller can continue delivering to the remaining clients. Never
        propagates the send exception.
        """

        try:
            result = client.send(payload)
            if inspect.isawaitable(result):
                await asyncio.wait_for(result, timeout=self._send_timeout_s)
            return True
        except Exception as exc:
            # One client's failure must not abort the broadcast: drop just this
            # client and report failure to the caller. (Req 6.4)
            logger.warning(
                "/ws/chart: dropping %s after send %s: %s",
                client.id,
                type(exc).__name__,
                exc,
            )
            await self._drop_client(client.id)
            return False

    async def _drop_client(self, client_id: str) -> None:
        """Unregister a client and best-effort close its connection.

        Used both when a client fails a broadcast send (Req 6.4) and when it
        misses the pong deadline (Req 6.3). Closing is best-effort: a failure to
        close is swallowed so dropping one client never disrupts the others.
        """

        client = await self.unregister(client_id)
        if client is None or client.close is None:
            return
        try:
            result = client.close()
            if inspect.isawaitable(result):
                await result
        except Exception:
            # The socket may already be dead; the client is already removed.
            pass

    async def broadcast(self, event: OutboundEvent) -> int:
        """Deliver ``event`` to every client that wants it, isolating failures.

        Selects recipients via :meth:`ChartClient.wants` on the event's
        ``(symbol, event_type)`` and sends the wire ``payload`` to each. Each
        send is wrapped in its own ``try``/``except`` (see :meth:`_safe_send`)
        so an exception sending to one client removes only that dead client and
        the broadcast continues to the rest. Returns the number of clients that
        received the event successfully. (Req 6.4)
        """

        delivered = 0
        # Snapshot recipients first: ``_safe_send`` may unregister a failing
        # client mid-iteration, so we must not iterate the live mapping.
        recipients = [
            c
            for c in self.clients
            if c.wants(event.symbol, event.event_type, event.payload.get("tf"))
        ]
        if not recipients:
            return 0
        results = await asyncio.gather(
            *(self._safe_send(client, event.payload) for client in recipients)
        )
        return sum(results)

    async def heartbeat_tick(self, *, now: float | None = None) -> None:
        """Run one heartbeat round: drop stale clients, then ping the rest.

        First drops every client whose last pong is older than
        ``pong_timeout_s`` (Req 6.3), closing each dropped connection. Then
        sends a ``ping`` event to every remaining client (Req 6.1), reusing the
        per-client send isolation so a ping that fails to one client does not
        abort the rest (Req 6.4). ``now`` overrides the current time (defaults
        to the registry ``clock``) so the watchdog is deterministic in tests.
        """

        current = self._clock() if now is None else float(now)
        # 1) Drop clients that have not ponged within the timeout (Req 6.3).
        stale = [
            cid
            for cid, last in self._last_pong.items()
            if current - last > self._pong_timeout_s
        ]
        for client_id in stale:
            logger.warning("/ws/chart: dropping %s after pong timeout", client_id)
            await self._drop_client(client_id)
        # 2) Ping the survivors (Req 6.1). A fresh timestamp per tick; reuse
        #    ``_safe_send`` so a failing ping drops only that client (Req 6.4).
        ping_payload = Ping(time=now_ms()).to_dict()
        for client in self.clients:
            await self._safe_send(client, ping_payload)

    async def heartbeat_loop(self) -> None:
        """Send a ping every ``ping_interval_s`` and drop clients with no pong.

        Runs :meth:`heartbeat_tick` forever, sleeping ``ping_interval_s`` seconds
        between rounds against the injectable ``sleep`` so tests need not wait
        30/60s in real time (Req 6.1, 6.3). Cancellation (``CancelledError``)
        propagates so the task stops cleanly on shutdown.
        """

        while True:
            await self._sleep(self._ping_interval_s)
            await self.heartbeat_tick()

    # -- coalescing flush loop (task 8.3) --------------------------------------

    def enqueue(self, event: OutboundEvent) -> None:
        """Queue an outbound event, coalescing by ``(type, symbol, key)``. (Req 5.3)

        If an event with the same :attr:`~OutboundEvent.coalescing_key` is
        already pending, it is replaced so only the **latest state** per key is
        flushed; the slot keeps its original position in the pending order
        (first-seen ordering) so flush emission order is stable across
        coalesced updates. Different keys queue independently.
        """

        slot = event.coalescing_key
        # dict assignment overwrites in place (preserving first-seen position)
        # for an existing key, and appends for a new key -- exactly the
        # latest-state-wins, stable-order coalescing we want.
        self._pending[slot] = event

    @property
    def pending_count(self) -> int:
        """Number of distinct coalescing slots currently pending flush."""

        return len(self._pending)

    def _drain_pending(self) -> list[OutboundEvent]:
        """Atomically take and clear the pending batch (first-seen order)."""

        batch = list(self._pending.values())
        self._pending.clear()
        return batch

    async def _dispatch(self, client: ChartClient, payload: dict[str, Any]) -> None:
        """Deliver one payload to one client via its injected ``send``.

        Delivery seam shared with task 8.5: the flush loop routes every send
        through here so heartbeat/broadcast-isolation can later wrap delivery
        (per-client try/except) without altering the coalescing core. Awaits the
        ``send`` result when it is awaitable so both sync and async transports
        work.
        """

        result = client.send(payload)
        if inspect.isawaitable(result):
            await result

    async def flush(self) -> int:
        """Drain the pending batch, delivering each event to its subscribers.

        For each coalesced event, every registered client that
        :meth:`~ChartClient.wants` the event's ``(symbol, event_type)`` receives
        the event's wire ``payload``. Returns the number of ``(client, event)``
        deliveries performed. Coalescing already happened at :meth:`enqueue`
        time, so each pending slot is delivered exactly once per interval with
        its latest state. (Req 5.2, 5.3)
        """

        batch = self._drain_pending()
        if not batch:
            return 0
        deliveries = 0
        for event in batch:
            deliveries += await self.broadcast(event)
        return deliveries

    def _next_interval_seconds(self) -> float:
        """Pick the next flush delay (seconds), jittered within the bounds.

        Maps the injected ``rng`` value in ``[0, 1]`` onto
        ``[min_interval_ms, max_interval_ms]`` and converts to seconds, so the
        flush cadence always lies within the design's 100-125ms window. (Req 5.3)
        """

        frac = self._rng()
        # Clamp defensively so a misbehaving rng can never escape the window.
        frac = 0.0 if frac < 0.0 else 1.0 if frac > 1.0 else frac
        interval_ms = self._min_interval_ms + frac * (
            self._max_interval_ms - self._min_interval_ms
        )
        return interval_ms / 1000.0

    async def flush_loop(self, *, max_iterations: int | None = None) -> None:
        """Run :meth:`flush` every 100-125ms against the injectable clock. (Req 5.3)

        Each iteration awaits the injected ``sleep`` for a jittered interval
        within ``[min_interval_ms, max_interval_ms]``, then runs :meth:`flush`
        and records the flush time from the injected ``clock``. Using the
        injected ``sleep``/``clock`` lets tests drive the cadence deterministically
        instead of waiting in real time. Runs forever by default; pass
        ``max_iterations`` to bound the loop (used by tests). The loop is
        cancellation-aware: :class:`asyncio.CancelledError` performs a final
        best-effort flush so queued events are not dropped on shutdown, then
        re-raises.
        """

        iterations = 0
        try:
            while max_iterations is None or iterations < max_iterations:
                await self._sleep(self._next_interval_seconds())
                await self.flush()
                self._last_flush_at = self._clock()
                iterations += 1
        except asyncio.CancelledError:
            await self.flush()
            raise

    @property
    def last_flush_at(self) -> float | None:
        """Clock reading of the most recent :meth:`flush_loop` flush, if any."""

        return self._last_flush_at
