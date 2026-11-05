export type ProfileSessionMode = "full" | "us-comex";

export interface ExchangeDay {
  start: number;
  end: number;
  tradeDate: string;
}

export interface ProfileSessionWindow {
  start: number;
  end: number;
  closeTime?: number;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function profileSessionWindow(
  day: ExchangeDay,
  mode: ProfileSessionMode,
): ProfileSessionWindow {
  if (mode === "full") return { start: day.start, end: day.end };

  // A US-anchored profile spans a complete 24 hours: the preceding evening's
  // 20:00 through this trade date's 20:00. The 04:00 US close is a reference
  // inside that profile, so the following Asia/EU data remains in the profile.
  const midnight = Date.parse(`${day.tradeDate}T00:00:00+07:00`);
  return {
    start: midnight - 4 * HOUR_MS,
    end: midnight + 20 * HOUR_MS - 1,
    closeTime: midnight + 4 * HOUR_MS,
  };
}

export function profileSessionWindows(
  days: readonly ExchangeDay[],
  mode: ProfileSessionMode,
  asOf: number,
): ProfileSessionWindow[] {
  if (mode === "full") return days.map((day) => profileSessionWindow(day, mode));

  const windows = new Map<number, ProfileSessionWindow>();
  for (const day of days) {
    if (day.start > asOf) continue;
    const window = profileSessionWindow(day, mode);
    windows.set(window.start, window);
    // The exchange day rolls at 05:00/06:00 Vietnam time. Start a new US
    // profile immediately at 20:00, without waiting for that exchange rollover.
    const nextStart = window.start + DAY_MS;
    if (nextStart <= asOf && nextStart <= day.end) {
      windows.set(nextStart, {
        start: nextStart,
        end: window.end + DAY_MS,
        closeTime: window.closeTime! + DAY_MS,
      });
    }
  }
  // Overlapping exchange days deduplicate naturally. Weekend windows with no
  // exchange session are never introduced; each displayed profile is 24h.
  return [...windows.values()].sort((a, b) => a.start - b.start).slice(-days.length);
}
