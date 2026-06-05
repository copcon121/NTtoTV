import { describe, expect, it } from "vitest";

import {
  applyBigTrade,
  applyVolumeDelta,
  bubbleRadius,
  reduceBigTrades,
  reduceVolumeDelta,
  visibleMaxVolume,
} from "./indicatorReducer";

describe("indicatorReducer — VolumeDelta (Req 13, 19.2)", () => {
  it("appends a new bar in time order", () => {
    const out = reduceVolumeDelta(
      [],
      [
        { time: 0, delta: 3 },
        { time: 60000, delta: -2 },
      ],
    );
    expect(out.map((p) => p.time)).toEqual([0, 60000]);
    expect(out.map((p) => p.delta)).toEqual([3, -2]);
  });

  it("overwrites the in-progress bar by time key (last-write-wins)", () => {
    const out = reduceVolumeDelta(
      [],
      [
        { time: 0, delta: 1 },
        { time: 0, delta: 5 },
      ],
    );
    expect(out).toEqual([{ time: 0, delta: 5 }]);
  });

  it("is a no-op when the incoming point is identical", () => {
    const first = applyVolumeDelta([], { time: 0, delta: 3 });
    const second = applyVolumeDelta(first.series, { time: 0, delta: 3 });
    expect(second.kind).toBe("noop");
    expect(second.series).toBe(first.series);
  });

  it("carries cumulativeDelta only when present", () => {
    const out = reduceVolumeDelta([], [{ time: 0, delta: 3, cumulativeDelta: 10 }]);
    expect(out[0].cumulativeDelta).toBe(10);
    const plain = reduceVolumeDelta([], [{ time: 0, delta: 3 }]);
    expect(plain[0].cumulativeDelta).toBeUndefined();
  });

  it("inserts an out-of-order bar in sorted position", () => {
    const out = reduceVolumeDelta(
      [],
      [
        { time: 60000, delta: 1 },
        { time: 0, delta: 2 },
      ],
    );
    expect(out.map((p) => p.time)).toEqual([0, 60000]);
  });
});

describe("indicatorReducer — BigTrade markers (Req 15.4, 15.5)", () => {
  it("appends distinct legacy markers sorted by (time, side)", () => {
    const out = reduceBigTrades(
      [],
      [
        { time: 1000, price: 100.0, volume: 35, side: "buy" },
        { time: 2000, price: 100.1, volume: 40, side: "sell" },
      ],
    );
    expect(out).toHaveLength(2);
    expect(out[0].time).toBe(1000);
    expect(out[1].side).toBe("sell");
  });

  it("overwrites a legacy marker sharing (time, side)", () => {
    const out = reduceBigTrades(
      [],
      [
        { time: 1000, price: 100.0, volume: 35, side: "buy" },
        { time: 1000, price: 100.2, volume: 50, side: "buy" },
      ],
    );
    expect(out).toHaveLength(1);
    expect(out[0].volume).toBe(50);
    expect(out[0].price).toBe(100.2);
  });

  it("keeps same-time same-side markers separate when tradeId differs", () => {
    const out = reduceBigTrades(
      [],
      [
        { tradeId: 1, time: 1000, price: 100.0, volume: 35, side: "buy" },
        { tradeId: 3, time: 1000, price: 100.2, volume: 50, side: "buy" },
      ],
    );
    expect(out).toHaveLength(2);
    expect(out.map((m) => m.tradeId)).toEqual([1, 3]);
  });

  it("keeps opposite sides at the same time as separate markers", () => {
    const out = reduceBigTrades(
      [],
      [
        { time: 1000, price: 100.0, volume: 35, side: "buy" },
        { time: 1000, price: 99.9, volume: 40, side: "sell" },
      ],
    );
    expect(out).toHaveLength(2);
  });

  it("is a no-op when an identical marker repeats", () => {
    const first = applyBigTrade([], { time: 1000, price: 100.0, volume: 35, side: "buy" });
    const second = applyBigTrade(first.markers, {
      time: 1000,
      price: 100.0,
      volume: 35,
      side: "buy",
    });
    expect(second.kind).toBe("noop");
    expect(second.markers).toBe(first.markers);
  });
});

describe("indicatorReducer — bubble sizing (Req 15.5)", () => {
  it("scales radius to the visible max volume", () => {
    expect(bubbleRadius(50, 50, 4, 24)).toBe(24); // max volume -> max radius
    expect(bubbleRadius(0, 50, 4, 24)).toBe(4); // zero -> min radius
    expect(bubbleRadius(25, 50, 4, 24)).toBe(14); // half -> midpoint
  });

  it("returns min radius when there is no visible volume", () => {
    expect(bubbleRadius(10, 0)).toBe(4);
  });

  it("computes the visible max within a time range", () => {
    const markers = reduceBigTrades(
      [],
      [
        { time: 1000, price: 1, volume: 35, side: "buy" },
        { time: 2000, price: 1, volume: 80, side: "buy" },
        { time: 9000, price: 1, volume: 200, side: "buy" },
      ],
    );
    expect(visibleMaxVolume(markers, 1000, 5000)).toBe(80);
  });
});
