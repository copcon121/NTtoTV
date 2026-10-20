"""Correlate Bookmap executions with published long-term liquidity lines."""

from __future__ import annotations

from dataclasses import dataclass

from ..models import LiquidityUpdate, NormalizedTrade, Side

__all__ = ["LongTermLiquidityTouch", "LongTermLiquidityTouchEngine"]


@dataclass(slots=True, frozen=True)
class LongTermLiquidityTouch:
    sequence: int
    time: int
    line_id: str
    line_start_time: int
    source_contract: str
    side: str
    price: float
    volume: int
    line_size: int
    threshold: int
    dom_distance: int | None


@dataclass(slots=True)
class _LineState:
    line_id: str
    source_contract: str
    side: str
    price: float
    price_ticks: int
    started_at: int
    last_at: int
    ended_at: int | None
    current_size: int
    threshold: int
    dom_distance: int | None
    active: bool


@dataclass(slots=True)
class _TouchGroup:
    key: tuple[str, str, str]
    sequence: int
    time: int
    line_id: str
    line_start_time: int
    source_contract: str
    side: str
    price: float
    volume: int
    line_size: int
    threshold: int
    dom_distance: int | None
    last_received_at: int


class LongTermLiquidityTouchEngine:
    """Build one bubble for each aggressor execution that consumes a line.

    A resting bid is touched only by sell aggressors; a resting ask is touched
    only by buy aggressors. Completed depth lines remain matchable briefly so
    callback ordering between Bookmap's trade and depth channels cannot drop a
    legitimate touch.
    """

    def __init__(
        self,
        *,
        tick_size: float = 0.1,
        idle_ms: int = 100,
        ended_line_grace_ms: int = 5_000,
        min_age_ms: int = 0,
    ) -> None:
        self.tick_size = tick_size if tick_size > 0 else 0.1
        self.idle_ms = max(1, int(idle_ms))
        self.ended_line_grace_ms = max(0, int(ended_line_grace_ms))
        self.min_age_ms = max(0, int(min_age_ms))
        self._lines: dict[str, _LineState] = {}
        self._groups: dict[tuple[str, str, str], _TouchGroup] = {}
        self._next_sequence = 0

    def reset(self) -> None:
        self._lines.clear()
        self._groups.clear()

    def set_min_age_ms(self, min_age_ms: int) -> None:
        """Update the short-term/long-term boundary without dropping lines."""

        self.min_age_ms = max(0, int(min_age_ms))

    def on_liquidity(self, update: LiquidityUpdate) -> None:
        if update.event_kind != "long_term" or not update.line_id:
            return
        line_id = update.line_id
        existing = self._lines.get(line_id)
        started_at = int(
            update.line_start_time
            if update.line_start_time is not None
            else existing.started_at if existing is not None else update.time
        )
        active = update.action != "end"
        self._lines[line_id] = _LineState(
            line_id=line_id,
            source_contract=str(
                update.source_contract
                or (existing.source_contract if existing is not None else update.contract)
            ),
            side=update.side,
            price=float(update.price),
            price_ticks=round(float(update.price) / self.tick_size),
            started_at=started_at,
            last_at=int(update.time),
            ended_at=None if active else int(update.time),
            current_size=max(0, int(update.size)),
            threshold=max(0, int(update.threshold)),
            dom_distance=update.dom_distance,
            active=active,
        )
        self._prune_lines(int(update.time))

    def on_trade(self, trade: NormalizedTrade) -> list[LongTermLiquidityTouch]:
        received_at = int(trade.received_at or trade.time)
        emitted = self.flush_idle(received_at)
        line = self._matching_line(trade)
        if line is None or trade.side is None or trade.volume <= 0:
            return emitted

        order_key = (
            f"order:{trade.aggressor_order_id}"
            if trade.aggressor_order_id
            else "fallback"
        )
        key = (line.line_id, trade.side.value, order_key)
        current = self._groups.get(key)
        if current is not None and trade.execution_start:
            emitted.append(self._emit(self._groups.pop(key)))
            current = None
        if current is None:
            self._next_sequence -= 1
            current = _TouchGroup(
                key=key,
                sequence=self._next_sequence,
                time=int(trade.time),
                line_id=line.line_id,
                line_start_time=line.started_at,
                source_contract=line.source_contract,
                side=line.side,
                price=line.price,
                volume=0,
                line_size=line.current_size,
                threshold=line.threshold,
                dom_distance=line.dom_distance,
                last_received_at=received_at,
            )
            self._groups[key] = current
        current.time = int(trade.time)
        current.volume += int(trade.volume)
        current.last_received_at = received_at
        if trade.execution_end:
            emitted.append(self._emit(self._groups.pop(key)))
        return emitted

    def flush_idle(self, now_ms: int) -> list[LongTermLiquidityTouch]:
        stale = sorted(
            (
                key
                for key, group in self._groups.items()
                if int(now_ms) - group.last_received_at >= self.idle_ms
            ),
            key=lambda key: self._groups[key].last_received_at,
        )
        emitted = [self._emit(self._groups.pop(key)) for key in stale]
        self._prune_lines(int(now_ms))
        return emitted

    def flush_all(self) -> list[LongTermLiquidityTouch]:
        groups = sorted(self._groups.values(), key=lambda group: group.last_received_at)
        self._groups.clear()
        return [self._emit(group) for group in groups]

    def _matching_line(self, trade: NormalizedTrade) -> _LineState | None:
        if trade.side is Side.SELL:
            line_side = "bid"
        elif trade.side is Side.BUY:
            line_side = "ask"
        else:
            return None
        price_ticks = round(float(trade.price) / self.tick_size)
        candidates = [
            line
            for line in self._lines.values()
            if line.side == line_side
            and line.price_ticks == price_ticks
            and line.started_at <= int(trade.time)
            and int(trade.time) - line.started_at >= self.min_age_ms
            and (
                line.active
                or (
                    line.ended_at is not None
                    and int(trade.time) <= line.ended_at + self.ended_line_grace_ms
                )
            )
        ]
        if not candidates:
            return None
        return max(candidates, key=lambda line: (1 if line.active else 0, line.started_at))

    def _prune_lines(self, at: int) -> None:
        expired = [
            line_id
            for line_id, line in self._lines.items()
            if not line.active
            and line.ended_at is not None
            and at - line.ended_at > self.ended_line_grace_ms
        ]
        for line_id in expired:
            self._lines.pop(line_id, None)

    @staticmethod
    def _emit(group: _TouchGroup) -> LongTermLiquidityTouch:
        return LongTermLiquidityTouch(
            sequence=group.sequence,
            time=group.time,
            line_id=group.line_id,
            line_start_time=group.line_start_time,
            source_contract=group.source_contract,
            side=group.side,
            price=group.price,
            volume=group.volume,
            line_size=group.line_size,
            threshold=group.threshold,
            dom_distance=group.dom_distance,
        )
