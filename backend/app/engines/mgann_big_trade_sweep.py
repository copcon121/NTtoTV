"""mGann pivot sweep detection gated by BigTrade and wide-volume bars."""

from __future__ import annotations

from dataclasses import dataclass

from app.models.timestamp import CanonicalTimestamp

__all__ = [
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_BIG_TRADE_THRESHOLD",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_BREAK_TICKS",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_CONFIRMATION_BARS",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_CUTS",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_SPREAD_TICKS",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_VOLUME",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_LOOKBACK_BARS",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_TOLERANCE_TICKS",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_LOOKBACK",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_MULTIPLIER",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_WICK_TICKS",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_SWING_SIZE",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_TIMEFRAME",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_LOOKBACK",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_MULTIPLIER",
    "MGANN_BIG_TRADE_SWEEP_TIMEFRAMES",
    "MgannBigTradeSweepBar",
    "MgannBigTradeSweepState",
    "MgannBigTradeSweepTrigger",
]

MGANN_BIG_TRADE_SWEEP_DEFAULT_TIMEFRAME = "1m"
MGANN_BIG_TRADE_SWEEP_TIMEFRAMES = ("1m",)
MGANN_BIG_TRADE_SWEEP_DEFAULT_BIG_TRADE_THRESHOLD = 70.0
MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_VOLUME = 0
MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_LOOKBACK = 20
MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_MULTIPLIER = 2.0
MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_SPREAD_TICKS = 0
MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_LOOKBACK = 20
MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_MULTIPLIER = 2.0
MGANN_BIG_TRADE_SWEEP_DEFAULT_SWING_SIZE = 2
MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_LOOKBACK_BARS = 120
MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_CUTS = 2
MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_TOLERANCE_TICKS = 5
MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_WICK_TICKS = 2
MGANN_BIG_TRADE_SWEEP_DEFAULT_CONFIRMATION_BARS = 2
MGANN_BIG_TRADE_SWEEP_DEFAULT_BREAK_TICKS = 0

_TICK_SIZE = 0.1
_TIMEFRAME_MS = {"1m": 60_000}


@dataclass(slots=True)
class MgannBigTradeSweepBar:
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


@dataclass(slots=True)
class _BigTradeBucket:
    time: CanonicalTimestamp
    price: float
    volume: int


@dataclass(slots=True)
class _SweepCandidate:
    id: str
    direction: int
    bar_index: int
    bar_time: CanonicalTimestamp
    price: float
    levels: tuple[float, ...]


@dataclass(slots=True)
class _Liquidity:
    big_trade_volume: int
    big_trade_price: float
    bar_volume: int
    bar_spread: float
    avg_volume: float | None
    avg_spread: float | None


@dataclass(slots=True)
class MgannBigTradeSweepTrigger:
    direction: int
    signal_time: CanonicalTimestamp
    signal_price: float
    cut_time: CanonicalTimestamp
    cut_price: float
    cut_count: int
    cut_levels: tuple[float, ...]
    big_trade_volume: int
    big_trade_price: float
    bar_volume: int
    bar_spread: float
    avg_volume: float | None
    avg_spread: float | None


class MgannBigTradeSweepState:
    """Track mGann pivots and emit when a liquidity bar confirms a pivot sweep."""

    def __init__(
        self,
        *,
        timeframe: str = MGANN_BIG_TRADE_SWEEP_DEFAULT_TIMEFRAME,
        big_trade_threshold: float = MGANN_BIG_TRADE_SWEEP_DEFAULT_BIG_TRADE_THRESHOLD,
        min_volume: int = MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_VOLUME,
        volume_lookback: int = MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_LOOKBACK,
        volume_multiplier: float = MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_MULTIPLIER,
        min_spread_ticks: int = MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_SPREAD_TICKS,
        spread_lookback: int = MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_LOOKBACK,
        spread_multiplier: float = MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_MULTIPLIER,
        swing_size: int = MGANN_BIG_TRADE_SWEEP_DEFAULT_SWING_SIZE,
        pivot_lookback_bars: int = MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_LOOKBACK_BARS,
        min_pivot_cuts: int = MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_CUTS,
        pivot_tolerance_ticks: int = MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_TOLERANCE_TICKS,
        min_pivot_wick_ticks: int = MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_WICK_TICKS,
        confirmation_bars: int = MGANN_BIG_TRADE_SWEEP_DEFAULT_CONFIRMATION_BARS,
        break_ticks: int = MGANN_BIG_TRADE_SWEEP_DEFAULT_BREAK_TICKS,
        tick_size: float = _TICK_SIZE,
    ) -> None:
        self._timeframe = timeframe if timeframe in _TIMEFRAME_MS else "1m"
        self._duration_ms = _TIMEFRAME_MS[self._timeframe]
        self._big_trade_threshold = max(0.0, float(big_trade_threshold))
        self._min_volume = max(0, int(min_volume))
        self._volume_lookback = max(1, int(volume_lookback))
        self._volume_multiplier = max(0.0, float(volume_multiplier))
        self._min_spread = max(0, int(min_spread_ticks)) * float(tick_size)
        self._spread_lookback = max(1, int(spread_lookback))
        self._spread_multiplier = max(0.0, float(spread_multiplier))
        self._swing_size = max(1, int(swing_size))
        self._pivot_lookback_bars = max(1, int(pivot_lookback_bars))
        self._min_pivot_cuts = max(1, int(min_pivot_cuts))
        self._pivot_tolerance = max(0, int(pivot_tolerance_ticks)) * float(tick_size)
        self._min_pivot_wick = max(0, int(min_pivot_wick_ticks)) * float(tick_size)
        self._confirmation_bars = max(0, int(confirmation_bars))
        self._break_distance = max(0, int(break_ticks)) * float(tick_size)
        self._max_bars = max(
            500,
            self._pivot_lookback_bars
            + max(self._volume_lookback, self._spread_lookback)
            + self._confirmation_bars
            + self._swing_size * 20
            + 50,
        )
        self._bars: list[MgannBigTradeSweepBar] = []
        self._big_trades: dict[CanonicalTimestamp, _BigTradeBucket] = {}
        self._candidates: list[_SweepCandidate] = []
        self._fired_candidates: set[str] = set()
        self._last_bar_time: CanonicalTimestamp | None = None

    def on_big_trade(
        self,
        *,
        time: CanonicalTimestamp,
        price: float,
        volume: int,
    ) -> None:
        bucket_time = self._bucket_time(time)
        existing = self._big_trades.get(bucket_time)
        if existing is None or volume > existing.volume:
            self._big_trades[bucket_time] = _BigTradeBucket(
                time=bucket_time,
                price=float(price),
                volume=int(volume),
            )

    def on_closed_bar(
        self,
        bar: MgannBigTradeSweepBar,
    ) -> list[MgannBigTradeSweepTrigger]:
        if self._last_bar_time is not None and bar.time <= self._last_bar_time:
            return []
        self._last_bar_time = bar.time
        self._bars.append(bar)

        index = len(self._bars) - 1
        self._candidates.extend(self._detect_sweeps(index))
        trigger = self._trigger_for_bar(index)
        self._prune_state(index)
        return [] if trigger is None else [trigger]

    def _bucket_time(self, time: CanonicalTimestamp) -> CanonicalTimestamp:
        return int(time) - (int(time) % self._duration_ms)

    def _trigger_for_bar(
        self,
        index: int,
    ) -> MgannBigTradeSweepTrigger | None:
        liquidity = self._liquidity_for_bar(index)
        if liquidity is None:
            return None

        eligible = [
            candidate
            for candidate in self._candidates
            if 0 <= index - candidate.bar_index <= self._confirmation_bars
            and candidate.id not in self._fired_candidates
        ]
        if not eligible:
            return None
        eligible.sort(
            key=lambda candidate: (
                candidate.bar_index,
                len(candidate.levels),
                abs(candidate.price),
            ),
            reverse=True,
        )
        candidate = eligible[0]
        self._fired_candidates.add(candidate.id)

        bar = self._bars[index]
        signal_price = float(bar.high if candidate.direction > 0 else bar.low)
        return MgannBigTradeSweepTrigger(
            direction=candidate.direction,
            signal_time=bar.time,
            signal_price=signal_price,
            cut_time=candidate.bar_time,
            cut_price=candidate.price,
            cut_count=len(candidate.levels),
            cut_levels=candidate.levels,
            big_trade_volume=liquidity.big_trade_volume,
            big_trade_price=liquidity.big_trade_price,
            bar_volume=liquidity.bar_volume,
            bar_spread=liquidity.bar_spread,
            avg_volume=liquidity.avg_volume,
            avg_spread=liquidity.avg_spread,
        )

    def _liquidity_for_bar(self, index: int) -> _Liquidity | None:
        bar = self._bars[index]
        big_trade = self._big_trades.get(bar.time)
        if big_trade is None:
            return None
        if float(big_trade.volume) <= self._big_trade_threshold:
            return None
        if int(bar.volume) < self._min_volume:
            return None

        avg_volume = self._average_volume_before(index)
        if (
            avg_volume is not None
            and avg_volume > 0
            and self._volume_multiplier > 0
            and float(bar.volume) < avg_volume * self._volume_multiplier
        ):
            return None

        spread = float(bar.high) - float(bar.low)
        if spread < self._min_spread:
            return None
        avg_spread = self._average_spread_before(index)
        if (
            avg_spread is not None
            and avg_spread > 0
            and self._spread_multiplier > 0
            and spread < avg_spread * self._spread_multiplier
        ):
            return None

        return _Liquidity(
            big_trade_volume=big_trade.volume,
            big_trade_price=big_trade.price,
            bar_volume=int(bar.volume),
            bar_spread=spread,
            avg_volume=avg_volume,
            avg_spread=avg_spread,
        )

    def _average_volume_before(self, index: int) -> float | None:
        values = [
            float(bar.volume)
            for bar in self._bars[max(0, index - self._volume_lookback):index]
        ]
        return _average(values)

    def _average_spread_before(self, index: int) -> float | None:
        values = [
            float(bar.high) - float(bar.low)
            for bar in self._bars[max(0, index - self._spread_lookback):index]
        ]
        return _average(values)

    def _detect_sweeps(self, index: int) -> list[_SweepCandidate]:
        if index <= 0:
            return []
        bar = self._bars[index]
        previous = self._bars[index - 1]
        pivots = [
            pivot
            for pivot in self._refined_pivots()
            if pivot.index < index
            and index - pivot.index <= self._pivot_lookback_bars
        ]
        candidates: list[_SweepCandidate] = []
        is_bullish_breakout = float(bar.close) > float(bar.open)
        is_bearish_breakout = float(bar.close) < float(bar.open)
        if is_bullish_breakout:
            levels = self._breakout_zone_levels(
                direction=1,
                pivots=pivots,
                previous=previous,
                bar=bar,
            )
            if levels is not None:
                price = max(levels)
                candidates.append(
                    _SweepCandidate(
                        id=self._candidate_id(1, bar.time, levels),
                        direction=1,
                        bar_index=index,
                        bar_time=bar.time,
                        price=price,
                        levels=tuple(sorted(levels, reverse=True)),
                    )
                )
        if is_bearish_breakout:
            levels = self._breakout_zone_levels(
                direction=-1,
                pivots=pivots,
                previous=previous,
                bar=bar,
            )
            if levels is not None:
                price = min(levels)
                candidates.append(
                    _SweepCandidate(
                        id=self._candidate_id(-1, bar.time, levels),
                        direction=-1,
                        bar_index=index,
                        bar_time=bar.time,
                        price=price,
                        levels=tuple(sorted(levels)),
                    )
                )
        return candidates

    def _breakout_zone_levels(
        self,
        *,
        direction: int,
        pivots: list[_Pivot],
        previous: MgannBigTradeSweepBar,
        bar: MgannBigTradeSweepBar,
    ) -> tuple[float, ...] | None:
        kind = "high" if direction > 0 else "low"
        zones = self._pivot_zones(
            [
                pivot
                for pivot in pivots
                if pivot.kind == kind and self._has_rejection_wick(pivot)
            ],
            direction=direction,
        )
        crossed: list[tuple[float, ...]] = []
        for levels in zones:
            zone_high = max(levels)
            zone_low = min(levels)
            if direction > 0:
                breakout_price = zone_high + self._break_distance
                if float(previous.high) < breakout_price <= float(bar.high):
                    crossed.append(levels)
            else:
                breakout_price = zone_low - self._break_distance
                if float(previous.low) > breakout_price >= float(bar.low):
                    crossed.append(levels)
        if not crossed:
            return None
        crossed.sort(
            key=lambda levels: (
                len(levels),
                max(levels) if direction > 0 else -min(levels),
                -max(levels) + min(levels),
            ),
            reverse=True,
        )
        return crossed[0]

    def _pivot_zones(
        self,
        pivots: list[_Pivot],
        *,
        direction: int,
    ) -> list[tuple[float, ...]]:
        if len(pivots) < self._min_pivot_cuts:
            return []
        sorted_pivots = sorted(pivots, key=lambda pivot: pivot.price)
        zones: list[tuple[float, ...]] = []
        seen: set[tuple[float, ...]] = set()
        for start, base in enumerate(sorted_pivots):
            levels = [
                pivot.price
                for pivot in sorted_pivots[start:]
                if pivot.price - base.price <= self._pivot_tolerance + 1e-9
            ]
            if len(levels) < self._min_pivot_cuts:
                continue
            ordered = (
                tuple(sorted(levels, reverse=True))
                if direction > 0
                else tuple(sorted(levels))
            )
            key = tuple(round(level, 10) for level in ordered)
            if key in seen:
                continue
            seen.add(key)
            zones.append(ordered)
        return zones

    def _has_rejection_wick(self, pivot: _Pivot) -> bool:
        if self._min_pivot_wick <= 0:
            return True
        bar = self._bars[pivot.index]
        if pivot.kind == "high":
            wick = float(bar.high) - max(float(bar.open), float(bar.close))
        else:
            wick = min(float(bar.open), float(bar.close)) - float(bar.low)
        return wick + 1e-9 >= self._min_pivot_wick

    @staticmethod
    def _candidate_id(
        direction: int,
        time: CanonicalTimestamp,
        levels: tuple[float, ...],
    ) -> str:
        parts = ",".join(f"{level:.4f}" for level in sorted(levels))
        return f"{direction}:{time}:{parts}"

    def _refined_pivots(self) -> list[_Pivot]:
        return self._refine_pivots(self._collect_pivots())

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
                    self._push_pivot(pivots, ext_low_idx, "low")
                    direction = 1
                    ext_high = bar.high
                    ext_high_idx = index
                    ext_low = bar.low
                    ext_low_idx = index
                elif rev_down:
                    self._push_pivot(pivots, ext_high_idx, "high")
                    direction = -1
                    ext_high = bar.high
                    ext_high_idx = index
                    ext_low = bar.low
                    ext_low_idx = index
                continue

            if direction == 1 and rev_down:
                self._push_pivot(pivots, ext_high_idx, "high")
                direction = -1
                ext_high = bar.high
                ext_high_idx = index
                ext_low = bar.low
                ext_low_idx = index
            elif direction == -1 and rev_up:
                self._push_pivot(pivots, ext_low_idx, "low")
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
            )
        )

    def _refine_pivots(self, pivots: list[_Pivot]) -> list[_Pivot]:
        if len(pivots) < 3:
            return list(pivots)

        refined: list[_Pivot] = []
        for pivot_index, pivot in enumerate(pivots):
            if pivot_index == 0 or pivot_index == len(pivots) - 1:
                refined.append(pivot)
                continue

            previous = refined[-1] if refined else None
            next_pivot = pivots[pivot_index + 1]
            original_previous = pivots[pivot_index - 1]
            if previous is None:
                refined.append(pivot)
                continue

            start = max(previous.index + 1, original_previous.index + 1)
            end = min(next_pivot.index - 1, len(self._bars) - 1)
            if start > end:
                refined.append(pivot)
                continue

            best_index = start
            first = self._bars[start]
            best_price = first.high if pivot.kind == "high" else first.low
            for index in range(start, end + 1):
                bar = self._bars[index]
                if pivot.kind == "high" and bar.high >= best_price:
                    best_price = bar.high
                    best_index = index
                elif pivot.kind == "low" and bar.low <= best_price:
                    best_price = bar.low
                    best_index = index

            refined.append(
                _Pivot(
                    index=best_index,
                    time=self._bars[best_index].time,
                    price=best_price,
                    kind=pivot.kind,
                )
            )

        return refined

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

    def _prune_state(self, index: int) -> None:
        min_candidate_index = index - self._confirmation_bars
        self._candidates = [
            candidate
            for candidate in self._candidates
            if candidate.bar_index >= min_candidate_index
        ]
        overflow = len(self._bars) - self._max_bars
        if overflow > 0:
            del self._bars[:overflow]
            adjusted: list[_SweepCandidate] = []
            for candidate in self._candidates:
                if candidate.bar_index < overflow:
                    continue
                candidate.bar_index -= overflow
                adjusted.append(candidate)
            self._candidates = adjusted
        if not self._bars:
            return
        oldest_bar_time = self._bars[0].time
        stale = [
            bucket_time
            for bucket_time in self._big_trades
            if bucket_time < oldest_bar_time
        ]
        for bucket_time in stale:
            self._big_trades.pop(bucket_time, None)


def _average(values: list[float]) -> float | None:
    if not values:
        return None
    return sum(values) / len(values)
