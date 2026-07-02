const MINUTE_MS = 60_000;

export function floorToMinuteMs(timeMs: number): number {
  return Math.floor(timeMs / MINUTE_MS) * MINUTE_MS;
}

export function parseFootprintSearchTime(
  input: string,
  now: Date = new Date(),
): number | null {
  const text = input.trim();
  if (!text) return null;

  const iso = text.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (iso) {
    return localDateMs({
      year: Number(iso[1]),
      month: Number(iso[2]),
      day: Number(iso[3]),
      hour: Number(iso[4] ?? 0),
      minute: Number(iso[5] ?? 0),
      second: Number(iso[6] ?? 0),
    });
  }

  const timeThenDate = text.match(
    /^(\d{1,2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/,
  );
  if (timeThenDate) {
    return localDateMs({
      year: normalizeYear(timeThenDate[5], now),
      month: Number(timeThenDate[4]),
      day: Number(timeThenDate[3]),
      hour: Number(timeThenDate[1]),
      minute: Number(timeThenDate[2]),
      second: 0,
    });
  }

  const dateThenTime = text.match(
    /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s+(\d{1,2}):(\d{2})$/,
  );
  if (dateThenTime) {
    return localDateMs({
      year: normalizeYear(dateThenTime[3], now),
      month: Number(dateThenTime[2]),
      day: Number(dateThenTime[1]),
      hour: Number(dateThenTime[4]),
      minute: Number(dateThenTime[5]),
      second: 0,
    });
  }

  return null;
}

function normalizeYear(value: string | undefined, now: Date): number {
  if (!value) return now.getFullYear();
  const year = Number(value);
  return year < 100 ? 2000 + year : year;
}

function localDateMs(input: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}): number | null {
  const date = new Date(
    input.year,
    input.month - 1,
    input.day,
    input.hour,
    input.minute,
    input.second,
    0,
  );
  if (
    date.getFullYear() !== input.year ||
    date.getMonth() !== input.month - 1 ||
    date.getDate() !== input.day ||
    date.getHours() !== input.hour ||
    date.getMinutes() !== input.minute ||
    date.getSeconds() !== input.second
  ) {
    return null;
  }
  return floorToMinuteMs(date.getTime());
}
