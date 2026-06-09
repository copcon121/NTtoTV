from __future__ import annotations

import pytest

from app.config import Settings
from app.mt5.manager import Mt5Manager


class _Backend:
    def __init__(self, current_login: int | None = None) -> None:
        self.current_login_value = current_login
        self.login_calls: list[int] = []

    def current_login(self) -> int | None:
        return self.current_login_value

    def connect_account(
        self,
        *,
        login: int,
        password: str,
        server: str,
        terminal_path: str | None = None,
    ) -> None:
        self.login_calls.append(int(login))
        self.current_login_value = int(login)


def _real_settings() -> Settings:
    return Settings(mt5_backend="real", credential_key="k")


def test_real_manager_refuses_to_switch_terminal_login() -> None:
    backend = _Backend()
    manager = Mt5Manager(settings=_real_settings(), backend=backend)

    with manager.connect_account_session(
        login=111,
        password="pw",
        server="Broker",
    ):
        pass

    with pytest.raises(RuntimeError, match="refusing to switch to 222"):
        with manager.connect_account_session(
            login=222,
            password="pw",
            server="Broker",
        ):
            pass

    assert backend.login_calls == [111]


def test_real_manager_allows_same_terminal_login() -> None:
    backend = _Backend()
    manager = Mt5Manager(settings=_real_settings(), backend=backend)

    for _ in range(2):
        with manager.connect_account_session(
            login=111,
            password="pw",
            server="Broker",
        ):
            pass

    assert backend.login_calls == [111, 111]


def test_real_manager_refuses_to_switch_existing_terminal_login() -> None:
    backend = _Backend(current_login=111)
    manager = Mt5Manager(settings=_real_settings(), backend=backend)

    with pytest.raises(RuntimeError, match="already logged into 111"):
        with manager.connect_account_session(
            login=222,
            password="pw",
            server="Broker",
        ):
            pass

    assert backend.login_calls == []


def test_fake_manager_keeps_multi_account_test_behavior() -> None:
    backend = _Backend()
    manager = Mt5Manager(
        settings=Settings(mt5_backend="fake", credential_key="k"),
        backend=backend,
    )

    for login in (111, 222):
        with manager.connect_account_session(
            login=login,
            password="pw",
            server="Broker",
        ):
            pass

    assert backend.login_calls == [111, 222]


def test_real_process_manager_allows_distinct_terminal_paths(monkeypatch, tmp_path) -> None:
    from app.mt5 import process_client

    workers: list[_Backend] = []

    class _Worker(_Backend):
        def __init__(self) -> None:
            super().__init__()
            workers.append(self)

    monkeypatch.setattr(process_client, "Mt5WorkerProcessBackend", _Worker)
    manager = Mt5Manager(settings=_real_settings())

    with manager.connect_account_session(
        login=111,
        password="pw",
        server="Broker",
        terminal_path=str(tmp_path / "mt5a" / "terminal64.exe"),
    ):
        pass
    with manager.connect_account_session(
        login=222,
        password="pw",
        server="Broker",
        terminal_path=str(tmp_path / "mt5b" / "terminal64.exe"),
    ):
        pass

    assert [worker.login_calls for worker in workers] == [[111], [222]]


def test_real_process_manager_rejects_same_terminal_path_for_two_logins(
    monkeypatch,
    tmp_path,
) -> None:
    from app.mt5 import process_client

    monkeypatch.setattr(process_client, "Mt5WorkerProcessBackend", _Backend)
    manager = Mt5Manager(settings=_real_settings())
    terminal = str(tmp_path / "mt5" / "terminal64.exe")

    with manager.connect_account_session(
        login=111,
        password="pw",
        server="Broker",
        terminal_path=terminal,
    ):
        pass

    with pytest.raises(RuntimeError, match="already bound to login 111"):
        with manager.connect_account_session(
            login=222,
            password="pw",
            server="Broker",
            terminal_path=terminal,
        ):
            pass
