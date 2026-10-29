"""Structured Vietnamese MP reports using the existing analyst transport."""

from __future__ import annotations

import json
from copy import deepcopy

from ..analyst.llm_client import AnalystLlmClient, _extract_structured_json

PROMPT = """You write a short, actionable GC Market Profile observation plan in
Vietnamese with diacritics, using ONLY the supplied snapshot. Return one plan
per requestedScopes. Analyze carefully, but output only conclusions and the
few facts supporting them, not a long reasoning transcript or a catalog of levels.

SESSIONS are custom fixed UTC+7 windows, not exchange sessions: Asia 07:00-12:00,
EU 12:30-22:00, US 20:00-04:00 next day. EU/US overlap. GC daily profiles still
use the exchange calendar with DST. Never confuse daily VA with session VA.
Read openingContext first. Compare the actual session open to the previous
TRADING day's SAME-session close; state the gap and actual date if available.
Session close is the last M1 close, not settlement. If absent, say it is missing.
For Asia, explicitly locate the open/current price relative to the PREVIOUS US
SESSION's Volume VAL/VAH/POC. The user's working hypothesis is lighter Asian
participation and rotation between US VA edges when trapped inside it. This is
a hypothesis, not an observed volume fact or unconditional mean reversion.
If value is accepted outside, consider continuation without a full retest or a
shallow retest. For EU/US, use the same-session previous close as a premium/
discount reference, then check value and acceptance before stating a bias.
Being above/below a close alone never proves that buying/selling has an edge.
Use actual volume/TPO distributions and recent closed daily candles as supporting
evidence; distinguish Volume VA (primary) from TPO. Do not invent candle patterns,
news, options, participant intent, or a completed IB/developing daily candle.
Older plans may use obsolete sessions; current snapshot facts take priority.

OUTPUT: about 80-140 Vietnamese words per plan excluding alert explanations.
summary: one sentence with the preferred outlook or explicit waiting stance.
mpRead: at most two short sentences explaining opening location and main evidence.
dailyRead: one short supporting sentence. scenarios: one main and at most one
alternative; short condition, what to watch, and clear invalidation. Do not
list far-away targets, every possible direction, or repeat the MP paragraph.

ALERTS: daily plan is context only, so alerts=[]. Each session may select ZERO,
ONE or TWO decision zones, ranked by conviction. Do not fill a quota. For every
zone choose ONE exact existing levelRef, representing the strongest confluence
or the clearest acceptance/rejection boundary. Explain specific supporting
evidence and what reaction matters. Group nearby levels serving the same idea;
do not stack IB/low/VAL alerts next to each other for the same reaction. Do not
alert on a POC in the middle of a balanced range without a decisive reason,
or add a distant level merely because it exists. If evidence is weak, use zero
alerts and explain what is missing. No numeric probabilities or claimed win rate.
Alerts only call attention; trade timing and execution remain manual.
Raw internal levelRef codes belong ONLY in alert.levelRef; every prose field
must use readable level names/prices. Never invent an alert price.
"""


def _object(properties: dict) -> dict:
    return {"type": "object", "additionalProperties": False,
            "required": list(properties),
            # Each property needs its own schema object. deepcopy of a whole
            # graph preserves aliases: adding levelRef.enum to shared TEXT
            # would otherwise constrain every prose field to level IDs too.
            "properties": {key: deepcopy(value) for key, value in properties.items()}}


TEXT = {"type": "string"}
SCENARIO = _object({k: TEXT for k in ("title", "condition", "action", "invalidation")})
ALERT = _object({k: TEXT for k in ("levelRef", "reason", "scenario")})
PLAN = _object({
    "scope": {"type": "string", "enum": ["daily", "asia", "eu", "us"]},
    "summary": TEXT, "mpRead": TEXT, "dailyRead": TEXT,
    "scenarios": {"type": "array", "items": SCENARIO, "minItems": 1, "maxItems": 2},
    "invalidation": TEXT,
    "alerts": {"type": "array", "items": ALERT, "maxItems": 2},
})
SCHEMA = _object({"plans": {"type": "array", "items": PLAN, "minItems": 1, "maxItems": 2}})


class MpLlmClient(AnalystLlmClient):
    def configuration(self) -> dict:
        return {"model": self._model, "reasoningEffort": self._reasoning_effort}

    def analyze_plan(self, snapshot: dict) -> list[dict]:
        if not self.enabled:
            raise ValueError("Analyst LLM is not configured")
        schema = deepcopy(SCHEMA)
        plan_schema = schema["properties"]["plans"]
        plan_schema["minItems"] = plan_schema["maxItems"] = len(snapshot["requestedScopes"])
        plan_schema["items"]["properties"]["scope"]["enum"] = list(snapshot["requestedScopes"])
        plan_schema["items"]["properties"]["alerts"]["items"]["properties"]["levelRef"]["enum"] = list(snapshot["levels"])
        payload = {
            "model": self._model,
            "input": [{"role": "system", "content": PROMPT},
                      {"role": "user", "content": json.dumps(snapshot, ensure_ascii=False, separators=(",", ":"))}],
            # Reasoning tokens share this budget; the final report stays short.
            "max_output_tokens": 24000,
            "text": {"format": {"type": "json_schema", "name": "gc_mp_plans", "strict": True, "schema": schema}},
        }
        if self._reasoning_effort:
            payload["reasoning"] = {"effort": self._reasoning_effort}
        body = self._transport(self._url, payload, {
            "Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json",
        }, 300.0)
        result = _extract_structured_json(body)
        return validate_plans(result, snapshot)


def validate_plans(result: dict, snapshot: dict) -> list[dict]:
    plans = result.get("plans")
    if not isinstance(plans, list) or len(plans) != len(snapshot["requestedScopes"]):
        raise ValueError("LLM returned an unexpected number of plans")
    if sorted(p.get("scope", "") for p in plans if isinstance(p, dict)) != sorted(snapshot["requestedScopes"]):
        raise ValueError("LLM returned an unexpected plan scope")
    for plan in plans:
        for key, limit in (("summary", 500), ("mpRead", 1200), ("dailyRead", 500), ("invalidation", 450)):
            _text(plan.get(key), limit, snapshot["levels"])
        if any(len(plan[key].split()) < 4 for key in ("summary", "mpRead", "dailyRead")):
            raise ValueError("Report text must contain actual narrative analysis")
        scenarios = plan.get("scenarios")
        if not isinstance(scenarios, list) or not 1 <= len(scenarios) <= 2:
            raise ValueError("Invalid plan scenarios")
        for scenario in scenarios:
            if not isinstance(scenario, dict):
                raise ValueError("Invalid scenario")
            for key in ("title", "condition", "action", "invalidation"):
                _text(scenario.get(key), 400, snapshot["levels"])
        alerts = plan.get("alerts")
        limit = 0 if plan["scope"] == "daily" else 2
        if not isinstance(alerts, list) or len(alerts) > limit:
            raise ValueError("Alert policy allows no daily alerts and at most two session alerts")
        seen = set()
        prices = set()
        for alert in alerts:
            if not isinstance(alert, dict):
                raise ValueError("Invalid alert")
            ref = alert.get("levelRef")
            if not isinstance(ref, str) or ref not in snapshot["levels"] or ref in seen:
                raise ValueError("Alert references an unknown or duplicate snapshot level")
            seen.add(ref)
            price = round(snapshot["levels"][ref]["price"] * 10)
            if price in prices:
                raise ValueError("Alert policy requires one representative per price zone")
            prices.add(price)
            _text(alert.get("reason"), 350, snapshot["levels"])
            _text(alert.get("scenario"), 350, snapshot["levels"])
            alert.update(snapshot["levels"][ref])
        fixed = snapshot.get("fixedAlertsByScope", {}).get(plan["scope"])
        if fixed is not None and seen != set(fixed):
            raise ValueError("Report correction changed the existing alert levels")
    return plans


def _text(value, limit: int, level_refs: dict | None = None) -> None:
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise ValueError("Invalid or excessively long report text")
    if level_refs and any(ref in value for ref in level_refs):
        raise ValueError("Report text contains internal level references instead of readable analysis")
