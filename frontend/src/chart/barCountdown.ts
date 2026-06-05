import type { Timeframe } from "../socket/messages";

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;

const BAR_DURATION_MS: Record<Timeframe, number> = {
  "1m": MINUTE_MS,
  "3m": 3 * MINUTE_MS,
  "5m": 5 * MINUTE_MS,
  "15m": 15 * MINUTE_MS,
  "30m": 30 * MINUTE_MS,
  "1h": HOUR_MS,
  "4h": 4 * HOUR_MS,
  "1D": 24 * HOUR_MS,
};

export function barDurationForTimeframe(timeframe: Timeframe): number {
  return BAR_DURATION_MS[timeframe];
}

export function remainingBarTimeMs(
  barStartMs: number,
  durationMs: number,
  nowMs = Date.now(),
): number {
  return Math.max(0, barStartMs + durationMs - nowMs);
}

export function countdownBarStartMs(
  latestBarStartMs: number,
  durationMs: number,
  nowMs = Date.now(),
): number {
  if (durationMs <= 0) return latestBarStartMs;
  const currentBucketStart = Math.floor(nowMs / durationMs) * durationMs;
  return Math.max(latestBarStartMs, currentBucketStart);
}

export function formatBarCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / SECOND_MS));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}
