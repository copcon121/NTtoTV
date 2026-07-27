"""Full ingest -> engines -> registry -> frontend pipeline wiring (task 20.1).

Connects the `/ws/nt` ingestion path to every downstream component and routes
all derived outputs through the WebSocket_Registry to `/ws/chart`:

* the :class:`~app.ingest.sequence_validator.SequenceValidator` validates each
  frame (dedup / out-of-order / gap) and the raw accepted tick is recorded to
  the :class:`~app.storage.tick_store.TickStore` **before any throttling**
  (Req 4.4, 4.5) — both handled by the :class:`~app.ingest.coordinator.IngestionCoordinator`;
* accepted Active_Contract trades feed the :class:`~app.engines.bar_aggregator.BarAggregator`,
  :class:`~app.engines.volume_delta_engine.VolumeDeltaEngine`, and
  :class:`~app.engines.big_trade_engine.BigTradeEngine`; their outputs are
  persisted to the Cache_Store and enqueued on the registry (Req 9.3, 20.1).
  Footprint cache/websocket updates are native-only via ``/api/nt/native-bar``;
* every accepted trade/quote is observed by the
  :class:`~app.engines.contract_resolver.ContractResolver`, whose needed-set /
  Active_Contract changes drive Control_Commands and Active_Contract status
  broadcasts via the :class:`~app.ingest.control_plane.ControlPlaneCoordinator`
  (Req 4.6, 20.1);
* the :class:`~app.engines.alert_engine.AlertEngine` is evaluated server-side
  against last-trade-price crossings, closed-bar closes, per-bar volume delta,
  and reconstructed big trades, emitting ``alert_event``s (Req 16, 17);
* NT status events (and the gap-degraded / NT-timeout statuses) are forwarded to
  subscribed clients (Req 20.1, 20.2, 20.3).

The pipeline holds the live engine state and an injectable ``enqueue`` seam that
appends :class:`~app.registry.registry.OutboundEvent`s to the registry's
coalescing flush. It exposes :meth:`handlers` (an
:class:`~app.ingest.endpoint.IngestHandlers` bundle) for the `/ws/nt` endpoint
and :meth:`emit_status` for forwarding connection-state status.
"""

from __future__ import annotations

import asyncio
import inspect
import logging
from collections import deque
from dataclasses import dataclass, field
from typing import Awaitable, Callable

from .config import Settings, settings as default_settings
from .engines.bar_aggregator import SUPPORTED_TFS, BarAggregator
from .engines.basis_engine import BasisEngine
from .engines.big_trade_engine import BigTradeEngine
from .engines.bookmap_big_trade_engine import BookmapBigTradeEngine
from .engines.breakout_box_engine import BreakoutBoxEngine, BreakoutBoxEvent
from .engines.contract_resolver import ContractResolver
from .engines.footprint_engine import FOOTPRINT_TIMEFRAME
from .engines.fvg_signal_engine import FvgSignalEngine
from .engines.session_calendar import TF_MS, is_gc_session_open, timeframe_bucket_start
from .engines.volume_delta_engine import VolumeDeltaEngine, VolumeDeltaMode
from .engines.alert_engine import AlertEngine, MarketContext
from .ingest.control_plane import ControlPlaneCoordinator
from .ingest.coordinator import QUOTE_CHANNEL, TRADE_CHANNEL, IngestionCoordinator
from .ingest.endpoint import IngestHandlers
from .ingest.sequence_validator import SeqOutcome, SequenceValidator, StreamId
from .models.canonical import NormalizedQuote, NormalizedTrade
from .models.messages import (
    BarUpdate,
    AlertEvent,
    BigTrade,
    ChartStatusEvent,
    FvgSignalUpdate,
    MarketDataStatus,
    NTStatusEvent,
    OHLCVBar,
    QuoteUpdate,
    VolumeDeltaUpdate,
)
from .registry.registry import OutboundEvent, WebSocketRegistry
from .rest.notifications import send_telegram_alert_from_event, send_web_push_alert_from_event
from .storage.cache_store import CacheStore
from .storage.records import (
    BarRecord,
    BigTradeRecord,
    FvgSignalRecord,
    VolumeDeltaRecord,
)
from .models.timestamp import now_ms
from .storage.tick_store import TickStore

logger = logging.getLogger(__name__)

__all__ = ["Pipeline"]

# The bar timeframe whose closed bars drive the close-based alerts and whose
# OHLCV the volume-delta alerts pair against. v1 uses 1m so per-bar order-flow
# alerts share a clock.
_ALERT_BAR_TF = FOOTPRINT_TIMEFRAME
_SOURCE_SWITCH_QUIET_MS = 15_000


@dataclass(slots=True)
class _FeedState:
    last_heartbeat_at: int | None = None
    last_event_at: int | None = None
    healthy_since: int | None = None
    contract: str | None = None
    bar_ready: bool = False
    connected: bool = False
    queue_depth: int = 0
    dropped_stale: int = 0
    dropped_overflow: int = 0
    sequence_gaps: int = 0
    event_lags: deque[int] = field(default_factory=lambda: deque(maxlen=10_000))
    transport_lags: deque[int] = field(default_factory=lambda: deque(maxlen=10_000))
    bar_close_lags: deque[int] = field(default_factory=lambda: deque(maxlen=120))


def _percentile(values: deque[int], percentile: float) -> int | None:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, int((len(ordered) - 1) * percentile)))
    return int(ordered[index])


async def _maybe_await(result: Awaitable[None] | None) -> None:
    if inspect.isawaitable(result):
        await result


def _trade_for_contract(trade: NormalizedTrade, contract: str) -> NormalizedTrade:
    return NormalizedTrade(
        symbol=trade.symbol,
        contract=contract,
        time=trade.time,
        price=trade.price,
        volume=trade.volume,
        bid=trade.bid,
        ask=trade.ask,
        best_bid=trade.best_bid,
        best_ask=trade.best_ask,
        sequence=trade.sequence,
        time_ticks=trade.time_ticks,
        source=trade.source,
        source_time_nanos=trade.source_time_nanos,
        bridge_time=trade.bridge_time,
        received_at=trade.received_at,
        side=trade.side,
        aggressor_order_id=trade.aggressor_order_id,
        passive_order_id=trade.passive_order_id,
        execution_start=trade.execution_start,
        execution_end=trade.execution_end,
        otc=trade.otc,
    )


def _bar_update_for_contract(update: BarUpdate, contract: str) -> BarUpdate:
    return BarUpdate(
        symbol=update.symbol,
        contract=contract,
        tf=update.tf,
        bar=update.bar,
        closed=update.closed,
        source=update.source,
    )


def _volume_delta_update_for_contract(
    update: VolumeDeltaUpdate, contract: str
) -> VolumeDeltaUpdate:
    return VolumeDeltaUpdate(
        symbol=update.symbol,
        contract=contract,
        tf=update.tf,
        time=update.time,
        volume=update.volume,
        buy_volume=update.buy_volume,
        sell_volume=update.sell_volume,
        delta=update.delta,
        delta_high=update.delta_high,
        delta_low=update.delta_low,
        open_delta=update.open_delta,
        close_delta=update.close_delta,
        cumulative_delta=update.cumulative_delta,
    )

def _big_trade_for_contract(bt: BigTrade, contract: str) -> BigTrade:
    return BigTrade(
        symbol=bt.symbol,
        contract=contract,
        trade_id=bt.trade_id,
        time=bt.time,
        price=bt.price,
        volume=bt.volume,
        side=bt.side,
        source=bt.source,
    )


AlertTextSender = Callable[[AlertEvent], Awaitable[None] | None]
AnalystEventSink = Callable[[], None]


class Pipeline:
    """Wires ingestion, engines, persistence, and registry streaming. (Req 20.1)"""

    def __init__(
        self,
        *,
        registry: WebSocketRegistry,
        cache: CacheStore,
        tick_store: TickStore,
        resolver: ContractResolver,
        settings: Settings | None = None,
        symbol: str = "GC",
        bar_aggregator: BarAggregator | None = None,
        volume_delta: VolumeDeltaEngine | None = None,
        fvg_signal: FvgSignalEngine | None = None,
        native_fvg_signal: FvgSignalEngine | None = None,
        big_trade: BigTradeEngine | None = None,
        breakout_box: BreakoutBoxEngine | None = None,
        alert_engine: AlertEngine | None = None,
        basis_engine: BasisEngine | None = None,
        send_alert_text: AlertTextSender | None = None,
        analyst_event_sink: AnalystEventSink | None = None,
        control_plane: ControlPlaneCoordinator | None = None,
        validator: SequenceValidator | None = None,
        enable_tick_fvg_signal: bool = True,
    ) -> None:
        self._settings = settings or default_settings
        self._registry = registry
        self._cache = cache
        self._tick_store = tick_store
        self._resolver = resolver
        self._symbol = symbol
        self._bars = bar_aggregator or BarAggregator()
        self._source_bars: dict[str, BarAggregator] = {
            "nt": self._bars,
            "bookmap": BarAggregator(),
        }
        # One VolumeDelta engine per supported timeframe so the lower
        # delta-candle series follows the charted timeframe (Req 13). The
        # Bar_Aggregator already fans out across all timeframes; mirror that here
        # so a REST read / live update exists for every ``tf`` the UI can select.
        # An injected engine (tests/replay) seeds its own timeframe; the rest are
        # constructed with matching mode/min-trade-size so behavior is uniform.
        seed = volume_delta
        self._vds: dict[str, VolumeDeltaEngine] = {}
        for tf in SUPPORTED_TFS:
            if seed is not None and seed.timeframe == tf:
                self._vds[tf] = seed
            else:
                self._vds[tf] = VolumeDeltaEngine(
                    timeframe=tf,
                    mode=seed.mode if seed is not None else VolumeDeltaMode.DELTA,
                    min_trade_size=seed.min_trade_size if seed is not None else 0,
                )
        self._fvg = fvg_signal or FvgSignalEngine()
        self._native_fvg_signal = native_fvg_signal
        self._enable_tick_fvg_signal = enable_tick_fvg_signal
        self._bt = big_trade or BigTradeEngine(dedupe_repeated_timestamp_runs=True)
        self._source_big_trades: dict[str, BigTradeEngine | BookmapBigTradeEngine] = {
            "nt": self._bt,
            "bookmap": BookmapBigTradeEngine(),
        }
        self._breakout = breakout_box or BreakoutBoxEngine()
        self._alerts = alert_engine or AlertEngine(cache)
        self._basis = basis_engine
        self._send_alert_text = (
            send_alert_text
            if send_alert_text is not None
            else self._send_telegram_alert_text
        )
        self._analyst_event_sink = analyst_event_sink

        # Ingestion coordinator: validation + raw-tick recording (before
        # throttling) + degraded-status seam wired to the registry. (Req 4.4, 4.5)
        self._coordinator = IngestionCoordinator(
            tick_store,
            validator or SequenceValidator(),
            emit_degraded=self._emit_status,
        )
        self._bookmap_coordinator = IngestionCoordinator(
            tick_store,
            SequenceValidator(),
            emit_degraded=self._emit_status,
        )
        # Control plane: needed-set diff -> Control_Commands; Active_Contract
        # changes -> status broadcast. ``send_control`` is bound by the /ws/nt
        # endpoint via :meth:`bind_control_sender`. (Req 4.6, 20.1)
        self._control_plane = control_plane
        # Last trade Canonical_Timestamp seen per contract, to detect a playback
        # rewind (a large backward time jump) and reset the engines + validator
        # for that contract so replayed data re-aggregates instead of being
        # dropped as out-of-order.
        self._last_trade_ms: dict[str, int] = {}
        self._chart_source_contract: str | None = self._initial_source_contract()
        self._chart_source_last_trade_ms: int | None = None
        if self._chart_source_contract is not None:
            self._pin_resolver_source(self._chart_source_contract)
        # Prevailing best bid/ask per contract from the most recent quote. NT's
        # 1-tick BarsRequest cannot attach same-print bid/ask to a trade, so we
        # backfill each trade from the prevailing quote and classify against the
        # book like MyVolumeDelta (otherwise flat prints default to buy and the
        # delta sign drifts away from NinjaTrader). (Req 13.2, 13.3)
        self._last_quote: dict[str, tuple[float | None, float | None]] = {}
        preferred = self._settings.market_data_preferred_source
        self._preferred_source = preferred if preferred in ("nt", "bookmap") else "nt"
        started = now_ms()
        self._source_started_at = started
        self._active_feed: str | None = "nt" if self._preferred_source == "nt" else None
        self._source_switched_at: int | None = started if self._active_feed else None
        self._source_switch_reason: str | None = "startup"
        self._feed_states = {"nt": _FeedState(), "bookmap": _FeedState()}
        self._source_snapshots: dict[str, dict[str, list[BarUpdate]]] = {
            "nt": {},
            "bookmap": {},
        }
        self._bookmap_minute_bars: dict[int, BarUpdate] = {}
        self._bookmap_connection_id: str | None = None
        self._last_market_status_emit = 0
        self._hydrate_engine_state_from_cache()

    # -- wiring seams ----------------------------------------------------------

    def handlers(self) -> IngestHandlers:
        """The :class:`IngestHandlers` bundle for the `/ws/nt` endpoint."""
        return IngestHandlers(
            on_trade=self.on_trade,
            on_quote=self.on_quote,
            on_status=self.on_status,
            on_heartbeat=self.on_nt_heartbeat,
        )

    @property
    def coordinator(self) -> IngestionCoordinator:
        return self._coordinator

    @property
    def control_plane(self) -> ControlPlaneCoordinator | None:
        return self._control_plane

    @property
    def alert_engine(self) -> AlertEngine:
        """The live alert engine used by REST alert CRUD to update runtime state."""
        return self._alerts

    def set_control_plane(self, control_plane: ControlPlaneCoordinator | None) -> None:
        """Bind (or clear) the control-plane coordinator.

        Bound per `/ws/nt` connection so its ``send_control`` targets the live
        socket; cleared on disconnect. (Req 4.6, 20.1)
        """
        self._control_plane = control_plane

    # -- ingest handlers -------------------------------------------------------

    async def on_trade(self, trade: NormalizedTrade) -> None:
        """Validate, record, run engines, and stream outputs for a trade.

        Tick recording + degraded-status happen in the coordinator (before
        throttling). Accepted trades are normalized into the logical chart
        contract (`GC`) before they enter the engines, so changing the NT
        source contract does not stop the frontend stream. (Req 4.5, 9.3, 20.1)
        """
        received = now_ms()
        trade.source = "nt"
        trade.received_at = received
        self._note_feed_event("nt", trade.time, trade.bridge_time, received)

        # Backfill the trade's bid/ask from the prevailing quote when NT did not
        # attach a same-print snapshot. VolumeDelta can then classify against
        # the book before its tick-rule fallback. Recorded ticks then also carry
        # bid/ask for future rebuilds. (Req 13.2, 13.3)
        if trade.bid is None and trade.ask is None:
            book = self._last_quote.get(trade.contract)
            if book is not None:
                bid, ask = book
                trade.bid = bid
                trade.ask = ask
                if trade.best_bid is None:
                    trade.best_bid = bid
                if trade.best_ask is None:
                    trade.best_ask = ask

        decision = await self._coordinator.on_trade(trade)
        if not decision.accepted:
            return
        if decision.outcome is SeqOutcome.GAP:
            self._feed_states["nt"].sequence_gaps += 1

        if not self._should_chart_source_trade(trade.contract, trade.time):
            return

        # Playback rewind detection: if the chart source's time jumps backward
        # by more than a bar, reset engine + validator state so replayed data
        # re-aggregates instead of being dropped as out-of-order.
        chart_contract = self._chart_contract()
        last = self._last_trade_ms.get(chart_contract)
        if last is not None and trade.time < last - 60_000:
            self._reset_contract(trade.contract)
        self._last_trade_ms[chart_contract] = trade.time

        # Feed resolver activity when the source is configured. If NT is
        # manually pointed at a contract outside the backend candidate list, keep
        # charting/recording it instead of failing the ingest handler.
        try:
            self._resolver.observe(
                trade.contract,
                trade_volume=trade.volume,
                quote_events=0,
                ts_ms=trade.time,
            )
        except ValueError:
            logger.info("pipeline: charting non-candidate source %s", trade.contract)
        await self._sync_control_plane()
        if self._basis is not None and self._active_feed == "nt":
            self._basis.update_gc(trade.price, trade.time)

        await self._run_trade_engines(
            _trade_for_contract(trade, chart_contract), source="nt"
        )

    async def on_quote(self, quote: NormalizedQuote) -> None:
        """Validate, record, observe resolver activity, and stream the quote."""
        received = now_ms()
        quote.source = "nt"
        quote.received_at = received
        decision = await self._coordinator.on_quote(quote)
        if not decision.accepted:
            return
        self._note_feed_event("nt", quote.time, quote.bridge_time, received)

        # Track the prevailing best bid/ask per contract so trades can be
        # classified against the book even though NT trade prints carry no
        # same-print bid/ask. (Req 13.2, 13.3)
        self._last_quote[quote.contract] = (quote.bid, quote.ask)
        if self._basis is not None:
            self._basis.update_gc((quote.bid + quote.ask) / 2, quote.time)

        if quote.contract != self._chart_source_contract or self._active_feed != "nt":
            return

        await self._enqueue(
            OutboundEvent.from_message(
                QuoteUpdate(
                    symbol=quote.symbol,
                    contract=self._chart_contract(),
                    time=quote.time,
                    bid=quote.bid,
                    ask=quote.ask,
                    bid_size=quote.bid_size,
                    ask_size=quote.ask_size,
                )
            )
        )

    async def on_status(self, status: NTStatusEvent) -> None:
        """Forward an NT_AddOn connection-state status to clients. (Req 20.1, 20.3)"""
        state = self._feed_states["nt"]
        state.connected = status.state.value != "disconnected"
        if state.connected:
            self._note_feed_heartbeat("nt", now_ms())
        else:
            state.healthy_since = None
        event = ChartStatusEvent(
            state=status.state,
            time=status.time,
            reason=getattr(status, "reason", None),
            contract=getattr(status, "contract", None),
        )
        await self._emit_status(event)

    async def on_nt_heartbeat(self, payload: dict) -> None:
        now = now_ms()
        state = self._feed_states["nt"]
        state.queue_depth = int(payload.get("queueDepth", state.queue_depth) or 0)
        state.dropped_stale = int(
            payload.get("droppedStale", state.dropped_stale) or 0
        )
        state.dropped_overflow = int(
            payload.get("droppedOverflow", state.dropped_overflow) or 0
        )
        self._note_feed_heartbeat("nt", now)

    async def on_bookmap_connect(self, connection_id: str) -> None:
        """Start a fresh Bookmap connection generation and sequence scope."""
        self._bookmap_connection_id = connection_id
        self._bookmap_coordinator = IngestionCoordinator(
            self._tick_store,
            SequenceValidator(),
            emit_degraded=self._emit_status,
        )
        engine = self._source_big_trades["bookmap"]
        if isinstance(engine, BookmapBigTradeEngine):
            engine.reset_pending()

    def is_current_bookmap_connection(self, connection_id: str) -> bool:
        return self._bookmap_connection_id == connection_id

    def note_bookmap_sequence_gap(self) -> None:
        self._feed_states["bookmap"].sequence_gaps += 1

    async def on_bookmap_trade(
        self, trade: NormalizedTrade, *, connection_id: str | None = None
    ) -> None:
        if not self._accept_bookmap_connection(connection_id):
            return
        received = now_ms()
        trade.source = "bookmap"
        trade.received_at = received
        decision = await self._bookmap_coordinator.on_trade(trade)
        if not decision.accepted:
            return
        if decision.outcome is SeqOutcome.GAP:
            self._feed_states["bookmap"].sequence_gaps += 1
        self._note_feed_event("bookmap", trade.time, trade.bridge_time, received)
        state = self._feed_states["bookmap"]
        state.contract = trade.contract
        if trade.contract != self._active_contract():
            return
        await self._evaluate_source_selection(received)
        chart_trade = _trade_for_contract(trade, self._chart_contract())
        if self._basis is not None and self._active_feed == "bookmap":
            self._basis.update_gc(chart_trade.price, chart_trade.time)
        await self._run_trade_engines(chart_trade, source="bookmap")

    async def on_bookmap_heartbeat(
        self, payload: dict, *, connection_id: str | None = None
    ) -> None:
        if not self._accept_bookmap_connection(connection_id):
            return
        received = now_ms()
        state = self._feed_states["bookmap"]
        state.contract = str(payload.get("contract") or state.contract or "") or None
        if bool(payload.get("hasCurrentBar", False)):
            state.bar_ready = not bool(payload.get("partialStart", True))
        state.queue_depth = int(payload.get("queueDepth", state.queue_depth) or 0)
        state.dropped_stale = int(
            payload.get("droppedStale", state.dropped_stale) or 0
        )
        state.dropped_overflow = int(
            payload.get("droppedOverflow", state.dropped_overflow) or 0
        )
        self._note_feed_heartbeat("bookmap", received)
        event_time = int(payload.get("time") or received)
        bridge_time = payload.get("bridgeTime")
        self._record_latency(
            state,
            event_time,
            None if bridge_time is None else int(bridge_time),
            received,
        )
        await self._evaluate_source_selection(received)

    async def on_bookmap_bar(
        self, payload: dict, *, connection_id: str | None = None
    ) -> None:
        if not self._accept_bookmap_connection(connection_id):
            return
        received = now_ms()
        contract = str(payload["contract"])
        state = self._feed_states["bookmap"]
        state.contract = contract
        partial = bool(payload.get("partialStart", False))
        state.bar_ready = not partial
        bridge_time = int(payload.get("bridgeTime") or received)
        bar_time = int(payload["time"])
        last_event_nanos = payload.get("lastEventTimeNanos")
        snapshot = bool(payload.get("snapshot", False))
        event_time = (
            bar_time
            if last_event_nanos is None
            else int(last_event_nanos) // 1_000_000
        )
        self._note_feed_heartbeat("bookmap", received)
        if not snapshot:
            state.last_event_at = received
            self._record_latency(state, event_time, bridge_time, received)
        if bool(payload.get("closed", False)) and not snapshot:
            state.bar_close_lags.append(max(0, received - (bar_time + 60_000)))
        if contract != self._active_contract():
            state.bar_ready = False
            await self._evaluate_source_selection(received)
            return
        update = BarUpdate(
            symbol=self._symbol,
            contract=self._chart_contract(),
            tf=str(payload.get("tf") or "1m"),
            bar=OHLCVBar(
                time=bar_time,
                open=float(payload["open"]),
                high=float(payload["high"]),
                low=float(payload["low"]),
                close=float(payload["close"]),
                volume=int(payload["volume"]),
            ),
            closed=bool(payload.get("closed", False)),
            source="bookmap",
        )
        self._source_bars["bookmap"].reconcile_bar(
            self._chart_contract(),
            update.tf,
            update.bar,
            closed=update.closed,
        )
        updates = self._bookmap_rollup_updates(update)
        # Raw Bookmap trades also maintain provisional higher-timeframe bars.
        # Reconcile that state to the authoritative 1m rollup so the next trade
        # cannot overwrite H4/D with a partial bar that started at attach time.
        for rollup in updates:
            if rollup.tf == "1m":
                continue
            self._source_bars["bookmap"].reconcile_bar(
                self._chart_contract(),
                rollup.tf,
                rollup.bar,
                closed=rollup.closed,
            )
        self._remember_source_updates("bookmap", updates)
        was_active = self._active_feed == "bookmap"
        await self._evaluate_source_selection(received)
        if was_active and self._active_feed == "bookmap":
            await asyncio.to_thread(self._persist_derived_batch, updates, [], [], [])
            for source_update in updates:
                await self._enqueue(OutboundEvent.from_message(source_update))
            if not snapshot:
                await self._evaluate_bookmap_bar_alerts(updates, received)

    # -- engine fan-out --------------------------------------------------------

    async def _run_trade_engines(self, trade: NormalizedTrade, *, source: str) -> None:
        if not is_gc_session_open(trade.time):
            return
        active = self._active_feed == source

        # 1) OHLCV bars across all timeframes. (Req 9.3)
        alert_ctx_bar: BarUpdate | None = None
        closed_bars: dict[str, BarUpdate] = {}
        source_bar_updates = self._source_bars[source].on_trade(trade)
        self._remember_source_updates(source, source_bar_updates)
        bar_updates = source_bar_updates if active else []
        use_trade_built_bar_alerts = source != "bookmap"
        for update in bar_updates:
            if update.closed and use_trade_built_bar_alerts:
                closed_bars[update.tf] = update
                if update.tf == _ALERT_BAR_TF:
                    alert_ctx_bar = update

        # 2) VolumeDelta across all timeframes so the lower delta-candle series
        # follows the charted timeframe (Req 13). The alert context pairs with
        # the 1m bar close, so capture that timeframe's update for alerts.
        vd_update: VolumeDeltaUpdate | None = None
        vd_updates: list[VolumeDeltaUpdate] = []
        if source == "nt":
            for tf, engine in self._vds.items():
                update = engine.on_trade(trade)
                if update is None:
                    continue
                vd_updates.append(update)
                if tf == _ALERT_BAR_TF:
                    vd_update = update

        # 3) Tick FVG remains internal for breakout/FVG confluence. Confirmed
        # FVG cache rows come only from finalized NT native bars; the shared
        # native engine can stream provisional source-bar colors while the
        # right bar is forming.
        raw_fvg_updates = self._fvg.on_trade(trade) if source == "nt" else []
        fvg_updates = raw_fvg_updates if self._enable_tick_fvg_signal else []
        native_fvg_preview_updates: list[FvgSignalUpdate] = []
        if (
            source == "nt"
            and self._native_fvg_signal is not None
            and not self._enable_tick_fvg_signal
        ):
            native_fvg_preview_updates = self._native_fvg_signal.on_preview_trade(trade)

        # 4) BigTrade (merge + filter). (Req 15)
        source_big_trades = self._source_big_trades[source].on_trade(trade)
        big_trades = source_big_trades if active else []
        for bt in big_trades:
            bt.source = source

        # 5) Breakout Box detection on closed 1m bars.
        breakout_events: list[BreakoutBoxEvent] = []
        if alert_ctx_bar is not None and alert_ctx_bar.closed:
            b = alert_ctx_bar.bar
            breakout_events = self._breakout.on_closed_bar(
                symbol=trade.symbol,
                contract=trade.contract,
                time=b.time,
                open=b.open,
                high=b.high,
                low=b.low,
                close=b.close,
                volume=b.volume,
            )

        # Track the most recent confirmed FVG signal for confluence matching.
        # We only keep the latest confirmed signal; the confluence alert checks
        # if a breakout happened on the same closed-bar cycle.
        fvg_confirmed_level: int | None = None
        fvg_confirmed_direction: int | None = None
        for u in raw_fvg_updates:
            if u.phase == "confirmed" and u.pulse != 0:
                fvg_confirmed_level = u.level
                fvg_confirmed_direction = u.direction

        # Persist the full derived snapshot in one transaction. A busy trade
        # updates multiple timeframe rows; committing each row separately
        # starves the asyncio loop that flushes UI WebSockets.
        await asyncio.to_thread(
            self._persist_derived_batch,
            bar_updates,
            vd_updates,
            fvg_updates,
            big_trades,
        )
        if self._analyst_event_sink is not None and (
            bar_updates or vd_updates or fvg_updates or big_trades
        ):
            try:
                self._analyst_event_sink()
            except Exception as exc:
                logger.warning("analyst event enqueue failed: %s", exc)

        for update in bar_updates:
            await self._enqueue(OutboundEvent.from_message(update))
        for update in vd_updates:
            await self._enqueue(OutboundEvent.from_message(update))
        for update in fvg_updates:
            await self._enqueue(OutboundEvent.from_message(update))
        for update in native_fvg_preview_updates:
            await self._enqueue(OutboundEvent.from_message(update))
        for bt in big_trades:
            await self._enqueue(OutboundEvent.from_message(bt))

        # 6) Alerts: last-trade-price crossings + per-bar / big-trade conditions.
        if active:
            await self._evaluate_alerts(
                trade, closed_bar=alert_ctx_bar, vd_update=vd_update,
                big_trades=big_trades,
                closed_bars=closed_bars,
                breakout_events=breakout_events,
                fvg_level=fvg_confirmed_level,
                fvg_direction=fvg_confirmed_direction,
            )

    async def _evaluate_alerts(
        self,
        trade: NormalizedTrade,
        *,
        closed_bar: BarUpdate | None,
        vd_update: VolumeDeltaUpdate | None,
        big_trades: list[BigTrade],
        closed_bars: dict[str, BarUpdate] | None = None,
        breakout_events: list[BreakoutBoxEvent] | None = None,
        fvg_level: int | None = None,
        fvg_direction: int | None = None,
    ) -> None:
        """Evaluate alerts and stream any emitted ``alert_event``s. (Req 16, 17)"""
        # Last-trade-price crossing on every trade. (Req 16.6)
        ctx = MarketContext(
            symbol=trade.symbol,
            contract=trade.contract,
            time=trade.time,
            last_price=trade.price,
        )
        await self._emit_alerts(self._alerts.evaluate(ctx))

        # Closed-bar conditions (bar_closes_*, volume_delta_threshold) keyed to
        # the 1m bar close. (Req 16.7)
        if closed_bar is not None:
            bar = closed_bar.bar
            bar_ctx = MarketContext(
                symbol=trade.symbol,
                contract=trade.contract,
                time=trade.time,
                bar_closed=True,
                bar_tf=closed_bar.tf,
                bar_time=bar.time,
                bar_open=bar.open,
                bar_high=bar.high,
                bar_low=bar.low,
                bar_close=bar.close,
                bar_volume=bar.volume,
                bar_volume_delta=vd_update.delta if vd_update is not None else None,
                bar_stacked_imbalance=None,
                breakout_events=breakout_events or None,
                fvg_level=fvg_level,
                fvg_direction=fvg_direction,
            )
            await self._emit_alerts(self._alerts.evaluate(bar_ctx))

        m5_bar = (closed_bars or {}).get("5m")
        if m5_bar is not None:
            bar = m5_bar.bar
            m5_ctx = MarketContext(
                symbol=trade.symbol,
                contract=trade.contract,
                time=trade.time,
                bar_closed=True,
                bar_tf=m5_bar.tf,
                bar_time=bar.time,
                bar_open=bar.open,
                bar_high=bar.high,
                bar_low=bar.low,
                bar_close=bar.close,
                bar_volume=bar.volume,
            )
            await self._emit_alerts(self._alerts.evaluate(m5_ctx))

        # Big-trade threshold alerts: one context per reconstructed big trade.
        for bt in big_trades:
            bt_ctx = MarketContext(
                symbol=bt.symbol,
                contract=bt.contract,
                time=bt.time,
                big_trade_volume=bt.volume,
                big_trade_price=bt.price,
                big_trade_side=bt.side,
            )
            await self._emit_alerts(self._alerts.evaluate(bt_ctx))

    async def _evaluate_bookmap_bar_alerts(
        self,
        updates: list[BarUpdate],
        event_time: int,
    ) -> None:
        """Evaluate bar-close alerts from authoritative Bookmap bar snapshots."""
        for update in updates:
            if not update.closed:
                continue
            bar = update.bar
            breakout_events: list[BreakoutBoxEvent] = []
            if update.tf == _ALERT_BAR_TF:
                breakout_events = self._breakout.on_closed_bar(
                    symbol=update.symbol,
                    contract=update.contract,
                    time=bar.time,
                    open=bar.open,
                    high=bar.high,
                    low=bar.low,
                    close=bar.close,
                    volume=bar.volume,
                )
            ctx = MarketContext(
                symbol=update.symbol,
                contract=update.contract,
                time=event_time,
                bar_closed=True,
                bar_tf=update.tf,
                bar_time=bar.time,
                bar_open=bar.open,
                bar_high=bar.high,
                bar_low=bar.low,
                bar_close=bar.close,
                bar_volume=bar.volume,
                breakout_events=breakout_events or None,
            )
            await self._emit_alerts(self._alerts.evaluate(ctx))

    # -- persistence -----------------------------------------------------------

    def _persist_derived_batch(
        self,
        bar_updates: list[BarUpdate],
        volume_delta_updates: list[VolumeDeltaUpdate],
        fvg_signal_updates: list[FvgSignalUpdate],
        big_trades: list[BigTrade],
    ) -> None:
        fvg_signals = [
            FvgSignalRecord(
                symbol=update.symbol,
                contract=update.contract,
                timeframe=update.tf,
                time=update.time,
                direction=update.direction,
                level=update.level,
                pulse=update.pulse,
                top=float(update.top if update.top is not None else 0.0),
                bottom=float(update.bottom if update.bottom is not None else 0.0),
                breakout_ratio=update.breakout_ratio,
            )
            for update in fvg_signal_updates
            if update.phase == "confirmed" and update.pulse != 0
        ]

        self._cache.upsert_derived_batch(
            bars=(
                BarRecord(
                    symbol=update.symbol,
                    contract=update.contract,
                    timeframe=update.tf,
                    time=update.bar.time,
                    open=update.bar.open,
                    high=update.bar.high,
                    low=update.bar.low,
                    close=update.bar.close,
                    volume=update.bar.volume,
                    closed=update.closed,
                    source=update.source or "legacy",
                )
                for update in bar_updates
            ),
            volume_deltas=(
                VolumeDeltaRecord(
                    symbol=u.symbol,
                    contract=u.contract,
                    timeframe=u.tf,
                    time=u.time,
                    volume=u.volume,
                    buy_volume=u.buy_volume,
                    sell_volume=u.sell_volume,
                    delta=u.delta,
                    delta_high=u.delta_high,
                    delta_low=u.delta_low,
                    open_delta=u.open_delta,
                    close_delta=u.close_delta,
                )
                for u in volume_delta_updates
            ),
            fvg_signals=fvg_signals,
            big_trades=(
                BigTradeRecord(
                    symbol=bt.symbol,
                    contract=bt.contract,
                    time=bt.time,
                    price=bt.price,
                    volume=bt.volume,
                    side=bt.side,
                    trade_id=bt.trade_id,
                    source=bt.source or "legacy",
                )
                for bt in big_trades
            )
        )

    def _accept_bookmap_connection(self, connection_id: str | None) -> bool:
        return connection_id is None or connection_id == self._bookmap_connection_id

    def _bookmap_rollup_updates(self, minute_update: BarUpdate) -> list[BarUpdate]:
        """Rebuild higher timeframes from authoritative Bookmap 1m snapshots."""
        if minute_update.tf != "1m":
            return [minute_update]

        self._bookmap_minute_bars[minute_update.bar.time] = minute_update
        cutoff = minute_update.bar.time - 7 * 24 * 60 * 60 * 1_000
        for old_time in [t for t in self._bookmap_minute_bars if t < cutoff]:
            self._bookmap_minute_bars.pop(old_time, None)

        updates = [minute_update]
        for tf in SUPPORTED_TFS:
            if TF_MS[tf] <= TF_MS["1m"]:
                continue
            bucket = timeframe_bucket_start(minute_update.bar.time, tf)
            end = bucket + TF_MS[tf] - 1
            rows: dict[int, tuple[float, float, float, float, int]] = {
                rec.time: (rec.open, rec.high, rec.low, rec.close, rec.volume)
                for rec in self._cache.read_bars(
                    self._symbol,
                    self._chart_contract(),
                    "1m",
                    bucket,
                    end,
                )
                if self._valid_rollup_bar(
                    rec.open, rec.high, rec.low, rec.close, rec.volume
                )
            }
            for bar_time, source_update in self._bookmap_minute_bars.items():
                if bucket <= bar_time <= end:
                    bar = source_update.bar
                    if self._valid_rollup_bar(
                        bar.open, bar.high, bar.low, bar.close, bar.volume
                    ):
                        rows[bar_time] = (
                            bar.open,
                            bar.high,
                            bar.low,
                            bar.close,
                            bar.volume,
                        )
            ordered = sorted(rows.items())
            if not ordered:
                continue
            first = ordered[0][1]
            last = ordered[-1][1]
            closed = minute_update.closed and (
                timeframe_bucket_start(minute_update.bar.time + 60_000, tf)
                > bucket
            )
            updates.append(
                BarUpdate(
                    symbol=self._symbol,
                    contract=self._chart_contract(),
                    tf=tf,
                    bar=OHLCVBar(
                        time=bucket,
                        open=first[0],
                        high=max(values[1] for _, values in ordered),
                        low=min(values[2] for _, values in ordered),
                        close=last[3],
                        volume=sum(values[4] for _, values in ordered),
                    ),
                    closed=closed,
                    source="bookmap",
                )
            )
        return updates

    @staticmethod
    def _valid_rollup_bar(
        open_price: float,
        high_price: float,
        low_price: float,
        close_price: float,
        volume: int,
    ) -> bool:
        return (
            open_price > 0
            and high_price > 0
            and low_price > 0
            and close_price > 0
            and volume >= 0
            and low_price <= min(open_price, close_price)
            and high_price >= max(open_price, close_price)
            and low_price <= high_price
        )

    # -- market source arbitration -------------------------------------------

    async def maintenance_tick(self) -> None:
        now = now_ms()
        bookmap = self._feed_states["bookmap"]
        if (
            bookmap.last_heartbeat_at is not None
            and now - bookmap.last_heartbeat_at > self._settings.bookmap_stale_ms
        ):
            bookmap.connected = False
            bookmap.healthy_since = None
        nt = self._feed_states["nt"]
        if (
            nt.last_heartbeat_at is not None
            and now - nt.last_heartbeat_at > self._settings.nt_feed_stale_ms
        ):
            nt.connected = False
            nt.healthy_since = None

        await self._evaluate_source_selection(now)

        engine = self._source_big_trades["bookmap"]
        if isinstance(engine, BookmapBigTradeEngine):
            emitted = engine.flush_idle(now)
            if self._active_feed == "bookmap" and emitted:
                for bt in emitted:
                    bt.contract = self._chart_contract()
                await asyncio.to_thread(
                    self._persist_derived_batch, [], [], [], emitted
                )
                for bt in emitted:
                    await self._enqueue(OutboundEvent.from_message(bt))
                    await self._evaluate_alerts(
                        NormalizedTrade(
                            symbol=bt.symbol,
                            contract=bt.contract,
                            time=bt.time,
                            price=bt.price,
                            volume=bt.volume,
                            bid=None,
                            ask=None,
                            best_bid=None,
                            best_ask=None,
                            sequence=bt.trade_id,
                            source="bookmap",
                            side=bt.side,
                        ),
                        closed_bar=None,
                        vd_update=None,
                        big_trades=[bt],
                    )

        if now - self._last_market_status_emit >= 1_000:
            self._last_market_status_emit = now
            await self._enqueue(OutboundEvent.from_message(self.market_data_status_message()))

    async def on_bookmap_disconnect(self, connection_id: str | None = None) -> None:
        if not self._accept_bookmap_connection(connection_id):
            return
        self._bookmap_connection_id = None

    def market_data_status_message(self) -> MarketDataStatus:
        now = now_ms()
        return MarketDataStatus(
            symbol=self._symbol,
            time=now,
            active_source=self._active_feed,
            preferred_source=self._preferred_source,
            switched_at=self._source_switched_at,
            reason=self._source_switch_reason,
            sources={
                source: self._feed_status_dict(source, state, now)
                for source, state in self._feed_states.items()
            },
        )

    def market_data_status_dict(self) -> dict:
        return self.market_data_status_message().to_dict()

    def note_nt_native_bar(self, bar_time: int, received_at: int | None = None) -> None:
        """Record finalized NT native bar-close latency without changing OHLC."""
        received = now_ms() if received_at is None else received_at
        self._feed_states["nt"].bar_close_lags.append(
            max(0, received - (bar_time + 60_000))
        )

    def _feed_status_dict(self, source: str, state: _FeedState, now: int) -> dict:
        lags = list(state.event_lags)
        transport = list(state.transport_lags)
        return {
            "connected": state.connected,
            "eligible": self._feed_eligible(source, now),
            "contract": state.contract,
            "lastHeartbeatAt": state.last_heartbeat_at,
            "heartbeatAgeMs": (
                None
                if state.last_heartbeat_at is None
                else max(0, now - state.last_heartbeat_at)
            ),
            "lastEventAt": state.last_event_at,
            "eventLagMs": {
                "last": None if not lags else lags[-1],
                "p50": _percentile(state.event_lags, 0.50),
                "p95": _percentile(state.event_lags, 0.95),
                "max": None if not lags else max(lags),
                "sampleCount": len(lags),
            },
            "transportLagMs": {
                "last": None if not transport else transport[-1],
                "p50": _percentile(state.transport_lags, 0.50),
                "p95": _percentile(state.transport_lags, 0.95),
                "max": None if not transport else max(transport),
                "sampleCount": len(transport),
            },
            "barCloseLagMs": {
                "p50": _percentile(state.bar_close_lags, 0.50),
                "p95": _percentile(state.bar_close_lags, 0.95),
                "max": None if not state.bar_close_lags else max(state.bar_close_lags),
                "sampleCount": len(state.bar_close_lags),
            },
            "queueDepth": state.queue_depth,
            "droppedStale": state.dropped_stale,
            "droppedOverflow": state.dropped_overflow,
            "sequenceGaps": state.sequence_gaps,
        }

    def _note_feed_heartbeat(self, source: str, received_at: int) -> None:
        state = self._feed_states[source]
        state.last_heartbeat_at = received_at
        state.connected = True
        if state.healthy_since is None:
            state.healthy_since = received_at

    def _note_feed_event(
        self,
        source: str,
        event_time: int,
        bridge_time: int | None,
        received_at: int,
    ) -> None:
        state = self._feed_states[source]
        self._note_feed_heartbeat(source, received_at)
        state.last_event_at = received_at
        self._record_latency(state, event_time, bridge_time, received_at)

    @staticmethod
    def _record_latency(
        state: _FeedState,
        event_time: int,
        bridge_time: int | None,
        received_at: int,
    ) -> None:
        state.event_lags.append(max(0, received_at - event_time))
        if bridge_time is not None:
            state.transport_lags.append(max(0, received_at - bridge_time))

    def _feed_eligible(self, source: str, now: int) -> bool:
        state = self._feed_states[source]
        if not state.connected or state.last_heartbeat_at is None:
            return False
        stale_ms = (
            self._settings.bookmap_stale_ms
            if source == "bookmap"
            else self._settings.nt_feed_stale_ms
        )
        if now - state.last_heartbeat_at > stale_ms:
            return False
        if source == "bookmap":
            healthy_ms = (
                0 if state.healthy_since is None else now - state.healthy_since
            )
            return (
                state.contract == self._active_contract()
                and state.bar_ready
                and healthy_ms >= self._settings.bookmap_qualify_ms
            )
        return True

    async def _evaluate_source_selection(self, now: int) -> None:
        if self._preferred_source == "nt":
            if self._active_feed is None:
                await self._switch_feed("nt", "nt_preferred", now)
            return

        bookmap_ok = self._feed_eligible("bookmap", now)
        nt_ok = self._feed_eligible("nt", now)
        bookmap = self._feed_states["bookmap"]

        if self._active_feed is None:
            if bookmap_ok:
                await self._switch_feed("bookmap", "bookmap_cold_start", now)
            elif now - self._source_started_at >= self._settings.market_data_cold_start_grace_ms and nt_ok:
                await self._switch_feed("nt", "bookmap_cold_start_timeout", now)
            return

        if self._active_feed == "bookmap":
            if not bookmap_ok:
                await self._switch_feed(
                    "nt" if nt_ok else None,
                    "bookmap_stale",
                    now,
                )
            return

        if self._active_feed == "nt":
            held_ms = 0 if self._source_switched_at is None else now - self._source_switched_at
            stable_ms = 0 if bookmap.healthy_since is None else now - bookmap.healthy_since
            if (
                bookmap_ok
                and held_ms >= self._settings.market_data_min_hold_ms
                and stable_ms >= self._settings.bookmap_recover_ms
            ):
                reason = "bookmap_recovered" if nt_ok else "nt_stale"
                await self._switch_feed("bookmap", reason, now)

    async def _switch_feed(
        self, source: str | None, reason: str, switched_at: int
    ) -> None:
        old = self._active_feed
        if old == source:
            return
        self._active_feed = source
        self._source_switched_at = switched_at
        self._source_switch_reason = reason
        await asyncio.to_thread(
            self._cache.record_market_source_switch,
            self._symbol,
            self._chart_contract(),
            switched_at,
            old,
            source,
            reason,
        )
        logger.warning("market source switched %s -> %s reason=%s", old, source, reason)
        if source is None:
            return
        engine = self._source_big_trades[source]
        if isinstance(engine, BookmapBigTradeEngine):
            engine.reset_pending()
        elif isinstance(engine, BigTradeEngine):
            engine.reset_contract(self._chart_contract())
        snapshots = [
            update
            for tf in SUPPORTED_TFS
            for update in self._source_snapshots[source].get(tf, [])
        ]
        if snapshots:
            await asyncio.to_thread(
                self._persist_derived_batch, snapshots, [], [], []
            )
            for update in snapshots:
                await self._enqueue(OutboundEvent.from_message(update))

    def _remember_source_updates(
        self, source: str, updates: list[BarUpdate]
    ) -> None:
        by_tf = self._source_snapshots[source]
        for update in updates:
            update.source = source
            tracked = [
                existing
                for existing in by_tf.get(update.tf, [])
                if existing.bar.time != update.bar.time
            ]
            tracked.append(update)
            tracked.sort(key=lambda item: item.bar.time)
            by_tf[update.tf] = tracked[-2:]

    # -- helpers ---------------------------------------------------------------

    def _active_contract(self) -> str:
        return self._chart_source_contract or self._resolver.resolve()

    def _chart_contract(self) -> str:
        """Stable logical contract key used by the chart cache/stream."""
        return self._symbol

    def _hydrate_engine_state_from_cache(self) -> None:
        """Continue open cached chart bars after a backend restart.

        Without this, the first live trade after restart opens a fresh current
        bucket and the cache upsert replaces the already-open bar with only the
        post-restart volume. Seed only rows marked open so closed historical
        bars are not replayed through the live engines.
        """
        chart_contract = self._chart_contract()
        seeded = 0
        for tf in SUPPORTED_TFS:
            bars = self._cache.read_bars(
                self._symbol,
                chart_contract,
                tf,
                limit=1,
            )
            if not bars:
                continue
            bar = bars[-1]
            if bar.closed:
                continue

            source = bar.source if bar.source in self._source_bars else "nt"
            self._source_bars[source].seed_bar(
                chart_contract,
                tf,
                time=bar.time,
                open=bar.open,
                high=bar.high,
                low=bar.low,
                close=bar.close,
                volume=bar.volume,
            )
            self._remember_source_updates(
                source,
                [
                    BarUpdate(
                        symbol=self._symbol,
                        contract=chart_contract,
                        tf=tf,
                        bar=OHLCVBar(
                            time=bar.time,
                            open=bar.open,
                            high=bar.high,
                            low=bar.low,
                            close=bar.close,
                            volume=bar.volume,
                        ),
                        closed=False,
                        source=source,
                    )
                ],
            )

            deltas = self._cache.read_volume_delta(
                self._symbol,
                chart_contract,
                tf,
                limit=1,
            )
            if source == "nt" and deltas and deltas[-1].time == bar.time:
                delta = deltas[-1]
                self._vds[tf].seed_bar(
                    chart_contract,
                    time=delta.time,
                    volume=delta.volume,
                    buy_volume=delta.buy_volume,
                    sell_volume=delta.sell_volume,
                    delta_high=delta.delta_high,
                    delta_low=delta.delta_low,
                    open_delta=delta.open_delta,
                    close_delta=delta.close_delta,
                    last_price=bar.close,
                )
            seeded += 1
        if seeded:
            logger.info("pipeline: hydrated %s open chart bars from cache", seeded)

    def _initial_source_contract(self) -> str | None:
        manual = self._resolver.manual_override
        if manual is not None:
            return manual
        try:
            return self._resolver.resolve()
        except Exception:
            return None

    def _pin_resolver_source(self, contract: str) -> None:
        if contract not in self._resolver.candidates:
            return
        try:
            self._resolver.set_manual_override(contract)
        except ValueError:
            return

    def _should_chart_source_trade(self, contract: str, time_ms: int) -> bool:
        current = self._chart_source_contract
        if current is None:
            self._switch_chart_source(contract, time_ms)
            return True
        if contract == current:
            self._chart_source_last_trade_ms = time_ms
            return True

        last = self._chart_source_last_trade_ms
        if last is None:
            logger.debug(
                "pipeline: ignoring non-active chart source %s before %s starts",
                contract,
                current,
            )
            return False
        if last is not None and time_ms - last <= _SOURCE_SWITCH_QUIET_MS:
            logger.debug(
                "pipeline: ignoring non-active chart source %s while %s is live",
                contract,
                current,
            )
            return False

        self._switch_chart_source(contract, time_ms)
        return True

    def _switch_chart_source(self, contract: str, time_ms: int) -> None:
        old = self._chart_source_contract
        self._chart_source_contract = contract
        self._chart_source_last_trade_ms = time_ms
        self._pin_resolver_source(contract)
        if old != contract:
            logger.info("pipeline: chart source switched %s -> %s", old, contract)

    def _reset_contract(self, contract: str) -> None:
        """Reset all per-contract engine + validator state (playback rewind).

        Clears the in-progress bar/order-flow/big-trade state and the sequence
        validator's per-Stream high-water marks for this contract so a rewound
        (earlier-timestamp) replay re-aggregates cleanly. (Playback only.)
        """
        chart_contract = self._chart_contract()
        self._bars.reset_contract(chart_contract)
        for engine in self._vds.values():
            engine.reset_contract(chart_contract)
        self._fvg.reset_contract(chart_contract)
        self._bt.reset_contract(chart_contract)
        self._breakout.reset_contract(chart_contract)
        self._last_quote.pop(contract, None)
        validator = self._coordinator.validator
        for channel in (TRADE_CHANNEL, QUOTE_CHANNEL):
            validator.reset_stream(StreamId(self._symbol, contract, channel))
        logger.info("pipeline: reset contract %s on playback rewind", contract)

    async def _sync_control_plane(self) -> None:
        if self._control_plane is None:
            return
        source = self._chart_source_contract
        if source is not None and source in self._resolver.candidates:
            await self._control_plane.sync({source}, source)
            return
        await self._control_plane.sync_from_resolver(self._resolver)

    async def _emit_alerts(self, events) -> None:
        for ev in events:
            await self._send_web_push_safely(ev)
            if self._registry.client_count == 0:
                await self._send_alert_text_safely(ev)
            await self._enqueue(OutboundEvent.from_message(ev))

    async def _send_web_push_safely(self, event: AlertEvent) -> None:
        try:
            await asyncio.to_thread(send_web_push_alert_from_event, self._cache, event)
        except Exception as exc:
            logger.warning(
                "web push alert failed for %s: %s",
                event.alert_id,
                exc,
            )

    async def _send_alert_text_safely(self, event: AlertEvent) -> None:
        try:
            await _maybe_await(self._send_alert_text(event))
        except Exception as exc:
            logger.warning(
                "telegram alert text fallback failed for %s: %s",
                event.alert_id,
                exc,
            )

    async def _send_telegram_alert_text(self, event: AlertEvent) -> None:
        await asyncio.to_thread(send_telegram_alert_from_event, self._cache, event)

    async def _emit_status(self, event: ChartStatusEvent) -> None:
        """Enqueue a status event to subscribed clients. (Req 20.1, 20.2, 20.3)"""
        await self._enqueue(OutboundEvent.from_message(event, symbol=self._symbol))

    async def _enqueue(self, event: OutboundEvent) -> None:
        self._registry.enqueue(event)
