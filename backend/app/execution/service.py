"""Account-isolated Exness execution and confirmed broker-state management."""

from __future__ import annotations

import asyncio
import contextlib
import json
import re
import secrets
import sqlite3
import time
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from urllib.parse import urlencode

from ..engines.supertrend import SupertrendBar, SupertrendConfig, SupertrendState, SUPERTREND_TIMEFRAMES
from ..models.timestamp import now_ms
from .client import ExnessClient, ExecutionError, PUBLIC_API_ERRORS, uint64
from .store import ExecutionStore
from .monitor import ExecutionMonitor

FINAL = {"confirmed", "rejected", "failed", "reviewed"}
OPEN = {"pending_submit", "submitted", "working", "filled", "sync_paused", "sync_error"}
PRICE_FIELDS = {"entryGc": "price", "slGc": "stop_loss_price", "tpGc": "take_profit_price"}


def decimal(value, *, positive=False) -> Decimal:
    try:
        if isinstance(value, bool):
            raise ValueError()
        result = Decimal(str(value))
        if not result.is_finite() or (positive and result <= 0):
            raise ValueError()
        return result
    except (ValueError, TypeError, InvalidOperation):
        raise ExecutionError("BAD_REQUEST", "Trading values must be finite numbers", 400) from None


def number(value, default=0.0):
    return default if value is None else float(decimal(value))


def timestamp(value):
    try:
        return int(datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp() * 1000)
    except (ValueError, TypeError):
        return 0


@dataclass
class BrokerSession:
    user_id: str
    client: ExnessClient
    symbol: str
    settings: dict
    condition: dict
    limits: dict
    orders: dict = field(default_factory=dict)
    positions: dict = field(default_factory=dict)
    account_state: dict = field(default_factory=dict)
    tick: dict = field(default_factory=dict)
    tick_at: int = 0
    conversion_legs: tuple = ()
    conversion_ticks: dict = field(default_factory=dict)
    chart_bases: dict = field(default_factory=dict)
    refresh_snapshot: bool = False
    action_error: str | None = None
    synced: bool = False
    error: str | None = None
    events_live: bool = False
    ticks_live: bool = False
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    tasks: list = field(default_factory=list)
    websocket_snapshots: int = 0
    event_frames: int = 0
    account_state_events: int = 0
    tick_frames: int = 0
    events_reconnects: int = 0
    ticks_reconnects: int = 0
    events_error: str | None = None
    ticks_error: str | None = None
    events_response: dict = field(default_factory=dict)
    ticks_response: dict = field(default_factory=dict)
    buffered_events: list = field(default_factory=list)


class ExecutionService:
    def __init__(self, cache, settings, *, store=None, client_factory=ExnessClient):
        self.cache, self.settings = cache, settings
        import os
        self.store = store or ExecutionStore(cache.db_path.with_name("execution.sqlite"),
            Path(os.getenv("NTTOTV_EXECUTION_KEY_FILE", str(cache.db_path.with_name("execution.key")))))
        self.client_factory = client_factory
        self.sessions: dict[str, BrokerSession] = {}
        self._connect_locks: dict[str, asyncio.Lock] = {}
        self.gc_price: Decimal | None = None
        self.gc_at = 0
        self._task = None
        self._restore_tasks = set()
        self._stopping = False
        self.monitor = ExecutionMonitor(self)

    async def start(self):
        if self._task is not None:
            return
        await self.monitor.start()
        self._task = asyncio.create_task(self._maintenance())
        for account in self.store.accounts():
            if account["enabled"]:
                self._schedule_restore(account["user_id"])

    def _schedule_restore(self, user_id):
        if not hasattr(self, "_restoring"):
            self._restoring = set()
        if user_id in self._restoring:
            return
        self._restoring.add(user_id)
        task = asyncio.create_task(self._restore(user_id))
        self._restore_tasks.add(task)
        task.add_done_callback(self._restore_tasks.discard)
        task.add_done_callback(lambda _: self._restoring.discard(user_id))

    async def stop(self):
        self._stopping = True
        await self.monitor.stop()
        tasks = ([self._task] if self._task else []) + list(self._restore_tasks) + [t for s in self.sessions.values() for t in s.tasks]
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        self.store.close()

    async def _restore(self, user_id):
        try:
            account = self.store.account(user_id, secret=True)
            await self.connect(user_id, dict(apiKey=account["apiKey"], apiSecret=account["apiSecret"],
                accountId=account["account_id"], gateway=account["gateway"], symbolBroker=account["symbol"]))
        except Exception:
            # Decryption or upstream failures never expose credential-bearing exceptions.
            return

    async def connect(self, user_id: str, body: dict):
        async with self._connect_locks.setdefault(user_id, asyncio.Lock()):
            account_id = uint64(body.get("accountId", ""))
            existing = self.store.account(user_id)
            if any(a["account_id"] == account_id and a["user_id"] != user_id for a in self.store.accounts()):
                raise ExecutionError("CONFLICT", "This Exness account is already linked to another profile")
            unresolved = [o for o in self.store.operations(user_id) if o["state"] not in FINAL]
            if unresolved and user_id in self.sessions:
                raise ExecutionError("CONFLICT", "Wait for pending execution results before changing credentials")
            if existing and existing["account_id"] != account_id:
                if unresolved or any(o["status"] in OPEN for o in self.store.orders(user_id)):
                    raise ExecutionError("CONFLICT", "Manage existing exposure before changing the linked account")
                old = self.sessions.get(user_id)
                if old and (old.positions or old.orders):
                    raise ExecutionError("CONFLICT", "Close or cancel existing Exness exposure before switching accounts")
            api_key, secret = body.get("apiKey"), body.get("apiSecret")
            if not isinstance(api_key, str) or not isinstance(secret, str):
                raise ExecutionError("BAD_REQUEST", "API key and API secret are required", 400)
            gateway = body.get("gateway") or "https://api.exness.com"
            client = self.client_factory(api_key.strip(), secret.strip(), account_id, gateway)
            await client.discover()
            details = await client.request("GET", client.config_path + "/account")
            if str(details.get("account_id")) != account_id:
                raise ExecutionError("EXECUTION_UNAVAILABLE", "Exness returned a different account", 502)
            limits = await client.request("GET", client.config_path + "/limits")
            client.limits = limits.get("limits", {})
            catalogue = await client.request("GET", client.config_path + "/instruments")
            instruments = catalogue.get("instruments", [])
            names = [v if isinstance(v, str) else v.get("instrument") for v in instruments]
            requested = body.get("symbolBroker", "").strip()
            symbol = requested or next((v for v in names if v == "XAUUSD"), None) or next(
                (v for v in names if isinstance(v, str) and re.fullmatch(r"XAUUSD[A-Za-z]*", v)), None)
            if not symbol or symbol not in names:
                raise ExecutionError("BAD_REQUEST", "Choose an available gold instrument for this account", 400)
            condition = await client.request("GET", client.config_path + f"/instruments/{symbol}/conditions")
            session = BrokerSession(user_id, client, symbol, details.get("settings", {}), condition, client.limits)
            session.conversion_legs = self._conversion_legs(names, condition.get("quote_currency"), session.settings.get("currency"))
            snapshot = await client.request("GET", client.trading_path + "/snapshot")
            self._apply_snapshot(session, snapshot)
            try:
                self.store.save_account(user_id, account_id, dict(apiKey=api_key.strip(), apiSecret=secret.strip(), gateway=gateway), symbol)
            except sqlite3.IntegrityError:
                raise ExecutionError("CONFLICT", "This Exness account is already linked to another profile") from None
            old = self.sessions.get(user_id)
            if old:
                if old.client.account_id == account_id and old.symbol == symbol:
                    session.chart_bases = old.chart_bases.copy()
                for task in old.tasks:
                    task.cancel()
                await asyncio.gather(*old.tasks, return_exceptions=True)
            self.sessions[user_id] = session
            self._reconcile(session)
            session.tasks = [asyncio.create_task(self._events(session)), asyncio.create_task(self._ticks(session))]
            return self.account(user_id)

    def session(self, user_id: str) -> BrokerSession:
        session = self.sessions.get(user_id)
        if session is None:
            raise ExecutionError("EXECUTION_UNAVAILABLE", "Connect your Exness account in Account", 409)
        return session

    def account(self, user_id):
        session = self.sessions.get(user_id)
        saved = self.store.account(user_id)
        if session is None:
            if saved is None:
                return None
            return dict(accountId=saved["account_id"], login=saved["account_id"], server="Exness API", provider="exness",
                        symbolBroker=saved["symbol"], tradeMode="live", connected=False, error="Reconnecting to Exness")
        state = session.account_state
        equity, margin = number(state.get("equity")), number(state.get("used_margin"))
        return dict(accountId=session.client.account_id, login=session.client.account_id, server="Exness API", provider="exness",
            symbolBroker=session.symbol, tradeMode="live", currency=session.settings.get("currency"),
            balance=number(state.get("balance")), equity=equity, margin=margin, freeMargin=equity-margin,
            connected=session.synced and session.events_live and session.ticks_live, error=session.error,
            gateway=session.client.gateway, credentialsStored=True,
            uncertainActions=[dict(key=o["key"], action=o["action"], createdAt=o["created_at"])
                for o in self.store.operations(user_id) if o["state"] == "uncertain"])

    async def acknowledge_uncertain(self, user_id, key):
        s = self.session(user_id)
        async with s.lock:
            operation = self.store.operation(user_id, key)
            if operation is None or operation["account_id"] != s.client.account_id or operation["state"] != "uncertain":
                raise ExecutionError("NOT_FOUND", "Uncertain action not found", 404)
            snapshot = await s.client.request("GET", s.client.trading_path+"/snapshot")
            self._apply_snapshot(s, snapshot)
            self._reconcile(s)
            self.store.update_operation(user_id, key, "reviewed", result={"reviewedByUser": True, "at": now_ms()})
            if operation["order_id"] and operation["action"] == "open":
                order = self._order(user_id, operation["order_id"])
                if not order.get("brokerOrderTicket") and not order.get("brokerPositionTicket"):
                    order.update(status="unlinked", rejectReason="Account reviewed by user; manage exposure in the account list", updatedAt=now_ms())
                    self.store.save_order(user_id, order)
            s.error = None
            return self.account(user_id)

    def symbol(self, user_id):
        s = self.session(user_id)
        c = s.condition
        digits = c.get("point_digits")
        required = [digits, c.get("volume_min"), c.get("volume_max"), c.get("volume_step")]
        if any(v is None for v in required):
            raise ExecutionError("EXECUTION_UNAVAILABLE", "Exness instrument conditions are incomplete", 503)
        # Existing chart sizing uses pipValue as account currency per broker tick.
        currency = s.settings.get("currency")
        quote = c.get("quote_currency")
        base_currency = "USD" if currency == "USC" else currency
        base_quote = "USD" if quote == "USC" else quote
        if base_currency == "USD" and base_quote == "USD" and c.get("contract_size"):
            scale = (100 if currency == "USC" else 1) / (100 if quote == "USC" else 1)
            pip_value = number(c["contract_size"]) * scale * 10**-digits
        else:
            pip_value = 0
        return dict(symbol=s.symbol, digits=digits, tickSize=10**-digits,
                    minLot=number(c["volume_min"]), maxLot=number(c["volume_max"]), lotStep=number(c["volume_step"]),
                    stopsLevel=0, pipValue=pip_value)

    def on_gc_price(self, price, at):
        self.gc_price, self.gc_at = decimal(price, positive=True), int(at)

    def basis(self, session):
        if self.gc_price is None or now_ms()-self.gc_at > 5000 or not self._fresh_quote(session):
            raise ExecutionError("BASIS_STALE", "Waiting for fresh Rithmic and Exness prices")
        return (decimal(session.tick["bid"]) + decimal(session.tick["ask"])) / 2 - self.gc_price

    def _fresh_quote(self, s):
        return s.ticks_live and s.tick and now_ms()-s.tick_at <= 5000

    def _chart_basis(self, s, target, local=None):
        # Keep a single translation for each exposure so only broker-side
        # changes move its lines. Current GC movement is not an order edit.
        if local and local.get("basisAtSubmit") is not None:
            return decimal(local["basisAtSubmit"])
        if target not in s.chart_bases:
            try:
                s.chart_bases[target] = self.basis(s)
            except ExecutionError:
                return None
        return s.chart_bases[target]

    def price(self, s, value):
        digits = s.condition.get("point_digits")
        if not isinstance(digits, int) or not 0 <= digits <= 12:
            raise ExecutionError("EXECUTION_UNAVAILABLE", "Missing Exness price precision", 503)
        return format(decimal(value, positive=True).quantize(Decimal(10)**-digits, rounding=ROUND_HALF_UP), "f")

    def volume(self, s, value):
        volume = decimal(value, positive=True)
        c = s.condition
        minimum, maximum, step = (decimal(c.get(k), positive=True) for k in ("volume_min", "volume_max", "volume_step"))
        if not minimum <= volume <= maximum or (volume-minimum) % step:
            raise ExecutionError("BAD_REQUEST", "Volume is outside Exness minimum, maximum or lot step", 400)
        return format(volume, "f")

    def _guard(self, s, *, opening=False):
        if not self.settings.trading_enabled or not self.settings.live_trading_enabled:
            raise ExecutionError("TRADING_DISABLED", "Live execution is disabled on this server", 403)
        if not s.synced or not s.events_live:
            raise ExecutionError("EXECUTION_UNAVAILABLE", "Wait for Exness account synchronization", 503)
        if opening and not s.ticks_live:
            raise ExecutionError("EXECUTION_UNAVAILABLE", "Wait for the Exness quote connection", 503)
        if s.settings.get("trade_mode") == "trading_disabled":
            raise ExecutionError("TRADING_DISABLED", "Exness trading is disabled for this account", 403)
        if opening and (s.settings.get("account_status") == "close_only" or s.condition.get("trade_mode") == "close_only"):
            raise ExecutionError("ACCOUNT_CLOSE_ONLY", "Exness account or instrument is close-only", 403)
        if opening and s.condition.get("trade_mode") == "trading_disabled":
            raise ExecutionError("TRADING_DISABLED", "Exness trading is disabled for this instrument", 403)

    def _order(self, user_id, order_id):
        order = next((o for o in self.store.orders(user_id) if o["id"] == order_id), None)
        if order is None or order["accountId"] != self.session(user_id).client.account_id:
            raise ExecutionError("NOT_FOUND", "Order not found", 404)
        return order

    async def submit(self, user_id, body):
        s = self.session(user_id)
        key = str(body.get("idempotencyKey", ""))
        if not re.fullmatch(r"[A-Za-z0-9._~-]{5,128}", key):
            raise ExecutionError("BAD_REQUEST", "A valid idempotencyKey is required", 400)
        async with s.lock:
            prior = self.store.operation(user_id, key)
            if prior:
                if json.loads(prior["request"]).get("input") != body:
                    raise ExecutionError("CONFLICT", "Idempotency key was used for a different request")
                return self._order(user_id, prior["order_id"])
            self._guard(s, opening=True)
            if any(o["state"] == "uncertain" for o in self.store.operations(user_id)):
                raise ExecutionError("EXECUTION_PENDING", "Wait for the previous broker action to finish")
            side, kind = body.get("side"), body.get("kind")
            if side not in {"buy", "sell"} or kind not in {"market", "limit", "stop"}:
                raise ExecutionError("BAD_REQUEST", "Invalid side or order kind", 400)
            if body.get("source") not in {"chart_bracket", "market_bar", "api"}:
                raise ExecutionError("BAD_REQUEST", "Automatic entry is not enabled", 400)
            if not self._fresh_quote(s):
                raise ExecutionError("MARKET_NO_QUOTES", "Waiting for a fresh Exness Bid/Ask")
            try:
                basis = self.basis(s)
            except ExecutionError:
                if kind != "market" or any(body.get(level) is not None and distance not in body for level, distance in
                        (("slGc", "slDistanceGc"), ("tpGc", "tpDistanceGc"))):
                    raise
                basis = None
            volume = self.volume(s, body.get("volumeLots"))
            quote = decimal(s.tick["ask" if side == "buy" else "bid"])
            entry = quote if kind == "market" else decimal(body.get("entryGc"), positive=True) + basis
            entry = decimal(self.price(s, entry))
            if kind != "market":
                if entry == quote:
                    raise ExecutionError("BAD_REQUEST", "Pending entry must differ from the executable Exness price", 400)
                executable_kind = "limit" if (entry < quote if side == "buy" else entry > quote) else "stop"
                if body.get("source") == "chart_bracket" and body.get("autoPendingKind") is True:
                    kind = executable_kind
                elif kind != executable_kind:
                    raise ExecutionError("BAD_REQUEST", f"{kind.title()} entry is on the wrong side of the current Exness quote", 400)
            payload = dict(instrument=s.symbol, side=side, volume=volume)
            if kind != "market":
                payload.update(type=kind, price=self.price(s, entry))
            elif s.condition.get("exec_mode", s.settings.get("execution_mode")) == "instant":
                payload["price"] = self.price(s, quote)
            for name, wire, distance in (("slGc", "stop_loss_price", "slDistanceGc"), ("tpGc", "take_profit_price", "tpDistanceGc")):
                value = body.get(name)
                if distance in body:
                    delta = decimal(body[distance], positive=True)
                    sign = -1 if (name == "slGc") == (side == "buy") else 1
                    target = entry + sign * delta
                else:
                    target = decimal(value, positive=True) + basis if value is not None else None
                if target is not None:
                    target = decimal(self.price(s, target))
                    correct = target < entry if (name == "slGc") == (side == "buy") else target > entry
                    if not correct:
                        raise ExecutionError("BAD_REQUEST", "SL and TP must be on the correct side of entry", 400)
                    payload[wire] = self.price(s, target)
            if body.get("autoSupertrendAfter1rEnabled"):
                self._trailing_config(body, prefix="trailing")
                if not body.get("takeProfit1rEnabled"):
                    raise ExecutionError("BAD_REQUEST", "Auto SuperTrend requires the 1R partial rule", 400)
            now = now_ms()
            order = dict(id="exn_" + secrets.token_hex(12), userId=user_id, accountId=s.client.account_id,
                source=body["source"], symbolInternal="GC", contractInternal="GC", symbolBroker=s.symbol,
                side=side, kind=kind, volumeLots=float(volume), gcAnchored=bool(body.get("gcAnchored")),
                status="pending_submit", idempotencyKey=key, version=1, createdAt=now, updatedAt=now,
                entryGc=float(entry-basis) if basis is not None else None, entryBroker=float(entry),
                basisAtSubmit=float(basis) if basis is not None else None,
                takeProfit1rEnabled=bool(body.get("takeProfit1rEnabled")),
                autoSupertrendAfter1rEnabled=bool(body.get("autoSupertrendAfter1rEnabled")))
            for field_name in ("trailingTimeframe", "trailingPeriod", "trailingMultiplier", "trailingAtrMethod", "trailingSource"):
                order[field_name] = body.get(field_name)
            stop = payload.get("stop_loss_price")
            order["initialRiskGc"] = float(abs(entry - decimal(stop))) if stop is not None else None
            if order["takeProfit1rEnabled"] and not order["initialRiskGc"]:
                raise ExecutionError("BAD_REQUEST", "1R partial requires an initial stop loss", 400)
            self.store.save_order(user_id, order)
            path = s.client.trading_path + ("/positions" if kind == "market" else "/orders")
            await self._dispatch(s, key, "open", dict(method="POST", path=path, body=payload, input=body), order["id"])
            return self._order(user_id, order["id"])

    async def _dispatch(self, s, key, action, request, order_id=None):
        self._guard(s, opening=action == "open")
        if not isinstance(key, str) or not re.fullmatch(r"[A-Za-z0-9._~-]{5,128}", key):
            raise ExecutionError("BAD_REQUEST", "Invalid idempotency key", 400)
        existing_op = self.store.operation(s.user_id, key)
        if existing_op:
            req = json.loads(existing_op["request"]) if isinstance(existing_op.get("request"), str) else (existing_op.get("request") or {})
            return dict(
                key=key,
                operationId=str(existing_op["operation_id"]) if existing_op.get("operation_id") else None,
                action=existing_op["action"],
                state=existing_op["state"],
                target=req.get("target"),
                createdAt=existing_op.get("created_at")
            )
        # An accepted action is still in flight until confirmed by the broker.
        for pending in self.store.operations(s.user_id):
            if pending["account_id"] != s.client.account_id or pending["state"] in FINAL:
                continue
            previous = json.loads(pending["request"]) if isinstance(pending.get("request"), str) else (pending.get("request") or {})
            if pending["state"] == "uncertain" or (order_id and pending["order_id"] == order_id) or (previous.get("target") == request.get("target") and request.get("target")):
                raise ExecutionError("EXECUTION_PENDING", "Wait for the previous broker action to finish")
        self.store.intent(s.user_id, s.client.account_id, key, action, request, order_id, now_ms())
        if action != "partial_1r" and not key.startswith("st-"):
            s.action_error = None
        operation_id = None
        try:
            ack = await s.client.request(request["method"], request["path"], request.get("body"), idempotency=key)
            if ack.get("client_request_id") != key:
                raise ExecutionError("EXECUTION_UNAVAILABLE", "Exness returned an uncorrelated operation ACK", 503)
            raw_op_id = ack.get("operation_id", "")
            operation_id = str(uint64(raw_op_id)) if raw_op_id != "" else None
            current = self.store.operation(s.user_id, key)
            if current["state"] not in FINAL:
                self.store.update_operation(s.user_id, key, "pending", operation_id)
            if order_id:
                order = self._order(s.user_id, order_id)
                if order["status"] == "pending_submit":
                    order.update(status="submitted", operationId=operation_id, updatedAt=now_ms())
                    self.store.save_order(s.user_id, order)

            # Drain buffered events that arrived before this ACK completed
            if hasattr(s, "buffered_events") and s.buffered_events:
                drained = []
                remaining = []
                for evt in s.buffered_events:
                    evt_op_id = str(evt.get("operation_id")) if evt.get("operation_id") is not None else None
                    evt_req_id = evt.get("client_request_id")
                    if (operation_id and evt_op_id and evt_op_id == operation_id) or (evt_req_id and evt_req_id == key):
                        drained.append(evt)
                    else:
                        remaining.append(evt)
                s.buffered_events = remaining
                for evt in drained:
                    await self._process_transaction_event(s, evt)
                if drained:
                    self._reconcile(s)

            current = self.store.operation(s.user_id, key)
            return dict(
                key=key,
                operationId=operation_id,
                action=action,
                state=current["state"] if current else "pending",
                target=request.get("target"),
                createdAt=now_ms()
            )
        except ExecutionError as exc:
            # Before a valid ACK, timeouts/5xx/invalid ACKs can have executed.
            uncertain = exc.status >= 500 or exc.code in {"BAD_REQUEST", "EXECUTION_UNAVAILABLE"}
            self.store.update_operation(s.user_id, key, "uncertain" if uncertain else "rejected", result={"code": exc.code})
            if order_id and action == "open":
                order = self._order(s.user_id, order_id)
                order.update(status="sync_paused" if uncertain else "rejected", rejectReason=str(exc), updatedAt=now_ms())
                self.store.save_order(s.user_id, order)
            if not uncertain:
                raise
            s.error = "An execution result is uncertain; inspect Exness positions before another action"
            return dict(
                key=key,
                operationId=None,
                action=action,
                state="uncertain",
                target=request.get("target"),
                createdAt=now_ms()
            )
        except Exception:
            self.store.update_operation(s.user_id, key, "uncertain")
            s.error = "An execution result is uncertain; inspect Exness positions before another action"
            return dict(
                key=key,
                operationId=None,
                action=action,
                state="uncertain",
                target=request.get("target"),
                createdAt=now_ms()
            )

    def _apply_snapshot(self, s, payload):
        s.orders = {uint64(o["order_id"]): o for o in payload.get("orders", [])}
        s.positions = {uint64(p["position_id"]): p for p in payload.get("positions", []) if p.get("state") == "open"}
        s.chart_bases = {k: v for k, v in s.chart_bases.items()
                         if k[2:] in (s.positions if k.startswith("p:") else s.orders)}
        s.refresh_snapshot = False
        s.account_state = payload.get("account_state", {})
        s.synced = True
        if not any(o["state"] == "uncertain" for o in self.store.operations(s.user_id)):
            s.error = None

    def _apply_entities(self, s, payload):
        for o in payload.get("orders", []):
            key = uint64(o["order_id"])
            previous = s.orders.get(key, {})
            if o.get("order_type") == "sltp" and not (o.get("position_id") or previous.get("position_id")):
                # The public event may omit the parent of pending protection.
                # The snapshot exposes those levels on the pending order itself.
                s.refresh_snapshot = True
            if o.get("state") in {"cancelled", "rejected", "filled"}:
                s.orders.pop(key, None)
            else:
                current = {**previous, **o}
                if "create_time" in o:
                    for wire in ("stop_loss_price", "take_profit_price"):
                        if wire in o or previous.get(wire) is None:
                            continue
                        if o.get("order_type") == "sltp":
                            current.pop(wire, None)
                        elif o.get("order_type") in {"limit", "stop"}:
                            s.refresh_snapshot = True
                s.orders[key] = current
        for p in payload.get("positions", []):
            key = uint64(p["position_id"])
            if p.get("state") == "closed":
                s.positions.pop(key, None)
                s.chart_bases.pop("p:"+key, None)
            else:
                s.positions[key] = {**s.positions.get(key, {}), **p}
        s.account_state.update(payload.get("account_state", {}))

    def _apply_order_transitions(self, s, payload):
        fills = {str(d["order_id"]): uint64(d["position_id"]) for d in payload.get("deals", [])
                 if d.get("type") == "open" and d.get("order_id") and d.get("position_id")}
        terminal_orders = {str(o["order_id"]): o for o in payload.get("orders", [])
                           if o.get("order_type") in {"limit", "stop", "market"}
                           and o.get("state") in {"filled", "cancelled", "rejected"}}
        if not fills and not terminal_orders:
            return
        for oid, changed in terminal_orders.items():
            if changed["state"] == "filled" and changed.get("position_id"):
                fills.setdefault(oid, uint64(changed["position_id"]))
            basis = s.chart_bases.pop("o:"+oid, None)
            if basis is not None and fills.get(oid) in s.positions:
                s.chart_bases.setdefault("p:"+fills[oid], basis)
        for order in self.store.orders(s.user_id):
            oid = order.get("brokerOrderTicket")
            if order["accountId"] != s.client.account_id or not oid or order.get("brokerPositionTicket"):
                continue
            if oid in fills:
                order["brokerPositionTicket"] = fills[oid]
            elif oid in terminal_orders and terminal_orders[oid]["state"] in {"cancelled", "rejected"}:
                order["status"] = terminal_orders[oid]["state"]
            else:
                continue
            order.update(updatedAt=now_ms(), version=order["version"]+1)
            self.store.save_order(s.user_id, order)

    async def event(self, s, message):
        event_type = message.get("event_type") or message.get("event")
        payload = message.get("payload", {})
        async with s.lock:
            s.event_frames += 1
            event_id = None
            if event_type == "transaction_event":
                import hashlib
                raw_op_id = message.get("operation_id")
                op_id_str = str(raw_op_id) if raw_op_id is not None else None
                event_id = op_id_str or hashlib.sha256(json.dumps(message, sort_keys=True).encode()).hexdigest()
                if self.store.seen_event(s.user_id, s.client.account_id, event_id):
                    return
            if event_type == "trading_state_snapshot":
                s.websocket_snapshots += 1
                self._apply_snapshot(s, payload)
            elif event_type == "transaction_event":
                await self._process_transaction_event(s, message)
            elif event_type == "account_state_event":
                s.account_state_events += 1
                s.account_state.update(payload.get("account_state", {}))
            elif event_type == "instrument_event":
                instrument = payload.get("instrument", message.get("instrument"))
                if instrument == s.symbol:
                    s.condition.update(payload)
            self._reconcile(s)
            if event_id is not None:
                self.store.mark_event(s.user_id, s.client.account_id, event_id)
            if s.synced and s.events_live and s.ticks_live and not any(o["state"] == "uncertain" for o in self.store.operations(s.user_id)):
                s.error = None

    async def _process_transaction_event(self, s, message):
        payload = message.get("payload", {})
        self._apply_entities(s, payload)
        self._apply_order_transitions(s, payload)
        key = message.get("client_request_id")
        raw_op_id = message.get("operation_id")
        op_id_str = str(raw_op_id) if raw_op_id is not None else None
        op = self.store.operation(s.user_id, key) if key else None
        if not op and op_id_str:
            op = next((o for o in self.store.operations(s.user_id)
                      if str(o.get("operation_id") or "") == op_id_str and o.get("operation_id")), None)
        if op and op["account_id"] == s.client.account_id:
            raw_status = message.get("status")
            status = {"success": "confirmed", "confirmed": "confirmed", "rejected": "rejected", "failed": "failed"}.get(raw_status)
            if status:
                self.store.update_operation(s.user_id, op["key"], status, op_id_str or op.get("operation_id"), message)
                broker_err = self._extract_broker_error(message, payload) or message.get("error_code") or message.get("error_message")
                needs_reconcile = self._finish_operation(s, op, status, payload, broker_err)
                if needs_reconcile:
                    try:
                        snapshot = await s.client.request("GET", s.client.trading_path + "/snapshot")
                        self._apply_snapshot(s, snapshot)
                    except Exception:
                        pass
        else:
            has_closing_deal = any(d.get("type") in {"close", "closed"} for d in payload.get("deals", []))
            if has_closing_deal and not payload.get("positions"):
                try:
                    snapshot = await s.client.request("GET", s.client.trading_path + "/snapshot")
                    self._apply_snapshot(s, snapshot)
                except Exception:
                    pass
            has_inflight = any(o["account_id"] == s.client.account_id and o["state"] not in FINAL
                               for o in self.store.operations(s.user_id))
            if has_inflight:
                if not hasattr(s, "buffered_events"):
                    s.buffered_events = []
                if len(s.buffered_events) >= 50:
                    s.buffered_events.pop(0)
                s.buffered_events.append(message)

    @staticmethod
    def _extract_broker_error(*sources) -> str | None:
        """Extract a sanitized public broker error code from Exness message/result dicts."""
        candidates = []
        for src in sources:
            if not isinstance(src, dict):
                continue
            for k in ("error_code", "error_message", "code"):
                v = src.get(k)
                if isinstance(v, str):
                    candidates.append(v)
            err = src.get("error")
            if isinstance(err, str):
                candidates.append(err)
            elif isinstance(err, dict):
                for k in ("code", "error_code", "error_message", "message"):
                    v = err.get(k)
                    if isinstance(v, str):
                        candidates.append(v)
            payload = src.get("payload")
            if isinstance(payload, dict):
                for k in ("error_code", "error_message", "code"):
                    v = payload.get(k)
                    if isinstance(v, str):
                        candidates.append(v)
                p_err = payload.get("error")
                if isinstance(p_err, str):
                    candidates.append(p_err)
                elif isinstance(p_err, dict):
                    for k in ("code", "error_code", "error_message", "message"):
                        v = p_err.get(k)
                        if isinstance(v, str):
                            candidates.append(v)
        for c in candidates:
            if not isinstance(c, str):
                continue
            clean = c.strip()
            if clean in PUBLIC_API_ERRORS:
                return clean
            norm = clean.upper()
            if norm in PUBLIC_API_ERRORS:
                return norm
            if re.fullmatch(r"TRADING_RULE_[A-Z0-9_]{1,64}", norm):
                return norm
        return None

    def _finish_operation(self, s, op, status, payload, error=None):
        if status != "confirmed":
            extracted = self._extract_broker_error({"error": error}) if error else self._extract_broker_error(payload)
            reason = extracted or (error if isinstance(error, str) and (error in PUBLIC_API_ERRORS or re.fullmatch(r"TRADING_RULE_[A-Z0-9_]{1,64}", error)) else "Exness rejected the action")
            s.action_error = reason
        request = json.loads(op["request"]) if isinstance(op.get("request"), str) else (op.get("request") or {})
        target = request.get("target", "")
        pid = target[2:] if target.startswith("p:") else None
        oid = target[2:] if target.startswith("o:") else None

        is_partial = False
        needs_snapshot_reconcile = False
        if status == "confirmed":
            if op["action"] == "close":
                is_partial_intent = ("?" in request.get("path", "") or "volume=" in request.get("path", "") or op.get("action") == "partial_1r")
                if is_partial_intent:
                    is_partial = True
                    found_pos = False
                    for p in payload.get("positions", []):
                        if uint64(p.get("position_id", "")) == pid:
                            if p.get("state") == "open":
                                found_pos = True
                                if pid in s.positions:
                                    s.positions[pid]["volume"] = p.get("volume")
                                elif str(pid) in s.positions:
                                    s.positions[str(pid)]["volume"] = p.get("volume")
                    if not found_pos:
                        needs_snapshot_reconcile = True
                else:
                    if pid:
                        s.positions.pop(pid, None)
                        s.chart_bases.pop("p:"+pid, None)
            elif op["action"] == "cancel" and oid:
                s.orders.pop(oid, None)
                s.chart_bases.pop("o:"+oid, None)

        order = self._order(s.user_id, op["order_id"]) if op.get("order_id") else None
        if not order and pid:
            order = next((o for o in self.store.orders(s.user_id) if str(o.get("brokerPositionTicket") or "") == str(pid)), None)
        if not order and oid:
            order = next((o for o in self.store.orders(s.user_id) if str(o.get("brokerOrderTicket") or "") == str(oid)), None)

        if not order:
            return needs_snapshot_reconcile

        if status != "confirmed":
            if op["action"] == "open":
                order["status"] = "rejected"
            order["rejectReason"] = reason
        else:
            if op["action"] == "cancel":
                order["status"] = "cancelled"
            elif op["action"] == "close":
                if not is_partial:
                    order["status"] = "closed"
                else:
                    for p in payload.get("positions", []):
                        if uint64(p.get("position_id", "")) == pid:
                            order["volumeLots"] = number(p.get("volume"))
            elif op["action"] == "open":
                broker_orders = [o for o in payload.get("orders", []) if o.get("order_type") == order["kind"]
                                 and o.get("instrument", s.symbol) == s.symbol and o.get("direction", order["side"]) == order["side"]]
                if len(broker_orders) == 1:
                    broker = broker_orders[0]
                    order["brokerOrderTicket"] = uint64(broker["order_id"])
                    if broker.get("state") == "filled" and broker.get("position_id"):
                        order["brokerPositionTicket"] = uint64(broker["position_id"])
                    if not order.get("brokerPositionTicket"):
                        deal_positions = {uint64(d["position_id"]) for d in payload.get("deals", [])
                                          if d.get("type") == "open" and d.get("position_id")
                                          and str(d.get("order_id")) == order["brokerOrderTicket"]}
                        if len(deal_positions) == 1:
                            order["brokerPositionTicket"] = deal_positions.pop()
                    if broker.get("state") == "placed":
                        order["status"] = "working"
                if order["kind"] == "market" and not order.get("brokerPositionTicket"):
                    opened = [p for p in payload.get("positions", []) if p.get("instrument") == s.symbol
                              and p.get("state") == "open" and p.get("direction") == order["side"]]
                    if len(opened) == 1:
                        order["brokerPositionTicket"] = uint64(opened[0]["position_id"])
                if not order.get("brokerOrderTicket") and not order.get("brokerPositionTicket"):
                    order.update(status="sync_paused", rejectReason="Broker confirmed execution; manage exposure in the account list while identity is reconciled")
            if op["action"] == "partial_1r":
                order["partial1rDone"] = True
        order["updatedAt"] = now_ms()
        order["version"] += 1
        self.store.save_order(s.user_id, order)
        return needs_snapshot_reconcile

    def _reconcile(self, s):
        for order in self.store.orders(s.user_id):
            if order["accountId"] != s.client.account_id:
                continue
            before = dict(order)
            position_id, broker_id = order.get("brokerPositionTicket"), order.get("brokerOrderTicket")
            # Pending fills can be initiated by Exness and have no client operation ID.
            broker = s.orders.get(broker_id, {})
            position_id = position_id or broker.get("position_id")
            if position_id and str(position_id) in s.positions:
                p = s.positions[str(position_id)]
                order.update(brokerPositionTicket=str(position_id), status="filled", volumeLots=number(p.get("volume")),
                             fillPriceBroker=number(p.get("open_price")))
            elif position_id and s.synced and order["status"] == "filled":
                order["status"] = "closed"
            elif broker_id and broker_id in s.orders and order["status"] != "filled":
                order["status"] = "working"
            elif broker_id and s.synced and order["status"] == "working":
                # Missing pending orders can have filled while offline. Do not assume cancellation.
                order["status"] = "sync_paused"
            if before != order:
                order["version"] += 1
                order["updatedAt"] = now_ms()
                self.store.save_order(s.user_id, order)

    def _get_pending_action(self, user_id, account_id, *, position_id=None, order_id=None, broker_order_id=None):
        for op in self.store.operations(user_id):
            if op["account_id"] != account_id or op["state"] in FINAL:
                continue
            req = json.loads(op["request"]) if isinstance(op.get("request"), str) else (op.get("request") or {})
            target = req.get("target")
            match = False
            if position_id and (target == f"p:{position_id}" or target == f"p:{uint64(position_id)}"):
                match = True
            elif broker_order_id and (target == f"o:{broker_order_id}" or target == f"o:{uint64(broker_order_id)}"):
                match = True
            elif order_id and op.get("order_id") == order_id:
                match = True
            if match:
                return dict(
                    key=op["key"],
                    operationId=str(op["operation_id"]) if op.get("operation_id") else None,
                    action=op["action"],
                    state=op["state"],
                    target=target,
                    createdAt=op.get("created_at")
                )
        return None

    def orders(self, user_id, open_only=True, *, trades=None):
        s = self.session(user_id)
        trades = self.open_trades(user_id) if trades is None else trades
        positions = {p["brokerPositionTicket"]: p for p in trades["positions"]}
        pending = {o["brokerOrderTicket"]: o for o in trades["orders"]}
        orders = []
        for o in self.store.orders(user_id):
            if o["accountId"] != s.client.account_id or (open_only and o["status"] not in OPEN):
                continue
            p = positions.get(o.get("brokerPositionTicket"))
            raw = p or pending.get(o.get("brokerOrderTicket"))
            if raw:
                o.update({name: raw[name] for name in ("side", "volumeLots", "entryBroker", "slBroker", "tpBroker",
                                                      "slGc", "tpGc", "basisStale", "actionPending")})
                o["entryGc"] = p.get("entryGcEstimate") if p else raw.get("entryGc")
                if p:
                    o.update(fillPriceGcEstimate=o["entryGc"], fillPriceBroker=raw["entryBroker"])
                else:
                    o["kind"] = raw["kind"]
            elif o["status"] in OPEN:
                # A local intent may survive disconnect or an ACK without an entity.
                # Render its status, but never project provisional prices as exposure.
                o.update(entryGc=None, fillPriceGcEstimate=None, slGc=None, tpGc=None, basisStale=True)
            pending_action = self._get_pending_action(user_id, s.client.account_id, order_id=o["id"],
                                                      position_id=o.get("brokerPositionTicket"),
                                                      broker_order_id=o.get("brokerOrderTicket"))
            if pending_action:
                o["pendingAction"] = pending_action
            orders.append(o)
        return orders

    def _protection(self, s, position_id, position=None):
        return max((o for o in s.orders.values() if o.get("order_type") == "sltp" and o.get("state") == "placed"
                    and str(o.get("position_id")) == position_id),
                   key=lambda o: timestamp(o.get("update_time") or o.get("create_time")), default=position or {})

    @staticmethod
    def _conversion_legs(names, source, target):
        source = "USD" if source == "USC" else source
        target = "USD" if target == "USC" else target
        if not source or not target or source == target:
            return ()

        def pair(base, quote):
            for prefix, inverse in ((base+quote, False), (quote+base, True)):
                name = prefix if prefix in names else next((n for n in names if isinstance(n, str) and
                                                           re.fullmatch(prefix + r"[a-zA-Z]*", n)), None)
                if name:
                    return name, inverse
            return None

        direct = pair(source, target)
        if direct:
            return (direct,)
        via_usd = pair(source, "USD"), pair("USD", target)
        return via_usd if all(via_usd) else ()

    def _price_pnl_rates(self, s, side):
        size = decimal(s.condition.get("contract_size", 0) or 0)
        currency, quote_currency = s.settings.get("currency"), s.condition.get("quote_currency")
        if not currency or not quote_currency or size <= 0:
            return None
        # The broker supplies the instrument's lot size. USC scales the money amount only.
        gain = loss = size * (100 if currency == "USC" else 1) / (100 if quote_currency == "USC" else 1)
        base_currency = "USD" if currency == "USC" else currency
        base_quote = "USD" if quote_currency == "USC" else quote_currency
        stale = False
        if base_currency != base_quote:
            forex = s.condition.get("calc_mode") in {"forex", "forex_no_leverage"}
            if not s.conversion_legs or (not forex and s.condition.get("calc_mode") not in {"cfd", "cfd_leverage"}):
                return None
            gain_uses_buy = forex and side == "buy"
            loss_uses_buy = not forex or gain_uses_buy
            for instrument, inverse in s.conversion_legs:
                tick = s.conversion_ticks.get(instrument)
                if not tick:
                    return None
                stale = stale or now_ms()-timestamp(tick.get("timestamp")) > 5000
                gain_rate = decimal(tick["ask" if gain_uses_buy != inverse else "bid"])
                loss_rate = decimal(tick["ask" if loss_uses_buy != inverse else "bid"])
                gain = gain / gain_rate if inverse else gain * gain_rate
                loss = loss / loss_rate if inverse else loss * loss_rate
        return gain, loss, stale

    def open_trades(self, user_id):
        s = self.sessions.get(user_id)
        if s is None:
            return dict(positions=[], orders=[])
        local = [o for o in self.store.orders(user_id) if o["accountId"] == s.client.account_id]
        intents = [o for o in self.store.operations(user_id) if o["account_id"] == s.client.account_id and o["state"] not in FINAL]
        targets = {json.loads(o["request"]).get("target") for o in intents}
        rates, price_pnl = {}, {}
        for side in ("buy", "sell"):
            rate = self._price_pnl_rates(s, side)
            if rate is not None:
                gain, loss, stale = rate
                rates[side] = rate
                price_pnl[side] = dict(gain=float(gain), loss=float(loss), stale=stale, currency=s.settings["currency"])
        positions, orders = [], []
        for pid, p in s.positions.items():
            if p.get("instrument") != s.symbol or p.get("open_price") is None:
                continue
            linked = next((o for o in local if o.get("brokerPositionTicket") == pid), None)
            target = "p:"+pid
            basis = self._chart_basis(s, target, linked)
            protection = self._protection(s, pid, p)
            entry = number(p.get("open_price"))
            row = dict(brokerPositionTicket=pid, orderId=linked["id"] if linked else None,
                symbolBroker=s.symbol, side=p["direction"], volumeLots=number(p["volume"]), entryBroker=entry,
                entryGcEstimate=float(decimal(p["open_price"])-basis) if basis is not None else None,
                basisStale=basis is None or not s.synced or not s.events_live, actionPending=target in targets,
                updatedAt=max(timestamp(p.get("create_time")), timestamp(protection.get("update_time")), s.tick_at))
            for wire, name in (("stop_loss_price", "sl"), ("take_profit_price", "tp")):
                value = protection.get(wire)
                row[name+"Broker"] = number(value) if value is not None else None
                row[name+"Gc"] = float(decimal(value)-basis) if value is not None and basis is not None else None
            pending_action = self._get_pending_action(user_id, s.client.account_id, position_id=pid, order_id=linked["id"] if linked else None)
            if pending_action:
                row["pendingAction"] = pending_action
            side = p["direction"]
            if side in price_pnl:
                row["pnlPerPriceUnit"] = price_pnl[side]
                if s.tick:
                    gain, loss, conversion_stale = rates[side]
                    is_buy = side == "buy"
                    close = decimal(s.tick["bid" if is_buy else "ask"])
                    move = close-decimal(p["open_price"]) if is_buy else decimal(p["open_price"])-close
                    profit = move * decimal(p["volume"]) * (gain if move >= 0 else loss)
                    stale = conversion_stale or not (self._fresh_quote(s) and s.synced and s.events_live)
                    row.update(profit=float(profit), profitCurrency=s.settings["currency"], profitStale=stale)
            positions.append(row)
        for oid, o in s.orders.items():
            if o.get("order_type") not in {"limit", "stop"} or o.get("instrument") != s.symbol or o.get("state") != "placed":
                continue
            linked = next((v for v in local if v.get("brokerOrderTicket") == oid), None)
            target = "o:"+oid
            basis = self._chart_basis(s, target, linked)
            row = dict(brokerOrderTicket=oid, orderId=linked["id"] if linked else None,
                symbolBroker=s.symbol, side=o["direction"], kind=o["order_type"], volumeLots=number(o["volume"]),
                entryBroker=number(o["price"]), entryGc=float(decimal(o["price"])-basis) if basis is not None else None,
                basisStale=basis is None or not s.synced or not s.events_live, actionPending=target in targets,
                updatedAt=timestamp(o.get("update_time") or o.get("create_time")))
            for wire, name in (("stop_loss_price", "sl"), ("take_profit_price", "tp")):
                value = o.get(wire)
                row[name+"Broker"] = number(value) if value is not None else None
                row[name+"Gc"] = float(decimal(value)-basis) if value is not None and basis is not None else None
            if o["direction"] in price_pnl:
                row["pnlPerPriceUnit"] = price_pnl[o["direction"]]
            pending_action = self._get_pending_action(user_id, s.client.account_id, broker_order_id=oid, order_id=linked["id"] if linked else None)
            if pending_action:
                row["pendingAction"] = pending_action
            orders.append(row)
        return dict(positions=positions, orders=orders)

    async def patch(self, user_id, body, *, order_id=None, position_id=None, broker_order_id=None):
        s = self.session(user_id)
        async with s.lock:
            self._guard(s)
            local = self._order(user_id, order_id) if order_id else None
            position_id = position_id or (local or {}).get("brokerPositionTicket")
            broker_order_id = broker_order_id or (local or {}).get("brokerOrderTicket")
            levels = {name: body[name] for name in PRICE_FIELDS if name in body}
            deltas = body.get("priceDeltas", {})
            if not isinstance(deltas, dict) or (set(deltas) - PRICE_FIELDS.keys()) or levels.keys() & deltas.keys():
                raise ExecutionError("BAD_REQUEST", "Invalid chart price changes", 400)
            break_even = body.get("breakEven") is True or body.get("action") == "break_even"
            if break_even and (not position_id or "slGc" in (levels.keys() | deltas.keys())):
                raise ExecutionError("BAD_REQUEST", "Break-even requires an open position and no separate stop change", 400)
            if not levels and not deltas and not break_even:
                raise ExecutionError("BAD_REQUEST", "Provide a price or protection change", 400)
            if position_id:
                position_id = uint64(position_id)
                position = self._position(s, position_id)
                if "entryGc" in (levels.keys() | deltas.keys()):
                    raise ExecutionError("BAD_REQUEST", "An open position entry cannot be edited", 400)
                raw = self._protection(s, position_id, position)
                broker_order_id = raw.get("order_id")
                method = "PATCH" if broker_order_id else "POST"
                path = s.client.trading_path + (f"/orders/{broker_order_id}" if broker_order_id else "/orders")
                payload = {} if broker_order_id else dict(type="sltp", position_id=position_id)
                target = "p:" + position_id
                if break_even:
                    payload["stop_loss_price"] = self.price(s, position.get("open_price"))
                    if method == "POST" and "tpGc" not in (levels.keys() | deltas.keys()) and raw.get("take_profit_price") is not None:
                        payload["take_profit_price"] = raw["take_profit_price"]
            else:
                broker_order_id = uint64(broker_order_id or "")
                raw = self._pending(s, broker_order_id)
                method, path, payload, target = "PATCH", s.client.trading_path+f"/orders/{broker_order_id}", {}, "o:"+broker_order_id
            if levels and local is None:
                ticket_field = "brokerPositionTicket" if position_id else "brokerOrderTicket"
                local = next((o for o in self.store.orders(user_id) if o["accountId"] == s.client.account_id
                              and o.get(ticket_field) == (position_id or broker_order_id)), None)
            for name, value in deltas.items():
                wire = PRICE_FIELDS[name]
                if raw.get(wire) is None:
                    raise ExecutionError("CONFLICT", "Price level changed in Exness; refresh the chart before editing")
                payload[wire] = self.price(s, decimal(raw[wire]) + decimal(value))
            for name, value in levels.items():
                if name == "entryGc" and value is None:
                    raise ExecutionError("BAD_REQUEST", "Pending entry cannot be removed", 400)
                if value is None and method == "POST":
                    continue
                if value is not None:
                    basis = self._chart_basis(s, target, local)
                    if basis is None:
                        raise ExecutionError("BASIS_STALE", "Waiting for fresh Rithmic and Exness prices")
                    value = self.price(s, decimal(value, positive=True)+basis)
                payload[PRICE_FIELDS[name]] = value
            if not any(wire in payload for wire in PRICE_FIELDS.values()):
                return self._order(user_id, order_id) if order_id else dict(pending=False)
            key = body.get("idempotencyKey") or "edit-"+secrets.token_hex(16)
            op_summary = await self._dispatch(s, key, "modify", dict(method=method, path=path, body=payload, target=target),
                                               local["id"] if local else None)
            if order_id:
                updated = self._order(user_id, order_id)
                updated["operation"] = op_summary
                return updated
            return dict(pending=True, operation=op_summary)

    def _position(self, s, pid):
        position = s.positions.get(pid)
        if position is None or position.get("instrument") != s.symbol:
            raise ExecutionError("NOT_FOUND", "Position not found", 404)
        return position

    def _pending(self, s, oid):
        pending = s.orders.get(oid)
        if (pending is None or pending.get("instrument") != s.symbol or pending.get("order_type") not in {"limit", "stop"}
                or pending.get("state") != "placed"):
            raise ExecutionError("NOT_FOUND", "Pending order not found", 404)
        return pending

    async def close(self, user_id, *, order_id=None, position_id=None, volume=None, close_fifty_percent=False, key=None, action="close", trailing=None):
        s = self.session(user_id)
        async with s.lock:
            local = self._order(user_id, order_id) if order_id else None
            position_id = uint64(position_id or (local or {}).get("brokerPositionTicket", ""))
            position = self._position(s, position_id)
            path = s.client.trading_path + f"/positions/{position_id}"

            if close_fifty_percent:
                step = decimal(s.condition["volume_step"])
                min_vol = decimal(s.condition["volume_min"])
                current = decimal(position["volume"])
                half = (current / 2 // step) * step
                if half < min_vol:
                    raise ExecutionError("BAD_REQUEST", f"50% volume {half} is below broker minimum {min_vol}", 400)
                if current - half < min_vol:
                    raise ExecutionError("BAD_REQUEST", f"Remaining volume {current - half} is below broker minimum {min_vol}", 400)
                volume = half

            if volume is not None:
                current, partial = decimal(position["volume"]), decimal(self.volume(s, volume))
                if partial > current:
                    raise ExecutionError("BAD_REQUEST", "Close volume exceeds remaining position volume", 400)
                if partial < current:
                    remainder = current - partial
                    min_vol = decimal(s.condition["volume_min"])
                    if remainder < min_vol:
                        raise ExecutionError("BAD_REQUEST", f"Remaining volume {remainder} is below broker minimum {min_vol}", 400)
                    self.volume(s, remainder)
                path += "?" + urlencode({"volume": format(partial, "f")})
            request = dict(method="DELETE", path=path, target="p:" + position_id)
            if trailing:
                request["trailing"] = trailing
            op_summary = await self._dispatch(s, key or ("close-" + secrets.token_hex(16)), action, request, local["id"] if local else None)
            if local:
                ord_data = self._order(user_id, local["id"])
                if op_summary:
                    ord_data["operation"] = op_summary
                return ord_data
            return dict(pending=True, operation=op_summary)

    async def cancel(self, user_id, *, order_id=None, broker_order_id=None, key=None):
        s = self.session(user_id)
        async with s.lock:
            local = self._order(user_id, order_id) if order_id else None
            oid = uint64(broker_order_id or (local or {}).get("brokerOrderTicket", ""))
            self._pending(s, oid)
            op_summary = await self._dispatch(s, key or ("cancel-" + secrets.token_hex(16)), "cancel",
                dict(method="DELETE", path=s.client.trading_path+f"/orders/{oid}", target="o:"+oid), local["id"] if local else None)
            if local:
                ord_data = self._order(user_id, local["id"])
                if op_summary:
                    ord_data["operation"] = op_summary
                return ord_data
            return dict(pending=True, operation=op_summary)

    def get_operation(self, user_id, identifier):
        s = self.session(user_id)
        ident = str(identifier).strip()
        if not re.fullmatch(r"[A-Za-z0-9._~-]{1,128}", ident):
            raise ExecutionError("BAD_REQUEST", "Invalid operation identifier", 400)
        op = self.store.operation(user_id, ident)
        if not op:
            for item in self.store.operations(user_id):
                if item["account_id"] == s.client.account_id and (str(item.get("operation_id") or "") == ident or item.get("key") == ident):
                    op = item
                    break
        if not op or op.get("account_id") != s.client.account_id:
            raise ExecutionError("NOT_FOUND", "Operation not found", 404)

        result = op.get("result")
        if isinstance(result, str):
            try:
                result = json.loads(result)
            except Exception:
                result = None
        error_msg = None
        if isinstance(result, dict):
            error_msg = result.get("error_message") or (result.get("error") if isinstance(result.get("error"), str) else None)

        req = json.loads(op["request"]) if isinstance(op.get("request"), str) else (op.get("request") or {})
        return dict(
            key=op.get("key"),
            operationId=str(op.get("operation_id")) if op.get("operation_id") else None,
            state=op.get("state"),
            action=op.get("action"),
            target=req.get("target"),
            orderId=op.get("order_id"),
            reason=error_msg,
            createdAt=op.get("created_at"),
            updatedAt=op.get("updated_at") or op.get("created_at")
        )

    def _trailing_config(self, body, *, prefix=""):
        def get(name, fallback):
            return body.get(prefix+name[0].upper()+name[1:] if prefix else name, fallback)
        tf = get("timeframe", "1m")
        if tf not in SUPERTREND_TIMEFRAMES:
            raise ExecutionError("BAD_REQUEST", "Unsupported trailing timeframe", 400)
        try:
            config = SupertrendConfig(period=get("period", 10), multiplier=get("multiplier", 3),
                atr_method=get("atrMethod", "rma"), source=get("source", "hl2"))
        except (ValueError, TypeError):
            raise ExecutionError("BAD_REQUEST", "Invalid SuperTrend settings", 400) from None
        return dict(timeframe=tf, period=config.period, multiplier=config.multiplier, atrMethod=config.atr_method, source=config.source)

    def set_trailing(self, user_id, target_type, target_id, body):
        s = self.session(user_id)
        self._guard(s)
        config = self._trailing_config(body)
        local = self._order(user_id, target_id) if target_type == "order" else None
        pid = uint64((local or {}).get("brokerPositionTicket") or target_id)
        self._position(s, pid)
        bars = self.cache.read_bars("GC", "GC", config["timeframe"], limit=config["period"]*5+100)
        closed = [b for b in bars if b.closed]
        if len(closed) < config["period"]+2:
            raise ExecutionError("CONFLICT", "Not enough confirmed GC bars to activate SuperTrend")
        now = now_ms()
        rule = dict(targetType=target_type, targetId=target_id, brokerPositionTicket=pid,
            side=self._position(s, pid)["direction"], lastBarTime=closed[-1].time, lastLine=None,
            createdAt=now, updatedAt=now, **config)
        self.store.save_trailing(user_id, rule)
        return rule

    async def _maintenance(self):
        last_restore = 0
        while True:
            if time.monotonic()-last_restore > 30:
                last_restore = time.monotonic()
                for account in self.store.accounts():
                    if account["enabled"] and account["user_id"] not in self.sessions:
                        self._schedule_restore(account["user_id"])
            await asyncio.gather(*(self._maintain_session(s) for s in list(self.sessions.values())))
            await asyncio.sleep(1)

    async def _maintain_session(self, s):
        try:
            await self._poll_operations(s)
            if s.synced and s.events_live and s.refresh_snapshot:
                async with s.lock:
                    if s.refresh_snapshot:
                        snapshot = await s.client.request("GET", s.client.trading_path+"/snapshot")
                        self._apply_snapshot(s, snapshot)
                        self._reconcile(s)
            if not hasattr(s, "config_at") or time.monotonic()-s.config_at > 60:
                s.config_at = time.monotonic()
                details = await s.client.request("GET", s.client.config_path+"/account")
                s.settings = details.get("settings", s.settings)
            if s.synced and s.events_live:
                await self._manage(s)
        except ExecutionError:
            pass
        except Exception:
            s.error = "Execution synchronization needs attention"

    async def _poll_operations(self, s):
        for op in self.store.operations(s.user_id):
            if op["account_id"] != s.client.account_id or op["state"] in FINAL or not op["operation_id"]:
                continue
            age = now_ms() - op["created_at"]
            if age < 3000 or age > 23 * 3600 * 1000:
                continue
            # Poll each operation at most once per 3 seconds, without resubmission.
            if not hasattr(self, "_polled"):
                self._polled = {}
            if time.monotonic() - self._polled.get(op["key"], 0) < 3:
                continue
            self._polled[op["key"]] = time.monotonic()
            op_id_str = str(op["operation_id"])
            result = await s.client.request("GET", s.client.trading_path + "/operations/" + op_id_str)
            raw_status = result.get("status")
            status = {"success": "confirmed", "confirmed": "confirmed", "rejected": "rejected", "failed": "failed"}.get(raw_status)
            if not status or status not in FINAL:
                continue
            async with s.lock:
                current = self.store.operation(s.user_id, op["key"])
                if current["state"] in FINAL:
                    continue
                snapshot = await s.client.request("GET", s.client.trading_path + "/snapshot")
                self._apply_snapshot(s, snapshot)
                self.store.update_operation(s.user_id, op["key"], status, op_id_str, result=result)
                confirmed_entities = snapshot if op["action"] in {"close", "cancel", "partial_1r"} else {}
                broker_err = self._extract_broker_error(result) or result.get("error_code") or result.get("error_message")
                self._finish_operation(s, op, status, confirmed_entities, broker_err)
                self._reconcile(s)

    async def _manage(self, s):
        for order in self.store.orders(s.user_id):
            if order["accountId"] != s.client.account_id or order["status"] != "filled" or order.get("brokerPositionTicket") not in s.positions:
                continue
            if any(op["order_id"] == order["id"] and op["state"] not in FINAL for op in self.store.operations(s.user_id)):
                continue
            if order.get("partial1rDone") and order.get("autoSupertrendAfter1rEnabled") and not order.get("autoTrailingArmed"):
                try:
                    self.set_trailing(s.user_id, "order", order["id"], self._trailing_config(order, prefix="trailing"))
                except ExecutionError:
                    pass
                else:
                    order["autoTrailingArmed"] = True
                    self.store.save_order(s.user_id, order)
            if (order.get("takeProfit1rEnabled") and not order.get("partial1rDone") and order.get("initialRiskGc")
                    and self._fresh_quote(s)):
                position = self._position(s, order["brokerPositionTicket"])
                if position.get("open_price") is None:
                    continue
                entry = decimal(position["open_price"])
                is_buy = position["direction"] == "buy"
                close_price = decimal(s.tick["bid" if is_buy else "ask"])
                move = close_price-entry if is_buy else entry-close_price
                if move >= decimal(order["initialRiskGc"]):
                    step = decimal(s.condition["volume_step"])
                    current = decimal(position["volume"])
                    half = (current/2//step)*step
                    if half >= decimal(s.condition["volume_min"]) and current-half >= decimal(s.condition["volume_min"]):
                        config = self._trailing_config(order, prefix="trailing") if order.get("autoSupertrendAfter1rEnabled") else None
                        await self.close(s.user_id, order_id=order["id"], volume=half,
                            key="partial1r-"+order["id"], action="partial_1r", trailing=config)
                        continue
        for rule in self.store.trailings(s.user_id):
            if rule["brokerPositionTicket"] not in s.positions:
                self.store.delete_trailing(s.user_id, rule["targetType"], rule["targetId"])
                continue
            bars = self.cache.read_bars("GC", "GC", rule["timeframe"], limit=rule["period"]*5+100)
            closed = [b for b in bars if b.closed]
            if not closed or closed[-1].time <= (rule.get("lastBarTime") or 0):
                continue
            state = SupertrendState(SupertrendConfig(rule["period"], rule["multiplier"], rule["atrMethod"], rule["source"]))
            point = None
            for bar in closed:
                point = state.on_closed_bar(SupertrendBar(bar.time, bar.open, bar.high, bar.low, bar.close))
            rule.update(lastBarTime=closed[-1].time, lastLine=point.value, updatedAt=now_ms())
            self.store.save_trailing(s.user_id, rule)
            crossed = point.value is not None and (closed[-1].close < point.value if rule["side"] == "buy" else closed[-1].close > point.value)
            if crossed:
                await self.close(s.user_id, order_id=rule["targetId"] if rule["targetType"] == "order" else None,
                    position_id=rule["brokerPositionTicket"], key="st-"+rule["brokerPositionTicket"]+"-"+str(closed[-1].time))

    async def _events(self, s):
        delay = 1
        while not self._stopping:
            try:
                s.synced = False
                async with s.client.stream("events") as ws:
                    s.events_live = True
                    s.events_error = None
                    await ws.send(json.dumps({"id": "transactions", "subscribe": {"event": "transactions"}}))
                    await ws.send(json.dumps({"id": "account", "subscribe": {"event": "account_state"}}))
                    await ws.send(json.dumps({"id": "instruments", "subscribe": {"event": "instruments", "instruments": [s.symbol]}}))
                    await ws.send(json.dumps({"id": "hmr", "subscribe": {"event": "hmr", "instruments": [s.symbol]}}))
                    async for raw in ws:
                        message = json.loads(raw)
                        s.events_response = self._stream_response(message)
                        if self._subscription_reply(message):
                            continue
                        await self.event(s, message)
                        delay = 1
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                s.events_reconnects += 1
                s.events_error = self._stream_error_code(exc)
                s.error = "Exness account stream disconnected; reconnecting"
            finally:
                s.events_live, s.synced = False, False
            await asyncio.sleep(delay)
            delay = min(delay*2, 30)

    async def _ticks(self, s):
        delay = 1
        while not self._stopping:
            try:
                async with s.client.stream("ticks") as ws:
                    s.ticks_live = True
                    s.ticks_error = None
                    instruments = {s.symbol, *(name for name, _ in s.conversion_legs)}
                    await ws.send(json.dumps({"id": "ticks", "subscribe": {"event": "ticks", "instruments": sorted(instruments)}}))
                    async for raw in ws:
                        s.tick_frames += 1
                        message = json.loads(raw)
                        s.ticks_response = self._stream_response(message)
                        if self._subscription_reply(message):
                            continue
                        payload = message.get("payload", message)
                        ticks = payload if isinstance(payload, list) else payload.get("ticks", [payload])
                        for tick in ticks:
                            instrument = tick.get("instrument")
                            if instrument in instruments and number(tick.get("ask")) >= number(tick.get("bid")) > 0:
                                if instrument == s.symbol:
                                    s.tick, s.tick_at = tick, timestamp(tick.get("timestamp"))
                                else:
                                    s.conversion_ticks[instrument] = tick
                                delay = 1
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                s.ticks_reconnects += 1
                s.ticks_error = self._stream_error_code(exc)
                s.error = "Exness quote stream disconnected; reconnecting"
            finally:
                s.ticks_live = False
            await asyncio.sleep(delay)
            delay = min(delay*2, 30)

    @staticmethod
    def _subscription_reply(message):
        if "code" not in message:
            return False
        # Live streams acknowledge subscriptions with code 200 (also as a string).
        if message["code"] in (200, "200"):
            return True
        error = message.get("error_message")
        code = error if isinstance(error, str) and error in PUBLIC_API_ERRORS else "EXNESS_SUBSCRIPTION_ERROR"
        raise ExecutionError(code, "Exness stream subscription failed: " + code, 503)

    @staticmethod
    def _stream_response(message):
        # Strictly allowlisted metadata only; never expose arbitrary upstream text.
        fields = {"id", "code", "error_message", "event_type", "payload", "instrument", "bid", "ask", "timestamp", "ticks"}
        result = {"fields": sorted(fields.intersection(message))}
        if type(message.get("code")) is int:
            result["code"] = message["code"]
        elif isinstance(message.get("code"), str) and re.fullmatch(r"[0-9]{1,6}", message["code"]):
            result["code"] = int(message["code"])
        error = message.get("error_message")
        if isinstance(error, str):
            result["error"] = error if error in PUBLIC_API_ERRORS else "UNRECOGNIZED_ERROR"
        event = message.get("event_type")
        if event in {"trading_state_snapshot", "transaction_event", "account_state_event", "instrument_event", "hmr_snapshot", "hmr_update"}:
            result["event"] = event
        return result

    @staticmethod
    def _stream_error_code(exc):
        # Exception text can contain authenticated URLs; expose the class/status only.
        status = getattr(getattr(exc, "response", None), "status_code", None)
        code = exc.code if isinstance(exc, ExecutionError) and exc.code in PUBLIC_API_ERRORS | {"EXNESS_SUBSCRIPTION_ERROR"} else None
        return type(exc).__name__ + (f":{code}" if code else "") + (f":HTTP{status}" if isinstance(status, int) else "")
