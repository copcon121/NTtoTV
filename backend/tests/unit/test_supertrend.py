from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.engines.supertrend import (
    SupertrendBar,
    SupertrendConfig,
    SupertrendState,
)


def _bar(time: int, open_: float, high: float, low: float, close: float):
    return SupertrendBar(
        time=time,
        open=open_,
        high=high,
        low=low,
        close=close,
    )


def _fixture_bar(raw: dict) -> SupertrendBar:
    return _bar(
        raw["time"],
        raw["open"],
        raw["high"],
        raw["low"],
        raw["close"],
    )


def _assert_optional_number(actual, expected, tolerance: float) -> None:
    if expected is None:
        assert actual is None
    else:
        assert actual == pytest.approx(expected, rel=0, abs=tolerance)


@pytest.mark.unit
def test_shared_pine_v4_golden_vectors_match_both_atr_modes_and_preview():
    fixture_path = (
        Path(__file__).resolve().parents[3]
        / "test-fixtures"
        / "supertrend"
        / "pine_v4_supertrend_golden.json"
    )
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    settings = fixture["settings"]
    tolerance = settings["numericToleranceForBinaryFloatConsumers"]

    for fixture_mode, atr_method in (("wilderRma", "rma"), ("simpleSma", "sma")):
        state = SupertrendState(
            SupertrendConfig(
                period=settings["period"],
                multiplier=settings["multiplier"],
                source=settings["source"],
                atr_method=atr_method,
            )
        )
        for raw_bar, expected in zip(
            fixture["bars"], fixture["expected"][fixture_mode], strict=True
        ):
            point = state.on_closed_bar(_fixture_bar(raw_bar))
            assert point is not None
            assert point.time == expected["time"]
            _assert_optional_number(point.atr, expected["atr"], tolerance)
            _assert_optional_number(
                point.lower_band, expected["finalLower"], tolerance
            )
            _assert_optional_number(
                point.upper_band, expected["finalUpper"], tolerance
            )
            assert point.trend == expected["trend"]
            assert point.buy_signal is expected["buySignal"]
            assert point.sell_signal is expected["sellSignal"]
            assert (point.direction != 0) is expected["changeSignal"]

    probe = fixture["realtimeRollbackProbe"]
    state = SupertrendState(
        SupertrendConfig(
            period=settings["period"],
            multiplier=settings["multiplier"],
            source=settings["source"],
            atr_method="rma",
        )
    )
    for raw_bar in fixture["bars"]:
        if raw_bar["time"] > probe["baseThroughTime"]:
            break
        state.on_closed_bar(_fixture_bar(raw_bar))
    for snapshot in probe["snapshots"]:
        expected = snapshot["expected"]
        point = state.preview(_fixture_bar(snapshot["bar"]))
        assert point is not None
        _assert_optional_number(point.atr, expected["atr"], tolerance)
        _assert_optional_number(point.lower_band, expected["finalLower"], tolerance)
        _assert_optional_number(point.upper_band, expected["finalUpper"], tolerance)
        assert point.trend == expected["trend"]
        assert point.buy_signal is expected["buySignal"]
        assert point.sell_signal is expected["sellSignal"]
    assert state.last_time == probe["baseThroughTime"]


@pytest.mark.unit
def test_rma_and_sma_match_pine_warmup_semantics():
    bars = [
        _bar(0, 10.0, 11.0, 9.0, 10.0),
        _bar(1, 10.0, 12.0, 10.0, 11.0),
        _bar(2, 11.0, 13.0, 11.0, 12.0),
        _bar(3, 12.0, 14.0, 12.0, 13.0),
    ]
    rma = SupertrendState(SupertrendConfig(period=3))
    sma = SupertrendState(SupertrendConfig(period=3, atr_method="sma"))

    rma_points = [rma.on_closed_bar(bar) for bar in bars]
    sma_points = [sma.on_closed_bar(bar) for bar in bars]

    assert [point.atr for point in rma_points] == [None, None, 2.0, 2.0]
    # Pine's atr() uses tr(true), while the script's alternate sma(tr, n)
    # receives na on the first bar and therefore becomes valid one bar later.
    assert [point.atr for point in sma_points] == [None, None, None, 2.0]
    assert rma_points[2].lower_band == pytest.approx(6.0)
    assert rma_points[3].lower_band == pytest.approx(7.0)


@pytest.mark.unit
def test_direction_change_uses_strict_pine_comparisons():
    state = SupertrendState(SupertrendConfig(period=1, multiplier=1.0))

    first = state.on_closed_bar(_bar(0, 10.0, 11.0, 9.0, 10.0))
    equal = state.on_closed_bar(_bar(1, 10.0, 10.0, 8.0, 8.0))
    below = state.on_closed_bar(_bar(2, 8.0, 9.0, 7.0, 7.9))

    assert first.direction == 0
    assert equal.lower_band == pytest.approx(8.0)
    assert equal.trend == 1
    assert equal.direction == 0
    assert below.trend == -1
    assert below.direction == -1


@pytest.mark.unit
def test_preview_is_idempotent_and_does_not_advance_confirmed_state():
    state = SupertrendState(SupertrendConfig(period=1, multiplier=1.0))
    first = state.on_closed_bar(_bar(100, 10.0, 11.0, 9.0, 10.0))
    forming = _bar(200, 8.0, 9.0, 7.0, 7.9)

    preview_one = state.preview(forming)
    preview_two = state.preview(forming)

    assert preview_one == preview_two
    assert preview_one.confirmed is False
    assert preview_one.direction == -1
    assert state.last_time == 100
    assert state.last_point == first

    committed = state.on_closed_bar(forming)
    assert committed.confirmed is True
    assert committed.direction == preview_one.direction
    assert committed.atr == preview_one.atr
    assert state.on_closed_bar(forming) == committed
