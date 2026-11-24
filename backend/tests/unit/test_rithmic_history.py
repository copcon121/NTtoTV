from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from app.rithmic.client import RithmicProbeError
from app.rithmic.history import RithmicHistoryConfig, RithmicHistoryService
from app.rithmic.protocol import (
    REJECT,
    RESUME_BARS_REQUEST,
    TEMPLATE_ID_FIELD,
    TIME_BAR_REPLAY_REQUEST,
    TIME_BAR_REPLAY_RESPONSE,
    field_string,
    field_varint,
    template_id,
)
from app.storage.cache_store import CacheStore


class _Sink:
    async def on_rithmic_history_status(self, status: dict) -> None:
        _ = status


def _service(tmp_path: Path) -> tuple[RithmicHistoryService, CacheStore]:
    cache = CacheStore(tmp_path / "app.sqlite")
    service = RithmicHistoryService(
        RithmicHistoryConfig(
            uri="wss://example.test",
            archive_path=tmp_path / "protocol.zip",
            user="user",
            password="secret",
            system_name="Rithmic Test",
            app_name="NTtoTV Rithmic Connector",
            app_version="1.0.0",
            exchange="COMEX",
            wire_symbol="GCZ6",
            physical_contract="GC 12-26",
        ),
        cache,
        _Sink(),
    )
    return service, cache


def test_history_chunk_upserts_bar_delta_footprint_and_rollup(tmp_path: Path) -> None:
    service, cache = _service(tmp_path)
    minute = 1_800_000_000
    messages = []
    profiles = []
    for offset in range(3):
        # History Plant identifies a minute bar by its close timestamp.
        marker = minute + (offset + 1) * 60
        messages.append(
            {
                "marker": marker,
                "open": 2000.0 + offset,
                "high": 2001.0 + offset,
                "low": 1999.0 + offset,
                "close": 2000.5 + offset,
                "volume": 30,
                "bidVolume": 10,
                "askVolume": 20,
            }
        )
        profiles.append(
            {
                "marker": marker,
                "prices": [2000.0 + offset, 2000.1 + offset],
                "bidVolumes": [4, 6],
                "askVolumes": [8, 12],
            }
        )

    bars, footprints = service._persist_chunk(
        messages,
        profiles,
        (minute + 120) * 1000,
    )

    assert bars == 3
    assert footprints == 3
    m1 = cache.read_bars("GC", "GC", "1m")
    assert [row.source for row in m1] == ["rithmic-history"] * 3
    assert [row.volume for row in m1] == [30, 30, 30]
    delta = cache.read_volume_delta("GC", "GC", "1m")
    assert [row.delta for row in delta] == [-10, -10, -10]
    footprint = cache.read_footprint_bars("GC", "GC", "1m")
    assert [row.bar_delta for row in footprint] == [-10, -10, -10]
    assert len(cache.read_footprint_levels("GC", "GC", minute * 1000, "1m")) == 2
    m3 = cache.read_bars("GC", "GC", "3m")
    assert len(m3) == 1
    assert m3[0].volume == 90
    assert m3[0].closed is True
    assert cache.read_volume_delta("GC", "GC", "3m")[0].delta == -30
    cache.close()


def test_profile_ladder_ignores_empty_rows_and_pads_missing_side() -> None:
    assert RithmicHistoryService._profile_ladder(
        {
            "prices": [2000.0, 2000.1, 2000.2],
            "bidVolumes": [0, 4],
            "askVolumes": [0, 0, 7],
        }
    ) == [(2000.1, 0, 4), (2000.2, 7, 0)]


def _history_frame(
    *,
    marker: int | None = None,
    request_key: str = "history-key",
    handler_code: str | None = "0",
    rp_code: str | None = None,
) -> bytes:
    fields = [
        field_varint(TEMPLATE_ID_FIELD, TIME_BAR_REPLAY_RESPONSE),
        field_string(132760, "history-test"),
        field_string(132758, request_key),
    ]
    if handler_code is not None:
        fields.append(field_string(132764, handler_code))
    if rp_code is not None:
        fields.append(field_string(132766, rp_code))
    if marker is not None:
        fields.append(field_varint(119100, marker))
    return b"".join(fields)


class _PagedWebSocket:
    def __init__(self, first: list[bytes], resumed: list[bytes]) -> None:
        self.frames = list(first)
        self.resumed = list(resumed)
        self.sent: list[bytes] = []

    async def send(self, payload: bytes) -> None:
        self.sent.append(payload)
        if template_id(payload) == RESUME_BARS_REQUEST:
            self.frames.extend(self.resumed)
            self.resumed.clear()

    async def recv(self) -> bytes:
        if self.frames:
            return self.frames.pop(0)
        await asyncio.Future()
        raise AssertionError("unreachable")


def test_collect_resumes_partial_history_and_waits_for_terminal(tmp_path: Path) -> None:
    service, cache = _service(tmp_path)
    service.config.quiet_seconds = 0.01
    service.config.request_timeout_seconds = 0.1
    websocket = _PagedWebSocket(
        [_history_frame(marker=1_700_000_000)],
        [
            _history_frame(marker=1_700_000_060),
            _history_frame(handler_code=None, rp_code="0"),
        ],
    )
    try:
        rows = asyncio.run(
            service._collect(
                websocket,
                field_varint(TEMPLATE_ID_FIELD, TIME_BAR_REPLAY_REQUEST),
                TIME_BAR_REPLAY_RESPONSE,
                "history-test",
            )
        )
        assert [row["marker"] for row in rows] == [1_700_000_000, 1_700_000_060]
        assert [template_id(payload) for payload in websocket.sent[1:]] == [
            RESUME_BARS_REQUEST
        ]
    finally:
        cache.close()


def test_collect_surfaces_history_reject_code(tmp_path: Path) -> None:
    service, cache = _service(tmp_path)
    reject = b"".join(
        (
            field_varint(TEMPLATE_ID_FIELD, REJECT),
            field_string(132766, "13"),
        )
    )
    websocket = _PagedWebSocket([reject], [])
    try:
        with pytest.raises(RithmicProbeError, match="13"):
            asyncio.run(
                service._collect(
                    websocket,
                    field_varint(TEMPLATE_ID_FIELD, TIME_BAR_REPLAY_REQUEST),
                    TIME_BAR_REPLAY_RESPONSE,
                    "history-test",
                )
            )
    finally:
        cache.close()
