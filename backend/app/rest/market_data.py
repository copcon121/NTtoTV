"""Realtime market-source diagnostics."""

from fastapi import APIRouter, Query, Request

from ..rithmic.client import RithmicProbeError
from .errors import bad_request, conflict, not_found

router = APIRouter(prefix="/api/market-data", tags=["market-data"])


@router.get("/status")
async def market_data_status(request: Request) -> dict:
    runtime = getattr(request.app.state, "runtime", None)
    if runtime is None:
        raise bad_request("runtime is not available", field="runtime")
    return runtime.pipeline.market_data_status_dict()


def _require_direct_loopback(request: Request) -> None:
    client_host = request.client.host if request.client is not None else ""
    forwarded = request.headers.get("forwarded") or request.headers.get(
        "x-forwarded-for"
    )
    if forwarded or client_host not in {"127.0.0.1", "::1", "testclient"}:
        # Do not advertise an operational probe on the public Caddy route.
        raise not_found("Route not found")


@router.post("/rithmic/options/probe")
async def probe_rithmic_options(
    request: Request,
    underlying: str | None = Query(default=None, min_length=1, max_length=32),
    exchange: str | None = Query(default=None, min_length=1, max_length=16),
    max_expiries: int = Query(default=3, ge=1, le=12),
) -> dict:
    """Probe futures-option reference data on the existing Rithmic session."""

    _require_direct_loopback(request)
    runtime = getattr(request.app.state, "runtime", None)
    if runtime is None:
        raise bad_request("runtime is not available", field="runtime")
    service = getattr(runtime, "rithmic_service", None)
    if service is None:
        raise conflict("Rithmic connector is not enabled")
    try:
        return await service.probe_options(
            underlying_symbol=underlying,
            exchange=exchange,
            max_expiries=max_expiries,
        )
    except ValueError as exc:
        raise bad_request(str(exc)) from exc
    except RithmicProbeError as exc:
        raise conflict(str(exc)) from exc
