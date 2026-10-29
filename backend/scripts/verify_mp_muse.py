"""Read chart history and validate one Muse plan without saving plans or alerts."""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from types import SimpleNamespace

import httpx

from app.analyst.llm_client import _default_transport
from app.market_profile.calendar import current_slot
from app.market_profile.llm import MpLlmClient
from app.market_profile.snapshot import build_snapshot


class ApiHistory:
    def __init__(self, client: httpx.Client):
        self.client = client

    def read_bars(self, symbol, contract, tf, frm=None, to=None, limit=None):
        params = {"symbol": symbol, "contract": contract, "tf": tf, "limit": limit or 5000}
        if frm is not None:
            params["from"] = frm
        if to is not None:
            params["to"] = to
        response = self.client.get("/api/history", params=params)
        response.raise_for_status()
        return [SimpleNamespace(**bar) for bar in response.json()["bars"]]


def main():
    repo = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--chart-base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--muse-base-url", default="http://127.0.0.1:18610/v1")
    parser.add_argument("--key-file", type=Path, default=repo.parent / "muse2api/data/api_key")
    parser.add_argument("--output-dir", type=Path, default=repo / "_run_logs/mp-muse")
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    with httpx.Client(base_url=args.chart_base_url, trust_env=False, timeout=15) as chart:
        at = int(time.time() * 1000)
        snapshot = build_snapshot(ApiHistory(chart), at, [])
    slot = current_slot(at)
    snapshot["requestedScopes"] = ["daily", slot["name"]] if slot else ["daily"]
    print(json.dumps({
        "snapshotProfiles": len(snapshot["profiles"]), "dailyCandles": len(snapshot["dailyCandles"]),
        "catalogLevels": len(snapshot["levels"]), "scopes": snapshot["requestedScopes"],
        "snapshotCharacters": len(json.dumps(snapshot)),
    }), flush=True)

    def transport(*values):
        body = _default_transport(*values)
        (args.output_dir / "last-response.json").write_text(
            json.dumps(body, ensure_ascii=False, indent=2), encoding="utf-8",
        )
        return body

    client = MpLlmClient(
        provider="muse", api_key=args.key_file.read_text(encoding="utf-8").strip(),
        model="muse-chat", base_url=args.muse_base_url, transport=transport,
    )
    started = time.monotonic()
    plans = client.analyze_plan(snapshot)
    preview = args.output_dir / "verified-plan.json"
    preview.write_text(json.dumps({"asOf": at, "llm": client.configuration(), "plans": plans},
                                  ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({
        "validated": True, "scopes": [p["scope"] for p in plans],
        "alertCounts": [len(p["alerts"]) for p in plans],
        "seconds": round(time.monotonic() - started, 1), "previewFile": str(preview),
    }))


if __name__ == "__main__":
    main()
