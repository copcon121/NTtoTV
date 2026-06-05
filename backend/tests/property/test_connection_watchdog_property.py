"""Property test for the `/ws/nt` connection liveness watchdog (task 6.7, design Property 31).

Exercises the 15s status-timeout watchdog on the `/ws/nt` ingestion endpoint
(:meth:`~app.ingest.endpoint.IngestEndpoint.status_timeout_loop`) against an
injectable virtual clock + ``sleep`` so the 15-second window is explored
deterministically with no real waiting.

For an arbitrary schedule of liveness activity (data/status/heartbeat frames),
where every activity arrives within the timeout window of the previous one
(each refreshing ``last_seen``), followed by silence, the test asserts:

* the watchdog emits **exactly one** ``disconnected`` status (state
  ``disconnected``, reason ``nt_timeout``) and releases the connection
  resources (Req 4.8); and
* activity within the window refreshes ``last_seen`` and **prevents** the
  timeout — the disconnect fires at ``last_activity + 15s`` (or ``baseline +
  15s`` when there is no activity), strictly later than the baseline deadline
  whenever any activity arrived (Req 4.7).

**Validates: Requirements 4.7, 4.8**
"""

from __future__ import annotations

import asyncio

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.ingest.endpoint import (
    TIMEOUT_DISCONNECTED_REASON,
    IngestEndpoint,
    IngestHandlers,
)
from app.models.messages import ChartStatusEvent, StatusState

TIMEOUT_S = 15
TIMEOUT_MS = TIMEOUT_S * 1000


class VirtualLoop:
    """Virtual clock + async sleep that advances simulated time on sleep.

    ``clock`` returns the current simulated Canonical_Timestamp (ms). ``sleep``
    advances simulated time by the requested seconds, applying any scheduled
    ``note_activity`` arrivals whose simulated time falls within the slept
    interval (latest-wins) before yielding control back to the event loop.
    Mirrors the helper used by the watchdog unit tests.
    """

    def __init__(self, start_ms: int = 0) -> None:
        self.now = start_ms
        self.endpoint: IngestEndpoint | None = None
        self.activities: list[int] = []
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
        for t in applied:  # latest applied wins (note_activity is last-write)
            assert self.endpoint is not None
            self.endpoint.note_activity(t)
        self.activities = [t for t in self.activities if t > target]
        await asyncio.sleep(0)


def _make_endpoint(
    loop: VirtualLoop, events: list[ChartStatusEvent]
) -> IngestEndpoint:
    endpoint = IngestEndpoint(
        _NullWebSocket(),
        IngestHandlers(),
        clock=loop.clock,
        emit_disconnected=events.append,
        status_timeout_s=TIMEOUT_S,
        sleep=loop.sleep,
    )
    loop.endpoint = endpoint
    return endpoint


class _NullWebSocket:
    """No-op WebSocket double; the watchdog loop never receives on it."""

    async def accept(self) -> None:  # pragma: no cover - unused in this test
        pass

    async def close(self) -> None:  # pragma: no cover - release path unused here
        pass

    async def send_json(self, payload: dict) -> None:  # pragma: no cover - unused
        pass


@st.composite
def activity_schedules(draw: st.DrawFn) -> tuple[int, list[int]]:
    """Generate ``(baseline_ms, activity_times_ms)`` with a connected chain.

    Each activity arrives within ``[1, TIMEOUT_MS - 1]`` ms of the previous one
    (the first within that window of the baseline), so every activity refreshes
    ``last_seen`` before the prior window expires and therefore postpones the
    timeout rather than letting it fire early. The list may be empty (immediate
    silence from the baseline).
    """
    baseline = draw(st.integers(min_value=0, max_value=5_000))
    gaps = draw(
        st.lists(
            st.integers(min_value=1, max_value=TIMEOUT_MS - 1),
            min_size=0,
            max_size=12,
        )
    )
    activities: list[int] = []
    t = baseline
    for gap in gaps:
        t += gap
        activities.append(t)
    return baseline, activities


# Feature: gc-chart-platform, Property 31: NT_AddOn connection times out as disconnected after 15s of silence
@pytest.mark.property
@given(schedule=activity_schedules())
def test_property_31_connection_times_out_after_15s_silence(
    schedule: tuple[int, list[int]],
) -> None:
    baseline, activities = schedule
    loop = VirtualLoop(start_ms=baseline)
    if activities:
        loop.schedule_activity(*activities)
    events: list[ChartStatusEvent] = []
    endpoint = _make_endpoint(loop, events)

    # Baseline liveness from connection establishment (as run() seeds it), so
    # the first window is measured from the baseline, not the first frame.
    endpoint.note_activity(baseline)

    asyncio.run(endpoint.status_timeout_loop())

    # Exactly one disconnected status, carrying the timeout reason. (Req 4.8)
    assert len(events) == 1
    evt = events[0]
    assert evt.state is StatusState.DISCONNECTED
    assert evt.reason == TIMEOUT_DISCONNECTED_REASON

    # The window restarts from the most recent activity (or the baseline when
    # there was none): the timeout fires exactly 15s after it. (Req 4.7, 4.8)
    last_activity = activities[-1] if activities else baseline
    assert evt.time == last_activity + TIMEOUT_MS

    # Activity within the window prevents the baseline-deadline timeout: with at
    # least one refresh the disconnect is pushed strictly past baseline+15s.
    if activities:
        assert evt.time > baseline + TIMEOUT_MS

    # The connection resources were released exactly once. (Req 4.8)
    assert endpoint.released is True

    # A second handling pass is a no-op: still a single emitted disconnect,
    # proving the "exactly one" guarantee is latched. (Req 4.8)
    asyncio.run(endpoint._handle_timeout(evt.time + 1))
    assert len(events) == 1
