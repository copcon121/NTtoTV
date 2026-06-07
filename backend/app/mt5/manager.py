"""MT5 manager facade.

The current implementation is deliberately fake-backed by default. The real
worker can be added behind this facade without changing REST/order code.
"""

from __future__ import annotations

from contextlib import contextmanager
from threading import RLock
from typing import Iterator, TYPE_CHECKING

from ..config import Settings, settings as default_settings
from .base import Mt5Backend
from .fake import FakeMt5Backend

__all__ = ["Mt5Manager"]

if TYPE_CHECKING:
    from ..models.mt5 import Mt5AccountRecord
    from ..storage.cache_store import CacheStore


class Mt5Manager:
    def __init__(
        self,
        *,
        settings: Settings | None = None,
        backend: Mt5Backend | None = None,
    ) -> None:
        self._settings = settings or default_settings
        self._lock = RLock()
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

    def credential_key(self) -> str:
        key = self._settings.credential_key
        if key is None and self._settings.mt5_backend == "fake":
            key = "fake-local-development-key"
        if not key:
            raise RuntimeError("Missing NTTOTV_CREDENTIAL_KEY")
        return key

    @contextmanager
    def backend_session(self) -> Iterator[Mt5Backend]:
        with self._lock:
            yield self._backend

    @contextmanager
    def account_session(
        self,
        cache: "CacheStore",
        account: "Mt5AccountRecord",
    ) -> Iterator[Mt5Backend]:
        with self._lock:
            connector = getattr(self._backend, "connect_account", None)
            if callable(connector):
                password = cache.users.read_mt5_password(
                    account.user_id,
                    self.credential_key(),
                )
                if password is None:
                    raise RuntimeError("MT5 account password is not stored")
                connector(
                    login=account.login,
                    password=password,
                    server=account.server,
                    terminal_path=account.terminal_path,
                )
            yield self._backend
