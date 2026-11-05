"""Direct-feed isolation blocks reconnecting bridges and NT native writes."""
from dataclasses import replace
import importlib

from fastapi.testclient import TestClient
import pytest
from starlette.websockets import WebSocketDisconnect


@pytest.mark.integration
def test_rithmic_only_rejects_all_nt_and_bookmap_ingress(monkeypatch):
    app_module = importlib.import_module("app.app")
    monkeypatch.setattr(app_module, "settings", replace(
        app_module.settings, market_data_rithmic_only=True,
    ))
    client = TestClient(app_module.create_app(lifespan=False))
    for path in ("/ws/nt", "/ws/nt-capture", "/ws/bookmap"):
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect(path):
                pytest.fail("Disabled bridge connected")
    assert client.post("/api/nt/native-bar", json={}).status_code == 404
    assert client.get("/api/health").status_code == 200
    with client.websocket_connect("/ws/chart"):
        pass
