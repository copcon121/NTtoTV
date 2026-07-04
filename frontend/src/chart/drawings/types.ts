/**
 * Drawing tools — shared types.
 *
 * Each drawing is a lightweight-charts v5 series primitive (ISeriesPrimitive)
 * attached to the candle series. This module defines the common interfaces
 * shared by all tool implementations and the DrawingManager orchestrator.
 */

import type { ISeriesApi, IChartApi, UTCTimestamp } from "lightweight-charts";
import type { DeltaProfileLoadState } from "../../orderflow/deltaProfile";
import type { Timeframe } from "../../socket/messages";

/* ------------------------------------------------------------------ */
/* Tool catalogue                                                      */
/* ------------------------------------------------------------------ */

export type DrawingToolType =
  | "trendline"
  | "brush"
  | "fib_retracement"
  | "price_range"
  | "order_bracket"
  | "rectangle"
  | "fixed_range_delta_profile"
  | "horizontal_ray"
  | "vertical_line";

export type FixedRangeProfileMode = "delta" | "volume";
export type DrawingLineStyle = "solid" | "dashed";

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
    type: "order_bracket",
    label: "Order",
    anchors: 3,
    icon: "M4 5 h16 M4 12 h10 M4 19 h16 M7 5 v14 M17 5 v14 M14 9 l4 3 -4 3",
  },
  {
    type: "trendline",
    label: "Trend Line",
    anchors: 2,
    icon: "M4 20 L20 4",
  },
  {
    type: "fib_retracement",
    label: "Fib Retracement",
    anchors: 2,
    icon: "M5 18 L19 6 M5 8 h14 M5 12 h14 M5 16 h14",
  },
  {
    type: "brush",
    label: "Brush",
    anchors: 0,
    icon: "M4 20 C7 12 10 14 12 8 C14 3 18 4 20 6 M5 19 L3 21 M16 6 L20 10",
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
    type: "fixed_range_delta_profile",
    label: "Fixed Range Delta Profile",
    anchors: 2,
    icon: "M5 5 v14 M8 7 h11 M8 12 h8 M8 17 h5",
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
  sourceTimeframe?: Timeframe;
  locked?: boolean;
}

export interface DrawingOptions {
  lineColor?: string;
  lineWidth?: number;
  lineStyle?: DrawingLineStyle;
  fillColor?: string;
  /** For Fib retracement: editable horizontal retracement/extension levels. */
  fibLevels?: FibRetracementLevel[];
  /** For Fib retracement: show or hide the diagonal anchor line. */
  fibTrendLineVisible?: boolean;
  /** For Fib retracement: color of the diagonal anchor line. */
  fibTrendLineColor?: string;
  /** For fixed range profile: bid/ask split or total volume rows. */
  fixedRangeProfileMode?: FixedRangeProfileMode;
  /** For fixed range profile: keep the right edge pinned to the latest bar. */
  fixedRangeProfileExtendRight?: boolean;
  /** For fixed range profile: fit the vertical frame to the loaded price ladder. */
  fixedRangeProfileAutoFitVertical?: boolean;
  /** For fixed range profile: opacity for rows inside the value area, 0..1. */
  fixedRangeProfileValueAreaOpacity?: number;
  /** For fixed range profile: opacity for rows outside the value area, 0..1. */
  fixedRangeProfileOutsideValueAreaOpacity?: number;
  /** For fixed range profile: draw the running POC through the selected range. */
  fixedRangeProfileDevelopingPoc?: boolean;
  /** For price range: show percentage and absolute diff labels. */
  showLabels?: boolean;
  /** For line drawings: user note rendered on the line/ray. */
  noteText?: string;
}

export interface FibRetracementLevel {
  value: number;
  color: string;
  enabled?: boolean;
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
  startDrawing(tool: DrawingToolType, options?: DrawingOptions): void;

  /** Cancel any in-progress interactive placement. */
  cancelDrawing(): void;

  /** Remove a specific drawing by id. */
  removeDrawing(id: string): void;

  /** Remove all drawings. */
  removeAllDrawings(): void;

  /** Update computed data for one fixed-range delta profile drawing. */
  setFixedRangeDeltaProfile(id: string, state: DeltaProfileLoadState): void;

  /** Request a visual refresh for every attached drawing. */
  requestUpdateAll(): void;

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
