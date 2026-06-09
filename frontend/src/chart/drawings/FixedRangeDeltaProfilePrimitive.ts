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

import type {
  DeltaProfileData,
  DeltaProfileLoadState,
  DeltaProfileRow,
} from "../../orderflow/deltaProfile";
import { anchorToCoordinate, anchorToPoint } from "./coordinates";
import type { AnchorPoint, DrawingOptions, DrawingState, IDrawing } from "./types";

interface RenderRow {
  y: number;
  height: number;
  bidVolume: number;
  askVolume: number;
  totalVolume: number;
  inValueArea: boolean;
}

interface RenderLine {
  y: number;
  kind: "poc" | "vah" | "val";
}

interface RenderHandle {
  x: number;
  y: number;
}

const COLORS = {
  rangeFill: "rgba(125, 211, 252, 0.10)",
  rangeStroke: "rgba(56, 189, 248, 0.34)",
  valueAreaFill: "rgba(37, 99, 235, 0.06)",
  valueAreaLine: "rgba(37, 99, 235, 0.96)",
  valueAreaLineHalo: "rgba(255, 255, 255, 0.70)",
  positive: "rgba(45, 191, 204, 0.82)",
  positiveMuted: "rgba(45, 191, 204, 0.24)",
  negative: "rgba(223, 91, 136, 0.82)",
  negativeMuted: "rgba(223, 91, 136, 0.24)",
  neutral: "rgba(148, 163, 184, 0.45)",
  neutralMuted: "rgba(148, 163, 184, 0.16)",
  poc: "#111111",
  pocHalo: "rgba(255, 255, 255, 0.65)",
  text: "#f5f5f5",
  labelBg: "rgba(16, 16, 16, 0.82)",
  handle: "#e0b341",
};

class FixedRangeDeltaProfileRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly x1: number,
    private readonly x2: number,
    private readonly rows: readonly RenderRow[],
    private readonly lines: readonly RenderLine[],
    private readonly state: DeltaProfileLoadState,
    private readonly handles: readonly RenderHandle[],
    private readonly selected: boolean,
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const left = Math.min(this.x1, this.x2);
      const right = Math.max(this.x1, this.x2);
      const width = right - left;
      if (width < 2) return;

      ctx.save();
      ctx.fillStyle = COLORS.rangeFill;
      ctx.fillRect(left, 0, width, mediaSize.height);
      ctx.strokeStyle = COLORS.rangeStroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(left, 0, width, mediaSize.height);

      if (this.state.status === "ready" && this.state.profile.rows.length > 0) {
        const vah = this.lines.find((line) => line.kind === "vah");
        const val = this.lines.find((line) => line.kind === "val");
        if (vah && val) {
          const top = Math.min(vah.y, val.y);
          const height = Math.max(1, Math.abs(vah.y - val.y));
          ctx.fillStyle = COLORS.valueAreaFill;
          ctx.fillRect(left, top, width, height);
        }

        const maxVolume = Math.max(
          1,
          ...this.rows.map((row) => row.totalVolume),
        );
        const barLeft = left + 3;
        const maxBarWidth = Math.max(2, Math.min(width - 8, width * 0.55));
        for (const row of this.rows) {
          const h = Math.max(2, Math.min(18, row.height));
          const y = row.y - h / 2;
          if (y > mediaSize.height || y + h < 0) continue;

          const totalWidth = Math.max(1, (row.totalVolume / maxVolume) * maxBarWidth);
          const askWidth =
            row.totalVolume > 0 ? totalWidth * (row.askVolume / row.totalVolume) : 0;
          const bidWidth = Math.max(0, totalWidth - askWidth);
          if (askWidth > 0) {
            ctx.fillStyle = row.inValueArea ? COLORS.positive : COLORS.positiveMuted;
            ctx.fillRect(barLeft, y, askWidth, h);
          }
          if (bidWidth > 0) {
            ctx.fillStyle = row.inValueArea ? COLORS.negative : COLORS.negativeMuted;
            ctx.fillRect(barLeft + askWidth, y, bidWidth, h);
          }
          if (askWidth <= 0 && bidWidth <= 0) {
            ctx.fillStyle = row.inValueArea ? COLORS.neutral : COLORS.neutralMuted;
            ctx.fillRect(barLeft, y, totalWidth, h);
          }
        }

        if (vah && val) {
          drawValueAreaLine(ctx, left, right, vah.y);
          drawValueAreaLine(ctx, left, right, val.y);
        }

        const poc = this.lines.find((line) => line.kind === "poc");
        if (poc) {
          ctx.strokeStyle = COLORS.pocHalo;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(left, poc.y);
          ctx.lineTo(right, poc.y);
          ctx.stroke();
          ctx.strokeStyle = COLORS.poc;
          ctx.lineWidth = 2;
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

      if (this.selected) {
        ctx.fillStyle = COLORS.handle;
        for (const handle of this.handles) {
          ctx.beginPath();
          ctx.arc(handle.x, handle.y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
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

function drawValueAreaLine(
  ctx: CanvasRenderingContext2D,
  left: number,
  right: number,
  y: number,
): void {
  ctx.lineCap = "round";
  ctx.setLineDash([1, 6]);
  ctx.strokeStyle = COLORS.valueAreaLineHalo;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(right, y);
  ctx.stroke();
  ctx.strokeStyle = COLORS.valueAreaLine;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(right, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineCap = "butt";
}

class FixedRangeDeltaProfilePaneView implements IPrimitivePaneView {
  private x1 = 0;
  private x2 = 0;
  private rows: RenderRow[] = [];
  private lines: RenderLine[] = [];
  private handles: RenderHandle[] = [];

  constructor(private readonly source: FixedRangeDeltaProfilePrimitive) {}

  zOrder(): PrimitivePaneViewZOrder {
    return "top";
  }

  update(): void {
    const { chart, series, anchors } = this.source;
    this.x1 = 0;
    this.x2 = 0;
    this.rows = [];
    this.lines = [];
    this.handles = [];
    if (!chart || !series || anchors.length < 2) return;

    const x1 = anchorToCoordinate(chart, series, anchors[0]);
    const x2 = anchorToCoordinate(chart, series, anchors[1]);
    if (x1 === null || x2 === null) return;
    this.x1 = x1 as number;
    this.x2 = x2 as number;
    this.handles = anchors
      .slice(0, 2)
      .map((anchor) => anchorToPoint(chart, series, anchor))
      .filter((point): point is RenderHandle => point !== null);

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
          inValueArea: isPriceInsideValueArea(row.price, vah, val),
        },
      ];
    });
    this.lines = [
      profileLine(series, state.profile.poc, "poc"),
      profileLine(series, state.profile.vah, "vah"),
      profileLine(series, state.profile.val, "val"),
    ].filter((line): line is RenderLine => line !== null);
  }

  renderer(): IPrimitivePaneRenderer {
    return new FixedRangeDeltaProfileRenderer(
      this.x1,
      this.x2,
      this.rows,
      this.lines,
      this.source.profileState,
      this.handles,
      this.source.selected,
    );
  }
}

export class FixedRangeDeltaProfilePrimitive
  implements ISeriesPrimitive<Time>, IDrawing
{
  readonly tool = "fixed_range_delta_profile" as const;
  private _anchors: AnchorPoint[];
  private readonly _paneView: FixedRangeDeltaProfilePaneView;
  private _requestUpdate?: () => void;
  private _selected = false;
  private _profileState: DeltaProfileLoadState = { status: "loading" };

  chart: IChartApiBase<Time> | undefined;
  series: ISeriesApi<"Candlestick", Time> | undefined;

  constructor(
    readonly id: string,
    anchors: AnchorPoint[],
    private readonly _options?: DrawingOptions,
  ) {
    this._anchors = [...anchors];
    this._paneView = new FixedRangeDeltaProfilePaneView(this);
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

  setAnchors(anchors: AnchorPoint[]): void {
    this._anchors = [...anchors];
    this._profileState = { status: "loading" };
    this.requestUpdate();
  }

  setProfileState(state: DeltaProfileLoadState): void {
    this._profileState = state;
    this.requestUpdate();
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
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this._paneView];
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
