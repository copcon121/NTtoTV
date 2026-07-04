import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  PrimitivePaneViewZOrder,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";

import { anchorToCoordinate, anchorToLogical } from "./coordinates";
import type { AnchorPoint, DrawingOptions, DrawingState, IDrawing } from "./types";

interface DateRangeRenderOptions {
  lineColor: string;
  width: number;
  labelBackgroundColor: string;
  labelTextColor: string;
}

interface DateRangeStats {
  bars: number;
  durationSeconds: number;
  volume: number | null;
}

const DEFAULT_OPTIONS: DateRangeRenderOptions = {
  lineColor: "#2962ff",
  width: 2,
  labelBackgroundColor: "rgba(255, 255, 255, 0.96)",
  labelTextColor: "#111827",
};

function toRenderOptions(options?: DrawingOptions): DateRangeRenderOptions {
  return {
    ...DEFAULT_OPTIONS,
    lineColor: options?.lineColor ?? DEFAULT_OPTIONS.lineColor,
    width: Math.max(1, Math.min(4, Math.round(options?.lineWidth ?? DEFAULT_OPTIONS.width))),
  };
}

class DateRangeRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly x1: number | null,
    private readonly x2: number | null,
    private readonly y: number | null,
    private readonly stats: DateRangeStats,
    private readonly options: DateRangeRenderOptions,
    private readonly selected: boolean,
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      if (this.x1 === null || this.x2 === null || this.y === null) return;
      const left = Math.min(this.x1, this.x2);
      const right = Math.max(this.x1, this.x2);
      if (right - left < 1) return;

      ctx.save();
      ctx.strokeStyle = this.options.lineColor;
      ctx.lineWidth = this.options.width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(left, this.y);
      ctx.lineTo(right, this.y);
      ctx.stroke();

      if (this.selected) {
        this.drawHandle(ctx, left, this.y);
        this.drawHandle(ctx, right, this.y);
      }

      this.drawLabel(ctx, (left + right) / 2, this.y, mediaSize.width);
      ctx.restore();
    });
  }

  private drawHandle(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = this.options.lineColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  private drawLabel(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    lineY: number,
    paneWidth: number,
  ): void {
    const lines = [
      `${this.stats.bars} bars, ${formatDuration(this.stats.durationSeconds)}`,
      `Vol ${formatVolume(this.stats.volume)}`,
    ];
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const paddingX = 9;
    const paddingY = 7;
    const lineHeight = 16;
    const labelWidth =
      Math.max(...lines.map((line) => ctx.measureText(line).width)) + paddingX * 2;
    const labelHeight = lineHeight * lines.length + paddingY * 2;
    const x = clamp(centerX, labelWidth / 2 + 4, paneWidth - labelWidth / 2 - 4);
    let y = lineY - labelHeight / 2 - 18;
    if (y < 4) {
      y = lineY + 18;
    }

    ctx.fillStyle = this.options.labelBackgroundColor;
    ctx.shadowColor = "rgba(15, 23, 42, 0.18)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.beginPath();
    ctx.roundRect(x - labelWidth / 2, y, labelWidth, labelHeight, 5);
    ctx.fill();
    ctx.shadowColor = "transparent";

    ctx.fillStyle = this.options.labelTextColor;
    lines.forEach((line, index) => {
      ctx.fillText(line, x, y + paddingY + lineHeight / 2 + index * lineHeight);
    });
  }
}

class DateRangePaneView implements IPrimitivePaneView {
  private x1: number | null = null;
  private x2: number | null = null;
  private y: number | null = null;
  private stats: DateRangeStats = { bars: 0, durationSeconds: 0, volume: null };

  constructor(private readonly source: DateRangePrimitive) {}

  zOrder(): PrimitivePaneViewZOrder {
    return "top";
  }

  update(): void {
    const { chart, series, anchors } = this.source;
    this.x1 = null;
    this.x2 = null;
    this.y = null;
    this.stats = { bars: 0, durationSeconds: 0, volume: null };
    if (!chart || !series || anchors.length < 2) return;

    const x1 = anchorToCoordinate(chart, series, anchors[0]);
    const x2 = anchorToCoordinate(chart, series, anchors[1]);
    const y = series.priceToCoordinate(anchors[0].price);
    if (x1 === null || x2 === null || y === null) return;

    this.x1 = x1 as number;
    this.x2 = x2 as number;
    this.y = y as number;
    this.stats = dateRangeStats(chart, series, anchors);
  }

  renderer(): IPrimitivePaneRenderer {
    return new DateRangeRenderer(
      this.x1,
      this.x2,
      this.y,
      this.stats,
      this.source.renderOptions,
      this.source.selected,
    );
  }
}

export class DateRangePrimitive implements ISeriesPrimitive<Time>, IDrawing {
  readonly tool = "date_range" as const;
  readonly renderOptions: DateRangeRenderOptions;
  private anchorsInternal: AnchorPoint[];
  private readonly paneView: DateRangePaneView;
  private requestUpdateFn?: () => void;
  private selectedInternal = false;

  chart: IChartApiBase<Time> | undefined;
  series: ISeriesApi<"Candlestick", Time> | undefined;

  constructor(
    readonly id: string,
    anchors: AnchorPoint[],
    private readonly options?: DrawingOptions,
  ) {
    this.anchorsInternal = normalizeDateRangeAnchors(anchors);
    this.renderOptions = toRenderOptions(options);
    this.paneView = new DateRangePaneView(this);
  }

  get anchors(): AnchorPoint[] {
    return this.anchorsInternal;
  }

  get selected(): boolean {
    return this.selectedInternal;
  }

  setAnchors(anchors: AnchorPoint[]): void {
    this.anchorsInternal = normalizeDateRangeAnchors(anchors);
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

export function normalizeDateRangeAnchors(
  anchors: readonly AnchorPoint[],
): AnchorPoint[] {
  if (anchors.length < 2) {
    return anchors.map((anchor) => ({ ...anchor }));
  }
  const price = anchors[0].price;
  return anchors.map((anchor) => ({ ...anchor, price }));
}

export function dateRangeStats(
  chart: IChartApiBase<Time>,
  series: ISeriesApi<"Candlestick", Time>,
  anchors: readonly AnchorPoint[],
): DateRangeStats {
  if (anchors.length < 2) return { bars: 0, durationSeconds: 0, volume: null };
  const start = Math.min(Number(anchors[0].time), Number(anchors[1].time));
  const end = Math.max(Number(anchors[0].time), Number(anchors[1].time));
  const data = series.data() as ReadonlyArray<{ time: Time; volume?: number }>;
  const selected = data.filter((item) => {
    const time = numericTime(item.time);
    return time !== null && time >= start && time <= end;
  });
  const bars = selected.length > 0 ? selected.length : fallbackBarCount(chart, series, anchors);
  const volumeValues = selected
    .map((item) => Number(item.volume))
    .filter((volume) => Number.isFinite(volume) && volume >= 0);
  const volume =
    selected.length > 0 && volumeValues.length === selected.length
      ? volumeValues.reduce((sum, value) => sum + value, 0)
      : null;
  return {
    bars,
    durationSeconds: Math.abs(Number(anchors[1].time) - Number(anchors[0].time)),
    volume,
  };
}

function fallbackBarCount(
  chart: IChartApiBase<Time>,
  series: ISeriesApi<"Candlestick", Time>,
  anchors: readonly AnchorPoint[],
): number {
  const first = anchorToLogical(chart, series, anchors[0]);
  const second = anchorToLogical(chart, series, anchors[1]);
  if (first === null || second === null) return 0;
  return Math.max(1, Math.round(Math.abs((second as number) - (first as number))) + 1);
}

function numericTime(time: Time): number | null {
  return typeof time === "number" && Number.isFinite(time) ? time : null;
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function formatVolume(volume: number | null): string {
  if (volume === null || !Number.isFinite(volume)) return "-";
  const abs = Math.abs(volume);
  if (abs >= 1_000_000) return `${trimFixed(volume / 1_000_000, 2)}M`;
  if (abs >= 1_000) return `${trimFixed(volume / 1_000, 2)}K`;
  return `${Math.round(volume)}`;
}

function trimFixed(value: number, digits: number): string {
  return value.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}
