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
  UTCTimestamp,
} from "lightweight-charts";

import type {
  DeltaProfileData,
  DeltaProfileLoadState,
  DeltaProfileRow,
} from "../../orderflow/deltaProfile";
import { anchorToCoordinate } from "./coordinates";
import type {
  AnchorPoint,
  DrawingOptions,
  DrawingState,
  FixedRangeProfileMode,
  IDrawing,
} from "./types";

interface RenderRow {
  y: number;
  height: number;
  bidVolume: number;
  askVolume: number;
  totalVolume: number;
  delta: number;
  inValueArea: boolean;
}

interface RenderLine {
  y: number;
  kind: "poc" | "vah" | "val";
}

interface RenderPoint {
  x: number;
  y: number;
}

const COLORS = {
  selection: "#2962ff",
  selectionFill: "#ffffff",
  valueAreaLine: "rgba(170, 205, 255, 0.98)",
  developingPoc: "rgba(218, 165, 32, 0.92)",
  poc: "#daa520",
  text: "#f5f5f5",
  labelBg: "rgba(16, 16, 16, 0.82)",
};

const BASE_COLORS = {
  valueAreaBand: [100, 149, 237],
  positive: [0, 155, 150],
  positiveMuted: [0, 96, 112],
  negative: [232, 38, 76],
  negativeMuted: [128, 26, 52],
  neutral: [100, 149, 237],
  neutralMuted: [66, 92, 135],
  volume: [100, 149, 237],
  volumeMuted: [58, 86, 126],
} as const;

type RenderLayer = "profile" | "selection";

const PROFILE_WIDTH_RATIO = 0.72;
const PROFILE_MAX_WIDTH_PX = 560;
const PROFILE_INSET_PX = 3;
export const DEFAULT_PROFILE_VALUE_AREA_OPACITY = 0.86;
export const DEFAULT_PROFILE_OUTSIDE_VALUE_AREA_OPACITY = 0.18;
const DEFAULT_PROFILE_VALUE_AREA_BAND_OPACITY = 0.055;

class FixedRangeDeltaProfileRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly x1: number,
    private readonly x2: number,
    private readonly y1: number,
    private readonly y2: number,
    private readonly rows: readonly RenderRow[],
    private readonly lines: readonly RenderLine[],
    private readonly developingPoc: readonly RenderPoint[],
    private readonly state: DeltaProfileLoadState,
    private readonly mode: FixedRangeProfileMode,
    private readonly selected: boolean,
    private readonly layer: RenderLayer,
    private readonly valueAreaOpacity: number,
    private readonly outsideValueAreaOpacity: number,
    private readonly showDevelopingPoc: boolean,
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const left = Math.min(this.x1, this.x2);
      const right = Math.max(this.x1, this.x2);
      const top = Math.min(this.y1, this.y2);
      const bottom = Math.max(this.y1, this.y2);
      const width = right - left;
      if (width < 2) return;

      ctx.save();

      if (this.layer === "selection") {
        if (this.selected) {
          drawSelection(ctx, left, right, top, bottom);
        }
        ctx.restore();
        return;
      }

      if (this.state.status === "ready" && this.state.profile.rows.length > 0) {
        const vah = this.lines.find((line) => line.kind === "vah");
        const val = this.lines.find((line) => line.kind === "val");
        const histogramWidth = profileHistogramWidth(width);
        const histogramRight = Math.min(right, left + histogramWidth);
        if (vah && val) {
          drawValueAreaBand(
            ctx,
            left,
            histogramRight,
            top,
            bottom,
            vah.y,
            val.y,
            this.valueAreaOpacity,
          );
        }

        const maxVolume = Math.max(
          1,
          ...this.rows.map((row) => row.totalVolume),
        );
        const maxAbsDelta = Math.max(
          1,
          ...this.rows.map((row) => Math.abs(row.delta)),
        );
        const barLeft = left + PROFILE_INSET_PX;
        const maxBarWidth = Math.max(2, histogramWidth - PROFILE_INSET_PX * 2);
        for (const row of this.rows) {
          const h = Math.max(2, Math.min(18, row.height));
          const y = row.y - h / 2;
          if (row.y < top || row.y > bottom) continue;
          if (y > mediaSize.height || y + h < 0) continue;

          const totalWidth = Math.max(1, (row.totalVolume / maxVolume) * maxBarWidth);
          if (this.mode === "volume") {
            ctx.fillStyle = row.inValueArea
              ? rgba(BASE_COLORS.volume, this.valueAreaOpacity)
              : rgba(BASE_COLORS.volumeMuted, this.outsideValueAreaOpacity);
            ctx.fillRect(barLeft, y, totalWidth, h);
            continue;
          }
          const deltaWidth = Math.max(
            1,
            (Math.abs(row.delta) / maxAbsDelta) * maxBarWidth,
          );
          if (row.delta > 0) {
            ctx.fillStyle = row.inValueArea
              ? rgba(BASE_COLORS.positive, this.valueAreaOpacity)
              : rgba(BASE_COLORS.positiveMuted, this.outsideValueAreaOpacity);
            ctx.fillRect(barLeft, y, deltaWidth, h);
            continue;
          }
          if (row.delta < 0) {
            ctx.fillStyle = row.inValueArea
              ? rgba(BASE_COLORS.negative, this.valueAreaOpacity)
              : rgba(BASE_COLORS.negativeMuted, this.outsideValueAreaOpacity);
            ctx.fillRect(barLeft, y, deltaWidth, h);
            continue;
          }
          ctx.fillStyle = row.inValueArea
            ? rgba(BASE_COLORS.neutral, Math.min(this.valueAreaOpacity, 0.62))
            : rgba(BASE_COLORS.neutralMuted, this.outsideValueAreaOpacity);
          ctx.fillRect(barLeft, y, 1, h);
        }

        if (this.developingPoc.length >= 2) {
          drawDevelopingPoc(ctx, this.developingPoc, left, right, top, bottom);
        }

        if (vah && val && vah.y >= top && vah.y <= bottom && val.y >= top && val.y <= bottom) {
          drawValueAreaLine(ctx, left, right, vah.y);
          drawValueAreaLine(ctx, left, right, val.y);
        }

        const poc = this.showDevelopingPoc
          ? undefined
          : this.lines.find((line) => line.kind === "poc");
        if (poc && poc.y >= top && poc.y <= bottom) {
          ctx.strokeStyle = COLORS.poc;
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.moveTo(left, poc.y);
          ctx.lineTo(right, poc.y);
          ctx.stroke();
        }
      } else {
        const message =
          this.state.status === "loading"
            ? "Loading delta profile"
          : this.state.status === "error"
              ? "Delta profile unavailable"
              : "No ladder data";
        this.drawLabel(ctx, left + 6, 8, message);
      }

      ctx.restore();
    });
  }

  private drawLabel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    text: string,
  ): void {
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const metrics = ctx.measureText(text);
    ctx.fillStyle = COLORS.labelBg;
    ctx.fillRect(x - 4, y - 3, metrics.width + 8, 18);
    ctx.fillStyle = COLORS.text;
    ctx.fillText(text, x, y);
  }
}

function drawSelection(
  ctx: CanvasRenderingContext2D,
  left: number,
  right: number,
  top: number,
  bottom: number,
): void {
  ctx.setLineDash([3, 2]);
  ctx.strokeStyle = COLORS.selection;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(left, top, right - left, bottom - top);
  ctx.setLineDash([]);

  const midY = (top + bottom) / 2;
  const radius = 6.5;
  const handles = [
    [left, top],
    [right, top],
    [left, midY],
    [right, midY],
    [left, bottom],
    [right, bottom],
  ] as const;

  ctx.fillStyle = COLORS.selectionFill;
  ctx.strokeStyle = COLORS.selection;
  ctx.lineWidth = 2;
  for (const [x, y] of handles) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function drawValueAreaLine(
  ctx: CanvasRenderingContext2D,
  left: number,
  right: number,
  y: number,
): void {
  ctx.lineCap = "butt";
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = COLORS.valueAreaLine;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(right, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineCap = "butt";
}

function drawDevelopingPoc(
  ctx: CanvasRenderingContext2D,
  points: readonly RenderPoint[],
  left: number,
  right: number,
  top: number,
  bottom: number,
): void {
  const visible = points.filter(
    (point) =>
      point.x >= left &&
      point.x <= right &&
      point.y >= top &&
      point.y <= bottom,
  );
  if (visible.length < 2) return;
  ctx.setLineDash([]);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = COLORS.developingPoc;
  ctx.lineWidth = 1;
  strokePolyline(ctx, visible);
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
}

function strokePolyline(
  ctx: CanvasRenderingContext2D,
  points: readonly RenderPoint[],
): void {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) {
    ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
}

function rgba(color: readonly [number, number, number], opacity: number): string {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${clampOpacity(opacity)})`;
}

export function clampProfileOpacity(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(1, Math.max(0.02, value as number));
}

function clampOpacity(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function profileHistogramWidth(rangeWidth: number): number {
  if (!Number.isFinite(rangeWidth) || rangeWidth <= 0) return 0;
  return Math.max(
    2,
    Math.min(
      rangeWidth - PROFILE_INSET_PX * 2,
      rangeWidth * PROFILE_WIDTH_RATIO,
      PROFILE_MAX_WIDTH_PX,
    ),
  );
}

function drawValueAreaBand(
  ctx: CanvasRenderingContext2D,
  left: number,
  right: number,
  top: number,
  bottom: number,
  vahY: number,
  valY: number,
  valueAreaOpacity: number,
): void {
  const bandTop = Math.max(top, Math.min(vahY, valY));
  const bandBottom = Math.min(bottom, Math.max(vahY, valY));
  if (bandBottom <= bandTop) return;
  ctx.fillStyle = rgba(
    BASE_COLORS.valueAreaBand,
    Math.min(DEFAULT_PROFILE_VALUE_AREA_BAND_OPACITY, valueAreaOpacity * 0.07),
  );
  ctx.fillRect(left, bandTop, right - left, bandBottom - bandTop);
}

class FixedRangeDeltaProfilePaneView implements IPrimitivePaneView {
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;
  private rows: RenderRow[] = [];
  private lines: RenderLine[] = [];
  private developingPoc: RenderPoint[] = [];

  constructor(private readonly source: FixedRangeDeltaProfilePrimitive) {}

  zOrder(): PrimitivePaneViewZOrder {
    return "bottom";
  }

  update(): void {
    const { chart, series, anchors } = this.source;
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;
    this.rows = [];
    this.lines = [];
    this.developingPoc = [];
    if (!chart || !series || anchors.length < 2) return;

    const x1 = anchorToCoordinate(chart, series, anchors[0]);
    const x2 = anchorToCoordinate(chart, series, anchors[1]);
    if (x1 === null || x2 === null) return;
    const y1 = series.priceToCoordinate(anchors[0].price);
    const y2 = series.priceToCoordinate(anchors[1].price);
    if (y1 === null || y2 === null) return;
    this.x1 = x1 as number;
    this.x2 = x2 as number;
    this.y1 = y1 as number;
    this.y2 = y2 as number;

    const state = this.source.profileState;
    if (state.status !== "ready" || state.profile.rows.length === 0) return;

    const step = inferPriceStep(state.profile);
    const { vah, val } = state.profile;
    this.rows = state.profile.rows.flatMap((row) => {
      const y = series.priceToCoordinate(row.price);
      if (y === null) return [];
      const h = rowHeight(series, row.price, step);
      return [
        {
          y: y as number,
          height: h,
          bidVolume: row.bidVolume,
          askVolume: row.askVolume,
          totalVolume: row.totalVolume,
          delta: row.delta,
          inValueArea: isPriceInsideValueArea(row.price, vah, val),
        },
      ];
    });
    this.lines = [
      profileLine(series, state.profile.poc, "poc"),
      profileLine(series, state.profile.vah, "vah"),
      profileLine(series, state.profile.val, "val"),
    ].filter((line): line is RenderLine => line !== null);
    if (this.source.showDevelopingPoc) {
      this.developingPoc = (state.profile.developingPoc ?? []).flatMap((point) => {
        if (!Number.isFinite(point.time) || !Number.isFinite(point.price)) {
          return [];
        }
        const x = chart.timeScale().timeToCoordinate(
          Math.floor(point.time / 1000) as UTCTimestamp,
        );
        const y = series.priceToCoordinate(point.price);
        return x === null || y === null ? [] : [{ x: x as number, y: y as number }];
      });
    }
  }

  renderer(): IPrimitivePaneRenderer {
    return new FixedRangeDeltaProfileRenderer(
      this.x1,
      this.x2,
      this.y1,
      this.y2,
      this.rows,
      this.lines,
      this.developingPoc,
      this.source.profileState,
      this.source.profileMode,
      this.source.selected,
      "profile",
      this.source.valueAreaOpacity,
      this.source.outsideValueAreaOpacity,
      this.source.showDevelopingPoc,
    );
  }
}

class FixedRangeDeltaProfileSelectionPaneView implements IPrimitivePaneView {
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  constructor(private readonly source: FixedRangeDeltaProfilePrimitive) {}

  zOrder(): PrimitivePaneViewZOrder {
    return "top";
  }

  update(): void {
    const { chart, series, anchors } = this.source;
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;
    if (!chart || !series || anchors.length < 2) return;

    const x1 = anchorToCoordinate(chart, series, anchors[0]);
    const x2 = anchorToCoordinate(chart, series, anchors[1]);
    const y1 = series.priceToCoordinate(anchors[0].price);
    const y2 = series.priceToCoordinate(anchors[1].price);
    if (x1 === null || x2 === null || y1 === null || y2 === null) return;
    this.x1 = x1 as number;
    this.x2 = x2 as number;
    this.y1 = y1 as number;
    this.y2 = y2 as number;
  }

  renderer(): IPrimitivePaneRenderer {
    return new FixedRangeDeltaProfileRenderer(
      this.x1,
      this.x2,
      this.y1,
      this.y2,
      [],
      [],
      [],
      this.source.profileState,
      this.source.profileMode,
      this.source.selected,
      "selection",
      this.source.valueAreaOpacity,
      this.source.outsideValueAreaOpacity,
      this.source.showDevelopingPoc,
    );
  }
}

export class FixedRangeDeltaProfilePrimitive
  implements ISeriesPrimitive<Time>, IDrawing
{
  readonly tool = "fixed_range_delta_profile" as const;
  private _anchors: AnchorPoint[];
  private readonly _paneView: FixedRangeDeltaProfilePaneView;
  private readonly _selectionPaneView: FixedRangeDeltaProfileSelectionPaneView;
  private _requestUpdate?: () => void;
  private _selected = false;
  private _profileState: DeltaProfileLoadState = { status: "loading" };

  chart: IChartApiBase<Time> | undefined;
  series: ISeriesApi<"Candlestick", Time> | undefined;

  constructor(
    readonly id: string,
    anchors: AnchorPoint[],
    private _options?: DrawingOptions,
  ) {
    this._anchors = [...anchors];
    this._paneView = new FixedRangeDeltaProfilePaneView(this);
    this._selectionPaneView = new FixedRangeDeltaProfileSelectionPaneView(this);
  }

  get anchors(): AnchorPoint[] {
    return this._anchors;
  }

  get selected(): boolean {
    return this._selected;
  }

  get profileState(): DeltaProfileLoadState {
    return this._profileState;
  }

  get profileMode(): FixedRangeProfileMode {
    return normalizeFixedRangeProfileMode(this._options?.fixedRangeProfileMode);
  }

  get extendRight(): boolean {
    return this._options?.fixedRangeProfileExtendRight === true;
  }

  get autoFitVertical(): boolean {
    return this._options?.fixedRangeProfileAutoFitVertical !== false;
  }

  get valueAreaOpacity(): number {
    return clampProfileOpacity(
      this._options?.fixedRangeProfileValueAreaOpacity,
      DEFAULT_PROFILE_VALUE_AREA_OPACITY,
    );
  }

  get outsideValueAreaOpacity(): number {
    return clampProfileOpacity(
      this._options?.fixedRangeProfileOutsideValueAreaOpacity,
      DEFAULT_PROFILE_OUTSIDE_VALUE_AREA_OPACITY,
    );
  }

  get showDevelopingPoc(): boolean {
    return this._options?.fixedRangeProfileDevelopingPoc === true;
  }

  setAnchors(anchors: AnchorPoint[]): void {
    this._anchors = [...anchors];
    this._profileState = { status: "loading" };
    this.requestUpdate();
  }

  setProfileState(state: DeltaProfileLoadState): void {
    this._profileState = state;
    this.requestUpdate();
  }

  setOptions(options: DrawingOptions): void {
    this._options = { ...this._options, ...options };
    this._profileState = { status: "loading" };
    this.requestUpdate();
  }

  fitVerticalRangeToProfile(): boolean {
    if (!this.autoFitVertical || this._profileState.status !== "ready") {
      return false;
    }
    const rows = this._profileState.profile.rows.filter(
      (row) => Number.isFinite(row.price) && row.totalVolume > 0,
    );
    if (this._anchors.length < 2 || rows.length === 0) return false;

    const prices = rows.map((row) => row.price);
    const step = inferPriceStep(this._profileState.profile);
    const padding = Math.max(0, step / 2);
    const minPrice = roundProfileAnchorPrice(Math.min(...prices) - padding);
    const maxPrice = roundProfileAnchorPrice(Math.max(...prices) + padding);
    const [first, second] = this._anchors;
    if (!first || !second) return false;

    const next = this._anchors.map((anchor) => ({ ...anchor }));
    if (first.price >= second.price) {
      next[0].price = maxPrice;
      next[1].price = minPrice;
    } else {
      next[0].price = minPrice;
      next[1].price = maxPrice;
    }

    if (
      Math.abs(next[0].price - first.price) < 1e-9 &&
      Math.abs(next[1].price - second.price) < 1e-9
    ) {
      return false;
    }

    this._anchors = next;
    this.requestUpdate();
    return true;
  }

  setSelected(selected: boolean): void {
    if (this._selected === selected) return;
    this._selected = selected;
    this.requestUpdate();
  }

  toState(): DrawingState {
    return {
      id: this.id,
      tool: this.tool,
      anchors: [...this._anchors],
      options: this._options,
    };
  }

  requestUpdate(): void {
    this._requestUpdate?.();
  }

  updateAllViews(): void {
    this._paneView.update();
    this._selectionPaneView.update();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this._paneView, this._selectionPaneView];
  }

  attached(params: SeriesAttachedParameter<Time, "Candlestick">): void {
    this.chart = params.chart;
    this.series = params.series;
    this._requestUpdate = params.requestUpdate;
  }

  detached(): void {
    this.chart = undefined;
    this.series = undefined;
    this._requestUpdate = undefined;
  }
}

function inferPriceStep(profile: DeltaProfileData): number {
  const prices = profile.rows
    .map((row: DeltaProfileRow) => row.price)
    .filter((price) => Number.isFinite(price))
    .sort((a, b) => a - b);
  let minDiff = Number.POSITIVE_INFINITY;
  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0 && diff < minDiff) minDiff = diff;
  }
  if (Number.isFinite(minDiff)) return minDiff;
  return Math.max(0.1, profile.rowTicks * 0.1);
}

function rowHeight(
  series: ISeriesApi<"Candlestick", Time>,
  price: number,
  step: number,
): number {
  const y = series.priceToCoordinate(price);
  const next = series.priceToCoordinate(price + step);
  if (y !== null && next !== null) {
    return Math.max(2, Math.abs((next as number) - (y as number)) * 0.9);
  }
  return 4;
}

function roundProfileAnchorPrice(price: number): number {
  return Number(price.toFixed(10));
}

function profileLine(
  series: ISeriesApi<"Candlestick", Time>,
  price: number | null,
  kind: RenderLine["kind"],
): RenderLine | null {
  if (price === null || !Number.isFinite(price)) return null;
  const y = series.priceToCoordinate(price);
  return y === null ? null : { y: y as number, kind };
}

export function isPriceInsideValueArea(
  price: number,
  vah: number | null,
  val: number | null,
): boolean {
  if (
    !Number.isFinite(price) ||
    vah === null ||
    val === null ||
    !Number.isFinite(vah) ||
    !Number.isFinite(val)
  ) {
    return true;
  }
  const low = Math.min(vah, val);
  const high = Math.max(vah, val);
  return price >= low && price <= high;
}

export function normalizeFixedRangeProfileMode(
  mode: string | null | undefined,
): FixedRangeProfileMode {
  return mode === "delta" || mode === "bidAsk" ? "delta" : "volume";
}
