"""OpenAI-compatible chat completion requests for AI Scan."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

from .ai_config import AiScanConfig

MAX_RESPONSE_BYTES = 2_000_000


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


@dataclass(frozen=True)
class AiReply:
    http_status: int | None
    content: str
    error: str | None = None

    def public(self) -> dict[str, Any]:
        return {"ok": self.http_status == 200 and self.error is None, "httpStatus": self.http_status, "content": self.content, "error": self.error}


def chat_completion(
    config: AiScanConfig,
    messages: list[dict[str, str]],
    *, json_mode: bool = False,
) -> AiReply:
    if not config.api_key:
        return AiReply(None, "", "Configure NINEROUTER_API_KEY or save an API key in admin.")
    payload: dict[str, Any] = {
        "model": config.model,
        "messages": messages,
        "stream": False,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    request = urllib.request.Request(
        config.endpoint,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": "Bearer " + config.api_key, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        # Do not forward the Authorization header to a redirect target.
        with urllib.request.build_opener(_NoRedirect()).open(request, timeout=45) as response:
            status = response.status
            raw = response.read(MAX_RESPONSE_BYTES + 1)
    except urllib.error.HTTPError as exc:
        detail = exc.read(4096).decode("utf-8", errors="replace").replace(config.api_key, "[redacted]")
        return AiReply(exc.code, "", detail)
    except (OSError, TimeoutError, ValueError) as exc:
        error = str(exc).replace(config.api_key, "[redacted]")
        return AiReply(None, "", error)
    if len(raw) > MAX_RESPONSE_BYTES:
        return AiReply(status, "", "AI response exceeded the size limit.")
    try:
        body = json.loads(raw)
        choices = body.get("choices") if isinstance(body, dict) else None
        if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
            return AiReply(status, "", "AI response is missing choices.")
        message = choices[0].get("message")
        content = message.get("content") if isinstance(message, dict) else None
        if isinstance(content, list):
            content = "".join(part.get("text", "") for part in content if isinstance(part, dict) and isinstance(part.get("text"), str))
        if not isinstance(content, str) or not content.strip():
            return AiReply(status, "", "AI response is missing message content.")
        return AiReply(status, content.replace(config.api_key, "[redacted]"))
    except (ValueError, TypeError) as exc:
        return AiReply(status, "", "AI response is not valid JSON.")
