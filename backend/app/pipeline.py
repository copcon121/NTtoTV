"""Full ingest -> engines -> registry -> frontend pipeline wiring (task 20.1).

Connects the `/ws/nt` ingestion path to every downstream component and routes
all derived outputs through the WebSocket_Registry to `/ws/chart`:

* the :class:`~app.ingest.sequence_validator.SequenceValidator` validates each
  frame (dedup / out-of-order / gap) and the raw accepted tick is recorded to
  the :class:`~app.storage.tick_store.TickStore` **before any throttling**
  (Req 4.4, 4.5) — both handled by the :class:`~app.ingest.coordinator.IngestionCoordinator`;
* accepted Active_Contract trades feed the :class:`~app.engines.bar_aggregator.BarAggregator`,
  :class:`~app.engines.volume_delta_engine.VolumeDeltaEngine`,
  :class:`~app.engines.footprint_engine.FootprintEngine`, and
  :class:`~app.engines.big_trade_engine.BigTradeEngine`; their outputs are
  persisted to the Cache_Store and enqueued on the registry (Req 9.3, 20.1).
  Bookmap supplies tick-by-tick delta/footprint while active; NT native bars are
  the automatic fallback, while NT-export files remain the history repair path;
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
import math
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Awaitable, Callable

from .config import Settings, settings as default_settings
from .engines.bar_aggregator import SUPPORTED_TFS, BarAggregator
from .engines.basis_engine import BasisEngine
from .engines.big_trade_engine import BigTradeEngine
from .engines.bookmap_big_trade_engine import BookmapBigTradeEngine
from .engines.breakout_box_engine import BreakoutBoxEngine, BreakoutBoxEvent
from .engines.contract_resolver import ContractResolver
from .engines.footprint_engine import FOOTPRINT_TIMEFRAME, FootprintEngine
from .engines.fvg_signal_engine import FvgSignalEngine
from .engines.long_term_liquidity_touch import (
    LongTermLiquidityTouch,
    LongTermLiquidityTouchEngine,
)
from .engines.market_volume_stop import MarketVolumeStopEngine
from .engines.tdu_signal_engine import TduSignalEngine
from .engines.trend_analyzer import TrendAnalyzerBatch, TrendAnalyzerEngine
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
    FootprintUpdate,
    FvgSignalUpdate,
    LiquidityUpdate,
    MarketExplorerUpdate,
    MarketDataStatus,
    NTStatusEvent,
    OHLCVBar,
    QuoteUpdate,
    TduSignalUpdate,
    TrendAnalyzerUpdate,
    VolumeDeltaUpdate,
)
from .registry.registry import OutboundEvent, WebSocketRegistry
from .rest.notifications import send_telegram_alert_from_event, send_web_push_alert_from_event
from .storage.cache_store import CacheStore
from .storage.liquidity_store import LiquidityStore
from .storage.records import (
    BarRecord,
    BigTradeRecord,
    FootprintBarRecord,
    FootprintLevelRecord,
    FvgSignalRecord,
    TduSignalRecord,
    VolumeDeltaRecord,
)
from .models.timestamp import now_ms
from .market_explorer_settings import load_market_explorer_settings
from .liquidity_settings import load_liquidity_settings
from .storage.tick_store import TickStore

logger = logging.getLogger(__name__)

__all__ = ["Pipeline"]

# The bar timeframe whose closed bars drive the close-based alerts and whose
# OHLCV the volume-delta alerts pair against. v1 uses 1m so per-bar order-flow
# alerts share a clock.
_ALERT_BAR_TF = FOOTPRINT_TIMEFRAME
_SOURCE_SWITCH_QUIET_MS = 15_000
# How often the forming (in-progress) footprint bar is flushed to the cache so
# the REST delta-profile endpoint (session-daily histogram) stays current
# between minute closes without writing on every trade.
_FOOTPRINT_FORMING_FLUSH_MS = 30_000


@dataclass(slots=True)
class _FeedState:
    last_heartbeat_at: int | None = None
    last_event_at: int | None = None
    healthy_since: int | None = None
    contract: str | None = None
    bar_ready: bool = False
    orderflow_gap_pending: bool = False
    connected: bool = False
    queue_depth: int = 0
    dropped_stale: int = 0
    dropped_overflow: int = 0
    sequence_gaps: int = 0
    event_lags: deque[int] = field(default_factory=lambda: deque(maxlen=10_000))
    transport_lags: deque[int] = field(default_factory=lambda: deque(maxlen=10_000))
    bar_close_lags: deque[int] = field(default_factory=lambda: deque(maxlen=120))
    details: dict = field(default_factory=dict)


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
AutoTradeClosedBarSink = Callable[[OHLCVBar, int | None], Awaitable[None] | None]
AutoTradePriceSink = Callable[[float, int], Awaitable[None] | None]
ManualTrailingClosedBarSink = Callable[[str, OHLCVBar], Awaitable[None] | None]


class Pipeline:
    """Wires ingestion, engines, persistence, and registry streaming. (Req 20.1)"""

    def __init__(
        self,
        *,
        registry: WebSocketRegistry,
        cache: CacheStore,
        tick_store: TickStore,
        liquidity_store: LiquidityStore | None = None,
        resolver: ContractResolver,
        settings: Settings | None = None,
        symbol: str = "GC",
        bar_aggregator: BarAggregator | None = None,
        volume_delta: VolumeDeltaEngine | None = None,
        fvg_signal: FvgSignalEngine | None = None,
        native_fvg_signal: FvgSignalEngine | None = None,
        native_fvg_seeded: set[tuple[str, str]] | None = None,
        big_trade: BigTradeEngine | None = None,
        breakout_box: BreakoutBoxEngine | None = None,
        alert_engine: AlertEngine | None = None,
        basis_engine: BasisEngine | None = None,
        send_alert_text: AlertTextSender | None = None,
        analyst_event_sink: AnalystEventSink | None = None,
        auto_trade_closed_bar_sink: AutoTradeClosedBarSink | None = None,
        auto_trade_price_sink: AutoTradePriceSink | None = None,
        manual_trailing_closed_bar_sink: ManualTrailingClosedBarSink | None = None,
        control_plane: ControlPlaneCoordinator | None = None,
        validator: SequenceValidator | None = None,
        enable_tick_fvg_signal: bool = True,
        trend_analyzer: TrendAnalyzerEngine | None = None,
    ) -> None:
        self._settings = settings or default_settings
        self._registry = registry
        self._cache = cache
        self._tick_store = tick_store
        self._liquidity_store = liquidity_store
        self._resolver = resolver
        self._symbol = symbol
        self._auto_trade_closed_bar_sink = auto_trade_closed_bar_sink
        self._auto_trade_price_sink = auto_trade_price_sink
        self._manual_trailing_closed_bar_sink = manual_trailing_closed_bar_sink
        self._bars = bar_aggregator or BarAggregator()
        self._source_bars: dict[str, BarAggregator] = {
            "nt": self._bars,
            "bookmap": BarAggregator(),
            "rithmic": BarAggregator(),
        }
        # One VolumeDelta engine per supported timeframe so the lower
        # delta-candle series follows the charted timeframe (Req 13). The
        # Bar_Aggregator already fans out across all timeframes; mirror that here
        # so a REST read / live update exists for every ``tf`` the UI can select.
        # An injected engine (tests/replay) seeds its own timeframe; the rest are
        # constructed with matching mode/min-trade-size so behavior is uniform.
        seed = volume_delta
        self._source_vds: dict[str, dict[str, VolumeDeltaEngine]] = {
            "nt": {},
            "bookmap": {},
            "rithmic": {},
        }
        for source, engines in self._source_vds.items():
            for tf in SUPPORTED_TFS:
                if source == "nt" and seed is not None and seed.timeframe == tf:
                    engines[tf] = seed
                else:
                    engines[tf] = VolumeDeltaEngine(
                        timeframe=tf,
                        mode=seed.mode if seed is not None else VolumeDeltaMode.DELTA,
                        min_trade_size=seed.min_trade_size if seed is not None else 0,
                        zero_baseline=source != "nt",
                    )
        # Compatibility alias for focused tests and replay code that injects the
        # historical NT engine.  Live routing uses the source-scoped map above.
        self._vds = self._source_vds["nt"]
        self._source_footprints = {
            "bookmap": FootprintEngine(),
            "rithmic": FootprintEngine(),
        }
        self._source_tdu = {
            "nt": TduSignalEngine(),
            "bookmap": TduSignalEngine(),
            "rithmic": TduSignalEngine(),
        }
        self._fvg = fvg_signal or FvgSignalEngine()
        self._native_fvg_signal = native_fvg_signal
        self._native_fvg_seeded = (
            native_fvg_seeded if native_fvg_seeded is not None else set()
        )
        self._enable_tick_fvg_signal = enable_tick_fvg_signal
        self._bt = big_trade or BigTradeEngine(dedupe_repeated_timestamp_runs=True)
        self._source_big_trades: dict[str, BigTradeEngine | BookmapBigTradeEngine] = {
            "nt": self._bt,
            "bookmap": BookmapBigTradeEngine(),
            "rithmic": BookmapBigTradeEngine(),
        }
        self._breakout = breakout_box or BreakoutBoxEngine()
        self._alerts = alert_engine or AlertEngine(cache)
        self._market_explorer = MarketVolumeStopEngine(
            load_market_explorer_settings(cache),
            tick_size=0.1,
        )
        self._trend_analyzer = trend_analyzer or TrendAnalyzerEngine(tick_size=0.1)
        liquidity_settings = load_liquidity_settings(cache)
        self._long_term_liquidity_touch = LongTermLiquidityTouchEngine(
            tick_size=0.1,
            min_age_ms=int(liquidity_settings["longTermMinAgeSeconds"]) * 1_000,
        )
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
        self._rithmic_coordinator = IngestionCoordinator(
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
        self._feed_states = {
            "nt": _FeedState(),
            "bookmap": _FeedState(),
            "rithmic": _FeedState(
                details={"shadow": True, "selectable": False}
            ),
        }
        self._source_snapshots: dict[str, dict[str, list[BarUpdate]]] = {
            "nt": {},
            "bookmap": {},
            "rithmic": {},
        }
        self._bookmap_minute_bars: dict[int, BarUpdate] = {}
        self._bookmap_minute_deltas: dict[int, VolumeDeltaUpdate] = {}
        self._bookmap_connection_id: str | None = None
        # Closed Bookmap bar snapshots carry the authoritative full ladder.
        # Keep their minute keys so a delayed/partial tick close cannot write
        # an incomplete ladder over the repaired snapshot.
        self._bookmap_authoritative_footprint_times: set[int] = set()
        # Legacy Bookmap bridges may omit the ladder, and a dropped raw trade
        # can make the rebuild incomplete.  Keep those minutes out of the
        # tick-close persistence path until a complete snapshot/rebuild exists.
        self._bookmap_incomplete_footprint_times: set[int] = set()
        self._derived_source_lock = asyncio.Lock()
        self._last_market_status_emit = 0
        self._last_footprint_flush = 0
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

    @property
    def market_explorer(self) -> MarketVolumeStopEngine:
        return self._market_explorer

    @property
    def trend_analyzer(self) -> TrendAnalyzerEngine:
        return self._trend_analyzer

    def configure_market_explorer(self, settings: dict) -> None:
        self._market_explorer.configure(settings)

    def configure_liquidity(self, settings: dict) -> None:
        self._long_term_liquidity_touch.set_min_age_ms(
            int(settings["longTermMinAgeSeconds"]) * 1_000
        )

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
        self._feed_states["nt"].contract = trade.contract
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
        self._feed_states["nt"].contract = quote.contract
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

    async def on_rithmic_connect(self, details: dict) -> None:
        """Start a fresh direct-feed generation without changing ownership."""

        state = self._feed_states["rithmic"]
        state.last_heartbeat_at = None
        state.last_event_at = None
        state.healthy_since = None
        state.connected = True
        state.bar_ready = False
        state.orderflow_gap_pending = False
        state.details = {
            **details,
            "shadow": self._settings.rithmic_shadow_mode,
            "selectable": not self._settings.rithmic_shadow_mode,
        }
        state.contract = str(details.get("contract") or "") or None
        self._rithmic_coordinator = IngestionCoordinator(
            self._tick_store,
            SequenceValidator(),
            emit_degraded=self._emit_status,
        )
        self._note_feed_heartbeat("rithmic", now_ms())

    async def on_rithmic_disconnect(self, reason: str | None = None) -> None:
        state = self._feed_states["rithmic"]
        state.connected = False
        state.healthy_since = None
        state.bar_ready = False
        if reason:
            state.details["lastError"] = reason

    async def on_rithmic_health(self, details: dict) -> None:
        state = self._feed_states["rithmic"]
        state.details.update(details)
        _shadow = self._settings.rithmic_shadow_mode
        state.details["shadow"] = _shadow
        state.details["selectable"] = not _shadow
        state.contract = str(details.get("contract") or state.contract or "") or None
        subscriptions = details.get("subscriptions") or {}
        state.bar_ready = bool(subscriptions.get("l1", False))
        if bool(details.get("mboSynchronized", False)):
            state.orderflow_gap_pending = False
        self._note_feed_heartbeat("rithmic", now_ms())

    async def on_rithmic_depth(
        self, details: dict, *, sequence_gap: bool = False
    ) -> None:
        state = self._feed_states["rithmic"]
        state.details.update(details)
        # Service diagnostics are transport-level and deliberately default to
        # shadow. Arbitration policy belongs to runtime settings, so never let
        # a depth/status refresh overwrite the configured promotion state.
        state.details["shadow"] = self._settings.rithmic_shadow_mode
        state.details["selectable"] = not self._settings.rithmic_shadow_mode
        self._note_feed_heartbeat("rithmic", now_ms())
        if sequence_gap:
            state.sequence_gaps += 1
            state.orderflow_gap_pending = True
        elif bool(details.get("mboSynchronized", False)):
            state.orderflow_gap_pending = False

    async def on_rithmic_trade(self, trade: NormalizedTrade) -> None:
        """Record and warm direct-feed engines while Bookmap remains owner."""

        received = now_ms()
        trade.source = "rithmic"
        trade.received_at = received
        decision = await self._rithmic_coordinator.on_trade(trade)
        if not decision.accepted:
            return
        state = self._feed_states["rithmic"]
        if decision.outcome is SeqOutcome.GAP:
            state.sequence_gaps += 1
            state.orderflow_gap_pending = True
        state.contract = trade.contract
        self._note_feed_event("rithmic", trade.time, trade.bridge_time, received)
        if trade.contract != self._active_contract():
            return
        await self._run_trade_engines(
            _trade_for_contract(trade, self._chart_contract()), source="rithmic"
        )

    async def on_rithmic_quote(self, quote: NormalizedQuote) -> None:
        """Record source-isolated direct BBO; never broadcast while shadowed."""

        received = now_ms()
        quote.source = "rithmic"
        quote.received_at = received
        decision = await self._rithmic_coordinator.on_quote(quote)
        if not decision.accepted:
            return
        state = self._feed_states["rithmic"]
        if decision.outcome is SeqOutcome.GAP:
            state.sequence_gaps += 1
        state.contract = quote.contract
        self._note_feed_event("rithmic", quote.time, quote.bridge_time, received)

    async def on_bookmap_connect(self, connection_id: str) -> None:
        """Start a fresh Bookmap connection generation and sequence scope."""
        self._bookmap_connection_id = connection_id
        state = self._feed_states["bookmap"]
        state.connected = False
        state.last_heartbeat_at = None
        state.last_event_at = None
        state.healthy_since = None
        state.bar_ready = False
        # Require the reconnect snapshot barrier before this generation can
        # become primary; otherwise an old ready flag can promote it before the
        # ladder state has been seeded.
        state.orderflow_gap_pending = True
        self._bookmap_coordinator = IngestionCoordinator(
            self._tick_store,
            SequenceValidator(),
            emit_degraded=self._emit_status,
        )
        engine = self._source_big_trades["bookmap"]
        if isinstance(engine, BookmapBigTradeEngine):
            engine.reset_pending()
        self._long_term_liquidity_touch.reset()
        self._market_explorer.reset()

    def is_current_bookmap_connection(self, connection_id: str) -> bool:
        return self._bookmap_connection_id == connection_id

    def note_bookmap_sequence_gap(self) -> None:
        """Record a non-trade channel gap without invalidating the ladder.

        Heartbeat and bar channels have independent counters and can be dropped
        without losing any trade. Actual trade gaps are detected by the trade
        coordinator in :meth:`on_bookmap_trade` and do invalidate order flow.
        """
        state = self._feed_states["bookmap"]
        state.sequence_gaps += 1

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
            gap_state = self._feed_states["bookmap"]
            gap_state.sequence_gaps += 1
            # A missing trade makes the intrabar ladder incomplete.  Fall back
            # until the next authoritative Bookmap bar snapshot repairs it.
            gap_state.orderflow_gap_pending = True
            gap_state.bar_ready = False
            gap_state.healthy_since = None
        self._note_feed_event("bookmap", trade.time, trade.bridge_time, received)
        state = self._feed_states["bookmap"]
        state.contract = trade.contract
        if trade.contract != self._active_contract():
            return
        await self._publish_long_term_liquidity_touches(
            self._long_term_liquidity_touch.on_trade(trade)
        )
        # Market Explorer is a Bookmap-native calculation in TTW. Feed it the
        # accepted aggressor trade before normalizing the chart contract.
        self._market_explorer.on_trade(trade)
        await self._publish_trend_analyzer(self._trend_analyzer.on_trade(trade))
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
            state.bar_ready = (
                not bool(payload.get("partialStart", True))
                and not state.orderflow_gap_pending
            )
        state.queue_depth = int(payload.get("queueDepth", state.queue_depth) or 0)
        state.dropped_stale = int(
            payload.get("droppedStale", state.dropped_stale) or 0
        )
        state.dropped_overflow = int(
            payload.get("droppedOverflow", state.dropped_overflow) or 0
        )
        self._note_feed_heartbeat("bookmap", received)
        event_time = int(payload.get("time") or received)
        if state.contract == self._active_contract():
            await self._publish_trend_analyzer(
                self._trend_analyzer.advance(event_time)
            )
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
        state.bar_ready = not partial and not state.orderflow_gap_pending
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
        bar = update.bar
        if update.tf != FOOTPRINT_TIMEFRAME or not self._valid_rollup_bar(
            bar.open,
            bar.high,
            bar.low,
            bar.close,
            bar.volume,
        ):
            state.orderflow_gap_pending = True
            state.bar_ready = False
            state.healthy_since = None
            await self._evaluate_source_selection(received)
            raise ValueError("invalid Bookmap bar snapshot")
        try:
            bookmap_vd, bookmap_fp = self._reconcile_bookmap_orderflow(
                payload, update
            )
        except (KeyError, TypeError, ValueError):
            state.orderflow_gap_pending = True
            state.bar_ready = False
            state.healthy_since = None
            await self._evaluate_source_selection(received)
            raise
        if bookmap_fp is None and update.closed:
            # Older deployed bridge JARs send the authoritative OHLCV close but
            # omit the ladder fields. Rebuild that closed minute from the raw
            # Bookmap shard, whose trades are ordered independently of live
            # websocket delivery, so a delayed tick prefix cannot be cached as
            # the final footprint.
            rebuilt = await asyncio.to_thread(
                self._rebuild_bookmap_footprint, bar_time
            )
            if rebuilt is not None and self._bookmap_footprint_matches_bar(rebuilt, bar):
                bookmap_fp = rebuilt
            else:
                # Do not persist/broadcast a prefix ladder as if it were final.
                # The OHLCV snapshot remains usable, while order-flow stays
                # degraded until a complete snapshot is received.
                state.orderflow_gap_pending = True
                state.bar_ready = False
                self._bookmap_incomplete_footprint_times.add(bar_time)
                bookmap_fp = None
        if bookmap_fp is not None and bool(payload.get("closed", False)) and not partial:
            self._bookmap_incomplete_footprint_times.discard(bar_time)
            self._bookmap_authoritative_footprint_times.add(bar_time)
            cutoff = bar_time - 7 * 24 * 60 * 60 * 1_000
            self._bookmap_authoritative_footprint_times = {
                t for t in self._bookmap_authoritative_footprint_times if t >= cutoff
            }
            self._bookmap_incomplete_footprint_times = {
                t for t in self._bookmap_incomplete_footprint_times if t >= cutoff
            }
        self._source_bars["bookmap"].reconcile_bar(
            self._chart_contract(),
            update.tf,
            update.bar,
            closed=update.closed,
        )
        if not partial:
            # A valid OHLCV bar clears the gap even when the bridge does not
            # embed orderflow fields.  The live tick stream already drives
            # volume-delta and footprint engines independently.
            if state.orderflow_gap_pending:
                state.healthy_since = received
            state.orderflow_gap_pending = False
        state.bar_ready = not partial and not state.orderflow_gap_pending
        bookmap_vds = (
            []
            if bookmap_vd is None
            else self._bookmap_delta_rollup_updates(bookmap_vd)
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
        await self._evaluate_source_selection(received)

        # Evaluate first: this snapshot may be the event that promotes Bookmap
        # after a reconnect/source switch. Once Bookmap owns the keys, the
        # authoritative snapshot must be persisted immediately.
        if self._active_feed == "bookmap":
            async with self._derived_source_lock:
                if self._active_feed != "bookmap":
                    return
                bookmap_fvg_updates = self._grade_bookmap_fvg(
                    update,
                    bookmap_fp,
                    snapshot=snapshot,
                )
                await asyncio.to_thread(
                    self._persist_derived_batch,
                    updates,
                    bookmap_vds,
                    bookmap_fvg_updates,
                    [],
                    [] if bookmap_fp is None else [bookmap_fp],
                    bookmap_fp is not None,
                )
                for source_update in updates:
                    await self._enqueue(OutboundEvent.from_message(source_update))
                for delta_update in bookmap_vds:
                    await self._enqueue(OutboundEvent.from_message(delta_update))
                if bookmap_fp is not None:
                    await self._enqueue(OutboundEvent.from_message(bookmap_fp))
                for fvg_update in bookmap_fvg_updates:
                    await self._enqueue(OutboundEvent.from_message(fvg_update))
            if not snapshot:
                await self._evaluate_bookmap_bar_alerts(
                    updates,
                    received,
                    volume_delta_update=bookmap_vd,
                    footprint_update=bookmap_fp,
                )

    async def on_bookmap_liquidity(
        self, payload: dict, *, connection_id: str | None = None
    ) -> None:
        """Persist and stream a compact depth-derived liquidity signal."""

        if not self._accept_bookmap_connection(connection_id):
            return
        contract = str(payload["contract"])
        if contract != self._active_contract():
            return
        event_kind = str(payload["eventKind"])
        action = str(payload["action"])
        side = str(payload["side"])
        if event_kind not in {"relative", "absolute", "long_term"}:
            raise ValueError(f"invalid liquidity eventKind {event_kind!r}")
        if side not in {"bid", "ask"}:
            raise ValueError(f"invalid liquidity side {side!r}")
        if action not in {
            "added", "removed", "crossed", "start", "update", "end", "snapshot"
        }:
            raise ValueError(f"invalid liquidity action {action!r}")

        update = LiquidityUpdate(
            symbol=self._symbol,
            contract=self._chart_contract(),
            sequence=int(payload["sequence"]),
            time=int(payload["time"]),
            event_kind=event_kind,
            action=action,
            side=side,
            price=float(payload["price"]),
            size=max(0, int(payload.get("size") or 0)),
            previous_size=max(0, int(payload.get("previousSize") or 0)),
            change=max(0, int(payload.get("change") or 0)),
            threshold=max(0, int(payload.get("threshold") or 0)),
            dom_distance=(None if payload.get("domDistance") is None else int(payload["domDistance"])),
            strength=max(0.0, float(payload.get("strength") or 0.0)),
            source_contract=str(payload.get("sourceContract") or contract),
            line_id=(None if payload.get("lineId") is None else str(payload["lineId"])),
            line_start_time=(
                None if payload.get("lineStartTime") is None else int(payload["lineStartTime"])
            ),
            snapshot=bool(payload.get("snapshot", False)),
        )
        if update.event_kind == "long_term" and not update.line_id:
            raise ValueError("long_term liquidity event requires lineId")
        self._long_term_liquidity_touch.on_liquidity(update)
        wire = update.to_dict()
        if self._liquidity_store is not None:
            await asyncio.to_thread(self._liquidity_store.record, wire)
        await self._enqueue(OutboundEvent.from_message(update))

    async def _publish_trend_analyzer(
        self, batches: list[TrendAnalyzerBatch]
    ) -> None:
        for batch in batches:
            update = TrendAnalyzerUpdate(
                symbol=self._symbol,
                contract=self._chart_contract(),
                source_contract=self._trend_analyzer.source_contract,
                time=batch.time,
                points=[point.to_dict() for point in batch.points],
                markers=[marker.to_dict() for marker in batch.markers],
            )
            await self._enqueue(OutboundEvent.from_message(update))

    async def _publish_long_term_liquidity_touches(
        self, touches: list[LongTermLiquidityTouch]
    ) -> None:
        for touch in touches:
            update = LiquidityUpdate(
                symbol=self._symbol,
                contract=self._chart_contract(),
                source_contract=touch.source_contract,
                sequence=touch.sequence,
                time=touch.time,
                event_kind="long_term_touch",
                action="touch",
                side=touch.side,
                price=touch.price,
                size=touch.volume,
                previous_size=touch.line_size,
                change=touch.volume,
                threshold=touch.threshold,
                dom_distance=touch.dom_distance,
                strength=float(touch.volume),
                line_id=touch.line_id,
                line_start_time=touch.line_start_time,
                snapshot=False,
            )
            if self._liquidity_store is not None:
                await asyncio.to_thread(self._liquidity_store.record, update.to_dict())
            await self._enqueue(OutboundEvent.from_message(update))

    def _reconcile_bookmap_orderflow(
        self, payload: dict, bar_update: BarUpdate
    ) -> tuple[VolumeDeltaUpdate | None, FootprintUpdate | None]:
        """Seed live Bookmap order-flow engines from a full bar snapshot.

        Returns ``(None, None)`` when the payload does not contain embedded
        order-flow fields.  This allows legacy bridge JARs that send only
        OHLCV bars to still promote Bookmap as the active source; the live
        tick stream drives volume-delta and footprint engines independently.
        """
        contract = self._chart_contract()
        required = {
            "buyVolume",
            "sellVolume",
            "delta",
            "deltaHigh",
            "deltaLow",
            "openDelta",
            "closeDelta",
            "rows",
        }
        missing = required.difference(payload)
        if missing:
            if not getattr(self, "_bookmap_orderflow_missing_logged", False):
                logger.info(
                    "Bookmap bar snapshot without embedded order-flow "
                    "(missing %s); live tick stream will drive engines",
                    ", ".join(sorted(missing)),
                )
                self._bookmap_orderflow_missing_logged = True
            return None, None

        volume = int(payload["volume"])
        buy_volume = int(payload["buyVolume"])
        sell_volume = int(payload["sellVolume"])
        delta = int(payload["delta"])
        delta_high = int(payload["deltaHigh"])
        delta_low = int(payload["deltaLow"])
        open_delta = int(payload["openDelta"])
        close_delta = int(payload["closeDelta"])
        if min(volume, buy_volume, sell_volume) < 0:
            raise ValueError("Bookmap order-flow volumes must be non-negative")
        if buy_volume + sell_volume != volume:
            raise ValueError("Bookmap buy/sell volume does not conserve bar volume")
        if delta != buy_volume - sell_volume or close_delta != delta:
            raise ValueError("Bookmap delta does not match buy/sell volume")
        if open_delta != 0:
            raise ValueError("Bookmap delta snapshots must use a zero baseline")
        if delta_low > min(0, close_delta) or delta_high < max(0, close_delta):
            raise ValueError("Bookmap delta extrema do not contain the delta path")

        raw_rows = payload["rows"]
        if not isinstance(raw_rows, list):
            raise ValueError("Bookmap bar rows must be a list")
        footprint_engine = self._source_footprints["bookmap"]
        rows: list[tuple[float, int, int]] = []
        seen_prices: set[float] = set()
        row_bid = 0
        row_ask = 0
        for raw in raw_rows:
            if not isinstance(raw, dict):
                raise ValueError("Bookmap footprint row must be an object")
            price = float(raw["price"])
            bid = int(raw.get("bid", 0))
            ask = int(raw.get("ask", 0))
            if not math.isfinite(price) or price <= 0 or min(bid, ask) < 0:
                raise ValueError("Bookmap footprint row contains invalid values")
            price = footprint_engine.level_price(price)
            if price in seen_prices:
                raise ValueError("Bookmap footprint snapshot contains duplicate levels")
            if price < bar_update.bar.low - 1e-8 or price > bar_update.bar.high + 1e-8:
                raise ValueError("Bookmap footprint level is outside bar range")
            seen_prices.add(price)
            row_bid += bid
            row_ask += ask
            rows.append((price, bid, ask))
        if row_bid != sell_volume or row_ask != buy_volume:
            raise ValueError("Bookmap footprint ladder does not conserve side volume")

        volume_delta = VolumeDeltaUpdate(
            symbol=bar_update.symbol,
            contract=contract,
            tf=bar_update.tf,
            time=bar_update.bar.time,
            volume=volume,
            buy_volume=buy_volume,
            sell_volume=sell_volume,
            delta=delta,
            delta_high=delta_high,
            delta_low=delta_low,
            open_delta=open_delta,
            close_delta=close_delta,
        )
        self._source_vds["bookmap"][FOOTPRINT_TIMEFRAME].seed_bar(
            contract,
            time=volume_delta.time,
            volume=volume_delta.volume,
            buy_volume=volume_delta.buy_volume,
            sell_volume=volume_delta.sell_volume,
            delta_high=volume_delta.delta_high,
            delta_low=volume_delta.delta_low,
            open_delta=volume_delta.open_delta,
            close_delta=volume_delta.close_delta,
            last_price=bar_update.bar.close,
        )

        footprint_engine.seed_bar(
            contract,
            symbol=bar_update.symbol,
            time=bar_update.bar.time,
            open=bar_update.bar.open,
            high=bar_update.bar.high,
            low=bar_update.bar.low,
            close=bar_update.bar.close,
            rows=rows,
        )
        return volume_delta, footprint_engine.current_update(contract)

    def _rebuild_bookmap_footprint(self, bar_time: int) -> FootprintUpdate | None:
        """Rebuild one closed Bookmap footprint minute from ordered raw ticks."""
        physical_contract = self._chart_source_contract or self._active_contract()
        if not physical_contract:
            return None
        engine = FootprintEngine()
        final: FootprintUpdate | None = None
        for raw_trade in self._tick_store.read_range(
            physical_contract,
            bar_time,
            bar_time + 60_000 - 1,
            source="bookmap",
        ):
            chart_trade = _trade_for_contract(raw_trade, self._chart_contract())
            update = engine.on_trade(chart_trade)
            if update is not None:
                final = update
        return final

    @staticmethod
    def _bookmap_footprint_matches_bar(
        footprint: FootprintUpdate, bar: OHLCVBar
    ) -> bool:
        """Require a raw-tick rebuild to reconcile with Bookmap's OHLCV close."""
        prices_match = all(
            math.isclose(left, right, rel_tol=0.0, abs_tol=1e-9)
            for left, right in (
                (footprint.open, bar.open),
                (footprint.high, bar.high),
                (footprint.low, bar.low),
                (footprint.close, bar.close),
            )
        )
        volume = sum(row.bid + row.ask for row in footprint.rows)
        return prices_match and volume == bar.volume

    def _grade_bookmap_fvg(
        self,
        bar_update: BarUpdate,
        footprint_update: FootprintUpdate | None,
        *,
        snapshot: bool,
    ) -> list[FvgSignalUpdate]:
        """Grade one authoritative closed Bookmap M1 footprint bar."""
        engine = self._native_fvg_signal
        if (
            engine is None
            or snapshot
            or not bar_update.closed
            or bar_update.tf != FOOTPRINT_TIMEFRAME
            or footprint_update is None
        ):
            return []

        catchup_updates = self._seed_shared_fvg_engine(
            symbol=bar_update.symbol,
            contract=bar_update.contract,
            before_time_ms=bar_update.bar.time,
        )
        bar = bar_update.bar
        live_updates = engine.on_closed_bar(
            symbol=bar_update.symbol,
            contract=bar_update.contract,
            time=bar.time,
            open=bar.open,
            high=bar.high,
            low=bar.low,
            close=bar.close,
            rows=[(row.price, row.bid, row.ask) for row in footprint_update.rows],
            emit_clear=True,
        )
        return [*catchup_updates, *live_updates]

    def _seed_shared_fvg_engine(
        self,
        *,
        symbol: str,
        contract: str,
        before_time_ms: int,
    ) -> list[FvgSignalUpdate]:
        """Hydrate the shared grader and return missed confirmed signals.

        The latest cached signal is not a processing checkpoint: a quiet grader
        can legitimately go many bars without a match. Replaying up to 3,000
        recent finalized bars both restores engine state and repairs the signal
        gap left while the former NT-only source was offline.
        """
        engine = self._native_fvg_signal
        seed_key = (symbol, contract)
        if engine is None or seed_key in self._native_fvg_seeded:
            return []

        existing = self._cache.read_fvg_signals(
            symbol,
            contract,
            FOOTPRINT_TIMEFRAME,
            limit=1,
        )
        persist_after = existing[-1].time if existing else -1
        replay_from = (
            max(0, persist_after - 30 * 60_000)
            if persist_after >= 0
            else None
        )

        bars = self._cache.read_bars(
            symbol,
            contract,
            FOOTPRINT_TIMEFRAME,
            replay_from,
            before_time_ms - 1,
            3_000,
        )
        levels_by_time: dict[int, list[tuple[float, int, int]]] = defaultdict(list)
        if bars:
            levels = self._cache.read_footprint_levels_range(
                symbol,
                contract,
                FOOTPRINT_TIMEFRAME,
                bars[0].time,
                bars[-1].time,
            )
            for level in levels:
                levels_by_time[level.time].append(
                    (level.price, level.bid_volume, level.ask_volume)
                )

        catchup_updates: list[FvgSignalUpdate] = []
        for bar in bars:
            if not bar.closed:
                continue
            rows = levels_by_time.get(bar.time)
            if not rows:
                continue
            updates = engine.on_closed_bar(
                symbol=symbol,
                contract=contract,
                time=bar.time,
                open=bar.open,
                high=bar.high,
                low=bar.low,
                close=bar.close,
                rows=rows,
                emit_clear=False,
            )
            catchup_updates.extend(
                update
                for update in updates
                if update.phase == "confirmed"
                and update.pulse != 0
                and update.time > persist_after
            )
        self._native_fvg_seeded.add(seed_key)
        if catchup_updates:
            logger.info(
                "FVG grader recovered %s Bookmap signals after %s",
                len(catchup_updates),
                persist_after,
            )
        return catchup_updates

    # -- engine fan-out --------------------------------------------------------

    async def _run_trade_engines(self, trade: NormalizedTrade, *, source: str) -> None:
        if not is_gc_session_open(trade.time):
            return

        # Keep every source warm so a fallback can take over without starting a
        # fresh intrabar state.  Only the active source is allowed to persist or
        # broadcast the shared chart keys below.
        source_bar_updates = self._source_bars[source].on_trade(trade)
        self._remember_source_updates(source, source_bar_updates)
        source_tdu_updates = self._source_tdu[source].on_trade(trade)
        source_vd_updates: list[VolumeDeltaUpdate] = []
        for engine in self._source_vds[source].values():
            update = engine.on_trade(trade)
            if update is not None:
                source_vd_updates.append(update)

        source_fp_update: FootprintUpdate | None = None
        closed_footprint: FootprintUpdate | None = None
        footprint_engine = self._source_footprints.get(source)
        if footprint_engine is not None:
            # The footprint engine only retains the current forming bar; once a
            # trade opens a new minute the previous bar's ladder is dropped.
            # Snapshot the closing bar before on_trade() rolls the bucket so it
            # can be persisted to the delta-profile cache below. This keeps the
            # session-daily histogram current even when the Bookmap bar
            # snapshot does not embed order-flow fields.
            closed_1m = next(
                (
                    u
                    for u in source_bar_updates
                    if u.tf == FOOTPRINT_TIMEFRAME and u.closed
                ),
                None,
            )
            if closed_1m is not None:
                prev_fp = footprint_engine.current_update(trade.contract)
                if prev_fp is not None and prev_fp.time == closed_1m.bar.time:
                    closed_footprint = prev_fp
            source_fp_update = footprint_engine.on_trade(trade)

        # 3) Legacy NT tick FVG remains internal for breakout/FVG confluence.
        # The shared grader confirms from authoritative Bookmap footprint bars
        # and uses active Bookmap trades only for provisional source-bar color.
        # When Bookmap is unavailable, finalized NT native bars drive the same
        # shared engine through the HTTP fallback route.
        raw_fvg_updates = self._fvg.on_trade(trade) if source == "nt" else []
        fvg_updates = raw_fvg_updates if self._enable_tick_fvg_signal else []
        native_fvg_preview_updates: list[FvgSignalUpdate] = []
        if (
            source == "bookmap"
            and self._active_feed == "bookmap"
            and self._native_fvg_signal is not None
            and not self._enable_tick_fvg_signal
        ):
            native_fvg_preview_updates = self._native_fvg_signal.on_preview_trade(trade)

        # 4) BigTrade (merge + filter). (Req 15)
        source_big_trades = self._source_big_trades[source].on_trade(trade)
        for bt in source_big_trades:
            bt.source = source

        # Serialize active-source writes with feed switches.  This second source
        # check prevents an in-flight old-source task from winning the SQLite
        # race after a switch has already selected the other feed.
        alert_ctx_bar: BarUpdate | None = None
        closed_bars: dict[str, BarUpdate] = {}
        vd_update: VolumeDeltaUpdate | None = None
        fp_update: FootprintUpdate | None = None
        bar_updates: list[BarUpdate] = []
        vd_updates: list[VolumeDeltaUpdate] = []
        big_trades: list[BigTrade] = []
        tdu_updates: list[TduSignalUpdate] = []
        breakout_events: list[BreakoutBoxEvent] = []
        active = False
        async with self._derived_source_lock:
            active = self._active_feed == source
            if active:
                bar_updates = source_bar_updates
                vd_updates = source_vd_updates
                big_trades = source_big_trades
                tdu_updates = source_tdu_updates
                fp_update = source_fp_update
                use_trade_built_bar_alerts = source != "bookmap"
                for update in bar_updates:
                    if update.closed and use_trade_built_bar_alerts:
                        closed_bars[update.tf] = update
                        if update.tf == _ALERT_BAR_TF:
                            alert_ctx_bar = update
                vd_update = next(
                    (u for u in vd_updates if u.tf == _ALERT_BAR_TF), None
                )
                if alert_ctx_bar is not None:
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

                # Footprint is broadcast live from every trade; the just-closed
                # bar's ladder is persisted here so the REST delta-profile cache
                # (session-daily histogram) stays current without relying on an
                # embedded order-flow snapshot from the bridge.
                fp_persist: list[FootprintUpdate] = []
                if closed_footprint is not None and not (
                    source == "bookmap"
                    and (
                        closed_footprint.time
                        in self._bookmap_authoritative_footprint_times
                        or closed_footprint.time
                        in self._bookmap_incomplete_footprint_times
                    )
                ):
                    fp_persist.append(closed_footprint)
                await asyncio.to_thread(
                    self._persist_derived_batch,
                    bar_updates,
                    vd_updates,
                    fvg_updates,
                    big_trades,
                    fp_persist or None,
                    bool(fp_persist),
                    tdu_signal_updates=tdu_updates,
                )
                if self._analyst_event_sink is not None and (
                    bar_updates
                    or vd_updates
                    or fp_update is not None
                    or fvg_updates
                    or big_trades
                ):
                    try:
                        self._analyst_event_sink()
                    except Exception as exc:
                        logger.warning("analyst event enqueue failed: %s", exc)
                for update in bar_updates:
                    await self._enqueue(OutboundEvent.from_message(update))
                for update in vd_updates:
                    await self._enqueue(OutboundEvent.from_message(update))
                if fp_update is not None:
                    await self._enqueue(OutboundEvent.from_message(fp_update))
                for update in fvg_updates:
                    await self._enqueue(OutboundEvent.from_message(update))
                for update in native_fvg_preview_updates:
                    await self._enqueue(OutboundEvent.from_message(update))
                for update in tdu_updates:
                    await self._enqueue(OutboundEvent.from_message(update))
                for bt in big_trades:
                    await self._enqueue(OutboundEvent.from_message(bt))

        # Track the most recent confirmed FVG signal for confluence matching.
        # We only keep the latest confirmed signal; the confluence alert checks
        # if a breakout happened on the same closed-bar cycle.
        fvg_confirmed_level: int | None = None
        fvg_confirmed_direction: int | None = None
        for u in raw_fvg_updates:
            if u.phase == "confirmed" and u.pulse != 0:
                fvg_confirmed_level = u.level
                fvg_confirmed_direction = u.direction

        # Preserve the legacy injected tick-FVG path for tests/replay. Shared
        # Bookmap grader previews are active-source-only and never leak from an
        # inactive feed.
        if not active:
            await asyncio.to_thread(
                self._persist_derived_batch, [], [], fvg_updates, []
            )
            if self._analyst_event_sink is not None and fvg_updates:
                try:
                    self._analyst_event_sink()
                except Exception as exc:
                    logger.warning("analyst event enqueue failed: %s", exc)
            for update in fvg_updates:
                await self._enqueue(OutboundEvent.from_message(update))
        # 6) Alerts: last-trade-price crossings + per-bar / big-trade conditions.
        if active and self._active_feed == source:
            await self._evaluate_alerts(
                trade, closed_bar=alert_ctx_bar, vd_update=vd_update,
                fp_update=fp_update,
                big_trades=big_trades,
                closed_bars=closed_bars,
                breakout_events=breakout_events,
                fvg_level=fvg_confirmed_level,
                fvg_direction=fvg_confirmed_direction,
            )
            if self._auto_trade_price_sink is not None:
                await _maybe_await(self._auto_trade_price_sink(trade.price, trade.time))

    async def _evaluate_alerts(
        self,
        trade: NormalizedTrade,
        *,
        closed_bar: BarUpdate | None,
        vd_update: VolumeDeltaUpdate | None,
        big_trades: list[BigTrade],
        fp_update: FootprintUpdate | None = None,
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
            stacked = (
                len(fp_update.stacked_imbalance) > 0
                if fp_update is not None and fp_update.time == bar.time
                else None
            )
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
                bar_stacked_imbalance=stacked,
                breakout_events=breakout_events or None,
                fvg_level=fvg_level,
                fvg_direction=fvg_direction,
            )
            await self._emit_alerts(self._alerts.evaluate(bar_ctx))
            await self._run_auto_trade_closed_bar(bar_ctx)
            await self._run_manual_trailing_closed_bar(bar_ctx)

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
            await self._run_manual_trailing_closed_bar(m5_ctx)

        # Sweep Reversal and Supertrend consume the additional chart
        # timeframes. Keep legacy types on their established M1/M5 paths by
        # using type-filtered evaluators here.
        already_evaluated = {
            closed_bar.tf if closed_bar is not None else None,
            m5_bar.tf if m5_bar is not None else None,
        }
        for tf, update in (closed_bars or {}).items():
            if tf in already_evaluated or not update.closed:
                continue
            bar = update.bar
            sweep_ctx = MarketContext(
                symbol=trade.symbol,
                contract=trade.contract,
                time=trade.time,
                bar_closed=True,
                bar_tf=tf,
                bar_time=bar.time,
                bar_open=bar.open,
                bar_high=bar.high,
                bar_low=bar.low,
                bar_close=bar.close,
                bar_volume=bar.volume,
            )
            extra_events = self._alerts.evaluate_sweep_reversal_only(sweep_ctx)
            extra_events.extend(
                self._alerts.evaluate_supertrend_only(sweep_ctx)
            )
            await self._emit_alerts(extra_events)
            await self._run_manual_trailing_closed_bar(sweep_ctx)

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
        *,
        volume_delta_update: VolumeDeltaUpdate | None = None,
        footprint_update: FootprintUpdate | None = None,
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
                bar_volume_delta=(
                    volume_delta_update.delta
                    if volume_delta_update is not None
                    and volume_delta_update.time == bar.time
                    and volume_delta_update.tf == update.tf
                    else None
                ),
                bar_stacked_imbalance=(
                    len(footprint_update.stacked_imbalance) > 0
                    if footprint_update is not None
                    and footprint_update.time == bar.time
                    and footprint_update.tf == update.tf
                    else None
                ),
                breakout_events=breakout_events or None,
            )
            alert_events = self._alerts.evaluate(ctx)
            alert_events.extend(self._alerts.reconcile_mgann_closed_bar(ctx))
            await self._emit_alerts(alert_events)
            await self._run_auto_trade_closed_bar(ctx)
            await self._run_manual_trailing_closed_bar(ctx)

    async def _run_auto_trade_closed_bar(self, ctx: MarketContext) -> None:
        """Pass only live finalized M1 bars and their volume delta to auto execution."""
        if (
            self._auto_trade_closed_bar_sink is None
            or not ctx.bar_closed
            or ctx.bar_tf != _ALERT_BAR_TF
            or ctx.bar_time is None
            or ctx.bar_open is None
            or ctx.bar_high is None
            or ctx.bar_low is None
            or ctx.bar_close is None
            or ctx.bar_volume is None
        ):
            return
        await _maybe_await(
            self._auto_trade_closed_bar_sink(
                OHLCVBar(
                    time=ctx.bar_time,
                    open=ctx.bar_open,
                    high=ctx.bar_high,
                    low=ctx.bar_low,
                    close=ctx.bar_close,
                    volume=ctx.bar_volume,
                ),
                ctx.bar_volume_delta,
            )
        )

    async def _run_manual_trailing_closed_bar(self, ctx: MarketContext) -> None:
        """Pass every supported live finalized chart bar to manual trailing."""
        if (
            self._manual_trailing_closed_bar_sink is None
            or not ctx.bar_closed
            or ctx.bar_tf not in SUPPORTED_TFS
            or ctx.bar_time is None
            or ctx.bar_open is None
            or ctx.bar_high is None
            or ctx.bar_low is None
            or ctx.bar_close is None
            or ctx.bar_volume is None
        ):
            return
        await _maybe_await(
            self._manual_trailing_closed_bar_sink(
                ctx.bar_tf,
                OHLCVBar(
                    time=ctx.bar_time,
                    open=ctx.bar_open,
                    high=ctx.bar_high,
                    low=ctx.bar_low,
                    close=ctx.bar_close,
                    volume=ctx.bar_volume,
                ),
            )
        )

    # -- persistence -----------------------------------------------------------

    def _persist_derived_batch(
        self,
        bar_updates: list[BarUpdate],
        volume_delta_updates: list[VolumeDeltaUpdate],
        fvg_signal_updates: list[FvgSignalUpdate],
        big_trades: list[BigTrade],
        footprint_updates: list[FootprintUpdate] | None = None,
        replace_footprint_levels: bool = False,
        tdu_signal_updates: list[TduSignalUpdate] | None = None,
    ) -> None:
        footprint_bars: list[FootprintBarRecord] = []
        footprint_levels: list[FootprintLevelRecord] = []
        for update in footprint_updates or []:
            footprint_bars.append(
                FootprintBarRecord(
                    symbol=update.symbol,
                    contract=update.contract,
                    timeframe=update.tf,
                    time=update.time,
                    poc=update.poc,
                    open_price=update.open,
                    high_price=update.high,
                    low_price=update.low,
                    close_price=update.close,
                    poc_volume=update.poc_volume,
                    vah=update.vah,
                    val=update.val,
                    bar_delta=update.bar_delta,
                    buy_pct=update.buy_pct,
                    sell_pct=update.sell_pct,
                    unfinished_high=update.unfinished_auction.high,
                    unfinished_low=update.unfinished_auction.low,
                )
            )
            footprint_levels.extend(
                FootprintLevelRecord(
                    symbol=update.symbol,
                    contract=update.contract,
                    timeframe=update.tf,
                    time=update.time,
                    price=row.price,
                    bid_volume=row.bid,
                    ask_volume=row.ask,
                    imbalance=row.imbalance,
                )
                for row in update.rows
            )

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
            footprint_bars=footprint_bars,
            footprint_levels=footprint_levels,
            replace_footprint_levels=replace_footprint_levels,
            fvg_signals=fvg_signals,
            tdu_signals=(
                TduSignalRecord(
                    symbol=update.symbol,
                    contract=update.contract,
                    timeframe=update.tf,
                    time=update.time,
                    momentum_direction=update.momentum_direction,
                    momentum_level=update.momentum_level,
                    delta_divergence=update.delta_divergence,
                )
                for update in (tdu_signal_updates or [])
            ),
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

    def _bookmap_delta_rollup_updates(
        self, minute_update: VolumeDeltaUpdate
    ) -> list[VolumeDeltaUpdate]:
        """Rebuild higher-timeframe delta from authoritative Bookmap M1 rows.

        A minute snapshot carries enough intrabar extrema to reconstruct the
        exact cumulative-delta path of a larger bucket: offset each minute's
        high/low by the preceding minutes' close delta, then advance the offset.
        This repairs every chart timeframe after a dropped tick or reconnect,
        instead of fixing only the visible M1 row.
        """
        if minute_update.tf != FOOTPRINT_TIMEFRAME:
            return [minute_update]

        self._bookmap_minute_deltas[minute_update.time] = minute_update
        cutoff = minute_update.time - 7 * 24 * 60 * 60 * 1_000
        for old_time in [t for t in self._bookmap_minute_deltas if t < cutoff]:
            self._bookmap_minute_deltas.pop(old_time, None)

        updates = [minute_update]
        contract = self._chart_contract()
        for tf in SUPPORTED_TFS:
            if TF_MS[tf] <= TF_MS[FOOTPRINT_TIMEFRAME]:
                continue
            bucket = timeframe_bucket_start(minute_update.time, tf)
            end = bucket + TF_MS[tf] - 1
            rows: dict[int, tuple[int, int, int, int, int, int]] = {
                rec.time: (
                    rec.volume,
                    rec.buy_volume,
                    rec.sell_volume,
                    rec.delta_high,
                    rec.delta_low,
                    rec.close_delta,
                )
                for rec in self._cache.read_volume_delta(
                    self._symbol,
                    contract,
                    FOOTPRINT_TIMEFRAME,
                    bucket,
                    end,
                )
            }
            for row_time, source_update in self._bookmap_minute_deltas.items():
                if bucket <= row_time <= end:
                    rows[row_time] = (
                        source_update.volume,
                        source_update.buy_volume,
                        source_update.sell_volume,
                        source_update.delta_high,
                        source_update.delta_low,
                        source_update.close_delta,
                    )
            ordered = sorted(rows.items())
            if not ordered:
                continue

            running_delta = 0
            delta_high = 0
            delta_low = 0
            for _, values in ordered:
                delta_high = max(delta_high, running_delta + values[3])
                delta_low = min(delta_low, running_delta + values[4])
                running_delta += values[5]

            update = VolumeDeltaUpdate(
                symbol=self._symbol,
                contract=contract,
                tf=tf,
                time=bucket,
                volume=sum(values[0] for _, values in ordered),
                buy_volume=sum(values[1] for _, values in ordered),
                sell_volume=sum(values[2] for _, values in ordered),
                delta=running_delta,
                delta_high=delta_high,
                delta_low=delta_low,
                open_delta=0,
                close_delta=running_delta,
            )
            self._source_vds["bookmap"][tf].seed_bar(
                contract,
                time=update.time,
                volume=update.volume,
                buy_volume=update.buy_volume,
                sell_volume=update.sell_volume,
                delta_high=update.delta_high,
                delta_low=update.delta_low,
                open_delta=update.open_delta,
                close_delta=update.close_delta,
            )
            updates.append(update)
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
        rithmic = self._feed_states["rithmic"]
        if (
            rithmic.last_heartbeat_at is not None
            and now - rithmic.last_heartbeat_at > self._settings.rithmic_stale_ms
        ):
            rithmic.connected = False
            rithmic.healthy_since = None

        await self._evaluate_source_selection(now)

        for sample, signals in self._market_explorer.advance(now):
            update = MarketExplorerUpdate(
                symbol=self._symbol,
                contract=self._chart_contract(),
                source_contract=self._market_explorer.source_contract,
                time=sample.time,
                value=sample.value,
                buy_volume=sample.buy_volume,
                sell_volume=sample.sell_volume,
                price=sample.price,
                signals=[signal.to_dict() for signal in signals],
            )
            await self._enqueue(OutboundEvent.from_message(update))

        await self._publish_long_term_liquidity_touches(
            self._long_term_liquidity_touch.flush_idle(now)
        )

        # Direct feeds group exchange prints by aggressor order id. Flush idle
        # groups for both feeds so a quiet final group is not stranded. Only
        # the currently active source may publish shared chart keys.
        for source in ("bookmap", "rithmic"):
            engine = self._source_big_trades[source]
            if not isinstance(engine, BookmapBigTradeEngine):
                continue
            emitted = engine.flush_idle(now)
            published: list[BigTrade] = []
            if emitted:
                async with self._derived_source_lock:
                    if self._active_feed == source:
                        for bt in emitted:
                            bt.contract = self._chart_contract()
                            bt.source = source
                        await asyncio.to_thread(
                            self._persist_derived_batch, [], [], [], emitted
                        )
                        for bt in emitted:
                            await self._enqueue(OutboundEvent.from_message(bt))
                        published = emitted
            for bt in published:
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
                        source=source,
                        side=bt.side,
                    ),
                    closed_bar=None,
                    vd_update=None,
                    big_trades=[bt],
                )

        # Periodically flush the forming (in-progress) footprint bar to the
        # cache so the REST delta-profile endpoint reflects the current minute
        # between closed-bar writes. Only the active direct feed owns the shared
        # chart footprint cache keys.
        footprint_source = (
            self._active_feed
            if self._active_feed in ("bookmap", "rithmic")
            else None
        )
        if (
            footprint_source is not None
            and now - self._last_footprint_flush >= _FOOTPRINT_FORMING_FLUSH_MS
        ):
            self._last_footprint_flush = now
            fp_engine = self._source_footprints.get(footprint_source)
            if fp_engine is not None:
                forming = fp_engine.current_update(self._chart_contract())
                if forming is not None:
                    async with self._derived_source_lock:
                        if self._active_feed == footprint_source:
                            await asyncio.to_thread(
                                self._persist_derived_batch,
                                [],
                                [],
                                [],
                                [],
                                [forming],
                                True,
                            )

        if now - self._last_market_status_emit >= 1_000:
            self._last_market_status_emit = now
            await self._enqueue(OutboundEvent.from_message(self.market_data_status_message()))

    async def on_bookmap_disconnect(self, connection_id: str | None = None) -> None:
        if not self._accept_bookmap_connection(connection_id):
            return
        self._bookmap_connection_id = None
        state = self._feed_states["bookmap"]
        state.connected = False
        state.healthy_since = None
        state.bar_ready = False
        state.orderflow_gap_pending = True
        await self._publish_long_term_liquidity_touches(
            self._long_term_liquidity_touch.flush_all()
        )
        self._long_term_liquidity_touch.reset()
        await self._evaluate_source_selection(now_ms())

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

    @property
    def derived_source_lock(self) -> asyncio.Lock:
        """Serialize active-source writes with source-switch resynchronization."""
        return self._derived_source_lock

    def accept_nt_native_orderflow(
        self,
        *,
        symbol: str,
        contract: str,
        tf: str,
        bar_time: int,
        source_contract: str | None = None,
    ) -> bool:
        """Whether an NT native bar may write shared delta/footprint keys.

        Native HTTP bars write only while NT is the selected fallback, preventing
        NT from racing Bookmap's primary live order-flow stream. Historical gap
        imports keep using the existing direct NT-export importer, which does not
        pass through this realtime source gate. Ownership is resolved for the
        bar being posted, not merely from the source active at HTTP arrival time,
        because native finalized bars can arrive just after a source switch.
        """
        if source_contract and source_contract != self._active_contract():
            return False
        bars = self._cache.read_bars(
            symbol,
            contract,
            tf,
            bar_time,
            bar_time,
            limit=1,
        )
        if bars and bars[-1].time == bar_time and bars[-1].source in {
            "nt",
            "bookmap",
        }:
            return bars[-1].source == "nt"
        return self._active_feed == "nt"

    def reconcile_nt_native_orderflow(
        self,
        minute_update: VolumeDeltaUpdate,
        rollup_updates: list[VolumeDeltaUpdate],
    ) -> None:
        """Seed the warm NT delta engines from an accepted native correction.

        This runs under :attr:`derived_source_lock` after the cache transaction.
        When NT is currently active, the persisted rollups include any already
        received open-minute row, so the next NT tick continues from the native
        correction instead of overwriting it with the older provisional state.
        A delayed correction for a prior NT-owned minute seeds only the shared
        higher-timeframe state of the currently active source; it never injects
        an NT M1 ladder into Bookmap's live minute.
        """
        source = self._active_feed
        if source not in self._source_vds:
            return
        contract = self._chart_contract()
        # The M1 correction belongs specifically to NT. Higher-timeframe
        # rollups represent the shared, per-minute ownership timeline and must
        # seed whichever source is currently active or its next tick would
        # overwrite the corrected cache row.
        updates = [*rollup_updates]
        if source == "nt":
            updates.insert(0, minute_update)
        for update in updates:
            engine = self._source_vds[source].get(update.tf)
            if engine is None:
                continue
            current = engine.current_update(contract)
            if current is not None and current.time > update.time:
                continue
            engine.seed_bar(
                contract,
                time=update.time,
                volume=update.volume,
                buy_volume=update.buy_volume,
                sell_volume=update.sell_volume,
                delta_high=update.delta_high,
                delta_low=update.delta_low,
                open_delta=update.open_delta,
                close_delta=update.close_delta,
            )

    def note_nt_native_bar(self, bar_time: int, received_at: int | None = None) -> None:
        """Record finalized NT native bar-close latency without changing OHLC."""
        received = now_ms() if received_at is None else received_at
        self._feed_states["nt"].bar_close_lags.append(
            max(0, received - (bar_time + 60_000))
        )

    def _feed_status_dict(self, source: str, state: _FeedState, now: int) -> dict:
        lags = list(state.event_lags)
        transport = list(state.transport_lags)
        result = {
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
            "orderflowGapPending": state.orderflow_gap_pending,
        }
        result.update(state.details)
        return result

    def _note_feed_heartbeat(self, source: str, received_at: int) -> None:
        state = self._feed_states[source]
        state.last_heartbeat_at = received_at
        state.connected = True
        if state.healthy_since is None and not (
            source == "bookmap" and state.orderflow_gap_pending
        ):
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
            else (
                self._settings.rithmic_stale_ms
                if source == "rithmic"
                else self._settings.nt_feed_stale_ms
            )
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
        if source == "rithmic":
            healthy_ms = (
                0 if state.healthy_since is None else now - state.healthy_since
            )
            return (
                state.contract == self._active_contract()
                and state.bar_ready
                and healthy_ms >= self._settings.rithmic_qualify_ms
            )
        return state.contract in (None, self._active_contract())

    async def _evaluate_source_selection(self, now: int) -> None:
        if self._preferred_source == "nt":
            if self._active_feed is None:
                await self._switch_feed("nt", "nt_preferred", now)
            return

        bookmap_ok = self._feed_eligible("bookmap", now)
        nt_ok = self._feed_eligible("nt", now)
        # Rithmic participates in arbitration only when shadow mode is off.
        rithmic_ok = (
            not self._settings.rithmic_shadow_mode
            and self._feed_eligible("rithmic", now)
        )
        bookmap = self._feed_states["bookmap"]

        # Priority: bookmap > rithmic > nt
        best_non_bookmap = "rithmic" if rithmic_ok else ("nt" if nt_ok else None)

        if self._active_feed is None:
            if bookmap_ok:
                await self._switch_feed("bookmap", "bookmap_cold_start", now)
            elif rithmic_ok:
                await self._switch_feed("rithmic", "rithmic_cold_start", now)
            elif now - self._source_started_at >= self._settings.market_data_cold_start_grace_ms and nt_ok:
                await self._switch_feed("nt", "bookmap_cold_start_timeout", now)
            return

        if self._active_feed == "bookmap":
            if not bookmap_ok:
                await self._switch_feed(
                    best_non_bookmap,
                    "bookmap_stale",
                    now,
                )
            return

        if self._active_feed == "rithmic":
            held_ms = 0 if self._source_switched_at is None else now - self._source_switched_at
            stable_ms = 0 if bookmap.healthy_since is None else now - bookmap.healthy_since
            if (
                bookmap_ok
                and held_ms >= self._settings.market_data_min_hold_ms
                and stable_ms >= self._settings.bookmap_recover_ms
            ):
                await self._switch_feed("bookmap", "bookmap_recovered_from_rithmic", now)
            elif not rithmic_ok:
                await self._switch_feed(best_non_bookmap, "rithmic_stale", now)
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
            elif rithmic_ok and held_ms >= self._settings.market_data_min_hold_ms:
                await self._switch_feed("rithmic", "rithmic_promoted_from_nt", now)

    async def _switch_feed(
        self, source: str | None, reason: str, switched_at: int
    ) -> None:
        async with self._derived_source_lock:
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
            logger.warning(
                "market source switched %s -> %s reason=%s", old, source, reason
            )
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
            delta_snapshots = [
                update
                for tf in SUPPORTED_TFS
                for update in (
                    self._source_vds[source][tf].current_update(
                        self._chart_contract()
                    ),
                )
                if update is not None
            ]
            tdu_snapshots = self._source_tdu[source].current_updates(
                self._chart_contract(), self._symbol
            )
            footprint_snapshots: list[FootprintUpdate] = []
            footprint_engine = self._source_footprints.get(source)
            if footprint_engine is not None:
                footprint = footprint_engine.current_update(self._chart_contract())
                if footprint is not None:
                    footprint_snapshots.append(footprint)
            await asyncio.to_thread(
                self._persist_derived_batch,
                snapshots,
                delta_snapshots,
                [],
                [],
                footprint_snapshots,
                bool(footprint_snapshots),
                tdu_signal_updates=tdu_snapshots,
            )
            # Rebuild recursive state from the newly authoritative closed
            # logical-cache rows. Warmup never emits historical alerts.
            self._alerts.rewarm_supertrend()
            for update in snapshots:
                await self._enqueue(OutboundEvent.from_message(update))
            for update in delta_snapshots:
                await self._enqueue(OutboundEvent.from_message(update))
            for update in footprint_snapshots:
                await self._enqueue(OutboundEvent.from_message(update))
            for update in tdu_snapshots:
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
            if source in self._source_vds and deltas and deltas[-1].time == bar.time:
                delta = deltas[-1]
                self._source_vds[source][tf].seed_bar(
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
                signals = self._cache.read_tdu_signals(
                    self._symbol, chart_contract, tf, bar.time, bar.time, 1
                )
                signal = signals[-1] if signals else None
                self._source_tdu[source].seed_bar(
                    chart_contract,
                    tf,
                    time=bar.time,
                    open=bar.open,
                    high=bar.high,
                    low=bar.low,
                    close=bar.close,
                    delta=delta.delta,
                    momentum_direction=(
                        0 if signal is None else signal.momentum_direction
                    ),
                    momentum_level=0 if signal is None else signal.momentum_level,
                    delta_divergence=(
                        None if signal is None else signal.delta_divergence
                    ),
                )
            if source == "bookmap" and tf == FOOTPRINT_TIMEFRAME:
                levels = self._cache.read_footprint_levels(
                    self._symbol,
                    chart_contract,
                    bar.time,
                    FOOTPRINT_TIMEFRAME,
                )
                if levels:
                    self._source_footprints["bookmap"].seed_bar(
                        chart_contract,
                        symbol=self._symbol,
                        time=bar.time,
                        open=bar.open,
                        high=bar.high,
                        low=bar.low,
                        close=bar.close,
                        rows=[
                            (level.price, level.bid_volume, level.ask_volume)
                            for level in levels
                        ],
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
            if old is not None:
                # Never turn a futures-roll price gap into a direction alert.
                # A bucket begun before the handoff may contain mixed prices,
                # so state starts at the first bucket beginning afterward.
                self._alerts.reset_supertrend(warm_from=time_ms)

    def _reset_contract(self, contract: str) -> None:
        """Reset all per-contract engine + validator state (playback rewind).

        Clears the in-progress bar/order-flow/big-trade state and the sequence
        validator's per-Stream high-water marks for this contract so a rewound
        (earlier-timestamp) replay re-aggregates cleanly. (Playback only.)
        """
        chart_contract = self._chart_contract()
        self._bars.reset_contract(chart_contract)
        for engine in self._source_vds["nt"].values():
            engine.reset_contract(chart_contract)
        self._source_tdu["nt"].reset_contract(chart_contract)
        self._fvg.reset_contract(chart_contract)
        self._bt.reset_contract(chart_contract)
        self._breakout.reset_contract(chart_contract)
        # Playback can rewind to timestamps older than the indicator's last
        # confirmed bar. Clear its high-water mark so replayed closes advance
        # normally; unlike a futures roll, there is no forward cutoff.
        self._alerts.reset_supertrend()
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
