// cache module — RangePatcher.
//
// Background fetch + patch for missing bar ranges (Req 12.3). When a user pans,
// zooms, or switches to a timeframe whose requested window is only partially in
// the browser MemoryCache, the RangePatcher computes the sub-range(s) of the
// request that are NOT already covered, background-fetches just those, and
// patches the fetched bars into the cache. This avoids re-loading already-cached
// bars and lets the chart fill missing data without a full repaint (Req 12.4).
//
// The cache models coverage per (symbol, contract, timeframe) as a single
// contiguous `[coveredFrom, coveredTo]` interval (see MemoryCache /
// "Frontend Memory Cache Model" in design.md). The RangePatcher builds on the
// seam MemoryCache left: it reads `coveredRange(key)` to compute what is
// missing and uses `merge(key, bars, range)` to patch fetched bars in while
// extending the covered interval — so after patching the covered range is the
// bounding span of (prior coverage ∪ request), a single gap-free interval, and
// the bars remain sorted and duplicate-free.
//
// `computeMissingRanges` is a PURE function of (covered, requested): it is the
// core of the patcher and the basis for Property 24 (missing-range patching
// yields a contiguous, duplicate-free series, task 12.6).

import { MemoryCache } from "./memoryCache";
import { type Bar, type CoveredRange, type SeriesKey } from "./types";

/** Normalize a range so `from <= to` (defensive against swapped bounds). */
function normalizeRange(range: CoveredRange): CoveredRange {
  return range.from <= range.to
    ? { from: range.from, to: range.to }
    : { from: range.to, to: range.from };
}

/**
 * Compute the sub-ranges of `requested` that are NOT already covered by
 * `covered`. This is exact inclusive-interval subtraction over
 * Canonical_Timestamp milliseconds:
 *
 *   - When nothing is covered, the whole request is missing.
 *   - Otherwise the result is the portion of the request below the covered
 *     interval (`[reqFrom, coveredFrom - 1]`) and/or the portion above it
 *     (`[coveredTo + 1, reqTo]`), each clipped to the request bounds.
 *
 * The returned ranges are inclusive `[from, to]`, ascending, non-overlapping,
 * and contain no part of `covered`. An empty array means the request is already
 * fully cached (so no background fetch is needed).
 *
 * Pure: depends only on its arguments and never touches the cache or network.
 * This is the function Property 24 (task 12.6) asserts against.
 */
export function computeMissingRanges(
  covered: CoveredRange | undefined,
  requested: CoveredRange,
): CoveredRange[] {
  const req = normalizeRange(requested);

  if (!covered) {
    return [{ from: req.from, to: req.to }];
  }

  const cov = normalizeRange(covered);
  const missing: CoveredRange[] = [];

  // Portion of the request below the covered interval.
  if (req.from < cov.from) {
    missing.push({ from: req.from, to: Math.min(req.to, cov.from - 1) });
  }
  // Portion of the request above the covered interval.
  if (req.to > cov.to) {
    missing.push({ from: Math.max(req.from, cov.to + 1), to: req.to });
  }

  return missing;
}

/** A request to fetch bars for one missing sub-range of a series. */
export interface RangeFetchRequest extends SeriesKey {
  from: number; // Canonical_Timestamp ms (inclusive)
  to: number; // Canonical_Timestamp ms (inclusive)
}

/**
 * Injectable fetch for a single missing sub-range. Returns the bars in
 * `[from, to]` for the given series. Kept deliberately narrow (bars in, bars
 * out) so the patcher is testable without a network or DOM `fetch`, and so a
 * caller can adapt it to the `/api/history` endpoint (or any source) however it
 * likes.
 */
export type RangeFetchFn = (req: RangeFetchRequest) => Promise<readonly Bar[]>;

/** Result of patching a requested range into the cache. */
export interface PatchResult {
  key: SeriesKey;
  /** The sub-ranges that were missing and fetched (empty when fully cached). */
  missingRanges: CoveredRange[];
  /** True when at least one background fetch was performed. */
  patched: boolean;
  /** Bars fetched across all missing sub-ranges, sorted and duplicate-free. */
  fetched: Bar[];
  /** The full series bars after patching, sorted ascending and duplicate-free. */
  bars: Bar[];
  /** The covered range after patching (a single contiguous interval). */
  coveredRange: CoveredRange | undefined;
}

/**
 * Sort bars by time ascending and drop duplicate times (last write wins),
 * matching MemoryCache's normalization so the returned `fetched` set is
 * canonical.
 */
function normalize(bars: readonly Bar[]): Bar[] {
  const byTime = new Map<number, Bar>();
  for (const bar of bars) {
    byTime.set(bar.time, bar);
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/**
 * Computes missing sub-ranges for a requested range and patches them into a
 * MemoryCache by background-fetching only the uncovered portions.
 *
 * The fetch is injectable so the patcher can be driven from the `/api/history`
 * endpoint in the app and from a deterministic stub in tests.
 */
export class RangePatcher {
  constructor(
    private readonly fetchRange: RangeFetchFn,
    private readonly cache: MemoryCache,
  ) {}

  /**
   * Compute (without fetching) the sub-ranges of `requested` that are not in
   * the cache for `key`. Returns an empty array when the request is fully
   * cached. Pure with respect to the current cache state.
   */
  missingRanges(key: SeriesKey, requested: CoveredRange): CoveredRange[] {
    return computeMissingRanges(this.cache.coveredRange(key), requested);
  }

  /**
   * Background-fetch and patch the missing sub-ranges of `requested` for `key`.
   *
   * Behavior:
   *   - Computes the missing sub-ranges from the cache's current coverage.
   *   - When nothing is missing, performs no fetch and returns the cached state
   *     unchanged (`patched: false`) so the caller can skip a repaint (Req 12.4).
   *   - Otherwise fetches each missing sub-range (in parallel) and merges the
   *     bars into the cache, recording each fetched sub-range as covered — so
   *     even a sub-range that returns no bars still extends coverage.
   *
   * After patching, the cache holds bars sorted ascending and duplicate-free
   * over a single contiguous covered interval spanning the union of the prior
   * coverage and the request (Req 12.3, Property 24).
   */
  async patch(key: SeriesKey, requested: CoveredRange): Promise<PatchResult> {
    const missingRanges = this.missingRanges(key, requested);

    if (missingRanges.length === 0) {
      const series = this.cache.get(key);
      return {
        key,
        missingRanges,
        patched: false,
        fetched: [],
        bars: series?.bars ?? [],
        coveredRange: this.cache.coveredRange(key),
      };
    }

    // Fetch the disjoint missing sub-ranges concurrently, then patch each into
    // the cache together with its fetched range so coverage extends to cover
    // the whole request even where a sub-range came back empty.
    const fetchedPerRange = await Promise.all(
      missingRanges.map((range) =>
        this.fetchRange({ ...key, from: range.from, to: range.to }),
      ),
    );

    const allFetched: Bar[] = [];
    missingRanges.forEach((range, i) => {
      const bars = fetchedPerRange[i];
      this.cache.merge(key, bars, range);
      for (const bar of bars) {
        allFetched.push(bar);
      }
    });

    const series = this.cache.get(key);
    return {
      key,
      missingRanges,
      patched: true,
      fetched: normalize(allFetched),
      bars: series?.bars ?? [],
      coveredRange: this.cache.coveredRange(key),
    };
  }
}
