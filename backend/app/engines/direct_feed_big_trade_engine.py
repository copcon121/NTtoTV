"""Direct-feed aggressor-order reconstruction for BigTrade markers."""

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
    last_received_at: int


class DirectFeedBigTradeEngine:
    """Group exchange prints by aggressor order id with an idle-time fallback."""

    def __init__(self, *, min_volume: int = 30, idle_ms: int = 100) -> None:
        self.min_volume = min_volume
        self.idle_ms = idle_ms
        self._groups: dict[tuple[str, str], _Group] = {}
        self._trade_id = 0

    def on_trade(self, trade: NormalizedTrade) -> list[BigTrade]:
        if trade.side is None:
            return []
        emitted = self.flush_idle(trade.received_at or trade.time)
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
                last_received_at=trade.received_at or trade.time,
            )
            self._groups[key] = current
        current.volume += trade.volume
        current.price = trade.price
        current.time = trade.time
        current.last_received_at = trade.received_at or trade.time
        if trade.execution_end:
            emitted.extend(self._emit(self._groups.pop(key)))
        return emitted

    def flush_idle(self, now_ms: int) -> list[BigTrade]:
        emitted: list[BigTrade] = []
        stale = [
            key
            for key, group in self._groups.items()
            if now_ms - group.last_received_at >= self.idle_ms
        ]
        for key in stale:
            emitted.extend(self._emit(self._groups.pop(key)))
        return emitted

    def reset_pending(self) -> None:
        self._groups.clear()

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
