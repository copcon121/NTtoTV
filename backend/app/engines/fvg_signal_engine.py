"""FVG Signal Grader engine.

This ports the timing signal from the local NinjaTrader ``FvgSignalGrader``
into backend state.  The engine is intentionally 1m-only and keeps its own
footprint state so the chart footprint panel can keep different display
settings without changing FVG grading.
"""

from __future__ import annotations

import math
from collections.abc import Iterable
from dataclasses import dataclass, field

from app.models.canonical import NormalizedTrade, Side
from app.models.messages import FvgSignalUpdate

__all__ = [
    "FVG_SIGNAL_TIMEFRAME",
    "FvgSignalEngine",
]

FVG_SIGNAL_TIMEFRAME = "1m"
_TF_MS = 60_000

_TICK_SIZE = 0.1
_VALUE_AREA_PERCENT = 70.0
_VALUE_AREA_GAP_AUTO_LOOKBACK = 10
_VALUE_AREA_GAP_AUTO_MIN_SAMPLES = 5
_VALUE_AREA_GAP_AUTO_FACTOR = 0.25
_DELTA_BREAKOUT_LOOKBACK = 10
_FVG_BREAKOUT_SEARCH_BARS = 2
_DELTA_EXHAUSTION_LOOKBACK = 4
_LEVEL_1 = 1.2
_LEVEL_2 = 1.4
_LEVEL_3 = 1.6


@dataclass(slots=True)
class _Level:
    bid_volume: int = 0
    ask_volume: int = 0

    @property
    def volume(self) -> int:
        return self.bid_volume + self.ask_volume


@dataclass(slots=True)
class _FvgBar:
    time: int
    open: float
    high: float
    low: float
    close: float
    grouped_close: float
    levels: dict[float, _Level] = field(default_factory=dict)
    total_buy_volume: int = 0
    total_sell_volume: int = 0
    poc: float = 0.0
    poc_volume: int = 0
    vah: float = 0.0
    val: float = 0.0
    profile_ready: bool = False

    @property
    def delta(self) -> int:
        return self.total_buy_volume - self.total_sell_volume

    @property
    def total_volume(self) -> int:
        return self.total_buy_volume + self.total_sell_volume


@dataclass(slots=True)
class _Signal:
    source_time: int
    direction: int
    level: int
    top: float
    bottom: float
    breakout_ratio: float

    @property
    def pulse(self) -> int:
        return self.direction * self.level

    def preview_key(self) -> tuple[int, int, float, float, float]:
        return (
            self.direction,
            self.level,
            round(self.top, 10),
            round(self.bottom, 10),
            round(self.breakout_ratio, 6),
        )


@dataclass(slots=True)
class _ContractState:
    current: _FvgBar | None = None
    bars: dict[int, _FvgBar] = field(default_factory=dict)
    order: list[int] = field(default_factory=list)
    provisional_times: set[int] = field(default_factory=set)
    confirmed_source_times: set[int] = field(default_factory=set)
    finalized_source_times: set[int] = field(default_factory=set)
    preview_by_source: dict[int, tuple[int, int, float, float, float]] = field(
        default_factory=dict
    )


class FvgSignalEngine:
    """Compute FVG grader candle-color signals from 1m bars and footprint state."""

    def __init__(self, *, tick_size: float = _TICK_SIZE) -> None:
        if tick_size <= 0:
            raise ValueError("tick_size must be > 0")
        self.tick_size = tick_size
        self._state: dict[str, _ContractState] = {}

    def bucket_start(self, ts_ms: int) -> int:
        return (ts_ms // _TF_MS) * _TF_MS

    def on_trade(self, t: NormalizedTrade) -> list[FvgSignalUpdate]:
        state = self._state.setdefault(t.contract, _ContractState())
        bucket = self.bucket_start(t.time)
        current = state.current
        if current is not None and bucket < current.time:
            return []

        events: list[FvgSignalUpdate] = []
        if current is not None and bucket > current.time:
            events.extend(self._confirmed_events(state, t.symbol, t.contract))
            current = None

        if current is None:
            current = _FvgBar(
                time=bucket,
                open=t.price,
                high=t.price,
                low=t.price,
                close=t.price,
                grouped_close=self._level_price(t.price),
            )
            state.current = current
            state.bars[bucket] = current
            state.order.append(bucket)
            self._trim_state(state)

        self._fold_trade(current, t)
        events.extend(self._preview_events(state, t.symbol, t.contract))
        return events

    def on_preview_trade(self, t: NormalizedTrade) -> list[FvgSignalUpdate]:
        """Use a live trade only to preview the right bar of a native FVG.

        Closed/native bars remain authoritative for footprints and confirmed
        signals. This path only maintains a provisional current bar's OHLC so a
        three-bar FVG can color the source bar while the right bar is forming.
        """
        state = self._state.get(t.contract)
        if state is None or not state.order:
            return []

        bucket = self.bucket_start(t.time)
        current = state.current
        if current is not None and bucket < current.time:
            return []

        if (
            current is not None
            and bucket > current.time
            and current.time in state.provisional_times
        ):
            return []

        if current is None or bucket > current.time:
            current = _FvgBar(
                time=bucket,
                open=t.price,
                high=t.price,
                low=t.price,
                close=t.price,
                grouped_close=self._level_price(t.price),
            )
            state.current = current
            state.bars[bucket] = current
            state.order.append(bucket)
            state.provisional_times.add(bucket)
            self._trim_state(state)
        elif bucket == current.time:
            if bucket not in state.provisional_times:
                return []
            self._fold_preview_price(current, t.price)

        return self._preview_events(state, t.symbol, t.contract)

    def on_closed_bar(
        self,
        *,
        symbol: str,
        contract: str,
        time: int,
        open: float,
        high: float,
        low: float,
        close: float,
        rows: Iterable[tuple[float, int, int]],
        emit_clear: bool = True,
    ) -> list[FvgSignalUpdate]:
        """Fold one finalized native footprint bar and grade the prior bar.

        The native chart bridge posts complete M1 bars after NinjaTrader closes
        them. Once a right bar arrives, the source bar is final, so this path
        emits only confirmed/clear updates; provisional source-bar colors are
        handled separately by :meth:`on_preview_trade`.
        """
        state = self._state.setdefault(contract, _ContractState())
        bucket = self.bucket_start(time)
        if state.order and bucket < state.order[-1]:
            return []
        if state.order and bucket == state.order[-1]:
            was_provisional = bucket in state.provisional_times
            state.bars[bucket] = self._bar_from_native(
                bucket, open, high, low, close, rows
            )
            state.current = state.bars[bucket]
            state.provisional_times.discard(bucket)
            state.finalized_source_times.discard(bucket)
            state.confirmed_source_times.discard(bucket)
            if not was_provisional:
                return []
            return self._confirmed_events(
                state,
                symbol,
                contract,
                emit_clear_without_preview=emit_clear,
            )

        bar = self._bar_from_native(bucket, open, high, low, close, rows)
        state.current = bar
        state.bars[bucket] = bar
        state.order.append(bucket)
        state.provisional_times.discard(bucket)
        self._trim_state(state)
        return self._confirmed_events(
            state,
            symbol,
            contract,
            emit_clear_without_preview=emit_clear,
        )

    def reset_contract(self, contract: str) -> None:
        self._state.pop(contract, None)

    def _fold_trade(self, bar: _FvgBar, t: NormalizedTrade) -> None:
        bar.high = max(bar.high, t.price)
        bar.low = min(bar.low, t.price)
        bar.close = t.price
        grouped_price = self._level_price(t.price)
        bar.grouped_close = grouped_price
        level = bar.levels.get(grouped_price)
        if level is None:
            level = _Level()
            bar.levels[grouped_price] = level

        side = self._classify_trade(t.price, t.bid, t.ask)
        if side is Side.BUY:
            level.ask_volume += t.volume
            bar.total_buy_volume += t.volume
        elif side is Side.SELL:
            level.bid_volume += t.volume
            bar.total_sell_volume += t.volume
        bar.profile_ready = False

    def _fold_preview_price(self, bar: _FvgBar, price: float) -> None:
        bar.high = max(bar.high, price)
        bar.low = min(bar.low, price)
        bar.close = price
        bar.grouped_close = self._level_price(price)

    def _confirmed_events(
        self,
        state: _ContractState,
        symbol: str,
        contract: str,
        *,
        emit_clear_without_preview: bool = False,
    ) -> list[FvgSignalUpdate]:
        if len(state.order) < 3:
            return []
        source_idx = len(state.order) - 2
        source_time = state.order[source_idx]
        if source_time in state.finalized_source_times:
            return []
        signal = self._classify_source(state, source_idx)
        preview_was_active = state.preview_by_source.pop(source_time, None) is not None
        state.finalized_source_times.add(source_time)
        if signal is not None:
            state.confirmed_source_times.add(source_time)
            return [self._to_update(signal, symbol, contract, phase="confirmed")]
        if preview_was_active or emit_clear_without_preview:
            return [self._clear_update(symbol, contract, source_time)]
        return []

    def _bar_from_native(
        self,
        time: int,
        open: float,
        high: float,
        low: float,
        close: float,
        rows: Iterable[tuple[float, int, int]],
    ) -> _FvgBar:
        bar = _FvgBar(
            time=time,
            open=open,
            high=high,
            low=low,
            close=close,
            grouped_close=self._level_price(close),
        )
        for price, bid, ask in rows:
            bid_volume = max(0, int(bid))
            ask_volume = max(0, int(ask))
            if bid_volume <= 0 and ask_volume <= 0:
                continue
            level_price = self._level_price(float(price))
            level = bar.levels.get(level_price)
            if level is None:
                level = _Level()
                bar.levels[level_price] = level
            level.bid_volume += bid_volume
            level.ask_volume += ask_volume
            bar.total_sell_volume += bid_volume
            bar.total_buy_volume += ask_volume
        return bar

    def _preview_events(
        self, state: _ContractState, symbol: str, contract: str
    ) -> list[FvgSignalUpdate]:
        if len(state.order) < 3:
            return []
        source_idx = len(state.order) - 2
        source_time = state.order[source_idx]
        if source_time in state.provisional_times:
            return []
        if source_time in state.confirmed_source_times:
            return []
        signal = self._classify_source(state, source_idx)
        if signal is None:
            if source_time in state.preview_by_source:
                state.preview_by_source.pop(source_time, None)
                return [self._clear_update(symbol, contract, source_time)]
            return []

        key = signal.preview_key()
        if state.preview_by_source.get(source_time) == key:
            return []
        state.preview_by_source[source_time] = key
        return [self._to_update(signal, symbol, contract, phase="preview")]

    def _classify_source(
        self, state: _ContractState, source_idx: int
    ) -> _Signal | None:
        if source_idx <= 0 or source_idx + 1 >= len(state.order):
            return None
        left = state.bars[state.order[source_idx - 1]]
        source = state.bars[state.order[source_idx]]
        right = state.bars[state.order[source_idx + 1]]

        direction = 0
        top = 0.0
        bottom = 0.0
        if right.low > left.high:
            direction = 1
            top = right.low
            bottom = left.high
        elif right.high < left.low:
            direction = -1
            top = left.low
            bottom = right.high
        if direction == 0:
            return None

        if source.high <= left.high and source.low >= left.low:
            return None

        body = abs(source.open - source.close)
        bar_range = source.high - source.low
        if direction > 0:
            top_wick = source.high - max(source.open, source.close)
            if top_wick > body:
                return None
        else:
            bottom_wick = min(source.open, source.close) - source.low
            if bottom_wick > body:
                return None
        if bar_range > 0 and body <= bar_range * 0.1:
            return None

        best_idx = -1
        best_ratio = 0.0
        for offset in range(_FVG_BREAKOUT_SEARCH_BARS + 1):
            check_idx = source_idx - offset
            if check_idx < 0:
                break
            ratio = self._delta_breakout_ratio(state, check_idx, direction)
            if ratio >= _LEVEL_1 and ratio > best_ratio:
                best_ratio = ratio
                best_idx = check_idx
        if best_idx < 0:
            return None

        if self._value_area_gap_direction(state, source_idx) != direction:
            return None

        level = self._determine_level(best_ratio)
        if self._delta_exhaustion_direction(state, best_idx) == direction:
            level = 5

        return _Signal(
            source_time=source.time,
            direction=direction,
            level=level,
            top=max(top, bottom),
            bottom=min(top, bottom),
            breakout_ratio=best_ratio,
        )

    def _delta_breakout_ratio(
        self, state: _ContractState, bar_idx: int, direction: int
    ) -> float:
        if bar_idx < _DELTA_BREAKOUT_LOOKBACK or bar_idx <= 0:
            return 0.0
        bar = state.bars[state.order[bar_idx]]
        prev = state.bars[state.order[bar_idx - 1]]
        if not prev.levels:
            return 0.0
        avg_change = self._avg_delta_change(state, bar_idx)
        if avg_change <= 0:
            return 0.0

        current_delta = bar.delta
        prev_delta = prev.delta
        magnitude_ratio = abs(float(current_delta)) / avg_change
        if direction > 0:
            if not self._is_bullish(bar) or current_delta <= 0:
                return 0.0
            change = current_delta - prev_delta
            if change <= 0:
                return 0.0
            return min(change / avg_change, magnitude_ratio)

        if not self._is_bearish(bar) or current_delta >= 0:
            return 0.0
        change = prev_delta - current_delta
        if change <= 0:
            return 0.0
        return min(change / avg_change, magnitude_ratio)

    def _avg_delta_change(self, state: _ContractState, bar_idx: int) -> float:
        if bar_idx < _DELTA_BREAKOUT_LOOKBACK:
            return 0.0
        total = 0.0
        count = 0
        start = bar_idx - _DELTA_BREAKOUT_LOOKBACK
        for idx in range(start, bar_idx - 1):
            if idx < 0 or idx + 1 >= len(state.order):
                continue
            bar1 = state.bars[state.order[idx]]
            bar2 = state.bars[state.order[idx + 1]]
            total += abs(bar2.delta - bar1.delta)
            count += 1
        return 0.0 if count == 0 else total / count

    def _value_area_gap_direction(self, state: _ContractState, bar_idx: int) -> int:
        if bar_idx < 1:
            return 0
        bar = state.bars[state.order[bar_idx]]
        prev = state.bars[state.order[bar_idx - 1]]
        self._prepare_profile(bar)
        self._prepare_profile(prev)
        if bar.vah < bar.val or prev.vah < prev.val:
            return 0

        auto_ticks = self._auto_value_area_gap_ticks(state, bar_idx)
        gap_distance = auto_ticks * self.tick_size
        if self._is_bullish(bar) and bar.val > prev.vah + gap_distance:
            return 1
        if self._is_bearish(bar) and bar.vah < prev.val - gap_distance:
            return -1
        return 0

    def _auto_value_area_gap_ticks(self, state: _ContractState, bar_idx: int) -> float:
        start = max(0, bar_idx - _VALUE_AREA_GAP_AUTO_LOOKBACK)
        total_width_ticks = 0.0
        samples = 0
        for idx in range(start, bar_idx):
            bar = state.bars[state.order[idx]]
            self._prepare_profile(bar)
            if bar.vah <= bar.val:
                continue
            total_width_ticks += (bar.vah - bar.val) / self.tick_size
            samples += 1
        if samples < _VALUE_AREA_GAP_AUTO_MIN_SAMPLES:
            return 1.0
        return max(
            1.0,
            float(math.floor((total_width_ticks / samples) * _VALUE_AREA_GAP_AUTO_FACTOR + 0.5)),
        )

    def _delta_exhaustion_direction(self, state: _ContractState, bar_idx: int) -> int:
        if bar_idx < _DELTA_EXHAUSTION_LOOKBACK - 1:
            return 0
        deltas = [
            state.bars[state.order[bar_idx - offset]].delta
            for offset in range(_DELTA_EXHAUSTION_LOOKBACK)
        ]

        bullish = True
        for idx in range(_DELTA_EXHAUSTION_LOOKBACK - 1, 0, -1):
            if deltas[idx] >= deltas[idx - 1]:
                bullish = False
                break
        if bullish and deltas[-1] < 0 and deltas[0] > 0:
            return 1

        bearish = True
        for idx in range(_DELTA_EXHAUSTION_LOOKBACK - 1, 0, -1):
            if deltas[idx] <= deltas[idx - 1]:
                bearish = False
                break
        if bearish and deltas[-1] > 0 and deltas[0] < 0:
            return -1
        return 0

    def _prepare_profile(self, bar: _FvgBar) -> None:
        if bar.profile_ready:
            return
        if not bar.levels:
            bar.poc = 0.0
            bar.poc_volume = 0
            bar.vah = 0.0
            bar.val = 0.0
            bar.profile_ready = True
            return

        prices = sorted(bar.levels)
        poc = prices[0]
        poc_volume = -1
        total_volume = 0
        for price in prices:
            volume = bar.levels[price].volume
            total_volume += volume
            if volume > poc_volume or (volume == poc_volume and price > poc):
                poc = price
                poc_volume = volume

        target = total_volume * _VALUE_AREA_PERCENT / 100.0
        accumulated = max(0, poc_volume)
        vah = poc
        val = poc
        lower = round(poc - self.tick_size, 10)
        upper = round(poc + self.tick_size, 10)
        while accumulated < target:
            lower_row = bar.levels.get(lower)
            upper_row = bar.levels.get(upper)
            lower_volume = 0 if lower_row is None else lower_row.volume
            upper_volume = 0 if upper_row is None else upper_row.volume
            if lower_volume <= 0 and upper_volume <= 0:
                break
            if lower_volume > 0 and lower_volume > upper_volume:
                accumulated += lower_volume
                val = lower
                lower = round(lower - self.tick_size, 10)
            elif upper_volume > 0 and upper_volume > lower_volume:
                accumulated += upper_volume
                vah = upper
                upper = round(upper + self.tick_size, 10)
            else:
                if lower_volume > 0:
                    accumulated += lower_volume
                    val = lower
                    lower = round(lower - self.tick_size, 10)
                if upper_volume > 0:
                    accumulated += upper_volume
                    vah = upper
                    upper = round(upper + self.tick_size, 10)

        bar.poc = poc
        bar.poc_volume = max(0, poc_volume)
        bar.vah = vah
        bar.val = val
        bar.profile_ready = True

    def _level_price(self, price: float) -> float:
        return round(math.floor(price / self.tick_size + 1e-8) * self.tick_size, 10)

    @staticmethod
    def _classify_trade(
        trade_price: float, bid: float | None, ask: float | None
    ) -> Side | None:
        if ask is not None and ask > 0 and trade_price >= ask:
            return Side.BUY
        if bid is not None and bid > 0 and trade_price <= bid:
            return Side.SELL
        return None

    @staticmethod
    def _is_bullish(bar: _FvgBar) -> bool:
        return bar.grouped_close > bar.open

    @staticmethod
    def _is_bearish(bar: _FvgBar) -> bool:
        return bar.grouped_close < bar.open

    @staticmethod
    def _determine_level(breakout_ratio: float) -> int:
        if breakout_ratio >= _LEVEL_3:
            return 3
        if breakout_ratio >= _LEVEL_2:
            return 2
        return 1

    @staticmethod
    def _to_update(
        signal: _Signal, symbol: str, contract: str, *, phase: str
    ) -> FvgSignalUpdate:
        return FvgSignalUpdate(
            symbol=symbol,
            contract=contract,
            tf=FVG_SIGNAL_TIMEFRAME,
            time=signal.source_time,
            direction=signal.direction,
            level=signal.level,
            pulse=signal.pulse,
            top=signal.top,
            bottom=signal.bottom,
            breakout_ratio=signal.breakout_ratio,
            phase=phase,
        )

    @staticmethod
    def _clear_update(symbol: str, contract: str, source_time: int) -> FvgSignalUpdate:
        return FvgSignalUpdate(
            symbol=symbol,
            contract=contract,
            tf=FVG_SIGNAL_TIMEFRAME,
            time=source_time,
            direction=0,
            level=0,
            pulse=0,
            top=None,
            bottom=None,
            breakout_ratio=0.0,
            phase="clear",
        )

    @staticmethod
    def _trim_state(state: _ContractState) -> None:
        # Keep enough history for breakout/VA/exhaustion plus a generous margin.
        while len(state.order) > 200:
            old = state.order.pop(0)
            state.bars.pop(old, None)
            state.provisional_times.discard(old)
            state.confirmed_source_times.discard(old)
            state.finalized_source_times.discard(old)
            state.preview_by_source.pop(old, None)
