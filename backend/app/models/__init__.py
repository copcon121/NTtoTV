"""Canonical data models and WebSocket message schemas.

Home for `NormalizedTrade`, `NormalizedQuote`, `Side`, the Canonical_Timestamp
helpers, and the typed serializers/deserializers for all `/ws/nt` and
`/ws/chart` message types. (Tasks 2.1, 2.3)
"""

from __future__ import annotations

from .canonical import NormalizedQuote, NormalizedTrade, Side
from .messages import (
    AlertEvent,
    BarUpdate,
    BigTrade,
    ChartStatusEvent,
    ControlAction,
    ControlCommand,
    EventType,
    FootprintRow,
    FootprintUpdate,
    ImbalanceSide,
    NTStatusEvent,
    OHLCVBar,
    Ping,
    Pong,
    QuoteUpdate,
    StackedImbalance,
    StatusState,
    Subscribe,
    UnfinishedAuction,
    Unsubscribe,
    VolumeDeltaUpdate,
    decode_chart_client_message,
    decode_nt_data_message,
    quote_from_dict,
    quote_to_dict,
    trade_from_dict,
    trade_to_dict,
)
from .timestamp import (
    CanonicalTimestamp,
    MS_PER_SECOND,
    compare,
    earliest,
    from_canonical_ms,
    from_iso8601,
    is_after,
    is_before,
    is_same_instant,
    latest,
    now_ms,
    to_canonical_ms,
    to_iso8601,
)

__all__ = [
    # Canonical models (Task 2.1)
    "NormalizedTrade",
    "NormalizedQuote",
    "Side",
    # Canonical_Timestamp helpers (Task 2.1)
    "CanonicalTimestamp",
    "MS_PER_SECOND",
    "now_ms",
    "to_canonical_ms",
    "from_canonical_ms",
    "to_iso8601",
    "from_iso8601",
    "compare",
    "is_before",
    "is_after",
    "is_same_instant",
    "earliest",
    "latest",
    # WebSocket message enums (Task 2.3)
    "StatusState",
    "ControlAction",
    "ImbalanceSide",
    "EventType",
    # /ws/nt data plane (Task 2.3)
    "trade_to_dict",
    "trade_from_dict",
    "quote_to_dict",
    "quote_from_dict",
    "NTStatusEvent",
    # /ws/nt control plane (Task 2.3)
    "ControlCommand",
    # /ws/chart client -> backend (Task 2.3)
    "Subscribe",
    "Unsubscribe",
    "Pong",
    # /ws/chart backend -> client (Task 2.3)
    "OHLCVBar",
    "BarUpdate",
    "QuoteUpdate",
    "VolumeDeltaUpdate",
    "FootprintRow",
    "StackedImbalance",
    "UnfinishedAuction",
    "FootprintUpdate",
    "BigTrade",
    "AlertEvent",
    "ChartStatusEvent",
    "Ping",
    # Inbound dispatchers (Task 2.3)
    "decode_nt_data_message",
    "decode_chart_client_message",
]
