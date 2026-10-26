"""Tick-ordered OF7 ladder, POC and incremental Value Area reconstruction.

Ported from OFT 7.0.1.0 ``BarData.AddTick`` and ``XArray<T>`` inspected with
REA/ILSpy. This deliberately preserves the DLL's Bid-POC comparison quirk.
Input must already be normalized by the caller: one bar, integer ladder ticks,
and the effective volume passed to AddTick. NinjaTrader's processor volume
reconciliation, tick aggregation/up-down mode, block and diagonal display
statistics are outside this class. It performs no live I/O or execution.
"""

from bisect import bisect_left, insort
from dataclasses import replace

from .config import OF7Config
from .models import OF7Bar, OF7Cell, OF7Frame


class OF7StreamLadder:
    """One accumulator per bar. Order matters even for identical final cells."""

    def __init__(self, config: OF7Config | None = None) -> None:
        self.config = config or OF7Config()
        self._cells: dict[int, list[int]] = {}
        self._prices: list[int] = []
        self.open: int | None = None
        self.high: int | None = None
        self.low: int | None = None
        self.close: int | None = None
        self.poc: int | None = None
        self.poc_ask: int | None = None
        self.poc_bid: int | None = None
        self.val: int | None = None
        self.vah: int | None = None
        self._value_area_volume = 0
        self.volume_cum = 0
        self.delta_max = 0
        self.delta_min = 0
        self._volume = 0
        self._delta = 0

    @property
    def volume(self) -> int:
        return self._volume

    @property
    def delta(self) -> int:
        return self._delta

    def _volume_at(self, price: int | None, side: int | None = None) -> int:
        values = self._cells.get(price, (0, 0, 0))
        return sum(values) if side is None else values[side]

    def _neighbors(self, price: int, side: int | None = None) -> int:
        return sum(self._volume_at(p, side) for p in (price - 1, price, price + 1))

    def _adjacent_real(self, price: int, step: int) -> int | None:
        index = bisect_left(self._prices, price)
        if index == len(self._prices) or self._prices[index] != price:
            return None
        index += step
        return self._prices[index] if 0 <= index < len(self._prices) else None

    def _reset_value_area(self, price: int) -> None:
        self.poc = price
        self._value_area_volume = self._volume_at(price)
        self.val = self.vah = price

    def add_tick(self, price: int, volume: int, bid: int | None, ask: int | None) -> None:
        if type(price) is not int or any(v is not None and type(v) is not int for v in (bid, ask)):
            raise ValueError("price and nonmissing quotes must be integer ticks")
        if type(volume) is not int or volume < 0:
            raise ValueError("volume must be a nonnegative integer")
        first = not self._cells
        if first:
            self.open = self.poc = self.poc_ask = self.poc_bid = price
            self.high = self.low = price
        self.high = max(self.high, price)
        self.low = min(self.low, price)
        self.close = price
        if price not in self._cells:
            self._cells[price] = [0, 0, 0]  # Bid, Ask, Between
            insort(self._prices, price)
        values = self._cells[price]
        # Match BarData, including a locked quote exactly at the trade price.
        # Crossed/absent quotes do not justify silently calling it Between.
        classification = None
        if bid is not None and ask is not None:
            if price <= bid and bid < ask:
                classification = 0
            elif price >= ask and ask > bid:
                classification = 1
            elif bid < price < ask or bid == ask == price:
                classification = 2
        if classification is not None:
            values[classification] += volume
            self._volume += volume
            self._delta += volume if classification == 1 else -volume if classification == 0 else 0
        self.volume_cum += volume
        self.delta_max = max(self.delta_max, self.delta)
        self.delta_min = min(self.delta_min, self.delta)

        reset = False
        cell_volume = sum(values)
        poc_volume = self._volume_at(self.poc)
        if cell_volume <= poc_volume and not first:
            if cell_volume == poc_volume:
                if self._neighbors(price) > self._neighbors(self.poc):
                    self._reset_value_area(price)
                    reset = True
            elif ((price > self.vah and cell_volume >= self._volume_at(self.val))
                  or (price < self.val and cell_volume >= self._volume_at(self.vah))):
                self._reset_value_area(self.poc)
                reset = True
        else:
            self._reset_value_area(price)
            reset = True

        if values[1] <= self._volume_at(self.poc_ask, 1) and not first:
            if values[1] == self._volume_at(self.poc_ask, 1):
                if self._neighbors(price, 1) > self._neighbors(self.poc_ask, 1):
                    self.poc_ask = price
        else:
            self.poc_ask = price
        # Artifact compares candidate Bid against GENERAL POC's Bid, not the
        # current Bid-POC. Preserve it for parity rather than correcting silently.
        if values[0] <= self._volume_at(self.poc, 0) and not first:
            if values[0] == self._volume_at(self.poc, 0):
                if self._neighbors(price, 0) > self._neighbors(self.poc_bid, 0):
                    self.poc_bid = price
        else:
            self.poc_bid = price

        if self.volume <= 0:
            return
        target = self.config.value_area_percent
        if not reset and self.val <= price <= self.vah:
            # BarData increments by the input volume even on an unclassified
            # tick. volume_cum vs volume lets a caller detect such feed issues.
            self._value_area_volume += volume
            while True:
                lower = self._volume_at(self.val)
                upper = self._volume_at(self.vah)
                changed = False
                if (lower < upper and self.val < self.poc
                        and 100 * (self._value_area_volume - lower) > target * self.volume):
                    next_price = self._adjacent_real(self.val, 1)
                    if next_price is not None:
                        self.val = next_price
                        self._value_area_volume -= lower
                        changed = True
                if (lower >= upper and self.vah > self.poc
                        and 100 * (self._value_area_volume - upper) > target * self.volume):
                    previous_price = self._adjacent_real(self.vah, -1)
                    if previous_price is not None:
                        self.vah = previous_price
                        self._value_area_volume -= upper
                        changed = True
                if not changed:
                    break
            return
        while 100 * self._value_area_volume < target * self.volume:
            next_price = self._adjacent_real(self.vah, 1)
            previous_price = self._adjacent_real(self.val, -1)
            if next_price is not None:
                upper = self._volume_at(next_price)
                if previous_price is None or upper >= self._volume_at(previous_price):
                    self.vah = next_price
                    self._value_area_volume += upper
                else:
                    self.val = previous_price
                    self._value_area_volume += self._volume_at(previous_price)
            elif previous_price is not None:
                self.val = previous_price
                self._value_area_volume += self._volume_at(previous_price)
            else:
                break

    def snapshot(
        self, time: int, session_id: str, *, is_closed: bool,
        source: str, source_contract: str, timeframe_ms: int = 60_000,
    ) -> OF7Bar:
        if not self._cells:
            raise ValueError("cannot snapshot an empty ladder")
        return OF7Bar(
            time=time, open=self.open, high=self.high, low=self.low, close=self.close,
            cells=tuple(OF7Cell(p, *self._cells[p]) for p in self._prices),
            session_id=session_id, is_closed=is_closed, source=source,
            source_contract=source_contract, between_known=True, timeframe_ms=timeframe_ms,
            observed_volume=self.volume_cum,
        )

    def frame(
        self, bar: OF7Bar, *, is_session_high: bool = False,
        is_session_low: bool = False,
    ) -> OF7Frame:
        # Import here to keep the stream usable without introducing an import
        # cycle if the engine later accepts an ordered-stream frame override.
        from .engine import build_frame

        expected = self.snapshot(bar.time, bar.session_id, is_closed=bar.is_closed,
                                 source=bar.source, source_contract=bar.source_contract,
                                 timeframe_ms=bar.timeframe_ms)
        if (bar.cells, bar.open, bar.high, bar.low, bar.close) != (
            expected.cells, expected.open, expected.high, expected.low, expected.close
        ):
            raise ValueError("bar does not match the current ordered stream")
        base = build_frame(bar, self.config, is_session_high=is_session_high,
                           is_session_low=is_session_low)
        return replace(base, poc=self.poc, poc_bid=self.poc_bid, poc_ask=self.poc_ask,
                       val=self.val, vah=self.vah)
