"""MT5 manager facade.

The current implementation is deliberately fake-backed by default. The real
worker can be added behind this facade without changing REST/order code.
"""

from __future__ import annotations

from ..config import Settings, settings as default_settings
from .base import Mt5Backend
from .fake import FakeMt5Backend

__all__ = ["Mt5Manager"]


class Mt5Manager:
    def __init__(
        self,
        *,
        settings: Settings | None = None,
        backend: Mt5Backend | None = None,
    ) -> None:
        self._settings = settings or default_settings
        if backend is not None:
            self._backend = backend
        elif self._settings.mt5_backend.lower() == "real":
            from .worker import RealMt5Backend

            self._backend = RealMt5Backend(settings=self._settings)
        else:
            self._backend = FakeMt5Backend(
                symbol=self._settings.default_broker_symbol,
                tick_size=self._settings.broker_tick_size,
                digits=self._settings.broker_digits,
            )

    @property
    def backend(self) -> Mt5Backend:
        return self._backend
