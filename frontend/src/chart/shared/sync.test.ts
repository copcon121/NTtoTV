import { describe, expect, it } from "vitest";
import { applyDrawingOperations, fromSharedDrawing, toSharedDrawing, validSharedDrawing, validSyncChange, validViewport, type SharedDrawing } from "./sync";
import { chartLogicalToUtc, logicalToTime, sessionPositionToUtc, timeToLogical, utcToChartLogical, utcToSessionPosition } from "./coordinates";
import { legacySessionPositionToUtc, linkedMarketProfileDrawingPoint } from "../../marketProfile/MarketProfilePage";

const start = Date.UTC(2026, 10, 20);
const drawing: SharedDrawing = { id: "shared-one", tool: "trendline", anchors: [{ utcMs: start, price: 4200 }, { utcMs: start + 300_000, price: 4210 }] };
describe("shared chart canonical coordinates and geometry", () => {
  it("roundtrips UTC anchors through differing display offsets, without logical indices", () => {
    for (const offset of [0, 25_200_000, -18_000_000, 30_000]) {
      const local = fromSharedDrawing(drawing, offset);
      expect(local.anchors[0].time).toBe((start + offset) / 1000);
      expect(local.anchors[0].logical).toBeUndefined();
      expect(toSharedDrawing(local, offset)).toEqual({ ...drawing, options: undefined });
    }
  });
  it("maps one UTC range and fractional anchors across different timeframes and partial coverage", () => {
    const calendars = [[start], [start, start + 60_000, start + 120_000, start + 600_000], [start - 300_000, start, start + 300_000, start + 600_000]];
    for (const times of calendars) for (const time of [start - 180_000, start, start + 90_000, start + 360_000, start + 900_000]) {
      expect(logicalToTime(times, timeToLogical(times, time)!)).toBeCloseTo(time, 3);
    }
    expect(timeToLogical([], start)).toBeNull();
    expect(timeToLogical([start], Infinity)).toBeNull();
  });
  it("uses global logical positions when other chart series add intermediate points", () => {
    const times = [start, start + 60_000, start + 600_000], indices = [2, 4, 7];
    for (const time of [start - 60_000, start + 30_000, start + 330_000, start + 900_000]) {
      const logical = utcToChartLogical(times, indices, time)!;
      expect(chartLogicalToUtc(times, indices, logical)).toBeCloseTo(time, 3);
    }
  });
  it("rejects ambiguous compressed session closes and closed gaps while preserving UTC edges", () => {
    const sessions = [{ start, end: start + 23 * 3_600_000 }, { start: start + 3 * 86_400_000, end: start + 3 * 86_400_000 + 23 * 3_600_000 }];
    expect(utcToSessionPosition(sessions, sessions[0].end)).toBeNull();
    expect(utcToSessionPosition(sessions, sessions[0].end + 1)).toBeNull();
    expect(sessionPositionToUtc(sessions, 1)).toBe(sessions[1].start);
    expect(utcToSessionPosition(sessions, sessions[1].start)).toBe(1);
    for (const position of [0, 0.25, 0.999, 1, 1.5, 2]) {
      expect(utcToSessionPosition(sessions, sessionPositionToUtc(sessions, position)!)).toBeCloseTo(position);
    }
    expect(legacySessionPositionToUtc(sessions, 0.5)).toBe(start + 12 * 3_600_000);
    expect(sessionPositionToUtc(sessions, 0.5)).toBe(start + 11.5 * 3_600_000);
    const point = linkedMarketProfileDrawingPoint(sessions, { xToTime: () => start + 12 * 3_600_000, yToPrice: () => 4200 }, 10, 20)!;
    expect(legacySessionPositionToUtc(sessions, point.x)).toBe(start + 12 * 3_600_000);
    expect(point.price).toBe(4200);
    expect(linkedMarketProfileDrawingPoint(sessions, { xToTime: () => sessions[0].end + 1, yToPrice: () => 4200 }, 10, 20)).toBeNull();
  });
  it("keeps drawing identity through independent upsert/delete operations", () => {
    const changed = { ...drawing, anchors: [{ utcMs: start, price: 4250 }, drawing.anchors[1]] };
    const other = { ...drawing, id: "shared-two" };
    expect(applyDrawingOperations([drawing], [{ op: "upsert", drawing: other }, { op: "upsert", drawing: changed }])).toEqual([changed, other]);
    expect(applyDrawingOperations([changed, other], [{ op: "delete", id: drawing.id }])).toEqual([other]);
    expect(applyDrawingOperations([other], [{ op: "delete", id: drawing.id }])).toEqual([other]);
  });
  it("rejects unsafe coordinates/options and excludes orders, AI/unsupported geometry and lower panes", () => {
    expect(validSharedDrawing(drawing)).toBe(true);
    expect(validSharedDrawing({ ...drawing, tool: "order_bracket" })).toBe(false);
    expect(toSharedDrawing({ ...fromSharedDrawing(drawing), tool: "path" })).toBeUndefined();
    expect(toSharedDrawing({ ...fromSharedDrawing(drawing), paneId: "gc_push_momentum" })).toBeUndefined();
    expect(validSharedDrawing({ ...drawing, anchors: [{ utcMs: NaN, price: 2 }] })).toBe(false);
    expect(validSharedDrawing({ ...drawing, options: { lineColor: "url(unsafe)" } })).toBe(false);
    expect(validSharedDrawing({ ...drawing, options: { automatic: true } })).toBe(false);
    expect(validViewport({ fromUtcMs: 1, toUtcMs: 1 })).toBe(false);
    expect(validSyncChange({ drawingOps: [{ op: "upsert", drawing: { ...drawing, tool: "order_bracket" } }] })).toBe(false);
  });
});
