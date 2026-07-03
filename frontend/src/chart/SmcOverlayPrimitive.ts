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

import { type SmcLine, type SmcZone } from "./smc";

export interface RenderableSmcZone extends Omit<SmcZone, "startTime" | "endTime"> {
  startTime: Time;
  endTime?: Time;
}

export interface RenderableSmcLine extends Omit<SmcLine, "startTime" | "endTime"> {
  startTime: Time;
  endTime: Time;
}

interface ViewZone {
  zone: RenderableSmcZone;
  x1: Coordinate;
  x2: Coordinate;
  yTop: Coordinate;
  yBottom: Coordinate;
}

interface ViewLine {
  line: RenderableSmcLine;
  x1: Coordinate;
  x2: Coordinate;
  y: Coordinate;
}

interface ZoneStyle {
  fill: string;
  stroke: string;
  label?: string;
}

interface LineStyle {
  color: string;
  width: number;
  dash: number[];
}

function styleFor(zone: RenderableSmcZone): ZoneStyle {
  if (zone.kind === "pd") {
    if (zone.pdKind === "premium") {
      return {
        fill: "rgba(120, 45, 45, 0.24)",
        stroke: "rgba(190, 75, 75, 0.44)",
        label: "rgba(255, 135, 135, 0.88)",
      };
    }
    if (zone.pdKind === "discount") {
      return {
        fill: "rgba(45, 120, 70, 0.22)",
        stroke: "rgba(80, 180, 110, 0.42)",
        label: "rgba(120, 235, 155, 0.86)",
      };
    }
    return {
      fill: "rgba(90, 90, 90, 0.22)",
      stroke: "rgba(170, 170, 170, 0.40)",
      label: "rgba(215, 215, 215, 0.78)",
    };
  }

  if (zone.kind === "fvg") {
    return zone.direction === 1
      ? {
          fill: "rgba(91, 239, 153, 0.36)",
          stroke: "rgba(26, 204, 112, 0.78)",
        }
      : {
          fill: "rgba(255, 112, 112, 0.30)",
          stroke: "rgba(221, 70, 70, 0.72)",
        };
  }

  if (zone.scope === "internal") {
    return zone.direction === 1
      ? {
          fill: "rgba(25, 35, 45, 0.46)",
          stroke: "rgba(40, 80, 120, 0.72)",
        }
      : {
          fill: "rgba(45, 25, 25, 0.46)",
          stroke: "rgba(120, 40, 40, 0.72)",
        };
  }

  return zone.direction === 1
    ? {
        fill: "rgba(30, 45, 60, 0.42)",
        stroke: "rgba(50, 100, 150, 0.75)",
      }
    : {
        fill: "rgba(60, 30, 30, 0.42)",
        stroke: "rgba(150, 50, 50, 0.75)",
      };
}

function lineStyleFor(line: RenderableSmcLine): LineStyle {
  const color = line.direction === 1
    ? line.scope === "internal"
      ? "#00bfff"
      : "#32cd32"
    : line.scope === "internal"
      ? "#ff4500"
      : "#ff6347";
  return {
    color,
    width: line.scope === "internal" ? 1 : 2,
    dash: line.scope === "internal" ? [2, 4] : [],
  };
}

function scaledBox(a: Coordinate, b: Coordinate, pixelRatio: number) {
  const p1 = Math.round(a * pixelRatio);
  const p2 = Math.round(b * pixelRatio);
  return {
    position: Math.min(p1, p2),
    length: Math.max(1, Math.abs(p2 - p1)),
  };
}

class SmcOverlayRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly zones: readonly ViewZone[],
    private readonly lines: readonly ViewLine[],
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      ctx.save();
      ctx.font = `${Math.max(10, Math.round(11 * scope.verticalPixelRatio))}px sans-serif`;
      ctx.textBaseline = "top";

      for (const view of this.zones) {
        const horizontal = scaledBox(
          view.x1,
          view.x2,
          scope.horizontalPixelRatio,
        );
        const vertical = scaledBox(
          view.yTop,
          view.yBottom,
          scope.verticalPixelRatio,
        );
        const style = styleFor(view.zone);
        ctx.fillStyle = style.fill;
        ctx.fillRect(
          horizontal.position,
          vertical.position,
          horizontal.length,
          vertical.length,
        );
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = Math.max(1, Math.floor(scope.horizontalPixelRatio));
        if (view.zone.kind === "fvg") {
          ctx.setLineDash([4 * scope.horizontalPixelRatio, 3 * scope.horizontalPixelRatio]);
        } else {
          ctx.setLineDash([]);
        }
        ctx.strokeRect(
          horizontal.position,
          vertical.position,
          horizontal.length,
          vertical.length,
        );

        if (view.zone.kind === "pd" && style.label) {
          const labelX =
            horizontal.position +
            horizontal.length * (view.zone.pdKind === "equilibrium" ? 0.92 : 0.5);
          const labelY = vertical.position + vertical.length / 2;
          ctx.setLineDash([]);
          ctx.fillStyle = style.label;
          ctx.textAlign =
            view.zone.pdKind === "equilibrium" ? "right" : "center";
          ctx.textBaseline = "middle";
          ctx.fillText(view.zone.label, labelX, labelY);
        }
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const view of this.lines) {
        const style = lineStyleFor(view.line);
        const x1 = Math.round(view.x1 * scope.horizontalPixelRatio);
        const x2 = Math.round(view.x2 * scope.horizontalPixelRatio);
        const y = Math.round(view.y * scope.verticalPixelRatio);
        ctx.strokeStyle = style.color;
        ctx.lineWidth = Math.max(1, Math.round(style.width * scope.verticalPixelRatio));
        ctx.setLineDash(style.dash.map((value) => value * scope.horizontalPixelRatio));
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();

        const textX = x1 + (x2 - x1) / 2;
        const textYOffset =
          (view.line.direction === 1 ? -8 : 8) * scope.verticalPixelRatio;
        ctx.setLineDash([]);
        ctx.fillStyle = style.color;
        ctx.fillText(view.line.label, textX, y + textYOffset);
      }
      ctx.restore();
    });
  }
}

class SmcOverlayPaneView implements IPrimitivePaneView {
  private viewZones: ViewZone[] = [];
  private viewLines: ViewLine[] = [];

  constructor(private readonly source: SmcOverlayPrimitive) {}

  update(): void {
    const { chart, series } = this.source;
    if (!chart || !series) {
      this.viewZones = [];
      this.viewLines = [];
      return;
    }

    const paneWidth = chart.paneSize(0).width;
    const nextZones: ViewZone[] = [];
    for (const zone of this.source.zones) {
      const x1 = chart.timeScale().timeToCoordinate(zone.startTime);
      const x2 = zone.endTime !== undefined
        ? coordinateForEndTime(chart, series, zone.startTime, zone.endTime, x1)
        : (paneWidth as Coordinate);
      const yTop = series.priceToCoordinate(zone.top);
      const yBottom = series.priceToCoordinate(zone.bottom);
      if (x1 === null || x2 === null || yTop === null || yBottom === null) continue;
      nextZones.push({
        zone,
        x1,
        x2,
        yTop,
        yBottom,
      });
    }

    const nextLines: ViewLine[] = [];
    for (const line of this.source.lines) {
      const x1 = chart.timeScale().timeToCoordinate(line.startTime);
      const x2 = coordinateForEndTime(
        chart,
        series,
        line.startTime,
        line.endTime,
        x1,
      );
      const y = series.priceToCoordinate(line.price);
      if (x1 === null || x2 === null || y === null) continue;
      nextLines.push({ line, x1, x2, y });
    }
    this.viewZones = nextZones;
    this.viewLines = nextLines;
  }

  renderer(): IPrimitivePaneRenderer {
    return new SmcOverlayRenderer(this.viewZones, this.viewLines);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return "bottom";
  }
}

function numericTime(data: { time: Time } | null | undefined): number | undefined {
  return typeof data?.time === "number" ? data.time : undefined;
}

function estimateStepSeconds(series: ISeriesApi<"Candlestick", Time>): number {
  const data = series.data();
  const diffs: number[] = [];
  let previous: number | undefined;
  for (const item of data.slice(Math.max(0, data.length - 80))) {
    const time = numericTime(item);
    if (time !== undefined && previous !== undefined && time > previous) {
      diffs.push(time - previous);
    }
    if (time !== undefined) previous = time;
  }
  if (diffs.length === 0) return 60;
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)] || 60;
}

function estimateStepPx(
  chart: IChartApiBase<Time>,
  series: ISeriesApi<"Candlestick", Time>,
): number {
  const data = series.data();
  const diffs: number[] = [];
  let previousX: number | undefined;
  for (const item of data.slice(Math.max(0, data.length - 80))) {
    const time = numericTime(item);
    if (time === undefined) continue;
    const x = chart.timeScale().timeToCoordinate(time as Time);
    if (x !== null && previousX !== undefined && x > previousX) {
      diffs.push(x - previousX);
    }
    if (x !== null) previousX = x as number;
  }
  if (diffs.length === 0) return 10;
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)] || 10;
}

function coordinateForEndTime(
  chart: IChartApiBase<Time>,
  series: ISeriesApi<"Candlestick", Time>,
  startTime: Time,
  endTime: Time,
  startX: Coordinate | null,
): Coordinate | null {
  const direct = chart.timeScale().timeToCoordinate(endTime);
  if (direct !== null) return direct;
  if (startX === null || typeof startTime !== "number" || typeof endTime !== "number") {
    return startX;
  }
  const stepSeconds = estimateStepSeconds(series);
  const stepPx = estimateStepPx(chart, series);
  const bars = Math.max(1, (endTime - startTime) / stepSeconds);
  return (startX + bars * stepPx) as Coordinate;
}

export class SmcOverlayPrimitive implements ISeriesPrimitive<Time> {
  private zonesInternal: RenderableSmcZone[];
  private linesInternal: RenderableSmcLine[];
  private readonly paneView: SmcOverlayPaneView;
  private requestUpdateFn?: () => void;

  chart: IChartApiBase<Time> | undefined;
  series: ISeriesApi<"Candlestick", Time> | undefined;

  constructor(
    zones: readonly RenderableSmcZone[],
    lines: readonly RenderableSmcLine[] = [],
  ) {
    this.zonesInternal = zones.map((zone) => ({ ...zone }));
    this.linesInternal = lines.map((line) => ({ ...line }));
    this.paneView = new SmcOverlayPaneView(this);
  }

  get zones(): readonly RenderableSmcZone[] {
    return this.zonesInternal;
  }

  get lines(): readonly RenderableSmcLine[] {
    return this.linesInternal;
  }

  setOverlay(
    zones: readonly RenderableSmcZone[],
    lines: readonly RenderableSmcLine[],
  ): void {
    this.zonesInternal = zones.map((zone) => ({ ...zone }));
    this.linesInternal = lines.map((line) => ({ ...line }));
    this.requestUpdate();
  }

  requestUpdate(): void {
    this.requestUpdateFn?.();
  }

  updateAllViews(): void {
    this.paneView.update();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView];
  }

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
