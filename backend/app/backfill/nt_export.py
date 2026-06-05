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
from typing import Iterable, Iterator, Literal

from app.engines.bar_aggregator import SUPPORTED_TFS, BarAggregator
from app.engines.big_trade_engine import BigTradeEngine
from app.engines.footprint_engine import FOOTPRINT_TIMEFRAME, FootprintEngine
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
    VolumeDeltaRecord,
)
from app.storage.tick_store import SYMBOL, TickStore

ImportMode = Literal["missing-only", "replace-range"]

_TF_MS: dict[str, int] = {
    "1m": 60_000,
    "3m": 3 * 60_000,
    "5m": 5 * 60_000,
    "15m": 15 * 60_000,
    "30m": 30 * 60_000,
    "1h": 60 * 60_000,
    "4h": 4 * 60 * 60_000,
    "1D": 24 * 60 * 60_000,
}


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


@dataclass(frozen=True, slots=True)
class _QuoteSideEvent:
    time: int
    sequence: int
    side: Literal["bid", "ask"]
    price: float
    size: int


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
) -> ImportSummary:
    """Import an NT export set into Tick_Store and optionally rebuild cache.

    ``missing-only`` inserts/upserts exported rows without deleting existing raw
    rows. ``replace-range`` first deletes raw trades/quotes in the target range,
    then imports the export. Both modes clear/rebuild derived cache rows for the
    touched range when ``rebuild`` is true and ``cache_db_path`` is provided.
    """
    if mode not in ("missing-only", "replace-range"):
        raise ValueError(f"unsupported import mode: {mode!r}")

    store = TickStore(ticks_dir=ticks_dir)
    cache = (
        CacheStore(cache_db_path)
        if cache_db_path is not None and rebuild and not dry_run
        else None
    )
    try:
        trades = list(iter_last_trades(paths.last, symbol, contract, export_tz, frm, to))
        quotes = list(iter_quotes(paths.bid, paths.ask, symbol, contract, export_tz, frm, to))
        actual_from, actual_to = _effective_range(frm, to, trades, quotes)

        summary = ImportSummary(
            symbol=symbol,
            contract=contract,
            mode=mode,
            dry_run=dry_run,
            range_from=actual_from,
            range_to=actual_to,
            trades=len(trades),
            quotes=len(quotes),
        )

        if actual_from is not None and actual_to is not None:
            before_trades, before_quotes = count_raw_range(
                store, contract, actual_from, actual_to
            )
            summary.raw_trades_before = before_trades
            summary.raw_quotes_before = before_quotes

        if dry_run:
            summary.raw_trades_after = summary.raw_trades_before
            summary.raw_quotes_after = summary.raw_quotes_before
            return summary

        if mode == "replace-range" and actual_from is not None and actual_to is not None:
            deleted_trades, deleted_quotes = delete_raw_range(
                store, contract, actual_from, actual_to
            )
            summary.deleted_trades = deleted_trades
            summary.deleted_quotes = deleted_quotes

        for quote in quotes:
            store.record_quote(quote)
        for trade in trades:
            store.record_trade(trade)

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

        return summary
    finally:
        store.close()
        if cache is not None:
            cache.close()


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
    bid_iter = _iter_quote_side(bid_path, "bid", export_tz)
    ask_iter = _iter_quote_side(ask_path, "ask", export_tz)
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
    big_trade_engine = BigTradeEngine()

    bars: dict[tuple[str, int], BarRecord] = {}
    volume_deltas: dict[tuple[str, int], VolumeDeltaRecord] = {}
    footprint_bars: dict[int, FootprintBarRecord] = {}
    footprint_levels: dict[int, list[FootprintLevelRecord]] = {}
    big_trades: list[BigTradeRecord] = []

    for trade in _trades_with_prevailing_quote(tick_store, contract, read_from, read_to):
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
        ):
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


def _effective_range(
    frm: int | None,
    to: int | None,
    trades: Iterable[NormalizedTrade],
    quotes: Iterable[NormalizedQuote],
) -> tuple[int | None, int | None]:
    times = [row.time for row in trades]
    times.extend(row.time for row in quotes)
    if frm is not None:
        times.append(frm)
    if to is not None:
        times.append(to)
    if not times:
        return frm, to
    return (min(times) if frm is None else frm, max(times) if to is None else to)


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
            f"{summary.rebuilt_big_trades} big_trades"
        )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Import NinjaTrader Last/Bid/Ask exports")
    parser.add_argument("--contract", required=True, help="Contract, e.g. 'GC 08-26'")
    parser.add_argument("--symbol", default=SYMBOL)
    parser.add_argument("--last", type=Path, help="Path to *.Last.txt")
    parser.add_argument("--bid", type=Path, help="Path to *.Bid.txt")
    parser.add_argument("--ask", type=Path, help="Path to *.Ask.txt")
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
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-rebuild", action="store_true")
    args = parser.parse_args(argv)

    export_tz = parse_utc_offset(args.utc_offset)
    frm = parse_time_bound(args.frm, export_tz)
    to = parse_time_bound(args.to, export_tz)
    if frm is not None and to is not None and frm > to:
        parser.error("--from must be <= --to")

    ticks_dir = args.ticks_dir if args.ticks_dir is not None else args.data_dir / "ticks"
    cache_db = args.cache_db if args.cache_db is not None else args.data_dir / "app.sqlite"
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
    )
    _print_summary(summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
