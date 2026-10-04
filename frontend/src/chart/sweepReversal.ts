import { type Bar } from "../cache/types";

export const SWEEP_REVERSAL_TIMEFRAMES = [
  "15s", "1m", "3m", "5m", "15m", "30m", "1h", "4h", "1D",
] as const;

export interface SweepReversalSettings {
  enabled: boolean;
  swingLength: number;
  atrLength: number;
  minPenetrationAtr: number;
  structureLength: number;
  maxConfirmationBars: number;
  minDisplacementAtr: number;
  equalSwingFilter: boolean;
  liquidityMinPivots: number;
  liquidityLookbackBars: number;
  liquidityAtrLength: number;
  liquidityAtrMargin: number;
  showDeveloping: boolean;
  confirmedExtension: number;
  maxHistory: number;
  zoneColor: string;
  levelColor: string;
}

export const DEFAULT_SWEEP_REVERSAL_SETTINGS: SweepReversalSettings = {
  enabled: false,
  swingLength: 5,
  atrLength: 14,
  minPenetrationAtr: 0,
  structureLength: 3,
  maxConfirmationBars: 12,
  minDisplacementAtr: 0.2,
  equalSwingFilter: false,
  liquidityMinPivots: 2,
  liquidityLookbackBars: 120,
  liquidityAtrLength: 10,
  liquidityAtrMargin: 4,
  showDeveloping: true,
  confirmedExtension: 2,
  maxHistory: 80,
  zoneColor: "#ff9f43",
  levelColor: "#7f1d1d",
};

export type SweepReversalDirection = 1 | -1;
export type SweepReversalPhase = "developing" | "confirmed";

export interface SweepReversalSetup {
  id: string;
  direction: SweepReversalDirection;
  phase: SweepReversalPhase;
  sweepTime: number;
  endTime: number;
  lineEndTime: number;
  level: number;
  extreme: number;
  confirmationLevel: number;
  pivotTimes: readonly number[];
  pivotPrices: readonly number[];
  confirmedTime?: number;
}

export interface SweepReversalLifecycleEvent {
  phase: "developing" | "confirmed" | "expired";
  time: number;
  direction: SweepReversalDirection;
  level: number;
  pivotCount: number;
}

export interface SweepReversalOverlay {
  setups: readonly SweepReversalSetup[];
  events: readonly SweepReversalLifecycleEvent[];
  zoneColor: string;
  levelColor: string;
}

interface Pivot {
  price: number;
  index: number;
  time: number;
}

interface Level {
  level: number;
  pivotIndices: readonly number[];
  pivotPrices: readonly number[];
  pivotTimes: readonly number[];
  available: boolean;
}

interface Pool {
  side: "buy" | "sell";
  top: number;
  bottom: number;
  pivotIndices: Set<number>;
  pivotPrices: readonly number[];
  pivotTimes: readonly number[];
  consumed: boolean;
}

interface Candidate {
  id: string;
  direction: SweepReversalDirection;
  startIndex: number;
  sweepTime: number;
  level: number;
  extreme: number;
  confirmationLevel: number;
  pivotTimes: readonly number[];
  pivotPrices: readonly number[];
  reclaimed: boolean;
}

class WilderAtr {
  private seed: number[] = [];
  value: number | undefined;

  constructor(private readonly period: number) {}

  update(trueRange: number): number | undefined {
    if (this.value === undefined) {
      this.seed.push(trueRange);
      if (this.seed.length === this.period) {
        this.value = this.seed.reduce((sum, item) => sum + item, 0) / this.period;
        this.seed = [];
      }
    } else {
      this.value += (trueRange - this.value) / this.period;
    }
    return this.value;
  }
}

function integer(value: unknown, fallback: number, minimum: number, maximum = Number.MAX_SAFE_INTEGER): number {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, Math.round(parsed)))
    : fallback;
}

function nonnegative(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function normalizeSweepReversalSettings(
  value?: Partial<SweepReversalSettings>,
): SweepReversalSettings {
  const defaults = DEFAULT_SWEEP_REVERSAL_SETTINGS;
  return {
    enabled: value?.enabled === true,
    swingLength: integer(value?.swingLength, defaults.swingLength, 2, 50),
    atrLength: integer(value?.atrLength, defaults.atrLength, 1),
    minPenetrationAtr: nonnegative(value?.minPenetrationAtr, defaults.minPenetrationAtr),
    structureLength: integer(value?.structureLength, defaults.structureLength, 1, 20),
    maxConfirmationBars: integer(value?.maxConfirmationBars, defaults.maxConfirmationBars, 1, 100),
    minDisplacementAtr: nonnegative(value?.minDisplacementAtr, defaults.minDisplacementAtr),
    equalSwingFilter: value?.equalSwingFilter === true,
    liquidityMinPivots: integer(value?.liquidityMinPivots, defaults.liquidityMinPivots, 2),
    liquidityLookbackBars: integer(value?.liquidityLookbackBars, defaults.liquidityLookbackBars, 1),
    liquidityAtrLength: integer(value?.liquidityAtrLength, defaults.liquidityAtrLength, 1),
    liquidityAtrMargin: nonnegative(value?.liquidityAtrMargin, defaults.liquidityAtrMargin),
    showDeveloping: value?.showDeveloping !== false,
    confirmedExtension: integer(value?.confirmedExtension, defaults.confirmedExtension, 0, 50),
    maxHistory: integer(value?.maxHistory, defaults.maxHistory, 1, 150),
    zoneColor: typeof value?.zoneColor === "string" ? value.zoneColor : defaults.zoneColor,
    levelColor: typeof value?.levelColor === "string" ? value.levelColor : defaults.levelColor,
  };
}

function inferredBarStep(bars: readonly Bar[]): number {
  for (let index = bars.length - 1; index > 0; index -= 1) {
    const delta = bars[index].time - bars[index - 1].time;
    if (delta > 0) return delta;
  }
  return 60_000;
}

/** Pure closed-bar reducer used by chart history, backfill and Bar Replay. */
export function reduceSweepReversal(
  inputBars: readonly Bar[],
  inputSettings?: Partial<SweepReversalSettings>,
): SweepReversalOverlay {
  const settings = normalizeSweepReversalSettings(inputSettings);
  if (!settings.enabled) {
    return { setups: [], events: [], zoneColor: settings.zoneColor, levelColor: settings.levelColor };
  }
  const bars = inputBars.slice(-10_000);
  const step = inferredBarStep(bars);
  const atr = new WilderAtr(settings.atrLength);
  const liquidityAtr = new WilderAtr(settings.liquidityAtrLength);
  const highs: Pivot[] = [];
  const lows: Pivot[] = [];
  const pools: Pool[] = [];
  const confirmed: SweepReversalSetup[] = [];
  const events: SweepReversalLifecycleEvent[] = [];
  let latestHigh: Level | undefined;
  let latestLow: Level | undefined;
  let bearish: Candidate | undefined;
  let bullish: Candidate | undefined;
  let previousClose: number | undefined;
  let currentAtr: number | undefined;
  let currentLiquidityAtr: number | undefined;
  let serial = 0;

  const registerPivot = (pivot: Pivot, side: "buy" | "sell", currentIndex: number) => {
    const history = side === "buy" ? highs : lows;
    history.push(pivot);
    const cutoff = currentIndex - settings.liquidityLookbackBars;
    while (history.length > 0 && history[0].index < cutoff) history.shift();
    if (!settings.equalSwingFilter || currentLiquidityAtr === undefined || currentLiquidityAtr <= 0 || settings.liquidityAtrMargin <= 0) return;
    const width = currentLiquidityAtr * settings.liquidityAtrMargin / 10;
    const consumed = new Set<number>();
    for (const pool of pools) {
      if (pool.side === side && pool.consumed) {
        for (const index of pool.pivotIndices) consumed.add(index);
      }
    }
    const cluster: Pivot[] = [];
    for (let index = history.length - 1; index >= 0; index -= 1) {
      const point = history[index];
      if (Math.abs(point.price - pivot.price) > width) break;
      if (!consumed.has(point.index)) cluster.push(point);
    }
    cluster.reverse();
    if (cluster.length < settings.liquidityMinPivots) return;
    const prices = cluster.map((point) => point.price);
    const center = (Math.min(...prices) + Math.max(...prices)) / 2;
    const indices = new Set(cluster.map((point) => point.index));
    const existing = pools.find((pool) => !pool.consumed && pool.side === side && [...pool.pivotIndices].some((index) => indices.has(index)));
    const next: Pool = {
      side,
      top: center + width,
      bottom: center - width,
      pivotIndices: indices,
      pivotPrices: prices,
      pivotTimes: cluster.map((point) => point.time),
      consumed: false,
    };
    if (existing) Object.assign(existing, next);
    else pools.push(next);
  };

  const takeLevel = (direction: SweepReversalDirection, close: number, penetration: number): Level | undefined => {
    if (!settings.equalSwingFilter) {
      const level = direction < 0 ? latestHigh : latestLow;
      const breached = level?.available && (direction < 0
        ? close > level.level + penetration
        : close < level.level - penetration);
      if (!level || !breached) return undefined;
      level.available = false;
      return level;
    }
    const side = direction < 0 ? "buy" : "sell";
    const breached = pools.filter((pool) => !pool.consumed && pool.side === side && (direction < 0
      ? close > pool.top + penetration
      : close < pool.bottom - penetration));
    if (breached.length === 0) return undefined;
    const chosen = breached.reduce((best, item) => Math.max(...item.pivotIndices) > Math.max(...best.pivotIndices) ? item : best);
    for (const pool of breached) pool.consumed = true;
    return {
      level: direction < 0 ? chosen.top : chosen.bottom,
      pivotIndices: [...chosen.pivotIndices].sort((a, b) => a - b),
      pivotPrices: chosen.pivotPrices,
      pivotTimes: chosen.pivotTimes,
      available: false,
    };
  };

  const setupFromCandidate = (candidate: Candidate, phase: SweepReversalPhase, currentIndex: number): SweepReversalSetup => {
    const extension = phase === "confirmed" ? settings.confirmedExtension : 1;
    const target = currentIndex + extension;
    const endTime = target < bars.length ? bars[target].time : bars[currentIndex].time + extension * step;
    return {
      id: candidate.id,
      direction: candidate.direction,
      phase,
      sweepTime: candidate.sweepTime,
      endTime,
      lineEndTime: bars[currentIndex].time,
      level: candidate.level,
      extreme: candidate.extreme,
      confirmationLevel: candidate.confirmationLevel,
      pivotTimes: candidate.pivotTimes,
      pivotPrices: candidate.pivotPrices,
      ...(phase === "confirmed" ? { confirmedTime: bars[currentIndex].time } : {}),
    };
  };

  for (let currentIndex = 0; currentIndex < bars.length; currentIndex += 1) {
    const bar = bars[currentIndex];
    const trueRange = Math.max(
      0,
      bar.high - bar.low,
      previousClose === undefined ? 0 : Math.abs(bar.high - previousClose),
      previousClose === undefined ? 0 : Math.abs(bar.low - previousClose),
    );
    previousClose = bar.close;
    currentAtr = atr.update(trueRange);
    currentLiquidityAtr = liquidityAtr.update(trueRange);

    const pivotIndex = currentIndex - settings.swingLength;
    if (pivotIndex >= settings.swingLength) {
      const pivot = bars[pivotIndex];
      const left = bars.slice(pivotIndex - settings.swingLength, pivotIndex);
      const right = bars.slice(pivotIndex + 1, pivotIndex + settings.swingLength + 1);
      if (pivot.high > Math.max(...left.map((item) => item.high)) && pivot.high >= Math.max(...right.map((item) => item.high))) {
        const point = { price: pivot.high, index: pivotIndex, time: pivot.time };
        latestHigh = { level: point.price, pivotIndices: [point.index], pivotPrices: [point.price], pivotTimes: [point.time], available: true };
        registerPivot(point, "buy", currentIndex);
      }
      if (pivot.low < Math.min(...left.map((item) => item.low)) && pivot.low <= Math.min(...right.map((item) => item.low))) {
        const point = { price: pivot.low, index: pivotIndex, time: pivot.time };
        latestLow = { level: point.price, pivotIndices: [point.index], pivotPrices: [point.price], pivotTimes: [point.time], available: true };
        registerPivot(point, "sell", currentIndex);
      }
    }

    if (currentIndex >= settings.structureLength) {
      const prior = bars.slice(currentIndex - settings.structureLength, currentIndex);
      const penetration = (currentAtr ?? 0) * settings.minPenetrationAtr;
      if (!bearish) {
        const level = takeLevel(-1, bar.close, penetration);
        if (level) {
          bearish = {
            id: `sweep-s-${bar.time}-${serial++}`,
            direction: -1,
            startIndex: currentIndex,
            sweepTime: bar.time,
            level: level.level,
            extreme: bar.high,
            confirmationLevel: Math.min(...prior.map((item) => item.low)),
            pivotTimes: level.pivotTimes,
            pivotPrices: level.pivotPrices,
            reclaimed: false,
          };
          events.push({ phase: "developing", time: bar.time, direction: -1, level: level.level, pivotCount: level.pivotTimes.length });
        }
      }
      if (!bullish) {
        const level = takeLevel(1, bar.close, penetration);
        if (level) {
          bullish = {
            id: `sweep-l-${bar.time}-${serial++}`,
            direction: 1,
            startIndex: currentIndex,
            sweepTime: bar.time,
            level: level.level,
            extreme: bar.low,
            confirmationLevel: Math.max(...prior.map((item) => item.high)),
            pivotTimes: level.pivotTimes,
            pivotPrices: level.pivotPrices,
            reclaimed: false,
          };
          events.push({ phase: "developing", time: bar.time, direction: 1, level: level.level, pivotCount: level.pivotTimes.length });
        }
      }
    }

    const advance = (candidate: Candidate | undefined): { candidate?: Candidate; confirmed?: SweepReversalSetup; expired?: Candidate } => {
      if (!candidate) return {};
      candidate.extreme = candidate.direction < 0
        ? Math.max(candidate.extreme, bar.high)
        : Math.min(candidate.extreme, bar.low);
      candidate.reclaimed ||= candidate.direction < 0 ? bar.close < candidate.level : bar.close > candidate.level;
      const displacement = currentAtr !== undefined && Math.abs(bar.close - bar.open) >= currentAtr * settings.minDisplacementAtr;
      const isConfirmed = candidate.reclaimed && displacement && (candidate.direction < 0
        ? bar.close < candidate.confirmationLevel
        : bar.close > candidate.confirmationLevel);
      if (isConfirmed) return { confirmed: setupFromCandidate(candidate, "confirmed", currentIndex) };
      if (currentIndex - candidate.startIndex > settings.maxConfirmationBars) return { expired: candidate };
      return { candidate };
    };

    const bearishResult = advance(bearish);
    const bullishResult = advance(bullish);
    bearish = bearishResult.candidate;
    bullish = bullishResult.candidate;
    if (bearishResult.confirmed && bullishResult.confirmed) {
      // A bar that confirms opposing setups is ambiguous by definition.
    } else {
      for (const setup of [bearishResult.confirmed, bullishResult.confirmed]) {
        if (!setup) continue;
        confirmed.push(setup);
        events.push({ phase: "confirmed", time: bar.time, direction: setup.direction, level: setup.level, pivotCount: setup.pivotTimes.length });
        while (confirmed.length > settings.maxHistory) confirmed.shift();
      }
    }
    for (const expired of [bearishResult.expired, bullishResult.expired]) {
      if (expired) events.push({ phase: "expired", time: bar.time, direction: expired.direction, level: expired.level, pivotCount: expired.pivotTimes.length });
    }
  }

  const active: SweepReversalSetup[] = [];
  if (settings.showDeveloping && bars.length > 0) {
    const lastIndex = bars.length - 1;
    if (bearish) active.push(setupFromCandidate(bearish, "developing", lastIndex));
    if (bullish) active.push(setupFromCandidate(bullish, "developing", lastIndex));
  }
  return {
    setups: [...confirmed, ...active],
    events,
    zoneColor: settings.zoneColor,
    levelColor: settings.levelColor,
  };
}

export const computeSweepReversalOverlay = reduceSweepReversal;
