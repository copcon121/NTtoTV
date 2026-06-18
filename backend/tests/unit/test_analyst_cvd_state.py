from app.analyst.cvd_state import build_cvd_state
from app.storage.records import BarRecord, VolumeDeltaRecord


def _vd(time: int, close_delta: int) -> VolumeDeltaRecord:
    buy = max(0, close_delta)
    sell = max(0, -close_delta)
    return VolumeDeltaRecord(
        symbol="GC",
        contract="GC",
        timeframe="1m",
        time=time,
        volume=abs(close_delta),
        buy_volume=buy,
        sell_volume=sell,
        delta=close_delta,
        delta_high=max(0, close_delta),
        delta_low=min(0, close_delta),
        open_delta=close_delta,
        close_delta=close_delta,
    )


def _bar(time: int, close: float) -> BarRecord:
    return BarRecord(
        symbol="GC",
        contract="GC",
        timeframe="1m",
        time=time,
        open=close,
        high=close,
        low=close,
        close=close,
        volume=1,
        closed=True,
    )


def test_cvd_missing_rows_is_explicit():
    state = build_cvd_state("M1", [])

    assert state.status == "missing"
    assert state.cumulative == 0
    assert state.flags == ("missing_cvd",)


def test_cvd_reconstructs_running_sum_and_positive_flip():
    state = build_cvd_state("M1", [_vd(1, -5), _vd(2, 8)])

    assert state.cumulative == 3
    assert state.recent_delta == 8
    assert state.previous_delta == -5
    assert state.status == "rising"
    assert "flip_positive" in state.flags


def test_cvd_marks_price_divergence():
    rows = [_vd(1, 10), _vd(2, 10), _vd(3, 10)]
    bars = [_bar(1, 100.0), _bar(2, 99.0), _bar(3, 98.0)]

    state = build_cvd_state("M1", rows, bars)

    assert state.slope > 0
    assert "divergence_with_price" in state.flags


def test_cvd_marks_confirming_structure():
    rows = [_vd(1, -10), _vd(2, -10), _vd(3, -10)]
    bars = [_bar(1, 100.0), _bar(2, 99.0), _bar(3, 98.0)]

    state = build_cvd_state("M1", rows, bars)

    assert state.slope < 0
    assert "confirming_structure" in state.flags
