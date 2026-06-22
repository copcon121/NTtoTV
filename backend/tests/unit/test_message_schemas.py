"""Unit tests for WebSocket event-type schema serialization (task 2.4).

Round-trips every ``/ws/chart`` event type and the ``/ws/nt`` data/control/
status message types against the documented JSON shapes from the design's
"WebSocket Message Schemas" section. For every message type we assert:

* ``from_dict(to_dict(x)) == x`` (lossless round-trip), and the reverse
  ``to_dict(from_dict(d)) == d`` against the documented wire shape;
* the exact camelCase wire field names match the design (``bestBid``,
  ``bidSize``, ``deltaHigh``, ``openDelta``, ``cumulativeDelta``, ``barDelta``,
  ``buyPct``, ``sellPct``, ``stackedImbalance``, ``unfinishedAuction``,
  ``alertId``, ...);
* the ``type`` discriminator is present and correct;
* the decode dispatchers (``decode_nt_data_message`` /
  ``decode_chart_client_message``) route by ``type``.

Covers Requirement 5.2 (event-type schema serialization for all `/ws/chart`
event types) plus the `/ws/nt` data (1.1, 1.2), control, and status shapes.
"""

from __future__ import annotations

import pytest

from app.models.canonical import NormalizedQuote, NormalizedTrade, Side
from app.models.messages import (
    AlertEvent,
    BarUpdate,
    BigTrade,
    ChartStatusEvent,
    ControlAction,
    ControlCommand,
    EventType,
    FootprintRow,
    FootprintUpdate,
    FvgSignalUpdate,
    ImbalanceSide,
    NTStatusEvent,
    OHLCVBar,
    Ping,
    Pong,
    QuoteUpdate,
    StackedImbalance,
    StatusState,
    Subscribe,
    UnfinishedAuction,
    Unsubscribe,
    VolumeDeltaUpdate,
    decode_chart_client_message,
    decode_nt_data_message,
    quote_from_dict,
    quote_to_dict,
    trade_from_dict,
    trade_to_dict,
)

# ---------------------------------------------------------------------------
# Fixtures: one canonical instance + its documented wire shape per message type
# ---------------------------------------------------------------------------


def _trade() -> NormalizedTrade:
    return NormalizedTrade(
        symbol="GC",
        contract="GC 08-26",
        time=1730313600123,
        price=2345.6,
        volume=3,
        bid=2345.5,
        ask=2345.7,
        best_bid=2345.5,
        best_ask=2345.7,
        sequence=105432,
    )


def _trade_wire() -> dict:
    return {
        "type": "trade",
        "symbol": "GC",
        "contract": "GC 08-26",
        "time": 1730313600123,
        "price": 2345.6,
        "volume": 3,
        "bid": 2345.5,
        "ask": 2345.7,
        "bestBid": 2345.5,
        "bestAsk": 2345.7,
        "sequence": 105432,
    }


def _quote() -> NormalizedQuote:
    return NormalizedQuote(
        symbol="GC",
        contract="GC 08-26",
        time=1730313600125,
        bid=2345.5,
        ask=2345.7,
        bid_size=12,
        ask_size=9,
        sequence=105433,
    )


def _quote_wire() -> dict:
    return {
        "type": "quote",
        "symbol": "GC",
        "contract": "GC 08-26",
        "time": 1730313600125,
        "bid": 2345.5,
        "ask": 2345.7,
        "bidSize": 12,
        "askSize": 9,
        "sequence": 105433,
    }


# ===========================================================================
# /ws/nt data plane: trade / quote (Req 1.1, 1.2)
# ===========================================================================


@pytest.mark.unit
def test_trade_round_trips_through_canonical_model():
    trade = _trade()
    assert trade_from_dict(trade_to_dict(trade)) == trade


@pytest.mark.unit
def test_trade_wire_shape_matches_design_exactly():
    assert trade_to_dict(_trade()) == _trade_wire()
    # camelCase best-bid/ask field names are present (not snake_case).
    wire = trade_to_dict(_trade())
    assert "bestBid" in wire and "bestAsk" in wire
    assert "best_bid" not in wire and "best_ask" not in wire
    assert wire["type"] == "trade"


@pytest.mark.unit
def test_trade_wire_round_trips_from_documented_shape():
    assert trade_to_dict(trade_from_dict(_trade_wire())) == _trade_wire()


@pytest.mark.unit
def test_trade_preserves_missing_quote_snapshot():
    trade = NormalizedTrade(
        symbol="GC",
        contract="GC 08-26",
        time=1730313600123,
        price=2345.6,
        volume=3,
        bid=None,
        ask=None,
        best_bid=None,
        best_ask=None,
        sequence=1,
    )
    assert trade_from_dict(trade_to_dict(trade)) == trade


@pytest.mark.unit
def test_trade_preserves_optional_nt_time_ticks():
    wire = {
        **_trade_wire(),
        "timeTicks": 638858610886080001,
    }
    trade = trade_from_dict(wire)
    assert trade.time_ticks == 638858610886080001
    assert trade_to_dict(trade) == wire


@pytest.mark.unit
def test_quote_round_trips_through_canonical_model():
    quote = _quote()
    assert quote_from_dict(quote_to_dict(quote)) == quote


@pytest.mark.unit
def test_quote_wire_shape_matches_design_exactly():
    assert quote_to_dict(_quote()) == _quote_wire()
    wire = quote_to_dict(_quote())
    assert "bidSize" in wire and "askSize" in wire
    assert "bid_size" not in wire and "ask_size" not in wire
    assert wire["type"] == "quote"


@pytest.mark.unit
def test_quote_wire_round_trips_from_documented_shape():
    assert quote_to_dict(quote_from_dict(_quote_wire())) == _quote_wire()


# ===========================================================================
# /ws/nt status (NT_AddOn -> Backend) (Req 3.4, 20.1)
# ===========================================================================


@pytest.mark.unit
def test_nt_status_event_round_trips():
    status = NTStatusEvent(
        source="nt_addon", state=StatusState.CONNECTED, time=1730313600200
    )
    assert NTStatusEvent.from_dict(status.to_dict()) == status


@pytest.mark.unit
def test_nt_status_event_wire_shape_matches_design():
    status = NTStatusEvent(
        source="nt_addon", state=StatusState.CONNECTED, time=1730313600200
    )
    assert status.to_dict() == {
        "type": "status",
        "source": "nt_addon",
        "state": "connected",
        "time": 1730313600200,
    }


@pytest.mark.unit
def test_nt_status_event_includes_optional_contract_when_set():
    status = NTStatusEvent(
        source="nt_addon",
        state=StatusState.DEGRADED,
        time=1730313600200,
        contract="GC 08-26",
    )
    wire = status.to_dict()
    assert wire["contract"] == "GC 08-26"
    assert NTStatusEvent.from_dict(wire) == status


# ===========================================================================
# /ws/nt control plane: control command (Req 1.7, 1.8, 4.6)
# ===========================================================================


@pytest.mark.unit
@pytest.mark.parametrize(
    "action", [ControlAction.SUBSCRIBE, ControlAction.UNSUBSCRIBE]
)
def test_control_command_round_trips(action):
    cmd = ControlCommand(action=action, contract="GC 10-26", time=1730313600300)
    assert ControlCommand.from_dict(cmd.to_dict()) == cmd


@pytest.mark.unit
def test_control_command_wire_shape_matches_design():
    cmd = ControlCommand(
        action=ControlAction.SUBSCRIBE, contract="GC 10-26", time=1730313600300
    )
    assert cmd.to_dict() == {
        "type": "control",
        "action": "subscribe",
        "contract": "GC 10-26",
        "time": 1730313600300,
    }


# ===========================================================================
# /ws/chart client -> backend: subscribe / unsubscribe / pong (Req 5.4, 5.5, 6.2)
# ===========================================================================


@pytest.mark.unit
def test_subscribe_round_trips_with_all_event_types():
    sub = Subscribe(
        symbol="GC",
        events=[
            EventType.BAR_UPDATE,
            EventType.QUOTE_UPDATE,
            EventType.VOLUME_DELTA_UPDATE,
            EventType.FOOTPRINT_UPDATE,
            EventType.BIG_TRADE,
            EventType.ALERT_EVENT,
            EventType.STATUS,
        ],
        tf="1m",
    )
    assert Subscribe.from_dict(sub.to_dict()) == sub


@pytest.mark.unit
def test_subscribe_wire_shape_matches_design():
    sub = Subscribe(
        symbol="GC",
        events=[
            EventType.BAR_UPDATE,
            EventType.QUOTE_UPDATE,
            EventType.VOLUME_DELTA_UPDATE,
            EventType.FOOTPRINT_UPDATE,
            EventType.BIG_TRADE,
            EventType.ALERT_EVENT,
            EventType.STATUS,
        ],
        tf="1m",
    )
    assert sub.to_dict() == {
        "type": "subscribe",
        "symbol": "GC",
        "events": [
            "bar_update",
            "quote_update",
            "volume_delta_update",
            "footprint_update",
            "big_trade",
            "alert_event",
            "status",
        ],
        "tf": "1m",
    }


@pytest.mark.unit
def test_subscribe_omits_tf_when_absent():
    sub = Subscribe(symbol="GC", events=[EventType.STATUS])
    wire = sub.to_dict()
    assert "tf" not in wire
    assert Subscribe.from_dict(wire) == sub


@pytest.mark.unit
def test_unsubscribe_round_trips():
    unsub = Unsubscribe(symbol="GC", events=[EventType.FOOTPRINT_UPDATE])
    assert Unsubscribe.from_dict(unsub.to_dict()) == unsub


@pytest.mark.unit
def test_unsubscribe_wire_shape_matches_design():
    unsub = Unsubscribe(symbol="GC", events=[EventType.FOOTPRINT_UPDATE])
    assert unsub.to_dict() == {
        "type": "unsubscribe",
        "symbol": "GC",
        "events": ["footprint_update"],
    }


@pytest.mark.unit
def test_pong_round_trips_and_wire_shape():
    pong = Pong(time=1730313600999)
    assert Pong.from_dict(pong.to_dict()) == pong
    assert pong.to_dict() == {"type": "pong", "time": 1730313600999}


# ===========================================================================
# /ws/chart backend -> client: bar_update (Req 5.2, 9.3)
# ===========================================================================


@pytest.mark.unit
def test_bar_update_round_trips():
    bar_update = BarUpdate(
        symbol="GC",
        contract="GC 08-26",
        tf="1m",
        bar=OHLCVBar(
            time=1730313600000,
            open=2345.1,
            high=2346.0,
            low=2344.8,
            close=2345.7,
            volume=142,
        ),
        closed=False,
    )
    assert BarUpdate.from_dict(bar_update.to_dict()) == bar_update


@pytest.mark.unit
def test_bar_update_wire_shape_matches_design():
    bar_update = BarUpdate(
        symbol="GC",
        contract="GC 08-26",
        tf="1m",
        bar=OHLCVBar(
            time=1730313600000,
            open=2345.1,
            high=2346.0,
            low=2344.8,
            close=2345.7,
            volume=142,
        ),
        closed=False,
    )
    assert bar_update.to_dict() == {
        "type": "bar_update",
        "symbol": "GC",
        "contract": "GC 08-26",
        "tf": "1m",
        "bar": {
            "time": 1730313600000,
            "open": 2345.1,
            "high": 2346.0,
            "low": 2344.8,
            "close": 2345.7,
            "volume": 142,
        },
        "closed": False,
    }


@pytest.mark.unit
def test_bar_update_closed_flag_round_trips_true():
    bar_update = BarUpdate(
        symbol="GC",
        contract="GC 08-26",
        tf="5m",
        bar=OHLCVBar(time=1730313600000, open=1, high=2, low=0.5, close=1.5, volume=10),
        closed=True,
    )
    decoded = BarUpdate.from_dict(bar_update.to_dict())
    assert decoded.closed is True
    assert decoded == bar_update


# ===========================================================================
# /ws/chart backend -> client: quote_update (Req 5.2)
# ===========================================================================


@pytest.mark.unit
def test_quote_update_round_trips_and_wire_shape():
    quote_update = QuoteUpdate(
        symbol="GC",
        contract="GC 08-26",
        time=1730313600125,
        bid=2345.5,
        ask=2345.7,
        bid_size=12,
        ask_size=9,
    )
    assert QuoteUpdate.from_dict(quote_update.to_dict()) == quote_update
    assert quote_update.to_dict() == {
        "type": "quote_update",
        "symbol": "GC",
        "contract": "GC 08-26",
        "time": 1730313600125,
        "bid": 2345.5,
        "ask": 2345.7,
        "bidSize": 12,
        "askSize": 9,
    }


# ===========================================================================
# /ws/chart backend -> client: volume_delta_update (Req 5.2, 13.1, 13.7)
# ===========================================================================


@pytest.mark.unit
def test_volume_delta_update_round_trips_without_cumulative():
    vd = VolumeDeltaUpdate(
        symbol="GC",
        contract="GC 08-26",
        tf="1m",
        time=1730313600000,
        volume=142,
        buy_volume=80,
        sell_volume=62,
        delta=18,
        delta_high=25,
        delta_low=-7,
        open_delta=0,
        close_delta=18,
    )
    assert VolumeDeltaUpdate.from_dict(vd.to_dict()) == vd
    wire = vd.to_dict()
    # cumulativeDelta omitted when not in CumulativeDelta mode (Req 13.7).
    assert "cumulativeDelta" not in wire


@pytest.mark.unit
def test_volume_delta_update_wire_shape_matches_design_with_cumulative():
    vd = VolumeDeltaUpdate(
        symbol="GC",
        contract="GC 08-26",
        tf="1m",
        time=1730313600000,
        volume=142,
        buy_volume=80,
        sell_volume=62,
        delta=18,
        delta_high=25,
        delta_low=-7,
        open_delta=0,
        close_delta=18,
        cumulative_delta=1234,
    )
    assert vd.to_dict() == {
        "type": "volume_delta_update",
        "symbol": "GC",
        "contract": "GC 08-26",
        "tf": "1m",
        "time": 1730313600000,
        "volume": 142,
        "buyVolume": 80,
        "sellVolume": 62,
        "delta": 18,
        "deltaHigh": 25,
        "deltaLow": -7,
        "openDelta": 0,
        "closeDelta": 18,
        "cumulativeDelta": 1234,
    }
    assert VolumeDeltaUpdate.from_dict(vd.to_dict()) == vd


# ===========================================================================
# /ws/chart backend -> client: footprint_update (Req 5.2, 14)
# ===========================================================================


def _footprint() -> FootprintUpdate:
    return FootprintUpdate(
        symbol="GC",
        contract="GC 08-26",
        tf="1m",
        time=1730313600000,
        rows=[
            FootprintRow(price=2345.7, bid=5, ask=30, imbalance=ImbalanceSide.ASK),
            FootprintRow(price=2345.6, bid=22, ask=18, imbalance=None),
            FootprintRow(price=2345.5, bid=28, ask=3, imbalance=ImbalanceSide.BID),
        ],
        open=2345.5,
        high=2345.7,
        low=2345.5,
        close=2345.6,
        poc=2345.6,
        poc_volume=40,
        vah=2345.7,
        val=2345.6,
        bar_delta=18,
        buy_pct=56.3,
        sell_pct=43.7,
        stacked_imbalance=[
            StackedImbalance(side=ImbalanceSide.BID, from_price=2345.3, to_price=2345.5)
        ],
        unfinished_auction=UnfinishedAuction(high=False, low=True),
    )


@pytest.mark.unit
def test_footprint_update_round_trips():
    fp = _footprint()
    assert FootprintUpdate.from_dict(fp.to_dict()) == fp


@pytest.mark.unit
def test_footprint_update_wire_shape_matches_design():
    assert _footprint().to_dict() == {
        "type": "footprint_update",
        "symbol": "GC",
        "contract": "GC 08-26",
        "tf": "1m",
        "time": 1730313600000,
        "rows": [
            {"price": 2345.7, "bid": 5, "ask": 30, "imbalance": "ask"},
            {"price": 2345.6, "bid": 22, "ask": 18, "imbalance": None},
            {"price": 2345.5, "bid": 28, "ask": 3, "imbalance": "bid"},
        ],
        "open": 2345.5,
        "high": 2345.7,
        "low": 2345.5,
        "close": 2345.6,
        "poc": 2345.6,
        "pocVolume": 40,
        "vah": 2345.7,
        "val": 2345.6,
        "barDelta": 18,
        "buyPct": 56.3,
        "sellPct": 43.7,
        "stackedImbalance": [{"side": "bid", "from": 2345.3, "to": 2345.5}],
        "unfinishedAuction": {"high": False, "low": True},
    }


@pytest.mark.unit
def test_footprint_row_imbalance_field_round_trips_each_side():
    for side in (ImbalanceSide.BID, ImbalanceSide.ASK, None):
        row = FootprintRow(price=10.0, bid=1, ask=2, imbalance=side)
        assert FootprintRow.from_dict(row.to_dict()) == row


# ===========================================================================
# /ws/chart backend -> client: fvg_signal_update
# ===========================================================================


@pytest.mark.unit
def test_fvg_signal_update_round_trips():
    update = FvgSignalUpdate(
        symbol="GC",
        contract="GC",
        tf="1m",
        time=1730313600000,
        direction=1,
        level=5,
        pulse=5,
        top=2346.0,
        bottom=2345.5,
        breakout_ratio=1.75,
        phase="confirmed",
    )
    assert FvgSignalUpdate.from_dict(update.to_dict()) == update


@pytest.mark.unit
def test_fvg_signal_update_wire_shape_matches_design():
    update = FvgSignalUpdate(
        symbol="GC",
        contract="GC",
        tf="1m",
        time=1730313600000,
        direction=-1,
        level=3,
        pulse=-3,
        top=2345.5,
        bottom=2345.0,
        breakout_ratio=1.65,
        phase="preview",
    )
    assert update.to_dict() == {
        "type": "fvg_signal_update",
        "symbol": "GC",
        "contract": "GC",
        "tf": "1m",
        "time": 1730313600000,
        "direction": -1,
        "level": 3,
        "pulse": -3,
        "top": 2345.5,
        "bottom": 2345.0,
        "breakoutRatio": 1.65,
        "phase": "preview",
    }
    assert EventType.FVG_SIGNAL_UPDATE.value == "fvg_signal_update"


# ===========================================================================
# /ws/chart backend -> client: big_trade (Req 5.2, 15.4, 15.5)
# ===========================================================================


@pytest.mark.unit
@pytest.mark.parametrize("side", [Side.BUY, Side.SELL])
def test_big_trade_round_trips(side):
    bt = BigTrade(
        symbol="GC",
        contract="GC 08-26",
        trade_id=7,
        time=1730313600123,
        price=2345.6,
        volume=65,
        side=side,
    )
    assert BigTrade.from_dict(bt.to_dict()) == bt


@pytest.mark.unit
def test_big_trade_wire_shape_matches_design():
    bt = BigTrade(
        symbol="GC",
        contract="GC 08-26",
        trade_id=7,
        time=1730313600123,
        price=2345.6,
        volume=65,
        side=Side.BUY,
    )
    assert bt.to_dict() == {
        "type": "big_trade",
        "symbol": "GC",
        "contract": "GC 08-26",
        "tradeId": 7,
        "time": 1730313600123,
        "price": 2345.6,
        "volume": 65,
        "side": "buy",
    }


# ===========================================================================
# /ws/chart backend -> client: alert_event (Req 5.2, 17.2)
# ===========================================================================


@pytest.mark.unit
def test_alert_event_round_trips_with_level():
    ae = AlertEvent(
        alert_id="a_2f1c",
        alert_type="price_crosses_level",
        symbol="GC",
        contract="GC 08-26",
        time=1730313600500,
        price=2346.0,
        message="GC crossed 2346.0",
        level=2346.0,
    )
    assert AlertEvent.from_dict(ae.to_dict()) == ae


@pytest.mark.unit
def test_alert_event_wire_shape_matches_design():
    ae = AlertEvent(
        alert_id="a_2f1c",
        alert_type="price_crosses_level",
        symbol="GC",
        contract="GC 08-26",
        time=1730313600500,
        price=2346.0,
        message="GC crossed 2346.0",
        level=2346.0,
    )
    wire = ae.to_dict()
    assert wire == {
        "type": "alert_event",
        "alertId": "a_2f1c",
        "alertType": "price_crosses_level",
        "symbol": "GC",
        "contract": "GC 08-26",
        "time": 1730313600500,
        "price": 2346.0,
        "message": "GC crossed 2346.0",
        "level": 2346.0,
    }
    # camelCase identifiers present, snake_case absent.
    assert "alertId" in wire and "alertType" in wire
    assert "alert_id" not in wire and "alert_type" not in wire


@pytest.mark.unit
def test_alert_event_omits_level_when_absent():
    ae = AlertEvent(
        alert_id="a_9",
        alert_type="big_trade_threshold",
        symbol="GC",
        contract="GC 08-26",
        time=1730313600500,
        price=2346.0,
        message="big trade",
    )
    wire = ae.to_dict()
    assert "level" not in wire
    assert AlertEvent.from_dict(wire) == ae


# ===========================================================================
# /ws/chart backend -> client: status (Req 5.2, 20)
# ===========================================================================


@pytest.mark.unit
def test_chart_status_event_round_trips_with_reason_and_contract():
    status = ChartStatusEvent(
        state=StatusState.DEGRADED,
        time=1730313600600,
        reason="stream_gap",
        contract="GC 08-26",
    )
    assert ChartStatusEvent.from_dict(status.to_dict()) == status


@pytest.mark.unit
def test_chart_status_event_wire_shape_matches_design():
    status = ChartStatusEvent(
        state=StatusState.DEGRADED,
        time=1730313600600,
        reason="stream_gap",
        contract="GC 08-26",
    )
    assert status.to_dict() == {
        "type": "status",
        "state": "degraded",
        "time": 1730313600600,
        "reason": "stream_gap",
        "contract": "GC 08-26",
    }


@pytest.mark.unit
def test_chart_status_event_omits_optional_fields_when_absent():
    status = ChartStatusEvent(state=StatusState.CONNECTED, time=1730313600600)
    wire = status.to_dict()
    assert "reason" not in wire and "contract" not in wire
    assert ChartStatusEvent.from_dict(wire) == status


# ===========================================================================
# /ws/chart backend -> client: ping (Req 5.2, 6.1)
# ===========================================================================


@pytest.mark.unit
def test_ping_round_trips_and_wire_shape():
    ping = Ping(time=1730313600000)
    assert Ping.from_dict(ping.to_dict()) == ping
    assert ping.to_dict() == {"type": "ping", "time": 1730313600000}


# ===========================================================================
# Decode dispatchers route by `type`
# ===========================================================================


@pytest.mark.unit
def test_decode_nt_data_message_routes_trade():
    decoded = decode_nt_data_message(_trade_wire())
    assert isinstance(decoded, NormalizedTrade)
    assert decoded == _trade()


@pytest.mark.unit
def test_decode_nt_data_message_routes_quote():
    decoded = decode_nt_data_message(_quote_wire())
    assert isinstance(decoded, NormalizedQuote)
    assert decoded == _quote()


@pytest.mark.unit
def test_decode_nt_data_message_routes_status():
    wire = {
        "type": "status",
        "source": "nt_addon",
        "state": "connected",
        "time": 1730313600200,
    }
    decoded = decode_nt_data_message(wire)
    assert isinstance(decoded, NTStatusEvent)
    assert decoded.state is StatusState.CONNECTED


@pytest.mark.unit
def test_decode_nt_data_message_rejects_unknown_type():
    with pytest.raises(ValueError):
        decode_nt_data_message({"type": "bar_update"})


@pytest.mark.unit
def test_decode_chart_client_message_routes_subscribe():
    wire = {"type": "subscribe", "symbol": "GC", "events": ["bar_update"], "tf": "1m"}
    decoded = decode_chart_client_message(wire)
    assert isinstance(decoded, Subscribe)
    assert decoded.events == [EventType.BAR_UPDATE]


@pytest.mark.unit
def test_decode_chart_client_message_routes_unsubscribe():
    wire = {"type": "unsubscribe", "symbol": "GC", "events": ["footprint_update"]}
    decoded = decode_chart_client_message(wire)
    assert isinstance(decoded, Unsubscribe)


@pytest.mark.unit
def test_decode_chart_client_message_routes_pong():
    decoded = decode_chart_client_message({"type": "pong", "time": 1730313600999})
    assert isinstance(decoded, Pong)
    assert decoded.time == 1730313600999


@pytest.mark.unit
def test_decode_chart_client_message_rejects_unknown_type():
    with pytest.raises(ValueError):
        decode_chart_client_message({"type": "ping", "time": 1})


@pytest.mark.unit
def test_from_dict_rejects_mismatched_type_discriminator():
    # Each typed message validates its `type` discriminator on decode.
    with pytest.raises(ValueError):
        BarUpdate.from_dict({"type": "quote_update"})
    with pytest.raises(ValueError):
        ControlCommand.from_dict({"type": "subscribe"})
