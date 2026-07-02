import type { CanvasRenderingTarget2D } from "fancy-canvas";
import {
  type Coordinate,
  type IChartApiBase,
  type IPrimitivePaneRenderer,
  type IPrimitivePaneView,
  type ISeriesApi,
  type ISeriesPrimitive,
  type PrimitivePaneViewZOrder,
  type SeriesAttachedParameter,
  type Time,
} from "lightweight-charts";

export interface RenderableDivergenceLine {
  id: string;
  startTime: Time;
  startValue: number;
  midTime: Time;
  midValue: number;
  endTime: Time;
  endValue: number;
  direction: 1 | -1;
  label?: string;
}

interface ViewDivergenceLine {
  line: RenderableDivergenceLine;
  x1: Coordinate;
  y1: Coordinate;
  x2: Coordinate;
  y2: Coordinate;
  x3: Coordinate;
  y3: Coordinate;
}

function colorFor(line: RenderableDivergenceLine): string {
  return line.direction === 1 ? "#2f7bff" : "#ff4d6d";
}

class DivergenceLineRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly lines: readonly ViewDivergenceLine[]) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      ctx.save();
      ctx.font = `${Math.max(10, Math.round(11 * scope.verticalPixelRatio))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (const view of this.lines) {
        const color = colorFor(view.line);
        const x1 = Math.round(view.x1 * scope.horizontalPixelRatio);
        const y1 = Math.round(view.y1 * scope.verticalPixelRatio);
        const x2 = Math.round(view.x2 * scope.horizontalPixelRatio);
        const y2 = Math.round(view.y2 * scope.verticalPixelRatio);
        const x3 = Math.round(view.x3 * scope.horizontalPixelRatio);
        const y3 = Math.round(view.y3 * scope.verticalPixelRatio);

        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(2, Math.round(2 * scope.verticalPixelRatio));
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.stroke();

        ctx.fillStyle = color;
        for (const [x, y] of [[x1, y1], [x2, y2], [x3, y3]] as const) {
          ctx.beginPath();
          ctx.arc(x, y, Math.max(2, 2.5 * scope.verticalPixelRatio), 0, Math.PI * 2);
          ctx.fill();
        }

        if (view.line.label) {
          const offset = (view.line.direction === 1 ? 12 : -12) * scope.verticalPixelRatio;
          ctx.fillText(view.line.label, x3, y3 + offset);
        }
      }

      ctx.restore();
    });
  }
}

class DivergenceLinePaneView implements IPrimitivePaneView {
  private viewLines: ViewDivergenceLine[] = [];

  constructor(private readonly source: DivergenceLinePrimitive) {}

  update(): void {
    const { chart, series } = this.source;
    if (!chart || !series) {
      this.viewLines = [];
      return;
    }

    const next: ViewDivergenceLine[] = [];
    for (const line of this.source.lines) {
      const x1 = chart.timeScale().timeToCoordinate(line.startTime);
      const x2 = chart.timeScale().timeToCoordinate(line.midTime);
      const x3 = chart.timeScale().timeToCoordinate(line.endTime);
      const y1 = series.priceToCoordinate(line.startValue);
      const y2 = series.priceToCoordinate(line.midValue);
      const y3 = series.priceToCoordinate(line.endValue);
      if (
        x1 === null ||
        x2 === null ||
        x3 === null ||
        y1 === null ||
        y2 === null ||
        y3 === null
      ) {
        continue;
      }
      next.push({ line, x1, x2, x3, y1, y2, y3 });
    }
    this.viewLines = next;
  }

  renderer(): IPrimitivePaneRenderer {
    return new DivergenceLineRenderer(this.viewLines);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return "top";
  }
}

export class DivergenceLinePrimitive implements ISeriesPrimitive<Time> {
  private linesInternal: RenderableDivergenceLine[];
  private readonly paneView: DivergenceLinePaneView;
  private requestUpdateFn?: () => void;

  chart: IChartApiBase<Time> | undefined;
  series:
    | ISeriesApi<"Candlestick", Time>
    | ISeriesApi<"Line", Time>
    | undefined;

  constructor(lines: readonly RenderableDivergenceLine[] = []) {
    this.linesInternal = lines.map((line) => ({ ...line }));
    this.paneView = new DivergenceLinePaneView(this);
  }

  get lines(): readonly RenderableDivergenceLine[] {
    return this.linesInternal;
  }

  setLines(lines: readonly RenderableDivergenceLine[]): void {
    this.linesInternal = lines.map((line) => ({ ...line }));
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

  attached(
    params:
      | SeriesAttachedParameter<Time, "Candlestick">
      | SeriesAttachedParameter<Time, "Line">,
  ): void {
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
