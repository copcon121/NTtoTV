"""Deterministic Scan AI detector for GC chart suggestions.

Implements levels, trendlines, Fibonacci, Elliott waves, and chart patterns
without any external LLM dependencies, running directly on OHLCV chart bars.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from typing import Any

from ..storage.records import BarRecord
from .models import (
    ALL_GROUPS,
    ALL_STATES,
    AnchorPoint,
    ScanAiRequest,
    ScanAiSuggestion,
    SuggestionGroup,
    SuggestionState,
    SuggestionStrength,
)


def _bar_time_sec(bar: BarRecord) -> int:
    return int(bar.time // 1000)


def _find_pivots(
    bars: Sequence[BarRecord], pivot_len: int = 3
) -> tuple[list[tuple[int, BarRecord]], list[tuple[int, BarRecord]]]:
    """Find swing highs and swing lows across bars."""
    highs: list[tuple[int, BarRecord]] = []
    lows: list[tuple[int, BarRecord]] = []
    n = len(bars)
    for i in range(pivot_len, n - pivot_len):
        h = bars[i].high
        l = bars[i].low
        is_high = True
        is_low = True
        for j in range(i - pivot_len, i + pivot_len + 1):
            if j == i:
                continue
            if bars[j].high >= h:
                is_high = False
            if bars[j].low <= l:
                is_low = False
            if not is_high and not is_low:
                break
        if is_high:
            highs.append((i, bars[i]))
        if is_low:
            lows.append((i, bars[i]))
    return highs, lows


def _strength_band(score: float) -> SuggestionStrength:
    if score >= 75.0:
        return "strong"
    if score >= 50.0:
        return "moderate"
    return "weak"


def detect_levels(
    bars: Sequence[BarRecord],
    tick_size: float = 0.1,
    tolerance_ticks: int = 5,
) -> list[ScanAiSuggestion]:
    """Detect horizontal Support and Resistance levels with touch analysis."""
    if len(bars) < 15:
        return []

    highs, lows = _find_pivots(bars, pivot_len=3)
    curr_price = bars[-1].close
    curr_time_sec = _bar_time_sec(bars[-1])
    tol = tolerance_ticks * tick_size
    suggestions: list[ScanAiSuggestion] = []

    # Process Resistance levels from swing highs
    high_clusters: list[list[tuple[int, BarRecord]]] = []
    for idx, bar in highs:
        placed = False
        for cluster in high_clusters:
            avg_p = sum(b.high for _, b in cluster) / len(cluster)
            if abs(bar.high - avg_p) <= tol:
                cluster.append((idx, bar))
                placed = True
                break
        if not placed:
            high_clusters.append([(idx, bar)])

    for cluster in high_clusters:
        if len(cluster) < 2:
            continue
        level_price = round(sum(b.high for _, b in cluster) / len(cluster), 2)
        touches = len(cluster)
        first_idx, first_bar = cluster[0]
        last_idx, last_bar = cluster[-1]
        first_time_sec = _bar_time_sec(first_bar)

        # Check subsequent bars for touches, bounces, or invalidation
        invalidated = False
        tested_count = 0
        in_play = abs(curr_price - level_price) <= tol

        for b in bars[first_idx:]:
            if b.close > level_price + tol:
                invalidated = True
            elif abs(b.high - level_price) <= tol and b.close < level_price:
                tested_count += 1

        state: SuggestionState
        if invalidated and curr_price > level_price:
            state = "invalidated"
        elif in_play:
            state = "in_play"
        elif tested_count > 0:
            # Check if played out (reached 2R or support)
            lowest_since = min(b.low for b in bars[last_idx:])
            if level_price - lowest_since >= 2.0 * (15 * tick_size):
                state = "played_out"
            elif len(bars) - last_idx > 200:
                state = "old"
            else:
                state = "tested"
        else:
            state = "waiting"

        base_score = min(95.0, 45.0 + touches * 15.0)
        if state == "in_play":
            base_score += 5.0
        elif state == "invalidated":
            base_score = max(30.0, base_score - 20.0)

        target = round(level_price - 30 * tick_size, 2)
        stop = round(level_price + 15 * tick_size, 2)

        suggestions.append(
            ScanAiSuggestion(
                id=f"lvl_res_{int(level_price * 10)}_{first_time_sec}",
                group="levels",
                type="resistance_level",
                name="Resistance Level",
                description=f"Resistance at {level_price:.2f} ({touches} touches)",
                state=state,
                strength=_strength_band(base_score),
                score=base_score,
                drawing_tool="horizontal_ray",
                anchors=[AnchorPoint(time=first_time_sec, price=level_price)],
                options={
                    "color": "#ef5350",
                    "lineWidth": 2 if touches >= 3 else 1,
                    "lineStyle": "dashed",
                    "text": f"Res {level_price:.1f}",
                },
                target=target,
                stop=stop,
                invalidation_price=stop,
                metrics={"touches": touches, "bounces": tested_count, "levelPrice": level_price},
                created_at=int(first_bar.time),
            )
        )

    # Process Support levels from swing lows
    low_clusters: list[list[tuple[int, BarRecord]]] = []
    for idx, bar in lows:
        placed = False
        for cluster in low_clusters:
            avg_p = sum(b.low for _, b in cluster) / len(cluster)
            if abs(bar.low - avg_p) <= tol:
                cluster.append((idx, bar))
                placed = True
                break
        if not placed:
            low_clusters.append([(idx, bar)])

    for cluster in low_clusters:
        if len(cluster) < 2:
            continue
        level_price = round(sum(b.low for _, b in cluster) / len(cluster), 2)
        touches = len(cluster)
        first_idx, first_bar = cluster[0]
        last_idx, last_bar = cluster[-1]
        first_time_sec = _bar_time_sec(first_bar)

        invalidated = False
        tested_count = 0
        in_play = abs(curr_price - level_price) <= tol

        for b in bars[first_idx:]:
            if b.close < level_price - tol:
                invalidated = True
            elif abs(b.low - level_price) <= tol and b.close > level_price:
                tested_count += 1

        state: SuggestionState
        if invalidated and curr_price < level_price:
            state = "invalidated"
        elif in_play:
            state = "in_play"
        elif tested_count > 0:
            highest_since = max(b.high for b in bars[last_idx:])
            if highest_since - level_price >= 2.0 * (15 * tick_size):
                state = "played_out"
            elif len(bars) - last_idx > 200:
                state = "old"
            else:
                state = "tested"
        else:
            state = "waiting"

        base_score = min(95.0, 45.0 + touches * 15.0)
        if state == "in_play":
            base_score += 5.0
        elif state == "invalidated":
            base_score = max(30.0, base_score - 20.0)

        target = round(level_price + 30 * tick_size, 2)
        stop = round(level_price - 15 * tick_size, 2)

        suggestions.append(
            ScanAiSuggestion(
                id=f"lvl_sup_{int(level_price * 10)}_{first_time_sec}",
                group="levels",
                type="support_level",
                name="Support Level",
                description=f"Support at {level_price:.2f} ({touches} touches)",
                state=state,
                strength=_strength_band(base_score),
                score=base_score,
                drawing_tool="horizontal_ray",
                anchors=[AnchorPoint(time=first_time_sec, price=level_price)],
                options={
                    "color": "#2ebd85",
                    "lineWidth": 2 if touches >= 3 else 1,
                    "lineStyle": "dashed",
                    "text": f"Sup {level_price:.1f}",
                },
                target=target,
                stop=stop,
                invalidation_price=stop,
                metrics={"touches": touches, "bounces": tested_count, "levelPrice": level_price},
                created_at=int(first_bar.time),
            )
        )

    return suggestions


def detect_trendlines(
    bars: Sequence[BarRecord],
    tick_size: float = 0.1,
) -> list[ScanAiSuggestion]:
    """Detect ascending support and descending resistance trendlines."""
    if len(bars) < 20:
        return []

    highs, lows = _find_pivots(bars, pivot_len=3)
    curr_price = bars[-1].close
    n = len(bars)
    suggestions: list[ScanAiSuggestion] = []

    # Ascending Support Trendlines from swing lows
    for i in range(len(lows)):
        idx1, b1 = lows[i]
        for j in range(i + 1, min(i + 4, len(lows))):
            idx2, b2 = lows[j]
            if b2.low <= b1.low or idx2 - idx1 < 10:
                continue
            slope = (b2.low - b1.low) / (idx2 - idx1)
            # Check violation between p1 and p2
            violated = False
            for k in range(idx1 + 1, idx2):
                expected = b1.low + slope * (k - idx1)
                if bars[k].close < expected - 3 * tick_size:
                    violated = True
                    break
            if violated:
                continue

            # Project to current bar
            current_expected = b1.low + slope * (n - 1 - idx1)
            t1 = _bar_time_sec(b1)
            t2 = _bar_time_sec(b2)

            state: SuggestionState
            if curr_price < current_expected - 4 * tick_size:
                state = "invalidated"
            elif abs(curr_price - current_expected) <= 4 * tick_size:
                state = "in_play"
            elif curr_price > current_expected:
                # Did price bounce recently?
                recent_low = min(b.low for b in bars[idx2:])
                if recent_low <= current_expected + 2 * tick_size:
                    state = "tested"
                else:
                    state = "waiting"
            else:
                state = "old"

            score = 65.0
            if state == "tested":
                score += 15.0
            elif state == "in_play":
                score += 10.0
            elif state == "invalidated":
                score = 40.0

            target = round(curr_price + 35 * tick_size, 2)
            stop = round(current_expected - 15 * tick_size, 2)

            suggestions.append(
                ScanAiSuggestion(
                    id=f"line_sup_{t1}_{t2}",
                    group="lines",
                    type="support_trendline",
                    name="Support Trendline",
                    description=f"Ascending trendline from {b1.low:.1f} to {b2.low:.1f}",
                    state=state,
                    strength=_strength_band(score),
                    score=score,
                    drawing_tool="trendline",
                    anchors=[
                        AnchorPoint(time=t1, price=round(b1.low, 2)),
                        AnchorPoint(time=t2, price=round(b2.low, 2)),
                    ],
                    options={"color": "#2ebd85", "lineWidth": 2, "lineStyle": "solid"},
                    target=target,
                    stop=stop,
                    invalidation_price=stop,
                    metrics={"touches": 2, "slope": round(slope, 4)},
                    created_at=int(b1.time),
                )
            )

    # Descending Resistance Trendlines from swing highs
    for i in range(len(highs)):
        idx1, b1 = highs[i]
        for j in range(i + 1, min(i + 4, len(highs))):
            idx2, b2 = highs[j]
            if b2.high >= b1.high or idx2 - idx1 < 10:
                continue
            slope = (b2.high - b1.high) / (idx2 - idx1)
            violated = False
            for k in range(idx1 + 1, idx2):
                expected = b1.high + slope * (k - idx1)
                if bars[k].close > expected + 3 * tick_size:
                    violated = True
                    break
            if violated:
                continue

            current_expected = b1.high + slope * (n - 1 - idx1)
            t1 = _bar_time_sec(b1)
            t2 = _bar_time_sec(b2)

            state: SuggestionState
            if curr_price > current_expected + 4 * tick_size:
                state = "invalidated"
            elif abs(curr_price - current_expected) <= 4 * tick_size:
                state = "in_play"
            elif curr_price < current_expected:
                recent_high = max(b.high for b in bars[idx2:])
                if recent_high >= current_expected - 2 * tick_size:
                    state = "tested"
                else:
                    state = "waiting"
            else:
                state = "old"

            score = 65.0
            if state == "tested":
                score += 15.0
            elif state == "in_play":
                score += 10.0
            elif state == "invalidated":
                score = 40.0

            target = round(curr_price - 35 * tick_size, 2)
            stop = round(current_expected + 15 * tick_size, 2)

            suggestions.append(
                ScanAiSuggestion(
                    id=f"line_res_{t1}_{t2}",
                    group="lines",
                    type="resistance_trendline",
                    name="Resistance Trendline",
                    description=f"Descending trendline from {b1.high:.1f} to {b2.high:.1f}",
                    state=state,
                    strength=_strength_band(score),
                    score=score,
                    drawing_tool="trendline",
                    anchors=[
                        AnchorPoint(time=t1, price=round(b1.high, 2)),
                        AnchorPoint(time=t2, price=round(b2.high, 2)),
                    ],
                    options={"color": "#ef5350", "lineWidth": 2, "lineStyle": "solid"},
                    target=target,
                    stop=stop,
                    invalidation_price=stop,
                    metrics={"touches": 2, "slope": round(slope, 4)},
                    created_at=int(b1.time),
                )
            )

    return suggestions


def detect_fibonacci(
    bars: Sequence[BarRecord],
) -> list[ScanAiSuggestion]:
    """Detect primary swing Fibonacci retracement and extensions."""
    if len(bars) < 30:
        return []

    # Find global max and min in current window
    max_bar = max(bars, key=lambda b: b.high)
    min_bar = min(bars, key=lambda b: b.low)
    curr_price = bars[-1].close
    suggestions: list[ScanAiSuggestion] = []

    diff = max_bar.high - min_bar.low
    if diff <= 1.0:
        return []

    is_bullish = max_bar.time > min_bar.time
    # A newest-bar extreme has no subsequent retracement to evaluate yet.
    if (max_bar if is_bullish else min_bar).time >= bars[-1].time:
        return []
    t_min = _bar_time_sec(min_bar)
    t_max = _bar_time_sec(max_bar)

    if is_bullish:
        # Retracement down from high towards low
        # Level prices
        fib_50 = max_bar.high - 0.5 * diff
        fib_618 = max_bar.high - 0.618 * diff
        fib_ext_1272 = min_bar.low + 1.272 * diff
        fib_ext_1618 = min_bar.low + 1.618 * diff

        state: SuggestionState
        if curr_price < min_bar.low:
            state = "invalidated"
        elif curr_price >= fib_ext_1272:
            state = "played_out"
        elif fib_618 <= curr_price <= fib_50:
            state = "in_play"
        elif curr_price > fib_50:
            # Check if tested golden pocket earlier
            if min((b.low for b in bars if b.time > max_bar.time), default=math.inf) <= fib_618:
                state = "tested"
            else:
                state = "waiting"
        else:
            state = "in_play"

        score = 80.0 if state in ("in_play", "tested") else 65.0
        suggestions.append(
            ScanAiSuggestion(
                id=f"fib_retrace_bull_{t_min}_{t_max}",
                group="fibonacci",
                type="fib_retracement",
                name="Fibonacci Retracement",
                description=f"Bullish impulse Fib (0.50: {fib_50:.1f}, 0.618: {fib_618:.1f})",
                state=state,
                strength=_strength_band(score),
                score=score,
                drawing_tool="fib_retracement",
                anchors=[
                    AnchorPoint(time=t_min, price=round(min_bar.low, 2)),
                    AnchorPoint(time=t_max, price=round(max_bar.high, 2)),
                ],
                options={
                    "color": "#35d6b0",
                    "fibLevels": [
                        {"value": 0.0, "color": "#787b86", "enabled": True},
                        {"value": 0.236, "color": "#f23645", "enabled": True},
                        {"value": 0.382, "color": "#ff9800", "enabled": True},
                        {"value": 0.5, "color": "#4caf50", "enabled": True},
                        {"value": 0.618, "color": "#089981", "enabled": True},
                        {"value": 0.786, "color": "#00bcd4", "enabled": True},
                        {"value": 1.0, "color": "#787b86", "enabled": True},
                        {"value": 1.618, "color": "#2962ff", "enabled": True},
                    ],
                },
                target=round(fib_ext_1272, 2),
                stop=round(min_bar.low - 5 * 0.1, 2),
                invalidation_price=round(min_bar.low, 2),
                metrics={
                    "pattern": "Bullish Retracement",
                    "impulse": round(diff, 2),
                    "startPrice": round(min_bar.low, 2),
                    "endPrice": round(max_bar.high, 2),
                },
                created_at=int(min_bar.time),
            )
        )
    else:
        # Bearish impulse down from high towards low
        fib_50 = min_bar.low + 0.5 * diff
        fib_618 = min_bar.low + 0.618 * diff
        fib_ext_1272 = max_bar.high - 1.272 * diff

        state = "waiting"
        if curr_price > max_bar.high:
            state = "invalidated"
        elif curr_price <= fib_ext_1272:
            state = "played_out"
        elif fib_50 <= curr_price <= fib_618:
            state = "in_play"
        elif curr_price < fib_50:
            if max((b.high for b in bars if b.time > min_bar.time), default=-math.inf) >= fib_618:
                state = "tested"
            else:
                state = "waiting"
        else:
            state = "in_play"

        score = 80.0 if state in ("in_play", "tested") else 65.0
        suggestions.append(
            ScanAiSuggestion(
                id=f"fib_retrace_bear_{t_max}_{t_min}",
                group="fibonacci",
                type="fib_retracement",
                name="Fibonacci Retracement",
                description=f"Bearish impulse Fib (0.50: {fib_50:.1f}, 0.618: {fib_618:.1f})",
                state=state,
                strength=_strength_band(score),
                score=score,
                drawing_tool="fib_retracement",
                anchors=[
                    AnchorPoint(time=t_max, price=round(max_bar.high, 2)),
                    AnchorPoint(time=t_min, price=round(min_bar.low, 2)),
                ],
                options={"color": "#ef5350"},
                target=round(fib_ext_1272, 2),
                stop=round(max_bar.high + 5 * 0.1, 2),
                invalidation_price=round(max_bar.high, 2),
                metrics={
                    "pattern": "Bearish Retracement",
                    "impulse": round(diff, 2),
                    "startPrice": round(max_bar.high, 2),
                    "endPrice": round(min_bar.low, 2),
                },
                created_at=int(max_bar.time),
            )
        )

    return suggestions


def detect_patterns(
    bars: Sequence[BarRecord],
    tick_size: float = 0.1,
) -> list[ScanAiSuggestion]:
    """Detect chart patterns: Head & Shoulders, Double Top/Bottom, Triangles, Flags."""
    if len(bars) < 25:
        return []

    highs, lows = _find_pivots(bars, pivot_len=3)
    curr_price = bars[-1].close
    suggestions: list[ScanAiSuggestion] = []

    # 1. Double Top (M-pattern)
    for i in range(len(highs)):
        idx1, b1 = highs[i]
        for j in range(i + 1, min(i + 4, len(highs))):
            idx2, b2 = highs[j]
            if idx2 - idx1 < 5 or idx2 - idx1 > 60:
                continue
            if abs(b1.high - b2.high) <= 6 * tick_size:
                # Find trough in between
                trough_bar = min(bars[idx1 : idx2 + 1], key=lambda b: b.low)
                neckline = trough_bar.low
                pattern_height = max(b1.high, b2.high) - neckline
                target = round(neckline - pattern_height, 2)
                stop = round(max(b1.high, b2.high) + 10 * tick_size, 2)

                t1 = _bar_time_sec(b1)
                t_trough = _bar_time_sec(trough_bar)
                t2 = _bar_time_sec(b2)
                t_curr = _bar_time_sec(bars[-1])

                state: SuggestionState
                if curr_price <= target:
                    state = "played_out"
                elif curr_price > max(b1.high, b2.high):
                    state = "invalidated"
                elif curr_price < neckline:
                    state = "in_play"
                else:
                    state = "waiting"

                score = 75.0
                suggestions.append(
                    ScanAiSuggestion(
                        id=f"pat_dtop_{t1}_{t2}",
                        group="patterns",
                        type="double_top",
                        name="Double Top",
                        description=f"Double Top at {b1.high:.1f} (Neckline {neckline:.1f})",
                        state=state,
                        strength=_strength_band(score),
                        score=score,
                        drawing_tool="path",
                        anchors=[
                            AnchorPoint(time=t1, price=round(b1.high, 2)),
                            AnchorPoint(time=t_trough, price=round(neckline, 2)),
                            AnchorPoint(time=t2, price=round(b2.high, 2)),
                            AnchorPoint(time=t_curr, price=round(curr_price, 2)),
                        ],
                        options={"color": "#ef5350", "lineWidth": 2, "text": "Double Top"},
                        target=target,
                        stop=stop,
                        invalidation_price=stop,
                        metrics={
                            "pattern": "Double Top",
                            "neckline": round(neckline, 2),
                            "peakPrice": round(max(b1.high, b2.high), 2),
                        },
                        created_at=int(b1.time),
                    )
                )

    # 2. Double Bottom (W-pattern)
    for i in range(len(lows)):
        idx1, b1 = lows[i]
        for j in range(i + 1, min(i + 4, len(lows))):
            idx2, b2 = lows[j]
            if idx2 - idx1 < 5 or idx2 - idx1 > 60:
                continue
            if abs(b1.low - b2.low) <= 6 * tick_size:
                peak_bar = max(bars[idx1 : idx2 + 1], key=lambda b: b.high)
                neckline = peak_bar.high
                pattern_height = neckline - min(b1.low, b2.low)
                target = round(neckline + pattern_height, 2)
                stop = round(min(b1.low, b2.low) - 10 * tick_size, 2)

                t1 = _bar_time_sec(b1)
                t_peak = _bar_time_sec(peak_bar)
                t2 = _bar_time_sec(b2)
                t_curr = _bar_time_sec(bars[-1])

                state = "waiting"
                if curr_price >= target:
                    state = "played_out"
                elif curr_price < min(b1.low, b2.low):
                    state = "invalidated"
                elif curr_price > neckline:
                    state = "in_play"
                else:
                    state = "waiting"

                score = 75.0
                suggestions.append(
                    ScanAiSuggestion(
                        id=f"pat_dbot_{t1}_{t2}",
                        group="patterns",
                        type="double_bottom",
                        name="Double Bottom",
                        description=f"Double Bottom at {b1.low:.1f} (Neckline {neckline:.1f})",
                        state=state,
                        strength=_strength_band(score),
                        score=score,
                        drawing_tool="path",
                        anchors=[
                            AnchorPoint(time=t1, price=round(b1.low, 2)),
                            AnchorPoint(time=t_peak, price=round(neckline, 2)),
                            AnchorPoint(time=t2, price=round(b2.low, 2)),
                            AnchorPoint(time=t_curr, price=round(curr_price, 2)),
                        ],
                        options={"color": "#2ebd85", "lineWidth": 2, "text": "Double Bottom"},
                        target=target,
                        stop=stop,
                        invalidation_price=stop,
                        metrics={
                            "pattern": "Double Bottom",
                            "neckline": round(neckline, 2),
                            "troughPrice": round(min(b1.low, b2.low), 2),
                        },
                        created_at=int(b1.time),
                    )
                )

    # 3. Head & Shoulders
    for i in range(len(highs) - 2):
        idx_l, b_l = highs[i]
        idx_h, b_h = highs[i + 1]
        idx_r, b_r = highs[i + 2]
        if b_h.high > b_l.high and b_h.high > b_r.high:
            if abs(b_l.high - b_r.high) <= 0.4 * (b_h.high - b_l.high):
                trough1 = min(bars[idx_l : idx_h + 1], key=lambda b: b.low)
                trough2 = min(bars[idx_h : idx_r + 1], key=lambda b: b.low)
                neckline = (trough1.low + trough2.low) / 2.0
                target = round(neckline - (b_h.high - neckline), 2)
                stop = round(b_h.high + 10 * tick_size, 2)

                state: SuggestionState
                if curr_price <= target:
                    state = "played_out"
                elif curr_price > b_h.high:
                    state = "invalidated"
                elif curr_price < neckline:
                    state = "in_play"
                else:
                    state = "waiting"

                score = 85.0
                suggestions.append(
                    ScanAiSuggestion(
                        id=f"pat_hs_{_bar_time_sec(b_l)}_{_bar_time_sec(b_r)}",
                        group="patterns",
                        type="head_and_shoulders",
                        name="Head & Shoulders",
                        description=f"H&S (Head {b_h.high:.1f}, Neckline {neckline:.1f})",
                        state=state,
                        strength=_strength_band(score),
                        score=score,
                        drawing_tool="path",
                        anchors=[
                            AnchorPoint(time=_bar_time_sec(b_l), price=round(b_l.high, 2)),
                            AnchorPoint(time=_bar_time_sec(trough1), price=round(trough1.low, 2)),
                            AnchorPoint(time=_bar_time_sec(b_h), price=round(b_h.high, 2)),
                            AnchorPoint(time=_bar_time_sec(trough2), price=round(trough2.low, 2)),
                            AnchorPoint(time=_bar_time_sec(b_r), price=round(b_r.high, 2)),
                        ],
                        options={"color": "#ef5350", "lineWidth": 2, "text": "H&S"},
                        target=target,
                        stop=stop,
                        invalidation_price=stop,
                        metrics={
                            "pattern": "Head & Shoulders",
                            "neckline": round(neckline, 2),
                            "headPrice": round(b_h.high, 2),
                        },
                        created_at=int(b_l.time),
                    )
                )

    return suggestions


def detect_elliott_waves(
    bars: Sequence[BarRecord],
    tick_size: float = 0.1,
) -> list[ScanAiSuggestion]:
    """Detect Elliott Wave impulse (1-2-3-4-5) and corrective (A-B-C) structures on OHLCV bars.

    Validates classic cardinal rules:
      1. Wave 2 never retraces 100% or more of Wave 1.
      2. Wave 3 is never the shortest impulse wave among Waves 1, 3, and 5.
      3. Wave 4 never overlaps the price territory of Wave 1.
      4. Wave 3 must break the extreme of Wave 1.
      5. Directional alternating swing pivots with reasonable bar spacing.
    """
    if len(bars) < 20:
        return []

    highs, lows = _find_pivots(bars, pivot_len=3)
    curr_price = bars[-1].close
    suggestions: list[ScanAiSuggestion] = []

    # 1. Bullish Impulse Waves (1-2-3-4-5 Up)
    # Origin: Low0 -> High1 -> Low2 -> High3 -> Low4 -> High5
    for i0, (idx0, b0) in enumerate(lows):
        for i1 in range(len(highs)):
            idx1, b1 = highs[i1]
            if idx1 <= idx0:
                continue
            if idx1 - idx0 > 40:
                break
            h1 = b1.high - b0.low
            if h1 < 5 * tick_size:
                continue

            for i2 in range(i0 + 1, len(lows)):
                idx2, b2 = lows[i2]
                if idx2 <= idx1:
                    continue
                if idx2 - idx1 > 40:
                    break
                # Rule 1: Wave 2 never retraces >= 100% of Wave 1
                if b2.low <= b0.low or b2.low >= b1.high:
                    continue

                for i3 in range(i1 + 1, len(highs)):
                    idx3, b3 = highs[i3]
                    if idx3 <= idx2:
                        continue
                    if idx3 - idx2 > 50:
                        break
                    # Wave 3 must exceed Wave 1 high
                    if b3.high <= b1.high:
                        continue
                    h3 = b3.high - b2.low

                    for i4 in range(i2 + 1, len(lows)):
                        idx4, b4 = lows[i4]
                        if idx4 <= idx3:
                            continue
                        if idx4 - idx3 > 40:
                            break
                        # Rule 3: Wave 4 never overlaps with Wave 1 territory
                        if b4.low <= b1.high or b4.low <= b2.low or b4.low >= b3.high:
                            continue

                        for i5 in range(i3 + 1, len(highs)):
                            idx5, b5 = highs[i5]
                            if idx5 <= idx4:
                                continue
                            if idx5 - idx4 > 50:
                                break
                            # Wave 5 must be above Wave 4
                            if b5.high <= b4.low:
                                continue
                            h5 = b5.high - b4.low

                            # Rule 2: Wave 3 is NEVER the shortest of Waves 1, 3, 5
                            if h3 < h1 and h3 < h5:
                                continue

                            t0 = _bar_time_sec(b0)
                            t1 = _bar_time_sec(b1)
                            t2 = _bar_time_sec(b2)
                            t3 = _bar_time_sec(b3)
                            t4 = _bar_time_sec(b4)
                            t5 = _bar_time_sec(b5)

                            state: SuggestionState = "waiting"
                            if curr_price >= b5.high:
                                state = "played_out"
                            elif curr_price < b4.low:
                                state = "invalidated"
                            else:
                                state = "in_play"

                            score = 85.0
                            if h3 > h1 and h3 > h5:
                                score = 92.0

                            target = round(b4.low + h1, 2)
                            stop = round(b4.low - 4 * tick_size, 2)
                            invalidation = round(b1.high, 2)

                            suggestions.append(
                                ScanAiSuggestion(
                                    id=f"elliott_imp_bull_{t0}_{t5}",
                                    group="elliott",
                                    type="elliott_wave",
                                    name="Elliott Impulse (1-2-3-4-5)",
                                    description=(
                                        f"Bullish 5-wave impulse (W1 {h1:.1f}, W3 {h3:.1f}, W5 {h5:.1f})"
                                    ),
                                    state=state,
                                    strength=_strength_band(score),
                                    score=score,
                                    drawing_tool="path",
                                    anchors=[
                                        AnchorPoint(time=t0, price=round(b0.low, 2)),
                                        AnchorPoint(time=t1, price=round(b1.high, 2)),
                                        AnchorPoint(time=t2, price=round(b2.low, 2)),
                                        AnchorPoint(time=t3, price=round(b3.high, 2)),
                                        AnchorPoint(time=t4, price=round(b4.low, 2)),
                                        AnchorPoint(time=t5, price=round(b5.high, 2)),
                                    ],
                                    options={
                                        "color": "#38bdf8",
                                        "lineColor": "#38bdf8",
                                        "lineWidth": 2,
                                        "lineStyle": "solid",
                                        "anchorLabels": ["(0)", "(1)", "(2)", "(3)", "(4)", "(5)"],
                                        "text": "Elliott Impulse (1-5)",
                                    },
                                    target=target,
                                    stop=stop,
                                    invalidation_price=invalidation,
                                    metrics={
                                        "pattern": "Elliott Impulse",
                                        "direction": "bullish",
                                        "w1": round(h1, 2),
                                        "w3": round(h3, 2),
                                        "w5": round(h5, 2),
                                    },
                                    created_at=int(b0.time),
                                )
                            )

    # 2. Bearish Impulse Waves (1-2-3-4-5 Down)
    # Origin: High0 -> Low1 -> High2 -> Low3 -> High4 -> Low5
    for i0, (idx0, b0) in enumerate(highs):
        for i1 in range(len(lows)):
            idx1, b1 = lows[i1]
            if idx1 <= idx0:
                continue
            if idx1 - idx0 > 40:
                break
            h1 = b0.high - b1.low
            if h1 < 5 * tick_size:
                continue

            for i2 in range(i0 + 1, len(highs)):
                idx2, b2 = highs[i2]
                if idx2 <= idx1:
                    continue
                if idx2 - idx1 > 40:
                    break
                # Rule 1: Wave 2 never retraces >= 100% of Wave 1
                if b2.high >= b0.high or b2.high <= b1.low:
                    continue

                for i3 in range(i1 + 1, len(lows)):
                    idx3, b3 = lows[i3]
                    if idx3 <= idx2:
                        continue
                    if idx3 - idx2 > 50:
                        break
                    # Wave 3 must break Wave 1 low
                    if b3.low >= b1.low:
                        continue
                    h3 = b2.high - b3.low

                    for i4 in range(i2 + 1, len(highs)):
                        idx4, b4 = highs[i4]
                        if idx4 <= idx3:
                            continue
                        if idx4 - idx3 > 40:
                            break
                        # Rule 3: Wave 4 never overlaps with Wave 1 territory
                        if b4.high >= b1.low or b4.high >= b2.high or b4.high <= b3.low:
                            continue

                        for i5 in range(i3 + 1, len(lows)):
                            idx5, b5 = lows[i5]
                            if idx5 <= idx4:
                                continue
                            if idx5 - idx4 > 50:
                                break
                            # Wave 5 must be below Wave 4
                            if b5.low >= b4.high:
                                continue
                            h5 = b4.high - b5.low

                            # Rule 2: Wave 3 is NEVER shortest
                            if h3 < h1 and h3 < h5:
                                continue

                            t0 = _bar_time_sec(b0)
                            t1 = _bar_time_sec(b1)
                            t2 = _bar_time_sec(b2)
                            t3 = _bar_time_sec(b3)
                            t4 = _bar_time_sec(b4)
                            t5 = _bar_time_sec(b5)

                            state = "waiting"
                            if curr_price <= b5.low:
                                state = "played_out"
                            elif curr_price > b4.high:
                                state = "invalidated"
                            else:
                                state = "in_play"

                            score = 85.0
                            if h3 > h1 and h3 > h5:
                                score = 92.0

                            target = round(b4.high - h1, 2)
                            stop = round(b4.high + 4 * tick_size, 2)
                            invalidation = round(b1.low, 2)

                            suggestions.append(
                                ScanAiSuggestion(
                                    id=f"elliott_imp_bear_{t0}_{t5}",
                                    group="elliott",
                                    type="elliott_wave",
                                    name="Elliott Impulse (1-2-3-4-5)",
                                    description=(
                                        f"Bearish 5-wave impulse (W1 {h1:.1f}, W3 {h3:.1f}, W5 {h5:.1f})"
                                    ),
                                    state=state,
                                    strength=_strength_band(score),
                                    score=score,
                                    drawing_tool="path",
                                    anchors=[
                                        AnchorPoint(time=t0, price=round(b0.high, 2)),
                                        AnchorPoint(time=t1, price=round(b1.low, 2)),
                                        AnchorPoint(time=t2, price=round(b2.high, 2)),
                                        AnchorPoint(time=t3, price=round(b3.low, 2)),
                                        AnchorPoint(time=t4, price=round(b4.high, 2)),
                                        AnchorPoint(time=t5, price=round(b5.low, 2)),
                                    ],
                                    options={
                                        "color": "#f43f5e",
                                        "lineColor": "#f43f5e",
                                        "lineWidth": 2,
                                        "lineStyle": "solid",
                                        "anchorLabels": ["(0)", "(1)", "(2)", "(3)", "(4)", "(5)"],
                                        "text": "Elliott Impulse (1-5)",
                                    },
                                    target=target,
                                    stop=stop,
                                    invalidation_price=invalidation,
                                    metrics={
                                        "pattern": "Elliott Impulse",
                                        "direction": "bearish",
                                        "w1": round(h1, 2),
                                        "w3": round(h3, 2),
                                        "w5": round(h5, 2),
                                    },
                                    created_at=int(b0.time),
                                )
                            )

    # 3. Corrective ABC Waves
    # Bullish market ABC (downward zigzag after high): High0 -> LowA -> HighB -> LowC
    for i0, (idx0, b0) in enumerate(highs):
        for iA in range(len(lows)):
            idxA, bA = lows[iA]
            if idxA <= idx0 or idxA - idx0 > 35:
                continue
            waveA_len = b0.high - bA.low
            if waveA_len < 4 * tick_size:
                continue

            for iB in range(i0 + 1, len(highs)):
                idxB, bB = highs[iB]
                if idxB <= idxA or idxB - idxA > 35:
                    continue
                if bB.high >= b0.high or bB.high <= bA.low:
                    continue

                for iC in range(iA + 1, len(lows)):
                    idxC, bC = lows[iC]
                    if idxC <= idxB or idxC - idxB > 40:
                        continue
                    if bC.low >= bA.low:
                        continue

                    t0 = _bar_time_sec(b0)
                    tA = _bar_time_sec(bA)
                    tB = _bar_time_sec(bB)
                    tC = _bar_time_sec(bC)

                    score = 78.0
                    state = "in_play" if curr_price > bC.low else "played_out"
                    suggestions.append(
                        ScanAiSuggestion(
                            id=f"elliott_abc_down_{t0}_{tC}",
                            group="elliott",
                            type="elliott_wave",
                            name="Elliott Correction (A-B-C)",
                            description=f"ABC Zigzag (A {waveA_len:.1f}, C {bB.high - bC.low:.1f})",
                            state=state,
                            strength=_strength_band(score),
                            score=score,
                            drawing_tool="path",
                            anchors=[
                                AnchorPoint(time=t0, price=round(b0.high, 2)),
                                AnchorPoint(time=tA, price=round(bA.low, 2)),
                                AnchorPoint(time=tB, price=round(bB.high, 2)),
                                AnchorPoint(time=tC, price=round(bC.low, 2)),
                            ],
                            options={
                                "color": "#a855f7",
                                "lineColor": "#a855f7",
                                "lineWidth": 2,
                                "lineStyle": "solid",
                                "anchorLabels": ["(0)", "(A)", "(B)", "(C)"],
                                "text": "Elliott Correction (A-B-C)",
                            },
                            target=round(bC.low - 4 * tick_size, 2),
                            stop=round(bB.high + 4 * tick_size, 2),
                            invalidation_price=round(b0.high, 2),
                            metrics={
                                "pattern": "Elliott ABC",
                                "direction": "bearish_correction",
                            },
                            created_at=int(b0.time),
                        )
                    )

    # Deduplicate overlapping waves starting/ending at same points, keeping highest score
    seen: dict[tuple[int, int], ScanAiSuggestion] = {}
    for s in suggestions:
        t_first = s.anchors[0].time
        t_last = s.anchors[-1].time
        key = (t_first, t_last)
        if key not in seen or s.score > seen[key].score:
            seen[key] = s

    return list(seen.values())



def valid_geometry(suggestion: ScanAiSuggestion) -> bool:
    anchors = suggestion.anchors
    required = 1 if suggestion.drawing_tool == "horizontal_ray" else 2
    return len(anchors) >= required and all(
        math.isfinite(a.price) and math.isfinite(a.time) and a.time > 0
        for a in anchors
    ) and (required == 1 or len({(a.time, a.price) for a in anchors}) >= 2)


def similar_geometry(a: ScanAiSuggestion, b: ScanAiSuggestion, tick_size: float) -> bool:
    """Compare rendered geometry rather than detector IDs or anchor timestamps alone."""
    if a.drawing_tool != b.drawing_tool:
        return False
    tolerance = tick_size * 5
    if a.drawing_tool == "horizontal_ray":
        return abs(a.anchors[0].price - b.anchors[0].price) <= tolerance
    aa, bb = a.anchors, b.anchors
    if a.drawing_tool == "trendline":
        aa = sorted(aa[:2], key=lambda p: p.time)
        bb = sorted(bb[:2], key=lambda p: p.time)
        span_a, span_b = aa[1].time - aa[0].time, bb[1].time - bb[0].time
        if min(span_a, span_b) <= 0:
            return False
        start, end = max(aa[0].time, bb[0].time), min(aa[1].time, bb[1].time)
        if end - start < min(span_a, span_b) * 0.5:
            return False
        def at(points: list[AnchorPoint], time: int) -> float:
            return points[0].price + (points[1].price - points[0].price) * (
                time - points[0].time
            ) / (points[1].time - points[0].time)
        return all(abs(at(aa, t) - at(bb, t)) <= tolerance for t in (start, end))
    if a.type != b.type or len(aa) != len(bb):
        return False
    span = max(p.time for p in aa + bb) - min(p.time for p in aa + bb)
    amplitude = max(p.price for p in aa + bb) - min(p.price for p in aa + bb)
    return all(
        abs(x.time - y.time) <= max(1, span * 0.1)
        and abs(x.price - y.price) <= max(tolerance, amplitude * 0.06)
        for x, y in zip(aa, bb)
    )


def detect_triangles(
    bars: Sequence[BarRecord], tick_size: float = 0.1,
) -> list[ScanAiSuggestion]:
    """Fit converging boundaries to at least three alternating touches on each side."""
    if len(bars) < 30:
        return []
    highs, lows = _find_pivots(bars, pivot_len=3)
    # Bounded recent windows avoid fitting unrelated swings across distant sessions.
    highs = [(i, b) for i, b in highs if i >= len(bars) - 160]
    lows = [(i, b) for i, b in lows if i >= len(bars) - 160]
    suggestions: list[ScanAiSuggestion] = []

    def fit(points: list[tuple[int, BarRecord]], high: bool) -> tuple[float, float]:
        xs = [i for i, _ in points]
        ys = [b.high if high else b.low for _, b in points]
        mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
        variance = sum((x - mx) ** 2 for x in xs)
        slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / variance
        return slope, my - slope * mx

    for end in range(max(30, len(bars) - 80), len(bars), 4):
        hs = [(i, b) for i, b in highs if i <= end][-3:]
        ls = [(i, b) for i, b in lows if i <= end][-3:]
        if len(hs) < 3 or len(ls) < 3:
            continue
        touches = sorted([(i, "h") for i, _ in hs] + [(i, "l") for i, _ in ls])
        if any(x[1] == y[1] or y[0] - x[0] < 3 for x, y in zip(touches, touches[1:])):
            continue
        start, finish = touches[0][0], touches[-1][0]
        span = finish - start
        if not 24 <= span <= 140 or len(bars) - 1 - finish > span * 0.5:
            continue
        upper_slope, upper_intercept = fit(hs, True)
        lower_slope, lower_intercept = fit(ls, False)
        upper = lambda i: upper_slope * i + upper_intercept
        lower = lambda i: lower_slope * i + lower_intercept
        initial_width, final_width = upper(start) - lower(start), upper(finish) - lower(finish)
        if initial_width < 10 * tick_size or not 0.15 <= final_width / initial_width <= 0.8:
            continue
        slope_scale = initial_width / span
        flat = slope_scale * 0.06
        if abs(upper_slope) <= flat and lower_slope > slope_scale * 0.15:
            kind, name = "ascending_triangle", "Ascending Triangle"
        elif abs(lower_slope) <= flat and upper_slope < -slope_scale * 0.15:
            kind, name = "descending_triangle", "Descending Triangle"
        elif upper_slope < -slope_scale * 0.12 and lower_slope > slope_scale * 0.12:
            kind, name = "symmetrical_triangle", "Symmetrical Triangle"
        else:
            continue
        apex = (upper_intercept - lower_intercept) / (lower_slope - upper_slope)
        if not finish + span * 0.1 <= apex <= finish + span * 1.5 or apex <= len(bars) - 1:
            continue
        tolerance = max(2 * tick_size, initial_width * 0.10)
        residuals = [abs(b.high - upper(i)) for i, b in hs] + [
            abs(b.low - lower(i)) for i, b in ls
        ]
        if max(residuals) > tolerance:
            continue
        formation = bars[start:finish + 1]
        violations = sum(
            b.high > upper(start + k) + tolerance
            or b.low < lower(start + k) - tolerance
            for k, b in enumerate(formation)
        )
        if violations > len(formation) * 0.1:
            continue
        current = len(bars) - 1
        if upper(current) <= lower(current) or not (
            lower(current) - tolerance <= bars[-1].close <= upper(current) + tolerance
        ):
            continue
        step = (bars[finish].time - bars[start].time) / span / 1000
        start_time = _bar_time_sec(bars[start])
        apex_time = round(start_time + (apex - start) * step)
        apex_price = upper(apex)
        score = min(94.0, 78.0 + (1 - final_width / initial_width) * 15 - max(residuals) / initial_width * 20)
        state: SuggestionState = "in_play" if final_width / initial_width < 0.5 else "waiting"
        suggestions.append(ScanAiSuggestion(
            id=f"triangle_{kind}_{start_time}_{_bar_time_sec(bars[finish])}",
            group="patterns", type=kind, name=name,
            description=f"{name}: 3 upper and 3 lower pivot touches; converging boundaries",
            state=state, strength=_strength_band(score), score=score,
            drawing_tool="path",
            # Confirmed finite boundaries; the nearby apex is metadata, not a future bar.
            anchors=[
                AnchorPoint(start_time, upper(start)),
                AnchorPoint(_bar_time_sec(bars[finish]), upper(finish)),
                AnchorPoint(_bar_time_sec(bars[finish]), lower(finish)),
                AnchorPoint(start_time, lower(start)),
            ],
            options={"lineColor": "#35d6b0", "lineWidth": 2, "anchorLabels": []},
            metrics={"touches": 6, "contraction": round(1 - final_width / initial_width, 3),
                     "upperSlope": upper_slope, "lowerSlope": lower_slope,
                     "apexTime": apex_time, "apexPrice": apex_price, "pattern": name},
            created_at=int(bars[finish].time),
        ))
    return suggestions

def run_scan_ai(
    bars: Sequence[BarRecord],
    request: ScanAiRequest,
    tick_size: float = 0.1,
) -> list[ScanAiSuggestion]:
    """Rank technical candidates and bound geometry; no proprietary algorithm is assumed."""
    # Slice bars to requested depth lookback
    depth_bars = request.depth_bars
    effective_bars = bars[-depth_bars:] if len(bars) > depth_bars else bars

    all_suggestions: list[ScanAiSuggestion] = []

    if "levels" in request.groups:
        all_suggestions.extend(detect_levels(effective_bars, tick_size=tick_size))
    if "lines" in request.groups:
        all_suggestions.extend(detect_trendlines(effective_bars, tick_size=tick_size))
    if "fibonacci" in request.groups:
        all_suggestions.extend(detect_fibonacci(effective_bars))
    if "patterns" in request.groups:
        if "double_top_bottom" in request.patterns or "head_and_shoulders" in request.patterns:
            patterns = detect_patterns(effective_bars, tick_size=tick_size)
            all_suggestions.extend(s for s in patterns if (
                s.type.startswith("double_") and "double_top_bottom" in request.patterns
                or s.type == "head_and_shoulders" and "head_and_shoulders" in request.patterns
            ))
        if "triangles_and_pennants" in request.patterns:
            all_suggestions.extend(detect_triangles(effective_bars, tick_size=tick_size))
    if "elliott" in request.groups or ("patterns" in request.groups and "elliott_waves" in request.patterns):
        all_suggestions.extend(detect_elliott_waves(effective_bars, tick_size=tick_size))

    # 1. Filter by requested states
    filtered = [s for s in all_suggestions if s.state in request.states]

    # 2. Filter by requested strength
    if request.strength == "strong":
        filtered = [s for s in filtered if s.strength == "strong"]
    elif request.strength == "moderate":
        filtered = [s for s in filtered if s.strength in ("moderate", "strong")]

    # 3. Filter by viewport range if provided
    if request.from_time is not None or request.to_time is not None:
        range_filtered: list[ScanAiSuggestion] = []
        for s in filtered:
            # Anchor times are in seconds
            has_anchor_in_range = False
            for a in s.anchors:
                a_ms = a.time * 1000
                if request.from_time is not None and a_ms < request.from_time:
                    continue
                if request.to_time is not None and a_ms > request.to_time:
                    continue
                has_anchor_in_range = True
                break
            if has_anchor_in_range:
                range_filtered.append(s)
        filtered = range_filtered

    # 4. Sort: score descending, then created_at descending (stable tie-breaking)
    state_rank = {"in_play": 3, "waiting": 2, "tested": 1}
    filtered.sort(key=lambda s: (state_rank.get(s.state, 0), s.score, s.created_at), reverse=True)

    # 5. Density cap per group
    caps = request.group_density_cap
    grouped_counts: dict[str, int] = {g: 0 for g in ALL_GROUPS}
    result: list[ScanAiSuggestion] = []

    for s in filtered:
        if not valid_geometry(s) or any(similar_geometry(s, kept, tick_size) for kept in result):
            continue
        group_cap = caps.get(s.group, 2)
        if grouped_counts[s.group] < group_cap:
            grouped_counts[s.group] += 1
            result.append(s)
            if len(result) >= request.total_density_cap:
                break

    # If targets_and_stop is False, clear them
    if not request.targets_and_stop:
        for s in result:
            s.target = None
            s.stop = None
            s.invalidation_price = None

    return result
