"""Chosen research corrections stay distinguishable from the original DLL."""

from dataclasses import replace

import pytest

from app.orderflow7.config import OF7Config
from app.orderflow7.models import OF7Bar, OF7Cell, OF7Frame
from app.orderflow7.research import RESEARCH_POLICY_VERSION, research_signals
from app.orderflow7.signals import detect_signals

pytestmark = pytest.mark.unit


def frame(*, bids=(1, 1, 1, 1, 1), asks=(10, 10, 10, 10, 10), low=100,
          opening=None, close=None, buy_imb=(), sell_imb=()):
    high = low + len(bids) - 1
    bar = OF7Bar(time=0, open=low if opening is None else opening,
                 high=high, low=low, close=high if close is None else close,
                 cells=tuple(OF7Cell(low + i, bid, ask) for i, (bid, ask) in enumerate(zip(bids, asks))),
                 session_id="s")
    # Choose actual maximum side rows independently of the original stream quirk.
    return OF7Frame(bar, low + 2, low + max(range(len(bids)), key=lambda i: bids[i]),
                    low + max(range(len(asks)), key=lambda i: asks[i]),
                    low + 1, high - 1, tuple(buy_imb), tuple(sell_imb), True, True)


def evaluate(frames, config):
    options = dict(bar_index=20, current_bar_index=20)
    return detect_signals(frames, config, **options), research_signals(frames, config, **options)


def test_accumulation_buy_no_longer_fires_on_every_bullish_candle():
    cfg = OF7Config(enabled_features=("accumulation_distribution",))
    original, corrected = evaluate([frame()], cfg)
    assert original[0].side == "buy"
    assert corrected == ()


def test_accumulation_buy_passive_filter_requires_both_comparisons():
    cfg = OF7Config(enabled_features=("accumulation_distribution",), passive_traders_in_control=True)
    original, corrected = evaluate([frame(bids=(100, 20, 1, 1, 1), asks=(60, 1, 1, 1, 1))], cfg)
    assert original  # Original OR allows maximum Bid alone to satisfy the rule.
    assert corrected == ()
    original, corrected = evaluate([frame(bids=(100, 80, 1, 1, 1), asks=(60, 1, 1, 1, 1))], cfg)
    assert corrected[0].side == original[0].side == "buy"
    assert corrected[0].original_series == original[0].original_series
    assert f"research_policy:{RESEARCH_POLICY_VERSION}" in corrected[0].warnings


def test_valid_accumulation_sell_is_unchanged():
    cfg = OF7Config(enabled_features=("accumulation_distribution",))
    original, corrected = evaluate([frame(opening=104, close=100)], cfg)
    assert corrected == original
    assert corrected[0].side == "sell"


def test_zero_denominator_defense_is_removed_but_raw_compatibility_is_untouched():
    cfg = OF7Config(enabled_features=("ratio_price_defense",))
    original, corrected = evaluate([frame(bids=(0, 100, 1, 1, 1))], cfg)
    assert original[0].metrics["ratio"] == 0
    assert corrected == ()
    assert detect_signals([frame(bids=(0, 100, 1, 1, 1))], cfg, bar_index=20) == original


def test_positive_denominator_defense_remains_identical():
    cfg = OF7Config(enabled_features=("ratio_price_defense",))
    original, corrected = evaluate([frame(bids=(100, 30, 1, 1, 1))], cfg)
    assert corrected == original


def test_terminal_stacked_sell_on_up_candle_is_removed():
    # A direct terminal detector-state fixture exercises the DLL's malformed
    # branch; ordinary diagonal generation cannot mark Bid at ladder maximum.
    cfg = OF7Config(enabled_features=("stacked_imbalance",))
    original, corrected = evaluate([frame(sell_imb=(102, 103, 104))], cfg)
    assert original[0].side == "sell"
    assert corrected == ()


def test_inverse_filter_failure_no_longer_suppresses_valid_stacked_signal():
    samples = [frame()] * 6 + [frame(buy_imb=(101, 102, 103))]
    cfg = OF7Config(enabled_features=("stacked_imbalance", "inverse_imbalance"),
                    lookback_features=("inverse_imbalance",))
    original, corrected = evaluate(samples, cfg)
    assert original == ()
    assert [s.feature for s in corrected] == ["stacked_imbalance"]
    assert "research_imbalance_swing_filters_are_independent" in corrected[0].warnings


def test_stacked_filter_failure_no_longer_suppresses_valid_inverse_signal():
    samples = [frame()] * 6 + [frame(sell_imb=(100, 101))]
    cfg = OF7Config(enabled_features=("stacked_imbalance", "inverse_imbalance"),
                    lookback_features=("stacked_imbalance",))
    original, corrected = evaluate(samples, cfg)
    assert original == ()
    assert [s.feature for s in corrected] == ["inverse_imbalance"]


def test_vertical_lookback_compares_against_older_bars_and_can_emit():
    samples = [frame()] * 3 + [frame(low=90, asks=(300, 300, 300, 1, 1))]
    cfg = OF7Config(enabled_features=("vertical_liquidity",),
                    lookback_features=("vertical_liquidity",), global_lookback_period=2)
    original, corrected = evaluate(samples, cfg)
    assert original == ()
    assert corrected[0].feature == "vertical_liquidity"
    assert (corrected[0].zone_low, corrected[0].zone_high) == (90, 92)
    assert "research_vertical_swing_excludes_current_bar" in corrected[0].warnings


def test_vertical_corrected_filter_still_rejects_non_swing_and_startup():
    cfg = OF7Config(enabled_features=("vertical_liquidity",),
                    lookback_features=("vertical_liquidity",), global_lookback_period=2)
    samples = [frame()] * 3 + [frame(asks=(300, 300, 300, 1, 1))]
    assert evaluate(samples, cfg)[1] == ()
    assert research_signals([frame(asks=(300, 300, 300, 1, 1))], cfg, bar_index=0) == ()


def test_normalized_direction_and_original_series_provenance_remain_separate():
    cfg = OF7Config(enabled_features=("zero_print",))
    original, corrected = evaluate([frame(opening=104, close=100, asks=(1, 1, 1, 1, 0))], cfg)
    assert corrected == original
    assert corrected[0].side == "sell"
    assert corrected[0].original_series == "ZeroPrintBuy"


def test_valid_unaffected_features_and_input_configuration_are_unchanged():
    cfg = OF7Config(enabled_features=("delta_tail",))
    sample = frame(bids=(10, 1, 1, 1, 1), asks=(1, 10, 10, 10, 10))
    before = cfg.fingerprint
    original, corrected = evaluate([sample], cfg)
    assert corrected == original
    assert corrected[0].feature == "delta_tail"
    assert cfg.fingerprint == before
    assert research_signals([], cfg) == ()
