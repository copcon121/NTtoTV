"""Persistent settings for the TTW-style Market Explorer port."""

from __future__ import annotations

from copy import deepcopy
import json
import re
from typing import Any

from .models.timestamp import now_ms
from .storage.cache_store import CacheStore

MARKET_EXPLORER_SETTINGS_META_KEY = "rithmic.market_explorer.settings.v2"
_LEGACY_SETTINGS_META_KEY = "bookmap.market_explorer.settings.v1"

_MARKER_DEFAULTS: dict[str, Any] = {
    "enabled": True,
    "buyColor": "#20bea6",
    "sellColor": "#ef4050",
    "markerShape": "triangle",
    "markerSize": 2,
    "variableSize": False,
    "alertSound": False,
    "alertMessage": "disabled",
}

_DEFAULT_MARKET_VOLUME_STOP: dict[str, Any] = {
    **deepcopy(_MARKER_DEFAULTS),
    "askLevel": 500.0,
    "bidLevel": 500.0,
    "displayMode": "standard",
    "pullbackDurationMinutes": 0,
    "pullbackPriceChangeTicks": 0,
    # Match the installed TTW signal preview rather than the shared defaults.
    "buyColor": "#ef4048",
    "sellColor": "#edf2f4",
}

_DEFAULT_VOLUME_SPIKE: dict[str, Any] = {
    **deepcopy(_MARKER_DEFAULTS),
    "triggerVolume": 800.0,
    "maximumDurationSeconds": 1.0,
    "priceRangeTicks": 8,
    "ratioGreaterEqual": 10.0,
}

_DEFAULT_ABSORPTION: dict[str, Any] = {
    **deepcopy(_MARKER_DEFAULTS),
    "triggerVolume": 1000.0,
    "maximumDurationSeconds": 1.0,
    # TTW calls this the buy absorption style even though buy aggression being
    # absorbed is a bearish marker.  Keep its red/down visual convention.
    "buyColor": "#ef4050",
    "sellColor": "#51bea2",
    "markerShape": "flag",
}

DEFAULT_MARKET_EXPLORER_SETTINGS: dict[str, Any] = {
    "lineEnabled": True,
    "halftimeSeconds": 60,
    "buyLineColor": "#20bea6",
    "sellLineColor": "#ef4050",
    "signal": deepcopy(_DEFAULT_MARKET_VOLUME_STOP),
    "volumeSpike": deepcopy(_DEFAULT_VOLUME_SPIKE),
    "absorption": deepcopy(_DEFAULT_ABSORPTION),
}

_HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
_TOP_FIELDS = frozenset(DEFAULT_MARKET_EXPLORER_SETTINGS)
_MARKER_FIELDS = frozenset(_MARKER_DEFAULTS)
_MARKET_VOLUME_STOP_FIELDS = frozenset(_DEFAULT_MARKET_VOLUME_STOP)
_VOLUME_SPIKE_FIELDS = frozenset(_DEFAULT_VOLUME_SPIKE)
_ABSORPTION_FIELDS = frozenset(_DEFAULT_ABSORPTION)


class MarketExplorerSettingsError(ValueError):
    def __init__(self, field: str, message: str) -> None:
        super().__init__(message)
        self.field = field


def default_market_explorer_settings() -> dict[str, Any]:
    return deepcopy(DEFAULT_MARKET_EXPLORER_SETTINGS)


def _migrate_stored_settings(stored: dict[str, Any]) -> dict[str, Any]:
    """Read the previous three-MV-signal schema without exposing it again."""
    migrated = deepcopy(stored)
    legacy_signals = migrated.pop("signals", None)
    if "signal" not in migrated and isinstance(legacy_signals, list) and legacy_signals:
        first = legacy_signals[0]
        if isinstance(first, dict):
            migrated["signal"] = {
                key: value
                for key, value in first.items()
                if key in _MARKET_VOLUME_STOP_FIELDS
            }
    for section in ("signal", "volumeSpike", "absorption"):
        value = migrated.get(section)
        if isinstance(value, dict):
            if "alertMessage" not in value and "bookmapAlertMessage" in value:
                value["alertMessage"] = value.pop("bookmapAlertMessage")
            # Telegram is intentionally not part of this port.
            value.pop("telegramNotification", None)
    return migrated


def load_market_explorer_settings(cache: CacheStore) -> dict[str, Any]:
    raw = cache.get_metadata(MARKET_EXPLORER_SETTINGS_META_KEY)
    if not raw:
        raw = cache.get_metadata(_LEGACY_SETTINGS_META_KEY)
    if not raw:
        return default_market_explorer_settings()
    try:
        stored = json.loads(raw)
        if not isinstance(stored, dict):
            raise ValueError("settings are not an object")
        return validate_market_explorer_settings(
            _migrate_stored_settings(stored), allow_partial=True
        )
    except (TypeError, ValueError, MarketExplorerSettingsError):
        return default_market_explorer_settings()


def _number(
    value: Any,
    *,
    field: str,
    low: float,
    high: float,
    integer: bool = False,
) -> int | float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        kind = "an integer" if integer else "a number"
        raise MarketExplorerSettingsError(field, f"{field} must be {kind}")
    if integer and not isinstance(value, int):
        raise MarketExplorerSettingsError(field, f"{field} must be an integer")
    if not low <= float(value) <= high:
        raise MarketExplorerSettingsError(
            field, f"{field} must be between {low:g} and {high:g}"
        )
    return int(value) if integer else float(value)


def _validate_color(value: Any, field: str) -> str:
    if not isinstance(value, str) or _HEX_COLOR.fullmatch(value) is None:
        raise MarketExplorerSettingsError(field, f"{field} must be a #RRGGBB color")
    return value.lower()


def _validate_marker_fields(
    value: dict[str, Any], result: dict[str, Any], prefix: str
) -> None:
    for field in _MARKER_FIELDS & value.keys():
        raw = value[field]
        path = f"{prefix}.{field}"
        if field in {"enabled", "variableSize", "alertSound"}:
            if not isinstance(raw, bool):
                raise MarketExplorerSettingsError(path, f"{path} must be boolean")
            result[field] = raw
        elif field in {"buyColor", "sellColor"}:
            result[field] = _validate_color(raw, path)
        elif field == "markerShape":
            if raw not in {"arrow", "triangle", "circle", "flag"}:
                raise MarketExplorerSettingsError(path, f"Unsupported marker shape {raw!r}")
            result[field] = raw
        elif field == "markerSize":
            result[field] = _number(raw, field=path, low=1, high=5, integer=True)
        elif field == "alertMessage":
            if raw not in {"disabled", "enabled"}:
                raise MarketExplorerSettingsError(
                    path, f"{path} must be 'disabled' or 'enabled'"
                )
            result[field] = raw


def _validate_section(
    value: Any,
    *,
    prefix: str,
    defaults: dict[str, Any],
    fields: frozenset[str],
) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise MarketExplorerSettingsError(prefix, f"{prefix} must be an object")
    unknown = set(value) - fields
    if unknown:
        field = sorted(unknown)[0]
        raise MarketExplorerSettingsError(
            f"{prefix}.{field}", f"Unknown Market Explorer setting {field!r}"
        )
    result = deepcopy(defaults)
    _validate_marker_fields(value, result, prefix)
    return result


def _validate_market_volume_stop(value: Any) -> dict[str, Any]:
    prefix = "signal"
    result = _validate_section(
        value,
        prefix=prefix,
        defaults=_DEFAULT_MARKET_VOLUME_STOP,
        fields=_MARKET_VOLUME_STOP_FIELDS,
    )
    for field, raw in value.items():
        path = f"{prefix}.{field}"
        if field in {"askLevel", "bidLevel"}:
            result[field] = _number(raw, field=path, low=0.01, high=10_000_000)
        elif field == "pullbackDurationMinutes":
            result[field] = _number(raw, field=path, low=0, high=1_440, integer=True)
        elif field == "pullbackPriceChangeTicks":
            result[field] = _number(raw, field=path, low=0, high=100_000, integer=True)
        elif field == "displayMode":
            if raw not in {"standard", "immediately"}:
                raise MarketExplorerSettingsError(
                    path, f"{path} must be 'standard' or 'immediately'"
                )
            result[field] = raw
    return result


def _validate_volume_spike(value: Any) -> dict[str, Any]:
    prefix = "volumeSpike"
    result = _validate_section(
        value,
        prefix=prefix,
        defaults=_DEFAULT_VOLUME_SPIKE,
        fields=_VOLUME_SPIKE_FIELDS,
    )
    for field, raw in value.items():
        path = f"{prefix}.{field}"
        if field == "triggerVolume":
            result[field] = _number(raw, field=path, low=0.01, high=10_000_000)
        elif field == "maximumDurationSeconds":
            result[field] = _number(raw, field=path, low=0.1, high=60)
        elif field == "priceRangeTicks":
            result[field] = _number(raw, field=path, low=1, high=100_000, integer=True)
        elif field == "ratioGreaterEqual":
            result[field] = _number(raw, field=path, low=1, high=1_000_000)
    return result


def _validate_absorption(value: Any) -> dict[str, Any]:
    prefix = "absorption"
    result = _validate_section(
        value,
        prefix=prefix,
        defaults=_DEFAULT_ABSORPTION,
        fields=_ABSORPTION_FIELDS,
    )
    for field, raw in value.items():
        path = f"{prefix}.{field}"
        if field == "triggerVolume":
            result[field] = _number(raw, field=path, low=0.01, high=10_000_000)
        elif field == "maximumDurationSeconds":
            result[field] = _number(raw, field=path, low=0.1, high=60)
    return result


def validate_market_explorer_settings(
    values: dict[str, Any],
    *,
    current: dict[str, Any] | None = None,
    allow_partial: bool = False,
) -> dict[str, Any]:
    if not isinstance(values, dict):
        raise MarketExplorerSettingsError("settings", "settings must be an object")
    result = deepcopy(current) if current is not None else default_market_explorer_settings()
    unknown = set(values) - _TOP_FIELDS
    if unknown and not allow_partial:
        field = sorted(unknown)[0]
        raise MarketExplorerSettingsError(field, f"Unknown Market Explorer setting {field!r}")
    for field, raw in values.items():
        if field not in _TOP_FIELDS:
            continue
        if field == "lineEnabled":
            if not isinstance(raw, bool):
                raise MarketExplorerSettingsError(field, f"{field} must be boolean")
            result[field] = raw
        elif field == "halftimeSeconds":
            result[field] = _number(raw, field=field, low=1, high=3_600, integer=True)
        elif field in {"buyLineColor", "sellLineColor"}:
            result[field] = _validate_color(raw, field)
        elif field == "signal":
            result[field] = _validate_market_volume_stop(raw)
        elif field == "volumeSpike":
            result[field] = _validate_volume_spike(raw)
        elif field == "absorption":
            result[field] = _validate_absorption(raw)
    result["signal"] = _validate_market_volume_stop(result["signal"])
    result["volumeSpike"] = _validate_volume_spike(result["volumeSpike"])
    result["absorption"] = _validate_absorption(result["absorption"])
    return result


def save_market_explorer_settings(cache: CacheStore, settings: dict[str, Any]) -> None:
    cache.set_metadata(
        MARKET_EXPLORER_SETTINGS_META_KEY,
        json.dumps(settings, separators=(",", ":"), sort_keys=True),
        now_ms(),
    )
