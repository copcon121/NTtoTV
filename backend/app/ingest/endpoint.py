"""`/ws/nt` ingestion endpoint (task 6.1).

Accepts the NT_AddOn WebSocket connection, receives normalized
trade/quote/status/heartbeat frames, dispatches each decoded frame to
injectable handler callbacks, and exposes an outbound ``send_control`` channel
for sending Control_Commands back to the NT_AddOn. Every received frame
refreshes a ``last_seen`` timestamp via ``note_activity`` so the connection
liveness watchdog (task 6.6) can detect a half-open connection.

Scope of this module (tasks 6.1 + 6.6):

* connection accept + receive loop (Req 4.1)
* frame decode dispatch to injectable handlers (trade/quote/status/heartbeat)
* outbound ``send_control`` channel (Req 4.6, used by task 9.3)
* ``last_seen`` refresh on every received frame via ``note_activity`` (Req 4.7)
* the 15s status-timeout watchdog loop ``status_timeout_loop`` that, when no
  data/status/heartbeat arrives within the configured window, emits exactly one
  ``disconnected`` status through a thin seam and releases the connection
  (Req 4.7, 4.8, 20.2)

Intentionally **out of scope** here and integrated by later tasks:

* per-Stream sequence validation (dedup / out-of-order / gap) — task 6.2
* raw tick recording before throttling — task 6.4
* engine handler wiring — task 20.1
* binding the disconnected-status seam to the WebSocket_Registry — task 20.1

These are kept as separate seams: engines/validators are wired in by supplying
``IngestHandlers`` callbacks, and the watchdog emits through an injectable
``DisconnectedStatusEmitter`` against an injectable clock + sleep.
(Requirements 4.1, 4.7, 4.8, 20.2)
"""

from __future__ import annotations

import asyncio
import inspect
import json
import logging
from contextlib import suppress
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..config import settings
from ..models.canonical import NormalizedQuote, NormalizedTrade
from ..models.messages import (
    ChartStatusEvent,
    ControlCommand,
    NTStatusEvent,
    StatusState,
    decode_nt_data_message,
)
from ..models.timestamp import CanonicalTimestamp, now_ms

logger = logging.getLogger(__name__)

router = APIRouter()

__all__ = [
    "HEARTBEAT_TYPE",
    "TIMEOUT_DISCONNECTED_REASON",
    "TradeHandler",
    "QuoteHandler",
    "StatusHandler",
    "HeartbeatHandler",
    "DisconnectedStatusEmitter",
    "SleepFn",
    "IngestHandlers",
    "IngestEndpoint",
    "router",
]

# Heartbeat frames carry only liveness (they refresh ``last_seen``); they have
# no dedicated payload schema, so they are recognized by this discriminator and
# delivered to ``on_heartbeat`` as the raw decoded dict.
HEARTBEAT_TYPE = "heartbeat"

# ``reason`` carried by the ``disconnected`` status the liveness watchdog emits
# when the `/ws/nt` connection falls silent for longer than the status timeout.
# Distinguishes a half-open NT_AddOn timeout from other disconnect causes.
# (Req 4.8, 20.2)
TIMEOUT_DISCONNECTED_REASON = "nt_timeout"

# Handler callbacks may be sync or async; the receive loop awaits awaitables.
TradeHandler = Callable[[NormalizedTrade], Awaitable[None] | None]
QuoteHandler = Callable[[NormalizedQuote], Awaitable[None] | None]
StatusHandler = Callable[[NTStatusEvent], Awaitable[None] | None]
HeartbeatHandler = Callable[[dict[str, Any]], Awaitable[None] | None]

# The disconnected-status seam. Given the prepared ``ChartStatusEvent``, deliver
# it to subscribed Frontend clients. May be sync or async; task 20.1 supplies a
# callback that enqueues onto the WebSocket_Registry broadcast. Kept as a thin
# seam (rather than hard-wired to the registry) so the watchdog stays testable
# in isolation. (Req 4.8, 20.2)
DisconnectedStatusEmitter = Callable[[ChartStatusEvent], Awaitable[None] | None]

# Injectable async sleep used by the watchdog poll loop. Defaults to
# ``asyncio.sleep``; tests inject a virtual-clock sleep so the 15s window is
# exercised without real waits.
SleepFn = Callable[[float], Awaitable[None]]


@dataclass(frozen=True, slots=True)
class IngestHandlers:
    """Injectable per-frame dispatch callbacks for the ingestion endpoint.

    Each callback is optional; when omitted the corresponding frame type is
    decoded and its activity recorded but otherwise dropped (the default drains
    the connection). Engines, the sequence validator (task 6.2), and tick
    recording (task 6.4) wire in by supplying these callbacks (task 20.1).
    Callbacks may be synchronous or asynchronous.
    """

    on_trade: TradeHandler | None = None
    on_quote: QuoteHandler | None = None
    on_status: StatusHandler | None = None
    on_heartbeat: HeartbeatHandler | None = None


async def _maybe_await(result: Awaitable[None] | None) -> None:
    """Await ``result`` when a handler returned an awaitable; otherwise no-op."""
    if inspect.isawaitable(result):
        await result


class IngestEndpoint:
    """Manages a single NT_AddOn `/ws/nt` connection. (Req 4.1, 4.6, 4.7, 4.8)

    Responsibilities:

    * accept the connection and run the receive loop (Req 4.1),
    * decode each frame and dispatch it to the injected handlers,
    * refresh ``last_seen`` on every received frame (Req 4.7),
    * send Control_Commands back to the NT_AddOn (Req 4.6), and
    * run the liveness watchdog that times out a silent connection as
      ``disconnected`` and releases its resources (Req 4.8, 20.2).

    The ``clock`` is injectable so tests (and the watchdog in task 6.6) can
    drive ``last_seen`` against a virtual clock. The watchdog's
    ``emit_disconnected`` seam, ``status_timeout_s`` window, and ``sleep`` are
    likewise injectable for deterministic timeout testing without real waits.
    """

    def __init__(
        self,
        websocket: WebSocket,
        handlers: IngestHandlers | None = None,
        *,
        clock: Callable[[], CanonicalTimestamp] = now_ms,
        emit_disconnected: DisconnectedStatusEmitter | None = None,
        status_timeout_s: float = settings.nt_status_timeout_s,
        sleep: SleepFn = asyncio.sleep,
    ) -> None:
        self._websocket = websocket
        self._handlers = handlers or IngestHandlers()
        self._clock = clock
        self._emit_disconnected = emit_disconnected
        self._status_timeout_s = status_timeout_s
        self._sleep = sleep
        self._last_seen: CanonicalTimestamp | None = None
        # Watchdog lifecycle flags: ``_released`` guards single-shot resource
        # release; ``_disconnect_emitted`` guarantees exactly one ``disconnected``
        # status is emitted on timeout. (Req 4.8, 20.2)
        self._released = False
        self._disconnect_emitted = False

    @property
    def last_seen(self) -> CanonicalTimestamp | None:
        """The Canonical_Timestamp of the most recently received frame.

        ``None`` until the first frame is received. Read by the liveness
        watchdog (task 6.6). (Req 4.7)
        """
        return self._last_seen

    @property
    def released(self) -> bool:
        """``True`` once the watchdog has released the connection resources."""
        return self._released

    def note_activity(self, now: CanonicalTimestamp) -> None:
        """Refresh ``last_seen`` to ``now``. (Req 4.7)

        Called on every received data, status, or heartbeat frame so the
        watchdog (task 6.6) can detect 15s of silence.
        """
        self._last_seen = now

    async def send_control(self, cmd: ControlCommand) -> None:
        """Send a Control_Command to the NT_AddOn. (Req 4.6)

        Used by the contract control plane (task 9.3) to subscribe/unsubscribe
        Candidate_Contracts.
        """
        await self._websocket.send_json(cmd.to_dict())

    async def run(self, on_connected: Callable[[], Awaitable[None] | None] | None = None) -> None:
        """Accept the connection and run the receive loop until disconnect.

        Accepts the NT_AddOn connection (Req 4.1), then reads frames, refreshing
        ``last_seen`` on each received frame (Req 4.7). When a disconnected-status
        seam is configured, a concurrent liveness watchdog
        (:meth:`status_timeout_loop`) runs alongside the receive loop and tears
        the connection down after the status-timeout window of silence (Req 4.8).

        ``on_connected`` (when provided) is awaited immediately **after** the
        WebSocket handshake completes, so any outbound frame it sends (e.g. the
        initial control-plane subscribe burst) happens after ``accept()`` — never
        before, which would crash the ASGI send. (Req 1.5)

        The watchdog shares the injected ``clock`` with ``last_seen``, so it is
        started **only when** an ``emit_disconnected`` seam is supplied (wired in
        task 20.1); without a seam the endpoint simply drains frames, matching the
        task 6.1 behavior. The watchdog is fully implemented and independently
        testable via :meth:`status_timeout_loop`.
        """
        await self._websocket.accept()
        if on_connected is not None:
            await _maybe_await(on_connected())
        watchdog: asyncio.Task[None] | None = None
        if self._emit_disconnected is not None:
            # Baseline liveness from connection establishment so the first
            # window is measured from accept, not from the first frame.
            self.note_activity(self._clock())
            watchdog = asyncio.create_task(self.status_timeout_loop())
        try:
            await self._receive_loop()
        finally:
            if watchdog is not None:
                watchdog.cancel()
                with suppress(asyncio.CancelledError):
                    await watchdog

    async def _receive_loop(self) -> None:
        """Read frames until the socket disconnects, refreshing liveness.

        Each received frame (even an undecodable one) refreshes ``last_seen``
        (Req 4.7); decoded frames are dispatched to the handlers. Malformed or
        unknown frames are logged and skipped without tearing down the
        connection.
        """
        try:
            while True:
                raw = await self._websocket.receive_text()
                # Receiving any frame is liveness activity. (Req 4.7)
                self.note_activity(self._clock())
                await self._handle_raw(raw)
        except WebSocketDisconnect:
            return

    async def status_timeout_loop(self) -> None:
        """Watchdog: time out a silent `/ws/nt` connection as disconnected.

        Polls ``last_seen`` against an injectable ``clock`` and ``sleep``. If no
        data, status, or heartbeat frame has refreshed ``last_seen`` within the
        configured ``status_timeout_s`` window, emits exactly one ``disconnected``
        :class:`ChartStatusEvent` through the seam and releases the connection
        resources, then exits (Req 4.7, 4.8, 20.2). Any activity that refreshes
        ``last_seen`` during a poll resets the window.

        The loop sleeps for the *remaining* time until the deadline, so a fresh
        frame received mid-sleep naturally extends the window on the next pass
        and an idle connection fires promptly. Injecting a virtual ``clock`` +
        ``sleep`` makes the 15s behavior deterministically testable without real
        waits.
        """
        if self._last_seen is None:
            # No frame has been seen yet; baseline from the current clock so the
            # window is well defined when the watchdog is exercised in isolation.
            self.note_activity(self._clock())
        timeout_ms = self._status_timeout_s * 1000
        while not self._released:
            now = self._clock()
            elapsed = now - (self._last_seen if self._last_seen is not None else now)
            if elapsed >= timeout_ms:
                await self._handle_timeout(now)
                return
            await self._sleep((timeout_ms - elapsed) / 1000)

    def _timed_out(self, now: CanonicalTimestamp) -> bool:
        """Return ``True`` when no activity has occurred within the window.

        Pure decision helper: ``True`` iff the time since ``last_seen`` has
        reached the status-timeout window as of ``now``. ``False`` before any
        frame has been seen. (Req 4.8)
        """
        if self._last_seen is None:
            return False
        return (now - self._last_seen) >= self._status_timeout_s * 1000

    async def _handle_timeout(self, now: CanonicalTimestamp) -> None:
        """Emit the single ``disconnected`` status and release resources. (Req 4.8)"""
        await self._emit_disconnected_status(now)
        await self._release()

    async def _emit_disconnected_status(self, now: CanonicalTimestamp) -> None:
        """Push exactly one ``disconnected`` status through the seam. (Req 4.8, 20.2)

        Guarded by ``_disconnect_emitted`` so the watchdog emits at most one
        timeout disconnect for a connection, even if invoked more than once. The
        event carries ``reason="nt_timeout"`` so the Frontend can distinguish a
        half-open NT_AddOn timeout from other disconnects. No-op delivery when no
        seam is wired (the guard still latches).
        """
        if self._disconnect_emitted:
            return
        self._disconnect_emitted = True
        if self._emit_disconnected is None:
            return
        event = ChartStatusEvent(
            state=StatusState.DISCONNECTED,
            time=now,
            reason=TIMEOUT_DISCONNECTED_REASON,
        )
        await _maybe_await(self._emit_disconnected(event))

    async def _release(self) -> None:
        """Release the `/ws/nt` connection resources for this socket. (Req 4.8)

        Idempotent (single-shot via ``_released``). Closes the underlying socket;
        any close error is suppressed because the peer may already be gone (the
        half-open case the watchdog exists to handle).
        """
        if self._released:
            return
        self._released = True
        with suppress(Exception):
            await self._websocket.close()

    async def _handle_raw(self, raw: str) -> None:
        """Decode a single text frame and dispatch it; never raises upward."""
        try:
            data = json.loads(raw)
        except (ValueError, TypeError):
            logger.warning("/ws/nt: discarding non-JSON frame")
            return
        if not isinstance(data, dict):
            logger.warning("/ws/nt: discarding non-object frame: %r", type(data))
            return
        await self._dispatch(data)

    async def _dispatch(self, data: dict[str, Any]) -> None:
        """Route a decoded frame to the appropriate injected handler."""
        if data.get("type") == HEARTBEAT_TYPE:
            await _maybe_await(self._call_heartbeat(data))
            return
        try:
            decoded = decode_nt_data_message(data)
        except (ValueError, KeyError) as exc:
            logger.warning("/ws/nt: discarding undecodable frame: %s", exc)
            return
        if isinstance(decoded, NormalizedTrade):
            if self._handlers.on_trade is not None:
                await _maybe_await(self._handlers.on_trade(decoded))
        elif isinstance(decoded, NormalizedQuote):
            if self._handlers.on_quote is not None:
                await _maybe_await(self._handlers.on_quote(decoded))
        else:  # NTStatusEvent
            if self._handlers.on_status is not None:
                await _maybe_await(self._handlers.on_status(decoded))

    def _call_heartbeat(self, data: dict[str, Any]) -> Awaitable[None] | None:
        if self._handlers.on_heartbeat is not None:
            return self._handlers.on_heartbeat(data)
        return None


@router.websocket("/ws/nt")
async def ws_nt(websocket: WebSocket) -> None:
    """Accept the NT_AddOn connection and run the ingestion loop. (Req 4.1, 20.1)

    When a runtime is attached (the lifespan-wired production path), the endpoint
    drives the full pipeline: decoded frames flow through the
    :class:`~app.pipeline.Pipeline` handlers (validate -> record -> engines ->
    registry), the control-plane ``send_control`` seam is bound to this live
    socket so subscribe/unsubscribe Control_Commands reach the NT_AddOn (Req
    4.6, 1.7, 1.8), and the liveness watchdog forwards a ``disconnected`` status
    to subscribed clients on 15s of silence (Req 4.8, 20.2). On connect the
    needed-contract set is synced so the NT_AddOn subscribes to all candidates
    (Req 1.5).

    Without a runtime (route-only test harness) it falls back to the default
    drain loop so the route stays importable and connectable.
    """
    runtime = getattr(websocket.app.state, "runtime", None)
    if runtime is None:
        endpoint = IngestEndpoint(websocket)
        await endpoint.run()
        return

    pipeline = runtime.pipeline
    endpoint = IngestEndpoint(
        websocket,
        pipeline.handlers(),
        emit_disconnected=pipeline._emit_status,
    )
    # Bind the control plane to this live socket and announce the initial
    # needed-contract set so the NT_AddOn subscribes to all candidates (Req 1.5).
    # The sync runs via on_connected (AFTER accept) so the subscribe frames are
    # not sent before the WebSocket handshake completes.
    control_plane = runtime.make_control_plane(endpoint.send_control)
    pipeline.set_control_plane(control_plane)

    async def _announce() -> None:
        await control_plane.sync_from_resolver(runtime.pipeline._resolver)

    try:
        await endpoint.run(on_connected=_announce)
    finally:
        pipeline.set_control_plane(None)
