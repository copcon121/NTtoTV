"""`/ws/chart` Frontend streaming endpoint (tasks 8.1, 8.5, 20.1).

Registers a Frontend client on the process :class:`~app.registry.registry.WebSocketRegistry`
(owned by the lifespan :class:`~app.runtime.AppRuntime`), forwards
subscribe/unsubscribe requests to the registry's per-client subscription state
(Req 5.4, 5.5), and records ``pong`` frames for the heartbeat watchdog (Req
6.2). Outbound events are delivered by the registry's throttled coalescing flush
loop via the client's injected ``send`` callable. (Req 5.1, 5.2, 5.3)

When no runtime is attached (lightweight tests that only assemble routes), the
endpoint degrades to a drain loop so the route stays importable and connectable.
"""

from __future__ import annotations

import logging
from itertools import count

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..models.messages import Pong, Subscribe, Unsubscribe, decode_chart_client_message
from .registry import ChartClient

logger = logging.getLogger(__name__)

router = APIRouter()

# Process-wide monotonic client-id source for /ws/chart connections.
_client_ids = count(1)


@router.websocket("/ws/chart")
async def ws_chart(websocket: WebSocket) -> None:
    """Register a Frontend client and stream subscribed events. (Req 5.1, 5.4, 5.5)"""
    await websocket.accept()

    runtime = getattr(websocket.app.state, "runtime", None)
    if runtime is None:
        # No runtime (route-only test harness): drain frames until disconnect.
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            return
        return

    registry = runtime.registry
    client_id = f"chart-{next(_client_ids)}"

    async def _send(payload: dict) -> None:
        await websocket.send_json(payload)

    async def _close() -> None:
        await websocket.close()

    client = ChartClient(client_id, _send, _close)
    await registry.register(client)
    logger.info("/ws/chart: registered %s", client_id)
    try:
        while True:
            raw = await websocket.receive_text()
            await _handle_client_frame(registry, client_id, raw)
    except WebSocketDisconnect:
        return
    finally:
        await registry.unregister(client_id)
        logger.info("/ws/chart: unregistered %s", client_id)


async def _handle_client_frame(registry, client_id: str, raw: str) -> None:
    """Decode and apply one `/ws/chart` client frame. Never raises upward."""
    import json

    try:
        data = json.loads(raw)
        message = decode_chart_client_message(data)
    except (ValueError, KeyError, TypeError) as exc:
        logger.warning("/ws/chart: discarding undecodable frame: %s", exc)
        return

    if isinstance(message, Subscribe):
        await registry.subscribe(
            client_id, message.symbol, message.events, timeframe=message.tf
        )
    elif isinstance(message, Unsubscribe):
        await registry.unsubscribe(
            client_id,
            message.events,
            symbol=message.symbol,
            timeframe=message.tf,
        )
    elif isinstance(message, Pong):
        registry.note_pong(client_id)
