"""Property test for unknown-identifier error responses (task 10.4).

Property 27 asserts that for *any* request referencing a symbol, contract,
timeframe, or alert id that does not exist, the REST_API returns the documented
error envelope with an appropriate HTTP status (4xx) that identifies the
offending field and describes the bad identifier.

The test drives the real FastAPI app via the ``TestClient`` against a temporary
Cache_Store, generating arbitrary identifiers drawn from a safe alphabet and
filtered to exclude the few valid values, then hits the REST surfaces that
validate each identifier kind:

* ``GET  /api/contracts?symbol=<unknown>``                  -> 404, field "symbol"
* ``GET  /api/history?symbol=<unknown>&tf=1m``              -> 404, field "symbol"
* ``GET  /api/history?symbol=GC&tf=<unknown>``              -> 404, field "tf"
* ``GET  /api/history?symbol=GC&tf=1m&contract=<unknown>``  -> 404, field "contract"
* ``POST /api/contracts/active {symbol: GC, contract: <non-candidate>}`` -> 409, field "contract"

Each response is checked for the shared envelope ``{"error": {code, message
[, field]}}``, a 4xx status, the expected offending ``field``, and a non-empty
message that names the bad identifier.

(Alert CRUD endpoints — the alert-id branch of Req 18.12 — are introduced by
task 18.x and are not yet mounted, so they are out of scope for this property
test until that surface exists.)

Uses the design-mandated Hypothesis ``gc`` profile (>= 100 examples).
(Validates: Requirements 18.12)
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from hypothesis import given
from hypothesis import strategies as st

from app.app import create_app
from app.config import Settings
from app.engines.bar_aggregator import SUPPORTED_TFS
from app.rest.contract_state import ContractStateStore
from app.storage.cache_store import CacheStore
from app.storage.tick_store import TickStore

_SYMBOL = "GC"
_CANDIDATES = ("GC 08-26", "GC 10-26", "GC 12-26")

# The complete sets of *valid* identifiers; generated identifiers exclude these.
_VALID_SYMBOLS = frozenset({_SYMBOL})
_VALID_CONTRACTS = frozenset(_CANDIDATES)
_VALID_TFS = frozenset(SUPPORTED_TFS)

# A safe alphabet for generated identifiers: letters, digits, spaces and dashes.
# It excludes quotes/backslashes/control characters so the identifier appears
# verbatim inside the error message's ``repr()`` (e.g. ``Unknown symbol 'XYZ'``),
# letting us assert the message actually names the offending value.
_SAFE_ALPHABET = (
    "abcdefghijklmnopqrstuvwxyz"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "0123456789 -"
)


def _identifier(max_size: int = 14):
    """Non-empty identifiers from the safe alphabet (must contain a non-space)."""
    return st.text(alphabet=_SAFE_ALPHABET, min_size=1, max_size=max_size).filter(
        lambda s: s.strip() != ""
    )


_unknown_symbol = _identifier().filter(lambda s: s not in _VALID_SYMBOLS)
_unknown_contract = _identifier().filter(lambda s: s not in _VALID_CONTRACTS)
_unknown_tf = _identifier().filter(lambda s: s not in _VALID_TFS)


@pytest.fixture(scope="module")
def client():
    """A TestClient wired to a temporary Cache_Store, shared across examples.

    The validation paths under test reject the request before any cache read, so
    a single read-only-ish client is safe to reuse across all generated examples.
    """
    import tempfile
    from pathlib import Path

    tmp = Path(tempfile.mkdtemp(prefix="gc_unknown_id_"))
    settings = Settings(
        data_dir=tmp,
        supported_symbols=(_SYMBOL,),
        gc_candidate_contracts=_CANDIDATES,
    )
    cache = CacheStore(tmp / "app.sqlite")
    state = ContractStateStore(cache, settings=settings)
    tick_store = TickStore(tmp / "ticks")

    app = create_app()
    app.state.contract_state = state
    app.state.tick_store = tick_store
    try:
        with TestClient(app) as c:
            yield c
    finally:
        tick_store.close()
        cache.close()


def _assert_descriptive_error(resp, *, expected_field: str, identifier: str) -> None:
    """Assert the response is the shared envelope: 4xx, named field, named id."""
    # Appropriate 4xx status for an unknown resource / conflicting selection.
    assert 400 <= resp.status_code < 500

    body = resp.json()
    # Shared error envelope shape: a single "error" object with code + message,
    # plus the optional "field". (Req 18.12)
    assert set(body.keys()) == {"error"}
    error = body["error"]
    assert set(error.keys()) <= {"code", "message", "field"}
    assert "code" in error and "message" in error

    assert isinstance(error["code"], str) and error["code"]
    # A non-empty, descriptive message that names the offending identifier.
    message = error["message"]
    assert isinstance(message, str) and message.strip() != ""
    assert identifier in message

    # The offending field is identified.
    assert error.get("field") == expected_field


# Feature: gc-chart-platform, Property 27: Unknown identifiers produce a descriptive error response
@pytest.mark.property
@given(symbol=_unknown_symbol)
def test_unknown_symbol_on_contracts_is_descriptive_error(client, symbol) -> None:
    resp = client.get("/api/contracts", params={"symbol": symbol})
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"
    _assert_descriptive_error(resp, expected_field="symbol", identifier=symbol)


# Feature: gc-chart-platform, Property 27: Unknown identifiers produce a descriptive error response
@pytest.mark.property
@given(symbol=_unknown_symbol)
def test_unknown_symbol_on_history_is_descriptive_error(client, symbol) -> None:
    resp = client.get("/api/history", params={"symbol": symbol, "tf": "1m"})
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"
    _assert_descriptive_error(resp, expected_field="symbol", identifier=symbol)


# Feature: gc-chart-platform, Property 27: Unknown identifiers produce a descriptive error response
@pytest.mark.property
@given(tf=_unknown_tf)
def test_unknown_timeframe_on_history_is_descriptive_error(client, tf) -> None:
    resp = client.get("/api/history", params={"symbol": _SYMBOL, "tf": tf})
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"
    _assert_descriptive_error(resp, expected_field="tf", identifier=tf)


# Feature: gc-chart-platform, Property 27: Unknown identifiers produce a descriptive error response
@pytest.mark.property
@given(contract=_unknown_contract)
def test_unknown_contract_on_history_is_descriptive_error(client, contract) -> None:
    resp = client.get(
        "/api/history",
        params={"symbol": _SYMBOL, "tf": "1m", "contract": contract},
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"
    _assert_descriptive_error(resp, expected_field="contract", identifier=contract)


# Feature: gc-chart-platform, Property 27: Unknown identifiers produce a descriptive error response
@pytest.mark.property
@given(contract=_unknown_contract)
def test_non_candidate_contract_on_set_active_is_descriptive_error(
    client, contract
) -> None:
    resp = client.post(
        "/api/contracts/active",
        json={"symbol": _SYMBOL, "contract": contract},
    )
    # A syntactically valid but unknown contract conflicts with the candidate set.
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "CONFLICT"
    _assert_descriptive_error(resp, expected_field="contract", identifier=contract)
