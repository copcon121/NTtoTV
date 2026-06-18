"""Cross-timeframe POI confluence scoring."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from .poi_models import PoiZone


def build_confluence(
    active: PoiZone,
    zones: Sequence[PoiZone],
    *,
    current_price: float | None,
    min_overlap_ratio: float = 0.25,
    tick_size: float = 0.1,
    midpoint_tolerance_ticks: int = 2,
) -> dict[str, Any]:
    matches: list[dict[str, Any]] = []
    cluster_top = active.top
    cluster_bottom = active.bottom
    tolerance = tick_size * midpoint_tolerance_ticks
    for zone in zones:
        if zone.zone_id == active.zone_id:
            continue
        if zone.side != active.side:
            continue
        if zone.status in {"invalidated", "expired"}:
            continue
        ratio = _overlap_ratio_of_smaller(active, zone)
        if ratio < min_overlap_ratio:
            continue
        if not _midpoint_valid(active, zone, tolerance=tolerance):
            continue
        cluster_top = min(cluster_top, zone.top)
        cluster_bottom = max(cluster_bottom, zone.bottom)
        matches.append(
            {
                "zoneId": zone.zone_id,
                "timeframe": zone.timeframe,
                "side": zone.side,
                "kind": zone.kind,
                "top": zone.top,
                "bottom": zone.bottom,
                "overlapRatioOfSmaller": ratio,
                "sameKind": zone.kind == active.kind,
            }
        )

    if not matches:
        return {
            "level": "none",
            "score": 0,
            "overlappingZones": [],
            "clusterTop": None,
            "clusterBottom": None,
            "priceRelation": "unknown" if current_price is None else "far",
        }

    timeframes = {active.timeframe, *(str(m["timeframe"]) for m in matches)}
    same_kind = any(bool(m["sameKind"]) for m in matches)
    price_relation = _price_relation(
        current_price,
        cluster_top=cluster_top,
        cluster_bottom=cluster_bottom,
        tick_size=tick_size,
    )
    score = 25 + 15 * (len(timeframes) - 1)
    if same_kind:
        score += 15
    if price_relation == "inside":
        score += 20
    elif price_relation == "near":
        score += 10
    if active.bias_aligned:
        score += 10
    score = min(100, score)
    if score >= 70:
        level = "strong"
    elif score >= 45:
        level = "moderate"
    else:
        level = "weak"
    return {
        "level": level,
        "score": score,
        "overlappingZones": [
            {
                "zoneId": active.zone_id,
                "timeframe": active.timeframe,
                "side": active.side,
                "kind": active.kind,
                "top": active.top,
                "bottom": active.bottom,
                "overlapRatioOfSmaller": 1.0,
                "sameKind": True,
            },
            *matches,
        ],
        "clusterTop": cluster_top,
        "clusterBottom": cluster_bottom,
        "priceRelation": price_relation,
    }


def _overlap_ratio_of_smaller(a: PoiZone, b: PoiZone) -> float:
    overlap = min(a.top, b.top) - max(a.bottom, b.bottom)
    if overlap <= 0:
        return 0.0
    smaller_width = min(max(a.top - a.bottom, 0.0), max(b.top - b.bottom, 0.0))
    if smaller_width <= 0:
        return 0.0
    return float(overlap / smaller_width)


def _midpoint_valid(a: PoiZone, b: PoiZone, *, tolerance: float) -> bool:
    larger, smaller = (a, b)
    if (b.top - b.bottom) > (a.top - a.bottom):
        larger, smaller = (b, a)
    return larger.bottom - tolerance <= smaller.mid <= larger.top + tolerance


def _price_relation(
    price: float | None,
    *,
    cluster_top: float,
    cluster_bottom: float,
    tick_size: float,
) -> str:
    if price is None:
        return "unknown"
    if cluster_bottom <= price <= cluster_top:
        return "inside"
    distance = cluster_bottom - price if price < cluster_bottom else price - cluster_top
    return "near" if distance <= tick_size * 8 else "far"
