import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, Logical, LogicalRange } from "lightweight-charts";
import { DrawingManager } from "../drawings/DrawingManager";
import { coordinateForLogical, logicalForCoordinate } from "../drawings/coordinates";
import { DRAWING_TOOLS, type DrawingToolType } from "../drawings/types";
import { fromSharedDrawing, SHARED_DRAWING_TOOLS, toSharedDrawing, validViewport, type ChartSyncConnection, type SharedDrawing, type SharedDrawingOperation, type UtcViewport } from "./sync";
import { chartLogicalToUtc, utcToChartLogical, viewportEqual } from "./coordinates";
import "./shared.css";

export interface SharedChartProjection {
  width: number; height: number; barSpacing: number; viewport: UtcViewport;
  timeToX(utcMs: number): number | null;
  priceToY(price: number): number;
  yToPrice(y: number): number | null;
  xToTime(x: number): number | null;
}
export interface ChartSyncLayerProps {
  chart: IChartApi; series: ISeriesApi<"Candlestick">; container: HTMLElement;
  sync: ChartSyncConnection; displayTimeOffsetMs?: number;
  onProjectionChange?: (projection: SharedChartProjection) => void;
  onEditingChange?: (editing: boolean) => void;
  suspendEditing?: boolean;
  externalTool?: DrawingToolType;
  onToolDeselect?: () => void;
  deleteAllSignal?: number;
  showDrawingMenu?: boolean;
}
export function drawingOperations(previous: readonly SharedDrawing[], next: readonly SharedDrawing[]): SharedDrawingOperation[] {
  const before = new Map(previous.map(d => [d.id, d]));
  const after = new Map(next.map(d => [d.id, d]));
  return [...next.filter(d => JSON.stringify(before.get(d.id)) !== JSON.stringify(d)).map(d => ({ op: "upsert" as const, drawing: d })),
    ...previous.filter(d => !after.has(d.id)).map(d => ({ op: "delete" as const, id: d.id }))];
}

export function ChartSyncLayer({ chart, series, container, sync, displayTimeOffsetMs = 0, onProjectionChange, onEditingChange, suspendEditing, externalTool, onToolDeselect, deleteAllSignal, showDrawingMenu = false }: ChartSyncLayerProps) {
  const hitRef = useRef<HTMLDivElement>(null);
  const manager = useRef<DrawingManager>();
  const [editing, setEditing] = useState(false);
  const [activeTool, setActiveTool] = useState<string>();
  const latest = useRef({ sync, displayTimeOffsetMs, onProjectionChange, onEditingChange, externalTool, onToolDeselect, suspendEditing });
  latest.current = { sync, displayTimeOffsetMs, onProjectionChange, onEditingChange, externalTool, onToolDeselect, suspendEditing };
  const activeToolRef = useRef(activeTool); activeToolRef.current = activeTool;
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const externalPlacement = useRef(false);
  const selectionId = useRef<string>();
  const applying = useRef(false);
  const previousDrawings = useRef<SharedDrawing[]>([]);
  const savedRange = useRef<UtcViewport>();
  const remoteRange = useRef(false);
  const remoteFrame = useRef<number>();
  const loadedDrawings = useRef<string>();
  const drawingLayerIdentity = useRef<string>();
  const cachedCalendar = useRef<{ offset: number; times: number[]; indices: number[] }>();
  const calendar = () => {
    const cached = cachedCalendar.current;
    if (cached && cached.offset === latest.current.displayTimeOffsetMs && (!cached.times.length ||
      (Number(chart.timeScale().timeToIndex((cached.times[0] + cached.offset) / 1000 as never, false)) === cached.indices[0] &&
       Number(chart.timeScale().timeToIndex((cached.times[cached.times.length - 1] + cached.offset) / 1000 as never, false)) === cached.indices[cached.indices.length - 1]))) return cached;
    const data = series.data().filter(d => typeof d.time === "number");
    return cachedCalendar.current = { offset: latest.current.displayTimeOffsetMs,
      times: data.map(d => Number(d.time) * 1000 - latest.current.displayTimeOffsetMs),
      indices: data.map((d, i) => Number(chart.timeScale().timeToIndex(d.time, false) ?? i)) };
  };
  const currentEpoch = sync.config?.epoch;

  useLayoutEffect(() => {
    const hit = hitRef.current;
    if (!hit) return;
    const mgr = new DrawingManager();
    manager.current = mgr;
    mgr.attach(chart, series, hit, undefined, () => hit.parentElement?.contains(document.activeElement) === true);
    const names = new Map<string, string>();
    const stop = mgr.onStateChange((states) => {
      if (applying.current) return;
      const config = latest.current.sync.config;
      if (!config?.groupId || !config.syncDrawings) return;
      const next: SharedDrawing[] = [];
      for (const state of states) {
        const drawing = toSharedDrawing(state, latest.current.displayTimeOffsetMs);
        if (!drawing) continue;
        if (!previousDrawings.current.some(d => d.id === drawing.id)) {
          if (!names.has(drawing.id)) names.set(drawing.id, `shared-${crypto.randomUUID()}`);
          drawing.id = names.get(drawing.id)!;
        }
        next.push(drawing);
      }
      const operations = drawingOperations(previousDrawings.current, next);
      previousDrawings.current = next;
      const completedSelection = selectionId.current;
      selectionId.current = undefined;
      if (operations.length) latest.current.sync.publish({ drawingOps: operations,
        toolSelection: completedSelection ? { selectionId: completedSelection, tool: null } : undefined });
      editingRef.current = false; setEditing(false);
      latest.current.onEditingChange?.(false);
      setActiveTool(undefined);
      if (operations.length && externalPlacement.current) latest.current.onToolDeselect?.();
      externalPlacement.current = false;
    });
    return () => { stop(); mgr.dispose(); manager.current = undefined; loadedDrawings.current = undefined; latest.current.onEditingChange?.(false); };
  }, [chart, series, container]);

  useEffect(() => {
    const cancelled = selectionId.current;
    if (cancelled && suspendEditing && sync.config?.syncDrawings) {
      latest.current.sync.publish({ toolSelection: { selectionId: cancelled, tool: null } });
    }
    editingRef.current = false;
    setEditing(false); setActiveTool(undefined);
    manager.current?.cancelInteraction();
    selectionId.current = undefined;
    if (externalPlacement.current && latest.current.externalTool && SHARED_DRAWING_TOOLS.some(tool => tool === latest.current.externalTool)) latest.current.onToolDeselect?.();
    externalPlacement.current = false;
    latest.current.onEditingChange?.(false);
  }, [sync.config?.groupId, sync.config?.epoch, sync.config?.syncDrawings, suspendEditing]);

  useEffect(() => {
    if (externalPlacement.current) {
      const cancelled = selectionId.current;
      selectionId.current = undefined;
      if (cancelled) latest.current.sync.publish({ toolSelection: { selectionId: cancelled, tool: null } });
      manager.current?.cancelInteraction();
      editingRef.current = false; setEditing(false); setActiveTool(undefined);
      latest.current.onEditingChange?.(false);
      externalPlacement.current = false;
    }
    const config = latest.current.sync.config;
    if (!externalTool || !config?.groupId || !config.syncDrawings || latest.current.suspendEditing ||
      !SHARED_DRAWING_TOOLS.some(tool => tool === externalTool)) return;
    externalPlacement.current = true;
    const id = crypto.randomUUID();
    selectionId.current = id;
    editingRef.current = true; setEditing(true); setActiveTool(externalTool);
    latest.current.onEditingChange?.(true);
    manager.current?.startDrawing(externalTool); hitRef.current?.focus();
    latest.current.sync.publish({ toolSelection: { selectionId: id, tool: externalTool as typeof SHARED_DRAWING_TOOLS[number] } });
  }, [externalTool, chart, series]);

  useEffect(() => {
    const selection = sync.config?.toolSelection;
    if (!sync.config?.groupId || !sync.config.syncDrawings || suspendEditing || !selection) return;
    if (selection.tool === null) {
      if (selectionId.current === selection.selectionId) {
        selectionId.current = undefined;
        manager.current?.cancelInteraction();
        editingRef.current = false; setEditing(false); setActiveTool(undefined);
        latest.current.onEditingChange?.(false);
        if (externalPlacement.current) latest.current.onToolDeselect?.();
        externalPlacement.current = false;
      }
      return;
    }
    if (selectionId.current === selection.selectionId) return;
    manager.current?.cancelInteraction();
    selectionId.current = selection.selectionId;
    editingRef.current = true; setEditing(true); setActiveTool(selection.tool);
    latest.current.onEditingChange?.(true);
    manager.current?.startDrawing(selection.tool);
  }, [sync.config?.toolSelection, sync.config?.groupId, sync.config?.syncDrawings, suspendEditing]);

  const previousDelete = useRef(deleteAllSignal ?? 0);
  useEffect(() => {
    if ((deleteAllSignal ?? 0) > previousDelete.current && sync.config?.syncDrawings) {
      changeEditing(false);
      manager.current?.removeAllDrawings();
    }
    previousDelete.current = deleteAllSignal ?? 0;
  }, [deleteAllSignal, sync.config?.syncDrawings]);

  useEffect(() => {
    const select = (event: PointerEvent) => {
      const config = latest.current.sync.config;
      if (!config?.groupId || !config.syncDrawings || latest.current.suspendEditing || activeToolRef.current) return;
      if (event.target instanceof Element && event.target.closest("button,input,select,textarea,summary,[role=toolbar],[role=menu]")) return;
      if (hitRef.current?.contains(event.target as Node)) return;
      if (manager.current?.beginOverlayEdit(event)) {
        editingRef.current = true; setEditing(true); latest.current.onEditingChange?.(true); hitRef.current?.focus();
      }
    };
    container.addEventListener("pointerdown", select, true);
    return () => container.removeEventListener("pointerdown", select, true);
  }, [container]);

  useEffect(() => {
    const mgr = manager.current;
    if (!mgr) return;
    const drawings = sync.config?.groupId && sync.config.syncDrawings ? sync.config.drawings : [];
    const key = JSON.stringify([sync.config?.epoch, displayTimeOffsetMs, drawings]);
    if (loadedDrawings.current === key) return;
    loadedDrawings.current = key;
    const identity = `${sync.config?.epoch}:${displayTimeOffsetMs}`;
    const sameLayer = drawingLayerIdentity.current === identity;
    drawingLayerIdentity.current = identity;
    if (sameLayer && JSON.stringify(previousDrawings.current) === JSON.stringify(drawings)) return;
    applying.current = true;
    previousDrawings.current = drawings;
    mgr.loadState(drawings.map(d => fromSharedDrawing(d, displayTimeOffsetMs)));
    applying.current = false;
  }, [sync.config?.drawings, sync.config?.epoch, sync.config?.revision, sync.config?.syncDrawings, displayTimeOffsetMs, chart]);

  useLayoutEffect(() => {
    let frame: number | undefined;
    let gesture = false;
    let gestureTimer: ReturnType<typeof setTimeout> | undefined;
    let shouldPublish = false;
    const read = (): SharedChartProjection | undefined => {
      const range = chart.timeScale().getVisibleLogicalRange();
      if (!range) return;
      const { times, indices } = calendar();
      const fromUtcMs = chartLogicalToUtc(times, indices, Number(range.from));
      const toUtcMs = chartLogicalToUtc(times, indices, Number(range.to));
      if (fromUtcMs === null || toUtcMs === null || !validViewport({ fromUtcMs, toUtcMs })) return;
      const size = chart.paneSize(0);
      return { width: size.width, height: size.height, barSpacing: chart.timeScale().options().barSpacing,
        viewport: { fromUtcMs, toUtcMs },
        timeToX: time => coordinateForLogical(chart, utcToChartLogical(times, indices, time) ?? undefined),
        priceToY: price => series.priceToCoordinate(price) ?? 0,
        yToPrice: y => series.coordinateToPrice(y),
        xToTime: x => { const logical = logicalForCoordinate(chart, x); return logical === null ? null : chartLogicalToUtc(times, indices, Number(logical)); } };
    };
    const render = () => {
      frame = undefined;
      const projection = read();
      if (!projection) { shouldPublish = false; return; }
      latest.current.onProjectionChange?.(projection);
      if (shouldPublish && !editingRef.current && !remoteRange.current && latest.current.sync.config?.groupId && latest.current.sync.config.syncViewport && !viewportEqual(savedRange.current, projection.viewport)) {
        savedRange.current = projection.viewport;
        latest.current.sync.publish({ viewport: projection.viewport });
      }
      shouldPublish = false;
    };
    const refresh = () => { shouldPublish ||= gesture && !editingRef.current && !remoteRange.current; if (frame === undefined) frame = requestAnimationFrame(render); };
    const start = (event?: Event) => {
      if (editingRef.current || event?.defaultPrevented || (event?.target instanceof Element && event.target.closest("button,input,select,textarea,summary,[role=menu]"))) return;
      gesture = true; if (gestureTimer) clearTimeout(gestureTimer);
    };
    const cancel = () => { gesture = false; shouldPublish = false; if (gestureTimer) clearTimeout(gestureTimer); };
    const end = () => { if (gestureTimer) clearTimeout(gestureTimer); gestureTimer = setTimeout(() => { gesture = false; }, 150); refresh(); };
    const wheel = () => { start(); end(); };
    const move = () => { if (gesture) refresh(); };
    chart.timeScale().subscribeVisibleLogicalRangeChange(refresh);
    const dataChanged = () => { cachedCalendar.current = undefined; refresh(); };
    series.subscribeDataChanged?.(dataChanged);
    container.addEventListener("gc-sync-refresh", refresh);
    container.addEventListener("pointerdown", start, { passive: true });
    container.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", end, { passive: true });
    window.addEventListener("pointercancel", cancel, { passive: true });
    container.addEventListener("wheel", wheel, { passive: true });
    const observer = new ResizeObserver(refresh);
    observer.observe(container);
    refresh();
    return () => { if (frame !== undefined) cancelAnimationFrame(frame); if (gestureTimer) clearTimeout(gestureTimer); observer.disconnect(); chart.timeScale().unsubscribeVisibleLogicalRangeChange(refresh);
      series.unsubscribeDataChanged?.(dataChanged); container.removeEventListener("gc-sync-refresh", refresh);
      container.removeEventListener("pointerdown", start); container.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", cancel); container.removeEventListener("wheel", wheel); };
  }, [chart, series, container, currentEpoch]);

  useEffect(() => {
    const config = sync.config;
    if (!config?.groupId || !config.syncViewport || !config.viewport) return;
    const { times, indices } = calendar();
    const from = utcToChartLogical(times, indices, config.viewport.fromUtcMs), to = utcToChartLogical(times, indices, config.viewport.toUtcMs);
    if (from === null || to === null) return;
    if (viewportEqual(savedRange.current, config.viewport)) return;
    savedRange.current = config.viewport;
    remoteRange.current = true;
    if (remoteFrame.current !== undefined) cancelAnimationFrame(remoteFrame.current);
    chart.timeScale().setVisibleLogicalRange({ from: from as Logical, to: to as Logical } as LogicalRange);
    if (config.viewport.priceRange) series.priceScale().setVisibleRange({ from: config.viewport.priceRange.min, to: config.viewport.priceRange.max });
    container.dispatchEvent(new Event("gc-sync-refresh"));
    // Both native range notifications and the projection RAF are remote work.
    remoteFrame.current = requestAnimationFrame(() => { remoteFrame.current = requestAnimationFrame(() => { remoteRange.current = false; remoteFrame.current = undefined; }); });
    return () => { if (remoteFrame.current !== undefined) cancelAnimationFrame(remoteFrame.current); remoteRange.current = false; };
  }, [chart, series, currentEpoch, sync.config?.revision, sync.config?.viewport, sync.config?.syncViewport, displayTimeOffsetMs]);

  const changeEditing = (value: boolean) => { setEditing(value); editingRef.current = value; if (!value) {
    const cancelled = selectionId.current; selectionId.current = undefined;
    if (cancelled) latest.current.sync.publish({ toolSelection: { selectionId: cancelled, tool: null } });
    manager.current?.cancelInteraction(); setActiveTool(undefined); if (externalPlacement.current) onToolDeselect?.(); externalPlacement.current = false;
  } onEditingChange?.(value); };
  return <div className="shared-chart-sync">
    <div ref={hitRef} className={`shared-chart-sync-hitlayer${editing ? " is-editing" : ""}`} tabIndex={editing ? 0 : -1} aria-label="Shared drawing canvas"
      onPointerDown={() => hitRef.current?.focus()}
      onPointerCancel={() => changeEditing(false)}
      onKeyDown={event => { if (event.key === "Escape") changeEditing(false); }}
      onClick={event => { if (!activeTool) return; const rect = event.currentTarget.getBoundingClientRect(); manager.current?.placeOverlayAnchor({ x: event.clientX - rect.left, y: event.clientY - rect.top }, event.shiftKey); }}
      onPointerMove={event => { if (!activeTool) return; const rect = event.currentTarget.getBoundingClientRect(); manager.current?.previewOverlayAnchor({ x: event.clientX - rect.left, y: event.clientY - rect.top }, event.shiftKey); }} />
    {showDrawingMenu && sync.config?.syncDrawings && !suspendEditing && <details className="shared-chart-draw-menu">
      <summary aria-label="Draw Tool">Draw Tool</summary>
      <div role="menu" aria-label="Draw Tool options">
      {SHARED_DRAWING_TOOLS.map(tool => <button type="button" key={tool} aria-pressed={activeTool === tool}
        onClick={event => { changeEditing(false); changeEditing(true); setActiveTool(tool);
          const id = crypto.randomUUID(); selectionId.current = id;
          manager.current?.startDrawing(tool); hitRef.current?.focus();
          sync.publish({ toolSelection: { selectionId: id, tool } });
          event.currentTarget.closest("details")?.removeAttribute("open");
        }}>{tool === "vertical_line" ? "Vertical Line" : DRAWING_TOOLS.find(t => t.type === tool)?.label}</button>)}
      <button type="button" onClick={() => changeEditing(false)}>Cancel drawing</button>
      <button type="button" onClick={() => { manager.current?.removeSelectedDrawing(); }}>Delete selected drawing</button>
      <button type="button" onClick={() => { changeEditing(false); manager.current?.removeAllDrawings(); }}>Clear drawings</button>
      </div>
    </details>}
  </div>;
}
