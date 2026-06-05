"""Property test for Tick_Store shard retention (task 3.5).

Property 12 asserts that ``TickStore.purge_expired`` deletes exactly the shard
files whose UTC calendar day is **strictly older than the retention window**
(more than ``retention_days`` days before the UTC day of ``now``) and retains
every shard within the window, every today/future shard, and is **idempotent**
(a second purge removes nothing).

For each example we materialize a set of real day-sharded SQLite files at
arbitrary ages relative to a fixed reference ``now`` (including the boundary at
exactly 90 days, just-outside at 91 days, today, and future days), purge, and
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
_RETENTION_DAYS = 90

# Fixed reference "now" (UTC) for every example.
_NOW = datetime(2026, 8, 1, 12, 0, 0, tzinfo=timezone.utc)
_NOW_DAY = _NOW.date()

# A set of day-offsets relative to ``now``'s UTC day. Positive = days in the
# past, 0 = today, negative = future. The range straddles the 90-day boundary
# (89/90 retained, 91+ deleted) and includes today/future shards which are
# never deleted regardless of age.
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

    A shard exactly ``retention_days`` old is kept; only strictly-older shards
    (age > retention_days) are deleted. Today/future shards (offset <= 0) are
    never expired.
    """
    return offset_days > _RETENTION_DAYS


# Feature: gc-chart-platform, Property 12: Shard retention keeps shards within 90 days and deletes older ones
@pytest.mark.property
@given(offsets=_OFFSET_SETS)
def test_purge_deletes_only_shards_older_than_90_days(offsets: set[int]) -> None:
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

        # purge_expired deletes exactly the strictly-older shards.
        assert set(removed) == expected_deleted
        for shard in expected_deleted:
            assert not shard.exists()
        # Everything within 90 days (and today/future) is retained.
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
