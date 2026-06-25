"""Breakout Box engine.

Ports the 'Breakout Boxes [ChartPrime]' Pine Script indicator logic into a
backend engine that runs on closed 1m bars.  The engine detects pivot-based
consolidation zones and emits :class:`BreakoutBoxEvent` when the close price
breaks above the upper box or below the lower box.

The Pine Script algorithm:
1. Detect pivot highs/lows using a configurable ``pivot_len`` look-back/ahead.
2. When a new pivot is close to the previous one (within ATR(200)*0.2), form
   a consolidation box extending ``ATR(200) * box_width_factor`` beyond the
   pivot price.
3. On each bar, if close > upper_box.top => bullish breakout (BreakUp).
   If close < lower_box.bottom => bearish breakout (BreakDn).
4. After breakout, the box is invalidated (one-shot per box).
"""

from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass

__all__ = [
    "BREAKOUT_BOX_TIMEFRAME",
    "BreakoutBoxEngine",
    "BreakoutBoxEvent",
]

BREAKOUT_BOX_TIMEFRAME = "1m"
_TF_MS = 60_000


@dataclass(slots=True)
class BreakoutBoxEvent:
    """Emitted when price breaks out of a consolidation box."""

    symbol: str
    contract: str
    time: int
    price: float
    direction: int  # 1 = bullish (BreakUp), -1 = bearish (BreakDn)
    box_top: float
    box_bottom: float


@dataclass(slots=True)
class _Bar:
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: int


@dataclass(slots=True)
class _Pivot:
    price: float
    index: int  # bar index (monotonic counter)


@dataclass(slots=True)
class _Box:
    """A consolidation box formed from repeated pivots at a similar level."""

    top: float
    bottom: float
    left_index: int  # bar index where box started
    active: bool = True


class BreakoutBoxEngine:
    """Detect pivot-based consolidation zones and breakout events on 1m bars.

    Parameters
    ----------
    pivot_len:
        Number of bars on each side required to confirm a pivot.  Default 5
        (matching the Pine Script default).
    box_width_factor:
        ATR(200) multiplier for the box height beyond the pivot price.
        Default 0.5 (Pine Script ``boxWidth1/10 = 5/10``).
    proximity_factor:
        ATR(200) multiplier for deciding whether two pivots are "close enough"
        to form a consolidation zone.  Default 0.2 (Pine Script ``atr0``).
    atr_period:
        Lookback period for the ATR calculation.  Default 200.
    """

    def __init__(
        self,
        *,
        pivot_len: int = 5,
        box_width_factor: float = 0.5,
        proximity_factor: float = 0.2,
        atr_period: int = 200,
    ) -> None:
        if pivot_len < 1:
            raise ValueError("pivot_len must be >= 1")
        self._pivot_len = pivot_len
        self._box_width_factor = box_width_factor
        self._proximity_factor = proximity_factor
        self._atr_period = atr_period

        # Per-contract state.
        self._state: dict[str, _ContractState] = {}

    def on_closed_bar(
        self,
        symbol: str,
        contract: str,
        *,
        time: int,
        open: float,
        high: float,
        low: float,
        close: float,
        volume: int = 0,
    ) -> list[BreakoutBoxEvent]:
        """Process a closed 1m bar.  Returns any breakout events."""
        state = self._state.setdefault(contract, _ContractState(self._atr_period))
        bar = _Bar(time=time, open=open, high=high, low=low, close=close, volume=volume)
        state.push_bar(bar)

        events: list[BreakoutBoxEvent] = []

        # Need enough bars for pivot detection + ATR warmup.
        if len(state.bars) < 2 * self._pivot_len + 1:
            return events

        atr = state.atr()
        if atr <= 0:
            return events

        proximity = atr * self._proximity_factor
        box_width = atr * self._box_width_factor

        # Check for pivot high at position [-(pivot_len+1)] (confirmed by
        # pivot_len bars on each side).
        pivot_idx = len(state.bars) - 1 - self._pivot_len
        self._detect_pivot_high(state, pivot_idx, proximity, box_width)
        self._detect_pivot_low(state, pivot_idx, proximity, box_width)

        # Check breakout on current (latest) bar.
        if state.upper_box is not None and state.upper_box.active:
            if bar.close > state.upper_box.top:
                events.append(
                    BreakoutBoxEvent(
                        symbol=symbol,
                        contract=contract,
                        time=bar.time,
                        price=bar.close,
                        direction=1,
                        box_top=state.upper_box.top,
                        box_bottom=state.upper_box.bottom,
                    )
                )
                state.upper_box.active = False

        if state.lower_box is not None and state.lower_box.active:
            if bar.close < state.lower_box.bottom:
                events.append(
                    BreakoutBoxEvent(
                        symbol=symbol,
                        contract=contract,
                        time=bar.time,
                        price=bar.close,
                        direction=-1,
                        box_top=state.lower_box.top,
                        box_bottom=state.lower_box.bottom,
                    )
                )
                state.lower_box.active = False

        return events

    def reset_contract(self, contract: str) -> None:
        """Clear all state for a contract."""
        self._state.pop(contract, None)

    # -- pivot detection -------------------------------------------------------

    def _detect_pivot_high(
        self,
        state: _ContractState,
        center_idx: int,
        proximity: float,
        box_width: float,
    ) -> None:
        """Check if the bar at ``center_idx`` is a pivot high."""
        bars = state.bars
        center = bars[center_idx]
        n = self._pivot_len

        # The center bar's high must be >= all bars within pivot_len on each side.
        for offset in range(1, n + 1):
            left_idx = center_idx - offset
            right_idx = center_idx + offset
            if left_idx < 0 or right_idx >= len(bars):
                return
            if bars[left_idx].high > center.high:
                return
            if bars[right_idx].high > center.high:
                return

        ph = center.high

        # If new pivot high is close to the previous one, form a box.
        if state.last_pivot_high is not None:
            if abs(state.last_pivot_high.price - ph) < proximity:
                # Invalidate previous box if it overlaps.
                if (
                    state.upper_box is not None
                    and state.upper_box.active
                    and state.bar_index - n
                    <= state.upper_box.left_index + (len(bars) - center_idx)
                ):
                    state.upper_box.active = False

                state.upper_box = _Box(
                    top=state.last_pivot_high.price + box_width,
                    bottom=state.last_pivot_high.price,
                    left_index=state.last_pivot_high.index,
                )

        state.last_pivot_high = _Pivot(price=ph, index=state.bar_index - n)

    def _detect_pivot_low(
        self,
        state: _ContractState,
        center_idx: int,
        proximity: float,
        box_width: float,
    ) -> None:
        """Check if the bar at ``center_idx`` is a pivot low."""
        bars = state.bars
        center = bars[center_idx]
        n = self._pivot_len

        for offset in range(1, n + 1):
            left_idx = center_idx - offset
            right_idx = center_idx + offset
            if left_idx < 0 or right_idx >= len(bars):
                return
            if bars[left_idx].low < center.low:
                return
            if bars[right_idx].low < center.low:
                return

        pl = center.low

        if state.last_pivot_low is not None:
            if abs(state.last_pivot_low.price - pl) < proximity:
                if (
                    state.lower_box is not None
                    and state.lower_box.active
                    and state.bar_index - n
                    <= state.lower_box.left_index + (len(bars) - center_idx)
                ):
                    state.lower_box.active = False

                state.lower_box = _Box(
                    top=state.last_pivot_low.price,
                    bottom=state.last_pivot_low.price - box_width,
                    left_index=state.last_pivot_low.index,
                )

        state.last_pivot_low = _Pivot(price=pl, index=state.bar_index - n)


class _ContractState:
    """Per-contract rolling state for breakout detection."""

    def __init__(self, atr_period: int) -> None:
        # Keep enough bars for pivot detection + ATR warmup.  ATR(200) needs
        # 200 bars of TR history; pivot detection needs 2*pivot_len+1.
        self._max_bars = max(atr_period + 50, 300)
        self.bars: deque[_Bar] = deque(maxlen=self._max_bars)
        self._tr_values: deque[float] = deque(maxlen=atr_period)
        self._atr_period = atr_period
        self.bar_index: int = 0

        self.last_pivot_high: _Pivot | None = None
        self.last_pivot_low: _Pivot | None = None
        self.upper_box: _Box | None = None
        self.lower_box: _Box | None = None

    def push_bar(self, bar: _Bar) -> None:
        prev = self.bars[-1] if self.bars else None
        self.bars.append(bar)
        self.bar_index += 1

        # True Range = max(high - low, |high - prev_close|, |low - prev_close|)
        tr = bar.high - bar.low
        if prev is not None:
            tr = max(
                tr,
                abs(bar.high - prev.close),
                abs(bar.low - prev.close),
            )
        self._tr_values.append(tr)

    def atr(self) -> float:
        """Simple moving average of True Range over the ATR period."""
        if len(self._tr_values) < self._atr_period:
            if len(self._tr_values) == 0:
                return 0.0
            return sum(self._tr_values) / len(self._tr_values)
        total = sum(self._tr_values)
        return total / self._atr_period if self._atr_period > 0 else 0.0
