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

import { type SmcLine, type SmcMarker, type SmcZone } from "./smc";

export interface RenderableSmcZone
  extends Omit<
    SmcZone,
    "startTime" | "endTime" | "liquidityReferenceEndTime"
  > {
  startTime: Time;
  endTime?: Time;
  liquidityReferenceEndTime?: Time;
}

export interface RenderableSmcLine extends Omit<SmcLine, "startTime" | "endTime" | "labelTime"> {
  startTime: Time;
  endTime: Time;
  labelTime: Time;
}

export interface RenderableSmcLabel extends Omit<SmcMarker, "time" | "price"> {
  time: Time;
  price: number;
  color: string;
}

interface ViewZone {
  zone: RenderableSmcZone;
  x1: Coordinate;
  x2: Coordinate;
  yTop: Coordinate;
  yBottom: Coordinate;
  yLiquidityLine: Coordinate | null;
  xLiquidityReferenceEnd: Coordinate | null;
}

interface ViewLine {
  line: RenderableSmcLine;
  x1: Coordinate;
  x2: Coordinate;
  labelX: Coordinate;
  y: Coordinate;
}

interface ViewLabel {
  label: RenderableSmcLabel;
  x: Coordinate;
  y: Coordinate;
}

interface ZoneStyle {
  fill: string;
  stroke: string;
  label?: string;
  line?: string;
}

interface LineStyle {
  color: string;
  width: number;
  dash: number[];
}

const VIEWPORT_OVERSCAN_PX = 24;
const SMC_FONT_SIZE_PX = 9;
const SMC_LABEL_OFFSET_PX = 5;

/** True when an SMC object overlaps the currently visible numeric time range. */
export function smcTimeRangeIntersects(
  startTime: number,
  endTime: number | undefined,
  visibleFrom: number,
  visibleTo: number,
): boolean {
  return startTime <= visibleTo && (endTime ?? Number.POSITIVE_INFINITY) >= visibleFrom;
}

function clampCoordinate(value: Coordinate, min: number, max: number): Coordinate {
  return Math.max(min, Math.min(max, value as number)) as Coordinate;
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

  if (zone.kind === "liquidity") {
    const faded = zone.touched === true || zone.swept === true;
    return zone.liquiditySide === "sell"
      ? {
          fill: `rgba(35, 195, 220, ${faded ? 0.10 : 0})`,
          stroke: "rgba(80, 225, 240, 0)",
          label: `rgba(135, 235, 245, ${faded ? 0.58 : 0.92})`,
          line: faded ? undefined : "rgba(80, 225, 240, 0.96)",
        }
      : {
          fill: `rgba(245, 105, 45, ${faded ? 0.10 : 0})`,
          stroke: "rgba(255, 145, 80, 0)",
          label: `rgba(255, 180, 125, ${faded ? 0.58 : 0.92})`,
          line: faded ? undefined : "rgba(255, 145, 80, 0.96)",
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
          fill: "rgba(25, 35, 45, 0.20)",
          stroke: "rgba(40, 80, 120, 0.24)",
        }
      : {
          fill: "rgba(45, 25, 25, 0.20)",
          stroke: "rgba(120, 40, 40, 0.24)",
        };
  }

  return zone.direction === 1
    ? {
        fill: "rgba(30, 45, 60, 0.18)",
        stroke: "rgba(50, 100, 150, 0.26)",
      }
    : {
        fill: "rgba(60, 30, 30, 0.18)",
        stroke: "rgba(150, 50, 50, 0.26)",
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
    width: 1,
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
    private readonly labels: readonly ViewLabel[],
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      ctx.save();
      ctx.font = `300 ${Math.max(
        8,
        Math.round(SMC_FONT_SIZE_PX * scope.verticalPixelRatio),
      )}px "Segoe UI", Arial, sans-serif`;
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

        if (
          view.zone.kind === "liquidity" &&
          style.line &&
          view.yLiquidityLine !== null
        ) {
          ctx.setLineDash([]);
          ctx.strokeStyle = style.line;
          ctx.lineWidth = Math.max(1, Math.floor(scope.horizontalPixelRatio));
          const lineY = Math.round(
            (view.yLiquidityLine as number) * scope.verticalPixelRatio,
          );
          ctx.beginPath();
          ctx.moveTo(horizontal.position, lineY);
          const referenceEnd =
            view.xLiquidityReferenceEnd === null
              ? horizontal.position
              : Math.round(
                  (view.xLiquidityReferenceEnd as number) *
                    scope.horizontalPixelRatio,
                );
          ctx.lineTo(
            Math.max(
              horizontal.position,
              Math.min(horizontal.position + horizontal.length, referenceEnd),
            ),
            lineY,
          );
          ctx.stroke();
        }

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
        if (view.zone.kind === "liquidity" && style.label) {
          const labelX = horizontal.position + 6 * scope.horizontalPixelRatio;
          const labelY = vertical.position + vertical.length / 2;
          ctx.setLineDash([]);
          ctx.fillStyle = style.label;
          ctx.textAlign = "left";
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

        const labelX = Math.round(view.labelX * scope.horizontalPixelRatio);
        const textX = x1 + (labelX - x1) / 2;
        const textYOffset =
          (view.line.direction === 1 ? -6 : 6) * scope.verticalPixelRatio;
        ctx.setLineDash([]);
        ctx.fillStyle = style.color;
        ctx.fillText(view.line.label, textX, y + textYOffset);
      }

      ctx.setLineDash([]);
      ctx.textAlign = "center";
      for (const view of this.labels) {
        const x = Math.round(view.x * scope.horizontalPixelRatio);
        const y = Math.round(view.y * scope.verticalPixelRatio);
        const offset = SMC_LABEL_OFFSET_PX * scope.verticalPixelRatio;
        ctx.fillStyle = view.label.color;
        ctx.textBaseline = view.label.direction === 1 ? "bottom" : "top";
        ctx.fillText(
          view.label.label,
          x,
          y + (view.label.direction === 1 ? -offset : offset),
        );
      }
      ctx.restore();
    });
  }
}

class SmcOverlayPaneView implements IPrimitivePaneView {
  private viewZones: ViewZone[] = [];
  private viewLines: ViewLine[] = [];
  private viewLabels: ViewLabel[] = [];

  constructor(private readonly source: SmcOverlayPrimitive) {}

  update(): void {
    const { chart, series } = this.source;
    if (!chart || !series) {
      this.viewZones = [];
      this.viewLines = [];
      this.viewLabels = [];
      return;
    }

    const pane = chart.paneSize(0);
    const paneWidth = pane.width;
    const paneHeight = pane.height;
    const visibleRange = chart.timeScale().getVisibleRange();
    const visibleFrom =
      typeof visibleRange?.from === "number" ? visibleRange.from : undefined;
    const visibleTo =
      typeof visibleRange?.to === "number" ? visibleRange.to : undefined;
    let stepEstimate: StepEstimate | undefined;
    const estimate = () => {
      stepEstimate ??= estimateSteps(chart, series);
      return stepEstimate;
    };
    const nextZones: ViewZone[] = [];
    for (const zone of this.source.zones) {
      if (
        visibleFrom !== undefined &&
        visibleTo !== undefined &&
        typeof zone.startTime === "number" &&
        (zone.endTime === undefined || typeof zone.endTime === "number") &&
        !smcTimeRangeIntersects(
          zone.startTime,
          zone.endTime,
          visibleFrom,
          visibleTo,
        )
      ) {
        continue;
      }
      const x1 = chart.timeScale().timeToCoordinate(zone.startTime);
      const x2 = zone.endTime !== undefined
        ? coordinateForEndTime(chart, zone.startTime, zone.endTime, x1, estimate)
        : (paneWidth as Coordinate);
      const yTop = series.priceToCoordinate(zone.top);
      const yBottom = series.priceToCoordinate(zone.bottom);
      const yLiquidityLine =
        zone.kind === "liquidity" && zone.liquidityLinePrice !== undefined
          ? series.priceToCoordinate(zone.liquidityLinePrice)
          : null;
      const xLiquidityReferenceEnd =
        zone.kind === "liquidity" &&
        zone.liquidityReferenceEndTime !== undefined
          ? coordinateForEndTime(
              chart,
              zone.startTime,
              zone.liquidityReferenceEndTime,
              x1,
              estimate,
            )
          : null;
      if (x1 === null || x2 === null || yTop === null || yBottom === null) continue;
      const left = Math.min(x1 as number, x2 as number);
      const right = Math.max(x1 as number, x2 as number);
      const top = Math.min(yTop as number, yBottom as number);
      const bottom = Math.max(yTop as number, yBottom as number);
      if (
        right < -VIEWPORT_OVERSCAN_PX ||
        left > paneWidth + VIEWPORT_OVERSCAN_PX ||
        bottom < -VIEWPORT_OVERSCAN_PX ||
        top > paneHeight + VIEWPORT_OVERSCAN_PX
      ) {
        continue;
      }
      nextZones.push({
        zone,
        x1: clampCoordinate(x1, -VIEWPORT_OVERSCAN_PX, paneWidth + VIEWPORT_OVERSCAN_PX),
        x2: clampCoordinate(x2, -VIEWPORT_OVERSCAN_PX, paneWidth + VIEWPORT_OVERSCAN_PX),
        yTop: clampCoordinate(yTop, -VIEWPORT_OVERSCAN_PX, paneHeight + VIEWPORT_OVERSCAN_PX),
        yBottom: clampCoordinate(yBottom, -VIEWPORT_OVERSCAN_PX, paneHeight + VIEWPORT_OVERSCAN_PX),
        yLiquidityLine:
          yLiquidityLine === null
            ? null
            : clampCoordinate(
                yLiquidityLine,
                -VIEWPORT_OVERSCAN_PX,
                paneHeight + VIEWPORT_OVERSCAN_PX,
              ),
        xLiquidityReferenceEnd:
          xLiquidityReferenceEnd === null
            ? null
            : clampCoordinate(
                xLiquidityReferenceEnd,
                -VIEWPORT_OVERSCAN_PX,
                paneWidth + VIEWPORT_OVERSCAN_PX,
              ),
      });
    }

    const nextLines: ViewLine[] = [];
    for (const line of this.source.lines) {
      if (
        visibleFrom !== undefined &&
        visibleTo !== undefined &&
        typeof line.startTime === "number" &&
        typeof line.endTime === "number" &&
        !smcTimeRangeIntersects(
          line.startTime,
          line.endTime,
          visibleFrom,
          visibleTo,
        )
      ) {
        continue;
      }
      const x1 = chart.timeScale().timeToCoordinate(line.startTime);
      const x2 = coordinateForEndTime(
        chart,
        line.startTime,
        line.endTime,
        x1,
        estimate,
      );
      const labelX = coordinateForEndTime(
        chart,
        line.startTime,
        line.labelTime,
        x1,
        estimate,
      );
      const y = series.priceToCoordinate(line.price);
      if (x1 === null || x2 === null || labelX === null || y === null) continue;
      const left = Math.min(x1 as number, x2 as number);
      const right = Math.max(x1 as number, x2 as number);
      if (
        right < -VIEWPORT_OVERSCAN_PX ||
        left > paneWidth + VIEWPORT_OVERSCAN_PX ||
        (y as number) < -VIEWPORT_OVERSCAN_PX ||
        (y as number) > paneHeight + VIEWPORT_OVERSCAN_PX
      ) {
        continue;
      }
      nextLines.push({
        line,
        x1: clampCoordinate(x1, -VIEWPORT_OVERSCAN_PX, paneWidth + VIEWPORT_OVERSCAN_PX),
        x2: clampCoordinate(x2, -VIEWPORT_OVERSCAN_PX, paneWidth + VIEWPORT_OVERSCAN_PX),
        labelX: clampCoordinate(
          labelX,
          -VIEWPORT_OVERSCAN_PX,
          paneWidth + VIEWPORT_OVERSCAN_PX,
        ),
        y,
      });
    }
    this.viewZones = nextZones;
    this.viewLines = nextLines;

    const nextLabels: ViewLabel[] = [];
    for (const label of this.source.labels) {
      if (
        visibleFrom !== undefined &&
        visibleTo !== undefined &&
        typeof label.time === "number" &&
        (label.time < visibleFrom || label.time > visibleTo)
      ) {
        continue;
      }
      const x = chart.timeScale().timeToCoordinate(label.time);
      const y = series.priceToCoordinate(label.price);
      if (x === null || y === null) continue;
      if (
        (x as number) < -VIEWPORT_OVERSCAN_PX ||
        (x as number) > paneWidth + VIEWPORT_OVERSCAN_PX ||
        (y as number) < -VIEWPORT_OVERSCAN_PX ||
        (y as number) > paneHeight + VIEWPORT_OVERSCAN_PX
      ) {
        continue;
      }
      nextLabels.push({
        label,
        x: clampCoordinate(x, -VIEWPORT_OVERSCAN_PX, paneWidth + VIEWPORT_OVERSCAN_PX),
        y: clampCoordinate(y, -VIEWPORT_OVERSCAN_PX, paneHeight + VIEWPORT_OVERSCAN_PX),
      });
    }
    this.viewLabels = nextLabels;
  }

  renderer(): IPrimitivePaneRenderer {
    return new SmcOverlayRenderer(this.viewZones, this.viewLines, this.viewLabels);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return "bottom";
  }
}

function numericTime(data: { time: Time } | null | undefined): number | undefined {
  return typeof data?.time === "number" ? data.time : undefined;
}

interface StepEstimate {
  seconds: number;
  pixels: number;
}

function estimateSteps(
  chart: IChartApiBase<Time>,
  series: ISeriesApi<"Candlestick", Time>,
): StepEstimate {
  const data = series.data().slice(-80);
  const timeDiffs: number[] = [];
  const pixelDiffs: number[] = [];
  let previous: number | undefined;
  let previousX: number | undefined;
  for (const item of data) {
    const time = numericTime(item);
    if (time !== undefined && previous !== undefined && time > previous) {
      timeDiffs.push(time - previous);
    }
    if (time === undefined) continue;
    const x = chart.timeScale().timeToCoordinate(time as Time);
    if (x !== null && previousX !== undefined && x > previousX) {
      pixelDiffs.push(x - previousX);
    }
    previous = time;
    if (x !== null) previousX = x as number;
  }
  timeDiffs.sort((a, b) => a - b);
  pixelDiffs.sort((a, b) => a - b);
  return {
    seconds: timeDiffs[Math.floor(timeDiffs.length / 2)] || 60,
    pixels: pixelDiffs[Math.floor(pixelDiffs.length / 2)] || 10,
  };
}

function coordinateForEndTime(
  chart: IChartApiBase<Time>,
  startTime: Time,
  endTime: Time,
  startX: Coordinate | null,
  estimate: () => StepEstimate,
): Coordinate | null {
  const direct = chart.timeScale().timeToCoordinate(endTime);
  if (direct !== null) return direct;
  if (startX === null || typeof startTime !== "number" || typeof endTime !== "number") {
    return startX;
  }
  const step = estimate();
  const bars = Math.max(1, (endTime - startTime) / step.seconds);
  return (startX + bars * step.pixels) as Coordinate;
}

export class SmcOverlayPrimitive implements ISeriesPrimitive<Time> {
  private zonesInternal: RenderableSmcZone[];
  private linesInternal: RenderableSmcLine[];
  private labelsInternal: RenderableSmcLabel[];
  private readonly paneView: SmcOverlayPaneView;
  private requestUpdateFn?: () => void;

  chart: IChartApiBase<Time> | undefined;
  series: ISeriesApi<"Candlestick", Time> | undefined;

  constructor(
    zones: readonly RenderableSmcZone[],
    lines: readonly RenderableSmcLine[] = [],
    labels: readonly RenderableSmcLabel[] = [],
  ) {
    this.zonesInternal = zones.map((zone) => ({ ...zone }));
    this.linesInternal = lines.map((line) => ({ ...line }));
    this.labelsInternal = labels.map((label) => ({ ...label }));
    this.paneView = new SmcOverlayPaneView(this);
  }

  get zones(): readonly RenderableSmcZone[] {
    return this.zonesInternal;
  }

  get lines(): readonly RenderableSmcLine[] {
    return this.linesInternal;
  }

  get labels(): readonly RenderableSmcLabel[] {
    return this.labelsInternal;
  }

  setOverlay(
    zones: readonly RenderableSmcZone[],
    lines: readonly RenderableSmcLine[],
    labels: readonly RenderableSmcLabel[],
  ): void {
    this.zonesInternal = zones.map((zone) => ({ ...zone }));
    this.linesInternal = lines.map((line) => ({ ...line }));
    this.labelsInternal = labels.map((label) => ({ ...label }));
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
