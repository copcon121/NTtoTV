// cache module — MemoryCache.
//
// In-browser bar cache keyed by (symbol, contract, timeframe), tracking the
// covered time range per key. Holding bars in memory lets a timeframe switch
// render cached bars immediately and complete within 300ms without a network
// round-trip (Req 12.1, 12.2). Bars are always stored sorted by time ascending
// and duplicate-free, so consumers (ChartContainer, RangePatcher) can rely on a
// canonical ordering.
//
// The RangePatcher (task 12.5) builds on this: it reads `coveredRange(key)` to
// compute missing sub-ranges and uses `merge` to patch fetched bars in. This
// file deliberately leaves that seam (merge + covered-range tracking) and does
// NOT implement missing-range computation itself.

import {
  type Bar,
  type CachedSeries,
  type CoveredRange,
  type SeriesKey,
  serializeKey,
} from "./types";

/**
 * Sort bars by time ascending and remove duplicates by `time` (last write
 * wins, so a later entry for the same bucket time overwrites an earlier one —
 * matching incremental in-progress bar updates). Returns a new array; the input
 * is not mutated.
 */
export function normalizeBars(bars: readonly Bar[]): Bar[] {
  const byTime = new Map<number, Bar>();
  for (const bar of bars) {
    byTime.set(bar.time, bar);
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/**
 * Merge two already-relevant bar collections, keeping sorted order and removing
 * duplicates by `time` with last-write-wins for `incoming`. `incoming` is
 * applied after `existing`, so an incoming bar replaces an existing one with
 * the same time.
 */
function mergeBars(existing: readonly Bar[], incoming: readonly Bar[]): Bar[] {
  return normalizeBars([...existing, ...incoming]);
}

/**
 * Compute the covered range that results from extending `base` (if any) to
 * include every bar time plus an optional explicitly-fetched range. Returns
 * `undefined` only when there is no information at all (no base, no bars, no
 * explicit range).
 */
function extendRange(
  base: CoveredRange | undefined,
  bars: readonly Bar[],
  explicit?: CoveredRange,
): CoveredRange | undefined {
  let from = base?.from;
  let to = base?.to;

  const consider = (value: number): void => {
    from = from === undefined ? value : Math.min(from, value);
    to = to === undefined ? value : Math.max(to, value);
  };

  if (explicit) {
    consider(explicit.from);
    consider(explicit.to);
  }
  if (bars.length > 0) {
    // bars are not assumed sorted here; scan both ends defensively.
    for (const bar of bars) {
      consider(bar.time);
    }
  }

  if (from === undefined || to === undefined) {
    return undefined;
  }
  return { from, to };
}

/**
 * Per-(symbol, contract, timeframe) in-browser bar cache. Tracks a covered
 * range per key and keeps bars sorted and duplicate-free at all times.
 */
export class MemoryCache {
  private readonly store = new Map<string, CachedSeries>();

  /** Number of cached series. */
  get size(): number {
    return this.store.size;
  }

  /** True when a series exists for the given key. */
  has(key: SeriesKey): boolean {
    return this.store.has(serializeKey(key));
  }

  /**
   * Return the cached series for a key, or `undefined` if none is cached. The
   * returned object is a defensive copy: mutating it does not affect the cache.
   */
  get(key: SeriesKey): CachedSeries | undefined {
    const series = this.store.get(serializeKey(key));
    if (!series) {
      return undefined;
    }
    return {
      symbol: series.symbol,
      contract: series.contract,
      timeframe: series.timeframe,
      bars: series.bars.slice(),
      coveredFrom: series.coveredFrom,
      coveredTo: series.coveredTo,
    };
  }

  /**
   * Return just the covered `[from, to]` range for a key, or `undefined` if the
   * key is not cached. The RangePatcher uses this to compute missing ranges
   * (task 12.5).
   */
  coveredRange(key: SeriesKey): CoveredRange | undefined {
    const series = this.store.get(serializeKey(key));
    if (!series) {
      return undefined;
    }
    return { from: series.coveredFrom, to: series.coveredTo };
  }

  /**
   * Replace the entire series for a key. Bars are normalized (sorted,
   * duplicate-free). The covered range defaults to the span of the provided
   * bars, but a wider explicit range may be supplied (e.g. the request range a
   * HistoryLoader fetched, which may extend past the first/last returned bar).
   */
  set(key: SeriesKey, bars: readonly Bar[], range?: CoveredRange): void {
    const sorted = normalizeBars(bars);
    const covered = extendRange(undefined, sorted, range);
    this.store.set(serializeKey(key), {
      symbol: key.symbol,
      contract: key.contract,
      timeframe: key.timeframe,
      bars: sorted,
      coveredFrom: covered?.from ?? 0,
      coveredTo: covered?.to ?? 0,
    });
  }

  /**
   * Append bars to an existing series (or create it if absent). Equivalent to
   * `merge` in behavior — bars are merged by time with last-write-wins and the
   * covered range is extended — but named to read naturally for the common case
   * of adding newer realtime bars on top of loaded history (Req 11.2, 11.3).
   */
  append(key: SeriesKey, bars: readonly Bar[], range?: CoveredRange): void {
    this.merge(key, bars, range);
  }

  /**
   * Merge bars into an existing series (or create it if absent), keeping bars
   * sorted and duplicate-free with last-write-wins by `time`, and extending the
   * covered range to include the merged bars and any explicit fetched range.
   *
   * This is the seam the RangePatcher (task 12.5) uses to patch background-
   * fetched ranges into the cache.
   */
  merge(key: SeriesKey, bars: readonly Bar[], range?: CoveredRange): void {
    const id = serializeKey(key);
    const existing = this.store.get(id);

    if (!existing) {
      this.set(key, bars, range);
      return;
    }

    const mergedBars = mergeBars(existing.bars, bars);
    const covered = extendRange(
      { from: existing.coveredFrom, to: existing.coveredTo },
      bars,
      range,
    );
    this.store.set(id, {
      symbol: existing.symbol,
      contract: existing.contract,
      timeframe: existing.timeframe,
      bars: mergedBars,
      coveredFrom: covered?.from ?? existing.coveredFrom,
      coveredTo: covered?.to ?? existing.coveredTo,
    });
  }

  /** Remove a single series. Returns true if a series was removed. */
  delete(key: SeriesKey): boolean {
    return this.store.delete(serializeKey(key));
  }

  /** Remove all cached series. */
  clear(): void {
    this.store.clear();
  }
}
