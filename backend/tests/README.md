# Backend Tests

Test layout for the GC Chart Platform backend. Mirrors the design's Testing
Strategy: property-based tests are the primary correctness guard, complemented
by example/unit, integration, and smoke tests.

## Layout

```
tests/
  conftest.py        # Hypothesis "gc" profile: max_examples >= 100
  property/          # Property-based tests (Hypothesis). One test per design Property 1-31.
  unit/              # Example-based unit tests (schema serialization, config defaults, edge cases).
  integration/       # Transport/wiring tests (/ws/nt accept, control plane, rebuild reads).
  smoke/             # One-time setup/configuration checks (WAL mode, table presence).
```

## Property-test tag convention

Every property-based test maps to exactly one design property (Properties 1-31)
and MUST:

1. Be marked with `@pytest.mark.property`.
2. Include a tag comment in this EXACT format on the test (module or function):

   ```python
   # Feature: gc-chart-platform, Property {n}: {property_text}
   ```

3. Run a minimum of 100 iterations. The `gc` Hypothesis profile in
   `conftest.py` sets `max_examples=100` by default; tests may raise it but must
   never drop below 100.

Example skeleton:

```python
import pytest
from hypothesis import given, strategies as st


# Feature: gc-chart-platform, Property 1: Per-stream sequence assignment is strictly monotonic
@pytest.mark.property
@given(st.lists(st.integers()))
def test_property_1_sequence_monotonic(events):
    ...
```

## Running

```
pip install -r requirements-test.txt
pytest                      # all tests
pytest -m property          # only property-based tests
pytest -m "not property"    # example/integration/smoke
```
