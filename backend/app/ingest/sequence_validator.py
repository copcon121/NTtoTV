"""Per-Stream sequence validator (task 6.2).

Validates the monotonic per-Stream sequence numbers assigned by the NT_AddOn
(Req 1.3) as events arrive on `/ws/nt`, classifying each event as one of
``ACCEPT`` / ``DUPLICATE`` / ``OUT_OF_ORDER`` / ``GAP`` and maintaining the
highest processed sequence per Stream:

* **DUPLICATE** — the sequence equals the highest already processed; discard it
  silently (no degraded status). (Req 4.2)
* **OUT_OF_ORDER** — the sequence is below the highest already processed;
  discard it silently. We do not stall waiting for missing events that may never
  arrive, so anything below the highest is dropped even if it would fill a known
  gap. (Req 4.3)
* **ACCEPT** — the sequence is exactly ``highest + 1`` (or this is the first
  event ever seen for the Stream); accept the event and advance the highest.
* **GAP** — the sequence is greater than ``highest + 1``; record exactly one
  :data:`Stream_Gap` with ``gap_from = previous highest``,
  ``gap_to = received sequence`` and ``missing = gap_to - gap_from - 1``, mark
  the Stream's derived data non-contiguous, accept the gapped event and advance
  the highest to the received sequence. (Req 4.4)

A **Stream** is the tuple ``(symbol, contract, channel)`` with
``channel ∈ {trade, quote}``; sequences are monotonic within a Stream and
independent across Streams (Req 1.3, Glossary: Stream/Sequence/Stream_Gap).

Durability: the highest processed sequence per Stream is kept in memory for the
hot path and written through to the Cache_Store ``metadata`` table (key
``highest_seq:<symbol>:<contract>:<channel>``) so it survives a restart; the
non-contiguous marker (key ``noncontiguous:<symbol>:<contract>:<channel>``) and
every Stream_Gap (``stream_gaps`` table) are persisted via the same single
writer. When constructed with a Cache_Store the validator hydrates its
in-memory bookmarks from ``metadata`` on startup.

Out of scope here (wired by later tasks): recording raw ticks before throttling
(task 6.4) and emitting the degraded status event to subscribed clients (tasks
6.4 / 9.3 / 20.1). This module only returns the decision and persists the gap /
metadata; the caller acts on :meth:`SeqDecision.accepted` and on a ``GAP``
outcome to record ticks and emit status.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import Enum

from ..models.timestamp import CanonicalTimestamp, now_ms
from ..storage.cache_store import CacheStore

logger = logging.getLogger(__name__)

__all__ = [
    "SeqOutcome",
    "SeqDecision",
    "StreamId",
    "SequenceValidator",
]


class SeqOutcome(str, Enum):
    """The four possible outcomes of validating one sequence. (Req 4.2-4.4)"""

    ACCEPT = "accept"
    DUPLICATE = "duplicate"
    OUT_OF_ORDER = "out_of_order"
    GAP = "gap"

    def __str__(self) -> str:  # pragma: no cover - cosmetic
        return self.value


@dataclass(frozen=True, slots=True)
class SeqDecision:
    """The decision produced by :meth:`SequenceValidator.evaluate`.

    ``gap_from`` / ``gap_to`` are populated only for a ``GAP`` outcome and carry
    the previous highest and the received sequence respectively; ``missing`` is
    then ``gap_to - gap_from - 1``. :attr:`accepted` is ``True`` for both
    ``ACCEPT`` and ``GAP`` (the gapped event is still processed). (Req 4.4)
    """

    outcome: SeqOutcome
    gap_from: int | None = None
    gap_to: int | None = None

    @property
    def accepted(self) -> bool:
        """Whether the event should be processed (``ACCEPT`` or ``GAP``)."""
        return self.outcome in (SeqOutcome.ACCEPT, SeqOutcome.GAP)

    @property
    def missing(self) -> int | None:
        """Count of missing sequences for a ``GAP`` outcome, else ``None``."""
        if self.outcome is SeqOutcome.GAP:
            assert self.gap_from is not None and self.gap_to is not None
            return self.gap_to - self.gap_from - 1
        return None

    @classmethod
    def accept(cls) -> "SeqDecision":
        return cls(SeqOutcome.ACCEPT)

    @classmethod
    def duplicate(cls) -> "SeqDecision":
        return cls(SeqOutcome.DUPLICATE)

    @classmethod
    def out_of_order(cls) -> "SeqDecision":
        return cls(SeqOutcome.OUT_OF_ORDER)

    @classmethod
    def gap(cls, gap_from: int, gap_to: int) -> "SeqDecision":
        return cls(SeqOutcome.GAP, gap_from=gap_from, gap_to=gap_to)


@dataclass(frozen=True, slots=True)
class StreamId:
    """Identity of a Stream: the tuple ``(symbol, contract, channel)``.

    ``channel`` is ``"trade"`` or ``"quote"``. Frozen + slotted so it is a
    hashable key for the validator's per-Stream state. Sequences are independent
    across distinct :class:`StreamId` values (Req 1.3).
    """

    symbol: str
    contract: str
    channel: str

    @property
    def bookmark_key(self) -> str:
        """Cache_Store ``metadata`` key for this Stream's highest-seq bookmark.

        The design documents ``highest_seq:<contract>:<channel>``; the symbol is
        included here so the full ``(symbol, contract, channel)`` Stream tuple
        round-trips through ``metadata`` and streams stay independent per Req 1.3
        (the GC-only MVP always uses symbol ``"GC"``).
        """
        return f"highest_seq:{self.symbol}:{self.contract}:{self.channel}"

    @property
    def noncontiguous_key(self) -> str:
        """Cache_Store ``metadata`` key for this Stream's non-contiguous marker."""
        return f"noncontiguous:{self.symbol}:{self.contract}:{self.channel}"


# Metadata upsert (last-write-wins on the ``key`` primary key).
_UPSERT_METADATA = """
INSERT INTO metadata (key, value, updated_at)
VALUES (?, ?, ?)
ON CONFLICT(key) DO UPDATE SET
    value=excluded.value,
    updated_at=excluded.updated_at
"""

# One Stream_Gap row per detected discontinuity (Req 4.4).
_INSERT_STREAM_GAP = """
INSERT INTO stream_gaps
    (symbol, contract, channel, gap_from, gap_to, missing, time)
VALUES (?, ?, ?, ?, ?, ?, ?)
"""

_BOOKMARK_PREFIX = "highest_seq:"


class SequenceValidator:
    """Validates per-Stream sequences and persists gaps + bookmarks. (Req 4.2-4.4)

    The hot-path :meth:`evaluate` is synchronous and CPU-bound (no ``await``):
    it reads/advances the in-memory highest sequence for the Stream and, when a
    Cache_Store is attached, writes through the highest-seq bookmark and (on a
    gap) the Stream_Gap row plus the non-contiguous marker via the store's
    :class:`~app.storage.connection.SingleWriter`.

    When ``store`` is ``None`` the validator runs purely in memory (useful for
    isolated decision-logic tests); all persistence is then skipped.
    """

    def __init__(self, store: CacheStore | None = None) -> None:
        self._store = store
        # Highest processed sequence per Stream. Absence of a key means the
        # Stream has not been seen yet (its first event is always accepted).
        self._highest: dict[StreamId, int] = {}
        if store is not None:
            self._hydrate_from_metadata(store)

    # -- public API -----------------------------------------------------------

    def highest(self, stream: StreamId) -> int | None:
        """Return the highest processed sequence for ``stream``, or ``None``."""
        return self._highest.get(stream)

    def reset_stream(self, stream: StreamId) -> None:
        """Forget the highest-seq bookmark for ``stream`` (playback rewind).

        After a reset the next event for the Stream is accepted as the first
        event (re-seeding the high-water mark), so a replayed stream that
        restarts its sequence numbering is not rejected as out-of-order. Clears
        the in-memory mark and the persisted bookmark/non-contiguous marker.
        """
        self._highest.pop(stream, None)
        if self._store is not None:
            try:
                self._store.set_metadata(stream.bookmark_key, "", now_ms())
                self._store.set_metadata(stream.noncontiguous_key, "", now_ms())
            except Exception:  # pragma: no cover - best effort
                pass

    def evaluate(
        self,
        stream: StreamId,
        sequence: int,
        *,
        time_ms: CanonicalTimestamp | None = None,
    ) -> SeqDecision:
        """Validate ``sequence`` for ``stream`` and update/persist state.

        Returns the :class:`SeqDecision`. ``time_ms`` is the Canonical_Timestamp
        recorded on a Stream_Gap row (defaults to the current time). The four
        branches are a total partition of the integer line relative to the
        Stream's current highest, evaluated in the order documented by the
        design's sequence-gap state machine. (Req 4.2, 4.3, 4.4)
        """
        prev = self._highest.get(stream)

        # First event ever seen for this Stream: accept and seed the highest.
        # (Req 4.4: "or is the first event")
        if prev is None:
            self._advance(stream, sequence)
            return SeqDecision.accept()

        if sequence == prev:
            # Already processed -> duplicate; discard silently. (Req 4.2)
            return SeqDecision.duplicate()

        if sequence < prev:
            # Below the highest processed -> out of order; discard. (Req 4.3)
            return SeqDecision.out_of_order()

        if sequence == prev + 1:
            # The expected next sequence -> accept and advance. (Req 4.4)
            self._advance(stream, sequence)
            return SeqDecision.accept()

        # sequence > prev + 1 -> a Stream_Gap. Record exactly one gap, mark the
        # Stream non-contiguous, accept the gapped event and advance. (Req 4.4)
        decision = SeqDecision.gap(gap_from=prev, gap_to=sequence)
        when = now_ms() if time_ms is None else time_ms
        self._record_gap(stream, decision, when)
        self._advance(stream, sequence)
        return decision

    # -- internal state + persistence -----------------------------------------

    def _advance(self, stream: StreamId, sequence: int) -> None:
        """Set the in-memory highest and write through the durable bookmark."""
        self._highest[stream] = sequence
        if self._store is not None:
            self._write_metadata(stream.bookmark_key, str(sequence))

    def _record_gap(
        self, stream: StreamId, decision: SeqDecision, when: CanonicalTimestamp
    ) -> None:
        """Log, persist the Stream_Gap row, and set the non-contiguous marker."""
        gap_from = decision.gap_from
        gap_to = decision.gap_to
        missing = decision.missing
        logger.warning(
            "Stream_Gap on %s:%s:%s gap_from=%s gap_to=%s missing=%s",
            stream.symbol,
            stream.contract,
            stream.channel,
            gap_from,
            gap_to,
            missing,
        )
        if self._store is None:
            return
        writer = self._store.writer
        # One Stream_Gap row recording the range and missing count. (Req 4.4)
        writer.execute(
            _INSERT_STREAM_GAP,
            (
                stream.symbol,
                stream.contract,
                stream.channel,
                gap_from,
                gap_to,
                missing,
                when,
            ),
        )
        # Mark the Stream's derived data non-contiguous so downstream consumers
        # can flag it. (Req 4.4)
        self._write_metadata(stream.noncontiguous_key, "1", updated_at=when)

    def _write_metadata(
        self, key: str, value: str, *, updated_at: CanonicalTimestamp | None = None
    ) -> None:
        """Upsert a single ``metadata`` row through the single writer."""
        assert self._store is not None
        ts = now_ms() if updated_at is None else updated_at
        self._store.writer.execute(_UPSERT_METADATA, (key, value, ts))

    def _hydrate_from_metadata(self, store: CacheStore) -> None:
        """Load persisted highest-seq bookmarks so state survives a restart.

        Reads every ``highest_seq:<symbol>:<contract>:<channel>`` row from
        ``metadata`` and rebuilds the in-memory map. Malformed keys are skipped
        defensively. (Req 4.4: bookmarks survive restart)
        """
        conn = store.reader()
        try:
            rows = conn.execute(
                "SELECT key, value FROM metadata WHERE key LIKE ?",
                (_BOOKMARK_PREFIX + "%",),
            ).fetchall()
        finally:
            conn.close()
        for row in rows:
            stream = self._parse_bookmark_key(row["key"])
            if stream is None:
                continue
            try:
                self._highest[stream] = int(row["value"])
            except (TypeError, ValueError):
                logger.warning("Skipping non-integer highest_seq bookmark: %r", row["key"])

    @staticmethod
    def _parse_bookmark_key(key: str) -> StreamId | None:
        """Parse ``highest_seq:<symbol>:<contract>:<channel>`` into a StreamId.

        Returns ``None`` for keys that do not match the expected shape. Splits
        from the right so a (rare) ``:`` inside a contract identifier still
        yields the correct channel and symbol.
        """
        if not key.startswith(_BOOKMARK_PREFIX):
            return None
        body = key[len(_BOOKMARK_PREFIX) :]
        symbol, sep, rest = body.partition(":")
        if not sep:
            return None
        contract, sep, channel = rest.rpartition(":")
        if not sep or not contract or not channel:
            return None
        return StreamId(symbol=symbol, contract=contract, channel=channel)
