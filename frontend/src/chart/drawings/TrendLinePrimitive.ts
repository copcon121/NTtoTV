/**
 * TrendLine drawing adapted from TradingView's official v5 plugin example:
 * https://github.com/tradingview/lightweight-charts/blob/master/plugin-examples/src/plugins/trend-line/trend-line.ts
 *
 * The app keeps its React toolbar/DrawingManager and uses the official
 * primitive rendering pattern inside the existing IDrawing contract.
 */

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
import type {
  BitmapCoordinatesRenderingScope,
  CanvasRenderingTarget2D,
} from "fancy-canvas";

import { anchorToCoordinate, anchorToLogical } from "./coordinates";
import type { AnchorPoint, DrawingOptions, DrawingState, IDrawing } from "./types";

interface ViewPoint {
  x: Coordinate | null;
  y: Coordinate | null;
}

interface TrendLineRenderOptions {
  lineColor: string;
  width: number;
  lineStyle: "solid" | "dashed";
  showLabels: boolean;
  noteText: string;
  labelBackgroundColor: string;
  labelTextColor: string;
}

const DEFAULT_OPTIONS: TrendLineRenderOptions = {
  lineColor: "#2962ff",
  width: 2,
  lineStyle: "solid",
  showLabels: true,
  noteText: "",
  labelBackgroundColor: "rgba(16, 16, 16, 0.88)",
  labelTextColor: "#d8d8d8",
};

function toRenderOptions(options?: DrawingOptions): TrendLineRenderOptions {
  return {
    ...DEFAULT_OPTIONS,
    lineColor: options?.lineColor ?? DEFAULT_OPTIONS.lineColor,
    width: options?.lineWidth ?? DEFAULT_OPTIONS.width,
    lineStyle: options?.lineStyle ?? DEFAULT_OPTIONS.lineStyle,
    showLabels: options?.showLabels ?? DEFAULT_OPTIONS.showLabels,
    noteText: options?.noteText?.trim() ?? DEFAULT_OPTIONS.noteText,
  };
}

class TrendLineRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly p1: ViewPoint,
    private readonly p2: ViewPoint,
    private readonly text1: string,
    private readonly text2: string,
    private readonly options: TrendLineRenderOptions,
    private readonly selected: boolean,
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      if (
        this.p1.x === null ||
        this.p1.y === null ||
        this.p2.x === null ||
        this.p2.y === null
      ) {
        return;
      }
      const ctx = scope.context;
      const x1 = Math.round(this.p1.x * scope.horizontalPixelRatio);
      const y1 = Math.round(this.p1.y * scope.verticalPixelRatio);
      const x2 = Math.round(this.p2.x * scope.horizontalPixelRatio);
      const y2 = Math.round(this.p2.y * scope.verticalPixelRatio);

      ctx.save();
      ctx.lineWidth = Math.max(1, this.options.width * scope.horizontalPixelRatio);
      ctx.strokeStyle = this.options.lineColor;
      ctx.setLineDash(
        this.options.lineStyle === "dashed"
          ? [8 * scope.horizontalPixelRatio, 6 * scope.horizontalPixelRatio]
          : [],
      );
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      if (this.options.noteText) {
        this.drawNoteLabel(scope, this.options.noteText, (x1 + x2) / 2, (y1 + y2) / 2);
      }

      if (this.selected) {
        ctx.fillStyle = this.options.lineColor;
        const radius = 4 * scope.horizontalPixelRatio;
        ctx.beginPath();
        ctx.arc(x1, y1, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x2, y2, radius, 0, Math.PI * 2);
        ctx.fill();

        if (this.options.showLabels) {
          this.drawTextLabel(scope, this.text1, x1, y1, true);
          this.drawTextLabel(scope, this.text2, x2, y2, false);
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
    const maxWidth = 180 * scope.horizontalPixelRatio;
    const fontSize = 12 * scope.verticalPixelRatio;
    ctx.font = `${fontSize}px Arial`;
    const label = ellipsizeCanvasText(ctx, text, maxWidth);
    const textWidth = ctx.measureText(label).width;
    const boxW = textWidth + paddingX * 2;
    const boxH = fontSize + paddingY * 2;
    const boxX = x - boxW / 2;
    let boxY = y - boxH - 7 * scope.verticalPixelRatio;
    if (boxY < 2 * scope.verticalPixelRatio) {
      boxY = y + 7 * scope.verticalPixelRatio;
    }

    ctx.beginPath();
    ctx.fillStyle = this.options.labelBackgroundColor;
    ctx.roundRect(boxX, boxY, boxW, boxH, 5 * scope.horizontalPixelRatio);
    ctx.fill();
    ctx.fillStyle = this.options.labelTextColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x, boxY + boxH / 2);
  }

  private drawTextLabel(
    scope: BitmapCoordinatesRenderingScope,
    text: string,
    x: number,
    y: number,
    left: boolean,
  ): void {
    const ctx = scope.context;
    const offset = 5 * scope.horizontalPixelRatio;
    const height = 22 * scope.verticalPixelRatio;
    ctx.font = `${12 * scope.verticalPixelRatio}px Arial`;
    const textWidth = ctx.measureText(text).width;
    const leftAdjustment = left ? textWidth + offset * 4 : 0;
    const boxX = x + offset - leftAdjustment;
    const boxY = y - height;
    const boxW = textWidth + offset * 2;
    const boxH = height + offset;

    ctx.beginPath();
    ctx.fillStyle = this.options.labelBackgroundColor;
    ctx.roundRect(boxX, boxY, boxW, boxH, 5 * scope.horizontalPixelRatio);
    ctx.fill();
    ctx.fillStyle = this.options.labelTextColor;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(text, x + offset * 2 - leftAdjustment, y);
  }
}

function ellipsizeCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const suffix = "...";
  let next = text;
  while (next.length > 0 && ctx.measureText(`${next}${suffix}`).width > maxWidth) {
    next = next.slice(0, -1);
  }
  return next.length > 0 ? `${next}${suffix}` : suffix;
}

class TrendLinePaneView implements IPrimitivePaneView {
  private p1: ViewPoint = { x: null, y: null };
  private p2: ViewPoint = { x: null, y: null };

  constructor(private readonly source: TrendLinePrimitive) {}

  zOrder(): PrimitivePaneViewZOrder {
    return "top";
  }

  update(): void {
    const { chart, series, anchors } = this.source;
    if (anchors.length < 2 || !chart || !series) {
      this.p1 = { x: null, y: null };
      this.p2 = { x: null, y: null };
      return;
    }
    this.p1 = {
      x: anchorToCoordinate(chart, series, anchors[0]),
      y: series.priceToCoordinate(anchors[0].price),
    };
    this.p2 = {
      x: anchorToCoordinate(chart, series, anchors[1]),
      y: series.priceToCoordinate(anchors[1].price),
    };
  }

  renderer(): IPrimitivePaneRenderer {
    const anchors = this.source.anchors;
    return new TrendLineRenderer(
      this.p1,
      this.p2,
      anchors[0]?.price.toFixed(1) ?? "",
      anchors[1]?.price.toFixed(1) ?? "",
      this.source.renderOptions,
      this.source.selected,
    );
  }
}

export class TrendLinePrimitive implements ISeriesPrimitive<Time>, IDrawing {
  readonly tool = "trendline" as const;
  renderOptions: TrendLineRenderOptions;
  private anchorsInternal: AnchorPoint[];
  private readonly paneView: TrendLinePaneView;
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
    this.paneView = new TrendLinePaneView(this);
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

  autoscaleInfo(startTimePoint: Logical, endTimePoint: Logical): AutoscaleInfo | null {
    if (this.anchorsInternal.length < 2) return null;
    const p1Index = this.pointIndex(this.anchorsInternal[0]);
    const p2Index = this.pointIndex(this.anchorsInternal[1]);
    if (p1Index === null || p2Index === null) return null;
    const start = Math.min(p1Index, p2Index);
    const end = Math.max(p1Index, p2Index);
    if (endTimePoint < start || startTimePoint > end) return null;
    return {
      priceRange: {
        minValue: Math.min(this.anchorsInternal[0].price, this.anchorsInternal[1].price),
        maxValue: Math.max(this.anchorsInternal[0].price, this.anchorsInternal[1].price),
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

  private pointIndex(point: AnchorPoint): Logical | null {
    return this.chart && this.series ? anchorToLogical(this.chart, this.series, point) : null;
  }
}
