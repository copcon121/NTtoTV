import { describe, expect, it } from "vitest";

import fixture from "../../../test-fixtures/sweep_reversal_golden.json";
import { computeSweepReversalOverlay } from "./sweepReversal";

describe("Sweep Reversal golden parity", () => {
  it("ignores wick-only breaches and confirms only after close reclaim + structure", () => {
    const beforeCloseThrough = fixture.bars.filter(
      (bar) => bar.time <= fixture.expected.wickOnlyBarTime,
    );
    expect(computeSweepReversalOverlay(beforeCloseThrough, fixture.settings).setups).toEqual([]);

    const developing = computeSweepReversalOverlay(
      fixture.bars.filter((bar) => bar.time <= fixture.expected.developingTime),
      fixture.settings,
    );
    expect(developing.setups).toHaveLength(1);
    expect(developing.setups[0]).toMatchObject({
      phase: "developing",
      direction: fixture.expected.direction,
      sweepTime: fixture.expected.developingTime,
      level: fixture.expected.level,
    });

    const confirmed = computeSweepReversalOverlay(fixture.bars, fixture.settings);
    expect(confirmed.setups).toHaveLength(1);
    expect(confirmed.setups[0]).toMatchObject({
      phase: "confirmed",
      direction: fixture.expected.direction,
      level: fixture.expected.level,
      confirmationLevel: fixture.expected.confirmationLevel,
      pivotTimes: fixture.expected.pivotTimes,
      confirmedTime: fixture.expected.confirmationTime,
      endTime: fixture.expected.confirmedEndTime,
    });
  });

  it("hides developing objects without disabling detection", () => {
    const overlay = computeSweepReversalOverlay(
      fixture.bars.filter((bar) => bar.time <= fixture.expected.developingTime),
      { ...fixture.settings, showDeveloping: false },
    );
    expect(overlay.setups).toEqual([]);
    expect(overlay.events.some((event) => event.phase === "developing")).toBe(true);
  });

  it("does not look ahead when replay is cut before pivot confirmation", () => {
    const cutoff = fixture.bars.slice(0, 4);
    expect(computeSweepReversalOverlay(cutoff, fixture.settings).events).toEqual([]);
  });

  it("uses the complete consecutive ATR cluster and stops at the first outlier", () => {
    const highs = [10, 11, 14, 10, 9, 10, 12, 10, 9, 10, 12.1, 10, 9, 10, 11.9, 10, 9];
    const bars = highs.map((price, index) => ({
      time: index * 60_000,
      open: price - 0.2,
      high: price,
      low: price - 2,
      close: price - 0.5,
      volume: 1,
    }));
    bars.push({ time: bars.length * 60_000, open: 12, high: 14, low: 11.8, close: 13.1, volume: 1 });
    const overlay = computeSweepReversalOverlay(bars, {
      ...fixture.settings,
      equalSwingFilter: true,
      liquidityAtrMargin: 4,
    });
    expect(overlay.setups).toHaveLength(1);
    expect(overlay.setups[0].phase).toBe("developing");
    expect(overlay.setups[0].pivotTimes).toEqual([360_000, 600_000, 840_000]);
    expect(overlay.setups[0].pivotPrices).toEqual([12, 12.1, 11.9]);
  });
});
