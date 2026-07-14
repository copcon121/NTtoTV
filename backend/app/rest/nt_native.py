"""NinjaTrader native chart bridge ingest.

Receives finalized chart-side bars from the NTtoTVNativeDiagnostics/bridge
indicator. These rows are sourced from NinjaTrader chart OHLCV and native
Volumetric/OrderFlow data, so they are authoritative for bar volume, delta, and
footprint cache. The existing AddOn tick stream remains useful for raw ticks and
BigTrade reconstruction.
"""

from __future__ import annotations

import logging
import sqlite3
from typing import Any

from fastapi import APIRouter, Body, Request

from ..engines.bar_aggregator import SUPPORTED_TFS
from ..engines.footprint_engine import (
    DEFAULT_TICK_SIZE,
    FOOTPRINT_TIMEFRAME,
    FootprintEngine,
    _BarState,
    _Level,
)
from ..engines.session_calendar import TF_MS, timeframe_bucket_start
from ..models.messages import (
    BarUpdate,
    FootprintUpdate,
    FvgSignalUpdate,
    OHLCVBar,
    VolumeDeltaUpdate,
)
from ..registry.registry import OutboundEvent
from ..storage.records import (
    BarRecord,
    FootprintBarRecord,
    FootprintLevelRecord,
    FvgSignalRecord,
    VolumeDeltaRecord,
)
from .errors import bad_request

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/nt", tags=["nt-native"])

ROLLUP_TFS = tuple(tf for tf in SUPPORTED_TFS if tf != FOOTPRINT_TIMEFRAME)


@router.post("/native-bar")
async def ingest_native_bar(
    request: Request, payload: dict[str, Any] = Body(...)
) -> dict[str, Any]:
    """Upsert one finalized native NT bar/delta/footprint payload."""
    runtime = getattr(request.app.state, "runtime", None)
    if runtime is None:
        raise bad_request("runtime is not available", field="runtime")

    symbol = str(payload.get("symbol") or "GC")
    contract = str(payload.get("contract") or symbol)
    tf = str(payload.get("tf") or FOOTPRINT_TIMEFRAME)
    if tf != FOOTPRINT_TIMEFRAME:
        raise bad_request("native bridge currently accepts only 1m bars", field="tf")

    time_ms = _as_int(payload, "time")
    open_price = _as_float(payload, "open")
    high_price = _as_float(payload, "high")
    low_price = _as_float(payload, "low")
    close_price = _as_float(payload, "close")
    volume = _as_int(payload, "volume")
    buy_volume = _as_int(payload, "buyVolume", 0)
    sell_volume = _as_int(payload, "sellVolume", 0)
    delta = _as_int(payload, "delta", buy_volume - sell_volume)
    delta_high = _as_int(payload, "deltaHigh", max(delta, 0))
    delta_low = _as_int(payload, "deltaLow", min(delta, 0))
    open_delta = _as_int(payload, "openDelta", 0)
    close_delta = _as_int(payload, "closeDelta", delta)

    rows_payload = payload.get("rows") or []
    if not isinstance(rows_payload, list):
        raise bad_request("rows must be a list", field="rows")

    if not _is_valid_ohlcv(open_price, high_price, low_price, close_price, volume):
        logger.warning(
            "ignored invalid native bar symbol=%s contract=%s tf=%s time=%s "
            "open=%s high=%s low=%s close=%s volume=%s",
            symbol,
            contract,
            tf,
            time_ms,
            open_price,
            high_price,
            low_price,
            close_price,
            volume,
        )
        return {
            "ok": True,
            "ignored": "invalid_ohlcv",
            "symbol": symbol,
            "contract": contract,
            "tf": tf,
            "time": time_ms,
            "source": "nt_native",
        }

    footprint_update = (
        _build_footprint_update(
            symbol=symbol,
            contract=contract,
            tf=tf,
            time_ms=time_ms,
            open_price=open_price,
            high_price=high_price,
            low_price=low_price,
            close_price=close_price,
            rows_payload=rows_payload,
        )
        if rows_payload
        else None
    )

    bar_update = BarUpdate(
        symbol=symbol,
        contract=contract,
        tf=tf,
        bar=OHLCVBar(
            time=time_ms,
            open=open_price,
            high=high_price,
            low=low_price,
            close=close_price,
            volume=volume,
        ),
        closed=True,
    )
    volume_delta_update = VolumeDeltaUpdate(
        symbol=symbol,
        contract=contract,
        tf=tf,
        time=time_ms,
        volume=volume,
        buy_volume=buy_volume,
        sell_volume=sell_volume,
        delta=delta,
        delta_high=delta_high,
        delta_low=delta_low,
        open_delta=open_delta,
        close_delta=close_delta,
    )

    rollup_bar_updates, rollup_delta_updates = _persist_native_payload(
        runtime.cache,
        bar_update=bar_update,
        volume_delta_update=volume_delta_update,
        footprint_update=footprint_update,
    )

    runtime.registry.enqueue(OutboundEvent.from_message(bar_update))
    runtime.registry.enqueue(OutboundEvent.from_message(volume_delta_update))
    if footprint_update is not None:
        runtime.registry.enqueue(OutboundEvent.from_message(footprint_update))
    for update in rollup_bar_updates:
        runtime.registry.enqueue(OutboundEvent.from_message(update))
    for update in rollup_delta_updates:
        runtime.registry.enqueue(OutboundEvent.from_message(update))

    fvg_updates: list[FvgSignalUpdate] = []
    # FVG grading uses only finalized native footprint rows. If NT does not
    # provide rows, skip footprint-based grading for this bar.
    fvg_footprint = footprint_update

    if fvg_footprint is not None:
        fvg_updates = _update_native_fvg(
            runtime,
            symbol=symbol,
            contract=contract,
            time_ms=time_ms,
            open_price=open_price,
            high_price=high_price,
            low_price=low_price,
            close_price=close_price,
            footprint_update=fvg_footprint,
        )
        _persist_native_fvg_updates(runtime.cache, fvg_updates)
        for update in fvg_updates:
            runtime.registry.enqueue(OutboundEvent.from_message(update))

    return {
        "ok": True,
        "symbol": symbol,
        "contract": contract,
        "tf": tf,
        "time": time_ms,
        "rows": 0 if footprint_update is None else len(footprint_update.rows),
        "fvgSignals": len(fvg_updates),
        "source": "nt_native",
    }


def _update_native_fvg(
    runtime,
    *,
    symbol: str,
    contract: str,
    time_ms: int,
    open_price: float,
    high_price: float,
    low_price: float,
    close_price: float,
    footprint_update: FootprintUpdate,
) -> list[FvgSignalUpdate]:
    engine = getattr(runtime, "native_fvg", None)
    if engine is None:
        return []
    seeded = getattr(runtime, "native_fvg_seeded", None)
    seed_key = (symbol, contract)
    if isinstance(seeded, set) and seed_key not in seeded:
        _seed_native_fvg_engine(
            runtime.cache,
            engine,
            symbol=symbol,
            contract=contract,
            before_time_ms=time_ms,
        )
        seeded.add(seed_key)

    return engine.on_closed_bar(
        symbol=symbol,
        contract=contract,
        time=time_ms,
        open=open_price,
        high=high_price,
        low=low_price,
        close=close_price,
        rows=[(row.price, row.bid, row.ask) for row in footprint_update.rows],
        emit_clear=True,
    )


def _seed_native_fvg_engine(
    cache,
    engine,
    *,
    symbol: str,
    contract: str,
    before_time_ms: int,
) -> None:
    bars = cache.read_bars(
        symbol,
        contract,
        FOOTPRINT_TIMEFRAME,
        None,
        before_time_ms - 1,
        200,
    )
    for bar in bars:
        levels = cache.read_footprint_levels(
            symbol,
            contract,
            bar.time,
            FOOTPRINT_TIMEFRAME,
        )
        if not levels:
            continue
        engine.on_closed_bar(
            symbol=symbol,
            contract=contract,
            time=bar.time,
            open=bar.open,
            high=bar.high,
            low=bar.low,
            close=bar.close,
            rows=[(level.price, level.bid_volume, level.ask_volume) for level in levels],
            emit_clear=False,
        )


def _persist_native_fvg_updates(cache, updates: list[FvgSignalUpdate]) -> None:
    if not updates:
        return

    confirmed = [
        FvgSignalRecord(
            symbol=update.symbol,
            contract=update.contract,
            timeframe=update.tf,
            time=update.time,
            direction=update.direction,
            level=update.level,
            pulse=update.pulse,
            top=float(update.top if update.top is not None else 0.0),
            bottom=float(update.bottom if update.bottom is not None else 0.0),
            breakout_ratio=update.breakout_ratio,
        )
        for update in updates
        if update.phase == "confirmed" and update.pulse != 0
    ]
    clears = [
        update
        for update in updates
        if update.phase == "clear" or update.pulse == 0
    ]

    if clears:
        def delete_cleared(conn: sqlite3.Connection) -> None:
            for update in clears:
                conn.execute(
                    "DELETE FROM fvg_signals "
                    "WHERE symbol=? AND contract=? AND timeframe=? AND time=?",
                    (update.symbol, update.contract, update.tf, update.time),
                )

        cache.writer.write(delete_cleared)

    if confirmed:
        cache.upsert_derived_batch(fvg_signals=confirmed)


def _build_footprint_update(
    *,
    symbol: str,
    contract: str,
    tf: str,
    time_ms: int,
    open_price: float,
    high_price: float,
    low_price: float,
    close_price: float,
    rows_payload: list[Any],
) -> FootprintUpdate:
    engine = FootprintEngine(tick_size=DEFAULT_TICK_SIZE)
    bar = _BarState(
        time=time_ms,
        open=open_price,
        high=high_price,
        low=low_price,
        close=close_price,
    )
    for raw in rows_payload:
        if not isinstance(raw, dict):
            continue
        price = _coerce_float(raw.get("price"))
        if price is None:
            continue
        bid = _coerce_int(raw.get("bid"), 0)
        ask = _coerce_int(raw.get("ask"), 0)
        if bid <= 0 and ask <= 0:
            continue
        bar.levels[price] = _Level(bid_volume=bid, ask_volume=ask)

    update = engine._build_update(contract, symbol, bar)
    if update.tf != tf:
        update = FootprintUpdate(
            symbol=update.symbol,
            contract=update.contract,
            tf=tf,
            time=update.time,
            rows=update.rows,
            open=update.open,
            high=update.high,
            low=update.low,
            close=update.close,
            poc=update.poc,
            poc_volume=update.poc_volume,
            vah=update.vah,
            val=update.val,
            bar_delta=update.bar_delta,
            buy_pct=update.buy_pct,
            sell_pct=update.sell_pct,
            stacked_imbalance=update.stacked_imbalance,
            unfinished_auction=update.unfinished_auction,
        )
    return update


def _persist_native_payload(
    cache,
    *,
    bar_update: BarUpdate,
    volume_delta_update: VolumeDeltaUpdate,
    footprint_update: FootprintUpdate | None,
) -> tuple[list[BarUpdate], list[VolumeDeltaUpdate]]:
    footprint_bar = None
    footprint_levels: list[FootprintLevelRecord] = []
    if footprint_update is not None:
        footprint_bar = FootprintBarRecord(
            symbol=footprint_update.symbol,
            contract=footprint_update.contract,
            timeframe=footprint_update.tf,
            time=footprint_update.time,
            poc=footprint_update.poc,
            open_price=footprint_update.open,
            high_price=footprint_update.high,
            low_price=footprint_update.low,
            close_price=footprint_update.close,
            poc_volume=footprint_update.poc_volume,
            vah=footprint_update.vah,
            val=footprint_update.val,
            bar_delta=footprint_update.bar_delta,
            buy_pct=footprint_update.buy_pct,
            sell_pct=footprint_update.sell_pct,
            unfinished_high=footprint_update.unfinished_auction.high,
            unfinished_low=footprint_update.unfinished_auction.low,
        )
        footprint_levels = [
            FootprintLevelRecord(
                symbol=footprint_update.symbol,
                contract=footprint_update.contract,
                timeframe=footprint_update.tf,
                time=footprint_update.time,
                price=row.price,
                bid_volume=row.bid,
                ask_volume=row.ask,
                imbalance=row.imbalance,
            )
            for row in footprint_update.rows
        ]

    bar = bar_update.bar
    bar_record = BarRecord(
        symbol=bar_update.symbol,
        contract=bar_update.contract,
        timeframe=bar_update.tf,
        time=bar.time,
        open=bar.open,
        high=bar.high,
        low=bar.low,
        close=bar.close,
        volume=bar.volume,
        closed=True,
    )
    vd_record = VolumeDeltaRecord(
        symbol=volume_delta_update.symbol,
        contract=volume_delta_update.contract,
        timeframe=volume_delta_update.tf,
        time=volume_delta_update.time,
        volume=volume_delta_update.volume,
        buy_volume=volume_delta_update.buy_volume,
        sell_volume=volume_delta_update.sell_volume,
        delta=volume_delta_update.delta,
        delta_high=volume_delta_update.delta_high,
        delta_low=volume_delta_update.delta_low,
        open_delta=volume_delta_update.open_delta,
        close_delta=volume_delta_update.close_delta,
    )

    if footprint_update is not None:
        def write(conn: sqlite3.Connection) -> None:
            conn.execute(
                "DELETE FROM footprint_levels "
                "WHERE symbol=? AND contract=? AND timeframe=? AND time=?",
                (
                    footprint_update.symbol,
                    footprint_update.contract,
                    footprint_update.tf,
                    footprint_update.time,
                ),
            )

        cache.writer.write(write)
    cache.upsert_derived_batch(
        bars=[bar_record],
        volume_deltas=[vd_record],
        footprint_bars=[] if footprint_bar is None else [footprint_bar],
        footprint_levels=footprint_levels,
    )

    rollup_bars, rollup_deltas = _rebuild_native_rollups(cache, bar_record)
    if rollup_bars or rollup_deltas:
        cache.upsert_derived_batch(
            bars=rollup_bars,
            volume_deltas=rollup_deltas,
        )

    return (
        [_bar_update_from_record(rec) for rec in rollup_bars],
        [_volume_delta_update_from_record(rec) for rec in rollup_deltas],
    )


def _rebuild_native_rollups(
    cache,
    m1_bar: BarRecord,
) -> tuple[list[BarRecord], list[VolumeDeltaRecord]]:
    bars: list[BarRecord] = []
    deltas: list[VolumeDeltaRecord] = []
    for tf in ROLLUP_TFS:
        bucket = timeframe_bucket_start(m1_bar.time, tf)
        end = bucket + TF_MS[tf] - 1

        m1_bars = cache.read_bars(
            m1_bar.symbol,
            m1_bar.contract,
            FOOTPRINT_TIMEFRAME,
            bucket,
            end,
        )
        bar = _rollup_bar(m1_bar.symbol, m1_bar.contract, tf, bucket, m1_bars)
        if bar is not None:
            bars.append(bar)

        m1_deltas = cache.read_volume_delta(
            m1_bar.symbol,
            m1_bar.contract,
            FOOTPRINT_TIMEFRAME,
            bucket,
            end,
        )
        delta = _rollup_volume_delta(
            m1_bar.symbol,
            m1_bar.contract,
            tf,
            bucket,
            m1_deltas,
        )
        if delta is not None:
            deltas.append(delta)
    return bars, deltas


def _rollup_bar(
    symbol: str,
    contract: str,
    tf: str,
    bucket: int,
    m1_bars: list[BarRecord],
) -> BarRecord | None:
    m1_bars = [bar for bar in m1_bars if _is_valid_bar_record(bar)]
    if not m1_bars:
        return None
    return BarRecord(
        symbol=symbol,
        contract=contract,
        timeframe=tf,
        time=bucket,
        open=m1_bars[0].open,
        high=max(bar.high for bar in m1_bars),
        low=min(bar.low for bar in m1_bars),
        close=m1_bars[-1].close,
        volume=sum(bar.volume for bar in m1_bars),
        closed=_rollup_bar_closed(tf, bucket, m1_bars),
    )


def _rollup_volume_delta(
    symbol: str,
    contract: str,
    tf: str,
    bucket: int,
    m1_deltas: list[VolumeDeltaRecord],
) -> VolumeDeltaRecord | None:
    m1_deltas = [rec for rec in m1_deltas if _is_valid_volume_delta_record(rec)]
    if not m1_deltas:
        return None

    running = 0
    delta_high: int | None = None
    delta_low: int | None = None
    for rec in m1_deltas:
        high = running + rec.delta_high
        low = running + rec.delta_low
        delta_high = high if delta_high is None else max(delta_high, high)
        delta_low = low if delta_low is None else min(delta_low, low)
        running += rec.close_delta

    return VolumeDeltaRecord(
        symbol=symbol,
        contract=contract,
        timeframe=tf,
        time=bucket,
        volume=sum(rec.volume for rec in m1_deltas),
        buy_volume=sum(rec.buy_volume for rec in m1_deltas),
        sell_volume=sum(rec.sell_volume for rec in m1_deltas),
        delta=running,
        delta_high=0 if delta_high is None else delta_high,
        delta_low=0 if delta_low is None else delta_low,
        open_delta=m1_deltas[0].open_delta,
        close_delta=running,
    )


def _rollup_bar_closed(tf: str, bucket: int, m1_bars: list[BarRecord]) -> bool:
    if not m1_bars:
        return False
    last_m1_start = bucket + TF_MS[tf] - TF_MS[FOOTPRINT_TIMEFRAME]
    return m1_bars[-1].time >= last_m1_start


def _is_valid_bar_record(bar: BarRecord) -> bool:
    return _is_valid_ohlcv(bar.open, bar.high, bar.low, bar.close, bar.volume)


def _is_valid_ohlcv(
    open_price: float,
    high_price: float,
    low_price: float,
    close_price: float,
    volume: int,
) -> bool:
    return (
        volume > 0
        and open_price > 0
        and high_price > 0
        and low_price > 0
        and close_price > 0
        and high_price >= open_price
        and high_price >= close_price
        and high_price >= low_price
        and low_price <= open_price
        and low_price <= close_price
    )


def _is_valid_volume_delta_record(rec: VolumeDeltaRecord) -> bool:
    return rec.volume > 0 or rec.buy_volume > 0 or rec.sell_volume > 0


def _bar_update_from_record(rec: BarRecord) -> BarUpdate:
    return BarUpdate(
        symbol=rec.symbol,
        contract=rec.contract,
        tf=rec.timeframe,
        bar=OHLCVBar(
            time=rec.time,
            open=rec.open,
            high=rec.high,
            low=rec.low,
            close=rec.close,
            volume=rec.volume,
        ),
        closed=rec.closed,
    )


def _volume_delta_update_from_record(rec: VolumeDeltaRecord) -> VolumeDeltaUpdate:
    return VolumeDeltaUpdate(
        symbol=rec.symbol,
        contract=rec.contract,
        tf=rec.timeframe,
        time=rec.time,
        volume=rec.volume,
        buy_volume=rec.buy_volume,
        sell_volume=rec.sell_volume,
        delta=rec.delta,
        delta_high=rec.delta_high,
        delta_low=rec.delta_low,
        open_delta=rec.open_delta,
        close_delta=rec.close_delta,
    )


def _as_int(payload: dict[str, Any], field: str, default: int | None = None) -> int:
    value = payload.get(field)
    if value is None or value == "":
        if default is not None:
            return default
        raise bad_request(f"missing integer field {field}", field=field)
    try:
        return int(float(value))
    except (TypeError, ValueError):
        raise bad_request(f"invalid integer field {field}", field=field)


def _as_float(payload: dict[str, Any], field: str) -> float:
    value = payload.get(field)
    parsed = _coerce_float(value)
    if parsed is None:
        raise bad_request(f"invalid float field {field}", field=field)
    return parsed


def _coerce_int(value: Any, default: int = 0) -> int:
    if value is None or value == "":
        return default
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _coerce_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
