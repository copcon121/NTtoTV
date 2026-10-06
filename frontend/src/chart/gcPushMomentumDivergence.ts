// Confirmed three-pivot regular divergence for GC Push Momentum.
//
// Detection is deliberately causal: a price pivot is eligible only after its
// right-side confirmation bars are closed. The oscillator comparison uses the
// smoothed Push line, while the histogram remains an acceleration display.

import { type Bar } from "../cache/types";
import { type GcPushMomentumPoint } from "./gcPushMomentum";
import {
  MGANN_SWING_SIZE,
  collectMgannSwingPivots,
  type MgannSwingPivot,
} from "./mgannSwing";

const PIVOT_LEFT = 2;
const PIVOT_RIGHT = 2;
const MATCH_PUSH_WINDOW = 2;
const MIN_PIVOT_SPACING = 3;
const MAX_PIVOT_SPAN = 80;
const MIN_PRICE_SLOPE_ATR = 0.45;
const MIN_PUSH_SLOPE_RANGE = 0.35;
const MAX_VISIBLE = 20;
const LOOKBACK_BARS = 260;
const EARLY_LOOKBACK_BARS = 2_000;
const DEFAULT_EARLY_ATR_LENGTH = 14;
const DEFAULT_EARLY_MAX_PRICE_MISS_ATR = 0.5;
const DEFAULT_EARLY_MIN_DISPLACEMENT_ATR = 1;

export interface GcPushMomentumDivergencePivot {
  index: number;
  time: number;
  price: number;
  pushIndex: number;
  pushTime: number;
  pushValue: number;
}

export interface GcPushMomentumDivergence {
  id: string;
  /** 1 is regular bullish divergence; -1 is regular bearish divergence. */
  direction: 1 | -1;
  pricePivots: readonly [
    GcPushMomentumDivergencePivot,
    GcPushMomentumDivergencePivot,
    GcPushMomentumDivergencePivot,
  ];
  /** Time of the final right-side bar that made the third pivot immutable. */
  confirmedAt: number;
  score: number;
}

export interface GcPushMomentumEarlyDivergence {
  id: string;
  /** 1 is bullish structure/momentum weakening; -1 is bearish. */
  direction: 1 | -1;
  pricePivots: readonly [
    GcPushMomentumDivergencePivot,
    GcPushMomentumDivergencePivot,
  ];
  /** Opposite Swing-5 pivot between the two divergence pivots. */
  confirmationSwing: MgannSwingPivot;
  /** Bar whose extreme broke the confirmation swing after the setup was known. */
  confirmedAt: number;
  /** Low for bearish signals and high for bullish signals on the break bar. */
  confirmationPrice: number;
  /** Peak-to-break displacement divided by ATR fixed at the second pivot. */
  displacementAtr: number;
  /** True when only the wick, rather than the close, crossed the swing. */
  breakByWick: boolean;
  score: number;
}

export interface GcPushMomentumEarlyDivergenceOptions {
  atrLength?: number;
  /** Maximum ATR distance that the second pivot may fall short of the first. */
  maxPriceMissAtr?: number;
  minDisplacementAtr?: number;
}

function averageTrueRange(bars: readonly Bar[], from: number, to: number): number {
  let total = 0;
  let count = 0;
  for (
    let index = Math.max(0, from);
    index <= Math.min(to, bars.length - 1);
    index += 1
  ) {
    const bar = bars[index];
    const previous = bars[index - 1];
    const previousClose = previous?.close ?? bar.close;
    const trueRange = Math.max(
      bar.high - bar.low,
      Math.abs(bar.high - previousClose),
      Math.abs(bar.low - previousClose),
    );
    if (Number.isFinite(trueRange) && trueRange > 0) {
      total += trueRange;
      count += 1;
    }
  }
  return count > 0 ? total / count : 1;
}

function pushRange(
  values: readonly (number | undefined)[],
  from: number,
  to: number,
): number {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (
    let index = Math.max(0, from);
    index <= Math.min(to, values.length - 1);
    index += 1
  ) {
    const value = values[index];
    if (value === undefined || !Number.isFinite(value)) continue;
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  const range = maximum - minimum;
  return Number.isFinite(range) && range > 0 ? range : 1;
}

function isConfirmedWindow(
  bars: readonly Bar[],
  index: number,
  closedBarTimes: ReadonlySet<number>,
): boolean {
  const from = index - PIVOT_LEFT;
  const to = index + Math.max(PIVOT_RIGHT, MATCH_PUSH_WINDOW);
  if (from < 0 || to >= bars.length) return false;
  for (let cursor = from; cursor <= to; cursor += 1) {
    if (!closedBarTimes.has(bars[cursor].time)) return false;
  }
  return true;
}

function isPricePivot(
  bars: readonly Bar[],
  index: number,
  kind: "high" | "low",
): boolean {
  const value = kind === "high" ? bars[index].high : bars[index].low;
  if (!Number.isFinite(value)) return false;
  for (let offset = 1; offset <= PIVOT_LEFT; offset += 1) {
    const neighbor = kind === "high"
      ? bars[index - offset].high
      : bars[index - offset].low;
    if (kind === "high" ? value <= neighbor : value >= neighbor) return false;
  }
  for (let offset = 1; offset <= PIVOT_RIGHT; offset += 1) {
    const neighbor = kind === "high"
      ? bars[index + offset].high
      : bars[index + offset].low;
    if (kind === "high" ? value <= neighbor : value >= neighbor) return false;
  }
  return true;
}

function matchedPushPivot(
  bars: readonly Bar[],
  pushValues: readonly (number | undefined)[],
  index: number,
  kind: "high" | "low",
): { index: number; time: number; value: number } | undefined {
  const from = Math.max(0, index - MATCH_PUSH_WINDOW);
  const to = Math.min(pushValues.length - 1, index + MATCH_PUSH_WINDOW);
  let bestIndex: number | undefined;
  let bestValue: number | undefined;
  for (let candidate = from; candidate <= to; candidate += 1) {
    const value = pushValues[candidate];
    if (value === undefined || !Number.isFinite(value)) continue;
    if (
      bestValue === undefined ||
      (kind === "high" ? value > bestValue : value < bestValue)
    ) {
      bestValue = value;
      bestIndex = candidate;
    }
  }
  if (bestIndex === undefined || bestValue === undefined) return undefined;
  return { index: bestIndex, time: bars[bestIndex].time, value: bestValue };
}

function collectPivots(
  bars: readonly Bar[],
  pushValues: readonly (number | undefined)[],
  kind: "high" | "low",
  closedBarTimes: ReadonlySet<number>,
): GcPushMomentumDivergencePivot[] {
  const pivots: GcPushMomentumDivergencePivot[] = [];
  for (let index = PIVOT_LEFT; index < bars.length - PIVOT_RIGHT; index += 1) {
    if (
      !isConfirmedWindow(bars, index, closedBarTimes) ||
      !isPricePivot(bars, index, kind)
    ) {
      continue;
    }
    const push = matchedPushPivot(bars, pushValues, index, kind);
    if (push === undefined) continue;
    pivots.push({
      index,
      time: bars[index].time,
      price: kind === "high" ? bars[index].high : bars[index].low,
      pushIndex: push.index,
      pushTime: push.time,
      pushValue: push.value,
    });
  }
  return pivots;
}

function tripleScore(
  bars: readonly Bar[],
  pushValues: readonly (number | undefined)[],
  pivots: readonly [
    GcPushMomentumDivergencePivot,
    GcPushMomentumDivergencePivot,
    GcPushMomentumDivergencePivot,
  ],
  direction: 1 | -1,
): number | undefined {
  const [first, second, third] = pivots;
  if (
    second.index - first.index < MIN_PIVOT_SPACING ||
    third.index - second.index < MIN_PIVOT_SPACING ||
    third.index - first.index > MAX_PIVOT_SPAN ||
    !(first.pushIndex < second.pushIndex && second.pushIndex < third.pushIndex)
  ) {
    return undefined;
  }

  const priceDiverges = direction === -1
    ? first.price < second.price && second.price < third.price
    : first.price > second.price && second.price > third.price;
  const pushDiverges = direction === -1
    ? first.pushValue > second.pushValue && second.pushValue > third.pushValue
    : first.pushValue < second.pushValue && second.pushValue < third.pushValue;
  if (!priceDiverges || !pushDiverges) return undefined;

  const priceSlope =
    Math.abs(third.price - first.price) /
    averageTrueRange(bars, first.index, third.index);
  const oscillatorSlope =
    Math.abs(third.pushValue - first.pushValue) /
    pushRange(pushValues, first.pushIndex, third.pushIndex);
  if (
    priceSlope < MIN_PRICE_SLOPE_ATR ||
    oscillatorSlope < MIN_PUSH_SLOPE_RANGE
  ) {
    return undefined;
  }
  return priceSlope + oscillatorSlope;
}

function pairScore(
  bars: readonly Bar[],
  pushValues: readonly (number | undefined)[],
  pivots: readonly [
    GcPushMomentumDivergencePivot,
    GcPushMomentumDivergencePivot,
  ],
  direction: 1 | -1,
): number | undefined {
  const [first, second] = pivots;
  if (
    second.index - first.index < MIN_PIVOT_SPACING ||
    second.index - first.index > MAX_PIVOT_SPAN ||
    first.pushIndex >= second.pushIndex
  ) {
    return undefined;
  }

  const pushWeakens = direction === -1
    ? first.pushValue > second.pushValue
    : first.pushValue < second.pushValue;
  if (!pushWeakens) return undefined;

  const priceSlope =
    Math.abs(second.price - first.price) /
    averageTrueRange(bars, first.index, second.index);
  const oscillatorSlope =
    Math.abs(second.pushValue - first.pushValue) /
    pushRange(pushValues, first.pushIndex, second.pushIndex);
  return priceSlope + oscillatorSlope;
}

function latestInterveningSwing(
  swings: readonly MgannSwingPivot[],
  firstIndex: number,
  secondIndex: number,
  kind: "high" | "low",
): MgannSwingPivot | undefined {
  for (let index = swings.length - 1; index >= 0; index -= 1) {
    const swing = swings[index];
    if (swing.index >= secondIndex) continue;
    if (swing.index <= firstIndex) return undefined;
    if (swing.kind === kind) return swing;
  }
  return undefined;
}

function swingIsClosedAndConfirmed(
  bars: readonly Bar[],
  swing: MgannSwingPivot,
  closedBarTimes: ReadonlySet<number>,
): boolean {
  const confirmationIndex = swing.index + MGANN_SWING_SIZE;
  if (confirmationIndex >= bars.length) return false;
  for (let index = swing.index; index <= confirmationIndex; index += 1) {
    if (!closedBarTimes.has(bars[index].time)) return false;
  }
  return true;
}

interface DisplacementBreak {
  bar: Bar;
  price: number;
  displacementAtr: number;
  breakByWick: boolean;
}

function firstDisplacementBreak(
  bars: readonly Bar[],
  fromIndex: number,
  swing: MgannSwingPivot,
  secondPivot: GcPushMomentumDivergencePivot,
  direction: 1 | -1,
  closedBarTimes: ReadonlySet<number>,
  atrLength: number,
  minDisplacementAtr: number,
): DisplacementBreak | undefined {
  const referenceAtr = averageTrueRange(
    bars,
    secondPivot.index - atrLength + 1,
    secondPivot.index,
  );
  if (!Number.isFinite(referenceAtr) || referenceAtr <= 0) return undefined;

  for (let index = fromIndex; index < bars.length; index += 1) {
    const bar = bars[index];
    const liveLastBar = index === bars.length - 1;
    if (!closedBarTimes.has(bar.time) && !liveLastBar) continue;
    const breakPrice = direction === -1 ? bar.low : bar.high;
    const broken = direction === -1
      ? breakPrice < swing.price
      : breakPrice > swing.price;
    if (!broken) continue;

    const displacement = direction === -1
      ? secondPivot.price - breakPrice
      : breakPrice - secondPivot.price;
    const displacementAtr = displacement / referenceAtr;
    if (
      !Number.isFinite(displacementAtr) ||
      displacementAtr < minDisplacementAtr
    ) {
      continue;
    }
    const closeBroke = direction === -1
      ? bar.close < swing.price
      : bar.close > swing.price;
    return {
      bar,
      price: breakPrice,
      displacementAtr,
      breakByWick: !closeBroke,
    };
  }
  return undefined;
}

/**
 * Detect non-repainting regular divergence between price and smoothed Push.
 * Three consecutive confirmed price pivots are required to reduce M1/M5 noise.
 */
export function buildGcPushMomentumDivergences(
  inputBars: readonly Bar[],
  points: readonly GcPushMomentumPoint[],
  closedBarTimes: ReadonlySet<number>,
): GcPushMomentumDivergence[] {
  const bars = inputBars.length > LOOKBACK_BARS
    ? inputBars.slice(-LOOKBACK_BARS)
    : inputBars.slice();
  if (bars.length < PIVOT_LEFT + PIVOT_RIGHT + 3) return [];

  const pointByTime = new Map(points.map((point) => [point.time, point]));
  const pushValues = bars.map((bar) => pointByTime.get(bar.time)?.smoothedPush);
  const signals: GcPushMomentumDivergence[] = [];

  for (const [kind, direction] of [
    ["high", -1],
    ["low", 1],
  ] as const) {
    const pivots = collectPivots(bars, pushValues, kind, closedBarTimes);
    for (let index = 2; index < pivots.length; index += 1) {
      const triple = [
        pivots[index - 2],
        pivots[index - 1],
        pivots[index],
      ] as const;
      const score = tripleScore(bars, pushValues, triple, direction);
      if (score === undefined) continue;
      const confirmationBar = bars[triple[2].index + PIVOT_RIGHT];
      if (confirmationBar === undefined) continue;
      signals.push({
        id: `push-div:${direction}:${triple[0].time}:${triple[1].time}:${triple[2].time}`,
        direction,
        pricePivots: triple,
        confirmedAt: confirmationBar.time,
        score,
      });
    }
  }

  return signals
    .sort((left, right) => left.confirmedAt - right.confirmedAt)
    .slice(-MAX_VISIBLE);
}

/**
 * Detect two-pivot Push weakening and emit it after an ATR-qualified extreme
 * breaks the nearest intervening Swing-5 structure. The second price pivot is
 * allowed to fall slightly short of the first within an ATR proximity band.
 * Break scanning starts only after both pivots were already known, preventing
 * historical backpaint.
 */
export function buildGcPushMomentumEarlyDivergences(
  inputBars: readonly Bar[],
  points: readonly GcPushMomentumPoint[],
  closedBarTimes: ReadonlySet<number>,
  options: GcPushMomentumEarlyDivergenceOptions = {},
): GcPushMomentumEarlyDivergence[] {
  const bars = inputBars.length > EARLY_LOOKBACK_BARS
    ? inputBars.slice(-EARLY_LOOKBACK_BARS)
    : inputBars.slice();
  if (bars.length < MGANN_SWING_SIZE * 2 + 1) return [];

  const pointByTime = new Map(points.map((point) => [point.time, point]));
  const pushValues = bars.map((bar) => pointByTime.get(bar.time)?.smoothedPush);
  const swings = collectMgannSwingPivots(bars);
  const signals: GcPushMomentumEarlyDivergence[] = [];
  const requestedAtrLength = options.atrLength ?? DEFAULT_EARLY_ATR_LENGTH;
  const atrLength = Number.isFinite(requestedAtrLength)
    ? Math.max(1, Math.round(requestedAtrLength))
    : DEFAULT_EARLY_ATR_LENGTH;
  const requestedDisplacement =
    options.minDisplacementAtr ?? DEFAULT_EARLY_MIN_DISPLACEMENT_ATR;
  const minDisplacementAtr = Number.isFinite(requestedDisplacement)
    ? Math.max(0, requestedDisplacement)
    : DEFAULT_EARLY_MIN_DISPLACEMENT_ATR;
  const requestedPriceMiss =
    options.maxPriceMissAtr ?? DEFAULT_EARLY_MAX_PRICE_MISS_ATR;
  const maxPriceMissAtr = Number.isFinite(requestedPriceMiss)
    ? Math.max(0, requestedPriceMiss)
    : DEFAULT_EARLY_MAX_PRICE_MISS_ATR;

  for (const [kind, direction, confirmationKind] of [
    ["high", -1, "low"],
    ["low", 1, "high"],
  ] as const) {
    const pivots = collectPivots(bars, pushValues, kind, closedBarTimes);
    for (let index = 1; index < pivots.length; index += 1) {
      const pair = [pivots[index - 1], pivots[index]] as const;
      const score = pairScore(bars, pushValues, pair, direction);
      if (score === undefined) continue;

      const referenceAtr = averageTrueRange(
        bars,
        pair[1].index - atrLength + 1,
        pair[1].index,
      );
      if (!Number.isFinite(referenceAtr) || referenceAtr <= 0) continue;
      const priceMiss = direction === -1
        ? Math.max(0, pair[0].price - pair[1].price)
        : Math.max(0, pair[1].price - pair[0].price);
      if (priceMiss / referenceAtr > maxPriceMissAtr) continue;

      const swing = latestInterveningSwing(
        swings,
        pair[0].index,
        pair[1].index,
        confirmationKind,
      );
      if (
        swing === undefined ||
        !swingIsClosedAndConfirmed(bars, swing, closedBarTimes)
      ) {
        continue;
      }

      const setupKnownAt = Math.max(
        pair[1].index + PIVOT_RIGHT,
        swing.index + MGANN_SWING_SIZE,
      );
      const confirmation = firstDisplacementBreak(
        bars,
        setupKnownAt,
        swing,
        pair[1],
        direction,
        closedBarTimes,
        atrLength,
        minDisplacementAtr,
      );
      if (confirmation === undefined) continue;

      signals.push({
        id: `push-div-early:${direction}:${pair[0].time}:${pair[1].time}:${confirmation.bar.time}`,
        direction,
        pricePivots: pair,
        confirmationSwing: swing,
        confirmedAt: confirmation.bar.time,
        confirmationPrice: confirmation.price,
        displacementAtr: confirmation.displacementAtr,
        breakByWick: confirmation.breakByWick,
        score: score + confirmation.displacementAtr,
      });
    }
  }

  return signals
    .sort((left, right) => left.confirmedAt - right.confirmedAt)
    .slice(-MAX_VISIBLE);
}
