"""External break -> mGann reclaim leg -> multi-wave return to the pivot wick."""
from __future__ import annotations

from dataclasses import dataclass

from .mgann_pb import MgannPbState, MgannWave, PbSignal
from .smc_external import SmcBar, SmcBreakEvent, SmcExternalDetector

SMC_FAIL_BREAK_RETEST = "smc_fail_break_retest"
FAIL_BREAK_DEFAULTS = {
    "timeframe": "1m",
    "swingLength": 50,
    "useChartSmc": True,
    "maxBars": 120,
    "requirePb": False,
    "direction": "both",
    "repeat": True,
}


@dataclass
class _Setup:
    event: SmcBreakEvent
    index: int
    zone_bottom: float
    zone_top: float
    outside_price: float
    reclaim_time: int | None = None
    inside_time: int | None = None
    inside_price: float | None = None


@dataclass(frozen=True)
class FailBreakTrigger:
    setup: SmcBreakEvent
    time: int
    price: float
    pb: bool
    zone_bottom: float
    zone_top: float

    @property
    def direction(self) -> int:
        return -self.setup.direction


class SmcFailBreakState:
    def __init__(self, **params) -> None:
        # Old tick-distance params can remain on saved alerts; they no longer
        # participate in qualification or invalidate a multi-wave return.
        self.params = {**FAIL_BREAK_DEFAULTS, **params}
        self._detector = SmcExternalDetector(self.params["swingLength"])
        self._pb = MgannPbState()
        self._setups: list[_Setup] = []
        self._bars: dict[int, SmcBar] = {}
        self._bar_limit = max(2000, self.params["swingLength"] * 4 + 32)
        self._index = -1
        self.last_bar_time: int | None = None

    def on_closed_bar(self, bar: SmcBar, delta: int | None = None) -> list[FailBreakTrigger]:
        if self.last_bar_time is not None and bar.time <= self.last_bar_time:
            return []
        self.last_bar_time = bar.time
        self._index += 1
        self._bars[bar.time] = bar
        if len(self._bars) > self._bar_limit:
            del self._bars[next(iter(self._bars))]
        self._pb.update(bar, delta)
        event = self._detector.update(bar)
        results = self._process_setups(
            bar, self._pb.live_waves(),
            self._pb.live_signals() if self.params["requirePb"] else [], closed=True,
        )
        if event is not None:
            signal_direction = "long" if event.direction < 0 else "short"
            if self.params["direction"] in ("both", signal_direction):
                pivot = self._bars.get(event.pivot_time)
                body = (max(pivot.open, pivot.close) if event.direction > 0
                        else min(pivot.open, pivot.close)) if pivot else event.level
                bottom = min(body, event.level) if event.direction > 0 else event.level
                top = event.level if event.direction > 0 else max(body, event.level)
                outside = bar.high if event.direction > 0 else bar.low
                self._setups.append(_Setup(event, self._index, bottom, top, outside))
        return results

    def on_live_bar(self, bar: SmcBar, delta: int | None = None) -> list[FailBreakTrigger]:
        if self.last_bar_time is None or bar.time <= self.last_bar_time or not self._setups:
            return []
        return self._process_setups(
            bar, self._pb.live_waves(bar, delta),
            self._pb.live_signals(bar, delta) if self.params["requirePb"] else [], closed=False,
        )

    def _process_setups(
        self, bar: SmcBar, waves: list[MgannWave], signals: list[PbSignal], *, closed: bool,
    ) -> list[FailBreakTrigger]:
        results: list[FailBreakTrigger] = []
        remaining: list[_Setup] = []
        for setup in self._setups:
            if self._index - setup.index > self.params["maxBars"]:
                continue
            d = setup.event.direction
            inner = setup.zone_bottom if d > 0 else setup.zone_top
            outer = setup.zone_top if d > 0 else setup.zone_bottom
            extreme = bar.high if d > 0 else bar.low
            if setup.reclaim_time is None:
                if d * (extreme - setup.outside_price) > 0:
                    setup.outside_price = extreme
                if closed and d * (inner - bar.close) > 1e-9:
                    setup.reclaim_time = bar.time
                remaining.append(setup)
                continue
            # Sweep of the level itself is allowed. Breaking the outside A
            # extreme invalidates the failure, including on live updates.
            if d * (extreme - setup.outside_price) > 1e-9:
                continue
            for wave in waves:
                if (wave.direction == -d and wave.start_time >= setup.event.break_time
                        and wave.end_time >= setup.reclaim_time
                        and d * (wave.start_price - outer) > 0
                        and d * (inner - wave.end_price) > 1e-9):
                    self._remember_inside(setup, wave.end_time, wave.end_price)
                # A second/third pullback may extend B. It does not cancel the
                # return or impose a count of how many child waves may follow.
                elif (setup.inside_time is not None and wave.direction == -d
                      and wave.end_time > setup.inside_time
                      and d * (inner - wave.end_price) > 1e-9):
                    self._remember_inside(setup, wave.end_time, wave.end_price)
            current = waves[-1] if waves else None
            returning = (setup.inside_time is not None and current is not None
                         and current.direction == d and current.start_time >= setup.inside_time
                         and d * (inner - current.start_price) > 1e-9
                         and current.end_time > current.start_time)
            touches = bar.high >= setup.zone_bottom - 1e-9 and bar.low <= setup.zone_top + 1e-9
            at_zone = touches if closed else setup.zone_bottom - 1e-9 <= bar.close <= setup.zone_top + 1e-9
            pb_matches = bool(returning) and any(
                pb.direction == d and pb.time == current.end_time
                and pb.high >= setup.zone_bottom - 1e-9 and pb.low <= setup.zone_top + 1e-9
                for pb in signals
            )
            if returning and at_zone and (not self.params["requirePb"] or pb_matches):
                results.append(FailBreakTrigger(setup.event, bar.time, bar.close, pb_matches,
                                                setup.zone_bottom, setup.zone_top))
                continue
            remaining.append(setup)
        self._setups = remaining
        return results

    @staticmethod
    def _remember_inside(setup: _Setup, time: int, price: float) -> None:
        if (setup.inside_price is None
                or setup.event.direction * (setup.inside_price - price) > 1e-9):
            setup.inside_price = price
            setup.inside_time = time
