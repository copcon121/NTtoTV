"""Unit tests for server-side profile persistence and alert profile scope."""

from __future__ import annotations

import pytest

from app.storage.cache_store import CacheStore
from app.storage.records import AlertRecord, ProfileRecord


@pytest.fixture()
def cache_store(tmp_path):
    store = CacheStore(tmp_path / "app.sqlite")
    try:
        yield store
    finally:
        store.close()


@pytest.mark.unit
def test_profile_round_trip(cache_store):
    cache_store.upsert_profile(
        ProfileRecord(
            id="desk-a",
            name="Desk A",
            payload={"timeframe": "5m", "drawings": []},
            created_at=10,
            updated_at=10,
        )
    )

    saved = cache_store.read_profile("desk-a")
    assert saved is not None
    assert saved.name == "Desk A"
    assert saved.payload == {"timeframe": "5m", "drawings": []}

    cache_store.upsert_profile(
        ProfileRecord(
            id="desk-a",
            name="Desk A updated",
            payload={"timeframe": "1m"},
            created_at=saved.created_at,
            updated_at=20,
        )
    )

    updated = cache_store.read_profile("desk-a")
    assert updated is not None
    assert updated.created_at == 10
    assert updated.updated_at == 20
    assert updated.payload == {"timeframe": "1m"}


@pytest.mark.unit
def test_alerts_are_scoped_by_profile(cache_store):
    cache_store.upsert_alert(
        AlertRecord(
            id="a_default",
            profile_id="default",
            symbol="GC",
            type="price_crosses_level",
            params={"level": 100},
            created_at=1,
            updated_at=1,
        )
    )
    cache_store.upsert_alert(
        AlertRecord(
            id="a_custom",
            profile_id="desk-a",
            symbol="GC",
            type="price_crosses_level",
            params={"level": 200},
            created_at=2,
            updated_at=2,
        )
    )

    assert [a.id for a in cache_store.read_alerts(profile_id="default")] == [
        "a_default"
    ]
    assert [a.id for a in cache_store.read_alerts(profile_id="desk-a")] == [
        "a_custom"
    ]
    assert cache_store.read_alert("a_custom", "default") is None
