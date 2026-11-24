"""AI Scan provider settings and the owner-managed secret."""

from __future__ import annotations

import json
import os
import threading
from dataclasses import dataclass, field, replace
from typing import Any
from urllib.parse import urlparse

from .config import Settings
from .rithmic.admin_config import _atomic_write


class AiConfigError(ValueError):
    def __init__(self, message: str, *, field: str):
        super().__init__(message)
        self.field = field


@dataclass(frozen=True)
class AiScanConfig:
    base_url: str
    model: str
    enabled: bool = True
    api_key: str = field(default="", repr=False)
    key_source: str = "missing"

    @property
    def endpoint(self) -> str:
        return self.base_url + "/chat/completions"

    def public(self) -> dict[str, Any]:
        return {
            "baseUrl": self.base_url,
            "endpoint": self.endpoint,
            "model": self.model,
            "enabled": self.enabled,
            "apiKeyConfigured": bool(self.api_key),
            "apiKeySource": self.key_source,
            "apiKeyEnvironment": "NINEROUTER_API_KEY",
        }

    @classmethod
    def from_settings(cls, settings: Settings) -> AiScanConfig:
        key = os.getenv("NINEROUTER_API_KEY") or settings.openai_api_key or ""
        return cls(
            base_url=normalize_base_url(settings.openai_base_url),
            model=settings.llm_model,
            enabled=settings.ai_scan_enabled,
            api_key=key.strip(),
            key_source="environment" if key.strip() else "missing",
        )


def normalize_base_url(value: Any) -> str:
    if not isinstance(value, str) or len(value) > 512:
        raise AiConfigError("Base URL must be an HTTPS URL.", field="baseUrl")
    base = value.strip().rstrip("/")
    if base.endswith("/chat/completions"):
        base = base[:-len("/chat/completions")]
    parsed = urlparse(base)
    if (
        parsed.scheme != "https" or not parsed.hostname
        or parsed.username or parsed.password or parsed.query or parsed.fragment
        or any(character.isspace() for character in base)
    ):
        raise AiConfigError("Base URL must be an HTTPS URL without credentials or query parameters.", field="baseUrl")
    return base


class AiScanConfigStore:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.config_path = settings.data_dir / "secrets" / "ai-scan.json"
        self._lock = threading.RLock()

    def load(self) -> AiScanConfig:
        with self._lock:
            current = AiScanConfig.from_settings(self.settings)
            if self.config_path.is_file():
                body = json.loads(self.config_path.read_text(encoding="utf-8"))
                if not isinstance(body, dict):
                    raise AiConfigError("Saved AI Scan configuration must be an object.", field="config")
                current = self.parse(body, current=current)
            return current

    def parse(self, body: dict[str, Any], *, current: AiScanConfig | None = None) -> AiScanConfig:
        current = current or self.load()
        base_url = normalize_base_url(body.get("baseUrl", current.base_url))
        model = body.get("model", current.model)
        if not isinstance(model, str) or not model.strip() or len(model) > 160:
            raise AiConfigError("Model must be a non-empty string with up to 160 characters.", field="model")
        enabled = body.get("enabled", current.enabled)
        if not isinstance(enabled, bool):
            raise AiConfigError("Enabled must be true or false.", field="enabled")
        key = body.get("apiKey", "")
        if not isinstance(key, str) or len(key) > 8192 or any(char in key for char in "\r\n"):
            raise AiConfigError("API key must be a single line.", field="apiKey")
        return replace(
            current,
            base_url=base_url,
            model=model.strip(),
            enabled=enabled,
            api_key=key.strip() or current.api_key,
            key_source="secret-store" if key.strip() else current.key_source,
        )

    def save(self, body: dict[str, Any]) -> AiScanConfig:
        with self._lock:
            config = self.parse(body)
            private = {"baseUrl": config.base_url, "model": config.model, "enabled": config.enabled}
            if config.key_source == "secret-store":
                private["apiKey"] = config.api_key
            self.config_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            # One atomic secret-store record keeps the endpoint and its key consistent.
            _atomic_write(self.config_path, json.dumps(private, indent=2) + "\n", 0o600)
            return config
