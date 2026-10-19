"""TTW 3.7.4-compatible Market Explorer trade-signal engines.

The installed addon evaluates Market Volume Stop every 300 ms and evaluates
Volume Spike plus Absorption every 100 ms.  The cluster detectors arm at the
configured threshold, retain the best point, and publish only after the burst
falls back.  Keeping that state transition is important: the chart marker is
placed at the burst peak, not at the later detection time.
"""

from __future__ import annotations

from collections import deque
from copy import deepcopy
from dataclasses import dataclass
import math
from typing import Any

from ..models.canonical import NormalizedTrade, Side

SAMPLE_INTERVAL_MS = 300
CLUSTER_INTERVAL_MS = 100
_ABSORPTION_RANGE_TICKS = 2
_HISTORY_SAMPLES = 12 * 60 * 60 * 1000 // SAMPLE_INTERVAL_MS
_HISTORY_SIGNALS = 10_000
_NO_OPPOSITE_RATIO = 1_000_000_000.0


@dataclass(slots=True, frozen=True)
class MarketVolumeSample:
    time: int
    value: float
    buy_volume: float
    sell_volume: float
    price: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "time": self.time,
            "value": self.value,
            "buyVolume": self.buy_volume,
            "sellVolume": self.sell_volume,
            "price": self.price,
        }


@dataclass(slots=True, frozen=True)
class MarketExplorerSignal:
    kind: str
    detection_time: int
    time: int
    side: str
    threshold: float
    value: float
    ratio: float
    price: float
    signal_index: int = 1
    price_range_ticks: int | None = None
    opposite_volume: float | None = None

    @property
    def signal_id(self) -> str:
        return (
            f"{self.kind}:{self.signal_index}:{self.time}:"
            f"{self.detection_time}:{self.side}"
        )

    def to_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "signalId": self.signal_id,
            "kind": self.kind,
            "signalIndex": self.signal_index,
            "detectionTime": self.detection_time,
            "time": self.time,
            "side": self.side,
            "threshold": self.threshold,
            "value": self.value,
            "ratio": self.ratio,
            "price": self.price,
        }
        if self.price_range_ticks is not None:
            out["priceRangeTicks"] = self.price_range_ticks
        if self.opposite_volume is not None:
            out["oppositeVolume"] = self.opposite_volume
        return out


class _DecayedVolume:
    def __init__(self, halftime_seconds: int) -> None:
        self._halftime_seconds = halftime_seconds
        self._value = 0.0
        self._time: int | None = None

    def reset(self, halftime_seconds: int | None = None) -> None:
        if halftime_seconds is not None:
            self._halftime_seconds = halftime_seconds
        self._value = 0.0
        self._time = None

    def value_at(self, at: int) -> float:
        if self._time is None:
            self._time = at
            return self._value
        safe_at = max(at, self._time)
        if safe_at != self._time:
            tau_ms = self._halftime_seconds * 1000.0 / math.log(2.0)
            self._value *= math.exp((self._time - safe_at) / tau_ms)
            self._time = safe_at
        return self._value

    def add(self, at: int, volume: float) -> None:
        self._value = self.value_at(at) + volume


class _ImmediateSignal:
    def __init__(self, settings: dict[str, Any]) -> None:
        self.configure(settings)
        self.reset()

    def configure(self, settings: dict[str, Any]) -> None:
        self.ask_threshold = float(settings["askLevel"])
        self.bid_threshold = float(settings["bidLevel"])

    def reset(self) -> None:
        self.sell_side = False
        self.threshold = self.ask_threshold
        self.armed = True

    def evaluate(self, at: int, value: float, price: float) -> MarketExplorerSignal | None:
        magnitude = abs(value)
        if (self.sell_side and value > 0.0) or (not self.sell_side and value <= 0.0):
            self.sell_side = not self.sell_side
            self.threshold = self.bid_threshold if self.sell_side else self.ask_threshold
            self.armed = True
        emitted = None
        if self.armed and magnitude > self.threshold:
            self.armed = False
            emitted = MarketExplorerSignal(
                kind="market_volume_stop",
                detection_time=at,
                time=at,
                side="sell" if value <= 0 else "buy",
                threshold=self.threshold,
                value=magnitude,
                ratio=magnitude / self.threshold,
                price=price,
            )
        if magnitude < self.threshold * 0.9:
            self.armed = True
        return emitted


class _StandardSignal:
    def __init__(self, settings: dict[str, Any], tick_size: float) -> None:
        self.tick_size = tick_size
        self.configure(settings)
        self.reset()

    def configure(self, settings: dict[str, Any]) -> None:
        self.ask_threshold = float(settings["askLevel"])
        self.bid_threshold = float(settings["bidLevel"])
        self.pullback_duration_ms = int(settings["pullbackDurationMinutes"]) * 60_000
        self.pullback_ticks = int(settings["pullbackPriceChangeTicks"])

    def reset(self) -> None:
        self.sell_side = False
        self.threshold = self.ask_threshold
        self.peak = self.threshold
        self.peak_time = 0
        self.peak_price = 0.0
        self.tracking_peak = False
        self.armed = True
        self.suppression_state = "normal"
        self.suppression_started_at = 0
        self.last_signal_time = 0
        self.last_signal_price_ticks = 0
        self.last_signal_side = "buy"

    def _ticks(self, price: float) -> int:
        return round(price / self.tick_size)

    def _pullback_reached(self, price_ticks: int) -> bool:
        distance = abs(price_ticks - self.last_signal_price_ticks)
        if self.last_signal_side == "sell":
            return price_ticks > self.last_signal_price_ticks and distance >= self.pullback_ticks
        return price_ticks <= self.last_signal_price_ticks and distance >= self.pullback_ticks

    def _suppressed(self, at: int, price_ticks: int) -> bool:
        if self.suppression_state == "normal":
            if at - self.last_signal_time > self.pullback_duration_ms:
                return False
            if self._pullback_reached(price_ticks):
                return False
            self.suppression_state = "suppressed"
            self.suppression_started_at = at
            return True
        if at - self.suppression_started_at > self.pullback_duration_ms:
            self.suppression_state = "normal"
            return False
        if not self._pullback_reached(price_ticks):
            self.suppression_started_at = at
        return True

    def evaluate(self, at: int, value: float, price: float) -> MarketExplorerSignal | None:
        magnitude = abs(value)
        price_ticks = self._ticks(price)
        if (self.sell_side and value > 0.0) or (not self.sell_side and value <= 0.0):
            self.sell_side = not self.sell_side
            self.threshold = self.bid_threshold if self.sell_side else self.ask_threshold
            self.tracking_peak = False
            self.armed = True
            self.peak = self.threshold
            self.peak_time = at
            self.peak_price = price

        if magnitude > self.peak:
            self.peak = magnitude
            self.peak_time = at
            self.peak_price = price
            if self.armed:
                self.armed = False
                self.tracking_peak = True

        emitted = None
        if magnitude < self.peak * 0.9 and self.tracking_peak:
            self.tracking_peak = False
            suppressed = self._suppressed(at, price_ticks)
            self.last_signal_time = at
            self.last_signal_price_ticks = price_ticks
            self.last_signal_side = "sell" if value <= 0 else "buy"
            if not suppressed:
                emitted = MarketExplorerSignal(
                    kind="market_volume_stop",
                    detection_time=at,
                    time=self.peak_time,
                    side="sell" if value <= 0 else "buy",
                    threshold=self.threshold,
                    value=self.peak,
                    ratio=self.peak / self.threshold,
                    price=self.peak_price,
                )

        if magnitude < max(self.threshold * 0.9, self.peak * 0.8):
            self.peak = max(magnitude * 1.2, self.threshold)
            self.peak_time = at
            self.peak_price = price
            self.armed = True
        return emitted


class _MarketVolumeSignalEngine:
    def __init__(self, settings: dict[str, Any], tick_size: float) -> None:
        self.tick_size = tick_size
        self.configure(settings)

    def configure(self, settings: dict[str, Any]) -> None:
        self.settings = deepcopy(settings)
        self.standard = _StandardSignal(settings, self.tick_size)
        self.immediate = _ImmediateSignal(settings)

    def reset(self) -> None:
        self.standard.reset()
        self.immediate.reset()

    def evaluate(self, at: int, value: float, price: float) -> MarketExplorerSignal | None:
        # TTW advances both state machines and selects the configured result.
        standard = self.standard.evaluate(at, value, price)
        immediate = self.immediate.evaluate(at, value, price)
        return standard if self.settings["displayMode"] == "standard" else immediate


@dataclass(slots=True, frozen=True)
class _TradePoint:
    time: int
    price_ticks: int
    price: float
    volume: float


@dataclass(slots=True, frozen=True)
class _ClusterPeak:
    time: int
    price_ticks: int
    price: float
    volume: float
    price_range_ticks: int
    opposite_volume: float = 0.0


class _VolumeSpikeSide:
    """One side of TTW's UE/Ce volume-spike pair."""

    def __init__(self, side: str) -> None:
        self.side = side
        self.points: deque[_TradePoint] = deque()
        self.reset()

    def reset(self, at: int = 0) -> None:
        self.active = False
        self.reset_at = at
        self.peak: _ClusterPeak | None = None

    def clear(self) -> None:
        self.points.clear()
        self.reset()

    def add(self, point: _TradePoint) -> None:
        self.points.append(point)

    def _window(self, cutoff: int, at: int) -> list[_TradePoint]:
        while self.points and self.points[0].time < cutoff:
            self.points.popleft()
        start = max(cutoff, self.reset_at)
        return [point for point in self.points if start <= point.time <= at]

    def volume_since(self, cutoff: int, at: int) -> float:
        return sum(point.volume for point in self.points if cutoff <= point.time <= at)

    def evaluate(
        self,
        *,
        at: int,
        cutoff: int,
        trigger: float,
        price_range_ticks: int,
        opposite: _VolumeSpikeSide,
    ) -> _ClusterPeak | None:
        points = self._window(cutoff, at)
        if not points:
            if self.active and self.peak is not None:
                completed = self.peak
                self.reset(at)
                return completed
            return None

        total = 0.0
        min_price = math.inf
        max_price = -math.inf
        retrace_price = math.inf if self.side == "buy" else -math.inf
        latest_extreme_is_high = False
        extreme_point = points[0]

        for point in points:
            total += point.volume
            price = point.price_ticks
            if self.side == "buy":
                retrace_price = min(retrace_price, price)
                if price < min_price:
                    min_price = price
                    latest_extreme_is_high = False
                if price > max_price:
                    max_price = price
                    retrace_price = price
                    extreme_point = point
                    latest_extreme_is_high = True
            else:
                retrace_price = max(retrace_price, price)
                if price > max_price:
                    max_price = price
                    latest_extreme_is_high = True
                if price < min_price:
                    min_price = price
                    retrace_price = price
                    extreme_point = point
                    latest_extreme_is_high = False

        directional_range = int(
            max_price - min_price if latest_extreme_is_high else min_price - max_price
        )

        if self.active and self.peak is not None:
            extends = (
                extreme_point.price_ticks > self.peak.price_ticks
                if self.side == "buy"
                else extreme_point.price_ticks < self.peak.price_ticks
            )
            if extends:
                self.peak = _ClusterPeak(
                    time=extreme_point.time,
                    price_ticks=extreme_point.price_ticks,
                    price=extreme_point.price,
                    volume=max(total, self.peak.volume),
                    price_range_ticks=max(abs(directional_range), self.peak.price_range_ticks),
                    opposite_volume=opposite.volume_since(extreme_point.time, at),
                )
            retraced = (
                retrace_price < self.peak.price_ticks - 1
                if self.side == "buy"
                else retrace_price > self.peak.price_ticks + 1
            )
            if total < 0.85 * self.peak.volume or retraced:
                completed = self.peak
                self.reset(at)
                return completed
        elif (
            total >= trigger
            and (
                directional_range >= price_range_ticks
                if self.side == "buy"
                else directional_range <= -price_range_ticks
            )
        ):
            self.active = True
            self.peak = _ClusterPeak(
                time=extreme_point.time,
                price_ticks=extreme_point.price_ticks,
                price=extreme_point.price,
                volume=total,
                price_range_ticks=abs(directional_range),
                opposite_volume=opposite.volume_since(extreme_point.time, at),
            )
        return None


class _VolumeSpikeEngine:
    def __init__(self, tick_size: float) -> None:
        self.tick_size = tick_size
        self.buy = _VolumeSpikeSide("buy")
        self.sell = _VolumeSpikeSide("sell")

    def reset(self) -> None:
        self.buy.clear()
        self.sell.clear()

    def add(self, trade: NormalizedTrade, side: Side) -> None:
        point = _TradePoint(
            time=trade.time,
            price_ticks=round(float(trade.price) / self.tick_size),
            price=float(trade.price),
            volume=float(trade.volume),
        )
        (self.buy if side is Side.BUY else self.sell).add(point)

    def evaluate(self, at: int, settings: dict[str, Any]) -> list[MarketExplorerSignal]:
        duration_ms = round(float(settings["maximumDurationSeconds"]) * 1000)
        cutoff = at - duration_ms
        trigger = float(settings["triggerVolume"])
        price_range = int(settings["priceRangeTicks"])
        buy_peak = self.buy.evaluate(
            at=at,
            cutoff=cutoff,
            trigger=trigger,
            price_range_ticks=price_range,
            opposite=self.sell,
        )
        sell_peak = self.sell.evaluate(
            at=at,
            cutoff=cutoff,
            trigger=trigger,
            price_range_ticks=price_range,
            opposite=self.buy,
        )
        minimum_ratio = float(settings["ratioGreaterEqual"])
        emitted: list[MarketExplorerSignal] = []
        for side, peak in (("buy", buy_peak), ("sell", sell_peak)):
            if peak is None:
                continue
            ratio = (
                peak.volume / peak.opposite_volume
                if peak.opposite_volume > 0.0
                else _NO_OPPOSITE_RATIO
            )
            # The addon first rejects ratios below one, then applies the user
            # ratio threshold.  The settings validator keeps the latter >= 1.
            if ratio < 1.0 or ratio < minimum_ratio:
                continue
            emitted.append(
                MarketExplorerSignal(
                    kind="volume_spike",
                    detection_time=at,
                    time=peak.time,
                    side=side,
                    threshold=trigger,
                    value=peak.volume,
                    ratio=ratio,
                    price=peak.price,
                    price_range_ticks=peak.price_range_ticks,
                    opposite_volume=peak.opposite_volume,
                )
            )
        return emitted


class _AbsorptionSide:
    """TTW jh detector: high same-side volume held inside two ticks."""

    def __init__(self, side: str) -> None:
        self.side = side
        self.points: deque[_TradePoint] = deque()
        self.active = False
        self.peak: _ClusterPeak | None = None

    def clear(self) -> None:
        self.points.clear()
        self.active = False
        self.peak = None

    def add(self, point: _TradePoint) -> None:
        self.points.append(point)

    def evaluate(self, *, at: int, cutoff: int, trigger: float) -> _ClusterPeak | None:
        while self.points and self.points[0].time < cutoff:
            self.points.popleft()
        points = [point for point in self.points if point.time <= at]
        if not points:
            if self.active and self.peak is not None:
                completed = self.peak
                self.clear()
                return completed
            return None

        total = sum(point.volume for point in points)
        min_price = min(point.price_ticks for point in points)
        max_price = max(point.price_ticks for point in points)
        spread = abs(max_price - min_price)
        last = points[-1]

        if self.active and self.peak is not None:
            if total > self.peak.volume and spread < _ABSORPTION_RANGE_TICKS:
                self.peak = _ClusterPeak(
                    time=last.time,
                    price_ticks=last.price_ticks,
                    price=last.price,
                    volume=total,
                    price_range_ticks=spread,
                )
            if total < 0.9 * self.peak.volume or spread >= _ABSORPTION_RANGE_TICKS:
                completed = self.peak
                self.clear()
                return completed
        elif total >= trigger and spread < _ABSORPTION_RANGE_TICKS:
            self.active = True
            self.peak = _ClusterPeak(
                time=last.time,
                price_ticks=last.price_ticks,
                price=last.price,
                volume=total,
                price_range_ticks=spread,
            )
        return None


class _AbsorptionEngine:
    def __init__(self, tick_size: float) -> None:
        self.tick_size = tick_size
        self.buy = _AbsorptionSide("buy")
        self.sell = _AbsorptionSide("sell")

    def reset(self) -> None:
        self.buy.clear()
        self.sell.clear()

    def add(self, trade: NormalizedTrade, side: Side) -> None:
        point = _TradePoint(
            time=trade.time,
            price_ticks=round(float(trade.price) / self.tick_size),
            price=float(trade.price),
            volume=float(trade.volume),
        )
        (self.buy if side is Side.BUY else self.sell).add(point)

    def evaluate(self, at: int, settings: dict[str, Any]) -> list[MarketExplorerSignal]:
        duration_ms = round(float(settings["maximumDurationSeconds"]) * 1000)
        cutoff = at - duration_ms
        trigger = float(settings["triggerVolume"])
        emitted: list[MarketExplorerSignal] = []
        for side, state in (("buy", self.buy), ("sell", self.sell)):
            peak = state.evaluate(at=at, cutoff=cutoff, trigger=trigger)
            if peak is None:
                continue
            emitted.append(
                MarketExplorerSignal(
                    kind="absorption",
                    detection_time=at,
                    time=peak.time,
                    side=side,
                    threshold=trigger,
                    value=peak.volume,
                    ratio=peak.volume / trigger,
                    price=peak.price,
                    price_range_ticks=peak.price_range_ticks,
                )
            )
        return emitted


class MarketVolumeStopEngine:
    """Combined Market Explorer engine; name retained for runtime compatibility."""

    def __init__(self, settings: dict[str, Any], *, tick_size: float = 0.1) -> None:
        self.tick_size = tick_size
        self.settings = deepcopy(settings)
        half = int(settings["halftimeSeconds"])
        self._buy = _DecayedVolume(half)
        self._sell = _DecayedVolume(half)
        self._market_volume_signal = _MarketVolumeSignalEngine(settings["signal"], tick_size)
        self._volume_spike = _VolumeSpikeEngine(tick_size)
        self._absorption = _AbsorptionEngine(tick_size)
        self._samples: deque[MarketVolumeSample] = deque(maxlen=_HISTORY_SAMPLES)
        self._signal_history: deque[MarketExplorerSignal] = deque(maxlen=_HISTORY_SIGNALS)
        self._pending_signals: list[MarketExplorerSignal] = []
        self._next_sample_at: int | None = None
        self._next_cluster_at: int | None = None
        self._last_price: float | None = None
        self.source_contract: str | None = None

    def configure(self, settings: dict[str, Any]) -> None:
        old_algorithm = self._algorithm_settings(self.settings)
        self.settings = deepcopy(settings)
        if old_algorithm == self._algorithm_settings(settings):
            return
        self.reset()
        self._market_volume_signal = _MarketVolumeSignalEngine(
            settings["signal"], self.tick_size
        )

    @staticmethod
    def _algorithm_settings(settings: dict[str, Any]) -> tuple[Any, ...]:
        signal = settings["signal"]
        spike = settings["volumeSpike"]
        absorption = settings["absorption"]
        return (
            settings["halftimeSeconds"],
            *(signal[field] for field in (
                "enabled",
                "askLevel",
                "bidLevel",
                "displayMode",
                "pullbackDurationMinutes",
                "pullbackPriceChangeTicks",
            )),
            *(spike[field] for field in (
                "enabled",
                "triggerVolume",
                "maximumDurationSeconds",
                "priceRangeTicks",
                "ratioGreaterEqual",
            )),
            *(absorption[field] for field in (
                "enabled",
                "triggerVolume",
                "maximumDurationSeconds",
            )),
        )

    def reset(self, *, clear_history: bool = False) -> None:
        half = int(self.settings["halftimeSeconds"])
        self._buy.reset(half)
        self._sell.reset(half)
        self._market_volume_signal.reset()
        self._volume_spike.reset()
        self._absorption.reset()
        self._pending_signals.clear()
        self._next_sample_at = None
        self._next_cluster_at = None
        self._last_price = None
        if clear_history:
            self._samples.clear()
            self._signal_history.clear()

    @staticmethod
    def _trade_side(trade: NormalizedTrade) -> Side | None:
        side = trade.side
        if side is None:
            if trade.ask is not None and trade.price >= trade.ask:
                side = Side.BUY
            elif trade.bid is not None and trade.price <= trade.bid:
                side = Side.SELL
        return side

    def on_trade(self, trade: NormalizedTrade) -> None:
        self._last_price = float(trade.price)
        self.source_contract = trade.contract
        if self._next_sample_at is None:
            self._next_sample_at = trade.time + SAMPLE_INTERVAL_MS
        if self._next_cluster_at is None:
            self._next_cluster_at = trade.time + CLUSTER_INTERVAL_MS
        side = self._trade_side(trade)
        if side is Side.BUY:
            self._buy.add(trade.time, trade.volume)
        elif side is Side.SELL:
            self._sell.add(trade.time, trade.volume)
        else:
            return
        self._volume_spike.add(trade, side)
        self._absorption.add(trade, side)

    def _record_cluster_signals(self, at: int) -> None:
        signals = [
            *self._volume_spike.evaluate(at, self.settings["volumeSpike"]),
            *self._absorption.evaluate(at, self.settings["absorption"]),
        ]
        for signal in signals:
            section = (
                self.settings["volumeSpike"]
                if signal.kind == "volume_spike"
                else self.settings["absorption"]
            )
            if not bool(section["enabled"]):
                continue
            self._pending_signals.append(signal)
            self._signal_history.append(signal)

    def advance(self, at: int) -> list[tuple[MarketVolumeSample, list[MarketExplorerSignal]]]:
        if (
            self._next_sample_at is None
            or self._next_cluster_at is None
            or self._last_price is None
        ):
            return []

        longest_window_ms = round(
            max(
                float(self.settings["volumeSpike"]["maximumDurationSeconds"]),
                float(self.settings["absorption"]["maximumDurationSeconds"]),
            )
            * 1000
        )
        if at - self._next_cluster_at > max(100_000, longest_window_ms * 4):
            self._next_cluster_at = max(
                self._next_cluster_at,
                at - longest_window_ms - CLUSTER_INTERVAL_MS,
            )
        while self._next_cluster_at <= at:
            self._record_cluster_signals(self._next_cluster_at)
            self._next_cluster_at += CLUSTER_INTERVAL_MS

        updates: list[tuple[MarketVolumeSample, list[MarketExplorerSignal]]] = []
        if at - self._next_sample_at > SAMPLE_INTERVAL_MS * 1_000:
            self._next_sample_at = at - at % SAMPLE_INTERVAL_MS
        while self._next_sample_at <= at:
            sample_at = self._next_sample_at
            buy = self._buy.value_at(sample_at)
            sell = self._sell.value_at(sample_at)
            value = buy - sell
            sample = MarketVolumeSample(
                time=sample_at,
                value=value,
                buy_volume=buy,
                sell_volume=sell,
                price=self._last_price,
            )
            emitted = [
                signal
                for signal in self._pending_signals
                if signal.detection_time <= sample_at
            ]
            self._pending_signals = [
                signal
                for signal in self._pending_signals
                if signal.detection_time > sample_at
            ]
            signal = self._market_volume_signal.evaluate(
                sample_at, value, self._last_price
            )
            if signal is not None and bool(self.settings["signal"]["enabled"]):
                emitted.append(signal)
                self._signal_history.append(signal)
            emitted.sort(key=lambda item: (item.detection_time, item.kind, item.side))
            self._samples.append(sample)
            updates.append((sample, emitted))
            self._next_sample_at += SAMPLE_INTERVAL_MS
        return updates

    def history(self, start: int, end: int, *, limit: int = 20_000) -> dict[str, Any]:
        samples = [sample for sample in self._samples if start <= sample.time <= end]
        if len(samples) > limit:
            stride = math.ceil(len(samples) / limit)
            samples = samples[::stride]
        signals = [
            signal
            for signal in self._signal_history
            if start <= signal.detection_time <= end
        ]
        return {
            "samples": [sample.to_dict() for sample in samples],
            "signals": [signal.to_dict() for signal in signals[-limit:]],
        }

    def settings_snapshot(self) -> dict[str, Any]:
        return deepcopy(self.settings)
