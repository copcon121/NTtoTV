import * as fc from "fast-check";
import { expect } from "vitest";

import { type FootprintUpdateMessage } from "../socket/messages";
import {
  FOOTPRINT_DISPLAY_COUNT,
  mergeFootprint,
  selectDisplayBars,
} from "./footprintModel";
import { propertyTest } from "../test/property";

// Feature: gc-chart-platform, Property 19: Footprint display selects exactly the last 5 M1 bars
//
// Validates: Requirements 14.2
//
// For any sequence of footprint_update events (one minute apart, arriving in
// arbitrary order, possibly re-updating an in-progress bar), the displayed set
// is exactly the (up to) last 5 distinct M1 bars by time, in ascending time
// order — never more than 5, never an older bar when a newer one exists.

function fp(time: number, poc: number): FootprintUpdateMessage {
  return {
    type: "footprint_update",
    symbol: "GC",
    contract: "GC 08-26",
    tf: "1m",
    time,
    rows: [{ price: poc, bid: 1, ask: 1, imbalance: null }],
    open: poc,
    high: poc,
    low: poc,
    close: poc,
    poc,
    pocVolume: 2,
    vah: poc,
    val: poc,
    barDelta: 0,
    buyPct: 0.5,
    sellPct: 0.5,
    stackedImbalance: [],
    unfinishedAuction: { high: false, low: false },
  };
}

const MINUTE = 60000;

propertyTest(
  19,
  "Footprint display selects exactly the last 5 M1 bars",
  () => {
    fc.assert(
      fc.property(
        // A set of distinct minute indices (the bar times), shuffled, each with
        // a poc value so re-updates of the same minute are exercised.
        fc.array(
          fc.tuple(fc.nat({ max: 30 }), fc.integer({ min: 1, max: 100 })),
          { maxLength: 40 },
        ),
        (events) => {
          let bars = new Map<number, FootprintUpdateMessage>();
          const seenMinutes = new Set<number>();
          for (const [minute, poc] of events) {
            seenMinutes.add(minute);
            bars = mergeFootprint(bars, fp(minute * MINUTE, poc));
          }

          const display = selectDisplayBars(bars);
          const distinct = [...seenMinutes].sort((a, b) => a - b);

          // (a) Never more than 5 displayed.
          expect(display.length).toBeLessThanOrEqual(FOOTPRINT_DISPLAY_COUNT);
          // (b) Exactly min(distinct, 5).
          expect(display.length).toBe(
            Math.min(distinct.length, FOOTPRINT_DISPLAY_COUNT),
          );
          // (c) Ascending by time.
          for (let i = 1; i < display.length; i++) {
            expect(display[i].time).toBeGreaterThan(display[i - 1].time);
          }
          // (d) Exactly the most-recent distinct minutes.
          const expectedTimes = distinct
            .slice(Math.max(0, distinct.length - FOOTPRINT_DISPLAY_COUNT))
            .map((m) => m * MINUTE);
          expect(display.map((b) => b.time)).toEqual(expectedTimes);
        },
      ),
    );
  },
);
