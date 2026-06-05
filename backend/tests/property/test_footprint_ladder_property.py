"""Property test for the Footprint ladder + metrics (task 15.2, design Property 18).

Generates arbitrary trade streams within a single M1 bar (non-decreasing
Canonical_Timestamps, as guaranteed upstream by the sequence validator) and
feeds them through the :class:`~app.engines.footprint_engine.FootprintEngine`.
For the resulting footprint bar it asserts:

* **Ladder conservation**: ``Σ(bid + ask)`` over all ladder levels equals the
  volume classified by NT BidAsk mode; inside-spread prints create rows but no
  bid/ask volume.
* **POC**: the reported POC level has the maximum total volume, with the
  documented tie-break (highest total, then highest price).
* **bar delta / buy% / sell%** match their definitions
  (``Σask − Σbid``; ``Σask/total``; ``Σbid/total``; both pct 0 when total 0).
* **imbalance**: each flagged level's dominant side exceeds the opposing
  diagonal volume by the configured percent and meets the min-volume floor.
* **stacked imbalance**: every reported run is ``>= 2`` consecutive same-side
  imbalanced levels.
* **unfinished auction**: an extreme is flagged only when both its bid and ask
  volumes are non-zero.

**Validates: Requirements 14.3, 14.4, 14.10**
"""

from __future__ import annotations

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.engines.footprint_engine import (
    DEFAULT_IMBALANCE_MIN_VOLUME,
    DEFAULT_IMBALANCE_PERCENT,
    DEFAULT_TICK_SIZE,
    FootprintEngine,
)
from app.models.canonical import NormalizedTrade, Side
from app.models.messages import ImbalanceSide

CONTRACT = "GC 08-26"
SYMBOL = "GC"

# Discrete tick grid so trades cluster onto a handful of shared price levels,
# exercising multi-level ladders, diagonals, and stacked runs.
_GRID = [round(100.0 + 0.1 * i, 1) for i in range(8)]


@st.composite
def bar_trades(draw: st.DrawFn) -> list[NormalizedTrade]:
    """Generate trades that all fall inside one 1m bucket [0, 60000)."""
    n = draw(st.integers(min_value=1, max_value=40))
    times = sorted(
        draw(st.lists(st.integers(min_value=0, max_value=59_999), min_size=n, max_size=n))
    )
    prices = draw(st.lists(st.sampled_from(_GRID), min_size=n, max_size=n))
    volumes = draw(st.lists(st.integers(min_value=1, max_value=50), min_size=n, max_size=n))
    bids = draw(
        st.lists(st.one_of(st.none(), st.sampled_from(_GRID)), min_size=n, max_size=n)
    )
    asks = draw(
        st.lists(st.one_of(st.none(), st.sampled_from(_GRID)), min_size=n, max_size=n)
    )
    trades: list[NormalizedTrade] = []
    for i in range(n):
        trades.append(
            NormalizedTrade(
                symbol=SYMBOL,
                contract=CONTRACT,
                time=times[i],
                price=prices[i],
                volume=volumes[i],
                bid=bids[i],
                ask=asks[i],
                best_bid=None,
                best_ask=None,
                sequence=i,
            )
        )
    return trades


def _nt_bidask_side(t: NormalizedTrade) -> Side | None:
    if t.ask is not None and t.price >= t.ask:
        return Side.BUY
    if t.bid is not None and t.price <= t.bid:
        return Side.SELL
    return None


# Feature: gc-chart-platform, Property 18: Footprint ladder is conserved and its metrics follow their definitions
@pytest.mark.property
@given(trades=bar_trades())
def test_property_18_footprint_ladder_and_metrics(trades: list[NormalizedTrade]):
    engine = FootprintEngine()
    update = None
    for t in trades:
        update = engine.on_trade(t)
    assert update is not None

    rows = update.rows
    # Rows are in descending price order.
    prices = [r.price for r in rows]
    assert prices == sorted(prices, reverse=True)

    total_bid = sum(r.bid for r in rows)
    total_ask = sum(r.ask for r in rows)
    total = total_bid + total_ask

    # Ladder conservation: bid+ask volume == NT BidAsk-classified volume.
    expected_allocated = sum(
        t.volume for t in trades if _nt_bidask_side(t) is not None
    )
    assert total == expected_allocated

    # bar delta / buy% / sell% definitions.
    assert update.bar_delta == total_ask - total_bid
    if total > 0:
        assert update.buy_pct == pytest.approx(total_ask / total)
        assert update.sell_pct == pytest.approx(total_bid / total)
    else:
        assert update.buy_pct == 0.0 and update.sell_pct == 0.0

    # POC: the reported level has the maximum total volume; tie-break highest
    # total then highest price.
    totals = {r.price: r.bid + r.ask for r in rows}
    max_total = max(totals.values())
    poc_candidates = [p for p, tot in totals.items() if tot == max_total]
    assert totals[update.poc] == max_total
    assert update.poc == max(poc_candidates)  # highest price among ties

    # Imbalance: each flagged level's dominant side exceeds the opposing
    # diagonal by the configured percent AND meets the min-volume floor.
    by_price = {r.price: r for r in rows}
    factor = 1.0 + DEFAULT_IMBALANCE_PERCENT / 100.0
    for i, r in enumerate(rows):
        if r.imbalance is None:
            continue
        if r.imbalance is ImbalanceSide.ASK:
            lower = by_price.get(round(r.price - DEFAULT_TICK_SIZE, 10))
            lower_bid = 0 if lower is None else lower.bid
            assert r.ask >= DEFAULT_IMBALANCE_MIN_VOLUME
            assert r.ask >= lower_bid * factor
        else:  # BID
            higher = by_price.get(round(r.price + DEFAULT_TICK_SIZE, 10))
            higher_ask = 0 if higher is None else higher.ask
            assert r.bid >= DEFAULT_IMBALANCE_MIN_VOLUME
            assert r.bid >= higher_ask * factor

    # Stacked imbalance: every run is >= 2 consecutive same-side imbalanced
    # levels, and the from/to prices bound a contiguous same-side block.
    imbalance_side_by_price = {r.price: r.imbalance for r in rows}
    for stack in update.stacked_imbalance:
        in_range = [
            p
            for p in prices
            if stack.from_price <= p <= stack.to_price
        ]
        assert len(in_range) >= 2
        for p in in_range:
            assert imbalance_side_by_price[p] == stack.side

    # Unfinished auction: extreme flagged only when both sides non-zero.
    high = by_price[prices[0]]
    low = by_price[prices[-1]]
    assert update.unfinished_auction.high == (high.bid > 0 and high.ask > 0)
    assert update.unfinished_auction.low == (low.bid > 0 and low.ask > 0)


# Feature: gc-chart-platform, Property 18: Footprint ladder is conserved and its metrics follow their definitions
@pytest.mark.property
@given(trades=bar_trades())
def test_property_18_classification_matches_nt_bidask_rules(
    trades: list[NormalizedTrade],
):
    """The side a trade is attributed to follows NT BidAsk mode, so the
    ladder's ask/bid split equals an independent replay of that rule."""
    engine = FootprintEngine()
    update = None
    for t in trades:
        update = engine.on_trade(t)
    assert update is not None

    # Independent replay of MzFootprintClone DeltaCalculationMode=0.
    exp_ask: dict[float, int] = {}
    exp_bid: dict[float, int] = {}
    for t in trades:
        side = _nt_bidask_side(t)
        key = engine.level_price(t.price)
        if side is Side.BUY:
            exp_ask[key] = exp_ask.get(key, 0) + t.volume
        elif side is Side.SELL:
            exp_bid[key] = exp_bid.get(key, 0) + t.volume

    for r in update.rows:
        assert r.ask == exp_ask.get(r.price, 0)
        assert r.bid == exp_bid.get(r.price, 0)
