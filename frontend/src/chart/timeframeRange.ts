import type { Timeframe } from "../socket/messages";
import type { AnchorPoint } from "./drawings/types";
import { barDurationForTimeframe, barEndForTimeframe } from "./barCountdown";

const TIMEFRAME_DISPLAY_OFFSET_MS: Record<Timeframe, number> = {
  "15s": 0,
  "30s": 0,
  "1m": 0,
  "3m": 0,
  "5m": 0,
  "15m": 0,
  "30m": 0,
  "1h": 0,
  "4h": 0,
  "1D": 0,
  "1W": 0,
  "1M": 0,
};

export function displayOffsetForTimeframe(timeframe: Timeframe): number {
  return TIMEFRAME_DISPLAY_OFFSET_MS[timeframe];
}

/** Chart footprint aggregates M1 ladders into candles of one minute or longer. */
export function footprintEnabledForTimeframe(timeframe: Timeframe): boolean {
  return barDurationForTimeframe(timeframe) >= 60_000;
}

/** GC Push Momentum is calibrated and fed with exact delta on M1 and M5. */
export function gcPushMomentumEnabledForTimeframe(
  timeframe: Timeframe,
): boolean {
  return timeframe === "1m" || timeframe === "5m";
}

/** TDU Buy/Sell Momentum is intended for the M1 and M5 chart views only. */
export function tduSignalsEnabledForTimeframe(timeframe: Timeframe): boolean {
  return timeframe === "1m" || timeframe === "5m";
}

export function fixedRangeMsFromAnchors(
  anchors: readonly AnchorPoint[],
  timeframe: Timeframe,
): { from: number; to: number } | null {
  if (anchors.length < 2) return null;
  const first = anchors[0].time as number;
  const second = anchors[1].time as number;
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;

  const displayOffsetMs = displayOffsetForTimeframe(timeframe);
  const minDisplayMs = Math.min(first, second) * 1000;
  const maxDisplayMs = Math.max(first, second) * 1000;
  return {
    from: Math.max(0, Math.round(minDisplayMs - displayOffsetMs)),
    to: Math.max(
      0,
      Math.round(barEndForTimeframe(maxDisplayMs - displayOffsetMs, timeframe) - 1),
    ),
  };
}
