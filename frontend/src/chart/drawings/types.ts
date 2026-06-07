/**
 * Drawing tools — shared types.
 *
 * Each drawing is a lightweight-charts v5 series primitive (ISeriesPrimitive)
 * attached to the candle series. This module defines the common interfaces
 * shared by all tool implementations and the DrawingManager orchestrator.
 */

import type { ISeriesApi, IChartApi, UTCTimestamp } from "lightweight-charts";

/* ------------------------------------------------------------------ */
/* Tool catalogue                                                      */
/* ------------------------------------------------------------------ */

export type DrawingToolType =
  | "trendline"
  | "price_range"
  | "order_bracket"
  | "rectangle"
  | "horizontal_ray"
  | "vertical_line";

export interface DrawingToolDef {
  type: DrawingToolType;
  label: string;
  /** Number of clicks needed to place the drawing. */
  anchors: number;
  /** SVG path data for the toolbar icon (24×24 viewBox). */
  icon: string;
}

/** Registry of available tools. */
export const DRAWING_TOOLS: readonly DrawingToolDef[] = [
  {
    type: "trendline",
    label: "Trend Line",
    anchors: 2,
    icon: "M4 20 L20 4",
  },
  {
    type: "horizontal_ray",
    label: "Horizontal Ray",
    anchors: 1,
    icon: "M4 12 L20 12 M16 8 L20 12 L16 16",
  },
  {
    type: "rectangle",
    label: "Rectangle",
    anchors: 2,
    icon: "M4 6 h16 v12 h-16 Z",
  },
  {
    type: "vertical_line",
    label: "Vertical Line",
    anchors: 1,
    icon: "M12 4 v16 M8 8 l4 -4 l4 4 M8 16 l4 4 l4 -4",
  },
  {
    type: "price_range",
    label: "Price Range",
    anchors: 2,
    icon: "M4 6 h16 M4 18 h16 M12 6 v12 M8 9 L12 6 L16 9 M8 15 L12 18 L16 15",
  },
  {
    type: "order_bracket",
    label: "Order",
    anchors: 3,
    icon: "M4 6 h16 M4 12 h16 M4 18 h16 M8 6 v12 M16 6 v12",
  },
] as const;

/* ------------------------------------------------------------------ */
/* Anchor / state                                                      */
/* ------------------------------------------------------------------ */

export interface AnchorPoint {
  /**
   * Display timestamp in seconds. This is the stable x-axis anchor across
   * timeframe changes. `logical` is kept only as a fallback when no timestamp
   * mapping can be resolved, such as a chart with no loaded data.
   */
  time: UTCTimestamp;
  price: number;
  logical?: number;
}

export interface DrawingState {
  id: string;
  tool: DrawingToolType;
  anchors: AnchorPoint[];
  options?: DrawingOptions;
}

export interface DrawingOptions {
  lineColor?: string;
  lineWidth?: number;
  fillColor?: string;
  /** For price range: show percentage and absolute diff labels. */
  showLabels?: boolean;
}

/* ------------------------------------------------------------------ */
/* Drawing primitive interface                                         */
/* ------------------------------------------------------------------ */

/**
 * Every drawing tool implements this interface. The underlying class also
 * implements `ISeriesPrimitive` so it can be attached to a series via
 * `series.attachPrimitive(drawing)`.
 */
export interface IDrawing {
  readonly id: string;
  readonly tool: DrawingToolType;
  readonly anchors: AnchorPoint[];
  readonly selected: boolean;

  /** Update anchor positions (e.g. during interactive placement). */
  setAnchors(anchors: AnchorPoint[]): void;

  /** Show/hide edit handles and selection-only axis labels. */
  setSelected(selected: boolean): void;

  /** Serialise to a portable state object. */
  toState(): DrawingState;

  /** Request a visual refresh. */
  requestUpdate(): void;
}

/* ------------------------------------------------------------------ */
/* Drawing Manager interface                                           */
/* ------------------------------------------------------------------ */

export interface IDrawingManager {
  /** Attach to chart + series. Call once after the adapter mounts. */
  attach(
    chart: IChartApi,
    series: ISeriesApi<"Candlestick">,
    container: HTMLElement,
  ): void;

  /** Start interactive placement for the given tool type. */
  startDrawing(tool: DrawingToolType): void;

  /** Cancel any in-progress interactive placement. */
  cancelDrawing(): void;

  /** Remove a specific drawing by id. */
  removeDrawing(id: string): void;

  /** Remove all drawings. */
  removeAllDrawings(): void;

  /** Export all completed drawings to serializable state. */
  exportState(): DrawingState[];

  /** Replace all drawings from serialized state. */
  loadState(states: readonly DrawingState[]): void;

  /** Current drawing count. */
  readonly drawingCount: number;

  /** Subscribe to drawing-count changes. Returns unsubscribe. */
  onCountChange(handler: (count: number) => void): () => void;

  /** Subscribe to drawing-state changes. Returns unsubscribe. */
  onStateChange(handler: (state: DrawingState[]) => void): () => void;

  /** Dispose the manager and all drawings. */
  dispose(): void;
}
