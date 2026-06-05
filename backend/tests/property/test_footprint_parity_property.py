"""Parity test: Footprint vs reference MzFootprintClone (task 19.3, Property 29).

For each recorded/spec-derived replay fixture (identical ordered events, bid/ask
snapshot state, and ms-precision timestamps) the Footprint_Engine's ladder rows,
POC, and imbalance values must equal the paired reference-indicator oracle for
all footprint bars, given the same configuration. Float metrics are compared
with a tolerance. Parity is asserted only against replay fixtures, never live
streams. (design "Parity scope note")

**Validates: Requirements 14.9**
"""

from __future__ import annotations

import pytest
from hypothesis import given
from hypothesis import strategies as st

from tests.parity.fixtures_loader import load_fixtures_for
from tests.parity.replay_harness import replay_footprint

_FIXTURES = load_fixtures_for("footprint")
_TOL = 1e-9


@pytest.mark.skipif(not _FIXTURES, reason="no footprint parity fixtures present")
# Feature: gc-chart-platform, Property 29: Footprint parity with MzFootprintClone under identical replay
@pytest.mark.property
@given(idx=st.integers(min_value=0, max_value=max(len(_FIXTURES) - 1, 0)))
def test_property_29_footprint_parity(idx: int):
    fixture = _FIXTURES[idx]
    bars = replay_footprint(fixture)
    expected = fixture.expected["bars"]

    assert len(bars) == len(expected), (
        f"{fixture.name}: bar count {len(bars)} != oracle {len(expected)}"
    )
    for got, exp in zip(bars, expected):
        assert got.time == exp["time"], fixture.name

        # Oracle rows are in ascending price order; engine rows descending.
        exp_rows = sorted(exp["rows"], key=lambda r: r["price"], reverse=True)
        assert len(got.rows) == len(exp_rows), fixture.name
        for gr, er in zip(got.rows, exp_rows):
            assert gr.price == pytest.approx(er["price"], abs=_TOL), fixture.name
            assert gr.bid == er["bid"], fixture.name
            assert gr.ask == er["ask"], fixture.name
            got_imb = None if gr.imbalance is None else gr.imbalance.value
            assert got_imb == er["imbalance"], (fixture.name, gr.price)

        assert got.poc == pytest.approx(exp["poc"], abs=_TOL), fixture.name
        assert got.bar_delta == exp["barDelta"], fixture.name
        assert got.buy_pct == pytest.approx(exp["buyPct"], abs=1e-9), fixture.name
        assert got.sell_pct == pytest.approx(exp["sellPct"], abs=1e-9), fixture.name

        exp_stacks = {
            (s["side"], round(s["from"], 6), round(s["to"], 6))
            for s in exp["stackedImbalance"]
        }
        got_stacks = {
            (s.side.value, round(s.from_price, 6), round(s.to_price, 6))
            for s in got.stacked_imbalance
        }
        assert got_stacks == exp_stacks, fixture.name

        assert got.unfinished_auction.high == exp["unfinishedAuction"]["high"], fixture.name
        assert got.unfinished_auction.low == exp["unfinishedAuction"]["low"], fixture.name
