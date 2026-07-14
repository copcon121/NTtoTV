// chart module â€” Lightweight Charts adapter (the real ChartSeriesPort).
//
// This is the ONLY file that talks to the `lightweight-charts` library. It
// hosts a chart instance with a candlestick series, TradingView-style volume
// histogram, and a MyVolumeDelta-style volume-delta overlay candle series
// and implements {@link ChartSeriesPort} so the pure reducer / controller can
// drive it (design.md "Frontend Modules": ChartContainer, Req 19.1, 19.2).
//
// `port.setBars()` maps to `series.setData()` (bulk initial load) and
// `port.updateBar()` maps to `series.update()` (incremental update) â€” exactly
// the two Lightweight Charts APIs called out in the design research notes.
//
// Time conversion: backend bars carry a Canonical_Timestamp in **milliseconds**
// since the Unix epoch and key bars by bucket start. NinjaTrader time-based
// charts display bars at their closing time, so the adapter can apply a display
// offset before converting ms -> Lightweight Charts' second-based timestamp.

import {
  type AutoscaleInfoProvider,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type LineData,
  type LogicalRange,
  type MouseEventParams,
  type SeriesMarker,
  type Time,
  TickMarkType,
  type UTCTimestamp,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  PriceLineSource,
  createSeriesMarkers,
  createChart,
  HistogramSeries,
} from "lightweight-charts";

import { type BigTradeMarker, bubbleRadius } from "./indicatorReducer";
import { type BarSeries, applyBarUpdate } from "./barReducer";
import { type ChartSeriesPort } from "./chartSeriesController";
import { type EmaPoint } from "./ema";
import {
  DEFAULT_OUTSIDE_BAR_SETTINGS,
  type OutsideBarFilterContext,
  type OutsideBarSettings,
  normalizeOutsideBarSettings,
  outsideBarColor,
} from "./outsideBar";
import { type SmcMarker, type SmcOverlay } from "./smc";
import {
  type RenderableSmcLine,
  type RenderableSmcZone,
  SmcOverlayPrimitive,
} from "./SmcOverlayPrimitive";
import {
  BigTradeBubblePrimitive,
  type RenderableBigTradeBubble,
} from "./BigTradeBubblePrimitive";
import {
  DivergenceLinePrimitive,
  type RenderableDivergenceLine,
} from "./DivergenceLinePrimitive";
import {
  WaveDeltaMboxPrimitive,
  type RenderableWaveDeltaMbox,
} from "./WaveDeltaMboxPrimitive";
import { SessionVolumeProfilePrimitive } from "./SessionVolumeProfilePrimitive";
import { type Bar } from "../cache/types";
import type { FvgSignalUpdateMessage } from "../socket/messages";
import { type FootprintViewport } from "../footprint/footprintModel";
import {
  countdownBarStartMs,
  formatBarCountdown,
  remainingObservedBarTimeMs,
  remainingBarTimeMs,
  shouldUseObservedBarCountdown,
} from "./barCountdown";
import {
  DEFAULT_TIMEZONE_OFFSET_MINUTES,
  formatCrosshairTimeForOffset,
  formatTickMarkForOffset,
  normalizeTimezoneOffsetMinutes,
  type TimeAxisTickKind,
} from "./timezone";
import {
  buildMgannSwingOverlay,
  DEFAULT_MGANN_SWING_SETTINGS,
  normalizeMgannSwingSettings,
  type MgannSwingImpulseWave,
  type MgannSwingSettings,
  type MgannSwingWaveDeltaBox,
} from "./mgannSwing";

/** One volume-delta point, keyed by backend Canonical_Timestamp ms. */
export interface VolumeDeltaDatum {
  time: number;
  delta: number;
  deltaHigh: number;
  deltaLow: number;
  openDelta: number;
  closeDelta: number;
  cumulativeDelta?: number;
}

const FVG_BULL_COLORS: Record<number, string> = {
  1: "lightgreen",
  2: "lime",
  3: "forestgreen",
  5: "cyan",
};

const FVG_BEAR_COLORS: Record<number, string> = {
  1: "lightcoral",
  2: "crimson",
  3: "#ff4500",
  5: "magenta",
};

const MGANN_SWING_LINE_COLOR = "#9e9e9e";
const MGANN_SWING_BUY_COLOR = "#00c0c0";
const MGANN_SWING_SELL_COLOR = "#c00000";
const MGANN_SWING_DELTA_UP_COLOR = "#004080";
const MGANN_SWING_DELTA_DOWN_COLOR = "#800000";
const MGANN_SWING_DELTA_ZERO_COLOR = "#6d6d6d";
const MGANN_IMPULSE_BULL_COLOR = "#00a6a6";
const MGANN_IMPULSE_BEAR_COLOR = "#ff8c00";

/**
 * One horizontal alert level drawn on the candle price scale (Req 16.5).
 *
 * Only the level-based alert types (`price_crosses_level`, `bar_closes_above`,
 * `bar_closes_below`) carry a price, so the live layer maps those to an
 * {@link AlertLine}. `enabled` dims the line so disabled alerts stay visible
 * but de-emphasised.
 */
export interface AlertLine {
  /** Alert id; used as the stable key for incremental add/update/remove. */
  id: string;
  /** Price level on the candle scale. */
  price: number;
  /** Short label rendered on the price axis (e.g. the alert type). */
  title?: string;
  /** Disabled alerts render dimmed + dashed. */
  enabled?: boolean;
}

export interface AlertSignalMarker {
  id: string;
  time: number;
  price: number;
  direction: 1 | -1;
  text?: string;
}

export type OrderLineField = "entryGc" | "slGc" | "tpGc";

/**
 * One live order level drawn on the candle price scale. These are separate
 * from persisted drawings: the backend order store is the source of truth.
 */
export interface OrderLine {
  id: string;
  orderId: string;
  field: OrderLineField;
  price: number;
  side: "buy" | "sell";
  status: string;
  title?: string;
  editable?: boolean;
}

export interface VisibleLogicalRangeInfo {
  from: number;
  to: number;
  barsBefore: number;
  barsAfter: number;
}

export interface SmcAiSignalMarker {
  id: string;
  time: number;
  price: number;
  side: "long" | "short";
  zoneType: "ob" | "fvg" | string;
  huntType: string;
  confirmation: string;
  outcome?: "win" | "loss" | "incomplete" | string;
  netR?: number | null;
  text?: string;
}

/** Colors for positive/negative delta candles; kept here so the port stays self-contained. */
export interface DeltaColors {
  positive: string;
  negative: string;
  zero: string;
  wick: string;
  zeroLine: string;
}

export const VOLUME_DELTA_OVERLAY_PRICE_SCALE_ID = "volume-delta-overlay";
export const VOLUME_DELTA_OVERLAY_SCALE_MARGINS = {
  top: 0.8,
  bottom: 0.02,
} as const;
export const WAVE_DELTA_OVERLAY_PRICE_SCALE_ID = "wave-delta-overlay";
export const WAVE_DELTA_OVERLAY_SCALE_MARGINS = {
  top: 0.72,
  bottom: 0.04,
} as const;
// Backwards-compatible export names for callers/tests that still use the old
// CVD prop surface. The rendered overlay is now current wave delta, not CVD.
export const CVD_OVERLAY_PRICE_SCALE_ID = WAVE_DELTA_OVERLAY_PRICE_SCALE_ID;
export const CVD_OVERLAY_SCALE_MARGINS = WAVE_DELTA_OVERLAY_SCALE_MARGINS;
export const VOLUME_OVERLAY_PRICE_SCALE_ID = "volume-overlay";
export const VOLUME_OVERLAY_SCALE_MARGINS = {
  top: 0.76,
  bottom: 0,
} as const;

const DEFAULT_DELTA_COLORS: DeltaColors = {
  positive: "#008000",
  negative: "#ff0000",
  zero: "rgba(139, 148, 158, 0.45)",
  wick: "rgba(139, 148, 158, 0.70)",
  zeroLine: "rgba(128, 128, 128, 0.40)",
};

const MZ_FOOTPRINT_COLORS = {
  chartBg: "#101010",
  candleUp: "#008000",
  candleDown: "#8b0000",
  bid: "#fa8072",
  ask: "#008b8b",
};
const VOLUME_UP_COLOR = "rgba(38, 166, 154, 0.50)";
const VOLUME_DOWN_COLOR = "rgba(239, 83, 80, 0.50)";
const WAVE_DELTA_TRANSPARENT_LINE_COLOR = "rgba(0, 0, 0, 0)";
const WAVE_DELTA_MBOX_UP_FILL = "rgba(90, 130, 220, 0.45)";
const WAVE_DELTA_MBOX_UP_BORDER = "rgba(90, 130, 220, 1)";
const WAVE_DELTA_MBOX_DOWN_FILL = "rgba(230, 140, 140, 0.45)";
const WAVE_DELTA_MBOX_DOWN_BORDER = "rgba(230, 140, 140, 1)";
const WAVE_DELTA_MBOX_DIV_UP_FILL = "rgba(150, 80, 220, 0.45)";
const WAVE_DELTA_MBOX_DIV_UP_BORDER = "rgba(150, 80, 220, 1)";
const WAVE_DELTA_MBOX_DIV_DOWN_FILL = "rgba(120, 70, 190, 0.45)";
const WAVE_DELTA_MBOX_DIV_DOWN_BORDER = "rgba(120, 70, 190, 1)";
const WAVE_DELTA_MBOX_KEEP = 500;
const DEFAULT_WAVE_DELTA_SWING_SIZE = 2;
const DIVERGENCE_PIVOT_LEFT = 2;
const DIVERGENCE_PIVOT_RIGHT = 2;
const DIVERGENCE_MIN_PIVOT_SPACING = 3;
const DIVERGENCE_MAX_SPAN = 80;
const DIVERGENCE_MATCH_WAVE_WINDOW = 3;
const DIVERGENCE_MIN_PRICE_SLOPE_ATR = 0.45;
const DIVERGENCE_MIN_WAVE_SLOPE_RANGE = 0.35;
const DIVERGENCE_MAX_VISIBLE = 20;
const DIVERGENCE_LOOKBACK_BARS = 260;
const SESSION_HIGHLIGHT_UTC_PLUS_7_MINUTES = 7 * 60;
const SESSION_HIGHLIGHT_HOURS_UTC_PLUS_7 = new Set([8, 20]);
const SESSION_HIGHLIGHT_MINUTE_UTC_PLUS_7 = 1;
const SESSION_HIGHLIGHT_BODY_COLOR = "rgba(255, 213, 79, 0.78)";
const SESSION_HIGHLIGHT_LINE_COLOR = "#ffd54f";

const DARK_CHART_TEXT = "#d8d8d8";
const LIGHT_CHART_TEXT = "#111111";
const BIG_TRADE_BUY_FILL = "rgba(30, 144, 255, 0.18)";
const BIG_TRADE_BUY_STROKE = "rgba(12, 95, 190, 0.30)";
const BIG_TRADE_SELL_FILL = "rgba(220, 20, 60, 0.18)";
const BIG_TRADE_SELL_STROKE = "rgba(170, 12, 42, 0.30)";
const SMC_AI_LONG_COLOR = "#00c853";
const SMC_AI_SHORT_COLOR = "#ff7043";

interface ChartContrastPalette {
  text: string;
  grid: string;
  verticalGrid: string;
  crosshair: string;
  priceLine: string;
}

function parseHexColor(color: string): { r: number; g: number; b: number } | null {
  const raw = color.trim();
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw);
  if (match === null) return null;
  const hex = match[1].length === 3
    ? match[1].split("").map((ch) => ch + ch).join("")
    : match[1];
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function rgba({ r, g, b }: { r: number; g: number; b: number }, alpha: number): string {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function chartContrastPalette(backgroundColor: string): ChartContrastPalette {
  const bg = parseHexColor(backgroundColor) ?? parseHexColor(MZ_FOOTPRINT_COLORS.chartBg)!;
  const isLight = relativeLuminance(bg) > 0.5;
  const ink = isLight ? { r: 17, g: 17, b: 17 } : { r: 216, g: 216, b: 216 };
  return {
    text: isLight ? LIGHT_CHART_TEXT : DARK_CHART_TEXT,
    grid: rgba(ink, isLight ? 0.12 : 0.10),
    verticalGrid: rgba(ink, isLight ? 0.045 : 0.05),
    crosshair: rgba(ink, isLight ? 0.42 : 0.35),
    priceLine: rgba(ink, isLight ? 0.62 : 0.55),
  };
}

/** Colors for alert level lines (Req 16.5): bright when enabled, dim when off. */
const ALERT_LINE_COLORS = {
  enabled: "#e0b341",
  disabled: "rgba(224, 179, 65, 0.35)",
};

const ORDER_LINE_COLORS: Record<OrderLineField | "entrySell", string> = {
  entryGc: "#2563eb",
  entrySell: "#dc2626",
  slGc: "#d97706",
  tpGc: "#0f766e",
};

/** EMA overlay line color (TradingView-style blue). */
const EMA_LINE_COLOR = "#2962ff";

type EmaLineWidth = 1 | 2 | 3 | 4;

export interface EmaLineData {
  id: string;
  points: readonly EmaPoint[];
  color?: string;
  lineWidth?: EmaLineWidth;
}

interface DraggableLineMeta {
  price: number;
  editable?: boolean;
  color: string;
}

type PriceLineDragKind = "alert" | "order";
export type PriceLineSelection =
  | { kind: "alert"; id: string }
  | { kind: "order"; orderId: string };

interface PriceLineDragConfig {
  metaById: Map<string, DraggableLineMeta>;
  linesById: Map<string, IPriceLine>;
  handlers: {
    onPreview?: (id: string, price: number) => void;
    onCommit?: (id: string, price: number) => void;
    onCommitBatch?: (updates: readonly { id: string; price: number }[]) => void;
    snap?: (price: number) => number;
  };
}

const symmetricZeroAutoscale: AutoscaleInfoProvider = (baseImplementation) => {
  const info = baseImplementation();
  if (info === null) {
    return null;
  }
  if (info.priceRange === null) {
    return info;
  }
  const maxAbs = Math.max(
    1,
    Math.abs(info.priceRange.minValue),
    Math.abs(info.priceRange.maxValue),
  );
  return {
    ...info,
    priceRange: {
      minValue: -maxAbs,
      maxValue: maxAbs,
    },
  };
};

export interface LightweightChartsAdapterOptions {
  /** Positive/negative colors for the delta candles. */
  deltaColors?: DeltaColors;
  /** @deprecated Volume Delta now always renders as a fixed chart overlay. */
  deltaTopMargin?: number;
  /** @deprecated Volume Delta now always renders as a fixed chart overlay. */
  deltaPaneHeightRatio?: number;
  /** Display-only offset from backend bucket-start time to candle chart time. */
  displayTimeOffsetMs?: number;
  /** Duration of the active timeframe; drives the right-axis bar countdown. */
  barCountdownDurationMs?: number;
  /** Main chart background color. */
  chartBackgroundColor?: string;
  /** Display timezone offset for the time axis, in minutes from UTC. */
  timezoneOffsetMinutes?: number;
  /** Optional candle recoloring for bullish/bearish outside bars. */
  outsideBar?: Partial<OutsideBarSettings>;
}

/** Convert a Canonical_Timestamp (ms) to a Lightweight Charts UTCTimestamp (s). */
export function toUtcTimestamp(
  timeMs: number,
  displayTimeOffsetMs = 0,
): UTCTimestamp {
  return Math.floor((timeMs + displayTimeOffsetMs) / 1000) as UTCTimestamp;
}

export function toBarDisplayTimestamp(
  timeMs: number,
  barDurationMs: number,
  displayTimeOffsetMs = 0,
): UTCTimestamp {
  const bucketStart =
    barDurationMs > 0 ? Math.floor(timeMs / barDurationMs) * barDurationMs : timeMs;
  return toUtcTimestamp(bucketStart, displayTimeOffsetMs);
}

export function isUtcPlus7SessionHighlightTime(
  timeMs: number,
  displayTimeOffsetMs = 0,
): boolean {
  return utcPlus7SessionHighlightHour(timeMs, displayTimeOffsetMs) !== undefined;
}

export function isMgannImpulseTimeframeDuration(durationMs: number): boolean {
  return durationMs === 60_000 || durationMs === 300_000;
}

function utcPlus7SessionHighlightHour(
  timeMs: number,
  displayTimeOffsetMs = 0,
): 8 | 20 | undefined {
  if (!Number.isFinite(timeMs) || !Number.isFinite(displayTimeOffsetMs)) {
    return undefined;
  }
  const local = new Date(
    timeMs +
      displayTimeOffsetMs +
      SESSION_HIGHLIGHT_UTC_PLUS_7_MINUTES * 60_000,
  );
  const hour = local.getUTCHours();
  const matches =
    local.getUTCMinutes() === SESSION_HIGHLIGHT_MINUTE_UTC_PLUS_7 &&
    local.getUTCSeconds() === 0 &&
    local.getUTCMilliseconds() === 0 &&
    SESSION_HIGHLIGHT_HOURS_UTC_PLUS_7.has(hour);
  return matches ? (hour as 8 | 20) : undefined;
}

export function toCandle(
  bar: Bar,
  displayTimeOffsetMs: number,
  previousBar?: Bar,
  outsideBar: OutsideBarSettings = DEFAULT_OUTSIDE_BAR_SETTINGS,
  outsideBarContext: OutsideBarFilterContext = {},
  fvgSignal?: FvgSignalUpdateMessage,
  impulseColor?: string,
): CandlestickData {
  const highlight = isUtcPlus7SessionHighlightTime(
    bar.time,
    displayTimeOffsetMs,
  );
  const obColor = outsideBarColor(
    bar,
    previousBar,
    outsideBar,
    outsideBarContext,
  );
  const candle: CandlestickData & { volume: number } = {
    time: toUtcTimestamp(bar.time, displayTimeOffsetMs),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
  };
  const fvgColor = fvgSignalColor(fvgSignal);
  if (fvgColor !== undefined) {
    return {
      ...candle,
      color: fvgColor,
      borderColor: fvgColor,
      wickColor: fvgColor,
    };
  }
  if (impulseColor !== undefined) {
    return {
      ...candle,
      color: impulseColor,
      borderColor: impulseColor,
      wickColor: impulseColor,
    };
  }
  if (highlight) {
    return {
      ...candle,
      color: SESSION_HIGHLIGHT_BODY_COLOR,
      borderColor: SESSION_HIGHLIGHT_LINE_COLOR,
      wickColor: SESSION_HIGHLIGHT_LINE_COLOR,
    };
  }
  if (obColor === undefined) {
    return candle;
  }
  return {
    ...candle,
    color: obColor,
    borderColor: obColor,
    wickColor: obColor,
  };
}

export function fvgSignalColor(
  signal: FvgSignalUpdateMessage | undefined,
): string | undefined {
  if (signal === undefined || signal.phase === "clear" || signal.pulse === 0) {
    return undefined;
  }
  const level = Math.abs(signal.pulse) === 5 ? 5 : Math.abs(signal.level);
  const direction =
    signal.pulse !== 0 ? Math.sign(signal.pulse) : Math.sign(signal.direction);
  if (direction > 0) {
    return FVG_BULL_COLORS[level] ?? FVG_BULL_COLORS[1];
  }
  if (direction < 0) {
    return FVG_BEAR_COLORS[level] ?? FVG_BEAR_COLORS[1];
  }
  return undefined;
}

function toVolumeDelta(
  point: VolumeDeltaDatum,
  colors: DeltaColors,
  displayTimeOffsetMs: number,
): CandlestickData {
  // MyVolumeDelta's Delta mode draws each bar as a candle whose open is the
  // zero line, close is bar delta, and wick spans the intrabar running delta.
  const close = point.closeDelta;
  const high = Math.max(0, point.deltaHigh, close);
  const low = Math.min(0, point.deltaLow, close);
  const bodyColor =
    close > 0 ? colors.positive : close < 0 ? colors.negative : colors.zero;
  return {
    time: toUtcTimestamp(point.time, displayTimeOffsetMs),
    open: 0,
    high,
    low,
    close,
    color: bodyColor,
    borderColor: bodyColor,
    wickColor: colors.wick,
  };
}

function toWaveDeltaLineData(
  bar: Bar,
  value: number,
  displayTimeOffsetMs: number,
): LineData {
  return {
    time: toUtcTimestamp(bar.time, displayTimeOffsetMs),
    value,
  };
}

function buildWaveDeltaValues(
  bars: readonly Bar[],
  deltaByTime: ReadonlyMap<number, VolumeDeltaDatum>,
  _swingSize = DEFAULT_WAVE_DELTA_SWING_SIZE,
): number[] {
  return buildMgannSwingOverlay(bars, deltaByTime).waveDeltaValues;
}

function toWaveDeltaMbox(
  box: MgannSwingWaveDeltaBox,
  displayTimeOffsetMs: number,
): RenderableWaveDeltaMbox {
  const divergent =
    (box.direction === 1 && box.value < 0) ||
    (box.direction === -1 && box.value > 0);
  const fillColor = divergent
    ? box.direction === 1
      ? WAVE_DELTA_MBOX_DIV_UP_FILL
      : WAVE_DELTA_MBOX_DIV_DOWN_FILL
    : box.value >= 0
      ? WAVE_DELTA_MBOX_UP_FILL
      : WAVE_DELTA_MBOX_DOWN_FILL;
  const borderColor = divergent
    ? box.direction === 1
      ? WAVE_DELTA_MBOX_DIV_UP_BORDER
      : WAVE_DELTA_MBOX_DIV_DOWN_BORDER
    : box.value >= 0
      ? WAVE_DELTA_MBOX_UP_BORDER
      : WAVE_DELTA_MBOX_DOWN_BORDER;
  return {
    id: box.id,
    startTime: toUtcTimestamp(box.startTime, displayTimeOffsetMs),
    endTime: toUtcTimestamp(box.endTime, displayTimeOffsetMs),
    value: box.value,
    direction: box.direction,
    fillColor,
    borderColor,
  };
}

function toWaveDeltaLineDataFromValues(
  bars: readonly Bar[],
  values: readonly number[],
  displayTimeOffsetMs: number,
): LineData[] {
  return bars.map((bar, index) =>
    toWaveDeltaLineData(bar, values[index] ?? 0, displayTimeOffsetMs),
  );
}

function toWaveDeltaMboxes(
  boxes: readonly MgannSwingWaveDeltaBox[],
  displayTimeOffsetMs: number,
): RenderableWaveDeltaMbox[] {
  return boxes
    .slice(-WAVE_DELTA_MBOX_KEEP)
    .map((box) => toWaveDeltaMbox(box, displayTimeOffsetMs));
}

export function buildWaveDeltaLineData(
  bars: readonly Bar[],
  deltaByTime: ReadonlyMap<number, VolumeDeltaDatum>,
  displayTimeOffsetMs = 0,
  swingSize = DEFAULT_WAVE_DELTA_SWING_SIZE,
): LineData[] {
  const values = buildWaveDeltaValues(bars, deltaByTime, swingSize);
  return toWaveDeltaLineDataFromValues(bars, values, displayTimeOffsetMs);
}

export function buildWaveDeltaMboxData(
  bars: readonly Bar[],
  deltaByTime: ReadonlyMap<number, VolumeDeltaDatum>,
  displayTimeOffsetMs = 0,
): RenderableWaveDeltaMbox[] {
  return toWaveDeltaMboxes(
    buildMgannSwingOverlay(bars, deltaByTime).waveDeltaBoxes,
    displayTimeOffsetMs,
  );
}

interface DivergencePivot {
  index: number;
  time: number;
  price: number;
  waveIndex: number;
  waveTime: number;
  waveValue: number;
}

interface WaveDeltaDivergence {
  id: string;
  direction: 1 | -1;
  pricePivots: readonly DivergencePivot[];
  score: number;
}

function isPivotHigh(bars: readonly Bar[], index: number, left: number, right: number): boolean {
  const value = bars[index].high;
  for (let offset = 1; offset <= left; offset += 1) {
    if (value <= bars[index - offset].high) return false;
  }
  for (let offset = 1; offset <= right; offset += 1) {
    if (value <= bars[index + offset].high) return false;
  }
  return true;
}

function isPivotLow(bars: readonly Bar[], index: number, left: number, right: number): boolean {
  const value = bars[index].low;
  for (let offset = 1; offset <= left; offset += 1) {
    if (value >= bars[index - offset].low) return false;
  }
  for (let offset = 1; offset <= right; offset += 1) {
    if (value >= bars[index + offset].low) return false;
  }
  return true;
}

function matchedWavePivot(
  bars: readonly Bar[],
  waveValues: readonly number[],
  index: number,
  kind: "high" | "low",
  window: number,
): {
  index: number;
  time: number;
  value: number;
} {
  const from = Math.max(0, index - window);
  const to = Math.min(waveValues.length - 1, index + window);
  let bestIndex = index;
  let bestValue = waveValues[index] ?? 0;
  for (let candidate = from; candidate <= to; candidate += 1) {
    const value = waveValues[candidate] ?? 0;
    if (
      (kind === "high" && value > bestValue) ||
      (kind === "low" && value < bestValue)
    ) {
      bestValue = value;
      bestIndex = candidate;
    }
  }
  return {
    index: bestIndex,
    time: bars[bestIndex]?.time ?? bars[index].time,
    value: bestValue,
  };
}

function sessionVolumeProfileValueAreaLineColor(backgroundColor: string): string {
  const bg = parseHexColor(backgroundColor) ?? parseHexColor(MZ_FOOTPRINT_COLORS.chartBg)!;
  const isLight = relativeLuminance(bg) > 0.5;
  return isLight
    ? "rgba(31, 78, 121, 0.72)"
    : "rgba(170, 205, 255, 0.58)";
}

function collectDivergencePivots(
  bars: readonly Bar[],
  waveValues: readonly number[],
  kind: "high" | "low",
): DivergencePivot[] {
  const out: DivergencePivot[] = [];
  for (
    let index = DIVERGENCE_PIVOT_LEFT;
    index < bars.length - DIVERGENCE_PIVOT_RIGHT;
    index += 1
  ) {
    const isPivot =
      kind === "high"
        ? isPivotHigh(bars, index, DIVERGENCE_PIVOT_LEFT, DIVERGENCE_PIVOT_RIGHT)
        : isPivotLow(bars, index, DIVERGENCE_PIVOT_LEFT, DIVERGENCE_PIVOT_RIGHT);
    if (!isPivot) continue;
    const wave = matchedWavePivot(
      bars,
      waveValues,
      index,
      kind,
      DIVERGENCE_MATCH_WAVE_WINDOW,
    );
    out.push({
      index,
      time: bars[index].time,
      price: kind === "high" ? bars[index].high : bars[index].low,
      waveIndex: wave.index,
      waveTime: wave.time,
      waveValue: wave.value,
    });
  }
  return out;
}

function averageTrueRange(bars: readonly Bar[], from: number, to: number): number {
  let total = 0;
  let count = 0;
  for (let index = Math.max(0, from); index <= Math.min(to, bars.length - 1); index += 1) {
    const bar = bars[index];
    const previous = bars[index - 1];
    const prevClose = previous?.close ?? bar.close;
    const tr = Math.max(
      bar.high - bar.low,
      Math.abs(bar.high - prevClose),
      Math.abs(bar.low - prevClose),
    );
    if (Number.isFinite(tr) && tr > 0) {
      total += tr;
      count += 1;
    }
  }
  return count > 0 ? total / count : 1;
}

function waveRange(waveValues: readonly number[], from: number, to: number): number {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (
    let index = Math.max(0, from);
    index <= Math.min(to, waveValues.length - 1);
    index += 1
  ) {
    const value = waveValues[index] ?? 0;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  const range = max - min;
  return Number.isFinite(range) && range > 0 ? range : 1;
}

function divergenceTripleScore(
  bars: readonly Bar[],
  waveValues: readonly number[],
  pivots: readonly DivergencePivot[],
  direction: 1 | -1,
): number | undefined {
  const [a, b, c] = pivots;
  if (!a || !b || !c) return undefined;
  if (
    b.index - a.index < DIVERGENCE_MIN_PIVOT_SPACING ||
    c.index - b.index < DIVERGENCE_MIN_PIVOT_SPACING ||
    c.index - a.index > DIVERGENCE_MAX_SPAN
  ) {
    return undefined;
  }

  if (!(a.waveIndex <= b.waveIndex && b.waveIndex <= c.waveIndex)) {
    return undefined;
  }

  const priceDiverges =
    direction === -1
      ? a.price < b.price && b.price < c.price
      : a.price > b.price && b.price > c.price;
  const waveDiverges =
    direction === -1
      ? a.waveValue > b.waveValue && b.waveValue > c.waveValue
      : a.waveValue < b.waveValue && b.waveValue < c.waveValue;
  if (!priceDiverges || !waveDiverges) return undefined;

  const priceSlope =
    Math.abs(c.price - a.price) / averageTrueRange(bars, a.index, c.index);
  const localWaveRange = waveRange(waveValues, a.waveIndex, c.waveIndex);
  const waveSlope =
    Math.abs(c.waveValue - a.waveValue) / localWaveRange;

  if (
    priceSlope < DIVERGENCE_MIN_PRICE_SLOPE_ATR ||
    waveSlope < DIVERGENCE_MIN_WAVE_SLOPE_RANGE
  ) {
    return undefined;
  }
  return priceSlope + waveSlope;
}

export function buildWaveDeltaDivergences(
  bars: readonly Bar[],
  deltaByTime: ReadonlyMap<number, VolumeDeltaDatum>,
): WaveDeltaDivergence[] {
  const scopedBars =
    bars.length > DIVERGENCE_LOOKBACK_BARS
      ? bars.slice(-DIVERGENCE_LOOKBACK_BARS)
      : bars;
  if (scopedBars.length < DIVERGENCE_PIVOT_LEFT + DIVERGENCE_PIVOT_RIGHT + 3) {
    return [];
  }
  const waveValues = buildWaveDeltaValues(scopedBars, deltaByTime);
  const signals: WaveDeltaDivergence[] = [];
  for (const [kind, direction] of [
    ["high", -1],
    ["low", 1],
  ] as const) {
    const pivots = collectDivergencePivots(scopedBars, waveValues, kind).slice(
      -3,
    );
    if (pivots.length < 3) {
      continue;
    }
    const triple = [pivots[0], pivots[1], pivots[2]] as const;
    const score = divergenceTripleScore(scopedBars, waveValues, triple, direction);
    if (score !== undefined) {
      signals.push({
        id: `wave-div:${direction}:${triple[0].time}:${triple[1].time}:${triple[2].time}`,
        direction,
        pricePivots: triple,
        score,
      });
    }
  }
  return signals
    .sort((a, b) => a.pricePivots[2].index - b.pricePivots[2].index)
    .slice(-DIVERGENCE_MAX_VISIBLE);
}

function toDivergencePriceLines(
  divergences: readonly WaveDeltaDivergence[],
  displayTimeOffsetMs: number,
): RenderableDivergenceLine[] {
  return divergences.map((signal) => {
    const [a, b, c] = signal.pricePivots;
    return {
      id: `${signal.id}:price`,
      startTime: toUtcTimestamp(a.time, displayTimeOffsetMs),
      startValue: a.price,
      midTime: toUtcTimestamp(b.time, displayTimeOffsetMs),
      midValue: b.price,
      endTime: toUtcTimestamp(c.time, displayTimeOffsetMs),
      endValue: c.price,
      direction: signal.direction,
      label: signal.direction === 1 ? "Bull Div 3" : "Bear Div 3",
    };
  });
}

function toDivergenceWaveLines(
  divergences: readonly WaveDeltaDivergence[],
  displayTimeOffsetMs: number,
): RenderableDivergenceLine[] {
  return divergences.map((signal) => {
    const [a, b, c] = signal.pricePivots;
    return {
      id: `${signal.id}:wave`,
      startTime: toUtcTimestamp(a.waveTime, displayTimeOffsetMs),
      startValue: a.waveValue,
      midTime: toUtcTimestamp(b.waveTime, displayTimeOffsetMs),
      midValue: b.waveValue,
      endTime: toUtcTimestamp(c.waveTime, displayTimeOffsetMs),
      endValue: c.waveValue,
      direction: signal.direction,
    };
  });
}

function toVolumeHistogram(
  bar: Bar,
  displayTimeOffsetMs: number,
): HistogramData {
  return {
    time: toUtcTimestamp(bar.time, displayTimeOffsetMs),
    value: Math.max(0, bar.volume),
    color: bar.close >= bar.open ? VOLUME_UP_COLOR : VOLUME_DOWN_COLOR,
  };
}

function tickKindForType(tickMarkType: TickMarkType): TimeAxisTickKind {
  switch (tickMarkType) {
    case TickMarkType.Year:
      return "year";
    case TickMarkType.Month:
      return "month";
    case TickMarkType.DayOfMonth:
      return "day";
    case TickMarkType.TimeWithSeconds:
      return "timeWithSeconds";
    case TickMarkType.Time:
    default:
      return "time";
  }
}

function bigTradeKey(marker: BigTradeMarker): string {
  if (marker.tradeId !== undefined) {
    return `${marker.time}:${marker.side}:${marker.tradeId}`;
  }
  return `${marker.time}:${marker.side}`;
}

function emptySmcOverlay(): SmcOverlay {
  return { markers: [], zones: [], lines: [], swingTrend: 0, internalTrend: 0 };
}

function smcMarkerColor(marker: SmcMarker, swingLabelColor: string): string {
  if (marker.kind === "choch") {
    return marker.direction === 1 ? "#e0b341" : "#ab47bc";
  }
  if (marker.kind === "bos") {
    return marker.direction === 1 ? "#26a69a" : "#ef5350";
  }
  return swingLabelColor;
}

function mgannImpulseColor(impulse: MgannSwingImpulseWave): string {
  return impulse.direction === 1
    ? MGANN_IMPULSE_BULL_COLOR
    : MGANN_IMPULSE_BEAR_COLOR;
}

/**
 * Hosts a Lightweight Charts instance (candles + volume overlays) and implements the
 * incremental {@link ChartSeriesPort}. Construct it with a container element;
 * dispose it with {@link dispose} to release the chart.
 */
export class LightweightChartsAdapter implements ChartSeriesPort {
  private readonly chart: IChartApi;
  private readonly candleSeries: ISeriesApi<"Candlestick">;
  private readonly volumeSeries: ISeriesApi<"Histogram">;
  private readonly deltaSeries: ISeriesApi<"Candlestick">;
  private readonly waveDeltaSeries: ISeriesApi<"Line">;
  private readonly mgannSwingSeries: ISeriesApi<"Line">;
  private readonly smcMarkers: ISeriesMarkersPluginApi<Time>;
  private readonly smcAiSignalMarkers: ISeriesMarkersPluginApi<Time>;
  private readonly alertSignalMarkers: ISeriesMarkersPluginApi<Time>;
  private readonly sessionMarkers: ISeriesMarkersPluginApi<Time>;
  private readonly mgannSwingMarkers: ISeriesMarkersPluginApi<Time>;
  private bigTradePrimitive: BigTradeBubblePrimitive | undefined;
  private smcPrimitive: SmcOverlayPrimitive | undefined;
  private priceDivergencePrimitive: DivergenceLinePrimitive | undefined;
  private waveDeltaMboxPrimitive: WaveDeltaMboxPrimitive | undefined;
  private sessionVolumeProfilePrimitive: SessionVolumeProfilePrimitive | undefined;
  private waveDivergencePrimitive: DivergenceLinePrimitive | undefined;
  private smcOverlay: SmcOverlay = emptySmcOverlay();
  private readonly emaSeriesById = new Map<string, ISeriesApi<"Line">>();
  private readonly emaLastTimeById = new Map<string, number>();
  private readonly emaColorById = new Map<string, string>();
  private readonly deltaColors: DeltaColors;
  private candleBars: BarSeries = [];
  private outsideBar: OutsideBarSettings;
  private readonly barsByTime = new Map<number, Bar>();
  private readonly volumeDeltaByTime = new Map<number, VolumeDeltaDatum>();
  private mgannSwingVisible = false;
  private waveDeltaVisible = false;
  private mgannSwingSettings: MgannSwingSettings = DEFAULT_MGANN_SWING_SETTINGS;
  private readonly fvgSignalsByTime = new Map<number, FvgSignalUpdateMessage>();
  private fvgGraderVisible = true;
  private readonly bigTradesByKey = new Map<string, BigTradeMarker>();
  private smcAiSignals: SmcAiSignalMarker[] = [];
  private alertSignals: AlertSignalMarker[] = [];
  private readonly alertLinesById = new Map<string, IPriceLine>();
  // Live price/style per alert line, used for drag hit-testing + updates.
  private readonly alertLineMeta = new Map<
    string,
    DraggableLineMeta & { enabled?: boolean; title?: string }
  >();
  private readonly orderLinesById = new Map<string, IPriceLine>();
  private readonly orderLineMeta = new Map<
    string,
    DraggableLineMeta & { orderId: string; field: OrderLineField }
  >();
  private readonly priceLineDragHandles = new Map<string, HTMLDivElement>();
  private readonly priceLineDragConfigs = new Map<
    PriceLineDragKind,
    PriceLineDragConfig
  >();
  private readonly pendingOrderLineCommits = new Map<string, number>();
  private selectedPriceLine: PriceLineSelection | undefined;
  private draggingPriceLine:
    | { kind: PriceLineDragKind; id: string; pointerId: number }
    | undefined;
  private disposePriceLineDragListeners: (() => void) | undefined;
  private displayTimeOffsetMs: number;
  private readonly container: HTMLElement;
  private chartBackgroundColor: string;
  private readonly barCountdownElement: HTMLDivElement;
  private barCountdownDurationMs: number;
  private barCountdownTimer: number | undefined;
  private latestBar: Bar | undefined;
  private latestBarFirstSeenAtMs: number | undefined;
  private latestBarUsesObservedCountdown = false;
  private timezoneOffsetMinutes: number;

  constructor(container: HTMLElement, options: LightweightChartsAdapterOptions = {}) {
    this.container = container;
    this.deltaColors = options.deltaColors ?? DEFAULT_DELTA_COLORS;
    this.outsideBar = normalizeOutsideBarSettings(options.outsideBar);
    this.displayTimeOffsetMs = options.displayTimeOffsetMs ?? 0;
    this.timezoneOffsetMinutes = normalizeTimezoneOffsetMinutes(
      options.timezoneOffsetMinutes,
      DEFAULT_TIMEZONE_OFFSET_MINUTES,
    );
    this.barCountdownDurationMs = options.barCountdownDurationMs ?? 60_000;
    this.chartBackgroundColor =
      options.chartBackgroundColor ?? MZ_FOOTPRINT_COLORS.chartBg;
    const palette = chartContrastPalette(this.chartBackgroundColor);

    this.chart = createChart(container, {
      autoSize: true,
      layout: {
        attributionLogo: false,
        background: {
          type: ColorType.Solid,
          color: this.chartBackgroundColor,
        },
        textColor: palette.text,
      },
      grid: {
        vertLines: { color: palette.verticalGrid },
        horzLines: { color: palette.grid },
      },
      localization: {
        timeFormatter: (time: Time) =>
          formatCrosshairTimeForOffset(time, this.timezoneOffsetMinutes),
      },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) =>
          formatTickMarkForOffset(
            time,
            this.timezoneOffsetMinutes,
            tickKindForType(tickMarkType),
          ),
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: palette.crosshair },
        horzLine: { color: palette.crosshair },
      },
    });

    this.candleSeries = this.chart.addSeries(CandlestickSeries, {
      upColor: "transparent",
      downColor: MZ_FOOTPRINT_COLORS.candleDown,
      borderUpColor: MZ_FOOTPRINT_COLORS.candleUp,
      borderDownColor: MZ_FOOTPRINT_COLORS.candleDown,
      wickUpColor: MZ_FOOTPRINT_COLORS.candleUp,
      wickDownColor: MZ_FOOTPRINT_COLORS.candleDown,
      // Current (last) price line: a light dashed line like the alert lines.
      priceLineVisible: true,
      priceLineSource: PriceLineSource.LastBar,
      priceLineWidth: 1,
      priceLineColor: palette.priceLine,
      priceLineStyle: LineStyle.Dashed,
    });
    this.smcMarkers = createSeriesMarkers(this.candleSeries, []);
    this.smcAiSignalMarkers = createSeriesMarkers(this.candleSeries, []);
    this.alertSignalMarkers = createSeriesMarkers(this.candleSeries, []);
    this.sessionMarkers = createSeriesMarkers(this.candleSeries, []);
    this.mgannSwingMarkers = createSeriesMarkers(this.candleSeries, []);
    this.bigTradePrimitive = new BigTradeBubblePrimitive([]);
    this.candleSeries.attachPrimitive(
      this.bigTradePrimitive as unknown as Parameters<
        typeof this.candleSeries.attachPrimitive
      >[0],
    );
    this.priceDivergencePrimitive = new DivergenceLinePrimitive([]);
    this.candleSeries.attachPrimitive(
      this.priceDivergencePrimitive as unknown as Parameters<
        typeof this.candleSeries.attachPrimitive
      >[0],
    );

    this.sessionVolumeProfilePrimitive = new SessionVolumeProfilePrimitive();
    this.sessionVolumeProfilePrimitive.setDisplayTimeOffset(
      this.displayTimeOffsetMs,
    );
    this.sessionVolumeProfilePrimitive.setValueAreaLineColor(
      sessionVolumeProfileValueAreaLineColor(this.chartBackgroundColor),
    );
    this.candleSeries.attachPrimitive(
      this.sessionVolumeProfilePrimitive as unknown as Parameters<
        typeof this.candleSeries.attachPrimitive
      >[0],
    );

    this.mgannSwingSeries = this.chart.addSeries(LineSeries, {
      color: MGANN_SWING_LINE_COLOR,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      visible: false,
    });

    // TradingView-style Volume indicator: a histogram overlaid at the bottom
    // of the main pane, on its own autoscaled price scale.
    this.volumeSeries = this.chart.addSeries(HistogramSeries, {
      color: VOLUME_UP_COLOR,
      priceScaleId: VOLUME_OVERLAY_PRICE_SCALE_ID,
      priceFormat: { type: "volume" },
      priceLineVisible: false,
      lastValueVisible: false,
      base: 0,
    }, 0);
    this.volumeSeries.priceScale().applyOptions({
      scaleMargins: VOLUME_OVERLAY_SCALE_MARGINS,
      borderVisible: false,
    });

    // Volume delta overlays the main pane on its own price scale. This keeps
    // the delta band fixed near the bottom without adding a draggable pane.
    this.deltaSeries = this.chart.addSeries(CandlestickSeries, {
      upColor: this.deltaColors.positive,
      downColor: this.deltaColors.negative,
      borderUpColor: this.deltaColors.positive,
      borderDownColor: this.deltaColors.negative,
      wickUpColor: this.deltaColors.wick,
      wickDownColor: this.deltaColors.wick,
      priceScaleId: VOLUME_DELTA_OVERLAY_PRICE_SCALE_ID,
      priceFormat: { type: "volume" },
      priceLineVisible: false,
      lastValueVisible: false,
      autoscaleInfoProvider: symmetricZeroAutoscale,
    }, 0);
    this.deltaSeries.createPriceLine({
      price: 0,
      color: this.deltaColors.zeroLine,
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: false,
      title: "",
    });
    this.deltaSeries.priceScale().applyOptions({
      scaleMargins: VOLUME_DELTA_OVERLAY_SCALE_MARGINS,
      borderVisible: false,
    });

    // Wave Delta uses the same volume-delta feed plus candle swings. The line
    // series is kept transparent as the autoscale host; the visible layer is
    // the MBox primitive, replacing the old CVD/current-wave line.
    this.waveDeltaSeries = this.chart.addSeries(LineSeries, {
      color: WAVE_DELTA_TRANSPARENT_LINE_COLOR,
      lineWidth: 1,
      priceScaleId: WAVE_DELTA_OVERLAY_PRICE_SCALE_ID,
      priceFormat: { type: "volume" },
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      visible: false,
    }, 0);
    this.waveDeltaSeries.priceScale().applyOptions({
      scaleMargins: WAVE_DELTA_OVERLAY_SCALE_MARGINS,
      borderVisible: false,
    });
    this.waveDeltaMboxPrimitive = new WaveDeltaMboxPrimitive([], {
      topMargin: WAVE_DELTA_OVERLAY_SCALE_MARGINS.top,
      bottomMargin: WAVE_DELTA_OVERLAY_SCALE_MARGINS.bottom,
    });
    this.waveDeltaSeries.attachPrimitive(
      this.waveDeltaMboxPrimitive as unknown as Parameters<
        typeof this.waveDeltaSeries.attachPrimitive
      >[0],
    );
    this.waveDivergencePrimitive = new DivergenceLinePrimitive([]);
    this.waveDeltaSeries.attachPrimitive(
      this.waveDivergencePrimitive as unknown as Parameters<
        typeof this.waveDeltaSeries.attachPrimitive
      >[0],
    );

    this.barCountdownElement = document.createElement("div");
    this.barCountdownElement.className = "bar-countdown";
    this.barCountdownElement.setAttribute("aria-label", "Current bar time remaining");
    this.barCountdownElement.hidden = true;
    this.container.appendChild(this.barCountdownElement);
    this.barCountdownTimer = window.setInterval(
      () => this.updateBarCountdown(),
      1_000,
    );
  }

  /** The underlying chart instance (for layout chrome wired in task 12.7). */
  get chartApi(): IChartApi {
    return this.chart;
  }

  /** The candle series instance (for DrawingManager to attach primitives). */
  get candleSeriesApi(): ISeriesApi<"Candlestick"> {
    return this.candleSeries;
  }

  /** Convert a candle-scale price to a Y coordinate inside the candle pane. */
  priceToCoordinate(price: number): number | null {
    const y = this.candleSeries.priceToCoordinate(price);
    return y === null ? null : y as number;
  }

  subscribeVisibleLogicalRange(
    handler: (info: VisibleLogicalRangeInfo | null) => void,
  ): () => void {
    const timeScale = this.chart.timeScale();
    const emit = (range: LogicalRange | null) => {
      if (range === null) {
        handler(null);
        return;
      }
      const barsInfo = this.candleSeries.barsInLogicalRange(range);
      handler({
        from: Number(range.from),
        to: Number(range.to),
        barsBefore: barsInfo?.barsBefore ?? 0,
        barsAfter: barsInfo?.barsAfter ?? 0,
      });
    };
    timeScale.subscribeVisibleLogicalRangeChange(emit);
    emit(timeScale.getVisibleLogicalRange());
    return () => timeScale.unsubscribeVisibleLogicalRangeChange(emit);
  }

  /** Set the display-only bucket-start -> chart-time offsets. */
  setDisplayTimeOffset(offsetMs: number): void {
    this.displayTimeOffsetMs = offsetMs;
    this.sessionVolumeProfilePrimitive?.setDisplayTimeOffset(offsetMs);
    this.rebuildBarsByDisplayTime();
    this.renderCandleSeries();
    this.renderSessionMarkers();
    this.renderVolumeSeries();
    this.renderVolumeDeltaSeries();
    this.renderWaveDeltaSeries();
    this.renderMgannSwing();
    this.renderBigTradeMarkers();
    this.renderSmcOverlay();
    this.renderSmcAiSignals();
  }

  /** Change display timezone without changing source UTC timestamps. */
  setTimezoneOffsetMinutes(offsetMinutes: number): void {
    this.timezoneOffsetMinutes = normalizeTimezoneOffsetMinutes(
      offsetMinutes,
      this.timezoneOffsetMinutes,
    );
    this.chart.applyOptions({
      localization: {
        timeFormatter: (time: Time) =>
          formatCrosshairTimeForOffset(time, this.timezoneOffsetMinutes),
      },
      timeScale: {
        tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) =>
          formatTickMarkForOffset(
            time,
            this.timezoneOffsetMinutes,
            tickKindForType(tickMarkType),
          ),
      },
    });
  }

  /** Capture the current chart canvas as a PNG data URL for notifications. */
  takeScreenshotDataUrl(): string | undefined {
    try {
      return this.chart.takeScreenshot(true, false).toDataURL("image/png");
    } catch {
      return undefined;
    }
  }

  /** Change the active timeframe used by the right-axis current-bar countdown. */
  setBarCountdownDuration(durationMs: number): void {
    this.barCountdownDurationMs = durationMs;
    this.renderCandleSeries();
    this.renderBigTradeMarkers();
    this.updateBarCountdown();
  }

  /** Restyle the chart background without rebuilding the chart instance. */
  setChartBackgroundColor(color: string): void {
    this.chartBackgroundColor = color;
    const palette = chartContrastPalette(color);
    this.sessionVolumeProfilePrimitive?.setValueAreaLineColor(
      sessionVolumeProfileValueAreaLineColor(color),
    );
    this.chart.applyOptions({
      layout: {
        attributionLogo: false,
        background: { type: ColorType.Solid, color },
        textColor: palette.text,
      },
      grid: {
        vertLines: { color: palette.verticalGrid },
        horzLines: { color: palette.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: palette.crosshair },
        horzLine: { color: palette.crosshair },
      },
    });
    this.candleSeries.applyOptions({
      priceLineColor: palette.priceLine,
    });
    this.renderSmcOverlay();
  }

  /** Bulk-load the full candle series. Delta history is loaded separately. */
  setBars(bars: BarSeries): void {
    this.candleBars = bars.map((bar) => ({ ...bar }));
    this.rebuildBarsByDisplayTime();
    this.renderCandleSeries();
    this.renderSessionMarkers();
    this.renderVolumeSeries();
    this.renderWaveDeltaSeries();
    this.renderMgannSwing();
    this.latestBar =
      this.candleBars.length > 0
        ? { ...this.candleBars[this.candleBars.length - 1] }
        : undefined;
    this.latestBarFirstSeenAtMs = undefined;
    this.latestBarUsesObservedCountdown = false;
    this.updateBarCountdown();
  }

  /** Apply a single incremental candle update. */
  updateBar(bar: Bar): void {
    const result = applyBarUpdate(this.candleBars, bar);
    this.candleBars = result.bars;
    if (this.shouldRenderMgannImpulseWaves()) {
      this.renderCandleSeries();
    } else {
      this.updateCandleAt(result.index);
      this.updateCandleAt(result.index + 1);
    }
    this.renderSessionMarkers();
    this.updateVolumeAt(result.index);
    this.renderWaveDeltaSeries();
    this.renderMgannSwing();
    this.barsByTime.set(
      toUtcTimestamp(bar.time, this.displayTimeOffsetMs) as number,
      { ...bar },
    );
    const previousLatestTime = this.latestBar?.time;
    if (this.latestBar === undefined || bar.time >= this.latestBar.time) {
      if (previousLatestTime === undefined || bar.time > previousLatestTime) {
        const now = Date.now();
        this.latestBarFirstSeenAtMs = now;
        this.latestBarUsesObservedCountdown = shouldUseObservedBarCountdown(
          bar.time,
          this.barCountdownDurationMs,
          now,
        );
      }
      this.latestBar = { ...bar };
      this.updateBarCountdown();
    }
  }

  /** Enable/disable Outside Bar candle recoloring and repaint current candles. */
  setOutsideBar(settings: Partial<OutsideBarSettings>): void {
    this.outsideBar = normalizeOutsideBarSettings(settings);
    this.renderCandleSeries();
  }

  /** Show or hide the TradingView-style Volume histogram overlay. */
  setVolumeVisible(visible: boolean): void {
    this.volumeSeries.applyOptions({ visible });
  }

  /** Show or hide the MyVolumeDelta-style overlay candles. */
  setVolumeDeltaVisible(visible: boolean): void {
    this.deltaSeries.applyOptions({ visible });
  }

  /** Show or hide the wave-delta MBox overlay. */
  setCvdVisible(visible: boolean): void {
    if (this.waveDeltaVisible === visible) {
      return;
    }
    this.waveDeltaVisible = visible;
    this.waveDeltaSeries.applyOptions({ visible });
    this.waveDeltaMboxPrimitive?.setVisible(visible);
    if (visible) {
      this.renderWaveDeltaSeries();
    } else {
      this.waveDeltaSeries.setData([]);
      this.waveDeltaMboxPrimitive?.setBoxes([]);
      this.priceDivergencePrimitive?.setLines([]);
      this.waveDivergencePrimitive?.setLines([]);
    }
  }

  /** Set the session volume profile data (right-edge histogram). */
  setSessionVolumeProfile(data: import("../orderflow/deltaProfile").DeltaProfileData | null): void {
    this.sessionVolumeProfilePrimitive?.setProfile(data);
  }

  /** Set the session volume profile histogram width in CSS pixels. */
  setSessionVolumeProfileWidth(widthPx: number): void {
    this.sessionVolumeProfilePrimitive?.setProfileWidth(widthPx);
  }

  /** Show or hide the session developing POC and value-area paths. */
  setSessionVolumeProfileDevelopingPoc(visible: boolean): void {
    this.sessionVolumeProfilePrimitive?.setDevelopingPocVisible(visible);
  }

  /** Show or hide the MGannSwing indicator. */
  setMgannSwingVisible(visible: boolean): void {
    this.mgannSwingVisible = visible;
    this.renderCandleSeries();
    this.renderMgannSwing();
  }

  /** Apply MGannSwing sub-settings. */
  setMgannSwingSettings(settings: Partial<MgannSwingSettings>): void {
    this.mgannSwingSettings = normalizeMgannSwingSettings(settings);
    this.renderCandleSeries();
    this.renderMgannSwing();
  }

  private shouldRenderMgannImpulseWaves(): boolean {
    return (
      this.mgannSwingVisible &&
      this.mgannSwingSettings.showImpulseWaves &&
      isMgannImpulseTimeframeDuration(this.barCountdownDurationMs)
    );
  }

  private mgannImpulseColorsByIndex(): Map<number, string> {
    if (!this.shouldRenderMgannImpulseWaves()) {
      return new Map();
    }
    const overlay = buildMgannSwingOverlay(
      this.candleBars,
      this.volumeDeltaByTime,
      this.mgannSwingSettings,
    );
    const colors = new Map<number, string>();
    for (const impulse of overlay.impulseWaves) {
      const color = mgannImpulseColor(impulse);
      for (
        let index = Math.max(0, impulse.startIndex);
        index <= Math.min(this.candleBars.length - 1, impulse.endIndex);
        index += 1
      ) {
        colors.set(index, color);
      }
    }
    return colors;
  }

  private renderCandleSeries(): void {
    const impulseColors = this.mgannImpulseColorsByIndex();
    this.candleSeries.setData(
      this.candleBars.map((bar, index) =>
        toCandle(
          bar,
          this.displayTimeOffsetMs,
          this.candleBars[index - 1],
          this.outsideBar,
          {
            bars: this.candleBars,
            index,
            deltaByTime: this.volumeDeltaByTime,
          },
          this.fvgGraderVisible ? this.fvgSignalsByTime.get(bar.time) : undefined,
          impulseColors.get(index),
        ),
      ),
    );
  }

  private renderVolumeSeries(): void {
    this.volumeSeries.setData(
      this.candleBars.map((bar) =>
        toVolumeHistogram(bar, this.displayTimeOffsetMs),
      ),
    );
  }

  private renderVolumeDeltaSeries(): void {
    this.deltaSeries.setData(
      [...this.volumeDeltaByTime.values()]
        .sort((a, b) => a.time - b.time)
        .map((point) =>
          toVolumeDelta(point, this.deltaColors, this.displayTimeOffsetMs),
        ),
    );
  }

  private renderWaveDeltaSeries(): void {
    if (!this.waveDeltaVisible) {
      return;
    }
    const overlay = buildMgannSwingOverlay(
      this.candleBars,
      this.volumeDeltaByTime,
    );
    this.waveDeltaSeries.setData(
      toWaveDeltaLineDataFromValues(
        this.candleBars,
        overlay.waveDeltaValues,
        this.displayTimeOffsetMs,
      ),
    );
    this.waveDeltaMboxPrimitive?.setBoxes(
      toWaveDeltaMboxes(overlay.waveDeltaBoxes, this.displayTimeOffsetMs),
    );
    this.renderWaveDeltaDivergences();
  }

  private renderWaveDeltaDivergences(): void {
    const divergences = buildWaveDeltaDivergences(
      this.candleBars,
      this.volumeDeltaByTime,
    );
    this.priceDivergencePrimitive?.setLines(
      toDivergencePriceLines(divergences, this.displayTimeOffsetMs),
    );
    this.waveDivergencePrimitive?.setLines(
      toDivergenceWaveLines(divergences, this.displayTimeOffsetMs),
    );
  }

  private renderMgannSwing(): void {
    const showLine =
      this.mgannSwingVisible && this.mgannSwingSettings.showSwingLine;
    const showSignals =
      this.mgannSwingVisible && this.mgannSwingSettings.showSignals;
    const showWaveDeltaNumbers =
      this.mgannSwingVisible && this.mgannSwingSettings.showWaveDeltaNumbers;
    this.mgannSwingSeries.applyOptions({ visible: showLine });

    if (!showLine && !showSignals && !showWaveDeltaNumbers) {
      this.mgannSwingSeries.setData([]);
      this.mgannSwingMarkers.setMarkers([]);
      return;
    }

    const overlay = buildMgannSwingOverlay(
      this.candleBars,
      this.volumeDeltaByTime,
      this.mgannSwingSettings,
    );

    this.mgannSwingSeries.setData(
      showLine
        ? overlay.line.map((point) => ({
            time: toUtcTimestamp(point.time, this.displayTimeOffsetMs),
            value: point.value,
          }))
        : [],
    );

    const waveDeltaMarkers: SeriesMarker<Time>[] = showWaveDeltaNumbers
      ? overlay.waveDeltaLabels.map((label) => {
          const isBuy = label.kind === "low";
          const rounded = Math.round(label.value);
          return {
            time: toUtcTimestamp(label.time, this.displayTimeOffsetMs),
            position: isBuy ? "belowBar" : "aboveBar",
            shape: "circle",
            color:
              rounded > 0
                ? MGANN_SWING_DELTA_UP_COLOR
                : rounded < 0
                  ? MGANN_SWING_DELTA_DOWN_COLOR
                  : MGANN_SWING_DELTA_ZERO_COLOR,
            id: label.id,
            text: String(rounded),
            size: 0,
          } satisfies SeriesMarker<Time>;
        })
      : [];
    const signalMarkers: SeriesMarker<Time>[] = showSignals
      ? overlay.signals.map((signal) => {
            const isBuy = signal.kind === "low";
            return {
              time: toUtcTimestamp(signal.time, this.displayTimeOffsetMs),
              position: isBuy ? "belowBar" : "aboveBar",
              shape: "circle",
              color: isBuy ? MGANN_SWING_BUY_COLOR : MGANN_SWING_SELL_COLOR,
              id: signal.id,
              text: signal.labels.join(" "),
              size: 0,
            } satisfies SeriesMarker<Time>;
          })
      : [];
    this.mgannSwingMarkers.setMarkers(
      [...waveDeltaMarkers, ...signalMarkers].sort(
        (left, right) => Number(left.time) - Number(right.time),
      ),
    );
  }

  private rebuildBarsByDisplayTime(): void {
    this.barsByTime.clear();
    for (const bar of this.candleBars) {
      this.barsByTime.set(
        toUtcTimestamp(bar.time, this.displayTimeOffsetMs) as number,
        { ...bar },
      );
    }
  }

  private updateCandleAt(index: number): void {
    if (index < 0 || index >= this.candleBars.length) {
      return;
    }
    const impulseColors = this.mgannImpulseColorsByIndex();
    const candle = toCandle(
      this.candleBars[index],
      this.displayTimeOffsetMs,
      this.candleBars[index - 1],
      this.outsideBar,
      {
        bars: this.candleBars,
        index,
        deltaByTime: this.volumeDeltaByTime,
      },
      this.fvgGraderVisible
        ? this.fvgSignalsByTime.get(this.candleBars[index].time)
        : undefined,
      impulseColors.get(index),
    );
    this.candleSeries.update(candle, index < this.candleBars.length - 1);
  }

  private updateVolumeAt(index: number): void {
    if (index < 0 || index >= this.candleBars.length) {
      return;
    }
    this.volumeSeries.update(
      toVolumeHistogram(this.candleBars[index], this.displayTimeOffsetMs),
      index < this.candleBars.length - 1,
    );
  }

  private updateBarCountdown(): void {
    const bar = this.latestBar;
    if (bar === undefined || this.barCountdownDurationMs <= 0) {
      this.barCountdownElement.hidden = true;
      return;
    }
    const now = Date.now();
    const remaining =
      this.latestBarUsesObservedCountdown &&
      this.latestBarFirstSeenAtMs !== undefined
        ? remainingObservedBarTimeMs(
            this.latestBarFirstSeenAtMs,
            this.barCountdownDurationMs,
            now,
          )
        : remainingBarTimeMs(
            countdownBarStartMs(bar.time, this.barCountdownDurationMs, now),
            this.barCountdownDurationMs,
            now,
          );
    const y = this.candleSeries.priceToCoordinate(bar.close);
    const scaleWidth = this.candleSeries.priceScale().width();
    const paneHeight = this.chart.paneSize(0).height;
    const labelHeight = 18;
    const top = (y as number) + 10;
    if (
      remaining <= 0 ||
      remaining > this.barCountdownDurationMs ||
      y === null ||
      scaleWidth <= 0 ||
      top + labelHeight > paneHeight
    ) {
      this.barCountdownElement.hidden = true;
      return;
    }
    this.barCountdownElement.textContent = formatBarCountdown(remaining);
    this.barCountdownElement.style.top = `${Math.round(top)}px`;
    this.barCountdownElement.style.width = `${Math.round(scaleWidth)}px`;
    this.barCountdownElement.style.backgroundColor =
      bar.close >= bar.open
        ? MZ_FOOTPRINT_COLORS.candleUp
        : MZ_FOOTPRINT_COLORS.candleDown;
    this.barCountdownElement.hidden = false;
  }

  /**
   * Set (or replace) all EMA overlay lines on the candle price scale. Missing
   * ids are removed, so disabled overlays leave no trace.
   */
  setEmaLines(lines: readonly EmaLineData[]): void {
    const nextIds = new Set<string>();
    for (const line of lines) {
      if (line.points.length === 0) {
        continue;
      }
      nextIds.add(line.id);
      const color = line.color ?? this.emaColorById.get(line.id) ?? EMA_LINE_COLOR;
      const lineWidth = line.lineWidth ?? 2;
      const series = this.ensureEmaSeries(line.id, color, lineWidth);
      const data = line.points.map((point) => ({
        time: toUtcTimestamp(point.time, this.displayTimeOffsetMs),
        value: point.value,
      }));
      series.setData(data);
      const last = data[data.length - 1];
      if (last !== undefined) {
        this.emaLastTimeById.set(line.id, last.time as number);
      }
    }
    for (const [id, series] of this.emaSeriesById) {
      if (!nextIds.has(id)) {
        this.chart.removeSeries(series);
        this.emaSeriesById.delete(id);
        this.emaLastTimeById.delete(id);
        this.emaColorById.delete(id);
      }
    }
  }

  /** Backwards-compatible single-line EMA setter. */
  setEma(points: readonly EmaPoint[], color?: string): void {
    this.setEmaLines(
      points.length === 0 ? [] : [{ id: "primary", points, color }],
    );
  }

  /** Restyle the primary EMA line color without touching its data. */
  setEmaColor(color: string): void {
    this.emaColorById.set("primary", color);
    this.emaSeriesById.get("primary")?.applyOptions({ color });
  }

  /** Apply one incremental EMA point to a named line (no-op when off). */
  updateEmaLine(id: string, point: EmaPoint): void {
    const series = this.emaSeriesById.get(id);
    if (series === undefined) return;
    const time = toUtcTimestamp(point.time, this.displayTimeOffsetMs) as number;
    // Lightweight Charts throws if update() is called with a time older than
    // the series' last point; skip stale ticks so a single out-of-order update
    // can never crash the render path.
    const lastTime = this.emaLastTimeById.get(id);
    if (lastTime !== undefined && time < lastTime) {
      return;
    }
    series.update({ time, value: point.value } as LineData);
    this.emaLastTimeById.set(id, time);
  }

  /** Apply one incremental primary EMA point (no-op when the overlay is off). */
  updateEma(point: EmaPoint): void {
    this.updateEmaLine("primary", point);
  }

  /** Remove all EMA overlay lines. */
  clearEmaLines(): void {
    for (const series of this.emaSeriesById.values()) {
      this.chart.removeSeries(series);
    }
    this.emaSeriesById.clear();
    this.emaLastTimeById.clear();
    this.emaColorById.clear();
  }

  /** Remove the primary EMA overlay line. */
  clearEma(): void {
    const series = this.emaSeriesById.get("primary");
    if (series !== undefined) {
      this.chart.removeSeries(series);
      this.emaSeriesById.delete("primary");
      this.emaLastTimeById.delete("primary");
      this.emaColorById.delete("primary");
    }
  }

  private ensureEmaSeries(
    id: string,
    color: string,
    lineWidth: EmaLineWidth,
  ): ISeriesApi<"Line"> {
    let series = this.emaSeriesById.get(id);
    if (series === undefined) {
      series = this.chart.addSeries(LineSeries, {
        color,
        lineWidth,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      this.emaSeriesById.set(id, series);
    } else {
      series.applyOptions({ color, lineWidth });
    }
    this.emaColorById.set(id, color);
    return series;
  }

  /** Bulk-load volume-delta history into the MyVolumeDelta-style candles. */
  setVolumeDelta(points: readonly VolumeDeltaDatum[]): void {
    this.volumeDeltaByTime.clear();
    for (const point of points) {
      this.volumeDeltaByTime.set(point.time, { ...point });
    }
    if (this.shouldRenderMgannImpulseWaves()) {
      this.renderCandleSeries();
    }
    this.renderVolumeDeltaSeries();
    this.renderWaveDeltaSeries();
    this.renderMgannSwing();
  }

  /** Apply one incremental volume-delta update. */
  updateVolumeDelta(point: VolumeDeltaDatum): void {
    const next = { ...point };
    this.volumeDeltaByTime.set(point.time, next);
    this.deltaSeries.update(
      toVolumeDelta(next, this.deltaColors, this.displayTimeOffsetMs),
    );
    this.renderWaveDeltaSeries();
    this.renderMgannSwing();
    if (this.shouldRenderMgannImpulseWaves()) {
      const index = this.candleBars.findIndex((bar) => bar.time === point.time);
      this.updateCandleAt(index);
      this.updateCandleAt(index + 1);
    }
  }

  /** Bulk-load FVG Signal Grader candle colors. */
  setFvgSignals(signals: ReadonlyMap<number, FvgSignalUpdateMessage>): void {
    this.fvgSignalsByTime.clear();
    for (const [time, signal] of signals) {
      if (signal.phase !== "clear" && signal.pulse !== 0) {
        this.fvgSignalsByTime.set(time, { ...signal });
      }
    }
    this.renderCandleSeries();
  }

  /** Show/hide FVG Signal Grader candle recoloring without dropping cached state. */
  setFvgGraderVisible(visible: boolean): void {
    if (this.fvgGraderVisible === visible) {
      return;
    }
    this.fvgGraderVisible = visible;
    this.renderCandleSeries();
  }

  /** Apply one realtime FVG Signal Grader update. */
  updateFvgSignal(signal: FvgSignalUpdateMessage): void {
    if (signal.phase === "clear" || signal.pulse === 0) {
      this.fvgSignalsByTime.delete(signal.time);
    } else {
      this.fvgSignalsByTime.set(signal.time, { ...signal });
    }
    const index = this.candleBars.findIndex((bar) => bar.time === signal.time);
    this.updateCandleAt(index);
  }

  /** Bulk-load BigTrade markers on the candle series. */
  setBigTrades(markers: readonly BigTradeMarker[]): void {
    this.bigTradesByKey.clear();
    for (const marker of markers) {
      this.bigTradesByKey.set(bigTradeKey(marker), { ...marker });
    }
    this.renderBigTradeMarkers();
  }

  /** Draw read-only Phase 0 SMC AI entry signals on the candle series. */
  setSmcAiSignals(markers: readonly SmcAiSignalMarker[]): void {
    this.smcAiSignals = markers.map((marker) => ({ ...marker }));
    this.renderSmcAiSignals();
  }

  setAlertSignals(markers: readonly AlertSignalMarker[]): void {
    this.alertSignals = markers.map((marker) => ({ ...marker }));
    this.renderAlertSignals();
  }

  /** Apply one incremental BigTrade marker. */
  updateBigTrade(marker: BigTradeMarker): void {
    this.bigTradesByKey.set(bigTradeKey(marker), { ...marker });
    this.renderBigTradeMarkers();
  }

  /** Draw or clear the SMC overlay markers and active zones. */
  setSmcOverlay(overlay: SmcOverlay): void {
    this.smcOverlay = {
      markers: overlay.markers.map((marker) => ({ ...marker })),
      zones: overlay.zones.map((zone) => ({ ...zone })),
      lines: overlay.lines.map((line) => ({ ...line })),
      swingTrend: overlay.swingTrend,
      internalTrend: overlay.internalTrend,
    };
    this.renderSmcOverlay();
  }

  /**
   * Reconcile the alert level lines on the candle price scale (Req 16.5).
   *
   * Diffs the incoming lines against the currently-drawn ones by id: existing
   * lines are updated in place (so the chart is not needlessly repainted),
   * new ids add a price line, and dropped ids remove theirs. Lines render as a
   * light dashed line (TradingView alert style); disabled alerts are dimmer.
   */
  setAlertLines(lines: readonly AlertLine[]): void {
    const next = new Map(lines.map((line) => [line.id, line]));

    // Remove lines whose alert is gone.
    for (const [id, priceLine] of this.alertLinesById) {
      if (!next.has(id)) {
        if (this.isPriceLineSelected("alert", id)) {
          this.clearSelectedPriceLine();
        }
        this.candleSeries.removePriceLine(priceLine);
        this.alertLinesById.delete(id);
        this.alertLineMeta.delete(id);
      }
    }

    // Add or update the rest.
    for (const line of lines) {
      const existing = this.alertLinesById.get(line.id);
      const selected = this.isPriceLineSelected("alert", line.id);
      if (existing) {
        existing.applyOptions(this.alertLineOptions(line, selected));
      } else {
        this.alertLinesById.set(
          line.id,
          this.candleSeries.createPriceLine(this.alertLineOptions(line, selected)),
        );
      }
      this.alertLineMeta.set(line.id, {
        price: line.price,
        color: this.alertLineColor(line),
        enabled: line.enabled,
        title: line.title,
      });
    }
    this.positionSelectedPriceLineHandles();
  }

  private alertLineColor(line: AlertLine): string {
    return line.enabled === false
      ? ALERT_LINE_COLORS.disabled
      : ALERT_LINE_COLORS.enabled;
  }

  /** Shared price-line options for an alert line (light dashed style). */
  private alertLineOptions(line: AlertLine, selected = false) {
    const color = this.alertLineColor(line);
    return {
      price: line.price,
      color,
      lineWidth: (selected ? 3 : 1) as 1 | 3,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: line.title ?? "",
    };
  }

  /** Draw live order entry/SL/TP levels from backend order state. */
  setOrderLines(lines: readonly OrderLine[]): void {
    const next = new Map(lines.map((line) => [line.id, line]));

    for (const [id, priceLine] of this.orderLinesById) {
      if (!next.has(id)) {
        if (this.isPriceLineSelected("order", id)) {
          this.clearSelectedPriceLine();
        }
        this.candleSeries.removePriceLine(priceLine);
        this.orderLinesById.delete(id);
        this.orderLineMeta.delete(id);
      }
    }

    for (const line of lines) {
      const pendingPrice = this.pendingOrderLineCommits.get(line.id);
      const displayLine =
        pendingPrice === undefined ? line : { ...line, price: pendingPrice };
      const existing = this.orderLinesById.get(line.id);
      const selected = this.isPriceLineSelected("order", line.id);
      if (existing) {
        existing.applyOptions(this.orderLineOptions(displayLine, selected));
      } else {
        this.orderLinesById.set(
          line.id,
          this.candleSeries.createPriceLine(this.orderLineOptions(displayLine, selected)),
        );
      }
      this.orderLineMeta.set(line.id, {
        price: displayLine.price,
        color: this.orderLineColor(displayLine),
        orderId: line.orderId,
        field: line.field,
        editable: line.editable !== false,
      });
    }
    this.positionSelectedPriceLineHandles();
  }

  private orderLineColor(line: OrderLine): string {
    return line.field === "entryGc" && line.side === "sell"
        ? ORDER_LINE_COLORS.entrySell
        : ORDER_LINE_COLORS[line.field];
  }

  private orderLineOptions(line: OrderLine, selected = false) {
    const isEntry = line.field === "entryGc";
    const color = this.orderLineColor(line);
    return {
      price: line.price,
      color,
      lineWidth: (selected ? 2 : 1) as 1 | 2,
      lineStyle: isEntry ? LineStyle.Solid : LineStyle.Dashed,
      axisLabelVisible: true,
      title: "",
    };
  }

  /** Build a FootprintCanvas viewport using the candle price scale. */
  createFootprintViewport(width: number, height: number): FootprintViewport {
    const paneSize = this.chart.paneSize(0);
    const viewportHeight = Math.max(1, Math.round(paneSize.height || height));
    const palette = chartContrastPalette(this.chartBackgroundColor);
    return {
      width: Math.max(1, Math.round(paneSize.width || width)),
      height: viewportHeight,
      textColor: palette.text,
      priceToY: (price) =>
        this.candleSeries.priceToCoordinate(price) ?? viewportHeight / 2,
    };
  }

  /**
   * Make alert lines draggable. When the pointer presses within ~6px of an
   * alert line, the chart's scroll/scale is temporarily disabled and the line
   * follows the cursor; `onPreview` fires continuously with the live price and
   * `onCommit` fires once on release with the final price. Returns a disposer.
   *
   * Lightweight Charts price lines are not draggable natively, so this maps the
   * pointer Y to a price via the candle scale and re-styles the line in place.
   */
  subscribeAlertDrag(handlers: {
    onPreview?: (id: string, price: number) => void;
    onCommit?: (id: string, price: number) => void;
    snap?: (price: number) => number;
  }): () => void {
    return this.subscribePriceLineDrag(
      "alert",
      this.alertLineMeta,
      this.alertLinesById,
      handlers,
    );
  }

  /** Make live order lines draggable, returning a disposer. */
  subscribeOrderDrag(handlers: {
    onPreview?: (id: string, price: number) => void;
    onCommit?: (id: string, price: number) => void;
    onCommitBatch?: (updates: readonly { id: string; price: number }[]) => void;
    snap?: (price: number) => number;
  }): () => void {
    return this.subscribePriceLineDrag(
      "order",
      this.orderLineMeta,
      this.orderLinesById,
      handlers,
    );
  }

  private subscribePriceLineDrag(
    kind: PriceLineDragKind,
    metaById: Map<string, DraggableLineMeta>,
    linesById: Map<string, IPriceLine>,
    handlers: {
      onPreview?: (id: string, price: number) => void;
      onCommit?: (id: string, price: number) => void;
      onCommitBatch?: (updates: readonly { id: string; price: number }[]) => void;
      snap?: (price: number) => number;
    },
  ): () => void {
    this.priceLineDragConfigs.set(kind, { metaById, linesById, handlers });
    this.ensurePriceLineDragListeners();
    return () => {
      this.priceLineDragConfigs.delete(kind);
      if (this.selectedPriceLine?.kind === kind) {
        this.clearSelectedPriceLine(false);
      }
      if (this.priceLineDragConfigs.size === 0) {
        this.disposePriceLineDragListeners?.();
        this.disposePriceLineDragListeners = undefined;
      }
    };
  }

  private ensurePriceLineDragListeners(): void {
    if (this.disposePriceLineDragListeners !== undefined) return;
    const TAP_PX = 8;
    let press:
      | { pointerId: number; x: number; y: number; moved: boolean }
      | undefined;

    const onContainerPointerDown = (e: PointerEvent) => {
      if (
        e.button !== 0 ||
        this.priceLineHandleFromEventTarget(e.target) !== undefined
      ) {
        return;
      }
      press = {
        pointerId: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        moved: false,
      };
    };

    const onHandlePointerDown = (e: PointerEvent) => {
      const handle = this.priceLineHandleFromEventTarget(e.target);
      const kind = handle?.dataset.kind as PriceLineDragKind | undefined;
      const id = handle?.dataset.lineId;
      if (
        e.button !== 0 ||
        handle === undefined ||
        kind === undefined ||
        id === undefined ||
        !this.isPriceLineSelected(kind, id)
      ) {
        return;
      }
      const config = this.priceLineDragConfigs.get(kind);
      const meta = config?.metaById.get(id);
      if (!config || !meta || meta.editable === false) return;
      this.draggingPriceLine = { kind, id, pointerId: e.pointerId };
      this.setChartPointerInteractions(false);
      this.container.style.cursor = "ns-resize";
      handle.classList.add("is-dragging");
      handle.setPointerCapture?.(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (
        press &&
        press.pointerId === e.pointerId &&
        (Math.abs(e.clientX - press.x) > TAP_PX ||
          Math.abs(e.clientY - press.y) > TAP_PX)
      ) {
        press.moved = true;
      }
      const drag = this.draggingPriceLine;
      if (drag !== undefined) {
        if (drag.pointerId !== e.pointerId) return;
        const config = this.priceLineDragConfigs.get(drag.kind);
        const price = this.priceAtLineDragY(this.localChartY(e.clientY), config);
        if (price === undefined || config === undefined) return;
        const meta = config.metaById.get(drag.id);
        const existing = config.linesById.get(drag.id);
        if (meta && existing) {
          meta.price = price;
          existing.applyOptions({ price });
          this.positionSelectedPriceLineHandles();
        }
        config.handlers.onPreview?.(drag.id, price);
        e.preventDefault();
        return;
      }
      this.positionSelectedPriceLineHandles();
      this.container.style.cursor =
        this.lineSelectionNearY(this.localChartY(e.clientY)) !== undefined
          ? "pointer"
          : "";
    };

    const onPointerUp = (e: PointerEvent) => {
      const drag = this.draggingPriceLine;
      if (drag !== undefined && drag.pointerId === e.pointerId) {
        this.endSelectedPriceLineDrag(e);
        return;
      }
      if (press === undefined || press.pointerId !== e.pointerId) return;
      const tap = press;
      press = undefined;
      if (tap.moved) return;
      const hit = this.lineSelectionNearY(this.localChartY(e.clientY));
      if (hit === undefined) {
        this.clearSelectedPriceLine();
      } else {
        this.selectPriceLine(hit.kind, hit.id);
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onPointerCancel = (e: PointerEvent) => {
      press = undefined;
      if (
        this.draggingPriceLine !== undefined &&
        this.draggingPriceLine.pointerId === e.pointerId
      ) {
        this.endSelectedPriceLineDrag(e);
      }
    };

    this.container.addEventListener("pointerdown", onContainerPointerDown);
    this.container.addEventListener("pointermove", onPointerMove);
    this.container.addEventListener("pointerup", onPointerUp);
    this.container.addEventListener("pointercancel", onPointerCancel);
    this.container.addEventListener("pointerdown", onHandlePointerDown, true);
    this.disposePriceLineDragListeners = () => {
      this.container.removeEventListener("pointerdown", onContainerPointerDown);
      this.container.removeEventListener("pointermove", onPointerMove);
      this.container.removeEventListener("pointerup", onPointerUp);
      this.container.removeEventListener("pointercancel", onPointerCancel);
      this.container.removeEventListener("pointerdown", onHandlePointerDown, true);
      this.draggingPriceLine = undefined;
      press = undefined;
      this.setChartPointerInteractions(true);
      this.container.style.cursor = "";
      this.hideAllPriceLineHandles();
    };
  }

  private localChartY(clientY: number): number {
    return clientY - this.container.getBoundingClientRect().top;
  }

  private isInCandlePane(y: number): boolean {
    const { height } = this.chart.paneSize(0);
    return y >= 0 && y <= height;
  }

  private lineSelectionNearY(
    y: number,
  ): { kind: PriceLineDragKind; id: string } | undefined {
    if (!this.isInCandlePane(y)) return undefined;
    const HIT_PX = 10;
    let best: { kind: PriceLineDragKind; id: string } | undefined;
    let bestDist = HIT_PX;
    const kinds: PriceLineDragKind[] = ["order", "alert"];
    for (const kind of kinds) {
      const config = this.priceLineDragConfigs.get(kind);
      if (config === undefined) continue;
      for (const [id, meta] of config.metaById) {
        if (kind !== "order" && meta.editable === false) continue;
        const lineY = this.candleSeries.priceToCoordinate(meta.price);
        if (lineY === null) continue;
        const dist = Math.abs((lineY as number) - y);
        if (dist <= bestDist) {
          bestDist = dist;
          best = { kind, id };
        }
      }
    }
    return best;
  }

  private priceAtLineDragY(
    y: number,
    config: PriceLineDragConfig | undefined,
  ): number | undefined {
    if (config === undefined || !this.isInCandlePane(y)) return undefined;
    const price = this.candleSeries.coordinateToPrice(y);
    if (price === null) return undefined;
    const raw = price as number;
    return config.handlers.snap ? config.handlers.snap(raw) : raw;
  }

  private setChartPointerInteractions(enabled: boolean): void {
    this.chart.applyOptions({
      handleScroll: enabled,
      handleScale: enabled,
    });
  }

  private isPriceLineSelected(kind: PriceLineDragKind, id: string): boolean {
    const selected = this.selectedPriceLine;
    if (selected === undefined || selected.kind !== kind) return false;
    if (kind === "alert") {
      return selected.kind === "alert" && selected.id === id;
    }
    const meta = this.orderLineMeta.get(id);
    return (
      selected.kind === "order" &&
      meta !== undefined &&
      meta.orderId === selected.orderId
    );
  }

  private selectPriceLine(kind: PriceLineDragKind, id: string): void {
    if (this.isPriceLineSelected(kind, id)) {
      this.positionSelectedPriceLineHandles();
      return;
    }
    this.clearSelectedPriceLine();
    if (kind === "order") {
      const meta = this.orderLineMeta.get(id);
      if (meta === undefined) return;
      this.selectedPriceLine = { kind: "order", orderId: meta.orderId };
      this.setOrderGroupSelectionStyle(meta.orderId, true);
    } else {
      this.selectedPriceLine = { kind: "alert", id };
      this.applyPriceLineSelectionStyle(kind, id, true);
    }
    this.positionSelectedPriceLineHandles();
  }

  getSelectedPriceLine(): PriceLineSelection | undefined {
    return this.selectedPriceLine === undefined
      ? undefined
      : { ...this.selectedPriceLine };
  }

  clearSelectedPriceLine(commitPending = true): void {
    const selected = this.selectedPriceLine;
    if (commitPending && selected?.kind === "order") {
      this.flushPendingOrderLineCommits(selected.orderId);
    }
    if (selected !== undefined) {
      if (selected.kind === "order") {
        this.setOrderGroupSelectionStyle(selected.orderId, false);
      } else {
        this.applyPriceLineSelectionStyle(selected.kind, selected.id, false);
      }
    }
    this.selectedPriceLine = undefined;
    this.draggingPriceLine = undefined;
    this.hideAllPriceLineHandles();
  }

  private applyPriceLineSelectionStyle(
    kind: PriceLineDragKind,
    id: string,
    selected: boolean,
  ): void {
    const config = this.priceLineDragConfigs.get(kind);
    const line = config?.linesById.get(id);
    if (line === undefined) return;
    line.applyOptions({
      lineWidth: (selected ? (kind === "order" ? 2 : 3) : 1) as
        | 1
        | 2
        | 3,
    });
  }

  private setOrderGroupSelectionStyle(orderId: string, selected: boolean): void {
    for (const [id, meta] of this.orderLineMeta) {
      if (meta.orderId === orderId) {
        this.applyPriceLineSelectionStyle("order", id, selected);
      }
    }
  }

  private positionSelectedPriceLineHandles(): void {
    const selected = this.selectedPriceLine;
    if (selected === undefined) {
      this.hideAllPriceLineHandles();
      return;
    }
    const selectedHandles =
      selected.kind === "alert"
        ? [{ kind: "alert" as const, id: selected.id }]
        : [...this.orderLineMeta]
            .filter(([, meta]) =>
              meta.orderId === selected.orderId &&
              meta.editable !== false &&
              meta.field !== "entryGc"
            )
            .map(([id]) => ({ kind: "order" as const, id }));
    const activeHandleKeys = new Set<string>();
    for (const handleLine of selectedHandles) {
      const key = this.priceLineHandleKey(handleLine.kind, handleLine.id);
      const handle = this.ensurePriceLineHandle(handleLine.kind, handleLine.id);
      activeHandleKeys.add(key);
      this.positionPriceLineHandle(handle, handleLine.kind, handleLine.id);
    }
    for (const [key, handle] of this.priceLineDragHandles) {
      if (!activeHandleKeys.has(key)) {
        handle.hidden = true;
        handle.classList.remove("is-dragging");
      }
    }
  }

  private positionPriceLineHandle(
    handle: HTMLDivElement,
    kind: PriceLineDragKind,
    id: string,
  ): void {
    const config = this.priceLineDragConfigs.get(kind);
    const meta = config?.metaById.get(id);
    if (config === undefined || meta === undefined || meta.editable === false) {
      handle.hidden = true;
      return;
    }
    const y = this.candleSeries.priceToCoordinate(meta.price);
    if (y === null || !this.isInCandlePane(y as number)) {
      handle.hidden = true;
      return;
    }
    const pane = this.chart.paneSize(0);
    const x = Math.max(20, Math.round(pane.width / 2));
    handle.hidden = false;
    handle.style.left = `${x}px`;
    handle.style.top = `${Math.round(y as number)}px`;
    handle.style.setProperty("--price-line-handle-color", meta.color);
  }

  private endSelectedPriceLineDrag(e: PointerEvent): void {
    const drag = this.draggingPriceLine;
    if (drag === undefined) return;
    this.draggingPriceLine = undefined;
    this.setChartPointerInteractions(true);
    this.container.style.cursor = "";
    const handle = this.priceLineDragHandles.get(
      this.priceLineHandleKey(drag.kind, drag.id),
    );
    handle?.classList.remove("is-dragging");
    handle?.releasePointerCapture?.(e.pointerId);
    const config = this.priceLineDragConfigs.get(drag.kind);
    const meta = config?.metaById.get(drag.id);
    if (meta !== undefined) {
      if (drag.kind === "order") {
        if (config?.handlers.onCommitBatch) {
          config.handlers.onCommitBatch([{ id: drag.id, price: meta.price }]);
        } else {
          config?.handlers.onCommit?.(drag.id, meta.price);
        }
      } else {
        config?.handlers.onCommit?.(drag.id, meta.price);
      }
    }
  }

  private priceLineHandleKey(kind: PriceLineDragKind, id: string): string {
    return `${kind}:${id}`;
  }

  private ensurePriceLineHandle(
    kind: PriceLineDragKind,
    id: string,
  ): HTMLDivElement {
    const key = this.priceLineHandleKey(kind, id);
    const existing = this.priceLineDragHandles.get(key);
    if (existing !== undefined) return existing;
    const handle = document.createElement("div");
    handle.className = "price-line-drag-handle";
    handle.setAttribute("aria-label", "Drag selected price line");
    handle.dataset.kind = kind;
    handle.dataset.lineId = id;
    handle.hidden = true;
    this.container.appendChild(handle);
    this.priceLineDragHandles.set(key, handle);
    return handle;
  }

  private priceLineHandleFromEventTarget(
    target: EventTarget | null,
  ): HTMLDivElement | undefined {
    if (!(target instanceof HTMLElement)) return undefined;
    const handle = target.closest(".price-line-drag-handle");
    return handle instanceof HTMLDivElement &&
      this.container.contains(handle)
      ? handle
      : undefined;
  }

  private hideAllPriceLineHandles(): void {
    for (const handle of this.priceLineDragHandles.values()) {
      handle.hidden = true;
      handle.classList.remove("is-dragging");
    }
  }

  private flushPendingOrderLineCommits(orderId: string): void {
    const config = this.priceLineDragConfigs.get("order");
    if (config === undefined) {
      this.pendingOrderLineCommits.clear();
      return;
    }
    const updates: { id: string; price: number }[] = [];
    for (const [id, price] of [...this.pendingOrderLineCommits]) {
      const meta = this.orderLineMeta.get(id);
      if (meta?.orderId !== orderId) continue;
      this.pendingOrderLineCommits.delete(id);
      updates.push({ id, price });
    }
    if (updates.length === 0) return;
    if (config.handlers.onCommitBatch) {
      config.handlers.onCommitBatch(updates);
      return;
    }
    for (const update of updates) {
      config.handlers.onCommit?.(update.id, update.price);
    }
  }

  private renderSessionMarkers(): void {
    const markers: SeriesMarker<Time>[] = [];
    for (const bar of this.candleBars) {
      const hour = utcPlus7SessionHighlightHour(
        bar.time,
        this.displayTimeOffsetMs,
      );
      if (hour === undefined) continue;
      markers.push({
        time: toUtcTimestamp(bar.time, this.displayTimeOffsetMs),
        position: hour === 8 ? "aboveBar" : "belowBar",
        shape: "circle",
        color: SESSION_HIGHLIGHT_LINE_COLOR,
        id: `session:${hour}:${bar.time}`,
        size: 1.35,
      });
    }
    this.sessionMarkers.setMarkers(markers);
  }

  private renderBigTradeMarkers(): void {
    const markers = [...this.bigTradesByKey.values()].sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time;
      if ((a.tradeId ?? 0) !== (b.tradeId ?? 0)) {
        return (a.tradeId ?? 0) - (b.tradeId ?? 0);
      }
      return a.side.localeCompare(b.side);
    });
    const maxVolume = markers.reduce((max, marker) => Math.max(max, marker.volume), 0);
    const bubbleMarkers: RenderableBigTradeBubble[] = markers.map((marker) => {
      const isBuy = marker.side === "buy";
      return {
        id: bigTradeKey(marker),
        time: toBarDisplayTimestamp(
          marker.time,
          this.barCountdownDurationMs,
          this.displayTimeOffsetMs,
        ),
        price: marker.price,
        volume: marker.volume,
        side: marker.side,
        radius: bubbleRadius(marker.volume, maxVolume, 13, 30),
        fill: isBuy ? BIG_TRADE_BUY_FILL : BIG_TRADE_SELL_FILL,
        stroke: isBuy ? BIG_TRADE_BUY_STROKE : BIG_TRADE_SELL_STROKE,
      };
    });
    this.bigTradePrimitive?.setMarkers(bubbleMarkers);
  }

  private renderSmcAiSignals(): void {
    const markers: SeriesMarker<Time>[] = this.smcAiSignals
      .slice()
      .sort((a, b) => a.time - b.time || a.id.localeCompare(b.id))
      .map((marker) => {
        const isLong = marker.side === "long";
        const outcome =
          marker.outcome === "win"
            ? " W"
            : marker.outcome === "loss"
              ? " L"
              : "";
        return {
          time: toUtcTimestamp(marker.time, this.displayTimeOffsetMs),
          position: isLong ? "belowBar" : "aboveBar",
          shape: isLong ? "arrowUp" : "arrowDown",
          color: isLong ? SMC_AI_LONG_COLOR : SMC_AI_SHORT_COLOR,
          id: marker.id,
          text: `${marker.text ?? (isLong ? "AI L" : "AI S")}${outcome}`,
          size: 1.35,
        };
      });
    this.smcAiSignalMarkers.setMarkers(markers);
  }

  private renderAlertSignals(): void {
    const markers: SeriesMarker<Time>[] = this.alertSignals
      .slice()
      .sort((a, b) => a.time - b.time || a.id.localeCompare(b.id))
      .map((marker) => {
        const isLong = marker.direction > 0;
        return {
          time: toUtcTimestamp(marker.time, this.displayTimeOffsetMs),
          position: isLong ? "belowBar" : "aboveBar",
          shape: isLong ? "arrowUp" : "arrowDown",
          color: isLong ? "#00b8a9" : "#ff3131",
          id: marker.id,
          text: marker.text ?? (isLong ? "Break L" : "Break S"),
          size: 1.45,
        };
      });
    this.alertSignalMarkers.setMarkers(markers);
  }

  private renderSmcOverlay(): void {
    const markerTextColor = chartContrastPalette(this.chartBackgroundColor).text;
    const markers: SeriesMarker<Time>[] = this.smcOverlay.markers
      .filter((marker) => marker.kind !== "bos" && marker.kind !== "choch")
      .map((marker) => ({
        time: toUtcTimestamp(marker.time, this.displayTimeOffsetMs),
        position: marker.direction === 1 ? "aboveBar" : "belowBar",
        shape: "circle",
        color: smcMarkerColor(marker, markerTextColor),
        id: marker.id,
        text: marker.label,
        size: marker.scope === "internal" ? 0.85 : 1,
      }));
    this.smcMarkers.setMarkers(markers);

    const zones: RenderableSmcZone[] = this.smcOverlay.zones.map(
      ({ startTime, endTime, ...zone }) => ({
        ...zone,
        startTime: toUtcTimestamp(startTime, this.displayTimeOffsetMs),
        ...(endTime !== undefined
          ? {
              endTime: toUtcTimestamp(
                endTime,
                this.displayTimeOffsetMs,
              ) as UTCTimestamp,
            }
          : {}),
      }),
    );
    const lines: RenderableSmcLine[] = this.smcOverlay.lines.map((line) => ({
      ...line,
      startTime: toUtcTimestamp(line.startTime, this.displayTimeOffsetMs),
      endTime: toUtcTimestamp(line.endTime, this.displayTimeOffsetMs),
      labelTime: toUtcTimestamp(line.labelTime, this.displayTimeOffsetMs),
    }));
    if (zones.length === 0 && lines.length === 0) {
      if (this.smcPrimitive !== undefined) {
        this.candleSeries.detachPrimitive(
          this.smcPrimitive as unknown as Parameters<
            typeof this.candleSeries.detachPrimitive
          >[0],
        );
        this.smcPrimitive = undefined;
      }
      return;
    }

    if (this.smcPrimitive === undefined) {
      this.smcPrimitive = new SmcOverlayPrimitive(zones, lines);
      this.candleSeries.attachPrimitive(
        this.smcPrimitive as unknown as Parameters<
          typeof this.candleSeries.attachPrimitive
        >[0],
      );
    } else {
      this.smcPrimitive.setOverlay(zones, lines);
    }
  }

  /**
   * Subscribe to crosshair moves, invoking `handler` with the OHLCV bar under
   * the crosshair (or `undefined` when the crosshair leaves the series). Used
   * by the live ChartContainer to drive the CrosshairBox (Req 19.5). Returns an
   * unsubscribe disposer.
   */
  subscribeCrosshair(handler: (bar: Bar | undefined) => void): () => void {
    const listener = (param: MouseEventParams) => {
      const point = param.seriesData.get(this.candleSeries) as
        | CandlestickData
        | undefined;
      if (param.time === undefined || point === undefined) {
        handler(undefined);
        return;
      }
      const displayTime = param.time as number;
      const source = this.barsByTime.get(displayTime);
      handler({
        time: source?.time ?? displayTime * 1000 - this.displayTimeOffsetMs,
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
        volume: source?.volume ?? 0,
      });
    };
    this.chart.subscribeCrosshairMove(listener);
    return () => this.chart.unsubscribeCrosshairMove(listener);
  }

  /**
   * Subscribe to a right-click / long-press on the chart, invoking `handler`
   * with the price under the pointer and the local pointer coordinates (so the
   * caller can position a menu). Mirrors TradingView's "Add alert at {price}"
   * affordance (Req 16.5). Returns an unsubscribe disposer.
   *
   * Both a native `contextmenu` (right-click) and a ~500ms long-press of the
   * primary button trigger the handler; the long-press is cancelled by any
   * pointer movement beyond a small threshold or an early release.
   */
  subscribeContextMenu(
    handler: (info: { price: number; x: number; y: number }) => void,
  ): () => void {
    const priceAt = (clientX: number, clientY: number) => {
      const rect = this.container.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const { height } = this.chart.paneSize(0);
      if (y < 0 || y > height) return null;
      const price = this.candleSeries.coordinateToPrice(y);
      if (price === null) return null;
      return { price: price as number, x, y };
    };

    const onContextMenu = (e: MouseEvent) => {
      const info = priceAt(e.clientX, e.clientY);
      if (info === null) return;
      e.preventDefault();
      handler(info);
    };

    // Long-press (hold left button) support.
    let pressTimer: number | undefined;
    let startX = 0;
    let startY = 0;
    const clearPress = () => {
      if (pressTimer !== undefined) {
        window.clearTimeout(pressTimer);
        pressTimer = undefined;
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return; // primary button only
      startX = e.clientX;
      startY = e.clientY;
      clearPress();
      pressTimer = window.setTimeout(() => {
        const info = priceAt(startX, startY);
        if (info !== null) handler(info);
      }, 500);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (pressTimer === undefined) return;
      if (Math.abs(e.clientX - startX) > 6 || Math.abs(e.clientY - startY) > 6) {
        clearPress();
      }
    };

    this.container.addEventListener("contextmenu", onContextMenu);
    this.container.addEventListener("pointerdown", onPointerDown);
    this.container.addEventListener("pointermove", onPointerMove);
    this.container.addEventListener("pointerup", clearPress);
    this.container.addEventListener("pointercancel", clearPress);
    this.container.addEventListener("pointerleave", clearPress);
    return () => {
      clearPress();
      this.container.removeEventListener("contextmenu", onContextMenu);
      this.container.removeEventListener("pointerdown", onPointerDown);
      this.container.removeEventListener("pointermove", onPointerMove);
      this.container.removeEventListener("pointerup", clearPress);
      this.container.removeEventListener("pointercancel", clearPress);
      this.container.removeEventListener("pointerleave", clearPress);
    };
  }

  /** Release the chart instance and its DOM. */
  dispose(): void {
    if (this.barCountdownTimer !== undefined) {
      window.clearInterval(this.barCountdownTimer);
      this.barCountdownTimer = undefined;
    }
    this.disposePriceLineDragListeners?.();
    this.disposePriceLineDragListeners = undefined;
    for (const handle of this.priceLineDragHandles.values()) {
      handle.remove();
    }
    this.priceLineDragHandles.clear();
    this.barCountdownElement.remove();
    if (this.smcPrimitive !== undefined) {
      this.candleSeries.detachPrimitive(
        this.smcPrimitive as unknown as Parameters<
          typeof this.candleSeries.detachPrimitive
        >[0],
      );
      this.smcPrimitive = undefined;
    }
    if (this.bigTradePrimitive !== undefined) {
      this.candleSeries.detachPrimitive(
        this.bigTradePrimitive as unknown as Parameters<
          typeof this.candleSeries.detachPrimitive
        >[0],
      );
      this.bigTradePrimitive = undefined;
    }
    if (this.sessionVolumeProfilePrimitive !== undefined) {
      this.candleSeries.detachPrimitive(
        this.sessionVolumeProfilePrimitive as unknown as Parameters<
          typeof this.candleSeries.detachPrimitive
        >[0],
      );
      this.sessionVolumeProfilePrimitive = undefined;
    }
    this.smcMarkers.detach();
    this.smcAiSignalMarkers.detach();
    this.alertSignalMarkers.detach();
    this.sessionMarkers.detach();
    this.chart.remove();
  }
}
