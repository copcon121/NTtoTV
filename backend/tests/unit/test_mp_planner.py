from __future__ import annotations

import asyncio
import copy
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.analyst.store import AnalystStore
from app.app import create_app
from app.engines.alert_engine import Alert, AlertEngine, MarketContext
from app.market_profile.calendar import HOUR_MS, PLANNER_VERSION, active_slots, current_slot, session_windows, trading_days
from app.market_profile.llm import MpLlmClient, validate_plans
from app.market_profile.planner import MpPlanner, _analysis_error_message
from app.market_profile.snapshot import build_snapshot, tpo_profile
from app.market_profile.store import MpStore
from app.models.auth import AuthenticatedUser
from app.models.messages import AlertEvent
from app.pipeline import Pipeline
from app.rest.auth import get_current_user
from app.rest.alerts import get_cache as get_alert_cache
from app.storage.cache_store import CacheStore
from app.storage.records import AlertEventRecord, BarRecord
from app.registry.registry import ChartClient, WebSocketRegistry


def ts(value: str) -> int:
    return int(datetime.fromisoformat(value).replace(tzinfo=timezone.utc).timestamp() * 1000)


AT = ts("2026-10-27T12:00:00")


def bar(time, low=100, high=102, close=101, tf="1m", closed=True):
    return BarRecord("GC", "GC", tf, time, low, high, low, close, 100, closed, "test")


def seed(cache, at):
    for day in trading_days(at, 22)[:-1]:
        cache.upsert_bar(bar(day["start"], tf="1D"))
        for i in range(3):
            cache.upsert_bar(bar(day["start"] + i * 30 * 60_000))
    cache.upsert_bar(bar(at - 120_000))
    cache.upsert_bar(bar(at - 60_000))


def reports(snapshot):
    ref = next(k for k in snapshot["levels"] if k.endswith(":volume:vah"))
    return {"plans": [{
        "scope": scope, "summary": "Quan sát biên value", "mpRead": "Profile đang cân bằng",
        "dailyRead": "Đọc nến daily đã đóng", "invalidation": "Đánh giá lại khi giữ ngoài VA",
        "scenarios": [{"title": "Rotation", "condition": "Thử biên VA", "action": "Quan sát phản ứng",
                       "invalidation": "Giữ giá ngoài value"}],
        "alerts": [] if scope == "daily" else [{"levelRef": ref, "reason": "Quan sát VAH", "scenario": "Chờ phản ứng giá"}],
    } for scope in snapshot["requestedScopes"]]}


class FakeClient:
    enabled = True

    def __init__(self):
        self.calls = []
        self.fail = False

    def analyze_plan(self, snapshot):
        self.calls.append(snapshot)
        if self.fail:
            raise TimeoutError("test")
        return validate_plans(reports(snapshot), snapshot)


@pytest.fixture()
def setup(tmp_path, monkeypatch):
    cache = CacheStore(tmp_path / "cache.sqlite")
    analyst = AnalystStore(tmp_path / "analyst.sqlite")
    store = MpStore(analyst)
    client = FakeClient()
    engine = AlertEngine(cache)
    planner = MpPlanner(cache, store, client, engine)
    seed(cache, AT)
    monkeypatch.setattr("app.market_profile.planner.now_ms", lambda: AT)
    store.subscribe("user-a", True, AT)
    yield planner, cache, store, client, engine
    analyst.close()
    cache.close()


@pytest.mark.parametrize("instant,start,name", [
    ("2026-10-27T05:30:00", "2026-10-27T05:30:00", "eu"),
    ("2026-11-03T05:30:00", "2026-11-03T05:30:00", "eu"),
    ("2026-10-27T13:00:00", "2026-10-27T13:00:00", "us"),
    ("2026-11-03T13:00:00", "2026-11-03T13:00:00", "us"),
    ("2026-10-27T00:00:00", "2026-10-27T00:00:00", "asia"),
    ("2026-11-03T00:00:00", "2026-11-03T00:00:00", "asia"),
])
def test_session_schedule_stays_fixed_in_utc7_across_us_dst(instant, start, name):
    slot = current_slot(ts(instant))
    assert slot["start"] == ts(start)
    assert slot["name"] == name


@pytest.mark.parametrize("instant", ["2026-10-31T12:00:00", "2026-11-01T22:30:00", "2026-10-27T21:30:00"])
def test_weekend_and_maintenance_are_closed(instant):
    assert current_slot(ts(instant)) is None


def test_session_gaps_overlap_and_us_crossing_midnight():
    assert current_slot(ts("2026-10-27T05:00:00")) is None  # 12:00
    assert current_slot(ts("2026-10-27T05:29:59")) is None
    overlap = active_slots(ts("2026-10-27T13:00:00"))
    assert [s["name"] for s in overlap] == ["eu", "us"]
    assert overlap[0]["end"] == ts("2026-10-27T15:00:00") - 1
    assert current_slot(ts("2026-10-27T20:59:59"))["tradeDate"] == "2026-10-27"
    assert current_slot(ts("2026-10-27T21:00:00")) is None  # next day 04:00
    assert current_slot(ts("2026-11-03T21:00:00")) is None  # fixed even after DST
    assert current_slot(ts("2026-10-27T00:00:00"))["id"].endswith(PLANNER_VERSION)


@pytest.mark.parametrize("scope,instant,previous_close", [
    ("asia", "2026-10-27T00:02:00", 100.8),
    ("eu", "2026-10-27T05:32:00", 101.2),
    ("us", "2026-10-27T13:02:00", 100.4),
])
def test_session_open_uses_same_session_close_and_previous_us_value(setup, scope, instant, previous_close):
    _, cache, _, _, _ = setup
    at = ts(instant)
    previous = trading_days(at, 2)[0]
    for window, close in zip(session_windows(previous), (100.8, 101.2, 100.4)):
        cache.upsert_bar(bar(window["start"], close=101))
        cache.upsert_bar(bar(window["end"] + 1 - 60_000, close=close))
    slot = current_slot(at)
    cache.upsert_bar(bar(slot["start"], low=101, high=103, close=102))
    # Future high/close from the next session must never enter these anchors.
    cache.upsert_bar(bar(at + 60_000, low=9000, high=9999))
    snapshot = build_snapshot(cache, at, [])
    opening = snapshot["openingContext"]
    assert opening["session"] == scope
    assert opening["sessionOpen"] == 101
    assert opening["previousSameSession"]["close"] == previous_close
    assert opening["previousSameSession"]["tradeDate"] == "2026-10-26"
    assert opening["openingGapVsPreviousSessionClose"] == round(101 - previous_close, 2)
    assert opening["previousUsSession"]["close"] == 100.4
    us = snapshot["previousSessions"]["us"]
    assert us["volume"]["rows"]
    assert opening["openVsPreviousUsValue"] == "inside_value"
    assert all(row[0] < 9000 for row in us["volume"]["rows"])
    assert snapshot["levels"][opening["previousSameSession"]["levelRefs"]["close"]]["price"] == previous_close


def test_missing_end_bar_is_not_reported_as_a_session_close(setup):
    _, cache, _, _, _ = setup
    at = ts("2026-10-27T00:02:00")
    for window in session_windows(trading_days(at, 2)[0]):
        cache.upsert_bar(bar(window["start"]))
    snapshot = build_snapshot(cache, at, [])
    assert snapshot["openingContext"]["previousSameSession"]["close"] is None
    assert snapshot["openingContext"]["openingGapVsPreviousSessionClose"] is None
    assert any("exact session close missing" in q for q in snapshot["dataQuality"])


def test_live_open_is_available_before_the_first_ib_bar_closes(setup, monkeypatch):
    _, cache, _, _, _ = setup
    at = ts("2026-10-27T00:00:10")
    start = current_slot(at)["start"]
    monkeypatch.setattr("app.models.timestamp.now_ms", lambda: at)
    cache.upsert_bar(bar(start, low=101, high=103, close=102, closed=False))
    snapshot = build_snapshot(cache, at, [])
    assert snapshot["openingContext"]["sessionOpen"] == 101
    asia = next(s for s in snapshot["sessions"] if s["name"] == "asia")
    assert not asia["initialBalance"]["complete"]
    assert asia["initialBalance"]["ohlcv"] is None


def test_tpo_counts_poc_value_and_single_prints():
    start = ts("2026-10-26T22:00:00")
    result = tpo_profile([
        bar(start, 100, 101), bar(start + 30 * 60_000, 100.5, 101),
        bar(start + 60 * 60_000, 101, 101.5),
    ], start)
    assert result["rows"] == [[100, 1], [100.5, 2], [101, 3], [101.5, 1]]
    assert (result["poc"], result["val"], result["vah"]) == (101, 100.5, 101)
    assert result["singlePrintRanges"] == [[100, 100], [101.5, 101.5]]


def test_snapshot_has_distributions_twenty_daily_candles_and_no_future(setup):
    _, cache, _, _, _ = setup
    cache.upsert_bar(bar(AT, low=9000, high=9999))
    cache.upsert_bar(bar(AT + 60_000, low=9000, high=9999))
    day_start = trading_days(AT, 1)[0]["start"]
    cache.upsert_bar(bar(day_start, low=9000, high=9999, tf="1D"))
    snapshot = build_snapshot(cache, AT, [])
    assert len(snapshot["dailyCandles"]) == 20
    assert all(b["high"] < 9000 for b in snapshot["dailyCandles"])
    assert len([p for p in snapshot["profiles"] if not p["developing"]]) == 5
    assert all(p["ohlcv"]["high"] < 9000 for p in snapshot["profiles"])
    assert all(p["tpo"]["rows"] and p["volume"]["rows"] for p in snapshot["profiles"])
    assert snapshot["primaryValueArea"] == "volume"
    assert snapshot["developingDaily"] is not None


@pytest.mark.parametrize("mutation", ["unknown", "duplicate", "too_many", "scope", "empty"])
def test_llm_output_is_validated_before_creating_alerts(setup, mutation):
    _, cache, _, _, _ = setup
    snapshot = build_snapshot(cache, AT, [])
    snapshot["requestedScopes"] = ["eu"]
    result = reports(snapshot)
    plan = result["plans"][0]
    if mutation == "unknown": plan["alerts"][0]["levelRef"] = "invented"
    if mutation == "duplicate": plan["alerts"] *= 2
    if mutation == "too_many": plan["alerts"] *= 7
    if mutation == "scope": plan["scope"] = "daily"
    if mutation == "empty": plan["dailyRead"] = ""
    with pytest.raises(ValueError):
        validate_plans(result, snapshot)
    assert cache.read_alerts(profile_id=None) == []


def test_slot_claim_survives_refresh_and_new_service_instance(setup):
    planner, cache, store, client, engine = setup
    asyncio.run(planner.run_current(AT))
    asyncio.run(planner.run_current(AT))
    recreated = MpPlanner(cache, store, client, engine)
    asyncio.run(recreated.run_current(AT))
    assert len(client.calls) == 1
    assert {p["scope"] for p in store.plans()} == {"daily", "eu"}
    assert store.run(current_slot(AT)["id"])["status"] == "complete"


def test_three_calls_create_daily_and_three_session_plans(setup, monkeypatch):
    planner, cache, store, client, _ = setup
    for instant in ("2026-10-27T00:05:00", "2026-10-27T05:35:00", "2026-10-27T13:05:00"):
        at = ts(instant)
        monkeypatch.setattr("app.market_profile.planner.now_ms", lambda: at)
        cache.upsert_bar(bar(at - 60_000))
        asyncio.run(planner.run_current(at))
        asyncio.run(planner.run_current(at))
    assert len(client.calls) == 3
    assert {p["scope"] for p in store.plans()} == {"daily", "asia", "eu", "us"}


def test_same_price_daily_session_share_one_alert_and_fire_once_across_restart(setup):
    planner, cache, _, _, engine = setup
    asyncio.run(planner.run_current(AT))
    alerts = cache.read_alerts(profile_id="user-a")
    assert len(alerts) == 1
    rec = alerts[0]
    level = rec.params["level"]
    assert "gcflowpy.xyz/mp?planId=" in rec.params["mpMessage"]
    assert engine.evaluate(MarketContext("GC", "GC", AT + 1, last_price=level - 1)) == []
    events = engine.evaluate(MarketContext("GC", "GC", AT + 2, last_price=level))
    assert len(events) == 1
    planner.sync_alerts(AT + 3)
    reloaded = AlertEngine(cache)
    assert reloaded.evaluate(MarketContext("GC", "GC", AT + 4, last_price=level + 1)) == []
    assert reloaded.evaluate(MarketContext("GC", "GC", AT + 5, last_price=level - 1)) == []
    assert cache.read_alert(rec.id).params["mpFiredAt"] == AT + 2
    assert cache.read_alert_events(rec.id, "user-a") == []
    assert cache.read_alert(rec.id).params["mpDeletedAt"] == AT + 2
    assert next(p for p in planner.response("user-a")["plans"] if p["scope"] == "eu")["alerts"] == []


def test_expiration_and_profile_disable_preserve_manual_alerts(setup):
    planner, cache, _, _, engine = setup
    engine.upsert(Alert("manual", "GC", "price_crosses_level", {"level": 110}, profile_id="user-a"))
    asyncio.run(planner.run_current(AT))
    mp = next(a for a in cache.read_alerts(profile_id="user-a") if a.id.startswith("mp_"))
    planner.subscribe("user-a", False)
    assert not cache.read_alert(mp.id).enabled
    assert cache.read_alert("manual").enabled
    planner.subscribe("user-a", True)
    assert cache.read_alert(mp.id).enabled
    expired = mp.params["mpExpiresAt"] + 1
    assert not engine.evaluate(MarketContext("GC", "GC", expired, last_price=mp.params["level"]))
    assert not cache.read_alert(mp.id).enabled
    assert cache.read_alert("manual") is not None


@pytest.mark.parametrize("state", ["fired", "deleted", "paused"])
def test_reconciliation_clears_legacy_mp_history_including_paused_profiles(setup, state):
    planner, cache, store, client, engine = setup
    asyncio.run(planner.run_current(AT))
    rec = cache.read_alerts(profile_id="user-a")[0]
    if state == "paused":
        planner.subscribe("user-a", False)
    else:
        rec.enabled = False
        rec.params["mpFiredAt" if state == "fired" else "mpDeletedAt"] = AT + 1
        engine.upsert(Alert.from_record(rec))
    engine.upsert(Alert("manual", "GC", "price_crosses_level", {"level": 110}, profile_id="user-a"))
    for alert_id in (rec.id, "manual"):
        cache.insert_alert_event(AlertEventRecord(
            alert_id=alert_id, profile_id="user-a", symbol="GC", contract="GC",
            time=AT + 2, price=110, message="Legacy event",
        ))
    # No LLM call or enabled subscription is required to clean old sessions.
    planner.sync_alerts(ts("2026-10-27T13:00:00"))
    assert cache.read_alert_events(rec.id, "user-a") == []
    assert cache.read_alert(rec.id).params["mpDeletedAt"]
    assert not cache.read_alert(rec.id).enabled
    assert cache.read_alert("manual").enabled
    assert len(cache.read_alert_events("manual", "user-a")) == 1
    assert len(client.calls) == 1


def test_price_engine_retires_eu_alert_at_us_open_without_waiting_for_scheduler(setup):
    planner, cache, _, _, engine = setup
    asyncio.run(planner.run_current(AT))
    rec = cache.read_alerts(profile_id="user-a")[0]
    handoff = ts("2026-10-27T13:00:00")
    assert rec.params["mpExpiresAt"] == handoff
    assert engine.evaluate(MarketContext("GC", "GC", handoff - 1,
                                         last_price=rec.params["level"] - 1)) == []
    assert engine.evaluate(MarketContext("GC", "GC", handoff,
                                         last_price=rec.params["level"])) == []
    assert cache.read_alert(rec.id).params["mpDeletedAt"] == handoff


def test_session_handoff_removes_old_alerts_before_new_llm_read(setup, monkeypatch):
    planner, cache, _, client, _ = setup
    asyncio.run(planner.run_current(AT))
    old = cache.read_alerts(profile_id="user-a")[0]
    at = ts("2026-10-27T13:00:00")
    cache.upsert_bar(bar(at - 60_000))
    monkeypatch.setattr("app.market_profile.planner.now_ms", lambda: at)
    original = client.analyze_plan

    def inspect_during_read(snapshot):
        retired = cache.read_alert(old.id)
        assert not retired.enabled and retired.params["mpDeletedAt"]
        return original(snapshot)

    client.analyze_plan = inspect_during_read
    assert asyncio.run(planner.run_current(at))["status"] == "complete"
    armed = [a for a in cache.read_alerts(profile_id="user-a") if a.enabled]
    assert len(armed) == 1 and armed[0].id != old.id


def test_llm_failure_is_not_retried_and_creates_no_alerts(setup):
    planner, cache, store, client, _ = setup
    client.fail = True
    asyncio.run(planner.run_current(AT))
    asyncio.run(planner.run_current(AT))
    assert len(client.calls) == 1
    assert store.run(current_slot(AT)["id"])["status"] == "failed"
    assert store.plans() == []
    assert cache.read_alerts(profile_id=None) == []


def test_explicit_retry_reopens_only_a_failed_slot(setup):
    planner, _, store, client, _ = setup
    client.fail = True
    asyncio.run(planner.run_current(AT))
    client.fail = False
    assert planner.retry_failed_current()
    assert not planner.retry_failed_current()
    assert store.run(current_slot(AT)["id"])["status"] == "retry_pending"
    asyncio.run(planner.run_current(AT))
    assert store.run(current_slot(AT)["id"])["status"] == "complete"
    assert len(client.calls) == 2
    assert not planner.retry_failed_current()
    asyncio.run(planner.run_current(AT))
    assert len(client.calls) == 2


def test_off_on_queues_failed_slot_once_but_refresh_does_not(setup):
    planner, _, store, client, _ = setup
    client.fail = True
    asyncio.run(planner.run_current(AT))
    planner.response("user-a")
    planner.subscribe("user-a", True)
    assert store.run(current_slot(AT)["id"])["status"] == "failed"
    planner.subscribe("user-a", False)
    planner.subscribe("user-a", True)
    assert store.run(current_slot(AT)["id"])["status"] == "retry_pending"
    client.fail = False
    asyncio.run(planner.run_current(AT))
    assert len(client.calls) == 2


def test_only_one_worker_can_claim_a_queued_retry(setup):
    planner, _, store, client, _ = setup
    client.fail = True
    asyncio.run(planner.run_current(AT))
    assert planner.retry_failed_current()
    assert store.claim(current_slot(AT), AT + 1)
    assert not store.claim(current_slot(AT), AT + 2)


def test_llm_schema_constrains_scopes_and_catalog_levels(setup):
    _, cache, _, _, _ = setup
    snapshot = build_snapshot(cache, AT, [])
    snapshot["requestedScopes"] = ["daily", "eu"]
    captured = {}
    def transport(url, payload, headers, timeout):
        captured.update(payload)
        assert timeout == 300
        return {"output_parsed": reports(snapshot)}
    client = MpLlmClient(api_key="test", model="test", reasoning_effort="xhigh", transport=transport)
    assert len(client.analyze_plan(snapshot)) == 2
    assert captured["reasoning"] == {"effort": "xhigh"}
    assert client.configuration() == {"model": "test", "reasoningEffort": "xhigh"}
    schema = captured["text"]["format"]["schema"]["properties"]["plans"]
    assert schema["minItems"] == schema["maxItems"] == 2
    assert schema["items"]["properties"]["scope"]["enum"] == ["daily", "eu"]
    assert schema["items"]["properties"]["alerts"]["items"]["properties"]["levelRef"]["enum"] == list(snapshot["levels"])
    assert schema["items"]["properties"]["alerts"]["maxItems"] == 2
    properties = schema["items"]["properties"]
    for key in ("summary", "mpRead", "dailyRead", "invalidation"):
        assert properties[key] == {"type": "string"}
    for field in properties["scenarios"]["items"]["properties"].values():
        assert field == {"type": "string"}
    for key in ("reason", "scenario"):
        assert properties["alerts"]["items"]["properties"][key] == {"type": "string"}


@pytest.mark.parametrize("path", [
    ("summary",), ("mpRead",), ("dailyRead",), ("invalidation",),
    ("scenarios", 0, "title"), ("scenarios", 0, "condition"),
    ("scenarios", 0, "action"), ("scenarios", 0, "invalidation"),
    ("alerts", 0, "reason"), ("alerts", 0, "scenario"),
])
@pytest.mark.parametrize("embedded", [False, True])
def test_internal_level_codes_cannot_be_saved_as_report_prose(setup, path, embedded):
    _, cache, _, _, _ = setup
    snapshot = build_snapshot(cache, AT, [])
    snapshot["requestedScopes"] = ["eu"]
    result = reports(snapshot)
    target = result["plans"][0]
    for key in path[:-1]:
        target = target[key]
    ref = next(iter(snapshot["levels"]))
    target[path[-1]] = f"Watch the level {ref} today" if embedded else ref
    with pytest.raises(ValueError, match="internal level references"):
        validate_plans(result, snapshot)
    assert cache.read_alerts(profile_id=None) == []


def test_report_requires_analysis_and_correction_preserves_alert_selection(setup):
    _, cache, _, _, _ = setup
    snapshot = build_snapshot(cache, AT, [])
    snapshot["requestedScopes"] = ["eu"]
    result = reports(snapshot)
    result["plans"][0]["summary"] = "VAH"
    with pytest.raises(ValueError, match="narrative analysis"):
        validate_plans(result, snapshot)
    result = reports(snapshot)
    snapshot["fixedAlertsByScope"] = {"eu": []}
    with pytest.raises(ValueError, match="existing alert levels"):
        validate_plans(result, snapshot)


def test_daily_has_no_alerts_and_session_may_choose_zero(setup):
    _, cache, _, _, _ = setup
    snapshot = build_snapshot(cache, AT, [])
    snapshot["requestedScopes"] = ["daily", "eu"]
    result = reports(snapshot)
    result["plans"][0]["alerts"] = copy.deepcopy(result["plans"][1]["alerts"])
    with pytest.raises(ValueError, match="no daily alerts"):
        validate_plans(result, snapshot)
    result = reports(snapshot)
    result["plans"][1]["alerts"] = []
    assert all(not p["alerts"] for p in validate_plans(result, snapshot))


def test_alerts_cannot_duplicate_one_price_using_different_catalog_refs(setup):
    _, cache, _, _, _ = setup
    snapshot = build_snapshot(cache, AT, [])
    snapshot["requestedScopes"] = ["eu"]
    result = reports(snapshot)
    alert = result["plans"][0]["alerts"][0]
    other = next(ref for ref, level in snapshot["levels"].items()
                 if ref != alert["levelRef"] and level["price"] == snapshot["levels"][alert["levelRef"]]["price"])
    result["plans"][0]["alerts"].append({**alert, "levelRef": other})
    with pytest.raises(ValueError, match="one representative"):
        validate_plans(result, snapshot)


@pytest.mark.parametrize("failed", [False, True])
def test_us_handoff_keeps_eu_context_and_never_accumulates_armed_alerts(setup, monkeypatch, failed):
    planner, cache, store, client, _ = setup
    asyncio.run(planner.run_current(AT))
    eu = next(p for p in store.plans() if p["scope"] == "eu")
    old_id = cache.read_alerts(profile_id="user-a")[0].id
    at = ts("2026-10-27T13:05:00")
    cache.upsert_bar(bar(at - 60_000))
    monkeypatch.setattr("app.market_profile.planner.now_ms", lambda: at)
    original = client.analyze_plan
    def us_reports(snapshot):
        result = {"plans": original(snapshot)}
        ref = next(r for r in snapshot["levels"] if r.endswith(":volume:val"))
        result["plans"][0]["alerts"][0]["levelRef"] = ref
        return validate_plans(result, snapshot)
    client.analyze_plan = us_reports
    client.fail = failed
    asyncio.run(planner.run_current(at))
    active = planner._alert_plans(at)
    assert ([p["scope"] for p in active.values()]) == ([] if failed else ["us"])
    assert len([a for a in cache.read_alerts(profile_id="user-a") if a.enabled]) == (0 if failed else 1)
    response = planner.response("user-a")
    old = next(p for p in response["plans"] if p["id"] == eu["id"])
    assert not old["expired"]  # EU remains open to 22:00, independent of US.
    assert old["alerts"] == []
    assert cache.read_alert(old_id).params["mpDeletedAt"]
    assert cache.read_alert_events(old_id, "user-a") == []
    with pytest.raises(ValueError, match="removed"):
        planner.toggle_alert("user-a", old_id, True)


def test_correcting_reports_preserves_fired_alerts_and_archives_old_prose(setup):
    planner, cache, store, client, engine = setup
    asyncio.run(planner.run_current(AT))
    before = store.plans()
    rec = cache.read_alerts(profile_id="user-a")[0]
    level = rec.params["level"]
    engine.evaluate(MarketContext("GC", "GC", AT + 1, last_price=level - 1))
    engine.evaluate(MarketContext("GC", "GC", AT + 2, last_price=level))
    corrections = validate_plans(reports(client.calls[0]), client.calls[0])
    for report in corrections:
        report["summary"] = "Updated analysis of the current value area"
        for alert in report["alerts"]:
            alert["reason"] = "Updated explanation for this observation level"
        report["id"] = "must-not-replace-plan-id"
        report["asOf"] = AT + 1000
    store.repair_reports(current_slot(AT)["id"], corrections, AT + 3)
    planner.sync_alerts(AT + 4)
    after = store.plans()
    for old, new in zip(before, after):
        assert new["summary"] == "Updated analysis of the current value area"
        assert new["revisedAt"] == AT + 3
        for key in ("id", "runId", "asOf", "expiresAt", "createdAt", "scope"):
            assert old[key] == new[key]
    revisions = store._rows("SELECT plan_id,previous_payload FROM mp_plan_revisions")
    assert {r["plan_id"] for r in revisions} == {p["id"] for p in before}
    assert len(revisions) == 2
    alert = cache.read_alert(rec.id)
    assert len(cache.read_alerts(profile_id="user-a")) == 1
    assert not alert.enabled
    assert alert.params["mpFiredAt"] == AT + 2
    assert alert.params["mpDeletedAt"] == AT + 2
    assert cache.read_alert_events(rec.id, "user-a") == []
    assert next(p for p in planner.response("user-a")["plans"] if p["scope"] == "eu")["alerts"] == []


@pytest.mark.parametrize("mutation", ["scope", "level", "price"])
def test_invalid_correction_is_atomic_and_preserves_existing_reports(setup, mutation):
    planner, _, store, client, _ = setup
    asyncio.run(planner.run_current(AT))
    before = store.plans()
    corrections = validate_plans(reports(client.calls[0]), client.calls[0])
    corrections[0]["summary"] = "This first update must be rolled back"
    if mutation == "scope":
        corrections[-1]["scope"] = "us"
    elif mutation == "level":
        corrections[-1]["alerts"][0]["levelRef"] = "different-ref"
    else:
        corrections[-1]["alerts"][0]["price"] += 1
    with pytest.raises(ValueError, match="Report correction"):
        store.repair_reports(current_slot(AT)["id"], corrections, AT + 3)
    assert store.plans() == before
    assert store._rows("SELECT * FROM mp_plan_revisions") == []


def test_missing_linked_alert_is_restored_disabled_without_repeating_llm(setup):
    planner, cache, store, client, engine = setup
    asyncio.run(planner.run_current(AT))
    previous = cache.read_alerts(profile_id="user-a")[0]
    engine.delete(previous.id)
    assert cache.read_alert(previous.id) is None
    planner.sync_alerts(AT + 1)
    restored = cache.read_alert(previous.id)
    assert restored is not None and not restored.enabled
    assert restored.params["mpRecoveredMissing"]
    assert restored.params["mpDeletedAt"] == AT + 1
    assert restored.params["level"] == previous.params["level"]
    assert len(cache.read_alerts(profile_id="user-a")) == 1
    assert len(client.calls) == 1
    assert len(store.links("user-a")) == 1
    assert engine.evaluate(MarketContext("GC", "GC", AT + 2, last_price=restored.params["level"])) == []
    with pytest.raises(ValueError, match="removed"):
        planner.toggle_alert("user-a", previous.id, True)


@pytest.mark.parametrize("state", ["armed", "fired", "paused"])
@pytest.mark.parametrize("live_engine", [True, False])
def test_chart_delete_removes_mp_alert_and_history_without_recreation(setup, state, live_engine):
    planner, cache, store, client, engine = setup
    asyncio.run(planner.run_current(AT))
    managed = cache.read_alerts(profile_id="user-a")[0]
    level = managed.params["level"]
    if state == "fired":
        engine.evaluate(MarketContext("GC", "GC", AT + 1, last_price=level - 1))
        assert len(engine.evaluate(MarketContext("GC", "GC", AT + 2, last_price=level))) == 1
    elif state == "paused":
        planner.subscribe("user-a", False)
        assert cache.read_alert(managed.id).params["mpPaused"]
    events = cache.read_alert_events(managed.id, "user-a")
    engine.upsert(Alert("manual", "GC", "price_crosses_level", {"level": 110}, profile_id="user-a"))
    app = create_app(lifespan=False)
    app.dependency_overrides[get_alert_cache] = lambda: cache
    if live_engine:
        app.state.runtime = SimpleNamespace(pipeline=SimpleNamespace(alert_engine=engine))
    with TestClient(app) as http:
        path = f"/api/alerts/{managed.id}?profileId=user-a"
        assert http.delete(f"/api/alerts/{managed.id}?profileId=user-b").status_code == 404
        assert http.delete(path).status_code == 204
        assert http.delete(path).status_code == 204
        deleted = cache.read_alert(managed.id)
        assert not deleted.enabled
        assert deleted.params["mpDeletedAt"]
        assert "mpPaused" not in deleted.params
        if live_engine:
            assert not next(a for a in engine.alerts() if a.id == managed.id).enabled
        assert [a["id"] for a in http.get("/api/alerts?profileId=user-a").json()["alerts"]] == ["manual"]
        assert http.patch(path, json={"enabled": True}).status_code == 404

        # Refresh, global off/on, and restarting both services must keep it gone.
        planner.subscribe("user-a", False)
        planner.subscribe("user-a", True)
        reloaded = AlertEngine(cache)
        recreated = MpPlanner(cache, store, client, reloaded)
        recreated.sync_alerts(AT + 3)
        response = recreated.response("user-a")
        assert next(p for p in response["plans"] if p["scope"] == "eu")["alerts"] == []
        assert len(cache.read_alerts(profile_id="user-a")) == 2
        assert [a["id"] for a in http.get("/api/alerts?profileId=user-a").json()["alerts"]] == ["manual"]
        assert reloaded.evaluate(MarketContext("GC", "GC", AT + 4, last_price=level - 1)) == []
        assert reloaded.evaluate(MarketContext("GC", "GC", AT + 5, last_price=level)) == []
        assert cache.read_alert_events(managed.id, "user-a") == []
        assert len(client.calls) == 1
        assert len(store.links("user-a")) == 1
        assert http.delete("/api/alerts/manual?profileId=user-a").status_code == 204
        assert cache.read_alert("manual") is None

        with pytest.raises(ValueError, match="removed"):
            recreated.toggle_alert("user-a", managed.id, True)


def test_error_text_is_actionable_and_does_not_expose_provider_body():
    assert "kịp thời" in _analysis_error_message(TimeoutError("timed out"))
    message = _analysis_error_message(ValueError("OpenAI API error: secret-test-body"))
    assert "secret-test-body" not in message
    assert "Thử lại phiên này" in message


def test_api_uses_authenticated_profile_and_get_never_calls_llm(setup):
    planner, _, _, client, _ = setup
    app = create_app(lifespan=False)
    app.state.mp_planner = planner
    with TestClient(app) as http:
        assert http.get("/api/mp/plans").status_code == 401
        app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser("user-b", "B")
        response = http.get("/api/mp/plans?profileId=user-a")
        assert response.status_code == 200
        assert response.json()["settings"]["profileId"] == "user-b"
        assert not response.json()["settings"]["enabled"]
        assert http.post("/api/mp/plans/run").status_code == 409
        assert client.calls == []


def test_backend_sends_mp_telegram_even_when_a_browser_is_connected():
    runtime = SimpleNamespace(
        _registry=SimpleNamespace(client_count=2), _send_web_push_safely=AsyncMock(),
        _send_alert_text_safely=AsyncMock(), _enqueue=AsyncMock(),
    )
    event = AlertEvent("mp_test", "price_crosses_level", "GC", "GC", AT, 100, "MP")
    asyncio.run(Pipeline._emit_alerts(runtime, [event]))
    runtime._send_alert_text_safely.assert_awaited_once_with(event)


def test_alert_only_mp_socket_does_not_suppress_manual_telegram_fallback():
    registry = WebSocketRegistry()
    asyncio.run(registry.register(ChartClient("mp", lambda _: None)))
    asyncio.run(registry.subscribe("mp", "GC", ["alert_event"]))
    assert registry.client_count == 1
    assert registry.alert_delivery_client_count == 0
    runtime = SimpleNamespace(
        _registry=registry, _send_web_push_safely=AsyncMock(),
        _send_alert_text_safely=AsyncMock(), _enqueue=AsyncMock(),
    )
    event = AlertEvent("manual", "price_crosses_level", "GC", "GC", AT, 100, "Manual")
    asyncio.run(Pipeline._emit_alerts(runtime, [event]))
    runtime._send_alert_text_safely.assert_awaited_once_with(event)


def test_alert_registration_can_recover_without_repeating_llm(setup, monkeypatch):
    planner, cache, store, client, engine = setup
    original = engine.upsert
    monkeypatch.setattr(engine, "upsert", lambda _: (_ for _ in ()).throw(RuntimeError("temporary")))
    with pytest.raises(RuntimeError):
        asyncio.run(planner.run_current(AT))
    assert store.run(current_slot(AT)["id"])["status"] == "complete"
    assert len(store.plans()) == 2
    monkeypatch.setattr(engine, "upsert", original)
    planner.sync_alerts(AT)
    assert len(cache.read_alerts(profile_id="user-a")) == 1
    asyncio.run(planner.run_current(AT))
    assert len(client.calls) == 1


def test_explicit_refresh_reads_current_data_and_preserves_the_daily_plan(setup, monkeypatch):
    planner, cache, store, client, _ = setup
    asyncio.run(planner.run_current(AT))
    previous = store.plans()
    daily = next(p for p in previous if p["scope"] == "daily")
    old_session = next(p for p in previous if p["scope"] == "eu")
    slot = current_slot(AT)
    later = AT + 120_000
    cache.upsert_bar(bar(later - 60_000, close=101.8))
    monkeypatch.setattr("app.market_profile.planner.now_ms", lambda: later)

    assert planner.refresh_current(slot["id"])
    queued = planner.response("user-a")["run"]
    assert queued["status"] == "retry_pending" and ":refresh:" in queued["id"]
    assert len(client.calls) == 1 and store.plans() == previous
    asyncio.run(planner.run_current(later))
    refreshed = next(p for p in store.plans() if p["scope"] == "eu")
    assert refreshed["id"] != old_session["id"] and refreshed["refreshed"]
    assert refreshed["asOf"] == later and refreshed["expiresAt"] == old_session["expiresAt"]
    assert client.calls[-1]["requestedScopes"] == ["eu"]
    assert client.calls[-1]["asOf"] == later
    assert next(p for p in store.plans() if p["scope"] == "daily") == daily
    assert old_session in store.plans()
    assert planner.response("user-a")["run"]["status"] == "complete"

    # Polling, stale-tab submissions and scheduler ticks never start another read.
    assert not planner.refresh_current(slot["id"])
    asyncio.run(planner.run_current(later))
    assert len(client.calls) == 2


def test_simultaneous_refresh_clicks_queue_one_request(setup):
    planner, _, store, client, _ = setup
    asyncio.run(planner.run_current(AT))
    slot = current_slot(AT)
    with ThreadPoolExecutor(max_workers=4) as pool:
        queued = list(pool.map(lambda _: store.queue_refresh(slot, slot["id"], AT + 1), range(8)))
    assert sum(queued) == 1
    assert len(store._rows("SELECT id FROM mp_runs")) == 2
    asyncio.run(planner.run_current(AT))
    assert len(client.calls) == 2


@pytest.mark.parametrize("state", ["armed", "fired", "disabled", "deleted"])
def test_refresh_preserves_same_session_alert_state(setup, monkeypatch, state):
    planner, cache, store, _, engine = setup
    asyncio.run(planner.run_current(AT))
    original = cache.read_alerts(profile_id="user-a")[0]
    if state == "fired":
        level = original.params["level"]
        engine.evaluate(MarketContext("GC", "GC", AT + 1, last_price=level - 1))
        engine.evaluate(MarketContext("GC", "GC", AT + 2, last_price=level))
    elif state == "disabled":
        engine.set_enabled(original.id, False)
    elif state == "deleted":
        original.enabled = False
        original.params["mpDeletedAt"] = AT + 1
        engine.upsert(Alert.from_record(original))
    events = cache.read_alert_events(original.id, "user-a")
    later = AT + 60_000
    cache.upsert_bar(bar(later - 60_000))
    monkeypatch.setattr("app.market_profile.planner.now_ms", lambda: later)
    assert planner.refresh_current(current_slot(AT)["id"])
    asyncio.run(planner.run_current(later))
    response = planner.response("user-a")
    new_plan = next(p for p in response["plans"] if p["scope"] == "eu")
    if state in ("fired", "deleted"):
        assert new_plan["alerts"] == []
    else:
        assert new_plan["alerts"][0]["alertId"] == original.id
        assert new_plan["alerts"][0]["status"] == state
    assert len(cache.read_alerts(profile_id="user-a")) == 1
    assert cache.read_alert_events(original.id, "user-a") == events


def test_refresh_moves_to_new_levels_without_accumulating_old_alerts(setup, monkeypatch):
    planner, cache, store, client, _ = setup
    asyncio.run(planner.run_current(AT))
    old = cache.read_alerts(profile_id="user-a")[0]
    original_analyze = client.analyze_plan

    def changed_levels(snapshot):
        result = {"plans": original_analyze(snapshot)}
        ref = next(ref for ref, level in snapshot["levels"].items() if level["price"] != old.params["level"])
        result["plans"][0]["alerts"][0] = {"levelRef": ref, "reason": "Updated observation level", "scenario": "Wait for a new reaction"}
        return validate_plans(result, snapshot)

    client.analyze_plan = changed_levels
    later = AT + 60_000
    cache.upsert_bar(bar(later - 60_000))
    monkeypatch.setattr("app.market_profile.planner.now_ms", lambda: later)
    assert planner.refresh_current(current_slot(AT)["id"])
    asyncio.run(planner.run_current(later))
    assert not cache.read_alert(old.id).enabled
    assert len([a for a in cache.read_alerts(profile_id="user-a") if a.enabled]) == 1
    old_plan = next(p for p in planner.response("user-a")["plans"] if p["scope"] == "eu" and not p["refreshed"])
    assert old_plan["alerts"] == []
    assert cache.read_alert(old.id).params["mpDeletedAt"]


def test_failed_refresh_keeps_old_plan_and_retries_only_when_requested(setup, monkeypatch):
    planner, cache, store, client, _ = setup
    asyncio.run(planner.run_current(AT))
    original = store.plans()
    old_alert = cache.read_alerts(profile_id="user-a")[0]
    later = AT + 60_000
    cache.upsert_bar(bar(later - 60_000))
    monkeypatch.setattr("app.market_profile.planner.now_ms", lambda: later)
    assert planner.refresh_current(current_slot(AT)["id"])
    client.fail = True
    asyncio.run(planner.run_current(later))
    assert store.plans() == original and cache.read_alert(old_alert.id).enabled
    assert planner.response("user-a")["run"]["status"] == "failed"
    asyncio.run(planner.run_current(later))
    assert len(client.calls) == 2
    assert planner.retry_failed_current()
    client.fail = False
    asyncio.run(planner.run_current(later))
    assert planner.response("user-a")["run"]["status"] == "complete"
    assert len(client.calls) == 3


def test_refresh_queue_survives_restart_and_reports_waiting_for_fresh_tape(setup, monkeypatch):
    planner, cache, store, client, engine = setup
    asyncio.run(planner.run_current(AT))
    assert planner.refresh_current(current_slot(AT)["id"])
    later = AT + 300_000
    monkeypatch.setattr("app.market_profile.planner.now_ms", lambda: later)
    recreated = MpPlanner(cache, store, client, engine)
    asyncio.run(recreated.run_current(later))
    waiting = recreated.response("user-a")["run"]
    assert waiting["status"] == "waiting" and waiting["error"]
    assert len(client.calls) == 1
    cache.upsert_bar(bar(later - 60_000))
    asyncio.run(recreated.run_current(later))
    assert recreated.response("user-a")["run"]["status"] == "complete"
    assert len(client.calls) == 2


def test_refresh_endpoint_requires_auth_and_only_queues_for_enabled_profiles(setup):
    planner, _, store, client, _ = setup
    asyncio.run(planner.run_current(AT))
    app = create_app(lifespan=False)
    app.state.mp_planner = planner
    slot_id = current_slot(AT)["id"]
    with TestClient(app) as http:
        assert http.post("/api/mp/plans/refresh", json={"expectedRunId": slot_id}).status_code == 401
        app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser("user-b", "B")
        assert http.post("/api/mp/plans/refresh", json={"expectedRunId": slot_id, "profileId": "user-a"}).status_code == 409
        app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser("user-a", "A")
        for body in ({}, {"expectedRunId": True}, {"expectedRunId": ""}):
            assert http.post("/api/mp/plans/refresh", json=body).status_code == 400
        result = http.post("/api/mp/plans/refresh", json={"expectedRunId": slot_id})
        assert result.status_code == 202
        assert result.json()["run"]["status"] == "retry_pending"
        assert http.post("/api/mp/plans/refresh", json={"expectedRunId": slot_id}).json()["run"]["id"] == result.json()["run"]["id"]
        assert len(client.calls) == 1
