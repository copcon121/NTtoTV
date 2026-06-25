"""REST_API endpoints for historical signals (e.g. Breakout FVG Confluence)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query

from ..engines.breakout_box_engine import BreakoutBoxEngine
from ..smc_ai.baseline import load_bars_for_signal_range
from ..storage.cache_store import CacheStore
from .contract_state import ContractStateStore
from .errors import bad_request, not_found
from .orderflow import get_cache
from .routes import _resolve_contract, get_contract_state

router = APIRouter(prefix="/api", tags=["signals"])

DEFAULT_SIGNAL_LIMIT = 500
SIGNAL_LIMIT_CAP = 1_000
DEFAULT_SIGNAL_WARMUP_BARS = 500

@router.get("/signals/breakout-fvg")
async def breakout_fvg_signals(
    symbol: str = Query("GC", description="User-facing symbol, e.g. 'GC'"),
    contract: str | None = Query(
        None,
        description="Chart cache contract. Defaults to the logical chart alias.",
    ),
    tf: str = Query("1m", description="Timeframe. v1 supports 1m only."),
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
    min_fvg_level: int = Query(
        3, alias="minFvgLevel", description="Minimum FVG grade (1-5)"
    ),
    state: ContractStateStore = Depends(get_contract_state),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    """Return historical Breakout + FVG Confluence signals.
    
    Loads historical 1m bars to run the BreakoutBoxEngine, and joins with
    historically persisted FvgSignalRecords to find confluence markers.
    """
    if not state.is_known_symbol(symbol):
        raise not_found(f"Unknown symbol {symbol!r}", field="symbol")
    if tf != "1m":
        raise not_found("Breakout signals currently support tf='1m'", field="tf")
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
    
    # Load 1m bars for breakout detection
    bars = load_bars_for_signal_range(
        cache.db_path,
        symbol=symbol,
        contract=resolved_contract,
        timeframe=tf,
        start_time=frm,
        end_time=to,
        warmup_bars=warmup_bars,
        latest_bars=warmup_bars if frm is None else None,
    )
    
    # Load historical FVG signals for the same range
    fvg_records = cache.read_fvg_signals(
        symbol=symbol,
        contract=resolved_contract,
        timeframe=tf,
        frm=bars[0].time if bars else frm,
        to=to,
        limit=5000  # Pull a large enough buffer of FVGs
    )
    
    # Group FVGs by bar time
    fvg_by_time = {}
    for rec in fvg_records:
        if rec.level >= min_fvg_level:
            if rec.time not in fvg_by_time:
                fvg_by_time[rec.time] = []
            fvg_by_time[rec.time].append(rec)
            
    engine = BreakoutBoxEngine()
    signals = []
    
    for bar in bars:
        # Step BreakoutBoxEngine
        events = engine.on_closed_bar(
            symbol=symbol,
            contract=resolved_contract,
            time=bar.time,
            open=bar.open,
            high=bar.high,
            low=bar.low,
            close=bar.close,
            volume=bar.volume
        )
        
        # Only keep events strictly within the requested [frm, to] window.
        if frm is not None and bar.time < frm:
            continue
        if to is not None and bar.time > to:
            continue
            
        # Check for FVG on the bar immediately preceding the breakout bar (to match live alert engine).
        fvg_time = bar.time - 60_000
        if events and fvg_time in fvg_by_time:
            bar_fvgs = fvg_by_time[fvg_time]
            for event in events:
                for fvg in bar_fvgs:
                    if fvg.direction == event.direction:
                        # Confluence found
                        is_long = event.direction == 1
                        signals.append({
                            "id": f"breakout-fvg-hist-{bar.time}-{event.direction}",
                            "time": bar.time,
                            "price": event.price,
                            "side": "long" if is_long else "short",
                            "zoneType": "fvg",
                            "huntType": "breakout",
                            "confirmation": "breakout_fvg",
                            "text": "BRK L" if is_long else "BRK S",
                        })
                        break # One signal per bar is enough
                        
    if len(signals) > effective_limit:
        signals = signals[-effective_limit:]
        
    return {
        "symbol": symbol,
        "contract": resolved_contract,
        "tf": tf,
        "source": "breakout-fvg-engine",
        "signals": signals
    }
