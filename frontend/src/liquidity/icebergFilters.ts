import type { NativeIcebergState } from "../socket/messages";
import { icebergMinVolumeForTime, type IcebergSessionMinVolumes } from "./icebergSessions";

export interface IcebergFilterSettings {
  automatic: boolean;
  lookbackMinutes: number;
  standardDeviations: number;
  applyToActive: boolean;
  aggregateMinVolume: number;
  aggregate: boolean;
  timeArea: number;
  priceArea: number;
  showFiltered: boolean;
  filteredOpacity: number;
  showActive: boolean;
  showExecuted: boolean;
  showCanceled: boolean;
  showInvalidated: boolean;
}

export const DEFAULT_ICEBERG_FILTERS: IcebergFilterSettings = {
  automatic: true, lookbackMinutes: 60, standardDeviations: 1,
  applyToActive: true, aggregateMinVolume: 0, aggregate: true,
  // SI area multipliers: 10 = one icon width/height.
  timeArea: 10, priceArea: 200,
  showFiltered: false, filteredOpacity: 0.15,
  showActive: true, showExecuted: true, showCanceled: true, showInvalidated: true,
};

export function normalizeIcebergFilters(input: unknown): IcebergFilterSettings {
  const source = input && typeof input === "object" ? input as Partial<IcebergFilterSettings> : {};
  const number = (key: keyof IcebergFilterSettings, min: number, max: number, integer = false) => {
    const value = source[key];
    const parsed = typeof value === "number" && Number.isFinite(value) ? value : DEFAULT_ICEBERG_FILTERS[key] as number;
    return Math.min(max, Math.max(min, integer ? Math.round(parsed) : parsed));
  };
  const flag = (key: keyof IcebergFilterSettings) =>
    typeof source[key] === "boolean" ? source[key] as boolean : DEFAULT_ICEBERG_FILTERS[key] as boolean;
  return {
    automatic: flag("automatic"), lookbackMinutes: number("lookbackMinutes", 1, 2880, true),
    standardDeviations: number("standardDeviations", 0, 10),
    applyToActive: flag("applyToActive"), aggregateMinVolume: number("aggregateMinVolume", 0, 1_000_000, true),
    aggregate: flag("aggregate"), timeArea: number("timeArea", 0, 1000), priceArea: number("priceArea", 0, 1000),
    showFiltered: flag("showFiltered"), filteredOpacity: number("filteredOpacity", 0, 1),
    showActive: flag("showActive"), showExecuted: flag("showExecuted"),
    showCanceled: flag("showCanceled"), showInvalidated: flag("showInvalidated"),
  };
}

export interface IcebergAutoThreshold {
  threshold: number;
  sampleCount: number;
  mean: number;
  standardDeviation: number;
  calculatedAt: number;
}

/** SI's completed-order sample, population SD, integer truncation and maximum cap. */
export function calculateIcebergAutoThreshold(
  rows: readonly NativeIcebergState[], settings: IcebergFilterSettings, now: number,
): IcebergAutoThreshold {
  const cutoff = now - settings.lookbackMinutes * 60_000;
  const values = rows.filter((row) => row.detectedTime >= cutoff && row.detectedTime <= now &&
    (row.endTime ?? row.time) <= now &&
    ((row.status === "executed" && settings.showExecuted) || (row.status === "canceled" && settings.showCanceled)))
    .map((row) => row.executedVolume).filter((volume) => Number.isFinite(volume) && volume >= 0);
  const sampleCount = values.length;
  const mean = sampleCount ? values.reduce((sum, value) => sum + value, 0) / sampleCount : 0;
  const standardDeviation = sampleCount
    ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / sampleCount) : 0;
  const maximum = values.reduce((max, value) => Math.max(max, value), 0);
  return { threshold: Math.min(maximum, Math.trunc(mean + settings.standardDeviations * standardDeviation)),
    sampleCount, mean, standardDeviation, calculatedAt: now };
}

export interface IcebergFilterContext {
  settings: IcebergFilterSettings;
  autoThreshold: number;
  sessionMinVolumes: IcebergSessionMinVolumes;
}

export function icebergIndividualThreshold(row: NativeIcebergState, filter: IcebergFilterContext): number {
  return filter.settings.automatic ? filter.autoThreshold : icebergMinVolumeForTime(row.detectedTime, filter.sessionMinVolumes);
}

export function icebergStatusVisible(row: NativeIcebergState, settings: IcebergFilterSettings): boolean {
  return row.status === "active" ? settings.showActive : row.status === "executed" ? settings.showExecuted
    : row.status === "canceled" ? settings.showCanceled : settings.showInvalidated;
}

export function icebergPassesIndividualFilter(row: NativeIcebergState, filter: IcebergFilterContext): boolean {
  return (row.status === "active" && !filter.settings.applyToActive) ||
    row.executedVolume >= icebergIndividualThreshold(row, filter);
}
