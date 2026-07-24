"""Realtime market-source diagnostics."""

from fastapi import APIRouter, Request

from .errors import bad_request

router = APIRouter(prefix="/api/market-data", tags=["market-data"])


@router.get("/status")
async def market_data_status(request: Request) -> dict:
    runtime = getattr(request.app.state, "runtime", None)
    if runtime is None:
        raise bad_request("runtime is not available", field="runtime")
    return runtime.pipeline.market_data_status_dict()
