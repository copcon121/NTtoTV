"""Taxonomy coverage and semantics must survive changes to the OF7 catalog."""

from collections import Counter
import json

import pytest

from app.orderflow7.config import FEATURES
from app.orderflow7.groups import FEATURE_TAGS, GROUPS, feature_groups, group_for


pytestmark = pytest.mark.unit


def test_every_feature_has_exactly_one_primary_group_and_secondary_tags():
    membership = Counter(feature for members in GROUPS.values() for feature in members)
    assert set(membership) == set(FEATURES)
    assert set(membership.values()) == {1}
    assert set(FEATURE_TAGS) == set(FEATURES)
    assert all(tags and len(tags) == len(set(tags)) for tags in FEATURE_TAGS.values())


def test_groups_describe_mechanisms_rather_than_future_outcomes():
    forbidden = {"buy", "sell", "reversal", "continuation", "profitable", "winning",
                 "absorption", "exhaustion", "trapped"}
    names = list(GROUPS) + [tag for tags in FEATURE_TAGS.values() for tag in tags]
    for name in names:
        assert not forbidden.intersection(name.split("_")), name


def test_spatial_and_temporal_patterns_are_distinguished():
    assert "price_axis_pattern" in FEATURE_TAGS["orderflows_sequencing"]
    assert "multi_bar" not in FEATURE_TAGS["orderflows_sequencing"]
    assert "multi_bar" in FEATURE_TAGS["market_weakness"]
    assert "fixed_level_output" in FEATURE_TAGS["value_area"]
    assert group_for("delta_tail") == "candle_delta"
    assert group_for("retail_suck") == "extreme_volume"


def test_unknown_feature_is_not_silently_classified():
    with pytest.raises(KeyError):
        group_for("unfinished_business")  # base-renderer state, outside 33-ID catalog


def test_export_is_json_serializable_and_callers_cannot_change_other_exports():
    first = feature_groups()
    original = first["delta_tail"]["primary"]
    first["delta_tail"]["primary"] = "wrong"
    second = feature_groups()
    assert second["delta_tail"]["primary"] == original
    assert list(second) == list(FEATURES)
    assert len(json.loads(json.dumps(second))) == 33
