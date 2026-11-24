from __future__ import annotations

import pytest

from app.rithmic.protocol import (
    FRONT_MONTH_CONTRACT_REQUEST,
    FRONT_MONTH_CONTRACT_RESPONSE,
    RESUME_BARS_REQUEST,
    RESUME_BARS_RESPONSE,
    TEMPLATE_ID_FIELD,
    TIME_BAR_REPLAY_REQUEST,
    TIME_BAR_REPLAY_RESPONSE,
    VOLUME_PROFILE_MINUTE_BARS_REQUEST,
    VOLUME_PROFILE_MINUTE_BARS_RESPONSE,
    build_front_month_contract_request,
    build_login_request,
    build_resume_bars_request,
    build_time_bar_replay_request,
    build_volume_profile_minute_bars_request,
    decode_message,
    field_double,
    field_string,
    field_varint,
    parse_fields,
    template_id,
)


def _varints(frame: bytes, field: int) -> list[int]:
    return [
        int(value)
        for wire_type, value in parse_fields(frame).get(field, [])
        if wire_type == 0
    ]


def test_history_plant_login_uses_read_only_infra_type() -> None:
    frame = build_login_request(
        user="user",
        password="secret",
        app_name="NTtoTV Rithmic Connector",
        app_version="1.0.0",
        system_name="Rithmic Paper Trading",
        infra_type=3,
    )

    assert _varints(frame, 153621) == [3]


def test_login_rejects_order_plant() -> None:
    with pytest.raises(ValueError, match="Ticker Plant"):
        build_login_request(
            user="user",
            password="secret",
            app_name="NTtoTV",
            app_version="1.0.0",
            system_name="Rithmic Paper Trading",
            infra_type=2,
        )


def test_time_bar_request_is_forward_minute_history() -> None:
    frame = build_time_bar_replay_request(
        symbol="GCZ6",
        exchange="COMEX",
        start_seconds=1_700_000_000,
        finish_seconds=1_700_003_600,
        user_message="history-1",
    )

    assert template_id(frame) == TIME_BAR_REPLAY_REQUEST
    assert _varints(frame, 119200) == [2]
    assert _varints(frame, 119112) == [1]
    assert _varints(frame, 149307) == [1]
    assert _varints(frame, 153002) == [1_700_000_000]
    assert _varints(frame, 153003) == [1_700_003_600]


def test_volume_profile_request_uses_minute_period() -> None:
    frame = build_volume_profile_minute_bars_request(
        symbol="GCZ6",
        exchange="COMEX",
        start_seconds=1_700_000_000,
        finish_seconds=1_700_003_600,
    )

    assert template_id(frame) == VOLUME_PROFILE_MINUTE_BARS_REQUEST
    assert _varints(frame, 119215) == [1]


def test_resume_bars_request_and_response() -> None:
    request = build_resume_bars_request(
        request_key="history-request-key",
        user_message="resume-1",
    )
    assert template_id(request) == RESUME_BARS_REQUEST
    request_fields = parse_fields(request)
    assert request_fields[132758] == [(2, b"history-request-key")]

    response = b"".join(
        (
            field_varint(TEMPLATE_ID_FIELD, RESUME_BARS_RESPONSE),
            field_string(132760, "resume-1"),
            field_string(132766, "0"),
        )
    )
    message = decode_message(response)
    assert message["type"] == "resume_bars"
    assert message["ok"] is True


def test_decode_time_bar_response() -> None:
    frame = b"".join(
        (
            field_varint(TEMPLATE_ID_FIELD, TIME_BAR_REPLAY_RESPONSE),
            field_string(132766, "0"),
            field_string(110100, "GCZ6"),
            field_varint(119100, 1_700_000_000),
            field_varint(119109, 12),
            field_varint(119110, 34),
            field_varint(119117, 14),
            field_varint(119118, 20),
            field_double(100019, 2000.1),
            field_double(100012, 2001.2),
            field_double(100013, 1999.9),
            field_double(100021, 2000.8),
        )
    )

    message = decode_message(frame)
    assert message["type"] == "time_bar_replay"
    assert message["marker"] == 1_700_000_000
    assert message["volume"] == 34
    assert message["askVolume"] - message["bidVolume"] == 6
    assert message["close"] == pytest.approx(2000.8)


def test_decode_volume_profile_prefers_64_bit_ladders() -> None:
    frame = b"".join(
        (
            field_varint(TEMPLATE_ID_FIELD, VOLUME_PROFILE_MINUTE_BARS_RESPONSE),
            field_string(132766, "0"),
            field_varint(119100, 1_700_000_000),
            field_double(119216, 2000.0),
            field_double(119216, 2000.1),
            field_varint(159012, 4),
            field_varint(159012, 5),
            field_varint(159013, 7),
            field_varint(159013, 8),
        )
    )

    message = decode_message(frame)
    assert message["type"] == "volume_profile_minute_bar"
    assert message["prices"] == pytest.approx([2000.0, 2000.1])
    assert message["bidVolumes"] == [4, 5]
    assert message["askVolumes"] == [7, 8]


def test_front_month_request_and_response() -> None:
    request = build_front_month_contract_request(symbol="GC", exchange="COMEX")
    assert template_id(request) == FRONT_MONTH_CONTRACT_REQUEST

    response = b"".join(
        (
            field_varint(TEMPLATE_ID_FIELD, FRONT_MONTH_CONTRACT_RESPONSE),
            field_string(132766, "0"),
            field_string(110100, "GC"),
            field_string(110101, "COMEX"),
            field_varint(149166, 1),
            field_string(100003, "Gold Futures Dec 2026"),
            field_string(157095, "GCZ6"),
            field_string(157096, "COMEX"),
        )
    )
    message = decode_message(response)
    assert message["type"] == "front_month_contract"
    assert message["isFrontMonth"] is True
    assert message["tradingSymbol"] == "GCZ6"
