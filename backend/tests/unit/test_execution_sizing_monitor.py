import json
from types import SimpleNamespace

import pytest

from app.execution.monitor import sizing_status


@pytest.mark.unit
def test_sizing_monitor_only_returns_whitelisted_cached_metadata():
    session = SimpleNamespace(user_id="private-user", symbol="XAUUSD",
        settings={"currency": "USD", "private": "private-value"},
        condition={"quote_currency": "USD", "contract_size": "100", "volume_min": "0.01",
                   "volume_max": "100", "volume_step": "0.01", "private": "private-value"})
    service = SimpleNamespace(sessions={session.user_id: session},
        symbol=lambda user: {"tickSize": 0.001, "pipValue": 0.1})
    result = sizing_status(service)
    assert result == {"profileCount": 1, "profiles": [{"profile": 1, "instrument": "XAUUSD",
        "accountCurrency": "USD", "quoteCurrency": "USD", "contractSize": 100.0,
        "tickSize": 0.001, "pipValue": 0.1, "minLot": 0.01, "maxLot": 100.0, "lotStep": 0.01}]}
    assert "private" not in json.dumps(result)


@pytest.mark.unit
def test_sizing_monitor_redacts_invalid_fields():
    session = SimpleNamespace(user_id="private-user", symbol="private-value",
        settings={"currency": "private-value"}, condition={"quote_currency": "private-value",
        "contract_size": "NaN", "volume_min": True, "volume_max": "Infinity", "volume_step": "private-value"})
    service = SimpleNamespace(sessions={session.user_id: session},
        symbol=lambda user: {"tickSize": -1, "pipValue": "private-value"})
    row = sizing_status(service)["profiles"][0]
    assert row["profile"] == 1
    assert all(value is None for key, value in row.items() if key != "profile")
