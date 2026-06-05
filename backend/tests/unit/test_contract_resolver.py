"""Unit tests for the Contract_Resolver (task 9.1).

Example-based coverage of scoring, the documented deterministic tie-break,
manual override (which disables auto-resolution), the candidate-membership
guarantee (no synthetic continuous contract), sliding-window accumulation, and
the needed-contract set.

Covers Requirements 10.1/10.2 (auto-resolution scoring), 10.4 (manual override
disables auto), 10.5 (never a synthetic contract), and 4.6 (needed-contract
set). The numbered Property 21 test is task 9.2.
"""

from __future__ import annotations

import pytest

from app.config import (
    DEFAULT_RESOLVER_QUOTE_WEIGHT,
    DEFAULT_RESOLVER_TRADE_WEIGHT,
)
from app.engines.contract_resolver import (
    CandidateScore,
    ContractResolver,
    score_activity,
    select_active,
)

CANDIDATES = ["GC 08-26", "GC 10-26", "GC 12-26"]


# --- construction / validation -------------------------------------------------


@pytest.mark.unit
def test_requires_at_least_one_candidate():
    with pytest.raises(ValueError):
        ContractResolver([])


@pytest.mark.unit
def test_duplicate_candidates_are_deduplicated_preserving_order():
    r = ContractResolver(["GC 08-26", "GC 10-26", "GC 08-26"])
    assert r.candidates == ("GC 08-26", "GC 10-26")


@pytest.mark.unit
def test_window_must_be_positive():
    with pytest.raises(ValueError):
        ContractResolver(CANDIDATES, window_ms=0)


# --- pure scoring helpers ------------------------------------------------------


@pytest.mark.unit
def test_score_activity_is_weighted_sum():
    assert score_activity(100, 5, 1.0, 0.1) == pytest.approx(100.5)
    assert score_activity(0, 0, 1.0, 0.1) == 0.0


@pytest.mark.unit
def test_select_active_picks_max_score():
    scores = {
        "GC 08-26": CandidateScore("GC 08-26", 100, 5, 100.5),
        "GC 10-26": CandidateScore("GC 10-26", 10, 50, 15.0),
    }
    assert select_active(scores) == "GC 08-26"


@pytest.mark.unit
def test_select_active_requires_non_empty():
    with pytest.raises(ValueError):
        select_active({})


# --- auto-resolution -----------------------------------------------------------


@pytest.mark.unit
def test_resolve_selects_highest_trade_volume_candidate():
    r = ContractResolver(CANDIDATES)
    r.observe("GC 08-26", 100, 5, 1_000)
    r.observe("GC 10-26", 10, 50, 1_000)
    r.observe("GC 12-26", 1, 1, 1_000)
    # 08-26: 100 + 0.5 = 100.5 dominates the quote-heavy 10-26 (10 + 5 = 15).
    assert r.resolve() == "GC 08-26"
    assert r.auto_resolution_enabled is True


@pytest.mark.unit
def test_quote_activity_breaks_a_pure_trade_tie_via_score():
    r = ContractResolver(CANDIDATES)
    r.observe("GC 08-26", 50, 0, 1_000)
    r.observe("GC 10-26", 50, 100, 1_000)
    # Equal trade volume, but 10-26 has more quote activity -> higher score.
    assert r.resolve() == "GC 10-26"


@pytest.mark.unit
def test_resolve_with_no_observations_is_deterministic_and_a_candidate():
    r = ContractResolver(CANDIDATES)
    # All-zero scores -> tie-break falls through to lexically-later contract.
    resolved = r.resolve()
    assert resolved == "GC 12-26"
    assert resolved in r.candidates


# --- tie-break -----------------------------------------------------------------


@pytest.mark.unit
def test_tie_break_prefers_higher_trade_volume_at_equal_score():
    # Construct equal scores with different trade-volume composition.
    # 08-26: tv=10, qe=0 -> score 10.0 ; 10-26: tv=0, qe=100 -> score 10.0.
    r = ContractResolver(["GC 08-26", "GC 10-26"])
    r.observe("GC 08-26", 10, 0, 1_000)
    r.observe("GC 10-26", 0, 100, 1_000)
    assert score_activity(10, 0, DEFAULT_RESOLVER_TRADE_WEIGHT,
                          DEFAULT_RESOLVER_QUOTE_WEIGHT) == pytest.approx(
        score_activity(0, 100, DEFAULT_RESOLVER_TRADE_WEIGHT,
                       DEFAULT_RESOLVER_QUOTE_WEIGHT)
    )
    # Equal score -> higher trade volume wins.
    assert r.resolve() == "GC 08-26"


@pytest.mark.unit
def test_tie_break_prefers_lexically_later_contract_when_fully_tied():
    scores = {
        "GC 08-26": CandidateScore("GC 08-26", 5, 0, 5.0),
        "GC 12-26": CandidateScore("GC 12-26", 5, 0, 5.0),
    }
    # Identical score and trade volume -> lexically-later code wins (front month).
    assert select_active(scores) == "GC 12-26"


# --- manual override -----------------------------------------------------------


@pytest.mark.unit
def test_manual_override_pins_contract_and_disables_auto():
    r = ContractResolver(CANDIDATES)
    r.observe("GC 08-26", 1_000, 0, 1_000)  # would auto-resolve to 08-26
    r.set_manual_override("GC 12-26")
    assert r.resolve() == "GC 12-26"
    assert r.auto_resolution_enabled is False
    assert r.manual_override == "GC 12-26"


@pytest.mark.unit
def test_clearing_override_reenables_auto_resolution():
    r = ContractResolver(CANDIDATES)
    r.observe("GC 08-26", 1_000, 0, 1_000)
    r.set_manual_override("GC 12-26")
    r.set_manual_override(None)
    assert r.auto_resolution_enabled is True
    assert r.resolve() == "GC 08-26"


@pytest.mark.unit
def test_override_must_be_a_candidate():
    r = ContractResolver(CANDIDATES)
    with pytest.raises(ValueError):
        r.set_manual_override("GC 99-99")


# --- candidate-membership guarantee (Req 10.5) --------------------------------


@pytest.mark.unit
def test_resolve_is_always_a_candidate_member():
    r = ContractResolver(CANDIDATES)
    r.observe("GC 10-26", 7, 3, 2_000)
    assert r.resolve() in r.candidates


@pytest.mark.unit
def test_observe_rejects_unknown_contract():
    r = ContractResolver(CANDIDATES)
    with pytest.raises(ValueError):
        r.observe("GC 99-99", 1, 1, 1_000)


@pytest.mark.unit
@pytest.mark.parametrize("tv,qe", [(-1, 0), (0, -1)])
def test_observe_rejects_negative_counts(tv, qe):
    r = ContractResolver(CANDIDATES)
    with pytest.raises(ValueError):
        r.observe("GC 08-26", tv, qe, 1_000)


# --- sliding window ------------------------------------------------------------


@pytest.mark.unit
def test_observations_outside_window_do_not_count():
    r = ContractResolver(CANDIDATES, window_ms=10_000)
    # Old, large activity on 10-26 that should age out.
    r.observe("GC 10-26", 1_000, 0, 1_000)
    # Recent activity advances the window edge to 100_000 - 10_000 = 90_000.
    r.observe("GC 08-26", 5, 0, 100_000)
    scores = r.scores()
    assert scores["GC 10-26"].trade_volume == 0  # aged out
    assert scores["GC 08-26"].trade_volume == 5
    assert r.resolve() == "GC 08-26"


@pytest.mark.unit
def test_observations_within_window_accumulate():
    r = ContractResolver(CANDIDATES, window_ms=10_000)
    r.observe("GC 08-26", 3, 0, 1_000)
    r.observe("GC 08-26", 4, 0, 5_000)
    assert r.scores()["GC 08-26"].trade_volume == 7


# --- needed-contract set (Req 4.6) --------------------------------------------


@pytest.mark.unit
def test_needed_contracts_is_full_candidate_set():
    r = ContractResolver(CANDIDATES)
    assert r.needed_contracts() == set(CANDIDATES)


@pytest.mark.unit
def test_needed_contracts_returns_a_fresh_mutable_copy():
    r = ContractResolver(CANDIDATES)
    needed = r.needed_contracts()
    needed.add("GC 99-99")
    # Mutating the returned set must not affect the resolver.
    assert r.needed_contracts() == set(CANDIDATES)
