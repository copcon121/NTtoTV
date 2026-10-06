import type { Bar } from "../cache/types";

export type SupertrendAtrMethod = "rma" | "sma";
export type SupertrendSource =
  | "open"
  | "high"
  | "low"
  | "close"
  | "hl2"
  | "hlc3"
  | "ohlc4";
export type SupertrendDirection = 1 | -1;

export interface SupertrendSettings {
  enabled: boolean;
  period: number;
  multiplier: number;
  atrMethod: SupertrendAtrMethod;
  source: SupertrendSource;
  showSignals: boolean;
  bullColor: string;
  bearColor: string;
}

export const DEFAULT_SUPERTREND_SETTINGS: SupertrendSettings = {
  enabled: false,
  period: 10,
  multiplier: 3,
  atrMethod: "rma",
  source: "hl2",
  showSignals: true,
  bullColor: "#26a69a",
  bearColor: "#ef5350",
};

const SUPERTREND_MIN_PERIOD = 1;
const SUPERTREND_MAX_PERIOD = 500;
const SUPERTREND_MIN_MULTIPLIER = 0.1;
const SUPERTREND_MAX_MULTIPLIER = 100;

function finiteClamped(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function indicatorColor(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

/** Normalize persisted/user-entered settings without mutating the input. */
export function normalizeSupertrendSettings(
  input?: Partial<SupertrendSettings> | null,
): SupertrendSettings {
  const period = Math.round(
    finiteClamped(
      input?.period,
      DEFAULT_SUPERTREND_SETTINGS.period,
      SUPERTREND_MIN_PERIOD,
      SUPERTREND_MAX_PERIOD,
    ),
  );
  return {
    enabled: input?.enabled === true,
    period,
    multiplier: finiteClamped(
      input?.multiplier,
      DEFAULT_SUPERTREND_SETTINGS.multiplier,
      SUPERTREND_MIN_MULTIPLIER,
      SUPERTREND_MAX_MULTIPLIER,
    ),
    atrMethod: input?.atrMethod === "sma" ? "sma" : "rma",
    source:
      input?.source === "open" ||
      input?.source === "high" ||
      input?.source === "low" ||
      input?.source === "close" ||
      input?.source === "hlc3" ||
      input?.source === "ohlc4"
        ? input.source
        : "hl2",
    showSignals: input?.showSignals !== false,
    bullColor: indicatorColor(
      input?.bullColor,
      DEFAULT_SUPERTREND_SETTINGS.bullColor,
    ),
    bearColor: indicatorColor(
      input?.bearColor,
      DEFAULT_SUPERTREND_SETTINGS.bearColor,
    ),
  };
}

export function supertrendSettingsKey(settings: Partial<SupertrendSettings>): string {
  const normalized = normalizeSupertrendSettings(settings);
  return [
    normalized.period,
    normalized.multiplier,
    normalized.atrMethod,
    normalized.source,
  ].join(":");
}

export function supertrendSourceValue(bar: Bar, source: SupertrendSource): number {
  switch (source) {
    case "open":
      return bar.open;
    case "high":
      return bar.high;
    case "low":
      return bar.low;
    case "close":
      return bar.close;
    case "hlc3":
      return (bar.high + bar.low + bar.close) / 3;
    case "ohlc4":
      return (bar.open + bar.high + bar.low + bar.close) / 4;
    case "hl2":
    default:
      return (bar.high + bar.low) / 2;
  }
}

/** Pine/TradingView true range, with high-low used for the first bar. */
export function supertrendTrueRange(bar: Bar, previousClose?: number): number {
  if (previousClose === undefined || !Number.isFinite(previousClose)) {
    return Math.max(0, bar.high - bar.low);
  }
  return Math.max(
    Math.max(0, bar.high - bar.low),
    Math.abs(bar.high - previousClose),
    Math.abs(bar.low - previousClose),
  );
}

export interface SupertrendAccumulator {
  previousBar?: Bar;
  atr?: number;
  /** Seed values before RMA is initialized, or the rolling SMA window. */
  trueRanges: readonly number[];
  up?: number;
  down?: number;
  trend: SupertrendDirection;
  barsProcessed: number;
}

export interface SupertrendPoint {
  time: number;
  index: number;
  atr?: number;
  up?: number;
  down?: number;
  trend: SupertrendDirection;
  buySignal: boolean;
  sellSignal: boolean;
}

export interface SupertrendStep {
  point: SupertrendPoint;
  accumulator: SupertrendAccumulator;
}

export function initialSupertrendAccumulator(): SupertrendAccumulator {
  return {
    trueRanges: [],
    trend: 1,
    barsProcessed: 0,
  };
}

function nextAtr(
  accumulator: SupertrendAccumulator,
  trueRange: number | undefined,
  settings: SupertrendSettings,
): { atr?: number; trueRanges: readonly number[] } {
  const period = settings.period;
  // Bare Pine `tr` is na on the first bar. `sma(tr, period)` therefore skips
  // that boundary value, whereas `atr(period)` below uses tr(true).
  if (trueRange === undefined) {
    return { atr: accumulator.atr, trueRanges: accumulator.trueRanges };
  }
  if (settings.atrMethod === "sma") {
    const trueRanges = [...accumulator.trueRanges, trueRange].slice(-period);
    return {
      atr:
        trueRanges.length === period
          ? trueRanges.reduce((sum, value) => sum + value, 0) / period
          : undefined,
      trueRanges,
    };
  }

  if (accumulator.atr !== undefined) {
    return {
      atr: (accumulator.atr * (period - 1) + trueRange) / period,
      trueRanges: [],
    };
  }

  const seed = [...accumulator.trueRanges, trueRange].slice(-period);
  return {
    atr:
      seed.length === period
        ? seed.reduce((sum, value) => sum + value, 0) / period
        : undefined,
    trueRanges: seed.length === period ? [] : seed,
  };
}

/**
 * Advance the Pine-v4 Supertrend recurrence by one bar.
 *
 * Passing the same accumulator with another version of the same candle is
 * deliberate: it produces a fresh provisional result and cannot compound ATR
 * or ratcheted bands within an open candle.
 */
export function advanceSupertrend(
  accumulator: SupertrendAccumulator,
  bar: Bar,
  input?: Partial<SupertrendSettings> | null,
): SupertrendStep {
  const settings = normalizeSupertrendSettings(input);
  const previousClose = accumulator.previousBar?.close;
  const trueRange =
    settings.atrMethod === "sma" && previousClose === undefined
      ? undefined
      : supertrendTrueRange(bar, previousClose);
  const atrState = nextAtr(accumulator, trueRange, settings);
  const previousTrend = accumulator.trend;
  let trend = previousTrend;
  let up: number | undefined;
  let down: number | undefined;

  if (atrState.atr !== undefined) {
    const source = supertrendSourceValue(bar, settings.source);
    const rawUp = source - settings.multiplier * atrState.atr;
    const rawDown = source + settings.multiplier * atrState.atr;
    // Pine: up1 = nz(up[1], up), dn1 = nz(dn[1], dn).
    const previousUp = accumulator.up ?? rawUp;
    const previousDown = accumulator.down ?? rawDown;
    up =
      accumulator.previousBar !== undefined &&
      accumulator.previousBar.close > previousUp
        ? Math.max(rawUp, previousUp)
        : rawUp;
    down =
      accumulator.previousBar !== undefined &&
      accumulator.previousBar.close < previousDown
        ? Math.min(rawDown, previousDown)
        : rawDown;

    if (previousTrend === -1 && bar.close > previousDown) {
      trend = 1;
    } else if (previousTrend === 1 && bar.close < previousUp) {
      trend = -1;
    }
  }

  const point: SupertrendPoint = {
    time: bar.time,
    index: accumulator.barsProcessed,
    atr: atrState.atr,
    up,
    down,
    trend,
    buySignal: trend === 1 && previousTrend === -1,
    sellSignal: trend === -1 && previousTrend === 1,
  };
  return {
    point,
    accumulator: {
      previousBar: { ...bar },
      atr: atrState.atr,
      trueRanges: atrState.trueRanges,
      up,
      down,
      trend,
      barsProcessed: accumulator.barsProcessed + 1,
    },
  };
}

export interface SupertrendLinePoint {
  time: number;
  value?: number;
}

export interface SupertrendMarker {
  time: number;
  direction: SupertrendDirection;
  value: number;
  text: "Buy" | "Sell";
}

export interface SupertrendOverlay {
  bullish: readonly SupertrendLinePoint[];
  bearish: readonly SupertrendLinePoint[];
  markers: readonly SupertrendMarker[];
}

export interface SupertrendRuntimeState {
  settingsKey: string;
  /** Accumulator immediately before currentTime, reused for same-bar updates. */
  base: SupertrendAccumulator;
  currentTime?: number;
  currentPoint?: SupertrendPoint;
  currentAccumulator?: SupertrendAccumulator;
  currentConfirmed: boolean;
}

export interface SupertrendSeriesResult {
  overlay: SupertrendOverlay;
  points: readonly SupertrendPoint[];
  runtime: SupertrendRuntimeState;
}

export interface SupertrendSeriesOptions {
  /** Replay prefixes are entirely historical even when old REST bars lack `closed`. */
  assumeLastBarClosed?: boolean;
  /** Realtime confirmation knowledge maintained outside the immutable Bar array. */
  confirmedByTime?: ReadonlyMap<number, boolean>;
  markerLimit?: number;
  /** Signals are suppressed while the ATR seed converges; math remains unchanged. */
  signalWarmupBars?: number;
}

export const MAX_SUPERTREND_MARKERS = 500;

export function supertrendSignalWarmupBars(
  _settings: Partial<SupertrendSettings>,
): number {
  // Do not add a client-only convergence delay: Pine emits a flip as soon as
  // ATR/bands exist, and production server state is independently warmed.
  return 0;
}

function barIsConfirmed(
  bar: Bar,
  index: number,
  length: number,
  options: SupertrendSeriesOptions,
): boolean {
  const tracked = options.confirmedByTime?.get(bar.time);
  if (tracked !== undefined) return tracked;
  if (bar.closed !== undefined) return bar.closed;
  if (index < length - 1) return true;
  return options.assumeLastBarClosed === true;
}

export function supertrendMarkerForPoint(
  point: SupertrendPoint,
  confirmed: boolean,
  input?: Partial<SupertrendSettings> | null,
  signalWarmupBars?: number,
): SupertrendMarker | undefined {
  const settings = normalizeSupertrendSettings(input);
  const warmup = signalWarmupBars ?? supertrendSignalWarmupBars(settings);
  if (
    !settings.showSignals ||
    !confirmed ||
    point.index + 1 < warmup ||
    (!point.buySignal && !point.sellSignal)
  ) {
    return undefined;
  }
  const direction: SupertrendDirection = point.buySignal ? 1 : -1;
  const value = direction === 1 ? point.up : point.down;
  if (value === undefined) return undefined;
  return {
    time: point.time,
    direction,
    value,
    text: direction === 1 ? "Buy" : "Sell",
  };
}

/** Bulk calculation used for history, settings changes, revisions and replay seeks. */
export function calculateSupertrend(
  bars: readonly Bar[],
  input?: Partial<SupertrendSettings> | null,
  options: SupertrendSeriesOptions = {},
): SupertrendSeriesResult {
  const settings = normalizeSupertrendSettings(input);
  const bullish: SupertrendLinePoint[] = [];
  const bearish: SupertrendLinePoint[] = [];
  const markers: SupertrendMarker[] = [];
  const points: SupertrendPoint[] = [];
  let accumulator = initialSupertrendAccumulator();
  let base = accumulator;

  bars.forEach((bar, index) => {
    base = accumulator;
    const step = advanceSupertrend(accumulator, bar, settings);
    accumulator = step.accumulator;
    points.push(step.point);
    bullish.push({
      time: bar.time,
      ...(step.point.trend === 1 && step.point.up !== undefined
        ? { value: step.point.up }
        : {}),
    });
    bearish.push({
      time: bar.time,
      ...(step.point.trend === -1 && step.point.down !== undefined
        ? { value: step.point.down }
        : {}),
    });
    const marker = supertrendMarkerForPoint(
      step.point,
      barIsConfirmed(bar, index, bars.length, options),
      settings,
      options.signalWarmupBars,
    );
    if (marker !== undefined) markers.push(marker);
  });

  const markerLimit = Math.max(
    1,
    Math.round(options.markerLimit ?? MAX_SUPERTREND_MARKERS),
  );
  const lastIndex = bars.length - 1;
  const currentPoint = points[lastIndex];
  return {
    overlay: {
      bullish,
      bearish,
      markers: markers.slice(-markerLimit),
    },
    points,
    runtime: {
      settingsKey: supertrendSettingsKey(settings),
      base: bars.length === 0 ? initialSupertrendAccumulator() : base,
      currentTime: bars[lastIndex]?.time,
      currentPoint,
      currentAccumulator: bars.length === 0 ? undefined : accumulator,
      currentConfirmed:
        lastIndex >= 0
          ? barIsConfirmed(bars[lastIndex], lastIndex, bars.length, options)
          : false,
    },
  };
}

export interface SupertrendStreamUpdate {
  state: SupertrendRuntimeState;
  point: SupertrendPoint;
  confirmed: boolean;
  /** A new timestamp proves the prior provisional candle is finalized. */
  committedPoint?: SupertrendPoint;
}

/**
 * Update the latest candle in O(1). Returns undefined for a historical
 * insertion/revision so the caller can fall back to an authoritative bulk
 * calculation from its merged bar series.
 */
export function updateSupertrendRuntime(
  state: SupertrendRuntimeState,
  bar: Bar,
  closed: boolean,
  input?: Partial<SupertrendSettings> | null,
): SupertrendStreamUpdate | undefined {
  const settings = normalizeSupertrendSettings(input);
  if (state.settingsKey !== supertrendSettingsKey(settings)) return undefined;
  if (state.currentTime !== undefined && bar.time < state.currentTime) {
    return undefined;
  }

  const sameBar = state.currentTime === bar.time;
  const base = sameBar
    ? state.base
    : state.currentAccumulator ?? state.base;
  const step = advanceSupertrend(base, bar, settings);
  return {
    state: {
      settingsKey: state.settingsKey,
      base,
      currentTime: bar.time,
      currentPoint: step.point,
      currentAccumulator: step.accumulator,
      currentConfirmed: closed,
    },
    point: step.point,
    confirmed: closed,
    ...(!sameBar && state.currentPoint !== undefined && !state.currentConfirmed
      ? { committedPoint: state.currentPoint }
      : {}),
  };
}
