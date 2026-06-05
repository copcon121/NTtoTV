"""Property test for Tick_Store shard-path resolution (task 3.3).

Property 11 asserts that ``TickStore.shard_path`` is a **pure** function of the
contract identifier and the UTC calendar day of a Canonical_Timestamp: the same
inputs always resolve to the identical path, the call has no filesystem side
effects, the path matches the documented ``data/ticks/GC/<contract>/YYYY-MM-DD
.sqlite`` layout, and timestamps that straddle a UTC midnight map to different
day shards while timestamps within the same UTC day map to the same shard.

Uses the design-mandated Hypothesis ``gc`` profile (>= 100 examples).
(Validates: Requirements 7.1)
"""

from __future__ import annotations

import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.models import from_canonical_ms, to_canonical_ms
from app.storage import TickStore, sanitize_contract
from app.storage.tick_store import SYMBOL

# ``shard_path`` is pure (no filesystem access), so a single module-level store
# rooted at an empty temp directory is reused across all examples. Because the
# function never writes, this directory stays empty for the duration of the run
# and is the witness for the "no side effects" assertions.
_TICKS_DIR = Path(tempfile.mkdtemp(prefix="gc_shard_path_"))
_STORE = TickStore(ticks_dir=_TICKS_DIR)

# Contract identifiers drawn from printable ASCII so the generator exercises the
# filesystem-sanitization path (spaces, ``/``, ``:``, ``*`` ...) without emitting
# surrogate codepoints that Path operations reject on some platforms.
_CONTRACTS = st.text(
    alphabet=st.characters(min_codepoint=32, max_codepoint=126),
    min_size=1,
    max_size=40,
)

# Canonical_Timestamps (ms since epoch UTC) spanning 1970 .. ~2100.
_MS = st.integers(min_value=0, max_value=4_102_444_800_000)


def _shard_for_ms(contract: str, ms: int) -> Path:
    """Resolve the shard for the UTC day of Canonical_Timestamp ``ms``."""
    return _STORE.shard_path(contract, from_canonical_ms(ms).date())


# Feature: gc-chart-platform, Property 11: Tick_Store shard path is a pure function of contract and UTC day
@pytest.mark.property
@given(contract=_CONTRACTS, ms=_MS)
def test_shard_path_is_pure_and_matches_layout(contract: str, ms: int) -> None:
    """Same inputs -> identical path, documented layout, and no side effects."""
    day = from_canonical_ms(ms).date()

    first = _STORE.shard_path(contract, day)
    second = _STORE.shard_path(contract, day)

    # Deterministic: repeated calls with the same inputs are identical.
    assert first == second

    # Matches the documented data/ticks/GC/<contract>/YYYY-MM-DD.sqlite layout
    # (with the contract directory filesystem-sanitized).
    expected = (
        _TICKS_DIR
        / SYMBOL
        / sanitize_contract(contract)
        / f"{day.isoformat()}.sqlite"
    )
    assert first == expected

    # Pure: resolving a path touches nothing on disk.
    assert not first.exists()
    assert not (_TICKS_DIR / SYMBOL).exists()


# Feature: gc-chart-platform, Property 11: Tick_Store shard path is a pure function of contract and UTC day
@pytest.mark.property
@given(contract=_CONTRACTS, ms=_MS)
def test_same_utc_day_shares_shard_midnight_splits(contract: str, ms: int) -> None:
    """Same UTC day -> same shard; opposite sides of UTC midnight -> different."""
    day = from_canonical_ms(ms).date()

    # Two other instants on the same UTC day (the day's first and last ms).
    start_of_day = to_canonical_ms(
        datetime(day.year, day.month, day.day, 0, 0, 0, 0, tzinfo=timezone.utc)
    )
    end_of_day = to_canonical_ms(
        datetime(day.year, day.month, day.day, 23, 59, 59, 999_000, tzinfo=timezone.utc)
    )

    base_shard = _shard_for_ms(contract, ms)
    assert _shard_for_ms(contract, start_of_day) == base_shard
    assert _shard_for_ms(contract, end_of_day) == base_shard

    # The first instant of the next UTC day resolves to a different shard.
    next_day = day + timedelta(days=1)
    next_day_ms = to_canonical_ms(
        datetime(
            next_day.year, next_day.month, next_day.day, 0, 0, 0, 0,
            tzinfo=timezone.utc,
        )
    )
    assert _shard_for_ms(contract, next_day_ms) != base_shard
