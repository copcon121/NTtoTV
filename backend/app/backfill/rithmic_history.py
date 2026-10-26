"""Resumable Rithmic history archive and source-isolated footprint materializer.

One-hour UTC requests are canonical: retrying an hour cannot duplicate raw
prints, including genuinely identical prints at the same microsecond. Native
replay bid/ask volumes are archived verbatim, including unknown classifications.
No historical data enters live ingestion, alerts, trading, or source arbitration.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import math
import os
import time
from dataclasses import dataclass, field, replace
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from ..engines.footprint_engine import FootprintEngine
from ..models import NormalizedTrade, Side
from ..storage.cache_store import CacheStore
from ..storage.tick_store import TickStore, _INSERT_TRADE_SQL
from ..storage.records import BarRecord, FootprintBarRecord, FootprintLevelRecord, VolumeDeltaRecord
from ..storage.keyed_store import (
    _UPSERT_BAR, _UPSERT_VOLUME_DELTA, _UPSERT_FOOTPRINT_BAR, _UPSERT_FOOTPRINT_LEVEL,
    _bar_params, _volume_delta_params, _footprint_bar_params, _footprint_level_params,
)

HISTORY_SOURCE = "rithmic_history"
HOUR_SECONDS = 3600


@contextmanager
def history_lock(root: Path):
    """Keep a single downloader per symbol, including its source retry waits."""
    root.mkdir(parents=True, exist_ok=True)
    lock = (root / "download.lock").open("a+b")
    if lock.tell() == 0:
        lock.write(b"0")
        lock.flush()
    lock.seek(0)
    acquired = False
    try:
        if os.name == "nt":
            import msvcrt
            msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        acquired = True
        yield
    finally:
        if acquired:
            lock.seek(0)
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(lock.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl
                fcntl.flock(lock.fileno(), fcntl.LOCK_UN)
        lock.close()


def history_print(message: dict, *, start: int, end: int, ordinal: int) -> dict:
    """Validate one tick bar; use its END clock (the start may be clamped)."""
    seconds, micros = message.get("seconds") or [], message.get("micros") or []
    if message.get("numTrades") != 1 or not seconds or len(seconds) != len(micros):
        raise ValueError("history response is not a timestamped one-trade bar")
    if message.get("barType") != 1 or message.get("typeSpecifier") != "1":
        raise ValueError("history response is aggregated instead of one-trade data")
    timestamp_us = int(seconds[-1]) * 1_000_000 + int(micros[-1])
    if not 0 <= int(micros[-1]) < 1_000_000 or not start * 1_000_000 <= timestamp_us < (end + 1) * 1_000_000:
        raise ValueError("history trade timestamp is outside the requested interval")
    price = float(message["close"])
    if not math.isfinite(price) or any(abs(float(message[k]) - price) > 1e-7 for k in ("open", "high", "low")):
        raise ValueError("one-trade bar contains multiple prices")
    volume = int(message.get("volume") or 0)
    bid, ask = int(message.get("bidVolume") or 0), int(message.get("askVolume") or 0)
    if volume <= 0 or min(bid, ask) < 0 or bid + ask > volume:
        raise ValueError("invalid historical bid/ask volume")
    return {
        "ordinal": ordinal, "timeUs": timestamp_us, "price": round(price, 10),
        "volume": volume, "bidVolume": bid, "askVolume": ask,
        "unknownVolume": volume - bid - ask,
        "bidVolumePresent": message.get("bidVolume") is not None,
        "askVolumePresent": message.get("askVolume") is not None,
        "replaySequences": message.get("sequences", []),
    }


def normalized_history_trade(row: dict, *, contract: str, chunk_start: int) -> NormalizedTrade:
    # Opaque storage identity; exact capture order is the archive's ordinal.
    identity = f"rithmic-history-v1|{contract}|{chunk_start}|{row['ordinal']}"
    sequence = int.from_bytes(hashlib.sha256(identity.encode()).digest()[:8], "big") & ((1 << 63) - 1)
    side = (Side.BUY if row["askVolume"] == row["volume"] else
            Side.SELL if row["bidVolume"] == row["volume"] else None)
    return NormalizedTrade(
        symbol="GC", contract=contract, time=row["timeUs"] // 1000,
        price=row["price"], volume=row["volume"], bid=None, ask=None,
        best_bid=None, best_ask=None, sequence=sequence,
        # .NET epoch ticks preserve the historical clock's microseconds, not
        # an exchange timestamp. No exchange/source clock is fabricated.
        time_ticks=621355968000000000 + row["timeUs"] * 10,
        source=HISTORY_SOURCE, side=side,
    )


@dataclass
class _Bar:
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: int = 0
    bid: int = 0
    ask: int = 0
    delta_high: int = 0
    delta_low: int = 0
    levels: dict[float, list[int]] = field(default_factory=dict)


def build_history_footprints(rows: list[dict], contract: str):
    """Aggregate in O(trades); calculate footprint metrics once per closed bar."""
    buckets: dict[tuple[str, int], _Bar] = {}
    previous_time = -1
    for row in rows:
        if row["timeUs"] < previous_time:
            raise ValueError("history prints are not chronological")
        previous_time = row["timeUs"]
        for tf, duration in (("30s", 30_000), ("1m", 60_000)):
            timestamp = row["timeUs"] // 1000
            bucket = timestamp - timestamp % duration
            price = round(round(row["price"] / 0.1) * 0.1, 10)
            bar = buckets.setdefault((tf, bucket), _Bar(bucket, price, price, price, price))
            bar.high, bar.low, bar.close = max(bar.high, price), min(bar.low, price), price
            bar.volume += row["volume"]
            bar.bid += row["bidVolume"]
            bar.ask += row["askVolume"]
            delta = bar.ask - bar.bid
            bar.delta_high, bar.delta_low = max(bar.delta_high, delta), min(bar.delta_low, delta)
            level = bar.levels.setdefault(price, [0, 0])
            level[0] += row["bidVolume"]
            level[1] += row["askVolume"]
    bars, deltas, headers, levels, quality = [], [], [], [], []
    engines = {tf: FootprintEngine(timeframe=tf) for tf in ("30s", "1m")}
    for (tf, timestamp), bar in sorted(buckets.items()):
        engine = engines[tf]
        engine.seed_bar(contract, symbol="GC", time=timestamp, open=bar.open,
                        high=bar.high, low=bar.low, close=bar.close,
                        rows=[(p, v[0], v[1]) for p, v in bar.levels.items()])
        fp = engine.current_update(contract)
        assert fp is not None
        bars.append(BarRecord("GC", contract, tf, timestamp, bar.open, bar.high,
                              bar.low, bar.close, bar.volume, True, HISTORY_SOURCE))
        deltas.append(VolumeDeltaRecord("GC", contract, tf, timestamp, bar.volume,
                      bar.ask, bar.bid, bar.ask - bar.bid, bar.delta_high, bar.delta_low, 0, bar.ask - bar.bid))
        headers.append(FootprintBarRecord(
            symbol="GC", contract=contract, timeframe=tf, time=timestamp,
            poc=fp.poc if bar.bid + bar.ask else None,
            bar_delta=fp.bar_delta, buy_pct=fp.buy_pct, sell_pct=fp.sell_pct,
            unfinished_high=all(v > 0 for v in bar.levels[bar.high]),
            unfinished_low=all(v > 0 for v in bar.levels[bar.low]),
            open_price=fp.open, high_price=fp.high, low_price=fp.low, close_price=fp.close,
            poc_volume=fp.poc_volume, vah=fp.vah if bar.bid + bar.ask else None,
            val=fp.val if bar.bid + bar.ask else None,
        ))
        levels.extend(FootprintLevelRecord("GC", contract, tf, timestamp,
                      cell.price, cell.bid, cell.ask, cell.imbalance) for cell in fp.rows)
        known_prices = {cell.price for cell in fp.rows}
        levels.extend(FootprintLevelRecord("GC", contract, tf, timestamp, p, 0, 0)
                      for p in bar.levels if p not in known_prices)
        quality.append(("GC", contract, tf, timestamp, bar.volume, bar.bid + bar.ask,
                        bar.volume - bar.bid - bar.ask, HISTORY_SOURCE))
    return bars, deltas, headers, levels, quality


QUALITY_SCHEMA = """
CREATE TABLE IF NOT EXISTS footprint_history_quality (
    symbol TEXT NOT NULL, contract TEXT NOT NULL, timeframe TEXT NOT NULL,
    time INTEGER NOT NULL, total_volume INTEGER NOT NULL,
    classified_volume INTEGER NOT NULL, unknown_volume INTEGER NOT NULL,
    source TEXT NOT NULL,
    PRIMARY KEY(symbol, contract, timeframe, time)
);
"""


def materialize_history(cache: CacheStore, rows: list[dict], contract: str) -> dict:
    bars, deltas, headers, levels, quality = build_history_footprints(rows, contract)
    cache.upsert_derived_batch(bars=bars, volume_deltas=deltas, footprint_bars=headers,
                       footprint_levels=levels, replace_footprint_levels=True)
    cache.writer.executemany(
        "INSERT OR REPLACE INTO footprint_history_quality VALUES(?,?,?,?,?,?,?,?)", quality)

    def fill_chart(conn):
        eligible = set()
        owned = set()
        for bar in bars:
            old = conn.execute(
                "SELECT open,high,low,close,volume,source FROM bars WHERE symbol=? AND contract='GC' AND timeframe=? AND time=?",
                (bar.symbol, bar.timeframe, bar.time),
            ).fetchone()
            provenance = conn.execute(
                "SELECT 1 FROM footprint_history_quality WHERE symbol=? AND contract='GC' AND timeframe=? AND time=? AND source=?",
                (bar.symbol, bar.timeframe, bar.time, HISTORY_SOURCE),
            ).fetchone()
            own_bar = provenance is not None and old is not None and old[5] == HISTORY_SOURCE
            if own_bar:
                owned.add((bar.timeframe, bar.time))
            compatible = own_bar or old is None or (
                all(abs(old[i] - value) < 0.00001 for i, value in enumerate((bar.open, bar.high, bar.low, bar.close)))
                and old[4] == bar.volume
            )
            # Never attach a different physical contract's ladder to an
            # existing logical candle, or overwrite an existing footprint.
            present = conn.execute(
                "SELECT 1 FROM footprint_bars WHERE symbol=? AND contract='GC' AND timeframe=? AND time=?",
                (bar.symbol, bar.timeframe, bar.time),
            ).fetchone()
            if compatible and (not present or own_bar):
                eligible.add((bar.timeframe, bar.time))
        # A repaired provider-capped hour may extend a previously partial bar.
        # Refresh only rows owned by this history importer; preserve all others.
        conn.executemany(
            "DELETE FROM footprint_levels WHERE symbol='GC' AND contract='GC' AND timeframe=? AND time=?",
            sorted(owned),
        )
        for sql, records, params in (
            (_UPSERT_BAR, bars, _bar_params), (_UPSERT_VOLUME_DELTA, deltas, _volume_delta_params),
            (_UPSERT_FOOTPRINT_BAR, headers, _footprint_bar_params),
            (_UPSERT_FOOTPRINT_LEVEL, levels, _footprint_level_params),
        ):
            insert = sql.split("ON CONFLICT", 1)[0].replace("INSERT INTO", "INSERT OR IGNORE INTO")
            conn.executemany(insert, [params(replace(r, contract="GC")) for r in records
                                     if (r.timeframe, r.time) in eligible - owned])
            conn.executemany(sql, [params(replace(r, contract="GC")) for r in records
                                  if (r.timeframe, r.time) in owned])
        conn.executemany("INSERT OR REPLACE INTO footprint_history_quality VALUES(?,?,?,?,?,?,?,?)",
                         [(s, "GC", tf, t, v, c, u, src) for s, _, tf, t, v, c, u, src in quality
                          if (tf, t) in eligible])
        return len(eligible)
    filled = cache.writer.write(fill_chart)
    return {"footprintBars": len(headers), "footprintLevels": len(levels), "chartGapsFilled": filled}


class HistoryArchive:
    def __init__(self, root: Path, wire_symbol: str):
        if not wire_symbol.isalnum():
            raise ValueError("invalid archive symbol")
        self.root = root / wire_symbol
        self.root.mkdir(parents=True, exist_ok=True)
        self.manifest = self.root / "progress.json"
        self.state = json.loads(self.manifest.read_text()) if self.manifest.exists() else {"schema": 1, "chunks": {}}
        for summary in self.state["chunks"].values():
            if summary.get("captureVersion", 1) < 3:
                summary.update(complete=False, reason="legacy_wire_boundary_requires_replay")

    def path(self, start: int, end: int) -> Path:
        return self.root / f"{start}-{end}.jsonl.gz"

    def read(self, start: int, end: int) -> list[dict]:
        with gzip.open(self.path(start, end), "rt", encoding="utf-8") as stream:
            header = json.loads(next(stream))
            if header.get("start") != start or header.get("end") != end or header.get("schema") != 1:
                raise ValueError("history archive metadata mismatch")
            rows = [json.loads(line) for line in stream]
            if not header.get("finishIndexExclusive"):
                raise ValueError("legacy archive omitted inclusive final seconds")
            if len(rows) >= 10_000 and header.get("effectiveReplayCap") != 10_000:
                raise ValueError("legacy archive may be provider-capped")
            return rows

    def write(self, start: int, end: int, rows: list[dict], metadata: dict):
        target = self.path(start, end)
        temporary = target.with_suffix(".tmp")
        with gzip.open(temporary, "wt", encoding="utf-8", compresslevel=6) as stream:
            stream.write(json.dumps({"schema": 1, "start": start, "end": end,
                                    "clock": "rithmic_history_data_bar", "quoteHistory": False,
                                    "effectiveReplayCap": 10_000,
                                    "finishIndexExclusive": True, **metadata}) + "\n")
            for row in rows:
                stream.write(json.dumps(row, separators=(",", ":")) + "\n")
        os.replace(temporary, target)

    def complete(self, start: int, end: int, stats: dict):
        self.state["chunks"][str(start)] = {"end": end, "complete": True, **stats}
        self.state["updatedAt"] = int(time.time() * 1000)
        temporary = self.manifest.with_suffix(".tmp")
        temporary.write_text(json.dumps(self.state), encoding="utf-8")
        os.replace(temporary, self.manifest)

    def is_complete(self, start: int, end: int) -> bool:
        entry = self.state["chunks"].get(str(start), {})
        return entry.get("complete", False) and entry.get("end") == end and self.path(start, end).is_file()


def purge_history_archives(root: Path, cutoff_seconds: int) -> int:
    """Expire completed compressed raw hours; preserve manifests and temp files."""
    removed = 0
    if not root.exists():
        return removed
    for path in root.glob("*/*.jsonl.gz*"):
        if path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
            continue
        name = path.name.removesuffix(".capped").removesuffix(".incomplete")
        if not name.endswith(".jsonl.gz"):
            continue
        parts = name.removesuffix(".jsonl.gz").split("-")
        if len(parts) == 2 and all(p.isdigit() for p in parts) and int(parts[1]) < cutoff_seconds:
            path.unlink()
            removed += 1
    return removed


def import_history_hour(archive: HistoryArchive, cache: CacheStore, ticks: TickStore,
                        rows: list[dict], *, contract: str, start: int, end: int) -> dict:
    # Reimport is idempotent even after a crash between raw/cache/manifest commits.
    replace_history_raw_hour(ticks, rows, contract=contract, start=start, end=end)
    stats = materialize_history(cache, rows, contract)
    stats.update(trades=len(rows), volume=sum(r["volume"] for r in rows),
                 unknownVolume=sum(r["unknownVolume"] for r in rows), captureVersion=3)
    archive.complete(start, end, stats)
    return stats


def replace_history_raw_hour(ticks: TickStore, rows: list[dict], *, contract: str,
                             start: int, end: int) -> None:
    """Replace ONLY the importer's source in one verified UTC hour atomically.

    Replay counters are request-relative; subrequests can reorder same-clock
    prints. Append-only deduplication cannot safely reconcile capped responses.
    """
    if start % 3600 or end != start + 3599:
        raise ValueError("raw history replacement requires one complete UTC hour")
    if any(not start * 1_000_000 <= r["timeUs"] < (end + 1) * 1_000_000 for r in rows):
        raise ValueError("raw history replacement has an out-of-range print")
    trades = [normalized_history_trade(row, contract=contract, chunk_start=start) for row in rows]
    path = ticks.shard_path(contract, datetime.fromtimestamp(start, timezone.utc).date())
    if not trades and not path.exists():
        return
    writer = ticks._writer_for(path)
    params = [ticks._trade_params(trade) for trade in trades]
    def replace(conn):
        conn.execute("DELETE FROM ticks WHERE source=? AND time>=? AND time<?",
                     (HISTORY_SOURCE, start * 1000, (end + 1) * 1000))
        conn.executemany(_INSERT_TRADE_SQL, params)
    writer.write(replace)
