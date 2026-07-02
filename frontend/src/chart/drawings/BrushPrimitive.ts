import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  AutoscaleInfo,
  Coordinate,
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  Logical,
  PrimitivePaneViewZOrder,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";

import { anchorToLogical } from "./coordinates";
import type { AnchorPoint, DrawingOptions, DrawingState, IDrawing } from "./types";

interface ViewPoint {
  x: Coordinate | null;
  y: Coordinate | null;
}

interface BrushRenderOptions {
  lineColor: string;
  width: number;
}

const DEFAULT_OPTIONS: BrushRenderOptions = {
  lineColor: "#ffb020",
  width: 3,
};

function toRenderOptions(options?: DrawingOptions): BrushRenderOptions {
  return {
    ...DEFAULT_OPTIONS,
    lineColor: options?.lineColor ?? DEFAULT_OPTIONS.lineColor,
    width: options?.lineWidth ?? DEFAULT_OPTIONS.width,
  };
}

class BrushRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly points: readonly ViewPoint[],
    private readonly options: BrushRenderOptions,
    private readonly selected: boolean,
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      ctx.save();
      ctx.strokeStyle = this.options.lineColor;
      ctx.lineWidth = Math.max(1, this.options.width * scope.horizontalPixelRatio);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const visiblePoints: Array<{ x: number; y: number }> = [];
      let segment: Array<{ x: number; y: number }> = [];
      const flushSegment = () => {
        if (segment.length < 2) {
          segment = [];
          return;
        }
        for (const point of segment) {
          visiblePoints.push(point);
        }
        drawSmoothSegment(ctx, segment);
        segment = [];
      };

      for (const point of this.points) {
        if (point.x === null || point.y === null) {
          flushSegment();
          continue;
        }
        const next = {
          x: Math.round(point.x * scope.horizontalPixelRatio),
          y: Math.round(point.y * scope.verticalPixelRatio),
        };
        const previous = segment[segment.length - 1];
        if (
          previous !== undefined &&
          Math.abs(next.x - previous.x) > 96 * scope.horizontalPixelRatio
        ) {
          flushSegment();
        }
        segment.push(next);
      }
      flushSegment();

      if (this.selected) {
        if (visiblePoints.length === 0) {
          ctx.restore();
          return;
        }
        const radius = 4 * Math.max(scope.horizontalPixelRatio, scope.verticalPixelRatio);
        ctx.fillStyle = this.options.lineColor;
        for (const point of [visiblePoints[0], visiblePoints[visiblePoints.length - 1]]) {
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    });
  }
}

function drawSmoothSegment(
  ctx: CanvasRenderingContext2D,
  points: readonly { x: number; y: number }[],
): void {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
  } else {
    for (let index = 1; index < points.length - 1; index += 1) {
      const current = points[index];
      const next = points[index + 1];
      const midX = (current.x + next.x) / 2;
      const midY = (current.y + next.y) / 2;
      ctx.quadraticCurveTo(current.x, current.y, midX, midY);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
  }
  ctx.stroke();
}

class BrushPaneView implements IPrimitivePaneView {
  private points: ViewPoint[] = [];

  constructor(private readonly source: BrushPrimitive) {}

  zOrder(): PrimitivePaneViewZOrder {
    return "top";
  }

  update(): void {
    const { chart, series, anchors } = this.source;
    if (anchors.length < 2 || !chart || !series) {
      this.points = [];
      return;
    }
    this.points = anchors.map((anchor) => ({
      x: brushAnchorToCoordinate(chart, series, anchor),
      y: series.priceToCoordinate(anchor.price),
    }));
  }

  renderer(): IPrimitivePaneRenderer {
    return new BrushRenderer(
      this.points,
      this.source.renderOptions,
      this.source.selected,
    );
  }
}

function brushAnchorToCoordinate(
  chart: IChartApiBase<Time>,
  series: ISeriesApi<"Candlestick", Time>,
  anchor: AnchorPoint,
): Coordinate | null {
  const time = anchor.time as Time;
  const exact = chart.timeScale().timeToCoordinate(time);
  if (exact !== null) return exact;

  const targetTime = numericTime({ time });
  if (targetTime === undefined) return null;
  const data = series
    .data()
    .map((item) => numericTime(item))
    .filter((item): item is number => item !== undefined);
  if (data.length < 2) return null;
  if (targetTime < data[0] || targetTime > data[data.length - 1]) return null;

  let low = 0;
  let high = data.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const item = data[mid];
    if (item === targetTime) {
      return chart.timeScale().timeToCoordinate(item as Time);
    }
    if (item < targetTime) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const leftTime = data[Math.max(0, high)];
  const rightTime = data[Math.min(data.length - 1, low)];
  if (leftTime === undefined || rightTime === undefined || rightTime <= leftTime) {
    return null;
  }
  const leftX = chart.timeScale().timeToCoordinate(leftTime as Time);
  const rightX = chart.timeScale().timeToCoordinate(rightTime as Time);
  if (leftX === null || rightX === null) return null;
  const ratio = (targetTime - leftTime) / (rightTime - leftTime);
  return (leftX + ((rightX as number) - (leftX as number)) * ratio) as Coordinate;
}

function numericTime(data: { time: Time } | null | undefined): number | undefined {
  return typeof data?.time === "number" ? data.time : undefined;
}

export class BrushPrimitive implements ISeriesPrimitive<Time>, IDrawing {
  readonly tool = "brush" as const;
  readonly renderOptions: BrushRenderOptions;
  private anchorsInternal: AnchorPoint[];
  private readonly paneView: BrushPaneView;
  private requestUpdateFn?: () => void;
  private selectedInternal = false;

  chart: IChartApiBase<Time> | undefined;
  series: ISeriesApi<"Candlestick", Time> | undefined;

  constructor(
    readonly id: string,
    anchors: AnchorPoint[],
    private readonly options?: DrawingOptions,
  ) {
    this.anchorsInternal = [...anchors];
    this.renderOptions = toRenderOptions(options);
    this.paneView = new BrushPaneView(this);
  }

  get anchors(): AnchorPoint[] {
    return this.anchorsInternal;
  }

  get selected(): boolean {
    return this.selectedInternal;
  }

  setAnchors(anchors: AnchorPoint[]): void {
    this.anchorsInternal = [...anchors];
    this.requestUpdate();
  }

  setSelected(selected: boolean): void {
    if (this.selectedInternal === selected) return;
    this.selectedInternal = selected;
    this.requestUpdate();
  }

  toState(): DrawingState {
    return {
      id: this.id,
      tool: this.tool,
      anchors: [...this.anchorsInternal],
      options: this.options,
    };
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

  autoscaleInfo(startTimePoint: Logical, endTimePoint: Logical): AutoscaleInfo | null {
    const visibleAnchors = this.anchorsInternal.filter((anchor) => {
      if (!this.chart || !this.series) return false;
      const logical = anchorToLogical(this.chart, this.series, anchor);
      return (
        logical !== null &&
        logical >= startTimePoint &&
        logical <= endTimePoint
      );
    });
    if (visibleAnchors.length === 0) return null;
    const prices = visibleAnchors.map((anchor) => anchor.price);
    return {
      priceRange: {
        minValue: Math.min(...prices),
        maxValue: Math.max(...prices),
      },
    };
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
