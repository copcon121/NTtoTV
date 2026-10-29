import asyncio
from types import SimpleNamespace

import pytest

from app.engines.contract_resolver import ContractResolver
from app.models.canonical import NormalizedTrade
from app.models.messages import EventType, MarketDataStatus
from app.pipeline import Pipeline
from app.registry.registry import WebSocketRegistry
from app.rest.routes import _raw_rebuild_source
from app.storage.cache_store import CacheStore
from app.storage.tick_store import TickStore


@pytest.mark.integration
def test_rithmic_transport_events_request_repair_without_changing_source(tmp_path, monkeypatch):
    at = 1793181600000
    monkeypatch.setattr("app.pipeline.now_ms", lambda: at)
    cache, ticks = CacheStore(tmp_path / "cache.sqlite"), TickStore(tmp_path / "ticks")
    resolver = ContractResolver(["GC 12-26"])
    resolver.set_manual_override("GC 12-26")
    registry = WebSocketRegistry()
    events, requested = [], []
    registry.enqueue = events.append
    pipeline = Pipeline(registry=registry, cache=cache, tick_store=ticks, resolver=resolver)
    pipeline.bind_history_sync_requester(lambda: requested.append(True))
    pipeline._active_feed = "bookmap"

    async def scenario():
        await pipeline.on_rithmic_connect({"contract": "GC 12-26"})
        await pipeline.on_rithmic_depth({}, sequence_gap=True)
        for sequence in (1, 3):
            await pipeline.on_rithmic_trade(NormalizedTrade(
                symbol="GC", contract="GC 12-26", time=at + sequence,
                price=4200., volume=1, bid=4199.9, ask=4200.,
                best_bid=4199.9, best_ask=4200., sequence=sequence,
            ))
        await pipeline.on_rithmic_disconnect()
        await pipeline.on_rithmic_history_status({"state": "synced", "connected": True, "lastSuccessAt": at})
        with pytest.raises(ValueError, match="contract"):
            await pipeline.persist_rithmic_history("GC 10-26", lambda: pytest.fail("wrong-contract write"))

    try:
        asyncio.run(scenario())
        assert len(requested) == 4
        status = MarketDataStatus.from_dict(pipeline.market_data_status_dict())
        assert status.history_sync["state"] == "synced"
        assert any(event.event_type == EventType.MARKET_DATA_STATUS and
                   event.payload.get("historySync", {}).get("state") == "synced" for event in events)
        request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(runtime=SimpleNamespace(
            pipeline=SimpleNamespace(market_data_status_message=lambda: SimpleNamespace(
                active_source="rithmic", preferred_source="bookmap"))))))
        assert _raw_rebuild_source(request) == "rithmic"
    finally:
        ticks.close()
        cache.close()
