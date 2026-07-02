/**
 * HorizontalRay drawing — a horizontal line extending to the right from an
 * anchor point.
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

interface HorizontalRayRenderOptions {
  lineColor: string;
  width: number;
  lineStyle: "solid" | "dashed";
}

const DEFAULT_OPTIONS: HorizontalRayRenderOptions = {
  lineColor: "#FF6D00",
  width: 1,
  lineStyle: "solid",
};

function toRenderOptions(options?: DrawingOptions): HorizontalRayRenderOptions {
  return {
    ...DEFAULT_OPTIONS,
    lineColor: options?.lineColor ?? DEFAULT_OPTIONS.lineColor,
    width: options?.lineWidth ?? DEFAULT_OPTIONS.width,
    lineStyle: options?.lineStyle ?? DEFAULT_OPTIONS.lineStyle,
  };
}

/* ------------------------------------------------------------------ */
/* Pane renderer                                                       */
/* ------------------------------------------------------------------ */

class HorizontalRayRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly _x: number,
    private readonly _y: number,
    private readonly _rightEdge: number,
    private readonly _options: HorizontalRayRenderOptions,
    private readonly _price: number,
    private readonly _selected: boolean,
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context: ctx }) => {
      ctx.save();
      ctx.lineWidth = this._options.width;
      ctx.strokeStyle = this._options.lineColor;
      ctx.setLineDash(this._options.lineStyle === "dashed" ? [8, 6] : []);
      ctx.beginPath();
      ctx.moveTo(this._x, this._y);
      ctx.lineTo(this._rightEdge, this._y);
      ctx.stroke();

      if (this._selected) {
        // Anchor dot
        const r = 4;
        ctx.fillStyle = this._options.lineColor;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(this._x, this._y, r, 0, Math.PI * 2);
        ctx.fill();

        // Price label on right
        ctx.font = "11px sans-serif";
        ctx.fillStyle = this._options.lineColor;
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText(this._price.toFixed(1), this._rightEdge - 4, this._y - 3);
      }

      ctx.restore();
    });
  }
}

/* ------------------------------------------------------------------ */
/* Pane view                                                           */
/* ------------------------------------------------------------------ */

class HorizontalRayPaneView implements IPrimitivePaneView {
  private _x = 0;
  private _y = 0;
  private _rightEdge = 0;
  private _price = 0;

  constructor(private readonly _source: HorizontalRayPrimitive) {}

  zOrder(): PrimitivePaneViewZOrder {
    return "top";
  }

  update(): void {
    const source = this._source;
    if (source.anchors.length < 1 || !source.chart || !source.series) return;
    const x = anchorToCoordinate(source.chart, source.series, source.anchors[0]);
    const y = source.series.priceToCoordinate(source.anchors[0].price);
    if (x === null || y === null) return;
    this._x = x as number;
    this._y = y as number;
    this._price = source.anchors[0].price;
    // Extend to the visible right edge of the chart area
    const width = source.chart.paneSize(0).width;
    this._rightEdge = width;
  }

  renderer(): IPrimitivePaneRenderer {
    return new HorizontalRayRenderer(
      this._x,
      this._y,
      this._rightEdge,
      this._source.renderOptions,
      this._price,
      this._source.selected,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Series primitive                                                    */
/* ------------------------------------------------------------------ */

export class HorizontalRayPrimitive implements ISeriesPrimitive<Time>, IDrawing {
  readonly tool = "horizontal_ray" as const;
  renderOptions: HorizontalRayRenderOptions;
  private _anchors: AnchorPoint[];
  private _paneView: HorizontalRayPaneView;
  private _requestUpdate?: () => void;
  private _selected = false;
  private _options: DrawingOptions;

  chart: IChartApiBase<Time> | undefined;
  series: ISeriesApi<"Candlestick", Time> | undefined;

  constructor(
    readonly id: string,
    anchors: AnchorPoint[],
    options?: DrawingOptions,
  ) {
    this._anchors = [...anchors];
    this._options = { ...options };
    this.renderOptions = toRenderOptions(this._options);
    this._paneView = new HorizontalRayPaneView(this);
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

  setOptions(options: DrawingOptions): void {
    this._options = { ...this._options, ...options };
    this.renderOptions = toRenderOptions(this._options);
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
