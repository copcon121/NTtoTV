// chart module — EMA (exponential moving average) overlay math.
//
// Pure helpers so the EMA overlay is testable without a chart. The adapter owns
// the line series; this module owns the numbers. EMA is an explicit addition to
// the v1 indicator set (Req 19.3 allows overlays that are explicitly added).
//
// Definition: EMA_t = close_t * k + EMA_{t-1} * (1 - k), with smoothing factor
// k = 2 / (period + 1). The series is seeded from the first bar's close so the
// line is continuous from the first available bar (it converges to the true EMA
// as more bars accumulate, which is the standard streaming-EMA behavior).

import { type Bar } from "../cache/types";

/** One EMA point keyed by the backend Canonical_Timestamp (ms). */
export interface EmaPoint {
  /** Backend bucket-start time in ms (same key space as the source bar). */
  time: number;
  /** EMA value at this bar. */
  value: number;
}

/** Smoothing factor for an EMA of the given period. */
export function emaSmoothing(period: number): number {
  return 2 / (period + 1);
}

/**
 * Compute the EMA over `bars` (assumed ascending by time) for `period`.
 * Returns one point per input bar; an empty input (or non-positive period)
 * yields an empty series.
 */
export function emaSeries(bars: readonly Bar[], period: number): EmaPoint[] {
  if (period <= 0 || bars.length === 0) return [];
  const k = emaSmoothing(period);
  const out: EmaPoint[] = new Array(bars.length);
  let prev: number | undefined;
  for (let i = 0; i < bars.length; i += 1) {
    const close = bars[i].close;
    prev = prev === undefined ? close : close * k + prev * (1 - k);
    out[i] = { time: bars[i].time, value: prev };
  }
  return out;
}

/**
 * Advance an EMA by one bar. With no prior EMA the seed is the close itself.
 * Used for incremental updates without recomputing the whole series.
 */
export function nextEma(
  prevEma: number | undefined,
  close: number,
  period: number,
): number {
  if (prevEma === undefined) return close;
  const k = emaSmoothing(period);
  return close * k + prevEma * (1 - k);
}
