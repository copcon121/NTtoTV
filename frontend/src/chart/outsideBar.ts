import { type Bar } from "../cache/types";

export interface OutsideBarSettings {
  enabled: boolean;
  bullColor: string;
  bearColor: string;
}

export const DEFAULT_OUTSIDE_BAR_SETTINGS: OutsideBarSettings = {
  enabled: false,
  bullColor: "#00f329",
  bearColor: "#ff9800",
};

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalizeColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const color = value.trim();
  return HEX_COLOR_RE.test(color) ? color : fallback;
}

export function normalizeOutsideBarSettings(
  settings: Partial<OutsideBarSettings> | null | undefined,
): OutsideBarSettings {
  return {
    enabled: Boolean(settings?.enabled),
    bullColor: normalizeColor(
      settings?.bullColor,
      DEFAULT_OUTSIDE_BAR_SETTINGS.bullColor,
    ),
    bearColor: normalizeColor(
      settings?.bearColor,
      DEFAULT_OUTSIDE_BAR_SETTINGS.bearColor,
    ),
  };
}

export function isOutsideBar(bar: Bar, previous: Bar | undefined): boolean {
  return previous !== undefined && bar.high > previous.high && bar.low < previous.low;
}

export function outsideBarColor(
  bar: Bar,
  previous: Bar | undefined,
  settings: OutsideBarSettings = DEFAULT_OUTSIDE_BAR_SETTINGS,
): string | undefined {
  if (!settings.enabled || !isOutsideBar(bar, previous)) {
    return undefined;
  }
  if (bar.close > bar.open) {
    return settings.bullColor;
  }
  if (bar.close < bar.open) {
    return settings.bearColor;
  }
  return undefined;
}
