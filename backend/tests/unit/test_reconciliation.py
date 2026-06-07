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
