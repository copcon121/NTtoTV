"""Registry: the WebSocket_Registry and the `/ws/chart` endpoint.

Registers Frontend clients, manages per-client subscriptions, coalesces and
flushes updates every 100-125ms, sends heartbeat pings every 30s, drops clients
with no pong within 60s, and isolates per-client broadcast failures.
(Requirements 5, 6, 20)
"""

from __future__ import annotations

from .registry import (
    ChartClient,
    CloseCallable,
    OutboundEvent,
    SendCallable,
    WebSocketRegistry,
    coalescing_subkey,
)

__all__ = [
    "ChartClient",
    "CloseCallable",
    "OutboundEvent",
    "SendCallable",
    "WebSocketRegistry",
    "coalescing_subkey",
]
