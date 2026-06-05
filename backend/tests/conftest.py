"""Shared pytest + Hypothesis configuration for the backend test suite.

Registers Hypothesis profiles for property-based tests. The canonical ``gc``
profile pins the design's minimum of 100 examples per property test (Hypothesis
``max_examples >= 100``). The profile actually loaded for a run is
``gc-resolved``, whose example count is overridable via the ``GC_PBT_EXAMPLES``
environment variable.

IMPORTANT: the design mandates >= 100 examples per property test for spec
verification, so **CI MUST set ``GC_PBT_EXAMPLES=100``** (or higher). For local
/ dev iteration the resolved profile defaults to a FASTER 30 examples so the
suite runs quickly; this reduced local default MUST NOT be used for spec
verification, where the 100-example floor applies.

Override knobs (env vars):
* ``GC_PBT_EXAMPLES=<n>`` — run exactly ``n`` examples (any n; CI sets 100, the
  local default is 30 for speed).
* ``GC_PBT_FAST=1`` — shortcut for a small example count (20) for a fast pass.
"""

from __future__ import annotations

import os

from hypothesis import HealthCheck, settings

# The design mandates a minimum of 100 examples per property test (the CI floor).
MIN_PROPERTY_EXAMPLES = 100

# Faster default used for local/dev runs when no env override is supplied. CI
# overrides this back up to >= 100 by setting GC_PBT_EXAMPLES=100.
DEFAULT_LOCAL_EXAMPLES = int(os.environ.get("GC_PBT_EXAMPLES", "30"))

# Reduced count used for a quick local pass (NOT for spec verification).
FAST_PROFILE_EXAMPLES = 20


def _resolve_examples() -> int:
    """Pick the example count from env, defaulting to the faster local value.

    Honors ``GC_PBT_EXAMPLES`` first (CI sets it to 100 to meet the spec floor),
    then ``GC_PBT_FAST``, otherwise falls back to the 30-example local default.
    """
    raw = os.environ.get("GC_PBT_EXAMPLES")
    if raw is not None:
        try:
            n = int(raw)
            if n > 0:
                return n
        except ValueError:
            pass
    if os.environ.get("GC_PBT_FAST", "").strip().lower() in {"1", "true", "yes", "on"}:
        return FAST_PROFILE_EXAMPLES
    return DEFAULT_LOCAL_EXAMPLES


_EXAMPLES = _resolve_examples()

# Canonical profile: the spec-mandated >= 100 examples.
settings.register_profile(
    "gc",
    max_examples=MIN_PROPERTY_EXAMPLES,
    deadline=None,
    suppress_health_check=[HealthCheck.too_slow],
)

# Reduced profile for quick iteration.
settings.register_profile(
    "gc-fast",
    max_examples=FAST_PROFILE_EXAMPLES,
    deadline=None,
    suppress_health_check=[HealthCheck.too_slow],
)

# Resolved profile honoring the env overrides (defaults to the faster local
# 30-example count; CI sets GC_PBT_EXAMPLES=100 to restore the spec floor).
settings.register_profile(
    "gc-resolved",
    max_examples=_EXAMPLES,
    deadline=None,
    suppress_health_check=[HealthCheck.too_slow],
)

settings.load_profile("gc-resolved")
