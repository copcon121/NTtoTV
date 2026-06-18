"""Dataclasses for the event-driven POI analyst."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ..models.timestamp import CanonicalTimestamp

POI_EVENT_TYPES: frozenset[str] = frozenset(
    {
        "price_entered_poi",
        "poi_invalidated",
    }
)

POI_STATUSES: frozenset[str] = frozenset(
    {
        "active",
        "approaching",
        "inside",
        "reacting",
        "triggered",
        "invalidated",
        "expired",
    }
)


@dataclass(frozen=True, slots=True)
class PoiZone:
    zone_id: str
    symbol: str
    contract: str
    timeframe: str
    side: str
    kind: str
    top: float
    bottom: float
    mid: float
    created_at: CanonicalTimestamp
    status: str
    pd_zone: str
    bias_aligned: bool
    distance_to_price: float
    contains_price: bool
    touch_count: int = 0
    last_touched_at: CanonicalTimestamp | None = None
    last_state_change_at: CanonicalTimestamp | None = None
    last_event_at: CanonicalTimestamp | None = None
    confluence: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "zoneId": self.zone_id,
            "symbol": self.symbol,
            "contract": self.contract,
            "timeframe": self.timeframe,
            "side": self.side,
            "kind": self.kind,
            "top": self.top,
            "bottom": self.bottom,
            "mid": self.mid,
            "createdAt": self.created_at,
            "status": self.status,
            "pdZone": self.pd_zone,
            "biasAligned": self.bias_aligned,
            "distanceToPrice": self.distance_to_price,
            "containsPrice": self.contains_price,
            "touchCount": self.touch_count,
            "lastTouchedAt": self.last_touched_at,
            "lastStateChangeAt": self.last_state_change_at,
            "lastEventAt": self.last_event_at,
            "confluence": self.confluence,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "PoiZone":
        return cls(
            zone_id=str(data["zoneId"]),
            symbol=str(data["symbol"]),
            contract=str(data["contract"]),
            timeframe=str(data["timeframe"]),
            side=str(data["side"]),
            kind=str(data["kind"]),
            top=float(data["top"]),
            bottom=float(data["bottom"]),
            mid=float(data["mid"]),
            created_at=int(data["createdAt"]),
            status=str(data["status"]),
            pd_zone=str(data.get("pdZone", "unknown")),
            bias_aligned=bool(data.get("biasAligned", False)),
            distance_to_price=float(data.get("distanceToPrice", 0.0)),
            contains_price=bool(data.get("containsPrice", False)),
            touch_count=int(data.get("touchCount", 0)),
            last_touched_at=_optional_int(data.get("lastTouchedAt")),
            last_state_change_at=_optional_int(data.get("lastStateChangeAt")),
            last_event_at=_optional_int(data.get("lastEventAt")),
            confluence=dict(data.get("confluence", {})),
        )


@dataclass(frozen=True, slots=True)
class PoiEvent:
    event_id: str
    zone_id: str
    event_type: str
    symbol: str
    contract: str
    snapshot_time: CanonicalTimestamp
    input_snapshot: dict[str, Any]
    provider_name: str
    provider_mode: str
    response: dict[str, Any] | None
    decision: str | None
    confidence: float | None
    allowed_to_auto_trade: bool
    error: str | None
    latency_ms: int | None
    deduped: bool
    created_at: CanonicalTimestamp

    def to_dict(self) -> dict[str, Any]:
        active = self.input_snapshot.get("activePoi", {})
        return {
            "eventId": self.event_id,
            "zoneId": self.zone_id,
            "eventType": self.event_type,
            "symbol": self.symbol,
            "contract": self.contract,
            "timeframe": active.get("timeframe"),
            "side": active.get("side"),
            "kind": active.get("kind"),
            "top": active.get("top"),
            "bottom": active.get("bottom"),
            "decision": self.decision,
            "confidence": self.confidence,
            "createdAt": self.created_at,
            "snapshotTime": self.snapshot_time,
            "providerName": self.provider_name,
            "providerMode": self.provider_mode,
            "deduped": self.deduped,
            "error": self.error,
            "allowedToAutoTrade": False,
            "response": self.response,
            "inputSnapshot": self.input_snapshot,
        }


def _optional_int(value: Any) -> int | None:
    if value is None:
        return None
    return int(value)
