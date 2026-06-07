"""Optional real MetaTrader5 backend.

This module imports the `MetaTrader5` Python package only inside the real backend
constructor so CI/local fake mode does not require the package. The initial real
path attaches to the currently logged-in terminal; credential/login orchestration
can be layered behind the same interface later.
"""

from __future__ import annotations

import importlib
from typing import Any

from ..config import Settings, settings as default_settings
from ..models.mt5 import Mt5AccountInfo, Mt5OrderResult, Mt5SymbolInfo, Mt5Tick
from ..models.orders import OrderKind, OrderRecord, OrderSide
from ..models.timestamp import now_ms

__all__ = ["RealMt5Backend"]


class RealMt5Backend:
    def __init__(
        self,
        *,
        settings: Settings | None = None,
        terminal_path: str | None = None,
    ) -> None:
        self._settings = settings or default_settings
        self._terminal_path = terminal_path
        self._mt5 = importlib.import_module("MetaTrader5")
        self._initialized = False

    def _ensure(self) -> None:
        if self._initialized:
            return
        if self._terminal_path:
            ok = self._mt5.initialize(path=self._terminal_path)
        else:
            ok = self._mt5.initialize()
        if not ok:
            code, message = self._mt5.last_error()
            raise RuntimeError(f"MetaTrader5 initialize failed: {code} {message}")
        self._initialized = True

    def account_info(self, user_id: str, account_id: str) -> Mt5AccountInfo:
        self._ensure()
        info = self._mt5.account_info()
        if info is None:
            code, message = self._mt5.last_error()
            raise RuntimeError(f"MetaTrader5 account_info failed: {code} {message}")
        mode = "demo" if int(getattr(info, "trade_mode", 0)) == 0 else "live"
        return Mt5AccountInfo(
            account_id=account_id,
            login=int(info.login),
            server=str(info.server),
            trade_mode=mode,
            currency=str(info.currency),
            balance=float(info.balance),
            equity=float(info.equity),
            margin=float(info.margin),
            free_margin=float(info.margin_free),
        )

    def symbol_info(self, user_id: str, account_id: str, symbol: str) -> Mt5SymbolInfo:
        self._ensure()
        info = self._mt5.symbol_info(symbol)
        if info is None:
            raise RuntimeError(f"Unknown MT5 symbol {symbol!r}")
        if not info.visible:
            self._mt5.symbol_select(symbol, True)
        tick_size = float(getattr(info, "trade_tick_size", 0.0) or info.point)
        return Mt5SymbolInfo(
            symbol=symbol,
            digits=int(info.digits),
            tick_size=tick_size,
            min_lot=float(info.volume_min),
            max_lot=float(info.volume_max),
            lot_step=float(info.volume_step),
            stops_level=float(info.trade_stops_level) * float(info.point),
            pip_value=float(getattr(info, "trade_tick_value", 1.0) or 1.0),
        )

    def symbol_tick(self, user_id: str, account_id: str, symbol: str) -> Mt5Tick:
        self._ensure()
        tick = self._mt5.symbol_info_tick(symbol)
        if tick is None:
            code, message = self._mt5.last_error()
            raise RuntimeError(f"MetaTrader5 symbol tick failed: {code} {message}")
        return Mt5Tick(symbol=symbol, bid=float(tick.bid), ask=float(tick.ask), time=now_ms())

    def place_order(self, order: OrderRecord) -> Mt5OrderResult:
        self._ensure()
        tick = self._mt5.symbol_info_tick(order.symbol_broker)
        if tick is None:
            return Mt5OrderResult(False, "rejected", error_code="no_tick", error_message="No broker tick")
        request: dict[str, Any] = {
            "symbol": order.symbol_broker,
            "volume": order.volume_lots,
            "sl": order.sl_broker or 0.0,
            "tp": order.tp_broker or 0.0,
            "deviation": 20,
            "magic": 240606,
            "comment": f"NTtoTV {order.id}",
            "type_time": self._mt5.ORDER_TIME_GTC,
            "type_filling": self._mt5.ORDER_FILLING_IOC,
        }
        if order.kind is OrderKind.MARKET:
            request["action"] = self._mt5.TRADE_ACTION_DEAL
            request["type"] = (
                self._mt5.ORDER_TYPE_BUY
                if order.side is OrderSide.BUY
                else self._mt5.ORDER_TYPE_SELL
            )
            request["price"] = float(tick.ask if order.side is OrderSide.BUY else tick.bid)
        else:
            request["action"] = self._mt5.TRADE_ACTION_PENDING
            request["type"] = _pending_type(self._mt5, order)
            request["price"] = order.entry_broker
        result = self._mt5.order_send(request)
        return self._result_to_order_result(order, result)

    def modify_order(self, order: OrderRecord) -> Mt5OrderResult:
        self._ensure()
        if order.broker_order_ticket is not None:
            request = {
                "action": self._mt5.TRADE_ACTION_MODIFY,
                "order": order.broker_order_ticket,
                "symbol": order.symbol_broker,
                "price": order.entry_broker or 0.0,
                "sl": order.sl_broker or 0.0,
                "tp": order.tp_broker or 0.0,
            }
        elif order.broker_position_ticket is not None:
            request = {
                "action": self._mt5.TRADE_ACTION_SLTP,
                "position": order.broker_position_ticket,
                "symbol": order.symbol_broker,
                "sl": order.sl_broker or 0.0,
                "tp": order.tp_broker or 0.0,
            }
        else:
            return Mt5OrderResult(False, "rejected", error_code="no_ticket", error_message="No broker ticket")
        return self._result_to_order_result(order, self._mt5.order_send(request))

    def cancel_order(self, order: OrderRecord) -> Mt5OrderResult:
        self._ensure()
        if order.broker_order_ticket is None:
            return Mt5OrderResult(False, "rejected", error_code="no_order_ticket", error_message="No broker order ticket")
        result = self._mt5.order_send(
            {"action": self._mt5.TRADE_ACTION_REMOVE, "order": order.broker_order_ticket}
        )
        return self._result_to_order_result(order, result, success_status="cancelled")

    def close_position(self, order: OrderRecord) -> Mt5OrderResult:
        self._ensure()
        if order.broker_position_ticket is None:
            return Mt5OrderResult(False, "rejected", error_code="no_position_ticket", error_message="No broker position ticket")
        tick = self._mt5.symbol_info_tick(order.symbol_broker)
        close_type = (
            self._mt5.ORDER_TYPE_SELL
            if order.side is OrderSide.BUY
            else self._mt5.ORDER_TYPE_BUY
        )
        price = float(tick.bid if order.side is OrderSide.BUY else tick.ask)
        result = self._mt5.order_send(
            {
                "action": self._mt5.TRADE_ACTION_DEAL,
                "position": order.broker_position_ticket,
                "symbol": order.symbol_broker,
                "volume": order.volume_lots,
                "type": close_type,
                "price": price,
                "deviation": 20,
                "magic": 240606,
                "comment": f"NTtoTV close {order.id}",
            }
        )
        return self._result_to_order_result(order, result, success_status="closed")

    def orders(self, user_id: str, account_id: str) -> list[dict]:
        self._ensure()
        return [_ticket_dict(order) for order in (self._mt5.orders_get() or ())]

    def positions(self, user_id: str, account_id: str) -> list[dict]:
        self._ensure()
        return [_ticket_dict(pos) for pos in (self._mt5.positions_get() or ())]

    def _result_to_order_result(
        self,
        order: OrderRecord,
        result,
        *,
        success_status: str | None = None,
    ) -> Mt5OrderResult:
        if result is None:
            code, message = self._mt5.last_error()
            return Mt5OrderResult(False, "rejected", error_code=str(code), error_message=str(message))
        ok_codes = {
            self._mt5.TRADE_RETCODE_DONE,
            self._mt5.TRADE_RETCODE_PLACED,
            self._mt5.TRADE_RETCODE_DONE_PARTIAL,
        }
        if int(result.retcode) not in ok_codes:
            return Mt5OrderResult(False, "rejected", error_code=str(result.retcode), error_message=str(result.comment))
        status = success_status or ("filled" if order.kind is OrderKind.MARKET else "working")
        return Mt5OrderResult(
            accepted=True,
            status=status,
            broker_order_ticket=int(result.order) if getattr(result, "order", 0) else None,
            broker_deal_ticket=int(result.deal) if getattr(result, "deal", 0) else None,
            fill_price=float(result.price) if getattr(result, "price", 0.0) else None,
        )


def _pending_type(mt5, order: OrderRecord) -> int:
    if order.side is OrderSide.BUY and order.kind is OrderKind.LIMIT:
        return mt5.ORDER_TYPE_BUY_LIMIT
    if order.side is OrderSide.BUY and order.kind is OrderKind.STOP:
        return mt5.ORDER_TYPE_BUY_STOP
    if order.side is OrderSide.SELL and order.kind is OrderKind.LIMIT:
        return mt5.ORDER_TYPE_SELL_LIMIT
    return mt5.ORDER_TYPE_SELL_STOP


def _ticket_dict(obj) -> dict:
    return {
        "ticket": int(getattr(obj, "ticket", 0)),
        "symbol": str(getattr(obj, "symbol", "")),
        "volumeLots": float(getattr(obj, "volume_current", getattr(obj, "volume", 0.0))),
        "entryBroker": float(getattr(obj, "price_open", 0.0)),
        "slBroker": float(getattr(obj, "sl", 0.0)),
        "tpBroker": float(getattr(obj, "tp", 0.0)),
        "time": int(getattr(obj, "time_msc", 0) or getattr(obj, "time", 0) * 1000),
    }
