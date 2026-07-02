"""Compare MyVolumeDelta NinjaTrader CSV export against NTtoTV cache rows.

Example:
    python scripts/compare_nt_volume_delta_export.py ^
        --csv "%USERPROFILE%\\Documents\\NinjaTrader 8\\debug-exports\\MyVolumeDelta_GC_08-26_1_Minute.csv" ^
        --db backend\\data\\app.sqlite --symbol GC --contract GC --tf 1m
"""

from __future__ import annotations

import argparse
import csv
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable


PRICE_FIELDS = ("open", "high", "low", "close")
INT_FIELDS = (
    "barVolume",
    "deltaVolume",
    "buyVolume",
    "sellVolume",
    "delta",
    "deltaHigh",
    "deltaLow",
    "openDelta",
    "closeDelta",
)
PY_FIELD_MAP = {
    "barVolume": "py_barVolume",
    "deltaVolume": "py_deltaVolume",
    "buyVolume": "py_buyVolume",
    "sellVolume": "py_sellVolume",
    "delta": "py_delta",
    "deltaHigh": "py_deltaHigh",
    "deltaLow": "py_deltaLow",
    "openDelta": "py_openDelta",
    "closeDelta": "py_closeDelta",
}


@dataclass(frozen=True)
class Diff:
    time: int | None
    nt_index: int | None
    field: str
    nt_value: object
    py_value: object


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compare NT MyVolumeDelta debug CSV with NTtoTV SQLite cache."
    )
    parser.add_argument("--csv", required=True, type=Path, help="MyVolumeDelta CSV export path")
    parser.add_argument("--db", default=Path("backend/data/app.sqlite"), type=Path)
    parser.add_argument("--symbol", default="GC")
    parser.add_argument("--contract", default="GC", help="Logical cache contract, usually GC")
    parser.add_argument("--tf", default="1m")
    parser.add_argument(
        "--time-offset-ms",
        default=0,
        type=int,
        help="Offset added to the selected NT time column before matching Python cache rows.",
    )
    parser.add_argument(
        "--time-column",
        choices=("auto", "utcMs", "bucketUtcMs"),
        default="auto",
        help="Use bucketUtcMs by default when present because NT minute bars are close-time stamped.",
    )
    parser.add_argument(
        "--match",
        choices=("time", "row"),
        default="time",
        help="Match by bar start timestamp or by sorted row order.",
    )
    parser.add_argument("--price-tolerance", default=0.00001, type=float)
    parser.add_argument("--limit", default=80, type=int, help="Max diffs to print")
    parser.add_argument(
        "--fields",
        default=",".join((*PRICE_FIELDS, *INT_FIELDS)),
        help="Comma-separated fields to compare.",
    )
    return parser.parse_args()


def read_nt_rows(path: Path, time_offset_ms: int, time_column: str) -> tuple[list[dict[str, object]], str]:
    rows: list[dict[str, object]] = []
    with path.open("r", newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        fieldnames = set(reader.fieldnames or ())
        selected_time_column = (
            "bucketUtcMs"
            if time_column == "auto" and "bucketUtcMs" in fieldnames
            else "utcMs"
            if time_column == "auto"
            else time_column
        )
        required = {selected_time_column, "barIndex", *PRICE_FIELDS, *INT_FIELDS}
        missing = required - fieldnames
        if missing:
            raise SystemExit(f"CSV is missing columns: {', '.join(sorted(missing))}")
        for raw in reader:
            row: dict[str, object] = {
                "time": int(raw[selected_time_column]) + time_offset_ms,
                "barIndex": int(raw["barIndex"]),
            }
            for field in PRICE_FIELDS:
                row[field] = float(raw[field])
            for field in INT_FIELDS:
                row[field] = int(float(raw[field]))
            rows.append(row)
    return rows, selected_time_column


def read_python_rows(
    db_path: Path,
    *,
    symbol: str,
    contract: str,
    tf: str,
    start: int,
    end: int,
) -> list[dict[str, object]]:
    if not db_path.exists():
        raise SystemExit(f"SQLite DB not found: {db_path}")
    query = """
        SELECT
            b.time,
            b.open,
            b.high,
            b.low,
            b.close,
            b.volume AS py_barVolume,
            vd.volume AS py_deltaVolume,
            vd.buy_volume AS py_buyVolume,
            vd.sell_volume AS py_sellVolume,
            vd.delta AS py_delta,
            vd.delta_high AS py_deltaHigh,
            vd.delta_low AS py_deltaLow,
            vd.open_delta AS py_openDelta,
            vd.close_delta AS py_closeDelta
        FROM bars b
        LEFT JOIN orderflow_volume_delta vd
          ON vd.symbol = b.symbol
         AND vd.contract = b.contract
         AND vd.timeframe = b.timeframe
         AND vd.time = b.time
        WHERE b.symbol = ?
          AND b.contract = ?
          AND b.timeframe = ?
          AND b.time BETWEEN ? AND ?
        ORDER BY b.time ASC
    """
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        return [dict(row) for row in conn.execute(query, (symbol, contract, tf, start, end))]


def compare_rows(
    nt_rows: list[dict[str, object]],
    py_rows: list[dict[str, object]],
    *,
    match: str,
    price_tolerance: float,
    fields: set[str],
) -> list[Diff]:
    diffs: list[Diff] = []
    if match == "row":
        for nt, py in zip(nt_rows, py_rows):
            compare_one(nt, py, diffs, price_tolerance, fields)
        for nt in nt_rows[len(py_rows) :]:
            diffs.append(Diff(int(nt["time"]), int(nt["barIndex"]), "missingPythonRow", "present", None))
        for py in py_rows[len(nt_rows) :]:
            diffs.append(Diff(int(py["time"]), None, "extraPythonRow", None, "present"))
        return diffs

    py_by_time = {int(row["time"]): row for row in py_rows}
    nt_times = set()
    for nt in nt_rows:
        time = int(nt["time"])
        nt_times.add(time)
        py = py_by_time.get(time)
        if py is None:
            diffs.append(Diff(time, int(nt["barIndex"]), "missingPythonRow", "present", None))
            continue
        compare_one(nt, py, diffs, price_tolerance, fields)

    for py in py_rows:
        time = int(py["time"])
        if time not in nt_times:
            diffs.append(Diff(time, None, "extraPythonRow", None, "present"))
    return diffs


def compare_one(
    nt: dict[str, object],
    py: dict[str, object],
    diffs: list[Diff],
    price_tolerance: float,
    fields: set[str],
) -> None:
    time = int(nt["time"])
    nt_index = int(nt["barIndex"])
    for field in PRICE_FIELDS:
        if field not in fields:
            continue
        nt_value = float(nt[field])
        py_value = float(py[field])
        if abs(nt_value - py_value) > price_tolerance:
            diffs.append(Diff(time, nt_index, field, nt_value, py_value))

    for field in INT_FIELDS:
        if field not in fields:
            continue
        py_field = PY_FIELD_MAP[field]
        nt_value = int(nt[field])
        py_raw = py.get(py_field)
        if py_raw is None:
            diffs.append(Diff(time, nt_index, field, nt_value, None))
            continue
        py_value = int(py_raw)
        if nt_value != py_value:
            diffs.append(Diff(time, nt_index, field, nt_value, py_value))


def summarize(diffs: Iterable[Diff]) -> dict[str, int]:
    out: dict[str, int] = {}
    for diff in diffs:
        out[diff.field] = out.get(diff.field, 0) + 1
    return out


def utc_text(ms: int | None) -> str:
    if ms is None:
        return "-"
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


def main() -> None:
    args = parse_args()
    nt_rows, selected_time_column = read_nt_rows(
        args.csv,
        args.time_offset_ms,
        args.time_column,
    )
    if not nt_rows:
        raise SystemExit("CSV has no rows.")

    start = min(int(row["time"]) for row in nt_rows)
    end = max(int(row["time"]) for row in nt_rows)
    py_rows = read_python_rows(
        args.db,
        symbol=args.symbol,
        contract=args.contract,
        tf=args.tf,
        start=start,
        end=end,
    )
    diffs = compare_rows(
        nt_rows,
        py_rows,
        match=args.match,
        price_tolerance=args.price_tolerance,
        fields=parse_fields(args.fields),
    )

    print(f"NT rows: {len(nt_rows)}")
    print(f"Python rows: {len(py_rows)}")
    print(f"Range: {utc_text(start)} -> {utc_text(end)}")
    print(f"NT time column: {selected_time_column}")
    print(f"Match: {args.match}")
    print(f"Diffs: {len(diffs)}")
    for field, count in sorted(summarize(diffs).items(), key=lambda item: (-item[1], item[0])):
        print(f"  {field}: {count}")

    if diffs:
        print()
        print("First diffs:")
        for diff in diffs[: args.limit]:
            print(
                f"{utc_text(diff.time)} barIndex={diff.nt_index} "
                f"{diff.field}: NT={diff.nt_value} PY={diff.py_value}"
            )


def parse_fields(raw: str) -> set[str]:
    allowed = {*PRICE_FIELDS, *INT_FIELDS}
    fields = {field.strip() for field in raw.split(",") if field.strip()}
    unknown = fields - allowed
    if unknown:
        raise SystemExit(f"Unknown compare fields: {', '.join(sorted(unknown))}")
    return fields


if __name__ == "__main__":
    main()
