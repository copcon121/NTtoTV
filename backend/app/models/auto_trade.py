"""Persisted server-side configuration for mGann automatic execution."""

from __future__ import annotations

from dataclasses import dataclass

from .timestamp import CanonicalTimestamp

__all__ = ["AutoTradeSettingsRecord"]


@dataclass(slots=True)
class AutoTradeSettingsRecord:
    """One user's mGann auto-trading switches and market-order lot size."""

    user_id: str
    long_enabled: bool = False
    short_enabled: bool = False
    volume_lots: float = 0.1
    updated_at: CanonicalTimestamp = 0
