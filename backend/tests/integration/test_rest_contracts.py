"""Integration tests for the core REST endpoints (task 10.1).

Covers ``GET /api/symbols``, ``GET /api/contracts``, ``POST /api/contracts/active``,
and the shared error envelope with status/code/field mapping (Req 18.1, 18.2,
18.3, 18.12). These exercise the real FastAPI app via the TestClient against a
temporary Cache_Store so the metadata-backed Active_Contract state is real.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.app import create_app
from app.config import Settings
from app.engines.contract_resolver import ContractResolver
from app.rest.contract_state import ContractStateStore
from app.storage.cache_store import CacheStore

_SYMBOL = "GC"
_CANDIDATES = ("GC 08-26", "GC 10-26", "GC 12-26")


@pytest.fixture()
def client(tmp_path):
    """A TestClient whose app uses a temporary Cache_Store-backed contract state."""
    settings = Settings(
        data_dir=tmp_path,
        supported_symbols=(_SYMBOL,),
        gc_candidate_contracts=_CANDIDATES,
    )
    cache = CacheStore(tmp_path / "app.sqlite")
    state = ContractStateStore(cache, settings=settings)

    app = create_app()
    app.state.contract_state = state
    try:
        with TestClient(app) as c:
            yield c
    finally:
        cache.close()


# -- GET /api/symbols (Req 18.1) ----------------------------------------------


@pytest.mark.integration
def test_get_symbols_returns_gc(client):
    resp = client.get("/api/symbols")
    assert resp.status_code == 200
    assert resp.json() == {"symbols": ["GC"]}


# -- GET /api/contracts (Req 18.2) --------------------------------------------


@pytest.mark.integration
def test_get_contracts_lists_candidates_and_active(client):
    resp = client.get("/api/contracts", params={"symbol": "GC"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["symbol"] == "GC"
    # Defaults to the first configured candidate before any selection.
    assert body["active"] == "GC 08-26"
    contracts = [c["contract"] for c in body["candidates"]]
    assert contracts == list(_CANDIDATES)
    # The active candidate carries the auto-selection flag (auto by default).
    active_entry = next(c for c in body["candidates"] if c["contract"] == "GC 08-26")
    assert active_entry["autoSelected"] is True


@pytest.mark.integration
def test_get_contracts_missing_symbol_is_400(client):
    resp = client.get("/api/contracts")
    assert resp.status_code == 400
    err = resp.json()["error"]
    assert err["code"] == "BAD_REQUEST"
    assert err["field"] == "symbol"


@pytest.mark.integration
def test_get_contracts_unknown_symbol_is_404(client):
    resp = client.get("/api/contracts", params={"symbol": "ZZ"})
    assert resp.status_code == 404
    err = resp.json()["error"]
    assert err["code"] == "NOT_FOUND"
    assert err["field"] == "symbol"
    assert "ZZ" in err["message"]


# -- POST /api/contracts/active (Req 18.3, 10.4) ------------------------------


@pytest.mark.integration
def test_set_active_contract_pins_and_disables_auto(client):
    resp = client.post(
        "/api/contracts/active", json={"symbol": "GC", "contract": "GC 10-26"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"symbol": "GC", "active": "GC 10-26", "autoResolution": False}

    # The change is persisted: a follow-up read reflects the manual selection.
    follow = client.get("/api/contracts", params={"symbol": "GC"}).json()
    assert follow["active"] == "GC 10-26"
    active_entry = next(c for c in follow["candidates"] if c["contract"] == "GC 10-26")
    assert active_entry["autoSelected"] is False


@pytest.mark.integration
def test_resolver_backed_state_hydrates_persisted_manual_override(tmp_path):
    settings = Settings(
        data_dir=tmp_path,
        supported_symbols=(_SYMBOL,),
        gc_candidate_contracts=_CANDIDATES,
    )
    cache = CacheStore(tmp_path / "app.sqlite")
    try:
        cache.set_metadata("active_contract:GC", "GC 10-26", 1)
        cache.set_metadata("auto_resolution:GC", "0", 1)

        resolver = ContractResolver(list(_CANDIDATES))
        resolver.observe("GC 12-26", trade_volume=1000, quote_events=0, ts_ms=1)
        state = ContractStateStore(cache, settings=settings, resolver=resolver)

        assert state.active_contract("GC") == "GC 10-26"
        assert state.auto_resolution_enabled("GC") is False
    finally:
        cache.close()


@pytest.mark.integration
def test_set_active_unknown_symbol_is_404(client):
    resp = client.post(
        "/api/contracts/active", json={"symbol": "ZZ", "contract": "GC 10-26"}
    )
    assert resp.status_code == 404
    err = resp.json()["error"]
    assert err["code"] == "NOT_FOUND"
    assert err["field"] == "symbol"


@pytest.mark.integration
def test_set_active_non_candidate_is_409(client):
    resp = client.post(
        "/api/contracts/active", json={"symbol": "GC", "contract": "GC 99-99"}
    )
    assert resp.status_code == 409
    err = resp.json()["error"]
    assert err["code"] == "CONFLICT"
    assert err["field"] == "contract"
    assert "GC 99-99" in err["message"]


@pytest.mark.integration
def test_set_active_missing_contract_is_400(client):
    resp = client.post("/api/contracts/active", json={"symbol": "GC"})
    assert resp.status_code == 400
    err = resp.json()["error"]
    assert err["code"] == "BAD_REQUEST"
    assert err["field"] == "contract"


@pytest.mark.integration
def test_set_active_non_object_body_is_400(client):
    resp = client.post("/api/contracts/active", json=["not", "an", "object"])
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "BAD_REQUEST"


# -- error envelope shape (Req 18.12) -----------------------------------------


@pytest.mark.integration
def test_error_envelope_shape_is_consistent(client):
    """Every error response carries an {"error": {code, message[, field]}} body."""
    resp = client.get("/api/contracts", params={"symbol": "ZZ"})
    body = resp.json()
    assert set(body.keys()) == {"error"}
    error = body["error"]
    assert set(error.keys()) == {"code", "message", "field"}
    assert isinstance(error["code"], str)
    assert isinstance(error["message"], str)


@pytest.mark.integration
def test_unknown_route_renders_envelope(client):
    """A route miss is rendered through the shared 404 envelope."""
    resp = client.get("/api/does-not-exist")
    assert resp.status_code == 404
    body = resp.json()
    assert body["error"]["code"] == "NOT_FOUND"
