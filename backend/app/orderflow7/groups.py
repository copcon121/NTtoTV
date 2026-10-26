"""Mechanistic OF7 taxonomy; group names describe observations, not outcomes.

The six primary groups partition the 33 feature IDs. Secondary tags can overlap
and must not be counted as independent evidence or used as future-price labels.
See OF7-SIGNAL-GROUPS.md for the full trigger/interpretation review.
"""

from .config import FEATURES


GROUPS: dict[str, tuple[str, ...]] = {
    "candle_delta": (
        "delta_divergence", "price_action_divergence", "delta_tail",
        "market_weakness", "delta_breakout",
    ),
    "extreme_volume": (
        "tails", "exhaustion_prints", "ratio_price_defense", "ratio_price_exhaustion",
        "zero_print", "volume_decline", "retail_suck",
    ),
    "imbalance_structure": (
        "imbalance_reversal", "inverse_imbalance", "stacked_imbalance",
        "multiple_imbalances", "imbalance_reload",
    ),
    "volume_distribution": (
        "market_sweep", "thin_prints", "orderflows_sequencing", "vertical_liquidity",
        "resting_liquidity", "accumulation_distribution",
    ),
    "poc_structure": (
        "prominent_poc_level_1", "prominent_poc_level_2", "prominent_poc_level_3",
        "poc_slingshot", "poc_wave", "open_poc", "aligned_poc",
    ),
    "value_area_structure": (
        "value_area", "engulfing_value_area", "orderflows_gaps",
    ),
}

# Tags state the measurable relation or data requirement. Terms such as
# "absorption", "exhaustion", "trapped", "reversal" or "continuation" would
# encode interpretations that these aggregate ladder triggers cannot prove.
FEATURE_TAGS: dict[str, tuple[str, ...]] = {
    "delta_divergence": ("candle_delta_alignment", "optional_session_extreme"),
    "price_action_divergence": ("candle_delta_opposition", "optional_session_extreme"),
    "delta_tail": ("cell_delta_sign_pattern", "bar_extreme", "price_axis_pattern"),
    "market_weakness": ("delta_sign_sequence", "delta_magnitude_contraction", "multi_bar"),
    "delta_breakout": ("delta_sign_alignment", "delta_acceleration", "multi_bar"),
    "tails": ("zero_side_volume", "bar_extreme", "adjacent_cells"),
    "exhaustion_prints": ("small_positive_side_volume", "bar_extreme"),
    "ratio_price_defense": ("adjacent_side_volume_ratio", "low_ratio", "bar_extreme"),
    "ratio_price_exhaustion": ("adjacent_side_volume_ratio", "high_ratio", "bar_extreme"),
    "zero_print": ("zero_side_volume", "bar_extreme"),
    "volume_decline": ("side_volume_gradient", "bar_extreme", "price_axis_pattern"),
    "retail_suck": ("side_volume_gradient", "bar_extreme", "price_axis_pattern"),
    "imbalance_reversal": ("diagonal_imbalance", "bar_extreme", "opposite_candle_side"),
    "inverse_imbalance": ("diagonal_imbalance", "adjacent_cluster", "opposite_candle_side"),
    "stacked_imbalance": ("diagonal_imbalance", "adjacent_cluster", "aligned_candle_side"),
    "multiple_imbalances": ("diagonal_imbalance", "bar_wide_count", "aligned_candle_side"),
    "imbalance_reload": ("diagonal_imbalance", "same_price_recurrence", "multi_bar"),
    "market_sweep": ("small_side_volume", "adjacent_cluster", "price_axis_pattern"),
    "thin_prints": ("small_side_volume", "interior_cell"),
    "orderflows_sequencing": ("side_volume_gradient", "adjacent_cluster", "price_axis_pattern"),
    "vertical_liquidity": ("large_side_volume", "adjacent_cluster", "price_axis_pattern"),
    "resting_liquidity": ("large_side_volume", "same_price_recurrence", "multi_bar"),
    "accumulation_distribution": ("side_poc_volume_comparison", "asymmetric_legacy_condition"),
    "prominent_poc_level_1": ("poc_extreme_distance", "exclusive_level_priority"),
    "prominent_poc_level_2": ("poc_extreme_distance", "exclusive_level_priority"),
    "prominent_poc_level_3": ("poc_extreme_distance", "exclusive_level_priority", "lookback_extreme"),
    "poc_slingshot": ("poc_displacement", "same_color_candles", "multi_bar"),
    "poc_wave": ("poc_ordering_pattern", "candle_color_sequence", "multi_bar"),
    "open_poc": ("poc_outside_prior_range", "multi_bar"),
    "aligned_poc": ("same_poc_price", "multi_bar"),
    "value_area": ("fixed_level_output", "volume_distribution_area"),
    "engulfing_value_area": ("value_area_expansion", "multi_bar"),
    "orderflows_gaps": ("nonoverlapping_value_areas", "multi_bar"),
}

_FEATURE_GROUP = {feature: group for group, members in GROUPS.items() for feature in members}


def group_for(feature: str) -> str:
    """Return the single primary group; reject unknown feature IDs."""
    return _FEATURE_GROUP[feature]


def feature_groups() -> dict[str, dict[str, str | tuple[str, ...]]]:
    """Return a fresh export mapping in canonical feature order."""
    return {
        feature: {"primary": group_for(feature), "tags": FEATURE_TAGS[feature]}
        for feature in FEATURES
    }
