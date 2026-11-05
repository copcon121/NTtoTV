"""Run blocking broker mutations without blocking the chart event loop."""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from threading import Lock
from typing import Any, TypeVar

from fastapi import Request

_Result = TypeVar("_Result")


async def run_trading_operation(
    request: Request,
    user_id: str,
    operation: Callable[..., _Result],
    *args: Any,
) -> _Result:
    # This setup runs on the event loop. Hold the lock inside the worker so
    # cancelling an HTTP request cannot release it while MT5 is still working.
    locks = getattr(request.app.state, "trading_operation_locks", None)
    if locks is None:
        locks = {}
        request.app.state.trading_operation_locks = locks
    lock = locks.setdefault(user_id, Lock())
    request.state.trading_loop = asyncio.get_running_loop()

    def blocking() -> _Result:
        with lock:
            return operation(*args)

    return await asyncio.to_thread(blocking)
