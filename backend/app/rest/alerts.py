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
    LIQUIDITY_POOL_BREAK,
    LIQUIDITY_POOL_BREAK_TIMEFRAME,
    LIQUIDITY_POOL_BREAK_TIMEFRAMES,
    MGANN_BREAK_LS,
    MGANN_SWEEP,
    MGANN_BIG_TRADE_SWEEP,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_BIG_TRADE_THRESHOLD,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_BREAK_TICKS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_CONFIRMATION_BARS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_CUTS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_WICK_TICKS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_SPREAD_TICKS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_LIQUIDITY_ATR_MARGIN,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_LIQUIDITY_SWEEP_LOOKBACK_BARS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_LOOKBACK_BARS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_TOLERANCE_TICKS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_LOOKBACK,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_MULTIPLIER,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_SWING_SIZE,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_TIMEFRAME,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_DELTA_LOOKBACK,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_DELTA_MULTIPLIER,
    MGANN_BIG_TRADE_SWEEP_TIMEFRAMES,
    SMC_DEFAULT_LOOKAHEAD_BARS,
    SMC_DEFAULT_MAX_BARS,
    SMC_DEFAULT_PAUSE_ON_INSIDE_BARS,
    SMC_DEFAULT_RETEST_TOLERANCE_TICKS,
    SMC_DEFAULT_SWING_LENGTH,
    SMC_EXTERNAL_BREAK_BIG_TRADE,
    SWEEP_REVERSAL,
    Alert,
    AlertEngine,
)
from ..engines.sweep_reversal import (
    SWEEP_REVERSAL_DEFAULT_ATR_LENGTH,
    SWEEP_REVERSAL_DEFAULT_LIQUIDITY_ATR_LENGTH,
    SWEEP_REVERSAL_DEFAULT_LIQUIDITY_ATR_MARGIN,
    SWEEP_REVERSAL_DEFAULT_LIQUIDITY_LOOKBACK_BARS,
    SWEEP_REVERSAL_DEFAULT_LIQUIDITY_MIN_PIVOTS,
    SWEEP_REVERSAL_DEFAULT_MAX_CONFIRMATION_BARS,
    SWEEP_REVERSAL_DEFAULT_MIN_DISPLACEMENT_ATR,
    SWEEP_REVERSAL_DEFAULT_MIN_PENETRATION_ATR,
    SWEEP_REVERSAL_DEFAULT_STRUCTURE_LENGTH,
    SWEEP_REVERSAL_DEFAULT_SWING_LENGTH,
    SWEEP_REVERSAL_TIMEFRAMES,
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
    alert_type = _canonical_alert_type(rec.type)
    params = _canonical_alert_params(rec.type, rec.params)
    return {
        "id": rec.id,
        "profileId": rec.profile_id,
        "symbol": rec.symbol,
        "type": alert_type,
        "params": params,
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


def _canonical_alert_type(alert_type: str) -> str:
    if alert_type in (MGANN_BREAK_LS, MGANN_SWEEP, MGANN_BIG_TRADE_SWEEP):
        return MGANN_BREAK_LS
    return alert_type


def _canonical_alert_params(alert_type: str, params: dict[str, Any]) -> dict[str, Any]:
    out = dict(params)
    if alert_type == MGANN_BIG_TRADE_SWEEP:
        out["requireBigTrade"] = True
    elif alert_type == MGANN_SWEEP:
        out["requireBigTrade"] = False
    return out


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
    elif alert_type == SMC_EXTERNAL_BREAK_BIG_TRADE:
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
        for key in (
            "swingLength",
            "lookaheadBars",
            "effectiveLookaheadBars",
            "maxBars",
            "retestToleranceTicks",
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
        params["retestToleranceTicks"] = SMC_DEFAULT_RETEST_TOLERANCE_TICKS
    elif alert_type == SWEEP_REVERSAL:
        timeframe = params.get("timeframe", "1m")
        if not isinstance(timeframe, str) or timeframe not in SWEEP_REVERSAL_TIMEFRAMES:
            allowed = ", ".join(SWEEP_REVERSAL_TIMEFRAMES)
            raise validation_error(
                f"'timeframe' must be one of: {allowed}",
                field="timeframe",
            )
        equal_swing_filter = params.get("equalSwingFilter", False)
        if not isinstance(equal_swing_filter, bool):
            raise validation_error(
                "'equalSwingFilter' must be a boolean",
                field="equalSwingFilter",
            )
        for key in (
            "swingLength",
            "atrLength",
            "structureLength",
            "maxConfirmationBars",
            "liquidityMinPivots",
            "liquidityLookbackBars",
            "liquidityAtrLength",
            "liquidityAtrMargin",
        ):
            _validate_optional_positive_number(params, key)
        for key in ("minPenetrationAtr", "minDisplacementAtr"):
            _validate_optional_nonnegative_number(params, key)
        min_pivots = params.get(
            "liquidityMinPivots",
            SWEEP_REVERSAL_DEFAULT_LIQUIDITY_MIN_PIVOTS,
        )
        if isinstance(min_pivots, bool) or int(min_pivots) < 2:
            raise validation_error(
                "'liquidityMinPivots' must be at least 2",
                field="liquidityMinPivots",
            )
        params.update(
            {
                "timeframe": timeframe,
                "swingLength": int(params.get("swingLength", SWEEP_REVERSAL_DEFAULT_SWING_LENGTH)),
                "atrLength": int(params.get("atrLength", SWEEP_REVERSAL_DEFAULT_ATR_LENGTH)),
                "minPenetrationAtr": float(params.get("minPenetrationAtr", SWEEP_REVERSAL_DEFAULT_MIN_PENETRATION_ATR)),
                "structureLength": int(params.get("structureLength", SWEEP_REVERSAL_DEFAULT_STRUCTURE_LENGTH)),
                "maxConfirmationBars": int(params.get("maxConfirmationBars", SWEEP_REVERSAL_DEFAULT_MAX_CONFIRMATION_BARS)),
                "minDisplacementAtr": float(params.get("minDisplacementAtr", SWEEP_REVERSAL_DEFAULT_MIN_DISPLACEMENT_ATR)),
                "equalSwingFilter": equal_swing_filter,
                "liquidityMinPivots": int(min_pivots),
                "liquidityLookbackBars": int(params.get("liquidityLookbackBars", SWEEP_REVERSAL_DEFAULT_LIQUIDITY_LOOKBACK_BARS)),
                "liquidityAtrLength": int(params.get("liquidityAtrLength", SWEEP_REVERSAL_DEFAULT_LIQUIDITY_ATR_LENGTH)),
                "liquidityAtrMargin": float(params.get("liquidityAtrMargin", SWEEP_REVERSAL_DEFAULT_LIQUIDITY_ATR_MARGIN)),
                "repeat": params.get("repeat", True),
            }
        )
    elif alert_type == LIQUIDITY_POOL_BREAK:
        side = params.get("side", "both")
        if side not in ("both", "bsl", "ssl"):
            raise validation_error(
                "'side' must be one of: both, bsl, ssl",
                field="side",
            )
        timeframe = params.get("timeframe", LIQUIDITY_POOL_BREAK_TIMEFRAME)
        if (
            not isinstance(timeframe, str)
            or timeframe not in LIQUIDITY_POOL_BREAK_TIMEFRAMES
        ):
            allowed = ", ".join(LIQUIDITY_POOL_BREAK_TIMEFRAMES)
            raise validation_error(
                f"'timeframe' must be one of: {allowed}",
                field="timeframe",
            )
        for key in (
            "swingSize",
            "pivotLookbackBars",
            "minPivotCuts",
            "liquidityAtrMargin",
        ):
            _validate_optional_positive_number(params, key)
        raw_min_pivots = params.get(
            "minPivotCuts",
            MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_CUTS,
        )
        if isinstance(raw_min_pivots, bool) or float(raw_min_pivots) < 2:
            raise validation_error(
                "'minPivotCuts' must be at least 2",
                field="minPivotCuts",
            )
        params["side"] = side
        params["timeframe"] = timeframe
        params["swingSize"] = _normalize_mgann_swing_size(
            params,
            MGANN_BIG_TRADE_SWEEP_DEFAULT_SWING_SIZE,
        )
        params["pivotLookbackBars"] = params.get(
            "pivotLookbackBars",
            MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_LOOKBACK_BARS,
        )
        params["minPivotCuts"] = int(raw_min_pivots)
        params["liquidityAtrMargin"] = params.get(
            "liquidityAtrMargin",
            MGANN_BIG_TRADE_SWEEP_DEFAULT_LIQUIDITY_ATR_MARGIN,
        )
        params["liquiditySweepLookbackBars"] = params.get(
            "liquiditySweepLookbackBars",
            MGANN_BIG_TRADE_SWEEP_DEFAULT_LIQUIDITY_SWEEP_LOOKBACK_BARS,
        )
    elif alert_type in (MGANN_BREAK_LS, MGANN_SWEEP, MGANN_BIG_TRADE_SWEEP):
        params.pop("direction", None)
        params.pop("historySignalLimit", None)
        legacy_volume_lookback = params.pop("volumeLookback", None)
        legacy_volume_multiplier = params.pop("volumeMultiplier", None)
        params.pop("minVolume", None)
        if "volumeDeltaLookback" not in params and legacy_volume_lookback is not None:
            params["volumeDeltaLookback"] = legacy_volume_lookback
        if "volumeDeltaMultiplier" not in params and legacy_volume_multiplier is not None:
            params["volumeDeltaMultiplier"] = legacy_volume_multiplier
        require_big_trade = params.get("requireBigTrade", False)
        if alert_type == MGANN_BIG_TRADE_SWEEP:
            require_big_trade = True
        elif alert_type == MGANN_SWEEP:
            require_big_trade = False
        if not isinstance(require_big_trade, bool):
            raise validation_error(
                "'requireBigTrade' must be a boolean",
                field="requireBigTrade",
            )
        filter_liquidity = params.get("filterLiquidity", False)
        if not isinstance(filter_liquidity, bool):
            raise validation_error(
                "'filterLiquidity' must be a boolean",
                field="filterLiquidity",
            )
        liquidity_configured = any(
            key in params
            for key in (
                "filterLiquidity",
                "liquidityAtrMargin",
                "liquiditySweepLookbackBars",
            )
        )
        threshold = params.get(
            "bigTradeThreshold",
            MGANN_BIG_TRADE_SWEEP_DEFAULT_BIG_TRADE_THRESHOLD,
        )
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
        timeframe = params.get(
            "timeframe",
            MGANN_BIG_TRADE_SWEEP_DEFAULT_TIMEFRAME,
        )
        if (
            not isinstance(timeframe, str)
            or timeframe not in MGANN_BIG_TRADE_SWEEP_TIMEFRAMES
        ):
            allowed = ", ".join(MGANN_BIG_TRADE_SWEEP_TIMEFRAMES)
            raise validation_error(
                f"'timeframe' must be one of: {allowed}",
                field="timeframe",
            )
        params["requireBigTrade"] = require_big_trade
        if liquidity_configured:
            params["filterLiquidity"] = filter_liquidity
        params["bigTradeThreshold"] = threshold
        for key in (
            "volumeDeltaLookback",
            "spreadLookback",
            "swingSize",
            "pivotLookbackBars",
            "minPivotCuts",
            "liquidityAtrMargin",
            "liquiditySweepLookbackBars",
        ):
            _validate_optional_positive_number(params, key)
        for key in (
            "minSpreadTicks",
            "pivotToleranceTicks",
            "minPivotWickTicks",
            "confirmationBars",
            "breakTicks",
        ):
            _validate_optional_nonnegative_number(params, key)
        for key in ("volumeDeltaMultiplier", "spreadMultiplier"):
            _validate_optional_positive_number(params, key)
        params["timeframe"] = timeframe
        params["volumeDeltaLookback"] = params.get(
            "volumeDeltaLookback",
            MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_DELTA_LOOKBACK,
        )
        params["volumeDeltaMultiplier"] = params.get(
            "volumeDeltaMultiplier",
            MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_DELTA_MULTIPLIER,
        )
        params["minSpreadTicks"] = params.get(
            "minSpreadTicks",
            MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_SPREAD_TICKS,
        )
        params["spreadLookback"] = params.get(
            "spreadLookback",
            MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_LOOKBACK,
        )
        params["spreadMultiplier"] = params.get(
            "spreadMultiplier",
            MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_MULTIPLIER,
        )
        params["swingSize"] = _normalize_mgann_swing_size(
            params,
            MGANN_BIG_TRADE_SWEEP_DEFAULT_SWING_SIZE,
        )
        params["pivotLookbackBars"] = params.get(
            "pivotLookbackBars",
            MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_LOOKBACK_BARS,
        )
        params["minPivotCuts"] = params.get(
            "minPivotCuts",
            MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_CUTS,
        )
        params["pivotToleranceTicks"] = params.get(
            "pivotToleranceTicks",
            MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_TOLERANCE_TICKS,
        )
        params["minPivotWickTicks"] = params.get(
            "minPivotWickTicks",
            MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_WICK_TICKS,
        )
        params["confirmationBars"] = params.get(
            "confirmationBars",
            MGANN_BIG_TRADE_SWEEP_DEFAULT_CONFIRMATION_BARS,
        )
        params["breakTicks"] = params.get(
            "breakTicks",
            MGANN_BIG_TRADE_SWEEP_DEFAULT_BREAK_TICKS,
        )
        if liquidity_configured:
            params["liquidityAtrMargin"] = params.get(
                "liquidityAtrMargin",
                MGANN_BIG_TRADE_SWEEP_DEFAULT_LIQUIDITY_ATR_MARGIN,
            )
            params["liquiditySweepLookbackBars"] = params.get(
                "liquiditySweepLookbackBars",
                MGANN_BIG_TRADE_SWEEP_DEFAULT_LIQUIDITY_SWEEP_LOOKBACK_BARS,
            )
    # stacked_imbalance has no required params.
    return _validate_repeat_param(params)


def _validate_repeat_param(params: dict[str, Any]) -> dict[str, Any]:
    repeat = params.get("repeat")
    if repeat is not None and not isinstance(repeat, bool):
        raise validation_error("'repeat' must be a boolean", field="repeat")
    return params


def _normalize_mgann_swing_size(params: dict[str, Any], default: int) -> Any:
    raw = params.get("swingSize", default)
    try:
        parsed = int(raw)
    except (TypeError, ValueError):
        return default
    return default if parsed == 2 else raw


def _validate_optional_positive_number(params: dict[str, Any], key: str) -> None:
    if key not in params:
        return
    value = params[key]
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise validation_error(f"'{key}' must be numeric", field=key)
    if float(value) <= 0:
        raise validation_error(f"'{key}' must be greater than zero", field=key)

def _validate_optional_nonnegative_number(params: dict[str, Any], key: str) -> None:
    if key not in params:
        return
    value = params[key]
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise validation_error(f"'{key}' must be numeric", field=key)
    if float(value) < 0:
        raise validation_error(
            f"'{key}' must be greater than or equal to zero",
            field=key,
        )


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
    alert_type = _canonical_alert_type(alert_type)

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
        existing.type = _canonical_alert_type(existing.type)

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
