"""Property test for Tick_Store shard retention (task 3.5).

Property 12 asserts that ``TickStore.purge_expired`` deletes exactly the shard
files outside the latest ``retention_days`` UTC calendar days, counting the UTC
day of ``now`` as day one. It retains every shard within that window, every
future shard, and is **idempotent** (a second purge removes nothing).

For each example we materialize a set of real day-sharded SQLite files at
arbitrary ages relative to a fixed reference ``now`` (including today,
yesterday, the just-outside day, and future days), purge, and
check the partition of deleted vs. retained shards against the specification.

Uses the design-mandated Hypothesis ``gc`` profile (>= 100 examples).
(Validates: Requirements 7.4, 7.5)
"""

from __future__ import annotations

import shutil
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.models import NormalizedTrade, to_canonical_ms
from app.storage import TickStore

_CONTRACT = "GC 08-26"
_RETENTION_DAYS = 2

# Fixed reference "now" (UTC) for every example.
_NOW = datetime(2026, 8, 1, 12, 0, 0, tzinfo=timezone.utc)
_NOW_DAY = _NOW.date()

# A set of day-offsets relative to ``now``'s UTC day. Positive = days in the
# past, 0 = today, negative = future. With two-day retention, offsets 0 and 1
# are retained, while offsets >= 2 are deleted.
_OFFSET_SETS = st.sets(
    st.integers(min_value=-3, max_value=300),
    min_size=1,
    max_size=14,
)


def _day_for_offset(offset_days: int) -> date:
    """UTC calendar day ``offset_days`` days before ``now`` (negative = future)."""
    return _NOW_DAY - timedelta(days=offset_days)


def _make_shard(store: TickStore, day: date) -> Path:
    """Create a real WAL shard file for ``_CONTRACT`` on ``day``."""
    ms = to_canonical_ms(
        datetime(day.year, day.month, day.day, 12, 0, 0, tzinfo=timezone.utc)
    )
    store.record_trade(
        NormalizedTrade(
            symbol="GC",
            contract=_CONTRACT,
            time=ms,
            price=2345.6,
            volume=1,
            bid=2345.5,
            ask=2345.7,
            best_bid=2345.5,
            best_ask=2345.7,
            sequence=1,
        )
    )
    path = store.shard_path(_CONTRACT, day)
    assert path.exists()
    return path


def _is_expired(offset_days: int) -> bool:
    """True iff a shard at this offset is strictly older than the window.

    ``retention_days`` counts today as day one, so a two-day window retains
    offsets 0 and 1. Future shards (offset < 0) are never expired.
    """
    return offset_days >= _RETENTION_DAYS


# Feature: gc-chart-platform, Property 12: Shard retention keeps only latest raw calendar days
@pytest.mark.property
@given(offsets=_OFFSET_SETS)
def test_purge_deletes_only_shards_outside_latest_days(offsets: set[int]) -> None:
    ticks_dir = Path(tempfile.mkdtemp(prefix="gc_retention_"))
    store = TickStore(ticks_dir=ticks_dir)
    try:
        shard_by_offset: dict[int, Path] = {
            off: _make_shard(store, _day_for_offset(off)) for off in offsets
        }
        expected_deleted = {
            shard_by_offset[off] for off in offsets if _is_expired(off)
        }
        expected_retained = {
            shard_by_offset[off] for off in offsets if not _is_expired(off)
        }

        removed = store.purge_expired(_NOW, retention_days=_RETENTION_DAYS)

        # purge_expired deletes exactly the shards outside the retained window.
        assert set(removed) == expected_deleted
        for shard in expected_deleted:
            assert not shard.exists()
        # Everything inside the latest-days window and future shards are retained.
        for shard in expected_retained:
            assert shard.exists()

        # Idempotent: a second purge removes nothing more and leaves the
        # retained shards intact.
        again = store.purge_expired(_NOW, retention_days=_RETENTION_DAYS)
        assert again == []
        for shard in expected_retained:
            assert shard.exists()
    finally:
        store.close()
        shutil.rmtree(ticks_dir, ignore_errors=True)
