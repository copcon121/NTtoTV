"""Canonical in-memory / wire models for the Backend.

Defines the normalized Rithmic market-data records that flow into the engines
and storage layer, plus the ``Side``
classification enum used by VolumeDelta and BigTrade.

All ``time`` fields are a Canonical_Timestamp: an integer number of
milliseconds since the Unix epoch in UTC (see ``app.models.timestamp``).
(Requirements 1.1, 1.2)
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from .timestamp import CanonicalTimestamp

__all__ = ["Side", "NormalizedTrade", "NormalizedQuote"]


class Side(str, Enum):
    """Buy/sell trade classification.

    A ``str``-valued enum so members serialize to the wire/storage literals
    ``"buy"`` / ``"sell"`` (matching the design's ``Side = Literal["buy",
    "sell"]`` representation) while still being a first-class enum for
    classification logic. (Requirements 13.2, 13.3, 15.2)
    """

    BUY = "buy"
    SELL = "sell"

    def __str__(self) -> str:  # pragma: no cover - cosmetic
        return self.value


@dataclass(slots=True)
class NormalizedTrade:
    """A normalized Level 1 trade event. (Requirement 1.1)

    Contains type (implicit), symbol, contract, time, price, volume, bid, ask,
    bestBid, bestAsk, and sequence. ``bid``/``ask``/``best_bid``/``best_ask``
    may be ``None`` when no snapshot is available. ``time_ticks`` optionally
    carries a source feed's original high-resolution timestamp for components,
    such as BigTrade reconstruction, that must preserve sub-millisecond
    timestamp equality.
    """

    symbol: str
    contract: str
    time: CanonicalTimestamp  # Canonical_Timestamp (ms since epoch UTC)
    price: float
    volume: int
    bid: float | None
    ask: float | None
    best_bid: float | None
    best_ask: float | None
    sequence: int
    time_ticks: int | None = None
    source: str = "rithmic"
    source_time_nanos: int | None = None
    bridge_time: int | None = None
    received_at: int | None = None
    side: Side | None = None
    aggressor_order_id: str | None = None
    passive_order_id: str | None = None
    execution_start: bool = False
    execution_end: bool = False
    otc: bool = False


@dataclass(slots=True)
class NormalizedQuote:
    """A normalized Level 1 quote event. (Requirement 1.2)

    Contains type (implicit), symbol, contract, time, bid, ask, bidSize,
    askSize, and sequence.
    """

    symbol: str
    contract: str
    time: CanonicalTimestamp  # Canonical_Timestamp (ms since epoch UTC)
    bid: float
    ask: float
    bid_size: int
    ask_size: int
    sequence: int
    source: str = "rithmic"
    bridge_time: int | None = None
    received_at: int | None = None
