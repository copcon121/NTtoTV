"""Broker/MT5-facing models used by the fake and real backends."""

from __future__ import annotations

from dataclasses import dataclass

from .timestamp import CanonicalTimestamp

__all__ = [
    "Mt5AccountRecord",
    "Mt5AccountInfo",
    "Mt5SymbolInfo",
    "Mt5Tick",
    "Mt5OrderResult",
]


@dataclass(slots=True)
class Mt5AccountRecord:
    id: str
    user_id: str
    login: int
    server: str
    symbol_broker: str
    password_encrypted: str
    terminal_path: str | None
    trade_mode: str
    created_at: CanonicalTimestamp
    updated_at: CanonicalTimestamp


@dataclass(slots=True)
class Mt5AccountInfo:
    account_id: str
    login: int
    server: str
    trade_mode: str
    currency: str
    balance: float
    equity: float
    margin: float
    free_margin: float


@dataclass(slots=True)
class Mt5SymbolInfo:
    symbol: str
    digits: int
    tick_size: float
    min_lot: float
    max_lot: float
    lot_step: float
    stops_level: float
    pip_value: float


@dataclass(slots=True)
class Mt5Tick:
    symbol: str
    bid: float
    ask: float
    time: CanonicalTimestamp


@dataclass(slots=True)
class Mt5OrderResult:
    accepted: bool
    status: str
    broker_order_ticket: int | None = None
    broker_position_ticket: int | None = None
    broker_deal_ticket: int | None = None
    fill_price: float | None = None
    error_code: str | None = None
    error_message: str | None = None
