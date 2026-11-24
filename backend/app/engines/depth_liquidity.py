"""Reduce an in-memory depth feed to compact liquidity chart events.

Rithmic depth is reduced in-process. The
depth arrives in the backend, so this engine mirrors the same threshold and
long-lived-line semantics without persisting the raw order book.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import floor
from typing import Mapping

__all__ = ["DepthLiquidityEvent", "DepthLiquidityTracker"]


@dataclass(slots=True, frozen=True)
class DepthLiquidityEvent:
    sequence: int
    time: int
    event_kind: str
    action: str
    side: str
    price: float
    size: int
    previous_size: int
    change: int
    threshold: int
    dom_distance: int
    strength: float
    line_id: str | None = None
    line_start_time: int | None = None
    snapshot: bool = False


@dataclass(slots=True)
class _Candidate:
    side: str
    price_ticks: int
    started_at: int
    line_id: str
    current_size: int
    peak_size: int
    dom_distance: int
    last_emitted_size: int
    last_emitted_at: int


class DepthLiquidityTracker:
    """Track relative, absolute, and persistent liquidity from atomic L2 deltas."""

    def __init__(
        self,
        settings: Mapping[str, bool | int],
        *,
        tick_size: float = 0.1,
        source_prefix: str = "depth",
        long_term_update_size: int = 50,
        long_term_update_interval_ms: int = 500,
    ) -> None:
        self.tick_size = tick_size if tick_size > 0 else 0.1
        self.source_prefix = source_prefix
        self.long_term_update_size = max(1, int(long_term_update_size))
        self.long_term_update_interval_ms = max(0, int(long_term_update_interval_ms))
        self._settings = dict(settings)
        self._bids: dict[int, int] = {}
        self._asks: dict[int, int] = {}
        self._absolute_armed: set[tuple[str, int]] = set()
        self._candidates: dict[tuple[str, int], _Candidate] = {}
        self._ready = False
        # Feed sequences are positive and touch-bubble sequences begin
        # at -1. Reserve a distant negative range for backend-derived depth.
        self._next_sequence = -1_000_000_000

    def reset(self) -> None:
        self._bids.clear()
        self._asks.clear()
        self._absolute_armed.clear()
        self._candidates.clear()
        self._ready = False

    def configure(self, settings: Mapping[str, bool | int], at: int) -> None:
        previous = self._settings
        self._settings = dict(settings)
        self._absolute_armed.clear()
        long_term_fields = (
            "longTermEnabled",
            "longTermTrigger",
            "longTermDomFrom",
            "longTermDomTo",
        )
        if any(previous.get(field) != self._settings.get(field) for field in long_term_fields):
            self._candidates.clear()
            if self._ready:
                self._seed_long_term(int(at))
        if self._ready:
            self._seed_absolute()

    def on_book_delta(
        self, update: Mapping[str, object], at: int
    ) -> list[DepthLiquidityEvent]:
        """Apply an atomic Rithmic L2 delta returned by ``RithmicBookState``."""

        event_time = int(update.get("time") or at)
        changed: list[tuple[str, int, int, int]] = []
        for side, field, book in (
            ("bid", "bids", self._bids),
            ("ask", "asks", self._asks),
        ):
            raw_levels = update.get(field) or []
            if not isinstance(raw_levels, list):
                continue
            for raw in raw_levels:
                if not isinstance(raw, Mapping) or raw.get("price") is None:
                    continue
                price_ticks = round(float(raw["price"]) / self.tick_size)
                previous_size = int(book.get(price_ticks, 0))
                size = max(0, int(raw.get("size") or 0))
                if size <= 0:
                    book.pop(price_ticks, None)
                else:
                    book[price_ticks] = size
                if previous_size != size:
                    changed.append((side, price_ticks, previous_size, size))

        if not self._ready:
            if not self._bids or not self._asks:
                return []
            self._ready = True
            self._seed_absolute()
            return self._seed_long_term(event_time)

        if not self._bids or not self._asks:
            events: list[DepthLiquidityEvent] = []
            for side, price_ticks, previous_size, size in changed:
                events.extend(
                    self._events_for_level(
                        side,
                        price_ticks,
                        previous_size,
                        size,
                        event_time,
                        dom_distance=2**31 - 1,
                    )
                )
            return events

        best_bid = max(self._bids)
        best_ask = min(self._asks)
        events = []
        for side, price_ticks, previous_size, size in changed:
            distance = (
                best_bid - price_ticks if side == "bid" else price_ticks - best_ask
            )
            events.extend(
                self._events_for_level(
                    side,
                    price_ticks,
                    previous_size,
                    size,
                    event_time,
                    dom_distance=distance,
                )
            )
        return events

    def snapshots(self, at: int) -> list[DepthLiquidityEvent]:
        return [
            self._event(
                time=int(at),
                event_kind="long_term",
                action="snapshot",
                side=candidate.side,
                price_ticks=candidate.price_ticks,
                size=candidate.current_size,
                previous_size=candidate.current_size,
                change=0,
                threshold=self._int_setting("longTermTrigger"),
                dom_distance=candidate.dom_distance,
                line_id=candidate.line_id,
                line_start_time=candidate.started_at,
                snapshot=True,
            )
            for candidate in sorted(
                self._candidates.values(),
                key=lambda item: (item.side, item.price_ticks, item.started_at),
            )
        ]

    def _events_for_level(
        self,
        side: str,
        price_ticks: int,
        previous_size: int,
        size: int,
        at: int,
        *,
        dom_distance: int,
    ) -> list[DepthLiquidityEvent]:
        events: list[DepthLiquidityEvent] = []
        change = abs(size - previous_size)
        if (
            self._bool_setting("relativeEnabled")
            and self._within(dom_distance, "relative")
            and change >= self._int_setting("relativeTrigger")
        ):
            events.append(
                self._event(
                    time=at,
                    event_kind="relative",
                    action="added" if size > previous_size else "removed",
                    side=side,
                    price_ticks=price_ticks,
                    size=size,
                    previous_size=previous_size,
                    change=change,
                    threshold=self._int_setting("relativeTrigger"),
                    dom_distance=dom_distance,
                )
            )

        key = (side, price_ticks)
        absolute_trigger = self._int_setting("absoluteTrigger")
        if not self._bool_setting("absoluteEnabled"):
            self._absolute_armed.discard(key)
        elif size < floor(absolute_trigger * 0.9):
            self._absolute_armed.discard(key)
        elif (
            self._within(dom_distance, "absolute")
            and size >= absolute_trigger > previous_size
            and key not in self._absolute_armed
        ):
            self._absolute_armed.add(key)
            events.append(
                self._event(
                    time=at,
                    event_kind="absolute",
                    action="crossed",
                    side=side,
                    price_ticks=price_ticks,
                    size=size,
                    previous_size=previous_size,
                    change=change,
                    threshold=absolute_trigger,
                    dom_distance=dom_distance,
                )
            )

        events.extend(
            self._update_long_term(
                side, price_ticks, previous_size, size, dom_distance, at
            )
        )
        return events

    def _update_long_term(
        self,
        side: str,
        price_ticks: int,
        previous_size: int,
        size: int,
        dom_distance: int,
        at: int,
    ) -> list[DepthLiquidityEvent]:
        key = (side, price_ticks)
        candidate = self._candidates.get(key)
        if not self._bool_setting("longTermEnabled"):
            self._candidates.pop(key, None)
            return []
        trigger = self._int_setting("longTermTrigger")
        if size < floor(trigger * 0.9):
            if candidate is None:
                return []
            self._candidates.pop(key, None)
            candidate.current_size = size
            return [
                self._event(
                    time=at,
                    event_kind="long_term",
                    action="end",
                    side=side,
                    price_ticks=price_ticks,
                    size=size,
                    previous_size=previous_size,
                    change=abs(size - previous_size),
                    threshold=trigger,
                    dom_distance=candidate.dom_distance,
                    line_id=candidate.line_id,
                    line_start_time=candidate.started_at,
                )
            ]
        if candidate is None:
            if size < trigger or not self._within(dom_distance, "longTerm"):
                return []
            candidate = self._new_candidate(side, price_ticks, size, dom_distance, at)
            self._candidates[key] = candidate
            return [self._candidate_event(candidate, "start", size, at)]

        candidate.current_size = size
        candidate.peak_size = max(candidate.peak_size, size)
        candidate.dom_distance = dom_distance
        update_change = abs(size - candidate.last_emitted_size)
        if (
            update_change < self.long_term_update_size
            or at - candidate.last_emitted_at < self.long_term_update_interval_ms
        ):
            return []
        emitted_previous = candidate.last_emitted_size
        candidate.last_emitted_size = size
        candidate.last_emitted_at = at
        return [self._candidate_event(candidate, "update", emitted_previous, at)]

    def _seed_absolute(self) -> None:
        if not self._bool_setting("absoluteEnabled"):
            return
        trigger = self._int_setting("absoluteTrigger")
        for side, book in (("bid", self._bids), ("ask", self._asks)):
            for price_ticks, size in book.items():
                if size >= trigger and self._within(self._distance(side, price_ticks), "absolute"):
                    self._absolute_armed.add((side, price_ticks))

    def _seed_long_term(self, at: int) -> list[DepthLiquidityEvent]:
        if not self._bool_setting("longTermEnabled"):
            return []
        trigger = self._int_setting("longTermTrigger")
        events: list[DepthLiquidityEvent] = []
        for side, book in (("bid", self._bids), ("ask", self._asks)):
            for price_ticks, size in book.items():
                distance = self._distance(side, price_ticks)
                if size < trigger or not self._within(distance, "longTerm"):
                    continue
                candidate = self._new_candidate(side, price_ticks, size, distance, at)
                self._candidates[(side, price_ticks)] = candidate
                events.append(self._candidate_event(candidate, "start", size, at))
        return events

    def _new_candidate(
        self, side: str, price_ticks: int, size: int, dom_distance: int, at: int
    ) -> _Candidate:
        return _Candidate(
            side=side,
            price_ticks=price_ticks,
            started_at=int(at),
            line_id=f"{self.source_prefix}:{side}:{price_ticks}:{int(at)}",
            current_size=size,
            peak_size=size,
            dom_distance=dom_distance,
            last_emitted_size=size,
            last_emitted_at=int(at),
        )

    def _candidate_event(
        self, candidate: _Candidate, action: str, previous_size: int, at: int
    ) -> DepthLiquidityEvent:
        return self._event(
            time=at,
            event_kind="long_term",
            action=action,
            side=candidate.side,
            price_ticks=candidate.price_ticks,
            size=candidate.current_size,
            previous_size=previous_size,
            change=abs(candidate.current_size - previous_size),
            threshold=self._int_setting("longTermTrigger"),
            dom_distance=candidate.dom_distance,
            line_id=candidate.line_id,
            line_start_time=candidate.started_at,
        )

    def _event(
        self,
        *,
        time: int,
        event_kind: str,
        action: str,
        side: str,
        price_ticks: int,
        size: int,
        previous_size: int,
        change: int,
        threshold: int,
        dom_distance: int,
        line_id: str | None = None,
        line_start_time: int | None = None,
        snapshot: bool = False,
    ) -> DepthLiquidityEvent:
        sequence = self._next_sequence
        self._next_sequence -= 1
        return DepthLiquidityEvent(
            sequence=sequence,
            time=int(time),
            event_kind=event_kind,
            action=action,
            side=side,
            price=round(price_ticks * self.tick_size, 10),
            size=max(0, int(size)),
            previous_size=max(0, int(previous_size)),
            change=max(0, int(change)),
            threshold=max(0, int(threshold)),
            dom_distance=int(dom_distance),
            strength=(0.0 if threshold <= 0 else max(size, change) / threshold),
            line_id=line_id,
            line_start_time=line_start_time,
            snapshot=snapshot,
        )

    def _distance(self, side: str, price_ticks: int) -> int:
        if side == "bid":
            return (max(self._bids) - price_ticks) if self._bids else 2**31 - 1
        return (price_ticks - min(self._asks)) if self._asks else 2**31 - 1

    def _within(self, distance: int, prefix: str) -> bool:
        return (
            self._int_setting(f"{prefix}DomFrom")
            <= distance
            <= self._int_setting(f"{prefix}DomTo")
        )

    def _bool_setting(self, name: str) -> bool:
        return bool(self._settings[name])

    def _int_setting(self, name: str) -> int:
        return int(self._settings[name])
