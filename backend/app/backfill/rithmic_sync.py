"""Atomic, source-scoped repair of logical chart rows from History Plant."""

from contextlib import closing
from dataclasses import replace

from .rithmic_history import QUALITY_SCHEMA

from ..storage.cache_store import CacheStore
from ..storage.keyed_store import (
    _UPSERT_BAR, _UPSERT_VOLUME_DELTA, _UPSERT_FOOTPRINT_BAR, _UPSERT_FOOTPRINT_LEVEL,
    _bar_params, _volume_delta_params, _footprint_bar_params, _footprint_level_params,
)

HISTORY_SYNC_SCHEMA = QUALITY_SCHEMA + """
CREATE TABLE IF NOT EXISTS rithmic_history_ownership (
    symbol TEXT NOT NULL, contract TEXT NOT NULL, timeframe TEXT NOT NULL,
    time INTEGER NOT NULL, physical_contract TEXT NOT NULL,
    PRIMARY KEY(symbol, contract, timeframe, time)
);
"""


def history_profile_ranges(cache: CacheStore, physical_contract: str, symbol: str,
                           messages: list[dict], start: int, end: int, refresh_since: int):
    """Audit all minute summaries, downloading dense ladders only for repairs."""
    with closing(cache.reader()) as conn:
        cached = {row["time"]: row for row in conn.execute(
            "SELECT b.*,o.physical_contract,d.volume AS delta_volume,d.buy_volume,d.sell_volume,"
            "q.total_volume AS quality_volume,q.classified_volume,f.bar_delta,"
            "SUM(l.bid_volume) AS ladder_sell,SUM(l.ask_volume) AS ladder_buy "
            "FROM bars b LEFT JOIN rithmic_history_ownership o USING(symbol,contract,timeframe,time) "
            "LEFT JOIN orderflow_volume_delta d USING(symbol,contract,timeframe,time) "
            "LEFT JOIN footprint_history_quality q USING(symbol,contract,timeframe,time) "
            "LEFT JOIN footprint_bars f USING(symbol,contract,timeframe,time) "
            "LEFT JOIN footprint_levels l USING(symbol,contract,timeframe,time) "
            "WHERE b.symbol=? AND b.contract=? AND b.timeframe='1m' AND b.time>=? AND b.time<=? "
            "GROUP BY b.time", (symbol, symbol, start - 60_000, end),
        )}
    needed = []
    for message in messages:
        if message.get("marker") is None:
            continue
        at = int(message["marker"]) * 1000 - 60_000
        old = cached.get(at)
        if old is not None:
            owner = old["physical_contract"]
            if owner not in (None, physical_contract):
                continue
            if old["source"] != "rithmic" and (
                old["source"] not in {"rithmic_history", "rithmic-history"} or owner is None
            ):
                continue
            volume = int(message.get("volume") or 0)
            buy, sell = int(message.get("bidVolume") or 0), int(message.get("askVolume") or 0)
            complete = (
                owner == physical_contract and old["closed"] and at < refresh_since
                and old["volume"] == old["delta_volume"] == old["quality_volume"] == volume
                and old["buy_volume"] == buy and old["sell_volume"] == sell
                and old["classified_volume"] == buy + sell
                and (old["ladder_buy"] or 0) == buy and (old["ladder_sell"] or 0) == sell
                and (old["bar_delta"] == buy - sell or buy + sell == 0)
                and all(message.get(name) is not None and abs(old[name] - float(message[name])) < 1e-8
                        for name in ("open", "high", "low", "close"))
            )
            if complete:
                continue
        needed.append(at)
    ranges = []
    for at in sorted(set(needed)):
        if ranges and at <= ranges[-1][1] + 1:
            ranges[-1][1] = at + 59_999
        else:
            ranges.append([at, at + 59_999])
    return [(max(start, lo), min(end, hi)) for lo, hi in ranges
            if max(start, lo) <= min(end, hi)]


def persist_history_batch(cache: CacheStore, physical_contract: str, last_closed: int,
                          *, bars=(), volume_deltas=(), footprint_bars=(), footprint_levels=()):
    """Fill holes and repair Rithmic rows, preserving other feeds and open bars.

    The caller holds the pipeline source lock. Every provenance decision and
    corresponding OHLCV/delta/ladder replacement shares one SQLite transaction.
    Physical-contract archives used by the manual/ML downloader are untouched.
    """
    bars, deltas, headers, levels = list(bars), list(volume_deltas), list(footprint_bars), list(footprint_levels)
    key = lambda row: (row.symbol, row.contract, row.timeframe, row.time)

    def write(conn):
        eligible = set()
        unchanged_candles = set()
        for bar in bars:
            if not bar.closed or bar.time > last_closed:
                continue
            identity = key(bar)
            old = conn.execute(
                "SELECT source,open,high,low,close,volume FROM bars "
                "WHERE symbol=? AND contract=? AND timeframe=? AND time=?", identity
            ).fetchone()
            owner = conn.execute(
                "SELECT physical_contract FROM rithmic_history_ownership "
                "WHERE symbol=? AND contract=? AND timeframe=? AND time=?", identity
            ).fetchone()
            if old is not None and old["source"] != "rithmic":
                if old["source"] not in {"rithmic_history", "rithmic-history"} or owner is None or owner[0] != physical_contract:
                    continue
            if owner is not None and owner[0] != physical_contract:
                continue
            eligible.add(identity)
            if old is not None and old["volume"] == bar.volume and all(
                abs(old[name] - getattr(bar, name)) < 1e-8 for name in ("open", "high", "low", "close")
            ):
                unchanged_candles.add(identity)
        if not eligible:
            return 0, 0
        conn.executemany(_UPSERT_BAR, [_bar_params(row) for row in bars if key(row) in eligible])
        delta_rows, quality_rows = [], []
        bar_by_key = {key(row): row for row in bars}
        for row in deltas:
            identity = key(row)
            if identity not in eligible:
                continue
            old = conn.execute(
                "SELECT volume,buy_volume,sell_volume,delta,delta_high,delta_low,open_delta "
                "FROM orderflow_volume_delta WHERE symbol=? AND contract=? AND timeframe=? AND time=?", identity
            ).fetchone()
            if identity in unchanged_candles and old is not None and tuple(old[:4]) == (
                row.volume, row.buy_volume, row.sell_volume, row.delta
            ):
                # Minute replay supplies final delta, not its intrabar path.
                # Keep measured extrema whenever complete realtime data agrees.
                row = replace(row, delta_high=old[4], delta_low=old[5], open_delta=old[6])
            delta_rows.append(_volume_delta_params(row))
            total = bar_by_key[identity].volume
            classified = row.buy_volume + row.sell_volume
            quality_rows.append((*identity, total, classified, max(0, total - classified), "rithmic_history_sync"))
        conn.executemany(_UPSERT_VOLUME_DELTA, delta_rows)
        accepted_headers = [row for row in headers if key(row) in eligible]
        conn.executemany("DELETE FROM footprint_levels WHERE symbol=? AND contract=? AND timeframe=? AND time=?",
                         [key(row) for row in accepted_headers])
        conn.executemany(_UPSERT_FOOTPRINT_BAR, [_footprint_bar_params(row) for row in accepted_headers])
        conn.executemany(_UPSERT_FOOTPRINT_LEVEL,
                         [_footprint_level_params(row) for row in levels if key(row) in eligible])
        conn.executemany("INSERT OR REPLACE INTO rithmic_history_ownership VALUES(?,?,?,?,?)",
                         [(*identity, physical_contract) for identity in sorted(eligible)])
        conn.executemany("INSERT OR REPLACE INTO footprint_history_quality VALUES(?,?,?,?,?,?,?,?)", quality_rows)
        return len(eligible), len(accepted_headers)

    return cache.writer.write(write)
