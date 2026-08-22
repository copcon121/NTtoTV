"""Anonymous load test for the public GC chart.

This intentionally exercises only read-only, unauthenticated traffic:

* the public HTML page and its hashed JS/CSS assets;
* the read-only chart REST endpoints used during an initial chart load; and
* an anonymous ``/ws/chart`` connection with the same subscriptions as the
  live chart.

Run with the repository's backend virtual environment, for example:

    backend\\.venv\\Scripts\\python.exe scripts\\AnonymousLoadTest.py

The default stages are deliberately conservative. Increase them only after
reviewing the previous stage's result and the backend/Caddy resource usage.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import math
import re
import statistics
import sys
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urljoin, urlparse

try:
    import httpx
except ImportError as exc:  # pragma: no cover - exercised on a missing local dependency
    raise SystemExit(
        "httpx is required. Run backend\\.venv\\Scripts\\python.exe -m "
        "pip install httpx"
    ) from exc

try:
    try:
        from websockets.asyncio.client import connect as websocket_connect
    except ImportError:  # websockets < 14
        from websockets import connect as websocket_connect
except ImportError as exc:  # pragma: no cover - exercised on a missing local dependency
    raise SystemExit(
        "websockets is required. Run backend\\.venv\\Scripts\\python.exe -m "
        "pip install websockets"
    ) from exc


DEFAULT_BASE_URL = "https://gcflowpy.xyz"
DEFAULT_STAGES = "5:15,10:20,25:25,50:25"
DEFAULT_TIMEOUT_SECONDS = 15.0
DEFAULT_P95_LIMIT_MS = 2_000.0
DEFAULT_ERROR_RATE_LIMIT = 0.01

SUBSCRIPTIONS = (
    {
        "type": "subscribe",
        "symbol": "GC",
        "events": [
            "quote_update",
            "market_data_status",
            "alert_event",
            "order_update",
            "position_update",
            "account_update",
            "basis_update",
            "risk_update",
            "status",
        ],
    },
    {
        "type": "subscribe",
        "symbol": "GC",
        "events": ["bar_update", "volume_delta_update", "fvg_signal_update"],
        "tf": "1m",
    },
    {
        "type": "subscribe",
        "symbol": "GC",
        "events": ["footprint_update"],
        "tf": "1m",
    },
    {"type": "subscribe", "symbol": "GC", "events": ["big_trade"]},
)

READ_ENDPOINTS = (
    ("health", "/api/health"),
    ("contracts", "/api/contracts?symbol=GC"),
    (
        "history",
        "/api/history?symbol=GC&contract=GC&tf=1m&limit=4320",
    ),
    (
        "volume_delta",
        "/api/orderflow/volume-delta?symbol=GC&contract=GC&tf=1m&limit=2000",
    ),
    (
        "footprint",
        "/api/orderflow/footprint?symbol=GC&contract=GC&count=5",
    ),
    (
        "big_trades",
        "/api/big-trades?symbol=GC&contract=GC&limit=500",
    ),
)

SCRIPT_RE = re.compile(r"<script[^>]+src=[\"']([^\"']+)[\"']", re.I)
STYLESHEET_RE = re.compile(
    r"<link[^>]+rel=[\"']stylesheet[\"'][^>]+href=[\"']([^\"']+)[\"']",
    re.I,
)


@dataclass(frozen=True)
class Stage:
    users: int
    seconds: float


@dataclass
class RequestSample:
    endpoint: str
    elapsed_ms: float
    ok: bool
    status: int | None = None
    error: str | None = None


@dataclass
class Metrics:
    requests: list[RequestSample] = field(default_factory=list)
    ws_connect_ms: list[float] = field(default_factory=list)
    ws_open: int = 0
    ws_fail: int = 0
    ws_closed_early: int = 0
    ws_messages: int = 0
    ws_pongs: int = 0
    errors: list[str] = field(default_factory=list)

    def add_request(self, sample: RequestSample) -> None:
        self.requests.append(sample)
        if not sample.ok and sample.error and len(self.errors) < 20:
            self.errors.append(f"{sample.endpoint}: {sample.error}")

    def add_ws_error(self, message: str) -> None:
        self.ws_fail += 1
        if len(self.errors) < 20:
            self.errors.append(f"websocket: {message}")


def parse_stages(value: str) -> list[Stage]:
    stages: list[Stage] = []
    for raw in value.split(","):
        try:
            users_text, seconds_text = raw.strip().split(":", 1)
            users = int(users_text)
            seconds = float(seconds_text)
        except ValueError as exc:
            raise argparse.ArgumentTypeError(
                f"invalid stage {raw!r}; expected USERS:SECONDS"
            ) from exc
        if users < 1 or seconds <= 0:
            raise argparse.ArgumentTypeError(
                f"invalid stage {raw!r}; users must be >= 1 and seconds > 0"
            )
        stages.append(Stage(users, seconds))
    if not stages:
        raise argparse.ArgumentTypeError("at least one stage is required")
    return stages


def percentile(values: list[float], fraction: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, math.ceil(fraction * len(ordered)) - 1))
    return ordered[index]


def format_ms(value: float | None) -> str:
    return "n/a" if value is None else f"{value:.0f} ms"


def websocket_url(base_url: str) -> str:
    parsed = urlparse(base_url)
    scheme = "wss" if parsed.scheme == "https" else "ws"
    return f"{scheme}://{parsed.netloc}/ws/chart"


def discovered_assets(html: str, page_url: str) -> list[tuple[str, str]]:
    paths: list[tuple[str, str]] = []
    for path in SCRIPT_RE.findall(html):
        paths.append(("asset_js", urljoin(page_url, path)))
    for path in STYLESHEET_RE.findall(html):
        paths.append(("asset_css", urljoin(page_url, path)))
    # Avoid duplicate requests if a future HTML template references an asset
    # more than once.
    return list(dict.fromkeys(paths))


async def get_request(
    client: httpx.AsyncClient,
    endpoint: str,
    path: str,
    metrics: Metrics,
    *,
    expect_html: bool = False,
) -> str | None:
    started = time.perf_counter()
    try:
        response = await client.get(path)
        elapsed_ms = (time.perf_counter() - started) * 1_000
        ok = 200 <= response.status_code < 300
        metrics.add_request(
            RequestSample(endpoint, elapsed_ms, ok, response.status_code)
            if ok
            else RequestSample(
                endpoint,
                elapsed_ms,
                False,
                response.status_code,
                f"HTTP {response.status_code}",
            )
        )
        return response.text if ok and expect_html else None
    except Exception as exc:  # network errors are part of the measured result
        elapsed_ms = (time.perf_counter() - started) * 1_000
        metrics.add_request(
            RequestSample(endpoint, elapsed_ms, False, None, type(exc).__name__)
        )
        return None


async def websocket_session(
    base_url: str,
    duration: float,
    timeout: float,
    metrics: Metrics,
) -> None:
    target = websocket_url(base_url)
    started = time.perf_counter()
    try:
        async with websocket_connect(
            target,
            origin=base_url,
            open_timeout=timeout,
            close_timeout=3,
            max_size=4 * 1024 * 1024,
        ) as socket:
            metrics.ws_connect_ms.append((time.perf_counter() - started) * 1_000)
            metrics.ws_open += 1
            for message in SUBSCRIPTIONS:
                await socket.send(json.dumps(message, separators=(",", ":")))

            deadline = time.perf_counter() + duration
            while True:
                remaining = deadline - time.perf_counter()
                if remaining <= 0:
                    return
                try:
                    raw = await asyncio.wait_for(socket.recv(), min(1.0, remaining))
                except TimeoutError:
                    continue
                if raw is None:
                    metrics.ws_closed_early += 1
                    return
                metrics.ws_messages += 1
                if not isinstance(raw, str):
                    continue
                try:
                    payload = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                if isinstance(payload, dict) and payload.get("type") == "ping":
                    await socket.send(
                        json.dumps(
                            {"type": "pong", "time": payload.get("time")},
                            separators=(",", ":"),
                        )
                    )
                    metrics.ws_pongs += 1
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        metrics.add_ws_error(f"{type(exc).__name__}: {exc}")


async def one_virtual_user(
    user_id: int,
    base_url: str,
    duration: float,
    timeout: float,
    metrics: Metrics,
    stagger_ms: float,
) -> None:
    if stagger_ms > 0:
        await asyncio.sleep((user_id - 1) * stagger_ms / 1_000)

    limits = httpx.Limits(max_connections=12, max_keepalive_connections=6)
    async with httpx.AsyncClient(
        base_url=base_url,
        timeout=timeout,
        follow_redirects=True,
        limits=limits,
        headers={"User-Agent": "NTtoTV-anonymous-load-test/1.0"},
    ) as client:
        socket_task = asyncio.create_task(
            websocket_session(base_url, duration, timeout, metrics)
        )

        html = await get_request(
            client, "page", "/", metrics, expect_html=True
        )
        asset_requests = discovered_assets(html, base_url) if html else []
        tasks = [
            get_request(client, endpoint, path, metrics)
            for endpoint, path in READ_ENDPOINTS
        ]
        tasks.extend(
            get_request(client, endpoint, path, metrics)
            for endpoint, path in asset_requests
        )
        await asyncio.gather(*tasks)
        await socket_task


def stage_summary(
    stage: Stage,
    metrics: Metrics,
    p95_limit_ms: float,
    error_rate_limit: float,
) -> dict[str, Any]:
    by_endpoint: dict[str, list[RequestSample]] = defaultdict(list)
    for sample in metrics.requests:
        by_endpoint[sample.endpoint].append(sample)

    total_requests = len(metrics.requests)
    failed_requests = sum(not sample.ok for sample in metrics.requests)
    http_error_rate = failed_requests / total_requests if total_requests else 1.0
    all_http = [sample.elapsed_ms for sample in metrics.requests]
    page_p95 = percentile(
        [sample.elapsed_ms for sample in by_endpoint.get("page", [])], 0.95
    )
    endpoint_p95 = {
        endpoint: percentile([sample.elapsed_ms for sample in samples], 0.95)
        for endpoint, samples in sorted(by_endpoint.items())
    }
    p95_candidates = [value for value in endpoint_p95.values() if value is not None]
    max_endpoint_p95 = max(p95_candidates, default=None)
    status = "OK"
    reasons: list[str] = []
    if http_error_rate > error_rate_limit:
        status = "FAIL"
        reasons.append(f"HTTP error rate {http_error_rate:.1%}")
    if metrics.ws_fail > 0 or metrics.ws_open < stage.users:
        status = "FAIL"
        reasons.append(f"WebSocket {metrics.ws_open}/{stage.users} opened")
    if max_endpoint_p95 is not None and max_endpoint_p95 > p95_limit_ms:
        status = "DEGRADED" if status == "OK" else status
        reasons.append(f"endpoint P95 {format_ms(max_endpoint_p95)}")

    return {
        "users": stage.users,
        "seconds": stage.seconds,
        "status": status,
        "requests": total_requests,
        "failed_requests": failed_requests,
        "http_error_rate": http_error_rate,
        "http_p95_ms": percentile(all_http, 0.95),
        "page_p95_ms": page_p95,
        "endpoint_p95_ms": endpoint_p95,
        "websocket_open": metrics.ws_open,
        "websocket_fail": metrics.ws_fail,
        "websocket_closed_early": metrics.ws_closed_early,
        "websocket_connect_p95_ms": percentile(metrics.ws_connect_ms, 0.95),
        "websocket_messages": metrics.ws_messages,
        "websocket_pongs": metrics.ws_pongs,
        "reasons": reasons,
        "errors": metrics.errors,
    }


async def run_stage(
    stage: Stage,
    base_url: str,
    timeout: float,
    stagger_ms: float,
    p95_limit_ms: float,
    error_rate_limit: float,
) -> dict[str, Any]:
    metrics = Metrics()
    tasks = [
        asyncio.create_task(
            one_virtual_user(
                user_id,
                base_url,
                stage.seconds,
                timeout,
                metrics,
                stagger_ms,
            )
        )
        for user_id in range(1, stage.users + 1)
    ]
    await asyncio.gather(*tasks)
    return stage_summary(stage, metrics, p95_limit_ms, error_rate_limit)


def print_stage_summary(index: int, summary: dict[str, Any]) -> None:
    print(
        f"stage {index}: users={summary['users']} duration={summary['seconds']:.0f}s "
        f"status={summary['status']} requests={summary['requests']} "
        f"errors={summary['failed_requests']} "
        f"http_p95={format_ms(summary['http_p95_ms'])} "
        f"page_p95={format_ms(summary['page_p95_ms'])} "
        f"ws={summary['websocket_open']}/{summary['users']} "
        f"ws_connect_p95={format_ms(summary['websocket_connect_p95_ms'])} "
        f"ws_messages={summary['websocket_messages']}"
    )
    if summary["reasons"]:
        print(f"  reasons: {', '.join(summary['reasons'])}")
    if summary["errors"]:
        print(f"  sample errors: {'; '.join(summary['errors'][:3])}")


async def async_main(args: argparse.Namespace) -> int:
    base_url = args.base_url.rstrip("/")
    stages = parse_stages(args.stages)
    print(f"target={base_url} websocket={websocket_url(base_url)}")
    print(
        f"stages={args.stages} timeout={args.timeout}s "
        f"stagger={args.stagger_ms:.0f}ms"
    )

    results: list[dict[str, Any]] = []
    for index, stage in enumerate(stages, start=1):
        print(f"starting stage {index}/{len(stages)} ...", flush=True)
        result = await run_stage(
            stage,
            base_url,
            args.timeout,
            args.stagger_ms,
            args.p95_limit_ms,
            args.error_rate_limit,
        )
        results.append(result)
        print_stage_summary(index, result)

    ok_stages = [result for result in results if result["status"] == "OK"]
    highest_ok = max((result["users"] for result in ok_stages), default=0)
    print(
        f"highest stage meeting thresholds: {highest_ok} concurrent anonymous users"
    )

    report = {
        "target": base_url,
        "generated_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "thresholds": {
            "p95_limit_ms": args.p95_limit_ms,
            "error_rate_limit": args.error_rate_limit,
        },
        "stages": results,
    }
    if args.json_out:
        with open(args.json_out, "w", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2)
        print(f"json report: {args.json_out}")

    # A load test is useful even when the site is under-provisioned, so return
    # success after producing the report. The human-readable status identifies
    # the first degraded/failed stage.
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument(
        "--stages",
        default=DEFAULT_STAGES,
        help="comma-separated USERS:SECONDS stages (default: %(default)s)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=DEFAULT_TIMEOUT_SECONDS,
        help="per-request/WebSocket connect timeout in seconds",
    )
    parser.add_argument(
        "--stagger-ms",
        type=float,
        default=25.0,
        help="delay between virtual-user starts in milliseconds",
    )
    parser.add_argument(
        "--p95-limit-ms",
        type=float,
        default=DEFAULT_P95_LIMIT_MS,
        help="threshold used to label a stage DEGRADED",
    )
    parser.add_argument(
        "--error-rate-limit",
        type=float,
        default=DEFAULT_ERROR_RATE_LIMIT,
        help="HTTP error-rate threshold used to label a stage FAIL",
    )
    parser.add_argument("--json-out", help="optional path for a JSON report")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        parse_stages(args.stages)
    except argparse.ArgumentTypeError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    return asyncio.run(async_main(args))


if __name__ == "__main__":
    raise SystemExit(main())
