"""Property test for control-command emission (task 9.4, design Property 7).

Property 7 asserts that for *any* transition from an old needed-contract set to
a new one, the Backend emits exactly one ``subscribe`` Control_Command per
contract added and exactly one ``unsubscribe`` per contract removed, and emits
no commands when the set is unchanged.

Two complementary checks:

1. The pure diff :func:`~app.ingest.control_plane.plan_control_commands` over an
   arbitrary ``(prev, next)`` pair: the set of subscribed contracts equals
   ``next - prev``, the set of unsubscribed contracts equals ``prev - next``,
   each affected contract appears in exactly one command, and an unchanged set
   yields no commands.

2. The stateful :class:`~app.ingest.control_plane.ControlPlaneCoordinator` over
   an arbitrary *sequence* of needed sets: each :meth:`sync` emits exactly the
   diff against the previously-synced set (tracked by an in-memory oracle), and
   a repeated set emits nothing.

Uses the design-mandated Hypothesis ``gc`` profile (>= 100 examples).

**Validates: Requirements 4.6, 1.7, 1.8**
"""

from __future__ import annotations

import asyncio

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.ingest.control_plane import ControlPlaneCoordinator, plan_control_commands
from app.models.messages import ControlAction, ControlCommand

# A small contract universe so generated needed sets overlap heavily, exercising
# adds, removes, and unchanged transitions rather than always-disjoint sets.
_CONTRACTS = (
    "GC 08-26",
    "GC 10-26",
    "GC 12-26",
    "GC 02-27",
    "GC 04-27",
)

_contract_set = st.sets(st.sampled_from(_CONTRACTS), max_size=len(_CONTRACTS))


def _subs(cmds: list[ControlCommand]) -> set[str]:
    return {c.contract for c in cmds if c.action is ControlAction.SUBSCRIBE}


def _unsubs(cmds: list[ControlCommand]) -> set[str]:
    return {c.contract for c in cmds if c.action is ControlAction.UNSUBSCRIBE}


# Feature: gc-chart-platform, Property 7: Control_Commands equal the change in the needed-contract set
@pytest.mark.property
@given(prev=_contract_set, next_=_contract_set)
def test_property_7_plan_equals_set_difference(prev, next_) -> None:
    cmds = plan_control_commands(prev, next_)

    added = next_ - prev
    removed = prev - next_

    # Exactly one subscribe per added contract, one unsubscribe per removed.
    assert _subs(cmds) == added
    assert _unsubs(cmds) == removed
    # No contract appears in more than one command (counts, not just sets).
    assert len(cmds) == len(added) + len(removed)
    # Unchanged set -> no commands.
    if added == set() and removed == set():
        assert cmds == []


# Feature: gc-chart-platform, Property 7: Control_Commands equal the change in the needed-contract set
@pytest.mark.property
@given(transitions=st.lists(_contract_set, min_size=1, max_size=20))
def test_property_7_coordinator_emits_diff_per_sync(transitions) -> None:
    sent: list[ControlCommand] = []
    coord = ControlPlaneCoordinator(sent.append, clock=lambda: 0)

    async def run() -> None:
        prev: set[str] = set()  # coordinator starts with an empty needed set
        for needed in transitions:
            sent.clear()
            cmds = await coord.sync(needed)

            added = needed - prev
            removed = prev - needed

            # Returned commands and the ones actually sent agree.
            assert cmds == sent
            # Exactly the set difference, one command per affected contract.
            assert _subs(cmds) == added
            assert _unsubs(cmds) == removed
            assert len(cmds) == len(added) + len(removed)
            if added == set() and removed == set():
                assert cmds == []  # unchanged set -> no commands

            # The coordinator now tracks the synced set.
            assert coord.needed_contracts == needed
            prev = set(needed)

    asyncio.run(run())
