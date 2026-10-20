"""Always-on, read-only Rithmic Ticker Plant shadow connector."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import platform
import time
import uuid
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

import websockets
from websockets.exceptions import ConnectionClosed

from ..config import Settings
from ..models.canonical import NormalizedQuote, NormalizedTrade, Side
from ..models.timestamp import now_ms
from .book import RithmicBookState
from .client import RithmicProbeError, ssl_context_from_archive
from .protocol import (
    FORCED_LOGOUT,
    LOGIN_RESPONSE,
    REJECT,
    UPDATE_BBO,
    UPDATE_LAST_TRADE,
    UPDATE_ORDER_BOOK,
    build_dbo_snapshot_request,
    build_dbo_updates_request,
    build_heartbeat_request,
    build_login_request,
    build_logout_request,
    build_market_data_request,
    decode_message,
)

logger = logging.getLogger(__name__)


class RithmicSink(Protocol):
    async def on_rithmic_connect(self, details: dict[str, Any]) -> None: ...

    async def on_rithmic_disconnect(self, reason: str | None = None) -> None: ...

    async def on_rithmic_health(self, details: dict[str, Any]) -> None: ...

    async def on_rithmic_trade(self, trade: NormalizedTrade) -> None: ...

    async def on_rithmic_quote(self, quote: NormalizedQuote) -> None: ...

    async def on_rithmic_depth(
        self, details: dict[str, Any], *, sequence_gap: bool = False
    ) -> None: ...


def _host_mac() -> str:
    value = uuid.getnode()
    return ":".join(f"{(value >> shift) & 0xFF:02X}" for shift in range(40, -1, -8))


@dataclass(slots=True)
class RithmicServiceConfig:
    uri: str
    archive_path: Path
    user: str = field(repr=False)
    password: str = field(repr=False)
    system_name: str
    app_name: str
    app_version: str
    exchange: str
    wire_symbol: str
    contract: str
    logical_symbol: str = "GC"
    modes: frozenset[str] = frozenset({"l1", "l2", "mbo"})
    aggregated_quotes: bool = False
    connect_timeout_s: float = 15.0
    reconnect_min_s: float = 1.0
    reconnect_max_s: float = 30.0

    @classmethod
    def from_settings(cls, settings: Settings) -> "RithmicServiceConfig":
        return cls(
            uri=settings.rithmic_uri,
            archive_path=settings.rithmic_archive_path,
            user=settings.rithmic_user or "",
            password=settings.rithmic_password or "",
            system_name=settings.rithmic_system_name,
            app_name=settings.rithmic_app_name,
            app_version=settings.rithmic_app_version,
            exchange=settings.rithmic_exchange,
            wire_symbol=settings.rithmic_symbol,
            contract=settings.rithmic_contract,
            logical_symbol=settings.supported_symbols[0],
            modes=frozenset(settings.rithmic_modes),
            connect_timeout_s=settings.rithmic_connect_timeout_s,
            reconnect_min_s=settings.rithmic_reconnect_min_s,
            reconnect_max_s=settings.rithmic_reconnect_max_s,
        )

    def validate(self) -> None:
        if not self.uri.startswith("wss://"):
            raise ValueError("Rithmic runtime requires a wss:// endpoint")
        if not self.user or not self.password:
            raise ValueError("Rithmic runtime credentials are not configured")
        invalid = self.modes - {"l1", "l2", "mbo"}
        if invalid or not self.modes:
            raise ValueError(f"invalid Rithmic modes: {sorted(invalid)}")
        if self.reconnect_min_s <= 0 or self.reconnect_max_s < self.reconnect_min_s:
            raise ValueError("invalid Rithmic reconnect interval")


class RithmicMarketDataService:
    """Reconnect a Ticker Plant session and normalize L1 into NTtoTV models.

    The service never constructs or sends an order-entry template.  L2/MBO are
    retained only as current in-memory state and health metrics while the feed
    is shadowed.
    """

    def __init__(self, config: RithmicServiceConfig, sink: RithmicSink) -> None:
        self.config = config
        self.sink = sink
        self.book = RithmicBookState()
        self._task: asyncio.Task[None] | None = None
        self._stopping = asyncio.Event()
        self._counts: Counter[str] = Counter()
        self._subscriptions = {"l1": False, "l2": False, "mbo": False}
        self._trade_sequence = 0
        self._quote_sequence = 0
        self._reconnects = 0
        self._last_bid: float | None = None
        self._last_ask: float | None = None
        self._last_bid_size = 0
        self._last_ask_size = 0
        self._last_health_publish = 0.0
        self._mbo_resync_requested = False

    @classmethod
    def from_settings(
        cls, settings: Settings, sink: RithmicSink
    ) -> "RithmicMarketDataService":
        return cls(RithmicServiceConfig.from_settings(settings), sink)

    @property
    def running(self) -> bool:
        return self._task is not None and not self._task.done()

    async def start(self) -> None:
        if self.running:
            return
        self._stopping.clear()
        self._task = asyncio.create_task(self.run(), name="rithmic-market-data")

    async def stop(self) -> None:
        self._stopping.set()
        task = self._task
        self._task = None
        if task is not None:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

    async def run(self) -> None:
        try:
            self.config.validate()
            # Fail before entering the reconnect loop when the supplied archive
            # cannot provide trust roots; retries cannot repair local config.
            ssl_context_from_archive(self.config.archive_path)
        except Exception as exc:
            reason = self._safe_reason(exc)
            logger.error("Rithmic shadow connector disabled: %s", reason)
            await self.sink.on_rithmic_disconnect(reason)
            return

        delay = self.config.reconnect_min_s
        while not self._stopping.is_set():
            try:
                await self._run_connection()
                delay = self.config.reconnect_min_s
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                reason = self._safe_reason(exc)
                logger.warning("Rithmic shadow connection ended: %s", reason)
                await self.sink.on_rithmic_disconnect(reason)
            if self._stopping.is_set():
                break
            self._reconnects += 1
            try:
                await asyncio.wait_for(self._stopping.wait(), timeout=delay)
            except asyncio.TimeoutError:
                pass
            delay = min(self.config.reconnect_max_s, delay * 2)

    async def _run_connection(self) -> None:
        self.book.reset()
        self._counts.clear()
        self._subscriptions = {"l1": False, "l2": False, "mbo": False}
        self._last_bid = None
        self._last_ask = None
        self._last_bid_size = 0
        self._last_ask_size = 0
        self._mbo_resync_requested = False
        ssl_context = ssl_context_from_archive(self.config.archive_path)

        async with websockets.connect(
            self.config.uri,
            ssl=ssl_context,
            ping_interval=3,
            open_timeout=self.config.connect_timeout_s,
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
                    mac_addresses=(_host_mac(),),
                    os_version=platform.version(),
                    os_platform=platform.system(),
                    aggregated_quotes=self.config.aggregated_quotes,
                )
            )
            login = await self._receive_login(websocket)
            heartbeat_interval = max(1.0, float(login.get("heartbeatInterval") or 3.0))
            await self._subscribe(websocket)
            await self.sink.on_rithmic_connect(self._status_details())

            heartbeat_task = asyncio.create_task(
                self._heartbeat_loop(websocket, heartbeat_interval),
                name="rithmic-heartbeat",
            )
            try:
                while not self._stopping.is_set():
                    frame = await websocket.recv()
                    if not isinstance(frame, bytes):
                        continue
                    message = decode_message(frame)
                    await self._dispatch(message)
                    if self._mbo_resync_requested:
                        self._mbo_resync_requested = False
                        self.book.begin_mbo_snapshot()
                        await websocket.send(
                            build_dbo_snapshot_request(
                                symbol=self.config.wire_symbol,
                                exchange=self.config.exchange,
                            )
                        )
            except ConnectionClosed as exc:
                raise RithmicProbeError(
                    f"websocket closed code={exc.code} reason={exc.reason or 'none'}"
                ) from exc
            finally:
                heartbeat_task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await heartbeat_task
                await self._best_effort_logout(websocket)

    async def _receive_login(self, websocket) -> dict[str, Any]:
        deadline = time.monotonic() + self.config.connect_timeout_s
        while time.monotonic() < deadline:
            remaining = deadline - time.monotonic()
            frame = await asyncio.wait_for(websocket.recv(), timeout=remaining)
            if not isinstance(frame, bytes):
                continue
            message = decode_message(frame)
            if message["templateId"] in {LOGIN_RESPONSE, REJECT, FORCED_LOGOUT}:
                if message.get("type") != "login" or not message.get("ok"):
                    raise RithmicProbeError(
                        f"login rejected rpCode={message.get('rpCode', ['unknown'])}"
                    )
                return message
        raise RithmicProbeError("timed out waiting for Rithmic login response")

    async def _subscribe(self, websocket) -> None:
        update_bits = 0
        if "l1" in self.config.modes:
            update_bits |= UPDATE_LAST_TRADE | UPDATE_BBO
        if "l2" in self.config.modes:
            update_bits |= UPDATE_ORDER_BOOK
        if update_bits:
            await websocket.send(
                build_market_data_request(
                    symbol=self.config.wire_symbol,
                    exchange=self.config.exchange,
                    update_bits=update_bits,
                    subscribe=True,
                )
            )
        if "mbo" in self.config.modes:
            # Subscribe before requesting the image so no numbered update is
            # lost between the snapshot and the live stream.
            await websocket.send(
                build_dbo_updates_request(
                    symbol=self.config.wire_symbol,
                    exchange=self.config.exchange,
                    subscribe=True,
                )
            )
            self.book.begin_mbo_snapshot()
            await websocket.send(
                build_dbo_snapshot_request(
                    symbol=self.config.wire_symbol,
                    exchange=self.config.exchange,
                )
            )

    async def _dispatch(self, message: dict[str, Any]) -> None:
        message_type = str(message.get("type") or "unknown")
        self._counts[message_type] += 1
        if message_type in {"reject", "forced_logout"}:
            raise RithmicProbeError(
                f"server {message_type} rpCode={message.get('rpCode', ['unknown'])}"
            )
        if message_type == "market_data_subscription":
            if not message.get("ok"):
                raise RithmicProbeError(
                    f"market-data entitlement rejected rpCode={message.get('rpCode', ['unknown'])}"
                )
            self._subscriptions["l1"] = "l1" in self.config.modes
            self._subscriptions["l2"] = "l2" in self.config.modes
            await self._publish_health(force=True)
            return
        if message_type == "mbo_subscription":
            if not message.get("ok"):
                raise RithmicProbeError(
                    f"MBO entitlement rejected rpCode={message.get('rpCode', ['unknown'])}"
                )
            self._subscriptions["mbo"] = True
            await self._publish_health(force=True)
            return
        if message_type == "trade":
            if not message.get("snapshot"):
                trade = self._normalize_trade(message)
                if trade is not None:
                    await self.sink.on_rithmic_trade(trade)
        elif message_type == "bbo":
            quote = self._normalize_quote(message)
            if quote is not None:
                await self.sink.on_rithmic_quote(quote)
        elif message_type == "order_book":
            self.book.apply_l2(message)
            await self.sink.on_rithmic_depth(self._status_details())
        elif message_type == "mbo_snapshot":
            self.book.apply_mbo_snapshot(message)
            gap = False
            if "rpCode" in message:
                if message.get("rpCode") != ["0"]:
                    raise RithmicProbeError(
                        f"MBO snapshot rejected rpCode={message.get('rpCode')}"
                    )
                gap = self.book.finish_mbo_snapshot()
                if gap:
                    self._mbo_resync_requested = True
            await self.sink.on_rithmic_depth(
                self._status_details(), sequence_gap=gap
            )
        elif message_type == "mbo_update":
            gap = self.book.apply_mbo_update(message)
            if gap:
                self._mbo_resync_requested = True
            await self.sink.on_rithmic_depth(
                self._status_details(), sequence_gap=gap
            )
        await self._publish_health()

    def _normalize_trade(self, message: dict[str, Any]) -> NormalizedTrade | None:
        price = message.get("price")
        size = message.get("size")
        if price is None or size is None or int(size) <= 0:
            return None
        self._trade_sequence += 1
        source_time_nanos = message.get("sourceTimeNanos")
        event_time = int(
            (int(source_time_nanos) // 1_000_000)
            if source_time_nanos is not None
            else (message.get("timeMs") or now_ms())
        )
        aggressor = message.get("aggressor")
        side = Side.BUY if aggressor == "buy" else Side.SELL if aggressor == "sell" else None
        return NormalizedTrade(
            symbol=self.config.logical_symbol,
            contract=self.config.contract,
            time=event_time,
            price=float(price),
            volume=int(size),
            bid=self._last_bid,
            ask=self._last_ask,
            best_bid=self._last_bid,
            best_ask=self._last_ask,
            sequence=self._trade_sequence,
            source="rithmic",
            source_time_nanos=(
                int(source_time_nanos)
                if source_time_nanos is not None
                else event_time * 1_000_000
            ),
            side=side,
            aggressor_order_id=message.get("aggressorExchangeOrderId"),
            passive_order_id=message.get("exchangeOrderId"),
        )

    def _normalize_quote(self, message: dict[str, Any]) -> NormalizedQuote | None:
        clear_bits = int(message.get("clearBits") or 0)
        presence = message.get("presenceBits")
        if clear_bits & 1:
            self._last_bid = None
            self._last_bid_size = 0
        if clear_bits & 2:
            self._last_ask = None
            self._last_ask_size = 0
        bid = message.get("bidPrice")
        ask = message.get("askPrice")
        bid_present = bid is not None and (presence is None or int(presence) & 1)
        ask_present = ask is not None and (presence is None or int(presence) & 2)
        if bid_present:
            self._last_bid = float(bid)
            self._last_bid_size = int(message.get("bidSize") or 0)
        if ask_present:
            self._last_ask = float(ask)
            self._last_ask_size = int(message.get("askSize") or 0)
        if self._last_bid is None or self._last_ask is None:
            return None
        self._quote_sequence += 1
        return NormalizedQuote(
            symbol=self.config.logical_symbol,
            contract=self.config.contract,
            time=int(message.get("timeMs") or now_ms()),
            bid=self._last_bid,
            ask=self._last_ask,
            bid_size=self._last_bid_size,
            ask_size=self._last_ask_size,
            sequence=self._quote_sequence,
            source="rithmic",
        )

    async def _heartbeat_loop(self, websocket, interval: float) -> None:
        while not self._stopping.is_set():
            await asyncio.sleep(interval)
            await websocket.send(build_heartbeat_request())
            await self._publish_health(force=True)

    async def _publish_health(self, *, force: bool = False) -> None:
        current = time.monotonic()
        if not force and current - self._last_health_publish < 1.0:
            return
        self._last_health_publish = current
        await self.sink.on_rithmic_health(self._status_details())

    def _status_details(self) -> dict[str, Any]:
        return {
            "shadow": True,
            "selectable": False,
            "infraType": "TICKER_PLANT",
            "system": self.config.system_name,
            "exchange": self.config.exchange,
            "wireSymbol": self.config.wire_symbol,
            "contract": self.config.contract,
            "modes": sorted(self.config.modes),
            "subscriptions": dict(self._subscriptions),
            "messageCounts": dict(sorted(self._counts.items())),
            "reconnects": self._reconnects,
            **self.book.metrics(),
        }

    async def _best_effort_logout(self, websocket) -> None:
        if getattr(websocket, "state", None) is None:
            return
        with contextlib.suppress(Exception):
            update_bits = 0
            if "l1" in self.config.modes:
                update_bits |= UPDATE_LAST_TRADE | UPDATE_BBO
            if "l2" in self.config.modes:
                update_bits |= UPDATE_ORDER_BOOK
            if update_bits:
                await websocket.send(
                    build_market_data_request(
                        symbol=self.config.wire_symbol,
                        exchange=self.config.exchange,
                        update_bits=update_bits,
                        subscribe=False,
                    )
                )
            if "mbo" in self.config.modes:
                await websocket.send(
                    build_dbo_updates_request(
                        symbol=self.config.wire_symbol,
                        exchange=self.config.exchange,
                        subscribe=False,
                    )
                )
            await websocket.send(build_logout_request())

    @staticmethod
    def _safe_reason(exc: Exception) -> str:
        # Protocol errors never contain credentials; still bound the value so a
        # remote close reason cannot flood logs or the status endpoint.
        value = str(exc).replace("\r", " ").replace("\n", " ").strip()
        return f"{type(exc).__name__}: {value[:300]}"
