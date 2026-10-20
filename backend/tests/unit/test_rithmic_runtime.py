from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from app.models import NormalizedTrade, Side
from app.rithmic.book import RithmicBookState
from app.rithmic.service import RithmicMarketDataService, RithmicServiceConfig


class _Sink:
    def __init__(self) -> None:
        self.connected: list[dict] = []
        self.disconnected: list[str | None] = []
        self.health: list[dict] = []
        self.trades: list[NormalizedTrade] = []
        self.quotes = []
        self.depth: list[tuple[dict, bool]] = []

    async def on_rithmic_connect(self, details: dict) -> None:
        self.connected.append(details)

    async def on_rithmic_disconnect(self, reason: str | None = None) -> None:
        self.disconnected.append(reason)

    async def on_rithmic_health(self, details: dict) -> None:
        self.health.append(details)

    async def on_rithmic_trade(self, trade: NormalizedTrade) -> None:
        self.trades.append(trade)

    async def on_rithmic_quote(self, quote) -> None:
        self.quotes.append(quote)

    async def on_rithmic_depth(
        self, details: dict, *, sequence_gap: bool = False
    ) -> None:
        self.depth.append((details, sequence_gap))


def _service() -> tuple[RithmicMarketDataService, _Sink]:
    sink = _Sink()
    service = RithmicMarketDataService(
        RithmicServiceConfig(
            uri="wss://example.invalid:443",
            archive_path=Path("RProtocolAPI.zip"),
            user="user",
            password="password",
            system_name="Rithmic Paper Trading",
            app_name="Bookmap",
            app_version="7.4.0.21",
            exchange="COMEX",
            wire_symbol="GCZ6",
            contract="GC 12-26",
        ),
        sink,
    )
    return service, sink


@pytest.mark.unit
def test_l2_chunk_assembly_and_mbo_gap_detection() -> None:
    book = RithmicBookState()
    book.apply_l2(
        {
            "updateType": "begin",
            "bids": [{"price": 2700.0, "size": 5}],
            "asks": [],
        }
    )
    assert book.bids == {}
    book.apply_l2(
        {
            "updateType": "end",
            "bids": [{"price": 2699.9, "size": 4}],
            "asks": [{"price": 2700.1, "size": 6}],
        }
    )
    assert sorted(book.bids) == [2699.9, 2700.0]
    assert sorted(book.asks) == [2700.1]
    book.apply_l2(
        {
            "updateType": "solo",
            "bids": [
                {"price": 2700.0, "size": 0, "orders": 0},
                {"price": 2699.8, "size": 2, "orders": 1},
            ],
            "asks": [],
        }
    )
    assert sorted(book.bids) == [2699.8, 2699.9]
    assert sorted(book.asks) == [2700.1]

    assert not book.apply_mbo_update(
        {
            "sequence": 10,
            "updates": [
                {
                    "action": "new",
                    "side": "buy",
                    "price": 2700.0,
                    "size": 3,
                    "exchangeOrderId": "order-1",
                }
            ],
        }
    )
    assert book.apply_mbo_update({"sequence": 12, "updates": []})
    assert book.metrics()["mboOrders"] == 1
    assert book.metrics()["mboSequenceGaps"] == 1

    synchronized = RithmicBookState()
    synchronized.begin_mbo_snapshot()
    assert not synchronized.apply_mbo_update(
        {
            "sequence": 11,
            "updates": [
                {
                    "action": "new",
                    "side": "sell",
                    "price": 2700.1,
                    "size": 2,
                    "exchangeOrderId": "live-11",
                }
            ],
        }
    )
    synchronized.apply_mbo_snapshot(
        {
            "sequence": 10,
            "side": "buy",
            "price": 2700.0,
            "orders": [{"exchangeOrderId": "snapshot-10", "size": 4}],
        }
    )
    assert not synchronized.finish_mbo_snapshot()
    assert sorted(synchronized.orders) == ["live-11", "snapshot-10"]
    assert synchronized.metrics()["mboSynchronized"] is True


@pytest.mark.unit
def test_service_normalizes_l1_and_exposes_l2_mbo_health() -> None:
    service, sink = _service()

    async def scenario() -> None:
        await service._dispatch(
            {"type": "market_data_subscription", "ok": True, "templateId": 101}
        )
        await service._dispatch(
            {
                "type": "bbo",
                "templateId": 151,
                "bidPrice": 2700.0,
                "askPrice": 2700.1,
                "bidSize": 11,
                "askSize": 9,
                "presenceBits": 3,
                "timeMs": 1_800_000_000_000,
            }
        )
        await service._dispatch(
            {
                "type": "bbo",
                "templateId": 151,
                "bidPrice": 2700.0,
                "bidSize": 15,
                "presenceBits": 1,
                "timeMs": 1_800_000_000_000,
            }
        )
        await service._dispatch(
            {
                "type": "trade",
                "templateId": 150,
                "price": 2700.1,
                "size": 7,
                "aggressor": "buy",
                "aggressorExchangeOrderId": "aggressor-1",
                "exchangeOrderId": "passive-1",
                "snapshot": False,
                "timeMs": 1_800_000_000_001,
            }
        )
        await service._dispatch(
            {
                "type": "order_book",
                "templateId": 156,
                "updateType": "solo",
                "bids": [{"price": 2700.0, "size": 11}],
                "asks": [{"price": 2700.1, "size": 9}],
            }
        )
        await service._dispatch(
            {
                "type": "mbo_update",
                "templateId": 160,
                "sequence": 20,
                "updates": [
                    {
                        "action": "new",
                        "side": "sell",
                        "price": 2700.1,
                        "size": 2,
                        "exchangeOrderId": "ask-1",
                    }
                ],
            }
        )

    asyncio.run(scenario())

    assert sink.quotes[0].source == "rithmic"
    assert sink.quotes[-1].bid_size == 15
    assert sink.quotes[-1].ask_size == 9
    assert sink.trades[0].side is Side.BUY
    assert sink.trades[0].bid == pytest.approx(2700.0)
    assert sink.trades[0].ask == pytest.approx(2700.1)
    assert sink.trades[0].aggressor_order_id == "aggressor-1"
    assert sink.depth[-1][0]["mboOrders"] == 1
    assert sink.depth[-1][0]["l2BidLevels"] == 1
    assert sink.health[-1]["subscriptions"]["l1"] is True


@pytest.mark.unit
def test_snapshot_last_trade_is_not_forwarded() -> None:
    service, sink = _service()
    asyncio.run(
        service._dispatch(
            {
                "type": "trade",
                "templateId": 150,
                "price": 2700.0,
                "size": 1,
                "snapshot": True,
                "timeMs": 1_800_000_000_000,
            }
        )
    )
    assert sink.trades == []
