import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  AutoscaleInfo,
  Coordinate,
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  Logical,
  PrimitivePaneViewZOrder,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";

export interface RenderableWaveDeltaMbox {
  id: string;
  startTime: Time;
  endTime: Time;
  value: number;
  direction: 1 | -1;
  fillColor: string;
  borderColor: string;
}

export interface WaveDeltaMboxPrimitiveOptions {
  topMargin: number;
  bottomMargin: number;
  visible?: boolean;
}

interface ViewWaveDeltaMbox {
  box: RenderableWaveDeltaMbox;
  x1: Coordinate;
  x2: Coordinate;
  yZero: Coordinate;
  yValue: Coordinate;
}

interface WaveDeltaMboxRenderData {
  boxes: readonly ViewWaveDeltaMbox[];
  zeroY: Coordinate | null;
  paneWidth: number;
}

const DEFAULT_OPTIONS: WaveDeltaMboxPrimitiveOptions = {
  topMargin: 0.72,
  bottomMargin: 0.04,
  visible: false,
};
const BAND_INSET_PX = 2;
const ZERO_LINE_COLOR = "rgba(128, 128, 128, 0.42)";

function scaled(value: number, ratio: number): number {
  return Math.round(value * ratio);
}

class WaveDeltaMboxRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly data: WaveDeltaMboxRenderData) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const hr = scope.horizontalPixelRatio;
      const vr = scope.verticalPixelRatio;

      ctx.save();
      if (this.data.zeroY !== null) {
        const y = scaled(this.data.zeroY as number, vr);
        ctx.strokeStyle = ZERO_LINE_COLOR;
        ctx.lineWidth = Math.max(1, Math.round(vr));
        ctx.setLineDash([Math.round(4 * hr), Math.round(3 * hr)]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(scaled(this.data.paneWidth, hr), y);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      for (const view of this.data.boxes) {
        const sameBar = Math.abs((view.x2 as number) - (view.x1 as number)) < 2;
        const leftCss = sameBar
          ? (view.x1 as number) - 3
          : Math.min(view.x1 as number, view.x2 as number);
        const rightCss = sameBar
          ? (view.x1 as number) + 3
          : Math.max(view.x1 as number, view.x2 as number);
        const topCss = Math.min(view.yZero as number, view.yValue as number);
        const bottomCss = Math.max(view.yZero as number, view.yValue as number);

        const left = scaled(leftCss, hr);
        const right = scaled(rightCss, hr);
        const top = scaled(topCss, vr);
        const bottom = scaled(bottomCss, vr);
        const width = Math.max(1, right - left);
        const height = Math.max(1, bottom - top);

        ctx.fillStyle = view.box.fillColor;
        ctx.fillRect(left, top, width, height);
        ctx.strokeStyle = view.box.borderColor;
        ctx.lineWidth = Math.max(1, Math.round(hr));
        ctx.strokeRect(left, top, width, height);
      }
      ctx.restore();
    });
  }
}

class WaveDeltaMboxPaneView implements IPrimitivePaneView {
  private viewBoxes: ViewWaveDeltaMbox[] = [];
  private zeroY: Coordinate | null = null;
  private paneWidth = 0;

  constructor(private readonly source: WaveDeltaMboxPrimitive) {}

  update(): void {
    const { chart, series } = this.source;
    if (!chart || !series || !this.source.visible) {
      this.viewBoxes = [];
      this.zeroY = null;
      this.paneWidth = 0;
      return;
    }

    const pane = chart.paneSize(0);
    this.paneWidth = pane.width;
    const bandTop = Math.max(
      0,
      Math.min(pane.height - 1, pane.height * this.source.options.topMargin),
    );
    const bandBottom = Math.max(
      bandTop + 1,
      Math.min(pane.height, pane.height * (1 - this.source.options.bottomMargin)),
    );
    const zeroY = bandTop + (bandBottom - bandTop) / 2;
    const halfBand = Math.max(1, (bandBottom - bandTop) / 2 - BAND_INSET_PX);

    const positioned: Array<{
      box: RenderableWaveDeltaMbox;
      x1: Coordinate;
      x2: Coordinate;
    }> = [];
    for (const box of this.source.boxes) {
      const x1 = chart.timeScale().timeToCoordinate(box.startTime);
      const x2 = chart.timeScale().timeToCoordinate(box.endTime);
      if (x1 === null || x2 === null) continue;
      if (Math.max(x1 as number, x2 as number) < -10) continue;
      if (Math.min(x1 as number, x2 as number) > pane.width + 10) continue;
      positioned.push({ box, x1, x2 });
    }
    const maxAbs = Math.max(1, ...positioned.map((item) => Math.abs(item.box.value)));
    this.zeroY = zeroY as Coordinate;
    this.viewBoxes = positioned.map(({ box, x1, x2 }) => ({
      box,
      x1,
      x2,
      yZero: zeroY as Coordinate,
      yValue: (zeroY - (box.value / maxAbs) * halfBand) as Coordinate,
    }));
  }

  renderer(): IPrimitivePaneRenderer {
    return new WaveDeltaMboxRenderer({
      boxes: this.viewBoxes,
      zeroY: this.zeroY,
      paneWidth: this.paneWidth,
    });
  }

  zOrder(): PrimitivePaneViewZOrder {
    return "bottom";
  }
}

export class WaveDeltaMboxPrimitive implements ISeriesPrimitive<Time> {
  private boxesInternal: RenderableWaveDeltaMbox[];
  private readonly paneView: WaveDeltaMboxPaneView;
  private requestUpdateFn?: () => void;
  private readonly optionsInternal: WaveDeltaMboxPrimitiveOptions;
  private visibleInternal: boolean;

  chart: IChartApiBase<Time> | undefined;
  series: ISeriesApi<"Line", Time> | undefined;

  constructor(
    boxes: readonly RenderableWaveDeltaMbox[] = [],
    options: Partial<WaveDeltaMboxPrimitiveOptions> = {},
  ) {
    this.boxesInternal = boxes.map((box) => ({ ...box }));
    this.optionsInternal = { ...DEFAULT_OPTIONS, ...options };
    this.visibleInternal = this.optionsInternal.visible ?? false;
    this.paneView = new WaveDeltaMboxPaneView(this);
  }

  get boxes(): readonly RenderableWaveDeltaMbox[] {
    return this.boxesInternal;
  }

  get options(): WaveDeltaMboxPrimitiveOptions {
    return this.optionsInternal;
  }

  get visible(): boolean {
    return this.visibleInternal;
  }

  setBoxes(boxes: readonly RenderableWaveDeltaMbox[]): void {
    this.boxesInternal = boxes.map((box) => ({ ...box }));
    this.requestUpdate();
  }

  setVisible(visible: boolean): void {
    if (visible === this.visibleInternal) return;
    this.visibleInternal = visible;
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

  autoscaleInfo(startTimePoint: Logical, endTimePoint: Logical): AutoscaleInfo | null {
    const visible = this.boxesInternal.filter((box) => {
      const start = this.logicalForTime(box.startTime);
      const end = this.logicalForTime(box.endTime);
      if (start === null || end === null) return false;
      return Math.max(start, end) >= startTimePoint && Math.min(start, end) <= endTimePoint;
    });
    if (visible.length === 0) return null;
    const maxAbs = Math.max(1, ...visible.map((box) => Math.abs(box.value)));
    return {
      priceRange: {
        minValue: -maxAbs,
        maxValue: maxAbs,
      },
    };
  }

  attached(params: SeriesAttachedParameter<Time, "Line">): void {
    this.chart = params.chart;
    this.series = params.series;
    this.requestUpdateFn = params.requestUpdate;
  }

  detached(): void {
    this.chart = undefined;
    this.series = undefined;
    this.requestUpdateFn = undefined;
  }

  private logicalForTime(time: Time): Logical | null {
    if (!this.chart) return null;
    const index = this.chart.timeScale().timeToIndex(time, true);
    return index === null ? null : (index as unknown as Logical);
  }
}
