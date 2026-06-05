import { type Bar } from "../cache/types";

export interface SmcSettings {
  enabled: boolean;
  swingLength: number;
  internalLength: number;
  showInternal: boolean;
  showZones: boolean;
  showSwingOrderBlocks: boolean;
  showInternalOrderBlocks: boolean;
  fvgExtendBars: number;
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
  showSwingOrderBlocks: true,
  showInternalOrderBlocks: true,
  fvgExtendBars: 3,
  maxZoneAge: 220,
  maxMarkers: 120,
  maxZones: 20,
  maxSwingOrderBlocks: 5,
  maxInternalOrderBlocks: 10,
  maxFairValueGaps: 10,
};

type Direction = 1 | -1;
type Scope = "swing" | "internal";

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

export type SmcZoneKind = "ob" | "fvg";

export interface SmcZone {
  id: string;
  kind: SmcZoneKind;
  scope: Scope;
  direction: Direction;
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
  private readonly maxBuffer: number;

  private readonly highs: number[] = [];
  private readonly lows: number[] = [];
  private readonly closes: number[] = [];
  private readonly opens: number[] = [];
  private readonly timestamps: number[] = [];
  private readonly indices: number[] = [];

  readonly state = new StructureState();
  readonly swingObs: OrderBlock[] = [];
  readonly internalObs: OrderBlock[] = [];
  readonly fvgs: Fvg[] = [];

  private lastSwingLeg = 0;
  private lastInternalLeg = 0;

  constructor(settings: Pick<SmcSettings, "swingLength" | "internalLength" | "maxZoneAge">) {
    this.swingLength = Math.max(1, Math.round(settings.swingLength));
    this.internalLength = Math.max(1, Math.round(settings.internalLength));
    this.maxZoneAge = Math.max(1, Math.round(settings.maxZoneAge));
    this.maxBuffer = Math.max(
      2000,
      this.maxZoneAge + Math.max(this.swingLength, this.internalLength) * 4,
    );
  }

  update(bar: Bar, barIndex: number): StructureState {
    this.highs.push(bar.high);
    this.lows.push(bar.low);
    this.closes.push(bar.close);
    this.opens.push(bar.open);
    this.timestamps.push(bar.time);
    this.indices.push(barIndex);

    if (this.highs.length > this.maxBuffer) {
      this.highs.shift();
      this.lows.shift();
      this.closes.shift();
      this.opens.shift();
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
    this.maintainZones(bar.high, bar.low, barIndex);
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
        const originPivot =
          (isInternal ? this.state.internalLow : this.state.swingLow) ??
          activeHigh;
        if (originPivot && (!isInternal || isChoch)) {
          this.createOrderBlock(originPivot, 1, isInternal);
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
        const originPivot =
          (isInternal ? this.state.internalHigh : this.state.swingHigh) ??
          activeLow;
        if (originPivot && (!isInternal || isChoch)) {
          this.createOrderBlock(originPivot, -1, isInternal);
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
    const rangeIndices = this.indices.slice(bufferStartPos);
    const rangeTimestamps = this.timestamps.slice(bufferStartPos);
    if (rangeHighs.length === 0) return;

    let obCandlePos = 0;
    if (direction === 1) {
      const minLow = Math.min(...rangeLows);
      obCandlePos = rangeLows.indexOf(minLow);
    } else {
      const maxHigh = Math.max(...rangeHighs);
      obCandlePos = rangeHighs.indexOf(maxHigh);
    }

    const ob: OrderBlock = {
      top: rangeHighs[obCandlePos],
      bottom: rangeLows[obCandlePos],
      barIndex: rangeIndices[obCandlePos],
      createdBarIndex: this.indices[this.indices.length - 1],
      timestamp: rangeTimestamps[obCandlePos],
      type: direction,
      mitigated: false,
      active: true,
    };

    const target = isInternal ? this.internalObs : this.swingObs;
    target.unshift(ob);
    if (target.length > 20) target.pop();
  }

  private detectFvgs(barIndex: number): void {
    if (this.highs.length < 3) return;
    const currLow = this.lows[this.lows.length - 1];
    const currHigh = this.highs[this.highs.length - 1];
    const prevClose = this.closes[this.closes.length - 2];
    const prev2High = this.highs[this.highs.length - 3];
    const prev2Low = this.lows[this.lows.length - 3];
    const prevTimestamp = this.timestamps[this.timestamps.length - 2];

    if (currLow > prev2High && prevClose > prev2High) {
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

    if (currHigh < prev2Low && prevClose < prev2Low) {
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

  private maintainZones(high: number, low: number, currentIndex: number): void {
    this.filterOrderBlocks(this.swingObs, high, low, currentIndex, false);
    this.filterOrderBlocks(this.internalObs, high, low, currentIndex, true);

    for (let i = this.fvgs.length - 1; i >= 0; i -= 1) {
      const fvg = this.fvgs[i];
      if (!fvg.active || currentIndex - fvg.barIndex > this.maxZoneAge) {
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
      if (ob.type === 1 && low < ob.bottom) {
        ob.mitigated = true;
        ob.active = false;
        if (isInternal) this.state.obBullIntMitigated = true;
        else this.state.obBullExtMitigated = true;
        obs.splice(i, 1);
      } else if (ob.type === -1 && high > ob.top) {
        ob.mitigated = true;
        ob.active = false;
        if (isInternal) this.state.obBearIntMitigated = true;
        else this.state.obBearExtMitigated = true;
        obs.splice(i, 1);
      }
    }
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

function settingsWithDefaults(settings?: Partial<SmcSettings>): SmcSettings {
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
      220,
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
    fvgExtendBars: Math.max(
      1,
      Math.round(settings?.fvgExtendBars ?? DEFAULT_SMC_SETTINGS.fvgExtendBars),
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

function pushStateLines(
  lines: SmcLine[],
  state: StructureState,
  bar: Bar,
  showInternal: boolean,
): void {
  if (state.bosBull && state.swingHigh) {
    addLine(lines, {
      scope: "swing",
      direction: 1,
      startTime: state.swingHigh.timestamp,
      endTime: bar.time,
      price: state.swingHigh.price,
      label: "BOS",
    });
  }
  if (state.bosBear && state.swingLow) {
    addLine(lines, {
      scope: "swing",
      direction: -1,
      startTime: state.swingLow.timestamp,
      endTime: bar.time,
      price: state.swingLow.price,
      label: "BOS",
    });
  }
  if (state.chochBull && state.swingHigh) {
    addLine(lines, {
      scope: "swing",
      direction: 1,
      startTime: state.swingHigh.timestamp,
      endTime: bar.time,
      price: state.swingHigh.price,
      label: "CHoCH",
    });
  }
  if (state.chochBear && state.swingLow) {
    addLine(lines, {
      scope: "swing",
      direction: -1,
      startTime: state.swingLow.timestamp,
      endTime: bar.time,
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
      endTime: bar.time,
      price: state.internalHigh.price,
      label: "CHoCH",
    });
  }
  if (state.internalChochBear && state.internalLow) {
    addLine(lines, {
      scope: "internal",
      direction: -1,
      startTime: state.internalLow.timestamp,
      endTime: bar.time,
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
    pushStateLines(lines, state, bar, cfg.showInternal);
  });

  const zones: SmcZone[] = [];
  if (cfg.showZones) {
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
  zones.sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));
  lines.sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));

  return {
    markers: markers.slice(Math.max(0, markers.length - cfg.maxMarkers)),
    zones,
    lines: lines.slice(Math.max(0, lines.length - cfg.maxMarkers)),
    swingTrend: detector.state.swingTrend,
    internalTrend: detector.state.internalTrend,
  };
}
