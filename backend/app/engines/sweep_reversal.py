"""Closed-bar Sweep Reversal detector.

The state machine follows ``indi sweep reversal.txt`` with two intentional
platform changes: a sweep starts on a candle *close* beyond the level (rather
than a wick touch), and an optional ATR-sized equal-swing liquidity pool can
replace the latest single swing.  It is deliberately independent from the
mGann Break L/S engine and the auto-trading path.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.models.timestamp import CanonicalTimestamp

__all__ = [
    "SWEEP_REVERSAL_DEFAULT_ATR_LENGTH",
    "SWEEP_REVERSAL_DEFAULT_LIQUIDITY_ATR_LENGTH",
    "SWEEP_REVERSAL_DEFAULT_LIQUIDITY_ATR_MARGIN",
    "SWEEP_REVERSAL_DEFAULT_LIQUIDITY_LOOKBACK_BARS",
    "SWEEP_REVERSAL_DEFAULT_LIQUIDITY_MIN_PIVOTS",
    "SWEEP_REVERSAL_DEFAULT_MAX_CONFIRMATION_BARS",
    "SWEEP_REVERSAL_DEFAULT_MIN_DISPLACEMENT_ATR",
    "SWEEP_REVERSAL_DEFAULT_MIN_PENETRATION_ATR",
    "SWEEP_REVERSAL_DEFAULT_STRUCTURE_LENGTH",
    "SWEEP_REVERSAL_DEFAULT_SWING_LENGTH",
    "SWEEP_REVERSAL_TIMEFRAMES",
    "SweepReversalBar",
    "SweepReversalState",
    "SweepReversalTrigger",
]


SWEEP_REVERSAL_TIMEFRAMES = (
    "15s",
    "1m",
    "3m",
    "5m",
    "15m",
    "30m",
    "1h",
    "4h",
    "1D",
)
SWEEP_REVERSAL_DEFAULT_SWING_LENGTH = 5
SWEEP_REVERSAL_DEFAULT_ATR_LENGTH = 14
SWEEP_REVERSAL_DEFAULT_MIN_PENETRATION_ATR = 0.0
SWEEP_REVERSAL_DEFAULT_STRUCTURE_LENGTH = 3
SWEEP_REVERSAL_DEFAULT_MAX_CONFIRMATION_BARS = 12
SWEEP_REVERSAL_DEFAULT_MIN_DISPLACEMENT_ATR = 0.2
SWEEP_REVERSAL_DEFAULT_LIQUIDITY_MIN_PIVOTS = 2
SWEEP_REVERSAL_DEFAULT_LIQUIDITY_LOOKBACK_BARS = 120
SWEEP_REVERSAL_DEFAULT_LIQUIDITY_ATR_LENGTH = 10
SWEEP_REVERSAL_DEFAULT_LIQUIDITY_ATR_MARGIN = 4.0


@dataclass(frozen=True, slots=True)
class SweepReversalBar:
    time: CanonicalTimestamp
    open: float
    high: float
    low: float
    close: float
    volume: int = 0


@dataclass(frozen=True, slots=True)
class SweepReversalTrigger:
    direction: int
    signal_time: CanonicalTimestamp
    signal_price: float
    sweep_time: CanonicalTimestamp
    sweep_level: float
    sweep_extreme: float
    confirmation_level: float
    pivot_times: tuple[CanonicalTimestamp, ...]
    pivot_prices: tuple[float, ...]

    @property
    def liquidity_count(self) -> int:
        return len(self.pivot_prices)


@dataclass(frozen=True, slots=True)
class _Pivot:
    price: float
    bar_index: int
    time: CanonicalTimestamp


@dataclass(slots=True)
class _Level:
    side: str
    level: float
    pivot_indices: tuple[int, ...]
    pivot_prices: tuple[float, ...]
    pivot_times: tuple[CanonicalTimestamp, ...]
    available: bool = True


@dataclass(slots=True)
class _Pool:
    side: str
    top: float
    bottom: float
    pivot_indices: set[int]
    pivot_prices: tuple[float, ...]
    pivot_times: tuple[CanonicalTimestamp, ...]
    consumed: bool = False

    @property
    def newest_pivot_index(self) -> int:
        return max(self.pivot_indices)


@dataclass(slots=True)
class _Candidate:
    direction: int
    start_index: int
    sweep_time: CanonicalTimestamp
    level: float
    extreme: float
    confirmation_level: float
    pivot_times: tuple[CanonicalTimestamp, ...]
    pivot_prices: tuple[float, ...]
    reclaimed: bool = False


@dataclass(slots=True)
class _WilderAtr:
    period: int
    values: list[float] = field(default_factory=list)
    value: float | None = None

    def update(self, true_range: float) -> float | None:
        if self.value is None:
            self.values.append(float(true_range))
            if len(self.values) == self.period:
                self.value = sum(self.values) / self.period
                self.values.clear()
        else:
            self.value += (float(true_range) - self.value) / self.period
        return self.value


class SweepReversalState:
    """Track close-through sweep candidates and emit confirmed reversals."""

    def __init__(
        self,
        *,
        swing_length: int = SWEEP_REVERSAL_DEFAULT_SWING_LENGTH,
        atr_length: int = SWEEP_REVERSAL_DEFAULT_ATR_LENGTH,
        min_penetration_atr: float = SWEEP_REVERSAL_DEFAULT_MIN_PENETRATION_ATR,
        structure_length: int = SWEEP_REVERSAL_DEFAULT_STRUCTURE_LENGTH,
        max_confirmation_bars: int = SWEEP_REVERSAL_DEFAULT_MAX_CONFIRMATION_BARS,
        min_displacement_atr: float = SWEEP_REVERSAL_DEFAULT_MIN_DISPLACEMENT_ATR,
        equal_swing_filter: bool = False,
        liquidity_min_pivots: int = SWEEP_REVERSAL_DEFAULT_LIQUIDITY_MIN_PIVOTS,
        liquidity_lookback_bars: int = SWEEP_REVERSAL_DEFAULT_LIQUIDITY_LOOKBACK_BARS,
        liquidity_atr_length: int = SWEEP_REVERSAL_DEFAULT_LIQUIDITY_ATR_LENGTH,
        liquidity_atr_margin: float = SWEEP_REVERSAL_DEFAULT_LIQUIDITY_ATR_MARGIN,
    ) -> None:
        self._swing_length = max(2, int(swing_length))
        self._min_penetration_atr = max(0.0, float(min_penetration_atr))
        self._structure_length = max(1, int(structure_length))
        self._max_confirmation_bars = max(1, int(max_confirmation_bars))
        self._min_displacement_atr = max(0.0, float(min_displacement_atr))
        self._equal_swing_filter = bool(equal_swing_filter)
        self._liquidity_min_pivots = max(2, int(liquidity_min_pivots))
        self._liquidity_lookback_bars = max(1, int(liquidity_lookback_bars))
        self._liquidity_atr_margin = max(0.0, float(liquidity_atr_margin))
        self._atr = _WilderAtr(max(1, int(atr_length)))
        self._liquidity_atr = _WilderAtr(max(1, int(liquidity_atr_length)))
        self._bars: list[SweepReversalBar] = []
        self._indices: list[int] = []
        self._bar_index = -1
        self._last_bar_time: CanonicalTimestamp | None = None
        self._previous_close: float | None = None
        self._current_atr: float | None = None
        self._current_liquidity_atr: float | None = None
        self._swing_high: _Level | None = None
        self._swing_low: _Level | None = None
        self._swing_highs: list[_Pivot] = []
        self._swing_lows: list[_Pivot] = []
        self._pools: list[_Pool] = []
        self._bearish: _Candidate | None = None
        self._bullish: _Candidate | None = None
        self._max_buffer = max(
            2_000,
            self._liquidity_lookback_bars
            + self._swing_length * 4
            + self._max_confirmation_bars
            + 100,
        )

    def on_closed_bar(self, bar: SweepReversalBar) -> list[SweepReversalTrigger]:
        if self._last_bar_time is not None and bar.time <= self._last_bar_time:
            return []
        self._last_bar_time = bar.time
        self._bar_index += 1
        self._bars.append(bar)
        self._indices.append(self._bar_index)

        previous_close = self._previous_close
        true_range = max(
            0.0,
            float(bar.high) - float(bar.low),
            abs(float(bar.high) - previous_close) if previous_close is not None else 0.0,
            abs(float(bar.low) - previous_close) if previous_close is not None else 0.0,
        )
        self._previous_close = float(bar.close)
        self._current_atr = self._atr.update(true_range)
        self._current_liquidity_atr = self._liquidity_atr.update(true_range)

        self._confirm_new_pivots()
        self._start_candidates(bar)
        bearish_trigger, bearish_expired = self._advance_candidate(self._bearish, bar)
        bullish_trigger, bullish_expired = self._advance_candidate(self._bullish, bar)
        if bearish_trigger is not None or bearish_expired:
            self._bearish = None
        if bullish_trigger is not None or bullish_expired:
            self._bullish = None

        self._prune()
        if bearish_trigger is not None and bullish_trigger is not None:
            return []
        if bearish_trigger is not None:
            return [bearish_trigger]
        if bullish_trigger is not None:
            return [bullish_trigger]
        return []

    def _confirm_new_pivots(self) -> None:
        length = self._swing_length
        if len(self._bars) < length * 2 + 1:
            return
        candidate_pos = len(self._bars) - length - 1
        candidate = self._bars[candidate_pos]
        candidate_index = self._indices[candidate_pos]
        left = self._bars[candidate_pos - length : candidate_pos]
        right = self._bars[candidate_pos + 1 : candidate_pos + length + 1]
        if float(candidate.high) > max(float(item.high) for item in left) and float(
            candidate.high
        ) >= max(float(item.high) for item in right):
            pivot = _Pivot(float(candidate.high), candidate_index, candidate.time)
            self._swing_high = _Level(
                side="buy",
                level=pivot.price,
                pivot_indices=(pivot.bar_index,),
                pivot_prices=(pivot.price,),
                pivot_times=(pivot.time,),
            )
            self._register_liquidity_pivot(pivot, "buy")
        if float(candidate.low) < min(float(item.low) for item in left) and float(
            candidate.low
        ) <= min(float(item.low) for item in right):
            pivot = _Pivot(float(candidate.low), candidate_index, candidate.time)
            self._swing_low = _Level(
                side="sell",
                level=pivot.price,
                pivot_indices=(pivot.bar_index,),
                pivot_prices=(pivot.price,),
                pivot_times=(pivot.time,),
            )
            self._register_liquidity_pivot(pivot, "sell")

    def _register_liquidity_pivot(self, pivot: _Pivot, side: str) -> None:
        history = self._swing_highs if side == "buy" else self._swing_lows
        history.append(pivot)
        cutoff = self._bar_index - self._liquidity_lookback_bars
        history[:] = [point for point in history if point.bar_index >= cutoff]
        if not self._equal_swing_filter:
            return
        atr = self._current_liquidity_atr
        if atr is None or atr <= 0 or self._liquidity_atr_margin <= 0:
            return
        width = atr * self._liquidity_atr_margin / 10.0
        consumed_indices = {
            index
            for pool in self._pools
            if pool.side == side and pool.consumed
            for index in pool.pivot_indices
        }
        cluster: list[_Pivot] = []
        for point in reversed(history):
            if abs(point.price - pivot.price) > width:
                break
            if point.bar_index not in consumed_indices:
                cluster.append(point)
        cluster.reverse()
        if len(cluster) < self._liquidity_min_pivots:
            return
        indices = {point.bar_index for point in cluster}
        prices = tuple(point.price for point in cluster)
        times = tuple(point.time for point in cluster)
        center = (min(prices) + max(prices)) / 2.0
        existing = next(
            (
                pool
                for pool in self._pools
                if not pool.consumed
                and pool.side == side
                and bool(pool.pivot_indices.intersection(indices))
            ),
            None,
        )
        if existing is None:
            self._pools.append(
                _Pool(
                    side=side,
                    top=center + width,
                    bottom=center - width,
                    pivot_indices=indices,
                    pivot_prices=prices,
                    pivot_times=times,
                )
            )
        else:
            existing.top = center + width
            existing.bottom = center - width
            existing.pivot_indices = indices
            existing.pivot_prices = prices
            existing.pivot_times = times

    def _start_candidates(self, bar: SweepReversalBar) -> None:
        if len(self._bars) <= self._structure_length:
            return
        prior = self._bars[-self._structure_length - 1 : -1]
        penetration = (self._current_atr or 0.0) * self._min_penetration_atr
        close = float(bar.close)
        if self._bearish is None:
            level = self._take_bearish_level(close, penetration)
            if level is not None:
                self._bearish = _Candidate(
                    direction=-1,
                    start_index=self._bar_index,
                    sweep_time=bar.time,
                    level=level.level,
                    extreme=float(bar.high),
                    confirmation_level=min(float(item.low) for item in prior),
                    pivot_times=level.pivot_times,
                    pivot_prices=level.pivot_prices,
                )
        if self._bullish is None:
            level = self._take_bullish_level(close, penetration)
            if level is not None:
                self._bullish = _Candidate(
                    direction=1,
                    start_index=self._bar_index,
                    sweep_time=bar.time,
                    level=level.level,
                    extreme=float(bar.low),
                    confirmation_level=max(float(item.high) for item in prior),
                    pivot_times=level.pivot_times,
                    pivot_prices=level.pivot_prices,
                )

    def _take_bearish_level(self, close: float, penetration: float) -> _Level | None:
        if not self._equal_swing_filter:
            level = self._swing_high
            if level is None or not level.available or close <= level.level + penetration:
                return None
            level.available = False
            return level
        breached = [
            pool
            for pool in self._pools
            if pool.side == "buy"
            and not pool.consumed
            and close > pool.top + penetration
        ]
        if not breached:
            return None
        chosen = max(breached, key=lambda item: item.newest_pivot_index)
        for pool in breached:
            pool.consumed = True
        return _Level(
            side="buy",
            level=chosen.top,
            pivot_indices=tuple(sorted(chosen.pivot_indices)),
            pivot_prices=chosen.pivot_prices,
            pivot_times=chosen.pivot_times,
            available=False,
        )

    def _take_bullish_level(self, close: float, penetration: float) -> _Level | None:
        if not self._equal_swing_filter:
            level = self._swing_low
            if level is None or not level.available or close >= level.level - penetration:
                return None
            level.available = False
            return level
        breached = [
            pool
            for pool in self._pools
            if pool.side == "sell"
            and not pool.consumed
            and close < pool.bottom - penetration
        ]
        if not breached:
            return None
        chosen = max(breached, key=lambda item: item.newest_pivot_index)
        for pool in breached:
            pool.consumed = True
        return _Level(
            side="sell",
            level=chosen.bottom,
            pivot_indices=tuple(sorted(chosen.pivot_indices)),
            pivot_prices=chosen.pivot_prices,
            pivot_times=chosen.pivot_times,
            available=False,
        )

    def _advance_candidate(
        self,
        candidate: _Candidate | None,
        bar: SweepReversalBar,
    ) -> tuple[SweepReversalTrigger | None, bool]:
        if candidate is None:
            return None, False
        if candidate.direction < 0:
            candidate.extreme = max(candidate.extreme, float(bar.high))
            candidate.reclaimed = candidate.reclaimed or float(bar.close) < candidate.level
            confirmed = (
                candidate.reclaimed
                and float(bar.close) < candidate.confirmation_level
                and self._displacement_passes(bar)
            )
        else:
            candidate.extreme = min(candidate.extreme, float(bar.low))
            candidate.reclaimed = candidate.reclaimed or float(bar.close) > candidate.level
            confirmed = (
                candidate.reclaimed
                and float(bar.close) > candidate.confirmation_level
                and self._displacement_passes(bar)
            )
        if confirmed:
            return (
                SweepReversalTrigger(
                    direction=candidate.direction,
                    signal_time=bar.time,
                    signal_price=float(bar.close),
                    sweep_time=candidate.sweep_time,
                    sweep_level=candidate.level,
                    sweep_extreme=candidate.extreme,
                    confirmation_level=candidate.confirmation_level,
                    pivot_times=candidate.pivot_times,
                    pivot_prices=candidate.pivot_prices,
                ),
                False,
            )
        return None, self._bar_index - candidate.start_index > self._max_confirmation_bars

    def _displacement_passes(self, bar: SweepReversalBar) -> bool:
        return self._current_atr is not None and abs(float(bar.close) - float(bar.open)) >= (
            self._current_atr * self._min_displacement_atr
        )

    def _prune(self) -> None:
        cutoff = self._bar_index - self._liquidity_lookback_bars
        self._pools = [
            pool
            for pool in self._pools[-160:]
            if not pool.consumed or pool.newest_pivot_index >= cutoff
        ]
        overflow = len(self._bars) - self._max_buffer
        if overflow > 0:
            del self._bars[:overflow]
            del self._indices[:overflow]
