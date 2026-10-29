from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.config import Settings
from app.models.orders import OrderKind, OrderRecord, OrderSide, OrderSource, OrderStatus
from app.mt5.worker import RealMt5Backend, _match_position_ticket, _mt5_comment, _mt5_filling_type


@pytest.mark.unit
@pytest.mark.parametrize("side", [OrderSide.BUY, OrderSide.SELL])
@pytest.mark.parametrize("wide_spread", [False, True])
def test_market_bracket_uses_final_quote_and_rejects_spread_overlap(monkeypatch, side, wide_spread):
    requests = []
    bid, ask = (2355.0, 2359.0 if wide_spread else 2355.2)
    fake = SimpleNamespace(
        initialize=lambda **kwargs: True,
        symbol_info=lambda symbol: SimpleNamespace(
            filling_mode=2, trade_tick_size=0.001, point=0.001,
            digits=3, trade_stops_level=500,
        ),
        symbol_info_tick=lambda symbol: SimpleNamespace(bid=bid, ask=ask),
        order_send=lambda request: requests.append(dict(request)) or SimpleNamespace(
            retcode=10009, order=123, deal=124, position=123, price=request["price"],
        ),
        ORDER_TIME_GTC=0, ORDER_FILLING_IOC=1, SYMBOL_FILLING_IOC=2,
        TRADE_ACTION_DEAL=1, ORDER_TYPE_BUY=0, ORDER_TYPE_SELL=1,
        TRADE_RETCODE_DONE=10009, TRADE_RETCODE_PLACED=10008,
        TRADE_RETCODE_DONE_PARTIAL=10010,
    )
    monkeypatch.setattr("app.mt5.worker.importlib.import_module", lambda name: fake)
    direction = 1 if side is OrderSide.BUY else -1
    order = OrderRecord(
        id="ord_final_quote", user_id="u", account_id="a", source=OrderSource.MARKET_BAR,
        symbol_internal="GC", contract_internal="GC", source_contract="GC 12-26",
        symbol_broker="XAUUSDm", side=side, kind=OrderKind.MARKET,
        volume_lots=0.1, gc_anchored=False, status=OrderStatus.PENDING_SUBMIT,
        idempotency_key="final-quote", created_at=1, updated_at=1,
        entry_broker=2350.0, sl_broker=2350.0 - direction * 3,
        tp_broker=2350.0 + direction * 6,
    )
    result = RealMt5Backend().place_order(order)
    if wide_spread:
        assert result.accepted is False
        assert result.error_code == "invalid_stops"
        assert requests == []
    else:
        assert result.accepted is True
        assert len(requests) == 1
        entry = ask if side is OrderSide.BUY else bid
        assert requests[0]["price"] == entry
        assert requests[0]["sl"] == pytest.approx(entry - direction * 3)
        assert requests[0]["tp"] == pytest.approx(entry + direction * 6)
        assert result.submitted_entry_price == entry
        assert result.submitted_sl_price == requests[0]["sl"]
        assert result.submitted_tp_price == requests[0]["tp"]


@pytest.mark.unit
@pytest.mark.parametrize("matched,volume", [(False, 0.1), (True, 0.1), (True, 0.05)])
def test_position_resolution_requires_broker_identity(matched, volume):
    order = OrderRecord(
        id="ord_identity", user_id="u", account_id="a", source=OrderSource.API,
        symbol_internal="GC", contract_internal="GC", source_contract="GC 12-26",
        symbol_broker="XAUUSDm", side=OrderSide.BUY, kind=OrderKind.MARKET,
        volume_lots=0.1, gc_anchored=True, status=OrderStatus.SUBMITTED,
        idempotency_key="identity", created_at=1, updated_at=1,
    )
    position = SimpleNamespace(
        ticket=101, identifier=202 if matched else 101, symbol="XAUUSDm",
        type=0, volume=volume, magic=240606, price_open=4300.0, time_msc=1,
    )
    assert _match_position_ticket(
        [position], order, order_ticket=202, fill_price=4300.0,
    ) == (101 if matched else None)


@pytest.mark.unit
@pytest.mark.parametrize("retcode", [None, 10012, 10031])
def test_uncertain_entry_reply_is_not_reported_as_definitive_rejection(monkeypatch, retcode):
    requests = []
    fake = SimpleNamespace(
        initialize=lambda **kwargs: True,
        symbol_info=lambda symbol: SimpleNamespace(filling_mode=2),
        symbol_info_tick=lambda symbol: SimpleNamespace(bid=2350, ask=2350.1),
        order_send=lambda request: requests.append(request) or (
            None if retcode is None else SimpleNamespace(retcode=retcode, comment="transport error")
        ),
        last_error=lambda: (-10005, "IPC timeout"),
        ORDER_TIME_GTC=0, ORDER_FILLING_IOC=1, SYMBOL_FILLING_IOC=2,
        TRADE_ACTION_DEAL=1, ORDER_TYPE_BUY=0, ORDER_TYPE_SELL=1,
    )
    monkeypatch.setattr("app.mt5.worker.importlib.import_module", lambda name: fake)
    order = OrderRecord(
        id="ord_unknown", user_id="u", account_id="a", source=OrderSource.API,
        symbol_internal="GC", contract_internal="GC", source_contract="GC 12-26",
        symbol_broker="XAUUSDm", side=OrderSide.BUY, kind=OrderKind.MARKET,
        volume_lots=0.1, gc_anchored=False, status=OrderStatus.PENDING_SUBMIT,
        idempotency_key="unknown", created_at=1, updated_at=1,
    )
    with pytest.raises(RuntimeError, match="acknowledgement"):
        RealMt5Backend().place_order(order)
    assert len(requests) == 1


@pytest.mark.unit
@pytest.mark.parametrize("method", ["orders", "positions"])
@pytest.mark.parametrize("rows", [None, ()])
def test_broker_read_failure_is_not_an_empty_snapshot(monkeypatch, method, rows):
    fake = SimpleNamespace(
        initialize=lambda **kwargs: True,
        orders_get=lambda: rows,
        positions_get=lambda: rows,
        last_error=lambda: (-10001, "IPC receive failed"),
    )
    monkeypatch.setattr("app.mt5.worker.importlib.import_module", lambda _name: fake)
    backend = RealMt5Backend()
    if rows is None:
        with pytest.raises(RuntimeError, match=f"{method}_get failed"):
            getattr(backend, method)("u", "a")
    else:
        assert getattr(backend, method)("u", "a") == []


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
def test_connect_account_relogs_when_terminal_account_changes_externally(monkeypatch):
    class FakeMt5:
        def __init__(self) -> None:
            self.current_login: int | None = None
            self.login_calls: list[int] = []

        def initialize(self, **kwargs) -> bool:
            login = kwargs.get("login")
            if login is not None:
                self.current_login = int(login)
            return True

        def login(
            self,
            login: int,
            *,
            password: str,
            server: str,
            timeout: int | None = None,
        ) -> bool:
            self.login_calls.append(int(login))
            self.current_login = int(login)
            return True

        def account_info(self):
            if self.current_login is None:
                return None
            return SimpleNamespace(login=self.current_login)

        def last_error(self):
            return (0, "ok")

    fake = FakeMt5()
    monkeypatch.setattr("app.mt5.worker.importlib.import_module", lambda _name: fake)
    backend = RealMt5Backend()

    backend.connect_account(login=257101455, password="pw", server="Exness-MT5Real36")
    fake.current_login = 411821078

    backend.connect_account(login=257101455, password="pw", server="Exness-MT5Real36")

    assert fake.login_calls == [257101455]


@pytest.mark.unit
def test_connect_account_uses_configured_mt5_timeout(monkeypatch):
    class FakeMt5:
        def __init__(self) -> None:
            self.initialize_kwargs: dict | None = None
            self.login_kwargs: dict | None = None
            self.current_login = 111

        def initialize(self, **kwargs) -> bool:
            self.initialize_kwargs = kwargs
            return True

        def login(self, login: int, **kwargs) -> bool:
            self.login_kwargs = kwargs
            self.current_login = int(login)
            return True

        def account_info(self):
            return SimpleNamespace(login=self.current_login)

        def last_error(self):
            return (0, "ok")

    fake = FakeMt5()
    monkeypatch.setattr("app.mt5.worker.importlib.import_module", lambda _name: fake)
    backend = RealMt5Backend(settings=Settings(mt5_connect_timeout_ms=1234))

    backend.connect_account(login=222, password="pw", server="Exness-MT5Real8")

    assert fake.initialize_kwargs is not None
    assert fake.initialize_kwargs["timeout"] == 1234
    assert fake.login_kwargs is not None
    assert fake.login_kwargs["timeout"] == 1234


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


@pytest.mark.unit
def test_market_order_resolves_position_ticket_from_positions(monkeypatch):
    class FakeMt5:
        ORDER_TIME_GTC = 0
        ORDER_FILLING_IOC = 1
        SYMBOL_FILLING_IOC = 2
        TRADE_ACTION_DEAL = 1
        ORDER_TYPE_BUY = 0
        ORDER_TYPE_SELL = 1
        TRADE_RETCODE_DONE = 10009
        TRADE_RETCODE_PLACED = 10008
        TRADE_RETCODE_DONE_PARTIAL = 10010

        def initialize(self, **_kwargs) -> bool:
            return True

        def symbol_info(self, _symbol):
            return SimpleNamespace(filling_mode=self.SYMBOL_FILLING_IOC)

        def symbol_info_tick(self, _symbol):
            return SimpleNamespace(bid=4313.998, ask=4314.112)

        def order_send(self, _request):
            return SimpleNamespace(
                retcode=10009,
                order=1371359974,
                deal=1267515439,
                price=4313.998,
            )

        def positions_get(self, symbol=None):
            assert symbol == "XAUUSDc"
            return [
                SimpleNamespace(
                    ticket=555001,
                    identifier=1371359974,
                    symbol="XAUUSDc",
                    type=1,
                    magic=240606,
                    volume=0.15,
                    price_open=4313.998,
                    comment=_mt5_comment("ord", "ord_live_sell"),
                    time_msc=1780882201749,
                )
            ]

    fake = FakeMt5()
    monkeypatch.setattr("app.mt5.worker.importlib.import_module", lambda _name: fake)
    backend = RealMt5Backend()
    order = OrderRecord(
        id="ord_live_sell",
        user_id="u",
        account_id="a",
        source=OrderSource.API,
        symbol_internal="GC",
        contract_internal="GC",
        source_contract="GC 08-26",
        symbol_broker="XAUUSDc",
        side=OrderSide.SELL,
        kind=OrderKind.MARKET,
        volume_lots=0.15,
        gc_anchored=True,
        status=OrderStatus.PENDING_SUBMIT,
        idempotency_key="i",
        created_at=1,
        updated_at=1,
    )

    result = backend.place_order(order)

    assert result.accepted is True
    assert result.status == "filled"
    assert result.broker_position_ticket == 555001
    assert result.broker_order_ticket is None
    assert result.broker_deal_ticket == 1267515439


@pytest.mark.unit
def test_modify_order_prefers_position_ticket_for_filled_market_order(monkeypatch):
    class FakeMt5:
        TRADE_ACTION_MODIFY = 3
        TRADE_ACTION_SLTP = 6
        TRADE_RETCODE_DONE = 10009
        TRADE_RETCODE_PLACED = 10008
        TRADE_RETCODE_DONE_PARTIAL = 10010

        def __init__(self) -> None:
            self.sent_request = None

        def initialize(self, **_kwargs) -> bool:
            return True

        def order_send(self, request):
            self.sent_request = request
            return SimpleNamespace(retcode=10009, order=0, deal=0, price=0.0)

    fake = FakeMt5()
    monkeypatch.setattr("app.mt5.worker.importlib.import_module", lambda _name: fake)
    backend = RealMt5Backend()
    order = OrderRecord(
        id="ord_modify",
        user_id="u",
        account_id="a",
        source=OrderSource.API,
        symbol_internal="GC",
        contract_internal="GC",
        source_contract="GC 08-26",
        symbol_broker="XAUUSDc",
        side=OrderSide.SELL,
        kind=OrderKind.MARKET,
        volume_lots=0.15,
        gc_anchored=True,
        status=OrderStatus.FILLED,
        idempotency_key="i",
        created_at=1,
        updated_at=1,
        broker_order_ticket=1371359974,
        broker_position_ticket=555001,
        sl_broker=4320.0,
        tp_broker=4300.0,
    )

    result = backend.modify_order(order)

    assert result.accepted is True
    assert fake.sent_request["action"] == fake.TRADE_ACTION_SLTP
    assert fake.sent_request["position"] == 555001
    assert "order" not in fake.sent_request
