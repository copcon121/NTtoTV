from __future__ import annotations

import asyncio

import pytest

from app.config import Settings
from app.engines.contract_resolver import ContractResolver
from app.models import NormalizedTrade, Side
from app.models.timestamp import now_ms
from app.pipeline import Pipeline
from app.registry.registry import WebSocketRegistry
from app.storage.cache_store import CacheStore
from app.storage.liquidity_store import LiquidityStore
from app.storage.tick_store import TickStore


@pytest.mark.integration
def test_pipeline_has_one_authoritative_source_and_repairs_sequence_gaps(tmp_path) -> None:
    settings = Settings(
        data_dir=tmp_path,
        rithmic_enabled=True,
        rithmic_history_enabled=True,
        rithmic_contract="GC 12-26",
        rithmic_qualify_ms=0,
        trading_enabled=False,
        analyst_enabled=False,
    )
    cache = CacheStore.open(settings)
    ticks = TickStore(settings.ticks_dir)
    liquidity = LiquidityStore(settings.liquidity_db_path)
    pipeline = Pipeline(
        registry=WebSocketRegistry(),
        cache=cache,
        tick_store=ticks,
        liquidity_store=liquidity,
        resolver=ContractResolver(["GC 12-26"]),
        settings=settings,
    )
    repairs: list[bool] = []
    pipeline.bind_history_sync_requester(lambda: repairs.append(True))

    async def scenario() -> None:
        await pipeline.on_rithmic_connect({"contract": "GC 12-26"})
        await pipeline.on_rithmic_health(
            {
                "contract": "GC 12-26",
                "subscriptions": {"l1": True, "l2": True, "mbo": True},
                "mboSynchronized": True,
            }
        )
        await pipeline.on_rithmic_history_status(
            {"state": "synced", "pendingRanges": [], "highWatermark": now_ms()}
        )
        await pipeline.maintenance_tick()

        status = pipeline.market_data_status_dict()
        assert status["activeSource"] == "rithmic"
        assert status["preferredSource"] == "rithmic"
        assert set(status["sources"]) == {"rithmic"}
        assert pipeline.is_ready()

        at = now_ms()
        first = NormalizedTrade(
            symbol="GC",
            contract="GC 12-26",
            time=at,
            price=2700.0,
            volume=2,
            bid=2699.9,
            ask=2700.0,
            best_bid=2699.9,
            best_ask=2700.0,
            sequence=1,
            side=Side.BUY,
            aggressor_order_id="order-1",
        )
        await pipeline.on_rithmic_trade(first)
        await pipeline.on_rithmic_trade(
            NormalizedTrade(
                symbol="GC",
                contract="GC 12-26",
                time=at + 1,
                price=2700.1,
                volume=1,
                bid=2700.0,
                ask=2700.1,
                best_bid=2700.0,
                best_ask=2700.1,
                sequence=3,
                side=Side.BUY,
                aggressor_order_id="order-2",
            )
        )

        raw = list(ticks.read_range("GC 12-26", at, at + 1))
        assert [row.contract for row in raw] == ["GC 12-26", "GC 12-26"]
        assert all(row.source == "rithmic" for row in raw)
        assert cache.read_bars("GC", "GC", "1m", limit=1)
        assert repairs
        assert pipeline.market_data_status_dict()["sources"]["rithmic"][
            "orderflowGapPending"
        ] is True

    try:
        asyncio.run(scenario())
    finally:
        ticks.close()
        liquidity.close()
        cache.close()
