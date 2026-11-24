import type { DrawingState } from "../drawings/types";
import type { ScanAiSuggestion } from "./types";
import { SCAN_GROUPS } from "./settings";

type Geometry = Pick<ScanAiSuggestion, "drawingTool" | "anchors">;
export function geometryKey(suggestion: Geometry): string {
  const anchors = suggestion.drawingTool === "horizontal_ray" ? suggestion.anchors.slice(0, 1) : suggestion.anchors;
  return suggestion.drawingTool + ":" + anchors.map(a =>
    `${suggestion.drawingTool === "horizontal_ray" ? "" : Math.round(a.time)}:${Math.round(a.price * 10)}`
  ).join("|");
}
export function scanDrawingId(suggestion: Geometry, timeframe: string): string {
  const value = timeframe + ":" + geometryKey(suggestion);
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return `ai_${suggestion.drawingTool}_${(hash >>> 0).toString(16)}`;
}
export function similarScanGeometry(a: Geometry, b: Geometry): boolean {
  if (a.drawingTool !== b.drawingTool) return false;
  if (a.drawingTool === "horizontal_ray") return Math.abs(a.anchors[0].price - b.anchors[0].price) <= 0.5;
  if (a.drawingTool === "trendline" && a.anchors.length >= 2 && b.anchors.length >= 2) {
    const aa = [...a.anchors.slice(0, 2)].sort((x, y) => x.time - y.time);
    const bb = [...b.anchors.slice(0, 2)].sort((x, y) => x.time - y.time);
    const span = Math.min(aa[1].time - aa[0].time, bb[1].time - bb[0].time);
    const start = Math.max(aa[0].time, bb[0].time), end = Math.min(aa[1].time, bb[1].time);
    if (span <= 0 || end - start < span * 0.5) return false;
    const at = (points: typeof aa, t: number) => points[0].price + (points[1].price - points[0].price) * (t - points[0].time) / (points[1].time - points[0].time);
    return [start, end].every(t => Math.abs(at(aa, t) - at(bb, t)) <= 0.5);
  }
  if (a.anchors.length !== b.anchors.length) return false;
  const all = [...a.anchors, ...b.anchors];
  const span = Math.max(...all.map(p => p.time)) - Math.min(...all.map(p => p.time));
  const amplitude = Math.max(...all.map(p => p.price)) - Math.min(...all.map(p => p.price));
  return a.anchors.every((p, i) => Math.abs(p.time - b.anchors[i].time) <= Math.max(1, span * 0.1)
    && Math.abs(p.price - b.anchors[i].price) <= Math.max(0.5, amplitude * 0.06));
}
export function alreadyDrawn(suggestion: ScanAiSuggestion, drawings: readonly DrawingState[], timeframe: string): boolean {
  return drawings.some(d => d.sourceTimeframe === timeframe && similarScanGeometry(suggestion, {
    drawingTool: d.tool as ScanAiSuggestion["drawingTool"],
    anchors: d.anchors.map(a => ({ time: Number(a.time), price: a.price })),
  }));
}
export function prepareSuggestions(raw: readonly any[], cap = 12): ScanAiSuggestion[] {
  const list = raw.map(s => ({
    ...s, label: s.label ?? s.name ?? s.type ?? "Suggestion",
    drawingTool: s.drawingTool === "horizontal_line" ? "horizontal_ray" : s.drawingTool,
    anchors: s.anchors ?? [], metrics: s.metrics ?? {},
    options: { ...s.options, lineColor: s.options?.lineColor ?? s.options?.color ?? (s.group === "levels" ? "#22c55e" : "#38bdf8"),
      fillColor: s.options?.fillColor ?? s.options?.fill, lineWidth: s.options?.lineWidth ?? 2, lineStyle: s.options?.lineStyle ?? "solid" },
  })).filter(s => SCAN_GROUPS.includes(s.group)
    && ["horizontal_ray", "trendline", "fib_retracement", "path"].includes(s.drawingTool)
    && s.anchors.length >= (s.drawingTool === "horizontal_ray" ? 1 : 2)
    && s.anchors.every((a: any) => Number.isFinite(a.time) && a.time > 0 && Number.isFinite(a.price)));
  const rank: Record<string, number> = { in_play: 3, waiting: 2, tested: 1 };
  list.sort((a, b) => (rank[b.state] ?? 0) - (rank[a.state] ?? 0) || b.score - a.score);
  const result: ScanAiSuggestion[] = [];
  for (const s of list) {
    if (!result.some(kept => similarScanGeometry(s, kept))) result.push(s);
    if (result.length >= cap) break;
  }
  return result;
}
