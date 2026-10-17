"""Application runtime wiring (task 20.1).

Assembles the long-lived singletons that the live `/ws/nt` and `/ws/chart`
endpoints share: the Cache_Store, Tick_Store, Contract_Resolver,
WebSocket_Registry, the :class:`~app.pipeline.Pipeline`, and the
:class:`~app.ingest.control_plane.ControlPlaneCoordinator`. The runtime is
attached to ``app.state.runtime`` by the app factory's lifespan and started /
stopped with the app so the registry's throttled flush loop and heartbeat run
for the process lifetime.

Keeping this in one place lets the endpoints stay thin: the `/ws/nt` route
drives the :class:`~app.ingest.endpoint.IngestEndpoint` with the pipeline's
handlers and binds the control-plane ``send_control`` seam to the live socket;
the `/ws/chart` route registers a client on the registry and forwards
subscribe/unsubscribe/pong frames.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from .config import Settings
from .config import settings as default_settings
from .analyst.event_provider import LlmAnalystEventProvider, MockAnalystEventProvider
from .analyst.poi_scanner import PoiScanner
from .analyst.store import AnalystStore
from .engines.anchored_sync import AnchoredSyncEngine
from .engines.auto_mgann_trade import AutoMgannTradeEngine
from .engines.chart_limit_take_profit import ChartLimitTakeProfitEngine
from .engines.basis_engine import BasisEngine
from .engines.contract_resolver import ContractResolver
from .engines.fvg_signal_engine import FvgSignalEngine
from .engines.manual_supertrend_trailing import ManualSupertrendTrailingEngine
from .engines.reconciliation import ReconciliationEngine
from .ingest.control_plane import ControlPlaneCoordinator
from .pipeline import Pipeline
from .registry.registry import OutboundEvent, WebSocketRegistry
from .rest.contract_state import ContractStateStore
from .storage.cache_store import CacheStore
from .storage.liquidity_store import LiquidityStore
from .storage.tick_store import TickStore
from .mt5.manager import Mt5Manager

logger = logging.getLogger(__name__)

__all__ = ["AppRuntime"]


class AppRuntime:
    """Owns the shared singletons and the registry background loops. (Req 20.1)"""

    def __init__(
        self,
        *,
        settings: Settings | None = None,
        cache: CacheStore | None = None,
        tick_store: TickStore | None = None,
        liquidity_store: LiquidityStore | None = None,
        resolver: ContractResolver | None = None,
        registry: WebSocketRegistry | None = None,
        mt5_manager: Mt5Manager | None = None,
        basis_engine: BasisEngine | None = None,
    ) -> None:
        s = settings or default_settings
        self._settings = s
        self._symbol = s.supported_symbols[0]
        self._cache = cache or CacheStore.open(s)
        self._tick_store = tick_store or TickStore(s.ticks_dir)
        self._liquidity_store = liquidity_store or LiquidityStore(s.liquidity_db_path)
        self._resolver = resolver or ContractResolver(
            list(s.gc_candidate_contracts),
            window_ms=s.resolver_window_ms,
            trade_weight=s.resolver_trade_weight,
            quote_weight=s.resolver_quote_weight,
        )
        self._registry = registry or WebSocketRegistry(
            min_interval_ms=s.ui_throttle_min_ms,
            max_interval_ms=s.ui_throttle_max_ms,
            send_timeout_s=s.chart_send_timeout_s,
        )
        self._mt5_manager = mt5_manager or Mt5Manager(settings=s)
        self._basis_engine = basis_engine or BasisEngine(settings=s)
        # Contract-state accessor shared with the REST API, resolver-backed so
        # the live Active_Contract is authoritative.
        self._contract_state = ContractStateStore(
            self._cache, settings=s, resolver=self._resolver
        )
        if resolver is None and s.gc_candidate_contracts:
            self._contract_state.set_active(self._symbol, s.gc_candidate_contracts[-1])
        self._analyst_store: AnalystStore | None = (
            AnalystStore(s.analyst_db_path) if s.analyst_enabled else None
        )
        self._poi_scanner: PoiScanner | None = None
        if self._analyst_store is not None:
            self._poi_scanner = PoiScanner(
                cache=self._cache,
                store=self._analyst_store,
                provider=MockAnalystEventProvider(),
                real_provider=LlmAnalystEventProvider.from_settings(s),
                provider_mode=s.analyst_event_provider,
                symbol=self._symbol,
                contract=self._symbol,
                tick_size=s.analyst_tick_size,
                cooldown_seconds=s.analyst_event_cooldown_s,
                queue_size=s.analyst_scanner_queue_size,
                m1_internal_enabled=s.analyst_m1_internal_enabled,
            )
        self._native_fvg = FvgSignalEngine()
        self._native_fvg_seeded: set[tuple[str, str]] = set()
        self._auto_mgann_trade = AutoMgannTradeEngine(
            self._cache,
            self._mt5_manager,
            self._basis_engine,
            self._registry,
            settings=s,
        )
        self._chart_limit_take_profit = ChartLimitTakeProfitEngine(
            self._cache,
            self._mt5_manager,
            self._registry,
        )
        self._manual_supertrend_trailing = ManualSupertrendTrailingEngine(
            self._cache,
            self._mt5_manager,
            self._registry,
        )
        # The pipeline; control plane is bound per /ws/nt connection so its
        # send_control targets the live socket.
        self._pipeline = Pipeline(
            registry=self._registry,
            cache=self._cache,
            tick_store=self._tick_store,
            liquidity_store=self._liquidity_store,
            resolver=self._resolver,
            settings=s,
            symbol=self._symbol,
            native_fvg_signal=self._native_fvg,
            native_fvg_seeded=self._native_fvg_seeded,
            basis_engine=self._basis_engine,
            analyst_event_sink=(
                None if self._poi_scanner is None else self._poi_scanner.enqueue_latest
            ),
            auto_trade_closed_bar_sink=self._on_auto_mgann_closed_bar,
            auto_trade_price_sink=self._on_auto_mgann_price,
            manual_trailing_closed_bar_sink=self._on_manual_supertrend_closed_bar,
            enable_tick_fvg_signal=False,
        )
        self._flush_task: asyncio.Task[None] | None = None
        self._heartbeat_task: asyncio.Task[None] | None = None
        self._retention_task: asyncio.Task[None] | None = None
        self._market_source_task: asyncio.Task[None] | None = None
        self._anchored_sync = AnchoredSyncEngine(
            self._cache, self._mt5_manager, self._basis_engine
        )
        self._reconciliation = ReconciliationEngine(
            self._cache, self._mt5_manager, self._registry
        )
        self._anchored_sync_task: asyncio.Task[None] | None = None
        self._reconciliation_task: asyncio.Task[None] | None = None

    # -- accessors -------------------------------------------------------------

    @property
    def registry(self) -> WebSocketRegistry:
        return self._registry

    @property
    def settings(self) -> Settings:
        return self._settings

    @property
    def pipeline(self) -> Pipeline:
        return self._pipeline

    @property
    def native_fvg(self) -> FvgSignalEngine:
        return self._native_fvg

    @property
    def native_fvg_seeded(self) -> set[tuple[str, str]]:
        return self._native_fvg_seeded

    @property
    def contract_state(self) -> ContractStateStore:
        return self._contract_state

    @property
    def tick_store(self) -> TickStore:
        return self._tick_store

    @property
    def cache(self) -> CacheStore:
        return self._cache

    @property
    def liquidity_store(self) -> LiquidityStore:
        return self._liquidity_store

    @property
    def mt5_manager(self) -> Mt5Manager:
        return self._mt5_manager

    @property
    def basis_engine(self) -> BasisEngine:
        return self._basis_engine

    @property
    def anchored_sync(self) -> AnchoredSyncEngine:
        return self._anchored_sync

    @property
    def reconciliation(self) -> ReconciliationEngine:
        return self._reconciliation

    @property
    def auto_mgann_trade(self) -> AutoMgannTradeEngine:
        return self._auto_mgann_trade

    @property
    def chart_limit_take_profit(self) -> ChartLimitTakeProfitEngine:
        return self._chart_limit_take_profit

    @property
    def manual_supertrend_trailing(self) -> ManualSupertrendTrailingEngine:
        return self._manual_supertrend_trailing

    @property
    def analyst_store(self) -> AnalystStore | None:
        return self._analyst_store

    @property
    def poi_scanner(self) -> PoiScanner | None:
        return self._poi_scanner

    @property
    def analyst_auto_send_available(self) -> bool:
        return False

    @property
    def analyst_auto_send_enabled(self) -> bool:
        return False

    @property
    def analyst_auto_send_running(self) -> bool:
        return False

    async def set_analyst_auto_send_enabled(self, enabled: bool) -> None:
        return

    @property
    def symbol(self) -> str:
        return self._symbol

    def make_control_plane(self, send_control) -> ControlPlaneCoordinator:
        """Build a control-plane coordinator bound to a live ``send_control``.

        The status broadcast seam enqueues onto the registry so Active_Contract
        changes reach `/ws/chart` clients. (Req 4.6, 20.1)
        """
        return ControlPlaneCoordinator(
            send_control,
            broadcast_status=self._enqueue_status,
        )

    def _enqueue_status(self, event) -> None:
        """Wrap a ChartStatusEvent as an OutboundEvent and enqueue it."""
        self._registry.enqueue(OutboundEvent.from_message(event, symbol=self._symbol))

    # -- lifecycle -------------------------------------------------------------

    async def start(self) -> None:
        """Start the registry's flush + heartbeat background loops."""
        await asyncio.to_thread(self._auto_mgann_trade.seed, symbol=self._symbol)
        if self._flush_task is None:
            self._flush_task = asyncio.create_task(self._registry.flush_loop())
        if self._heartbeat_task is None:
            self._heartbeat_task = asyncio.create_task(self._registry.heartbeat_loop())
        if self._retention_task is None:
            self._retention_task = asyncio.create_task(self._retention_loop())
        if self._market_source_task is None:
            self._market_source_task = asyncio.create_task(self._market_source_loop())
        if self._anchored_sync_task is None:
            self._anchored_sync_task = asyncio.create_task(self._anchored_sync_loop())
        if self._reconciliation_task is None:
            self._reconciliation_task = asyncio.create_task(self._reconciliation_loop())
        if self._poi_scanner is not None:
            self._poi_scanner.start()

    async def stop(self) -> None:
        """Cancel the background loops and close the stores."""
        for task in (
            self._flush_task,
            self._heartbeat_task,
            self._retention_task,
            self._market_source_task,
            self._anchored_sync_task,
            self._reconciliation_task,
        ):
            if task is not None:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        self._flush_task = None
        self._heartbeat_task = None
        self._retention_task = None
        self._market_source_task = None
        self._anchored_sync_task = None
        self._reconciliation_task = None
        if self._poi_scanner is not None:
            await self._poi_scanner.stop()
        self._mt5_manager.close()
        try:
            self._tick_store.close()
        finally:
            try:
                self._liquidity_store.close()
            finally:
                try:
                    self._cache.close()
                finally:
                    if self._analyst_store is not None:
                        self._analyst_store.close()

    async def _anchored_sync_loop(self) -> None:
        while True:
            try:
                await asyncio.to_thread(self._anchored_sync.run_once)
            except Exception as exc:
                logger.warning("anchored sync failed: %s", exc)
            await asyncio.sleep(2.0)

    async def _on_auto_mgann_closed_bar(self, bar, volume_delta: int | None) -> None:
        await asyncio.to_thread(
            self._auto_mgann_trade.on_closed_bar,
            bar,
            volume_delta,
        )

    async def _on_auto_mgann_price(self, price: float, at: int) -> None:
        if not self._auto_mgann_trade.should_scan_open_order_management(at):
            return
        await asyncio.to_thread(self._chart_limit_take_profit.take_profit_at_1r, price)
        await asyncio.to_thread(self._auto_mgann_trade.take_profit_half_at_1r, price)
        await asyncio.to_thread(self._auto_mgann_trade.cancel_unfilled_limits_at_1r, price)

    async def _on_manual_supertrend_closed_bar(self, timeframe: str, bar) -> None:
        await asyncio.to_thread(
            self._manual_supertrend_trailing.on_closed_bar,
            timeframe,
            bar,
        )

    async def _reconciliation_loop(self) -> None:
        while True:
            try:
                await asyncio.to_thread(self._reconciliation.run_once)
            except Exception as exc:
                logger.warning("order reconciliation failed: %s", exc)
            await asyncio.sleep(2.0)

    async def _retention_loop(self) -> None:
        """Keep raw ticks and compact liquidity data within retention."""
        while True:
            try:
                await self._purge_expired_ticks()
                await self._purge_expired_liquidity()
            except Exception as exc:
                logger.warning("market-data retention purge failed: %s", exc)
            await asyncio.sleep(60 * 60)

    async def _market_source_loop(self) -> None:
        while True:
            try:
                await self._pipeline.maintenance_tick()
            except Exception as exc:
                logger.warning("market source maintenance failed: %s", exc)
            await asyncio.sleep(0.05)

    async def _purge_expired_ticks(self) -> None:
        removed = await asyncio.to_thread(
            self._tick_store.purge_expired,
            datetime.now(timezone.utc),
            self._settings.tick_retention_days,
        )
        if removed:
            logger.info("purged %s expired raw tick shards", len(removed))

    async def _purge_expired_liquidity(self) -> None:
        cutoff = int(datetime.now(timezone.utc).timestamp() * 1000) - (
            self._settings.liquidity_retention_hours * 60 * 60 * 1000
        )
        events, lines = await asyncio.to_thread(
            self._liquidity_store.purge_before, cutoff
        )
        if events or lines:
            logger.info(
                "purged liquidity rows events=%s lines=%s", events, lines
            )
