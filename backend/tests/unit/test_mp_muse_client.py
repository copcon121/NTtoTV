from __future__ import annotations

import json

import pytest

from app.analyst.llm_client import AnalystLlmClient
from app.config import Settings
from app.market_profile.llm import MpLlmClient


def snapshot(scopes=None):
    return {
        "requestedScopes": scopes or ["daily", "eu"],
        "levels": {"previous:volume:val": {"price": 4010, "label": "Previous VAL", "source": "volume"}},
    }


def reports(data):
    return {"plans": [{
        "scope": scope,
        "summary": "Cho gia xac nhan tai vung gia tri.",
        "mpRead": "Gia dang nam trong vung gia tri cu.",
        "dailyRead": "Nen ngay chua cho thay xu huong ro.",
        "scenarios": [{"title": "Theo doi vung gia tri", "condition": "Gia giu tren 4010",
                       "action": "Cho phan ung tai 4010", "invalidation": "Gia chap nhan duoi 4010"}],
        "invalidation": "Gia chap nhan duoi vung gia tri.",
        "alerts": [] if scope == "daily" else [{
            "levelRef": "previous:volume:val", "reason": "Theo doi phan ung tai VAL cu",
            "scenario": "Cho chap nhan hoac tu choi gia",
        }],
    } for scope in data["requestedScopes"]]}


def test_muse_configuration_does_not_replace_other_analysts():
    settings = Settings(
        mp_llm_provider="muse", mp_llm_api_key="muse-test-key",
        mp_llm_base_url="http://127.0.0.1:18610/v1", mp_llm_model="muse-chat",
        openai_api_key="original-test-key", openai_base_url="https://original.example/v1",
        llm_model="original-model", llm_reasoning_effort="xhigh",
    )
    mp = MpLlmClient.from_settings(settings)
    analyst = AnalystLlmClient.from_settings(settings)
    assert mp.enabled and mp.configuration() == {"model": "muse-chat"}
    assert mp._api_key == "muse-test-key"
    assert mp._reasoning_effort is None
    assert (analyst._api_key, analyst._base_url, analyst._model, analyst._reasoning_effort) == (
        "original-test-key", "https://original.example/v1", "original-model", "xhigh",
    )


def test_muse_missing_key_does_not_send_the_openai_key_to_muse():
    client = MpLlmClient.from_settings(Settings(
        mp_llm_provider="muse", mp_llm_api_key=None, openai_api_key="original-test-key",
    ))
    assert not client.enabled
    with pytest.raises(ValueError, match="not configured"):
        client.analyze_plan(snapshot())


def test_default_mp_provider_preserves_existing_responses_client():
    client = MpLlmClient.from_settings(Settings(
        mp_llm_provider="openai", openai_api_key="original-test-key",
        openai_base_url="https://original.example/v1", llm_model="original-model",
        llm_reasoning_effort="xhigh",
    ))
    assert client.configuration() == {"model": "original-model", "reasoningEffort": "xhigh"}
    assert client._url == "https://original.example/v1/responses"


def test_unknown_mp_provider_is_rejected():
    with pytest.raises(ValueError, match="Unsupported MP LLM provider"):
        MpLlmClient.from_settings(Settings(mp_llm_provider="typo"))


@pytest.mark.parametrize("fenced", [False, True])
@pytest.mark.parametrize("scopes", [["daily", "eu"], ["us"]])
@pytest.mark.parametrize("base_url", ["http://127.0.0.1:18610/v1/", "http://127.0.0.1:18610/v1/chat/completions"])
def test_muse_sends_schema_as_text_and_validates_the_catalog(fenced, scopes, base_url):
    data = snapshot(scopes)
    captured = {}

    def transport(url, payload, headers, timeout):
        assert url == "http://127.0.0.1:18610/v1/chat/completions"
        assert headers["Authorization"] == "Bearer muse-test-key"
        assert timeout == 300
        assert set(payload) == {"model", "messages", "stream"}
        assert payload["model"] == "muse-chat" and payload["stream"] is False
        assert len(payload["messages"]) == 1 and payload["messages"][0]["role"] == "user"
        prompt = payload["messages"][0]["content"]
        schema_text, snapshot_text = prompt.split("\nSNAPSHOT:\n")
        schema_start = schema_text.index('{"type":"object",')
        schema = json.loads(schema_text[schema_start:])
        assert json.loads(snapshot_text) == data
        plans = schema["properties"]["plans"]
        assert plans["minItems"] == plans["maxItems"] == len(scopes)
        assert plans["items"]["properties"]["scope"]["enum"] == scopes
        assert plans["items"]["properties"]["alerts"]["items"]["properties"]["levelRef"]["enum"] == list(data["levels"])
        captured["called"] = True
        content = json.dumps(reports(data))
        if fenced:
            content = f"```json\n{content}\n```"
        return {"choices": [{"message": {"content": content}}]}

    client = MpLlmClient(provider="muse", api_key="muse-test-key", model="muse-chat",
                         base_url=base_url, reasoning_effort="xhigh", transport=transport)
    result = client.analyze_plan(data)
    assert captured["called"]
    assert [p["scope"] for p in result] == scopes
    for plan in result:
        for alert in plan["alerts"]:
            assert alert["price"] == 4010


@pytest.mark.parametrize("content", ["Here is your plan: {}", "[]", "```json\n{}", None])
def test_muse_rejects_prose_truncated_json_and_missing_text(content):
    client = MpLlmClient(provider="muse", api_key="test", model="muse-chat",
                         transport=lambda *_: {"choices": [{"message": {"content": content}}]})
    with pytest.raises(ValueError):
        client.analyze_plan(snapshot())


@pytest.mark.parametrize("mutation", ["scope", "catalog", "daily_alert", "narrative"])
def test_muse_cannot_bypass_plan_validation(mutation):
    data = snapshot()
    output = reports(data)
    if mutation == "scope":
        output["plans"][1]["scope"] = "us"
    elif mutation == "catalog":
        output["plans"][1]["alerts"][0]["levelRef"] = "invented"
    elif mutation == "daily_alert":
        output["plans"][0]["alerts"] = output["plans"][1]["alerts"]
    else:
        output["plans"][1]["mpRead"] = "VAL"
    client = MpLlmClient(provider="muse", api_key="test", model="muse-chat",
                         transport=lambda *_: {"choices": [{"message": {"content": json.dumps(output)}}]})
    with pytest.raises(ValueError):
        client.analyze_plan(data)
