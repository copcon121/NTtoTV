"""Optional real MetaTrader5 backend.

This module imports the `MetaTrader5` Python package only inside the real backend
constructor so CI/local fake mode does not require the package.
"""

from __future__ import annotations

import importlib
from typing import Any

from ..config import Settings, settings as default_settings
from ..models.mt5 import Mt5AccountInfo, Mt5OrderResult, Mt5SymbolInfo, Mt5Tick
from ..models.orders import OrderKind, OrderRecord, OrderSide
from ..models.timestamp import now_ms

__all__ = ["RealMt5Backend"]

_MT5_COMMENT_MAX_LENGTH = 31


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
        self._active_login: int | None = None

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

    def connect_account(
        self,
        *,
        login: int,
        password: str,
        server: str,
        terminal_path: str | None = None,
    ) -> None:
        next_terminal = terminal_path.strip() if terminal_path else None
        if (
            self._initialized
            and next_terminal
            and next_terminal != self._terminal_path
        ):
            self._mt5.shutdown()
            self._initialized = False
            self._active_login = None
        if next_terminal:
            self._terminal_path = next_terminal

        if not self._initialized:
            kwargs: dict[str, Any] = {
                "login": int(login),
                "password": password,
                "server": server,
            }
            if self._terminal_path:
                kwargs["path"] = self._terminal_path
            ok = self._mt5.initialize(**kwargs)
            if not ok:
                code, message = self._mt5.last_error()
                raise RuntimeError(f"MetaTrader5 initialize failed: {code} {message}")
            self._initialized = True
        if self._active_login != int(login):
            ok = self._mt5.login(int(login), password=password, server=server)
            if not ok:
                code, message = self._mt5.last_error()
                raise RuntimeError(f"MetaTrader5 login failed: {code} {message}")
        info = self._mt5.account_info()
        if info is None:
            code, message = self._mt5.last_error()
            raise RuntimeError(f"MetaTrader5 account_info failed: {code} {message}")
        if int(info.login) != int(login):
            raise RuntimeError(
                f"MetaTrader5 logged into {int(info.login)}, expected {int(login)}"
            )
        self._active_login = int(login)

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
        trade_mode = getattr(info, "trade_mode", None)
        if trade_mode is not None and int(trade_mode) == int(
            getattr(self._mt5, "SYMBOL_TRADE_MODE_DISABLED", 0)
        ):
            raise RuntimeError(f"MT5 symbol {symbol!r} is disabled for trading")
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
        symbol_info = self._mt5.symbol_info(order.symbol_broker)
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
            "comment": _mt5_comment("ord", order.id),
            "type_time": self._mt5.ORDER_TIME_GTC,
            "type_filling": _mt5_filling_type(self._mt5, symbol_info),
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
        session_result = self._market_session_error_from_invalid_stops(
            order,
            request,
            result,
        )
        if session_result is not None:
            return session_result
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
                "comment": _mt5_comment("close", order.id),
                "type_filling": _mt5_filling_type(
                    self._mt5, self._mt5.symbol_info(order.symbol_broker)
                ),
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

    def _market_session_error_from_invalid_stops(
        self,
        order: OrderRecord,
        request: dict[str, Any],
        result,
    ) -> Mt5OrderResult | None:
        if order.kind is not OrderKind.MARKET:
            return None
        if not _retcode_matches(
            self._mt5,
            result,
            "TRADE_RETCODE_INVALID_STOPS",
            10016,
        ):
            return None
        order_check = getattr(self._mt5, "order_check", None)
        if not callable(order_check):
            return None
        probe = dict(request)
        probe["sl"] = 0.0
        probe["tp"] = 0.0
        check = order_check(probe)
        if _retcode_matches(self._mt5, check, "TRADE_RETCODE_MARKET_CLOSED", 10018):
            return self._result_to_order_result(order, check)
        return None


def _pending_type(mt5, order: OrderRecord) -> int:
    if order.side is OrderSide.BUY and order.kind is OrderKind.LIMIT:
        return mt5.ORDER_TYPE_BUY_LIMIT
    if order.side is OrderSide.BUY and order.kind is OrderKind.STOP:
        return mt5.ORDER_TYPE_BUY_STOP
    if order.side is OrderSide.SELL and order.kind is OrderKind.LIMIT:
        return mt5.ORDER_TYPE_SELL_LIMIT
    return mt5.ORDER_TYPE_SELL_STOP


def _mt5_comment(action: str, order_id: str) -> str:
    safe_action = "".join(ch for ch in action if ch.isascii() and ch.isalnum())
    safe_order = "".join(ch for ch in order_id if ch.isascii() and ch.isalnum())
    suffix = safe_order[-12:] or "order"
    comment = f"NTtoTV-{safe_action or 'ord'}-{suffix}"
    return comment[:_MT5_COMMENT_MAX_LENGTH]


def _mt5_filling_type(mt5, symbol_info) -> int:
    mode = int(getattr(symbol_info, "filling_mode", 0) or 0)
    symbol_ioc = int(getattr(mt5, "SYMBOL_FILLING_IOC", 2))
    symbol_fok = int(getattr(mt5, "SYMBOL_FILLING_FOK", 1))
    if mode & symbol_ioc:
        return int(mt5.ORDER_FILLING_IOC)
    if mode & symbol_fok:
        return int(mt5.ORDER_FILLING_FOK)
    return int(mt5.ORDER_FILLING_RETURN)


def _retcode_matches(mt5, result, name: str, fallback: int) -> bool:
    if result is None:
        return False
    return int(getattr(result, "retcode", -1)) == int(getattr(mt5, name, fallback))


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
