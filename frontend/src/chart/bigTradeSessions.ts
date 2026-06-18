export type BigTradeSession = "asia" | "eu" | "us";

export interface BigTradeSessionMinVolumes {
  asia: number;
  eu: number;
  us: number;
}

export interface BigTradeSessionSettings {
  minVolume?: number;
  sessionMinVolumes?: Partial<BigTradeSessionMinVolumes>;
}

export const BIG_TRADE_SESSIONS: readonly {
  key: BigTradeSession;
  label: string;
}[] = [
  { key: "asia", label: "Asia" },
  { key: "eu", label: "EU" },
  { key: "us", label: "US" },
];

export const DEFAULT_BIG_TRADE_SESSION_MIN_VOLUMES: BigTradeSessionMinVolumes = {
  asia: 30,
  eu: 50,
  us: 100,
};

const NEW_YORK_CLOCK = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function normalizedMinVolume(value: unknown, fallback: number): number {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function newYorkMinuteOfDay(timeMs: number): number {
  const parts = NEW_YORK_CLOCK.formatToParts(new Date(timeMs));
  const hourPart = parts.find((part) => part.type === "hour")?.value;
  const minutePart = parts.find((part) => part.type === "minute")?.value;
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return 0;
  }
  return (Math.trunc(hour) % 24) * 60 + Math.trunc(minute);
}

export function bigTradeSessionForTime(timeMs: number): BigTradeSession {
  const minute = newYorkMinuteOfDay(timeMs);
  // GC session buckets use New York time: Asia 18:00-02:00,
  // EU 02:00-08:30, US 08:30-17:00.
  const euStart = 2 * 60;
  const usStart = 8 * 60 + 30;
  const usEnd = 17 * 60;

  if (minute >= usStart && minute < usEnd) return "us";
  if (minute >= euStart && minute < usStart) return "eu";
  return "asia";
}

export function normalizeBigTradeSessionMinVolumes(
  settings: BigTradeSessionSettings | undefined,
): BigTradeSessionMinVolumes {
  const sessionMinVolumes = settings?.sessionMinVolumes;
  if (sessionMinVolumes === undefined) {
    const legacyMinVolume = normalizedMinVolume(
      settings?.minVolume,
      DEFAULT_BIG_TRADE_SESSION_MIN_VOLUMES.asia,
    );
    return {
      asia: legacyMinVolume,
      eu: legacyMinVolume,
      us: legacyMinVolume,
    };
  }
  return {
    asia: normalizedMinVolume(
      sessionMinVolumes.asia,
      DEFAULT_BIG_TRADE_SESSION_MIN_VOLUMES.asia,
    ),
    eu: normalizedMinVolume(
      sessionMinVolumes.eu,
      DEFAULT_BIG_TRADE_SESSION_MIN_VOLUMES.eu,
    ),
    us: normalizedMinVolume(
      sessionMinVolumes.us,
      DEFAULT_BIG_TRADE_SESSION_MIN_VOLUMES.us,
    ),
  };
}

export function bigTradeMinVolumeForTime(
  timeMs: number,
  settings: BigTradeSessionSettings | undefined,
): number {
  const session = bigTradeSessionForTime(timeMs);
  return normalizeBigTradeSessionMinVolumes(settings)[session];
}
