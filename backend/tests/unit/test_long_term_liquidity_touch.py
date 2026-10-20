from __future__ import annotations

import pytest

from app.engines.long_term_liquidity_touch import LongTermLiquidityTouchEngine
from app.models import LiquidityUpdate, NormalizedTrade, Side


def line(
    *,
    time: int = 1_000,
    action: str = "start",
    side: str = "bid",
    price: float = 4191.2,
) -> LiquidityUpdate:
    price_ticks = round(price * 10)
    return LiquidityUpdate(
        symbol="GC",
        contract="GC",
        source_contract="GCZ6.COMEX@RITHMIC",
        sequence=1,
        time=time,
        event_kind="long_term",
        action=action,
        side=side,
        price=price,
        size=600 if action != "end" else 0,
        previous_size=600,
        change=600,
        threshold=500,
        dom_distance=2,
        strength=1.2,
        line_id=f"{side}:{price_ticks}:1000",
        line_start_time=1_000,
    )


def trade(
    *,
    time: int,
    volume: int,
    side: Side = Side.SELL,
    price: float = 4191.2,
    execution_start: bool = False,
    execution_end: bool = False,
) -> NormalizedTrade:
    return NormalizedTrade(
        symbol="GC",
        contract="GC 12-26",
        time=time,
        price=price,
        volume=volume,
        bid=None,
        ask=None,
        best_bid=None,
        best_ask=None,
        sequence=time,
        source="bookmap",
        received_at=time,
        side=side,
        aggressor_order_id="order-1",
        execution_start=execution_start,
        execution_end=execution_end,
    )


@pytest.mark.unit
def test_groups_sell_execution_at_bid_line_into_one_touch_bubble() -> None:
    engine = LongTermLiquidityTouchEngine()
    engine.on_liquidity(line())

    assert engine.on_trade(
        trade(time=1_100, volume=2, execution_start=True)
    ) == []
    touches = engine.on_trade(trade(time=1_101, volume=3, execution_end=True))

    assert len(touches) == 1
    touch = touches[0]
    assert touch.side == "bid"
    assert touch.price == 4191.2
    assert touch.volume == 5
    assert touch.line_size == 600
    assert touch.time == 1_101


@pytest.mark.unit
def test_requires_consuming_aggressor_side_and_exact_price_level() -> None:
    engine = LongTermLiquidityTouchEngine()
    engine.on_liquidity(line())

    assert engine.on_trade(
        trade(time=1_100, volume=5, side=Side.BUY, execution_end=True)
    ) == []
    assert engine.on_trade(
        trade(time=1_101, volume=5, price=4191.3, execution_end=True)
    ) == []


@pytest.mark.unit
def test_ignores_touches_until_line_reaches_configured_long_term_age() -> None:
    engine = LongTermLiquidityTouchEngine(min_age_ms=4 * 60 * 60 * 1_000)
    engine.on_liquidity(line())

    assert engine.on_trade(
        trade(time=1_000 + 4 * 60 * 60 * 1_000 - 1, volume=5, execution_end=True)
    ) == []
    touches = engine.on_trade(
        trade(time=1_000 + 4 * 60 * 60 * 1_000, volume=5, execution_end=True)
    )

    assert [touch.volume for touch in touches] == [5]


@pytest.mark.unit
def test_recently_ended_line_has_short_cross_channel_grace() -> None:
    engine = LongTermLiquidityTouchEngine(ended_line_grace_ms=750)
    engine.on_liquidity(line())
    engine.on_liquidity(line(time=1_200, action="end"))

    touches = engine.on_trade(
        trade(time=1_201, volume=5, execution_start=True, execution_end=True)
    )
    assert [touch.volume for touch in touches] == [5]

    assert engine.on_trade(
        trade(time=2_000, volume=5, execution_start=True, execution_end=True)
    ) == []


@pytest.mark.unit
def test_default_grace_catches_delayed_bookmap_bubble_after_line_end() -> None:
    engine = LongTermLiquidityTouchEngine()
    engine.on_liquidity(line(side="ask", price=4191.0))
    engine.on_liquidity(
        line(time=1_200, action="end", side="ask", price=4191.0)
    )

    assert engine.on_trade(
        trade(
            time=4_502,
            volume=1,
            side=Side.BUY,
            price=4191.0,
            execution_start=True,
        )
    ) == []
    assert engine.on_trade(
        trade(time=4_503, volume=2, side=Side.BUY, price=4191.0)
    ) == []
    touches = engine.flush_idle(4_603)

    assert len(touches) == 1
    assert touches[0].side == "ask"
    assert touches[0].price == 4191.0
    assert touches[0].volume == 3
