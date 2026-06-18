import json
import re

import pytest

from app.analyst.llm_client import (
    AnalystLlmClient,
    normalize_reasoning_effort,
    report_from_llm_payload,
    responses_url_from_base_url,
)
from app.analyst.schemas import MarketStateSnapshot
from app.config import DEFAULT_OPENAI_BASE_URL, Settings


def _snapshot() -> MarketStateSnapshot:
    return MarketStateSnapshot(
        snapshot_id="GC:GC:1",
        symbol="GC",
        contract="GC",
        snapshot_time=1,
        timeframes={},
        decision_context={"allowedToAutoTrade": False},
    )


def _snapshot_missing_cvd() -> MarketStateSnapshot:
    return MarketStateSnapshot(
        snapshot_id="GC:GC:2",
        symbol="GC",
        contract="GC",
        snapshot_time=2,
        timeframes={},
        decision_context={"allowedToAutoTrade": False},
        data_quality=("missing_cvd_M5",),
    )


def _snapshot_with_context(direction: str) -> MarketStateSnapshot:
    bullish = direction == "bullish"
    return MarketStateSnapshot(
        snapshot_id=f"GC:GC:context:{direction}",
        symbol="GC",
        contract="GC",
        snapshot_time=4,
        timeframes={
            "H1": {
                "smc": {
                    "bias": direction,
                    "structure": "external_up" if bullish else "external_down",
                    "lastEvent": "BOS",
                    "lastDirection": direction,
                }
            },
            "M15": {
                "smc": {
                    "bias": direction,
                    "structure": "external_up" if bullish else "external_down",
                    "lastEvent": "BOS",
                    "lastDirection": direction,
                }
            },
            "M5": {
                "smc": {
                    "bias": direction,
                    "structure": "external_up" if bullish else "external_down",
                    "lastEvent": "BOS",
                    "lastDirection": direction,
                }
            }
        },
        decision_context={"allowedToAutoTrade": False},
    )


def _valid_payload(**overrides):
    payload = {
        "bias": "bullish",
        "decision": "wait_for_buy",
        "confidence": 0.62,
        "reason": ["H1 bullish", "M5 context aligned"],
        "invalidIf": "M5 closes below support",
        "nextConfirmation": "Wait for manual timing at the M5 POI",
        "riskState": "wait",
        "allowedToAlert": True,
        "allowedToAutoTrade": True,
    }
    payload.update(overrides)
    return payload


def test_llm_client_disabled_without_api_key_returns_none():
    client = AnalystLlmClient(api_key="", model="gpt-5.5")

    assert client.analyze(_snapshot()) is None


def test_llm_client_sends_structured_outputs_payload_and_forces_no_auto_trade():
    def transport(url, payload, headers, timeout_s):
        assert url == f"{DEFAULT_OPENAI_BASE_URL}/responses"
        assert headers["Authorization"] == "Bearer key"
        assert payload["model"] == "cx/gpt-5.5"
        assert payload["reasoning"] == {"effort": "medium"}
        assert payload["text"]["format"]["type"] == "json_schema"
        assert payload["text"]["format"]["strict"] is True
        schema = payload["text"]["format"]["schema"]
        assert schema["properties"]["bias"]["enum"] == [
            "bearish",
            "bullish",
            "range",
            "unknown",
        ]
        assert schema["properties"]["riskState"]["enum"] == [
            "no_trade",
            "wait",
        ]
        assert schema["properties"]["decision"]["enum"] == [
            "no_trade",
            "wait_for_buy",
            "wait_for_sell",
        ]
        assert schema["properties"]["allowedToAutoTrade"]["const"] is False
        assert schema["properties"]["reason"]["maxItems"] == 5
        assert "footprint" not in payload["input"][1]["content"].lower()
        assert "current market context from H1 down to M5" in payload["input"][0]["content"]
        assert "M1 defines immediate trigger confirmation" not in payload["input"][0]["content"]
        assert '"M1"' not in payload["input"][1]["content"]
        assert "Vietnamese" in payload["input"][0]["content"]
        return {"output_text": json.dumps(_valid_payload())}

    client = AnalystLlmClient(
        api_key="key",
        model="cx/gpt-5.5",
        transport=transport,
    )

    report = client.analyze(_snapshot())

    assert report is not None
    assert report.decision == "wait_for_buy"
    assert report.allowed_to_alert is True
    assert report.allowed_to_auto_trade is False
    assert report.raw_response["allowedToAutoTrade"] is False


def test_llm_client_uses_configured_openai_base_url():
    seen = {}

    def transport(url, payload, headers, timeout_s):
        seen["url"] = url
        return {"output_text": json.dumps(_valid_payload())}

    client = AnalystLlmClient.from_settings(
        Settings(
            openai_api_key="key",
            openai_base_url="http://example.test/v1/",
        )
    )
    client._transport = transport

    assert client.analyze(_snapshot()) is not None
    assert seen["url"] == "http://example.test/v1/responses"


def test_llm_client_uses_configured_and_override_reasoning_effort():
    seen = []

    def transport(url, payload, headers, timeout_s):
        seen.append(payload["reasoning"]["effort"])
        return {"output_text": json.dumps(_valid_payload())}

    client = AnalystLlmClient(
        api_key="key",
        model="gpt-5.5",
        reasoning_effort="medium",
        transport=transport,
    )

    assert client.analyze(_snapshot()) is not None
    assert client.analyze(_snapshot(), reasoning_effort="high") is not None
    assert seen == ["medium", "high"]


def test_llm_client_omits_reasoning_when_effort_is_empty():
    def transport(url, payload, headers, timeout_s):
        assert "reasoning" not in payload
        return {"output_text": json.dumps(_valid_payload())}

    client = AnalystLlmClient(
        api_key="key",
        model="gpt-5.5",
        reasoning_effort="",
        transport=transport,
    )

    assert client.analyze(_snapshot()) is not None


def test_reasoning_effort_normalization():
    assert normalize_reasoning_effort(" HIGH ") == "high"
    assert normalize_reasoning_effort("") is None
    assert normalize_reasoning_effort(None) is None


def test_settings_default_llm_model_and_reasoning(monkeypatch):
    monkeypatch.delenv("NTTOTV_LLM_MODEL", raising=False)
    monkeypatch.delenv("NTTOTV_LLM_REASONING_EFFORT", raising=False)
    monkeypatch.delenv("NTTOTV_LLM_MANUAL_REASONING_EFFORT", raising=False)

    settings = Settings()

    assert settings.llm_model == "cx/gpt-5.5"
    assert settings.llm_reasoning_effort == "medium"
    assert settings.llm_manual_reasoning_effort == "high"


def test_responses_url_accepts_base_or_full_responses_endpoint():
    assert (
        responses_url_from_base_url("http://43.228.214.251:20128/v1")
        == "http://43.228.214.251:20128/v1/responses"
    )
    assert (
        responses_url_from_base_url("http://43.228.214.251:20128/v1/responses")
        == "http://43.228.214.251:20128/v1/responses"
    )


def test_report_validation_rejects_unknown_decision():
    with pytest.raises(ValueError):
        report_from_llm_payload(
            _valid_payload(decision="buy_now"),
            _snapshot(),
            created_at=2,
        )


def test_report_validation_rejects_empty_reason():
    with pytest.raises(ValueError):
        report_from_llm_payload(
            _valid_payload(reason=[]),
            _snapshot(),
            created_at=2,
        )


def test_report_validation_rejects_unknown_bias():
    with pytest.raises(ValueError):
        report_from_llm_payload(
            _valid_payload(bias="long"),
            _snapshot(),
            created_at=2,
        )


def test_report_validation_rejects_unknown_risk_state():
    with pytest.raises(ValueError):
        report_from_llm_payload(
            _valid_payload(riskState="ready"),
            _snapshot(),
            created_at=2,
        )


def test_candidate_is_downgraded_because_timing_is_manual():
    report = report_from_llm_payload(
        _valid_payload(decision="buy_candidate", riskState="candidate"),
        _snapshot_with_context("bullish"),
        created_at=2,
    )

    assert report.decision == "wait_for_buy"
    assert report.risk_state == "wait"
    assert report.raw_response["originalDecision"] == "buy_candidate"
    assert report.raw_response["decisionGuard"] == "manual_timing_required"


def test_report_text_drops_m1_references_from_proxy_output():
    report = report_from_llm_payload(
        _valid_payload(
            reason=["H1 bullish", "M1 CHoCH bullish"],
            invalidIf="M1 breaks below support",
            nextConfirmation="Wait for 1m trigger",
        ),
        _snapshot_with_context("bullish"),
        created_at=2,
    )

    text = json.dumps(report.to_dict(), ensure_ascii=False)
    assert not re.search(r"\b(?:M1|1m)\b", text, re.IGNORECASE)
    assert report.reason == (
        "H1 bullish",
    )


def test_llm_client_propagates_timeout_for_scheduler_fail_closed():
    def transport(url, payload, headers, timeout_s):
        raise TimeoutError("timed out")

    client = AnalystLlmClient(
        api_key="key",
        model="gpt-5.5",
        transport=transport,
    )

    with pytest.raises(TimeoutError):
        client.analyze(_snapshot())


def test_missing_cvd_caps_llm_confidence():
    report = report_from_llm_payload(
        _valid_payload(confidence=0.95),
        _snapshot_missing_cvd(),
        created_at=3,
    )

    assert report.confidence == 0.55


def test_proxy_payload_without_decision_is_normalized_to_contract():
    snapshot = MarketStateSnapshot(
        snapshot_id="GC:GC:4",
        symbol="GC",
        contract="GC",
        snapshot_time=4,
        timeframes=_snapshot_with_context("bullish").timeframes,
        decision_context={
            "preferredSide": "buy",
            "riskState": "candidate",
            "allowedToAutoTrade": False,
        },
    )

    report = report_from_llm_payload(
        {
            "bias": "bullish",
            "confidence": 90,
            "riskState": "candidate",
            "preferredSide": "buy",
            "keySignals": ["H1 bullish", "M15 CVD confirms"],
            "risks": ["M5 divergence"],
            "notes": "Higher timeframes lean bullish.",
        },
        snapshot,
        created_at=5,
    )

    assert report.decision == "wait_for_buy"
    assert report.risk_state == "wait"
    assert report.confidence == 0.9
    assert report.reason == ("H1 bullish", "M15 CVD confirms", "M5 divergence")
    assert report.allowed_to_auto_trade is False
