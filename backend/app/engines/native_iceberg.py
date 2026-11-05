"""Account for native icebergs from an ordered, synchronized MBO/trade stream.

Detection establishes executed quantity and observed same-ID replenishment; it
does not estimate the unadvertised reserve or join different order identities.
Only compact lifecycle changes leave this bounded in-memory processor.
"""

from __future__ import annotations

import math
from collections import Counter, OrderedDict, deque
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
    last_mbo_time: int | None = None
    last_mbo_nanos: int | None = None
    last_mbo_remainder: int | None = None
    last_mbo_size: int | None = None
    late_reduction_observed: bool = False
    status: str = "active"
    end_time: int | None = None


class NativeIcebergDetector:
    """Detect overfills and same-ID replenishment after an executed tranche.

    Snapshot images only seed visible remainders. ``invalidate`` must be called
    before resynchronization, disconnection, or another loss of stream fidelity.
    Unknown replacements never create candidates. An undetected order repriced
    on the same side starts a fresh visible baseline. Once detected, an ICE
    owns its exact-ID executions independently of candidate confirmation and
    price movement. Explicit terminal events, fresh NEW, reset and capacity
    still bound identities; closed ICE accounting never reopens an order.
    """

    def __init__(
        self,
        *,
        symbol: str = "GC",
        source_contract: str = "GC 12-26",
        max_orders: int = 100_000,
        max_completed_orders: int = 5000,
    ) -> None:
        if max_orders < 1:
            raise ValueError("max_orders must be positive")
        if max_completed_orders < 1:
            raise ValueError("max_completed_orders must be positive")
        self.symbol = symbol
        self.source_contract = source_contract
        self.max_orders = max_orders
        self.max_completed_orders = max_completed_orders
        self.session_id = uuid4().hex
        self.synchronized = False
        self._orders: OrderedDict[str, _Order] = OrderedDict()
        self._sequence = 0
        self._detected_orders: dict[str, _Order] = {}
        self._completed_orders: OrderedDict[str, _Order] = OrderedDict()
        self._dropped_orders = 0
        self._last_trade_sequence: int | None = None
        self._last_trade_time: int | None = None
        self._diagnostics: Counter[str] = Counter()
        self._last_mismatches: dict[str, dict[str, Any]] = {}
        self._last_overfill: dict[str, Any] | None = None
        self._identity_contexts: deque[dict[str, Any]] = deque(maxlen=10)

    def metrics(self) -> dict[str, Any]:
        return {
            "icebergSynchronized": self.synchronized,
            "icebergSessionId": self.session_id,
            "icebergDetectedOrders": len(self._detected_orders),
            "icebergTrackedOrders": len(self._orders),
            "icebergDroppedOrders": self._dropped_orders,
            "icebergMethod": "native",
            "icebergDiagnostics": dict(self._diagnostics),
            "icebergLastMismatches": dict(self._last_mismatches),
            "icebergLastOverfill": self._last_overfill,
            "icebergIdentityContexts": [dict(context) for context in self._identity_contexts],
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
        self._completed_orders.clear()
        self._last_trade_sequence = None
        self._last_trade_time = None
        self.synchronized = False
        if new_session:
            self.session_id = uuid4().hex
            self._sequence = 0
            self._last_overfill = None
            self._last_mismatches.clear()
            self._identity_contexts.clear()
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
        self._last_trade_time = max(trade.time, self._last_trade_time or trade.time)
        order_id = self._order_id(trade.passive_order_id)
        # SI h -> g -> l accounts already-confirmed IDs before the candidate
        # detector. Distinct known passive/aggressor IDs each own this execution;
        # the same ID appearing in both fields must not receive it twice.
        for known_id in dict.fromkeys((order_id, self._order_id(trade.aggressor_order_id))):
            known = self._detected_orders.get(known_id) or self._completed_orders.get(known_id)
            if known is not None and self._valid_price(trade.price):
                events.append(self._account_lifecycle_trade(known, trade))
        order = self._orders.get(order_id) if order_id is not None else None
        self._diagnostics["trade_known" if order is not None else "trade_unknown"] += 1
        if order is None or order.detected is not None:
            return events
        if trade.side not in {Side.BUY, Side.SELL}:
            # An unclassified execution cannot update an order safely. Forget
            # it so later executions cannot manufacture an apparent overfill.
            return events + self._remove(order, trade.time, "invalidated", "unclassified_trade")
        passive_side = "sell" if trade.side == Side.BUY else "buy"
        if passive_side != order.side or not self._same_price(trade.price, order.price):
            self._record_identity_context(
                "trade_mismatch", order, trade.time, passive_side, trade.price,
                trade.source_time_nanos or trade.time * 1_000_000,
            )
            self._last_mismatches["trade"] = {
                "orderId": order.order_id, "time": trade.time,
                "trackedSide": order.side, "trackedPrice": order.price,
                "side": passive_side, "price": trade.price,
            }
            return events + self._remove(order, trade.time, "invalidated", "trade_side_price")
        self._orders.move_to_end(order.order_id)
        trade_nanos = trade.source_time_nanos or trade.time * 1_000_000
        if order.last_mbo_nanos is not None and trade_nanos <= order.last_mbo_nanos:
            self._diagnostics["trade_not_after_last_mbo"] += 1
            reduction = (order.last_mbo_remainder or 0) - (order.last_mbo_size or 0)
            if reduction >= trade.volume and order.last_mbo_nanos - trade_nanos <= 1_000_000_000:
                self._diagnostics["trade_matches_prior_size_reduction"] += 1
                order.late_reduction_observed = True
        order.executed += trade.volume
        order.remainder -= trade.volume
        order.last_trade = trade.time
        if order.detected is None and order.remainder < 0:
            self._last_overfill = {
                "sessionId": self.session_id, "orderId": order.order_id,
                "time": trade.time, "volume": trade.volume,
                "remainderBefore": order.remainder + trade.volume,
                "lastMboTime": order.last_mbo_time,
                "lastMboNanos": order.last_mbo_nanos, "tradeNanos": trade_nanos,
                "remainderBeforeMbo": order.last_mbo_remainder,
                "mboSize": order.last_mbo_size,
                "lateReductionObserved": order.late_reduction_observed,
            }
            if order.late_reduction_observed:
                self._diagnostics["overfill_after_late_reduction"] += 1
            self._detect(order, trade.time, "overfill")
        if order.detected is not None:
            events.append(self._event(order, trade.time))
        return events

    def _account_lifecycle_trade(self, order: _Order, trade: NormalizedTrade) -> dict:
        """Account a known identity, never confirm a candidate or infer a refill."""
        order.price = float(trade.price)
        order.executed += trade.volume
        order.remainder -= trade.volume
        order.last_trade = max(order.last_trade or trade.time, trade.time)
        if order.status == "active":
            self._orders.move_to_end(order.order_id)
        else:
            self._completed_orders.move_to_end(order.order_id)
        return self._event(order, max(order.last_event or trade.time, trade.time))

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
            action_name = action if action in {"new", "change", "delete"} else "unknown"
            self._diagnostics[f"{action_name}_{'known' if order is not None else 'unknown'}"] += 1
            if action == "delete":
                if order is not None:
                    status = "executed" if order.remainder <= 0 else "canceled"
                    events.extend(self._remove(order, time, status))
                continue
            if action == "new":
                # A fresh advertisement starts a candidate, even if an ID was
                # reused. Never carry executed volume over that boundary.
                self._completed_orders.pop(order_id, None)
                if order is not None:
                    events.extend(self._remove(order, time, "invalidated", "new_identity"))
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
                self._orders[order_id] = _Order(
                    order_id, side, float(price), size, time,
                    last_mbo_time=time,
                    last_mbo_nanos=int(message.get("sourceTimeNanos") or time * 1_000_000),
                    last_mbo_size=size,
                )
                continue
            if action != "change":
                if order is not None:
                    events.extend(self._remove(order, time, "invalidated", "unknown_action"))
                continue
            if order is None:
                continue
            side = update.get("side", order.side)
            price = update.get("price", order.price)
            if side != order.side or not self._same_price(price, order.price):
                size = update.get("size")
                if (
                    order.detected is not None and side == order.side
                    and self._valid_price(price) and isinstance(size, int) and size >= 0
                ):
                    # Original n.replace moves a known ICE without discarding
                    # executions. A move alone is not a same-price refill.
                    order.price = float(price)
                    if size > 0:
                        order.last_mbo_time = time
                        order.last_mbo_nanos = int(message.get("sourceTimeNanos") or time * 1_000_000)
                        order.last_mbo_remainder = order.remainder
                        order.last_mbo_size = size
                        order.late_reduction_observed = False
                        order.remainder = size
                    self._orders.move_to_end(order_id)
                    events.append(self._event(order, time))
                    continue
                if (
                    order.detected is None and side == order.side
                    and self._valid_price(price) and isinstance(size, int) and size > 0
                ):
                    self._record_identity_context(
                        "candidate_reprice", order, time, side, price,
                        int(message.get("sourceTimeNanos") or time * 1_000_000),
                    )
                    if order.remainder == 0 and order.last_trade is not None:
                        self._diagnostics["exhausted_candidate_reprice"] += 1
                    # A complete same-side reprice is authoritative for the
                    # currently visible order. Earlier fills do not establish
                    # an iceberg at its new price; start accounting from zero.
                    self._orders[order_id] = _Order(
                        order_id, side, float(price), size, time,
                        last_mbo_time=time,
                        last_mbo_nanos=int(message.get("sourceTimeNanos") or time * 1_000_000),
                        last_mbo_size=size,
                    )
                    self._orders.move_to_end(order_id)
                    self._diagnostics["candidate_repriced"] += 1
                    continue
                self._record_identity_context(
                    "mbo_mismatch", order, time, side, price,
                    message.get("sourceTimeNanos") or time * 1_000_000,
                )
                self._last_mismatches["mbo"] = {
                    "orderId": order.order_id, "time": time,
                    "trackedSide": order.side, "trackedPrice": order.price,
                    "side": side, "price": price,
                }
                events.extend(self._remove(order, time, "invalidated", "mbo_side_price"))
                continue
            size = update.get("size")
            if size is None:
                continue
            if not isinstance(size, int) or size < 0:
                events.extend(self._remove(order, time, "invalidated", "invalid_size"))
                continue
            if size == 0:
                if order.detected is not None or (order.remainder <= 0 and order.last_trade is not None):
                    # An exhausted tranche may advertise zero before its
                    # replacement. SI n.replace ignores zero quantity for a
                    # known ICE; it is not an explicit terminal event.
                    if order.detected is not None:
                        events.append(self._event(order, time))
                else:
                    # Zero after a partial fill could be a withdrawal. Do not
                    # turn that zero into evidence of execution exhaustion.
                    events.extend(self._remove(order, time, "invalidated", "zero_size"))
                continue
            if order.remainder <= 0 and order.last_trade is not None:
                order.refills += 1
                if order.detected is None and order.remainder == 0:
                    self._detect(order, time, "refill")
            order.last_mbo_time = time
            order.last_mbo_nanos = int(message.get("sourceTimeNanos") or time * 1_000_000)
            order.last_mbo_remainder = order.remainder
            order.last_mbo_size = size
            order.late_reduction_observed = False
            order.remainder = size
            self._orders.move_to_end(order.order_id)
            if order.detected is not None:
                events.append(self._event(order, time))
        return events

    def _record_identity_context(
        self, kind: str, order: _Order, time: int, side: Any, price: Any,
        source_nanos: Any,
    ) -> None:
        """Keep only bounded summaries of accounting discarded at a boundary."""
        self._identity_contexts.append({
            "kind": kind, "sessionId": self.session_id, "orderId": order.order_id,
            "time": time,
            "sourceTimeNanos": source_nanos if isinstance(source_nanos, int) else None,
            "oldSide": order.side, "oldPrice": order.price,
            "newSide": side if isinstance(side, str) and side in {"buy", "sell"} else None,
            "newPrice": float(price) if self._valid_price(price) else None,
            "remainderBefore": order.remainder, "executedVolume": order.executed,
            "refillCount": order.refills, "detected": order.detected is not None,
            "detectedTime": order.detected, "firstSeenTime": order.first_seen,
            "lastTradeTime": order.last_trade, "lastMboTime": order.last_mbo_time,
            "lastMboNanos": order.last_mbo_nanos,
        })

    def _detect(self, order: _Order, time: int, reason: str) -> None:
        self._diagnostics[f"detected_{reason}"] += 1
        order.detected = time
        order.reason = reason
        self._detected_orders[order.order_id] = order

    def _remove(self, order: _Order, time: int, status: str, reason: str | None = None) -> list[dict]:
        self._diagnostics[f"removed_{reason or status}"] += 1
        if order.detected is not None:
            self._diagnostics[f"ended_{reason or status}"] += 1
        self._orders.pop(order.order_id, None)
        if order.detected is None:
            return []
        self._detected_orders.pop(order.order_id, None)
        if status in {"executed", "canceled"}:
            # h.cancel retains the ended lifecycle for late exact-ID executions.
            # Keep that history bounded and never carry it across NEW or reset.
            self._completed_orders[order.order_id] = order
            self._completed_orders.move_to_end(order.order_id)
            if len(self._completed_orders) > self.max_completed_orders:
                self._completed_orders.popitem(last=False)
                self._diagnostics["completed_evicted"] += 1
        return [self._event(order, time, status)]

    def _event(self, order: _Order, time: int, status: str | None = None) -> dict:
        if status is not None:
            order.status = status
            order.end_time = None if status == "active" else time
        status = order.status
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
            "endTime": order.end_time,
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
