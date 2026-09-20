// GC Push Momentum -- pure, deterministic indicator math.
//
// The histogram measures multi-bar log return in units of volatility known
// before each return.  Order-flow is deliberately kept as confirmation
// metadata instead of being mixed into the price score.

import { type Bar } from "../cache/types";

export interface GcPushMomentumSettings {
  /** Number of returns in the price-push and order-flow horizons. */
  horizonBars: number;
  /** Length of each of the two non-overlapping acceleration windows. */
  accelerationBars: number;
  /** Half-life of the lagged EWMA return variance. */
  volatilityHalfLifeBars: number;
  /** Number of price steps used by path efficiency. */
  efficiencyLookbackBars: number;
  /** Return observations required after a reset before emitting points. */
  warmupBars: number;
  /** Maximum number of prior valid observations used by percentiles. */
  percentileLookbackBars: number;
  /** Quantile of prior absolute push values used for `strong`. */
  strongPercentile: number;
  /** Quantile of prior absolute flow ratios used to qualify flow. */
  flowPercentile: number;
  /** Minimum current/prior-median horizon volume for flow qualification. */
  minParticipationRatio: number;
  /** Expected source-bar duration in milliseconds. */
  barDurationMs: number;
  /** A larger timestamp jump starts a fresh, independent segment. */
  gapMultiplier: number;
  /** Positive numerical floor used only to prevent undefined divisions. */
  epsilon: number;
}

export const DEFAULT_GC_PUSH_MOMENTUM_SETTINGS: GcPushMomentumSettings = {
  horizonBars: 3,
  accelerationBars: 2,
  volatilityHalfLifeBars: 60,
  efficiencyLookbackBars: 10,
  warmupBars: 120,
  percentileLookbackBars: 300,
  strongPercentile: 0.9,
  flowPercentile: 0.6,
  minParticipationRatio: 0.75,
  barDurationMs: 60_000,
  gapMultiplier: 1.5,
  epsilon: 1e-12,
};

export interface GcPushMomentumDelta {
  /** Bar bucket-start timestamp in milliseconds. */
  time: number;
  /** Exact delta-row volume for this bucket (not candle volume). */
  volume: number;
  /** Executed buy volume minus executed sell volume. */
  delta: number;
}

export type GcPushMomentumFlowState =
  | "confirmed"
  | "conflict"
  | "neutral"
  | "unavailable";

export interface GcPushMomentumPoint {
  time: number;
  push: number;
  acceleration: number;
  efficiency: number;
  flowRatio?: number;
  participationRatio?: number;
  strongThreshold?: number;
  strong: boolean;
  flowState: GcPushMomentumFlowState;
  absorptionCandidate: boolean;
}

function finiteOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

function normalizedInteger(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const candidate = Math.round(finiteOr(value, fallback));
  return Math.min(maximum, Math.max(minimum, candidate));
}

function normalizedNumber(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const candidate = finiteOr(value, fallback);
  return Math.min(maximum, Math.max(minimum, candidate));
}

/**
 * Sanitize persisted/user settings into bounded values safe for calculation.
 * Percentiles use fractional notation (`0.9`, not `90`).
 */
export function normalizeGcPushMomentumSettings(
  settings?: Partial<GcPushMomentumSettings>,
): GcPushMomentumSettings {
  const defaults = DEFAULT_GC_PUSH_MOMENTUM_SETTINGS;
  return {
    horizonBars: normalizedInteger(
      settings?.horizonBars,
      defaults.horizonBars,
      1,
      10_000,
    ),
    accelerationBars: normalizedInteger(
      settings?.accelerationBars,
      defaults.accelerationBars,
      1,
      10_000,
    ),
    volatilityHalfLifeBars: normalizedNumber(
      settings?.volatilityHalfLifeBars,
      defaults.volatilityHalfLifeBars,
      1,
      1_000_000,
    ),
    efficiencyLookbackBars: normalizedInteger(
      settings?.efficiencyLookbackBars,
      defaults.efficiencyLookbackBars,
      1,
      100_000,
    ),
    warmupBars: normalizedInteger(
      settings?.warmupBars,
      defaults.warmupBars,
      1,
      1_000_000,
    ),
    percentileLookbackBars: normalizedInteger(
      settings?.percentileLookbackBars,
      defaults.percentileLookbackBars,
      1,
      100_000,
    ),
    strongPercentile: normalizedNumber(
      settings?.strongPercentile,
      defaults.strongPercentile,
      0,
      1,
    ),
    flowPercentile: normalizedNumber(
      settings?.flowPercentile,
      defaults.flowPercentile,
      0,
      1,
    ),
    minParticipationRatio: normalizedNumber(
      settings?.minParticipationRatio,
      defaults.minParticipationRatio,
      0,
      1_000_000,
    ),
    barDurationMs: normalizedInteger(
      settings?.barDurationMs,
      defaults.barDurationMs,
      1,
      Number.MAX_SAFE_INTEGER,
    ),
    gapMultiplier: normalizedNumber(
      settings?.gapMultiplier,
      defaults.gapMultiplier,
      1,
      1_000_000,
    ),
    epsilon: normalizedNumber(
      settings?.epsilon,
      defaults.epsilon,
      Number.MIN_VALUE,
      1,
    ),
  };
}

/**
 * Fixed-size FIFO with a second, sorted view for O(1) quantile reads.
 *
 * The previous implementation copied and sorted up to 300 observations for
 * every emitted bar (three times per bar). That work dominated Replay entry
 * and fast playback. Insertion/removal is O(n), but happens once per value and
 * keeps the hot quantile path allocation-free while preserving interpolation.
 */
class RollingQuantiles {
  private readonly fifo: number[] = [];
  private readonly sorted: number[] = [];

  constructor(private readonly maximum: number) {}

  clear(): void {
    this.fifo.length = 0;
    this.sorted.length = 0;
  }

  quantile(percentile: number): number | undefined {
    if (this.sorted.length === 0) return undefined;
    if (this.sorted.length === 1) return this.sorted[0];
    const position = percentile * (this.sorted.length - 1);
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.ceil(position);
    const lower = this.sorted[lowerIndex];
    const upper = this.sorted[upperIndex];
    return lower + (upper - lower) * (position - lowerIndex);
  }

  push(value: number): void {
    this.fifo.push(value);
    const insertAt = this.lowerBound(value);
    this.sorted.splice(insertAt, 0, value);
    if (this.fifo.length <= this.maximum) return;

    const removed = this.fifo.shift();
    if (removed === undefined) return;
    const removeAt = this.lowerBound(removed);
    if (removeAt < this.sorted.length) this.sorted.splice(removeAt, 1);
  }

  private lowerBound(value: number): number {
    let low = 0;
    let high = this.sorted.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (this.sorted[middle] < value) low = middle + 1;
      else high = middle;
    }
    return low;
  }
}

function finitePositiveClose(bar: Bar): boolean {
  return Number.isFinite(bar.close) && bar.close > 0;
}

/** Last input occurrence wins, then bars are processed in timestamp order. */
function normalizedBars(bars: readonly Bar[]): Bar[] {
  const byTime = new Map<number, Bar>();
  for (const bar of bars) {
    if (Number.isFinite(bar.time)) byTime.set(bar.time, bar);
  }
  return [...byTime.values()].sort((left, right) => left.time - right.time);
}

/** Last input occurrence wins, including an invalid update becoming unavailable. */
function deltaByTime(
  deltas: readonly GcPushMomentumDelta[],
): Map<number, GcPushMomentumDelta> {
  const result = new Map<number, GcPushMomentumDelta>();
  for (const delta of deltas) {
    if (Number.isFinite(delta.time)) result.set(delta.time, delta);
  }
  return result;
}

function sumRange(values: readonly number[], from: number, to: number): number {
  let total = 0;
  for (let index = from; index <= to; index += 1) total += values[index];
  return total;
}

function pathEfficiency(
  returns: readonly number[],
  index: number,
  lookback: number,
  epsilon: number,
): number {
  const from = index - lookback + 1;
  let net = 0;
  let travelled = 0;
  for (let cursor = from; cursor <= index; cursor += 1) {
    net += returns[cursor];
    travelled += Math.abs(returns[cursor]);
  }
  if (!Number.isFinite(travelled) || travelled <= epsilon) return 0;
  const value = Math.abs(net) / travelled;
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

interface HorizonFlow {
  ratio: number;
  volume: number;
}

function horizonFlow(
  bars: readonly Bar[],
  deltas: ReadonlyMap<number, GcPushMomentumDelta>,
  from: number,
  to: number,
  epsilon: number,
): HorizonFlow | undefined {
  let totalDelta = 0;
  let totalVolume = 0;
  for (let index = from; index <= to; index += 1) {
    const value = deltas.get(bars[index].time);
    if (
      value === undefined ||
      !Number.isFinite(value.volume) ||
      value.volume < 0 ||
      !Number.isFinite(value.delta)
    ) {
      return undefined;
    }
    totalVolume += value.volume;
    totalDelta += value.delta;
  }
  if (
    !Number.isFinite(totalVolume) ||
    totalVolume <= epsilon ||
    !Number.isFinite(totalDelta)
  ) {
    return undefined;
  }
  const rawRatio = totalDelta / totalVolume;
  if (!Number.isFinite(rawRatio)) return undefined;
  return {
    ratio: Math.min(1, Math.max(-1, rawRatio)),
    volume: totalVolume,
  };
}

function finiteScore(numerator: number, variance: number, epsilon: number): number {
  const denominator = Math.sqrt(Math.max(0, variance) + epsilon);
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : 0;
}

/**
 * Calculate GC Push Momentum from OHLCV bars and exact-time delta rows.
 *
 * Results are stateless: replacing a live bar/delta and calling this function
 * again is equivalent to a fresh calculation. A gap larger than
 * `barDurationMs * gapMultiplier` starts a new contiguous price segment so no
 * return spans missing time. Once the model has warmed up, its lagged EWMA and
 * rolling thresholds are carried across the gap; only the structural
 * horizon/acceleration/efficiency lookbacks must refill.
 */
export function calculateGcPushMomentum(
  inputBars: readonly Bar[],
  deltas: readonly GcPushMomentumDelta[] = [],
  inputSettings?: Partial<GcPushMomentumSettings>,
): GcPushMomentumPoint[] {
  const settings = normalizeGcPushMomentumSettings(inputSettings);
  const bars = normalizedBars(inputBars);
  if (bars.length < 2) return [];

  const deltasByTime = deltaByTime(deltas);
  const returns = new Array<number>(bars.length).fill(0);
  const predictedVariances = new Array<number>(bars.length).fill(0);
  const output: GcPushMomentumPoint[] = [];
  const lambda = Math.exp(Math.log(0.5) / settings.volatilityHalfLifeBars);
  const gapLimit = settings.barDurationMs * settings.gapMultiplier;
  const structuralRequiredReturns = Math.max(
    settings.horizonBars,
    settings.accelerationBars * 2,
    settings.efficiencyLookbackBars,
  );
  const coldRequiredReturns = Math.max(
    settings.warmupBars,
    structuralRequiredReturns,
  );

  let segmentStart = 0;
  let ewmaVariance: number | undefined;
  const priorAbsPush = new RollingQuantiles(settings.percentileLookbackBars);
  const priorAbsFlow = new RollingQuantiles(settings.percentileLookbackBars);
  const priorHorizonVolume = new RollingQuantiles(settings.percentileLookbackBars);
  let warmed = false;

  const startSegmentAt = (index: number, preserveWarmedState: boolean): void => {
    segmentStart = index;
    if (!preserveWarmedState) {
      ewmaVariance = undefined;
      priorAbsPush.clear();
      priorAbsFlow.clear();
      priorHorizonVolume.clear();
      warmed = false;
    }
  };

  if (!finitePositiveClose(bars[0])) startSegmentAt(1, false);

  for (let index = 1; index < bars.length; index += 1) {
    const previous = bars[index - 1];
    const current = bars[index];
    const elapsed = current.time - previous.time;
    if (
      !finitePositiveClose(previous) ||
      !finitePositiveClose(current) ||
      !Number.isFinite(elapsed) ||
      elapsed <= 0 ||
      elapsed > gapLimit
    ) {
      startSegmentAt(
        finitePositiveClose(current) ? index : index + 1,
        warmed,
      );
      continue;
    }

    const currentReturn = Math.log(current.close) - Math.log(previous.close);
    if (!Number.isFinite(currentReturn)) {
      startSegmentAt(index + 1, warmed);
      continue;
    }

    // This prediction is recorded before currentReturn updates the estimator:
    // the current observation can never shrink or enlarge its own denominator.
    const predictedVariance = ewmaVariance ?? 0;
    returns[index] = currentReturn;
    predictedVariances[index] = predictedVariance;
    const squaredReturn = currentReturn * currentReturn;
    ewmaVariance =
      ewmaVariance === undefined
        ? squaredReturn
        : lambda * ewmaVariance + (1 - lambda) * squaredReturn;

    const returnCount = index - segmentStart;
    const requiredReturns = warmed
      ? structuralRequiredReturns
      : coldRequiredReturns;
    if (returnCount < requiredReturns) continue;
    warmed = true;

    const pushFrom = index - settings.horizonBars + 1;
    const pushNumerator = sumRange(returns, pushFrom, index);
    const pushVariance = sumRange(predictedVariances, pushFrom, index);
    const push = finiteScore(pushNumerator, pushVariance, settings.epsilon);

    const accelerationRecentFrom = index - settings.accelerationBars + 1;
    const accelerationPriorFrom = index - settings.accelerationBars * 2 + 1;
    const recent = sumRange(returns, accelerationRecentFrom, index);
    const prior = sumRange(
      returns,
      accelerationPriorFrom,
      accelerationRecentFrom - 1,
    );
    const accelerationVariance = sumRange(
      predictedVariances,
      accelerationPriorFrom,
      index,
    );
    const acceleration = finiteScore(
      recent - prior,
      accelerationVariance,
      settings.epsilon,
    );
    const efficiency = pathEfficiency(
      returns,
      index,
      settings.efficiencyLookbackBars,
      settings.epsilon,
    );

    // Thresholds are intentionally calculated before adding this observation.
    const strongThreshold = priorAbsPush.quantile(settings.strongPercentile);
    const strong =
      strongThreshold !== undefined &&
      Math.abs(push) > settings.epsilon &&
      Math.abs(push) >= Math.max(strongThreshold, settings.epsilon);
    const flow = horizonFlow(
      bars,
      deltasByTime,
      pushFrom,
      index,
      settings.epsilon,
    );

    let flowRatio: number | undefined;
    let participationRatio: number | undefined;
    let flowState: GcPushMomentumFlowState = "unavailable";
    let absorptionCandidate = false;

    if (flow !== undefined) {
      flowRatio = flow.ratio;
      const flowThreshold = priorAbsFlow.quantile(settings.flowPercentile);
      const medianVolume = priorHorizonVolume.quantile(0.5);
      if (medianVolume !== undefined && medianVolume > settings.epsilon) {
        const ratio = flow.volume / medianVolume;
        if (Number.isFinite(ratio)) participationRatio = ratio;
      }

      const qualifiedFlow =
        flowThreshold !== undefined &&
        participationRatio !== undefined &&
        participationRatio >= settings.minParticipationRatio &&
        Math.abs(flow.ratio) > settings.epsilon &&
        Math.abs(flow.ratio) >= flowThreshold;
      if (!qualifiedFlow || Math.abs(push) <= settings.epsilon) {
        flowState = "neutral";
      } else if (Math.sign(flow.ratio) === Math.sign(push)) {
        flowState = "confirmed";
      } else {
        flowState = "conflict";
      }

      // Strong executed imbalance without directional price progress is a
      // candidate only; it is not treated as an automatic reversal signal.
      absorptionCandidate =
        qualifiedFlow &&
        (flowState === "conflict" || (!strong && efficiency < 0.35));

      priorAbsFlow.push(Math.abs(flow.ratio));
      priorHorizonVolume.push(flow.volume);
    }

    const point: GcPushMomentumPoint = {
      time: current.time,
      push,
      acceleration,
      efficiency,
      strong,
      flowState,
      absorptionCandidate,
    };
    if (flowRatio !== undefined) point.flowRatio = flowRatio;
    if (participationRatio !== undefined) {
      point.participationRatio = participationRatio;
    }
    if (strongThreshold !== undefined) point.strongThreshold = strongThreshold;
    output.push(point);

    priorAbsPush.push(Math.abs(push));
  }

  return output;
}
