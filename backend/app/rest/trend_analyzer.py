"""Read-only TTW TrendAnalyzer history for the standalone ``/lq`` chart."""

from __future__ import annotations

from fastapi import APIRouter, Query, Request

from ..models.timestamp import now_ms
from .errors import bad_request

router = APIRouter(prefix="/api", tags=["trend-analyzer"])


@router.get("/trend-analyzer")
async def trend_analyzer_history(
    request: Request,
    symbol: str = Query("GC"),
    contract: str = Query("GC"),
    from_: int | None = Query(None, alias="from"),
    to: int | None = Query(None),
    limit: int = Query(50_000, ge=1, le=100_000),
) -> dict:
    end = now_ms() if to is None else int(to)
    start = end - 24 * 60 * 60 * 1_000 if from_ is None else int(from_)
    if start > end:
        raise bad_request("from must be less than or equal to to", field="from")
    runtime = getattr(request.app.state, "runtime", None)
    if runtime is None:
        history = {"points": [], "markers": []}
        source_contract = None
    else:
        engine = runtime.pipeline.trend_analyzer
        history = engine.history(start, end, limit=limit)
        source_contract = engine.source_contract
    return {
        "symbol": symbol,
        "contract": contract,
        "sourceContract": source_contract,
        "from": start,
        "to": end,
        "settings": {
            "candleInterval": "5m",
            "numberOfCandles": 15,
            "multiplier": 3.0,
            "switchTicks": 3,
        },
        **history,
    }

