import json
from dataclasses import replace

import pytest

from app.analyst.poi_models import PoiZone
from app.analyst.poi_scanner import PoiScanner
from app.analyst.store import AnalystStore
from app.storage.cache_store import CacheStore
from app.storage.records import BarRecord


class CountingProvider:
    def __init__(self, *, name="counting", mode="mock"):
        self.name = name
        self.mode = mode
        self.calls = 0
        self.snapshots = []

    def analyze(self, snapshot):
        self.calls += 1
        self.snapshots.append(snapshot)
        return {
            "bias": "unknown",
            "decision": "no_trade",
            "confidence": 0.25,
            "eventType": snapshot["eventType"],
            "activePoiSummary": "mock",
            "structureRead": {"h1": "mock", "m15": "mock", "m5": "mock"},
            "reason": ["Mock provider."],
            "invalidIf": "Mock invalidation.",
            "nextConfirmation": "Mock confirmation.",
            "riskState": "no_trade",
            "allowedToAlert": False,
            "allowedToAutoTrade": False,
        }


@pytest.fixture()
def scanner_env(tmp_path):
    cache = CacheStore(tmp_path / "app.sqlite")
    store = AnalystStore(tmp_path / "analyst.sqlite")
    provider = CountingProvider()
    scanner = PoiScanner(
        cache=cache,
        store=store,
        provider=provider,
        symbol="GC",
        contract="GC",
        cooldown_seconds=1800,
    )
    try:
        yield cache, store, provider, scanner
    finally:
        store.close()
        cache.close()


def _bar(tf, index, open_, high, low, close, volume=1):
    return BarRecord(
        symbol="GC",
        contract="GC",
        timeframe=tf,
        time=index * 60_000,
        open=open_,
        high=high,
        low=low,
        close=close,
        volume=volume,
        closed=True,
    )


def _m1_inside_bars():
    return [_bar("1m", 1, 100.4, 100.8, 100.2, 100.5, volume=10)]


def _zone(
    zone_id,
    *,
    timeframe="M5",
    side="demand",
    kind="fvg",
    top=101.0,
    bottom=100.0,
    pd_zone="discount",
    bias_aligned=True,
    distance_to_price=0.0,
    contains_price=True,
    status="active",
    created_at=1000,
):
    return PoiZone(
        zone_id=zone_id,
        symbol="GC",
        contract="GC",
        timeframe=timeframe,
        side=side,
        kind=kind,
        top=top,
        bottom=bottom,
        mid=(top + bottom) / 2,
        created_at=created_at,
        status=status,
        pd_zone=pd_zone,
        bias_aligned=bias_aligned,
        distance_to_price=distance_to_price,
        contains_price=contains_price,
    )


def _patch_scanner_inputs(monkeypatch, *, zones_by_label, structures=None):
    structures = structures or {"H1": "bullish", "M15": "bullish", "M5": "bullish"}

    def fake_structure(label, bars):
        return {
            "timeframe": label,
            "structureMap": {
                "external": {"enabled": True, "structure": structures[label]},
                "internal": {"enabled": False},
            },
            "breakEvents": {},
        }

    def fake_poi_zones(**kwargs):
        label = kwargs["timeframe"]
        return list(zones_by_label.get(label, [])), {
            "currentZone": "discount",
            "preferredEntryZone": "discount",
        }

    monkeypatch.setattr("app.analyst.poi_scanner.build_htf_structure_map", fake_structure)
    monkeypatch.setattr("app.analyst.poi_scanner.build_poi_zones", fake_poi_zones)


@pytest.mark.unit
def test_scanner_creates_event_only_from_best_m5_poi(scanner_env, monkeypatch):
    cache, store, provider, scanner = scanner_env
    cache.upsert_bars(_m1_inside_bars())
    h1_zone = _zone("h1", timeframe="H1")
    m15_zone = _zone("m15", timeframe="M15")
    weaker_m5 = _zone(
        "m5-fvg",
        kind="fvg",
        distance_to_price=0.0,
        created_at=1000,
    )
    better_m5 = _zone(
        "m5-ob",
        kind="ob",
        distance_to_price=0.0,
        created_at=900,
    )
    _patch_scanner_inputs(
        monkeypatch,
        zones_by_label={
            "H1": [h1_zone],
            "M15": [m15_zone],
            "M5": [weaker_m5, better_m5],
        },
    )

    events = scanner.process_once(snapshot_time=10_000)

    assert len(events) == 1
    assert events[0].event_type == "price_entered_poi"
    assert events[0].input_snapshot["activePoi"]["timeframe"] == "M5"
    assert events[0].input_snapshot["activePoi"]["kind"] == "ob"
    assert "m1Context" not in events[0].input_snapshot
    assert events[0].input_snapshot["triggerEvidence"]["priceSource"] == "latest_price_probe"
    assert events[0].input_snapshot["decisionContext"]["timing"] == "manual_entry"
    assert provider.calls == 1
    assert provider.snapshots[0]["activePoi"]["zoneId"] == "m5-ob"
    assert all(zone.timeframe == "M5" for zone in store.poi_zones())
    assert all(event.allowed_to_auto_trade is False for event in events)


@pytest.mark.unit
def test_scanner_filters_out_h1_m15_structure_conflict(scanner_env, monkeypatch):
    cache, store, provider, scanner = scanner_env
    cache.upsert_bars(_m1_inside_bars())
    _patch_scanner_inputs(
        monkeypatch,
        structures={"H1": "bullish", "M15": "bearish", "M5": "bullish"},
        zones_by_label={"M5": [_zone("m5-demand")]},
    )

    events = scanner.process_once(snapshot_time=10_000)

    assert events == []
    assert provider.calls == 0
    assert store.poi_events() == []


@pytest.mark.unit
def test_scanner_filters_wrong_side_and_non_aligned_poi(scanner_env, monkeypatch):
    cache, store, provider, scanner = scanner_env
    cache.upsert_bars(_m1_inside_bars())
    wrong_side = _zone(
        "m5-supply",
        side="supply",
        pd_zone="premium",
        bias_aligned=True,
    )
    not_aligned = _zone("m5-demand-not-aligned", bias_aligned=False)
    _patch_scanner_inputs(
        monkeypatch,
        zones_by_label={"M5": [wrong_side, not_aligned]},
    )

    events = scanner.process_once(snapshot_time=10_000)

    assert events == []
    assert provider.calls == 0
    assert store.poi_events() == []


@pytest.mark.unit
def test_scanner_does_not_call_provider_when_no_poi(scanner_env, monkeypatch):
    cache, store, provider, scanner = scanner_env
    cache.upsert_bars(_m1_inside_bars())
    _patch_scanner_inputs(monkeypatch, zones_by_label={})

    events = scanner.process_once(snapshot_time=10_000)

    assert events == []
    assert provider.calls == 0
    assert store.poi_events() == []


@pytest.mark.unit
def test_scanner_applies_symbol_cooldown_across_different_pois(tmp_path, monkeypatch):
    cache = CacheStore(tmp_path / "app.sqlite")
    store = AnalystStore(tmp_path / "analyst.sqlite")
    provider = CountingProvider(name="real", mode="real")
    scanner = PoiScanner(
        cache=cache,
        store=store,
        provider=provider,
        symbol="GC",
        contract="GC",
        cooldown_seconds=1800,
    )
    try:
        cache.upsert_bars(_m1_inside_bars())
        _patch_scanner_inputs(
            monkeypatch,
            zones_by_label={"M5": [_zone("m5-first")]},
        )
        first = scanner.process_once(snapshot_time=10_000)
        assert first
        assert provider.calls == 1

        _patch_scanner_inputs(
            monkeypatch,
            zones_by_label={"M5": [_zone("m5-second", created_at=2_000)]},
        )
        second = scanner.process_once(snapshot_time=20_000)

        assert second == []
        assert provider.calls == 1
        assert len(store.poi_events()) == 1
    finally:
        store.close()
        cache.close()


@pytest.mark.unit
def test_scanner_uses_real_provider_only_when_profile_enabled(tmp_path, monkeypatch):
    cache = CacheStore(tmp_path / "app.sqlite")
    store = AnalystStore(tmp_path / "analyst.sqlite")
    mock = CountingProvider(name="mock", mode="mock")
    real = CountingProvider(name="real", mode="real")
    sent_messages = []

    def fake_send(config, *, message, screenshot_data_url=None):
        sent_messages.append(message)
        return {"ok": True}

    monkeypatch.setattr("app.rest.notifications._send_telegram", fake_send)
    _patch_scanner_inputs(
        monkeypatch,
        zones_by_label={"M5": [_zone("m5-demand")]},
    )
    scanner = PoiScanner(
        cache=cache,
        store=store,
        provider=mock,
        real_provider=real,
        symbol="GC",
        contract="GC",
        cooldown_seconds=0,
    )
    try:
        cache.upsert_bars(_m1_inside_bars())

        first = scanner.process_once(snapshot_time=10_000)
        assert first
        assert mock.calls == 1
        assert real.calls == 0

        store.set_event_ai_enabled("user_1", "desk", True)
        cache.set_metadata(
            "notification.telegram.desk",
            json.dumps(
                {
                    "enabled": True,
                    "botToken": "123:secret",
                    "chatId": "456",
                    "sendScreenshot": False,
                },
                separators=(",", ":"),
            ),
            1,
        )
        for zone in store.poi_zones():
            store.upsert_poi_zone(
                replace(
                    zone,
                    status="active",
                    touch_count=0,
                    last_touched_at=None,
                    last_state_change_at=None,
                    last_event_at=None,
                )
            )
        second = scanner.process_once(snapshot_time=20_000)

        assert second
        assert real.calls == 1
        assert any(event.provider_mode == "real" for event in second)
        assert any("AI POI scanner GC GC" in message for message in sent_messages)
    finally:
        store.close()
        cache.close()
