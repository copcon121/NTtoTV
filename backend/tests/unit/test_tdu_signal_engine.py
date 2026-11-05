"""Tests for the clean-room TDU momentum/divergence port."""

from __future__ import annotations

import pytest

from app.engines.tdu_signal_engine import TduSignalEngine
from app.models.canonical import NormalizedTrade, Side


_BASE = 1_800_000_000_000


def _trade(
    offset_ms: int,
    *,
    price: float = 100.0,
    volume: int = 10,
    buy: bool = False,
) -> NormalizedTrade:
    bid = price if not buy else price - 0.1
    ask = price if buy else price + 0.1
    return NormalizedTrade(
        symbol="GC",
        contract="GC",
        time=_BASE + offset_ms,
        price=price,
        volume=volume,
        bid=bid,
        ask=ask,
        best_bid=bid,
        best_ask=ask,
        sequence=offset_ms,
    )


@pytest.mark.unit
def test_momentum_uses_fifteen_ten_second_buckets_and_prior_tick_direction():
    engine = TduSignalEngine(timeframes=("1m",))

    # Fifteen identical completed buckets have sigma zero, so the original's
    # highest 6-sigma test resolves to level 3.  All prior trades are sells.
    for index in range(15):
        engine.on_trade(_trade(index * 10_000))

    # This buy opens the next 10-second bucket. It must not affect the direction
    # read at the boundary; the containing 1m bar was still net-sell beforehand.
    events = engine.on_trade(
        _trade(150_000, price=101.0, volume=100, buy=True)
    )
    signal = next(event for event in events if event.momentum_level)

    assert signal.time == _BASE + 120_000
    assert signal.momentum_level == 3
    assert signal.momentum_direction == -1


@pytest.mark.unit
def test_momentum_on_new_chart_bar_resolves_zero_delta_as_buy():
    engine = TduSignalEngine(timeframes=("1m",))

    for index in range(15):
        engine.on_trade(_trade(30_000 + index * 10_000))

    events = engine.on_trade(_trade(180_000, buy=True))
    signal = next(event for event in events if event.momentum_level)

    assert signal.time == _BASE + 180_000
    assert signal.momentum_level == 3
    assert signal.momentum_direction == 1


@pytest.mark.unit
def test_candle_color_delta_divergence_sets_flips_and_clears():
    engine = TduSignalEngine(timeframes=("1m",))

    engine.on_trade(_trade(0, price=100.0, volume=10, buy=True))
    bearish = engine.on_trade(_trade(1_000, price=99.0, volume=1, buy=True))[-1]
    bullish = engine.on_trade(_trade(2_000, price=101.0, volume=20))[-1]
    cleared = engine.on_trade(_trade(3_000, price=100.0, volume=1))[-1]

    assert bearish.delta_divergence == -1
    assert bullish.delta_divergence == 1
    assert cleared.delta_divergence == 0


@pytest.mark.unit
def test_exchange_aggressor_side_is_used_when_bookmap_has_no_quote_snapshot():
    engine = TduSignalEngine(timeframes=("1m",))
    first = _trade(0, price=100.0, volume=10, buy=True)
    first.bid = None
    first.ask = None
    first.side = Side.BUY
    second = _trade(1_000, price=99.0, volume=1, buy=True)
    second.bid = None
    second.ask = None
    second.side = Side.BUY

    engine.on_trade(first)
    event = engine.on_trade(second)[-1]

    assert event.delta_divergence == -1


@pytest.mark.unit
def test_below_default_bucket_is_emitted_for_custom_lower_thresholds():
    engine = TduSignalEngine(timeframes=("1m",), stddev_period=3)
    for index, volume in enumerate((10, 20, 30)):
        engine.on_trade(_trade(index * 10_000, volume=volume))
    signal = engine.on_trade(_trade(30_000, volume=1))[0]
    assert signal.momentum_level == 0
    assert signal.momentum_samples == [(30, pytest.approx((200 / 3) ** 0.5), -1)]
    assert engine.current_updates("GC", "GC")[0].momentum_samples == signal.momentum_samples


@pytest.mark.unit
def test_strength_frontier_preserves_highest_level_and_latest_qualifying_direction(monkeypatch):
    engine = TduSignalEngine(timeframes=("1m",))
    samples = iter(((3, 60, 10.0), (1, 40, 10.0), (0, 20, 10.0), (2, 50, 10.0)))
    monkeypatch.setattr(engine, "_roll_momentum_bucket", lambda _: next(samples))
    first = engine.on_trade(_trade(0, volume=10))[0]
    for index in range(1, 4):
        latest = engine.on_trade(_trade(index * 1_000, volume=10))[0]
    assert latest.momentum_level == 3
    assert latest.momentum_direction == -1
    assert latest.momentum_samples == [(60, 10.0, 1), (50, 10.0, -1)]
    assert first.momentum_samples == [(60, 10.0, 1)]  # Queued events remain immutable.


@pytest.mark.unit
def test_samples_survive_seed_and_clear_on_next_bar():
    engine = TduSignalEngine(timeframes=("1m",))
    samples = [(80, 10.0, -1)]
    engine.seed_bar("GC", "1m", time=_BASE, open=100, high=101, low=99,
                    close=100, delta=0, momentum_samples=samples)
    samples.clear()
    assert engine.current_updates("GC", "GC")[0].momentum_samples == [(80, 10.0, -1)]
    engine.on_trade(_trade(60_000))
    assert engine.current_updates("GC", "GC") == []


@pytest.mark.unit
def test_legacy_cache_migrates_samples_without_losing_old_signals(tmp_path):
    import sqlite3
    from dataclasses import replace
    from app.storage.cache_store import CacheStore

    db = tmp_path / "app.sqlite"
    with sqlite3.connect(db) as conn:
        conn.execute("""CREATE TABLE tdu_signals (
            symbol TEXT, contract TEXT, timeframe TEXT, time INTEGER,
            momentum_direction INTEGER, momentum_level INTEGER, delta_divergence INTEGER,
            PRIMARY KEY(symbol, contract, timeframe, time))""")
        conn.execute("INSERT INTO tdu_signals VALUES ('GC','GC','1m',?,1,3,0)", (_BASE,))
    cache = CacheStore(db)
    try:
        old = cache.read_tdu_signals("GC", "GC", "1m")[0]
        assert old.momentum_samples is None
        assert old.momentum_level == 3
        cache.upsert_tdu_signal(replace(old, momentum_samples=[(60, 10.0, -1)]))
    finally:
        cache.close()
    reopened = CacheStore(db)
    try:
        restored = reopened.read_tdu_signals("GC", "GC", "1m")[0]
        assert restored.momentum_samples == [(60, 10.0, -1)]
        assert restored.momentum_level == 3
    finally:
        reopened.close()
