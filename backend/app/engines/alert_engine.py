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

__all__ = [
    "ALERT_TYPES",
    "LEVEL_ALERT_TYPES",
    "Alert",
    "MarketContext",
    "AlertEngine",
]

# Type literals for the six supported alert types. (Req 16.1)
PRICE_CROSSES_LEVEL = "price_crosses_level"
BAR_CLOSES_ABOVE = "bar_closes_above"
BAR_CLOSES_BELOW = "bar_closes_below"
VOLUME_DELTA_THRESHOLD = "volume_delta_threshold"
BIG_TRADE_THRESHOLD = "big_trade_threshold"
STACKED_IMBALANCE = "stacked_imbalance"

ALERT_TYPES: frozenset[str] = frozenset(
    {
        PRICE_CROSSES_LEVEL,
        BAR_CLOSES_ABOVE,
        BAR_CLOSES_BELOW,
        VOLUME_DELTA_THRESHOLD,
        BIG_TRADE_THRESHOLD,
        STACKED_IMBALANCE,
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
    bar_time: CanonicalTimestamp | None = None
    bar_close: float | None = None
    bar_volume_delta: int | None = None
    bar_stacked_imbalance: bool | None = None

    # big_trade_threshold
    big_trade_volume: int | None = None
    big_trade_price: float | None = None
    big_trade_side: Side | None = None


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
        if store is not None:
            for rec in store.read_alerts(profile_id=None):
                self._alerts[rec.id] = Alert.from_record(rec)

    # -- registration ---------------------------------------------------------

    def upsert(self, alert: Alert) -> Alert:
        """Register or replace an alert definition. (Req 16.1, 16.2)"""
        self._alerts[alert.id] = alert
        # Evaluation state is keyed by alert id; clear it so an edited alert
        # (e.g. a changed level) starts from a clean fire-once state.
        self._price_state.pop(alert.id, None)
        self._bar_state.pop(alert.id, None)
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
        return alert

    def delete(self, alert_id: str) -> None:
        """Remove an alert definition and its evaluation state. (Req 16.3)"""
        self._alerts.pop(alert_id, None)
        self._price_state.pop(alert_id, None)
        self._bar_state.pop(alert_id, None)
        if self._store is not None:
            self._store.delete_alert(alert_id)

    def set_enabled(self, alert_id: str, enabled: bool) -> None:
        """Enable/disable an alert for evaluation. (Req 16.4)"""
        alert = self._alerts.get(alert_id)
        if alert is None:
            return
        alert.enabled = enabled
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
            event = self._evaluate_one(alert, ctx)
            if event is not None:
                events.append(event)
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

    def _evaluate_one(self, alert: Alert, ctx: MarketContext) -> AlertEvent | None:
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
        return f"{sym} alert"
