import * as fc from "fast-check";
import { expect } from "vitest";

import {
  type BarApplicationKind,
  type BarSeries,
  reduceBars,
} from "./barReducer";
import {
  ChartSeriesController,
  type ChartSeriesPort,
} from "./chartSeriesController";
import { normalizeBars } from "../cache/memoryCache";
import { type Bar } from "../cache/types";
import { propertyTest } from "../test/property";

// Feature: gc-chart-platform, Property 22: Incremental bar updates merge without
// full replacement
//
// Validates: Requirements 11.3
//
// For any initial bar series and any sequence of `bar_update` events (new bars
// + in-progress overwrites arriving in non-decreasing time order), applying the
// updates incrementally yields a series identical to the expected merge — new
// bars appended in time order, in-progress bars overwritten by time key, no
// duplicate times, sorted ascending, latest value per time key — with NO
// full-data-replacement (`setBars`) performed on any realtime update.

/**
 * Build a bar at `time` whose OHLCV fields all derive from `value`, so that two
 * bars at the same time are byte-equal iff their `value` matches. This lets the
 * generator produce both genuine overwrites (different value) and no-op repeats
 * (same value) at a given time key.
 */
function makeBar(time: number, value: number): Bar {
  return {
    time,
    open: value,
    high: value + 1,
    low: value - 1,
    close: value,
    volume: value,
  };
}

/**
 * A fake {@link ChartSeriesPort} that records how it was driven. `setBars` is a
 * full-data (bulk) load; `updateBar` is an incremental single-bar update. The
 * counts let the property assert that no realtime update triggered a full
 * replacement (Req 11.3).
 */
class RecordingPort implements ChartSeriesPort {
  setBarsCalls = 0;
  updateBarCalls = 0;

  setBars(_bars: BarSeries): void {
    this.setBarsCalls += 1;
  }

  updateBar(_bar: Bar): void {
    this.updateBarCalls += 1;
  }
}

const valueArb = fc.integer({ min: -50, max: 50 });

/** Arbitrary (possibly empty, possibly unsorted, possibly duplicate-time) initial series. */
const initialArb: fc.Arbitrary<Bar[]> = fc
  .array(fc.tuple(fc.integer({ min: 0, max: 50 }), valueArb), { maxLength: 8 })
  .map((pairs) => pairs.map(([t, v]) => makeBar(t, v)));

/**
 * A realtime scenario: an initial series plus a stream of `bar_update` events
 * whose times are NON-DECREASING and begin at or after the last initial bar
 * time. Each step's gap is >= 0: a gap of 0 overwrites the current in-progress
 * (last) bar; a positive gap opens (appends) a new bar. This is exactly the
 * append/overwrite domain Property 22 describes — never an out-of-order insert.
 */
const scenarioArb = initialArb.chain((initial) => {
  const normalized = normalizeBars(initial);
  const lastTime = normalized.length ? normalized[normalized.length - 1].time : 0;
  return fc
    .array(fc.tuple(fc.nat({ max: 3 }), valueArb), { maxLength: 20 })
    .map((steps) => {
      const updates: Bar[] = [];
      let t = lastTime;
      for (const [gap, value] of steps) {
        t += gap;
        updates.push(makeBar(t, value));
      }
      return { initial, updates };
    });
});

propertyTest(
  22,
  "Incremental bar updates merge without full replacement",
  () => {
    fc.assert(
      fc.property(scenarioArb, ({ initial, updates }) => {
        const port = new RecordingPort();
        const controller = new ChartSeriesController(port);

        // The single allowed bulk load: initial history render (Req 11.3 permits
        // one full load for the initial series).
        controller.load(initial);
        expect(port.setBarsCalls).toBe(1);

        const outcomes = controller.applyAll(updates);

        // (a) No full-data replacement on any realtime update: `setBars` was
        //     called exactly once (the initial load) and never again.
        expect(port.setBarsCalls).toBe(1);

        // (b) Every realtime update is an append (new bar in time order) or an
        //     overwrite of the in-progress bar by time key — never an
        //     out-of-order insert (times are non-decreasing and start at the
        //     last initial time).
        const kinds: BarApplicationKind[] = outcomes.map((o) => o.kind);
        for (const kind of kinds) {
          expect(kind).not.toBe("insert");
        }

        // (c) Each non-noop update issued exactly one incremental `updateBar`;
        //     identical-bar repeats are no-ops that issue no render call.
        const nonNoopCount = outcomes.filter((o) => o.kind !== "noop").length;
        expect(port.updateBarCalls).toBe(nonNoopCount);

        const series = controller.bars;

        // (d) Resulting series is sorted strictly ascending => no duplicate times.
        for (let i = 1; i < series.length; i += 1) {
          expect(series[i].time).toBeGreaterThan(series[i - 1].time);
        }

        // (e) The incrementally-merged series equals the expected full merge
        //     (last-write-wins by time) and the pure reducer fold.
        const expected = normalizeBars([...normalizeBars(initial), ...updates]);
        expect(series).toEqual(expected);
        expect(series).toEqual(reduceBars(initial, updates));

        // (f) Latest value per time key wins: the bar at each time equals the
        //     last initial-or-update bar carrying that time.
        const latestByTime = new Map<number, Bar>();
        for (const b of normalizeBars(initial)) {
          latestByTime.set(b.time, b);
        }
        for (const b of updates) {
          latestByTime.set(b.time, b);
        }
        for (const b of series) {
          expect(b).toEqual(latestByTime.get(b.time));
        }
      }),
    );
  },
);
