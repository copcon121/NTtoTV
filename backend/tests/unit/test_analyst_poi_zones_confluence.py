import pytest

from app.analyst.confluence import build_confluence
from app.analyst.poi_models import PoiZone
from app.analyst.poi_zones import stable_zone_id


def _zone(
    zone_id,
    *,
    timeframe="M15",
    side="demand",
    kind="fvg",
    top=101.0,
    bottom=100.0,
    bias_aligned=True,
):
    return PoiZone(
        zone_id=zone_id,
        symbol="GC",
        contract="GC",
        timeframe=timeframe,
        side=side,
        kind=kind,
        top=top,
        bottom=bottom,
        mid=(top + bottom) / 2,
        created_at=1_000,
        status="active",
        pd_zone="discount" if side == "demand" else "premium",
        bias_aligned=bias_aligned,
        distance_to_price=0.0,
        contains_price=True,
    )


@pytest.mark.unit
def test_stable_zone_id_rounds_floats_to_tick_size():
    a = stable_zone_id(
        symbol="GC",
        timeframe="M15",
        kind="fvg",
        side="demand",
        top=4233.5000001,
        bottom=4232.499999,
        created_at=1000,
        tick_size=0.1,
    )
    b = stable_zone_id(
        symbol="GC",
        timeframe="M15",
        kind="fvg",
        side="demand",
        top=4233.5,
        bottom=4232.5,
        created_at=1000,
        tick_size=0.1,
    )

    assert a == b


@pytest.mark.unit
def test_confluence_requires_same_side_overlap_and_midpoint_validation():
    active = _zone("a", timeframe="M15", top=101, bottom=100)
    same_side = _zone("b", timeframe="M5", top=100.9, bottom=100.2)
    opposite = _zone("c", timeframe="M5", side="supply", top=100.9, bottom=100.2)
    no_midpoint = _zone("d", timeframe="H1", top=101.2, bottom=100.95)

    result = build_confluence(
        active,
        [active, same_side, opposite, no_midpoint],
        current_price=100.5,
        tick_size=0.1,
    )

    assert result["level"] in {"moderate", "strong"}
    ids = {zone["zoneId"] for zone in result["overlappingZones"]}
    assert "a" in ids
    assert "b" in ids
    assert "c" not in ids
    assert "d" not in ids


@pytest.mark.unit
def test_confluence_same_kind_scores_higher_than_cross_kind():
    active = _zone("a", kind="ob", top=101, bottom=100)
    same_kind = _zone("b", timeframe="M5", kind="ob", top=100.9, bottom=100.2)
    cross_kind = _zone("c", timeframe="M5", kind="fvg", top=100.9, bottom=100.2)

    same = build_confluence(active, [active, same_kind], current_price=100.5)
    cross = build_confluence(active, [active, cross_kind], current_price=100.5)

    assert same["score"] > cross["score"]
