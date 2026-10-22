#!/usr/bin/env python3
"""Atomically update the saved GUI contract during a manual rollover."""

from __future__ import annotations

import argparse
import sys
from dataclasses import replace
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.config import Settings  # noqa: E402
from app.rithmic.admin_config import RithmicAdminConfigStore  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--wire", required=True)
    parser.add_argument("--physical", required=True)
    args = parser.parse_args()

    store = RithmicAdminConfigStore(Settings())
    config = store.load()
    store.save(
        replace(
            config,
            wire_symbol=args.wire.upper(),
            physical_contract=args.physical.upper(),
            auto_connect=True,
        )
    )
    print(f"saved rollover contract: {args.wire.upper()} / {args.physical.upper()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
