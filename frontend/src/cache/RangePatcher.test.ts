import { describe, expect, it, vi } from "vitest";
import { MemoryCache } from "./memoryCache";
import {
  RangePatcher,
  computeMissingRanges,
  type RangeFetchRequest,
} from "./RangePatcher";
import { type Bar, type CoveredRange, type SeriesKey } from "./types";

const KEY: SeriesKey = { symbol: "GC", contract: "GC 08-26", timeframe: "1m" };

function bar(time: number, close = time): Bar {
  return { time, open: close, high: close, low: close, close, volume: 1 };
}

/** Build bars at each integer time in [from, to] (inclusive). */
function barsInRange(from: number, to: number): Bar[] {
  const out: Bar[] = [];
  for (let t = from; t <= to; t += 1) {
    out.push(bar(t));
  }
  return out;
}

describe("computeMissingRanges", () => {
  it("returns the whole request when nothing is covered", () => {
    expect(computeMissingRanges(undefined, { from: 10, to: 20 })).toEqual([
      { from: 10, to: 20 },
    ]);
  });

  it("returns empty when the request is fully covered", () => {
    expect(computeMissingRanges({ from: 0, to: 100 }, { from: 10, to: 20 })).toEqual(
      [],
    );
  });

  it("returns empty when request exactly equals coverage", () => {
    expect(computeMissingRanges({ from: 10, to: 20 }, { from: 10, to: 20 })).toEqual(
      [],
    );
  });

  it("returns the lower gap when request extends below coverage", () => {
    expect(computeMissingRanges({ from: 50, to: 100 }, { from: 10, to: 70 })).toEqual(
      [{ from: 10, to: 49 }],
    );
  });

  it("returns the upper gap when request extends above coverage", () => {
    expect(computeMissingRanges({ from: 50, to: 100 }, { from: 60, to: 150 })).toEqual(
      [{ from: 101, to: 150 }],
    );
  });

  it("returns both gaps when request straddles coverage on both sides", () => {
    expect(
      computeMissingRanges({ from: 50, to: 100 }, { from: 10, to: 150 }),
    ).toEqual([
      { from: 10, to: 49 },
      { from: 101, to: 150 },
    ]);
  });

  it("returns the whole request when it lies entirely below coverage", () => {
    expect(computeMissingRanges({ from: 50, to: 100 }, { from: 0, to: 20 })).toEqual([
      { from: 0, to: 20 },
    ]);
  });

  it("returns the whole request when it lies entirely above coverage", () => {
    expect(
      computeMissingRanges({ from: 50, to: 100 }, { from: 200, to: 300 }),
    ).toEqual([{ from: 200, to: 300 }]);
  });

  it("never overlaps the covered interval", () => {
    const covered: CoveredRange = { from: 50, to: 100 };
    for (const missing of computeMissingRanges(covered, { from: 0, to: 200 })) {
      expect(missing.to < covered.from || missing.from > covered.to).toBe(true);
    }
  });
});

describe("RangePatcher.missingRanges", () => {
  it("reflects the cache's current coverage", () => {
    const cache = new MemoryCache();
    cache.set(KEY, barsInRange(50, 100), { from: 50, to: 100 });
    const patcher = new RangePatcher(async () => [], cache);
    expect(patcher.missingRanges(KEY, { from: 10, to: 150 })).toEqual([
      { from: 10, to: 49 },
      { from: 101, to: 150 },
    ]);
  });

  it("returns the whole request for an uncached key", () => {
    const cache = new MemoryCache();
    const patcher = new RangePatcher(async () => [], cache);
    expect(patcher.missingRanges(KEY, { from: 0, to: 100 })).toEqual([
      { from: 0, to: 100 },
    ]);
  });
});

describe("RangePatcher.patch", () => {
  it("does not fetch when the request is fully cached", async () => {
    const cache = new MemoryCache();
    cache.set(KEY, barsInRange(0, 100), { from: 0, to: 100 });
    const fetchRange = vi.fn(async () => []);
    const patcher = new RangePatcher(fetchRange, cache);

    const result = await patcher.patch(KEY, { from: 10, to: 90 });

    expect(fetchRange).not.toHaveBeenCalled();
    expect(result.patched).toBe(false);
    expect(result.missingRanges).toEqual([]);
    expect(result.coveredRange).toEqual({ from: 0, to: 100 });
  });

  it("fetches the whole request for an uncached key and patches it", async () => {
    const cache = new MemoryCache();
    const fetchRange = vi.fn(async (req: RangeFetchRequest) =>
      barsInRange(req.from, req.to),
    );
    const patcher = new RangePatcher(fetchRange, cache);

    const result = await patcher.patch(KEY, { from: 10, to: 20 });

    expect(fetchRange).toHaveBeenCalledTimes(1);
    expect(result.patched).toBe(true);
    expect(result.bars.map((b) => b.time)).toEqual(barsInRange(10, 20).map((b) => b.time));
    expect(result.coveredRange).toEqual({ from: 10, to: 20 });
  });

  it("fetches only the missing sub-ranges, not the covered middle", async () => {
    const cache = new MemoryCache();
    cache.set(KEY, barsInRange(50, 100), { from: 50, to: 100 });
    const fetchRange = vi.fn(async (req: RangeFetchRequest) =>
      barsInRange(req.from, req.to),
    );
    const patcher = new RangePatcher(fetchRange, cache);

    const result = await patcher.patch(KEY, { from: 10, to: 150 });

    expect(fetchRange).toHaveBeenCalledTimes(2);
    const fetchedRanges = fetchRange.mock.calls.map(([req]) => ({
      from: req.from,
      to: req.to,
    }));
    expect(fetchedRanges).toEqual([
      { from: 10, to: 49 },
      { from: 101, to: 150 },
    ]);
    expect(result.coveredRange).toEqual({ from: 10, to: 150 });
  });

  it("produces a sorted, duplicate-free, gap-free series after patching", async () => {
    const cache = new MemoryCache();
    cache.set(KEY, barsInRange(50, 100), { from: 50, to: 100 });
    const fetchRange = vi.fn(async (req: RangeFetchRequest) =>
      barsInRange(req.from, req.to),
    );
    const patcher = new RangePatcher(fetchRange, cache);

    const result = await patcher.patch(KEY, { from: 10, to: 150 });

    const times = result.bars.map((b) => b.time);
    // contiguous integer coverage from 10..150 with no duplicates or gaps
    expect(times).toEqual(barsInRange(10, 150).map((b) => b.time));
    for (let i = 1; i < times.length; i += 1) {
      expect(times[i]).toBe(times[i - 1] + 1);
    }
  });

  it("extends coverage over a missing sub-range even when it returns no bars", async () => {
    const cache = new MemoryCache();
    cache.set(KEY, [bar(50), bar(100)], { from: 50, to: 100 });
    // Simulate a quiet window: the fetch finds no bars in the lower gap.
    const fetchRange = vi.fn(async () => []);
    const patcher = new RangePatcher(fetchRange, cache);

    const result = await patcher.patch(KEY, { from: 10, to: 100 });

    expect(result.patched).toBe(true);
    expect(result.fetched).toEqual([]);
    // coverage still extends down to 10 so we won't refetch the empty window
    expect(result.coveredRange).toEqual({ from: 10, to: 100 });
    expect(patcher.missingRanges(KEY, { from: 10, to: 100 })).toEqual([]);
  });

  it("does not refetch a range that was just patched", async () => {
    const cache = new MemoryCache();
    const fetchRange = vi.fn(async (req: RangeFetchRequest) =>
      barsInRange(req.from, req.to),
    );
    const patcher = new RangePatcher(fetchRange, cache);

    await patcher.patch(KEY, { from: 0, to: 50 });
    const second = await patcher.patch(KEY, { from: 10, to: 40 });

    expect(fetchRange).toHaveBeenCalledTimes(1);
    expect(second.patched).toBe(false);
  });
});
