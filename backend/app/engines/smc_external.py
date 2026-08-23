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
    liquidity_swept: bool = False
    liquidity_count: int = 0
    liquidity_levels: tuple[float, ...] = ()


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


@dataclass(slots=True)
class _LiquidityPool:
    side: str
    top: float
    bottom: float
    pivot_indices: set[int]
    pivot_prices: tuple[float, ...]
    pivot_times: tuple[CanonicalTimestamp, ...]
    created_index: int
    touched: bool = False
    broken: bool = False
    broken_index: int | None = None
    broken_time: CanonicalTimestamp | None = None


def _true_range(high: float, low: float, previous_close: float | None) -> float:
    if previous_close is None:
        return max(0.0, high - low)
    return max(
        0.0,
        high - low,
        abs(high - previous_close),
        abs(low - previous_close),
    )


def _wilder_atr(
    true_ranges: list[float], previous_atr: float | None, period: int
) -> float | None:
    if len(true_ranges) < period:
        return None
    if previous_atr is None:
        return sum(true_ranges[-period:]) / period
    current = true_ranges[-1]
    return previous_atr + (current - previous_atr) / period


class SmcExternalDetector:
    """Detect external BOS/CHoCH breaks using the Lux-style swing leg logic."""

    def __init__(
        self,
        swing_length: int,
        *,
        liquidity_filter: bool = False,
        liquidity_min_pivots: int = 2,
        liquidity_lookback_bars: int = 120,
        liquidity_atr_margin: float = 4.0,
        liquidity_sweep_lookback_bars: int = 5,
    ) -> None:
        self._swing_length = max(1, int(swing_length))
        self._liquidity_filter = bool(liquidity_filter)
        self._liquidity_min_pivots = max(2, int(liquidity_min_pivots))
        self._liquidity_lookback_bars = max(1, int(liquidity_lookback_bars))
        self._liquidity_atr_margin = max(0.0, float(liquidity_atr_margin))
        self._liquidity_sweep_lookback_bars = max(
            1, int(liquidity_sweep_lookback_bars)
        )
        self._atr_period = 10
        self._highs: list[float] = []
        self._lows: list[float] = []
        self._closes: list[float] = []
        self._true_ranges: list[float] = []
        self._atr_values: list[float | None] = []
        self._timestamps: list[CanonicalTimestamp] = []
        self._indices: list[int] = []
        self._last_swing_leg = 0
        self._swing_high: _SwingPoint | None = None
        self._swing_low: _SwingPoint | None = None
        self._swing_highs: list[_SwingPoint] = []
        self._swing_lows: list[_SwingPoint] = []
        self._liquidity_pools: list[_LiquidityPool] = []
        self._swing_trend = 0
        self._bar_index = -1
        self._max_buffer = max(2_000, self._swing_length * 4 + 32)

    def update(self, bar: SmcBar) -> SmcBreakEvent | None:
        self._bar_index += 1
        self._highs.append(float(bar.high))
        self._lows.append(float(bar.low))
        self._closes.append(float(bar.close))
        self._true_ranges.append(
            _true_range(
                float(bar.high),
                float(bar.low),
                self._closes[-2] if len(self._closes) > 1 else None,
            )
        )
        self._atr_values.append(
            _wilder_atr(
                self._true_ranges,
                self._atr_values[-1] if self._atr_values else None,
                self._atr_period,
            )
        )
        self._timestamps.append(bar.time)
        self._indices.append(self._bar_index)

        if len(self._highs) > self._max_buffer:
            self._highs.pop(0)
            self._lows.pop(0)
            self._closes.pop(0)
            self._true_ranges.pop(0)
            self._atr_values.pop(0)
            self._timestamps.pop(0)
            self._indices.pop(0)

        if len(self._highs) <= self._swing_length + 1:
            return None
        event = self._process_structure(bar)
        # A structure update can register a new liquidity pool on this bar.
        # Evaluate close-through after registration, then enrich a CHoCH event
        # from the same close so live and historical replay use one rule.
        self._update_liquidity_state(bar)
        if (
            event is not None
            and event.kind == "CHoCH"
            and self._liquidity_filter
            and not event.liquidity_swept
        ):
            liquidity = self._liquidity_for_break(event.direction)
            if liquidity[0]:
                return SmcBreakEvent(
                    kind=event.kind,
                    direction=event.direction,
                    level=event.level,
                    break_time=event.break_time,
                    pivot_time=event.pivot_time,
                    break_high=event.break_high,
                    break_low=event.break_low,
                    liquidity_swept=liquidity[0],
                    liquidity_count=liquidity[1],
                    liquidity_levels=liquidity[2],
                )
        return event

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
            self._register_liquidity_pivot("sell", self._swing_low, self._bar_index)
        else:
            self._swing_high = _SwingPoint(
                price=candidate_high,
                bar_index=pivot_bar_index,
                timestamp=pivot_timestamp,
            )
            self._register_liquidity_pivot("buy", self._swing_high, self._bar_index)

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
                liquidity = (
                    self._liquidity_for_break(1)
                    if kind == "CHoCH"
                    else (False, 0, ())
                )
                return SmcBreakEvent(
                    kind=kind,
                    direction=1,
                    level=active_high.price,
                    break_time=bar.time,
                    pivot_time=active_high.timestamp,
                    break_high=float(bar.high),
                    break_low=float(bar.low),
                    liquidity_swept=liquidity[0],
                    liquidity_count=liquidity[1],
                    liquidity_levels=liquidity[2],
                )

        active_low = self._swing_low
        if active_low is not None and not active_low.crossed:
            crossed_low = current_close < active_low.price and prev_close >= active_low.price
            if crossed_low:
                active_low.crossed = True
                kind = "CHoCH" if self._swing_trend == 1 else "BOS"
                self._swing_trend = -1
                liquidity = (
                    self._liquidity_for_break(-1)
                    if kind == "CHoCH"
                    else (False, 0, ())
                )
                return SmcBreakEvent(
                    kind=kind,
                    direction=-1,
                    level=active_low.price,
                    break_time=bar.time,
                    pivot_time=active_low.timestamp,
                    break_high=float(bar.high),
                    break_low=float(bar.low),
                    liquidity_swept=liquidity[0],
                    liquidity_count=liquidity[1],
                    liquidity_levels=liquidity[2],
                )

        return None

    def _register_liquidity_pivot(
        self, side: str, pivot: _SwingPoint, current_index: int
    ) -> None:
        if not self._liquidity_filter:
            return
        history = self._swing_highs if side == "buy" else self._swing_lows
        history.append(pivot)
        cutoff = current_index - self._liquidity_lookback_bars
        history[:] = [point for point in history if point.bar_index >= cutoff]

        atr = self._atr_values[-1] if self._atr_values else None
        if atr is None or atr <= 0 or self._liquidity_atr_margin <= 0:
            return
        width = atr * self._liquidity_atr_margin / 10.0
        swept_indices = {
            index
            for pool in self._liquidity_pools
            if pool.side == side and pool.broken
            for index in pool.pivot_indices
        }
        # Match the chart liquidity model: only consecutive same-side swings
        # inside the current ATR band belong to one pool. Stop at the first
        # out-of-band swing instead of skipping it and merging much older lows
        # or highs into the current cluster.
        cluster: list[_SwingPoint] = []
        for point in reversed(history):
            if abs(point.price - pivot.price) > width:
                break
            if point.bar_index not in swept_indices:
                cluster.append(point)
        cluster.reverse()
        if len(cluster) < self._liquidity_min_pivots:
            return

        indices = {point.bar_index for point in cluster}
        existing = next(
            (
                pool
                for pool in self._liquidity_pools
                if not pool.broken
                and pool.side == side
                and pool.pivot_indices.intersection(indices)
            ),
            None,
        )
        prices = tuple(sorted(point.price for point in cluster))
        pivot_times = tuple(point.timestamp for point in cluster)
        center = (prices[0] + prices[-1]) / 2.0
        pool = existing
        if pool is None:
            pool = _LiquidityPool(
                side=side,
                top=center + width,
                bottom=center - width,
                pivot_indices=indices,
                pivot_prices=prices,
                pivot_times=pivot_times,
                created_index=min(point.bar_index for point in cluster),
            )
            self._liquidity_pools.append(pool)
        else:
            pool.top = center + width
            pool.bottom = center - width
            pool.pivot_indices = indices
            pool.pivot_prices = prices
            pool.pivot_times = pivot_times
            pool.created_index = min(point.bar_index for point in cluster)

        if len(self._liquidity_pools) > 80:
            self._liquidity_pools = self._liquidity_pools[-80:]

    def _update_liquidity_state(self, bar: SmcBar) -> None:
        if not self._liquidity_filter:
            return
        close = float(bar.close)
        for pool in self._liquidity_pools:
            if pool.broken:
                continue
            if pool.side == "buy":
                if close > pool.bottom:
                    pool.touched = True
                if close > pool.top:
                    pool.broken = True
                    pool.broken_index = self._bar_index
                    pool.broken_time = bar.time
            else:
                if close < pool.top:
                    pool.touched = True
                if close < pool.bottom:
                    pool.broken = True
                    pool.broken_index = self._bar_index
                    pool.broken_time = bar.time

    def _liquidity_for_break(
        self, direction: int
    ) -> tuple[bool, int, tuple[float, ...]]:
        if not self._liquidity_filter:
            return False, 0, ()
        required_side = "sell" if direction > 0 else "buy"
        candidates = [
            pool
            for pool in self._liquidity_pools
            if pool.side == required_side
            and pool.broken
            and pool.broken_index is not None
            and self._bar_index - pool.broken_index
            <= self._liquidity_sweep_lookback_bars
        ]
        if not candidates:
            return False, 0, ()
        pool = max(candidates, key=lambda item: item.broken_index or -1)
        return True, len(pool.pivot_prices), pool.pivot_prices


class SmcExternalBreakState:
    """Pending setup state for the external BOS/CHoCH strategy alert."""

    def __init__(
        self,
        *,
        swing_length: int,
        lookahead_bars: int,
        max_bars: int | None = None,
        pause_on_inside_bars: bool = True,
        retest_tolerance_ticks: int = 50,
        tick_size: float = 0.1,
    ) -> None:
        self._lookahead_bars = max(1, int(lookahead_bars))
        parsed_max_bars = self._lookahead_bars if max_bars is None else int(max_bars)
        self._max_bars = max(self._lookahead_bars, parsed_max_bars)
        self._pause_on_inside_bars = bool(pause_on_inside_bars)
        self._retest_tolerance = max(0, int(retest_tolerance_ticks)) * max(
            0.0, float(tick_size)
        )
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
        if self._invalidates_pending_setup(setup, bar):
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

    def _invalidates_pending_setup(self, setup: SmcBreakEvent, bar: SmcBar) -> bool:
        if setup.direction == 1:
            return float(bar.close) < setup.level - self._retest_tolerance
        return float(bar.close) > setup.level + self._retest_tolerance

    def _counts_as_effective_bar(self, setup: SmcBreakEvent, bar: SmcBar) -> bool:
        if not self._pause_on_inside_bars:
            return True
        # Only bars that close beyond the break bar in the break direction
        # consume the 5-bar window; inside/ranging bars keep the reclaim alive.
        if setup.direction == 1:
            return float(bar.close) > setup.break_high
        return float(bar.close) < setup.break_low
