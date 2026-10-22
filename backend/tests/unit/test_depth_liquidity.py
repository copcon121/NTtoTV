from __future__ import annotations

import pytest

from app.engines.depth_liquidity import DepthLiquidityTracker
from app.liquidity_settings import DEFAULT_LIQUIDITY_SETTINGS


def _settings() -> dict[str, bool | int]:
    return {
        **DEFAULT_LIQUIDITY_SETTINGS,
        "relativeTrigger": 300,
        "relativeDomFrom": 20,
        "relativeDomTo": 80,
        "absoluteTrigger": 500,
        "absoluteDomFrom": 1,
        "absoluteDomTo": 10,
        "longTermTrigger": 500,
        "longTermDomFrom": 1,
        "longTermDomTo": 80,
    }


@pytest.mark.unit
def test_rithmic_depth_tracker_matches_compact_liquidity_semantics() -> None:
    tracker = DepthLiquidityTracker(
        _settings(), tick_size=0.1, source_prefix="rithmic"
    )

    seeded = tracker.on_book_delta(
        {
            "time": 1_000,
            "bids": [
                {"price": 100.0, "size": 100},
                {"price": 99.5, "size": 600},
            ],
            "asks": [{"price": 100.1, "size": 100}],
        },
        1_000,
    )
    assert [(event.event_kind, event.action) for event in seeded] == [
        ("long_term", "start")
    ]
    assert seeded[0].line_id == "rithmic:bid:995:1000"

    relative = tracker.on_book_delta(
        {
            "time": 2_000,
            "bids": [{"price": 98.0, "size": 350}],
            "asks": [],
        },
        2_000,
    )
    assert [(event.event_kind, event.action) for event in relative] == [
        ("relative", "added")
    ]
    assert relative[0].dom_distance == 20

    absolute = tracker.on_book_delta(
        {
            "time": 3_000,
            "bids": [{"price": 99.9, "size": 510}],
            "asks": [],
        },
        3_000,
    )
    assert any(
        event.event_kind == "absolute" and event.action == "crossed"
        for event in absolute
    )

    updated = tracker.on_book_delta(
        {
            "time": 4_000,
            "bids": [{"price": 99.5, "size": 670}],
            "asks": [],
        },
        4_000,
    )
    assert [(event.event_kind, event.action) for event in updated] == [
        ("long_term", "update")
    ]
    snapshots = tracker.snapshots(5_000)
    assert len(snapshots) == 2
    assert all(event.action == "snapshot" and event.snapshot for event in snapshots)

    ended = tracker.on_book_delta(
        {
            "time": 6_000,
            "bids": [{"price": 99.5, "size": 440}],
            "asks": [],
        },
        6_000,
    )
    assert any(
        event.event_kind == "long_term" and event.action == "end"
        for event in ended
    )
    assert len(tracker.snapshots(7_000)) == 1


@pytest.mark.unit
def test_first_depth_image_does_not_emit_relative_or_absolute_markers() -> None:
    tracker = DepthLiquidityTracker(_settings(), tick_size=0.1)
    events = tracker.on_book_delta(
        {
            "time": 1_000,
            "bids": [{"price": 100.0, "size": 1_000}],
            "asks": [{"price": 100.1, "size": 1_000}],
        },
        1_000,
    )
    assert {event.event_kind for event in events} <= {"long_term"}
