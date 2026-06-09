"""Subprocess entrypoint for one real MT5 terminal/account session.

The MetaTrader5 Python package is process-global. Running one worker process per
terminal keeps multiple live accounts from forcing the same terminal to relog.
"""

from __future__ import annotations

import json
import sys
import traceback
from dataclasses import asdict
from enum import Enum
from typing import Any

from ..models.orders import OrderKind, OrderRecord, OrderSide, OrderSource, OrderStatus
from .worker import RealMt5Backend


def main() -> None:
    backend = RealMt5Backend()
    for raw in sys.stdin:
        try:
            request = json.loads(raw)
            result = _dispatch(backend, request)
            _write({"id": request.get("id"), "ok": True, "result": result})
        except Exception as exc:
            _write(
                {
                    "id": _request_id(raw),
                    "ok": False,
                    "error": str(exc),
                    "traceback": traceback.format_exc(),
                }
            )


def _dispatch(backend: RealMt5Backend, request: dict[str, Any]) -> Any:
    method = str(request.get("method"))
    params = request.get("params")
    if not isinstance(params, dict):
        params = {}
    if method == "shutdown":
        backend.close()
        return None
    if method == "connect_account":
        backend.connect_account(
            login=int(params["login"]),
            password=str(params["password"]),
            server=str(params["server"]),
            terminal_path=params.get("terminal_path"),
        )
        return None
    if method == "account_info":
        return _jsonable(
            backend.account_info(str(params["user_id"]), str(params["account_id"]))
        )
    if method == "symbol_info":
        return _jsonable(
            backend.symbol_info(
                str(params["user_id"]),
                str(params["account_id"]),
                str(params["symbol"]),
            )
        )
    if method == "symbol_tick":
        return _jsonable(
            backend.symbol_tick(
                str(params["user_id"]),
                str(params["account_id"]),
                str(params["symbol"]),
            )
        )
    if method == "place_order":
        return _jsonable(backend.place_order(_order_from_payload(params["order"])))
    if method == "modify_order":
        return _jsonable(backend.modify_order(_order_from_payload(params["order"])))
    if method == "cancel_order":
        return _jsonable(backend.cancel_order(_order_from_payload(params["order"])))
    if method == "close_position":
        return _jsonable(backend.close_position(_order_from_payload(params["order"])))
    if method == "orders":
        return backend.orders(str(params["user_id"]), str(params["account_id"]))
    if method == "positions":
        return backend.positions(str(params["user_id"]), str(params["account_id"]))
    raise RuntimeError(f"Unknown MT5 worker method {method!r}")


def _order_from_payload(payload: dict[str, Any]) -> OrderRecord:
    data = dict(payload)
    data["source"] = OrderSource(data["source"])
    data["side"] = OrderSide(data["side"])
    data["kind"] = OrderKind(data["kind"])
    data["status"] = OrderStatus(data["status"])
    return OrderRecord(**data)


def _jsonable(value: Any) -> Any:
    if hasattr(value, "__dataclass_fields__"):
        return _jsonable(asdict(value))
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, dict):
        return {key: _jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(item) for item in value]
    return value


def _request_id(raw: str) -> Any:
    try:
        request = json.loads(raw)
    except Exception:
        return None
    return request.get("id") if isinstance(request, dict) else None


def _write(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, separators=(",", ":")) + "\n")
    sys.stdout.flush()


if __name__ == "__main__":
    main()
