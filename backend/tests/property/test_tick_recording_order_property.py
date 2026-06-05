"""Property test for tick-recording ordering (task 6.5, design Property 6).

Asserts the Requirement 4.5 ordering guarantee on the `/ws/nt` ingestion path:
**every accepted trade is recorded to the Tick_Store before any UI-update
throttling occurs.** The seam exercised is the
:class:`~app.ingest.coordinator.IngestionCoordinator`, which records each
accepted trade to the Tick_Store immediately on ingestion; the WebSocket_Registry's
100-125ms coalescing flush sits downstream of that write.

To observe ordering without real time or a live socket the test wires the
coordinator with two fakes that append to one shared event log:

* a **fake Tick_Store** whose ``record_trade``/``record_quote`` append a
  ``("record", sequence)`` entry, and
* a **fake registry-flush seam** invoked after the coordinator returns each
  accepted decision, appending a ``("throttle", sequence)`` entry — standing in
  for the UI-throttle/registry enqueue+flush that happens downstream.

For an arbitrary stream of trades (with duplicates, reorderings, and gaps) the
test then asserts, over the shared log:

* every accepted trade's ``record`` entry happens-before its corresponding
  ``throttle`` entry (record precedes throttle for each accepted sequence);
* duplicates and out-of-order trades are neither recorded nor throttled
  (Req 4.2, 4.3), so the number of records equals the number of accepted trades
  (Property 6); and
* a gapped trade is still accepted and therefore recorded-before-throttled,
  matching the validator's accept-on-gap rule (Req 4.4).

**Validates: Requirements 4.5**
"""

from __future__ import annotations

import asyncio

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.ingest.coordinator import IngestionCoordinator
from app.ingest.sequence_validator import SeqOutcome
from app.models.canonical import NormalizedTrade

CONTRACT = "GC 08-26"
SYMBOL = "GC"
_BASE_MS = 1_730_000_000_000


class FakeTickStore:
    """Tick_Store double that logs the order of raw-record calls.

    Records every ``record_trade``/``record_quote`` into the shared ``log`` as
    ``("record", sequence)`` so the test can assert raw persistence happens
    before the downstream throttle entry. Duck-typed to the
    :class:`~app.ingest.coordinator.IngestionCoordinator` collaborator surface
    (only ``record_trade``/``record_quote`` are used on the accept path).
    """

    def __init__(self, log: list[tuple[str, int]]) -> None:
        self._log = log
        self.recorded: list[int] = []

    def record_trade(self, t: NormalizedTrade) -> None:
        self._log.append(("record", t.sequence))
        self.recorded.append(t.sequence)

    def record_quote(self, q) -> None:  # pragma: no cover - trades-only test
        self._log.append(("record", q.sequence))
        self.recorded.append(q.sequence)


def _trade(sequence: int) -> NormalizedTrade:
    return NormalizedTrade(
        symbol=SYMBOL,
        contract=CONTRACT,
        time=_BASE_MS + sequence,
        price=2345.6,
        volume=3,
        bid=2345.5,
        ask=2345.7,
        best_bid=2345.5,
        best_ask=2345.7,
        sequence=sequence,
    )


# Feature: gc-chart-platform, Property 6: Every accepted trade is recorded before throttling
@pytest.mark.property
@given(
    sequences=st.lists(
        st.integers(min_value=1, max_value=60), min_size=1, max_size=80
    )
)
def test_property_6_accepted_trade_recorded_before_throttle(
    sequences: list[int],
) -> None:
    log: list[tuple[str, int]] = []
    tick_store = FakeTickStore(log)
    coord = IngestionCoordinator(tick_store)

    async def drive() -> list[int]:
        """Feed trades; after each accepted decision, run the throttle seam.

        The throttle entry is appended only on an accepted decision, modeling
        the registry enqueue+flush that the design places strictly downstream of
        the raw-tick write. Discarded events never reach the throttle.
        """
        accepted: list[int] = []
        for seq in sequences:
            decision = await coord.on_trade(_trade(seq))
            if decision.accepted:
                accepted.append(seq)
                # Downstream UI throttle / registry flush for this update.
                log.append(("throttle", seq))
                assert decision.outcome in (SeqOutcome.ACCEPT, SeqOutcome.GAP)
            else:
                assert decision.outcome in (
                    SeqOutcome.DUPLICATE,
                    SeqOutcome.OUT_OF_ORDER,
                )
        return accepted

    accepted = asyncio.run(drive())

    records = [seq for kind, seq in log if kind == "record"]
    throttles = [seq for kind, seq in log if kind == "throttle"]

    # Only accepted trades are recorded; duplicates/out-of-order are dropped
    # and never persisted (Req 4.2, 4.3). Count parity == Property 6.
    assert records == accepted
    assert tick_store.recorded == accepted
    assert throttles == accepted

    # Happens-before: for every accepted trade, its record entry precedes its
    # throttle entry in the shared event log. We walk the log tracking, per
    # accepted sequence occurrence, that a record was seen before its throttle.
    pending_record = 0  # number of records not yet matched by a throttle
    for kind, _seq in log:
        if kind == "record":
            pending_record += 1
        else:  # "throttle": must be preceded by its (still-pending) record
            assert pending_record > 0, "throttle occurred before its tick was recorded"
            pending_record -= 1
    # Every record was eventually followed by exactly one throttle.
    assert pending_record == 0

    # Stronger global ordering: the record of the k-th accepted trade precedes
    # the throttle of the k-th accepted trade for all k (record-before-throttle
    # per accepted event, never interleaved out of order).
    record_positions = [i for i, (kind, _) in enumerate(log) if kind == "record"]
    throttle_positions = [i for i, (kind, _) in enumerate(log) if kind == "throttle"]
    assert len(record_positions) == len(throttle_positions) == len(accepted)
    assert all(r < t for r, t in zip(record_positions, throttle_positions))
