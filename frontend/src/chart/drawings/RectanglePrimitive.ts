/**
 * Rectangle drawing adapted from TradingView's official v5 plugin example:
 * https://github.com/tradingview/lightweight-charts/blob/master/plugin-examples/src/plugins/rectangle-drawing-tool/rectangle-drawing-tool.ts
 *
 * The official example owns its own DOM toolbar. This version keeps the app's
 * React toolbar and only adapts the primitive/axis rendering.
 */

import type { CanvasRenderingTarget2D } from "fancy-canvas";
import {
  isBusinessDay,
  type Coordinate,
  type IChartApiBase,
  type IPrimitivePaneRenderer,
  type IPrimitivePaneView,
  type ISeriesApi,
  type ISeriesPrimitive,
  type ISeriesPrimitiveAxisView,
  type PrimitivePaneViewZOrder,
  type SeriesAttachedParameter,
  type Time,
} from "lightweight-charts";

import { anchorToCoordinate } from "./coordinates";
import type { AnchorPoint, DrawingOptions, DrawingState, IDrawing } from "./types";

interface ViewPoint {
  x: Coordinate | null;
  y: Coordinate | null;
}

interface UpdatablePaneView extends IPrimitivePaneView {
  update(): void;
}

interface UpdatableAxisView extends ISeriesPrimitiveAxisView {
  update(): void;
}

interface RectangleRenderOptions {
  fillColor: string;
  labelColor: string;
  labelTextColor: string;
  showLabels: boolean;
  priceLabelFormatter: (price: number) => string;
  timeLabelFormatter: (time: Time) => string;
}

const DEFAULT_OPTIONS: RectangleRenderOptions = {
  fillColor: "rgba(123, 31, 162, 0.18)",
  labelColor: "rgba(123, 31, 162, 1)",
  labelTextColor: "#ffffff",
  showLabels: true,
  priceLabelFormatter: (price) => price.toFixed(1),
  timeLabelFormatter: (time) => {
    if (typeof time === "string") return time;
    const date = isBusinessDay(time)
      ? new Date(time.year, time.month - 1, time.day)
      : new Date(time * 1000);
    return date.toLocaleDateString();
  },
};

function toRenderOptions(options?: DrawingOptions): RectangleRenderOptions {
  const fillColor = options?.fillColor ?? DEFAULT_OPTIONS.fillColor;
  return {
    ...DEFAULT_OPTIONS,
    fillColor,
    labelColor: options?.lineColor ?? DEFAULT_OPTIONS.labelColor,
    showLabels: options?.showLabels ?? DEFAULT_OPTIONS.showLabels,
  };
}

function positionsBox(p1: Coordinate, p2: Coordinate, pixelRatio: number) {
  const scaled1 = Math.round(p1 * pixelRatio);
  const scaled2 = Math.round(p2 * pixelRatio);
  return {
    position: Math.min(scaled1, scaled2),
    length: Math.abs(scaled2 - scaled1),
  };
}

class RectangleRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly p1: ViewPoint,
    private readonly p2: ViewPoint,
    private readonly fillColor: string,
    private readonly strokeColor: string,
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

      const horizontal = positionsBox(this.p1.x, this.p2.x, scope.horizontalPixelRatio);
      const vertical = positionsBox(this.p1.y, this.p2.y, scope.verticalPixelRatio);
      const ctx = scope.context;
      ctx.fillStyle = this.fillColor;
      ctx.fillRect(horizontal.position, vertical.position, horizontal.length, vertical.length);
      ctx.strokeStyle = this.strokeColor;
      ctx.lineWidth = Math.max(1, Math.floor(scope.horizontalPixelRatio));
      ctx.strokeRect(
        horizontal.position,
        vertical.position,
        horizontal.length,
        vertical.length,
      );
      if (!this.selected) return;
      ctx.fillStyle = this.strokeColor;
      const radius = 3 * scope.horizontalPixelRatio;
      for (const [x, y] of [
        [horizontal.position, vertical.position],
        [horizontal.position + horizontal.length, vertical.position],
        [horizontal.position, vertical.position + vertical.length],
        [horizontal.position + horizontal.length, vertical.position + vertical.length],
      ]) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
}

class RectanglePaneView implements UpdatablePaneView {
  private p1: ViewPoint = { x: null, y: null };
  private p2: ViewPoint = { x: null, y: null };

  constructor(private readonly source: RectanglePrimitive) {}

  update(): void {
    const anchors = this.source.anchors;
    const { chart, series } = this.source;
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
    return new RectangleRenderer(
      this.p1,
      this.p2,
      this.source.renderOptions.fillColor,
      this.source.renderOptions.labelColor,
      this.source.selected,
    );
  }
}

class RectangleAxisPaneRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly p1: Coordinate | null,
    private readonly p2: Coordinate | null,
    private readonly fillColor: string,
    private readonly vertical: boolean,
    private readonly selected: boolean,
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      if (!this.selected) return;
      if (this.p1 === null || this.p2 === null) return;
      const positions = positionsBox(
        this.p1,
        this.p2,
        this.vertical ? scope.verticalPixelRatio : scope.horizontalPixelRatio,
      );
      const ctx = scope.context;
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = this.fillColor;
      if (this.vertical) {
        ctx.fillRect(0, positions.position, 15, positions.length);
      } else {
        ctx.fillRect(positions.position, 0, positions.length, 15);
      }
      ctx.restore();
    });
  }
}

abstract class RectangleAxisPaneView implements UpdatablePaneView {
  protected p1: Coordinate | null = null;
  protected p2: Coordinate | null = null;

  constructor(
    protected readonly source: RectanglePrimitive,
    private readonly vertical: boolean,
  ) {}

  abstract getPoints(): [Coordinate | null, Coordinate | null];

  update(): void {
    [this.p1, this.p2] = this.getPoints();
  }

  renderer(): IPrimitivePaneRenderer {
    return new RectangleAxisPaneRenderer(
      this.p1,
      this.p2,
      this.source.renderOptions.labelColor,
      this.vertical,
      this.source.selected,
    );
  }

  zOrder(): PrimitivePaneViewZOrder {
    return "bottom";
  }
}

class RectanglePriceAxisPaneView extends RectangleAxisPaneView {
  getPoints(): [Coordinate | null, Coordinate | null] {
    const { series, anchors } = this.source;
    if (!series || anchors.length < 2) return [null, null];
    return [
      series.priceToCoordinate(anchors[0].price),
      series.priceToCoordinate(anchors[1].price),
    ];
  }
}

class RectangleTimeAxisPaneView extends RectangleAxisPaneView {
  getPoints(): [Coordinate | null, Coordinate | null] {
    const { chart, series, anchors } = this.source;
    if (!chart || !series || anchors.length < 2) return [null, null];
    return [
      anchorToCoordinate(chart, series, anchors[0]),
      anchorToCoordinate(chart, series, anchors[1]),
    ];
  }
}

abstract class RectangleAxisView implements UpdatableAxisView {
  private position: Coordinate | null = null;

  constructor(
    protected readonly source: RectanglePrimitive,
    protected readonly anchorIndex: 0 | 1,
  ) {}

  abstract update(): void;
  abstract text(): string;

  coordinate(): number {
    return this.position ?? -1;
  }

  visible(): boolean {
    return (
      this.source.selected &&
      this.source.renderOptions.showLabels &&
      this.anchor !== undefined
    );
  }

  tickVisible(): boolean {
    return this.visible();
  }

  textColor(): string {
    return this.source.renderOptions.labelTextColor;
  }

  backColor(): string {
    return this.source.renderOptions.labelColor;
  }

  protected get anchor(): AnchorPoint | undefined {
    return this.source.anchors[this.anchorIndex];
  }

  protected setPosition(position: Coordinate | null): void {
    this.position = position;
  }
}

class RectangleTimeAxisView extends RectangleAxisView {
  update(): void {
    const anchor = this.anchor;
    if (!anchor || !this.source.chart || !this.source.series) {
      this.setPosition(null);
      return;
    }
    this.setPosition(anchorToCoordinate(this.source.chart, this.source.series, anchor));
  }

  text(): string {
    const anchor = this.anchor;
    return anchor
      ? this.source.renderOptions.timeLabelFormatter(anchor.time as Time)
      : "";
  }
}

class RectanglePriceAxisView extends RectangleAxisView {
  update(): void {
    const anchor = this.anchor;
    if (!anchor || !this.source.series) {
      this.setPosition(null);
      return;
    }
    this.setPosition(this.source.series.priceToCoordinate(anchor.price));
  }

  text(): string {
    const anchor = this.anchor;
    return anchor ? this.source.renderOptions.priceLabelFormatter(anchor.price) : "";
  }
}

export class RectanglePrimitive implements ISeriesPrimitive<Time>, IDrawing {
  readonly tool = "rectangle" as const;
  readonly renderOptions: RectangleRenderOptions;
  private anchorsInternal: AnchorPoint[];
  private readonly paneViewsInternal: readonly UpdatablePaneView[];
  private readonly timeAxisViewsInternal: readonly UpdatableAxisView[];
  private readonly priceAxisViewsInternal: readonly UpdatableAxisView[];
  private readonly priceAxisPaneViewsInternal: readonly UpdatablePaneView[];
  private readonly timeAxisPaneViewsInternal: readonly UpdatablePaneView[];
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
    this.paneViewsInternal = [new RectanglePaneView(this)];
    this.timeAxisViewsInternal = [
      new RectangleTimeAxisView(this, 0),
      new RectangleTimeAxisView(this, 1),
    ];
    this.priceAxisViewsInternal = [
      new RectanglePriceAxisView(this, 0),
      new RectanglePriceAxisView(this, 1),
    ];
    this.priceAxisPaneViewsInternal = [new RectanglePriceAxisPaneView(this, true)];
    this.timeAxisPaneViewsInternal = [new RectangleTimeAxisPaneView(this, false)];
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
    this.paneViewsInternal.forEach((view) => view.update());
    this.timeAxisViewsInternal.forEach((view) => view.update());
    this.priceAxisViewsInternal.forEach((view) => view.update());
    this.priceAxisPaneViewsInternal.forEach((view) => view.update());
    this.timeAxisPaneViewsInternal.forEach((view) => view.update());
  }

  priceAxisViews(): readonly ISeriesPrimitiveAxisView[] {
    return this.priceAxisViewsInternal;
  }

  timeAxisViews(): readonly ISeriesPrimitiveAxisView[] {
    return this.timeAxisViewsInternal;
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this.paneViewsInternal;
  }

  priceAxisPaneViews(): readonly IPrimitivePaneView[] {
    return this.priceAxisPaneViewsInternal;
  }

  timeAxisPaneViews(): readonly IPrimitivePaneView[] {
    return this.timeAxisPaneViewsInternal;
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
