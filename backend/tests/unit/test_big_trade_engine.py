"""Unit tests for the BigTrade_Engine (task 16.1).

Worked examples for tape reconstruction in simple mode, NT-style adjacent
same-time/same-side merging, and the volume filter (MinVolume=30, MaxVolume=-1
default). (Req 15.1, 15.2, 15.3, 15.4)
"""

from __future__ import annotations

import pytest

from app.engines.big_trade_engine import BigTradeEngine
from app.models.canonical import NormalizedTrade, Side

SYMBOL = "GC"
CONTRACT = "GC 08-26"


def _t(time, price, volume, bid=None, ask=None, seq=0, time_ticks=None) -> NormalizedTrade:
    return NormalizedTrade(
        symbol=SYMBOL,
        contract=CONTRACT,
        time=time,
        price=price,
        volume=volume,
        bid=bid,
        ask=ask,
        best_bid=None,
        best_ask=None,
        sequence=seq,
        time_ticks=time_ticks,
    )


@pytest.mark.unit
def test_classify_uses_closer_bid_ask_before_tick_rule():
    eng = BigTradeEngine()
    assert eng.classify(
        trade_price=100.4,
        bid=100.0,
        ask=101.0,
        last_side=None,
        prev_price=100.3,
    ) is Side.SELL
    assert eng.classify(
        trade_price=100.6,
        bid=100.0,
        ask=101.0,
        last_side=None,
        prev_price=100.7,
    ) is Side.BUY


@pytest.mark.unit
def test_first_unclassified_trade_is_dropped_but_seeds_prev_price():
    eng = BigTradeEngine(min_volume=1)
    out = eng.merge_stream(
        [
            _t(1000, 100.0, 50),  # no quote/prior side -> NT Unknown -> dropped
            _t(2000, 100.1, 40),  # uptick from prior print -> buy
        ]
    )
    assert [(b.time, b.volume, b.side) for b in out] == [
        (2000, 40, Side.BUY)
    ]


@pytest.mark.unit
def test_merge_same_timestamp_and_side_sums_volume_last_price():
    eng = BigTradeEngine()
    out = eng.merge_stream(
        [
            _t(1000, 100.0, 20, ask=100.0),  # buy
            _t(1000, 100.1, 15, ask=100.0),  # buy (merged) -> 35, price 100.1
        ]
    )
    assert len(out) == 1
    b = out[0]
    assert b.volume == 35 and b.price == 100.1 and b.side is Side.BUY
    assert b.trade_id == 1


@pytest.mark.unit
def test_distinct_nt_time_ticks_inside_same_millisecond_do_not_merge():
    eng = BigTradeEngine(min_volume=1)
    out = eng.merge_stream(
        [
            _t(1000, 100.0, 46, bid=100.0, time_ticks=638858610886080001),
            _t(1000, 99.9, 43, bid=100.0, time_ticks=638858610886080002),
        ]
    )
    assert [(b.trade_id, b.time, b.volume, b.price) for b in out] == [
        (1, 1000, 46, 100.0),
        (2, 1000, 43, 99.9),
    ]


@pytest.mark.unit
def test_duplicate_timestamp_run_guard_does_not_hide_threshold_marker():
    eng = BigTradeEngine(dedupe_repeated_timestamp_runs=True)
    one_copy = [
        _t(1000, 100.0, 1, bid=100.0),
        _t(1000, 99.9, 10, bid=100.0),
        _t(1000, 99.8, 6, bid=100.0),
    ]

    out = eng.merge_stream([*one_copy, *one_copy])

    assert [(b.time, b.price, b.volume, b.side) for b in out] == [
        (1000, 99.8, 34, Side.SELL)
    ]


@pytest.mark.unit
def test_duplicate_single_large_print_guard_counts_one_transport_copy():
    eng = BigTradeEngine(dedupe_repeated_timestamp_runs=True)

    out = eng.merge_stream(
        [
            _t(1000, 101.0, 72, ask=101.0, time_ticks=639173879039480000),
            _t(1000, 101.0, 72, ask=101.0, time_ticks=639173879039480000),
        ]
    )

    assert [(b.time, b.price, b.volume, b.side) for b in out] == [
        (1000, 101.0, 72, Side.BUY)
    ]


@pytest.mark.unit
def test_opposite_sides_same_timestamp_not_merged():
    eng = BigTradeEngine(min_volume=1)
    out = eng.merge_stream(
        [
            _t(1000, 100.0, 20, ask=100.0),  # buy 20
            _t(1000, 99.9, 25, bid=100.0),   # sell 25
        ]
    )
    vols = {(b.side, b.volume) for b in out}
    assert vols == {(Side.BUY, 20), (Side.SELL, 25)}


@pytest.mark.unit
def test_same_timestamp_side_that_reappears_starts_new_nt_group():
    eng = BigTradeEngine(min_volume=1)
    out = eng.merge_stream(
        [
            _t(1000, 100.0, 20, ask=100.0),  # buy group 1
            _t(1000, 99.9, 25, bid=100.0),   # sell group 2
            _t(1000, 100.1, 15, ask=100.0),  # buy group 3, not merged with group 1
        ]
    )
    assert [(b.trade_id, b.side, b.volume, b.price) for b in out] == [
        (1, Side.BUY, 20, 100.0),
        (2, Side.SELL, 25, 99.9),
        (3, Side.BUY, 15, 100.1),
    ]


@pytest.mark.unit
def test_min_volume_filter_suppresses_small_merges():
    eng = BigTradeEngine()  # MinVolume=30
    out = eng.merge_stream(
        [
            _t(1000, 100.0, 10, ask=100.0),
            _t(1000, 100.0, 19, ask=100.0),  # merged 29 < 30 -> no emit
        ]
    )
    assert out == []


@pytest.mark.unit
def test_max_volume_cap_when_set():
    eng = BigTradeEngine(min_volume=1, max_volume=50)
    out = eng.merge_stream(
        [
            _t(1000, 100.0, 60, ask=100.0),  # > 50 cap -> no emit
            _t(2000, 100.0, 40, ask=100.0),  # within -> emit
        ]
    )
    assert [b.volume for b in out] == [40]


@pytest.mark.unit
def test_filter_disabled_emits_everything():
    eng = BigTradeEngine(volume_filter_enable=False)
    out = eng.merge_stream([_t(1000, 100.0, 1, ask=100.0)])
    assert [b.volume for b in out] == [1]


@pytest.mark.unit
def test_streaming_flush_emits_pending_timestamp():
    eng = BigTradeEngine()
    # First trade does not emit (timestamp still open).
    assert eng.on_trade(_t(1000, 100.0, 35, ask=100.0)) == []
    # A later timestamp flushes the prior one.
    emitted = eng.on_trade(_t(2000, 100.0, 5, ask=100.0))
    assert [b.volume for b in emitted] == [35]
    # End-of-stream flush yields nothing more (second group is below MinVolume).
    assert eng.flush() == []


@pytest.mark.unit
def test_out_of_order_trade_dropped_after_flush():
    eng = BigTradeEngine(min_volume=1)
    eng.on_trade(_t(2000, 100.0, 10, ask=100.0))
    eng.on_trade(_t(3000, 100.0, 10, ask=100.0))  # flushes ts=2000
    # ts=1000 is earlier than the now-open ts=3000 -> dropped.
    eng.on_trade(_t(1000, 100.0, 10, ask=100.0))
    out = eng.flush()
    # Only the ts=3000 group remains pending; ts=1000 was dropped.
    assert [(b.time, b.volume) for b in out] == [(3000, 10)]
