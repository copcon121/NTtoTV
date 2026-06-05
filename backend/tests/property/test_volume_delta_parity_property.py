"""Parity test: VolumeDelta vs reference MyVolumeDelta (task 19.2, Property 28).

For each recorded/spec-derived replay fixture (identical ordered events, bid/ask
snapshot state, and ms-precision timestamps) the VolumeDelta_Engine's per-bar
output must equal the paired reference-indicator oracle for all bars, given the
same configuration. Parity is asserted only against replay fixtures, never live
streams. (design "Parity scope note")

Hypothesis drives the property by sampling over the loaded fixtures so each is
exercised; the assertion itself is exact per-bar equality against the oracle.

**Validates: Requirements 13.8**
"""

from __future__ import annotations

import pytest
from hypothesis import given
from hypothesis import strategies as st

from tests.parity.fixtures_loader import load_fixtures_for
from tests.parity.replay_harness import replay_volume_delta

_FIXTURES = load_fixtures_for("volume_delta")


@pytest.mark.skipif(not _FIXTURES, reason="no volume_delta parity fixtures present")
# Feature: gc-chart-platform, Property 28: VolumeDelta parity with MyVolumeDelta under identical replay
@pytest.mark.property
@given(idx=st.integers(min_value=0, max_value=max(len(_FIXTURES) - 1, 0)))
def test_property_28_volume_delta_parity(idx: int):
    fixture = _FIXTURES[idx]
    bars = replay_volume_delta(fixture)
    expected = fixture.expected["bars"]

    assert len(bars) == len(expected), (
        f"{fixture.name}: bar count {len(bars)} != oracle {len(expected)}"
    )
    for got, exp in zip(bars, expected):
        assert got.time == exp["time"], fixture.name
        assert got.volume == exp["volume"], fixture.name
        assert got.buy_volume == exp["buyVolume"], fixture.name
        assert got.sell_volume == exp["sellVolume"], fixture.name
        assert got.delta == exp["delta"], fixture.name
        assert got.delta_high == exp["deltaHigh"], fixture.name
        assert got.delta_low == exp["deltaLow"], fixture.name
        assert got.open_delta == exp["openDelta"], fixture.name
        assert got.close_delta == exp["closeDelta"], fixture.name
