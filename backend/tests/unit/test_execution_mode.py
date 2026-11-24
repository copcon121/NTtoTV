"""Unit tests for execution mode resolution and app route wiring.

Verifies:
- Default mode is exness (no Windows URL auto mode).
- Explicit 'windows' mode fails closed (disabled; no relay fallback).
- Stale NTTOTV_WINDOWS_EXECUTION_URL does not enable windows mode.
- App route /api/execution returns exness or disabled envelope accordingly.
"""

from __future__ import annotations

import os
import pytest
from starlette.testclient import TestClient

from app.app import create_app
from app.execution import execution_mode


def test_default_execution_mode_is_exness(monkeypatch):
    monkeypatch.delenv("NTTOTV_EXECUTION_MODE", raising=False)
    monkeypatch.delenv("NTTOTV_WINDOWS_EXECUTION_URL", raising=False)
    assert execution_mode() == "exness"


def test_stale_windows_url_does_not_enable_windows_mode(monkeypatch):
    monkeypatch.delenv("NTTOTV_EXECUTION_MODE", raising=False)
    monkeypatch.setenv("NTTOTV_WINDOWS_EXECUTION_URL", "http://127.0.0.1:18080")
    assert execution_mode() == "exness"


def test_explicit_windows_mode_fails_closed(monkeypatch):
    monkeypatch.setenv("NTTOTV_EXECUTION_MODE", "windows")
    monkeypatch.delenv("NTTOTV_WINDOWS_EXECUTION_URL", raising=False)
    assert execution_mode() == "disabled"

    # Even with Windows URL set, explicit windows must fail closed
    monkeypatch.setenv("NTTOTV_WINDOWS_EXECUTION_URL", "http://127.0.0.1:18080")
    assert execution_mode() == "disabled"


def test_explicit_windows_case_insensitive(monkeypatch):
    monkeypatch.setenv("NTTOTV_EXECUTION_MODE", "  WINDOWS  ")
    assert execution_mode() == "disabled"


def test_disabled_execution_mode(monkeypatch):
    monkeypatch.setenv("NTTOTV_EXECUTION_MODE", "disabled")
    assert execution_mode() == "disabled"


def test_exness_execution_mode(monkeypatch):
    monkeypatch.setenv("NTTOTV_EXECUTION_MODE", "exness")
    assert execution_mode() == "exness"


def test_invalid_execution_mode_raises(monkeypatch):
    monkeypatch.setenv("NTTOTV_EXECUTION_MODE", "unsupported_mode")
    with pytest.raises(ValueError, match="NTTOTV_EXECUTION_MODE must be exness or disabled"):
        execution_mode()


def test_app_execution_route_when_disabled(monkeypatch):
    monkeypatch.setenv("NTTOTV_EXECUTION_MODE", "disabled")
    app = create_app(lifespan=False)
    client = TestClient(app)
    resp = client.get("/api/execution")
    assert resp.status_code == 200
    data = resp.json()
    assert data == {"enabled": False, "mode": "disabled", "profiles": []}


def test_app_execution_route_when_windows_fails_closed(monkeypatch):
    monkeypatch.setenv("NTTOTV_EXECUTION_MODE", "windows")
    app = create_app(lifespan=False)
    client = TestClient(app)
    resp = client.get("/api/execution")
    assert resp.status_code == 200
    data = resp.json()
    assert data == {"enabled": False, "mode": "disabled", "profiles": []}


def test_app_execution_route_when_exness(monkeypatch):
    monkeypatch.setenv("NTTOTV_EXECUTION_MODE", "exness")
    app = create_app(lifespan=False)
    client = TestClient(app)
    resp = client.get("/api/execution")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("enabled") is True
    assert data.get("mode") == "exness"
