"""Read-only History Plant replay, using the shipped R|Protocol schemas."""
from __future__ import annotations

import asyncio
import time
from contextlib import asynccontextmanager

from .client import RithmicDirectClient, RithmicLogin, RithmicProbeError
from .history_codec import decode_history_message
from .protocol import (
    build_heartbeat_request, build_login_request, build_logout_request,
    build_tick_replay_request, decode_message,
)


class RithmicHistoryUnavailable(RithmicProbeError):
    """The server accepted login but cannot service the historical request."""

    def __init__(self, code: str):
        self.code = code
        super().__init__(f"History Plant replay failed (code {code})")


class RithmicHistoryClient(RithmicDirectClient):
    """Sequential, correlated requests on a separate read-only History socket."""

    @asynccontextmanager
    async def session(self, login: RithmicLogin):
        async with self._connect() as websocket:
            await websocket.send(build_login_request(
                user=login.user, password=login.password,
                app_name=login.app_name, app_version=login.app_version,
                system_name=login.system_name, mac_addresses=login.mac_addresses,
                os_version=login.os_version, os_platform=login.os_platform,
                infra_type=3,
            ))
            reply = await self._receive_expected(websocket, {11, 75, 77})
            if not reply.get("ok"):
                # Never echo a login frame or server text that might include a user.
                raise RithmicProbeError("History Plant login rejected")
            try:
                yield websocket
            finally:
                try:
                    await websocket.send(build_logout_request())
                except Exception:
                    pass

    async def replay(self, websocket, *, symbol: str, exchange: str,
                     start: int, end: int, max_count: int = 10_000) -> list[dict]:
        """Return ALL one-trade bars for inclusive seconds; split capped replies."""
        # The Paper History Plant silently caps at 10,000 even when a larger
        # user_max_count is requested, and still returns success code 0.
        max_count = min(max_count, 10_000)
        tag = f"history-{symbol}-{start}-{end}"
        await websocket.send(build_tick_replay_request(
            symbol=symbol, exchange=exchange, start=start, end=end,
            user_message=tag, max_count=max_count,
        ))
        records: list[dict] = []
        deadline = time.monotonic() + 180
        heartbeat_at = time.monotonic()
        while time.monotonic() < deadline:
            try:
                frame = await asyncio.wait_for(websocket.recv(), timeout=5)
            except asyncio.TimeoutError:
                await websocket.send(build_heartbeat_request())
                heartbeat_at = time.monotonic()
                continue
            message = decode_history_message(frame)
            if message["templateId"] in (75, 77):
                raise RithmicProbeError("History Plant rejected or terminated replay")
            if time.monotonic() - heartbeat_at >= 10:
                await websocket.send(build_heartbeat_request())
                heartbeat_at = time.monotonic()
            if message["templateId"] != 207:
                continue
            if message.get("userMessages") != [tag]:
                raise RithmicProbeError("uncorrelated History Plant reply")
            if message.get("handlerRpCode", ["0"]) != ["0"]:
                raise RithmicProbeError("History Plant request handler failed")
            if message.get("timeMs") is not None:
                if message.get("symbol") != symbol or message.get("exchange") != exchange:
                    raise RithmicProbeError("history returned a different instrument")
                records.append(message)
            if message.get("rpCode"):
                if message["rpCode"] != ["0"]:
                    code = message["rpCode"][0]
                    raise RithmicHistoryUnavailable(code)
                break
        else:
            raise RithmicProbeError("History Plant replay did not complete before timeout")
        if len(records) >= max_count:
            if start == end:
                raise RithmicProbeError("single second exceeds replay cap; refusing truncated history")
            middle = (start + end) // 2
            left = await self.replay(websocket, symbol=symbol, exchange=exchange,
                                     start=start, end=middle, max_count=max_count)
            right = await self.replay(websocket, symbol=symbol, exchange=exchange,
                                      start=middle + 1, end=end, max_count=max_count)
            return left + right
        return records
