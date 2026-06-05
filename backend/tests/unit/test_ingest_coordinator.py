"""Unit tests for the ingestion coordinator (task 6.4).

Example-based coverage of the `/ws/nt` ingestion behavior added by task 6.4:

* every accepted trade/quote is recorded to the Tick_Store immediately on
  ingestion, before any UI-update throttling (Req 4.5),
* duplicates and out-of-order events are discarded and never recorded
  (Req 4.2, 4.3), and
* a Stream_Gap (sequence > highest + 1) records the gapped event AND emits a
  ``degraded`` status (reason ``stream_gap``) through the injected seam
  (Req 4.4).

Async coroutines are driven with ``asyncio.run``; the Tick_Store uses a real
on-disk temp shard tree (no mocks) so recording is verified end to end.
"""

from __future__ import annotations

import asyncio
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pytest

from app.ingest.coordinator import (
    GAP_DEGRADED_REASON,
    QUOTE_CHANNEL,
    TRADE_CHANNEL,
    IngestionCoordinator,
)
from app.ingest.sequence_validator import SeqOutcome, SequenceValidator, StreamId
from app.models.canonical import NormalizedQuote, NormalizedTrade
from app.models.messages import ChartStatusEvent, StatusState
from app.storage.tick_store import TickStore


def _ms(year, month, day, hour=0, minute=0, second=0) -> int:
    from app.models.timestamp import to_canonical_ms

    return to_canonical_ms(
        datetime(year, month, day, hour, minute, second, tzinfo=timezone.utc)
    )


def _trade(sequence: int, *, contract: str = "GC 08-26", time_ms: int | None = None):
    return NormalizedTrade(
        symbol="GC",
        contract=contract,
        time=time_ms if time_ms is not None else _ms(2026, 8, 1, 12, 0, 0),
        price=2345.6,
        volume=3,
        bid=2345.5,
        ask=2345.7,
        best_bid=2345.5,
        best_ask=2345.7,
        sequence=sequence,
    )


def _quote(sequence: int, *, contract: str = "GC 08-26", time_ms: int | None = None):
    return NormalizedQuote(
        symbol="GC",
        contract=contract,
        time=time_ms if time_ms is not None else _ms(2026, 8, 1, 12, 0, 0),
        bid=2345.5,
        ask=2345.7,
        bid_size=12,
        ask_size=9,
        sequence=sequence,
    )


@pytest.fixture
def tick_store(tmp_path: Path) -> TickStore:
    ts = TickStore(ticks_dir=tmp_path / "ticks")
    yield ts
    ts.close()


def _recorded_trade_sequences(store: TickStore, contract: str) -> list[int]:
    # Far-future upper bound that stays within SQLite/`timedelta` integer range.
    far_future = _ms(2100, 1, 1)
    return [t.sequence for t in store.read_range(contract, 0, far_future)]


# --- accepted ticks are recorded (Req 4.5) -----------------------------------


@pytest.mark.unit
def test_accepted_trades_are_recorded_to_tick_store(tick_store: TickStore):
    coord = IngestionCoordinator(tick_store)

    for seq in (1, 2, 3):
        asyncio.run(coord.on_trade(_trade(seq)))

    assert _recorded_trade_sequences(tick_store, "GC 08-26") == [1, 2, 3]


@pytest.mark.unit
def test_recorded_trade_count_equals_accepted_count(tick_store: TickStore):
    # In-order accepted trades: persisted count == accepted count (Property 6).
    coord = IngestionCoordinator(tick_store)
    decisions = [asyncio.run(coord.on_trade(_trade(seq))) for seq in range(1, 11)]
    accepted = sum(1 for d in decisions if d.accepted)
    assert accepted == 10
    assert len(_recorded_trade_sequences(tick_store, "GC 08-26")) == 10


@pytest.mark.unit
def test_accepted_quotes_are_recorded(tick_store: TickStore):
    coord = IngestionCoordinator(tick_store)

    asyncio.run(coord.on_quote(_quote(1)))
    asyncio.run(coord.on_quote(_quote(2)))

    # Quotes land in the quotes table of the shard; read them back directly.
    day = datetime(2026, 8, 1, tzinfo=timezone.utc).date()
    path = tick_store.shard_path("GC 08-26", day)
    conn = sqlite3.connect(path)
    try:
        rows = conn.execute("SELECT sequence FROM quotes ORDER BY sequence").fetchall()
    finally:
        conn.close()
    assert [r[0] for r in rows] == [1, 2]


# --- duplicates / out-of-order are not recorded (Req 4.2, 4.3) ---------------


@pytest.mark.unit
def test_duplicate_and_out_of_order_trades_are_not_recorded(tick_store: TickStore):
    coord = IngestionCoordinator(tick_store)

    asyncio.run(coord.on_trade(_trade(1)))
    asyncio.run(coord.on_trade(_trade(2)))
    dup = asyncio.run(coord.on_trade(_trade(2)))  # duplicate
    ooo = asyncio.run(coord.on_trade(_trade(1)))  # out of order

    assert dup.outcome is SeqOutcome.DUPLICATE
    assert ooo.outcome is SeqOutcome.OUT_OF_ORDER
    # Only the two accepted trades were persisted.
    assert _recorded_trade_sequences(tick_store, "GC 08-26") == [1, 2]


# --- gap detection records the event AND emits degraded (Req 4.4) ------------


@pytest.mark.unit
def test_gap_records_event_and_emits_degraded_status(tick_store: TickStore):
    events: list[ChartStatusEvent] = []
    coord = IngestionCoordinator(
        tick_store, emit_degraded=events.append, clock=lambda: 999
    )

    asyncio.run(coord.on_trade(_trade(1)))
    decision = asyncio.run(coord.on_trade(_trade(5)))  # gap: 2,3,4 missing

    assert decision.outcome is SeqOutcome.GAP
    # The gapped event is still accepted and recorded.
    assert _recorded_trade_sequences(tick_store, "GC 08-26") == [1, 5]
    # Exactly one degraded status emitted, with the documented reason/contract.
    assert len(events) == 1
    evt = events[0]
    assert evt.state is StatusState.DEGRADED
    assert evt.reason == GAP_DEGRADED_REASON
    assert evt.contract == "GC 08-26"
    assert evt.time == 999


@pytest.mark.unit
def test_no_degraded_status_for_in_order_stream(tick_store: TickStore):
    events: list[ChartStatusEvent] = []
    coord = IngestionCoordinator(tick_store, emit_degraded=events.append)

    for seq in (1, 2, 3, 4):
        asyncio.run(coord.on_trade(_trade(seq)))

    assert events == []


@pytest.mark.unit
def test_async_degraded_seam_is_awaited(tick_store: TickStore):
    events: list[ChartStatusEvent] = []

    async def emit(evt: ChartStatusEvent) -> None:
        events.append(evt)

    coord = IngestionCoordinator(tick_store, emit_degraded=emit)

    asyncio.run(coord.on_trade(_trade(1)))
    asyncio.run(coord.on_trade(_trade(10)))

    assert len(events) == 1
    assert events[0].state is StatusState.DEGRADED


@pytest.mark.unit
def test_gap_without_seam_still_records_without_error(tick_store: TickStore):
    # No seam wired: gap still accepts + records, no status push, no error.
    coord = IngestionCoordinator(tick_store)

    asyncio.run(coord.on_trade(_trade(1)))
    decision = asyncio.run(coord.on_trade(_trade(7)))

    assert decision.outcome is SeqOutcome.GAP
    assert _recorded_trade_sequences(tick_store, "GC 08-26") == [1, 7]


# --- streams are independent (trade vs quote channels) -----------------------


@pytest.mark.unit
def test_trade_and_quote_streams_are_independent(tick_store: TickStore):
    # Same sequence numbers on the trade and quote channels must not collide:
    # both are accepted because they are distinct Streams. (Req 1.3)
    coord = IngestionCoordinator(tick_store)

    d_trade = asyncio.run(coord.on_trade(_trade(1)))
    d_quote = asyncio.run(coord.on_quote(_quote(1)))

    assert d_trade.outcome is SeqOutcome.ACCEPT
    assert d_quote.outcome is SeqOutcome.ACCEPT
    assert coord.validator.highest(StreamId("GC", "GC 08-26", TRADE_CHANNEL)) == 1
    assert coord.validator.highest(StreamId("GC", "GC 08-26", QUOTE_CHANNEL)) == 1


# --- handlers() bundle plugs into the endpoint -------------------------------


@pytest.mark.unit
def test_handlers_bundle_routes_trades_and_quotes(tick_store: TickStore):
    coord = IngestionCoordinator(tick_store)
    handlers = coord.handlers()

    # Bound methods compare equal when bound to the same instance + function.
    assert handlers.on_trade == coord.on_trade
    assert handlers.on_quote == coord.on_quote
    assert handlers.on_status is None
    assert handlers.on_heartbeat is None

    asyncio.run(handlers.on_trade(_trade(1)))
    assert _recorded_trade_sequences(tick_store, "GC 08-26") == [1]
