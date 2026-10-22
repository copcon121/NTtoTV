from __future__ import annotations

import json
import os
import stat

import pytest

from app.config import Settings
from app.rithmic.admin_config import (
    RithmicAdminConfigError,
    RithmicAdminConfigStore,
)


def test_admin_config_defaults_include_explicit_login_fingerprint(tmp_path) -> None:
    store = RithmicAdminConfigStore(Settings(data_dir=tmp_path))

    public = store.load().to_public_dict(stored=False)

    assert public["templateId"] == 10
    assert public["templateVersion"] == "5.55"
    assert public["tickerInfraType"] == 1
    assert public["historyInfraType"] == 3
    assert public["macAddresses"] == ["B5:8F:D4:CC:FE:11"]
    assert public["osPlatform"] == "linux"
    assert public["osVersion"] == "10.0.17763"
    assert "password" not in public


def test_save_separates_password_and_blank_password_preserves_it(tmp_path) -> None:
    store = RithmicAdminConfigStore(Settings(data_dir=tmp_path))
    config = store.parse({"user": "paper-user", "password": "top-secret"})

    store.save(config)

    body = json.loads(store.config_path.read_text(encoding="utf-8"))
    assert "password" not in body
    assert "top-secret" not in store.config_path.read_text(encoding="utf-8")
    assert store.password_path.read_text(encoding="utf-8").strip() == "top-secret"
    if os.name != "nt":
        assert stat.S_IMODE(store.config_path.stat().st_mode) == 0o600
        assert stat.S_IMODE(store.password_path.stat().st_mode) == 0o600

    updated = store.parse({"password": "", "appVersion": "1.1.0"})
    assert updated.password == "top-secret"
    assert updated.app_version == "1.1.0"
    assert "password" not in updated.to_public_dict(stored=True)


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"websocketUri": "ws://insecure.example"}, "websocketUri"),
        ({"macAddresses": ["not-a-mac"]}, "macAddresses"),
        ({"modes": []}, "modes"),
        (
            {"user": "paper-user", "historyWeeklyByteLimit": 40_000_000_001},
            "historyWeeklyByteLimit",
        ),
    ],
)
def test_admin_config_rejects_unsafe_or_invalid_values(tmp_path, payload, field) -> None:
    store = RithmicAdminConfigStore(Settings(data_dir=tmp_path))

    with pytest.raises(RithmicAdminConfigError) as caught:
        store.parse(payload)

    assert caught.value.field == field


def test_admin_config_maps_to_runtime_settings(tmp_path) -> None:
    base = Settings(data_dir=tmp_path)
    store = RithmicAdminConfigStore(base)
    config = store.parse(
        {
            "autoConnect": True,
            "user": "paper-user",
            "password": "secret",
            "wireSymbol": "gcz6",
            "physicalContract": "gc 12-26",
            "qualificationSeconds": 42,
            "modes": ["l1", "l2", "mbo"],
        }
    )

    settings = config.to_settings(base)

    assert settings.rithmic_enabled is True
    assert settings.rithmic_user == "paper-user"
    assert settings.rithmic_symbol == "GCZ6"
    assert settings.rithmic_contract == "GC 12-26"
    assert settings.rithmic_qualify_ms == 42_000
    assert settings.rithmic_modes == ("l1", "l2", "mbo")


def test_load_migrates_legacy_partial_modes_to_required_streams(tmp_path) -> None:
    store = RithmicAdminConfigStore(Settings(data_dir=tmp_path))
    store.config_path.parent.mkdir(parents=True)
    store.config_path.write_text(
        json.dumps({"user": "paper-user", "modes": ["l1", "mbo"]}),
        encoding="utf-8",
    )

    assert store.load().modes == ("l1", "l2", "mbo")
