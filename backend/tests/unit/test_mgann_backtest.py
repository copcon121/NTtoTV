from __future__ import annotations

from app.smc_ai.mgann_backtest import (
    MgannBacktestBar,
    MgannBacktestConfig,
    _Trade,
    _activate_trailing,
    _new_trade,
    _process_intrabar,
    delta_filter_passes,
    ema200_trend_filter_passes,
    trade_side_filter_passes,
)


def test_delta_filter_requires_same_direction_and_two_times_prior_absolute_average():
    previous = (10, 20, 30, 40)
    assert delta_filter_passes(
        direction=1,
        current_delta=50,
        previous_abs_deltas=previous,
    )
    assert not delta_filter_passes(
        direction=1,
        current_delta=-100,
        previous_abs_deltas=previous,
    )
    assert not delta_filter_passes(
        direction=-1,
        current_delta=-49,
        previous_abs_deltas=previous,
    )


def test_ema200_trend_filter_requires_the_matching_side_of_the_average():
    assert ema200_trend_filter_passes(direction=1, close=100.1, ema200=100.0)
    assert ema200_trend_filter_passes(direction=-1, close=99.9, ema200=100.0)
    assert not ema200_trend_filter_passes(direction=1, close=99.9, ema200=100.0)
    assert not ema200_trend_filter_passes(direction=-1, close=100.1, ema200=100.0)
    assert not ema200_trend_filter_passes(direction=1, close=100.0, ema200=100.0)


def test_trade_side_filter_can_replay_only_long_signals():
    assert trade_side_filter_passes(direction=1, trade_side="both")
    assert trade_side_filter_passes(direction=-1, trade_side="both")
    assert trade_side_filter_passes(direction=1, trade_side="long")
    assert not trade_side_filter_passes(direction=-1, trade_side="long")
    assert not trade_side_filter_passes(direction=1, trade_side="short")
    assert trade_side_filter_passes(direction=-1, trade_side="short")


def test_intrabar_assumption_is_adverse_first_when_stop_and_target_share_a_bar():
    trade = _Trade(
        id="long",
        signal_time=1,
        side=1,
        entry_style="market",
        entry=100.0,
        stop=98.0,
        initial_stop=98.0,
        target=106.0,
        risk=2.0,
        submitted_time=1,
        status="open",
    )
    open_trades = [trade]
    closed: list[_Trade] = []
    _process_intrabar(
        MgannBacktestBar(
            time=60_000,
            open=100.0,
            high=106.5,
            low=97.5,
            close=101.0,
            volume=1,
            delta=0,
        ),
        ema21=100.0,
        pending=[],
        open_trades=open_trades,
        closed=closed,
        cancelled=[],
        breakeven_at_one_r=False,
    )
    assert open_trades == []
    assert closed == [trade]
    assert trade.exit_reason == "stop"
    assert trade.exit_price == 98.0


def test_backtest_passes_liquidity_filter_to_the_shared_mgann_detector(monkeypatch):
    from app.smc_ai import mgann_backtest

    captured: dict[str, object] = {}

    class FakeDetector:
        def __init__(self, **kwargs):
            captured.update(kwargs)

        def on_closed_bar(self, _bar):
            return []

    monkeypatch.setattr(mgann_backtest, "MgannBigTradeSweepState", FakeDetector)
    mgann_backtest.run_mgann_backtest(
        [
            MgannBacktestBar(
                time=60_000,
                open=100.0,
                high=101.0,
                low=99.0,
                close=100.5,
                volume=1,
                delta=0,
            )
        ],
        evaluation_start=60_000,
        config=MgannBacktestConfig(require_liquidity_filter=True),
    )
    assert captured["filter_liquidity"] is True


def test_break_even_option_sets_a_one_r_long_stop_to_entry_without_ema_ratchet():
    trade = _Trade(
        id="long",
        signal_time=1,
        side=1,
        entry_style="market",
        entry=100.0,
        stop=98.0,
        initial_stop=98.0,
        target=106.0,
        risk=2.0,
        submitted_time=1,
        status="open",
    )
    _activate_trailing(trade, ema21=102.0, breakeven_at_one_r=True)
    assert trade.trailing is True
    assert trade.stop == 100.0


def test_fixed_target_one_r_sets_the_take_profit_at_exactly_one_r():
    bar = MgannBacktestBar(
        time=60_000,
        open=100.0,
        high=103.0,
        low=99.0,
        close=102.0,
        volume=1,
        delta=0,
    )
    trade = _new_trade(bar, direction=1, ordinal=1, fixed_target_r=1.0)
    assert trade.target == _round_one_decimal(trade.entry + trade.risk)


def _round_one_decimal(value: float) -> float:
    return round(value, 1)
