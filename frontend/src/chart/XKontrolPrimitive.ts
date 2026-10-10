import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  Coordinate,
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  PrimitivePaneViewZOrder,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";

export interface RenderableXKontrolSignal {
  time: Time;
  price: number;
  code: -3 | -2 | -1 | 1 | 2 | 3;
}

interface ViewSignal {
  signal: RenderableXKontrolSignal;
  x: Coordinate;
  y: Coordinate;
}

const OFFERS_COLOR = "#008080";
const BIDS_COLOR = "#ff1493";
const RADIUS_BY_LEVEL: Readonly<Record<1 | 2 | 3, number>> = {
  1: 3,
  2: 5,
  3: 7,
};

class XKontrolRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly signals: readonly ViewSignal[]) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const radiusRatio = Math.max(
        scope.horizontalPixelRatio,
        scope.verticalPixelRatio,
      );

      ctx.save();
      for (const view of this.signals) {
        const level = Math.abs(view.signal.code) as 1 | 2 | 3;
        const x = Math.round(view.x * scope.horizontalPixelRatio);
        const y = Math.round(view.y * scope.verticalPixelRatio);
        const radius = Math.max(
          2,
          Math.round(RADIUS_BY_LEVEL[level] * radiusRatio),
        );
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = view.signal.code > 0 ? OFFERS_COLOR : BIDS_COLOR;
        ctx.fill();
      }
      ctx.restore();
    });
  }
}

class XKontrolPaneView implements IPrimitivePaneView {
  private signals: ViewSignal[] = [];

  constructor(private readonly source: XKontrolPrimitive) {}

  update(): void {
    const { chart, series } = this.source;
    if (!chart || !series || !this.source.visible) {
      this.signals = [];
      return;
    }

    const visibleRange = chart.timeScale().getVisibleRange();
    const signals: ViewSignal[] = [];
    for (const signal of this.source.signals) {
      if (
        visibleRange !== null &&
        typeof signal.time === "number" &&
        typeof visibleRange.from === "number" &&
        typeof visibleRange.to === "number" &&
        (signal.time < visibleRange.from || signal.time > visibleRange.to)
      ) {
        continue;
      }
      const x = chart.timeScale().timeToCoordinate(signal.time);
      const y = series.priceToCoordinate(signal.price);
      if (x === null || y === null) continue;
      signals.push({ signal, x, y });
    }
    this.signals = signals;
  }

  renderer(): IPrimitivePaneRenderer {
    return new XKontrolRenderer(this.signals);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return "top";
  }
}

export class XKontrolPrimitive implements ISeriesPrimitive<Time> {
  private signalsInternal: RenderableXKontrolSignal[] = [];
  private visibleInternal = false;
  private readonly paneView = new XKontrolPaneView(this);
  private requestUpdateFn?: () => void;

  chart: IChartApiBase<Time> | undefined;
  series: ISeriesApi<"Candlestick", Time> | undefined;

  get signals(): readonly RenderableXKontrolSignal[] {
    return this.signalsInternal;
  }

  get visible(): boolean {
    return this.visibleInternal;
  }

  setSignals(signals: readonly RenderableXKontrolSignal[]): void {
    this.signalsInternal = signals.map((signal) => ({ ...signal }));
    this.requestUpdateFn?.();
  }

  setVisible(visible: boolean): void {
    if (this.visibleInternal === visible) return;
    this.visibleInternal = visible;
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
