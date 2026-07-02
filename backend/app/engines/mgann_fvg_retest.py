"""FVG retest detection using mGann-style swing waves."""

from __future__ import annotations

from dataclasses import dataclass

from app.models.timestamp import CanonicalTimestamp

__all__ = [
    "MGANN_FVG_DEFAULT_MAX_ZONE_AGE",
    "MGANN_FVG_DEFAULT_MIN_GAP_TICKS",
    "MGANN_FVG_DEFAULT_RETEST_TOLERANCE_TICKS",
    "MGANN_FVG_DEFAULT_SWING_SIZE",
    "MGANN_FVG_RETEST_DEFAULT_TIMEFRAME",
    "MGANN_FVG_RETEST_TIMEFRAME",
    "MGANN_FVG_RETEST_TIMEFRAMES",
    "MgannFvgRetestBar",
    "MgannFvgRetestState",
    "MgannFvgRetestTrigger",
]

MGANN_FVG_RETEST_DEFAULT_TIMEFRAME = "5m"
MGANN_FVG_RETEST_TIMEFRAME = MGANN_FVG_RETEST_DEFAULT_TIMEFRAME
MGANN_FVG_RETEST_TIMEFRAMES = ("1m", "5m")
MGANN_FVG_DEFAULT_SWING_SIZE = 2
MGANN_FVG_DEFAULT_MAX_ZONE_AGE = 0
MGANN_FVG_DEFAULT_MIN_GAP_TICKS = 1
MGANN_FVG_DEFAULT_RETEST_TOLERANCE_TICKS = 0

_TICK_SIZE = 0.1


@dataclass(slots=True)
class MgannFvgRetestBar:
    time: CanonicalTimestamp
    open: float
    high: float
    low: float
    close: float
    volume: int


@dataclass(slots=True)
class _Pivot:
    index: int
    time: CanonicalTimestamp
    price: float
    kind: str
    confirmed_index: int


@dataclass(slots=True)
class _Zone:
    id: str
    direction: int
    top: float
    bottom: float
    source_index: int
    source_time: CanonicalTimestamp
    created_index: int
    created_time: CanonicalTimestamp
    wave_index: int


@dataclass(slots=True)
class MgannFvgRetestTrigger:
    direction: int
    price: float
    zone_top: float
    zone_bottom: float
    zone_time: CanonicalTimestamp
    created_time: CanonicalTimestamp
    fvg_wave_index: int
    retest_wave_index: int


class MgannFvgRetestState:
    """Track FVG zones and fire when the next confirmed mGann wave retests one."""

    def __init__(
        self,
        *,
        swing_size: int = MGANN_FVG_DEFAULT_SWING_SIZE,
        max_zone_age: int = MGANN_FVG_DEFAULT_MAX_ZONE_AGE,
        min_gap_ticks: int = MGANN_FVG_DEFAULT_MIN_GAP_TICKS,
        retest_tolerance_ticks: int = MGANN_FVG_DEFAULT_RETEST_TOLERANCE_TICKS,
        tick_size: float = _TICK_SIZE,
    ) -> None:
        self._swing_size = max(1, int(swing_size))
        self._max_zone_age = max(0, int(max_zone_age))
        self._min_gap = max(0, int(min_gap_ticks)) * float(tick_size)
        self._tolerance = max(0, int(retest_tolerance_ticks)) * float(tick_size)
        self._bars: list[MgannFvgRetestBar] = []
        self._zones: list[_Zone] = []
        self._fired_retests: set[tuple[str, int]] = set()
        self._preconfirmed_touches: set[tuple[str, int]] = set()
        self._last_bar_time: CanonicalTimestamp | None = None

    def on_closed_bar(self, bar: MgannFvgRetestBar) -> list[MgannFvgRetestTrigger]:
        if self._last_bar_time is not None and bar.time <= self._last_bar_time:
            return []
        self._last_bar_time = bar.time
        self._bars.append(bar)

        pivots = self._collect_pivots()
        current_index = len(self._bars) - 1
        self._detect_fvg(pivots)
        return self._retests(pivots, current_index, bar)

    def _detect_fvg(self, pivots: list[_Pivot]) -> None:
        if len(self._bars) < 3:
            return
        current_index = len(self._bars) - 1
        left = self._bars[-3]
        source = self._bars[-2]
        right = self._bars[-1]
        source_index = current_index - 1
        source_wave = self._wave_index_for_bar(pivots, source_index)

        if right.low > left.high and source.close > left.high:
            gap = float(right.low) - float(left.high)
            if gap >= self._min_gap:
                self._add_zone(
                    direction=1,
                    top=float(right.low),
                    bottom=float(left.high),
                    source_index=source_index,
                    source_time=source.time,
                    created_index=current_index,
                    created_time=right.time,
                    wave_index=source_wave,
                )

        if right.high < left.low and source.close < left.low:
            gap = float(left.low) - float(right.high)
            if gap >= self._min_gap:
                self._add_zone(
                    direction=-1,
                    top=float(left.low),
                    bottom=float(right.high),
                    source_index=source_index,
                    source_time=source.time,
                    created_index=current_index,
                    created_time=right.time,
                    wave_index=source_wave,
                )

    def _add_zone(
        self,
        *,
        direction: int,
        top: float,
        bottom: float,
        source_index: int,
        source_time: CanonicalTimestamp,
        created_index: int,
        created_time: CanonicalTimestamp,
        wave_index: int,
    ) -> None:
        zone_id = (
            f"{direction}:{source_time}:{round(top, 4)}:{round(bottom, 4)}"
        )
        if any(zone.id == zone_id for zone in self._zones):
            return
        self._zones.insert(
            0,
            _Zone(
                id=zone_id,
                direction=direction,
                top=max(top, bottom),
                bottom=min(top, bottom),
                source_index=source_index,
                source_time=source_time,
                created_index=created_index,
                created_time=created_time,
                wave_index=wave_index,
            ),
        )
        del self._zones[80:]

    def _retests(
        self,
        pivots: list[_Pivot],
        current_index: int,
        bar: MgannFvgRetestBar,
    ) -> list[MgannFvgRetestTrigger]:
        triggers: list[MgannFvgRetestTrigger] = []
        kept: list[_Zone] = []
        current_wave = self._wave_index_for_bar(pivots, current_index)
        current_direction = self._wave_direction(pivots, current_wave)
        for zone in self._zones:
            if (
                self._max_zone_age > 0
                and current_index - zone.created_index > self._max_zone_age
            ):
                continue
            fullfilled = self._is_fullfilled(zone, bar)
            if fullfilled:
                continue
            trigger = self._retest_for_confirmed_wave(
                zone,
                pivots,
                current_index,
                current_wave,
                current_direction,
                bar,
            )
            if trigger is not None:
                triggers.append(trigger)
            kept.append(zone)
        self._zones = kept
        return triggers

    def _retest_for_confirmed_wave(
        self,
        zone: _Zone,
        pivots: list[_Pivot],
        current_index: int,
        current_wave: int,
        current_direction: int,
        bar: MgannFvgRetestBar,
    ) -> MgannFvgRetestTrigger | None:
        if current_wave <= zone.wave_index:
            return None
        if current_direction != -zone.direction:
            return None
        overlaps = (
            float(bar.low) <= zone.top + self._tolerance
            and float(bar.high) >= zone.bottom - self._tolerance
        )
        if not overlaps or self._is_fullfilled(zone, bar):
            return None

        retest_key = (zone.id, current_wave)
        confirmed_index = self._wave_confirmed_index(pivots, current_wave)
        if confirmed_index is None:
            return None
        if current_index <= confirmed_index:
            self._preconfirmed_touches.add(retest_key)
            return None
        if (
            retest_key in self._preconfirmed_touches
            or retest_key in self._fired_retests
        ):
            return None

        self._fired_retests.add(retest_key)
        price = max(zone.bottom, min(zone.top, float(bar.close)))
        return MgannFvgRetestTrigger(
            direction=zone.direction,
            price=price,
            zone_top=zone.top,
            zone_bottom=zone.bottom,
            zone_time=zone.source_time,
            created_time=zone.created_time,
            fvg_wave_index=zone.wave_index,
            retest_wave_index=current_wave,
        )

    def _is_fullfilled(self, zone: _Zone, bar: MgannFvgRetestBar) -> bool:
        if zone.direction == 1:
            return float(bar.low) <= zone.bottom - self._tolerance
        return float(bar.high) >= zone.top + self._tolerance

    def _collect_pivots(self) -> list[_Pivot]:
        bars = self._bars
        if len(bars) < self._swing_size + 1:
            return []

        pivots: list[_Pivot] = []
        direction = 0
        ext_high = bars[0].high
        ext_high_idx = 0
        ext_low = bars[0].low
        ext_low_idx = 0

        for index, bar in enumerate(bars):
            if bar.high >= ext_high:
                ext_high = bar.high
                ext_high_idx = index
            if bar.low <= ext_low:
                ext_low = bar.low
                ext_low_idx = index

            previous = bars[index - 1] if index > 0 else None
            is_inside = (
                previous is not None
                and bar.high <= previous.high
                and bar.low >= previous.low
            )
            rev_up = not is_inside and self._has_higher_highs(index)
            rev_down = not is_inside and self._has_lower_lows(index)

            if direction == 0:
                if rev_up:
                    self._push_pivot(pivots, ext_low_idx, "low", index)
                    direction = 1
                    ext_high = bar.high
                    ext_high_idx = index
                    ext_low = bar.low
                    ext_low_idx = index
                elif rev_down:
                    self._push_pivot(pivots, ext_high_idx, "high", index)
                    direction = -1
                    ext_high = bar.high
                    ext_high_idx = index
                    ext_low = bar.low
                    ext_low_idx = index
                continue

            if direction == 1 and rev_down:
                self._push_pivot(pivots, ext_high_idx, "high", index)
                direction = -1
                ext_high = bar.high
                ext_high_idx = index
                ext_low = bar.low
                ext_low_idx = index
            elif direction == -1 and rev_up:
                self._push_pivot(pivots, ext_low_idx, "low", index)
                direction = 1
                ext_high = bar.high
                ext_high_idx = index
                ext_low = bar.low
                ext_low_idx = index

        return pivots

    def _push_pivot(
        self,
        pivots: list[_Pivot],
        index: int,
        kind: str,
        confirmed_index: int,
    ) -> None:
        if index < 0 or index >= len(self._bars):
            return
        if pivots and pivots[-1].index == index:
            return
        bar = self._bars[index]
        pivots.append(
            _Pivot(
                index=index,
                time=bar.time,
                price=bar.high if kind == "high" else bar.low,
                kind=kind,
                confirmed_index=confirmed_index,
            )
        )

    def _has_higher_highs(self, index: int) -> bool:
        if index < self._swing_size:
            return False
        for offset in range(self._swing_size):
            if not (
                self._bars[index - offset].high
                > self._bars[index - offset - 1].high
            ):
                return False
        return True

    def _has_lower_lows(self, index: int) -> bool:
        if index < self._swing_size:
            return False
        for offset in range(self._swing_size):
            if not (
                self._bars[index - offset].low
                < self._bars[index - offset - 1].low
            ):
                return False
        return True

    @staticmethod
    def _wave_index_for_bar(pivots: list[_Pivot], bar_index: int) -> int:
        if len(pivots) < 2:
            return 0
        for wave_index in range(1, len(pivots)):
            start = pivots[wave_index - 1]
            end = pivots[wave_index]
            if start.index < bar_index <= end.index:
                return wave_index - 1
        if bar_index > pivots[-1].index:
            return len(pivots) - 1
        return 0

    @staticmethod
    def _wave_direction(pivots: list[_Pivot], wave_index: int) -> int:
        if len(pivots) < 2:
            return 0
        if wave_index < len(pivots) - 1:
            end = pivots[wave_index + 1]
            return 1 if end.kind == "high" else -1
        last = pivots[-1]
        return 1 if last.kind == "low" else -1

    @staticmethod
    def _wave_confirmed_index(
        pivots: list[_Pivot], wave_index: int
    ) -> int | None:
        if len(pivots) < 2:
            return None
        if wave_index < 0 or wave_index >= len(pivots):
            return None
        return pivots[wave_index].confirmed_index
