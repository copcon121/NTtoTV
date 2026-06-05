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

from .config import Settings
from .config import settings as default_settings
from .engines.contract_resolver import ContractResolver
from .ingest.control_plane import ControlPlaneCoordinator
from .pipeline import Pipeline
from .registry.registry import OutboundEvent, WebSocketRegistry
from .rest.contract_state import ContractStateStore
from .storage.cache_store import CacheStore
from .storage.tick_store import TickStore

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
        # Contract-state accessor shared with the REST API, resolver-backed so
        # the live Active_Contract is authoritative.
        self._contract_state = ContractStateStore(
            self._cache, settings=s, resolver=self._resolver
        )
        # The pipeline; control plane is bound per /ws/nt connection so its
        # send_control targets the live socket.
        self._pipeline = Pipeline(
            registry=self._registry,
            cache=self._cache,
            tick_store=self._tick_store,
            resolver=self._resolver,
            symbol=self._symbol,
        )
        self._flush_task: asyncio.Task[None] | None = None
        self._heartbeat_task: asyncio.Task[None] | None = None

    # -- accessors -------------------------------------------------------------

    @property
    def registry(self) -> WebSocketRegistry:
        return self._registry

    @property
    def pipeline(self) -> Pipeline:
        return self._pipeline

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

    async def stop(self) -> None:
        """Cancel the background loops and close the stores."""
        for task in (self._flush_task, self._heartbeat_task):
            if task is not None:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        self._flush_task = None
        self._heartbeat_task = None
        try:
            self._tick_store.close()
        finally:
            self._cache.close()
