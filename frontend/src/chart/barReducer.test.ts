import { describe, expect, it } from "vitest";

import {
  type BarSeries,
  applyBarUpdate,
  barsEqual,
  reduceBars,
} from "./barReducer";
import { normalizeBars } from "../cache/memoryCache";
import { type Bar } from "../cache/types";

function bar(time: number, close = time, volume = 1): Bar {
  return { time, open: close, high: close, low: close, close, volume };
}

function times(series: BarSeries): number[] {
  return series.map((b) => b.time);
}

describe("barsEqual", () => {
  it("is true only when all six OHLCV fields match", () => {
    expect(barsEqual(bar(10), bar(10))).toBe(true);
    expect(barsEqual(bar(10, 1), bar(10, 2))).toBe(false);
    expect(barsEqual({ ...bar(10), volume: 1 }, { ...bar(10), volume: 2 })).toBe(false);
  });
});

describe("applyBarUpdate", () => {
  it("appends a new bar whose time is after the last (realtime new bucket)", () => {
    const series = normalizeBars([bar(10), bar(20)]);
    const result = applyBarUpdate(series, bar(30));
    expect(result.kind).toBe("append");
    expect(times(result.bars)).toEqual([10, 20, 30]);
    expect(result.index).toBe(2);
  });

  it("overwrites the in-progress bar that shares a time key", () => {
    const series = normalizeBars([bar(10, 1), bar(20, 1)]);
    const result = applyBarUpdate(series, bar(20, 9));
    expect(result.kind).toBe("overwrite");
    expect(times(result.bars)).toEqual([10, 20]);
    expect(result.bars.find((b) => b.time === 20)?.close).toBe(9);
    expect(result.bar.close).toBe(9);
  });

  it("treats an identical bar at an existing time as a no-op (no repaint)", () => {
    const series = normalizeBars([bar(10), bar(20)]);
    const result = applyBarUpdate(series, bar(20));
    expect(result.kind).toBe("noop");
    // identity preserved: no new array allocated for a no-op
    expect(result.bars).toBe(series);
  });

  it("inserts an out-of-order bar in sorted position", () => {
    const series = normalizeBars([bar(10), bar(30)]);
    const result = applyBarUpdate(series, bar(20));
    expect(result.kind).toBe("insert");
    expect(times(result.bars)).toEqual([10, 20, 30]);
    expect(result.index).toBe(1);
  });

  it("does not mutate the input series", () => {
    const series = normalizeBars([bar(10), bar(20)]);
    const snapshot = times(series);
    applyBarUpdate(series, bar(30));
    applyBarUpdate(series, bar(20, 5));
    expect(times(series)).toEqual(snapshot);
  });

  it("copies the incoming bar so later external mutation cannot corrupt the series", () => {
    const series: BarSeries = [];
    const incoming = bar(10, 1);
    const result = applyBarUpdate(series, incoming);
    incoming.close = 999;
    expect(result.bars[0].close).toBe(1);
  });
});

describe("reduceBars", () => {
  it("normalizes an unsorted initial series before folding", () => {
    const result = reduceBars([bar(30), bar(10), bar(20)], []);
    expect(times(result)).toEqual([10, 20, 30]);
  });

  it("equals a full normalize of initial + updates (last-write-wins by time)", () => {
    const initial = [bar(10, 1), bar(20, 1)];
    const updates = [bar(20, 2), bar(30, 3), bar(20, 4), bar(5, 5)];
    const result = reduceBars(initial, updates);
    const expected = normalizeBars([...initial, ...updates]);
    expect(result).toEqual(expected);
    expect(times(result)).toEqual([5, 10, 20, 30]);
    expect(result.find((b) => b.time === 20)?.close).toBe(4);
  });

  it("keeps the series sorted and duplicate-free throughout", () => {
    const result = reduceBars([], [bar(50), bar(10), bar(50, 2), bar(30), bar(10, 9)]);
    expect(times(result)).toEqual([10, 30, 50]);
    expect(result.find((b) => b.time === 10)?.close).toBe(9);
    expect(result.find((b) => b.time === 50)?.close).toBe(2);
  });
});
