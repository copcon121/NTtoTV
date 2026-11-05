"""Independent SI 2.08 stop-chain state machine over ordered live Rithmic events.

Only completed chains leave this processor. Missing IDs/unclassified trades and
stream resets discard provisional chains, rather than saving unretractable marks.
The initial aggressor is a seed, not counted execution volume. See SI-STOPS.md.
"""

from __future__ import annotations

import math
from collections import Counter, OrderedDict
from dataclasses import dataclass, field
from typing import Any, Iterable
from uuid import uuid4

from ..models.canonical import NormalizedTrade, Side
from ..models.si_stops import SiStopChain


@dataclass(slots=True)
class _Chain:
    number: int
    side: str
    start_time: int
    first_price: float
    time: int = 0
    price: float = 0
    volume: int = 0
    executions: int = 0
    price_volume: float = 0
    aggressors: set[str] = field(default_factory=set)


class SiStopEngine:
    def __init__(self, *, symbol: str = "GC", source_contract: str = "GC 12-26",
                 max_orders: int = 100_000, max_aggressors: int = 10_000) -> None:
        if min(max_orders, max_aggressors) < 1:
            raise ValueError("SI Stops bounds must be positive")
        self.symbol, self.source_contract = symbol, source_contract
        self.max_orders, self.max_aggressors = max_orders, max_aggressors
        self.session_id = uuid4().hex
        self.synchronized = False
        self._known: OrderedDict[str, None] = OrderedDict()
        self._armed = False
        self._seed: str | None = None
        self._pending: _Chain | None = None
        self._number = self._sequence = 0
        self._last_trade_sequence: int | None = None
        self._last_trade_nanos: int | None = None
        self._counts: Counter[str] = Counter()

    def reset(self) -> None:
        self._discard("reset")
        self._known.clear()
        self.synchronized = False
        self.session_id = uuid4().hex
        self._number = self._sequence = 0
        self._last_trade_sequence = self._last_trade_nanos = None

    def seed_orders(self, orders: Iterable[Any]) -> None:
        """Seed current IDs only; never replay executions from an image."""
        self._discard("snapshot")
        self._known.clear()
        for order in orders:
            order_id = self._order_id(order.exchange_order_id)
            if order_id is not None:
                self._remember(order_id)
        self.synchronized = True
        # Image send callbacks arm SI, but they cannot establish a stop chain.
        self._armed = bool(self._known)

    def metrics(self) -> dict[str, Any]:
        return {
            "siStopsSessionId": self.session_id, "siStopsSynchronized": self.synchronized,
            "siStopsMethod": "aggressor_chain", "siStopsTrackedOrders": len(self._known),
            "siStopsPendingVolume": self._pending.volume if self._pending else 0,
            "siStopsDiagnostics": dict(self._counts),
        }

    def on_trade(self, trade: NormalizedTrade) -> None:
        if (not self.synchronized or trade.symbol != self.symbol
                or trade.contract != self.source_contract or trade.source != "rithmic"
                or trade.volume <= 0 or trade.otc):
            return
        if self._last_trade_sequence is not None and trade.sequence <= self._last_trade_sequence:
            return
        self._last_trade_sequence = trade.sequence
        nanos = trade.source_time_nanos or trade.time * 1_000_000
        if self._last_trade_nanos is not None and nanos < self._last_trade_nanos:
            self._discard("late_trade")
            return
        self._last_trade_nanos = nanos
        aggressor_id = self._order_id(trade.aggressor_order_id)
        if (aggressor_id is None or trade.side not in {Side.BUY, Side.SELL}
                or not self._price(trade.price)):
            self._discard("invalid_trade")
            return
        if not self._armed:
            return
        side = trade.side.value
        if self._pending is not None and self._pending.side != side:
            self._discard("opposite_side")
            return
        if self._seed is None:
            self._seed = aggressor_id
        elif self._pending is None and aggressor_id != self._seed:
            self._number += 1
            self._pending = _Chain(self._number, side, trade.time, trade.price)
        if self._pending is None:
            return
        chain = self._pending
        if aggressor_id not in chain.aggressors and len(chain.aggressors) >= self.max_aggressors:
            self._discard("aggressor_limit")
            return
        chain.aggressors.add(aggressor_id)
        chain.time, chain.price = trade.time, trade.price
        chain.volume += trade.volume
        chain.executions += 1
        chain.price_volume += trade.price * trade.volume

    def on_mbo_update(self, message: dict[str, Any], time: int) -> list[dict[str, Any]]:
        if not self.synchronized:
            return []
        events = []
        for row in message.get("updates") or []:
            order_id = self._order_id(row.get("exchangeOrderId"))
            if order_id is None:
                self._discard("invalid_mbo")
                continue
            action = row.get("action")
            known = order_id in self._known
            if action == "new":
                if known:
                    continue  # SI's accepted-ID wrapper drops duplicate sends.
                if (row.get("side") not in {"buy", "sell"} or not self._price(row.get("price"))
                        or not isinstance(row.get("size"), int) or row["size"] <= 0):
                    self._discard("invalid_mbo")
                    continue
                self._remember(order_id)
            elif action in {"change", "delete"}:
                if not known:
                    continue
                if action == "delete":
                    self._known.pop(order_id)
                else:
                    if (("side" in row and row["side"] not in {"buy", "sell"})
                            or ("price" in row and not self._price(row["price"]))
                            or ("size" in row and (not isinstance(row["size"], int) or row["size"] < 0))):
                        self._known.pop(order_id)
                        self._discard("invalid_mbo")
                        continue
                    self._known.move_to_end(order_id)
            else:
                self._discard("invalid_mbo")
                continue
            events.extend(self._boundary(time, "mbo"))
            self._armed = True
        return events

    def on_depth(self, time: int) -> list[dict[str, Any]]:
        return self._boundary(time, "depth") if self.synchronized else []

    def _boundary(self, time: int, reason: str) -> list[dict[str, Any]]:
        chain = self._pending
        self._pending = None
        self._seed = None
        if chain is None:
            return []
        if time < chain.time:
            self._counts["stale_boundary"] += 1
            self._armed = False
            return []
        self._sequence += 1
        self._counts["completed"] += 1
        return [SiStopChain(
            symbol=self.symbol, contract=self.symbol, source_contract=self.source_contract,
            session_id=self.session_id, chain_id=f"{self.session_id}:{chain.number}",
            sequence=self._sequence, side=chain.side, time=chain.time,
            start_time=chain.start_time, completed_time=time, price=chain.price,
            first_price=chain.first_price, vwap=chain.price_volume / chain.volume,
            executed_volume=chain.volume, execution_count=chain.executions,
            aggressor_count=len(chain.aggressors), end_reason=reason,
        ).to_dict()]

    def _discard(self, reason: str) -> None:
        if self._pending is not None:
            self._counts[f"discarded_{reason}"] += 1
        self._pending = None
        self._seed = None
        self._armed = False

    def _remember(self, order_id: str) -> None:
        if len(self._known) >= self.max_orders:
            self._known.popitem(last=False)
            self._counts["evicted_orders"] += 1
            self._discard("order_limit")
        self._known[order_id] = None

    @staticmethod
    def _order_id(value: Any) -> str | None:
        result = "" if value is None else str(value).strip()
        return result if result and result != "0" else None

    @staticmethod
    def _price(value: Any) -> bool:
        return isinstance(value, (float, int)) and math.isfinite(value) and value > 0
