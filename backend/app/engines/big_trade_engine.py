"""BigTrade_Engine: tape reconstruction, merge, and volume-filtered emission.

The BigTrade_Engine reconstructs the trade tape in **simple mode** (no iceberg
detection, DOM pressure, or DOM support - Req 15.1), classifies each trade's
side using the ordered rule set from the local NinjaTrader BigTradeIndicator,
merges adjacent fragments the same way that indicator's ``currentTrade`` merge
does, and emits a :class:`~app.models.messages.BigTrade` for each merged entry
that passes the volume filter. (Requirements 15.1-15.4)

Merge (Req 15.2)
----------------
NinjaTrader's BigTradeIndicator merges only when ``ReconstructTape`` is enabled
and the incoming print is adjacent to the current group with the exact same
timestamp and side. A same-timestamp opposite-side print finalizes the current
group; if the original side appears again at that timestamp it becomes a new
BigTrade with a new ``trade_id``. The rendered ``price`` is the group's
``LastPrice``: the last tick price added to that group.

Filter (Req 15.3, 15.4)
-----------------------
With ``VolumeFilterEnable = True`` (default) a merged entry is emitted as a
``big_trade`` when ``volume >= MinVolume`` (default 30) and, when
``MaxVolume != -1``, ``volume <= MaxVolume``. ``MaxVolume == -1`` means no upper
bound. With ``VolumeFilterEnable = False`` every merged entry is emitted.

Streaming vs. batch
-------------------
:meth:`merge_stream` is the pure batch entry point used by the parity oracle and
property tests: given a list of trades it returns the emitted big trades in the
same group order NT would produce. The streaming :meth:`on_trade` keeps one
current group per contract and finalizes it when a non-merge print arrives;
:meth:`flush` forces emission of the pending group (e.g. at end-of-stream).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from app.models.canonical import NormalizedTrade, Side
from app.models.messages import BigTrade

__all__ = [
    "DEFAULT_MIN_VOLUME",
    "DEFAULT_MAX_VOLUME",
    "DEFAULT_VOLUME_FILTER_ENABLE",
    "BigTradeEngine",
]

logger = logging.getLogger(__name__)


# Volume-filter defaults (Req 15.3, 15.4; design "BigTrade Reconstruction").
DEFAULT_MIN_VOLUME = 30
DEFAULT_MAX_VOLUME = -1  # -1 => no upper bound
DEFAULT_VOLUME_FILTER_ENABLE = True


@dataclass(slots=True)
class _Group:
    """A mutable merge accumulator for one NT ``currentTrade`` group."""

    symbol: str
    contract: str
    trade_id: int
    time: int
    time_key: int
    side: Side
    volume: int
    price: float
    ticks: list[tuple[float, int]]


class BigTradeEngine:
    """Reconstruct, merge, and volume-filter the tape into big trades. (Req 15)"""

    def __init__(
        self,
        *,
        min_volume: int = DEFAULT_MIN_VOLUME,
        max_volume: int = DEFAULT_MAX_VOLUME,
        volume_filter_enable: bool = DEFAULT_VOLUME_FILTER_ENABLE,
        dedupe_repeated_timestamp_runs: bool = False,
    ) -> None:
        if min_volume < 0:
            raise ValueError("min_volume must be >= 0")
        if max_volume < -1:
            raise ValueError("max_volume must be >= -1 (-1 means no upper bound)")
        self.min_volume = min_volume
        self.max_volume = max_volume
        self.volume_filter_enable = volume_filter_enable
        self.dedupe_repeated_timestamp_runs = dedupe_repeated_timestamp_runs

        # Continuous classification state, keyed by contract.
        self._prev_price: dict[str, float] = {}
        self._last_side: dict[str, Side] = {}
        # NT keeps one currentTrade per indicator instance. We keep one per
        # contract because this backend can multiplex contracts.
        self._current: dict[str, _Group] = {}
        self._trade_id_counter: dict[str, int] = {}

    # -- classification (mirrors BigTradeIndicator.DetermineTradeSide) --------

    def classify(
        self,
        trade_price: float,
        bid: float | None,
        ask: float | None,
        last_side: Side | None,
        prev_price: float | None,
    ) -> Side | None:
        """Classify a trade as buy/sell by the NT BigTrade rule set.

        The first print can be unclassified when there is no quote snapshot,
        prior price, or prior side. NinjaTrader's BigTradeIndicator returns
        Unknown in that case and drops the print, so this method returns None.
        """
        if ask is not None and ask > 0 and trade_price >= ask:
            return Side.BUY
        if bid is not None and bid > 0 and trade_price <= bid:
            return Side.SELL

        if bid is not None and bid > 0 and ask is not None and ask > 0:
            dist_ask = abs(trade_price - ask)
            dist_bid = abs(trade_price - bid)
            if dist_ask < dist_bid:
                return Side.BUY
            if dist_bid < dist_ask:
                return Side.SELL

        if prev_price is not None:
            if trade_price > prev_price:
                return Side.BUY
            if trade_price < prev_price:
                return Side.SELL
        if last_side is not None:
            return last_side
        return None

    # -- filter ---------------------------------------------------------------

    def passes_filter(self, volume: int) -> bool:
        """Whether ``volume`` satisfies the volume filter. (Req 15.3, 15.4)"""
        if not self.volume_filter_enable:
            return True
        if volume < self.min_volume:
            return False
        if self.max_volume != -1 and volume > self.max_volume:
            return False
        return True

    # -- streaming ------------------------------------------------------------

    def on_trade(self, t: NormalizedTrade) -> list[BigTrade]:
        """Accumulate ``t`` and emit big trades for any flushed timestamp.

        Adjacent trades with the same Canonical_Timestamp and side accumulate
        into the current NT-style group. Any non-merge trade finalizes the
        previous group and starts a new one. Out-of-order (earlier-timestamp)
        trades are dropped. (Req 15.2)
        """
        bid = t.bid if t.bid is not None else t.best_bid
        ask = t.ask if t.ask is not None else t.best_ask
        side = self.classify(
            t.price,
            bid,
            ask,
            self._last_side.get(t.contract),
            self._prev_price.get(t.contract),
        )
        self._prev_price[t.contract] = t.price
        if side is None:
            return []
        self._last_side[t.contract] = side

        emitted: list[BigTrade] = []
        current = self._current.get(t.contract)
        time_key = self._merge_time_key(t)
        if current is not None and time_key < current.time_key:
            # Out-of-order trade for an already-flushed timestamp: ignore it,
            # but its side still advances classification state above.
            return emitted

        if (
            current is not None
            and time_key == current.time_key
            and side == current.side
        ):
            current.volume += t.volume
            current.price = t.price  # NT MarkerPosition=Last uses LastPrice
            current.ticks.append((t.price, t.volume))
        else:
            if current is not None:
                emitted = self._emit_group(current)
            self._current[t.contract] = self._new_group(t, side)
        return emitted

    def flush(self, contract: str | None = None) -> list[BigTrade]:
        """Emit the pending timestamp's qualifying big trades. (Req 15.4)

        Flushes one ``contract`` when given, else every contract with pending
        groups (ascending contract order for determinism). Used at end-of-stream
        when no later timestamp will arrive to trigger a flush.
        """
        if contract is not None:
            return self._flush_contract(contract)
        emitted: list[BigTrade] = []
        for c in sorted(self._current):
            emitted.extend(self._flush_contract(c))
        return emitted

    def reset_contract(self, contract: str) -> None:
        """Drop classification + pending state for ``contract`` (playback rewind)."""
        self._prev_price.pop(contract, None)
        self._last_side.pop(contract, None)
        self._current.pop(contract, None)
        self._trade_id_counter.pop(contract, None)

    def _flush_contract(self, contract: str) -> list[BigTrade]:
        group = self._current.pop(contract, None)
        if group is None:
            return []
        return self._emit_group(group)

    def _new_group(self, t: NormalizedTrade, side: Side) -> _Group:
        trade_id = self._trade_id_counter.get(t.contract, 0) + 1
        self._trade_id_counter[t.contract] = trade_id
        return _Group(
            symbol=t.symbol,
            contract=t.contract,
            trade_id=trade_id,
            time=t.time,
            time_key=self._merge_time_key(t),
            side=side,
            volume=t.volume,
            price=t.price,
            ticks=[(t.price, t.volume)],
        )

    @staticmethod
    def _merge_time_key(t: NormalizedTrade) -> int:
        """Timestamp equality key for NT ReconstructTape grouping.

        NinjaTrader's BigTradeIndicator compares ``MarketDataEventArgs.Time``
        directly. The chart still uses canonical milliseconds, but when the NT
        bridge provides UTC ``DateTime.Ticks`` we must use that higher-precision
        value for merge equality so distinct NT event times inside one
        millisecond do not collapse into one synthetic BigTrade.
        """
        return t.time_ticks if t.time_ticks is not None else t.time

    def _emit_group(self, g: _Group) -> list[BigTrade]:
        if self.dedupe_repeated_timestamp_runs:
            volume, price = self._dedup_repeated_tick_run(g.ticks)
            if volume != g.volume:
                log_level = (
                    logging.WARNING
                    if self.passes_filter(g.volume) or self.passes_filter(volume)
                    else logging.DEBUG
                )
                logger.log(
                    log_level,
                    "BigTrade dedup fired: raw_volume=%d -> deduped=%d, "
                    "ticks=%d, time=%d, side=%s, contract=%s",
                    g.volume, volume, len(g.ticks), g.time,
                    g.side.value, g.contract,
                )
            elif g.volume >= self.min_volume:
                logger.debug(
                    "BigTrade emit: volume=%d, ticks=%d, time=%d, "
                    "side=%s, contract=%s",
                    volume, len(g.ticks), g.time,
                    g.side.value, g.contract,
                )
        else:
            volume, price = g.volume, g.price
        if not self.passes_filter(volume):
            return []
        return [
            BigTrade(
                symbol=g.symbol,
                contract=g.contract,
                trade_id=g.trade_id,
                time=g.time,
                price=price,
                volume=volume,
                side=g.side,
            )
        ]

    @staticmethod
    def _dedup_repeated_tick_run(ticks: list[tuple[float, int]]) -> tuple[int, float]:
        """Collapse duplicate subscription replays inside a timestamp.

        A leaked NT MarketData handler can replay the same same-timestamp tape
        run N times (commonly 2x). That turns, for example, 33 one-lot prints
        into a synthetic 66-lot BigTrade that the chart-side NinjaTrader
        indicator never sees.

        Detection strategy (checked in order):

        1. **Exact Nx**: the tick list consists of N identical copies of a
           sub-sequence (N = 2, 3, ...), including a single large print replayed
           with the same NT timestamp. The first copy is kept.
        2. **Near 2x**: the first half equals the second half after removing
           one straggler tick at the boundary (count is odd, ``count-1`` is
           even, and the two ``(count-1)/2`` halves match). This handles an
           edge tick that sneaks in between the two replays.

        Only these narrow patterns are collapsed; mixed prints at the same
        timestamp are kept.
        """
        if not ticks:
            return 0, 0.0
        count = len(ticks)
        effective = ticks

        # 1) Check for exact Nx repetition (N = 2, 3, 4)
        for n in (2, 3, 4):
            if count % n != 0:
                continue
            segment_len = count // n
            if segment_len < 1:
                continue
            segment = ticks[:segment_len]
            if all(ticks[i * segment_len:(i + 1) * segment_len] == segment
                   for i in range(1, n)):
                effective = segment
                break

        # 2) Near-2x: odd count where removing one tick yields two equal halves.
        #    The straggler can be the first, middle, or last tick.
        if effective is ticks and count >= 3 and count % 2 == 1:
            mid = count // 2
            # straggler at end
            if ticks[:mid] == ticks[mid:count - 1]:
                effective = ticks[:mid]
            # straggler at start
            elif ticks[1:mid + 1] == ticks[mid + 1:]:
                effective = ticks[1:mid + 1]

        return sum(volume for _, volume in effective), effective[-1][0]

    # -- batch (pure oracle) --------------------------------------------------

    def merge_stream(self, trades: list[NormalizedTrade]) -> list[BigTrade]:
        """Merge and filter a whole trade list, returning emitted big trades.

        Pure batch entry point for parity/property tests. Classification state
        is continuous across the list (matching the streaming engine). The
        result is ordered by NT group finalization order. Trades whose timestamp
        is earlier than the current open group for the same contract are dropped
        (out-of-order), matching :meth:`on_trade`.
        """
        emitted: list[BigTrade] = []
        for t in trades:
            emitted.extend(self.on_trade(t))
        emitted.extend(self.flush())
        return emitted
