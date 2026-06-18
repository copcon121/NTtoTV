"""Build compact analyst snapshots from the chart cache."""

from __future__ import annotations

from typing import Any

from ..models.timestamp import now_ms
from ..storage.cache_store import CacheStore
from ..storage.records import BarRecord
from .cvd_state import build_cvd_state
from .schemas import CvdState, MarketStateSnapshot, SmcState, SmcZone
from .smc_state import build_smc_state, build_smc_zones

TIMEFRAME_MAP: tuple[tuple[str, str, int], ...] = (
    ("H1", "1h", 240),
    ("M15", "15m", 240),
    ("M5", "5m", 300),
)


class SnapshotBuilder:
    """Read cached chart state and produce one compact market snapshot."""

    def __init__(
        self,
        cache: CacheStore,
        *,
        symbol: str = "GC",
        contract: str = "GC",
    ) -> None:
        self._cache = cache
        self._symbol = symbol
        self._contract = contract

    def build(self, snapshot_time: int | None = None) -> MarketStateSnapshot:
        ts = now_ms() if snapshot_time is None else int(snapshot_time)
        data_quality: list[str] = []
        timeframes: dict[str, dict[str, Any]] = {}

        for label, tf, limit in TIMEFRAME_MAP:
            bars = self._cache.read_bars(
                self._symbol, self._contract, tf, limit=limit
            )
            deltas = self._cache.read_volume_delta(
                self._symbol, self._contract, tf, limit=limit
            )
            if not bars:
                data_quality.append(f"missing_bars_{label}")
            if not deltas:
                data_quality.append(f"missing_cvd_{label}")

            smc = build_smc_state(label, bars)
            zones, zone_context = build_smc_zones(label, bars)
            zone_summary = _zone_summary(zones, _latest_close(bars))
            smc_payload = smc.to_dict()
            smc_payload["zones"] = zone_summary["importantZones"]
            smc_payload["zoneContext"] = zone_context
            smc_payload["zoneSummary"] = zone_summary
            cvd = build_cvd_state(label, deltas, bars)
            timeframes[label] = {
                "tf": tf,
                "price": _price_context(bars),
                "smc": smc_payload,
                "cvd": cvd.to_dict(),
            }

        decision_context = _decision_context(timeframes, data_quality)
        return MarketStateSnapshot(
            snapshot_id=f"{self._symbol}:{self._contract}:{ts}",
            symbol=self._symbol,
            contract=self._contract,
            snapshot_time=ts,
            timeframes=timeframes,
            decision_context=decision_context,
            data_quality=tuple(data_quality),
        )


def _price_context(bars: list[BarRecord]) -> dict[str, Any]:
    if not bars:
        return {
            "last": None,
            "change": 0.0,
            "bars": 0,
        }
    ordered = sorted(bars, key=lambda b: b.time)
    first = ordered[0]
    last = ordered[-1]
    return {
        "last": last.close,
        "change": float(last.close) - float(first.close),
        "bars": len(ordered),
        "lastBarTime": last.time,
    }


def _latest_close(bars: list[BarRecord]) -> float | None:
    if not bars:
        return None
    return float(sorted(bars, key=lambda b: b.time)[-1].close)


def _zone_summary(
    zones: list[SmcZone],
    last_price: float | None,
) -> dict[str, Any]:
    ordered = sorted(zones, key=lambda zone: zone.distance_to_price)
    containing = _first_zone([zone for zone in ordered if zone.contains_price])
    nearest = _first_zone(ordered)
    nearest_bullish = _first_zone(
        [zone for zone in ordered if zone.direction == "bullish"]
    )
    nearest_bearish = _first_zone(
        [zone for zone in ordered if zone.direction == "bearish"]
    )
    support = None
    resistance = None
    if last_price is not None:
        support = _first_zone(
            sorted(
                [zone for zone in zones if zone.top <= last_price],
                key=lambda zone: last_price - zone.top,
            )
        )
        resistance = _first_zone(
            sorted(
                [zone for zone in zones if zone.bottom >= last_price],
                key=lambda zone: zone.bottom - last_price,
            )
        )
    important = _select_important_zones(
        containing,
        nearest,
        nearest_bullish,
        nearest_bearish,
        support,
        resistance,
        limit=3,
    )
    return {
        "containingZone": None if containing is None else containing.to_dict(),
        "nearestZone": None if nearest is None else nearest.to_dict(),
        "nearestBullishZone": (
            None if nearest_bullish is None else nearest_bullish.to_dict()
        ),
        "nearestBearishZone": (
            None if nearest_bearish is None else nearest_bearish.to_dict()
        ),
        "nearestSupport": None if support is None else support.to_dict(),
        "nearestResistance": None if resistance is None else resistance.to_dict(),
        "importantZones": [zone.to_dict() for zone in important],
    }


def _first_zone(zones: list[SmcZone]) -> SmcZone | None:
    return zones[0] if zones else None


def _select_important_zones(
    *zones: SmcZone | None,
    limit: int,
) -> list[SmcZone]:
    selected: list[SmcZone] = []
    seen: set[tuple[object, ...]] = set()
    for zone in zones:
        if zone is None:
            continue
        key = (
            zone.timeframe,
            zone.kind,
            zone.direction,
            zone.pd_kind,
            round(zone.top, 4),
            round(zone.bottom, 4),
        )
        if key in seen:
            continue
        seen.add(key)
        selected.append(zone)
        if len(selected) >= limit:
            break
    return selected


def _decision_context(
    timeframes: dict[str, dict[str, Any]],
    data_quality: list[str],
) -> dict[str, Any]:
    h1 = _smc(timeframes, "H1")
    m15 = _smc(timeframes, "M15")
    m5 = _smc(timeframes, "M5")
    h1_cvd = _cvd(timeframes, "H1")
    m15_cvd = _cvd(timeframes, "M15")
    m5_cvd = _cvd(timeframes, "M5")

    preferred_side = _preferred_side(h1)
    conflicts: list[str] = []
    score = 0

    if preferred_side in {"buy", "sell"}:
        score += 25
    if _aligned(preferred_side, m15):
        score += 20
    elif preferred_side in {"buy", "sell"} and _opposes(preferred_side, m15):
        conflicts.append("H1_vs_M15_structure_conflict")

    if _aligned(preferred_side, m5):
        score += 15
    elif preferred_side in {"buy", "sell"} and _opposes(preferred_side, m5):
        conflicts.append("H1_vs_M5_structure_conflict")

    if "confirming_structure" in h1_cvd.flags:
        score += 10
    if "confirming_structure" in m15_cvd.flags:
        score += 10
    if "confirming_structure" in m5_cvd.flags:
        score += 10
    if _has_any_flag(timeframes, "divergence_with_price"):
        conflicts.append("cvd_price_divergence")
    if any(item.startswith("missing_") for item in data_quality):
        conflicts.append("incomplete_market_state")

    if _has_recent_event(m15):
        score += 10
    if _has_recent_event(m5):
        score += 5
    if not conflicts:
        score += 10

    score = max(0, min(100, score))
    blocking_conflict = any(
        item
        in {
            "H1_vs_M15_structure_conflict",
            "H1_vs_M5_structure_conflict",
            "incomplete_market_state",
        }
        for item in conflicts
    )
    if score >= 60 and not blocking_conflict:
        risk_state = "wait"
    else:
        risk_state = "no_trade"

    return {
        "preferredSide": preferred_side,
        "qualityScore": score,
        "conflicts": conflicts,
        "riskState": risk_state,
        "allowedToAutoTrade": False,
    }


def _smc(timeframes: dict[str, dict[str, Any]], label: str) -> SmcState:
    return SmcState.from_dict(timeframes[label]["smc"])


def _cvd(timeframes: dict[str, dict[str, Any]], label: str) -> CvdState:
    return CvdState.from_dict(timeframes[label]["cvd"])


def _preferred_side(state: SmcState) -> str:
    if state.bias == "bullish":
        return "buy"
    if state.bias == "bearish":
        return "sell"
    return "neutral"


def _aligned(preferred_side: str, state: SmcState) -> bool:
    return (
        preferred_side == "buy"
        and state.bias == "bullish"
        or preferred_side == "sell"
        and state.bias == "bearish"
    )


def _opposes(preferred_side: str, state: SmcState) -> bool:
    return (
        preferred_side == "buy"
        and state.bias == "bearish"
        or preferred_side == "sell"
        and state.bias == "bullish"
    )


def _has_recent_event(state: SmcState) -> bool:
    return state.last_event in {"BOS", "CHoCH"}


def _has_any_flag(timeframes: dict[str, dict[str, Any]], flag: str) -> bool:
    for data in timeframes.values():
        cvd = CvdState.from_dict(data["cvd"])
        if flag in cvd.flags:
            return True
    return False
