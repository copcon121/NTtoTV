from app.analyst.smc_state import build_smc_zones
from app.storage.records import BarRecord


def _bar(
    time: int,
    open_: float,
    high: float,
    low: float,
    close: float,
    volume: float = 1,
) -> BarRecord:
    return BarRecord(
        symbol="GC",
        contract="GC",
        timeframe="1m",
        time=time,
        open=open_,
        high=high,
        low=low,
        close=close,
        volume=volume,
        closed=True,
    )


def test_smc_zones_include_active_order_block_from_bos():
    zones, context = build_smc_zones(
        "M1",
        [
            _bar(0, 9.5, 10, 9, 9.5),
            _bar(1, 11.5, 12, 11, 11.5),
            _bar(2, 10.5, 11, 10, 10.5),
            _bar(3, 9.5, 10, 9, 9.5),
            _bar(4, 10, 11, 8, 10),
            _bar(5, 12.5, 13, 9, 12.5),
        ],
        swing_length=2,
    )

    assert context["activeOrderBlocks"] >= 1
    assert any(
        zone.kind == "ob"
        and zone.direction == "bullish"
        and zone.top == 11
        and zone.bottom == 8
        for zone in zones
    )


def test_smc_zones_include_active_fvg_and_omit_mitigated_fvg():
    active_zones, active_context = build_smc_zones(
        "M1",
        [
            _bar(0, 9.5, 10, 9, 9.5),
            _bar(60_000, 11.2, 12, 11, 11.5),
            _bar(120_000, 13.2, 14, 13, 13.5),
        ],
        swing_length=1,
    )
    assert active_context["activeFairValueGaps"] >= 1
    assert any(
        zone.kind == "fvg"
        and zone.direction == "bullish"
        and zone.top == 13
        and zone.bottom == 10
        for zone in active_zones
    )

    mitigated_zones, mitigated_context = build_smc_zones(
        "M1",
        [
            _bar(0, 9.5, 10, 9, 9.5),
            _bar(60_000, 11.2, 12, 11, 11.5),
            _bar(120_000, 13.2, 14, 13, 13.5),
            _bar(180_000, 10.5, 13.2, 9.5, 10.5),
        ],
        swing_length=1,
    )
    assert mitigated_context["activeFairValueGaps"] == 0
    assert all(zone.kind != "fvg" for zone in mitigated_zones)


def test_smc_zones_use_rolling_fvg_body_threshold():
    bars = [
        _bar(0, 100, 111, 99, 110),
        _bar(60_000, 110, 111, 99, 100),
        _bar(120_000, 100, 111, 99, 110),
        _bar(180_000, 100, 100.2, 99.8, 100.1),
        _bar(240_000, 100.1, 100.2, 99.8, 100),
        _bar(300_000, 100, 100.1, 99.9, 100.05),
        _bar(360_000, 100.05, 100.35, 100, 100.3),
        _bar(420_000, 100.3, 100.45, 100.2, 100.35),
    ]

    rolling_zones, _ = build_smc_zones(
        "M1",
        bars,
        swing_length=1,
        fvg_threshold_lookback=3,
    )
    long_zones, _ = build_smc_zones(
        "M1",
        bars,
        swing_length=1,
        fvg_threshold_lookback=20,
    )

    assert any(
        zone.kind == "fvg"
        and zone.direction == "bullish"
        and zone.top == 100.2
        and zone.bottom == 100.1
        for zone in rolling_zones
    )
    assert all(zone.kind != "fvg" for zone in long_zones)


def test_smc_zones_can_require_fvg_volume_confirmation():
    bars = [
        _bar(0, 9.5, 10, 9, 9.5, volume=100),
        _bar(60_000, 11.2, 12, 11, 11.5, volume=5),
        _bar(120_000, 13.2, 14, 13, 13.5, volume=100),
    ]

    unfiltered_zones, _ = build_smc_zones(
        "M1",
        bars,
        swing_length=1,
        fvg_auto_threshold=False,
    )
    volume_filtered_zones, _ = build_smc_zones(
        "M1",
        bars,
        swing_length=1,
        fvg_auto_threshold=False,
        fvg_volume_confirmation=True,
    )

    assert any(zone.kind == "fvg" for zone in unfiltered_zones)
    assert all(zone.kind != "fvg" for zone in volume_filtered_zones)


def test_smc_zones_include_pd_range_context():
    zones, context = build_smc_zones(
        "M1",
        [
            _bar(0, 9.5, 10, 9, 9.5),
            _bar(1, 11.5, 12, 11, 11.5),
            _bar(2, 10.5, 11, 10, 10.5),
            _bar(3, 9.5, 10, 9, 9.5),
            _bar(4, 10, 11, 8, 10),
            _bar(5, 12.5, 13, 9, 12.5),
            _bar(6, 11.5, 12, 10, 11.5),
        ],
        swing_length=2,
    )

    pd = {zone.pd_kind: zone for zone in zones if zone.kind == "pd"}
    assert set(pd) == {"premium", "equilibrium", "discount"}
    assert pd["premium"].top == 13
    assert pd["premium"].bottom == 12.75
    assert pd["discount"].top == 8.25
    assert pd["discount"].bottom == 8
    assert context["currentPdZone"] == "mid_range"
