"""In-memory L2 and MBO state for the direct Rithmic shadow feed.

The full depth stream intentionally stays in memory.  NTtoTV persists only
compact derived market data, so a direct connector must not turn the raw depth
feed into an unbounded SQLite writer.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(slots=True, frozen=True)
class MboOrder:
    exchange_order_id: str
    side: str
    price: float
    size: int
    priority: int | None = None


class RithmicBookState:
    """Maintain bounded current L2 levels and exchange-order state."""

    def __init__(self) -> None:
        self.bids: dict[float, dict[str, int | float]] = {}
        self.asks: dict[float, dict[str, int | float]] = {}
        self.orders: dict[str, MboOrder] = {}
        self.last_mbo_sequence: int | None = None
        self.mbo_sequence_gaps = 0
        self._l2_pending_bids: dict[float, dict[str, int | float]] | None = None
        self._l2_pending_asks: dict[float, dict[str, int | float]] | None = None
        self._l2_batch_before_bids: dict[float, dict[str, int | float]] | None = None
        self._l2_batch_before_asks: dict[float, dict[str, int | float]] | None = None
        self._mbo_snapshot_orders: dict[str, MboOrder] | None = None
        self._mbo_snapshot_sequence: int | None = None
        self._mbo_buffer: list[dict[str, Any]] = []
        self._mbo_buffer_limit = 50_000
        self._mbo_buffer_overflow = False
        self._mbo_synchronized = False

    def reset(self) -> None:
        self.bids.clear()
        self.asks.clear()
        self.orders.clear()
        self.last_mbo_sequence = None
        self._l2_pending_bids = None
        self._l2_pending_asks = None
        self._l2_batch_before_bids = None
        self._l2_batch_before_asks = None
        self._mbo_snapshot_orders = None
        self._mbo_snapshot_sequence = None
        self._mbo_buffer.clear()
        self._mbo_buffer_overflow = False
        self._mbo_synchronized = False

    @staticmethod
    def _level_map(levels: list[dict[str, Any]]) -> dict[float, dict[str, int | float]]:
        result: dict[float, dict[str, int | float]] = {}
        for level in levels:
            price = level.get("price")
            if price is None:
                continue
            result[float(price)] = {
                key: value
                for key, value in level.items()
                if key in {"price", "size", "orders", "impliedSize"}
                and isinstance(value, (int, float))
            }
        return result

    @staticmethod
    def _apply_level_patch(
        target: dict[float, dict[str, int | float]],
        patch: dict[float, dict[str, int | float]],
    ) -> None:
        for price, level in patch.items():
            size = int(level.get("size", 0))
            implied = int(level.get("impliedSize", 0))
            orders = int(level.get("orders", 0))
            if size <= 0 and implied <= 0 and orders <= 0:
                target.pop(price, None)
            else:
                target[price] = level

    def apply_l2(self, message: dict[str, Any]) -> dict[str, Any] | None:
        """Apply an L2 frame and return one atomic compact level delta.

        Multipart BEGIN/MIDDLE/END frames do not expose their partial state.
        The returned rows contain only prices whose displayed size changed, so
        the downstream liquidity detector never needs a copy of the full book
        for each high-frequency SOLO update.
        """

        update_type = str(message.get("updateType") or "unknown")
        incoming_bids = self._level_map(list(message.get("bids") or []))
        incoming_asks = self._level_map(list(message.get("asks") or []))
        if update_type in {"clear", "no_book"}:
            before_bids = dict(self.bids)
            before_asks = dict(self.asks)
            self.bids.clear()
            self.asks.clear()
            self._l2_pending_bids = None
            self._l2_pending_asks = None
            self._l2_batch_before_bids = None
            self._l2_batch_before_asks = None
            return self._book_delta(
                before_bids,
                before_asks,
                self.bids,
                self.asks,
                message,
            )
        if update_type == "begin":
            self._l2_batch_before_bids = dict(self.bids)
            self._l2_batch_before_asks = dict(self.asks)
            self._l2_pending_bids = dict(self.bids)
            self._l2_pending_asks = dict(self.asks)
            self._apply_level_patch(self._l2_pending_bids, incoming_bids)
            self._apply_level_patch(self._l2_pending_asks, incoming_asks)
            return None
        if update_type in {"middle", "end"} and self._l2_pending_bids is not None:
            self._apply_level_patch(self._l2_pending_bids, incoming_bids)
            assert self._l2_pending_asks is not None
            self._apply_level_patch(self._l2_pending_asks, incoming_asks)
            if update_type == "end":
                before_bids = self._l2_batch_before_bids or {}
                before_asks = self._l2_batch_before_asks or {}
                self.bids = self._l2_pending_bids
                self.asks = self._l2_pending_asks
                self._l2_pending_bids = None
                self._l2_pending_asks = None
                self._l2_batch_before_bids = None
                self._l2_batch_before_asks = None
                return self._book_delta(
                    before_bids,
                    before_asks,
                    self.bids,
                    self.asks,
                    message,
                )
            return None
        if update_type == "snapshot":
            before_bids = self.bids
            before_asks = self.asks
            self.bids = incoming_bids
            self.asks = incoming_asks
            delta = self._book_delta(
                before_bids,
                before_asks,
                self.bids,
                self.asks,
                message,
            )
        else:
            # SOLO is an atomic incremental update. BEGIN/MIDDLE/END use a copy
            # and swap so readers never observe a partial batch.
            before_bids = {
                price: self.bids.get(price, {}) for price in incoming_bids
            }
            before_asks = {
                price: self.asks.get(price, {}) for price in incoming_asks
            }
            self._apply_level_patch(self.bids, incoming_bids)
            self._apply_level_patch(self.asks, incoming_asks)
            after_bids = {price: self.bids.get(price, {}) for price in incoming_bids}
            after_asks = {price: self.asks.get(price, {}) for price in incoming_asks}
            delta = self._book_delta(
                before_bids,
                before_asks,
                after_bids,
                after_asks,
                message,
            )
        self._l2_pending_bids = None
        self._l2_pending_asks = None
        self._l2_batch_before_bids = None
        self._l2_batch_before_asks = None
        return delta

    def _book_delta(
        self,
        before_bids: dict[float, dict[str, int | float]],
        before_asks: dict[float, dict[str, int | float]],
        after_bids: dict[float, dict[str, int | float]],
        after_asks: dict[float, dict[str, int | float]],
        message: dict[str, Any],
    ) -> dict[str, Any]:
        def changed(
            before: dict[float, dict[str, int | float]],
            after: dict[float, dict[str, int | float]],
        ) -> list[dict[str, int | float]]:
            rows: list[dict[str, int | float]] = []
            for price in sorted(set(before).union(after)):
                old_size = int(before.get(price, {}).get("size", 0))
                new_size = int(after.get(price, {}).get("size", 0))
                if old_size != new_size:
                    rows.append({"price": price, "size": new_size})
            return rows

        return {
            "time": int(message.get("timeMs") or 0),
            "bids": changed(before_bids, after_bids),
            "asks": changed(before_asks, after_asks),
        }

    def begin_mbo_snapshot(self) -> None:
        self._mbo_snapshot_orders = {}
        self._mbo_snapshot_sequence = None
        self._mbo_buffer.clear()
        self._mbo_buffer_overflow = False
        self._mbo_synchronized = False

    def apply_mbo_snapshot(self, message: dict[str, Any]) -> None:
        side = message.get("side")
        price = message.get("price")
        if side not in {"buy", "sell"} or price is None:
            return
        target = (
            self.orders
            if self._mbo_snapshot_orders is None
            else self._mbo_snapshot_orders
        )
        price_value = float(price)
        # A snapshot row is authoritative for one side/price level.
        stale = [
            order_id
            for order_id, order in target.items()
            if order.side == side and order.price == price_value
        ]
        for order_id in stale:
            target.pop(order_id, None)
        for raw in list(message.get("orders") or []):
            order_id = raw.get("exchangeOrderId")
            if not order_id:
                continue
            target[str(order_id)] = MboOrder(
                exchange_order_id=str(order_id),
                side=str(side),
                price=price_value,
                size=int(raw.get("size") or 0),
                priority=(
                    None if raw.get("priority") is None else int(raw["priority"])
                ),
            )
        sequence = message.get("sequence")
        if sequence is not None:
            value = int(sequence)
            if self._mbo_snapshot_orders is None:
                self.last_mbo_sequence = value
            else:
                self._mbo_snapshot_sequence = max(
                    value, self._mbo_snapshot_sequence or value
                )

    def finish_mbo_snapshot(self) -> bool:
        """Atomically install a snapshot then replay buffered numbered updates."""

        if self._mbo_snapshot_orders is None:
            return False
        self.orders = self._mbo_snapshot_orders
        self._mbo_snapshot_orders = None
        self.last_mbo_sequence = self._mbo_snapshot_sequence
        self._mbo_snapshot_sequence = None
        buffered = self._mbo_buffer
        self._mbo_buffer = []
        gap = self._mbo_buffer_overflow
        self._mbo_buffer_overflow = False
        for message in buffered:
            sequence = message.get("sequence")
            if (
                sequence is not None
                and self.last_mbo_sequence is not None
                and int(sequence) <= self.last_mbo_sequence
            ):
                continue
            gap = self._apply_mbo_update_now(message) or gap
        self._mbo_synchronized = not gap
        return gap

    def apply_mbo_update(self, message: dict[str, Any]) -> bool:
        """Apply MBO rows and return ``True`` when a sequence gap was seen."""

        if self._mbo_snapshot_orders is not None:
            if len(self._mbo_buffer) >= self._mbo_buffer_limit:
                self._mbo_buffer_overflow = True
                self.mbo_sequence_gaps += 1
                return True
            self._mbo_buffer.append(message)
            return False
        gap = self._apply_mbo_update_now(message)
        if gap:
            self._mbo_synchronized = False
        return gap

    def _apply_mbo_update_now(self, message: dict[str, Any]) -> bool:

        gap = False
        sequence_raw = message.get("sequence")
        if sequence_raw is not None:
            sequence = int(sequence_raw)
            if self.last_mbo_sequence is not None:
                if sequence <= self.last_mbo_sequence:
                    return False
                if sequence != self.last_mbo_sequence + 1:
                    self.mbo_sequence_gaps += 1
                    gap = True
            self.last_mbo_sequence = sequence

        for raw in list(message.get("updates") or []):
            order_id_raw = raw.get("exchangeOrderId")
            if not order_id_raw:
                continue
            order_id = str(order_id_raw)
            action = str(raw.get("action") or "")
            if action == "delete":
                self.orders.pop(order_id, None)
                continue
            prior = self.orders.get(order_id)
            side = raw.get("side") or (None if prior is None else prior.side)
            price = raw.get("price")
            if price is None and prior is not None:
                price = prior.price
            if side not in {"buy", "sell"} or price is None:
                continue
            size_raw = raw.get("size")
            size = (
                (0 if prior is None else prior.size)
                if size_raw is None
                else int(size_raw)
            )
            self.orders[order_id] = MboOrder(
                exchange_order_id=order_id,
                side=str(side),
                price=float(price),
                size=size,
                priority=(
                    prior.priority
                    if raw.get("priority") is None and prior is not None
                    else (
                        None
                        if raw.get("priority") is None
                        else int(raw["priority"])
                    )
                ),
            )
        return gap

    def metrics(self) -> dict[str, int | float | None]:
        buy_orders = sum(1 for order in self.orders.values() if order.side == "buy")
        sell_orders = len(self.orders) - buy_orders
        return {
            "l2BidLevels": len(self.bids),
            "l2AskLevels": len(self.asks),
            "mboOrders": len(self.orders),
            "mboBuyOrders": buy_orders,
            "mboSellOrders": sell_orders,
            "mboLastSequence": self.last_mbo_sequence,
            "mboSequenceGaps": self.mbo_sequence_gaps,
            "mboSynchronized": self._mbo_synchronized,
            "mboBufferedUpdates": len(self._mbo_buffer),
        }
