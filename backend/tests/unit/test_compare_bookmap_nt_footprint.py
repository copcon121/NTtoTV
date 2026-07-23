from __future__ import annotations

import importlib.util
import json
import sqlite3
import sys
from pathlib import Path

import pytest


_SCRIPT = Path(__file__).resolve().parents[3] / "scripts" / "compare_bookmap_nt_footprint.py"
_SPEC = importlib.util.spec_from_file_location("compare_bookmap_nt_footprint", _SCRIPT)
assert _SPEC is not None and _SPEC.loader is not None
compare = importlib.util.module_from_spec(_SPEC)
sys.modules[_SPEC.name] = compare
_SPEC.loader.exec_module(compare)


def _payload(*, partial: bool = False) -> dict:
    return {
        "schemaVersion": 1,
        "source": "bookmap_shadow",
        "symbol": "GC",
        "contract": "GC",
        "tf": "1m",
        "time": 1_784_716_800_000,
        "open": 100.0,
        "high": 100.1,
        "low": 99.9,
        "close": 100.1,
        "volume": 10,
        "buyVolume": 6,
        "sellVolume": 4,
        "delta": 2,
        "deltaHigh": 3,
        "deltaLow": -1,
        "openDelta": 0,
        "closeDelta": 2,
        "partialStart": partial,
        "rows": [
            {"price": 100.1, "bid": 0, "ask": 6},
            {"price": 99.9, "bid": 4, "ask": 0},
        ],
    }


def _create_db(path: Path) -> None:
    with sqlite3.connect(path) as connection:
        connection.executescript(
            """
            CREATE TABLE bars (
                symbol TEXT, contract TEXT, timeframe TEXT, time INTEGER,
                open REAL, high REAL, low REAL, close REAL, volume INTEGER, closed INTEGER
            );
            CREATE TABLE orderflow_volume_delta (
                symbol TEXT, contract TEXT, timeframe TEXT, time INTEGER,
                volume INTEGER, buy_volume INTEGER, sell_volume INTEGER,
                delta INTEGER, delta_high INTEGER, delta_low INTEGER,
                open_delta INTEGER, close_delta INTEGER
            );
            CREATE TABLE footprint_levels (
                symbol TEXT, contract TEXT, timeframe TEXT, time INTEGER,
                price REAL, bid_volume INTEGER, ask_volume INTEGER, imbalance TEXT
            );
            """
        )
        connection.execute(
            "INSERT INTO bars VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ("GC", "GC", "1m", 1_784_716_800_000, 100.0, 100.1, 99.9, 100.1, 10, 1),
        )
        connection.execute(
            "INSERT INTO orderflow_volume_delta VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ("GC", "GC", "1m", 1_784_716_800_000, 10, 6, 4, 2, 3, -1, 0, 2),
        )
        connection.executemany(
            "INSERT INTO footprint_levels VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [
                ("GC", "GC", "1m", 1_784_716_800_000, 100.1, 0, 6, None),
                ("GC", "GC", "1m", 1_784_716_800_000, 99.9, 4, 0, None),
            ],
        )


@pytest.mark.unit
def test_exact_bookmap_shadow_matches_nt_native_cache(tmp_path: Path):
    jsonl = tmp_path / "bookmap.jsonl"
    jsonl.write_text(json.dumps(_payload()) + "\n", encoding="utf-8")
    db = tmp_path / "app.sqlite"
    _create_db(db)

    loaded = compare.load_bookmap_bars([jsonl])
    nt_bars, nt_levels = compare.read_nt_snapshot(
        db,
        symbol="GC",
        contract="GC",
        tf="1m",
        start=min(loaded.bars),
        end=max(loaded.bars),
    )
    diffs = compare.compare_snapshots(
        loaded.bars,
        nt_bars,
        nt_levels,
        tick_size=0.1,
        price_tolerance=0.00001,
    )

    assert diffs == []


@pytest.mark.unit
def test_partial_start_is_skipped_and_ladder_diff_is_reported(tmp_path: Path):
    jsonl = tmp_path / "bookmap.jsonl"
    partial = _payload(partial=True)
    full = _payload()
    full["rows"][0]["ask"] = 5
    full["buyVolume"] = 5
    full["volume"] = 9
    full["delta"] = 1
    full["closeDelta"] = 1
    jsonl.write_text(
        json.dumps(partial) + "\n" + json.dumps(full) + "\n",
        encoding="utf-8",
    )
    db = tmp_path / "app.sqlite"
    _create_db(db)

    loaded = compare.load_bookmap_bars([jsonl])
    nt_bars, nt_levels = compare.read_nt_snapshot(
        db,
        symbol="GC",
        contract="GC",
        tf="1m",
        start=min(loaded.bars),
        end=max(loaded.bars),
    )
    diffs = compare.compare_snapshots(
        loaded.bars,
        nt_bars,
        nt_levels,
        tick_size=0.1,
        price_tolerance=0.00001,
    )

    assert loaded.skipped_partial == 1
    assert {diff.field for diff in diffs} >= {"volume", "buyVolume", "delta", "row.ask"}
