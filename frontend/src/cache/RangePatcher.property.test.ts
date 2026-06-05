import * as fc from "fast-check";
import { expect } from "vitest";

import { MemoryCache } from "./memoryCache";
import {
  RangePatcher,
  computeMissingRanges,
  type RangeFetchRequest,
} from "./RangePatcher";
import { type Bar, type CoveredRange, type SeriesKey } from "./types";
import { propertyTest } from "../test/property";

// Feature: gc-chart-platform, Property 24: Missing-range patching yields a
// contiguous, duplicate-free series
//
// Validates: Requirements 12.3
//
// For any cached series coverage and any requested range, the computed missing
// sub-ranges are exactly the portions of the request not already covered; after
// fetching and patching, the resulting series is sorted by time, contains no
// duplicate bar times, and covers the union of the prior coverage and the
// request with no internal gaps (contiguous).

const KEY: SeriesKey = { symbol: "GC", contract: "GC 08-26", timeframe: "1m" };

function bar(time: number): Bar {
  return { time, open: time, high: time, low: time, close: time, volume: 1 };
}

/** Bars at every integer time in the inclusive range [from, to]. */
function barsInRange(from: number, to: number): Bar[] {
  const out: Bar[] = [];
  for (let t = from; t <= to; t += 1) {
    out.push(bar(t));
  }
  return out;
}

/** The set of integer times in the inclusive range [from, to]. */
function intsInRange(range: CoveredRange): Set<number> {
  const out = new Set<number>();
  for (let t = range.from; t <= range.to; t += 1) {
    out.add(t);
  }
  return out;
}

/**
 * A patch scenario. The cache is seeded with `coverage` (filled with a bar at
 * every integer time) when present, then `request` is patched in. The
 * fetch fills every integer time of each missing sub-range, so a correct,
 * gap-free patch produces a fully contiguous integer series over the union of
 * coverage and request.
 *
 * `coverage` and `request` are always overlapping (or `coverage` is absent), so
 * their union is a single contiguous interval — the realistic pan/zoom domain
 * the single-interval MemoryCache model targets (design.md "Frontend Memory
 * Cache Model").
 */
interface Scenario {
  coverage: CoveredRange | undefined;
  request: CoveredRange;
}

const scenarioArb: fc.Arbitrary<Scenario> = fc
  .record({
    points: fc
      .array(fc.integer({ min: 0, max: 40 }), { minLength: 4, maxLength: 4 })
      .map((xs) => [...xs].sort((a, b) => a - b)),
    hasCoverage: fc.boolean(),
    // When there is coverage, decide which overlapping interval is the cached
    // coverage and which is the request (covers extend-up, extend-down,
    // request-inside-coverage, and coverage-inside-request sub-cases).
    swap: fc.boolean(),
  })
  .map(({ points, hasCoverage, swap }) => {
    const [p0, p1, p2, p3] = points;
    if (!hasCoverage) {
      return { coverage: undefined, request: { from: p0, to: p3 } };
    }
    const a: CoveredRange = { from: p0, to: p2 };
    const b: CoveredRange = { from: p1, to: p3 };
    return swap
      ? { coverage: b, request: a }
      : { coverage: a, request: b };
  });

propertyTest(
  24,
  "Missing-range patching yields a contiguous, duplicate-free series",
  async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, async ({ coverage, request }) => {
        const cache = new MemoryCache();
        if (coverage) {
          cache.set(KEY, barsInRange(coverage.from, coverage.to), coverage);
        }

        // Each missing sub-range is fetched filled with a bar at every integer
        // time, so contiguity of the final series is observable.
        const fetchRange = async (req: RangeFetchRequest): Promise<Bar[]> =>
          barsInRange(req.from, req.to);
        const patcher = new RangePatcher(fetchRange, cache);

        const missing = patcher.missingRanges(KEY, request);

        // (a) The pure computeMissingRanges agrees with the patcher's view.
        expect(missing).toEqual(computeMissingRanges(coverage, request));

        const coveredInts = coverage ? intsInRange(coverage) : new Set<number>();
        const requestInts = intsInRange(request);

        // (b) Each missing sub-range lies within the request and never overlaps
        //     the covered interval; the ranges are ascending and disjoint.
        for (let i = 0; i < missing.length; i += 1) {
          const m = missing[i];
          expect(m.from).toBeLessThanOrEqual(m.to);
          expect(m.from).toBeGreaterThanOrEqual(request.from);
          expect(m.to).toBeLessThanOrEqual(request.to);
          for (const t of intsInRange(m)) {
            expect(coveredInts.has(t)).toBe(false);
          }
          if (i > 0) {
            expect(m.from).toBeGreaterThan(missing[i - 1].to);
          }
        }

        // (c) The missing sub-ranges are EXACTLY the portion of the request not
        //     already covered: (request ∩ covered) ∪ missing == request, and
        //     missing is disjoint from covered.
        const missingInts = new Set<number>();
        for (const m of missing) {
          for (const t of intsInRange(m)) {
            missingInts.add(t);
          }
        }
        const reconstructed = new Set<number>(missingInts);
        for (const t of requestInts) {
          if (coveredInts.has(t)) {
            reconstructed.add(t);
          }
        }
        expect([...reconstructed].sort((x, y) => x - y)).toEqual(
          [...requestInts].sort((x, y) => x - y),
        );

        const result = await patcher.patch(KEY, request);
        const times = result.bars.map((b) => b.time);

        // (d) Sorted strictly ascending => duplicate-free.
        for (let i = 1; i < times.length; i += 1) {
          expect(times[i]).toBeGreaterThan(times[i - 1]);
        }

        // (e) The series covers exactly the union of prior coverage and request,
        //     with NO internal gaps: contiguous integers from the union's start
        //     to its end.
        const unionFrom = coverage
          ? Math.min(coverage.from, request.from)
          : request.from;
        const unionTo = coverage
          ? Math.max(coverage.to, request.to)
          : request.to;
        expect(times).toEqual(barsInRange(unionFrom, unionTo).map((b) => b.time));
        for (let i = 1; i < times.length; i += 1) {
          expect(times[i]).toBe(times[i - 1] + 1);
        }

        // (f) The recorded covered range is the single bounding interval of the
        //     union of prior coverage and request.
        expect(result.coveredRange).toEqual({ from: unionFrom, to: unionTo });
      }),
    );
  },
);
