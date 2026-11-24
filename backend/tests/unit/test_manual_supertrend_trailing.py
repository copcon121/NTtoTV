from __future__ import annotations

import pytest

from app.config import Settings
from app.engines.manual_supertrend_trailing import (
    ManualSupertrendTrailingEngine,
    prime_supertrend_trailing,
    supertrend_trailing_activation_error,
)
from app.models.messages import OHLCVBar
from app.models.orders import OrderKind, OrderRecord, OrderSide, OrderSource, OrderStatus
from app.models.supertrend_trailing import SupertrendTrailingRecord
from app.models.timestamp import now_ms
from app.mt5.fake import FakeMt5Backend
from app.mt5.manager import Mt5Manager
from app.storage.cache_store import CacheStore
from app.storage.records import BarRecord


def _setup(tmp_path, *, source: OrderSource = OrderSource.MARKET_BAR):
    settings = Settings(
        data_dir=tmp_path,
        mt5_backend="fake",
        credential_key="test-key",
    )
    cache = CacheStore(tmp_path / "app.sqlite")
    fake = FakeMt5Backend(bid=100.0, ask=100.1, tick_size=0.01, digits=2)
    manager = Mt5Manager(settings=settings, backend=fake)
    user = cache.users.create_user("manual", "pw")
    account = cache.users.upsert_mt5_account(
        user_id=user.id,
        login=1,
        password="fake",
        server="Fake-Demo",
        symbol_broker="XAUUSDm",
        credential_key="test-key",
    )
    order = OrderRecord(
        id="ord_manual",
        user_id=user.id,
        account_id=account.id,
        source=source,
        symbol_internal="GC",
        contract_internal="GC",
        source_contract="GC 12-26",
        symbol_broker="XAUUSDm",
        side=OrderSide.BUY,
        kind=OrderKind.MARKET,
        volume_lots=0.1,
        gc_anchored=True,
        status=OrderStatus.FILLED,
        idempotency_key="manual-1",
        created_at=1,
        updated_at=1,
        entry_gc=100.0,
        entry_broker=100.1,
    )
    placed = fake.place_order(order)
    order.broker_position_ticket = placed.broker_position_ticket
    order.broker_deal_ticket = placed.broker_deal_ticket
    cache.orders.create(order)
    engine = ManualSupertrendTrailingEngine(cache, manager)
    return cache, fake, user, account, order, engine


def _bar(time: int, open_: float, high: float, low: float, close: float) -> BarRecord:
    return BarRecord(
        symbol="GC",
        contract="GC",
        timeframe="1m",
        time=time,
        open=open_,
        high=high,
        low=low,
        close=close,
        volume=10,
        closed=True,
        source="bookmap",
    )


def _rule(user, account, order) -> SupertrendTrailingRecord:
    current = now_ms()
    return SupertrendTrailingRecord(
        user_id=user.id,
        account_id=account.id,
        target_type="order",
        target_id=order.id,
        broker_position_ticket=order.broker_position_ticket,
        side="buy",
        timeframe="1m",
        period=1,
        multiplier=3.0,
        atr_method="rma",
        source="hl2",
        created_at=current,
        updated_at=current,
    )


@pytest.mark.unit
def test_manual_trailing_waits_for_confirmed_cross_then_closes(tmp_path):
    cache, fake, user, account, order, engine = _setup(tmp_path)
    try:
        cache.upsert_bar(_bar(60_000, 100.0, 101.0, 99.0, 100.0))
        rule = prime_supertrend_trailing(cache, _rule(user, account, order))
        cache.supertrend_trailing.upsert(rule)
        assert rule.last_bar_time == 60_000

        safe = _bar(120_000, 100.0, 100.0, 94.0, 95.0)
        cache.upsert_bar(safe)
        assert engine.on_closed_bar(
            "1m",
            OHLCVBar(
                time=safe.time,
                open=safe.open,
                high=safe.high,
                low=safe.low,
                close=safe.close,
                volume=safe.volume,
            ),
        ) == 0
        assert len(fake.positions(user.id, account.id)) == 1

        crossed = _bar(180_000, 95.0, 95.0, 92.0, 93.0)
        cache.upsert_bar(crossed)
        assert engine.on_closed_bar(
            "1m",
            OHLCVBar(
                time=crossed.time,
                open=crossed.open,
                high=crossed.high,
                low=crossed.low,
                close=crossed.close,
                volume=crossed.volume,
            ),
        ) == 1

        saved = cache.orders.read(order.id, user.id)
        assert saved is not None
        assert saved.status is OrderStatus.CLOSED
        assert fake.positions(user.id, account.id) == []
        assert cache.supertrend_trailing.read(user.id, "order", order.id) is None
    finally:
        cache.close()


@pytest.mark.unit
def test_manual_trailing_never_closes_auto_mgann_order(tmp_path):
    cache, fake, user, account, order, engine = _setup(
        tmp_path, source=OrderSource.AUTO_MGANN
    )
    try:
        cache.upsert_bar(_bar(60_000, 100.0, 101.0, 99.0, 100.0))
        rule = prime_supertrend_trailing(cache, _rule(user, account, order))
        cache.supertrend_trailing.upsert(rule)
        crossed = _bar(120_000, 100.0, 100.0, 90.0, 91.0)
        cache.upsert_bar(crossed)

        assert engine.on_closed_bar(
            "1m",
            OHLCVBar(
                time=crossed.time,
                open=crossed.open,
                high=crossed.high,
                low=crossed.low,
                close=crossed.close,
                volume=crossed.volume,
            ),
        ) == 0
        assert len(fake.positions(user.id, account.id)) == 1
        assert cache.orders.read(order.id, user.id).status is OrderStatus.FILLED
        assert cache.supertrend_trailing.read(user.id, "order", order.id) is None
    finally:
        cache.close()


@pytest.mark.unit
def test_activation_requires_price_on_the_position_side_of_supertrend(tmp_path):
    cache, _, user, account, order, _ = _setup(tmp_path)
    try:
        rule = _rule(user, account, order)
        cache.upsert_bar(_bar(60_000, 100.0, 101.0, 99.0, 100.0))
        assert supertrend_trailing_activation_error(cache, rule) is None

        # This close crosses below the prior green line and flips the current
        # SuperTrend regime red, so BUY cannot be armed while SELL can.
        cache.upsert_bar(_bar(120_000, 100.0, 100.0, 89.0, 90.0))
        assert "Cannot enable BUY" in supertrend_trailing_activation_error(
            cache, rule
        )
        rule.side = "sell"
        assert supertrend_trailing_activation_error(cache, rule) is None
    finally:
        cache.close()
