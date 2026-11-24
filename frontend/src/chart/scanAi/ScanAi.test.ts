import { describe, expect, it } from "vitest";
import { ScanAiDraftPrimitive } from "./ScanAiDraftPrimitive";
import type { ScanAiSuggestion } from "./types";
import { suggestionToDrawingState } from "./useScanAi";

describe("suggestionToDrawingState", () => {
  it("converts horizontal_ray level suggestion to DrawingState", () => {
    const sug: ScanAiSuggestion = {
      id: "sug_level_1",
      group: "levels",
      type: "support_level",
      label: "Support Level",
      state: "tested",
      strength: "strong",
      score: 85,
      drawingTool: "horizontal_ray",
      anchors: [{ time: 1700000000, price: 2720.0 }],
      options: {
        lineColor: "#22c55e",
        lineWidth: 2,
        lineStyle: "solid",
      },
      target: 2750.0,
      stop: 2710.0,
      metrics: { touches: 3, bounces: 2 },
    };

    const state = suggestionToDrawingState(sug, "1m");
    expect(state.tool).toBe("horizontal_ray");
    expect(state.anchors).toHaveLength(1);
    expect(state.anchors[0].price).toBe(2720.0);
    expect(state.anchors[0].time).toBe(1700000000);
    expect(state.options?.lineColor).toBe("#22c55e");
    expect(state.sourceTimeframe).toBe("1m");
    expect(state.id).toMatch(/^ai_horizontal_ray_/);
    expect(suggestionToDrawingState(sug, "1m").id).toBe(state.id);
  });

  it("converts rectangle SMC FVG suggestion to DrawingState", () => {
    const sug: ScanAiSuggestion = {
      id: "sug_smc_fvg",
      group: "patterns",
      type: "fvg_bullish",
      label: "Bullish FVG",
      state: "tested",
      strength: "moderate",
      score: 75,
      drawingTool: "rectangle",
      anchors: [
        { time: 1700000000, price: 2705.0 },
        { time: 1700000300, price: 2700.0 },
      ],
      options: {
        fillColor: "rgba(34, 197, 94, 0.2)",
        lineColor: "#22c55e",
        lineWidth: 1,
      },
      metrics: { topPrice: 2705.0, bottomPrice: 2700.0 },
    };

    const state = suggestionToDrawingState(sug, "5m");
    expect(state.tool).toBe("rectangle");
    expect(state.anchors).toHaveLength(2);
    expect(state.anchors[0].price).toBe(2705.0);
    expect(state.anchors[1].price).toBe(2700.0);
    expect(state.options?.fillColor).toBe("rgba(34, 197, 94, 0.2)");
    expect(state.sourceTimeframe).toBe("5m");
  });
});

describe("ScanAiDraftPrimitive", () => {
  it("initializes and updates suggestions and focused id", () => {
    const primitive = new ScanAiDraftPrimitive();
    expect(primitive.suggestions).toHaveLength(0);
    expect(primitive.focusedId).toBeNull();
    expect(primitive.paneViews()).toHaveLength(1);

    const sugs: ScanAiSuggestion[] = [
      {
        id: "sug_1",
        group: "lines",
        type: "support_trendline",
        label: "Ascending Trendline",
        state: "in_play",
        strength: "moderate",
        score: 70,
        drawingTool: "trendline",
        anchors: [
          { time: 1700000000, price: 2700.0 },
          { time: 1700001000, price: 2720.0 },
        ],
        options: { lineColor: "#38bdf8" },
        metrics: {},
      },
    ];

    primitive.setSuggestions(sugs, "sug_1", true);
    expect(primitive.suggestions).toHaveLength(1);
    expect(primitive.focusedId).toBe("sug_1");
    expect(primitive.showTargets).toBe(true);

    primitive.setFocusedId(null);
    expect(primitive.focusedId).toBeNull();
  });

  it("handles suggestions with completely missing metrics and options safely", () => {
    const rawSug: any = {
      id: "raw_broken_sug",
      group: "levels",
      type: "support_level",
      state: "waiting",
      strength: "weak",
      score: 50,
      drawingTool: "horizontal_ray",
      anchors: [{ time: 1700000000, price: 2715.0 }],
    };

    const state = suggestionToDrawingState(rawSug, "1m");
    expect(state.tool).toBe("horizontal_ray");
    expect(state.options?.lineColor).toBe("#22c55e"); // levels default

    const primitive = new ScanAiDraftPrimitive();
    expect(() => {
      primitive.setSuggestions([rawSug], "raw_broken_sug", true);
      primitive.updateAllViews();
    }).not.toThrow();
  });

  it("performs hit-testing against suggestion shapes and returns suggestion + badge anchor", () => {
    const primitive = new ScanAiDraftPrimitive();
    const sug: ScanAiSuggestion = {
      id: "sug_hit_test",
      group: "lines",
      type: "trendline",
      label: "Test Trendline",
      state: "in_play",
      strength: "strong",
      score: 90,
      drawingTool: "trendline",
      anchors: [
        { time: 100, price: 2700 },
        { time: 200, price: 2750 },
      ],
      options: { lineColor: "#38bdf8" },
      metrics: {},
    };

    primitive.setSuggestions([sug], null);

    // Mock chart and series API attached to primitive
    (primitive as any).chart = {
      timeScale: () => ({
        timeToCoordinate: (t: any) => (t === 100 ? 50 : 150),
      }),
    };
    (primitive as any).series = {
      priceToCoordinate: (p: any) => (p === 2700 ? 100 : 50),
    };

    // Point near midpoint of segment (100, 75):
    const hit = primitive.hitTestSuggestion(100, 75, 15);
    expect(hit).not.toBeNull();
    expect(hit?.suggestion.id).toBe("sug_hit_test");
    expect(hit?.point.x).toBe(100);
    expect(hit?.point.y).toBe(75);

    // Far point should not hit
    const miss = primitive.hitTestSuggestion(300, 300, 10);
    expect(miss).toBeNull();

    // lightweight-charts hitTest compatibility
    const item = primitive.hitTest(100, 75);
    expect(item?.externalId).toBe("sug_hit_test");
    expect(item?.zOrder).toBe("top");
  });

  it("hit-tests horizontal ray and places node anchor at hovered x coordinate", () => {
    const primitive = new ScanAiDraftPrimitive();
    const raySug: ScanAiSuggestion = {
      id: "sug_ray_1",
      group: "levels",
      type: "resistance_level",
      label: "Resistance Level",
      state: "tested",
      strength: "strong",
      score: 85,
      drawingTool: "horizontal_ray",
      anchors: [{ time: 100, price: 3553.7 }],
      options: { lineColor: "#ef4444" },
      metrics: {},
    };

    primitive.setSuggestions([raySug], null);

    (primitive as any).chart = {
      timeScale: () => ({
        timeToCoordinate: (t: any) => (t === 100 ? 80 : 80),
      }),
    };
    (primitive as any).series = {
      priceToCoordinate: (p: any) => (p === 3553.7 ? 136 : 136),
    };

    // Hover at x = 500, y = 136 (on the line)
    const hit = primitive.hitTestSuggestion(500, 136, 10);
    expect(hit).not.toBeNull();
    expect(hit?.suggestion.id).toBe("sug_ray_1");
    expect(hit?.point.x).toBe(500);
    expect(hit?.point.y).toBe(136);
  });

  it("converts Elliott wave suggestion to DrawingState with anchorLabels", () => {
    const sug: ScanAiSuggestion = {
      id: "sug_elliott_1",
      group: "elliott",
      type: "elliott_wave",
      label: "Elliott Impulse (1-2-3-4-5)",
      state: "in_play",
      strength: "strong",
      score: 92,
      drawingTool: "path",
      anchors: [
        { time: 100, price: 2700 },
        { time: 120, price: 2730 },
        { time: 140, price: 2715 },
        { time: 160, price: 2765 },
        { time: 180, price: 2740 },
        { time: 200, price: 2780 },
      ],
      options: {
        lineColor: "#38bdf8",
        lineWidth: 2,
        anchorLabels: ["(0)", "(1)", "(2)", "(3)", "(4)", "(5)"],
      },
      metrics: { pattern: "Elliott Impulse", direction: "bullish" },
    };

    const state = suggestionToDrawingState(sug, "1m");
    expect(state.tool).toBe("path");
    expect(state.anchors).toHaveLength(6);
    expect(state.options?.anchorLabels).toEqual(["(0)", "(1)", "(2)", "(3)", "(4)", "(5)"]);
    expect(state.options?.lineColor).toBe("#38bdf8");
  });

  it("hit-tests Elliott wave path segments correctly", () => {
    const primitive = new ScanAiDraftPrimitive();
    const elliottSug: ScanAiSuggestion = {
      id: "sug_elliott_hit",
      group: "elliott",
      type: "elliott_wave",
      label: "Elliott Impulse (1-2-3-4-5)",
      state: "in_play",
      strength: "strong",
      score: 90,
      drawingTool: "path",
      anchors: [
        { time: 100, price: 2700 },
        { time: 200, price: 2750 },
      ],
      options: {
        lineColor: "#38bdf8",
        anchorLabels: ["(0)", "(1)"],
      },
      metrics: {},
    };

    primitive.setSuggestions([elliottSug], null);

    (primitive as any).chart = {
      timeScale: () => ({
        timeToCoordinate: (t: any) => (t === 100 ? 50 : 250),
      }),
    };
    (primitive as any).series = {
      priceToCoordinate: (p: any) => (p === 2700 ? 200 : 100),
    };

    // On segment from (50, 200) to (250, 100)
    // At x = 150, y = 150:
    const hit = primitive.hitTestSuggestion(150, 150, 10);
    expect(hit).not.toBeNull();
    expect(hit?.suggestion.id).toBe("sug_elliott_hit");
    expect(Math.abs(hit!.point.x - 150)).toBeLessThan(5);
    expect(Math.abs(hit!.point.y - 150)).toBeLessThan(5);
  });
});
