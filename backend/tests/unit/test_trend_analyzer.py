from __future__ import annotations

import pytest

from app.engines.trend_analyzer import (
    DEFAULT_CONFIGS,
    TrendAnalyzerConfig,
    TrendAnalyzerEngine,
)
from app.models import NormalizedTrade


def _trade(time: int, price: float, sequence: int) -> NormalizedTrade:
    return NormalizedTrade(
        symbol="GC",
        contract="GC 12-26",
        time=time,
        price=price,
        volume=1,
        bid=None,
        ask=None,
        best_bid=None,
        best_ask=None,
        sequence=sequence,
        source="bookmap",
    )


def _initialized_engine(*, multiplier: float = 0.0) -> TrendAnalyzerEngine:
    engine = TrendAnalyzerEngine(
        [
            TrendAnalyzerConfig(
                instance=1,
                candle_buckets=1,
                smoothing_candles=1,
                multiplier=multiplier,
                switch_ticks=3,
            )
        ]
    )
    rows = []
    for second in range(10):
        rows.append((second * 1_000, 100.0, 100.0, 100.0, 100.0))
    for second in range(10, 20):
        if second == 19:
            rows.append((second * 1_000, 100.0, 110.0, 100.0, 110.0))
        else:
            rows.append((second * 1_000, 110.0, 110.0, 110.0, 110.0))
    engine.seed_seconds(rows, through_time=20_000, source_contract="GC 12-26")
    return engine


@pytest.mark.unit
def test_reference_defaults_match_loaded_addon() -> None:
    assert [(item.instance, item.candle_buckets) for item in DEFAULT_CONFIGS] == [
        (1, 30),
        (2, 30),
    ]
    assert all(item.smoothing_candles == 15 for item in DEFAULT_CONFIGS)
    assert all(item.multiplier == 3.0 for item in DEFAULT_CONFIGS)
    assert all(item.switch_ticks == 3 for item in DEFAULT_CONFIGS)


@pytest.mark.unit
def test_reversal_is_checked_before_same_second_trailing_update() -> None:
    engine = _initialized_engine()
    initial = engine.history(0, 20_000)
    assert any(
        point["side"] == "buy" and point["price"] == 110.0
        for point in initial["points"]
    )

    # Old buy line is 110.  Low 109.8 does not cross 110-3 ticks, so the high can trail
    # the line to 120.  A trail-first implementation would incorrectly reverse.
    engine.on_trade(_trade(20_100, 120.0, 1))
    engine.on_trade(_trade(20_200, 109.8, 2))
    engine.on_trade(_trade(20_300, 120.0, 3))
    batches = engine.advance(21_000)

    points = [point for batch in batches for point in batch.points]
    markers = [marker for batch in batches for marker in batch.markers]
    assert any(point.side == "buy" and point.price == 120.0 for point in points)
    assert not any(
        marker.kind == "trend_change" and marker.side == "sell"
        for marker in markers
    )


@pytest.mark.unit
def test_reversal_breaks_old_line_and_starts_opposite_line() -> None:
    engine = _initialized_engine()
    engine.on_trade(_trade(20_100, 106.0, 1))
    batches = engine.advance(21_000)
    points = [point for batch in batches for point in batch.points]
    markers = [marker for batch in batches for marker in batch.markers]

    assert any(
        point.side == "buy" and point.time == 20_900 and point.price == 110.0
        for point in points
    )
    assert any(
        point.side == "buy" and point.time == 21_000 and point.price is None
        for point in points
    )
    assert any(
        point.side == "sell" and point.time == 21_000 and point.price == 106.0
        for point in points
    )
    assert any(
        marker.kind == "trend_change"
        and marker.side == "sell"
        and marker.line_price == 106.0
        and marker.market_price == 106.0
        for marker in markers
    )


@pytest.mark.unit
def test_offset_uses_java_half_up_rounding() -> None:
    engine = _initialized_engine(multiplier=0.005)
    history = engine.history(0, 20_000)
    # 100-tick range * 0.005 = 0.5 tick, Java Math.round -> 1 tick.
    assert any(
        point["side"] == "buy" and point["price"] == 109.9
        for point in history["points"]
    )


@pytest.mark.unit
def test_history_includes_pre_range_line_context() -> None:
    engine = _initialized_engine()
    history = engine.history(20_500, 21_000)
    assert any(point["time"] <= 20_500 for point in history["points"])
