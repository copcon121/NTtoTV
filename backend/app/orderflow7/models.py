"""OF7 research records. All prices are integer tick indices; time is UTC ms."""

from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class OF7Cell:
    price: int
    bid: int = 0
    ask: int = 0
    between: int = 0

    def __post_init__(self) -> None:
        if type(self.price) is not int:
            raise ValueError("price must be an integer tick index")
        if any(type(v) is not int or v < 0 for v in (self.bid, self.ask, self.between)):
            raise ValueError("cell volumes must be nonnegative integers")

    @property
    def volume(self) -> int:
        return self.bid + self.ask + self.between

    @property
    def delta(self) -> int:
        return self.ask - self.bid


@dataclass(frozen=True, slots=True)
class OF7Bar:
    time: int
    open: int
    high: int
    low: int
    close: int
    cells: tuple[OF7Cell, ...]
    session_id: str
    is_closed: bool = True
    source: str = "unknown"
    source_contract: str = "unknown"
    between_known: bool = True
    timeframe_ms: int = 60_000
    reference_bar_index: int | None = None
    reference_current_bar_index: int | None = None
    observed_volume: int | None = None

    def __post_init__(self) -> None:
        object.__setattr__(self, "cells", tuple(self.cells))
        if any(type(v) is not int for v in (self.time, self.open, self.high, self.low, self.close)):
            raise ValueError("time and OHLC must be integers")
        if self.time < 0 or type(self.timeframe_ms) is not int or self.timeframe_ms <= 0:
            raise ValueError("invalid time or timeframe")
        if not self.session_id or type(self.is_closed) is not bool or type(self.between_known) is not bool:
            raise ValueError("session_id and explicit boolean state are required")
        if not self.low <= min(self.open, self.close) <= max(self.open, self.close) <= self.high:
            raise ValueError("OHLC range is inconsistent")
        prices = [c.price for c in self.cells]
        if prices != sorted(set(prices)):
            raise ValueError("ladder must be sorted with unique prices")
        if any(p < self.low or p > self.high for p in prices):
            raise ValueError("cell outside bar range")
        for index in (self.reference_bar_index, self.reference_current_bar_index):
            if index is not None and (type(index) is not int or index < 0):
                raise ValueError("reference bar indices must be nonnegative integers")
        if (self.reference_bar_index is not None and self.reference_current_bar_index is not None
                and self.reference_current_bar_index < self.reference_bar_index):
            raise ValueError("reference CurrentBar cannot precede evaluated bar")
        if self.observed_volume is not None and (
            type(self.observed_volume) is not int or self.observed_volume < self.volume
        ):
            raise ValueError("observed_volume must be an integer at least as large as classified volume")

    @property
    def volume(self) -> int:
        return sum(c.volume for c in self.cells)

    @property
    def delta(self) -> int:
        return sum(c.delta for c in self.cells)

    @property
    def unclassified_volume(self) -> int | None:
        return None if self.observed_volume is None else self.observed_volume - self.volume

    @property
    def up(self) -> bool:
        return self.open < self.close

    @property
    def down(self) -> bool:
        return self.open > self.close


@dataclass(frozen=True, slots=True)
class OF7Frame:
    bar: OF7Bar
    poc: int | None
    poc_bid: int | None
    poc_ask: int | None
    val: int | None
    vah: int | None
    ask_imbalances: tuple[int, ...]
    bid_imbalances: tuple[int, ...]
    is_session_high: bool = False
    is_session_low: bool = False


@dataclass(frozen=True, slots=True)
class OF7Signal:
    feature: str
    side: str
    price: int
    zone_low: int
    zone_high: int
    original_series: str
    metrics: dict[str, float] = field(default_factory=dict)
    warnings: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class OF7UnfinishedLevel:
    origin_index: int
    price: int
    side: str  # high / low; never an order direction
    end_index: int | None = None


@dataclass(frozen=True, slots=True)
class OF7UnfinishedState:
    bar_index: int
    created: tuple[OF7UnfinishedLevel, ...]
    finalized: tuple[OF7UnfinishedLevel, ...]
    open_levels: tuple[OF7UnfinishedLevel, ...]


@dataclass(frozen=True, slots=True)
class OF7Snapshot:
    frame: OF7Frame
    signals: tuple[OF7Signal, ...]
    observed_at: int
    config_hash: str
    warnings: tuple[str, ...]
    schema_version: str = "of7-research-v2"
    measurements: dict[str, float | int | None] = field(default_factory=dict)
    analysis_signals: tuple[OF7Signal, ...] = ()
    research_policy_version: str = "of7-corrections-v1"
    calculation_basis: str = "aggregate_snapshot_approximation"
    unfinished_business: OF7UnfinishedState | None = None
