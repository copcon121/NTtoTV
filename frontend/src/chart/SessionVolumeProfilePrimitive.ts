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
  DeltaProfileDevelopingLevelPoint,
} from "../orderflow/deltaProfile";
import {
  DEFAULT_SESSION_VOLUME_PROFILE_WIDTH_PX,
  normalizeSessionVolumeProfileWidth,
} from "./sessionVolumeProfileSettings";

const RIGHT_MARGIN_PX = 0;
const INSET_PX = 2;
const VALUE_AREA_LINE_EXTENSION_PX = 24;
const POC_COLOR = "rgba(218, 165, 32, 0.95)";
const POC_LINE_COLOR = "rgba(218, 165, 32, 0.50)";
const DEFAULT_VAH_VAL_COLOR = "rgba(170, 205, 255, 0.58)";
const DEVELOPING_POC_COLOR = "rgba(218, 165, 32, 0.92)";

const COLORS = {
  positive: [0, 155, 150],
  positiveMuted: [0, 96, 112],
  negative: [232, 38, 76],
  negativeMuted: [128, 26, 52],
} as const;

function rgba(rgb: readonly [number, number, number], a: number): string {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

interface RenderRow {
  y: number;
  height: number;
  widthRatio: number;
  delta: number;
  isPoc: boolean;
  inValueArea: boolean;
}

interface RenderPoint {
  x: number;
  y: number;
}

interface ProfileRenderData {
  rows: readonly RenderRow[];
  developingPoc: readonly RenderPoint[];
  developingVah: readonly RenderPoint[];
  developingVal: readonly RenderPoint[];
  pocY: number | null;
  vahY: number | null;
  valY: number | null;
  rightEdge: number;
  profileWidth: number;
  valueAreaLineColor: string;
}

class SessionVolumeProfileRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly data: ProfileRenderData | null) {}

  draw(target: CanvasRenderingTarget2D): void {
    if (!this.data || this.data.rows.length === 0) return;
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;
      const data = this.data!;
      const profileRight = Math.round(data.rightEdge * hr);
      const profileWidth = Math.round(data.profileWidth * hr);
      const inset = Math.round(INSET_PX * hr);
      const maxBarWidth = Math.max(2, profileWidth - inset * 2);
      const barRight = profileRight - inset;

      ctx.save();

      drawDevelopingLine(
        ctx,
        data.developingVah,
        data.rightEdge,
        hr,
        vr,
        data.valueAreaLineColor,
        [Math.round(2 * hr), Math.round(3 * hr)],
      );
      drawDevelopingLine(
        ctx,
        data.developingVal,
        data.rightEdge,
        hr,
        vr,
        data.valueAreaLineColor,
        [Math.round(2 * hr), Math.round(3 * hr)],
      );
      drawDevelopingLine(
        ctx,
        data.developingPoc,
        data.rightEdge,
        hr,
        vr,
        DEVELOPING_POC_COLOR,
      );

      for (const row of data.rows) {
        const y = Math.round(row.y * vr);
        const h = Math.max(1, Math.round(row.height * vr));
        const barW = Math.max(1, Math.round(row.widthRatio * maxBarWidth));

        if (row.isPoc) {
          ctx.fillStyle = POC_COLOR;
        } else if (row.delta >= 0) {
          ctx.fillStyle = row.inValueArea
            ? rgba(COLORS.positive, 0.82)
            : rgba(COLORS.positiveMuted, 0.35);
        } else {
          ctx.fillStyle = row.inValueArea
            ? rgba(COLORS.negative, 0.82)
            : rgba(COLORS.negativeMuted, 0.35);
        }
        ctx.fillRect(barRight - barW, y, barW, h);
      }

      ctx.lineWidth = Math.max(1, Math.round(hr));
      const lineLeft = Math.max(
        0,
        Math.round(
          (data.rightEdge - data.profileWidth - VALUE_AREA_LINE_EXTENSION_PX) *
            hr,
        ),
      );
      const lineRight = profileRight;

      if (data.pocY !== null) {
        const py = Math.round(data.pocY * vr);
        ctx.strokeStyle = POC_LINE_COLOR;
        ctx.setLineDash([Math.round(4 * hr), Math.round(3 * hr)]);
        ctx.beginPath();
        ctx.moveTo(lineLeft, py);
        ctx.lineTo(lineRight, py);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (data.vahY !== null) {
        const vy = Math.round(data.vahY * vr);
        ctx.strokeStyle = data.valueAreaLineColor;
        ctx.setLineDash([Math.round(2 * hr), Math.round(3 * hr)]);
        ctx.beginPath();
        ctx.moveTo(lineLeft, vy);
        ctx.lineTo(lineRight, vy);
        ctx.stroke();
      }
      if (data.valY !== null) {
        const vy = Math.round(data.valY * vr);
        ctx.strokeStyle = data.valueAreaLineColor;
        ctx.beginPath();
        ctx.moveTo(lineLeft, vy);
        ctx.lineTo(lineRight, vy);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    });
  }
}

function drawDevelopingLine(
  ctx: CanvasRenderingContext2D,
  points: readonly RenderPoint[],
  rightEdge: number,
  horizontalPixelRatio: number,
  verticalPixelRatio: number,
  color: string,
  dash: readonly number[] = [],
): void {
  const visible = points.filter(
    (point) =>
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      point.x >= 0 &&
      point.x <= rightEdge,
  );
  if (visible.length < 2) return;

  const stroke = () => {
    ctx.beginPath();
    ctx.moveTo(
      Math.round(visible[0].x * horizontalPixelRatio),
      Math.round(visible[0].y * verticalPixelRatio),
    );
    for (const point of visible.slice(1)) {
      ctx.lineTo(
        Math.round(point.x * horizontalPixelRatio),
        Math.round(point.y * verticalPixelRatio),
      );
    }
    ctx.stroke();
  };

  ctx.setLineDash([...dash]);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, Math.round(horizontalPixelRatio));
  stroke();
  ctx.setLineDash([]);
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
}

class SessionVolumeProfilePaneView implements IPrimitivePaneView {
  private renderData: ProfileRenderData | null = null;

  constructor(private readonly source: SessionVolumeProfilePrimitive) {}

  update(): void {
    const { chart, series, profile } = this.source;
    if (!chart || !series || !profile || profile.rows.length === 0) {
      this.renderData = null;
      return;
    }

    const paneWidth = chart.paneSize(0).width;
    const rightEdge = paneWidth - RIGHT_MARGIN_PX;

    const step = inferPriceStep(profile);
    const maxVolume = Math.max(1, ...profile.rows.map((r) => r.totalVolume));
    const { poc, vah, val } = profile;

    const rows: RenderRow[] = [];
    for (const row of profile.rows) {
      if (row.totalVolume <= 0) continue;
      const y = series.priceToCoordinate(row.price);
      if (y === null) continue;
      const yNext = series.priceToCoordinate(row.price + step);
      const h =
        yNext !== null
          ? Math.max(1, Math.abs((yNext as number) - (y as number)) * 0.88)
          : 3;
      const isPoc = poc !== null && Math.abs(row.price - poc) < step * 0.5;
      const inValueArea =
        vah !== null &&
        val !== null &&
        row.price >= Math.min(vah, val) - step * 0.5 &&
        row.price <= Math.max(vah, val) + step * 0.5;

      rows.push({
        y: (y as number) - h / 2,
        height: h,
        widthRatio: row.totalVolume / maxVolume,
        delta: row.delta,
        isPoc,
        inValueArea,
      });
    }

    const developingPoc = this.source.developingPocVisible
      ? profilePointsToRenderPoints(
          profile.developingPoc,
          chart,
          series,
          this.source.displayTimeOffsetMs,
        )
      : [];
    const developingVah = this.source.developingPocVisible
      ? profilePointsToRenderPoints(
          profile.developingVah,
          chart,
          series,
          this.source.displayTimeOffsetMs,
        )
      : [];
    const developingVal = this.source.developingPocVisible
      ? profilePointsToRenderPoints(
          profile.developingVal,
          chart,
          series,
          this.source.displayTimeOffsetMs,
        )
      : [];

    const pocY = poc !== null ? series.priceToCoordinate(poc) : null;
    const vahY = vah !== null ? series.priceToCoordinate(vah) : null;
    const valY = val !== null ? series.priceToCoordinate(val) : null;

    this.renderData = {
      rows,
      developingPoc,
      developingVah,
      developingVal,
      pocY: pocY !== null ? (pocY as number) : null,
      vahY: vahY !== null ? (vahY as number) : null,
      valY: valY !== null ? (valY as number) : null,
      rightEdge,
      profileWidth: this.source.profileWidthPx,
      valueAreaLineColor: this.source.valueAreaLineColor,
    };
  }

  renderer(): IPrimitivePaneRenderer {
    return new SessionVolumeProfileRenderer(this.renderData);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return "bottom";
  }
}

export class SessionVolumeProfilePrimitive implements ISeriesPrimitive<Time> {
  private readonly paneView: SessionVolumeProfilePaneView;
  private requestUpdateFn?: () => void;
  private profileData: DeltaProfileData | null = null;
  private widthPx = DEFAULT_SESSION_VOLUME_PROFILE_WIDTH_PX;
  private showDevelopingPoc = true;
  private timeOffsetMs = 0;
  private vahValColor = DEFAULT_VAH_VAL_COLOR;

  chart: IChartApiBase<Time> | undefined;
  series: ISeriesApi<"Candlestick", Time> | undefined;

  constructor() {
    this.paneView = new SessionVolumeProfilePaneView(this);
  }

  get profile(): DeltaProfileData | null {
    return this.profileData;
  }

  get profileWidthPx(): number {
    return this.widthPx;
  }

  get developingPocVisible(): boolean {
    return this.showDevelopingPoc;
  }

  get displayTimeOffsetMs(): number {
    return this.timeOffsetMs;
  }

  get valueAreaLineColor(): string {
    return this.vahValColor;
  }

  setProfile(data: DeltaProfileData | null): void {
    this.profileData = data;
    this.requestUpdate();
  }

  setProfileWidth(widthPx: number): void {
    const normalized = normalizeSessionVolumeProfileWidth(widthPx);
    if (normalized === this.widthPx) return;
    this.widthPx = normalized;
    this.requestUpdate();
  }

  setDevelopingPocVisible(visible: boolean): void {
    if (visible === this.showDevelopingPoc) return;
    this.showDevelopingPoc = visible;
    this.requestUpdate();
  }

  setValueAreaLineColor(color: string): void {
    if (color === this.vahValColor) return;
    this.vahValColor = color;
    this.requestUpdate();
  }

  setDisplayTimeOffset(offsetMs: number): void {
    const next = Number.isFinite(offsetMs) ? offsetMs : 0;
    if (next === this.timeOffsetMs) return;
    this.timeOffsetMs = next;
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

function profilePointsToRenderPoints(
  points: readonly DeltaProfileDevelopingLevelPoint[] | undefined,
  chart: IChartApiBase<Time>,
  series: ISeriesApi<"Candlestick", Time>,
  displayTimeOffsetMs: number,
): RenderPoint[] {
  return (points ?? []).flatMap((point) => {
    if (!Number.isFinite(point.time) || !Number.isFinite(point.price)) {
      return [];
    }
    const x = chart
      .timeScale()
      .timeToCoordinate(
        Math.floor((point.time + displayTimeOffsetMs) / 1000) as UTCTimestamp,
      );
    const y = series.priceToCoordinate(point.price);
    return x === null || y === null ? [] : [{ x: x as number, y: y as number }];
  });
}

function inferPriceStep(profile: DeltaProfileData): number {
  const prices = profile.rows
    .map((r) => r.price)
    .filter((p) => Number.isFinite(p))
    .sort((a, b) => a - b);
  let minDiff = Infinity;
  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0 && diff < minDiff) minDiff = diff;
  }
  return Number.isFinite(minDiff)
    ? minDiff
    : Math.max(0.1, profile.rowTicks * 0.1);
}
