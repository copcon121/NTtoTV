from __future__ import annotations

import sqlite3

import pytest

from app.models.orders import OrderKind, OrderRecord, OrderSide, OrderSource, OrderStatus
from app.storage.cache_store import CacheStore


@pytest.fixture()
def cache(tmp_path):
    store = CacheStore(tmp_path / "app.sqlite")
    try:
        for username in ("u1", "u2"):
            user = store.users.create_user(username, "p")
            store.users.upsert_mt5_account(
                user_id=user.id,
                login=1,
                password="fake",
                server="Fake-Demo",
                symbol_broker="XAUUSDm",
                credential_key="k",
            )
        yield store
    finally:
        store.close()


def _user_id(cache: CacheStore, username: str) -> str:
    user = cache.users.read_user_by_username(username)
    assert user is not None
    return user.id


def _account_id(cache: CacheStore, user_id: str) -> str:
    account = cache.users.read_mt5_account(user_id)
    assert account is not None
    return account.id


def _order(
    cache: CacheStore, username: str, idem: str, order_id: str = "ord_1"
) -> OrderRecord:
    user_id = _user_id(cache, username)
    return OrderRecord(
        id=order_id,
        user_id=user_id,
        account_id=_account_id(cache, user_id),
        source=OrderSource.API,
        symbol_internal="GC",
        contract_internal="GC",
        source_contract="GC 08-26",
        symbol_broker="XAUUSDm",
        side=OrderSide.BUY,
        kind=OrderKind.LIMIT,
        volume_lots=0.1,
        gc_anchored=True,
        status=OrderStatus.WORKING,
        idempotency_key=idem,
        created_at=1,
        updated_at=1,
        take_profit_1r_enabled=True,
        take_profit_r=1.5,
        auto_supertrend_after_1r_enabled=True,
        trailing_timeframe="5m",
        trailing_period=14,
        trailing_multiplier=2.5,
        trailing_atr_method="sma",
        trailing_source="close",
        entry_gc=2350.0,
        sl_gc=2347.0,
        tp_gc=2356.0,
    )


@pytest.mark.unit
def test_order_store_round_trip_and_version(cache: CacheStore):
    user_id = _user_id(cache, "u1")
    created = cache.orders.create(_order(cache, "u1", "idem-a"))

    saved = cache.orders.read(created.id, user_id)
    assert saved is not None
    assert saved.entry_gc == 2350.0
    assert saved.take_profit_1r_enabled is True
    assert saved.take_profit_r == 1.5
    assert saved.auto_supertrend_after_1r_enabled is True
    assert saved.trailing_timeframe == "5m"
    assert saved.trailing_period == 14
    assert saved.trailing_multiplier == 2.5
    assert saved.trailing_atr_method == "sma"
    assert saved.trailing_source == "close"
    assert saved.version == 1

    saved.sl_gc = 2348.0
    cache.orders.update(saved)

    updated = cache.orders.read(created.id, user_id)
    assert updated is not None
    assert updated.sl_gc == 2348.0
    assert updated.take_profit_r == 1.5
    assert updated.version == 2


@pytest.mark.unit
def test_order_idempotency_is_scoped_by_user(cache: CacheStore):
    user_1 = _user_id(cache, "u1")
    user_2 = _user_id(cache, "u2")
    cache.orders.create(_order(cache, "u1", "same", "ord_1"))
    cache.orders.create(_order(cache, "u2", "same", "ord_2"))

    assert cache.orders.read_by_idempotency(user_1, "same").id == "ord_1"
    assert cache.orders.read_by_idempotency(user_2, "same").id == "ord_2"


@pytest.mark.unit
def test_order_duplicate_idempotency_same_user_rejected(cache: CacheStore):
    cache.orders.create(_order(cache, "u1", "same", "ord_1"))

    with pytest.raises(Exception):
        cache.orders.create(_order(cache, "u1", "same", "ord_2"))


@pytest.mark.unit
def test_submission_claim_is_atomic_across_threads(cache: CacheStore):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    orders = [_order(cache, "u1", "same", f"ord_{i}") for i in range(4)]
    ready = Barrier(len(orders))

    def claim(order):
        ready.wait(timeout=5)
        return cache.orders.create_once(order)

    with ThreadPoolExecutor(max_workers=4) as pool:
        assert sum(pool.map(claim, orders)) == 1
    assert len(cache.orders.list_for_user(orders[0].user_id)) == 1


@pytest.mark.unit
def test_existing_orders_migrate_to_one_r(cache: CacheStore, tmp_path):
    order = cache.orders.create(_order(cache, "u1", "old-order"))
    cache.close()
    path = tmp_path / "app.sqlite"
    with sqlite3.connect(path) as connection:
        connection.execute("ALTER TABLE orders DROP COLUMN take_profit_r")
    with CacheStore(path) as reopened:
        saved = reopened.orders.read(order.id, order.user_id)
        assert saved.take_profit_r == 1.0
        assert saved.take_profit_1r_enabled is True
