"""Parent-process proxy for a real MT5 subprocess worker."""

from __future__ import annotations

import json
import subprocess
import sys
from dataclasses import fields
from enum import Enum
from threading import RLock
from typing import Any

from ..models.mt5 import Mt5AccountInfo, Mt5OrderResult, Mt5SymbolInfo, Mt5Tick
from ..models.orders import OrderRecord

__all__ = ["Mt5WorkerProcessBackend"]

# Maximum seconds to wait for a response from the MT5 subprocess worker.
# If the worker hangs (e.g. MT5 terminal unresponsive), the call raises
# instead of blocking the thread pool / event loop forever.
_WORKER_TIMEOUT_S = 30


class Mt5WorkerProcessBackend:
    def __init__(self) -> None:
        self._lock = RLock()
        self._process: subprocess.Popen[str] | None = None
        self._next_id = 1

    def connect_account(
        self,
        *,
        login: int,
        password: str,
        server: str,
        terminal_path: str | None = None,
    ) -> None:
        self._call(
            "connect_account",
            {
                "login": int(login),
                "password": password,
                "server": server,
                "terminal_path": terminal_path,
            },
        )

    def account_info(self, user_id: str, account_id: str) -> Mt5AccountInfo:
        return Mt5AccountInfo(**self._call("account_info", _identity(user_id, account_id)))

    def symbol_info(self, user_id: str, account_id: str, symbol: str) -> Mt5SymbolInfo:
        return Mt5SymbolInfo(
            **self._call(
                "symbol_info",
                {**_identity(user_id, account_id), "symbol": symbol},
            )
        )

    def symbol_tick(self, user_id: str, account_id: str, symbol: str) -> Mt5Tick:
        return Mt5Tick(
            **self._call(
                "symbol_tick",
                {**_identity(user_id, account_id), "symbol": symbol},
            )
        )

    def place_order(self, order: OrderRecord) -> Mt5OrderResult:
        return Mt5OrderResult(
            **self._call("place_order", {"order": _order_payload(order)})
        )

    def modify_order(self, order: OrderRecord) -> Mt5OrderResult:
        return Mt5OrderResult(
            **self._call("modify_order", {"order": _order_payload(order)})
        )

    def cancel_order(self, order: OrderRecord) -> Mt5OrderResult:
        return Mt5OrderResult(
            **self._call("cancel_order", {"order": _order_payload(order)})
        )

    def close_position(self, order: OrderRecord) -> Mt5OrderResult:
        return Mt5OrderResult(
            **self._call("close_position", {"order": _order_payload(order)})
        )

    def orders(self, user_id: str, account_id: str) -> list[dict]:
        rows = self._call("orders", _identity(user_id, account_id))
        return rows if isinstance(rows, list) else []

    def positions(self, user_id: str, account_id: str) -> list[dict]:
        rows = self._call("positions", _identity(user_id, account_id))
        return rows if isinstance(rows, list) else []

    def close(self) -> None:
        with self._lock:
            process = self._process
            if process is None:
                return
            try:
                self._call_locked("shutdown", {})
            except Exception:
                pass
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)
            self._process = None

    def _call(self, method: str, params: dict[str, Any]) -> Any:
        with self._lock:
            return self._call_locked(method, params)

    def _call_locked(self, method: str, params: dict[str, Any]) -> Any:
        process = self._ensure_process_locked()
        request_id = self._next_id
        self._next_id += 1
        payload = {"id": request_id, "method": method, "params": params}
        assert process.stdin is not None
        assert process.stdout is not None
        try:
            process.stdin.write(json.dumps(payload, separators=(",", ":")) + "\n")
            process.stdin.flush()
        except OSError as exc:
            self._process = None
            raise RuntimeError(f"MT5 worker write failed: {exc}") from exc
        # readline() on a subprocess pipe has no native timeout on Windows.
        # Use a background thread so a hung worker cannot block forever.
        import threading

        result_box: list[str] = []
        error_box: list[Exception] = []

        def _read():
            try:
                result_box.append(process.stdout.readline())
            except Exception as exc:
                error_box.append(exc)

        reader = threading.Thread(target=_read, daemon=True)
        reader.start()
        reader.join(timeout=_WORKER_TIMEOUT_S)
        if reader.is_alive():
            # Worker did not respond in time — kill it.
            process.kill()
            process.wait(timeout=5)
            self._process = None
            raise RuntimeError(
                f"MT5 worker timed out after {_WORKER_TIMEOUT_S}s on {method}"
            )
        if error_box:
            self._process = None
            raise RuntimeError(f"MT5 worker read failed: {error_box[0]}") from error_box[0]
        raw = result_box[0] if result_box else ""
        if raw == "":
            code = process.poll()
            self._process = None
            raise RuntimeError(f"MT5 worker exited unexpectedly ({code})")
        try:
            response = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"MT5 worker returned invalid JSON: {raw!r}") from exc
        if response.get("id") != request_id:
            raise RuntimeError("MT5 worker response id mismatch")
        if not response.get("ok"):
            raise RuntimeError(str(response.get("error") or "MT5 worker failed"))
        return response.get("result")

    def _ensure_process_locked(self) -> subprocess.Popen[str]:
        if self._process is not None and self._process.poll() is None:
            return self._process
        self._process = subprocess.Popen(
            [sys.executable, "-u", "-m", "app.mt5.process_worker"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            encoding="utf-8",
        )
        return self._process


def _identity(user_id: str, account_id: str) -> dict[str, str]:
    return {"user_id": user_id, "account_id": account_id}


def _order_payload(order: OrderRecord) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for field in fields(order):
        value = getattr(order, field.name)
        if isinstance(value, Enum):
            value = value.value
        out[field.name] = value
    return out
