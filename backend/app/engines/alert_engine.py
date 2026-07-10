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

from dataclasses import dataclass, field
from typing import Any

from ..models.canonical import Side
from ..models.messages import AlertEvent
from ..models.timestamp import CanonicalTimestamp
from ..storage.cache_store import CacheStore
from ..storage.records import AlertEventRecord, AlertRecord
from .breakout_box_engine import BreakoutBoxEvent
from .mgann_fvg_retest import (
    MGANN_FVG_DEFAULT_MAX_ZONE_AGE,
    MGANN_FVG_DEFAULT_MIN_GAP_TICKS,
    MGANN_FVG_DEFAULT_RETEST_TOLERANCE_TICKS,
    MGANN_FVG_DEFAULT_SWING_SIZE,
    MGANN_FVG_RETEST_TIMEFRAME,
    MGANN_FVG_RETEST_TIMEFRAMES,
    MgannFvgRetestBar,
    MgannFvgRetestState,
)
from .mgann_big_trade_sweep import (
    MGANN_BIG_TRADE_SWEEP_DEFAULT_BIG_TRADE_THRESHOLD,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_BREAK_TICKS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_CONFIRMATION_BARS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_CUTS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_SPREAD_TICKS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_VOLUME,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_LOOKBACK_BARS,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_LOOKBACK,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_MULTIPLIER,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_SWING_SIZE,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_TIMEFRAME,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_LOOKBACK,
    MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_MULTIPLIER,
    MGANN_BIG_TRADE_SWEEP_TIMEFRAMES,
    MgannBigTradeSweepBar,
    MgannBigTradeSweepState,
    MgannBigTradeSweepTrigger,
)
from .smc_external import (
    SmcBar,
    SmcExternalBreakState,
    SmcStrategyTrigger,
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
    "MGANN_FVG_RETEST",
    "MGANN_FVG_RETEST_TIMEFRAME",
    "MGANN_FVG_RETEST_TIMEFRAMES",
    "MGANN_FVG_DEFAULT_SWING_SIZE",
    "MGANN_FVG_DEFAULT_MAX_ZONE_AGE",
    "MGANN_FVG_DEFAULT_MIN_GAP_TICKS",
    "MGANN_FVG_DEFAULT_RETEST_TOLERANCE_TICKS",
    "MGANN_BIG_TRADE_SWEEP",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_BIG_TRADE_THRESHOLD",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_BREAK_TICKS",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_CONFIRMATION_BARS",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_PIVOT_CUTS",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_SPREAD_TICKS",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_VOLUME",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_PIVOT_LOOKBACK_BARS",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_LOOKBACK",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_SPREAD_MULTIPLIER",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_SWING_SIZE",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_TIMEFRAME",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_LOOKBACK",
    "MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_MULTIPLIER",
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
MGANN_FVG_RETEST = "mgann_fvg_retest"
MGANN_BIG_TRADE_SWEEP = "mgann_big_trade_sweep"

SMC_DEFAULT_SWING_LENGTH = 50
SMC_DEFAULT_LOOKAHEAD_BARS = 5
SMC_DEFAULT_MAX_BARS = 20
SMC_DEFAULT_PAUSE_ON_INSIDE_BARS = True
SMC_DEFAULT_RETEST_TOLERANCE_TICKS = 50
_SMC_WARMUP_MIN_BARS = 300

ALERT_TYPES: frozenset[str] = frozenset(
    {
        PRICE_CROSSES_LEVEL,
        BAR_CLOSES_ABOVE,
        BAR_CLOSES_BELOW,
        VOLUME_DELTA_THRESHOLD,
        BIG_TRADE_THRESHOLD,
        STACKED_IMBALANCE,
        SMC_EXTERNAL_BREAK_BIG_TRADE,
        MGANN_FVG_RETEST,
        MGANN_BIG_TRADE_SWEEP,
    }
)

# Alert types whose ``params`` carry a numeric ``level`` reported on the event.
LEVEL_ALERT_TYPES: frozenset[str] = frozenset(
    {PRICE_CROSSES_LEVEL, BAR_CLOSES_ABOVE, BAR_CLOSES_BELOW}
)


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
        return cls(
            id=rec.id,
            symbol=rec.symbol,
            type=rec.type,
            params=dict(rec.params),
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
        self._mgann_fvg_state: dict[str, MgannFvgRetestState] = {}
        self._mgann_sweep_state: dict[str, MgannBigTradeSweepState] = {}
        if store is not None:
            for rec in store.read_alerts(profile_id=None):
                alert = Alert.from_record(rec)
                self._alerts[rec.id] = alert
                if alert.enabled:
                    self._warm_smc_alert(alert)

    # -- registration ---------------------------------------------------------

    def upsert(self, alert: Alert) -> Alert:
        """Register or replace an alert definition. (Req 16.1, 16.2)"""
        self._alerts[alert.id] = alert
        # Evaluation state is keyed by alert id; clear it so an edited alert
        # (e.g. a changed level) starts from a clean fire-once state.
        self._price_state.pop(alert.id, None)
        self._bar_state.pop(alert.id, None)
        self._smc_state.pop(alert.id, None)
        self._mgann_fvg_state.pop(alert.id, None)
        self._mgann_sweep_state.pop(alert.id, None)
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
            self._warm_smc_alert(alert)
        return alert

    def delete(self, alert_id: str) -> None:
        """Remove an alert definition and its evaluation state. (Req 16.3)"""
        self._alerts.pop(alert_id, None)
        self._price_state.pop(alert_id, None)
        self._bar_state.pop(alert_id, None)
        self._smc_state.pop(alert_id, None)
        self._mgann_fvg_state.pop(alert_id, None)
        self._mgann_sweep_state.pop(alert_id, None)
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
            self._mgann_fvg_state.pop(alert.id, None)
            self._mgann_sweep_state.pop(alert.id, None)
            self._warm_smc_alert(alert)
        self._persist_enabled(alert)

    def alerts(self) -> list[Alert]:
        """Return the registered alert definitions."""
        return list(self._alerts.values())

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
                self._store.insert_alert_event(
                    AlertEventRecord(
                        alert_id=ev.alert_id,
                        profile_id=ev.profile_id,
                        symbol=ev.symbol,
                        contract=ev.contract,
                        time=ev.time,
                        price=ev.price,
                        message=ev.message,
                    )
                )
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
        if alert.type == MGANN_FVG_RETEST:
            return self._eval_mgann_fvg_retest(alert, ctx)
        if alert.type == MGANN_BIG_TRADE_SWEEP:
            return self._eval_mgann_big_trade_sweep(alert, ctx)
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

    # -- mgann_fvg_retest -----------------------------------------------------

    def _eval_mgann_fvg_retest(
        self, alert: Alert, ctx: MarketContext
    ) -> list[AlertEvent]:
        timeframe = self._mgann_fvg_timeframe(alert)
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

        state = self._mgann_fvg_state_for(alert)
        triggers = state.on_closed_bar(
            MgannFvgRetestBar(
                time=ctx.bar_time,
                open=float(ctx.bar_open),
                high=float(ctx.bar_high),
                low=float(ctx.bar_low),
                close=float(ctx.bar_close),
                volume=int(ctx.bar_volume or 0),
            )
        )
        events: list[AlertEvent] = []
        for trigger in triggers:
            direction = "bullish" if trigger.direction == 1 else "bearish"
            tf_label = _timeframe_label(timeframe)
            message = (
                f"{alert.symbol} {tf_label} {direction} FVG retest by mGann wave "
                f"@ {trigger.price:g} zone "
                f"{trigger.zone_bottom:g}-{trigger.zone_top:g} "
                f"(wave {trigger.fvg_wave_index + 1} -> "
                f"{trigger.retest_wave_index + 1})"
            )
            events.append(
                AlertEvent(
                    alert_id=alert.id,
                    alert_type=alert.type,
                    symbol=ctx.symbol,
                    contract=ctx.contract,
                    time=ctx.time,
                    price=trigger.price,
                    message=message,
                    level=(trigger.zone_top + trigger.zone_bottom) / 2,
                    profile_id=alert.profile_id,
                )
            )
        return events

    # -- mgann_big_trade_sweep -----------------------------------------------

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
            )
        )
        events: list[AlertEvent] = []
        for trigger in triggers:
            events.append(self._make_mgann_sweep_event(alert, ctx, trigger))
        return events

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
        direction = "highs" if trigger.direction > 0 else "lows"
        tf_label = _timeframe_label(self._mgann_sweep_timeframe(alert))
        threshold = _fmt_num(self._mgann_sweep_big_trade_threshold(alert))
        message = (
            f"{alert.symbol} {tf_label} mGann {direction} breakout "
            f"{trigger.cut_count} pivots + BigTrade "
            f"{_fmt_num(trigger.big_trade_volume)} > {threshold}; "
            f"vol {trigger.bar_volume}, spread {trigger.bar_spread:.1f}"
        )
        return AlertEvent(
            alert_id=alert.id,
            alert_type=alert.type,
            symbol=ctx.symbol,
            contract=ctx.contract,
            time=trigger.signal_time,
            price=trigger.signal_price,
            message=message,
            level=sum(trigger.cut_levels) / len(trigger.cut_levels),
            profile_id=alert.profile_id,
            direction=trigger.direction,
        )

    def _smc_state_for(self, alert: Alert) -> SmcExternalBreakState:
        state = self._smc_state.get(alert.id)
        if state is None:
            state = self._new_smc_state(alert)
            self._smc_state[alert.id] = state
        return state


    def _mgann_fvg_state_for(self, alert: Alert) -> MgannFvgRetestState:
        state = self._mgann_fvg_state.get(alert.id)
        if state is None:
            state = self._new_mgann_fvg_state(alert)
            self._mgann_fvg_state[alert.id] = state
        return state

    def _mgann_sweep_state_for(self, alert: Alert) -> MgannBigTradeSweepState:
        state = self._mgann_sweep_state.get(alert.id)
        if state is None:
            state = self._new_mgann_sweep_state(alert)
            self._mgann_sweep_state[alert.id] = state
        return state

    def _warm_smc_alert(self, alert: Alert) -> None:
        if alert.type == MGANN_FVG_RETEST:
            self._warm_mgann_fvg_alert(alert)
            return
        if alert.type == MGANN_BIG_TRADE_SWEEP:
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


    def _warm_mgann_fvg_alert(self, alert: Alert) -> None:
        state = self._new_mgann_fvg_state(alert)
        if self._store is not None:
            for rec in self._store.read_bars(
                alert.symbol,
                alert.symbol,
                self._mgann_fvg_timeframe(alert),
                limit=self._mgann_fvg_warmup_bars(alert),
            ):
                if not rec.closed:
                    continue
                state.on_closed_bar(
                    MgannFvgRetestBar(
                        time=rec.time,
                        open=rec.open,
                        high=rec.high,
                        low=rec.low,
                        close=rec.close,
                        volume=rec.volume,
                    )
                )
        self._mgann_fvg_state[alert.id] = state

    def _warm_mgann_sweep_alert(self, alert: Alert) -> None:
        state = self._new_mgann_sweep_state(alert)
        if self._store is not None:
            for rec in self._store.read_bars(
                alert.symbol,
                alert.symbol,
                self._mgann_sweep_timeframe(alert),
                limit=self._mgann_sweep_warmup_bars(alert),
            ):
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


    def _new_mgann_fvg_state(self, alert: Alert) -> MgannFvgRetestState:
        return MgannFvgRetestState(
            swing_size=self._mgann_fvg_swing_size(alert),
            max_zone_age=self._mgann_fvg_max_zone_age(alert),
            min_gap_ticks=self._mgann_fvg_min_gap_ticks(alert),
            retest_tolerance_ticks=self._mgann_fvg_retest_tolerance_ticks(alert),
        )

    def _new_mgann_sweep_state(self, alert: Alert) -> MgannBigTradeSweepState:
        return MgannBigTradeSweepState(
            timeframe=self._mgann_sweep_timeframe(alert),
            big_trade_threshold=self._mgann_sweep_big_trade_threshold(alert),
            min_volume=self._mgann_sweep_min_volume(alert),
            volume_lookback=self._mgann_sweep_volume_lookback(alert),
            volume_multiplier=self._mgann_sweep_volume_multiplier(alert),
            min_spread_ticks=self._mgann_sweep_min_spread_ticks(alert),
            spread_lookback=self._mgann_sweep_spread_lookback(alert),
            spread_multiplier=self._mgann_sweep_spread_multiplier(alert),
            swing_size=self._mgann_sweep_swing_size(alert),
            pivot_lookback_bars=self._mgann_sweep_pivot_lookback_bars(alert),
            min_pivot_cuts=self._mgann_sweep_min_pivot_cuts(alert),
            confirmation_bars=self._mgann_sweep_confirmation_bars(alert),
            break_ticks=self._mgann_sweep_break_ticks(alert),
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


    def _mgann_fvg_warmup_bars(self, alert: Alert) -> int:
        max_zone_age = self._mgann_fvg_max_zone_age(alert)
        if max_zone_age <= 0:
            return max(2_000, self._mgann_fvg_swing_size(alert) * 8 + 40)
        return max(
            max_zone_age + 80,
            self._mgann_fvg_swing_size(alert) * 8 + 40,
        )

    @staticmethod
    def _mgann_fvg_swing_size(alert: Alert) -> int:
        return _positive_int_param(
            alert.params.get("swingSize"),
            MGANN_FVG_DEFAULT_SWING_SIZE,
        )

    @staticmethod
    def _mgann_fvg_max_zone_age(alert: Alert) -> int:
        return _nonnegative_int_param(
            alert.params.get("maxZoneAge"),
            MGANN_FVG_DEFAULT_MAX_ZONE_AGE,
        )

    @staticmethod
    def _mgann_fvg_min_gap_ticks(alert: Alert) -> int:
        return _nonnegative_int_param(
            alert.params.get("minGapTicks"),
            MGANN_FVG_DEFAULT_MIN_GAP_TICKS,
        )

    @staticmethod
    def _mgann_fvg_retest_tolerance_ticks(alert: Alert) -> int:
        return _nonnegative_int_param(
            alert.params.get("retestToleranceTicks"),
            MGANN_FVG_DEFAULT_RETEST_TOLERANCE_TICKS,
        )

    @staticmethod
    def _mgann_fvg_timeframe(alert: Alert) -> str:
        raw = alert.params.get("timeframe", MGANN_FVG_RETEST_TIMEFRAME)
        if isinstance(raw, str) and raw in MGANN_FVG_RETEST_TIMEFRAMES:
            return raw
        return MGANN_FVG_RETEST_TIMEFRAME

    def _mgann_sweep_warmup_bars(self, alert: Alert) -> int:
        return max(
            500,
            self._mgann_sweep_pivot_lookback_bars(alert)
            + self._mgann_sweep_volume_lookback(alert)
            + self._mgann_sweep_spread_lookback(alert)
            + self._mgann_sweep_confirmation_bars(alert)
            + self._mgann_sweep_swing_size(alert) * 8
            + 40,
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
    def _mgann_sweep_min_volume(alert: Alert) -> int:
        return _nonnegative_int_param(
            alert.params.get("minVolume"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_MIN_VOLUME,
        )

    @staticmethod
    def _mgann_sweep_volume_lookback(alert: Alert) -> int:
        return _positive_int_param(
            alert.params.get("volumeLookback"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_LOOKBACK,
        )

    @staticmethod
    def _mgann_sweep_volume_multiplier(alert: Alert) -> float:
        return _positive_float_param(
            alert.params.get("volumeMultiplier"),
            MGANN_BIG_TRADE_SWEEP_DEFAULT_VOLUME_MULTIPLIER,
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
        return _positive_int_param(
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
        if alert.type == MGANN_BIG_TRADE_SWEEP:
            return f"{sym} mGann BigTrade sweep"
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

def _fmt_num(value: int | float | None) -> str:
    if value is None:
        return "unknown"
    return f"{float(value):g}"

def _timeframe_label(timeframe: str) -> str:
    if timeframe.endswith("m"):
        return f"M{timeframe[:-1]}"
    return timeframe.upper()
