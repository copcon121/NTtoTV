"""Unit tests for live VolumeDelta engine cache seeding."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.engines.volume_delta_engine import VolumeDeltaEngine
from app.models.canonical import NormalizedTrade, Side
from app.models.timestamp import to_canonical_ms

SYMBOL = "GC"
CONTRACT = "GC"


def _ms(*args: int) -> int:
    return to_canonical_ms(datetime(*args, tzinfo=timezone.utc))


def _trade(
    time_ms: int,
    price: float,
    volume: int,
    sequence: int = 0,
    *,
    bid: float | None = None,
    ask: float | None = None,
    side: Side | None = None,
) -> NormalizedTrade:
    return NormalizedTrade(
        symbol=SYMBOL,
        contract=CONTRACT,
        time=time_ms,
        price=price,
        volume=volume,
        bid=bid,
        ask=ask,
        best_bid=None,
        best_ask=None,
        sequence=sequence,
        side=side,
    )


@pytest.mark.unit
def test_seed_bar_continues_current_delta_bucket_after_restart():
    engine = VolumeDeltaEngine()
    base = _ms(2025, 1, 2, 3, 4, 0)
    engine.seed_bar(
        CONTRACT,
        time=base,
        volume=10,
        buy_volume=7,
        sell_volume=3,
        delta_high=5,
        delta_low=-1,
        open_delta=2,
        close_delta=4,
        last_price=100.0,
    )

    update = engine.on_trade(_trade(base + 30_000, 101.0, 2, ask=101.0))

    assert update is not None
    assert update.time == base
    assert update.volume == 12
    assert update.buy_volume == 9
    assert update.sell_volume == 3
    assert update.delta == 6
    assert update.delta_high == 6
    assert update.delta_low == -1
    assert update.open_delta == 2
    assert update.close_delta == 6


@pytest.mark.unit
def test_explicit_aggressor_side_overrides_quote_and_tick_inference():
    engine = VolumeDeltaEngine(zero_baseline=True)
    base = _ms(2025, 1, 2, 3, 4, 0)

    first = engine.on_trade(
        _trade(base + 1_000, 100.0, 7, side=Side.SELL, ask=100.0)
    )
    update = engine.on_trade(
        _trade(base + 2_000, 99.9, 11, side=Side.BUY, bid=99.9)
    )

    assert first is not None
    assert first.open_delta == 0
    assert first.delta_high == 0
    assert first.delta_low == -7
    assert update is not None
    assert update.buy_volume == 11
    assert update.sell_volume == 7
    assert update.delta == 4
    assert update.delta_high == 4
    assert update.delta_low == -7
