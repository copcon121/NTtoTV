"""Order-on-chart domain models and wire helpers."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from enum import Enum
from typing import Any

from .timestamp import CanonicalTimestamp

__all__ = [
    "OrderSide",
    "OrderKind",
    "OrderStatus",
    "OrderSource",
    "OrderRecord",
    "OrderEventRecord",
    "OrderPreset",
    "order_to_dict",
]


class OrderSide(str, Enum):
    BUY = "buy"
    SELL = "sell"


class OrderKind(str, Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"


class OrderStatus(str, Enum):
    PENDING_SUBMIT = "pending_submit"
    SUBMITTED = "submitted"
    WORKING = "working"
    FILLED = "filled"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    CLOSED = "closed"
    SYNC_PAUSED = "sync_paused"
    SYNC_ERROR = "sync_error"


class OrderSource(str, Enum):
    CHART_BRACKET = "chart_bracket"
    MARKET_BAR = "market_bar"
    API = "api"


@dataclass(slots=True)
class OrderRecord:
    id: str
    user_id: str
    account_id: str
    source: OrderSource
    symbol_internal: str
    contract_internal: str
    source_contract: str | None
    symbol_broker: str
    side: OrderSide
    kind: OrderKind
    volume_lots: float
    gc_anchored: bool
    status: OrderStatus
    idempotency_key: str
    created_at: CanonicalTimestamp
    updated_at: CanonicalTimestamp
    version: int = 1
    entry_gc: float | None = None
    sl_gc: float | None = None
    tp_gc: float | None = None
    entry_broker: float | None = None
    sl_broker: float | None = None
    tp_broker: float | None = None
    fill_price_broker: float | None = None
    fill_price_gc_estimate: float | None = None
    basis_at_submit: float | None = None
    basis_at_last_sync: float | None = None
    basis_at_fill: float | None = None
    basis_stale_at_submit: bool = False
    broker_order_ticket: int | None = None
    broker_position_ticket: int | None = None
    broker_deal_ticket: int | None = None
    reject_reason: str | None = None
    last_broker_error_code: str | None = None
    last_broker_error_message: str | None = None
    submitted_at: CanonicalTimestamp | None = None
    filled_at: CanonicalTimestamp | None = None
    closed_at: CanonicalTimestamp | None = None
    last_sync_at: CanonicalTimestamp | None = None


@dataclass(slots=True)
class OrderEventRecord:
    order_id: str
    user_id: str
    event_type: str
    payload: dict[str, Any]
    created_at: CanonicalTimestamp
    id: int | None = None


@dataclass(slots=True)
class OrderPreset:
    user_id: str
    account_id: str
    mode: str
    volume_lots: float
    risk_percent: float
    sl_distance_gc: float
    tp_distance_gc: float
    confirm_market: bool
    max_lot: float
    max_open_orders: int
    updated_at: CanonicalTimestamp


def order_to_dict(order: OrderRecord) -> dict[str, Any]:
    """Return the frontend/API camelCase representation of an order."""
    raw = asdict(order)
    out: dict[str, Any] = {}
    for key, value in raw.items():
        if isinstance(value, Enum):
            value = value.value
        out[_camel(key)] = value
    return out


def _camel(name: str) -> str:
    head, *tail = name.split("_")
    return head + "".join(part[:1].upper() + part[1:] for part in tail)
