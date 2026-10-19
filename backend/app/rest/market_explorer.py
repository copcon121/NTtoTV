"""REST settings and in-memory history for Market Explorer on ``/lq``."""

from __future__ import annotations

from fastapi import APIRouter, Query, Request

from ..config import settings as default_settings
from ..market_explorer_settings import (
    MarketExplorerSettingsError,
    load_market_explorer_settings,
    save_market_explorer_settings,
    validate_market_explorer_settings,
)
from ..models.timestamp import now_ms
from ..storage.cache_store import CacheStore
from .errors import bad_request

router = APIRouter(prefix="/api", tags=["market-explorer"])


def _cache(request: Request) -> CacheStore:
    runtime = getattr(request.app.state, "runtime", None)
    if runtime is not None:
        return runtime.cache
    contract_state = getattr(request.app.state, "contract_state", None)
    if contract_state is not None:
        return contract_state.cache
    cache = getattr(request.app.state, "cache", None)
    if cache is None:
        cache = CacheStore.open(default_settings)
        request.app.state.cache = cache
    return cache


@router.get("/market-explorer/settings")
async def market_explorer_settings(request: Request) -> dict:
    runtime = getattr(request.app.state, "runtime", None)
    settings = (
        runtime.pipeline.market_explorer.settings_snapshot()
        if runtime is not None
        else load_market_explorer_settings(_cache(request))
    )
    return {"settings": settings}


@router.put("/market-explorer/settings")
async def update_market_explorer_settings(request: Request) -> dict:
    try:
        body = await request.json()
    except Exception:
        raise bad_request("Request body must be valid JSON")
    if not isinstance(body, dict):
        raise bad_request("Request body must be a JSON object")
    cache = _cache(request)
    runtime = getattr(request.app.state, "runtime", None)
    current = (
        runtime.pipeline.market_explorer.settings_snapshot()
        if runtime is not None
        else load_market_explorer_settings(cache)
    )
    try:
        updated = validate_market_explorer_settings(body, current=current)
    except MarketExplorerSettingsError as exc:
        raise bad_request(str(exc), field=exc.field)
    save_market_explorer_settings(cache, updated)
    if runtime is not None:
        runtime.pipeline.configure_market_explorer(updated)
    return {"settings": updated}


@router.get("/market-explorer")
async def market_explorer_history(
    request: Request,
    symbol: str = Query("GC"),
    contract: str = Query("GC"),
    from_: int | None = Query(None, alias="from"),
    to: int | None = Query(None),
    limit: int = Query(20_000, ge=1, le=50_000),
) -> dict:
    end = now_ms() if to is None else int(to)
    start = end - 12 * 60 * 60 * 1_000 if from_ is None else int(from_)
    if start > end:
        raise bad_request("from must be less than or equal to to", field="from")
    runtime = getattr(request.app.state, "runtime", None)
    if runtime is None:
        history = {"samples": [], "signals": []}
        source_contract = None
    else:
        engine = runtime.pipeline.market_explorer
        history = engine.history(start, end, limit=limit)
        source_contract = engine.source_contract
    return {
        "symbol": symbol,
        "contract": contract,
        "sourceContract": source_contract,
        "from": start,
        "to": end,
        **history,
    }
