from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta, timezone

import pytest

from app.backfill.rithmic_history import (
    QUALITY_SCHEMA, HistoryArchive, build_history_footprints, history_print,
    import_history_hour, purge_history_archives, history_lock,
    replace_history_raw_hour,
)
from app.config import Settings
from app.models import NormalizedTrade
from app.rithmic.history import RithmicHistoryClient, RithmicHistoryUnavailable
from app.rithmic.history_codec import decode_history_message
from app.rithmic.protocol import (
    TEMPLATE_ID_FIELD, build_login_request, build_tick_replay_request,
    decode_message, field_double, field_string, field_varint, parse_fields,
)
from app.storage.cache_store import CacheStore
from app.storage.records import BarRecord
from app.storage.tick_store import TickStore


def message(time_us=1_000_900, volume=3, bid=1, ask=2):
    return {"numTrades": 1, "barType": 1, "typeSpecifier": "1",
            "seconds": [time_us // 1_000_000, time_us // 1_000_000],
            "micros": [0, time_us % 1_000_000], "volume": volume,
            "bidVolume": bid, "askVolume": ask, "sequences": ["1", "1"],
            "open": 4200., "high": 4200., "low": 4200., "close": 4200.}


@pytest.mark.unit
def test_replay_preserves_end_microseconds_and_unknown_side_instead_of_guessing():
    row = history_print(message(bid=None, ask=None), start=0, end=3599, ordinal=0)
    assert row["timeUs"] == 1_000_900
    assert row["unknownVolume"] == 3
    assert row["bidVolume"] == row["askVolume"] == 0
    assert row["bidVolumePresent"] is False


@pytest.mark.unit
@pytest.mark.parametrize("patch", [
    {"numTrades": 2}, {"high": 4201}, {"volume": 2},
    {"seconds": [4000, 4000]}, {"micros": [0, 1_000_000]},
])
def test_rejects_aggregates_bad_volumes_and_out_of_range_prints(patch):
    with pytest.raises(ValueError):
        history_print({**message(), **patch}, start=0, end=3599, ordinal=0)


@pytest.mark.unit
def test_history_login_and_replay_are_read_only_and_chronological():
    frame = build_login_request(user="u", password="p", app_name="app", app_version="1",
                                system_name="test", infra_type=3)
    assert parse_fields(frame)[153621] == [(0, 3)]
    with pytest.raises(ValueError):
        build_login_request(user="u", password="p", app_name="a", app_version="1",
                            system_name="test", infra_type=2)
    fields = parse_fields(build_tick_replay_request(symbol="GCZ6", exchange="COMEX", start=100, end=199))
    assert fields[TEMPLATE_ID_FIELD] == [(0, 206)]
    assert fields[148162] == [(2, b"1")]
    assert fields[153003] == [(0, 200)]
    assert fields[149307] == [(0, 1)]
    result = decode_message(b"".join([
        field_varint(TEMPLATE_ID_FIELD, 207), field_varint(119202, 1), field_varint(119202, 2),
        field_varint(119203, 0), field_varint(119203, 1234),
        field_varint(119213, 2), field_varint(119214, 0),
        field_double(100021, 4200), field_string(132764, "0"),
    ]))
    assert result["seconds"] == [1, 2]
    assert result["micros"] == [0, 1234]
    assert result["bidVolume"] == 2 and result["askVolume"] == 0


@pytest.mark.unit
@pytest.mark.parametrize("terminal", [False, True])
def test_native_history_decoder_matches_reference_codec_including_zero_and_absent_fields(terminal):
    fields = [field_varint(TEMPLATE_ID_FIELD, 207), field_string(132760, "history-test")]
    if terminal:
        fields += [field_string(132766, "0")]
    else:
        fields += [field_string(132764, "0"), field_string(110100, "GCZ6"), field_string(110101, "COMEX"),
                   field_varint(119200, 1), field_varint(119208, 1), field_string(148162, "1"),
                   field_string(119225, "12"), field_string(119225, "12"),
                   field_varint(119204, 1), field_varint(119205, 3), field_varint(119213, 0),
                   field_double(100019, 4200.1), field_double(100021, 4200.1),
                   field_double(100012, 4200.1), field_double(100013, 4200.1),
                   field_varint(119202, 1792765800), field_varint(119202, 1792765800),
                   field_varint(119203, 0), field_varint(119203, 1847)]
    frame = b"".join(fields)
    assert decode_history_message(frame) == decode_message(frame)


@pytest.mark.unit
def test_import_keeps_duplicate_prints_but_retries_are_idempotent_and_preserves_chart(tmp_path):
    archive = HistoryArchive(tmp_path / "archive", "GCZ6")
    cache = CacheStore(tmp_path / "app.sqlite")
    cache.writer.executescript(QUALITY_SCHEMA)
    ticks = TickStore(tmp_path / "ticks")
    rows = [history_print(message(), start=0, end=3599, ordinal=i) for i in range(2)]
    rows.append(history_print(message(time_us=40_000_000, bid=None, ask=None), start=0, end=3599, ordinal=2))
    # Logical candles from another physical contract must not get a new ladder.
    cache.upsert_bar(BarRecord("GC", "GC", "1m", 0, 4100, 4100, 4100, 4100, 99, True))
    try:
        archive.write(0, 3599, rows, {"wireSymbol": "GCZ6", "sourceContract": "GC 12-26"})
        assert archive.read(0, 3599) == rows
        for _ in range(2):
            stats = import_history_hour(archive, cache, ticks, rows, contract="GC 12-26", start=0, end=3599)
        assert len(list(ticks.read_range("GC 12-26", 0, 3_599_999, source="rithmic_history"))) == 3
        assert archive.is_complete(0, 3599)
        assert cache.writer.connection.execute("SELECT COUNT(*) FROM footprint_bars WHERE contract='GC 12-26'").fetchone()[0] == 3
        assert cache.writer.connection.execute("SELECT COUNT(*) FROM footprint_bars WHERE contract='GC' AND timeframe='1m'").fetchone()[0] == 0
        assert cache.writer.connection.execute("SELECT open,volume FROM bars WHERE contract='GC' AND timeframe='1m'").fetchone()[:] == (4100, 99)
        quality = cache.writer.connection.execute("SELECT total_volume,classified_volume,unknown_volume FROM footprint_history_quality WHERE contract='GC 12-26' AND timeframe='1m'").fetchone()
        assert quality[:] == (9, 6, 3)
        ladder = cache.read_footprint_levels("GC", "GC 12-26", 0, "1m")
        assert [(cell.bid_volume, cell.ask_volume) for cell in ladder] == [(2, 4)]
        assert stats["unknownVolume"] == 3
    finally:
        cache.close()
        ticks.close()


@pytest.mark.unit
def test_unknown_only_bar_does_not_manufacture_poc_or_delta():
    row = history_print(message(bid=None, ask=None), start=0, end=3599, ordinal=0)
    bars, deltas, headers, levels, quality = build_history_footprints([row], "GC 12-26")
    assert all(b.volume == 3 for b in bars)
    assert all(d.delta == 0 and d.buy_volume == d.sell_volume == 0 for d in deltas)
    assert all(h.poc is None for h in headers)
    assert all(l.bid_volume == l.ask_volume == 0 for l in levels)
    assert all(q[6] == 3 for q in quality)


@pytest.mark.unit
def test_90_day_default_retains_boundary_and_archive_purge_only_removes_expired_raw(tmp_path, monkeypatch):
    monkeypatch.delenv("NTTOTV_TICK_RETENTION_DAYS", raising=False)
    assert Settings().tick_retention_days == 90
    ticks = TickStore(tmp_path / "ticks")
    now = datetime(2026, 10, 24, 12, tzinfo=timezone.utc)
    try:
        for age in (0, 89, 90):
            ms = int((now - timedelta(days=age)).timestamp() * 1000)
            ticks.record_trade(NormalizedTrade("GC", "GC 12-26", ms, 4200., 1, None, None, None, None, age))
        deleted = ticks.purge_expired(now, retention_days=Settings().tick_retention_days)
        assert len(deleted) == 1 and deleted[0].name == "2026-07-26.sqlite"
        assert ticks.shard_path("GC 12-26", (now - timedelta(days=89)).date()).exists()
    finally:
        ticks.close()
    root = tmp_path / "archive"
    symbol = root / "GCZ6"
    symbol.mkdir(parents=True)
    for name in ("1-999.jsonl.gz", "1000-1999.jsonl.gz", "notes.jsonl.gz", "progress.json"):
        (symbol / name).write_text("test")
    assert purge_history_archives(root, 1000) == 1
    assert (symbol / "1000-1999.jsonl.gz").exists()
    assert (symbol / "progress.json").exists()


@pytest.mark.unit
def test_replay_splits_a_capped_response_and_does_not_treat_ack_as_completion(monkeypatch, tmp_path):
    def data(tag, t):
        return b"".join([field_varint(TEMPLATE_ID_FIELD, 207), field_string(132760, tag),
                         field_string(132764, "0"), field_string(110100, "GCZ6"),
                         field_string(110101, "COMEX"), field_varint(119202, t)])
    def done(tag):
        return b"".join([field_varint(TEMPLATE_ID_FIELD, 207), field_string(132760, tag), field_string(132766, "0")])
    class Socket:
        def __init__(self):
            self.frames = []
            self.requests = []
        async def send(self, frame):
            fields = parse_fields(frame)
            if fields[TEMPLATE_ID_FIELD][0][1] != 206:
                return
            tag = fields[132760][0][1].decode()
            start, end = fields[153002][0][1], fields[153003][0][1] - 1
            self.requests.append((start, end))
            times = [start, end] if start != end else [start]
            self.frames.extend([*(data(tag, t) for t in times), done(tag)])
        async def recv(self):
            return self.frames.pop(0)
    async def scenario():
        socket = Socket()
        client = RithmicHistoryClient(archive_path=tmp_path / "unused.zip")
        result = await client.replay(socket, symbol="GCZ6", exchange="COMEX", start=100, end=101, max_count=2)
        assert [r["seconds"][0] for r in result] == [100, 101]
        assert socket.requests == [(100, 101), (100, 100), (101, 101)]
    asyncio.run(scenario())


@pytest.mark.unit
def test_server_unknown_request_is_not_accepted_as_empty_history(tmp_path):
    class Socket:
        async def send(self, frame):
            pass
        async def recv(self):
            return b"".join([
                field_varint(TEMPLATE_ID_FIELD, 207),
                field_string(132760, "history-GCZ6-100-101"),
                field_string(132766, "14"), field_string(132766, "unknown request"),
            ])
    async def scenario():
        client = RithmicHistoryClient(archive_path=tmp_path / "unused.zip")
        with pytest.raises(RithmicHistoryUnavailable) as raised:
            await client.replay(Socket(), symbol="GCZ6", exchange="COMEX", start=100, end=101)
        assert raised.value.code == "14"
    asyncio.run(scenario())


@pytest.mark.unit
def test_only_one_history_downloader_can_own_an_archive(tmp_path):
    with history_lock(tmp_path):
        with pytest.raises(OSError):
            with history_lock(tmp_path):
                pytest.fail("two downloaders acquired the same archive")
    with history_lock(tmp_path):
        pass


@pytest.mark.unit
def test_repairing_partial_history_refreshes_owned_chart_rows_without_duplicate_raw(tmp_path):
    archive = HistoryArchive(tmp_path / "archive", "GCZ6")
    cache = CacheStore(tmp_path / "app.sqlite")
    cache.writer.executescript(QUALITY_SCHEMA)
    ticks = TickStore(tmp_path / "ticks")
    rows = [history_print(message(time_us=1_000_000 + i * 1_000_000), start=0, end=3599, ordinal=i)
            for i in range(3)]
    try:
        import_history_hour(archive, cache, ticks, rows[:1], contract="GC 12-26", start=0, end=3599)
        import_history_hour(archive, cache, ticks, rows, contract="GC 12-26", start=0, end=3599)
        assert len(list(ticks.read_range("GC 12-26", 0, 3599999, source="rithmic_history"))) == 3
        assert cache.writer.connection.execute("SELECT volume FROM bars WHERE contract='GC' AND timeframe='1m'").fetchone()[0] == 9
        assert cache.writer.connection.execute("SELECT total_volume FROM footprint_history_quality WHERE contract='GC' AND timeframe='1m'").fetchone()[0] == 9
        assert cache.writer.connection.execute("SELECT bid_volume,ask_volume FROM footprint_levels WHERE contract='GC' AND timeframe='1m'").fetchone()[:] == (3, 6)
    finally:
        cache.close()
        ticks.close()


@pytest.mark.unit
def test_legacy_provider_capped_hour_is_invalidated(tmp_path):
    archive = HistoryArchive(tmp_path, "GCZ6")
    archive.manifest.write_text(json.dumps({"schema": 1, "chunks": {
        "0": {"end": 3599, "complete": True, "trades": 10000},
        "3600": {"end": 7199, "complete": True, "trades": 9999},
    }}))
    reloaded = HistoryArchive(tmp_path, "GCZ6")
    assert reloaded.state["chunks"]["0"]["complete"] is False
    assert reloaded.state["chunks"]["3600"]["complete"] is False


@pytest.mark.unit
def test_raw_replacement_removes_old_replay_order_without_touching_live_sources(tmp_path):
    ticks = TickStore(tmp_path / "ticks")
    rows = [history_print(message(time_us=1_000_000 + i * 1_000_000), start=0, end=3599, ordinal=i)
            for i in range(3)]
    try:
        for source in ("nt", "rithmic"):
            ticks.record_trade(NormalizedTrade("GC", "GC 12-26", 1000, 4200., 1, None, None, None, None, 1, source=source))
        replace_history_raw_hour(ticks, rows, contract="GC 12-26", start=0, end=3599)
        corrected = [dict(r, ordinal=i) for i, r in enumerate(reversed(rows))]
        replace_history_raw_hour(ticks, corrected, contract="GC 12-26", start=0, end=3599)
        assert len(list(ticks.read_range("GC 12-26", 0, 3599999, source="rithmic_history"))) == 3
        assert len(list(ticks.read_range("GC 12-26", 0, 3599999, source="nt"))) == 1
        assert len(list(ticks.read_range("GC 12-26", 0, 3599999, source="rithmic"))) == 1
    finally:
        ticks.close()


@pytest.mark.unit
def test_replay_honors_silent_10000_server_cap_even_if_caller_requests_more(tmp_path):
    class Socket:
        def __init__(self):
            self.frames = []
            self.requests = []
        async def send(self, frame):
            f = parse_fields(frame)
            if f[TEMPLATE_ID_FIELD][0][1] != 206:
                return
            assert f[154020] == [(0, 10000)]
            tag = f[132760][0][1].decode()
            start, end = f[153002][0][1], f[153003][0][1] - 1
            self.requests.append((start, end))
            n = 10000 if start != end else 7500
            data = b"".join([field_varint(TEMPLATE_ID_FIELD, 207), field_string(132760, tag),
                             field_string(132764, "0"), field_string(110100, "GCZ6"),
                             field_string(110101, "COMEX"), field_varint(119202, start)])
            self.frames.extend([data] * n)
            self.frames.append(b"".join([field_varint(TEMPLATE_ID_FIELD, 207),
                                        field_string(132760, tag), field_string(132766, "0")]))
        async def recv(self):
            return self.frames.pop(0)
    async def scenario():
        socket = Socket()
        client = RithmicHistoryClient(archive_path=tmp_path / "unused.zip")
        rows = await client.replay(socket, symbol="GCZ6", exchange="COMEX", start=100, end=101, max_count=100000)
        assert len(rows) == 15000
        assert socket.requests == [(100, 101), (100, 100), (101, 101)]
    asyncio.run(scenario())
