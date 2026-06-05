"""Unit tests for the shared error-envelope helpers (task 10.1, Req 18.12).

These cover the envelope builder and the :class:`ApiError` constructors in
isolation from the HTTP layer, complementing the endpoint integration tests.
"""

from __future__ import annotations

from http import HTTPStatus

import pytest

from app.rest.errors import (
    ApiError,
    ErrorCode,
    bad_request,
    conflict,
    error_envelope,
    internal_error,
    not_found,
    validation_error,
)


@pytest.mark.unit
def test_error_envelope_omits_field_when_absent():
    assert error_envelope("NOT_FOUND", "nope") == {
        "error": {"code": "NOT_FOUND", "message": "nope"}
    }


@pytest.mark.unit
def test_error_envelope_includes_field_when_present():
    assert error_envelope("BAD_REQUEST", "bad", field="tf") == {
        "error": {"code": "BAD_REQUEST", "message": "bad", "field": "tf"}
    }


@pytest.mark.unit
@pytest.mark.parametrize(
    "factory, status, code",
    [
        (bad_request, HTTPStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST),
        (not_found, HTTPStatus.NOT_FOUND, ErrorCode.NOT_FOUND),
        (conflict, HTTPStatus.CONFLICT, ErrorCode.CONFLICT),
        (validation_error, HTTPStatus.UNPROCESSABLE_ENTITY, ErrorCode.VALIDATION_ERROR),
    ],
)
def test_constructors_map_status_and_code(factory, status, code):
    err = factory("boom", field="x")
    assert isinstance(err, ApiError)
    assert err.status == status
    assert err.code == code
    assert err.field == "x"
    assert err.to_envelope() == {
        "error": {"code": code, "message": "boom", "field": "x"}
    }


@pytest.mark.unit
def test_internal_error_has_no_field_and_500_status():
    err = internal_error()
    assert err.status == HTTPStatus.INTERNAL_SERVER_ERROR
    assert err.code == ErrorCode.INTERNAL
    assert err.field is None
    assert err.to_envelope() == {
        "error": {"code": "INTERNAL", "message": "Internal server error"}
    }


@pytest.mark.unit
def test_api_error_is_raisable_and_has_message():
    with pytest.raises(ApiError) as ei:
        raise not_found("missing thing", field="contract")
    assert str(ei.value) == "missing thing"
