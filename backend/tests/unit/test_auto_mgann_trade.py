from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.config import Settings
from app.engines.auto_mgann_trade import (
    AutoMgannTradeEngine,
    _is_auto_body_size_allowed,
    _signal_body_limit_price,
    _should_close_trailing_on_ema_cross,
)
from app.engines.basis_engine import BasisEngine
from app.models.auto_trade import AutoTradeSettingsRecord
from app.models.messages import OHLCVBar
from app.models.orders import OrderKind, OrderRecord, OrderSide, OrderSource, OrderStatus
from app.models.timestamp import now_ms
from app.mt5.fake import FakeMt5Backend
from app.mt5.manager import Mt5Manager
from app.storage.cache_store import CacheStore


def _setup(tmp_path):
    settings = Settings(
        data_dir=tmp_path,
        mt5_backend="fake",
        credential_key="test-key",
    )
    cache = CacheStore(tmp_path / "app.sqlite")
    fake = FakeMt5Backend(bid=100.0, ask=100.1, tick_size=0.01, digits=2)
    manager = Mt5Manager(settings=settings, backend=fake)
    basis = BasisEngine(settings=settings)
    current = now_ms()
    basis.update_gc(100.0, current)
    basis.update_broker_mid(100.05, current)
    user = cache.users.create_user("auto", "pw")
    account = cache.users.upsert_mt5_account(
        user_id=user.id,
        login=1,
        password="fake",
        server="Fake-Demo",
        symbol_broker="XAUUSDm",
        credential_key="test-key",
    )
    engine = AutoMgannTradeEngine(cache, manager, basis, settings=settings)
    return cache, fake, basis, user, account, engine


@pytest.mark.unit
@pytest.mark.parametrize("structure_kind", ["BOS", "CHoCH"])
def test_auto_mgann_submits_one_idempotent_long_market_bracket(tmp_path, structure_kind):
    cache, _, _, user, _, engine = _setup(tmp_path)
    try:
        cache.auto_trade.upsert(
            AutoTradeSettingsRecord(
                user_id=user.id,
                long_enabled=True,
                volume_lots=0.1,
                updated_at=now_ms(),
            )
        )
        engine._signals = SimpleNamespace(  # type: ignore[assignment]
            on_closed_bar=lambda _: [
                SimpleNamespace(
                    direction=1,
                    structure_kind=structure_kind,
                    bar_spread=2.1,
                    avg_spread=0.525,
                )
            ]
        )
        bar = OHLCVBar(
            time=1_000_000,
            open=99.0,
            high=101.2,
            low=98.8,
            close=101.1,
            volume=500,
        )

        assert engine.on_closed_bar(bar) == 1
        assert engine.on_closed_bar(bar) == 0
        orders = cache.orders.list_for_user(user.id, open_only=False)
        assert len(orders) == 1
        order = orders[0]
        assert order.source is OrderSource.AUTO_MGANN
        assert order.side is OrderSide.BUY
        assert order.kind is OrderKind.MARKET
        assert order.volume_lots == 0.1
        assert order.sl_gc == 98.6  # signal low minus two GC ticks
        assert order.tp_gc == 104.2  # 3R from the market-entry estimate
        assert order.status is OrderStatus.FILLED
    finally:
        cache.close()


@pytest.mark.unit
def test_auto_mgann_validates_bracket_in_broker_price_scale(tmp_path):
    cache, _, basis, user, _, engine = _setup(tmp_path)
    try:
        current = now_ms()
        # GC and broker-XAU prices intentionally have a non-zero basis.  The
        # broker SL/TP must be checked against broker entry, not GC entry.
        basis.update_gc(90.0, current)
        basis.update_broker_mid(100.05, current)
        cache.auto_trade.upsert(
            AutoTradeSettingsRecord(
                user_id=user.id,
                long_enabled=True,
                volume_lots=0.1,
                updated_at=current,
            )
        )
        engine._signals = SimpleNamespace(  # type: ignore[assignment]
            on_closed_bar=lambda _: [SimpleNamespace(direction=1, structure_kind="BOS")]
        )
        bar = OHLCVBar(
            time=1_000_001,
            open=89.0,
            high=90.2,
            low=88.8,
            close=90.0,
            volume=500,
        )

        assert engine.on_closed_bar(bar) == 1
        orders = cache.orders.list_for_user(user.id, open_only=False)
        assert len(orders) == 1
        assert orders[0].status is OrderStatus.FILLED
        assert orders[0].entry_broker == 100.1
        assert orders[0].sl_broker == 98.65
        assert orders[0].tp_broker == 104.25
    finally:
        cache.close()


@pytest.mark.unit
def test_auto_mgann_uses_body_70_percent_limit_and_cancels_it_at_1r(tmp_path):
    cache, fake, basis, user, account, engine = _setup(tmp_path)
    try:
        current = now_ms()
        fake.set_tick(103.0, 103.1)
        basis.update_gc(103.0, current)
        cache.auto_trade.upsert(
            AutoTradeSettingsRecord(
                user_id=user.id,
                long_enabled=True,
                volume_lots=0.1,
                updated_at=now_ms(),
            )
        )
        engine._signals = SimpleNamespace(  # type: ignore[assignment]
            on_closed_bar=lambda _: [
                SimpleNamespace(
                    direction=1,
                    structure_kind="BOS",
                    bar_spread=4.2,
                    avg_spread=0.6,
                )
            ]
        )
        bar = OHLCVBar(
            time=1_000_002,
            open=99.0,
            high=102.4,
            low=98.8,
            close=102.2,
            volume=500,
        )

        assert engine.on_closed_bar(bar) == 1
        order = cache.orders.list_for_user(user.id, open_only=False)[0]
        assert order.kind is OrderKind.LIMIT
        assert order.status is OrderStatus.WORKING
        assert order.entry_gc == 101.2
        assert order.sl_gc == 98.6
        assert order.tp_gc == 109.0
        assert order.entry_broker == 101.25
        assert len(fake.orders(user.id, account.id)) == 1

        assert engine.cancel_unfilled_limits_at_1r(103.7) == 0
        assert engine.cancel_unfilled_limits_at_1r(103.8) == 1
        saved = cache.orders.read(order.id, user.id)
        assert saved is not None
        assert saved.status is OrderStatus.CANCELLED
        assert fake.orders(user.id, account.id) == []
    finally:
        cache.close()


@pytest.mark.unit
def test_auto_mgann_body_70_percent_limit_uses_signal_direction():
    assert _signal_body_limit_price(
        OHLCVBar(time=1, open=100.0, high=104.0, low=100.0, close=104.0, volume=1)
    ) == 102.8
    assert _signal_body_limit_price(
        OHLCVBar(time=2, open=104.0, high=104.0, low=100.0, close=100.0, volume=1)
    ) == 101.2


@pytest.mark.unit
def test_auto_mgann_skips_body_strictly_larger_than_eight_times_average(tmp_path):
    cache, _, _, user, _, engine = _setup(tmp_path)
    try:
        cache.auto_trade.upsert(
            AutoTradeSettingsRecord(
                user_id=user.id,
                long_enabled=True,
                volume_lots=0.1,
                updated_at=now_ms(),
            )
        )
        trigger = SimpleNamespace(
            direction=1,
            structure_kind="BOS",
            bar_spread=4.1,
            avg_spread=0.5,
        )
        engine._signals = SimpleNamespace(  # type: ignore[assignment]
            on_closed_bar=lambda _: [trigger]
        )
        bar = OHLCVBar(
            time=1_000_003,
            open=99.0,
            high=102.4,
            low=98.8,
            close=102.2,
            volume=500,
        )

        assert not _is_auto_body_size_allowed(trigger)
        assert _is_auto_body_size_allowed(
            SimpleNamespace(bar_spread=4.0, avg_spread=0.5)
        )
        assert engine.on_closed_bar(bar) == 0
        assert cache.orders.list_for_user(user.id, open_only=False) == []
    finally:
        cache.close()


@pytest.mark.unit
def test_auto_mgann_starts_ema21_trailing_at_1r_and_exits_on_close_below_ema(tmp_path):
    cache, fake, _, user, account, engine = _setup(tmp_path)
    try:
        cache.auto_trade.upsert(
            AutoTradeSettingsRecord(
                user_id=user.id,
                long_enabled=True,
                volume_lots=0.1,
                updated_at=now_ms(),
            )
        )
        order = OrderRecord(
            id="ord_auto",
            user_id=user.id,
            account_id=account.id,
            source=OrderSource.AUTO_MGANN,
            symbol_internal="GC",
            contract_internal="GC",
            source_contract=None,
            symbol_broker="XAUUSDm",
            side=OrderSide.BUY,
            kind=OrderKind.MARKET,
            volume_lots=0.1,
            gc_anchored=True,
            status=OrderStatus.FILLED,
            idempotency_key="auto-mgann:1:buy",
            created_at=1,
            updated_at=1,
            entry_gc=100.0,
            sl_gc=98.0,
            tp_gc=106.0,
            entry_broker=100.1,
            sl_broker=98.05,
            tp_broker=106.05,
        )
        result = fake.place_order(order)
        order.broker_position_ticket = result.broker_position_ticket
        order.broker_deal_ticket = result.broker_deal_ticket
        cache.orders.create(order)
        engine._ema21 = 101.0  # type: ignore[attr-defined]
        engine._ema_last_bar_time = 900_000  # type: ignore[attr-defined]

        assert engine.activate_ema21_trailing_at_1r(101.9) == 0
        assert engine.activate_ema21_trailing_at_1r(102.0) == 1
        assert engine.activate_ema21_trailing_at_1r(102.1) == 0
        saved = cache.orders.read(order.id, user.id)
        assert saved is not None
        assert saved.sl_gc == 101.0
        position = fake.positions(user.id, account.id)[0]
        assert position["slBroker"] == 101.05
        assert saved.status is OrderStatus.FILLED
        trailing = cache.orders.list_open_for_account_with_event(
            user.id, account.id, "auto_mgann_ema21_trailing_started"
        )
        assert [item.id for item in trailing] == [order.id]

        assert engine.on_closed_bar(
            OHLCVBar(
                time=1_000_000,
                open=101.2,
                high=101.3,
                low=99.9,
                close=100.0,
                volume=500,
            )
        ) == 0
        closed = cache.orders.read(order.id, user.id)
        assert closed is not None
        assert closed.status is OrderStatus.CLOSED
        assert fake.positions(user.id, account.id) == []
    finally:
        cache.close()


@pytest.mark.unit
def test_auto_mgann_ema21_exit_direction_is_opposite_for_short():
    assert _should_close_trailing_on_ema_cross(
        SimpleNamespace(side=OrderSide.BUY), 99.9, 100.0
    )
    assert not _should_close_trailing_on_ema_cross(
        SimpleNamespace(side=OrderSide.BUY), 100.1, 100.0
    )
    assert _should_close_trailing_on_ema_cross(
        SimpleNamespace(side=OrderSide.SELL), 100.1, 100.0
    )
    assert not _should_close_trailing_on_ema_cross(
        SimpleNamespace(side=OrderSide.SELL), 99.9, 100.0
    )
