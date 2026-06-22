"""VolumeDelta_Engine: per-bar buy/sell classification and delta metrics.

The VolumeDelta_Engine consumes accepted :class:`~app.models.canonical.NormalizedTrade`
events for the Active_Contract, classifies each trade as buy or sell, and
maintains the per-bar order-flow metrics for a single timeframe. On every trade
it folds the classified volume into the current (in-progress) bar and produces a
:class:`~app.models.messages.VolumeDeltaUpdate` snapshot. (Requirements 13)

Classification (the ordered rule set, Requirements 13.2-13.5)
-------------------------------------------------------------
``classify(trade_price, bid, ask, last_side, prev_price)`` applies the rules in
strict priority order, returning the first that matches:

1. **bid/ask lean -- buy** (Req 13.2): ``ask`` is known and ``price >= ask``.
2. **bid/ask lean -- sell** (Req 13.3): ``bid`` is known and ``price <= bid``.
3. **uptick / downtick fallback** (Req 13.4): the trade printed between the
   bid and ask (or no snapshot was available); compare to the prior trade
   price -- ``price > prev_price`` is a buy (uptick), ``price < prev_price`` is
   a sell (downtick).
4. **reuse last side** (Req 13.5): the price did not change relative to the
   prior trade (or there is no prior trade to tick against); reuse the last
   classified side. When no side has ever been classified, the engine defaults
   to buy so classification is total and deterministic.

Because the rules are evaluated in order, a crossed (``bid > ask``) or locked
(``bid == ask``) book is resolved by rule 1 first and then rule 2 -- e.g. a
trade at or above the ask is always a buy even when the book is crossed.

Per-bar metrics (Requirement 13.1)
----------------------------------
For each bar the engine accumulates, in trade arrival order:

* ``volume``       -- total classified volume (``buyVolume + sellVolume``);
* ``buyVolume``    -- volume classified as buy;
* ``sellVolume``   -- volume classified as sell;
* ``delta``        -- ``buyVolume - sellVolume`` (the running intrabar delta);
* ``deltaHigh``    -- running maximum of the intrabar cumulative delta;
* ``deltaLow``     -- running minimum of the intrabar cumulative delta;
* ``openDelta``    -- the cumulative delta after the first trade in the bar;
* ``closeDelta``   -- the cumulative delta after the latest trade (== ``delta``).

The intrabar cumulative-delta series is seeded by the first trade (so
``openDelta``, ``deltaHigh``, and ``deltaLow`` all equal the first trade's
signed volume) and advanced by each subsequent trade's signed volume, so
``deltaLow <= openDelta <= deltaHigh`` and ``deltaLow <= closeDelta <=
deltaHigh`` hold by construction.

Modes (Requirements 13.6, 13.7)
-------------------------------
* ``min_trade_size`` defaults to ``0`` (no trade is filtered).
* In ``Delta`` mode (default) each update reports only the per-bar metrics.
* In ``CumulativeDelta`` mode each update additionally reports
  ``cumulativeDelta`` -- the running sum of every completed bar's final delta
  plus the current bar's running delta -- so the cumulative delta across bars
  equals the running sum of per-bar deltas.

Bucketization mirrors the Bar_Aggregator: regular intraday trade times
(Canonical_Timestamp, ms since epoch UTC) are floored to multiples of the
configured timeframe interval, while ``4h`` and ``1D`` use the GC
trading-session grid. Out-of-session trades are ignored.
Classification state (``prev_price`` / ``last_side``) is continuous across bar
boundaries, matching the reference indicator's tick-direction tracking. Trades
are expected to arrive with non-decreasing timestamps (guaranteed upstream by
the sequence validator); a trade whose bucket precedes the current bar is
ignored so already-closed bars are never corrupted.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from app.engines.session_calendar import (
    TF_MS as _TF_MS,
    is_gc_session_open,
    timeframe_bucket_start,
)
from app.models.canonical import NormalizedTrade, Side
from app.models.messages import VolumeDeltaUpdate

__all__ = ["VolumeDeltaMode", "VolumeDeltaEngine", "DEFAULT_TIMEFRAME"]

DEFAULT_TIMEFRAME = "1m"


class VolumeDeltaMode(str, Enum):
    """Delta accumulation mode. (Req 13.6, 13.7)"""

    DELTA = "Delta"
    CUMULATIVE = "CumulativeDelta"

    def __str__(self) -> str:  # pragma: no cover - cosmetic
        return self.value


@dataclass(slots=True)
class _BarState:
    """Mutable accumulator for the current in-progress bar of one contract."""

    time: int
    volume: int
    buy_volume: int
    sell_volume: int
    running_delta: int
    delta_high: int
    delta_low: int
    open_delta: int


class VolumeDeltaEngine:
    """Classify trades and compute per-bar volume-delta metrics. (Req 13)"""

    def __init__(
        self,
        *,
        timeframe: str = DEFAULT_TIMEFRAME,
        mode: VolumeDeltaMode = VolumeDeltaMode.DELTA,
        min_trade_size: int = 0,
    ) -> None:
        if timeframe not in _TF_MS:
            raise ValueError(f"unsupported timeframe: {timeframe!r}")
        if min_trade_size < 0:
            raise ValueError("min_trade_size must be >= 0")
        self.timeframe = timeframe
        self.mode = mode
        self.min_trade_size = min_trade_size

        # Continuous classification state, keyed by contract.
        self._prev_price: dict[str, float] = {}
        self._last_side: dict[str, Side] = {}
        # Current in-progress bar, keyed by contract.
        self._bar: dict[str, _BarState] = {}
        # Sum of every completed bar's final delta, keyed by contract. Used for
        # the CumulativeDelta running sum. (Req 13.7)
        self._closed_delta_sum: dict[str, int] = {}

    # -- classification -------------------------------------------------------

    def classify(
        self,
        trade_price: float,
        bid: float | None,
        ask: float | None,
        last_side: Side | None,
        prev_price: float | None,
    ) -> Side:
        """Classify a trade as buy/sell by the ordered rule set. (Req 13.2-13.5)

        Rules are evaluated in strict priority order; the first match wins:

        1. ``ask`` known and ``trade_price >= ask`` -> buy (Req 13.2).
        2. ``bid`` known and ``trade_price <= bid`` -> sell (Req 13.3).
        3. otherwise tick against ``prev_price``: up -> buy, down -> sell
           (Req 13.4).
        4. otherwise (no price change, or no prior trade) reuse ``last_side``,
           defaulting to buy when nothing has been classified yet (Req 13.5).
        """
        # Rule 1: at or above the ask is aggressive buying. (Req 13.2)
        if ask is not None and trade_price >= ask:
            return Side.BUY
        # Rule 2: at or below the bid is aggressive selling. (Req 13.3)
        if bid is not None and trade_price <= bid:
            return Side.SELL
        # Rule 3: between the bid/ask (or no snapshot) -> uptick/downtick. (Req 13.4)
        if prev_price is not None:
            if trade_price > prev_price:
                return Side.BUY
            if trade_price < prev_price:
                return Side.SELL
        # Rule 4: no price change / no prior tick -> reuse the last side. (Req 13.5)
        if last_side is not None:
            return last_side
        return Side.BUY

    # -- per-bar metrics ------------------------------------------------------

    def bucket_start(self, ts_ms: int) -> int:
        """Floor a Canonical_Timestamp to the start of its timeframe bucket."""
        return timeframe_bucket_start(ts_ms, self.timeframe)

    def on_trade(self, t: NormalizedTrade) -> VolumeDeltaUpdate | None:
        """Classify ``t`` and fold it into the current bar; return the snapshot.

        Returns ``None`` when the trade is filtered by ``min_trade_size`` or is
        out of order (its bucket precedes the current bar). (Req 13.1, 13.6, 13.7)
        """
        if t.volume < self.min_trade_size:
            return None
        if not is_gc_session_open(t.time):
            return None

        bucket = self.bucket_start(t.time)
        bar = self._bar.get(t.contract)
        if bar is not None and bucket < bar.time:
            # Out-of-order trade for an already-closed bucket: ignore it.
            return None

        side = self.classify(
            t.price,
            t.bid,
            t.ask,
            self._last_side.get(t.contract),
            self._prev_price.get(t.contract),
        )
        # Advance continuous classification state.
        self._prev_price[t.contract] = t.price
        self._last_side[t.contract] = side

        signed = t.volume if side is Side.BUY else -t.volume

        if bar is None or bucket > bar.time:
            # Roll a completed bar into the cumulative sum before resetting.
            if bar is not None:
                self._closed_delta_sum[t.contract] = (
                    self._closed_delta_sum.get(t.contract, 0) + bar.running_delta
                )
            bar = _BarState(
                time=bucket,
                volume=t.volume,
                buy_volume=t.volume if side is Side.BUY else 0,
                sell_volume=t.volume if side is Side.SELL else 0,
                running_delta=signed,
                delta_high=signed,
                delta_low=signed,
                open_delta=signed,
            )
            self._bar[t.contract] = bar
        else:
            # Same bucket: fold the classified volume into the current bar.
            bar.volume += t.volume
            if side is Side.BUY:
                bar.buy_volume += t.volume
            else:
                bar.sell_volume += t.volume
            bar.running_delta += signed
            if bar.running_delta > bar.delta_high:
                bar.delta_high = bar.running_delta
            if bar.running_delta < bar.delta_low:
                bar.delta_low = bar.running_delta

        return self._build_update(t, bar)

    def current_update(self, contract: str) -> VolumeDeltaUpdate | None:
        """Return a snapshot of the current in-progress bar, or ``None``."""
        bar = self._bar.get(contract)
        if bar is None:
            return None
        return self._build_update_for(contract, "GC", bar)

    def seed_bar(
        self,
        contract: str,
        *,
        time: int,
        volume: int,
        buy_volume: int,
        sell_volume: int,
        delta_high: int,
        delta_low: int,
        open_delta: int,
        close_delta: int,
        last_price: float | None = None,
    ) -> None:
        """Seed the current in-progress delta bar for ``contract``.

        This is used on live pipeline startup to continue an already-open cache
        row after a backend restart. ``last_price`` only seeds tick-rule
        direction fallback; bid/ask classification remains preferred.
        """
        self._bar[contract] = _BarState(
            time=time,
            volume=volume,
            buy_volume=buy_volume,
            sell_volume=sell_volume,
            running_delta=close_delta,
            delta_high=delta_high,
            delta_low=delta_low,
            open_delta=open_delta,
        )
        if last_price is not None:
            self._prev_price[contract] = last_price

    def reset_contract(self, contract: str) -> None:
        """Drop all per-bar + classification state for ``contract``.

        Used on a playback rewind so the engine re-aggregates from the earlier
        time instead of ignoring the replayed trades as out-of-order.
        """
        self._prev_price.pop(contract, None)
        self._last_side.pop(contract, None)
        self._bar.pop(contract, None)
        self._closed_delta_sum.pop(contract, None)

    def _build_update(
        self, t: NormalizedTrade, bar: _BarState
    ) -> VolumeDeltaUpdate:
        return self._build_update_for(t.contract, t.symbol, bar)

    def _build_update_for(
        self, contract: str, symbol: str, bar: _BarState
    ) -> VolumeDeltaUpdate:
        cumulative: int | None = None
        if self.mode is VolumeDeltaMode.CUMULATIVE:
            cumulative = self._closed_delta_sum.get(contract, 0) + bar.running_delta
        return VolumeDeltaUpdate(
            symbol=symbol,
            contract=contract,
            tf=self.timeframe,
            time=bar.time,
            volume=bar.volume,
            buy_volume=bar.buy_volume,
            sell_volume=bar.sell_volume,
            delta=bar.running_delta,
            delta_high=bar.delta_high,
            delta_low=bar.delta_low,
            open_delta=bar.open_delta,
            close_delta=bar.running_delta,
            cumulative_delta=cumulative,
        )
