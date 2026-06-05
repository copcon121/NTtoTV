import { describe, expect, it } from "vitest";

import { type FootprintUpdateMessage } from "../socket/messages";
import {
  FOOTPRINT_DISPLAY_COUNT,
  type FootprintViewport,
  mergeFootprint,
  selectDisplayBars,
  shouldRedraw,
} from "./footprintModel";

function fp(time: number, poc = 100.1): FootprintUpdateMessage {
  return {
    type: "footprint_update",
    symbol: "GC",
    contract: "GC 08-26",
    tf: "1m",
    time,
    rows: [
      { price: 100.1, bid: 2, ask: 7, imbalance: "ask" },
      { price: 100.0, bid: 4, ask: 0, imbalance: null },
    ],
    open: 100.0,
    high: 100.1,
    low: 100.0,
    close: 100.1,
    poc,
    pocVolume: 9,
    vah: 100.1,
    val: 100.0,
    barDelta: 5,
    buyPct: 0.6,
    sellPct: 0.4,
    stackedImbalance: [],
    unfinishedAuction: { high: false, low: true },
  };
}

function viewport(width = 300, height = 200): FootprintViewport {
  return { priceToY: (p) => p, width, height };
}

describe("footprintModel — merge + select (Req 14.2)", () => {
  it("merges bars by time (last-write-wins)", () => {
    let bars = new Map<number, FootprintUpdateMessage>();
    bars = mergeFootprint(bars, fp(0, 100.1));
    bars = mergeFootprint(bars, fp(0, 100.2)); // same time -> overwrite
    expect(bars.size).toBe(1);
    expect(bars.get(0)?.poc).toBe(100.2);
  });

  it("selects exactly the last 5 bars by time, ascending", () => {
    let bars = new Map<number, FootprintUpdateMessage>();
    for (const t of [0, 60000, 120000, 180000, 240000, 300000]) {
      bars = mergeFootprint(bars, fp(t));
    }
    const display = selectDisplayBars(bars);
    expect(display).toHaveLength(FOOTPRINT_DISPLAY_COUNT);
    expect(display.map((b) => b.time)).toEqual([
      60000,
      120000,
      180000,
      240000,
      300000,
    ]);
  });

  it("returns all bars when fewer than 5 exist", () => {
    let bars = new Map<number, FootprintUpdateMessage>();
    bars = mergeFootprint(bars, fp(0));
    bars = mergeFootprint(bars, fp(60000));
    expect(selectDisplayBars(bars)).toHaveLength(2);
  });
});

describe("footprintModel — redraw decision (Req 14.6, 14.7)", () => {
  it("redraws on first render", () => {
    expect(shouldRedraw(null, { bars: [fp(0)], viewport: viewport() })).toBe(true);
  });

  it("retains rendering when nothing changed (same bar objects + viewport)", () => {
    const vp = viewport();
    const bar = fp(0);
    const prev = { bars: [bar], viewport: vp };
    const next = { bars: [bar], viewport: vp };
    expect(shouldRedraw(prev, next)).toBe(false);
  });

  it("redraws when the price scale mapping changes", () => {
    const bar = fp(0);
    const prev = { bars: [bar], viewport: viewport() };
    const next = { bars: [bar], viewport: viewport() }; // new priceToY identity
    expect(shouldRedraw(prev, next)).toBe(true);
  });

  it("redraws when the layout size changes", () => {
    const vp = viewport();
    const bar = fp(0);
    const prev = { bars: [bar], viewport: vp };
    const next = { bars: [bar], viewport: { ...vp, width: 400 } };
    expect(shouldRedraw(prev, next)).toBe(true);
  });

  it("redraws when a displayed bar's data changes", () => {
    const vp = viewport();
    const prev = { bars: [fp(0, 100.1)], viewport: vp };
    const next = { bars: [fp(0, 100.2)], viewport: vp };
    expect(shouldRedraw(prev, next)).toBe(true);
  });
});
