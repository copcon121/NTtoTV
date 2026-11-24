"""Unit tests for deterministic Scan AI detectors and endpoint."""

from __future__ import annotations

import pytest
from hypothesis import given, settings, strategies as st

from app.ai_scan.detector import (
    detect_elliott_waves,
    detect_fibonacci,
    detect_levels,
    detect_patterns,
    detect_triangles,
    similar_geometry,
    detect_trendlines,
    run_scan_ai,
)
from app.ai_scan.models import AnchorPoint, ScanAiRequest, ScanAiSuggestion
from app.storage.records import BarRecord


def _make_bar(
    index: int,
    open_: float,
    high: float,
    low: float,
    close: float,
    volume: int = 10,
) -> BarRecord:
    return BarRecord(
        symbol="GC",
        contract="GC",
        timeframe="1m",
        time=1_700_000_000_000 + index * 60_000,
        open=open_,
        high=high,
        low=low,
        close=close,
        volume=volume,
        closed=True,
    )



def _triangle_bars(upper_slope=0.0, lower_slope=0.2):
    import bisect
    points = [(0, 100.0)]
    for i in (8, 18, 28, 38, 48, 58):
        points.append((i, 110 + upper_slope * i if i % 20 == 8 else 90 + lower_slope * i))
    points.append((66, (110 + upper_slope * 66 + 90 + lower_slope * 66) / 2))
    bars = []
    for i in range(67):
        right = min(len(points) - 1, bisect.bisect_right([x for x, _ in points], i))
        left = max(0, right - 1)
        x1, p1 = points[left]
        x2, p2 = points[right]
        p = p1 + (p2 - p1) * (i - x1) / max(1, x2 - x1)
        bars.append(_make_bar(i, p, p + .02, p - .02, p))
    return bars


@pytest.mark.parametrize(("upper", "lower", "kind"), [
    (0, .2, "ascending_triangle"), (-.2, 0, "descending_triangle"),
    (-.1, .1, "symmetrical_triangle"),
])
def test_triangles_use_converging_pivot_boundaries(upper, lower, kind):
    bars = _triangle_bars(upper, lower)
    results = detect_triangles(bars)
    found = next(s for s in results if s.type == kind)
    assert found.metrics["touches"] == 6
    assert found.score >= 75
    top, upper_end, lower_end, bottom = found.anchors
    assert top.time == bottom.time < upper_end.time == lower_end.time
    assert top.price > bottom.price
    assert upper_end.price > lower_end.price
    assert bars[-1].time / 1000 < found.metrics["apexTime"] < bars[-1].time / 1000 + 100 * 60
    assert abs((upper_end.price - top.price) / ((upper_end.time - top.time) / 60) - upper) < .003
    assert abs((lower_end.price - bottom.price) / ((lower_end.time - bottom.time) / 60) - lower) < .003
    req = ScanAiRequest(groups=["patterns"], patterns=["triangles_and_pennants"])
    assert any(s.type == kind for s in run_scan_ai(bars, req))
    assert not run_scan_ai(bars, ScanAiRequest(groups=["patterns"], patterns=[]))


@pytest.mark.parametrize(("upper", "lower"), [(.1, .1), (.1, -.1), (0, 0), (.2, .4)])
def test_triangles_reject_channels_expanding_ranges_and_wedges(upper, lower):
    assert not detect_triangles(_triangle_bars(upper, lower))


def test_triangles_reject_missing_touches_and_broken_boundaries():
    bars = _triangle_bars()
    for i in range(35, len(bars)):
        bars[i] = _make_bar(i, 104, 105, 103, 104)
    assert not detect_triangles(bars)
    bars = _triangle_bars()
    bars[-1] = _make_bar(66, 120, 121, 119, 120)
    assert not detect_triangles(bars)


def test_semantic_dedupe_ranking_and_global_caps(monkeypatch):
    from app.ai_scan import detector
    def suggestion(index, tool="trendline", state="waiting", score=80):
        return ScanAiSuggestion(
            id=str(index), group="lines", type="support_trendline", name="line", description="",
            state=state, strength="strong", score=score, drawing_tool=tool,
            anchors=[AnchorPoint(1700000000 + index * 60, 100 + index),
                     AnchorPoint(1700003600 + index * 60, 160 + index)],
        )
    a, b = suggestion(0), suggestion(1)
    assert similar_geometry(a, b, .1)
    monkeypatch.setattr(detector, "detect_trendlines", lambda *a, **k: [suggestion(i) for i in range(20)])
    result = run_scan_ai(_triangle_bars(), ScanAiRequest(groups=["lines"], density="more"))
    assert len(result) == 1
    candidates = [suggestion(i * 20, score=90 - i) for i in range(20)]
    candidates[0].state = "invalidated"
    candidates[1].anchors[0].price = float("nan")
    monkeypatch.setattr(detector, "detect_trendlines", lambda *a, **k: candidates)
    result = run_scan_ai(_triangle_bars(), ScanAiRequest(groups=["lines"], density="more"))
    assert len(result) <= 3
    assert all(s.state != "invalidated" and s.id != candidates[1].id for s in result)


def test_empty_or_removed_groups_return_no_suggestions():
    bars = _triangle_bars()
    assert not run_scan_ai(bars, ScanAiRequest(groups=[]))
    assert not run_scan_ai(bars, ScanAiRequest(groups=["smc"]))


# Feature: gc-chart-platform, Property 151: AI Scan returns finite unique geometry within density limits
@pytest.mark.property
@settings(max_examples=100, deadline=None)
@given(st.lists(st.integers(1000, 2000), min_size=30, max_size=70),
       st.sampled_from(["less", "auto", "normal", "more"]))
def test_scan_geometry_is_finite_unique_and_bounded(prices, density):
    import math
    bars = [_make_bar(i, p / 10, p / 10 + .2, p / 10 - .2, p / 10) for i, p in enumerate(prices)]
    request = ScanAiRequest(density=density)
    results = run_scan_ai(bars, request)
    assert len(results) <= request.total_density_cap
    for i, suggestion in enumerate(results):
        assert all(math.isfinite(a.price) and a.time > 0 for a in suggestion.anchors)
        assert suggestion.group != "smc"
        assert not any(similar_geometry(suggestion, earlier, .1) for earlier in results[:i])

def test_detect_levels_finds_support_and_resistance():
    # Construct bars with 3 swing highs around 2750.0 and 2 swing lows around 2720.0
    bars: list[BarRecord] = []
    base_price = 2735.0
    for i in range(50):
        # Generate wave
        wave = math_sin_val = (i % 10) - 5
        if i in (10, 20, 30):
            # Swing highs at 2750.0
            bars.append(_make_bar(i, 2748.0, 2750.0, 2747.0, 2748.5))
        elif i in (15, 25):
            # Swing lows at 2720.0
            bars.append(_make_bar(i, 2722.0, 2723.0, 2720.0, 2721.5))
        else:
            bars.append(_make_bar(i, 2735.0, 2738.0, 2732.0, 2735.0))

    suggestions = detect_levels(bars, tick_size=0.1)
    assert len(suggestions) >= 1

    res_levels = [s for s in suggestions if s.type == "resistance_level"]
    assert len(res_levels) >= 1
    assert any(abs(s.anchors[0].price - 2750.0) < 1.0 for s in res_levels)

    sup_levels = [s for s in suggestions if s.type == "support_level"]
    assert len(sup_levels) >= 1
    assert any(abs(s.anchors[0].price - 2720.0) < 1.0 for s in sup_levels)


def test_detect_trendlines_finds_ascending_and_descending():
    bars: list[BarRecord] = []
    # Upward trend: clear swing low dips at 10, 20, 30
    for i in range(40):
        if i == 10:
            bars.append(_make_bar(i, 2704.0, 2708.0, 2700.0, 2706.0))
        elif i == 20:
            bars.append(_make_bar(i, 2714.0, 2718.0, 2710.0, 2716.0))
        elif i == 30:
            bars.append(_make_bar(i, 2724.0, 2728.0, 2720.0, 2726.0))
        else:
            bars.append(_make_bar(i, 2715.0 + i * 0.5, 2720.0 + i * 0.5, 2712.0 + i * 0.5, 2718.0 + i * 0.5))

    lines = detect_trendlines(bars, tick_size=0.1)
    sup_lines = [s for s in lines if s.type == "support_trendline"]
    assert len(sup_lines) >= 1
    assert sup_lines[0].drawing_tool == "trendline"
    assert len(sup_lines[0].anchors) == 2


def test_detect_fibonacci_bullish_impulse():
    bars: list[BarRecord] = []
    # Low at bar 5 (2600.0), High at bar 35 (2700.0), current price at bar 40 (2650.0 - 50% retrace)
    for i in range(45):
        if i == 5:
            bars.append(_make_bar(i, 2610.0, 2615.0, 2600.0, 2608.0))
        elif i == 35:
            bars.append(_make_bar(i, 2690.0, 2700.0, 2685.0, 2695.0))
        elif i > 35:
            bars.append(_make_bar(i, 2660.0, 2665.0, 2648.0, 2650.0))
        else:
            bars.append(_make_bar(i, 2630.0, 2640.0, 2620.0, 2635.0))

    fibs = detect_fibonacci(bars)
    assert len(fibs) >= 1
    assert fibs[0].group == "fibonacci"
    assert fibs[0].type == "fib_retracement"
    assert fibs[0].anchors[0].price == 2600.0
    assert fibs[0].anchors[1].price == 2700.0
    assert fibs[0].target is not None


@pytest.mark.parametrize("latest_price", [90, 110])
def test_fibonacci_skips_newest_extreme_without_retracement(latest_price):
    bars = [_make_bar(i, 100, 100.2, 99.8, 100) for i in range(30)]
    bars[-1] = _make_bar(29, latest_price, latest_price + .2, latest_price - .2, latest_price)
    assert detect_fibonacci(bars) == []




def test_detect_patterns_double_top():
    bars: list[BarRecord] = []
    for i in range(40):
        if i == 10:
            bars.append(_make_bar(i, 2740.0, 2750.0, 2738.0, 2745.0))
        elif i == 18:
            bars.append(_make_bar(i, 2715.0, 2720.0, 2710.0, 2715.0))  # trough / neckline
        elif i == 26:
            bars.append(_make_bar(i, 2742.0, 2750.0, 2740.0, 2744.0))  # second peak
        elif i > 26:
            bars.append(_make_bar(i, 2715.0, 2718.0, 2708.0, 2710.0))  # broken neckline
        else:
            bars.append(_make_bar(i, 2730.0, 2735.0, 2725.0, 2730.0))

    patterns = detect_patterns(bars, tick_size=0.1)
    double_tops = [s for s in patterns if s.type == "double_top"]
    assert len(double_tops) >= 1
    dt = double_tops[0]
    assert dt.drawing_tool == "path"
    assert dt.target is not None


def test_density_capping_and_filtering():
    bars: list[BarRecord] = []
    for i in range(60):
        if i in (10, 20, 30, 40):
            bars.append(_make_bar(i, 2748.0, 2750.0, 2747.0, 2749.0))
        elif i in (15, 25, 35, 45):
            bars.append(_make_bar(i, 2722.0, 2723.0, 2720.0, 2721.0))
        else:
            bars.append(_make_bar(i, 2735.0, 2738.0, 2732.0, 2735.0))

    # Less density: max 1 per group
    req_less = ScanAiRequest(density="less")
    res_less = run_scan_ai(bars, req_less)
    group_counts_less: dict[str, int] = {}
    for s in res_less:
        group_counts_less[s.group] = group_counts_less.get(s.group, 0) + 1
    for grp, cnt in group_counts_less.items():
        assert cnt <= 1

    # Normal density: max 2 per group (levels 3)
    req_normal = ScanAiRequest(density="normal")
    res_normal = run_scan_ai(bars, req_normal)
    group_counts_normal: dict[str, int] = {}
    for s in res_normal:
        group_counts_normal[s.group] = group_counts_normal.get(s.group, 0) + 1
    for grp, cnt in group_counts_normal.items():
        if grp == "levels":
            assert cnt <= 3
        else:
            assert cnt <= 2


def test_rest_ai_scan_post_and_get(tmp_path):
    from fastapi.testclient import TestClient
    from app.app import create_app
    from app.config import Settings
    from app.rest.contract_state import ContractStateStore
    from app.storage.cache_store import CacheStore

    settings = Settings(
        data_dir=tmp_path,
        supported_symbols=("GC",),
        gc_candidate_contracts=("GC 12-26",),
    )
    cache = CacheStore(tmp_path / "app.sqlite")
    state = ContractStateStore(cache, settings=settings)

    # Insert test bars into cache
    bars = []
    for i in range(50):
        if i in (10, 20, 30):
            bars.append(_make_bar(i, 2748.0, 2750.0, 2747.0, 2749.0))
        elif i in (15, 25, 35):
            bars.append(_make_bar(i, 2722.0, 2723.0, 2720.0, 2721.0))
        else:
            bars.append(_make_bar(i, 2735.0, 2738.0, 2732.0, 2735.0))
    cache.upsert_bars(bars)

    app = create_app()
    app.state.contract_state = state
    try:
        with TestClient(app) as c:
            # POST /api/ai-scan
            resp = c.post(
                "/api/ai-scan",
                json={
                    "symbol": "GC",
                    "contract": "GC",
                    "timeframe": "1m",
                    "density": "normal",
                    "strength": "all",
                },
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["symbol"] == "GC"
            assert "suggestions" in data
            assert isinstance(data["suggestions"], list)
            assert data["evaluatedBars"] > 0
            assert c.post("/api/ai-scan", json={"symbol": "GC", "groups": []}).json()["suggestions"] == []
            assert c.post("/api/ai-scan", json={"symbol": "GC", "groups": ["smc"]}).json()["suggestions"] == []

            # GET /api/ai-scan
            get_resp = c.get("/api/ai-scan?symbol=GC&contract=GC&timeframe=1m")
            assert get_resp.status_code == 200
            get_data = get_resp.json()
            assert get_data["symbol"] == "GC"

            # Unknown symbol 404
            err_resp = c.post("/api/ai-scan", json={"symbol": "UNKNOWN"})
            assert err_resp.status_code == 404
    finally:
        cache.close()


def test_detect_elliott_wave_bullish_impulse():
    bars: list[BarRecord] = []
    # P0 at bar 5: Low=2700.0
    # P1 at bar 12: High=2730.0 (W1=30)
    # P2 at bar 18: Low=2715.0 (W2 retrace 50% of W1)
    # P3 at bar 28: High=2765.0 (W3=50, longest)
    # P4 at bar 36: Low=2740.0 (W4 retrace, > P1 High 2730)
    # P5 at bar 46: High=2780.0 (W5=40)
    for i in range(55):
        if i == 5:
            bars.append(_make_bar(i, 2705.0, 2710.0, 2700.0, 2708.0))
        elif i == 12:
            bars.append(_make_bar(i, 2725.0, 2730.0, 2722.0, 2728.0))
        elif i == 18:
            bars.append(_make_bar(i, 2718.0, 2720.0, 2715.0, 2718.0))
        elif i == 28:
            bars.append(_make_bar(i, 2758.0, 2765.0, 2755.0, 2762.0))
        elif i == 36:
            bars.append(_make_bar(i, 2745.0, 2748.0, 2740.0, 2744.0))
        elif i == 46:
            bars.append(_make_bar(i, 2775.0, 2780.0, 2772.0, 2778.0))
        else:
            # Intermediate baseline price
            p = 2700.0 + (i / 55.0) * 75.0
            bars.append(_make_bar(i, p, p + 2.0, p - 2.0, p + 1.0))

    sugs = detect_elliott_waves(bars, tick_size=0.1)
    bullish = [s for s in sugs if s.metrics.get("direction") == "bullish"]
    assert len(bullish) >= 1
    w = bullish[0]
    assert w.group == "elliott"
    assert w.type == "elliott_wave"
    assert len(w.anchors) == 6
    assert w.options.get("anchorLabels") == ["(0)", "(1)", "(2)", "(3)", "(4)", "(5)"]
    assert w.anchors[0].price == 2700.0
    assert w.anchors[1].price == 2730.0
    assert w.anchors[2].price == 2715.0
    assert w.anchors[3].price == 2765.0
    assert w.anchors[4].price == 2740.0
    assert w.anchors[5].price == 2780.0


def test_detect_elliott_wave_bearish_impulse():
    bars: list[BarRecord] = []
    # P0 at bar 5: High=2800.0
    # P1 at bar 12: Low=2770.0 (W1=30)
    # P2 at bar 18: High=2785.0 (W2 retrace)
    # P3 at bar 28: Low=2735.0 (W3=50, longest)
    # P4 at bar 36: High=2760.0 (W4 retrace, < P1 Low 2770)
    # P5 at bar 46: Low=2720.0 (W5=40)
    for i in range(55):
        if i == 5:
            bars.append(_make_bar(i, 2795.0, 2800.0, 2792.0, 2798.0))
        elif i == 12:
            bars.append(_make_bar(i, 2774.0, 2776.0, 2770.0, 2772.0))
        elif i == 18:
            bars.append(_make_bar(i, 2782.0, 2785.0, 2780.0, 2784.0))
        elif i == 28:
            bars.append(_make_bar(i, 2738.0, 2740.0, 2735.0, 2737.0))
        elif i == 36:
            bars.append(_make_bar(i, 2756.0, 2760.0, 2754.0, 2758.0))
        elif i == 46:
            bars.append(_make_bar(i, 2724.0, 2726.0, 2720.0, 2722.0))
        else:
            p = 2800.0 - (i / 55.0) * 75.0
            bars.append(_make_bar(i, p, p + 2.0, p - 2.0, p - 1.0))

    sugs = detect_elliott_waves(bars, tick_size=0.1)
    bearish = [s for s in sugs if s.metrics.get("direction") == "bearish"]
    assert len(bearish) >= 1
    w = bearish[0]
    assert w.group == "elliott"
    assert len(w.anchors) == 6
    assert w.anchors[0].price == 2800.0
    assert w.anchors[5].price == 2720.0


def test_detect_elliott_wave_cardinal_rules_rejected():
    # Negative test 1: Wave 4 overlaps Wave 1 (P4 Low 2725 <= P1 High 2730 in Bullish)
    bars_overlap: list[BarRecord] = []
    for i in range(55):
        if i == 5:
            bars_overlap.append(_make_bar(i, 2705.0, 2710.0, 2700.0, 2708.0))
        elif i == 12:
            bars_overlap.append(_make_bar(i, 2725.0, 2730.0, 2722.0, 2728.0))
        elif i == 18:
            bars_overlap.append(_make_bar(i, 2718.0, 2720.0, 2715.0, 2718.0))
        elif i == 28:
            bars_overlap.append(_make_bar(i, 2758.0, 2765.0, 2755.0, 2762.0))
        elif i == 36:
            # Overlap: low is 2725.0, strictly below P1 high 2730.0
            bars_overlap.append(_make_bar(i, 2730.0, 2735.0, 2725.0, 2728.0))
        elif i == 46:
            bars_overlap.append(_make_bar(i, 2775.0, 2780.0, 2772.0, 2778.0))
        else:
            p = 2700.0 + (i / 55.0) * 75.0
            bars_overlap.append(_make_bar(i, p, p + 2.0, p - 2.0, p + 1.0))

    sugs = detect_elliott_waves(bars_overlap, tick_size=0.1)
    bullish_overlap = [s for s in sugs if s.metrics.get("pattern") == "Elliott Impulse"]
    assert len(bullish_overlap) == 0, "Wave 4 overlap must be rejected"

    # Negative test 2: Wave 3 shortest (W1=40, W3=20, W5=35)
    bars_w3_short: list[BarRecord] = []
    # P0=2700, P1=2740 (h1=40), P2=2735, P3=2755 (h3=20), P4=2745, P5=2780 (h5=35)
    for i in range(55):
        if i == 5:
            bars_w3_short.append(_make_bar(i, 2705.0, 2710.0, 2700.0, 2708.0))
        elif i == 12:
            bars_w3_short.append(_make_bar(i, 2735.0, 2740.0, 2732.0, 2738.0))
        elif i == 18:
            bars_w3_short.append(_make_bar(i, 2736.0, 2738.0, 2735.0, 2737.0))
        elif i == 28:
            bars_w3_short.append(_make_bar(i, 2752.0, 2755.0, 2750.0, 2753.0))
        elif i == 36:
            bars_w3_short.append(_make_bar(i, 2746.0, 2748.0, 2745.0, 2747.0))
        elif i == 46:
            bars_w3_short.append(_make_bar(i, 2775.0, 2780.0, 2772.0, 2778.0))
        else:
            p = 2700.0 + (i / 55.0) * 75.0
            bars_w3_short.append(_make_bar(i, p, p + 2.0, p - 2.0, p + 1.0))

    sugs_w3 = detect_elliott_waves(bars_w3_short, tick_size=0.1)
    bullish_w3 = [s for s in sugs_w3 if s.metrics.get("pattern") == "Elliott Impulse"]
    assert len(bullish_w3) == 0, "Wave 3 shortest must be rejected"


def test_detect_elliott_wave_abc():
    bars: list[BarRecord] = []
    # High at 5 (2800.0), A at 15 (2750.0), B at 25 (2780.0), C at 35 (2730.0)
    for i in range(45):
        if i == 5:
            bars.append(_make_bar(i, 2795.0, 2800.0, 2792.0, 2798.0))
        elif i == 15:
            bars.append(_make_bar(i, 2754.0, 2756.0, 2750.0, 2752.0))
        elif i == 25:
            bars.append(_make_bar(i, 2776.0, 2780.0, 2774.0, 2778.0))
        elif i == 35:
            bars.append(_make_bar(i, 2734.0, 2736.0, 2730.0, 2732.0))
        else:
            p = 2800.0 - (i / 45.0) * 60.0
            bars.append(_make_bar(i, p, p + 2.0, p - 2.0, p - 1.0))

    sugs = detect_elliott_waves(bars, tick_size=0.1)
    abc = [s for s in sugs if s.metrics.get("pattern") == "Elliott ABC"]
    assert len(abc) >= 1
    assert len(abc[0].anchors) == 4
    assert abc[0].options.get("anchorLabels") == ["(0)", "(A)", "(B)", "(C)"]


def test_run_scan_ai_elliott_group_filter():
    bars: list[BarRecord] = []
    for i in range(55):
        if i == 5:
            bars.append(_make_bar(i, 2705.0, 2710.0, 2700.0, 2708.0))
        elif i == 12:
            bars.append(_make_bar(i, 2725.0, 2730.0, 2722.0, 2728.0))
        elif i == 18:
            bars.append(_make_bar(i, 2718.0, 2720.0, 2715.0, 2718.0))
        elif i == 28:
            bars.append(_make_bar(i, 2758.0, 2765.0, 2755.0, 2762.0))
        elif i == 36:
            bars.append(_make_bar(i, 2745.0, 2748.0, 2740.0, 2744.0))
        elif i == 46:
            bars.append(_make_bar(i, 2775.0, 2780.0, 2772.0, 2778.0))
        else:
            p = 2700.0 + (i / 55.0) * 75.0
            bars.append(_make_bar(i, p, p + 2.0, p - 2.0, p + 1.0))

    # With only groups=["levels"]: NO elliott
    req_levels = ScanAiRequest(groups=["levels"])
    res_levels = run_scan_ai(bars, req_levels)
    assert not any(s.group == "elliott" for s in res_levels)

    # With groups=["elliott"]: HAS elliott
    req_elliott = ScanAiRequest(groups=["elliott"])
    res_elliott = run_scan_ai(bars, req_elliott)
    assert any(s.group == "elliott" for s in res_elliott)

