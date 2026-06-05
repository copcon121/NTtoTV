"""Contract_Resolver: selects the Active_Contract among real candidates.

The resolver scores each Candidate_Contract over a sliding recent window from
its trade volume and quote activity, and selects the maximum-scoring candidate
as the Active_Contract (Req 10.2). A manual override pins the Active_Contract
and disables auto-resolution (Req 10.4). The resolver never synthesizes a
continuous contract -- ``resolve()`` always returns a member of the configured
candidate set (Req 10.5). ``needed_contracts()`` reports the set of contracts
that require data and drives subscribe/unsubscribe Control_Commands (Req 4.6),
which are wired in task 9.3.

Scoring (see the design's "Contract Resolution Scoring" section):

    score = trade_weight * trade_volume + quote_weight * quote_events

accumulated over observations whose timestamp falls within ``window_ms`` of the
most recent observation. The candidate with the maximum score wins; ties are
broken deterministically by **higher windowed trade volume**, then by
**lexically-later contract code** (which favors the nearer front month). The
scoring/selection logic is kept pure (see :func:`score_activity` and
:func:`select_active`) so it is directly exercisable by Property 21 (task 9.2).
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass

from ..config import (
    DEFAULT_RESOLVER_QUOTE_WEIGHT,
    DEFAULT_RESOLVER_TRADE_WEIGHT,
    DEFAULT_RESOLVER_WINDOW_MS,
)

__all__ = [
    "CandidateScore",
    "ContractResolver",
    "score_activity",
    "select_active",
]


@dataclass(frozen=True, slots=True)
class CandidateScore:
    """Windowed activity and resulting score for a single candidate.

    ``trade_volume`` and ``quote_events`` are the sums accumulated within the
    recent window; ``score`` is the weighted combination used for ranking.
    """

    contract: str
    trade_volume: int
    quote_events: int
    score: float


def score_activity(
    trade_volume: int,
    quote_events: int,
    trade_weight: float,
    quote_weight: float,
) -> float:
    """Pure scoring function: ``trade_weight*tv + quote_weight*qe`` (Req 10.2).

    Kept free of any resolver state so Property 21 can exercise it directly.
    """

    return trade_weight * trade_volume + quote_weight * quote_events


def select_active(scores: dict[str, CandidateScore]) -> str:
    """Pure selection: return the winning contract for the given scores.

    The winner maximizes the documented, deterministic ranking key:

    1. higher ``score``;
    2. then higher windowed ``trade_volume``;
    3. then lexically-later contract code (the larger string), which favors the
       nearer front month.

    ``scores`` must be non-empty. The returned contract is always one of the
    keys of ``scores`` -- never a synthesized continuous contract (Req 10.5).
    """

    if not scores:
        raise ValueError("select_active requires at least one candidate score")

    def rank_key(item: tuple[str, CandidateScore]) -> tuple[float, int, str]:
        contract, cs = item
        return (cs.score, cs.trade_volume, contract)

    winner, _ = max(scores.items(), key=rank_key)
    return winner


class ContractResolver:
    """Selects the Active_Contract from a fixed candidate list. (Req 10)

    Auto-resolution scores candidates from recent trade volume + quote activity
    (Req 10.2). A manual override pins the Active_Contract and disables
    auto-resolution (Req 10.4). The resolver only ever returns a configured
    candidate (Req 10.5).
    """

    def __init__(
        self,
        candidates: list[str],
        *,
        window_ms: int = DEFAULT_RESOLVER_WINDOW_MS,
        trade_weight: float = DEFAULT_RESOLVER_TRADE_WEIGHT,
        quote_weight: float = DEFAULT_RESOLVER_QUOTE_WEIGHT,
    ) -> None:
        # Preserve order for stability but enforce uniqueness and non-emptiness:
        # the resolver must always have a real candidate to return (Req 10.5).
        seen: set[str] = set()
        ordered: list[str] = []
        for c in candidates:
            if c not in seen:
                seen.add(c)
                ordered.append(c)
        if not ordered:
            raise ValueError("ContractResolver requires at least one candidate")
        if window_ms <= 0:
            raise ValueError("window_ms must be positive")

        self._candidates: tuple[str, ...] = tuple(ordered)
        self._candidate_set: frozenset[str] = frozenset(ordered)
        self._window_ms = window_ms
        self._trade_weight = trade_weight
        self._quote_weight = quote_weight

        # Per-candidate ring of (ts_ms, trade_volume, quote_events) observations.
        self._obs: dict[str, deque[tuple[int, int, int]]] = {
            c: deque() for c in self._candidates
        }
        self._max_ts: int | None = None
        self._override: str | None = None

    # -- candidate inventory ---------------------------------------------------

    @property
    def candidates(self) -> tuple[str, ...]:
        """The configured candidate contracts, in declaration order."""

        return self._candidates

    @property
    def auto_resolution_enabled(self) -> bool:
        """True when no manual override is set (Req 10.2 vs 10.4)."""

        return self._override is None

    @property
    def manual_override(self) -> str | None:
        """The pinned contract when a manual override is active, else None."""

        return self._override

    # -- observation -----------------------------------------------------------

    def observe(
        self, contract: str, trade_volume: int, quote_events: int, ts_ms: int
    ) -> None:
        """Record recent per-candidate activity. (Req 10.2)

        ``trade_volume`` and ``quote_events`` are non-negative counts attributed
        to ``contract`` at Canonical_Timestamp ``ts_ms``. Observations older than
        ``window_ms`` relative to the most recent observation are pruned.
        """

        if contract not in self._candidate_set:
            raise ValueError(f"unknown candidate contract: {contract!r}")
        if trade_volume < 0:
            raise ValueError("trade_volume must be non-negative")
        if quote_events < 0:
            raise ValueError("quote_events must be non-negative")

        self._obs[contract].append((ts_ms, trade_volume, quote_events))
        if self._max_ts is None or ts_ms > self._max_ts:
            self._max_ts = ts_ms
        self._prune(contract)

    def _prune(self, contract: str) -> None:
        """Drop observations for ``contract`` that fell out of the window."""

        if self._max_ts is None:
            return
        edge = self._max_ts - self._window_ms
        ring = self._obs[contract]
        # Observations are appended in arrival order; entries with ts < edge are
        # outside the window. Out-of-order arrivals are tolerated by the score
        # pass, which re-filters; pruning here is only memory hygiene.
        while ring and ring[0][0] < edge:
            ring.popleft()

    # -- scoring ---------------------------------------------------------------

    def _windowed_scores(self) -> dict[str, CandidateScore]:
        """Compute the windowed :class:`CandidateScore` for every candidate."""

        edge = None if self._max_ts is None else self._max_ts - self._window_ms
        scores: dict[str, CandidateScore] = {}
        for contract in self._candidates:
            tv = 0
            qe = 0
            if edge is not None:
                for ts_ms, trade_volume, quote_events in self._obs[contract]:
                    if ts_ms >= edge:
                        tv += trade_volume
                        qe += quote_events
            scores[contract] = CandidateScore(
                contract=contract,
                trade_volume=tv,
                quote_events=qe,
                score=score_activity(
                    tv, qe, self._trade_weight, self._quote_weight
                ),
            )
        return scores

    def scores(self) -> dict[str, CandidateScore]:
        """Expose current windowed scores per candidate (read-only snapshot)."""

        return self._windowed_scores()

    # -- resolution ------------------------------------------------------------

    def resolve(self) -> str:
        """Return the Active_Contract. (Req 10.2, 10.4, 10.5)

        When a manual override is set, the override is returned and
        auto-resolution is disabled (Req 10.4). Otherwise the maximum-scoring
        candidate under the documented scoring + tie-break is returned
        (Req 10.2). The result is always a configured candidate (Req 10.5).
        """

        if self._override is not None:
            return self._override
        return select_active(self._windowed_scores())

    def set_manual_override(self, contract: str | None) -> None:
        """Pin (or clear) the Active_Contract override. (Req 10.4)

        Passing a candidate contract pins it as the Active_Contract and disables
        auto-resolution. Passing ``None`` clears the override and re-enables
        auto-resolution. The override must be a configured candidate so the
        resolver never returns a synthetic contract (Req 10.5).
        """

        if contract is not None and contract not in self._candidate_set:
            raise ValueError(f"override is not a candidate contract: {contract!r}")
        self._override = contract

    # -- control-plane input ---------------------------------------------------

    def needed_contracts(self) -> set[str]:
        """Set of contracts requiring data; drives Control_Commands. (Req 4.6)

        In v1 all candidates remain subscribed so the resolver keeps receiving
        per-candidate activity, and the Active_Contract (always a candidate) is
        charted. The needed set is therefore the full candidate set. The wiring
        that turns changes in this set into subscribe/unsubscribe commands is
        task 9.3.
        """

        return set(self._candidate_set)
