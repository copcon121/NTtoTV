"""Calculation parameters from the OFT 7.0.1.0 static-analysis report.

These are research settings, independent of the existing MZ footprint engine.
Rendering (colors, opacity, arrow spacing) is deliberately outside this module.
"""

from dataclasses import asdict, dataclass
import hashlib
import json
import math


FEATURES = (
    "accumulation_distribution", "prominent_poc_level_1", "prominent_poc_level_2",
    "prominent_poc_level_3", "tails", "delta_divergence", "exhaustion_prints",
    "imbalance_reversal", "inverse_imbalance", "stacked_imbalance", "market_sweep",
    "market_weakness", "orderflows_sequencing", "ratio_price_defense",
    "ratio_price_exhaustion", "poc_slingshot", "zero_print", "value_area",
    "engulfing_value_area", "thin_prints", "multiple_imbalances", "open_poc",
    "aligned_poc", "orderflows_gaps", "imbalance_reload", "volume_decline",
    "poc_wave", "delta_tail", "delta_breakout", "retail_suck", "resting_liquidity",
    "vertical_liquidity", "price_action_divergence",
)
DEFAULT_FEATURES = (
    "prominent_poc_level_1", "prominent_poc_level_2", "prominent_poc_level_3",
    "delta_divergence", "stacked_imbalance", "ratio_price_defense",
    "ratio_price_exhaustion", "value_area", "engulfing_value_area",
)
REFERENCE_SHA256 = "d47bbcfad05978a3864297e6a569f99be736984ac474c58ab31065e4a4f07cce"


@dataclass(frozen=True, slots=True)
class OF7Config:
    tick_size: float = 0.1
    value_area_percent: float = 70.0
    imbalance_in_percent: float = 400.0  # 400 means 4x, NOT 1 + 400/100.
    minimal_imbalance_volume: int = 10
    enabled_features: tuple[str, ...] = DEFAULT_FEATURES
    lookback_features: tuple[str, ...] = ()
    global_lookback_period: int = 5
    passive_traders_in_control: bool = False
    tails_check_eva: bool = False
    tails_check_hh_ll: bool = False
    delta_divergence_only_daily_high_low: bool = True
    price_action_divergence_only_daily_high_low: bool = False
    exhaustion_prints_size_limit: int = 9
    imbalance_reversal_minimal_volume: int = 10
    market_sweep_cluster_size: int = 3
    market_sweep_volume_threshold: int = 5
    market_weakness_sequence_length: int = 3
    orderflows_sequencing_cluster_size: int = 5
    prominent_poc_lookbacks: tuple[int, ...] = (0, 0, 3)
    prominent_poc_distances: tuple[int, ...] = (1, 2, 3)
    prominent_poc_check_delta: tuple[bool, ...] = (False, False, False)
    thin_prints_maximum_volume: int = 1
    multiple_thin_prints_threshold: int = 3
    ratio_bounds_low: float = 0.69
    ratio_bounds_high: float = 30.0
    extreme_imbalance_threshold: int = 3
    inverse_imbalance_cluster_size: int = 2
    stacked_imbalance_cluster_size: int = 3
    open_poc_lookback_bars: int = 5
    delta_breakout_threshold: int = 200
    resting_liquidity_threshold: int = 200
    vertical_liquidity_threshold: int = 250
    vertical_liquidity_cluster_size: int = 3

    def __post_init__(self) -> None:
        # Normalize JSON arrays so caller mutation cannot alter a running config.
        for name in ("enabled_features", "lookback_features", "prominent_poc_lookbacks",
                     "prominent_poc_distances", "prominent_poc_check_delta"):
            object.__setattr__(self, name, tuple(getattr(self, name)))
        for names in (self.enabled_features, self.lookback_features):
            if len(set(names)) != len(names) or not set(names) <= set(FEATURES):
                raise ValueError("unknown or duplicate OF7 feature")
        for name, value in asdict(self).items():
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                if not math.isfinite(value) or value < 0:
                    raise ValueError(f"{name} must be finite and nonnegative")
        for name in ("minimal_imbalance_volume", "exhaustion_prints_size_limit",
                     "imbalance_reversal_minimal_volume", "market_sweep_volume_threshold",
                     "thin_prints_maximum_volume", "delta_breakout_threshold",
                     "resting_liquidity_threshold", "vertical_liquidity_threshold"):
            if type(getattr(self, name)) is not int:
                raise ValueError(f"{name} must be an integer")
        for name in ("passive_traders_in_control", "tails_check_eva", "tails_check_hh_ll",
                     "delta_divergence_only_daily_high_low",
                     "price_action_divergence_only_daily_high_low"):
            if type(getattr(self, name)) is not bool:
                raise ValueError(f"{name} must be boolean")
        if self.tick_size <= 0 or not 0 < self.value_area_percent <= 100:
            raise ValueError("tick_size must be positive; value area must be in (0,100]")
        if self.imbalance_in_percent <= 0 or self.ratio_bounds_high <= self.ratio_bounds_low:
            raise ValueError("invalid imbalance or ratio bounds")
        for name in ("global_lookback_period", "market_sweep_cluster_size",
                     "market_weakness_sequence_length", "orderflows_sequencing_cluster_size",
                     "multiple_thin_prints_threshold", "extreme_imbalance_threshold",
                     "inverse_imbalance_cluster_size", "stacked_imbalance_cluster_size",
                     "open_poc_lookback_bars", "vertical_liquidity_cluster_size"):
            value = getattr(self, name)
            if type(value) is not int or value < 1:
                raise ValueError(f"{name} must be a positive integer")
        for name, minimum in (("prominent_poc_lookbacks", 0), ("prominent_poc_distances", 1)):
            values = getattr(self, name)
            if len(values) != 3 or any(type(v) is not int or v < minimum for v in values):
                raise ValueError(f"{name} must contain three integers >= {minimum}")
        if len(self.prominent_poc_check_delta) != 3 or any(
            type(v) is not bool for v in self.prominent_poc_check_delta
        ):
            raise ValueError("prominent_poc_check_delta must contain three booleans")

    @classmethod
    def research(cls, **overrides: object) -> "OF7Config":
        return cls(**{"enabled_features": FEATURES, **overrides})

    @property
    def fingerprint(self) -> str:
        encoded = json.dumps(asdict(self), sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(encoded.encode("ascii")).hexdigest()

    @property
    def required_history(self) -> int:
        return max(4, self.global_lookback_period + 3, self.open_poc_lookback_bars + 1,
                   self.market_weakness_sequence_length + 2, max(self.prominent_poc_lookbacks) + 1)
