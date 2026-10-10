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

export interface RenderableTduSignal {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  momentumDirection: number;
  momentumLevel: number;
  deltaDivergence: number;
}

interface ViewSignal {
  signal: RenderableTduSignal;
  x: Coordinate;
  openY: Coordinate;
  closeY: Coordinate;
  highY: Coordinate;
  lowY: Coordinate;
}

const BUY_COLORS = ["#87cefa", "#1e90ff", "#0000ff"];
const SELL_COLORS = ["#ffb6c1", "#ff00ff", "#800080"];

function px(value: number, ratio: number): number {
  return Math.round(value * ratio);
}

class TduSignalRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly signals: readonly ViewSignal[]) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const rx = scope.horizontalPixelRatio;
      const ry = scope.verticalPixelRatio;
      const xs = this.signals.map((item) => Number(item.x)).sort((a, b) => a - b);
      let spacing = 10;
      for (let index = 1; index < xs.length; index += 1) {
        const distance = xs[index] - xs[index - 1];
        if (distance > 0) spacing = Math.min(spacing, distance);
      }
      const halfWidth = Math.max(2, Math.min(8, spacing * 0.36));
      const triangleHeight = Math.max(3, Math.min(9, halfWidth * 1.35));

      ctx.save();
      for (const view of this.signals) {
        const signal = view.signal;
        const x = px(view.x, rx);
        const width = Math.max(2, px(halfWidth, rx));

        // The original default draws a translucent one-tick band at the high
        // for bearish divergence and at the low for bullish divergence.
        if (signal.deltaDivergence !== 0) {
          const y = px(
            signal.deltaDivergence > 0 ? view.lowY : view.highY,
            ry,
          );
          const bandHeight = Math.max(2, px(3, ry));
          ctx.fillStyle =
            signal.deltaDivergence > 0
              ? "rgba(0, 255, 0, 0.20)"
              : "rgba(255, 0, 0, 0.20)";
          ctx.fillRect(x - width, y - bandHeight / 2, width * 2, bandHeight);
        }

        const level = Math.max(0, Math.min(3, Math.trunc(signal.momentumLevel)));
        if (level === 0 || signal.momentumDirection === 0) continue;

        const isBuy = signal.momentumDirection > 0;
        const colors = isBuy ? BUY_COLORS : SELL_COLORS;
        const centerY = (Number(view.openY) + Number(view.closeY)) / 2;
        const step = triangleHeight * 2;
        const start = centerY + (isBuy ? 1 : -1) * ((level - 1) * step) / 2;

        for (let index = 0; index < level; index += 1) {
          const center = start + (isBuy ? -1 : 1) * index * step;
          const tip = center + (isBuy ? -triangleHeight : triangleHeight);
          const base = center + (isBuy ? triangleHeight : -triangleHeight);
          ctx.beginPath();
          ctx.moveTo(x, px(tip, ry));
          ctx.lineTo(x + width, px(base, ry));
          ctx.lineTo(x - width, px(base, ry));
          ctx.closePath();
          ctx.fillStyle = colors[index];
          ctx.fill();
        }
      }
      ctx.restore();
    });
  }
}

class TduSignalPaneView implements IPrimitivePaneView {
  private signals: ViewSignal[] = [];

  constructor(private readonly source: TduSignalPrimitive) {}

  update(): void {
    const { chart, series } = this.source;
    if (!chart || !series || !this.source.visible) {
      this.signals = [];
      return;
    }
    const visible = chart.timeScale().getVisibleRange();
    const next: ViewSignal[] = [];
    for (const signal of this.source.signals) {
      if (
        visible !== null &&
        typeof signal.time === "number" &&
        typeof visible.from === "number" &&
        typeof visible.to === "number" &&
        (signal.time < visible.from || signal.time > visible.to)
      ) {
        continue;
      }
      const x = chart.timeScale().timeToCoordinate(signal.time);
      const openY = series.priceToCoordinate(signal.open);
      const closeY = series.priceToCoordinate(signal.close);
      const highY = series.priceToCoordinate(signal.high);
      const lowY = series.priceToCoordinate(signal.low);
      if (x === null || openY === null || closeY === null || highY === null || lowY === null) {
        continue;
      }
      next.push({ signal, x, openY, closeY, highY, lowY });
    }
    this.signals = next;
  }

  renderer(): IPrimitivePaneRenderer {
    return new TduSignalRenderer(this.signals);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return "top";
  }
}

export class TduSignalPrimitive implements ISeriesPrimitive<Time> {
  private signalsInternal: RenderableTduSignal[] = [];
  private requestUpdateFn?: () => void;
  private readonly view = new TduSignalPaneView(this);

  chart: IChartApiBase<Time> | undefined;
  series: ISeriesApi<"Candlestick", Time> | undefined;
  visible = true;

  get signals(): readonly RenderableTduSignal[] {
    return this.signalsInternal;
  }

  setSignals(signals: readonly RenderableTduSignal[]): void {
    this.signalsInternal = signals.map((signal) => ({ ...signal }));
    this.requestUpdateFn?.();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.requestUpdateFn?.();
  }

  updateAllViews(): void {
    this.view.update();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.view];
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
