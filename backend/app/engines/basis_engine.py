"""Dynamic GC -> XAU basis tracking for order conversion."""

from __future__ import annotations

from dataclasses import dataclass

from ..config import Settings, settings as default_settings
from ..models.timestamp import CanonicalTimestamp, now_ms
from .symbol_map import SymbolMap

__all__ = ["BasisSnapshot", "ConvertedPrice", "BasisEngine"]


@dataclass(slots=True)
class BasisSnapshot:
    basis: float
    stale: bool
    time: CanonicalTimestamp
    gc_price: float | None = None
    broker_mid: float | None = None
    warning: str | None = None


@dataclass(slots=True)
class ConvertedPrice:
    price: float
    raw_price: float
    basis: float
    stale: bool
    warning: str | None = None


class BasisEngine:
    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or default_settings
        current = now_ms()
        self._basis = float(self._settings.basis_default)
        self._last_update = current
        self._gc_price: float | None = None
        self._broker_mid: float | None = None

    def update_gc(self, price: float, at: int | None = None) -> None:
        self._gc_price = float(price)
        self._last_update = int(at or now_ms())

    def update_broker_mid(self, mid: float, at: int | None = None) -> None:
        self._broker_mid = float(mid)
        self._last_update = int(at or now_ms())
        if self._gc_price is not None:
            raw = self._broker_mid - self._gc_price
            self._basis = 0.75 * self._basis + 0.25 * raw

    def snapshot(self) -> BasisSnapshot:
        current = now_ms()
        stale = current - self._last_update > self._settings.basis_stale_after_ms
        return BasisSnapshot(
            basis=self._basis,
            stale=stale,
            time=current,
            gc_price=self._gc_price,
            broker_mid=self._broker_mid,
            warning="basis_stale" if stale else None,
        )

    def to_broker(self, level_gc: float, symbol: SymbolMap) -> ConvertedPrice:
        snap = self.snapshot()
        raw = float(level_gc) + snap.basis
        return ConvertedPrice(
            price=symbol.round_price(raw),
            raw_price=raw,
            basis=snap.basis,
            stale=snap.stale,
            warning=snap.warning,
        )

    def from_broker(self, price_broker: float, symbol: SymbolMap) -> ConvertedPrice:
        snap = self.snapshot()
        raw = float(price_broker) - snap.basis
        return ConvertedPrice(
            price=round(raw, 1),
            raw_price=raw,
            basis=snap.basis,
            stale=snap.stale,
            warning=snap.warning,
        )
