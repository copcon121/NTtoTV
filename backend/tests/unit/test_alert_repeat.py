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
