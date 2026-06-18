"""Smoke tests for the backend scaffold (task 1.1).

Verify the FastAPI app skeleton imports, assembles, and exposes the expected
routes. These guard the project structure, not behavior.
"""

import pytest
import asyncio


@pytest.mark.smoke
def test_app_imports_and_assembles():
    from app.app import app, create_app

    assert app is not None
    # Factory produces an independent, working app instance.
    assert create_app() is not None


@pytest.mark.smoke
def test_expected_routes_registered():
    from app.app import create_app

    app = create_app()
    paths = {getattr(r, "path", None) for r in app.routes}

    assert "/api/health" in paths
    assert "/api/analyst/latest" in paths
    assert "/api/analyst/poi-events" in paths
    assert "/api/analyst/poi-state" in paths
    assert "/ws/nt" in paths
    assert "/ws/chart" in paths


@pytest.mark.smoke
def test_package_layout_importable():
    # All design-mandated packages import cleanly.
    import importlib

    for pkg in (
        "app.ingest",
        "app.storage",
        "app.engines",
        "app.registry",
        "app.rest",
        "app.models",
        "app.analyst",
    ):
        assert importlib.import_module(pkg) is not None


@pytest.mark.smoke
def test_analyst_scanner_disabled_by_default(tmp_path):
    from app.config import Settings
    from app.runtime import AppRuntime

    runtime = AppRuntime(settings=Settings(data_dir=tmp_path))
    try:
        assert runtime.analyst_store is None
        assert runtime.poi_scanner is None
    finally:
        asyncio.run(runtime.stop())


@pytest.mark.smoke
def test_analyst_enabled_starts_poi_scanner_not_auto_scheduler(tmp_path):
    from app.config import Settings
    from app.runtime import AppRuntime

    async def exercise() -> None:
        runtime = AppRuntime(
            settings=Settings(
                data_dir=tmp_path,
                analyst_enabled=True,
                openai_api_key="",
            )
        )
        try:
            await runtime.start()
            assert runtime.poi_scanner is not None
            assert runtime.poi_scanner.running is True
            assert runtime.analyst_auto_send_available is False
            assert runtime.analyst_auto_send_enabled is False
            assert runtime.analyst_auto_send_running is False
        finally:
            await runtime.stop()

    asyncio.run(exercise())
