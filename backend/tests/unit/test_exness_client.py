import asyncio
import base64
import hashlib
import json

import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from hypothesis import given, strategies as st

from app.execution.client import APPLICATION_USER_AGENT, EXNESS_WS_PROTOCOL, ExnessClient, ExecutionError, encode_body, load_signing_key, sign_headers, trusted_origin, uint64, upstream_http_error
from app.execution.service import decimal
from app.execution.store import ExecutionStore


def decoded(value):
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


@pytest.mark.unit
def test_signature_binds_exact_body_and_query_and_uses_ed25519():
    key = Ed25519PrivateKey.generate()
    body = encode_body({"instrument": "XAUUSD", "volume": "0.10"})
    path = "/v1/trading/accounts/123/positions?price=2500.00&volume=0.10"
    headers = sign_headers("exnsk-test-key", key, "DELETE", path, body, "test-order-123", timestamp=1234)
    data = decoded(headers["EXN-DATA"])
    payload = json.loads(data)
    assert payload == dict(api_key="exnsk-test-key", idempotency_key="test-order-123", timestamp=1234,
        sign_version=1, method="DELETE", path=path,
        body_hash=base64.urlsafe_b64encode(hashlib.sha256(body).digest()).rstrip(b"=").decode())
    key.public_key().verify(decoded(headers["EXN-SIGN"]), data)
    assert "=" not in headers["EXN-DATA"] and "=" not in headers["EXN-SIGN"]
    get_headers = sign_headers("exnsk-test-key", key, "GET", "/v1/trading/access-point?account_id=123", timestamp=1234)
    assert get_headers["EXN-IDEMPOTENCY-KEY"] == ""
    assert json.loads(decoded(get_headers["EXN-DATA"]))["body_hash"] == "47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU"
    assert headers["User-Agent"] == get_headers["User-Agent"] == APPLICATION_USER_AGENT
    assert "Python-urllib" not in headers["User-Agent"]


@pytest.mark.unit
def test_signer_matches_exness_published_synthetic_vector():
    # Public test material from the official code examples, not an account key.
    key = load_signing_key("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60")
    headers = sign_headers("exnsk-synthetic-example", key, "GET", "/v1/trading/access-point?account_id=123456", timestamp=1773656070123)
    assert headers["EXN-SIGN"] == "l-H_Acia8YoTjKFMg-3fon3NOEX8TalNVA7c01DQ9dHb7pVBJC4y06qC-DbpETzh1KToiOprqEV6uzN3t69ICQ"


@pytest.mark.unit
@pytest.mark.parametrize("payload", [
    {"type": "about:blank", "status": 403, "title": "Forbidden", "detail": "do-not-echo-secret-or-account", "error_name": "BOT_BLOCKED", "cloudflare_error": True},
    {"error": {"message": "do-not-echo-secret-or-account"}},
])
def test_gateway_problem_json_is_not_reported_as_an_order_rejection(payload):
    error = upstream_http_error(403, json.dumps(payload).encode(), "https://api.exness.com/v1/trading/access-point?account_id=123456")
    assert error.code == "EXNESS_GATEWAY_DENIED"
    assert "EXECUTION_REJECTED" not in str(error)
    assert "host discovery" in str(error) and "HTTP 403" in str(error)
    assert "123456" not in str(error) and "do-not-echo" not in str(error)
    assert error.diagnostics == {"upstreamStatus": 403, "host": "api.exness.com", "stage": "host discovery"}


@pytest.mark.unit
@pytest.mark.parametrize("payload", [
    {"code": 1002, "error_message": "AUTH_PERMISSION_DENIED", "description": "do-not-echo"},
    {"error": {"code": 1002, "error_message": "AUTH_PERMISSION_DENIED"}},
    {"error": {"code": 1002, "message": "AUTH_PERMISSION_DENIED"}},
])
def test_real_api_permission_denial_is_preserved(payload):
    error = upstream_http_error(403, json.dumps(payload).encode(), "https://ap-test.exness.com/v1/configuration/accounts/123456/account")
    assert error.code == "AUTH_PERMISSION_DENIED"
    assert "account verification" in str(error) and "AUTH_PERMISSION_DENIED" in str(error)
    assert "do-not-echo" not in str(error) and "123456" not in str(error)


@pytest.mark.unit
def test_discovery_falls_back_on_gateway_denial_but_not_api_permission_errors():
    async def run():
        key = Ed25519PrivateKey.generate().private_bytes_raw().hex()
        client = ExnessClient("exnsk-fixture-key", key, "123456")
        calls = []
        async def request(method, path, **kwargs):
            calls.append((method, kwargs["origin"]))
            if len(calls) == 1:
                raise ExecutionError("EXNESS_GATEWAY_DENIED", "Gateway denied", 403)
            return {"account_id": "123456", "access_point": "https://ap-test.exness.com"}
        client.request = request
        await client.discover()
        assert calls == [("GET", "https://api.exness.com"), ("GET", "https://api.exness-api.com")]
        assert client.origin == "https://ap-test.exness.com"
        calls.clear()
        async def denied(method, path, **kwargs):
            calls.append(method)
            raise ExecutionError("AUTH_PERMISSION_DENIED", "No account access", 403)
        client.request = denied
        with pytest.raises(ExecutionError, match="No account access"):
            await client.discover()
        assert calls == ["GET"]
    asyncio.run(run())


@pytest.mark.unit
@pytest.mark.parametrize("kind", ["events", "ticks"])
def test_websocket_wire_handshake_offers_exness_protocol_without_compression(kind, monkeypatch):
    from websockets.asyncio.client import connect as real_connect
    from websockets.asyncio.server import serve
    async def run():
        expected_path = f"/v1/server-events/accounts/123456/ws/{kind}"
        received = []
        async def handler(ws):
            received.append(dict(path=ws.request.path, protocol=ws.subprotocol,
                extensions=ws.request.headers.get("Sec-WebSocket-Extensions"),
                signed=json.loads(decoded(ws.request.headers["EXN-DATA"]))["path"]))
            await ws.send("{}")
            await ws.wait_closed()
        async with serve(handler, "127.0.0.1", 0, subprotocols=[EXNESS_WS_PROTOCOL], compression=None) as server:
            port = server.sockets[0].getsockname()[1]
            def local_connect(uri, **kwargs):
                assert uri == "wss://ap-test.exness.com"+expected_path
                return real_connect(f"ws://127.0.0.1:{port}"+expected_path, **kwargs)
            monkeypatch.setattr("websockets.asyncio.client.connect", local_connect)
            key = Ed25519PrivateKey.generate().private_bytes_raw().hex()
            client = ExnessClient("exnsk-fixture-key", key, "123456")
            client.origin = "https://ap-test.exness.com"
            async with client.stream(kind) as ws:
                assert await ws.recv() == "{}"
        assert received == [dict(path=expected_path, protocol=EXNESS_WS_PROTOCOL, extensions=None, signed=expected_path)]
    asyncio.run(run())


@pytest.mark.unit
def test_exness_64_byte_secret_and_mismatched_public_key():
    key = Ed25519PrivateKey.generate()
    raw = key.private_bytes_raw()+key.public_key().public_bytes_raw()
    imported = load_signing_key(raw.hex())
    assert imported.public_key().public_bytes_raw() == key.public_key().public_bytes_raw()
    with pytest.raises(ExecutionError):
        load_signing_key((raw[:32]+bytes(32)).hex())


@pytest.mark.unit
@pytest.mark.parametrize("origin", ["http://api.exness.com", "https://127.0.0.1", "https://api.exness.com.evil.test",
    "https://exness.com@evil.test", "https://api.exness.com:8443", "https://api.exness.com/path", "https://api.exness.com?token=secret"])
def test_discovery_cannot_send_credentials_to_arbitrary_origins(origin):
    with pytest.raises(ExecutionError):
        trusted_origin(origin)


@pytest.mark.property
# Feature: gc-chart-platform, Property 32: Broker UInt64 identities preserve every decimal digit
@given(st.integers(min_value=1, max_value=2**64-1))
def test_uint64_preserves_ids(value):
    assert uint64(str(value)) == str(value)


@pytest.mark.unit
@pytest.mark.parametrize("value", [True, float("nan"), float("inf"), "NaN", None])
def test_non_finite_trading_values_are_rejected(value):
    with pytest.raises(ExecutionError):
        decimal(value)


@pytest.mark.unit
def test_credentials_are_encrypted_and_never_returned_as_account_metadata(tmp_path):
    store = ExecutionStore(tmp_path/"execution.sqlite", tmp_path/"vault.key")
    secrets = dict(apiKey="exnsk-fixture-unique-key", apiSecret="test-only-secret", gateway="https://api.exness.com")
    store.save_account("profile-1", "18446744073709551600", secrets, "XAUUSD")
    assert set(store.account("profile-1")) == {"user_id", "account_id", "symbol", "enabled"}
    assert store.account("profile-2") is None
    assert store.account("profile-1", secret=True)["apiSecret"] == secrets["apiSecret"]
    blob = store.rows("SELECT credentials FROM execution_accounts")[0]["credentials"]
    assert secrets["apiKey"].encode() not in blob and secrets["apiSecret"].encode() not in blob
    store.close()
    reopened = ExecutionStore(tmp_path/"execution.sqlite", tmp_path/"vault.key")
    assert reopened.account("profile-1", secret=True)["apiKey"] == secrets["apiKey"]
    reopened.close()
