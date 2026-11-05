import asyncio
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.app import create_app
from app.engines.contract_resolver import ContractResolver
from app.models.messages import EventType, Subscribe
from app.models.si_stops import SiStopChain
from app.pipeline import Pipeline
from app.registry.registry import WebSocketRegistry, coalescing_subkey
from app.storage.cache_store import CacheStore
from app.storage.liquidity_store import LiquidityStore
from app.storage.tick_store import TickStore

pytestmark = pytest.mark.integration


def chain():
    return SiStopChain(symbol="GC", contract="GC", source_contract="GC 12-26",
        session_id="s1", chain_id="s1:1", sequence=1, side="buy", time=2000,
        start_time=1990, completed_time=2001, price=2700.1, first_price=2700,
        vwap=2700.05, executed_volume=10, execution_count=2, aggressor_count=2,
        end_reason="depth").to_dict()


@pytest.fixture
def setup(tmp_path, monkeypatch):
    monkeypatch.setattr("app.pipeline.now_ms", lambda: 3000)
    cache, ticks, store = CacheStore(tmp_path / "app.sqlite"), TickStore(tmp_path / "ticks"), LiquidityStore(tmp_path / "lq.sqlite")
    resolver = ContractResolver(["GC 12-26", "GC 10-26"])
    resolver.set_manual_override("GC 12-26")
    captured = []
    registry = WebSocketRegistry()
    registry.enqueue = captured.append
    def pipeline():
        return Pipeline(registry=registry, cache=cache, tick_store=ticks,
            resolver=resolver, liquidity_store=store)
    yield pipeline(), captured, pipeline, store
    store.close(); ticks.close(); cache.close()


def test_completed_chain_publication_history_identity_and_restart(setup):
    p, captured, new_pipeline, _ = setup
    one = chain()
    two = {**one, "chainId": "s1:2", "sequence": 2}
    wrong = {**one, "chainId": "wrong", "sourceContract": "GC 10-26"}

    async def run():
        await p.on_rithmic_connect({"contract": "GC 12-26", "siStopsSessionId": "s1", "siStopsSynchronized": True})
        await p.on_rithmic_stops([one, one, two, wrong])

    asyncio.run(run())
    events = [e for e in captured if e.event_type == EventType.SI_STOP]
    assert len(events) == 2 and coalescing_subkey(one) != coalescing_subkey(two)
    assert p.si_stop_snapshot()["chains"] == [one, two]
    assert p.si_stop_snapshot()["synchronized"] is True
    assert p.si_stop_snapshot(min_volume=11)["chains"] == []
    restored = new_pipeline().si_stop_snapshot()
    assert restored["chains"] == [one, two]
    assert restored["connected"] is False
    assert Subscribe.from_dict({"type": "subscribe", "symbol": "GC", "events": ["si_stop"]}).events == [EventType.SI_STOP]


def test_rest_filters_before_limit_and_never_mixes_mv_stop_history(setup):
    p, _, _, store = setup
    one = chain()
    newer = {**one, "chainId": "s1:2", "sequence": 2, "time": 2100, "completedTime": 2101, "executedVolume": 2}
    asyncio.run(p.on_rithmic_stops([one, newer]))
    app = create_app(lifespan=False)
    app.state.runtime = SimpleNamespace(pipeline=p)
    with TestClient(app) as client:
        payload = client.get("/api/orderflow/si-stops?min_volume=10&limit=1").json()
        assert payload["chains"] == [one] and payload["retentionHours"] == 48
        assert client.get("/api/orderflow/si-stops?from=2001").json()["chains"] == [newer]
        assert client.get("/api/orderflow/si-stops?symbol=ES").status_code == 404
        assert client.get("/api/orderflow/si-stops?contract=GC%2012-26").status_code == 404
        assert client.get("/api/orderflow/si-stops?from=2&to=1").status_code == 400
        assert client.get("/api/orderflow/si-stops?min_volume=0").status_code == 400
    assert store.purge_si_stops_before(2001) == 1
    assert store.read_si_stops("GC", "GC", "GC 12-26", 0, 3000) == [newer]
