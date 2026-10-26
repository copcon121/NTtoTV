"""Base OF7 unfinished-level state, separate from its 33 detector IDs.

DetectUnfinishedBusinessOnBarClose is called even when its display toggle is
off. It updates older lines before creating the current closed bar's line;
touching an extreme is not enough to finalize it. Rendering/swing visibility
is a separate concern and does not change this stored state.
"""

from dataclasses import replace

from .models import OF7Bar, OF7UnfinishedLevel, OF7UnfinishedState


class OF7UnfinishedTracker:
    def __init__(self) -> None:
        self._open: dict[int, OF7UnfinishedLevel] = {}
        self._last_index: int | None = None
        self._identity: tuple[str, str, int] | None = None

    def update(self, bar: OF7Bar, *, bar_index: int,
               chart_high: int | None = None, chart_low: int | None = None) -> OF7UnfinishedState:
        if not bar.is_closed:
            raise ValueError("unfinished levels advance only on closed bars")
        if type(bar_index) is not int or bar_index < 0:
            raise ValueError("invalid unfinished reference bar index")
        if self._last_index is not None and bar_index != self._last_index + 1:
            raise ValueError("unfinished reference history must be consecutive")
        identity = (bar.source, bar.source_contract, bar.timeframe_ms)
        if self._identity is not None and identity != self._identity:
            raise ValueError("start separate unfinished history for source/contract/timeframe")
        high = bar.high if chart_high is None else chart_high
        low = bar.low if chart_low is None else chart_low
        if type(high) is not int or type(low) is not int or low > high:
            raise ValueError("chart extremes must be consistent integer ticks")
        finalized = []
        created = []
        # The NT caller requires CurrentBar>1 and evaluates CurrentBar-1,
        # hence origin 0 is not tracked through this base-state method.
        if bar_index >= 1:
            for origin, level in tuple(self._open.items()):
                if (level.side == "high" and high > level.price) or (level.side == "low" and low < level.price):
                    finalized.append(replace(level, end_index=bar_index))
                    del self._open[origin]
            cells = {cell.price: cell for cell in bar.cells}
            if bar.up and bar.high in cells and cells[bar.high].bid > 0:
                created.append(OF7UnfinishedLevel(bar_index, bar.high, "high"))
            elif bar.down and bar.low in cells and cells[bar.low].ask > 0:
                created.append(OF7UnfinishedLevel(bar_index, bar.low, "low"))
            for level in created:
                self._open[level.origin_index] = level
        self._identity = identity
        self._last_index = bar_index
        return OF7UnfinishedState(bar_index, tuple(created), tuple(finalized), tuple(self._open.values()))
