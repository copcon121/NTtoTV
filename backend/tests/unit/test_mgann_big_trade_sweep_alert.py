from app.engines.alert_engine import (
    MGANN_BREAK_LS,
    MGANN_BIG_TRADE_SWEEP,
    MGANN_SWEEP,
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


def _engine(
    *,
    require_big_trade: bool = False,
    alert_type: str = MGANN_BREAK_LS,
    confirmation_bars: int = 2,
) -> AlertEngine:
    engine = AlertEngine()
    engine.upsert(
        Alert(
            id="mgann-break",
            symbol=_SYMBOL,
            type=alert_type,
            params={
                "requireBigTrade": require_big_trade,
                "bigTradeThreshold": 70,
                "timeframe": "1m",
                "minVolume": 0,
                "volumeLookback": 2,
                "volumeMultiplier": 2,
                "minSpreadTicks": 0,
                "spreadLookback": 2,
                "spreadMultiplier": 2,
                "swingSize": 1,
                "pivotLookbackBars": 20,
                "minPivotCuts": 1,
                "confirmationBars": confirmation_bars,
                "breakTicks": 0,
                "repeat": True,
            },
        )
    )
    return engine


def _feed(engine: AlertEngine, bars: list[tuple[float, float, float, float, int]]):
    events = []
    for index, bar in enumerate(bars):
        events.extend(engine.evaluate(_bar_ctx(index, *bar)))
    return events


_BULLISH_CHOCH_SETUP = [
    (100.0, 100.2, 99.5, 100.0, 100),
    (100.0, 101.0, 98.5, 99.0, 100),
    (99.0, 99.5, 97.0, 98.0, 100),
    (98.0, 100.0, 97.5, 98.8, 100),
    (98.8, 99.0, 96.0, 96.5, 100),
]

_BEARISH_CHOCH_SETUP = [
    (100.0, 100.5, 99.0, 100.0, 100),
    (100.0, 101.5, 98.0, 101.0, 100),
    (101.0, 103.0, 100.0, 102.0, 100),
    (102.0, 102.5, 100.5, 101.8, 100),
    (101.8, 104.0, 101.5, 103.5, 100),
]


def test_mgann_break_ls_fires_break_l_on_internal_choch_up():
    engine = _engine()
    assert _feed(engine, _BULLISH_CHOCH_SETUP) == []

    events = engine.evaluate(_bar_ctx(5, 96.5, 102.5, 96.0, 102.2, 500))

    assert [event.alert_id for event in events] == ["mgann-break"]
    assert events[0].alert_type == MGANN_BREAK_LS
    assert events[0].time == 5 * _STEP
    assert events[0].direction == 1
    assert "Break L internal CHoCH" in events[0].message


def test_mgann_break_ls_fires_break_s_on_internal_choch_down():
    engine = _engine()
    assert _feed(engine, _BEARISH_CHOCH_SETUP) == []

    events = engine.evaluate(_bar_ctx(5, 103.5, 104.0, 97.0, 97.5, 500))

    assert [event.alert_id for event in events] == ["mgann-break"]
    assert events[0].alert_type == MGANN_BREAK_LS
    assert events[0].time == 5 * _STEP
    assert events[0].direction == -1
    assert "Break S internal CHoCH" in events[0].message


def test_mgann_break_ls_same_direction_bos_can_fire_until_opposite_choch():
    engine = _engine()
    assert _feed(engine, _BULLISH_CHOCH_SETUP) == []
    assert engine.evaluate(_bar_ctx(5, 96.5, 102.5, 96.0, 102.2, 500))
    assert engine.evaluate(_bar_ctx(6, 102.2, 103.0, 101.0, 101.5, 100)) == []
    assert engine.evaluate(_bar_ctx(7, 101.5, 102.5, 101.0, 101.8, 100)) == []

    events = engine.evaluate(_bar_ctx(8, 101.8, 110.0, 101.5, 109.0, 500))

    assert [event.alert_id for event in events] == ["mgann-break"]
    assert events[0].direction == 1
    assert "Break L internal BOS" in events[0].message


def test_mgann_break_ls_requires_close_beyond_pivot_not_wick_only():
    engine = _engine()
    assert _feed(engine, _BULLISH_CHOCH_SETUP) == []

    events = engine.evaluate(_bar_ctx(5, 96.5, 102.5, 96.0, 99.8, 500))

    assert events == []


def test_mgann_break_ls_can_fire_on_next_two_bars_after_break_bar_fails_filters():
    engine = _engine()
    assert _feed(engine, _BULLISH_CHOCH_SETUP) == []
    assert engine.evaluate(_bar_ctx(5, 101.1, 106.0, 96.0, 101.2, 500)) == []

    events = engine.evaluate(_bar_ctx(6, 101.2, 104.2, 101.0, 104.0, 700))

    assert [event.alert_id for event in events] == ["mgann-break"]
    assert events[0].time == 6 * _STEP
    assert events[0].direction == 1


def test_mgann_break_ls_candidate_expires_after_confirmation_window():
    engine = _engine(confirmation_bars=1)
    assert _feed(engine, _BULLISH_CHOCH_SETUP) == []
    assert engine.evaluate(_bar_ctx(5, 101.1, 106.0, 96.0, 101.2, 500)) == []
    assert engine.evaluate(_bar_ctx(6, 101.2, 106.0, 101.0, 101.3, 500)) == []

    events = engine.evaluate(_bar_ctx(7, 101.3, 103.0, 101.0, 102.8, 500))

    assert events == []


def test_mgann_break_ls_rejects_doji_and_strong_upper_wick_for_l():
    engine = _engine()
    assert _feed(engine, _BULLISH_CHOCH_SETUP) == []
    assert engine.evaluate(_bar_ctx(5, 101.0, 106.0, 96.0, 101.2, 500)) == []

    engine = _engine()
    assert _feed(engine, _BULLISH_CHOCH_SETUP) == []
    events = engine.evaluate(_bar_ctx(5, 96.5, 110.0, 96.0, 102.2, 500))

    assert events == []


def test_mgann_break_ls_rejects_strong_lower_wick_for_s():
    engine = _engine()
    assert _feed(engine, _BEARISH_CHOCH_SETUP) == []

    events = engine.evaluate(_bar_ctx(5, 103.5, 104.0, 90.0, 97.5, 500))

    assert events == []


def test_mgann_break_ls_uses_body_spread_for_spread_multiplier():
    engine = _engine()
    assert _feed(engine, _BULLISH_CHOCH_SETUP) == []

    events = engine.evaluate(_bar_ctx(5, 99.0, 101.0, 98.0, 100.5, 500))

    assert events == []


def test_mgann_break_ls_bigtrade_is_optional_gate():
    engine = _engine(require_big_trade=True)
    assert _feed(engine, _BULLISH_CHOCH_SETUP) == []
    assert engine.evaluate(_bar_ctx(5, 96.5, 102.5, 96.0, 102.2, 500)) == []

    engine = _engine(require_big_trade=True)
    assert _feed(engine, _BULLISH_CHOCH_SETUP) == []
    assert engine.evaluate(_big_trade_ctx(5, 70, price=102.0)) == []
    assert engine.evaluate(_bar_ctx(5, 96.5, 102.5, 96.0, 102.2, 500)) == []

    engine = _engine(require_big_trade=True)
    assert _feed(engine, _BULLISH_CHOCH_SETUP) == []
    assert engine.evaluate(_big_trade_ctx(5, 80, price=102.0)) == []
    events = engine.evaluate(_bar_ctx(5, 96.5, 102.5, 96.0, 102.2, 500))

    assert [event.alert_id for event in events] == ["mgann-break"]
    assert "BigTrade 80 > 70" in events[0].message


def test_legacy_mgann_sweep_aliases_map_to_break_ls_bigtrade_option():
    engine = _engine(alert_type=MGANN_SWEEP)
    assert _feed(engine, _BULLISH_CHOCH_SETUP) == []
    events = engine.evaluate(_bar_ctx(5, 96.5, 102.5, 96.0, 102.2, 500))
    assert events[0].alert_type == MGANN_BREAK_LS
    assert "BigTrade" not in events[0].message

    engine = _engine(alert_type=MGANN_BIG_TRADE_SWEEP)
    assert _feed(engine, _BULLISH_CHOCH_SETUP) == []
    assert engine.evaluate(_bar_ctx(5, 96.5, 102.5, 96.0, 102.2, 500)) == []
