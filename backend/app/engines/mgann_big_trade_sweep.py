"""mGann Break L/S detection with optional BigTrade confirmation."""

from __future__ import annotations

from dataclasses import dataclass

from app.models.timestamp import CanonicalTimestamp

from .smc_external import SmcBar, SmcBreakEvent, SmcExternalDetector

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
MGANN_BIG_TRADE_SWEEP_DEFAULT_SWING_SIZE = 5
MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_LOOKBACK_BARS = 120
MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_CUTS = 2
MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_TOLERANCE_TICKS = 5
MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_WICK_TICKS = 2
MGANN_BIG_TRADE_SWEEP_DEFAULT_CONFIRMATION_BARS = 2
MGANN_BIG_TRADE_SWEEP_DEFAULT_BREAK_TICKS = 0

_TICK_SIZE = 0.1
_TIMEFRAME_MS = {"1m": 60_000}
_MIN_BODY_RANGE_RATIO = 0.5


@dataclass(slots=True)
class MgannBigTradeSweepBar:
    time: CanonicalTimestamp
    open: float
    high: float
    low: float
    close: float
    volume: int


@dataclass(slots=True)
class _BigTradeBucket:
    time: CanonicalTimestamp
    price: float
    volume: int


@dataclass(slots=True)
class _BreakCandidate:
    id: str
    direction: int
    bar_index: int
    break_time: CanonicalTimestamp
    pivot_time: CanonicalTimestamp
    pivot_price: float
    structure_kind: str


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
    structure_kind: str


class MgannBigTradeSweepState:
    """Track SMC internal BOS/CHoCH and emit Break L/S signals."""

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
        require_big_trade: bool = True,
        tick_size: float = _TICK_SIZE,
    ) -> None:
        self._timeframe = timeframe if timeframe in _TIMEFRAME_MS else "1m"
        self._duration_ms = _TIMEFRAME_MS[self._timeframe]
        self._big_trade_threshold = max(0.0, float(big_trade_threshold))
        self._require_big_trade = bool(require_big_trade)
        self._min_volume = max(0, int(min_volume))
        self._volume_lookback = max(1, int(volume_lookback))
        self._volume_multiplier = max(0.0, float(volume_multiplier))
        self._min_spread = max(0, int(min_spread_ticks)) * float(tick_size)
        self._spread_lookback = max(1, int(spread_lookback))
        self._spread_multiplier = max(0.0, float(spread_multiplier))
        self._swing_size = max(1, int(swing_size))
        self._confirmation_bars = max(0, int(confirmation_bars))
        self._break_distance = max(0, int(break_ticks)) * float(tick_size)
        self._max_bars = max(
            500,
            int(pivot_lookback_bars)
            + max(self._volume_lookback, self._spread_lookback)
            + self._confirmation_bars
            + self._swing_size * 8
            + int(min_pivot_cuts)
            + int(pivot_tolerance_ticks)
            + int(min_pivot_wick_ticks)
            + 40,
        )
        self._detector = SmcExternalDetector(self._swing_size)
        self._bars: list[MgannBigTradeSweepBar] = []
        self._big_trades: dict[CanonicalTimestamp, _BigTradeBucket] = {}
        self._candidates: list[_BreakCandidate] = []
        self._fired_candidates: set[str] = set()
        self._last_bar_time: CanonicalTimestamp | None = None
        self._regime_direction = 0

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
        event = self._detector.update(
            SmcBar(
                time=bar.time,
                open=bar.open,
                high=bar.high,
                low=bar.low,
                close=bar.close,
                volume=bar.volume,
            )
        )
        if event is not None:
            self._add_candidate(index, event)

        trigger = self._trigger_for_bar(index)
        self._prune_state(index)
        return [] if trigger is None else [trigger]

    def _bucket_time(self, time: CanonicalTimestamp) -> CanonicalTimestamp:
        return int(time) - (int(time) % self._duration_ms)

    def _add_candidate(self, index: int, event: SmcBreakEvent) -> None:
        if event.direction not in (-1, 1):
            return
        if self._regime_direction != event.direction:
            self._regime_direction = event.direction
            self._candidates = [
                candidate
                for candidate in self._candidates
                if candidate.direction == event.direction
            ]
        candidate = _BreakCandidate(
            id=self._candidate_id(event),
            direction=event.direction,
            bar_index=index,
            break_time=event.break_time,
            pivot_time=event.pivot_time,
            pivot_price=float(event.level),
            structure_kind=event.kind,
        )
        self._candidates.append(candidate)

    def _trigger_for_bar(
        self,
        index: int,
    ) -> MgannBigTradeSweepTrigger | None:
        bar = self._bars[index]
        eligible = [
            candidate
            for candidate in self._candidates
            if 0 <= index - candidate.bar_index <= self._confirmation_bars
            and candidate.id not in self._fired_candidates
            and self._bar_confirms_candidate(bar, candidate)
        ]
        if not eligible:
            return None
        eligible.sort(
            key=lambda candidate: (
                candidate.bar_index,
                candidate.break_time,
                abs(candidate.pivot_price),
            ),
            reverse=True,
        )
        candidate = eligible[0]
        liquidity = self._liquidity_for_bar(index, candidate.direction)
        if liquidity is None:
            return None

        self._fired_candidates.add(candidate.id)
        signal_price = float(bar.high if candidate.direction > 0 else bar.low)
        return MgannBigTradeSweepTrigger(
            direction=candidate.direction,
            signal_time=bar.time,
            signal_price=signal_price,
            cut_time=candidate.pivot_time,
            cut_price=candidate.pivot_price,
            cut_count=1,
            cut_levels=(candidate.pivot_price,),
            big_trade_volume=liquidity.big_trade_volume,
            big_trade_price=liquidity.big_trade_price,
            bar_volume=liquidity.bar_volume,
            bar_spread=liquidity.bar_spread,
            avg_volume=liquidity.avg_volume,
            avg_spread=liquidity.avg_spread,
            structure_kind=candidate.structure_kind,
        )

    def _bar_confirms_candidate(
        self,
        bar: MgannBigTradeSweepBar,
        candidate: _BreakCandidate,
    ) -> bool:
        if candidate.direction > 0:
            return float(bar.close) > candidate.pivot_price + self._break_distance
        return float(bar.close) < candidate.pivot_price - self._break_distance

    def _liquidity_for_bar(self, index: int, direction: int) -> _Liquidity | None:
        bar = self._bars[index]
        body = self._body_spread(bar)
        full_range = float(bar.high) - float(bar.low)
        if full_range <= 0 or body <= 0:
            return None
        if body / full_range < _MIN_BODY_RANGE_RATIO:
            return None
        if direction > 0:
            if float(bar.close) <= float(bar.open):
                return None
            upper_wick = max(0.0, float(bar.high) - max(float(bar.open), float(bar.close)))
            if upper_wick > body:
                return None
        else:
            if float(bar.close) >= float(bar.open):
                return None
            lower_wick = max(0.0, min(float(bar.open), float(bar.close)) - float(bar.low))
            if lower_wick > body:
                return None

        big_trade = self._big_trades.get(bar.time)
        big_trade_volume = 0
        big_trade_price = float(bar.close)
        if self._require_big_trade:
            if big_trade is None:
                return None
            if float(big_trade.volume) <= self._big_trade_threshold:
                return None
        if big_trade is not None:
            big_trade_volume = big_trade.volume
            big_trade_price = big_trade.price

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

        if body < self._min_spread:
            return None
        avg_spread = self._average_spread_before(index)
        if (
            avg_spread is not None
            and avg_spread > 0
            and self._spread_multiplier > 0
            and body < avg_spread * self._spread_multiplier
        ):
            return None

        return _Liquidity(
            big_trade_volume=big_trade_volume,
            big_trade_price=big_trade_price,
            bar_volume=int(bar.volume),
            bar_spread=body,
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
            self._body_spread(bar)
            for bar in self._bars[max(0, index - self._spread_lookback):index]
        ]
        return _average(values)

    @staticmethod
    def _body_spread(bar: MgannBigTradeSweepBar) -> float:
        return abs(float(bar.close) - float(bar.open))

    @staticmethod
    def _candidate_id(event: SmcBreakEvent) -> str:
        return (
            f"{event.direction}:{event.kind}:{event.break_time}:"
            f"{event.pivot_time}:{event.level:.4f}"
        )

    def _prune_state(self, index: int) -> None:
        bar = self._bars[index]
        min_candidate_index = index - self._confirmation_bars
        self._candidates = [
            candidate
            for candidate in self._candidates
            if candidate.bar_index >= min_candidate_index
            and not self._invalidates_candidate(bar, candidate)
        ]
        overflow = len(self._bars) - self._max_bars
        if overflow > 0:
            del self._bars[:overflow]
            adjusted: list[_BreakCandidate] = []
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

    @staticmethod
    def _invalidates_candidate(
        bar: MgannBigTradeSweepBar,
        candidate: _BreakCandidate,
    ) -> bool:
        if candidate.direction > 0:
            return float(bar.close) <= candidate.pivot_price
        return float(bar.close) >= candidate.pivot_price


def _average(values: list[float]) -> float | None:
    if not values:
        return None
    return sum(values) / len(values)
