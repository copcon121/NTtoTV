"""TDU Buy/Sell Momentum and candle-color delta divergence.

This is a clean-room port of the observable calculation used by the original
Momentum is measured on tick-driven ten-second volume
buckets.  Once fifteen buckets exist, the just-completed bucket is compared
with 4/5/6 population standard deviations.  The signal direction is the chart
bar's cumulative bid/ask delta *before* the boundary-triggering trade.

The default delta-divergence mode is also reproduced: a bearish candle with
positive delta is bearish divergence, while a bullish candle with negative
delta is bullish divergence.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from .bar_aggregator import SUPPORTED_TFS
from .session_calendar import timeframe_bucket_start
from ..models.canonical import NormalizedTrade, Side
from ..models.messages import TduSignalUpdate

__all__ = ["TduSignalEngine"]


@dataclass(slots=True)
class _MomentumBucket:
    start: int
    volume: int = 0


@dataclass(slots=True)
class _BarState:
    time: int
    open: float
    high: float
    low: float
    close: float
    delta: int = 0
    momentum_direction: int = 0
    momentum_level: int = 0
    delta_divergence: int = 0


def _population_stddev(values: list[int]) -> float:
    """Match the original online population-standard-deviation routine."""

    mean = 0.0
    m2 = 0.0
    count = 0
    for raw in values:
        value = abs(float(raw))
        count += 1
        previous = mean
        mean += (value - previous) / count
        m2 += (value - previous) * (value - mean)
    return math.sqrt(m2 / count) if count else 0.0


class TduSignalEngine:
    """Calculate exact-default TDU momentum and bar delta divergence."""

    def __init__(
        self,
        *,
        timeframes: tuple[str, ...] = tuple(SUPPORTED_TFS),
        bucket_ms: int = 10_000,
        stddev_period: int = 15,
    ) -> None:
        self.timeframes = timeframes
        self.bucket_ms = bucket_ms
        self.stddev_period = stddev_period
        self._bucket_by_contract: dict[str, _MomentumBucket] = {}
        self._volumes_by_contract: dict[str, list[int]] = {}
        self._bars: dict[tuple[str, str], _BarState] = {}

    def on_trade(self, trade: NormalizedTrade) -> list[TduSignalUpdate]:
        states = [self._bar_for_trade(trade, tf) for tf in self.timeframes]
        changed: dict[tuple[str, int], TduSignalUpdate] = {}

        # The original tests the bucket boundary before adding the triggering
        # trade.  Its direction therefore reads the chart-bar delta from the
        # preceding tick; a newly-opened chart bar reads zero and resolves buy.
        level = self._roll_momentum_bucket(trade)
        if level:
            for tf, state in zip(self.timeframes, states):
                direction = 1 if state.delta >= 0 else -1
                old_level = state.momentum_level
                old_direction = state.momentum_direction
                state.momentum_level = max(state.momentum_level, level)
                state.momentum_direction = direction
                if (
                    state.momentum_level != old_level
                    or state.momentum_direction != old_direction
                ):
                    update = self._update(trade, tf, state)
                    changed[(tf, state.time)] = update

        buy_volume, sell_volume = self._bid_ask_volume(trade)
        for tf, state in zip(self.timeframes, states):
            state.high = max(state.high, trade.price)
            state.low = min(state.low, trade.price)
            state.close = trade.price
            state.delta += buy_volume - sell_volume
            divergence = self._candle_color_divergence(state)
            if divergence != state.delta_divergence:
                state.delta_divergence = divergence
                update = self._update(trade, tf, state)
                changed[(tf, state.time)] = update

        return list(changed.values())

    def current_updates(self, contract: str, symbol: str) -> list[TduSignalUpdate]:
        updates: list[TduSignalUpdate] = []
        for tf in self.timeframes:
            state = self._bars.get((contract, tf))
            if state is None:
                continue
            if state.momentum_level == 0 and state.delta_divergence == 0:
                continue
            updates.append(
                TduSignalUpdate(
                    symbol=symbol,
                    contract=contract,
                    tf=tf,
                    time=state.time,
                    momentum_direction=state.momentum_direction,
                    momentum_level=state.momentum_level,
                    delta_divergence=state.delta_divergence,
                )
            )
        return updates

    def seed_bar(
        self,
        contract: str,
        timeframe: str,
        *,
        time: int,
        open: float,
        high: float,
        low: float,
        close: float,
        delta: int,
        momentum_direction: int = 0,
        momentum_level: int = 0,
        delta_divergence: int | None = None,
    ) -> None:
        state = _BarState(
            time=time,
            open=open,
            high=high,
            low=low,
            close=close,
            delta=delta,
            momentum_direction=momentum_direction,
            momentum_level=momentum_level,
        )
        state.delta_divergence = (
            self._candle_color_divergence(state)
            if delta_divergence is None
            else delta_divergence
        )
        self._bars[(contract, timeframe)] = state

    def reset_contract(self, contract: str) -> None:
        self._bucket_by_contract.pop(contract, None)
        self._volumes_by_contract.pop(contract, None)
        for key in [key for key in self._bars if key[0] == contract]:
            del self._bars[key]

    def _bar_for_trade(self, trade: NormalizedTrade, timeframe: str) -> _BarState:
        key = (trade.contract, timeframe)
        bucket_time = timeframe_bucket_start(trade.time, timeframe)
        state = self._bars.get(key)
        if state is None or state.time != bucket_time:
            state = _BarState(
                time=bucket_time,
                open=trade.price,
                high=trade.price,
                low=trade.price,
                close=trade.price,
            )
            self._bars[key] = state
        return state

    def _roll_momentum_bucket(self, trade: NormalizedTrade) -> int:
        bucket = self._bucket_by_contract.get(trade.contract)
        volumes = self._volumes_by_contract.setdefault(trade.contract, [])
        if bucket is None:
            bucket = _MomentumBucket(start=trade.time)
            self._bucket_by_contract[trade.contract] = bucket
            volumes.append(0)

        level = 0
        if trade.time - bucket.start >= self.bucket_ms:
            if len(volumes) >= self.stddev_period:
                window = volumes[-self.stddev_period :]
                sigma = _population_stddev(window)
                completed = float(window[-1])
                # Original defaults are (2 + multiplier) * sigma, where the
                # multipliers are 2/3/4, hence thresholds of 4/5/6 sigma.
                if completed >= 6.0 * sigma:
                    level = 3
                elif completed >= 5.0 * sigma:
                    level = 2
                elif completed >= 4.0 * sigma:
                    level = 1
            bucket = _MomentumBucket(start=trade.time)
            self._bucket_by_contract[trade.contract] = bucket
            volumes.append(0)
            # Only the last fifteen values affect the next calculation.  The
            # original retains all buckets, but trimming is mathematically
            # equivalent and bounds a long-running backend's memory.
            if len(volumes) > self.stddev_period:
                del volumes[: len(volumes) - self.stddev_period]

        bucket.volume += trade.volume
        volumes[-1] = bucket.volume
        return level

    @staticmethod
    def _bid_ask_volume(trade: NormalizedTrade) -> tuple[int, int]:
        buy = trade.volume if trade.ask is not None and trade.price >= trade.ask else 0
        sell = trade.volume if trade.bid is not None and trade.price <= trade.bid else 0
        # Rithmic supplies exchange aggressor side but may not attach a quote
        # snapshot to each trade.  Use that authoritative equivalent only when
        # the original BidAsk comparisons cannot be performed.
        if trade.ask is None and trade.bid is None:
            if trade.side is Side.BUY:
                buy = trade.volume
            elif trade.side is Side.SELL:
                sell = trade.volume
        return buy, sell

    @staticmethod
    def _candle_color_divergence(state: _BarState) -> int:
        if state.delta > 0 and state.close < state.open:
            return -1
        if state.delta < 0 and state.close > state.open:
            return 1
        return 0

    @staticmethod
    def _update(
        trade: NormalizedTrade, timeframe: str, state: _BarState
    ) -> TduSignalUpdate:
        return TduSignalUpdate(
            symbol=trade.symbol,
            contract=trade.contract,
            tf=timeframe,
            time=state.time,
            momentum_direction=state.momentum_direction,
            momentum_level=state.momentum_level,
            delta_divergence=state.delta_divergence,
        )
