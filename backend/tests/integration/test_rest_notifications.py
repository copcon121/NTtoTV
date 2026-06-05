from __future__ import annotations

from fastapi.testclient import TestClient

from app.app import create_app
from app.config import Settings
from app.rest.contract_state import ContractStateStore
from app.storage.cache_store import CacheStore


def _client(tmp_path):
    app = create_app(lifespan=False)
    cache = CacheStore(tmp_path / "app.sqlite")
    settings = Settings(
        data_dir=tmp_path,
        supported_symbols=("GC",),
        gc_candidate_contracts=("GC 08-26",),
    )
    app.state.contract_state = ContractStateStore(cache, settings=settings)
    return TestClient(app), cache


def test_telegram_config_round_trips_without_exposing_token(tmp_path):
    client, cache = _client(tmp_path)
    try:
        saved = client.put(
            "/api/notifications/telegram?profileId=desk-a",
            json={
                "enabled": True,
                "botToken": "123:secret",
                "chatId": "456",
                "sendScreenshot": True,
            },
        )
        assert saved.status_code == 200
        assert saved.json()["telegram"] == {
            "enabled": True,
            "chatId": "456",
            "sendScreenshot": True,
            "hasBotToken": True,
        }

        loaded = client.get("/api/notifications/telegram?profileId=desk-a")
        assert loaded.status_code == 200
        assert "botToken" not in loaded.json()["telegram"]
        assert loaded.json()["telegram"]["hasBotToken"] is True

        updated = client.put(
            "/api/notifications/telegram?profileId=desk-a",
            json={"enabled": False, "chatId": "789"},
        )
        assert updated.status_code == 200
        assert updated.json()["telegram"]["hasBotToken"] is True
        assert updated.json()["telegram"]["chatId"] == "789"
    finally:
        cache.close()


def test_telegram_alert_send_is_noop_when_disabled(tmp_path):
    client, cache = _client(tmp_path)
    try:
        res = client.post(
            "/api/notifications/telegram/alert?profileId=default",
            json={"message": "GC crossed 2345"},
        )
        assert res.status_code == 200
        assert res.json() == {"sent": False, "reason": "disabled"}
    finally:
        cache.close()
