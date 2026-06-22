"""Read-only SMC AI baseline signal endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query

from ..smc_ai.baseline import (
    BaselineConfig,
    load_bars_for_signal_range,
    run_baseline,
)
from .contract_state import ContractStateStore
from .errors import bad_request, not_found
from .routes import _resolve_contract, get_contract_state

router = APIRouter(prefix="/api", tags=["smc-ai"])

DEFAULT_SIGNAL_LIMIT = 500
SIGNAL_LIMIT_CAP = 1_000
DEFAULT_SIGNAL_WARMUP_BARS = 5_000
SIGNAL_WARMUP_CAP = 20_000


@router.get("/smc-ai/baseline-signals")
async def baseline_signals(
    symbol: str = Query("GC", description="User-facing symbol, e.g. 'GC'"),
    contract: str | None = Query(
        None,
        description="Chart cache contract. Defaults to the logical chart alias.",
    ),
    tf: str = Query("1m", description="Baseline timeframe. v1 supports 1m only."),
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
) -> dict[str, Any]:
    """Return Phase 0 baseline entry signals for chart markers.

    The endpoint is read-only and evaluates deterministic baseline logic over
    cached bars. It warms the detector on bars before the requested range, then
    returns only entry signals whose entry time falls inside ``[from, to]``.
    """
    if not state.is_known_symbol(symbol):
        raise not_found(f"Unknown symbol {symbol!r}", field="symbol")
    if tf != "1m":
        raise not_found("SMC baseline signals currently support tf='1m'", field="tf")
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
    effective_warmup = min(warmup_bars, SIGNAL_WARMUP_CAP)

    bars = load_bars_for_signal_range(
        state.cache.db_path,
        symbol=symbol,
        contract=resolved_contract,
        timeframe=tf,
        start_time=frm,
        end_time=to,
        warmup_bars=effective_warmup,
        latest_bars=effective_warmup if frm is None else None,
    )
    result = run_baseline(
        bars,
        BaselineConfig(symbol=symbol, contract=resolved_contract, timeframe=tf),
        include_trades=True,
    )
    all_trades = result.get("trades", [])
    signals = [
        _trade_to_signal(trade)
        for trade in all_trades
        if _inside_requested_range(trade, frm, to)
    ]
    if len(signals) > effective_limit:
        signals = signals[-effective_limit:]
    return {
        "symbol": symbol,
        "contract": resolved_contract,
        "tf": tf,
        "source": "baseline-cache",
        "warmupBars": effective_warmup,
        "signals": signals,
        "summary": {
            "totalSignals": len(signals),
            "evaluatedBars": result["data"]["bars"],
        },
    }


def _inside_requested_range(
    trade: dict[str, Any],
    frm: int | None,
    to: int | None,
) -> bool:
    time = int(trade["entry_time"])
    if frm is not None and time < frm:
        return False
    if to is not None and time > to:
        return False
    return True


def _trade_to_signal(trade: dict[str, Any]) -> dict[str, Any]:
    time = int(trade["entry_time"])
    side = str(trade["side"])
    zone_type = str(trade["zone_type"])
    outcome = str(trade["outcome"])
    label_side = "L" if side == "long" else "S"
    label_zone = zone_type.upper()
    return {
        "id": f"smc-ai:{time}:{side}:{zone_type}:{trade['entry_index']}",
        "time": time,
        "price": float(trade["entry_price"]),
        "side": side,
        "zoneType": zone_type,
        "huntType": trade["hunt_type"],
        "confirmation": trade["confirmation"],
        "outcome": outcome,
        "netR": trade["net_r"],
        "text": f"AI {label_side} {label_zone}",
    }
