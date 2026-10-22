"""Always-on, read-only Rithmic Ticker Plant connector."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import time
import uuid
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone
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
    build_front_month_contract_request,
    build_get_instrument_by_underlying_request,
    build_heartbeat_request,
    build_login_request,
    build_logout_request,
    build_market_data_request,
    build_reference_data_request,
    build_search_symbols_request,
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
        self,
        details: dict[str, Any],
        *,
        sequence_gap: bool = False,
        book_update: dict[str, Any] | None = None,
    ) -> None: ...


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
    template_version: str = "5.55"
    user_message: str = "nttotv-probe"
    mac_addresses: tuple[str, ...] = ("B5:8F:D4:CC:FE:11",)
    os_platform: str = "linux"
    os_version: str = "10.0.17763"
    logical_symbol: str = "GC"
    modes: frozenset[str] = frozenset({"l1", "l2", "mbo"})
    aggregated_quotes: bool = False
    connect_timeout_s: float = 15.0
    reconnect_min_s: float = 1.0
    reconnect_max_s: float = 30.0
    front_month_poll_s: int = 21_600

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
            template_version=settings.rithmic_template_version,
            user_message=settings.rithmic_user_message,
            mac_addresses=settings.rithmic_mac_addresses,
            os_platform=settings.rithmic_os_platform,
            os_version=settings.rithmic_os_version,
            exchange=settings.rithmic_exchange,
            wire_symbol=settings.rithmic_symbol,
            contract=settings.rithmic_contract,
            logical_symbol=settings.supported_symbols[0],
            modes=frozenset(settings.rithmic_modes),
            aggregated_quotes=settings.rithmic_aggregated_quotes,
            connect_timeout_s=settings.rithmic_connect_timeout_s,
            reconnect_min_s=settings.rithmic_reconnect_min_s,
            reconnect_max_s=settings.rithmic_reconnect_max_s,
            front_month_poll_s=settings.rithmic_front_month_poll_s,
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

    The service never constructs or sends an order-entry template. L2/MBO stay
    in memory; only compact liquidity events derived from L2 may be persisted
    when Rithmic owns market-data arbitration.
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
        self._websocket: Any | None = None
        self._option_probe_lock = asyncio.Lock()
        self._option_waiters: dict[str, asyncio.Queue[dict[str, Any]]] = {}
        self._front_month_candidate: str | None = None
        self._front_month_observations = 0
        self._front_month_checked_at: int | None = None
        self._next_front_month_poll = 0.0

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

    async def probe_options(
        self,
        *,
        underlying_symbol: str | None = None,
        exchange: str | None = None,
        max_expiries: int = 3,
        timeout_seconds: float = 8.0,
    ) -> dict[str, Any]:
        """Read a bounded futures-option chain through the live TP session.

        Rithmic Paper permits only one Ticker Plant session for this account, so
        reference requests must share the websocket already carrying futures
        L1/L2/MBO. This method never constructs an order-entry message.
        """

        if max_expiries < 1 or max_expiries > 12:
            raise ValueError("max_expiries must be between 1 and 12")
        if timeout_seconds < 1 or timeout_seconds > 20:
            raise ValueError("timeout_seconds must be between 1 and 20")
        underlying = (underlying_symbol or self.config.wire_symbol).strip().upper()
        target_exchange = (exchange or self.config.exchange).strip().upper()
        if not underlying or not target_exchange:
            raise ValueError("underlying_symbol and exchange are required")

        async with self._option_probe_lock:
            websocket = self._websocket
            if websocket is None:
                raise RithmicProbeError("Rithmic Ticker Plant is not connected")

            initial = await self._request_option_rows(
                websocket,
                underlying_symbol=underlying,
                exchange=target_exchange,
                expiration_date=None,
                timeout_seconds=timeout_seconds,
            )
            diagnostics = [self._option_response_diagnostic(None, initial)]
            instruments = [
                row for row in initial if row.get("type") == "option_instrument"
            ]
            available_expiries = sorted(
                {
                    str(value)
                    for row in initial
                    if row.get("type") == "option_underlying_keys"
                    for value in row.get("expirationDates", [])
                    if value
                }
            )

            requested_expiries: list[str] = []
            if available_expiries:
                today = datetime.now(timezone.utc).strftime("%Y%m%d")
                current_expiries = [
                    value for value in available_expiries if value >= today
                ]
                candidates = current_expiries or available_expiries
                # The furthest key is the regular option expiry tied to the
                # futures contract; nearer keys can be daily/weekly listings
                # with no strikes. Probe the regular chain first.
                requested_expiries = [candidates[-1]]
                requested_expiries.extend(
                    value
                    for value in candidates
                    if value != candidates[-1]
                )
                requested_expiries = requested_expiries[:max_expiries]
                for expiration in requested_expiries:
                    rows = await self._request_option_rows(
                        websocket,
                        underlying_symbol=underlying,
                        exchange=target_exchange,
                        expiration_date=expiration,
                        timeout_seconds=timeout_seconds,
                    )
                    diagnostics.append(
                        self._option_response_diagnostic(expiration, rows)
                    )
                    instruments.extend(
                        row
                        for row in rows
                        if row.get("type") == "option_instrument"
                    )

            search_matches: list[dict[str, Any]] = []
            if not any(row.get("symbol") for row in instruments):
                search_rows = await self._request_symbol_search(
                    websocket,
                    search_text="OG",
                    exchange=target_exchange,
                    product_code="OG",
                    timeout_seconds=timeout_seconds,
                )
                diagnostics.append(
                    self._option_response_diagnostic("symbol-search", search_rows)
                )
                search_matches = [
                    row
                    for row in search_rows
                    if row.get("type") == "symbol_search" and row.get("symbol")
                ]
                expiry_rank = {
                    expiration: index
                    for index, expiration in enumerate(requested_expiries)
                }
                search_matches.sort(
                    key=lambda row: (
                        expiry_rank.get(
                            str(row.get("expirationDate") or ""),
                            len(expiry_rank),
                        ),
                        str(row.get("expirationDate") or ""),
                        str(row.get("symbol") or ""),
                    )
                )
                for match in search_matches[:12]:
                    reference_rows = await self._request_reference_rows(
                        websocket,
                        symbol=str(match["symbol"]),
                        exchange=str(match.get("exchange") or target_exchange),
                        timeout_seconds=timeout_seconds,
                    )
                    diagnostics.append(
                        self._option_response_diagnostic(
                            f"reference:{match['symbol']}", reference_rows
                        )
                    )
                    instruments.extend(
                        row
                        for row in reference_rows
                        if row.get("type") == "reference_data"
                    )

            return self._summarize_options(
                underlying=underlying,
                exchange=target_exchange,
                available_expiries=available_expiries,
                requested_expiries=requested_expiries,
                instruments=instruments,
                diagnostics=diagnostics,
                search_matches=search_matches,
            )

    async def run(self) -> None:
        try:
            self.config.validate()
            # Fail before entering the reconnect loop when the supplied archive
            # cannot provide trust roots; retries cannot repair local config.
            ssl_context_from_archive(self.config.archive_path)
        except Exception as exc:
            reason = self._safe_reason(exc)
            logger.error("Rithmic connector disabled: %s", reason)
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
                logger.warning("Rithmic connection ended: %s", reason)
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
                    mac_addresses=self.config.mac_addresses,
                    os_version=self.config.os_version,
                    os_platform=self.config.os_platform,
                    aggregated_quotes=self.config.aggregated_quotes,
                    template_version=self.config.template_version,
                    user_message=self.config.user_message,
                )
            )
            login = await self._receive_login(websocket)
            heartbeat_interval = max(1.0, float(login.get("heartbeatInterval") or 3.0))
            await self._subscribe(websocket)
            await self._request_front_month(websocket)
            self._websocket = websocket
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
                self._websocket = None
                self._fail_option_waiters("Rithmic Ticker Plant connection ended")
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
        if message_type in {
            "option_underlying_keys",
            "option_instrument",
            "reference_data",
            "symbol_search",
        }:
            self._route_option_response(message)
            await self._publish_health()
            return
        if message_type == "front_month_contract":
            self._observe_front_month(message)
            await self._publish_health(force=True)
            return
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
            book_update = self.book.apply_l2(message)
            await self.sink.on_rithmic_depth(
                self._status_details(), book_update=book_update
            )
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

    async def _request_option_rows(
        self,
        websocket: Any,
        *,
        underlying_symbol: str,
        exchange: str,
        expiration_date: str | None,
        timeout_seconds: float,
    ) -> list[dict[str, Any]]:
        tag = f"nttotv-option-{uuid.uuid4().hex}"
        payload = build_get_instrument_by_underlying_request(
            underlying_symbol=underlying_symbol,
            exchange=exchange,
            expiration_date=expiration_date,
            user_message=tag,
        )
        return await self._send_tagged_reference_request(
            websocket,
            tag=tag,
            payload=payload,
            timeout_seconds=timeout_seconds,
        )

    async def _request_symbol_search(
        self,
        websocket: Any,
        *,
        search_text: str,
        exchange: str,
        product_code: str | None,
        timeout_seconds: float,
    ) -> list[dict[str, Any]]:
        tag = f"nttotv-option-search-{uuid.uuid4().hex}"
        return await self._send_tagged_reference_request(
            websocket,
            tag=tag,
            payload=build_search_symbols_request(
                search_text=search_text,
                exchange=exchange,
                product_code=product_code,
                user_message=tag,
            ),
            timeout_seconds=timeout_seconds,
        )

    async def _request_reference_rows(
        self,
        websocket: Any,
        *,
        symbol: str,
        exchange: str,
        timeout_seconds: float,
    ) -> list[dict[str, Any]]:
        tag = f"nttotv-reference-{uuid.uuid4().hex}"
        return await self._send_tagged_reference_request(
            websocket,
            tag=tag,
            payload=build_reference_data_request(
                symbol=symbol, exchange=exchange, user_message=tag
            ),
            timeout_seconds=timeout_seconds,
        )

    async def _send_tagged_reference_request(
        self,
        websocket: Any,
        *,
        tag: str,
        payload: bytes,
        timeout_seconds: float,
    ) -> list[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self._option_waiters[tag] = queue
        try:
            await websocket.send(payload)
            rows: list[dict[str, Any]] = []
            deadline = time.monotonic() + timeout_seconds
            while time.monotonic() < deadline:
                remaining = deadline - time.monotonic()
                # Once responses start, a quiet second marks the end of this
                # bounded server-side result stream.
                wait_for = min(remaining, 1.0 if rows else timeout_seconds)
                try:
                    row = await asyncio.wait_for(queue.get(), timeout=wait_for)
                except asyncio.TimeoutError:
                    if rows:
                        break
                    raise RithmicProbeError(
                        "timed out waiting for Rithmic option reference data"
                    )
                if row.get("type") == "option_probe_error":
                    raise RithmicProbeError(str(row.get("reason") or "probe failed"))
                rows.append(row)
                rp_codes = [str(value) for value in row.get("rpCode", [])]
                if rp_codes and rp_codes != ["0"]:
                    raise RithmicProbeError(
                        f"option reference request rejected rpCode={rp_codes}"
                    )
            if not rows:
                raise RithmicProbeError(
                    "Rithmic returned no option reference response"
                )
            return rows
        finally:
            self._option_waiters.pop(tag, None)

    def _route_option_response(self, message: dict[str, Any]) -> None:
        tags = [str(value) for value in message.get("userMessages", [])]
        delivered = False
        for tag in tags:
            queue = self._option_waiters.get(tag)
            if queue is not None:
                queue.put_nowait(message)
                delivered = True
        # Some gateways omit user_msg in terminal reference rows. Option probes
        # are serialized, so a single pending waiter is unambiguous.
        if not delivered and len(self._option_waiters) == 1:
            next(iter(self._option_waiters.values())).put_nowait(message)

    def _fail_option_waiters(self, reason: str) -> None:
        for queue in self._option_waiters.values():
            queue.put_nowait({"type": "option_probe_error", "reason": reason})

    @staticmethod
    def _summarize_options(
        *,
        underlying: str,
        exchange: str,
        available_expiries: list[str],
        requested_expiries: list[str],
        instruments: list[dict[str, Any]],
        diagnostics: list[dict[str, Any]],
        search_matches: list[dict[str, Any]],
    ) -> dict[str, Any]:
        unique: dict[tuple[Any, ...], dict[str, Any]] = {}
        for row in instruments:
            if not row.get("symbol") or not row.get("expirationDate"):
                continue
            key = (
                row.get("symbol"),
                row.get("expirationDate"),
                row.get("putCall"),
                row.get("strikePrice"),
            )
            unique[key] = row

        chains: list[dict[str, Any]] = []
        expiries = sorted(
            {
                str(row.get("expirationDate"))
                for row in unique.values()
                if row.get("expirationDate")
            }
        )
        for expiration in expiries:
            rows = [
                row
                for row in unique.values()
                if row.get("expirationDate") == expiration
            ]
            strikes = sorted(
                {
                    float(row["strikePrice"])
                    for row in rows
                    if row.get("strikePrice") is not None
                }
            )
            calls = sum(
                1
                for row in rows
                if str(row.get("putCall") or "").upper().startswith("C")
            )
            puts = sum(
                1
                for row in rows
                if str(row.get("putCall") or "").upper().startswith("P")
            )
            samples = [
                {
                    "symbol": row.get("symbol"),
                    "underlying": row.get("underlyingSymbol"),
                    "productCode": row.get("productCode"),
                    "putCall": row.get("putCall"),
                    "strike": row.get("strikePrice"),
                    "minPriceChange": row.get("minPriceChange"),
                    "singlePointValue": row.get("singlePointValue"),
                }
                for row in sorted(
                    rows,
                    key=lambda item: (
                        float(item.get("strikePrice") or 0),
                        str(item.get("putCall") or ""),
                    ),
                )[:12]
            ]
            chains.append(
                {
                    "expirationDate": expiration,
                    "instrumentCount": len(rows),
                    "callCount": calls,
                    "putCount": puts,
                    "strikeCount": len(strikes),
                    "strikeRange": (
                        [strikes[0], strikes[-1]] if strikes else []
                    ),
                    "strikes": strikes,
                    "samples": samples,
                }
            )

        return {
            "source": "rithmic",
            "infraType": "TICKER_PLANT",
            "readOnly": True,
            "underlying": underlying,
            "exchange": exchange,
            "availableExpiries": available_expiries,
            "requestedExpiries": requested_expiries,
            "instrumentCount": len(unique),
            "chains": chains,
            "searchMatches": {
                "count": len(search_matches),
                "samples": [
                    {
                        "symbol": row.get("symbol"),
                        "productCode": row.get("productCode"),
                        "instrumentType": row.get("instrumentType"),
                        "expirationDate": row.get("expirationDate"),
                    }
                    for row in search_matches[:20]
                ],
            },
            "responseDiagnostics": diagnostics,
        }

    @staticmethod
    def _option_response_diagnostic(
        expiration: str | None, rows: list[dict[str, Any]]
    ) -> dict[str, Any]:
        counts = Counter(str(row.get("type") or "unknown") for row in rows)
        return {
            "expirationDate": expiration,
            "responseCount": len(rows),
            "types": dict(sorted(counts.items())),
            "rpCodes": sorted(
                {
                    str(code)
                    for row in rows
                    for code in row.get("rpCode", [])
                }
            ),
            "requestHandlerCodes": sorted(
                {
                    str(code)
                    for row in rows
                    for code in row.get("requestHandlerCode", [])
                }
            ),
        }

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
            if time.monotonic() >= self._next_front_month_poll:
                await self._request_front_month(websocket)
            await self._publish_health(force=True)

    async def _request_front_month(self, websocket) -> None:
        await websocket.send(
            build_front_month_contract_request(
                symbol=self.config.logical_symbol,
                exchange=self.config.exchange,
            )
        )
        self._next_front_month_poll = (
            time.monotonic() + max(300, self.config.front_month_poll_s)
        )

    def _observe_front_month(self, message: dict[str, Any]) -> None:
        candidate = str(message.get("tradingSymbol") or "").strip()
        if not candidate:
            return
        self._front_month_checked_at = now_ms()
        if candidate == self.config.wire_symbol:
            self._front_month_candidate = None
            self._front_month_observations = 0
            return
        if candidate == self._front_month_candidate:
            self._front_month_observations += 1
        else:
            self._front_month_candidate = candidate
            self._front_month_observations = 1

    async def _publish_health(self, *, force: bool = False) -> None:
        current = time.monotonic()
        if not force and current - self._last_health_publish < 1.0:
            return
        self._last_health_publish = current
        await self.sink.on_rithmic_health(self._status_details())

    def _status_details(self) -> dict[str, Any]:
        roll_pending = None
        if self._front_month_candidate is not None:
            roll_pending = {
                "current": self.config.wire_symbol,
                "candidate": self._front_month_candidate,
                "observations": self._front_month_observations,
                "confirmed": self._front_month_observations >= 2,
                "checkedAt": self._front_month_checked_at,
            }
        return {
            "shadow": False,
            "selectable": True,
            "infraType": "TICKER_PLANT",
            "system": self.config.system_name,
            "exchange": self.config.exchange,
            "wireSymbol": self.config.wire_symbol,
            "contract": self.config.contract,
            "modes": sorted(self.config.modes),
            "subscriptions": dict(self._subscriptions),
            "messageCounts": dict(sorted(self._counts.items())),
            "reconnects": self._reconnects,
            "rollPending": roll_pending,
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
