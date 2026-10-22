"""Rithmic-only application runtime wiring.

Assembles the long-lived Ticker/History clients, stores, chart registry and
the :class:`~app.pipeline.Pipeline`. The runtime is
attached to ``app.state.runtime`` by the app factory's lifespan and started /
stopped with the app so the registry's throttled flush loop and heartbeat run
for the process lifetime.

Keeping this in one place lets `/ws/chart` register a client and forward
subscribe/unsubscribe/pong frames.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import replace
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
from .pipeline import Pipeline
from .rithmic.history import RithmicHistoryService
from .rithmic.service import RithmicMarketDataService
from .rithmic.admin_config import (
    RithmicAdminConfig,
    RithmicAdminConfigStore,
)
from .rithmic.client import RithmicDirectClient, RithmicLogin, RithmicProbeError
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
        base_settings = settings or default_settings
        self._base_settings = base_settings
        self._rithmic_admin_store = RithmicAdminConfigStore(base_settings)
        try:
            admin_config = self._rithmic_admin_store.load()
            s = (
                admin_config.to_settings(base_settings)
                if self._rithmic_admin_store.stored
                else base_settings
            )
        except Exception as exc:
            logger.error("Ignoring invalid saved Rithmic config: %s", exc)
            s = base_settings
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
        self._mt5_manager: Mt5Manager | None = None
        self._basis_engine: BasisEngine | None = None
        if s.trading_enabled:
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
        self._auto_mgann_trade: AutoMgannTradeEngine | None = None
        self._chart_limit_take_profit: ChartLimitTakeProfitEngine | None = None
        self._manual_supertrend_trailing: ManualSupertrendTrailingEngine | None = None
        if self._mt5_manager is not None and self._basis_engine is not None:
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
        # The sole live pipeline is fed directly by Rithmic services.
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
            auto_trade_closed_bar_sink=(
                self._on_auto_mgann_closed_bar
                if self._auto_mgann_trade is not None
                else None
            ),
            auto_trade_price_sink=(
                self._on_auto_mgann_price
                if self._auto_mgann_trade is not None
                else None
            ),
            manual_trailing_closed_bar_sink=(
                self._on_manual_supertrend_closed_bar
                if self._manual_supertrend_trailing is not None
                else None
            ),
            enable_tick_fvg_signal=False,
        )
        self._rithmic_service: RithmicMarketDataService | None = None
        self._rithmic_history_service: RithmicHistoryService | None = None
        self._rithmic_admin_lock = asyncio.Lock()
        self._started = False
        if s.rithmic_enabled:
            self._rithmic_service = RithmicMarketDataService.from_settings(
                s, self._pipeline
            )
            if s.rithmic_history_enabled:
                self._rithmic_history_service = RithmicHistoryService.from_settings(
                    s, self._cache, self._pipeline
                )
                self._pipeline.bind_history_sync_requester(
                    self._rithmic_history_service.request_sync
                )
        self._flush_task: asyncio.Task[None] | None = None
        self._heartbeat_task: asyncio.Task[None] | None = None
        self._retention_task: asyncio.Task[None] | None = None
        self._market_source_task: asyncio.Task[None] | None = None
        self._anchored_sync: AnchoredSyncEngine | None = None
        self._reconciliation: ReconciliationEngine | None = None
        if self._mt5_manager is not None and self._basis_engine is not None:
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
    def rithmic_service(self) -> RithmicMarketDataService | None:
        return self._rithmic_service

    @property
    def rithmic_history_service(self) -> RithmicHistoryService | None:
        return self._rithmic_history_service

    def rithmic_admin_snapshot(self) -> dict:
        config = self._rithmic_admin_store.load()
        return {
            "config": config.to_public_dict(stored=self._rithmic_admin_store.stored),
            "runtime": {
                "marketServiceRunning": bool(
                    self._rithmic_service is not None and self._rithmic_service.running
                ),
                "historyServiceRunning": bool(
                    self._rithmic_history_service is not None
                    and self._rithmic_history_service.running
                ),
                "marketData": self._pipeline.market_data_status_dict(),
            },
        }

    def save_rithmic_admin_config(self, body: dict) -> dict:
        current = self._rithmic_admin_store.load()
        config = self._rithmic_admin_store.parse(body, current=current)
        self._rithmic_admin_store.save(config)
        return config.to_public_dict(stored=True)

    async def test_rithmic_admin_config(self, body: dict) -> dict:
        current = self._rithmic_admin_store.load()
        config = self._rithmic_admin_store.parse(body, current=current)
        self._rithmic_admin_store.require_connectable(config)
        client = RithmicDirectClient(
            uri=config.websocket_uri,
            archive_path=self._settings.rithmic_archive_path,
            timeout_seconds=self._settings.rithmic_connect_timeout_s,
        )
        login = RithmicLogin(
            user=config.user,
            password=config.password,
            system_name=config.system_name,
            app_name=config.app_name,
            app_version=config.app_version,
            template_version=config.template_version,
            user_message=config.user_message,
            aggregated_quotes=config.aggregated_quotes,
            mac_addresses=config.mac_addresses,
            os_version=config.os_version,
            os_platform=config.os_platform,
        )
        try:
            result = await client.probe_plant_logins(login)
        except RithmicProbeError as exc:
            response = {"ok": False, "error": str(exc)}
            if exc.result is not None:
                response["result"] = exc.result
            return response
        return {"ok": True, "result": result}

    async def connect_rithmic_from_admin(self) -> dict:
        async with self._rithmic_admin_lock:
            config = self._rithmic_admin_store.load()
            self._rithmic_admin_store.require_connectable(config)
            config = replace(config, auto_connect=True)
            self._rithmic_admin_store.save(config)
            settings = config.to_settings(self._base_settings, enabled=True)
            await self._replace_rithmic_services(settings)
            connection = await self._wait_for_rithmic_admin_connection(settings)
            return {**self.rithmic_admin_snapshot(), "connection": connection}

    async def _wait_for_rithmic_admin_connection(self, settings: Settings) -> dict:
        """Wait for an observable login result instead of only task startup."""

        timeout_seconds = max(3.0, min(30.0, settings.rithmic_connect_timeout_s + 3.0))
        deadline = asyncio.get_running_loop().time() + timeout_seconds
        while True:
            status = self._pipeline.market_data_status_dict()
            sources = status.get("sources") or {}
            ticker = sources.get("rithmic") or {}
            history = status.get("historySync") or {}
            ticker_connected = bool(ticker.get("connected"))
            history_connected = bool(history.get("connected"))
            ticker_error = str(ticker.get("lastError") or "")
            history_error = str(history.get("lastError") or "")

            if ticker_connected and (
                not settings.rithmic_history_enabled or history_connected
            ):
                return self._rithmic_connection_result(
                    ok=True,
                    state="ready" if self._pipeline.is_ready() else "connected",
                    message=(
                        "Ticker Plant connected; History Plant connected"
                        if settings.rithmic_history_enabled
                        else "Ticker Plant connected; History Plant disabled"
                    ),
                    ticker=ticker,
                    history=history,
                    history_enabled=settings.rithmic_history_enabled,
                )

            if ticker_error or history_error:
                if ticker_error and history_error:
                    message = f"Ticker Plant: {ticker_error}; History Plant: {history_error}"
                elif ticker_error:
                    message = f"Ticker Plant: {ticker_error}"
                else:
                    message = f"History Plant: {history_error}"
                return self._rithmic_connection_result(
                    ok=False,
                    state="partial" if ticker_connected or history_connected else "failed",
                    message=message,
                    ticker=ticker,
                    history=history,
                    history_enabled=settings.rithmic_history_enabled,
                )

            market_running = bool(
                self._rithmic_service is not None and self._rithmic_service.running
            )
            history_running = bool(
                self._rithmic_history_service is not None
                and self._rithmic_history_service.running
            )
            if not market_running or (
                settings.rithmic_history_enabled and not history_running
            ):
                return self._rithmic_connection_result(
                    ok=False,
                    state="failed",
                    message="Rithmic connector stopped before login was confirmed",
                    ticker=ticker,
                    history=history,
                    history_enabled=settings.rithmic_history_enabled,
                )

            if asyncio.get_running_loop().time() >= deadline:
                return self._rithmic_connection_result(
                    ok=False,
                    state="pending",
                    message=(
                        f"No successful Rithmic login was confirmed within "
                        f"{timeout_seconds:.0f} seconds"
                    ),
                    ticker=ticker,
                    history=history,
                    history_enabled=settings.rithmic_history_enabled,
                )
            await asyncio.sleep(0.2)

    def _rithmic_connection_result(
        self,
        *,
        ok: bool,
        state: str,
        message: str,
        ticker: dict,
        history: dict,
        history_enabled: bool,
    ) -> dict:
        return {
            "ok": ok,
            "state": state,
            "message": message,
            "ready": self._pipeline.is_ready(),
            "tickerPlant": {
                "connected": bool(ticker.get("connected")),
                "error": ticker.get("lastError"),
            },
            "historyPlant": {
                "enabled": history_enabled,
                "connected": bool(history.get("connected")),
                "state": history.get("state"),
                "error": history.get("lastError"),
            },
        }

    async def disconnect_rithmic_from_admin(self) -> dict:
        async with self._rithmic_admin_lock:
            config = replace(self._rithmic_admin_store.load(), auto_connect=False)
            self._rithmic_admin_store.save(config)
            await self._stop_rithmic_services("disconnected by admin")
            self._settings = config.to_settings(self._base_settings, enabled=False)
            return self.rithmic_admin_snapshot()

    async def _replace_rithmic_services(self, settings: Settings) -> None:
        await self._stop_rithmic_services("reconfigured by admin")
        self._settings = settings
        self._pipeline.reconfigure_rithmic(settings)
        self._rithmic_service = RithmicMarketDataService.from_settings(
            settings, self._pipeline
        )
        self._rithmic_history_service = None
        if settings.rithmic_history_enabled:
            self._rithmic_history_service = RithmicHistoryService.from_settings(
                settings, self._cache, self._pipeline
            )
            self._pipeline.bind_history_sync_requester(
                self._rithmic_history_service.request_sync
            )
        else:
            self._pipeline.bind_history_sync_requester(None)
        if self._started:
            await self._rithmic_service.start()
            if self._rithmic_history_service is not None:
                await self._rithmic_history_service.start()

    async def _stop_rithmic_services(self, reason: str) -> None:
        history = self._rithmic_history_service
        market = self._rithmic_service
        self._rithmic_history_service = None
        self._rithmic_service = None
        self._pipeline.bind_history_sync_requester(None)
        if history is not None:
            await history.stop()
        if market is not None:
            await market.stop()
        await self._pipeline.on_rithmic_disconnect(reason)

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
        if self._mt5_manager is None:
            raise RuntimeError("MT5 runtime is disabled")
        return self._mt5_manager

    @property
    def basis_engine(self) -> BasisEngine:
        if self._basis_engine is None:
            raise RuntimeError("trading runtime is disabled")
        return self._basis_engine

    @property
    def anchored_sync(self) -> AnchoredSyncEngine:
        if self._anchored_sync is None:
            raise RuntimeError("trading runtime is disabled")
        return self._anchored_sync

    @property
    def reconciliation(self) -> ReconciliationEngine:
        if self._reconciliation is None:
            raise RuntimeError("trading runtime is disabled")
        return self._reconciliation

    @property
    def auto_mgann_trade(self) -> AutoMgannTradeEngine:
        if self._auto_mgann_trade is None:
            raise RuntimeError("trading runtime is disabled")
        return self._auto_mgann_trade

    @property
    def chart_limit_take_profit(self) -> ChartLimitTakeProfitEngine:
        if self._chart_limit_take_profit is None:
            raise RuntimeError("trading runtime is disabled")
        return self._chart_limit_take_profit

    @property
    def manual_supertrend_trailing(self) -> ManualSupertrendTrailingEngine:
        if self._manual_supertrend_trailing is None:
            raise RuntimeError("trading runtime is disabled")
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

    def _enqueue_status(self, event) -> None:
        """Wrap a ChartStatusEvent as an OutboundEvent and enqueue it."""
        self._registry.enqueue(OutboundEvent.from_message(event, symbol=self._symbol))

    # -- lifecycle -------------------------------------------------------------

    async def start(self) -> None:
        """Start the registry's flush + heartbeat background loops."""
        self._started = True
        if self._auto_mgann_trade is not None:
            await asyncio.to_thread(self._auto_mgann_trade.seed, symbol=self._symbol)
        await asyncio.to_thread(self._seed_trend_analyzer)
        if self._flush_task is None:
            self._flush_task = asyncio.create_task(self._registry.flush_loop())
        if self._heartbeat_task is None:
            self._heartbeat_task = asyncio.create_task(self._registry.heartbeat_loop())
        if self._retention_task is None:
            self._retention_task = asyncio.create_task(self._retention_loop())
        if self._market_source_task is None:
            self._market_source_task = asyncio.create_task(self._market_source_loop())
        if self._anchored_sync is not None and self._anchored_sync_task is None:
            self._anchored_sync_task = asyncio.create_task(self._anchored_sync_loop())
        if self._reconciliation is not None and self._reconciliation_task is None:
            self._reconciliation_task = asyncio.create_task(self._reconciliation_loop())
        if self._poi_scanner is not None:
            self._poi_scanner.start()
        if self._rithmic_service is not None:
            await self._rithmic_service.start()
        if self._rithmic_history_service is not None:
            await self._rithmic_history_service.start()

    async def stop(self) -> None:
        """Cancel the background loops and close the stores."""
        self._started = False
        if self._rithmic_history_service is not None:
            await self._rithmic_history_service.stop()
        if self._rithmic_service is not None:
            await self._rithmic_service.stop()
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
        if self._mt5_manager is not None:
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
                if self._anchored_sync is not None:
                    await asyncio.to_thread(self._anchored_sync.run_once)
            except Exception as exc:
                logger.warning("anchored sync failed: %s", exc)
            await asyncio.sleep(2.0)

    def _seed_trend_analyzer(self) -> None:
        """Warm the TTW state machine and its 24-hour chart history from raw ticks."""

        end = int(datetime.now(timezone.utc).timestamp() * 1_000)
        # The visible history is 24h.  Add the reference 15 x 5m smoothing
        # warm-up plus a small bucket-alignment margin before that window.
        start = end - (24 * 60 + 90) * 60 * 1_000
        contract = self._contract_state.active_contract(self._symbol)
        engine = self._pipeline.trend_analyzer
        try:
            engine.seed_seconds(
                self._tick_store.read_second_ohlc(
                    contract,
                    start,
                    end,
                    source="rithmic",
                ),
                through_time=end,
                source_contract=contract,
            )
            history = engine.history(end - 24 * 60 * 60 * 1_000, end)
            logger.info(
                "seeded TrendAnalyzer contract=%s points=%s markers=%s",
                contract,
                len(history["points"]),
                len(history["markers"]),
            )
        except Exception as exc:
            # Live Rithmic trades can warm the engine if retained raw data is
            # absent or an older SQLite build cannot execute the seed query.
            logger.warning("TrendAnalyzer seed failed for %s: %s", contract, exc)

    async def _on_auto_mgann_closed_bar(self, bar, volume_delta: int | None) -> None:
        if self._auto_mgann_trade is None:
            return
        await asyncio.to_thread(
            self._auto_mgann_trade.on_closed_bar,
            bar,
            volume_delta,
        )

    async def _on_auto_mgann_price(self, price: float, at: int) -> None:
        if self._auto_mgann_trade is None:
            return
        if not self._auto_mgann_trade.should_scan_open_order_management(at):
            return
        if self._chart_limit_take_profit is not None:
            await asyncio.to_thread(self._chart_limit_take_profit.take_profit_at_1r, price)
        await asyncio.to_thread(self._auto_mgann_trade.take_profit_half_at_1r, price)
        await asyncio.to_thread(self._auto_mgann_trade.cancel_unfilled_limits_at_1r, price)

    async def _on_manual_supertrend_closed_bar(self, timeframe: str, bar) -> None:
        if self._manual_supertrend_trailing is None:
            return
        await asyncio.to_thread(
            self._manual_supertrend_trailing.on_closed_bar,
            timeframe,
            bar,
        )

    async def _reconciliation_loop(self) -> None:
        while True:
            try:
                if self._reconciliation is not None:
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
