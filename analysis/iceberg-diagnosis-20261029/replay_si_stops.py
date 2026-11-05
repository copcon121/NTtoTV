"""Independent causal reference for the inspected SI 2.08 stop-chain logic.

This runs our small model, NOT the licensed addon. It does not connect to a
feed, read runtime configuration, or modify market data. Prices are integer
ticks; timestamps are opaque provider units processed in supplied event order.
The caller supplies only already-accepted MBO callbacks, matching SI's known-ID
wrapper. No exchange stop flag, timeout, or minimum volume is inferred here.
Logical integer arithmetic is modeled; Java integer overflow is not emulated.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import isclose
from typing import Literal

Side = Literal["buy", "sell"]
MboAction = Literal["send", "replace", "cancel"]


@dataclass(frozen=True)
class Execution:
    time: int
    price_ticks: int
    volume: int
    aggressor_id: str | None


@dataclass(frozen=True)
class CompletedChain:
    number: int
    side: Side
    start_time: int
    end_time: int
    completed_time: int
    end_reason: str
    first_price_ticks: int
    price_ticks: int
    executed_volume: int
    execution_count: int
    through_price_levels: bool
    vwap_ticks: float


class SiStopsReference:
    """SI's state transitions with completed-chain summaries for inspection.

    ``trace`` lists internal START/END/CANCEL callbacks, not broadcast messages.
    SI's provisional per-execution broadcasting is outside this small model.
    """

    def __init__(self) -> None:
        self.armed = False
        self.seed_id: str | None = None
        self.active_side: Side | None = None
        self.pending: list[Execution] = []
        self.completed: list[CompletedChain] = []
        self.trace: list[str] = []
        self.canceled_count = 0
        self.current_time = 0
        self._chain_number = 0

    @staticmethod
    def normalize_id(order_id: str | None) -> str:
        # SI maps null/empty to "0"; it does not trim whitespace.
        return "0" if order_id is None or order_id == "" else order_id

    @property
    def pending_volume(self) -> int:
        return sum(item.volume for item in self.pending)

    def on_timestamp(self, at: int) -> None:
        # Time alone cannot start, end, expire, or rearm a chain.
        self.current_time = at

    def on_accepted_mbo(self, action: MboAction, *, at: int) -> None:
        """A forwarded send/replace/cancel; unknown-ID filtering is upstream."""
        if action not in {"send", "replace", "cancel"}:
            raise ValueError("expected an accepted MBO send/replace/cancel")
        self.on_timestamp(at)
        self._boundary(f"mbo:{action}")
        self.armed = True

    def on_depth(self, *, at: int) -> None:
        """Any MBP depth callback ends/resets, but cannot rearm after CANCEL."""
        self.on_timestamp(at)
        self._boundary("depth")

    def _boundary(self, reason: str) -> None:
        if self.active_side is not None:
            self.trace.append("END")
            first, last = self.pending[0], self.pending[-1]
            volume = self.pending_volume
            self.completed.append(CompletedChain(
                number=self._chain_number,
                side=self.active_side,
                start_time=first.time,
                end_time=last.time,
                completed_time=self.current_time,
                end_reason=reason,
                first_price_ticks=first.price_ticks,
                price_ticks=last.price_ticks,
                executed_volume=volume,
                execution_count=len(self.pending),
                through_price_levels=(len(self.pending) > 1
                                      and first.price_ticks != last.price_ticks),
                vwap_ticks=sum(item.price_ticks * item.volume
                               for item in self.pending) / volume,
            ))
        self.seed_id = None
        self.active_side = None
        self.pending = []

    def on_trade(
        self, aggressor_id: str | None, side: Side, volume: int,
        price_ticks: int, *, at: int,
    ) -> None:
        self.on_timestamp(at)
        if side not in {"buy", "sell"}:
            raise ValueError("reference input requires Bookmap's classified side")
        if not self.armed or volume <= 0:
            return
        order_id = self.normalize_id(aggressor_id)
        if self.active_side is not None and self.active_side != side:
            self.trace.append("CANCEL")
            self.canceled_count += 1
            self.seed_id = None
            self.active_side = None
            self.pending = []
            self.armed = False
            return
        if self.seed_id is None:
            self.seed_id = order_id
        elif self.active_side is None and order_id != self.seed_id:
            self.trace.append("START")
            self._chain_number += 1
            self.active_side = side
        # Native detector precedes accumulator, so the START-triggering trade
        # is included, while the initial seed and its pre-START repeats are not.
        if self.active_side is not None:
            self.pending.append(Execution(at, price_ticks, volume, aggressor_id))


def seeded() -> SiStopsReference:
    replay = SiStopsReference()
    replay.on_accepted_mbo("send", at=0)
    return replay


def case_seed_exclusion_and_start_inclusion() -> None:
    replay = seeded()
    replay.on_trade("A", "buy", 5, 100, at=1)
    replay.on_trade("A", "buy", 3, 100, at=2)
    assert replay.pending_volume == 0 and replay.trace == []
    replay.on_trade("B", "buy", 2, 100, at=3)
    assert replay.pending_volume == 2 and replay.trace == ["START"]
    replay.on_trade("B", "buy", 4, 101, at=4)
    replay.on_trade("C", "buy", 1, 101, at=5)
    assert replay.completed == []  # Still provisional until the boundary.
    replay.on_depth(at=6)
    [chain] = replay.completed
    assert (chain.side, chain.executed_volume, chain.execution_count) == ("buy", 7, 3)
    assert (chain.start_time, chain.end_time, chain.completed_time) == (3, 5, 6)
    assert chain.price_ticks == 101 and chain.through_price_levels
    assert isclose(chain.vwap_ticks, 705 / 7)
    assert replay.trace == ["START", "END"]


def case_cancel_and_mbo_only_rearm() -> None:
    replay = seeded()
    replay.on_trade("A", "buy", 1, 100, at=1)
    replay.on_trade("B", "buy", 2, 100, at=2)
    replay.on_trade("C", "sell", 3, 100, at=3)
    assert replay.completed == [] and replay.pending_volume == 0
    assert not replay.armed and replay.canceled_count == 1
    replay.on_depth(at=4)
    replay.on_trade("D", "sell", 4, 100, at=5)
    replay.on_trade("E", "sell", 5, 99, at=6)
    assert replay.trace == ["START", "CANCEL"] and not replay.armed
    replay.on_accepted_mbo("replace", at=7)
    replay.on_trade("F", "sell", 1, 100, at=8)
    replay.on_trade("G", "sell", 2, 99, at=9)
    replay.on_depth(at=10)
    [chain] = replay.completed
    assert (chain.side, chain.executed_volume, chain.number) == ("sell", 2, 2)
    assert replay.trace == ["START", "CANCEL", "START", "END"]


def case_depth_clears_the_seed() -> None:
    replay = seeded()
    replay.on_trade("A", "buy", 1, 100, at=1)
    replay.on_depth(at=2)
    replay.on_trade("B", "buy", 2, 100, at=3)
    assert replay.pending_volume == 0 and replay.trace == []
    replay.on_trade("C", "buy", 4, 100, at=4)
    replay.on_depth(at=5)
    assert replay.completed[0].executed_volume == 4


def case_seed_side_does_not_gate_start() -> None:
    replay = seeded()
    replay.on_trade("A", "buy", 1, 100, at=1)
    replay.on_trade("B", "sell", 2, 100, at=2)
    replay.on_depth(at=3)
    [chain] = replay.completed
    assert chain.side == "sell" and chain.executed_volume == 2
    assert replay.canceled_count == 0


def case_high_volume_same_id_is_not_a_chain() -> None:
    replay = seeded()
    replay.on_trade("A", "buy", 1000, 100, at=1)
    replay.on_trade("A", "buy", 2000, 101, at=2)
    replay.on_depth(at=3)
    assert replay.completed == [] and replay.trace == []


def case_single_included_execution_and_tbpl() -> None:
    replay = seeded()
    replay.on_trade("A", "buy", 1, 100, at=1)
    replay.on_trade("B", "buy", 1, 100, at=2)
    replay.on_depth(at=3)
    [chain] = replay.completed
    assert chain.executed_volume == 1 and chain.execution_count == 1
    assert not chain.through_price_levels and chain.vwap_ticks == 100


def case_time_alone_does_not_expire() -> None:
    replay = seeded()
    replay.on_trade("A", "buy", 1, 100, at=1)
    replay.on_timestamp(10**12)
    assert replay.seed_id == "A" and replay.trace == []
    replay.on_trade("B", "buy", 2, 101, at=10**12 + 1)
    replay.on_timestamp(10**13)
    assert replay.pending_volume == 2 and replay.completed == []
    replay.on_depth(at=10**13 + 1)
    assert replay.completed[0].end_time == 10**12 + 1


def case_return_to_seed_and_endpoint_tbpl() -> None:
    replay = seeded()
    replay.on_trade("A", "buy", 5, 100, at=1)
    replay.on_trade("B", "buy", 3, 100, at=2)
    replay.on_trade("A", "buy", 2, 102, at=3)
    replay.on_trade("B", "buy", 4, 100, at=4)
    replay.on_depth(at=5)
    [chain] = replay.completed
    assert chain.executed_volume == 9 and chain.execution_count == 3
    assert not chain.through_price_levels  # A visited middle level is insufficient.
    assert isclose(chain.vwap_ticks, 904 / 9)


def case_permissive_missing_ids() -> None:
    replay = seeded()
    replay.on_trade(None, "buy", 5, 100, at=1)
    replay.on_trade("", "buy", 3, 100, at=2)
    assert replay.seed_id == "0" and replay.trace == []
    replay.on_trade("B", "buy", 2, 100, at=3)
    replay.on_trade(None, "buy", 1, 100, at=4)
    replay.on_depth(at=5)
    assert replay.completed[0].executed_volume == 3
    replay.on_trade("A", "buy", 1, 100, at=6)
    replay.on_trade("", "buy", 2, 100, at=7)
    replay.on_depth(at=8)
    assert replay.completed[1].executed_volume == 2
    assert replay.normalize_id(" ") == " "  # No invented whitespace trimming.


def case_accepted_mbo_boundaries_and_positive_volume_gate() -> None:
    replay = SiStopsReference()
    replay.on_trade("X", "buy", 1, 100, at=1)
    replay.on_trade("Y", "buy", 2, 100, at=2)
    replay.on_depth(at=3)
    assert replay.trace == [] and not replay.armed
    replay.on_accepted_mbo("send", at=10)
    replay.on_trade("A", "buy", 1, 100, at=11)
    replay.on_trade("B", "buy", 0, 100, at=12)
    replay.on_trade("C", "sell", -1, 100, at=13)
    assert replay.trace == [] and replay.seed_id == "A"
    replay.on_trade("B", "buy", 2, 100, at=14)
    replay.on_accepted_mbo("replace", at=20)
    replay.on_depth(at=21)
    replay.on_trade("A", "buy", 1, 100, at=22)
    replay.on_trade("B", "buy", 3, 100, at=23)
    replay.on_accepted_mbo("cancel", at=24)
    replay.on_trade("A", "buy", 1, 100, at=25)
    replay.on_trade("B", "buy", 4, 100, at=26)
    replay.on_accepted_mbo("send", at=27)
    assert [item.executed_volume for item in replay.completed] == [2, 3, 4]
    assert [item.end_reason for item in replay.completed] == [
        "mbo:replace", "mbo:cancel", "mbo:send",
    ]
    assert [(item.end_time, item.completed_time) for item in replay.completed] == [
        (14, 20), (23, 24), (26, 27),
    ]


def run_examples() -> int:
    cases = [
        case_seed_exclusion_and_start_inclusion,
        case_cancel_and_mbo_only_rearm,
        case_depth_clears_the_seed,
        case_seed_side_does_not_gate_start,
        case_high_volume_same_id_is_not_a_chain,
        case_single_included_execution_and_tbpl,
        case_time_alone_does_not_expire,
        case_return_to_seed_and_endpoint_tbpl,
        case_permissive_missing_ids,
        case_accepted_mbo_boundaries_and_positive_volume_gate,
    ]
    for case in cases:
        try:
            case()
        except AssertionError as exc:
            raise AssertionError(f"Reference trace failed: {case.__name__}") from exc
    return len(cases)


if __name__ == "__main__":
    print(f"SI Stops causal reference replay: {run_examples()} cases passed "
          "(independent model; addon not executed).")
