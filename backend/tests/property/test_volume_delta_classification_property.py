"""Property test for VolumeDelta classification (task 14.2, design Property 16).

Generates arbitrary classification inputs ``(trade_price, bid, ask, prev_price,
last_side)`` -- including ``None`` snapshots and crossed (``bid > ask``) / locked
(``bid == ask``) books -- and asserts that
:meth:`~app.engines.volume_delta_engine.VolumeDeltaEngine.classify` follows the
ordered rule set EXACTLY:

1. ``ask`` known and ``price >= ask`` -> buy (Req 13.2);
2. otherwise ``bid`` known and ``price <= bid`` -> sell (Req 13.3);
3. otherwise tick against the prior trade: ``price > prev_price`` -> buy,
   ``price < prev_price`` -> sell (Req 13.4);
4. otherwise (no price change, or no prior trade) reuse ``last_side``,
   defaulting to buy when nothing has been classified yet (Req 13.5).

The inputs are drawn from a small discrete price grid so that equality with the
bid/ask/prev price (the rule boundaries) and crossed/locked books occur
frequently.

**Validates: Requirements 13.2, 13.3, 13.4, 13.5**
"""

from __future__ import annotations

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.engines.volume_delta_engine import VolumeDeltaEngine
from app.models.canonical import Side

# A small discrete grid (100.0 .. 101.0 step 0.1) so that price == ask,
# price == bid, price == prev_price, and crossed/locked (bid >= ask) books are
# all sampled often.
_GRID = [round(100.0 + 0.1 * i, 1) for i in range(11)]

_prices = st.sampled_from(_GRID)
_opt_prices = st.one_of(st.none(), st.sampled_from(_GRID))
_opt_side = st.one_of(st.none(), st.sampled_from([Side.BUY, Side.SELL]))


def _expected_side(
    price: float,
    bid: float | None,
    ask: float | None,
    last_side: Side | None,
    prev_price: float | None,
) -> Side:
    """Independent oracle: the ordered rule set from Req 13.2-13.5."""
    if ask is not None and price >= ask:
        return Side.BUY
    if bid is not None and price <= bid:
        return Side.SELL
    if prev_price is not None:
        if price > prev_price:
            return Side.BUY
        if price < prev_price:
            return Side.SELL
    if last_side is not None:
        return last_side
    return Side.BUY


# Feature: gc-chart-platform, Property 16: VolumeDelta classification conforms to the ordered rule set
@pytest.mark.property
@given(
    price=_prices,
    bid=_opt_prices,
    ask=_opt_prices,
    prev_price=_opt_prices,
    last_side=_opt_side,
)
def test_property_16_classification_follows_ordered_rules(
    price: float,
    bid: float | None,
    ask: float | None,
    prev_price: float | None,
    last_side: Side | None,
):
    engine = VolumeDeltaEngine()
    result = engine.classify(price, bid, ask, last_side, prev_price)

    # Result is always a valid Side: classification is total. (Req 13.2-13.5)
    assert result in (Side.BUY, Side.SELL)

    # The engine matches the ordered-rule oracle exactly.
    assert result == _expected_side(price, bid, ask, last_side, prev_price)

    # --- Targeted assertions pinning each rule and its priority ---

    # Rule 1 (Req 13.2) dominates everything else, including a crossed/locked
    # book where the trade also satisfies the sell condition (price <= bid).
    if ask is not None and price >= ask:
        assert result == Side.BUY
    # Rule 2 (Req 13.3) applies only when rule 1 did not fire.
    elif bid is not None and price <= bid:
        assert result == Side.SELL
    # Rule 3 (Req 13.4): between the bid/ask (or no snapshot) -> uptick/downtick.
    elif prev_price is not None and price > prev_price:
        assert result == Side.BUY
    elif prev_price is not None and price < prev_price:
        assert result == Side.SELL
    # Rule 4 (Req 13.5): no price change / no prior tick -> reuse last side
    # (default buy when none).
    else:
        assert result == (last_side if last_side is not None else Side.BUY)
