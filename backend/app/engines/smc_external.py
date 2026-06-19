"""External SMC structure detector and strategy state.

This module intentionally ports only the external/swing BOS/CHoCH subset from
the frontend SMC overlay. It runs on closed backend 1m bars and keeps enough
state for server-side strategy alerts without depending on browser state.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..models.timestamp import CanonicalTimestamp

__all__ = [
    "SmcBar",
    "SmcBreakEvent",
    "SmcZone",
    "SmcStrategyTrigger",
    "SmcZoneTouchTrigger",
    "SmcExternalDetector",
    "SmcExternalBreakState",
    "SmcZoneTouchState",
]

Direction = int


@dataclass(frozen=True, slots=True)
class SmcBar:
    time: CanonicalTimestamp
    open: float
    high: float
    low: float
    close: float
    volume: int = 0


@dataclass(frozen=True, slots=True)
class SmcBreakEvent:
    kind: str
    direction: Direction
    level: float
    break_time: CanonicalTimestamp
    pivot_time: CanonicalTimestamp
    break_high: float
    break_low: float


@dataclass(frozen=True, slots=True)
class SmcStrategyTrigger:
    setup: SmcBreakEvent
    trigger: str
    time: CanonicalTimestamp
    price: float
    big_trade_volume: int | None = None


@dataclass(frozen=True, slots=True)
class SmcZone:
    kind: str
    direction: Direction
    top: float
    bottom: float
    zone_time: CanonicalTimestamp
    created_time: CanonicalTimestamp
    label: str


@dataclass(frozen=True, slots=True)
class SmcZoneTouchTrigger:
    zone: SmcZone
    trigger: str
    time: CanonicalTimestamp
    price: float
    big_trade_volume: int


@dataclass(slots=True)
class _SwingPoint:
    price: float
    bar_index: int
    timestamp: CanonicalTimestamp
    crossed: bool = False


@dataclass(slots=True)
class _ZoneCandidate:
    kind: str
    direction: Direction
    top: float
    bottom: float
    bar_index: int
    timestamp: CanonicalTimestamp
    created_bar_index: int
    created_time: CanonicalTimestamp
    label: str


class SmcExternalDetector:
    """Detect external BOS/CHoCH breaks using the Lux-style swing leg logic."""

    def __init__(self, swing_length: int) -> None:
        self._swing_length = max(1, int(swing_length))
        self._highs: list[float] = []
        self._lows: list[float] = []
        self._closes: list[float] = []
        self._timestamps: list[CanonicalTimestamp] = []
        self._indices: list[int] = []
        self._last_swing_leg = 0
        self._swing_high: _SwingPoint | None = None
        self._swing_low: _SwingPoint | None = None
        self._swing_trend = 0
        self._bar_index = -1
        self._max_buffer = max(2_000, self._swing_length * 4 + 32)

    def update(self, bar: SmcBar) -> SmcBreakEvent | None:
        self._bar_index += 1
        self._highs.append(float(bar.high))
        self._lows.append(float(bar.low))
        self._closes.append(float(bar.close))
        self._timestamps.append(bar.time)
        self._indices.append(self._bar_index)

        if len(self._highs) > self._max_buffer:
            self._highs.pop(0)
            self._lows.pop(0)
            self._closes.pop(0)
            self._timestamps.pop(0)
            self._indices.pop(0)

        if len(self._highs) <= self._swing_length + 1:
            return None
        return self._process_structure(bar)

    def _process_structure(self, bar: SmcBar) -> SmcBreakEvent | None:
        length = self._swing_length
        if len(self._highs) < length + 1:
            return None

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

        if leg == 0:
            return self._check_bos_choch(bar)

        leg_changed = prev_leg != leg
        self._last_swing_leg = leg
        if not leg_changed:
            return self._check_bos_choch(bar)

        pivot_bar_index = self._indices[candidate_pos]
        pivot_timestamp = self._timestamps[candidate_pos]
        if leg == 1:
            self._swing_low = _SwingPoint(
                price=candidate_low,
                bar_index=pivot_bar_index,
                timestamp=pivot_timestamp,
            )
        else:
            self._swing_high = _SwingPoint(
                price=candidate_high,
                bar_index=pivot_bar_index,
                timestamp=pivot_timestamp,
            )

        return self._check_bos_choch(bar)

    def _check_bos_choch(self, bar: SmcBar) -> SmcBreakEvent | None:
        if len(self._closes) < 2:
            return None
        current_close = self._closes[-1]
        prev_close = self._closes[-2]

        active_high = self._swing_high
        if active_high is not None and not active_high.crossed:
            crossed_high = current_close > active_high.price and prev_close <= active_high.price
            if crossed_high:
                active_high.crossed = True
                kind = "CHoCH" if self._swing_trend == -1 else "BOS"
                self._swing_trend = 1
                return SmcBreakEvent(
                    kind=kind,
                    direction=1,
                    level=active_high.price,
                    break_time=bar.time,
                    pivot_time=active_high.timestamp,
                    break_high=float(bar.high),
                    break_low=float(bar.low),
                )

        active_low = self._swing_low
        if active_low is not None and not active_low.crossed:
            crossed_low = current_close < active_low.price and prev_close >= active_low.price
            if crossed_low:
                active_low.crossed = True
                kind = "CHoCH" if self._swing_trend == 1 else "BOS"
                self._swing_trend = -1
                return SmcBreakEvent(
                    kind=kind,
                    direction=-1,
                    level=active_low.price,
                    break_time=bar.time,
                    pivot_time=active_low.timestamp,
                    break_high=float(bar.high),
                    break_low=float(bar.low),
                )

        return None


class SmcExternalBreakState:
    """Pending setup state for the external BOS/CHoCH strategy alert."""

    def __init__(
        self,
        *,
        swing_length: int,
        lookahead_bars: int,
        max_bars: int | None = None,
        pause_on_inside_bars: bool = True,
    ) -> None:
        self._lookahead_bars = max(1, int(lookahead_bars))
        parsed_max_bars = self._lookahead_bars if max_bars is None else int(max_bars)
        self._max_bars = max(self._lookahead_bars, parsed_max_bars)
        self._pause_on_inside_bars = bool(pause_on_inside_bars)
        self._detector = SmcExternalDetector(swing_length)
        self.pending: SmcBreakEvent | None = None
        self.bars_elapsed = 0
        self.effective_bars_elapsed = 0
        self.calendar_bars_elapsed = 0
        self.last_bar_time: CanonicalTimestamp | None = None

    def on_closed_bar(self, bar: SmcBar) -> SmcStrategyTrigger | None:
        if self.last_bar_time is not None and bar.time <= self.last_bar_time:
            return None
        self.last_bar_time = bar.time

        trigger = self._process_pending_bar(bar)
        new_setup = self._detector.update(bar)
        if new_setup is not None:
            self.pending = new_setup
            self._reset_pending_counters()
        return trigger

    def on_big_trade(
        self,
        *,
        time: CanonicalTimestamp,
        price: float,
        volume: int,
        threshold: float,
    ) -> SmcStrategyTrigger | None:
        setup = self.pending
        if setup is None:
            return None
        if self._pending_window_expired():
            self.pending = None
            return None
        if float(volume) <= float(threshold):
            return None

        self.pending = None
        return SmcStrategyTrigger(
            setup=setup,
            trigger="big_trade",
            time=time,
            price=float(price),
            big_trade_volume=int(volume),
        )

    def _process_pending_bar(self, bar: SmcBar) -> SmcStrategyTrigger | None:
        setup = self.pending
        if setup is None or bar.time <= setup.break_time:
            return None

        self.calendar_bars_elapsed += 1
        retested = (
            bar.close <= setup.level if setup.direction == 1 else bar.close >= setup.level
        )
        if retested:
            self.pending = None
            return None

        if self._counts_as_effective_bar(setup, bar):
            self.effective_bars_elapsed += 1
            self.bars_elapsed = self.effective_bars_elapsed

        if self._pending_window_expired():
            self.pending = None
        return None

    def _reset_pending_counters(self) -> None:
        self.bars_elapsed = 0
        self.effective_bars_elapsed = 0
        self.calendar_bars_elapsed = 0

    def _pending_window_expired(self) -> bool:
        return (
            self.effective_bars_elapsed >= self._lookahead_bars
            or self.calendar_bars_elapsed >= self._max_bars
        )

    def _counts_as_effective_bar(self, setup: SmcBreakEvent, bar: SmcBar) -> bool:
        if not self._pause_on_inside_bars:
            return True
        # Only bars that close beyond the break bar in the break direction
        # consume the 5-bar window; inside/ranging bars keep the reclaim alive.
        if setup.direction == 1:
            return float(bar.close) > setup.break_high
        return float(bar.close) < setup.break_low


class SmcZoneTouchState:
    """Active external OB/FVG state for the M1 zone-touch BigTrade alert."""

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
        self._bar_index = -1
        self._max_buffer = max(
            2_000,
            self._max_zone_age + self._swing_length * 4 + 32,
            self._fvg_threshold_lookback + 32,
        )
        self.order_blocks: list[_ZoneCandidate] = []
        self.fvgs: list[_ZoneCandidate] = []
        self.last_bar_time: CanonicalTimestamp | None = None

    def on_closed_bar(self, bar: SmcBar) -> None:
        if self.last_bar_time is not None and bar.time <= self.last_bar_time:
            return
        self.last_bar_time = bar.time
        self._bar_index += 1

        self._highs.append(float(bar.high))
        self._lows.append(float(bar.low))
        self._opens.append(float(bar.open))
        self._closes.append(float(bar.close))
        self._volumes.append(float(bar.volume))
        self._body_delta_percents.append(
            _candle_body_delta_percent(float(bar.open), float(bar.close))
        )
        self._timestamps.append(bar.time)
        self._indices.append(self._bar_index)

        if len(self._highs) > self._max_buffer:
            self._highs.pop(0)
            self._lows.pop(0)
            self._opens.pop(0)
            self._closes.pop(0)
            self._volumes.pop(0)
            self._body_delta_percents.pop(0)
            self._timestamps.pop(0)
            self._indices.pop(0)

        if len(self._highs) <= self._swing_length + 1:
            return
        self._process_structure()
        self._detect_fvgs(self._bar_index)
        self._maintain_zones(float(bar.high), float(bar.low), self._bar_index)

    def on_big_trade(
        self,
        *,
        time: CanonicalTimestamp,
        price: float,
        volume: int,
        threshold: float,
    ) -> SmcZoneTouchTrigger | None:
        if float(volume) <= float(threshold):
            return None
        zone = self._first_touched_zone(float(price))
        if zone is None:
            return None
        return SmcZoneTouchTrigger(
            zone=zone,
            trigger="big_trade",
            time=time,
            price=float(price),
            big_trade_volume=int(volume),
        )

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
            crossed_high = current_close > active_high.price and prev_close <= active_high.price
            if crossed_high:
                active_high.crossed = True
                self._swing_trend = 1
                origin = self._swing_low or active_high
                self._create_order_block(origin, 1)
                return

        active_low = self._swing_low
        if active_low is not None and not active_low.crossed:
            crossed_low = current_close < active_low.price and prev_close >= active_low.price
            if crossed_low:
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
            _ZoneCandidate(
                kind="ob",
                direction=direction,
                top=range_highs[ob_pos],
                bottom=range_lows[ob_pos],
                bar_index=range_indices[ob_pos],
                timestamp=range_timestamps[ob_pos],
                created_bar_index=self._indices[-1],
                created_time=self._timestamps[-1],
                label=label,
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
                _ZoneCandidate(
                    kind="fvg",
                    direction=1,
                    top=curr_low,
                    bottom=prev2_high,
                    bar_index=bar_index - 1,
                    timestamp=prev_timestamp,
                    created_bar_index=bar_index,
                    created_time=self._timestamps[-1],
                    label="Bull FVG",
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
                _ZoneCandidate(
                    kind="fvg",
                    direction=-1,
                    top=prev2_low,
                    bottom=curr_high,
                    bar_index=bar_index - 1,
                    timestamp=prev_timestamp,
                    created_bar_index=bar_index,
                    created_time=self._timestamps[-1],
                    label="Bear FVG",
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
            20,
            include=lambda value: value > 0,
        )
        return average_volume <= 0 or volume > average_volume

    def _maintain_zones(self, high: float, low: float, current_index: int) -> None:
        for i in range(len(self.order_blocks) - 1, -1, -1):
            zone = self.order_blocks[i]
            if current_index - zone.created_bar_index > self._max_zone_age:
                self.order_blocks.pop(i)
                continue
            if zone.direction == 1 and low < zone.bottom:
                self.order_blocks.pop(i)
            elif zone.direction == -1 and high > zone.top:
                self.order_blocks.pop(i)

        for i in range(len(self.fvgs) - 1, -1, -1):
            zone = self.fvgs[i]
            if zone.direction == 1 and low < zone.bottom:
                self.fvgs.pop(i)
            elif zone.direction == -1 and high > zone.top:
                self.fvgs.pop(i)

    def _first_touched_zone(self, price: float) -> SmcZone | None:
        active = [*self.order_blocks, *self.fvgs]
        for zone in active:
            if zone.bottom <= price <= zone.top:
                return SmcZone(
                    kind=zone.kind,
                    direction=zone.direction,
                    top=float(zone.top),
                    bottom=float(zone.bottom),
                    zone_time=zone.timestamp,
                    created_time=zone.created_time,
                    label=zone.label,
                )
        return None


def _candle_body_delta_percent(open_: float, close: float) -> float:
    if open_ == 0:
        return 0.0
    return (close - open_) / abs(open_)


def _rolling_abs_average(
    values: list[float],
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
    values: list[float],
    end_exclusive: int,
    lookback: int,
    *,
    include,
    transform=float,
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
