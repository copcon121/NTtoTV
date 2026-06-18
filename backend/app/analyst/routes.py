"""REST endpoints for analyst reports."""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING, Any

from fastapi import APIRouter, Depends, Query, Request

from ..config import settings as default_settings
from ..models.auth import AuthenticatedUser
from ..rest.auth import get_current_user
from ..rest.contract_state import ContractStateStore
from ..rest.errors import bad_request, not_found
from ..rest.notifications import send_telegram_analyst_report
from ..rest.routes import get_contract_state
from .llm_client import AnalystLlmClient
from .poi_models import PoiEvent
from .scheduler import run_analyst_once
from .store import AnalystStore

router = APIRouter(prefix="/api/analyst", tags=["analyst"])
logger = logging.getLogger(__name__)

MAX_REPORT_LIMIT = 200
AUTO_SEND_REPLACED_REASON = (
    "30-minute auto analyst has been replaced by event-driven POI scanner"
)

if TYPE_CHECKING:
    from ..runtime import AppRuntime


def get_analyst_store(request: Request) -> AnalystStore | None:
    store = getattr(request.app.state, "analyst_store", None)
    if store is not None:
        return store
    runtime: "AppRuntime | None" = getattr(request.app.state, "runtime", None)
    if runtime is not None and runtime.analyst_store is not None:
        return runtime.analyst_store
    if not default_settings.analyst_db_path.exists():
        return None
    store = AnalystStore(default_settings.analyst_db_path)
    request.app.state.analyst_store = store
    return store


def get_or_create_analyst_store(request: Request) -> AnalystStore:
    store = get_analyst_store(request)
    if store is not None:
        return store
    store = AnalystStore(default_settings.analyst_db_path)
    request.app.state.analyst_store = store
    return store


def get_analyst_llm_client(request: Request) -> AnalystLlmClient:
    client = getattr(request.app.state, "analyst_llm_client", None)
    if client is not None:
        return client
    client = AnalystLlmClient.from_settings(default_settings)
    request.app.state.analyst_llm_client = client
    return client


def _runtime_auto_send_state(runtime: "AppRuntime | None") -> dict[str, Any]:
    return {
        "available": False,
        "enabled": False,
        "reason": AUTO_SEND_REPLACED_REASON,
    }


def _normalize_profile_id(value: str) -> str:
    normalized = (value or "").strip()
    return normalized or "default"


def _event_ai_state(
    *,
    store: AnalystStore,
    user: AuthenticatedUser,
    profile_id: str,
    llm_client: AnalystLlmClient,
) -> dict[str, Any]:
    enabled = store.get_event_ai_enabled(user.id, profile_id)
    available = llm_client.enabled
    return {
        "available": available,
        "enabled": enabled,
        "profileId": profile_id,
        "providerMode": "real",
        "llmEnabled": llm_client.enabled,
        "reason": None if available else "Analyst LLM is not configured",
    }


def _poi_event_as_report(event: PoiEvent) -> dict[str, Any] | None:
    if event.response is None or event.provider_mode != "real":
        return None
    response = event.response
    reason = response.get("reason", [])
    if isinstance(reason, str):
        reason = [reason]
    if not isinstance(reason, list) or not reason:
        reason = ["POI event AI không trả lý do cụ thể."]
    decision = str(response.get("decision", event.decision or "no_trade"))
    risk_state = str(
        response.get(
            "riskState",
            "candidate"
            if decision.endswith("_candidate")
            else ("wait" if decision.startswith("wait_") else "no_trade"),
        )
    )
    confidence = event.confidence
    if confidence is None:
        try:
            confidence = float(response.get("confidence", 0.0))
        except (TypeError, ValueError):
            confidence = 0.0
    return {
        "reportId": f"poi:{event.event_id}",
        "snapshotId": f"poi:{event.event_id}",
        "symbol": event.symbol,
        "contract": event.contract,
        "createdAt": event.created_at,
        "bias": str(response.get("bias", "unknown")),
        "decision": decision,
        "confidence": confidence,
        "reason": [str(item) for item in reason[:5]],
        "invalidIf": str(response.get("invalidIf", "")),
        "nextConfirmation": str(response.get("nextConfirmation", "")),
        "riskState": risk_state,
        "allowedToAlert": bool(response.get("allowedToAlert", False)),
        "allowedToAutoTrade": False,
        "rawResponse": {
            **response,
            "source": "poi_event",
            "eventId": event.event_id,
            "eventType": event.event_type,
            "providerName": event.provider_name,
            "providerMode": event.provider_mode,
        },
    }


@router.get("/auto-send")
async def auto_send_state(request: Request) -> dict[str, Any]:
    runtime: "AppRuntime | None" = getattr(request.app.state, "runtime", None)
    return _runtime_auto_send_state(runtime)


@router.put("/auto-send")
async def set_auto_send_state(request: Request) -> dict[str, Any]:
    try:
        body = await request.json()
    except Exception:
        raise bad_request("Request body must be JSON", field="enabled")
    if not isinstance(body, dict) or not isinstance(body.get("enabled"), bool):
        raise bad_request("'enabled' must be a boolean", field="enabled")
    return _runtime_auto_send_state(getattr(request.app.state, "runtime", None))


@router.get("/event-ai")
async def event_ai_state(
    profile_id: str = Query("default", alias="profileId"),
    user: AuthenticatedUser = Depends(get_current_user),
    store: AnalystStore = Depends(get_or_create_analyst_store),
    llm_client: AnalystLlmClient = Depends(get_analyst_llm_client),
) -> dict[str, Any]:
    return _event_ai_state(
        store=store,
        user=user,
        profile_id=_normalize_profile_id(profile_id),
        llm_client=llm_client,
    )


@router.put("/event-ai")
async def set_event_ai_state(
    request: Request,
    profile_id: str = Query("default", alias="profileId"),
    user: AuthenticatedUser = Depends(get_current_user),
    store: AnalystStore = Depends(get_or_create_analyst_store),
    llm_client: AnalystLlmClient = Depends(get_analyst_llm_client),
) -> dict[str, Any]:
    try:
        body = await request.json()
    except Exception:
        raise bad_request("Request body must be JSON", field="enabled")
    if not isinstance(body, dict) or not isinstance(body.get("enabled"), bool):
        raise bad_request("'enabled' must be a boolean", field="enabled")
    enabled = bool(body["enabled"])
    if enabled and not llm_client.enabled:
        raise bad_request("Analyst LLM is not configured", field="enabled")
    normalized_profile_id = _normalize_profile_id(profile_id)
    store.set_event_ai_enabled(user.id, normalized_profile_id, enabled)
    return _event_ai_state(
        store=store,
        user=user,
        profile_id=normalized_profile_id,
        llm_client=llm_client,
    )


@router.get("/latest")
async def latest_report(
    symbol: str = Query("GC"),
    contract: str = Query("GC"),
    store: AnalystStore | None = Depends(get_analyst_store),
) -> dict[str, Any]:
    if store is None:
        return {"report": None}
    report = store.latest_report(symbol, contract)
    manual_report = None if report is None else report.to_dict()
    latest_event_report = None
    for event in store.poi_events(symbol, contract, limit=20):
        latest_event_report = _poi_event_as_report(event)
        if latest_event_report is not None:
            break
    if latest_event_report is None:
        return {"report": manual_report}
    if manual_report is None:
        return {"report": latest_event_report}
    if int(latest_event_report["createdAt"]) > int(manual_report["createdAt"]):
        return {"report": latest_event_report}
    return {"report": manual_report}


@router.post("/run")
async def run_report(
    symbol: str = Query("GC"),
    contract: str = Query("GC"),
    profile_id: str = Query("default", alias="profileId"),
    user: AuthenticatedUser = Depends(get_current_user),
    state: ContractStateStore = Depends(get_contract_state),
    store: AnalystStore = Depends(get_or_create_analyst_store),
    llm_client: AnalystLlmClient = Depends(get_analyst_llm_client),
) -> dict[str, Any]:
    _ = user
    if not state.is_known_symbol(symbol):
        raise not_found(f"Unknown symbol {symbol!r}", field="symbol")
    if contract != symbol and not state.is_candidate(symbol, contract):
        raise not_found(
            f"Unknown contract {contract!r} for symbol {symbol!r}",
            field="contract",
        )

    result = await run_analyst_once(
        cache=state.cache,
        store=store,
        llm_client=llm_client,
        symbol=symbol,
        contract=contract,
        reasoning_effort=default_settings.llm_manual_reasoning_effort,
    )
    telegram_result: dict[str, Any] = {"sent": False, "reason": "no_report"}
    if result.report is not None:
        try:
            telegram_result = await asyncio.to_thread(
                send_telegram_analyst_report,
                state.cache,
                _normalize_profile_id(profile_id),
                result.report,
            )
        except Exception as exc:
            logger.warning("analyst Telegram notification failed: %s", exc)
            telegram_result = {"sent": False, "reason": str(exc)}
    return {
        "snapshot": result.snapshot.to_dict(),
        "report": None if result.report is None else result.report.to_dict(),
        "llmEnabled": result.llm_enabled,
        "error": result.error,
        "telegram": telegram_result,
    }


@router.get("/reports")
async def reports(
    symbol: str = Query("GC"),
    contract: str = Query("GC"),
    limit: int = Query(20),
    store: AnalystStore | None = Depends(get_analyst_store),
) -> dict[str, Any]:
    if limit < 1:
        raise bad_request("'limit' must be a positive integer", field="limit")
    if store is None:
        return {"reports": []}
    effective_limit = min(limit, MAX_REPORT_LIMIT)
    return {
        "reports": [
            report.to_dict()
            for report in store.reports(symbol, contract, limit=effective_limit)
        ]
    }


@router.get("/poi-events")
async def poi_events(
    symbol: str = Query("GC"),
    contract: str = Query("GC"),
    limit: int = Query(50),
    store: AnalystStore | None = Depends(get_analyst_store),
) -> dict[str, Any]:
    if limit < 1:
        raise bad_request("'limit' must be a positive integer", field="limit")
    if store is None:
        return {"events": []}
    effective_limit = min(limit, MAX_REPORT_LIMIT)
    return {
        "events": [
            event.to_dict()
            for event in store.poi_events(
                symbol,
                contract,
                limit=effective_limit,
            )
        ]
    }


@router.get("/poi-state")
async def poi_state(
    symbol: str = Query("GC"),
    contract: str = Query("GC"),
    store: AnalystStore | None = Depends(get_analyst_store),
) -> dict[str, Any]:
    if store is None:
        return {"zones": []}
    return {
        "zones": [zone.to_dict() for zone in store.poi_zones(symbol, contract)]
    }
