"""Ingestion coordinator: validate → record raw tick before throttling → degraded seam (task 6.4).

This module ties together the pieces produced by tasks 6.1 and 6.2 and adds the
behavior required by Requirements 4.4 and 4.5 on the `/ws/nt` ingestion path:

* **Record every accepted tick before throttling (Req 4.5).** Each decoded
  trade/quote frame is run through the :class:`~app.ingest.sequence_validator.
  SequenceValidator`; when the decision is *accepted* (``ACCEPT`` **or**
  ``GAP`` — a gapped event is still processed) the raw record is written to the
  :class:`~app.storage.tick_store.TickStore` **immediately on ingestion**,
  before any UI-update throttling occurs. The WebSocket_Registry's 100–125ms
  coalescing flush (task 8.x) sits downstream of this write, so raw persistence
  is never gated by the throttle. Duplicates and out-of-order events are
  discarded and never recorded (Req 4.2, 4.3), so the number of trades
  persisted equals the number of accepted trades (Property 6).

* **Emit a degraded status on gap detection (Req 4.4).** When the validator
  reports a ``GAP`` (sequence > highest + 1) the coordinator builds a
  :class:`~app.models.messages.ChartStatusEvent` (``state=degraded``,
  ``reason="stream_gap"``) and hands it to a thin **degraded-status seam**
  callback. The seam — rather than a hard-wired WebSocket_Registry — keeps this
  task standalone; the full registry broadcast is connected in task 20.1.

The coordinator exposes :meth:`IngestionCoordinator.handlers`, an
:class:`~app.ingest.endpoint.IngestHandlers` bundle that plugs directly into the
:class:`~app.ingest.endpoint.IngestEndpoint` receive loop. Engine dispatch (bar
aggregation, order-flow, alerts) is intentionally **out of scope** here and is
wired into the same handlers during full pipeline integration (task 20.1).

(Requirements 4.4, 4.5; design "Live Tick Ingestion" + "Sequence-Gap Handling")
"""

from __future__ import annotations

import asyncio
import inspect
import logging
from typing import Awaitable, Callable

from ..models.canonical import NormalizedQuote, NormalizedTrade
from ..models.messages import ChartStatusEvent, StatusState
from ..models.timestamp import CanonicalTimestamp, now_ms
from ..storage.tick_store import TickStore
from .endpoint import IngestHandlers
from .sequence_validator import SeqDecision, SeqOutcome, SequenceValidator, StreamId

logger = logging.getLogger(__name__)

__all__ = [
    "TRADE_CHANNEL",
    "QUOTE_CHANNEL",
    "GAP_DEGRADED_REASON",
    "DegradedStatusEmitter",
    "IngestionCoordinator",
]

# Stream channels (the third element of a Stream tuple). (Glossary: Stream)
TRADE_CHANNEL = "trade"
QUOTE_CHANNEL = "quote"

# ``reason`` carried by the degraded status emitted on a Stream_Gap, matching
# the design's `/ws/chart` status example. (Req 4.4)
GAP_DEGRADED_REASON = "stream_gap"

# The degraded-status seam. Given the prepared ChartStatusEvent, deliver it to
# subscribed Frontend clients. May be sync or async; task 20.1 supplies a
# callback that enqueues onto the WebSocket_Registry broadcast.
DegradedStatusEmitter = Callable[[ChartStatusEvent], Awaitable[None] | None]


async def _maybe_await(result: Awaitable[None] | None) -> None:
    """Await ``result`` when the seam returned an awaitable; otherwise no-op."""
    if inspect.isawaitable(result):
        await result


class IngestionCoordinator:
    """Coordinates per-frame validation, raw recording, and the degraded seam.

    For each decoded `/ws/nt` data frame the coordinator:

    1. resolves the frame's Stream ``(symbol, contract, channel)``,
    2. runs :meth:`SequenceValidator.evaluate` (dedup / out-of-order / accept /
       gap — task 6.2),
    3. on an *accepted* decision (``ACCEPT`` or ``GAP``) records the raw
       trade/quote to the Tick_Store **before any throttling** (Req 4.5), and
    4. on a ``GAP`` decision emits a ``degraded`` status through the injected
       seam (Req 4.4).

    Collaborators are injected so the coordinator is testable in isolation and
    composes cleanly during full wiring (task 20.1):

    * ``tick_store`` — the day-sharded :class:`TickStore` raw writer.
    * ``validator`` — the per-Stream :class:`SequenceValidator` (defaults to a
      fresh in-memory validator when omitted).
    * ``emit_degraded`` — the degraded-status seam; when ``None`` gap detection
      still records the Stream_Gap (inside the validator) but no status is
      pushed (useful for isolated recording tests).
    * ``clock`` — injectable Canonical_Timestamp source for the status event's
      detection time.
    """

    def __init__(
        self,
        tick_store: TickStore,
        validator: SequenceValidator | None = None,
        *,
        emit_degraded: DegradedStatusEmitter | None = None,
        clock: Callable[[], CanonicalTimestamp] = now_ms,
    ) -> None:
        self._tick_store = tick_store
        self._validator = validator if validator is not None else SequenceValidator()
        self._emit_degraded = emit_degraded
        self._clock = clock

    @property
    def validator(self) -> SequenceValidator:
        """The per-Stream sequence validator used by this coordinator."""
        return self._validator

    def handlers(self) -> IngestHandlers:
        """Return the :class:`IngestHandlers` bundle for the ingestion endpoint.

        Wires :meth:`on_trade` / :meth:`on_quote` so an
        :class:`~app.ingest.endpoint.IngestEndpoint` routes decoded frames
        through validation + recording + the degraded seam. Status and
        heartbeat handling are left to other seams (status forwarding is task
        20.1; the liveness watchdog is task 6.6).
        """
        return IngestHandlers(on_trade=self.on_trade, on_quote=self.on_quote)

    async def on_trade(self, trade: NormalizedTrade) -> SeqDecision:
        """Validate, record (if accepted), and emit degraded on gap. (Req 4.4, 4.5)

        Records the raw trade to the Tick_Store the moment it is accepted —
        before any UI-update throttling downstream — so every accepted trade is
        persisted regardless of the registry flush cadence (Req 4.5). Returns
        the :class:`SeqDecision` so callers (and task 20.1's engine dispatch)
        can act on the outcome.
        """
        stream = StreamId(trade.symbol, trade.contract, TRADE_CHANNEL)
        decision = self._validator.evaluate(stream, trade.sequence, time_ms=trade.time)
        if decision.accepted:
            # Persist the raw tick immediately on ingestion, BEFORE throttling.
            # (Req 4.5; Property 6)
            await asyncio.to_thread(self._tick_store.record_trade, trade)
        if decision.outcome is SeqOutcome.GAP:
            await self._emit_degraded_status(trade.contract)
        return decision

    async def on_quote(self, quote: NormalizedQuote) -> SeqDecision:
        """Validate, record (if accepted), and emit degraded on gap. (Req 4.4, 4.5)

        Quotes are recorded on their own Stream (``channel="quote"``) and follow
        the same accept-before-throttle persistence rule as trades.
        """
        stream = StreamId(quote.symbol, quote.contract, QUOTE_CHANNEL)
        decision = self._validator.evaluate(stream, quote.sequence, time_ms=quote.time)
        if decision.accepted:
            await asyncio.to_thread(self._tick_store.record_quote, quote)
        if decision.outcome is SeqOutcome.GAP:
            await self._emit_degraded_status(quote.contract)
        return decision

    async def _emit_degraded_status(self, contract: str) -> None:
        """Push a ``degraded`` status through the seam on a Stream_Gap. (Req 4.4)

        No-op when no seam is wired. The event carries ``reason="stream_gap"``
        and the affected ``contract`` so the Frontend can show data is flowing
        but non-contiguous (distinct from ``disconnected``).
        """
        if self._emit_degraded is None:
            return
        event = ChartStatusEvent(
            state=StatusState.DEGRADED,
            time=self._clock(),
            reason=GAP_DEGRADED_REASON,
            contract=contract,
        )
        await _maybe_await(self._emit_degraded(event))
