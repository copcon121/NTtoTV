"""Provider abstraction for event-driven analyst reports."""

from __future__ import annotations

import json
from typing import Any, Protocol

from ..config import DEFAULT_OPENAI_BASE_URL, Settings
from .llm_client import (
    _sanitize_human_text,
    _sanitize_human_text_list,
    Transport,
    _clamp_float,
    _default_transport,
    _extract_structured_json,
    normalize_openai_base_url,
    normalize_reasoning_effort,
    responses_url_from_base_url,
)
from .schemas import ANALYST_DECISIONS

EVENT_TYPES: frozenset[str] = frozenset(
    {
        "price_entered_poi",
        "poi_invalidated",
    }
)
EVENT_BIASES: frozenset[str] = frozenset(
    {"bullish", "bearish", "range", "unknown"}
)
EVENT_RISK_STATES: frozenset[str] = frozenset(
    {"no_trade", "wait", "candidate"}
)
EVENT_LLM_DECISIONS: frozenset[str] = frozenset(
    {"no_trade", "wait_for_buy", "wait_for_sell"}
)
EVENT_LLM_RISK_STATES: frozenset[str] = frozenset({"no_trade", "wait"})

EVENT_SYSTEM_PROMPT = """You are a GC futures SMC, ICT PD Zone, and volume-delta context analyst.
Use only the supplied event snapshot JSON. Do not invent chart facts, prices,
zones, swing points, FVG, OB, supply/demand zones, BOS, CHoCH, or CVD states.
Analyze strictly from higher timeframe to lower timeframe: H1 -> M15 -> M5.

Core SMC rules:
1. Determine market structure from HH/HL/LH/LL swing sequence first.
2. HH + HL means bullish structure.
3. LH + LL means bearish structure.
4. Mixed or unclear swing sequence means range, transition, or unknown.
5. BOS and CHoCH are break/confirmation events only.
6. BOS confirms continuation only when it breaks a relevant swing level in the direction of existing structure.
7. CHoCH is an early warning and does not fully reverse bias without a valid new swing sequence or external BOS.
8. H1 defines the main directional bias.
9. M15 refines setup and POI context.
10. M5 is the active execution context and activePoi must be an M5 POI.
11. Lower-timeframe timing is manual and is not part of this analyst decision.
12. Use external swing structure on H1/M15/M5 only.
13. PD Zone is not a POI by itself. Use Premium/Discount only as context/filter.
14. For bullish HTF structure, prefer M5 demand/bullish POIs in Discount or bias-aligned context.
15. For bearish HTF structure, prefer M5 supply/bearish POIs in Premium or bias-aligned context.
16. If price reaches the wrong zone against HTF bias, return no_trade.
17. CVD confirming the context may increase confidence.
18. CVD conflicting with the context must reduce confidence.
19. Do not request, recommend, or allow auto-trading. allowedToAutoTrade must always be false.

Decision rules:
- Return wait_for_buy when HTF/M5 context supports a buy at an M5 demand POI.
- Return wait_for_sell when HTF/M5 context supports a sell at an M5 supply POI.
- no_trade means structure is unclear, PD context is wrong, timeframes conflict strongly, POI is invalidated, or data is insufficient.
- Do not return buy_candidate or sell_candidate. The trader handles entry timing manually after this alert.

Language rules:
- All human-readable text must be Vietnamese with Vietnamese diacritics.
- Keep machine-readable enum fields in English exactly as required.
- Technical abbreviations such as FVG, OB, PD, CVD, BOS, and CHoCH may remain unchanged.
- Be concise, concrete, and only reference supplied data.
Return one compact JSON object only."""

EVENT_REPORT_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "bias",
        "decision",
        "confidence",
        "eventType",
        "activePoiSummary",
        "structureRead",
        "reason",
        "invalidIf",
        "nextConfirmation",
        "riskState",
        "allowedToAlert",
        "allowedToAutoTrade",
    ],
    "properties": {
        "bias": {"type": "string", "enum": sorted(EVENT_BIASES)},
        "decision": {"type": "string", "enum": sorted(EVENT_LLM_DECISIONS)},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "eventType": {"type": "string", "enum": sorted(EVENT_TYPES)},
        "activePoiSummary": {"type": "string", "minLength": 1, "maxLength": 220},
        "structureRead": {
            "type": "object",
            "additionalProperties": False,
            "required": ["h1", "m15", "m5"],
            "properties": {
                "h1": {"type": "string", "minLength": 1, "maxLength": 220},
                "m15": {"type": "string", "minLength": 1, "maxLength": 220},
                "m5": {"type": "string", "minLength": 1, "maxLength": 220},
            },
        },
        "reason": {
            "type": "array",
            "items": {"type": "string", "minLength": 1, "maxLength": 220},
            "minItems": 1,
            "maxItems": 6,
        },
        "invalidIf": {"type": "string", "minLength": 1, "maxLength": 220},
        "nextConfirmation": {"type": "string", "minLength": 1, "maxLength": 260},
        "riskState": {"type": "string", "enum": sorted(EVENT_LLM_RISK_STATES)},
        "allowedToAlert": {"type": "boolean"},
        "allowedToAutoTrade": {"type": "boolean", "const": False},
    },
}


class AnalystEventProvider(Protocol):
    name: str
    mode: str

    def analyze(self, snapshot: dict[str, Any]) -> dict[str, Any]:
        ...


class MockAnalystEventProvider:
    """Deterministic provider used by the event scanner phase 1."""

    name = "mock_poi_analyst"
    mode = "mock"

    def analyze(self, snapshot: dict[str, Any]) -> dict[str, Any]:
        event_type = str(snapshot["eventType"])
        poi = dict(snapshot["activePoi"])
        side = str(poi.get("side", "unknown"))
        h1 = _structure(snapshot, "h1Context", external=True)
        m15 = _structure(snapshot, "m15Context", external=True)
        confluence = dict(snapshot.get("confluence", {}))
        bias_aligned = bool(poi.get("biasAligned", False))
        bias = _bias(h1, m15)

        if event_type == "poi_invalidated":
            decision = "no_trade"
            risk_state = "no_trade"
            confidence = 0.2
            reasons = ["POI đã bị vô hiệu theo giá hiện tại."]
            next_confirmation = "Chờ M5 POI mới cùng hướng với H1/M15."
        elif side == "demand" and _buy_context(h1, m15) and bias_aligned:
            decision = "wait_for_buy"
            risk_state = "wait"
            confidence = _confidence(0.52, confluence, bias_aligned)
            reasons = ["H1/M15 ủng hộ mua và giá đã chạm M5 demand POI hợp lệ."]
            next_confirmation = "Trader tự timing thủ công sau khi POI giữ được."
        elif side == "supply" and _sell_context(h1, m15) and bias_aligned:
            decision = "wait_for_sell"
            risk_state = "wait"
            confidence = _confidence(0.52, confluence, bias_aligned)
            reasons = ["H1/M15 ủng hộ bán và giá đã chạm M5 supply POI hợp lệ."]
            next_confirmation = "Trader tự timing thủ công sau khi POI giữ được."
        else:
            decision = "no_trade"
            risk_state = "no_trade"
            confidence = 0.35 if bias_aligned else 0.25
            reasons = [
                "POI chưa đồng thuận với structure hoặc PD context của H1/M15/M5."
            ]
            next_confirmation = "Chờ M5 POI đúng phía hoặc structure H1/M15 rõ hơn."

        return {
            "bias": bias,
            "decision": decision,
            "confidence": round(max(0.0, min(1.0, confidence)), 2),
            "eventType": event_type,
            "activePoiSummary": _poi_summary(poi),
            "structureRead": {
                "h1": _structure_text(snapshot, "h1Context"),
                "m15": _structure_text(snapshot, "m15Context"),
                "m5": _structure_text(snapshot, "m5Context"),
            },
            "reason": reasons[:6],
            "invalidIf": _invalid_if(poi),
            "nextConfirmation": next_confirmation,
            "riskState": risk_state,
            "allowedToAlert": decision in {"wait_for_buy", "wait_for_sell"},
            "allowedToAutoTrade": False,
        }


class LlmAnalystEventProvider:
    """OpenAI-compatible provider for event-driven POI snapshots."""

    name = "openai_poi_analyst"
    mode = "real"

    def __init__(
        self,
        *,
        api_key: str | None,
        model: str,
        base_url: str = DEFAULT_OPENAI_BASE_URL,
        timeout_s: float = 20.0,
        reasoning_effort: str | None = "high",
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
    def from_settings(
        cls,
        settings: Settings,
        *,
        transport: Transport | None = None,
    ) -> "LlmAnalystEventProvider":
        return cls(
            api_key=settings.openai_api_key,
            model=settings.llm_model,
            base_url=settings.openai_base_url,
            reasoning_effort=settings.llm_event_reasoning_effort,
            transport=transport,
        )

    @property
    def enabled(self) -> bool:
        return bool(self._api_key)

    def analyze(self, snapshot: dict[str, Any]) -> dict[str, Any]:
        if not self.enabled:
            raise ValueError("Analyst event LLM is not configured")
        body = self._transport(
            self._url,
            self._payload(snapshot),
            {
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
            self._timeout_s,
        )
        parsed = _extract_structured_json(body)
        return event_report_from_llm_payload(parsed, snapshot)

    def _payload(self, snapshot: dict[str, Any]) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": self._model,
            "input": [
                {"role": "system", "content": EVENT_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": json.dumps(
                        {"event_snapshot": snapshot},
                        separators=(",", ":"),
                        sort_keys=True,
                    ),
                },
            ],
            "max_output_tokens": 900,
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "gc_poi_event_report",
                    "strict": True,
                    "schema": EVENT_REPORT_JSON_SCHEMA,
                }
            },
        }
        if self._reasoning_effort:
            payload["reasoning"] = {"effort": self._reasoning_effort}
        return payload


def build_event_provider(
    mode: str,
    *,
    settings: Settings | None = None,
    transport: Transport | None = None,
) -> AnalystEventProvider:
    if str(mode).lower() == "real":
        if settings is None:
            raise ValueError("settings are required for real event provider")
        return LlmAnalystEventProvider.from_settings(settings, transport=transport)
    return MockAnalystEventProvider()


def event_report_from_llm_payload(
    payload: dict[str, Any],
    snapshot: dict[str, Any],
) -> dict[str, Any]:
    out = _coerce_event_payload(payload, snapshot)
    bias = str(out.get("bias", "unknown"))
    if bias not in EVENT_BIASES:
        bias = _bias(
            _structure(snapshot, "h1Context", external=True),
            _structure(snapshot, "m15Context", external=True),
        )
    if bias not in EVENT_BIASES:
        bias = "unknown"

    decision = str(out.get("decision", ""))
    if decision not in ANALYST_DECISIONS:
        decision = _decision_from_snapshot(snapshot)
    decision = _guard_context_decision(decision, snapshot)

    event_type = str(out.get("eventType", ""))
    if event_type not in EVENT_TYPES:
        event_type = str(snapshot.get("eventType", "price_entered_poi"))
    if event_type not in EVENT_TYPES:
        event_type = "price_entered_poi"

    risk_state = _risk_state_for_decision(decision, str(out.get("riskState", "")))
    reason = out.get("reason")
    if isinstance(reason, str) and reason.strip():
        reason = [reason.strip()]
    if not isinstance(reason, list) or not reason:
        reason = [
            "LLM không trả lý do cụ thể; báo cáo được chuẩn hóa từ event snapshot."
        ]
    reason = _sanitize_human_text_list(
        reason,
        fallback="Chỉ dùng bối cảnh H1/M15/M5 và POI hiện tại.",
    )

    structure_read = out.get("structureRead")
    if not isinstance(structure_read, dict):
        raise ValueError("event analyst structureRead must be an object")
    normalized_structure = {
        key: _sanitize_human_text(
            structure_read.get(key, "Chưa đủ dữ liệu."),
            fallback="Chưa đủ dữ liệu.",
        )
        for key in ("h1", "m15", "m5")
    }

    try:
        confidence = _clamp_float(out.get("confidence"), 0.0, 1.0)
    except ValueError:
        confidence = 0.35

    return {
        "bias": bias,
        "decision": decision,
        "confidence": confidence,
        "eventType": event_type,
        "activePoiSummary": str(out.get("activePoiSummary", "")),
        "structureRead": normalized_structure,
        "reason": [str(item) for item in reason[:6]],
        "invalidIf": _sanitize_human_text(
            out.get("invalidIf", ""),
            fallback="POI bị vô hiệu theo giá hiện tại.",
        ),
        "nextConfirmation": _sanitize_human_text(
            out.get("nextConfirmation", ""),
            fallback="Chờ timing thủ công khi POI còn hợp lệ.",
        ),
        "riskState": risk_state,
        "allowedToAlert": decision in {"wait_for_buy", "wait_for_sell"},
        "allowedToAutoTrade": False,
    }


def _coerce_event_payload(
    payload: dict[str, Any],
    snapshot: dict[str, Any],
) -> dict[str, Any]:
    out = dict(payload)
    event_type = str(snapshot.get("eventType", "price_entered_poi"))
    h1 = _structure(snapshot, "h1Context", external=True)
    m15 = _structure(snapshot, "m15Context", external=True)
    out.setdefault("eventType", event_type)
    out.setdefault("bias", _bias(h1, m15))
    out.setdefault("decision", _decision_from_snapshot(snapshot))
    out.setdefault("confidence", 0.35)
    out.setdefault("activePoiSummary", _poi_summary(dict(snapshot.get("activePoi", {}))))
    out.setdefault(
        "structureRead",
        {
            "h1": _structure_text(snapshot, "h1Context"),
            "m15": _structure_text(snapshot, "m15Context"),
            "m5": _structure_text(snapshot, "m5Context"),
        },
    )
    if "reason" not in out:
        out["reason"] = ["Nhận định được chuẩn hóa từ event snapshot."]
    out.setdefault("invalidIf", _invalid_if(dict(snapshot.get("activePoi", {}))))
    out.setdefault("nextConfirmation", "Chờ xác nhận tiếp theo tại POI.")
    if "riskState" not in out:
        decision = str(out.get("decision", "no_trade"))
        out["riskState"] = "wait" if decision.startswith("wait_") else "no_trade"
    out.setdefault(
        "allowedToAlert",
        str(out.get("decision", "")) in {"wait_for_buy", "wait_for_sell"},
    )
    out["allowedToAutoTrade"] = False
    return out


def _decision_from_snapshot(snapshot: dict[str, Any]) -> str:
    event_type = str(snapshot.get("eventType", ""))
    if event_type == "poi_invalidated":
        return "no_trade"
    poi = dict(snapshot.get("activePoi", {}))
    side = str(poi.get("side", ""))
    if not bool(poi.get("biasAligned", False)):
        return "no_trade"
    h1 = _structure(snapshot, "h1Context", external=True)
    m15 = _structure(snapshot, "m15Context", external=True)
    if side == "demand" and _buy_context(h1, m15):
        return "wait_for_buy"
    if side == "supply" and _sell_context(h1, m15):
        return "wait_for_sell"
    return "no_trade"


def _guard_context_decision(decision: str, snapshot: dict[str, Any]) -> str:
    expected = _decision_from_snapshot(snapshot)
    if decision == "buy_candidate":
        decision = "wait_for_buy"
    elif decision == "sell_candidate":
        decision = "wait_for_sell"
    if decision in {"wait_for_buy", "wait_for_sell"} and decision != expected:
        return "no_trade"
    if expected == "no_trade" and decision != "no_trade":
        return "no_trade"
    return decision


def _risk_state_for_decision(decision: str, requested: str) -> str:
    if decision.startswith("wait_"):
        return "wait"
    if decision == "no_trade":
        return "no_trade"
    return requested if requested in EVENT_RISK_STATES else "no_trade"


def _buy_context(h1: str, m15: str) -> bool:
    if h1 == "bullish" and m15 != "bearish":
        return True
    return h1 in {"range", "unknown"} and m15 == "bullish"


def _sell_context(h1: str, m15: str) -> bool:
    if h1 == "bearish" and m15 != "bullish":
        return True
    return h1 in {"range", "unknown"} and m15 == "bearish"


def _structure(snapshot: dict[str, Any], key: str, *, external: bool) -> str:
    ctx = dict(snapshot.get(key, {}))
    structure_map = dict(ctx.get("structureMap", {}))
    scope = "external" if external else "internal"
    data = dict(structure_map.get(scope, {}))
    return str(data.get("structure", data.get("trendPattern", "unknown")))


def _bias(h1: str, m15: str) -> str:
    if h1 in {"bullish", "bearish"}:
        return h1
    if m15 in {"bullish", "bearish"}:
        return m15
    if h1 == "range" or m15 == "range":
        return "range"
    return "unknown"


def _confidence(base: float, confluence: dict[str, Any], bias_aligned: bool) -> float:
    level = str(confluence.get("level", "none"))
    bump = {"none": 0.0, "weak": 0.04, "moderate": 0.08, "strong": 0.12}.get(
        level,
        0.0,
    )
    if bias_aligned:
        bump += 0.05
    return base + bump


def _poi_summary(poi: dict[str, Any]) -> str:
    return (
        f"{poi.get('timeframe')} {poi.get('kind')} {poi.get('side')} "
        f"{poi.get('bottom')} - {poi.get('top')}"
    )


def _structure_text(snapshot: dict[str, Any], key: str) -> str:
    structure = _structure(snapshot, key, external=True)
    return f"Structure {structure} theo swing sequence đã xác nhận."


def _invalid_if(poi: dict[str, Any]) -> str:
    if poi.get("side") == "demand":
        return f"Giá phá xuống dưới {poi.get('bottom')} sau buffer invalidation."
    if poi.get("side") == "supply":
        return f"Giá phá lên trên {poi.get('top')} sau buffer invalidation."
    return "POI bị phá rõ theo giá hiện tại."
