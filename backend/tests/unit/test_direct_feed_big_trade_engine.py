from __future__ import annotations

import pytest

from app.engines.direct_feed_big_trade_engine import DirectFeedBigTradeEngine
from app.models import NormalizedTrade, Side
from app.rest.orderflow import _rebuild_big_trades
from app.storage import TickStore


def _trade(
    *,
    sequence: int,
    time: int,
    received_at: int,
    volume: int,
    order_id: str | None,
    execution_end: bool = False,
) -> NormalizedTrade:
    return NormalizedTrade(
        symbol="GC",
        contract="GC",
        time=time,
        price=2400.0 + sequence / 10,
        volume=volume,
        bid=None,
        ask=None,
        best_bid=None,
        best_ask=None,
        sequence=sequence,
        source="bookmap",
        source_time_nanos=time * 1_000_000,
        received_at=received_at,
        side=Side.BUY,
        aggressor_order_id=order_id,
        execution_end=execution_end,
    )


@pytest.mark.unit
def test_groups_by_aggressor_order_and_flushes_after_idle():
    engine = DirectFeedBigTradeEngine(min_volume=30, idle_ms=100)
    assert engine.on_trade(
        _trade(sequence=1, time=1_000, received_at=2_000, volume=20, order_id="A")
    ) == []
    assert engine.on_trade(
        _trade(sequence=2, time=1_001, received_at=2_050, volume=15, order_id="A")
    ) == []
    assert engine.flush_idle(2_149) == []

    emitted = engine.flush_idle(2_150)
    assert len(emitted) == 1
    assert emitted[0].volume == 35
    assert emitted[0].source == "bookmap"


@pytest.mark.unit
def test_execution_end_flushes_immediately():
    engine = DirectFeedBigTradeEngine(min_volume=30)
    emitted = engine.on_trade(
        _trade(
            sequence=1,
            time=1_000,
            received_at=2_000,
            volume=30,
            order_id="A",
            execution_end=True,
        )
    )
    assert [trade.volume for trade in emitted] == [30]


@pytest.mark.unit
def test_missing_order_id_flushes_when_exact_timestamp_advances():
    engine = DirectFeedBigTradeEngine(min_volume=30, idle_ms=10_000)
    assert engine.on_trade(
        _trade(sequence=1, time=1_000, received_at=2_000, volume=30, order_id=None)
    ) == []

    emitted = engine.on_trade(
        _trade(sequence=2, time=1_001, received_at=2_001, volume=1, order_id=None)
    )
    assert len(emitted) == 1
    assert emitted[0].time == 1_000
    assert emitted[0].volume == 30


@pytest.mark.unit
def test_raw_rebuild_uses_only_rithmic_and_keeps_logical_contract(tmp_path):
    store = TickStore(tmp_path / "ticks")
    source_contract = "GC 08-26"
    try:
        store.record_trade(
            NormalizedTrade(
                symbol="GC",
                contract=source_contract,
                time=1_000,
                price=2400.0,
                volume=100,
                bid=2399.9,
                ask=2400.0,
                best_bid=2399.9,
                best_ask=2400.0,
                sequence=1,
                source="nt",
            )
        )
        for sequence, volume in ((1, 20), (2, 15)):
            store.record_trade(
                NormalizedTrade(
                    symbol="GC",
                    contract=source_contract,
                    time=1_000 + sequence,
                    price=2400.0,
                    volume=volume,
                    bid=None,
                    ask=None,
                    best_bid=None,
                    best_ask=None,
                    sequence=sequence,
                    source="rithmic",
                    source_time_nanos=(1_000 + sequence) * 1_000_000,
                    received_at=2_000 + sequence,
                    side=Side.BUY,
                    aggressor_order_id="A",
                )
            )

        rows, had_raw = _rebuild_big_trades(
            store,
            "GC",
            "GC",
            0,
            5_000,
            raw_contract=source_contract,
            source="rithmic",
        )
        assert had_raw is True
        assert [(row.contract, row.volume, row.source) for row in rows] == [
            ("GC", 35, "rithmic")
        ]
    finally:
        store.close()
