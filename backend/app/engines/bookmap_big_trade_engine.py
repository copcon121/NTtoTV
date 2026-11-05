"""Bookmap aggressor-order reconstruction for BigTrade markers."""

from __future__ import annotations

from dataclasses import dataclass

from ..models import BigTrade, NormalizedTrade, Side


@dataclass(slots=True)
class _Group:
    key: tuple[str, str]
    symbol: str
    contract: str
    time: int
    price: float
    volume: int
    side: Side
    source: str


class BookmapBigTradeEngine:
    """Group direct-feed prints using exchange time, never delivery latency.

    A receive-time timeout can split fills of one exchange execution when the
    consumer is busy. Only later exchange events may expire pending groups.
    The last group of a quiet feed waits for another trade or execution_end;
    finite raw replays explicitly finish with flush_all().
    """

    def __init__(self, *, min_volume: int = 30, idle_ms: int = 100) -> None:
        self.min_volume = min_volume
        self.idle_ms = idle_ms
        self._groups: dict[tuple[str, str], _Group] = {}
        self._trade_id = 0
        self._event_watermark: int | None = None

    def on_trade(self, trade: NormalizedTrade) -> list[BigTrade]:
        emitted = self.flush_idle(trade.time)
        if trade.side is None:
            return emitted
        key = self._key(trade)
        if not trade.aggressor_order_id:
            fallback_prefix = (trade.side.value, "time:")
            prior_fallbacks = [
                group_key
                for group_key in self._groups
                if group_key != key
                and group_key[0] == fallback_prefix[0]
                and group_key[1].startswith(fallback_prefix[1])
            ]
            for group_key in prior_fallbacks:
                emitted.extend(self._emit(self._groups.pop(group_key)))
        current = self._groups.get(key)
        if trade.execution_start and current is not None:
            emitted.extend(self._emit(self._groups.pop(key)))
            current = None
        if current is None:
            current = _Group(
                key=key,
                symbol=trade.symbol,
                contract=trade.contract,
                time=trade.time,
                price=trade.price,
                volume=0,
                side=trade.side,
                source=trade.source,
            )
            self._groups[key] = current
        current.volume += trade.volume
        current.price = trade.price
        current.time = trade.time
        if trade.execution_end:
            emitted.extend(self._emit(self._groups.pop(key)))
        return emitted

    def flush_idle(self, event_time_ms: int | None = None) -> list[BigTrade]:
        """Expire by the exchange watermark; a timer must pass no timestamp."""
        if event_time_ms is not None:
            self._event_watermark = max(
                self._event_watermark if self._event_watermark is not None else event_time_ms,
                event_time_ms,
            )
        if self._event_watermark is None:
            return []
        emitted: list[BigTrade] = []
        stale = [
            key
            for key, group in self._groups.items()
            if self._event_watermark - group.time >= self.idle_ms
        ]
        for key in stale:
            emitted.extend(self._emit(self._groups.pop(key)))
        return emitted

    def flush_all(self) -> list[BigTrade]:
        """Finish a bounded raw replay after its last fill has been read."""
        groups = list(self._groups.values())
        self._groups.clear()
        return [trade for group in groups for trade in self._emit(group)]

    def reset_pending(self) -> None:
        self._groups.clear()
        self._event_watermark = None

    @staticmethod
    def _key(trade: NormalizedTrade) -> tuple[str, str]:
        if trade.aggressor_order_id:
            return (trade.side.value, trade.aggressor_order_id)
        exact_time = trade.source_time_nanos or trade.time_ticks or trade.time
        return (trade.side.value, f"time:{exact_time}")

    def _emit(self, group: _Group) -> list[BigTrade]:
        if group.volume < self.min_volume:
            return []
        self._trade_id += 1
        return [
            BigTrade(
                symbol=group.symbol,
                contract=group.contract,
                trade_id=self._trade_id,
                time=group.time,
                price=group.price,
                volume=group.volume,
                side=group.side,
                source=group.source,
            )
        ]
