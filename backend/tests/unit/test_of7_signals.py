"""Hand-calculated rule examples, not an assertion of parity with NinjaTrader."""

from dataclasses import replace

import pytest

from app.orderflow7.config import OF7Config
from app.orderflow7.models import OF7Bar, OF7Cell, OF7Frame
from app.orderflow7.signals import detect_signals


def frame(
    *, bid=1, ask=10, start=100, opening=None, close=None, poc=None,
    bids=None, asks=None, val=None, vah=None, buy_imb=(), sell_imb=(),
    time=0, session_low=True, session_high=True,
):
    bids = list(bids) if bids is not None else [bid] * 5
    asks = list(asks) if asks is not None else [ask] * len(bids)
    high = start + len(bids) - 1
    bar = OF7Bar(
        time=time, open=start if opening is None else opening,
        high=high, low=start, close=high if close is None else close,
        cells=tuple(OF7Cell(price=start + i, bid=b, ask=a, between=0)
                    for i, (b, a) in enumerate(zip(bids, asks))),
        session_id="test", is_closed=True,
    )
    return OF7Frame(
        bar=bar, poc=start + 2 if poc is None else poc,
        poc_bid=start, poc_ask=high, val=start + 1 if val is None else val,
        vah=high - 1 if vah is None else vah,
        ask_imbalances=tuple(buy_imb), bid_imbalances=tuple(sell_imb),
        is_session_high=session_high, is_session_low=session_low,
    )


def signals(feature, *frames, **settings):
    config = replace(OF7Config(), enabled_features=(feature,), **settings)
    # These examples exercise a detector on an already-warm chart. Absolute NT
    # startup indices are checked separately in test_of7_dll_rules.py.
    return detect_signals(frames, config, bar_index=100, current_bar_index=100)


@pytest.mark.parametrize("feature,frames,expected_zone,expected_side", [
    ("accumulation_distribution", [frame()] * 4, (100, 100), "buy"),
    ("tails", [frame(), frame(asks=[0, 0, 2, 3, 4])], (100, 101), "buy"),
    ("delta_divergence", [frame()], (100, 101), "buy"),
    ("price_action_divergence", [frame(bid=10, ask=1)], (100, 101), "buy"),
    ("exhaustion_prints", [frame()] * 4, (100, 100), "buy"),
    ("imbalance_reversal", [frame(bids=[10, 1, 1, 1, 1], asks=[1, 1, 1, 1, 1])], (100, 101), "buy"),
    ("market_sweep", [frame(bids=[5, 5, 5, 6, 6])], (100, 102), "buy"),
    ("market_weakness", [frame(bid=10, ask=0), frame(bid=6, ask=0), frame(bid=2, ask=0)], (100, 100), "buy"),
    ("orderflows_sequencing", [frame(asks=[1, 2, 3, 4, 5])], (100, 104), "buy"),
    ("poc_slingshot", [frame(poc=103), frame(poc=101)], (101, 101), "buy"),
    ("prominent_poc_level_1", [frame(poc=100)], (100, 100), "buy"),
    ("prominent_poc_level_2", [frame(poc=101)], (101, 101), "buy"),
    ("prominent_poc_level_3", [frame()] * 4, (102, 102), "buy"),
    ("thin_prints", [frame(bids=[9, 9, 1, 9, 9])], (102, 102), "buy"),
    ("ratio_price_defense", [frame(bids=[0, 5, 5, 5, 5])], (99, 99), "buy"),
    ("ratio_price_exhaustion", [frame(bids=[1, 31, 1, 1, 1])], (99, 99), "buy"),
    ("zero_print", [frame(bids=[0, 1, 1, 1, 1])], (100, 101), "buy"),
    ("engulfing_value_area", [frame(val=101, vah=103), frame(val=100, vah=104)], (100, 104), "buy"),
    ("multiple_imbalances", [frame(buy_imb=(101, 102, 104))], (104, 104), "buy"),
    ("stacked_imbalance", [frame(buy_imb=(101, 102, 103))], (101, 103), "buy"),
    ("inverse_imbalance", [frame(sell_imb=(100, 101))], (100, 101), "buy"),
    ("open_poc", [frame()] * 5 + [frame(start=110, poc=112)], (112, 112), "buy"),
    ("aligned_poc", [frame(poc=102), frame(poc=102)], (102, 102), "buy"),
    ("orderflows_gaps", [frame(), frame(start=110, val=110, vah=112)], (104, 109), "buy"),
    ("imbalance_reload", [frame(buy_imb=(102,)), frame(buy_imb=(102,))], (102, 102), "buy"),
    ("volume_decline", [frame(bids=[1, 2, 3, 9, 9])], (100, 102), "buy"),
    ("retail_suck", [frame(bids=[3, 2, 1, 9, 9])], (100, 102), "buy"),
    ("poc_wave", [frame(), frame(opening=104, close=100, poc=102), frame(poc=100), frame(poc=103)], (100, 100), "buy"),
    ("delta_tail", [frame(bids=[10, 1, 1, 1, 1], asks=[1, 10, 10, 10, 10])], (100, 100), "buy"),
    ("delta_breakout", [frame(bid=0, ask=1), frame(bid=0, ask=50)], (100, 100), "buy"),
    ("resting_liquidity", [frame(asks=[0, 200, 200, 250, 0]), frame(asks=[0, 200, 200, 300, 0])], (103, 103), "buy"),
    ("vertical_liquidity", [frame(asks=[0, 250, 250, 250, 0])], (101, 103), "buy"),
])
def test_each_detector_has_a_hand_calculated_example(feature, frames, expected_zone, expected_side):
    found = signals(feature, *frames)
    assert len(found) == 1
    signal = found[0]
    assert signal.feature == feature
    assert signal.side == expected_side
    assert (signal.zone_low, signal.zone_high) == expected_zone
    assert signal.price == frames[-1].bar.low


def test_value_area_is_two_fixed_levels_including_neutral_doji():
    found = signals("value_area", frame(close=100))
    assert [(s.original_series, s.price, s.side) for s in found] == [
        ("Value Area Low", 101, "neutral"), ("Value Area High", 103, "neutral"),
    ]
    assert all("fixed_level_not_directional_signal" in s.warnings for s in found)


@pytest.mark.parametrize("feature,current,series", [
    ("tails", frame(opening=104, close=100, bids=[1, 1, 1, 0, 0]), "TailsBuy"),
    ("tails", frame(asks=[0, 0, 1, 1, 1]), "TailsSell"),
    ("orderflows_sequencing", frame(opening=104, close=100, bids=[5, 4, 3, 2, 1]), "OrderflowsSequencingBuy"),
    ("zero_print", frame(opening=104, close=100, asks=[1, 1, 1, 1, 0]), "ZeroPrintBuy"),
])
def test_legacy_public_series_is_separate_from_zone_direction(feature, current, series):
    found = signals(feature, frame(), current)
    assert len(found) == 1
    assert found[0].side == ("buy" if current.bar.up else "sell")
    assert found[0].original_series == series
    assert found[0].warnings


def test_ratio_uses_strict_bounds_but_zero_denominator_maps_to_defense():
    at_low = frame(bids=[100, 69, 1, 1, 1])
    at_high = frame(bids=[1, 30, 1, 1, 1])
    assert signals("ratio_price_defense", at_low) == ()
    assert signals("ratio_price_exhaustion", at_high) == ()
    zero = signals("ratio_price_defense", frame(bids=[0, 999, 1, 1, 1]))[0]
    assert zero.metrics["ratio"] == 0
    assert "dll_zero_denominator_maps_to_zero" in zero.warnings


def test_delta_breakout_threshold_is_inclusive_and_requires_same_direction():
    # Deltas are 5 and 205, an acceleration of exactly 200 contracts.
    assert len(signals("delta_breakout", frame(bid=0, ask=1), frame(bid=0, ask=41))) == 1
    assert signals("delta_breakout", frame(bid=0, ask=1), frame(bid=0, ask=40)) == ()
    assert signals("delta_breakout", frame(bid=0, ask=1, opening=104, close=100), frame(bid=0, ask=41)) == ()


def test_exhaustion_requires_positive_volume_and_uses_inclusive_size_limit():
    history = [frame()] * 3
    assert len(signals("exhaustion_prints", *history, frame(bid=9))) == 1
    assert signals("exhaustion_prints", *history, frame(bid=10)) == ()
    assert signals("exhaustion_prints", *history, frame(bid=0)) == ()


def test_prominent_poc_levels_stop_at_first_matching_enabled_level():
    config = replace(OF7Config(), enabled_features=(
        "prominent_poc_level_1", "prominent_poc_level_2", "prominent_poc_level_3",
    ))
    found = detect_signals([frame()] * 3 + [frame(poc=100)], config)
    assert [s.feature for s in found] == ["prominent_poc_level_1"]


def test_clusters_require_consecutive_price_ticks():
    assert signals("stacked_imbalance", frame(buy_imb=(100, 102, 104))) == ()
    assert signals("inverse_imbalance", frame(sell_imb=(100, 102))) == ()


def test_swing_filter_does_not_treat_insufficient_history_as_pass():
    assert signals("delta_tail", frame(bids=[10, 1, 1, 1, 1]), lookback_features=("delta_tail",)) == ()


def test_shared_imbalance_method_suppresses_other_feature_when_one_filter_fails():
    current = frame(buy_imb=(101, 102, 103))
    config = replace(OF7Config(), enabled_features=("stacked_imbalance", "inverse_imbalance"),
                     lookback_features=("inverse_imbalance",))
    assert detect_signals([current], config) == ()


def test_terminal_bid_cluster_preserves_reported_stacked_sell_anomaly():
    # Directly supplied frame represents the detector's terminal flush state;
    # diagonal-imbalance generation itself cannot mark the highest price Bid.
    current = frame(sell_imb=(102, 103, 104))
    found = signals("stacked_imbalance", current)
    assert len(found) == 1
    assert found[0].side == "sell"
    assert found[0].price == 104
    assert "dll_terminal_bid_cluster_missing_downbar_guard" in found[0].warnings


def test_vertical_liquidity_lookback_preserves_documented_blocking_condition():
    assert signals("vertical_liquidity", *([frame(ask=300)] * 10),
                   lookback_features=("vertical_liquidity",)) == ()


def test_daily_extreme_filter_uses_session_flags_not_just_delta():
    assert signals("delta_divergence", frame(session_low=False)) == ()
    assert len(signals("delta_divergence", frame(session_low=False),
                       delta_divergence_only_daily_high_low=False)) == 1


def test_doji_does_not_emit_directional_price_action_patterns():
    config = replace(OF7Config(), enabled_features=("delta_divergence", "price_action_divergence",
                                                  "zero_print", "delta_tail", "market_sweep"))
    assert detect_signals([frame(close=100)], config) == ()


def test_re_evaluation_can_remove_intrabar_signal_without_mutating_previous_result():
    first = frame(bids=[0, 1, 1, 1, 1])
    before = signals("zero_print", replace(first, bar=replace(first.bar, is_closed=False)))
    after = signals("zero_print", frame(bids=[1, 1, 1, 1, 1]))
    assert len(before) == 1
    assert after == ()
    assert before[0].original_series == "ZeroPrintBuy"
