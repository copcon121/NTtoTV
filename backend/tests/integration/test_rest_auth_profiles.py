from __future__ import annotations

import sqlite3

import pytest
from fastapi.testclient import TestClient

from app.app import create_app
from app.config import Settings
from app.engines.basis_engine import BasisEngine
from app.rest import auth as auth_routes
from app.rest.contract_state import ContractStateStore
from app.storage.cache_store import CacheStore


@pytest.fixture()
def app_client(tmp_path):
    settings = Settings(data_dir=tmp_path)
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
    assert bob_profile["payload"] == {}

    app_client.post("/api/auth/logout")
    app_client.post("/api/auth/login", json={"username": "alice", "password": "pw"})
    reloaded = app_client.get("/api/me/profile").json()["profile"]
    assert reloaded["payload"] == {"timeframe": "5m", "drawings": []}


@pytest.mark.integration
def test_first_user_profile_seeds_from_legacy_default(tmp_path):
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

    settings = Settings(data_dir=tmp_path)
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
            assert profile["payload"] == {"timeframe": "15m"}
    finally:
        cache.close()
