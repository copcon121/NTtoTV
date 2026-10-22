"""Rithmic-only FastAPI application factory.

Assembles REST and `/ws/chart`, then wires Ticker/History Plant ingestion to
the chart pipeline behind a lifespan-managed :class:`~app.runtime.AppRuntime`.

The runtime owns the shared Cache_Store, Tick_Store, Contract_Resolver,
WebSocket_Registry, and the :class:`~app.pipeline.Pipeline`; it starts the
registry's throttled flush + heartbeat loops on startup and closes the stores on
shutdown. Tests that exercise the REST surface in isolation may still inject
their own ``app.state.contract_state`` / ``app.state.tick_store`` before issuing
requests; the runtime is created lazily on first lifespan startup.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from . import __version__
from .analyst.routes import router as analyst_router
from .registry.endpoint import router as chart_router
from .rest.alerts import router as alerts_router
from .rest.auth import router as auth_router
from .rest.market_data import router as market_data_router
from .rest.market_explorer import router as market_explorer_router
from .rest.liquidity import router as liquidity_router
from .rest.errors import install_error_handlers
from .rest.notifications import router as notifications_router
from .rest.orderflow import router as orderflow_router
from .rest.profiles import router as profiles_router
from .rest.routes import router as rest_router
from .rest.rithmic_admin import router as rithmic_admin_router
from .rest.signals import router as signals_router
from .rest.smc_ai import router as smc_ai_router
from .rest.trend_analyzer import router as trend_analyzer_router
from .runtime import AppRuntime


@asynccontextmanager
async def _lifespan(app: FastAPI):
    """Build + start the runtime on startup; stop it on shutdown. (Req 20.1)

    Honors a pre-injected ``app.state.runtime`` (tests may supply their own).
    When the REST surface was given a standalone ``contract_state`` /
    ``tick_store`` (isolated REST tests), the runtime is not forced on top of
    them. Otherwise the runtime's resolver-backed contract state and Tick_Store
    become the shared instances the REST endpoints resolve.
    """
    runtime: AppRuntime | None = getattr(app.state, "runtime", None)
    own_runtime = False
    if runtime is None and getattr(app.state, "contract_state", None) is None:
        runtime = AppRuntime()
        app.state.runtime = runtime
        own_runtime = True
        # Share the runtime's stores with the REST surface so reads see writes.
        app.state.contract_state = runtime.contract_state
        app.state.tick_store = runtime.tick_store
        app.state.liquidity_store = runtime.liquidity_store
    if runtime is not None:
        await runtime.start()
    try:
        yield
    finally:
        if runtime is not None and own_runtime:
            await runtime.stop()


def create_app(*, lifespan: bool = True) -> FastAPI:
    """Create and configure the FastAPI application.

    ``lifespan`` may be disabled (``False``) for lightweight tests that only
    need the routes assembled without the runtime background loops.
    """
    app = FastAPI(
        title="GC Chart Platform Backend",
        version=__version__,
        summary="Local TradingView-like charting backend for GC futures.",
        lifespan=_lifespan if lifespan else None,
    )

    # Shared REST error envelope: all REST endpoints surface failures in one
    # consistent shape with status/code/field mapping (Req 18.12).
    install_error_handlers(app)

    app.include_router(rest_router)
    app.include_router(auth_router)
    app.include_router(rithmic_admin_router)
    app.include_router(alerts_router)
    app.include_router(notifications_router)
    app.include_router(market_data_router)
    app.include_router(market_explorer_router)
    app.include_router(trend_analyzer_router)
    app.include_router(liquidity_router)
    app.include_router(profiles_router)
    app.include_router(orderflow_router)
    app.include_router(smc_ai_router)
    app.include_router(signals_router)
    app.include_router(analyst_router)
    app.include_router(chart_router)

    return app


# Module-level ASGI app for `uvicorn app.app:app`.
app = create_app()
