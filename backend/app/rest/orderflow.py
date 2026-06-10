"""REST_API order-flow + big-trade read endpoints (tasks 14.4, 15.3, 16.3).

Implements the read surface for the persisted order-flow summaries and big
trades:

* ``GET /api/orderflow/volume-delta`` — per-bar volume-delta summaries (Req 18.5)
* ``GET /api/orderflow/footprint``    — last ``count`` M1 footprint bars + ladders (Req 18.6)
* ``GET /api/orderflow/delta-profile`` — fixed-range profile from M1 footprint ladders
* ``GET /api/big-trades``             — merged big trades over a range (Req 18.7)

These read endpoints accept an optional ``contract`` that defaults to the Active_Contract
(Req 18.4) and surface failures through the shared error envelope (Req 18.12):
an unknown ``symbol`` yields ``404`` and a ``contract`` that is not a known
candidate yields ``404`` with ``field: "contract"``.

The router shares the request-scoped :class:`~app.rest.contract_state.ContractStateStore`
(which owns the process Cache_Store) with the rest of the REST API, so reads hit
the same database the ingest pipeline writes to.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query

from ..config import settings as default_settings
from ..engines.big_trade_engine import BigTradeEngine
from ..engines.footprint_engine import (
    DEFAULT_TICK_SIZE,
    DEFAULT_VALUE_AREA_PERCENT,
    FOOTPRINT_TIMEFRAME,
)
from ..engines.volume_delta_engine import VolumeDeltaEngine
from ..models.timestamp import now_ms
from ..storage.cache_store import CacheStore
from ..storage.records import (
    BigTradeRecord,
    FootprintBarRecord,
    FootprintLevelRecord,
    VolumeDeltaRecord,
)
from ..storage.tick_store import TickStore
from .contract_state import ContractStateStore
from .errors import bad_request, not_found
from .routes import _resolve_contract, get_contract_state, get_tick_store

router = APIRouter(prefix="/api", tags=["orderflow"])

# Supported volume-delta timeframes mirror the Bar_Aggregator's set.
from ..engines.bar_aggregator import SUPPORTED_TFS as _SUPPORTED_TFS_LIST

_SUPPORTED_TFS = frozenset(_SUPPORTED_TFS_LIST)

# Default footprint bar count returned by the footprint endpoint. (Req 18.6)
DEFAULT_FOOTPRINT_COUNT = 5
# Read cap shared with the history cache cap, bounding range scans.
MAX_ROWS = 5000


def get_cache(
    state: ContractStateStore = Depends(get_contract_state),
) -> CacheStore:
    """Provide the Cache_Store backing order-flow reads (shared with REST)."""
    return state.cache


def _validate_symbol_tf(
    state: ContractStateStore, symbol: str, tf: str
) -> None:
    if not state.is_known_symbol(symbol):
        raise not_found(f"Unknown symbol {symbol!r}", field="symbol")
    if tf not in _SUPPORTED_TFS:
        raise not_found(
            f"Unknown timeframe {tf!r} for symbol {symbol!r}", field="tf"
        )


def _volume_delta_to_dict(rec: VolumeDeltaRecord) -> dict[str, Any]:
    return {
        "time": rec.time,
        "volume": rec.volume,
        "buyVolume": rec.buy_volume,
        "sellVolume": rec.sell_volume,
        "delta": rec.delta,
        "deltaHigh": rec.delta_high,
        "deltaLow": rec.delta_low,
        "openDelta": rec.open_delta,
        "closeDelta": rec.close_delta,
    }


def _rebuild_volume_delta(
    tick_store: TickStore,
    symbol: str,
    contract: str,
    tf: str,
    frm: int,
    to: int,
) -> list[VolumeDeltaRecord]:
    """Rebuild per-bar volume-delta summaries from raw Tick_Store ticks.

    Mirrors the history endpoint's ``_rebuild_bars`` cache-miss path: replays the
    raw trades for ``contract`` over ``[frm, to]`` through a fresh
    :class:`VolumeDeltaEngine` at the requested ``tf`` and keeps each bar's final
    snapshot, in ascending ``time`` order. This is why switching to a timeframe
    that has no precomputed rows still shows delta candles. (Req 13, 11.5, 8.5)

    NT trade prints carry no same-print bid/ask, so the trade stream is merged
    with the recorded quote stream by time: each trade is classified against the
    most recent prevailing quote's bid/ask (matching MyVolumeDelta) instead of
    falling back to the tick rule. (Req 13.2, 13.3)
    """
    engine = VolumeDeltaEngine(timeframe=tf)
    final: dict[int, VolumeDeltaRecord] = {}
    order: list[int] = []
    for trade in _trades_with_prevailing_quote(tick_store, contract, frm, to):
        update = engine.on_trade(trade)
        if update is None:
            continue
        if update.time not in final:
            order.append(update.time)
        final[update.time] = VolumeDeltaRecord(
            symbol=symbol,
            contract=contract,
            timeframe=tf,
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
    return [final[time] for time in order]


def _trades_with_prevailing_quote(
    tick_store: TickStore,
    contract: str,
    frm: int,
    to: int,
):
    """Yield trades over ``[frm, to]`` with bid/ask backfilled from the quote
    book prevailing at each trade's time.

    Merges the ascending trade and quote streams by ``(time, sequence)``: a
    quote at time <= the trade updates the prevailing book, which is stamped
    onto any trade that lacks a same-print snapshot. Mirrors the live pipeline's
    backfill so the rebuild classifies identically. (Req 13.2, 13.3)
    """
    trades = list(tick_store.read_range(contract, frm, to))
    quotes = list(tick_store.read_quotes(contract, frm, to))
    qi = 0
    nq = len(quotes)
    book: tuple[float | None, float | None] | None = None
    for trade in trades:
        # Advance the quote cursor through every quote at or before this trade.
        while qi < nq and quotes[qi].time <= trade.time:
            book = (quotes[qi].bid, quotes[qi].ask)
            qi += 1
        if trade.bid is None and trade.ask is None and book is not None:
            trade.bid, trade.ask = book
            if trade.best_bid is None:
                trade.best_bid = book[0]
            if trade.best_ask is None:
                trade.best_ask = book[1]
        yield trade


def _rebuild_big_trades(
    tick_store: TickStore,
    symbol: str,
    contract: str,
    frm: int,
    to: int,
) -> tuple[list[BigTradeRecord], bool]:
    """Rebuild NT-style BigTrade markers from raw Tick_Store ticks.

    This mirrors the live pipeline's simple BigTrade path: prevailing bid/ask is
    stamped onto each trade, iceberg/DOM filters are ignored, and
    ``BigTradeEngine`` applies the NT BigTrade defaults (MinVolume=30,
    MaxVolume=-1, VolumeFilterEnable=true).
    """
    engine = BigTradeEngine(dedupe_repeated_timestamp_runs=True)
    out: list[BigTradeRecord] = []
    had_raw_trades = False
    for trade in _trades_with_prevailing_quote(tick_store, contract, frm, to):
        had_raw_trades = True
        for bt in engine.on_trade(trade):
            out.append(
                BigTradeRecord(
                    symbol=symbol,
                    contract=contract,
                    time=bt.time,
                    price=bt.price,
                    volume=bt.volume,
                    side=bt.side,
                    trade_id=bt.trade_id,
                )
            )
    for bt in engine.flush(contract):
        out.append(
            BigTradeRecord(
                symbol=symbol,
                contract=contract,
                time=bt.time,
                price=bt.price,
                volume=bt.volume,
                side=bt.side,
                trade_id=bt.trade_id,
            )
        )
    return out, had_raw_trades


def _footprint_level_to_dict(rec: FootprintLevelRecord) -> dict[str, Any]:
    return {
        "price": rec.price,
        "bid": rec.bid_volume,
        "ask": rec.ask_volume,
        "imbalance": None if rec.imbalance is None else rec.imbalance.value,
    }


def _footprint_bar_to_dict(
    bar: FootprintBarRecord, levels: list[FootprintLevelRecord]
) -> dict[str, Any]:
    derived = _derive_footprint_profile(levels)
    return {
        "time": bar.time,
        "open": bar.open_price if bar.open_price is not None else derived["open"],
        "high": bar.high_price if bar.high_price is not None else derived["high"],
        "low": bar.low_price if bar.low_price is not None else derived["low"],
        "close": bar.close_price if bar.close_price is not None else derived["close"],
        "poc": bar.poc if bar.poc is not None else derived["poc"],
        "pocVolume": bar.poc_volume or int(derived["pocVolume"]),
        "vah": bar.vah if bar.vah is not None else derived["vah"],
        "val": bar.val if bar.val is not None else derived["val"],
        "barDelta": bar.bar_delta,
        "buyPct": bar.buy_pct,
        "sellPct": bar.sell_pct,
        "unfinishedAuction": {"high": bar.unfinished_high, "low": bar.unfinished_low},
        "rows": [_footprint_level_to_dict(l) for l in levels],
    }


def _derive_footprint_profile(levels: list[FootprintLevelRecord]) -> dict[str, float]:
    """Fallback profile/OHLC for cache rows written before the v2 columns."""
    if not levels:
        return {
            "open": 0.0,
            "high": 0.0,
            "low": 0.0,
            "close": 0.0,
            "poc": 0.0,
            "pocVolume": 0.0,
            "vah": 0.0,
            "val": 0.0,
        }

    prices = sorted(l.price for l in levels)
    by_price = {l.price: l for l in levels}
    poc = prices[0]
    poc_volume = -1
    total_volume = 0
    for price in prices:
        row = by_price[price]
        volume = row.bid_volume + row.ask_volume
        total_volume += volume
        if volume > poc_volume or (volume == poc_volume and price > poc):
            poc = price
            poc_volume = volume

    diffs = [
        round(prices[i + 1] - prices[i], 10)
        for i in range(len(prices) - 1)
        if prices[i + 1] > prices[i]
    ]
    step = min(diffs) if diffs else DEFAULT_TICK_SIZE
    vah = poc
    val = poc
    accumulated = max(0, poc_volume)
    target = total_volume * DEFAULT_VALUE_AREA_PERCENT / 100.0
    lower_price = round(poc - step, 10)
    upper_price = round(poc + step, 10)
    while accumulated < target:
        lower = by_price.get(lower_price)
        upper = by_price.get(upper_price)
        lower_volume = 0 if lower is None else lower.bid_volume + lower.ask_volume
        upper_volume = 0 if upper is None else upper.bid_volume + upper.ask_volume
        if lower_volume <= 0 and upper_volume <= 0:
            break
        if lower_volume > 0 and lower_volume > upper_volume:
            accumulated += lower_volume
            val = lower_price
            lower_price = round(lower_price - step, 10)
        elif upper_volume > 0 and upper_volume > lower_volume:
            accumulated += upper_volume
            vah = upper_price
            upper_price = round(upper_price + step, 10)
        else:
            if lower_volume > 0:
                accumulated += lower_volume
                val = lower_price
                lower_price = round(lower_price - step, 10)
            if upper_volume > 0:
                accumulated += upper_volume
                vah = upper_price
                upper_price = round(upper_price + step, 10)

    return {
        "open": prices[0],
        "high": prices[-1],
        "low": prices[0],
        "close": poc,
        "poc": poc,
        "pocVolume": float(max(0, poc_volume)),
        "vah": vah,
        "val": val,
    }


def _big_trade_to_dict(rec: BigTradeRecord) -> dict[str, Any]:
    return {
        "tradeId": rec.trade_id,
        "time": rec.time,
        "price": rec.price,
        "volume": rec.volume,
        "side": rec.side.value,
    }


def _round_profile_price(price: float) -> float:
    return round(price, 10)


def _delta_profile_price(price: float, row_ticks: int) -> float:
    """Group a traded price to the lower GC tick row used by the profile."""
    tick_index = int(round(price / DEFAULT_TICK_SIZE))
    grouped_tick = (tick_index // row_ticks) * row_ticks
    return _round_profile_price(grouped_tick * DEFAULT_TICK_SIZE)


def _compute_profile_value_area(
    volumes_by_price: dict[float, int],
    poc: float,
    *,
    row_ticks: int,
    value_area_pct: float,
    total_volume: int,
) -> tuple[float, float]:
    if total_volume <= 0:
        return poc, poc
    step = _round_profile_price(DEFAULT_TICK_SIZE * row_ticks)
    target = total_volume * value_area_pct / 100.0
    accumulated = volumes_by_price.get(poc, 0)
    vah = poc
    val = poc
    lower_price = _round_profile_price(poc - step)
    upper_price = _round_profile_price(poc + step)

    while accumulated < target:
        lower_volume = volumes_by_price.get(lower_price, 0)
        upper_volume = volumes_by_price.get(upper_price, 0)
        if lower_volume <= 0 and upper_volume <= 0:
            break
        if lower_volume > 0 and lower_volume > upper_volume:
            accumulated += lower_volume
            val = lower_price
            lower_price = _round_profile_price(lower_price - step)
        elif upper_volume > 0 and upper_volume > lower_volume:
            accumulated += upper_volume
            vah = upper_price
            upper_price = _round_profile_price(upper_price + step)
        else:
            if lower_volume > 0:
                accumulated += lower_volume
                val = lower_price
                lower_price = _round_profile_price(lower_price - step)
            if upper_volume > 0:
                accumulated += upper_volume
                vah = upper_price
                upper_price = _round_profile_price(upper_price + step)
    return vah, val


def _empty_delta_profile(
    *,
    symbol: str,
    contract: str,
    frm: int,
    to: int,
    row_ticks: int,
    value_area_pct: float,
    covered_bars: int,
) -> dict[str, Any]:
    return {
        "symbol": symbol,
        "contract": contract,
        "tf": FOOTPRINT_TIMEFRAME,
        "from": frm,
        "to": to,
        "rowTicks": row_ticks,
        "valueAreaPct": value_area_pct,
        "poc": None,
        "vah": None,
        "val": None,
        "totalVolume": 0,
        "totalDelta": 0,
        "maxAbsDelta": 0,
        "coveredBars": covered_bars,
        "source": "footprint_cache",
        "rows": [],
    }


def _delta_profile_to_dict(
    *,
    symbol: str,
    contract: str,
    frm: int,
    to: int,
    row_ticks: int,
    value_area_pct: float,
    covered_bars: int,
    levels: list[FootprintLevelRecord],
) -> dict[str, Any]:
    grouped: dict[float, dict[str, int]] = {}
    for level in levels:
        if level.bid_volume <= 0 and level.ask_volume <= 0:
            continue
        price = _delta_profile_price(level.price, row_ticks)
        row = grouped.setdefault(price, {"bid": 0, "ask": 0})
        row["bid"] += int(level.bid_volume)
        row["ask"] += int(level.ask_volume)

    if not grouped:
        return _empty_delta_profile(
            symbol=symbol,
            contract=contract,
            frm=frm,
            to=to,
            row_ticks=row_ticks,
            value_area_pct=value_area_pct,
            covered_bars=covered_bars,
        )

    volumes_by_price = {
        price: values["bid"] + values["ask"] for price, values in grouped.items()
    }
    total_volume = sum(volumes_by_price.values())
    poc = max(volumes_by_price, key=lambda price: (volumes_by_price[price], price))
    vah, val = _compute_profile_value_area(
        volumes_by_price,
        poc,
        row_ticks=row_ticks,
        value_area_pct=value_area_pct,
        total_volume=total_volume,
    )
    total_delta = sum(values["ask"] - values["bid"] for values in grouped.values())
    max_abs_delta = max(abs(values["ask"] - values["bid"]) for values in grouped.values())
    rows = []
    for price in sorted(grouped, reverse=True):
        bid = grouped[price]["bid"]
        ask = grouped[price]["ask"]
        rows.append(
            {
                "price": price,
                "bidVolume": bid,
                "askVolume": ask,
                "totalVolume": bid + ask,
                "delta": ask - bid,
            }
        )

    return {
        "symbol": symbol,
        "contract": contract,
        "tf": FOOTPRINT_TIMEFRAME,
        "from": frm,
        "to": to,
        "rowTicks": row_ticks,
        "valueAreaPct": value_area_pct,
        "poc": poc,
        "vah": vah,
        "val": val,
        "totalVolume": total_volume,
        "totalDelta": total_delta,
        "maxAbsDelta": max_abs_delta,
        "coveredBars": covered_bars,
        "source": "footprint_cache",
        "rows": rows,
    }


@router.get("/orderflow/volume-delta")
async def get_volume_delta(
    symbol: str = Query(..., description="User-facing symbol, e.g. 'GC'"),
    tf: str = Query(..., description="Timeframe (1m,3m,5m,15m,30m,1h,4h,1D)"),
    contract: str | None = Query(
        None, description="GC contract; defaults to the Active_Contract"
    ),
    frm: int | None = Query(
        None, alias="from", description="Inclusive start Canonical_Timestamp (ms)"
    ),
    to: int | None = Query(None, description="Inclusive end Canonical_Timestamp (ms)"),
    limit: int | None = Query(
        None, description=f"Max rows (defaults to and capped at {MAX_ROWS})"
    ),
    state: ContractStateStore = Depends(get_contract_state),
    cache: CacheStore = Depends(get_cache),
    tick_store: TickStore = Depends(get_tick_store),
) -> dict[str, Any]:
    """Return per-bar volume-delta summaries for a symbol/contract/tf. (Req 18.5)

    Cache path: precomputed rows from the Cache_Store. On a cache miss (e.g. a
    timeframe the live pipeline has not yet persisted), rebuild the summaries
    from raw Tick_Store ticks so switching the charted timeframe still shows
    delta candles, mirroring the history endpoint. (Req 13, 11.5, 8.5)
    """
    _validate_symbol_tf(state, symbol, tf)
    resolved = _resolve_contract(state, symbol, contract)
    if frm is not None and to is not None and frm > to:
        raise bad_request("'from' must be less than or equal to 'to'", field="from")
    if limit is not None and limit < 1:
        raise bad_request("'limit' must be a positive integer", field="limit")
    effective_limit = MAX_ROWS if limit is None else min(limit, MAX_ROWS)

    rows = cache.read_volume_delta(symbol, resolved, tf, frm, to, effective_limit)
    source = "cache"
    if not rows:
        to_ms = now_ms() if to is None else to
        if frm is not None:
            frm_ms = frm
        else:
            retention_ms = (
                default_settings.tick_retention_days * 24 * 60 * 60 * 1000
            )
            frm_ms = to_ms - retention_ms
        rebuilt = _rebuild_volume_delta(
            tick_store, symbol, resolved, tf, frm_ms, to_ms
        )
        rows = rebuilt[-effective_limit:]
        source = "rebuild"
    return {
        "symbol": symbol,
        "contract": resolved,
        "tf": tf,
        "bars": [_volume_delta_to_dict(r) for r in rows],
        "source": source,
    }


@router.get("/orderflow/footprint")
async def get_footprint(
    symbol: str = Query(..., description="User-facing symbol, e.g. 'GC'"),
    contract: str | None = Query(
        None, description="GC contract; defaults to the Active_Contract"
    ),
    count: int = Query(
        DEFAULT_FOOTPRINT_COUNT,
        ge=1,
        le=MAX_ROWS,
        description="Number of most-recent M1 footprint bars to return",
    ),
    state: ContractStateStore = Depends(get_contract_state),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    """Return the last ``count`` M1 footprint bars with ladders. (Req 18.6)"""
    if not state.is_known_symbol(symbol):
        raise not_found(f"Unknown symbol {symbol!r}", field="symbol")
    resolved = _resolve_contract(state, symbol, contract)

    bars = cache.read_footprint_bars(
        symbol, resolved, FOOTPRINT_TIMEFRAME, None, None, count
    )
    out_bars: list[dict[str, Any]] = []
    for bar in bars:
        levels = cache.read_footprint_levels(
            symbol, resolved, bar.time, FOOTPRINT_TIMEFRAME
        )
        out_bars.append(_footprint_bar_to_dict(bar, levels))
    return {
        "symbol": symbol,
        "contract": resolved,
        "tf": FOOTPRINT_TIMEFRAME,
        "bars": out_bars,
    }


@router.get("/orderflow/delta-profile")
async def get_delta_profile(
    symbol: str = Query(..., description="User-facing symbol, e.g. 'GC'"),
    contract: str | None = Query(
        None, description="GC contract; defaults to the Active_Contract"
    ),
    frm: int = Query(
        ..., alias="from", description="Inclusive start Canonical_Timestamp (ms)"
    ),
    to: int = Query(..., description="Inclusive end Canonical_Timestamp (ms)"),
    row_ticks: int = Query(
        1,
        alias="rowTicks",
        ge=1,
        description="Number of GC ticks per profile row",
    ),
    value_area_pct: float = Query(
        70.0,
        alias="valueAreaPct",
        ge=0.0,
        le=100.0,
        description="Value-area percentage computed from total volume",
    ),
    state: ContractStateStore = Depends(get_contract_state),
    cache: CacheStore = Depends(get_cache),
) -> dict[str, Any]:
    """Aggregate a fixed-range delta profile from cached M1 footprint ladders."""
    if not state.is_known_symbol(symbol):
        raise not_found(f"Unknown symbol {symbol!r}", field="symbol")
    resolved = _resolve_contract(state, symbol, contract)
    if frm > to:
        raise bad_request("'from' must be less than or equal to 'to'", field="from")

    bars = cache.read_footprint_bars(
        symbol,
        resolved,
        FOOTPRINT_TIMEFRAME,
        frm,
        to,
        MAX_ROWS + 1,
    )
    if len(bars) > MAX_ROWS:
        raise bad_request(
            f"Delta profile range exceeds {MAX_ROWS} M1 footprint bars",
            field="to",
        )
    if not bars:
        return _empty_delta_profile(
            symbol=symbol,
            contract=resolved,
            frm=frm,
            to=to,
            row_ticks=row_ticks,
            value_area_pct=value_area_pct,
            covered_bars=0,
        )

    levels = cache.read_footprint_levels_range(
        symbol,
        resolved,
        FOOTPRINT_TIMEFRAME,
        frm,
        to,
    )
    return _delta_profile_to_dict(
        symbol=symbol,
        contract=resolved,
        frm=frm,
        to=to,
        row_ticks=row_ticks,
        value_area_pct=value_area_pct,
        covered_bars=len(bars),
        levels=levels,
    )


@router.get("/big-trades")
async def get_big_trades(
    symbol: str = Query(..., description="User-facing symbol, e.g. 'GC'"),
    contract: str | None = Query(
        None, description="GC contract; defaults to the Active_Contract"
    ),
    frm: int | None = Query(
        None, alias="from", description="Inclusive start Canonical_Timestamp (ms)"
    ),
    to: int | None = Query(None, description="Inclusive end Canonical_Timestamp (ms)"),
    limit: int | None = Query(
        None, description=f"Max rows (defaults to and capped at {MAX_ROWS})"
    ),
    state: ContractStateStore = Depends(get_contract_state),
    cache: CacheStore = Depends(get_cache),
    tick_store: TickStore = Depends(get_tick_store),
) -> dict[str, Any]:
    """Return merged big trades for a symbol/contract over a range. (Req 18.7)"""
    if not state.is_known_symbol(symbol):
        raise not_found(f"Unknown symbol {symbol!r}", field="symbol")
    resolved = _resolve_contract(state, symbol, contract)
    if frm is not None and to is not None and frm > to:
        raise bad_request("'from' must be less than or equal to 'to'", field="from")
    if limit is not None and limit < 1:
        raise bad_request("'limit' must be a positive integer", field="limit")
    effective_limit = MAX_ROWS if limit is None else min(limit, MAX_ROWS)

    cached = cache.read_big_trades(symbol, resolved, frm, to, effective_limit)
    if cached and frm is None and to is None:
        return {
            "symbol": symbol,
            "contract": resolved,
            "trades": [_big_trade_to_dict(r) for r in cached],
            "source": "cache",
        }

    to_ms = to if to is not None else now_ms()
    if cached:
        to_ms = max(to_ms, cached[-1].time + 1)
    if frm is not None:
        frm_ms = frm
    elif cached:
        # Seed classification before the first visible cached marker while
        # keeping the rebuild bounded for the common chart-load path.
        frm_ms = max(0, cached[0].time - 24 * 60 * 60 * 1000)
    else:
        retention_ms = default_settings.tick_retention_days * 24 * 60 * 60 * 1000
        frm_ms = to_ms - retention_ms

    rebuilt, had_raw_trades = _rebuild_big_trades(
        tick_store, symbol, resolved, frm_ms, to_ms
    )
    if had_raw_trades:
        rows = rebuilt[-effective_limit:]
        cache.replace_big_trades(symbol, resolved, frm_ms, to_ms, rebuilt)
        source = "rebuild"
    else:
        rows = cached
        source = "cache"
    return {
        "symbol": symbol,
        "contract": resolved,
        "trades": [_big_trade_to_dict(r) for r in rows],
        "source": source,
    }
