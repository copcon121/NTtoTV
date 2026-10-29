"""Compact detected iceberg state; quantities describe executions, not reserves."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, ClassVar


@dataclass(slots=True, frozen=True)
class IcebergUpdate:
    type: ClassVar[str] = "iceberg_update"

    symbol: str
    contract: str
    source_contract: str
    session_id: str
    order_id: str
    side: str
    price: float
    time: int
    first_seen_time: int
    detected_time: int
    last_trade_time: int | None
    end_time: int | None
    executed_volume: int
    displayed_size: int
    refill_count: int
    status: str
    detection_reason: str
    sequence: int

    def __post_init__(self) -> None:
        if self.side not in {"buy", "sell"}:
            raise ValueError("iceberg side must be the passive buy/sell side")
        if self.status not in {"active", "executed", "canceled", "invalidated"}:
            raise ValueError("invalid iceberg status")
        if self.detection_reason not in {"overfill", "refill"}:
            raise ValueError("invalid native iceberg detection reason")
        if not self.session_id or not self.order_id or not self.source_contract:
            raise ValueError("iceberg requires a session, source contract and order ID")
        if not math.isfinite(self.price) or self.price <= 0:
            raise ValueError("invalid iceberg price")
        if min(self.executed_volume, self.displayed_size, self.refill_count) < 0:
            raise ValueError("iceberg quantities must be non-negative")
        if self.sequence < 1:
            raise ValueError("iceberg sequence must be positive")

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "symbol": self.symbol,
            "contract": self.contract,
            "source": "rithmic",
            "sourceContract": self.source_contract,
            "sessionId": self.session_id,
            "orderId": self.order_id,
            "side": self.side,
            "price": self.price,
            "time": self.time,
            "firstSeenTime": self.first_seen_time,
            "detectedTime": self.detected_time,
            "lastTradeTime": self.last_trade_time,
            "endTime": self.end_time,
            "executedVolume": self.executed_volume,
            "displayedSize": self.displayed_size,
            "refillCount": self.refill_count,
            "status": self.status,
            "detectionReason": self.detection_reason,
            "sequence": self.sequence,
            "method": "native",
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "IcebergUpdate":
        if data.get("type") != cls.type or data.get("source") != "rithmic":
            raise ValueError("expected a direct Rithmic iceberg update")
        if data.get("method") != "native":
            raise ValueError("expected native iceberg detection")
        return cls(
            symbol=str(data["symbol"]), contract=str(data["contract"]),
            source_contract=str(data["sourceContract"]),
            session_id=str(data["sessionId"]), order_id=str(data["orderId"]),
            side=str(data["side"]), price=float(data["price"]), time=int(data["time"]),
            first_seen_time=int(data["firstSeenTime"]),
            detected_time=int(data["detectedTime"]),
            last_trade_time=(None if data.get("lastTradeTime") is None else int(data["lastTradeTime"])),
            end_time=(None if data.get("endTime") is None else int(data["endTime"])),
            executed_volume=int(data["executedVolume"]),
            displayed_size=int(data["displayedSize"]), refill_count=int(data["refillCount"]),
            status=str(data["status"]), detection_reason=str(data["detectionReason"]),
            sequence=int(data["sequence"]),
        )
