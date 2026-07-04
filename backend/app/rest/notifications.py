"""REST endpoints for alert notification delivery integrations."""

from __future__ import annotations

import base64
import json
import logging
import secrets
import urllib.error
import urllib.parse
import urllib.request
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from starlette.concurrency import run_in_threadpool

from ..analyst.poi_models import PoiEvent
from ..analyst.schemas import AnalystReport
from ..models.messages import AlertEvent
from ..models.timestamp import now_ms
from ..storage.cache_store import CacheStore
from .alerts import get_cache
from .errors import bad_request, validation_error

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

_TELEGRAM_META_PREFIX = "notification.telegram."
_WEBPUSH_CONFIG_META_PREFIX = "notification.webpush.config."
_WEBPUSH_SUBSCRIPTIONS_META_PREFIX = "notification.webpush.subscriptions."
_WEBPUSH_VAPID_META_KEY = "notification.webpush.vapid"
_WEBPUSH_VAPID_SUBJECT = "mailto:alerts@gcflowpy.xyz"

logger = logging.getLogger(__name__)


def _normalize_profile_id(value: Any) -> str:
    if value is None:
        return "default"
    if not isinstance(value, str):
        raise validation_error("'profileId' must be a string", field="profileId")
    value = value.strip()
    if not value:
        raise validation_error("'profileId' must be a non-empty string", field="profileId")
    return value


def _meta_key(profile_id: str) -> str:
    return f"{_TELEGRAM_META_PREFIX}{profile_id}"


def _default_config() -> dict[str, Any]:
    return {
        "enabled": False,
        "botToken": "",
        "chatId": "",
        "sendScreenshot": True,
    }


def _read_config(cache: CacheStore, profile_id: str) -> dict[str, Any]:
    raw = cache.get_metadata(_meta_key(profile_id))
    if raw is None:
        return _default_config()
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return _default_config()
    if not isinstance(parsed, dict):
        return _default_config()
    return {
        **_default_config(),
        **parsed,
    }


def _public_config(config: dict[str, Any]) -> dict[str, Any]:
    token = str(config.get("botToken", "")).strip()
    return {
        "enabled": bool(config.get("enabled", False)),
        "chatId": str(config.get("chatId", "")),
        "sendScreenshot": bool(config.get("sendScreenshot", True)),
        "hasBotToken": bool(token),
    }


def _save_config(cache: CacheStore, profile_id: str, config: dict[str, Any]) -> None:
    cache.set_metadata(
        _meta_key(profile_id),
        json.dumps(config, separators=(",", ":")),
        now_ms(),
    )

def _webpush_config_key(profile_id: str) -> str:
    return f"{_WEBPUSH_CONFIG_META_PREFIX}{profile_id}"

def _webpush_subscriptions_key(profile_id: str) -> str:
    return f"{_WEBPUSH_SUBSCRIPTIONS_META_PREFIX}{profile_id}"

def _default_webpush_config() -> dict[str, Any]:
    return {"enabled": False}

def _read_webpush_config(cache: CacheStore, profile_id: str) -> dict[str, Any]:
    raw = cache.get_metadata(_webpush_config_key(profile_id))
    if raw is None:
        return _default_webpush_config()
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return _default_webpush_config()
    if not isinstance(parsed, dict):
        return _default_webpush_config()
    return {**_default_webpush_config(), **parsed}

def _save_webpush_config(
    cache: CacheStore,
    profile_id: str,
    config: dict[str, Any],
) -> None:
    cache.set_metadata(
        _webpush_config_key(profile_id),
        json.dumps(config, separators=(",", ":")),
        now_ms(),
    )

def _read_webpush_subscriptions(
    cache: CacheStore,
    profile_id: str,
) -> list[dict[str, Any]]:
    raw = cache.get_metadata(_webpush_subscriptions_key(profile_id))
    if raw is None:
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [item for item in parsed if isinstance(item, dict)]

def _save_webpush_subscriptions(
    cache: CacheStore,
    profile_id: str,
    subscriptions: list[dict[str, Any]],
) -> None:
    cache.set_metadata(
        _webpush_subscriptions_key(profile_id),
        json.dumps(subscriptions, separators=(",", ":")),
        now_ms(),
    )

def _public_webpush_config(
    cache: CacheStore,
    profile_id: str,
    *,
    public_key: str | None = None,
) -> dict[str, Any]:
    config = _read_webpush_config(cache, profile_id)
    subscriptions = _read_webpush_subscriptions(cache, profile_id)
    return {
        "enabled": bool(config.get("enabled", False)),
        "subscriptionCount": len(subscriptions),
        "publicKey": public_key if public_key is not None else _ensure_vapid_keys(cache)["publicKey"],
    }


def _validate_update(body: dict[str, Any], existing: dict[str, Any]) -> dict[str, Any]:
    next_config = {**existing}
    if "enabled" in body:
        if not isinstance(body["enabled"], bool):
            raise validation_error("'enabled' must be a boolean", field="enabled")
        next_config["enabled"] = body["enabled"]
    if "sendScreenshot" in body:
        if not isinstance(body["sendScreenshot"], bool):
            raise validation_error(
                "'sendScreenshot' must be a boolean",
                field="sendScreenshot",
            )
        next_config["sendScreenshot"] = body["sendScreenshot"]
    if "chatId" in body:
        if not isinstance(body["chatId"], str):
            raise validation_error("'chatId' must be a string", field="chatId")
        next_config["chatId"] = body["chatId"].strip()
    if "botToken" in body:
        if not isinstance(body["botToken"], str):
            raise validation_error("'botToken' must be a string", field="botToken")
        next_config["botToken"] = body["botToken"].strip()
    return next_config

def _validate_webpush_update(
    body: dict[str, Any],
    existing: dict[str, Any],
) -> dict[str, Any]:
    next_config = {**existing}
    if "enabled" in body:
        if not isinstance(body["enabled"], bool):
            raise validation_error("'enabled' must be a boolean", field="enabled")
        next_config["enabled"] = body["enabled"]
    return next_config

def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")

def _generate_vapid_keys() -> dict[str, str]:
    try:
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.hazmat.primitives.serialization import (
            Encoding,
            PublicFormat,
        )
    except ImportError as exc:
        raise bad_request("Web Push dependency is not installed") from exc

    private_key = ec.generate_private_key(ec.SECP256R1())
    private_value = private_key.private_numbers().private_value.to_bytes(32, "big")
    public_value = private_key.public_key().public_bytes(
        Encoding.X962,
        PublicFormat.UncompressedPoint,
    )
    return {
        "privateKey": _b64url(private_value),
        "publicKey": _b64url(public_value),
    }

def _ensure_vapid_keys(cache: CacheStore) -> dict[str, str]:
    raw = cache.get_metadata(_WEBPUSH_VAPID_META_KEY)
    if raw is not None:
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = None
        if (
            isinstance(parsed, dict)
            and isinstance(parsed.get("privateKey"), str)
            and isinstance(parsed.get("publicKey"), str)
            and parsed["privateKey"].strip()
            and parsed["publicKey"].strip()
        ):
            return {
                "privateKey": parsed["privateKey"].strip(),
                "publicKey": parsed["publicKey"].strip(),
            }

    keys = _generate_vapid_keys()
    cache.set_metadata(
        _WEBPUSH_VAPID_META_KEY,
        json.dumps(keys, separators=(",", ":")),
        now_ms(),
    )
    return keys

def _validate_webpush_subscription(body: dict[str, Any]) -> dict[str, Any]:
    endpoint = body.get("endpoint")
    keys = body.get("keys")
    if not isinstance(endpoint, str) or not endpoint.strip():
        raise validation_error("'endpoint' must be a non-empty string", field="endpoint")
    if not endpoint.startswith(("https://", "http://localhost")):
        raise validation_error("'endpoint' must be an HTTPS URL", field="endpoint")
    if not isinstance(keys, dict):
        raise validation_error("'keys' must be an object", field="keys")
    p256dh = keys.get("p256dh")
    auth = keys.get("auth")
    if not isinstance(p256dh, str) or not p256dh.strip():
        raise validation_error("'keys.p256dh' must be a non-empty string", field="keys.p256dh")
    if not isinstance(auth, str) or not auth.strip():
        raise validation_error("'keys.auth' must be a non-empty string", field="keys.auth")

    expiration_time = body.get("expirationTime")
    if expiration_time is not None and not isinstance(expiration_time, (int, float)):
        expiration_time = None
    return {
        "endpoint": endpoint.strip(),
        "expirationTime": expiration_time,
        "keys": {
            "p256dh": p256dh.strip(),
            "auth": auth.strip(),
        },
        "createdAt": now_ms(),
        "updatedAt": now_ms(),
    }

def _upsert_webpush_subscription(
    cache: CacheStore,
    profile_id: str,
    subscription: dict[str, Any],
) -> None:
    existing = _read_webpush_subscriptions(cache, profile_id)
    next_items: list[dict[str, Any]] = []
    replaced = False
    for item in existing:
        if item.get("endpoint") == subscription["endpoint"]:
            next_items.append({
                **subscription,
                "createdAt": item.get("createdAt", subscription["createdAt"]),
            })
            replaced = True
        else:
            next_items.append(item)
    if not replaced:
        next_items.append(subscription)
    _save_webpush_subscriptions(cache, profile_id, next_items)

def _delete_webpush_subscription(
    cache: CacheStore,
    profile_id: str,
    endpoint: str,
) -> bool:
    existing = _read_webpush_subscriptions(cache, profile_id)
    next_items = [item for item in existing if item.get("endpoint") != endpoint]
    if len(next_items) == len(existing):
        return False
    _save_webpush_subscriptions(cache, profile_id, next_items)
    return True


def _require_sendable(config: dict[str, Any]) -> tuple[str, str]:
    token = str(config.get("botToken", "")).strip()
    chat_id = str(config.get("chatId", "")).strip()
    if not token:
        raise validation_error("Telegram bot token is not configured", field="botToken")
    if not chat_id:
        raise validation_error("Telegram chat id is not configured", field="chatId")
    return token, chat_id


def _decode_data_url(data_url: str) -> tuple[bytes, str]:
    header, sep, payload = data_url.partition(",")
    if sep != "," or not header.startswith("data:image/"):
        raise validation_error(
            "'screenshotDataUrl' must be an image data URL",
            field="screenshotDataUrl",
        )
    content_type = header.removeprefix("data:").split(";", 1)[0] or "image/png"
    try:
        return base64.b64decode(payload, validate=True), content_type
    except ValueError:
        raise validation_error(
            "'screenshotDataUrl' must contain base64 image data",
            field="screenshotDataUrl",
        )


def _telegram_request_json(token: str, method: str, payload: dict[str, Any]) -> dict[str, Any]:
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/{method}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise bad_request(f"Telegram API error: {detail}")
    except urllib.error.URLError as exc:
        raise bad_request(f"Telegram API request failed: {exc.reason}")


def _multipart_body(
    fields: dict[str, str],
    *,
    file_field: str,
    filename: str,
    content_type: str,
    content: bytes,
) -> tuple[bytes, str]:
    boundary = f"gcchart-{secrets.token_hex(12)}"
    parts: list[bytes] = []
    for key, value in fields.items():
        parts.extend(
            [
                f"--{boundary}\r\n".encode("ascii"),
                f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode(
                    "ascii"
                ),
                value.encode("utf-8"),
                b"\r\n",
            ]
        )
    parts.extend(
        [
            f"--{boundary}\r\n".encode("ascii"),
            (
                f'Content-Disposition: form-data; name="{file_field}"; '
                f'filename="{filename}"\r\n'
            ).encode("ascii"),
            f"Content-Type: {content_type}\r\n\r\n".encode("ascii"),
            content,
            b"\r\n",
            f"--{boundary}--\r\n".encode("ascii"),
        ]
    )
    return b"".join(parts), boundary


def _telegram_request_photo(
    token: str,
    *,
    chat_id: str,
    caption: str,
    image: bytes,
    content_type: str,
) -> dict[str, Any]:
    body, boundary = _multipart_body(
        {
            "chat_id": chat_id,
            "caption": caption,
        },
        file_field="photo",
        filename="chart.png",
        content_type=content_type,
        content=image,
    )
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendPhoto",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise bad_request(f"Telegram API error: {detail}")
    except urllib.error.URLError as exc:
        raise bad_request(f"Telegram API request failed: {exc.reason}")


def _send_telegram(
    config: dict[str, Any],
    *,
    message: str,
    screenshot_data_url: str | None = None,
) -> dict[str, Any]:
    token, chat_id = _require_sendable(config)
    if screenshot_data_url:
        image, content_type = _decode_data_url(screenshot_data_url)
        return _telegram_request_photo(
            token,
            chat_id=chat_id,
            caption=message,
            image=image,
            content_type=content_type,
        )
    return _telegram_request_json(
        token,
        "sendMessage",
        {
            "chat_id": chat_id,
            "text": message,
        },
    )


def format_telegram_alert_message(event: AlertEvent) -> str:
    """Format the backend text-only alert notification body."""
    timestamp = datetime.fromtimestamp(event.time / 1000, UTC).strftime(
        "%Y-%m-%d %H:%M:%S"
    )
    return "\n".join(
        [
            event.message,
            f"{event.symbol} {event.contract}",
            f"Price: {event.price:.1f}",
            f"Time: {timestamp} UTC",
        ]
    )


def _label(value: str) -> str:
    return {
        "bullish": "Tăng",
        "bearish": "Giảm",
        "range": "Sideway",
        "unknown": "Chưa rõ",
        "no_trade": "Không trade",
        "wait_for_buy": "Chờ mua",
        "wait_for_sell": "Chờ bán",
        "buy_candidate": "Mua tiềm năng",
        "sell_candidate": "Bán tiềm năng",
        "wait": "Chờ",
        "candidate": "Có setup",
    }.get(value, value.replace("_", " "))


def format_telegram_analyst_report_message(report: AnalystReport) -> str:
    timestamp = datetime.fromtimestamp(report.created_at / 1000, UTC).strftime(
        "%Y-%m-%d %H:%M:%S"
    )
    reasons = "\n".join(f"- {reason}" for reason in report.reason[:3])
    return "\n".join(
        [
            f"AI đọc market {report.symbol} {report.contract}",
            f"Quyết định: {_label(report.decision)} ({report.decision})",
            f"Bias: {_label(report.bias)} ({report.bias})",
            f"Độ tin cậy: {round(max(0.0, min(1.0, report.confidence)) * 100)}%",
            f"Rủi ro: {_label(report.risk_state)}",
            "Lý do:",
            reasons,
            f"Vô hiệu nếu: {report.invalid_if}",
            f"Xác nhận tiếp theo: {report.next_confirmation}",
            f"Thời gian: {timestamp} UTC",
            "Auto-trade: false",
        ]
    )


def format_telegram_poi_event_message(event: PoiEvent) -> str:
    timestamp = datetime.fromtimestamp(event.created_at / 1000, UTC).strftime(
        "%Y-%m-%d %H:%M:%S"
    )
    response = event.response or {}
    active = event.input_snapshot.get("activePoi", {})
    reasons = response.get("reason", [])
    if isinstance(reasons, str):
        reasons = [reasons]
    if not isinstance(reasons, list):
        reasons = []
    reason_text = "\n".join(f"- {str(reason)}" for reason in reasons[:3])
    poi_summary = str(response.get("activePoiSummary", "")).strip()
    if not poi_summary:
        poi_summary = (
            f"{active.get('timeframe', '')} {active.get('side', '')} "
            f"{active.get('kind', '')} {active.get('bottom')}-{active.get('top')}"
        ).strip()
    decision = str(response.get("decision", event.decision or "unknown"))
    bias = str(response.get("bias", "unknown"))
    risk_state = str(response.get("riskState", "no_trade"))
    confidence = event.confidence
    if confidence is None:
        try:
            confidence = float(response.get("confidence", 0.0))
        except (TypeError, ValueError):
            confidence = 0.0
    return "\n".join(
        [
            f"AI POI scanner {event.symbol} {event.contract}",
            f"Event: {event.event_type}",
            f"POI: {poi_summary}",
            f"Quyết định: {_label(decision)} ({decision})",
            f"Bias: {_label(bias)} ({bias})",
            f"Độ tin cậy: {round(max(0.0, min(1.0, confidence)) * 100)}%",
            f"Rủi ro: {_label(risk_state)}",
            "Lý do:",
            reason_text or "- Không có lý do.",
            f"Vô hiệu nếu: {response.get('invalidIf', '')}",
            f"Xác nhận tiếp theo: {response.get('nextConfirmation', '')}",
            f"Thời gian: {timestamp} UTC",
            "Auto-trade: false",
        ]
    )


def send_telegram_message_for_profile(
    cache: CacheStore,
    profile_id: str,
    *,
    message: str,
    screenshot_data_url: str | None = None,
) -> dict[str, Any]:
    config = _read_config(cache, profile_id)
    if not bool(config.get("enabled", False)):
        return {"sent": False, "reason": "disabled"}
    token = str(config.get("botToken", "")).strip()
    chat_id = str(config.get("chatId", "")).strip()
    if not token or not chat_id:
        return {"sent": False, "reason": "not_configured"}
    if not bool(config.get("sendScreenshot", True)):
        screenshot_data_url = None
    _send_telegram(config, message=message, screenshot_data_url=screenshot_data_url)
    return {"sent": True}


def send_telegram_analyst_report(
    cache: CacheStore,
    profile_id: str,
    report: AnalystReport,
) -> dict[str, Any]:
    return send_telegram_message_for_profile(
        cache,
        profile_id,
        message=format_telegram_analyst_report_message(report),
    )


def send_telegram_poi_event(
    cache: CacheStore,
    profile_id: str,
    event: PoiEvent,
) -> dict[str, Any]:
    return send_telegram_message_for_profile(
        cache,
        profile_id,
        message=format_telegram_poi_event_message(event),
    )


def send_telegram_alert_from_event(
    cache: CacheStore,
    event: AlertEvent,
    *,
    message: str | None = None,
    screenshot_data_url: str | None = None,
) -> dict[str, Any]:
    """Send a configured Telegram notification for an alert event.

    This is used by the REST endpoint when the frontend provides a screenshot
    and by the ingest pipeline as a text-only fallback when no chart client is
    connected.
    """
    return send_telegram_message_for_profile(
        cache,
        event.profile_id,
        message=message if message is not None else format_telegram_alert_message(event),
        screenshot_data_url=screenshot_data_url,
    )


def _webpush_payload(
    *,
    title: str,
    body: str,
    tag: str,
    url: str = "/",
) -> dict[str, Any]:
    return {
        "title": title,
        "body": body,
        "tag": tag,
        "url": url,
        "data": {"url": url},
    }


def _webpush_alert_payload(event: AlertEvent) -> dict[str, Any]:
    return _webpush_payload(
        title=f"{event.symbol} alert",
        body=event.message,
        tag=f"alert:{event.profile_id}:{event.alert_id}:{event.time}",
        url="/",
    )


def _send_web_push_to_subscription(
    subscription: dict[str, Any],
    payload: dict[str, Any],
    *,
    vapid_private_key: str,
    ttl: int,
) -> None:
    try:
        from pywebpush import webpush
    except ImportError as exc:
        raise bad_request("Web Push dependency is not installed") from exc

    webpush(
        subscription_info={
            "endpoint": subscription["endpoint"],
            "keys": subscription["keys"],
        },
        data=json.dumps(payload, separators=(",", ":")),
        vapid_private_key=vapid_private_key,
        vapid_claims={"sub": _WEBPUSH_VAPID_SUBJECT},
        ttl=ttl,
        timeout=15,
    )


def _webpush_status_code(exc: Exception) -> int | None:
    response = getattr(exc, "response", None)
    status_code = getattr(response, "status_code", None)
    return status_code if isinstance(status_code, int) else None


def send_web_push_message_for_profile(
    cache: CacheStore,
    profile_id: str,
    payload: dict[str, Any],
    *,
    ttl: int = 3600,
) -> dict[str, Any]:
    config = _read_webpush_config(cache, profile_id)
    if not bool(config.get("enabled", False)):
        return {"sent": 0, "removed": 0, "failed": 0, "reason": "disabled"}

    subscriptions = _read_webpush_subscriptions(cache, profile_id)
    if not subscriptions:
        return {"sent": 0, "removed": 0, "failed": 0, "reason": "no_subscriptions"}

    keys = _ensure_vapid_keys(cache)
    sent = 0
    failed = 0
    removed_endpoints: set[str] = set()
    for subscription in subscriptions:
        endpoint = str(subscription.get("endpoint", ""))
        try:
            _send_web_push_to_subscription(
                subscription,
                payload,
                vapid_private_key=keys["privateKey"],
                ttl=ttl,
            )
            sent += 1
        except Exception as exc:
            status_code = _webpush_status_code(exc)
            if status_code in {404, 410} and endpoint:
                removed_endpoints.add(endpoint)
            else:
                failed += 1
                logger.warning("web push failed for profile %s: %s", profile_id, exc)

    if removed_endpoints:
        remaining = [
            item
            for item in subscriptions
            if str(item.get("endpoint", "")) not in removed_endpoints
        ]
        _save_webpush_subscriptions(cache, profile_id, remaining)

    return {"sent": sent, "removed": len(removed_endpoints), "failed": failed}


def send_web_push_alert_from_event(
    cache: CacheStore,
    event: AlertEvent,
) -> dict[str, Any]:
    return send_web_push_message_for_profile(
        cache,
        event.profile_id,
        _webpush_alert_payload(event),
        ttl=3600,
    )


@router.get("/telegram")
async def get_telegram_config(
    profile_id: str = Query("default", alias="profileId"),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    profile_id = _normalize_profile_id(profile_id)
    return {"telegram": _public_config(_read_config(cache, profile_id))}


@router.get("/webpush")
async def get_webpush_config(
    profile_id: str = Query("default", alias="profileId"),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    profile_id = _normalize_profile_id(profile_id)
    return {"webPush": _public_webpush_config(cache, profile_id)}


@router.put("/webpush")
async def update_webpush_config(
    request: Request,
    profile_id: str = Query("default", alias="profileId"),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    profile_id = _normalize_profile_id(profile_id)
    try:
        body = await request.json()
    except Exception:
        raise bad_request("Request body must be valid JSON")
    if not isinstance(body, dict):
        raise bad_request("Request body must be a JSON object")
    config = _validate_webpush_update(body, _read_webpush_config(cache, profile_id))
    _save_webpush_config(cache, profile_id, config)
    return {"webPush": _public_webpush_config(cache, profile_id)}


@router.post("/webpush/subscription")
async def save_webpush_subscription(
    request: Request,
    profile_id: str = Query("default", alias="profileId"),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    profile_id = _normalize_profile_id(profile_id)
    try:
        body = await request.json()
    except Exception:
        raise bad_request("Request body must be valid JSON")
    if not isinstance(body, dict):
        raise bad_request("Request body must be a JSON object")
    subscription = _validate_webpush_subscription(body)
    _upsert_webpush_subscription(cache, profile_id, subscription)
    config = _read_webpush_config(cache, profile_id)
    config["enabled"] = True
    _save_webpush_config(cache, profile_id, config)
    return {"webPush": _public_webpush_config(cache, profile_id)}


@router.delete("/webpush/subscription")
async def delete_webpush_subscription(
    request: Request,
    profile_id: str = Query("default", alias="profileId"),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    profile_id = _normalize_profile_id(profile_id)
    try:
        body = await request.json()
    except Exception:
        raise bad_request("Request body must be valid JSON")
    if not isinstance(body, dict):
        raise bad_request("Request body must be a JSON object")
    endpoint = body.get("endpoint")
    if not isinstance(endpoint, str) or not endpoint.strip():
        raise validation_error("'endpoint' must be a non-empty string", field="endpoint")
    _delete_webpush_subscription(cache, profile_id, endpoint.strip())
    return {"webPush": _public_webpush_config(cache, profile_id)}


@router.post("/webpush/test")
async def test_webpush_config(
    profile_id: str = Query("default", alias="profileId"),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    profile_id = _normalize_profile_id(profile_id)
    return await run_in_threadpool(
        send_web_push_message_for_profile,
        cache,
        profile_id,
        _webpush_payload(
            title="GC Chart",
            body="Web Push test notification",
            tag=f"test:{profile_id}:{now_ms()}",
            url="/",
        ),
    )


@router.put("/telegram")
async def update_telegram_config(
    request: Request,
    profile_id: str = Query("default", alias="profileId"),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    profile_id = _normalize_profile_id(profile_id)
    try:
        body = await request.json()
    except Exception:
        raise bad_request("Request body must be valid JSON")
    if not isinstance(body, dict):
        raise bad_request("Request body must be a JSON object")
    config = _validate_update(body, _read_config(cache, profile_id))
    _save_config(cache, profile_id, config)
    return {"telegram": _public_config(config)}


@router.post("/telegram/test")
async def test_telegram_config(
    profile_id: str = Query("default", alias="profileId"),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    profile_id = _normalize_profile_id(profile_id)
    config = _read_config(cache, profile_id)
    await run_in_threadpool(
        _send_telegram,
        config,
        message="GC Chart alert test",
    )
    return {"sent": True}


@router.post("/telegram/alert")
async def send_telegram_alert(
    request: Request,
    profile_id: str = Query("default", alias="profileId"),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    profile_id = _normalize_profile_id(profile_id)
    try:
        body = await request.json()
    except Exception:
        raise bad_request("Request body must be valid JSON")
    if not isinstance(body, dict):
        raise bad_request("Request body must be a JSON object")
    message = body.get("message")
    if not isinstance(message, str) or not message.strip():
        raise validation_error("'message' must be a non-empty string", field="message")
    screenshot_data_url = body.get("screenshotDataUrl")
    if screenshot_data_url is not None and not isinstance(screenshot_data_url, str):
        raise validation_error(
            "'screenshotDataUrl' must be a string",
            field="screenshotDataUrl",
        )
    event = AlertEvent(
        alert_id=str(body.get("alertId", "")),
        alert_type=str(body.get("alertType", "")),
        symbol=str(body.get("symbol", "")),
        contract=str(body.get("contract", "")),
        time=int(body.get("time", 0)),
        price=float(body.get("price", 0.0)),
        message=message.strip(),
        profile_id=profile_id,
    )

    return await run_in_threadpool(
        send_telegram_alert_from_event,
        cache,
        event,
        message=message.strip(),
        screenshot_data_url=screenshot_data_url,
    )
