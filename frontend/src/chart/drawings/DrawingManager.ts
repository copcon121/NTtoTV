/**
 * DrawingManager — orchestrates drawing lifecycle and interactive placement.
 *
 * Manages creating drawing primitives, attaching them to the candlestick
 * series via the v5 `attachPrimitive` API, and handling interactive
 * click-to-place mouse interactions on the chart.
 */

import type { IChartApi, ISeriesApi, MouseEventParams } from "lightweight-charts";

import type {
  AnchorPoint,
  DrawingOptions,
  DrawingState,
  DrawingToolType,
  IDrawingManager,
} from "./types";
import { DRAWING_TOOLS } from "./types";
import { anchorFromPoint, anchorToPoint } from "./coordinates";
import { TrendLinePrimitive } from "./TrendLinePrimitive";
import { HorizontalRayPrimitive } from "./HorizontalRayPrimitive";
import { RectanglePrimitive } from "./RectanglePrimitive";
import { PriceRangePrimitive } from "./PriceRangePrimitive";
import { VerticalLinePrimitive } from "./VerticalLinePrimitive";

type DrawingPrimitive =
  | TrendLinePrimitive
  | HorizontalRayPrimitive
  | RectanglePrimitive
  | PriceRangePrimitive
  | VerticalLinePrimitive;

let nextId = 1;

function uid(): string {
  return `drawing-${nextId++}`;
}

function bumpNextId(id: string): void {
  const match = /^drawing-(\d+)$/.exec(id);
  if (!match) return;
  nextId = Math.max(nextId, Number(match[1]) + 1);
}

export class DrawingManager implements IDrawingManager {
  private _chart: IChartApi | undefined;
  private _series: ISeriesApi<"Candlestick"> | undefined;
  private _container: HTMLElement | undefined;

  /** All completed drawings, keyed by id. */
  private readonly _drawings = new Map<string, DrawingPrimitive>();

  /** In-progress interactive placement state. */
  private _placement: {
    tool: DrawingToolType;
    anchorsNeeded: number;
    anchors: AnchorPoint[];
    preview: DrawingPrimitive | null;
  } | null = null;

  /** Count-change subscribers. */
  private readonly _countListeners = new Set<(count: number) => void>();
  /** Full-state subscribers. */
  private readonly _stateListeners = new Set<(state: DrawingState[]) => void>();

  /** Bound event handlers for cleanup. */
  private _onClick: ((e: MouseEventParams) => void) | null = null;
  private _onMouseMove: ((e: MouseEventParams) => void) | null = null;
  private _onKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private _onPointerDown: ((e: PointerEvent) => void) | null = null;
  private _onPointerMove: ((e: PointerEvent) => void) | null = null;
  private _onPointerUp: ((e: PointerEvent) => void) | null = null;
  private _edit:
    | { drawingId: string; anchorIndex: number; pointerId: number }
    | null = null;
  private _editCursorActive = false;
  private _selectedDrawingId: string | null = null;

  get drawingCount(): number {
    return this._drawings.size;
  }

  attach(
    chart: IChartApi,
    series: ISeriesApi<"Candlestick">,
    container: HTMLElement,
  ): void {
    this._chart = chart;
    this._series = series;
    this._container = container;

    // Escape key cancels placement
    this._onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        this.cancelDrawing();
        this._selectDrawing(null);
        return;
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        this._selectedDrawingId !== null &&
        !this._isEditableTarget(e.target)
      ) {
        this.removeDrawing(this._selectedDrawingId);
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", this._onKeyDown);

    this._onPointerDown = (e: PointerEvent) => this._beginEdit(e);
    this._onPointerMove = (e: PointerEvent) => this._updateEdit(e);
    this._onPointerUp = (e: PointerEvent) => this._endEdit(e);
    container.addEventListener("pointerdown", this._onPointerDown);
    container.addEventListener("pointermove", this._onPointerMove);
    container.addEventListener("pointerup", this._onPointerUp);
    container.addEventListener("pointercancel", this._onPointerUp);
  }

  startDrawing(tool: DrawingToolType): void {
    // Cancel any in-progress drawing first
    this.cancelDrawing();
    this._selectDrawing(null);

    const def = DRAWING_TOOLS.find((t) => t.type === tool);
    if (!def || !this._chart || !this._series || !this._container) return;

    this._placement = {
      tool,
      anchorsNeeded: def.anchors,
      anchors: [],
      preview: null,
    };

    // Change cursor to crosshair
    this._container.style.cursor = "crosshair";

    // Disable chart scroll/scale during placement
    this._chart.applyOptions({
      handleScroll: false,
      handleScale: false,
    });

    // Subscribe to chart clicks for anchor placement
    this._onClick = (param: MouseEventParams) => {
      if (!this._placement || !this._series || !this._chart) return;
      if (param.paneIndex !== undefined && param.paneIndex !== 0) return;

      const anchor = this._anchorFromMouseParam(param);
      if (anchor === null) return;
      this._addAnchor(anchor, param.sourceEvent?.shiftKey === true);
    };
    this._chart.subscribeClick(this._onClick);

    // Mouse move for preview of the second anchor (for 2-anchor tools)
    if (def.anchors >= 2) {
      this._onMouseMove = (param: MouseEventParams) => {
        if (!this._placement || this._placement.anchors.length < 1) return;
        if (!this._series || !this._chart) return;
        if (
          param.point === undefined ||
          (param.paneIndex !== undefined && param.paneIndex !== 0)
        ) {
          return;
        }

        const rawPreviewAnchor = this._anchorFromMouseParam(param);
        if (rawPreviewAnchor === null) return;
        const previewAnchor = this._constrainPlacementAnchor(
          rawPreviewAnchor,
          param.sourceEvent?.shiftKey === true,
        );

        // Update or create preview
        if (this._placement.preview) {
          this._placement.preview.setAnchors([
            this._placement.anchors[0],
            previewAnchor,
          ]);
        } else {
          const preview = this._createPrimitive(
            this._placement.tool,
            `preview-${uid()}`,
            [this._placement.anchors[0], previewAnchor],
          );
          if (preview) {
            preview.setSelected(true);
            this._placement.preview = preview;
            this._series.attachPrimitive(preview as unknown as Parameters<typeof this._series.attachPrimitive>[0]);
          }
        }
      };
      this._chart.subscribeCrosshairMove(this._onMouseMove);
    }
  }

  cancelDrawing(): void {
    if (!this._placement) return;

    // Remove preview primitive
    if (this._placement.preview && this._series) {
      this._series.detachPrimitive(this._placement.preview as unknown as Parameters<typeof this._series.detachPrimitive>[0]);
    }

    this._placement = null;
    this._cleanupListeners();
    this._restoreChart();
  }

  removeDrawing(id: string): void {
    const drawing = this._drawings.get(id);
    if (!drawing || !this._series) return;
    if (this._selectedDrawingId === id) {
      this._selectDrawing(null);
    }
    this._series.detachPrimitive(drawing as unknown as Parameters<typeof this._series.detachPrimitive>[0]);
    this._drawings.delete(id);
    this._notifyCountChange();
    this._notifyStateChange();
  }

  removeAllDrawings(): void {
    this._clearDrawings(true);
  }

  exportState(): DrawingState[] {
    return [...this._drawings.values()].map((drawing) => drawing.toState());
  }

  loadState(states: readonly DrawingState[]): void {
    if (!this._series) return;
    this.cancelDrawing();
    this._clearDrawings(false);
    for (const state of states) {
      const drawing = this._createPrimitive(
        state.tool,
        state.id,
        state.anchors,
        state.options,
      );
      if (!drawing) continue;
      this._series.attachPrimitive(drawing as unknown as Parameters<typeof this._series.attachPrimitive>[0]);
      this._drawings.set(state.id, drawing);
      bumpNextId(state.id);
    }
    this._selectDrawing(null);
    this._notifyCountChange();
    this._notifyStateChange();
  }

  onCountChange(handler: (count: number) => void): () => void {
    this._countListeners.add(handler);
    return () => this._countListeners.delete(handler);
  }

  onStateChange(handler: (state: DrawingState[]) => void): () => void {
    this._stateListeners.add(handler);
    return () => this._stateListeners.delete(handler);
  }

  dispose(): void {
    this.cancelDrawing();
    this._clearDrawings(false);
    if (this._onKeyDown) {
      document.removeEventListener("keydown", this._onKeyDown);
      this._onKeyDown = null;
    }
    if (this._container && this._onPointerDown) {
      this._container.removeEventListener("pointerdown", this._onPointerDown);
      this._onPointerDown = null;
    }
    if (this._container && this._onPointerMove) {
      this._container.removeEventListener("pointermove", this._onPointerMove);
      this._onPointerMove = null;
    }
    if (this._container && this._onPointerUp) {
      this._container.removeEventListener("pointerup", this._onPointerUp);
      this._container.removeEventListener("pointercancel", this._onPointerUp);
      this._onPointerUp = null;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Private                                                             */
  /* ------------------------------------------------------------------ */

  private _addAnchor(anchor: AnchorPoint, shiftKey = false): void {
    if (!this._placement || !this._series) return;

    this._placement.anchors.push(this._constrainPlacementAnchor(anchor, shiftKey));

    // Check if all anchors are placed
    if (this._placement.anchors.length >= this._placement.anchorsNeeded) {
      this._finishPlacement();
    }
  }

  private _anchorFromMouseParam(param: MouseEventParams): AnchorPoint | null {
    if (!this._chart || !this._series || param.point === undefined) return null;
    if (!this._isInCandlePane(param.point.y)) return null;
    return anchorFromPoint(this._chart, this._series, {
      x: param.point.x,
      y: param.point.y,
    });
  }

  private _constrainPlacementAnchor(
    anchor: AnchorPoint,
    shiftKey: boolean,
  ): AnchorPoint {
    if (
      !shiftKey ||
      !this._placement ||
      this._placement.tool !== "trendline" ||
      this._placement.anchors.length < 1
    ) {
      return anchor;
    }
    return { ...anchor, price: this._placement.anchors[0].price };
  }

  private _anchorFromPointerEvent(e: PointerEvent): AnchorPoint | null {
    if (!this._chart || !this._series || !this._container) return null;
    const point = this._localPoint(e.clientX, e.clientY);
    if (point === null || !this._isInCandlePane(point.y)) return null;
    return anchorFromPoint(this._chart, this._series, point);
  }

  private _localPoint(clientX: number, clientY: number) {
    if (!this._container) return null;
    const rect = this._container.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  private _isInCandlePane(y: number): boolean {
    if (!this._chart) return false;
    return y >= 0 && y <= this._chart.paneSize(0).height;
  }

  private _beginEdit(e: PointerEvent): void {
    if (e.button !== 0 || this._placement !== null) return;
    const hit = this._hitAnchor(e.clientX, e.clientY);
    if (hit === null) {
      const drawingHit = this._hitDrawing(e.clientX, e.clientY);
      this._selectDrawing(drawingHit?.drawingId ?? null);
      if (drawingHit !== null) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }
    this._selectDrawing(hit.drawingId);
    this._edit = { ...hit, pointerId: e.pointerId };
    this._container?.setPointerCapture?.(e.pointerId);
    this._setScroll(false);
    if (this._container) this._container.style.cursor = "grabbing";
    e.preventDefault();
    e.stopPropagation();
  }

  private _updateEdit(e: PointerEvent): void {
    if (this._edit !== null) {
      const anchor = this._anchorFromPointerEvent(e);
      const drawing = this._drawings.get(this._edit.drawingId);
      if (anchor !== null && drawing) {
        const anchors = drawing.anchors.map((current) => ({ ...current }));
        anchors[this._edit.anchorIndex] = anchor;
        drawing.setAnchors(anchors);
      }
      e.preventDefault();
      return;
    }
    if (this._placement !== null) return;
    const hit = this._hitAnchor(e.clientX, e.clientY);
    if (hit !== null && this._container) {
      this._container.style.cursor = "grab";
      this._editCursorActive = true;
      return;
    }
    const drawingHit = this._hitDrawing(e.clientX, e.clientY);
    if (drawingHit !== null && this._container) {
      this._container.style.cursor = "pointer";
      this._editCursorActive = true;
    } else if (this._editCursorActive && this._container) {
      this._container.style.cursor = "";
      this._editCursorActive = false;
    }
  }

  private _endEdit(e: PointerEvent): void {
    if (this._edit === null || this._edit.pointerId !== e.pointerId) return;
    this._edit = null;
    this._container?.releasePointerCapture?.(e.pointerId);
    this._setScroll(true);
    if (this._container) this._container.style.cursor = "";
    this._editCursorActive = false;
    this._notifyStateChange();
  }

  private _hitAnchor(
    clientX: number,
    clientY: number,
  ): { drawingId: string; anchorIndex: number } | null {
    if (!this._chart || !this._series) return null;
    const point = this._localPoint(clientX, clientY);
    if (point === null || !this._isInCandlePane(point.y)) return null;
    if (this._selectedDrawingId === null) return null;
    const HIT_PX = 9;
    let best: { drawingId: string; anchorIndex: number; distance: number } | null = null;
    const selectedDrawing = this._drawings.get(this._selectedDrawingId);
    const drawings = selectedDrawing
      ? [[this._selectedDrawingId, selectedDrawing] as const]
      : [];
    for (const [drawingId, drawing] of drawings) {
      drawing.anchors.forEach((anchor, anchorIndex) => {
        const anchorPoint = anchorToPoint(this._chart!, this._series!, anchor);
        if (anchorPoint === null) return;
        if (
          drawing.tool === "vertical_line" &&
          Math.abs(anchorPoint.x - point.x) <= HIT_PX
        ) {
          const distance = Math.abs(anchorPoint.x - point.x);
          if (best === null || distance < best.distance) {
            best = { drawingId, anchorIndex, distance };
          }
          return;
        }
        const distance = Math.hypot(anchorPoint.x - point.x, anchorPoint.y - point.y);
        if (distance <= HIT_PX && (best === null || distance < best.distance)) {
          best = { drawingId, anchorIndex, distance };
        }
      });
    }
    if (best === null) return null;
    const { drawingId, anchorIndex } = best;
    return { drawingId, anchorIndex };
  }

  private _hitDrawing(clientX: number, clientY: number): { drawingId: string } | null {
    if (!this._chart || !this._series) return null;
    const point = this._localPoint(clientX, clientY);
    if (point === null || !this._isInCandlePane(point.y)) return null;
    const HIT_PX = 7;
    const drawings = [...this._drawings.entries()].reverse();
    for (const [drawingId, drawing] of drawings) {
      const points = drawing.anchors
        .map((anchor) => anchorToPoint(this._chart!, this._series!, anchor))
        .filter((p): p is { x: number; y: number } => p !== null);
      if (points.length === 0) continue;
      switch (drawing.tool) {
        case "trendline":
          if (points.length >= 2 && distanceToSegment(point, points[0], points[1]) <= HIT_PX) {
            return { drawingId };
          }
          break;
        case "horizontal_ray":
          if (points.length >= 1 && point.x >= points[0].x - HIT_PX && Math.abs(point.y - points[0].y) <= HIT_PX) {
            return { drawingId };
          }
          break;
        case "rectangle":
          if (points.length >= 2 && pointInBox(point, points[0], points[1], HIT_PX)) {
            return { drawingId };
          }
          break;
        case "price_range":
          if (points.length >= 2 && hitPriceRange(point, points[0], points[1], HIT_PX)) {
            return { drawingId };
          }
          break;
        case "vertical_line":
          if (points.length >= 1 && Math.abs(point.x - points[0].x) <= HIT_PX) {
            return { drawingId };
          }
          break;
        default:
          break;
      }
    }
    return null;
  }

  private _finishPlacement(): void {
    if (!this._placement || !this._series) return;

    // Remove preview if it exists
    if (this._placement.preview) {
      this._series.detachPrimitive(this._placement.preview as unknown as Parameters<typeof this._series.detachPrimitive>[0]);
    }

    // Create the final drawing
    const id = uid();
    const drawing = this._createPrimitive(
      this._placement.tool,
      id,
      this._placement.anchors,
    );

    if (drawing) {
      this._series.attachPrimitive(drawing as unknown as Parameters<typeof this._series.attachPrimitive>[0]);
      this._drawings.set(id, drawing);
      this._notifyCountChange();
      this._notifyStateChange();
    }

    this._placement = null;
    this._cleanupListeners();
    this._restoreChart();
    this._selectDrawing(null);
  }

  private _createPrimitive(
    tool: DrawingToolType,
    id: string,
    anchors: AnchorPoint[],
    options?: DrawingOptions,
  ): DrawingPrimitive | null {
    switch (tool) {
      case "trendline":
        return new TrendLinePrimitive(id, anchors, options);
      case "horizontal_ray":
        return new HorizontalRayPrimitive(id, anchors, options);
      case "rectangle":
        return new RectanglePrimitive(id, anchors, options);
      case "price_range":
        return new PriceRangePrimitive(id, anchors, options);
      case "vertical_line":
        return new VerticalLinePrimitive(id, anchors, options);
      default:
        return null;
    }
  }

  private _clearDrawings(notify: boolean): void {
    this._selectDrawing(null);
    if (this._series) {
      for (const drawing of this._drawings.values()) {
        this._series.detachPrimitive(drawing as unknown as Parameters<typeof this._series.detachPrimitive>[0]);
      }
    }
    this._drawings.clear();
    if (notify) {
      this._notifyCountChange();
      this._notifyStateChange();
    }
  }

  private _cleanupListeners(): void {
    if (this._onClick && this._chart) {
      this._chart.unsubscribeClick(this._onClick);
      this._onClick = null;
    }
    if (this._onMouseMove && this._chart) {
      this._chart.unsubscribeCrosshairMove(this._onMouseMove);
      this._onMouseMove = null;
    }
  }

  private _restoreChart(): void {
    if (this._container) {
      this._container.style.cursor = "";
    }
    this._setScroll(true);
  }

  private _setScroll(enabled: boolean): void {
    this._chart?.applyOptions({
      handleScroll: enabled,
      handleScale: enabled,
    });
  }

  private _selectDrawing(id: string | null): void {
    const previousId = this._selectedDrawingId;
    if (previousId !== null && previousId !== id) {
      this._drawings.get(previousId)?.setSelected(false);
    }
    this._selectedDrawingId = id;
    if (id !== null) {
      this._drawings.get(id)?.setSelected(true);
    }
  }

  private _notifyCountChange(): void {
    const count = this._drawings.size;
    for (const listener of this._countListeners) {
      listener(count);
    }
  }

  private _notifyStateChange(): void {
    const state = this.exportState();
    for (const listener of this._stateListeners) {
      listener(state);
    }
  }

  private _isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tagName = target.tagName.toLowerCase();
    return (
      tagName === "input" ||
      tagName === "textarea" ||
      tagName === "select" ||
      target.isContentEditable
    );
  }
}

function distanceToSegment(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq),
  );
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function pointInBox(
  point: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  tolerance: number,
): boolean {
  const left = Math.min(p1.x, p2.x) - tolerance;
  const right = Math.max(p1.x, p2.x) + tolerance;
  const top = Math.min(p1.y, p2.y) - tolerance;
  const bottom = Math.max(p1.y, p2.y) + tolerance;
  return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
}

function hitPriceRange(
  point: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  tolerance: number,
): boolean {
  const left = Math.min(p1.x, p2.x) - tolerance;
  const right = Math.max(p1.x, p2.x) + tolerance;
  if (point.x < left || point.x > right) return false;
  const topLine = Math.abs(point.y - p1.y) <= tolerance;
  const bottomLine = Math.abs(point.y - p2.y) <= tolerance;
  const middleX = (p1.x + p2.x) / 2;
  const vertical = Math.abs(point.x - middleX) <= tolerance && pointInBox(point, p1, p2, tolerance);
  return topLine || bottomLine || vertical;
}
