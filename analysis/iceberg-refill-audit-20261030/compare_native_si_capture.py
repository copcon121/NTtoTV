"""Read-only comparison of published SI ICE events and direct Rithmic evidence.

Reads compact SI JSONL, the unfiltered public ICE snapshot, and market-data-only
SQLite shards in URI mode=ro. Never reads auth/settings or reconstructs MBO.
Snapshot totalSize is a current/final observation, not quantity known at each
historical event. Native screen aggregation is intentionally not reconstructed.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import sqlite3
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[2]
TZ = timezone(timedelta(hours=7))
EVENT_KEY = ("generator", "alias", "orderId", "eventType", "timeNanos",
             "priceLevel", "side", "eventSize")


def local_time(milliseconds):
    return datetime.fromtimestamp(milliseconds / 1000, TZ).isoformat()


def load_capture(files):
    """Dedup across capture provenance while keeping mutable total observations.

    The public API has no unique event ID. Identical events within one capture
    are therefore explicit ambiguity, not silently claimed to be duplicates.
    """
    canonical = {}
    metadata = []
    limitations = []
    for path in files:
        raw = path.read_bytes()
        lines = raw.splitlines()
        for index, line in enumerate(lines, 1):
            try:
                row = json.loads(line)
            except (ValueError, UnicodeDecodeError):
                # A running writer can expose its unfinished final line.
                limitations.append({"file": str(path), "line": index,
                                    "reason": "invalid_or_partial_json"})
                continue
            provenance = {"file": str(path), "line": index,
                          "capture": row.get("capture")}
            if row.get("kind") != "iceberg_event":
                metadata.append({**row, "provenance": provenance})
                continue
            if not all(field in row for field in EVENT_KEY):
                limitations.append({"provenance": provenance, "reason": "incomplete_event"})
                continue
            key = tuple(row[field] for field in EVENT_KEY)
            item = canonical.setdefault(key, {
                **{field: row[field] for field in EVENT_KEY},
                "time": int(row["timeNanos"]) // 1_000_000,
                "price": row.get("price"), "observations": [],
            })
            # totalSize deliberately excluded from canonical identity: SI may
            # return a later per-order total when replaying an older event.
            item["observations"].append({**provenance,
                                         "totalSize": row.get("totalSize")})
    for item in canonical.values():
        counts = Counter((obs["file"], obs["capture"]) for obs in item["observations"])
        item["canonicalOccurrences"] = max(counts.values())
        item["ambiguousIdenticalEventsWithinCapture"] = item["canonicalOccurrences"] > 1
        item["captureKinds"] = sorted({obs["capture"] or "unknown" for obs in item["observations"]})
    return sorted(canonical.values(), key=lambda row: (row["timeNanos"], row["orderId"])), metadata, limitations


def public_api(path):
    with urlopen("http://127.0.0.1:8000" + path, timeout=10) as response:
        return json.load(response)


def read_raw(root, order_ids, start, end):
    result = []
    shards = []
    day = datetime.fromtimestamp(start / 1000, timezone.utc).date()
    last = datetime.fromtimestamp(end / 1000, timezone.utc).date()
    ids = sorted(order_ids)
    while day <= last:
        path = root / (day.isoformat() + ".sqlite")
        day += timedelta(days=1)
        if not path.exists():
            continue
        shards.append(str(path))
        connection = sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True)
        connection.row_factory = sqlite3.Row
        try:
            columns = {row[1] for row in connection.execute("PRAGMA table_info(ticks)")}
            fields = [field for field in (
                "event_key", "sequence", "time", "received_at", "price", "volume",
                "side", "passive_order_id", "aggressor_order_id", "source_time_nanos",
            ) if field in columns]
            for offset in range(0, len(ids), 300):
                chunk = ids[offset:offset + 300]
                placeholders = ",".join("?" for _ in chunk)
                query = ("SELECT " + ",".join(fields) + " FROM ticks WHERE source='rithmic' "
                         "AND time BETWEEN ? AND ? AND (passive_order_id IN (" + placeholders
                         + ") OR aggressor_order_id IN (" + placeholders + "))")
                result.extend(dict(row) for row in connection.execute(query, (start, end, *chunk, *chunk)))
        finally:
            connection.close()
    # A row matching IDs in different chunks must not inflate quantity.
    unique = {row.get("event_key", tuple(sorted(row.items()))): row for row in result}
    return sorted(unique.values(), key=lambda row: (row["time"], row["sequence"])), shards


def compare(events, raw, icebergs, current_session):
    grouped = defaultdict(list)
    for event in events:
        grouped[(event["alias"], event["orderId"])].append(event)
    orders = []
    for (alias, order_id), timeline in grouped.items():
        detections = [event for event in timeline if event["eventType"] == "DETECTION"]
        movements = [event for event in timeline if event["eventType"] == "MOVEMENT"]
        native_trades = [event for event in timeline if event["eventType"] == "TRADE"]
        observed_totals = sorted({obs["totalSize"] for event in timeline
                                 for obs in event["observations"] if isinstance(obs["totalSize"], (int, float))})
        passive = [row for row in raw if str(row.get("passive_order_id")) == order_id]
        aggressive = [row for row in raw if str(row.get("aggressor_order_id")) == order_id]
        direct = [row for row in icebergs if str(row["orderId"]) == order_id]
        trade_comparisons = []
        for event in native_trades:
            nearby = [row for row in raw
                      if (str(row.get("passive_order_id")) == order_id
                          or str(row.get("aggressor_order_id")) == order_id)
                      and abs(row["price"] - event["price"]) < 1e-7
                      and abs((row.get("source_time_nanos") or row["time"] * 1_000_000)
                              - event["timeNanos"]) <= 10_000_000]
            trade_comparisons.append({
                "nativeTimeNanos": event["timeNanos"], "nativePrice": event["price"],
                "nativeEventSize": event["eventSize"],
                "nearbyRawCountWithin10ms": len(nearby),
                "nearbyRawQuantityWithin10ms": sum(row["volume"] for row in nearby),
                "note": "Temporal candidates; aggregation/split semantics are not assumed identical.",
            })
        execution_comparisons = []
        for event in [*detections, *native_trades]:
            candidates = []
            for row in passive + aggressive:
                source_nanos = row.get("source_time_nanos") or row["time"] * 1_000_000
                delta_ms = (event["timeNanos"] - source_nanos) / 1_000_000
                if (abs(row["price"] - event["price"]) < 1e-7
                        and row["volume"] == event["eventSize"]
                        and abs(delta_ms) <= 2000):
                    candidates.append({
                        "rawSequence": row["sequence"], "rawSourceTimeNanos": source_nanos,
                        "rawReceivedAt": row.get("received_at"),
                        "quantity": row["volume"], "bmEventMinusSourceMs": delta_ms,
                        "bmEventMinusDirectReceiptMs": (
                            None if row.get("received_at") is None else
                            event["timeNanos"] / 1_000_000 - row["received_at"]),
                    })
            execution_comparisons.append({
                "nativeEventType": event["eventType"], "nativeTimeNanos": event["timeNanos"],
                "nativePrice": event["price"], "nativeEventSize": event["eventSize"],
                "sameIdPriceQuantityCandidatesWithin2s": candidates,
                "note": "BM callback time differs from exchange source time; candidates are not a unique assignment.",
            })
        orders.append({
            "alias": alias, "orderId": order_id,
            "firstDetectionTimeUtcPlus7": local_time(detections[0]["time"]) if detections else None,
            "nativeDetectionPrices": sorted({event["price"] for event in detections}),
            "nativeSide": sorted({event["side"] for event in timeline}),
            "nativeObservedTotals": observed_totals,
            "nativeMaxObservedTotal": max(observed_totals) if observed_totals else None,
            "nativeEventTypes": dict(Counter(event["eventType"] for event in timeline)),
            "nativeMovementCount": len(movements),
            "nativeTimeline": timeline,
            "rawPassiveQuantity": sum(row["volume"] for row in passive),
            "rawAggressiveQuantity": sum(row["volume"] for row in aggressive),
            "rawPassiveTrades": passive, "rawAggressiveTrades": aggressive,
            "nativeTradeTemporalCandidates": trade_comparisons,
            "nativeExecutionCandidates": execution_comparisons,
            "directIcebergStates": direct,
            "directAnyRetainedSessionMatched": bool(direct),
            "directCurrentSessionMatched": any(row["sessionId"] == current_session for row in direct),
        })
    return sorted(orders, key=lambda row: (row["firstDetectionTimeUtcPlus7"] or "", row["orderId"]))


def self_test():
    import tempfile
    with tempfile.TemporaryDirectory() as temporary:
        path = Path(temporary) / "test.jsonl"
        base = {"kind": "iceberg_event", "generator": "GCZ6.COMEX@RITHMIC",
                "alias": "GCZ6.COMEX@RITHMIC", "orderId": "A", "eventType": "TRADE",
                "timeNanos": 1_000_000_001, "priceLevel": 40000, "price": 4000.0,
                "side": "buy", "eventSize": 2}
        path.write_text("\n".join(json.dumps(row) for row in (
            {**base, "capture": "live", "totalSize": 2},
            {**base, "capture": "snapshot", "totalSize": 4},
        )) + "\n{", encoding="utf-8")
        events, _, limitations = load_capture([path])
        assert len(events) == 1 and len(events[0]["observations"]) == 2
        assert events[0]["canonicalOccurrences"] == 1 and len(limitations) == 1
        orders = compare(events, [], [], "session")
        assert orders[0]["nativeObservedTotals"] == [2, 4]
        assert orders[0]["nativeMaxObservedTotal"] == 4
        assert orders[0]["directCurrentSessionMatched"] is False
    print("Offline comparison self-check passed")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("captures", nargs="*", type=Path)
    parser.add_argument("--raw-root", type=Path, default=ROOT / "backend/data/ticks/GC/GC_12-26")
    parser.add_argument("--ice-snapshot", type=Path, help="Use saved public snapshot instead of live API")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--restart-at", action="append", default=[],
                        help="Known/approximate restart ISO timestamp; retained as an explicit annotation")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    files = args.captures or sorted(Path(__file__).with_name("bookmap-si-capture").glob("*.jsonl"))
    events, metadata, limitations = load_capture(files)
    if args.ice_snapshot:
        snapshot = json.loads(args.ice_snapshot.read_text(encoding="utf-8-sig"))
        current_session = snapshot.get("sessionId")
    else:
        snapshot = public_api("/api/orderflow/icebergs?symbol=GC&contract=GC&min_volume=1&limit=2000")
        current_session = public_api("/api/market-data/status")["sources"]["rithmic"].get("icebergSessionId")
    now = datetime.now(TZ)
    start = min((event["time"] for event in events), default=int(now.timestamp() * 1000)) - 60_000
    end = int(now.timestamp() * 1000)
    raw, shards = read_raw(args.raw_root, {event["orderId"] for event in events}, start, end)
    orders = compare(events, raw, snapshot.get("icebergs", []), current_session)
    output = {
        "capturedAtUtcPlus7": now.isoformat(), "currentDirectSession": current_session,
        "captureFiles": list(map(str, files)), "captureMetadata": metadata,
        "knownRestartAnnotations": args.restart_at,
        "rawWindow": {"fromUtcPlus7": local_time(start), "toUtcPlus7": local_time(end),
                      "readOnlyShards": shards},
        "summary": {"canonicalNativeEvents": len(events), "nativeOrders": len(orders),
                    "nativeOrdersMatchedCurrentDirectICE": sum(row["directCurrentSessionMatched"] for row in orders),
                    "nativeOrdersMatchedAnyRetainedDirectICE": sum(row["directAnyRetainedSessionMatched"] for row in orders),
                    "nativeOrdersEqualNativeTotalAndPassiveRawQuantity": sum(
                        row["nativeMaxObservedTotal"] == row["rawPassiveQuantity"] for row in orders),
                    "nativeOrdersWithPassiveRawTrades": sum(bool(row["rawPassiveTrades"]) for row in orders)},
        "orders": orders, "parseLimitations": limitations,
        "limitations": [
            "No raw MBO history: missing ICE causes and refill lifecycles cannot be reconstructed from trades alone.",
            "Snapshot totalSize may be latest/final order quantity; never treat it as quantity known at the event timestamp.",
            "The native public event API has no unique event ID; identical events within one capture are flagged ambiguous.",
            "Native and direct starts/snapshots differ. A missing current-session ICE is not automatically a detector error.",
            "Screen aggregation of native icons is not inferred from individual public events.",
        ],
    }
    target = args.output or Path(__file__).with_name("native-direct-comparison-" + now.strftime("%Y%m%d-%H%M%S") + ".json")
    target.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(target)
    print(json.dumps(output["summary"], indent=2))
    for row in orders:
        print(row["orderId"], row["firstDetectionTimeUtcPlus7"], row["nativeDetectionPrices"],
              "nativeTotal=" + str(row["nativeMaxObservedTotal"]),
              "passiveRaw=" + str(row["rawPassiveQuantity"]),
              "aggressiveRaw=" + str(row["rawAggressiveQuantity"]),
              "directICE=" + str(row["directCurrentSessionMatched"]))


if __name__ == "__main__":
    main()
