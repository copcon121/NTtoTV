"""Storage record dataclasses for the Cache_Store keyed tables.

These records map 1:1 onto the Cache_Store table columns and are the inputs to
the keyed last-write-wins upserts and the outputs of the keyed range reads
implemented in task 3.6. They are deliberately decoupled from the camelCase
``/ws/chart`` wire message dataclasses in :mod:`app.models.messages`: the wire
types carry transport concerns (a ``type`` discriminator, derived fields like
``cumulativeDelta`` that are not persisted, nested payloads) whereas these
records are flat row shapes keyed by ``(symbol, contract, timeframe, time)``
(or ``(symbol, contract, time, side, trade_id)`` for big trades). (Requirement
8.2)

All ``time`` fields are a Canonical_Timestamp (integer ms since the Unix epoch
UTC; see :mod:`app.models.timestamp`).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ..models import ImbalanceSide, Side
from ..models.timestamp import CanonicalTimestamp

__all__ = [
    "BarRecord",
    "VolumeDeltaRecord",
    "FootprintBarRecord",
    "FootprintLevelRecord",
    "FvgSignalRecord",
    "BigTradeRecord",
    "ProfileRecord",
    "AlertRecord",
    "AlertEventRecord",
]


@dataclass(slots=True)
class BarRecord:
    """An OHLCV bar row in the ``bars`` table.

    Keyed by ``(symbol, contract, timeframe, time)``. ``closed`` flags whether
    the bar's interval has elapsed. (Req 8.2, 9.1)
    """

    symbol: str
    contract: str
    timeframe: str
    time: CanonicalTimestamp
    open: float
    high: float
    low: float
    close: float
    volume: int
    closed: bool = False


@dataclass(slots=True)
class VolumeDeltaRecord:
    """A per-bar volume-delta summary row in ``orderflow_volume_delta``.

    Keyed by ``(symbol, contract, timeframe, time)``. The cumulative-delta value
    is derived at read time and is intentionally not persisted here. (Req 8.2,
    13.1)
    """

    symbol: str
    contract: str
    timeframe: str
    time: CanonicalTimestamp
    volume: int
    buy_volume: int
    sell_volume: int
    delta: int
    delta_high: int
    delta_low: int
    open_delta: int
    close_delta: int


@dataclass(slots=True)
class FootprintBarRecord:
    """A footprint bar header row in ``footprint_bars``.

    Keyed by ``(symbol, contract, timeframe, time)`` (timeframe is ``1m`` for
    the v1 footprint). The bid-by-ask ladder is stored separately as
    :class:`FootprintLevelRecord` rows. (Req 8.2, 14.4)
    """

    symbol: str
    contract: str
    timeframe: str
    time: CanonicalTimestamp
    poc: float | None
    bar_delta: int
    buy_pct: float
    sell_pct: float
    unfinished_high: bool = False
    unfinished_low: bool = False
    open_price: float | None = None
    high_price: float | None = None
    low_price: float | None = None
    close_price: float | None = None
    poc_volume: int = 0
    vah: float | None = None
    val: float | None = None


@dataclass(slots=True)
class FootprintLevelRecord:
    """One bid-by-ask ladder cell row in ``footprint_levels``.

    Keyed by ``(symbol, contract, timeframe, time, price)``. ``imbalance`` is the
    imbalanced side at this price level, or ``None`` when the level is balanced.
    (Req 14.3)
    """

    symbol: str
    contract: str
    timeframe: str
    time: CanonicalTimestamp
    price: float
    bid_volume: int
    ask_volume: int
    imbalance: ImbalanceSide | None = None


@dataclass(slots=True)
class FvgSignalRecord:
    """One confirmed FVG signal row in ``fvg_signals``."""

    symbol: str
    contract: str
    timeframe: str
    time: CanonicalTimestamp
    direction: int
    level: int
    pulse: int
    top: float
    bottom: float
    breakout_ratio: float


@dataclass(slots=True)
class BigTradeRecord:
    """A merged big-trade row in ``big_trades``.

    Keyed by ``(symbol, contract, time, side, trade_id)``. ``trade_id`` is the
    per-contract group ordinal assigned by the BigTrade engine, matching
    NinjaTrader's incrementing BigTrade ``Id`` enough to distinguish multiple
    same-time/same-side groups. Big trades have no timeframe. (Req 8.2, 15.2)
    """

    symbol: str
    contract: str
    time: CanonicalTimestamp
    price: float
    volume: int
    side: Side
    trade_id: int = 0


@dataclass(slots=True)
class ProfileRecord:
    """A saved frontend profile row in the ``profiles`` table.

    ``payload`` is the frontend chart/indicator/drawing configuration serialized
    as JSON by :class:`~app.storage.profile_store.ProfileStore`. Active_Contract
    intentionally stays outside this payload and remains process-global.
    """

    id: str
    name: str
    payload: dict[str, Any] = field(default_factory=dict)
    created_at: CanonicalTimestamp = 0
    updated_at: CanonicalTimestamp = 0
    user_id: str | None = None


@dataclass(slots=True)
class AlertRecord:
    """An alert definition row in the ``alerts`` table. (Req 16, 18.8-18.11)

    ``id`` is the stable alert identifier; ``type`` is one of the six supported
    alert types; ``params`` is the type-specific configuration (e.g. ``level``,
    ``threshold``, ``tf``) carried as a structured dict and persisted as JSON.
    ``enabled`` governs whether the Alert_Engine evaluates the alert (Req 16.4).
    ``created_at`` / ``updated_at`` are Canonical_Timestamps.
    """

    id: str
    symbol: str
    type: str
    profile_id: str = "default"
    params: dict[str, Any] = field(default_factory=dict)
    enabled: bool = True
    created_at: CanonicalTimestamp = 0
    updated_at: CanonicalTimestamp = 0


@dataclass(slots=True)
class AlertEventRecord:
    """A persisted alert-event audit row in ``alert_events``. (Req 17.3)

    ``id`` is the autoincrement primary key, assigned by SQLite on insert and
    ``None`` before persistence. ``price`` is the price that satisfied the
    condition (may be ``None`` for non-price alert types).
    """

    alert_id: str
    symbol: str
    contract: str
    time: CanonicalTimestamp
    message: str
    profile_id: str = "default"
    price: float | None = None
    id: int | None = None
