export const DEFAULT_SESSION_VOLUME_PROFILE_WIDTH_PX = 60;
export const MIN_SESSION_VOLUME_PROFILE_WIDTH_PX = 32;
export const MAX_SESSION_VOLUME_PROFILE_WIDTH_PX = 180;

export const DEFAULT_SESSION_VOLUME_PROFILE_ROW_TICKS = 2;
export const MIN_SESSION_VOLUME_PROFILE_ROW_TICKS = 1;
export const MAX_SESSION_VOLUME_PROFILE_ROW_TICKS = 100;

export const DEFAULT_SESSION_VOLUME_PROFILE_DAYS = 1;
export const MIN_SESSION_VOLUME_PROFILE_DAYS = 1;
export const MAX_SESSION_VOLUME_PROFILE_DAYS = 7;

export function normalizeSessionVolumeProfileWidth(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return DEFAULT_SESSION_VOLUME_PROFILE_WIDTH_PX;
  }
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_SESSION_VOLUME_PROFILE_WIDTH_PX;
  return Math.min(
    MAX_SESSION_VOLUME_PROFILE_WIDTH_PX,
    Math.max(MIN_SESSION_VOLUME_PROFILE_WIDTH_PX, parsed),
  );
}

export function normalizeSessionVolumeProfileRowTicks(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return DEFAULT_SESSION_VOLUME_PROFILE_ROW_TICKS;
  }
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_SESSION_VOLUME_PROFILE_ROW_TICKS;
  return Math.min(
    MAX_SESSION_VOLUME_PROFILE_ROW_TICKS,
    Math.max(MIN_SESSION_VOLUME_PROFILE_ROW_TICKS, parsed),
  );
}

export function normalizeSessionVolumeProfileDays(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return DEFAULT_SESSION_VOLUME_PROFILE_DAYS;
  }
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_SESSION_VOLUME_PROFILE_DAYS;
  return Math.min(
    MAX_SESSION_VOLUME_PROFILE_DAYS,
    Math.max(MIN_SESSION_VOLUME_PROFILE_DAYS, parsed),
  );
}

export const SESSION_VP_TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
export const SESSION_VP_OPEN_LOCAL_HOUR = 5;
export const SESSION_VP_DAY_MS = 24 * 60 * 60 * 1000;

export function sessionStartForUtc(time: number): number {
  const local = new Date(time + SESSION_VP_TZ_OFFSET_MS);
  let start =
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
      SESSION_VP_OPEN_LOCAL_HOUR,
      0,
      0,
      0,
    ) - SESSION_VP_TZ_OFFSET_MS;
  if (time < start) start -= SESSION_VP_DAY_MS;
  return start;
}

export function isTradingSessionStart(start: number): boolean {
  const weekday = new Date(start + SESSION_VP_TZ_OFFSET_MS).getUTCDay();
  return weekday >= 1 && weekday <= 5;
}

export function computeSessionVolumeProfileFromMs(now: number, days: number): number {
  const safeDays = normalizeSessionVolumeProfileDays(days);
  const starts: number[] = [];
  let cursor = sessionStartForUtc(now);
  let scanned = 0;
  const maxScan = safeDays + 14;
  while (starts.length < safeDays && scanned < maxScan) {
    if (isTradingSessionStart(cursor)) {
      starts.push(cursor);
    }
    cursor -= SESSION_VP_DAY_MS;
    scanned += 1;
  }
  if (starts.length === 0) return sessionStartForUtc(now);
  return starts[starts.length - 1];
}
