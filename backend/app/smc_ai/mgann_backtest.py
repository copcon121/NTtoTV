"""Read-only, conservative M1 replay for the server-side auto mGann strategy.

The live strategy sends orders after a closed M1 bar, but retained tick history
does not cover the full research window.  This runner therefore uses a stated
adverse-first M1 path: for a long it checks the low/stop before the high/target;
for a short it checks the high/stop before the low/target.  It is deliberately
conservative and reports gross R only--no broker spread, commission, basis, or
slippage is invented by the replay.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from collections import Counter, deque
from dataclasses import asdict, dataclass
from pathlib import Path
from statistics import mean
from typing import Any, Literal, Sequence

from ..engines.auto_mgann_trade import (
    _is_auto_body_size_allowed,
    _round_gc,
    _signal_body_limit_price,
    _signal_stop,
)
from ..engines.mgann_big_trade_sweep import (
    MgannBigTradeSweepBar,
    MgannBigTradeSweepState,
)
from ..models.messages import OHLCVBar
from ..models.orders import OrderSide

_DAY_MS = 24 * 60 * 60 * 1_000
_EMA_SMOOTHING = 2.0 / (21 + 1)
_EMA200_SMOOTHING = 2.0 / (200 + 1)
_GC_TICK_SIZE = 0.1


@dataclass(frozen=True, slots=True)
class MgannBacktestBar:
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: int
    delta: int


@dataclass(frozen=True, slots=True)
class MgannBacktestConfig:
    symbol: str = "GC"
    contract: str = "GC"
    timeframe: str = "1m"
    days: int = 90
    warmup_bars: int = 500
    require_delta_filter: bool = False
    require_liquidity_filter: bool = False
    require_ema200_trend_filter: bool = False
    breakeven_at_one_r: bool = False
    fixed_target_r: float | None = None
    trade_side: Literal["both", "long", "short"] = "both"
    delta_lookback: int = 20
    delta_multiplier: float = 2.0


@dataclass(slots=True)
class _Trade:
    id: str
    signal_time: int
    side: int
    entry_style: Literal["market", "body_70_percent_limit"]
    entry: float
    stop: float
    target: float
    risk: float
    submitted_time: int
    status: Literal["pending", "open", "cancelled", "closed"]
    initial_stop: float | None = None
    filled_time: int | None = None
    trailing: bool = False
    exit_time: int | None = None
    exit_price: float | None = None
    exit_reason: str | None = None

    def to_result(self) -> dict[str, Any]:
        gross_r: float | None = None
        if self.exit_price is not None and self.risk > 0:
            gross_r = self.side * (self.exit_price - self.entry) / self.risk
        return {
            "id": self.id,
            "signalTime": self.signal_time,
            "side": "long" if self.side > 0 else "short",
            "entryStyle": self.entry_style,
            "entry": self.entry,
            "initialStop": self.initial_stop,
            "target": self.target,
            "risk": self.risk,
            "status": self.status,
            "filledTime": self.filled_time,
            "trailing": self.trailing,
            "exitTime": self.exit_time,
            "exitPrice": self.exit_price,
            "exitReason": self.exit_reason,
            "grossR": gross_r,
            "holdingBars": (
                None
                if self.filled_time is None or self.exit_time is None
                else (self.exit_time - self.filled_time) // 60_000
            ),
        }


def load_latest_window(
    db_path: str | Path,
    config: MgannBacktestConfig = MgannBacktestConfig(),
) -> tuple[list[MgannBacktestBar], int, int]:
    """Load a latest rolling window plus detector warm-up bars, read-only."""
    path = Path(db_path)
    if not path.exists():
        raise FileNotFoundError(path)
    uri = f"file:{path.resolve().as_posix()}?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    try:
        latest = conn.execute(
            """
            SELECT MAX(time)
            FROM bars
            WHERE symbol = ? AND contract = ? AND timeframe = ? AND closed = 1
            """,
            (config.symbol, config.contract, config.timeframe),
        ).fetchone()[0]
        if latest is None:
            return [], 0, 0
        end_time = int(latest)
        start_time = end_time - max(1, int(config.days)) * _DAY_MS
        warmup_start = start_time - max(1, int(config.warmup_bars)) * 60_000
        rows = conn.execute(
            """
            SELECT
                b.time, b.open, b.high, b.low, b.close, b.volume,
                COALESCE(vd.delta, 0)
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
              AND b.time >= ?
              AND b.time <= ?
            ORDER BY b.time ASC
            """,
            (
                config.symbol,
                config.contract,
                config.timeframe,
                warmup_start,
                end_time,
            ),
        ).fetchall()
    finally:
        conn.close()
    return [MgannBacktestBar(*row) for row in rows], start_time, end_time


def delta_filter_passes(
    *,
    direction: int,
    current_delta: int,
    previous_abs_deltas: Sequence[int],
    multiplier: float = 2.0,
) -> bool:
    """Require signed delta alignment and magnitude versus previous bars only."""
    if direction not in (-1, 1) or not previous_abs_deltas:
        return False
    baseline = mean(abs(int(value)) for value in previous_abs_deltas)
    if baseline <= 0:
        return False
    return direction * int(current_delta) > 0 and abs(int(current_delta)) >= baseline * multiplier


def ema200_trend_filter_passes(
    *, direction: int, close: float, ema200: float | None
) -> bool:
    """Require a strictly aligned M1 close against the point-in-time EMA200."""
    if ema200 is None or direction not in (-1, 1):
        return False
    return close > ema200 if direction > 0 else close < ema200


def trade_side_filter_passes(
    *, direction: int, trade_side: Literal["both", "long", "short"]
) -> bool:
    """Keep only the requested direction without changing detector state."""
    if direction not in (-1, 1):
        return False
    return trade_side == "both" or (
        trade_side == "long" and direction > 0
    ) or (trade_side == "short" and direction < 0)


def run_mgann_backtest(
    bars: Sequence[MgannBacktestBar],
    *,
    evaluation_start: int,
    config: MgannBacktestConfig = MgannBacktestConfig(),
    include_trades: bool = False,
) -> dict[str, Any]:
    """Replay the current auto L/S rules over bars ordered by ascending time."""
    ordered = sorted(bars, key=lambda item: item.time)
    detector = MgannBigTradeSweepState(
        timeframe="1m",
        require_big_trade=False,
        volume_delta_lookback=config.delta_lookback,
        volume_delta_multiplier=config.delta_multiplier,
        spread_lookback=20,
        spread_multiplier=2.0,
        swing_size=5,
        confirmation_bars=2,
        break_ticks=0,
        filter_liquidity=config.require_liquidity_filter,
        tick_size=_GC_TICK_SIZE,
    )
    pending: list[_Trade] = []
    open_trades: list[_Trade] = []
    closed: list[_Trade] = []
    cancelled: list[_Trade] = []
    previous_abs_deltas: deque[int] = deque(maxlen=max(1, config.delta_lookback))
    ema21: float | None = None
    ema200: float | None = None
    candidates = 0
    body_too_large = 0
    delta_rejected = 0
    ema200_rejected = 0
    side_rejected = 0
    market_submitted = 0
    limit_submitted = 0

    for bar in ordered:
        _process_intrabar(
            bar,
            ema21=ema21,
            pending=pending,
            open_trades=open_trades,
            closed=closed,
            cancelled=cancelled,
            breakeven_at_one_r=config.breakeven_at_one_r,
            enable_ema_trailing=config.fixed_target_r is None,
        )
        ema21 = _advance_ema21(ema21, bar.close)
        ema200 = _advance_ema200(ema200, bar.close)
        if not config.breakeven_at_one_r and config.fixed_target_r is None:
            _manage_at_close(bar, ema21, open_trades, closed)

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
        for trigger in triggers:
            if bar.time < evaluation_start:
                continue
            candidates += 1
            if not trade_side_filter_passes(
                direction=trigger.direction,
                trade_side=config.trade_side,
            ):
                side_rejected += 1
                continue
            if not _is_auto_body_size_allowed(trigger):
                body_too_large += 1
                continue
            if config.require_ema200_trend_filter and not ema200_trend_filter_passes(
                direction=trigger.direction,
                close=bar.close,
                ema200=ema200,
            ):
                ema200_rejected += 1
                continue
            if config.require_delta_filter and not delta_filter_passes(
                direction=trigger.direction,
                current_delta=bar.delta,
                previous_abs_deltas=tuple(previous_abs_deltas),
                multiplier=config.delta_multiplier,
            ):
                delta_rejected += 1
                continue
            trade = _new_trade(
                bar,
                direction=trigger.direction,
                ordinal=candidates,
                fixed_target_r=config.fixed_target_r,
            )
            if trade.entry_style == "market":
                market_submitted += 1
                _fill(trade, bar.time)
                open_trades.append(trade)
            else:
                limit_submitted += 1
                pending.append(trade)

        previous_abs_deltas.append(abs(int(bar.delta)))

    all_trades = [*closed, *cancelled, *pending, *open_trades]
    summary = _summarize(
        closed=closed,
        cancelled=cancelled,
        pending=pending,
        open_trades=open_trades,
    )
    result: dict[str, Any] = {
        "config": asdict(config),
        "assumptions": {
            "entry": "market at signal M1 close; body > 4.0 uses 70%-body limit",
            "intrabar": "adverse-first M1 path; long low/stop before high/target, short high/stop before low/target",
            "costs": "gross R only; no broker spread, commission, basis, or slippage",
            "trailing": "default: EMA21 trailing from +1R; break-even option: move stop to entry at +1R and disable EMA21 trailing; a fixed target disables EMA21 trailing",
            "target": "default: 3R target; fixedTargetR overrides it with a fixed take-profit multiple",
            "side": "both by default; long-only or short-only replays skip the other direction before order submission",
            "ema200Trend": "when enabled, signal-bar close must be strictly above EMA200 for long or below EMA200 for short",
        },
        "data": {
            "bars": len(ordered),
            "startTime": evaluation_start,
            "endTime": ordered[-1].time if ordered else None,
        },
        "signals": {
            "candidates": candidates,
            "bodyTooLargeRejected": body_too_large,
            "deltaRejected": delta_rejected,
            "ema200Rejected": ema200_rejected,
            "sideRejected": side_rejected,
            "marketSubmitted": market_submitted,
            "limitSubmitted": limit_submitted,
            "submitted": market_submitted + limit_submitted,
        },
        "summary": summary,
    }
    if include_trades:
        result["trades"] = [trade.to_result() for trade in sorted(all_trades, key=lambda item: item.id)]
    return result


def _new_trade(
    bar: MgannBacktestBar,
    *,
    direction: int,
    ordinal: int,
    fixed_target_r: float | None = None,
) -> _Trade:
    side = OrderSide.BUY if direction > 0 else OrderSide.SELL
    ohlcv = OHLCVBar(
        time=bar.time,
        open=bar.open,
        high=bar.high,
        low=bar.low,
        close=bar.close,
        volume=bar.volume,
    )
    entry_style: Literal["market", "body_70_percent_limit"] = (
        "body_70_percent_limit" if abs(bar.close - bar.open) > 4.0 else "market"
    )
    entry = (
        _signal_body_limit_price(ohlcv)
        if entry_style == "body_70_percent_limit"
        else _round_gc(bar.close)
    )
    stop = _signal_stop(side, ohlcv)
    risk = (entry - stop) if direction > 0 else (stop - entry)
    if risk <= 0:
        raise ValueError(f"invalid mGann risk at {bar.time}")
    target_r = 3.0 if fixed_target_r is None else fixed_target_r
    target = _round_gc(entry + direction * target_r * risk)
    return _Trade(
        id=f"mgann:{bar.time}:{direction}:{ordinal}",
        signal_time=bar.time,
        side=direction,
        entry_style=entry_style,
        entry=entry,
        stop=stop,
        target=target,
        risk=risk,
        submitted_time=bar.time,
        status="pending" if entry_style == "body_70_percent_limit" else "open",
        initial_stop=stop,
    )


def _process_intrabar(
    bar: MgannBacktestBar,
    *,
    ema21: float | None,
    pending: list[_Trade],
    open_trades: list[_Trade],
    closed: list[_Trade],
    cancelled: list[_Trade],
    breakeven_at_one_r: bool,
    enable_ema_trailing: bool = True,
) -> None:
    for trade in list(open_trades):
        _process_open_intrabar(
            bar,
            trade,
            ema21,
            open_trades,
            closed,
            breakeven_at_one_r,
            enable_ema_trailing,
        )

    for trade in list(pending):
        if trade.side > 0:
            filled = bar.low <= trade.entry
            cancel_at_one_r = bar.high >= _one_r(trade)
        else:
            filled = bar.high >= trade.entry
            cancel_at_one_r = bar.low <= _one_r(trade)
        if filled:
            pending.remove(trade)
            _fill(trade, bar.time)
            open_trades.append(trade)
            _process_open_intrabar(
                bar,
                trade,
                ema21,
                open_trades,
                closed,
                breakeven_at_one_r,
                enable_ema_trailing,
            )
        elif cancel_at_one_r:
            pending.remove(trade)
            trade.status = "cancelled"
            trade.exit_time = bar.time
            trade.exit_reason = "limit_cancelled_at_1r"
            cancelled.append(trade)


def _process_open_intrabar(
    bar: MgannBacktestBar,
    trade: _Trade,
    ema21: float | None,
    open_trades: list[_Trade],
    closed: list[_Trade],
    breakeven_at_one_r: bool,
    enable_ema_trailing: bool,
) -> None:
    if trade.status != "open":
        return
    if trade.side > 0:
        if bar.low <= trade.stop:
            _close(trade, bar.time, trade.stop, "stop", open_trades, closed)
            return
        if bar.high >= trade.target:
            _close(trade, bar.time, trade.target, "target", open_trades, closed)
            return
        if bar.high >= _one_r(trade):
            _activate_trailing(
                trade,
                ema21,
                breakeven_at_one_r,
                enable_ema_trailing,
            )
    else:
        if bar.high >= trade.stop:
            _close(trade, bar.time, trade.stop, "stop", open_trades, closed)
            return
        if bar.low <= trade.target:
            _close(trade, bar.time, trade.target, "target", open_trades, closed)
            return
        if bar.low <= _one_r(trade):
            _activate_trailing(
                trade,
                ema21,
                breakeven_at_one_r,
                enable_ema_trailing,
            )


def _manage_at_close(
    bar: MgannBacktestBar,
    ema21: float | None,
    open_trades: list[_Trade],
    closed: list[_Trade],
) -> None:
    if ema21 is None:
        return
    for trade in list(open_trades):
        if not trade.trailing:
            continue
        if (trade.side > 0 and bar.close < ema21) or (
            trade.side < 0 and bar.close > ema21
        ):
            _close(trade, bar.time, _round_gc(bar.close), "ema21_cross", open_trades, closed)
            continue
        _ratchet_stop_to_ema(trade, ema21)


def _activate_trailing(
    trade: _Trade,
    ema21: float | None,
    breakeven_at_one_r: bool,
    enable_ema_trailing: bool = True,
) -> None:
    trade.trailing = True
    if breakeven_at_one_r:
        if trade.side > 0:
            trade.stop = max(trade.stop, trade.entry)
        else:
            trade.stop = min(trade.stop, trade.entry)
    if enable_ema_trailing and not breakeven_at_one_r and ema21 is not None:
        _ratchet_stop_to_ema(trade, ema21)


def _ratchet_stop_to_ema(trade: _Trade, ema21: float) -> None:
    next_stop = _round_gc(ema21)
    if trade.side > 0 and next_stop > trade.stop:
        trade.stop = next_stop
    elif trade.side < 0 and next_stop < trade.stop:
        trade.stop = next_stop


def _fill(trade: _Trade, time: int) -> None:
    trade.status = "open"
    trade.filled_time = time


def _close(
    trade: _Trade,
    time: int,
    price: float,
    reason: str,
    open_trades: list[_Trade],
    closed: list[_Trade],
) -> None:
    trade.status = "closed"
    trade.exit_time = time
    trade.exit_price = _round_gc(price)
    trade.exit_reason = reason
    if trade in open_trades:
        open_trades.remove(trade)
    closed.append(trade)


def _one_r(trade: _Trade) -> float:
    return _round_gc(trade.entry + trade.side * trade.risk)


def _advance_ema21(current: float | None, close: float) -> float:
    return close if current is None else close * _EMA_SMOOTHING + current * (1.0 - _EMA_SMOOTHING)


def _advance_ema200(current: float | None, close: float) -> float:
    return close if current is None else close * _EMA200_SMOOTHING + current * (1.0 - _EMA200_SMOOTHING)


def _summarize(
    *,
    closed: Sequence[_Trade],
    cancelled: Sequence[_Trade],
    pending: Sequence[_Trade],
    open_trades: Sequence[_Trade],
) -> dict[str, Any]:
    results = [trade.to_result() for trade in closed]
    gross_rs = [float(item["grossR"]) for item in results if item["grossR"] is not None]
    wins = [value for value in gross_rs if value > 0]
    losses = [value for value in gross_rs if value < 0]
    gross_profit = sum(wins)
    gross_loss = -sum(losses)
    by_side: dict[str, dict[str, Any]] = {}
    for side in ("long", "short"):
        side_rs = [
            float(item["grossR"])
            for item in results
            if item["side"] == side and item["grossR"] is not None
        ]
        side_profit = sum(value for value in side_rs if value > 0)
        side_loss = -sum(value for value in side_rs if value < 0)
        by_side[side] = {
            "closed": len(side_rs),
            "wins": sum(value > 0 for value in side_rs),
            "losses": sum(value < 0 for value in side_rs),
            "grossR": sum(side_rs),
            "profitFactor": None if side_loss == 0 else side_profit / side_loss,
            "expectancyR": None if not side_rs else mean(side_rs),
        }
    return {
        "filled": len(closed) + len(open_trades),
        "cancelledLimits": len(cancelled),
        "openAtEnd": len(open_trades),
        "workingLimitsAtEnd": len(pending),
        "wins": len(wins),
        "losses": len(losses),
        "winRate": None if not gross_rs else len(wins) / len(gross_rs),
        "grossProfitR": gross_profit,
        "grossLossR": gross_loss,
        "netR": sum(gross_rs),
        "profitFactor": None if gross_loss == 0 else gross_profit / gross_loss,
        "expectancyR": None if not gross_rs else mean(gross_rs),
        "exitReasons": dict(sorted(Counter(item["exitReason"] for item in results).items())),
        "bySide": by_side,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", default="data/app.sqlite", help="Path to app.sqlite")
    parser.add_argument("--days", type=int, default=90, help="Latest rolling calendar days")
    parser.add_argument("--delta-filter", action="store_true", help="Require aligned delta >= 2x prior-20 absolute delta")
    parser.add_argument("--liquidity-filter", action="store_true", help="Require CHoCH to follow the configured BSL/SSL sweep")
    parser.add_argument("--ema200-trend-filter", action="store_true", help="Require long close > M1 EMA200 and short close < M1 EMA200")
    parser.add_argument("--breakeven-at-1r", action="store_true", help="Move stop to entry at +1R and replace EMA21 trailing")
    parser.add_argument("--fixed-target-r", type=float, help="Use a fixed take-profit multiple and disable EMA21 trailing")
    parser.add_argument("--trade-side", choices=("both", "long", "short"), default="both", help="Replay both directions, long-only, or short-only")
    parser.add_argument("--include-trades", action="store_true", help="Include every simulated trade in JSON")
    args = parser.parse_args(argv)
    if args.fixed_target_r is not None and args.fixed_target_r <= 0:
        parser.error("--fixed-target-r must be greater than zero")
    config = MgannBacktestConfig(
        days=max(1, args.days),
        require_delta_filter=args.delta_filter,
        require_liquidity_filter=args.liquidity_filter,
        require_ema200_trend_filter=args.ema200_trend_filter,
        breakeven_at_one_r=args.breakeven_at_1r,
        fixed_target_r=args.fixed_target_r,
        trade_side=args.trade_side,
    )
    bars, start_time, _ = load_latest_window(args.db, config)
    result = run_mgann_backtest(
        bars,
        evaluation_start=start_time,
        config=config,
        include_trades=args.include_trades,
    )
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
