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
DEFAULT_RPROTOCOL_ARCHIVE = Path(__file__).resolve().parents[2] / "RProtocolAPI.zip"

# Configured GC Candidate_Contract list. The REST contracts endpoints surface
# this set, and the active-contract state (Req 18.2, 18.3) defaults to the first
# entry until auto-resolution (Contract_Resolver, task 9.x) or a manual override
# selects another. Kept here so the symbols/contracts endpoints (task 10.1) can
# stand alone before the resolver is wired in.
DEFAULT_GC_CANDIDATE_CONTRACTS = ("GC 06-26", "GC 08-26", "GC 10-26", "GC 12-26")


@dataclass(frozen=True)
class Settings:
    """Immutable backend settings."""

    host: str = "127.0.0.1"
    port: int = 8000

    # Storage locations (relative to the working directory by default).
    data_dir: Path = DEFAULT_DATA_DIR
    cache_db_name: str = "app.sqlite"
    ticks_subdir: str = "ticks"
    liquidity_db_name: str = "liquidity.sqlite"

    # Streaming / lifecycle timing (see Requirements 5, 6).
    ui_throttle_min_ms: int = 100
    ui_throttle_max_ms: int = 125
    chart_ping_interval_s: int = 30
    chart_pong_timeout_s: int = 60
    chart_send_timeout_s: float = 2.0

    # NT_AddOn connection liveness (see Requirements 4.7, 4.8).
    nt_status_timeout_s: int = 15

    # Realtime market-source arbitration. Production remains NT-first until the
    # Local/test default stays NT; production promotes Bookmap through the
    # environment while keeping NT warm as the automatic fallback.
    market_data_preferred_source: str = field(
        default_factory=lambda: os.getenv(
            "NTTOTV_MARKET_DATA_PREFERRED_SOURCE", "nt"
        ).strip().lower()
    )
    market_data_cold_start_grace_ms: int = field(
        default_factory=lambda: int(
            os.getenv("NTTOTV_MARKET_DATA_COLD_START_GRACE_MS", "5000")
        )
    )
    bookmap_stale_ms: int = field(
        default_factory=lambda: int(os.getenv("NTTOTV_BOOKMAP_STALE_MS", "5000"))
    )
    bookmap_qualify_ms: int = field(
        default_factory=lambda: int(os.getenv("NTTOTV_BOOKMAP_QUALIFY_MS", "2000"))
    )
    bookmap_recover_ms: int = field(
        default_factory=lambda: int(os.getenv("NTTOTV_BOOKMAP_RECOVER_MS", "10000"))
    )
    market_data_min_hold_ms: int = field(
        default_factory=lambda: int(os.getenv("NTTOTV_MARKET_DATA_MIN_HOLD_MS", "30000"))
    )
    nt_feed_stale_ms: int = field(
        default_factory=lambda: int(os.getenv("NTTOTV_NT_FEED_STALE_MS", "10000"))
    )

    # Direct Rithmic Ticker Plant connector.  It is deliberately disabled and
    # shadow-only by default: enabling it warms its own source engines and
    # records source-tagged raw L1, but cannot participate in NT/Bookmap source
    # arbitration until a separate promotion change is made.
    rithmic_enabled: bool = field(
        default_factory=lambda: os.getenv("NTTOTV_RITHMIC_ENABLED", "0") == "1"
    )
    rithmic_shadow_mode: bool = field(
        default_factory=lambda: os.getenv("NTTOTV_RITHMIC_SHADOW_MODE", "1") != "0"
    )
    rithmic_uri: str = field(
        default_factory=lambda: os.getenv(
            "NTTOTV_RITHMIC_URI", "wss://rprotocol-mobile.rithmic.com:443"
        )
    )
    rithmic_user: str | None = field(
        default_factory=lambda: os.getenv("NTTOTV_RITHMIC_USER"), repr=False
    )
    rithmic_password: str | None = field(
        default_factory=lambda: os.getenv("NTTOTV_RITHMIC_PASSWORD"), repr=False
    )
    rithmic_system_name: str = field(
        default_factory=lambda: os.getenv(
            "NTTOTV_RITHMIC_SYSTEM", "Rithmic Paper Trading"
        )
    )
    rithmic_app_name: str = field(
        default_factory=lambda: os.getenv(
            "NTTOTV_RITHMIC_APP_NAME", "Bookmap"
        )
    )
    rithmic_app_version: str = field(
        default_factory=lambda: os.getenv("NTTOTV_RITHMIC_APP_VERSION", "7.4.0.21")
    )
    rithmic_exchange: str = field(
        default_factory=lambda: os.getenv("NTTOTV_RITHMIC_EXCHANGE", "COMEX")
    )
    rithmic_symbol: str = field(
        default_factory=lambda: os.getenv("NTTOTV_RITHMIC_SYMBOL", "GCZ6")
    )
    rithmic_contract: str = field(
        default_factory=lambda: os.getenv("NTTOTV_RITHMIC_CONTRACT", "GC 12-26")
    )
    rithmic_modes: tuple[str, ...] = field(
        default_factory=lambda: tuple(
            mode
            for mode in (
                part.strip().lower()
                for part in os.getenv("NTTOTV_RITHMIC_MODES", "l1,l2,mbo").split(",")
            )
            if mode
        )
    )
    rithmic_archive_path: Path = field(
        default_factory=lambda: Path(
            os.getenv("NTTOTV_RITHMIC_ARCHIVE", str(DEFAULT_RPROTOCOL_ARCHIVE))
        )
    )
    rithmic_stale_ms: int = field(
        default_factory=lambda: int(os.getenv("NTTOTV_RITHMIC_STALE_MS", "10000"))
    )
    # A direct session has no authoritative reconnect bar snapshot.  Keep it
    # out of arbitration until it has observed a full minute of L1 after every
    # connect/reconnect so its warm bar/delta/footprint state is complete.
    rithmic_qualify_ms: int = field(
        default_factory=lambda: int(
            os.getenv("NTTOTV_RITHMIC_QUALIFY_MS", "65000")
        )
    )
    rithmic_connect_timeout_s: float = field(
        default_factory=lambda: float(
            os.getenv("NTTOTV_RITHMIC_CONNECT_TIMEOUT_S", "15")
        )
    )
    rithmic_reconnect_min_s: float = field(
        default_factory=lambda: float(os.getenv("NTTOTV_RITHMIC_RECONNECT_MIN_S", "1"))
    )
    rithmic_reconnect_max_s: float = field(
        default_factory=lambda: float(os.getenv("NTTOTV_RITHMIC_RECONNECT_MAX_S", "30"))
    )

    # Raw tick retention (see Requirements 7.4, 7.5). This is a calendar-day
    # count including today's UTC shard; v1 keeps today and yesterday only.
    tick_retention_days: int = 2
    # Compact threshold events and persistent-line lifecycles only. Raw depth
    # is deliberately never written by the backend.
    liquidity_retention_hours: int = field(
        default_factory=lambda: int(
            os.getenv("NTTOTV_LIQUIDITY_RETENTION_HOURS", "24")
        )
    )

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
    def liquidity_db_path(self) -> Path:
        return self.data_dir / self.liquidity_db_name

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
