from __future__ import annotations

import pytest

from app.engines.anchored_sync import AnchoredSyncConfig, AnchoredSyncEngine
from app.engines.basis_engine import BasisEngine
from app.models.orders import OrderKind, OrderRecord, OrderSide, OrderSource, OrderStatus
from app.models.timestamp import now_ms
from app.mt5.fake import FakeMt5Backend
from app.mt5.manager import Mt5Manager
from app.storage.cache_store import CacheStore


@pytest.mark.unit
def test_anchored_sync_modifies_when_basis_moves(tmp_path):
    cache = CacheStore(tmp_path / "app.sqlite")
    fake = FakeMt5Backend(bid=2338.0, ask=2338.1)
    manager = Mt5Manager(backend=fake)
    basis = BasisEngine()
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
        order = OrderRecord(
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
            entry_gc=2350.0,
            sl_gc=2347.0,
            tp_gc=2356.0,
            entry_broker=2350.0,
            sl_broker=2347.0,
            tp_broker=2356.0,
            broker_order_ticket=10,
        )
        cache.orders.create(order)
        current = now_ms()
        basis.update_gc(2350.0, current)
        basis.update_broker_mid(2338.0, current)

        changed = AnchoredSyncEngine(
            cache,
            manager,
            basis,
            config=AnchoredSyncConfig(threshold_ticks=1, min_interval_ms=0),
        ).run_once()

        assert changed == 1
        saved = cache.orders.read("ord", user.id)
        assert saved is not None
        assert saved.entry_broker != 2350.0
    finally:
        cache.close()
