"""Optional native protobuf decoder for large historical downloads.

Fields mirror response_tick_bar_replay.proto in the shipped RProtocolAPI.zip.
The live connector continues using its existing dependency-free wire codec.
"""
from __future__ import annotations

from .protocol import decode_message

try:
    from google.protobuf import descriptor_pb2, descriptor_pool, message_factory
except ImportError:
    _Replay = None
else:
    file = descriptor_pb2.FileDescriptorProto(name="nttotv_history.proto", package="nttotv_history", syntax="proto2")
    message = file.message_type.add(name="TickReplay")
    # id, name, protobuf scalar type, repeated
    for number, name, kind, repeated in (
        (154467, "template_id", 5, False),
        (132760, "user_msg", 9, True), (132764, "handler_code", 9, True), (132766, "rp_code", 9, True),
        (110100, "symbol", 9, False), (110101, "exchange", 9, False),
        (119200, "bar_type", 5, False), (119208, "bar_sub_type", 5, False),
        (148162, "type_specifier", 9, False), (119225, "sequences", 9, True),
        (119204, "num_trades", 4, False), (119205, "volume", 4, False),
        (119213, "bid_volume", 4, False), (119214, "ask_volume", 4, False),
        (100019, "open", 1, False), (100021, "close", 1, False),
        (100012, "high", 1, False), (100013, "low", 1, False),
        (119202, "seconds", 5, True), (119203, "micros", 5, True),
    ):
        message.field.add(name=name, number=number, type=kind, label=3 if repeated else 1)
    pool = descriptor_pool.DescriptorPool()
    pool.Add(file)
    _Replay = message_factory.GetMessageClass(pool.FindMessageTypeByName("nttotv_history.TickReplay"))


def decode_history_message(frame: bytes) -> dict:
    if _Replay is None:
        return decode_message(frame)
    reply = _Replay()
    reply.ParseFromString(frame)
    if reply.template_id != 207:
        return decode_message(frame)
    value = lambda key: getattr(reply, key) if reply.HasField(key) else None
    seconds, micros = list(reply.seconds), list(reply.micros)
    result = {
        "templateId": 207, "type": "tick_replay", "symbol": value("symbol"), "exchange": value("exchange"),
        "barType": value("bar_type"), "barSubType": value("bar_sub_type"), "typeSpecifier": value("type_specifier"),
        "sequences": list(reply.sequences), "numTrades": value("num_trades"), "volume": value("volume"),
        "bidVolume": value("bid_volume"), "askVolume": value("ask_volume"),
        "open": value("open"), "close": value("close"), "high": value("high"), "low": value("low"),
        "seconds": seconds, "micros": micros,
        "timeMs": seconds[0] * 1000 + (micros[0] if micros else 0) // 1000 if seconds else None,
    }
    for key, values in (("userMessages", reply.user_msg), ("handlerRpCode", reply.handler_code), ("rpCode", reply.rp_code)):
        if values:
            result[key] = list(values)
    return result
