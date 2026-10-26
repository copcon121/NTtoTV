#!/usr/bin/env python3
"""Cross-check history coverage, raw trades and footprint volume without writes."""
from __future__ import annotations

import argparse
import gzip
import json
import sqlite3
import sys
from contextlib import closing
from pathlib import Path


def reader(path):
    connection = sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True, timeout=5)
    connection.execute("PRAGMA query_only=ON")
    return connection


def audit(data_dir, wire_symbol, *, verify_archives=False, on_progress=None):
    root = data_dir / "rithmic-history" / wire_symbol
    progress = json.loads((root / "progress.json").read_text())
    start, end = progress["rangeStart"], progress["rangeEnd"]
    expected = list(range(start, end, 3600))
    done = {int(k): v for k, v in progress["chunks"].items() if v.get("complete")
            and v.get("captureVersion", 1) >= 3
            and start <= int(k) < end}
    missing = [t for t in expected if t not in done or done[t]["end"] != min(t + 3600, end) - 1
               or not (root / f"{t}-{done[t]['end']}.jsonl.gz").is_file()]
    raw = {}
    contract = progress["sourceContract"]
    safe_contract = "".join(c if c.isalnum() or c in "-_." else "_" for c in contract)
    for path in (data_dir / "ticks" / "GC" / safe_contract).glob("*.sqlite"):
        with closing(reader(path)) as c:
            for hour, count, volume in c.execute(
                "SELECT (time/3600000)*3600,COUNT(*),SUM(volume) FROM ticks NOT INDEXED "
                "WHERE source='rithmic_history' AND time>=? AND time<? GROUP BY 1",
                (start * 1000, end * 1000),
            ):
                raw[hour] = (count, volume)
    with closing(reader(data_dir / "app.sqlite")) as c:
        quality = {(hour, tf): (n, volume, classified, unknown)
                   for hour, tf, n, volume, classified, unknown in c.execute(
                       "SELECT (time/3600000)*3600,timeframe,COUNT(*),SUM(total_volume),"
                       "SUM(classified_volume),SUM(unknown_volume) FROM footprint_history_quality "
                       "WHERE contract=? AND time>=? AND time<? GROUP BY 1,2",
                       (contract, start * 1000, end * 1000))}
        actual_levels = dict(c.execute(
            "SELECT (time/3600000)*3600,COUNT(*) FROM footprint_levels "
            "WHERE contract=? AND time>=? AND time<? GROUP BY 1",
            (contract, start * 1000, end * 1000)))
    mismatches = []
    for index, (hour, summary) in enumerate(sorted(done.items()), 1):
        if raw.get(hour, (0, 0)) != (summary["trades"], summary["volume"]):
            mismatches.append({"hour": hour, "kind": "raw_count_or_volume"})
        total_bars = 0
        for tf in ("30s", "1m"):
            n, volume, classified, unknown = quality.get((hour, tf), (0, 0, 0, 0))
            total_bars += n
            if volume != summary["volume"] or classified + unknown != volume or unknown != summary["unknownVolume"]:
                mismatches.append({"hour": hour, "kind": "footprint_volume", "tf": tf})
        if total_bars != summary["footprintBars"] or actual_levels.get(hour, 0) != summary["footprintLevels"]:
            mismatches.append({"hour": hour, "kind": "footprint_row_count"})
        if verify_archives:
            with gzip.open(root / f"{hour}-{summary['end']}.jsonl.gz", "rt", encoding="utf-8") as stream:
                metadata = json.loads(next(stream))
                count = sum(1 for _ in stream)  # verifies the full gzip CRC
            if (metadata["start"] != hour or metadata["end"] != summary["end"] or count != summary["trades"]
                    or not metadata.get("finishIndexExclusive")
                    or (count >= 10_000 and metadata.get("effectiveReplayCap") != 10_000)):
                mismatches.append({"hour": hour, "kind": "compressed_archive"})
        if on_progress and index % 100 == 0:
            on_progress(index, len(done))
    totals = {key: sum(v[key] for v in done.values())
              for key in ("trades", "volume", "unknownVolume", "footprintBars", "footprintLevels", "chartGapsFilled")}
    return {"state": progress["status"], "wireSymbol": wire_symbol, "sourceContract": contract,
            "rangeStart": start, "rangeEnd": end, "expectedHours": len(expected),
            "completedHours": len(done), "missingHours": len(missing),
            "coverageComplete": not missing, "integrityPassed": not mismatches,
            "archivesChecked": verify_archives, "mismatches": mismatches,
            "unknownVolumePercent": round(100 * totals["unknownVolume"] / max(1, totals["volume"]), 4),
            **totals}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--data-dir", type=Path, default=Path(__file__).resolve().parents[1] / "data")
    p.add_argument("--symbol", default="GCZ6")
    p.add_argument("--verify-archives", action="store_true")
    p.add_argument("--allow-partial", action="store_true")
    p.add_argument("--progress", action="store_true")
    p.add_argument("--output", type=Path, help="save the audit report as UTF-8 JSON")
    args = p.parse_args()
    if not args.symbol.isalnum():
        p.error("invalid symbol")
    def progress(checked, total):
        print(json.dumps({"auditedHours": checked, "totalHours": total}), file=sys.stderr, flush=True)
    result = audit(args.data_dir, args.symbol, verify_archives=args.verify_archives,
                   on_progress=progress if args.progress else None)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result), flush=True)
    return 0 if result["integrityPassed"] and (result["coverageComplete"] or args.allow_partial) else 2


if __name__ == "__main__":
    raise SystemExit(main())
