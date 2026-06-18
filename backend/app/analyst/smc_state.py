"""Compact SMC state for analyst snapshots."""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass

from ..engines.smc_external import SmcBar, SmcBreakEvent, SmcExternalDetector
from ..models.timestamp import CanonicalTimestamp
from ..storage.records import BarRecord
from .schemas import SmcState, SmcZone

DEFAULT_SMC_SWING_LENGTH = 50
DEFAULT_SMC_MAX_ZONE_AGE = 220
DEFAULT_SMC_MAX_OB_ZONES = 3
DEFAULT_SMC_MAX_FVG_ZONES = 3
DEFAULT_SMC_FVG_THRESHOLD_LOOKBACK = 60
DEFAULT_SMC_FVG_THRESHOLD_MULTIPLIER = 1.5
DEFAULT_SMC_FVG_VOLUME_CONFIRMATION = False
SMC_FVG_VOLUME_LOOKBACK = 20

Direction = int


@dataclass(slots=True)
class _SwingPoint:
    price: float
    bar_index: int
    timestamp: CanonicalTimestamp
    crossed: bool = False


@dataclass(slots=True)
class _CandidateZone:
    kind: str
    label: str
    direction: Direction
    top: float
    bottom: float
    bar_index: int
    timestamp: CanonicalTimestamp
    created_bar_index: int
    active: bool = True
    scope: str = "swing"
    pd_kind: str | None = None
    end_time: CanonicalTimestamp | None = None


def build_smc_state(
    timeframe: str,
    bars: Sequence[BarRecord],
    *,
    swing_length: int = DEFAULT_SMC_SWING_LENGTH,
) -> SmcState:
    """Detect the latest external BOS/CHoCH state for one timeframe."""
    ordered = [bar for bar in sorted(bars, key=lambda b: b.time) if bar.closed]
    if not ordered:
        return SmcState(
            timeframe=timeframe,
            bias="unknown",
            structure="missing_bars",
            last_event="none",
            last_direction="none",
            last_level=None,
            bars=0,
        )

    detector = SmcExternalDetector(swing_length)
    last_event: SmcBreakEvent | None = None
    for rec in ordered:
        event = detector.update(
            SmcBar(
                time=rec.time,
                open=rec.open,
                high=rec.high,
                low=rec.low,
                close=rec.close,
            )
        )
        if event is not None:
            last_event = event

    if last_event is not None:
        direction = "bullish" if last_event.direction == 1 else "bearish"
        return SmcState(
            timeframe=timeframe,
            bias=direction,
            structure=f"external_{'up' if last_event.direction == 1 else 'down'}",
            last_event=last_event.kind,
            last_direction=direction,
            last_level=float(last_event.level),
            bars=len(ordered),
        )

    fallback_bias = _fallback_price_bias(ordered)
    return SmcState(
        timeframe=timeframe,
        bias=fallback_bias,
        structure="insufficient_swing_history",
        last_event="none",
        last_direction="none",
        last_level=None,
        bars=len(ordered),
    )


def build_smc_zones(
    timeframe: str,
    bars: Sequence[BarRecord],
    *,
    swing_length: int = DEFAULT_SMC_SWING_LENGTH,
    max_zone_age: int = DEFAULT_SMC_MAX_ZONE_AGE,
    max_order_blocks: int = DEFAULT_SMC_MAX_OB_ZONES,
    max_fvgs: int = DEFAULT_SMC_MAX_FVG_ZONES,
    fvg_auto_threshold: bool = True,
    fvg_threshold_lookback: int = DEFAULT_SMC_FVG_THRESHOLD_LOOKBACK,
    fvg_threshold_multiplier: float = DEFAULT_SMC_FVG_THRESHOLD_MULTIPLIER,
    fvg_volume_confirmation: bool = DEFAULT_SMC_FVG_VOLUME_CONFIRMATION,
) -> tuple[list[SmcZone], dict[str, object]]:
    """Build compact active FVG/OB/PD zones for the LLM snapshot."""
    ordered = [bar for bar in sorted(bars, key=lambda b: b.time) if bar.closed]
    if not ordered:
        return [], {
            "activeOrderBlocks": 0,
            "activeFairValueGaps": 0,
            "currentPdZone": "unknown",
            "nearestZone": None,
        }

    detector = _SmcZoneDetector(
        swing_length=swing_length,
        max_zone_age=max_zone_age,
        fvg_auto_threshold=fvg_auto_threshold,
        fvg_threshold_lookback=fvg_threshold_lookback,
        fvg_threshold_multiplier=fvg_threshold_multiplier,
        fvg_volume_confirmation=fvg_volume_confirmation,
    )
    for index, rec in enumerate(ordered):
        detector.update(rec, index)

    last_price = float(ordered[-1].close)
    ob_candidates = _nearest_candidates(
        [zone for zone in detector.order_blocks if zone.active],
        last_price,
        max_order_blocks,
    )
    fvg_candidates = _nearest_candidates(
        [zone for zone in detector.fvgs if zone.active],
        last_price,
        max_fvgs,
    )
    pd_candidates, pd_context = detector.premium_discount_zones(ordered)
    all_zones = _dedupe_smc_zones([
        _to_smc_zone(timeframe, zone, last_price)
        for zone in [*pd_candidates, *ob_candidates, *fvg_candidates]
    ])
    nearest = min(all_zones, key=lambda zone: zone.distance_to_price, default=None)
    context: dict[str, object] = {
        "activeOrderBlocks": len([zone for zone in detector.order_blocks if zone.active]),
        "activeFairValueGaps": len([zone for zone in detector.fvgs if zone.active]),
        "currentPdZone": pd_context,
        "nearestZone": None if nearest is None else nearest.to_dict(),
    }
    return all_zones, context


def _dedupe_smc_zones(zones: Sequence[SmcZone]) -> list[SmcZone]:
    unique: list[SmcZone] = []
    seen: set[tuple[object, ...]] = set()
    for zone in zones:
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
        unique.append(zone)
    return unique


class _SmcZoneDetector:
    def __init__(
        self,
        *,
        swing_length: int,
        max_zone_age: int,
        fvg_auto_threshold: bool,
        fvg_threshold_lookback: int,
        fvg_threshold_multiplier: float,
        fvg_volume_confirmation: bool,
    ) -> None:
        self._swing_length = max(1, int(swing_length))
        self._max_zone_age = max(1, int(max_zone_age))
        self._fvg_auto_threshold = bool(fvg_auto_threshold)
        self._fvg_threshold_lookback = max(1, min(500, int(fvg_threshold_lookback)))
        self._fvg_threshold_multiplier = max(
            0.0,
            min(10.0, float(fvg_threshold_multiplier)),
        )
        self._fvg_volume_confirmation = bool(fvg_volume_confirmation)
        self._highs: list[float] = []
        self._lows: list[float] = []
        self._opens: list[float] = []
        self._closes: list[float] = []
        self._volumes: list[float] = []
        self._body_delta_percents: list[float] = []
        self._timestamps: list[CanonicalTimestamp] = []
        self._indices: list[int] = []
        self._last_swing_leg = 0
        self._swing_trend = 0
        self._swing_high: _SwingPoint | None = None
        self._swing_low: _SwingPoint | None = None
        self.order_blocks: list[_CandidateZone] = []
        self.fvgs: list[_CandidateZone] = []

    def update(self, bar: BarRecord, bar_index: int) -> None:
        self._highs.append(float(bar.high))
        self._lows.append(float(bar.low))
        self._opens.append(float(bar.open))
        self._closes.append(float(bar.close))
        self._volumes.append(float(bar.volume))
        self._body_delta_percents.append(
            _candle_body_delta_percent(float(bar.open), float(bar.close))
        )
        self._timestamps.append(bar.time)
        self._indices.append(bar_index)

        if len(self._highs) <= self._swing_length + 1:
            return
        self._process_structure()
        self._detect_fvgs(bar_index)
        self._maintain_zones(float(bar.high), float(bar.low), bar_index)

    def _process_structure(self) -> None:
        length = self._swing_length
        if len(self._highs) < length + 1:
            return

        candidate_pos = len(self._highs) - length - 1
        candidate_high = self._highs[candidate_pos]
        candidate_low = self._lows[candidate_pos]
        recent_highs = self._highs[-length:]
        recent_lows = self._lows[-length:]

        new_leg_high = candidate_high > max(recent_highs)
        new_leg_low = candidate_low < min(recent_lows)

        prev_leg = self._last_swing_leg
        leg = prev_leg
        if new_leg_high:
            leg = -1
        elif new_leg_low:
            leg = 1

        if leg != 0:
            leg_changed = prev_leg != leg
            self._last_swing_leg = leg
            if leg_changed:
                pivot = _SwingPoint(
                    price=candidate_low if leg == 1 else candidate_high,
                    bar_index=self._indices[candidate_pos],
                    timestamp=self._timestamps[candidate_pos],
                )
                if leg == 1:
                    self._swing_low = pivot
                else:
                    self._swing_high = pivot

        self._check_bos_choch()

    def _check_bos_choch(self) -> None:
        if len(self._closes) < 2:
            return
        current_close = self._closes[-1]
        prev_close = self._closes[-2]

        active_high = self._swing_high
        if active_high is not None and not active_high.crossed:
            if current_close > active_high.price and prev_close <= active_high.price:
                active_high.crossed = True
                self._swing_trend = 1
                origin = self._swing_low or active_high
                self._create_order_block(origin, 1)
                return

        active_low = self._swing_low
        if active_low is not None and not active_low.crossed:
            if current_close < active_low.price and prev_close >= active_low.price:
                active_low.crossed = True
                self._swing_trend = -1
                origin = self._swing_high or active_low
                self._create_order_block(origin, -1)

    def _create_order_block(
        self,
        broken_pivot: _SwingPoint,
        direction: Direction,
    ) -> None:
        try:
            buffer_start_pos = self._indices.index(broken_pivot.bar_index)
        except ValueError:
            return
        range_highs = self._highs[buffer_start_pos:]
        range_lows = self._lows[buffer_start_pos:]
        range_indices = self._indices[buffer_start_pos:]
        range_timestamps = self._timestamps[buffer_start_pos:]
        if not range_highs:
            return

        if direction == 1:
            ob_pos = range_lows.index(min(range_lows))
            label = "Bull OB"
        else:
            ob_pos = range_highs.index(max(range_highs))
            label = "Bear OB"

        self.order_blocks.insert(
            0,
            _CandidateZone(
                kind="ob",
                label=label,
                direction=direction,
                top=range_highs[ob_pos],
                bottom=range_lows[ob_pos],
                bar_index=range_indices[ob_pos],
                timestamp=range_timestamps[ob_pos],
                created_bar_index=self._indices[-1],
            ),
        )
        del self.order_blocks[20:]

    def _detect_fvgs(self, bar_index: int) -> None:
        if len(self._highs) < 3:
            return
        curr_low = self._lows[-1]
        curr_high = self._highs[-1]
        prev_pos = len(self._closes) - 2
        prev_close = self._closes[prev_pos]
        prev_body_delta_percent = self._body_delta_percents[prev_pos]
        threshold = self._fvg_body_threshold(prev_pos)
        volume_confirmed = self._fvg_volume_confirmed(prev_pos)
        prev2_high = self._highs[-3]
        prev2_low = self._lows[-3]
        prev_timestamp = self._timestamps[-2]

        if (
            curr_low > prev2_high
            and prev_close > prev2_high
            and prev_body_delta_percent > threshold
            and volume_confirmed
        ):
            self.fvgs.insert(
                0,
                _CandidateZone(
                    kind="fvg",
                    label="Bull FVG",
                    direction=1,
                    top=curr_low,
                    bottom=prev2_high,
                    bar_index=bar_index - 1,
                    timestamp=prev_timestamp,
                    created_bar_index=bar_index,
                ),
            )

        if (
            curr_high < prev2_low
            and prev_close < prev2_low
            and -prev_body_delta_percent > threshold
            and volume_confirmed
        ):
            self.fvgs.insert(
                0,
                _CandidateZone(
                    kind="fvg",
                    label="Bear FVG",
                    direction=-1,
                    top=prev2_low,
                    bottom=curr_high,
                    bar_index=bar_index - 1,
                    timestamp=prev_timestamp,
                    created_bar_index=bar_index,
                ),
            )
        del self.fvgs[50:]

    def _fvg_body_threshold(self, prev_pos: int) -> float:
        if not self._fvg_auto_threshold:
            return 0.0
        average_body = _rolling_abs_average(
            self._body_delta_percents,
            prev_pos,
            self._fvg_threshold_lookback,
        )
        return average_body * self._fvg_threshold_multiplier

    def _fvg_volume_confirmed(self, prev_pos: int) -> bool:
        if not self._fvg_volume_confirmation:
            return True
        volume = self._volumes[prev_pos]
        if volume <= 0:
            return True
        average_volume = _rolling_average(
            self._volumes,
            prev_pos,
            SMC_FVG_VOLUME_LOOKBACK,
            include=lambda value: value > 0,
        )
        return average_volume <= 0 or volume > average_volume

    def _maintain_zones(self, high: float, low: float, current_index: int) -> None:
        for zones in (self.order_blocks, self.fvgs):
            for i in range(len(zones) - 1, -1, -1):
                zone = zones[i]
                if (
                    zone.kind == "ob"
                    and current_index - zone.created_bar_index > self._max_zone_age
                ):
                    zones.pop(i)
                    continue
                if zone.direction == 1 and low < zone.bottom:
                    zones.pop(i)
                elif zone.direction == -1 and high > zone.top:
                    zones.pop(i)

    def premium_discount_zones(
        self,
        bars: Sequence[BarRecord],
    ) -> tuple[list[_CandidateZone], str]:
        high_pivot = self._swing_high
        low_pivot = self._swing_low
        if high_pivot is None or low_pivot is None or not bars:
            return [], "unknown"

        anchor_index = max(high_pivot.bar_index, low_pivot.bar_index)
        if anchor_index < 0 or anchor_index >= len(bars):
            return [], "unknown"

        range_high = high_pivot.price
        range_low = low_pivot.price
        for bar in bars[anchor_index:]:
            range_high = max(range_high, float(bar.high))
            range_low = min(range_low, float(bar.low))
        if range_high <= range_low:
            return [], "unknown"

        start_time = bars[anchor_index].time
        end_time = bars[-1].time
        premium_bottom = 0.95 * range_high + 0.05 * range_low
        eq_top = 0.525 * range_high + 0.475 * range_low
        eq_bottom = 0.475 * range_high + 0.525 * range_low
        discount_top = 0.95 * range_low + 0.05 * range_high
        last_price = float(bars[-1].close)

        zones = [
            _CandidateZone(
                kind="pd",
                label="Premium",
                direction=-1,
                top=range_high,
                bottom=premium_bottom,
                bar_index=anchor_index,
                timestamp=start_time,
                created_bar_index=anchor_index,
                end_time=end_time,
                pd_kind="premium",
            ),
            _CandidateZone(
                kind="pd",
                label="EQ",
                direction=1,
                top=eq_top,
                bottom=eq_bottom,
                bar_index=anchor_index,
                timestamp=start_time,
                created_bar_index=anchor_index,
                end_time=end_time,
                pd_kind="equilibrium",
            ),
            _CandidateZone(
                kind="pd",
                label="Discount",
                direction=1,
                top=discount_top,
                bottom=range_low,
                bar_index=anchor_index,
                timestamp=start_time,
                created_bar_index=anchor_index,
                end_time=end_time,
                pd_kind="discount",
            ),
        ]
        if last_price >= premium_bottom:
            current_pd = "premium"
        elif last_price <= discount_top:
            current_pd = "discount"
        elif eq_bottom <= last_price <= eq_top:
            current_pd = "equilibrium"
        elif last_price > range_high:
            current_pd = "above_range"
        elif last_price < range_low:
            current_pd = "below_range"
        else:
            current_pd = "mid_range"
        return zones, current_pd


def _nearest_candidates(
    zones: Sequence[_CandidateZone],
    price: float,
    limit: int,
) -> list[_CandidateZone]:
    return sorted(zones, key=lambda zone: _distance_to_zone(price, zone))[:limit]


def _distance_to_zone(price: float, zone: _CandidateZone) -> float:
    if zone.bottom <= price <= zone.top:
        return 0.0
    if price > zone.top:
        return price - zone.top
    return zone.bottom - price


def _candle_body_delta_percent(open_: float, close: float) -> float:
    if open_ == 0:
        return 0.0
    return (close - open_) / abs(open_)


def _rolling_abs_average(
    values: Sequence[float],
    end_exclusive: int,
    lookback: int,
) -> float:
    return _rolling_average(
        values,
        end_exclusive,
        lookback,
        include=lambda _value: True,
        transform=abs,
    )


def _rolling_average(
    values: Sequence[float],
    end_exclusive: int,
    lookback: int,
    *,
    include: Callable[[float], bool],
    transform: Callable[[float], float] = float,
) -> float:
    start = max(0, end_exclusive - max(1, lookback))
    total = 0.0
    count = 0
    for value in values[start:end_exclusive]:
        numeric = float(value)
        if not include(numeric):
            continue
        total += transform(numeric)
        count += 1
    return total / count if count else 0.0


def _to_smc_zone(
    timeframe: str,
    zone: _CandidateZone,
    price: float,
) -> SmcZone:
    top = float(zone.top)
    bottom = float(zone.bottom)
    return SmcZone(
        timeframe=timeframe,
        kind=zone.kind,
        label=zone.label,
        direction=_direction_label(zone.direction),
        scope=zone.scope,
        pd_kind=zone.pd_kind,
        top=top,
        bottom=bottom,
        mid=(top + bottom) / 2.0,
        distance_to_price=_distance_to_zone(price, zone),
        contains_price=bottom <= price <= top,
        start_time=zone.timestamp,
        end_time=zone.end_time,
    )


def _direction_label(direction: Direction) -> str:
    if direction == 1:
        return "bullish"
    if direction == -1:
        return "bearish"
    return "neutral"


def _fallback_price_bias(bars: Sequence[BarRecord]) -> str:
    if len(bars) < 2:
        return "range"
    lookback = min(len(bars), 20)
    first = float(bars[-lookback].close)
    last = float(bars[-1].close)
    if last > first:
        return "bullish"
    if last < first:
        return "bearish"
    return "range"
