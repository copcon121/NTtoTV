import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FootprintResponse } from "../api/client";
import type { Bar } from "../socket/messages";
import type { FootprintBar } from "./footprintModel";
import { aggregateChartFootprint, useChartFootprint } from "./useChartFootprint";

const minute = 60_000;
function ladder(time: number, bid = 2, ask = 5): FootprintBar {
  return {
    type: "footprint_update", symbol: "GC", contract: "GC", tf: "1m", time,
    open: 100, high: 100.1, low: 100, close: 100.1,
    rows: [{ price: 100.1, bid, ask, imbalance: null }],
    poc: 100.1, pocVolume: bid + ask, vah: 100.1, val: 100.1,
    barDelta: ask - bid, buyPct: ask / (bid + ask), sellPct: bid / (bid + ask),
    stackedImbalance: [], unfinishedAuction: { high: true, low: true },
  };
}
const candle = (time: number): Bar => ({ time, open: 100, high: 101, low: 99, close: 100.5, volume: 30 });
const response = (bars: FootprintBar[]): FootprintResponse => ({ symbol: "GC", contract: "GC", tf: "1m", bars });
const empty = new Map<number, FootprintBar>();

describe("chart footprint aggregation", () => {
  it("sums M1 price ladders at actual chart anchors without filling missing candles", () => {
    const source = new Map([0, minute, 2 * minute, 10 * minute].map((time) => [time, ladder(time)]));
    const result = aggregateChartFootprint(source, [candle(0), candle(5 * minute)], "5m");
    expect([...result.keys()]).toEqual([0]);
    expect(result.get(0)).toMatchObject({ time: 0, tf: "5m", open: 100, high: 101, low: 99, close: 100.5,
      rows: [{ price: 100.1, bid: 6, ask: 15 }], barDelta: 9, pocVolume: 21 });
  });

  it("does not split M1 ladders into seconds bars", () => {
    expect(aggregateChartFootprint(new Map([[0, ladder(0)]]), [candle(0)], "30s").size).toBe(0);
  });

  it("keeps the next session's ladder out of a daily bar shortened by DST", () => {
    const firstDay = Date.parse("2026-03-07T23:00:00Z");
    const nextDay = Date.parse("2026-03-08T22:00:00Z");
    const source = new Map([
      [nextDay - minute, ladder(nextDay - minute, 2, 4)],
      [nextDay, ladder(nextDay, 10, 20)],
    ]);
    const result = aggregateChartFootprint(source, [candle(firstDay), candle(nextDay)], "1D");
    expect(result.get(firstDay)?.rows[0]).toMatchObject({ bid: 2, ask: 4 });
    expect(result.get(nextDay)?.rows[0]).toMatchObject({ bid: 10, ask: 20 });
  });
});

describe("visible chart footprint history", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { cleanup(); vi.useRealTimers(); });
  const base = { symbol: "GC", contract: "GC", timeframe: "1m" as const,
    bars: [candle(0), candle(minute)], range: { from: 0, to: 2 * minute - 1 },
    liveBars: empty, enabled: true, suspendRealtime: false };

  it("debounces bounded history and cancels a stale range response", async () => {
    const resolvers: Array<(value: FootprintResponse) => void> = [];
    const api = { footprintDetails: vi.fn(() => new Promise<FootprintResponse>((resolve) => resolvers.push(resolve))) };
    const { result, rerender } = renderHook((range) => useChartFootprint({ ...base, range, api }), { initialProps: base.range });
    await act(async () => vi.advanceTimersByTime(200));
    expect(api.footprintDetails).toHaveBeenCalledWith("GC", "GC", { from: 0, to: 2 * minute - 1 });
    rerender({ from: minute, to: 2 * minute - 1 });
    await act(async () => vi.advanceTimersByTime(200));
    await act(async () => resolvers[0](response([ladder(0)])));
    expect(result.current.bars.size).toBe(0);
    await act(async () => resolvers[1](response([ladder(minute)])));
    expect([...result.current.bars.keys()]).toEqual([minute]);
  });

  it("lets fresh REST replace the old live snapshot while preserving newer live updates", async () => {
    let finish!: (value: FootprintResponse) => void;
    const api = { footprintDetails: vi.fn(() => new Promise<FootprintResponse>((resolve) => { finish = resolve; })) };
    const stale = new Map([[0, ladder(0, 1, 1)], [minute, ladder(minute, 1, 1)]]);
    const { result, rerender } = renderHook((liveBars) => useChartFootprint({ ...base, api, liveBars }), { initialProps: stale });
    await act(async () => vi.advanceTimersByTime(200));
    const live = new Map(stale).set(minute, ladder(minute, 10, 20));
    rerender(live);
    await act(async () => finish(response([ladder(0, 4, 5), ladder(minute, 2, 3)])));
    expect(result.current.bars.get(0)?.rows[0]).toMatchObject({ bid: 4, ask: 5 });
    expect(result.current.bars.get(minute)?.rows[0]).toMatchObject({ bid: 10, ask: 20 });
  });

  it("uses supplied replay ladders without requesting future history", async () => {
    const api = { footprintDetails: vi.fn(async () => response([ladder(minute)])) };
    const { result } = renderHook(() => useChartFootprint({ ...base, api, suspendRealtime: true,
      bars: [candle(0)], range: { from: 0, to: minute - 1 }, liveBars: new Map([[0, ladder(0)], [minute, ladder(minute)]]) }));
    await act(async () => vi.advanceTimersByTime(500));
    expect(api.footprintDetails).not.toHaveBeenCalled();
    expect([...result.current.bars.keys()]).toEqual([0]);
  });

  it("does not apply the network request cap to already-supplied replay ladders", () => {
    const api = { footprintDetails: vi.fn(async () => response([])) };
    const { result } = renderHook(() => useChartFootprint({ ...base, api, suspendRealtime: true,
      timeframe: "1W", bars: [candle(0)], range: { from: 0, to: 7 * 24 * 60 * minute - 1 },
      liveBars: new Map([[0, ladder(0)]]) }));
    expect(result.current.bars.size).toBe(1);
    expect(result.current.error).toBeUndefined();
    expect(api.footprintDetails).not.toHaveBeenCalled();
  });

  it("reports an oversized minute range without fetching a truncated ladder", async () => {
    const api = { footprintDetails: vi.fn(async () => response([])) };
    const { result } = renderHook(() => useChartFootprint({ ...base, api, range: { from: 0, to: 5001 * minute } }));
    await act(async () => vi.advanceTimersByTime(500));
    expect(api.footprintDetails).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/5000 M1/);
    expect(result.current.bars.size).toBe(0);
  });
});
