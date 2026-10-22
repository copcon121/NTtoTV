"""Rithmic-only ingest -> engines -> cache -> chart WebSocket pipeline.

Ticker Plant events are validated and raw-recorded before they update the
logical ``GC`` chart cache. History Plant owns closed-bar repair. There is no
runtime arbitration or fallback to a second market-data source.
"""

from __future__ import annotations

import asyncio
import inspect
import logging
from collections import defaultdict, deque
from dataclasses import dataclass, field, replace
from typing import Awaitable, Callable

from .config import Settings, settings as default_settings
from .engines.bar_aggregator import SUPPORTED_TFS, BarAggregator
from .engines.basis_engine import BasisEngine
from .engines.direct_feed_big_trade_engine import DirectFeedBigTradeEngine
from .engines.breakout_box_engine import BreakoutBoxEngine, BreakoutBoxEvent
from .engines.contract_resolver import ContractResolver
from .engines.depth_liquidity import DepthLiquidityEvent, DepthLiquidityTracker
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
from .ingest.coordinator import QUOTE_CHANNEL, TRADE_CHANNEL, IngestionCoordinator
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
HistorySyncRequester = Callable[[], None]


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
        breakout_box: BreakoutBoxEngine | None = None,
        alert_engine: AlertEngine | None = None,
        basis_engine: BasisEngine | None = None,
        send_alert_text: AlertTextSender | None = None,
        analyst_event_sink: AnalystEventSink | None = None,
        auto_trade_closed_bar_sink: AutoTradeClosedBarSink | None = None,
        auto_trade_price_sink: AutoTradePriceSink | None = None,
        manual_trailing_closed_bar_sink: ManualTrailingClosedBarSink | None = None,
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
        self._history_sync_requester: HistorySyncRequester | None = None
        self._bars = bar_aggregator or BarAggregator()
        self._source_bars: dict[str, BarAggregator] = {
            "rithmic": self._bars,
        }
        # One VolumeDelta engine per supported timeframe so the lower
        # delta-candle series follows the charted timeframe (Req 13). The
        # Bar_Aggregator already fans out across all timeframes; mirror that here
        # so a REST read / live update exists for every ``tf`` the UI can select.
        # An injected engine (tests/replay) seeds its own timeframe; the rest are
        # constructed with matching mode/min-trade-size so behavior is uniform.
        seed = volume_delta
        self._source_vds: dict[str, dict[str, VolumeDeltaEngine]] = {
            "rithmic": {},
        }
        for source, engines in self._source_vds.items():
            for tf in SUPPORTED_TFS:
                if seed is not None and seed.timeframe == tf:
                    engines[tf] = seed
                else:
                    engines[tf] = VolumeDeltaEngine(
                        timeframe=tf,
                        mode=seed.mode if seed is not None else VolumeDeltaMode.DELTA,
                        min_trade_size=seed.min_trade_size if seed is not None else 0,
                        zero_baseline=True,
                    )
        self._vds = self._source_vds["rithmic"]
        self._source_footprints = {
            "rithmic": FootprintEngine(),
        }
        self._source_tdu = {
            "rithmic": TduSignalEngine(),
        }
        self._fvg = fvg_signal or FvgSignalEngine()
        self._native_fvg_signal = native_fvg_signal
        self._native_fvg_seeded = (
            native_fvg_seeded if native_fvg_seeded is not None else set()
        )
        self._enable_tick_fvg_signal = enable_tick_fvg_signal
        self._source_big_trades: dict[str, DirectFeedBigTradeEngine] = {
            "rithmic": DirectFeedBigTradeEngine(),
        }
        self._breakout = breakout_box or BreakoutBoxEngine()
        self._alerts = alert_engine or AlertEngine(cache)
        self._market_explorer = MarketVolumeStopEngine(
            load_market_explorer_settings(cache),
            tick_size=0.1,
        )
        self._trend_analyzer = trend_analyzer or TrendAnalyzerEngine(tick_size=0.1)
        liquidity_settings = load_liquidity_settings(cache)
        self._liquidity_settings = dict(liquidity_settings)
        self._long_term_liquidity_touch = LongTermLiquidityTouchEngine(
            tick_size=0.1,
            min_age_ms=int(liquidity_settings["longTermMinAgeSeconds"]) * 1_000,
        )
        self._rithmic_liquidity = DepthLiquidityTracker(
            liquidity_settings,
            tick_size=0.1,
            source_prefix="rithmic",
        )
        self._source_liquidity_lines: dict[str, dict[str, LiquidityUpdate]] = {
            "rithmic": {},
        }
        self._basis = basis_engine
        self._send_alert_text = (
            send_alert_text
            if send_alert_text is not None
            else self._send_telegram_alert_text
        )
        self._analyst_event_sink = analyst_event_sink

        # Ingestion coordinator: validation + raw-tick recording (before
        # throttling) + degraded-status seam wired to the registry. (Req 4.4, 4.5)
        self._rithmic_coordinator = IngestionCoordinator(
            tick_store,
            validator or SequenceValidator(),
            emit_degraded=self._emit_status,
        )
        self._chart_source_contract: str | None = self._settings.rithmic_contract
        self._chart_source_last_trade_ms: int | None = None
        if self._chart_source_contract is not None:
            self._pin_resolver_source(self._chart_source_contract)
        self._preferred_source = "rithmic"
        started = now_ms()
        self._source_started_at = started
        self._active_feed: str | None = None
        self._source_switched_at: int | None = None
        self._source_switch_reason: str | None = "startup"
        self._history_sync_status: dict = {
            "state": (
                "connecting"
                if self._settings.rithmic_enabled
                and self._settings.rithmic_history_enabled
                else "stopped"
            ),
            "connected": False,
            "pendingRanges": [],
        }
        self._feed_states = {
            "rithmic": _FeedState(
                details={"shadow": False, "selectable": True}
            ),
        }
        self._source_snapshots: dict[str, dict[str, list[BarUpdate]]] = {
            "rithmic": {},
        }
        self._derived_source_lock = asyncio.Lock()
        self._last_market_status_emit = 0
        self._last_footprint_flush = 0
        self._last_rithmic_liquidity_snapshot = 0
        self._hydrate_engine_state_from_cache()

    # -- wiring seams ----------------------------------------------------------

    @property
    def coordinator(self) -> IngestionCoordinator:
        return self._rithmic_coordinator

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
        self._liquidity_settings = dict(settings)
        self._long_term_liquidity_touch.set_min_age_ms(
            int(settings["longTermMinAgeSeconds"]) * 1_000
        )
        self._rithmic_liquidity.configure(settings, now_ms())

    def reconfigure_rithmic(self, settings: Settings) -> None:
        """Apply an admin-saved connector config before starting new sessions."""

        self._settings = settings
        self._chart_source_contract = settings.rithmic_contract
        self._chart_source_last_trade_ms = None
        self._pin_resolver_source(settings.rithmic_contract)
        chart_contract = self._chart_contract()
        self._source_bars["rithmic"].reset_contract(chart_contract)
        for engine in self._source_vds["rithmic"].values():
            engine.reset_contract(chart_contract)
        self._source_footprints["rithmic"].reset_contract(chart_contract)
        self._source_tdu["rithmic"].reset_contract(chart_contract)
        self._source_big_trades["rithmic"].reset_pending()
        self._source_snapshots["rithmic"].clear()
        self._rithmic_liquidity.reset()
        self._source_liquidity_lines["rithmic"].clear()
        state = self._feed_states["rithmic"]
        state.contract = settings.rithmic_contract
        state.orderflow_gap_pending = False
        state.details = {"shadow": False, "selectable": True}
        self._history_sync_status = {
            "state": "connecting" if settings.rithmic_history_enabled else "stopped",
            "connected": False,
            "pendingRanges": [],
        }

    # -- ingest handlers -------------------------------------------------------

    async def on_rithmic_connect(self, details: dict) -> None:
        """Start a fresh authoritative Ticker Plant generation."""

        state = self._feed_states["rithmic"]
        state.last_heartbeat_at = None
        state.last_event_at = None
        state.healthy_since = None
        state.connected = True
        state.bar_ready = False
        state.orderflow_gap_pending = False
        state.details = {
            **details,
            "shadow": False,
            "selectable": True,
        }
        state.contract = str(details.get("contract") or "") or None
        self._rithmic_coordinator = IngestionCoordinator(
            self._tick_store,
            SequenceValidator(),
            emit_degraded=self._emit_status,
        )
        self._rithmic_liquidity.reset()
        self._source_liquidity_lines["rithmic"].clear()
        self._note_feed_heartbeat("rithmic", now_ms())

    async def on_rithmic_disconnect(self, reason: str | None = None) -> None:
        state = self._feed_states["rithmic"]
        state.connected = False
        state.healthy_since = None
        state.bar_ready = False
        if reason:
            state.details["lastError"] = reason
        if self._active_feed == "rithmic":
            await self._publish_long_term_liquidity_touches(
                self._long_term_liquidity_touch.flush_all()
            )
        if self._history_sync_requester is not None:
            self._history_sync_requester()
        await self._evaluate_source_selection(now_ms())

    def bind_history_sync_requester(
        self, requester: HistorySyncRequester | None
    ) -> None:
        """Request a History Plant audit after transport discontinuities."""

        self._history_sync_requester = requester

    async def on_rithmic_history_status(self, status: dict) -> None:
        """Attach History Plant state to diagnostics and readiness."""

        prior_watermark = self._history_sync_status.get("highWatermark")
        self._history_sync_status = dict(status)
        if (
            status.get("state") == "synced"
            and status.get("highWatermark") != prior_watermark
            and self._native_fvg_signal is not None
        ):
            chart_contract = self._chart_contract()
            self._native_fvg_signal.reset_contract(chart_contract)
            self._native_fvg_seeded.discard((self._symbol, chart_contract))
            recovered = self._seed_shared_fvg_engine(
                symbol=self._symbol,
                contract=chart_contract,
                before_time_ms=int(status.get("highWatermark") or now_ms()) + 60_000,
            )
            if recovered:
                await asyncio.to_thread(
                    self._persist_derived_batch, [], [], recovered, []
                )
                for update in recovered:
                    await self._enqueue(OutboundEvent.from_message(update))
        await self._enqueue(
            OutboundEvent.from_message(self.market_data_status_message())
        )

    async def on_rithmic_health(self, details: dict) -> None:
        state = self._feed_states["rithmic"]
        state.details.update(details)
        state.details["shadow"] = False
        state.details["selectable"] = True
        state.contract = str(details.get("contract") or state.contract or "") or None
        subscriptions = details.get("subscriptions") or {}
        state.bar_ready = bool(subscriptions.get("l1", False))
        if bool(details.get("mboSynchronized", False)):
            state.orderflow_gap_pending = False
        self._note_feed_heartbeat("rithmic", now_ms())

    async def on_rithmic_depth(
        self,
        details: dict,
        *,
        sequence_gap: bool = False,
        book_update: dict | None = None,
    ) -> None:
        state = self._feed_states["rithmic"]
        state.details.update(details)
        state.details["shadow"] = False
        state.details["selectable"] = True
        self._note_feed_heartbeat("rithmic", now_ms())
        if sequence_gap:
            state.sequence_gaps += 1
            state.orderflow_gap_pending = True
            if self._history_sync_requester is not None:
                self._history_sync_requester()
        elif bool(details.get("mboSynchronized", False)):
            state.orderflow_gap_pending = False
        if book_update is not None:
            event_time = int(book_update.get("time") or now_ms())
            events = self._rithmic_liquidity.on_book_delta(book_update, event_time)
            await self._publish_rithmic_liquidity(events)

    async def on_rithmic_trade(self, trade: NormalizedTrade) -> None:
        """Record and process the authoritative Rithmic trade stream."""

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
            if self._history_sync_requester is not None:
                self._history_sync_requester()
        state.contract = trade.contract
        self._note_feed_event("rithmic", trade.time, trade.bridge_time, received)
        if trade.contract != self._active_contract():
            return
        self._market_explorer.on_trade(trade)
        await self._publish_trend_analyzer(self._trend_analyzer.on_trade(trade))
        if self._active_feed == "rithmic":
            await self._publish_long_term_liquidity_touches(
                self._long_term_liquidity_touch.on_trade(trade)
            )
        await self._run_trade_engines(
            _trade_for_contract(trade, self._chart_contract()), source="rithmic"
        )

    async def on_rithmic_quote(self, quote: NormalizedQuote) -> None:
        """Record the authoritative direct BBO stream."""

        received = now_ms()
        quote.source = "rithmic"
        quote.received_at = received
        decision = await self._rithmic_coordinator.on_quote(quote)
        if not decision.accepted:
            return
        state = self._feed_states["rithmic"]
        if decision.outcome is SeqOutcome.GAP:
            state.sequence_gaps += 1
            if self._history_sync_requester is not None:
                self._history_sync_requester()
        state.contract = quote.contract
        self._note_feed_event("rithmic", quote.time, quote.bridge_time, received)
        if quote.contract != self._active_contract() or self._active_feed != "rithmic":
            return
        if self._basis is not None:
            self._basis.update_gc((quote.bid + quote.ask) / 2, quote.time)
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

    async def _publish_rithmic_liquidity(
        self, events: list[DepthLiquidityEvent]
    ) -> None:
        for event in events:
            update = LiquidityUpdate(
                symbol=self._symbol,
                contract=self._chart_contract(),
                source_contract=self._active_contract(),
                sequence=event.sequence,
                time=event.time,
                event_kind=event.event_kind,
                action=event.action,
                side=event.side,
                price=event.price,
                size=event.size,
                previous_size=event.previous_size,
                change=event.change,
                threshold=event.threshold,
                dom_distance=event.dom_distance,
                strength=event.strength,
                line_id=event.line_id,
                line_start_time=event.line_start_time,
                snapshot=event.snapshot,
            )
            await self._publish_liquidity_update("rithmic", update)

    async def _publish_liquidity_update(
        self,
        source: str,
        update: LiquidityUpdate,
        *,
        allow_unselected: bool = False,
    ) -> None:
        lines = self._source_liquidity_lines[source]
        if update.event_kind == "long_term" and update.line_id:
            if update.action == "end":
                lines.pop(update.line_id, None)
            else:
                lines[update.line_id] = update
        if self._active_feed != source and not allow_unselected:
            return
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

    def _grade_direct_feed_fvg(
        self,
        bar_update: BarUpdate,
        footprint_update: FootprintUpdate | None,
        *,
        snapshot: bool,
    ) -> list[FvgSignalUpdate]:
        """Grade one authoritative closed direct-feed M1 footprint bar."""
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
        recent finalized bars restores engine state and repairs signal gaps.
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
                "FVG grader recovered %s direct-feed signals after %s",
                len(catchup_updates),
                persist_after,
            )
        return catchup_updates

    # -- engine fan-out --------------------------------------------------------

    async def _run_trade_engines(self, trade: NormalizedTrade, *, source: str) -> None:
        if not is_gc_session_open(trade.time):
            return

        # Rithmic is the only writer of shared chart keys.
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
        closed_1m: BarUpdate | None = None
        footprint_engine = self._source_footprints.get(source)
        if footprint_engine is not None:
            # The footprint engine only retains the current forming bar; once a
            # trade opens a new minute the previous bar's ladder is dropped.
            # Snapshot the closing bar before on_trade() rolls the bucket so it
            # can be persisted to the delta-profile cache below. This keeps the
            # session-daily histogram current between History Plant audits.
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

        # The shared grader confirms from authoritative direct-feed footprint
        # bars and uses Rithmic trades for provisional source-bar color.
        raw_fvg_updates: list[FvgSignalUpdate] = []
        fvg_updates = raw_fvg_updates if self._enable_tick_fvg_signal else []
        native_fvg_preview_updates: list[FvgSignalUpdate] = []
        if (
            source == "rithmic"
            and self._active_feed == "rithmic"
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
                if (
                    source == "rithmic"
                    and closed_1m is not None
                    and closed_footprint is not None
                ):
                    fvg_updates.extend(
                        self._grade_direct_feed_fvg(
                            closed_1m,
                            closed_footprint,
                            snapshot=False,
                        )
                    )
                for update in bar_updates:
                    if update.closed:
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
                fp_persist = [] if closed_footprint is None else [closed_footprint]
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

        # A disconnected feed can never publish shared chart keys.
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

    async def maintenance_tick(self) -> None:
        now = now_ms()
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

        # Refresh unchanged lines every 30 seconds so they remain attached to
        # the live edge of /lq.
        if (
            self._active_feed == "rithmic"
            and now - self._last_rithmic_liquidity_snapshot >= 30_000
        ):
            self._last_rithmic_liquidity_snapshot = now
            await self._publish_rithmic_liquidity(
                self._rithmic_liquidity.snapshots(now)
            )

        # Group exchange prints by aggressor order id and flush an idle final
        # group so it is not stranded during a quiet market.
        source = "rithmic"
        engine = self._source_big_trades[source]
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
        footprint_source = "rithmic" if self._active_feed == "rithmic" else None
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
                "rithmic": self._feed_status_dict(
                    "rithmic", self._feed_states["rithmic"], now
                )
            },
            history_sync=dict(self._history_sync_status),
            roll_pending=self._feed_states["rithmic"].details.get("rollPending"),
        )

    def market_data_status_dict(self) -> dict:
        return self.market_data_status_message().to_dict()

    def is_ready(self) -> bool:
        """Return whether the single Rithmic source can serve production."""

        now = now_ms()
        state = self._feed_states["rithmic"]
        subscriptions = state.details.get("subscriptions") or {}
        return (
            self._active_feed == "rithmic"
            and self._feed_eligible("rithmic", now)
            and not state.orderflow_gap_pending
            and all(bool(subscriptions.get(mode)) for mode in ("l1", "l2", "mbo"))
            and bool(state.details.get("mboSynchronized"))
            and self._history_sync_status.get("state") == "synced"
            and not self._history_sync_status.get("pendingRanges")
        )

    @property
    def derived_source_lock(self) -> asyncio.Lock:
        """Serialize active-source writes with source-switch resynchronization."""
        return self._derived_source_lock

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
        if source != "rithmic":
            return False
        state = self._feed_states[source]
        if not state.connected or state.last_heartbeat_at is None:
            return False
        if now - state.last_heartbeat_at > self._settings.rithmic_stale_ms:
            return False
        healthy_ms = 0 if state.healthy_since is None else now - state.healthy_since
        return (
            state.contract == self._active_contract()
            and state.bar_ready
            and healthy_ms >= self._settings.rithmic_qualify_ms
        )

    async def _evaluate_source_selection(self, now: int) -> None:
        rithmic_ok = self._feed_eligible("rithmic", now)
        if rithmic_ok:
            if self._active_feed != "rithmic":
                await self._switch_feed("rithmic", "rithmic_ready", now)
        elif self._active_feed is not None:
            await self._switch_feed(None, "rithmic_unavailable", now)

    async def _switch_feed(
        self, source: str | None, reason: str, switched_at: int
    ) -> None:
        async with self._derived_source_lock:
            old = self._active_feed
            if old == source:
                return
            if old in self._source_liquidity_lines:
                await self._end_liquidity_source(old, switched_at)
            self._active_feed = source
            self._source_switched_at = switched_at
            self._source_switch_reason = reason
            self._long_term_liquidity_touch.reset()
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
            engine.reset_pending()
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
            await self._activate_liquidity_source(source, switched_at)

    async def _end_liquidity_source(self, source: str, at: int) -> None:
        lines = list(self._source_liquidity_lines[source].values())
        for line in lines:
            ended = replace(
                line,
                time=int(at),
                action="end",
                previous_size=line.size,
                change=0,
                snapshot=False,
            )
            await self._publish_liquidity_update(source, ended)

    async def _activate_liquidity_source(self, source: str, at: int) -> None:
        if source == "rithmic":
            await self._publish_rithmic_liquidity(
                self._rithmic_liquidity.snapshots(at)
            )
            self._last_rithmic_liquidity_snapshot = int(at)

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

            source = "rithmic"
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
            if tf == FOOTPRINT_TIMEFRAME:
                levels = self._cache.read_footprint_levels(
                    self._symbol,
                    chart_contract,
                    bar.time,
                    FOOTPRINT_TIMEFRAME,
                )
                if levels:
                    self._source_footprints["rithmic"].seed_bar(
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

    def _reset_contract(self, contract: str) -> None:
        """Reset all live state for a physical-contract rollover."""
        chart_contract = self._chart_contract()
        self._bars.reset_contract(chart_contract)
        for engine in self._source_vds["rithmic"].values():
            engine.reset_contract(chart_contract)
        self._source_tdu["rithmic"].reset_contract(chart_contract)
        self._source_footprints["rithmic"].reset_contract(chart_contract)
        self._source_big_trades["rithmic"].reset_pending()
        self._fvg.reset_contract(chart_contract)
        self._breakout.reset_contract(chart_contract)
        self._alerts.reset_supertrend()
        validator = self._rithmic_coordinator.validator
        for channel in (TRADE_CHANNEL, QUOTE_CHANNEL):
            validator.reset_stream(StreamId(self._symbol, contract, channel))
        logger.info("pipeline: reset Rithmic contract state for %s", contract)

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
