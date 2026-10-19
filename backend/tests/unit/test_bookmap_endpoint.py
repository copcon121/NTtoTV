from __future__ import annotations

import asyncio

import pytest

from app.ingest.bookmap_endpoint import BookmapControl, _SequenceTracker, _dispatch
from app.models import Side


class _Pipeline:
    def __init__(self) -> None:
        self.trades = []
        self.liquidity = []

    async def on_bookmap_trade(self, trade, *, connection_id=None):
        self.trades.append((trade, connection_id))

    async def on_bookmap_heartbeat(self, payload, *, connection_id=None):
        raise AssertionError("unexpected heartbeat")

    async def on_bookmap_bar(self, payload, *, connection_id=None):
        raise AssertionError("unexpected bar")

    async def on_bookmap_liquidity(self, payload, *, connection_id=None):
        self.liquidity.append((payload, connection_id))


class _ControlSocket:
    def __init__(self) -> None:
        self.frames = []

    async def send_json(self, payload):
        self.frames.append(payload)


@pytest.mark.unit
def test_sequence_tracker_isolated_by_alias_and_channel():
    tracker = _SequenceTracker()
    base = {"source": "bookmap", "alias": "GCQ6", "sequence": 10}
    assert tracker.evaluate({**base, "type": "trade"}) == (True, False)
    assert tracker.evaluate({**base, "type": "heartbeat"}) == (True, False)
    assert tracker.evaluate({**base, "type": "trade"}) == (False, False)
    assert tracker.evaluate({**base, "type": "trade", "sequence": 12}) == (
        True,
        True,
    )
    assert tracker.evaluate({**base, "type": "trade", "alias": "GCZ6"}) == (
        True,
        False,
    )


@pytest.mark.unit
def test_trade_decoder_preserves_bookmap_execution_metadata():
    pipeline = _Pipeline()
    payload = {
        "type": "trade",
        "source": "bookmap",
        "symbol": "GC",
        "contract": "GC 08-26",
        "alias": "GCQ6.COMEX@RITHMIC",
        "time": 1_753_200_000_123,
        "timeNanos": 1_753_200_000_123_456_789,
        "bridgeTime": 1_753_200_000_130,
        "price": 3350.1,
        "volume": 31,
        "side": "sell",
        "aggressorOrderId": "aggr-1",
        "passiveOrderId": "passive-1",
        "executionStart": True,
        "executionEnd": False,
        "otc": True,
        "sequence": 99,
    }

    asyncio.run(_dispatch(pipeline, payload, connection_id="connection-1"))

    trade, connection_id = pipeline.trades[0]
    assert connection_id == "connection-1"
    assert trade.side is Side.SELL
    assert trade.source_time_nanos == payload["timeNanos"]
    assert trade.bridge_time == payload["bridgeTime"]
    assert trade.aggressor_order_id == "aggr-1"
    assert trade.passive_order_id == "passive-1"
    assert trade.execution_start is True
    assert trade.execution_end is False
    assert trade.otc is True


@pytest.mark.unit
def test_liquidity_frame_is_dispatched_without_raw_depth():
    pipeline = _Pipeline()
    payload = {
        "type": "liquidity",
        "symbol": "GC",
        "contract": "GC 12-26",
        "eventKind": "relative",
        "action": "removed",
        "side": "ask",
        "time": 1_753_200_000_123,
        "price": 3351.2,
        "size": 200,
        "previousSize": 600,
        "change": 400,
        "sequence": 3,
    }

    asyncio.run(_dispatch(pipeline, payload, connection_id="connection-2"))

    assert pipeline.liquidity == [(payload, "connection-2")]


@pytest.mark.unit
def test_bookmap_control_sends_complete_liquidity_configuration():
    async def scenario():
        control = BookmapControl()
        socket = _ControlSocket()
        await control.bind(socket, "connection-3")
        sent = await control.send_liquidity_settings(
            {
                "relativeEnabled": True,
                "relativeTrigger": 350,
                "relativeDomFrom": 10,
                "relativeDomTo": 70,
                "absoluteEnabled": False,
                "absoluteTrigger": 600,
                "absoluteDomFrom": 1,
                "absoluteDomTo": 12,
                "longTermEnabled": True,
                "longTermTrigger": 700,
                "longTermDomFrom": 2,
                "longTermDomTo": 90,
                "longTermMinAgeSeconds": 45,
            }
        )
        return sent, socket.frames

    sent, frames = asyncio.run(scenario())
    assert sent is True
    assert frames[0]["type"] == "liquidity_config"
    assert frames[0]["relativeTrigger"] == 350
    assert frames[0]["absoluteEnabled"] is False
    assert frames[0]["longTermMinAgeMs"] == 45_000
