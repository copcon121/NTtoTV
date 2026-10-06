"""Deterministic Pine-v4-compatible Supertrend calculations.

The live platform receives repeated snapshots of the same forming bar.  Pine
rolls indicator state back to the prior confirmed bar before each realtime
calculation, so this module deliberately separates confirmed updates from
preview calculations: :meth:`SupertrendState.on_closed_bar` mutates state once
per bar while :meth:`SupertrendState.preview` never mutates confirmed state.
"""

from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass, field

from ..models.timestamp import CanonicalTimestamp

SUPERTREND_DEFAULT_PERIOD = 10
SUPERTREND_DEFAULT_MULTIPLIER = 3.0
SUPERTREND_DEFAULT_ATR_METHOD = "rma"
SUPERTREND_DEFAULT_SOURCE = "hl2"
SUPERTREND_DEFAULT_DIRECTION = "both"
SUPERTREND_MAX_PERIOD = 500
SUPERTREND_ATR_METHODS = frozenset({"rma", "sma"})
SUPERTREND_SOURCES = frozenset(
    {"open", "high", "low", "close", "hl2", "hlc3", "ohlc4"}
)
SUPERTREND_DIRECTIONS = frozenset({"buy", "sell", "both"})
SUPERTREND_TIMEFRAMES = (
    "1m",
    "3m",
    "5m",
    "15m",
    "30m",
    "1h",
    "4h",
    "1D",
)

__all__ = [
    "SUPERTREND_ATR_METHODS",
    "SUPERTREND_DEFAULT_ATR_METHOD",
    "SUPERTREND_DEFAULT_DIRECTION",
    "SUPERTREND_DEFAULT_MULTIPLIER",
    "SUPERTREND_DEFAULT_PERIOD",
    "SUPERTREND_DEFAULT_SOURCE",
    "SUPERTREND_DIRECTIONS",
    "SUPERTREND_MAX_PERIOD",
    "SUPERTREND_SOURCES",
    "SUPERTREND_TIMEFRAMES",
    "SupertrendBar",
    "SupertrendConfig",
    "SupertrendPoint",
    "SupertrendState",
]


@dataclass(frozen=True, slots=True)
class SupertrendConfig:
    period: int = SUPERTREND_DEFAULT_PERIOD
    multiplier: float = SUPERTREND_DEFAULT_MULTIPLIER
    atr_method: str = SUPERTREND_DEFAULT_ATR_METHOD
    source: str = SUPERTREND_DEFAULT_SOURCE

    def __post_init__(self) -> None:
        if isinstance(self.period, bool) or not isinstance(self.period, int):
            raise ValueError("period must be an integer")
        if self.period < 1 or self.period > SUPERTREND_MAX_PERIOD:
            raise ValueError(
                f"period must be between 1 and {SUPERTREND_MAX_PERIOD}"
            )
        multiplier = float(self.multiplier)
        if not math.isfinite(multiplier) or multiplier <= 0:
            raise ValueError("multiplier must be finite and greater than zero")
        if self.atr_method not in SUPERTREND_ATR_METHODS:
            raise ValueError(f"unknown ATR method: {self.atr_method!r}")
        if self.source not in SUPERTREND_SOURCES:
            raise ValueError(f"unknown source: {self.source!r}")


@dataclass(frozen=True, slots=True)
class SupertrendBar:
    time: CanonicalTimestamp
    open: float
    high: float
    low: float
    close: float

    def __post_init__(self) -> None:
        values = (self.open, self.high, self.low, self.close)
        if not all(math.isfinite(float(value)) for value in values):
            raise ValueError("bar prices must be finite")
        if self.high < max(self.open, self.close, self.low):
            raise ValueError("bar high is below another OHLC value")
        if self.low > min(self.open, self.close, self.high):
            raise ValueError("bar low is above another OHLC value")


@dataclass(frozen=True, slots=True)
class SupertrendPoint:
    time: CanonicalTimestamp
    trend: int
    direction: int
    atr: float | None
    lower_band: float | None
    upper_band: float | None
    value: float | None
    confirmed: bool

    @property
    def buy_signal(self) -> bool:
        return self.direction == 1

    @property
    def sell_signal(self) -> bool:
        return self.direction == -1


@dataclass(slots=True)
class _AtrState:
    period: int
    method: str
    seed: list[float] = field(default_factory=list)
    window: deque[float] = field(default_factory=deque)
    value: float | None = None

    def copy(self) -> _AtrState:
        return _AtrState(
            period=self.period,
            method=self.method,
            seed=list(self.seed),
            window=deque(self.window),
            value=self.value,
        )

    def update(self, true_range: float | None) -> float | None:
        # Pine's ``atr(length)`` uses tr(true), so RMA receives high-low on the
        # first bar.  The alternate source in the supplied script is
        # ``sma(tr, length)``; bare ``tr`` is na without a previous close.
        if true_range is None:
            return self.value
        value = float(true_range)
        if self.method == "sma":
            self.window.append(value)
            while len(self.window) > self.period:
                self.window.popleft()
            self.value = (
                sum(self.window) / self.period
                if len(self.window) == self.period
                else None
            )
            return self.value

        if self.value is None:
            self.seed.append(value)
            if len(self.seed) == self.period:
                self.value = sum(self.seed) / self.period
                self.seed.clear()
        else:
            self.value += (value - self.value) / self.period
        return self.value


@dataclass(slots=True)
class _CoreState:
    atr: _AtrState
    previous_close: float | None = None
    lower_band: float | None = None
    upper_band: float | None = None
    trend: int = 1

    def copy(self) -> _CoreState:
        return _CoreState(
            atr=self.atr.copy(),
            previous_close=self.previous_close,
            lower_band=self.lower_band,
            upper_band=self.upper_band,
            trend=self.trend,
        )


class SupertrendState:
    """Incremental Supertrend state for one parameter/timeframe series."""

    def __init__(self, config: SupertrendConfig | None = None) -> None:
        self.config = config or SupertrendConfig()
        self._state = _CoreState(
            atr=_AtrState(self.config.period, self.config.atr_method)
        )
        self._last_time: CanonicalTimestamp | None = None
        self._last_point: SupertrendPoint | None = None

    @property
    def last_time(self) -> CanonicalTimestamp | None:
        return self._last_time

    @property
    def last_point(self) -> SupertrendPoint | None:
        return self._last_point

    def on_closed_bar(self, bar: SupertrendBar) -> SupertrendPoint | None:
        """Commit a confirmed bar once; duplicate/stale bar times are ignored."""
        if self._last_time is not None and bar.time <= self._last_time:
            return self._last_point if bar.time == self._last_time else None
        point = self._calculate(self._state, bar, confirmed=True)
        self._last_time = bar.time
        self._last_point = point
        return point

    def preview(self, bar: SupertrendBar) -> SupertrendPoint | None:
        """Calculate a forming bar from confirmed state without mutating it."""
        if self._last_time is not None and bar.time <= self._last_time:
            if bar.time == self._last_time and self._last_point is not None:
                point = self._last_point
                return SupertrendPoint(
                    time=point.time,
                    trend=point.trend,
                    direction=point.direction,
                    atr=point.atr,
                    lower_band=point.lower_band,
                    upper_band=point.upper_band,
                    value=point.value,
                    confirmed=False,
                )
            return None
        return self._calculate(self._state.copy(), bar, confirmed=False)

    def _calculate(
        self, state: _CoreState, bar: SupertrendBar, *, confirmed: bool
    ) -> SupertrendPoint:
        previous_close = state.previous_close
        true_range = _true_range(
            bar.high,
            bar.low,
            previous_close,
            handle_missing_previous=self.config.atr_method == "rma",
        )
        atr = state.atr.update(true_range)
        previous_trend = state.trend
        lower_band: float | None = None
        upper_band: float | None = None

        if atr is not None:
            source = _source_value(bar, self.config.source)
            raw_lower = source - float(self.config.multiplier) * atr
            raw_upper = source + float(self.config.multiplier) * atr
            previous_lower = (
                state.lower_band if state.lower_band is not None else raw_lower
            )
            previous_upper = (
                state.upper_band if state.upper_band is not None else raw_upper
            )
            lower_band = (
                max(raw_lower, previous_lower)
                if previous_close is not None and previous_close > previous_lower
                else raw_lower
            )
            upper_band = (
                min(raw_upper, previous_upper)
                if previous_close is not None and previous_close < previous_upper
                else raw_upper
            )

            # Match the Pine source exactly: trend changes compare the current
            # close to the prior finalized bands (dn1/up1), using strict signs.
            if previous_trend == -1 and bar.close > previous_upper:
                state.trend = 1
            elif previous_trend == 1 and bar.close < previous_lower:
                state.trend = -1

        state.previous_close = float(bar.close)
        state.lower_band = lower_band
        state.upper_band = upper_band
        direction = state.trend if state.trend != previous_trend else 0
        value = lower_band if state.trend == 1 else upper_band
        return SupertrendPoint(
            time=bar.time,
            trend=state.trend,
            direction=direction,
            atr=atr,
            lower_band=lower_band,
            upper_band=upper_band,
            value=value,
            confirmed=confirmed,
        )


def _true_range(
    high: float,
    low: float,
    previous_close: float | None,
    *,
    handle_missing_previous: bool,
) -> float | None:
    if previous_close is None:
        return max(0.0, float(high) - float(low)) if handle_missing_previous else None
    return max(
        0.0,
        float(high) - float(low),
        abs(float(high) - previous_close),
        abs(float(low) - previous_close),
    )


def _source_value(bar: SupertrendBar, source: str) -> float:
    if source == "open":
        return float(bar.open)
    if source == "high":
        return float(bar.high)
    if source == "low":
        return float(bar.low)
    if source == "close":
        return float(bar.close)
    if source == "hl2":
        return (float(bar.high) + float(bar.low)) / 2.0
    if source == "hlc3":
        return (float(bar.high) + float(bar.low) + float(bar.close)) / 3.0
    return (
        float(bar.open) + float(bar.high) + float(bar.low) + float(bar.close)
    ) / 4.0
