from __future__ import annotations

from types import SimpleNamespace

from app.smc_ai import mgann_optimize
from app.smc_ai.mgann_backtest import MgannBacktestBar
from app.smc_ai.mgann_optimize import (
    MgannSignalSettings,
    build_search_candidates,
    run_mgann_partial_backtest,
    run_mgann_signal_backtest,
    run_mgann_supertrend_partial_backtest,
)


def _bar(time: int, *, high: float, low: float, close: float) -> MgannBacktestBar:
    return MgannBacktestBar(
        time=time,
        open=close - 0.5,
        high=high,
        low=low,
        close=close,
        volume=10,
        delta=10,
    )


def test_signal_replay_uses_close_entry_wick_stop_and_separate_1r_2r(monkeypatch):
    class FakeDetector:
        def __init__(self, **_kwargs):
            self.calls = 0

        def on_closed_bar(self, _bar):
            self.calls += 1
            return [SimpleNamespace(direction=1)] if self.calls == 1 else []

    monkeypatch.setattr(mgann_optimize, "MgannBigTradeSweepState", FakeDetector)
    result = run_mgann_signal_backtest(
        [
            _bar(60_000, high=100.5, low=99.0, close=100.0),
            _bar(120_000, high=101.0, low=99.5, close=100.5),
            _bar(180_000, high=100.7, low=98.9, close=99.5),
        ],
        evaluation_start=60_000,
    )

    assert result["targets"]["1R"]["netR"] == 1.0
    assert result["targets"]["1R"]["wins"] == 1
    assert result["targets"]["2R"]["netR"] == -1.0
    assert result["targets"]["2R"]["losses"] == 1


def test_signal_replay_is_adverse_first_when_one_bar_touches_both(monkeypatch):
    class FakeDetector:
        def __init__(self, **_kwargs):
            self.calls = 0

        def on_closed_bar(self, _bar):
            self.calls += 1
            return [SimpleNamespace(direction=1)] if self.calls == 1 else []

    monkeypatch.setattr(mgann_optimize, "MgannBigTradeSweepState", FakeDetector)
    result = run_mgann_signal_backtest(
        [
            _bar(60_000, high=100.5, low=99.0, close=100.0),
            _bar(120_000, high=101.5, low=98.5, close=100.0),
        ],
        evaluation_start=60_000,
        targets=(1.0,),
    )

    assert result["targets"]["1R"]["netR"] == -1.0
    assert result["targets"]["1R"]["exitReasons"] == {"stop": 1}


def test_partial_plan_keeps_initial_stop_and_scores_half_at_1r_then_stop_as_flat(
    monkeypatch,
):
    class FakeDetector:
        def __init__(self, **_kwargs):
            self.calls = 0

        def on_closed_bar(self, _bar):
            self.calls += 1
            return [SimpleNamespace(direction=1)] if self.calls == 1 else []

    monkeypatch.setattr(mgann_optimize, "MgannBigTradeSweepState", FakeDetector)
    result = run_mgann_partial_backtest(
        [
            _bar(60_000, high=100.5, low=99.0, close=100.0),
            _bar(120_000, high=101.1, low=99.5, close=100.5),
            _bar(180_000, high=100.5, low=98.9, close=99.5),
        ],
        evaluation_start=60_000,
        move_stop_to_break_even=False,
    )

    assert result["summary"]["netR"] == 0.0
    assert result["summary"]["breakevens"] == 1
    assert result["summary"]["exitReasons"] == {"initial_stop_after_partial": 1}


def test_partial_plan_can_move_remaining_half_to_break_even(monkeypatch):
    class FakeDetector:
        def __init__(self, **_kwargs):
            self.calls = 0

        def on_closed_bar(self, _bar):
            self.calls += 1
            return [SimpleNamespace(direction=1)] if self.calls == 1 else []

    monkeypatch.setattr(mgann_optimize, "MgannBigTradeSweepState", FakeDetector)
    result = run_mgann_partial_backtest(
        [
            _bar(60_000, high=100.5, low=99.0, close=100.0),
            _bar(120_000, high=101.1, low=99.5, close=100.5),
            _bar(180_000, high=100.5, low=99.9, close=100.0),
        ],
        evaluation_start=60_000,
        move_stop_to_break_even=True,
    )

    assert result["summary"]["netR"] == 0.5
    assert result["summary"]["wins"] == 1
    assert result["summary"]["exitReasons"] == {"break_even_after_partial": 1}


def test_partial_plan_scores_half_at_1r_and_half_at_3r_as_two_r(monkeypatch):
    class FakeDetector:
        def __init__(self, **_kwargs):
            self.calls = 0

        def on_closed_bar(self, _bar):
            self.calls += 1
            return [SimpleNamespace(direction=1)] if self.calls == 1 else []

    monkeypatch.setattr(mgann_optimize, "MgannBigTradeSweepState", FakeDetector)
    result = run_mgann_partial_backtest(
        [
            _bar(60_000, high=100.5, low=99.0, close=100.0),
            _bar(120_000, high=103.1, low=99.5, close=102.5),
        ],
        evaluation_start=60_000,
    )

    assert result["summary"]["netR"] == 2.0
    assert result["summary"]["exitReasons"] == {"target_3r_after_partial": 1}


def test_supertrend_partial_can_exit_on_the_bar_that_first_reaches_one_r(monkeypatch):
    class FakeDetector:
        def __init__(self, **_kwargs):
            self.calls = 0

        def on_closed_bar(self, _bar):
            self.calls += 1
            return [SimpleNamespace(direction=1)] if self.calls == 1 else []

    class FakeSupertrend:
        def __init__(self, _config):
            pass

        def on_closed_bar(self, bar):
            return SimpleNamespace(value=101.0 if bar.time == 120_000 else 90.0)

    monkeypatch.setattr(mgann_optimize, "MgannBigTradeSweepState", FakeDetector)
    monkeypatch.setattr(mgann_optimize, "SupertrendState", FakeSupertrend)
    result = run_mgann_supertrend_partial_backtest(
        [
            _bar(60_000, high=100.5, low=99.0, close=100.0),
            _bar(120_000, high=101.1, low=99.5, close=100.5),
        ],
        evaluation_start=60_000,
    )

    assert result["summary"]["netR"] == 0.75
    assert result["summary"]["exitReasons"] == {"supertrend_close": 1}


def test_supertrend_partial_keeps_initial_stop_as_the_adverse_first_exit(monkeypatch):
    class FakeDetector:
        def __init__(self, **_kwargs):
            self.calls = 0

        def on_closed_bar(self, _bar):
            self.calls += 1
            return [SimpleNamespace(direction=1)] if self.calls == 1 else []

    class FakeSupertrend:
        def __init__(self, _config):
            pass

        def on_closed_bar(self, bar):
            return SimpleNamespace(value=101.0 if bar.time == 180_000 else 90.0)

    monkeypatch.setattr(mgann_optimize, "MgannBigTradeSweepState", FakeDetector)
    monkeypatch.setattr(mgann_optimize, "SupertrendState", FakeSupertrend)
    result = run_mgann_supertrend_partial_backtest(
        [
            _bar(60_000, high=100.5, low=99.0, close=100.0),
            _bar(120_000, high=101.1, low=99.5, close=100.8),
            _bar(180_000, high=100.5, low=98.9, close=100.0),
        ],
        evaluation_start=60_000,
    )

    assert result["summary"]["netR"] == 0.0
    assert result["summary"]["exitReasons"] == {"initial_stop_after_partial": 1}


def test_signal_settings_are_forwarded_to_the_shared_detector(monkeypatch):
    captured: dict[str, object] = {}

    class FakeDetector:
        def __init__(self, **kwargs):
            captured.update(kwargs)

        def on_closed_bar(self, _bar):
            return []

    monkeypatch.setattr(mgann_optimize, "MgannBigTradeSweepState", FakeDetector)
    settings = MgannSignalSettings(
        volume_delta_lookback=30,
        volume_delta_multiplier=2.5,
        min_spread_ticks=5,
        spread_lookback=40,
        spread_multiplier=1.5,
        swing_size=7,
        confirmation_bars=1,
        break_ticks=2,
    )
    run_mgann_signal_backtest(
        [_bar(60_000, high=101.0, low=99.0, close=100.0)],
        evaluation_start=60_000,
        settings=settings,
    )

    assert captured["volume_delta_lookback"] == 30
    assert captured["volume_delta_multiplier"] == 2.5
    assert captured["min_spread_ticks"] == 5
    assert captured["spread_lookback"] == 40
    assert captured["spread_multiplier"] == 1.5
    assert captured["swing_size"] == 7
    assert captured["confirmation_bars"] == 1
    assert captured["break_ticks"] == 2
    assert captured["require_big_trade"] is False


def test_search_candidates_are_reproducible_and_include_the_screenshot_baseline():
    first = build_search_candidates(random_configs=5, seed=123)
    second = build_search_candidates(random_configs=5, seed=123)

    assert first == second
    assert first[0] == MgannSignalSettings()
    assert len(first) == len(set(first))
    assert any(
        item.volume_delta_multiplier == 2.0 and item.spread_multiplier == 2.0
        for item in first
    )
