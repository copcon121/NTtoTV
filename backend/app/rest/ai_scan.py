"""On-demand drawing candidates and suggestions for the active chart instrument."""

from __future__ import annotations

import logging
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, Query, Request

from ..ai_scan.detector import run_scan_ai
from ..ai_scan.models import (
    ALL_GROUPS,
    ALL_PATTERNS,
    ALL_STATES,
    SCAN_DENSITIES,
    SCAN_DEPTHS,
    SCAN_STRENGTHS,
    ScanAiRequest,
    ScanAiSuggestion,
    SuggestionGroup,
    SuggestionState,
    SuggestionStrength,
)
from ..instruments import instrument_catalog
from ..storage.tick_store import TickStore
from .contract_state import ContractStateStore
from .errors import bad_request, not_found
from .routes import CHART_TFS, _history_bars, _resolve_contract, get_contract_state, get_tick_store

router = APIRouter(prefix="/api", tags=["ai-scan"])
logger = logging.getLogger(__name__)

SUPPORTED_ANALYSES = {"trendline", "fibonacci", "elliott"}


def _suggestions_to_candidates(suggestions: list[ScanAiSuggestion]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for s in suggestions:
        cand_type = "trendline"
        if s.drawing_tool == "fib_retracement":
            cand_type = "fibonacci_retracement"
        elif s.drawing_tool == "horizontal_ray":
            cand_type = "trendline"
        elif s.group == "elliott" or s.type.startswith("elliott") or s.drawing_tool in ("path", "rectangle"):
            cand_type = "elliott_wave"

        candidates.append({
            "id": s.id,
            "type": cand_type,
            "label": s.name,
            "drawingTool": s.drawing_tool,
            "options": s.options,
            "anchors": [{"time": int(a.time * 1000), "price": a.price} for a in s.anchors],
            "technicalScore": s.score / 100.0,
            "score": s.score / 100.0,
            "explanation": s.description,
            "invalidIf": f"Invalidated at {s.invalidation_price:.1f}" if s.invalidation_price else "Break of structure",
            "note": None,
        })
    return candidates


@router.post("/ai-scan")
async def scan_chart(
    request: Request,
    state: ContractStateStore = Depends(get_contract_state),
    tick_store: TickStore = Depends(get_tick_store),
) -> dict[str, Any]:
    """Execute deterministic chart scanner on GC bars, returning suggestions and candidates."""
    try:
        body = await request.json()
    except Exception as exc:
        raise bad_request("Request body must be valid JSON") from exc
    if not isinstance(body, dict):
        raise bad_request("Request body must be a JSON object")

    catalog = instrument_catalog()
    instrument_id = body.get("instrumentId")
    if instrument_id:
        instrument = next((item for item in catalog if item["id"] == instrument_id), None)
        if instrument is None or not state.is_known_symbol(instrument["symbol"]):
            raise not_found("Unknown instrument", field="instrumentId")
        symbol = instrument["symbol"]
    else:
        symbol = str(body.get("symbol", catalog[0]["symbol"] if catalog else "GC"))
        if not state.is_known_symbol(symbol):
            raise not_found(f"Unknown symbol {symbol!r}", field="symbol")
        instrument = next((item for item in catalog if item["symbol"] == symbol), catalog[0] if catalog else {
            "id": symbol,
            "symbol": symbol,
            "displaySymbol": symbol,
            "venue": "CME",
        })

    requested_contract = body.get("contract", symbol)
    if not isinstance(requested_contract, str):
        raise bad_request("contract must be a string", field="contract")
    contract = _resolve_contract(state, symbol, requested_contract)

    timeframe = body.get("timeframe", "1m")
    if not isinstance(timeframe, str) or timeframe not in CHART_TFS:
        raise bad_request("Unsupported timeframe", field="timeframe")

    depth = body.get("depth", "medium")
    if not isinstance(depth, str) or depth not in SCAN_DEPTHS:
        raise bad_request("depth must be short, medium, or deep", field="depth")

    density = body.get("density", "normal")
    if density not in SCAN_DENSITIES:
        density = "normal"

    strength = body.get("strength", "moderate")
    if strength not in SCAN_STRENGTHS:
        strength = "moderate"

    targets_and_stop = bool(body.get("targetsAndStop", False))
    from_time = body.get("from")
    end_time = body.get("endTime") or body.get("to")
    if end_time is not None and (type(end_time) is not int or not 0 < end_time <= 9_007_199_254_740_991):
        raise bad_request("endTime must be a positive timestamp in milliseconds", field="endTime")

    states_input = body.get("states")
    if isinstance(states_input, list):
        states = [s for s in states_input if s in ALL_STATES]
    else:
        states = ["waiting", "in_play", "tested"]

    groups_input = body.get("groups")
    if isinstance(groups_input, list):
        groups = [g for g in groups_input if g in ALL_GROUPS]
    else:
        groups = list(ALL_GROUPS)

    patterns_input = body.get("patterns")
    if isinstance(patterns_input, list):
        patterns = [p for p in patterns_input if p in ALL_PATTERNS]
    else:
        patterns = list(ALL_PATTERNS)

    raw_analyses = body.get("analyses")

    return _process_ai_scan(
        state=state,
        tick_store=tick_store,
        instrument=instrument,
        symbol=symbol,
        contract=contract,
        tf=timeframe,
        depth=depth,
        density=density,
        strength=strength,
        states=states,
        groups=groups,
        patterns=patterns,
        targets_and_stop=targets_and_stop,
        from_time=from_time,
        to_time=end_time,
        raw_analyses=raw_analyses,
    )


@router.get("/ai-scan")
async def get_ai_scan(
    symbol: str = Query("GC"),
    contract: str = Query("GC"),
    tf: str = Query("1m", alias="timeframe"),
    depth: str = Query("medium"),
    density: str = Query("normal"),
    strength: str = Query("moderate"),
    targets_and_stop: bool = Query(False, alias="targetsAndStop"),
    frm: int | None = Query(None, alias="from"),
    to: int | None = Query(None),
    state: ContractStateStore = Depends(get_contract_state),
    tick_store: TickStore = Depends(get_tick_store),
) -> dict[str, Any]:
    """GET query variant for Scan AI."""
    catalog = instrument_catalog()
    instrument = next((item for item in catalog if item["symbol"] == symbol), catalog[0] if catalog else {
        "id": symbol,
        "symbol": symbol,
        "displaySymbol": symbol,
        "venue": "CME",
    })
    return _process_ai_scan(
        state=state,
        tick_store=tick_store,
        instrument=instrument,
        symbol=symbol,
        contract=contract,
        tf=tf,
        depth=depth,
        density=density,
        strength=strength,
        states=["waiting", "in_play", "tested"],
        groups=list(ALL_GROUPS),
        patterns=list(ALL_PATTERNS),
        targets_and_stop=targets_and_stop,
        from_time=frm,
        to_time=to,
        raw_analyses=None,
    )


def _process_ai_scan(
    *,
    state: ContractStateStore,
    tick_store: TickStore | None,
    instrument: dict[str, Any],
    symbol: str,
    contract: str,
    tf: str,
    depth: str,
    density: str,
    strength: str,
    states: list[SuggestionState],
    groups: list[SuggestionGroup],
    patterns: list[str],
    targets_and_stop: bool,
    from_time: int | None,
    to_time: int | None,
    raw_analyses: list[str] | None,
) -> dict[str, Any]:
    if not state.is_known_symbol(symbol):
        raise not_found(f"Unknown symbol {symbol!r}", field="symbol")

    resolved_contract = (
        symbol
        if contract is None or contract == ""
        else _resolve_contract(state, symbol, contract)
    )

    req = ScanAiRequest(
        symbol=symbol,
        contract=resolved_contract,
        timeframe=tf,
        depth=depth if depth in SCAN_DEPTHS else "medium",  # type: ignore[arg-type]
        density=density if density in SCAN_DENSITIES else "normal",  # type: ignore[arg-type]
        strength=strength if strength in SCAN_STRENGTHS else "all",  # type: ignore[arg-type]
        states=states,
        groups=groups,
        patterns=patterns,
        targets_and_stop=targets_and_stop,
        from_time=from_time,
        to_time=to_time,
    )

    limit = req.depth_bars
    bars = state.cache.read_bars(
        symbol,
        resolved_contract,
        tf,
        from_time,
        to_time,
        limit,
    )

    tick_size = 0.1  # GC tick size
    suggestions = run_scan_ai(bars, req, tick_size=tick_size)

    group_counts: dict[str, int] = {}
    for s in suggestions:
        group_counts[s.group] = group_counts.get(s.group, 0) + 1

    candidates = _suggestions_to_candidates(suggestions)
    if raw_analyses:
        analyses_set = set(raw_analyses)
        candidates = [
            c for c in candidates
            if (c["type"] == "trendline" and "trendline" in analyses_set)
            or (c["type"].startswith("fibonacci") and "fibonacci" in analyses_set)
            or (c["type"] == "elliott_wave" and "elliott" in analyses_set)
        ]

    return {
        "scanId": str(uuid4()),
        "instrumentId": instrument.get("id", symbol),
        "symbol": symbol,
        "displaySymbol": instrument.get("displaySymbol", symbol),
        "venue": instrument.get("venue", "CME"),
        "contract": resolved_contract,
        "timeframe": tf,
        "depth": req.depth,
        "density": req.density,
        "strength": req.strength,
        "aiAvailable": False,
        "rankingSource": "technical-fallback",
        "evaluatedBars": len(bars),
        "candidates": candidates,
        "suggestions": [s.to_dict() for s in suggestions],
        "summary": {
            "totalSuggestions": len(suggestions),
            "groupCounts": group_counts,
        },
    }
