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

from ..engines.footprint_engine import (
    DEFAULT_TICK_SIZE,
    FOOTPRINT_TIMEFRAME,
    FootprintEngine,
    _BarState,
    _Level,
)
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

    _persist_native_payload(
        runtime.cache,
        bar_update=bar_update,
        volume_delta_update=volume_delta_update,
        footprint_update=footprint_update,
    )

    runtime.registry.enqueue(OutboundEvent.from_message(bar_update))
    runtime.registry.enqueue(OutboundEvent.from_message(volume_delta_update))
    if footprint_update is not None:
        runtime.registry.enqueue(OutboundEvent.from_message(footprint_update))

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
) -> None:
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
