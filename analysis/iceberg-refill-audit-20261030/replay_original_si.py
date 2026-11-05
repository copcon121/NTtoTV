"""Compare finite offline inputs with the installed SI 2.08 detector.

Uses the original JAR, not reconstructed Java. Never starts Bookmap, invokes
licensing or provider entrypoints, reads settings, or opens a network session.
Only generated harness classes are compiled, into a disposable temp directory.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
from app.engines.native_iceberg import NativeIcebergDetector
from app.models.canonical import NormalizedTrade, Side

JAR = Path("C:/Bookmap/API/Layer1ApiModules/7.4.0.1---7.7.1.9999---2---stops-icebergs-on-chart---2.08.jar")
BOOKMAP = Path("C:/Program Files/Bookmap")
EXPECTED_SHA = "317e2a8b45e3290e2d4fd41a371e06f08f71b9f3c2fc1072f91b3eb682a215ab"


def event(op, qty=0, *, price=40400, order="A", side="sell", time=None,
          aggressor="aggressor"):
    return {"op": op, "quantity": qty, "price": price, "order": order,
            "side": side, "time": time, "aggressor": aggressor}


# Times establish the hypothesis for delayed/replayed absolute sizes. Neither
# detector's confirmation logic reconciles MBO and executions by source time.
CASES = {
    "partial_fill": [event("new", 10), event("trade", 4, side="buy"),
                     event("change", 6), event("trade", 3, side="buy")],
    "two_refills": [event("new", 5), event("trade", 5, side="buy"),
                    event("change", 5), event("trade", 5, side="buy"), event("change", 5)],
    "overfill_without_replacement": [event("new", 5), event("trade", 8, side="buy")],
    "overfill_then_two_refills": [event("new", 5), event("trade", 8, side="buy"),
                                 event("change", 5), event("trade", 5, side="buy"), event("change", 5)],
    "exact_execution_then_delete": [event("new", 5), event("trade", 5, side="buy"), event("delete")],
    "increase_before_exhaustion": [event("new", 5), event("trade", 2, side="buy"),
                                   event("change", 10), event("trade", 3, side="buy")],
    "exhausted_identity_changes_price": [event("new", 5), event("trade", 5, side="buy"),
                                         event("change", 5, price=40401)],
    "detected_identity_changes_price": [event("new", 5), event("trade", 6, side="buy"),
                                        event("change", 5, price=40401),
                                        event("trade", 5, price=40401, side="buy"),
                                        event("change", 5, price=40401)],
    "trade_through_then_return": [event("new", 5), event("trade", 6, side="buy"),
                                  event("trade", 1, price=40401, order="B", side="buy"),
                                  event("change", 5), event("trade", 5, side="buy"), event("change", 5)],
    "absolute_reduction_before_older_trade": [event("new", 10, time=100),
                                             event("change", 6, time=110),
                                             event("trade", 4, side="buy", time=109),
                                             event("trade", 3, side="buy", time=111)],
    "stale_change_after_newer_exhaustion": [event("new", 10, time=100),
                                           event("trade", 6, side="buy", time=101),
                                           event("change", 4, time=102),
                                           event("trade", 4, side="buy", time=103),
                                           event("change", 4, time=102)],
    "opposite_chain_suspends_original_ice": [event("new", 10),
                                           event("trade", 4, side="buy", aggressor="X"),
                                           event("trade", 3, side="buy", aggressor="Y"),
                                           event("trade", 1, order="B", side="sell", aggressor="Z"),
                                           event("trade", 4, side="buy", aggressor="W")],
    "mbo_rearms_original_ice": [event("new", 10),
                                event("trade", 4, side="buy", aggressor="X"),
                                event("trade", 3, side="buy", aggressor="Y"),
                                event("trade", 1, order="B", side="sell", aggressor="Z"),
                                event("trade", 4, side="buy", aggressor="W"),
                                event("new", 1, order="C"),
                                event("trade", 4, side="buy", aggressor="Q")],
}


def port_run(events):
    detector = NativeIcebergDetector()
    detector.seed_orders([], 0)
    rows = []
    detections = []
    for step, item in enumerate(events, 1):
        time = item["time"] if item["time"] is not None else step * 10
        price = item["price"] / 10
        if item["op"] == "trade":
            updates = detector.on_trade(NormalizedTrade(
                symbol="GC", contract="GC 12-26", time=time, price=price,
                volume=item["quantity"], bid=None, ask=None, best_bid=None,
                best_ask=None, sequence=step, source="rithmic",
                source_time_nanos=time * 1_000_000, side=Side(item["side"]),
                passive_order_id=item["order"], aggressor_order_id=item["aggressor"]))
        else:
            updates = detector.on_mbo_update({"sourceTimeNanos": time * 1_000_000,
                "updates": [{"action": item["op"], "exchangeOrderId": item["order"],
                             "side": item["side"], "price": price,
                             "size": item["quantity"]}]}, time)
        for row in updates:
            if not any(previous["orderId"] == row["orderId"] for previous in rows):
                detections.append(f"{step}:{row['orderId']}")
            rows.append(row)
    return {"detections": detections, "latest": rows[-1] if rows else None,
            "diagnostics": detector.metrics()["icebergDiagnostics"]}


def main():
    digest = hashlib.sha256(JAR.read_bytes()).hexdigest()
    if digest != EXPECTED_SHA:
        raise SystemExit("Original SI JAR identity changed; review before running")
    classpath = ";".join(map(str, [JAR, BOOKMAP / "lib/bm-l1api.jar",
                                  BOOKMAP / "lib/bm-simplified-api-wrapper.jar"]))
    lines = []
    for name, events in CASES.items():
        lines.append(f"case\t{name}")
        for item in events:
            lines.append("\t".join(map(str, [item["op"], item["order"],
                item["price"], item["quantity"], item["side"], item["aggressor"]])))
        lines.append("end")
    with tempfile.TemporaryDirectory(prefix="nttotv-si-offline-") as temp:
        subprocess.run([str(BOOKMAP / "jre/bin/javac.exe"), "-cp", classpath,
                        "-d", temp, str(Path(__file__).with_name("OriginalSiProbe.java"))],
                       check=True, capture_output=True, text=True, timeout=30)
        result = subprocess.run([str(BOOKMAP / "jre/bin/java.exe"), "-cp",
                                 classpath + ";" + temp, "OriginalSiProbe"],
                                input="\n".join(lines) + "\n", capture_output=True,
                                text=True, check=True, timeout=30)
    original = {}
    for line in result.stdout.splitlines():
        name, detections = line.split("\t")
        original[name] = detections.split(",") if detections else []
    results = {name: {"inputs": events, "siDetections": original[name],
                      "port": port_run(events)} for name, events in CASES.items()}
    # Expected finite findings. These assert the audit, not equivalence of the
    # whole products. SI has no refillCount field in its public ICE event.
    for name in CASES:
        if name not in {"exhausted_identity_changes_price",
                        "opposite_chain_suspends_original_ice", "mbo_rearms_original_ice"}:
            assert original[name] == results[name]["port"]["detections"], name
    assert original["exhausted_identity_changes_price"] == ["3:A"]
    assert results["exhausted_identity_changes_price"]["port"]["detections"] == []
    assert results["two_refills"]["port"]["latest"]["refillCount"] == 2
    assert results["overfill_without_replacement"]["port"]["latest"]["refillCount"] == 0
    assert results["detected_identity_changes_price"]["port"]["latest"]["status"] == "invalidated"
    assert results["trade_through_then_return"]["port"]["latest"]["status"] == "invalidated"
    assert original["opposite_chain_suspends_original_ice"] == []
    assert results["opposite_chain_suspends_original_ice"]["port"]["detections"] == ["5:A"]
    assert original["mbo_rearms_original_ice"] == ["7:A"]
    assert results["mbo_rearms_original_ice"]["port"]["detections"] == ["5:A"]
    output = {"originalJar": str(JAR), "originalSha256": digest,
              "scope": "original detector class only; no Bookmap provider or full addon run",
              "cases": results}
    Path(__file__).with_name("replay-results.json").write_text(
        json.dumps(output, indent=2) + "\n", encoding="utf-8")
    for name, row in results.items():
        latest = row["port"]["latest"]
        print(f"{name}: SI={row['siDetections']} PORT={row['port']['detections']} "
              f"refills={latest['refillCount'] if latest else '-'} "
              f"status={latest['status'] if latest else '-'}")
    print(f"Validated {len(CASES)} finite cases against original JAR")


if __name__ == "__main__":
    main()
