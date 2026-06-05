"""Property test for contract resolution (task 9.2, design Property 21).

Generates arbitrary candidate sets and per-candidate activity (trade volume +
quote activity) and drives the
:class:`~app.engines.contract_resolver.ContractResolver`, asserting:

* ``resolve()`` always returns a member of the configured candidate set -- never
  a synthesized/continuous contract (Req 10.5);
* with auto-resolution enabled, the selection matches the documented scoring
  (``trade_weight*trade_volume + quote_weight*quote_events`` over the recent
  window) and the documented deterministic tie-break (higher score, then higher
  windowed trade volume, then lexically-later contract code) (Req 10.2);
* with a manual override set, ``resolve()`` returns the override and
  auto-resolution is disabled regardless of scores; clearing it re-enables auto
  and restores the scored selection (Req 10.4).

To keep the windowed scoring deterministic for the oracle, all observations are
emitted with timestamps inside a single window span, so every observation counts
toward each candidate's windowed score; the expected winner is computed
independently via the pure ``score_activity`` + ``select_active`` helpers.

**Validates: Requirements 10.2, 10.4, 10.5**
"""

from __future__ import annotations

from dataclasses import dataclass

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.engines.contract_resolver import (
    CandidateScore,
    ContractResolver,
    score_activity,
    select_active,
)

# A varied alphabet so generated contract codes exercise the lexical tie-break.
_CONTRACT_ALPHABET = "ABCDEFG 0123456789-"


@dataclass(frozen=True)
class _Scenario:
    candidates: list[str]
    window_ms: int
    trade_weight: float
    quote_weight: float
    observations: list[tuple[str, int, int, int]]  # (contract, tv, qe, ts_ms)
    override: str


@st.composite
def scenarios(draw: st.DrawFn) -> _Scenario:
    candidates = draw(
        st.lists(
            st.text(alphabet=_CONTRACT_ALPHABET, min_size=1, max_size=6),
            min_size=1,
            max_size=6,
            unique=True,
        )
    )
    window_ms = draw(st.integers(min_value=1_000, max_value=120_000))
    trade_weight = draw(
        st.floats(min_value=0.0, max_value=10.0, allow_nan=False, allow_infinity=False)
    )
    quote_weight = draw(
        st.floats(min_value=0.0, max_value=10.0, allow_nan=False, allow_infinity=False)
    )

    n = draw(st.integers(min_value=0, max_value=40))
    observations: list[tuple[str, int, int, int]] = []
    for _ in range(n):
        contract = draw(st.sampled_from(candidates))
        tv = draw(st.integers(min_value=0, max_value=10_000))
        qe = draw(st.integers(min_value=0, max_value=10_000))
        # All timestamps inside [0, window_ms) so every observation is in-window.
        ts = draw(st.integers(min_value=0, max_value=window_ms - 1))
        observations.append((contract, tv, qe, ts))

    override = draw(st.sampled_from(candidates))
    return _Scenario(
        candidates=candidates,
        window_ms=window_ms,
        trade_weight=trade_weight,
        quote_weight=quote_weight,
        observations=observations,
        override=override,
    )


def _expected_winner(scenario: _Scenario) -> str:
    """Independent oracle: aggregate in-window activity then apply select_active."""
    agg: dict[str, tuple[int, int]] = {c: (0, 0) for c in scenario.candidates}
    for contract, tv, qe, _ts in scenario.observations:
        cur_tv, cur_qe = agg[contract]
        agg[contract] = (cur_tv + tv, cur_qe + qe)

    scores: dict[str, CandidateScore] = {}
    for contract in scenario.candidates:
        tv, qe = agg[contract]
        scores[contract] = CandidateScore(
            contract=contract,
            trade_volume=tv,
            quote_events=qe,
            score=score_activity(
                tv, qe, scenario.trade_weight, scenario.quote_weight
            ),
        )
    return select_active(scores)


# Feature: gc-chart-platform, Property 21: Contract resolution selects a real candidate, honoring override
@pytest.mark.property
@given(scenario=scenarios())
def test_property_21_contract_resolution_honors_override(scenario: _Scenario):
    resolver = ContractResolver(
        scenario.candidates,
        window_ms=scenario.window_ms,
        trade_weight=scenario.trade_weight,
        quote_weight=scenario.quote_weight,
    )
    candidate_set = set(scenario.candidates)

    for contract, tv, qe, ts in scenario.observations:
        resolver.observe(contract, tv, qe, ts)

    # (a) Auto-resolution enabled: result is a real candidate matching the
    # documented scoring + tie-break.
    assert resolver.auto_resolution_enabled is True
    resolved = resolver.resolve()
    assert resolved in candidate_set  # never a synthesized continuous contract
    assert resolved == _expected_winner(scenario)

    # (b) Manual override pins the result and disables auto-resolution,
    # regardless of the scored activity.
    resolver.set_manual_override(scenario.override)
    assert resolver.auto_resolution_enabled is False
    assert resolver.manual_override == scenario.override
    overridden = resolver.resolve()
    assert overridden == scenario.override
    assert overridden in candidate_set

    # (c) Clearing the override re-enables auto-resolution and restores the
    # scored selection.
    resolver.set_manual_override(None)
    assert resolver.auto_resolution_enabled is True
    assert resolver.resolve() == _expected_winner(scenario)
    assert resolver.resolve() in candidate_set
