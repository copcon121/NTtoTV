"""Persistent, validated settings for Bookmap liquidity detection."""

from __future__ import annotations

import json
from typing import Any

from .models.timestamp import now_ms
from .storage.cache_store import CacheStore

LIQUIDITY_SETTINGS_META_KEY = "bookmap.liquidity.settings.v1"

DEFAULT_LIQUIDITY_SETTINGS: dict[str, bool | int] = {
    "relativeEnabled": True,
    "relativeTrigger": 300,
    "relativeDomFrom": 20,
    "relativeDomTo": 80,
    "absoluteEnabled": True,
    "absoluteTrigger": 500,
    "absoluteDomFrom": 1,
    "absoluteDomTo": 10,
    "longTermEnabled": True,
    "longTermTrigger": 500,
    "longTermDomFrom": 1,
    "longTermDomTo": 80,
    "longTermMinAgeSeconds": 30,
}

_BOOLEAN_FIELDS = {
    "relativeEnabled",
    "absoluteEnabled",
    "longTermEnabled",
}
_INTEGER_LIMITS: dict[str, tuple[int, int]] = {
    "relativeTrigger": (1, 1_000_000),
    "relativeDomFrom": (0, 5_000),
    "relativeDomTo": (0, 5_000),
    "absoluteTrigger": (1, 1_000_000),
    "absoluteDomFrom": (0, 5_000),
    "absoluteDomTo": (0, 5_000),
    "longTermTrigger": (1, 1_000_000),
    "longTermDomFrom": (0, 5_000),
    "longTermDomTo": (0, 5_000),
    "longTermMinAgeSeconds": (1, 3_600),
}


class LiquiditySettingsError(ValueError):
    def __init__(self, field: str, message: str) -> None:
        super().__init__(message)
        self.field = field


def load_liquidity_settings(cache: CacheStore) -> dict[str, bool | int]:
    raw = cache.get_metadata(LIQUIDITY_SETTINGS_META_KEY)
    if not raw:
        return dict(DEFAULT_LIQUIDITY_SETTINGS)
    try:
        stored = json.loads(raw)
    except (TypeError, ValueError):
        return dict(DEFAULT_LIQUIDITY_SETTINGS)
    if not isinstance(stored, dict):
        return dict(DEFAULT_LIQUIDITY_SETTINGS)
    try:
        return validate_liquidity_settings(stored, allow_partial=True)
    except LiquiditySettingsError:
        return dict(DEFAULT_LIQUIDITY_SETTINGS)


def validate_liquidity_settings(
    values: dict[str, Any],
    *,
    current: dict[str, bool | int] | None = None,
    allow_partial: bool = False,
) -> dict[str, bool | int]:
    result = dict(DEFAULT_LIQUIDITY_SETTINGS if current is None else current)
    known = set(DEFAULT_LIQUIDITY_SETTINGS)
    for field, value in values.items():
        if field not in known:
            if allow_partial:
                continue
            raise LiquiditySettingsError(field, f"Unknown liquidity setting {field!r}")
        if field in _BOOLEAN_FIELDS:
            if not isinstance(value, bool):
                raise LiquiditySettingsError(field, f"{field} must be boolean")
            result[field] = value
            continue
        if isinstance(value, bool) or not isinstance(value, int):
            raise LiquiditySettingsError(field, f"{field} must be an integer")
        low, high = _INTEGER_LIMITS[field]
        if value < low or value > high:
            raise LiquiditySettingsError(
                field,
                f"{field} must be between {low} and {high}",
            )
        result[field] = value

    for prefix in ("relative", "absolute", "longTerm"):
        from_field = f"{prefix}DomFrom"
        to_field = f"{prefix}DomTo"
        if int(result[from_field]) > int(result[to_field]):
            raise LiquiditySettingsError(
                to_field,
                f"{to_field} must be greater than or equal to {from_field}",
            )
    return result


def save_liquidity_settings(
    cache: CacheStore,
    settings: dict[str, bool | int],
) -> None:
    cache.set_metadata(
        LIQUIDITY_SETTINGS_META_KEY,
        json.dumps(settings, separators=(",", ":"), sort_keys=True),
        now_ms(),
    )


def liquidity_control_frame(settings: dict[str, bool | int]) -> dict[str, Any]:
    return {
        "type": "liquidity_config",
        **settings,
        "longTermMinAgeMs": int(settings["longTermMinAgeSeconds"]) * 1_000,
        "longTermUpdateSize": 50,
        "longTermUpdateIntervalMs": 500,
    }
