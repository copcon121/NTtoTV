# Feature: gc-chart-platform, Property 25: Alert CRUD round-trips through the Cache_Store
"""Property test for alert CRUD round-trips (task 18.2).

Property 25 asserts that for *any* alert definition: creating it then reading it
back returns equal fields; applying a PATCH with an arbitrary subset of editable
fields (including ``enabled``) updates exactly those fields and leaves the others
unchanged; and deleting it makes subsequent reads report it absent.

The round-trip goes through the **real persistence layer**: the FastAPI alert
CRUD endpoints (``POST``/``GET``/``PATCH``/``DELETE`` ``/api/alerts``) backed by
a temporary Cache_Store (``data/app.sqlite`` in a fresh temp dir per example, so
examples are isolated). Generators cover all six alert types, the ``enabled``
flag, and the editable fields (``enabled`` and ``params``).

Uses the design-mandated Hypothesis ``gc`` profile (>= 100 examples).
(Validates: Requirements 16.2, 16.3, 18.10)
"""

from __future__ import annotations

import shutil
import tempfile
from contextlib import contextmanager
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from hypothesis import given
from hypothesis import strategies as st

from app.app import create_app
from app.config import Settings
from app.engines.alert_engine import (
    ALERT_TYPES,
    LEVEL_ALERT_TYPES,
    MGANN_FVG_DEFAULT_MAX_ZONE_AGE,
    MGANN_FVG_DEFAULT_MIN_GAP_TICKS,
    MGANN_FVG_DEFAULT_RETEST_TOLERANCE_TICKS,
    MGANN_FVG_DEFAULT_SWING_SIZE,
    MGANN_FVG_RETEST,
    MGANN_FVG_RETEST_TIMEFRAME,
    MGANN_BIG_TRADE_SWEEP,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_BREAK_TICKS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_CONFIRMATION_BARS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_CUTS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_WICK_TICKS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_SPREAD_TICKS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_VOLUME,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_LOOKBACK_BARS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_TOLERANCE_TICKS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_LOOKBACK,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_MULTIPLIER,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_SWING_SIZE,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_TIMEFRAME,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_LOOKBACK,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_MULTIPLIER,
    SMC_DEFAULT_LOOKAHEAD_BARS,
    SMC_DEFAULT_MAX_BARS,
    SMC_DEFAULT_PAUSE_ON_INSIDE_BARS,
    SMC_DEFAULT_RETEST_TOLERANCE_TICKS,
    SMC_DEFAULT_SWING_LENGTH,
    SMC_EXTERNAL_BREAK_BIG_TRADE,
)
from app.rest.contract_state import ContractStateStore
from app.storage.cache_store import CacheStore

_SYMBOL = "GC"
_CANDIDATES = ("GC 08-26", "GC 10-26", "GC 12-26")
_THRESHOLD_TYPES = frozenset({"volume_delta_threshold", "big_trade_threshold"})

# A single app instance reused across examples; the backing Cache_Store is
# swapped per example via app.state.contract_state for isolation.
_APP = create_app()


# --- generators --------------------------------------------------------------

# Finite, JSON-stable numbers so values round-trip exactly through the params
# JSON column. Bools are excluded from numeric positions on purpose.
_numbers = st.one_of(
    st.integers(min_value=-1_000_000, max_value=1_000_000),
    st.floats(allow_nan=False, allow_infinity=False, width=32),
)
_positive_numbers = st.one_of(
    st.integers(min_value=1, max_value=1_000_000),
    st.floats(
        min_value=1.0,
        max_value=1_000_000,
        allow_nan=False,
        allow_infinity=False,
        width=32,
    ),
)

# JSON-safe scalar values for arbitrary extra params keys.
_json_scalars = st.one_of(
    _numbers,
    st.booleans(),
    st.text(alphabet="abcdefghijklmnABCDEF0123456789_ ", max_size=8),
)

# Arbitrary extra params (beyond the type's required field), kept small.
_extra_params = st.dictionaries(
    keys=st.text(alphabet="ghijklmnopqrstuvwxyz_", min_size=1, max_size=6),
    values=_json_scalars,
    max_size=3,
)


def _params_for(alert_type: str):
    """A strategy producing valid ``params`` for ``alert_type`` plus extras."""

    @st.composite
    def build(draw):
        params: dict = dict(draw(_extra_params))
        if alert_type in LEVEL_ALERT_TYPES:
            params["level"] = draw(_numbers)
        elif alert_type in _THRESHOLD_TYPES:
            params["threshold"] = draw(_numbers)
        elif alert_type == SMC_EXTERNAL_BREAK_BIG_TRADE:
            params["bigTradeThreshold"] = draw(_positive_numbers)
            params["swingLength"] = SMC_DEFAULT_SWING_LENGTH
            params["lookaheadBars"] = SMC_DEFAULT_LOOKAHEAD_BARS
            params["effectiveLookaheadBars"] = SMC_DEFAULT_LOOKAHEAD_BARS
            params["maxBars"] = SMC_DEFAULT_MAX_BARS
            params["pauseOnInsideBars"] = SMC_DEFAULT_PAUSE_ON_INSIDE_BARS
            params["retestToleranceTicks"] = SMC_DEFAULT_RETEST_TOLERANCE_TICKS
        elif alert_type == MGANN_FVG_RETEST:
            params["timeframe"] = MGANN_FVG_RETEST_TIMEFRAME
            params["swingSize"] = MGANN_FVG_DEFAULT_SWING_SIZE
            params["maxZoneAge"] = MGANN_FVG_DEFAULT_MAX_ZONE_AGE
            params["minGapTicks"] = MGANN_FVG_DEFAULT_MIN_GAP_TICKS
            params["retestToleranceTicks"] = MGANN_FVG_DEFAULT_RETEST_TOLERANCE_TICKS
        elif alert_type == MGANN_BIG_TRADE_SWEEP:
            params["bigTradeThreshold"] = draw(_positive_numbers)
            params["timeframe"] = MGANN_BIG_TRADE_SWEEP_DEFAULT_TIMEFRAME
            params["minVolume"] = MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_VOLUME
            params["volumeLookback"] = MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_LOOKBACK
            params["volumeMultiplier"] = (
                MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_MULTIPLIER
            )
            params["minSpreadTicks"] = MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_SPREAD_TICKS
            params["spreadLookback"] = MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_LOOKBACK
            params["spreadMultiplier"] = (
                MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_MULTIPLIER
            )
            params["swingSize"] = MGANN_BIG_TRADE_SWEEP_DEFAULT_SWING_SIZE
            params["pivotLookbackBars"] = (
                MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_LOOKBACK_BARS
            )
            params["minPivotCuts"] = MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_CUTS
            params["pivotToleranceTicks"] = (
                MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_TOLERANCE_TICKS
            )
            params["minPivotWickTicks"] = (
                MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_WICK_TICKS
            )
            params["confirmationBars"] = (
                MGANN_BIG_TRADE_SWEEP_DEFAULT_CONFIRMATION_BARS
            )
            params["breakTicks"] = MGANN_BIG_TRADE_SWEEP_DEFAULT_BREAK_TICKS
        # stacked_imbalance: no required field.
        return params

    return build()


@st.composite
def _alert_spec(draw):
    """Generate a valid alert creation body: type, enabled, params."""
    alert_type = draw(st.sampled_from(sorted(ALERT_TYPES)))
    enabled = draw(st.booleans())
    params = draw(_params_for(alert_type))
    return {"symbol": _SYMBOL, "type": alert_type, "enabled": enabled, "params": params}


@st.composite
def _patch_spec(draw, alert_type: str):
    """Generate an arbitrary subset of editable fields to PATCH.

    May patch ``enabled`` and/or ``params`` (or neither). ``params`` patches
    remain valid for the alert's type so the PATCH is accepted.
    """
    patch: dict = {}
    if draw(st.booleans()):
        patch["enabled"] = draw(st.booleans())
    if draw(st.booleans()):
        patch["params"] = draw(_params_for(alert_type))
    return patch


@contextmanager
def _client():
    """A TestClient over a fresh temporary Cache_Store (isolated per example)."""
    data_dir = Path(tempfile.mkdtemp(prefix="gc_alert_crud_"))
    settings = Settings(
        data_dir=data_dir,
        supported_symbols=(_SYMBOL,),
        gc_candidate_contracts=_CANDIDATES,
    )
    cache = CacheStore(data_dir / "app.sqlite")
    _APP.state.contract_state = ContractStateStore(cache, settings=settings)
    try:
        yield TestClient(_APP)
    finally:
        cache.close()
        shutil.rmtree(data_dir, ignore_errors=True)


def _read_back(client: TestClient, alert_id: str) -> dict | None:
    """Return the alert with ``alert_id`` from GET /api/alerts, or None."""
    listing = client.get("/api/alerts").json()["alerts"]
    for a in listing:
        if a["id"] == alert_id:
            return a
    return None


# Feature: gc-chart-platform, Property 25: Alert CRUD round-trips through the Cache_Store
@pytest.mark.property
@given(spec=_alert_spec(), data=st.data())
def test_alert_crud_round_trips_through_cache_store(spec, data) -> None:
    with _client() as client:
        # -- create -> read: persisted fields equal the input (Req 16.2) -------
        created = client.post("/api/alerts", json=spec)
        assert created.status_code == 201
        body = created.json()
        alert_id = body["id"]
        assert body["symbol"] == spec["symbol"]
        assert body["type"] == spec["type"]
        assert body["enabled"] == spec["enabled"]
        assert body["params"] == spec["params"]

        persisted = _read_back(client, alert_id)
        assert persisted is not None
        assert persisted["symbol"] == spec["symbol"]
        assert persisted["type"] == spec["type"]
        assert persisted["enabled"] == spec["enabled"]
        assert persisted["params"] == spec["params"]

        # -- PATCH a subset -> read: exactly those fields change (Req 18.10) ---
        patch = data.draw(_patch_spec(spec["type"]))
        expected_enabled = patch.get("enabled", spec["enabled"])
        expected_params = patch.get("params", spec["params"])

        patched = client.patch(f"/api/alerts/{alert_id}", json=patch)
        assert patched.status_code == 200
        updated = patched.json()
        assert updated["id"] == alert_id
        assert updated["symbol"] == spec["symbol"]  # untouched
        assert updated["type"] == spec["type"]      # untouched
        assert updated["enabled"] == expected_enabled
        assert updated["params"] == expected_params

        reread = _read_back(client, alert_id)
        assert reread is not None
        assert reread["enabled"] == expected_enabled
        assert reread["params"] == expected_params
        assert reread["symbol"] == spec["symbol"]
        assert reread["type"] == spec["type"]

        # -- delete -> read: subsequent reads report it absent (Req 16.3) ------
        deleted = client.delete(f"/api/alerts/{alert_id}")
        assert deleted.status_code == 204
        assert _read_back(client, alert_id) is None
        # A second delete reports it gone (404), confirming absence.
        assert client.delete(f"/api/alerts/{alert_id}").status_code == 404
