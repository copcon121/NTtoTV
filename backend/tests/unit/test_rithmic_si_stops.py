import asyncio
from pathlib import Path

import pytest

from app.rithmic.service import RithmicMarketDataService, RithmicServiceConfig

pytestmark = pytest.mark.unit


class Sink:
    def __init__(self):
        self.chains = []
        self.trades = []

    async def on_rithmic_stops(self, rows): self.chains.extend(rows)
    async def on_rithmic_trade(self, trade): self.trades.append(trade)
    async def on_rithmic_depth(self, *args, **kwargs): pass
    async def on_rithmic_health(self, details): pass


def service():
    sink = Sink()
    config = RithmicServiceConfig(uri="wss://example.invalid:443", archive_path=Path("RProtocolAPI.zip"),
        user="fake", password="fake", system_name="Test", app_name="Test", app_version="1",
        exchange="COMEX", wire_symbol="GCZ6", contract="GC 12-26")
    return RithmicMarketDataService(config, sink), sink


async def image(s):
    await s._begin_mbo_snapshot()
    await s._dispatch({"type": "mbo_snapshot", "side": "sell", "price": 2700,
        "sequence": 100, "orders": [{"exchangeOrderId": "rest", "size": 500}], "timeMs": 100})
    await s._dispatch({"type": "mbo_snapshot", "rpCode": ["0"], "timeMs": 100})


async def tick(s, order, at, **patch):
    await s._dispatch({"type": "trade", "symbol": "GCZ6", "exchange": "COMEX",
        "price": 2700, "size": 2, "aggressor": "buy", "exchangeOrderId": "rest",
        "aggressorExchangeOrderId": order, "timeMs": at, "presenceBits": 1, **patch})


def test_completed_chain_reaches_sink_only_at_effective_depth_boundary():
    s, sink = service()

    async def run():
        await image(s)
        await tick(s, "A", 101)
        await tick(s, "metadata", 102, presenceBits=8, size=1000)
        await tick(s, "B", 103)
        assert sink.chains == []
        await s._dispatch({"type": "order_book", "updateType": "solo", "timeMs": 104,
            "bids": [{"price": 2699.9, "size": 10}], "asks": []})
        assert len(sink.chains) == 1 and sink.chains[0]["executedVolume"] == 2
        assert sink.chains[0]["endReason"] == "depth"
        assert len(sink.trades) == 2

    asyncio.run(run())


@pytest.mark.parametrize("ending", ["gap", "clear", "snapshot"])
def test_lost_mbo_fidelity_discards_pending_without_completed_marks(ending):
    s, sink = service()

    async def run():
        await image(s)
        await tick(s, "A", 101)
        await tick(s, "B", 102)
        if ending == "gap":
            await s._dispatch({"type": "mbo_update", "sequence": 102, "timeMs": 103,
                "updates": [{"action": "change", "exchangeOrderId": "rest", "size": 500}]})
        elif ending == "clear":
            await s._dispatch({"type": "order_book", "updateType": "clear", "timeMs": 103})
        else:
            await s._begin_mbo_snapshot()
        assert sink.chains == [] and not s._stops.synchronized

    asyncio.run(run())


def test_other_instruments_and_duplicate_images_cannot_create_boundaries():
    s, sink = service()

    async def run():
        await image(s)
        await tick(s, "A", 101)
        await tick(s, "B", 102)
        await tick(s, "wrong", 103, symbol="SIH7", aggressor="sell")
        await s._dispatch({"type": "mbo_snapshot", "rpCode": ["0"], "timeMs": 103})
        await s._dispatch({"type": "mbo_update", "sequence": 100, "timeMs": 103,
            "updates": [{"action": "delete", "exchangeOrderId": "rest"}]})
        assert sink.chains == []
        await s._dispatch({"type": "mbo_update", "sequence": 101, "timeMs": 104,
            "updates": [{"action": "change", "exchangeOrderId": "rest", "size": 500}]})
        assert len(sink.chains) == 1 and sink.chains[0]["executedVolume"] == 2

    asyncio.run(run())
