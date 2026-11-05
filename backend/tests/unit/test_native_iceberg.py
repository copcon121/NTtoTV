from __future__ import annotations

from dataclasses import replace

import pytest

from app.engines.native_iceberg import NativeIcebergDetector
from app.models import NormalizedTrade, Side
from app.rithmic.book import MboOrder

pytestmark = pytest.mark.unit


def trade(volume=1, *, order_id="ask-1", side=Side.BUY, price=2700.1, time=101, sequence=1):
    return NormalizedTrade(
        symbol="GC", contract="GC 12-26", time=time, price=price, volume=volume,
        bid=None, ask=None, best_bid=None, best_ask=None, sequence=sequence,
        source="rithmic", side=side, passive_order_id=order_id,
    )


def detector(*, size=10, max_orders=100_000):
    result = NativeIcebergDetector(max_orders=max_orders)
    assert result.seed_orders([MboOrder("ask-1", "sell", 2700.1, size)], 100) == []
    return result


def update(detector, action="change", *, time=102, **values):
    return detector.on_mbo_update(
        {"updates": [{"exchangeOrderId": "ask-1", "action": action, **values}]}, time
    )


def test_full_tranche_refill_confirms_and_tracks_only_observed_quantities():
    d = detector()
    assert d.on_trade(trade(6)) == []
    assert d.on_trade(trade(4, time=102, sequence=2)) == []
    [found] = update(d, size=10, time=103)
    assert found == {
        "type": "iceberg_update", "symbol": "GC", "contract": "GC",
        "source": "rithmic", "sourceContract": "GC 12-26",
        "sessionId": d.session_id, "orderId": "ask-1", "side": "sell",
        "price": 2700.1, "time": 103, "firstSeenTime": 100, "detectedTime": 103,
        "lastTradeTime": 102, "endTime": None, "executedVolume": 10,
        "displayedSize": 10, "refillCount": 1, "status": "active",
        "detectionReason": "refill", "sequence": 1, "method": "native",
    }
    [progress] = d.on_trade(trade(10, time=104, sequence=3))
    assert progress["executedVolume"] == 20
    assert progress["displayedSize"] == 0
    [refill] = update(d, size=5, time=105)
    assert refill["refillCount"] == 2
    assert refill["detectedTime"] == 103
    assert refill["executedVolume"] == 20
    [ended] = update(d, action="delete", time=106)
    assert ended["status"] == "canceled"
    assert ended["endTime"] == 106
    assert d.metrics()["icebergDetectedOrders"] == 0
    assert d.metrics()["icebergTrackedOrders"] == 0


def test_overfill_detects_without_predicting_hidden_reserve_and_finishes_executed():
    d = detector()
    [found] = d.on_trade(trade(11))
    assert found["detectionReason"] == "overfill"
    assert found["executedVolume"] == 11
    assert found["displayedSize"] == 0
    assert found["refillCount"] == 0
    [ended] = update(d, "delete")
    assert ended["status"] == "executed"
    assert d.on_trade(trade(100, sequence=2)) == []


def test_metrics_distinguish_price_through_from_exchange_delete():
    d = detector()
    d.on_trade(trade(11))
    d.on_trade(trade(price=2700.2, order_id="other", sequence=2, time=102))
    metrics = d.metrics()["icebergDiagnostics"]
    assert metrics["detected_overfill"] == 1
    assert metrics["ended_trade_through"] == 1
    assert metrics["trade_known"] == metrics["trade_unknown"] == 1
    assert "ended_executed" not in metrics


def test_timing_diagnostics_keep_nanoseconds_within_one_millisecond():
    d = detector()
    d.on_mbo_update({"sourceTimeNanos": 110_000_500, "updates": [{
        "exchangeOrderId": "ask-1", "action": "change", "size": 6,
    }]}, 110)
    older = replace(trade(4, time=110), source_time_nanos=110_000_100)
    d.on_trade(older)
    assert d.metrics()["icebergDiagnostics"]["trade_matches_prior_size_reduction"] == 1
    # Diagnostics describe evidence; they do not silently invent a feed order.
    d.on_trade(replace(trade(3, time=111, sequence=2), source_time_nanos=111_000_000))
    context = d.metrics()["icebergLastOverfill"]
    assert context["lastMboNanos"] == 110_000_500
    assert context["tradeNanos"] == 111_000_000
    assert context["lateReductionObserved"] is True


def test_partial_resize_does_not_confirm_an_iceberg():
    d = detector()
    assert d.on_trade(trade(6)) == []
    assert update(d, size=20) == []
    assert d.on_trade(trade(20, sequence=2)) == []
    assert d.metrics()["icebergDetectedOrders"] == 0
    [found] = update(d, size=1)
    assert found["executedVolume"] == 26
    assert found["refillCount"] == 1


@pytest.mark.parametrize("order_id", [None, "", "0", "unknown"])
def test_missing_or_unknown_passive_ids_cannot_confirm(order_id):
    d = detector()
    assert d.on_trade(trade(100, order_id=order_id)) == []
    assert d.metrics()["icebergDetectedOrders"] == 0


def test_unknown_replacement_cannot_seed_a_candidate():
    d = NativeIcebergDetector()
    d.seed_orders([], 100)
    assert update(d, size=10, side="sell", price=2700.1) == []
    assert d.on_trade(trade(100)) == []
    assert d.metrics()["icebergTrackedOrders"] == 0


def test_undetected_reprice_starts_fresh_accounting_and_can_observe_a_refill():
    d = detector()
    assert d.on_trade(trade(6)) == []
    assert update(d, price=2700.2, size=5, time=102) == []
    assert d.on_trade(trade(5, price=2700.2, time=103, sequence=2)) == []
    [found] = update(d, price=2700.2, size=5, time=104)
    assert found["price"] == 2700.2
    assert found["firstSeenTime"] == 102
    assert found["executedVolume"] == 5
    assert found["refillCount"] == 1
    assert found["detectionReason"] == "refill"
    assert d.metrics()["icebergDiagnostics"]["candidate_repriced"] == 1


def test_repeated_undetected_reprices_do_not_permanently_forget_the_order():
    d = detector()
    for at, price in enumerate([2700.2, 2700.3, 2700.2], start=102):
        assert update(d, price=price, size=10, time=at) == []
    assert d.metrics()["icebergTrackedOrders"] == 1
    assert d.on_trade(trade(10, price=2700.2, time=105)) == []
    [found] = update(d, price=2700.2, size=10, time=106)
    assert found["executedVolume"] == 10
    assert found["firstSeenTime"] == 104


def test_exhausted_reprice_diagnostic_preserves_discarded_accounting_without_detecting():
    d = detector()
    assert d.on_trade(trade(10)) == []
    assert d.on_mbo_update({"sourceTimeNanos": 102_000_900, "updates": [{
        "exchangeOrderId": "ask-1", "action": "change", "side": "sell",
        "price": 2700.2, "size": 5,
    }]}, 102) == []
    metrics = d.metrics()
    assert metrics["icebergDiagnostics"]["exhausted_candidate_reprice"] == 1
    [context] = metrics["icebergIdentityContexts"]
    assert context == {
        "kind": "candidate_reprice", "sessionId": d.session_id, "orderId": "ask-1",
        "time": 102, "sourceTimeNanos": 102_000_900,
        "oldSide": "sell", "oldPrice": 2700.1, "newSide": "sell", "newPrice": 2700.2,
        "remainderBefore": 0, "executedVolume": 10, "refillCount": 0,
        "detected": False, "detectedTime": None, "firstSeenTime": 100,
        "lastTradeTime": 101, "lastMboTime": None, "lastMboNanos": None,
    }
    assert metrics["icebergDetectedOrders"] == 0
    assert d.on_trade(trade(5, price=2700.2, time=103, sequence=2)) == []
    [found] = update(d, price=2700.2, size=5, time=104)
    assert found["executedVolume"] == 5 and found["refillCount"] == 1
    assert found["firstSeenTime"] == 102


def test_identity_contexts_are_bounded_copied_and_cleared_with_a_new_session():
    d = detector()
    for index in range(12):
        assert update(d, price=2700.2 + index, size=5, time=102 + index) == []
    contexts = d.metrics()["icebergIdentityContexts"]
    assert len(contexts) == 10
    assert [context["time"] for context in contexts] == list(range(104, 114))
    assert {context["kind"] for context in contexts} == {"candidate_reprice"}
    assert d.metrics()["icebergDiagnostics"].get("exhausted_candidate_reprice", 0) == 0
    contexts[0]["executedVolume"] = 1000
    assert d.metrics()["icebergIdentityContexts"][0]["executedVolume"] == 0
    assert d.invalidate(200) == []
    assert d.metrics()["icebergIdentityContexts"] == []


def test_trade_mismatch_diagnostic_does_not_add_rejected_execution_to_detected_ice():
    d = detector()
    assert d.on_trade(trade(10)) == []
    [found] = update(d, size=10)
    bad = replace(trade(99, side=Side.SELL, time=103, sequence=2),
                  source_time_nanos=103_000_800)
    [ended] = d.on_trade(bad)
    assert ended["status"] == "invalidated"
    assert ended["executedVolume"] == found["executedVolume"] == 10
    assert ended["refillCount"] == 1
    [context] = d.metrics()["icebergIdentityContexts"]
    assert context["kind"] == "trade_mismatch"
    assert context["oldSide"] == "sell" and context["newSide"] == "buy"
    assert context["oldPrice"] == context["newPrice"] == 2700.1
    assert context["remainderBefore"] == context["executedVolume"] == 10
    assert context["refillCount"] == 1 and context["detected"] is True
    assert context["sourceTimeNanos"] == 103_000_800
    assert context["lastMboTime"] == 102 and context["lastMboNanos"] == 102_000_000


def test_detected_reprice_remains_historical_and_cannot_reanimate_on_change():
    d = detector()
    d.on_trade(trade(11))
    [ended] = update(d, price=2700.2, size=10, time=102)
    assert ended["status"] == "invalidated"
    assert ended["price"] == 2700.1
    assert ended["executedVolume"] == 11
    assert update(d, price=2700.2, size=10, time=103) == []
    assert d.on_trade(trade(11, price=2700.2, time=104, sequence=2)) == []


@pytest.mark.parametrize("values", [
    {"side": "buy", "price": 2700.2, "size": 10},
    {"price": 2700.2}, {"price": 2700.2, "size": 0},
    {"price": float("nan"), "size": 10},
])
def test_inconsistent_or_incomplete_reprice_cannot_seed_a_new_baseline(values):
    d = detector()
    assert update(d, **values) == []
    assert d.metrics()["icebergTrackedOrders"] == 0


@pytest.mark.parametrize("bad_trade", [
    {"side": Side.SELL}, {"side": None}, {"price": 2700.2}, {"price": float("nan")},
])
def test_inconsistent_trade_invalidates_instead_of_confirming(bad_trade):
    d = detector()
    assert d.on_trade(trade(10)) == []
    assert d.on_trade(trade(10, sequence=2, **bad_trade)) == []
    assert update(d, size=10) == []
    assert d.metrics()["icebergTrackedOrders"] == 0


@pytest.mark.parametrize("bad_update", [{"side": "buy"}, {"price": 2700.2}])
def test_inconsistent_replacement_invalidates_an_existing_detection(bad_update):
    d = detector()
    d.on_trade(trade(11))
    [event] = update(d, size=10, **bad_update)
    assert event["status"] == "invalidated"
    assert event["executedVolume"] == 11
    assert d.metrics()["icebergTrackedOrders"] == 0


def test_zero_size_after_partial_fill_cannot_be_reinterpreted_as_refill():
    d = detector()
    assert d.on_trade(trade(6)) == []
    assert update(d, size=0) == []
    assert update(d, size=10) == []
    assert d.on_trade(trade(11, sequence=2)) == []


def test_zero_visible_update_retains_a_trade_exhausted_order_for_later_refill():
    d = detector()
    assert d.on_trade(trade(10)) == []
    assert update(d, size=0) == []
    [found] = update(d, size=10, time=103)
    assert found["detectionReason"] == "refill"
    assert found["executedVolume"] == 10
    assert found["refillCount"] == 1


def test_explicit_delete_forgets_exhausted_identity_and_cannot_rejoin_it():
    d = detector()
    assert d.on_trade(trade(10)) == []
    assert update(d, "delete") == []
    assert update(d, size=10) == []
    assert d.on_trade(trade(11, sequence=2)) == []


def test_snapshot_and_resynchronization_never_fabricate_fills():
    d = detector()
    d.on_trade(trade(11))
    old_session = d.session_id
    [invalidated] = d.invalidate(200)
    assert invalidated["sessionId"] == old_session
    assert invalidated["status"] == "invalidated"
    assert d.session_id != old_session
    assert d.on_trade(trade(100, time=201, sequence=2)) == []
    assert d.seed_orders([MboOrder("ask-1", "sell", 2700.1, 10)], 202) == []
    assert d.on_trade(trade(10, time=203, sequence=3)) == []
    [new] = update(d, size=10, time=204)
    assert new["sessionId"] == d.session_id
    assert new["executedVolume"] == 10
    assert new["sequence"] == 1


def test_candidates_are_bounded_and_detected_eviction_ends_the_order():
    d = detector(max_orders=1)
    d.on_trade(trade(11))
    [ended] = d.on_mbo_update({"updates": [{
        "action": "new", "exchangeOrderId": "bid-2", "side": "buy",
        "price": 2700, "size": 3,
    }]}, 102)
    assert ended["status"] == "invalidated"
    assert d.metrics()["icebergTrackedOrders"] == 1
    assert d.metrics()["icebergDetectedOrders"] == 0
    assert d.metrics()["icebergDroppedOrders"] == 1


def test_reused_order_id_begins_a_fresh_candidate():
    d = detector()
    d.on_trade(trade(11))
    [ended] = update(d, "new", side="sell", price=2700.1, size=20)
    assert ended["status"] == "invalidated"
    assert d.on_trade(trade(11, sequence=2)) == []


def test_duplicate_trade_sequence_does_not_create_overfill():
    d = detector()
    assert d.on_trade(trade(10)) == []
    assert d.on_trade(trade(10)) == []
    assert d.metrics()["icebergDetectedOrders"] == 0


@pytest.mark.parametrize("side", ["buy", "sell"])
@pytest.mark.parametrize("refill", [False, True])
def test_trade_through_ends_iceberg_without_fabricating_an_execution(side, refill):
    d = NativeIcebergDetector()
    d.seed_orders([MboOrder("ice", side, 2700.1, 10)], 100)
    aggressor = Side.SELL if side == "buy" else Side.BUY
    initial_volume = 10 if refill else 11
    events = d.on_trade(trade(initial_volume, order_id="ice", side=aggressor))
    if refill:
        assert events == []
        [found] = d.on_mbo_update({"updates": [{
            "exchangeOrderId": "ice", "action": "change", "size": 10,
        }]}, 102)
    else:
        [found] = events
    price = 2700.0 if side == "buy" else 2700.2
    [ended] = d.on_trade(trade(100, order_id="another-order", side=aggressor,
                               price=price, time=103, sequence=2))
    assert ended["orderId"] == "ice"
    assert ended["status"] == "invalidated"
    assert ended["endTime"] == ended["time"] == 103
    assert ended["detectedTime"] == found["detectedTime"]
    assert ended["executedVolume"] == initial_volume
    assert ended["lastTradeTime"] == 101
    assert ended["refillCount"] == int(refill)
    assert d.metrics()["icebergDetectedOrders"] == d.metrics()["icebergTrackedOrders"] == 0
    assert d.on_trade(trade(price=price, time=104, sequence=3)) == []
    # A later replacement cannot reanimate an identity already traded through.
    assert d.on_mbo_update({"updates": [{
        "exchangeOrderId": "ice", "action": "change", "size": 10,
    }]}, 105) == []


@pytest.mark.parametrize("price", [2700.0, 2700.1, 2700.1 + 1e-10])
def test_same_price_or_favorable_trade_does_not_end_an_ask_iceberg(price):
    d = detector()
    d.on_trade(trade(11))
    assert d.on_trade(trade(order_id="other", price=price, time=102, sequence=2)) == []
    assert d.metrics()["icebergDetectedOrders"] == 1


@pytest.mark.parametrize("overrides", [
    {"otc": True}, {"contract": "GC 10-26"}, {"symbol": "ES"},
    {"volume": 0}, {"side": None}, {"price": float("nan")},
])
def test_unusable_or_other_market_trades_do_not_end_an_iceberg(overrides):
    d = detector()
    d.on_trade(trade(11))
    crossing = trade(order_id="other", price=2700.2, time=102, sequence=2)
    assert d.on_trade(replace(crossing, **overrides)) == []
    assert d.metrics()["icebergDetectedOrders"] == 1


def test_late_trade_and_trade_before_latest_refill_cannot_end_current_state():
    d = detector()
    d.on_trade(trade(11))
    update(d, size=10, time=110)
    # Newer sequence alone cannot make an older execution cross a fresh refill.
    assert d.on_trade(trade(order_id="other", price=2700.2, time=105, sequence=2)) == []
    assert d.on_trade(trade(order_id="other", price=2700.0, time=120, sequence=3)) == []
    assert d.on_trade(trade(order_id="other", price=2700.2, time=115, sequence=4)) == []
    [ended] = d.on_trade(trade(order_id="other", price=2700.2, time=121, sequence=5))
    assert ended["status"] == "invalidated" and ended["endTime"] == 121


def test_trade_through_only_ends_reached_levels_and_can_detect_another_order():
    d = NativeIcebergDetector()
    d.seed_orders([MboOrder("high", "sell", 2701.0, 10),
                   MboOrder("low", "sell", 2700.0, 10),
                   MboOrder("next", "sell", 2700.5, 10)], 100)
    d.on_trade(trade(11, order_id="high", price=2701.0))
    d.on_trade(trade(11, order_id="low", price=2700.0, time=102, sequence=2))
    ended, found = d.on_trade(trade(11, order_id="next", price=2700.5, time=103, sequence=3))
    assert ended["orderId"] == "low" and ended["status"] == "invalidated"
    assert found["orderId"] == "next" and found["status"] == "active"
    assert ended["sequence"] < found["sequence"]
    assert d.metrics()["icebergDetectedOrders"] == d.metrics()["icebergTrackedOrders"] == 2
