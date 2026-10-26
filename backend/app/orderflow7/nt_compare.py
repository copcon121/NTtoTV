"""Compare an OF7AuditExportAddOn JSON export with reconstructed detectors.

This validates detector outputs against captured BarData/series, not the tick
processor, POC/VA calculations, live timing, zones, or untriggered features.
Choose the evaluation indexing explicitly; the tool never chooses a best mode.
"""

from __future__ import annotations

import argparse
from dataclasses import asdict, replace
from decimal import Decimal
import json
import math
from pathlib import Path
import re
from typing import Any

from .config import FEATURES, OF7Config, REFERENCE_SHA256
from .engine import build_frame, measurements
from .models import OF7Bar, OF7Cell
from .signals import _swing, detect_signals
from .unfinished import OF7UnfinishedTracker


ENABLE_SETTINGS: dict[str, tuple[str, ...]] = {
    "EnableAccumulationDistribution": ("accumulation_distribution",),
    "EnableProminentPocLevel1": ("prominent_poc_level_1",),
    "EnableProminentPocLevel2": ("prominent_poc_level_2",),
    "EnableProminentPocLevel3": ("prominent_poc_level_3",),
    "EnableTails": ("tails",), "EnableDeltaDivergence": ("delta_divergence",),
    "EnableExhaustionPrints": ("exhaustion_prints",),
    "EnableImbalanceReversal": ("imbalance_reversal",),
    "EnableInverseVolumeImbalance": ("inverse_imbalance",),
    "EnableStackedImbalance": ("stacked_imbalance",),
    "EnableMarketSweep": ("market_sweep",), "EnableMarketWeakness": ("market_weakness",),
    "EnableOrderflowsSequencing": ("orderflows_sequencing",),
    "EnableOrderflowsRatio": ("ratio_price_defense", "ratio_price_exhaustion"),
    "EnablePocSlingshot": ("poc_slingshot",), "EnableZeroPrint": ("zero_print",),
    "EnableValueArea": ("value_area",), "EnableEngulfingValueArea": ("engulfing_value_area",),
    "EnableThinPrints": ("thin_prints",), "EnableMultipleImbalances": ("multiple_imbalances",),
    "EnableOpenPOC": ("open_poc",), "EnableAlignedPOC": ("aligned_poc",),
    "EnableOrderflowsGaps": ("orderflows_gaps",), "EnableImbalanceReload": ("imbalance_reload",),
    "EnableVolumeDecline": ("volume_decline",), "EnablePOCWave": ("poc_wave",),
    "EnableDeltaTail": ("delta_tail",), "EnableDeltaBreakout": ("delta_breakout",),
    "EnableRetailSuck": ("retail_suck",), "EnableRestingLiquidity": ("resting_liquidity",),
    "EnableVerticalLiquidity": ("vertical_liquidity",),
    "EnablePriceActionDivergence": ("price_action_divergence",),
}

PARAMETER_SETTINGS = {
    "LadderTickSize": "tick_size", "ValueAreaInPercent": "value_area_percent",
    "ImbalanceInPercent": "imbalance_in_percent", "MinimalImbalanceVolume": "minimal_imbalance_volume",
    "GlobalLookBackPeriod": "global_lookback_period",
    "AccumulationDistributionPassiveTradersInControl": "passive_traders_in_control",
    "TailsCheckEva": "tails_check_eva", "TailsCheckHhLl": "tails_check_hh_ll",
    "DeltaDivergenceOnlyDailyHighLow": "delta_divergence_only_daily_high_low",
    "PriceActionDivergenceOnlyDailyHighLow": "price_action_divergence_only_daily_high_low",
    "ExhaustionPrintsSizeLimit": "exhaustion_prints_size_limit",
    "ImbalanceReversalMinimalVolume": "imbalance_reversal_minimal_volume",
    "MarketSweepClusterSize": "market_sweep_cluster_size", "MarketSweepVolumeThreshold": "market_sweep_volume_threshold",
    "MarketWeaknessSequenceLength": "market_weakness_sequence_length",
    "OrderflowsSequencingClusterSize": "orderflows_sequencing_cluster_size",
    "ThinPrintsMaximumVolume": "thin_prints_maximum_volume", "MultipleThinPrintsThreshold": "multiple_thin_prints_threshold",
    "RatioBoundsLow": "ratio_bounds_low", "RatioBoundsHigh": "ratio_bounds_high",
    "ExtremeImbalanceThreshold": "extreme_imbalance_threshold",
    "InverseVolumeImbalanceClusterSize": "inverse_imbalance_cluster_size", "ImbalanceClusterSize": "stacked_imbalance_cluster_size",
    "OpenPOCLookBackBars": "open_poc_lookback_bars", "DeltaBreakoutThreshold": "delta_breakout_threshold",
    "RestingLiquidityThreshold": "resting_liquidity_threshold",
    "VerticalLiquidityThreshold": "vertical_liquidity_threshold", "VerticalLiquidityClusterSize": "vertical_liquidity_cluster_size",
}

LOOKBACK_SETTINGS = {
    "AccumulationDistributionUseLookBack": ("accumulation_distribution",), "TailsUseLookBack": ("tails",),
    "DeltaDivergenceUseLookBack": ("delta_divergence",), "ExhaustionPrintsUseLookBack": ("exhaustion_prints",),
    "ImbalanceReversalUseLookBack": ("imbalance_reversal",), "MarketSweepUseLookBack": ("market_sweep",),
    "MarketWeaknessUseLookBack": ("market_weakness",), "OrderflowsSequencingUseLookBack": ("orderflows_sequencing",),
    "PocSlingshotUseLookBack": ("poc_slingshot",), "ZeroPrintUseLookBack": ("zero_print",),
    "ThinPrintsUseLookBack": ("thin_prints",), "StackedImbalanceUseLookBack": ("stacked_imbalance",),
    "InverseVolumeImbalanceUseLookBack": ("inverse_imbalance",),
    "OrderflowsRatioUseLookBack": ("ratio_price_defense", "ratio_price_exhaustion"),
    "MultipleImbalancesUseLookBack": ("multiple_imbalances",), "OrderflowsGapsUseLookBack": ("orderflows_gaps",),
    "VolumeDeclineUseLookBack": ("volume_decline",), "POCWaveUseLookBack": ("poc_wave",),
    "DeltaTailUseLookBack": ("delta_tail",), "DeltaBreakoutUseLookBack": ("delta_breakout",),
    "RetailSuckUseLookBack": ("retail_suck",), "RestingLiquidityUseLookBack": ("resting_liquidity",),
    "VerticalLiquidityUseLookBack": ("vertical_liquidity",),
    "PriceActionDivergenceUseLookBack": ("price_action_divergence",),
}

_FEATURE_PARAMETERS = {
    "accumulation_distribution": ("AccumulationDistributionPassiveTradersInControl",),
    "tails": ("TailsCheckEva", "TailsCheckHhLl"),
    "delta_divergence": ("DeltaDivergenceOnlyDailyHighLow",),
    "price_action_divergence": ("PriceActionDivergenceOnlyDailyHighLow",),
    "exhaustion_prints": ("ExhaustionPrintsSizeLimit",),
    "imbalance_reversal": ("ImbalanceReversalMinimalVolume",),
    "market_sweep": ("MarketSweepClusterSize", "MarketSweepVolumeThreshold"),
    "market_weakness": ("MarketWeaknessSequenceLength",),
    "orderflows_sequencing": ("OrderflowsSequencingClusterSize",),
    "thin_prints": ("ThinPrintsMaximumVolume",),
    "ratio_price_defense": ("RatioBoundsLow", "RatioBoundsHigh"),
    "ratio_price_exhaustion": ("RatioBoundsLow", "RatioBoundsHigh"),
    "multiple_imbalances": ("ExtremeImbalanceThreshold",),
    "inverse_imbalance": ("InverseVolumeImbalanceClusterSize",),
    "stacked_imbalance": ("ImbalanceClusterSize",),
    "open_poc": ("OpenPOCLookBackBars",), "delta_breakout": ("DeltaBreakoutThreshold",),
    "resting_liquidity": ("RestingLiquidityThreshold",),
    "vertical_liquidity": ("VerticalLiquidityThreshold", "VerticalLiquidityClusterSize"),
}

_PREFIXES = dict(zip(FEATURES, (
    "AccumulationDistribution", "ProminentPocLevel1", "ProminentPocLevel2", "ProminentPocLevel3",
    "Tails", "DeltaDivergence", "ExhaustionPrints", "ImbalanceReversal", "InverseVolumeImbalance",
    "StackedImbalance", "MarketSweep", "MarketWeakness", "OrderflowsSequencing",
    "OrderflowsRatioPxDefense", "OrderflowsRatioPxExhaustion", "PocSlingshot", "ZeroPrint", "ValueArea",
    "EngulfingValueArea", "ThinPrints", "MultipleImbalances", "OpenPOC", "AlignedPOC", "OrderflowsGaps",
    "ImbalanceReload", "VolumeDecline", "POCWave", "DeltaTail", "DeltaBreakout", "RetailSuck",
    "RestingLiquidity", "VerticalLiquidity", "PriceActionDivergence",
)))


def normalize_series(name: str) -> str:
    normalized = re.sub(r"[^a-z0-9]", "", name.lower())
    # DLL dictionary/plot keys say "Inverse Imbalance", whereas the public
    # getters (and compatibility signal provenance) say InverseVolumeImbalance.
    return normalized.replace("inversevolumeimbalance", "inverseimbalance")


_SERIES_FEATURE = {normalize_series(prefix + side): feature for feature, prefix in _PREFIXES.items()
                   for side in (("Low", "High") if feature == "value_area" else ("Buy", "Sell"))}


def _number(value: Any, field: str) -> Decimal:
    if type(value) not in (int, float, Decimal) or not Decimal(str(value)).is_finite():
        raise ValueError(f"{field} must be finite numeric data")
    return Decimal(str(value))


def _integer(value: Any, field: str) -> int:
    number = _number(value, field)
    if number != number.to_integral_value():
        raise ValueError(f"{field} must be integral")
    return int(number)


def _boolean(value: Any, field: str) -> bool:
    if type(value) is not bool:
        raise ValueError(f"{field} must be boolean")
    return value


def _ticks(value: Any, tick: Decimal, field: str) -> int:
    count = _number(value, field) / tick
    if count != count.to_integral_value():
        raise ValueError(f"{field} is not aligned to LadderTickSize")
    return int(count)


def config_from_settings(settings: dict[str, Any]) -> tuple[OF7Config, list[str]]:
    """Require all enables and all parameters relevant to enabled detectors."""
    if not isinstance(settings, dict):
        raise ValueError("settings must be an object")
    critical = set(ENABLE_SETTINGS) | {"LadderTickSize", "ValueAreaInPercent", "ImbalanceInPercent",
                                      "MinimalImbalanceVolume", "GlobalLookBackPeriod"}
    missing = critical - settings.keys()
    if missing:
        raise ValueError("missing critical settings: " + ",".join(sorted(missing)))
    enabled = tuple(f for key, features in ENABLE_SETTINGS.items()
                    if _boolean(settings[key], key) for f in features)
    for key, features in LOOKBACK_SETTINGS.items():
        if set(features).intersection(enabled):
            critical.add(key)
    for feature in enabled:
        critical.update(_FEATURE_PARAMETERS.get(feature, ()))
        match = re.fullmatch(r"prominent_poc_level_([123])", feature)
        if match:
            prefix = "ProminentPocLevel" + match.group(1)
            critical.update(prefix + suffix for suffix in ("LookBackBars", "POCDistance", "CheckDelta"))
    missing = critical - settings.keys()
    if missing:
        raise ValueError("missing enabled-feature settings: " + ",".join(sorted(missing)))
    defaults = asdict(OF7Config())
    kwargs: dict[str, Any] = {"enabled_features": enabled}
    warnings: list[str] = []
    for source, target in PARAMETER_SETTINGS.items():
        if source not in settings:
            warnings.append("defaulted_optional_setting:" + source)
            continue
        default = defaults[target]
        kwargs[target] = (_boolean(settings[source], source) if type(default) is bool else
                          _integer(settings[source], source) if type(default) is int else
                          float(_number(settings[source], source)))
    lookbacks: list[str] = []
    for source, features in LOOKBACK_SETTINGS.items():
        if source not in settings:
            warnings.append("defaulted_optional_setting:" + source)
        elif _boolean(settings[source], source):
            lookbacks.extend(features)
    kwargs["lookback_features"] = tuple(lookbacks)
    for target, suffix, boolean in (("prominent_poc_lookbacks", "LookBackBars", False),
                                    ("prominent_poc_distances", "POCDistance", False),
                                    ("prominent_poc_check_delta", "CheckDelta", True)):
        values = list(defaults[target])
        for i in range(3):
            source = f"ProminentPocLevel{i + 1}{suffix}"
            if source in settings:
                values[i] = _boolean(settings[source], source) if boolean else _integer(settings[source], source)
            else:
                warnings.append("defaulted_optional_setting:" + source)
        kwargs[target] = tuple(values)
    return OF7Config(**kwargs), warnings


def _frame(row: dict[str, Any], config: OF7Config, source_contract: str, mode: str):
    index = _integer(row["index"], "index")
    tick = Decimal(str(config.tick_size))
    cells = tuple(OF7Cell(_ticks(c["price"], tick, "cell.price"),
                          _integer(c["bid"], "cell.bid"), _integer(c["ask"], "cell.ask"),
                          _integer(c["between"], "cell.between")) for c in row["cells"])
    bar = OF7Bar(index, *(_ticks(row[key], tick, key) for key in ("Open", "High", "Low", "Close")),
                 cells=cells, session_id="captured-reference-session-flags", source="nt-of7-reference",
                 source_contract=source_contract, timeframe_ms=1, reference_bar_index=index,
                 reference_current_bar_index=index + (mode == "historical-fast"))
    for key, value in (("Volume", bar.volume), ("VolumeBid", sum(c.bid for c in cells)),
                       ("VolumeAsk", sum(c.ask for c in cells)), ("VolumeBetween", sum(c.between for c in cells)),
                       ("Delta", bar.delta)):
        if key in row and row[key] is not None and _integer(row[key], key) != value:
            raise ValueError(f"bar {index} {key} differs from captured ladder")
    flags = {key: _boolean(row[key], key) for key in ("DeltaDivergenceHigh", "DeltaDivergenceLow",
             "PriceActionDivergenceHigh", "PriceActionDivergenceLow")}
    frame = build_frame(bar, config)
    return replace(frame, poc=_ticks(row["PocPrice"], tick, "PocPrice"),
                   poc_bid=_ticks(row["PocPriceBid"], tick, "PocPriceBid"),
                   poc_ask=_ticks(row["PocPriceAsk"], tick, "PocPriceAsk"),
                   val=_ticks(row["ValueAreaLow"], tick, "ValueAreaLow"),
                   vah=_ticks(row["ValueAreaHigh"], tick, "ValueAreaHigh"),
                   is_session_high=flags["DeltaDivergenceHigh"] or flags["PriceActionDivergenceHigh"],
                   is_session_low=flags["DeltaDivergenceLow"] or flags["PriceActionDivergenceLow"])


def _series_record(value: Any, field: str) -> tuple[bool, Any]:
    if not isinstance(value, dict) or "valid" not in value:
        raise ValueError(f"{field} must contain validity")
    valid = _boolean(value["valid"], field + ".valid")
    if valid:
        _number(value.get("value"), field + ".value")
    return valid, value.get("value")


def compare_unfinished(payload: dict[str, Any], config: OF7Config) -> dict[str, Any]:
    """Compare base-level state only for origins inside the captured history."""
    if "unfinished_open" not in payload or "unfinished_finalized" not in payload:
        return {"status": "not_exported", "mismatches": 0}
    rows = payload["bars"]
    if not rows:
        return {"status": "no_comparable_data", "mismatches": 0}
    tracker = OF7UnfinishedTracker()
    expected = {}
    previous = None
    tick = Decimal(str(config.tick_size))
    state = None
    for row in rows:
        frame = _frame(row, config, payload["source_contract"], "historical-fast")
        index = frame.bar.reference_bar_index
        if previous is not None and index != previous + 1:
            return {"status": "skipped_history_gaps", "mismatches": 0}
        previous = index
        state = tracker.update(frame.bar, bar_index=index,
                               chart_high=_ticks(row["ChartHigh"], tick, "ChartHigh") if row.get("ChartHigh") is not None else None,
                               chart_low=_ticks(row["ChartLow"], tick, "ChartLow") if row.get("ChartLow") is not None else None)
        for level in state.finalized:
            expected[level.origin_index] = (level.price, level.side, level.end_index)
    for level in state.open_levels:
        expected[level.origin_index] = (level.price, level.side, None)
    actual = {}
    for key, finalized in (("unfinished_open", False), ("unfinished_finalized", True)):
        if not isinstance(payload[key], list):
            raise ValueError("unfinished level collection must be an array")
        for line in payload[key]:
            origin = _integer(line["origin_index"], "unfinished origin")
            if origin in actual:
                raise ValueError("duplicate unfinished origin index")
            if line["side"] not in ("high", "low"):
                raise ValueError("invalid unfinished side")
            end = _integer(line["end_index"], "unfinished end") if finalized else None
            actual[origin] = (_ticks(line["price"], tick, "unfinished price"), line["side"], end)
    differences = [{"origin_index": origin, "native": actual.get(origin), "reconstructed": expected.get(origin)}
                   for origin in sorted(set(actual) | set(expected)) if actual.get(origin) != expected.get(origin)]
    return {"status": "mismatch" if differences else "captured_origins_match",
            "scope": "captured_origin_indices_only_excludes_prior_levels_and_rendering",
            "origins_compared": len(set(actual) | set(expected)),
            "open_count": len(state.open_levels),
            "finalized_count": sum(value[2] is not None for value in expected.values()),
            "mismatches": len(differences), "examples": differences[:10]}


def compare_export(payload: dict[str, Any], *, mode: str) -> dict[str, Any]:
    if mode not in ("historical-fast", "realtime"):
        raise ValueError("choose mode explicitly: historical-fast or realtime")
    if payload.get("schema_version") != "of7-live-audit-v1":
        raise ValueError("unsupported native export schema")
    if str(payload.get("reference_sha256", "")).lower() != REFERENCE_SHA256:
        raise ValueError("native export does not match reference DLL SHA-256")
    config, warnings = config_from_settings(payload.get("settings"))
    rows = payload.get("bars")
    if not isinstance(rows, list):
        raise ValueError("bars must be an array")
    source_contract = payload.get("source_contract")
    if not isinstance(source_contract, str) or not source_contract:
        raise ValueError("source_contract is required")
    coverage = {feature: {"enabled": feature in config.enabled_features, "bars_compared": 0,
                         "native_valid_series": 0, "reconstructed_valid_series": 0,
                         "native_trigger_bars": 0, "reconstructed_trigger_bars": 0,
                         "mismatches": 0, "exported_series_seen": False} for feature in FEATURES}
    frames = []
    previous_index: int | None = None
    compared = skipped = series_compared = mismatch_count = ratio_compared = ratio_skipped = 0
    examples: list[dict[str, Any]] = []

    def mismatch(index: int, key: str, native: Any, reconstructed: Any, reason: str):
        nonlocal mismatch_count
        mismatch_count += 1
        feature = _SERIES_FEATURE.get(key)
        if feature:
            coverage[feature]["mismatches"] += 1
        elif reason == "raw_ratio":
            for ratio_feature in ("ratio_price_defense", "ratio_price_exhaustion"):
                coverage[ratio_feature]["mismatches"] += 1
        if len(examples) < 10:
            examples.append({"index": index, "series": key, "native": native,
                             "reconstructed": reconstructed, "reason": reason})

    for row in rows:
        frame = _frame(row, config, source_contract, mode)
        index = frame.bar.reference_bar_index
        if previous_index is not None and index <= previous_index:
            raise ValueError("bar indices must be strictly increasing")
        if previous_index is not None and index != previous_index + 1:
            frames = []
            warnings.append("missing_exported_indices_history_reset")
        previous_index = index
        frames.append(frame)
        frames = frames[-(config.required_history + 1):]
        # When export begins midway through a chart, old unavailable bars must
        # not turn history-dependent predicates into false observations.
        needed = min(config.required_history, index + 1)
        if len(frames) < needed:
            skipped += 1
            continue
        raw = row.get("series")
        if not isinstance(raw, dict):
            raise ValueError("bar series must be an object")
        actual: dict[str, tuple[bool, Any]] = {}
        tick = Decimal(str(config.tick_size))
        for name, record in raw.items():
            key = normalize_series(name)
            if key in actual:
                raise ValueError("duplicate normalized native series key")
            valid, value = _series_record(record, "series")
            actual[key] = (valid, _ticks(value, tick, "series.value") if valid else None)
            feature = _SERIES_FEATURE.get(key)
            if feature:
                coverage[feature]["exported_series_seen"] = True
                coverage[feature]["native_valid_series"] += int(valid)
        signals = detect_signals(frames, config, bar_index=index,
                                 current_bar_index=frame.bar.reference_current_bar_index)
        expected = {normalize_series(signal.original_series): signal.price for signal in signals}
        native_triggered = {_SERIES_FEATURE[key] for key, (valid, _) in actual.items()
                            if valid and key in _SERIES_FEATURE}
        reconstructed_triggered = {signal.feature for signal in signals}
        for feature in native_triggered:
            coverage[feature]["native_trigger_bars"] += 1
        for feature in reconstructed_triggered:
            coverage[feature]["reconstructed_trigger_bars"] += 1
        for key in set(actual) | set(expected):
            present = key in actual
            valid, native_value = actual.get(key, (False, None))
            reconstructed_value = expected.get(key)
            reconstructed_valid = key in expected
            series_compared += 1
            feature = _SERIES_FEATURE.get(key)
            if feature:
                coverage[feature]["reconstructed_valid_series"] += int(reconstructed_valid)
            if valid != reconstructed_valid:
                mismatch(index, key, native_value if valid else None, reconstructed_value,
                         "validity" if present else "missing_native_series")
            elif valid and native_value != reconstructed_value:
                mismatch(index, key, native_value, reconstructed_value, "signal_price_ticks")
        for feature in config.enabled_features:
            coverage[feature]["bars_compared"] += 1
        if "ratio_price_defense" in config.enabled_features and (frame.bar.up or frame.bar.down):
            key = "ratio_buy" if frame.bar.up else "ratio_sell"
            ratio_record = row.get(key)
            eligible = _swing(frames, config, "ratio_price_defense", bar_index=index,
                              current_bar_index=frame.bar.reference_current_bar_index)
            if ratio_record is not None and eligible:
                valid, native_ratio = _series_record(ratio_record, key)
                if valid:
                    ratio_compared += 1
                    value = measurements(frame)[key + "_value"]
                    if not math.isclose(float(native_ratio), value, rel_tol=1e-12, abs_tol=1e-12):
                        mismatch(index, key, float(native_ratio), value, "raw_ratio")
                else:
                    ratio_skipped += 1
            else:
                ratio_skipped += 1
        compared += 1
    for item in coverage.values():
        item["status"] = ("disabled_unverified" if not item["enabled"] else
                          "enabled_no_comparable_bars" if not item["bars_compared"] else
                          "enabled_missing_export_series" if not item["exported_series_seen"] else
                          "mismatch" if item["mismatches"] else
                          "trigger_observed_match" if item["native_valid_series"] else
                          "enabled_no_trigger_unverified")
    unfinished = compare_unfinished(payload, config)
    combined_mismatches = mismatch_count + unfinished["mismatches"]
    passed = compared > 0 and series_compared > 0 and combined_mismatches == 0
    return {"schema_version": "of7-native-comparison-v1", "mode": mode,
            "status": "no_comparable_data" if compared == 0 or series_compared == 0 else
                      "mismatch" if combined_mismatches else "compared_subset_match",
            "scope": "captured_bar_data_and_series_only_not_full_tick_or_all_feature_validation",
            "reference_sha256": REFERENCE_SHA256, "config_hash": config.fingerprint,
            "bars_exported": len(rows), "bars_compared": compared, "bars_skipped_missing_history": skipped,
            "series_compared": series_compared, "mismatches": combined_mismatches,
            "series_mismatches": mismatch_count, "unfinished_business": unfinished,
            "mismatch_examples": examples, "ratio_values_compared": ratio_compared,
            "ratio_values_skipped": ratio_skipped, "feature_coverage": coverage,
            "export_bar_error_count": len(payload.get("bar_errors", [])),
            "warnings": sorted(set(warnings)), "passed": passed}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--mode", choices=("historical-fast", "realtime"), required=True)
    args = parser.parse_args()
    try:
        payload = json.loads(args.input.read_text(encoding="utf-8"), parse_float=Decimal)
        result = compare_export(payload, mode=args.mode)
    except (KeyError, TypeError, ValueError, OSError) as exc:
        print(json.dumps({"passed": False, "error": str(exc)}, separators=(",", ":")))
        raise SystemExit(2)
    print(json.dumps(result, separators=(",", ":"), allow_nan=False))
    raise SystemExit(0 if result["passed"] else 1)


if __name__ == "__main__":
    main()
