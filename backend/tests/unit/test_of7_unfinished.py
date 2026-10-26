from dataclasses import replace

import pytest

from app.orderflow7 import OF7Bar, OF7Cell, OF7Engine, OF7UnfinishedTracker

pytestmark = pytest.mark.unit


def sample(index=0, **changes):
    return OF7Bar(**(dict(time=index * 60000, open=100, low=100, high=102, close=102,
                          cells=(OF7Cell(100, 1, 0), OF7Cell(102, 2, 4)),
                          session_id="s", source="synthetic", source_contract="GC test") | changes))


def test_first_chart_bar_is_not_tracked_but_next_closed_bar_is():
    tracker = OF7UnfinishedTracker()
    assert tracker.update(sample(), bar_index=0).created == ()
    state = tracker.update(sample(1), bar_index=1)
    assert [(line.price, line.side, line.origin_index) for line in state.created] == [(102, "high", 1)]


def test_touch_does_not_finalize_and_strict_cross_closes_prior_level():
    tracker = OF7UnfinishedTracker()
    first = tracker.update(sample(1), bar_index=1)
    touch = tracker.update(sample(2, open=102, close=102), bar_index=2)
    assert touch.finalized == ()
    cross = tracker.update(sample(3, high=103, close=103), bar_index=3)
    assert cross.finalized[0].end_index == 3
    assert cross.finalized[0].origin_index == 1
    assert first.open_levels[0].end_index is None


def test_low_level_finalizes_only_below_and_finalizes_before_new_creation():
    tracker = OF7UnfinishedTracker()
    first = sample(1, open=102, close=100, cells=(OF7Cell(100, 1, 3), OF7Cell(102, 4, 2)))
    assert tracker.update(first, bar_index=1).created[0].side == "low"
    assert tracker.update(replace(first, time=120000), bar_index=2).finalized == ()
    state = tracker.update(sample(3, open=102, low=99, close=99,
                                  cells=(OF7Cell(99, 1, 3), OF7Cell(102, 1, 2))), bar_index=3)
    assert len(state.finalized) == 2
    assert [(line.origin_index, line.price) for line in state.open_levels] == [(3, 99)]


def test_source_chart_extreme_can_finalize_even_if_filtered_ladder_extreme_does_not():
    tracker = OF7UnfinishedTracker()
    tracker.update(sample(1), bar_index=1)
    state = tracker.update(sample(2, open=102, close=102), bar_index=2, chart_high=103)
    assert state.finalized[0].end_index == 2


def test_live_bar_cannot_advance_levels_or_finalize_early():
    tracker = OF7UnfinishedTracker()
    tracker.update(sample(1), bar_index=1)
    with pytest.raises(ValueError, match="closed"):
        tracker.update(sample(2, is_closed=False, high=103), bar_index=2)
    assert tracker.update(sample(2), bar_index=2).finalized == ()


def test_history_gaps_are_rejected_and_engine_does_not_advance_on_live_snapshots():
    tracker = OF7UnfinishedTracker()
    tracker.update(sample(1), bar_index=1)
    with pytest.raises(ValueError, match="consecutive"):
        tracker.update(sample(3), bar_index=3)
    engine = OF7Engine()
    assert engine.update(sample(0, is_closed=False), observed_at=10000).unfinished_business is None
    assert engine.update(sample(0), observed_at=60000).unfinished_business.created == ()
    assert engine.update(sample(1), observed_at=120000).unfinished_business.created[0].side == "high"
