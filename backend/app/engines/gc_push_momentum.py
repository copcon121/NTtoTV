"""Point-in-time GC Push Momentum state for server-side auto trading.

The calculation mirrors the price-push and ``strong`` fields from the
frontend indicator.  It intentionally excludes the current observation from
both the EWMA volatility denominator and the rolling percentile threshold.
"""

from __future__ import annotations

import bisect
import math
from collections import deque
from dataclasses import dataclass
from typing import Protocol

from app.models.timestamp import CanonicalTimestamp

__all__ = [
    "GC_PUSH_MOMENTUM_STRONG_PERCENTILE",
    "GcPushMomentumPoint",
    "GcPushMomentumState",
]

GC_PUSH_MOMENTUM_STRONG_PERCENTILE = 0.90

_HORIZON_BARS = 3
_STRUCTURAL_REQUIRED_RETURNS = 10
_VOLATILITY_HALF_LIFE_BARS = 60.0
_WARMUP_BARS = 120
_PERCENTILE_LOOKBACK_BARS = 300
_BAR_DURATION_MS = 60_000
_GAP_MULTIPLIER = 1.5
_EPSILON = 1e-12


class _CloseBar(Protocol):
    time: CanonicalTimestamp
    close: float


@dataclass(frozen=True, slots=True)
class GcPushMomentumPoint:
    time: CanonicalTimestamp
    push: float
    strong_threshold: float | None
    strong: bool


class _RollingQuantiles:
    """Fixed-size FIFO plus sorted values for interpolated quantiles."""

    def __init__(self, maximum: int) -> None:
        self._maximum = max(1, int(maximum))
        self._fifo: deque[float] = deque()
        self._sorted: list[float] = []

    def clear(self) -> None:
        self._fifo.clear()
        self._sorted.clear()

    def quantile(self, percentile: float) -> float | None:
        if not self._sorted:
            return None
        if len(self._sorted) == 1:
            return self._sorted[0]
        position = percentile * (len(self._sorted) - 1)
        lower_index = math.floor(position)
        upper_index = math.ceil(position)
        lower = self._sorted[lower_index]
        upper = self._sorted[upper_index]
        return lower + (upper - lower) * (position - lower_index)

    def push(self, value: float) -> None:
        self._fifo.append(value)
        bisect.insort_left(self._sorted, value)
        if len(self._fifo) <= self._maximum:
            return
        removed = self._fifo.popleft()
        remove_at = bisect.bisect_left(self._sorted, removed)
        if remove_at < len(self._sorted):
            self._sorted.pop(remove_at)


class GcPushMomentumState:
    """Incrementally calculate the M1 price push and its prior-P90 strength."""

    def __init__(self) -> None:
        self._lambda = math.exp(math.log(0.5) / _VOLATILITY_HALF_LIFE_BARS)
        self._last_time: CanonicalTimestamp | None = None
        self._last_close: float | None = None
        self._segment_return_count = 0
        self._returns: deque[float] = deque(maxlen=_STRUCTURAL_REQUIRED_RETURNS)
        self._predicted_variances: deque[float] = deque(
            maxlen=_STRUCTURAL_REQUIRED_RETURNS
        )
        self._ewma_variance: float | None = None
        self._prior_abs_push = _RollingQuantiles(_PERCENTILE_LOOKBACK_BARS)
        self._warmed = False

    def on_closed_bar(self, bar: _CloseBar) -> GcPushMomentumPoint | None:
        """Consume one strictly newer closed bar and return its momentum point."""
        current_time = int(bar.time)
        current_close = float(bar.close)
        if self._last_time is not None and current_time <= self._last_time:
            return None

        previous_time = self._last_time
        previous_close = self._last_close
        self._last_time = current_time
        self._last_close = current_close
        if previous_time is None or previous_close is None:
            if not _finite_positive(current_close):
                self._start_segment(preserve_warmed_state=False)
            return None

        elapsed = current_time - previous_time
        if (
            not _finite_positive(previous_close)
            or not _finite_positive(current_close)
            or elapsed <= 0
            or elapsed > _BAR_DURATION_MS * _GAP_MULTIPLIER
        ):
            self._start_segment(preserve_warmed_state=self._warmed)
            return None

        current_return = math.log(current_close) - math.log(previous_close)
        if not math.isfinite(current_return):
            self._start_segment(preserve_warmed_state=self._warmed)
            return None

        predicted_variance = (
            0.0 if self._ewma_variance is None else self._ewma_variance
        )
        squared_return = current_return * current_return
        self._ewma_variance = (
            squared_return
            if self._ewma_variance is None
            else self._lambda * self._ewma_variance
            + (1.0 - self._lambda) * squared_return
        )
        self._returns.append(current_return)
        self._predicted_variances.append(predicted_variance)
        self._segment_return_count += 1

        required_returns = (
            _STRUCTURAL_REQUIRED_RETURNS if self._warmed else _WARMUP_BARS
        )
        if self._segment_return_count < required_returns:
            return None
        self._warmed = True

        push_numerator = sum(tuple(self._returns)[-_HORIZON_BARS:])
        push_variance = sum(tuple(self._predicted_variances)[-_HORIZON_BARS:])
        push = _finite_score(push_numerator, push_variance)
        strong_threshold = self._prior_abs_push.quantile(
            GC_PUSH_MOMENTUM_STRONG_PERCENTILE
        )
        strong = (
            strong_threshold is not None
            and abs(push) > _EPSILON
            and abs(push) >= max(strong_threshold, _EPSILON)
        )
        point = GcPushMomentumPoint(
            time=current_time,
            push=push,
            strong_threshold=strong_threshold,
            strong=strong,
        )
        self._prior_abs_push.push(abs(push))
        return point

    def _start_segment(self, *, preserve_warmed_state: bool) -> None:
        self._segment_return_count = 0
        self._returns.clear()
        self._predicted_variances.clear()
        if preserve_warmed_state:
            return
        self._ewma_variance = None
        self._prior_abs_push.clear()
        self._warmed = False


def _finite_positive(value: float) -> bool:
    return math.isfinite(value) and value > 0


def _finite_score(numerator: float, variance: float) -> float:
    denominator = math.sqrt(max(0.0, variance) + _EPSILON)
    result = numerator / denominator
    return result if math.isfinite(result) else 0.0
