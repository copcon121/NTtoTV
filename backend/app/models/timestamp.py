"""Canonical_Timestamp helpers.

The Canonical_Timestamp is the single time representation used across the
Backend and storage for merging, ordering, bucketing, and reference-indicator
parity. It is defined as the **integer number of milliseconds since the Unix
epoch in UTC** and is equivalent to ISO-8601 UTC at millisecond precision.
(Glossary: Canonical_Timestamp; Requirements 1.1, 1.2, 13.8, 14.9, 15.2, 15.6)

This module provides:

* ``datetime`` <-> ms-since-epoch-UTC conversions (``to_canonical_ms`` /
  ``from_canonical_ms``) plus the ISO-8601 equivalence (``to_iso8601`` /
  ``from_iso8601``).
* comparison helpers (``compare``, ``is_before``, ``is_after``,
  ``is_same_instant``, ``earliest``, ``latest``) used by merge and parity logic
  so timestamp ordering is expressed consistently everywhere.

Conversions are exact at millisecond resolution; any sub-millisecond component
of a ``datetime`` is floored (truncated toward the epoch start, matching
``timedelta`` normalization) so that round-tripping is stable.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

# A Canonical_Timestamp is simply an integer count of milliseconds since the
# Unix epoch in UTC. The alias documents intent at call sites.
CanonicalTimestamp = int

MS_PER_SECOND = 1000

# Anchor used for exact integer ms conversions (avoids float rounding error
# that ``datetime.timestamp() * 1000`` would introduce for large values).
_EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)

__all__ = [
    "CanonicalTimestamp",
    "MS_PER_SECOND",
    "now_ms",
    "to_canonical_ms",
    "from_canonical_ms",
    "to_iso8601",
    "from_iso8601",
    "compare",
    "is_before",
    "is_after",
    "is_same_instant",
    "earliest",
    "latest",
]


def now_ms() -> int:
    """Return the current time as a Canonical_Timestamp (ms since epoch UTC)."""
    return to_canonical_ms(datetime.now(timezone.utc))


def to_canonical_ms(dt: datetime) -> int:
    """Convert a ``datetime`` to a Canonical_Timestamp (ms since epoch UTC).

    A timezone-naive ``datetime`` is interpreted as UTC. Timezone-aware
    ``datetime`` values are converted to UTC before measuring the offset from
    the epoch. Sub-millisecond precision is floored so the result is exact at
    millisecond resolution.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    delta = dt - _EPOCH
    # ``timedelta`` normalizes so that ``seconds`` and ``microseconds`` are
    # non-negative (``days`` carries the sign); integer math keeps this exact.
    return (
        delta.days * 86_400_000
        + delta.seconds * MS_PER_SECOND
        + delta.microseconds // 1000
    )


def from_canonical_ms(ms: int) -> datetime:
    """Convert a Canonical_Timestamp (ms since epoch UTC) to an aware UTC ``datetime``."""
    return _EPOCH + timedelta(milliseconds=ms)


def to_iso8601(ms: int) -> str:
    """Render a Canonical_Timestamp as ISO-8601 UTC with millisecond precision."""
    return from_canonical_ms(ms).isoformat(timespec="milliseconds")


def from_iso8601(value: str) -> int:
    """Parse an ISO-8601 timestamp into a Canonical_Timestamp (ms since epoch UTC).

    A value without an explicit offset is interpreted as UTC.
    """
    return to_canonical_ms(datetime.fromisoformat(value))


def compare(a: int, b: int) -> int:
    """Three-way compare two Canonical_Timestamps.

    Returns ``-1`` if ``a`` precedes ``b``, ``1`` if it follows, ``0`` if they
    are the same instant. Used by merge/parity logic to order events.
    """
    if a < b:
        return -1
    if a > b:
        return 1
    return 0


def is_before(a: int, b: int) -> bool:
    """Return ``True`` if Canonical_Timestamp ``a`` strictly precedes ``b``."""
    return a < b


def is_after(a: int, b: int) -> bool:
    """Return ``True`` if Canonical_Timestamp ``a`` strictly follows ``b``."""
    return a > b


def is_same_instant(a: int, b: int) -> bool:
    """Return ``True`` if two Canonical_Timestamps denote the same instant.

    This is the equality used by BigTrade merge keys and parity comparisons,
    where two events that share a Canonical_Timestamp are treated as
    simultaneous. (Requirement 15.2)
    """
    return a == b


def earliest(*timestamps: int) -> int:
    """Return the earliest of the given Canonical_Timestamps."""
    if not timestamps:
        raise ValueError("earliest() requires at least one timestamp")
    return min(timestamps)


def latest(*timestamps: int) -> int:
    """Return the latest of the given Canonical_Timestamps."""
    if not timestamps:
        raise ValueError("latest() requires at least one timestamp")
    return max(timestamps)
