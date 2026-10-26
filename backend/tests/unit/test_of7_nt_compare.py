"""Native export comparator rejects missing context and compares actual series."""

from copy import deepcopy
from dataclasses import asdict
from decimal import Decimal

import pytest

from app.orderflow7.config import FEATURES, OF7Config, REFERENCE_SHA256
from app.orderflow7.nt_compare import (
    ENABLE_SETTINGS, LOOKBACK_SETTINGS, PARAMETER_SETTINGS,
    compare_export, config_from_settings, normalize_series,
)


pytestmark = pytest.mark.unit


def settings(enabled=("value_area",)):
    defaults = asdict(OF7Config())
    result = {key: bool(set(features).intersection(enabled)) for key, features in ENABLE_SETTINGS.items()}
    result.update({key: defaults[target] for key, target in PARAMETER_SETTINGS.items()})
    result.update({key: False for key in LOOKBACK_SETTINGS})
    for i in range(3):
        for target, suffix in (("prominent_poc_lookbacks", "LookBackBars"),
                               ("prominent_poc_distances", "POCDistance"),
                               ("prominent_poc_check_delta", "CheckDelta")):
            result[f"ProminentPocLevel{i + 1}{suffix}"] = defaults[target][i]
    return result


def row(index=0):
    return {
        "index": index, "Open": 4000.0, "High": 4000.2, "Low": 4000.0, "Close": 4000.2,
        "PocPrice": 4000.2, "PocPriceBid": 4000.0, "PocPriceAsk": 4000.2,
        "ValueAreaLow": 4000.1, "ValueAreaHigh": 4000.2,
        "DeltaDivergenceHigh": False, "DeltaDivergenceLow": False,
        "PriceActionDivergenceHigh": False, "PriceActionDivergenceLow": False,
        "cells": [{"price": 4000.0, "bid": 10, "ask": 1, "between": 0},
                  {"price": 4000.1, "bid": 20, "ask": 1, "between": 0},
                  {"price": 4000.2, "bid": 1, "ask": 10, "between": 0}],
        "series": {"Value Area Low": {"valid": True, "value": 4000.1},
                   "Value Area High": {"valid": True, "value": 4000.2}},
        "ratio_buy": None, "ratio_sell": None,
    }


def payload(rows=None, enabled=("value_area",)):
    return {"schema_version": "of7-live-audit-v1", "reference_sha256": REFERENCE_SHA256,
            "source_contract": "GC test", "settings": settings(enabled),
            "bars": [row()] if rows is None else rows}


def test_known_native_levels_are_used_instead_of_recomputed_value_area():
    # Largest total cell is 4000.1, whereas actual captured POC is 4000.2.
    # The comparator intentionally tests detectors using the captured inputs.
    result = compare_export(payload(), mode="historical-fast")
    assert result["passed"]
    assert result["bars_compared"] == 1
    assert result["mismatches"] == 0
    assert result["feature_coverage"]["value_area"]["native_valid_series"] == 2
    assert result["feature_coverage"]["value_area"]["native_trigger_bars"] == 1
    assert result["feature_coverage"]["tails"]["status"] == "disabled_unverified"


def test_all_enable_settings_map_exactly_once_and_ratio_maps_two_outputs():
    native = settings(FEATURES)
    native["RestingLiquidityUseLookBack"] = True
    native["VerticalLiquidityUseLookBack"] = True
    config, warnings = config_from_settings(native)
    assert set(config.enabled_features) == set(FEATURES)
    assert len(config.enabled_features) == 33
    assert config.lookback_features == ("resting_liquidity", "vertical_liquidity")
    assert warnings == []


def test_native_inverse_plot_name_matches_public_getter_name_and_coverage():
    samples = []
    for index in range(3):
        sample = row(index)
        sample["cells"] = [
            {"price": 4000.0, "bid": 40, "ask": 1, "between": 0},
            {"price": 4000.1, "bid": 40, "ask": 1, "between": 0},
            {"price": 4000.2, "bid": 1, "ask": 1, "between": 0},
        ]
        sample["series"] = {"Inverse Imbalance Buy": {"valid": index == 2, "value": 4000.0 if index == 2 else None},
                            "Inverse Imbalance Sell": {"valid": False, "value": None}}
        samples.append(sample)
    assert normalize_series("InverseVolumeImbalanceBuy") == normalize_series("Inverse Imbalance Buy")
    result = compare_export(payload(samples, enabled=("inverse_imbalance",)), mode="realtime")
    assert result["passed"]
    assert result["feature_coverage"]["inverse_imbalance"]["native_trigger_bars"] == 1
    assert result["feature_coverage"]["inverse_imbalance"]["status"] == "trigger_observed_match"


def test_base_unfinished_state_is_compared_independently_of_display_toggle():
    samples = [row(i) for i in range(3)]
    samples[2]["High"] = samples[2]["Close"] = 4000.3
    samples[2]["cells"].append({"price": 4000.3, "bid": 0, "ask": 2, "between": 0})
    sample = payload(samples)
    sample["unfinished_open"] = []
    sample["unfinished_finalized"] = [{"origin_index": 1, "price": 4000.2, "side": "high", "end_index": 2}]
    result = compare_export(sample, mode="historical-fast")
    assert result["passed"]
    assert result["unfinished_business"]["origins_compared"] == 1
    assert result["unfinished_business"]["finalized_count"] == 1
    sample["unfinished_finalized"][0]["end_index"] = 1
    result = compare_export(sample, mode="historical-fast")
    assert not result["passed"]
    assert result["unfinished_business"]["mismatches"] == 1


@pytest.mark.parametrize("field", ["EnableTails", "LadderTickSize", "GlobalLookBackPeriod"])
def test_missing_critical_setting_rejected(field):
    native = settings()
    del native[field]
    with pytest.raises(ValueError, match="missing critical"):
        config_from_settings(native)


def test_missing_enabled_feature_parameter_rejected_optional_default_is_reported():
    native = settings(("tails",))
    del native["TailsCheckEva"]
    with pytest.raises(ValueError, match="missing enabled-feature"):
        config_from_settings(native)
    native = settings()
    del native["TailsCheckEva"]
    _, warnings = config_from_settings(native)
    assert "defaulted_optional_setting:TailsCheckEva" in warnings


@pytest.mark.parametrize("field,value", [("EnableTails", 0), ("MinimalImbalanceVolume", 1.1),
                                         ("LadderTickSize", "0.1"), ("TailsCheckEva", "false")])
def test_native_settings_do_not_coerce_strings_booleans_or_fractional_integers(field, value):
    native = settings()
    native[field] = value
    with pytest.raises(ValueError):
        config_from_settings(native)


@pytest.mark.parametrize("field,value", [("schema_version", "other"), ("reference_sha256", "0" * 64)])
def test_schema_and_reference_hash_are_pinned(field, value):
    sample = payload()
    sample[field] = value
    with pytest.raises(ValueError):
        compare_export(sample, mode="realtime")


def test_validity_and_signal_price_are_both_compared():
    sample = payload()
    sample["bars"][0]["series"]["Value Area Low"]["value"] = 4000.0
    result = compare_export(sample, mode="realtime")
    assert result["mismatches"] == 1
    assert result["mismatch_examples"][0]["reason"] == "signal_price_ticks"
    sample["bars"][0]["series"]["Value Area Low"] = {"valid": False, "value": None}
    result = compare_export(sample, mode="realtime")
    assert result["mismatch_examples"][0]["reason"] == "validity"


def test_normalization_removes_spacing_slashes_and_punctuation():
    assert normalize_series("Orderflows Ratio Px Defense / Buy") == "orderflowsratiopxdefensebuy"
    sample = payload()
    sample["bars"][0]["series"] = {"Value Area / Low": {"valid": True, "value": 4000.1},
                                     "Value-Area.High": {"valid": True, "value": 4000.2}}
    assert compare_export(sample, mode="realtime")["passed"]


def test_truncated_export_skips_missing_history_and_does_not_invent_inactive_results():
    count = OF7Config().required_history
    result = compare_export(payload([row(i) for i in range(100, 100 + count)]), mode="realtime")
    assert result["bars_skipped_missing_history"] == count - 1
    assert result["bars_compared"] == 1
    result = compare_export(payload([row(100)]), mode="realtime")
    assert not result["passed"]
    assert result["bars_compared"] == 0


def test_gaps_reset_history_and_out_of_order_export_rejected():
    sample = payload([row(0), row(10)])
    result = compare_export(sample, mode="realtime")
    assert result["bars_compared"] == 1
    assert result["bars_skipped_missing_history"] == 1
    assert "missing_exported_indices_history_reset" in result["warnings"]
    with pytest.raises(ValueError, match="strictly increasing"):
        compare_export(payload([row(0), row(0)]), mode="realtime")


def test_enabled_but_untriggered_feature_is_not_claimed_as_validated():
    sample = payload(enabled=("ratio_price_defense", "ratio_price_exhaustion"))
    sample["bars"] = [row(i) for i in range(3)]
    for item in sample["bars"]:
        item["series"] = {"Orderflows Ratio Px Defense Buy": {"valid": False, "value": None},
                          "Orderflows Ratio Px Exhaustion Buy": {"valid": False, "value": None}}
        item["ratio_buy"] = {"valid": True, "value": 2}
    result = compare_export(sample, mode="realtime")
    assert result["passed"]
    assert result["ratio_values_compared"] == 1  # CurrentBar > 1 base gate
    assert result["feature_coverage"]["ratio_price_defense"]["status"] == "enabled_no_trigger_unverified"
    sample["bars"][-1]["ratio_buy"]["value"] = 3
    result = compare_export(sample, mode="realtime")
    assert not result["passed"]
    assert result["mismatch_examples"][0]["reason"] == "raw_ratio"


def test_duplicate_series_normalization_and_invalid_price_grid_rejected():
    sample = payload()
    sample["bars"][0]["series"]["Value-Area-Low"] = {"valid": False, "value": None}
    with pytest.raises(ValueError, match="duplicate normalized"):
        compare_export(sample, mode="realtime")
    sample = payload()
    sample["bars"][0]["PocPrice"] = Decimal("4000.21")
    with pytest.raises(ValueError, match="aligned"):
        compare_export(sample, mode="realtime")


def test_mode_is_explicit_and_early_bar_gate_can_differ_by_mode():
    with pytest.raises(ValueError, match="choose mode explicitly"):
        compare_export(payload(), mode="auto")
    # PriceActionDivergence runs on barIndex>0 and DetectSwing CurrentBar>1.
    sample = payload([row(0), row(1)], enabled=("price_action_divergence",))
    for item in sample["bars"]:
        item["series"] = {"Price Action Divergence Buy": {"valid": item["index"] == 1,
                                                           "value": 4000.0 if item["index"] == 1 else None}}
    assert compare_export(sample, mode="historical-fast")["passed"]
    assert not compare_export(sample, mode="realtime")["passed"]


def test_zero_bars_are_no_comparable_data_not_parity_success():
    result = compare_export(payload([]), mode="historical-fast")
    assert result["status"] == "no_comparable_data"
    assert result["bars_compared"] == 0
    assert not result["passed"]
