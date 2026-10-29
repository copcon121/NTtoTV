import { describe, expect, it } from "vitest";
import { liquidityHistoryRanges } from "./historyRanges";

describe("LQ history request ranges", () => {
  it.each([0, 1, 14_999])("covers two 15s days without exceeding the cap at offset %i", (offset) => {
    const from = 1_800_000_000_000 + offset;
    const to = from + 48 * 60 * 60_000;
    const ranges = liquidityHistoryRanges(from, to, 15_000);
    expect(ranges).toHaveLength(3);
    expect(ranges[0].from).toBe(from);
    expect(ranges[2].to).toBe(to);
    expect(ranges[0].to + 1).toBe(ranges[1].from);
    expect(ranges[1].to + 1).toBe(ranges[2].from);
    for (const range of ranges) {
      const firstBucket = Math.ceil(range.from / 15_000);
      const lastBucket = Math.floor(range.to / 15_000);
      expect(lastBucket - firstBucket + 1).toBeLessThanOrEqual(5_000);
    }
  });

  it.each([30_000, 60_000, 300_000])("keeps existing %i ms timeframes in one request", (tfMs) => {
    expect(liquidityHistoryRanges(0, 24 * 60 * 60_000, tfMs))
      .toEqual([{ from: 0, to: 24 * 60 * 60_000 }]);
  });
});
