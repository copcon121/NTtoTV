import type { Bar } from "../cache/types";

/** Native MBoxWave XKontrol 3.0.2.5 constants. */
export const XKONTROL_HISTORY_BARS = 300;
const RING_SIZE = XKONTROL_HISTORY_BARS;
const SCAN_LIMIT = 201;
const DIRECTIONAL_ALPHA = 0.5;
const PACE_EXPONENT = 0.9632055480639569;
const PACE_DIVISOR = 9999;
const STRONG_RATIO = 1.618;
const TOTAL_RATIO = 3;
const MINIMUM_BAR_INDEX = 20;

/** GC futures tick size used by the NTtoTV chart. */
export const XKONTROL_GC_TICK_SIZE = 0.1;

export type XKontrolCode = -3 | -2 | -1 | 0 | 1 | 2 | 3;

export interface XKontrolDisplaySettings {
  showInitial: boolean;
  showStrong: boolean;
  showTotal: boolean;
}

export const DEFAULT_XKONTROL_DISPLAY_SETTINGS: XKontrolDisplaySettings = {
  showInitial: true,
  showStrong: true,
  showTotal: true,
};

export function normalizeXKontrolDisplaySettings(
  settings?: Partial<XKontrolDisplaySettings> | null,
): XKontrolDisplaySettings {
  return {
    showInitial:
      typeof settings?.showInitial === "boolean"
        ? settings.showInitial
        : DEFAULT_XKONTROL_DISPLAY_SETTINGS.showInitial,
    showStrong:
      typeof settings?.showStrong === "boolean"
        ? settings.showStrong
        : DEFAULT_XKONTROL_DISPLAY_SETTINGS.showStrong,
    showTotal:
      typeof settings?.showTotal === "boolean"
        ? settings.showTotal
        : DEFAULT_XKONTROL_DISPLAY_SETTINGS.showTotal,
  };
}

export function xKontrolLevelVisible(
  level: 1 | 2 | 3,
  settings: XKontrolDisplaySettings,
): boolean {
  if (level === 1) return settings.showInitial;
  if (level === 2) return settings.showStrong;
  return settings.showTotal;
}

export interface XKontrolSignal {
  time: number;
  price: number;
  code: Exclude<XKontrolCode, 0>;
  side: "offers" | "bids";
  level: 1 | 2 | 3;
}

function f32(value: number): number {
  return Math.fround(value);
}

function clear(buffer: Float32Array): void {
  buffer.fill(0);
}

/**
 * Stateful, float32-faithful port of MBoxWave XKontrol 3.0.2.5.
 *
 * `setBars` reconstructs history from final OHLCV bars. `updateLastBar` keeps
 * the native OnPriceChange behaviour for a live bar: the current slot is
 * recalculated while historical control state remains intact.
 */
export class XKontrolEngine {
  private readonly open = new Float32Array(RING_SIZE);
  private readonly high = new Float32Array(RING_SIZE);
  private readonly low = new Float32Array(RING_SIZE);
  private readonly close = new Float32Array(RING_SIZE);
  private readonly volume = new Float32Array(RING_SIZE);

  private readonly smoothBase = new Float32Array(RING_SIZE);
  private readonly smoothPlusDm = new Float32Array(RING_SIZE);
  private readonly smoothMinusDm = new Float32Array(RING_SIZE);
  private readonly smoothTrueRange = new Float32Array(RING_SIZE);
  private readonly plusDi = new Float32Array(RING_SIZE);
  private readonly minusDi = new Float32Array(RING_SIZE);
  private readonly diDirection = new Float32Array(RING_SIZE);

  private readonly pace = new Float32Array(RING_SIZE);
  private readonly direction = new Float32Array(RING_SIZE);
  private readonly controlPace = new Float32Array(RING_SIZE);
  private readonly xKontrol = new Float32Array(RING_SIZE);
  private readonly initialControl = new Float32Array(RING_SIZE);

  private outputCodes: XKontrolCode[] = [];
  private processedBars = 0;

  constructor(private readonly tickSize = XKONTROL_GC_TICK_SIZE) {
    if (!Number.isFinite(tickSize) || tickSize <= 0) {
      throw new RangeError("XKontrol tickSize must be positive and finite");
    }
  }

  get length(): number {
    return this.processedBars;
  }

  get codes(): readonly XKontrolCode[] {
    return this.outputCodes;
  }

  setBars(bars: readonly Bar[]): void {
    this.reset();
    for (let index = 0; index < bars.length; index += 1) {
      this.process(index, bars[index]);
    }
  }

  /** Append the next absolute bar without discarding native ring state. */
  appendBar(bar: Bar): XKontrolCode {
    return this.process(this.processedBars, bar);
  }

  /** Re-run the active bar on each price change. */
  updateLastBar(bar: Bar): XKontrolCode {
    if (this.processedBars === 0) return this.appendBar(bar);
    return this.process(this.processedBars - 1, bar);
  }

  signals(bars: readonly Bar[]): XKontrolSignal[] {
    const count = Math.min(bars.length, this.outputCodes.length);
    const signals: XKontrolSignal[] = [];
    for (let index = 0; index < count; index += 1) {
      const code = this.outputCodes[index];
      if (code === 0) continue;
      const level = Math.abs(code) as 1 | 2 | 3;
      signals.push({
        time: bars[index].time,
        price: code > 0 ? bars[index].low : bars[index].high,
        code,
        side: code > 0 ? "offers" : "bids",
        level,
      });
    }
    return signals;
  }

  private reset(): void {
    clear(this.open);
    clear(this.high);
    clear(this.low);
    clear(this.close);
    clear(this.volume);
    clear(this.smoothBase);
    clear(this.smoothPlusDm);
    clear(this.smoothMinusDm);
    clear(this.smoothTrueRange);
    clear(this.plusDi);
    clear(this.minusDi);
    clear(this.diDirection);
    clear(this.pace);
    clear(this.direction);
    clear(this.controlPace);
    clear(this.xKontrol);
    clear(this.initialControl);
    this.outputCodes = [];
    this.processedBars = 0;
  }

  private process(barIndex: number, bar: Bar): XKontrolCode {
    const canAppend = barIndex === this.processedBars;
    const canReplaceLast =
      this.processedBars > 0 && barIndex === this.processedBars - 1;
    if (!canAppend && !canReplaceLast) {
      throw new RangeError("XKontrol can only append or replace the active bar");
    }

    const code =
      barIndex < MINIMUM_BAR_INDEX ? 0 : this.computeCurrentBar(barIndex, bar);
    this.outputCodes[barIndex] = code;
    if (canAppend) this.processedBars += 1;
    return code;
  }

  private computeCurrentBar(barIndex: number, bar: Bar): XKontrolCode {
    const current = this.slot(barIndex);

    this.open[current] = f32(bar.open);
    this.high[current] = f32(bar.high);
    this.low[current] = f32(bar.low);
    this.close[current] = f32(bar.close);
    this.volume[current] = f32(bar.volume);

    if (barIndex !== 0) this.updateDirectionalMarker(barIndex);

    this.pace[current] = 0;
    this.direction[current] = 0;
    this.controlPace[current] = 0;
    this.xKontrol[current] = 0;
    this.initialControl[current] = 0;

    const open = this.open[current];
    const high = this.high[current];
    const low = this.low[current];
    const close = this.close[current];
    const volume = this.volume[current];
    let side: number;

    if (close > open) {
      side = 1;
    } else if (close < open) {
      side = -1;
    } else {
      const upperWick = f32(high - open);
      const lowerWick = f32(open - low);
      if (upperWick > lowerWick) {
        side = 1;
      } else if (lowerWick > upperWick) {
        side = -1;
      } else {
        const previous = this.slot(barIndex - 1);
        const previousClose = this.close[previous];
        if (close > previousClose) side = 1;
        else if (close < previousClose) side = -1;
        else side = this.direction[previous];
      }
    }

    this.direction[current] = side;

    const bodyDifference = f32(close - open);
    const rangeDifference = f32(high - low);
    const bodyTicks = f32(f32(Math.abs(bodyDifference) / this.tickSize) + 1);
    const rangeTicks = f32(f32(rangeDifference / this.tickSize) + 1);
    const bodyRatio = f32(bodyTicks / rangeTicks);
    let rawPace = f32(volume * volume);
    rawPace = f32(rawPace * bodyRatio);
    const currentPace = f32(
      Math.pow(rawPace, PACE_EXPONENT) / PACE_DIVISOR,
    );
    this.pace[current] = currentPace;

    let scan = barIndex;
    const scanStop = barIndex - SCAN_LIMIT;
    let sameSideSum = 0;
    let paceBeforeWave = currentPace;

    while (this.direction[this.slot(scan)] === side) {
      scan -= 1;
      sameSideSum = f32(sameSideSum + paceBeforeWave);
      paceBeforeWave = this.pace[this.slot(scan)];
      if (scan === scanStop) break;
    }

    if (sameSideSum <= paceBeforeWave) return this.codeAtSlot(current);

    this.controlPace[current] = currentPace;

    let candidateIndex = barIndex;
    const candidateStop = barIndex - SCAN_LIMIT;
    let initialIndex = 0;
    let controlStartIndex = 0;
    let candidateValue = this.controlPace[current];

    while (candidateIndex !== candidateStop) {
      if (candidateValue !== 0) {
        const candidateSlot = this.slot(candidateIndex);
        if (this.direction[candidateSlot] !== side) break;

        controlStartIndex = candidateIndex;
        if (this.direction[candidateSlot] === this.diDirection[candidateSlot]) {
          initialIndex = candidateIndex;
        }
      }

      candidateIndex -= 1;
      candidateValue = this.controlPace[this.slot(candidateIndex)];
    }

    const oppositeStop = candidateIndex - SCAN_LIMIT;
    let oppositeMaxPace = 0;
    let oppositeSumPace = 0;
    let oppositeMaxLevel = 0;

    while (candidateIndex !== oppositeStop) {
      const candidateSlot = this.slot(candidateIndex);
      if (
        this.direction[candidateSlot] !== -side &&
        candidateValue !== 0
      ) {
        break;
      }

      if (candidateValue > oppositeMaxPace) {
        oppositeMaxPace = candidateValue;
      }

      const priorLevel = Math.abs(Math.trunc(this.xKontrol[candidateSlot]));
      if (priorLevel > oppositeMaxLevel) oppositeMaxLevel = priorLevel;

      oppositeSumPace = f32(oppositeSumPace + candidateValue);
      candidateIndex -= 1;
      if (candidateIndex === oppositeStop) break;
      candidateValue = this.controlPace[this.slot(candidateIndex)];
    }

    if (barIndex < controlStartIndex) {
      if (initialIndex > 0) this.setControl(initialIndex, side);
      return this.codeAtSlot(current);
    }

    let cumulativeCurrentPace = 0;
    const totalThreshold = f32(oppositeSumPace * TOTAL_RATIO);
    let strongIndex = 0;
    let totalIndex = 0;

    for (let index = controlStartIndex; index <= barIndex; index += 1) {
      const indexSlot = this.slot(index);
      const value = this.controlPace[indexSlot];
      cumulativeCurrentPace = f32(cumulativeCurrentPace + value);

      const markerIsValid =
        index !== 0 &&
        initialIndex <= index &&
        this.diDirection[indexSlot] === this.direction[indexSlot];

      if (strongIndex === 0) {
        const reachedGoldenRatio =
          cumulativeCurrentPace >= oppositeMaxPace * STRONG_RATIO;
        const exceededPriorPeak =
          value > oppositeMaxPace && oppositeMaxLevel === 2;
        if ((reachedGoldenRatio || exceededPriorPeak) && markerIsValid) {
          strongIndex = index;
        }
      }

      const reachedTotal = cumulativeCurrentPace >= totalThreshold;
      const carriedTotal =
        oppositeMaxLevel === 3 && value > oppositeMaxPace;
      if ((reachedTotal || carriedTotal) && markerIsValid) {
        totalIndex = index;
        break;
      }
    }

    if (initialIndex > 0) {
      this.setControl(initialIndex, side);
      this.initialControl[this.slot(initialIndex)] = side;
    }
    if (strongIndex > 0) this.setControl(strongIndex, side * 2);
    if (totalIndex > 0) this.setControl(totalIndex, side * 3);

    return this.codeAtSlot(current);
  }

  private updateDirectionalMarker(barIndex: number): void {
    const current = this.slot(barIndex);
    const previous = this.slot(barIndex - 1);

    const high = this.high[current];
    const low = this.low[current];
    const previousClose = this.close[previous];
    const trueHigh = high > previousClose ? high : previousClose;
    const trueLow = low < previousClose ? low : previousClose;
    const upMove = f32(high - this.high[previous]);
    const downMove = f32(this.low[previous] - low);
    let plusMove = 0;
    let minusMove = 0;

    if (downMove < upMove && upMove > 0) plusMove = upMove;
    if (upMove < downMove && downMove > 0) minusMove = downMove;

    const factor = 1;
    this.smoothBase[current] = f32(
      f32(f32(factor - this.smoothBase[previous]) * DIRECTIONAL_ALPHA) +
        this.smoothBase[previous],
    );
    this.smoothPlusDm[current] = f32(
      f32(
        f32(f32(plusMove * factor) - this.smoothPlusDm[previous]) *
          DIRECTIONAL_ALPHA,
      ) + this.smoothPlusDm[previous],
    );
    this.smoothMinusDm[current] = f32(
      f32(
        f32(f32(minusMove * factor) - this.smoothMinusDm[previous]) *
          DIRECTIONAL_ALPHA,
      ) + this.smoothMinusDm[previous],
    );
    const trueRange = f32(trueHigh - trueLow);
    this.smoothTrueRange[current] = f32(
      f32(
        f32(f32(factor * trueRange) - this.smoothTrueRange[previous]) *
          DIRECTIONAL_ALPHA,
      ) + this.smoothTrueRange[previous],
    );

    let normalizedPlus: number;
    let normalizedMinus: number;
    let normalizedRange: number;
    if (this.smoothBase[current] <= 1) {
      normalizedPlus = this.smoothPlusDm[current];
      normalizedMinus = this.smoothMinusDm[current];
      normalizedRange = this.smoothTrueRange[current];
    } else {
      normalizedPlus = f32(
        this.smoothPlusDm[current] / this.smoothBase[current],
      );
      normalizedMinus = f32(
        this.smoothMinusDm[current] / this.smoothBase[current],
      );
      normalizedRange = f32(
        this.smoothTrueRange[current] / this.smoothBase[current],
      );
    }

    // Native leaves the recycled ring-slot DI values untouched when TR is 0.
    if (normalizedRange > 0) {
      this.plusDi[current] = f32((normalizedPlus * 100) / normalizedRange);
      this.minusDi[current] = f32((normalizedMinus * 100) / normalizedRange);
    }

    this.diDirection[current] =
      f32(this.plusDi[current] - this.minusDi[current]) < 0 ? -1 : 1;
  }

  private setControl(absoluteBar: number, code: number): void {
    this.xKontrol[this.slot(absoluteBar)] = code;
  }

  private codeAtSlot(slot: number): XKontrolCode {
    return Math.trunc(this.xKontrol[slot]) as XKontrolCode;
  }

  private slot(absoluteBar: number): number {
    const slot = absoluteBar % RING_SIZE;
    return slot < 0 ? slot + RING_SIZE : slot;
  }
}

/** Stateless convenience wrapper for history/replay callers. */
export function calculateXKontrol(
  bars: readonly Bar[],
  tickSize = XKONTROL_GC_TICK_SIZE,
): XKontrolSignal[] {
  const engine = new XKontrolEngine(tickSize);
  engine.setBars(bars);
  return engine.signals(bars);
}
