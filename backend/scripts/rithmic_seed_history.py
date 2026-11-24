#!/usr/bin/env python3
"""One-shot History Plant seed used before a manual contract rollover."""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from dataclasses import replace
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.config import Settings  # noqa: E402
from app.rithmic.admin_config import RithmicAdminConfigStore  # noqa: E402
from app.rithmic.history import RithmicHistoryService  # noqa: E402
from app.storage.cache_store import CacheStore  # noqa: E402


class _Sink:
    def __init__(self) -> None:
        self.status: dict = {"state": "connecting"}

    async def on_rithmic_history_status(self, status: dict) -> None:
        self.status = dict(status)


async def seed(wire: str, physical: str, timeout_seconds: float) -> int:
    base = Settings()
    store = RithmicAdminConfigStore(base)
    settings = store.load().to_settings(base, enabled=True) if store.stored else base
    settings = replace(
        settings,
        rithmic_enabled=True,
        rithmic_history_enabled=True,
        rithmic_symbol=wire,
        rithmic_contract=physical,
    )
    cache = CacheStore.open(settings)
    sink = _Sink()
    service = RithmicHistoryService.from_settings(settings, cache, sink)
    try:
        await service.start()
        deadline = asyncio.get_running_loop().time() + timeout_seconds
        while asyncio.get_running_loop().time() < deadline:
            state = sink.status.get("state")
            if state == "synced":
                print(
                    "history seed synchronized",
                    sink.status.get("highWatermark"),
                    sink.status.get("barsWritten"),
                )
                return 0
            if state == "error" and not service.running:
                print(f"history seed failed: {sink.status.get('lastError')}", file=sys.stderr)
                return 2
            await asyncio.sleep(1)
        print(f"history seed timed out: {sink.status}", file=sys.stderr)
        return 3
    finally:
        await service.stop()
        cache.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--wire", required=True)
    parser.add_argument("--physical", required=True)
    parser.add_argument("--timeout", type=float, default=1800)
    args = parser.parse_args()
    os.environ["NTTOTV_RITHMIC_SYMBOL"] = args.wire
    os.environ["NTTOTV_RITHMIC_CONTRACT"] = args.physical
    return asyncio.run(seed(args.wire, args.physical, args.timeout))


if __name__ == "__main__":
    raise SystemExit(main())
