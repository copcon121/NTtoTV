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
  persisted to the Cache_Store and enqueued on the registry (Req 9.3, 20.1);
* every accepted trade/quote is observed by the
  :class:`~app.engines.contract_resolver.ContractResolver`, whose needed-set /
  Active_Contract changes drive Control_Commands and Active_Contract status
  broadcasts via the :class:`~app.ingest.control_plane.ControlPlaneCoordinator`
  (Req 4.6, 20.1);
* the :class:`~app.engines.alert_engine.AlertEngine` is evaluated server-side
  against last-trade-price crossings, closed-bar closes, per-bar volume delta,
  footprint stacked-imbalance, and reconstructed big trades, emitting
  ``alert_event``s (Req 16, 17);
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
from typing import Awaitable, Callable

from .engines.bar_aggregator import SUPPORTED_TFS, BarAggregator
from .engines.basis_engine import BasisEngine
from .engines.big_trade_engine import BigTradeEngine
from .engines.contract_resolver import ContractResolver
from .engines.footprint_engine import FOOTPRINT_TIMEFRAME, FootprintEngine
from .engines.session_calendar import is_gc_session_open
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
    NTStatusEvent,
    QuoteUpdate,
    VolumeDeltaUpdate,
)
from .registry.registry import OutboundEvent, WebSocketRegistry
from .rest.notifications import send_telegram_alert_from_event
from .storage.cache_store import CacheStore
from .storage.records import (
    BarRecord,
    BigTradeRecord,
    FootprintBarRecord,
    FootprintLevelRecord,
    VolumeDeltaRecord,
)
from .storage.tick_store import TickStore

logger = logging.getLogger(__name__)

__all__ = ["Pipeline"]

# The bar timeframe whose closed bars drive the close-based alerts and whose
# OHLCV the footprint/volume-delta alerts pair against. v1 uses 1m (the
# footprint timeframe) so all per-bar order-flow alerts share a clock.
_ALERT_BAR_TF = FOOTPRINT_TIMEFRAME
_SOURCE_SWITCH_QUIET_MS = 15_000


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
    )


def _bar_update_for_contract(update: BarUpdate, contract: str) -> BarUpdate:
    return BarUpdate(
        symbol=update.symbol,
        contract=contract,
        tf=update.tf,
        bar=update.bar,
        closed=update.closed,
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


def _footprint_update_for_contract(
    update: FootprintUpdate, contract: str
) -> FootprintUpdate:
    return FootprintUpdate(
        symbol=update.symbol,
        contract=contract,
        tf=update.tf,
        time=update.time,
        rows=update.rows,
        poc=update.poc,
        bar_delta=update.bar_delta,
        buy_pct=update.buy_pct,
        sell_pct=update.sell_pct,
        stacked_imbalance=update.stacked_imbalance,
        unfinished_auction=update.unfinished_auction,
        open=update.open,
        high=update.high,
        low=update.low,
        close=update.close,
        poc_volume=update.poc_volume,
        vah=update.vah,
        val=update.val,
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
        symbol: str = "GC",
        bar_aggregator: BarAggregator | None = None,
        volume_delta: VolumeDeltaEngine | None = None,
        footprint: FootprintEngine | None = None,
        big_trade: BigTradeEngine | None = None,
        alert_engine: AlertEngine | None = None,
        basis_engine: BasisEngine | None = None,
        send_alert_text: AlertTextSender | None = None,
        analyst_event_sink: AnalystEventSink | None = None,
        control_plane: ControlPlaneCoordinator | None = None,
        validator: SequenceValidator | None = None,
    ) -> None:
        self._registry = registry
        self._cache = cache
        self._tick_store = tick_store
        self._resolver = resolver
        self._symbol = symbol
        self._bars = bar_aggregator or BarAggregator()
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
        self._fp = footprint or FootprintEngine()
        self._bt = big_trade or BigTradeEngine(dedupe_repeated_timestamp_runs=True)
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
        self._hydrate_engine_state_from_cache()

    # -- wiring seams ----------------------------------------------------------

    def handlers(self) -> IngestHandlers:
        """The :class:`IngestHandlers` bundle for the `/ws/nt` endpoint."""
        return IngestHandlers(
            on_trade=self.on_trade,
            on_quote=self.on_quote,
            on_status=self.on_status,
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
        # Backfill the trade's bid/ask from the prevailing quote when NT did not
        # attach a same-print snapshot. VolumeDelta can then classify against
        # the book before its tick-rule fallback, while Footprint mirrors
        # MzFootprintClone's BidAsk mode against the same book snapshot.
        # Recorded ticks then also carry bid/ask for future rebuilds. (Req 13.2,
        # 13.3)
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
        if self._basis is not None:
            self._basis.update_gc(trade.price, trade.time)

        await self._run_trade_engines(_trade_for_contract(trade, chart_contract))

    async def on_quote(self, quote: NormalizedQuote) -> None:
        """Validate, record, observe resolver activity, and stream the quote."""
        decision = await self._coordinator.on_quote(quote)
        if not decision.accepted:
            return

        # Track the prevailing best bid/ask per contract so trades can be
        # classified against the book even though NT trade prints carry no
        # same-print bid/ask. (Req 13.2, 13.3)
        self._last_quote[quote.contract] = (quote.bid, quote.ask)
        if self._basis is not None:
            self._basis.update_gc((quote.bid + quote.ask) / 2, quote.time)

        if quote.contract != self._chart_source_contract:
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
        event = ChartStatusEvent(
            state=status.state,
            time=status.time,
            reason=getattr(status, "reason", None),
            contract=getattr(status, "contract", None),
        )
        await self._emit_status(event)

    # -- engine fan-out --------------------------------------------------------

    async def _run_trade_engines(self, trade: NormalizedTrade) -> None:
        if not is_gc_session_open(trade.time):
            return

        # 1) OHLCV bars across all timeframes. (Req 9.3)
        alert_ctx_bar: BarUpdate | None = None
        bar_updates = self._bars.on_trade(trade)
        for update in bar_updates:
            if update.closed and update.tf == _ALERT_BAR_TF:
                alert_ctx_bar = update

        # 2) VolumeDelta across all timeframes so the lower delta-candle series
        # follows the charted timeframe (Req 13). The alert context pairs with
        # the 1m bar close, so capture that timeframe's update for alerts.
        vd_update: VolumeDeltaUpdate | None = None
        vd_updates: list[VolumeDeltaUpdate] = []
        for tf, engine in self._vds.items():
            update = engine.on_trade(trade)
            if update is None:
                continue
            vd_updates.append(update)
            if tf == _ALERT_BAR_TF:
                vd_update = update

        # 3) Footprint (M1). (Req 14)
        fp_update = self._fp.on_trade(trade)

        # 4) BigTrade (merge + filter). (Req 15)
        big_trades = self._bt.on_trade(trade)

        footprint_updates = [
            update for update in (fp_update,) if update is not None
        ]

        # Persist the full derived snapshot in one transaction. A busy trade
        # updates every timeframe plus the M1 footprint ladder; committing each
        # row separately starves the asyncio loop that flushes UI WebSockets.
        await asyncio.to_thread(
            self._persist_derived_batch,
            bar_updates,
            vd_updates,
            footprint_updates,
            big_trades,
        )
        if self._analyst_event_sink is not None:
            try:
                self._analyst_event_sink()
            except Exception as exc:
                logger.warning("analyst event enqueue failed: %s", exc)

        for update in bar_updates:
            await self._enqueue(OutboundEvent.from_message(update))
        for update in vd_updates:
            await self._enqueue(OutboundEvent.from_message(update))
        for update in footprint_updates:
            await self._enqueue(OutboundEvent.from_message(update))
        for bt in big_trades:
            await self._enqueue(OutboundEvent.from_message(bt))

        # 5) Alerts: last-trade-price crossings + per-bar / big-trade conditions.
        await self._evaluate_alerts(
            trade, closed_bar=alert_ctx_bar, vd_update=vd_update,
            fp_update=fp_update, big_trades=big_trades,
        )

    async def _evaluate_alerts(
        self,
        trade: NormalizedTrade,
        *,
        closed_bar: BarUpdate | None,
        vd_update: VolumeDeltaUpdate | None,
        fp_update: FootprintUpdate | None,
        big_trades: list[BigTrade],
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

        # Closed-bar conditions (bar_closes_*, volume_delta_threshold,
        # stacked_imbalance) keyed to the 1m bar close. (Req 16.7)
        if closed_bar is not None:
            bar = closed_bar.bar
            stacked = (
                len(fp_update.stacked_imbalance) > 0 if fp_update is not None else None
            )
            bar_ctx = MarketContext(
                symbol=trade.symbol,
                contract=trade.contract,
                time=trade.time,
                bar_closed=True,
                bar_time=bar.time,
                bar_open=bar.open,
                bar_high=bar.high,
                bar_low=bar.low,
                bar_close=bar.close,
                bar_volume=bar.volume,
                bar_volume_delta=vd_update.delta if vd_update is not None else None,
                bar_stacked_imbalance=stacked,
            )
            await self._emit_alerts(self._alerts.evaluate(bar_ctx))

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

    # -- persistence -----------------------------------------------------------

    def _persist_derived_batch(
        self,
        bar_updates: list[BarUpdate],
        volume_delta_updates: list[VolumeDeltaUpdate],
        footprint_updates: list[FootprintUpdate],
        big_trades: list[BigTrade],
    ) -> None:
        footprint_bars: list[FootprintBarRecord] = []
        footprint_levels: list[FootprintLevelRecord] = []
        for footprint_update in footprint_updates:
            footprint_bars.append(FootprintBarRecord(
                symbol=footprint_update.symbol,
                contract=footprint_update.contract,
                timeframe=footprint_update.tf,
                time=footprint_update.time,
                poc=footprint_update.poc,
                open_price=footprint_update.open,
                high_price=footprint_update.high,
                low_price=footprint_update.low,
                close_price=footprint_update.close,
                poc_volume=footprint_update.poc_volume,
                vah=footprint_update.vah,
                val=footprint_update.val,
                bar_delta=footprint_update.bar_delta,
                buy_pct=footprint_update.buy_pct,
                sell_pct=footprint_update.sell_pct,
                unfinished_high=footprint_update.unfinished_auction.high,
                unfinished_low=footprint_update.unfinished_auction.low,
            ))
            footprint_levels.extend(
                FootprintLevelRecord(
                    symbol=footprint_update.symbol,
                    contract=footprint_update.contract,
                    timeframe=footprint_update.tf,
                    time=footprint_update.time,
                    price=row.price,
                    bid_volume=row.bid,
                    ask_volume=row.ask,
                    imbalance=row.imbalance,
                )
                for row in footprint_update.rows
            )

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
            big_trades=(
                BigTradeRecord(
                    symbol=bt.symbol,
                    contract=bt.contract,
                    time=bt.time,
                    price=bt.price,
                    volume=bt.volume,
                    side=bt.side,
                    trade_id=bt.trade_id,
                )
                for bt in big_trades
            )
        )

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

            self._bars.seed_bar(
                chart_contract,
                tf,
                time=bar.time,
                open=bar.open,
                high=bar.high,
                low=bar.low,
                close=bar.close,
                volume=bar.volume,
            )

            deltas = self._cache.read_volume_delta(
                self._symbol,
                chart_contract,
                tf,
                limit=1,
            )
            if deltas and deltas[-1].time == bar.time:
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
        self._fp.reset_contract(chart_contract)
        self._bt.reset_contract(chart_contract)
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
            if self._registry.client_count == 0:
                await self._send_alert_text_safely(ev)
            await self._enqueue(OutboundEvent.from_message(ev))

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
