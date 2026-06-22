"""Bar_Aggregator: aggregate Active_Contract trades into OHLCV bars.

The Bar_Aggregator consumes accepted :class:`~app.models.canonical.NormalizedTrade`
events for the Active_Contract and maintains the current (in-progress) OHLCV bar
for each supported timeframe. On every trade it updates the relevant bar per
timeframe and produces :class:`~app.models.messages.BarUpdate` outputs carrying a
``closed`` flag.

Bucketization (Requirements 9.1, 9.4, 9.5):

* Bars are computed for the timeframes ``1m, 3m, 5m, 15m, 30m, 1h, 4h, 1D``.
* Bucket boundaries are derived from the Canonical_Timestamp (integer ms since
  the Unix epoch in UTC). Intraday timeframes floor to UTC interval multiples;
  ``4h`` and ``1D`` floor to the GC trading-session grid, Sunday 17:00 CT
  through Friday 16:00 CT. Out-of-session trades are ignored for derived bars.
* Integer floor division (``//``) floors intraday buckets toward negative
  infinity, so pre-epoch timestamps bucket correctly too.

Bar lifecycle (Requirements 9.2, 9.3):

* The first trade in a bucket opens a bar (open = high = low = close = trade
  price, volume = trade volume) and emits a ``bar_update`` with ``closed=False``.
* Subsequent trades in the same bucket update the current bar (high = max,
  low = min, close = last price, volume = running sum) and emit a ``bar_update``
  with ``closed=False``.
* When a trade falls into a later bucket, the prior current bar is closed: a
  ``bar_update`` with ``closed=True`` is emitted for the prior bar, then a new
  bar is opened for the new bucket and emitted with ``closed=False``.

State is keyed by ``(contract, timeframe)`` so the aggregator can hold the
current bar per timeframe for the contract(s) it is fed. Trades are expected to
arrive with non-decreasing Canonical_Timestamps (guaranteed by the upstream
sequence validator); a trade whose bucket precedes the current bar for a
timeframe is ignored for that timeframe so already-closed bars are never
corrupted.
"""

from __future__ import annotations

from app.engines.session_calendar import (
    TF_MS as _TF_MS,
    is_gc_session_open,
    timeframe_bucket_start,
)
from app.models.canonical import NormalizedTrade
from app.models.messages import BarUpdate, OHLCVBar

__all__ = ["SUPPORTED_TFS", "BarAggregator"]

# Supported timeframes, finest to coarsest. (Req 9.1)
SUPPORTED_TFS: list[str] = ["1m", "3m", "5m", "15m", "30m", "1h", "4h", "1D"]


def _copy_bar(bar: OHLCVBar) -> OHLCVBar:
    """Return an independent snapshot of ``bar``.

    Emitted ``BarUpdate`` payloads carry copies so that later in-place updates
    to the live current bar never mutate a previously emitted snapshot.
    """
    return OHLCVBar(
        time=bar.time,
        open=bar.open,
        high=bar.high,
        low=bar.low,
        close=bar.close,
        volume=bar.volume,
    )


class BarAggregator:
    """Aggregate trades into OHLCV bars across all supported timeframes.

    Maintains the current (in-progress) bar per ``(contract, timeframe)`` and
    emits ``bar_update`` outputs as bars are updated and closed. (Req 9)
    """

    def __init__(self) -> None:
        # (contract, tf) -> current in-progress OHLCV bar.
        self._bars: dict[tuple[str, str], OHLCVBar] = {}

    def bucket_start(self, ts_ms: int, tf: str) -> int:
        """Floor a Canonical_Timestamp to the start of its ``tf`` bucket.

        Intraday timeframes floor to multiples of their interval length; ``1D``
        floors to the GC trading-session open. Uses integer floor division for
        intraday buckets so the result floors toward the epoch start for
        pre-epoch timestamps too. (Req 9.4, 9.5)
        """
        return timeframe_bucket_start(ts_ms, tf)

    def current_bar(self, contract: str, tf: str) -> OHLCVBar | None:
        """Return a snapshot of the current in-progress bar, or ``None``.

        Returns a copy so callers cannot mutate the aggregator's internal state.
        """
        bar = self._bars.get((contract, tf))
        return None if bar is None else _copy_bar(bar)

    def seed_bar(
        self,
        contract: str,
        tf: str,
        *,
        time: int,
        open: float,
        high: float,
        low: float,
        close: float,
        volume: int,
    ) -> None:
        """Seed the current in-progress bar for ``contract``/``tf``.

        Used when the live pipeline starts with an already-open bar in cache,
        so the first trade after a restart continues that bar instead of
        replacing it with a partial restart-only bar.
        """
        if tf not in _TF_MS:
            raise ValueError(f"unsupported timeframe: {tf!r}")
        self._bars[(contract, tf)] = OHLCVBar(
            time=time,
            open=open,
            high=high,
            low=low,
            close=close,
            volume=volume,
        )

    def reset_contract(self, contract: str) -> None:
        """Drop all in-progress bar state for ``contract`` (all timeframes).

        Used on a playback rewind / backward time jump so the aggregator can
        start fresh at the earlier time instead of ignoring the replayed trades
        as out-of-order. Other contracts are unaffected.
        """
        for key in [k for k in self._bars if k[0] == contract]:
            del self._bars[key]

    def on_trade(self, t: NormalizedTrade) -> list[BarUpdate]:
        """Update bars for every supported timeframe and return the updates.

        Returns one ``bar_update`` per affected timeframe when a bar is opened or
        updated, and two for a timeframe whose bucket rolls (the closed prior bar
        followed by the freshly opened bar). (Req 9.2, 9.3)
        """
        updates: list[BarUpdate] = []
        if not is_gc_session_open(t.time):
            return updates
        for tf in SUPPORTED_TFS:
            bucket = self.bucket_start(t.time, tf)
            key = (t.contract, tf)
            current = self._bars.get(key)

            if current is None:
                # First trade for this (contract, tf): open a new bar.
                opened = OHLCVBar(
                    time=bucket,
                    open=t.price,
                    high=t.price,
                    low=t.price,
                    close=t.price,
                    volume=t.volume,
                )
                self._bars[key] = opened
                updates.append(self._update(t, tf, opened, closed=False))
                continue

            if bucket == current.time:
                # Same bucket: fold the trade into the current bar.
                if t.price > current.high:
                    current.high = t.price
                if t.price < current.low:
                    current.low = t.price
                current.close = t.price
                current.volume += t.volume
                updates.append(self._update(t, tf, current, closed=False))
                continue

            if bucket > current.time:
                # New bucket opened: close the prior bar, then open the new one.
                updates.append(self._update(t, tf, current, closed=True))
                opened = OHLCVBar(
                    time=bucket,
                    open=t.price,
                    high=t.price,
                    low=t.price,
                    close=t.price,
                    volume=t.volume,
                )
                self._bars[key] = opened
                updates.append(self._update(t, tf, opened, closed=False))
                continue

            # bucket < current.time: an out-of-order trade for an already-closed
            # bucket. Ignore it for this timeframe so closed bars stay intact.

        return updates

    def _update(
        self, t: NormalizedTrade, tf: str, bar: OHLCVBar, *, closed: bool
    ) -> BarUpdate:
        """Build a ``BarUpdate`` carrying an independent snapshot of ``bar``."""
        return BarUpdate(
            symbol=t.symbol,
            contract=t.contract,
            tf=tf,
            bar=_copy_bar(bar),
            closed=closed,
        )
