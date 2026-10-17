"""Walk-forward grid research for standalone mGann Break L/S signals.

This module intentionally evaluates the chart signal rather than the automatic
execution strategy.  A trade enters at the signal-bar close, places its stop at
the signal-bar low (Long) or high (Short), and tests fixed 1R and 2R targets.
Only bars after the signal bar can fill the bracket.  When a later M1 bar
touches both stop and target, the stop wins, which is the conservative outcome
when lower-timeframe ordering is unavailable.

The SQLite database is opened read-only by ``load_latest_window``.  The search
uses an earlier training window for ranking and reports a later holdout window
separately so that the best-looking in-sample threshold is not silently
presented as an out-of-sample result.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
from collections import Counter
from dataclasses import dataclass, replace
from pathlib import Path
from statistics import mean
from typing import Any, Callable, Iterable, Sequence

from ..engines.mgann_big_trade_sweep import (
    MgannBigTradeSweepBar,
    MgannBigTradeSweepState,
)
from ..engines.supertrend import (
    SupertrendBar,
    SupertrendConfig,
    SupertrendPoint,
    SupertrendState,
)
from .mgann_backtest import MgannBacktestBar, MgannBacktestConfig, load_latest_window

_DAY_MS = 24 * 60 * 60 * 1_000
_GC_TICK_SIZE = 0.1
_DEFAULT_TARGETS = (1.0, 2.0)


@dataclass(frozen=True, slots=True)
class MgannSignalSettings:
    """Detector settings mirrored from the mGann Break L/S chart panel."""

    volume_delta_lookback: int = 20
    volume_delta_multiplier: float = 3.0
    min_spread_ticks: int = 0
    spread_lookback: int = 20
    spread_multiplier: float = 3.0
    swing_size: int = 5
    pivot_lookback_bars: int = 120
    min_pivot_cuts: int = 2
    pivot_tolerance_ticks: int = 5
    min_pivot_wick_ticks: int = 2
    filter_liquidity: bool = False
    liquidity_atr_margin: float = 4.0
    liquidity_sweep_lookback_bars: int = 5
    confirmation_bars: int = 2
    break_ticks: int = 0

    def detector_kwargs(self) -> dict[str, Any]:
        return {
            "timeframe": "1m",
            "require_big_trade": False,
            "volume_delta_lookback": self.volume_delta_lookback,
            "volume_delta_multiplier": self.volume_delta_multiplier,
            "min_spread_ticks": self.min_spread_ticks,
            "spread_lookback": self.spread_lookback,
            "spread_multiplier": self.spread_multiplier,
            "swing_size": self.swing_size,
            "pivot_lookback_bars": self.pivot_lookback_bars,
            "min_pivot_cuts": self.min_pivot_cuts,
            "pivot_tolerance_ticks": self.pivot_tolerance_ticks,
            "min_pivot_wick_ticks": self.min_pivot_wick_ticks,
            "filter_liquidity": self.filter_liquidity,
            "liquidity_atr_margin": self.liquidity_atr_margin,
            "liquidity_sweep_lookback_bars": self.liquidity_sweep_lookback_bars,
            "confirmation_bars": self.confirmation_bars,
            "break_ticks": self.break_ticks,
            "tick_size": _GC_TICK_SIZE,
        }


@dataclass(slots=True)
class _SignalTrade:
    signal_time: int
    side: int
    entry: float
    stop: float
    target: float
    risk: float
    target_r: float
    exit_time: int | None = None
    exit_reason: str | None = None
    gross_r: float | None = None


@dataclass(slots=True)
class _PartialTrade:
    signal_time: int
    side: int
    entry: float
    stop: float
    one_r: float
    target: float
    risk: float
    partial_taken: bool = False
    exit_time: int | None = None
    exit_reason: str | None = None
    gross_r: float | None = None


@dataclass(slots=True)
class _SupertrendPartialTrade:
    signal_time: int
    side: int
    entry: float
    stop: float
    one_r: float
    risk: float
    partial_taken: bool = False
    exit_time: int | None = None
    exit_reason: str | None = None
    gross_r: float | None = None


def run_mgann_signal_backtest(
    bars: Sequence[MgannBacktestBar],
    *,
    evaluation_start: int,
    settings: MgannSignalSettings = MgannSignalSettings(),
    targets: Sequence[float] = _DEFAULT_TARGETS,
) -> dict[str, Any]:
    """Replay chart signals with close entry and signal-wick stop."""

    normalized_targets = tuple(sorted({float(target) for target in targets}))
    if not normalized_targets or any(target <= 0 for target in normalized_targets):
        raise ValueError("targets must contain at least one positive R multiple")

    detector = MgannBigTradeSweepState(**settings.detector_kwargs())
    active = {target: [] for target in normalized_targets}
    closed = {target: [] for target in normalized_targets}
    signal_count = 0
    invalid_risk = 0
    last_time: int | None = None

    for bar in sorted(bars, key=lambda item: item.time):
        last_time = bar.time
        for target_r in normalized_targets:
            _process_bar_outcomes(bar, active[target_r], closed[target_r])

        triggers = detector.on_closed_bar(
            MgannBigTradeSweepBar(
                time=bar.time,
                open=bar.open,
                high=bar.high,
                low=bar.low,
                close=bar.close,
                volume=bar.volume,
                volume_delta=bar.delta,
            )
        )
        if bar.time < evaluation_start:
            continue
        for trigger in triggers:
            direction = int(trigger.direction)
            stop = float(bar.low if direction > 0 else bar.high)
            entry = float(bar.close)
            risk = entry - stop if direction > 0 else stop - entry
            signal_count += 1
            if direction not in (-1, 1) or risk <= 0:
                invalid_risk += 1
                continue
            for target_r in normalized_targets:
                active[target_r].append(
                    _SignalTrade(
                        signal_time=bar.time,
                        side=direction,
                        entry=entry,
                        stop=stop,
                        target=entry + direction * target_r * risk,
                        risk=risk,
                        target_r=target_r,
                    )
                )

    return {
        "settings": settings_to_ui(settings),
        "data": {
            "bars": len(bars),
            "evaluationStart": evaluation_start,
            "endTime": last_time,
        },
        "signals": signal_count,
        "invalidRiskSignals": invalid_risk,
        "targets": {
            _target_key(target): _summarize_target(
                closed=closed[target],
                open_trades=active[target],
            )
            for target in normalized_targets
        },
    }


def run_mgann_partial_backtest(
    bars: Sequence[MgannBacktestBar],
    *,
    evaluation_start: int,
    settings: MgannSignalSettings = MgannSignalSettings(),
    move_stop_to_break_even: bool = False,
) -> dict[str, Any]:
    """Close half at +1R and hold the other half for +3R."""

    detector = MgannBigTradeSweepState(**settings.detector_kwargs())
    active: list[_PartialTrade] = []
    closed: list[_PartialTrade] = []
    signal_count = 0
    invalid_risk = 0
    last_time: int | None = None

    for bar in sorted(bars, key=lambda item: item.time):
        last_time = bar.time
        _process_partial_bar(
            bar,
            active,
            closed,
            move_stop_to_break_even=move_stop_to_break_even,
        )
        triggers = detector.on_closed_bar(
            MgannBigTradeSweepBar(
                time=bar.time,
                open=bar.open,
                high=bar.high,
                low=bar.low,
                close=bar.close,
                volume=bar.volume,
                volume_delta=bar.delta,
            )
        )
        if bar.time < evaluation_start:
            continue
        for trigger in triggers:
            direction = int(trigger.direction)
            stop = float(bar.low if direction > 0 else bar.high)
            entry = float(bar.close)
            risk = entry - stop if direction > 0 else stop - entry
            signal_count += 1
            if direction not in (-1, 1) or risk <= 0:
                invalid_risk += 1
                continue
            active.append(
                _PartialTrade(
                    signal_time=bar.time,
                    side=direction,
                    entry=entry,
                    stop=stop,
                    one_r=entry + direction * risk,
                    target=entry + direction * 3.0 * risk,
                    risk=risk,
                )
            )

    return {
        "settings": settings_to_ui(settings),
        "data": {
            "bars": len(bars),
            "evaluationStart": evaluation_start,
            "endTime": last_time,
        },
        "signals": signal_count,
        "invalidRiskSignals": invalid_risk,
        "plan": {
            "partialAtR": 1.0,
            "partialFraction": 0.5,
            "finalTargetR": 3.0,
            "moveStopToBreakEven": move_stop_to_break_even,
        },
        "summary": _summarize_target(closed=closed, open_trades=active),
    }


def run_mgann_supertrend_partial_backtest(
    bars: Sequence[MgannBacktestBar],
    *,
    evaluation_start: int,
    settings: MgannSignalSettings = MgannSignalSettings(),
    supertrend_config: SupertrendConfig = SupertrendConfig(),
) -> dict[str, Any]:
    """Close half at +1R and trail the remainder on confirmed SuperTrend."""

    detector = MgannBigTradeSweepState(**settings.detector_kwargs())
    supertrend = SupertrendState(supertrend_config)
    active: list[_SupertrendPartialTrade] = []
    closed: list[_SupertrendPartialTrade] = []
    signal_count = 0
    invalid_risk = 0
    last_time: int | None = None

    for bar in sorted(bars, key=lambda item: item.time):
        last_time = bar.time
        point = supertrend.on_closed_bar(
            SupertrendBar(
                time=bar.time,
                open=bar.open,
                high=bar.high,
                low=bar.low,
                close=bar.close,
            )
        )
        _process_supertrend_partial_bar(bar, point, active, closed)
        triggers = detector.on_closed_bar(
            MgannBigTradeSweepBar(
                time=bar.time,
                open=bar.open,
                high=bar.high,
                low=bar.low,
                close=bar.close,
                volume=bar.volume,
                volume_delta=bar.delta,
            )
        )
        if bar.time < evaluation_start:
            continue
        for trigger in triggers:
            direction = int(trigger.direction)
            stop = float(bar.low if direction > 0 else bar.high)
            entry = float(bar.close)
            risk = entry - stop if direction > 0 else stop - entry
            signal_count += 1
            if direction not in (-1, 1) or risk <= 0:
                invalid_risk += 1
                continue
            active.append(
                _SupertrendPartialTrade(
                    signal_time=bar.time,
                    side=direction,
                    entry=entry,
                    stop=stop,
                    one_r=entry + direction * risk,
                    risk=risk,
                )
            )

    summary = _summarize_target(closed=closed, open_trades=active)
    trailing_results = [
        float(trade.gross_r)
        for trade in closed
        if trade.exit_reason == "supertrend_close" and trade.gross_r is not None
    ]
    summary["supertrendExits"] = len(trailing_results)
    summary["averageSupertrendExitR"] = (
        None if not trailing_results else mean(trailing_results)
    )
    return {
        "settings": settings_to_ui(settings),
        "data": {
            "bars": len(bars),
            "evaluationStart": evaluation_start,
            "endTime": last_time,
        },
        "signals": signal_count,
        "invalidRiskSignals": invalid_risk,
        "plan": {
            "partialAtR": 1.0,
            "partialFraction": 0.5,
            "remainingExit": "confirmed SuperTrend close cross",
            "initialStopRemainsActive": True,
            "supertrend": {
                "timeframe": "1m",
                "period": supertrend_config.period,
                "multiplier": supertrend_config.multiplier,
                "atrMethod": supertrend_config.atr_method,
                "source": supertrend_config.source,
            },
        },
        "summary": summary,
    }


def _process_bar_outcomes(
    bar: MgannBacktestBar,
    active: list[_SignalTrade],
    closed: list[_SignalTrade],
) -> None:
    for trade in list(active):
        if trade.side > 0:
            stopped = float(bar.low) <= trade.stop
            targeted = float(bar.high) >= trade.target
        else:
            stopped = float(bar.high) >= trade.stop
            targeted = float(bar.low) <= trade.target
        if not stopped and not targeted:
            continue
        active.remove(trade)
        trade.exit_time = bar.time
        if stopped:
            trade.exit_reason = "stop"
            trade.gross_r = -1.0
        else:
            trade.exit_reason = "target"
            trade.gross_r = trade.target_r
        closed.append(trade)


def _process_partial_bar(
    bar: MgannBacktestBar,
    active: list[_PartialTrade],
    closed: list[_PartialTrade],
    *,
    move_stop_to_break_even: bool,
) -> None:
    for trade in list(active):
        if trade.side > 0:
            stopped = float(bar.low) <= trade.stop
            reached_one_r = float(bar.high) >= trade.one_r
            targeted = float(bar.high) >= trade.target
        else:
            stopped = float(bar.high) >= trade.stop
            reached_one_r = float(bar.low) <= trade.one_r
            targeted = float(bar.low) <= trade.target

        # The lower-timeframe path is unavailable.  Resolve the adverse level
        # first, including after the remaining half has moved to break-even.
        if stopped:
            active.remove(trade)
            trade.exit_time = bar.time
            if not trade.partial_taken:
                trade.exit_reason = "stop_before_partial"
                trade.gross_r = -1.0
            elif move_stop_to_break_even:
                trade.exit_reason = "break_even_after_partial"
                trade.gross_r = 0.5
            else:
                trade.exit_reason = "initial_stop_after_partial"
                trade.gross_r = 0.0
            closed.append(trade)
            continue

        if targeted:
            active.remove(trade)
            trade.partial_taken = True
            trade.exit_time = bar.time
            trade.exit_reason = "target_3r_after_partial"
            # Half at +1R and half at +3R = +2R on the original position.
            trade.gross_r = 2.0
            closed.append(trade)
            continue

        if reached_one_r and not trade.partial_taken:
            trade.partial_taken = True
            if move_stop_to_break_even:
                trade.stop = trade.entry


def _process_supertrend_partial_bar(
    bar: MgannBacktestBar,
    point: SupertrendPoint | None,
    active: list[_SupertrendPartialTrade],
    closed: list[_SupertrendPartialTrade],
) -> None:
    for trade in list(active):
        if trade.side > 0:
            stopped = float(bar.low) <= trade.stop
            reached_one_r = float(bar.high) >= trade.one_r
        else:
            stopped = float(bar.high) >= trade.stop
            reached_one_r = float(bar.low) <= trade.one_r

        # The broker-side initial SL remains live after the partial and wins any
        # ambiguous M1 ordering against the virtual confirmed-close exit.
        if stopped:
            active.remove(trade)
            trade.exit_time = bar.time
            if trade.partial_taken:
                trade.exit_reason = "initial_stop_after_partial"
                trade.gross_r = 0.0
            else:
                trade.exit_reason = "stop_before_partial"
                trade.gross_r = -1.0
            closed.append(trade)
            continue

        if reached_one_r:
            trade.partial_taken = True
        if (
            not trade.partial_taken
            or point is None
            or point.value is None
            or not _supertrend_closed_across(trade.side, bar.close, point.value)
        ):
            continue

        active.remove(trade)
        trade.exit_time = bar.time
        trade.exit_reason = "supertrend_close"
        remaining_r = trade.side * (float(bar.close) - trade.entry) / trade.risk
        # Half is already realized at +1R; the close only applies to the other half.
        trade.gross_r = 0.5 + 0.5 * remaining_r
        closed.append(trade)


def _supertrend_closed_across(side: int, close: float, line: float) -> bool:
    return float(close) < float(line) if side > 0 else float(close) > float(line)


def _summarize_target(
    *,
    closed: Sequence[_SignalTrade | _PartialTrade | _SupertrendPartialTrade],
    open_trades: Sequence[_SignalTrade | _PartialTrade | _SupertrendPartialTrade],
) -> dict[str, Any]:
    ordered = sorted(
        closed,
        key=lambda trade: (
            trade.exit_time if trade.exit_time is not None else sys.maxsize,
            trade.signal_time,
        ),
    )
    gross_rs = [float(trade.gross_r) for trade in ordered if trade.gross_r is not None]
    wins = [value for value in gross_rs if value > 0]
    losses = [value for value in gross_rs if value < 0]
    breakevens = [value for value in gross_rs if value == 0]
    gross_profit = sum(wins)
    gross_loss = -sum(losses)
    equity = 0.0
    peak = 0.0
    max_drawdown = 0.0
    for value in gross_rs:
        equity += value
        peak = max(peak, equity)
        max_drawdown = max(max_drawdown, peak - equity)

    by_side: dict[str, dict[str, Any]] = {}
    for label, side in (("long", 1), ("short", -1)):
        side_rs = [
            float(trade.gross_r)
            for trade in ordered
            if trade.side == side and trade.gross_r is not None
        ]
        side_profit = sum(value for value in side_rs if value > 0)
        side_loss = -sum(value for value in side_rs if value < 0)
        by_side[label] = {
            "closed": len(side_rs),
            "wins": sum(value > 0 for value in side_rs),
            "losses": sum(value < 0 for value in side_rs),
            "breakevens": sum(value == 0 for value in side_rs),
            "winRate": None
            if not side_rs
            else sum(value > 0 for value in side_rs) / len(side_rs),
            "netR": sum(side_rs),
            "profitFactor": None if side_loss == 0 else side_profit / side_loss,
            "expectancyR": None if not side_rs else mean(side_rs),
        }

    return {
        "closed": len(gross_rs),
        "openAtEnd": len(open_trades),
        "openPartialsAtEnd": sum(
            bool(getattr(trade, "partial_taken", False)) for trade in open_trades
        ),
        "wins": len(wins),
        "losses": len(losses),
        "breakevens": len(breakevens),
        "winRate": None if not gross_rs else len(wins) / len(gross_rs),
        "grossProfitR": gross_profit,
        "grossLossR": gross_loss,
        "netR": sum(gross_rs),
        "profitFactor": None if gross_loss == 0 else gross_profit / gross_loss,
        "expectancyR": None if not gross_rs else mean(gross_rs),
        "maxDrawdownR": max_drawdown,
        "exitReasons": dict(
            sorted(Counter(trade.exit_reason for trade in ordered).items())
        ),
        "bySide": by_side,
    }


def settings_to_ui(settings: MgannSignalSettings) -> dict[str, Any]:
    """Use the exact field names shown by the frontend profile/alert payload."""

    return {
        "requireBigTrade": False,
        "volumeDeltaLookback": settings.volume_delta_lookback,
        "volumeDeltaMultiplier": settings.volume_delta_multiplier,
        "minSpreadTicks": settings.min_spread_ticks,
        "spreadLookback": settings.spread_lookback,
        "spreadMultiplier": settings.spread_multiplier,
        "swingSize": settings.swing_size,
        "pivotLookbackBars": settings.pivot_lookback_bars,
        "minPivotCuts": settings.min_pivot_cuts,
        "pivotToleranceTicks": settings.pivot_tolerance_ticks,
        "minPivotWickTicks": settings.min_pivot_wick_ticks,
        "filterLiquidity": settings.filter_liquidity,
        "liquidityAtrMargin": settings.liquidity_atr_margin,
        "liquiditySweepLookbackBars": settings.liquidity_sweep_lookback_bars,
        "confirmationBars": settings.confirmation_bars,
        "breakTicks": settings.break_ticks,
    }


def build_search_candidates(
    *,
    baseline: MgannSignalSettings = MgannSignalSettings(),
    random_configs: int = 24,
    seed: int = 20261012,
) -> list[MgannSignalSettings]:
    """Build a reproducible screen: one-factor sweeps plus random interactions."""

    candidates: list[MgannSignalSettings] = [baseline]
    one_factor_domains: dict[str, tuple[Any, ...]] = {
        "volume_delta_lookback": (10, 20, 30, 40),
        "volume_delta_multiplier": (1.5, 2.0, 2.5, 3.0, 3.5),
        "min_spread_ticks": (0, 3, 5, 10),
        "spread_lookback": (10, 20, 30, 40),
        "spread_multiplier": (1.5, 2.0, 2.5, 3.0, 3.5),
        "swing_size": (3, 4, 5, 6, 7),
        "confirmation_bars": (0, 1, 2, 3),
        "break_ticks": (0, 1, 2, 3),
    }
    for field, values in one_factor_domains.items():
        for value in values:
            candidates.append(replace(baseline, **{field: value}))

    # Include the older x2/x2 server defaults as one explicit comparison.
    candidates.append(
        replace(
            baseline,
            volume_delta_multiplier=2.0,
            spread_multiplier=2.0,
        )
    )

    liquidity = replace(baseline, filter_liquidity=True)
    candidates.append(liquidity)
    for field, values in {
        "pivot_lookback_bars": (60, 120, 240),
        "min_pivot_cuts": (2, 3, 4),
        "liquidity_atr_margin": (2.0, 4.0, 6.0),
        "liquidity_sweep_lookback_bars": (3, 5, 10),
    }.items():
        for value in values:
            candidates.append(replace(liquidity, **{field: value}))

    rng = random.Random(seed)
    random_domains: dict[str, tuple[Any, ...]] = {
        **one_factor_domains,
        "filter_liquidity": (False, True),
        "pivot_lookback_bars": (60, 120, 240),
        "min_pivot_cuts": (2, 3, 4),
        "liquidity_atr_margin": (2.0, 4.0, 6.0),
        "liquidity_sweep_lookback_bars": (3, 5, 10),
    }
    candidates = _deduplicate(candidates)
    starting_count = len(candidates)
    attempts = 0
    while len(candidates) < starting_count + max(0, random_configs) and attempts < 10_000:
        attempts += 1
        values = {
            field: rng.choice(domain) for field, domain in random_domains.items()
        }
        if not values["filter_liquidity"]:
            values.update(
                pivot_lookback_bars=baseline.pivot_lookback_bars,
                min_pivot_cuts=baseline.min_pivot_cuts,
                liquidity_atr_margin=baseline.liquidity_atr_margin,
                liquidity_sweep_lookback_bars=baseline.liquidity_sweep_lookback_bars,
            )
        candidate = replace(baseline, **values)
        if candidate not in candidates:
            candidates.append(candidate)
    return candidates


def _deduplicate(
    values: Iterable[MgannSignalSettings],
) -> list[MgannSignalSettings]:
    return list(dict.fromkeys(values))


def optimize_mgann_settings(
    bars: Sequence[MgannBacktestBar],
    *,
    evaluation_start: int,
    split_time: int,
    candidates: Sequence[MgannSignalSettings],
    min_train_trades: int = 50,
    top: int = 10,
    targets: Sequence[float] = _DEFAULT_TARGETS,
    progress: Callable[[str], None] | None = None,
) -> dict[str, Any]:
    """Rank on the earlier window, then evaluate only finalists on holdout."""

    ordered = sorted(bars, key=lambda item: item.time)
    train_bars = [bar for bar in ordered if bar.time < split_time]
    holdout_index = next(
        (index for index, bar in enumerate(ordered) if bar.time >= split_time),
        len(ordered),
    )
    holdout_bars = ordered[max(0, holdout_index - 1_000) :]
    unique_candidates = _deduplicate([MgannSignalSettings(), *candidates])
    training_results: dict[MgannSignalSettings, dict[str, Any]] = {}

    for index, settings in enumerate(unique_candidates, start=1):
        if progress is not None:
            progress(f"training {index}/{len(unique_candidates)}")
        training_results[settings] = run_mgann_signal_backtest(
            train_bars,
            evaluation_start=evaluation_start,
            settings=settings,
            targets=targets,
        )

    ranked: dict[str, list[MgannSignalSettings]] = {}
    for target in targets:
        key = _target_key(target)
        ranked[key] = sorted(
            unique_candidates,
            key=lambda settings: _ranking_tuple(
                training_results[settings]["targets"][key],
                float(target),
                min_train_trades,
            ),
            reverse=True,
        )[: max(1, top)]

    finalists = _deduplicate(
        [MgannSignalSettings(), *[item for values in ranked.values() for item in values]]
    )
    holdout_results: dict[MgannSignalSettings, dict[str, Any]] = {}
    for index, settings in enumerate(finalists, start=1):
        if progress is not None:
            progress(f"holdout {index}/{len(finalists)}")
        holdout_results[settings] = run_mgann_signal_backtest(
            holdout_bars,
            evaluation_start=split_time,
            settings=settings,
            targets=targets,
        )

    baseline = MgannSignalSettings()
    leaderboard: dict[str, list[dict[str, Any]]] = {}
    for target in targets:
        key = _target_key(target)
        rows = []
        for rank, settings in enumerate(ranked[key], start=1):
            train_summary = training_results[settings]["targets"][key]
            rows.append(
                {
                    "rank": rank,
                    "trainingScore": _finite_or_none(
                        _conservative_expectancy(
                            train_summary, float(target), min_train_trades
                        )
                    ),
                    "settings": settings_to_ui(settings),
                    "training": train_summary,
                    "holdout": holdout_results[settings]["targets"][key],
                }
            )
        leaderboard[key] = rows

    baseline_holdout = holdout_results.get(baseline)
    if baseline_holdout is None:
        baseline_holdout = run_mgann_signal_backtest(
            holdout_bars,
            evaluation_start=split_time,
            settings=baseline,
            targets=targets,
        )
    return {
        "data": {
            "bars": len(ordered),
            "evaluationStart": evaluation_start,
            "splitTime": split_time,
            "endTime": ordered[-1].time if ordered else None,
            "trainingBars": len(train_bars),
            "holdoutBarsWithWarmup": len(holdout_bars),
        },
        "search": {
            "candidateCount": len(unique_candidates),
            "minTrainingTrades": min_train_trades,
            "ranking": "95% Wilson lower-bound expectancy; holdout is not used for ranking",
        },
        "assumptions": {
            "entry": "signal M1 close",
            "stop": "signal low for Long; signal high for Short; no buffer",
            "targets": [float(target) for target in targets],
            "intrabar": "from the next M1 bar, adverse-first when stop and target share a bar",
            "costs": "gross R only; no spread, commission, basis, or slippage",
            "overlap": "each signal is scored independently; overlapping signals are allowed",
        },
        "parameterNotes": {
            "pivotToleranceTicks": (
                "currently does not participate in signal logic; it only changes "
                "detector retention sizing"
            ),
            "minPivotWickTicks": (
                "currently does not participate in signal logic; it only changes "
                "detector retention sizing"
            ),
            "pivotLookbackBars": (
                "affects signals only when filterLiquidity is enabled"
            ),
            "requireBigTrade": (
                "not searched because retained bar/delta history does not contain "
                "aligned BigTrade buckets"
            ),
        },
        "baseline": {
            "settings": settings_to_ui(baseline),
            "training": training_results[baseline]["targets"],
            "holdout": baseline_holdout["targets"],
        },
        "leaderboard": leaderboard,
    }


def _ranking_tuple(
    summary: dict[str, Any],
    target_r: float,
    min_trades: int,
) -> tuple[float, float, float, int]:
    score = _conservative_expectancy(summary, target_r, min_trades)
    expectancy = summary.get("expectancyR")
    return (
        score,
        float(expectancy) if expectancy is not None else -math.inf,
        float(summary.get("netR", 0.0)),
        int(summary.get("closed", 0)),
    )


def _conservative_expectancy(
    summary: dict[str, Any],
    target_r: float,
    min_trades: int,
) -> float:
    closed = int(summary.get("closed", 0))
    if closed < max(1, min_trades):
        return -math.inf
    wins = int(summary.get("wins", 0))
    probability = wins / closed
    z = 1.959963984540054
    denominator = 1.0 + z * z / closed
    center = probability + z * z / (2.0 * closed)
    margin = z * math.sqrt(
        probability * (1.0 - probability) / closed
        + z * z / (4.0 * closed * closed)
    )
    lower = (center - margin) / denominator
    return (target_r + 1.0) * lower - 1.0


def _target_key(target: float) -> str:
    return f"{target:g}R"


def _finite_or_none(value: float) -> float | None:
    return value if math.isfinite(value) else None


def _progress(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default="data/app.sqlite", help="Path to app.sqlite")
    parser.add_argument("--days", type=int, default=180, help="Latest calendar days")
    parser.add_argument(
        "--holdout-days",
        type=int,
        default=45,
        help="Latest calendar days reserved from ranking",
    )
    parser.add_argument(
        "--random-configs",
        type=int,
        default=24,
        help="Deterministic random interaction settings added to one-factor sweeps",
    )
    parser.add_argument("--seed", type=int, default=20261012)
    parser.add_argument("--min-train-trades", type=int, default=50)
    parser.add_argument("--top", type=int, default=10)
    parser.add_argument("--output", help="Optional JSON report path")
    args = parser.parse_args(argv)
    if args.holdout_days <= 0 or args.holdout_days >= args.days:
        parser.error("--holdout-days must be greater than zero and smaller than --days")

    load_config = MgannBacktestConfig(days=max(2, args.days), warmup_bars=1_000)
    bars, evaluation_start, end_time = load_latest_window(args.db, load_config)
    if not bars:
        parser.error("no closed GC/GC 1m bars were found")
    split_time = end_time - args.holdout_days * _DAY_MS
    candidates = build_search_candidates(
        random_configs=max(0, args.random_configs),
        seed=args.seed,
    )
    report = optimize_mgann_settings(
        bars,
        evaluation_start=evaluation_start,
        split_time=split_time,
        candidates=candidates,
        min_train_trades=max(1, args.min_train_trades),
        top=max(1, args.top),
        progress=_progress,
    )
    payload = json.dumps(report, indent=2, sort_keys=True, allow_nan=False)
    if args.output:
        output = Path(args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(payload + "\n", encoding="utf-8")
        print(str(output.resolve()))
    else:
        print(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
