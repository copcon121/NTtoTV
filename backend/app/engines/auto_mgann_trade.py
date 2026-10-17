"""Server-side mGann automatic execution and fixed-risk trade management.

The engine deliberately consumes live, closed M1 bars only.  Historical cache
rows are used solely to warm the detector after a restart and can never submit
an order.  Each submission has a deterministic idempotency key so duplicate
bar snapshots and restarts cannot duplicate a trade.
"""

from __future__ import annotations

import logging
import math
import secrets
from dataclasses import replace

from ..config import Settings, settings as default_settings
from ..models.auto_trade import AutoTradeSettingsRecord
from ..models.messages import EventType, OHLCVBar
from ..models.orders import (
    OrderEventRecord,
    OrderKind,
    OrderRecord,
    OrderSide,
    OrderSource,
    OrderStatus,
    order_to_dict,
)
from ..models.timestamp import now_ms
from ..mt5.manager import Mt5Manager
from ..registry.registry import OutboundEvent, WebSocketRegistry
from ..storage.cache_store import CacheStore
from .basis_engine import BasisEngine
from .chart_limit_take_profit import find_position, half_close_volume, positive_number
from .gc_push_momentum import GcPushMomentumPoint, GcPushMomentumState
from .mgann_big_trade_sweep import (
    MGANN_BIG_TRADE_SWEEP_DEFAULT_BREAK_TICKS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_CONFIRMATION_BARS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_FILTER_LIQUIDITY,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_LIQUIDITY_ATR_MARGIN,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_LIQUIDITY_SWEEP_LOOKBACK_BARS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_CUTS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_WICK_TICKS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_SPREAD_TICKS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_LOOKBACK_BARS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_TOLERANCE_TICKS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_LOOKBACK,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_MULTIPLIER,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_SWING_SIZE,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_DELTA_LOOKBACK,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_DELTA_MULTIPLIER,
    MgannBigTradeSweepBar,
    MgannBigTradeSweepState,
)
from .symbol_map import SymbolMap

__all__ = ["AutoMgannTradeEngine"]

logger = logging.getLogger(__name__)

_GC_TICK_SIZE = 0.1
_TP_R_MULTIPLE = 3.0
_LIMIT_BODY_MIN_GC = 4.0
_LIMIT_BODY_FRACTION = 0.70
_MAX_BODY_MULTIPLE = 8.0
_PARTIAL_TAKE_PROFIT_EVENT = "auto_mgann_partial_take_profit_1r"


class AutoMgannTradeEngine:
    """Execute opted-in mGann signals with Long BOS momentum confirmation."""

    def __init__(
        self,
        cache: CacheStore,
        mt5_manager: Mt5Manager,
        basis_engine: BasisEngine,
        registry: WebSocketRegistry | None = None,
        *,
        settings: Settings | None = None,
    ) -> None:
        self._cache = cache
        self._mt5 = mt5_manager
        self._basis = basis_engine
        self._registry = registry
        self._settings = settings or default_settings
        # Use the same optimized mGann Break L/S detector defaults as the chart
        # and alerts. Long is narrowed below to BOS plus aligned prior-P90 GC
        # Push Momentum; Short retains the existing behavior.
        self._signals = MgannBigTradeSweepState(
            timeframe="1m",
            require_big_trade=False,
            volume_delta_lookback=MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_DELTA_LOOKBACK,
            volume_delta_multiplier=MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_DELTA_MULTIPLIER,
            min_spread_ticks=MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_SPREAD_TICKS,
            spread_lookback=MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_LOOKBACK,
            spread_multiplier=MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_MULTIPLIER,
            swing_size=MGANN_BIG_TRADE_SWEEP_DEFAULT_SWING_SIZE,
            pivot_lookback_bars=MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_LOOKBACK_BARS,
            min_pivot_cuts=MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_CUTS,
            pivot_tolerance_ticks=MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_TOLERANCE_TICKS,
            min_pivot_wick_ticks=MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_WICK_TICKS,
            filter_liquidity=MGANN_BIG_TRADE_SWEEP_DEFAULT_FILTER_LIQUIDITY,
            liquidity_atr_margin=MGANN_BIG_TRADE_SWEEP_DEFAULT_LIQUIDITY_ATR_MARGIN,
            liquidity_sweep_lookback_bars=(
                MGANN_BIG_TRADE_SWEEP_DEFAULT_LIQUIDITY_SWEEP_LOOKBACK_BARS
            ),
            confirmation_bars=MGANN_BIG_TRADE_SWEEP_DEFAULT_CONFIRMATION_BARS,
            break_ticks=MGANN_BIG_TRADE_SWEEP_DEFAULT_BREAK_TICKS,
            tick_size=_GC_TICK_SIZE,
        )
        self._push_momentum = GcPushMomentumState()
        self._last_open_order_scan_at = 0

    def seed(self, *, symbol: str = "GC", contract: str = "GC", count: int = 500) -> None:
        """Warm the detector from recent closed bars without submitting orders."""
        bars = self._cache.read_bars(symbol, contract, "1m", limit=max(1, count))
        deltas_by_time = {
            row.time: row.delta
            for row in self._cache.read_volume_delta(
                symbol,
                contract,
                "1m",
                frm=bars[0].time if bars else None,
                to=bars[-1].time if bars else None,
            )
        }
        for bar in bars:
            if not bar.closed:
                continue
            self._push_momentum.on_closed_bar(bar)
            self._signals.on_closed_bar(
                _to_signal_bar(bar, volume_delta=deltas_by_time.get(bar.time))
            )

    def on_closed_bar(self, bar: OHLCVBar, volume_delta: int | None = None) -> int:
        """Process one live closed M1 bar and return submitted/rejected order count."""
        push_momentum = self._push_momentum.on_closed_bar(bar)
        triggers = self._signals.on_closed_bar(
            _to_signal_bar(bar, volume_delta=volume_delta)
        )
        if not triggers:
            return 0

        attempts = 0
        for trigger in triggers:
            if trigger.structure_kind not in {"BOS", "CHoCH"}:
                continue
            if not _is_auto_body_size_allowed(trigger):
                continue
            if trigger.direction > 0 and not _long_bos_push_momentum_passes(
                trigger,
                push_momentum,
            ):
                logger.info(
                    "auto mGann skipped long %s at %s: GC Push Momentum "
                    "requires aligned prior-P90 strength (push=%s threshold=%s)",
                    trigger.structure_kind,
                    bar.time,
                    None if push_momentum is None else push_momentum.push,
                    (
                        None
                        if push_momentum is None
                        else push_momentum.strong_threshold
                    ),
                )
                continue
            use_body_limit = _uses_body_midpoint_limit(trigger)
            for config in self._cache.auto_trade.read_enabled():
                if not _is_enabled_for_direction(config, trigger.direction):
                    continue
                attempts += self._submit_for_signal(
                    config,
                    trigger.direction,
                    bar,
                    use_body_midpoint_limit=use_body_limit,
                    structure_kind=trigger.structure_kind,
                    push_momentum=push_momentum,
                )
        return attempts

    def take_profit_half_at_1r(self, gc_price: float) -> int:
        """Close half at +1R while preserving the original SL and +3R TP."""
        if not math.isfinite(gc_price):
            return 0
        changed = 0
        for account in self._cache.users.read_mt5_accounts():
            already_taken = {
                order.id
                for order in self._cache.orders.list_open_for_account_with_event(
                    account.user_id,
                    account.id,
                    _PARTIAL_TAKE_PROFIT_EVENT,
                )
            }
            candidates = [
                order
                for order in self._cache.orders.list_open_for_account(
                    account.user_id, account.id
                )
                if order.source is OrderSource.AUTO_MGANN
                and order.status is OrderStatus.FILLED
                and order.broker_position_ticket is not None
                and order.id not in already_taken
                and _has_reached_one_r(order, gc_price)
            ]
            if not candidates:
                continue
            try:
                with self._mt5.account_session(self._cache, account) as backend:
                    symbol = backend.symbol_info(
                        account.user_id,
                        account.id,
                        account.symbol_broker,
                    )
                    positions = backend.positions(account.user_id, account.id)
                    for order in candidates:
                        position = find_position(
                            positions,
                            order.broker_position_ticket,
                            account.symbol_broker,
                        )
                        if position is None:
                            continue
                        broker_volume = positive_number(position.get("volumeLots"))
                        if broker_volume is None:
                            continue
                        managed_volume = min(order.volume_lots, broker_volume)
                        close_volume = half_close_volume(
                            managed_volume,
                            min_lot=symbol.min_lot,
                            lot_step=symbol.lot_step,
                        )
                        if close_volume is None:
                            continue
                        if self._close_half_at_1r(
                            order,
                            backend,
                            gc_price=gc_price,
                            close_volume=close_volume,
                        ):
                            changed += 1
            except Exception as exc:
                logger.warning(
                    "auto mGann 1R partial take profit skipped for account %s: %s",
                    account.id,
                    exc,
                )
        return changed

    def cancel_unfilled_limits_at_1r(self, gc_price: float) -> int:
        """Cancel auto limits once price reaches 1R without filling them."""
        if not math.isfinite(gc_price):
            return 0
        changed = 0
        for account in self._cache.users.read_mt5_accounts():
            candidates = [
                order
                for order in self._cache.orders.list_open_for_account(
                    account.user_id, account.id
                )
                if order.source is OrderSource.AUTO_MGANN
                and order.kind is OrderKind.LIMIT
                and order.status is OrderStatus.WORKING
                and _should_cancel_unfilled_limit_at_1r(order, gc_price)
            ]
            if not candidates:
                continue
            try:
                with self._mt5.account_session(self._cache, account) as backend:
                    for order in candidates:
                        if self._cancel_unfilled_limit_at_1r(order, backend, gc_price):
                            changed += 1
            except Exception as exc:
                logger.warning(
                    "auto mGann limit cancellation skipped for account %s: %s",
                    account.id,
                    exc,
                )
        return changed

    def should_scan_open_order_management(self, at: int | None = None) -> bool:
        """Throttle database scans while preserving a tick-driven 250ms reaction."""
        current = now_ms() if at is None else int(at)
        if current - self._last_open_order_scan_at < 250:
            return False
        self._last_open_order_scan_at = current
        return True

    def _submit_for_signal(
        self,
        config: AutoTradeSettingsRecord,
        direction: int,
        bar: OHLCVBar,
        *,
        use_body_midpoint_limit: bool = False,
        structure_kind: str,
        push_momentum: GcPushMomentumPoint | None,
    ) -> int:
        side = OrderSide.BUY if direction > 0 else OrderSide.SELL
        idempotency_key = f"auto-mgann:{bar.time}:{side.value}"
        if self._cache.orders.read_by_idempotency(config.user_id, idempotency_key):
            return 0
        account = self._cache.users.read_mt5_account(config.user_id)
        if account is None or not _trading_allowed(self._settings, account.trade_mode):
            return 0

        try:
            with self._mt5.account_session(self._cache, account) as backend:
                symbol_info = backend.symbol_info(
                    account.user_id, account.id, account.symbol_broker
                )
                symbol = SymbolMap.from_info(symbol_info)
                if not _valid_volume(
                    config.volume_lots,
                    symbol_info.min_lot,
                    symbol_info.max_lot,
                    symbol_info.lot_step,
                ):
                    logger.warning(
                        "auto mGann skipped invalid saved lot size %s for user %s",
                        config.volume_lots,
                        config.user_id,
                    )
                    return 0
                tick = backend.symbol_tick(account.user_id, account.id, account.symbol_broker)
                self._basis.update_broker_mid((tick.bid + tick.ask) / 2, tick.time)
                market_broker = tick.ask if side is OrderSide.BUY else tick.bid
                market_entry = self._basis.from_broker(market_broker, symbol)
                if market_entry.stale:
                    logger.warning("auto mGann skipped: GC/XAU basis is stale")
                    return 0

                kind = OrderKind.LIMIT if use_body_midpoint_limit else OrderKind.MARKET
                if kind is OrderKind.LIMIT:
                    entry_gc = _signal_body_limit_price(bar)
                    converted_entry = self._basis.to_broker(entry_gc, symbol)
                    if converted_entry.stale or not _valid_limit_entry(
                        side,
                        converted_entry.price,
                        market_broker,
                        symbol.stops_level,
                    ):
                        logger.warning(
                            "auto mGann skipped body-midpoint limit at %s: level already "
                            "traded or too close to market",
                            bar.time,
                        )
                        return 0
                    entry_broker = converted_entry.price
                    entry_basis = converted_entry.basis
                else:
                    entry_gc = market_entry.price
                    entry_broker = symbol.round_price(market_broker)
                    entry_basis = market_entry.basis

                sl_gc = _signal_stop(side, bar)
                risk = (
                    entry_gc - sl_gc
                    if side is OrderSide.BUY
                    else sl_gc - entry_gc
                )
                if risk <= 0:
                    logger.warning(
                        "auto mGann skipped stale %s signal at %s: entry=%s sl=%s",
                        side.value,
                        bar.time,
                        entry_gc,
                        sl_gc,
                    )
                    return 0
                tp_gc = _round_gc(
                    entry_gc + _TP_R_MULTIPLE * risk
                    if side is OrderSide.BUY
                    else entry_gc - _TP_R_MULTIPLE * risk
                )
                sl = self._basis.to_broker(sl_gc, symbol)
                tp = self._basis.to_broker(tp_gc, symbol)
                if sl.stale or tp.stale or not _valid_stops(
                    entry_broker, sl.price, tp.price, symbol.stops_level, side
                ):
                    logger.warning("auto mGann skipped invalid/stale bracket at %s", bar.time)
                    return 0

                current = now_ms()
                order = OrderRecord(
                    id=f"ord_{secrets.token_hex(12)}",
                    user_id=config.user_id,
                    account_id=account.id,
                    source=OrderSource.AUTO_MGANN,
                    symbol_internal="GC",
                    contract_internal="GC",
                    source_contract=None,
                    symbol_broker=account.symbol_broker,
                    side=side,
                    kind=kind,
                    volume_lots=config.volume_lots,
                    gc_anchored=True,
                    status=OrderStatus.PENDING_SUBMIT,
                    idempotency_key=idempotency_key,
                    created_at=current,
                    updated_at=current,
                    entry_gc=entry_gc,
                    sl_gc=sl_gc,
                    tp_gc=tp_gc,
                    entry_broker=entry_broker,
                    sl_broker=sl.price,
                    tp_broker=tp.price,
                    basis_at_submit=entry_basis,
                    basis_at_last_sync=entry_basis,
                )
                self._cache.orders.create(order)
                self._audit(
                    order,
                    "auto_mgann_signal",
                    {
                        "signalTime": bar.time,
                        "direction": direction,
                        "entryGc": entry_gc,
                        "slGc": sl_gc,
                        "tpGc": tp_gc,
                        "riskGc": risk,
                        "structureKind": structure_kind,
                        "gcPushMomentum": (
                            None if push_momentum is None else push_momentum.push
                        ),
                        "gcPushStrongThreshold": (
                            None
                            if push_momentum is None
                            else push_momentum.strong_threshold
                        ),
                        "gcPushStrong": (
                            False if push_momentum is None else push_momentum.strong
                        ),
                        "entryStyle": "body_70_percent_limit"
                        if kind is OrderKind.LIMIT
                        else "market",
                    },
                )
                try:
                    result = backend.place_order(order)
                except Exception as exc:
                    order.status = OrderStatus.REJECTED
                    order.reject_reason = str(exc)
                    order.last_broker_error_message = str(exc)
                    order.updated_at = now_ms()
                    self._cache.orders.update(order)
                    self._audit(order, "auto_mgann_broker_exception", {"errorMessage": str(exc)})
                    self._emit_order(order)
                    return 1
        except Exception as exc:
            logger.warning("auto mGann submit failed for user %s: %s", config.user_id, exc)
            return 0

        order.submitted_at = now_ms()
        order.updated_at = order.submitted_at
        if result.accepted:
            order.status = OrderStatus(result.status)
            order.broker_order_ticket = result.broker_order_ticket
            order.broker_position_ticket = result.broker_position_ticket
            order.broker_deal_ticket = result.broker_deal_ticket
            order.fill_price_broker = result.fill_price
            if result.fill_price is not None:
                fill = self._basis.from_broker(result.fill_price, symbol)
                order.fill_price_gc_estimate = fill.price
                order.basis_at_fill = fill.basis
                order.filled_at = order.updated_at
        else:
            order.status = OrderStatus.REJECTED
            order.reject_reason = result.error_message
            order.last_broker_error_code = result.error_code
            order.last_broker_error_message = result.error_message
        self._cache.orders.update(order)
        self._audit(
            order,
            "auto_mgann_broker_result",
            {"accepted": result.accepted, "status": result.status},
        )
        self._emit_order(order)
        return 1

    def _cancel_unfilled_limit_at_1r(self, order: OrderRecord, backend, gc_price: float) -> bool:
        try:
            result = backend.cancel_order(order)
        except Exception as exc:
            self._audit(order, "auto_mgann_limit_cancel_exception", {"errorMessage": str(exc)})
            return False
        if not result.accepted:
            self._audit(
                order,
                "auto_mgann_limit_cancel_rejected",
                {"errorCode": result.error_code, "errorMessage": result.error_message},
            )
            return False
        cancelled = replace(order)
        cancelled.status = OrderStatus.CANCELLED
        cancelled.closed_at = now_ms()
        cancelled.updated_at = cancelled.closed_at
        self._cache.orders.update(cancelled)
        self._audit(
            cancelled,
            "auto_mgann_limit_cancelled_at_1r",
            {
                "gcPrice": gc_price,
                "oneRPrice": _one_r_price(cancelled),
                "entryGc": cancelled.entry_gc,
                "slGc": cancelled.sl_gc,
            },
        )
        self._emit_order(cancelled)
        return True

    def _close_half_at_1r(
        self,
        order: OrderRecord,
        backend,
        *,
        gc_price: float,
        close_volume: float,
    ) -> bool:
        close_request = replace(order, volume_lots=close_volume)
        try:
            result = backend.close_position(close_request)
        except Exception as exc:
            self._audit(
                order,
                "auto_mgann_partial_take_profit_1r_exception",
                {"errorMessage": str(exc)},
            )
            return False
        if not result.accepted:
            self._audit(
                order,
                "auto_mgann_partial_take_profit_1r_rejected",
                {"errorCode": result.error_code, "errorMessage": result.error_message},
            )
            return False

        original_volume = order.volume_lots
        updated = replace(order)
        updated.volume_lots = round(max(0.0, original_volume - close_volume), 10)
        updated.broker_deal_ticket = result.broker_deal_ticket or updated.broker_deal_ticket
        updated.last_broker_error_code = None
        updated.last_broker_error_message = None
        updated.updated_at = now_ms()
        self._cache.orders.update(updated)
        self._audit(
            updated,
            _PARTIAL_TAKE_PROFIT_EVENT,
            {
                "gcPrice": gc_price,
                "oneRPrice": _one_r_price(updated),
                "entryGc": updated.entry_gc,
                "slGc": updated.sl_gc,
                "tpGc": updated.tp_gc,
                "originalVolumeLots": original_volume,
                "closedVolumeLots": close_volume,
                "remainingVolumeLots": updated.volume_lots,
            },
        )
        self._emit_order(updated)
        return True

    def _audit(self, order: OrderRecord, event_type: str, payload: dict) -> None:
        self._cache.orders.append_event(
            OrderEventRecord(
                order_id=order.id,
                user_id=order.user_id,
                event_type=event_type,
                payload=payload,
                created_at=now_ms(),
            )
        )

    def _emit_order(self, order: OrderRecord) -> None:
        if self._registry is None:
            return
        self._registry.enqueue(
            OutboundEvent(
                event_type=EventType.ORDER_UPDATE,
                symbol=order.symbol_internal,
                payload={
                    "type": "order_update",
                    "symbol": order.symbol_internal,
                    "order": order_to_dict(order),
                },
                key=order.id,
                user_id=order.user_id,
            )
        )


def _to_signal_bar(bar, *, volume_delta: int | None = None) -> MgannBigTradeSweepBar:
    return MgannBigTradeSweepBar(
        time=bar.time,
        open=float(bar.open),
        high=float(bar.high),
        low=float(bar.low),
        close=float(bar.close),
        volume=int(bar.volume),
        volume_delta=volume_delta,
    )


def _is_enabled_for_direction(config: AutoTradeSettingsRecord, direction: int) -> bool:
    return config.long_enabled if direction > 0 else config.short_enabled


def _long_bos_push_momentum_passes(
    trigger,
    point: GcPushMomentumPoint | None,
) -> bool:
    """Allow Long only for BOS with positive prior-P90 GC Push Momentum."""
    return (
        getattr(trigger, "structure_kind", None) == "BOS"
        and point is not None
        and point.strong
        and point.push > 0
    )


def _is_auto_body_size_allowed(trigger) -> bool:
    """Reject only bodies strictly larger than 8x their prior-20 average."""
    body = getattr(trigger, "bar_spread", None)
    average = getattr(trigger, "avg_spread", None)
    if not isinstance(body, (int, float)) or not math.isfinite(body):
        return True
    if not isinstance(average, (int, float)) or not math.isfinite(average) or average <= 0:
        return True
    return body <= average * _MAX_BODY_MULTIPLE


def _uses_body_midpoint_limit(trigger) -> bool:
    """Use a body-based limit only for a body strictly larger than 4.0 GC."""
    body_spread = getattr(trigger, "bar_spread", None)
    return (
        isinstance(body_spread, (int, float))
        and math.isfinite(body_spread)
        and body_spread > _LIMIT_BODY_MIN_GC
    )


def _signal_body_limit_price(bar: OHLCVBar) -> float:
    """Return 70% of the signal body measured from open toward close."""
    return _round_gc(
        float(bar.open) + _LIMIT_BODY_FRACTION * (float(bar.close) - float(bar.open))
    )


def _signal_stop(side: OrderSide, bar: OHLCVBar) -> float:
    raw = float(bar.low) if side is OrderSide.BUY else float(bar.high)
    return _round_gc(raw)


def _round_gc(price: float) -> float:
    return round(round(float(price) / _GC_TICK_SIZE) * _GC_TICK_SIZE, 1)


def _trading_allowed(settings: Settings, trade_mode: str) -> bool:
    if settings.mt5_backend != "fake" and not settings.trading_enabled:
        return False
    return trade_mode != "live" or settings.live_trading_enabled


def _valid_volume(volume: float, min_lot: float, max_lot: float, lot_step: float) -> bool:
    if volume < min_lot or volume > max_lot:
        return False
    steps = round((volume - min_lot) / lot_step)
    return abs(min_lot + steps * lot_step - volume) <= 1e-9


def _valid_stops(
    entry: float,
    sl: float,
    tp: float,
    stops_level: float,
    side: OrderSide,
) -> bool:
    if side is OrderSide.BUY:
        directional = sl < entry < tp
    else:
        directional = tp < entry < sl
    return directional and abs(entry - sl) >= stops_level and abs(tp - entry) >= stops_level


def _valid_limit_entry(
    side: OrderSide,
    entry: float,
    market: float,
    stops_level: float,
) -> bool:
    if side is OrderSide.BUY:
        return entry <= market - stops_level
    return entry >= market + stops_level


def _one_r_price(order: OrderRecord) -> float | None:
    if order.entry_gc is None or order.sl_gc is None:
        return None
    risk = (
        order.entry_gc - order.sl_gc
        if order.side is OrderSide.BUY
        else order.sl_gc - order.entry_gc
    )
    if risk <= 0:
        return None
    raw = order.entry_gc + risk if order.side is OrderSide.BUY else order.entry_gc - risk
    return _round_gc(raw)


def _should_cancel_unfilled_limit_at_1r(order: OrderRecord, gc_price: float) -> bool:
    one_r = _one_r_price(order)
    if one_r is None:
        return False
    return gc_price >= one_r if order.side is OrderSide.BUY else gc_price <= one_r


def _has_reached_one_r(order: OrderRecord, gc_price: float) -> bool:
    one_r = _one_r_price(order)
    if one_r is None:
        return False
    return gc_price >= one_r if order.side is OrderSide.BUY else gc_price <= one_r
