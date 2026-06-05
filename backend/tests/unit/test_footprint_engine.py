"""Unit tests for the Footprint_Engine (task 15.1).

Worked examples for the bid-by-ask ladder, POC, bar delta, buy%/sell%, diagonal
imbalance, stacked imbalance, and unfinished-auction flag, plus bucketization
and the out-of-order guard. (Req 14.1, 14.3, 14.4, 14.5, 14.10)
"""

from __future__ import annotations

import pytest

from app.engines.footprint_engine import FootprintEngine
from app.models.canonical import NormalizedTrade, Side
from app.models.messages import ImbalanceSide

SYMBOL = "GC"
CONTRACT = "GC 08-26"


def _t(time, price, volume, bid=None, ask=None, seq=0) -> NormalizedTrade:
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
    )


@pytest.mark.unit
def test_ladder_splits_buy_to_ask_and_sell_to_bid():
    eng = FootprintEngine()
    eng.on_trade(_t(0, 100.0, 5, bid=100.0, ask=100.2))  # <=bid -> sell -> bid
    u = eng.on_trade(_t(1, 100.2, 7, bid=100.0, ask=100.2))  # >=ask -> buy -> ask
    assert u is not None
    by_price = {r.price: r for r in u.rows}
    assert by_price[100.0].bid == 5 and by_price[100.0].ask == 0
    assert by_price[100.2].ask == 7 and by_price[100.2].bid == 0
    # Conservation.
    assert sum(r.bid + r.ask for r in u.rows) == 12


@pytest.mark.unit
def test_bidask_mode_leaves_inside_spread_trade_unallocated_like_nt():
    eng = FootprintEngine()
    u = eng.on_trade(_t(0, 100.1, 9, bid=100.0, ask=100.2))
    assert u is not None
    assert len(u.rows) == 1
    assert u.rows[0].price == 100.1
    assert u.rows[0].bid == 0
    assert u.rows[0].ask == 0
    assert u.poc == 100.1
    assert u.poc_volume == 0
    assert u.bar_delta == 0
    assert u.buy_pct == 0.0
    assert u.sell_pct == 0.0


@pytest.mark.unit
def test_poc_is_max_total_volume_level():
    eng = FootprintEngine()
    eng.on_trade(_t(0, 100.0, 3, bid=100.0, ask=100.5))
    eng.on_trade(_t(1, 100.1, 10, bid=100.0, ask=100.1))
    u = eng.on_trade(_t(2, 100.2, 4, bid=100.0, ask=100.2))
    assert u is not None
    assert u.poc == 100.1  # the 10-volume level dominates
    assert u.open == 100.0
    assert u.high == 100.2
    assert u.low == 100.0
    assert u.close == 100.2


@pytest.mark.unit
def test_value_area_expands_from_poc_like_nt_panel_mode():
    eng = FootprintEngine()
    eng.on_trade(_t(0, 100.0, 10, bid=100.0, ask=100.5))
    eng.on_trade(_t(1, 100.1, 40, bid=99.9, ask=100.1))
    eng.on_trade(_t(2, 100.2, 30, bid=99.9, ask=100.2))
    u = eng.on_trade(_t(3, 100.3, 20, bid=99.9, ask=100.3))
    assert u is not None
    assert u.poc == 100.1
    assert u.poc_volume == 40
    # 70% target is 70. POC 40 + upper 30 reaches the target before lower 10.
    assert u.vah == 100.2
    assert u.val == 100.1


@pytest.mark.unit
def test_bar_delta_and_pcts():
    eng = FootprintEngine()
    eng.on_trade(_t(0, 100.2, 8, bid=100.0, ask=100.2))  # buy ask 8
    u = eng.on_trade(_t(1, 100.0, 2, bid=100.0, ask=100.3))  # sell bid 2
    assert u is not None
    assert u.bar_delta == 8 - 2
    assert u.buy_pct == pytest.approx(8 / 10)
    assert u.sell_pct == pytest.approx(2 / 10)


@pytest.mark.unit
def test_diagonal_imbalance_ask_side():
    eng = FootprintEngine()  # ImbalancePercent=100, min=10
    # ask@100.1 = 30 vs diagonal bid@100.0 = 5 -> 30 >= 2*5 and >=10 -> ASK imbalance
    eng.on_trade(_t(0, 100.0, 5, bid=100.0, ask=100.3))   # sell bid@100.0
    u = eng.on_trade(_t(1, 100.1, 30, bid=99.9, ask=100.1))  # buy ask@100.1
    assert u is not None
    by_price = {r.price: r for r in u.rows}
    assert by_price[100.1].imbalance is ImbalanceSide.ASK


@pytest.mark.unit
def test_imbalance_requires_min_volume():
    eng = FootprintEngine()
    # ask@100.1 = 8 (< min 10) vs diagonal bid 0: not imbalanced despite ratio.
    u = eng.on_trade(_t(0, 100.1, 8, bid=99.9, ask=100.1))
    assert u is not None
    assert u.rows[0].imbalance is None


@pytest.mark.unit
def test_stacked_imbalance_two_consecutive_same_side():
    eng = FootprintEngine()
    # Two consecutive ask-imbalanced levels (100.2, 100.1) over near-zero diagonals.
    eng.on_trade(_t(0, 100.0, 1, bid=100.0, ask=100.5))   # sell bid@100.0 (diag)
    eng.on_trade(_t(1, 100.1, 30, bid=99.0, ask=100.1))   # buy ask@100.1
    eng.on_trade(_t(2, 100.2, 30, bid=99.0, ask=100.2))   # buy ask@100.2
    u = eng.on_trade(_t(3, 100.3, 1, bid=99.0, ask=100.3))  # buy ask@100.3 (vs diag bid@100.2=0)
    assert u is not None
    assert len(u.stacked_imbalance) >= 1
    stack = u.stacked_imbalance[0]
    assert stack.side is ImbalanceSide.ASK
    assert stack.from_price <= 100.1 and stack.to_price >= 100.2


@pytest.mark.unit
def test_unfinished_auction_flag():
    eng = FootprintEngine()
    # High extreme gets both bid and ask volume -> unfinished high.
    eng.on_trade(_t(0, 100.5, 4, bid=100.5, ask=100.6))   # sell bid@100.5
    eng.on_trade(_t(1, 100.5, 4, bid=100.4, ask=100.5))   # buy ask@100.5
    u = eng.on_trade(_t(2, 100.0, 3, bid=100.0, ask=100.7))  # sell bid@100.0 (low, one-sided)
    assert u is not None
    assert u.unfinished_auction.high is True
    assert u.unfinished_auction.low is False


@pytest.mark.unit
def test_bucketization_rolls_to_new_bar():
    eng = FootprintEngine()
    u0 = eng.on_trade(_t(1_000, 100.0, 5, bid=100.0, ask=100.2))
    assert u0 is not None and u0.time == 0
    u1 = eng.on_trade(_t(61_000, 100.0, 5, bid=100.0, ask=100.2))
    assert u1 is not None and u1.time == 60_000
    # New bar's ladder only carries the second trade.
    assert sum(r.bid + r.ask for r in u1.rows) == 5


@pytest.mark.unit
def test_out_of_order_trade_ignored():
    eng = FootprintEngine()
    eng.on_trade(_t(61_000, 100.0, 5, bid=100.0, ask=100.2))  # opens bucket 60000
    out = eng.on_trade(_t(1_000, 100.0, 5, bid=100.0, ask=100.2))  # bucket 0 < current
    assert out is None


@pytest.mark.unit
def test_trade_volume_filter_excludes_small_trades():
    eng = FootprintEngine(trade_volume_filter=5)
    assert eng.on_trade(_t(0, 100.0, 4, bid=100.0, ask=100.2)) is None
    u = eng.on_trade(_t(1, 100.0, 5, bid=100.0, ask=100.2))
    assert u is not None and sum(r.bid + r.ask for r in u.rows) == 5
