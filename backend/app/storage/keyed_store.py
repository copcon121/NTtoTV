"""Keyed last-write-wins upserts and range reads for Cache_Store tables.

Task 3.6 implements the keyed write/read access patterns the design calls for:
bars and order-flow summaries are addressed by ``(symbol, contract, timeframe,
time)`` (big trades by ``(symbol, contract, time, side, trade_id)``),
re-writing the same key overwrites the prior value (last-write-wins), and range
reads select by ``(symbol, contract, timeframe)`` over an optional ``[from, to]``
Canonical_Timestamp window with an optional ``limit`` that returns the **most
recent** rows. (Requirements 8.2, 8.3, 8.4)

This module is a focused collaborator that :class:`~app.storage.cache_store.
CacheStore` delegates to. It builds entirely on the shared single-writer seam
(:class:`~app.storage.connection.SingleWriter`) for writes and on independent
WAL reader connections for reads, so REST range reads run concurrently with the
ingest writer. Last-write-wins is expressed with ``INSERT ... ON CONFLICT(key)
DO UPDATE`` so only the non-key columns are overwritten on a repeated key.

Retention is implicit: nothing here deletes bars or order-flow rows, so
precomputed data is retained indefinitely until an explicit delete. (Req 8.4)
"""

from __future__ import annotations

import sqlite3
from collections.abc import Callable, Iterable

from ..models import ImbalanceSide, Side
from .connection import SingleWriter
from .records import (
    BarRecord,
    BigTradeRecord,
    FootprintBarRecord,
    FootprintLevelRecord,
    FvgSignalRecord,
    VolumeDeltaRecord,
)

__all__ = ["KeyedStore"]


# --- Upsert DDL (last-write-wins via ON CONFLICT DO UPDATE) -------------------
#
# Each statement overwrites only the non-key columns on a repeated key, so the
# composite primary key stays the addressing tuple and the most recent write
# wins. (Req 8.2)

_UPSERT_BAR = """
INSERT INTO bars
    (symbol, contract, timeframe, time, open, high, low, close, volume, closed)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(symbol, contract, timeframe, time) DO UPDATE SET
    open=excluded.open,
    high=excluded.high,
    low=excluded.low,
    close=excluded.close,
    volume=excluded.volume,
    closed=excluded.closed
"""

_UPSERT_VOLUME_DELTA = """
INSERT INTO orderflow_volume_delta
    (symbol, contract, timeframe, time, volume, buy_volume, sell_volume,
     delta, delta_high, delta_low, open_delta, close_delta)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(symbol, contract, timeframe, time) DO UPDATE SET
    volume=excluded.volume,
    buy_volume=excluded.buy_volume,
    sell_volume=excluded.sell_volume,
    delta=excluded.delta,
    delta_high=excluded.delta_high,
    delta_low=excluded.delta_low,
    open_delta=excluded.open_delta,
    close_delta=excluded.close_delta
"""

_UPSERT_FOOTPRINT_BAR = """
INSERT INTO footprint_bars
    (symbol, contract, timeframe, time, poc, open_price, high_price, low_price,
     close_price, poc_volume, vah, val, bar_delta, buy_pct, sell_pct,
     unfinished_high, unfinished_low)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(symbol, contract, timeframe, time) DO UPDATE SET
    poc=excluded.poc,
    open_price=excluded.open_price,
    high_price=excluded.high_price,
    low_price=excluded.low_price,
    close_price=excluded.close_price,
    poc_volume=excluded.poc_volume,
    vah=excluded.vah,
    val=excluded.val,
    bar_delta=excluded.bar_delta,
    buy_pct=excluded.buy_pct,
    sell_pct=excluded.sell_pct,
    unfinished_high=excluded.unfinished_high,
    unfinished_low=excluded.unfinished_low
"""

_UPSERT_FOOTPRINT_LEVEL = """
INSERT INTO footprint_levels
    (symbol, contract, timeframe, time, price, bid_volume, ask_volume, imbalance)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(symbol, contract, timeframe, time, price) DO UPDATE SET
    bid_volume=excluded.bid_volume,
    ask_volume=excluded.ask_volume,
    imbalance=excluded.imbalance
"""

_UPSERT_FVG_SIGNAL = """
INSERT INTO fvg_signals
    (symbol, contract, timeframe, time, direction, level, pulse, top, bottom,
     breakout_ratio)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(symbol, contract, timeframe, time) DO UPDATE SET
    direction=excluded.direction,
    level=excluded.level,
    pulse=excluded.pulse,
    top=excluded.top,
    bottom=excluded.bottom,
    breakout_ratio=excluded.breakout_ratio
"""

_UPSERT_BIG_TRADE = """
INSERT INTO big_trades
    (symbol, contract, time, price, volume, side, trade_id)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(symbol, contract, time, side, trade_id) DO UPDATE SET
    price=excluded.price,
    volume=excluded.volume
"""


def _range_clause(frm: int | None, to: int | None) -> tuple[str, list[int]]:
    """Build an optional ``time`` range predicate and its bound parameters.

    Returns an SQL fragment (possibly empty) and the parameter list. Both
    bounds are inclusive; either may be omitted for an open-ended range.
    """
    parts: list[str] = []
    params: list[int] = []
    if frm is not None:
        parts.append("AND time >= ?")
        params.append(int(frm))
    if to is not None:
        parts.append("AND time <= ?")
        params.append(int(to))
    return (" ".join(parts), params)


class KeyedStore:
    """Keyed upsert + range-read access to the Cache_Store derived tables.

    Writes go through a single :class:`SingleWriter` (one writer, serialized,
    busy_timeout + retry). Reads open a fresh WAL reader via ``reader_factory``
    so they never contend with the writer for a lock. The owning ``CacheStore``
    supplies both. (Req 7.3, 8.2, 8.3)
    """

    def __init__(
        self,
        writer: SingleWriter,
        reader_factory: Callable[[], sqlite3.Connection],
    ) -> None:
        self._writer = writer
        self._reader_factory = reader_factory

    def upsert_derived_batch(
        self,
        *,
        bars: Iterable[BarRecord] = (),
        volume_deltas: Iterable[VolumeDeltaRecord] = (),
        footprint_bar: FootprintBarRecord | None = None,
        footprint_bars: Iterable[FootprintBarRecord] = (),
        footprint_levels: Iterable[FootprintLevelRecord] = (),
        fvg_signals: Iterable[FvgSignalRecord] = (),
        big_trades: Iterable[BigTradeRecord] = (),
    ) -> None:
        """Persist one trade's derived outputs in a single transaction.

        Live ingestion fans one accepted trade out across every bar and volume-
        delta timeframe plus the M1 footprint ladder. Committing each row
        separately blocks the asyncio ingestion loop during active periods.
        Materialize the rows first, then commit the complete derived snapshot
        atomically through the shared writer.
        """
        bar_rows = [_bar_params(bar) for bar in bars]
        delta_rows = [_volume_delta_params(rec) for rec in volume_deltas]
        footprint_rows = [_footprint_bar_params(rec) for rec in footprint_bars]
        level_rows = [_footprint_level_params(rec) for rec in footprint_levels]
        fvg_rows = [_fvg_signal_params(rec) for rec in fvg_signals]
        big_trade_rows = [_big_trade_params(rec) for rec in big_trades]
        if footprint_bar is not None:
            footprint_rows.append(_footprint_bar_params(footprint_bar))
        if not (
            bar_rows
            or delta_rows
            or footprint_rows
            or level_rows
            or fvg_rows
            or big_trade_rows
        ):
            return

        def write(conn: sqlite3.Connection) -> None:
            if bar_rows:
                conn.executemany(_UPSERT_BAR, bar_rows)
            if delta_rows:
                conn.executemany(_UPSERT_VOLUME_DELTA, delta_rows)
            if footprint_rows:
                conn.executemany(_UPSERT_FOOTPRINT_BAR, footprint_rows)
            if level_rows:
                conn.executemany(_UPSERT_FOOTPRINT_LEVEL, level_rows)
            if fvg_rows:
                conn.executemany(_UPSERT_FVG_SIGNAL, fvg_rows)
            if big_trade_rows:
                conn.executemany(_UPSERT_BIG_TRADE, big_trade_rows)

        self._writer.write(write)

    # -- bars -----------------------------------------------------------------

    def upsert_bar(self, bar: BarRecord) -> None:
        """Last-write-wins upsert of a single OHLCV bar. (Req 8.2)"""
        self._writer.execute(_UPSERT_BAR, _bar_params(bar))

    def upsert_bars(self, bars: Iterable[BarRecord]) -> None:
        """Last-write-wins upsert of many bars in one transaction. (Req 8.2)"""
        rows = [_bar_params(b) for b in bars]
        if rows:
            self._writer.executemany(_UPSERT_BAR, rows)

    def read_bars(
        self,
        symbol: str,
        contract: str,
        timeframe: str,
        frm: int | None = None,
        to: int | None = None,
        limit: int | None = None,
    ) -> list[BarRecord]:
        """Read bars for a key prefix over an optional ``[frm, to]`` window.

        Results are returned in ascending ``time`` order. When ``limit`` is
        given, the **most recent** ``limit`` bars within the window are selected
        (and still returned ascending), matching the history endpoint's
        "most recent up-to-N" contract. (Req 8.3, 11.4)
        """
        rows = self._read_keyed(
            table="bars",
            columns=(
                "symbol, contract, timeframe, time, open, high, low, "
                "close, volume, closed"
            ),
            symbol=symbol,
            contract=contract,
            timeframe=timeframe,
            frm=frm,
            to=to,
            limit=limit,
        )
        return [
            BarRecord(
                symbol=r["symbol"],
                contract=r["contract"],
                timeframe=r["timeframe"],
                time=r["time"],
                open=r["open"],
                high=r["high"],
                low=r["low"],
                close=r["close"],
                volume=r["volume"],
                closed=bool(r["closed"]),
            )
            for r in rows
        ]

    # -- volume delta ---------------------------------------------------------

    def upsert_volume_delta(self, rec: VolumeDeltaRecord) -> None:
        """Last-write-wins upsert of a single volume-delta summary. (Req 8.2)"""
        self._writer.execute(_UPSERT_VOLUME_DELTA, _volume_delta_params(rec))

    def upsert_volume_deltas(self, recs: Iterable[VolumeDeltaRecord]) -> None:
        """Last-write-wins upsert of many volume-delta summaries. (Req 8.2)"""
        rows = [_volume_delta_params(r) for r in recs]
        if rows:
            self._writer.executemany(_UPSERT_VOLUME_DELTA, rows)

    def read_volume_delta(
        self,
        symbol: str,
        contract: str,
        timeframe: str,
        frm: int | None = None,
        to: int | None = None,
        limit: int | None = None,
    ) -> list[VolumeDeltaRecord]:
        """Read volume-delta summaries for a key prefix over ``[frm, to]``.

        Ascending ``time`` order; ``limit`` returns the most recent rows. (Req
        8.3, 18.5)
        """
        rows = self._read_keyed(
            table="orderflow_volume_delta",
            columns=(
                "symbol, contract, timeframe, time, volume, buy_volume, "
                "sell_volume, delta, delta_high, delta_low, open_delta, "
                "close_delta"
            ),
            symbol=symbol,
            contract=contract,
            timeframe=timeframe,
            frm=frm,
            to=to,
            limit=limit,
        )
        return [
            VolumeDeltaRecord(
                symbol=r["symbol"],
                contract=r["contract"],
                timeframe=r["timeframe"],
                time=r["time"],
                volume=r["volume"],
                buy_volume=r["buy_volume"],
                sell_volume=r["sell_volume"],
                delta=r["delta"],
                delta_high=r["delta_high"],
                delta_low=r["delta_low"],
                open_delta=r["open_delta"],
                close_delta=r["close_delta"],
            )
            for r in rows
        ]

    # -- footprint (bars + ladder levels) -------------------------------------

    def upsert_footprint_bar(self, rec: FootprintBarRecord) -> None:
        """Last-write-wins upsert of a footprint bar header. (Req 8.2, 14.4)"""
        self._writer.execute(_UPSERT_FOOTPRINT_BAR, _footprint_bar_params(rec))

    def upsert_footprint_levels(self, recs: Iterable[FootprintLevelRecord]) -> None:
        """Last-write-wins upsert of footprint ladder cells. (Req 14.3)"""
        rows = [_footprint_level_params(r) for r in recs]
        if rows:
            self._writer.executemany(_UPSERT_FOOTPRINT_LEVEL, rows)

    def read_footprint_bars(
        self,
        symbol: str,
        contract: str,
        timeframe: str = "1m",
        frm: int | None = None,
        to: int | None = None,
        limit: int | None = None,
    ) -> list[FootprintBarRecord]:
        """Read footprint bar headers for a key prefix over ``[frm, to]``.

        Ascending ``time`` order; ``limit`` returns the most recent bars (e.g.
        the footprint endpoint's last ``count`` bars). (Req 8.3, 18.6)
        """
        rows = self._read_keyed(
            table="footprint_bars",
            columns=(
                "symbol, contract, timeframe, time, poc, open_price, high_price, "
                "low_price, close_price, poc_volume, vah, val, bar_delta, buy_pct, "
                "sell_pct, unfinished_high, unfinished_low"
            ),
            symbol=symbol,
            contract=contract,
            timeframe=timeframe,
            frm=frm,
            to=to,
            limit=limit,
        )
        return [
            FootprintBarRecord(
                symbol=r["symbol"],
                contract=r["contract"],
                timeframe=r["timeframe"],
                time=r["time"],
                poc=r["poc"],
                open_price=r["open_price"],
                high_price=r["high_price"],
                low_price=r["low_price"],
                close_price=r["close_price"],
                poc_volume=r["poc_volume"],
                vah=r["vah"],
                val=r["val"],
                bar_delta=r["bar_delta"],
                buy_pct=r["buy_pct"],
                sell_pct=r["sell_pct"],
                unfinished_high=bool(r["unfinished_high"]),
                unfinished_low=bool(r["unfinished_low"]),
            )
            for r in rows
        ]

    def read_footprint_levels(
        self,
        symbol: str,
        contract: str,
        time: int,
        timeframe: str = "1m",
    ) -> list[FootprintLevelRecord]:
        """Read the bid-by-ask ladder cells for one footprint bar.

        Returned in descending ``price`` order (top of book first), matching the
        footprint ladder display convention. (Req 14.3)
        """
        conn = self._reader_factory()
        try:
            rows = conn.execute(
                "SELECT symbol, contract, timeframe, time, price, bid_volume, "
                "ask_volume, imbalance FROM footprint_levels "
                "WHERE symbol = ? AND contract = ? AND timeframe = ? AND time = ? "
                "ORDER BY price DESC",
                (symbol, contract, timeframe, int(time)),
            ).fetchall()
        finally:
            conn.close()
        return [
            FootprintLevelRecord(
                symbol=r["symbol"],
                contract=r["contract"],
                timeframe=r["timeframe"],
                time=r["time"],
                price=r["price"],
                bid_volume=r["bid_volume"],
                ask_volume=r["ask_volume"],
                imbalance=(
                    None if r["imbalance"] is None else ImbalanceSide(r["imbalance"])
                ),
            )
            for r in rows
        ]

    def read_footprint_levels_range(
        self,
        symbol: str,
        contract: str,
        timeframe: str,
        frm: int,
        to: int,
    ) -> list[FootprintLevelRecord]:
        """Read footprint ladder cells across an inclusive time range.

        Returned in ascending ``time`` then descending ``price`` order so callers
        can either replay bars or aggregate a fixed-range profile without
        issuing one query per M1 bar.
        """
        if frm > to:
            return []
        conn = self._reader_factory()
        try:
            rows = conn.execute(
                "SELECT symbol, contract, timeframe, time, price, bid_volume, "
                "ask_volume, imbalance FROM footprint_levels "
                "WHERE symbol = ? AND contract = ? AND timeframe = ? "
                "AND time BETWEEN ? AND ? "
                "ORDER BY time ASC, price DESC",
                (symbol, contract, timeframe, int(frm), int(to)),
            ).fetchall()
        finally:
            conn.close()
        return [
            FootprintLevelRecord(
                symbol=r["symbol"],
                contract=r["contract"],
                timeframe=r["timeframe"],
                time=r["time"],
                price=r["price"],
                bid_volume=r["bid_volume"],
                ask_volume=r["ask_volume"],
                imbalance=(
                    None if r["imbalance"] is None else ImbalanceSide(r["imbalance"])
                ),
            )
            for r in rows
        ]

    # -- FVG signals ----------------------------------------------------------

    def upsert_fvg_signal(self, rec: FvgSignalRecord) -> None:
        """Last-write-wins upsert of one confirmed FVG signal."""
        self._writer.execute(_UPSERT_FVG_SIGNAL, _fvg_signal_params(rec))

    def upsert_fvg_signals(self, recs: Iterable[FvgSignalRecord]) -> None:
        """Last-write-wins upsert of many confirmed FVG signals."""
        rows = [_fvg_signal_params(r) for r in recs]
        if rows:
            self._writer.executemany(_UPSERT_FVG_SIGNAL, rows)

    def read_fvg_signals(
        self,
        symbol: str,
        contract: str,
        timeframe: str = "1m",
        frm: int | None = None,
        to: int | None = None,
        limit: int | None = None,
    ) -> list[FvgSignalRecord]:
        """Read confirmed FVG signals over an optional time range."""
        rows = self._read_keyed(
            table="fvg_signals",
            columns=(
                "symbol, contract, timeframe, time, direction, level, pulse, "
                "top, bottom, breakout_ratio"
            ),
            symbol=symbol,
            contract=contract,
            timeframe=timeframe,
            frm=frm,
            to=to,
            limit=limit,
        )
        return [
            FvgSignalRecord(
                symbol=r["symbol"],
                contract=r["contract"],
                timeframe=r["timeframe"],
                time=r["time"],
                direction=r["direction"],
                level=r["level"],
                pulse=r["pulse"],
                top=r["top"],
                bottom=r["bottom"],
                breakout_ratio=r["breakout_ratio"],
            )
            for r in rows
        ]

    # -- big trades -----------------------------------------------------------

    def upsert_big_trade(self, rec: BigTradeRecord) -> None:
        """Last-write-wins upsert of a merged big trade. (Req 8.2, 15.2)"""
        self._writer.execute(_UPSERT_BIG_TRADE, _big_trade_params(rec))

    def upsert_big_trades(self, recs: Iterable[BigTradeRecord]) -> None:
        """Last-write-wins upsert of many merged big trades. (Req 8.2, 15.2)"""
        rows = [_big_trade_params(r) for r in recs]
        if rows:
            self._writer.executemany(_UPSERT_BIG_TRADE, rows)

    def replace_big_trades(
        self,
        symbol: str,
        contract: str,
        frm: int,
        to: int,
        recs: Iterable[BigTradeRecord],
    ) -> None:
        """Replace one big-trade time range with rebuilt rows atomically."""
        rows = [_big_trade_params(r) for r in recs]

        def op(conn):
            conn.execute(
                "DELETE FROM big_trades "
                "WHERE symbol = ? AND contract = ? AND time BETWEEN ? AND ?",
                (symbol, contract, int(frm), int(to)),
            )
            if rows:
                conn.executemany(_UPSERT_BIG_TRADE, rows)

        self._writer.write(op)

    def read_big_trades(
        self,
        symbol: str,
        contract: str,
        frm: int | None = None,
        to: int | None = None,
        limit: int | None = None,
    ) -> list[BigTradeRecord]:
        """Read big trades for ``(symbol, contract)`` over ``[frm, to]``.

        Big trades have no timeframe. Results are ascending by
        ``(time, trade_id, side)``; ``limit`` returns the most recent rows.
        (Req 8.3, 18.7)
        """
        where = "WHERE symbol = ? AND contract = ?"
        params: list[object] = [symbol, contract]
        clause, bounds = _range_clause(frm, to)
        if clause:
            where = f"{where} {clause}"
            params.extend(bounds)

        columns = "symbol, contract, time, price, volume, side, trade_id"
        if limit is not None:
            sql = (
                f"SELECT {columns} FROM big_trades {where} "
                "ORDER BY time DESC, trade_id DESC, side DESC LIMIT ?"
            )
            params.append(int(limit))
            reverse = True
        else:
            sql = (
                f"SELECT {columns} FROM big_trades {where} "
                "ORDER BY time ASC, trade_id ASC, side ASC"
            )
            reverse = False

        conn = self._reader_factory()
        try:
            rows = conn.execute(sql, params).fetchall()
        finally:
            conn.close()
        if reverse:
            rows = list(reversed(rows))
        return [
            BigTradeRecord(
                symbol=r["symbol"],
                contract=r["contract"],
                time=r["time"],
                price=r["price"],
                volume=r["volume"],
                side=Side(r["side"]),
                trade_id=r["trade_id"],
            )
            for r in rows
        ]

    # -- internals ------------------------------------------------------------

    def _read_keyed(
        self,
        *,
        table: str,
        columns: str,
        symbol: str,
        contract: str,
        timeframe: str,
        frm: int | None,
        to: int | None,
        limit: int | None,
    ) -> list[sqlite3.Row]:
        """Run a keyed range read on a ``(symbol, contract, timeframe, time)`` table.

        Always returns rows in ascending ``time`` order. With ``limit``, the most
        recent ``limit`` rows in the window are selected with ``ORDER BY time
        DESC LIMIT n`` and then reversed back to ascending. The table name and
        column list are internal constants (never user input), so interpolating
        them here is safe; all value bounds are bound parameters. (Req 8.3)
        """
        where = "WHERE symbol = ? AND contract = ? AND timeframe = ?"
        params: list[object] = [symbol, contract, timeframe]
        clause, bounds = _range_clause(frm, to)
        if clause:
            where = f"{where} {clause}"
            params.extend(bounds)

        if limit is not None:
            sql = (
                f"SELECT {columns} FROM {table} {where} "
                "ORDER BY time DESC LIMIT ?"
            )
            params.append(int(limit))
            reverse = True
        else:
            sql = f"SELECT {columns} FROM {table} {where} ORDER BY time ASC"
            reverse = False

        conn = self._reader_factory()
        try:
            rows = conn.execute(sql, params).fetchall()
        finally:
            conn.close()
        return list(reversed(rows)) if reverse else list(rows)


# --- parameter row builders ---------------------------------------------------


def _bar_params(b: BarRecord) -> tuple[object, ...]:
    return (
        b.symbol,
        b.contract,
        b.timeframe,
        int(b.time),
        b.open,
        b.high,
        b.low,
        b.close,
        b.volume,
        1 if b.closed else 0,
    )


def _volume_delta_params(r: VolumeDeltaRecord) -> tuple[object, ...]:
    return (
        r.symbol,
        r.contract,
        r.timeframe,
        int(r.time),
        r.volume,
        r.buy_volume,
        r.sell_volume,
        r.delta,
        r.delta_high,
        r.delta_low,
        r.open_delta,
        r.close_delta,
    )


def _footprint_bar_params(r: FootprintBarRecord) -> tuple[object, ...]:
    return (
        r.symbol,
        r.contract,
        r.timeframe,
        int(r.time),
        r.poc,
        r.open_price,
        r.high_price,
        r.low_price,
        r.close_price,
        r.poc_volume,
        r.vah,
        r.val,
        r.bar_delta,
        r.buy_pct,
        r.sell_pct,
        1 if r.unfinished_high else 0,
        1 if r.unfinished_low else 0,
    )


def _footprint_level_params(r: FootprintLevelRecord) -> tuple[object, ...]:
    return (
        r.symbol,
        r.contract,
        r.timeframe,
        int(r.time),
        r.price,
        r.bid_volume,
        r.ask_volume,
        None if r.imbalance is None else r.imbalance.value,
    )


def _fvg_signal_params(r: FvgSignalRecord) -> tuple[object, ...]:
    return (
        r.symbol,
        r.contract,
        r.timeframe,
        int(r.time),
        int(r.direction),
        int(r.level),
        int(r.pulse),
        r.top,
        r.bottom,
        r.breakout_ratio,
    )


def _big_trade_params(r: BigTradeRecord) -> tuple[object, ...]:
    return (
        r.symbol,
        r.contract,
        int(r.time),
        r.price,
        r.volume,
        r.side.value,
        int(r.trade_id),
    )
