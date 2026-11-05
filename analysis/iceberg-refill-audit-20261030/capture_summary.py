"""Read-only local public API aggregates; no settings, credentials or raw MBO."""
from collections import Counter
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from urllib.request import urlopen

TZ = timezone(timedelta(hours=7))


def request(path):
    with urlopen("http://127.0.0.1:8000" + path, timeout=10) as response:
        return json.load(response)


def millis(value):
    return int(datetime.fromisoformat(value).replace(tzinfo=TZ).timestamp() * 1000)


def window(rows, start, end):
    selected = [row for row in rows if millis(start) <= row["detectedTime"] < millis(end)]
    return {
        "startUtcPlus7": start, "endUtcPlus7": end, "orders": len(selected),
        "refillHistogram": dict(sorted(Counter(row["refillCount"] for row in selected).items())),
        "detectionReasons": dict(Counter(row["detectionReason"] for row in selected)),
        "statuses": dict(Counter(row["status"] for row in selected)),
        "volumeFilters": {str(minimum): {
            "orders": sum(row["executedVolume"] >= minimum for row in selected),
            "zeroRefill": sum(row["executedVolume"] >= minimum and row["refillCount"] == 0
                              for row in selected),
        } for minimum in (5, 10)},
    }


snapshot = request("/api/orderflow/icebergs?symbol=GC&contract=GC&min_volume=1&limit=2000")
rows = snapshot["icebergs"]
summary = {
    "capturedAtUtcPlus7": datetime.now(TZ).isoformat(),
    "snapshotMetadata": {key: snapshot[key] for key in (
        "source", "sourceContract", "sessionId", "synchronized", "sourceConnected"
    ) if key in snapshot},
    "retainedOrders": len(rows),
    "retainedRefillHistogram": dict(sorted(Counter(row["refillCount"] for row in rows).items())),
    "windows": [window(rows, start, end) for start, end in (
        ("2026-10-29T00:00", "2026-10-29T03:00"),
        ("2026-10-29T03:00", "2026-10-30T00:00"),
        ("2026-10-29T19:00", "2026-10-30T04:00"),
    )],
    "nativeDiagnostics": [],
}


def select_diagnostics(value, path=""):
    if isinstance(value, dict):
        if "icebergDiagnostics" in value:
            summary["nativeDiagnostics"].append({"path": path, **{
                key: item for key, item in value.items()
                if key in {"icebergDiagnostics", "icebergSynchronized", "icebergTrackedOrders",
                           "icebergDetectedOrders", "icebergDroppedOrders", "icebergLastOverfill",
                           "mboLastSequence", "mboMessageCount", "mboSnapshotMessageCount"}
            }})
        for key, item in value.items():
            if isinstance(item, (dict, list)):
                select_diagnostics(item, path + "/" + key)
    elif isinstance(value, list):
        for index, item in enumerate(value):
            select_diagnostics(item, path + "/" + str(index))


select_diagnostics(request("/api/market-data/status"))
Path(__file__).with_name("runtime-summary.json").write_text(
    json.dumps(summary, indent=2) + "\n", encoding="utf-8")
print(json.dumps(summary, indent=2))
