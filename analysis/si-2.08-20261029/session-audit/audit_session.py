"""Capture/reproduce a descriptive ICE-session audit, never a trading backtest.

Run with --capture once to retrieve the two read-only local API responses.
Run without arguments thereafter to reproduce audit.json from inputs.json.
Uses only the Python standard library. No application/runtime data is changed.
"""
from __future__ import annotations

import argparse
import bisect
from collections import Counter
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import statistics
import urllib.request

DIRECTORY = Path(__file__).resolve().parent
LOCAL = timezone(timedelta(hours=7))
START = int(datetime(2026, 10, 28, 19, tzinfo=LOCAL).timestamp() * 1000)
END = int(datetime(2026, 10, 29, 4, tzinfo=LOCAL).timestamp() * 1000)
MINUTE = 60_000


def counts(rows):
    return {
        "orders": len(rows),
        "byPassiveSide": dict(Counter(row["side"] for row in rows)),
        "byDetectionReason": dict(Counter(row["detectionReason"] for row in rows)),
        "byLatestStatus": dict(Counter(row["status"] for row in rows)),
        "zeroObservedRefills": sum(row["refillCount"] == 0 for row in rows),
    }


def local_clock(timestamp):
    return datetime.fromtimestamp(timestamp / 1000, LOCAL).isoformat()


def percentile_lower(values, probability):
    ordered = sorted(values)
    return ordered[int((len(ordered) - 1) * probability)] if ordered else None


def capture(base):
    urls = {
        "icebergSnapshot": base + "/orderflow/icebergs?symbol=GC&contract=GC&limit=5000&min_volume=1",
        "m1History": base + f"/history?symbol=GC&contract=GC&tf=1m&from={START-30*MINUTE}&to={END-1}&limit=5000",
    }
    responses = {}
    retrievals = {}
    for name, url in urls.items():
        with urllib.request.urlopen(url, timeout=30) as response:
            responses[name] = json.load(response)
        retrievals[name] = datetime.now(timezone.utc).isoformat()
    payload = {
        "retrievedAtUtc": retrievals,
        "sourceUrls": urls,
        "window": {"fromInclusiveMs": START, "toExclusiveMs": END,
                   "fromLocal": local_clock(START), "toLocal": local_clock(END)},
        "knownCoverageGap": {
            "fromInclusiveLocal": "2026-10-29T01:44:00+07:00",
            "toExclusiveLocal": "2026-10-29T02:45:00+07:00",
            "missingM1Buckets": 61,
            "evidence": "Parent investigation verified empty time-bar, volume-profile and tick replay responses and no local raw ticks for the interval.",
        },
        **responses,
    }
    (DIRECTORY / "inputs.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")


def audit(payload, input_sha256):
    snapshot = payload["icebergSnapshot"]
    rows = sorted((row for row in snapshot["icebergs"] if START <= row["detectedTime"] < END),
                  key=lambda row: row["detectedTime"])
    eligible = [row for row in rows if row["executedVolume"] >= 10]
    volumes = [row["executedVolume"] for row in rows]
    life = [max(0, (row["endTime"] if row["endTime"] is not None else row["time"])
                - row["detectedTime"]) / 1000 for row in eligible]
    hourly = []
    for hour in range(9):
        start = START + hour * 60 * MINUTE
        hourly.append({"fromLocal": local_clock(start), **counts(
            [row for row in eligible if start <= row["detectedTime"] < start + 60 * MINUTE])})
    peaks = []
    for minutes in (1, 5, 10, 30):
        best = max(([item for item in eligible if row["detectedTime"] <= item["detectedTime"]
                    < row["detectedTime"] + minutes * MINUTE] for row in eligible),
                   key=len, default=[])
        peaks.append({"minutes": minutes, "orders": len(best),
                      "fromLocal": local_clock(best[0]["detectedTime"]) if best else None,
                      "byPassiveSide": dict(Counter(row["side"] for row in best))})
    bars = sorted((bar for bar in payload["m1History"]["bars"] if bar.get("closed") is not False),
                  key=lambda bar: bar["time"])
    times = [bar["time"] for bar in bars]
    contexts = []
    for row in eligible:
        # A bar is usable only after its full minute elapsed at detection time.
        stop = bisect.bisect_right(times, row["detectedTime"] - MINUTE)
        trailing = bars[max(0, stop - 21):stop]
        if len(trailing) != 21 or any(b["time"] - a["time"] != MINUTE
                                     for a, b in zip(trailing, trailing[1:])):
            continue
        path = sum(abs(b["close"] - a["close"]) for a, b in zip(trailing, trailing[1:]))
        er = abs(trailing[-1]["close"] - trailing[0]["close"]) / path if path else 0
        contexts.append({"sessionId": row["sessionId"], "orderId": row["orderId"],
                         "detectedTime": row["detectedTime"], "passiveSide": row["side"],
                         "contextFromMs": trailing[0]["time"], "lastClosedBarMs": trailing[-1]["time"],
                         "efficiencyRatio": er})
    expected = set(range(START, END, MINUTE))
    actual = {bar["time"] for bar in bars if START <= bar["time"] < END}
    return {
        "inputSha256": input_sha256,
        "retrievedAtUtc": payload["retrievedAtUtc"],
        "window": payload["window"],
        "warnings": [
            "Descriptive latest/final compact states, not an alert replay or profitability backtest.",
            "Final executed quantities, refill counts, terminal status and post-detection durations contain hindsight and were not necessarily known at first detection.",
            "The prior-20-minute efficiency ratio uses only completed preceding M1 bars; ER thresholds here are exploratory and unvalidated.",
            "The 01:44-02:44 UTC+7 source gap makes this an incomplete observed US session; zero detections do not establish zero market activity.",
            "Default US minimum 10 is a source-code default; the user's saved profile settings were not read.",
        ],
        "source": {"historyMode": snapshot.get("historyMode"),
                   "retentionHours": snapshot.get("retentionHours"),
                   "snapshotOrders": len(snapshot["icebergs"]), "limit": snapshot.get("limit"),
                   "snapshotAtCap": len(snapshot["icebergs"]) >= snapshot.get("limit", 5000)},
        "knownCoverageGap": payload["knownCoverageGap"],
        "m1Coverage": {"expectedSessionBuckets": len(expected), "recordedSessionBuckets": len(actual),
                       "missingSessionBucketOpensLocal": [local_clock(t) for t in sorted(expected - actual)]},
        "allRecordedSessionDetections": counts(rows),
        "finalVolumeThresholds": [{"minimumFinalExecutedVolume": n, **counts(
            [row for row in rows if row["executedVolume"] >= n])}
            for n in (5, 10, 15, 20, 25, 30, 40, 50, 75, 100)],
        "allFinalExecutedVolumeDistribution": {"minimum": min(volumes) if volumes else None,
            "median": statistics.median(volumes) if volumes else None,
            "p75Lower": percentile_lower(volumes, .75), "p90Lower": percentile_lower(volumes, .90),
            "maximum": max(volumes) if volumes else None},
        "atFinalVolume10": {
            "hourly": hourly,
            "sideFlipsBetweenAdjacentDetections": sum(a["side"] != b["side"] for a, b in zip(eligible, eligible[1:])),
            "adjacentDetectionTransitions": max(0, len(eligible) - 1),
            "executedVolumeByPassiveSide": {side: sum(row["executedVolume"] for row in eligible if row["side"] == side)
                                          for side in ("buy", "sell")},
            "peakWindows": peaks,
            "minimumFinalRefillCounts": [{"minimumFinalRefills": n,
                                          "remainingOrders": sum(row["refillCount"] >= n for row in eligible)}
                                         for n in (1, 2, 3, 5, 10)],
            "postDetectionUntilRecordedEndSeconds": {"median": statistics.median(life) if life else None,
                "p90Lower": percentile_lower(life, .90), "maximum": max(life) if life else None,
                "zeroDurationCount": sum(value == 0 for value in life),
                "lessThanOneSecondCount": sum(value < 1 for value in life)},
            "prior20MinuteEfficiency": {
                "usableContexts": len(contexts), "excludedMissingContext": len(eligible) - len(contexts),
                "medianER": statistics.median(row["efficiencyRatio"] for row in contexts) if contexts else None,
                "atOrBelowThreshold": [{"maximumER": threshold,
                    "count": sum(row["efficiencyRatio"] <= threshold for row in contexts),
                    "byPassiveSide": dict(Counter(row["passiveSide"] for row in contexts
                                                   if row["efficiencyRatio"] <= threshold))}
                    for threshold in (.15, .20, .25, .30, .40)],
                "perOrderContexts": contexts,
            },
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture", action="store_true")
    parser.add_argument("--api-base", default="http://127.0.0.1:8000/api")
    args = parser.parse_args()
    if args.capture:
        capture(args.api_base.rstrip("/"))
    raw = (DIRECTORY / "inputs.json").read_bytes()
    report = audit(json.loads(raw), hashlib.sha256(raw).hexdigest())
    (DIRECTORY / "audit.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"sessionOrders": report["allRecordedSessionDetections"]["orders"],
        "atFinalVolume10": report["finalVolumeThresholds"][1]["orders"],
        "missingM1": len(report["m1Coverage"]["missingSessionBucketOpensLocal"]),
        "inputs": "inputs.json", "report": "audit.json", "inputSha256": report["inputSha256"]}))


if __name__ == "__main__":
    main()
