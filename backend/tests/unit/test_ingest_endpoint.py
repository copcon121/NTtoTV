"""Unit tests for the `/ws/nt` ingestion endpoint (task 6.1).

Example-based coverage of the connection accept + receive loop, frame decode
dispatch to injectable handlers (trade/quote/status/heartbeat), the outbound
``send_control`` channel, and ``last_seen`` refresh via ``note_activity``.

Async coroutines are driven with ``asyncio.run`` against a ``FakeWebSocket``
double (no network / no live socket), so the tests exercise the real dispatch
and lifecycle logic.

Covers Requirements 4.1 (accept + receive trade/quote/status/heartbeat) and
4.7 (``last_seen`` refreshed on every received frame).
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

import pytest
from fastapi import WebSocketDisconnect

from app.ingest.endpoint import HEARTBEAT_TYPE, IngestEndpoint, IngestHandlers
from app.models.canonical import NormalizedQuote, NormalizedTrade
from app.models.messages import (
    ControlAction,
    ControlCommand,
    NTStatusEvent,
    StatusState,
    quote_to_dict,
    trade_to_dict,
)


class FakeWebSocket:
    """Minimal in-memory WebSocket double for the ingestion receive loop.

    ``receive_text`` yields each queued frame in order, then raises
    ``WebSocketDisconnect`` to terminate ``IngestEndpoint.run``. Accepted state
    and ``send_json`` payloads are recorded for assertions.
    """

    def __init__(self, frames: list[str]) -> None:
        self._frames = list(frames)
        self.accepted = False
        self.sent: list[dict[str, Any]] = []

    async def accept(self) -> None:
        self.accepted = True

    async def receive_text(self) -> str:
        if self._frames:
            return self._frames.pop(0)
        raise WebSocketDisconnect()

    async def send_json(self, payload: dict[str, Any]) -> None:
        self.sent.append(payload)


def _trade(sequence: int = 1, time: int = 1_730_000_000_000) -> NormalizedTrade:
    return NormalizedTrade(
        symbol="GC",
        contract="GC 08-26",
        time=time,
        price=2345.6,
        volume=3,
        bid=2345.5,
        ask=2345.7,
        best_bid=2345.5,
        best_ask=2345.7,
        sequence=sequence,
    )


def _quote(sequence: int = 2, time: int = 1_730_000_000_100) -> NormalizedQuote:
    return NormalizedQuote(
        symbol="GC",
        contract="GC 08-26",
        time=time,
        bid=2345.5,
        ask=2345.7,
        bid_size=12,
        ask_size=9,
        sequence=sequence,
    )


# --- accept + receive loop ----------------------------------------------------


@pytest.mark.unit
def test_run_accepts_connection():
    ws = FakeWebSocket(frames=[])
    endpoint = IngestEndpoint(ws)

    asyncio.run(endpoint.run())

    assert ws.accepted is True


@pytest.mark.unit
def test_dispatches_trade_quote_and_status_to_handlers():
    trades: list[NormalizedTrade] = []
    quotes: list[NormalizedQuote] = []
    statuses: list[NTStatusEvent] = []

    status_frame = json.dumps(
        NTStatusEvent(
            source="nt_addon", state=StatusState.CONNECTED, time=1_730_000_000_200
        ).to_dict()
    )
    frames = [
        json.dumps(trade_to_dict(_trade())),
        json.dumps(quote_to_dict(_quote())),
        status_frame,
    ]
    ws = FakeWebSocket(frames)
    endpoint = IngestEndpoint(
        ws,
        IngestHandlers(
            on_trade=trades.append,
            on_quote=quotes.append,
            on_status=statuses.append,
        ),
    )

    asyncio.run(endpoint.run())

    assert [t.sequence for t in trades] == [1]
    assert [q.sequence for q in quotes] == [2]
    assert [s.state for s in statuses] == [StatusState.CONNECTED]


@pytest.mark.unit
def test_async_handlers_are_awaited():
    trades: list[NormalizedTrade] = []

    async def on_trade(t: NormalizedTrade) -> None:
        trades.append(t)

    ws = FakeWebSocket([json.dumps(trade_to_dict(_trade()))])
    endpoint = IngestEndpoint(ws, IngestHandlers(on_trade=on_trade))

    asyncio.run(endpoint.run())

    assert len(trades) == 1


@pytest.mark.unit
def test_heartbeat_frame_dispatched_to_heartbeat_handler():
    beats: list[dict[str, Any]] = []
    frame = json.dumps({"type": HEARTBEAT_TYPE, "time": 1_730_000_000_300})
    ws = FakeWebSocket([frame])
    endpoint = IngestEndpoint(ws, IngestHandlers(on_heartbeat=beats.append))

    asyncio.run(endpoint.run())

    assert beats == [{"type": HEARTBEAT_TYPE, "time": 1_730_000_000_300}]


@pytest.mark.unit
def test_missing_handlers_drain_without_error():
    # No handlers supplied: frames are decoded and drained, run completes.
    frames = [
        json.dumps(trade_to_dict(_trade())),
        json.dumps({"type": HEARTBEAT_TYPE, "time": 1}),
    ]
    ws = FakeWebSocket(frames)
    endpoint = IngestEndpoint(ws)

    asyncio.run(endpoint.run())  # must not raise

    assert ws.accepted is True


@pytest.mark.unit
def test_malformed_and_unknown_frames_are_skipped_not_fatal():
    trades: list[NormalizedTrade] = []
    frames = [
        "not-json",  # non-JSON
        json.dumps([1, 2, 3]),  # JSON but not an object
        json.dumps({"type": "bogus"}),  # unknown type
        json.dumps(trade_to_dict(_trade(sequence=7))),  # valid follows
    ]
    ws = FakeWebSocket(frames)
    endpoint = IngestEndpoint(ws, IngestHandlers(on_trade=trades.append))

    asyncio.run(endpoint.run())

    # The bad frames are skipped; the trailing valid trade still dispatches.
    assert [t.sequence for t in trades] == [7]


# --- last_seen / note_activity ------------------------------------------------


@pytest.mark.unit
def test_last_seen_is_none_before_any_frame():
    endpoint = IngestEndpoint(FakeWebSocket([]))
    assert endpoint.last_seen is None


@pytest.mark.unit
def test_last_seen_refreshed_on_every_frame_via_injected_clock():
    ticks = iter([1000, 2000, 3000])
    frames = [
        json.dumps(trade_to_dict(_trade())),
        json.dumps(quote_to_dict(_quote())),
        json.dumps({"type": HEARTBEAT_TYPE, "time": 1}),
    ]
    ws = FakeWebSocket(frames)
    endpoint = IngestEndpoint(ws, clock=lambda: next(ticks))

    asyncio.run(endpoint.run())

    # last_seen reflects the clock value at the final received frame. (Req 4.7)
    assert endpoint.last_seen == 3000


@pytest.mark.unit
def test_note_activity_sets_last_seen_directly():
    endpoint = IngestEndpoint(FakeWebSocket([]))
    endpoint.note_activity(12_345)
    assert endpoint.last_seen == 12_345


@pytest.mark.unit
def test_last_seen_refreshed_even_for_undecodable_frame():
    # Activity is recorded on receipt, before decode, so liveness is preserved
    # even when a frame can't be decoded. (Req 4.7)
    ws = FakeWebSocket(["not-json"])
    endpoint = IngestEndpoint(ws, clock=lambda: 555)

    asyncio.run(endpoint.run())

    assert endpoint.last_seen == 555


# --- send_control -------------------------------------------------------------


@pytest.mark.unit
def test_send_control_serializes_command_to_socket():
    ws = FakeWebSocket([])
    endpoint = IngestEndpoint(ws)
    cmd = ControlCommand(
        action=ControlAction.SUBSCRIBE, contract="GC 10-26", time=1_730_000_000_400
    )

    asyncio.run(endpoint.send_control(cmd))

    assert ws.sent == [
        {
            "type": "control",
            "action": "subscribe",
            "contract": "GC 10-26",
            "time": 1_730_000_000_400,
        }
    ]
