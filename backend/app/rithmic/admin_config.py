"""Persistent, GUI-editable Rithmic configuration with secret separation."""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from ..config import Settings

_MAC_RE = re.compile(r"^[0-9A-F]{2}(?::[0-9A-F]{2}){5}$")
_ALLOWED_MODES = frozenset({"l1", "l2", "mbo"})
_MAX_HISTORY_BYTES = 40_000_000_000


class RithmicAdminConfigError(ValueError):
    def __init__(self, message: str, *, field: str | None = None) -> None:
        super().__init__(message)
        self.field = field


@dataclass(frozen=True, slots=True)
class RithmicAdminConfig:
    auto_connect: bool
    websocket_uri: str
    user: str
    password: str
    app_name: str
    app_version: str
    system_name: str
    template_version: str
    user_message: str
    mac_addresses: tuple[str, ...]
    os_platform: str
    os_version: str
    aggregated_quotes: bool
    exchange: str
    wire_symbol: str
    physical_contract: str
    modes: tuple[str, ...]
    qualification_seconds: int
    history_enabled: bool
    history_audit_seconds: int
    history_lookback_days: int
    history_weekly_byte_limit: int

    def to_public_dict(self, *, stored: bool) -> dict[str, Any]:
        return {
            "stored": stored,
            "autoConnect": self.auto_connect,
            "websocketUri": self.websocket_uri,
            "templateId": 10,
            "templateVersion": self.template_version,
            "user": self.user,
            "passwordConfigured": bool(self.password),
            "appName": self.app_name,
            "appVersion": self.app_version,
            "systemName": self.system_name,
            "tickerInfraType": 1,
            "historyInfraType": 3,
            "aggregatedQuotes": self.aggregated_quotes,
            "userMessage": self.user_message,
            "macAddresses": list(self.mac_addresses),
            "osPlatform": self.os_platform,
            "osVersion": self.os_version,
            "exchange": self.exchange,
            "wireSymbol": self.wire_symbol,
            "physicalContract": self.physical_contract,
            "modes": list(self.modes),
            "qualificationSeconds": self.qualification_seconds,
            "historyEnabled": self.history_enabled,
            "historyAuditSeconds": self.history_audit_seconds,
            "historyLookbackDays": self.history_lookback_days,
            "historyWeeklyByteLimit": self.history_weekly_byte_limit,
        }

    def to_settings(self, base: Settings, *, enabled: bool | None = None) -> Settings:
        return replace(
            base,
            rithmic_enabled=self.auto_connect if enabled is None else enabled,
            rithmic_uri=self.websocket_uri,
            rithmic_user=self.user,
            rithmic_password=self.password,
            rithmic_app_name=self.app_name,
            rithmic_app_version=self.app_version,
            rithmic_system_name=self.system_name,
            rithmic_template_version=self.template_version,
            rithmic_user_message=self.user_message,
            rithmic_mac_addresses=self.mac_addresses,
            rithmic_os_platform=self.os_platform,
            rithmic_os_version=self.os_version,
            rithmic_aggregated_quotes=self.aggregated_quotes,
            rithmic_exchange=self.exchange,
            rithmic_symbol=self.wire_symbol,
            rithmic_contract=self.physical_contract,
            rithmic_modes=self.modes,
            rithmic_qualify_ms=self.qualification_seconds * 1000,
            rithmic_history_enabled=self.history_enabled,
            rithmic_history_audit_s=self.history_audit_seconds,
            rithmic_history_initial_lookback_days=self.history_lookback_days,
            rithmic_history_weekly_byte_limit=self.history_weekly_byte_limit,
        )


class RithmicAdminConfigStore:
    """Store non-secrets as JSON and the password in a separate mode-0600 file."""

    def __init__(self, base: Settings) -> None:
        self.base = base
        self.config_path = base.data_dir / "config" / "rithmic.json"
        self.password_path = base.data_dir / "secrets" / "rithmic-password"

    @property
    def stored(self) -> bool:
        return self.config_path.is_file()

    def load(self) -> RithmicAdminConfig:
        current = self._from_settings(self.base)
        if self.password_path.is_file():
            current = replace(
                current,
                password=self.password_path.read_text(encoding="utf-8").rstrip("\r\n"),
            )
        if not self.config_path.is_file():
            return current
        try:
            body = json.loads(self.config_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise RithmicAdminConfigError(f"Cannot read saved Rithmic config: {exc}") from exc
        if not isinstance(body, dict):
            raise RithmicAdminConfigError("Saved Rithmic config must be an object")
        # Older GUI versions allowed a subset. The Rithmic-only readiness
        # contract requires all three streams, so migrate stored values while
        # still rejecting incomplete new API submissions.
        saved_modes = body.get("modes")
        if isinstance(saved_modes, list) and set(saved_modes).issubset(_ALLOWED_MODES):
            body["modes"] = ["l1", "l2", "mbo"]
        return self.parse(body, current=current)

    def parse(
        self,
        body: dict[str, Any],
        *,
        current: RithmicAdminConfig | None = None,
    ) -> RithmicAdminConfig:
        current = current or self.load()
        password_value = body.get("password")
        password = current.password
        if password_value is not None:
            if not isinstance(password_value, str):
                raise RithmicAdminConfigError("Password must be text", field="password")
            if password_value:
                password = password_value

        uri = _text(body, "websocketUri", current.websocket_uri, max_length=512)
        parsed_uri = urlparse(uri)
        if parsed_uri.scheme != "wss" or not parsed_uri.netloc:
            raise RithmicAdminConfigError(
                "WebSocket URI must be a valid wss:// address",
                field="websocketUri",
            )

        mac_values = body.get("macAddresses", list(current.mac_addresses))
        if isinstance(mac_values, str):
            mac_values = re.split(r"[,\s]+", mac_values.strip())
        if not isinstance(mac_values, list):
            raise RithmicAdminConfigError(
                "MAC addresses must be a list", field="macAddresses"
            )
        macs: list[str] = []
        for raw in mac_values:
            if not isinstance(raw, str):
                raise RithmicAdminConfigError(
                    "MAC address must be text", field="macAddresses"
                )
            normalized = raw.strip().replace("-", ":").upper()
            if not normalized:
                continue
            if not _MAC_RE.fullmatch(normalized):
                raise RithmicAdminConfigError(
                    f"Invalid MAC address: {raw}", field="macAddresses"
                )
            if normalized not in macs:
                macs.append(normalized)
        if not macs:
            raise RithmicAdminConfigError(
                "At least one MAC address is required", field="macAddresses"
            )

        raw_modes = body.get("modes", list(current.modes))
        if not isinstance(raw_modes, list):
            raise RithmicAdminConfigError("Modes must be a list", field="modes")
        modes = tuple(
            mode
            for mode in (str(value).strip().lower() for value in raw_modes)
            if mode
        )
        if set(modes) != _ALLOWED_MODES:
            raise RithmicAdminConfigError(
                "Rithmic-only production requires l1, l2, and mbo", field="modes"
            )

        config = RithmicAdminConfig(
            auto_connect=_boolean(body, "autoConnect", current.auto_connect),
            websocket_uri=uri,
            user=_text(body, "user", current.user, max_length=256),
            password=password,
            app_name=_text(body, "appName", current.app_name, max_length=256),
            app_version=_text(body, "appVersion", current.app_version, max_length=64),
            system_name=_text(body, "systemName", current.system_name, max_length=256),
            template_version=_text(
                body, "templateVersion", current.template_version, max_length=32
            ),
            user_message=_text(
                body, "userMessage", current.user_message, max_length=256
            ),
            mac_addresses=tuple(macs),
            os_platform=_text(
                body, "osPlatform", current.os_platform, max_length=128
            ),
            os_version=_text(body, "osVersion", current.os_version, max_length=128),
            aggregated_quotes=_boolean(
                body, "aggregatedQuotes", current.aggregated_quotes
            ),
            exchange=_text(body, "exchange", current.exchange, max_length=64).upper(),
            wire_symbol=_text(
                body, "wireSymbol", current.wire_symbol, max_length=64
            ).upper(),
            physical_contract=_text(
                body, "physicalContract", current.physical_contract, max_length=64
            ).upper(),
            modes=tuple(dict.fromkeys(modes)),
            qualification_seconds=_integer(
                body,
                "qualificationSeconds",
                current.qualification_seconds,
                minimum=0,
                maximum=300,
            ),
            history_enabled=_boolean(
                body, "historyEnabled", current.history_enabled
            ),
            history_audit_seconds=_integer(
                body,
                "historyAuditSeconds",
                current.history_audit_seconds,
                minimum=30,
                maximum=86_400,
            ),
            history_lookback_days=_integer(
                body,
                "historyLookbackDays",
                current.history_lookback_days,
                minimum=1,
                maximum=365,
            ),
            history_weekly_byte_limit=_integer(
                body,
                "historyWeeklyByteLimit",
                current.history_weekly_byte_limit,
                minimum=1_000_000,
                maximum=_MAX_HISTORY_BYTES,
            ),
        )
        return config

    def save(self, config: RithmicAdminConfig) -> None:
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        self.password_path.parent.mkdir(parents=True, exist_ok=True)
        public = config.to_public_dict(stored=True)
        public.pop("stored", None)
        public.pop("passwordConfigured", None)
        public.pop("templateId", None)
        public.pop("tickerInfraType", None)
        public.pop("historyInfraType", None)
        _atomic_write(
            self.config_path,
            json.dumps(public, indent=2, sort_keys=True) + "\n",
            0o600,
        )
        if config.password:
            _atomic_write(self.password_path, config.password + "\n", 0o600)

    @staticmethod
    def require_connectable(config: RithmicAdminConfig) -> None:
        if not config.user:
            raise RithmicAdminConfigError("Rithmic user is required", field="user")
        if not config.password:
            raise RithmicAdminConfigError(
                "Rithmic password is required", field="password"
            )

    @staticmethod
    def _from_settings(settings: Settings) -> RithmicAdminConfig:
        return RithmicAdminConfig(
            auto_connect=settings.rithmic_enabled,
            websocket_uri=settings.rithmic_uri,
            user=settings.rithmic_user or "",
            password=settings.rithmic_password or "",
            app_name=settings.rithmic_app_name,
            app_version=settings.rithmic_app_version,
            system_name=settings.rithmic_system_name,
            template_version=settings.rithmic_template_version,
            user_message=settings.rithmic_user_message,
            mac_addresses=settings.rithmic_mac_addresses,
            os_platform=settings.rithmic_os_platform,
            os_version=settings.rithmic_os_version,
            aggregated_quotes=settings.rithmic_aggregated_quotes,
            exchange=settings.rithmic_exchange,
            wire_symbol=settings.rithmic_symbol,
            physical_contract=settings.rithmic_contract,
            modes=settings.rithmic_modes,
            qualification_seconds=max(0, settings.rithmic_qualify_ms // 1000),
            history_enabled=settings.rithmic_history_enabled,
            history_audit_seconds=settings.rithmic_history_audit_s,
            history_lookback_days=settings.rithmic_history_initial_lookback_days,
            history_weekly_byte_limit=settings.rithmic_history_weekly_byte_limit,
        )


def _text(
    body: dict[str, Any], key: str, default: str, *, max_length: int
) -> str:
    value = body.get(key, default)
    if not isinstance(value, str) or not value.strip():
        raise RithmicAdminConfigError(f"{key} is required", field=key)
    value = value.strip()
    if len(value) > max_length:
        raise RithmicAdminConfigError(f"{key} is too long", field=key)
    return value


def _boolean(body: dict[str, Any], key: str, default: bool) -> bool:
    value = body.get(key, default)
    if not isinstance(value, bool):
        raise RithmicAdminConfigError(f"{key} must be true or false", field=key)
    return value


def _integer(
    body: dict[str, Any],
    key: str,
    default: int,
    *,
    minimum: int,
    maximum: int,
) -> int:
    value = body.get(key, default)
    if isinstance(value, bool) or not isinstance(value, int):
        raise RithmicAdminConfigError(f"{key} must be an integer", field=key)
    if not minimum <= value <= maximum:
        raise RithmicAdminConfigError(
            f"{key} must be between {minimum} and {maximum}", field=key
        )
    return value


def _atomic_write(path: Path, content: str, mode: int) -> None:
    temp = path.with_name(f".{path.name}.tmp-{os.getpid()}")
    try:
        with temp.open("w", encoding="utf-8", newline="\n") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temp, mode)
        os.replace(temp, path)
        os.chmod(path, mode)
    finally:
        try:
            temp.unlink()
        except FileNotFoundError:
            pass
