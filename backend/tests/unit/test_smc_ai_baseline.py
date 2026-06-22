from pathlib import Path

import pytest

from app.smc_ai.baseline import (
    BaselineBar,
    BaselineConfig,
    HuntEvent,
    Zone,
    confirmation_pattern,
    detect_equal_low,
    detect_sweep_hunt,
    engulfing_signal,
    is_first_fvg_for_leg,
    is_outside_bar,
    label_trade,
    load_bars_from_cache,
)


def _bar(
    index: int,
    open_: float,
    high: float,
    low: float,
    close: float,
    volume: int = 1,
) -> BaselineBar:
    return BaselineBar(
        time=index * 60_000,
        open=open_,
        high=high,
        low=low,
        close=close,
        volume=volume,
    )


def _zone(side: int = 1) -> Zone:
    return Zone(
        id=1,
        kind="ob",
        side=side,
        top=100.0,
        bottom=99.0,
        origin_index=0,
        origin_time=0,
        created_index=0,
        created_time=0,
        leg_id=1,
    )


def test_detect_equal_low_and_eql_sweep_hunt():
    bars = [
        _bar(0, 10, 11, 9.4, 10),
        _bar(1, 9, 10, 8.0, 9.5),
        _bar(2, 9.5, 10, 9.0, 9.6),
        _bar(3, 9.3, 10, 8.1, 9.4),
        _bar(4, 9.4, 10, 9.1, 9.5),
        _bar(5, 9.2, 9.6, 7.7, 8.3),
    ]

    level = detect_equal_low(bars, 4, lookback=5, tolerance=0.2, pivot_length=1)
    assert level is not None
    assert level.kind == "eql"
    assert level.level == pytest.approx(8.05)

    config = BaselineConfig(equal_level_pivot_length=1, equal_level_tolerance_ticks=2)
    hunt = detect_sweep_hunt(bars, 5, config)
    assert hunt is not None
    assert hunt.kind == "eql_sweep"
    assert hunt.side == 1


def test_first_fvg_of_leg_helper_marks_only_the_first_same_side_fvg():
    assert is_first_fvg_for_leg([], leg_id=7, side=1) is True

    existing = [
        Zone(
            id=10,
            kind="fvg",
            side=1,
            top=103,
            bottom=101,
            origin_index=3,
            origin_time=180_000,
            created_index=4,
            created_time=240_000,
            leg_id=7,
            first_fvg_of_leg=True,
        )
    ]

    assert is_first_fvg_for_leg(existing, leg_id=7, side=1) is False
    assert is_first_fvg_for_leg(existing, leg_id=7, side=-1) is True
    assert is_first_fvg_for_leg(existing, leg_id=8, side=1) is True


def test_outside_bar_and_engulfing_confirmations_are_directional():
    previous = _bar(0, 10.5, 11, 9, 9.5)
    outside = _bar(1, 9.4, 11.5, 8.8, 11.2)
    engulf = _bar(2, 9.3, 11.3, 9.0, 10.8)

    assert is_outside_bar(outside, previous) is True
    assert confirmation_pattern([previous, outside], 1, 1) == "outside_bar"
    assert engulfing_signal(engulf, previous, 1) is True
    assert engulfing_signal(engulf, previous, -1) is False


def test_morning_and_evening_doji_star_confirmations():
    bullish = [
        _bar(0, 10.0, 10.4, 8.7, 9.0),
        _bar(1, 8.9, 9.1, 8.7, 8.92),
        _bar(2, 9.0, 10.2, 8.9, 9.8),
    ]
    bearish = [
        _bar(0, 9.0, 10.3, 8.8, 10.0),
        _bar(1, 10.1, 10.3, 9.9, 10.08),
        _bar(2, 10.0, 10.1, 8.9, 9.2),
    ]

    assert confirmation_pattern(bullish, 2, 1) == "morning_doji_star"
    assert confirmation_pattern(bearish, 2, -1) == "evening_doji_star"


def test_label_trade_uses_stop_first_when_target_and_stop_hit_same_bar():
    bars = [
        _bar(0, 100, 100.5, 99.8, 100.0),
        _bar(1, 100.0, 102.5, 98.8, 101.0),
    ]
    config = BaselineConfig(tick_size=0.1, fee_ticks_round_trip=2, rr=2)
    result = label_trade(
        bars,
        entry_index=0,
        side=1,
        entry_price=100.0,
        stop_price=99.0,
        target_price=102.0,
        zone=_zone(1),
        hunt=HuntEvent("sweep_low", 1, 99.0, 0, 0),
        confirmation="outside_bar",
        config=config,
    )

    assert result.outcome == "loss"
    assert result.exit_price == 99.0
    assert result.gross_r == -1.0
    assert result.net_r == pytest.approx(-1.2)


@pytest.mark.smoke
def test_load_bars_from_current_cache_read_only_if_available():
    db_path = Path(__file__).resolve().parents[2] / "data" / "app.sqlite"
    if not db_path.exists():
        pytest.skip("runtime app.sqlite is not present")

    bars = load_bars_from_cache(db_path, limit=5)

    assert len(bars) == 5
    assert bars == sorted(bars, key=lambda bar: bar.time)
    assert all(bar.volume >= 0 for bar in bars)
