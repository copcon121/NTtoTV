from __future__ import annotations

import pytest

from app.engines.market_volume_stop import MarketVolumeStopEngine
from app.market_explorer_settings import (
    MarketExplorerSettingsError,
    default_market_explorer_settings,
    validate_market_explorer_settings,
)
from app.models.canonical import NormalizedTrade, Side


def _trade(*, time: int, volume: int, side: Side, price: float = 3000.0) -> NormalizedTrade:
    return NormalizedTrade(
        symbol="GC",
        contract="GC 12-26",
        time=time,
        price=price,
        volume=volume,
        bid=price - 0.1,
        ask=price,
        best_bid=price - 0.1,
        best_ask=price,
        sequence=time + 1,
        source="bookmap",
        side=side,
    )


def test_half_life_decays_market_volume_by_half() -> None:
    settings = default_market_explorer_settings()
    settings["halftimeSeconds"] = 60
    settings["signal"]["enabled"] = False
    settings["volumeSpike"]["enabled"] = False
    settings["absorption"]["enabled"] = False
    engine = MarketVolumeStopEngine(settings)
    engine.on_trade(_trade(time=0, volume=100, side=Side.BUY))

    updates = engine.advance(60_000)

    assert updates[-1][0].value == pytest.approx(50.0)
    assert updates[-1][0].buy_volume == pytest.approx(50.0)
    assert updates[-1][0].sell_volume == 0.0


def test_standard_mode_marks_peak_after_ten_percent_fallback() -> None:
    settings = default_market_explorer_settings()
    settings["halftimeSeconds"] = 1
    settings["signal"].update(
        {"askLevel": 100.0, "bidLevel": 100.0, "displayMode": "standard"}
    )
    settings["volumeSpike"]["enabled"] = False
    settings["absorption"]["enabled"] = False
    engine = MarketVolumeStopEngine(settings)
    engine.on_trade(_trade(time=0, volume=200, side=Side.BUY, price=3001.2))

    first = engine.advance(300)
    second = engine.advance(600)

    assert first[0][1] == []
    signal = second[0][1][0]
    assert signal.side == "buy"
    assert signal.time == 300
    assert signal.detection_time == 600
    assert signal.price == 3001.2
    assert signal.value == pytest.approx(200 * 0.5**0.3)
    assert signal.ratio == pytest.approx(signal.value / 100.0)


def test_immediately_mode_fires_on_threshold_and_rearms_below_ninety_percent() -> None:
    settings = default_market_explorer_settings()
    settings["halftimeSeconds"] = 1
    settings["signal"].update(
        {"askLevel": 100.0, "bidLevel": 100.0, "displayMode": "immediately"}
    )
    settings["volumeSpike"]["enabled"] = False
    settings["absorption"]["enabled"] = False
    engine = MarketVolumeStopEngine(settings)
    engine.on_trade(_trade(time=0, volume=200, side=Side.SELL))

    updates = engine.advance(300)

    signal = updates[0][1][0]
    assert signal.side == "sell"
    assert signal.time == signal.detection_time == 300
    assert signal.threshold == 100.0


def test_settings_require_known_display_mode_and_no_telegram_field() -> None:
    settings = default_market_explorer_settings()
    settings["signal"]["telegramNotification"] = "enabled"
    with pytest.raises(MarketExplorerSettingsError, match="Unknown"):
        validate_market_explorer_settings(settings)

    settings = default_market_explorer_settings()
    settings["signal"]["displayMode"] = "future"
    with pytest.raises(MarketExplorerSettingsError, match="standard"):
        validate_market_explorer_settings(settings)


def test_volume_spike_marks_directional_peak_after_retrace() -> None:
    settings = default_market_explorer_settings()
    settings["signal"]["enabled"] = False
    settings["absorption"]["enabled"] = False
    engine = MarketVolumeStopEngine(settings)
    engine.on_trade(_trade(time=0, volume=400, side=Side.BUY, price=3000.0))
    engine.on_trade(_trade(time=50, volume=400, side=Side.BUY, price=3000.8))

    assert engine.advance(100) == []
    engine.on_trade(_trade(time=150, volume=1, side=Side.BUY, price=3000.6))
    updates = engine.advance(300)

    signal = next(item for item in updates[0][1] if item.kind == "volume_spike")
    assert signal.side == "buy"
    assert signal.time == 50
    assert signal.detection_time == 200
    assert signal.price == 3000.8
    assert signal.value == 800
    assert signal.price_range_ticks == 8


def test_volume_spike_ratio_rejects_heavy_opposite_flow() -> None:
    settings = default_market_explorer_settings()
    settings["signal"]["enabled"] = False
    settings["absorption"]["enabled"] = False
    engine = MarketVolumeStopEngine(settings)
    engine.on_trade(_trade(time=0, volume=400, side=Side.BUY, price=3000.0))
    engine.on_trade(_trade(time=50, volume=400, side=Side.BUY, price=3000.8))
    engine.on_trade(_trade(time=60, volume=100, side=Side.SELL, price=3000.8))
    engine.advance(100)
    engine.on_trade(_trade(time=150, volume=1, side=Side.BUY, price=3000.6))

    updates = engine.advance(300)

    assert all(item.kind != "volume_spike" for item in updates[0][1])


def test_sell_volume_spike_uses_opposite_volume_since_the_price_extreme() -> None:
    settings = default_market_explorer_settings()
    settings["signal"]["enabled"] = False
    settings["absorption"]["enabled"] = False
    settings["volumeSpike"].update(
        triggerVolume=50,
        maximumDurationSeconds=1,
        priceRangeTicks=8,
        ratioGreaterEqual=10,
    )
    engine = MarketVolumeStopEngine(settings)
    engine.on_trade(_trade(time=0, volume=20, side=Side.SELL, price=3001.3))
    engine.on_trade(_trade(time=50, volume=35, side=Side.SELL, price=3000.0))
    engine.on_trade(_trade(time=60, volume=3, side=Side.BUY, price=3000.0))

    assert engine.advance(100) == []
    engine.on_trade(_trade(time=150, volume=1, side=Side.SELL, price=3000.2))
    updates = engine.advance(300)

    signal = next(item for item in updates[0][1] if item.kind == "volume_spike")
    assert signal.side == "sell"
    assert signal.time == 50
    assert signal.price == 3000.0
    assert signal.value == 55
    assert signal.opposite_volume == 3
    assert signal.ratio == pytest.approx(55 / 3)
    assert signal.price_range_ticks == 13


def test_absorption_marks_peak_when_two_tick_range_breaks() -> None:
    settings = default_market_explorer_settings()
    settings["signal"]["enabled"] = False
    settings["volumeSpike"]["enabled"] = False
    engine = MarketVolumeStopEngine(settings)
    engine.on_trade(_trade(time=0, volume=500, side=Side.BUY, price=3000.0))
    engine.on_trade(_trade(time=50, volume=500, side=Side.BUY, price=3000.1))
    engine.advance(100)
    engine.on_trade(_trade(time=150, volume=1, side=Side.BUY, price=3000.2))

    updates = engine.advance(300)

    signal = next(item for item in updates[0][1] if item.kind == "absorption")
    assert signal.side == "buy"
    assert signal.time == 50
    assert signal.detection_time == 200
    assert signal.price == 3000.1
    assert signal.value == 1000
    assert signal.price_range_ticks == 1
