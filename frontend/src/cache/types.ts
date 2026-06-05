// cache module — shared types for the browser memory cache.
//
// These types back the HistoryLoader (Req 11.1, 11.4) and MemoryCache
// (Req 12.1, 12.2) implementations. They mirror the design's "Frontend Memory
// Cache Model" (design.md) and the `/api/history` response shape.

/**
 * A single OHLCV bar. `time` is a Canonical_Timestamp: integer milliseconds
 * since the Unix epoch, UTC (matching the backend `bar_update` / `/api/history`
 * bar shape in design.md).
 */
export interface Bar {
  time: number; // Canonical_Timestamp ms (bucket start)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * The identity of a cached series. The browser memory cache is keyed by the
 * tuple `(symbol, contract, timeframe)` (design.md "Frontend Memory Cache
 * Model", Req 12.1–12.3).
 */
export interface SeriesKey {
  symbol: string;
  contract: string;
  timeframe: string;
}

/**
 * A cached, ordered series of bars plus the time range it is known to cover.
 * `coveredFrom`/`coveredTo` are Canonical_Timestamp ms. The covered range can
 * be wider than `bars[0].time .. bars[at-1].time` when a caller explicitly
 * records that an empty sub-range was fetched and found to contain no bars —
 * this is the seam the RangePatcher (task 12.5) builds on for gap-aware
 * patching.
 */
export interface CachedSeries {
  symbol: string;
  contract: string;
  timeframe: string;
  bars: Bar[]; // sorted by time ascending, duplicate-free
  coveredFrom: number; // Canonical_Timestamp ms
  coveredTo: number; // Canonical_Timestamp ms
}

/** An inclusive `[from, to]` Canonical_Timestamp ms range. */
export interface CoveredRange {
  from: number;
  to: number;
}

/**
 * Serialize a SeriesKey into a stable string usable as a Map key. Uses a unit
 * separator (U+001F) that cannot appear in a symbol/contract/timeframe value,
 * so distinct tuples never collide.
 */
export function serializeKey(key: SeriesKey): string {
  return `${key.symbol}\u001f${key.contract}\u001f${key.timeframe}`;
}
