import type { Timeframe } from "../socket/messages";

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const centralHour = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  hour: "numeric",
  hourCycle: "h23",
});

const BAR_DURATION_MS: Record<Timeframe, number> = {
  "15s": 15 * SECOND_MS,
  "30s": 30 * SECOND_MS,
  "1m": MINUTE_MS,
  "3m": 3 * MINUTE_MS,
  "5m": 5 * MINUTE_MS,
  "15m": 15 * MINUTE_MS,
  "30m": 30 * MINUTE_MS,
  "1h": HOUR_MS,
  "4h": 4 * HOUR_MS,
  "1D": DAY_MS,
  "1W": 7 * DAY_MS,
  "1M": 31 * DAY_MS,
};

export function barDurationForTimeframe(timeframe: Timeframe): number {
  return BAR_DURATION_MS[timeframe];
}

export function calendarBarEndMs(
  barStartMs: number,
  timeframe: Timeframe | undefined,
): number | undefined {
  if (timeframe !== "1W" && timeframe !== "1M") return undefined;

  // GC's 17:00 CT open is always on the same UTC date, at 22:00 or 23:00.
  // For a monthly bar the UTC date of its open is the prior month's last day.
  const start = new Date(barStartMs);
  const next = timeframe === "1W"
    ? Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 7, 23)
    : Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 2, 0, 23);
  return centralHour.format(next) === "18" ? next - HOUR_MS : next;
}

export function barEndForTimeframe(barStartMs: number, timeframe: Timeframe): number {
  return calendarBarEndMs(barStartMs, timeframe) ?? barStartMs + barDurationForTimeframe(timeframe);
}

export function remainingBarTimeMs(
  barStartMs: number,
  durationMs: number,
  nowMs = Date.now(),
): number {
  return Math.max(0, barStartMs + durationMs - nowMs);
}

export function shouldUseObservedBarCountdown(
  latestBarStartMs: number,
  durationMs: number,
  nowMs = Date.now(),
): boolean {
  if (durationMs <= 0) return false;
  const currentBucketStart = Math.floor(nowMs / durationMs) * durationMs;
  return latestBarStartMs > currentBucketStart;
}

export function remainingObservedBarTimeMs(
  barFirstSeenMs: number,
  durationMs: number,
  nowMs = Date.now(),
): number {
  const elapsedMs = Math.max(0, nowMs - barFirstSeenMs);
  return Math.max(0, durationMs - elapsedMs);
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
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${pad(hours % 24)}h`;
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}
