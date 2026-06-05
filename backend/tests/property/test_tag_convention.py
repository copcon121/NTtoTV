"""Reference property test demonstrating the tag convention (task 1.1).

This is NOT one of the design's Properties 1-31; it exists only to validate
that the property-test scaffolding (the `gc` Hypothesis profile at >= 100
examples, the `property` marker, and the tag-comment format) works. Real
property tests for Properties 1-31 are added by their respective tasks and
replace this file's role as the lone example.
"""

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st


# Feature: gc-chart-platform, Property 0: scaffold convention check (placeholder, not a design property)
@pytest.mark.property
@given(xs=st.lists(st.integers()))
def test_tag_convention_runs_at_least_100_examples(xs):
    # Sorting is idempotent: a trivial always-true property used purely to
    # exercise the Hypothesis profile and marker wiring.
    assert sorted(sorted(xs)) == sorted(xs)


@pytest.mark.smoke
def test_profile_enforces_minimum_examples():
    # Guard the >=100 iteration mandate from the design Testing Strategy.
    #
    # This validates the canonical ``gc`` profile (the spec floor) explicitly,
    # rather than the currently-active profile. A reduced ``gc-fast`` /
    # ``GC_PBT_*`` override is allowed for quick local iteration without
    # weakening the mandated floor, so we assert against the named ``gc``
    # profile that spec verification runs use.
    from tests.conftest import MIN_PROPERTY_EXAMPLES

    assert settings.get_profile("gc").max_examples >= 100
    assert MIN_PROPERTY_EXAMPLES >= 100
