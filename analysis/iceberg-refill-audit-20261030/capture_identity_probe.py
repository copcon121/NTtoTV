"""Bounded read-only capture of compact ICE identity diagnostics, not raw MBO."""
import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import time
from urllib.request import urlopen


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--duration", type=int, default=120)
    args = parser.parse_args()
    if not 1 <= args.duration <= 600:
        raise SystemExit("Duration must be 1..600 seconds")
    local = timezone(timedelta(hours=7))
    started = datetime.now(local)
    path = Path(__file__).with_name("identity-probe-" + started.strftime("%Y%m%d-%H%M%S") + ".jsonl")
    seen = set()
    session = None
    last = None
    with path.open("x", encoding="utf-8") as output:
        output.write(json.dumps({"kind": "start", "time": started.isoformat(),
                                 "duration": args.duration}) + "\n")
        print(str(path), flush=True)
        deadline = time.monotonic() + args.duration
        while time.monotonic() < deadline:
            with urlopen("http://127.0.0.1:8000/api/market-data/status", timeout=5) as response:
                status = json.load(response)
            source = status["sources"]["rithmic"]
            current_session = source.get("icebergSessionId")
            if current_session != session:
                session = current_session
                output.write(json.dumps({"kind": "session", "sessionId": session,
                    "activeSource": status.get("activeSource"),
                    "bookmapEnabled": status["sources"]["bookmap"].get("enabled"),
                    "ntEnabled": status["sources"]["nt"].get("enabled")}) + "\n")
            for context in source.get("icebergIdentityContexts", []):
                key = json.dumps(context, sort_keys=True)
                if key in seen:
                    continue
                seen.add(key)
                output.write(json.dumps({"kind": "identity_context", "context": context}) + "\n")
                print(context["kind"], context["orderId"],
                      context["oldPrice"], "->", context["newPrice"],
                      "executed", context["executedVolume"],
                      "remainder", context["remainderBefore"], flush=True)
            last = {"kind": "summary", "time": datetime.now(local).isoformat(),
                    "activeSource": status.get("activeSource"), "sessionId": session,
                    "diagnostics": source.get("icebergDiagnostics", {}),
                    "icebergSynchronized": source.get("icebergSynchronized"),
                    "contextsCaptured": len(seen)}
            output.flush()
            if len(seen) >= 1000:
                break
            time.sleep(min(1, max(0, deadline - time.monotonic())))
        if last:
            output.write(json.dumps(last) + "\n")
            print(json.dumps(last), flush=True)


if __name__ == "__main__":
    main()
