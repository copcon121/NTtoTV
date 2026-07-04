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

def _subscription(endpoint: str = "https://push.example.test/send/1"):
    return {
        "endpoint": endpoint,
        "expirationTime": None,
        "keys": {
            "p256dh": "p256dh-key",
            "auth": "auth-key",
        },
    }

def test_webpush_subscription_round_trips_and_generates_public_key(tmp_path):
    client, cache = _client(tmp_path)
    try:
        initial = client.get("/api/notifications/webpush?profileId=desk-a")
        assert initial.status_code == 200
        body = initial.json()["webPush"]
        assert body["enabled"] is False
        assert body["subscriptionCount"] == 0
        assert isinstance(body["publicKey"], str)
        assert len(body["publicKey"]) > 40

        saved = client.post(
            "/api/notifications/webpush/subscription?profileId=desk-a",
            json=_subscription(),
        )
        assert saved.status_code == 200
        assert saved.json()["webPush"]["enabled"] is True
        assert saved.json()["webPush"]["subscriptionCount"] == 1

        disabled = client.put(
            "/api/notifications/webpush?profileId=desk-a",
            json={"enabled": False},
        )
        assert disabled.status_code == 200
        assert disabled.json()["webPush"]["enabled"] is False
        assert disabled.json()["webPush"]["subscriptionCount"] == 1

        deleted = client.request(
            "DELETE",
            "/api/notifications/webpush/subscription?profileId=desk-a",
            json={"endpoint": _subscription()["endpoint"]},
        )
        assert deleted.status_code == 200
        assert deleted.json()["webPush"]["subscriptionCount"] == 0
    finally:
        cache.close()

def test_webpush_test_sends_to_saved_subscriptions(tmp_path, monkeypatch):
    client, cache = _client(tmp_path)
    sent: list[dict] = []

    def fake_send(subscription, payload, *, vapid_private_key, ttl):
        sent.append(
            {
                "subscription": subscription,
                "payload": payload,
                "vapid_private_key": vapid_private_key,
                "ttl": ttl,
            }
        )

    monkeypatch.setattr(
        "app.rest.notifications._send_web_push_to_subscription",
        fake_send,
    )
    try:
        client.post(
            "/api/notifications/webpush/subscription?profileId=desk-a",
            json=_subscription(),
        )
        res = client.post("/api/notifications/webpush/test?profileId=desk-a")
        assert res.status_code == 200
        assert res.json()["sent"] == 1
        assert sent[0]["payload"]["title"] == "GC Chart"
        assert sent[0]["subscription"]["endpoint"] == _subscription()["endpoint"]
    finally:
        cache.close()
