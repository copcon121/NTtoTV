"""Shared REST error envelope and exception handlers. (Req 18.12)

Every REST endpoint returns errors in one consistent JSON envelope so the
Frontend can parse failures uniformly:

```json
{ "error": { "code": "NOT_FOUND", "message": "Unknown timeframe '2m' ...", "field": "tf" } }
```

The design's "Error Response Envelope" table maps HTTP status codes to envelope
``code`` values:

| HTTP | code               | When                                            |
| ---- | ------------------ | ----------------------------------------------- |
| 400  | ``BAD_REQUEST``    | malformed/missing query params or body          |
| 404  | ``NOT_FOUND``      | unknown symbol, contract, timeframe, or alert id |
| 409  | ``CONFLICT``       | e.g. set active contract to a non-candidate     |
| 422  | ``VALIDATION_ERROR`` | body fails schema validation                  |
| 500  | ``INTERNAL``       | unexpected server error                         |

This module is the single error seam reused by every REST endpoint (symbols /
contracts / active here in task 10.1, plus history, order-flow, big-trades, and
alert CRUD in later tasks). It exposes:

* :class:`ApiError` — a raisable exception carrying the HTTP status, envelope
  ``code``, ``message``, and optional ``field``;
* small constructors (:func:`bad_request`, :func:`not_found`, :func:`conflict`,
  :func:`validation_error`, :func:`internal_error`) for the common cases;
* :func:`install_error_handlers` — wires FastAPI exception handlers so
  ``ApiError``, framework ``HTTPException``s, request-validation failures
  (422), and otherwise-unhandled exceptions (500) all render the same envelope.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from http import HTTPStatus
from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

__all__ = [
    "ErrorCode",
    "ApiError",
    "bad_request",
    "not_found",
    "conflict",
    "validation_error",
    "internal_error",
    "error_envelope",
    "install_error_handlers",
]


# Envelope ``code`` literals, paired with their canonical HTTP status. Kept as a
# small frozen mapping so the status<->code relationship lives in one place.
class ErrorCode:
    """Envelope ``code`` constants (design Error Response Envelope table)."""

    BAD_REQUEST = "BAD_REQUEST"
    UNAUTHORIZED = "UNAUTHORIZED"
    NOT_FOUND = "NOT_FOUND"
    CONFLICT = "CONFLICT"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    INTERNAL = "INTERNAL"


# HTTP status -> default envelope code for framework-raised HTTPExceptions that
# did not originate as an ApiError (e.g. a bare 404 route miss).
_STATUS_TO_CODE: dict[int, str] = {
    HTTPStatus.BAD_REQUEST: ErrorCode.BAD_REQUEST,            # 400
    HTTPStatus.UNAUTHORIZED: ErrorCode.UNAUTHORIZED,          # 401
    HTTPStatus.NOT_FOUND: ErrorCode.NOT_FOUND,                # 404
    HTTPStatus.CONFLICT: ErrorCode.CONFLICT,                  # 409
    HTTPStatus.UNPROCESSABLE_ENTITY: ErrorCode.VALIDATION_ERROR,  # 422
    HTTPStatus.INTERNAL_SERVER_ERROR: ErrorCode.INTERNAL,     # 500
}


@dataclass(slots=True)
class ApiError(Exception):
    """A REST error rendered into the shared envelope. (Req 18.12)

    ``status`` is the HTTP status code; ``code`` is the envelope code literal;
    ``message`` is a human-readable description; ``field`` optionally names the
    offending request field (e.g. ``"tf"`` or ``"contract"``).
    """

    status: int
    code: str
    message: str
    field: str | None = None

    def __post_init__(self) -> None:
        # Make the exception's ``str()`` useful in logs/tracebacks.
        Exception.__init__(self, self.message)

    def to_envelope(self) -> dict[str, Any]:
        """Render this error as the JSON envelope body."""
        return error_envelope(self.code, self.message, self.field)


def error_envelope(code: str, message: str, field: str | None = None) -> dict[str, Any]:
    """Build the standard ``{"error": {...}}`` envelope body.

    ``field`` is included only when present, keeping the shape minimal for
    errors that do not pertain to a specific request field.
    """
    error: dict[str, Any] = {"code": code, "message": message}
    if field is not None:
        error["field"] = field
    return {"error": error}


# -- convenience constructors -------------------------------------------------


def bad_request(message: str, field: str | None = None) -> ApiError:
    """400 — malformed or missing query params/body."""
    return ApiError(HTTPStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST, message, field)


def not_found(message: str, field: str | None = None) -> ApiError:
    """404 — unknown symbol, contract, timeframe, or alert id. (Req 18.12)"""
    return ApiError(HTTPStatus.NOT_FOUND, ErrorCode.NOT_FOUND, message, field)


def conflict(message: str, field: str | None = None) -> ApiError:
    """409 — e.g. set active contract to a non-candidate."""
    return ApiError(HTTPStatus.CONFLICT, ErrorCode.CONFLICT, message, field)


def validation_error(message: str, field: str | None = None) -> ApiError:
    """422 — body fails schema validation."""
    return ApiError(
        HTTPStatus.UNPROCESSABLE_ENTITY, ErrorCode.VALIDATION_ERROR, message, field
    )


def internal_error(message: str = "Internal server error") -> ApiError:
    """500 — unexpected server error."""
    return ApiError(HTTPStatus.INTERNAL_SERVER_ERROR, ErrorCode.INTERNAL, message)


# -- FastAPI exception handlers -----------------------------------------------


def _first_validation_field(exc: RequestValidationError) -> str | None:
    """Extract the offending field name from a request-validation error.

    Drops the leading location segment (``body`` / ``query`` / ``path``) and
    returns the next path element, which is the field the client cares about.
    Returns ``None`` when no usable field name is available.
    """
    errors = exc.errors()
    if not errors:
        return None
    loc = errors[0].get("loc", ())
    # loc looks like ("body", "contract") or ("query", "symbol").
    parts = [str(p) for p in loc if p not in ("body", "query", "path")]
    return parts[-1] if parts else None


def _validation_location(exc: RequestValidationError) -> str:
    """Return the first error's top-level location (``body``/``query``/``path``)."""
    errors = exc.errors()
    if not errors:
        return "body"
    loc = errors[0].get("loc", ())
    return str(loc[0]) if loc else "body"


def install_error_handlers(app: FastAPI) -> None:
    """Register exception handlers that render the shared error envelope.

    Wiring all of these here guarantees every REST endpoint — current and future
    — surfaces failures in the same shape (Req 18.12):

    * :class:`ApiError` → its declared status/code/message/field;
    * Starlette/FastAPI ``HTTPException`` → mapped to the matching envelope code;
    * ``RequestValidationError`` → 422 ``VALIDATION_ERROR`` with the field;
    * any other unhandled exception → 500 ``INTERNAL`` (details logged, not
      leaked to the client).
    """

    @app.exception_handler(ApiError)
    async def _handle_api_error(_request: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(status_code=exc.status, content=exc.to_envelope())

    @app.exception_handler(RequestValidationError)
    async def _handle_validation(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        field = _first_validation_field(exc)
        message = "Request validation failed"
        errors = exc.errors()
        if errors and errors[0].get("msg"):
            message = str(errors[0]["msg"])
        # Per the design's envelope table, malformed/missing *query or path*
        # params are 400 BAD_REQUEST, while a *body* that fails schema
        # validation is 422 VALIDATION_ERROR.
        if _validation_location(exc) == "body":
            status = HTTPStatus.UNPROCESSABLE_ENTITY
            code = ErrorCode.VALIDATION_ERROR
        else:
            status = HTTPStatus.BAD_REQUEST
            code = ErrorCode.BAD_REQUEST
        return JSONResponse(
            status_code=status,
            # jsonable_encoder keeps the message human-readable; the envelope
            # intentionally surfaces a single primary field rather than the full
            # pydantic error list.
            content=jsonable_encoder(error_envelope(code, message, field)),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _handle_http_exception(
        _request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        code = _STATUS_TO_CODE.get(exc.status_code, ErrorCode.INTERNAL)
        message = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        return JSONResponse(
            status_code=exc.status_code,
            content=error_envelope(code, message),
        )

    @app.exception_handler(Exception)
    async def _handle_unexpected(_request: Request, exc: Exception) -> JSONResponse:
        # Log the real cause server-side; never leak internals to the client.
        logger.exception("Unhandled error in REST handler: %s", exc)
        return JSONResponse(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            content=error_envelope(ErrorCode.INTERNAL, "Internal server error"),
        )
