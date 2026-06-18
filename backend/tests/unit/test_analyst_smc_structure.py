import pytest

from app.analyst.smc_structure import build_htf_structure_map, build_m1_structure_map
from app.storage.records import BarRecord


def _bar(index, open_, high, low, close):
    return BarRecord(
        symbol="GC",
        contract="GC",
        timeframe="1m",
        time=index * 60_000,
        open=open_,
        high=high,
        low=low,
        close=close,
        volume=1,
        closed=True,
    )


@pytest.mark.unit
def test_confirmed_swing_sequence_detects_bullish_structure():
    state = build_htf_structure_map(
        "M5",
        [
            _bar(0, 8, 10, 6, 8),
            _bar(1, 10, 12, 8, 11),
            _bar(2, 8, 11, 5, 8),
            _bar(3, 12, 14, 9, 13),
            _bar(4, 9, 13, 7, 9),
            _bar(5, 14, 15, 10, 15),
            _bar(6, 13, 14, 9, 13),
        ],
        swing_length=1,
    )

    external = state["structureMap"]["external"]
    assert external["trendPattern"] == "HH_HL"
    assert external["structure"] == "bullish"
    assert "HH" in external["swingSequence"]
    assert "HL" in external["swingSequence"]


@pytest.mark.unit
def test_confirmed_swing_sequence_detects_bearish_structure():
    state = build_htf_structure_map(
        "M5",
        [
            _bar(0, 9, 10, 8, 9),
            _bar(1, 13, 14, 9, 13),
            _bar(2, 9, 12, 7, 9),
            _bar(3, 12, 13, 8, 12),
            _bar(4, 8, 11, 6, 8),
            _bar(5, 11, 12, 7, 11),
            _bar(6, 7, 10, 5, 7),
        ],
        swing_length=1,
    )

    external = state["structureMap"]["external"]
    assert external["trendPattern"] == "LH_LL"
    assert external["structure"] == "bearish"
    assert "LH" in external["swingSequence"]
    assert "LL" in external["swingSequence"]


@pytest.mark.unit
def test_mixed_sequence_is_range_not_bos_driven_bias():
    state = build_htf_structure_map(
        "M15",
        [
            _bar(0, 8, 10, 6, 8),
            _bar(1, 10, 12, 8, 11),
            _bar(2, 8, 11, 5, 8),
            _bar(3, 12, 14, 9, 13),
            _bar(4, 7, 13, 4, 7),
            _bar(5, 10, 11, 6, 10),
            _bar(6, 9, 10, 5, 9),
        ],
        swing_length=1,
    )

    external = state["structureMap"]["external"]
    assert external["trendPattern"] == "mixed"
    assert external["structure"] == "range"
    assert "breakEvents" in state


@pytest.mark.unit
def test_m1_internal_is_entry_timing_only_after_poi_touch():
    no_touch = build_m1_structure_map(
        [_bar(i, 10, 11, 9, 10) for i in range(12)],
        active_poi_side="demand",
        poi_touched=False,
        swing_length=1,
    )
    assert no_touch["structureMap"]["external"]["enabled"] is False
    internal = no_touch["structureMap"]["internal"]
    assert internal["enabled"] is True
    assert internal["canAffectBias"] is False
    assert internal["triggerState"] == "not_confirmed"
