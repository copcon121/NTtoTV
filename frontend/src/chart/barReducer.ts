// chart module — pure incremental bar-series reducer.
//
// This is the testable core of the ChartContainer (design.md "Frontend
// Modules": ChartContainer, Req 11.3, 12.4, 19.1, 19.2). The React component
// and the Lightweight Charts library are kept behind a thin adapter (see
// `chartSeriesController.ts` / `lightweightChartsAdapter.ts`) precisely so this
// merge logic can be unit- and property-tested without a real DOM or canvas.
//
// Merge semantics (Req 11.3): a realtime `bar_update` is applied to the current
// series *incrementally* — a bar with a new time is appended in time order, and
// a bar that shares the time key of an existing (in-progress) bar overwrites it.
// A full-data replacement (`setData`) is NEVER performed on an update. When the
// incoming bar is byte-for-byte identical to the existing one the result is a
// no-op so the chart can skip a repaint when its inputs are unchanged (Req 12.4).
//
// Property 22 (task 12.4) exercises this module: applying any sequence of
// updates to any initial series yields a series identical to the expected merge
// (sorted by time, duplicate-free, in-progress bars overwritten by time key)
// with no full-replacement operation performed.

import { normalizeBars } from "../cache/memoryCache";
import { type Bar } from "../cache/types";

/** An ordered (ascending by time), duplicate-free series of bars. */
export type BarSeries = readonly Bar[];

/**
 * How a single `bar_update` was applied to the series:
 *  - `append`    — a new bar whose time is after the last bar (the common
 *                  realtime case: a new bucket opened).
 *  - `overwrite` — a bar whose time matches an existing bar and whose values
 *                  differ (the common realtime case: the in-progress bar
 *                  changed).
 *  - `insert`    — a new bar whose time falls before the last bar (an
 *                  out-of-order / backfilled bar); kept sorted.
 *  - `noop`      — the incoming bar equals the existing bar at that time, so
 *                  nothing changed and no repaint is needed (Req 12.4).
 *
 * Crucially, none of these is a full-data replacement, which is what Req 11.3
 * forbids on a realtime update.
 */
export type BarApplicationKind = "append" | "overwrite" | "insert" | "noop";

/** Result of applying one bar to a series. `bars` is the new (or unchanged) series. */
export interface BarApplication {
  /** Classification of the operation performed. */
  kind: BarApplicationKind;
  /** The resulting series (sorted ascending by time, duplicate-free). */
  bars: BarSeries;
  /**
   * The bar occupying the affected time key after the operation. For a `noop`
   * this is the unchanged existing bar; otherwise it is the (copied) incoming
   * bar. This is exactly the single point an incremental `series.update()` call
   * should be given.
   */
  bar: Bar;
  /** Index of `bar` within `bars`. */
  index: number;
}

/** Structural equality over the six OHLCV fields that drive rendering. */
export function barsEqual(a: Bar, b: Bar): boolean {
  return (
    a.time === b.time &&
    a.open === b.open &&
    a.high === b.high &&
    a.low === b.low &&
    a.close === b.close &&
    a.volume === b.volume
  );
}

/**
 * Lower-bound binary search: index of the first bar whose time is >= `time`.
 * Assumes `series` is sorted ascending by time with unique times (the invariant
 * this module maintains).
 */
function lowerBound(series: BarSeries, time: number): number {
  let lo = 0;
  let hi = series.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (series[mid].time < time) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/** Index of the bar with exactly `time`, or -1 if none. */
function indexByTime(series: BarSeries, time: number): number {
  const i = lowerBound(series, time);
  return i < series.length && series[i].time === time ? i : -1;
}

/**
 * Apply a single `bar_update` bar to a series, incrementally.
 *
 * The input series MUST already be sorted ascending and duplicate-free (the
 * invariant maintained by this module and by the MemoryCache); use
 * {@link reduceBars} or {@link normalizeBars} when that is not guaranteed.
 *
 * The input is never mutated. The incoming bar is shallow-copied before it
 * enters the series so later external mutation cannot corrupt the cache.
 */
export function applyBarUpdate(series: BarSeries, incoming: Bar): BarApplication {
  const existingIndex = indexByTime(series, incoming.time);

  if (existingIndex >= 0) {
    const existing = series[existingIndex];
    if (barsEqual(existing, incoming)) {
      // Inputs unchanged for this time key — no repaint (Req 12.4).
      return { kind: "noop", bars: series, bar: existing, index: existingIndex };
    }
    // In-progress bar overwritten by time key (Req 11.3).
    const next = series.slice();
    const copy = { ...incoming };
    next[existingIndex] = copy;
    return { kind: "overwrite", bars: next, bar: copy, index: existingIndex };
  }

  // New time key: insert at its sorted position. When that position is the end
  // it is an append (the common realtime case); otherwise it is an out-of-order
  // insert that we still place in time order.
  const at = lowerBound(series, incoming.time);
  const next = series.slice();
  const copy = { ...incoming };
  next.splice(at, 0, copy);
  const kind: BarApplicationKind = at === series.length ? "append" : "insert";
  return { kind, bars: next, bar: copy, index: at };
}

/**
 * Fold a sequence of `bar_update` bars over an initial series, returning the
 * fully merged series. The initial series is normalized first (sorted,
 * duplicate-free, last-write-wins by time) so callers may pass unsorted input.
 *
 * The result is identical to `normalizeBars([...initial, ...updates])` — i.e.
 * sorted by time, duplicate-free, with later updates overwriting earlier bars
 * that share a time key — but reached purely by incremental `applyBarUpdate`
 * steps, never a full replacement.
 */
export function reduceBars(initial: BarSeries, updates: Iterable<Bar>): BarSeries {
  let series: BarSeries = normalizeBars(initial);
  for (const update of updates) {
    series = applyBarUpdate(series, update).bars;
  }
  return series;
}
