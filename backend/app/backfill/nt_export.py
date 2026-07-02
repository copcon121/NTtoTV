"""Import NinjaTrader historical tick exports into the raw Tick_Store.

NT's Historical Data export can produce three semicolon-delimited files for a
range:

* ``*.Last.txt``: ``timestamp;last;bid;ask;volume``
* ``*.Bid.txt``: ``timestamp;bid;;;bid_size``
* ``*.Ask.txt``: ``timestamp;ask;;;ask_size``

This module parses those files, writes raw trades/quote snapshots into the same
day-sharded SQLite Tick_Store used by the live stream, and can rebuild derived
cache rows for the touched range. It intentionally does not talk to NinjaTrader;
the user chooses the missing range, exports the files, then runs this importer.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone, tzinfo
from pathlib import Path
from typing import Iterator, Literal

from app.engines.bar_aggregator import SUPPORTED_TFS, BarAggregator
from app.engines.big_trade_engine import BigTradeEngine
from app.engines.footprint_engine import FOOTPRINT_TIMEFRAME, FootprintEngine
from app.engines.fvg_signal_engine import FVG_SIGNAL_TIMEFRAME, FvgSignalEngine
from app.engines.session_calendar import TF_MS as _TF_MS, is_gc_session_open
from app.engines.volume_delta_engine import VolumeDeltaEngine
from app.models import NormalizedQuote, NormalizedTrade
from app.models.timestamp import from_canonical_ms, to_canonical_ms
from app.storage.cache_store import CacheStore
from app.storage.connection import connect_reader
from app.storage.records import (
    BarRecord,
    BigTradeRecord,
    FootprintBarRecord,
    FootprintLevelRecord,
    FvgSignalRecord,
    VolumeDeltaRecord,
)
from app.storage.tick_store import SYMBOL, TickStore

ImportMode = Literal["missing-only", "replace-range"]

@dataclass(frozen=True)
class NtExportPaths:
    """Paths to the optional NT export files for one gap range."""

    last: Path | None = None
    bid: Path | None = None
    ask: Path | None = None


@dataclass(slots=True)
class ImportSummary:
    """High-level result of parsing/importing one NT export set."""

    symbol: str
    contract: str
    mode: ImportMode
    dry_run: bool
    range_from: int | None
    range_to: int | None
    trades: int = 0
    quotes: int = 0
    raw_trades_before: int = 0
    raw_quotes_before: int = 0
    raw_trades_after: int = 0
    raw_quotes_after: int = 0
    deleted_trades: int = 0
    deleted_quotes: int = 0
    rebuilt_bars: int = 0
    rebuilt_volume_deltas: int = 0
    rebuilt_footprint_bars: int = 0
    rebuilt_footprint_levels: int = 0
    rebuilt_big_trades: int = 0
    rebuilt_fvg_signals: int = 0


@dataclass(slots=True)
class DerivedImportSummary:
    """Result of importing lightweight cache rows from NT Last exports only."""

    symbol: str
    contract: str
    source_contract: str
    range_from: int | None
    range_to: int | None
    trades: int = 0
    bars: int = 0
    volume_deltas: int = 0
    dry_run: bool = False


@dataclass(frozen=True, slots=True)
class _QuoteSideEvent:
    time: int
    sequence: int
    side: Literal["bid", "ask"]
    price: float
    size: int


@dataclass(slots=True)
class _StreamStats:
    trades: int = 0
    quotes: int = 0
    range_from: int | None = None
    range_to: int | None = None


def parse_utc_offset(value: str) -> tzinfo:
    """Parse ``+HH:MM``/``-HH:MM`` into a fixed-offset timezone."""
    text = value.strip()
    if text in {"Z", "UTC", "+00:00", "-00:00"}:
        return timezone.utc
    if len(text) != 6 or text[0] not in "+-" or text[3] != ":":
        raise ValueError("UTC offset must look like +00:00 or -04:00")
    sign = 1 if text[0] == "+" else -1
    hours = int(text[1:3])
    minutes = int(text[4:6])
    if hours > 23 or minutes > 59:
        raise ValueError("UTC offset is out of range")
    return timezone(sign * timedelta(hours=hours, minutes=minutes))


def parse_nt_timestamp(value: str, export_tz: tzinfo = timezone.utc) -> int:
    """Parse NT export timestamp ``yyyyMMdd HHmmss fffffff`` to UTC ms."""
    parts = value.strip().split()
    if len(parts) != 3:
        raise ValueError(f"invalid NT timestamp: {value!r}")
    date_part, time_part, frac_part = parts
    if len(date_part) != 8 or len(time_part) != 6:
        raise ValueError(f"invalid NT timestamp: {value!r}")
    micro = int((frac_part + "000000")[:6])
    dt = datetime(
        int(date_part[0:4]),
        int(date_part[4:6]),
        int(date_part[6:8]),
        int(time_part[0:2]),
        int(time_part[2:4]),
        int(time_part[4:6]),
        micro,
        tzinfo=export_tz,
    )
    return to_canonical_ms(dt.astimezone(timezone.utc))


def parse_time_bound(value: str | None, export_tz: tzinfo = timezone.utc) -> int | None:
    """Parse CLI range bounds as ms, ISO-8601, or NT export timestamp."""
    if value is None or value == "":
        return None
    text = value.strip()
    if text.isdigit():
        return int(text)
    if len(text.split()) == 3:
        return parse_nt_timestamp(text, export_tz)
    try:
        normalized = text.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ValueError(
            "time bound must be epoch ms, ISO-8601, or 'yyyyMMdd HHmmss fffffff'"
        ) from exc
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=export_tz)
    return to_canonical_ms(dt.astimezone(timezone.utc))


def import_nt_export_gap(
    *,
    paths: NtExportPaths,
    contract: str,
    symbol: str = SYMBOL,
    ticks_dir: Path | str,
    cache_db_path: Path | str | None = None,
    mode: ImportMode = "missing-only",
    frm: int | None = None,
    to: int | None = None,
    export_tz: tzinfo = timezone.utc,
    dry_run: bool = False,
    rebuild: bool = True,
    chunk_size: int = 100_000,
) -> ImportSummary:
    """Import an NT export set into Tick_Store and optionally rebuild cache.

    ``missing-only`` inserts/upserts exported rows without deleting existing raw
    rows. ``replace-range`` first deletes raw trades/quotes in the target range,
    then imports the export. Both modes clear/rebuild derived cache rows for the
    touched range when ``rebuild`` is true and ``cache_db_path`` is provided.
    """
    if mode not in ("missing-only", "replace-range"):
        raise ValueError(f"unsupported import mode: {mode!r}")
    if chunk_size <= 0:
        raise ValueError("chunk_size must be > 0")

    store = TickStore(ticks_dir=ticks_dir)
    cache = (
        CacheStore(cache_db_path)
        if cache_db_path is not None and rebuild and not dry_run
        else None
    )
    try:
        summary = ImportSummary(
            symbol=symbol,
            contract=contract,
            mode=mode,
            dry_run=dry_run,
            range_from=frm,
            range_to=to,
        )

        if dry_run:
            stats = _stream_export_records(
                paths=paths,
                symbol=symbol,
                contract=contract,
                export_tz=export_tz,
                frm=frm,
                to=to,
                store=None,
                chunk_size=chunk_size,
            )
            _apply_stream_stats(summary, stats)
            if summary.range_from is not None and summary.range_to is not None:
                before_trades, before_quotes = count_raw_range(
                    store, contract, summary.range_from, summary.range_to
                )
                summary.raw_trades_before = before_trades
                summary.raw_quotes_before = before_quotes
            summary.raw_trades_after = summary.raw_trades_before
            summary.raw_quotes_after = summary.raw_quotes_before
            return summary

        if mode == "replace-range" and (frm is None or to is None):
            stats = _stream_export_records(
                paths=paths,
                symbol=symbol,
                contract=contract,
                export_tz=export_tz,
                frm=frm,
                to=to,
                store=None,
                chunk_size=chunk_size,
            )
            _apply_stream_stats(summary, stats)

        actual_from = summary.range_from
        actual_to = summary.range_to
        if actual_from is not None and actual_to is not None:
            before_trades, before_quotes = count_raw_range(
                store, contract, actual_from, actual_to
            )
            summary.raw_trades_before = before_trades
            summary.raw_quotes_before = before_quotes

        if mode == "replace-range" and actual_from is not None and actual_to is not None:
            deleted_trades, deleted_quotes = delete_raw_range(
                store, contract, actual_from, actual_to
            )
            summary.deleted_trades = deleted_trades
            summary.deleted_quotes = deleted_quotes

        stats = _stream_export_records(
            paths=paths,
            symbol=symbol,
            contract=contract,
            export_tz=export_tz,
            frm=frm,
            to=to,
            store=store,
            chunk_size=chunk_size,
        )
        _apply_stream_stats(summary, stats)

        actual_from = summary.range_from
        actual_to = summary.range_to
        if actual_from is not None and actual_to is not None:
            after_trades, after_quotes = count_raw_range(
                store, contract, actual_from, actual_to
            )
            summary.raw_trades_after = after_trades
            summary.raw_quotes_after = after_quotes

            if rebuild and cache is not None:
                rebuilt = rebuild_derived_cache(
                    cache, store, symbol, contract, actual_from, actual_to
                )
                summary.rebuilt_bars = rebuilt.rebuilt_bars
                summary.rebuilt_volume_deltas = rebuilt.rebuilt_volume_deltas
                summary.rebuilt_footprint_bars = rebuilt.rebuilt_footprint_bars
                summary.rebuilt_footprint_levels = rebuilt.rebuilt_footprint_levels
                summary.rebuilt_big_trades = rebuilt.rebuilt_big_trades
                summary.rebuilt_fvg_signals = rebuilt.rebuilt_fvg_signals

        return summary
    finally:
        store.close()
        if cache is not None:
            cache.close()


def import_nt_export_derived_cache(
    *,
    last_paths: list[Path | str],
    contract: str,
    symbol: str = SYMBOL,
    output_contract: str | None = None,
    cache_db_path: Path | str,
    frm: int | None = None,
    to: int | None = None,
    export_tz: tzinfo = timezone.utc,
    dry_run: bool = False,
    chunk_size: int = 10_000,
    clear_derived_range: bool = False,
) -> DerivedImportSummary:
    """Build lightweight OHLCV + volume-delta cache rows from Last exports.

    This path intentionally does not write raw ticks or quote snapshots. It is
    for deep history where chart candles and delta are useful, but full
    bid/ask tick replay would be too large and slow.
    """
    if chunk_size <= 0:
        raise ValueError("chunk_size must be > 0")

    cache_contract = output_contract or symbol
    summary = DerivedImportSummary(
        symbol=symbol,
        contract=cache_contract,
        source_contract=contract,
        range_from=frm,
        range_to=to,
        dry_run=dry_run,
    )
    bar_engine = BarAggregator()
    vd_engines = {tf: VolumeDeltaEngine(timeframe=tf) for tf in SUPPORTED_TFS}
    bars: dict[tuple[str, int], BarRecord] = {}
    volume_deltas: dict[tuple[str, int], VolumeDeltaRecord] = {}

    sorted_paths = sorted(
        (Path(path) for path in last_paths),
        key=lambda path: _first_nt_trade_time(path, export_tz),
    )
    for path in sorted_paths:
        for trade in iter_last_trades(path, symbol, contract, export_tz, frm, to):
            summary.trades += 1
            _include_summary_time(summary, trade.time, frm, to)
            if not is_gc_session_open(trade.time):
                continue

            for update in bar_engine.on_trade(trade):
                bars[(update.tf, update.bar.time)] = BarRecord(
                    symbol=update.symbol,
                    contract=cache_contract,
                    timeframe=update.tf,
                    time=update.bar.time,
                    open=update.bar.open,
                    high=update.bar.high,
                    low=update.bar.low,
                    close=update.bar.close,
                    volume=update.bar.volume,
                    closed=update.closed,
                )
            for tf, engine in vd_engines.items():
                update = engine.on_trade(trade)
                if update is None:
                    continue
                volume_deltas[(tf, update.time)] = VolumeDeltaRecord(
                    symbol=update.symbol,
                    contract=cache_contract,
                    timeframe=update.tf,
                    time=update.time,
                    volume=update.volume,
                    buy_volume=update.buy_volume,
                    sell_volume=update.sell_volume,
                    delta=update.delta,
                    delta_high=update.delta_high,
                    delta_low=update.delta_low,
                    open_delta=update.open_delta,
                    close_delta=update.close_delta,
                )

    # Historical import files are complete ranges; mark the final in-progress
    # buckets closed so cache reads do not expose stale "open" bars.
    for key, rec in list(bars.items()):
        bars[key] = BarRecord(
            symbol=rec.symbol,
            contract=rec.contract,
            timeframe=rec.timeframe,
            time=rec.time,
            open=rec.open,
            high=rec.high,
            low=rec.low,
            close=rec.close,
            volume=rec.volume,
            closed=True,
        )

    summary.bars = len(bars)
    summary.volume_deltas = len(volume_deltas)
    if dry_run:
        return summary

    cache = CacheStore(cache_db_path)
    try:
        if (
            clear_derived_range
            and summary.range_from is not None
            and summary.range_to is not None
        ):
            clear_bar_delta_cache(
                cache,
                symbol,
                cache_contract,
                summary.range_from,
                summary.range_to,
            )
        for batch in _batched(_sorted_records(bars.values()), chunk_size):
            cache.upsert_bars(batch)
        for batch in _batched(_sorted_records(volume_deltas.values()), chunk_size):
            cache.upsert_volume_deltas(batch)
    finally:
        cache.close()
    return summary


def _stream_export_records(
    *,
    paths: NtExportPaths,
    symbol: str,
    contract: str,
    export_tz: tzinfo,
    frm: int | None,
    to: int | None,
    store: TickStore | None,
    chunk_size: int,
) -> _StreamStats:
    stats = _StreamStats(range_from=frm, range_to=to)
    trade_batch: list[NormalizedTrade] = []
    quote_batch: list[NormalizedQuote] = []

    for trade in iter_last_trades(paths.last, symbol, contract, export_tz, frm, to):
        stats.trades += 1
        _include_stream_time(stats, trade.time, frm, to)
        if store is None:
            continue
        trade_batch.append(trade)
        if len(trade_batch) >= chunk_size:
            store.record_trades(trade_batch)
            trade_batch.clear()
    if store is not None and trade_batch:
        store.record_trades(trade_batch)

    for quote in iter_quotes(paths.bid, paths.ask, symbol, contract, export_tz, frm, to):
        stats.quotes += 1
        _include_stream_time(stats, quote.time, frm, to)
        if store is None:
            continue
        quote_batch.append(quote)
        if len(quote_batch) >= chunk_size:
            store.record_quotes(quote_batch)
            quote_batch.clear()
    if store is not None and quote_batch:
        store.record_quotes(quote_batch)

    return stats


def _include_stream_time(
    stats: _StreamStats,
    ts: int,
    frm: int | None,
    to: int | None,
) -> None:
    if frm is None:
        stats.range_from = ts if stats.range_from is None else min(stats.range_from, ts)
    if to is None:
        stats.range_to = ts if stats.range_to is None else max(stats.range_to, ts)


def _include_summary_time(
    summary: DerivedImportSummary,
    ts: int,
    frm: int | None,
    to: int | None,
) -> None:
    if frm is None:
        summary.range_from = ts if summary.range_from is None else min(summary.range_from, ts)
    if to is None:
        summary.range_to = ts if summary.range_to is None else max(summary.range_to, ts)


def _apply_stream_stats(summary: ImportSummary, stats: _StreamStats) -> None:
    summary.trades = stats.trades
    summary.quotes = stats.quotes
    summary.range_from = stats.range_from
    summary.range_to = stats.range_to


def iter_last_trades(
    path: Path | str | None,
    symbol: str,
    contract: str,
    export_tz: tzinfo,
    frm: int | None,
    to: int | None,
) -> Iterator[NormalizedTrade]:
    """Yield normalized trades from an NT ``Last`` export file."""
    if path is None:
        return
    p = Path(path)
    with p.open("r", encoding="utf-8-sig") as fh:
        for line_no, raw in enumerate(fh, start=1):
            line = raw.strip()
            if not line:
                continue
            cols = line.split(";")
            if len(cols) < 5:
                raise ValueError(f"{p}:{line_no}: expected 5 columns in Last export")
            ts = parse_nt_timestamp(cols[0], export_tz)
            if to is not None and ts > to:
                break
            if not _in_range(ts, frm, to):
                continue
            price = _parse_required_float(cols[1], p, line_no, "last")
            bid = _parse_optional_float(cols[2])
            ask = _parse_optional_float(cols[3])
            volume = _parse_required_int(cols[4], p, line_no, "volume")
            yield NormalizedTrade(
                symbol=symbol,
                contract=contract,
                time=ts,
                price=price,
                volume=volume,
                bid=bid,
                ask=ask,
                best_bid=bid,
                best_ask=ask,
                sequence=line_no,
            )


def iter_quotes(
    bid_path: Path | str | None,
    ask_path: Path | str | None,
    symbol: str,
    contract: str,
    export_tz: tzinfo,
    frm: int | None,
    to: int | None,
) -> Iterator[NormalizedQuote]:
    """Merge separate NT Bid/Ask exports into full quote snapshots."""
    bid_iter = _iter_quote_side(bid_path, "bid", export_tz, to)
    ask_iter = _iter_quote_side(ask_path, "ask", export_tz, to)
    bid_event = next(bid_iter, None)
    ask_event = next(ask_iter, None)
    last_bid: float | None = None
    last_ask: float | None = None
    bid_size = 0
    ask_size = 0

    while bid_event is not None or ask_event is not None:
        if ask_event is None or (
            bid_event is not None
            and (bid_event.time, bid_event.sequence) <= (ask_event.time, ask_event.sequence)
        ):
            event = bid_event
            bid_event = next(bid_iter, None)
        else:
            event = ask_event
            ask_event = next(ask_iter, None)
        if event is None:
            continue
        if event.side == "bid":
            last_bid = event.price
            bid_size = event.size
        else:
            last_ask = event.price
            ask_size = event.size
        if last_bid is None or last_ask is None:
            continue
        if not _in_range(event.time, frm, to):
            continue
        yield NormalizedQuote(
            symbol=symbol,
            contract=contract,
            time=event.time,
            bid=last_bid,
            ask=last_ask,
            bid_size=bid_size,
            ask_size=ask_size,
            sequence=event.sequence,
        )


def _iter_quote_side(
    path: Path | str | None,
    side: Literal["bid", "ask"],
    export_tz: tzinfo,
    to: int | None,
) -> Iterator[_QuoteSideEvent]:
    if path is None:
        return
    p = Path(path)
    offset = 0 if side == "bid" else 1
    with p.open("r", encoding="utf-8-sig") as fh:
        for line_no, raw in enumerate(fh, start=1):
            line = raw.strip()
            if not line:
                continue
            cols = line.split(";")
            if len(cols) < 5:
                raise ValueError(f"{p}:{line_no}: expected 5 columns in {side} export")
            ts = parse_nt_timestamp(cols[0], export_tz)
            if to is not None and ts > to:
                break
            price = _parse_required_float(cols[1], p, line_no, side)
            size = _parse_required_int(cols[4], p, line_no, f"{side}_size")
            yield _QuoteSideEvent(
                time=ts,
                sequence=line_no * 2 + offset,
                side=side,
                price=price,
                size=size,
            )


def count_raw_range(
    store: TickStore,
    contract: str,
    frm: int,
    to: int,
) -> tuple[int, int]:
    """Return ``(trade_count, quote_count)`` for a raw range."""
    trades = 0
    quotes = 0
    for shard in _shards_for_range(store, contract, frm, to):
        if not shard.exists():
            continue
        conn = connect_reader(shard)
        try:
            trades += int(
                conn.execute(
                    "SELECT COUNT(*) FROM ticks WHERE time BETWEEN ? AND ?", (frm, to)
                ).fetchone()[0]
            )
            quotes += int(
                conn.execute(
                    "SELECT COUNT(*) FROM quotes WHERE time BETWEEN ? AND ?", (frm, to)
                ).fetchone()[0]
            )
        finally:
            conn.close()
    return trades, quotes


def delete_raw_range(
    store: TickStore,
    contract: str,
    frm: int,
    to: int,
) -> tuple[int, int]:
    """Delete raw trades/quotes in ``[frm, to]`` from existing shards only."""
    deleted_trades = 0
    deleted_quotes = 0
    for shard in _shards_for_range(store, contract, frm, to):
        if not shard.exists():
            continue
        writer = store._writer_for(shard)

        def op(conn) -> tuple[int, int]:
            cur_trades = conn.execute(
                "DELETE FROM ticks WHERE time BETWEEN ? AND ?", (frm, to)
            )
            cur_quotes = conn.execute(
                "DELETE FROM quotes WHERE time BETWEEN ? AND ?", (frm, to)
            )
            return cur_trades.rowcount, cur_quotes.rowcount

        dt, dq = writer.write(op)
        deleted_trades += int(dt)
        deleted_quotes += int(dq)
    return deleted_trades, deleted_quotes


def rebuild_derived_cache(
    cache: CacheStore,
    tick_store: TickStore,
    symbol: str,
    contract: str,
    frm: int,
    to: int,
) -> ImportSummary:
    """Clear and rebuild derived cache rows affected by a raw patch range."""
    read_from, read_to = _expanded_rebuild_range(frm, to)
    clear_derived_cache(cache, symbol, contract, read_from, read_to)

    bar_engine = BarAggregator()
    vd_engines = {tf: VolumeDeltaEngine(timeframe=tf) for tf in SUPPORTED_TFS}
    footprint_engine = FootprintEngine()
    big_trade_engine = BigTradeEngine(dedupe_repeated_timestamp_runs=True)

    bars: dict[tuple[str, int], BarRecord] = {}
    volume_deltas: dict[tuple[str, int], VolumeDeltaRecord] = {}
    footprint_bars: dict[int, FootprintBarRecord] = {}
    footprint_levels: dict[int, list[FootprintLevelRecord]] = {}
    big_trades: list[BigTradeRecord] = []

    for trade in _trades_with_prevailing_quote(tick_store, contract, read_from, read_to):
        if not is_gc_session_open(trade.time):
            continue
        for update in bar_engine.on_trade(trade):
            bars[(update.tf, update.bar.time)] = BarRecord(
                symbol=update.symbol,
                contract=update.contract,
                timeframe=update.tf,
                time=update.bar.time,
                open=update.bar.open,
                high=update.bar.high,
                low=update.bar.low,
                close=update.bar.close,
                volume=update.bar.volume,
                closed=True,
            )
        for tf, engine in vd_engines.items():
            update = engine.on_trade(trade)
            if update is None:
                continue
            volume_deltas[(tf, update.time)] = VolumeDeltaRecord(
                symbol=update.symbol,
                contract=update.contract,
                timeframe=update.tf,
                time=update.time,
                volume=update.volume,
                buy_volume=update.buy_volume,
                sell_volume=update.sell_volume,
                delta=update.delta,
                delta_high=update.delta_high,
                delta_low=update.delta_low,
                open_delta=update.open_delta,
                close_delta=update.close_delta,
            )
        fp = footprint_engine.on_trade(trade)
        if fp is not None:
            footprint_bars[fp.time] = FootprintBarRecord(
                symbol=fp.symbol,
                contract=fp.contract,
                timeframe=fp.tf,
                time=fp.time,
                poc=fp.poc,
                open_price=fp.open,
                high_price=fp.high,
                low_price=fp.low,
                close_price=fp.close,
                poc_volume=fp.poc_volume,
                vah=fp.vah,
                val=fp.val,
                bar_delta=fp.bar_delta,
                buy_pct=fp.buy_pct,
                sell_pct=fp.sell_pct,
                unfinished_high=fp.unfinished_auction.high,
                unfinished_low=fp.unfinished_auction.low,
            )
            footprint_levels[fp.time] = [
                FootprintLevelRecord(
                    symbol=fp.symbol,
                    contract=fp.contract,
                    timeframe=fp.tf,
                    time=fp.time,
                    price=row.price,
                    bid_volume=row.bid,
                    ask_volume=row.ask,
                    imbalance=row.imbalance,
                )
                for row in fp.rows
            ]
        for bt in big_trade_engine.on_trade(trade):
            big_trades.append(_big_trade_record(bt))

    for bt in big_trade_engine.flush(contract):
        big_trades.append(_big_trade_record(bt))

    # FVG Signal grading pass: feed finalized footprint bars chronologically
    fvg_engine = FvgSignalEngine()
    fvg_signals: list[FvgSignalRecord] = []
    for fp_time in sorted(footprint_bars):
        fp_bar = footprint_bars[fp_time]
        fp_levels = footprint_levels.get(fp_time, [])
        rows = [
            (lvl.price, lvl.bid_volume, lvl.ask_volume) for lvl in fp_levels
        ]
        updates = fvg_engine.on_closed_bar(
            symbol=symbol,
            contract=contract,
            time=fp_bar.time,
            open=fp_bar.open_price,
            high=fp_bar.high_price,
            low=fp_bar.low_price,
            close=fp_bar.close_price,
            rows=rows,
            emit_clear=False,
        )
        for upd in updates:
            if upd.phase == "confirmed" and upd.pulse != 0:
                fvg_signals.append(FvgSignalRecord(
                    symbol=upd.symbol,
                    contract=upd.contract,
                    timeframe=upd.tf,
                    time=upd.time,
                    direction=upd.direction,
                    level=upd.level,
                    pulse=upd.pulse,
                    top=float(upd.top if upd.top is not None else 0.0),
                    bottom=float(upd.bottom if upd.bottom is not None else 0.0),
                    breakout_ratio=upd.breakout_ratio,
                ))

    cache.upsert_bars(_sorted_records(bars.values()))
    cache.upsert_volume_deltas(_sorted_records(volume_deltas.values()))
    for fp_bar in _sorted_records(footprint_bars.values()):
        cache.upsert_footprint_bar(fp_bar)
    all_levels = [
        level
        for time in sorted(footprint_levels)
        for level in footprint_levels[time]
    ]
    cache.upsert_footprint_levels(all_levels)
    cache.upsert_big_trades(big_trades)
    if fvg_signals:
        cache.upsert_derived_batch(fvg_signals=fvg_signals)

    return ImportSummary(
        symbol=symbol,
        contract=contract,
        mode="missing-only",
        dry_run=False,
        range_from=read_from,
        range_to=read_to,
        rebuilt_bars=len(bars),
        rebuilt_volume_deltas=len(volume_deltas),
        rebuilt_footprint_bars=len(footprint_bars),
        rebuilt_footprint_levels=len(all_levels),
        rebuilt_big_trades=len(big_trades),
        rebuilt_fvg_signals=len(fvg_signals),
    )


def clear_derived_cache(
    cache: CacheStore,
    symbol: str,
    contract: str,
    frm: int,
    to: int,
) -> None:
    """Delete derived rows in a range before replaying raw ticks."""

    def op(conn) -> None:
        for table in (
            "bars",
            "orderflow_volume_delta",
            "footprint_bars",
            "footprint_levels",
            "big_trades",
            "fvg_signals",
        ):
            conn.execute(
                f"DELETE FROM {table} "
                "WHERE symbol = ? AND contract = ? AND time BETWEEN ? AND ?",
                (symbol, contract, int(frm), int(to)),
            )

    cache.writer.write(op)


def clear_bar_delta_cache(
    cache: CacheStore,
    symbol: str,
    contract: str,
    frm: int,
    to: int,
) -> None:
    """Delete only lightweight chart rows in a range before Last-only import."""

    def op(conn) -> None:
        for table in ("bars", "orderflow_volume_delta"):
            conn.execute(
                f"DELETE FROM {table} "
                "WHERE symbol = ? AND contract = ? AND time BETWEEN ? AND ?",
                (symbol, contract, int(frm), int(to)),
            )

    cache.writer.write(op)


def _trades_with_prevailing_quote(
    tick_store: TickStore,
    contract: str,
    frm: int,
    to: int,
) -> Iterator[NormalizedTrade]:
    trades = list(tick_store.read_range(contract, frm, to))
    quotes = list(tick_store.read_quotes(contract, frm, to))
    qi = 0
    book: tuple[float | None, float | None] | None = None
    for trade in trades:
        while qi < len(quotes) and quotes[qi].time <= trade.time:
            book = (quotes[qi].bid, quotes[qi].ask)
            qi += 1
        if trade.bid is None and trade.ask is None and book is not None:
            trade.bid, trade.ask = book
            if trade.best_bid is None:
                trade.best_bid = book[0]
            if trade.best_ask is None:
                trade.best_ask = book[1]
        yield trade


def _expanded_rebuild_range(frm: int, to: int) -> tuple[int, int]:
    agg = BarAggregator()
    starts = [agg.bucket_start(frm, tf) for tf in SUPPORTED_TFS]
    ends = [agg.bucket_start(to, tf) + _TF_MS[tf] - 1 for tf in SUPPORTED_TFS]
    return min(starts), max(ends)


def _shards_for_range(store: TickStore, contract: str, frm: int, to: int) -> Iterator[Path]:
    day = from_canonical_ms(frm).date()
    end_day = from_canonical_ms(to).date()
    while day <= end_day:
        yield store.shard_path(contract, day)
        day += timedelta(days=1)


def _in_range(ts: int, frm: int | None, to: int | None) -> bool:
    return (frm is None or ts >= frm) and (to is None or ts <= to)


def _parse_optional_float(value: str) -> float | None:
    text = value.strip()
    return None if text == "" else float(text)


def _parse_required_float(value: str, path: Path, line_no: int, field: str) -> float:
    text = value.strip()
    if text == "":
        raise ValueError(f"{path}:{line_no}: missing {field}")
    return float(text)


def _parse_required_int(value: str, path: Path, line_no: int, field: str) -> int:
    text = value.strip()
    if text == "":
        raise ValueError(f"{path}:{line_no}: missing {field}")
    return int(float(text))


def _first_nt_trade_time(path: Path, export_tz: tzinfo) -> int:
    with path.open("r", encoding="utf-8-sig") as fh:
        for raw in fh:
            line = raw.strip()
            if not line:
                continue
            cols = line.split(";")
            if not cols:
                continue
            return parse_nt_timestamp(cols[0], export_tz)
    return 2**63 - 1


def _batched(records, size: int):
    batch = []
    for rec in records:
        batch.append(rec)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch


def _big_trade_record(bt) -> BigTradeRecord:
    return BigTradeRecord(
        symbol=bt.symbol,
        contract=bt.contract,
        time=bt.time,
        price=bt.price,
        volume=bt.volume,
        side=bt.side,
        trade_id=bt.trade_id,
    )


def _sorted_records(records):
    return sorted(records, key=lambda rec: (rec.time, getattr(rec, "timeframe", "")))


def _print_summary(summary: ImportSummary) -> None:
    def ts(value: int | None) -> str:
        return "n/a" if value is None else from_canonical_ms(value).isoformat()

    print(f"symbol={summary.symbol} contract={summary.contract} mode={summary.mode}")
    print(f"dry_run={summary.dry_run}")
    print(f"range_from={summary.range_from} ({ts(summary.range_from)})")
    print(f"range_to={summary.range_to} ({ts(summary.range_to)})")
    print(f"parsed_trades={summary.trades} parsed_quotes={summary.quotes}")
    print(
        "raw_before="
        f"{summary.raw_trades_before} trades/{summary.raw_quotes_before} quotes"
    )
    if summary.deleted_trades or summary.deleted_quotes:
        print(f"deleted_raw={summary.deleted_trades} trades/{summary.deleted_quotes} quotes")
    print(
        "raw_after="
        f"{summary.raw_trades_after} trades/{summary.raw_quotes_after} quotes"
    )
    if summary.rebuilt_bars or summary.rebuilt_volume_deltas:
        print(
            "rebuilt="
            f"{summary.rebuilt_bars} bars, "
            f"{summary.rebuilt_volume_deltas} volume_delta, "
            f"{summary.rebuilt_footprint_bars} footprint_bars, "
            f"{summary.rebuilt_footprint_levels} footprint_levels, "
            f"{summary.rebuilt_big_trades} big_trades, "
            f"{summary.rebuilt_fvg_signals} fvg_signals"
        )


def _print_derived_summary(summary: DerivedImportSummary) -> None:
    def ts(value: int | None) -> str:
        return "n/a" if value is None else from_canonical_ms(value).isoformat()

    print(f"symbol={summary.symbol} contract={summary.contract} mode=derived-cache")
    if summary.source_contract != summary.contract:
        print(f"source_contract={summary.source_contract}")
    print(f"dry_run={summary.dry_run}")
    print(f"range_from={summary.range_from} ({ts(summary.range_from)})")
    print(f"range_to={summary.range_to} ({ts(summary.range_to)})")
    print(f"parsed_trades={summary.trades}")
    print(f"cached={summary.bars} bars/{summary.volume_deltas} volume_delta")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Import NinjaTrader Last/Bid/Ask exports")
    parser.add_argument("--contract", required=True, help="Contract, e.g. 'GC 08-26'")
    parser.add_argument("--symbol", default=SYMBOL)
    parser.add_argument("--last", type=Path, help="Path to *.Last.txt")
    parser.add_argument("--bid", type=Path, help="Path to *.Bid.txt")
    parser.add_argument("--ask", type=Path, help="Path to *.Ask.txt")
    parser.add_argument(
        "--source-dir",
        type=Path,
        help="Folder of *.Last.txt files for --derived-only imports",
    )
    parser.add_argument("--data-dir", type=Path, default=Path("data"))
    parser.add_argument("--ticks-dir", type=Path)
    parser.add_argument("--cache-db", type=Path)
    parser.add_argument("--from", dest="frm")
    parser.add_argument("--to")
    parser.add_argument("--utc-offset", default="+00:00")
    parser.add_argument(
        "--mode",
        choices=("missing-only", "replace-range"),
        default="missing-only",
    )
    parser.add_argument("--chunk-size", type=int, default=100_000)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-rebuild", action="store_true")
    parser.add_argument(
        "--derived-only",
        action="store_true",
        help="read Last exports and write only bars/volume-delta cache rows",
    )
    parser.add_argument(
        "--output-contract",
        help="Cache contract for --derived-only rows; defaults to the chart alias symbol",
    )
    parser.add_argument(
        "--clear-derived-range",
        action="store_true",
        help="With --derived-only, delete existing bars/volume-delta in the imported range first",
    )
    args = parser.parse_args(argv)

    export_tz = parse_utc_offset(args.utc_offset)
    frm = parse_time_bound(args.frm, export_tz)
    to = parse_time_bound(args.to, export_tz)
    if frm is not None and to is not None and frm > to:
        parser.error("--from must be <= --to")

    cache_db = args.cache_db if args.cache_db is not None else args.data_dir / "app.sqlite"
    if args.derived_only:
        if args.source_dir is not None:
            last_paths = sorted(args.source_dir.glob("*.Last.txt"))
        elif args.last is not None:
            last_paths = [args.last]
        else:
            parser.error("--last or --source-dir is required with --derived-only")
        if not last_paths:
            parser.error("no *.Last.txt files found for --derived-only")
        summary = import_nt_export_derived_cache(
            last_paths=last_paths,
            symbol=args.symbol,
            contract=args.contract,
            output_contract=args.output_contract,
            cache_db_path=cache_db,
            frm=frm,
            to=to,
            export_tz=export_tz,
            dry_run=args.dry_run,
            chunk_size=args.chunk_size,
            clear_derived_range=args.clear_derived_range,
        )
        _print_derived_summary(summary)
        return 0

    ticks_dir = args.ticks_dir if args.ticks_dir is not None else args.data_dir / "ticks"
    summary = import_nt_export_gap(
        paths=NtExportPaths(last=args.last, bid=args.bid, ask=args.ask),
        symbol=args.symbol,
        contract=args.contract,
        ticks_dir=ticks_dir,
        cache_db_path=None if args.no_rebuild else cache_db,
        mode=args.mode,
        frm=frm,
        to=to,
        export_tz=export_tz,
        dry_run=args.dry_run,
        rebuild=not args.no_rebuild,
        chunk_size=args.chunk_size,
    )
    _print_summary(summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
