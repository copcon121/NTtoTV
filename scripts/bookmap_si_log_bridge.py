from __future__ import annotations

import argparse
import glob
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_LOG_DIR = r"C:\Bookmap\Logs"
DEFAULT_BACKEND_URL = "http://127.0.0.1:8000/api/bookmap/si/events"
SI_PROVIDER = "velox.indicators.sionchart.SitIndicator"

BOOKMAP_TS_RE = re.compile(
    r"^(?P<date>\d{8})\s+(?P<time>\d{2}:\d{2}:\d{2}\.\d{3})\(UTC\)"
)
ALERT_RE = re.compile(
    r"Layer1ApiSoundAlertMessage \["
    r".*?textInfo='(?P<text>[^']+)'"
    r".*?alertId='(?P<alert_id>[^']*)'"
    r".*?source=class velox\.indicators\.sionchart\.SitIndicator"
    r".*?metadata=(?P<metadata>[^,\]]+)",
)
TEXT_RE = re.compile(
    r"\b(?P<kind>Iceberg|Stop|Stops)\b\s+"
    r"(?P<instrument>\S+)\s+"
    r"(?P<side>buy|sell)\s+at\s+"
    r"(?P<price>[0-9]+(?:\.[0-9]+)?)\s+(?:crossed|volume)\s+"
    r"(?P<size>[0-9]+(?:\.[0-9]+)?)",
    re.IGNORECASE,
)


def latest_common_log(log_dir: str) -> str | None:
    paths = glob.glob(str(Path(log_dir) / "log_*-common.txt"))
    if not paths:
        return None
    return max(paths, key=lambda path: os.path.getmtime(path))


def load_state(path: str) -> dict[str, Any]:
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
            return data if isinstance(data, dict) else {}
    except FileNotFoundError:
        return {}
    except (OSError, json.JSONDecodeError):
        return {}


def save_state(path: str, state: dict[str, Any]) -> None:
    state_path = Path(path)
    state_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = state_path.with_suffix(state_path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(state, fh, separators=(",", ":"))
    os.replace(tmp, state_path)


def parse_time_ms(line: str, fallback_ms: int) -> int:
    match = BOOKMAP_TS_RE.match(line)
    if not match:
        return fallback_ms
    value = f"{match.group('date')} {match.group('time')}"
    try:
        dt = datetime.strptime(value, "%Y%m%d %H:%M:%S.%f").replace(
            tzinfo=timezone.utc
        )
        return int(dt.timestamp() * 1000)
    except ValueError:
        return fallback_ms


def parse_alert_line(line: str, *, pips: float, size_multiplier: float) -> dict[str, Any] | None:
    alert_match = ALERT_RE.search(line)
    if not alert_match:
        return None

    text = alert_match.group("text")
    text_match = TEXT_RE.search(text)
    if not text_match:
        return None

    kind = text_match.group("kind").lower()
    event_kind = "stop" if kind.startswith("stop") else "iceberg"
    side = text_match.group("side").lower()
    price = float(text_match.group("price"))
    size = float(text_match.group("size"))
    metadata = alert_match.group("metadata").strip()
    alias = metadata if metadata and metadata.lower() != "null" else text_match.group("instrument")
    alert_id = alert_match.group("alert_id") or f"{alias}:{text}"
    time_ms = parse_time_ms(line, int(time.time() * 1000))
    raw_price = int(round(price / pips)) if pips else 0
    raw_size = int(round(size * size_multiplier))

    return {
        "type": "bookmap_si_event",
        "symbol": os.getenv("NTTOTV_BOOKMAP_SYMBOL", "GC"),
        "contract": os.getenv("NTTOTV_BOOKMAP_CONTRACT", "GC"),
        "alias": alias,
        "provider": SI_PROVIDER,
        "source": "bookmap_log",
        "eventKind": event_kind,
        "eventType": "ALERT",
        "time": time_ms,
        "price": price,
        "rawPrice": raw_price,
        "size": size,
        "rawSize": raw_size,
        "totalSize": size,
        "rawTotalSize": raw_size,
        "isBid": side == "buy",
        "orderId": alert_id,
    }


def post_event(url: str, payload: dict[str, Any]) -> None:
    data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=3) as response:
        response.read()


def run(args: argparse.Namespace) -> int:
    pips = float(os.getenv("NTTOTV_BOOKMAP_PIPS", "0.1"))
    size_multiplier = float(os.getenv("NTTOTV_BOOKMAP_SIZE_MULTIPLIER", "1"))
    state = load_state(args.state_file)
    seen: set[str] = set(state.get("seenAlertIds", []))
    current_path = state.get("path")
    offset = int(state.get("offset", 0))
    posted = 0

    while True:
        latest = latest_common_log(args.log_dir)
        if latest is None:
            time.sleep(args.poll_seconds)
            continue

        if latest != current_path:
            current_path = latest
            offset = 0
            print(f"watching {current_path}", flush=True)

        try:
            with open(current_path, "r", encoding="utf-8", errors="replace") as fh:
                fh.seek(offset)
                for line in fh:
                    event = parse_alert_line(
                        line, pips=pips, size_multiplier=size_multiplier
                    )
                    if event is None:
                        continue
                    alert_id = str(event["orderId"])
                    if alert_id in seen:
                        continue
                    try:
                        post_event(args.backend_url, event)
                    except (OSError, urllib.error.URLError) as exc:
                        print(f"post failed: {exc}", file=sys.stderr, flush=True)
                        continue
                    seen.add(alert_id)
                    posted += 1
                    print(
                        "posted {kind} {side} {price} {size} {alias}".format(
                            kind=event["eventKind"],
                            side="bid" if event["isBid"] else "ask",
                            price=event["price"],
                            size=event["size"],
                            alias=event["alias"],
                        ),
                        flush=True,
                    )
                offset = fh.tell()
        except OSError as exc:
            print(f"read failed: {exc}", file=sys.stderr, flush=True)

        state = {
            "path": current_path,
            "offset": offset,
            "seenAlertIds": sorted(seen)[-1000:],
        }
        save_state(args.state_file, state)

        if args.once:
            print(f"posted={posted}", flush=True)
            return 0
        time.sleep(args.poll_seconds)


def main() -> int:
    parser = argparse.ArgumentParser(description="Bridge Bookmap SI sound alerts to NTtoTV.")
    parser.add_argument("--log-dir", default=DEFAULT_LOG_DIR)
    parser.add_argument("--backend-url", default=DEFAULT_BACKEND_URL)
    parser.add_argument(
        "--state-file",
        default=r"C:\Users\Administrator\Desktop\NTtoTV\_run_logs\bookmap-si-log-bridge\state.json",
    )
    parser.add_argument("--poll-seconds", type=float, default=1.0)
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main())
