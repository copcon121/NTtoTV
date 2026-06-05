"""Property test for keyed last-write-wins upserts (task 3.7).

Property 13 asserts that for *any* sequence of bar or order-flow upserts, at
most one record exists per ``(symbol, contract, timeframe, time)`` key, the
stored record for each key equals the **most recent** write for that key, and
distinct keys coexist independently.

The test is model-based: it generates a sequence of upserts drawn from a small
pool of keys (so collisions are frequent and last-write-wins is genuinely
exercised), applies them to a fresh Cache_Store, maintains an in-memory
"expected last write per key" oracle, then reads every key back and checks the
stored value equals the oracle and that the row count equals the number of
distinct keys written.

Uses the design-mandated Hypothesis ``gc`` profile (>= 100 examples).
(Validates: Requirements 8.2)
"""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.storage import BarRecord, CacheStore, VolumeDeltaRecord

# Small pools so independently-generated upserts collide on the same key often,
# making last-write-wins (rather than plain insert) the property under test.
_SYMBOLS = ("GC",)
_CONTRACTS = ("GC 08-26", "GC 10-26")
_TIMEFRAMES = ("1m", "5m", "1h")
_TIMES = (1_000, 2_000, 3_000)

_key_strategy = st.tuples(
    st.sampled_from(_SYMBOLS),
    st.sampled_from(_CONTRACTS),
    st.sampled_from(_TIMEFRAMES),
    st.sampled_from(_TIMES),
)


def _bar_from(key: tuple[str, str, str, int], payload: int) -> BarRecord:
    """Build a BarRecord whose non-key fields are derived from ``payload``."""
    symbol, contract, timeframe, time = key
    return BarRecord(
        symbol=symbol,
        contract=contract,
        timeframe=timeframe,
        time=time,
        open=float(payload),
        high=float(payload) + 5.0,
        low=float(payload) - 5.0,
        close=float(payload) + 1.0,
        volume=payload,
        closed=bool(payload % 2),
    )


def _vd_from(key: tuple[str, str, str, int], payload: int) -> VolumeDeltaRecord:
    """Build a VolumeDeltaRecord whose non-key fields are derived from ``payload``."""
    symbol, contract, timeframe, time = key
    return VolumeDeltaRecord(
        symbol=symbol,
        contract=contract,
        timeframe=timeframe,
        time=time,
        volume=payload + 100,
        buy_volume=payload + 60,
        sell_volume=payload + 40,
        delta=payload - 7,
        delta_high=payload + 12,
        delta_low=payload - 3,
        open_delta=0,
        close_delta=payload - 7,
    )


# A write is (key, payload). Payloads are distinct enough that "the last write
# wins" is observable across non-key columns.
_writes_strategy = st.lists(
    st.tuples(_key_strategy, st.integers(min_value=0, max_value=10_000)),
    min_size=1,
    max_size=60,
)


# Feature: gc-chart-platform, Property 13: Bars and order-flow upserts are keyed and last-write-wins
@pytest.mark.property
@given(writes=_writes_strategy)
def test_bar_upserts_are_keyed_last_write_wins(writes) -> None:
    data_dir = Path(tempfile.mkdtemp(prefix="gc_keyed_bar_"))
    store = CacheStore(data_dir / "app.sqlite")
    try:
        expected: dict[tuple[str, str, str, int], BarRecord] = {}
        for key, payload in writes:
            rec = _bar_from(key, payload)
            store.upsert_bar(rec)
            expected[key] = rec  # last write for this key wins

        # Every key holds exactly the last-written record.
        for key, want in expected.items():
            symbol, contract, timeframe, time = key
            rows = store.read_bars(symbol, contract, timeframe, frm=time, to=time)
            assert len(rows) == 1  # at most one record per key
            assert rows[0] == want

        # Row count per (symbol, contract, timeframe) equals the distinct keys
        # written for it — distinct keys coexist, duplicates do not accumulate.
        for symbol in _SYMBOLS:
            for contract in _CONTRACTS:
                for timeframe in _TIMEFRAMES:
                    distinct = {
                        k for k in expected
                        if k[0] == symbol and k[1] == contract and k[2] == timeframe
                    }
                    rows = store.read_bars(symbol, contract, timeframe)
                    assert len(rows) == len(distinct)
                    assert {(r.symbol, r.contract, r.timeframe, r.time) for r in rows} == distinct
    finally:
        store.close()
        shutil.rmtree(data_dir, ignore_errors=True)


# Feature: gc-chart-platform, Property 13: Bars and order-flow upserts are keyed and last-write-wins
@pytest.mark.property
@given(writes=_writes_strategy)
def test_volume_delta_upserts_are_keyed_last_write_wins(writes) -> None:
    data_dir = Path(tempfile.mkdtemp(prefix="gc_keyed_vd_"))
    store = CacheStore(data_dir / "app.sqlite")
    try:
        expected: dict[tuple[str, str, str, int], VolumeDeltaRecord] = {}
        for key, payload in writes:
            rec = _vd_from(key, payload)
            store.upsert_volume_delta(rec)
            expected[key] = rec  # last write for this key wins

        for key, want in expected.items():
            symbol, contract, timeframe, time = key
            rows = store.read_volume_delta(
                symbol, contract, timeframe, frm=time, to=time
            )
            assert len(rows) == 1
            assert rows[0] == want

        for symbol in _SYMBOLS:
            for contract in _CONTRACTS:
                for timeframe in _TIMEFRAMES:
                    distinct = {
                        k for k in expected
                        if k[0] == symbol and k[1] == contract and k[2] == timeframe
                    }
                    rows = store.read_volume_delta(symbol, contract, timeframe)
                    assert len(rows) == len(distinct)
                    assert {
                        (r.symbol, r.contract, r.timeframe, r.time) for r in rows
                    } == distinct
    finally:
        store.close()
        shutil.rmtree(data_dir, ignore_errors=True)
