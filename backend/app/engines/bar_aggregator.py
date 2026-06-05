"""Bar_Aggregator: aggregate Active_Contract trades into OHLCV bars.

The Bar_Aggregator consumes accepted :class:`~app.models.canonical.NormalizedTrade`
events for the Active_Contract and maintains the current (in-progress) OHLCV bar
for each supported timeframe. On every trade it updates the relevant bar per
timeframe and produces :class:`~app.models.messages.BarUpdate` outputs carrying a
``closed`` flag.

Bucketization (Requirements 9.1, 9.4, 9.5):

* Bars are computed for the timeframes ``1m, 3m, 5m, 15m, 30m, 1h, 4h, 1D``.
* Bucket boundaries are derived from the Canonical_Timestamp (integer ms since
  the Unix epoch in UTC). Intraday timeframes floor to multiples of their
  interval length; the ``1D`` timeframe floors to the **UTC calendar day**.
* Because the Unix epoch (``ms == 0``) is itself midnight UTC, flooring an
  intraday timeframe to a multiple of its millisecond length, and flooring
  ``1D`` to a multiple of 86,400,000 ms, both land exactly on UTC calendar
  boundaries. Integer floor division (``//``) floors toward negative infinity,
  so pre-epoch timestamps bucket correctly too.
* v1 uses the UTC calendar day for the daily boundary and applies **no**
  configurable session/timezone template. (Req 9.5)

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

from app.models.canonical import NormalizedTrade
from app.models.messages import BarUpdate, OHLCVBar

__all__ = ["SUPPORTED_TFS", "BarAggregator"]

# Supported timeframes, finest to coarsest. (Req 9.1)
SUPPORTED_TFS: list[str] = ["1m", "3m", "5m", "15m", "30m", "1h", "4h", "1D"]

# Length of each timeframe bucket in milliseconds. ``1D`` is exactly one UTC
# calendar day; because the epoch is midnight UTC, flooring to this multiple
# yields the UTC calendar-day boundary. (Req 9.4, 9.5)
_TF_MS: dict[str, int] = {
    "1m": 60_000,
    "3m": 3 * 60_000,
    "5m": 5 * 60_000,
    "15m": 15 * 60_000,
    "30m": 30 * 60_000,
    "1h": 60 * 60_000,
    "4h": 4 * 60 * 60_000,
    "1D": 24 * 60 * 60_000,
}


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
        floors to the UTC calendar day. Uses integer floor division so the
        result floors toward the epoch start for pre-epoch timestamps too.
        (Req 9.4, 9.5)
        """
        try:
            interval = _TF_MS[tf]
        except KeyError:
            raise ValueError(f"unsupported timeframe: {tf!r}") from None
        return (ts_ms // interval) * interval

    def current_bar(self, contract: str, tf: str) -> OHLCVBar | None:
        """Return a snapshot of the current in-progress bar, or ``None``.

        Returns a copy so callers cannot mutate the aggregator's internal state.
        """
        bar = self._bars.get((contract, tf))
        return None if bar is None else _copy_bar(bar)

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
