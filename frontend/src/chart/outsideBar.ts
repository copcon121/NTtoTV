import { type Bar } from "../cache/types";

export interface OutsideBarDeltaFilterSettings {
  enabled: boolean;
  lookbackBars: number;
  minSamples: number;
  deltaMultiplier: number;
  requireRangeExpansion: boolean;
}

export interface OutsideBarSettings {
  enabled: boolean;
  bullColor: string;
  bearColor: string;
  deltaFilter: OutsideBarDeltaFilterSettings;
}

export interface OutsideBarDeltaPoint {
  time: number;
  closeDelta: number;
}

export interface OutsideBarFilterContext {
  bars?: readonly Bar[];
  index?: number;
  deltaByTime?: ReadonlyMap<number, OutsideBarDeltaPoint>;
}

export type OutsideBarSignalSide = "buy" | "sell";

export const DEFAULT_OUTSIDE_BAR_DELTA_FILTER: OutsideBarDeltaFilterSettings = {
  enabled: false,
  lookbackBars: 50,
  minSamples: 20,
  deltaMultiplier: 1,
  requireRangeExpansion: true,
};

export const DEFAULT_OUTSIDE_BAR_SETTINGS: OutsideBarSettings = {
  enabled: false,
  bullColor: "#00f329",
  bearColor: "#ff9800",
  deltaFilter: DEFAULT_OUTSIDE_BAR_DELTA_FILTER,
};

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalizeColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const color = value.trim();
  return HEX_COLOR_RE.test(color) ? color : fallback;
}

function normalizeInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeFloat(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

export function normalizeOutsideBarDeltaFilterSettings(
  settings: Partial<OutsideBarDeltaFilterSettings> | null | undefined,
): OutsideBarDeltaFilterSettings {
  return {
    enabled: Boolean(settings?.enabled),
    lookbackBars: normalizeInt(
      settings?.lookbackBars,
      DEFAULT_OUTSIDE_BAR_DELTA_FILTER.lookbackBars,
      5,
      500,
    ),
    minSamples: normalizeInt(
      settings?.minSamples,
      DEFAULT_OUTSIDE_BAR_DELTA_FILTER.minSamples,
      3,
      200,
    ),
    deltaMultiplier: normalizeFloat(
      settings?.deltaMultiplier,
      DEFAULT_OUTSIDE_BAR_DELTA_FILTER.deltaMultiplier,
      0.1,
      10,
    ),
    requireRangeExpansion:
      settings?.requireRangeExpansion ??
      DEFAULT_OUTSIDE_BAR_DELTA_FILTER.requireRangeExpansion,
  };
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
    deltaFilter: normalizeOutsideBarDeltaFilterSettings(settings?.deltaFilter),
  };
}

export function isOutsideBar(bar: Bar, previous: Bar | undefined): boolean {
  return previous !== undefined && bar.high > previous.high && bar.low < previous.low;
}

function range(bar: Bar): number {
  return Math.max(0, bar.high - bar.low);
}

function percentile(values: number[], p: number): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * p) - 1),
  );
  return sorted[index];
}

function rollingSamples(
  context: OutsideBarFilterContext,
  index: number,
  lookbackBars: number,
): number[] {
  const bars = context.bars ?? [];
  const deltaByTime = context.deltaByTime;
  if (deltaByTime === undefined || bars.length === 0) {
    return [];
  }
  const from = Math.max(0, index - lookbackBars);
  const absDeltas: number[] = [];
  for (let i = from; i < index; i += 1) {
    const bar = bars[i];
    const point = deltaByTime.get(bar.time);
    if (point === undefined || !Number.isFinite(point.closeDelta)) {
      continue;
    }
    absDeltas.push(Math.abs(point.closeDelta));
  }
  return absDeltas;
}

function passesRangeExpansion(bars: readonly Bar[], index: number): boolean {
  if (index < 2) {
    return false;
  }
  const currentRange = range(bars[index]);
  return (
    currentRange > range(bars[index - 1]) &&
    currentRange > range(bars[index - 2])
  );
}

export function outsideBarSignal(
  bar: Bar,
  previous: Bar | undefined,
  settings: OutsideBarSettings = DEFAULT_OUTSIDE_BAR_SETTINGS,
  context: OutsideBarFilterContext = {},
): OutsideBarSignalSide | undefined {
  if (!settings.enabled || !isOutsideBar(bar, previous)) {
    return undefined;
  }
  const filter = settings.deltaFilter ?? DEFAULT_OUTSIDE_BAR_DELTA_FILTER;
  if (!filter.enabled) {
    if (bar.close > bar.open) return "buy";
    if (bar.close < bar.open) return "sell";
    return undefined;
  }
  if (previous === undefined) {
    return undefined;
  }

  const bars = context.bars ?? [];
  const index = context.index ?? bars.findIndex((item) => item.time === bar.time);
  if (index < 0 || bars[index]?.time !== bar.time) {
    return undefined;
  }
  if (filter.requireRangeExpansion && !passesRangeExpansion(bars, index)) {
    return undefined;
  }

  const delta = context.deltaByTime?.get(bar.time)?.closeDelta;
  if (delta === undefined || !Number.isFinite(delta) || delta === 0) {
    return undefined;
  }

  const absDeltaSamples = rollingSamples(context, index, filter.lookbackBars);
  const minSamples = Math.min(filter.minSamples, filter.lookbackBars);
  if (absDeltaSamples.length < minSamples) {
    return undefined;
  }
  const deltaBase = percentile(absDeltaSamples, 0.75);
  if (deltaBase === undefined) {
    return undefined;
  }
  if (Math.abs(delta) < deltaBase * filter.deltaMultiplier) {
    return undefined;
  }

  if (delta > 0 && bar.low < previous.low) {
    return "buy";
  }
  if (delta < 0 && bar.high > previous.high) {
    return "sell";
  }
  return undefined;
}

export function outsideBarColor(
  bar: Bar,
  previous: Bar | undefined,
  settings: OutsideBarSettings = DEFAULT_OUTSIDE_BAR_SETTINGS,
  context: OutsideBarFilterContext = {},
): string | undefined {
  const side = outsideBarSignal(bar, previous, settings, context);
  if (side === "buy") {
    return settings.bullColor;
  }
  if (side === "sell") {
    return settings.bearColor;
  }
  return undefined;
}
