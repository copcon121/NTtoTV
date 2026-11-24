import type { DrawingState, DrawingToolType } from "../drawings/types";
import type { Timeframe } from "../../socket/messages";

export const SYNC_PROTOCOL = "gc-chart-sync-v1" as const;
export const SHARED_DRAWING_TOOLS = ["trendline", "rectangle", "horizontal_ray", "vertical_line"] as const;
export type SharedDrawingTool = typeof SHARED_DRAWING_TOOLS[number];
/** Ephemeral placement intent. A null tool cancels only this selection identity. */
export interface SharedToolSelection { selectionId: string; tool: SharedDrawingTool | null }
export interface UtcViewport { fromUtcMs: number; toUtcMs: number; priceRange?: { min: number; max: number } }
export interface SharedDrawing {
  id: string;
  tool: SharedDrawingTool;
  anchors: Array<{ utcMs: number; price: number }>;
  options?: { lineColor?: string; fillColor?: string; lineWidth?: number; lineStyle?: "solid" | "dashed" };
}
export type SharedDrawingOperation = { op: "upsert"; drawing: SharedDrawing } | { op: "delete"; id: string };
export interface ChartSyncChange { viewport?: UtcViewport; drawingOps?: SharedDrawingOperation[]; toolSelection?: SharedToolSelection }
export interface ChartSyncConfig {
  widgetId: string;
  instanceId: string;
  epoch: string;
  revision: number;
  workspaceId: string;
  groupId: string | null;
  symbol: string;
  contract: string;
  mode: "live" | "replay";
  replayId?: string;
  syncViewport: boolean;
  syncDrawings: boolean;
  viewport?: UtcViewport;
  drawings: SharedDrawing[];
  toolSelection?: SharedToolSelection;
}
/** In-process main/mini chart API. Incoming group data never reaches local/profile drawing callbacks. */
export interface ChartSyncConnection {
  config?: ChartSyncConfig;
  publish(change: ChartSyncChange): void;
}
export interface WidgetSyncHello { protocol: typeof SYNC_PROTOCOL; type: "hello"; widgetId: string; instanceId: string; symbol: string; contract: string; timeframe: Timeframe; mode: "live" | "replay"; replayId?: string }
export interface WidgetSyncConfigMessage { protocol: typeof SYNC_PROTOCOL; type: "config"; config: ChartSyncConfig }
export interface WidgetSyncUpdate { protocol: typeof SYNC_PROTOCOL; type: "update"; widgetId: string; instanceId: string; epoch: string; baseRevision: number; sequence: number; symbol: string; contract: string; timeframe: Timeframe; mode: "live" | "replay"; replayId?: string; change: ChartSyncChange }
export type WidgetSyncMessage = WidgetSyncHello | WidgetSyncConfigMessage | WidgetSyncUpdate;

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
export function validViewport(value: unknown): value is UtcViewport {
  const v = value as UtcViewport | undefined;
  return !!v && finite(v.fromUtcMs) && finite(v.toUtcMs) && v.fromUtcMs >= 0 && v.toUtcMs > v.fromUtcMs
    && v.toUtcMs <= 8.64e15 && (!v.priceRange || (finite(v.priceRange.min) && finite(v.priceRange.max) && v.priceRange.max > v.priceRange.min));
}
export function validSharedDrawing(value: unknown): value is SharedDrawing {
  const d = value as SharedDrawing | undefined;
  if (!d || typeof d.id !== "string" || !d.id || d.id.length > 160 || !SHARED_DRAWING_TOOLS.includes(d.tool)) return false;
  const count = d.tool === "horizontal_ray" || d.tool === "vertical_line" ? 1 : 2;
  if (!Array.isArray(d.anchors) || d.anchors.length !== count || !d.anchors.every(a => a && finite(a.utcMs) && a.utcMs >= 0 && a.utcMs <= 8.64e15 && finite(a.price))) return false;
  if (d.options) {
    if (typeof d.options !== "object" || Object.keys(d.options).some(k => !["lineColor", "fillColor", "lineWidth", "lineStyle"].includes(k))) return false;
    if ([d.options.lineColor, d.options.fillColor].some(c => c !== undefined && (typeof c !== "string" || !/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(c)))) return false;
    if (d.options.lineWidth !== undefined && (!finite(d.options.lineWidth) || d.options.lineWidth < 1 || d.options.lineWidth > 10)) return false;
    if (d.options.lineStyle !== undefined && !["solid", "dashed"].includes(d.options.lineStyle)) return false;
  }
  return true;
}
export function validSyncChange(value: unknown): value is ChartSyncChange {
  const c = value as ChartSyncChange | undefined;
  if (!c || typeof c !== "object" || (!c.viewport && !c.drawingOps && !c.toolSelection)) return false;
  if (c.toolSelection !== undefined && !validToolSelection(c.toolSelection)) return false;
  if (c.viewport && !validViewport(c.viewport)) return false;
  return !c.drawingOps || (Array.isArray(c.drawingOps) && c.drawingOps.length <= 1000 && c.drawingOps.every(o => o && (o.op === "upsert" ? validSharedDrawing(o.drawing) : o.op === "delete" && typeof o.id === "string" && !!o.id && o.id.length <= 160)));
}
export function validToolSelection(value: unknown): value is SharedToolSelection {
  const s = value as SharedToolSelection | undefined;
  return !!s && typeof s.selectionId === "string" && !!s.selectionId && s.selectionId.length <= 160
    && (s.tool === null || SHARED_DRAWING_TOOLS.includes(s.tool));
}
export function validSyncConfig(value: unknown): value is ChartSyncConfig {
  const c = value as ChartSyncConfig | undefined;
  return !!c && [c.widgetId, c.instanceId, c.epoch, c.workspaceId, c.symbol, c.contract].every(v => typeof v === "string" && !!v)
    && (c.groupId === null || typeof c.groupId === "string") && Number.isSafeInteger(c.revision) && c.revision >= 0
    && ["live", "replay"].includes(c.mode) && (c.replayId === undefined || typeof c.replayId === "string")
    && typeof c.syncViewport === "boolean" && typeof c.syncDrawings === "boolean"
    && (c.toolSelection === undefined || validToolSelection(c.toolSelection))
    && (!c.viewport || validViewport(c.viewport)) && Array.isArray(c.drawings) && c.drawings.length <= 1000
    && c.drawings.every(validSharedDrawing) && new Set(c.drawings.map(d => d.id)).size === c.drawings.length;
}
export function applyDrawingOperations(drawings: readonly SharedDrawing[], operations: readonly SharedDrawingOperation[]): SharedDrawing[] {
  const next = new Map(drawings.map(d => [d.id, d]));
  for (const operation of operations) {
    if (operation.op === "delete") next.delete(operation.id);
    else if (validSharedDrawing(operation.drawing)) next.set(operation.drawing.id, operation.drawing);
  }
  return [...next.values()];
}
/** DrawingState timestamps are display seconds; the wire uses true UTC milliseconds. */
export function toSharedDrawing(state: DrawingState, displayTimeOffsetMs = 0): SharedDrawing | undefined {
  if (state.paneId && state.paneId !== "main") return undefined;
  if (!SHARED_DRAWING_TOOLS.includes(state.tool as SharedDrawingTool)) return undefined;
  const candidate: SharedDrawing = { id: state.id, tool: state.tool as SharedDrawingTool,
    anchors: state.anchors.map(a => ({ utcMs: Number(a.time) * 1000 - displayTimeOffsetMs, price: a.price })),
    options: state.options ? { lineColor: state.options.lineColor, fillColor: state.options.fillColor, lineWidth: state.options.lineWidth, lineStyle: state.options.lineStyle } : undefined };
  return validSharedDrawing(candidate) ? candidate : undefined;
}
export function fromSharedDrawing(drawing: SharedDrawing, displayTimeOffsetMs = 0): DrawingState {
  return { id: drawing.id, tool: drawing.tool as DrawingToolType, paneId: "main", options: drawing.options,
    anchors: drawing.anchors.map(a => ({ time: ((a.utcMs + displayTimeOffsetMs) / 1000) as DrawingState["anchors"][number]["time"], price: a.price })) };
}
