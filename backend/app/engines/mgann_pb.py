"""Internal-5 PB subset of frontend/chart/mgannSwing.ts, including live tail.

Closed bars commit confirmed pivots; previews calculate developing pivots
without mutating that state. Missing delta never counts as evidence.
"""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass

from .smc_external import SmcBar


@dataclass(frozen=True)
class PbSignal:
    time: int
    direction: int
    high: float
    low: float


@dataclass(frozen=True)
class MgannWave:
    start_time: int
    end_time: int
    start_price: float
    end_price: float
    direction: int


@dataclass(frozen=True)
class _Point:
    index: int
    bar: SmcBar
    volume: int
    delta: int
    delta_count: int
    kind: int = 0

    @property
    def price(self) -> float:
        return self.bar.high if self.kind == 1 else self.bar.low


class MgannPbState:
    def __init__(self) -> None:
        self._window: deque[_Point] = deque(maxlen=11)
        self._pivots: deque[_Point] = deque(maxlen=8)
        self._index = -1
        self._volume = self._delta = self._delta_count = 0

    def update(self, bar: SmcBar, delta: int | None) -> PbSignal | None:
        self._index += 1
        self._volume += bar.volume
        self._delta += delta or 0
        self._delta_count += int(delta is not None)
        self._window.append(_Point(
            self._index, bar, self._volume, self._delta, self._delta_count,
        ))
        if len(self._window) < 11:
            return None
        rows = list(self._window)
        changed = self._append_candidate(rows, 5)
        return self._signal() if changed else None

    def live_signals(self, bar: SmcBar | None = None, delta: int | None = None) -> list[PbSignal]:
        points = self._preview_points(bar, delta)
        signals = []
        for end in range(6, len(points) + 1):
            signal = self._signal_points(points[end-6:end])
            if signal is not None:
                signals.append(signal)
        return signals

    def live_waves(self, bar: SmcBar | None = None, delta: int | None = None) -> list[MgannWave]:
        points = self._preview_points(bar, delta)
        return [MgannWave(a.bar.time, b.bar.time, a.price, b.price, b.kind)
                for a, b in zip(points, points[1:])]

    def _preview_points(self, bar: SmcBar | None, delta: int | None) -> list[_Point]:
        rows = list(self._window)
        if bar is not None:
            rows.append(_Point(self._index + 1, bar, self._volume + bar.volume,
                               self._delta + (delta or 0),
                               self._delta_count + int(delta is not None)))
        preview = MgannPbState()
        preview._pivots = deque(self._pivots, maxlen=16)
        for pos in range(5, len(rows)):
            if rows[pos].index > self._index - 5:
                preview._append_candidate(rows, pos)
        return list(preview._pivots)

    def _append_candidate(self, rows: list[_Point], pos: int) -> bool:
        candidate = rows[pos]
        left, right = rows[pos-5:pos], rows[pos+1:pos+6]
        high = (candidate.bar.high > max(p.bar.high for p in left)
                and all(candidate.bar.high >= p.bar.high for p in right))
        low = (candidate.bar.low < min(p.bar.low for p in left)
               and all(candidate.bar.low <= p.bar.low for p in right))
        previous = self._pivots[-1].kind if self._pivots else 0
        kinds = ([-1, 1] if previous == 1 else [1, -1]) if high and low else (
            [1] if high else [-1] if low else []
        )
        changed = False
        for kind in kinds:
            point = _Point(candidate.index, candidate.bar, candidate.volume,
                           candidate.delta, candidate.delta_count, kind)
            last = self._pivots[-1] if self._pivots else None
            if last is not None and last.index == point.index:
                continue
            if last is not None and last.kind == kind:
                if kind * (point.price - last.price) <= 0:
                    continue
                self._pivots.pop()
            self._pivots.append(point)
            changed = True
        return changed

    def _signal(self) -> PbSignal | None:
        return self._signal_points(list(self._pivots))

    @staticmethod
    def _signal_points(points: list[_Point]) -> PbSignal | None:
        if len(points) < 6:
            return None
        start, end = points[-2:]
        prior_start, prior_end = points[-4:-2]
        direction = end.kind
        width = end.index - start.index
        prior_width = prior_end.index - prior_start.index
        volume = end.volume - start.volume
        prior_volume = prior_end.volume - prior_start.volume
        delta = end.delta - start.delta
        prior_delta = prior_end.delta - prior_start.delta
        has_delta = (end.delta_count - start.delta_count == width
                     and prior_end.delta_count - prior_start.delta_count == prior_width)
        price_condition = (
            end.bar.close <= prior_end.bar.close and end.bar.high <= prior_end.bar.low
            if direction == 1 else
            end.bar.close >= prior_end.bar.close and end.bar.low >= prior_end.bar.high
        )
        length_condition = abs(end.price - start.price) <= abs(prior_end.price - prior_start.price)
        volume_condition = volume / width > prior_volume / prior_width or volume > prior_volume
        delta_condition = has_delta and (
            direction * delta / width < direction * prior_delta / prior_width
            or direction * delta < direction * prior_delta
        )
        if price_condition and length_condition and (volume_condition or delta_condition):
            return PbSignal(end.bar.time, direction, end.bar.high, end.bar.low)
        return None
