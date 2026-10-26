"""Regressions discovered from exact 7.0.1.0 CIL and ILSpy reconstruction.

These assert static rule translation, not runtime parity. Artifact/CIL identity:
ev_70cc7129c505c96a252e398eef3ec74730e748e8b0ef6f92e6344577be79f87d.
"""

from dataclasses import replace

import pytest

from app.orderflow7.config import OF7Config
from app.orderflow7.models import OF7Bar, OF7Cell, OF7Frame
from app.orderflow7.signals import detect_signals

pytestmark = pytest.mark.unit


def frame(*, opening=100, close=104, low=100, high=104, cells=None, poc=102,
          val=101, vah=103, buy_imb=(), sell_imb=()):
    bar = OF7Bar(time=0, open=opening, high=high, low=low, close=close,
                 cells=tuple(cells) if cells is not None else tuple(OF7Cell(p, 5, 20) for p in range(low, high + 1)),
                 session_id="test")
    return OF7Frame(bar, poc, low, high, val, vah, tuple(buy_imb), tuple(sell_imb), True, True)


def config(feature, **settings):
    return OF7Config(enabled_features=(feature,), **settings)


def test_base_detect_swing_suppresses_first_two_chart_bars_even_without_filter():
    sample = frame(cells=[OF7Cell(100, 0, 2), OF7Cell(101, 1, 20)])
    cfg = config("zero_print")
    assert detect_signals([sample], cfg, bar_index=0, current_bar_index=0) == ()
    assert detect_signals([sample], cfg, bar_index=1, current_bar_index=1) == ()
    assert len(detect_signals([sample], cfg, bar_index=2, current_bar_index=2)) == 1


def test_fast_historical_currentbar_can_be_one_ahead_of_evaluated_bar():
    sample = frame(cells=[OF7Cell(100, 0, 2), OF7Cell(101, 1, 20)])
    cfg = config("zero_print")
    assert detect_signals([sample], cfg, bar_index=1, current_bar_index=1) == ()
    assert len(detect_signals([sample], cfg, bar_index=1, current_bar_index=2)) == 1


def test_gap_offset_guard_requires_currentbar_above_two_even_without_filter():
    samples = [frame(), frame(low=110, high=114, opening=110, close=114, poc=112, val=111, vah=113)]
    assert detect_signals(samples, config("orderflows_gaps"), bar_index=2) == ()
    assert len(detect_signals(samples, config("orderflows_gaps"), bar_index=3)) == 1


def test_swing_offset_uses_current_candle_direction_and_period_plus_one():
    # Prior candle is bearish, but current is bullish: DLL checks the prior LOW,
    # not its HIGH. The extra third older bar matters for period=2.
    samples = [frame(low=90, opening=100), frame(), frame(),
               frame(low=95, opening=104, close=100),
               frame(low=110, high=114, opening=110, close=114, poc=112, val=111, vah=113)]
    cfg = config("orderflows_gaps", global_lookback_period=2, lookback_features=("orderflows_gaps",))
    assert detect_signals(samples, cfg) == ()  # low95 fails older low90
    samples[0] = frame(low=96, opening=100)
    assert len(detect_signals(samples, cfg)) == 1


def test_swing_uses_available_early_nt_max_min_window():
    samples = [frame(low=99), frame(low=98), frame(low=97,
               cells=[OF7Cell(97, 10, 1), OF7Cell(98, 1, 10), OF7Cell(99, 1, 10)])]
    cfg = config("delta_tail", lookback_features=("delta_tail",), global_lookback_period=5)
    assert len(detect_signals(samples, cfg)) == 1


def test_market_weakness_has_extra_absolute_bar_index_gate():
    samples = [frame(cells=[OF7Cell(100, 30, 0)]), frame(cells=[OF7Cell(100, 20, 0)]),
               frame(cells=[OF7Cell(100, 10, 0)])]
    assert detect_signals(samples, config("market_weakness"), bar_index=3) == ()
    assert len(detect_signals(samples, config("market_weakness"), bar_index=4)) == 1


@pytest.mark.parametrize("feature", ["aligned_poc", "engulfing_value_area", "imbalance_reload"])
def test_no_generic_swing_gate_is_invented_for_methods_that_do_not_call_it(feature):
    previous = frame(buy_imb=(102,))
    current = frame(val=100, vah=104, buy_imb=(102,))
    found = detect_signals([previous, current], config(feature, lookback_features=(feature,)),
                           bar_index=1, current_bar_index=1)
    assert len(found) == 1


def test_open_poc_uses_partial_window_but_requires_barindex_greater_than_one():
    samples = [frame(), frame(), frame(low=110, high=114, opening=110, close=114, poc=112)]
    assert detect_signals(samples[-2:], config("open_poc"), bar_index=1) == ()
    assert len(detect_signals(samples, config("open_poc"), bar_index=2)) == 1


def test_prominent_poc_has_no_base_swing_startup_gate():
    assert len(detect_signals([frame(poc=100)], config("prominent_poc_level_1"))) == 1


def test_zero_print_zone_is_exactly_two_prices_even_on_single_price_bar():
    # Doji cannot signal; OHLC can move while supplied sparse ladder has one row.
    sample = frame(high=101, close=101, cells=[OF7Cell(100, 0, 1)])
    result = detect_signals([sample], config("zero_print"), bar_index=2)
    assert (result[0].zone_low, result[0].zone_high) == (100, 101)


def test_sequencing_discards_breaking_row_instead_of_restarting_from_it():
    # 1,2 then 1 BREAKS and is discarded; following 2,3 only spans one tick.
    sample = frame(cells=[OF7Cell(100 + i, 1, ask) for i, ask in enumerate([1, 2, 1, 2, 3])])
    assert detect_signals([sample], config("orderflows_sequencing", orderflows_sequencing_cluster_size=3),
                          bar_index=10) == ()


def test_sequencing_up_initial_zero_is_not_part_of_run():
    sample = frame(cells=[OF7Cell(100 + i, 1, ask) for i, ask in enumerate([0, 1, 2, 3, 4])])
    assert detect_signals([sample], config("orderflows_sequencing"), bar_index=10) == ()


def test_sparse_sweep_and_sequencing_use_price_span_not_row_count():
    sample = frame(cells=[OF7Cell(100, 1, 1), OF7Cell(104, 1, 2)])
    for feature in ("market_sweep", "orderflows_sequencing"):
        result = detect_signals([sample], config(feature), bar_index=10)
        assert len(result) == 1
        assert (result[0].zone_low, result[0].zone_high) == (100, 104)


def test_sparse_vertical_clusters_follow_keys_and_end_before_next_failing_key():
    sample = frame(high=110, close=110, cells=[OF7Cell(100, 1, 300), OF7Cell(102, 1, 300),
                        OF7Cell(105, 1, 300), OF7Cell(110, 1, 1)])
    result = detect_signals([sample], config("vertical_liquidity"), bar_index=10)
    assert (result[0].zone_low, result[0].zone_high) == (100, 109)


def test_ratio_missing_adjacent_price_reads_zero_without_creating_a_row():
    sample = frame(cells=[OF7Cell(100, 20, 2), OF7Cell(104, 1, 2)])
    result = detect_signals([sample], config("ratio_price_defense"), bar_index=10)
    assert result[0].metrics["ratio"] == 0
    assert len(sample.bar.cells) == 2


def test_tails_missing_adjacent_price_reads_zero_but_requires_two_actual_rows():
    sample = frame(cells=[OF7Cell(100, 20, 0), OF7Cell(104, 1, 2)])
    assert len(detect_signals([frame(), sample], config("tails"), bar_index=10)) == 1
    sample = replace(sample, bar=replace(sample.bar, cells=(sample.bar.cells[0],)))
    assert detect_signals([frame(), sample], config("tails"), bar_index=10) == ()


def test_retail_suck_can_use_missing_third_price_zero_when_other_rows_exist():
    sample = frame(cells=[OF7Cell(100, 20, 1), OF7Cell(101, 10, 1), OF7Cell(104, 1, 2)])
    result = detect_signals([sample], config("retail_suck"), bar_index=10)
    assert (result[0].zone_low, result[0].zone_high) == (100, 102)


def test_zero_zero_is_not_imbalance_even_when_min_volume_is_zero():
    sample = frame(cells=[OF7Cell(100, 0, 1), OF7Cell(101, 1, 0), OF7Cell(104, 1, 1)])
    assert detect_signals([sample], config("imbalance_reversal", imbalance_reversal_minimal_volume=0),
                          bar_index=10) == ()


def test_market_weakness_sequence_one_dll_has_no_delta_sign_comparison():
    sample = frame()  # positive delta on bullish candle, yet DLL emits Buy for N=1
    result = detect_signals([sample], config("market_weakness", market_weakness_sequence_length=1),
                            bar_index=10)
    assert result[0].side == "buy"
