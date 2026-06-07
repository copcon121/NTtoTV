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
import type { CanvasRenderingTarget2D } from "fancy-canvas";

import { anchorToCoordinate } from "./coordinates";
import type { AnchorPoint, DrawingOptions, DrawingState, IDrawing } from "./types";

type LineRole = "entry" | "sl" | "tp";

interface RenderLine {
  role: LineRole;
  y: number;
  price: number;
}

class OrderBracketRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly _x1: number,
    private readonly _x2: number,
    private readonly _lines: readonly RenderLine[],
    private readonly _selected: boolean,
    private readonly _valid: boolean,
    private readonly _anchorPoints: readonly { x: number; y: number }[],
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      if (this._lines.length === 0) return;
      const entry = this._lines.find((line) => line.role === "entry");
      const sl = this._lines.find((line) => line.role === "sl");
      const tp = this._lines.find((line) => line.role === "tp");
      ctx.save();

      if (entry && sl) {
        this._fillBand(ctx, entry.y, sl.y, "rgba(190, 45, 45, 0.14)");
      }
      if (entry && tp) {
        this._fillBand(ctx, entry.y, tp.y, "rgba(35, 150, 90, 0.14)");
      }

      for (const line of this._lines) {
        const color =
          line.role === "tp"
            ? "rgba(28, 160, 90, 0.92)"
            : line.role === "sl"
              ? "rgba(210, 55, 55, 0.92)"
              : this._valid
                ? "rgba(225, 185, 70, 0.95)"
                : "rgba(210, 150, 55, 0.95)";
        ctx.strokeStyle = color;
        ctx.lineWidth = line.role === "entry" ? 2 : 1.5;
        ctx.setLineDash(this._valid ? [] : [5, 4]);
        ctx.beginPath();
        ctx.moveTo(this._x1, line.y);
        ctx.lineTo(this._x2, line.y);
        ctx.stroke();
        this._drawLabel(ctx, line, color);
      }

      if (entry && sl && tp) {
        const risk = Math.abs(entry.price - sl.price);
        const reward = Math.abs(tp.price - entry.price);
        const rr = risk > 0 ? reward / risk : 0;
        this._drawCenterLabel(
          ctx,
          `${this._side(entry.price, sl.price, tp.price)}  R:R ${rr.toFixed(2)}`,
          (entry.y + tp.y) / 2,
        );
      }

      if (this._selected) {
        ctx.setLineDash([]);
        ctx.fillStyle = "#f2f2f2";
        for (const point of this._anchorPoints) {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    });
  }

  private _fillBand(
    ctx: CanvasRenderingContext2D,
    y1: number,
    y2: number,
    color: string,
  ): void {
    ctx.fillStyle = color;
    ctx.fillRect(this._x1, Math.min(y1, y2), this._x2 - this._x1, Math.abs(y2 - y1));
  }

  private _drawLabel(
    ctx: CanvasRenderingContext2D,
    line: RenderLine,
    color: string,
  ): void {
    const label = `${line.role.toUpperCase()} ${line.price.toFixed(1)}`;
    ctx.font = "11px sans-serif";
    const width = ctx.measureText(label).width + 10;
    const height = 18;
    const x = Math.max(this._x1 + 2, this._x2 - width - 4);
    const y = line.y - height / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 4);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + 5, line.y);
  }

  private _drawCenterLabel(
    ctx: CanvasRenderingContext2D,
    text: string,
    y: number,
  ): void {
    ctx.font = "bold 11px sans-serif";
    const width = ctx.measureText(text).width + 12;
    const height = 18;
    const x = this._x1 + Math.max(6, (this._x2 - this._x1 - width) / 2);
    ctx.fillStyle = this._valid ? "rgba(35, 35, 35, 0.82)" : "rgba(120, 65, 25, 0.9)";
    ctx.beginPath();
    ctx.roundRect(x, y - height / 2, width, height, 4);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + 6, y);
  }

  private _side(entry: number, sl: number, tp: number): string {
    if (tp > entry && entry > sl) return "Buy";
    if (tp < entry && entry < sl) return "Sell";
    return "Invalid";
  }
}

class OrderBracketPaneView implements IPrimitivePaneView {
  private _x1 = 0;
  private _x2 = 0;
  private _lines: RenderLine[] = [];
  private _anchorPoints: { x: number; y: number }[] = [];
  private _valid = true;

  constructor(private readonly _source: OrderBracketPrimitive) {}

  zOrder(): PrimitivePaneViewZOrder {
    return "top";
  }

  update(): void {
    const source = this._source;
    this._lines = [];
    this._anchorPoints = [];
    if (source.anchors.length < 1 || !source.chart || !source.series) return;
    const points = source.anchors
      .map((anchor) => {
        const x = anchorToCoordinate(source.chart!, source.series!, anchor);
        const y = source.series!.priceToCoordinate(anchor.price);
        return x === null || y === null
          ? null
          : { x: x as number, y: y as number, price: anchor.price };
      })
      .filter((point): point is { x: number; y: number; price: number } => point !== null);
    if (points.length === 0) return;
    this._x1 = Math.min(...points.map((point) => point.x));
    this._x2 = Math.max(...points.map((point) => point.x), this._x1 + 80);
    this._anchorPoints = points.map(({ x, y }) => ({ x, y }));
    const roles: LineRole[] = ["entry", "sl", "tp"];
    this._lines = points.map((point, index) => ({
      role: roles[index] ?? "entry",
      y: point.y,
      price: point.price,
    }));
    this._valid = true;
    if (source.anchors.length >= 3) {
      const [entry, sl, tp] = source.anchors.map((anchor) => anchor.price);
      this._valid = (tp > entry && entry > sl) || (tp < entry && entry < sl);
    }
  }

  renderer(): IPrimitivePaneRenderer {
    return new OrderBracketRenderer(
      this._x1,
      this._x2,
      this._lines,
      this._source.selected,
      this._valid,
      this._anchorPoints,
    );
  }
}

export class OrderBracketPrimitive implements ISeriesPrimitive<Time>, IDrawing {
  readonly tool = "order_bracket" as const;
  private _anchors: AnchorPoint[];
  private readonly _paneView: OrderBracketPaneView;
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
    this._paneView = new OrderBracketPaneView(this);
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
    this._selected = selected;
    this.requestUpdate();
  }

  toState(): DrawingState {
    return { id: this.id, tool: this.tool, anchors: [...this._anchors], options: this._options };
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
