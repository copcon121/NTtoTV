"""Compare Bookmap shadow footprint JSONL against finalized NT native cache rows."""

from __future__ import annotations

import argparse
import json
import sqlite3
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


PRICE_FIELDS = ("open", "high", "low", "close")
INTEGER_FIELDS = (
    "volume",
    "buyVolume",
    "sellVolume",
    "delta",
    "deltaHigh",
    "deltaLow",
    "openDelta",
    "closeDelta",
)
NT_FIELD_MAP = {
    "volume": "volume",
    "buyVolume": "buy_volume",
    "sellVolume": "sell_volume",
    "delta": "delta",
    "deltaHigh": "delta_high",
    "deltaLow": "delta_low",
    "openDelta": "open_delta",
    "closeDelta": "close_delta",
}


@dataclass(frozen=True)
class Diff:
    time: int
    field: str
    bookmap_value: object
    nt_value: object
    price: float | None = None


@dataclass(frozen=True)
class LoadResult:
    bars: dict[int, dict[str, Any]]
    skipped_partial: int
    duplicate_times: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compare Bookmap 1m bid/ask ladder exports with NT native footprint cache."
    )
    parser.add_argument("--jsonl", required=True, nargs="+", type=Path)
    parser.add_argument("--db", default=Path("backend/data/app.sqlite"), type=Path)
    parser.add_argument("--symbol", default="GC")
    parser.add_argument("--contract", default="GC")
    parser.add_argument("--tf", default="1m")
    parser.add_argument("--tick-size", default=0.1, type=float)
    parser.add_argument("--price-tolerance", default=0.00001, type=float)
    parser.add_argument("--include-partial", action="store_true")
    parser.add_argument("--limit", default=100, type=int)
    parser.add_argument("--report-json", type=Path)
    parser.add_argument("--fail-on-diff", action="store_true")
    return parser.parse_args()


def load_bookmap_bars(paths: Iterable[Path], *, include_partial: bool = False) -> LoadResult:
    bars: dict[int, dict[str, Any]] = {}
    skipped_partial = 0
    duplicate_times = 0
    for path in paths:
        if not path.exists():
            raise SystemExit(f"Bookmap JSONL not found: {path}")
        with path.open("r", encoding="utf-8") as handle:
            for line_number, raw_line in enumerate(handle, start=1):
                line = raw_line.strip()
                if not line:
                    continue
                try:
                    bar = json.loads(line)
                except json.JSONDecodeError as exc:
                    raise SystemExit(f"Invalid JSON in {path}:{line_number}: {exc}") from exc
                _validate_bookmap_bar(bar, path, line_number)
                if bool(bar.get("partialStart")) and not include_partial:
                    skipped_partial += 1
                    continue
                time_ms = int(bar["time"])
                if time_ms in bars:
                    duplicate_times += 1
                bars[time_ms] = bar
    return LoadResult(bars=dict(sorted(bars.items())), skipped_partial=skipped_partial, duplicate_times=duplicate_times)


def _validate_bookmap_bar(bar: Any, path: Path, line_number: int) -> None:
    if not isinstance(bar, dict):
        raise SystemExit(f"Expected object in {path}:{line_number}")
    required = {
        "time",
        *PRICE_FIELDS,
        *INTEGER_FIELDS,
        "rows",
    }
    missing = required - set(bar)
    if missing:
        raise SystemExit(f"Missing fields in {path}:{line_number}: {', '.join(sorted(missing))}")
    if not isinstance(bar["rows"], list):
        raise SystemExit(f"rows must be a list in {path}:{line_number}")


def read_nt_snapshot(
    db_path: Path,
    *,
    symbol: str,
    contract: str,
    tf: str,
    start: int,
    end: int,
) -> tuple[dict[int, dict[str, Any]], dict[int, list[dict[str, Any]]]]:
    if not db_path.exists():
        raise SystemExit(f"SQLite DB not found: {db_path}")
    uri = f"file:{db_path.resolve().as_posix()}?mode=ro"
    with sqlite3.connect(uri, uri=True) as connection:
        connection.row_factory = sqlite3.Row
        bar_rows = connection.execute(
            """
            SELECT
                b.time,
                b.open,
                b.high,
                b.low,
                b.close,
                b.volume,
                vd.buy_volume,
                vd.sell_volume,
                vd.delta,
                vd.delta_high,
                vd.delta_low,
                vd.open_delta,
                vd.close_delta
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
            ORDER BY b.time
            """,
            (symbol, contract, tf, start, end),
        ).fetchall()
        level_rows = connection.execute(
            """
            SELECT time, price, bid_volume, ask_volume
            FROM footprint_levels
            WHERE symbol = ?
              AND contract = ?
              AND timeframe = ?
              AND time BETWEEN ? AND ?
            ORDER BY time, price DESC
            """,
            (symbol, contract, tf, start, end),
        ).fetchall()

    bars = {int(row["time"]): dict(row) for row in bar_rows}
    levels: dict[int, list[dict[str, Any]]] = {}
    for row in level_rows:
        levels.setdefault(int(row["time"]), []).append(dict(row))
    return bars, levels


def compare_snapshots(
    bookmap_bars: dict[int, dict[str, Any]],
    nt_bars: dict[int, dict[str, Any]],
    nt_levels: dict[int, list[dict[str, Any]]],
    *,
    tick_size: float,
    price_tolerance: float,
) -> list[Diff]:
    if tick_size <= 0:
        raise ValueError("tick_size must be > 0")
    diffs: list[Diff] = []
    bookmap_times = set(bookmap_bars)
    nt_times = set(nt_bars)
    for time_ms in sorted(bookmap_times - nt_times):
        diffs.append(Diff(time_ms, "missingNtBar", "present", None))
    for time_ms in sorted(nt_times - bookmap_times):
        diffs.append(Diff(time_ms, "missingBookmapBar", None, "present"))

    for time_ms in sorted(bookmap_times & nt_times):
        bookmap = bookmap_bars[time_ms]
        nt = nt_bars[time_ms]
        _compare_bar_fields(bookmap, nt, time_ms, diffs, price_tolerance)
        _compare_internal_totals(bookmap, time_ms, diffs)
        _compare_levels(
            bookmap.get("rows", []),
            nt_levels.get(time_ms, []),
            time_ms,
            diffs,
            tick_size,
        )
    return diffs


def _compare_bar_fields(
    bookmap: dict[str, Any],
    nt: dict[str, Any],
    time_ms: int,
    diffs: list[Diff],
    price_tolerance: float,
) -> None:
    for field in PRICE_FIELDS:
        bookmap_value = float(bookmap[field])
        nt_value = float(nt[field])
        if abs(bookmap_value - nt_value) > price_tolerance:
            diffs.append(Diff(time_ms, field, bookmap_value, nt_value))
    for field in INTEGER_FIELDS:
        bookmap_value = int(bookmap[field])
        nt_raw = nt.get(NT_FIELD_MAP[field])
        nt_value = None if nt_raw is None else int(nt_raw)
        if bookmap_value != nt_value:
            diffs.append(Diff(time_ms, field, bookmap_value, nt_value))


def _compare_internal_totals(bookmap: dict[str, Any], time_ms: int, diffs: list[Diff]) -> None:
    row_bid = sum(int(row.get("bid", 0)) for row in bookmap["rows"])
    row_ask = sum(int(row.get("ask", 0)) for row in bookmap["rows"])
    expected = {
        "bookmap.rowsBidVsSell": (row_bid, int(bookmap["sellVolume"])),
        "bookmap.rowsAskVsBuy": (row_ask, int(bookmap["buyVolume"])),
        "bookmap.rowsTotalVsVolume": (row_bid + row_ask, int(bookmap["volume"])),
    }
    for field, (actual, declared) in expected.items():
        if actual != declared:
            diffs.append(Diff(time_ms, field, actual, declared))


def _compare_levels(
    bookmap_rows: list[dict[str, Any]],
    nt_rows: list[dict[str, Any]],
    time_ms: int,
    diffs: list[Diff],
    tick_size: float,
) -> None:
    def tick(price: object) -> int:
        return round(float(price) / tick_size)

    bookmap_by_tick = {tick(row["price"]): row for row in bookmap_rows}
    nt_by_tick = {tick(row["price"]): row for row in nt_rows}
    for price_tick in sorted(set(bookmap_by_tick) | set(nt_by_tick), reverse=True):
        bookmap = bookmap_by_tick.get(price_tick, {})
        nt = nt_by_tick.get(price_tick, {})
        price = round(price_tick * tick_size, 10)
        bookmap_bid = int(bookmap.get("bid", 0))
        bookmap_ask = int(bookmap.get("ask", 0))
        nt_bid = int(nt.get("bid_volume", 0))
        nt_ask = int(nt.get("ask_volume", 0))
        if bookmap_bid != nt_bid:
            diffs.append(Diff(time_ms, "row.bid", bookmap_bid, nt_bid, price))
        if bookmap_ask != nt_ask:
            diffs.append(Diff(time_ms, "row.ask", bookmap_ask, nt_ask, price))


def summarize(diffs: Iterable[Diff]) -> dict[str, int]:
    summary: dict[str, int] = {}
    for diff in diffs:
        summary[diff.field] = summary.get(diff.field, 0) + 1
    return summary


def utc_text(time_ms: int) -> str:
    return datetime.fromtimestamp(time_ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


def main() -> None:
    args = parse_args()
    loaded = load_bookmap_bars(args.jsonl, include_partial=args.include_partial)
    if not loaded.bars:
        raise SystemExit("No comparable Bookmap bars were loaded.")
    start = min(loaded.bars)
    end = max(loaded.bars)
    nt_bars, nt_levels = read_nt_snapshot(
        args.db,
        symbol=args.symbol,
        contract=args.contract,
        tf=args.tf,
        start=start,
        end=end,
    )
    diffs = compare_snapshots(
        loaded.bars,
        nt_bars,
        nt_levels,
        tick_size=args.tick_size,
        price_tolerance=args.price_tolerance,
    )
    matched = len(set(loaded.bars) & set(nt_bars))
    exact_times = {
        time_ms for time_ms in loaded.bars if time_ms in nt_bars
    } - {diff.time for diff in diffs}

    print(f"Bookmap bars: {len(loaded.bars)}")
    print(f"Skipped partial-start bars: {loaded.skipped_partial}")
    print(f"Duplicate Bookmap times (last row kept): {loaded.duplicate_times}")
    print(f"NT bars in range: {len(nt_bars)}")
    print(f"Range: {utc_text(start)} -> {utc_text(end)}")
    print(f"Matched bars: {matched}")
    print(f"Exact bars: {len(exact_times)}")
    print(f"Diffs: {len(diffs)}")
    for field, count in sorted(summarize(diffs).items(), key=lambda item: (-item[1], item[0])):
        print(f"  {field}: {count}")

    if diffs:
        print("\nFirst diffs:")
        for diff in diffs[: args.limit]:
            price_text = "" if diff.price is None else f" price={diff.price}"
            print(
                f"{utc_text(diff.time)}{price_text} {diff.field}: "
                f"Bookmap={diff.bookmap_value} NT={diff.nt_value}"
            )

    if args.report_json is not None:
        report = {
            "bookmapBars": len(loaded.bars),
            "skippedPartialStart": loaded.skipped_partial,
            "duplicateBookmapTimes": loaded.duplicate_times,
            "ntBars": len(nt_bars),
            "matchedBars": matched,
            "exactBars": len(exact_times),
            "range": {"from": start, "to": end},
            "summary": summarize(diffs),
            "diffs": [asdict(diff) for diff in diffs],
        }
        args.report_json.parent.mkdir(parents=True, exist_ok=True)
        args.report_json.write_text(json.dumps(report, indent=2), encoding="utf-8")

    if args.fail_on_diff and diffs:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
