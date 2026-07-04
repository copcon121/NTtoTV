import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  AutoscaleInfo,
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

import { anchorToCoordinate, anchorToLogical } from "./coordinates";
import type {
  AnchorPoint,
  DrawingOptions,
  DrawingState,
  FibRetracementLevel,
  IDrawing,
} from "./types";

interface ViewPoint {
  x: number | null;
  y: number | null;
}

interface RenderLevel extends FibRetracementLevel {
  price: number;
  y: number;
}

interface FibRetracementRenderOptions {
  levels: FibRetracementLevel[];
  lineWidth: number;
  trendLineVisible: boolean;
  trendLineColor: string;
}

export const DEFAULT_FIB_RETRACEMENT_LEVELS: readonly FibRetracementLevel[] = [
  { value: 0, color: "#8a8d91", enabled: true },
  { value: 0.382, color: "#ff9800", enabled: true },
  { value: 0.618, color: "#00a991", enabled: true },
  { value: 1, color: "#8a8d91", enabled: true },
  { value: 3.618, color: "#9c27b0", enabled: true },
] as const;

const DEFAULT_TREND_LINE_COLOR = "#7f858a";
const DEFAULT_LINE_WIDTH = 1;

export function normalizeFibRetracementLevels(
  levels?: readonly Partial<FibRetracementLevel>[],
): FibRetracementLevel[] {
  const source =
    levels && levels.length > 0 ? levels : DEFAULT_FIB_RETRACEMENT_LEVELS;
  return source.slice(0, 12).map((level, index) => {
    const fallback =
      DEFAULT_FIB_RETRACEMENT_LEVELS[
        Math.min(index, DEFAULT_FIB_RETRACEMENT_LEVELS.length - 1)
      ];
    const value = Number(level.value);
    return {
      value: Number.isFinite(value) ? value : fallback.value,
      color: normalizeCssColor(level.color, fallback.color),
      enabled: level.enabled !== false,
    };
  });
}

export function formatFibLevelValue(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value - Math.round(value)) < 1e-9) {
    return String(Math.round(value));
  }
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export function fibLevelPrice(
  startPrice: number,
  endPrice: number,
  level: number,
): number {
  return startPrice + (endPrice - startPrice) * level;
}

function toRenderOptions(options?: DrawingOptions): FibRetracementRenderOptions {
  return {
    levels: normalizeFibRetracementLevels(options?.fibLevels),
    lineWidth: Math.max(1, Math.min(4, Math.round(options?.lineWidth ?? DEFAULT_LINE_WIDTH))),
    trendLineVisible: options?.fibTrendLineVisible !== false,
    trendLineColor: normalizeCssColor(
      options?.fibTrendLineColor,
      options?.lineColor ?? DEFAULT_TREND_LINE_COLOR,
    ),
  };
}

function normalizeCssColor(value: string | undefined, fallback: string): string {
  const next = typeof value === "string" ? value.trim() : "";
  return next.length > 0 ? next : fallback;
}

class FibRetracementRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly p1: ViewPoint,
    private readonly p2: ViewPoint,
    private readonly levels: readonly RenderLevel[],
    private readonly options: FibRetracementRenderOptions,
    private readonly selected: boolean,
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      if (
        this.p1.x === null ||
        this.p1.y === null ||
        this.p2.x === null ||
        this.p2.y === null
      ) {
        return;
      }

      const left = Math.min(this.p1.x, this.p2.x);
      const right = Math.max(this.p1.x, this.p2.x);
      if (right - left < 1) return;

      ctx.save();
      ctx.lineCap = "butt";
      ctx.lineJoin = "miter";

      if (this.options.trendLineVisible) {
        ctx.strokeStyle = this.options.trendLineColor;
        ctx.lineWidth = 1.25;
        ctx.setLineDash([8, 7]);
        ctx.beginPath();
        ctx.moveTo(this.p1.x, this.p1.y);
        ctx.lineTo(this.p2.x, this.p2.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.font = "11px Arial";
      ctx.textBaseline = "alphabetic";
      for (const level of this.levels) {
        if (level.y < -24 || level.y > mediaSize.height + 24) continue;
        ctx.strokeStyle = level.color;
        ctx.fillStyle = level.color;
        ctx.lineWidth = this.options.lineWidth;
        ctx.beginPath();
        ctx.moveTo(left, level.y);
        ctx.lineTo(right, level.y);
        ctx.stroke();
        this.drawLevelLabel(ctx, level, left, right, mediaSize.width);
      }

      if (this.selected) {
        this.drawHandle(ctx, this.p1.x, this.p1.y);
        this.drawHandle(ctx, this.p2.x, this.p2.y);
      }

      ctx.restore();
    });
  }

  private drawLevelLabel(
    ctx: CanvasRenderingContext2D,
    level: RenderLevel,
    left: number,
    right: number,
    paneWidth: number,
  ): void {
    const text = `${formatFibLevelValue(level.value)} (${formatFibPrice(level.price)})`;
    const width = ctx.measureText(text).width;
    let x = left - 8;
    let align: CanvasTextAlign = "right";
    if (x - width < 2) {
      x = Math.min(right - width - 4, left + 4);
      align = "left";
    }
    if (x + width > paneWidth - 2) {
      x = paneWidth - 2;
      align = "right";
    }
    ctx.textAlign = align;
    ctx.fillText(text, x, level.y - 5);
  }

  private drawHandle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
  ): void {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#2962ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

class FibRetracementPaneView implements IPrimitivePaneView {
  private p1: ViewPoint = { x: null, y: null };
  private p2: ViewPoint = { x: null, y: null };
  private levels: RenderLevel[] = [];

  constructor(private readonly source: FibRetracementPrimitive) {}

  zOrder(): PrimitivePaneViewZOrder {
    return "top";
  }

  update(): void {
    const { chart, series, anchors } = this.source;
    this.p1 = { x: null, y: null };
    this.p2 = { x: null, y: null };
    this.levels = [];
    if (!chart || !series || anchors.length < 2) return;

    const x1 = anchorToCoordinate(chart, series, anchors[0]);
    const y1 = series.priceToCoordinate(anchors[0].price);
    const x2 = anchorToCoordinate(chart, series, anchors[1]);
    const y2 = series.priceToCoordinate(anchors[1].price);
    if (x1 === null || y1 === null || x2 === null || y2 === null) return;

    this.p1 = { x: x1 as number, y: y1 as number };
    this.p2 = { x: x2 as number, y: y2 as number };
    this.levels = this.source.renderOptions.levels.flatMap((level) => {
      if (level.enabled === false) return [];
      const price = fibLevelPrice(anchors[0].price, anchors[1].price, level.value);
      const y = series.priceToCoordinate(price);
      return y === null ? [] : [{ ...level, price, y: y as number }];
    });
  }

  renderer(): IPrimitivePaneRenderer {
    return new FibRetracementRenderer(
      this.p1,
      this.p2,
      this.levels,
      this.source.renderOptions,
      this.source.selected,
    );
  }
}

export class FibRetracementPrimitive implements ISeriesPrimitive<Time>, IDrawing {
  readonly tool = "fib_retracement" as const;
  renderOptions: FibRetracementRenderOptions;
  private anchorsInternal: AnchorPoint[];
  private readonly paneView: FibRetracementPaneView;
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
    this.paneView = new FibRetracementPaneView(this);
  }

  get anchors(): AnchorPoint[] {
    return this.anchorsInternal;
  }

  get selected(): boolean {
    return this.selectedInternal;
  }

  get fibLevels(): readonly FibRetracementLevel[] {
    return this.renderOptions.levels;
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

    const prices = this.renderOptions.levels
      .filter((level) => level.enabled !== false)
      .map((level) =>
        fibLevelPrice(
          this.anchorsInternal[0].price,
          this.anchorsInternal[1].price,
          level.value,
        ),
      );
    if (prices.length === 0) return null;
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

  private pointIndex(point: AnchorPoint): Logical | null {
    return this.chart && this.series ? anchorToLogical(this.chart, this.series, point) : null;
  }
}

function formatFibPrice(price: number): string {
  if (!Number.isFinite(price)) return "";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(price);
}
