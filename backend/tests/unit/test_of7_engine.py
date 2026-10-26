"""Independent accounting, causality and data-quality checks for OF7 research."""

from dataclasses import replace
from io import StringIO
import json

import pytest

from app.orderflow7 import OF7Bar, OF7Cell, OF7Config, OF7Engine, build_frame, price_to_ticks
from app.orderflow7.replay import replay

pytestmark = pytest.mark.unit


def bar(**kwargs):
    fields = dict(time=0, open=100, high=102, low=100, close=102,
                  cells=(OF7Cell(100, 10, 1), OF7Cell(101, 1, 40), OF7Cell(102, 5, 5)),
                  session_id="s", source="synthetic", source_contract="GC test")
    return OF7Bar(**(fields | kwargs))


def test_between_counts_in_total_and_poc_but_never_in_delta():
    sample = bar(cells=(OF7Cell(100, 2, 3, 100), OF7Cell(101, 1, 10)))
    frame = build_frame(sample, OF7Config())
    assert sample.volume == 116
    assert sample.delta == 10
    assert frame.poc == 100
    assert (frame.val, frame.vah) == (100, 100)


def test_imbalance_is_four_times_and_requires_actual_diagonal_neighbor():
    frame = build_frame(bar(), OF7Config())
    assert frame.ask_imbalances == (101,)  # 40 / 10 == 4 exactly
    assert 102 not in frame.bid_imbalances  # no 103 row, NOT assumed zero
    hole = bar(cells=(OF7Cell(100, 10, 1), OF7Cell(102, 1, 100)))
    assert build_frame(hole, OF7Config()).ask_imbalances == ()


def test_three_cell_total_volume_breaks_poc_tie():
    sample = bar(high=103, cells=(OF7Cell(100, 0, 10), OF7Cell(101, 0, 1),
                                 OF7Cell(102, 0, 10), OF7Cell(103, 0, 9)))
    assert build_frame(sample, OF7Config()).poc == 102


def test_live_signal_can_disappear_and_bar_close_is_immutable():
    engine = OF7Engine(OF7Config(enabled_features=("price_action_divergence",)))
    live = bar(is_closed=False, reference_bar_index=100,
               cells=(OF7Cell(100, 50, 1), OF7Cell(101, 1, 2)))
    first = engine.update(live, observed_at=10000)
    assert first.signals[0].feature == "price_action_divergence"
    closed = replace(live, cells=(OF7Cell(100, 50, 1), OF7Cell(101, 1, 100)), is_closed=True)
    final = engine.update(closed, observed_at=60000)
    assert final.signals == ()
    assert first.signals  # prior observation remains intact
    with pytest.raises(ValueError, match="revised"):
        engine.update(closed, observed_at=60001)


def test_session_extrema_do_not_reuse_current_live_bar_or_reset_on_pruning():
    engine = OF7Engine()
    engine.update(bar(), observed_at=60000)
    live = bar(time=60000, high=103, is_closed=False)
    assert engine.update(live, observed_at=70000).frame.is_session_high
    assert engine.update(live, observed_at=80000).frame.is_session_high
    engine.update(replace(live, is_closed=True), observed_at=120000)
    for i in range(2, 30):
        assert not engine.update(bar(time=i * 60000), observed_at=(i + 1) * 60000).frame.is_session_high
    assert engine.update(bar(time=1800000, session_id="next"), observed_at=1860000).frame.is_session_high


@pytest.mark.parametrize("change", [{"source":"rithmic"}, {"source_contract":"GC next"},
                                   {"timeframe_ms":30000}])
def test_source_contract_and_timeframe_cannot_mix(change):
    engine = OF7Engine()
    engine.update(bar(), observed_at=60000)
    with pytest.raises(ValueError, match="separate engine"):
        engine.update(bar(time=60000, **change), observed_at=120000)


def test_cannot_advance_unclosed_bar_or_observe_close_early():
    engine = OF7Engine()
    with pytest.raises(ValueError, match="before its end"):
        engine.update(bar(), observed_at=1)
    engine.update(bar(is_closed=False), observed_at=1)
    with pytest.raises(ValueError, match="close the previous"):
        engine.update(bar(time=60000), observed_at=120000)
    with pytest.raises(ValueError, match="monotonic"):
        engine.update(bar(is_closed=False), observed_at=0)


def test_replay_exports_provenance_config_and_missing_data_quality():
    record = dict(time=0, observed_at=60000, open=100, high=102, low=100, close=102,
                  cells=[dict(price=100, bid=5, ask=10)], session_id="s", is_closed=True,
                  source="synthetic", source_contract="GC test", between_known=False)
    output = StringIO()
    assert replay(StringIO(json.dumps(record)), output, OF7Config()) == 1
    result = json.loads(output.getvalue())
    assert result["feature_counts"]["tails"] is None
    assert result["feature_counts"]["stacked_imbalance"] == 0
    assert "between_volume_unknown_poc_and_value_area_may_differ" in result["warnings"]
    assert result["config_hash"] == OF7Config().fingerprint
    del record["source"]
    with pytest.raises(ValueError, match="line 1: missing source"):
        replay(StringIO(json.dumps(record)), StringIO(), OF7Config())


@pytest.mark.parametrize("kwargs", [dict(tick_size=0), dict(value_area_percent=101),
    dict(enabled_features=("bogus",)), dict(market_sweep_cluster_size=0),
    dict(prominent_poc_distances=(1, 0, 3)), dict(ratio_bounds_low=float("nan")),
    dict(thin_prints_maximum_volume=1.1), dict(tails_check_eva="false")])
def test_invalid_parameters_are_rejected(kwargs):
    with pytest.raises(ValueError):
        OF7Config(**kwargs)


def test_prices_must_use_exact_tick_grid():
    assert price_to_ticks("3000.1") == 30001
    with pytest.raises(ValueError):
        price_to_ticks("3000.11")


def test_presets_and_config_hash_are_reproducible():
    assert len(OF7Config.research().enabled_features) == 33
    assert OF7Config(enabled_features=list(OF7Config().enabled_features)).fingerprint == OF7Config().fingerprint
    assert OF7Config().fingerprint != OF7Config(imbalance_in_percent=300).fingerprint


def test_continuous_ratio_is_recorded_even_without_a_ratio_signal():
    engine = OF7Engine(OF7Config(enabled_features=("ratio_price_defense", "ratio_price_exhaustion")))
    snapshot = engine.update(bar(cells=(OF7Cell(100, 10, 0), OF7Cell(101, 20, 1))), observed_at=60000)
    assert snapshot.signals == ()
    assert snapshot.measurements["ratio_buy_value"] == 2
    assert snapshot.measurements["ratio_sell_value"] is None


def test_overlapping_bars_are_rejected_and_lookback_quality_is_retained():
    engine = OF7Engine()
    engine.update(bar(between_known=False), observed_at=60000)
    with pytest.raises(ValueError, match="overlap"):
        engine.update(bar(time=1), observed_at=120000)
    snapshot = engine.update(bar(time=120000), observed_at=180000)
    assert "lookback_between_volume_unknown_multi_bar_signals_may_differ" in snapshot.warnings
    assert "history_has_time_gaps_check_session_break_or_data_loss" in snapshot.warnings


def test_session_extreme_equality_is_inclusive_like_sessiondata_updatevalues():
    engine = OF7Engine()
    engine.update(bar(), observed_at=60000)
    snapshot = engine.update(bar(time=60000), observed_at=120000)
    assert snapshot.frame.is_session_high and snapshot.frame.is_session_low


def test_engine_keeps_absolute_indices_after_pruning_and_honors_supplied_frame():
    from app.orderflow7 import OF7StreamLadder
    cfg = OF7Config(enabled_features=("zero_print",))
    engine = OF7Engine(cfg)
    for i in range(20):
        ladder = OF7StreamLadder(cfg)
        ladder.add_tick(100, 10, 99, 100)
        ladder.add_tick(101, 10, 100, 101)
        sample = ladder.snapshot(i * 60000, "s", is_closed=True,
                                 source="synthetic", source_contract="GC test")
        snapshot = engine.update(sample, observed_at=(i + 1) * 60000,
                                 calculated_frame=ladder.frame(sample))
        assert bool(snapshot.signals) == (i >= 2)
        assert snapshot.frame.poc == ladder.poc
        assert snapshot.calculation_basis == "supplied_calculated_frame"
        assert "aggregate_ladder_cannot_recover_tick_order_poc_and_incremental_va" not in snapshot.warnings


def test_research_corrections_are_separate_from_dll_compatibility():
    engine = OF7Engine(OF7Config(enabled_features=("ratio_price_defense",)))
    snapshot = engine.update(bar(reference_bar_index=100,
                                 cells=(OF7Cell(100, 0, 10), OF7Cell(101, 5, 10))),
                             observed_at=60000)
    assert snapshot.signals[0].feature == "ratio_price_defense"
    assert snapshot.analysis_signals == ()
    assert snapshot.measurements["ratio_denominator"] == 0
    assert snapshot.research_policy_version == "of7-corrections-v1"


def test_reference_index_gap_cannot_fabricate_a_previous_bar():
    engine = OF7Engine()
    engine.update(bar(reference_bar_index=10), observed_at=60000)
    with pytest.raises(ValueError, match="index gap"):
        engine.update(bar(time=60000, reference_bar_index=100), observed_at=120000)
    snapshot = engine.update(bar(time=60000, reference_bar_index=11), observed_at=120000)
    assert snapshot.frame.bar.reference_bar_index == 11


def test_missing_quote_volume_is_observable_and_never_invented_as_between():
    from app.orderflow7 import OF7StreamLadder
    cfg = OF7Config()
    ladder = OF7StreamLadder(cfg)
    ladder.add_tick(100, 10, None, None)
    sample = ladder.snapshot(0, "s", is_closed=True, source="test", source_contract="GC test")
    snapshot = OF7Engine(cfg).update(sample, observed_at=60000, calculated_frame=ladder.frame(sample))
    assert snapshot.measurements["observed_volume"] == 10
    assert snapshot.measurements["unclassified_volume"] == 10
    assert snapshot.measurements["between_volume"] == 0
    assert "unclassified_trade_volume_present" in snapshot.warnings
