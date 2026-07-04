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
  DrawingLineStyle,
  DrawingState,
  DrawingToolType,
  FibRetracementLevel,
  IDrawingManager,
} from "./types";
import { DRAWING_TOOLS } from "./types";
import { anchorFromPoint, anchorToPoint } from "./coordinates";
import { TrendLinePrimitive } from "./TrendLinePrimitive";
import { BrushPrimitive } from "./BrushPrimitive";
import {
  DEFAULT_FIB_RETRACEMENT_LEVELS,
  FibRetracementPrimitive,
  fibLevelPrice,
  formatFibLevelValue,
  normalizeFibRetracementLevels,
} from "./FibRetracementPrimitive";
import { DateRangePrimitive, normalizeDateRangeAnchors } from "./DateRangePrimitive";
import { HorizontalRayPrimitive } from "./HorizontalRayPrimitive";
import { RectanglePrimitive } from "./RectanglePrimitive";
import { PriceRangePrimitive } from "./PriceRangePrimitive";
import { VerticalLinePrimitive } from "./VerticalLinePrimitive";
import { OrderBracketPrimitive } from "./OrderBracketPrimitive";
import { FixedRangeDeltaProfilePrimitive } from "./FixedRangeDeltaProfilePrimitive";
import type { DeltaProfileLoadState } from "../../orderflow/deltaProfile";

type DrawingPrimitive =
  | TrendLinePrimitive
  | BrushPrimitive
  | FibRetracementPrimitive
  | DateRangePrimitive
  | HorizontalRayPrimitive
  | RectanglePrimitive
  | FixedRangeDeltaProfilePrimitive
  | PriceRangePrimitive
  | VerticalLinePrimitive
  | OrderBracketPrimitive;

type DrawingSelectionActionToolType =
  | "trendline"
  | "brush"
  | "fib_retracement"
  | "date_range"
  | "horizontal_ray"
  | "rectangle";

type RectangleResizeHandle =
  | "top-left"
  | "top"
  | "top-right"
  | "right"
  | "bottom-right"
  | "bottom"
  | "bottom-left"
  | "left";

type RectangleSideIndices = {
  left: 0 | 1;
  right: 0 | 1;
  top: 0 | 1;
  bottom: 0 | 1;
};

type FixedRangeProfileResizeHandle =
  | "top-left"
  | "top-right"
  | "right"
  | "bottom-right"
  | "bottom-left"
  | "left";

type FixedRangeProfileSideIndices = {
  left: 0 | 1;
  right: 0 | 1;
  top: 0 | 1;
  bottom: 0 | 1;
};

type ChartPoint = { x: number; y: number };

type AnchorHit =
  | { drawingId: string; anchorIndex: number }
  | {
      drawingId: string;
      rectangleHandle: RectangleResizeHandle;
      rectangleSides: RectangleSideIndices;
    }
  | {
      drawingId: string;
      fixedRangeProfileHandle: FixedRangeProfileResizeHandle;
      fixedRangeProfileSides: FixedRangeProfileSideIndices;
    };

type DrawingEdit =
  | (AnchorHit & { pointerId: number })
  | {
      drawingId: string;
      moveDrawing: true;
      pointerId: number;
      startPoint: ChartPoint;
      anchors: AnchorPoint[];
    };

type DrawingPlacement = {
  tool: DrawingToolType;
  anchorsNeeded: number;
  anchors: AnchorPoint[];
  options?: DrawingOptions;
  preview: DrawingPrimitive | null;
  rawPreviewAnchor?: AnchorPoint;
  pointerId?: number;
  lastPoint?: ChartPoint;
};

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
  private _placement: DrawingPlacement | null = null;

  /** Count-change subscribers. */
  private readonly _countListeners = new Set<(count: number) => void>();
  /** Full-state subscribers. */
  private readonly _stateListeners = new Set<(state: DrawingState[]) => void>();

  /** Bound event handlers for cleanup. */
  private _onClick: ((e: MouseEventParams) => void) | null = null;
  private _onMouseMove: ((e: MouseEventParams) => void) | null = null;
  private _onKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private _onKeyUp: ((e: KeyboardEvent) => void) | null = null;
  private _onWindowBlur: (() => void) | null = null;
  private _onPointerDown: ((e: PointerEvent) => void) | null = null;
  private _onPointerMove: ((e: PointerEvent) => void) | null = null;
  private _onPointerUp: ((e: PointerEvent) => void) | null = null;
  private _onDoubleClick: ((e: MouseEvent) => void) | null = null;
  private _edit: DrawingEdit | null = null;
  private _editCursorActive = false;
  private _selectedDrawingId: string | null = null;
  private readonly _lockedDrawingIds = new Set<string>();
  private _actionsEl: HTMLDivElement | null = null;
  private _widthActionButton: HTMLButtonElement | null = null;
  private _styleActionButton: HTMLButtonElement | null = null;
  private _noteActionButton: HTMLButtonElement | null = null;
  private _lockActionButton: HTMLButtonElement | null = null;
  private _deleteActionButton: HTMLButtonElement | null = null;
  private _profileMenuEl: HTMLDivElement | null = null;
  private _fibMenuEl: HTMLDivElement | null = null;
  private _onProfileMenuPointerDown: ((e: Event) => void) | null = null;
  private _onProfileMenuClick: ((e: Event) => void) | null = null;
  private _onProfileMenuInput: ((e: Event) => void) | null = null;
  private _onDocumentPointerDown: ((e: PointerEvent) => void) | null = null;
  private _onFibMenuPointerDown: ((e: Event) => void) | null = null;
  private _onFibMenuClick: ((e: Event) => void) | null = null;
  private _onFibMenuInput: ((e: Event) => void) | null = null;
  private _onFibMenuChange: ((e: Event) => void) | null = null;
  private _onFibMenuKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private _onFibDocumentPointerDown: ((e: PointerEvent) => void) | null = null;
  private _onWindowResize: (() => void) | null = null;
  private _onActionPointerDown: ((e: Event) => void) | null = null;
  private _onWidthActionClick: ((e: Event) => void) | null = null;
  private _onStyleActionClick: ((e: Event) => void) | null = null;
  private _onNoteActionClick: ((e: Event) => void) | null = null;
  private _onLockActionClick: ((e: Event) => void) | null = null;
  private _onDeleteActionClick: ((e: Event) => void) | null = null;
  private _lastProfileTap:
    | { drawingId: string; time: number; x: number; y: number }
    | null = null;
  private _shiftKeyDown = false;

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
        return;
      }
      if (e.key === "Shift") {
        this._shiftKeyDown = true;
        this._updatePlacementPreviewForModifier();
      }
    };
    document.addEventListener("keydown", this._onKeyDown);
    this._onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== "Shift") return;
      this._shiftKeyDown = false;
      this._updatePlacementPreviewForModifier();
    };
    document.addEventListener("keyup", this._onKeyUp);
    this._onWindowBlur = () => {
      if (!this._shiftKeyDown) return;
      this._shiftKeyDown = false;
      this._updatePlacementPreviewForModifier();
    };
    window.addEventListener("blur", this._onWindowBlur);

    this._onPointerDown = (e: PointerEvent) => this._beginEdit(e);
    this._onPointerMove = (e: PointerEvent) => this._updateEdit(e);
    this._onPointerUp = (e: PointerEvent) => this._endEdit(e);
    container.addEventListener("pointerdown", this._onPointerDown);
    container.addEventListener("pointermove", this._onPointerMove);
    container.addEventListener("pointerup", this._onPointerUp);
    container.addEventListener("pointercancel", this._onPointerUp);
    this._onDoubleClick = (e: MouseEvent) => this._showDrawingSettingsFromMouse(e);
    container.addEventListener("dblclick", this._onDoubleClick);
    this._installSelectionActions(container);
    this._onWindowResize = () => this._updateSelectionActions();
    window.addEventListener("resize", this._onWindowResize);
  }

  startDrawing(tool: DrawingToolType, options?: DrawingOptions): void {
    // Cancel any in-progress drawing first
    this.cancelDrawing();
    this._selectDrawing(null);

    const def = DRAWING_TOOLS.find((t) => t.type === tool);
    if (!def || !this._chart || !this._series || !this._container) return;

    this._placement = {
      tool,
      anchorsNeeded: def.anchors,
      anchors: [],
      options,
      preview: null,
    };

    // Change cursor to crosshair
    this._container.style.cursor = "crosshair";

    // Disable chart scroll/scale during placement
    this._chart.applyOptions({
      handleScroll: false,
      handleScale: false,
    });

    if (tool === "brush") {
      return;
    }

    // Subscribe to chart clicks for anchor placement
    this._onClick = (param: MouseEventParams) => {
      if (!this._placement || !this._series || !this._chart) return;
      if (param.paneIndex !== undefined && param.paneIndex !== 0) return;

      const anchor = this._anchorFromMouseParam(param);
      if (anchor === null) return;
      this._addAnchor(anchor, this._isShiftConstraintActive(param.sourceEvent));
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
        this._placement.rawPreviewAnchor = rawPreviewAnchor;
        const previewAnchor = this._constrainPlacementAnchor(
          rawPreviewAnchor,
          this._isShiftConstraintActive(param.sourceEvent),
        );

        // Update or create preview
        const previewAnchors = [
          ...this._placement.anchors,
          previewAnchor,
        ];
        if (this._placement.preview) {
          this._placement.preview.setAnchors(previewAnchors);
        } else {
          const preview = this._createPrimitive(
            this._placement.tool,
            `preview-${uid()}`,
            previewAnchors,
            this._placement.options,
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
    this._lockedDrawingIds.delete(id);
    this._notifyCountChange();
    this._notifyStateChange();
  }

  removeAllDrawings(): void {
    this._clearDrawings(true);
  }

  setFixedRangeDeltaProfile(id: string, state: DeltaProfileLoadState): void {
    const drawing = this._drawings.get(id);
    if (drawing instanceof FixedRangeDeltaProfilePrimitive) {
      drawing.setProfileState(state);
      if (drawing.fitVerticalRangeToProfile()) {
        this._notifyStateChange();
        this._updateSelectionActions();
      }
    }
  }

  requestUpdateAll(): void {
    this._placement?.preview?.requestUpdate();
    for (const drawing of this._drawings.values()) {
      drawing.requestUpdate();
    }
    this._updateSelectionActions();
  }

  exportState(): DrawingState[] {
    return [...this._drawings.values()].map((drawing) => {
      const state = drawing.toState();
      return this._lockedDrawingIds.has(drawing.id)
        ? { ...state, locked: true }
        : state;
    });
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
      if (state.locked === true) {
        this._lockedDrawingIds.add(state.id);
      } else {
        this._lockedDrawingIds.delete(state.id);
      }
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
    if (this._onKeyUp) {
      document.removeEventListener("keyup", this._onKeyUp);
      this._onKeyUp = null;
    }
    if (this._onWindowBlur) {
      window.removeEventListener("blur", this._onWindowBlur);
      this._onWindowBlur = null;
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
    if (this._container && this._onDoubleClick) {
      this._container.removeEventListener("dblclick", this._onDoubleClick);
      this._onDoubleClick = null;
    }
    if (this._onWindowResize) {
      window.removeEventListener("resize", this._onWindowResize);
      this._onWindowResize = null;
    }
    this._uninstallSelectionActions();
    this._hideProfileContextMenu();
    this._hideFibContextMenu();
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
      this._placement?.tool === "date_range" &&
      this._placement.anchors.length >= 1
    ) {
      return { ...anchor, price: this._placement.anchors[0].price };
    }
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

  private _isShiftConstraintActive(sourceEvent?: { shiftKey?: boolean }): boolean {
    return this._shiftKeyDown || sourceEvent?.shiftKey === true;
  }

  private _updatePlacementPreviewForModifier(): void {
    const placement = this._placement;
    if (
      !placement ||
      placement.tool !== "trendline" ||
      placement.anchors.length < 1 ||
      !placement.rawPreviewAnchor ||
      !placement.preview
    ) {
      return;
    }
    placement.preview.setAnchors([
      ...placement.anchors,
      this._constrainPlacementAnchor(
        placement.rawPreviewAnchor,
        this._shiftKeyDown,
      ),
    ]);
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

  private _beginBrushPlacement(e: PointerEvent): void {
    if (
      e.button !== 0 ||
      !this._placement ||
      this._placement.tool !== "brush" ||
      this._placement.pointerId !== undefined ||
      !this._series
    ) {
      return;
    }
    const point = this._localPoint(e.clientX, e.clientY);
    const anchor = this._anchorFromPointerEvent(e);
    if (point === null || anchor === null) return;

    this._placement.pointerId = e.pointerId;
    this._placement.lastPoint = point;
    this._placement.anchors = [anchor];
    const preview = this._createPrimitive(
      "brush",
      `preview-${uid()}`,
      this._placement.anchors,
      this._placement.options,
    );
    if (preview) {
      preview.setSelected(true);
      this._placement.preview = preview;
      this._series.attachPrimitive(preview as unknown as Parameters<typeof this._series.attachPrimitive>[0]);
    }
    this._container?.setPointerCapture?.(e.pointerId);
    this._setScroll(false);
    e.preventDefault();
    e.stopPropagation();
  }

  private _updateBrushPlacement(e: PointerEvent): void {
    const placement = this._placement;
    if (
      !placement ||
      placement.tool !== "brush" ||
      placement.pointerId === undefined ||
      placement.pointerId !== e.pointerId
    ) {
      return;
    }
    const point = this._localPoint(e.clientX, e.clientY);
    const anchor = this._anchorFromPointerEvent(e);
    if (point === null || anchor === null) return;
    if (
      placement.lastPoint !== undefined &&
      Math.hypot(point.x - placement.lastPoint.x, point.y - placement.lastPoint.y) < 3
    ) {
      e.preventDefault();
      return;
    }
    placement.lastPoint = point;
    placement.anchors = [...placement.anchors, anchor];
    placement.preview?.setAnchors(placement.anchors);
    e.preventDefault();
    e.stopPropagation();
  }

  private _finishBrushPlacement(e: PointerEvent): void {
    const placement = this._placement;
    if (!placement || placement.tool !== "brush") return;
    if (
      placement.pointerId === undefined ||
      placement.pointerId !== e.pointerId
    ) {
      return;
    }

    this._container?.releasePointerCapture?.(e.pointerId);
    if (placement.preview && this._series) {
      this._series.detachPrimitive(placement.preview as unknown as Parameters<typeof this._series.detachPrimitive>[0]);
    }

    if (placement.anchors.length < 2) {
      placement.anchors = [];
      placement.preview = null;
      placement.pointerId = undefined;
      placement.lastPoint = undefined;
      if (this._container) {
        this._container.style.cursor = "crosshair";
      }
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (this._series) {
      const id = uid();
      const drawing = this._createPrimitive(
        "brush",
        id,
        placement.anchors,
        placement.options,
      );
      if (drawing) {
        this._series.attachPrimitive(drawing as unknown as Parameters<typeof this._series.attachPrimitive>[0]);
        this._drawings.set(id, drawing);
        this._notifyCountChange();
        this._notifyStateChange();
      }
    }

    this._placement = null;
    this._cleanupListeners();
    this._restoreChart();
    this._selectDrawing(null);
    e.preventDefault();
    e.stopPropagation();
  }

  private _beginEdit(e: PointerEvent): void {
    if (this._placement?.tool === "brush") {
      this._beginBrushPlacement(e);
      return;
    }
    if (e.button !== 0 || this._placement !== null || this._edit !== null) return;
    const hit = this._hitAnchor(e.clientX, e.clientY);
    if (hit === null) {
      const drawingHit = this._hitDrawing(e.clientX, e.clientY);
      this._selectDrawing(drawingHit?.drawingId ?? null);
      if (drawingHit !== null) {
        const point = this._localPoint(e.clientX, e.clientY);
        const drawing = this._drawings.get(drawingHit.drawingId);
        if (this._lockedDrawingIds.has(drawingHit.drawingId)) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (point !== null && drawing) {
          if (
            drawing.tool === "fixed_range_delta_profile" &&
            drawing.anchors.length >= 2 &&
            this._chart &&
            this._series
          ) {
            const p1 = anchorToPoint(this._chart, this._series, drawing.anchors[0]);
            const p2 = anchorToPoint(this._chart, this._series, drawing.anchors[1]);
            if (p1 !== null && p2 !== null) {
              const leftX = Math.min(p1.x, p2.x);
              const rightX = Math.max(p1.x, p2.x);
              const distToLeft = Math.abs(point.x - leftX);
              const distToRight = Math.abs(point.x - rightX);
              const handle: FixedRangeProfileResizeHandle = distToLeft <= distToRight ? "left" : "right";
              const sides = fixedRangeProfileSideIndices(p1, p2);
              this._edit = {
                drawingId: drawingHit.drawingId,
                fixedRangeProfileHandle: handle,
                fixedRangeProfileSides: sides,
                pointerId: e.pointerId,
              };
            }
          } else {
            this._edit = {
              drawingId: drawingHit.drawingId,
              moveDrawing: true,
              pointerId: e.pointerId,
              startPoint: point,
              anchors: drawing.anchors.map((anchor) => ({ ...anchor })),
            };
          }
          this._container?.setPointerCapture?.(e.pointerId);
          this._setScroll(false);
          if (this._container) {
            this._container.style.cursor =
              drawing.tool === "fixed_range_delta_profile" ? "ew-resize" : "grabbing";
          }
        }
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }
    this._selectDrawing(hit.drawingId);
    if (this._lockedDrawingIds.has(hit.drawingId)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    this._edit = { ...hit, pointerId: e.pointerId };
    this._container?.setPointerCapture?.(e.pointerId);
    this._setScroll(false);
    if (this._container) this._container.style.cursor = "grabbing";
    e.preventDefault();
    e.stopPropagation();
  }

  private _updateEdit(e: PointerEvent): void {
    if (this._placement?.tool === "brush") {
      this._updateBrushPlacement(e);
      return;
    }
    if (this._edit !== null) {
      const drawing = this._drawings.get(this._edit.drawingId);
      if ("moveDrawing" in this._edit) {
        const point = this._localPoint(e.clientX, e.clientY);
        if (point !== null && drawing && this._chart && this._series) {
          drawing.setAnchors(
            moveDrawingAnchors(
              this._chart,
              this._series,
              this._edit.anchors,
              this._edit.startPoint,
              point,
            ),
          );
          this._updateSelectionActions();
        }
      } else {
        const anchor = this._anchorFromPointerEvent(e);
        if (anchor !== null && drawing) {
          if ("rectangleHandle" in this._edit && drawing.tool === "rectangle") {
            drawing.setAnchors(
              resizeRectangleAnchors(
                drawing.anchors,
                this._edit.rectangleHandle,
                this._edit.rectangleSides,
                anchor,
              ),
            );
            this._updateSelectionActions();
          } else if (
            "fixedRangeProfileHandle" in this._edit &&
            drawing.tool === "fixed_range_delta_profile"
          ) {
            drawing.setAnchors(
              resizeFixedRangeProfileAnchors(
                drawing.anchors,
                this._edit.fixedRangeProfileHandle,
                this._edit.fixedRangeProfileSides,
                anchor,
              ),
            );
            if (fixedRangeProfileHandleChangesPrice(this._edit.fixedRangeProfileHandle)) {
              drawing.setOptions({ fixedRangeProfileAutoFitVertical: false });
            }
            this._updateSelectionActions();
          } else if ("anchorIndex" in this._edit) {
            const anchors = drawing.anchors.map((current) => ({ ...current }));
            if (drawing.tool === "date_range") {
              const price = anchors[0]?.price ?? anchor.price;
              anchors[this._edit.anchorIndex] = {
                ...anchors[this._edit.anchorIndex],
                time: anchor.time,
                logical: anchor.logical,
                price,
              };
              drawing.setAnchors(normalizeDateRangeAnchors(anchors));
            } else {
              anchors[this._edit.anchorIndex] = anchor;
              drawing.setAnchors(anchors);
            }
            this._updateSelectionActions();
          }
        }
      }
      e.preventDefault();
      return;
    }
    if (this._placement !== null) return;
    const hit = this._hitAnchor(e.clientX, e.clientY);
    if (hit !== null && this._container) {
      this._container.style.cursor = "grab";
      this._editCursorActive = true;
      this._updateSelectionActions();
      return;
    }
    const drawingHit = this._hitDrawing(e.clientX, e.clientY);
    if (drawingHit !== null && this._container) {
      if (this._lockedDrawingIds.has(drawingHit.drawingId)) {
        this._container.style.cursor = "default";
      } else {
        const hitDrawing = this._drawings.get(drawingHit.drawingId);
        if (hitDrawing?.tool === "fixed_range_delta_profile") {
          this._container.style.cursor = "ew-resize";
        } else {
          this._container.style.cursor = "grab";
        }
      }
      this._editCursorActive = true;
    } else if (this._editCursorActive && this._container) {
      this._container.style.cursor = "";
      this._editCursorActive = false;
    }
    this._updateSelectionActions();
  }

  private _endEdit(e: PointerEvent): void {
    if (this._placement?.tool === "brush") {
      this._finishBrushPlacement(e);
      return;
    }
    if (this._edit === null || this._edit.pointerId !== e.pointerId) {
      this._handleProfileTap(e);
      return;
    }
    this._edit = null;
    this._container?.releasePointerCapture?.(e.pointerId);
    this._setScroll(true);
    if (this._container) this._container.style.cursor = "";
    this._editCursorActive = false;
    this._updateSelectionActions();
    this._notifyStateChange();
  }

  private _hitAnchor(
    clientX: number,
    clientY: number,
  ): AnchorHit | null {
    if (!this._chart || !this._series) return null;
    const point = this._localPoint(clientX, clientY);
    if (point === null || !this._isInCandlePane(point.y)) return null;
    if (this._selectedDrawingId === null) return null;
    const HIT_PX = 9;
    const RECTANGLE_HIT_PX = 16;
    const FIXED_RANGE_PROFILE_HIT_PX = 18;
    let best: { drawingId: string; anchorIndex: number; distance: number } | null = null;
    const selectedDrawing = this._drawings.get(this._selectedDrawingId);
    if (selectedDrawing && this._lockedDrawingIds.has(this._selectedDrawingId)) {
      return null;
    }
    const drawings = selectedDrawing
      ? [[this._selectedDrawingId, selectedDrawing] as const]
      : [];
    for (const [drawingId, drawing] of drawings) {
      if (drawing.tool === "brush") {
        continue;
      }
      if (drawing.tool === "rectangle" && drawing.anchors.length >= 2) {
        const rectangleHit = rectangleHandleHit(
          this._chart,
          this._series,
          drawingId,
          drawing.anchors,
          point,
          RECTANGLE_HIT_PX,
        );
        if (rectangleHit !== null) return rectangleHit;
      }
      if (drawing.tool === "fixed_range_delta_profile" && drawing.anchors.length >= 2) {
        const profileHit = fixedRangeProfileHandleHit(
          this._chart,
          this._series,
          drawingId,
          drawing.anchors,
          point,
          FIXED_RANGE_PROFILE_HIT_PX,
        );
        if (profileHit !== null) return profileHit;
      }
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
      if (drawing.tool === "fixed_range_delta_profile" && drawing.anchors.length >= 2) {
        const rangeHit = fixedRangeProfileFrameHit(
          this._chart,
          this._series,
          drawing.anchors,
          point,
          HIT_PX,
        );
        if (rangeHit) return { drawingId };
        continue;
      }
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
        case "brush":
          if (hitPolyline(point, points, HIT_PX)) {
            return { drawingId };
          }
          break;
        case "fib_retracement":
          if (
            drawing instanceof FibRetracementPrimitive &&
            hitFibRetracement(this._chart, this._series, drawing, point, HIT_PX)
          ) {
            return { drawingId };
          }
          break;
        case "date_range":
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
          if (points.length >= 2 && rectangleFrameHit(point, points[0], points[1], HIT_PX)) {
            return { drawingId };
          }
          break;
        case "price_range":
          if (points.length >= 2 && hitPriceRange(point, points[0], points[1], HIT_PX)) {
            return { drawingId };
          }
          break;
        case "order_bracket":
          if (points.length >= 1 && hitOrderBracket(point, points, HIT_PX)) {
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
      this._placement.options,
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
      case "brush":
        return new BrushPrimitive(id, anchors, options);
      case "fib_retracement":
        return new FibRetracementPrimitive(id, anchors, options);
      case "date_range":
        return new DateRangePrimitive(id, anchors, options);
      case "horizontal_ray":
        return new HorizontalRayPrimitive(id, anchors, options);
      case "rectangle":
        return new RectanglePrimitive(id, anchors, options);
      case "fixed_range_delta_profile":
        return new FixedRangeDeltaProfilePrimitive(id, anchors, options);
      case "price_range":
        return new PriceRangePrimitive(id, anchors, options);
      case "vertical_line":
        return new VerticalLinePrimitive(id, anchors, options);
      case "order_bracket":
        return new OrderBracketPrimitive(id, anchors, options);
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
    this._lockedDrawingIds.clear();
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
    if (id !== this._selectedDrawingId) {
      this._hideProfileContextMenu();
      this._hideFibContextMenu();
    }
    const previousId = this._selectedDrawingId;
    if (previousId !== null && previousId !== id) {
      this._drawings.get(previousId)?.setSelected(false);
    }
    this._selectedDrawingId = id;
    if (id !== null) {
      this._drawings.get(id)?.setSelected(true);
    }
    this._updateSelectionActions();
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

  private _showDrawingSettingsFromMouse(e: MouseEvent): void {
    if (!this._chart || !this._series || !this._container) return;
    const point = this._localPoint(e.clientX, e.clientY);
    if (point === null || !this._isInCandlePane(point.y)) return;
    const profileHit = this._hitProfileBox(point);
    if (profileHit !== null) {
      e.preventDefault();
      e.stopPropagation();
      this._showProfileSettings(profileHit.drawingId, point);
      return;
    }
    const fibHit = this._hitFibRetracement(point);
    if (fibHit === null) return;
    e.preventDefault();
    e.stopPropagation();
    this._showFibSettings(fibHit.drawingId, point);
  }

  private _handleProfileTap(e: PointerEvent): void {
    if (!this._chart || !this._series || !this._container || this._placement) return;
    const point = this._localPoint(e.clientX, e.clientY);
    if (point === null || !this._isInCandlePane(point.y)) return;
    const hit = this._hitProfileBox(point);
    if (hit === null) {
      this._lastProfileTap = null;
      return;
    }
    const now = Date.now();
    const previous = this._lastProfileTap;
    this._lastProfileTap = {
      drawingId: hit.drawingId,
      time: now,
      x: point.x,
      y: point.y,
    };
    if (
      previous &&
      previous.drawingId === hit.drawingId &&
      now - previous.time <= 320 &&
      Math.hypot(point.x - previous.x, point.y - previous.y) <= 18
    ) {
      e.preventDefault();
      e.stopPropagation();
      this._showProfileSettings(hit.drawingId, point);
      this._lastProfileTap = null;
    }
  }

  private _showProfileSettings(drawingId: string, point: ChartPoint): void {
    if (!this._chart || !this._container) return;
    this._selectDrawing(drawingId);

    const drawing = this._drawings.get(drawingId);
    if (!(drawing instanceof FixedRangeDeltaProfilePrimitive)) return;

    this._hideProfileContextMenu();
    const menu = document.createElement("div");
    menu.className = "drawing-profile-context-menu";
    menu.setAttribute("role", "menu");
    menu.dataset.drawingId = drawingId;

    const modes: Array<{ mode: "volume" | "delta"; label: string }> = [
      { mode: "volume", label: "Volume" },
      { mode: "delta", label: "Delta" },
    ];
    for (const item of modes) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "drawing-profile-context-item";
      button.dataset.mode = item.mode;
      button.setAttribute("role", "menuitemradio");
      button.setAttribute(
        "aria-checked",
        drawing.profileMode === item.mode ? "true" : "false",
      );
      button.textContent = item.label;
      menu.appendChild(button);
    }
    const developingPocButton = document.createElement("button");
    developingPocButton.type = "button";
    developingPocButton.className = "drawing-profile-context-item";
    developingPocButton.dataset.developingPoc = "toggle";
    developingPocButton.setAttribute("role", "menuitemcheckbox");
    developingPocButton.setAttribute(
      "aria-checked",
      drawing.showDevelopingPoc ? "true" : "false",
    );
    developingPocButton.textContent = "Dev POC";
    menu.appendChild(developingPocButton);

    const extendButton = document.createElement("button");
    extendButton.type = "button";
    extendButton.className = "drawing-profile-context-item";
    extendButton.dataset.extendRight = "toggle";
    extendButton.setAttribute("role", "menuitemcheckbox");
    extendButton.setAttribute(
      "aria-checked",
      drawing.extendRight ? "true" : "false",
    );
    extendButton.textContent = "Extend Right";
    menu.appendChild(extendButton);

    menu.appendChild(
      this._createProfileOpacityControl(
        "VA Opacity",
        "valueAreaOpacity",
        drawing.valueAreaOpacity,
      ),
    );
    menu.appendChild(
      this._createProfileOpacityControl(
        "Outside VA",
        "outsideValueAreaOpacity",
        drawing.outsideValueAreaOpacity,
      ),
    );

    const paneSize = this._chart.paneSize(0);
    const menuWidth = 188;
    const menuHeight = 236;
    menu.style.left = `${clamp(point.x, 8, paneSize.width - menuWidth - 8)}px`;
    menu.style.top = `${clamp(point.y, 8, paneSize.height - menuHeight - 8)}px`;
    menu.style.maxHeight = `${Math.max(140, paneSize.height - 16)}px`;

    this._onProfileMenuPointerDown = (event: Event) => {
      if (event.target instanceof HTMLInputElement) {
        event.stopPropagation();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };
    this._onProfileMenuClick = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.dataset.extendRight === "toggle") {
        const selectedId = this._profileMenuEl?.dataset.drawingId;
        const selected = selectedId ? this._drawings.get(selectedId) : undefined;
        if (selected instanceof FixedRangeDeltaProfilePrimitive) {
          selected.setOptions({
            fixedRangeProfileExtendRight: !selected.extendRight,
          });
          this._notifyStateChange();
        }
        this._hideProfileContextMenu();
        return;
      }
      if (target.dataset.developingPoc === "toggle") {
        const selectedId = this._profileMenuEl?.dataset.drawingId;
        const selected = selectedId ? this._drawings.get(selectedId) : undefined;
        if (selected instanceof FixedRangeDeltaProfilePrimitive) {
          selected.setOptions({
            fixedRangeProfileDevelopingPoc: !selected.showDevelopingPoc,
          });
          this._notifyStateChange();
        }
        this._hideProfileContextMenu();
        return;
      }
      const mode = target.dataset.mode;
      if (mode !== "volume" && mode !== "delta") return;
      const selectedId = this._profileMenuEl?.dataset.drawingId;
      const selected = selectedId ? this._drawings.get(selectedId) : undefined;
      if (selected instanceof FixedRangeDeltaProfilePrimitive) {
        selected.setOptions({ fixedRangeProfileMode: mode });
        this._notifyStateChange();
      }
      this._hideProfileContextMenu();
    };
    this._onProfileMenuInput = (event: Event) => {
      event.stopPropagation();
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      const selectedId = this._profileMenuEl?.dataset.drawingId;
      const selected = selectedId ? this._drawings.get(selectedId) : undefined;
      if (!(selected instanceof FixedRangeDeltaProfilePrimitive)) return;
      const value = Number(target.value) / 100;
      if (target.dataset.opacity === "valueAreaOpacity") {
        selected.setOptions({ fixedRangeProfileValueAreaOpacity: value });
        this._syncProfileOpacityLabel(target);
        this._notifyStateChange();
      } else if (target.dataset.opacity === "outsideValueAreaOpacity") {
        selected.setOptions({ fixedRangeProfileOutsideValueAreaOpacity: value });
        this._syncProfileOpacityLabel(target);
        this._notifyStateChange();
      }
    };
    this._onDocumentPointerDown = (event: PointerEvent) => {
      if (
        this._profileMenuEl &&
        event.target instanceof Node &&
        this._profileMenuEl.contains(event.target)
      ) {
        return;
      }
      this._hideProfileContextMenu();
    };

    menu.addEventListener("pointerdown", this._onProfileMenuPointerDown);
    menu.addEventListener("mousedown", this._onProfileMenuPointerDown);
    menu.addEventListener("click", this._onProfileMenuClick);
    menu.addEventListener("input", this._onProfileMenuInput);
    document.addEventListener("pointerdown", this._onDocumentPointerDown, true);
    this._container.appendChild(menu);
    this._profileMenuEl = menu;
  }

  private _createProfileOpacityControl(
    label: string,
    key: "valueAreaOpacity" | "outsideValueAreaOpacity",
    value: number,
  ): HTMLElement {
    const wrapper = document.createElement("label");
    wrapper.className = "drawing-profile-context-slider";
    const header = document.createElement("span");
    header.className = "drawing-profile-context-slider-label";
    header.textContent = label;
    const valueEl = document.createElement("span");
    valueEl.className = "drawing-profile-context-slider-value";
    valueEl.textContent = `${Math.round(value * 100)}%`;
    const input = document.createElement("input");
    input.type = "range";
    input.min = "5";
    input.max = "100";
    input.step = "5";
    input.value = String(Math.round(value * 100));
    input.dataset.opacity = key;
    wrapper.appendChild(header);
    wrapper.appendChild(valueEl);
    wrapper.appendChild(input);
    return wrapper;
  }

  private _syncProfileOpacityLabel(input: HTMLInputElement): void {
    const valueEl = input.parentElement?.querySelector<HTMLElement>(
      ".drawing-profile-context-slider-value",
    );
    if (valueEl) valueEl.textContent = `${input.value}%`;
  }

  private _hideProfileContextMenu(): void {
    if (this._profileMenuEl && this._onProfileMenuPointerDown) {
      this._profileMenuEl.removeEventListener(
        "pointerdown",
        this._onProfileMenuPointerDown,
      );
      this._profileMenuEl.removeEventListener(
        "mousedown",
        this._onProfileMenuPointerDown,
      );
    }
    if (this._profileMenuEl && this._onProfileMenuClick) {
      this._profileMenuEl.removeEventListener("click", this._onProfileMenuClick);
    }
    if (this._profileMenuEl && this._onProfileMenuInput) {
      this._profileMenuEl.removeEventListener("input", this._onProfileMenuInput);
    }
    if (this._onDocumentPointerDown) {
      document.removeEventListener(
        "pointerdown",
        this._onDocumentPointerDown,
        true,
      );
    }
    this._profileMenuEl?.remove();
    this._profileMenuEl = null;
    this._onProfileMenuPointerDown = null;
    this._onProfileMenuClick = null;
    this._onProfileMenuInput = null;
    this._onDocumentPointerDown = null;
  }

  private _hitProfileBox(point: ChartPoint): { drawingId: string } | null {
    if (!this._chart || !this._series) return null;
    const drawings = [...this._drawings.entries()].reverse();
    for (const [drawingId, drawing] of drawings) {
      if (drawing.tool !== "fixed_range_delta_profile" || drawing.anchors.length < 2) {
        continue;
      }
      if (
        fixedRangeProfileBoxHit(
          this._chart,
          this._series,
          drawing.anchors,
          point,
          0,
        )
      ) {
        return { drawingId };
      }
    }
    return null;
  }

  private _hitFibRetracement(point: ChartPoint): { drawingId: string } | null {
    if (!this._chart || !this._series) return null;
    const drawings = [...this._drawings.entries()].reverse();
    for (const [drawingId, drawing] of drawings) {
      if (!(drawing instanceof FibRetracementPrimitive) || drawing.anchors.length < 2) {
        continue;
      }
      if (hitFibRetracement(this._chart, this._series, drawing, point, 7)) {
        return { drawingId };
      }
    }
    return null;
  }

  private _showFibSettings(drawingId: string, point: ChartPoint): void {
    if (!this._chart || !this._container) return;
    this._selectDrawing(drawingId);

    const drawing = this._drawings.get(drawingId);
    if (!(drawing instanceof FibRetracementPrimitive)) return;

    this._hideProfileContextMenu();
    this._hideFibContextMenu();
    const menu = document.createElement("div");
    menu.className = "drawing-fib-context-menu";
    menu.setAttribute("role", "dialog");
    menu.setAttribute("aria-label", "Fib retracement settings");
    menu.dataset.drawingId = drawingId;

    const header = document.createElement("div");
    header.className = "drawing-fib-context-title";
    header.textContent = "Fib retracement";
    menu.appendChild(header);

    const levels = normalizeFibRetracementLevels(drawing.fibLevels);
    levels.forEach((level, index) => {
      menu.appendChild(createFibLevelRow(index, level));
    });

    const paneSize = this._chart.paneSize(0);
    const menuWidth = 252;
    const menuHeight = 250;
    menu.style.left = `${clamp(point.x, 8, paneSize.width - menuWidth - 8)}px`;
    menu.style.top = `${clamp(point.y, 8, paneSize.height - menuHeight - 8)}px`;
    menu.style.maxHeight = `${Math.max(160, paneSize.height - 16)}px`;

    this._onFibMenuPointerDown = (event: Event) => {
      event.stopPropagation();
      if (!(event.target instanceof HTMLInputElement)) {
        event.preventDefault();
      }
    };
    this._onFibMenuClick = (event: Event) => {
      event.stopPropagation();
    };
    this._onFibMenuInput = (event: Event) => {
      event.stopPropagation();
      const target = event.target;
      if (target instanceof HTMLInputElement && target.type === "color") {
        this._applyFibSettingsFromMenu();
      }
    };
    this._onFibMenuChange = (event: Event) => {
      event.stopPropagation();
      this._applyFibSettingsFromMenu();
    };
    this._onFibMenuKeyDown = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        this._applyFibSettingsFromMenu();
        if (event.target instanceof HTMLElement) {
          event.target.blur();
        }
      } else if (event.key === "Escape") {
        event.preventDefault();
        this._hideFibContextMenu();
      }
    };
    this._onFibDocumentPointerDown = (event: PointerEvent) => {
      if (
        this._fibMenuEl &&
        event.target instanceof Node &&
        this._fibMenuEl.contains(event.target)
      ) {
        return;
      }
      this._hideFibContextMenu();
    };

    menu.addEventListener("pointerdown", this._onFibMenuPointerDown);
    menu.addEventListener("mousedown", this._onFibMenuPointerDown);
    menu.addEventListener("click", this._onFibMenuClick);
    menu.addEventListener("input", this._onFibMenuInput);
    menu.addEventListener("change", this._onFibMenuChange);
    menu.addEventListener("keydown", this._onFibMenuKeyDown);
    document.addEventListener("pointerdown", this._onFibDocumentPointerDown, true);
    this._container.appendChild(menu);
    this._fibMenuEl = menu;
  }

  private _toggleSelectedFibSettings(): void {
    const id = this._selectedDrawingId;
    if (id === null || !this._chart || !this._series) return;
    const drawing = this._drawings.get(id);
    if (!(drawing instanceof FibRetracementPrimitive)) return;
    if (this._fibMenuEl?.dataset.drawingId === id) {
      this._hideFibContextMenu();
      return;
    }
    const position = selectionActionPosition(this._chart, this._series, drawing);
    this._showFibSettings(id, position ?? { x: this._chart.paneSize(0).width / 2, y: 20 });
  }

  private _applyFibSettingsFromMenu(): void {
    const menu = this._fibMenuEl;
    const drawingId = menu?.dataset.drawingId;
    if (!menu || !drawingId) return;
    const drawing = this._drawings.get(drawingId);
    if (!(drawing instanceof FibRetracementPrimitive)) return;

    const current = normalizeFibRetracementLevels(drawing.fibLevels);
    const rows = Array.from(
      menu.querySelectorAll<HTMLElement>("[data-fib-level-row]"),
    );
    const next = rows.map((row, index): FibRetracementLevel => {
      const fallback =
        current[index] ??
        DEFAULT_FIB_RETRACEMENT_LEVELS[
          Math.min(index, DEFAULT_FIB_RETRACEMENT_LEVELS.length - 1)
        ];
      const enabledInput = row.querySelector<HTMLInputElement>(
        'input[data-fib-level-enabled="true"]',
      );
      const valueInput = row.querySelector<HTMLInputElement>(
        'input[data-fib-level-value="true"]',
      );
      const colorInput = row.querySelector<HTMLInputElement>(
        'input[data-fib-level-color="true"]',
      );
      const parsedValue = parseFibLevelValue(valueInput?.value);
      return {
        value: parsedValue ?? fallback.value,
        color: colorInput?.value || fallback.color,
        enabled: enabledInput?.checked !== false,
      };
    });

    drawing.setOptions({ fibLevels: next });
    this._syncFibMenuRows(drawing);
    this._updateSelectionActions();
    this._notifyStateChange();
  }

  private _syncFibMenuRows(drawing: FibRetracementPrimitive): void {
    if (!this._fibMenuEl) return;
    const levels = normalizeFibRetracementLevels(drawing.fibLevels);
    const rows = Array.from(
      this._fibMenuEl.querySelectorAll<HTMLElement>("[data-fib-level-row]"),
    );
    rows.forEach((row, index) => {
      const level = levels[index];
      if (!level) return;
      const enabledInput = row.querySelector<HTMLInputElement>(
        'input[data-fib-level-enabled="true"]',
      );
      const valueInput = row.querySelector<HTMLInputElement>(
        'input[data-fib-level-value="true"]',
      );
      const colorInput = row.querySelector<HTMLInputElement>(
        'input[data-fib-level-color="true"]',
      );
      if (enabledInput) enabledInput.checked = level.enabled !== false;
      if (valueInput && document.activeElement !== valueInput) {
        valueInput.value = formatFibLevelValue(level.value);
      }
      if (colorInput) colorInput.value = normalizeHexColor(level.color);
    });
  }

  private _hideFibContextMenu(): void {
    if (this._fibMenuEl && this._onFibMenuPointerDown) {
      this._fibMenuEl.removeEventListener("pointerdown", this._onFibMenuPointerDown);
      this._fibMenuEl.removeEventListener("mousedown", this._onFibMenuPointerDown);
    }
    if (this._fibMenuEl && this._onFibMenuClick) {
      this._fibMenuEl.removeEventListener("click", this._onFibMenuClick);
    }
    if (this._fibMenuEl && this._onFibMenuInput) {
      this._fibMenuEl.removeEventListener("input", this._onFibMenuInput);
    }
    if (this._fibMenuEl && this._onFibMenuChange) {
      this._fibMenuEl.removeEventListener("change", this._onFibMenuChange);
    }
    if (this._fibMenuEl && this._onFibMenuKeyDown) {
      this._fibMenuEl.removeEventListener("keydown", this._onFibMenuKeyDown);
    }
    if (this._onFibDocumentPointerDown) {
      document.removeEventListener(
        "pointerdown",
        this._onFibDocumentPointerDown,
        true,
      );
    }
    this._fibMenuEl?.remove();
    this._fibMenuEl = null;
    this._onFibMenuPointerDown = null;
    this._onFibMenuClick = null;
    this._onFibMenuInput = null;
    this._onFibMenuChange = null;
    this._onFibMenuKeyDown = null;
    this._onFibDocumentPointerDown = null;
  }

  private _installSelectionActions(container: HTMLElement): void {
    this._actionsEl = document.createElement("div");
    this._actionsEl.className = "drawing-selection-actions";
    this._actionsEl.hidden = true;
    this._actionsEl.setAttribute("aria-hidden", "true");

    this._widthActionButton = document.createElement("button");
    this._widthActionButton.type = "button";
    this._widthActionButton.className = "drawing-selection-action";

    this._styleActionButton = document.createElement("button");
    this._styleActionButton.type = "button";
    this._styleActionButton.className = "drawing-selection-action";

    this._noteActionButton = document.createElement("button");
    this._noteActionButton.type = "button";
    this._noteActionButton.className = "drawing-selection-action";

    this._lockActionButton = document.createElement("button");
    this._lockActionButton.type = "button";
    this._lockActionButton.className = "drawing-selection-action";

    this._deleteActionButton = document.createElement("button");
    this._deleteActionButton.type = "button";
    this._deleteActionButton.className = "drawing-selection-action";
    this._deleteActionButton.title = "Delete drawing";
    this._deleteActionButton.setAttribute("aria-label", "Delete drawing");
    this._deleteActionButton.innerHTML = deleteIconSvg();

    this._actionsEl.append(
      this._widthActionButton,
      this._styleActionButton,
      this._noteActionButton,
      this._lockActionButton,
      this._deleteActionButton,
    );
    container.appendChild(this._actionsEl);

    this._onActionPointerDown = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    this._onWidthActionClick = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      this._toggleSelectedLineWidth();
    };
    this._onStyleActionClick = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (this._selectedFibDrawing()) {
        this._toggleSelectedFibSettings();
        return;
      }
      this._toggleSelectedLineStyle();
    };
    this._onNoteActionClick = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      this._editSelectedLineNote();
    };
    this._onLockActionClick = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      this._toggleSelectedLock();
    };
    this._onDeleteActionClick = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (this._selectedDrawingId !== null) {
        this.removeDrawing(this._selectedDrawingId);
      }
    };

    this._actionsEl.addEventListener("pointerdown", this._onActionPointerDown);
    this._actionsEl.addEventListener("mousedown", this._onActionPointerDown);
    this._actionsEl.addEventListener("click", this._onActionPointerDown);
    this._widthActionButton.addEventListener("click", this._onWidthActionClick);
    this._styleActionButton.addEventListener("click", this._onStyleActionClick);
    this._noteActionButton.addEventListener("click", this._onNoteActionClick);
    this._lockActionButton.addEventListener("click", this._onLockActionClick);
    this._deleteActionButton.addEventListener("click", this._onDeleteActionClick);
    this._updateSelectionActions();
  }

  private _uninstallSelectionActions(): void {
    if (this._actionsEl && this._onActionPointerDown) {
      this._actionsEl.removeEventListener("pointerdown", this._onActionPointerDown);
      this._actionsEl.removeEventListener("mousedown", this._onActionPointerDown);
      this._actionsEl.removeEventListener("click", this._onActionPointerDown);
    }
    if (this._widthActionButton && this._onWidthActionClick) {
      this._widthActionButton.removeEventListener("click", this._onWidthActionClick);
    }
    if (this._styleActionButton && this._onStyleActionClick) {
      this._styleActionButton.removeEventListener("click", this._onStyleActionClick);
    }
    if (this._noteActionButton && this._onNoteActionClick) {
      this._noteActionButton.removeEventListener("click", this._onNoteActionClick);
    }
    if (this._lockActionButton && this._onLockActionClick) {
      this._lockActionButton.removeEventListener("click", this._onLockActionClick);
    }
    if (this._deleteActionButton && this._onDeleteActionClick) {
      this._deleteActionButton.removeEventListener("click", this._onDeleteActionClick);
    }
    this._actionsEl?.remove();
    this._actionsEl = null;
    this._widthActionButton = null;
    this._styleActionButton = null;
    this._noteActionButton = null;
    this._lockActionButton = null;
    this._deleteActionButton = null;
    this._onActionPointerDown = null;
    this._onWidthActionClick = null;
    this._onStyleActionClick = null;
    this._onNoteActionClick = null;
    this._onLockActionClick = null;
    this._onDeleteActionClick = null;
  }

  private _toggleSelectedLineWidth(): void {
    const drawing = this._selectedStyleDrawing();
    if (!drawing) return;
    const current = drawing.renderOptions.width;
    const lineWidth = current >= 3 ? 1 : 3;
    drawing.setOptions({ lineWidth });
    this._updateSelectionActions();
    this._notifyStateChange();
  }

  private _toggleSelectedLineStyle(): void {
    const drawing = this._selectedStyleDrawing();
    if (!drawing) return;
    const lineStyle: DrawingLineStyle =
      drawing.renderOptions.lineStyle === "dashed" ? "solid" : "dashed";
    drawing.setOptions({ lineStyle });
    this._updateSelectionActions();
    this._notifyStateChange();
  }

  private _editSelectedLineNote(): void {
    const drawing = this._selectedStyleDrawing();
    if (!drawing) return;
    const current = drawing.renderOptions.noteText;
    const result = window.prompt("Line note", current);
    if (result === null) return;
    const noteText = normalizeLineNote(result);
    drawing.setOptions({ noteText: noteText || undefined });
    this._updateSelectionActions();
    this._notifyStateChange();
  }

  private _selectedStyleDrawing():
    | TrendLinePrimitive
    | HorizontalRayPrimitive
    | null {
    const id = this._selectedDrawingId;
    if (id === null) return null;
    const drawing = this._drawings.get(id);
    return drawing instanceof TrendLinePrimitive ||
      drawing instanceof HorizontalRayPrimitive
      ? drawing
      : null;
  }

  private _selectedFibDrawing(): FibRetracementPrimitive | null {
    const id = this._selectedDrawingId;
    if (id === null) return null;
    const drawing = this._drawings.get(id);
    return drawing instanceof FibRetracementPrimitive ? drawing : null;
  }

  private _toggleSelectedLock(): void {
    const id = this._selectedDrawingId;
    if (id === null || !this._drawings.has(id)) return;
    if (this._lockedDrawingIds.has(id)) {
      this._lockedDrawingIds.delete(id);
    } else {
      this._lockedDrawingIds.add(id);
    }
    this._updateSelectionActions();
    this._notifyStateChange();
  }

  private _updateSelectionActions(): void {
    const el = this._actionsEl;
    const widthButton = this._widthActionButton;
    const styleButton = this._styleActionButton;
    const noteButton = this._noteActionButton;
    const lockButton = this._lockActionButton;
    if (!el || !widthButton || !styleButton || !noteButton || !lockButton) return;
    const id = this._selectedDrawingId;
    const drawing = id !== null ? this._drawings.get(id) : undefined;
    if (
      id === null ||
      !drawing ||
      !isActionTool(drawing.tool) ||
      !this._chart ||
      !this._series
    ) {
      el.hidden = true;
      el.setAttribute("aria-hidden", "true");
      return;
    }

    const position = selectionActionPosition(this._chart, this._series, drawing);
    if (position === null) {
      el.hidden = true;
      el.setAttribute("aria-hidden", "true");
      return;
    }

    const paneSize = this._chart.paneSize(0);
    const styleDrawing =
      drawing instanceof TrendLinePrimitive ||
      drawing instanceof HorizontalRayPrimitive
        ? drawing
        : null;
    const fibDrawing = drawing instanceof FibRetracementPrimitive ? drawing : null;
    widthButton.hidden = styleDrawing === null;
    styleButton.hidden = styleDrawing === null && fibDrawing === null;
    noteButton.hidden = styleDrawing === null;
    if (styleDrawing !== null) {
      const bold = styleDrawing.renderOptions.width >= 3;
      widthButton.title = bold ? "Use thin line" : "Use bold line";
      widthButton.setAttribute("aria-label", bold ? "Use thin line" : "Use bold line");
      widthButton.setAttribute("aria-pressed", bold ? "true" : "false");
      widthButton.classList.toggle("is-active", bold);
      widthButton.innerHTML = bold ? thinLineIconSvg() : boldLineIconSvg();

      const dashed = styleDrawing.renderOptions.lineStyle === "dashed";
      styleButton.title = dashed ? "Use solid line" : "Use dashed line";
      styleButton.setAttribute("aria-label", dashed ? "Use solid line" : "Use dashed line");
      styleButton.setAttribute("aria-pressed", dashed ? "true" : "false");
      styleButton.classList.toggle("is-active", dashed);
      styleButton.innerHTML = dashed ? solidLineIconSvg() : dashedLineIconSvg();

      const hasNote = styleDrawing.renderOptions.noteText.length > 0;
      noteButton.title = hasNote ? "Edit line note" : "Add line note";
      noteButton.setAttribute("aria-label", hasNote ? "Edit line note" : "Add line note");
      noteButton.setAttribute("aria-pressed", hasNote ? "true" : "false");
      noteButton.classList.toggle("is-active", hasNote);
      noteButton.innerHTML = noteIconSvg();
    } else if (fibDrawing !== null) {
      const open = this._fibMenuEl?.dataset.drawingId === id;
      styleButton.title = "Edit Fib levels";
      styleButton.setAttribute("aria-label", "Edit Fib levels");
      styleButton.setAttribute("aria-pressed", open ? "true" : "false");
      styleButton.classList.toggle("is-active", open);
      styleButton.innerHTML = fibLevelsIconSvg();
    }

    const actionWidth = styleDrawing !== null ? 190 : fibDrawing !== null ? 118 : 82;
    const actionHeight = 38;
    const left = clamp(position.x - actionWidth / 2, 8, paneSize.width - actionWidth - 8);
    let top = position.y - actionHeight - 10;
    if (top < 8) {
      top = position.y + 10;
    }
    top = clamp(top, 8, paneSize.height - actionHeight - 8);

    const locked = this._lockedDrawingIds.has(id);
    lockButton.title = locked ? "Unlock drawing" : "Lock drawing";
    lockButton.setAttribute("aria-label", locked ? "Unlock drawing" : "Lock drawing");
    lockButton.setAttribute("aria-pressed", locked ? "true" : "false");
    lockButton.innerHTML = locked ? lockedIconSvg() : unlockedIconSvg();
    lockButton.classList.toggle("is-active", locked);
    el.classList.toggle("is-locked", locked);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.hidden = false;
    el.setAttribute("aria-hidden", "false");
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

function isActionTool(tool: DrawingToolType): tool is DrawingSelectionActionToolType {
  return (
    tool === "trendline" ||
    tool === "brush" ||
    tool === "fib_retracement" ||
    tool === "date_range" ||
    tool === "horizontal_ray" ||
    tool === "rectangle"
  );
}

function selectionActionPosition(
  chart: IChartApi,
  series: ISeriesApi<"Candlestick">,
  drawing: DrawingPrimitive,
): ChartPoint | null {
  const points = drawing.anchors
    .map((anchor) => anchorToPoint(chart, series, anchor))
    .filter((point): point is ChartPoint => point !== null);
  if (points.length === 0) return null;

  switch (drawing.tool) {
    case "trendline":
      if (points.length < 2) return null;
      return {
        x: (points[0].x + points[1].x) / 2,
        y: Math.min(points[0].y, points[1].y),
      };
    case "brush": {
      if (points.length < 2) return null;
      const middle = points[Math.floor(points.length / 2)];
      const top = Math.min(...points.map((point) => point.y));
      return {
        x: middle.x,
        y: top,
      };
    }
    case "fib_retracement":
      if (points.length < 2) return null;
      return {
        x: (points[0].x + points[1].x) / 2,
        y: Math.min(points[0].y, points[1].y),
      };
    case "date_range":
      if (points.length < 2) return null;
      return {
        x: (points[0].x + points[1].x) / 2,
        y: points[0].y,
      };
    case "horizontal_ray":
      return {
        x: Math.min(points[0].x + 84, chart.paneSize(0).width - 48),
        y: points[0].y,
      };
    case "rectangle": {
      if (points.length < 2) return null;
      const left = Math.min(points[0].x, points[1].x);
      const right = Math.max(points[0].x, points[1].x);
      const top = Math.min(points[0].y, points[1].y);
      return {
        x: (left + right) / 2,
        y: top,
      };
    }
    default:
      return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function normalizeLineNote(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 120);
}

function createFibLevelRow(
  index: number,
  level: FibRetracementLevel,
): HTMLElement {
  const row = document.createElement("label");
  row.className = "drawing-fib-level-row";
  row.dataset.fibLevelRow = String(index);

  const enabled = document.createElement("input");
  enabled.type = "checkbox";
  enabled.checked = level.enabled !== false;
  enabled.dataset.fibLevelEnabled = "true";
  enabled.setAttribute("aria-label", `Show Fib level ${index + 1}`);

  const value = document.createElement("input");
  value.type = "text";
  value.inputMode = "decimal";
  value.spellcheck = false;
  value.value = formatFibLevelValue(level.value);
  value.dataset.fibLevelValue = "true";
  value.setAttribute("aria-label", `Fib level ${index + 1}`);

  const color = document.createElement("input");
  color.type = "color";
  color.value = normalizeHexColor(level.color);
  color.dataset.fibLevelColor = "true";
  color.setAttribute("aria-label", `Fib level ${index + 1} color`);

  row.append(enabled, value, color);
  return row;
}

function parseFibLevelValue(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeHexColor(value: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#8a8d91";
}

function thinLineIconSvg(): string {
  return [
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"',
    ' stroke-width="2" stroke-linecap="round" aria-hidden="true">',
    '<path d="M4 12h16" />',
    '</svg>',
  ].join("");
}

function boldLineIconSvg(): string {
  return [
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"',
    ' stroke-width="4" stroke-linecap="round" aria-hidden="true">',
    '<path d="M4 12h16" />',
    '</svg>',
  ].join("");
}

function solidLineIconSvg(): string {
  return [
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"',
    ' stroke-width="2" stroke-linecap="round" aria-hidden="true">',
    '<path d="M4 12h16" />',
    '</svg>',
  ].join("");
}

function dashedLineIconSvg(): string {
  return [
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"',
    ' stroke-width="2" stroke-linecap="round" stroke-dasharray="3 3" aria-hidden="true">',
    '<path d="M4 12h16" />',
    '</svg>',
  ].join("");
}

function noteIconSvg(): string {
  return [
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"',
    ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
    '<path d="M5 5h14v10H9l-4 4V5z" />',
    '<path d="M8 9h8" />',
    '<path d="M8 12h5" />',
    '</svg>',
  ].join("");
}

function fibLevelsIconSvg(): string {
  return [
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"',
    ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
    '<path d="M5 18L19 6" />',
    '<path d="M5 8h14" />',
    '<path d="M5 12h14" />',
    '<path d="M5 16h14" />',
    '</svg>',
  ].join("");
}

function unlockedIconSvg(): string {
  return [
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"',
    ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
    '<rect x="4" y="11" width="16" height="9" rx="2" />',
    '<path d="M8 11V7a4 4 0 0 1 7.5-2" />',
    '</svg>',
  ].join("");
}

function lockedIconSvg(): string {
  return [
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"',
    ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
    '<rect x="4" y="11" width="16" height="9" rx="2" />',
    '<path d="M8 11V7a4 4 0 0 1 8 0v4" />',
    '</svg>',
  ].join("");
}

function deleteIconSvg(): string {
  return [
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"',
    ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">',
    '<path d="M3 6h18" />',
    '<path d="M8 6V4h8v2" />',
    '<path d="M19 6l-1 14H6L5 6" />',
    '<path d="M10 11v5" />',
    '<path d="M14 11v5" />',
    '</svg>',
  ].join("");
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

function hitPolyline(
  point: { x: number; y: number },
  points: readonly { x: number; y: number }[],
  tolerance: number,
): boolean {
  for (let index = 0; index < points.length - 1; index += 1) {
    if (distanceToSegment(point, points[index], points[index + 1]) <= tolerance) {
      return true;
    }
  }
  return false;
}

function hitFibRetracement(
  chart: IChartApi,
  series: ISeriesApi<"Candlestick">,
  drawing: FibRetracementPrimitive,
  point: { x: number; y: number },
  tolerance: number,
): boolean {
  if (drawing.anchors.length < 2) return false;
  const p1 = anchorToPoint(chart, series, drawing.anchors[0]);
  const p2 = anchorToPoint(chart, series, drawing.anchors[1]);
  if (p1 === null || p2 === null) return false;
  if (distanceToSegment(point, p1, p2) <= tolerance) return true;

  const left = Math.min(p1.x, p2.x) - tolerance;
  const right = Math.max(p1.x, p2.x) + tolerance;
  if (point.x < left || point.x > right) return false;

  const startPrice = drawing.anchors[0].price;
  const endPrice = drawing.anchors[1].price;
  for (const level of drawing.fibLevels) {
    if (level.enabled === false) continue;
    const price = fibLevelPrice(startPrice, endPrice, level.value);
    const y = series.priceToCoordinate(price);
    if (y !== null && Math.abs((y as number) - point.y) <= tolerance) {
      return true;
    }
  }
  return false;
}

function moveDrawingAnchors(
  chart: IChartApi,
  series: ISeriesApi<"Candlestick">,
  anchors: readonly AnchorPoint[],
  startPoint: ChartPoint,
  currentPoint: ChartPoint,
): AnchorPoint[] {
  const dx = currentPoint.x - startPoint.x;
  const dy = currentPoint.y - startPoint.y;
  return anchors.map((anchor) => {
    const point = anchorToPoint(chart, series, anchor);
    if (point === null) return { ...anchor };
    const moved = anchorFromPoint(chart, series, {
      x: point.x + dx,
      y: point.y + dy,
    });
    return moved ?? { ...anchor };
  });
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

function rectangleFrameHit(
  point: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  tolerance: number,
): boolean {
  const left = Math.min(p1.x, p2.x);
  const right = Math.max(p1.x, p2.x);
  const top = Math.min(p1.y, p2.y);
  const bottom = Math.max(p1.y, p2.y);
  const insideHorizontal = point.x >= left - tolerance && point.x <= right + tolerance;
  const insideVertical = point.y >= top - tolerance && point.y <= bottom + tolerance;
  if (!insideHorizontal || !insideVertical) return false;
  return (
    Math.abs(point.x - left) <= tolerance ||
    Math.abs(point.x - right) <= tolerance ||
    Math.abs(point.y - top) <= tolerance ||
    Math.abs(point.y - bottom) <= tolerance
  );
}

function rectangleHandleHit(
  chart: IChartApi,
  series: ISeriesApi<"Candlestick">,
  drawingId: string,
  anchors: readonly AnchorPoint[],
  point: { x: number; y: number },
  tolerance: number,
): AnchorHit | null {
  const p1 = anchorToPoint(chart, series, anchors[0]);
  const p2 = anchorToPoint(chart, series, anchors[1]);
  if (p1 === null || p2 === null) return null;

  let best:
    | { handle: RectangleResizeHandle; distance: number }
    | null = null;
  for (const handlePoint of rectangleHandlePoints(p1, p2)) {
    const distance = Math.hypot(handlePoint.x - point.x, handlePoint.y - point.y);
    if (distance <= tolerance && (best === null || distance < best.distance)) {
      best = { handle: handlePoint.handle, distance };
    }
  }
  if (best === null) return null;
  return {
    drawingId,
    rectangleHandle: best.handle,
    rectangleSides: rectangleSideIndices(p1, p2),
  };
}

function rectangleHandlePoints(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
): Array<{ handle: RectangleResizeHandle; x: number; y: number }> {
  const left = Math.min(p1.x, p2.x);
  const right = Math.max(p1.x, p2.x);
  const top = Math.min(p1.y, p2.y);
  const bottom = Math.max(p1.y, p2.y);
  const midX = (left + right) / 2;
  const midY = (top + bottom) / 2;
  return [
    { handle: "top-left", x: left, y: top },
    { handle: "top", x: midX, y: top },
    { handle: "top-right", x: right, y: top },
    { handle: "right", x: right, y: midY },
    { handle: "bottom-right", x: right, y: bottom },
    { handle: "bottom", x: midX, y: bottom },
    { handle: "bottom-left", x: left, y: bottom },
    { handle: "left", x: left, y: midY },
  ];
}

function rectangleSideIndices(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
): RectangleSideIndices {
  return {
    left: p1.x <= p2.x ? 0 : 1,
    right: p1.x <= p2.x ? 1 : 0,
    top: p1.y <= p2.y ? 0 : 1,
    bottom: p1.y <= p2.y ? 1 : 0,
  };
}

function resizeRectangleAnchors(
  anchors: readonly AnchorPoint[],
  handle: RectangleResizeHandle,
  sides: RectangleSideIndices,
  pointerAnchor: AnchorPoint,
): AnchorPoint[] {
  const next = anchors.map((anchor) => ({ ...anchor }));
  if (next.length < 2) return next;

  const updateX = (index: 0 | 1) => {
    next[index] = {
      ...next[index],
      time: pointerAnchor.time,
      logical: pointerAnchor.logical,
    };
  };
  const updateY = (index: 0 | 1) => {
    next[index] = {
      ...next[index],
      price: pointerAnchor.price,
    };
  };

  if (
    handle === "left" ||
    handle === "top-left" ||
    handle === "bottom-left"
  ) {
    updateX(sides.left);
  }
  if (
    handle === "right" ||
    handle === "top-right" ||
    handle === "bottom-right"
  ) {
    updateX(sides.right);
  }
  if (
    handle === "top" ||
    handle === "top-left" ||
    handle === "top-right"
  ) {
    updateY(sides.top);
  }
  if (
    handle === "bottom" ||
    handle === "bottom-left" ||
    handle === "bottom-right"
  ) {
    updateY(sides.bottom);
  }

  return next;
}

function fixedRangeProfileHandleHit(
  chart: IChartApi,
  series: ISeriesApi<"Candlestick">,
  drawingId: string,
  anchors: readonly AnchorPoint[],
  point: { x: number; y: number },
  tolerance: number,
): AnchorHit | null {
  const p1 = anchorToPoint(chart, series, anchors[0]);
  const p2 = anchorToPoint(chart, series, anchors[1]);
  if (p1 === null || p2 === null) return null;

  let best:
    | { handle: FixedRangeProfileResizeHandle; distance: number }
    | null = null;
  for (const handlePoint of fixedRangeProfileHandlePoints(p1, p2)) {
    const distance = Math.hypot(handlePoint.x - point.x, handlePoint.y - point.y);
    if (distance <= tolerance && (best === null || distance < best.distance)) {
      best = { handle: handlePoint.handle, distance };
    }
  }
  if (best === null) return null;
  return {
    drawingId,
    fixedRangeProfileHandle: best.handle,
    fixedRangeProfileSides: fixedRangeProfileSideIndices(p1, p2),
  };
}

function fixedRangeProfileFrameHit(
  chart: IChartApi,
  series: ISeriesApi<"Candlestick">,
  anchors: readonly AnchorPoint[],
  point: { x: number; y: number },
  tolerance: number,
): boolean {
  const p1 = anchorToPoint(chart, series, anchors[0]);
  const p2 = anchorToPoint(chart, series, anchors[1]);
  if (p1 === null || p2 === null) return false;
  return rectangleFrameHit(point, p1, p2, tolerance);
}

function fixedRangeProfileBoxHit(
  chart: IChartApi,
  series: ISeriesApi<"Candlestick">,
  anchors: readonly AnchorPoint[],
  point: { x: number; y: number },
  tolerance: number,
): boolean {
  const p1 = anchorToPoint(chart, series, anchors[0]);
  const p2 = anchorToPoint(chart, series, anchors[1]);
  if (p1 === null || p2 === null) return false;
  return pointInBox(point, p1, p2, tolerance);
}

function fixedRangeProfileHandlePoints(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
): Array<{ handle: FixedRangeProfileResizeHandle; x: number; y: number }> {
  const left = Math.min(p1.x, p2.x);
  const right = Math.max(p1.x, p2.x);
  const top = Math.min(p1.y, p2.y);
  const bottom = Math.max(p1.y, p2.y);
  const midY = (top + bottom) / 2;
  return [
    { handle: "top-left", x: left, y: top },
    { handle: "top-right", x: right, y: top },
    { handle: "right", x: right, y: midY },
    { handle: "bottom-right", x: right, y: bottom },
    { handle: "bottom-left", x: left, y: bottom },
    { handle: "left", x: left, y: midY },
  ];
}

function fixedRangeProfileSideIndices(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
): FixedRangeProfileSideIndices {
  return {
    left: p1.x <= p2.x ? 0 : 1,
    right: p1.x <= p2.x ? 1 : 0,
    top: p1.y <= p2.y ? 0 : 1,
    bottom: p1.y <= p2.y ? 1 : 0,
  };
}

function fixedRangeProfileHandleChangesPrice(
  handle: FixedRangeProfileResizeHandle,
): boolean {
  return (
    handle === "top-left" ||
    handle === "top-right" ||
    handle === "bottom-right" ||
    handle === "bottom-left"
  );
}

function resizeFixedRangeProfileAnchors(
  anchors: readonly AnchorPoint[],
  handle: FixedRangeProfileResizeHandle,
  sides: FixedRangeProfileSideIndices,
  pointerAnchor: AnchorPoint,
): AnchorPoint[] {
  const next = anchors.map((anchor) => ({ ...anchor }));
  if (next.length < 2) return next;

  const updateX = (index: 0 | 1) => {
    next[index] = {
      ...next[index],
      time: pointerAnchor.time,
      logical: pointerAnchor.logical,
    };
  };
  const updateY = (index: 0 | 1) => {
    next[index] = {
      ...next[index],
      price: pointerAnchor.price,
    };
  };

  if (handle === "left" || handle === "top-left" || handle === "bottom-left") {
    updateX(sides.left);
  }
  if (handle === "right" || handle === "top-right" || handle === "bottom-right") {
    updateX(sides.right);
  }
  if (handle === "top-left" || handle === "top-right") {
    updateY(sides.top);
  }
  if (handle === "bottom-left" || handle === "bottom-right") {
    updateY(sides.bottom);
  }

  return next;
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

function hitOrderBracket(
  point: { x: number; y: number },
  points: readonly { x: number; y: number }[],
  tolerance: number,
): boolean {
  const left = Math.min(...points.map((p) => p.x)) - tolerance;
  const right = Math.max(...points.map((p) => p.x)) + tolerance;
  if (point.x < left || point.x > right) return false;
  return points.some((p) => Math.abs(point.y - p.y) <= tolerance);
}
