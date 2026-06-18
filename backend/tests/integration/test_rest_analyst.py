from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from app.analyst.poi_models import PoiEvent, PoiZone
from app.analyst.schemas import AnalystReport, MarketStateSnapshot
from app.analyst.store import AnalystStore
from app.app import create_app
from app.rest.contract_state import ContractStateStore
from app.storage.cache_store import CacheStore


@pytest.fixture()
def env(tmp_path):
    app = create_app(lifespan=False)
    cache = CacheStore(tmp_path / "app.sqlite")
    app.state.contract_state = ContractStateStore(cache)
    store = AnalystStore(tmp_path / "analyst.sqlite")
    app.state.analyst_store = store
    app.state.analyst_llm_client = DisabledLlm()
    try:
        with TestClient(app) as client:
            yield client, store, cache
    finally:
        try:
            store.close()
        finally:
            cache.close()


class DisabledLlm:
    enabled = False

    def analyze(self, snapshot, *, reasoning_effort=None):
        raise AssertionError("disabled LLM must not be called")


class FakeLlm:
    enabled = True

    def __init__(self):
        self.reasoning_efforts = []

    def analyze(self, snapshot, *, reasoning_effort=None):
        self.reasoning_efforts.append(reasoning_effort)
        return AnalystReport(
            report_id=f"{snapshot.snapshot_id}:fake",
            snapshot_id=snapshot.snapshot_id,
            symbol=snapshot.symbol,
            contract=snapshot.contract,
            created_at=snapshot.snapshot_time + 1,
            bias="bullish",
            decision="wait_for_buy",
            confidence=0.68,
            reason=("manual trigger report",),
            invalid_if="M5 closes below support",
            next_confirmation="Manual timing at the M5 POI",
            risk_state="wait",
            allowed_to_alert=True,
        )


class FailingLlm:
    enabled = True

    def analyze(self, snapshot, *, reasoning_effort=None):
        raise TimeoutError("llm timeout")


def _snapshot() -> MarketStateSnapshot:
    return MarketStateSnapshot(
        snapshot_id="GC:GC:1000",
        symbol="GC",
        contract="GC",
        snapshot_time=1000,
        timeframes={},
        decision_context={"allowedToAutoTrade": False},
    )


def _report(created_at: int = 1100) -> AnalystReport:
    return AnalystReport(
        report_id=f"r-{created_at}",
        snapshot_id="GC:GC:1000",
        symbol="GC",
        contract="GC",
        created_at=created_at,
        bias="bullish",
        decision="wait_for_buy",
        confidence=0.7,
        reason=("H1 bullish",),
        invalid_if="M5 close below invalidation",
        next_confirmation="Manual timing at the M5 POI",
        risk_state="wait",
        allowed_to_alert=True,
    )


def _login(client: TestClient) -> None:
    resp = client.post(
        "/api/auth/login",
        json={"username": "tester", "password": "secret"},
    )
    assert resp.status_code == 200


def _poi_zone() -> PoiZone:
    return PoiZone(
        zone_id="z1",
        symbol="GC",
        contract="GC",
        timeframe="M5",
        side="demand",
        kind="fvg",
        top=4233.5,
        bottom=4232.5,
        mid=4233.0,
        created_at=1000,
        status="inside",
        pd_zone="discount",
        bias_aligned=True,
        distance_to_price=0.0,
        contains_price=True,
        touch_count=1,
        last_touched_at=1100,
        last_state_change_at=1100,
    )


def _poi_event() -> PoiEvent:
    snapshot = {
        "eventType": "price_entered_poi",
        "symbol": "GC",
        "contract": "GC",
        "snapshotTime": 1100,
        "currentPrice": 4233.0,
        "activePoi": _poi_zone().to_dict(),
        "decisionContext": {"allowedToAutoTrade": False},
    }
    return PoiEvent(
        event_id="e1",
        zone_id="z1",
        event_type="price_entered_poi",
        symbol="GC",
        contract="GC",
        snapshot_time=1100,
        input_snapshot=snapshot,
        provider_name="mock",
        provider_mode="mock",
        response={"decision": "wait_for_buy", "confidence": 0.5},
        decision="wait_for_buy",
        confidence=0.5,
        allowed_to_auto_trade=False,
        error=None,
        latency_ms=1,
        deduped=False,
        created_at=1200,
    )


@pytest.mark.integration
def test_analyst_latest_returns_null_when_no_report(env):
    client, _, _ = env

    resp = client.get("/api/analyst/latest")

    assert resp.status_code == 200
    assert resp.json() == {"report": None}


@pytest.mark.integration
def test_analyst_latest_returns_most_recent_report(env):
    client, store, _ = env
    store.insert_snapshot(_snapshot())
    store.insert_report(_report(1100))
    store.insert_report(_report(1200))

    resp = client.get("/api/analyst/latest")

    assert resp.status_code == 200
    body = resp.json()
    assert body["report"]["reportId"] == "r-1200"
    assert body["report"]["allowedToAutoTrade"] is False


@pytest.mark.integration
def test_analyst_latest_returns_newer_real_poi_event_report(env):
    client, store, _ = env
    store.insert_snapshot(_snapshot())
    store.insert_report(_report(1200))
    store.upsert_poi_zone(_poi_zone())
    event = replace(
        _poi_event(),
        provider_name="openai_poi_analyst",
        provider_mode="real",
        response={
            "bias": "bearish",
            "decision": "wait_for_sell",
            "confidence": 0.82,
            "reason": ["Giá đã chạm M5 supply POI hợp lệ."],
            "invalidIf": "Giá phá lên trên POI.",
            "nextConfirmation": "Trader tự timing thủ công.",
            "riskState": "wait",
            "allowedToAlert": True,
            "allowedToAutoTrade": False,
        },
        decision="wait_for_sell",
        confidence=0.82,
        created_at=1300,
    )
    store.insert_poi_event(event)

    resp = client.get("/api/analyst/latest")

    assert resp.status_code == 200
    body = resp.json()
    assert body["report"]["reportId"] == "poi:e1"
    assert body["report"]["decision"] == "wait_for_sell"
    assert body["report"]["rawResponse"]["source"] == "poi_event"
    assert body["report"]["allowedToAutoTrade"] is False


@pytest.mark.integration
def test_analyst_reports_limit_and_validation(env):
    client, store, _ = env
    store.insert_snapshot(_snapshot())
    store.insert_report(_report(1100))
    store.insert_report(_report(1200))

    limited = client.get("/api/analyst/reports", params={"limit": 1})
    assert limited.status_code == 200
    assert [r["reportId"] for r in limited.json()["reports"]] == ["r-1200"]

    bad = client.get("/api/analyst/reports", params={"limit": 0})
    assert bad.status_code == 400
    assert bad.json()["error"]["field"] == "limit"


@pytest.mark.integration
def test_analyst_run_stores_snapshot_without_llm_report_when_disabled(env):
    client, _, _ = env
    _login(client)

    resp = client.post("/api/analyst/run")

    assert resp.status_code == 200
    body = resp.json()
    assert body["snapshot"]["symbol"] == "GC"
    assert body["snapshot"]["contract"] == "GC"
    assert body["report"] is None
    assert body["llmEnabled"] is False
    assert body["error"] is None


@pytest.mark.integration
def test_analyst_run_returns_and_persists_manual_llm_report(env):
    client, store, _ = env
    _login(client)
    fake_llm = FakeLlm()
    client.app.state.analyst_llm_client = fake_llm

    resp = client.post("/api/analyst/run")

    assert resp.status_code == 200
    body = resp.json()
    assert body["report"]["decision"] == "wait_for_buy"
    assert body["report"]["allowedToAutoTrade"] is False
    latest = store.latest_report()
    assert latest is not None
    assert latest.report_id == body["report"]["reportId"]
    assert fake_llm.reasoning_efforts == ["high"]


@pytest.mark.integration
def test_analyst_run_sends_report_to_telegram_profile(env, monkeypatch):
    client, _, _ = env
    _login(client)
    client.app.state.analyst_llm_client = FakeLlm()
    sent = []

    def fake_send(config, *, message, screenshot_data_url=None):
        sent.append(
            {
                "chatId": config["chatId"],
                "message": message,
                "screenshot": screenshot_data_url,
            }
        )
        return {"ok": True}

    monkeypatch.setattr("app.rest.notifications._send_telegram", fake_send)
    config = client.put(
        "/api/notifications/telegram?profileId=desk",
        json={
            "enabled": True,
            "botToken": "123:secret",
            "chatId": "456",
            "sendScreenshot": False,
        },
    )
    assert config.status_code == 200

    resp = client.post("/api/analyst/run?profileId=desk")

    assert resp.status_code == 200
    body = resp.json()
    assert body["telegram"] == {"sent": True}
    assert sent
    assert sent[0]["chatId"] == "456"
    assert "AI đọc market GC GC" in sent[0]["message"]
    assert "wait_for_buy" in sent[0]["message"]


@pytest.mark.integration
def test_analyst_run_fail_closed_when_llm_errors(env):
    client, store, _ = env
    _login(client)
    client.app.state.analyst_llm_client = FailingLlm()

    resp = client.post("/api/analyst/run")

    assert resp.status_code == 200
    body = resp.json()
    assert body["snapshot"]["symbol"] == "GC"
    assert body["report"] is None
    assert body["llmEnabled"] is True
    assert body["error"] == "llm timeout"
    assert store.latest_report() is None


@pytest.mark.integration
def test_analyst_run_requires_login(env):
    client, _, _ = env

    resp = client.post("/api/analyst/run")

    assert resp.status_code == 401


@pytest.mark.integration
def test_analyst_event_ai_requires_login(env):
    client, _, _ = env

    resp = client.get("/api/analyst/event-ai")

    assert resp.status_code == 401


@pytest.mark.integration
def test_analyst_event_ai_rejects_enable_when_llm_not_configured(env):
    client, _, _ = env
    _login(client)

    resp = client.put(
        "/api/analyst/event-ai",
        params={"profileId": "desk"},
        json={"enabled": True},
    )

    assert resp.status_code == 400
    assert resp.json()["error"]["field"] == "enabled"


@pytest.mark.integration
def test_analyst_event_ai_toggle_is_profile_scoped(env):
    client, store, _ = env
    _login(client)
    client.app.state.analyst_llm_client = FakeLlm()

    enabled = client.put(
        "/api/analyst/event-ai",
        params={"profileId": "desk"},
        json={"enabled": True},
    )

    assert enabled.status_code == 200
    assert enabled.json()["enabled"] is True
    assert enabled.json()["profileId"] == "desk"
    assert enabled.json()["providerMode"] == "real"
    assert store.any_event_ai_enabled() is True

    other_profile = client.get(
        "/api/analyst/event-ai",
        params={"profileId": "other"},
    )
    assert other_profile.status_code == 200
    assert other_profile.json()["enabled"] is False


@pytest.mark.integration
def test_analyst_auto_send_state_reads_runtime(env):
    client, _, _ = env

    resp = client.get("/api/analyst/auto-send")

    assert resp.status_code == 200
    assert resp.json() == {
        "available": False,
        "enabled": False,
        "reason": "30-minute auto analyst has been replaced by event-driven POI scanner",
    }


@pytest.mark.integration
def test_analyst_auto_send_toggle_is_compatibility_noop(env):
    client, _, _ = env

    resp = client.put("/api/analyst/auto-send", json={"enabled": False})

    assert resp.status_code == 200
    assert resp.json() == {
        "available": False,
        "enabled": False,
        "reason": "30-minute auto analyst has been replaced by event-driven POI scanner",
    }


@pytest.mark.integration
def test_analyst_auto_send_toggle_rejects_invalid_body(env):
    client, _, _ = env

    resp = client.put("/api/analyst/auto-send", json={"enabled": "no"})

    assert resp.status_code == 400
    assert resp.json()["error"]["field"] == "enabled"


@pytest.mark.integration
def test_analyst_poi_state_returns_zones(env):
    client, store, _ = env
    store.upsert_poi_zone(_poi_zone())

    resp = client.get("/api/analyst/poi-state")

    assert resp.status_code == 200
    body = resp.json()
    assert body["zones"][0]["zoneId"] == "z1"
    assert body["zones"][0]["kind"] == "fvg"
    assert body["zones"][0]["biasAligned"] is True


@pytest.mark.integration
def test_analyst_poi_events_returns_events(env):
    client, store, _ = env
    store.upsert_poi_zone(_poi_zone())
    store.insert_poi_event(_poi_event())

    resp = client.get("/api/analyst/poi-events")

    assert resp.status_code == 200
    body = resp.json()
    assert body["events"][0]["eventId"] == "e1"
    assert body["events"][0]["decision"] == "wait_for_buy"
    assert body["events"][0]["providerMode"] == "mock"
    assert body["events"][0]["allowedToAutoTrade"] is False
