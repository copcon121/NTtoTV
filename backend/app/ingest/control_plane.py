"""Control plane: turn needed-contract changes into Control_Commands (task 9.3).

The Contract_Resolver computes the set of GC contracts that require data
(``needed_contracts()``; Req 4.6). This module wires *changes* in that set to
the NT_AddOn over the `/ws/nt` control plane and announces Active_Contract
changes to `/ws/chart` clients:

* **Subscribe/unsubscribe diff (Req 4.6, 1.7, 1.8).** Each time the needed set
  is synced, the coordinator diffs it against the previously-needed set and
  emits **exactly one** ``ControlCommand`` ``subscribe`` per *added* contract
  and **exactly one** ``unsubscribe`` per *removed* contract. When the set is
  unchanged it emits **no** commands. Subscribes are sent before unsubscribes
  so the newly-needed contracts are flowing before any dropped contract is
  released. The diff itself is the pure, side-effect-free
  :func:`plan_control_commands` so it is directly exercisable by Property 7
  (task 9.4), which asserts ``Control_Commands == the change in the
  needed-contract set``.

* **Active_Contract / status broadcast (Req 20.1).** When the resolved
  Active_Contract changes, the coordinator broadcasts a
  :class:`~app.models.messages.ChartStatusEvent` (carrying the new ``contract``)
  to subscribed Frontend clients so the symbol/contract label updates
  (Req 10.3, 20.1).

Both transports are **injectable seams** so this component stands alone and is
testable without a live socket or registry:

* ``send_control`` — sends a ``ControlCommand`` to the NT_AddOn. In production
  this is :meth:`app.ingest.endpoint.IngestEndpoint.send_control` (Req 4.6).
* ``broadcast_status`` — pushes a ``ChartStatusEvent`` to `/ws/chart` clients.
  In production this enqueues onto the WebSocket_Registry broadcast (wired in
  task 20.1).

Both seams may be synchronous or asynchronous; awaitable results are awaited.
The full ingest -> resolver -> control-plane wiring is task 20.1.

(Requirements 1.7, 1.8, 4.6, 20.1; design "Contract Auto-Resolution and
Control-Plane Subscribe/Unsubscribe" sequence.)
"""

from __future__ import annotations

import inspect
import logging
from collections.abc import Set as AbstractSet
from typing import Awaitable, Callable, Iterable, Protocol

from ..models.messages import (
    ChartStatusEvent,
    ControlAction,
    ControlCommand,
    StatusState,
)
from ..models.timestamp import CanonicalTimestamp, now_ms

logger = logging.getLogger(__name__)

__all__ = [
    "ACTIVE_CONTRACT_REASON",
    "ControlCommandSender",
    "ChartStatusBroadcaster",
    "NeededContractSource",
    "plan_control_commands",
    "ControlPlaneCoordinator",
]

# ``reason`` carried by the status event broadcast when the Active_Contract
# changes, distinguishing it from connection-state status (e.g. ``stream_gap``,
# ``disconnected``). (Req 20.1)
ACTIVE_CONTRACT_REASON = "active_contract"

# Seam that delivers a ControlCommand to the NT_AddOn over `/ws/nt`. In
# production this is ``IngestEndpoint.send_control``. May be sync or async.
ControlCommandSender = Callable[[ControlCommand], Awaitable[None] | None]

# Seam that broadcasts a ChartStatusEvent to subscribed `/ws/chart` clients. In
# production this enqueues onto the WebSocket_Registry. May be sync or async.
ChartStatusBroadcaster = Callable[[ChartStatusEvent], Awaitable[None] | None]


class NeededContractSource(Protocol):
    """Structural type for the Contract_Resolver inputs this coordinator uses.

    The :class:`~app.engines.contract_resolver.ContractResolver` satisfies this
    protocol; typing against it (rather than importing the concrete class) keeps
    the control plane decoupled from the engines package.
    """

    def needed_contracts(self) -> set[str]: ...

    def resolve(self) -> str: ...


async def _maybe_await(result: Awaitable[None] | None) -> None:
    """Await ``result`` when a seam returned an awaitable; otherwise no-op."""
    if inspect.isawaitable(result):
        await result


def plan_control_commands(
    prev: AbstractSet[str],
    next_: AbstractSet[str],
    *,
    time_ms: CanonicalTimestamp = 0,
) -> list[ControlCommand]:
    """Pure diff: the Control_Commands realizing ``prev`` -> ``next_``.

    Returns one ``subscribe`` :class:`ControlCommand` per contract **added**
    (in ``next_`` but not ``prev``) and one ``unsubscribe`` per contract
    **removed** (in ``prev`` but not ``next_``). When the two sets are equal the
    result is empty -- an unchanged needed set yields no commands (Req 4.6).

    Ordering is deterministic and testable: subscribes first (each group sorted
    lexically), then unsubscribes, so newly-needed contracts are subscribed
    before dropped ones are released. Each emitted contract appears in exactly
    one command, so the set of subscribe/unsubscribe contracts equals the
    set difference -- the invariant Property 7 (task 9.4) asserts. The function
    has no side effects so it can be exercised directly. (Req 1.7, 1.8, 4.6)
    """
    added = sorted(set(next_) - set(prev))
    removed = sorted(set(prev) - set(next_))
    commands: list[ControlCommand] = [
        ControlCommand(action=ControlAction.SUBSCRIBE, contract=c, time=time_ms)
        for c in added
    ]
    commands.extend(
        ControlCommand(action=ControlAction.UNSUBSCRIBE, contract=c, time=time_ms)
        for c in removed
    )
    return commands


class ControlPlaneCoordinator:
    """Drives subscribe/unsubscribe Control_Commands and status broadcasts. (Req 4.6, 20.1)

    Holds the previously-needed contract set and the previously-resolved
    Active_Contract. Each :meth:`sync` diffs the supplied needed set against the
    previous one, sends the resulting Control_Commands through the injected
    ``send_control`` seam (Req 1.7, 1.8, 4.6), and -- when the Active_Contract
    changed -- broadcasts a ``status`` event carrying the new contract through
    the injected ``broadcast_status`` seam (Req 20.1).

    Seams are injected so the coordinator stands alone (no live socket/registry)
    and composes cleanly during full wiring (task 20.1).

    Parameters:

    * ``send_control`` — required seam delivering a ``ControlCommand`` to the
      NT_AddOn (``IngestEndpoint.send_control`` in production).
    * ``broadcast_status`` — optional seam broadcasting a ``ChartStatusEvent`` to
      `/ws/chart` clients; when ``None`` Active_Contract changes are tracked but
      not pushed (useful for isolated control-command tests).
    * ``clock`` — injectable Canonical_Timestamp source stamped on emitted
      commands and status events.
    * ``active_status_state`` — the ``state`` used for the Active_Contract status
      broadcast. The broadcast announces that the resolver has a live resolved
      contract, so it defaults to ``connected``; connection-liveness status
      (degraded/disconnected) is emitted elsewhere (tasks 6.4/6.6/20.1).
    """

    def __init__(
        self,
        send_control: ControlCommandSender,
        *,
        broadcast_status: ChartStatusBroadcaster | None = None,
        clock: Callable[[], CanonicalTimestamp] = now_ms,
        active_status_state: StatusState = StatusState.CONNECTED,
    ) -> None:
        self._send_control = send_control
        self._broadcast_status = broadcast_status
        self._clock = clock
        self._active_status_state = active_status_state
        self._prev_needed: set[str] = set()
        self._prev_active: str | None = None

    @property
    def needed_contracts(self) -> set[str]:
        """Snapshot of the currently-subscribed needed set (fresh copy)."""
        return set(self._prev_needed)

    @property
    def active_contract(self) -> str | None:
        """The most recently broadcast Active_Contract, or ``None`` if unset."""
        return self._prev_active

    async def sync(
        self,
        needed: Iterable[str],
        active_contract: str | None = None,
    ) -> list[ControlCommand]:
        """Reconcile the needed set and optionally the Active_Contract. (Req 4.6, 20.1)

        Diffs ``needed`` against the previously-needed set, sends one
        ``subscribe`` per added and one ``unsubscribe`` per removed contract
        (none when unchanged), then -- if ``active_contract`` is provided and
        differs from the last broadcast one -- broadcasts a ``status`` event
        carrying it. Returns the Control_Commands that were sent so callers (and
        Property 7) can inspect them.
        """
        next_needed = set(needed)
        commands = plan_control_commands(
            self._prev_needed, next_needed, time_ms=self._clock()
        )
        for cmd in commands:
            await _maybe_await(self._send_control(cmd))
        self._prev_needed = next_needed

        if active_contract is not None and active_contract != self._prev_active:
            self._prev_active = active_contract
            await self._broadcast_active_contract(active_contract)

        return commands

    async def sync_from_resolver(
        self, resolver: NeededContractSource
    ) -> list[ControlCommand]:
        """Convenience: sync directly from a Contract_Resolver. (Req 4.6, 20.1)

        Reads ``resolver.needed_contracts()`` and ``resolver.resolve()`` and
        delegates to :meth:`sync`. This is the entry point the full pipeline
        (task 20.1) calls whenever the resolver re-evaluates.
        """
        return await self.sync(resolver.needed_contracts(), resolver.resolve())

    async def _broadcast_active_contract(self, contract: str) -> None:
        """Broadcast an Active_Contract ``status`` change through the seam. (Req 20.1)

        No-op when no broadcast seam is wired.
        """
        if self._broadcast_status is None:
            return
        event = ChartStatusEvent(
            state=self._active_status_state,
            time=self._clock(),
            reason=ACTIVE_CONTRACT_REASON,
            contract=contract,
        )
        await _maybe_await(self._broadcast_status(event))
