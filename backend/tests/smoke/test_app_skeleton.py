"""Smoke tests for the backend scaffold (task 1.1).

Verify the FastAPI app skeleton imports, assembles, and exposes the expected
routes. These guard the project structure, not behavior.
"""

import pytest


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
    ):
        assert importlib.import_module(pkg) is not None
