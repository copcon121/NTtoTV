"""Typed serializers/deserializers for all WebSocket message types.

Every message on `/ws/nt` and `/ws/chart` is a JSON object discriminated by a
``type`` field. This module defines the typed Python representations together
with ``to_dict`` / ``from_dict`` (and a few ``from_*`` constructors) that map
to and from the exact JSON shapes documented in the design's "WebSocket
Message Schemas" section.

Wire conventions (matching the design):

* Field names on the wire are camelCase (``bestBid``, ``bidSize``,
  ``buyVolume``, ``deltaHigh``, ``alertId``, ...); Python attributes use
  snake_case and the (de)serializers bridge the two.
* All ``time`` values are a Canonical_Timestamp (integer ms since the Unix
  epoch UTC; see ``app.models.timestamp``).
* The two ``status`` messages differ by direction: NT_AddOn -> Backend carries
  ``source`` (``NTStatusEvent``); Backend -> client carries an optional
  ``reason`` (``ChartStatusEvent``).

Channels:

* ``/ws/nt`` data plane (NT_AddOn -> Backend): ``trade``, ``quote``,
  ``status`` (``NTStatusEvent``).
* ``/ws/nt`` control plane (Backend -> NT_AddOn): ``control``
  (``ControlCommand``).
* ``/ws/chart`` client -> Backend: ``subscribe``, ``unsubscribe``, ``pong``.
* ``/ws/chart`` Backend -> client: ``bar_update``, ``quote_update``,
  ``volume_delta_update``, ``footprint_update``, ``fvg_signal_update``,
  ``big_trade``, ``market_data_status``, ``alert_event``, ``status``
  (``ChartStatusEvent``), ``ping``.

(Requirements 1.1, 1.2, 5.2)
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, ClassVar

from .canonical import NormalizedQuote, NormalizedTrade, Side
from .timestamp import CanonicalTimestamp

__all__ = [
    # Enums
    "StatusState",
    "ControlAction",
    "ImbalanceSide",
    "EventType",
    # /ws/nt data plane (trade/quote reuse the canonical models)
    "trade_to_dict",
    "trade_from_dict",
    "quote_to_dict",
    "quote_from_dict",
    "NTStatusEvent",
    # /ws/nt control plane
    "ControlCommand",
    # /ws/chart client -> backend
    "Subscribe",
    "Unsubscribe",
    "Pong",
    # /ws/chart backend -> client
    "OHLCVBar",
    "BarUpdate",
    "QuoteUpdate",
    "VolumeDeltaUpdate",
    "FootprintRow",
    "StackedImbalance",
    "UnfinishedAuction",
    "FootprintUpdate",
    "FvgSignalUpdate",
    "TduSignalUpdate",
    "LiquidityUpdate",
    "BigTrade",
    "MarketDataStatus",
    "AlertEvent",
    "ChartStatusEvent",
    "Ping",
    # Dispatchers
    "decode_nt_data_message",
    "decode_chart_client_message",
]


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class StatusState(str, Enum):
    """Connection/state value carried by ``status`` messages. (Req 3.4, 20.1)"""

    CONNECTED = "connected"
    DEGRADED = "degraded"
    DISCONNECTED = "disconnected"

    def __str__(self) -> str:  # pragma: no cover - cosmetic
        return self.value


class ControlAction(str, Enum):
    """Action carried by a ``control`` Control_Command. (Req 1.7, 1.8, 4.6)"""

    SUBSCRIBE = "subscribe"
    UNSUBSCRIBE = "unsubscribe"

    def __str__(self) -> str:  # pragma: no cover - cosmetic
        return self.value


class ImbalanceSide(str, Enum):
    """Side of a footprint imbalance (bid/ask ladder side). (Req 14.4, 14.10)"""

    BID = "bid"
    ASK = "ask"

    def __str__(self) -> str:  # pragma: no cover - cosmetic
        return self.value


class EventType(str, Enum):
    """Subscribable `/ws/chart` event types. (Req 5.2)"""

    BAR_UPDATE = "bar_update"
    QUOTE_UPDATE = "quote_update"
    VOLUME_DELTA_UPDATE = "volume_delta_update"
    FOOTPRINT_UPDATE = "footprint_update"
    FVG_SIGNAL_UPDATE = "fvg_signal_update"
    TDU_SIGNAL_UPDATE = "tdu_signal_update"
    LIQUIDITY_UPDATE = "liquidity_update"
    BIG_TRADE = "big_trade"
    MARKET_DATA_STATUS = "market_data_status"
    ALERT_EVENT = "alert_event"
    ORDER_UPDATE = "order_update"
    POSITION_UPDATE = "position_update"
    ACCOUNT_UPDATE = "account_update"
    BASIS_UPDATE = "basis_update"
    RISK_UPDATE = "risk_update"
    STATUS = "status"
    PING = "ping"

    def __str__(self) -> str:  # pragma: no cover - cosmetic
        return self.value


_LEGACY_IGNORED_CHART_EVENTS = frozenset({"bookmap_si_event"})


def _decode_chart_event_types(values: Any) -> list[EventType]:
    """Ignore removed SI events while old browser tabs migrate to the new bundle."""
    return [EventType(value) for value in values if value not in _LEGACY_IGNORED_CHART_EVENTS]


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _expect_type(data: dict[str, Any], expected: str) -> None:
    """Validate the ``type`` discriminator of an incoming message."""
    actual = data.get("type")
    if actual != expected:
        raise ValueError(f"expected message type {expected!r}, got {actual!r}")


# ---------------------------------------------------------------------------
# /ws/nt data plane (NT_AddOn -> Backend)
# ---------------------------------------------------------------------------
#
# `trade` and `quote` map directly onto the canonical models from Task 2.1, so
# rather than redefine them we provide (de)serializers that bridge the
# camelCase wire shape <-> NormalizedTrade / NormalizedQuote.


def trade_to_dict(trade: NormalizedTrade) -> dict[str, Any]:
    """Serialize a ``NormalizedTrade`` into the `trade` wire shape. (Req 1.1)"""
    payload = {
        "type": "trade",
        "symbol": trade.symbol,
        "contract": trade.contract,
        "time": trade.time,
        "price": trade.price,
        "volume": trade.volume,
        "bid": trade.bid,
        "ask": trade.ask,
        "bestBid": trade.best_bid,
        "bestAsk": trade.best_ask,
        "sequence": trade.sequence,
    }
    if trade.time_ticks is not None:
        payload["timeTicks"] = trade.time_ticks
    if trade.source != "nt":
        payload["source"] = trade.source
    if trade.source_time_nanos is not None:
        payload["sourceTimeNanos"] = trade.source_time_nanos
    if trade.bridge_time is not None:
        payload["bridgeTime"] = trade.bridge_time
    if trade.side is not None:
        payload["side"] = trade.side.value
    if trade.aggressor_order_id is not None:
        payload["aggressorOrderId"] = trade.aggressor_order_id
    if trade.passive_order_id is not None:
        payload["passiveOrderId"] = trade.passive_order_id
    if trade.execution_start:
        payload["executionStart"] = True
    if trade.execution_end:
        payload["executionEnd"] = True
    if trade.otc:
        payload["otc"] = True
    return payload


def trade_from_dict(data: dict[str, Any]) -> NormalizedTrade:
    """Deserialize a `trade` message into a ``NormalizedTrade``. (Req 1.1)"""
    _expect_type(data, "trade")
    raw_side = data.get("side")
    return NormalizedTrade(
        symbol=data["symbol"],
        contract=data["contract"],
        time=int(data["time"]),
        price=float(data["price"]),
        volume=int(data["volume"]),
        bid=None if data.get("bid") is None else float(data["bid"]),
        ask=None if data.get("ask") is None else float(data["ask"]),
        best_bid=None if data.get("bestBid") is None else float(data["bestBid"]),
        best_ask=None if data.get("bestAsk") is None else float(data["bestAsk"]),
        sequence=int(data["sequence"]),
        time_ticks=(
            None if data.get("timeTicks") is None else int(data["timeTicks"])
        ),
        source=str(data.get("source") or "nt"),
        source_time_nanos=(
            None
            if data.get("sourceTimeNanos") is None
            else int(data["sourceTimeNanos"])
        ),
        bridge_time=(
            None if data.get("bridgeTime") is None else int(data["bridgeTime"])
        ),
        side=None if raw_side is None else Side(str(raw_side)),
        aggressor_order_id=(
            None
            if data.get("aggressorOrderId") is None
            else str(data["aggressorOrderId"])
        ),
        passive_order_id=(
            None
            if data.get("passiveOrderId") is None
            else str(data["passiveOrderId"])
        ),
        execution_start=bool(data.get("executionStart", False)),
        execution_end=bool(data.get("executionEnd", False)),
        otc=bool(data.get("otc", False)),
    )


def quote_to_dict(quote: NormalizedQuote) -> dict[str, Any]:
    """Serialize a ``NormalizedQuote`` into the `quote` wire shape. (Req 1.2)"""
    payload = {
        "type": "quote",
        "symbol": quote.symbol,
        "contract": quote.contract,
        "time": quote.time,
        "bid": quote.bid,
        "ask": quote.ask,
        "bidSize": quote.bid_size,
        "askSize": quote.ask_size,
        "sequence": quote.sequence,
    }
    if quote.bridge_time is not None:
        payload["bridgeTime"] = quote.bridge_time
    return payload


def quote_from_dict(data: dict[str, Any]) -> NormalizedQuote:
    """Deserialize a `quote` message into a ``NormalizedQuote``. (Req 1.2)"""
    _expect_type(data, "quote")
    return NormalizedQuote(
        symbol=data["symbol"],
        contract=data["contract"],
        time=int(data["time"]),
        bid=float(data["bid"]),
        ask=float(data["ask"]),
        bid_size=int(data["bidSize"]),
        ask_size=int(data["askSize"]),
        sequence=int(data["sequence"]),
        bridge_time=(
            None if data.get("bridgeTime") is None else int(data["bridgeTime"])
        ),
    )


@dataclass(slots=True)
class NTStatusEvent:
    """`status` event on `/ws/nt` (NT_AddOn -> Backend). (Req 3.4, 20.1)

    Carries ``source`` (e.g. ``"nt_addon"``) and a ``state`` of
    connected/degraded/disconnected. ``contract`` MAY be included when the
    status is contract-specific.
    """

    type: ClassVar[str] = "status"

    source: str
    state: StatusState
    time: CanonicalTimestamp
    contract: str | None = None

    def to_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "type": self.type,
            "source": self.source,
            "state": self.state.value,
            "time": self.time,
        }
        if self.contract is not None:
            out["contract"] = self.contract
        return out

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "NTStatusEvent":
        _expect_type(data, cls.type)
        return cls(
            source=data["source"],
            state=StatusState(data["state"]),
            time=int(data["time"]),
            contract=data.get("contract"),
        )


# ---------------------------------------------------------------------------
# /ws/nt control plane (Backend -> NT_AddOn)
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class ControlCommand:
    """`control` Control_Command (Backend -> NT_AddOn). (Req 1.7, 1.8, 4.6)

    One contract per command; the Backend sends multiple commands when several
    contracts change.
    """

    type: ClassVar[str] = "control"

    action: ControlAction
    contract: str
    time: CanonicalTimestamp

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "action": self.action.value,
            "contract": self.contract,
            "time": self.time,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ControlCommand":
        _expect_type(data, cls.type)
        return cls(
            action=ControlAction(data["action"]),
            contract=data["contract"],
            time=int(data["time"]),
        )


# ---------------------------------------------------------------------------
# /ws/chart  (Frontend -> Backend)
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class Subscribe:
    """`subscribe` request (client -> Backend). (Req 5.4)

    Requests the given ``events`` for ``symbol``; ``tf`` (timeframe) is
    optional and present for bar/order-flow event subscriptions.
    """

    type: ClassVar[str] = "subscribe"

    symbol: str
    events: list[EventType]
    tf: str | None = None

    def to_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "type": self.type,
            "symbol": self.symbol,
            "events": [e.value for e in self.events],
        }
        if self.tf is not None:
            out["tf"] = self.tf
        return out

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Subscribe":
        _expect_type(data, cls.type)
        return cls(
            symbol=data["symbol"],
            events=_decode_chart_event_types(data["events"]),
            tf=data.get("tf"),
        )


@dataclass(slots=True)
class Unsubscribe:
    """`unsubscribe` request (client -> Backend). (Req 5.5)"""

    type: ClassVar[str] = "unsubscribe"

    symbol: str
    events: list[EventType]
    tf: str | None = None

    def to_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "type": self.type,
            "symbol": self.symbol,
            "events": [e.value for e in self.events],
        }
        if self.tf is not None:
            out["tf"] = self.tf
        return out

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Unsubscribe":
        _expect_type(data, cls.type)
        return cls(
            symbol=data["symbol"],
            events=_decode_chart_event_types(data["events"]),
            tf=data.get("tf"),
        )


@dataclass(slots=True)
class Pong:
    """`pong` response to a `ping` (client -> Backend). (Req 6.2)"""

    type: ClassVar[str] = "pong"

    time: CanonicalTimestamp

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type, "time": self.time}

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Pong":
        _expect_type(data, cls.type)
        return cls(time=int(data["time"]))


# ---------------------------------------------------------------------------
# /ws/chart  (Backend -> Frontend)
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class OHLCVBar:
    """A single OHLCV bar payload (the ``bar`` field of a `bar_update`)."""

    time: CanonicalTimestamp
    open: float
    high: float
    low: float
    close: float
    volume: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "time": self.time,
            "open": self.open,
            "high": self.high,
            "low": self.low,
            "close": self.close,
            "volume": self.volume,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "OHLCVBar":
        return cls(
            time=int(data["time"]),
            open=float(data["open"]),
            high=float(data["high"]),
            low=float(data["low"]),
            close=float(data["close"]),
            volume=int(data["volume"]),
        )


@dataclass(slots=True)
class BarUpdate:
    """`bar_update` event (Backend -> client). (Req 5.2, 9.3)"""

    type: ClassVar[str] = "bar_update"

    symbol: str
    contract: str
    tf: str
    bar: OHLCVBar
    closed: bool
    source: str | None = None

    def to_dict(self) -> dict[str, Any]:
        out = {
            "type": self.type,
            "symbol": self.symbol,
            "contract": self.contract,
            "tf": self.tf,
            "bar": self.bar.to_dict(),
            "closed": self.closed,
        }
        if self.source is not None:
            out["source"] = self.source
        return out

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "BarUpdate":
        _expect_type(data, cls.type)
        return cls(
            symbol=data["symbol"],
            contract=data["contract"],
            tf=data["tf"],
            bar=OHLCVBar.from_dict(data["bar"]),
            closed=bool(data["closed"]),
            source=data.get("source"),
        )


@dataclass(slots=True)
class QuoteUpdate:
    """`quote_update` event (Backend -> client). (Req 5.2)"""

    type: ClassVar[str] = "quote_update"

    symbol: str
    contract: str
    time: CanonicalTimestamp
    bid: float
    ask: float
    bid_size: int
    ask_size: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "symbol": self.symbol,
            "contract": self.contract,
            "time": self.time,
            "bid": self.bid,
            "ask": self.ask,
            "bidSize": self.bid_size,
            "askSize": self.ask_size,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "QuoteUpdate":
        _expect_type(data, cls.type)
        return cls(
            symbol=data["symbol"],
            contract=data["contract"],
            time=int(data["time"]),
            bid=float(data["bid"]),
            ask=float(data["ask"]),
            bid_size=int(data["bidSize"]),
            ask_size=int(data["askSize"]),
        )


@dataclass(slots=True)
class VolumeDeltaUpdate:
    """`volume_delta_update` event (Backend -> client). (Req 5.2, 13.1)

    ``cumulative_delta`` is present on the wire (as ``cumulativeDelta``) only
    when CumulativeDelta mode is enabled. (Req 13.7)
    """

    type: ClassVar[str] = "volume_delta_update"

    symbol: str
    contract: str
    tf: str
    time: CanonicalTimestamp
    volume: int
    buy_volume: int
    sell_volume: int
    delta: int
    delta_high: int
    delta_low: int
    open_delta: int
    close_delta: int
    cumulative_delta: int | None = None

    def to_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "type": self.type,
            "symbol": self.symbol,
            "contract": self.contract,
            "tf": self.tf,
            "time": self.time,
            "volume": self.volume,
            "buyVolume": self.buy_volume,
            "sellVolume": self.sell_volume,
            "delta": self.delta,
            "deltaHigh": self.delta_high,
            "deltaLow": self.delta_low,
            "openDelta": self.open_delta,
            "closeDelta": self.close_delta,
        }
        if self.cumulative_delta is not None:
            out["cumulativeDelta"] = self.cumulative_delta
        return out

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "VolumeDeltaUpdate":
        _expect_type(data, cls.type)
        raw_cum = data.get("cumulativeDelta")
        return cls(
            symbol=data["symbol"],
            contract=data["contract"],
            tf=data["tf"],
            time=int(data["time"]),
            volume=int(data["volume"]),
            buy_volume=int(data["buyVolume"]),
            sell_volume=int(data["sellVolume"]),
            delta=int(data["delta"]),
            delta_high=int(data["deltaHigh"]),
            delta_low=int(data["deltaLow"]),
            open_delta=int(data["openDelta"]),
            close_delta=int(data["closeDelta"]),
            cumulative_delta=None if raw_cum is None else int(raw_cum),
        )


@dataclass(slots=True)
class FootprintRow:
    """One price level of a footprint ladder. (Req 14.3, 14.4)

    ``imbalance`` is the imbalanced side at this level (``bid``/``ask``) or
    ``None`` when the level is not imbalanced.
    """

    price: float
    bid: int
    ask: int
    imbalance: ImbalanceSide | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "price": self.price,
            "bid": self.bid,
            "ask": self.ask,
            "imbalance": None if self.imbalance is None else self.imbalance.value,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "FootprintRow":
        raw = data.get("imbalance")
        return cls(
            price=float(data["price"]),
            bid=int(data["bid"]),
            ask=int(data["ask"]),
            imbalance=None if raw is None else ImbalanceSide(raw),
        )


@dataclass(slots=True)
class StackedImbalance:
    """A run of >=2 consecutive same-side imbalanced levels. (Req 14.10)"""

    side: ImbalanceSide
    from_price: float
    to_price: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "side": self.side.value,
            "from": self.from_price,
            "to": self.to_price,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "StackedImbalance":
        return cls(
            side=ImbalanceSide(data["side"]),
            from_price=float(data["from"]),
            to_price=float(data["to"]),
        )


@dataclass(slots=True)
class UnfinishedAuction:
    """Unfinished-auction flags at the bar extremes. (Req 14)"""

    high: bool
    low: bool

    def to_dict(self) -> dict[str, Any]:
        return {"high": self.high, "low": self.low}

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "UnfinishedAuction":
        return cls(high=bool(data["high"]), low=bool(data["low"]))


@dataclass(slots=True)
class FootprintUpdate:
    """`footprint_update` event (Backend -> client). (Req 5.2, 14)"""

    type: ClassVar[str] = "footprint_update"

    symbol: str
    contract: str
    tf: str
    time: CanonicalTimestamp
    rows: list[FootprintRow]
    poc: float
    bar_delta: int
    buy_pct: float
    sell_pct: float
    stacked_imbalance: list[StackedImbalance]
    unfinished_auction: UnfinishedAuction
    open: float = 0.0
    high: float = 0.0
    low: float = 0.0
    close: float = 0.0
    poc_volume: int = 0
    vah: float = 0.0
    val: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "symbol": self.symbol,
            "contract": self.contract,
            "tf": self.tf,
            "time": self.time,
            "rows": [r.to_dict() for r in self.rows],
            "open": self.open,
            "high": self.high,
            "low": self.low,
            "close": self.close,
            "poc": self.poc,
            "pocVolume": self.poc_volume,
            "vah": self.vah,
            "val": self.val,
            "barDelta": self.bar_delta,
            "buyPct": self.buy_pct,
            "sellPct": self.sell_pct,
            "stackedImbalance": [s.to_dict() for s in self.stacked_imbalance],
            "unfinishedAuction": self.unfinished_auction.to_dict(),
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "FootprintUpdate":
        _expect_type(data, cls.type)
        return cls(
            symbol=data["symbol"],
            contract=data["contract"],
            tf=data["tf"],
            time=int(data["time"]),
            rows=[FootprintRow.from_dict(r) for r in data["rows"]],
            poc=float(data["poc"]),
            bar_delta=int(data["barDelta"]),
            buy_pct=float(data["buyPct"]),
            sell_pct=float(data["sellPct"]),
            stacked_imbalance=[
                StackedImbalance.from_dict(s) for s in data["stackedImbalance"]
            ],
            unfinished_auction=UnfinishedAuction.from_dict(data["unfinishedAuction"]),
            open=float(data.get("open", 0.0)),
            high=float(data.get("high", 0.0)),
            low=float(data.get("low", 0.0)),
            close=float(data.get("close", 0.0)),
            poc_volume=int(data.get("pocVolume", 0)),
            vah=float(data.get("vah", data.get("poc", 0.0))),
            val=float(data.get("val", data.get("poc", 0.0))),
        )


@dataclass(slots=True)
class FvgSignalUpdate:
    """`fvg_signal_update` event (Backend -> client)."""

    type: ClassVar[str] = "fvg_signal_update"

    symbol: str
    contract: str
    tf: str
    time: CanonicalTimestamp
    direction: int
    level: int
    pulse: int
    top: float | None
    bottom: float | None
    breakout_ratio: float
    phase: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "symbol": self.symbol,
            "contract": self.contract,
            "tf": self.tf,
            "time": self.time,
            "direction": self.direction,
            "level": self.level,
            "pulse": self.pulse,
            "top": self.top,
            "bottom": self.bottom,
            "breakoutRatio": self.breakout_ratio,
            "phase": self.phase,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "FvgSignalUpdate":
        _expect_type(data, cls.type)
        return cls(
            symbol=data["symbol"],
            contract=data["contract"],
            tf=data["tf"],
            time=int(data["time"]),
            direction=int(data["direction"]),
            level=int(data["level"]),
            pulse=int(data["pulse"]),
            top=None if data.get("top") is None else float(data["top"]),
            bottom=None if data.get("bottom") is None else float(data["bottom"]),
            breakout_ratio=float(data["breakoutRatio"]),
            phase=str(data["phase"]),
        )


@dataclass(slots=True)
class TduSignalUpdate:
    """Original-style TDU momentum and candle/delta divergence state."""

    type: ClassVar[str] = "tdu_signal_update"

    symbol: str
    contract: str
    tf: str
    time: CanonicalTimestamp
    momentum_direction: int
    momentum_level: int
    delta_divergence: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "symbol": self.symbol,
            "contract": self.contract,
            "tf": self.tf,
            "time": self.time,
            "momentumDirection": self.momentum_direction,
            "momentumLevel": self.momentum_level,
            "deltaDivergence": self.delta_divergence,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "TduSignalUpdate":
        _expect_type(data, cls.type)
        return cls(
            symbol=data["symbol"],
            contract=data["contract"],
            tf=data["tf"],
            time=int(data["time"]),
            momentum_direction=int(data["momentumDirection"]),
            momentum_level=int(data["momentumLevel"]),
            delta_divergence=int(data["deltaDivergence"]),
        )


@dataclass(slots=True)
class LiquidityUpdate:
    """Reduced Bookmap depth signal streamed to the standalone LQ chart."""

    type: ClassVar[str] = "liquidity_update"

    symbol: str
    contract: str
    sequence: int
    time: CanonicalTimestamp
    event_kind: str
    action: str
    side: str
    price: float
    size: int
    previous_size: int
    change: int
    threshold: int
    dom_distance: int | None
    strength: float
    source_contract: str | None = None
    line_id: str | None = None
    line_start_time: CanonicalTimestamp | None = None
    snapshot: bool = False

    def to_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "type": self.type,
            "symbol": self.symbol,
            "contract": self.contract,
            "sequence": self.sequence,
            "time": self.time,
            "eventKind": self.event_kind,
            "action": self.action,
            "side": self.side,
            "price": self.price,
            "size": self.size,
            "previousSize": self.previous_size,
            "change": self.change,
            "threshold": self.threshold,
            "domDistance": self.dom_distance,
            "strength": self.strength,
            "snapshot": self.snapshot,
        }
        if self.source_contract is not None:
            out["sourceContract"] = self.source_contract
        if self.line_id is not None:
            out["lineId"] = self.line_id
        if self.line_start_time is not None:
            out["lineStartTime"] = self.line_start_time
        return out


@dataclass(slots=True)
class BigTrade:
    """`big_trade` event (Backend -> client). (Req 5.2, 15.4, 15.5)"""

    type: ClassVar[str] = "big_trade"

    symbol: str
    contract: str
    trade_id: int
    time: CanonicalTimestamp
    price: float
    volume: int
    side: Side
    source: str | None = None

    def to_dict(self) -> dict[str, Any]:
        out = {
            "type": self.type,
            "symbol": self.symbol,
            "contract": self.contract,
            "tradeId": self.trade_id,
            "time": self.time,
            "price": self.price,
            "volume": self.volume,
            "side": self.side.value,
        }
        if self.source is not None:
            out["source"] = self.source
        return out

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "BigTrade":
        _expect_type(data, cls.type)
        return cls(
            symbol=data["symbol"],
            contract=data["contract"],
            trade_id=int(data.get("tradeId", 0)),
            time=int(data["time"]),
            price=float(data["price"]),
            volume=int(data["volume"]),
            side=Side(data["side"]),
            source=data.get("source"),
        )


@dataclass(slots=True)
class MarketDataStatus:
    """Current feed selection and rolling latency diagnostics."""

    type: ClassVar[str] = "market_data_status"

    symbol: str
    time: CanonicalTimestamp
    active_source: str | None
    preferred_source: str
    switched_at: CanonicalTimestamp | None
    reason: str | None
    sources: dict[str, dict[str, Any]]

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type,
            "symbol": self.symbol,
            "time": self.time,
            "activeSource": self.active_source,
            "preferredSource": self.preferred_source,
            "switchedAt": self.switched_at,
            "reason": self.reason,
            "sources": self.sources,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "MarketDataStatus":
        _expect_type(data, cls.type)
        return cls(
            symbol=str(data["symbol"]),
            time=int(data["time"]),
            active_source=data.get("activeSource"),
            preferred_source=str(data["preferredSource"]),
            switched_at=(
                None if data.get("switchedAt") is None else int(data["switchedAt"])
            ),
            reason=data.get("reason"),
            sources=dict(data.get("sources") or {}),
        )


@dataclass(slots=True)
class AlertEvent:
    """`alert_event` event (Backend -> client). (Req 5.2, 17.2)

    ``level`` is the configured level for level-based alert types and may be
    omitted for alert types that have no associated level.
    """

    type: ClassVar[str] = "alert_event"

    alert_id: str
    alert_type: str
    symbol: str
    contract: str
    time: CanonicalTimestamp
    price: float
    message: str
    profile_id: str = "default"
    level: float | None = None
    direction: int | None = None

    def to_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "type": self.type,
            "alertId": self.alert_id,
            "alertType": self.alert_type,
            "symbol": self.symbol,
            "contract": self.contract,
            "time": self.time,
            "price": self.price,
            "message": self.message,
        }
        if self.profile_id != "default":
            out["profileId"] = self.profile_id
        if self.level is not None:
            out["level"] = self.level
        if self.direction is not None:
            out["direction"] = self.direction
        return out

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "AlertEvent":
        _expect_type(data, cls.type)
        raw_level = data.get("level")
        raw_direction = data.get("direction")
        return cls(
            alert_id=data["alertId"],
            alert_type=data["alertType"],
            symbol=data["symbol"],
            contract=data["contract"],
            time=int(data["time"]),
            price=float(data["price"]),
            message=data["message"],
            profile_id=str(data.get("profileId", "default")),
            level=None if raw_level is None else float(raw_level),
            direction=None if raw_direction is None else int(raw_direction),
        )


@dataclass(slots=True)
class ChartStatusEvent:
    """`status` event on `/ws/chart` (Backend -> client). (Req 5.2, 20)

    Differs from ``NTStatusEvent`` by carrying an optional ``reason`` (e.g.
    ``"stream_gap"``) instead of a ``source``. ``contract`` MAY be included
    when the status is contract-specific.
    """

    type: ClassVar[str] = "status"

    state: StatusState
    time: CanonicalTimestamp
    reason: str | None = None
    contract: str | None = None

    def to_dict(self) -> dict[str, Any]:
        out: dict[str, Any] = {
            "type": self.type,
            "state": self.state.value,
            "time": self.time,
        }
        if self.reason is not None:
            out["reason"] = self.reason
        if self.contract is not None:
            out["contract"] = self.contract
        return out

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ChartStatusEvent":
        _expect_type(data, cls.type)
        return cls(
            state=StatusState(data["state"]),
            time=int(data["time"]),
            reason=data.get("reason"),
            contract=data.get("contract"),
        )


@dataclass(slots=True)
class Ping:
    """`ping` event (Backend -> client). (Req 5.2, 6.1)"""

    type: ClassVar[str] = "ping"

    time: CanonicalTimestamp

    def to_dict(self) -> dict[str, Any]:
        return {"type": self.type, "time": self.time}

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Ping":
        _expect_type(data, cls.type)
        return cls(time=int(data["time"]))


# ---------------------------------------------------------------------------
# Inbound dispatchers (decode by the `type` discriminator)
# ---------------------------------------------------------------------------


def decode_nt_data_message(
    data: dict[str, Any],
) -> NormalizedTrade | NormalizedQuote | NTStatusEvent:
    """Decode an inbound `/ws/nt` data-plane frame (NT_AddOn -> Backend).

    Dispatches on the ``type`` discriminator to ``trade`` / ``quote`` /
    ``status``. Raises ``ValueError`` for unknown types. (Req 1.1, 1.2, 4.1)
    """
    msg_type = data.get("type")
    if msg_type == "trade":
        return trade_from_dict(data)
    if msg_type == "quote":
        return quote_from_dict(data)
    if msg_type == "status":
        return NTStatusEvent.from_dict(data)
    raise ValueError(f"unknown /ws/nt data message type: {msg_type!r}")


def decode_chart_client_message(
    data: dict[str, Any],
) -> Subscribe | Unsubscribe | Pong:
    """Decode an inbound `/ws/chart` frame (Frontend -> Backend).

    Dispatches on the ``type`` discriminator to ``subscribe`` / ``unsubscribe``
    / ``pong``. Raises ``ValueError`` for unknown types. (Req 5.4, 5.5, 6.2)
    """
    msg_type = data.get("type")
    if msg_type == "subscribe":
        return Subscribe.from_dict(data)
    if msg_type == "unsubscribe":
        return Unsubscribe.from_dict(data)
    if msg_type == "pong":
        return Pong.from_dict(data)
    raise ValueError(f"unknown /ws/chart client message type: {msg_type!r}")
