"""Backend runtime configuration.

Centralizes host/port, data directory locations, and timing constants used
across the backend. Values are intentionally simple module-level defaults for
the MVP; a later phase can layer environment-variable or file-based overrides.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

# Repository/workspace-relative data root. The backend runs all-in-one on
# Windows for the MVP; data lives under <workspace>/data.
DEFAULT_DATA_DIR = Path("data")

# Contract_Resolver scoring defaults (see Requirement 10.2 and the design's
# "Contract Resolution Scoring" section). A candidate's score over a sliding
# recent window is ``score = trade_weight * trade_volume + quote_weight *
# quote_events``. Trade volume is the dominant front-month signal, so it carries
# the larger weight; quote activity is a lighter secondary signal.
DEFAULT_RESOLVER_WINDOW_MS = 60_000
DEFAULT_RESOLVER_TRADE_WEIGHT = 1.0
DEFAULT_RESOLVER_QUOTE_WEIGHT = 0.1

# User-facing symbols supported by the platform. v1 ships GC only; the Frontend
# presents the symbol as ``GC`` (Req 10.1, 18.1).
DEFAULT_SUPPORTED_SYMBOLS = ("GC",)
DEFAULT_OPENAI_BASE_URL = "http://43.228.214.251:20128/v1"

# Configured GC Candidate_Contract list. The REST contracts endpoints surface
# this set, and the active-contract state (Req 18.2, 18.3) defaults to the first
# entry until auto-resolution (Contract_Resolver, task 9.x) or a manual override
# selects another. Kept here so the symbols/contracts endpoints (task 10.1) can
# stand alone before the resolver is wired in.
DEFAULT_GC_CANDIDATE_CONTRACTS = ("GC 02-26", "GC 04-26", "GC 06-26", "GC 08-26")


@dataclass(frozen=True)
class Settings:
    """Immutable backend settings."""

    host: str = "127.0.0.1"
    port: int = 8000

    # Storage locations (relative to the working directory by default).
    data_dir: Path = DEFAULT_DATA_DIR
    cache_db_name: str = "app.sqlite"
    ticks_subdir: str = "ticks"

    # Streaming / lifecycle timing (see Requirements 5, 6).
    ui_throttle_min_ms: int = 100
    ui_throttle_max_ms: int = 125
    chart_ping_interval_s: int = 30
    chart_pong_timeout_s: int = 60
    chart_send_timeout_s: float = 2.0

    # NT_AddOn connection liveness (see Requirements 4.7, 4.8).
    nt_status_timeout_s: int = 15

    # Raw tick retention (see Requirements 7.4, 7.5). This is a calendar-day
    # count including today's UTC shard; v1 keeps today and yesterday only.
    tick_retention_days: int = 2

    # Contract_Resolver scoring (see Requirement 10.2).
    resolver_window_ms: int = DEFAULT_RESOLVER_WINDOW_MS
    resolver_trade_weight: float = DEFAULT_RESOLVER_TRADE_WEIGHT
    resolver_quote_weight: float = DEFAULT_RESOLVER_QUOTE_WEIGHT

    # Symbols + candidate contracts surfaced by the REST API (see Req 18.1-18.3).
    # ``field(default_factory=...)`` keeps the frozen dataclass hashable while
    # avoiding a shared mutable default.
    supported_symbols: tuple[str, ...] = DEFAULT_SUPPORTED_SYMBOLS
    gc_candidate_contracts: tuple[str, ...] = DEFAULT_GC_CANDIDATE_CONTRACTS

    # Trading / order-on-chart settings. These default closed so a fresh
    # checkout can exercise fake/demo plumbing without ever sending a live
    # broker order by accident.
    trading_enabled: bool = field(
        default_factory=lambda: os.getenv("NTTOTV_TRADING_ENABLED", "0") == "1"
    )
    live_trading_enabled: bool = field(
        default_factory=lambda: os.getenv("NTTOTV_LIVE_TRADING_ENABLED", "0") == "1"
    )
    mt5_backend: str = field(
        default_factory=lambda: os.getenv("NTTOTV_MT5_BACKEND", "fake")
    )
    credential_key: str | None = field(
        default_factory=lambda: os.getenv("NTTOTV_CREDENTIAL_KEY")
    )
    invite_code: str | None = field(
        default_factory=lambda: os.getenv("NTTOTV_INVITE_CODE")
    )
    auth_session_ttl_days: int = field(
        default_factory=lambda: int(os.getenv("NTTOTV_SESSION_TTL_DAYS", "30"))
    )
    default_broker_symbol: str = field(
        default_factory=lambda: os.getenv("NTTOTV_BROKER_SYMBOL", "XAUUSDm")
    )
    broker_tick_size: float = field(
        default_factory=lambda: float(os.getenv("NTTOTV_BROKER_TICK_SIZE", "0.01"))
    )
    broker_digits: int = field(
        default_factory=lambda: int(os.getenv("NTTOTV_BROKER_DIGITS", "2"))
    )
    broker_pip_value: float = field(
        default_factory=lambda: float(os.getenv("NTTOTV_BROKER_PIP_VALUE", "1.0"))
    )
    mt5_connect_timeout_ms: int = field(
        default_factory=lambda: int(os.getenv("NTTOTV_MT5_CONNECT_TIMEOUT_MS", "5000"))
    )
    basis_default: float = field(
        default_factory=lambda: float(os.getenv("NTTOTV_BASIS_DEFAULT", "0.0"))
    )
    basis_stale_after_ms: int = field(
        default_factory=lambda: int(os.getenv("NTTOTV_BASIS_STALE_AFTER_MS", "5000"))
    )

    # Experimental analyst. Disabled by default and isolated in a separate
    # SQLite database so it can be removed without touching the market cache.
    analyst_enabled: bool = field(
        default_factory=lambda: os.getenv("NTTOTV_ANALYST_ENABLED", "0") == "1"
    )
    analyst_db_name: str = field(
        default_factory=lambda: os.getenv("NTTOTV_ANALYST_DB_NAME", "analyst.sqlite")
    )
    analyst_event_provider: str = field(
        default_factory=lambda: os.getenv("NTTOTV_ANALYST_EVENT_PROVIDER", "mock")
    )
    analyst_manual_provider: str = field(
        default_factory=lambda: os.getenv("NTTOTV_ANALYST_MANUAL_PROVIDER", "real")
    )
    analyst_tick_size: float = field(
        default_factory=lambda: float(os.getenv("NTTOTV_ANALYST_TICK_SIZE", "0.1"))
    )
    analyst_event_cooldown_s: int = field(
        default_factory=lambda: int(
            os.getenv("NTTOTV_ANALYST_EVENT_COOLDOWN_S", "1800")
        )
    )
    analyst_scanner_queue_size: int = field(
        default_factory=lambda: int(
            os.getenv("NTTOTV_ANALYST_SCANNER_QUEUE_SIZE", "1")
        )
    )
    analyst_m1_internal_enabled: bool = field(
        default_factory=lambda: os.getenv("NTTOTV_ANALYST_M1_INTERNAL_ENABLED", "1")
        != "0"
    )
    openai_api_key: str | None = field(
        default_factory=lambda: os.getenv("NTTOTV_OPENAI_API_KEY")
    )
    openai_base_url: str = field(
        default_factory=lambda: os.getenv(
            "NTTOTV_OPENAI_BASE_URL",
            os.getenv("OPENAI_BASE_URL", DEFAULT_OPENAI_BASE_URL),
        )
    )
    llm_model: str = field(
        default_factory=lambda: os.getenv("NTTOTV_LLM_MODEL", "cx/gpt-5.5")
    )
    llm_reasoning_effort: str = field(
        default_factory=lambda: os.getenv("NTTOTV_LLM_REASONING_EFFORT", "medium")
    )
    llm_manual_reasoning_effort: str = field(
        default_factory=lambda: os.getenv(
            "NTTOTV_LLM_MANUAL_REASONING_EFFORT",
            "high",
        )
    )
    llm_event_reasoning_effort: str = field(
        default_factory=lambda: os.getenv(
            "NTTOTV_LLM_EVENT_REASONING_EFFORT",
            os.getenv("NTTOTV_LLM_REASONING_EFFORT", "high"),
        )
    )

    @property
    def cache_db_path(self) -> Path:
        return self.data_dir / self.cache_db_name

    @property
    def ticks_dir(self) -> Path:
        return self.data_dir / self.ticks_subdir

    @property
    def analyst_db_path(self) -> Path:
        return self.data_dir / self.analyst_db_name

    @property
    def auth_session_ttl_seconds(self) -> int:
        return max(1, self.auth_session_ttl_days) * 24 * 60 * 60

    @property
    def auth_session_ttl_ms(self) -> int:
        return self.auth_session_ttl_seconds * 1000


# A shared default instance. Tests may construct their own Settings as needed.
settings = Settings()
