from __future__ import annotations

from pathlib import Path

import pytest

from app.engines.alert_engine import (
    SUPERTREND_DIRECTION_CHANGE,
    Alert,
    AlertEngine,
    MarketContext,
)
from app.storage.cache_store import CacheStore
from app.storage.records import BarRecord

_BASE = 1_753_200_000_000


def _context(time: int, open_: float, high: float, low: float, close: float):
    return MarketContext(
        symbol="GC",
        contract="GC 12-26",
        time=time + 59_999,
        bar_closed=True,
        bar_tf="1m",
        bar_time=time,
        bar_open=open_,
        bar_high=high,
        bar_low=low,
        bar_close=close,
        bar_volume=10,
    )


def _alert() -> Alert:
    return Alert(
        id="st",
        symbol="GC",
        type=SUPERTREND_DIRECTION_CHANGE,
        params={
            "timeframe": "1m",
            "period": 1,
            "multiplier": 1.0,
            "atrMethod": "rma",
            "source": "hl2",
            "direction": "both",
            "repeat": True,
        },
    )


@pytest.mark.unit
def test_warmup_uses_closed_logical_bars_and_dedupes_persisted_bar(tmp_path: Path):
    cache = CacheStore(tmp_path / "app.sqlite")
    try:
        cache.upsert_bars(
            [
                BarRecord(
                    symbol="GC",
                    contract="GC",
                    timeframe="1m",
                    time=_BASE,
                    open=10.0,
                    high=11.0,
                    low=9.0,
                    close=10.0,
                    volume=10,
                    closed=True,
                    source="bookmap",
                ),
                BarRecord(
                    symbol="GC",
                    contract="GC",
                    timeframe="1m",
                    time=_BASE + 60_000,
                    open=100.0,
                    high=101.0,
                    low=99.0,
                    close=100.0,
                    volume=1,
                    closed=False,
                    source="bookmap",
                ),
            ]
        )
        engine = AlertEngine(cache)
        engine.upsert(_alert())
        ctx = _context(_BASE + 60_000, 8.0, 9.0, 7.0, 7.9)

        events = engine.evaluate(ctx)

        assert len(events) == 1
        assert events[0].time == ctx.bar_time
        assert events[0].direction == -1
        assert events[0].message.endswith("Supertrend Sell")
        assert engine.evaluate(ctx) == []
        assert len(cache.read_alert_events("st", "default")) == 1

        # Simulate a restart where the audit event survived but the signal bar
        # itself was not yet in cache. Persistent alert/bar identity still
        # prevents replaying the notification.
        restarted = AlertEngine(cache)
        assert restarted.evaluate(ctx) == []
        assert len(cache.read_alert_events("st", "default")) == 1
    finally:
        cache.close()


@pytest.mark.unit
def test_rollover_cutoff_and_playback_reset_have_distinct_semantics():
    engine = AlertEngine()
    engine.upsert(_alert())
    engine.evaluate(_context(100, 10.0, 11.0, 9.0, 10.0))

    engine.reset_supertrend(warm_from=500)
    assert engine.evaluate(_context(400, 8.0, 9.0, 7.0, 7.0)) == []
    # The first complete new-contract bar seeds state and cannot turn the roll
    # gap itself into a signal.
    assert engine.evaluate(_context(500, 100.0, 101.0, 99.0, 100.0)) == []

    engine.reset_supertrend()
    assert engine.evaluate(_context(100, 10.0, 11.0, 9.0, 10.0)) == []
    replayed = engine.evaluate(_context(200, 8.0, 9.0, 7.0, 7.9))
    assert [event.direction for event in replayed] == [-1]

