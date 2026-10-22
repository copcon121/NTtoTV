"""Rithmic History Plant synchronization for bars and order flow.

The worker intentionally requests only time bars and minute volume profiles.
It never downloads or stores historical raw ticks or depth.  A two-minute
overlap makes startup and reconnect repair idempotent while the cache's keyed
upserts make the last complete History Plant response authoritative.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import time
import uuid
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol

import websockets

from ..config import Settings
from ..engines.bar_aggregator import SUPPORTED_TFS
from ..engines.footprint_engine import FootprintEngine
from ..engines.session_calendar import TF_MS, timeframe_bucket_start
from ..models.timestamp import now_ms
from ..storage.cache_store import CacheStore
from ..storage.records import (
    BarRecord,
    FootprintBarRecord,
    FootprintLevelRecord,
    VolumeDeltaRecord,
)
from .client import RithmicProbeError, ssl_context_from_archive
from .protocol import (
    FORCED_LOGOUT,
    HEARTBEAT_RESPONSE,
    LOGIN_RESPONSE,
    REJECT,
    RESUME_BARS_RESPONSE,
    TIME_BAR_REPLAY_RESPONSE,
    VOLUME_PROFILE_MINUTE_BARS_RESPONSE,
    build_heartbeat_request,
    build_login_request,
    build_logout_request,
    build_resume_bars_request,
    build_time_bar_replay_request,
    build_volume_profile_minute_bars_request,
    decode_message,
)

logger = logging.getLogger(__name__)

_MINUTE_MS = 60_000
_DAY_MS = 24 * 60 * _MINUTE_MS
_OVERLAP_MS = 2 * _MINUTE_MS


class RithmicHistorySink(Protocol):
    async def on_rithmic_history_status(self, status: dict[str, Any]) -> None: ...


@dataclass(slots=True)
class RithmicHistoryConfig:
    uri: str
    archive_path: Path
    user: str = field(repr=False)
    password: str = field(repr=False)
    system_name: str
    app_name: str
    app_version: str
    exchange: str
    wire_symbol: str
    physical_contract: str
    template_version: str = "5.55"
    user_message: str = "nttotv-probe"
    mac_addresses: tuple[str, ...] = ("B5:8F:D4:CC:FE:11",)
    os_platform: str = "linux"
    os_version: str = "10.0.17763"
    logical_symbol: str = "GC"
    audit_seconds: int = 300
    initial_lookback_days: int = 30
    connect_timeout_seconds: float = 15.0
    request_timeout_seconds: float = 120.0
    quiet_seconds: float = 2.0
    reconnect_min_seconds: float = 1.0
    reconnect_max_seconds: float = 30.0
    weekly_byte_limit: int = 38_000_000_000

    @classmethod
    def from_settings(cls, settings: Settings) -> "RithmicHistoryConfig":
        return cls(
            uri=settings.rithmic_uri,
            archive_path=settings.rithmic_archive_path,
            user=settings.rithmic_user or "",
            password=settings.rithmic_password or "",
            system_name=settings.rithmic_system_name,
            app_name=settings.rithmic_app_name,
            app_version=settings.rithmic_app_version,
            template_version=settings.rithmic_template_version,
            user_message=settings.rithmic_user_message,
            mac_addresses=settings.rithmic_mac_addresses,
            os_platform=settings.rithmic_os_platform,
            os_version=settings.rithmic_os_version,
            exchange=settings.rithmic_exchange,
            wire_symbol=settings.rithmic_symbol,
            physical_contract=settings.rithmic_contract,
            logical_symbol=settings.supported_symbols[0],
            audit_seconds=settings.rithmic_history_audit_s,
            initial_lookback_days=settings.rithmic_history_initial_lookback_days,
            connect_timeout_seconds=settings.rithmic_connect_timeout_s,
            request_timeout_seconds=settings.rithmic_history_request_timeout_s,
            quiet_seconds=settings.rithmic_history_quiet_s,
            reconnect_min_seconds=settings.rithmic_reconnect_min_s,
            reconnect_max_seconds=settings.rithmic_reconnect_max_s,
            weekly_byte_limit=settings.rithmic_history_weekly_byte_limit,
        )

    def validate(self) -> None:
        if not self.uri.startswith("wss://"):
            raise ValueError("Rithmic History Plant requires a wss:// endpoint")
        if not self.user or not self.password:
            raise ValueError("Rithmic History Plant credentials are not configured")
        if self.audit_seconds < 30:
            raise ValueError("history audit interval must be at least 30 seconds")
        if self.initial_lookback_days < 1:
            raise ValueError("history lookback must be positive")
        if self.weekly_byte_limit < 1:
            raise ValueError("history weekly byte limit must be positive")


@dataclass(slots=True)
class HistorySyncStatus:
    state: str = "stopped"
    connected: bool = False
    high_watermark: int | None = None
    pending_ranges: list[list[int]] = field(default_factory=list)
    last_success_at: int | None = None
    last_error: str | None = None
    downloaded_bytes_this_week: int = 0
    week: str | None = None
    bars_written: int = 0
    footprints_written: int = 0
    reconnects: int = 0

    def to_dict(self) -> dict[str, Any]:
        out = asdict(self)
        return {
            "state": out["state"],
            "connected": out["connected"],
            "highWatermark": out["high_watermark"],
            "pendingRanges": out["pending_ranges"],
            "lastSuccessAt": out["last_success_at"],
            "lastError": out["last_error"],
            "downloadedBytesThisWeek": out["downloaded_bytes_this_week"],
            "week": out["week"],
            "barsWritten": out["bars_written"],
            "footprintsWritten": out["footprints_written"],
            "reconnects": out["reconnects"],
        }


class RithmicHistoryService:
    def __init__(
        self,
        config: RithmicHistoryConfig,
        cache: CacheStore,
        sink: RithmicHistorySink,
    ) -> None:
        self.config = config
        self.cache = cache
        self.sink = sink
        self._task: asyncio.Task[None] | None = None
        self._stopping = asyncio.Event()
        self._sync_requested = asyncio.Event()
        self._status = HistorySyncStatus()
        self._downloaded_bytes = 0

    @classmethod
    def from_settings(
        cls, settings: Settings, cache: CacheStore, sink: RithmicHistorySink
    ) -> "RithmicHistoryService":
        return cls(RithmicHistoryConfig.from_settings(settings), cache, sink)

    @property
    def running(self) -> bool:
        return self._task is not None and not self._task.done()

    @property
    def synchronized(self) -> bool:
        return self._status.state == "synced" and not self._status.pending_ranges

    def status_dict(self) -> dict[str, Any]:
        return self._status.to_dict()

    async def start(self) -> None:
        if self.running:
            return
        try:
            self.config.validate()
            ssl_context_from_archive(self.config.archive_path)
        except Exception as exc:
            self._status.connected = False
            self._status.state = "error"
            self._status.last_error = self._safe_reason(exc)
            await self._publish_status()
            logger.error("Rithmic History Plant is not configured: %s", exc)
            return
        self._stopping.clear()
        self._sync_requested.set()
        self._task = asyncio.create_task(self.run(), name="rithmic-history")

    async def stop(self) -> None:
        self._stopping.set()
        self._sync_requested.set()
        task = self._task
        self._task = None
        if task is not None:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
        self._status.connected = False
        self._status.state = "stopped"
        await self._publish_status()

    def request_sync(self) -> None:
        self._sync_requested.set()

    async def run(self) -> None:
        delay = self.config.reconnect_min_seconds
        while not self._stopping.is_set():
            self._status.state = "connecting"
            await self._publish_status()
            try:
                await self._run_connection()
                delay = self.config.reconnect_min_seconds
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                self._status.connected = False
                self._status.state = "error"
                self._status.last_error = self._safe_reason(exc)
                logger.warning("Rithmic History Plant connection ended: %s", exc)
                await self._publish_status()
            if self._stopping.is_set():
                break
            self._status.reconnects += 1
            try:
                await asyncio.wait_for(self._stopping.wait(), timeout=delay)
            except asyncio.TimeoutError:
                pass
            delay = min(self.config.reconnect_max_seconds, delay * 2)

    async def _run_connection(self) -> None:
        ssl_context = ssl_context_from_archive(self.config.archive_path)
        async with websockets.connect(
            self.config.uri,
            ssl=ssl_context,
            ping_interval=3,
            open_timeout=self.config.connect_timeout_seconds,
            close_timeout=3,
            max_size=16 * 1024 * 1024,
        ) as websocket:
            await websocket.send(
                build_login_request(
                    user=self.config.user,
                    password=self.config.password,
                    app_name=self.config.app_name,
                    app_version=self.config.app_version,
                    system_name=self.config.system_name,
                    mac_addresses=self.config.mac_addresses,
                    os_version=self.config.os_version,
                    os_platform=self.config.os_platform,
                    template_version=self.config.template_version,
                    user_message=self.config.user_message,
                    infra_type=3,
                )
            )
            login = await self._receive_login(websocket)
            heartbeat_interval = max(
                1.0, float(login.get("heartbeatInterval") or 3.0)
            )
            heartbeat = asyncio.create_task(
                self._heartbeat_loop(websocket, heartbeat_interval),
                name="rithmic-history-heartbeat",
            )
            self._status.connected = True
            self._status.last_error = None
            await self._publish_status()
            try:
                while not self._stopping.is_set():
                    try:
                        await asyncio.wait_for(
                            self._sync_requested.wait(),
                            timeout=self.config.audit_seconds,
                        )
                    except asyncio.TimeoutError:
                        pass
                    self._sync_requested.clear()
                    if self._stopping.is_set():
                        break
                    await self._sync_once(websocket)
            finally:
                self._status.connected = False
                heartbeat.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await heartbeat
                with contextlib.suppress(Exception):
                    await websocket.send(build_logout_request())

    async def _receive_login(self, websocket: Any) -> dict[str, Any]:
        deadline = time.monotonic() + self.config.connect_timeout_seconds
        while time.monotonic() < deadline:
            frame = await asyncio.wait_for(
                websocket.recv(), timeout=max(0.1, deadline - time.monotonic())
            )
            if not isinstance(frame, bytes):
                continue
            self._downloaded_bytes += len(frame)
            message = decode_message(frame)
            if message["templateId"] in {LOGIN_RESPONSE, REJECT, FORCED_LOGOUT}:
                if message.get("type") != "login" or not message.get("ok"):
                    raise RithmicProbeError(
                        "History Plant login rejected "
                        f"rpCode={message.get('rpCode', ['unknown'])}"
                    )
                return message
        raise RithmicProbeError("timed out waiting for History Plant login")

    async def _sync_once(self, websocket: Any) -> None:
        week = datetime.now(timezone.utc).strftime("%G-W%V")
        if self._status.week != week:
            stored = await asyncio.to_thread(
                self.cache.get_metadata, f"rithmic_history_bytes:{week}"
            )
            self._status.week = week
            self._status.downloaded_bytes_this_week = int(stored or 0)
        if (
            self._status.downloaded_bytes_this_week
            >= self.config.weekly_byte_limit
        ):
            raise RithmicProbeError("History Plant weekly byte guard reached")

        last_closed = (now_ms() // _MINUTE_MS) * _MINUTE_MS - _MINUTE_MS
        latest = await asyncio.to_thread(
            self.cache.read_bars,
            self.config.logical_symbol,
            self.config.logical_symbol,
            "1m",
            None,
            last_closed,
            10,
        )
        latest_closed = next((bar for bar in reversed(latest) if bar.closed), None)
        if latest_closed is not None:
            # Re-request a small overlap for an ordinary catch-up and audit the
            # complete trailing 24 hours for silent/internal gaps.
            start = max(
                0,
                min(
                    latest_closed.time - _OVERLAP_MS,
                    last_closed - _DAY_MS,
                ),
            )
        else:
            start = max(
                0,
                last_closed
                - self.config.initial_lookback_days * _DAY_MS
                - _OVERLAP_MS,
            )
        if start > last_closed:
            start = last_closed

        self._status.state = "syncing"
        self._status.pending_ranges = [[start, last_closed]]
        await self._publish_status()
        total_bars = 0
        total_footprints = 0
        cursor = start
        while cursor <= last_closed:
            end = min(last_closed, ((cursor // _DAY_MS) + 1) * _DAY_MS - 1)
            before = self._downloaded_bytes
            bars, profiles = await self._request_chunk(websocket, cursor, end)
            written_bars, written_footprints = await asyncio.to_thread(
                self._persist_chunk, bars, profiles, last_closed
            )
            total_bars += written_bars
            total_footprints += written_footprints
            used = max(0, self._downloaded_bytes - before)
            self._status.downloaded_bytes_this_week += used
            await asyncio.to_thread(
                self.cache.set_metadata,
                f"rithmic_history_bytes:{week}",
                str(self._status.downloaded_bytes_this_week),
                now_ms(),
            )
            if (
                self._status.downloaded_bytes_this_week
                >= self.config.weekly_byte_limit
            ):
                raise RithmicProbeError("History Plant weekly byte guard reached")
            cursor = end + 1
            self._status.pending_ranges = (
                [[cursor, last_closed]] if cursor <= last_closed else []
            )
            await self._publish_status()

        self._status.state = "synced"
        self._status.high_watermark = last_closed
        self._status.last_success_at = now_ms()
        self._status.last_error = None
        self._status.bars_written += total_bars
        self._status.footprints_written += total_footprints
        await asyncio.to_thread(
            self.cache.set_metadata,
            f"rithmic_history_high_watermark:{self.config.wire_symbol}",
            str(last_closed),
            self._status.last_success_at,
        )
        await self._publish_status()

    async def _request_chunk(
        self, websocket: Any, start_ms: int, finish_ms: int
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        tag = f"nttotv-time-{uuid.uuid4().hex}"
        time_bars = await self._collect(
            websocket,
            build_time_bar_replay_request(
                symbol=self.config.wire_symbol,
                exchange=self.config.exchange,
                start_seconds=start_ms // 1000,
                finish_seconds=finish_ms // 1000,
                resume_bars=True,
                user_message=tag,
            ),
            TIME_BAR_REPLAY_RESPONSE,
            tag,
        )
        tag = f"nttotv-profile-{uuid.uuid4().hex}"
        profiles = await self._collect(
            websocket,
            build_volume_profile_minute_bars_request(
                symbol=self.config.wire_symbol,
                exchange=self.config.exchange,
                start_seconds=start_ms // 1000,
                finish_seconds=finish_ms // 1000,
                resume_bars=True,
                user_message=tag,
            ),
            VOLUME_PROFILE_MINUTE_BARS_RESPONSE,
            tag,
        )
        return time_bars, profiles

    async def _collect(
        self,
        websocket: Any,
        payload: bytes,
        expected_template: int,
        tag: str,
    ) -> list[dict[str, Any]]:
        await websocket.send(payload)
        rows: list[dict[str, Any]] = []
        received_expected = False
        request_key: str | None = None
        resume_count = 0
        accepted_tags = {tag}
        deadline = time.monotonic() + self.config.request_timeout_seconds
        while time.monotonic() < deadline:
            timeout = min(
                max(0.1, deadline - time.monotonic()),
                self.config.quiet_seconds if received_expected else 15.0,
            )
            try:
                frame = await asyncio.wait_for(websocket.recv(), timeout=timeout)
            except asyncio.TimeoutError:
                if received_expected and request_key and resume_count < 100:
                    resume_count += 1
                    resume_tag = f"{tag}-resume-{resume_count}"
                    accepted_tags.add(resume_tag)
                    await websocket.send(
                        build_resume_bars_request(
                            request_key=request_key,
                            user_message=resume_tag,
                        )
                    )
                    received_expected = False
                    deadline = time.monotonic() + self.config.request_timeout_seconds
                    continue
                if received_expected:
                    return rows
                continue
            if not isinstance(frame, bytes):
                continue
            self._downloaded_bytes += len(frame)
            message = decode_message(frame)
            template = int(message["templateId"])
            if template == HEARTBEAT_RESPONSE:
                continue
            if template in {REJECT, FORCED_LOGOUT}:
                raise RithmicProbeError(
                    f"History Plant rejected request rpCode={message.get('rpCode')}"
                )
            if template == RESUME_BARS_RESPONSE:
                rp_codes = [str(value) for value in message.get("rpCode", [])]
                if rp_codes and rp_codes != ["0"]:
                    raise RithmicProbeError(
                        f"History Plant resume failed rpCode={rp_codes}"
                    )
                received_expected = True
                deadline = time.monotonic() + self.config.request_timeout_seconds
                continue
            if template != expected_template:
                continue
            tags = [str(value) for value in message.get("userMessages", [])]
            if tags and accepted_tags.isdisjoint(tags):
                continue
            received_expected = True
            deadline = time.monotonic() + self.config.request_timeout_seconds
            if message.get("requestKey"):
                request_key = str(message["requestKey"])
            handler_codes = [
                str(value) for value in message.get("requestHandlerCode", [])
            ]
            rp_codes = [str(value) for value in message.get("rpCode", [])]
            if handler_codes and handler_codes != ["0"]:
                raise RithmicProbeError(
                    f"History Plant request handler failed rpCode={handler_codes}"
                )
            if rp_codes and rp_codes != ["0"]:
                raise RithmicProbeError(
                    f"History Plant request failed rpCode={rp_codes}"
                )
            if message.get("marker") is not None:
                rows.append(message)
            # Rithmic terminates an N-row response with an N+1 message whose
            # handler code is empty and whose final rpCode is present.
            if not handler_codes and rp_codes:
                return rows
        if received_expected:
            return rows
        raise RithmicProbeError("timed out waiting for History Plant response")

    def _persist_chunk(
        self,
        time_messages: list[dict[str, Any]],
        profile_messages: list[dict[str, Any]],
        last_closed: int,
    ) -> tuple[int, int]:
        profiles = {
            int(message["marker"]) * 1000 - _MINUTE_MS: message
            for message in profile_messages
            if message.get("marker") is not None
        }
        bars: list[BarRecord] = []
        deltas: list[VolumeDeltaRecord] = []
        footprint_bars: list[FootprintBarRecord] = []
        footprint_levels: list[FootprintLevelRecord] = []
        footprint_engine = FootprintEngine()

        for message in sorted(
            time_messages, key=lambda item: int(item.get("marker") or 0)
        ):
            marker = message.get("marker")
            prices = (message.get("open"), message.get("high"), message.get("low"), message.get("close"))
            if marker is None or any(value is None for value in prices):
                continue
            # Rithmic minute-history markers identify the bar close.  NTtoTV
            # cache keys identify the bar open, matching the realtime engines.
            bar_time = int(marker) * 1000 - _MINUTE_MS
            if bar_time > last_closed:
                continue
            profile = profiles.get(bar_time, {})
            volume = int(message.get("volume") or profile.get("volume") or 0)
            buy_volume = int(
                message.get("bidVolume") or profile.get("bidVolume") or 0
            )
            sell_volume = int(
                message.get("askVolume") or profile.get("askVolume") or 0
            )
            delta = buy_volume - sell_volume
            bars.append(
                BarRecord(
                    symbol=self.config.logical_symbol,
                    contract=self.config.logical_symbol,
                    timeframe="1m",
                    time=bar_time,
                    open=float(message["open"]),
                    high=float(message["high"]),
                    low=float(message["low"]),
                    close=float(message["close"]),
                    volume=volume,
                    closed=True,
                    source="rithmic-history",
                )
            )
            deltas.append(
                VolumeDeltaRecord(
                    symbol=self.config.logical_symbol,
                    contract=self.config.logical_symbol,
                    timeframe="1m",
                    time=bar_time,
                    volume=volume,
                    buy_volume=buy_volume,
                    sell_volume=sell_volume,
                    delta=delta,
                    delta_high=max(0, delta),
                    delta_low=min(0, delta),
                    open_delta=0,
                    close_delta=delta,
                )
            )
            ladder = self._profile_ladder(profile)
            if not ladder:
                continue
            footprint_engine.seed_bar(
                self.config.logical_symbol,
                symbol=self.config.logical_symbol,
                time=bar_time,
                open=float(message["open"]),
                high=float(message["high"]),
                low=float(message["low"]),
                close=float(message["close"]),
                rows=ladder,
            )
            update = footprint_engine.current_update(self.config.logical_symbol)
            if update is None:
                continue
            footprint_bars.append(
                FootprintBarRecord(
                    symbol=update.symbol,
                    contract=update.contract,
                    timeframe=update.tf,
                    time=update.time,
                    poc=update.poc,
                    bar_delta=update.bar_delta,
                    buy_pct=update.buy_pct,
                    sell_pct=update.sell_pct,
                    unfinished_high=update.unfinished_auction.high,
                    unfinished_low=update.unfinished_auction.low,
                    open_price=update.open,
                    high_price=update.high,
                    low_price=update.low,
                    close_price=update.close,
                    poc_volume=update.poc_volume,
                    vah=update.vah,
                    val=update.val,
                )
            )
            footprint_levels.extend(
                FootprintLevelRecord(
                    symbol=update.symbol,
                    contract=update.contract,
                    timeframe=update.tf,
                    time=update.time,
                    price=row.price,
                    bid_volume=row.bid,
                    ask_volume=row.ask,
                    imbalance=row.imbalance,
                )
                for row in update.rows
            )

        self.cache.upsert_derived_batch(
            bars=bars,
            volume_deltas=deltas,
            footprint_bars=footprint_bars,
            footprint_levels=footprint_levels,
            replace_footprint_levels=True,
        )
        if bars:
            self._rebuild_rollups(bars[0].time, bars[-1].time, last_closed)
        return len(bars), len(footprint_bars)

    @staticmethod
    def _profile_ladder(message: dict[str, Any]) -> list[tuple[float, int, int]]:
        prices = list(message.get("prices") or [])
        # History Plant names these arrays by aggressor side.  A bid
        # aggressor is a buy lifting the offer, while an ask aggressor is a
        # sell hitting the bid.  FootprintEngine rows use (bid/sell, ask/buy).
        buy_volumes = list(message.get("bidVolumes") or [])
        sell_volumes = list(message.get("askVolumes") or [])
        return [
            (
                float(price),
                int(sell_volumes[index]) if index < len(sell_volumes) else 0,
                int(buy_volumes[index]) if index < len(buy_volumes) else 0,
            )
            for index, price in enumerate(prices)
            if (index < len(buy_volumes) and int(buy_volumes[index]) > 0)
            or (index < len(sell_volumes) and int(sell_volumes[index]) > 0)
        ]

    def _rebuild_rollups(self, start: int, end: int, last_closed: int) -> None:
        rolled_bars: list[BarRecord] = []
        rolled_deltas: list[VolumeDeltaRecord] = []
        for timeframe in SUPPORTED_TFS:
            if timeframe in {"15s", "1m"}:
                continue
            interval = TF_MS[timeframe]
            range_start = timeframe_bucket_start(start, timeframe)
            range_end = timeframe_bucket_start(end, timeframe) + interval - 1
            minute_bars = self.cache.read_bars(
                self.config.logical_symbol,
                self.config.logical_symbol,
                "1m",
                range_start,
                range_end,
            )
            minute_deltas = {
                row.time: row
                for row in self.cache.read_volume_delta(
                    self.config.logical_symbol,
                    self.config.logical_symbol,
                    "1m",
                    range_start,
                    range_end,
                )
            }
            grouped: dict[int, list[BarRecord]] = defaultdict(list)
            for bar in minute_bars:
                grouped[timeframe_bucket_start(bar.time, timeframe)].append(bar)
            for bucket, rows in sorted(grouped.items()):
                rows.sort(key=lambda row: row.time)
                rolled_bars.append(
                    BarRecord(
                        symbol=self.config.logical_symbol,
                        contract=self.config.logical_symbol,
                        timeframe=timeframe,
                        time=bucket,
                        open=rows[0].open,
                        high=max(row.high for row in rows),
                        low=min(row.low for row in rows),
                        close=rows[-1].close,
                        volume=sum(row.volume for row in rows),
                        closed=(bucket + interval - _MINUTE_MS <= last_closed),
                        source="rithmic-history",
                    )
                )
                delta_rows = [minute_deltas[row.time] for row in rows if row.time in minute_deltas]
                if not delta_rows:
                    continue
                cumulative = 0
                delta_high = 0
                delta_low = 0
                for row in delta_rows:
                    cumulative += row.delta
                    delta_high = max(delta_high, cumulative)
                    delta_low = min(delta_low, cumulative)
                rolled_deltas.append(
                    VolumeDeltaRecord(
                        symbol=self.config.logical_symbol,
                        contract=self.config.logical_symbol,
                        timeframe=timeframe,
                        time=bucket,
                        volume=sum(row.volume for row in delta_rows),
                        buy_volume=sum(row.buy_volume for row in delta_rows),
                        sell_volume=sum(row.sell_volume for row in delta_rows),
                        delta=cumulative,
                        delta_high=delta_high,
                        delta_low=delta_low,
                        open_delta=0,
                        close_delta=cumulative,
                    )
                )
        self.cache.upsert_derived_batch(
            bars=rolled_bars,
            volume_deltas=rolled_deltas,
        )

    async def _heartbeat_loop(self, websocket: Any, interval: float) -> None:
        while not self._stopping.is_set():
            await asyncio.sleep(interval)
            await websocket.send(build_heartbeat_request())

    async def _publish_status(self) -> None:
        await self.sink.on_rithmic_history_status(self.status_dict())

    @staticmethod
    def _safe_reason(exc: Exception) -> str:
        text = str(exc).replace("\r", " ").replace("\n", " ").strip()
        return text[:500] or exc.__class__.__name__
