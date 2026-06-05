"""Parity test: BigTrade vs reference BigTradeIndicator (task 19.4, Property 30).

For each recorded/spec-derived replay fixture (identical ordered events, bid/ask
snapshot state, and ms-precision timestamps) the BigTrade_Engine's emitted
markers must equal the paired reference-indicator oracle (MinVolume=30) for all
trades in NT group-finalization order. Parity is asserted only against replay
fixtures, never live streams. (design "Parity scope note")

**Validates: Requirements 15.6**
"""

from __future__ import annotations

import pytest
from hypothesis import given
from hypothesis import strategies as st

from tests.parity.fixtures_loader import load_fixtures_for
from tests.parity.replay_harness import replay_big_trade

_FIXTURES = load_fixtures_for("big_trade")
_TOL = 1e-9


@pytest.mark.skipif(not _FIXTURES, reason="no big_trade parity fixtures present")
# Feature: gc-chart-platform, Property 30: BigTrade parity with BigTradeIndicator under identical replay
@pytest.mark.property
@given(idx=st.integers(min_value=0, max_value=max(len(_FIXTURES) - 1, 0)))
def test_property_30_big_trade_parity(idx: int):
    fixture = _FIXTURES[idx]
    markers = replay_big_trade(fixture)
    expected = fixture.expected["markers"]

    assert len(markers) == len(expected), (
        f"{fixture.name}: marker count {len(markers)} != oracle {len(expected)}"
    )
    for got, exp in zip(markers, expected):
        assert got.time == exp["time"], fixture.name
        assert got.side.value == exp["side"], fixture.name
        assert got.volume == exp["volume"], fixture.name
        assert got.price == pytest.approx(exp["price"], abs=_TOL), fixture.name
