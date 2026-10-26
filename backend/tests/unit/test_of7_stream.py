"""Ordered-path regression cases grounded in OF7 BarData.AddTick source."""

from dataclasses import asdict
import json
from pathlib import Path

import pytest

from app.orderflow7.config import OF7Config, REFERENCE_SHA256
from app.orderflow7.stream import OF7StreamLadder


def snapshot(ladder):
    return ladder.snapshot(0, "test", is_closed=True, source="synthetic", source_contract="GC test")


def buy(ladder, price, volume):
    ladder.add_tick(price, volume, price - 1, price)


def test_between_and_locked_quotes_are_counted_without_changing_delta():
    ladder = OF7StreamLadder()
    ladder.add_tick(100, 10, 99, 101)
    ladder.add_tick(101, 7, 101, 101)
    ladder.add_tick(99, 3, 99, 100)
    bar = snapshot(ladder)
    assert bar.volume == 20
    assert bar.delta == -3
    assert [cell.between for cell in bar.cells] == [0, 10, 7]
    assert ladder.volume_cum == 20
    assert ladder.delta_min == -3
    assert ladder.delta_max == 0


def test_crossed_missing_or_locked_away_quotes_are_not_invented_between():
    ladder = OF7StreamLadder()
    ladder.add_tick(100, 10, 101, 99)
    ladder.add_tick(101, 20, None, 102)
    ladder.add_tick(102, 30, 101, 101)
    assert snapshot(ladder).volume == 0
    assert ladder.volume_cum == 60
    assert len(snapshot(ladder).cells) == 3


def test_poc_exact_tie_keeps_path_instead_of_forcing_lowest_price():
    high_first = OF7StreamLadder()
    low_first = OF7StreamLadder()
    buy(high_first, 102, 10)
    buy(high_first, 100, 10)
    buy(low_first, 100, 10)
    buy(low_first, 102, 10)
    assert snapshot(high_first).cells == snapshot(low_first).cells
    assert high_first.poc == 102
    assert low_first.poc == 100


def test_side_poc_neighborhood_uses_that_side_not_total_volume():
    ladder = OF7StreamLadder()
    buy(ladder, 100, 10)
    ladder.add_tick(101, 1000, 101, 102)  # Bid only, must not favor Ask POC.
    buy(ladder, 103, 10)
    assert ladder.poc_ask == 100
    assert ladder.poc == 101


def test_bid_poc_preserves_general_poc_comparison_quirk():
    ladder = OF7StreamLadder()
    buy(ladder, 100, 1000)  # general POC's Bid == 0
    ladder.add_tick(102, 100, 102, 103)
    ladder.add_tick(104, 1, 104, 105)
    assert ladder.poc == 100
    assert ladder.poc_bid == 104  # true max Bid remains 102; DLL picks 104.


def test_sparse_ladder_does_not_fill_untraded_prices():
    ladder = OF7StreamLadder(OF7Config(value_area_percent=100))
    buy(ladder, 100, 10)
    buy(ladder, 104, 20)
    bar = snapshot(ladder)
    assert tuple(cell.price for cell in bar.cells) == (100, 104)
    assert (ladder.val, ladder.vah) == (100, 104)
    assert ladder.frame(bar).ask_imbalances == ()


def test_incremental_value_area_can_shrink_on_volume_inside_area():
    ladder = OF7StreamLadder()
    buy(ladder, 100, 30)
    buy(ladder, 101, 50)
    assert (ladder.val, ladder.vah) == (100, 101)
    buy(ladder, 101, 100)
    assert (ladder.val, ladder.vah) == (101, 101)


def test_shrink_uses_strict_greater_than_target_boundary():
    ladder = OF7StreamLadder()
    buy(ladder, 100, 30)
    buy(ladder, 101, 60)
    buy(ladder, 101, 10)
    assert (ladder.val, ladder.vah) == (100, 101)  # removing 30 leaves exactly70%.


def test_snapshots_do_not_change_when_more_ticks_arrive():
    ladder = OF7StreamLadder()
    buy(ladder, 100, 10)
    first = snapshot(ladder)
    buy(ladder, 101, 20)
    assert first.volume == 10
    assert snapshot(ladder).volume == 30
    with pytest.raises(ValueError, match="does not match"):
        ladder.frame(first)


def test_empty_and_invalid_ticks_are_rejected():
    ladder = OF7StreamLadder()
    with pytest.raises(ValueError, match="empty"):
        snapshot(ladder)
    for tick in ((100.0, 1, 99, 100), (100, -1, 99, 100), (100, 1, True, 100)):
        with pytest.raises(ValueError):
            ladder.add_tick(*tick)


_ORACLE = json.loads((Path(__file__).resolve().parents[3] /
                     "test-fixtures/of7/bardata-oracle.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", _ORACLE["cases"], ids=lambda case: case["name"])
def test_ordered_ladder_matches_original_dll_after_every_tick(case):
    """The expected state is captured by executing the original DLL AddTick.

    This covers BarData's numerical path, not the indicator detectors, platform
    bar indexing, processor reconciliation, or the live NinjaTrader chart.
    """
    assert _ORACLE["reference_sha256"] == REFERENCE_SHA256
    assert _ORACLE["authority"] == "controlled-replay-original-dll"
    ladder = OF7StreamLadder(OF7Config(**_ORACLE["config"]))
    for index, tick in enumerate(case["ticks"]):
        ladder.add_tick(**tick["input"])
        bar = snapshot(ladder)
        frame = ladder.frame(bar)
        actual = {
            **{key: getattr(bar, key) for key in ("open", "high", "low", "close", "volume", "delta")},
            **{key: getattr(frame, key) for key in ("poc", "poc_bid", "poc_ask", "val", "vah")},
            "ask_imbalances": list(frame.ask_imbalances),
            "bid_imbalances": list(frame.bid_imbalances),
            "cells": [asdict(cell) for cell in bar.cells],
        }
        assert actual == tick["expected"], f"{case['name']} tick {index}: {tick['input']}"
