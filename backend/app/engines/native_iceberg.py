"""Account for native icebergs from an ordered, synchronized MBO/trade stream.

Detection establishes executed quantity and observed same-ID replenishment; it
does not estimate the unadvertised reserve or join different order identities.
Only compact lifecycle changes leave this bounded in-memory processor.
"""

from __future__ import annotations

import math
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any, Iterable, Protocol
from uuid import uuid4

from ..models.canonical import NormalizedTrade, Side


class _VisibleOrder(Protocol):
    exchange_order_id: str
    side: str
    price: float
    size: int


@dataclass(slots=True)
class _Order:
    order_id: str
    side: str
    price: float
    remainder: int
    first_seen: int
    executed: int = 0
    refills: int = 0
    detected: int | None = None
    last_trade: int | None = None
    reason: str | None = None
    last_event: int | None = None


class NativeIcebergDetector:
    """Detect overfills and same-ID replenishment after an executed tranche.

    Snapshot images only seed visible remainders. ``invalidate`` must be called
    before resynchronization, disconnection, or another loss of stream fidelity.
    Unknown replacements never create candidates. A changed side/price removes
    the candidate rather than inferring a relationship to a different order.
    """

    def __init__(
        self,
        *,
        symbol: str = "GC",
        source_contract: str = "GC 12-26",
        max_orders: int = 100_000,
    ) -> None:
        if max_orders < 1:
            raise ValueError("max_orders must be positive")
        self.symbol = symbol
        self.source_contract = source_contract
        self.max_orders = max_orders
        self.session_id = uuid4().hex
        self.synchronized = False
        self._orders: OrderedDict[str, _Order] = OrderedDict()
        self._sequence = 0
        self._detected_orders: dict[str, _Order] = {}
        self._dropped_orders = 0
        self._last_trade_sequence: int | None = None
        self._last_trade_time: int | None = None

    def metrics(self) -> dict[str, Any]:
        return {
            "icebergSynchronized": self.synchronized,
            "icebergSessionId": self.session_id,
            "icebergDetectedOrders": len(self._detected_orders),
            "icebergTrackedOrders": len(self._orders),
            "icebergDroppedOrders": self._dropped_orders,
            "icebergMethod": "native",
        }

    def invalidate(self, time: int, *, new_session: bool = True) -> list[dict]:
        """End detected orders under their old identity, then clear all state."""

        events = [
            self._event(order, time, "invalidated")
            for order in self._orders.values()
            if order.detected is not None
        ]
        self._orders.clear()
        self._detected_orders.clear()
        self._last_trade_sequence = None
        self._last_trade_time = None
        self.synchronized = False
        if new_session:
            self.session_id = uuid4().hex
            self._sequence = 0
        return events

    def seed_orders(self, orders: Iterable[_VisibleOrder], time: int) -> list[dict]:
        """Seed the completed current book without replaying historical fills."""

        events = self.invalidate(time, new_session=False)
        for visible in orders:
            order_id = self._order_id(visible.exchange_order_id)
            if (
                order_id is None
                or visible.side not in {"buy", "sell"}
                or not self._valid_price(visible.price)
                or visible.size <= 0
            ):
                continue
            if len(self._orders) >= self.max_orders:
                self._dropped_orders += 1
                continue
            self._orders[order_id] = _Order(
                order_id, visible.side, float(visible.price), int(visible.size), time
            )
        self.synchronized = True
        return events

    def on_trade(self, trade: NormalizedTrade) -> list[dict]:
        if (
            not self.synchronized
            or trade.symbol != self.symbol
            or trade.contract != self.source_contract
            or trade.volume <= 0
            or trade.otc
        ):
            return []
        if self._last_trade_sequence is not None and trade.sequence <= self._last_trade_sequence:
            return []
        self._last_trade_sequence = trade.sequence
        events = []
        if self._last_trade_time is None or trade.time >= self._last_trade_time:
            events = self._invalidate_crossed(trade)
        self._last_trade_time = max(trade.time, self._last_trade_time or trade.time)
        order_id = self._order_id(trade.passive_order_id)
        order = self._orders.get(order_id) if order_id is not None else None
        if order is None:
            return events
        if trade.side not in {Side.BUY, Side.SELL}:
            # An unclassified execution cannot update an order safely. Forget
            # it so later executions cannot manufacture an apparent overfill.
            return events + self._remove(order, trade.time, "invalidated")
        passive_side = "sell" if trade.side == Side.BUY else "buy"
        if passive_side != order.side or not self._same_price(trade.price, order.price):
            return events + self._remove(order, trade.time, "invalidated")
        self._orders.move_to_end(order.order_id)
        order.executed += trade.volume
        order.remainder -= trade.volume
        order.last_trade = trade.time
        if order.detected is None and order.remainder < 0:
            self._detect(order, trade.time, "overfill")
        if order.detected is not None:
            events.append(self._event(order, trade.time))
        return events

    def _invalidate_crossed(self, trade: NormalizedTrade) -> list[dict]:
        """A regular trade through a resting level invalidates its old identity.

        Do not infer execution quantity or a hidden reserve from another order's
        trade. Only detected orders are scanned, never the full candidate book.
        """
        if trade.side not in {Side.BUY, Side.SELL} or not self._valid_price(trade.price):
            return []
        events = []
        for order in tuple(self._detected_orders.values()):
            if trade.time < max(order.last_event or 0, order.last_trade or 0):
                continue
            through = trade.price < order.price if order.side == "buy" else trade.price > order.price
            if through and not self._same_price(trade.price, order.price):
                events.extend(self._remove(order, trade.time, "invalidated"))
        return events

    def on_mbo_update(self, message: dict[str, Any], time: int) -> list[dict]:
        if not self.synchronized:
            return []
        events: list[dict] = []
        for update in message.get("updates") or []:
            order_id = self._order_id(update.get("exchangeOrderId"))
            if order_id is None:
                continue
            action = update.get("action")
            order = self._orders.get(order_id)
            if action == "delete":
                if order is not None:
                    status = "executed" if order.remainder <= 0 else "canceled"
                    events.extend(self._remove(order, time, status))
                continue
            if action == "new":
                # A fresh advertisement starts a candidate, even if an ID was
                # reused. Never carry executed volume over that boundary.
                if order is not None:
                    events.extend(self._remove(order, time, "invalidated"))
                side, price, size = update.get("side"), update.get("price"), update.get("size")
                if (
                    side not in {"buy", "sell"}
                    or not self._valid_price(price)
                    or not isinstance(size, int)
                    or size <= 0
                ):
                    continue
                if len(self._orders) >= self.max_orders:
                    _, evicted = self._orders.popitem(last=False)
                    self._dropped_orders += 1
                    if evicted.detected is not None:
                        self._detected_orders.pop(evicted.order_id, None)
                        events.append(self._event(evicted, time, "invalidated"))
                self._orders[order_id] = _Order(order_id, side, float(price), size, time)
                continue
            if action != "change":
                if order is not None:
                    events.extend(self._remove(order, time, "invalidated"))
                continue
            if order is None:
                continue
            side = update.get("side", order.side)
            price = update.get("price", order.price)
            if side != order.side or not self._same_price(price, order.price):
                events.extend(self._remove(order, time, "invalidated"))
                continue
            size = update.get("size")
            if size is None:
                continue
            if not isinstance(size, int) or size < 0:
                events.extend(self._remove(order, time, "invalidated"))
                continue
            if size == 0:
                if order.remainder <= 0 and order.last_trade is not None:
                    # An exhausted tranche may advertise zero before its
                    # replacement. Only DELETE ends the exchange identity.
                    if order.detected is not None:
                        events.append(self._event(order, time))
                else:
                    # Zero after a partial fill could be a withdrawal. Do not
                    # turn that zero into evidence of execution exhaustion.
                    events.extend(self._remove(order, time, "invalidated"))
                continue
            if order.remainder <= 0 and order.last_trade is not None:
                order.refills += 1
                if order.detected is None and order.remainder == 0:
                    self._detect(order, time, "refill")
            order.remainder = size
            self._orders.move_to_end(order.order_id)
            if order.detected is not None:
                events.append(self._event(order, time))
        return events

    def _detect(self, order: _Order, time: int, reason: str) -> None:
        order.detected = time
        order.reason = reason
        self._detected_orders[order.order_id] = order

    def _remove(self, order: _Order, time: int, status: str) -> list[dict]:
        self._orders.pop(order.order_id, None)
        if order.detected is None:
            return []
        self._detected_orders.pop(order.order_id, None)
        return [self._event(order, time, status)]

    def _event(self, order: _Order, time: int, status: str = "active") -> dict:
        self._sequence += 1
        order.last_event = max(order.last_event or time, time)
        return {
            "type": "iceberg_update",
            "symbol": self.symbol,
            "contract": self.symbol,
            "source": "rithmic",
            "sourceContract": self.source_contract,
            "sessionId": self.session_id,
            "orderId": order.order_id,
            "side": order.side,
            "price": order.price,
            "time": time,
            "firstSeenTime": order.first_seen,
            "detectedTime": order.detected,
            "lastTradeTime": order.last_trade,
            "endTime": None if status == "active" else time,
            "executedVolume": order.executed,
            "displayedSize": max(0, order.remainder),
            "refillCount": order.refills,
            "status": status,
            "detectionReason": order.reason,
            "sequence": self._sequence,
            "method": "native",
        }

    @staticmethod
    def _order_id(value: Any) -> str | None:
        if value is None:
            return None
        result = str(value).strip()
        return result if result and result != "0" else None

    @staticmethod
    def _valid_price(value: Any) -> bool:
        return isinstance(value, (int, float)) and math.isfinite(value) and value > 0

    @classmethod
    def _same_price(cls, value: Any, expected: float) -> bool:
        return cls._valid_price(value) and math.isclose(value, expected, rel_tol=0.0, abs_tol=1e-8)
