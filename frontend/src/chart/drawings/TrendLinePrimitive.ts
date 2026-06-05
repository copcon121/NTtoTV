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
  showLabels: boolean;
  labelBackgroundColor: string;
  labelTextColor: string;
}

const DEFAULT_OPTIONS: TrendLineRenderOptions = {
  lineColor: "#2962ff",
  width: 2,
  showLabels: true,
  labelBackgroundColor: "rgba(16, 16, 16, 0.88)",
  labelTextColor: "#d8d8d8",
};

function toRenderOptions(options?: DrawingOptions): TrendLineRenderOptions {
  return {
    ...DEFAULT_OPTIONS,
    lineColor: options?.lineColor ?? DEFAULT_OPTIONS.lineColor,
    width: options?.lineWidth ?? DEFAULT_OPTIONS.width,
    showLabels: options?.showLabels ?? DEFAULT_OPTIONS.showLabels,
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
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

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
    ctx.fillText(text, x + offset * 2 - leftAdjustment, y);
  }
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
      x: anchorToCoordinate(chart, anchors[0]),
      y: series.priceToCoordinate(anchors[0].price),
    };
    this.p2 = {
      x: anchorToCoordinate(chart, anchors[1]),
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
  readonly renderOptions: TrendLineRenderOptions;
  private anchorsInternal: AnchorPoint[];
  private readonly paneView: TrendLinePaneView;
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
    return this.chart ? anchorToLogical(this.chart, point) : null;
  }
}
