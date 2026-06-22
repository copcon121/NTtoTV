"""Read-only SMC baseline research helpers."""

__all__ = [
    "BaselineBar",
    "BaselineConfig",
    "EqualLevel",
    "TradeResult",
    "Zone",
    "confirmation_pattern",
    "detect_equal_high",
    "detect_equal_low",
    "detect_sweep_hunt",
    "engulfing_signal",
    "is_first_fvg_for_leg",
    "is_outside_bar",
    "load_bars_from_cache",
    "load_bars_for_signal_range",
    "run_baseline",
]


def __getattr__(name):
    if name not in __all__:
        raise AttributeError(name)
    from . import baseline

    return getattr(baseline, name)
