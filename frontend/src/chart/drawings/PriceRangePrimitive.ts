/**
 * PriceRange drawing — two horizontal lines with a shaded area and
 * percentage / absolute diff labels between them.
 *
 * Implemented as an ISeriesPrimitive (v5 plugin API).
 */

import type {
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  PrimitivePaneViewZOrder,
  SeriesAttachedParameter,
  Time,
  ISeriesApi,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";

import { anchorToCoordinate } from "./coordinates";
import type { AnchorPoint, DrawingOptions, DrawingState, IDrawing } from "./types";

/* ------------------------------------------------------------------ */
/* Pane renderer                                                       */
/* ------------------------------------------------------------------ */

class PriceRangeRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly _x1: number,
    private readonly _y1: number,
    private readonly _x2: number,
    private readonly _y2: number,
    private readonly _color: string,
    private readonly _fillColor: string,
    private readonly _lineWidth: number,
    private readonly _price1: number,
    private readonly _price2: number,
    private readonly _selected: boolean,
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      const x1 = Math.min(this._x1, this._x2);
      const x2 = Math.max(this._x1, this._x2);
      const y1 = this._y1;
      const y2 = this._y2;
      const yTop = Math.min(y1, y2);
      const yBot = Math.max(y1, y2);
      const w = x2 - x1;

      ctx.save();

      // Fill area
      ctx.fillStyle = this._fillColor;
      ctx.fillRect(x1, yTop, w, yBot - yTop);

      // Top line
      ctx.strokeStyle = this._color;
      ctx.lineWidth = this._lineWidth;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y1);
      ctx.stroke();

      // Bottom line
      ctx.beginPath();
      ctx.moveTo(x1, y2);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Connecting vertical line (center)
      const cx = (x1 + x2) / 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, y1);
      ctx.lineTo(cx, y2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Labels
      const diff = this._price2 - this._price1;
      const pct = this._price1 !== 0 ? (diff / this._price1) * 100 : 0;
      const labelY = (yTop + yBot) / 2;

      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Background pill for label
      const text = `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}  (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)`;
      const metrics = ctx.measureText(text);
      const pw = metrics.width + 12;
      const ph = 19;
      const labelBg = diff >= 0 ? "rgba(0, 128, 0, 0.85)" : "rgba(180, 30, 30, 0.85)";
      ctx.fillStyle = labelBg;
      const rx = cx - pw / 2;
      const ry = labelY - ph / 2;
      const cornerR = 4;
      ctx.beginPath();
      ctx.moveTo(rx + cornerR, ry);
      ctx.lineTo(rx + pw - cornerR, ry);
      ctx.arcTo(rx + pw, ry, rx + pw, ry + cornerR, cornerR);
      ctx.lineTo(rx + pw, ry + ph - cornerR);
      ctx.arcTo(rx + pw, ry + ph, rx + pw - cornerR, ry + ph, cornerR);
      ctx.lineTo(rx + cornerR, ry + ph);
      ctx.arcTo(rx, ry + ph, rx, ry + ph - cornerR, cornerR);
      ctx.lineTo(rx, ry + cornerR);
      ctx.arcTo(rx, ry, rx + cornerR, ry, cornerR);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#fff";
      ctx.fillText(text, cx, labelY);

      if (this._selected) {
        // Anchor dots
        const r = 3;
        ctx.fillStyle = this._color;
        ctx.beginPath();
        ctx.arc(this._x1, this._y1, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this._x2, this._y2, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });
  }
}

/* ------------------------------------------------------------------ */
/* Pane view                                                           */
/* ------------------------------------------------------------------ */

class PriceRangePaneView implements IPrimitivePaneView {
  private _x1 = 0;
  private _y1 = 0;
  private _x2 = 0;
  private _y2 = 0;
  private _color: string;
  private _fillColor: string;
  private _lineWidth: number;
  private _price1 = 0;
  private _price2 = 0;

  constructor(
    private readonly _source: PriceRangePrimitive,
    opts?: DrawingOptions,
  ) {
    this._color = opts?.lineColor ?? "#00897B";
    this._fillColor = opts?.fillColor ?? "rgba(0, 137, 123, 0.12)";
    this._lineWidth = opts?.lineWidth ?? 1;
  }

  zOrder(): PrimitivePaneViewZOrder {
    return "top";
  }

  update(): void {
    const source = this._source;
    if (source.anchors.length < 2 || !source.chart || !source.series) return;
    const x1 = anchorToCoordinate(source.chart, source.anchors[0]);
    const y1 = source.series.priceToCoordinate(source.anchors[0].price);
    const x2 = anchorToCoordinate(source.chart, source.anchors[1]);
    const y2 = source.series.priceToCoordinate(source.anchors[1].price);
    if (x1 === null || y1 === null || x2 === null || y2 === null) return;
    this._x1 = x1 as number;
    this._y1 = y1 as number;
    this._x2 = x2 as number;
    this._y2 = y2 as number;
    this._price1 = source.anchors[0].price;
    this._price2 = source.anchors[1].price;
  }

  renderer(): IPrimitivePaneRenderer {
    return new PriceRangeRenderer(
      this._x1,
      this._y1,
      this._x2,
      this._y2,
      this._color,
      this._fillColor,
      this._lineWidth,
      this._price1,
      this._price2,
      this._source.selected,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Series primitive                                                    */
/* ------------------------------------------------------------------ */

export class PriceRangePrimitive implements ISeriesPrimitive<Time>, IDrawing {
  readonly tool = "price_range" as const;
  private _anchors: AnchorPoint[];
  private _paneView: PriceRangePaneView;
  private _requestUpdate?: () => void;
  private _selected = false;

  chart: IChartApiBase<Time> | undefined;
  series: ISeriesApi<"Candlestick", Time> | undefined;

  constructor(
    readonly id: string,
    anchors: AnchorPoint[],
    private readonly _options?: DrawingOptions,
  ) {
    this._anchors = [...anchors];
    this._paneView = new PriceRangePaneView(this, _options);
  }

  get anchors(): AnchorPoint[] {
    return this._anchors;
  }

  get selected(): boolean {
    return this._selected;
  }

  setAnchors(anchors: AnchorPoint[]): void {
    this._anchors = [...anchors];
    this.requestUpdate();
  }

  setSelected(selected: boolean): void {
    if (this._selected === selected) return;
    this._selected = selected;
    this.requestUpdate();
  }

  toState(): DrawingState {
    return { id: this.id, tool: this.tool, anchors: [...this._anchors], options: this._options };
  }

  requestUpdate(): void {
    this._requestUpdate?.();
  }

  /* ---- ISeriesPrimitive ---- */

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
