from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from app.rithmic.service import RithmicMarketDataService, RithmicServiceConfig

pytestmark = pytest.mark.unit


class Sink:
    def __init__(self):
        self.events = []
        self.trades = []
        self.timeline = []

    async def on_rithmic_icebergs(self, events):
        self.events.extend(events)
        self.timeline.extend(event["status"] for event in events)

    async def on_rithmic_trade(self, trade):
        self.trades.append(trade)
        self.timeline.append("trade")

    async def on_rithmic_depth(self, *args, **kwargs):
        pass

    async def on_rithmic_health(self, details):
        pass

    async def on_rithmic_disconnect(self, reason=None):
        self.timeline.append("disconnect")


def service_and_sink():
    sink = Sink()
    config = RithmicServiceConfig(
        uri="wss://example.invalid:443", archive_path=Path("RProtocolAPI.zip"),
        user="test-user", password="test-password", system_name="Test",
        app_name="Test", app_version="1", exchange="COMEX", wire_symbol="GCZ6",
        contract="GC 12-26",
    )
    return RithmicMarketDataService(config, sink), sink


async def snapshot(service, *, sequence=100, size=10):
    await service._begin_mbo_snapshot()
    await service._dispatch({
        "type": "mbo_snapshot", "sequence": sequence, "side": "sell",
        "price": 2700.1, "timeMs": 100,
        "orders": [{"exchangeOrderId": "ask-1", "size": size}],
    })
    await service._dispatch({"type": "mbo_snapshot", "rpCode": ["0"], "timeMs": 100})


async def trade(service, volume=10, *, time=101):
    await service._dispatch({
        "type": "trade", "price": 2700.1, "size": volume, "aggressor": "buy",
        "exchangeOrderId": "ask-1", "timeMs": time,
    })


async def change(service, *, sequence=101, size=10, time=102):
    await service._dispatch({
        "type": "mbo_update", "sequence": sequence, "timeMs": time,
        "updates": [{"exchangeOrderId": "ask-1", "action": "change", "size": size}],
    })


def test_detection_runs_before_l1_sink_and_duplicate_mbo_does_not_replay():
    service, sink = service_and_sink()

    async def scenario():
        await snapshot(service)
        assert service._status_details()["icebergSynchronized"] is True
        await trade(service)
        await change(service)
        assert len(sink.events) == 1
        await change(service, size=500)
        await trade(service, volume=11, time=103)
        assert sink.events[-1]["executedVolume"] == 21
        assert sink.events[-1]["displayedSize"] == 0
        assert sink.events[-1]["refillCount"] == 1
        assert sink.timeline[-2:] == ["active", "trade"]
        # A stale/duplicate snapshot terminator must not erase this order.
        await service._dispatch({"type": "mbo_snapshot", "rpCode": ["0"], "timeMs": 103})
        assert sink.events[-1]["status"] == "active"
        await service._dispatch({
            "type": "mbo_update", "sequence": 102, "timeMs": 104,
            "updates": [{"exchangeOrderId": "ask-1", "action": "delete"}],
        })
        assert sink.events[-1]["status"] == "executed"

    asyncio.run(scenario())
    assert service._status_details()["icebergMethod"] == "native"
    assert service._status_details()["icebergDetectedOrders"] == 0


def test_other_order_trade_through_publishes_terminal_state_before_l1_sink():
    service, sink = service_and_sink()

    async def scenario():
        await snapshot(service)
        await trade(service, volume=11)
        detected = sink.events[-1]
        await service._dispatch({
            "type": "trade", "price": 2700.2, "size": 50, "aggressor": "buy",
            "exchangeOrderId": "another-order", "timeMs": 102,
        })
        ended = sink.events[-1]
        assert ended["orderId"] == detected["orderId"] == "ask-1"
        assert ended["status"] == "invalidated"
        assert ended["endTime"] == 102
        assert ended["executedVolume"] == 11 and ended["refillCount"] == 0
        assert sink.timeline[-2:] == ["invalidated", "trade"]
        assert len(sink.trades) == 2
        assert service._status_details()["icebergDetectedOrders"] == 0

    asyncio.run(scenario())


def test_gap_invalidates_and_requires_a_new_snapshot_generation():
    service, sink = service_and_sink()

    async def scenario():
        await snapshot(service)
        await trade(service, volume=11)
        old_session = sink.events[-1]["sessionId"]
        await change(service, sequence=102)
        assert sink.events[-1]["status"] == "invalidated"
        assert sink.events[-1]["sessionId"] == old_session
        assert service._mbo_resync_requested is True
        assert service._status_details()["icebergSynchronized"] is False
        count = len(sink.events)
        await trade(service, volume=100)
        assert len(sink.events) == count
        await snapshot(service, sequence=200)
        await trade(service, volume=11)
        assert sink.events[-1]["sessionId"] != old_session
        assert sink.events[-1]["executedVolume"] == 11

    asyncio.run(scenario())


def test_buffered_mbo_and_trades_during_snapshot_are_seeded_without_detection():
    service, sink = service_and_sink()

    async def scenario():
        await service._begin_mbo_snapshot()
        await service._dispatch({
            "type": "mbo_snapshot", "sequence": 100, "side": "sell", "price": 2700.1,
            "orders": [{"exchangeOrderId": "ask-1", "size": 1}], "timeMs": 100,
        })
        await trade(service, volume=100)
        await change(service, sequence=101, size=20)
        assert sink.events == []
        assert service._status_details()["icebergSynchronized"] is False
        await service._dispatch({"type": "mbo_snapshot", "rpCode": ["0"], "timeMs": 102})
        assert service.book.orders["ask-1"].size == 20
        await trade(service, volume=20, time=103)
        assert sink.events == []
        await change(service, sequence=102, size=20, time=104)
        assert sink.events[-1]["executedVolume"] == 20
        assert sink.events[-1]["refillCount"] == 1

    asyncio.run(scenario())


def test_snapshot_buffer_gap_does_not_enable_the_detector():
    service, sink = service_and_sink()

    async def scenario():
        await service._begin_mbo_snapshot()
        await service._dispatch({
            "type": "mbo_snapshot", "sequence": 100, "side": "sell", "price": 2700.1,
            "orders": [{"exchangeOrderId": "ask-1", "size": 1}],
        })
        await change(service, sequence=102)
        await service._dispatch({"type": "mbo_snapshot", "rpCode": ["0"]})
        assert service._status_details()["icebergSynchronized"] is False
        assert service._mbo_resync_requested is True
        await trade(service, volume=100)
        assert sink.events == []

    asyncio.run(scenario())


def test_book_clear_invalidates_and_requests_resynchronization():
    service, sink = service_and_sink()

    async def scenario():
        await snapshot(service)
        await trade(service, volume=11)
        await service._dispatch({"type": "order_book", "updateType": "clear", "timeMs": 102})
        assert sink.events[-1]["status"] == "invalidated"
        assert service._status_details()["icebergSynchronized"] is False
        assert service._mbo_resync_requested is True
        count = len(sink.events)
        await trade(service, volume=100)
        assert len(sink.events) == count

    asyncio.run(scenario())


def test_resync_ends_old_active_orders_before_replacing_session():
    service, sink = service_and_sink()

    async def scenario():
        await snapshot(service)
        await trade(service, volume=11)
        old_session = sink.events[-1]["sessionId"]
        await service._begin_mbo_snapshot()
        assert sink.events[-1]["status"] == "invalidated"
        assert sink.events[-1]["sessionId"] == old_session
        assert service._status_details()["icebergSessionId"] != old_session

    asyncio.run(scenario())


def test_disconnect_publishes_invalidations_before_disconnect_sink(monkeypatch):
    service, sink = service_and_sink()
    monkeypatch.setattr("app.rithmic.service.ssl_context_from_archive", lambda path: None)

    async def failing_connection():
        await snapshot(service)
        await trade(service, volume=11)
        service._stopping.set()
        raise RuntimeError("test disconnect")

    monkeypatch.setattr(service, "_run_connection", failing_connection)
    asyncio.run(service.run())
    assert sink.timeline[-2:] == ["invalidated", "disconnect"]
    assert service._status_details()["icebergSynchronized"] is False


def test_optional_sink_keeps_legacy_adapters_usable():
    service, sink = service_and_sink()

    class LegacySink:
        on_rithmic_trade = sink.on_rithmic_trade
        on_rithmic_depth = sink.on_rithmic_depth
        on_rithmic_health = sink.on_rithmic_health

    service.sink = LegacySink()

    async def scenario():
        await snapshot(service)
        await trade(service, volume=11)
        assert service._status_details()["icebergDetectedOrders"] == 1

    asyncio.run(scenario())
