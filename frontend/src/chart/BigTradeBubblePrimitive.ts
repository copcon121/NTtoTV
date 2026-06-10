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

import type { Side } from "../socket/messages";

export interface RenderableBigTradeBubble {
  id: string;
  time: Time;
  price: number;
  volume: number;
  side: Side;
  radius: number;
  fill: string;
  stroke: string;
}

interface ViewBubble {
  marker: RenderableBigTradeBubble;
  x: Coordinate;
  y: Coordinate;
}

const POC_LINE_COLOR = "rgba(245, 170, 36, 0.95)";
const TEXT_COLOR = "#ffffff";

function scaled(value: number, ratio: number): number {
  return Math.round(value * ratio);
}

function volumeLabel(volume: number): string {
  return `${Math.round(volume)}`;
}

function textSizePx(
  ctx: CanvasRenderingContext2D,
  label: string,
  radius: number,
  pixelRatio: number,
): number {
  let size = Math.round(
    Math.max(10, Math.min(16, radius * (label.length >= 3 ? 0.58 : 0.68))) *
      pixelRatio,
  );
  const maxWidth = radius * 1.55 * pixelRatio;
  while (size > 8 * pixelRatio) {
    ctx.font = `400 ${size}px Arial, sans-serif`;
    if (ctx.measureText(label).width <= maxWidth) break;
    size -= pixelRatio;
  }
  return size;
}

class BigTradeBubbleRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly bubbles: readonly ViewBubble[]) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const pixelRatio = Math.max(scope.horizontalPixelRatio, scope.verticalPixelRatio);

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (const view of this.bubbles) {
        const marker = view.marker;
        const x = scaled(view.x, scope.horizontalPixelRatio);
        const y = scaled(view.y, scope.verticalPixelRatio);
        const radius = Math.max(5, scaled(marker.radius, pixelRatio));
        const lineHalf = Math.round(radius * 1.32);

        ctx.setLineDash([]);
        ctx.strokeStyle = POC_LINE_COLOR;
        ctx.lineWidth = Math.max(2, Math.round(2 * pixelRatio));
        ctx.beginPath();
        ctx.moveTo(x - lineHalf, y);
        ctx.lineTo(x + lineHalf, y);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = marker.fill;
        ctx.fill();
        ctx.lineWidth = Math.max(1, Math.round(1.25 * pixelRatio));
        ctx.strokeStyle = marker.stroke;
        ctx.stroke();

        const label = volumeLabel(marker.volume);
        const fontSize = textSizePx(ctx, label, marker.radius, pixelRatio);
        ctx.font = `400 ${fontSize}px Arial, sans-serif`;
        ctx.lineWidth = Math.max(2, Math.round(2 * pixelRatio));
        ctx.strokeStyle = "rgba(0, 0, 0, 0.32)";
        ctx.strokeText(label, x, y);
        ctx.fillStyle = TEXT_COLOR;
        ctx.fillText(label, x, y);
      }

      ctx.restore();
    });
  }
}

class BigTradeBubblePaneView implements IPrimitivePaneView {
  private bubbles: ViewBubble[] = [];

  constructor(private readonly source: BigTradeBubblePrimitive) {}

  update(): void {
    const { chart, series } = this.source;
    if (!chart || !series) {
      this.bubbles = [];
      return;
    }

    const next: ViewBubble[] = [];
    for (const marker of this.source.markers) {
      const x = chart.timeScale().timeToCoordinate(marker.time);
      const y = series.priceToCoordinate(marker.price);
      if (x === null || y === null) continue;
      next.push({ marker, x, y });
    }
    this.bubbles = next;
  }

  renderer(): IPrimitivePaneRenderer {
    return new BigTradeBubbleRenderer(this.bubbles);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return "top";
  }
}

export class BigTradeBubblePrimitive implements ISeriesPrimitive<Time> {
  private markersInternal: RenderableBigTradeBubble[];
  private readonly paneView: BigTradeBubblePaneView;
  private requestUpdateFn?: () => void;

  chart: IChartApiBase<Time> | undefined;
  series: ISeriesApi<"Candlestick", Time> | undefined;

  constructor(markers: readonly RenderableBigTradeBubble[] = []) {
    this.markersInternal = markers.map((marker) => ({ ...marker }));
    this.paneView = new BigTradeBubblePaneView(this);
  }

  get markers(): readonly RenderableBigTradeBubble[] {
    return this.markersInternal;
  }

  setMarkers(markers: readonly RenderableBigTradeBubble[]): void {
    this.markersInternal = markers.map((marker) => ({ ...marker }));
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
