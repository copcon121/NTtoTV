import { describe, expect, it } from "vitest";

import type { TrendAnalyzerMarker, TrendAnalyzerPoint } from "../socket/messages";
import {
  TREND_ANALYZER_STYLES,
  mergeTrendMarkers,
  mergeTrendPoints,
  trendSeriesInRange,
} from "./trendAnalyzer";

const point = (
  time: number,
  price: number | null,
  instance: 1 | 2 = 1,
  side: "buy" | "sell" = "buy",
): TrendAnalyzerPoint => ({ instance, side, time, price });

describe("TTW TrendAnalyzer chart model", () => {
  it("uses the two configured trend palettes", () => {
    expect(TREND_ANALYZER_STYLES).toEqual({
      1: { buy: "#33ff33", sell: "#ff0066" },
      2: { buy: "#ccff00", sell: "#cc00cc" },
    });
  });

  it("keeps one pre-window point per series so a trailing line reaches the viewport", () => {
    const merged = mergeTrendPoints(
      [point(100, 10), point(200, 11), point(210, 21, 2)],
      [point(300, 12)],
      250,
    );
    expect(merged).toEqual([
      point(200, 11),
      point(210, 21, 2),
      point(300, 12),
    ]);
  });

  it("preserves a NaN-equivalent break and returns only the requested series", () => {
    const points = [
      point(100, 10),
      point(200, null),
      point(200, 20, 1, "sell"),
      point(250, 19, 1, "sell"),
    ];
    expect(trendSeriesInRange(points, 1, "buy", 150, 300)).toEqual([
      point(100, 10),
      point(200, null),
    ]);
    expect(trendSeriesInRange(points, 1, "sell", 150, 300)).toEqual([
      point(200, 20, 1, "sell"),
      point(250, 19, 1, "sell"),
    ]);
  });

  it("deduplicates replayed markers without collapsing old/new-side dots", () => {
    const buy: TrendAnalyzerMarker = {
      instance: 1,
      time: 1_000,
      kind: "new_candle",
      side: "buy",
      linePrice: 100,
      marketPrice: 101,
    };
    const sell = { ...buy, side: "sell" as const, linePrice: 102 };
    expect(mergeTrendMarkers([buy], [buy, sell], 0)).toEqual([buy, sell]);
  });
});
