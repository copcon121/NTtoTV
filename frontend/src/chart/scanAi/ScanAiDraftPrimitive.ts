import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  Coordinate,
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  PrimitiveHoveredItem,
  PrimitivePaneViewZOrder,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";
import type { ScanAiSuggestion } from "./types";
import { prepareSuggestions } from "./geometry";

function distanceToSegment(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

interface ViewPoint {
  x: Coordinate;
  y: Coordinate;
}

interface ViewItem {
  suggestion: ScanAiSuggestion;
  focused: boolean;
  tool: string;
  points: ViewPoint[];
  color: string;
  fillColor?: string;
  targetY?: Coordinate;
  stopY?: Coordinate;
  fibLevels?: { level: number; y: Coordinate; price: number; color?: string }[];
}

class ScanAiDraftRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly items: readonly ViewItem[],
    private readonly showTargets: boolean,
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const hpr = scope.horizontalPixelRatio;
      const vpr = scope.verticalPixelRatio;
      const width = scope.bitmapSize.width;

      ctx.save();

      // Render non-focused first, then focused on top
      const sorted = [...this.items].sort((a, b) => {
        if (a.focused === b.focused) return 0;
        return a.focused ? 1 : -1;
      });

      for (const item of sorted) {
        const { suggestion, focused, tool, points, color } = item;
        const mainColor = focused ? "#35d6b0" : color;
        const lineWidth = focused ? Math.round(2.5 * vpr) : Math.round(1.5 * vpr);
        ctx.globalAlpha = focused ? 1.0 : 0.65;
        ctx.strokeStyle = mainColor;
        ctx.fillStyle = mainColor;
        ctx.lineWidth = lineWidth;

        // 1. HORIZONTAL RAY / LEVELS
        if (tool === "horizontal_ray" && points.length >= 1) {
          const pt = points[0];
          const pxY = Math.round(pt.y * vpr);
          const pxX = Math.max(0, Math.round(pt.x * hpr));

          ctx.setLineDash(focused ? [] : [6 * hpr, 4 * hpr]);
          ctx.beginPath();
          ctx.moveTo(pxX, pxY);
          ctx.lineTo(width, pxY);
          ctx.stroke();

          // Pill Label
          ctx.setLineDash([]);
          const anchorPrice = suggestion.anchors[0]?.price !== undefined ? suggestion.anchors[0].price.toFixed(1) : "";
          const itemLabel = suggestion.label ?? suggestion.name ?? suggestion.type ?? "";
          const labelText = anchorPrice ? `${itemLabel} ${anchorPrice}` : itemLabel;
          ctx.font = `${Math.round(10 * vpr)}px sans-serif`;
          const textWidth = ctx.measureText(labelText).width;
          const badgeX = Math.min(width - textWidth - 16 * hpr, pxX + 10 * hpr);
          const badgeY = pxY - 14 * vpr;

          ctx.fillStyle = focused ? "rgba(53, 214, 176, 0.9)" : "rgba(17, 26, 35, 0.85)";
          ctx.fillRect(badgeX - 4 * hpr, badgeY, textWidth + 8 * hpr, 13 * vpr);
          ctx.fillStyle = focused ? "#061b16" : mainColor;
          ctx.fillText(labelText, badgeX, badgeY + 10 * vpr);
        }

        // 2. TRENDLINE
        else if (tool === "trendline" && points.length >= 2) {
          const p1 = points[0];
          const p2 = points[1];
          const x1 = p1.x * hpr;
          const y1 = p1.y * vpr;
          const x2 = p2.x * hpr;
          const y2 = p2.y * vpr;


          ctx.setLineDash(focused ? [] : [6 * hpr, 4 * hpr]);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();

          // Anchor dots
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.arc(x1, y1, 3 * hpr, 0, Math.PI * 2);
          ctx.arc(x2, y2, 3 * hpr, 0, Math.PI * 2);
          ctx.fill();

          // Label
          ctx.font = `${Math.round(10 * vpr)}px sans-serif`;
          ctx.fillStyle = focused ? "#35d6b0" : mainColor;
          ctx.fillText(suggestion.label ?? suggestion.name ?? suggestion.type ?? "", x2 + 6 * hpr, y2);
        }

        // 3. FIBONACCI RETRACEMENT
        else if (tool === "fib_retracement" && points.length >= 2) {
          const p1 = points[0];
          const p2 = points[1];
          const x1 = Math.round(p1.x * hpr);
          const y1 = Math.round(p1.y * vpr);
          const x2 = Math.round(p2.x * hpr);
          const y2 = Math.round(p2.y * vpr);

          // Diagonal anchor trend line
          ctx.setLineDash([3 * hpr, 3 * hpr]);
          ctx.strokeStyle = "rgba(158, 172, 187, 0.6)";
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();

          // Fib horizontal levels
          if (item.fibLevels) {
            const startX = Math.min(x1, x2);
            for (const fl of item.fibLevels) {
              const ly = Math.round(fl.y * vpr);
              ctx.setLineDash(focused ? [4 * hpr, 2 * hpr] : [3 * hpr, 3 * hpr]);
              ctx.strokeStyle = fl.color ?? (focused ? "#35d6b0" : "rgba(56, 189, 248, 0.7)");
              ctx.beginPath();
              ctx.moveTo(startX, ly);
              ctx.lineTo(Math.max(x1, x2), ly);
              ctx.stroke();

              // Fib level label
              ctx.setLineDash([]);
              ctx.font = `${Math.round(9 * vpr)}px sans-serif`;
              ctx.fillStyle = fl.color ?? (focused ? "#35d6b0" : "rgba(56, 189, 248, 0.85)");
              ctx.fillText(`${fl.level} (${fl.price.toFixed(1)})`, startX + 4 * hpr, ly - 3 * vpr);
            }
          }
        }

        // 4. RECTANGLE
        else if (tool === "rectangle" && points.length >= 2) {
          const p1 = points[0];
          const p2 = points[1];
          const xLeft = Math.round(p1.x * hpr);
          const xRight = Math.min(width, Math.round(p2.x * hpr));
          const yTop = Math.min(p1.y, p2.y) * vpr;
          const yBottom = Math.max(p1.y, p2.y) * vpr;
          const boxWidth = Math.max(10, xRight - xLeft);
          const boxHeight = Math.max(2, yBottom - yTop);

          ctx.fillStyle = item.fillColor ?? (focused ? "rgba(53, 214, 176, 0.35)" : "rgba(34, 197, 94, 0.15)");
          ctx.fillRect(xLeft, yTop, boxWidth, boxHeight);

          ctx.setLineDash(focused ? [] : [4 * hpr, 3 * hpr]);
          ctx.strokeStyle = mainColor;
          ctx.strokeRect(xLeft, yTop, boxWidth, boxHeight);

          // Label inside box
          ctx.setLineDash([]);
          ctx.font = `${Math.round(9 * vpr)}px sans-serif`;
          ctx.fillStyle = focused ? "#35d6b0" : mainColor;
          ctx.fillText(suggestion.label ?? suggestion.name ?? suggestion.type ?? "", xLeft + 4 * hpr, yTop + 11 * vpr);
        }

        // 5. PATH (PATTERNS: DOUBLE TOP, HEAD & SHOULDERS, ELLIOTT WAVE)
        else if (tool === "path" && points.length >= 2) {
          ctx.setLineDash(focused ? [] : [4 * hpr, 3 * hpr]);
          ctx.beginPath();
          ctx.moveTo(points[0].x * hpr, points[0].y * vpr);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x * hpr, points[i].y * vpr);
          }
          ctx.stroke();

          // Anchor dots & wave/vertex labels
          ctx.setLineDash([]);
          const anchorLabels = (suggestion.options as any)?.anchorLabels as string[] | undefined;
          for (let i = 0; i < points.length; i++) {
            const pt = points[i];
            const px = pt.x * hpr;
            const py = pt.y * vpr;
            ctx.beginPath();
            ctx.arc(px, py, (focused ? 4 : 3) * hpr, 0, Math.PI * 2);
            ctx.fill();

            const waveLabel = anchorLabels?.[i];
            if (waveLabel) {
              const fontSize = Math.round(10 * vpr);
              ctx.font = `bold ${fontSize}px sans-serif`;
              const textW = ctx.measureText(waveLabel).width;
              const padX = 4 * hpr;
              const padY = 2 * vpr;
              const boxW = textW + padX * 2;
              const boxH = fontSize + padY * 2;
              const boxX = px - boxW / 2;
              const boxY = py - boxH - 6 * vpr;

              ctx.fillStyle = focused ? "rgba(53, 214, 176, 0.95)" : "rgba(16, 26, 35, 0.88)";
              ctx.beginPath();
              ctx.roundRect(boxX, boxY, boxW, boxH, 3 * hpr);
              ctx.fill();

              ctx.fillStyle = focused ? "#0b0f14" : (mainColor || "#38bdf8");
              ctx.fillText(waveLabel, boxX + padX, boxY + fontSize);
            }
          }

          ctx.font = `${Math.round(10 * vpr)}px sans-serif`;
          ctx.fillStyle = focused ? "#35d6b0" : mainColor;
          ctx.fillText(suggestion.label ?? suggestion.name ?? suggestion.type ?? "", points[0].x * hpr, points[0].y * vpr - (anchorLabels ? 22 : 6) * vpr);
        }

        // TARGETS & STOP LINES (if enabled & available)
        if (this.showTargets && focused && (item.targetY !== undefined || item.stopY !== undefined)) {
          const lastPt = points[points.length - 1];
          const startX = lastPt ? Math.round(lastPt.x * hpr) : 0;

          if (item.targetY !== undefined) {
            const ty = Math.round(item.targetY * vpr);
            ctx.setLineDash([4 * hpr, 4 * hpr]);
            ctx.strokeStyle = "#22c55e"; // green
            ctx.beginPath();
            ctx.moveTo(startX, ty);
            ctx.lineTo(width, ty);
            ctx.stroke();

            ctx.setLineDash([]);
            ctx.font = `${Math.round(9 * vpr)}px sans-serif`;
            ctx.fillStyle = "#22c55e";
            ctx.fillText(`TP: ${suggestion.target?.toFixed(1)}`, startX + 6 * hpr, ty - 3 * vpr);
          }

          if (item.stopY !== undefined) {
            const sy = Math.round(item.stopY * vpr);
            ctx.setLineDash([4 * hpr, 4 * hpr]);
            ctx.strokeStyle = "#ef4444"; // red
            ctx.beginPath();
            ctx.moveTo(startX, sy);
            ctx.lineTo(width, sy);
            ctx.stroke();

            ctx.setLineDash([]);
            ctx.font = `${Math.round(9 * vpr)}px sans-serif`;
            ctx.fillStyle = "#ef4444";
            ctx.fillText(`SL: ${suggestion.stop?.toFixed(1)}`, startX + 6 * hpr, sy - 3 * vpr);
          }
        }
      }

      ctx.restore();
    });
  }
}

class ScanAiDraftPaneView implements IPrimitivePaneView {
  views: ViewItem[] = [];

  constructor(private readonly source: ScanAiDraftPrimitive) {}

  update(): void {
    const chart = this.source.chart;
    const series = this.source.series;
    if (!chart || !series) {
      this.views = [];
      return;
    }

    const timeScale = chart.timeScale();
    const suggestions = this.source.suggestions;
    const focusedId = this.source.focusedId;
    const items: ViewItem[] = [];

    for (const sug of suggestions) {
      const focused = sug.id === focusedId;
      const points: ViewPoint[] = [];

      for (const a of sug.anchors) {
        const x = timeScale.timeToCoordinate(a.time as unknown as Time);
        const y = series.priceToCoordinate(a.price);
        if (x !== null && y !== null) {
          points.push({ x, y });
        }
      }

      if (points.length === 0) continue;

      let targetY: Coordinate | undefined;
      if (sug.target !== undefined && sug.target !== null) {
        const y = series.priceToCoordinate(sug.target);
        if (y !== null) targetY = y;
      }

      let stopY: Coordinate | undefined;
      if (sug.stop !== undefined && sug.stop !== null) {
        const y = series.priceToCoordinate(sug.stop);
        if (y !== null) stopY = y;
      }

      let fibLevels: ViewItem["fibLevels"];
      if (sug.drawingTool === "fib_retracement" && sug.anchors.length >= 2) {
        const p1 = sug.anchors[0].price;
        const p2 = sug.anchors[1].price;
        const diff = p2 - p1;
        const keyLevels = [0, 0.382, 0.5, 0.618, 1];
        fibLevels = [];
        for (const lvl of keyLevels) {
          const price = p1 + diff * lvl;
          const y = series.priceToCoordinate(price);
          if (y !== null) {
            fibLevels.push({
              level: lvl,
              y,
              price,
              color: lvl === 0.5 || lvl === 0.618 ? "#f59e0b" : undefined,
            });
          }
        }
      }

      items.push({
        suggestion: sug,
        focused,
        tool: sug.drawingTool,
        points,
        color:
          sug.options?.lineColor ??
          (sug.options as any)?.color ??
          (sug.group === "levels" ? "#22c55e" : "#38bdf8"),
        fillColor: sug.options?.fillColor ?? (sug.options as any)?.fill,
        targetY,
        stopY,
        fibLevels,
      });
    }

    this.views = items;
  }

  renderer(): IPrimitivePaneRenderer | null {
    return new ScanAiDraftRenderer(this.views, this.source.showTargets);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return "normal";
  }
}

export class ScanAiDraftPrimitive implements ISeriesPrimitive<Time> {
  private suggestionsInternal: ScanAiSuggestion[] = [];
  private focusedIdInternal: string | null = null;
  private showTargetsInternal: boolean = true;
  private readonly paneView: ScanAiDraftPaneView;
  private requestUpdateFn?: () => void;

  chart: IChartApiBase<Time> | undefined;
  series: ISeriesApi<"Candlestick", Time> | undefined;

  constructor() {
    this.paneView = new ScanAiDraftPaneView(this);
  }

  get suggestions(): readonly ScanAiSuggestion[] {
    return this.suggestionsInternal;
  }

  get focusedId(): string | null {
    return this.focusedIdInternal;
  }

  get showTargets(): boolean {
    return this.showTargetsInternal;
  }

  setSuggestions(
    suggestions: readonly ScanAiSuggestion[],
    focusedId: string | null = null,
    showTargets: boolean = true,
  ): void {
    this.suggestionsInternal = prepareSuggestions(suggestions);
    this.focusedIdInternal = focusedId;
    this.showTargetsInternal = showTargets;
    this.requestUpdate();
  }

  setFocusedId(focusedId: string | null): void {
    this.focusedIdInternal = focusedId;
    this.requestUpdate();
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    const res = this.hitTestSuggestion(x, y);
    if (!res) return null;
    return {
      externalId: res.suggestion.id,
      zOrder: "top",
    };
  }

  hitTestSuggestion(
    x: number,
    y: number,
    radius: number = 10,
  ): { suggestion: ScanAiSuggestion; point: { x: number; y: number } } | null {
    this.paneView.update();
    const views = this.paneView.views;
    if (!views || views.length === 0) return null;

    // Check focused item first if it hits, otherwise check in reverse order
    const sorted = [...views].sort((a, b) => (b.focused ? 1 : 0) - (a.focused ? 1 : 0));

    for (const item of sorted) {
      const { suggestion, tool, points } = item;
      if (points.length === 0) continue;

      if (tool === "horizontal_ray") {
        const pt = points[0];
        if (Math.abs(y - pt.y) <= radius && x >= pt.x - radius) {
          return {
            suggestion,
            point: { x: Math.max(pt.x + 30, x), y: pt.y },
          };
        }
      } else if (tool === "trendline" && points.length >= 2) {
        const p1 = points[0];
        const p2 = points[1];
        if (distanceToSegment({ x, y }, p1, p2) <= radius) {
          return {
            suggestion,
            point: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
          };
        }
      } else if (tool === "fib_retracement" && points.length >= 2) {
        const p1 = points[0];
        const p2 = points[1];
        if (distanceToSegment({ x, y }, p1, p2) <= radius) {
          return {
            suggestion,
            point: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
          };
        }
        if (item.fibLevels) {
          const startX = Math.min(p1.x, p2.x);
          for (const fl of item.fibLevels) {
            if (Math.abs(y - fl.y) <= radius && x >= startX - radius && x <= Math.max(p1.x, p2.x) + radius) {
              return {
                suggestion,
                point: { x: startX + 40, y: fl.y },
              };
            }
          }
        }
      } else if (tool === "rectangle" && points.length >= 2) {
        const p1 = points[0];
        const p2 = points[1];
        const xLeft = Math.min(p1.x, p2.x);
        const xRight = Math.max(p1.x, p2.x);
        const yTop = Math.min(p1.y, p2.y);
        const yBottom = Math.max(p1.y, p2.y);
        if (
          x >= xLeft - radius &&
          x <= xRight + radius &&
          y >= yTop - radius &&
          y <= yBottom + radius
        ) {
          return {
            suggestion,
            point: { x: xLeft + 25, y: yTop },
          };
        }
      } else if (tool === "path" && points.length >= 2) {
        for (let j = 0; j < points.length - 1; j++) {
          const pA = points[j];
          const pB = points[j + 1];
          if (distanceToSegment({ x, y }, pA, pB) <= radius) {
            const minX = Math.min(pA.x, pB.x);
            const maxX = Math.max(pA.x, pB.x);
            const midX = Math.max(minX + 15, Math.min(maxX - 15, x));
            const t = maxX - minX > 0 ? (midX - pA.x) / (pB.x - pA.x) : 0.5;
            const midY = pA.y + Math.max(0, Math.min(1, t)) * (pB.y - pA.y);
            return {
              suggestion,
              point: { x: midX, y: midY },
            };
          }
        }
      }
    }

    return null;
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
