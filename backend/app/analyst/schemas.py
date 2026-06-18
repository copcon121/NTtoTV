"""Typed payloads for the isolated analyst feature."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ..models.timestamp import CanonicalTimestamp

ANALYST_DECISIONS: frozenset[str] = frozenset(
    {
        "no_trade",
        "wait_for_buy",
        "wait_for_sell",
        "buy_candidate",
        "sell_candidate",
    }
)


@dataclass(frozen=True, slots=True)
class CvdState:
    timeframe: str
    status: str
    cumulative: int
    recent_delta: int
    previous_delta: int
    slope: int
    bars: int
    flags: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        return {
            "timeframe": self.timeframe,
            "status": self.status,
            "cumulative": self.cumulative,
            "recentDelta": self.recent_delta,
            "previousDelta": self.previous_delta,
            "slope": self.slope,
            "bars": self.bars,
            "flags": list(self.flags),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "CvdState":
        return cls(
            timeframe=str(data["timeframe"]),
            status=str(data["status"]),
            cumulative=int(data["cumulative"]),
            recent_delta=int(data["recentDelta"]),
            previous_delta=int(data["previousDelta"]),
            slope=int(data["slope"]),
            bars=int(data["bars"]),
            flags=tuple(str(v) for v in data.get("flags", [])),
        )


@dataclass(frozen=True, slots=True)
class SmcState:
    timeframe: str
    bias: str
    structure: str
    last_event: str
    last_direction: str
    last_level: float | None
    bars: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "timeframe": self.timeframe,
            "bias": self.bias,
            "structure": self.structure,
            "lastEvent": self.last_event,
            "lastDirection": self.last_direction,
            "lastLevel": self.last_level,
            "bars": self.bars,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "SmcState":
        raw_level = data.get("lastLevel")
        return cls(
            timeframe=str(data["timeframe"]),
            bias=str(data["bias"]),
            structure=str(data["structure"]),
            last_event=str(data["lastEvent"]),
            last_direction=str(data["lastDirection"]),
            last_level=None if raw_level is None else float(raw_level),
            bars=int(data["bars"]),
        )


@dataclass(frozen=True, slots=True)
class SmcZone:
    timeframe: str
    kind: str
    label: str
    direction: str
    top: float
    bottom: float
    mid: float
    distance_to_price: float
    contains_price: bool
    start_time: CanonicalTimestamp
    end_time: CanonicalTimestamp | None = None
    scope: str = "swing"
    pd_kind: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "timeframe": self.timeframe,
            "kind": self.kind,
            "label": self.label,
            "direction": self.direction,
            "scope": self.scope,
            "pdKind": self.pd_kind,
            "top": self.top,
            "bottom": self.bottom,
            "mid": self.mid,
            "distanceToPrice": self.distance_to_price,
            "containsPrice": self.contains_price,
            "startTime": self.start_time,
            "endTime": self.end_time,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "SmcZone":
        raw_end = data.get("endTime")
        return cls(
            timeframe=str(data["timeframe"]),
            kind=str(data["kind"]),
            label=str(data["label"]),
            direction=str(data["direction"]),
            top=float(data["top"]),
            bottom=float(data["bottom"]),
            mid=float(data["mid"]),
            distance_to_price=float(data["distanceToPrice"]),
            contains_price=bool(data["containsPrice"]),
            start_time=int(data["startTime"]),
            end_time=None if raw_end is None else int(raw_end),
            scope=str(data.get("scope", "swing")),
            pd_kind=None if data.get("pdKind") is None else str(data["pdKind"]),
        )


@dataclass(frozen=True, slots=True)
class MarketStateSnapshot:
    snapshot_id: str
    symbol: str
    contract: str
    snapshot_time: CanonicalTimestamp
    timeframes: dict[str, dict[str, Any]]
    decision_context: dict[str, Any]
    data_quality: tuple[str, ...] = ()
    source: str = "cache"

    def to_dict(self) -> dict[str, Any]:
        return {
            "snapshotId": self.snapshot_id,
            "symbol": self.symbol,
            "contract": self.contract,
            "snapshotTime": self.snapshot_time,
            "timeframes": self.timeframes,
            "decisionContext": self.decision_context,
            "dataQuality": list(self.data_quality),
            "source": self.source,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "MarketStateSnapshot":
        return cls(
            snapshot_id=str(data["snapshotId"]),
            symbol=str(data["symbol"]),
            contract=str(data["contract"]),
            snapshot_time=int(data["snapshotTime"]),
            timeframes=dict(data["timeframes"]),
            decision_context=dict(data["decisionContext"]),
            data_quality=tuple(str(v) for v in data.get("dataQuality", [])),
            source=str(data.get("source", "cache")),
        )


@dataclass(frozen=True, slots=True)
class AnalystReport:
    report_id: str
    snapshot_id: str
    symbol: str
    contract: str
    created_at: CanonicalTimestamp
    bias: str
    decision: str
    confidence: float
    reason: tuple[str, ...]
    invalid_if: str
    next_confirmation: str
    risk_state: str
    allowed_to_alert: bool
    allowed_to_auto_trade: bool = False
    raw_response: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "reportId": self.report_id,
            "snapshotId": self.snapshot_id,
            "symbol": self.symbol,
            "contract": self.contract,
            "createdAt": self.created_at,
            "bias": self.bias,
            "decision": self.decision,
            "confidence": self.confidence,
            "reason": list(self.reason),
            "invalidIf": self.invalid_if,
            "nextConfirmation": self.next_confirmation,
            "riskState": self.risk_state,
            "allowedToAlert": self.allowed_to_alert,
            "allowedToAutoTrade": False,
            "rawResponse": self.raw_response,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "AnalystReport":
        decision = str(data["decision"])
        if decision not in ANALYST_DECISIONS:
            raise ValueError(f"unknown analyst decision: {decision!r}")
        return cls(
            report_id=str(data["reportId"]),
            snapshot_id=str(data["snapshotId"]),
            symbol=str(data["symbol"]),
            contract=str(data["contract"]),
            created_at=int(data["createdAt"]),
            bias=str(data["bias"]),
            decision=decision,
            confidence=float(data["confidence"]),
            reason=tuple(str(v) for v in data["reason"]),
            invalid_if=str(data["invalidIf"]),
            next_confirmation=str(data["nextConfirmation"]),
            risk_state=str(data["riskState"]),
            allowed_to_alert=bool(data["allowedToAlert"]),
            allowed_to_auto_trade=False,
            raw_response=dict(data.get("rawResponse", {})),
        )
