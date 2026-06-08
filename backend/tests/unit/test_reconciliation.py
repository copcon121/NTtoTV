from __future__ import annotations

import pytest

from app.engines.reconciliation import ReconciliationEngine
from app.models.orders import OrderKind, OrderRecord, OrderSide, OrderSource, OrderStatus
from app.mt5.fake import FakeMt5Backend
from app.mt5.manager import Mt5Manager
from app.storage.cache_store import CacheStore


@pytest.mark.unit
def test_reconciliation_marks_missing_working_order_cancelled(tmp_path):
    cache = CacheStore(tmp_path / "app.sqlite")
    manager = Mt5Manager(backend=FakeMt5Backend())
    try:
        user = cache.users.create_user("u", "p")
        account = cache.users.upsert_mt5_account(
            user_id=user.id,
            login=1,
            password="fake",
            server="Fake-Demo",
            symbol_broker="XAUUSDm",
            credential_key="k",
        )
        cache.orders.create(
            OrderRecord(
                id="ord",
                user_id=user.id,
                account_id=account.id,
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
                idempotency_key="i",
                created_at=1,
                updated_at=1,
                broker_order_ticket=999,
            )
        )

        assert ReconciliationEngine(cache, manager).run_once() == 1
        saved = cache.orders.read("ord", user.id)
        assert saved is not None
        assert saved.status is OrderStatus.CANCELLED
    finally:
        cache.close()


@pytest.mark.unit
def test_reconciliation_marks_missing_sync_error_pending_order_cancelled(tmp_path):
    cache = CacheStore(tmp_path / "app.sqlite")
    manager = Mt5Manager(backend=FakeMt5Backend())
    try:
        user = cache.users.create_user("u", "p")
        account = cache.users.upsert_mt5_account(
            user_id=user.id,
            login=1,
            password="fake",
            server="Fake-Demo",
            symbol_broker="XAUUSDm",
            credential_key="k",
        )
        cache.orders.create(
            OrderRecord(
                id="ord_sync_error",
                user_id=user.id,
                account_id=account.id,
                source=OrderSource.API,
                symbol_internal="GC",
                contract_internal="GC",
                source_contract="GC 08-26",
                symbol_broker="XAUUSDm",
                side=OrderSide.BUY,
                kind=OrderKind.LIMIT,
                volume_lots=0.1,
                gc_anchored=True,
                status=OrderStatus.SYNC_ERROR,
                idempotency_key="i",
                created_at=1,
                updated_at=1,
                broker_order_ticket=999,
                last_broker_error_code="10015",
                last_broker_error_message="Invalid price",
            )
        )

        assert ReconciliationEngine(cache, manager).run_once() == 1
        saved = cache.orders.read("ord_sync_error", user.id)
        assert saved is not None
        assert saved.status is OrderStatus.CANCELLED
    finally:
        cache.close()


@pytest.mark.unit
def test_reconciliation_repairs_filled_position_ticket(tmp_path):
    class PositionBackend:
        def orders(self, user_id: str, account_id: str) -> list[dict]:
            return []

        def positions(self, user_id: str, account_id: str) -> list[dict]:
            return [
                {
                    "ticket": 555001,
                    "identifier": 1371359974,
                    "symbol": "XAUUSDc",
                    "side": "sell",
                    "volumeLots": 0.15,
                    "entryBroker": 4313.998,
                    "magic": 240606,
                    "comment": "NTtoTV-ord-d18838da2af176",
                    "time": 1780882201749,
                }
            ]

    cache = CacheStore(tmp_path / "app.sqlite")
    manager = Mt5Manager(backend=PositionBackend())
    try:
        user = cache.users.create_user("u", "p")
        account = cache.users.upsert_mt5_account(
            user_id=user.id,
            login=1,
            password="fake",
            server="Fake-Real",
            symbol_broker="XAUUSDc",
            credential_key="k",
        )
        cache.orders.create(
            OrderRecord(
                id="ord_5db0f2fc66d18838da2af176",
                user_id=user.id,
                account_id=account.id,
                source=OrderSource.API,
                symbol_internal="GC",
                contract_internal="GC",
                source_contract="GC 08-26",
                symbol_broker="XAUUSDc",
                side=OrderSide.SELL,
                kind=OrderKind.MARKET,
                volume_lots=0.15,
                gc_anchored=True,
                status=OrderStatus.SYNC_ERROR,
                idempotency_key="i",
                created_at=1,
                updated_at=1,
                broker_order_ticket=1371359974,
                broker_deal_ticket=1267515439,
                entry_broker=4313.891,
                fill_price_broker=4313.998,
            )
        )

        assert ReconciliationEngine(cache, manager).run_once() == 1
        saved = cache.orders.read("ord_5db0f2fc66d18838da2af176", user.id)
        assert saved is not None
        assert saved.status is OrderStatus.FILLED
        assert saved.broker_position_ticket == 555001
        assert saved.last_broker_error_code is None
        assert saved.last_broker_error_message is None
    finally:
        cache.close()


@pytest.mark.unit
def test_reconciliation_closes_stale_market_fill_without_position(tmp_path):
    class EmptyBrokerBackend:
        def orders(self, user_id: str, account_id: str) -> list[dict]:
            return []

        def positions(self, user_id: str, account_id: str) -> list[dict]:
            return []

    cache = CacheStore(tmp_path / "app.sqlite")
    manager = Mt5Manager(backend=EmptyBrokerBackend())
    try:
        user = cache.users.create_user("u", "p")
        account = cache.users.upsert_mt5_account(
            user_id=user.id,
            login=1,
            password="fake",
            server="Fake-Real",
            symbol_broker="XAUUSDc",
            credential_key="k",
        )
        cache.orders.create(
            OrderRecord(
                id="ord_missing_position",
                user_id=user.id,
                account_id=account.id,
                source=OrderSource.API,
                symbol_internal="GC",
                contract_internal="GC",
                source_contract="GC 08-26",
                symbol_broker="XAUUSDc",
                side=OrderSide.SELL,
                kind=OrderKind.MARKET,
                volume_lots=0.15,
                gc_anchored=True,
                status=OrderStatus.SYNC_ERROR,
                idempotency_key="i",
                created_at=1,
                updated_at=1,
                submitted_at=1,
                broker_order_ticket=1371359974,
                broker_deal_ticket=1267515439,
            )
        )

        assert ReconciliationEngine(cache, manager).run_once() == 1
        saved = cache.orders.read("ord_missing_position", user.id)
        assert saved is not None
        assert saved.status is OrderStatus.CLOSED
        assert saved.closed_at is not None
    finally:
        cache.close()
