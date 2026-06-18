"""Deterministic POI zone construction for the event scanner."""

from __future__ import annotations

from collections.abc import Sequence
from hashlib import sha1
from typing import Any

from ..models.timestamp import now_ms
from ..storage.records import BarRecord
from .poi_models import PoiZone
from .schemas import SmcZone
from .smc_state import build_smc_zones

POI_TIMEFRAMES: tuple[tuple[str, str, int], ...] = (
    ("H1", "1h", 240),
    ("M15", "15m", 240),
    ("M5", "5m", 300),
)

POI_KINDS = {"ob", "fvg", "supply_demand", "other"}


def build_poi_zones(
    *,
    symbol: str,
    contract: str,
    timeframe: str,
    bars: Sequence[BarRecord],
    structure: dict[str, Any],
    current_price: float | None,
    tick_size: float = 0.1,
    previous: dict[str, PoiZone] | None = None,
) -> tuple[list[PoiZone], dict[str, Any]]:
    """Build active OB/FVG POIs for one timeframe from backend logic only."""
    zones, zone_context = build_smc_zones(timeframe, bars)
    previous = previous or {}
    pd_zones = [zone for zone in zones if zone.kind == "pd"]
    pois: list[PoiZone] = []
    ts = now_ms()
    for zone in zones:
        if zone.kind not in POI_KINDS or zone.kind == "pd":
            continue
        side = _side(zone)
        if side == "unknown":
            continue
        pd_zone = _pd_zone_for_price(pd_zones, zone.mid)
        zone_id = stable_zone_id(
            symbol=symbol,
            timeframe=timeframe,
            kind=zone.kind,
            side=side,
            top=zone.top,
            bottom=zone.bottom,
            created_at=zone.start_time,
            tick_size=tick_size,
        )
        prior = previous.get(zone_id)
        distance = _distance_to_zone(current_price, zone.top, zone.bottom)
        contains = (
            False
            if current_price is None
            else zone.bottom <= current_price <= zone.top
        )
        pois.append(
            PoiZone(
                zone_id=zone_id,
                symbol=symbol,
                contract=contract,
                timeframe=timeframe,
                side=side,
                kind=zone.kind,
                top=_round_to_tick(zone.top, tick_size),
                bottom=_round_to_tick(zone.bottom, tick_size),
                mid=_round_to_tick(zone.mid, tick_size),
                created_at=zone.start_time,
                status=prior.status if prior is not None else "active",
                pd_zone=pd_zone,
                bias_aligned=_bias_aligned(side, pd_zone, structure),
                distance_to_price=distance,
                contains_price=contains,
                touch_count=0 if prior is None else prior.touch_count,
                last_touched_at=None if prior is None else prior.last_touched_at,
                last_state_change_at=(
                    ts if prior is None else prior.last_state_change_at
                ),
                last_event_at=None if prior is None else prior.last_event_at,
                confluence={} if prior is None else prior.confluence,
            )
        )
    return pois, _pd_context(pd_zones, current_price, zone_context)


def stable_zone_id(
    *,
    symbol: str,
    timeframe: str,
    kind: str,
    side: str,
    top: float,
    bottom: float,
    created_at: int,
    tick_size: float = 0.1,
) -> str:
    rounded_top = _round_to_tick(top, tick_size)
    rounded_bottom = _round_to_tick(bottom, tick_size)
    key = "|".join(
        [
            symbol,
            timeframe,
            kind,
            side,
            f"{rounded_top:.10g}",
            f"{rounded_bottom:.10g}",
            str(int(created_at)),
        ]
    )
    return sha1(key.encode("utf-8")).hexdigest()[:20]


def _side(zone: SmcZone) -> str:
    if zone.direction == "bullish":
        return "demand"
    if zone.direction == "bearish":
        return "supply"
    return "unknown"


def _bias_aligned(side: str, pd_zone: str, structure: dict[str, Any]) -> bool:
    external = structure.get("structureMap", {}).get("external", {})
    trend = str(external.get("structure", "unknown"))
    if side == "demand":
        return trend == "bullish" and pd_zone in {"discount", "unknown"}
    if side == "supply":
        return trend == "bearish" and pd_zone in {"premium", "unknown"}
    return False


def _pd_context(
    pd_zones: Sequence[SmcZone],
    current_price: float | None,
    raw_context: dict[str, object],
) -> dict[str, Any]:
    premium = _first_pd(pd_zones, "premium")
    discount = _first_pd(pd_zones, "discount")
    eq = _first_pd(pd_zones, "equilibrium")
    high = None if premium is None else premium.top
    low = None if discount is None else discount.bottom
    equilibrium = None if eq is None else eq.mid
    current = "unknown"
    if current_price is not None:
        current = _pd_zone_for_price(pd_zones, current_price)
    if current == "unknown":
        current = str(raw_context.get("currentPdZone", "unknown"))
    preferred = "unknown"
    if current in {"premium", "discount"}:
        preferred = current
    return {
        "dealingRangeHigh": high,
        "dealingRangeLow": low,
        "equilibrium": equilibrium,
        "currentZone": current,
        "preferredEntryZone": preferred,
        "isPriceInPreferredZone": None if current_price is None else current in {"premium", "discount"},
    }


def _first_pd(zones: Sequence[SmcZone], pd_kind: str) -> SmcZone | None:
    for zone in zones:
        if zone.kind == "pd" and zone.pd_kind == pd_kind:
            return zone
    return None


def _pd_zone_for_price(zones: Sequence[SmcZone], price: float) -> str:
    for zone in zones:
        if zone.kind == "pd" and zone.bottom <= price <= zone.top:
            return zone.pd_kind or "unknown"
    return "unknown"


def _distance_to_zone(price: float | None, top: float, bottom: float) -> float:
    if price is None:
        return 0.0
    if bottom <= price <= top:
        return 0.0
    if price > top:
        return float(price - top)
    return float(bottom - price)


def _round_to_tick(value: float, tick_size: float) -> float:
    size = float(tick_size) if tick_size > 0 else 0.1
    return round(round(float(value) / size) * size, 10)
