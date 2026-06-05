"""Unit tests for the control-plane coordinator (task 9.3).

Example-based coverage of the wiring that turns Contract_Resolver
needed-contract changes into Control_Commands and Active_Contract status
broadcasts:

* exactly one ``subscribe`` per added contract, one ``unsubscribe`` per removed,
  and no commands when the needed set is unchanged (Req 4.6, 1.7, 1.8),
* the pure :func:`plan_control_commands` diff is side-effect free and matches
  the set difference (the invariant Property 7, task 9.4, will assert), and
* an Active_Contract change broadcasts a ``status`` event carrying the new
  contract through the injected seam (Req 20.1), with no broadcast when it is
  unchanged.

Async coroutines are driven with ``asyncio.run``; seams are plain callables /
lists (no mocks) so emission is verified directly. The coordinator is also
exercised against a real :class:`ContractResolver` to confirm the
resolver -> control-plane integration.
"""

from __future__ import annotations

import asyncio

import pytest

from app.engines.contract_resolver import ContractResolver
from app.ingest.control_plane import (
    ACTIVE_CONTRACT_REASON,
    ControlPlaneCoordinator,
    plan_control_commands,
)
from app.models.messages import (
    ChartStatusEvent,
    ControlAction,
    ControlCommand,
    StatusState,
)

CANDIDATES = ["GC 08-26", "GC 10-26", "GC 12-26"]


def _pairs(commands: list[ControlCommand]) -> list[tuple[ControlAction, str]]:
    return [(c.action, c.contract) for c in commands]


# --- pure diff: plan_control_commands -----------------------------------------


@pytest.mark.unit
def test_plan_added_emits_one_subscribe_each():
    cmds = plan_control_commands(set(), {"GC 08-26", "GC 10-26"})
    assert _pairs(cmds) == [
        (ControlAction.SUBSCRIBE, "GC 08-26"),
        (ControlAction.SUBSCRIBE, "GC 10-26"),
    ]


@pytest.mark.unit
def test_plan_removed_emits_one_unsubscribe_each():
    cmds = plan_control_commands({"GC 08-26", "GC 10-26"}, {"GC 08-26"})
    assert _pairs(cmds) == [(ControlAction.UNSUBSCRIBE, "GC 10-26")]


@pytest.mark.unit
def test_plan_unchanged_emits_nothing():
    assert plan_control_commands({"GC 08-26"}, {"GC 08-26"}) == []
    assert plan_control_commands(set(), set()) == []


@pytest.mark.unit
def test_plan_mixed_subscribes_before_unsubscribes():
    cmds = plan_control_commands({"GC 08-26", "GC 10-26"}, {"GC 10-26", "GC 12-26"})
    # added: 12-26 (subscribe), removed: 08-26 (unsubscribe); subscribe first.
    assert _pairs(cmds) == [
        (ControlAction.SUBSCRIBE, "GC 12-26"),
        (ControlAction.UNSUBSCRIBE, "GC 08-26"),
    ]


@pytest.mark.unit
def test_plan_emitted_contracts_equal_the_set_difference():
    prev = {"GC 08-26", "GC 10-26"}
    next_ = {"GC 10-26", "GC 12-26", "GC 02-27"}
    cmds = plan_control_commands(prev, next_)
    subs = {c.contract for c in cmds if c.action is ControlAction.SUBSCRIBE}
    unsubs = {c.contract for c in cmds if c.action is ControlAction.UNSUBSCRIBE}
    assert subs == next_ - prev
    assert unsubs == prev - next_
    # Each affected contract appears in exactly one command.
    assert len(cmds) == len(subs) + len(unsubs)


@pytest.mark.unit
def test_plan_stamps_supplied_time():
    cmds = plan_control_commands(set(), {"GC 08-26"}, time_ms=12345)
    assert cmds[0].time == 12345


@pytest.mark.unit
def test_plan_does_not_mutate_inputs():
    prev = {"GC 08-26"}
    next_ = {"GC 10-26"}
    plan_control_commands(prev, next_)
    assert prev == {"GC 08-26"}
    assert next_ == {"GC 10-26"}


# --- coordinator: subscribe/unsubscribe emission ------------------------------


@pytest.mark.unit
def test_sync_added_sends_one_subscribe_each():
    sent: list[ControlCommand] = []
    coord = ControlPlaneCoordinator(sent.append, clock=lambda: 7)

    cmds = asyncio.run(coord.sync(["GC 08-26", "GC 10-26"]))

    assert _pairs(sent) == [
        (ControlAction.SUBSCRIBE, "GC 08-26"),
        (ControlAction.SUBSCRIBE, "GC 10-26"),
    ]
    assert sent == cmds
    assert all(c.time == 7 for c in sent)
    assert coord.needed_contracts == {"GC 08-26", "GC 10-26"}


@pytest.mark.unit
def test_sync_removed_sends_one_unsubscribe_each():
    sent: list[ControlCommand] = []
    coord = ControlPlaneCoordinator(sent.append)

    asyncio.run(coord.sync(["GC 08-26", "GC 10-26"]))
    sent.clear()
    asyncio.run(coord.sync(["GC 08-26"]))

    assert _pairs(sent) == [(ControlAction.UNSUBSCRIBE, "GC 10-26")]


@pytest.mark.unit
def test_sync_unchanged_sends_no_commands():
    sent: list[ControlCommand] = []
    coord = ControlPlaneCoordinator(sent.append)

    asyncio.run(coord.sync(["GC 08-26", "GC 10-26"]))
    sent.clear()
    cmds = asyncio.run(coord.sync(["GC 08-26", "GC 10-26"]))  # identical set

    assert sent == []
    assert cmds == []


@pytest.mark.unit
def test_sync_mixed_change_emits_both_directions():
    sent: list[ControlCommand] = []
    coord = ControlPlaneCoordinator(sent.append)

    asyncio.run(coord.sync(["GC 08-26", "GC 10-26"]))
    sent.clear()
    asyncio.run(coord.sync(["GC 10-26", "GC 12-26"]))

    assert _pairs(sent) == [
        (ControlAction.SUBSCRIBE, "GC 12-26"),
        (ControlAction.UNSUBSCRIBE, "GC 08-26"),
    ]


@pytest.mark.unit
def test_async_send_control_seam_is_awaited():
    sent: list[ControlCommand] = []

    async def send(cmd: ControlCommand) -> None:
        sent.append(cmd)

    coord = ControlPlaneCoordinator(send)
    asyncio.run(coord.sync(["GC 08-26"]))

    assert _pairs(sent) == [(ControlAction.SUBSCRIBE, "GC 08-26")]


# --- coordinator: Active_Contract / status broadcast (Req 20.1) ---------------


@pytest.mark.unit
def test_active_contract_change_broadcasts_status():
    statuses: list[ChartStatusEvent] = []
    coord = ControlPlaneCoordinator(
        lambda _c: None, broadcast_status=statuses.append, clock=lambda: 42
    )

    asyncio.run(coord.sync(["GC 08-26"], active_contract="GC 08-26"))

    assert len(statuses) == 1
    evt = statuses[0]
    assert evt.state is StatusState.CONNECTED
    assert evt.reason == ACTIVE_CONTRACT_REASON
    assert evt.contract == "GC 08-26"
    assert evt.time == 42
    assert coord.active_contract == "GC 08-26"


@pytest.mark.unit
def test_unchanged_active_contract_does_not_rebroadcast():
    statuses: list[ChartStatusEvent] = []
    coord = ControlPlaneCoordinator(lambda _c: None, broadcast_status=statuses.append)

    asyncio.run(coord.sync(["GC 08-26"], active_contract="GC 08-26"))
    asyncio.run(coord.sync(["GC 08-26"], active_contract="GC 08-26"))

    assert len(statuses) == 1  # only the first change broadcasts


@pytest.mark.unit
def test_active_contract_switch_broadcasts_again():
    statuses: list[ChartStatusEvent] = []
    coord = ControlPlaneCoordinator(lambda _c: None, broadcast_status=statuses.append)

    asyncio.run(coord.sync(["GC 08-26"], active_contract="GC 08-26"))
    asyncio.run(coord.sync(["GC 08-26"], active_contract="GC 10-26"))

    assert [e.contract for e in statuses] == ["GC 08-26", "GC 10-26"]


@pytest.mark.unit
def test_no_status_seam_still_tracks_active_contract():
    coord = ControlPlaneCoordinator(lambda _c: None)
    asyncio.run(coord.sync(["GC 08-26"], active_contract="GC 08-26"))
    assert coord.active_contract == "GC 08-26"


@pytest.mark.unit
def test_active_contract_omitted_does_not_broadcast():
    statuses: list[ChartStatusEvent] = []
    coord = ControlPlaneCoordinator(lambda _c: None, broadcast_status=statuses.append)
    asyncio.run(coord.sync(["GC 08-26"]))  # no active_contract supplied
    assert statuses == []
    assert coord.active_contract is None


# --- integration with a real ContractResolver --------------------------------


@pytest.mark.unit
def test_sync_from_resolver_subscribes_active_contract_once():
    sent: list[ControlCommand] = []
    statuses: list[ChartStatusEvent] = []
    resolver = ContractResolver(CANDIDATES)
    resolver.observe("GC 08-26", 100, 5, 1_000)
    coord = ControlPlaneCoordinator(sent.append, broadcast_status=statuses.append)

    asyncio.run(coord.sync_from_resolver(resolver))

    # needed set is the active source contract only.
    assert _pairs(sent) == [(ControlAction.SUBSCRIBE, "GC 08-26")]
    # Active_Contract resolved to the trade-heavy 08-26 and was broadcast.
    assert [e.contract for e in statuses] == ["GC 08-26"]


@pytest.mark.unit
def test_sync_from_resolver_is_idempotent_when_nothing_changes():
    sent: list[ControlCommand] = []
    resolver = ContractResolver(CANDIDATES)
    resolver.observe("GC 08-26", 100, 5, 1_000)
    coord = ControlPlaneCoordinator(sent.append)

    asyncio.run(coord.sync_from_resolver(resolver))
    sent.clear()
    asyncio.run(coord.sync_from_resolver(resolver))  # needed set unchanged

    assert sent == []
