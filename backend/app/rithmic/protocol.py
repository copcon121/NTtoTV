"""Minimal R|Protocol protobuf wire codec for read-only market data.

The field numbers and template IDs come from the user-supplied
``RProtocolAPI.zip`` version 0.90.0.0.  Keeping this probe codec small avoids
adding generated order-entry messages (or a protobuf runtime) to the backend.
"""

from __future__ import annotations

import struct
from collections import defaultdict
from collections.abc import Iterable
from typing import Any


class ProtocolDecodeError(ValueError):
    """Raised when a websocket frame isn't a valid protobuf message."""


# Every R|Protocol message stores its template ID at this protobuf field.
TEMPLATE_ID_FIELD = 154467

# Shared templates.
LOGIN_REQUEST = 10
LOGIN_RESPONSE = 11
LOGOUT_REQUEST = 12
LOGOUT_RESPONSE = 13
REFERENCE_DATA_REQUEST = 14
REFERENCE_DATA_RESPONSE = 15
SYSTEM_INFO_REQUEST = 16
SYSTEM_INFO_RESPONSE = 17
HEARTBEAT_REQUEST = 18
HEARTBEAT_RESPONSE = 19
GATEWAY_INFO_REQUEST = 20
GATEWAY_INFO_RESPONSE = 21
REJECT = 75
FORCED_LOGOUT = 77

# Ticker Plant request/response templates.
MARKET_DATA_REQUEST = 100
MARKET_DATA_RESPONSE = 101
GET_INSTRUMENT_BY_UNDERLYING_REQUEST = 102
GET_INSTRUMENT_BY_UNDERLYING_RESPONSE = 103
GET_INSTRUMENT_BY_UNDERLYING_KEYS_RESPONSE = 104
SEARCH_SYMBOLS_REQUEST = 109
SEARCH_SYMBOLS_RESPONSE = 110
FRONT_MONTH_CONTRACT_REQUEST = 113
FRONT_MONTH_CONTRACT_RESPONSE = 114
DBO_SNAPSHOT_REQUEST = 115
DBO_SNAPSHOT_RESPONSE = 116
DBO_UPDATES_REQUEST = 117
DBO_UPDATES_RESPONSE = 118
LAST_TRADE = 150
BEST_BID_OFFER = 151
ORDER_BOOK = 156
DEPTH_BY_ORDER = 160

# History Plant request/response templates.
TIME_BAR_REPLAY_REQUEST = 202
TIME_BAR_REPLAY_RESPONSE = 203
VOLUME_PROFILE_MINUTE_BARS_REQUEST = 208
VOLUME_PROFILE_MINUTE_BARS_RESPONSE = 209
RESUME_BARS_REQUEST = 210
RESUME_BARS_RESPONSE = 211

# RequestMarketDataUpdate.UpdateBits.
UPDATE_LAST_TRADE = 1
UPDATE_BBO = 2
UPDATE_ORDER_BOOK = 4


def encode_varint(value: int) -> bytes:
    if value < 0:
        raise ValueError("only non-negative protobuf varints are supported")
    out = bytearray()
    while value >= 0x80:
        out.append((value & 0x7F) | 0x80)
        value >>= 7
    out.append(value)
    return bytes(out)


def _read_varint(data: bytes, offset: int) -> tuple[int, int]:
    value = 0
    shift = 0
    for _ in range(10):
        if offset >= len(data):
            raise ProtocolDecodeError("truncated protobuf varint")
        byte = data[offset]
        offset += 1
        value |= (byte & 0x7F) << shift
        if byte < 0x80:
            return value, offset
        shift += 7
    raise ProtocolDecodeError("protobuf varint exceeds 10 bytes")


def _key(field_number: int, wire_type: int) -> bytes:
    return encode_varint((field_number << 3) | wire_type)


def field_varint(field_number: int, value: int) -> bytes:
    return _key(field_number, 0) + encode_varint(value)


def field_double(field_number: int, value: float) -> bytes:
    return _key(field_number, 1) + struct.pack("<d", value)


def field_bytes(field_number: int, value: bytes) -> bytes:
    return _key(field_number, 2) + encode_varint(len(value)) + value


def field_string(field_number: int, value: str) -> bytes:
    return field_bytes(field_number, value.encode("utf-8"))


def parse_fields(data: bytes) -> dict[int, list[tuple[int, int | bytes]]]:
    """Parse a protobuf frame while preserving wire type and repetitions."""

    fields: dict[int, list[tuple[int, int | bytes]]] = defaultdict(list)
    offset = 0
    while offset < len(data):
        key, offset = _read_varint(data, offset)
        field_number = key >> 3
        wire_type = key & 7
        if field_number == 0:
            raise ProtocolDecodeError("protobuf field number zero is invalid")
        if wire_type == 0:
            value, offset = _read_varint(data, offset)
        elif wire_type == 1:
            end = offset + 8
            if end > len(data):
                raise ProtocolDecodeError("truncated fixed64 protobuf field")
            value = data[offset:end]
            offset = end
        elif wire_type == 2:
            length, offset = _read_varint(data, offset)
            end = offset + length
            if end > len(data):
                raise ProtocolDecodeError("truncated length-delimited protobuf field")
            value = data[offset:end]
            offset = end
        elif wire_type == 5:
            end = offset + 4
            if end > len(data):
                raise ProtocolDecodeError("truncated fixed32 protobuf field")
            value = data[offset:end]
            offset = end
        else:
            raise ProtocolDecodeError(f"unsupported protobuf wire type {wire_type}")
        fields[field_number].append((wire_type, value))
    return dict(fields)


def _varints(fields: dict[int, list[tuple[int, int | bytes]]], number: int) -> list[int]:
    values: list[int] = []
    for wire_type, raw in fields.get(number, []):
        if wire_type == 0 and isinstance(raw, int):
            values.append(raw)
        elif wire_type == 2 and isinstance(raw, bytes):
            offset = 0
            while offset < len(raw):
                value, offset = _read_varint(raw, offset)
                values.append(value)
    return values


def _first_varint(
    fields: dict[int, list[tuple[int, int | bytes]]], number: int
) -> int | None:
    values = _varints(fields, number)
    return values[0] if values else None


def _doubles(fields: dict[int, list[tuple[int, int | bytes]]], number: int) -> list[float]:
    values: list[float] = []
    for wire_type, raw in fields.get(number, []):
        if not isinstance(raw, bytes):
            continue
        if wire_type == 1:
            values.append(struct.unpack("<d", raw)[0])
        elif wire_type == 2:
            if len(raw) % 8:
                raise ProtocolDecodeError(f"packed double field {number} has invalid size")
            values.extend(struct.unpack(f"<{len(raw) // 8}d", raw))
    return values


def _first_double(
    fields: dict[int, list[tuple[int, int | bytes]]], number: int
) -> float | None:
    values = _doubles(fields, number)
    return values[0] if values else None


def _strings(fields: dict[int, list[tuple[int, int | bytes]]], number: int) -> list[str]:
    values: list[str] = []
    for wire_type, raw in fields.get(number, []):
        if wire_type == 2 and isinstance(raw, bytes):
            values.append(raw.decode("utf-8", errors="replace"))
    return values


def _first_string(
    fields: dict[int, list[tuple[int, int | bytes]]], number: int
) -> str | None:
    values = _strings(fields, number)
    return values[0] if values else None


def template_id(data: bytes) -> int:
    value = _first_varint(parse_fields(data), TEMPLATE_ID_FIELD)
    if value is None:
        raise ProtocolDecodeError("R|Protocol frame has no template_id")
    return value


def _request(template: int, extra: Iterable[bytes] = ()) -> bytes:
    return b"".join((field_varint(TEMPLATE_ID_FIELD, template), *extra))


def build_system_info_request(user_message: str = "nttotv-probe") -> bytes:
    return _request(SYSTEM_INFO_REQUEST, (field_string(132760, user_message),))


def build_gateway_info_request(system_name: str) -> bytes:
    return _request(
        GATEWAY_INFO_REQUEST,
        (field_string(132760, "nttotv-probe"), field_string(153628, system_name)),
    )


def build_heartbeat_request() -> bytes:
    return _request(HEARTBEAT_REQUEST)


def build_logout_request() -> bytes:
    return _request(LOGOUT_REQUEST, (field_string(132760, "nttotv-probe"),))


def build_login_request(
    *,
    user: str,
    password: str,
    app_name: str,
    app_version: str,
    system_name: str,
    mac_addresses: Iterable[str] = (),
    os_version: str | None = None,
    os_platform: str | None = None,
    aggregated_quotes: bool = False,
    template_version: str = "5.55",
    user_message: str = "nttotv-probe",
    infra_type: int = 1,
) -> bytes:
    """Build a read-only plant login.

    ``infra_type`` follows ``RequestLogin.SysInfraType``: 1 is Ticker Plant
    and 3 is History Plant.  The connector never exposes Order Plant login.
    """

    if infra_type not in (1, 3):
        raise ValueError("only Ticker Plant (1) and History Plant (3) are supported")

    fields = [
        field_string(153634, template_version),
        field_string(132760, user_message),
        field_string(131003, user),
        field_string(130004, password),
        field_string(130002, app_name),
        field_string(131803, app_version),
        field_string(153628, system_name),
        field_varint(153621, infra_type),
    ]
    fields.extend(field_string(144108, value) for value in mac_addresses if value)
    if os_version:
        fields.append(field_string(144021, os_version))
    if os_platform:
        fields.append(field_string(144020, os_platform))
    # Encode false explicitly so the gateway supplies non-aggregated quotes.
    fields.append(field_varint(153644, int(aggregated_quotes)))
    return _request(LOGIN_REQUEST, fields)


def build_time_bar_replay_request(
    *,
    symbol: str,
    exchange: str,
    start_seconds: int,
    finish_seconds: int,
    period_minutes: int = 1,
    max_count: int = 0,
    resume_bars: bool = False,
    user_message: str = "nttotv-history-time-bars",
) -> bytes:
    """Request closed minute bars from the History Plant."""

    if start_seconds < 0 or finish_seconds < start_seconds:
        raise ValueError("invalid history range")
    if period_minutes <= 0:
        raise ValueError("period_minutes must be positive")
    fields = [
        field_string(132760, user_message),
        field_string(110100, symbol),
        field_string(110101, exchange),
        field_varint(119200, 2),  # RequestTimeBarReplay.BarType.MINUTE_BAR
        field_varint(119112, period_minutes),
        field_varint(153002, start_seconds),
        field_varint(153003, finish_seconds),
        field_varint(149253, 1),  # Direction.FIRST
        field_varint(149307, 1),  # TimeOrder.FORWARDS
        field_varint(153642, int(resume_bars)),
    ]
    if max_count > 0:
        fields.append(field_varint(154020, max_count))
    return _request(TIME_BAR_REPLAY_REQUEST, fields)


def build_volume_profile_minute_bars_request(
    *,
    symbol: str,
    exchange: str,
    start_seconds: int,
    finish_seconds: int,
    period_minutes: int = 1,
    max_count: int = 0,
    resume_bars: bool = False,
    user_message: str = "nttotv-history-volume-profile",
) -> bytes:
    """Request minute OHLCV plus bid/ask volume-at-price ladders."""

    if start_seconds < 0 or finish_seconds < start_seconds:
        raise ValueError("invalid history range")
    if period_minutes <= 0:
        raise ValueError("period_minutes must be positive")
    fields = [
        field_string(132760, user_message),
        field_string(110100, symbol),
        field_string(110101, exchange),
        field_varint(119215, period_minutes),
        field_varint(153002, start_seconds),
        field_varint(153003, finish_seconds),
        field_varint(153642, int(resume_bars)),
    ]
    if max_count > 0:
        fields.append(field_varint(154020, max_count))
    return _request(VOLUME_PROFILE_MINUTE_BARS_REQUEST, fields)


def build_resume_bars_request(
    *,
    request_key: str,
    user_message: str = "nttotv-history-resume",
) -> bytes:
    """Resume a History Plant replay previously opened with ``resume_bars``."""

    if not request_key.strip():
        raise ValueError("request_key must not be empty")
    return _request(
        RESUME_BARS_REQUEST,
        (
            field_string(132760, user_message),
            field_string(132758, request_key),
        ),
    )


def build_front_month_contract_request(
    *,
    symbol: str,
    exchange: str,
    subscribe: bool = False,
    user_message: str = "nttotv-front-month",
) -> bytes:
    return _request(
        FRONT_MONTH_CONTRACT_REQUEST,
        (
            field_string(132760, user_message),
            field_string(110100, symbol),
            field_string(110101, exchange),
            field_varint(154352, int(subscribe)),
        ),
    )


def build_market_data_request(
    *, symbol: str, exchange: str, update_bits: int, subscribe: bool = True
) -> bytes:
    return _request(
        MARKET_DATA_REQUEST,
        (
            field_string(132760, "nttotv-probe"),
            field_string(110100, symbol),
            field_string(110101, exchange),
            field_varint(100000, 1 if subscribe else 2),
            field_varint(154211, update_bits),
        ),
    )


def build_dbo_updates_request(
    *, symbol: str, exchange: str, subscribe: bool = True
) -> bytes:
    return _request(
        DBO_UPDATES_REQUEST,
        (
            field_string(132760, "nttotv-probe"),
            field_varint(100000, 1 if subscribe else 2),
            field_string(110100, symbol),
            field_string(110101, exchange),
        ),
    )


def build_dbo_snapshot_request(*, symbol: str, exchange: str) -> bytes:
    return _request(
        DBO_SNAPSHOT_REQUEST,
        (
            field_string(132760, "nttotv-probe"),
            field_string(110100, symbol),
            field_string(110101, exchange),
        ),
    )


def build_get_instrument_by_underlying_request(
    *,
    underlying_symbol: str,
    exchange: str,
    expiration_date: str | None = None,
    user_message: str = "nttotv-option-probe",
) -> bytes:
    """Request option/reference instruments without opening another session."""

    fields = [
        field_string(132760, user_message),
        field_string(101026, underlying_symbol),
        field_string(110101, exchange),
    ]
    if expiration_date:
        fields.append(field_string(100067, expiration_date))
    return _request(GET_INSTRUMENT_BY_UNDERLYING_REQUEST, fields)


def build_search_symbols_request(
    *,
    search_text: str,
    exchange: str,
    product_code: str | None = None,
    instrument_type: int = 2,
    user_message: str = "nttotv-option-search",
) -> bytes:
    """Search symbols; instrument type 2 is FUTURE_OPTION in R|Protocol."""

    fields = [
        field_string(132760, user_message),
        field_string(120008, search_text),
        field_string(110101, exchange),
        field_varint(110116, instrument_type),
        field_varint(155008, 2),  # Pattern.CONTAINS
    ]
    if product_code:
        fields.append(field_string(100749, product_code))
    return _request(SEARCH_SYMBOLS_REQUEST, fields)


def build_reference_data_request(
    *, symbol: str, exchange: str, user_message: str = "nttotv-reference-data"
) -> bytes:
    return _request(
        REFERENCE_DATA_REQUEST,
        (
            field_string(132760, user_message),
            field_string(110100, symbol),
            field_string(110101, exchange),
        ),
    )


def _side(value: int | None) -> str | None:
    return {1: "buy", 2: "sell"}.get(value)


def _time_ms(fields: dict[int, list[tuple[int, int | bytes]]]) -> int | None:
    seconds = _first_varint(fields, 150400)
    micros = _first_varint(fields, 150401)
    if seconds is None:
        seconds = _first_varint(fields, 150100)
        micros = _first_varint(fields, 150101)
    if seconds is None:
        return None
    return seconds * 1000 + (micros or 0) // 1000


def _source_time_nanos(
    fields: dict[int, list[tuple[int, int | bytes]]]
) -> int | None:
    seconds = _first_varint(fields, 150400)
    if seconds is not None:
        nanos = _first_varint(fields, 150404)
        if nanos is not None:
            return seconds * 1_000_000_000 + nanos
        micros = _first_varint(fields, 150401)
        return seconds * 1_000_000_000 + (micros or 0) * 1_000
    seconds = _first_varint(fields, 150100)
    if seconds is None:
        return None
    micros = _first_varint(fields, 150101)
    return seconds * 1_000_000_000 + (micros or 0) * 1_000


def _levels(
    prices: list[float],
    sizes: list[int],
    orders: list[int],
    implied: list[int],
) -> list[dict[str, int | float]]:
    result: list[dict[str, int | float]] = []
    for index, price in enumerate(prices):
        level: dict[str, int | float] = {"price": price}
        if index < len(sizes):
            level["size"] = sizes[index]
        if index < len(orders):
            level["orders"] = orders[index]
        if index < len(implied):
            level["impliedSize"] = implied[index]
        result.append(level)
    return result


def _dbo_rows(fields: dict[int, list[tuple[int, int | bytes]]]) -> list[dict[str, Any]]:
    update_types = _varints(fields, 110121)
    sides = _varints(fields, 153612)
    prices = _doubles(fields, 154405)
    previous_prices = _doubles(fields, 154906)
    previous_flags = _varints(fields, 154930)
    sizes = _varints(fields, 159009) or _varints(fields, 154406)
    priorities = _varints(fields, 153613)
    order_ids = _strings(fields, 149238)
    count = max(
        map(
            len,
            (update_types, sides, prices, sizes, priorities, order_ids),
        ),
        default=0,
    )
    rows: list[dict[str, Any]] = []
    for index in range(count):
        row: dict[str, Any] = {}
        if index < len(update_types):
            row["action"] = {1: "new", 2: "change", 3: "delete"}.get(
                update_types[index], f"unknown:{update_types[index]}"
            )
        if index < len(sides):
            row["side"] = _side(sides[index]) or f"unknown:{sides[index]}"
        if index < len(prices):
            row["price"] = prices[index]
        if index < len(sizes):
            row["size"] = sizes[index]
        if index < len(priorities):
            row["priority"] = priorities[index]
        if index < len(order_ids):
            row["exchangeOrderId"] = order_ids[index]
        if index < len(previous_flags) and previous_flags[index]:
            if index < len(previous_prices):
                row["previousPrice"] = previous_prices[index]
        rows.append(row)
    return rows


def _dbo_snapshot_orders(
    fields: dict[int, list[tuple[int, int | bytes]]]
) -> list[dict[str, Any]]:
    sizes = _varints(fields, 159009) or _varints(fields, 154406)
    priorities = _varints(fields, 153613)
    order_ids = _strings(fields, 149238)
    count = max(map(len, (sizes, priorities, order_ids)), default=0)
    orders: list[dict[str, Any]] = []
    for index in range(count):
        order: dict[str, Any] = {}
        if index < len(sizes):
            order["size"] = sizes[index]
        if index < len(priorities):
            order["priority"] = priorities[index]
        if index < len(order_ids):
            order["exchangeOrderId"] = order_ids[index]
        orders.append(order)
    return orders


def decode_message(data: bytes) -> dict[str, Any]:
    """Decode the read-only templates understood by the probe."""

    fields = parse_fields(data)
    template = _first_varint(fields, TEMPLATE_ID_FIELD)
    if template is None:
        raise ProtocolDecodeError("R|Protocol frame has no template_id")
    base: dict[str, Any] = {"templateId": template}
    user_messages = _strings(fields, 132760)
    if user_messages:
        base["userMessages"] = user_messages
    rp_codes = _strings(fields, 132766)
    if rp_codes:
        base["rpCode"] = rp_codes

    if template == SYSTEM_INFO_RESPONSE:
        base.update(
            type="system_info",
            systems=_strings(fields, 153628),
            aggregatedQuotes=[bool(v) for v in _varints(fields, 153649)],
        )
    elif template == GATEWAY_INFO_RESPONSE:
        base.update(
            type="gateway_info",
            system=_first_string(fields, 153628),
            gatewayNames=_strings(fields, 153640),
            gatewayUris=_strings(fields, 153641),
        )
    elif template == LOGIN_RESPONSE:
        base.update(
            type="login",
            ok=rp_codes == ["0"],
            heartbeatInterval=_first_double(fields, 153633),
            fcmId=_first_string(fields, 154013),
            ibId=_first_string(fields, 154014),
        )
    elif template == TIME_BAR_REPLAY_RESPONSE:
        base.update(
            type="time_bar_replay",
            requestKey=_first_string(fields, 132758),
            requestHandlerCode=_strings(fields, 132764),
            symbol=_first_string(fields, 110100),
            exchange=_first_string(fields, 110101),
            barType=_first_varint(fields, 119200),
            period=_first_string(fields, 119112),
            marker=_first_varint(fields, 119100),
            numTrades=_first_varint(fields, 119109),
            volume=_first_varint(fields, 119110),
            bidVolume=_first_varint(fields, 119117),
            askVolume=_first_varint(fields, 119118),
            open=_first_double(fields, 100019),
            close=_first_double(fields, 100021),
            high=_first_double(fields, 100012),
            low=_first_double(fields, 100013),
            settlementPrice=_first_double(fields, 100070),
        )
    elif template == VOLUME_PROFILE_MINUTE_BARS_RESPONSE:
        base.update(
            type="volume_profile_minute_bar",
            requestKey=_first_string(fields, 132758),
            requestHandlerCode=_strings(fields, 132764),
            symbol=_first_string(fields, 110100),
            exchange=_first_string(fields, 110101),
            period=_first_string(fields, 119215),
            marker=_first_varint(fields, 119100),
            numTrades=_first_varint(fields, 119204),
            volume=_first_varint(fields, 119205),
            bidVolume=_first_varint(fields, 119213),
            askVolume=_first_varint(fields, 119214),
            open=_first_double(fields, 100019),
            close=_first_double(fields, 100021),
            high=_first_double(fields, 100012),
            low=_first_double(fields, 100013),
            prices=_doubles(fields, 119216),
            noAggressorVolume=(
                _varints(fields, 159011) or _varints(fields, 119217)
            ),
            bidVolumes=_varints(fields, 159012) or _varints(fields, 119218),
            askVolumes=_varints(fields, 159013) or _varints(fields, 119219),
            noAggressorTrades=(
                _varints(fields, 159014) or _varints(fields, 119220)
            ),
            bidAggressorTrades=(
                _varints(fields, 159015) or _varints(fields, 119221)
            ),
            askAggressorTrades=(
                _varints(fields, 159016) or _varints(fields, 119222)
            ),
        )
    elif template == RESUME_BARS_RESPONSE:
        base.update(
            type="resume_bars",
            ok=rp_codes == ["0"],
        )
    elif template == FRONT_MONTH_CONTRACT_RESPONSE:
        base.update(
            type="front_month_contract",
            symbol=_first_string(fields, 110100),
            exchange=_first_string(fields, 110101),
            isFrontMonth=bool(_first_varint(fields, 149166) or False),
            symbolName=_first_string(fields, 100003),
            tradingSymbol=_first_string(fields, 157095),
            tradingExchange=_first_string(fields, 157096),
        )
    elif template in (MARKET_DATA_RESPONSE, DBO_UPDATES_RESPONSE):
        base["type"] = (
            "market_data_subscription"
            if template == MARKET_DATA_RESPONSE
            else "mbo_subscription"
        )
        base["ok"] = rp_codes == ["0"]
    elif template == GET_INSTRUMENT_BY_UNDERLYING_KEYS_RESPONSE:
        base.update(
            type="option_underlying_keys",
            underlyingSymbols=_strings(fields, 101026),
            exchanges=_strings(fields, 110101),
            expirationDates=_strings(fields, 100067),
        )
    elif template == SEARCH_SYMBOLS_RESPONSE:
        base.update(
            type="symbol_search",
            symbol=_first_string(fields, 110100),
            exchange=_first_string(fields, 110101),
            symbolName=_first_string(fields, 100003),
            productCode=_first_string(fields, 100749),
            instrumentType=_first_string(fields, 110116),
            expirationDate=_first_string(fields, 100067),
            requestHandlerCode=_strings(fields, 132764),
        )
    elif template in (
        GET_INSTRUMENT_BY_UNDERLYING_RESPONSE,
        REFERENCE_DATA_RESPONSE,
    ):
        base.update(
            type=(
                "option_instrument"
                if template == GET_INSTRUMENT_BY_UNDERLYING_RESPONSE
                else "reference_data"
            ),
            symbol=_first_string(fields, 110100),
            exchange=_first_string(fields, 110101),
            exchangeSymbol=_first_string(fields, 110114),
            symbolName=_first_string(fields, 100003),
            productCode=_first_string(fields, 100749),
            instrumentType=_first_string(fields, 110116),
            underlyingSymbol=_first_string(fields, 101026),
            expirationDate=_first_string(fields, 100067),
            currency=_first_string(fields, 154382),
            putCall=_first_string(fields, 100109),
            strikePrice=_first_double(fields, 100066),
            minPriceChange=_first_double(fields, 154386),
            singlePointValue=_first_double(fields, 154389),
            requestHandlerCode=_strings(fields, 132764),
        )
    elif template == DBO_SNAPSHOT_RESPONSE:
        base.update(
            type="mbo_snapshot",
            symbol=_first_string(fields, 110100),
            exchange=_first_string(fields, 110101),
            sequence=_first_varint(fields, 112002),
            side=_side(_first_varint(fields, 153612)),
            price=_first_double(fields, 154405),
            orders=_dbo_snapshot_orders(fields),
            requestHandlerCode=_strings(fields, 132764),
        )
    elif template == LAST_TRADE:
        base.update(
            type="trade",
            symbol=_first_string(fields, 110100),
            exchange=_first_string(fields, 110101),
            price=_first_double(fields, 100006),
            size=_first_varint(fields, 159008) or _first_varint(fields, 100178),
            aggressor=_side(_first_varint(fields, 112003)),
            exchangeOrderId=_first_string(fields, 149238),
            aggressorExchangeOrderId=_first_string(fields, 154641),
            snapshot=bool(_first_varint(fields, 110121) or False),
            timeMs=_time_ms(fields),
            sourceTimeNanos=_source_time_nanos(fields),
            presenceBits=_first_varint(fields, 149138),
            clearBits=_first_varint(fields, 154571),
        )
    elif template == BEST_BID_OFFER:
        base.update(
            type="bbo",
            symbol=_first_string(fields, 110100),
            exchange=_first_string(fields, 110101),
            bidPrice=_first_double(fields, 100022),
            bidSize=_first_varint(fields, 159000) or _first_varint(fields, 100030),
            bidOrders=_first_varint(fields, 154403),
            askPrice=_first_double(fields, 100025),
            askSize=_first_varint(fields, 159002) or _first_varint(fields, 100031),
            askOrders=_first_varint(fields, 154404),
            snapshot=bool(_first_varint(fields, 110121) or False),
            timeMs=_time_ms(fields),
            presenceBits=_first_varint(fields, 149138),
            clearBits=_first_varint(fields, 154571),
        )
    elif template == ORDER_BOOK:
        base.update(
            type="order_book",
            symbol=_first_string(fields, 110100),
            exchange=_first_string(fields, 110101),
            updateType={
                1: "clear",
                2: "no_book",
                3: "snapshot",
                4: "begin",
                5: "middle",
                6: "end",
                7: "solo",
            }.get(_first_varint(fields, 157608), "unknown"),
            bids=_levels(
                _doubles(fields, 154282),
                _varints(fields, 159004) or _varints(fields, 154283),
                _varints(fields, 154401),
                _varints(fields, 159005) or _varints(fields, 154412),
            ),
            asks=_levels(
                _doubles(fields, 154284),
                _varints(fields, 159006) or _varints(fields, 154285),
                _varints(fields, 154402),
                _varints(fields, 159007) or _varints(fields, 154415),
            ),
            timeMs=_time_ms(fields),
        )
    elif template == DEPTH_BY_ORDER:
        base.update(
            type="mbo_update",
            symbol=_first_string(fields, 110100),
            exchange=_first_string(fields, 110101),
            sequence=_first_varint(fields, 112002),
            updates=_dbo_rows(fields),
            timeMs=_time_ms(fields),
            sourceTimeNanos=_source_time_nanos(fields),
        )
    elif template == HEARTBEAT_RESPONSE:
        base["type"] = "heartbeat"
    elif template == LOGOUT_RESPONSE:
        base["type"] = "logout"
    elif template == REJECT:
        base["type"] = "reject"
    elif template == FORCED_LOGOUT:
        base["type"] = "forced_logout"
    else:
        base["type"] = "unknown"
    return base
