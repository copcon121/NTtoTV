from __future__ import annotations

import pytest

from app.engines.fvg_signal_engine import FvgSignalEngine
from app.models.canonical import NormalizedTrade, Side


_SYMBOL = "GC"
_CONTRACT = "GC"
_T0 = 1_780_358_400_000
_MINUTE_MS = 60_000


class _Feeder:
    def __init__(self, engine: FvgSignalEngine) -> None:
        self.engine = engine
        self.sequence = 0

    def trade(
        self,
        minute: int,
        offset_ms: int,
        price: float,
        volume: int,
        side: Side,
    ) -> list:
        self.sequence += 1
        bid = price if side is Side.SELL else price - 0.1
        ask = price if side is Side.BUY else price + 0.1
        return self.engine.on_trade(
            NormalizedTrade(
                symbol=_SYMBOL,
                contract=_CONTRACT,
                time=_T0 + minute * _MINUTE_MS + offset_ms,
                price=price,
                volume=volume,
                bid=bid,
                ask=ask,
                best_bid=bid,
                best_ask=ask,
                sequence=self.sequence,
            )
        )

    def bar(
        self,
        minute: int,
        open_price: float,
        close_price: float,
        delta: int,
    ) -> list:
        events = []
        if delta > 0:
            events += self.trade(minute, 0, open_price, 1, Side.BUY)
            events += self.trade(minute, 100, close_price, max(1, delta - 1), Side.BUY)
        elif delta < 0:
            volume = abs(delta)
            events += self.trade(minute, 0, open_price, 1, Side.SELL)
            events += self.trade(minute, 100, close_price, max(1, volume - 1), Side.SELL)
        else:
            events += self.trade(minute, 0, open_price, 5, Side.SELL)
            events += self.trade(minute, 100, close_price, 5, Side.BUY)
        return events


class _NativeFeeder:
    def __init__(self, engine: FvgSignalEngine) -> None:
        self.engine = engine
        self.sequence = 0

    def bar(
        self,
        minute: int,
        open_price: float,
        close_price: float,
        delta: int,
    ) -> list:
        volume = max(1, abs(delta))
        if delta > 0:
            rows = [(open_price, 0, 1), (close_price, 0, max(1, volume - 1))]
        elif delta < 0:
            rows = [(open_price, 1, 0), (close_price, max(1, volume - 1), 0)]
        else:
            rows = [(open_price, 5, 0), (close_price, 0, 5)]
        return self.engine.on_closed_bar(
            symbol=_SYMBOL,
            contract=_CONTRACT,
            time=_T0 + minute * _MINUTE_MS,
            open=open_price,
            high=max(open_price, close_price),
            low=min(open_price, close_price),
            close=close_price,
            rows=rows,
        )

    def preview_trade(self, minute: int, offset_ms: int, price: float) -> list:
        self.sequence += 1
        return self.engine.on_preview_trade(
            NormalizedTrade(
                symbol=_SYMBOL,
                contract=_CONTRACT,
                time=_T0 + minute * _MINUTE_MS + offset_ms,
                price=price,
                volume=1,
                bid=price - 0.1,
                ask=price + 0.1,
                best_bid=price - 0.1,
                best_ask=price + 0.1,
                sequence=self.sequence,
            )
        )


def _warmup(feeder: _Feeder, deltas: list[int]) -> list:
    events = []
    for minute, delta in enumerate(deltas):
        open_price = 99.0 + (minute % 2) * 0.1
        close_price = open_price + (0.1 if delta >= 0 else -0.1)
        events += feeder.bar(minute, open_price, close_price, delta)
    return events

def _native_warmup(feeder: _NativeFeeder, deltas: list[int]) -> list:
    events = []
    for minute, delta in enumerate(deltas):
        open_price = 99.0 + (minute % 2) * 0.1
        close_price = open_price + (0.1 if delta >= 0 else -0.1)
        events += feeder.bar(minute, open_price, close_price, delta)
    return events


def _latest_signal(events: list):
    signals = [event for event in events if event.type == "fvg_signal_update"]
    assert signals
    return signals[-1]


@pytest.mark.unit
def test_bull_fvg_signal_previews_confirms_and_exhaustion_upgrades_to_ultimate():
    engine = FvgSignalEngine()
    feeder = _Feeder(engine)
    events = _warmup(feeder, [0, 5, 0, 5, 0, 5, 0, 5, -30, -10])
    events += feeder.bar(10, 100.0, 100.5, 10)
    events += feeder.bar(11, 100.6, 101.0, 100)
    events += feeder.bar(12, 100.7, 100.8, 5)

    preview = _latest_signal(events)
    assert preview.phase == "preview"
    assert preview.time == _T0 + 11 * _MINUTE_MS
    assert preview.direction == 1
    assert preview.level == 5
    assert preview.pulse == 5
    assert preview.bottom == pytest.approx(100.5)
    assert preview.top == pytest.approx(100.7)

    events += feeder.bar(13, 100.8, 100.9, 5)
    confirmed = _latest_signal(events)
    assert confirmed.phase == "confirmed"
    assert confirmed.time == preview.time
    assert confirmed.pulse == 5


@pytest.mark.unit
def test_bear_fvg_signal_can_upgrade_to_negative_ultimate():
    engine = FvgSignalEngine()
    feeder = _Feeder(engine)
    events = _warmup(feeder, [0, -5, 0, -5, 0, -5, 0, -5, 30, 10])
    events += feeder.bar(10, 100.5, 100.0, -10)
    events += feeder.bar(11, 99.4, 99.0, -100)
    events += feeder.bar(12, 99.8, 99.7, -5)

    signal = _latest_signal(events)
    assert signal.phase == "preview"
    assert signal.direction == -1
    assert signal.level == 5
    assert signal.pulse == -5
    assert signal.bottom == pytest.approx(99.8)
    assert signal.top == pytest.approx(100.0)


@pytest.mark.unit
@pytest.mark.parametrize(
    ("source_delta", "expected_level"),
    [(33, 1), (37, 2), (41, 3)],
)
def test_light_preset_levels_without_exhaustion(source_delta: int, expected_level: int):
    engine = FvgSignalEngine()
    feeder = _Feeder(engine)
    events = _warmup(feeder, [0, 0, 20, 0, 20, 0, 20, 0, 20, 0])
    events += feeder.bar(10, 100.0, 100.5, 10)
    events += feeder.bar(11, 100.6, 101.0, source_delta)
    events += feeder.bar(12, 100.7, 100.8, 5)

    signal = _latest_signal(events)
    assert signal.level == expected_level
    assert signal.pulse == expected_level
    assert 1.2 <= signal.breakout_ratio


@pytest.mark.unit
def test_delta_breakout_search_accepts_source_minus_two_only():
    engine = FvgSignalEngine()
    feeder = _Feeder(engine)
    events = _warmup(feeder, [0, 20, 0, 20, 0, 20, 0, 20, 0, 0])
    events += feeder.bar(10, 99.4, 99.9, 40)
    events += feeder.bar(11, 100.0, 100.5, 5)
    events += feeder.bar(12, 100.6, 101.0, 5)
    events += feeder.bar(13, 100.7, 100.8, 5)

    signal = _latest_signal(events)
    assert signal.phase == "preview"
    assert signal.time == _T0 + 12 * _MINUTE_MS
    assert signal.direction == 1
    assert signal.breakout_ratio >= 1.2


@pytest.mark.unit
def test_delta_breakout_search_ignores_source_minus_three():
    engine = FvgSignalEngine()
    feeder = _Feeder(engine)
    events = _warmup(feeder, [0, 20, 0, 20, 0, 20, 0, 20, 0, 0])
    events += feeder.bar(10, 99.4, 99.9, 40)
    events += feeder.bar(11, 100.7, 99.0, -5)
    events += feeder.bar(12, 100.0, 100.5, 5)
    events += feeder.bar(13, 100.6, 101.0, 5)
    events += feeder.bar(14, 100.7, 100.8, 5)

    target_time = _T0 + 13 * _MINUTE_MS
    assert all(
        event.time != target_time
        for event in events
        if event.type == "fvg_signal_update"
    )


@pytest.mark.unit
def test_value_area_gap_is_checked_on_source_bar_only():
    engine = FvgSignalEngine()
    feeder = _Feeder(engine)
    events = _warmup(feeder, [0, 5, 0, 5, 0, 5, 0, 5, 0, 10])
    events += feeder.bar(10, 100.0, 100.5, 10)
    events += feeder.trade(11, 0, 100.4, 90, Side.BUY)
    events += feeder.trade(11, 100, 101.0, 10, Side.BUY)
    events += feeder.bar(12, 100.7, 100.8, 5)

    assert [event for event in events if event.type == "fvg_signal_update"] == []


@pytest.mark.unit
def test_preview_clears_when_forming_right_bar_invalidates_strict_fvg():
    engine = FvgSignalEngine()
    feeder = _Feeder(engine)
    events = _warmup(feeder, [0, 5, 0, 5, 0, 5, 0, 5, -30, -10])
    events += feeder.bar(10, 100.0, 100.5, 10)
    events += feeder.bar(11, 100.6, 101.0, 100)
    events += feeder.trade(12, 0, 100.7, 5, Side.BUY)
    preview = _latest_signal(events)

    events += feeder.trade(12, 100, 100.4, 5, Side.SELL)
    clear = _latest_signal(events)
    assert preview.phase == "preview"
    assert clear.phase == "clear"
    assert clear.time == preview.time
    assert clear.pulse == 0

@pytest.mark.unit
def test_native_closed_bars_confirm_without_preview():
    engine = FvgSignalEngine()
    feeder = _NativeFeeder(engine)
    events = _native_warmup(feeder, [0, 5, 0, 5, 0, 5, 0, 5, -30, -10])
    events += feeder.bar(10, 100.0, 100.5, 10)
    events += feeder.bar(11, 100.6, 101.0, 100)
    events += feeder.bar(12, 100.7, 100.8, 5)

    signal = _latest_signal(events)
    assert signal.phase == "confirmed"
    assert signal.time == _T0 + 11 * _MINUTE_MS
    assert signal.direction == 1
    assert signal.pulse == 5
    assert signal.bottom == pytest.approx(100.5)
    assert signal.top == pytest.approx(100.7)


@pytest.mark.unit
def test_native_preview_colors_source_before_right_bar_closes_and_confirms_on_close():
    engine = FvgSignalEngine()
    feeder = _NativeFeeder(engine)
    events = _native_warmup(feeder, [0, 5, 0, 5, 0, 5, 0, 5, -30, -10])
    events += feeder.bar(10, 100.0, 100.5, 10)
    events += feeder.bar(11, 100.6, 101.0, 100)

    events += feeder.preview_trade(12, 0, 100.7)
    preview = _latest_signal(events)
    assert preview.phase == "preview"
    assert preview.time == _T0 + 11 * _MINUTE_MS
    assert preview.pulse == 5

    events += feeder.bar(12, 100.7, 100.8, 5)
    confirmed = _latest_signal(events)
    assert confirmed.phase == "confirmed"
    assert confirmed.time == preview.time
    assert confirmed.pulse == preview.pulse


@pytest.mark.unit
def test_native_preview_clears_when_right_bar_stops_matching_fvg():
    engine = FvgSignalEngine()
    feeder = _NativeFeeder(engine)
    events = _native_warmup(feeder, [0, 5, 0, 5, 0, 5, 0, 5, -30, -10])
    events += feeder.bar(10, 100.0, 100.5, 10)
    events += feeder.bar(11, 100.6, 101.0, 100)

    events += feeder.preview_trade(12, 0, 100.7)
    preview = _latest_signal(events)
    events += feeder.preview_trade(12, 100, 100.4)
    clear = _latest_signal(events)

    assert preview.phase == "preview"
    assert clear.phase == "clear"
    assert clear.time == preview.time
    assert clear.pulse == 0


@pytest.mark.unit
def test_native_preview_waits_for_pending_native_close_before_advancing():
    engine = FvgSignalEngine()
    feeder = _NativeFeeder(engine)
    events = _native_warmup(feeder, [0, 5, 0, 5, 0, 5, 0, 5, -30, -10])
    events += feeder.bar(10, 100.0, 100.5, 10)
    events += feeder.bar(11, 100.6, 101.0, 100)

    events += feeder.preview_trade(12, 0, 100.7)
    preview = _latest_signal(events)
    events += feeder.preview_trade(13, 0, 100.9)
    assert _latest_signal(events) == preview

    events += feeder.bar(12, 100.7, 100.8, 5)
    confirmed = _latest_signal(events)
    assert confirmed.phase == "confirmed"
    assert confirmed.time == preview.time
    assert confirmed.pulse == preview.pulse
