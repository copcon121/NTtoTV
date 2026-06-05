"""Ingestion: the `/ws/nt` endpoint and the sequence validator.

Accepts the NT_AddOn WebSocket connection, receives normalized trade/quote/
status/heartbeat frames, validates per-Stream sequences (dedup / out-of-order /
gap), records raw ticks before throttling, drives the control plane, and runs
the NT connection liveness watchdog. (Requirements 4)
"""

from __future__ import annotations

from .control_plane import (
    ACTIVE_CONTRACT_REASON,
    ChartStatusBroadcaster,
    ControlCommandSender,
    ControlPlaneCoordinator,
    NeededContractSource,
    plan_control_commands,
)
from .coordinator import (
    GAP_DEGRADED_REASON,
    QUOTE_CHANNEL,
    TRADE_CHANNEL,
    DegradedStatusEmitter,
    IngestionCoordinator,
)
from .sequence_validator import (
    SeqDecision,
    SeqOutcome,
    SequenceValidator,
    StreamId,
)

__all__ = [
    "SeqDecision",
    "SeqOutcome",
    "SequenceValidator",
    "StreamId",
    "IngestionCoordinator",
    "DegradedStatusEmitter",
    "TRADE_CHANNEL",
    "QUOTE_CHANNEL",
    "GAP_DEGRADED_REASON",
    "ControlPlaneCoordinator",
    "plan_control_commands",
    "ControlCommandSender",
    "ChartStatusBroadcaster",
    "NeededContractSource",
    "ACTIVE_CONTRACT_REASON",
]
