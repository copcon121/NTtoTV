import type { UTCTimestamp } from "lightweight-charts";

import type { AiScanCandidate } from "../api/client";
import type { DrawingState } from "../chart/drawings/types";
import { displayOffsetForTimeframe } from "../chart/timeframeRange";
import type { Timeframe } from "../socket/messages";
import { scanDrawingId } from "../chart/scanAi/geometry";

export function scanDrawing(
  candidate: AiScanCandidate | any,
  timeframe: Timeframe,
  color: string,
  preview = false,
): DrawingState {
  const anchors = (candidate.anchors ?? []).map(({ time, price }: any) => {
    // If time is already in seconds (<= 1e11), use it directly; if in ms, convert
    const tSec = time > 1e11 ? time / 1000 : time;
    return {
      time: Math.round(tSec + displayOffsetForTimeframe(timeframe) / 1000) as UTCTimestamp,
      price,
    };
  });

  const opts = candidate.options ?? {};
  const options: DrawingState["options"] = {
    lineColor: opts.lineColor ?? (opts as any).color ?? color,
    lineWidth: preview ? 1 : opts.lineWidth ?? 2,
    lineStyle: preview ? "dashed" : opts.lineStyle ?? "solid",
    fillColor: opts.fillColor ?? (opts as any).fill,
  };

  let tool: DrawingState["tool"] = "trendline";

  if (candidate.drawingTool) {
    tool = candidate.drawingTool;
    if (candidate.drawingTool === "path") {
      options.anchorLabels = opts.anchorLabels ?? (candidate.group === "elliott" ? anchors.map((_: any, index: number) => String(index)) : []);
    } else if (candidate.drawingTool === "fib_retracement") {
      options.fibDirectional = true;
      options.fibExtendRight = false;
      options.fibLevels = [0, 0.382, 0.5, 0.618, 1].map((value) => ({
        value,
        color: options.lineColor ?? color,
        enabled: true,
      }));
    }
  } else if (candidate.type === "elliott_wave" || candidate.group === "elliott") {
    tool = "path";
    options.anchorLabels = opts.anchorLabels ?? anchors.map((_: any, index: number) => String(index));
  } else if (candidate.type?.startsWith("fibonacci")) {
    tool = "fib_retracement";
    const extension = candidate.type === "fibonacci_extension";
    options.fibDirectional = true;
    options.fibExtendRight = extension;
    options.fibLevels = (extension ? [1, 1.272, 1.618, 2, 2.618] : [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]).map(
      (value) => ({ value, color: options.lineColor ?? color, enabled: true }),
    );
  }

  if (preview) options.lineStyle = "dashed";

  return {
    sourceTimeframe: timeframe,
    id: preview ? "scan-preview" : scanDrawingId({ drawingTool: tool as "trendline", anchors }, timeframe),
    tool,
    anchors,
    options,
  };
}
