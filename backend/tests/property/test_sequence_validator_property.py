"""Property test for the per-Stream sequence validator (task 6.3, design Property 5).

Generates arbitrary per-Stream sequence *arrival orders* — including
duplicates, reorderings, and gaps — interleaved across multiple **independent**
Streams, and feeds them through a single
:class:`~app.ingest.sequence_validator.SequenceValidator`. For every arrival the
test compares the validator's :class:`SeqDecision` against an independent
per-Stream oracle and asserts:

* a sequence equal to the Stream's current highest -> ``DUPLICATE`` (discarded);
* a sequence below the highest -> ``OUT_OF_ORDER`` (discarded);
* a sequence equal to ``highest + 1`` (or the first event ever for the Stream)
  -> ``ACCEPT`` and the highest advances;
* a sequence greater than ``highest + 1`` -> ``GAP`` with
  ``gap_from = previous highest``, ``gap_to = received`` and
  ``missing = gap_to - gap_from - 1``, after which the highest advances to the
  received sequence;
* Streams are independent: a Stream's decisions depend only on that Stream's own
  prior arrivals, so replaying one Stream's events in isolation reproduces the
  identical decisions and highest seen in the interleaved run;
* the set of accepted sequences forms the expected monotonic frontier — the
  accepted sequences for a Stream are strictly increasing in accept order and
  the final highest equals the greatest accepted sequence.

**Validates: Requirements 1.3, 4.2, 4.3, 4.4**
"""

from __future__ import annotations

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.ingest.sequence_validator import (
    SeqDecision,
    SeqOutcome,
    SequenceValidator,
    StreamId,
)

# A pool of distinct Streams. It deliberately includes the same contract on two
# channels (``GC 08-26`` trade + quote) so the test also exercises that Streams
# sharing a contract but differing in channel are independent. (Req 1.3)
_STREAM_POOL: list[StreamId] = [
    StreamId("GC", "GC 08-26", "trade"),
    StreamId("GC", "GC 08-26", "quote"),
    StreamId("GC", "GC 10-26", "trade"),
    StreamId("GC", "GC 12-26", "quote"),
]


@st.composite
def event_logs(draw: st.DrawFn) -> tuple[list[StreamId], list[tuple[StreamId, int]]]:
    """Generate ``(streams, events)`` interleaving several independent Streams.

    Picks a non-empty subset of the distinct Stream pool, then builds a flat
    arrival log of ``(stream, sequence)`` events. Sequences are drawn from a
    small range so duplicates, reorderings, and gaps all occur with high
    probability across a run, and the global list order is the (arbitrary)
    arrival order the validator must cope with.
    """
    indices = draw(
        st.lists(
            st.integers(min_value=0, max_value=len(_STREAM_POOL) - 1),
            min_size=1,
            max_size=len(_STREAM_POOL),
            unique=True,
        )
    )
    streams = [_STREAM_POOL[i] for i in indices]

    n_events = draw(st.integers(min_value=1, max_value=80))
    events: list[tuple[StreamId, int]] = []
    for _ in range(n_events):
        stream = streams[draw(st.integers(min_value=0, max_value=len(streams) - 1))]
        sequence = draw(st.integers(min_value=1, max_value=40))
        events.append((stream, sequence))
    return streams, events


def _classify(prev: int | None, sequence: int) -> SeqDecision:
    """Oracle: the decision a correct validator must produce for ``sequence``.

    Mirrors the design's sequence-gap state machine relative to the Stream's
    current highest ``prev`` (``None`` when the Stream has not been seen yet).
    """
    if prev is None:
        return SeqDecision.accept()
    if sequence == prev:
        return SeqDecision.duplicate()
    if sequence < prev:
        return SeqDecision.out_of_order()
    if sequence == prev + 1:
        return SeqDecision.accept()
    return SeqDecision.gap(gap_from=prev, gap_to=sequence)


# Feature: gc-chart-platform, Property 5: Sequence validator deduplicates, drops out-of-order, and detects gaps
@pytest.mark.property
@given(log=event_logs())
def test_property_5_sequence_validator(
    log: tuple[list[StreamId], list[tuple[StreamId, int]]],
) -> None:
    streams, events = log
    validator = SequenceValidator()  # in-memory only; pure decision logic

    highest: dict[StreamId, int] = {}
    accepted_order: dict[StreamId, list[int]] = {s: [] for s in streams}
    # Per-Stream decision trace (outcome + gap facets) in arrival order, used to
    # prove independence against an isolated single-Stream replay below.
    interleaved_trace: dict[StreamId, list[tuple[SeqOutcome, int | None, int | None]]]
    interleaved_trace = {s: [] for s in streams}

    for stream, sequence in events:
        prev = highest.get(stream)
        expected = _classify(prev, sequence)
        decision = validator.evaluate(stream, sequence)

        # The validator's classification matches the oracle exactly.
        assert decision.outcome is expected.outcome
        assert decision.gap_from == expected.gap_from
        assert decision.gap_to == expected.gap_to

        if decision.outcome is SeqOutcome.DUPLICATE:
            # Duplicate == current highest, discarded, frontier unchanged. (Req 4.2)
            assert sequence == prev
            assert not decision.accepted
            assert decision.missing is None
        elif decision.outcome is SeqOutcome.OUT_OF_ORDER:
            # Below the highest, discarded, frontier unchanged. (Req 4.3)
            assert prev is not None and sequence < prev
            assert not decision.accepted
            assert decision.missing is None
        elif decision.outcome is SeqOutcome.ACCEPT:
            # First event, or exactly highest+1: accepted and advances. (Req 4.4)
            assert prev is None or sequence == prev + 1
            assert decision.accepted
            assert decision.missing is None
            highest[stream] = sequence
            accepted_order[stream].append(sequence)
        else:  # SeqOutcome.GAP (Req 4.4)
            assert prev is not None and sequence > prev + 1
            assert decision.gap_from == prev
            assert decision.gap_to == sequence
            assert decision.missing == sequence - prev - 1
            assert decision.accepted  # the gapped event is still processed
            highest[stream] = sequence
            accepted_order[stream].append(sequence)

        # The in-memory highest tracks the oracle after every arrival.
        assert validator.highest(stream) == highest.get(stream)
        interleaved_trace[stream].append(
            (decision.outcome, decision.gap_from, decision.gap_to)
        )

    for stream in streams:
        accepted = accepted_order[stream]

        # Monotonic frontier: accepted sequences strictly increase in accept
        # order, and the final highest is the greatest accepted sequence.
        assert all(a < b for a, b in zip(accepted, accepted[1:]))
        if accepted:
            assert validator.highest(stream) == accepted[-1] == max(accepted)
        else:
            assert validator.highest(stream) is None

        # Independence: replaying just this Stream's arrivals (in their original
        # relative order) through a fresh validator yields the identical
        # decision trace and final highest — the interleaving of other Streams
        # had no effect. (Req 1.3)
        isolated = SequenceValidator()
        isolated_trace: list[tuple[SeqOutcome, int | None, int | None]] = []
        for s, sequence in events:
            if s == stream:
                d = isolated.evaluate(s, sequence)
                isolated_trace.append((d.outcome, d.gap_from, d.gap_to))
        assert isolated_trace == interleaved_trace[stream]
        assert isolated.highest(stream) == validator.highest(stream)
