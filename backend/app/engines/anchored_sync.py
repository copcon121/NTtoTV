"""GC-anchored order resynchronization."""

from __future__ import annotations

import logging
from dataclasses import dataclass

from ..models.orders import OrderEventRecord, OrderKind, OrderRecord, OrderStatus
from ..models.timestamp import now_ms
from ..mt5.manager import Mt5Manager
from ..storage.cache_store import CacheStore
from .basis_engine import BasisEngine
from .symbol_map import SymbolMap

logger = logging.getLogger(__name__)

__all__ = ["AnchoredSyncConfig", "AnchoredSyncEngine"]


@dataclass(frozen=True, slots=True)
class AnchoredSyncConfig:
    threshold_ticks: int = 2
    min_interval_ms: int = 2_000


class AnchoredSyncEngine:
    def __init__(
        self,
        cache: CacheStore,
        mt5_manager: Mt5Manager,
        basis_engine: BasisEngine,
        *,
        config: AnchoredSyncConfig | None = None,
    ) -> None:
        self._cache = cache
        self._mt5 = mt5_manager
        self._basis = basis_engine
        self._config = config or AnchoredSyncConfig()

    def run_once(self) -> int:
        changed = 0
        for account in self._cache.users.read_mt5_accounts():
            symbol_info = self._mt5.backend.symbol_info(
                account.user_id, account.id, account.symbol_broker
            )
            symbol = SymbolMap.from_info(symbol_info)
            for order in self._cache.orders.list_open_for_account(
                account.user_id, account.id
            ):
                if self._sync_order(order, symbol):
                    changed += 1
        return changed

    def _sync_order(self, order: OrderRecord, symbol: SymbolMap) -> bool:
        if not order.gc_anchored:
            return False
        now = now_ms()
        if (
            order.last_sync_at is not None
            and now - order.last_sync_at < self._config.min_interval_ms
        ):
            return False

        next_entry = (
            None if order.entry_gc is None else self._basis.to_broker(order.entry_gc, symbol)
        )
        next_sl = None if order.sl_gc is None else self._basis.to_broker(order.sl_gc, symbol)
        next_tp = None if order.tp_gc is None else self._basis.to_broker(order.tp_gc, symbol)
        converted = [c for c in (next_entry, next_sl, next_tp) if c is not None]
        if any(c.stale for c in converted):
            self._audit(order, "basis_stale_pause", {"basis": converted[0].basis if converted else None})
            return False

        threshold = symbol.tick_size * self._config.threshold_ticks
        needs_sync = False
        if order.kind is not OrderKind.MARKET and next_entry is not None:
            needs_sync = _different(order.entry_broker, next_entry.price, threshold)
        if next_sl is not None:
            needs_sync = needs_sync or _different(order.sl_broker, next_sl.price, threshold)
        if next_tp is not None:
            needs_sync = needs_sync or _different(order.tp_broker, next_tp.price, threshold)
        if not needs_sync:
            return False

        before = {
            "entryBroker": order.entry_broker,
            "slBroker": order.sl_broker,
            "tpBroker": order.tp_broker,
            "basis": order.basis_at_last_sync,
        }
        if order.kind is not OrderKind.MARKET and next_entry is not None:
            order.entry_broker = next_entry.price
        if next_sl is not None:
            order.sl_broker = next_sl.price
        if next_tp is not None:
            order.tp_broker = next_tp.price
        if converted:
            order.basis_at_last_sync = converted[0].basis
        order.last_sync_at = now
        order.updated_at = now
        result = self._mt5.backend.modify_order(order)
        if not result.accepted:
            order.status = OrderStatus.SYNC_ERROR
            order.last_broker_error_code = result.error_code
            order.last_broker_error_message = result.error_message
        self._cache.orders.update(order)
        self._audit(
            order,
            "basis_resync",
            {
                "before": before,
                "after": {
                    "entryBroker": order.entry_broker,
                    "slBroker": order.sl_broker,
                    "tpBroker": order.tp_broker,
                    "basis": order.basis_at_last_sync,
                },
            },
        )
        return True

    def _audit(self, order: OrderRecord, event_type: str, payload: dict) -> None:
        self._cache.orders.append_event(
            OrderEventRecord(
                order_id=order.id,
                user_id=order.user_id,
                event_type=event_type,
                payload=payload,
                created_at=now_ms(),
            )
        )


def _different(current: float | None, new: float, threshold: float) -> bool:
    return current is None or abs(current - new) > threshold
