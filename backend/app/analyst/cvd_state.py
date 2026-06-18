"""CVD state derived only from cached volume-delta rows."""

from __future__ import annotations

from collections.abc import Sequence

from ..storage.records import BarRecord, VolumeDeltaRecord
from .schemas import CvdState

_SLOPE_LOOKBACK = 10


def build_cvd_state(
    timeframe: str,
    rows: Sequence[VolumeDeltaRecord],
    bars: Sequence[BarRecord] = (),
) -> CvdState:
    """Return compact CVD state for one timeframe.

    CVD is the running sum of each row's final bar delta. Persisted
    ``VolumeDeltaRecord`` rows do not store a cumulative value, so this function
    reconstructs it from ``close_delta`` (falling back to ``delta`` when needed).
    It intentionally does not read footprint or delta-profile data.
    """
    if not rows:
        return CvdState(
            timeframe=timeframe,
            status="missing",
            cumulative=0,
            recent_delta=0,
            previous_delta=0,
            slope=0,
            bars=0,
            flags=("missing_cvd",),
        )

    ordered = sorted(rows, key=lambda r: r.time)
    deltas = [int(getattr(row, "close_delta", row.delta)) for row in ordered]
    cumulative_values: list[int] = []
    running = 0
    for delta in deltas:
        running += delta
        cumulative_values.append(running)

    recent_delta = deltas[-1]
    previous_delta = deltas[-2] if len(deltas) >= 2 else 0
    lookback_index = max(0, len(cumulative_values) - _SLOPE_LOOKBACK)
    slope = cumulative_values[-1] - cumulative_values[lookback_index]

    if slope > 0:
        status = "rising"
    elif slope < 0:
        status = "falling"
    else:
        status = "flat"

    flags: list[str] = []
    if previous_delta <= 0 < recent_delta:
        flags.append("flip_positive")
    elif previous_delta >= 0 > recent_delta:
        flags.append("flip_negative")

    price_move = _price_move(bars)
    if price_move is not None:
        if (price_move > 0 and slope < 0) or (price_move < 0 and slope > 0):
            flags.append("divergence_with_price")
        elif (price_move > 0 and slope > 0) or (price_move < 0 and slope < 0):
            flags.append("confirming_structure")

    return CvdState(
        timeframe=timeframe,
        status=status,
        cumulative=cumulative_values[-1],
        recent_delta=recent_delta,
        previous_delta=previous_delta,
        slope=slope,
        bars=len(ordered),
        flags=tuple(flags),
    )


def _price_move(bars: Sequence[BarRecord]) -> float | None:
    if len(bars) < 2:
        return None
    ordered = sorted(bars, key=lambda b: b.time)
    first = ordered[max(0, len(ordered) - _SLOPE_LOOKBACK)].close
    last = ordered[-1].close
    return float(last) - float(first)
