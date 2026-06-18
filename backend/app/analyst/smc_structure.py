"""Confirmed-swing SMC structure maps for the POI analyst."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from ..storage.records import BarRecord

EXTERNAL_SWING_LENGTH = 50
M1_INTERNAL_SWING_LENGTH = 5


@dataclass(frozen=True, slots=True)
class ConfirmedSwing:
    kind: str
    price: float
    time: int
    index: int


def build_htf_structure_map(
    timeframe: str,
    bars: Sequence[BarRecord],
    *,
    swing_length: int = EXTERNAL_SWING_LENGTH,
) -> dict[str, Any]:
    """Return external structure for H1/M15/M5 using confirmed swings only."""
    ordered = _closed_bars(bars)
    swings = _confirmed_swings(ordered, swing_length)
    external = _external_structure(swings, swing_length=swing_length)
    return {
        "timeframe": timeframe,
        "structureMap": {
            "external": {
                "enabled": True,
                "swingLength": swing_length,
                **external,
            },
            "internal": {
                "enabled": False,
                "reason": "disabled_for_this_timeframe",
            },
        },
        "breakEvents": _break_events(ordered, swings, external, scope="external"),
    }


def build_m1_structure_map(
    bars: Sequence[BarRecord],
    *,
    active_poi_side: str | None = None,
    poi_touched: bool = False,
    enabled: bool = True,
    swing_length: int = M1_INTERNAL_SWING_LENGTH,
) -> dict[str, Any]:
    """Return M1 internal structure for entry timing after POI touch only."""
    ordered = _closed_bars(bars)
    if not enabled:
        internal: dict[str, Any] = {
            "enabled": False,
            "reason": "disabled_by_config",
        }
        break_events = _empty_break_events(scope="none")
    elif not poi_touched:
        internal = {
            "enabled": True,
            "swingLength": swing_length,
            "usedFor": "entry_timing_only",
            "onlyAfterPoiTouch": True,
            "canAffectBias": False,
            "swingSequence": [],
            "trendPattern": "unknown",
            "triggerState": "not_confirmed",
        }
        break_events = _empty_break_events(scope="none")
    else:
        swings = _confirmed_swings(ordered, swing_length)
        structure = _external_structure(swings, swing_length=swing_length)
        break_events = _break_events(ordered, swings, structure, scope="internal")
        trigger_state = _trigger_state(
            active_poi_side=active_poi_side,
            trend_pattern=str(structure["trendPattern"]),
            break_events=break_events,
        )
        internal = {
            "enabled": True,
            "swingLength": swing_length,
            "usedFor": "entry_timing_only",
            "onlyAfterPoiTouch": True,
            "canAffectBias": False,
            "swingSequence": structure["swingSequence"],
            "trendPattern": structure["trendPattern"],
            "triggerState": trigger_state,
        }
    return {
        "timeframe": "M1",
        "structureMap": {
            "external": {
                "enabled": False,
                "reason": "M1 external structure not used for bias in phase 1",
            },
            "internal": internal,
        },
        "breakEvents": break_events,
    }


def _closed_bars(bars: Sequence[BarRecord]) -> list[BarRecord]:
    return [bar for bar in sorted(bars, key=lambda b: b.time) if bar.closed]


def _confirmed_swings(
    bars: Sequence[BarRecord],
    swing_length: int,
) -> list[ConfirmedSwing]:
    length = max(1, int(swing_length))
    if len(bars) < length * 2 + 1:
        return []
    swings: list[ConfirmedSwing] = []
    for index in range(length, len(bars) - length):
        bar = bars[index]
        left = bars[index - length : index]
        right = bars[index + 1 : index + 1 + length]
        high = float(bar.high)
        low = float(bar.low)
        if high > max(float(b.high) for b in left) and high >= max(
            float(b.high) for b in right
        ):
            swings.append(ConfirmedSwing("high", high, bar.time, index))
        if low < min(float(b.low) for b in left) and low <= min(
            float(b.low) for b in right
        ):
            swings.append(ConfirmedSwing("low", low, bar.time, index))
    return sorted(swings, key=lambda swing: (swing.index, 0 if swing.kind == "low" else 1))


def _external_structure(
    swings: Sequence[ConfirmedSwing],
    *,
    swing_length: int,
) -> dict[str, Any]:
    highs = [s for s in swings if s.kind == "high"]
    lows = [s for s in swings if s.kind == "low"]
    sequence = _swing_sequence(swings)
    last_high = highs[-1] if highs else None
    last_low = lows[-1] if lows else None
    trend = _trend_pattern(highs, lows)
    if trend == "HH_HL":
        structure = "bullish"
    elif trend == "LH_LL":
        structure = "bearish"
    elif trend == "mixed":
        structure = "range"
    else:
        structure = "unknown"
    return {
        "swingSequence": sequence[-8:],
        "trendPattern": trend,
        "structure": structure,
        "lastSwingHigh": None if last_high is None else last_high.price,
        "lastSwingLow": None if last_low is None else last_low.price,
        "protectedHigh": None if last_high is None else last_high.price,
        "protectedLow": None if last_low is None else last_low.price,
        "confirmedSwingCount": len(swings),
    }


def _swing_sequence(swings: Sequence[ConfirmedSwing]) -> list[str]:
    prev_high: ConfirmedSwing | None = None
    prev_low: ConfirmedSwing | None = None
    labels: list[str] = []
    for swing in swings:
        if swing.kind == "high":
            if prev_high is None:
                label = "H"
            elif swing.price > prev_high.price:
                label = "HH"
            elif swing.price < prev_high.price:
                label = "LH"
            else:
                label = "EH"
            prev_high = swing
        else:
            if prev_low is None:
                label = "L"
            elif swing.price > prev_low.price:
                label = "HL"
            elif swing.price < prev_low.price:
                label = "LL"
            else:
                label = "EL"
            prev_low = swing
        if label in {"HH", "HL", "LH", "LL"}:
            labels.append(label)
    return labels


def _trend_pattern(
    highs: Sequence[ConfirmedSwing],
    lows: Sequence[ConfirmedSwing],
) -> str:
    if len(highs) < 2 or len(lows) < 2:
        return "unknown"
    high_up = highs[-1].price > highs[-2].price
    low_up = lows[-1].price > lows[-2].price
    high_down = highs[-1].price < highs[-2].price
    low_down = lows[-1].price < lows[-2].price
    if high_up and low_up:
        return "HH_HL"
    if high_down and low_down:
        return "LH_LL"
    return "mixed"


def _break_events(
    bars: Sequence[BarRecord],
    swings: Sequence[ConfirmedSwing],
    structure: dict[str, Any],
    *,
    scope: str,
) -> dict[str, Any]:
    if not bars:
        return _empty_break_events(scope="none")
    close = float(bars[-1].close)
    highs = [s for s in swings if s.kind == "high"]
    lows = [s for s in swings if s.kind == "low"]
    trend = str(structure.get("structure", "unknown"))
    last_bos = _empty_break_event(scope="none")
    last_choch = _empty_break_event(scope="none")

    if len(highs) >= 2:
        level = highs[-2].price
        if close > level:
            event = _break_event("bullish", level, scope)
            if trend == "bullish":
                last_bos = event
            else:
                last_choch = event
    if len(lows) >= 2:
        level = lows[-2].price
        if close < level:
            event = _break_event("bearish", level, scope)
            if trend == "bearish":
                last_bos = event
            else:
                last_choch = event

    return {"lastBos": last_bos, "lastChoch": last_choch}


def _trigger_state(
    *,
    active_poi_side: str | None,
    trend_pattern: str,
    break_events: dict[str, Any],
) -> str:
    if active_poi_side == "demand":
        if trend_pattern == "HH_HL" and _event_direction(break_events, "lastBos") == "bullish":
            return "confirmed_trigger"
        if _event_direction(break_events, "lastChoch") == "bullish":
            return "early_shift"
    if active_poi_side == "supply":
        if trend_pattern == "LH_LL" and _event_direction(break_events, "lastBos") == "bearish":
            return "confirmed_trigger"
        if _event_direction(break_events, "lastChoch") == "bearish":
            return "early_shift"
    return "not_confirmed"


def _event_direction(break_events: dict[str, Any], key: str) -> str:
    event = break_events.get(key)
    if not isinstance(event, dict):
        return "none"
    return str(event.get("direction", "none"))


def _empty_break_events(*, scope: str) -> dict[str, Any]:
    return {
        "lastBos": _empty_break_event(scope=scope),
        "lastChoch": _empty_break_event(scope=scope),
    }


def _empty_break_event(*, scope: str) -> dict[str, Any]:
    return {
        "direction": "none",
        "level": None,
        "scope": scope,
        "confirmedByClose": False,
    }


def _break_event(direction: str, level: float, scope: str) -> dict[str, Any]:
    return {
        "direction": direction,
        "level": float(level),
        "scope": scope,
        "confirmedByClose": True,
    }
