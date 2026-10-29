from __future__ import annotations

import asyncio
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from app.rithmic.client import RithmicProbeError
from app.backfill.rithmic_sync import history_profile_ranges
from app.rithmic.history_sync import RithmicHistoryConfig, RithmicHistoryService
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
from app.storage.records import BarRecord, VolumeDeltaRecord


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
    assert [row.source for row in m1] == ["rithmic_history"] * 3
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


def _reports(minute: int, count: int = 1):
    bars, profiles = [], []
    for i in range(count):
        marker = minute + (i + 1) * 60
        bars.append({"marker": marker, "open": 2000.0 + i, "high": 2001.0 + i,
                     "low": 1999.0 + i, "close": 2000.5 + i, "volume": 30,
                     "bidVolume": 10, "askVolume": 20})
        profiles.append({"marker": marker, "prices": [2000.0 + i, 2000.1 + i],
                         "bidVolumes": [4, 6], "askVolumes": [8, 12]})
    return bars, profiles


def _bar(time, source="rithmic", volume=1, tf="1m", closed=True, contract="GC"):
    return BarRecord("GC", contract, tf, time, 2000, 2001, 1999, 2000.5, volume, closed, source)


def test_repair_preserves_other_sources_live_candle_and_physical_archives(tmp_path):
    service, cache = _service(tmp_path)
    minute = 1_800_000_000
    at = minute * 1000
    try:
        cache.upsert_bars([
            _bar(at, "bookmap", 999), _bar(at + 60_000, "nt", 888),
            _bar(at + 120_000), _bar(at + 240_000, volume=77, closed=False),
            _bar(at, "bookmap", 999, tf="3m"),
            _bar(at, "rithmic_history", 777, contract="GC 12-26"),
        ])
        cache.upsert_volume_delta(VolumeDeltaRecord("GC", "GC", "1m", at + 60_000,
            888, 888, 0, 888, 888, 0, 0, 888))
        bars, profiles = _reports(minute, 5)
        assert service._persist_chunk(bars, profiles, at + 180_000) == (2, 2)
        rows = {row.time: row for row in cache.read_bars("GC", "GC", "1m")}
        assert rows[at].source == "bookmap" and rows[at].volume == 999
        assert rows[at + 60_000].source == "nt" and rows[at + 60_000].volume == 888
        assert rows[at + 120_000].volume == rows[at + 180_000].volume == 30
        assert rows[at + 240_000].volume == 77 and not rows[at + 240_000].closed
        assert cache.read_volume_delta("GC", "GC", "1m", at + 60_000, at + 60_000)[0].delta == 888
        assert cache.read_bars("GC", "GC", "3m")[0].source == "bookmap"
        assert cache.read_bars("GC", "GC 12-26", "1m")[0].volume == 777
        assert cache.read_bars("GC", "GC", "15s") == cache.read_bars("GC", "GC", "30s") == []
        assert cache.read_alerts(profile_id=None) == []

        # A later full snapshot replaces the ladder, rather than retaining stale levels.
        profile = {**profiles[3], "prices": [2005.0], "bidVolumes": [10], "askVolumes": [20]}
        assert service._persist_chunk([bars[3]], [profile], at + 180_000) == (1, 1)
        levels = cache.read_footprint_levels("GC", "GC", at + 180_000, "1m")
        assert len(levels) == 1 and levels[0].price == 2005.0
        service.config.physical_contract = "GC 02-27"
        assert service._persist_chunk([bars[3]], [profiles[3]], at + 180_000) == (0, 0)
        assert cache.read_footprint_levels("GC", "GC", at + 180_000, "1m")[0].price == 2005.0
    finally:
        cache.close()


def test_audit_fills_an_internal_gap_even_when_recent_cache_exists(tmp_path, monkeypatch):
    service, cache = _service(tmp_path)
    now = 1_800_000_300_000
    last_closed = now // 60_000 * 60_000 - 60_000
    gap = last_closed - 23 * 3_600_000
    monkeypatch.setattr("app.rithmic.history_sync.now_ms", lambda: now)
    cache.upsert_bar(_bar(last_closed - 60_000))
    requests = []

    async def request(ws, start, end):
        requests.append((start, end))
        return _reports(gap // 1000) if start <= gap <= end else ([], [])

    service._request_chunk = request
    try:
        asyncio.run(service._sync_once(object()))
        assert requests[0][0] <= last_closed - 24 * 3_600_000
        assert cache.read_bars("GC", "GC", "1m", gap, gap)[0].volume == 30
        assert service.synchronized
        assert service.status_dict()["highWatermark"] == last_closed
        assert service.status_dict()["pendingRanges"] == []
    finally:
        cache.close()


def test_incomplete_response_never_becomes_success_or_writes_cache(tmp_path):
    service, cache = _service(tmp_path)
    service.config.quiet_seconds = 0.01
    service.config.request_timeout_seconds = 0.02
    websocket = _PagedWebSocket([_history_frame(marker=1_800_000_060)], [])
    try:
        with pytest.raises(RithmicProbeError, match="timed out|terminator"):
            asyncio.run(service._collect(websocket, field_varint(TEMPLATE_ID_FIELD, TIME_BAR_REPLAY_REQUEST), TIME_BAR_REPLAY_RESPONSE, "history-test"))
        assert not service.synchronized
        assert cache.read_bars("GC", "GC", "1m") == []
    finally:
        cache.close()


def test_failed_requests_are_accounted_and_do_not_advance_watermark(tmp_path):
    service, cache = _service(tmp_path)

    async def fail(*args):
        service._downloaded_bytes += 123
        raise RithmicProbeError("replay failed")

    service._request_chunk = fail
    try:
        with pytest.raises(RithmicProbeError):
            asyncio.run(service._sync_once(object()))
        status = service.status_dict()
        assert status["downloadedBytesThisWeek"] == 123
        assert status["lastSuccessAt"] is None and status["highWatermark"] is None
        assert status["pendingRanges"] and not service.synchronized
    finally:
        cache.close()


def test_history_weekly_guard_and_safe_errors(tmp_path):
    service, cache = _service(tmp_path)
    service.config.weekly_byte_limit = 1
    try:
        with pytest.raises(RithmicProbeError, match="weekly byte guard"):
            asyncio.run(service._collect(_PagedWebSocket([_history_frame(marker=1_800_000_060)], []),
                field_varint(TEMPLATE_ID_FIELD, TIME_BAR_REPLAY_REQUEST), TIME_BAR_REPLAY_RESPONSE, "history-test"))
        error = service._safe_reason(ValueError(f"bad {service.config.user} {service.config.password}"))
        assert service.config.user not in error and service.config.password not in error
    finally:
        cache.close()


def test_history_runs_on_start_requests_and_periodic_audit(tmp_path, monkeypatch):
    service, cache = _service(tmp_path)
    service.config.audit_seconds = 0.1
    monkeypatch.setattr("app.rithmic.history_sync.ssl_context_from_archive", lambda path: None)
    service._receive_login = AsyncMock(return_value={"heartbeatInterval": 1})
    calls = []

    async def sync(ws):
        calls.append(ws)
        if len(calls) == 2:
            service._stopping.set()

    service._sync_once = sync

    class Socket:
        replies = 0

        async def send(self, payload):
            pass

        async def recv(self):
            if self.replies < 64:
                self.replies += 1
                return field_varint(TEMPLATE_ID_FIELD, 19)
            await asyncio.Event().wait()

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

    websocket = Socket()
    monkeypatch.setattr("app.rithmic.history_sync.websockets.connect", lambda *args, **kwargs: websocket)

    async def scenario():
        await service._run_connection()

    try:
        asyncio.run(scenario())
        assert len(calls) == 2
        assert websocket.replies > 0
    finally:
        cache.close()


def test_complete_realtime_extrema_survive_audit_and_unknown_volume_is_not_guessed(tmp_path):
    service, cache = _service(tmp_path)
    minute = 1_800_000_000
    at = minute * 1000
    bars, profiles = _reports(minute, 2)
    try:
        cache.upsert_bar(BarRecord("GC", "GC", "1m", at, 2000, 2001, 1999, 2000.5,
                                   30, True, "rithmic"))
        cache.upsert_volume_delta(VolumeDeltaRecord("GC", "GC", "1m", at, 30, 10, 20,
                                                  -10, 7, -17, 5, -10))
        bars[1]["volume"] = 32  # Two contracts have no exchange aggressor side.
        assert service._persist_chunk(bars, profiles, at + 60_000) == (2, 2)
        first = cache.read_volume_delta("GC", "GC", "1m", at, at)[0]
        assert (first.delta_high, first.delta_low, first.open_delta) == (7, -17, 5)
        second = cache.read_volume_delta("GC", "GC", "1m", at + 60_000, at + 60_000)[0]
        assert second.buy_volume + second.sell_volume == 30 and second.volume == 32
        with cache.reader() as conn:
            quality = conn.execute("SELECT unknown_volume FROM footprint_history_quality "
                                   "WHERE contract='GC' AND timeframe='1m' AND time=?", (at + 60_000,)).fetchone()
        assert quality[0] == 2
    finally:
        cache.close()


def test_profile_audit_reuses_complete_ladders_and_repairs_internal_damage(tmp_path):
    service, cache = _service(tmp_path)
    minute = 1_800_000_000
    start, end = minute * 1000, (minute + 9 * 60) * 1000 + 59_999
    bars, profiles = _reports(minute, 10)

    def ranges(refresh_since=end + 1):
        return history_profile_ranges(cache, "GC 12-26", "GC", bars, start, end, refresh_since)

    try:
        assert ranges() == [(start, end)]
        service._persist_chunk(bars, profiles, end)
        assert ranges() == []
        # A header can survive even when some ladder levels were lost.
        gap = start + 3 * 60_000
        cache.writer.execute("DELETE FROM footprint_levels WHERE contract='GC' AND timeframe='1m' AND time=? AND price=?",
                             (gap, profiles[3]["prices"][0]))
        assert ranges() == [(gap, gap + 59_999)]
        service._persist_chunk(bars, profiles, end)
        assert ranges() == []
        # Provider revisions must invalidate the saved checksum.
        bars[2]["bidVolume"], bars[2]["askVolume"] = 11, 19
        revised = start + 2 * 60_000
        assert ranges() == [(revised, revised + 59_999)]
        bars[2]["bidVolume"], bars[2]["askVolume"] = 10, 20
        assert ranges(start + 8 * 60_000) == [(start + 8 * 60_000, end)]
        # Another feed's rows do not cause profile downloads.
        cache.writer.execute("UPDATE bars SET source='bookmap' WHERE timeframe='1m' AND time=?", (start,))
        cache.writer.execute("DELETE FROM footprint_levels WHERE timeframe='1m' AND time=?", (start,))
        assert ranges() == []
    finally:
        cache.close()
