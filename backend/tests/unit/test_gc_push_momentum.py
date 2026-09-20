from __future__ import annotations

import math
from types import SimpleNamespace

import pytest

from app.engines.gc_push_momentum import GcPushMomentumState

_MINUTE = 60_000


def _bars_from_returns(
    returns: list[float],
    *,
    first_close: float = 100.0,
    first_time: int = _MINUTE,
) -> list[SimpleNamespace]:
    bars = [SimpleNamespace(time=first_time, close=first_close)]
    close = first_close
    for index, value in enumerate(returns, start=1):
        close *= math.exp(value)
        bars.append(
            SimpleNamespace(
                time=first_time + index * _MINUTE,
                close=close,
            )
        )
    return bars


def _points(bars: list[SimpleNamespace]):
    state = GcPushMomentumState()
    return [
        point
        for bar in bars
        if (point := state.on_closed_bar(bar)) is not None
    ]


@pytest.mark.unit
def test_gc_push_momentum_matches_price_scale_and_uses_prior_threshold():
    returns = [0.001] * 120 + [0.0005, 0.02]
    base = _points(_bars_from_returns(returns))
    scaled = _points(_bars_from_returns(returns, first_close=1_000.0))

    assert len(base) == len(scaled) == 3
    for left, right in zip(base, scaled, strict=True):
        assert left.push == pytest.approx(right.push)
        assert left.strong_threshold == pytest.approx(right.strong_threshold)
        assert left.strong is right.strong

    assert base[0].strong_threshold is None
    assert base[0].strong is False
    assert base[-1].strong is True
    assert base[-1].strong_threshold is not None
    assert abs(base[-1].push) > base[-1].strong_threshold


@pytest.mark.unit
def test_gc_push_momentum_refills_ten_returns_after_a_warmed_gap():
    state = GcPushMomentumState()
    initial = _bars_from_returns([0.001] * 121)
    initial_points = [state.on_closed_bar(bar) for bar in initial]
    assert any(point is not None for point in initial_points)

    gap_time = initial[-1].time + 10 * _MINUTE
    gap_bar = SimpleNamespace(time=gap_time, close=initial[-1].close)
    assert state.on_closed_bar(gap_bar) is None

    close = gap_bar.close
    for index in range(1, 10):
        close *= math.exp(0.001)
        assert state.on_closed_bar(
            SimpleNamespace(time=gap_time + index * _MINUTE, close=close)
        ) is None

    close *= math.exp(0.001)
    resumed = state.on_closed_bar(
        SimpleNamespace(time=gap_time + 10 * _MINUTE, close=close)
    )
    assert resumed is not None
    assert resumed.strong_threshold is not None


@pytest.mark.unit
def test_gc_push_momentum_ignores_duplicate_closed_bars():
    state = GcPushMomentumState()
    bars = _bars_from_returns([0.001] * 120)
    for bar in bars:
        point = state.on_closed_bar(bar)

    assert point is not None
    assert state.on_closed_bar(bars[-1]) is None
