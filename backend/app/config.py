"""Backend runtime configuration.

Centralizes host/port, data directory locations, and timing constants used
across the backend. Values are intentionally simple module-level defaults for
the MVP; a later phase can layer environment-variable or file-based overrides.
"""

from __future__ import annotations

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

    # Raw tick retention (see Requirements 7.4, 7.5).
    tick_retention_days: int = 90

    # Contract_Resolver scoring (see Requirement 10.2).
    resolver_window_ms: int = DEFAULT_RESOLVER_WINDOW_MS
    resolver_trade_weight: float = DEFAULT_RESOLVER_TRADE_WEIGHT
    resolver_quote_weight: float = DEFAULT_RESOLVER_QUOTE_WEIGHT

    # Symbols + candidate contracts surfaced by the REST API (see Req 18.1-18.3).
    # ``field(default_factory=...)`` keeps the frozen dataclass hashable while
    # avoiding a shared mutable default.
    supported_symbols: tuple[str, ...] = DEFAULT_SUPPORTED_SYMBOLS
    gc_candidate_contracts: tuple[str, ...] = DEFAULT_GC_CANDIDATE_CONTRACTS

    @property
    def cache_db_path(self) -> Path:
        return self.data_dir / self.cache_db_name

    @property
    def ticks_dir(self) -> Path:
        return self.data_dir / self.ticks_subdir


# A shared default instance. Tests may construct their own Settings as needed.
settings = Settings()
