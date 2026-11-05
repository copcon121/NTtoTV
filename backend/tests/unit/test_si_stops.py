from dataclasses import replace

import pytest

from app.engines.si_stops import SiStopEngine
from app.models.canonical import NormalizedTrade, Side
from app.models.si_stops import SiStopChain
from app.rithmic.book import MboOrder

pytestmark = pytest.mark.unit


def engine(**kwargs):
    result = SiStopEngine(**kwargs)
    result.seed_orders([MboOrder("rest", "sell", 2700, 500)])
    return result


def trade(order_id="A", *, side=Side.BUY, volume=1, price=2700, time=100, sequence=None):
    return NormalizedTrade(symbol="GC", contract="GC 12-26", source="rithmic",
        time=time, price=price, volume=volume, bid=None, ask=None, best_bid=None, best_ask=None,
        sequence=time if sequence is None else sequence, side=side, aggressor_order_id=order_id,
        passive_order_id="rest", source_time_nanos=time * 1_000_000)


def mbo(d, action="change", order_id="rest", time=110, **patch):
    return d.on_mbo_update({"updates": [{"action": action, "exchangeOrderId": order_id, **patch}]}, time)


def test_seed_is_excluded_start_trade_is_included_and_completion_anchors_last_execution():
    d = engine()
    for t in [trade(volume=100), trade(volume=20, time=101), trade("B", volume=2, time=102),
              trade("B", volume=4, price=2700.1, time=103), trade("C", volume=1, price=2700.1, time=104)]:
        assert d.on_trade(t) is None
    [chain] = d.on_depth(105)
    assert chain["executedVolume"] == 7
    assert chain["executionCount"] == 3
    assert chain["aggressorCount"] == 2
    assert chain["startTime"] == 102 and chain["time"] == 104 and chain["completedTime"] == 105
    assert chain["price"] == 2700.1 and chain["firstPrice"] == 2700
    assert chain["vwap"] == pytest.approx((2700 * 2 + 2700.1 * 5) / 7)
    assert chain["throughPriceLevels"] is True
    assert SiStopChain.from_dict(chain).to_dict() == chain
    assert d.on_depth(106) == []


def test_repeating_one_id_cannot_create_a_chain_regardless_of_volume():
    d = engine()
    d.on_trade(trade(volume=1000))
    d.on_trade(trade(volume=2000, price=2700.1, time=101))
    assert d.on_depth(102) == []


def test_seed_side_does_not_gate_the_starting_trade():
    d = engine()
    d.on_trade(trade())
    d.on_trade(trade("B", side=Side.SELL, time=101))
    [chain] = d.on_depth(102)
    assert chain["side"] == "sell" and chain["executedVolume"] == 1


def test_opposite_side_cancels_and_depth_cannot_rearm_without_accepted_mbo():
    d = engine()
    d.on_trade(trade())
    d.on_trade(trade("B", volume=2, time=101))
    d.on_trade(trade("C", side=Side.SELL, time=102))
    assert d.on_depth(103) == []
    d.on_trade(trade("D", time=104))
    d.on_trade(trade("E", time=105))
    assert d.on_depth(106) == []
    assert mbo(d, time=107) == []
    d.on_trade(trade("D", time=108))
    d.on_trade(trade("E", volume=3, time=109))
    [chain] = mbo(d, action="delete", time=110)
    assert chain["executedVolume"] == 3 and chain["endReason"] == "mbo"
    assert d.metrics()["siStopsDiagnostics"]["discarded_opposite_side"] == 1


def test_depth_clears_seed_and_there_is_no_time_based_completion():
    d = engine()
    d.on_trade(trade())
    assert d.on_depth(101) == []
    d.on_trade(trade("B", time=10_000))
    assert d.metrics()["siStopsPendingVolume"] == 0
    d.on_trade(trade("C", volume=2, time=100_000))
    assert d.metrics()["siStopsPendingVolume"] == 2
    [chain] = d.on_depth(1_000_000)
    assert chain["time"] == 100_000 and chain["completedTime"] == 1_000_000


def test_returning_to_seed_id_counts_after_start_and_tbpl_uses_endpoints():
    d = engine()
    for t in [trade(), trade("B", time=101), trade("A", price=2700.2, time=102), trade("C", time=103)]:
        d.on_trade(t)
    [chain] = d.on_depth(104)
    assert chain["executedVolume"] == 3 and chain["aggressorCount"] == 3
    assert chain["throughPriceLevels"] is False


@pytest.mark.parametrize("action", ["change", "delete"])
def test_unknown_mbo_is_not_a_si_boundary(action):
    d = engine()
    d.on_trade(trade())
    d.on_trade(trade("B", time=101))
    assert mbo(d, action=action, order_id="unknown", time=102) == []
    assert d.metrics()["siStopsPendingVolume"] == 1
    assert mbo(d, action="new", size=500, side="sell", price=2700, time=103) == []
    assert d.metrics()["siStopsPendingVolume"] == 1  # Duplicate send is ignored.
    assert len(d.on_depth(104)) == 1


@pytest.mark.parametrize("patch", [{"aggressor_order_id": None}, {"aggressor_order_id": "0"}, {"side": None}])
def test_incomplete_trade_discards_provisional_chain_instead_of_faking_an_id(patch):
    d = engine()
    d.on_trade(trade())
    d.on_trade(trade("B", time=101))
    d.on_trade(replace(trade("C", time=102), **patch))
    assert d.on_depth(103) == []


@pytest.mark.parametrize("patch", [{"source": "nt"}, {"contract": "GC 10-26"}, {"symbol": "SI"}, {"otc": True}])
def test_other_sources_contracts_symbols_and_otc_do_not_contaminate_pending_chain(patch):
    d = engine()
    d.on_trade(trade())
    d.on_trade(trade("B", time=101))
    d.on_trade(replace(trade("C", side=Side.SELL, time=102), **patch))
    assert d.on_depth(103)[0]["executedVolume"] == 1


def test_duplicates_stale_events_and_resets_cannot_join_chains_across_sessions():
    d = engine()
    d.on_trade(trade())
    d.on_trade(trade("B", time=101))
    d.on_trade(trade("C", volume=99, time=101))
    assert d.on_depth(102)[0]["executedVolume"] == 1
    d.on_trade(trade(time=103))
    d.on_trade(trade("B", time=104))
    old_session = d.session_id
    d.reset()
    assert d.session_id != old_session and not d.synchronized
    assert d.on_depth(105) == []
    d.seed_orders([MboOrder("rest", "sell", 2700, 500)])
    d.on_trade(trade(time=106))
    d.on_trade(trade("B", time=107))
    assert d.on_depth(108)[0]["sessionId"] != old_session


def test_backward_trade_clock_discards_chain_and_a_stale_boundary_never_completes_it():
    d = engine()
    d.on_trade(trade())
    d.on_trade(trade("B", time=101))
    d.on_trade(trade("C", time=99, sequence=102))
    assert d.on_depth(103) == []
    mbo(d, time=104)
    d.on_trade(trade(time=105))
    d.on_trade(trade("B", time=106))
    assert d.on_depth(105) == []


def test_order_and_aggressor_bounds_discard_incomplete_chains():
    d = engine(max_orders=1, max_aggressors=1)
    d.on_trade(trade())
    d.on_trade(trade("B", time=101))
    d.on_trade(trade("C", time=102))
    assert d.on_depth(103) == []
    assert mbo(d, action="new", order_id="rest2", side="buy", price=2699, size=1, time=104) == []
    assert d.metrics()["siStopsTrackedOrders"] == 1
    assert d.metrics()["siStopsDiagnostics"]["evicted_orders"] == 1
