"""Standalone, read-only Rithmic R|Protocol connectivity client."""

from __future__ import annotations

import asyncio
import contextlib
import os
import platform
import ssl
import time
import uuid
import zipfile
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import websockets
from websockets.exceptions import ConnectionClosed

from .protocol import (
    BEST_BID_OFFER,
    DEPTH_BY_ORDER,
    DBO_SNAPSHOT_RESPONSE,
    FORCED_LOGOUT,
    LAST_TRADE,
    LOGIN_RESPONSE,
    ORDER_BOOK,
    REJECT,
    UPDATE_BBO,
    UPDATE_LAST_TRADE,
    UPDATE_ORDER_BOOK,
    build_dbo_snapshot_request,
    build_dbo_updates_request,
    build_gateway_info_request,
    build_heartbeat_request,
    build_login_request,
    build_logout_request,
    build_market_data_request,
    build_system_info_request,
    decode_message,
)


DEFAULT_URI = "wss://rituz00100.rithmic.com:443"


class RithmicProbeError(RuntimeError):
    """A bounded probe failed before or during market-data subscription."""

    def __init__(self, message: str, *, result: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.result = result


@dataclass(slots=True)
class RithmicLogin:
    user: str = field(repr=False)
    password: str = field(repr=False)
    system_name: str = "Rithmic Test"
    app_name: str = "NTtoTV Rithmic Connector"
    app_version: str = "0.1.0"
    template_version: str = "5.55"
    user_message: str = "nttotv-probe"
    aggregated_quotes: bool = False
    mac_addresses: tuple[str, ...] = ()
    os_version: str = field(default_factory=platform.version)
    os_platform: str = field(default_factory=platform.system)

    @classmethod
    def from_environment(cls) -> "RithmicLogin":
        user = os.getenv("NTTOTV_RITHMIC_USER", "")
        password = os.getenv("NTTOTV_RITHMIC_PASSWORD", "")
        if not password and os.getenv("NTTOTV_RITHMIC_PASSWORD_FILE"):
            try:
                password = Path(os.environ["NTTOTV_RITHMIC_PASSWORD_FILE"]).read_text(
                    encoding="utf-8"
                ).rstrip("\r\n")
            except OSError:
                password = ""
        if not user or not password:
            raise RithmicProbeError(
                "Rithmic user and password/password-file are required"
            )
        return cls(
            user=user,
            password=password,
            system_name=os.getenv("NTTOTV_RITHMIC_SYSTEM", "Rithmic Test"),
            app_name=os.getenv(
                "NTTOTV_RITHMIC_APP_NAME", "NTtoTV Rithmic Connector"
            ),
            app_version=os.getenv("NTTOTV_RITHMIC_APP_VERSION", "0.1.0"),
            template_version=os.getenv("NTTOTV_RITHMIC_TEMPLATE_VERSION", "5.55"),
            user_message=os.getenv("NTTOTV_RITHMIC_USER_MESSAGE", "nttotv-probe"),
            aggregated_quotes=_env_bool("NTTOTV_RITHMIC_AGGREGATED_QUOTES", False),
            mac_addresses=tuple(
                value.strip().upper()
                for value in os.getenv(
                    "NTTOTV_RITHMIC_MAC_ADDRESSES", _host_mac()
                ).split(",")
                if value.strip()
            ),
            os_version=os.getenv("NTTOTV_RITHMIC_OS_VERSION", platform.version()),
            os_platform=os.getenv("NTTOTV_RITHMIC_OS_PLATFORM", platform.system()),
        )


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _host_mac() -> str:
    value = uuid.getnode()
    return ":".join(f"{(value >> shift) & 0xFF:02X}" for shift in range(40, -1, -8))


def ssl_context_from_archive(archive_path: Path) -> ssl.SSLContext:
    """Load the Rithmic CA certificate directly from RProtocolAPI.zip."""

    if not archive_path.is_file():
        raise RithmicProbeError(f"RProtocol archive not found: {archive_path}")
    with zipfile.ZipFile(archive_path) as archive:
        candidates = [
            name
            for name in archive.namelist()
            if name.endswith("/etc/rithmic_ssl_cert_auth_params")
        ]
        if not candidates:
            candidates = [
                name
                for name in archive.namelist()
                if name.endswith("/samples/samples.py/rithmic_ssl_cert_auth_params")
            ]
        if not candidates:
            raise RithmicProbeError("Rithmic TLS certificate is missing from the archive")
        certificate = archive.read(candidates[0]).decode("ascii")
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    context.load_verify_locations(cadata=certificate)
    return context


class RithmicDirectClient:
    """A direct WebSocket client restricted to read-only Ticker Plant calls."""

    def __init__(
        self,
        *,
        uri: str = DEFAULT_URI,
        archive_path: Path,
        timeout_seconds: float = 15.0,
    ) -> None:
        if not uri.startswith("wss://"):
            raise ValueError("the direct probe requires a wss:// endpoint")
        self.uri = uri
        self.archive_path = archive_path
        self.timeout_seconds = timeout_seconds

    async def list_systems(self) -> dict[str, Any]:
        async with self._connect() as websocket:
            await websocket.send(build_system_info_request())
            return await self._receive_expected(websocket, {17})

    async def list_gateways(self, system_name: str) -> dict[str, Any]:
        async with self._connect() as websocket:
            await websocket.send(build_gateway_info_request(system_name))
            return await self._receive_expected(websocket, {21})

    async def probe_plant_logins(self, login: RithmicLogin) -> dict[str, Any]:
        """Verify Ticker and History Plant entitlements at the same time."""

        async with self._connect() as ticker, self._connect() as history:
            common = {
                "user": login.user,
                "password": login.password,
                "app_name": login.app_name,
                "app_version": login.app_version,
                "template_version": login.template_version,
                "user_message": login.user_message,
                "system_name": login.system_name,
                "mac_addresses": login.mac_addresses,
                "os_version": login.os_version,
                "os_platform": login.os_platform,
            }
            await ticker.send(
                build_login_request(
                    **common,
                    infra_type=1,
                    aggregated_quotes=login.aggregated_quotes,
                )
            )
            await history.send(build_login_request(**common, infra_type=3))
            ticker_response, history_response = await asyncio.gather(
                self._receive_expected(ticker, {LOGIN_RESPONSE, REJECT, FORCED_LOGOUT}),
                self._receive_expected(history, {LOGIN_RESPONSE, REJECT, FORCED_LOGOUT}),
            )
            with contextlib.suppress(Exception):
                await ticker.send(build_logout_request())
            with contextlib.suppress(Exception):
                await history.send(build_logout_request())

        result = {
            "tickerPlant": self._login_probe_result(ticker_response),
            "historyPlant": self._login_probe_result(history_response),
            "appName": login.app_name,
            "appVersion": login.app_version,
            "system": login.system_name,
        }
        if not result["tickerPlant"]["ok"] or not result["historyPlant"]["ok"]:
            raise RithmicProbeError(
                "Rithmic rejected one or more plant logins",
                result=result,
            )
        return result

    async def probe_market_data(
        self,
        *,
        login: RithmicLogin,
        exchange: str,
        symbol: str,
        modes: set[str],
        duration_seconds: float = 15.0,
        sample_limit: int = 12,
    ) -> dict[str, Any]:
        invalid = modes - {"l1", "l2", "mbo"}
        if invalid:
            raise ValueError(f"unsupported market-data modes: {sorted(invalid)}")
        if not modes:
            raise ValueError("at least one of l1, l2, or mbo is required")

        counts: Counter[str] = Counter()
        samples: list[dict[str, Any]] = []
        responses: list[dict[str, Any]] = []
        async with self._connect() as websocket:
            await websocket.send(
                build_login_request(
                    user=login.user,
                    password=login.password,
                    app_name=login.app_name,
                    app_version=login.app_version,
                    system_name=login.system_name,
                    mac_addresses=login.mac_addresses,
                    os_version=login.os_version,
                    os_platform=login.os_platform,
                    aggregated_quotes=login.aggregated_quotes,
                    template_version=login.template_version,
                    user_message=login.user_message,
                )
            )
            login_response = await self._receive_expected(
                websocket, {LOGIN_RESPONSE, REJECT, FORCED_LOGOUT}
            )
            if not login_response.get("ok"):
                raise RithmicProbeError(
                    f"Rithmic login failed: {login_response.get('rpCode', ['unknown error'])}"
                )

            update_bits = 0
            if "l1" in modes:
                update_bits |= UPDATE_LAST_TRADE | UPDATE_BBO
            if "l2" in modes:
                update_bits |= UPDATE_ORDER_BOOK
            if update_bits:
                await websocket.send(
                    build_market_data_request(
                        symbol=symbol,
                        exchange=exchange,
                        update_bits=update_bits,
                        subscribe=True,
                    )
                )
            if "mbo" in modes:
                # Subscribe before requesting the image so sequence-numbered
                # updates cannot be missed between image and live stream.
                await websocket.send(
                    build_dbo_updates_request(
                        symbol=symbol, exchange=exchange, subscribe=True
                    )
                )
                await websocket.send(
                    build_dbo_snapshot_request(symbol=symbol, exchange=exchange)
                )

            started = time.monotonic()
            deadline = started + duration_seconds
            last_traffic = started
            while time.monotonic() < deadline:
                remaining = deadline - time.monotonic()
                try:
                    frame = await asyncio.wait_for(websocket.recv(), timeout=min(3.0, remaining))
                except asyncio.TimeoutError:
                    await websocket.send(build_heartbeat_request())
                    continue
                except ConnectionClosed as exc:
                    responses.append(
                        {
                            "type": "connection_closed",
                            "code": exc.rcvd.code if exc.rcvd else None,
                            "reason": exc.rcvd.reason if exc.rcvd else str(exc),
                        }
                    )
                    break
                if not isinstance(frame, bytes):
                    raise RithmicProbeError("server returned a non-binary websocket frame")
                last_traffic = time.monotonic()
                message = decode_message(frame)
                message_type = str(message["type"])
                counts[message_type] += 1
                if message_type in {
                    "market_data_subscription",
                    "mbo_subscription",
                    "reject",
                    "forced_logout",
                }:
                    responses.append(message)
                if message["templateId"] in {
                    LAST_TRADE,
                    BEST_BID_OFFER,
                    ORDER_BOOK,
                    DEPTH_BY_ORDER,
                    DBO_SNAPSHOT_RESPONSE,
                } and len(samples) < sample_limit:
                    samples.append(message)
                if message_type in {"reject", "forced_logout"}:
                    break

            if update_bits:
                await websocket.send(
                    build_market_data_request(
                        symbol=symbol,
                        exchange=exchange,
                        update_bits=update_bits,
                        subscribe=False,
                    )
                )
            if "mbo" in modes:
                await websocket.send(
                    build_dbo_updates_request(
                        symbol=symbol, exchange=exchange, subscribe=False
                    )
                )
            await websocket.send(build_logout_request())

        return {
            "uri": self.uri,
            "system": login.system_name,
            "appName": login.app_name,
            "appVersion": login.app_version,
            "infraType": "TICKER_PLANT",
            "aggregatedQuotes": login.aggregated_quotes,
            "loginFieldsSent": [
                "user",
                "password",
                "app_name",
                "app_version",
                "system_name",
                "infra_type",
                "mac_addr",
                "os_version",
                "os_platform",
                "aggregated_quotes",
            ],
            "exchange": exchange,
            "symbol": symbol,
            "modes": sorted(modes),
            "durationSeconds": round(time.monotonic() - started, 3),
            "lastTrafficAgeSeconds": round(time.monotonic() - last_traffic, 3),
            "counts": dict(sorted(counts.items())),
            "responses": responses,
            "samples": samples,
        }

    def _connect(self):
        return websockets.connect(
            self.uri,
            ssl=ssl_context_from_archive(self.archive_path),
            ping_interval=3,
            open_timeout=self.timeout_seconds,
            close_timeout=3,
            max_size=16 * 1024 * 1024,
        )

    @staticmethod
    def _login_probe_result(message: dict[str, Any]) -> dict[str, Any]:
        return {
            "ok": bool(message.get("type") == "login" and message.get("ok")),
            "messageType": message.get("type"),
            "rpCode": list(message.get("rpCode") or []),
            "heartbeatInterval": message.get("heartbeatInterval"),
        }

    async def _receive_expected(self, websocket, templates: set[int]) -> dict[str, Any]:
        deadline = time.monotonic() + self.timeout_seconds
        try:
            while time.monotonic() < deadline:
                remaining = deadline - time.monotonic()
                frame = await asyncio.wait_for(websocket.recv(), timeout=remaining)
                if not isinstance(frame, bytes):
                    continue
                message = decode_message(frame)
                if message["templateId"] in templates:
                    return message
        except ConnectionClosed as exc:
            raise RithmicProbeError(
                f"Rithmic closed the connection before templates {sorted(templates)}: {exc}"
            ) from exc
        raise RithmicProbeError(f"timed out waiting for templates {sorted(templates)}")
