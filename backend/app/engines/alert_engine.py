"""Alert_Engine: server-side alert evaluation, emission, and persistence.

The Alert_Engine evaluates enabled alerts on the Backend, emits an
:class:`~app.models.messages.AlertEvent` when a condition is satisfied, and
persists an alert-event audit record to the Cache_Store. It honors per-alert
enable/disable and implements the fire-once + re-arm state machine so each
crossing / closed-bar event fires at most once. (Requirements 16, 17)

Supported alert types (Req 16.1):

* ``price_crosses_level``    — last trade price crosses a configured level.
* ``bar_closes_above``       — a closed bar's close is above a level.
* ``bar_closes_below``       — a closed bar's close is below a level.
* ``volume_delta_threshold`` — a closed bar's volume delta meets a threshold.
* ``big_trade_threshold``    — a reconstructed big trade meets a volume threshold.
* ``stacked_imbalance``      — a closed footprint bar exhibits a stacked imbalance.
* ``mgann_break_ls``         — SMC internal mGann Break L/S by body/volume delta.

Price source and evaluation timing (Req 16.6, 16.7):

* ``price_crosses_level`` is evaluated against the **last trade price** of the
  Active_Contract. A crossing occurs when the level lies strictly between the
  previous observed last trade price and the current last trade price (a mere
  touch — where the price equals the level — is not a crossing).
* ``bar_closes_above`` / ``bar_closes_below`` are evaluated against the **close
  price of a closed bar** only, never against an in-progress bar.

Fire-once + re-arm semantics (Req 17.5-17.8):

* A ``price_crosses_level`` alert emits at most one event per crossing. Because
  a fresh crossing requires the price to move strictly to the opposite side of
  the level, a fired alert necessarily re-arms only after the last trade price
  has returned across the level. Repeated evaluations at the same (unchanged)
  price emit nothing.
* A ``bar_closes_*`` (and the per-bar threshold) alert emits at most one event
  per closed bar; after firing on a closed bar it is suppressed until a
  subsequent bar closes, at which point it re-arms and is evaluated on that
  newly closed bar.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

from ..models.canonical import Side
from ..models.messages import AlertEvent
from ..models.timestamp import CanonicalTimestamp
from ..storage.cache_store import CacheStore
from ..storage.records import AlertEventRecord, AlertRecord, BigTradeRecord
from .breakout_box_engine import BreakoutBoxEvent
from .mgann_big_trade_sweep import (
    MGANN_BIG_TRADE_SWEEP_DEFAULT_BIG_TRADE_THRESHOLD,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_BREAK_TICKS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_CONFIRMATION_BARS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_CUTS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_WICK_TICKS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_LIQUIDITY_ATR_MARGIN,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_LIQUIDITY_SWEEP_LOOKBACK_BARS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_SPREAD_TICKS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_LOOKBACK_BARS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_TOLERANCE_TICKS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_LOOKBACK,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_MULTIPLIER,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_SWING_SIZE,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_TIMEFRAME,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_DELTA_LOOKBACK,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_DELTA_MULTIPLIER,
    MGANN_BIG_TRADE_SWEEP_TIMEFRAMES,
    MgannBigTradeSweepBar,
    MgannBigTradeSweepState,
    MgannBigTradeSweepTrigger,
)
from .smc_external import (
    SmcBar,
    SmcExternalBreakState,
    SmcExternalDetector,
    SmcLiquidityBreakEvent,
    SmcStrategyTrigger,
)
from .sweep_reversal import (
    SWEEP_REVERSAL_DEFAULT_ATR_LENGTH,
    SWEEP_REVERSAL_DEFAULT_LIQUIDITY_ATR_LENGTH,
    SWEEP_REVERSAL_DEFAULT_LIQUIDITY_ATR_MARGIN,
    SWEEP_REVERSAL_DEFAULT_LIQUIDITY_LOOKBACK_BARS,
    SWEEP_REVERSAL_DEFAULT_LIQUIDITY_MIN_PIVOTS,
    SWEEP_REVERSAL_DEFAULT_MAX_CONFIRMATION_BARS,
    SWEEP_REVERSAL_DEFAULT_MIN_DISPLACEMENT_ATR,
    SWEEP_REVERSAL_DEFAULT_MIN_PENETRATION_ATR,
    SWEEP_REVERSAL_DEFAULT_STRUCTURE_LENGTH,
    SWEEP_REVERSAL_DEFAULT_SWING_LENGTH,
    SWEEP_REVERSAL_TIMEFRAMES,
    SweepReversalBar,
    SweepReversalState,
    SweepReversalTrigger,
)
from .supertrend import (
    SUPERTREND_ATR_METHODS,
    SUPERTREND_DEFAULT_ATR_METHOD,
    SUPERTREND_DEFAULT_DIRECTION,
    SUPERTREND_DEFAULT_MULTIPLIER,
    SUPERTREND_DEFAULT_PERIOD,
    SUPERTREND_DEFAULT_SOURCE,
    SUPERTREND_DIRECTIONS,
    SUPERTREND_MAX_PERIOD,
    SUPERTREND_SOURCES,
    SUPERTREND_TIMEFRAMES,
    SupertrendBar,
    SupertrendConfig,
    SupertrendState,
)

__all__ = [
    "ALERT_TYPES",
    "LEVEL_ALERT_TYPES",
    "SMC_DEFAULT_LOOKAHEAD_BARS",
    "SMC_DEFAULT_MAX_BARS",
    "SMC_DEFAULT_PAUSE_ON_INSIDE_BARS",
    "SMC_DEFAULT_RETEST_TOLERANCE_TICKS",
    "SMC_DEFAULT_SWING_LENGTH",
    "SMC_EXTERNAL_BREAK_BIG_TRADE",
    "SWEEP_REVERSAL",
    "SWEEP_REVERSAL_TIMEFRAMES",
    "SUPERTREND_DIRECTION_CHANGE",
    "SUPERTREND_TIMEFRAMES",
    "LIQUIDITY_POOL_BREAK",
    "LIQUIDITY_POOL_BREAK_TIMEFRAME",
    "LIQUIDITY_POOL_BREAK_TIMEFRAMES",
    "MGANN_BREAK_LS",
    "MGANN_SWEEP",
    "MGANN_BIG_TRADE_SWEEP",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_BIG_TRADE_THRESHOLD",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_BREAK_TICKS",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_CONFIRMATION_BARS",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_CUTS",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_WICK_TICKS",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_LIQUIDITY_ATR_MARGIN",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_LIQUIDITY_SWEEP_LOOKBACK_BARS",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_SPREAD_TICKS",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_LOOKBACK_BARS",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_TOLERANCE_TICKS",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_LOOKBACK",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_MULTIPLIER",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_SWING_SIZE",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_TIMEFRAME",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_DELTA_LOOKBACK",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_DELTA_MULTIPLIER",
    "MGANN_BIG_TRADE_SWEEP_TIMEFRAMES",
    "Alert",
    "MarketContext",
    "AlertEngine",
]

# Type literals for supported alert types. (Req 16.1)
PRICE_CROSSES_LEVEL = "price_crosses_level"
BAR_CLOSES_ABOVE = "bar_closes_above"
BAR_CLOSES_BELOW = "bar_closes_below"
VOLUME_DELTA_THRESHOLD = "volume_delta_threshold"
BIG_TRADE_THRESHOLD = "big_trade_threshold"
STACKED_IMBALANCE = "stacked_imbalance"
SMC_EXTERNAL_BREAK_BIG_TRADE = "smc_external_break_big_trade"
LIQUIDITY_POOL_BREAK = "liquidity_pool_break"
LIQUIDITY_POOL_BREAK_TIMEFRAME = "1m"
LIQUIDITY_POOL_BREAK_TIMEFRAMES = ("1m", "5m")
MGANN_BREAK_LS = "mgann_break_ls"
MGANN_SWEEP = "mgann_sweep"
MGANN_BIG_TRADE_SWEEP = "mgann_big_trade_sweep"
SWEEP_REVERSAL = "sweep_reversal"
SUPERTREND_DIRECTION_CHANGE = "supertrend_direction_change"
MGANN_BREAK_LS_TYPES = frozenset(
    {MGANN_BREAK_LS, MGANN_SWEEP, MGANN_BIG_TRADE_SWEEP}
)

SMC_DEFAULT_SWING_LENGTH = 50
SMC_DEFAULT_LOOKAHEAD_BARS = 5
SMC_DEFAULT_MAX_BARS = 20
SMC_DEFAULT_PAUSE_ON_INSIDE_BARS = True
SMC_DEFAULT_RETEST_TOLERANCE_TICKS = 50
_SMC_WARMUP_MIN_BARS = 300
_SUPERTREND_WARMUP_BARS = 5_000
_M1_MS = 60_000

ALERT_TYPES: frozenset[str] = frozenset(
    {
        PRICE_CROSSES_LEVEL,
        BAR_CLOSES_ABOVE,
        BAR_CLOSES_BELOW,
        VOLUME_DELTA_THRESHOLD,
        BIG_TRADE_THRESHOLD,
        STACKED_IMBALANCE,
        SMC_EXTERNAL_BREAK_BIG_TRADE,
        LIQUIDITY_POOL_BREAK,
        MGANN_BREAK_LS,
        MGANN_SWEEP,
        MGANN_BIG_TRADE_SWEEP,
        SWEEP_REVERSAL,
        SUPERTREND_DIRECTION_CHANGE,
    }
)

# Alert types whose ``params`` carry a numeric ``level`` reported on the event.
LEVEL_ALERT_TYPES: frozenset[str] = frozenset(
    {PRICE_CROSSES_LEVEL, BAR_CLOSES_ABOVE, BAR_CLOSES_BELOW}
)


def _canonical_alert_type(alert_type: str) -> str:
    return MGANN_BREAK_LS if alert_type in MGANN_BREAK_LS_TYPES else alert_type


def _canonical_alert_params(alert_type: str, params: dict[str, Any]) -> dict[str, Any]:
    out = dict(params)
    if alert_type == MGANN_BIG_TRADE_SWEEP:
        out["requireBigTrade"] = True
    elif alert_type == MGANN_SWEEP:
        out["requireBigTrade"] = False
    return out


@dataclass(slots=True)
class Alert:
    """An alert definition held by the Alert_Engine. (Req 16.1)

    ``params`` is the type-specific configuration (e.g. ``{"level": 2346.0}`` or
    ``{"threshold": 100}``). ``enabled`` governs whether the engine evaluates the
    alert (Req 16.4).
    """

    id: str
    symbol: str
    type: str
    params: dict[str, Any] = field(default_factory=dict)
    enabled: bool = True
    profile_id: str = "default"

    @classmethod
    def from_record(cls, rec: AlertRecord) -> "Alert":
        params = _canonical_alert_params(rec.type, dict(rec.params))
        return cls(
            id=rec.id,
            symbol=rec.symbol,
            type=_canonical_alert_type(rec.type),
            params=params,
            enabled=rec.enabled,
            profile_id=rec.profile_id,
        )


@dataclass(slots=True)
class MarketContext:
    """A single market event the Alert_Engine evaluates alerts against.

    Exactly one signal is normally populated per context:

    * ``last_price`` drives ``price_crosses_level`` (the last trade price).
    * a closed bar (``bar_closed=True`` with ``bar_close``/``bar_time``) drives
      ``bar_closes_above`` / ``bar_closes_below`` and, when supplied,
      ``bar_volume_delta`` drives ``volume_delta_threshold`` and
      ``bar_stacked_imbalance`` drives ``stacked_imbalance``.
    * ``big_trade_volume`` drives ``big_trade_threshold``.

    Signals left ``None`` are not evaluated, so an in-progress bar (``bar_closed``
    False) never triggers a bar-close alert. (Req 16.7)
    """

    symbol: str
    contract: str
    time: CanonicalTimestamp

    # price_crosses_level
    last_price: float | None = None

    # bar_closes_* / volume_delta_threshold / stacked_imbalance (closed bar only)
    bar_closed: bool = False
    bar_tf: str | None = None
    bar_time: CanonicalTimestamp | None = None
    bar_open: float | None = None
    bar_high: float | None = None
    bar_low: float | None = None
    bar_close: float | None = None
    bar_volume: int | None = None
    bar_volume_delta: int | None = None
    bar_stacked_imbalance: bool | None = None

    # big_trade_threshold
    big_trade_volume: int | None = None
    big_trade_price: float | None = None
    big_trade_side: Side | None = None

    # legacy breakout/FVG signal context; no alert type consumes it.
    breakout_events: list[BreakoutBoxEvent] | None = None
    fvg_level: int | None = None
    fvg_direction: int | None = None


@dataclass(slots=True)
class _PriceCrossState:
    """Per-alert state for ``price_crosses_level``."""

    prev_price: float | None = None


@dataclass(slots=True)
class _BarState:
    """Per-alert state for per-closed-bar alert types (fire-once + re-arm)."""

    last_bar_time: CanonicalTimestamp | None = None
    armed: bool = True


@dataclass(slots=True)
class _LiquidityPoolBreakState:
    detector: SmcExternalDetector
    last_bar_time: CanonicalTimestamp | None = None

    def on_closed_bar(
        self, bar: SmcBar
    ) -> tuple[SmcLiquidityBreakEvent, ...]:
        if self.last_bar_time is not None and bar.time <= self.last_bar_time:
            return ()
        self.last_bar_time = bar.time
        self.detector.update(bar)
        return self.detector.liquidity_breaks


def _is_repeat_alert(alert: Alert) -> bool:
    """Whether a fired alert should stay enabled after emission."""
    return alert.params.get("repeat") is True


class AlertEngine:
    """Evaluate enabled alerts, emit ``alert_event``s, and persist audit records.

    Alert definitions are registered with :meth:`upsert` / :meth:`delete` and
    toggled with :meth:`set_enabled`. :meth:`evaluate` processes a
    :class:`MarketContext` and returns the list of emitted
    :class:`~app.models.messages.AlertEvent`s, persisting a matching
    :class:`~app.storage.records.AlertEventRecord` for each. (Req 16, 17)

    When a :class:`~app.storage.cache_store.CacheStore` is provided, alert
    definitions are persisted on :meth:`upsert`/:meth:`delete` (so the
    ``alert_events`` foreign key is always satisfiable) and emitted events are
    persisted on :meth:`evaluate`.
    """

    def __init__(self, store: CacheStore | None = None) -> None:
        self._store = store
        self._alerts: dict[str, Alert] = {}
        self._price_state: dict[str, _PriceCrossState] = {}
        self._bar_state: dict[str, _BarState] = {}
        self._smc_state: dict[str, SmcExternalBreakState] = {}
        self._liquidity_break_state: dict[str, _LiquidityPoolBreakState] = {}
        self._mgann_sweep_state: dict[str, MgannBigTradeSweepState] = {}
        self._sweep_reversal_state: dict[str, SweepReversalState] = {}
        self._supertrend_state: dict[str, SupertrendState] = {}
        self._supertrend_min_bar_time: CanonicalTimestamp | None = None
        if store is not None:
            for rec in store.read_alerts(profile_id=None):
                alert = Alert.from_record(rec)
                self._alerts[rec.id] = alert
                if alert.enabled:
                    self._warm_alert_state(alert)

    # -- registration ---------------------------------------------------------

    def upsert(self, alert: Alert) -> Alert:
        """Register or replace an alert definition. (Req 16.1, 16.2)"""
        self._alerts[alert.id] = alert
        # Evaluation state is keyed by alert id; clear it so an edited alert
        # (e.g. a changed level) starts from a clean fire-once state.
        self._price_state.pop(alert.id, None)
        self._bar_state.pop(alert.id, None)
        self._smc_state.pop(alert.id, None)
        self._liquidity_break_state.pop(alert.id, None)
        self._mgann_sweep_state.pop(alert.id, None)
        self._sweep_reversal_state.pop(alert.id, None)
        self._supertrend_state.pop(alert.id, None)
        if self._store is not None:
            from ..models.timestamp import now_ms

            now = now_ms()
            existing = self._store.read_alert(alert.id, alert.profile_id)
            created = existing.created_at if existing is not None else now
            self._store.upsert_alert(
                AlertRecord(
                    id=alert.id,
                    profile_id=alert.profile_id,
                    symbol=alert.symbol,
                    type=alert.type,
                    params=dict(alert.params),
                    enabled=alert.enabled,
                    created_at=created,
                    updated_at=now,
                )
            )
        if alert.enabled:
            self._warm_alert_state(alert)
        return alert

    def delete(self, alert_id: str) -> None:
        """Remove an alert definition and its evaluation state. (Req 16.3)"""
        self._alerts.pop(alert_id, None)
        self._price_state.pop(alert_id, None)
        self._bar_state.pop(alert_id, None)
        self._smc_state.pop(alert_id, None)
        self._liquidity_break_state.pop(alert_id, None)
        self._mgann_sweep_state.pop(alert_id, None)
        self._sweep_reversal_state.pop(alert_id, None)
        self._supertrend_state.pop(alert_id, None)
        if self._store is not None:
            self._store.delete_alert(alert_id)

    def set_enabled(self, alert_id: str, enabled: bool) -> None:
        """Enable/disable an alert for evaluation. (Req 16.4)"""
        alert = self._alerts.get(alert_id)
        if alert is None:
            return
        alert.enabled = enabled
        if enabled:
            self._smc_state.pop(alert.id, None)
            self._liquidity_break_state.pop(alert.id, None)
            self._mgann_sweep_state.pop(alert.id, None)
            self._sweep_reversal_state.pop(alert.id, None)
            self._supertrend_state.pop(alert.id, None)
            self._warm_alert_state(alert)
        self._persist_enabled(alert)

    def alerts(self) -> list[Alert]:
        """Return the registered alert definitions."""
        return list(self._alerts.values())

    def rewarm_supertrend(self) -> None:
        """Rebuild enabled Supertrend states from logical cached closed bars.

        Source arbitration may replace the two most recent logical chart bars
        while switching owners. Replaying without emitting keeps recursive ATR
        and bands aligned with the same cache history the chart will render.
        """
        for alert in self._alerts.values():
            if not alert.enabled or alert.type != SUPERTREND_DIRECTION_CHANGE:
                continue
            self._supertrend_state.pop(alert.id, None)
            self._warm_supertrend_alert(alert)

    def reset_supertrend(
        self, *, warm_from: CanonicalTimestamp | None = None
    ) -> None:
        """Reset recursive state at a physical-contract boundary.

        ``warm_from`` suppresses partial buckets that started before rollover
        and keeps later feed-switch rewarms from joining the old contract's
        logical-cache history to the new contract.
        """
        self._supertrend_state.clear()
        self._supertrend_min_bar_time = warm_from

    # -- evaluation -----------------------------------------------------------

    def evaluate(self, ctx: MarketContext) -> list[AlertEvent]:
        """Evaluate all enabled alerts for ``ctx`` and return emitted events.

        Disabled alerts are never evaluated (Req 16.4, 17.1). Each emitted event
        is persisted to the Cache_Store when a store is configured (Req 17.3).
        """
        events: list[AlertEvent] = []
        one_shot_fired_alerts: list[Alert] = []
        for alert in self._alerts.values():
            if not alert.enabled:  # Req 16.4, 17.1
                continue
            if alert.symbol != ctx.symbol:
                continue
            evaluated = self._evaluate_one(alert, ctx)
            alert_events = (
                evaluated
                if isinstance(evaluated, list)
                else ([] if evaluated is None else [evaluated])
            )
            if alert_events:
                events.extend(alert_events)
                if not _is_repeat_alert(alert):
                    one_shot_fired_alerts.append(alert)

        for alert in one_shot_fired_alerts:
            alert.enabled = False

        # Persist emitted events (audit log). (Req 17.3)
        if self._store is not None:
            for ev in events:
                self._persist_event(ev)
            for alert in one_shot_fired_alerts:
                self._persist_enabled(alert)
        return events

    def evaluate_sweep_reversal_only(self, ctx: MarketContext) -> list[AlertEvent]:
        """Evaluate Sweep Reversal without exposing legacy alerts to extra TFs."""
        events: list[AlertEvent] = []
        one_shot_fired_alerts: list[Alert] = []
        for alert in self._alerts.values():
            if (
                not alert.enabled
                or alert.symbol != ctx.symbol
                or alert.type != SWEEP_REVERSAL
            ):
                continue
            alert_events = self._eval_sweep_reversal(alert, ctx)
            events.extend(alert_events)
            if alert_events and not _is_repeat_alert(alert):
                one_shot_fired_alerts.append(alert)
        for alert in one_shot_fired_alerts:
            alert.enabled = False
        if self._store is not None:
            for event in events:
                self._persist_event(event)
            for alert in one_shot_fired_alerts:
                self._persist_enabled(alert)
        return events

    def evaluate_supertrend_only(self, ctx: MarketContext) -> list[AlertEvent]:
        """Evaluate Supertrend on extra closed-bar timeframes only."""
        events: list[AlertEvent] = []
        one_shot_fired_alerts: list[Alert] = []
        for alert in self._alerts.values():
            if (
                not alert.enabled
                or alert.symbol != ctx.symbol
                or alert.type != SUPERTREND_DIRECTION_CHANGE
            ):
                continue
            event = self._eval_supertrend(alert, ctx)
            if event is None:
                continue
            events.append(event)
            if not _is_repeat_alert(alert):
                one_shot_fired_alerts.append(alert)
        for alert in one_shot_fired_alerts:
            alert.enabled = False
        if self._store is not None:
            for event in events:
                self._persist_event(event)
            for alert in one_shot_fired_alerts:
                self._persist_enabled(alert)
        return events

    def reconcile_mgann_closed_bar(self, ctx: MarketContext) -> list[AlertEvent]:
        """Recover a live mGann event by replaying authoritative cached data.

        Reconnect snapshots intentionally do not emit alerts, but that can leave
        an incremental detector behind the cached chart history. After each
        authoritative M1 close, rebuild enabled mGann states from the same
        persisted bars/order-flow used by historical markers. Only a signal on
        the current bar that is absent from the audit log is emitted.
        """
        if (
            self._store is None
            or not ctx.bar_closed
            or ctx.bar_tf != MGANN_BIG_TRADE_SWEEP_DEFAULT_TIMEFRAME
            or ctx.bar_time is None
        ):
            return []

        alerts = [
            alert
            for alert in self._alerts.values()
            if alert.enabled
            and alert.symbol == ctx.symbol
            and alert.type in MGANN_BREAK_LS_TYPES
            and self._mgann_sweep_timeframe(alert) == ctx.bar_tf
        ]
        if not alerts:
            return []

        bar_time = int(ctx.bar_time)
        warmup_limit = max(
            self._mgann_sweep_warmup_bars(alert) for alert in alerts
        )
        bars = [
            rec
            for rec in self._store.read_bars(
                ctx.symbol,
                ctx.contract,
                ctx.bar_tf,
                to=bar_time,
                limit=warmup_limit,
            )
            if rec.closed and rec.time <= bar_time
        ]
        if not bars or bars[-1].time != bar_time:
            return []

        deltas_by_time = {
            rec.time: rec.delta
            for rec in self._store.read_volume_delta(
                ctx.symbol,
                ctx.contract,
                ctx.bar_tf,
                frm=bars[0].time,
                to=bar_time,
            )
        }
        trades_by_bucket: dict[int, list[BigTradeRecord]] = {}
        for trade in self._store.read_big_trades(
            ctx.symbol,
            ctx.contract,
            frm=bars[0].time,
            to=bar_time + _M1_MS - 1,
        ):
            bucket = int(trade.time) - (int(trade.time) % _M1_MS)
            trades_by_bucket.setdefault(bucket, []).append(trade)

        events: list[AlertEvent] = []
        one_shot_fired_alerts: list[Alert] = []
        for alert in alerts:
            state = self._new_mgann_sweep_state(alert)
            current_triggers: list[MgannBigTradeSweepTrigger] = []
            for rec in bars:
                for trade in trades_by_bucket.get(rec.time, []):
                    state.on_big_trade(
                        time=trade.time,
                        price=trade.price,
                        volume=trade.volume,
                    )
                triggers = state.on_closed_bar(
                    MgannBigTradeSweepBar(
                        time=rec.time,
                        open=rec.open,
                        high=rec.high,
                        low=rec.low,
                        close=rec.close,
                        volume=rec.volume,
                        volume_delta=deltas_by_time.get(rec.time),
                    )
                )
                if rec.time == bar_time:
                    current_triggers = triggers

            # Replace the incremental state even when normal live evaluation
            # already fired, keeping the next bar aligned after reconnects.
            self._mgann_sweep_state[alert.id] = state
            if not current_triggers or self._store.alert_event_exists(
                alert.id,
                alert.profile_id,
                bar_time,
            ):
                continue
            for trigger in current_triggers:
                event = self._make_mgann_sweep_event(alert, ctx, trigger)
                events.append(event)
                self._persist_event(event)
            if not _is_repeat_alert(alert):
                alert.enabled = False
                one_shot_fired_alerts.append(alert)

        for alert in one_shot_fired_alerts:
            self._persist_enabled(alert)
        return events

    def _evaluate_one(
        self, alert: Alert, ctx: MarketContext
    ) -> AlertEvent | list[AlertEvent] | None:
        if alert.type == PRICE_CROSSES_LEVEL:
            return self._eval_price_crosses(alert, ctx)
        if alert.type in (BAR_CLOSES_ABOVE, BAR_CLOSES_BELOW):
            return self._eval_bar_closes(alert, ctx)
        if alert.type == VOLUME_DELTA_THRESHOLD:
            return self._eval_volume_delta(alert, ctx)
        if alert.type == BIG_TRADE_THRESHOLD:
            return self._eval_big_trade(alert, ctx)
        if alert.type == STACKED_IMBALANCE:
            return self._eval_stacked_imbalance(alert, ctx)
        if alert.type == SMC_EXTERNAL_BREAK_BIG_TRADE:
            return self._eval_smc_external_break_big_trade(alert, ctx)
        if alert.type == LIQUIDITY_POOL_BREAK:
            return self._eval_liquidity_pool_break(alert, ctx)
        if alert.type in MGANN_BREAK_LS_TYPES:
            return self._eval_mgann_big_trade_sweep(alert, ctx)
        if alert.type == SWEEP_REVERSAL:
            return self._eval_sweep_reversal(alert, ctx)
        if alert.type == SUPERTREND_DIRECTION_CHANGE:
            return self._eval_supertrend(alert, ctx)
        return None

    # -- price_crosses_level (Req 16.6, 17.5, 17.7) ---------------------------

    def _eval_price_crosses(
        self, alert: Alert, ctx: MarketContext
    ) -> AlertEvent | None:
        if ctx.last_price is None:
            return None
        level = float(alert.params["level"])
        state = self._price_state.setdefault(alert.id, _PriceCrossState())
        prev = state.prev_price
        price = float(ctx.last_price)
        state.prev_price = price

        if prev is None:
            return None
        # TradingView-style alert line behavior: touching the configured level
        # from either side fires, as does crossing straight through it.
        touched_or_crossed = (
            (prev < level <= price) or
            (prev > level >= price)
        )
        if not touched_or_crossed:
            return None
        return self._make_event(alert, ctx, price=price, level=level)

    # -- bar_closes_above / bar_closes_below (Req 16.7, 17.6, 17.8) -----------

    def _eval_bar_closes(self, alert: Alert, ctx: MarketContext) -> AlertEvent | None:
        if ctx.bar_tf not in (None, "1m"):
            return None
        if not ctx.bar_closed or ctx.bar_close is None or ctx.bar_time is None:
            return None  # only closed bars are evaluated (Req 16.7)
        level = float(alert.params["level"])
        close = float(ctx.bar_close)
        if alert.type == BAR_CLOSES_ABOVE:
            condition = close > level
        else:  # BAR_CLOSES_BELOW
            condition = close < level
        if not self._bar_gate(alert, ctx.bar_time, condition):
            return None
        return self._make_event(alert, ctx, price=close, level=level)

    # -- volume_delta_threshold ----------------------------------------------

    def _eval_volume_delta(self, alert: Alert, ctx: MarketContext) -> AlertEvent | None:
        if ctx.bar_tf not in (None, "1m"):
            return None
        if not ctx.bar_closed or ctx.bar_volume_delta is None or ctx.bar_time is None:
            return None
        threshold = float(alert.params["threshold"])
        delta = float(ctx.bar_volume_delta)
        condition = abs(delta) >= abs(threshold)
        if not self._bar_gate(alert, ctx.bar_time, condition):
            return None
        price = float(ctx.bar_close) if ctx.bar_close is not None else delta
        return self._make_event(alert, ctx, price=price, level=None)

    # -- stacked_imbalance ----------------------------------------------------

    def _eval_stacked_imbalance(
        self, alert: Alert, ctx: MarketContext
    ) -> AlertEvent | None:
        if ctx.bar_tf not in (None, "1m"):
            return None
        if not ctx.bar_closed or ctx.bar_stacked_imbalance is None or ctx.bar_time is None:
            return None
        condition = bool(ctx.bar_stacked_imbalance)
        if not self._bar_gate(alert, ctx.bar_time, condition):
            return None
        price = float(ctx.bar_close) if ctx.bar_close is not None else 0.0
        return self._make_event(alert, ctx, price=price, level=None)

    # -- big_trade_threshold --------------------------------------------------

    def _eval_big_trade(self, alert: Alert, ctx: MarketContext) -> AlertEvent | None:
        if ctx.big_trade_volume is None:
            return None
        threshold = float(alert.params["threshold"])
        if float(ctx.big_trade_volume) < threshold:
            return None
        # Each reconstructed big trade is a distinct event, so every qualifying
        # trade emits once (no per-bar gating).
        price = (
            float(ctx.big_trade_price)
            if ctx.big_trade_price is not None
            else 0.0
        )
        return self._make_event(alert, ctx, price=price, level=None)

    # -- smc_external_break_big_trade ----------------------------------------

    def _eval_smc_external_break_big_trade(
        self, alert: Alert, ctx: MarketContext
    ) -> AlertEvent | None:
        state = self._smc_state_for(alert)
        trigger: SmcStrategyTrigger | None = None

        if ctx.bar_closed:
            if ctx.bar_tf not in (None, "1m"):
                return None
            bar = self._smc_bar_from_context(ctx)
            if bar is not None:
                trigger = state.on_closed_bar(bar)

        if trigger is None and ctx.big_trade_volume is not None:
            price = (
                float(ctx.big_trade_price)
                if ctx.big_trade_price is not None
                else 0.0
            )
            trigger = state.on_big_trade(
                time=ctx.time,
                price=price,
                volume=int(ctx.big_trade_volume),
                threshold=self._smc_big_trade_threshold(alert),
            )

        if trigger is None:
            return None
        return self._make_smc_event(alert, ctx, trigger)

    # -- standalone liquidity_pool_break -------------------------------------

    def _eval_liquidity_pool_break(
        self, alert: Alert, ctx: MarketContext
    ) -> list[AlertEvent]:
        timeframe = self._liquidity_break_timeframe(alert)
        if (
            (ctx.bar_tf or LIQUIDITY_POOL_BREAK_TIMEFRAME) != timeframe
            or not ctx.bar_closed
        ):
            return []
        bar = self._smc_bar_from_context(ctx)
        if bar is None:
            return []

        configured_side = self._liquidity_break_side(alert)
        breaks = self._liquidity_break_state_for(alert).on_closed_bar(bar)
        events: list[AlertEvent] = []
        for trigger in breaks:
            label = "BSL" if trigger.side == "buy" else "SSL"
            if configured_side != "both" and configured_side != label.lower():
                continue
            level = trigger.top if trigger.side == "buy" else trigger.bottom
            direction = 1 if trigger.side == "buy" else -1
            events.append(
                AlertEvent(
                    alert_id=alert.id,
                    alert_type=alert.type,
                    symbol=ctx.symbol,
                    contract=ctx.contract,
                    time=trigger.break_time,
                    price=trigger.close,
                    message=(
                        f"{alert.symbol} {_timeframe_label(timeframe)} "
                        f"Liquidity Pool Break {label} "
                        f"x{trigger.pivot_count} @ {_fmt_num(level)}"
                    ),
                    level=level,
                    profile_id=alert.profile_id,
                    direction=direction,
                )
            )
        return events

    # -- mgann_break_ls --------------------------------------------------------

    def _eval_mgann_big_trade_sweep(
        self, alert: Alert, ctx: MarketContext
    ) -> list[AlertEvent]:
        state = self._mgann_sweep_state_for(alert)

        if ctx.big_trade_volume is not None:
            price = (
                float(ctx.big_trade_price)
                if ctx.big_trade_price is not None
                else 0.0
            )
            state.on_big_trade(
                time=ctx.time,
                price=price,
                volume=int(ctx.big_trade_volume),
            )

        timeframe = self._mgann_sweep_timeframe(alert)
        if ctx.bar_tf != timeframe:
            return []
        if (
            not ctx.bar_closed
            or ctx.bar_time is None
            or ctx.bar_open is None
            or ctx.bar_high is None
            or ctx.bar_low is None
            or ctx.bar_close is None
        ):
            return []

        triggers = state.on_closed_bar(
            MgannBigTradeSweepBar(
                time=ctx.bar_time,
                open=float(ctx.bar_open),
                high=float(ctx.bar_high),
                low=float(ctx.bar_low),
                close=float(ctx.bar_close),
                volume=int(ctx.bar_volume or 0),
                volume_delta=ctx.bar_volume_delta,
            )
        )
        events: list[AlertEvent] = []
        for trigger in triggers:
            events.append(self._make_mgann_sweep_event(alert, ctx, trigger))
        return events

    # -- standalone sweep_reversal ------------------------------------------

    def _eval_sweep_reversal(
        self, alert: Alert, ctx: MarketContext
    ) -> list[AlertEvent]:
        timeframe = self._sweep_reversal_timeframe(alert)
        if (
            ctx.bar_tf != timeframe
            or not ctx.bar_closed
            or ctx.bar_time is None
            or ctx.bar_open is None
            or ctx.bar_high is None
            or ctx.bar_low is None
            or ctx.bar_close is None
        ):
            return []
        triggers = self._sweep_reversal_state_for(alert).on_closed_bar(
            SweepReversalBar(
                time=ctx.bar_time,
                open=float(ctx.bar_open),
                high=float(ctx.bar_high),
                low=float(ctx.bar_low),
                close=float(ctx.bar_close),
                volume=int(ctx.bar_volume or 0),
            )
        )
        return [
            self._make_sweep_reversal_event(alert, ctx, trigger)
            for trigger in triggers
        ]

    # -- Supertrend direction change ----------------------------------------

    def _eval_supertrend(
        self, alert: Alert, ctx: MarketContext
    ) -> AlertEvent | None:
        timeframe = self._supertrend_timeframe(alert)
        if (
            ctx.bar_tf != timeframe
            or not ctx.bar_closed
            or ctx.bar_time is None
            or ctx.bar_open is None
            or ctx.bar_high is None
            or ctx.bar_low is None
            or ctx.bar_close is None
        ):
            return None
        if (
            self._supertrend_min_bar_time is not None
            and ctx.bar_time < self._supertrend_min_bar_time
        ):
            return None

        state = self._supertrend_state_for(alert)
        # The same authoritative close can arrive as both a live update and a
        # reconnect snapshot. Recursive state must advance exactly once.
        if state.last_time is not None and ctx.bar_time <= state.last_time:
            return None
        point = state.on_closed_bar(
            SupertrendBar(
                time=ctx.bar_time,
                open=float(ctx.bar_open),
                high=float(ctx.bar_high),
                low=float(ctx.bar_low),
                close=float(ctx.bar_close),
            )
        )
        if point is None or point.direction == 0:
            return None
        configured_direction = self._supertrend_direction(alert)
        if configured_direction == "buy" and point.direction < 0:
            return None
        if configured_direction == "sell" and point.direction > 0:
            return None
        # This also covers a process restart where the alert audit survived
        # but the corresponding logical bar was not available during warmup.
        if self._store is not None and self._store.alert_event_exists(
            alert.id,
            alert.profile_id,
            ctx.bar_time,
        ):
            return None
        return self._make_supertrend_event(alert, ctx, point.direction)

    # -- per-closed-bar fire-once + re-arm gate (Req 17.6, 17.8) --------------

    def _bar_gate(
        self, alert: Alert, bar_time: CanonicalTimestamp, condition: bool
    ) -> bool:
        """Return True iff the alert should fire on this closed bar.

        A subsequent closed bar (a strictly later ``bar_time``) re-arms the
        alert; re-evaluating the same closed bar never re-arms. The alert fires
        at most once per closed bar and is then suppressed until the next bar
        closes.
        """
        state = self._bar_state.setdefault(alert.id, _BarState())
        if state.last_bar_time is None or bar_time > state.last_bar_time:
            # A subsequent (newer) closed bar re-arms the alert. (Req 17.8)
            state.armed = True
            state.last_bar_time = bar_time
        elif bar_time < state.last_bar_time:
            # A stale/out-of-order closed bar: never fire on it.
            return False
        # else bar_time == last_bar_time: the same closed bar re-evaluated; do
        # not re-arm, so it cannot fire twice for one bar-close event.
        if condition and state.armed:
            state.armed = False  # fire-once for this closed bar (Req 17.6)
            return True
        return False

    # -- event construction ---------------------------------------------------

    def _make_event(
        self,
        alert: Alert,
        ctx: MarketContext,
        *,
        price: float,
        level: float | None,
    ) -> AlertEvent:
        return AlertEvent(
            alert_id=alert.id,
            alert_type=alert.type,
            symbol=ctx.symbol,
            contract=ctx.contract,
            time=ctx.time,
            price=price,
            message=self._message(alert, price, level),
            level=level,
            profile_id=alert.profile_id,
        )

    def _make_smc_event(
        self,
        alert: Alert,
        ctx: MarketContext,
        trigger: SmcStrategyTrigger,
    ) -> AlertEvent:
        return AlertEvent(
            alert_id=alert.id,
            alert_type=alert.type,
            symbol=ctx.symbol,
            contract=ctx.contract,
            time=trigger.time,
            price=trigger.price,
            message=self._smc_message(alert, trigger),
            level=trigger.setup.level,
            profile_id=alert.profile_id,
        )


    def _make_mgann_sweep_event(
        self,
        alert: Alert,
        ctx: MarketContext,
        trigger: MgannBigTradeSweepTrigger,
    ) -> AlertEvent:
        tf_label = _timeframe_label(self._mgann_sweep_timeframe(alert))
        if self._mgann_sweep_require_big_trade(alert):
            threshold = _fmt_num(self._mgann_sweep_big_trade_threshold(alert))
            message = (
                f"{alert.symbol} {tf_label} mGann Break "
                f"{'L' if trigger.direction > 0 else 'S'} "
                f"internal {trigger.structure_kind} + BigTrade "
                f"{_fmt_num(trigger.big_trade_volume)} > {threshold}; "
                f"delta {trigger.bar_volume_delta:+d}, body {trigger.bar_spread:.1f}"
            )
        else:
            message = (
                f"{alert.symbol} {tf_label} mGann Break "
                f"{'L' if trigger.direction > 0 else 'S'} "
                f"internal {trigger.structure_kind}; "
                f"delta {trigger.bar_volume_delta:+d}, body {trigger.bar_spread:.1f}"
            )
        return AlertEvent(
            alert_id=alert.id,
            alert_type=_canonical_alert_type(alert.type),
            symbol=ctx.symbol,
            contract=ctx.contract,
            time=trigger.signal_time,
            price=trigger.signal_price,
            message=message,
            level=sum(trigger.cut_levels) / len(trigger.cut_levels),
            profile_id=alert.profile_id,
            direction=trigger.direction,
        )

    def _make_sweep_reversal_event(
        self,
        alert: Alert,
        ctx: MarketContext,
        trigger: SweepReversalTrigger,
    ) -> AlertEvent:
        timeframe = self._sweep_reversal_timeframe(alert)
        side = "L" if trigger.direction > 0 else "S"
        pool = (
            f" pool x{trigger.liquidity_count}"
            if alert.params.get("equalSwingFilter") is True
            else ""
        )
        return AlertEvent(
            alert_id=alert.id,
            alert_type=alert.type,
            symbol=ctx.symbol,
            contract=ctx.contract,
            time=trigger.signal_time,
            price=trigger.signal_price,
            message=(
                f"{alert.symbol} {_timeframe_label(timeframe)} Sweep {side}{pool} "
                f"@ {_fmt_num(trigger.sweep_level)}"
            ),
            level=trigger.sweep_level,
            profile_id=alert.profile_id,
            direction=trigger.direction,
        )

    def _make_supertrend_event(
        self,
        alert: Alert,
        ctx: MarketContext,
        direction: int,
    ) -> AlertEvent:
        assert ctx.bar_time is not None
        assert ctx.bar_close is not None
        side = "Buy" if direction > 0 else "Sell"
        timeframe = self._supertrend_timeframe(alert)
        return AlertEvent(
            alert_id=alert.id,
            alert_type=alert.type,
            symbol=ctx.symbol,
            contract=ctx.contract,
            time=ctx.bar_time,
            price=float(ctx.bar_close),
            message=f"{alert.symbol} {_timeframe_label(timeframe)} Supertrend {side}",
            level=None,
            profile_id=alert.profile_id,
            direction=direction,
        )

    def _smc_state_for(self, alert: Alert) -> SmcExternalBreakState:
        state = self._smc_state.get(alert.id)
        if state is None:
            state = self._new_smc_state(alert)
            self._smc_state[alert.id] = state
        return state

    def _liquidity_break_state_for(
        self, alert: Alert
    ) -> _LiquidityPoolBreakState:
        state = self._liquidity_break_state.get(alert.id)
        if state is None:
            state = self._new_liquidity_break_state(alert)
            self._liquidity_break_state[alert.id] = state
        return state

    def _mgann_sweep_state_for(self, alert: Alert) -> MgannBigTradeSweepState:
        state = self._mgann_sweep_state.get(alert.id)
        if state is None:
            state = self._new_mgann_sweep_state(alert)
            self._mgann_sweep_state[alert.id] = state
        return state

    def _sweep_reversal_state_for(self, alert: Alert) -> SweepReversalState:
        state = self._sweep_reversal_state.get(alert.id)
        if state is None:
            state = self._new_sweep_reversal_state(alert)
            self._sweep_reversal_state[alert.id] = state
        return state

    def _supertrend_state_for(self, alert: Alert) -> SupertrendState:
        state = self._supertrend_state.get(alert.id)
        if state is None:
            state = self._new_supertrend_state(alert)
            self._supertrend_state[alert.id] = state
        return state

    def _warm_alert_state(self, alert: Alert) -> None:
        if alert.type == SUPERTREND_DIRECTION_CHANGE:
            self._warm_supertrend_alert(alert)
            return
        self._warm_smc_alert(alert)

    def _warm_supertrend_alert(self, alert: Alert) -> None:
        state = self._new_supertrend_state(alert)
        if self._store is not None:
            for rec in self._store.read_bars(
                alert.symbol,
                alert.symbol,
                self._supertrend_timeframe(alert),
                limit=_SUPERTREND_WARMUP_BARS,
            ):
                # Forming cache rows are mutable. Pine commits recursive state
                # only when a bar is confirmed, so never seed from open bars.
                if not rec.closed:
                    continue
                if (
                    self._supertrend_min_bar_time is not None
                    and rec.time < self._supertrend_min_bar_time
                ):
                    continue
                state.on_closed_bar(
                    SupertrendBar(
                        time=rec.time,
                        open=rec.open,
                        high=rec.high,
                        low=rec.low,
                        close=rec.close,
                    )
                )
        self._supertrend_state[alert.id] = state

    def _warm_smc_alert(self, alert: Alert) -> None:
        if alert.type == SWEEP_REVERSAL:
            self._warm_sweep_reversal_alert(alert)
            return
        if alert.type == LIQUIDITY_POOL_BREAK:
            self._warm_liquidity_break_alert(alert)
            return
        if alert.type in MGANN_BREAK_LS_TYPES:
            self._warm_mgann_sweep_alert(alert)
            return
        if alert.type != SMC_EXTERNAL_BREAK_BIG_TRADE:
            return
        break_state = (
            self._new_smc_state(alert)
            if alert.type == SMC_EXTERNAL_BREAK_BIG_TRADE
            else None
        )

        if self._store is not None:
            limit = max(
                _SMC_WARMUP_MIN_BARS,
                self._smc_swing_length(alert) * 4
                + self._smc_warmup_extra_bars(alert)
                + 20,
            )
            for rec in self._store.read_bars(
                alert.symbol,
                alert.symbol,
                "1m",
                limit=limit,
            ):
                if not rec.closed:
                    continue
                bar = SmcBar(
                    time=rec.time,
                    open=rec.open,
                    high=rec.high,
                    low=rec.low,
                    close=rec.close,
                    volume=rec.volume,
                )
                if break_state is not None:
                    break_state.on_closed_bar(bar)

        if break_state is not None:
            self._smc_state[alert.id] = break_state

    def _warm_sweep_reversal_alert(self, alert: Alert) -> None:
        state = self._new_sweep_reversal_state(alert)
        if self._store is not None:
            for rec in self._store.read_bars(
                alert.symbol,
                alert.symbol,
                self._sweep_reversal_timeframe(alert),
                limit=self._sweep_reversal_warmup_bars(alert),
            ):
                if not rec.closed:
                    continue
                state.on_closed_bar(
                    SweepReversalBar(
                        time=rec.time,
                        open=rec.open,
                        high=rec.high,
                        low=rec.low,
                        close=rec.close,
                        volume=rec.volume,
                    )
                )
        self._sweep_reversal_state[alert.id] = state

    def _warm_liquidity_break_alert(self, alert: Alert) -> None:
        state = self._new_liquidity_break_state(alert)
        if self._store is not None:
            limit = max(
                _SMC_WARMUP_MIN_BARS,
                self._mgann_sweep_pivot_lookback_bars(alert)
                + self._mgann_sweep_swing_size(alert) * 4
                + 40,
            )
            for rec in self._store.read_bars(
                alert.symbol,
                alert.symbol,
                self._liquidity_break_timeframe(alert),
                limit=limit,
            ):
                if not rec.closed:
                    continue
                state.on_closed_bar(
                    SmcBar(
                        time=rec.time,
                        open=rec.open,
                        high=rec.high,
                        low=rec.low,
                        close=rec.close,
                        volume=rec.volume,
                    )
                )
        self._liquidity_break_state[alert.id] = state


    def _warm_mgann_sweep_alert(self, alert: Alert) -> None:
        state = self._new_mgann_sweep_state(alert)
        if self._store is not None:
            timeframe = self._mgann_sweep_timeframe(alert)
            bars = self._store.read_bars(
                alert.symbol,
                alert.symbol,
                timeframe,
                limit=self._mgann_sweep_warmup_bars(alert),
            )
            deltas_by_time = {
                rec.time: rec.delta
                for rec in self._store.read_volume_delta(
                    alert.symbol,
                    alert.symbol,
                    timeframe,
                    frm=bars[0].time if bars else None,
                    to=bars[-1].time if bars else None,
                )
            }
            for rec in bars:
                if not rec.closed:
                    continue
                state.on_closed_bar(
                    MgannBigTradeSweepBar(
                        time=rec.time,
                        open=rec.open,
                        high=rec.high,
                        low=rec.low,
                        close=rec.close,
                        volume=rec.volume,
                        volume_delta=deltas_by_time.get(rec.time),
                    )
                )
        self._mgann_sweep_state[alert.id] = state

    def _new_smc_state(self, alert: Alert) -> SmcExternalBreakState:
        return SmcExternalBreakState(
            swing_length=self._smc_swing_length(alert),
            lookahead_bars=self._smc_lookahead_bars(alert),
            max_bars=self._smc_max_bars(alert),
            pause_on_inside_bars=self._smc_pause_on_inside_bars(alert),
            retest_tolerance_ticks=self._smc_retest_tolerance_ticks(alert),
        )

    def _new_liquidity_break_state(
        self, alert: Alert
    ) -> _LiquidityPoolBreakState:
        return _LiquidityPoolBreakState(
            detector=SmcExternalDetector(
                self._mgann_sweep_swing_size(alert),
                liquidity_filter=True,
                liquidity_min_pivots=self._mgann_sweep_min_pivot_cuts(alert),
                liquidity_lookback_bars=self._mgann_sweep_pivot_lookback_bars(alert),
                liquidity_atr_margin=self._mgann_sweep_liquidity_atr_margin(alert),
                liquidity_sweep_lookback_bars=self._mgann_sweep_liquidity_sweep_lookback_bars(
                    alert
                ),
            )
        )

    def _new_mgann_sweep_state(self, alert: Alert) -> MgannBigTradeSweepState:
        return MgannBigTradeSweepState(
            timeframe=self._mgann_sweep_timeframe(alert),
            big_trade_threshold=self._mgann_sweep_big_trade_threshold(alert),
            volume_delta_lookback=self._mgann_sweep_volume_delta_lookback(alert),
            volume_delta_multiplier=self._mgann_sweep_volume_delta_multiplier(alert),
            min_spread_ticks=self._mgann_sweep_min_spread_ticks(alert),
            spread_lookback=self._mgann_sweep_spread_lookback(alert),
            spread_multiplier=self._mgann_sweep_spread_multiplier(alert),
            swing_size=self._mgann_sweep_swing_size(alert),
            pivot_lookback_bars=self._mgann_sweep_pivot_lookback_bars(alert),
            min_pivot_cuts=self._mgann_sweep_min_pivot_cuts(alert),
            pivot_tolerance_ticks=self._mgann_sweep_pivot_tolerance_ticks(alert),
            min_pivot_wick_ticks=self._mgann_sweep_min_pivot_wick_ticks(alert),
            filter_liquidity=self._mgann_sweep_filter_liquidity(alert),
            liquidity_atr_margin=self._mgann_sweep_liquidity_atr_margin(alert),
            liquidity_sweep_lookback_bars=self._mgann_sweep_liquidity_sweep_lookback_bars(
                alert
            ),
            confirmation_bars=self._mgann_sweep_confirmation_bars(alert),
            break_ticks=self._mgann_sweep_break_ticks(alert),
            require_big_trade=self._mgann_sweep_require_big_trade(alert),
        )

    def _new_sweep_reversal_state(self, alert: Alert) -> SweepReversalState:
        return SweepReversalState(
            swing_length=_positive_int_param(
                alert.params.get("swingLength"),
                SWEEP_REVERSAL_DEFAULT_SWING_LENGTH,
            ),
            atr_length=_positive_int_param(
                alert.params.get("atrLength"),
                SWEEP_REVERSAL_DEFAULT_ATR_LENGTH,
            ),
            min_penetration_atr=_nonnegative_float_param(
                alert.params.get("minPenetrationAtr"),
                SWEEP_REVERSAL_DEFAULT_MIN_PENETRATION_ATR,
            ),
            structure_length=_positive_int_param(
                alert.params.get("structureLength"),
                SWEEP_REVERSAL_DEFAULT_STRUCTURE_LENGTH,
            ),
            max_confirmation_bars=_positive_int_param(
                alert.params.get("maxConfirmationBars"),
                SWEEP_REVERSAL_DEFAULT_MAX_CONFIRMATION_BARS,
            ),
            min_displacement_atr=_nonnegative_float_param(
                alert.params.get("minDisplacementAtr"),
                SWEEP_REVERSAL_DEFAULT_MIN_DISPLACEMENT_ATR,
            ),
            equal_swing_filter=alert.params.get("equalSwingFilter") is True,
            liquidity_min_pivots=_positive_int_param(
                alert.params.get("liquidityMinPivots"),
                SWEEP_REVERSAL_DEFAULT_LIQUIDITY_MIN_PIVOTS,
            ),
            liquidity_lookback_bars=_positive_int_param(
                alert.params.get("liquidityLookbackBars"),
                SWEEP_REVERSAL_DEFAULT_LIQUIDITY_LOOKBACK_BARS,
            ),
            liquidity_atr_length=_positive_int_param(
                alert.params.get("liquidityAtrLength"),
                SWEEP_REVERSAL_DEFAULT_LIQUIDITY_ATR_LENGTH,
            ),
            liquidity_atr_margin=_positive_float_param(
                alert.params.get("liquidityAtrMargin"),
                SWEEP_REVERSAL_DEFAULT_LIQUIDITY_ATR_MARGIN,
            ),
        )

    def _new_supertrend_state(self, alert: Alert) -> SupertrendState:
        return SupertrendState(
            SupertrendConfig(
                period=self._supertrend_period(alert),
                multiplier=self._supertrend_multiplier(alert),
                atr_method=self._supertrend_atr_method(alert),
                source=self._supertrend_source(alert),
            )
        )

    @staticmethod
    def _smc_bar_from_context(ctx: MarketContext) -> SmcBar | None:
        if ctx.bar_time is None or ctx.bar_close is None:
            return None
        if ctx.bar_open is None or ctx.bar_high is None or ctx.bar_low is None:
            return None
        return SmcBar(
            time=ctx.bar_time,
            open=float(ctx.bar_open),
            high=float(ctx.bar_high),
            low=float(ctx.bar_low),
            close=float(ctx.bar_close),
            volume=0 if ctx.bar_volume is None else int(ctx.bar_volume),
        )

    def _smc_warmup_extra_bars(self, alert: Alert) -> int:

        return self._smc_lookahead_bars(alert) + self._smc_max_bars(alert)

    @staticmethod
    def _smc_swing_length(alert: Alert) -> int:
        return _positive_int_param(
            alert.params.get("swingLength"),
            SMC_DEFAULT_SWING_LENGTH,
        )

    @staticmethod
    def _smc_lookahead_bars(alert: Alert) -> int:
        return _positive_int_param(
            alert.params.get(
                "effectiveLookaheadBars",
                alert.params.get("lookaheadBars"),
            ),
            SMC_DEFAULT_LOOKAHEAD_BARS,
        )

    @staticmethod
    def _smc_max_bars(alert: Alert) -> int:
        return _positive_int_param(
            alert.params.get("maxBars"),
            SMC_DEFAULT_MAX_BARS,
        )

    @staticmethod
    def _smc_pause_on_inside_bars(alert: Alert) -> bool:
        raw = alert.params.get(
            "pauseOnInsideBars",
            SMC_DEFAULT_PAUSE_ON_INSIDE_BARS,
        )
        return raw if isinstance(raw, bool) else SMC_DEFAULT_PAUSE_ON_INSIDE_BARS

    @staticmethod
    def _smc_retest_tolerance_ticks(alert: Alert) -> int:
        return _positive_int_param(
            alert.params.get("retestToleranceTicks"),
            SMC_DEFAULT_RETEST_TOLERANCE_TICKS,
        )

    @staticmethod
    def _smc_big_trade_threshold(alert: Alert) -> float:
        raw = alert.params.get("bigTradeThreshold", 50)
        if isinstance(raw, bool):
            return 50.0
        try:
            threshold = float(raw)
        except (TypeError, ValueError):
            return 50.0
        return threshold if threshold > 0 else 50.0

    @staticmethod
    def _liquidity_break_side(alert: Alert) -> str:
        side = alert.params.get("side", "both")
        return side if side in ("both", "bsl", "ssl") else "both"

    @staticmethod
    def _liquidity_break_timeframe(alert: Alert) -> str:
        raw = alert.params.get("timeframe", LIQUIDITY_POOL_BREAK_TIMEFRAME)
        if isinstance(raw, str) and raw in LIQUIDITY_POOL_BREAK_TIMEFRAMES:
            return raw
        return LIQUIDITY_POOL_BREAK_TIMEFRAME
    def _mgann_sweep_warmup_bars(self, alert: Alert) -> int:
        return max(
            500,
            self._mgann_sweep_pivot_lookback_bars(alert)
            + self._mgann_sweep_volume_delta_lookback(alert)
            + self._mgann_sweep_spread_lookback(alert)
            + self._mgann_sweep_confirmation_bars(alert)
            + self._mgann_sweep_swing_size(alert) * 8
            + 40,
        )

    def _sweep_reversal_warmup_bars(self, alert: Alert) -> int:
        return max(
            300,
            _positive_int_param(
                alert.params.get("liquidityLookbackBars"),
                SWEEP_REVERSAL_DEFAULT_LIQUIDITY_LOOKBACK_BARS,
            )
            + _positive_int_param(
                alert.params.get("swingLength"),
                SWEEP_REVERSAL_DEFAULT_SWING_LENGTH,
            )
            * 4
            + _positive_int_param(
                alert.params.get("maxConfirmationBars"),
                SWEEP_REVERSAL_DEFAULT_MAX_CONFIRMATION_BARS,
            )
            + max(
                _positive_int_param(
                    alert.params.get("atrLength"),
                    SWEEP_REVERSAL_DEFAULT_ATR_LENGTH,
                ),
                _positive_int_param(
                    alert.params.get("liquidityAtrLength"),
                    SWEEP_REVERSAL_DEFAULT_LIQUIDITY_ATR_LENGTH,
                ),
            )
            + 40,
        )

    @staticmethod
    def _sweep_reversal_timeframe(alert: Alert) -> str:
        raw = alert.params.get("timeframe", "1m")
        if isinstance(raw, str) and raw in SWEEP_REVERSAL_TIMEFRAMES:
            return raw
        return "1m"

    @staticmethod
    def _supertrend_timeframe(alert: Alert) -> str:
        raw = alert.params.get("timeframe", "1m")
        if isinstance(raw, str) and raw in SUPERTREND_TIMEFRAMES:
            return raw
        return "1m"

    @staticmethod
    def _supertrend_period(alert: Alert) -> int:
        raw = alert.params.get("period", SUPERTREND_DEFAULT_PERIOD)
        if isinstance(raw, bool):
            return SUPERTREND_DEFAULT_PERIOD
        try:
            period = int(raw)
        except (TypeError, ValueError):
            return SUPERTREND_DEFAULT_PERIOD
        return (
            period
            if 1 <= period <= SUPERTREND_MAX_PERIOD
            else SUPERTREND_DEFAULT_PERIOD
        )

    @staticmethod
    def _supertrend_multiplier(alert: Alert) -> float:
        raw = alert.params.get("multiplier", SUPERTREND_DEFAULT_MULTIPLIER)
        if isinstance(raw, bool):
            return SUPERTREND_DEFAULT_MULTIPLIER
        try:
            multiplier = float(raw)
        except (TypeError, ValueError):
            return SUPERTREND_DEFAULT_MULTIPLIER
        return (
            multiplier
            if math.isfinite(multiplier) and multiplier > 0
            else SUPERTREND_DEFAULT_MULTIPLIER
        )

    @staticmethod
    def _supertrend_atr_method(alert: Alert) -> str:
        raw = alert.params.get("atrMethod", SUPERTREND_DEFAULT_ATR_METHOD)
        return (
            raw
            if isinstance(raw, str) and raw in SUPERTREND_ATR_METHODS
            else SUPERTREND_DEFAULT_ATR_METHOD
        )

    @staticmethod
    def _supertrend_source(alert: Alert) -> str:
        raw = alert.params.get("source", SUPERTREND_DEFAULT_SOURCE)
        return (
            raw
            if isinstance(raw, str) and raw in SUPERTREND_SOURCES
            else SUPERTREND_DEFAULT_SOURCE
        )

    @staticmethod
    def _supertrend_direction(alert: Alert) -> str:
        raw = alert.params.get("direction", SUPERTREND_DEFAULT_DIRECTION)
        return (
            raw
            if isinstance(raw, str) and raw in SUPERTREND_DIRECTIONS
            else SUPERTREND_DEFAULT_DIRECTION
        )

    @staticmethod
    def _mgann_sweep_timeframe(alert: Alert) -> str:
        raw = alert.params.get("timeframe", MGANN_BIG_TRADE_SWEEP_DEFAULT_TIMEFRAME)
        if isinstance(raw, str) and raw in MGANN_BIG_TRADE_SWEEP_TIMEFRAMES:
            return raw
        return MGANN_BIG_TRADE_SWEEP_DEFAULT_TIMEFRAME

    @staticmethod
    def _mgann_sweep_big_trade_threshold(alert: Alert) -> float:
        return _positive_float_param(
            alert.params.get("bigTradeThreshold"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_BIG_TRADE_THRESHOLD,
        )

    @staticmethod
    def _mgann_sweep_require_big_trade(alert: Alert) -> bool:
        if alert.type == MGANN_BIG_TRADE_SWEEP:
            return True
        if alert.type == MGANN_SWEEP:
            return False
        return alert.params.get("requireBigTrade") is True

    @staticmethod
    def _mgann_sweep_volume_delta_lookback(alert: Alert) -> int:
        return _positive_int_param(
            alert.params.get(
                "volumeDeltaLookback",
                alert.params.get("volumeLookback"),
            ),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_DELTA_LOOKBACK,
        )

    @staticmethod
    def _mgann_sweep_volume_delta_multiplier(alert: Alert) -> float:
        return _positive_float_param(
            alert.params.get(
                "volumeDeltaMultiplier",
                alert.params.get("volumeMultiplier"),
            ),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_DELTA_MULTIPLIER,
        )

    @staticmethod
    def _mgann_sweep_min_spread_ticks(alert: Alert) -> int:
        return _nonnegative_int_param(
            alert.params.get("minSpreadTicks"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_SPREAD_TICKS,
        )

    @staticmethod
    def _mgann_sweep_spread_lookback(alert: Alert) -> int:
        return _positive_int_param(
            alert.params.get("spreadLookback"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_LOOKBACK,
        )

    @staticmethod
    def _mgann_sweep_spread_multiplier(alert: Alert) -> float:
        return _positive_float_param(
            alert.params.get("spreadMultiplier"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_MULTIPLIER,
        )

    @staticmethod
    def _mgann_sweep_swing_size(alert: Alert) -> int:
        return _mgann_swing_size_param(
            alert.params.get("swingSize"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_SWING_SIZE,
        )

    @staticmethod
    def _mgann_sweep_pivot_lookback_bars(alert: Alert) -> int:
        return _positive_int_param(
            alert.params.get("pivotLookbackBars"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_LOOKBACK_BARS,
        )

    @staticmethod
    def _mgann_sweep_min_pivot_cuts(alert: Alert) -> int:
        return _positive_int_param(
            alert.params.get("minPivotCuts"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_CUTS,
        )

    @staticmethod
    def _mgann_sweep_pivot_tolerance_ticks(alert: Alert) -> int:
        return _nonnegative_int_param(
            alert.params.get("pivotToleranceTicks"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_TOLERANCE_TICKS,
        )

    @staticmethod
    def _mgann_sweep_min_pivot_wick_ticks(alert: Alert) -> int:
        return _nonnegative_int_param(
            alert.params.get("minPivotWickTicks"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_WICK_TICKS,
        )

    @staticmethod
    def _mgann_sweep_filter_liquidity(alert: Alert) -> bool:
        return alert.params.get("filterLiquidity") is True

    @staticmethod
    def _mgann_sweep_liquidity_atr_margin(alert: Alert) -> float:
        return _positive_float_param(
            alert.params.get("liquidityAtrMargin"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_LIQUIDITY_ATR_MARGIN,
        )

    @staticmethod
    def _mgann_sweep_liquidity_sweep_lookback_bars(alert: Alert) -> int:
        return _positive_int_param(
            alert.params.get("liquiditySweepLookbackBars"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_LIQUIDITY_SWEEP_LOOKBACK_BARS,
        )

    @staticmethod
    def _mgann_sweep_confirmation_bars(alert: Alert) -> int:
        return _nonnegative_int_param(
            alert.params.get("confirmationBars"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_CONFIRMATION_BARS,
        )

    @staticmethod
    def _mgann_sweep_break_ticks(alert: Alert) -> int:
        return _nonnegative_int_param(
            alert.params.get("breakTicks"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_BREAK_TICKS,
        )

    def _persist_event(self, event: AlertEvent) -> None:
        if self._store is None:
            return
        self._store.insert_alert_event(
            AlertEventRecord(
                alert_id=event.alert_id,
                profile_id=event.profile_id,
                symbol=event.symbol,
                contract=event.contract,
                time=event.time,
                price=event.price,
                message=event.message,
            )
        )

    def _persist_enabled(self, alert: Alert) -> None:
        if self._store is None:
            return
        rec = self._store.read_alert(alert.id, alert.profile_id)
        if rec is None:
            return
        rec.enabled = alert.enabled
        from ..models.timestamp import now_ms

        rec.updated_at = now_ms()
        self._store.upsert_alert(rec)

    @staticmethod
    def _message(alert: Alert, price: float, level: float | None) -> str:
        sym = alert.symbol
        if alert.type == PRICE_CROSSES_LEVEL:
            return f"{sym} crossed {level}"
        if alert.type == BAR_CLOSES_ABOVE:
            return f"{sym} bar closed above {level}"
        if alert.type == BAR_CLOSES_BELOW:
            return f"{sym} bar closed below {level}"
        if alert.type == VOLUME_DELTA_THRESHOLD:
            return f"{sym} volume delta threshold met"
        if alert.type == BIG_TRADE_THRESHOLD:
            return f"{sym} big trade threshold met"
        if alert.type == STACKED_IMBALANCE:
            return f"{sym} stacked imbalance"
        if alert.type in MGANN_BREAK_LS_TYPES:
            return f"{sym} mGann Break L/S"
        return f"{sym} alert"

    @staticmethod
    def _smc_message(alert: Alert, trigger: SmcStrategyTrigger) -> str:
        direction = "bullish" if trigger.setup.direction == 1 else "bearish"
        threshold = _fmt_num(AlertEngine._smc_big_trade_threshold(alert))
        level = _fmt_num(trigger.setup.level)
        volume = _fmt_num(trigger.big_trade_volume)
        return (
            f"{alert.symbol} external {direction} {trigger.setup.kind} "
            f"big trade {volume} > {threshold} at level {level}"
        )



def _positive_int_param(value: Any, default: int) -> int:
    if isinstance(value, bool):
        return default
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


def _mgann_swing_size_param(value: Any, default: int) -> int:
    parsed = _positive_int_param(value, default)
    return default if parsed == 2 else parsed


def _nonnegative_int_param(value: Any, default: int) -> int:
    if isinstance(value, bool):
        return default
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed >= 0 else default

def _positive_float_param(value: Any, default: float) -> float:
    if isinstance(value, bool):
        return default
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default

def _nonnegative_float_param(value: Any, default: float) -> float:
    if isinstance(value, bool):
        return default
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed >= 0 else default

def _fmt_num(value: int | float | None) -> str:
    if value is None:
        return "unknown"
    return f"{float(value):g}"

def _timeframe_label(timeframe: str) -> str:
    if timeframe.endswith("m"):
        return f"M{timeframe[:-1]}"
    return timeframe.upper()
