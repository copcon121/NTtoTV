"""Persistent manual-position SuperTrend trailing configuration."""

from __future__ import annotations

from dataclasses import dataclass

from .timestamp import CanonicalTimestamp

__all__ = ["SupertrendTrailingRecord"]


@dataclass(slots=True)
class SupertrendTrailingRecord:
    user_id: str
    account_id: str
    target_type: str
    target_id: str
    broker_position_ticket: int
    side: str
    timeframe: str
    period: int
    multiplier: float
    atr_method: str
    source: str
    created_at: CanonicalTimestamp
    updated_at: CanonicalTimestamp
    last_bar_time: CanonicalTimestamp | None = None
    last_line: float | None = None
