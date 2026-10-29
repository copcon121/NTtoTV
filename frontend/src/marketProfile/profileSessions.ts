export type ProfileSessionMode = "full" | "us-comex";

export interface ExchangeDay {
  start: number;
  end: number;
  tradeDate: string;
}

export function profileSessionWindow(
  day: ExchangeDay,
  mode: ProfileSessionMode,
): { start: number; end: number } {
  if (mode === "full") return { start: day.start, end: day.end };

  // The US view includes the hour before the configured 20:00 US window.
  // Keep this fixed in UTC+7, independently of the exchange's DST calendar.
  const midnight = Date.parse(`${day.tradeDate}T00:00:00+07:00`);
  const hourMs = 60 * 60 * 1000;
  return {
    start: Math.max(day.start, midnight + 19 * hourMs),
    end: Math.min(day.end, midnight + 28 * hourMs - 1),
  };
}
