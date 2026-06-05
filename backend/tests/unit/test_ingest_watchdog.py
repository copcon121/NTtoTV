"""Unit tests for the `/ws/nt` connection liveness watchdog (task 6.6).

Example-based coverage of the 15s status-timeout watchdog added by task 6.6:

* after the status-timeout window of silence, the watchdog emits **exactly one**
  ``disconnected`` status (reason ``nt_timeout``) through the injected seam and
  releases the connection resources (Req 4.7, 4.8, 20.2),
* activity that refreshes ``last_seen`` mid-window resets the window so the
  timeout fires later (and still only once) (Req 4.7), and
* the integrated ``run`` path starts the watchdog when a seam is wired and the
  timeout closes the underlying socket, ending the receive loop (Req 4.8).

The clock and async ``sleep`` are injected via a virtual loop so the 15-second
behavior is exercised deterministically without any real waiting.
"""

from __future__ import annotations

import asyncio

import pytest
from fastapi import WebSocketDisconnect

from app.ingest.endpoint import (
    TIMEOUT_DISCONNECTED_REASON,
    IngestEndpoint,
)
from app.models.messages import ChartStatusEvent, StatusState

TIMEOUT_S = 15
TIMEOUT_MS = TIMEOUT_S * 1000


class VirtualLoop:
    """A virtual clock + async sleep that advances simulated time on sleep.

    ``clock`` returns the current simulated Canonical_Timestamp (ms). ``sleep``
    advances simulated time by the requested seconds, applying any scheduled
    frame "activity" whose simulated arrival falls within the slept interval by
    calling ``endpoint.note_activity`` (latest-wins). Each sleep yields control
    to the event loop so a concurrent receive loop can make progress.
    """

    def __init__(self, start_ms: int = 0) -> None:
        self.now = start_ms
        self.endpoint: IngestEndpoint | None = None
        self.activities: list[int] = []  # simulated arrival times (ms)
        self.sleeps: list[float] = []

    def clock(self) -> int:
        return self.now

    def schedule_activity(self, *times_ms: int) -> None:
        self.activities.extend(times_ms)
        self.activities.sort()

    async def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        target = self.now + int(round(seconds * 1000))
        applied = [t for t in self.activities if self.now < t <= target]
        self.now = target
        for t in applied:  # latest applied wins
            assert self.endpoint is not None
            self.endpoint.note_activity(t)
        self.activities = [t for t in self.activities if t > target]
        # Yield so a concurrent receive loop can observe a socket close.
        await asyncio.sleep(0)


class FakeWebSocket:
    """Minimal WebSocket double whose ``close`` unblocks a pending receive.

    ``receive_text`` yields queued frames, then awaits a close event and raises
    ``WebSocketDisconnect`` once the watchdog closes the socket. ``close`` is
    idempotent-friendly and records the closed state.
    """

    def __init__(self, frames: list[str] | None = None) -> None:
        self._frames = list(frames or [])
        self.accepted = False
        self.closed = False
        self._closed = asyncio.Event()

    async def accept(self) -> None:
        self.accepted = True

    async def receive_text(self) -> str:
        if self._frames:
            return self._frames.pop(0)
        await self._closed.wait()
        raise WebSocketDisconnect()

    async def close(self) -> None:
        self.closed = True
        self._closed.set()

    async def send_json(self, payload: dict) -> None:  # pragma: no cover - unused
        pass


def _make_endpoint(
    loop: VirtualLoop, events: list[ChartStatusEvent], *, ws: FakeWebSocket | None = None
) -> IngestEndpoint:
    endpoint = IngestEndpoint(
        ws if ws is not None else FakeWebSocket(),
        clock=loop.clock,
        emit_disconnected=events.append,
        status_timeout_s=TIMEOUT_S,
        sleep=loop.sleep,
    )
    loop.endpoint = endpoint
    return endpoint


# --- timeout with no activity emits exactly one disconnected (Req 4.8) -------


@pytest.mark.unit
def test_silence_emits_single_disconnected_and_releases():
    loop = VirtualLoop(start_ms=1000)
    events: list[ChartStatusEvent] = []
    endpoint = _make_endpoint(loop, events)

    asyncio.run(endpoint.status_timeout_loop())

    assert len(events) == 1
    evt = events[0]
    assert evt.state is StatusState.DISCONNECTED
    assert evt.reason == TIMEOUT_DISCONNECTED_REASON
    # Fired at the deadline: baseline 1000ms + 15000ms window.
    assert evt.time == 1000 + TIMEOUT_MS
    assert endpoint.released is True


@pytest.mark.unit
def test_disconnect_status_carries_no_source_and_is_chart_event():
    # The watchdog emits a Backend->client ChartStatusEvent (no `source`).
    loop = VirtualLoop(start_ms=0)
    events: list[ChartStatusEvent] = []
    endpoint = _make_endpoint(loop, events)

    asyncio.run(endpoint.status_timeout_loop())

    assert isinstance(events[0], ChartStatusEvent)
    assert events[0].to_dict() == {
        "type": "status",
        "state": "disconnected",
        "time": TIMEOUT_MS,
        "reason": TIMEOUT_DISCONNECTED_REASON,
    }


# --- activity resets the window (Req 4.7) ------------------------------------


@pytest.mark.unit
def test_activity_within_window_resets_timeout():
    # Baseline at t=0. A frame arrives at t=10_000 (inside the first window),
    # so the timeout should fire 15s after that frame, not after the baseline.
    loop = VirtualLoop(start_ms=0)
    loop.schedule_activity(10_000)
    events: list[ChartStatusEvent] = []
    endpoint = _make_endpoint(loop, events)

    asyncio.run(endpoint.status_timeout_loop())

    assert len(events) == 1
    # Window restarts from the 10_000ms activity -> fires at 25_000ms.
    assert events[0].time == 10_000 + TIMEOUT_MS


@pytest.mark.unit
def test_repeated_activity_keeps_connection_alive_then_times_out_once():
    loop = VirtualLoop(start_ms=0)
    # Three heartbeats spaced under the window, then silence.
    loop.schedule_activity(5_000, 12_000, 20_000)
    events: list[ChartStatusEvent] = []
    endpoint = _make_endpoint(loop, events)

    asyncio.run(endpoint.status_timeout_loop())

    # Exactly one disconnect, fired 15s after the LAST activity (20_000).
    assert len(events) == 1
    assert events[0].time == 20_000 + TIMEOUT_MS


# --- pure decision helper + idempotency --------------------------------------


@pytest.mark.unit
def test_timed_out_helper_boundary():
    loop = VirtualLoop(start_ms=0)
    endpoint = _make_endpoint(loop, [])
    endpoint.note_activity(1_000)

    # Before any frame, the window is undefined -> not timed out.
    fresh = IngestEndpoint(FakeWebSocket(), status_timeout_s=TIMEOUT_S)
    assert fresh._timed_out(10**9) is False

    assert endpoint._timed_out(1_000 + TIMEOUT_MS - 1) is False  # just inside
    assert endpoint._timed_out(1_000 + TIMEOUT_MS) is True  # exactly at deadline
    assert endpoint._timed_out(1_000 + TIMEOUT_MS + 1) is True  # past deadline


@pytest.mark.unit
def test_disconnect_emitted_at_most_once_even_if_handled_twice():
    loop = VirtualLoop(start_ms=0)
    events: list[ChartStatusEvent] = []
    endpoint = _make_endpoint(loop, events)

    asyncio.run(endpoint._handle_timeout(123))
    asyncio.run(endpoint._handle_timeout(456))  # second call must be a no-op

    assert len(events) == 1
    assert events[0].time == 123
    assert endpoint.released is True


@pytest.mark.unit
def test_async_disconnected_seam_is_awaited():
    loop = VirtualLoop(start_ms=0)
    events: list[ChartStatusEvent] = []

    async def emit(evt: ChartStatusEvent) -> None:
        events.append(evt)

    endpoint = IngestEndpoint(
        FakeWebSocket(),
        clock=loop.clock,
        emit_disconnected=emit,
        status_timeout_s=TIMEOUT_S,
        sleep=loop.sleep,
    )
    loop.endpoint = endpoint

    asyncio.run(endpoint.status_timeout_loop())

    assert len(events) == 1
    assert events[0].state is StatusState.DISCONNECTED


# --- integrated run(): watchdog times out and closes the socket (Req 4.8) ----


@pytest.mark.unit
def test_run_starts_watchdog_and_timeout_closes_socket():
    loop = VirtualLoop(start_ms=0)
    events: list[ChartStatusEvent] = []
    ws = FakeWebSocket()  # no frames: stays silent until the watchdog closes it
    endpoint = _make_endpoint(loop, events, ws=ws)

    asyncio.run(endpoint.run())

    assert ws.accepted is True
    assert ws.closed is True  # watchdog released the connection
    assert endpoint.released is True
    assert len(events) == 1
    assert events[0].state is StatusState.DISCONNECTED


@pytest.mark.unit
def test_run_without_seam_does_not_start_watchdog():
    # Without a disconnected-status seam, run() simply drains and returns;
    # no watchdog, no timeout, no socket close. (Matches task 6.1 behavior.)
    ws = FakeWebSocket()

    async def drive() -> None:
        endpoint = IngestEndpoint(ws)
        task = asyncio.create_task(endpoint.run())
        await asyncio.sleep(0)  # let it reach the receive await
        await ws.close()  # simulate the peer disconnecting
        await task
        assert endpoint.released is False

    asyncio.run(drive())
    assert ws.accepted is True
