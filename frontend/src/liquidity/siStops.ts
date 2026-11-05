import type { SiStopChain } from "../socket/messages";

export const MAX_SI_STOPS = 5_000;
export const SI_STOP_RETENTION_MS = 48 * 60 * 60 * 1_000;

export interface SiStopSettings {
  version: 2;
  enabled: boolean;
  minVolume: number;
  automatic: boolean;
  intervalMinutes: number;
  standardDeviations: number;
  throughPriceLevelsOnly: boolean;
  aggregate: boolean;
  aggregateMinVolume: number;
  timeArea: number;
  priceArea: number;
  showFiltered: boolean;
  filteredOpacity: number;
  buyColor: string;
  sellColor: string;
  alertSound: boolean;
  alertMinVolume: number;
  alertThroughPriceLevelsOnly: boolean;
  showToast: boolean;
}

export const DEFAULT_SI_STOP_SETTINGS: SiStopSettings = {
  version: 2, enabled: true, minVolume: 50, automatic: false,
  intervalMinutes: 60, standardDeviations: 1, throughPriceLevelsOnly: false,
  aggregate: true, aggregateMinVolume: 0, timeArea: 10, priceArea: 200,
  showFiltered: false, filteredOpacity: 0.15, buyColor: "#35d6b0", sellColor: "#ff8a65",
  alertSound: false, alertMinVolume: 10, alertThroughPriceLevelsOnly: false, showToast: false,
};

export function normalizeSiStopSettings(input: unknown): SiStopSettings {
  const raw = input !== null && typeof input === "object" ? input as Partial<SiStopSettings> : {};
  const value = { ...DEFAULT_SI_STOP_SETTINGS };
  for (const key of ["enabled", "automatic", "throughPriceLevelsOnly", "aggregate", "showFiltered",
    "alertSound", "alertThroughPriceLevelsOnly", "showToast"] as const) {
    if (typeof raw[key] === "boolean") value[key] = raw[key];
  }
  for (const [key, min, max] of [
    ["minVolume", 0, 10_000_000], ["aggregateMinVolume", 0, 10_000_000],
    ["alertMinVolume", 0, 10_000_000], ["intervalMinutes", 1, 2_880],
    ["standardDeviations", 0, 10], ["timeArea", 0, 1_000], ["priceArea", 0, 1_000],
    ["filteredOpacity", 0, 1],
  ] as const) {
    const n = raw[key];
    if (typeof n === "number" && Number.isFinite(n)) value[key] = Math.max(min, Math.min(max, n));
  }
  for (const key of ["buyColor", "sellColor"] as const) {
    if (typeof raw[key] === "string" && /^#[0-9a-f]{6}$/i.test(raw[key])) value[key] = raw[key];
  }
  // Upgrade the initial zero-minimum preset once, including saved Auto setups.
  // Keep custom positive thresholds and all grouping/alert/color preferences.
  if (raw.version !== 2 && (raw.minVolume === undefined || raw.minVolume === 0)) {
    value.minVolume = 50;
    value.automatic = false;
  }
  return value;
}

export function isSiStopChain(input: unknown): input is SiStopChain {
  if (input === null || typeof input !== "object") return false;
  const row = input as Partial<SiStopChain>;
  return row.type === "si_stop" && row.source === "rithmic" && row.method === "aggressor_chain" &&
    row.status === "completed" && typeof row.chainId === "string" && row.chainId.length > 0 &&
    typeof row.sessionId === "string" && row.sessionId.length > 0 &&
    typeof row.sourceContract === "string" && (row.side === "buy" || row.side === "sell") &&
    (row.endReason === "mbo" || row.endReason === "depth") &&
    [row.time, row.startTime, row.completedTime, row.sequence, row.price, row.firstPrice,
      row.vwap, row.executedVolume, row.executionCount, row.aggressorCount]
      .every((n) => typeof n === "number" && Number.isFinite(n)) &&
    row.time! >= row.startTime! && row.completedTime! >= row.time! && row.sequence! >= 1 &&
    row.price! > 0 && row.firstPrice! > 0 && row.vwap! > 0 && row.executedVolume! >= row.executionCount! &&
    row.executionCount! >= row.aggressorCount! && row.aggressorCount! >= 1 &&
    typeof row.throughPriceLevels === "boolean";
}

export function siStopKey(row: SiStopChain): string {
  return `${row.sourceContract}\u0000${row.sessionId}\u0000${row.chainId}`;
}

/** Completed chains are immutable. A late bootstrap cannot overwrite a live chain. */
export function mergeSiStops(first: readonly SiStopChain[], second: readonly SiStopChain[], cutoff: number): SiStopChain[] {
  const rows = new Map<string, SiStopChain>();
  for (const row of [...first, ...second]) {
    if (isSiStopChain(row) && row.time >= cutoff && !rows.has(siStopKey(row))) rows.set(siStopKey(row), row);
  }
  return [...rows.values()].sort((a, b) => a.time - b.time || a.sequence - b.sequence).slice(-MAX_SI_STOPS);
}

export function siStopAutoThreshold(rows: readonly SiStopChain[], settings: SiStopSettings, now: number) {
  const sample = rows.filter((row) => row.completedTime <= now &&
    row.time >= now - settings.intervalMinutes * 60_000).map((row) => row.executedVolume);
  if (!sample.length) return { threshold: 0, sampleCount: 0 };
  const mean = sample.reduce((sum, n) => sum + n, 0) / sample.length;
  const variance = sample.reduce((sum, n) => sum + (n - mean) ** 2, 0) / sample.length;
  return { threshold: Math.min(Math.max(...sample), Math.trunc(mean + settings.standardDeviations * Math.sqrt(variance))),
    sampleCount: sample.length };
}

export function siStopPasses(row: SiStopChain, settings: SiStopSettings, threshold: number): boolean {
  return row.executedVolume >= threshold && (!settings.throughPriceLevelsOnly || row.throughPriceLevels);
}

export class SiStopAlertTracker {
  private seen = new Set<string>();
  constructor(private armedAt: number) {}
  seed(rows: readonly SiStopChain[]): void { for (const row of rows) this.remember(row); }
  private remember(row: SiStopChain): boolean {
    const key = siStopKey(row);
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    if (this.seen.size > MAX_SI_STOPS * 2) this.seen.delete(this.seen.values().next().value!);
    return true;
  }
  accept(row: SiStopChain, settings: SiStopSettings, now: number): boolean {
    const unseen = this.remember(row);
    return unseen && settings.enabled && row.completedTime >= this.armedAt &&
      row.completedTime >= now - 10_000 && row.completedTime <= now + 5_000 &&
      row.executedVolume >= settings.alertMinVolume &&
      (!settings.alertThroughPriceLevelsOnly || row.throughPriceLevels);
  }
}
