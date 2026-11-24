"""Local socket for credential-free connection checks; no trading commands."""

from __future__ import annotations

import asyncio
import json
import math
import os
import re
import stat

from ..models.timestamp import now_ms
from .client import ExecutionError


def sizing_status(service):
    """Whitelist cached sizing metadata; never read accounts or credentials."""
    def numeric(value):
        if isinstance(value, bool):
            return None
        try:
            result = float(value)
            return result if math.isfinite(result) and 0 < result <= 1e15 else None
        except (TypeError, ValueError, OverflowError):
            return None

    def currency(value):
        return value if isinstance(value, str) and re.fullmatch(r"[A-Z]{3}", value) else None

    profiles = []
    for index, session in enumerate(service.sessions.values(), 1):
        condition = session.condition
        try:
            symbol = service.symbol(session.user_id)
        except ExecutionError:
            symbol = {}
        profiles.append(dict(profile=index,
            instrument=session.symbol if re.fullmatch(r"XAUUSD[A-Za-z]*", session.symbol) else None,
            accountCurrency=currency(session.settings.get("currency")),
            quoteCurrency=currency(condition.get("quote_currency")),
            contractSize=numeric(condition.get("contract_size")),
            tickSize=numeric(symbol.get("tickSize")), pipValue=numeric(symbol.get("pipValue")),
            minLot=numeric(condition.get("volume_min")), maxLot=numeric(condition.get("volume_max")),
            lotStep=numeric(condition.get("volume_step"))))
    return dict(profileCount=len(profiles), profiles=profiles)


def connection_status(service):
    now = now_ms()
    profiles = []
    for index, session in enumerate(service.sessions.values(), 1):
        profiles.append(dict(profile=index, eventsConnected=session.events_live,
            ticksConnected=session.ticks_live, snapshotSynchronized=session.synced,
            websocketSnapshots=session.websocket_snapshots, eventFrames=session.event_frames,
            accountStateEvents=session.account_state_events, tickFrames=session.tick_frames,
            quoteReceived=bool(session.tick), quoteAgeSeconds=round(max(0, now-session.tick_at)/1000, 1) if session.tick_at else None,
            eventsReconnects=session.events_reconnects, ticksReconnects=session.ticks_reconnects,
            eventsError=session.events_error, ticksError=session.ticks_error,
            eventsResponse=session.events_response, ticksResponse=session.ticks_response))
    return dict(profileCount=len(profiles), profiles=profiles)


async def probe_connections(service):
    """The only upstream operations here are four fixed GET requests per profile.

    Raw responses remain inside the backend; only validation results leave it.
    The probe does not read credential storage or apply snapshots to live state.
    """
    result = connection_status(service)
    for row, session in zip(result["profiles"], list(service.sessions.values())):
        checks = []
        endpoints = (("account", session.client.config_path+"/account"),
            ("limits", session.client.config_path+"/limits"),
            ("instrument", session.client.config_path+f"/instruments/{session.symbol}/conditions"),
            ("snapshot", session.client.trading_path+"/snapshot"))
        for label, path in endpoints:
            try:
                payload = await session.client.request("GET", path)
                if label == "account":
                    valid = str(payload.get("account_id")) == session.client.account_id
                elif label == "limits":
                    valid = isinstance(payload.get("limits"), dict)
                elif label == "instrument":
                    valid = payload.get("instrument") == session.symbol and payload.get("point_digits") is not None
                else:
                    valid = isinstance(payload.get("account_state"), dict)
                checks.append(dict(check=label, ok=valid, status=200))
            except ExecutionError as exc:
                checks.append(dict(check=label, ok=False, status=exc.status, code=exc.code))
            except Exception:
                checks.append(dict(check=label, ok=False, code="PROBE_FAILED"))
        row["readOnlyChecks"] = checks
    return result


class ExecutionMonitor:
    def __init__(self, service):
        self.service = service
        self.path = service.store.path.with_name("execution-monitor.sock")
        self.server = None
        self.handlers = set()

    async def start(self):
        if os.name != "posix":
            return
        if self.path.exists():
            if not stat.S_ISSOCK(self.path.lstat().st_mode):
                raise RuntimeError("Execution monitor path is not a socket")
            self.path.unlink()
        self.server = await asyncio.start_unix_server(self._handle, path=str(self.path), limit=64)
        self.path.chmod(0o600)

    async def stop(self):
        if self.server is not None:
            self.server.close()
            await self.server.wait_closed()
            for task in list(self.handlers):
                task.cancel()
            await asyncio.gather(*list(self.handlers), return_exceptions=True)
            if self.path.exists() and stat.S_ISSOCK(self.path.lstat().st_mode):
                self.path.unlink()

    async def _handle(self, reader, writer):
        task = asyncio.current_task()
        self.handlers.add(task)
        try:
            command = await asyncio.wait_for(reader.readline(), 2)
            if command not in {b"status\n", b"probe\n", b"sizing\n"}:
                return
            if command == b"sizing\n":
                payload = sizing_status(self.service)
            else:
                payload = await probe_connections(self.service) if command == b"probe\n" else connection_status(self.service)
            writer.write(json.dumps(payload, allow_nan=False).encode()+b"\n")
            await writer.drain()
        finally:
            self.handlers.discard(task)
            writer.close()
            await writer.wait_closed()
