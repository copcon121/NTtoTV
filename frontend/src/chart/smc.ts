import { type Bar } from "../cache/types";

export interface SmcSettings {
  enabled: boolean;
  swingLength: number;
  internalLength: number;
  showInternal: boolean;
  showZones: boolean;
  showPremiumDiscount: boolean;
  showSwingOrderBlocks: boolean;
  showInternalOrderBlocks: boolean;
  fvgAutoThreshold: boolean;
  fvgThresholdLookback: number;
  fvgThresholdMultiplier: number;
  fvgVolumeConfirmation: boolean;
  fvgExtendBars: number;
  structureLineExtendBars: number;
  maxZoneAge: number;
  maxMarkers: number;
  maxZones: number;
  maxSwingOrderBlocks: number;
  maxInternalOrderBlocks: number;
  maxFairValueGaps: number;
}

export const DEFAULT_SMC_SETTINGS: SmcSettings = {
  enabled: false,
  swingLength: 50,
  internalLength: 5,
  showInternal: true,
  showZones: true,
  showPremiumDiscount: true,
  showSwingOrderBlocks: true,
  showInternalOrderBlocks: true,
  fvgAutoThreshold: true,
  fvgThresholdLookback: 60,
  fvgThresholdMultiplier: 1.5,
  fvgVolumeConfirmation: false,
  fvgExtendBars: 3,
  structureLineExtendBars: 30,
  maxZoneAge: 500,
  maxMarkers: 120,
  maxZones: 20,
  maxSwingOrderBlocks: 10,
  maxInternalOrderBlocks: 10,
  maxFairValueGaps: 10,
};

type Direction = 1 | -1;
type Scope = "swing" | "internal";

const FVG_VOLUME_LOOKBACK = 20;
const ORDER_BLOCK_WIDE_RANGE_LOOKBACK = 20;
const ORDER_BLOCK_WIDE_RANGE_MULTIPLIER = 2;
const DEFAULT_BAR_STEP_MS = 60_000;

export type SmcMarkerKind =
  | "bos"
  | "choch"
  | "swing_label"
  | "internal_label";

export interface SmcMarker {
  id: string;
  time: number;
  direction: Direction;
  label: string;
  scope: Scope;
  kind: SmcMarkerKind;
}

export type SmcZoneKind = "ob" | "fvg" | "pd";
export type SmcPremiumDiscountKind = "premium" | "equilibrium" | "discount";

export interface SmcZone {
  id: string;
  kind: SmcZoneKind;
  scope: Scope;
  direction: Direction;
  pdKind?: SmcPremiumDiscountKind;
  startTime: number;
  endTime?: number;
  extendBars?: number;
  top: number;
  bottom: number;
  label: string;
}

export type SmcLineKind = "structure";

export interface SmcLine {
  id: string;
  kind: SmcLineKind;
  scope: Scope;
  direction: Direction;
  startTime: number;
  endTime: number;
  labelTime: number;
  price: number;
  label: string;
}

export interface SmcOverlay {
  markers: SmcMarker[];
  zones: SmcZone[];
  lines: SmcLine[];
  swingTrend: number;
  internalTrend: number;
}

interface SwingPoint {
  price: number;
  barIndex: number;
  timestamp: number;
  type: Direction;
  crossed: boolean;
}

interface OrderBlock {
  top: number;
  bottom: number;
  barIndex: number;
  createdBarIndex: number;
  timestamp: number;
  type: Direction;
  mitigated: boolean;
  active: boolean;
}

interface OrderBlockCandidate extends Omit<OrderBlock, "active"> {
  promoted: boolean;
}

interface Fvg {
  top: number;
  bottom: number;
  barIndex: number;
  timestamp: number;
  type: Direction;
  mitigated: boolean;
  active: boolean;
}

class StructureState {
  swingHigh: SwingPoint | undefined;
  swingLow: SwingPoint | undefined;
  internalHigh: SwingPoint | undefined;
  internalLow: SwingPoint | undefined;

  prevSwingHigh: SwingPoint | undefined;
  prevSwingLow: SwingPoint | undefined;
  prevInternalHigh: SwingPoint | undefined;
  prevInternalLow: SwingPoint | undefined;

  swingHh = false;
  swingLh = false;
  swingHl = false;
  swingLl = false;
  internalHh = false;
  internalLh = false;
  internalHl = false;
  internalLl = false;

  swingTrend = 0;
  internalTrend = 0;
  trailingTop = Number.NEGATIVE_INFINITY;
  trailingBottom = Number.POSITIVE_INFINITY;

  bosBull = false;
  bosBear = false;
  chochBull = false;
  chochBear = false;
  internalBosBull = false;
  internalBosBear = false;
  internalChochBull = false;
  internalChochBear = false;

  sweptPrevExtHigh = false;
  sweptPrevExtLow = false;
  sweptPrevIntHigh = false;
  sweptPrevIntLow = false;

  obBullIntMitigated = false;
  obBearIntMitigated = false;
  obBullExtMitigated = false;
  obBearExtMitigated = false;

  resetPulses(): void {
    this.bosBull = false;
    this.bosBear = false;
    this.chochBull = false;
    this.chochBear = false;
    this.internalBosBull = false;
    this.internalBosBear = false;
    this.internalChochBull = false;
    this.internalChochBear = false;

    this.swingHh = false;
    this.swingLh = false;
    this.swingHl = false;
    this.swingLl = false;
    this.internalHh = false;
    this.internalLh = false;
    this.internalHl = false;
    this.internalLl = false;

    this.sweptPrevExtHigh = false;
    this.sweptPrevExtLow = false;
    this.sweptPrevIntHigh = false;
    this.sweptPrevIntLow = false;

    this.obBullIntMitigated = false;
    this.obBearIntMitigated = false;
    this.obBullExtMitigated = false;
    this.obBearExtMitigated = false;
  }
}

class LuxSmc {
  private readonly swingLength: number;
  private readonly internalLength: number;
  private readonly maxZoneAge: number;
  private readonly fvgAutoThreshold: boolean;
  private readonly fvgThresholdLookback: number;
  private readonly fvgThresholdMultiplier: number;
  private readonly fvgVolumeConfirmation: boolean;
  private readonly maxBuffer: number;

  private readonly highs: number[] = [];
  private readonly lows: number[] = [];
  private readonly closes: number[] = [];
  private readonly opens: number[] = [];
  private readonly volumes: number[] = [];
  private readonly bodyDeltaPercents: number[] = [];
  private readonly timestamps: number[] = [];
  private readonly indices: number[] = [];

  readonly state = new StructureState();
  readonly swingObs: OrderBlock[] = [];
  readonly internalObs: OrderBlock[] = [];
  readonly fvgs: Fvg[] = [];
  private readonly swingObStack: OrderBlockCandidate[] = [];

  private lastSwingLeg = 0;
  private lastInternalLeg = 0;

  constructor(
    settings: Pick<
      SmcSettings,
      | "swingLength"
      | "internalLength"
      | "maxZoneAge"
      | "fvgAutoThreshold"
      | "fvgThresholdLookback"
      | "fvgThresholdMultiplier"
      | "fvgVolumeConfirmation"
    >,
  ) {
    this.swingLength = Math.max(1, Math.round(settings.swingLength));
    this.internalLength = Math.max(1, Math.round(settings.internalLength));
    this.maxZoneAge = Math.max(1, Math.round(settings.maxZoneAge));
    this.fvgAutoThreshold = settings.fvgAutoThreshold;
    this.fvgThresholdLookback = settings.fvgThresholdLookback;
    this.fvgThresholdMultiplier = settings.fvgThresholdMultiplier;
    this.fvgVolumeConfirmation = settings.fvgVolumeConfirmation;
    this.maxBuffer = Math.max(
      2000,
      this.maxZoneAge + Math.max(this.swingLength, this.internalLength) * 4,
      this.fvgThresholdLookback + FVG_VOLUME_LOOKBACK + 10,
    );
  }

  update(bar: Bar, barIndex: number): StructureState {
    this.highs.push(bar.high);
    this.lows.push(bar.low);
    this.closes.push(bar.close);
    this.opens.push(bar.open);
    this.volumes.push(bar.volume);
    this.bodyDeltaPercents.push(candleBodyDeltaPercent(bar.open, bar.close));
    this.timestamps.push(bar.time);
    this.indices.push(barIndex);

    if (this.highs.length > this.maxBuffer) {
      this.highs.shift();
      this.lows.shift();
      this.closes.shift();
      this.opens.shift();
      this.volumes.shift();
      this.bodyDeltaPercents.shift();
      this.timestamps.shift();
      this.indices.shift();
    }

    this.state.resetPulses();

    if (this.highs.length <= this.swingLength + 1) {
      return this.state;
    }

    this.updateTrailingExtremes(bar.high, bar.low);
    this.processStructure(this.swingLength, false, barIndex);
    this.processStructure(this.internalLength, true, barIndex);
    this.detectFvgs(barIndex);
    this.maintainZones(bar.high, bar.low, bar.close, barIndex);
    this.detectSweeps(bar.high, bar.low);

    return this.state;
  }

  private updateTrailingExtremes(high: number, low: number): void {
    this.state.trailingTop = Math.max(this.state.trailingTop, high);
    this.state.trailingBottom = Math.min(this.state.trailingBottom, low);
  }

  private processStructure(length: number, isInternal: boolean, barIndex: number): void {
    if (this.highs.length < length + 1) return;

    const candidatePos = this.highs.length - length - 1;
    const candidateHigh = this.highs[candidatePos];
    const candidateLow = this.lows[candidatePos];
    const recentHighs = this.highs.slice(this.highs.length - length);
    const recentLows = this.lows.slice(this.lows.length - length);

    const newLegHigh = candidateHigh > Math.max(...recentHighs);
    const newLegLow = candidateLow < Math.min(...recentLows);

    const prevLeg = isInternal ? this.lastInternalLeg : this.lastSwingLeg;
    let leg = prevLeg;
    if (newLegHigh) leg = -1;
    else if (newLegLow) leg = 1;

    if (leg === 0) {
      this.checkBosChoch(isInternal, barIndex);
      return;
    }

    const legChanged = prevLeg !== leg;
    if (isInternal) this.lastInternalLeg = leg;
    else this.lastSwingLeg = leg;

    if (!legChanged) {
      this.checkBosChoch(isInternal, barIndex);
      return;
    }

    const pivotBarIndex = this.indices[candidatePos];
    const pivotTimestamp = this.timestamps[candidatePos];

    if (leg === 1) {
      const pivot: SwingPoint = {
        price: candidateLow,
        barIndex: pivotBarIndex,
        timestamp: pivotTimestamp,
        type: -1,
        crossed: false,
      };
      if (isInternal) {
        const lastLow = this.state.internalLow;
        if (lastLow) {
          if (candidateLow < lastLow.price) this.state.internalLl = true;
          else this.state.internalHl = true;
        }
        this.state.prevInternalLow = this.state.internalLow;
        this.state.internalLow = pivot;
      } else {
        const lastLow = this.state.swingLow;
        if (lastLow) {
          if (candidateLow < lastLow.price) this.state.swingLl = true;
          else this.state.swingHl = true;
        }
        this.state.prevSwingLow = this.state.swingLow;
        this.state.swingLow = pivot;
        this.state.trailingBottom = candidateLow;
        this.addSwingOrderBlockCandidate(pivot, 1, barIndex);
      }
    } else {
      const pivot: SwingPoint = {
        price: candidateHigh,
        barIndex: pivotBarIndex,
        timestamp: pivotTimestamp,
        type: 1,
        crossed: false,
      };
      if (isInternal) {
        const lastHigh = this.state.internalHigh;
        if (lastHigh) {
          if (candidateHigh > lastHigh.price) this.state.internalHh = true;
          else this.state.internalLh = true;
        }
        this.state.prevInternalHigh = this.state.internalHigh;
        this.state.internalHigh = pivot;
      } else {
        const lastHigh = this.state.swingHigh;
        if (lastHigh) {
          if (candidateHigh > lastHigh.price) this.state.swingHh = true;
          else this.state.swingLh = true;
        }
        this.state.prevSwingHigh = this.state.swingHigh;
        this.state.swingHigh = pivot;
        this.state.trailingTop = candidateHigh;
        this.addSwingOrderBlockCandidate(pivot, -1, barIndex);
      }
    }

    this.checkBosChoch(isInternal, barIndex);
  }

  private checkBosChoch(isInternal: boolean, barIndex: number): void {
    if (this.closes.length < 2) return;
    const currentClose = this.closes[this.closes.length - 1];
    const prevClose = this.closes[this.closes.length - 2];

    const activeHigh = isInternal ? this.state.internalHigh : this.state.swingHigh;
    if (activeHigh && !activeHigh.crossed) {
      const crossedHigh =
        currentClose > activeHigh.price && prevClose <= activeHigh.price;
      if (crossedHigh) {
        activeHigh.crossed = true;
        const trendBias = isInternal
          ? this.state.internalTrend
          : this.state.swingTrend;
        const isChoch = trendBias === -1;
        if (isInternal) {
          this.state.internalTrend = 1;
          if (isChoch) this.state.internalChochBull = true;
          else this.state.internalBosBull = true;
        } else {
          this.state.swingTrend = 1;
          if (isChoch) this.state.chochBull = true;
          else this.state.bosBull = true;
        }
        if (!isInternal || isChoch) {
          this.createOrderBlock(activeHigh, 1, isInternal);
        }
      }
    }

    const activeLow = isInternal ? this.state.internalLow : this.state.swingLow;
    if (activeLow && !activeLow.crossed) {
      const crossedLow =
        currentClose < activeLow.price && prevClose >= activeLow.price;
      if (crossedLow) {
        activeLow.crossed = true;
        const trendBias = isInternal
          ? this.state.internalTrend
          : this.state.swingTrend;
        const isChoch = trendBias === 1;
        if (isInternal) {
          this.state.internalTrend = -1;
          if (isChoch) this.state.internalChochBear = true;
          else this.state.internalBosBear = true;
        } else {
          this.state.swingTrend = -1;
          if (isChoch) this.state.chochBear = true;
          else this.state.bosBear = true;
        }
        if (!isInternal || isChoch) {
          this.createOrderBlock(activeLow, -1, isInternal);
        }
      }
    }

    void barIndex;
  }

  private createOrderBlock(
    brokenPivot: SwingPoint,
    direction: Direction,
    isInternal: boolean,
  ): void {
    const bufferStartPos = this.indices.indexOf(brokenPivot.barIndex);
    if (bufferStartPos < 0) return;

    const rangeHighs = this.highs.slice(bufferStartPos);
    const rangeLows = this.lows.slice(bufferStartPos);
    if (rangeHighs.length === 0) return;

    let obCandlePos = 0;
    if (direction === 1) {
      const minLow = Math.min(...rangeLows);
      obCandlePos = rangeLows.indexOf(minLow);
    } else {
      const maxHigh = Math.max(...rangeHighs);
      obCandlePos = rangeHighs.indexOf(maxHigh);
    }

    const ob = this.orderBlockFromBufferCandle(
      bufferStartPos + obCandlePos,
      direction,
      this.indices[this.indices.length - 1],
    );
    if (!ob) return;

    const target = isInternal ? this.internalObs : this.swingObs;
    target.unshift(ob);
    if (target.length > 20) target.pop();
    if (!isInternal) {
      this.addSwingOrderBlockToStack(ob, true);
    }
  }

  private addSwingOrderBlockCandidate(
    pivot: SwingPoint,
    direction: Direction,
    createdBarIndex: number,
  ): void {
    const candlePos = this.indices.indexOf(pivot.barIndex);
    if (candlePos < 0) return;
    const ob = this.orderBlockFromBufferCandle(
      candlePos,
      direction,
      createdBarIndex,
    );
    if (!ob) return;
    this.addSwingOrderBlockToStack(ob, false);
  }

  private orderBlockFromBufferCandle(
    candlePos: number,
    direction: Direction,
    createdBarIndex: number,
  ): OrderBlock | undefined {
    const sourceIndex = this.indices[candlePos];
    const sourceTimestamp = this.timestamps[candlePos];
    if (sourceIndex === undefined || sourceTimestamp === undefined) return undefined;
    const bounds = this.orderBlockBounds(candlePos, direction);
    return {
      top: bounds.top,
      bottom: bounds.bottom,
      barIndex: sourceIndex,
      createdBarIndex,
      timestamp: sourceTimestamp,
      type: direction,
      mitigated: false,
      active: true,
    };
  }

  private addSwingOrderBlockToStack(ob: OrderBlock, promoted: boolean): void {
    const existing = this.swingObStack.find((candidate) =>
      this.sameOrderBlock(candidate, ob),
    );
    if (existing) {
      if (promoted) existing.promoted = true;
      if (ob.mitigated) existing.mitigated = true;
      return;
    }
    this.swingObStack.unshift({
      top: ob.top,
      bottom: ob.bottom,
      barIndex: ob.barIndex,
      createdBarIndex: ob.createdBarIndex,
      timestamp: ob.timestamp,
      type: ob.type,
      mitigated: ob.mitigated,
      promoted,
    });
    if (this.swingObStack.length > 80) this.swingObStack.pop();
  }

  private sameOrderBlock(
    left: OrderBlock | OrderBlockCandidate,
    right: OrderBlock | OrderBlockCandidate,
  ): boolean {
    return (
      left.type === right.type &&
      left.barIndex === right.barIndex &&
      left.top === right.top &&
      left.bottom === right.bottom
    );
  }

  private orderBlockBounds(
    candlePos: number,
    direction: Direction,
  ): { top: number; bottom: number } {
    const high = this.highs[candlePos];
    const low = this.lows[candlePos];
    const open = this.opens[candlePos];
    const close = this.closes[candlePos];
    const range = high - low;
    const averageRange = this.averageRangeBefore(candlePos);
    const isWideRange =
      averageRange > 0 &&
      range > averageRange * ORDER_BLOCK_WIDE_RANGE_MULTIPLIER;

    if (isWideRange) {
      if (direction === 1) {
        const bodyLow = Math.min(open, close);
        if (bodyLow > low) {
          return { top: bodyLow, bottom: low };
        }
      } else {
        const bodyHigh = Math.max(open, close);
        if (high > bodyHigh) {
          return { top: high, bottom: bodyHigh };
        }
      }
    }

    return { top: high, bottom: low };
  }

  private averageRangeBefore(candlePos: number): number {
    const start = Math.max(0, candlePos - ORDER_BLOCK_WIDE_RANGE_LOOKBACK);
    let sum = 0;
    let count = 0;

    for (let i = start; i < candlePos; i += 1) {
      const range = this.highs[i] - this.lows[i];
      if (!Number.isFinite(range) || range <= 0) continue;
      sum += range;
      count += 1;
    }

    return count > 0 ? sum / count : 0;
  }

  private detectFvgs(barIndex: number): void {
    if (this.highs.length < 3) return;
    const currLow = this.lows[this.lows.length - 1];
    const currHigh = this.highs[this.highs.length - 1];
    const prevPos = this.closes.length - 2;
    const prevClose = this.closes[prevPos];
    const prevBodyDeltaPercent = this.bodyDeltaPercents[prevPos] ?? 0;
    const threshold = this.fvgBodyThreshold(prevPos);
    const volumeConfirmed = this.fvgVolumeConfirmed(prevPos);
    const prev2High = this.highs[this.highs.length - 3];
    const prev2Low = this.lows[this.lows.length - 3];
    const prevTimestamp = this.timestamps[this.timestamps.length - 2];

    if (
      currLow > prev2High &&
      prevClose > prev2High &&
      prevBodyDeltaPercent > threshold &&
      volumeConfirmed
    ) {
      const gap = currLow - prev2High;
      if (gap > 0) {
        this.fvgs.unshift({
          top: currLow,
          bottom: prev2High,
          barIndex: barIndex - 1,
          timestamp: prevTimestamp,
          type: 1,
          mitigated: false,
          active: true,
        });
      }
    }

    if (
      currHigh < prev2Low &&
      prevClose < prev2Low &&
      -prevBodyDeltaPercent > threshold &&
      volumeConfirmed
    ) {
      const gap = prev2Low - currHigh;
      if (gap > 0) {
        this.fvgs.unshift({
          top: prev2Low,
          bottom: currHigh,
          barIndex: barIndex - 1,
          timestamp: prevTimestamp,
          type: -1,
          mitigated: false,
          active: true,
        });
      }
    }

    if (this.fvgs.length > 50) this.fvgs.pop();
  }

  private fvgBodyThreshold(prevPos: number): number {
    if (!this.fvgAutoThreshold) return 0;
    const averageBody = rollingAbsAverage(
      this.bodyDeltaPercents,
      prevPos,
      this.fvgThresholdLookback,
    );
    return averageBody * this.fvgThresholdMultiplier;
  }

  private fvgVolumeConfirmed(prevPos: number): boolean {
    if (!this.fvgVolumeConfirmation) return true;
    const volume = this.volumes[prevPos];
    if (!Number.isFinite(volume) || volume <= 0) return true;
    const averageVolume = rollingAverage(
      this.volumes,
      prevPos,
      FVG_VOLUME_LOOKBACK,
      (value) => Number.isFinite(value) && value > 0,
    );
    return averageVolume <= 0 || volume > averageVolume;
  }

  private maintainZones(
    high: number,
    low: number,
    close: number,
    currentIndex: number,
  ): void {
    this.filterOrderBlocks(this.swingObs, high, low, close, currentIndex, false);
    this.filterOrderBlocks(this.internalObs, high, low, close, currentIndex, true);
    this.maintainSwingOrderBlockStack(close, currentIndex);

    for (let i = this.fvgs.length - 1; i >= 0; i -= 1) {
      const fvg = this.fvgs[i];
      if (!fvg.active) {
        fvg.active = false;
        this.fvgs.splice(i, 1);
        continue;
      }
      if (fvg.type === 1 && low < fvg.bottom) {
        fvg.mitigated = true;
        fvg.active = false;
        this.fvgs.splice(i, 1);
      } else if (fvg.type === -1 && high > fvg.top) {
        fvg.mitigated = true;
        fvg.active = false;
        this.fvgs.splice(i, 1);
      }
    }
  }

  private filterOrderBlocks(
    obs: OrderBlock[],
    high: number,
    low: number,
    close: number,
    currentIndex: number,
    isInternal: boolean,
  ): void {
    for (let i = obs.length - 1; i >= 0; i -= 1) {
      const ob = obs[i];
      if (!ob.active || currentIndex - ob.createdBarIndex > this.maxZoneAge) {
        ob.active = false;
        obs.splice(i, 1);
        continue;
      }
      const bullishMitigated =
        ob.type === 1 && (isInternal ? low < ob.bottom : close < ob.bottom);
      const bearishMitigated =
        ob.type === -1 && (isInternal ? high > ob.top : close > ob.top);
      if (bullishMitigated) {
        ob.mitigated = true;
        ob.active = false;
        if (isInternal) this.state.obBullIntMitigated = true;
        else this.state.obBullExtMitigated = true;
        obs.splice(i, 1);
      } else if (bearishMitigated) {
        ob.mitigated = true;
        ob.active = false;
        if (isInternal) this.state.obBearIntMitigated = true;
        else this.state.obBearExtMitigated = true;
        obs.splice(i, 1);
      } else {
        continue;
      }
      if (!isInternal) {
        this.markSwingStackMitigated(ob);
        this.promoteNextSwingOrderBlock(ob, close, currentIndex);
      }
    }
  }

  private markSwingStackMitigated(ob: OrderBlock): void {
    const candidate = this.swingObStack.find((entry) =>
      this.sameOrderBlock(entry, ob),
    );
    if (candidate) {
      candidate.mitigated = true;
    }
  }

  private maintainSwingOrderBlockStack(
    close: number,
    currentIndex: number,
  ): void {
    for (const candidate of this.swingObStack) {
      if (candidate.mitigated) continue;
      if (currentIndex - candidate.createdBarIndex > this.maxZoneAge) {
        candidate.mitigated = true;
        continue;
      }
      if (
        (candidate.type === 1 && close < candidate.bottom) ||
        (candidate.type === -1 && close > candidate.top)
      ) {
        candidate.mitigated = true;
      }
    }
  }

  private promoteNextSwingOrderBlock(
    broken: OrderBlock,
    close: number,
    currentIndex: number,
  ): void {
    const candidates = this.swingObStack.filter((candidate) =>
      this.canPromoteSwingOrderBlock(candidate, broken, close, currentIndex),
    );
    candidates.sort((a, b) => {
      if (broken.type === -1) {
        return a.top - b.top || b.timestamp - a.timestamp;
      }
      return b.bottom - a.bottom || b.timestamp - a.timestamp;
    });
    const next = candidates[0];
    if (!next) return;
    next.promoted = true;
    const promoted: OrderBlock = {
      top: next.top,
      bottom: next.bottom,
      barIndex: next.barIndex,
      createdBarIndex: currentIndex,
      timestamp: next.timestamp,
      type: next.type,
      mitigated: false,
      active: true,
    };
    if (!this.swingObs.some((ob) => this.sameOrderBlock(ob, promoted))) {
      this.swingObs.unshift(promoted);
      if (this.swingObs.length > 20) this.swingObs.pop();
    }
  }

  private canPromoteSwingOrderBlock(
    candidate: OrderBlockCandidate,
    broken: OrderBlock,
    close: number,
    currentIndex: number,
  ): boolean {
    if (
      candidate.type !== broken.type ||
      candidate.promoted ||
      candidate.mitigated ||
      currentIndex - candidate.createdBarIndex > this.maxZoneAge
    ) {
      return false;
    }
    if (candidate.type === -1) {
      return candidate.top > broken.top && close <= candidate.top;
    }
    return candidate.bottom < broken.bottom && close >= candidate.bottom;
  }

  private detectSweeps(high: number, low: number): void {
    const prevHigh =
      this.highs.length > 1
        ? this.highs[this.highs.length - 2]
        : Number.NEGATIVE_INFINITY;
    const prevLow =
      this.lows.length > 1
        ? this.lows[this.lows.length - 2]
        : Number.POSITIVE_INFINITY;

    if (
      this.state.swingHigh &&
      high > this.state.swingHigh.price &&
      prevHigh <= this.state.swingHigh.price
    ) {
      this.state.sweptPrevExtHigh = true;
    }
    if (
      this.state.swingLow &&
      low < this.state.swingLow.price &&
      prevLow >= this.state.swingLow.price
    ) {
      this.state.sweptPrevExtLow = true;
    }
    if (
      this.state.internalHigh &&
      high > this.state.internalHigh.price &&
      prevHigh <= this.state.internalHigh.price
    ) {
      this.state.sweptPrevIntHigh = true;
    }
    if (
      this.state.internalLow &&
      low < this.state.internalLow.price &&
      prevLow >= this.state.internalLow.price
    ) {
      this.state.sweptPrevIntLow = true;
    }
  }
}

function candleBodyDeltaPercent(open: number, close: number): number {
  if (!Number.isFinite(open) || !Number.isFinite(close) || open === 0) {
    return 0;
  }
  return (close - open) / Math.abs(open);
}

function rollingAbsAverage(
  values: readonly number[],
  endExclusive: number,
  lookback: number,
): number {
  return rollingAverage(values, endExclusive, lookback, Number.isFinite, Math.abs);
}

function rollingAverage(
  values: readonly number[],
  endExclusive: number,
  lookback: number,
  include: (value: number) => boolean = Number.isFinite,
  map: (value: number) => number = (value) => value,
): number {
  const start = Math.max(0, endExclusive - Math.max(1, lookback));
  let sum = 0;
  let count = 0;
  for (let i = start; i < endExclusive; i += 1) {
    const value = values[i];
    if (!include(value)) continue;
    sum += map(value);
    count += 1;
  }
  return count > 0 ? sum / count : 0;
}

function settingsWithDefaults(settings?: Partial<SmcSettings>): SmcSettings {
  const rawFvgThresholdLookback =
    settings?.fvgThresholdLookback ?? DEFAULT_SMC_SETTINGS.fvgThresholdLookback;
  const rawFvgThresholdMultiplier =
    settings?.fvgThresholdMultiplier ??
    DEFAULT_SMC_SETTINGS.fvgThresholdMultiplier;
  return {
    ...DEFAULT_SMC_SETTINGS,
    ...settings,
    swingLength: Math.max(
      1,
      Math.round(settings?.swingLength ?? DEFAULT_SMC_SETTINGS.swingLength),
    ),
    internalLength: Math.max(
      1,
      Math.round(settings?.internalLength ?? DEFAULT_SMC_SETTINGS.internalLength),
    ),
    maxZoneAge: Math.max(
      500,
      Math.round(settings?.maxZoneAge ?? DEFAULT_SMC_SETTINGS.maxZoneAge),
    ),
    maxMarkers: Math.max(
      0,
      Math.round(settings?.maxMarkers ?? DEFAULT_SMC_SETTINGS.maxMarkers),
    ),
    maxZones: Math.max(
      0,
      Math.round(settings?.maxZones ?? DEFAULT_SMC_SETTINGS.maxZones),
    ),
    maxSwingOrderBlocks: Math.max(
      0,
      Math.round(
        settings?.maxSwingOrderBlocks ?? DEFAULT_SMC_SETTINGS.maxSwingOrderBlocks,
      ),
    ),
    maxInternalOrderBlocks: Math.max(
      0,
      Math.round(
        settings?.maxInternalOrderBlocks ??
          DEFAULT_SMC_SETTINGS.maxInternalOrderBlocks,
      ),
    ),
    maxFairValueGaps: Math.max(
      0,
      Math.round(
        settings?.maxFairValueGaps ?? DEFAULT_SMC_SETTINGS.maxFairValueGaps,
      ),
    ),
    showPremiumDiscount:
      settings?.showPremiumDiscount ?? DEFAULT_SMC_SETTINGS.showPremiumDiscount,
    fvgAutoThreshold:
      settings?.fvgAutoThreshold ?? DEFAULT_SMC_SETTINGS.fvgAutoThreshold,
    fvgThresholdLookback: Math.min(
      500,
      Math.max(
        1,
        Number.isFinite(rawFvgThresholdLookback)
          ? Math.round(rawFvgThresholdLookback)
          : DEFAULT_SMC_SETTINGS.fvgThresholdLookback,
      ),
    ),
    fvgThresholdMultiplier: Math.min(
      10,
      Math.max(
        0,
        Number.isFinite(rawFvgThresholdMultiplier)
          ? rawFvgThresholdMultiplier
          : DEFAULT_SMC_SETTINGS.fvgThresholdMultiplier,
      ),
    ),
    fvgVolumeConfirmation:
      settings?.fvgVolumeConfirmation ??
      DEFAULT_SMC_SETTINGS.fvgVolumeConfirmation,
    fvgExtendBars: Math.max(
      1,
      Math.round(settings?.fvgExtendBars ?? DEFAULT_SMC_SETTINGS.fvgExtendBars),
    ),
    structureLineExtendBars: Math.min(
      500,
      Math.max(
        0,
        Math.round(
          settings?.structureLineExtendBars ??
            DEFAULT_SMC_SETTINGS.structureLineExtendBars,
        ),
      ),
    ),
  };
}

function markerId(
  kind: SmcMarkerKind,
  scope: Scope,
  label: string,
  time: number,
): string {
  return `${kind}:${scope}:${label}:${time}`;
}

function addMarker(
  markers: SmcMarker[],
  marker: Omit<SmcMarker, "id">,
): void {
  markers.push({
    ...marker,
    id: markerId(marker.kind, marker.scope, marker.label, marker.time),
  });
}

function pushStateMarkers(
  markers: SmcMarker[],
  state: StructureState,
  bar: Bar,
  showInternal: boolean,
): void {
  if (state.bosBull) {
    addMarker(markers, {
      time: bar.time,
      direction: 1,
      label: "BOS",
      scope: "swing",
      kind: "bos",
    });
  }
  if (state.bosBear) {
    addMarker(markers, {
      time: bar.time,
      direction: -1,
      label: "BOS",
      scope: "swing",
      kind: "bos",
    });
  }
  if (state.chochBull) {
    addMarker(markers, {
      time: bar.time,
      direction: 1,
      label: "CHoCH",
      scope: "swing",
      kind: "choch",
    });
  }
  if (state.chochBear) {
    addMarker(markers, {
      time: bar.time,
      direction: -1,
      label: "CHoCH",
      scope: "swing",
      kind: "choch",
    });
  }

  if (state.swingHh && state.swingHigh) {
    addMarker(markers, {
      time: state.swingHigh.timestamp,
      direction: 1,
      label: "HH",
      scope: "swing",
      kind: "swing_label",
    });
  }
  if (state.swingLh && state.swingHigh) {
    addMarker(markers, {
      time: state.swingHigh.timestamp,
      direction: 1,
      label: "LH",
      scope: "swing",
      kind: "swing_label",
    });
  }
  if (state.swingHl && state.swingLow) {
    addMarker(markers, {
      time: state.swingLow.timestamp,
      direction: -1,
      label: "HL",
      scope: "swing",
      kind: "swing_label",
    });
  }
  if (state.swingLl && state.swingLow) {
    addMarker(markers, {
      time: state.swingLow.timestamp,
      direction: -1,
      label: "LL",
      scope: "swing",
      kind: "swing_label",
    });
  }

  if (!showInternal) return;

  // MT5 config shows internal structure as CHoCH only by default; internal
  // pivot labels (iHH/iHL/iLH/iLL) are deliberately not emitted here.
  if (state.internalChochBull) {
    addMarker(markers, {
      time: bar.time,
      direction: 1,
      label: "iCHoCH",
      scope: "internal",
      kind: "choch",
    });
  }
  if (state.internalChochBear) {
    addMarker(markers, {
      time: bar.time,
      direction: -1,
      label: "iCHoCH",
      scope: "internal",
      kind: "choch",
    });
  }
}

function lineId(
  scope: Scope,
  label: string,
  direction: Direction,
  startTime: number,
  endTime: number,
  price: number,
): string {
  return `structure:${scope}:${label}:${direction}:${startTime}:${endTime}:${price}`;
}

function addLine(lines: SmcLine[], line: Omit<SmcLine, "id" | "kind">): void {
  lines.push({
    ...line,
    kind: "structure",
    id: lineId(
      line.scope,
      line.label,
      line.direction,
      line.startTime,
      line.endTime,
      line.price,
    ),
  });
}

function medianPositiveStepMs(bars: readonly Bar[], centerIndex: number): number {
  const diffs: number[] = [];
  const start = Math.max(1, centerIndex - 40);
  const end = Math.min(bars.length - 1, centerIndex + 40);
  for (let index = start; index <= end; index += 1) {
    const diff = bars[index].time - bars[index - 1].time;
    if (Number.isFinite(diff) && diff > 0) {
      diffs.push(diff);
    }
  }

  if (diffs.length === 0) return DEFAULT_BAR_STEP_MS;
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)] || DEFAULT_BAR_STEP_MS;
}

function extendedStructureEndTime(
  bars: readonly Bar[],
  breakIndex: number,
  extendBars: number,
): number {
  const breakTime = bars[breakIndex]?.time;
  if (breakTime === undefined) return 0;
  if (extendBars <= 0) return breakTime;

  const targetIndex = breakIndex + extendBars;
  if (targetIndex < bars.length) {
    return bars[targetIndex].time;
  }

  return (
    breakTime + medianPositiveStepMs(bars, breakIndex) * extendBars
  );
}

function pushStateLines(
  lines: SmcLine[],
  state: StructureState,
  bars: readonly Bar[],
  barIndex: number,
  showInternal: boolean,
  structureLineExtendBars: number,
): void {
  const bar = bars[barIndex];
  if (!bar) return;
  const breakTime = bar.time;
  const swingEndTime = extendedStructureEndTime(
    bars,
    barIndex,
    structureLineExtendBars,
  );

  if (state.bosBull && state.swingHigh) {
    addLine(lines, {
      scope: "swing",
      direction: 1,
      startTime: state.swingHigh.timestamp,
      endTime: swingEndTime,
      labelTime: breakTime,
      price: state.swingHigh.price,
      label: "BOS",
    });
  }
  if (state.bosBear && state.swingLow) {
    addLine(lines, {
      scope: "swing",
      direction: -1,
      startTime: state.swingLow.timestamp,
      endTime: swingEndTime,
      labelTime: breakTime,
      price: state.swingLow.price,
      label: "BOS",
    });
  }
  if (state.chochBull && state.swingHigh) {
    addLine(lines, {
      scope: "swing",
      direction: 1,
      startTime: state.swingHigh.timestamp,
      endTime: swingEndTime,
      labelTime: breakTime,
      price: state.swingHigh.price,
      label: "CHoCH",
    });
  }
  if (state.chochBear && state.swingLow) {
    addLine(lines, {
      scope: "swing",
      direction: -1,
      startTime: state.swingLow.timestamp,
      endTime: swingEndTime,
      labelTime: breakTime,
      price: state.swingLow.price,
      label: "CHoCH",
    });
  }

  if (!showInternal) return;

  if (state.internalChochBull && state.internalHigh) {
    addLine(lines, {
      scope: "internal",
      direction: 1,
      startTime: state.internalHigh.timestamp,
      endTime: breakTime,
      labelTime: breakTime,
      price: state.internalHigh.price,
      label: "CHoCH",
    });
  }
  if (state.internalChochBear && state.internalLow) {
    addLine(lines, {
      scope: "internal",
      direction: -1,
      startTime: state.internalLow.timestamp,
      endTime: breakTime,
      labelTime: breakTime,
      price: state.internalLow.price,
      label: "CHoCH",
    });
  }
}

function orderBlockToZone(ob: OrderBlock, scope: Scope): SmcZone {
  return {
    id: `ob:${scope}:${ob.type}:${ob.barIndex}:${ob.top}:${ob.bottom}`,
    kind: "ob",
    scope,
    direction: ob.type,
    startTime: ob.timestamp,
    top: ob.top,
    bottom: ob.bottom,
    label: ob.type === 1 ? "Bull OB" : "Bear OB",
  };
}

function resolveZoneEndTime(
  bars: readonly Bar[],
  startIndex: number,
  extendBars: number,
): number | undefined {
  if (bars.length === 0) return undefined;
  const boundedStart = Math.max(0, Math.min(startIndex, bars.length - 1));
  const endIndex = boundedStart + extendBars;
  if (endIndex < bars.length) return bars[endIndex].time;

  const current = bars[boundedStart]?.time;
  if (current === undefined) return undefined;
  const prev = bars[boundedStart - 1]?.time;
  const next = bars[boundedStart + 1]?.time;
  const step = next !== undefined && next > current
    ? next - current
    : prev !== undefined && current > prev
      ? current - prev
      : 60_000;
  return current + step * extendBars;
}

function fvgToZone(
  fvg: Fvg,
  bars: readonly Bar[],
  extendBars: number,
): SmcZone {
  return {
    id: `fvg:swing:${fvg.type}:${fvg.barIndex}:${fvg.top}:${fvg.bottom}`,
    kind: "fvg",
    scope: "swing",
    direction: fvg.type,
    startTime: fvg.timestamp,
    endTime: resolveZoneEndTime(bars, fvg.barIndex, extendBars),
    extendBars,
    top: fvg.top,
    bottom: fvg.bottom,
    label: fvg.type === 1 ? "Bull FVG" : "Bear FVG",
  };
}

function premiumDiscountZones(
  state: StructureState,
  bars: readonly Bar[],
): SmcZone[] {
  const highPivot = state.swingHigh;
  const lowPivot = state.swingLow;
  const lastBar = bars[bars.length - 1];
  if (!highPivot || !lowPivot || !lastBar) return [];

  const anchorIndex = Math.max(highPivot.barIndex, lowPivot.barIndex);
  if (anchorIndex < 0 || anchorIndex >= bars.length) return [];

  let rangeHigh = highPivot.price;
  let rangeLow = lowPivot.price;
  for (let i = anchorIndex; i < bars.length; i += 1) {
    const bar = bars[i];
    if (!bar) continue;
    if (bar.high >= rangeHigh) rangeHigh = bar.high;
    if (bar.low <= rangeLow) rangeLow = bar.low;
  }

  if (!Number.isFinite(rangeHigh) || !Number.isFinite(rangeLow) || rangeHigh <= rangeLow) {
    return [];
  }

  const startTime = bars[anchorIndex].time;
  const endTime = lastBar.time;
  const premiumBottom = 0.95 * rangeHigh + 0.05 * rangeLow;
  const equilibriumTop = 0.525 * rangeHigh + 0.475 * rangeLow;
  const equilibriumBottom = 0.475 * rangeHigh + 0.525 * rangeLow;
  const discountTop = 0.95 * rangeLow + 0.05 * rangeHigh;
  const idBase = `${startTime}:${endTime}:${rangeHigh}:${rangeLow}`;

  return [
    {
      id: `pd:premium:${idBase}`,
      kind: "pd",
      scope: "swing",
      direction: -1,
      pdKind: "premium",
      startTime,
      endTime,
      top: rangeHigh,
      bottom: premiumBottom,
      label: "Premium",
    },
    {
      id: `pd:equilibrium:${idBase}`,
      kind: "pd",
      scope: "swing",
      direction: 1,
      pdKind: "equilibrium",
      startTime,
      endTime,
      top: equilibriumTop,
      bottom: equilibriumBottom,
      label: "EQ",
    },
    {
      id: `pd:discount:${idBase}`,
      kind: "pd",
      scope: "swing",
      direction: 1,
      pdKind: "discount",
      startTime,
      endTime,
      top: discountTop,
      bottom: rangeLow,
      label: "Discount",
    },
  ];
}

function zoneSortRank(zone: SmcZone): number {
  if (zone.kind === "pd") return 0;
  if (zone.kind === "ob") return 1;
  return 2;
}

export function computeSmcOverlay(
  bars: readonly Bar[],
  settings?: Partial<SmcSettings>,
): SmcOverlay {
  const cfg = settingsWithDefaults(settings);
  if (!cfg.enabled || bars.length === 0) {
    return { markers: [], zones: [], lines: [], swingTrend: 0, internalTrend: 0 };
  }

  const detector = new LuxSmc(cfg);
  const markers: SmcMarker[] = [];
  const lines: SmcLine[] = [];

  bars.forEach((bar, index) => {
    const state = detector.update(bar, index);
    pushStateMarkers(markers, state, bar, cfg.showInternal);
    pushStateLines(
      lines,
      state,
      bars,
      index,
      cfg.showInternal,
      cfg.structureLineExtendBars,
    );
  });

  const zones: SmcZone[] = [];
  if (cfg.showZones) {
    if (cfg.showPremiumDiscount) {
      zones.push(...premiumDiscountZones(detector.state, bars));
    }
    if (cfg.showSwingOrderBlocks) {
      for (const ob of detector.swingObs.filter((ob) => ob.active).slice(0, cfg.maxSwingOrderBlocks)) {
        zones.push(orderBlockToZone(ob, "swing"));
      }
    }
    if (cfg.showInternal && cfg.showInternalOrderBlocks) {
      for (const ob of detector.internalObs.filter((ob) => ob.active).slice(0, cfg.maxInternalOrderBlocks)) {
        zones.push(orderBlockToZone(ob, "internal"));
      }
    }
    for (const fvg of detector.fvgs.filter((fvg) => fvg.active).slice(0, cfg.maxFairValueGaps)) {
      zones.push(fvgToZone(fvg, bars, cfg.fvgExtendBars));
    }
  }

  markers.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
  zones.sort(
    (a, b) =>
      zoneSortRank(a) - zoneSortRank(b) ||
      a.startTime - b.startTime ||
      a.id.localeCompare(b.id),
  );
  lines.sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));

  return {
    markers: markers.slice(Math.max(0, markers.length - cfg.maxMarkers)),
    zones,
    lines: lines.slice(Math.max(0, lines.length - cfg.maxMarkers)),
    swingTrend: detector.state.swingTrend,
    internalTrend: detector.state.internalTrend,
  };
}
