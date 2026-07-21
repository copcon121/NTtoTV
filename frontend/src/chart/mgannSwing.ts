import { type Bar } from "../cache/types";

export const MGANN_SWING_SIZE = 5;
export const MGANN_IMPULSE_TICK_SIZE = 0.1;

export interface MgannSwingSettings {
  showWaveDelta: boolean;
  showWaveDeltaNumbers: boolean;
  waveDeltaNumbersImpulseOnly: boolean;
  showSwingLine: boolean;
  showSignals: boolean;
  showImpulseWaves: boolean;
  impulseLengthMultiplier: number;
  impulseVolumeMultiplier: number;
  impulseBreakTicks: number;
  smartFilter: boolean;
}

export const DEFAULT_MGANN_SWING_SETTINGS: MgannSwingSettings = {
  showWaveDelta: true,
  showWaveDeltaNumbers: false,
  waveDeltaNumbersImpulseOnly: true,
  showSwingLine: true,
  showSignals: true,
  showImpulseWaves: true,
  impulseLengthMultiplier: 1.1,
  impulseVolumeMultiplier: 1.2,
  impulseBreakTicks: 1,
  smartFilter: true,
};

export interface MgannSwingDeltaPoint {
  time: number;
  delta?: number;
  closeDelta?: number;
}

export interface MgannSwingLinePoint {
  time: number;
  value: number;
}

export type MgannSwingPivotKind = "high" | "low";
export type MgannSwingSignalLabel =
  | "PB"
  | "#"
  | "UT"
  | "SP"
  | "[PB]"
  | "[#]";

export interface MgannSwingSignal {
  id: string;
  time: number;
  price: number;
  kind: MgannSwingPivotKind;
  labels: MgannSwingSignalLabel[];
}

export interface MgannSwingWaveDeltaLabel {
  id: string;
  time: number;
  price: number;
  kind: MgannSwingPivotKind;
  value: number;
}

export interface MgannSwingWaveDeltaBox {
  id: string;
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
  direction: 1 | -1;
  value: number;
}

export interface MgannSwingImpulseWave {
  id: string;
  direction: 1 | -1;
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
  w1Length: number;
  w3Length: number;
  w1Volume: number;
  w3Volume: number;
  w1Delta: number;
  w3Delta: number;
}

export interface MgannSwingOverlay {
  line: MgannSwingLinePoint[];
  signals: MgannSwingSignal[];
  waveDeltaLabels: MgannSwingWaveDeltaLabel[];
  waveDeltaBoxes: MgannSwingWaveDeltaBox[];
  waveDeltaValues: number[];
  impulseWaves: MgannSwingImpulseWave[];
}

interface MgannSwingPivot {
  index: number;
  time: number;
  price: number;
  kind: MgannSwingPivotKind;
}

interface MgannSwingWave {
  start: MgannSwingPivot;
  end: MgannSwingPivot;
  direction: 1 | -1;
  volume: number;
  delta: number;
  absDelta: number;
  length: number;
  width: number;
}

interface MgannSwingSmartContext {
  ema200: number[];
  adx14: Array<number | undefined>;
}

export function normalizeMgannSwingSettings(
  settings?: Partial<MgannSwingSettings>,
): MgannSwingSettings {
  const merged = {
    ...DEFAULT_MGANN_SWING_SETTINGS,
    ...(settings ?? {}),
  };
  return {
    ...merged,
    impulseLengthMultiplier: normalizeMultiplier(
      merged.impulseLengthMultiplier,
      DEFAULT_MGANN_SWING_SETTINGS.impulseLengthMultiplier,
    ),
    impulseVolumeMultiplier: normalizeMultiplier(
      merged.impulseVolumeMultiplier,
      DEFAULT_MGANN_SWING_SETTINGS.impulseVolumeMultiplier,
    ),
    impulseBreakTicks: normalizeBreakTicks(merged.impulseBreakTicks),
  };
}

function normalizeMultiplier(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(10, Math.max(1, parsed));
}

function normalizeBreakTicks(value: unknown): number {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) {
    return DEFAULT_MGANN_SWING_SETTINGS.impulseBreakTicks;
  }
  return Math.min(100, Math.max(0, parsed));
}

function volumeDeltaValue(point: MgannSwingDeltaPoint | undefined): number {
  if (point === undefined) return 0;
  if (Number.isFinite(point.closeDelta)) return point.closeDelta ?? 0;
  return Number.isFinite(point.delta) ? point.delta ?? 0 : 0;
}

function isMoreExtremePivot(
  candidate: MgannSwingPivot,
  current: MgannSwingPivot,
): boolean {
  if (candidate.kind === "high") {
    return candidate.price > current.price;
  }
  return candidate.price < current.price;
}

function appendConfirmedPivot(
  pivots: MgannSwingPivot[],
  pivot: MgannSwingPivot,
): void {
  const last = pivots[pivots.length - 1];
  if (last === undefined) {
    pivots.push(pivot);
    return;
  }
  if (last.index === pivot.index) {
    return;
  }
  if (last.kind === pivot.kind) {
    if (isMoreExtremePivot(pivot, last)) {
      pivots[pivots.length - 1] = pivot;
    }
    return;
  }
  pivots.push(pivot);
}

function confirmedPivot(
  bars: readonly Bar[],
  index: number,
  kind: MgannSwingPivotKind,
): MgannSwingPivot | undefined {
  if (index < 0 || index >= bars.length) return undefined;
  const bar = bars[index];
  return {
    index,
    time: bar.time,
    price: kind === "high" ? bar.high : bar.low,
    kind,
  };
}

function collectPivots(bars: readonly Bar[]): MgannSwingPivot[] {
  const length = MGANN_SWING_SIZE;
  if (bars.length < length * 2 + 1) return [];

  const pivots: MgannSwingPivot[] = [];

  for (let index = length; index < bars.length - length; index += 1) {
    const candidate = bars[index];
    if (candidate === undefined) continue;

    const left = bars.slice(index - length, index);
    const right = bars.slice(index + 1, index + 1 + length);
    const leftHigh = Math.max(...left.map((bar) => bar.high));
    const rightHigh = Math.max(...right.map((bar) => bar.high));
    const leftLow = Math.min(...left.map((bar) => bar.low));
    const rightLow = Math.min(...right.map((bar) => bar.low));

    const highPivot = candidate.high > leftHigh && candidate.high >= rightHigh;
    const lowPivot = candidate.low < leftLow && candidate.low <= rightLow;

    const previousKind = pivots[pivots.length - 1]?.kind;
    const kinds: MgannSwingPivotKind[] =
      highPivot && lowPivot
        ? previousKind === "high"
          ? ["low", "high"]
          : ["high", "low"]
        : highPivot
          ? ["high"]
          : lowPivot
            ? ["low"]
            : [];

    for (const kind of kinds) {
      const pivot = confirmedPivot(bars, index, kind);
      if (pivot !== undefined) appendConfirmedPivot(pivots, pivot);
    }
  }


  return pivots;
}

function waveDeltaBetween(
  bars: readonly Bar[],
  deltaByTime: ReadonlyMap<number, MgannSwingDeltaPoint>,
  startIndex: number,
  endIndex: number,
): number {
  let total = 0;
  for (let index = Math.max(0, startIndex + 1); index <= endIndex; index += 1) {
    total += volumeDeltaValue(deltaByTime.get(bars[index]?.time));
  }
  return total;
}

function waveVolumeBetween(
  bars: readonly Bar[],
  startIndex: number,
  endIndex: number,
): number {
  let total = 0;
  for (let index = Math.max(0, startIndex + 1); index <= endIndex; index += 1) {
    total += bars[index]?.volume ?? 0;
  }
  return total;
}

function buildWaves(
  bars: readonly Bar[],
  deltaByTime: ReadonlyMap<number, MgannSwingDeltaPoint>,
  pivots: readonly MgannSwingPivot[],
): MgannSwingWave[] {
  const waves: MgannSwingWave[] = [];
  for (let i = 1; i < pivots.length; i += 1) {
    const start = pivots[i - 1];
    const end = pivots[i];
    if (end.index <= start.index) continue;
    const volume = waveVolumeBetween(bars, start.index, end.index);
    const delta = waveDeltaBetween(bars, deltaByTime, start.index, end.index);
    waves.push({
      start,
      end,
      direction: end.kind === "high" ? 1 : -1,
      volume,
      delta,
      absDelta: Math.abs(delta),
      length: Math.abs(end.price - start.price),
      width: end.index - start.index,
    });
  }
  return waves;
}

function buildWaveDeltaValues(
  bars: readonly Bar[],
  deltaByTime: ReadonlyMap<number, MgannSwingDeltaPoint>,
  pivots: readonly MgannSwingPivot[],
): number[] {
  const pivotIndexes = new Set(pivots.map((pivot) => pivot.index));
  const values: number[] = [];
  let running = 0;
  for (let index = 0; index < bars.length; index += 1) {
    running += volumeDeltaValue(deltaByTime.get(bars[index].time));
    values.push(running);
    if (pivotIndexes.has(index)) running = 0;
  }
  return values;
}

function pivotClose(bars: readonly Bar[], pivot: MgannSwingPivot): number {
  return bars[pivot.index]?.close ?? pivot.price;
}

function buildEmaValues(bars: readonly Bar[], period: number): number[] {
  if (bars.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let previous = bars[0].close;
  for (let index = 0; index < bars.length; index += 1) {
    previous =
      index === 0 ? bars[index].close : bars[index].close * k + previous * (1 - k);
    out.push(previous);
  }
  return out;
}

function buildAdxValues(bars: readonly Bar[], period: number): Array<number | undefined> {
  const out: Array<number | undefined> = new Array(bars.length).fill(undefined);
  if (bars.length <= period * 2) return out;

  const trueRanges: number[] = new Array(bars.length).fill(0);
  const plusDm: number[] = new Array(bars.length).fill(0);
  const minusDm: number[] = new Array(bars.length).fill(0);

  for (let index = 1; index < bars.length; index += 1) {
    const current = bars[index];
    const previous = bars[index - 1];
    const upMove = current.high - previous.high;
    const downMove = previous.low - current.low;
    plusDm[index] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDm[index] = downMove > upMove && downMove > 0 ? downMove : 0;
    trueRanges[index] = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close),
    );
  }

  let smoothedTr = 0;
  let smoothedPlus = 0;
  let smoothedMinus = 0;
  for (let index = 1; index <= period; index += 1) {
    smoothedTr += trueRanges[index] ?? 0;
    smoothedPlus += plusDm[index] ?? 0;
    smoothedMinus += minusDm[index] ?? 0;
  }

  const dx: Array<number | undefined> = new Array(bars.length).fill(undefined);
  for (let index = period; index < bars.length; index += 1) {
    if (index > period) {
      smoothedTr = smoothedTr - smoothedTr / period + trueRanges[index];
      smoothedPlus = smoothedPlus - smoothedPlus / period + plusDm[index];
      smoothedMinus = smoothedMinus - smoothedMinus / period + minusDm[index];
    }

    const plusDi = smoothedTr > 0 ? (100 * smoothedPlus) / smoothedTr : 0;
    const minusDi = smoothedTr > 0 ? (100 * smoothedMinus) / smoothedTr : 0;
    const sum = plusDi + minusDi;
    dx[index] = sum > 0 ? (100 * Math.abs(plusDi - minusDi)) / sum : 0;
  }

  let adxSeed = 0;
  let seedCount = 0;
  for (let index = period; index < period * 2 && index < dx.length; index += 1) {
    const value = dx[index];
    if (value !== undefined) {
      adxSeed += value;
      seedCount += 1;
    }
  }
  if (seedCount === 0 || period * 2 >= bars.length) return out;

  let adx = adxSeed / seedCount;
  out[period * 2 - 1] = adx;
  for (let index = period * 2; index < bars.length; index += 1) {
    const value = dx[index] ?? 0;
    adx = (adx * (period - 1) + value) / period;
    out[index] = adx;
  }

  return out;
}

function passesSmartFilter(
  bars: readonly Bar[],
  context: MgannSwingSmartContext | undefined,
  pivot: MgannSwingPivot,
): boolean {
  if (context === undefined) return true;
  const bar = bars[pivot.index];
  if (bar === undefined) return false;

  const ema = context.ema200[pivot.index];
  if (!Number.isFinite(ema)) return true;

  const directionalPass = pivot.kind === "low" ? bar.close >= ema : bar.close <= ema;
  const adx = context.adx14[pivot.index];
  const rangePass = adx !== undefined && adx <= 25;
  return directionalPass || rangePass;
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) return numerator >= 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  return numerator / denominator;
}

function rangesOverlap(bars: readonly Bar[], first: MgannSwingPivot, second: MgannSwingPivot): boolean {
  const firstBar = bars[first.index];
  const secondBar = bars[second.index];
  if (firstBar === undefined || secondBar === undefined) return false;
  return secondBar.low <= firstBar.high && secondBar.high >= firstBar.low;
}

function lowestLowBetween(bars: readonly Bar[], fromIndex: number, toIndex: number): number {
  let out = Number.POSITIVE_INFINITY;
  for (let index = Math.max(0, fromIndex); index <= Math.min(toIndex, bars.length - 1); index += 1) {
    out = Math.min(out, bars[index].low);
  }
  return Number.isFinite(out) ? out : Number.NaN;
}

function highestHighBetween(bars: readonly Bar[], fromIndex: number, toIndex: number): number {
  let out = Number.NEGATIVE_INFINITY;
  for (let index = Math.max(0, fromIndex); index <= Math.min(toIndex, bars.length - 1); index += 1) {
    out = Math.max(out, bars[index].high);
  }
  return Number.isFinite(out) ? out : Number.NaN;
}

function addSignal(
  signalsByPivot: Map<number, MgannSwingSignalLabel[]>,
  pivotIndex: number,
  label: MgannSwingSignalLabel,
): void {
  const labels = signalsByPivot.get(pivotIndex) ?? [];
  if (!labels.includes(label)) labels.push(label);
  signalsByPivot.set(pivotIndex, labels);
}

function buildSignals(
  bars: readonly Bar[],
  pivots: readonly MgannSwingPivot[],
  waves: readonly MgannSwingWave[],
  context?: MgannSwingSmartContext,
): MgannSwingSignal[] {
  const signalsByPivot = new Map<number, MgannSwingSignalLabel[]>();

  for (let pivotIndex = 4; pivotIndex < pivots.length; pivotIndex += 1) {
    const i1 = pivots[pivotIndex];
    const i2 = pivots[pivotIndex - 1];
    const num = pivots[pivotIndex - 2];
    const num2 = pivots[pivotIndex - 3];
    const num3 = pivots[pivotIndex - 4];
    const current = waves[pivotIndex - 1];
    const priorOpposite = waves[pivotIndex - 2];
    const priorSame = waves[pivotIndex - 3];
    const priorOpposite2 = waves[pivotIndex - 4];
    const priorSame2 = waves[pivotIndex - 5];
    if (
      current === undefined ||
      priorOpposite === undefined ||
      priorSame === undefined ||
      priorOpposite2 === undefined ||
      priorSame2 === undefined
    ) {
      continue;
    }

    const dir = current.direction;
    const i1Close = pivotClose(bars, i1);
    const i2Close = pivotClose(bars, i2);
    const numClose = pivotClose(bars, num);
    const num2Close = pivotClose(bars, num2);
    const num3Close = pivotClose(bars, num3);
    const bracket =
      (dir === 1 &&
        i1Close <= numClose &&
        numClose <= num3Close &&
        i2Close <= num2Close) ||
      (dir === -1 &&
        i1Close >= numClose &&
        numClose >= num3Close &&
        i2Close >= num2Close);

    if (
      current.volume <= priorSame.volume &&
      priorSame.volume <= priorSame2.volume
    ) {
      addSignal(signalsByPivot, pivotIndex, bracket ? "[#]" : "#");
    }

    if (
      (dir === 1 &&
        current.delta <= priorSame.delta &&
        priorSame.delta <= priorSame2.delta) ||
      (dir === -1 &&
        current.delta >= priorSame.delta &&
        priorSame.delta >= priorSame2.delta)
    ) {
      addSignal(signalsByPivot, pivotIndex, bracket ? "[#]" : "#");
    }

    const currentBar = bars[i1.index];
    const priorSameBar = bars[num.index];
    if (currentBar !== undefined && priorSameBar !== undefined) {
      if (
        dir === 1 &&
        i1Close <= numClose &&
        currentBar.high <= priorSameBar.low &&
        current.length <= priorSame.length &&
        (ratio(current.volume, current.width) >
          ratio(priorSame.volume, priorSame.width) ||
          current.volume > priorSame.volume ||
          ratio(current.delta, current.width) <
            ratio(priorSame.delta, priorSame.width) ||
          current.delta < priorSame.delta)
      ) {
        addSignal(signalsByPivot, pivotIndex, bracket ? "[PB]" : "PB");
      } else if (
        dir === -1 &&
        i1Close >= numClose &&
        currentBar.low >= priorSameBar.high &&
        current.length <= priorSame.length &&
        (ratio(current.volume, current.width) >
          ratio(priorSame.volume, priorSame.width) ||
          current.volume > priorSame.volume ||
          ratio(current.delta, current.width) >
            ratio(priorSame.delta, priorSame.width) ||
          current.delta > priorSame.delta)
      ) {
        addSignal(signalsByPivot, pivotIndex, bracket ? "[PB]" : "PB");
      }
    }

    if (
      dir === 1 &&
      lowestLowBetween(bars, i2.index, i1.index) <=
        lowestLowBetween(bars, num2.index, i2.index - 1) &&
      Math.abs(i2.index - num.index) >= 3 &&
      (rangesOverlap(bars, num2, i2) ||
        (i2.index > 0 &&
          rangesOverlap(bars, num2, {
            index: i2.index - 1,
            time: bars[i2.index - 1].time,
            price: bars[i2.index - 1].low,
            kind: "low",
          }))) &&
      (ratio(priorOpposite.delta, priorOpposite.width) >
        ratio(priorOpposite2.delta, priorOpposite2.width) ||
        priorOpposite.delta > priorOpposite2.delta ||
        (priorOpposite.delta === 0 && priorSame.delta === 0))
    ) {
      addSignal(signalsByPivot, pivotIndex - 1, "SP");
    } else if (
      dir === -1 &&
      highestHighBetween(bars, i2.index, i1.index) >=
        highestHighBetween(bars, num2.index, i2.index - 1) &&
      Math.abs(i2.index - num.index) >= 3 &&
      (rangesOverlap(bars, num2, i2) ||
        (i2.index > 0 &&
          rangesOverlap(bars, num2, {
            index: i2.index - 1,
            time: bars[i2.index - 1].time,
            price: bars[i2.index - 1].high,
            kind: "high",
          }))) &&
      (ratio(priorOpposite.delta, priorOpposite.width) <
        ratio(priorOpposite2.delta, priorOpposite2.width) ||
        priorOpposite.delta < priorOpposite2.delta ||
        (priorOpposite.delta === 0 && priorSame.delta === 0))
    ) {
      addSignal(signalsByPivot, pivotIndex - 1, "UT");
    }
  }

  return Array.from(signalsByPivot.entries())
    .sort(([left], [right]) => left - right)
    .flatMap(([pivotIndex, labels]) => {
      const pivot = pivots[pivotIndex];
      if (pivot === undefined || labels.length === 0) return [];
      if (!passesSmartFilter(bars, context, pivot)) return [];
      return [
        {
          id: `mgann:${pivot.kind}:${pivot.time}`,
          time: pivot.time,
          price: pivot.price,
          kind: pivot.kind,
          labels,
        },
      ];
    });
}

function nearestPriorPivot(
  pivots: readonly MgannSwingPivot[],
  beforeIndex: number,
  kind: MgannSwingPivotKind,
): MgannSwingPivot | undefined {
  for (let index = beforeIndex - 1; index >= 0; index -= 1) {
    const pivot = pivots[index];
    if (pivot?.kind === kind) return pivot;
  }
  return undefined;
}

function buildImpulseWaves(
  bars: readonly Bar[],
  pivots: readonly MgannSwingPivot[],
  waves: readonly MgannSwingWave[],
  settings: MgannSwingSettings,
): MgannSwingImpulseWave[] {
  const signals: MgannSwingImpulseWave[] = [];
  const breakDistance = settings.impulseBreakTicks * MGANN_IMPULSE_TICK_SIZE;

  for (let waveIndex = 2; waveIndex < waves.length; waveIndex += 1) {
    const w1 = waves[waveIndex - 2];
    const w2 = waves[waveIndex - 1];
    const w3 = waves[waveIndex];
    if (w1 === undefined || w2 === undefined || w3 === undefined) continue;
    if (w1.length <= 0 || w3.length <= 0) continue;
    if (w3.length < w1.length * settings.impulseLengthMultiplier) continue;
    if (w3.absDelta < w1.absDelta * settings.impulseVolumeMultiplier) continue;

    const w1StartPivotIndex = pivots.findIndex(
      (pivot) => pivot.index === w1.start.index && pivot.kind === w1.start.kind,
    );
    if (w1StartPivotIndex < 0) continue;

    if (w1.direction === -1 && w2.direction === 1 && w3.direction === -1) {
      const priorLow = nearestPriorPivot(pivots, w1StartPivotIndex, "low");
      if (priorLow === undefined) continue;
      const w1High = highestHighBetween(bars, w1.start.index, w1.end.index);
      const w2High = highestHighBetween(bars, w2.start.index, w2.end.index);
      if (w2High > w1High) continue;
      if (w3.end.price > priorLow.price - breakDistance) continue;
      if (w3.end.price > w1.end.price - breakDistance) continue;
      signals.push(toImpulseWave(w1, w3, -1));
    } else if (w1.direction === 1 && w2.direction === -1 && w3.direction === 1) {
      const priorHigh = nearestPriorPivot(pivots, w1StartPivotIndex, "high");
      if (priorHigh === undefined) continue;
      const w1Low = lowestLowBetween(bars, w1.start.index, w1.end.index);
      const w2Low = lowestLowBetween(bars, w2.start.index, w2.end.index);
      if (w2Low < w1Low) continue;
      if (w3.end.price < priorHigh.price + breakDistance) continue;
      if (w3.end.price < w1.end.price + breakDistance) continue;
      signals.push(toImpulseWave(w1, w3, 1));
    }
  }

  return signals;
}

function toImpulseWave(
  w1: MgannSwingWave,
  w3: MgannSwingWave,
  direction: 1 | -1,
): MgannSwingImpulseWave {
  return {
    id: `mgann-impulse:${direction}:${w1.start.time}:${w3.end.time}`,
    direction,
    startIndex: w1.start.index,
    endIndex: w3.end.index,
    startTime: w1.start.time,
    endTime: w3.end.time,
    w1Length: w1.length,
    w3Length: w3.length,
    w1Volume: w1.volume,
    w3Volume: w3.volume,
    w1Delta: w1.delta,
    w3Delta: w3.delta,
  };
}

function buildWaveDeltaLabels(
  waves: readonly MgannSwingWave[],
  impulses: readonly MgannSwingImpulseWave[],
  impulseOnly: boolean,
): MgannSwingWaveDeltaLabel[] {
  const visibleWaves = impulseOnly
    ? waves.filter((wave) =>
        impulses.some(
          (impulse) =>
            wave.end.index > impulse.startIndex &&
            wave.end.index <= impulse.endIndex,
        ),
      )
    : waves;
  return visibleWaves.map((wave) => ({
    id: `mgann-delta:${wave.end.kind}:${wave.end.time}`,
    time: wave.end.time,
    price: wave.end.price,
    kind: wave.end.kind,
    value: wave.delta,
  }));
}

function buildWaveDeltaBoxes(
  waves: readonly MgannSwingWave[],
): MgannSwingWaveDeltaBox[] {
  return waves.map((wave) => ({
    id: `mgann-delta-box:${wave.direction}:${wave.start.time}:${wave.end.time}`,
    startIndex: wave.start.index,
    endIndex: wave.end.index,
    startTime: wave.start.time,
    endTime: wave.end.time,
    direction: wave.direction,
    value: wave.delta,
  }));
}

export function buildMgannSwingOverlay(
  bars: readonly Bar[],
  deltaByTime: ReadonlyMap<number, MgannSwingDeltaPoint>,
  settings?: Partial<MgannSwingSettings>,
): MgannSwingOverlay {
  const normalized = normalizeMgannSwingSettings(settings);
  const pivots = collectPivots(bars);
  const waves = buildWaves(bars, deltaByTime, pivots);
  const impulseWaves = buildImpulseWaves(bars, pivots, waves, normalized);
  const smartContext = normalized.smartFilter
    ? {
        ema200: buildEmaValues(bars, 200),
        adx14: buildAdxValues(bars, 14),
      }
    : undefined;
  return {
    line: pivots.map((pivot) => ({ time: pivot.time, value: pivot.price })),
    signals: buildSignals(bars, pivots, waves, smartContext),
    waveDeltaLabels: buildWaveDeltaLabels(
      waves,
      impulseWaves,
      normalized.waveDeltaNumbersImpulseOnly,
    ),
    waveDeltaBoxes: buildWaveDeltaBoxes(waves),
    waveDeltaValues: buildWaveDeltaValues(bars, deltaByTime, pivots),
    impulseWaves,
  };
}
