from app.engines.alert_engine import (
    SMC_EXTERNAL_BREAK_BIG_TRADE,
    Alert,
    AlertEngine,
    MarketContext,
)
from app.engines.smc_external import SmcBar, SmcExternalDetector
from app.storage.cache_store import CacheStore
from app.storage.records import AlertRecord, BarRecord

_SYMBOL = "GC"
_CONTRACT = "GC"
_STEP = 60_000


def _bar(i: int, high: float, low: float, close: float, open_: float | None = None):
    return SmcBar(
        time=i * _STEP,
        open=close if open_ is None else open_,
        high=high,
        low=low,
        close=close,
    )


def _bullish_bos_bars(length: int = 50) -> list[SmcBar]:
    bars = [_bar(0, high=99, low=91, close=95)]
    bars.append(_bar(1, high=100, low=90, close=95))
    bars.extend(_bar(i, high=99, low=91, close=95) for i in range(2, length + 2))
    bars.append(_bar(length + 2, high=102, low=94, close=101))
    return bars


def _bearish_bos_bars(length: int = 50) -> list[SmcBar]:
    bars = [_bar(0, high=99, low=91, close=95)]
    bars.append(_bar(1, high=98, low=90, close=95))
    bars.extend(_bar(i, high=99, low=91, close=95) for i in range(2, length + 2))
    bars.append(_bar(length + 2, high=96, low=88, close=89))
    return bars


def _bearish_then_bullish_choch_bars(length: int = 50) -> list[SmcBar]:
    bars = _bearish_bos_bars(length)
    start = len(bars)
    bars.append(_bar(start, high=110, low=85, close=95))
    bars.extend(
        _bar(i, high=109, low=86, close=95)
        for i in range(start + 1, start + length + 1)
    )
    bars.append(_bar(start + length + 1, high=112, low=94, close=111))
    return bars


def _bar_ctx(bar: SmcBar) -> MarketContext:
    return MarketContext(
        symbol=_SYMBOL,
        contract=_CONTRACT,
        time=bar.time,
        bar_closed=True,
        bar_time=bar.time,
        bar_open=bar.open,
        bar_high=bar.high,
        bar_low=bar.low,
        bar_close=bar.close,
    )


def _big_trade_ctx(time: int, volume: int, price: float = 101.5) -> MarketContext:
    return MarketContext(
        symbol=_SYMBOL,
        contract=_CONTRACT,
        time=time,
        big_trade_volume=volume,
        big_trade_price=price,
    )


def _engine(repeat: bool = True) -> AlertEngine:
    engine = AlertEngine()
    params = {
        "bigTradeThreshold": 50,
        "swingLength": 50,
        "lookaheadBars": 5,
        "effectiveLookaheadBars": 5,
        "maxBars": 20,
        "pauseOnInsideBars": True,
        "retestToleranceTicks": 50,
    }
    if repeat:
        params["repeat"] = True
    engine.upsert(
        Alert(
            id="smc",
            symbol=_SYMBOL,
            type=SMC_EXTERNAL_BREAK_BIG_TRADE,
            params=params,
        )
    )
    return engine


def _feed_bars(engine: AlertEngine, bars: list[SmcBar]):
    events = []
    for bar in bars:
        events.extend(engine.evaluate(_bar_ctx(bar)))
    return events


def test_external_detector_detects_bullish_bos_length_50():
    detector = SmcExternalDetector(50)
    events = [detector.update(bar) for bar in _bullish_bos_bars()]

    event = events[-1]
    assert event is not None
    assert event.kind == "BOS"
    assert event.direction == 1
    assert event.level == 100


def test_external_detector_detects_bearish_bos_length_50():
    detector = SmcExternalDetector(50)
    events = [detector.update(bar) for bar in _bearish_bos_bars()]

    event = events[-1]
    assert event is not None
    assert event.kind == "BOS"
    assert event.direction == -1
    assert event.level == 90


def test_external_detector_detects_bullish_choch_after_bearish_trend():
    detector = SmcExternalDetector(50)
    events = [
        event
        for bar in _bearish_then_bullish_choch_bars()
        if (event := detector.update(bar)) is not None
    ]

    assert [(event.kind, event.direction) for event in events] == [
        ("BOS", -1),
        ("CHoCH", 1),
    ]


def test_external_detector_does_not_duplicate_crossed_pivot():
    detector = SmcExternalDetector(50)
    bars = _bullish_bos_bars()
    bars.append(_bar(len(bars), high=103, low=98, close=102))
    events = [
        event
        for bar in bars
        if (event := detector.update(bar)) is not None
    ]

    assert len(events) == 1
    assert events[0].kind == "BOS"


def test_strategy_fires_on_big_trade_greater_than_threshold_within_window():
    engine = _engine()
    assert _feed_bars(engine, _bullish_bos_bars()) == []

    event = engine.evaluate(_big_trade_ctx(52 * _STEP, volume=51, price=101.5))

    assert len(event) == 1
    assert event[0].alert_id == "smc"
    assert event[0].level == 100
    assert "big trade 51 > 50" in event[0].message
    assert engine.alerts()[0].enabled is True


def test_strategy_does_not_fire_when_big_trade_equals_threshold():
    engine = _engine()
    assert _feed_bars(engine, _bullish_bos_bars()) == []

    assert engine.evaluate(_big_trade_ctx(52 * _STEP, volume=50)) == []


def test_strategy_keeps_pending_setup_on_near_retest():
    engine = _engine()
    bars = _bullish_bos_bars()
    assert _feed_bars(engine, bars) == []

    retest = _bar(len(bars), high=102, low=99, close=100)
    assert engine.evaluate(_bar_ctx(retest)) == []

    event = engine.evaluate(_big_trade_ctx((len(bars) + 1) * _STEP, volume=80))
    assert len(event) == 1
    assert "big trade 80 > 50" in event[0].message

def test_strategy_cancels_pending_setup_on_deep_reclaim_without_alert():
    engine = _engine()
    bars = _bullish_bos_bars()
    assert _feed_bars(engine, bars) == []

    deep_reclaim = _bar(len(bars), high=102, low=94, close=94.8)
    assert engine.evaluate(_bar_ctx(deep_reclaim)) == []

    event = engine.evaluate(_big_trade_ctx((len(bars) + 1) * _STEP, volume=80))
    assert event == []


def test_strategy_expires_after_fifth_progress_closed_bar():
    engine = _engine()
    bars = _bullish_bos_bars()
    assert _feed_bars(engine, bars) == []

    start = len(bars)
    for i in range(start, start + 5):
        assert engine.evaluate(_bar_ctx(_bar(i, high=104, low=101, close=103))) == []

    assert engine.evaluate(_big_trade_ctx((start + 5) * _STEP, volume=80)) == []


def test_strategy_keeps_bearish_setup_alive_through_inside_bars_then_cancels_on_deep_reclaim():
    engine = _engine()
    bars = _bearish_bos_bars()
    assert _feed_bars(engine, bars) == []

    start = len(bars)
    for i in range(start, start + 10):
        inside = _bar(i, high=95, low=88.5, close=89.5)
        assert engine.evaluate(_bar_ctx(inside)) == []

    reclaim = _bar(start + 10, high=95.2, low=89, close=95.2)
    assert engine.evaluate(_bar_ctx(reclaim)) == []

    event = engine.evaluate(_big_trade_ctx((start + 11) * _STEP, volume=80))
    assert event == []


def test_strategy_hard_cap_expires_sideways_setup():
    engine = _engine()
    bars = _bearish_bos_bars()
    assert _feed_bars(engine, bars) == []

    start = len(bars)
    for i in range(start, start + 20):
        inside = _bar(i, high=95, low=88.5, close=89.5)
        assert engine.evaluate(_bar_ctx(inside)) == []

    event = engine.evaluate(_big_trade_ctx((start + 20) * _STEP, volume=80))
    assert event == []


def test_strategy_repeat_false_disables_after_first_event():
    engine = _engine(repeat=False)
    assert _feed_bars(engine, _bullish_bos_bars()) == []

    event = engine.evaluate(_big_trade_ctx(52 * _STEP, volume=60))

    assert [ev.alert_id for ev in event] == ["smc"]
    assert engine.alerts()[0].enabled is False


def test_strategy_warms_pending_setup_from_cached_bars(tmp_path):
    cache = CacheStore(tmp_path / "app.sqlite")
    try:
        cache.upsert_alert(
            AlertRecord(
                id="smc",
                profile_id="default",
                symbol=_SYMBOL,
                type=SMC_EXTERNAL_BREAK_BIG_TRADE,
                params={
                    "bigTradeThreshold": 50,
                    "swingLength": 50,
                    "lookaheadBars": 5,
                    "effectiveLookaheadBars": 5,
                    "maxBars": 20,
                    "pauseOnInsideBars": True,
                    "repeat": True,
                },
                enabled=True,
            )
        )
        cache.upsert_bars(
            BarRecord(
                symbol=_SYMBOL,
                contract=_CONTRACT,
                timeframe="1m",
                time=bar.time,
                open=bar.open,
                high=bar.high,
                low=bar.low,
                close=bar.close,
                volume=1,
                closed=True,
            )
            for bar in _bullish_bos_bars()
        )

        engine = AlertEngine(cache)
        event = engine.evaluate(_big_trade_ctx(53 * _STEP, volume=60))

        assert [ev.alert_id for ev in event] == ["smc"]
        assert event[0].level == 100
    finally:
        cache.close()


