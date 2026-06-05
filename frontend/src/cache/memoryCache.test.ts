import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MemoryCache, normalizeBars } from "./memoryCache";
import { type Bar, type SeriesKey, serializeKey } from "./types";

const KEY: SeriesKey = { symbol: "GC", contract: "GC 08-26", timeframe: "1m" };

function bar(time: number, close = time): Bar {
  return { time, open: close, high: close, low: close, close, volume: 1 };
}

const barArb: fc.Arbitrary<Bar> = fc
  .record({
    time: fc.integer({ min: 0, max: 1_000_000 }),
    open: fc.double({ min: 0, max: 10000, noNaN: true }),
    high: fc.double({ min: 0, max: 10000, noNaN: true }),
    low: fc.double({ min: 0, max: 10000, noNaN: true }),
    close: fc.double({ min: 0, max: 10000, noNaN: true }),
    volume: fc.nat({ max: 100000 }),
  });

describe("serializeKey", () => {
  it("produces distinct keys for distinct tuples", () => {
    const a = serializeKey({ symbol: "GC", contract: "GC 08-26", timeframe: "1m" });
    const b = serializeKey({ symbol: "GC", contract: "GC 08-26", timeframe: "3m" });
    const c = serializeKey({ symbol: "GC", contract: "GC 10-26", timeframe: "1m" });
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it("does not collide when fields share substrings", () => {
    const a = serializeKey({ symbol: "GC", contract: "A", timeframe: "BC" });
    const b = serializeKey({ symbol: "GC", contract: "AB", timeframe: "C" });
    expect(a).not.toBe(b);
  });
});

describe("normalizeBars", () => {
  it("sorts ascending by time and removes duplicate times (last write wins)", () => {
    const result = normalizeBars([bar(30, 1), bar(10, 2), bar(30, 3), bar(20, 4)]);
    expect(result.map((b) => b.time)).toEqual([10, 20, 30]);
    // last write for time 30 had close 3
    expect(result.find((b) => b.time === 30)?.close).toBe(3);
  });

  it("does not mutate the input array", () => {
    const input = [bar(2), bar(1)];
    const copy = input.slice();
    normalizeBars(input);
    expect(input).toEqual(copy);
  });

  it("always yields sorted, duplicate-free bars over arbitrary input", () => {
    fc.assert(
      fc.property(fc.array(barArb), (bars) => {
        const out = normalizeBars(bars);
        const times = out.map((b) => b.time);
        // strictly increasing => sorted and duplicate-free
        for (let i = 1; i < times.length; i += 1) {
          expect(times[i]).toBeGreaterThan(times[i - 1]);
        }
        // every distinct input time is present exactly once
        expect(new Set(times)).toEqual(new Set(bars.map((b) => b.time)));
      }),
    );
  });
});

describe("MemoryCache.set / get", () => {
  it("stores bars sorted and tracks covered range from bar span", () => {
    const cache = new MemoryCache();
    cache.set(KEY, [bar(30), bar(10), bar(20)]);
    const series = cache.get(KEY);
    expect(series?.bars.map((b) => b.time)).toEqual([10, 20, 30]);
    expect(series?.coveredFrom).toBe(10);
    expect(series?.coveredTo).toBe(30);
  });

  it("honors an explicit covered range wider than the bar span", () => {
    const cache = new MemoryCache();
    cache.set(KEY, [bar(20), bar(30)], { from: 0, to: 100 });
    expect(cache.coveredRange(KEY)).toEqual({ from: 0, to: 100 });
  });

  it("returns undefined for an unknown key", () => {
    const cache = new MemoryCache();
    expect(cache.get(KEY)).toBeUndefined();
    expect(cache.coveredRange(KEY)).toBeUndefined();
    expect(cache.has(KEY)).toBe(false);
  });

  it("returns a defensive copy that does not mutate the cache", () => {
    const cache = new MemoryCache();
    cache.set(KEY, [bar(10)]);
    const series = cache.get(KEY)!;
    series.bars.push(bar(999));
    expect(cache.get(KEY)?.bars.map((b) => b.time)).toEqual([10]);
  });

  it("keeps series for different keys independent", () => {
    const cache = new MemoryCache();
    const other: SeriesKey = { ...KEY, timeframe: "5m" };
    cache.set(KEY, [bar(1)]);
    cache.set(other, [bar(2)]);
    expect(cache.get(KEY)?.bars.map((b) => b.time)).toEqual([1]);
    expect(cache.get(other)?.bars.map((b) => b.time)).toEqual([2]);
    expect(cache.size).toBe(2);
  });
});

describe("MemoryCache.merge / append", () => {
  it("creates the series when merging into an empty cache", () => {
    const cache = new MemoryCache();
    cache.merge(KEY, [bar(10), bar(20)]);
    expect(cache.get(KEY)?.bars.map((b) => b.time)).toEqual([10, 20]);
  });

  it("merges new bars keeping sort order and dedup with last-write-wins", () => {
    const cache = new MemoryCache();
    cache.set(KEY, [bar(10, 1), bar(20, 1)]);
    cache.merge(KEY, [bar(20, 9), bar(15, 5), bar(30, 7)]);
    const series = cache.get(KEY)!;
    expect(series.bars.map((b) => b.time)).toEqual([10, 15, 20, 30]);
    expect(series.bars.find((b) => b.time === 20)?.close).toBe(9);
  });

  it("extends the covered range when appending newer realtime bars", () => {
    const cache = new MemoryCache();
    cache.set(KEY, [bar(100), bar(200)]);
    cache.append(KEY, [bar(300)]);
    expect(cache.coveredRange(KEY)).toEqual({ from: 100, to: 300 });
  });

  it("extends covered range to an explicit fetched range on merge", () => {
    const cache = new MemoryCache();
    cache.set(KEY, [bar(100), bar(200)]);
    cache.merge(KEY, [bar(50)], { from: 0, to: 200 });
    expect(cache.coveredRange(KEY)).toEqual({ from: 0, to: 200 });
  });
});

describe("MemoryCache.delete / clear", () => {
  it("deletes a single series", () => {
    const cache = new MemoryCache();
    cache.set(KEY, [bar(1)]);
    expect(cache.delete(KEY)).toBe(true);
    expect(cache.has(KEY)).toBe(false);
    expect(cache.delete(KEY)).toBe(false);
  });

  it("clears all series", () => {
    const cache = new MemoryCache();
    cache.set(KEY, [bar(1)]);
    cache.set({ ...KEY, timeframe: "1D" }, [bar(2)]);
    cache.clear();
    expect(cache.size).toBe(0);
  });
});

describe("MemoryCache invariants over arbitrary operations", () => {
  it("keeps bars sorted/duplicate-free and covered range bounding all bars", () => {
    fc.assert(
      fc.property(fc.array(fc.array(barArb), { maxLength: 6 }), (batches) => {
        const cache = new MemoryCache();
        for (const batch of batches) {
          cache.merge(KEY, batch);
        }
        const series = cache.get(KEY);
        if (!series || series.bars.length === 0) {
          return;
        }
        const times = series.bars.map((b) => b.time);
        for (let i = 1; i < times.length; i += 1) {
          expect(times[i]).toBeGreaterThan(times[i - 1]);
        }
        expect(series.coveredFrom).toBeLessThanOrEqual(times[0]);
        expect(series.coveredTo).toBeGreaterThanOrEqual(times[times.length - 1]);
      }),
    );
  });
});
