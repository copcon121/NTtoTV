"""REST_API endpoints for historical alert signals."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, Query

from ..engines.alert_engine import MGANN_BREAK_LS, MGANN_BIG_TRADE_SWEEP, MGANN_SWEEP
from ..engines.mgann_big_trade_sweep import (
    MGANN_BIG_TRADE_SWEEP_DEFAULT_BIG_TRADE_THRESHOLD,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_BREAK_TICKS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_CONFIRMATION_BARS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_CUTS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_SPREAD_TICKS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_VOLUME,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_LOOKBACK_BARS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_LOOKBACK,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_MULTIPLIER,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_SWING_SIZE,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_LOOKBACK,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_MULTIPLIER,
    MgannBigTradeSweepBar,
    MgannBigTradeSweepState,
)
from ..storage.cache_store import CacheStore
from ..storage.records import AlertRecord, BarRecord, BigTradeRecord
from .contract_state import ContractStateStore
from .errors import bad_request, not_found
from .orderflow import get_cache
from .routes import _resolve_contract, get_contract_state

router = APIRouter(prefix="/api", tags=["signals"])

DEFAULT_SIGNAL_LIMIT = 500
SIGNAL_LIMIT_CAP = 1_000
DEFAULT_SIGNAL_WARMUP_BARS = 500
MGANN_SWEEP_SIGNAL_BAR_CAP = 1_000
_M1_MS = 60_000

@router.get("/signals/mgann-break-ls")
async def mgann_break_ls_signals(
    symbol: str = Query("GC", description="User-facing symbol, e.g. 'GC'"),
    contract: str | None = Query(
        None,
        description="Chart cache contract. Defaults to the logical chart alias.",
    ),
    tf: str = Query("1m", description="Timeframe. v1 supports 1m only."),
    profile_id: str = Query("default", alias="profileId"),
    frm: int | None = Query(
        None, alias="from", description="Inclusive start Canonical_Timestamp (ms)"
    ),
    to: int | None = Query(
        None, description="Inclusive end Canonical_Timestamp (ms)"
    ),
    limit: int = Query(DEFAULT_SIGNAL_LIMIT, description="Max signals returned"),
    warmup_bars: int = Query(
        DEFAULT_SIGNAL_WARMUP_BARS,
        alias="warmupBars",
        description="Bars before the requested range used to warm the detector",
    ),
    state: ContractStateStore = Depends(get_contract_state),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    """Return historical mGann Break L/S markers for enabled profile alerts."""
    return await _mgann_break_ls_response(
        symbol=symbol,
        contract=contract,
        tf=tf,
        profile_id=profile_id,
        frm=frm,
        to=to,
        limit=limit,
        warmup_bars=warmup_bars,
        state=state,
        cache=cache,
    )


@router.get("/signals/mgann-big-trade-sweep")
async def mgann_big_trade_sweep_signals(
    symbol: str = Query("GC", description="User-facing symbol, e.g. 'GC'"),
    contract: str | None = Query(
        None,
        description="Chart cache contract. Defaults to the logical chart alias.",
    ),
    tf: str = Query("1m", description="Timeframe. v1 supports 1m only."),
    profile_id: str = Query("default", alias="profileId"),
    frm: int | None = Query(
        None, alias="from", description="Inclusive start Canonical_Timestamp (ms)"
    ),
    to: int | None = Query(
        None, description="Inclusive end Canonical_Timestamp (ms)"
    ),
    limit: int = Query(DEFAULT_SIGNAL_LIMIT, description="Max signals returned"),
    warmup_bars: int = Query(
        DEFAULT_SIGNAL_WARMUP_BARS,
        alias="warmupBars",
        description="Bars before the requested range used to warm the detector",
    ),
    state: ContractStateStore = Depends(get_contract_state),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    """Legacy alias for historical mGann Break L/S markers."""
    return await _mgann_break_ls_response(
        symbol=symbol,
        contract=contract,
        tf=tf,
        profile_id=profile_id,
        frm=frm,
        to=to,
        limit=limit,
        warmup_bars=warmup_bars,
        state=state,
        cache=cache,
    )


async def _mgann_break_ls_response(
    *,
    symbol: str,
    contract: str | None,
    tf: str,
    profile_id: str,
    frm: int | None,
    to: int | None,
    limit: int,
    warmup_bars: int,
    state: ContractStateStore,
    cache: CacheStore,
) -> dict[str, Any]:
    if not state.is_known_symbol(symbol):
        raise not_found(f"Unknown symbol {symbol!r}", field="symbol")
    if tf != "1m":
        raise not_found("mGann Break L/S signals currently support tf='1m'", field="tf")
    if frm is not None and to is not None and frm > to:
        raise bad_request("'from' must be less than or equal to 'to'", field="from")
    if limit < 1:
        raise bad_request("'limit' must be a positive integer", field="limit")
    if warmup_bars < 0:
        raise bad_request("'warmupBars' must be non-negative", field="warmupBars")

    resolved_contract = (
        symbol
        if contract is None or contract == ""
        else _resolve_contract(state, symbol, contract)
    )
    effective_limit = min(limit, SIGNAL_LIMIT_CAP)
    profile_id = _normalize_profile_id(profile_id)
    signals = await asyncio.to_thread(
        _load_mgann_sweep_signals,
        cache=cache,
        symbol=symbol,
        contract=resolved_contract,
        timeframe=tf,
        profile_id=profile_id,
        from_time=frm,
        to_time=to,
        warmup_bars=warmup_bars,
    )
    if len(signals) > effective_limit:
        signals = signals[-effective_limit:]
    return {
        "symbol": symbol,
        "contract": resolved_contract,
        "tf": tf,
        "source": "mgann-break-ls-engine",
        "signals": signals,
    }

def _load_mgann_sweep_signals(
    *,
    cache: CacheStore,
    symbol: str,
    contract: str,
    timeframe: str,
    profile_id: str,
    from_time: int | None,
    to_time: int | None,
    warmup_bars: int,
) -> list[dict[str, Any]]:
    alerts = [
        alert
        for alert in cache.read_alerts(symbol=symbol, profile_id=profile_id)
        if alert.enabled
        and alert.type in (MGANN_BREAK_LS, MGANN_SWEEP, MGANN_BIG_TRADE_SWEEP)
    ]
    if not alerts:
        return []

    range_bars = cache.read_bars(
        symbol,
        contract,
        timeframe,
        frm=from_time,
        to=to_time,
        limit=MGANN_SWEEP_SIGNAL_BAR_CAP,
    )
    if not range_bars:
        return []

    first_time = range_bars[0].time
    last_time = range_bars[-1].time
    warmup = (
        cache.read_bars(
            symbol,
            contract,
            timeframe,
            to=first_time - _M1_MS,
            limit=warmup_bars,
        )
        if warmup_bars > 0
        else []
    )
    bars = [*warmup, *range_bars]
    big_trades = cache.read_big_trades(
        symbol,
        contract,
        frm=bars[0].time,
        to=last_time + _M1_MS - 1,
    )
    return _mgann_sweep_signals_from_history(
        alerts=alerts,
        bars=bars,
        big_trades=big_trades,
        from_time=first_time,
        to_time=last_time,
    )

def _mgann_sweep_signals_from_history(
    *,
    alerts: list[AlertRecord],
    bars: list[BarRecord],
    big_trades: list[BigTradeRecord],
    from_time: int,
    to_time: int,
) -> list[dict[str, Any]]:
    trades_by_bucket: dict[int, list[BigTradeRecord]] = {}
    for trade in big_trades:
        bucket = int(trade.time) - (int(trade.time) % _M1_MS)
        trades_by_bucket.setdefault(bucket, []).append(trade)

    by_id: dict[str, dict[str, Any]] = {}
    for alert in alerts:
        state = _mgann_sweep_state_from_alert(alert)
        for bar in bars:
            for trade in trades_by_bucket.get(bar.time, []):
                state.on_big_trade(
                    time=trade.time,
                    price=trade.price,
                    volume=trade.volume,
                )
            triggers = state.on_closed_bar(
                MgannBigTradeSweepBar(
                    time=bar.time,
                    open=bar.open,
                    high=bar.high,
                    low=bar.low,
                    close=bar.close,
                    volume=bar.volume,
                )
            )
            if bar.time < from_time or bar.time > to_time:
                continue
            for trigger in triggers:
                signal_id = f"{alert.id}:hist:{trigger.signal_time}:{trigger.direction}"
                by_id[signal_id] = {
                    "id": signal_id,
                    "alertId": alert.id,
                    "time": trigger.signal_time,
                    "price": trigger.signal_price,
                    "direction": trigger.direction,
                    "text": "Break L" if trigger.direction > 0 else "Break S",
                    "cutTime": trigger.cut_time,
                    "cutCount": trigger.cut_count,
                    "bigTradeVolume": trigger.big_trade_volume,
                    "barVolume": trigger.bar_volume,
                    "barSpread": trigger.bar_spread,
                    "avgVolume": trigger.avg_volume,
                    "avgSpread": trigger.avg_spread,
                }
    return sorted(by_id.values(), key=lambda item: (item["time"], item["id"]))

def _mgann_sweep_state_from_alert(alert: AlertRecord) -> MgannBigTradeSweepState:
    params = alert.params
    return MgannBigTradeSweepState(
        big_trade_threshold=_positive_float_param(
            params.get("bigTradeThreshold"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_BIG_TRADE_THRESHOLD,
        ),
        min_volume=_nonnegative_int_param(
            params.get("minVolume"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_VOLUME,
        ),
        volume_lookback=_positive_int_param(
            params.get("volumeLookback"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_LOOKBACK,
        ),
        volume_multiplier=_positive_float_param(
            params.get("volumeMultiplier"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_MULTIPLIER,
        ),
        min_spread_ticks=_nonnegative_int_param(
            params.get("minSpreadTicks"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_SPREAD_TICKS,
        ),
        spread_lookback=_positive_int_param(
            params.get("spreadLookback"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_LOOKBACK,
        ),
        spread_multiplier=_positive_float_param(
            params.get("spreadMultiplier"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_MULTIPLIER,
        ),
        swing_size=_mgann_swing_size_param(
            params.get("swingSize"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_SWING_SIZE,
        ),
        pivot_lookback_bars=_positive_int_param(
            params.get("pivotLookbackBars"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_LOOKBACK_BARS,
        ),
        min_pivot_cuts=_positive_int_param(
            params.get("minPivotCuts"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_CUTS,
        ),
        confirmation_bars=_nonnegative_int_param(
            params.get("confirmationBars"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_CONFIRMATION_BARS,
        ),
        break_ticks=_nonnegative_int_param(
            params.get("breakTicks"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_BREAK_TICKS,
        ),
        require_big_trade=_mgann_break_requires_big_trade(alert),
    )


def _mgann_break_requires_big_trade(alert: AlertRecord) -> bool:
    if alert.type == MGANN_BIG_TRADE_SWEEP:
        return True
    if alert.type == MGANN_SWEEP:
        return False
    return alert.params.get("requireBigTrade") is True

def _normalize_profile_id(value: str) -> str:
    value = value.strip()
    return value if value else "default"

def _positive_int_param(value: Any, default: int) -> int:
    if isinstance(value, bool):
        return default
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


def _mgann_swing_size_param(value: Any, default: int) -> int:
    parsed = _positive_int_param(value, default)
    return default if parsed == 2 else parsed


def _nonnegative_int_param(value: Any, default: int) -> int:
    if isinstance(value, bool):
        return default
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed >= 0 else default

def _positive_float_param(value: Any, default: float) -> float:
    if isinstance(value, bool):
        return default
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default
