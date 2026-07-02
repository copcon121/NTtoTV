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
from .engines.basis_engine import BasisEngine
from .engines.contract_resolver import ContractResolver
from .engines.fvg_signal_engine import FvgSignalEngine
from .engines.reconciliation import ReconciliationEngine
from .ingest.control_plane import ControlPlaneCoordinator
from .pipeline import Pipeline
from .registry.registry import OutboundEvent, WebSocketRegistry
from .rest.contract_state import ContractStateStore
from .storage.cache_store import CacheStore
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
        # The pipeline; control plane is bound per /ws/nt connection so its
        # send_control targets the live socket.
        self._pipeline = Pipeline(
            registry=self._registry,
            cache=self._cache,
            tick_store=self._tick_store,
            resolver=self._resolver,
            symbol=self._symbol,
            native_fvg_signal=self._native_fvg,
            basis_engine=self._basis_engine,
            analyst_event_sink=(
                None if self._poi_scanner is None else self._poi_scanner.enqueue_latest
            ),
            enable_tick_fvg_signal=False,
        )
        self._flush_task: asyncio.Task[None] | None = None
        self._heartbeat_task: asyncio.Task[None] | None = None
        self._retention_task: asyncio.Task[None] | None = None
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
        if self._flush_task is None:
            self._flush_task = asyncio.create_task(self._registry.flush_loop())
        if self._heartbeat_task is None:
            self._heartbeat_task = asyncio.create_task(self._registry.heartbeat_loop())
        if self._retention_task is None:
            self._retention_task = asyncio.create_task(self._retention_loop())
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
        self._anchored_sync_task = None
        self._reconciliation_task = None
        if self._poi_scanner is not None:
            await self._poi_scanner.stop()
        self._mt5_manager.close()
        try:
            self._tick_store.close()
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

    async def _reconciliation_loop(self) -> None:
        while True:
            try:
                await asyncio.to_thread(self._reconciliation.run_once)
            except Exception as exc:
                logger.warning("order reconciliation failed: %s", exc)
            await asyncio.sleep(2.0)

    async def _retention_loop(self) -> None:
        """Keep raw tick shards within the configured calendar-day retention."""
        while True:
            try:
                await self._purge_expired_ticks()
            except Exception as exc:
                logger.warning("raw tick retention purge failed: %s", exc)
            await asyncio.sleep(60 * 60)

    async def _purge_expired_ticks(self) -> None:
        removed = await asyncio.to_thread(
            self._tick_store.purge_expired,
            datetime.now(timezone.utc),
            self._settings.tick_retention_days,
        )
        if removed:
            logger.info("purged %s expired raw tick shards", len(removed))
