"""MT5 manager facade.

Fake mode uses one in-process backend. Real mode uses one subprocess worker per
MT5 terminal binding so multiple live logins do not relog the same terminal.
"""

from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from threading import RLock
from typing import Iterator, TYPE_CHECKING

from ..config import Settings, settings as default_settings
from .base import Mt5Backend
from .fake import FakeMt5Backend

__all__ = ["Mt5Manager"]

if TYPE_CHECKING:
    from ..models.mt5 import Mt5AccountRecord
    from ..storage.cache_store import CacheStore


@dataclass(frozen=True, slots=True)
class _TerminalBinding:
    login: int
    server: str
    terminal_path: str | None


class Mt5Manager:
    def __init__(
        self,
        *,
        settings: Settings | None = None,
        backend: Mt5Backend | None = None,
    ) -> None:
        self._settings = settings or default_settings
        self._lock = RLock()
        self._terminal_binding: _TerminalBinding | None = None
        self._worker_backends: dict[_TerminalBinding, Mt5Backend] = {}
        if backend is not None:
            self._backend: Mt5Backend | None = backend
        elif self._settings.mt5_backend.lower() == "real":
            self._backend = None
        else:
            self._backend = FakeMt5Backend(
                symbol=self._settings.default_broker_symbol,
                tick_size=self._settings.broker_tick_size,
                digits=self._settings.broker_digits,
            )

    @property
    def backend(self) -> Mt5Backend:
        if self._backend is None:
            raise RuntimeError("Real MT5 backend is managed by per-account workers")
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
        if self._backend is None:
            raise RuntimeError("Real MT5 backend requires an account session")
        with self._lock:
            yield self._backend

    @contextmanager
    def connect_account_session(
        self,
        *,
        login: int,
        password: str,
        server: str,
        terminal_path: str | None = None,
    ) -> Iterator[Mt5Backend]:
        if self._backend is None:
            binding = self._binding_for(login, server, terminal_path)
            backend = self._worker_backend_for(binding)
            try:
                backend.connect_account(
                    login=login,
                    password=password,
                    server=server,
                    terminal_path=terminal_path,
                )
            except Exception:
                self._drop_worker_backend(binding)
                raise
            yield backend
            return
        with self._lock:
            binding = self._binding_for(login, server, terminal_path)
            reserved = self._reserve_terminal_binding(binding)
            connector = getattr(self._backend, "connect_account", None)
            try:
                if callable(connector):
                    connector(
                        login=login,
                        password=password,
                        server=server,
                        terminal_path=terminal_path,
                    )
            except Exception:
                if reserved:
                    self._terminal_binding = None
                raise
            yield self._backend

    @contextmanager
    def account_session(
        self,
        cache: "CacheStore",
        account: "Mt5AccountRecord",
    ) -> Iterator[Mt5Backend]:
        if self._backend is None:
            password = cache.users.read_mt5_password(
                account.user_id,
                self.credential_key(),
            )
            if password is None:
                raise RuntimeError("MT5 account password is not stored")
            binding = self._binding_for(
                account.login,
                account.server,
                account.terminal_path,
            )
            backend = self._worker_backend_for(binding)
            try:
                backend.connect_account(
                    login=account.login,
                    password=password,
                    server=account.server,
                    terminal_path=account.terminal_path,
                )
            except Exception:
                self._drop_worker_backend(binding)
                raise
            yield backend
            return
        with self._lock:
            binding = self._binding_for(
                account.login,
                account.server,
                account.terminal_path,
            )
            reserved = self._reserve_terminal_binding(binding)
            connector = getattr(self._backend, "connect_account", None)
            try:
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
            except Exception:
                if reserved:
                    self._terminal_binding = None
                raise
            yield self._backend

    def close(self) -> None:
        with self._lock:
            for backend in self._worker_backends.values():
                closer = getattr(backend, "close", None)
                if callable(closer):
                    closer()
            self._worker_backends.clear()
            closer = getattr(self._backend, "close", None)
            if callable(closer):
                closer()

    def _binding_for(
        self,
        login: int,
        server: str,
        terminal_path: str | None,
    ) -> _TerminalBinding:
        return _TerminalBinding(
            login=int(login),
            server=server.strip().lower(),
            terminal_path=_normalize_terminal_path(terminal_path),
        )

    def _reserve_terminal_binding(self, binding: _TerminalBinding) -> bool:
        if self._settings.mt5_backend.lower() != "real" or self._backend is None:
            return False
        current = self._terminal_binding
        if current is None:
            live_login = self._current_backend_login()
            if live_login is not None and live_login != binding.login:
                raise RuntimeError(
                    "MT5 terminal is already logged into "
                    f"{live_login}; refusing to switch to {binding.login}. "
                    "Run a separate backend/MT5 terminal per real account."
                )
            self._terminal_binding = binding
            return True
        if current != binding:
            raise RuntimeError(
                "This backend is already bound to MT5 login "
                f"{current.login}; refusing to switch to {binding.login}. "
                "Run a separate backend/MT5 terminal per real account."
            )
        return False

    def _current_backend_login(self) -> int | None:
        current_login = getattr(self._backend, "current_login", None)
        if not callable(current_login):
            return None
        try:
            login = current_login()
        except Exception:
            return None
        return None if login is None else int(login)

    def _worker_backend_for(self, binding: _TerminalBinding) -> Mt5Backend:
        with self._lock:
            existing = self._worker_backends.get(binding)
            if existing is not None:
                return existing
            self._evict_stale_bindings(binding)
            self._validate_worker_binding(binding)
            from .process_client import Mt5WorkerProcessBackend

            backend = Mt5WorkerProcessBackend()
            self._worker_backends[binding] = backend
            return backend

    def _drop_worker_backend(self, binding: _TerminalBinding) -> None:
        with self._lock:
            backend = self._worker_backends.pop(binding, None)
        closer = getattr(backend, "close", None)
        if callable(closer):
            closer()

    def _evict_stale_bindings(self, binding: _TerminalBinding) -> None:
        """Remove old workers for the same login+terminal but different server.

        This happens when the same MT5 account reconnects with an updated or
        differently-cased server string.  The old subprocess worker is closed
        so the new binding can take its place without a conflict error.
        """
        stale = [
            key
            for key in self._worker_backends
            if key.login == binding.login
            and key.terminal_path == binding.terminal_path
            and key != binding
        ]
        for key in stale:
            backend = self._worker_backends.pop(key, None)
            closer = getattr(backend, "close", None)
            if callable(closer):
                closer()

    def _validate_worker_binding(self, binding: _TerminalBinding) -> None:
        for existing in self._worker_backends:
            if existing.login == binding.login and existing.server == binding.server:
                if existing.terminal_path != binding.terminal_path:
                    raise RuntimeError(
                        "MT5 login "
                        f"{binding.login} is already bound to another terminal path"
                    )
                continue
            # Same login on a different server with the same terminal path is
            # fine — _evict_stale_bindings already cleaned it up above.
            if existing.login == binding.login:
                continue
            # Different logins with no explicit terminal path each get their own
            # subprocess worker, so there is no shared-terminal conflict.
            if existing.terminal_path is None and binding.terminal_path is None:
                continue
            # One has a path and the other doesn't — ambiguous; could collide
            # with the system default terminal.
            if existing.terminal_path is None or binding.terminal_path is None:
                continue
            if existing.terminal_path == binding.terminal_path:
                raise RuntimeError(
                    "MT5 terminal path is already bound to login "
                    f"{existing.login}; refusing to bind login {binding.login}. "
                    "Use a separate MT5 terminal folder per account."
                )


def _normalize_terminal_path(path: str | None) -> str | None:
    if path is None or not path.strip():
        return None
    return str(Path(path.strip()).expanduser().resolve()).lower()
