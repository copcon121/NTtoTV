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
    "SmcStrategyTrigger",
    "SmcExternalDetector",
    "SmcExternalBreakState",
]

Direction = int


@dataclass(frozen=True, slots=True)
class SmcBar:
    time: CanonicalTimestamp
    open: float
    high: float
    low: float
    close: float


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


@dataclass(slots=True)
class _SwingPoint:
    price: float
    bar_index: int
    timestamp: CanonicalTimestamp
    crossed: bool = False


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

    def on_closed_bar(
        self, bar: SmcBar, *, emit: bool = True
    ) -> SmcStrategyTrigger | None:
        if self.last_bar_time is not None and bar.time <= self.last_bar_time:
            return None
        self.last_bar_time = bar.time

        trigger = self._process_pending_bar(bar, emit=emit)
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

    def _process_pending_bar(
        self, bar: SmcBar, *, emit: bool
    ) -> SmcStrategyTrigger | None:
        setup = self.pending
        if setup is None or bar.time <= setup.break_time:
            return None

        self.calendar_bars_elapsed += 1
        retested = (
            bar.close <= setup.level if setup.direction == 1 else bar.close >= setup.level
        )
        if retested:
            self.pending = None
            if not emit:
                return None
            return SmcStrategyTrigger(
                setup=setup,
                trigger="retest_close",
                time=bar.time,
                price=float(bar.close),
            )

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
