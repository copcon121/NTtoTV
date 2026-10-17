"""REST history for the standalone Bookmap liquidity chart."""

from __future__ import annotations

from fastapi import APIRouter, Query, Request

from ..config import settings as default_settings
from ..ingest.bookmap_endpoint import get_bookmap_control
from ..liquidity_settings import (
    LiquiditySettingsError,
    load_liquidity_settings,
    save_liquidity_settings,
    validate_liquidity_settings,
)
from ..models.timestamp import now_ms
from ..storage.cache_store import CacheStore
from ..storage.liquidity_store import LiquidityStore
from .errors import bad_request

router = APIRouter(prefix="/api", tags=["liquidity"])


def get_liquidity_store(request: Request) -> LiquidityStore:
    runtime = getattr(request.app.state, "runtime", None)
    if runtime is not None:
        return runtime.liquidity_store
    store = getattr(request.app.state, "liquidity_store", None)
    if store is None:
        store = LiquidityStore(default_settings.liquidity_db_path)
        request.app.state.liquidity_store = store
    return store


def get_cache(request: Request) -> CacheStore:
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


@router.get("/liquidity/settings")
async def liquidity_settings(request: Request) -> dict:
    return {"settings": load_liquidity_settings(get_cache(request))}


@router.put("/liquidity/settings")
async def update_liquidity_settings(request: Request) -> dict:
    try:
        body = await request.json()
    except Exception:
        raise bad_request("Request body must be valid JSON")
    if not isinstance(body, dict):
        raise bad_request("Request body must be a JSON object")
    cache = get_cache(request)
    current = load_liquidity_settings(cache)
    try:
        updated = validate_liquidity_settings(body, current=current)
    except LiquiditySettingsError as exc:
        raise bad_request(str(exc), field=exc.field)
    save_liquidity_settings(cache, updated)
    applied = await get_bookmap_control(request.app).send_liquidity_settings(updated)
    return {"settings": updated, "appliedToBookmap": applied}


@router.get("/liquidity")
async def liquidity_history(
    request: Request,
    symbol: str = Query("GC"),
    contract: str = Query("GC"),
    tf: str = Query("1m"),
    from_: int | None = Query(None, alias="from"),
    to: int | None = Query(None),
    limit: int = Query(10_000, ge=1, le=20_000),
) -> dict:
    if tf not in {"1m", "5m"}:
        raise bad_request("Liquidity chart supports only 1m and 5m", field="tf")
    end = now_ms() if to is None else int(to)
    retention_ms = default_settings.liquidity_retention_hours * 60 * 60 * 1000
    start = end - retention_ms if from_ is None else int(from_)
    if start > end:
        raise bad_request("from must be less than or equal to to", field="from")
    store = get_liquidity_store(request)
    events, lines = store.read(symbol, contract, start, end, limit=limit)
    bucket_ms = 60_000 if tf == "1m" else 300_000
    for event in events:
        event["bucketTime"] = event["time"] - event["time"] % bucket_ms
    return {
        "symbol": symbol,
        "contract": contract,
        "tf": tf,
        "from": start,
        "to": end,
        "retentionHours": default_settings.liquidity_retention_hours,
        "events": events,
        "lines": lines,
    }
