from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.models.orders import OrderKind, OrderRecord, OrderSide, OrderSource, OrderStatus
from app.mt5.worker import RealMt5Backend, _mt5_comment, _mt5_filling_type


@pytest.mark.unit
def test_mt5_comment_fits_terminal_limit_and_uses_safe_chars():
    comment = _mt5_comment("close", "ord_" + "a" * 80)

    assert len(comment) <= 31
    assert comment == "NTtoTV-close-aaaaaaaaaaaa"
    assert all(ch.isascii() and (ch.isalnum() or ch == "-") for ch in comment)


@pytest.mark.unit
def test_mt5_filling_type_prefers_symbol_allowed_modes():
    mt5 = SimpleNamespace(
        SYMBOL_FILLING_FOK=1,
        SYMBOL_FILLING_IOC=2,
        ORDER_FILLING_FOK=0,
        ORDER_FILLING_IOC=1,
        ORDER_FILLING_RETURN=2,
    )

    assert _mt5_filling_type(mt5, SimpleNamespace(filling_mode=1)) == 0
    assert _mt5_filling_type(mt5, SimpleNamespace(filling_mode=2)) == 1
    assert _mt5_filling_type(mt5, SimpleNamespace(filling_mode=3)) == 1
    assert _mt5_filling_type(mt5, SimpleNamespace(filling_mode=0)) == 2


@pytest.mark.unit
def test_market_order_reports_market_closed_when_stops_mask_session_error(monkeypatch):
    class FakeMt5:
        ORDER_TIME_GTC = 0
        ORDER_FILLING_IOC = 1
        ORDER_FILLING_RETURN = 2
        SYMBOL_FILLING_IOC = 2
        TRADE_ACTION_DEAL = 1
        ORDER_TYPE_BUY = 0
        ORDER_TYPE_SELL = 1
        TRADE_RETCODE_DONE = 10009
        TRADE_RETCODE_PLACED = 10008
        TRADE_RETCODE_DONE_PARTIAL = 10010
        TRADE_RETCODE_INVALID_STOPS = 10016
        TRADE_RETCODE_MARKET_CLOSED = 10018

        def __init__(self) -> None:
            self.sent_request = None
            self.checked_request = None

        def initialize(self, **_kwargs) -> bool:
            return True

        def symbol_info(self, _symbol):
            return SimpleNamespace(filling_mode=self.SYMBOL_FILLING_IOC)

        def symbol_info_tick(self, _symbol):
            return SimpleNamespace(bid=4328.774, ask=4329.054)

        def order_send(self, request):
            self.sent_request = request
            return SimpleNamespace(retcode=10016, comment="Invalid stops")

        def order_check(self, request):
            self.checked_request = request
            return SimpleNamespace(retcode=10018, comment="Market closed")

    fake = FakeMt5()
    monkeypatch.setattr("app.mt5.worker.importlib.import_module", lambda _name: fake)
    backend = RealMt5Backend()
    order = OrderRecord(
        id="ord_test",
        user_id="u",
        account_id="a",
        source=OrderSource.API,
        symbol_internal="GC",
        contract_internal="GC",
        source_contract="GC 08-26",
        symbol_broker="XAUUSDm",
        side=OrderSide.BUY,
        kind=OrderKind.MARKET,
        volume_lots=0.1,
        gc_anchored=True,
        status=OrderStatus.PENDING_SUBMIT,
        idempotency_key="i",
        created_at=1,
        updated_at=1,
        sl_broker=4324.0,
        tp_broker=4339.0,
    )

    result = backend.place_order(order)

    assert result.accepted is False
    assert result.error_code == "10018"
    assert result.error_message == "Market closed"
    assert fake.sent_request["sl"] == 4324.0
    assert fake.checked_request["sl"] == 0.0
    assert fake.checked_request["tp"] == 0.0
