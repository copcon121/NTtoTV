"""Loopback-only Bookmap realtime market-data websocket."""

from __future__ import annotations

import json
import logging
import asyncio
from dataclasses import dataclass, field
from uuid import uuid4

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..models import NormalizedTrade, Side
from ..liquidity_settings import liquidity_control_frame, load_liquidity_settings

logger = logging.getLogger(__name__)

router = APIRouter()
_LOOPBACK_HOSTS = {"127.0.0.1", "::1", "localhost", "testclient"}


class BookmapControl:
    """Owns the current loopback bridge socket for backend-to-addon controls."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._websocket: WebSocket | None = None
        self._connection_id: str | None = None

    async def bind(self, websocket: WebSocket, connection_id: str) -> None:
        async with self._lock:
            self._websocket = websocket
            self._connection_id = connection_id

    async def unbind(self, connection_id: str) -> None:
        async with self._lock:
            if self._connection_id == connection_id:
                self._websocket = None
                self._connection_id = None

    async def send_liquidity_settings(self, settings: dict[str, bool | int]) -> bool:
        async with self._lock:
            websocket = self._websocket
            if websocket is None:
                return False
            try:
                await websocket.send_json(liquidity_control_frame(settings))
            except Exception:
                logger.warning("/ws/bookmap: failed to send liquidity config", exc_info=True)
                return False
            return True


def get_bookmap_control(app) -> BookmapControl:
    control = getattr(app.state, "bookmap_control", None)
    if control is None:
        control = BookmapControl()
        app.state.bookmap_control = control
    return control


@dataclass(slots=True)
class _SequenceTracker:
    highest: dict[tuple[str, str, str], int] = field(default_factory=dict)

    def evaluate(self, payload: dict) -> tuple[bool, bool]:
        channel = str(payload.get("type") or "")
        alias = str(payload.get("alias") or payload.get("sourceContract") or "")
        source = str(payload.get("source") or "bookmap")
        sequence = int(payload["sequence"])
        key = (source, alias, channel)
        previous = self.highest.get(key)
        if previous is None:
            self.highest[key] = sequence
            return True, False
        if sequence <= previous:
            return False, False
        self.highest[key] = sequence
        return True, sequence > previous + 1


@router.websocket("/ws/bookmap")
async def ws_bookmap(websocket: WebSocket) -> None:
    host = None if websocket.client is None else websocket.client.host
    if host not in _LOOPBACK_HOSTS:
        await websocket.close(code=1008, reason="loopback only")
        return
    await websocket.accept()
    runtime = getattr(websocket.app.state, "runtime", None)
    if runtime is None:
        await websocket.close(code=1013, reason="runtime unavailable")
        return

    pipeline = runtime.pipeline
    connection_id = uuid4().hex
    control = get_bookmap_control(websocket.app)
    sequences = _SequenceTracker()
    await control.bind(websocket, connection_id)
    await pipeline.on_bookmap_connect(connection_id)
    await control.send_liquidity_settings(load_liquidity_settings(runtime.cache))
    try:
        while True:
            raw = await websocket.receive_text()
            if not pipeline.is_current_bookmap_connection(connection_id):
                await websocket.close(code=1000, reason="superseded")
                return
            try:
                payload = json.loads(raw)
                if not isinstance(payload, dict):
                    raise ValueError("frame must be an object")
                accepted, gap = sequences.evaluate(payload)
                if not accepted:
                    continue
                if gap and payload.get("type") != "trade":
                    pipeline.note_bookmap_sequence_gap()
                await _dispatch(pipeline, payload, connection_id=connection_id)
            except (KeyError, TypeError, ValueError) as exc:
                logger.warning("/ws/bookmap: discarded frame: %s", exc)
    except WebSocketDisconnect:
        pass
    finally:
        await control.unbind(connection_id)
        await pipeline.on_bookmap_disconnect(connection_id)


async def _dispatch(pipeline, payload: dict, *, connection_id: str | None = None) -> None:
    frame_type = payload.get("type")
    if frame_type == "heartbeat":
        await pipeline.on_bookmap_heartbeat(payload, connection_id=connection_id)
        return
    if frame_type == "bar":
        await pipeline.on_bookmap_bar(payload, connection_id=connection_id)
        return
    if frame_type == "liquidity":
        await pipeline.on_bookmap_liquidity(payload, connection_id=connection_id)
        return
    if frame_type != "trade":
        raise ValueError(f"unknown frame type {frame_type!r}")

    side = Side.SELL if bool(payload.get("isBidAggressor")) is False else Side.BUY
    raw_side = payload.get("side")
    if raw_side is not None:
        side = Side(str(raw_side))
    event_nanos = payload.get("timeNanos")
    trade = NormalizedTrade(
        symbol=str(payload.get("symbol") or "GC"),
        contract=str(payload["contract"]),
        time=int(payload["time"]),
        price=float(payload["price"]),
        volume=int(payload["volume"]),
        bid=None,
        ask=None,
        best_bid=None,
        best_ask=None,
        sequence=int(payload["sequence"]),
        source="bookmap",
        source_time_nanos=None if event_nanos is None else int(event_nanos),
        bridge_time=(
            None if payload.get("bridgeTime") is None else int(payload["bridgeTime"])
        ),
        side=side,
        aggressor_order_id=(
            None
            if payload.get("aggressorOrderId") is None
            else str(payload["aggressorOrderId"])
        ),
        passive_order_id=(
            None
            if payload.get("passiveOrderId") is None
            else str(payload["passiveOrderId"])
        ),
        execution_start=bool(payload.get("executionStart", False)),
        execution_end=bool(payload.get("executionEnd", False)),
        otc=bool(payload.get("otc", False)),
    )
    await pipeline.on_bookmap_trade(trade, connection_id=connection_id)
