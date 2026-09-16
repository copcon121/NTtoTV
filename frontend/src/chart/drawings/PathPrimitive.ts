import type {
  Coordinate,
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  PrimitivePaneViewZOrder,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";
import type {
  BitmapCoordinatesRenderingScope,
  CanvasRenderingTarget2D,
} from "fancy-canvas";

import { anchorToCoordinate } from "./coordinates";
import type { AnchorPoint, DrawingOptions, DrawingState, IDrawing } from "./types";

interface ViewPoint {
  x: Coordinate | null;
  y: Coordinate | null;
}

interface PathRenderOptions {
  lineColor: string;
  width: number;
  lineStyle: "solid" | "dashed";
  noteText: string;
}

const DEFAULT_OPTIONS: PathRenderOptions = {
  lineColor: "#2962ff",
  width: 2,
  lineStyle: "solid",
  noteText: "",
};

function toRenderOptions(options?: DrawingOptions): PathRenderOptions {
  return {
    ...DEFAULT_OPTIONS,
    lineColor: options?.lineColor ?? DEFAULT_OPTIONS.lineColor,
    width: options?.lineWidth ?? DEFAULT_OPTIONS.width,
    lineStyle: options?.lineStyle ?? DEFAULT_OPTIONS.lineStyle,
    noteText: options?.noteText?.trim() ?? DEFAULT_OPTIONS.noteText,
  };
}

class PathRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly points: readonly ViewPoint[],
    private readonly options: PathRenderOptions,
    private readonly selected: boolean,
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const visiblePoints: Array<{ x: number; y: number }> = [];
      let segment: Array<{ x: number; y: number }> = [];

      ctx.save();
      ctx.strokeStyle = this.options.lineColor;
      ctx.lineWidth = Math.max(1, this.options.width * scope.horizontalPixelRatio);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash(
        this.options.lineStyle === "dashed"
          ? [8 * scope.horizontalPixelRatio, 6 * scope.horizontalPixelRatio]
          : [],
      );

      const flushSegment = () => {
        if (segment.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(segment[0].x, segment[0].y);
          for (const point of segment.slice(1)) {
            ctx.lineTo(point.x, point.y);
          }
          ctx.stroke();
        }
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
        segment.push(next);
        visiblePoints.push(next);
      }
      flushSegment();

      if (this.options.noteText && visiblePoints.length >= 2) {
        const middle = visiblePoints[Math.floor(visiblePoints.length / 2)];
        this.drawNoteLabel(scope, this.options.noteText, middle.x, middle.y);
      }

      if (this.selected) {
        ctx.setLineDash([]);
        ctx.fillStyle = this.options.lineColor;
        const radius = 4 * Math.max(scope.horizontalPixelRatio, scope.verticalPixelRatio);
        for (const point of visiblePoints) {
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    });
  }

  private drawNoteLabel(
    scope: BitmapCoordinatesRenderingScope,
    text: string,
    x: number,
    y: number,
  ): void {
    const ctx = scope.context;
    const paddingX = 6 * scope.horizontalPixelRatio;
    const paddingY = 4 * scope.verticalPixelRatio;
    const fontSize = 12 * scope.verticalPixelRatio;
    ctx.font = `${fontSize}px Arial`;
    const textWidth = ctx.measureText(text).width;
    const boxW = textWidth + paddingX * 2;
    const boxH = fontSize + paddingY * 2;
    const boxX = x - boxW / 2;
    const boxY = y - boxH - 7 * scope.verticalPixelRatio;
    ctx.beginPath();
    ctx.fillStyle = "rgba(16, 16, 16, 0.88)";
    ctx.roundRect(boxX, boxY, boxW, boxH, 5 * scope.horizontalPixelRatio);
    ctx.fill();
    ctx.fillStyle = "#d8d8d8";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, boxY + boxH / 2);
  }
}

class PathPaneView implements IPrimitivePaneView {
  private points: ViewPoint[] = [];

  constructor(private readonly source: PathPrimitive) {}

  zOrder(): PrimitivePaneViewZOrder {
    return "top";
  }

  update(): void {
    const { chart, series, anchors } = this.source;
    if (anchors.length === 0 || !chart || !series) {
      this.points = [];
      return;
    }
    this.points = anchors.map((anchor) => ({
      x: anchorToCoordinate(chart, series, anchor),
      y: series.priceToCoordinate(anchor.price),
    }));
  }

  renderer(): IPrimitivePaneRenderer {
    return new PathRenderer(
      this.points,
      this.source.renderOptions,
      this.source.selected,
    );
  }
}

export class PathPrimitive implements ISeriesPrimitive<Time>, IDrawing {
  readonly tool = "path" as const;
  renderOptions: PathRenderOptions;
  private anchorsInternal: AnchorPoint[];
  private readonly paneView: PathPaneView;
  private requestUpdateFn?: () => void;
  private selectedInternal = false;
  private optionsInternal: DrawingOptions;

  chart: IChartApiBase<Time> | undefined;
  series: ISeriesApi<"Candlestick", Time> | undefined;

  constructor(
    readonly id: string,
    anchors: AnchorPoint[],
    options?: DrawingOptions,
  ) {
    this.anchorsInternal = [...anchors];
    this.optionsInternal = { ...options };
    this.renderOptions = toRenderOptions(this.optionsInternal);
    this.paneView = new PathPaneView(this);
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

  setOptions(options: DrawingOptions): void {
    this.optionsInternal = { ...this.optionsInternal, ...options };
    this.renderOptions = toRenderOptions(this.optionsInternal);
    this.requestUpdate();
  }

  toState(): DrawingState {
    return {
      id: this.id,
      tool: this.tool,
      anchors: [...this.anchorsInternal],
      options: this.optionsInternal,
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

  autoscaleInfo(): null {
    // Freehand annotations must not widen the candle price range on reset.
    return null;
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
