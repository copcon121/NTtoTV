from app.engines.alert_engine import (
    MGANN_BIG_TRADE_SWEEP,
    Alert,
    AlertEngine,
    MarketContext,
)

_SYMBOL = "GC"
_CONTRACT = "GC"
_STEP = 60_000


def _bar_ctx(
    index: int,
    open_: float,
    high: float,
    low: float,
    close: float,
    volume: int = 100,
) -> MarketContext:
    time = index * _STEP
    return MarketContext(
        symbol=_SYMBOL,
        contract=_CONTRACT,
        time=time + _STEP,
        bar_closed=True,
        bar_tf="1m",
        bar_time=time,
        bar_open=open_,
        bar_high=high,
        bar_low=low,
        bar_close=close,
        bar_volume=volume,
    )


def _big_trade_ctx(index: int, volume: int, price: float = 104.5) -> MarketContext:
    time = index * _STEP + 1_000
    return MarketContext(
        symbol=_SYMBOL,
        contract=_CONTRACT,
        time=time,
        big_trade_volume=volume,
        big_trade_price=price,
    )


def _engine() -> AlertEngine:
    engine = AlertEngine()
    engine.upsert(
        Alert(
            id="mgann-sweep",
            symbol=_SYMBOL,
            type=MGANN_BIG_TRADE_SWEEP,
            params={
                "bigTradeThreshold": 70,
                "timeframe": "1m",
                "minVolume": 0,
                "volumeLookback": 20,
                "volumeMultiplier": 2,
                "minSpreadTicks": 0,
                "spreadLookback": 20,
                "spreadMultiplier": 2,
                "swingSize": 1,
                "pivotLookbackBars": 20,
                "minPivotCuts": 2,
                "confirmationBars": 2,
                "breakTicks": 0,
                "repeat": True,
            },
        )
    )
    return engine


_WARMUP_BARS = [
    (99.5, 100.0, 98.0, 99.0, 100),
    (99.0, 102.0, 98.5, 101.5, 100),
    (101.5, 101.0, 99.0, 99.5, 100),
    (99.5, 100.0, 97.5, 98.5, 100),
    (98.5, 103.0, 98.0, 102.5, 100),
    (102.5, 104.0, 101.0, 103.5, 100),
    (103.5, 103.0, 99.0, 100.0, 100),
    (100.0, 101.0, 98.2, 99.0, 100),
]


def _feed_warmup(engine: AlertEngine) -> None:
    for index, bar in enumerate(_WARMUP_BARS):
        assert engine.evaluate(_bar_ctx(index, *bar)) == []


def test_mgann_big_trade_sweep_fires_on_bar_that_cuts_two_prior_highs():
    engine = _engine()
    _feed_warmup(engine)

    assert engine.evaluate(_big_trade_ctx(8, 80, price=104.8)) == []
    events = engine.evaluate(_bar_ctx(8, 99.0, 105.0, 98.0, 103.0, 500))

    assert [event.alert_id for event in events] == ["mgann-sweep"]
    assert events[0].alert_type == MGANN_BIG_TRADE_SWEEP
    assert events[0].time == 8 * _STEP
    assert events[0].price == 105.0
    assert events[0].direction == 1
    assert "mGann highs breakout 2 pivots" in events[0].message
    assert "BigTrade 80 > 70" in events[0].message


def test_mgann_big_trade_sweep_can_fire_on_next_bar_after_sweep():
    engine = _engine()
    _feed_warmup(engine)

    assert engine.evaluate(_bar_ctx(8, 99.0, 105.0, 98.0, 103.0, 500)) == []
    assert engine.evaluate(_big_trade_ctx(9, 90, price=102.5)) == []
    events = engine.evaluate(_bar_ctx(9, 103.0, 104.0, 95.0, 103.5, 450))

    assert [event.alert_id for event in events] == ["mgann-sweep"]
    assert events[0].time == 9 * _STEP
    assert events[0].direction == 1

def test_mgann_big_trade_sweep_fires_on_bearish_bar_that_cuts_two_prior_lows():
    engine = _engine()
    _feed_warmup(engine)

    assert engine.evaluate(_big_trade_ctx(8, 80, price=97.2)) == []
    events = engine.evaluate(_bar_ctx(8, 100.0, 104.0, 97.0, 97.5, 500))

    assert [event.alert_id for event in events] == ["mgann-sweep"]
    assert events[0].alert_type == MGANN_BIG_TRADE_SWEEP
    assert events[0].time == 8 * _STEP
    assert events[0].price == 97.0
    assert events[0].direction == -1
    assert "mGann lows breakout 2 pivots" in events[0].message


def test_mgann_big_trade_sweep_requires_big_trade_and_two_pivot_cuts():
    engine = _engine()
    _feed_warmup(engine)

    assert engine.evaluate(_bar_ctx(8, 99.0, 105.0, 98.0, 103.0, 500)) == []

    engine = _engine()
    _feed_warmup(engine)
    assert engine.evaluate(_big_trade_ctx(8, 70, price=104.8)) == []
    assert engine.evaluate(_bar_ctx(8, 99.0, 105.0, 98.0, 103.0, 500)) == []

    engine = _engine()
    _feed_warmup(engine)
    assert engine.evaluate(_big_trade_ctx(8, 90, price=102.5)) == []
    assert engine.evaluate(_bar_ctx(8, 99.0, 103.0, 98.0, 102.5, 500)) == []
