import { describe, expect, it } from "vitest";

import { type Bar } from "../cache/types";
import { emaSeries, emaSmoothing, nextEma } from "./ema";

function bar(time: number, close: number): Bar {
  return { time, open: close, high: close, low: close, close, volume: 1 };
}

describe("ema", () => {
  it("derives the smoothing factor from the period", () => {
    expect(emaSmoothing(9)).toBeCloseTo(0.2, 10);
    expect(emaSmoothing(1)).toBeCloseTo(1, 10);
  });

  it("seeds from the first close and follows the recurrence", () => {
    const bars = [bar(1, 10), bar(2, 20), bar(3, 30)];
    const series = emaSeries(bars, 9);
    const k = emaSmoothing(9);
    expect(series).toHaveLength(3);
    expect(series[0].value).toBeCloseTo(10, 10); // seed = first close
    expect(series[1].value).toBeCloseTo(20 * k + 10 * (1 - k), 10);
    expect(series[2].value).toBeCloseTo(
      30 * k + (20 * k + 10 * (1 - k)) * (1 - k),
      10,
    );
    expect(series.map((p) => p.time)).toEqual([1, 2, 3]);
  });

  it("returns an empty series for empty input or non-positive period", () => {
    expect(emaSeries([], 9)).toEqual([]);
    expect(emaSeries([bar(1, 10)], 0)).toEqual([]);
  });

  it("nextEma matches the streaming recurrence", () => {
    const k = emaSmoothing(200);
    expect(nextEma(undefined, 4500, 200)).toBe(4500); // seed
    expect(nextEma(4500, 4520, 200)).toBeCloseTo(4520 * k + 4500 * (1 - k), 10);
  });

  it("a constant series converges to the constant", () => {
    const bars = Array.from({ length: 50 }, (_, i) => bar(i + 1, 100));
    const series = emaSeries(bars, 200);
    expect(series[series.length - 1].value).toBeCloseTo(100, 10);
  });
});
