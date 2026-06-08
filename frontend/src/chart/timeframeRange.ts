import type { Timeframe } from "../socket/messages";
import type { AnchorPoint } from "./drawings/types";
import { barDurationForTimeframe } from "./barCountdown";

const TIMEFRAME_DISPLAY_OFFSET_MS: Record<Timeframe, number> = {
  "1m": 60_000,
  "3m": 3 * 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "30m": 30 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1D": 0,
};

export function displayOffsetForTimeframe(timeframe: Timeframe): number {
  return TIMEFRAME_DISPLAY_OFFSET_MS[timeframe];
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
  const durationMs = barDurationForTimeframe(timeframe);
  const minDisplayMs = Math.min(first, second) * 1000;
  const maxDisplayMs = Math.max(first, second) * 1000;
  return {
    from: Math.max(0, Math.round(minDisplayMs - displayOffsetMs)),
    to: Math.max(
      0,
      Math.round(maxDisplayMs + (durationMs - displayOffsetMs) - 1),
    ),
  };
}
