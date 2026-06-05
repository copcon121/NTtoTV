import { describe, expect, it } from "vitest";

import {
  type BarSeries,
  type ChartSeriesPort,
  ChartSeriesController,
} from "./index";
import { type Bar } from "../cache/types";

function bar(time: number, close = time, volume = 1): Bar {
  return { time, open: close, high: close, low: close, close, volume };
}

/** A fake port that records the sequence of render calls for assertions. */
class RecordingPort implements ChartSeriesPort {
  setBarsCalls: BarSeries[] = [];
  updateBarCalls: Bar[] = [];

  setBars(bars: BarSeries): void {
    // store a copy of the times to detect full-replacements precisely
    this.setBarsCalls.push(bars.slice());
  }

  updateBar(bar: Bar): void {
    this.updateBarCalls.push({ ...bar });
  }
}

describe("ChartSeriesController", () => {
  it("performs exactly one bulk setBars on initial load", () => {
    const port = new RecordingPort();
    const controller = new ChartSeriesController(port);
    controller.load([bar(30), bar(10), bar(20)]);

    expect(port.setBarsCalls).toHaveLength(1);
    expect(port.setBarsCalls[0].map((b) => b.time)).toEqual([10, 20, 30]);
    expect(controller.isLoaded).toBe(true);
  });

  it("applies realtime updates incrementally with updateBar, never another setBars", () => {
    const port = new RecordingPort();
    const controller = new ChartSeriesController(port);
    controller.load([bar(10), bar(20)]);

    controller.apply(bar(30)); // append
    controller.apply(bar(30, 99)); // overwrite in-progress bar

    expect(port.setBarsCalls).toHaveLength(1); // no full replacement on updates
    expect(port.updateBarCalls.map((b) => b.time)).toEqual([30, 30]);
    expect(port.updateBarCalls[1].close).toBe(99);
    expect(controller.bars.map((b) => b.time)).toEqual([10, 20, 30]);
    expect(controller.bars.find((b) => b.time === 30)?.close).toBe(99);
  });

  it("does not call the port when an update leaves the series unchanged (Req 12.4)", () => {
    const port = new RecordingPort();
    const controller = new ChartSeriesController(port);
    controller.load([bar(10), bar(20)]);

    const outcome = controller.apply(bar(20)); // identical to existing

    expect(outcome.kind).toBe("noop");
    expect(outcome.rendered).toBe(false);
    expect(port.updateBarCalls).toHaveLength(0);
  });

  it("seeds the series with a bulk load when an update arrives before history", () => {
    const port = new RecordingPort();
    const controller = new ChartSeriesController(port);

    const outcome = controller.apply(bar(10));

    expect(outcome.rendered).toBe(true);
    expect(port.setBarsCalls).toHaveLength(1);
    expect(port.updateBarCalls).toHaveLength(0);
    expect(controller.bars.map((b) => b.time)).toEqual([10]);
  });

  it("re-bulk-loads on load() again (series identity change is an allowed repaint)", () => {
    const port = new RecordingPort();
    const controller = new ChartSeriesController(port);
    controller.load([bar(10)]);
    controller.apply(bar(20));
    controller.load([bar(100), bar(200)]);

    expect(port.setBarsCalls).toHaveLength(2);
    expect(port.setBarsCalls[1].map((b) => b.time)).toEqual([100, 200]);
    expect(controller.bars.map((b) => b.time)).toEqual([100, 200]);
  });

  it("applyAll returns an outcome per bar in order", () => {
    const port = new RecordingPort();
    const controller = new ChartSeriesController(port);
    controller.load([bar(10)]);

    const outcomes = controller.applyAll([bar(20), bar(20), bar(20, 5)]);
    expect(outcomes.map((o) => o.kind)).toEqual(["append", "noop", "overwrite"]);
    expect(outcomes.map((o) => o.rendered)).toEqual([true, false, true]);
  });
});
