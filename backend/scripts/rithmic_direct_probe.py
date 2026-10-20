#!/usr/bin/env python3
"""Probe direct R|Protocol L1/L2/MBO access without touching production ingest."""

from __future__ import annotations

import argparse
import asyncio
import getpass
import json
import os
import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.rithmic.client import (  # noqa: E402
    DEFAULT_URI,
    RithmicDirectClient,
    RithmicLogin,
    RithmicProbeError,
)


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(
        description="Direct, read-only Rithmic R|Protocol connectivity probe"
    )
    result.add_argument(
        "--uri", default=os.getenv("NTTOTV_RITHMIC_URI", DEFAULT_URI)
    )
    result.add_argument(
        "--archive",
        type=Path,
        default=REPO_ROOT / "RProtocolAPI.zip",
        help="RProtocolAPI.zip used as the trusted CA source",
    )
    result.add_argument("--timeout", type=float, default=15.0)
    subparsers = result.add_subparsers(dest="command", required=True)

    subparsers.add_parser("systems", help="list systems; no credentials required")
    gateway = subparsers.add_parser(
        "gateways", help="list gateways for one system; no credentials required"
    )
    gateway.add_argument("--system", default="Rithmic Test")

    stream = subparsers.add_parser("stream", help="login and sample market data")
    stream.add_argument("--system", default=None)
    stream.add_argument("--app-name", default=None)
    stream.add_argument("--app-version", default=None)
    stream.add_argument("--exchange", default="COMEX")
    stream.add_argument("--symbol", default="GCZ6")
    stream.add_argument(
        "--modes",
        default="l1,l2,mbo",
        help="comma-separated subset of l1,l2,mbo",
    )
    stream.add_argument("--duration", type=float, default=15.0)
    stream.add_argument("--sample-limit", type=int, default=12)
    stream.add_argument(
        "--prompt-credentials",
        action="store_true",
        help="prompt without echo instead of reading NTTOTV_RITHMIC_* variables",
    )
    return result


async def run(args: argparse.Namespace) -> dict:
    client = RithmicDirectClient(
        uri=args.uri,
        archive_path=args.archive.resolve(),
        timeout_seconds=args.timeout,
    )
    if args.command == "systems":
        return await client.list_systems()
    if args.command == "gateways":
        return await client.list_gateways(args.system)

    if args.prompt_credentials:
        login = RithmicLogin(
            user=input("Rithmic user: ").strip(),
            password=getpass.getpass("Rithmic password: "),
        )
        if not login.user or not login.password:
            raise RithmicProbeError("Rithmic user and password are required")
    else:
        login = RithmicLogin.from_environment()
    if args.system:
        login.system_name = args.system
    if args.app_name:
        login.app_name = args.app_name
    if args.app_version:
        login.app_version = args.app_version
    modes = {value.strip().lower() for value in args.modes.split(",") if value.strip()}
    return await client.probe_market_data(
        login=login,
        exchange=args.exchange,
        symbol=args.symbol,
        modes=modes,
        duration_seconds=args.duration,
        sample_limit=args.sample_limit,
    )


def main() -> int:
    args = parser().parse_args()
    try:
        output = asyncio.run(run(args))
    except (RithmicProbeError, OSError, TimeoutError, ValueError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, indent=2))
        return 2
    print(json.dumps({"ok": True, "result": output}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
