import type { CanvasRenderingTarget2D } from "fancy-canvas";
import {
  type Coordinate,
  type IChartApiBase,
  type IPrimitivePaneRenderer,
  type IPrimitivePaneView,
  type ISeriesApi,
  type ISeriesPrimitive,
  type PrimitivePaneViewZOrder,
  type SeriesAttachedParameter,
  type Time,
} from "lightweight-charts";

import type { SweepReversalDirection, SweepReversalPhase } from "./sweepReversal";

export interface RenderableSweepSetup {
  id: string;
  direction: SweepReversalDirection;
  phase: SweepReversalPhase;
  sweepTime: Time;
  endTime: Time;
  lineEndTime: Time;
  level: number;
  extreme: number;
  pivotTimes: readonly Time[];
  pivotPrices: readonly number[];
  zoneColor: string;
  levelColor: string;
}

interface ViewSetup {
  setup: RenderableSweepSetup;
  x1: Coordinate;
  x2: Coordinate;
  lineX1: Coordinate;
  lineX2: Coordinate;
  yLevel: Coordinate;
  yExtreme: Coordinate;
  markers: readonly { x: Coordinate; y: Coordinate }[];
}

interface StepEstimate { seconds: number; pixels: number }

function rgba(hex: string, alpha: number): string {
  const normalized = hex.trim().replace(/^#/, "");
  const value = normalized.length === 3
    ? normalized.split("").map((part) => `${part}${part}`).join("")
    : normalized.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(value)) return hex;
  const number = Number.parseInt(value, 16);
  return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${alpha})`;
}

function numericTime(item: { time: Time } | null | undefined): number | undefined {
  return typeof item?.time === "number" ? item.time : undefined;
}

function estimateSteps(chart: IChartApiBase<Time>, series: ISeriesApi<"Candlestick", Time>): StepEstimate {
  const data = series.data().slice(-80);
  const times: number[] = [];
  const pixels: number[] = [];
  let previousTime: number | undefined;
  let previousX: number | undefined;
  for (const item of data) {
    const time = numericTime(item);
    if (time === undefined) continue;
    if (previousTime !== undefined && time > previousTime) times.push(time - previousTime);
    const x = chart.timeScale().timeToCoordinate(time as Time);
    if (x !== null && previousX !== undefined && x > previousX) pixels.push(x - previousX);
    previousTime = time;
    if (x !== null) previousX = x as number;
  }
  times.sort((a, b) => a - b);
  pixels.sort((a, b) => a - b);
  return {
    seconds: times[Math.floor(times.length / 2)] || 60,
    pixels: pixels[Math.floor(pixels.length / 2)] || 10,
  };
}

function timeCoordinate(
  chart: IChartApiBase<Time>,
  startTime: Time,
  targetTime: Time,
  startX: Coordinate | null,
  estimate: StepEstimate,
): Coordinate | null {
  const direct = chart.timeScale().timeToCoordinate(targetTime);
  if (direct !== null) return direct;
  if (startX === null || typeof startTime !== "number" || typeof targetTime !== "number") return startX;
  return (startX + Math.max(1, (targetTime - startTime) / estimate.seconds) * estimate.pixels) as Coordinate;
}

class SweepRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly setups: readonly ViewSetup[]) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      ctx.save();
      for (const view of this.setups) {
        const { setup } = view;
        const ratioX = scope.horizontalPixelRatio;
        const ratioY = scope.verticalPixelRatio;
        const x1 = Math.round(Math.min(view.x1, view.x2) * ratioX);
        const x2 = Math.round(Math.max(view.x1, view.x2) * ratioX);
        const y1 = Math.round(Math.min(view.yLevel, view.yExtreme) * ratioY);
        const y2 = Math.round(Math.max(view.yLevel, view.yExtreme) * ratioY);
        const confirmed = setup.phase === "confirmed";
        ctx.fillStyle = rgba(setup.zoneColor, confirmed ? 0.65 : 0.12);
        ctx.fillRect(x1, y1, Math.max(1, x2 - x1), Math.max(1, y2 - y1));
        ctx.strokeStyle = rgba(setup.zoneColor, confirmed ? 0.95 : 0.35);
        ctx.lineWidth = Math.max(1, ratioX);
        ctx.setLineDash([]);
        ctx.strokeRect(x1, y1, Math.max(1, x2 - x1), Math.max(1, y2 - y1));

        ctx.strokeStyle = rgba(setup.levelColor, confirmed ? 0.8 : 0.25);
        ctx.setLineDash(confirmed ? [] : [2 * ratioX, 3 * ratioX]);
        ctx.beginPath();
        ctx.moveTo(Math.round(view.lineX1 * ratioX), Math.round(view.yLevel * ratioY));
        ctx.lineTo(Math.round(view.lineX2 * ratioX), Math.round(view.yLevel * ratioY));
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.fillStyle = rgba(setup.levelColor, confirmed ? 1 : 0.3);
        ctx.font = `${Math.max(10, Math.round(13 * ratioY))}px "Segoe UI", Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const marker of view.markers) {
          ctx.fillText("×", Math.round(marker.x * ratioX), Math.round(marker.y * ratioY));
        }
      }
      ctx.restore();
    });
  }
}

class SweepPaneView implements IPrimitivePaneView {
  private views: ViewSetup[] = [];
  constructor(private readonly source: SweepReversalPrimitive) {}

  update(): void {
    const { chart, series } = this.source;
    if (!chart || !series) { this.views = []; return; }
    const estimate = estimateSteps(chart, series);
    this.views = this.source.setups.flatMap((setup): ViewSetup[] => {
      const x1 = chart.timeScale().timeToCoordinate(setup.sweepTime);
      const x2 = timeCoordinate(chart, setup.sweepTime, setup.endTime, x1, estimate);
      const firstPivotTime = setup.pivotTimes[0];
      const lineX1 = firstPivotTime === undefined ? null : chart.timeScale().timeToCoordinate(firstPivotTime);
      const lineX2 = firstPivotTime === undefined ? null : timeCoordinate(chart, firstPivotTime, setup.lineEndTime, lineX1, estimate);
      const yLevel = series.priceToCoordinate(setup.level);
      const yExtreme = series.priceToCoordinate(setup.extreme);
      if (x1 === null || x2 === null || lineX1 === null || lineX2 === null || yLevel === null || yExtreme === null) return [];
      const markers = setup.pivotTimes.flatMap((time, index) => {
        const x = chart.timeScale().timeToCoordinate(time);
        const y = series.priceToCoordinate(setup.pivotPrices[index] ?? setup.level);
        return x === null || y === null ? [] : [{ x, y }];
      });
      return [{ setup, x1, x2, lineX1, lineX2, yLevel, yExtreme, markers }];
    });
  }

  renderer(): IPrimitivePaneRenderer { return new SweepRenderer(this.views); }
  zOrder(): PrimitivePaneViewZOrder { return "bottom"; }
}

export class SweepReversalPrimitive implements ISeriesPrimitive<Time> {
  private setupsInternal: RenderableSweepSetup[];
  private readonly view: SweepPaneView;
  private requestUpdateFn?: () => void;
  chart: IChartApiBase<Time> | undefined;
  series: ISeriesApi<"Candlestick", Time> | undefined;

  constructor(setups: readonly RenderableSweepSetup[]) {
    this.setupsInternal = setups.map((setup) => ({ ...setup }));
    this.view = new SweepPaneView(this);
  }

  get setups(): readonly RenderableSweepSetup[] { return this.setupsInternal; }
  setSetups(setups: readonly RenderableSweepSetup[]): void {
    this.setupsInternal = setups.map((setup) => ({ ...setup }));
    this.requestUpdateFn?.();
  }
  updateAllViews(): void { this.view.update(); }
  paneViews(): readonly IPrimitivePaneView[] { return [this.view]; }
  attached(params: SeriesAttachedParameter<Time, "Candlestick">): void {
    this.chart = params.chart;
    this.series = params.series;
    this.requestUpdateFn = params.requestUpdate;
  }
  detached(): void {
    this.chart = undefined;
    this.series = undefined;
    this.requestUpdateFn = undefined;
  }
}
