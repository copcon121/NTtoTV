from app.engines.alert_engine import Alert, AlertEngine, MarketContext


def _big_trade_ctx(time: int, volume: int):
    return MarketContext(
        symbol="GC",
        contract="GC 08-26",
        time=time,
        big_trade_volume=volume,
        big_trade_price=2345.0,
    )


def _delta_ctx(time: int, delta: int):
    return MarketContext(
        symbol="GC",
        contract="GC 08-26",
        time=time,
        bar_closed=True,
        bar_time=time,
        bar_close=2345.0,
        bar_volume_delta=delta,
    )

def _m5_bar_ctx(
    index: int,
    open_: float,
    high: float,
    low: float,
    close: float,
):
    time = 1_000_000 + index * 300_000
    return MarketContext(
        symbol="GC",
        contract="GC",
        time=time + 300_000,
        bar_closed=True,
        bar_tf="5m",
        bar_time=time,
        bar_open=open_,
        bar_high=high,
        bar_low=low,
        bar_close=close,
        bar_volume=100,
    )


def _m1_bar_ctx(
    index: int,
    open_: float,
    high: float,
    low: float,
    close: float,
):
    time = 1_000_000 + index * 60_000
    return MarketContext(
        symbol="GC",
        contract="GC",
        time=time + 60_000,
        bar_closed=True,
        bar_tf="1m",
        bar_time=time,
        bar_open=open_,
        bar_high=high,
        bar_low=low,
        bar_close=close,
        bar_volume=100,
    )


_MGANN_RETEST_BARS = [
    (100.0, 101.0, 100.0, 100.5),
    (100.5, 102.0, 100.5, 101.8),
    (101.8, 103.0, 101.5, 102.8),
    (102.8, 104.0, 102.0, 103.0),
    (103.0, 105.0, 103.0, 104.5),
    (104.5, 104.0, 102.5, 103.0),
    (103.0, 103.0, 101.8, 102.0),
    (101.3, 102.0, 101.1, 101.4),
    (101.4, 102.2, 101.1, 101.8),
    (101.8, 103.0, 101.4, 102.8),
    (102.8, 104.0, 102.5, 103.8),
    (103.8, 105.0, 103.5, 104.8),
    (104.8, 104.5, 103.0, 103.5),
    (103.5, 104.0, 102.0, 102.3),
    (102.3, 103.0, 101.3, 101.6),
    (101.6, 102.0, 101.2, 101.4),
    (101.4, 102.5, 101.5, 102.2),
    (102.2, 103.2, 102.0, 103.0),
]

_MGANN_EARLY_TOUCH_BARS = [
    *_MGANN_RETEST_BARS[:6],
    (103.0, 103.0, 101.2, 101.3),
    (101.3, 102.0, 101.1, 101.4),
    *_MGANN_RETEST_BARS[8:],
]


def test_one_shot_alert_disables_after_first_fire():
    engine = AlertEngine()
    engine.upsert(
        Alert(
            id="bt",
            symbol="GC",
            type="big_trade_threshold",
            params={"threshold": 50},
        )
    )

    first = engine.evaluate(_big_trade_ctx(1, 60))
    second = engine.evaluate(_big_trade_ctx(2, 70))

    assert [event.alert_id for event in first] == ["bt"]
    assert second == []
    assert engine.alerts()[0].enabled is False


def test_repeat_big_trade_threshold_stays_enabled_and_fires_per_trade():
    engine = AlertEngine()
    engine.upsert(
        Alert(
            id="bt",
            symbol="GC",
            type="big_trade_threshold",
            params={"threshold": 50, "repeat": True},
        )
    )

    first = engine.evaluate(_big_trade_ctx(1, 60))
    second = engine.evaluate(_big_trade_ctx(2, 70))

    assert [event.alert_id for event in first] == ["bt"]
    assert [event.alert_id for event in second] == ["bt"]
    assert engine.alerts()[0].enabled is True


def test_repeat_volume_delta_threshold_stays_enabled_and_fires_on_new_closed_bars():
    engine = AlertEngine()
    engine.upsert(
        Alert(
            id="delta",
            symbol="GC",
            type="volume_delta_threshold",
            params={"threshold": 100, "repeat": True},
        )
    )

    first = engine.evaluate(_delta_ctx(1_000, 120))
    duplicate_same_bar = engine.evaluate(_delta_ctx(1_000, 130))
    second_bar = engine.evaluate(_delta_ctx(2_000, -140))

    assert [event.alert_id for event in first] == ["delta"]
    assert duplicate_same_bar == []
    assert [event.alert_id for event in second_bar] == ["delta"]
    assert engine.alerts()[0].enabled is True

def test_mgann_fvg_retest_waits_for_confirmed_retest_swing():
    engine = AlertEngine()
    engine.upsert(
        Alert(
            id="mgann",
            symbol="GC",
            type="mgann_fvg_retest",
            params={"repeat": True, "swingSize": 1},
        )
    )

    fired_before_confirmation = []
    for index, bar in enumerate(_MGANN_RETEST_BARS[:14]):
        fired_before_confirmation.extend(engine.evaluate(_m5_bar_ctx(index, *bar)))
    fired_on_confirmation = engine.evaluate(_m5_bar_ctx(14, *_MGANN_RETEST_BARS[14]))

    assert fired_before_confirmation == []
    assert [event.alert_id for event in fired_on_confirmation] == ["mgann"]
    assert fired_on_confirmation[0].alert_type == "mgann_fvg_retest"
    assert "M5 bullish FVG retest by mGann wave" in fired_on_confirmation[0].message
    assert fired_on_confirmation[0].level == 101.25


def test_mgann_fvg_retest_does_not_fire_if_touch_precedes_swing_confirm():
    engine = AlertEngine()
    engine.upsert(
        Alert(
            id="mgann",
            symbol="GC",
            type="mgann_fvg_retest",
            params={"repeat": True},
        )
    )

    fired = []
    for index, bar in enumerate(_MGANN_EARLY_TOUCH_BARS[:8]):
        fired.extend(engine.evaluate(_m5_bar_ctx(index, *bar)))

    assert fired == []


def test_mgann_fvg_retest_can_run_on_m1_timeframe():
    engine = AlertEngine()
    engine.upsert(
        Alert(
            id="mgann",
            symbol="GC",
            type="mgann_fvg_retest",
            params={"timeframe": "1m", "repeat": True, "swingSize": 1},
        )
    )

    fired = []
    for index, bar in enumerate(_MGANN_RETEST_BARS[:15]):
        fired.extend(engine.evaluate(_m1_bar_ctx(index, *bar)))

    assert [event.alert_id for event in fired] == ["mgann"]
    assert "M1 bullish FVG retest by mGann wave" in fired[0].message
