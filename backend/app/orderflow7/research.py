"""Explicit corrections for research, separate from the original OF7 rules.

This policy is our chosen behavior, not a claim of DLL equivalence or trading
edge. Keep compatibility observations beside these outputs so each correction
can be audited. Normalized zone directions already live in OF7Signal.side;
original_series always remains the original DLL series name for provenance.
"""

from collections.abc import Sequence
from dataclasses import replace

from .config import OF7Config
from .models import OF7Frame, OF7Signal
from .signals import _swing, detect_signals


RESEARCH_POLICY_VERSION = "of7-corrections-v1"
RESEARCH_CORRECTIONS = (
    "accumulation_buy_requires_bid_poc_gt_ask_poc_and_optional_second_bid",
    "ratio_defense_requires_positive_denominator",
    "stacked_direction_requires_matching_candle_direction",
    "inverse_and_stacked_swing_filters_are_independent",
    "vertical_swing_excludes_current_bar_from_extreme_comparison",
)


def research_signals(
    frames: Sequence[OF7Frame], config: OF7Config, *, bar_index: int | None = None,
    current_bar_index: int | None = None,
) -> tuple[OF7Signal, ...]:
    """Evaluate corrected research rules without changing compatibility rules.

    Corrections remove ill-supported outputs or repair explicit filter bugs;
    they introduce no future data, forecast labels, probabilities, or orders.
    Other original quirks (including startup gates and sparse-row semantics)
    stay unchanged. A policy version must accompany persisted results.
    """
    original = detect_signals(frames, config, bar_index=bar_index,
                              current_bar_index=current_bar_index)
    if not frames:
        return ()
    frame = frames[-1]
    bar = frame.bar
    cells = {cell.price: cell for cell in bar.cells}
    corrected: list[OF7Signal] = []

    def mark(signal: OF7Signal, correction: str) -> OF7Signal:
        return replace(signal, warnings=signal.warnings + (
            f"research_policy:{RESEARCH_POLICY_VERSION}", correction,
        ))

    for signal in original:
        if signal.feature in {"inverse_imbalance", "stacked_imbalance"}:
            continue  # Re-evaluate independently below, avoiding shared return.
        if signal.feature == "accumulation_distribution" and signal.side == "buy":
            bid_poc = cells.get(frame.poc_bid)
            ask_poc = cells.get(frame.poc_ask)
            if bid_poc is None or ask_poc is None:
                continue
            second_bid = sorted((cell.bid for cell in bar.cells), reverse=True)[1] if len(cells) > 1 else 0
            if bid_poc.bid <= ask_poc.ask:
                continue
            if config.passive_traders_in_control and second_bid <= ask_poc.ask:
                continue
            signal = mark(signal, "research_accumulation_buy_uses_symmetric_and_condition")
        if (signal.feature == "ratio_price_defense"
                and signal.metrics.get("denominator", 0) <= 0):
            continue
        corrected.append(signal)

    for feature in ("inverse_imbalance", "stacked_imbalance"):
        if feature not in config.enabled_features:
            continue
        independent = replace(config, enabled_features=(feature,))
        for signal in detect_signals(frames, independent, bar_index=bar_index,
                                     current_bar_index=current_bar_index):
            if feature == "stacked_imbalance" and (
                (signal.side == "sell" and not bar.down)
                or (signal.side == "buy" and not bar.up)
            ):
                continue
            corrected.append(mark(signal, "research_imbalance_swing_filters_are_independent"))

    feature = "vertical_liquidity"
    if feature in config.enabled_features and feature in config.lookback_features:
        # Reuse the conventional, older-bars-only swing comparison. Unlike the
        # DLL's VerticalLiquidity-specific MAX/MIN, it excludes the current bar.
        # _swing also preserves the base startup gate even when filters are off.
        if _swing(frames, config, feature, bar_index=bar_index,
                  current_bar_index=current_bar_index):
            independent = replace(config, enabled_features=(feature,),
                                  lookback_features=tuple(f for f in config.lookback_features if f != feature))
            for signal in detect_signals(frames, independent, bar_index=bar_index,
                                         current_bar_index=current_bar_index):
                corrected.append(mark(signal, "research_vertical_swing_excludes_current_bar"))

    return tuple(corrected)
