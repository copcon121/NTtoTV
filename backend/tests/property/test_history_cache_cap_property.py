"""Property test for the history cache 5,000-bar cap (task 10.3).

Property 23 asserts that for *any* stored bar set for a ``(symbol, contract,
timeframe)`` and *any* request, the cache-path response of ``GET /api/history``
returns the most recent ``min(N, min(limit, 5000))`` bars in ascending time
order with no duplicates or gaps relative to the stored data.

The test exercises the real cache read path end-to-end through the FastAPI
``TestClient`` against a temporary Cache_Store. It generates an arbitrary number
of stored bars (including counts above the 5,000 cap) plus an optional ``limit``,
inserts them as a contiguous arithmetic time series, calls the history endpoint,
and checks the response is exactly the most-recent tail of the stored series.

The Cache_Store / TestClient are built once per module (so the >= 100 Hypothesis
examples share them, which also keeps a function-scoped fixture from being reset
mid-run); each example clears and repopulates the ``bars`` table.

Uses the design-mandated Hypothesis ``gc`` profile (>= 100 examples).
(Validates: Requirements 11.4)
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from hypothesis import given
from hypothesis import strategies as st

from app.app import create_app
from app.config import Settings
from app.rest.contract_state import ContractStateStore
from app.rest.routes import HISTORY_CACHE_CAP
from app.storage.cache_store import CacheStore
from app.storage.records import BarRecord
from app.storage.tick_store import TickStore

_SYMBOL = "GC"
_CANDIDATES = ("GC 08-26", "GC 10-26", "GC 12-26")
_ACTIVE = "GC 08-26"  # default Active_Contract = first candidate
_TF = "1m"

# A fixed UTC anchor (2024-11-01T00:00:00Z) so bucket boundaries are stable, and
# a 1-minute step so the stored times form a contiguous arithmetic series.
_BASE_MS = 1_730_419_200_000
_MINUTE_MS = 60_000


@pytest.fixture(scope="module")
def env(tmp_path_factory):
    """A TestClient wired to a temporary Cache_Store, shared across examples."""
    tmp = tmp_path_factory.mktemp("history_cap")
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
        with TestClient(app) as client:
            yield client, cache
    finally:
        tick_store.close()
        cache.close()


def _bars(n: int) -> Iterator[BarRecord]:
    """Yield ``n`` closed 1m bars at contiguous, strictly increasing times."""
    for i in range(n):
        close = 2345.0 + i
        yield BarRecord(
            symbol=_SYMBOL,
            contract=_ACTIVE,
            timeframe=_TF,
            time=_BASE_MS + i * _MINUTE_MS,
            open=close,
            high=close,
            low=close,
            close=close,
            volume=1 + (i % 7),
            closed=True,
        )


# Bar counts: a cheap common range plus a tight band straddling the 5,000 cap so
# the boundary (just-below, exactly-at, just-above) is exercised every run.
_n_strategy = st.one_of(
    st.integers(min_value=0, max_value=300),
    st.integers(min_value=HISTORY_CACHE_CAP - 10, max_value=HISTORY_CACHE_CAP + 50),
)

# ``limit`` is optional; when present it may sit below, around, or above the cap.
_limit_strategy = st.one_of(
    st.none(),
    st.integers(min_value=1, max_value=50),
    st.integers(min_value=HISTORY_CACHE_CAP - 10, max_value=HISTORY_CACHE_CAP + 10),
    st.integers(min_value=HISTORY_CACHE_CAP + 1, max_value=20_000),
)


# Feature: gc-chart-platform, Property 23: History cache returns the most recent bars up to the 5,000 cap
@pytest.mark.property
@given(n=_n_strategy, limit=_limit_strategy)
def test_history_cache_returns_most_recent_up_to_cap(env, n, limit) -> None:
    client, cache = env

    # Fresh bar set for this example: clear then bulk-insert the contiguous series.
    cache.writer.execute("DELETE FROM bars")
    cache.upsert_bars(_bars(n))

    params: dict[str, object] = {"symbol": _SYMBOL, "tf": _TF}
    if limit is not None:
        params["limit"] = limit

    resp = client.get("/api/history", params=params)
    assert resp.status_code == 200
    body = resp.json()

    # Effective cap mirrors the endpoint: limit defaults to and is capped at 5,000.
    effective_limit = HISTORY_CACHE_CAP if limit is None else min(limit, HISTORY_CACHE_CAP)
    expected_count = min(n, effective_limit)

    bars = body["bars"]
    times = [b["time"] for b in bars]

    # Never more than the 5,000 cap, and exactly min(N, min(limit, 5000)).
    assert len(bars) <= HISTORY_CACHE_CAP
    assert len(bars) == expected_count

    # Ascending time order with no duplicate bar times.
    assert times == sorted(times)
    assert len(set(times)) == len(times)

    # Exactly the MOST RECENT bars: the contiguous tail of the stored series,
    # with no gaps relative to the stored data.
    all_times = [_BASE_MS + i * _MINUTE_MS for i in range(n)]
    assert times == all_times[len(all_times) - expected_count :]

    # Any non-empty result was served from the precomputed cache path. (Req 11.4)
    if n > 0:
        assert body["source"] == "cache"
        assert body["contract"] == _ACTIVE
