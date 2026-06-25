"""Deterministic fake MT5 backend for tests and local safe development."""

from __future__ import annotations

from itertools import count

from ..models.mt5 import Mt5AccountInfo, Mt5OrderResult, Mt5SymbolInfo, Mt5Tick
from ..models.orders import OrderKind, OrderRecord
from ..models.timestamp import now_ms

__all__ = ["FakeMt5Backend"]


class FakeMt5Backend:
    def __init__(
        self,
        *,
        symbol: str = "XAUUSDm",
        bid: float = 2350.0,
        ask: float = 2350.1,
        tick_size: float = 0.01,
        digits: int = 2,
    ) -> None:
        self._symbol = symbol
        self._bid = bid
        self._ask = ask
        self._tick_size = tick_size
        self._digits = digits
        self._order_tickets = count(100_000)
        self._position_tickets = count(200_000)
        self._deal_tickets = count(300_000)
        self._orders: dict[int, dict] = {}
        self._positions: dict[int, dict] = {}

    def set_tick(self, bid: float, ask: float) -> None:
        self._bid = bid
        self._ask = ask

    def account_info(self, user_id: str, account_id: str) -> Mt5AccountInfo:
        return Mt5AccountInfo(
            account_id=account_id,
            login=1,
            server="Fake-Demo",
            trade_mode="demo",
            currency="USD",
            balance=10_000.0,
            equity=10_000.0,
            margin=0.0,
            free_margin=10_000.0,
        )

    def symbol_info(self, user_id: str, account_id: str, symbol: str) -> Mt5SymbolInfo:
        return Mt5SymbolInfo(
            symbol=symbol or self._symbol,
            digits=self._digits,
            tick_size=self._tick_size,
            min_lot=0.01,
            max_lot=50.0,
            lot_step=0.01,
            stops_level=0.50,
            pip_value=1.0,
        )

    def symbol_tick(self, user_id: str, account_id: str, symbol: str) -> Mt5Tick:
        return Mt5Tick(symbol=symbol or self._symbol, bid=self._bid, ask=self._ask, time=now_ms())

    def place_order(self, order: OrderRecord) -> Mt5OrderResult:
        if order.volume_lots <= 0:
            return Mt5OrderResult(
                accepted=False,
                status="rejected",
                error_code="invalid_volume",
                error_message="Volume must be positive",
            )
        if order.kind is OrderKind.MARKET:
            fill = self._ask if order.side.value == "buy" else self._bid
            position_ticket = next(self._position_tickets)
            deal_ticket = next(self._deal_tickets)
            self._positions[position_ticket] = {
                "ticket": position_ticket,
                "orderId": order.id,
                "side": order.side.value,
                "volumeLots": order.volume_lots,
                "entryBroker": round(fill, self._digits),
                "slBroker": order.sl_broker,
                "tpBroker": order.tp_broker,
                "time": now_ms(),
            }
            return Mt5OrderResult(
                accepted=True,
                status="filled",
                broker_position_ticket=position_ticket,
                broker_deal_ticket=deal_ticket,
                fill_price=round(fill, self._digits),
            )
        order_ticket = next(self._order_tickets)
        self._orders[order_ticket] = {
            "ticket": order_ticket,
            "orderId": order.id,
            "side": order.side.value,
            "kind": order.kind.value,
            "volumeLots": order.volume_lots,
            "entryBroker": order.entry_broker,
            "slBroker": order.sl_broker,
            "tpBroker": order.tp_broker,
            "time": now_ms(),
        }
        return Mt5OrderResult(
            accepted=True,
            status="working",
            broker_order_ticket=order_ticket,
        )

    def modify_order(self, order: OrderRecord) -> Mt5OrderResult:
        if order.broker_order_ticket in self._orders:
            self._orders[order.broker_order_ticket].update(
                {
                    "entryBroker": order.entry_broker,
                    "slBroker": order.sl_broker,
                    "tpBroker": order.tp_broker,
                    "time": now_ms(),
                }
            )
        if order.broker_position_ticket in self._positions:
            self._positions[order.broker_position_ticket].update(
                {
                    "slBroker": order.sl_broker,
                    "tpBroker": order.tp_broker,
                    "time": now_ms(),
                }
            )
        return Mt5OrderResult(accepted=True, status=order.status.value)

    def cancel_order(self, order: OrderRecord) -> Mt5OrderResult:
        if order.broker_order_ticket is not None:
            self._orders.pop(order.broker_order_ticket, None)
        return Mt5OrderResult(accepted=True, status="cancelled")

    def close_position(self, order: OrderRecord) -> Mt5OrderResult:
        if order.broker_position_ticket is not None:
            position = self._positions.get(order.broker_position_ticket)
            if position is not None:
                remaining = float(position.get("volumeLots") or 0.0) - order.volume_lots
                if remaining > 1e-9:
                    position["volumeLots"] = round(remaining, 10)
                    position["time"] = now_ms()
                else:
                    self._positions.pop(order.broker_position_ticket, None)
        return Mt5OrderResult(
            accepted=True,
            status="closed",
            broker_deal_ticket=next(self._deal_tickets),
        )

    def orders(self, user_id: str, account_id: str) -> list[dict]:
        return list(self._orders.values())

    def positions(self, user_id: str, account_id: str) -> list[dict]:
        return list(self._positions.values())
