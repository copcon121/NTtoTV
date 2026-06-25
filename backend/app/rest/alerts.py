"""REST_API alert CRUD endpoints (task 18.1).

Implements the alert management surface of the REST API:

* ``GET    /api/alerts``        — list configured alerts (Req 18.8)
* ``POST   /api/alerts``        — create an alert (Req 18.9, 16.2)
* ``PATCH  /api/alerts/{id}``   — update enabled state / editable fields (Req 18.10, 16.4)
* ``DELETE /api/alerts/{id}``   — delete an alert (Req 18.11, 16.3)

All alert definitions persist to the Cache_Store ``alerts`` table via the
:class:`~app.storage.cache_store.CacheStore` alert CRUD methods. Failures are
rendered through the shared error envelope (Req 18.12): unknown ids yield ``404``
and malformed/invalid bodies yield ``400``/``422``.

The router resolves its Cache_Store from the request-scoped
:class:`~app.rest.contract_state.ContractStateStore` (which already owns the
process Cache_Store), so it shares one database with the rest of the REST API
and tests can inject a temporary store via ``app.state.contract_state``.
"""

from __future__ import annotations

import secrets
from typing import Any

from fastapi import APIRouter, Depends, Query, Request, Response

from ..engines.alert_engine import (
    ALERT_TYPES,
    LEVEL_ALERT_TYPES,
    SMC_DEFAULT_LOOKAHEAD_BARS,
    SMC_DEFAULT_MAX_BARS,
    SMC_DEFAULT_PAUSE_ON_INSIDE_BARS,
    SMC_DEFAULT_SWING_LENGTH,
    SMC_EXTERNAL_BREAK_BIG_TRADE,
    SMC_ZONE_DEFAULT_FVG_AUTO_THRESHOLD,
    SMC_ZONE_DEFAULT_FVG_THRESHOLD_LOOKBACK,
    SMC_ZONE_DEFAULT_FVG_THRESHOLD_MULTIPLIER,
    SMC_ZONE_DEFAULT_FVG_VOLUME_CONFIRMATION,
    SMC_ZONE_DEFAULT_MAX_ZONE_AGE,
    SMC_ZONE_TOUCH_BIG_TRADE,
    Alert,
    AlertEngine,
)
from ..models.timestamp import now_ms
from ..storage.cache_store import CacheStore
from ..storage.records import AlertRecord
from .contract_state import ContractStateStore
from .errors import bad_request, not_found, validation_error
from .routes import get_contract_state

router = APIRouter(prefix="/api", tags=["alerts"])


def get_cache(
    state: ContractStateStore = Depends(get_contract_state),
) -> CacheStore:
    """Provide the Cache_Store backing alert persistence (shared with REST)."""
    return state.cache


def _alert_to_dict(rec: AlertRecord) -> dict[str, Any]:
    """Serialize an :class:`AlertRecord` to the documented alert wire shape."""
    return {
        "id": rec.id,
        "profileId": rec.profile_id,
        "symbol": rec.symbol,
        "type": rec.type,
        "params": rec.params,
        "enabled": rec.enabled,
    }


def _new_alert_id() -> str:
    """Generate a short, collision-resistant alert id (``a_<hex>``)."""
    return f"a_{secrets.token_hex(4)}"


def _runtime_alert_engine(request: Request) -> AlertEngine | None:
    runtime = getattr(request.app.state, "runtime", None)
    pipeline = getattr(runtime, "pipeline", None)
    engine = getattr(pipeline, "alert_engine", None)
    return engine if isinstance(engine, AlertEngine) else None


def _normalize_profile_id(value: Any) -> str:
    if value is None:
        return "default"
    if not isinstance(value, str):
        raise validation_error("'profileId' must be a string", field="profileId")
    value = value.strip()
    if not value:
        raise validation_error("'profileId' must be a non-empty string", field="profileId")
    return value


def _validate_params(alert_type: str, params: Any) -> dict[str, Any]:
    """Validate a type's ``params`` payload, returning the normalized dict.

    Level-based alert types require a numeric ``level``; threshold types require
    a numeric ``threshold``. Raises a 422 validation error otherwise (Req 18.9).
    """
    if not isinstance(params, dict):
        raise validation_error("'params' must be an object", field="params")
    params = dict(params)

    if alert_type in LEVEL_ALERT_TYPES:
        level = params.get("level")
        if not isinstance(level, (int, float)) or isinstance(level, bool):
            raise validation_error(
                f"alert type {alert_type!r} requires a numeric 'level'",
                field="level",
            )
    elif alert_type in ("volume_delta_threshold", "big_trade_threshold"):
        threshold = params.get("threshold")
        if not isinstance(threshold, (int, float)) or isinstance(threshold, bool):
            raise validation_error(
                f"alert type {alert_type!r} requires a numeric 'threshold'",
                field="threshold",
            )
    elif alert_type in (SMC_EXTERNAL_BREAK_BIG_TRADE, SMC_ZONE_TOUCH_BIG_TRADE):
        threshold = params.get("bigTradeThreshold")
        if not isinstance(threshold, (int, float)) or isinstance(threshold, bool):
            raise validation_error(
                f"alert type {alert_type!r} requires a numeric 'bigTradeThreshold'",
                field="bigTradeThreshold",
            )
        if float(threshold) <= 0:
            raise validation_error(
                "'bigTradeThreshold' must be greater than zero",
                field="bigTradeThreshold",
            )
        if alert_type == SMC_ZONE_TOUCH_BIG_TRADE:
            for key in (
                "swingLength",
                "maxZoneAge",
                "fvgThresholdLookback",
                "fvgThresholdMultiplier",
            ):
                _validate_optional_positive_number(params, key)
            for key in ("fvgAutoThreshold", "fvgVolumeConfirmation"):
                value = params.get(key)
                if value is not None and not isinstance(value, bool):
                    raise validation_error(f"'{key}' must be a boolean", field=key)
            params["bigTradeThreshold"] = threshold
            params["swingLength"] = SMC_DEFAULT_SWING_LENGTH
            params["maxZoneAge"] = SMC_ZONE_DEFAULT_MAX_ZONE_AGE
            params["fvgAutoThreshold"] = SMC_ZONE_DEFAULT_FVG_AUTO_THRESHOLD
            params["fvgThresholdLookback"] = SMC_ZONE_DEFAULT_FVG_THRESHOLD_LOOKBACK
            params["fvgThresholdMultiplier"] = SMC_ZONE_DEFAULT_FVG_THRESHOLD_MULTIPLIER
            params["fvgVolumeConfirmation"] = SMC_ZONE_DEFAULT_FVG_VOLUME_CONFIRMATION
            return _validate_repeat_param(params)
        for key in (
            "swingLength",
            "lookaheadBars",
            "effectiveLookaheadBars",
            "maxBars",
        ):
            _validate_optional_positive_number(params, key)
        pause = params.get("pauseOnInsideBars")
        if pause is not None and not isinstance(pause, bool):
            raise validation_error(
                "'pauseOnInsideBars' must be a boolean",
                field="pauseOnInsideBars",
            )
        params["bigTradeThreshold"] = threshold
        params["swingLength"] = SMC_DEFAULT_SWING_LENGTH
        params["lookaheadBars"] = SMC_DEFAULT_LOOKAHEAD_BARS
        params["effectiveLookaheadBars"] = SMC_DEFAULT_LOOKAHEAD_BARS
        params["maxBars"] = SMC_DEFAULT_MAX_BARS
        params["pauseOnInsideBars"] = SMC_DEFAULT_PAUSE_ON_INSIDE_BARS
    elif alert_type == "breakout_fvg_confluence":
        level = params.get("minFvgLevel")
        if level is not None:
            if isinstance(level, bool) or not isinstance(level, (int, float)):
                raise validation_error(
                    "'minFvgLevel' must be numeric", field="minFvgLevel"
                )
            level = int(level)
            if level < 1 or level > 5:
                raise validation_error(
                    "'minFvgLevel' must be between 1 and 5",
                    field="minFvgLevel",
                )
            params["minFvgLevel"] = level
    # stacked_imbalance has no required params.
    return _validate_repeat_param(params)


def _validate_repeat_param(params: dict[str, Any]) -> dict[str, Any]:
    repeat = params.get("repeat")
    if repeat is not None and not isinstance(repeat, bool):
        raise validation_error("'repeat' must be a boolean", field="repeat")
    return params


def _validate_optional_positive_number(params: dict[str, Any], key: str) -> None:
    if key not in params:
        return
    value = params[key]
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise validation_error(f"'{key}' must be numeric", field=key)
    if float(value) <= 0:
        raise validation_error(f"'{key}' must be greater than zero", field=key)


@router.get("/alerts")
async def list_alerts(
    profile_id: str = Query("default", alias="profileId"),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    """Return the configured alerts. (Req 18.8)"""
    profile_id = _normalize_profile_id(profile_id)
    return {"alerts": [_alert_to_dict(a) for a in cache.read_alerts(profile_id=profile_id)]}


@router.post("/alerts", status_code=201)
async def create_alert(
    request: Request,
    state: ContractStateStore = Depends(get_contract_state),
) -> dict[str, Any]:
    """Create an alert from the request body. (Req 18.9, 16.2)

    * 400 ``BAD_REQUEST`` — body is not a JSON object;
    * 404 ``NOT_FOUND`` — unknown symbol (Req 18.12);
    * 422 ``VALIDATION_ERROR`` — missing/invalid ``type`` or ``params``.
    """
    try:
        body = await request.json()
    except Exception:
        raise bad_request("Request body must be valid JSON")
    if not isinstance(body, dict):
        raise bad_request("Request body must be a JSON object")

    symbol = body.get("symbol")
    alert_type = body.get("type")
    params = body.get("params", {})
    profile_id = _normalize_profile_id(body.get("profileId"))

    if not isinstance(symbol, str) or not symbol:
        raise validation_error("Missing or invalid field 'symbol'", field="symbol")
    if not state.is_known_symbol(symbol):
        raise not_found(f"Unknown symbol {symbol!r}", field="symbol")
    if not isinstance(alert_type, str) or alert_type not in ALERT_TYPES:
        raise validation_error(
            f"Unknown or missing alert 'type' {alert_type!r}", field="type"
        )
    params = _validate_params(alert_type, params)

    now = now_ms()
    rec = AlertRecord(
        id=_new_alert_id(),
        profile_id=profile_id,
        symbol=symbol,
        type=alert_type,
        params=params,
        enabled=bool(body.get("enabled", True)),
        created_at=now,
        updated_at=now,
    )
    state.cache.upsert_alert(rec)
    engine = _runtime_alert_engine(request)
    if engine is not None:
        engine.upsert(Alert.from_record(rec))
    return _alert_to_dict(rec)


@router.patch("/alerts/{alert_id}")
async def update_alert(
    alert_id: str,
    request: Request,
    profile_id: str = Query("default", alias="profileId"),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    """Update the enabled state and/or editable fields of an alert. (Req 18.10, 16.4)

    Only the supplied fields (``enabled`` and/or ``params``) are changed; the
    others are left intact. An unknown ``id`` yields 404 (Req 18.12).
    """
    profile_id = _normalize_profile_id(profile_id)
    existing = cache.read_alert(alert_id, profile_id)
    if existing is None:
        raise not_found(f"Unknown alert id {alert_id!r}", field="id")

    try:
        body = await request.json()
    except Exception:
        raise bad_request("Request body must be valid JSON")
    if not isinstance(body, dict):
        raise bad_request("Request body must be a JSON object")

    if "enabled" in body:
        enabled = body["enabled"]
        if not isinstance(enabled, bool):
            raise validation_error("'enabled' must be a boolean", field="enabled")
        existing.enabled = enabled
    if "params" in body:
        existing.params = _validate_params(existing.type, body["params"])

    existing.updated_at = now_ms()
    cache.upsert_alert(existing)
    engine = _runtime_alert_engine(request)
    if engine is not None:
        engine.upsert(Alert.from_record(existing))
    return _alert_to_dict(existing)


@router.delete("/alerts/{alert_id}", status_code=204)
async def delete_alert(
    alert_id: str,
    request: Request,
    profile_id: str = Query("default", alias="profileId"),
    cache: CacheStore = Depends(get_cache),
) -> Response:
    """Delete the alert identified by ``id``. (Req 18.11, 16.3)

    Unknown ids yield a 404 so the client learns the resource did not exist.
    """
    profile_id = _normalize_profile_id(profile_id)
    removed = cache.delete_alert(alert_id, profile_id)
    if not removed:
        raise not_found(f"Unknown alert id {alert_id!r}", field="id")
    engine = _runtime_alert_engine(request)
    if engine is not None:
        engine.delete(alert_id)
    return Response(status_code=204)
