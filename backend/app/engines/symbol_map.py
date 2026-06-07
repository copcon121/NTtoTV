"""Internal GC -> broker XAU symbol mapping helpers."""

from __future__ import annotations

from dataclasses import dataclass

from ..config import Settings, settings as default_settings
from ..models.mt5 import Mt5SymbolInfo

__all__ = ["SymbolMap"]


@dataclass(slots=True)
class SymbolMap:
    symbol_internal: str
    symbol_broker: str
    tick_size: float
    digits: int
    pip_value: float
    stops_level: float

    @classmethod
    def from_info(
        cls,
        info: Mt5SymbolInfo,
        *,
        symbol_internal: str = "GC",
    ) -> "SymbolMap":
        return cls(
            symbol_internal=symbol_internal,
            symbol_broker=info.symbol,
            tick_size=info.tick_size,
            digits=info.digits,
            pip_value=info.pip_value,
            stops_level=info.stops_level,
        )

    @classmethod
    def default(cls, settings: Settings | None = None) -> "SymbolMap":
        s = settings or default_settings
        return cls(
            symbol_internal="GC",
            symbol_broker=s.default_broker_symbol,
            tick_size=s.broker_tick_size,
            digits=s.broker_digits,
            pip_value=s.broker_pip_value,
            stops_level=0.5,
        )

    def round_price(self, price: float) -> float:
        ticks = round(price / self.tick_size)
        return round(ticks * self.tick_size, self.digits)
