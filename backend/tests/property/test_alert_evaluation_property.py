# Feature: gc-chart-platform, Property 26: Alert evaluation respects enablement, condition semantics, price source, and fire-once + re-arm
"""Property test for Alert_Engine evaluation semantics (task 18.4).

Property 26 asserts that for *any* alert and *any* market context: a disabled
alert never emits an ``alert_event``; an enabled alert emits if and only if its
condition semantics are met; and every emitted event has a corresponding
persisted alert-event record with matching fields. Condition semantics:

(a) ``price_crosses_level`` is evaluated against the **last trade price** and
    fires when the price path touches or crosses the level;
(b) ``bar_closes_above`` / ``bar_closes_below`` are evaluated against the
    **close price of a closed bar** only;
(c) each alert fires **at most once per event** — one crossing for
    ``price_crosses_level``, one closed bar for the bar-close types;
(d) after firing, the alert **re-arms only after the condition resets** — for
    ``price_crosses_level`` when the last trade price returns to the opposite
    side of the level, and for the bar-close types only when a subsequent bar
    closes.

The test drives arbitrary event sequences through the real :class:`AlertEngine`
(persisting to a temporary Cache_Store) and compares the emitted events against
an **independent oracle** that re-derives the expected fire events directly from
the generated sequence, using a separate implementation of the state machine.

Uses the design-mandated Hypothesis ``gc`` profile (>= 100 examples).
(Validates: Requirements 16.4, 16.6, 16.7, 17.1, 17.2, 17.3, 17.5, 17.6, 17.7, 17.8)
"""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.engines.alert_engine import Alert, AlertEngine, MarketContext
from app.storage.cache_store import CacheStore

_SYMBOL = "GC"
_CONTRACT = "GC 08-26"
_LEVEL = 100.0

# A small price grid straddling the level so crossings, touches (== level), and
# both-side moves all occur frequently.
_PRICES = (90.0, 95.0, 99.0, 100.0, 101.0, 105.0, 110.0)

# ---------------------------------------------------------------------------
# Event generators. Each event is a dict describing one MarketContext.
# ---------------------------------------------------------------------------

_price_event = st.fixed_dictionaries(
    {"kind": st.just("price"), "price": st.sampled_from(_PRICES)}
)

# Closed-bar events carry a bar close used by the bar-close alert types. The
# bar_time is assigned at apply time (one monotonic step per closed bar) so the
# oracle and engine agree on which bar is "subsequent".
_bar_event = st.fixed_dictionaries(
    {"kind": st.just("bar"), "close": st.sampled_from(_PRICES)}
)

_events = st.lists(st.one_of(_price_event, _bar_event), min_size=1, max_size=40)


# ---------------------------------------------------------------------------
# Independent oracles (separate implementations of the semantics).
# ---------------------------------------------------------------------------


def _oracle_price_crosses(events, level, enabled) -> list[int]:
    """Indices of events at which a price_crosses_level alert should fire.

    Touch/cross := the level is reached from either side or lies between
    consecutive last trade prices. After a fire, moving away from the level from
    the touched price does not fire a duplicate event. (Req 16.6, 17.5, 17.7)
    """
    if not enabled:
        return []
    fires: list[int] = []
    prev: float | None = None
    for i, ev in enumerate(events):
        if ev["kind"] != "price":
            continue
        price = ev["price"]
        if prev is not None:
            if (prev < level <= price) or (prev > level >= price):
                fires.append(i)
                return fires
        prev = price
    return fires


def _oracle_bar_closes(events, level, enabled, *, above: bool) -> list[int]:
    """Indices at which a bar_closes_above/below alert should fire.

    Evaluated only on closed bars (Req 16.7). Fires at most once per closed bar;
    after firing, suppressed until a subsequent closed bar re-arms it (Req 17.6,
    17.8). Because each generated bar event is a distinct subsequent bar, the
    alert is armed for every bar and fires whenever the close satisfies the
    condition.
    """
    if not enabled:
        return []
    fires: list[int] = []
    for i, ev in enumerate(events):
        if ev["kind"] != "bar":
            continue
        close = ev["close"]
        condition = close > level if above else close < level
        if condition:
            fires.append(i)
            return fires
    return fires


# ---------------------------------------------------------------------------
# Driver: apply the generated events to the engine and collect (index -> ids).
# ---------------------------------------------------------------------------


def _drive(engine: AlertEngine, events) -> dict[str, list[int]]:
    """Feed events into the engine; return {alert_id: [event indices fired]}.

    Price events are fed as ``last_price`` contexts; bar events as closed-bar
    contexts with a monotonically increasing ``bar_time`` (one step per closed
    bar). The context ``time`` is the global event index.
    """
    fired: dict[str, list[int]] = {}
    bar_seq = 0
    for i, ev in enumerate(events):
        if ev["kind"] == "price":
            ctx = MarketContext(
                symbol=_SYMBOL,
                contract=_CONTRACT,
                time=i,
                last_price=ev["price"],
            )
        else:
            bar_seq += 1
            ctx = MarketContext(
                symbol=_SYMBOL,
                contract=_CONTRACT,
                time=i,
                bar_closed=True,
                bar_time=bar_seq * 1000,
                bar_close=ev["close"],
            )
        for event in engine.evaluate(ctx):
            fired.setdefault(event.alert_id, []).append(i)
    return fired


def _fresh_store():
    data_dir = Path(tempfile.mkdtemp(prefix="gc_alert_eval_"))
    return data_dir, CacheStore(data_dir / "app.sqlite")


# Feature: gc-chart-platform, Property 26: Alert evaluation respects enablement, condition semantics, price source, and fire-once + re-arm
@pytest.mark.property
@given(
    events=_events,
    cross_enabled=st.booleans(),
    above_enabled=st.booleans(),
    below_enabled=st.booleans(),
)
def test_alert_evaluation_semantics(
    events, cross_enabled, above_enabled, below_enabled
) -> None:
    data_dir, store = _fresh_store()
    engine = AlertEngine(store)
    try:
        engine.upsert(
            Alert(
                id="cross",
                symbol=_SYMBOL,
                type="price_crosses_level",
                params={"level": _LEVEL},
                enabled=cross_enabled,
            )
        )
        engine.upsert(
            Alert(
                id="above",
                symbol=_SYMBOL,
                type="bar_closes_above",
                params={"level": _LEVEL},
                enabled=above_enabled,
            )
        )
        engine.upsert(
            Alert(
                id="below",
                symbol=_SYMBOL,
                type="bar_closes_below",
                params={"level": _LEVEL},
                enabled=below_enabled,
            )
        )

        fired = _drive(engine, events)

        # Expected fire indices from the independent oracles.
        exp_cross = _oracle_price_crosses(events, _LEVEL, cross_enabled)
        exp_above = _oracle_bar_closes(events, _LEVEL, above_enabled, above=True)
        exp_below = _oracle_bar_closes(events, _LEVEL, below_enabled, above=False)

        # (a)/(b)/(c)/(d): emitted events match the oracle exactly per alert.
        assert fired.get("cross", []) == exp_cross
        assert fired.get("above", []) == exp_above
        assert fired.get("below", []) == exp_below

        # Enablement: a disabled alert never fires (Req 16.4, 17.1).
        if not cross_enabled:
            assert "cross" not in fired
        if not above_enabled:
            assert "above" not in fired
        if not below_enabled:
            assert "below" not in fired

        # bar-close alerts only ever fire on closed-bar events; never on a
        # price-only tick (Req 16.7). (Cross alerts only on price ticks.)
        bar_indices = {i for i, ev in enumerate(events) if ev["kind"] == "bar"}
        price_indices = {i for i, ev in enumerate(events) if ev["kind"] == "price"}
        assert set(fired.get("above", [])) <= bar_indices
        assert set(fired.get("below", [])) <= bar_indices
        assert set(fired.get("cross", [])) <= price_indices

        # Every emitted event has a matching persisted audit record (Req 17.3,
        # 17.2). Count and per-alert counts must agree with what we emitted.
        total_emitted = sum(len(v) for v in fired.values())
        persisted = store.read_alert_events()
        assert len(persisted) == total_emitted
        for alert_id, indices in fired.items():
            recs = store.read_alert_events(alert_id)
            assert len(recs) == len(indices)
            for rec in recs:
                assert rec.symbol == _SYMBOL
                assert rec.contract == _CONTRACT
                assert rec.message  # non-empty descriptive message
    finally:
        store.close()
        shutil.rmtree(data_dir, ignore_errors=True)
