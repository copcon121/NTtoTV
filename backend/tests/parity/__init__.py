"""Reference-indicator parity harness + fixtures (task 19.1).

Houses the deterministic replay driver (:mod:`replay_harness`) and the fixtures
loader (:mod:`fixtures_loader`) used by the parity property tests (Properties
28-30 / tasks 19.2-19.4). The fixtures live in ``tests/fixtures/parity`` and
pair a recorded/spec-derived event stream with the reference-indicator oracle
output for that exact stream. (Requirements 13.8, 14.9, 15.6)
"""
