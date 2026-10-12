from __future__ import annotations

import pytest

from app.rest.mt5 import _terminal_choices


@pytest.mark.unit
def test_configured_terminal_choices_use_user_labels_and_fixed_paths() -> None:
    choices = _terminal_choices(
        [
            {
                "path": r"C:\Program Files\MetaTrader 5\terminal64.exe",
                "login": 263466221,
                "server": "Exness-MT5Real37",
                "title": "263466221 - Exness-MT5Real37",
            }
        ]
    )

    assert [(choice["label"], choice["path"]) for choice in choices] == [
        ("hieu", r"C:\Program Files\MetaTrader 5\terminal64.exe"),
        ("hai", r"C:\MT5Hai\terminal64.exe"),
    ]
    assert choices[0]["login"] == 263466221
    assert choices[1]["login"] is None
