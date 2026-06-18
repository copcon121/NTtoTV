import json
import re

import pytest

from app.analyst.event_provider import LlmAnalystEventProvider, MockAnalystEventProvider


def _snapshot(
    event_type="price_entered_poi",
    *,
    side="demand",
    h1="bullish",
    m15="bullish",
    bias_aligned=True,
):
    return {
        "eventType": event_type,
        "activePoi": {
            "timeframe": "M5",
            "side": side,
            "kind": "fvg",
            "top": 101.0,
            "bottom": 100.0,
            "pdZone": "discount" if side == "demand" else "premium",
            "biasAligned": bias_aligned,
        },
        "confluence": {"level": "moderate"},
        "triggerEvidence": {
            "priceEnteredZone": True,
            "currentPrice": 100.5,
            "priceSource": "latest_price_probe",
        },
        "h1Context": {
            "structureMap": {"external": {"structure": h1}},
        },
        "m15Context": {
            "structureMap": {"external": {"structure": m15}},
        },
        "m5Context": {
            "structureMap": {"external": {"structure": h1}},
        },
    }


@pytest.mark.unit
def test_mock_provider_waits_for_buy_context_without_m1_trigger():
    report = MockAnalystEventProvider().analyze(_snapshot())

    assert report["decision"] == "wait_for_buy"
    assert report["riskState"] == "wait"
    assert report["allowedToAlert"] is True
    assert report["allowedToAutoTrade"] is False
    assert "m1" not in report["structureRead"]


@pytest.mark.unit
def test_mock_provider_no_trade_when_poi_not_bias_aligned():
    report = MockAnalystEventProvider().analyze(_snapshot(bias_aligned=False))

    assert report["decision"] == "no_trade"
    assert report["riskState"] == "no_trade"
    assert report["allowedToAlert"] is False


@pytest.mark.unit
def test_mock_provider_waits_for_sell_context():
    report = MockAnalystEventProvider().analyze(
        _snapshot(side="supply", h1="bearish", m15="bearish")
    )

    assert report["decision"] == "wait_for_sell"
    assert report["riskState"] == "wait"
    assert report["allowedToAlert"] is True
    assert report["allowedToAutoTrade"] is False


@pytest.mark.unit
def test_mock_provider_invalidated_is_no_trade():
    report = MockAnalystEventProvider().analyze(_snapshot("poi_invalidated"))

    assert report["decision"] == "no_trade"
    assert report["riskState"] == "no_trade"
    assert report["allowedToAutoTrade"] is False


@pytest.mark.unit
def test_llm_event_provider_uses_structured_snapshot_payload_without_m1_context():
    calls = []

    def transport(url, payload, headers, timeout_s):
        calls.append((url, payload, headers, timeout_s))
        schema = payload["text"]["format"]["schema"]
        assert schema["properties"]["eventType"]["enum"] == [
            "poi_invalidated",
            "price_entered_poi",
        ]
        assert schema["properties"]["decision"]["enum"] == [
            "no_trade",
            "wait_for_buy",
            "wait_for_sell",
        ]
        assert schema["properties"]["riskState"]["enum"] == ["no_trade", "wait"]
        structure_schema = schema["properties"]["structureRead"]
        assert structure_schema["required"] == ["h1", "m15", "m5"]
        assert "m1" not in structure_schema["properties"]
        assert "m1Context" not in payload["input"][1]["content"]
        assert "latest_m1_close" not in payload["input"][1]["content"]
        assert "manual_m1" not in payload["input"][1]["content"]
        return {
            "output_parsed": {
                "bias": "bullish",
                "decision": "buy_candidate",
                "confidence": 0.64,
                "eventType": "price_entered_poi",
                "activePoiSummary": "M5 demand FVG 100.0-101.0",
                "structureRead": {
                    "h1": "H1 bullish.",
                    "m15": "M15 bullish.",
                    "m5": "M5 demand touched.",
                },
                "reason": ["Giá vừa vào demand POI.", "M1 CHoCH bullish."],
                "invalidIf": "Giá phá xuống dưới POI.",
                "nextConfirmation": "Trader tự timing M1.",
                "riskState": "candidate",
                "allowedToAlert": False,
                "allowedToAutoTrade": True,
            }
        }

    provider = LlmAnalystEventProvider(
        api_key="test-key",
        model="cx/gpt-5.5",
        base_url="http://proxy.local/v1",
        reasoning_effort="high",
        transport=transport,
    )

    report = provider.analyze(_snapshot())

    assert report["decision"] == "wait_for_buy"
    assert report["riskState"] == "wait"
    assert report["allowedToAlert"] is True
    assert report["allowedToAutoTrade"] is False
    assert not re.search(
        r"\b(?:M1|1m)\b",
        json.dumps(report, ensure_ascii=False),
        re.IGNORECASE,
    )
    assert calls[0][0] == "http://proxy.local/v1/responses"
    assert calls[0][2]["Authorization"] == "Bearer test-key"
    assert calls[0][1]["input"][1]["content"].startswith('{"event_snapshot":')
    assert calls[0][1]["reasoning"] == {"effort": "high"}


@pytest.mark.unit
def test_llm_event_provider_requires_key():
    provider = LlmAnalystEventProvider(
        api_key="",
        model="cx/gpt-5.5",
        transport=lambda *_: {},
    )

    with pytest.raises(ValueError, match="not configured"):
        provider.analyze(_snapshot())


@pytest.mark.unit
def test_llm_event_provider_normalizes_proxy_schema_drift():
    def transport(url, payload, headers, timeout_s):
        return {
            "output_parsed": {
                "bias": {"H1": "unknown"},
                "decision": "not_a_decision",
                "confidence": None,
                "eventType": "price_entered_poi",
                "activePoiSummary": "M5 demand FVG",
                "structureRead": {},
                "reason": [],
                "invalidIf": "Price breaks POI.",
                "nextConfirmation": "Wait.",
                "riskState": "bad",
                "allowedToAlert": False,
                "allowedToAutoTrade": True,
            }
        }

    provider = LlmAnalystEventProvider(
        api_key="test-key",
        model="cx/gpt-5.5",
        transport=transport,
    )

    report = provider.analyze(_snapshot())

    assert report["bias"] == "bullish"
    assert report["decision"] == "wait_for_buy"
    assert report["confidence"] == 0.35
    assert report["riskState"] == "wait"
    assert report["allowedToAlert"] is True
    assert report["reason"]
    assert report["allowedToAutoTrade"] is False
