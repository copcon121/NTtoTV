"""Footprint_Engine: per-M1-bar bid-by-ask ladder and footprint metrics.

The Footprint_Engine consumes accepted :class:`~app.models.canonical.NormalizedTrade`
events for the Active_Contract and builds, per M1 (1-minute) bar, the
bid-by-ask price ladder and its derived metrics: POC, bar delta, buy%/sell%,
value area, per-level diagonal imbalance, Stacked_Imbalance runs, and
unfinished-auction flags. On every trade it folds the classified volume into
the current bar's ladder and produces a
:class:`~app.models.messages.FootprintUpdate` snapshot. (Requirements 14.1,
14.3, 14.4, 14.5, 14.10)

Classification mirrors ``MzFootprintClone`` with ``DeltaCalculationMode=0``
(``BidAsk``): a trade is **buy** only when ``price >= ask`` and **sell** only
when ``price <= bid``. Trades inside the spread still create a price row but do
not add volume to either side. A buy adds to the level's ``ask_volume``
(aggressive lifting of the offer); a sell adds to ``bid_volume`` (aggressive
hitting of the bid). (Req 14.5)

Ladder construction (Req 14.3):

* Levels are keyed by price. ``GroupTicksPerLevel`` defaults to ``0`` (native
  tick granularity -> one level per distinct traded price). When grouping is
  enabled the trade price is floored to the nearest ``group_ticks * tick_size``
  multiple so nearby prices share a level.
* Trades with ``volume < TradeVolumeFilter`` (default 0 -> none excluded) are
  ignored. (Req 14.5)

Per-bar metrics (Req 14.4):

* **POC** (Point of Control): the price level with maximum total volume
  (``bid_volume + ask_volume``); ties broken by highest total then highest
  price (documented deterministic tie-break).
* **VAH/VAL**: MZpack-style value area. Start at POC, target
  ``total_volume * 70%``, then expand one tick at a time toward the adjacent
  side with greater volume, including both sides on ties.
* **bar delta** = ``Σ ask_volume − Σ bid_volume`` across levels.
* **buy% / sell%** = ``Σ ask_volume / total`` and ``Σ bid_volume / total``
  (both ``0`` when total == 0).
* **imbalance** (per level, diagonal): a level's ``ask_volume`` is compared
  against the **next-lower** level's ``bid_volume``. The ask side is imbalanced
  when ``ask_volume`` exceeds that diagonal ``bid_volume`` by
  ``ImbalancePercent`` (100%, i.e. ``ask >= bid_diag * (1 + 100/100)`` =
  ``ask >= 2 * bid_diag``) **and** ``ask_volume >= ImbalanceMinVolume`` (10).
  Symmetrically the bid side is imbalanced when this level's ``bid_volume``
  dominates the next-**higher** level's diagonal ``ask_volume``. (Req 14.5)
* **Stacked_Imbalance**: a run of ``>= 2`` consecutive price levels imbalanced
  on the same side. (Req 14.10)
* **unfinished auction**: at the bar's extreme high (or low) level, both bid
  and ask volumes are non-zero (the extreme was not finished by one-sided
  trading).

**Ladder conservation invariant**: ``Σ(bid_volume + ask_volume)`` over all
levels equals the bar's total traded (filtered) volume.

Bucketization mirrors the Bar_Aggregator at the 1m timeframe: trade times
(Canonical_Timestamp, ms since epoch UTC) are floored to 60,000 ms multiples,
which land on UTC minute boundaries. Trades are expected to arrive with
non-decreasing timestamps (guaranteed upstream by the sequence validator); a
trade whose bucket precedes the current bar is ignored so an already-closed bar
is never corrupted.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from app.models.canonical import NormalizedTrade, Side
from app.models.messages import (
    FootprintRow,
    FootprintUpdate,
    ImbalanceSide,
    StackedImbalance,
    UnfinishedAuction,
)

__all__ = [
    "FOOTPRINT_TIMEFRAME",
    "DEFAULT_IMBALANCE_PERCENT",
    "DEFAULT_IMBALANCE_MIN_VOLUME",
    "DEFAULT_GROUP_TICKS_PER_LEVEL",
    "DEFAULT_TRADE_VOLUME_FILTER",
    "DEFAULT_TICK_SIZE",
    "DEFAULT_VALUE_AREA_PERCENT",
    "FootprintEngine",
]

# v1 footprint is computed at the 1-minute timeframe only. (Req 14.1)
FOOTPRINT_TIMEFRAME = "1m"
_TF_MS = 60_000

# Imbalance / grouping defaults (Req 14.5, 14.10; design "Footprint Ladder").
DEFAULT_IMBALANCE_PERCENT = 100.0
DEFAULT_IMBALANCE_MIN_VOLUME = 10
DEFAULT_GROUP_TICKS_PER_LEVEL = 0
DEFAULT_TRADE_VOLUME_FILTER = 0
# GC futures tick size (used only when GroupTicksPerLevel > 0 to size a level).
DEFAULT_TICK_SIZE = 0.1
DEFAULT_VALUE_AREA_PERCENT = 70.0


@dataclass(slots=True)
class _Level:
    """Mutable bid/ask accumulator for a single price level of the ladder."""

    bid_volume: int = 0
    ask_volume: int = 0


@dataclass(slots=True)
class _BarState:
    """Mutable accumulator for the current in-progress footprint bar."""

    time: int
    open: float
    high: float
    low: float
    close: float
    levels: dict[float, _Level] = field(default_factory=dict)


class FootprintEngine:
    """Build the bid-by-ask ladder and footprint metrics per M1 bar. (Req 14)"""

    def __init__(
        self,
        *,
        imbalance_percent: float = DEFAULT_IMBALANCE_PERCENT,
        imbalance_min_volume: int = DEFAULT_IMBALANCE_MIN_VOLUME,
        group_ticks_per_level: int = DEFAULT_GROUP_TICKS_PER_LEVEL,
        trade_volume_filter: int = DEFAULT_TRADE_VOLUME_FILTER,
        tick_size: float = DEFAULT_TICK_SIZE,
        value_area_percent: float = DEFAULT_VALUE_AREA_PERCENT,
    ) -> None:
        if imbalance_percent < 0:
            raise ValueError("imbalance_percent must be >= 0")
        if imbalance_min_volume < 0:
            raise ValueError("imbalance_min_volume must be >= 0")
        if group_ticks_per_level < 0:
            raise ValueError("group_ticks_per_level must be >= 0")
        if trade_volume_filter < 0:
            raise ValueError("trade_volume_filter must be >= 0")
        if tick_size <= 0:
            raise ValueError("tick_size must be > 0")
        if not 0 <= value_area_percent <= 100:
            raise ValueError("value_area_percent must be between 0 and 100")
        self.imbalance_percent = imbalance_percent
        self.imbalance_min_volume = imbalance_min_volume
        self.group_ticks_per_level = group_ticks_per_level
        self.trade_volume_filter = trade_volume_filter
        self.tick_size = tick_size
        self.value_area_percent = value_area_percent

        # Current in-progress footprint bar, keyed by contract.
        self._bar: dict[str, _BarState] = {}
        # Symbol seen per contract (for emitted updates).
        self._symbol: dict[str, str] = {}

    # -- classification (mirrors VolumeDelta's ordered rule set, Req 14.5) ----

    def classify(
        self,
        trade_price: float,
        bid: float | None,
        ask: float | None,
        last_side: Side | None,
        prev_price: float | None,
    ) -> Side | None:
        """Classify one trade by NT ``DeltaCalculationMode=0`` BidAsk rules.

        ``last_side`` and ``prev_price`` are accepted only for call-site
        compatibility with other order-flow engines; the NT footprint clone does
        not use an uptick/downtick fallback in BidAsk mode.
        """
        _ = last_side, prev_price
        if ask is not None and trade_price >= ask:
            return Side.BUY
        if bid is not None and trade_price <= bid:
            return Side.SELL
        return None

    # -- bucketization & price grouping ---------------------------------------

    def bucket_start(self, ts_ms: int) -> int:
        """Floor a Canonical_Timestamp to the start of its 1m bucket."""
        return (ts_ms // _TF_MS) * _TF_MS

    def level_price(self, price: float) -> float:
        """Map a trade price to its ladder level price (per GroupTicksPerLevel).

        With ``group_ticks_per_level == 0`` the native price is the level
        (rounded to a tick to avoid float-key drift). Otherwise the price is
        floored to a multiple of ``group_ticks_per_level * tick_size``.
        """
        if self.group_ticks_per_level <= 0:
            # Snap to the tick grid so equal traded prices share an exact key.
            return round(round(price / self.tick_size) * self.tick_size, 10)
        step = self.group_ticks_per_level * self.tick_size
        return round(math.floor(price / step) * step, 10)

    # -- ingest ---------------------------------------------------------------

    def on_trade(self, t: NormalizedTrade) -> FootprintUpdate | None:
        """Classify ``t``, fold it into the current bar's ladder, return snapshot.

        Returns ``None`` when the trade is filtered by ``trade_volume_filter`` or
        is out of order (its bucket precedes the current bar). (Req 14.3-14.5)
        """
        if t.volume < self.trade_volume_filter:
            return None

        bucket = self.bucket_start(t.time)
        bar = self._bar.get(t.contract)
        if bar is not None and bucket < bar.time:
            return None  # out-of-order trade for an already-closed bar

        side = self.classify(
            t.price,
            t.bid,
            t.ask,
            None,
            None,
        )
        self._symbol[t.contract] = t.symbol

        if bar is None or bucket > bar.time:
            bar = _BarState(
                time=bucket,
                open=t.price,
                high=t.price,
                low=t.price,
                close=t.price,
            )
            self._bar[t.contract] = bar
        else:
            bar.high = max(bar.high, t.price)
            bar.low = min(bar.low, t.price)
            bar.close = t.price

        level_price = self.level_price(t.price)
        level = bar.levels.get(level_price)
        if level is None:
            level = _Level()
            bar.levels[level_price] = level
        # A buy lifts the ask (ask_volume); a sell hits the bid (bid_volume).
        if side is Side.BUY:
            level.ask_volume += t.volume
        elif side is Side.SELL:
            level.bid_volume += t.volume

        return self._build_update(t.contract, t.symbol, bar)

    def current_update(self, contract: str) -> FootprintUpdate | None:
        """Return a snapshot of the current in-progress footprint bar or None."""
        bar = self._bar.get(contract)
        if bar is None:
            return None
        return self._build_update(contract, self._symbol.get(contract, "GC"), bar)

    def reset_contract(self, contract: str) -> None:
        """Drop all per-bar + classification state for ``contract`` (rewind)."""
        self._bar.pop(contract, None)
        self._symbol.pop(contract, None)

    # -- metrics --------------------------------------------------------------

    def _build_update(
        self, contract: str, symbol: str, bar: _BarState
    ) -> FootprintUpdate:
        # Levels in descending price order (top of book first), matching the
        # ladder display convention and the storage read order.
        prices_desc = sorted(bar.levels.keys(), reverse=True)
        imbalances = self._compute_imbalances(bar, prices_desc)
        poc_price, poc_volume, vah, val = self._compute_profile_levels(bar)

        rows: list[FootprintRow] = []
        total_bid = 0
        total_ask = 0
        for price in prices_desc:
            lvl = bar.levels[price]
            total_bid += lvl.bid_volume
            total_ask += lvl.ask_volume
            rows.append(
                FootprintRow(
                    price=price,
                    bid=lvl.bid_volume,
                    ask=lvl.ask_volume,
                    imbalance=imbalances.get(price),
                )
            )

        total = total_bid + total_ask
        bar_delta = total_ask - total_bid
        buy_pct = (total_ask / total) if total > 0 else 0.0
        sell_pct = (total_bid / total) if total > 0 else 0.0

        stacked = self._compute_stacked(prices_desc, imbalances)
        unfinished = self._compute_unfinished(bar, prices_desc)

        return FootprintUpdate(
            symbol=symbol,
            contract=contract,
            tf=FOOTPRINT_TIMEFRAME,
            time=bar.time,
            rows=rows,
            open=bar.open,
            high=bar.high,
            low=bar.low,
            close=bar.close,
            poc=poc_price,
            poc_volume=poc_volume,
            vah=vah,
            val=val,
            bar_delta=bar_delta,
            buy_pct=buy_pct,
            sell_pct=sell_pct,
            stacked_imbalance=stacked,
            unfinished_auction=unfinished,
        )

    def _is_imbalanced(self, dominant: int, opposing_diagonal: int) -> bool:
        """Whether ``dominant`` exceeds ``opposing_diagonal`` by the threshold.

        Imbalanced iff ``dominant >= opposing_diagonal * (1 + percent/100)`` and
        ``dominant >= ImbalanceMinVolume``. With the default 100% this means the
        dominant volume is at least double the opposing diagonal volume.
        """
        if dominant < self.imbalance_min_volume:
            return False
        if opposing_diagonal == 0:
            return True
        factor = 1.0 + self.imbalance_percent / 100.0
        return (dominant / opposing_diagonal) >= factor

    def _compute_imbalances(
        self, bar: _BarState, prices_desc: list[float]
    ) -> dict[float, ImbalanceSide]:
        """Compute the imbalanced side (if any) per price level. (Req 14.5)

        This mirrors ``MzFootprintClone.CalculateImbalances``: for each lower
        price row, compare its bid against the ask at ``price + step``. A bid
        dominance is a sell/bid imbalance at the lower price. An ask dominance
        is a buy/ask imbalance at the upper price.
        """
        result: dict[float, ImbalanceSide] = {}
        step = self._price_step()
        for price in sorted(prices_desc):
            lvl = bar.levels[price]
            price_above = round(price + step, 10)
            row_above = bar.levels.get(price_above)
            ask_above = 0 if row_above is None else row_above.ask_volume

            if self._is_imbalanced(lvl.bid_volume, ask_above):
                result[price] = ImbalanceSide.BID
            if self._is_imbalanced(ask_above, lvl.bid_volume):
                result[price_above] = ImbalanceSide.ASK
        return result

    def _compute_profile_levels(self, bar: _BarState) -> tuple[float, int, float, float]:
        """Return ``(poc, poc_volume, vah, val)`` using the NT/MZpack VA walk."""
        if not bar.levels:
            return 0.0, 0, 0.0, 0.0

        prices = sorted(bar.levels)
        poc = prices[0]
        poc_volume = -1
        total_volume = 0
        for price in prices:
            lvl = bar.levels[price]
            volume = lvl.bid_volume + lvl.ask_volume
            total_volume += volume
            if volume > poc_volume or (volume == poc_volume and price > poc):
                poc = price
                poc_volume = volume

        vah = poc
        val = poc
        target = total_volume * self.value_area_percent / 100.0
        accumulated = poc_volume
        step = self._price_step()
        lower_price = round(poc - step, 10)
        upper_price = round(poc + step, 10)

        while accumulated < target:
            lower_row = bar.levels.get(lower_price)
            upper_row = bar.levels.get(upper_price)
            lower_volume = (
                0 if lower_row is None else lower_row.bid_volume + lower_row.ask_volume
            )
            upper_volume = (
                0 if upper_row is None else upper_row.bid_volume + upper_row.ask_volume
            )

            if lower_volume <= 0 and upper_volume <= 0:
                break
            if lower_volume > 0 and lower_volume > upper_volume:
                accumulated += lower_volume
                val = lower_price
                lower_price = round(lower_price - step, 10)
            elif upper_volume > 0 and upper_volume > lower_volume:
                accumulated += upper_volume
                vah = upper_price
                upper_price = round(upper_price + step, 10)
            else:
                if lower_volume > 0:
                    accumulated += lower_volume
                    val = lower_price
                    lower_price = round(lower_price - step, 10)
                if upper_volume > 0:
                    accumulated += upper_volume
                    vah = upper_price
                    upper_price = round(upper_price + step, 10)

        return poc, max(0, poc_volume), vah, val

    def _price_step(self) -> float:
        if self.group_ticks_per_level > 0:
            return self.group_ticks_per_level * self.tick_size
        return self.tick_size

    def _compute_stacked(
        self,
        prices_desc: list[float],
        imbalances: dict[float, ImbalanceSide],
    ) -> list[StackedImbalance]:
        """Find runs of >=2 consecutive same-side imbalanced levels. (Req 14.10)"""
        stacked: list[StackedImbalance] = []
        run: list[float] = []
        run_side: ImbalanceSide | None = None
        for price in prices_desc:
            side = imbalances.get(price)
            if side is not None and side == run_side:
                run.append(price)
            else:
                if run_side is not None and len(run) >= 2:
                    stacked.append(self._stacked_from_run(run_side, run))
                if side is not None:
                    run = [price]
                    run_side = side
                else:
                    run = []
                    run_side = None
        if run_side is not None and len(run) >= 2:
            stacked.append(self._stacked_from_run(run_side, run))
        return stacked

    @staticmethod
    def _stacked_from_run(
        side: ImbalanceSide, run: list[float]
    ) -> StackedImbalance:
        lo = min(run)
        hi = max(run)
        return StackedImbalance(side=side, from_price=lo, to_price=hi)

    @staticmethod
    def _compute_unfinished(
        bar: _BarState, prices_desc: list[float]
    ) -> UnfinishedAuction:
        """Flag unfinished auction at the extreme high/low levels. (Req 14)

        An extreme is unfinished when both its bid and ask volumes are non-zero
        (the auction was not finished by one-sided trading at that extreme).
        """
        if not prices_desc:
            return UnfinishedAuction(high=False, low=False)
        high_level = bar.levels[prices_desc[0]]
        low_level = bar.levels[prices_desc[-1]]
        return UnfinishedAuction(
            high=high_level.bid_volume > 0 and high_level.ask_volume > 0,
            low=low_level.bid_volume > 0 and low_level.ask_volume > 0,
        )
