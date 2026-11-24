"""Unit tests for fixed-range delta profile price grouping and limits."""

from __future__ import annotations

import pytest

from app.rest.orderflow import (
    MAX_DELTA_PROFILE_ROWS,
    MAX_ROWS,
    _delta_profile_price,
    _compute_profile_value_area,
)


def test_delta_profile_row_ticks_grouping():
    # Base tick size for GC is 0.1
    # row_ticks = 1: 0.1 increments
    assert _delta_profile_price(2750.14, 1) == 2750.1
    assert _delta_profile_price(2750.16, 1) == 2750.2

    # row_ticks = 2 (default): 0.2 increments
    assert _delta_profile_price(2750.0, 2) == 2750.0
    assert _delta_profile_price(2750.1, 2) == 2750.0
    assert _delta_profile_price(2750.2, 2) == 2750.2
    assert _delta_profile_price(2750.3, 2) == 2750.2
    assert _delta_profile_price(2750.4, 2) == 2750.4

    # row_ticks = 5: 0.5 increments
    assert _delta_profile_price(2750.2, 5) == 2750.0
    assert _delta_profile_price(2750.5, 5) == 2750.5
    assert _delta_profile_price(2750.8, 5) == 2750.5
    assert _delta_profile_price(2751.0, 5) == 2751.0

    # row_ticks = 10: 1.0 increments
    assert _delta_profile_price(2750.7, 10) == 2750.0
    assert _delta_profile_price(2751.3, 10) == 2751.0


def test_delta_profile_value_area_calculation():
    volumes = {
        2750.0: 100.0,  # POC
        2750.2: 50.0,
        2750.4: 20.0,
        2749.8: 40.0,
        2749.6: 10.0,
    }
    total = sum(volumes.values())
    vah, val = _compute_profile_value_area(
        volumes,
        2750.0,
        row_ticks=2,
        value_area_pct=70.0,
        total_volume=total,
    )
    # 70% of 220 is 154. POC (100) + 2750.2 (50) + 2749.8 (40) = 190 >= 154
    assert vah == 2750.2
    assert val == 2749.8


def test_delta_profile_row_cap_allows_multi_session():
    # Standard MAX_ROWS is 5000 (enough for ~3 sessions)
    assert MAX_ROWS == 5000
    # Delta profile has dedicated limit MAX_DELTA_PROFILE_ROWS = 12000 (up to 7 sessions)
    assert MAX_DELTA_PROFILE_ROWS == 12000
    assert MAX_DELTA_PROFILE_ROWS > MAX_ROWS
