/**
 * Vertical Line drawing adapted from TradingView's official v5 plugin example:
 * https://github.com/tradingview/lightweight-charts/blob/master/plugin-examples/src/plugins/vertical-line/vertical-line.ts
 */

import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  Coordinate,
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  ISeriesPrimitiveAxisView,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";

import { anchorToCoordinate } from "./coordinates";
import type { AnchorPoint, DrawingOptions, DrawingState, IDrawing } from "./types";

interface VerticalLineRenderOptions {
  color: string;
  labelText: string;
  width: number;
  labelBackgroundColor: string;
  labelTextColor: string;
  showLabel: boolean;
}

const DEFAULT_OPTIONS: VerticalLineRenderOptions = {
  color: "#26a69a",
  labelText: "",
  width: 2,
  labelBackgroundColor: "#26a69a",
  labelTextColor: "#ffffff",
  showLabel: false,
};

function toRenderOptions(options?: DrawingOptions): VerticalLineRenderOptions {
  return {
    ...DEFAULT_OPTIONS,
    color: options?.lineColor ?? DEFAULT_OPTIONS.color,
    width: options?.lineWidth ?? DEFAULT_OPTIONS.width,
    showLabel: options?.showLabels ?? DEFAULT_OPTIONS.showLabel,
  };
}

function linePosition(x: Coordinate, pixelRatio: number, width: number) {
  const scaledWidth = Math.max(1, Math.round(width * pixelRatio));
  const coordinate = Math.round(x * pixelRatio);
  return {
    position: coordinate - Math.floor(scaledWidth / 2),
    length: scaledWidth,
  };
}

class VerticalLineRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly x: Coordinate | null,
    private readonly options: VerticalLineRenderOptions,
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      if (this.x === null) return;
      const position = linePosition(
        this.x,
        scope.horizontalPixelRatio,
        this.options.width,
      );
      const ctx = scope.context;
      ctx.fillStyle = this.options.color;
      ctx.fillRect(position.position, 0, position.length, scope.bitmapSize.height);
    });
  }
}

class VerticalLinePaneView implements IPrimitivePaneView {
  private x: Coordinate | null = null;

  constructor(private readonly source: VerticalLinePrimitive) {}

  update(): void {
    const anchor = this.source.anchors[0];
    if (!anchor || !this.source.chart || !this.source.series) {
      this.x = null;
      return;
    }
    this.x = anchorToCoordinate(this.source.chart, this.source.series, anchor);
  }

  renderer(): IPrimitivePaneRenderer {
    return new VerticalLineRenderer(this.x, this.source.renderOptions);
  }
}

class VerticalLineTimeAxisView implements ISeriesPrimitiveAxisView {
  private x: Coordinate | null = null;

  constructor(private readonly source: VerticalLinePrimitive) {}

  update(): void {
    const anchor = this.source.anchors[0];
    if (!anchor || !this.source.chart || !this.source.series) {
      this.x = null;
      return;
    }
    this.x = anchorToCoordinate(this.source.chart, this.source.series, anchor);
  }

  visible(): boolean {
    return this.source.selected && this.source.renderOptions.showLabel;
  }

  tickVisible(): boolean {
    return this.source.selected && this.source.renderOptions.showLabel;
  }

  coordinate(): number {
    return this.x ?? 0;
  }

  text(): string {
    return this.source.renderOptions.labelText;
  }

  textColor(): string {
    return this.source.renderOptions.labelTextColor;
  }

  backColor(): string {
    return this.source.renderOptions.labelBackgroundColor;
  }
}

export class VerticalLinePrimitive implements ISeriesPrimitive<Time>, IDrawing {
  readonly tool = "vertical_line" as const;
  readonly renderOptions: VerticalLineRenderOptions;
  private anchorsInternal: AnchorPoint[];
  private readonly paneView: VerticalLinePaneView;
  private readonly timeAxisView: VerticalLineTimeAxisView;
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
    this.paneView = new VerticalLinePaneView(this);
    this.timeAxisView = new VerticalLineTimeAxisView(this);
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
    this.timeAxisView.update();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView];
  }

  timeAxisViews(): readonly ISeriesPrimitiveAxisView[] {
    return [this.timeAxisView];
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
