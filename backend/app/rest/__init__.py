"""REST_API: HTTP endpoints for the Frontend.

Serves symbols, contracts, history, order-flow, big trades, and alert CRUD.
Reads precomputed bars from the Cache_Store during normal use and rebuilds from
the Tick_Store when required. (Requirements 8.3, 8.5, 11, 18)
"""

from __future__ import annotations

from .contract_state import ContractStateStore, ResolverSeam
from .errors import (
    ApiError,
    ErrorCode,
    bad_request,
    conflict,
    error_envelope,
    install_error_handlers,
    internal_error,
    not_found,
    validation_error,
)
from .routes import get_contract_state, router

__all__ = [
    "router",
    "get_contract_state",
    "ContractStateStore",
    "ResolverSeam",
    "ApiError",
    "ErrorCode",
    "error_envelope",
    "install_error_handlers",
    "bad_request",
    "not_found",
    "conflict",
    "validation_error",
    "internal_error",
]
