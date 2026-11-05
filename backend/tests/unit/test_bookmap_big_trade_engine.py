from __future__ import annotations

from dataclasses import replace

import pytest

from app.engines.bookmap_big_trade_engine import BookmapBigTradeEngine
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
    engine = BookmapBigTradeEngine(min_volume=30, idle_ms=100)
    assert engine.on_trade(
        _trade(sequence=1, time=1_000, received_at=2_000, volume=20, order_id="A")
    ) == []
    assert engine.on_trade(
        _trade(sequence=2, time=1_001, received_at=2_050, volume=15, order_id="A")
    ) == []
    assert engine.flush_idle(1_100) == []

    emitted = engine.flush_idle(1_101)
    assert len(emitted) == 1
    assert emitted[0].volume == 35
    assert emitted[0].source == "bookmap"


@pytest.mark.unit
def test_execution_end_flushes_immediately():
    engine = BookmapBigTradeEngine(min_volume=30)
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
    engine = BookmapBigTradeEngine(min_volume=30, idle_ms=10_000)
    assert engine.on_trade(
        _trade(sequence=1, time=1_000, received_at=2_000, volume=30, order_id=None)
    ) == []

    emitted = engine.on_trade(
        _trade(sequence=2, time=1_001, received_at=2_001, volume=1, order_id=None)
    )
    assert len(emitted) == 1
    assert emitted[0].time == 1_000
    assert emitted[0].volume == 30


# The two GC buy orders missing on Windows on 2026-11-03 (UTC+7).
# All 30 fills of each order share one exchange timestamp. The first receive
# gap split them into 1 + 29 under the old 100 ms wall-clock timeout.
@pytest.mark.unit
@pytest.mark.parametrize("periodic_flush", [False, True])
@pytest.mark.parametrize(
    "time,order_id,price,receive_gap,receive_span",
    [
        (1793667352332, "7816444224844", 3972.0, 132, 328),
        (1793667451349, "7816444249534", 3969.1, 109, 367),
    ],
)
def test_rithmic_delayed_fills_survive_periodic_flush(
    time, order_id, price, receive_gap, receive_span, periodic_flush,
):
    engine = BookmapBigTradeEngine()
    emitted = []
    for index in range(30):
        delay = 0 if index == 0 else (
            receive_gap + (receive_span - receive_gap) * (index - 1) // 28
        )
        trade = replace(
            _trade(
                sequence=index + 1, time=time, received_at=time + 110 + delay,
                volume=1, order_id=order_id,
            ),
            source="rithmic", price=price,
        )
        emitted.extend(engine.on_trade(trade))
        # A scheduled flush can run while later fills are queued for delivery.
        if periodic_flush:
            emitted.extend(engine.flush_idle())
    emitted.extend(engine.flush_idle(time + engine.idle_ms))
    assert [(bt.time, bt.price, bt.volume, bt.source) for bt in emitted] == [
        (time, price, 30, "rithmic"),
    ]


@pytest.mark.unit
@pytest.mark.parametrize("source", ["bookmap", "rithmic"])
def test_delayed_raw_rebuild_matches_live_with_periodic_flush(tmp_path, source):
    store = TickStore(tmp_path / "ticks")
    engine = BookmapBigTradeEngine()
    live = []
    try:
        for sequence, volume, delay in [(1, 1, 0), (2, 29, 10_000)]:
            trade = replace(
                _trade(
                    sequence=sequence, time=1_000, received_at=2_000 + delay,
                    volume=volume, order_id="A",
                ),
                source=source, contract="GC 12-26",
            )
            store.record_trade(trade)
            live.extend(engine.on_trade(trade))
            live.extend(engine.flush_idle())
        live.extend(engine.flush_all())
        rows, had_raw = _rebuild_big_trades(
            store, "GC", "GC", 0, 1_000,
            raw_contract="GC 12-26", source=source,
        )
        assert had_raw
        assert [(r.time, r.volume, r.source) for r in rows] == [
            (r.time, r.volume, r.source) for r in live
        ] == [(1_000, 30, source)]
    finally:
        store.close()


@pytest.mark.unit
def test_exchange_idle_and_execution_start_keep_distinct_executions_separate():
    engine = BookmapBigTradeEngine()
    first = _trade(
        sequence=1, time=1_000, received_at=10_000, volume=30, order_id="A",
    )
    assert engine.on_trade(first) == []
    # Receipt times are close, but a 100 ms exchange gap ends the first group.
    emitted = engine.on_trade(replace(
        first, sequence=2, time=1_100, received_at=10_001, volume=1,
    ))
    assert [bt.volume for bt in emitted] == [30]
    # An explicit execution boundary must not add that pending 1 to this 29.
    assert engine.on_trade(replace(
        first, sequence=3, time=1_101, received_at=10_002, volume=29,
        execution_start=True, execution_end=True,
    )) == []
    assert engine.flush_all() == []


@pytest.mark.unit
def test_reset_pending_resets_exchange_watermark():
    engine = BookmapBigTradeEngine()
    first = _trade(
        sequence=1, time=10_000, received_at=20_000, volume=30, order_id="A",
    )
    engine.on_trade(first)
    engine.reset_pending()
    assert engine.on_trade(replace(first, time=1_000, volume=1)) == []
    assert engine.on_trade(replace(
        first, sequence=2, time=1_001, received_at=30_000, volume=29,
    )) == []
    assert [bt.volume for bt in engine.flush_all()] == [30]


@pytest.mark.unit
def test_pipeline_timer_cannot_split_delayed_execution(tmp_path, monkeypatch):
    import asyncio
    from unittest.mock import AsyncMock

    from app.config import Settings
    from app.engines.contract_resolver import ContractResolver
    from app.pipeline import Pipeline
    from app.registry import WebSocketRegistry
    from app.storage import CacheStore

    cache = CacheStore(tmp_path / "app.sqlite")
    ticks = TickStore(tmp_path / "ticks")
    try:
        pipeline = Pipeline(
            registry=WebSocketRegistry(), cache=cache, tick_store=ticks,
            resolver=ContractResolver(["GC 12-26"]),
            settings=Settings(data_dir=tmp_path), symbol="GC",
        )
        pipeline._active_feed = "bookmap"
        monkeypatch.setattr(pipeline, "_evaluate_source_selection", AsyncMock())
        first = _trade(
            sequence=1, time=1793667352332, received_at=1793667352442,
            volume=1, order_id="7816444224844",
        )

        async def run():
            await pipeline._run_trade_engines(first, source="bookmap")
            await pipeline.maintenance_tick()
            await pipeline._run_trade_engines(replace(
                first, sequence=2, volume=29, received_at=first.received_at + 132,
            ), source="bookmap")
            await pipeline.maintenance_tick()
            await pipeline._run_trade_engines(replace(
                first, sequence=3, time=first.time + 101, volume=1,
                aggressor_order_id="next-order",
            ), source="bookmap")

        asyncio.run(run())
        assert [(r.time, r.volume) for r in cache.read_big_trades("GC", "GC")] == [
            (first.time, 30),
        ]
    finally:
        ticks.close()
        cache.close()


@pytest.mark.unit
def test_raw_rebuild_uses_only_bookmap_and_keeps_logical_contract(tmp_path):
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
                    source="bookmap",
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
            source="bookmap",
        )
        assert had_raw is True
        assert [(row.contract, row.volume, row.source) for row in rows] == [
            ("GC", 35, "bookmap")
        ]
    finally:
        store.close()
