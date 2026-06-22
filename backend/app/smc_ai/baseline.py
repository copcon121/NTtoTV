"""Deterministic Phase 0 SMC baseline runner.

This module is intentionally read-only. It replays cached M1 OHLCV and volume
delta rows from ``app.sqlite`` and evaluates a conservative OB/FVG entry model
without mutating the live chart database.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path
from statistics import mean
from typing import Any

Direction = int


@dataclass(frozen=True, slots=True)
class BaselineBar:
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: int
    delta: int = 0
    close_delta: int = 0


@dataclass(frozen=True, slots=True)
class EqualLevel:
    kind: str
    level: float
    first_index: int
    second_index: int


@dataclass(frozen=True, slots=True)
class BreakEvent:
    kind: str
    scope: str
    side: Direction
    level: float
    index: int
    time: int


@dataclass(frozen=True, slots=True)
class HuntEvent:
    kind: str
    side: Direction
    level: float
    index: int
    time: int


@dataclass(frozen=True, slots=True)
class Zone:
    id: int
    kind: str
    side: Direction
    top: float
    bottom: float
    origin_index: int
    origin_time: int
    created_index: int
    created_time: int
    leg_id: int
    first_fvg_of_leg: bool = False


@dataclass(frozen=True, slots=True)
class TradeResult:
    side: str
    zone_type: str
    hunt_type: str
    confirmation: str
    entry_time: int
    entry_index: int
    entry_price: float
    stop_price: float
    target_price: float
    exit_time: int | None
    exit_index: int | None
    exit_price: float | None
    outcome: str
    gross_r: float | None
    net_r: float | None
    holding_bars: int | None
    max_adverse_r: float | None
    max_favorable_r: float | None
    zone_top: float
    zone_bottom: float


@dataclass(frozen=True, slots=True)
class BaselineConfig:
    symbol: str = "GC"
    contract: str = "GC"
    timeframe: str = "1m"
    tick_size: float = 0.1
    fee_ticks_round_trip: float = 2.0
    rr: float = 2.0
    swing_length: int = 50
    internal_swing_length: int = 5
    max_zone_age: int = 220
    hunt_lookback_bars: int = 100
    confirmation_lookahead_bars: int = 5
    sweep_lookback_bars: int = 30
    equal_level_lookback_bars: int = 60
    equal_level_pivot_length: int = 2
    equal_level_tolerance_ticks: float = 2.0
    fvg_auto_threshold: bool = True
    fvg_threshold_lookback: int = 60
    fvg_threshold_multiplier: float = 1.5
    fvg_near_ob_ticks: float = 20.0
    min_risk_ticks: float = 2.0


@dataclass(slots=True)
class _SwingPoint:
    price: float
    index: int
    time: int
    crossed: bool = False


@dataclass(slots=True)
class _PendingTouch:
    zone: Zone
    touch_index: int
    hunt: HuntEvent


class _StructureDetector:
    def __init__(self, swing_length: int, scope: str) -> None:
        self._length = max(1, int(swing_length))
        self._scope = scope
        self._highs: list[float] = []
        self._lows: list[float] = []
        self._closes: list[float] = []
        self._times: list[int] = []
        self._indices: list[int] = []
        self._last_leg = 0
        self._trend = 0
        self._swing_high: _SwingPoint | None = None
        self._swing_low: _SwingPoint | None = None
        self._max_buffer = max(2_000, self._length * 4 + 32)

    def update(self, bar: BaselineBar, index: int) -> BreakEvent | None:
        self._highs.append(float(bar.high))
        self._lows.append(float(bar.low))
        self._closes.append(float(bar.close))
        self._times.append(int(bar.time))
        self._indices.append(int(index))
        if len(self._highs) > self._max_buffer:
            self._highs.pop(0)
            self._lows.pop(0)
            self._closes.pop(0)
            self._times.pop(0)
            self._indices.pop(0)
        if len(self._highs) <= self._length + 1:
            return None
        return self._process(bar, index)

    def _process(self, bar: BaselineBar, index: int) -> BreakEvent | None:
        length = self._length
        candidate_pos = len(self._highs) - length - 1
        candidate_high = self._highs[candidate_pos]
        candidate_low = self._lows[candidate_pos]
        recent_highs = self._highs[-length:]
        recent_lows = self._lows[-length:]

        leg = self._last_leg
        if candidate_high > max(recent_highs):
            leg = -1
        elif candidate_low < min(recent_lows):
            leg = 1

        if leg != 0:
            changed = leg != self._last_leg
            self._last_leg = leg
            if changed:
                point = _SwingPoint(
                    price=candidate_low if leg == 1 else candidate_high,
                    index=self._indices[candidate_pos],
                    time=self._times[candidate_pos],
                )
                if leg == 1:
                    self._swing_low = point
                else:
                    self._swing_high = point

        return self._check_break(bar, index)

    def _check_break(self, bar: BaselineBar, index: int) -> BreakEvent | None:
        if len(self._closes) < 2:
            return None
        current_close = self._closes[-1]
        prev_close = self._closes[-2]

        active_high = self._swing_high
        if active_high is not None and not active_high.crossed:
            if current_close > active_high.price and prev_close <= active_high.price:
                active_high.crossed = True
                kind = "CHoCH" if self._trend == -1 else "BOS"
                self._trend = 1
                return BreakEvent(kind, self._scope, 1, active_high.price, index, bar.time)

        active_low = self._swing_low
        if active_low is not None and not active_low.crossed:
            if current_close < active_low.price and prev_close >= active_low.price:
                active_low.crossed = True
                kind = "CHoCH" if self._trend == 1 else "BOS"
                self._trend = -1
                return BreakEvent(kind, self._scope, -1, active_low.price, index, bar.time)

        return None


class _ZoneTracker:
    def __init__(self, config: BaselineConfig) -> None:
        self._config = config
        self._highs: list[float] = []
        self._lows: list[float] = []
        self._opens: list[float] = []
        self._closes: list[float] = []
        self._volumes: list[float] = []
        self._body_delta_percents: list[float] = []
        self._times: list[int] = []
        self._indices: list[int] = []
        self._last_leg = 0
        self._trend = 0
        self._swing_high: _SwingPoint | None = None
        self._swing_low: _SwingPoint | None = None
        self._leg_id = 0
        self._leg_side = 0
        self._next_zone_id = 1
        self.order_blocks: list[Zone] = []
        self.fvgs: list[Zone] = []

    @property
    def zones(self) -> list[Zone]:
        return [*self.order_blocks, *self.fvgs]

    def update(self, bar: BaselineBar, index: int) -> BreakEvent | None:
        self._highs.append(float(bar.high))
        self._lows.append(float(bar.low))
        self._opens.append(float(bar.open))
        self._closes.append(float(bar.close))
        self._volumes.append(float(bar.volume))
        self._body_delta_percents.append(_candle_body_delta_percent(bar.open, bar.close))
        self._times.append(int(bar.time))
        self._indices.append(int(index))
        if len(self._highs) <= self._config.swing_length + 1:
            return None

        event = self._process_structure(bar, index)
        self._detect_fvgs(index)
        self._maintain_zones(bar.high, bar.low, index)
        return event

    def _process_structure(self, bar: BaselineBar, index: int) -> BreakEvent | None:
        length = self._config.swing_length
        candidate_pos = len(self._highs) - length - 1
        candidate_high = self._highs[candidate_pos]
        candidate_low = self._lows[candidate_pos]
        recent_highs = self._highs[-length:]
        recent_lows = self._lows[-length:]

        leg = self._last_leg
        if candidate_high > max(recent_highs):
            leg = -1
        elif candidate_low < min(recent_lows):
            leg = 1

        if leg != 0:
            changed = leg != self._last_leg
            self._last_leg = leg
            if changed:
                point = _SwingPoint(
                    price=candidate_low if leg == 1 else candidate_high,
                    index=self._indices[candidate_pos],
                    time=self._times[candidate_pos],
                )
                if leg == 1:
                    self._swing_low = point
                else:
                    self._swing_high = point

        return self._check_bos_choch(bar, index)

    def _check_bos_choch(self, bar: BaselineBar, index: int) -> BreakEvent | None:
        if len(self._closes) < 2:
            return None
        current_close = self._closes[-1]
        prev_close = self._closes[-2]

        active_high = self._swing_high
        if active_high is not None and not active_high.crossed:
            if current_close > active_high.price and prev_close <= active_high.price:
                active_high.crossed = True
                kind = "CHoCH" if self._trend == -1 else "BOS"
                self._trend = 1
                event = self._new_break_event(kind, 1, active_high.price, bar, index)
                self._create_order_block(self._swing_low or active_high, 1, index, bar.time)
                return event

        active_low = self._swing_low
        if active_low is not None and not active_low.crossed:
            if current_close < active_low.price and prev_close >= active_low.price:
                active_low.crossed = True
                kind = "CHoCH" if self._trend == 1 else "BOS"
                self._trend = -1
                event = self._new_break_event(kind, -1, active_low.price, bar, index)
                self._create_order_block(self._swing_high or active_low, -1, index, bar.time)
                return event
        return None

    def _new_break_event(
        self,
        kind: str,
        side: Direction,
        level: float,
        bar: BaselineBar,
        index: int,
    ) -> BreakEvent:
        self._leg_id += 1
        self._leg_side = side
        return BreakEvent(kind, "external", side, level, index, bar.time)

    def _create_order_block(
        self,
        pivot: _SwingPoint,
        side: Direction,
        index: int,
        time: int,
    ) -> None:
        try:
            start_pos = self._indices.index(pivot.index)
        except ValueError:
            return
        range_highs = self._highs[start_pos:]
        range_lows = self._lows[start_pos:]
        range_indices = self._indices[start_pos:]
        range_times = self._times[start_pos:]
        if not range_highs:
            return

        pos = range_lows.index(min(range_lows)) if side == 1 else range_highs.index(max(range_highs))
        zone = Zone(
            id=self._next_id(),
            kind="ob",
            side=side,
            top=range_highs[pos],
            bottom=range_lows[pos],
            origin_index=range_indices[pos],
            origin_time=range_times[pos],
            created_index=index,
            created_time=time,
            leg_id=self._leg_id,
        )
        self.order_blocks.insert(0, zone)
        del self.order_blocks[20:]

    def _detect_fvgs(self, index: int) -> None:
        if len(self._highs) < 3:
            return
        curr_low = self._lows[-1]
        curr_high = self._highs[-1]
        prev_pos = len(self._closes) - 2
        prev_close = self._closes[prev_pos]
        prev_body_delta_percent = self._body_delta_percents[prev_pos]
        threshold = self._fvg_body_threshold(prev_pos)
        prev2_high = self._highs[-3]
        prev2_low = self._lows[-3]
        prev_time = self._times[-2]

        if curr_low > prev2_high and prev_close > prev2_high and prev_body_delta_percent > threshold:
            self._add_fvg(1, curr_low, prev2_high, index - 1, prev_time, index, self._times[-1])
        if curr_high < prev2_low and prev_close < prev2_low and -prev_body_delta_percent > threshold:
            self._add_fvg(-1, prev2_low, curr_high, index - 1, prev_time, index, self._times[-1])
        del self.fvgs[50:]

    def _add_fvg(
        self,
        side: Direction,
        top: float,
        bottom: float,
        origin_index: int,
        origin_time: int,
        created_index: int,
        created_time: int,
    ) -> None:
        leg_id = self._leg_id if self._leg_side == side else 0
        first = is_first_fvg_for_leg(self.fvgs, leg_id, side) if leg_id else False
        self.fvgs.insert(
            0,
            Zone(
                id=self._next_id(),
                kind="fvg",
                side=side,
                top=top,
                bottom=bottom,
                origin_index=origin_index,
                origin_time=origin_time,
                created_index=created_index,
                created_time=created_time,
                leg_id=leg_id,
                first_fvg_of_leg=first,
            ),
        )

    def _fvg_body_threshold(self, prev_pos: int) -> float:
        if not self._config.fvg_auto_threshold:
            return 0.0
        avg_body = _rolling_average_abs(
            self._body_delta_percents,
            prev_pos,
            self._config.fvg_threshold_lookback,
        )
        return avg_body * self._config.fvg_threshold_multiplier

    def _maintain_zones(self, high: float, low: float, index: int) -> None:
        kept_obs: list[Zone] = []
        for zone in self.order_blocks:
            if index - zone.created_index > self._config.max_zone_age:
                continue
            if zone.side == 1 and low < zone.bottom:
                continue
            if zone.side == -1 and high > zone.top:
                continue
            kept_obs.append(zone)
        self.order_blocks = kept_obs

        kept_fvgs: list[Zone] = []
        for zone in self.fvgs:
            if zone.side == 1 and low < zone.bottom:
                continue
            if zone.side == -1 and high > zone.top:
                continue
            kept_fvgs.append(zone)
        self.fvgs = kept_fvgs

    def _next_id(self) -> int:
        zone_id = self._next_zone_id
        self._next_zone_id += 1
        return zone_id


def load_bars_from_cache(
    db_path: str | Path,
    *,
    symbol: str = "GC",
    contract: str = "GC",
    timeframe: str = "1m",
    start_time: int | None = None,
    end_time: int | None = None,
    limit: int | None = None,
) -> list[BaselineBar]:
    """Load closed bars and matching volume-delta rows from cache read-only."""
    path = Path(db_path)
    if not path.exists():
        raise FileNotFoundError(path)
    uri = f"file:{path.resolve().as_posix()}?mode=ro"
    where = ["b.symbol = ?", "b.contract = ?", "b.timeframe = ?", "b.closed = 1"]
    params: list[Any] = [symbol, contract, timeframe]
    if start_time is not None:
        where.append("b.time >= ?")
        params.append(int(start_time))
    if end_time is not None:
        where.append("b.time <= ?")
        params.append(int(end_time))

    limit_sql = "" if limit is None else " LIMIT ?"
    if limit is not None:
        params.append(int(limit))
    sql = f"""
        SELECT
            b.time, b.open, b.high, b.low, b.close, b.volume,
            COALESCE(vd.delta, 0), COALESCE(vd.close_delta, 0)
        FROM bars b
        LEFT JOIN orderflow_volume_delta vd
          ON vd.symbol = b.symbol
         AND vd.contract = b.contract
         AND vd.timeframe = b.timeframe
         AND vd.time = b.time
        WHERE {' AND '.join(where)}
        ORDER BY b.time ASC
        {limit_sql}
    """
    conn = sqlite3.connect(uri, uri=True)
    try:
        rows = conn.execute(sql, params).fetchall()
    finally:
        conn.close()
    return [
        BaselineBar(
            time=int(row[0]),
            open=float(row[1]),
            high=float(row[2]),
            low=float(row[3]),
            close=float(row[4]),
            volume=int(row[5]),
            delta=int(row[6]),
            close_delta=int(row[7]),
        )
        for row in rows
    ]


def load_bars_for_signal_range(
    db_path: str | Path,
    *,
    symbol: str = "GC",
    contract: str = "GC",
    timeframe: str = "1m",
    start_time: int | None = None,
    end_time: int | None = None,
    warmup_bars: int = 5_000,
    latest_bars: int | None = None,
) -> list[BaselineBar]:
    """Load a requested range plus prior bars for detector warm-up."""
    path = Path(db_path)
    if not path.exists():
        raise FileNotFoundError(path)
    uri = f"file:{path.resolve().as_posix()}?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    try:
        if start_time is None and latest_bars is not None:
            where = ["b.symbol = ?", "b.contract = ?", "b.timeframe = ?", "b.closed = 1"]
            params: list[Any] = [symbol, contract, timeframe]
            if end_time is not None:
                where.append("b.time <= ?")
                params.append(int(end_time))
            params.append(max(1, int(latest_bars)))
            rows = conn.execute(
                f"""
                SELECT
                    b.time, b.open, b.high, b.low, b.close, b.volume,
                    COALESCE(vd.delta, 0), COALESCE(vd.close_delta, 0)
                FROM bars b
                LEFT JOIN orderflow_volume_delta vd
                  ON vd.symbol = b.symbol
                 AND vd.contract = b.contract
                 AND vd.timeframe = b.timeframe
                 AND vd.time = b.time
                WHERE {' AND '.join(where)}
                ORDER BY b.time DESC
                LIMIT ?
                """,
                params,
            ).fetchall()
            rows = list(reversed(rows))
            return [
                BaselineBar(
                    time=int(row[0]),
                    open=float(row[1]),
                    high=float(row[2]),
                    low=float(row[3]),
                    close=float(row[4]),
                    volume=int(row[5]),
                    delta=int(row[6]),
                    close_delta=int(row[7]),
                )
                for row in rows
            ]

        warmup: list[tuple[Any, ...]] = []
        if start_time is not None and warmup_bars > 0:
            warmup = conn.execute(
                """
                SELECT
                    b.time, b.open, b.high, b.low, b.close, b.volume,
                    COALESCE(vd.delta, 0), COALESCE(vd.close_delta, 0)
                FROM bars b
                LEFT JOIN orderflow_volume_delta vd
                  ON vd.symbol = b.symbol
                 AND vd.contract = b.contract
                 AND vd.timeframe = b.timeframe
                 AND vd.time = b.time
                WHERE b.symbol = ?
                  AND b.contract = ?
                  AND b.timeframe = ?
                  AND b.closed = 1
                  AND b.time < ?
                ORDER BY b.time DESC
                LIMIT ?
                """,
                [symbol, contract, timeframe, int(start_time), int(warmup_bars)],
            ).fetchall()
            warmup = list(reversed(warmup))

        where = ["b.symbol = ?", "b.contract = ?", "b.timeframe = ?", "b.closed = 1"]
        params: list[Any] = [symbol, contract, timeframe]
        if start_time is not None:
            where.append("b.time >= ?")
            params.append(int(start_time))
        if end_time is not None:
            where.append("b.time <= ?")
            params.append(int(end_time))
        rows = conn.execute(
            f"""
            SELECT
                b.time, b.open, b.high, b.low, b.close, b.volume,
                COALESCE(vd.delta, 0), COALESCE(vd.close_delta, 0)
            FROM bars b
            LEFT JOIN orderflow_volume_delta vd
              ON vd.symbol = b.symbol
             AND vd.contract = b.contract
             AND vd.timeframe = b.timeframe
             AND vd.time = b.time
            WHERE {' AND '.join(where)}
            ORDER BY b.time ASC
            """,
            params,
        ).fetchall()
    finally:
        conn.close()
    return [
        BaselineBar(
            time=int(row[0]),
            open=float(row[1]),
            high=float(row[2]),
            low=float(row[3]),
            close=float(row[4]),
            volume=int(row[5]),
            delta=int(row[6]),
            close_delta=int(row[7]),
        )
        for row in [*warmup, *rows]
    ]


def is_outside_bar(bar: BaselineBar, previous: BaselineBar | None) -> bool:
    return previous is not None and bar.high > previous.high and bar.low < previous.low


def outside_bar_signal(
    bar: BaselineBar,
    previous: BaselineBar | None,
    side: Direction,
) -> bool:
    if not is_outside_bar(bar, previous):
        return False
    return (side == 1 and bar.close > bar.open) or (side == -1 and bar.close < bar.open)


def engulfing_signal(
    bar: BaselineBar,
    previous: BaselineBar | None,
    side: Direction,
) -> bool:
    if previous is None:
        return False
    if side == 1:
        return (
            previous.close < previous.open
            and bar.close > bar.open
            and bar.open <= previous.close
            and bar.close >= previous.open
        )
    return (
        previous.close > previous.open
        and bar.close < bar.open
        and bar.open >= previous.close
        and bar.close <= previous.open
    )


def doji_star_signal(
    first: BaselineBar,
    middle: BaselineBar,
    last: BaselineBar,
    side: Direction,
) -> bool:
    first_range = max(first.high - first.low, 0.0)
    middle_range = max(middle.high - middle.low, 0.0)
    if first_range <= 0 or middle_range <= 0:
        return False
    first_body = abs(first.close - first.open)
    middle_body = abs(middle.close - middle.open)
    if first_body < first_range * 0.45 or middle_body > middle_range * 0.2:
        return False
    first_mid = (first.open + first.close) / 2.0
    if side == 1:
        return first.close < first.open and last.close > last.open and last.close > first_mid
    return first.close > first.open and last.close < last.open and last.close < first_mid


def confirmation_pattern(bars: list[BaselineBar], index: int, side: Direction) -> str | None:
    bar = bars[index]
    previous = bars[index - 1] if index > 0 else None
    if outside_bar_signal(bar, previous, side):
        return "outside_bar"
    if engulfing_signal(bar, previous, side):
        return "engulfing"
    if index >= 2 and doji_star_signal(bars[index - 2], bars[index - 1], bar, side):
        return "morning_doji_star" if side == 1 else "evening_doji_star"
    return None


def detect_equal_high(
    bars: list[BaselineBar],
    end_index: int,
    *,
    lookback: int = 60,
    tolerance: float = 0.2,
    pivot_length: int = 2,
) -> EqualLevel | None:
    pivots = _pivot_indices(bars, end_index, lookback, pivot_length, high=True)
    return _equal_level_from_pivots(bars, pivots, tolerance, high=True)


def detect_equal_low(
    bars: list[BaselineBar],
    end_index: int,
    *,
    lookback: int = 60,
    tolerance: float = 0.2,
    pivot_length: int = 2,
) -> EqualLevel | None:
    pivots = _pivot_indices(bars, end_index, lookback, pivot_length, high=False)
    return _equal_level_from_pivots(bars, pivots, tolerance, high=False)


def detect_sweep_hunt(
    bars: list[BaselineBar],
    index: int,
    config: BaselineConfig = BaselineConfig(),
) -> HuntEvent | None:
    if index <= 0:
        return None
    bar = bars[index]
    tolerance = config.equal_level_tolerance_ticks * config.tick_size
    eql = detect_equal_low(
        bars,
        index - 1,
        lookback=config.equal_level_lookback_bars,
        tolerance=tolerance,
        pivot_length=config.equal_level_pivot_length,
    )
    if eql is not None and bar.low < eql.level - config.tick_size * 0.5 and bar.close > eql.level:
        return HuntEvent("eql_sweep", 1, eql.level, index, bar.time)
    eqh = detect_equal_high(
        bars,
        index - 1,
        lookback=config.equal_level_lookback_bars,
        tolerance=tolerance,
        pivot_length=config.equal_level_pivot_length,
    )
    if eqh is not None and bar.high > eqh.level + config.tick_size * 0.5 and bar.close < eqh.level:
        return HuntEvent("eqh_sweep", -1, eqh.level, index, bar.time)

    window = bars[max(0, index - config.sweep_lookback_bars) : index]
    if len(window) < 3:
        return None
    prior_low = min(item.low for item in window)
    if bar.low < prior_low - config.tick_size * 0.5 and bar.close > prior_low:
        return HuntEvent("sweep_low", 1, prior_low, index, bar.time)
    prior_high = max(item.high for item in window)
    if bar.high > prior_high + config.tick_size * 0.5 and bar.close < prior_high:
        return HuntEvent("sweep_high", -1, prior_high, index, bar.time)
    return None


def is_first_fvg_for_leg(zones: list[Zone], leg_id: int, side: Direction) -> bool:
    return not any(
        zone.kind == "fvg" and zone.leg_id == leg_id and zone.side == side
        for zone in zones
    )


def run_baseline(
    bars: list[BaselineBar],
    config: BaselineConfig = BaselineConfig(),
    *,
    include_trades: bool = False,
) -> dict[str, Any]:
    zone_tracker = _ZoneTracker(config)
    internal_detector = _StructureDetector(config.internal_swing_length, "internal")
    hunts: list[HuntEvent] = []
    pending: dict[int, _PendingTouch] = {}
    used_zones: set[int] = set()
    trades: list[TradeResult] = []
    rejects: Counter[str] = Counter()

    for index, bar in enumerate(bars):
        sweep = detect_sweep_hunt(bars, index, config)
        if sweep is not None:
            hunts.append(sweep)

        internal_event = internal_detector.update(bar, index)
        if internal_event is not None and internal_event.kind == "CHoCH":
            hunts.append(_hunt_from_choch(internal_event))

        external_event = zone_tracker.update(bar, index)
        if external_event is not None and external_event.kind == "CHoCH":
            hunts.append(_hunt_from_choch(external_event))

        for zone in zone_tracker.zones:
            if zone.id in used_zones or zone.id in pending or zone.created_index >= index:
                continue
            if not _zone_is_valid_entry(zone, zone_tracker.order_blocks, config):
                if zone.kind == "fvg" and _bar_touches_zone(bar, zone):
                    rejects["invalid_fvg_zone"] += 1
                continue
            if not _bar_touches_zone(bar, zone):
                continue
            hunt = _latest_hunt(hunts, zone.side, index, config.hunt_lookback_bars)
            if hunt is None:
                rejects["missing_hunt"] += 1
                continue
            pending[zone.id] = _PendingTouch(zone=zone, touch_index=index, hunt=hunt)

        expired: list[int] = []
        for zone_id, touch in pending.items():
            if index - touch.touch_index > config.confirmation_lookahead_bars:
                rejects["missing_confirmation"] += 1
                expired.append(zone_id)
                continue
            pattern = confirmation_pattern(bars, index, touch.zone.side)
            if pattern is None:
                continue
            result = _make_and_label_trade(bars, index, touch.zone, touch.hunt, pattern, config)
            if result is None:
                rejects["invalid_risk"] += 1
            else:
                trades.append(result)
                used_zones.add(zone_id)
                if result.outcome == "incomplete":
                    rejects["incomplete_label"] += 1
            expired.append(zone_id)
        for zone_id in expired:
            pending.pop(zone_id, None)

    rejects["open_pending"] += len(pending)
    result = {
        "config": asdict(config),
        "data": _data_summary(bars),
        "summary": _summarize_trades(trades, rejects),
        "sample_trades": [asdict(trade) for trade in trades[:10]],
    }
    if include_trades:
        result["trades"] = [asdict(trade) for trade in trades]
    return result


def _make_and_label_trade(
    bars: list[BaselineBar],
    entry_index: int,
    zone: Zone,
    hunt: HuntEvent,
    confirmation: str,
    config: BaselineConfig,
) -> TradeResult | None:
    entry = bars[entry_index]
    side = zone.side
    stop = zone.bottom - config.tick_size if side == 1 else zone.top + config.tick_size
    risk = (entry.close - stop) if side == 1 else (stop - entry.close)
    if risk < config.min_risk_ticks * config.tick_size:
        return None
    target = entry.close + side * config.rr * risk
    return label_trade(
        bars,
        entry_index=entry_index,
        side=side,
        entry_price=entry.close,
        stop_price=stop,
        target_price=target,
        zone=zone,
        hunt=hunt,
        confirmation=confirmation,
        config=config,
    )


def label_trade(
    bars: list[BaselineBar],
    *,
    entry_index: int,
    side: Direction,
    entry_price: float,
    stop_price: float,
    target_price: float,
    zone: Zone,
    hunt: HuntEvent,
    confirmation: str,
    config: BaselineConfig,
) -> TradeResult:
    risk = abs(entry_price - stop_price)
    cost_points = config.fee_ticks_round_trip * config.tick_size
    max_adv = 0.0
    max_fav = 0.0
    for index in range(entry_index + 1, len(bars)):
        bar = bars[index]
        if side == 1:
            adverse = max(0.0, entry_price - bar.low)
            favorable = max(0.0, bar.high - entry_price)
            if bar.low <= stop_price:
                return _trade_result(
                    side,
                    zone,
                    hunt,
                    confirmation,
                    bars[entry_index],
                    entry_index,
                    entry_price,
                    stop_price,
                    target_price,
                    bar,
                    index,
                    stop_price,
                    "loss",
                    -1.0,
                    (-risk - cost_points) / risk,
                    max(max_adv, adverse) / risk,
                    max(max_fav, favorable) / risk,
                )
            if bar.high >= target_price:
                return _trade_result(
                    side,
                    zone,
                    hunt,
                    confirmation,
                    bars[entry_index],
                    entry_index,
                    entry_price,
                    stop_price,
                    target_price,
                    bar,
                    index,
                    target_price,
                    "win",
                    config.rr,
                    (config.rr * risk - cost_points) / risk,
                    max(max_adv, adverse) / risk,
                    max(max_fav, favorable) / risk,
                )
        else:
            adverse = max(0.0, bar.high - entry_price)
            favorable = max(0.0, entry_price - bar.low)
            if bar.high >= stop_price:
                return _trade_result(
                    side,
                    zone,
                    hunt,
                    confirmation,
                    bars[entry_index],
                    entry_index,
                    entry_price,
                    stop_price,
                    target_price,
                    bar,
                    index,
                    stop_price,
                    "loss",
                    -1.0,
                    (-risk - cost_points) / risk,
                    max(max_adv, adverse) / risk,
                    max(max_fav, favorable) / risk,
                )
            if bar.low <= target_price:
                return _trade_result(
                    side,
                    zone,
                    hunt,
                    confirmation,
                    bars[entry_index],
                    entry_index,
                    entry_price,
                    stop_price,
                    target_price,
                    bar,
                    index,
                    target_price,
                    "win",
                    config.rr,
                    (config.rr * risk - cost_points) / risk,
                    max(max_adv, adverse) / risk,
                    max(max_fav, favorable) / risk,
                )
        max_adv = max(max_adv, adverse)
        max_fav = max(max_fav, favorable)

    return _trade_result(
        side,
        zone,
        hunt,
        confirmation,
        bars[entry_index],
        entry_index,
        entry_price,
        stop_price,
        target_price,
        None,
        None,
        None,
        "incomplete",
        None,
        None,
        max_adv / risk if risk else None,
        max_fav / risk if risk else None,
    )


def _trade_result(
    side: Direction,
    zone: Zone,
    hunt: HuntEvent,
    confirmation: str,
    entry_bar: BaselineBar,
    entry_index: int,
    entry_price: float,
    stop_price: float,
    target_price: float,
    exit_bar: BaselineBar | None,
    exit_index: int | None,
    exit_price: float | None,
    outcome: str,
    gross_r: float | None,
    net_r: float | None,
    max_adverse_r: float | None,
    max_favorable_r: float | None,
) -> TradeResult:
    return TradeResult(
        side="long" if side == 1 else "short",
        zone_type=zone.kind,
        hunt_type=hunt.kind,
        confirmation=confirmation,
        entry_time=entry_bar.time,
        entry_index=entry_index,
        entry_price=entry_price,
        stop_price=stop_price,
        target_price=target_price,
        exit_time=None if exit_bar is None else exit_bar.time,
        exit_index=exit_index,
        exit_price=exit_price,
        outcome=outcome,
        gross_r=gross_r,
        net_r=net_r,
        holding_bars=None if exit_index is None else exit_index - entry_index,
        max_adverse_r=max_adverse_r,
        max_favorable_r=max_favorable_r,
        zone_top=zone.top,
        zone_bottom=zone.bottom,
    )


def _zone_is_valid_entry(zone: Zone, order_blocks: list[Zone], config: BaselineConfig) -> bool:
    if zone.kind == "ob":
        return True
    if zone.kind != "fvg" or not zone.first_fvg_of_leg:
        return False
    same_leg_obs = [
        ob for ob in order_blocks
        if ob.side == zone.side and ob.leg_id == zone.leg_id
    ]
    if not same_leg_obs:
        return False
    max_distance = config.fvg_near_ob_ticks * config.tick_size
    return min(_zone_distance(zone, ob) for ob in same_leg_obs) <= max_distance


def _bar_touches_zone(bar: BaselineBar, zone: Zone) -> bool:
    return bar.low <= zone.top and bar.high >= zone.bottom


def _latest_hunt(
    hunts: list[HuntEvent],
    side: Direction,
    index: int,
    lookback: int,
) -> HuntEvent | None:
    for hunt in reversed(hunts):
        if hunt.index > index:
            continue
        if index - hunt.index > lookback:
            return None
        if hunt.side == side:
            return hunt
    return None


def _hunt_from_choch(event: BreakEvent) -> HuntEvent:
    return HuntEvent(
        kind=f"{event.scope}_choch_{'up' if event.side == 1 else 'down'}",
        side=-event.side,
        level=event.level,
        index=event.index,
        time=event.time,
    )


def _data_summary(bars: list[BaselineBar]) -> dict[str, Any]:
    return {
        "bars": len(bars),
        "start_time": bars[0].time if bars else None,
        "end_time": bars[-1].time if bars else None,
    }


def _summarize_trades(trades: list[TradeResult], rejects: Counter[str]) -> dict[str, Any]:
    labelled = [trade for trade in trades if trade.outcome in {"win", "loss"}]
    wins = sum(1 for trade in labelled if trade.outcome == "win")
    losses = sum(1 for trade in labelled if trade.outcome == "loss")
    net_rs = [trade.net_r for trade in labelled if trade.net_r is not None]
    return {
        "total_setups": len(trades),
        "labelled_setups": len(labelled),
        "wins": wins,
        "losses": losses,
        "incomplete": sum(1 for trade in trades if trade.outcome == "incomplete"),
        "win_rate": wins / len(labelled) if labelled else None,
        "expectancy_net_r": mean(net_rs) if net_rs else None,
        "rejects": dict(sorted(rejects.items())),
        "by_side": _breakdown(labelled, "side"),
        "by_zone_type": _breakdown(labelled, "zone_type"),
        "by_hunt_type": _breakdown(labelled, "hunt_type"),
        "by_confirmation": _breakdown(labelled, "confirmation"),
        "net_r_distribution": _distribution(net_rs),
        "holding_bars_distribution": _distribution(
            [float(trade.holding_bars) for trade in labelled if trade.holding_bars is not None]
        ),
        "max_adverse_r_distribution": _distribution(
            [trade.max_adverse_r for trade in labelled if trade.max_adverse_r is not None]
        ),
    }


def _breakdown(trades: list[TradeResult], attr: str) -> dict[str, Any]:
    grouped: dict[str, list[TradeResult]] = defaultdict(list)
    for trade in trades:
        grouped[str(getattr(trade, attr))].append(trade)
    output: dict[str, Any] = {}
    for key, items in sorted(grouped.items()):
        wins = sum(1 for item in items if item.outcome == "win")
        net_rs = [item.net_r for item in items if item.net_r is not None]
        output[key] = {
            "count": len(items),
            "wins": wins,
            "losses": len(items) - wins,
            "win_rate": wins / len(items) if items else None,
            "expectancy_net_r": mean(net_rs) if net_rs else None,
        }
    return output


def _distribution(values: list[float]) -> dict[str, float] | None:
    clean = sorted(float(value) for value in values if value is not None)
    if not clean:
        return None
    return {
        "min": clean[0],
        "p25": _percentile(clean, 0.25),
        "p50": _percentile(clean, 0.50),
        "p75": _percentile(clean, 0.75),
        "max": clean[-1],
        "mean": mean(clean),
    }


def _percentile(sorted_values: list[float], p: float) -> float:
    if len(sorted_values) == 1:
        return sorted_values[0]
    pos = (len(sorted_values) - 1) * p
    lower = int(pos)
    upper = min(lower + 1, len(sorted_values) - 1)
    weight = pos - lower
    return sorted_values[lower] * (1 - weight) + sorted_values[upper] * weight


def _pivot_indices(
    bars: list[BaselineBar],
    end_index: int,
    lookback: int,
    pivot_length: int,
    *,
    high: bool,
) -> list[int]:
    if end_index < 0:
        return []
    start = max(0, end_index - lookback + 1)
    pivots: list[int] = []
    for index in range(start + pivot_length, end_index - pivot_length + 1):
        bar = bars[index]
        left = bars[index - pivot_length : index]
        right = bars[index + 1 : index + 1 + pivot_length]
        if high:
            if bar.high > max(item.high for item in left) and bar.high >= max(item.high for item in right):
                pivots.append(index)
        elif bar.low < min(item.low for item in left) and bar.low <= min(item.low for item in right):
            pivots.append(index)
    return pivots


def _equal_level_from_pivots(
    bars: list[BaselineBar],
    pivots: list[int],
    tolerance: float,
    *,
    high: bool,
) -> EqualLevel | None:
    for pos in range(len(pivots) - 1, 0, -1):
        second = pivots[pos]
        second_price = bars[second].high if high else bars[second].low
        for first in reversed(pivots[:pos]):
            first_price = bars[first].high if high else bars[first].low
            if abs(first_price - second_price) <= tolerance:
                return EqualLevel(
                    kind="eqh" if high else "eql",
                    level=(first_price + second_price) / 2.0,
                    first_index=first,
                    second_index=second,
                )
    return None


def _zone_distance(a: Zone, b: Zone) -> float:
    if a.bottom <= b.top and b.bottom <= a.top:
        return 0.0
    if a.bottom > b.top:
        return a.bottom - b.top
    return b.bottom - a.top


def _candle_body_delta_percent(open_: float, close: float) -> float:
    if open_ == 0:
        return 0.0
    return (close - open_) / abs(open_)


def _rolling_average_abs(values: list[float], end_exclusive: int, lookback: int) -> float:
    start = max(0, end_exclusive - max(1, lookback))
    sample = [abs(float(value)) for value in values[start:end_exclusive]]
    return sum(sample) / len(sample) if sample else 0.0


def _print_human(result: dict[str, Any]) -> None:
    summary = result["summary"]
    data = result["data"]
    print("SMC AI baseline Phase 0")
    print(f"bars: {data['bars']} start={data['start_time']} end={data['end_time']}")
    print(
        "setups: {total_setups} labelled={labelled_setups} "
        "wins={wins} losses={losses} incomplete={incomplete}".format(**summary)
    )
    print(f"win_rate: {_fmt_optional(summary['win_rate'])}")
    print(f"expectancy_net_r: {_fmt_optional(summary['expectancy_net_r'])}")
    print(f"rejects: {summary['rejects']}")
    for key in ("by_side", "by_zone_type", "by_hunt_type", "by_confirmation"):
        print(f"{key}:")
        for name, item in summary[key].items():
            print(
                f"  {name}: count={item['count']} win_rate={_fmt_optional(item['win_rate'])} "
                f"expectancy={_fmt_optional(item['expectancy_net_r'])}"
            )
    print(f"net_r_distribution: {summary['net_r_distribution']}")
    print(f"holding_bars_distribution: {summary['holding_bars_distribution']}")
    print(f"max_adverse_r_distribution: {summary['max_adverse_r_distribution']}")


def _fmt_optional(value: float | None) -> str:
    return "n/a" if value is None else f"{value:.4f}"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default="data/app.sqlite", help="Path to app.sqlite")
    parser.add_argument("--symbol", default="GC")
    parser.add_argument("--contract", default="GC")
    parser.add_argument("--timeframe", default="1m")
    parser.add_argument("--json", action="store_true", help="Print JSON summary")
    parser.add_argument("--limit", type=int, default=None, help="Optional bar cap")
    parser.add_argument("--rr", type=float, default=2.0)
    parser.add_argument("--swing-length", type=int, default=50)
    parser.add_argument("--fvg-auto-threshold", action=argparse.BooleanOptionalAction, default=True)
    args = parser.parse_args(argv)

    config = BaselineConfig(
        symbol=args.symbol,
        contract=args.contract,
        timeframe=args.timeframe,
        rr=args.rr,
        swing_length=args.swing_length,
        fvg_auto_threshold=args.fvg_auto_threshold,
    )
    bars = load_bars_from_cache(
        args.db,
        symbol=config.symbol,
        contract=config.contract,
        timeframe=config.timeframe,
        limit=args.limit,
    )
    result = run_baseline(bars, config)
    if args.json:
        print(json.dumps(result, indent=2, sort_keys=True))
    else:
        _print_human(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
