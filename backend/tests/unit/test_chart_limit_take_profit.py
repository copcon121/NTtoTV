from __future__ import annotations

from dataclasses import replace

import pytest

from app.config import Settings
from app.engines.chart_limit_take_profit import (
    ChartLimitTakeProfitEngine,
    _half_close_volume,
)
from app.models.orders import OrderKind, OrderRecord, OrderSide, OrderSource, OrderStatus
from app.mt5.fake import FakeMt5Backend
from app.mt5.manager import Mt5Manager
from app.storage.cache_store import CacheStore


def _setup(
    tmp_path,
    *,
    side: OrderSide = OrderSide.BUY,
    source: OrderSource = OrderSource.CHART_BRACKET,
    kind: OrderKind = OrderKind.LIMIT,
    enabled: bool = True,
    auto_trailing: bool = False,
):
    settings = Settings(
        data_dir=tmp_path,
        mt5_backend="fake",
        credential_key="test-key",
    )
    cache = CacheStore(tmp_path / "app.sqlite")
    fake = FakeMt5Backend(bid=100.0, ask=100.1, tick_size=0.01, digits=2)
    manager = Mt5Manager(settings=settings, backend=fake)
    user = cache.users.create_user("chart-limit", "pw")
    account = cache.users.upsert_mt5_account(
        user_id=user.id,
        login=1,
        password="fake",
        server="Fake-Demo",
        symbol_broker="XAUUSDm",
        credential_key="test-key",
    )
    entry = 100.0
    order = OrderRecord(
        id="ord_chart_limit",
        user_id=user.id,
        account_id=account.id,
        source=source,
        symbol_internal="GC",
        contract_internal="GC",
        source_contract="GC 12-26",
        symbol_broker="XAUUSDm",
        side=side,
        kind=kind,
        volume_lots=0.1,
        gc_anchored=True,
        status=OrderStatus.FILLED,
        idempotency_key="chart-limit-1",
        created_at=1,
        updated_at=1,
        take_profit_1r_enabled=enabled,
        auto_supertrend_after_1r_enabled=auto_trailing,
        trailing_timeframe="5m" if auto_trailing else None,
        trailing_period=14 if auto_trailing else None,
        trailing_multiplier=2.5 if auto_trailing else None,
        trailing_atr_method="sma" if auto_trailing else None,
        trailing_source="close" if auto_trailing else None,
        entry_gc=entry,
        sl_gc=99.0 if side is OrderSide.BUY else 101.0,
        tp_gc=103.0 if side is OrderSide.BUY else 97.0,
    )
    # Seed a broker position, then persist it as the filled chart limit that the
    # reconciliation loop would normally produce.
    placed = fake.place_order(replace(order, kind=OrderKind.MARKET))
    order.broker_position_ticket = placed.broker_position_ticket
    order.broker_deal_ticket = placed.broker_deal_ticket
    cache.orders.create(order)
    engine = ChartLimitTakeProfitEngine(cache, manager)
    return cache, fake, user, account, order, engine


@pytest.mark.unit
def test_chart_limit_closes_half_once_when_buy_reaches_one_r(tmp_path):
    cache, fake, user, account, order, engine = _setup(tmp_path)
    try:
        assert engine.take_profit_at_1r(100.9) == 0
        assert fake.positions(user.id, account.id)[0]["volumeLots"] == 0.1

        assert engine.take_profit_at_1r(101.0) == 1
        assert fake.positions(user.id, account.id)[0]["volumeLots"] == 0.05
        saved = cache.orders.read(order.id, user.id)
        assert saved is not None
        assert saved.status is OrderStatus.FILLED
        assert saved.volume_lots == 0.05

        assert engine.take_profit_at_1r(102.0) == 0
        assert fake.positions(user.id, account.id)[0]["volumeLots"] == 0.05
        completed = cache.orders.list_open_for_account_with_event(
            user.id,
            account.id,
            "chart_limit_partial_take_profit_1r",
        )
        assert [item.id for item in completed] == [order.id]
    finally:
        cache.close()


@pytest.mark.unit
def test_market_order_sell_uses_downside_one_r(tmp_path):
    cache, fake, user, account, order, engine = _setup(
        tmp_path,
        side=OrderSide.SELL,
        source=OrderSource.MARKET_BAR,
        kind=OrderKind.MARKET,
        auto_trailing=True,
    )
    try:
        assert engine.take_profit_at_1r(99.1) == 0
        assert engine.take_profit_at_1r(99.0) == 1
        assert fake.positions(user.id, account.id)[0]["volumeLots"] == 0.05
        assert cache.orders.read(order.id, user.id).volume_lots == 0.05
        trailing = cache.supertrend_trailing.read(user.id, "order", order.id)
        assert trailing is not None
        assert trailing.broker_position_ticket == order.broker_position_ticket
        assert trailing.timeframe == "5m"
        assert trailing.period == 14
        assert trailing.multiplier == 2.5
        assert trailing.atr_method == "sma"
        assert trailing.source == "close"
    finally:
        cache.close()


@pytest.mark.unit
def test_disabled_partial_take_profit_does_not_manage_the_order(tmp_path):
    cache, fake, user, account, _, engine = _setup(tmp_path, enabled=False)
    try:
        assert engine.take_profit_at_1r(101.0) == 0
        assert fake.positions(user.id, account.id)[0]["volumeLots"] == 0.1
    finally:
        cache.close()


@pytest.mark.unit
@pytest.mark.parametrize(
    ("volume", "expected"),
    [
        (0.10, 0.05),
        (0.03, 0.01),
        (0.02, 0.01),
        (0.01, None),
    ],
)
def test_half_close_volume_respects_broker_step_and_keeps_a_remainder(
    volume, expected
):
    assert _half_close_volume(volume, min_lot=0.01, lot_step=0.01) == expected
