import type { BusinessDay, Time } from "lightweight-charts";

const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60_000;
const MIN_TIMEZONE_OFFSET_MINUTES = -12 * 60;
const MAX_TIMEZONE_OFFSET_MINUTES = 14 * 60;

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const DEFAULT_TIMEZONE_OFFSET_MINUTES = 7 * 60;

export interface TimezoneOffsetOption {
  offsetMinutes: number;
  label: string;
}

export const TIMEZONE_OFFSET_OPTIONS: readonly TimezoneOffsetOption[] =
  Array.from({ length: 27 }, (_, index) => {
    const offsetMinutes = (-12 + index) * 60;
    return {
      offsetMinutes,
      label: formatUtcOffset(offsetMinutes),
    };
  });

export type TimeAxisTickKind =
  | "year"
  | "month"
  | "day"
  | "time"
  | "timeWithSeconds";

export type TimeInput = Time | number;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function isBusinessDay(value: TimeInput): value is BusinessDay {
  return typeof value === "object" && value !== null && "year" in value;
}

function utcSecondsForTime(time: TimeInput): number | undefined {
  if (typeof time === "number") {
    return time;
  }
  if (typeof time === "string") {
    const parsed = Date.parse(`${time}T00:00:00.000Z`);
    return Number.isFinite(parsed)
      ? Math.floor(parsed / MS_PER_SECOND)
      : undefined;
  }
  if (isBusinessDay(time)) {
    return Math.floor(
      Date.UTC(time.year, time.month - 1, time.day) / MS_PER_SECOND,
    );
  }
  return undefined;
}

function shiftedUtcDate(time: TimeInput, offsetMinutes: number): Date | undefined {
  const utcSeconds = utcSecondsForTime(time);
  if (utcSeconds === undefined) return undefined;
  return new Date(utcSeconds * MS_PER_SECOND + offsetMinutes * MS_PER_MINUTE);
}

export function normalizeTimezoneOffsetMinutes(
  value: unknown,
  fallback = DEFAULT_TIMEZONE_OFFSET_MINUTES,
): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(
    MAX_TIMEZONE_OFFSET_MINUTES,
    Math.max(MIN_TIMEZONE_OFFSET_MINUTES, Math.round(numeric)),
  );
}

export function formatUtcOffset(offsetMinutes: number): string {
  if (offsetMinutes === 0) return "UTC";
  const sign = offsetMinutes > 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return minutes === 0
    ? `UTC${sign}${hours}`
    : `UTC${sign}${hours}:${pad2(minutes)}`;
}

export function formatClockForOffset(
  nowMs: number,
  offsetMinutes: number,
): string {
  const date = new Date(nowMs + offsetMinutes * MS_PER_MINUTE);
  return [
    pad2(date.getUTCHours()),
    pad2(date.getUTCMinutes()),
    pad2(date.getUTCSeconds()),
  ].join(":");
}

export function formatTickMarkForOffset(
  time: TimeInput,
  offsetMinutes: number,
  kind: TimeAxisTickKind,
): string | null {
  const date = shiftedUtcDate(time, offsetMinutes);
  if (date === undefined) return null;

  switch (kind) {
    case "year":
      return String(date.getUTCFullYear());
    case "month":
      return MONTH_NAMES[date.getUTCMonth()];
    case "day":
      return `${date.getUTCDate()} ${MONTH_NAMES[date.getUTCMonth()]}`;
    case "timeWithSeconds":
      return [
        pad2(date.getUTCHours()),
        pad2(date.getUTCMinutes()),
        pad2(date.getUTCSeconds()),
      ].join(":");
    case "time":
      return [pad2(date.getUTCHours()), pad2(date.getUTCMinutes())].join(":");
  }
}

export function formatCrosshairTimeForOffset(
  time: TimeInput,
  offsetMinutes: number,
): string {
  const date = shiftedUtcDate(time, offsetMinutes);
  if (date === undefined) return "";
  return [
    `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
      date.getUTCDate(),
    )}`,
    `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`,
    formatUtcOffset(offsetMinutes),
  ].join(" ");
}
