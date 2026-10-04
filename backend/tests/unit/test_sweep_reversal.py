from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.engines.alert_engine import Alert, AlertEngine, MarketContext, SWEEP_REVERSAL
from app.engines.sweep_reversal import SweepReversalBar, SweepReversalState


FIXTURE = Path(__file__).parents[3] / "test-fixtures" / "sweep_reversal_golden.json"


def _fixture() -> dict:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def _state(settings: dict) -> SweepReversalState:
    return SweepReversalState(
        swing_length=settings["swingLength"],
        atr_length=settings["atrLength"],
        min_penetration_atr=settings["minPenetrationAtr"],
        structure_length=settings["structureLength"],
        max_confirmation_bars=settings["maxConfirmationBars"],
        min_displacement_atr=settings["minDisplacementAtr"],
        equal_swing_filter=settings["equalSwingFilter"],
        liquidity_min_pivots=settings["liquidityMinPivots"],
        liquidity_lookback_bars=settings["liquidityLookbackBars"],
        liquidity_atr_length=settings["liquidityAtrLength"],
        liquidity_atr_margin=settings["liquidityAtrMargin"],
    )


@pytest.mark.unit
def test_golden_close_sweep_reclaim_and_confirmation() -> None:
    fixture = _fixture()
    state = _state(fixture["settings"])
    triggers = []
    by_time = {}
    for raw in fixture["bars"]:
        emitted = state.on_closed_bar(SweepReversalBar(**raw))
        by_time[raw["time"]] = emitted
        triggers.extend(emitted)

    expected = fixture["expected"]
    assert by_time[expected["wickOnlyBarTime"]] == []
    assert by_time[expected["developingTime"]] == []
    assert len(triggers) == 1
    trigger = triggers[0]
    assert trigger.signal_time == expected["confirmationTime"]
    assert trigger.direction == expected["direction"]
    assert trigger.sweep_level == expected["level"]
    assert trigger.confirmation_level == expected["confirmationLevel"]
    assert list(trigger.pivot_times) == expected["pivotTimes"]


@pytest.mark.unit
def test_alert_is_scoped_to_its_snapshot_timeframe_and_repeats() -> None:
    fixture = _fixture()
    settings = {**fixture["settings"], "timeframe": "3m", "repeat": True}
    engine = AlertEngine()
    engine.upsert(
        Alert(
            id="sweep",
            symbol="GC",
            type=SWEEP_REVERSAL,
            params=settings,
            profile_id="p1",
        )
    )
    events = []
    for raw in fixture["bars"]:
        context = MarketContext(
            symbol="GC",
            contract="GC",
            time=raw["time"],
            bar_closed=True,
            bar_tf="1m",
            bar_time=raw["time"],
            bar_open=raw["open"],
            bar_high=raw["high"],
            bar_low=raw["low"],
            bar_close=raw["close"],
            bar_volume=raw["volume"],
        )
        assert engine.evaluate(context) == []
        context.bar_tf = "3m"
        events.extend(engine.evaluate(context))

    assert len(events) == 1
    assert events[0].direction == -1
    assert events[0].level == 12
    assert "M3 Sweep S" in events[0].message
    assert engine.alerts()[0].enabled is True


@pytest.mark.unit
@pytest.mark.parametrize("pivot_count", [2, 3, 4, 5])
def test_equal_swing_cluster_tracks_all_pivots_and_stops_at_first_outside_band(
    pivot_count: int,
) -> None:
    state = SweepReversalState(
        swing_length=2,
        atr_length=1,
        min_displacement_atr=0,
        structure_length=2,
        equal_swing_filter=True,
        liquidity_min_pivots=2,
        liquidity_atr_length=1,
        liquidity_atr_margin=4,
    )
    # The old 14.0 pivot is outside the ATR band. Every target swing has two
    # right bars, producing complete 2/3/4+ consecutive clusters.
    target_prices = [12.0, 12.1, 11.9, 12.05, 11.95][:pivot_count]
    highs = [10, 11, 14, 10, 9, 10]
    for price in target_prices:
        highs.extend([price, 10, 9, 10])
    bars = [
        SweepReversalBar(
            time=index * 60_000,
            open=price - 0.2,
            high=price,
            low=price - 2.0,
            close=price - 0.5,
            volume=1,
        )
        for index, price in enumerate(highs)
    ]
    for bar in bars:
        state.on_closed_bar(bar)
    active_buy_pools = [
        pool for pool in state._pools if pool.side == "buy" and not pool.consumed
    ]
    assert active_buy_pools
    pool_top = max(pool.top for pool in active_buy_pools)
    emitted = state.on_closed_bar(
        SweepReversalBar(
            time=len(bars) * 60_000,
            open=pool_top,
            high=pool_top + 0.5,
            low=pool_top - 0.5,
            close=pool_top + 0.1,
            volume=1,
        )
    )
    assert emitted == []
    # White-box only for pool metadata: all participating pivots, never just 2.
    candidate = state._bearish
    assert candidate is not None
    assert len(candidate.pivot_times) == pivot_count
    assert list(candidate.pivot_prices) == target_prices
    assert 2 * 60_000 not in candidate.pivot_times
