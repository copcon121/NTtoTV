from __future__ import annotations

import sqlite3
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.app import create_app
from app.config import Settings
from app.engines.basis_engine import BasisEngine
from app.engines.alert_engine import Alert, AlertEngine
from app.engines.smc_fail_break import SMC_FAIL_BREAK_RETEST
from app.rest import auth as auth_routes
from app.rest.profiles import (
    MGANN_BREAK_SETTINGS_VERSION,
    _default_mgann_break_settings,
)
from app.rest.contract_state import ContractStateStore
from app.storage.cache_store import CacheStore


@pytest.fixture()
def app_client(tmp_path, monkeypatch: pytest.MonkeyPatch):
    settings = Settings(data_dir=tmp_path, invite_code=None)
    monkeypatch.setattr(auth_routes, "default_settings", settings)
    cache = CacheStore(tmp_path / "app.sqlite")
    app = create_app(lifespan=False)
    app.state.contract_state = ContractStateStore(cache, settings=settings)
    app.state.basis_engine = BasisEngine(settings=settings)
    try:
        with TestClient(app) as client:
            yield client
    finally:
        cache.close()


@pytest.mark.integration
def test_register_creates_session_and_duplicate_conflicts(app_client: TestClient):
    registered = app_client.post(
        "/api/auth/register", json={"username": "alice", "password": "secret"}
    )
    assert registered.status_code == 200
    assert registered.json()["user"]["username"] == "alice"

    me = app_client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["user"]["username"] == "alice"

    duplicate = app_client.post(
        "/api/auth/register", json={"username": "ALICE", "password": "secret"}
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "CONFLICT"

    assert app_client.post("/api/auth/logout").status_code == 200
    login = app_client.post(
        "/api/auth/login", json={"username": "alice", "password": "secret"}
    )
    assert login.status_code == 200


@pytest.mark.integration
def test_saved_smc_length_refreshes_dependent_fail_break_alert(app_client: TestClient):
    assert app_client.post("/api/auth/register", json={"username": "smc-test", "password": "secret"}).status_code == 200
    saved = app_client.put("/api/me/profile", json={"payload": {"smc": {"swingLength": 20}}})
    assert saved.status_code == 200
    profile_id = saved.json()["profile"]["id"]
    cache = app_client.app.state.contract_state.cache
    engine = AlertEngine(cache)
    app_client.app.state.runtime = SimpleNamespace(pipeline=SimpleNamespace(alert_engine=engine))
    engine.upsert(Alert(id="follow-profile", profile_id=profile_id, symbol="GC", type=SMC_FAIL_BREAK_RETEST,
                        params={"swingLength": 50, "repeat": True}))
    assert engine._fail_break_state["follow-profile"].params["swingLength"] == 20
    changed = app_client.put("/api/me/profile", json={"payload": {"smc": {"swingLength": 35}}})
    assert changed.status_code == 200
    assert engine._fail_break_state["follow-profile"].params["swingLength"] == 35
    assert cache.read_alert_events("follow-profile") == []


@pytest.mark.integration
def test_session_cookie_uses_configured_ttl(
    app_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(
        auth_routes,
        "default_settings",
        Settings(auth_session_ttl_days=7, invite_code=None),
    )

    registered = app_client.post(
        "/api/auth/register", json={"username": "alice", "password": "secret"}
    )

    assert registered.status_code == 200
    assert "Max-Age=604800" in registered.headers["set-cookie"]


@pytest.mark.integration
def test_auth_rejection_logs_cookie_presence_without_credentials(app_client: TestClient, caplog):
    with caplog.at_level("WARNING", logger="app.rest.auth"):
        assert app_client.put("/api/me/profile", json={"payload": {}}).status_code == 401
        assert "session_cookie=missing cookie_count=0" in caplog.text
        caplog.clear()
        app_client.cookies.set("nttotv_session", "invalid-session-example")
        assert app_client.put("/api/me/profile", json={"payload": {}}).status_code == 401
        assert "session_cookie=invalid cookie_count=1" in caplog.text
        assert "invalid-session-example" not in caplog.text


@pytest.mark.integration
def test_register_requires_invite_code_when_configured(
    app_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(
        auth_routes,
        "default_settings",
        Settings(invite_code="join-9999"),
    )

    missing = app_client.post(
        "/api/auth/register", json={"username": "alice", "password": "secret"}
    )
    assert missing.status_code == 401
    assert missing.json()["error"]["field"] == "inviteCode"

    wrong = app_client.post(
        "/api/auth/register",
        json={"username": "alice", "password": "secret", "inviteCode": "bad"},
    )
    assert wrong.status_code == 401

    created = app_client.post(
        "/api/auth/register",
        json={
            "username": "alice",
            "password": "secret",
            "inviteCode": "join-9999",
        },
    )
    assert created.status_code == 200
    assert created.json()["user"]["username"] == "alice"


@pytest.mark.integration
def test_me_profile_requires_auth_and_is_scoped_by_user(app_client: TestClient):
    assert app_client.get("/api/me/profile").status_code == 401

    assert app_client.post(
        "/api/auth/register", json={"username": "alice", "password": "pw"}
    ).status_code == 200
    alice_profile = app_client.get("/api/me/profile").json()["profile"]
    assert alice_profile["name"] == "alice"

    saved = app_client.put(
        "/api/me/profile",
        json={"payload": {"timeframe": "5m", "drawings": []}},
    )
    assert saved.status_code == 200
    alice_id = saved.json()["profile"]["id"]

    assert app_client.post("/api/auth/logout").status_code == 200
    assert app_client.post(
        "/api/auth/register", json={"username": "bob", "password": "pw"}
    ).status_code == 200
    bob_profile = app_client.get("/api/me/profile").json()["profile"]
    assert bob_profile["id"] != alice_id
    assert bob_profile["payload"] == {
        "mgannBreak": _default_mgann_break_settings(),
        "mgannBreakSettingsVersion": MGANN_BREAK_SETTINGS_VERSION,
    }

    app_client.post("/api/auth/logout")
    app_client.post("/api/auth/login", json={"username": "alice", "password": "pw"})
    reloaded = app_client.get("/api/me/profile").json()["profile"]
    assert reloaded["payload"] == {
        "timeframe": "5m",
        "drawings": [],
        "mgannBreak": _default_mgann_break_settings(),
        "mgannBreakSettingsVersion": MGANN_BREAK_SETTINGS_VERSION,
    }


@pytest.mark.integration
def test_liquidity_chart_patch_preserves_chart_profile_and_survives_main_save(
    app_client: TestClient,
):
    assert app_client.post(
        "/api/auth/register", json={"username": "alice", "password": "pw"}
    ).status_code == 200
    assert app_client.put(
        "/api/me/profile",
        json={"payload": {"timeframe": "1m", "drawings": []}},
    ).status_code == 200

    liquidity_chart = {
        "version": 1,
        "timeframe": "5m",
        "visibleBars": 96,
        "offsetBars": 12,
        "priceScale": 1.4,
        "pricePanPx": -30,
        "filters": {
            "longTerm": True,
            "relative": False,
            "absolute": True,
            "trend1": True,
            "trend2": False,
        },
        "showVwap": True,
        "showBigTrades": True,
        "bigTradeSettings": {
            "minVolume": 40,
            "maxVisible": 250,
            "soundEnabled": True,
            "sessionMinVolumes": {"asia": 40, "eu": 60, "us": 120},
        },
    }
    patched = app_client.patch(
        "/api/me/profile/liquidity-chart",
        json={"liquidityChart": liquidity_chart},
    )
    assert patched.status_code == 200
    assert patched.json()["liquidityChart"] == liquidity_chart

    payload = app_client.get("/api/me/profile").json()["profile"]["payload"]
    assert payload["timeframe"] == "1m"
    assert payload["liquidityChart"] == liquidity_chart
    assert payload["bigTradeSettings"] == liquidity_chart["bigTradeSettings"]

    saved = app_client.put(
        "/api/me/profile",
        json={"payload": {"timeframe": "15m", "drawings": []}},
    )
    assert saved.status_code == 200
    assert saved.json()["profile"]["payload"]["liquidityChart"] == liquidity_chart


@pytest.mark.integration
def test_me_profile_retires_stale_mgann_settings_but_keeps_current_customization(
    app_client: TestClient,
):
    assert app_client.post(
        "/api/auth/register", json={"username": "alice", "password": "pw"}
    ).status_code == 200

    stale = app_client.put(
        "/api/me/profile",
        json={
            "payload": {
                "timeframe": "1m",
                "mgannBreak": {
                    "volumeDeltaMultiplier": 3,
                    "minSpreadTicks": 0,
                    "spreadLookback": 20,
                    "spreadMultiplier": 3,
                    "filterLiquidity": False,
                    "confirmationBars": 2,
                    "breakTicks": 0,
                },
            }
        },
    ).json()["profile"]["payload"]
    assert stale["mgannBreak"] == _default_mgann_break_settings()
    assert stale["mgannBreakSettingsVersion"] == MGANN_BREAK_SETTINGS_VERSION

    custom = {**_default_mgann_break_settings(), "spreadLookback": 40}
    current = app_client.put(
        "/api/me/profile",
        json={
            "payload": {
                "timeframe": "1m",
                "mgannBreak": custom,
                "mgannBreakSettingsVersion": MGANN_BREAK_SETTINGS_VERSION,
            }
        },
    ).json()["profile"]["payload"]
    assert current["mgannBreak"] == custom


@pytest.mark.integration
def test_first_user_profile_seeds_from_legacy_default(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
):
    db_path = tmp_path / "app.sqlite"
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(
            """
            CREATE TABLE profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                payload TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
            """
        )
        conn.execute(
            "INSERT INTO profiles VALUES (?, ?, ?, ?, ?)",
            ("default", "Legacy", '{"timeframe":"15m"}', 1, 2),
        )
        conn.commit()
    finally:
        conn.close()

    settings = Settings(data_dir=tmp_path, invite_code=None)
    monkeypatch.setattr(auth_routes, "default_settings", settings)
    cache = CacheStore(db_path)
    app = create_app(lifespan=False)
    app.state.contract_state = ContractStateStore(cache, settings=settings)
    app.state.basis_engine = BasisEngine(settings=settings)
    try:
        with TestClient(app) as client:
            assert client.post(
                "/api/auth/register", json={"username": "first", "password": "pw"}
            ).status_code == 200
            profile = client.get("/api/me/profile").json()["profile"]
            assert profile["name"] == "Legacy"
            assert profile["payload"] == {
                "timeframe": "15m",
                "mgannBreak": _default_mgann_break_settings(),
                "mgannBreakSettingsVersion": MGANN_BREAK_SETTINGS_VERSION,
            }
    finally:
        cache.close()
