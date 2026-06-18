"""OpenAI Structured Outputs adapter for analyst reports."""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from collections.abc import Callable
from typing import Any

from ..config import DEFAULT_OPENAI_BASE_URL, Settings
from ..models.timestamp import now_ms
from .schemas import ANALYST_DECISIONS, AnalystReport, MarketStateSnapshot

OPENAI_RESPONSES_PATH = "/responses"
MISSING_CVD_CONFIDENCE_CAP = 0.55
FORBIDDEN_M1_PATTERN = re.compile(r"\b(?:m1|1m)\b", re.IGNORECASE)
ANALYST_BIASES: frozenset[str] = frozenset(
    {"bullish", "bearish", "range", "unknown"}
)
ANALYST_RISK_STATES: frozenset[str] = frozenset(
    {"no_trade", "wait", "candidate"}
)
MANUAL_ANALYST_DECISIONS: frozenset[str] = frozenset(
    {"no_trade", "wait_for_buy", "wait_for_sell"}
)
MANUAL_ANALYST_RISK_STATES: frozenset[str] = frozenset({"no_trade", "wait"})

SYSTEM_PROMPT = """You are a GC futures SMC and volume-delta market analyst.
Use only the supplied market_state JSON. Do not invent chart facts, prices,
zones, signals, or confirmations.
Your task is to classify the current market context from H1 down to M5 using:
- SMC structure: bias, BOS, CHoCH, external/internal structure
- Liquidity and PD context if supplied
- FVG/OB zones if supplied
- CVD/volume delta confirmation if supplied
- decisionContext if supplied
Decision rules:
1. H1 defines the primary directional bias.
2. M15 defines the main setup context.
3. M5 defines execution alignment.
4. M1 data is not supplied and must not be analyzed, inferred, or mentioned as
   structure, CVD, FVG, OB, PD, signal, or confirmation.
5. Return wait_for_buy when H1/M15/M5 support a buy context.
6. Return wait_for_sell when H1/M15/M5 support a sell context.
7. Return no_trade when higher timeframes conflict strongly, context is unclear,
   or supplied data is insufficient.
8. Do not return buy_candidate or sell_candidate. Entry timing is handled
   manually outside this analyst.
9. If price is inside or near an opposite FVG/OB/PD zone, reduce confidence
    and mention it.
10. Use supplied smc.zoneSummary, smc.zoneContext, and smc.zones when active
    FVG, OB, or PD zones exist. Mention the most relevant nearby zone in
    reason or nextConfirmation.
11. If no FVG/OB/PD zone is supplied, do not invent one.
12. CVD confirming structure may increase confidence. CVD conflicting with
    structure must reduce confidence.
13. Do not request, recommend, or allow auto-trading. allowedToAutoTrade must
    always be false.
Language rules:
- All human-readable output text must be Vietnamese with Vietnamese diacritics.
- Keep machine-readable enum fields in English exactly as required.
- Technical abbreviations such as FVG, OB, PD, CVD, BOS, and CHoCH may remain
  unchanged.
- reason must be short, concrete, and based only on supplied data.
- invalidIf and nextConfirmation must be short and actionable.
Return only one compact JSON object with exactly this contract:
{
  "bias": "bullish|bearish|range|unknown",
  "decision": "no_trade|wait_for_buy|wait_for_sell",
  "confidence": 0.0,
  "reason": ["lý do ngắn gọn bằng tiếng Việt"],
  "invalidIf": "điều kiện vô hiệu ngắn gọn bằng tiếng Việt",
  "nextConfirmation": "xác nhận tiếp theo ngắn gọn bằng tiếng Việt",
  "riskState": "no_trade|wait",
  "allowedToAlert": false,
  "allowedToAutoTrade": false
}"""

ANALYST_REPORT_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "bias",
        "decision",
        "confidence",
        "reason",
        "invalidIf",
        "nextConfirmation",
        "riskState",
        "allowedToAlert",
        "allowedToAutoTrade",
    ],
    "properties": {
        "bias": {
            "type": "string",
            "enum": sorted(ANALYST_BIASES),
        },
        "decision": {
            "type": "string",
            "enum": sorted(MANUAL_ANALYST_DECISIONS),
        },
        "confidence": {
            "type": "number",
            "minimum": 0,
            "maximum": 1,
        },
        "reason": {
            "type": "array",
            "items": {
                "type": "string",
                "minLength": 1,
                "maxLength": 180,
            },
            "minItems": 1,
            "maxItems": 5,
        },
        "invalidIf": {
            "type": "string",
            "minLength": 1,
            "maxLength": 180,
        },
        "nextConfirmation": {
            "type": "string",
            "minLength": 1,
            "maxLength": 220,
        },
        "riskState": {
            "type": "string",
            "enum": sorted(MANUAL_ANALYST_RISK_STATES),
        },
        "allowedToAlert": {"type": "boolean"},
        "allowedToAutoTrade": {"type": "boolean", "const": False},
    },
}

Transport = Callable[[str, dict[str, Any], dict[str, str], float], dict[str, Any]]


class AnalystLlmClient:
    """Small, dependency-free OpenAI client.

    The network transport is injectable so tests can validate schema handling
    without hitting the real API.
    """

    def __init__(
        self,
        *,
        api_key: str | None,
        model: str,
        timeout_s: float = 20.0,
        base_url: str = DEFAULT_OPENAI_BASE_URL,
        reasoning_effort: str | None = "medium",
        url: str | None = None,
        transport: Transport | None = None,
    ) -> None:
        self._api_key = (api_key or "").strip()
        self._model = model
        self._timeout_s = float(timeout_s)
        self._base_url = normalize_openai_base_url(base_url)
        self._reasoning_effort = normalize_reasoning_effort(reasoning_effort)
        self._url = url or responses_url_from_base_url(self._base_url)
        self._transport = transport or _default_transport

    @classmethod
    def from_settings(cls, settings: Settings) -> "AnalystLlmClient":
        return cls(
            api_key=settings.openai_api_key,
            model=settings.llm_model,
            base_url=settings.openai_base_url,
            reasoning_effort=settings.llm_reasoning_effort,
        )

    @property
    def enabled(self) -> bool:
        return bool(self._api_key)

    def analyze(
        self,
        snapshot: MarketStateSnapshot,
        *,
        reasoning_effort: str | None = None,
    ) -> AnalystReport | None:
        if not self.enabled:
            return None
        body = self._transport(
            self._url,
            self._payload(snapshot, reasoning_effort=reasoning_effort),
            {
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
            self._timeout_s,
        )
        parsed = _extract_structured_json(body)
        return report_from_llm_payload(parsed, snapshot, created_at=now_ms())

    def _payload(
        self,
        snapshot: MarketStateSnapshot,
        *,
        reasoning_effort: str | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": self._model,
            "input": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": json.dumps(
                        {"market_state": snapshot.to_dict()},
                        separators=(",", ":"),
                        sort_keys=True,
                    ),
                },
            ],
            "max_output_tokens": 700,
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "gc_analyst_report",
                    "strict": True,
                    "schema": ANALYST_REPORT_JSON_SCHEMA,
                }
            },
        }
        effective_effort = normalize_reasoning_effort(
            reasoning_effort if reasoning_effort is not None else self._reasoning_effort
        )
        if effective_effort:
            payload["reasoning"] = {"effort": effective_effort}
        return payload


def report_from_llm_payload(
    payload: dict[str, Any],
    snapshot: MarketStateSnapshot,
    *,
    created_at: int,
) -> AnalystReport:
    """Validate a parsed LLM payload and convert it to a report."""
    payload = _coerce_report_payload(payload, snapshot)
    decision = str(payload.get("decision", ""))
    if decision not in ANALYST_DECISIONS:
        raise ValueError(f"invalid analyst decision: {decision!r}")
    reason = payload.get("reason")
    if not isinstance(reason, list) or not reason:
        raise ValueError("analyst payload reason must be a non-empty list")
    reason = _sanitize_human_text_list(
        reason,
        fallback="Chỉ dùng bối cảnh H1/M15/M5; timing được xử lý thủ công.",
    )
    payload["reason"] = reason
    bias = str(payload.get("bias", "unknown"))
    if bias not in ANALYST_BIASES:
        raise ValueError(f"invalid analyst bias: {bias!r}")
    risk_state = str(payload.get("riskState", ""))
    if risk_state not in ANALYST_RISK_STATES:
        raise ValueError(f"invalid analyst riskState: {risk_state!r}")
    original_decision = decision
    guard_reason = _candidate_guard_reason(decision)
    if guard_reason is not None:
        decision = "wait_for_buy" if decision == "buy_candidate" else "wait_for_sell"
        risk_state = "wait"
        payload["decision"] = decision
        payload["riskState"] = risk_state
    elif risk_state == "candidate":
        risk_state = "wait" if decision in {"wait_for_buy", "wait_for_sell"} else "no_trade"
        payload["riskState"] = risk_state
    confidence = _clamp_float(payload.get("confidence"), 0.0, 1.0)
    if any(item.startswith("missing_cvd") for item in snapshot.data_quality):
        confidence = min(confidence, MISSING_CVD_CONFIDENCE_CAP)
    payload["invalidIf"] = _sanitize_human_text(
        payload.get("invalidIf", ""),
        fallback="Bối cảnh H1/M15/M5 bị vô hiệu.",
    )
    payload["nextConfirmation"] = _sanitize_human_text(
        payload.get("nextConfirmation", ""),
        fallback="Chờ timing thủ công tại POI khi H1/M15/M5 còn đồng thuận.",
    )
    raw = dict(payload)
    if guard_reason is not None:
        raw["originalDecision"] = original_decision
        raw["decisionGuard"] = guard_reason
    raw["allowedToAutoTrade"] = False
    return AnalystReport(
        report_id=f"{snapshot.snapshot_id}:llm:{created_at}",
        snapshot_id=snapshot.snapshot_id,
        symbol=snapshot.symbol,
        contract=snapshot.contract,
        created_at=created_at,
        bias=bias,
        decision=decision,
        confidence=confidence,
        reason=tuple(str(item) for item in reason),
        invalid_if=str(payload.get("invalidIf", "")),
        next_confirmation=str(payload.get("nextConfirmation", "")),
        risk_state=risk_state,
        allowed_to_alert=bool(payload.get("allowedToAlert", False)),
        allowed_to_auto_trade=False,
        raw_response=raw,
    )


def _candidate_guard_reason(decision: str) -> str | None:
    if decision in {"buy_candidate", "sell_candidate"}:
        return "manual_timing_required"
    return None


def _sanitize_human_text_list(items: list[Any], *, fallback: str) -> list[str]:
    sanitized = [
        text
        for item in items
        if (text := _sanitize_human_text(item, fallback="")).strip()
    ]
    return sanitized or [fallback]


def _sanitize_human_text(value: Any, *, fallback: str) -> str:
    text = str(value)
    if FORBIDDEN_M1_PATTERN.search(text):
        return fallback
    return text


def normalize_openai_base_url(base_url: str) -> str:
    normalized = (base_url or DEFAULT_OPENAI_BASE_URL).strip().rstrip("/")
    if not normalized:
        return DEFAULT_OPENAI_BASE_URL
    return normalized


def normalize_reasoning_effort(reasoning_effort: str | None) -> str | None:
    normalized = (reasoning_effort or "").strip().lower()
    return normalized or None


def responses_url_from_base_url(base_url: str) -> str:
    normalized = normalize_openai_base_url(base_url)
    if normalized.endswith(OPENAI_RESPONSES_PATH):
        return normalized
    return f"{normalized}{OPENAI_RESPONSES_PATH}"


def _extract_structured_json(body: dict[str, Any]) -> dict[str, Any]:
    if isinstance(body.get("output_parsed"), dict):
        return dict(body["output_parsed"])

    text = body.get("output_text")
    if isinstance(text, str) and text.strip():
        return _parse_json_object(text)

    for item in body.get("output", []):
        if not isinstance(item, dict):
            continue
        for content in item.get("content", []):
            if not isinstance(content, dict):
                continue
            if content.get("type") == "refusal":
                raise ValueError("OpenAI refused the analyst request")
            text = content.get("text")
            if isinstance(text, str) and text.strip():
                return _parse_json_object(text)
    raise ValueError("OpenAI response did not contain structured JSON output")


def _coerce_report_payload(
    payload: dict[str, Any],
    snapshot: MarketStateSnapshot,
) -> dict[str, Any]:
    """Normalize proxy outputs that ignored JSON schema into our contract."""
    out = dict(payload)
    if "decision" not in out:
        out["decision"] = _decision_from_proxy_payload(out, snapshot)
    if "reason" not in out:
        out["reason"] = _reason_from_proxy_payload(out)
    if "invalidIf" not in out:
        out["invalidIf"] = str(out.get("invalid_if", "not specified"))
    if "nextConfirmation" not in out:
        out["nextConfirmation"] = str(
            out.get("next_confirmation", "wait for H1/M15/M5 context alignment")
        )
    if "riskState" not in out:
        out["riskState"] = str(
            out.get("risk_state", snapshot.decision_context.get("riskState", "wait"))
        )
    out["riskState"] = _manual_risk_state(str(out["riskState"]), str(out["decision"]))
    if "allowedToAlert" not in out:
        out["allowedToAlert"] = out["decision"] in {
            "wait_for_buy",
            "wait_for_sell",
        }
    out["allowedToAutoTrade"] = False
    return out


def _decision_from_proxy_payload(
    payload: dict[str, Any],
    snapshot: MarketStateSnapshot,
) -> str:
    side = str(
        payload.get("preferredSide")
        or payload.get("preferred_side")
        or snapshot.decision_context.get("preferredSide", "neutral")
    ).lower()
    risk = str(
        payload.get("riskState")
        or payload.get("risk_state")
        or snapshot.decision_context.get("riskState", "wait")
    ).lower()
    if side == "buy" and risk in {"candidate", "wait"}:
        return "wait_for_buy"
    if side == "sell" and risk in {"candidate", "wait"}:
        return "wait_for_sell"
    return "no_trade"


def _manual_risk_state(risk_state: str, decision: str) -> str:
    normalized = risk_state.lower()
    if normalized != "candidate":
        return normalized
    if decision == "no_trade":
        return "no_trade"
    if decision in {"wait_for_buy", "wait_for_sell", "buy_candidate", "sell_candidate"}:
        return "wait"
    return normalized


def _reason_from_proxy_payload(payload: dict[str, Any]) -> list[str]:
    reasons: list[str] = []
    raw_signals = payload.get("keySignals") or payload.get("key_signals") or []
    raw_risks = payload.get("risks") or []
    for item in list(raw_signals)[:4] + list(raw_risks)[:2]:
        reasons.append(str(item))
    notes = payload.get("notes")
    if not reasons and notes:
        reasons.append(str(notes))
    return reasons or ["LLM report normalized from market_state snapshot"]


def _parse_json_object(text: str) -> dict[str, Any]:
    parsed = json.loads(text)
    if not isinstance(parsed, dict):
        raise ValueError("structured output must be a JSON object")
    return parsed


def _clamp_float(value: Any, low: float, high: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        raise ValueError("confidence must be numeric")
    if parsed > 1.0 and high <= 1.0:
        parsed = parsed / 100.0
    return min(high, max(low, parsed))


def _default_transport(
    url: str,
    payload: dict[str, Any],
    headers: dict[str, str],
    timeout_s: float,
) -> dict[str, Any]:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            decoded = resp.read().decode("utf-8")
            parsed = json.loads(decoded)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise ValueError(f"OpenAI API error: {detail}")
    except urllib.error.URLError as exc:
        raise ValueError(f"OpenAI API request failed: {exc.reason}")
    if not isinstance(parsed, dict):
        raise ValueError("OpenAI API response must be a JSON object")
    return parsed
