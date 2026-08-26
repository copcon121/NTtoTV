from app.engines.alert_engine import (
    LIQUIDITY_POOL_BREAK,
    SMC_EXTERNAL_BREAK_BIG_TRADE,
    Alert,
    AlertEngine,
    MarketContext,
)
from app.engines.smc_external import SmcBar, SmcExternalDetector
from app.engines.mgann_big_trade_sweep import (
    MgannBigTradeSweepBar,
    MgannBigTradeSweepState,
)
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


def _bar_ctx(bar: SmcBar, timeframe: str | None = None) -> MarketContext:
    return MarketContext(
        symbol=_SYMBOL,
        contract=_CONTRACT,
        time=bar.time,
        bar_closed=True,
        bar_tf=timeframe,
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


def _feed_bars(
    engine: AlertEngine,
    bars: list[SmcBar],
    timeframe: str | None = None,
):
    events = []
    for bar in bars:
        events.extend(engine.evaluate(_bar_ctx(bar, timeframe)))
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


def _liquidity_choch_bars(close_through: bool) -> list[SmcBar]:
    bars = [_bar(i, high=99, low=91, close=95) for i in range(10)]
    sequence = [
        (100, 95, 98),
        (99, 94, 96),
        (94, 90, 92),
        (95, 91, 93),
        (100.2, 94, 99),
        (99, 93, 96),
        (94, 90.2, 93),
        (95, 91.2, 94),
        (91, 85 if close_through else 88, 85.5 if close_through else 89),
        (95, 88, 92),
        (101.5, 96, 101.3),
    ]
    bars.extend(
        _bar(10 + index, high=high, low=low, close=close, open_=close)
        for index, (high, low, close) in enumerate(sequence)
    )
    return bars


def test_liquidity_filter_requires_close_through_sell_side_box():
    full_detector = SmcExternalDetector(1, liquidity_filter=True)
    full_events = [
        event
        for bar in _liquidity_choch_bars(close_through=True)
        if (event := full_detector.update(bar)) is not None
    ]
    full_choch = full_events[-1]
    assert full_choch.kind == "CHoCH"
    assert full_choch.liquidity_swept is True
    assert full_choch.liquidity_count >= 2

    partial_detector = SmcExternalDetector(1, liquidity_filter=True)
    partial_events = [
        event
        for bar in _liquidity_choch_bars(close_through=False)
        if (event := partial_detector.update(bar)) is not None
    ]
    partial_choch = partial_events[-1]
    assert partial_choch.kind == "CHoCH"
    assert partial_choch.liquidity_swept is False


def test_liquidity_pool_starts_at_current_local_pair_and_ends_on_close_through():
    detector = SmcExternalDetector(
        1,
        liquidity_filter=True,
        liquidity_min_pivots=2,
    )
    bars = [_bar(i, high=99, low=91, close=95) for i in range(10)]
    sequence = [
        (100, 90, 95),
        (105, 94, 100),
        (100, 96, 97),
        (105, 97, 100),
        (100, 90.1, 92),
        (105, 94, 100),
        (100, 90.2, 92),
        (105, 94, 100),
        (95, 75, 80),
    ]
    bars.extend(
        _bar(10 + index, high=high, low=low, close=close, open_=close)
        for index, (high, low, close) in enumerate(sequence)
    )

    for source in bars:
        detector.update(source)

    sell_pools = [
        pool for pool in detector._liquidity_pools if pool.side == "sell"
    ]
    assert len(sell_pools) == 1
    pool = sell_pools[0]
    assert pool.created_index == 14
    assert len(pool.pivot_indices) == 2
    assert pool.broken is True
    assert pool.broken_time == 18 * _STEP


def test_liquidity_pool_honors_configurable_three_or_four_pivot_minimum():
    bars = [_bar(i, high=99, low=91, close=95) for i in range(10)]
    sequence = [
        (100, 90, 95),
        (105, 94, 100),
        (100, 96, 97),
        (105, 97, 100),
        (100, 90.1, 92),
        (105, 94, 100),
        (100, 90.2, 92),
        (105, 94, 100),
        (100, 90.15, 92),
        (105, 94, 100),
    ]
    bars.extend(
        _bar(10 + index, high=high, low=low, close=close, open_=close)
        for index, (high, low, close) in enumerate(sequence)
    )

    three_pivot_detector = SmcExternalDetector(
        1,
        liquidity_filter=True,
        liquidity_min_pivots=3,
    )
    for source in bars[:-2]:
        three_pivot_detector.update(source)
    assert [
        pool
        for pool in three_pivot_detector._liquidity_pools
        if pool.side == "sell"
    ] == []
    for source in bars[-2:]:
        three_pivot_detector.update(source)
    sell_pools = [
        pool
        for pool in three_pivot_detector._liquidity_pools
        if pool.side == "sell"
    ]
    assert len(sell_pools) == 1
    assert sell_pools[0].created_index == 14
    assert len(sell_pools[0].pivot_indices) == 3

    four_pivot_detector = SmcExternalDetector(
        1,
        liquidity_filter=True,
        liquidity_min_pivots=4,
    )
    for source in bars:
        four_pivot_detector.update(source)
    assert [
        pool
        for pool in four_pivot_detector._liquidity_pools
        if pool.side == "sell"
    ] == []


def test_standalone_liquidity_pool_break_alert_fires_on_close_through_ssl():
    engine = AlertEngine()
    engine.upsert(
        Alert(
            id="liquidity-break",
            symbol=_SYMBOL,
            type=LIQUIDITY_POOL_BREAK,
            params={
                "side": "both",
                "swingSize": 1,
                "pivotLookbackBars": 120,
                "minPivotCuts": 2,
                "liquidityAtrMargin": 4,
                "repeat": True,
            },
        )
    )
    bars = [_bar(i, high=99, low=91, close=95) for i in range(10)]
    sequence = [
        (100, 90, 95),
        (105, 94, 100),
        (100, 96, 97),
        (105, 97, 100),
        (100, 90.1, 92),
        (105, 94, 100),
        (100, 90.2, 92),
        (105, 94, 100),
        (95, 75, 80),
    ]
    bars.extend(
        _bar(10 + index, high=high, low=low, close=close, open_=close)
        for index, (high, low, close) in enumerate(sequence)
    )

    events = _feed_bars(engine, bars)

    assert len(events) == 1
    event = events[0]
    assert event.alert_type == LIQUIDITY_POOL_BREAK
    assert event.time == 18 * _STEP
    assert event.price == 80
    assert event.direction == -1
    assert "Liquidity Pool Break SSL x2" in event.message
    assert engine.evaluate(_bar_ctx(bars[-1])) == []


def test_standalone_liquidity_pool_break_alert_runs_on_configured_m5_only():
    engine = AlertEngine()
    engine.upsert(
        Alert(
            id="liquidity-break-m5",
            symbol=_SYMBOL,
            type=LIQUIDITY_POOL_BREAK,
            params={
                "side": "both",
                "timeframe": "5m",
                "swingSize": 1,
                "pivotLookbackBars": 120,
                "minPivotCuts": 2,
                "liquidityAtrMargin": 4,
                "repeat": True,
            },
        )
    )
    bars = [_bar(i, high=99, low=91, close=95) for i in range(10)]
    sequence = [
        (100, 90, 95),
        (105, 94, 100),
        (100, 96, 97),
        (105, 97, 100),
        (100, 90.1, 92),
        (105, 94, 100),
        (100, 90.2, 92),
        (105, 94, 100),
        (95, 75, 80),
    ]
    bars.extend(
        _bar(10 + index, high=high, low=low, close=close, open_=close)
        for index, (high, low, close) in enumerate(sequence)
    )

    assert _feed_bars(engine, bars, timeframe="1m") == []
    events = _feed_bars(engine, bars, timeframe="5m")

    assert len(events) == 1
    assert events[0].alert_id == "liquidity-break-m5"
    assert "M5 Liquidity Pool Break SSL x2" in events[0].message


def test_standalone_liquidity_pool_break_alert_respects_side_filter():
    engine = AlertEngine()
    engine.upsert(
        Alert(
            id="liquidity-break-bsl",
            symbol=_SYMBOL,
            type=LIQUIDITY_POOL_BREAK,
            params={
                "side": "bsl",
                "swingSize": 1,
                "pivotLookbackBars": 120,
                "minPivotCuts": 2,
                "liquidityAtrMargin": 4,
                "repeat": True,
            },
        )
    )
    bars = [_bar(i, high=99, low=91, close=95) for i in range(10)]
    sequence = [
        (100, 90, 95),
        (105, 94, 100),
        (100, 96, 97),
        (105, 97, 100),
        (100, 90.1, 92),
        (105, 94, 100),
        (100, 90.2, 92),
        (105, 94, 100),
        (95, 75, 80),
    ]
    bars.extend(
        _bar(10 + index, high=high, low=low, close=close, open_=close)
        for index, (high, low, close) in enumerate(sequence)
    )

    assert _feed_bars(engine, bars) == []


def test_mgann_live_filter_keeps_bos_but_rejects_unswept_choch():
    def run(close_through: bool):
        state = MgannBigTradeSweepState(
            swing_size=1,
            pivot_lookback_bars=120,
            min_pivot_cuts=2,
            filter_liquidity=True,
            volume_multiplier=0,
            spread_multiplier=0,
            require_big_trade=True,
        )
        signals = []
        for index, source in enumerate(_liquidity_choch_bars(close_through)):
            bar = MgannBigTradeSweepBar(
                time=source.time,
                open=96 if index == 20 else source.close,
                high=source.high,
                low=source.low,
                close=source.close,
                volume=10,
            )
            if index == 20:
                state.on_big_trade(time=bar.time, price=101, volume=80)
            signals.extend(state.on_closed_bar(bar))
        return signals

    full_signals = run(close_through=True)
    assert full_signals
    assert full_signals[-1].structure_kind == "CHoCH"
    assert full_signals[-1].cut_count >= 2
    assert run(close_through=False) == []


def test_mgann_liquidity_filter_does_not_change_bos_break_ls():
    state = MgannBigTradeSweepState(
        swing_size=50,
        filter_liquidity=True,
        volume_multiplier=0,
        spread_multiplier=0,
        require_big_trade=False,
    )
    signals = []
    source_bars = _bullish_bos_bars()
    for index, source in enumerate(source_bars):
        is_break_bar = index == len(source_bars) - 1
        signals.extend(
            state.on_closed_bar(
                MgannBigTradeSweepBar(
                    time=source.time,
                    open=95 if is_break_bar else source.close,
                    high=source.high,
                    low=source.low,
                    close=source.close,
                    volume=500 if is_break_bar else 100,
                )
            )
        )

    assert signals
    assert signals[-1].structure_kind == "BOS"


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


