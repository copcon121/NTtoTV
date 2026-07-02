from __future__ import annotations

import argparse
import csv
import sqlite3
from collections.abc import Iterable
from datetime import datetime, timezone
from pathlib import Path


DEBUG_DIR = Path.home() / "Documents" / "NinjaTrader 8" / "debug-exports"


def latest(pattern: str) -> Path | None:
    files = sorted(DEBUG_DIR.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
    return files[0] if files else None


def read_csv_by_ms(path: Path, time_field: str) -> dict[int, dict[str, str]]:
    rows: dict[int, dict[str, str]] = {}
    with path.open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            raw = row.get(time_field)
            if raw in (None, ""):
                continue
            try:
                rows[int(float(raw))] = row
            except ValueError:
                continue
    return rows


def read_backend(db_path: Path, symbol: str, contract: str, tf: str) -> dict[int, dict[str, object]]:
    if not db_path.exists():
        return {}
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            """
            SELECT b.time,
                   b.open,b.high,b.low,b.close,b.volume AS barVolume,
                   vd.volume AS deltaVolume,
                   vd.buy_volume AS buyVolume,
                   vd.sell_volume AS sellVolume,
                   vd.delta AS delta,
                   vd.close_delta AS closeDelta
            FROM bars b
            LEFT JOIN orderflow_volume_delta vd
              ON vd.symbol=b.symbol
             AND vd.contract=b.contract
             AND vd.timeframe=b.timeframe
             AND vd.time=b.time
            WHERE b.symbol=? AND b.contract=? AND b.timeframe=?
            """,
            (symbol, contract, tf),
        ).fetchall()
    finally:
        conn.close()
    return {int(row["time"]): dict(row) for row in rows}


def as_int(row: dict[str, object] | None, field: str) -> int | None:
    if row is None:
        return None
    value = row.get(field)
    if value in (None, ""):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def iso(ms: int) -> str:
    return datetime.fromtimestamp(ms / 1000, timezone.utc).strftime("%Y-%m-%d %H:%M")


def diff_stats(
    label: str,
    base: dict[int, dict[str, object]],
    other: dict[int, dict[str, object]],
    base_field: str,
    other_field: str,
    times: Iterable[int],
) -> None:
    gt = lt = eq = miss = 0
    diffs: list[int] = []
    examples: list[tuple[int, int | None, int | None, int | None]] = []
    for t in times:
        b = as_int(base.get(t), base_field)
        o = as_int(other.get(t), other_field)
        if b is None or o is None:
            miss += 1
            continue
        d = o - b
        diffs.append(d)
        if d > 0:
            gt += 1
        elif d < 0:
            lt += 1
        else:
            eq += 1
        if d != 0 and len(examples) < 8:
            examples.append((t, b, o, d))

    print(f"\n{label}: {other_field} - {base_field}")
    print(f"  other>base={gt} other<base={lt} equal={eq} missing={miss}")
    if diffs:
        print(
            "  sum_diff={sum_diff} mean_diff={mean:.2f} max_abs={max_abs}".format(
                sum_diff=sum(diffs),
                mean=sum(diffs) / len(diffs),
                max_abs=max(abs(d) for d in diffs),
            )
        )
    if examples:
        print("  first diffs:")
        for t, b, o, d in examples:
            print(f"    {iso(t)} base={b} other={o} diff={d}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare NT native diagnostics, MyVolumeDelta, AddOn counter, and backend cache.")
    parser.add_argument("--native", type=Path, default=None)
    parser.add_argument("--myvd", type=Path, default=None)
    parser.add_argument("--addon", type=Path, default=None)
    parser.add_argument("--db", type=Path, default=Path("backend/data/app.sqlite"))
    parser.add_argument("--symbol", default="GC")
    parser.add_argument("--contract", default="GC")
    parser.add_argument("--tf", default="1m")
    parser.add_argument("--limit", type=int, default=80)
    args = parser.parse_args()

    native_path = args.native or latest("NTtoTVNativeDiagnostics_*.csv")
    myvd_path = args.myvd or latest("MyVolumeDelta_*.csv")
    addon_path = args.addon or latest("GcChartBridgeMarketData_*.csv")

    if native_path is None:
        raise SystemExit(f"No native diagnostics CSV found in {DEBUG_DIR}")

    native = read_csv_by_ms(native_path, "bucketUtcMs")
    myvd = read_csv_by_ms(myvd_path, "bucketUtcMs") if myvd_path else {}
    addon = read_csv_by_ms(addon_path, "bucketStartUtcMs") if addon_path else {}
    backend = read_backend(args.db, args.symbol, args.contract, args.tf)

    times = sorted(native.keys())
    if args.limit > 0:
        times = times[-args.limit :]

    print("Native:", native_path)
    print("MyVolumeDelta:", myvd_path or "(missing)")
    print("AddOn:", addon_path or "(missing)")
    print("Backend:", args.db)
    if times:
        print("Range:", iso(times[0]), "->", iso(times[-1]), "rows", len(times))

    diff_stats("Native vs MyVolumeDelta chart volume", native, myvd, "chartVolume", "barVolume", times)
    diff_stats("Native vs MyVolumeDelta delta", native, myvd, "ofDeltaClose", "delta", times)
    diff_stats("Native vs AddOn volume", native, addon, "chartVolume", "volume", times)
    diff_stats("Native vs AddOn native-style bid/ask volume", native, addon, "bsvVolume", "volume", times)
    diff_stats("Native vs backend bar volume", native, backend, "chartVolume", "barVolume", times)
    diff_stats("Native vs backend delta", native, backend, "ofDeltaClose", "delta", times)
    diff_stats("Native chart volume vs volumetric total", native, native, "chartVolume", "volTotalVolume", times)
    diff_stats("Native OF delta vs volumetric delta", native, native, "ofDeltaClose", "volBarDelta", times)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
