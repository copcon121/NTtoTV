from __future__ import annotations

import struct

import pytest

from app.rithmic.protocol import (
    TEMPLATE_ID_FIELD,
    build_get_instrument_by_underlying_request,
    build_login_request,
    build_search_symbols_request,
    decode_message,
    encode_varint,
    field_bytes,
    field_double,
    field_string,
    field_varint,
    parse_fields,
)


@pytest.mark.unit
@pytest.mark.parametrize(
    ("value", "encoded"),
    [(0, b"\x00"), (127, b"\x7f"), (128, b"\x80\x01"), (300, b"\xac\x02")],
)
def test_varint_encoding(value: int, encoded: bytes) -> None:
    assert encode_varint(value) == encoded


@pytest.mark.unit
def test_login_contains_bookmap_profile_and_is_locked_to_ticker_plant() -> None:
    frame = build_login_request(
        user="test-user",
        password="test-password",
        app_name="NTtoTV Rithmic Connector",
        app_version="7.4.0.21",
        system_name="Rithmic Test",
        mac_addresses=("00:11:22:33:44:55",),
        os_version="test-os",
        os_platform="Windows",
        aggregated_quotes=False,
    )
    fields = parse_fields(frame)

    assert fields[TEMPLATE_ID_FIELD] == [(0, 10)]
    assert fields[153621] == [(0, 1)]
    assert fields[153644] == [(0, 0)]
    assert fields[130002] == [(2, b"NTtoTV Rithmic Connector")]
    assert fields[131803] == [(2, b"7.4.0.21")]
    assert fields[153628] == [(2, b"Rithmic Test")]
    assert fields[144108] == [(2, b"00:11:22:33:44:55")]


@pytest.mark.unit
def test_get_instrument_by_underlying_request_contains_option_chain_key() -> None:
    frame = build_get_instrument_by_underlying_request(
        underlying_symbol="GCZ6",
        exchange="COMEX",
        expiration_date="20261124",
        user_message="option-request-1",
    )
    fields = parse_fields(frame)

    assert fields[TEMPLATE_ID_FIELD] == [(0, 102)]
    assert fields[132760] == [(2, b"option-request-1")]
    assert fields[101026] == [(2, b"GCZ6")]
    assert fields[110101] == [(2, b"COMEX")]
    assert fields[100067] == [(2, b"20261124")]


@pytest.mark.unit
def test_option_symbol_search_is_scoped_to_comex_og() -> None:
    frame = build_search_symbols_request(
        search_text="OG",
        exchange="COMEX",
        product_code="OG",
        user_message="option-search-1",
    )
    fields = parse_fields(frame)

    assert fields[TEMPLATE_ID_FIELD] == [(0, 109)]
    assert fields[120008] == [(2, b"OG")]
    assert fields[110101] == [(2, b"COMEX")]
    assert fields[100749] == [(2, b"OG")]
    assert fields[110116] == [(0, 2)]
    assert fields[155008] == [(0, 2)]


@pytest.mark.unit
def test_decodes_option_keys_and_strike_reference_rows() -> None:
    keys = decode_message(
        b"".join(
            [
                field_varint(TEMPLATE_ID_FIELD, 104),
                field_string(132760, "option-request-1"),
                field_string(101026, "GCZ6"),
                field_string(110101, "COMEX"),
                field_string(100067, "20261124"),
                field_string(100067, "20261223"),
                field_string(132766, "0"),
            ]
        )
    )
    instrument = decode_message(
        b"".join(
            [
                field_varint(TEMPLATE_ID_FIELD, 103),
                field_string(132760, "option-request-2"),
                field_string(110100, "OGCX6 C4200"),
                field_string(110101, "COMEX"),
                field_string(100749, "OG"),
                field_string(110116, "FUTURE_OPTION"),
                field_string(101026, "GCZ6"),
                field_string(100067, "20261124"),
                field_string(100109, "C"),
                field_double(100066, 4200.0),
                field_double(154386, 0.1),
                field_double(154389, 100.0),
            ]
        )
    )

    assert keys == {
        "templateId": 104,
        "userMessages": ["option-request-1"],
        "rpCode": ["0"],
        "type": "option_underlying_keys",
        "underlyingSymbols": ["GCZ6"],
        "exchanges": ["COMEX"],
        "expirationDates": ["20261124", "20261223"],
    }
    assert instrument["type"] == "option_instrument"
    assert instrument["symbol"] == "OGCX6 C4200"
    assert instrument["underlyingSymbol"] == "GCZ6"
    assert instrument["putCall"] == "C"
    assert instrument["strikePrice"] == pytest.approx(4200.0)
    assert instrument["minPriceChange"] == pytest.approx(0.1)
    assert instrument["singlePointValue"] == pytest.approx(100.0)


@pytest.mark.unit
def test_decodes_l1_trade_with_exchange_timestamp_and_order_ids() -> None:
    frame = b"".join(
        [
            field_varint(TEMPLATE_ID_FIELD, 150),
            field_string(110100, "GCZ6"),
            field_string(110101, "COMEX"),
            field_double(100006, 2712.4),
            field_varint(159008, 7),
            field_varint(112003, 1),
            field_string(149238, "passive-order"),
            field_string(154641, "aggressor-order"),
            field_varint(150400, 1_800_000_000),
            field_varint(150401, 123_456),
        ]
    )

    message = decode_message(frame)

    assert message["type"] == "trade"
    assert message["price"] == pytest.approx(2712.4)
    assert message["size"] == 7
    assert message["aggressor"] == "buy"
    assert message["exchangeOrderId"] == "passive-order"
    assert message["aggressorExchangeOrderId"] == "aggressor-order"
    assert message["timeMs"] == 1_800_000_000_123
    assert message["sourceTimeNanos"] == 1_800_000_000_123_456_000


@pytest.mark.unit
def test_decodes_l2_order_book_levels() -> None:
    frame = b"".join(
        [
            field_varint(TEMPLATE_ID_FIELD, 156),
            field_string(110100, "GCZ6"),
            field_string(110101, "COMEX"),
            field_varint(157608, 7),
            field_double(154282, 2712.3),
            field_varint(159004, 11),
            field_varint(154401, 3),
            field_double(154284, 2712.4),
            field_varint(159006, 8),
            field_varint(154402, 2),
        ]
    )

    message = decode_message(frame)

    assert message["type"] == "order_book"
    assert message["updateType"] == "solo"
    assert message["bids"] == [{"price": 2712.3, "size": 11, "orders": 3}]
    assert message["asks"] == [{"price": 2712.4, "size": 8, "orders": 2}]


@pytest.mark.unit
def test_decodes_mbo_update_rows() -> None:
    packed_prices = struct.pack("<2d", 2712.3, 2712.4)
    frame = b"".join(
        [
            field_varint(TEMPLATE_ID_FIELD, 160),
            field_string(110100, "GCZ6"),
            field_string(110101, "COMEX"),
            field_varint(112002, 42),
            field_varint(110121, 1),
            field_varint(110121, 3),
            field_varint(153612, 1),
            field_varint(153612, 2),
            # Packed numeric input is accepted in addition to proto2 unpacked form.
            field_bytes(154405, packed_prices),
            field_varint(159009, 5),
            field_varint(159009, 0),
            field_varint(153613, 100),
            field_varint(153613, 101),
            field_string(149238, "bid-1"),
            field_string(149238, "ask-1"),
        ]
    )
    message = decode_message(frame)

    assert message["type"] == "mbo_update"
    assert message["sequence"] == 42
    assert message["updates"] == [
        {
            "action": "new",
            "side": "buy",
            "price": 2712.3,
            "size": 5,
            "priority": 100,
            "exchangeOrderId": "bid-1",
        },
        {
            "action": "delete",
            "side": "sell",
            "price": 2712.4,
            "size": 0,
            "priority": 101,
            "exchangeOrderId": "ask-1",
        },
    ]
