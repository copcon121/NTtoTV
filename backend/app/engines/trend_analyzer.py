"""TTW TrendAnalyzerPro-compatible price-only trend state machine.

The implementation preserves the reference TTW TrendAnalyzerPro behavior:

* trade prices are accumulated into one-second OHLC values;
* ten one-second pulses form one history bucket;
* every configured candle interval the high/low range is multiplied and
  recursively smoothed;
* a one-sided trailing line reverses only after the configured tick gap; and
* line breaks plus new-candle/trend-change markers are emitted separately.

Volume, aggressor side, DOM, alerts, Telegram, and sounds are intentionally not
part of this engine.  The two default instances share the reference numeric
settings and differ only in frontend appearance.
"""

from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass
from typing import Iterable, Literal

from ..models import NormalizedTrade

TrendSide = Literal["buy", "sell"]
TrendMarkerKind = Literal["new_candle", "trend_change"]

TICK_SIZE = 0.1
TEN_SECONDS_MS = 10_000
HISTORY_RETENTION_MS = 24 * 60 * 60 * 1_000


def _java_round(value: float) -> int:
    """Match Java ``Math.round`` for the engine's non-negative ranges."""

    return math.floor(value + 0.5)


@dataclass(frozen=True, slots=True)
class TrendAnalyzerConfig:
    instance: int
    candle_buckets: int = 30
    smoothing_candles: int = 15
    multiplier: float = 3.0
    switch_ticks: int = 3


DEFAULT_CONFIGS = (
    TrendAnalyzerConfig(instance=1),
    TrendAnalyzerConfig(instance=2),
)


@dataclass(slots=True)
class _Ohlc:
    open: int | None = None
    high: int | None = None
    low: int | None = None
    close: int | None = None

    @property
    def valid(self) -> bool:
        return self.close is not None

    def update(self, price: int) -> None:
        if self.open is None:
            self.open = price
        self.close = price
        self.high = price if self.high is None else max(self.high, price)
        self.low = price if self.low is None else min(self.low, price)

    def merge(self, other: "_Ohlc") -> None:
        if not other.valid:
            return
        if not self.valid:
            self.open = other.open
            self.high = other.high
            self.low = other.low
            self.close = other.close
            return
        assert self.high is not None and self.low is not None
        assert other.high is not None and other.low is not None
        self.high = max(self.high, other.high)
        self.low = min(self.low, other.low)
        self.close = other.close

    def reset_to_close(self) -> None:
        if self.close is None:
            self.open = None
            self.high = None
            self.low = None
            return
        close = self.close
        self.open = close
        self.high = close
        self.low = close

    def copy(self) -> "_Ohlc":
        return _Ohlc(self.open, self.high, self.low, self.close)

    @classmethod
    def at_close(cls, price: int) -> "_Ohlc":
        return cls(price, price, price, price)


@dataclass(frozen=True, slots=True)
class TrendPoint:
    instance: int
    time: int
    side: TrendSide
    price: float | None

    def to_dict(self) -> dict:
        return {
            "instance": self.instance,
            "time": self.time,
            "side": self.side,
            "price": self.price,
        }


@dataclass(frozen=True, slots=True)
class TrendMarker:
    instance: int
    time: int
    kind: TrendMarkerKind
    side: TrendSide
    line_price: float
    market_price: float

    def to_dict(self) -> dict:
        return {
            "instance": self.instance,
            "time": self.time,
            "kind": self.kind,
            "side": self.side,
            "linePrice": self.line_price,
            "marketPrice": self.market_price,
        }


@dataclass(slots=True)
class TrendAnalyzerBatch:
    time: int
    points: list[TrendPoint]
    markers: list[TrendMarker]

    @property
    def empty(self) -> bool:
        return not self.points and not self.markers


class _TrendState:
    def __init__(self, config: TrendAnalyzerConfig, owner: "TrendAnalyzerEngine") -> None:
        self.config = config
        self.owner = owner
        self.reset()

    def reset(self) -> None:
        self.offset: float | None = None
        self.buy_line: float | None = None
        self.sell_line: float | None = None
        self.direction: TrendSide | None = None
        self.completed_samples = 0

    def _line(self) -> float | None:
        return self.buy_line if self.direction == "buy" else self.sell_line

    def _point(self, at: int, side: TrendSide, level: float | None) -> None:
        self.owner._emit_point(self.config.instance, at, side, level)

    def _marker(
        self,
        at: int,
        kind: TrendMarkerKind,
        side: TrendSide,
        line_level: float,
        market_level: int,
    ) -> None:
        self.owner._emit_marker(
            self.config.instance,
            at,
            kind,
            side,
            line_level,
            market_level,
        )

    def _start_side(self, at: int, side: TrendSide, close: int) -> None:
        assert self.offset is not None
        level = close - self.offset if side == "buy" else close + self.offset
        if side == "buy":
            self.buy_line = level
        else:
            self.sell_line = level
        self._point(at, side, level)
        self._marker(at, "new_candle", side, level, close)
        self._marker(at, "trend_change", side, level, close)

    def update_intrabar(self, at: int, ohlc: _Ohlc) -> None:
        if self.offset is None or not ohlc.valid or self.direction is None:
            return
        assert ohlc.high is not None and ohlc.low is not None and ohlc.close is not None

        # The reference checks reversal against the old line before applying a
        # same-pulse trailing update.  Preserve this ordering exactly.
        if self.direction == "buy":
            if self.buy_line is None:
                self._start_side(at, "buy", ohlc.close)
                return
            if self.buy_line >= ohlc.low + self.config.switch_ticks:
                old = self.buy_line
                self._marker(at, "new_candle", "buy", old, ohlc.close)
                self._point(at - 100, "buy", old)
                self._point(at, "buy", None)
                self.direction = "sell"
                self.buy_line = None
                self._start_side(at, "sell", ohlc.close)
                return
            candidate = ohlc.high - self.offset
            if self.buy_line < candidate:
                self.buy_line = candidate
                self._point(at, "buy", candidate)
            return

        if self.sell_line is None:
            self._start_side(at, "sell", ohlc.close)
            return
        if self.sell_line <= ohlc.high - self.config.switch_ticks:
            old = self.sell_line
            self._marker(at, "new_candle", "sell", old, ohlc.close)
            self._point(at - 100, "sell", old)
            self._point(at, "sell", None)
            self.direction = "buy"
            self.sell_line = None
            self._start_side(at, "buy", ohlc.close)
            return
        candidate = ohlc.low + self.offset
        if self.sell_line > candidate:
            self.sell_line = candidate
            self._point(at, "sell", candidate)

    def on_history_bucket(self, at: int, index: int, history: list[_Ohlc]) -> None:
        interval = self.config.candle_buckets
        if index <= 0 or index % interval != 0:
            return
        if self.offset is None:
            self._point(at, "buy", None)
            self._point(at, "sell", None)
            self.offset = 0.0
        if self.direction is None:
            first_open = history[0].open
            latest_close = history[index].close
            if first_open is None or latest_close is None:
                return
            self.direction = "buy" if latest_close > first_open else "sell"

        window = history[max(0, index - interval + 1) : index + 1]
        highs = [item.high for item in window if item.high is not None]
        lows = [item.low for item in window if item.low is not None]
        if not highs or not lows:
            return
        scaled_range = (max(highs) - min(lows)) * self.config.multiplier
        self.completed_samples += 1
        count = min(self.completed_samples, self.config.smoothing_candles)
        self.offset = float(
            _java_round((self.offset * (count - 1) + scaled_range) / count)
        )

        close = history[index].close
        if close is None:
            return
        self.update_intrabar(at, _Ohlc.at_close(close))
        line = self._line()
        if line is not None and self.direction is not None:
            self._marker(at, "new_candle", self.direction, line, close)


class TrendAnalyzerEngine:
    """Two-instance TTW-compatible trend analyzer with retained chart history."""

    def __init__(
        self,
        configs: Iterable[TrendAnalyzerConfig] = DEFAULT_CONFIGS,
        *,
        tick_size: float = TICK_SIZE,
        retention_ms: int = HISTORY_RETENTION_MS,
    ) -> None:
        self.tick_size = tick_size
        self.retention_ms = retention_ms
        self.configs = tuple(configs)
        self.source_contract: str | None = None
        self._points: deque[TrendPoint] = deque()
        self._markers: deque[TrendMarker] = deque()
        self._batch_points: list[TrendPoint] = []
        self._batch_markers: list[TrendMarker] = []
        self._states = [_TrendState(config, self) for config in self.configs]
        self._current_second = _Ohlc()
        self._pending_ten_seconds = _Ohlc()
        self._history: list[_Ohlc] = []
        self._second_pulses = 0
        self._last_second: int | None = None

    def reset(self, *, clear_history: bool = True) -> None:
        self._current_second = _Ohlc()
        self._pending_ten_seconds = _Ohlc()
        self._history = []
        self._second_pulses = 0
        self._last_second = None
        self._batch_points = []
        self._batch_markers = []
        for state in self._states:
            state.reset()
        if clear_history:
            self._points.clear()
            self._markers.clear()

    def _price_level(self, price: float) -> int:
        return _java_round(price / self.tick_size)

    def _price(self, level: float) -> float:
        return round(level * self.tick_size, 10)

    def _emit_point(
        self,
        instance: int,
        at: int,
        side: TrendSide,
        level: float | None,
    ) -> None:
        point = TrendPoint(
            instance=instance,
            time=int(at),
            side=side,
            price=None if level is None else self._price(level),
        )
        self._points.append(point)
        self._batch_points.append(point)

    def _emit_marker(
        self,
        instance: int,
        at: int,
        kind: TrendMarkerKind,
        side: TrendSide,
        line_level: float,
        market_level: int,
    ) -> None:
        marker = TrendMarker(
            instance=instance,
            time=int(at),
            kind=kind,
            side=side,
            line_price=self._price(line_level),
            market_price=self._price(market_level),
        )
        self._markers.append(marker)
        self._batch_markers.append(marker)

    def on_trade(self, trade: NormalizedTrade) -> list[TrendAnalyzerBatch]:
        if trade.volume <= 0:
            return []
        if self.source_contract is not None and self.source_contract != trade.contract:
            self.reset(clear_history=True)
        self.source_contract = trade.contract
        if self._last_second is None:
            self._last_second = trade.time - trade.time % 1_000
            batches: list[TrendAnalyzerBatch] = []
        else:
            batches = self.advance(trade.time)
        level = self._price_level(trade.price)
        self._current_second.update(level)
        return batches

    def advance(self, at: int) -> list[TrendAnalyzerBatch]:
        """Process every complete one-second pulse through ``at``."""

        if self._last_second is None:
            self._last_second = at - at % 1_000
            return []
        target = at - at % 1_000
        batches: list[TrendAnalyzerBatch] = []
        while self._last_second + 1_000 <= target:
            pulse_time = self._last_second + 1_000
            self._batch_points = []
            self._batch_markers = []
            self._process_second(pulse_time)
            if self._batch_points or self._batch_markers:
                batches.append(
                    TrendAnalyzerBatch(
                        time=pulse_time,
                        points=self._batch_points,
                        markers=self._batch_markers,
                    )
                )
            self._last_second = pulse_time
        self._purge(target - self.retention_ms)
        return batches

    def _process_second(self, at: int) -> None:
        self._pending_ten_seconds.merge(self._current_second)
        for state in self._states:
            state.update_intrabar(at, self._current_second)
        self._current_second.reset_to_close()

        self._second_pulses += 1
        if self._second_pulses < 10:
            return
        self._second_pulses = 0
        if not self._pending_ten_seconds.valid:
            return
        self._history.append(self._pending_ten_seconds.copy())
        self._pending_ten_seconds.reset_to_close()
        index = len(self._history) - 1
        for state in self._states:
            state.on_history_bucket(at, index, self._history)

    def seed_seconds(
        self,
        rows: Iterable[tuple[int, float, float, float, float]],
        *,
        through_time: int,
        source_contract: str,
    ) -> None:
        """Warm the engine from raw-store one-second OHLC rows."""

        self.reset(clear_history=True)
        self.source_contract = source_contract
        for bucket, open_price, high, low, close in rows:
            if self._last_second is None:
                self._last_second = int(bucket)
            else:
                self.advance(int(bucket))
            self._current_second = _Ohlc(
                self._price_level(open_price),
                self._price_level(high),
                self._price_level(low),
                self._price_level(close),
            )
        self.advance(through_time)

    def _purge(self, cutoff: int) -> None:
        while self._points and self._points[0].time < cutoff:
            self._points.popleft()
        while self._markers and self._markers[0].time < cutoff:
            self._markers.popleft()

    def history(self, start: int, end: int, *, limit: int = 50_000) -> dict:
        safe_limit = max(1, min(int(limit), 100_000))
        points = list(self._points)
        selected_points = [point for point in points if start <= point.time <= end]

        # A changed-only line series needs its last pre-range point to establish
        # the value at the left edge of the requested window.
        context: dict[tuple[int, TrendSide], TrendPoint] = {}
        for point in points:
            if point.time > start:
                break
            context[(point.instance, point.side)] = point
        keys_in_range = {(point.instance, point.side, point.time) for point in selected_points}
        for point in context.values():
            key = (point.instance, point.side, point.time)
            if key not in keys_in_range:
                selected_points.insert(0, point)

        selected_points.sort(key=lambda item: (item.time, item.instance, item.side))
        selected_markers = [
            marker for marker in self._markers if start <= marker.time <= end
        ]
        if len(selected_points) > safe_limit:
            selected_points = selected_points[-safe_limit:]
        if len(selected_markers) > safe_limit:
            selected_markers = selected_markers[-safe_limit:]
        return {
            "points": [point.to_dict() for point in selected_points],
            "markers": [marker.to_dict() for marker in selected_markers],
        }
