from __future__ import annotations

import pytest

from app.storage.liquidity_store import LiquidityStore


def marker(*, sequence: int, time: int, action: str = "added") -> dict:
    return {
        "type": "liquidity_update",
        "symbol": "GC",
        "contract": "GC",
        "sourceContract": "GCZ6.COMEX@RITHMIC",
        "sequence": sequence,
        "time": time,
        "eventKind": "relative",
        "action": action,
        "side": "bid",
        "price": 4200.1,
        "size": 700,
        "previousSize": 300,
        "change": 400,
        "threshold": 300,
        "domDistance": 25,
        "strength": 1.333,
        "snapshot": False,
    }


def line(*, sequence: int, time: int, action: str, size: int) -> dict:
    return {
        **marker(sequence=sequence, time=time, action=action),
        "eventKind": "long_term",
        "lineId": "bid:42001:1000",
        "lineStartTime": 1_000,
        "size": size,
        "threshold": 500,
    }


def touch(*, sequence: int, time: int, volume: int = 5) -> dict:
    return {
        **marker(sequence=sequence, time=time, action="touch"),
        "eventKind": "long_term_touch",
        "size": volume,
        "change": volume,
        "previousSize": 600,
        "threshold": 500,
        "domDistance": 2,
        "lineId": "bid:42001:1000",
        "lineStartTime": 1_000,
    }


@pytest.mark.unit
def test_records_markers_and_allows_sequence_reset(tmp_path):
    store = LiquidityStore(tmp_path / "liquidity.sqlite")
    try:
        store.record(marker(sequence=1, time=1_000))
        store.record(marker(sequence=1, time=1_000))
        store.record(marker(sequence=1, time=2_000, action="removed"))
        events, lines = store.read("GC", "GC", 0, 3_000)
        assert [(event["time"], event["action"]) for event in events] == [
            (1_000, "added"),
            (2_000, "removed"),
        ]
        assert lines == []
    finally:
        store.close()


@pytest.mark.unit
def test_tracks_long_term_line_lifecycle_and_snapshot_reopens(tmp_path):
    store = LiquidityStore(tmp_path / "liquidity.sqlite")
    try:
        store.record(line(sequence=1, time=31_000, action="start", size=600))
        store.record(line(sequence=2, time=32_000, action="update", size=680))
        store.record(line(sequence=3, time=33_000, action="end", size=420))
        _, lines = store.read("GC", "GC", 0, 40_000)
        assert lines[0]["active"] is False
        assert lines[0]["endedAt"] == 33_000
        assert lines[0]["peakSize"] == 680

        store.record(line(sequence=4, time=34_000, action="snapshot", size=650))
        _, lines = store.read("GC", "GC", 0, 40_000)
        assert lines[0]["active"] is True
        assert lines[0]["endedAt"] is None
        assert lines[0]["startedAt"] == 1_000
    finally:
        store.close()


@pytest.mark.unit
def test_retention_removes_markers_and_only_completed_old_lines(tmp_path):
    store = LiquidityStore(tmp_path / "liquidity.sqlite")
    try:
        store.record(marker(sequence=1, time=1_000))
        store.record(marker(sequence=2, time=5_000))
        store.record(line(sequence=3, time=2_000, action="end", size=420))
        store.record(
            {
                **line(sequence=4, time=2_000, action="start", size=700),
                "lineId": "ask:42010:1000",
                "side": "ask",
            }
        )
        assert store.purge_before(3_000) == (1, 1)
        events, lines = store.read("GC", "GC", 0, 10_000)
        assert [event["time"] for event in events] == [5_000]
        assert [(item["side"], item["active"]) for item in lines] == [("ask", True)]
    finally:
        store.close()


@pytest.mark.unit
def test_clear_history_removes_only_changed_detector_groups(tmp_path):
    store = LiquidityStore(tmp_path / "liquidity.sqlite")
    try:
        store.record(marker(sequence=1, time=1_000))
        store.record(
            {
                **marker(sequence=2, time=2_000),
                "eventKind": "absolute",
            }
        )
        store.record(line(sequence=3, time=3_000, action="start", size=600))
        store.record(touch(sequence=-1, time=3_100))

        events, _ = store.read("GC", "GC", 0, 10_000)
        saved_touch = next(event for event in events if event["eventKind"] == "long_term_touch")
        assert saved_touch["lineId"] == "bid:42001:1000"
        assert saved_touch["lineStartTime"] == 1_000

        assert store.clear_history(["relative", "long_term"]) == (2, 1)
        events, lines = store.read("GC", "GC", 0, 10_000)
        assert [event["eventKind"] for event in events] == ["absolute"]
        assert lines == []
    finally:
        store.close()


@pytest.mark.unit
def test_prune_to_settings_removes_legacy_threshold_history(tmp_path):
    store = LiquidityStore(tmp_path / "liquidity.sqlite")
    try:
        store.record(marker(sequence=1, time=1_000))
        store.record(
            {
                **marker(sequence=2, time=2_000),
                "threshold": 50,
                "change": 50,
                "domDistance": 20,
            }
        )
        settings = {
            "relativeEnabled": True,
            "relativeTrigger": 50,
            "relativeDomFrom": 20,
            "relativeDomTo": 100,
            "absoluteEnabled": True,
            "absoluteTrigger": 500,
            "absoluteDomFrom": 1,
            "absoluteDomTo": 10,
            "longTermEnabled": True,
            "longTermTrigger": 500,
        }

        assert store.prune_to_settings(settings) == (1, 0)
        events, _ = store.read("GC", "GC", 0, 10_000)
        assert [(event["threshold"], event["change"]) for event in events] == [
            (50, 50)
        ]
    finally:
        store.close()


@pytest.mark.unit
def test_heatmap_keeps_refill_reduction_and_terminal_samples_after_reopen(tmp_path):
    path = tmp_path / "liquidity.sqlite"
    store = LiquidityStore(path)
    updates = [
        line(sequence=1, time=1_000, action="start", size=500),
        line(sequence=2, time=31_000, action="update", size=1200),
        line(sequence=3, time=61_000, action="update", size=700),
        line(sequence=4, time=91_000, action="end", size=0),
    ]
    for update in updates:
        store.record(update)
        store.record(update)  # replay is idempotent
    store.close()
    store = LiquidityStore(path)
    try:
        _, lines = store.read("GC", "GC", 40_000, 100_000)
        assert lines[0]["samples"] == [
            {"time": 31_000, "size": 1200, "active": True},
            {"time": 61_000, "size": 700, "active": True},
            {"time": 91_000, "size": 0, "active": False},
        ]
        # A narrower historical query must not return future size changes.
        _, earlier = store.read("GC", "GC", 0, 40_000)
        assert [sample["size"] for sample in earlier[0]["samples"]] == [500, 1200]
        store.clear_history(["long_term"])
        count = store._writer.connection.execute("SELECT COUNT(*) FROM liquidity_line_samples").fetchone()[0]
        assert count == 0
    finally:
        store.close()


@pytest.mark.unit
def test_heatmap_retention_keeps_one_anchor_and_cascades_completed_lines(tmp_path):
    store = LiquidityStore(tmp_path / "liquidity.sqlite")
    try:
        for index, time in enumerate([1000, 2000, 3000, 6000], start=1):
            store.record(line(sequence=index, time=time, action="update", size=500 + index * 100))
        store.record({**line(sequence=5, time=2000, action="end", size=0), "lineId": "old"})
        store.purge_before(5000)
        _, lines = store.read("GC", "GC", 5000, 10000)
        assert len(lines) == 1
        assert [sample["time"] for sample in lines[0]["samples"]] == [3000, 6000]
        assert store._writer.connection.execute("SELECT COUNT(*) FROM liquidity_line_samples").fetchone()[0] == 2
    finally:
        store.close()


@pytest.mark.unit
def test_delayed_heatmap_sample_does_not_reopen_an_ended_line(tmp_path):
    store = LiquidityStore(tmp_path / "liquidity.sqlite")
    try:
        store.record(line(sequence=2, time=3000, action="end", size=0))
        store.record(line(sequence=1, time=2000, action="update", size=900))
        _, lines = store.read("GC", "GC", 0, 10000)
        assert lines[0]["active"] is False
        assert lines[0]["endedAt"] == 3000
        assert lines[0]["currentSize"] == 0
        assert [sample["size"] for sample in lines[0]["samples"]] == [900, 0]
    finally:
        store.close()
