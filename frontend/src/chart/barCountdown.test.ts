import { describe, expect, it } from "vitest";

import {
  barDurationForTimeframe,
  countdownBarStartMs,
  formatBarCountdown,
  remainingBarTimeMs,
} from "./barCountdown";

describe("bar countdown", () => {
  it("maps chart timeframes to their bar durations", () => {
    expect(barDurationForTimeframe("1m")).toBe(60_000);
    expect(barDurationForTimeframe("15m")).toBe(15 * 60_000);
    expect(barDurationForTimeframe("4h")).toBe(4 * 60 * 60_000);
    expect(barDurationForTimeframe("1D")).toBe(24 * 60 * 60_000);
  });

  it("counts down from the current bar close and never goes negative", () => {
    expect(remainingBarTimeMs(120_000, 60_000, 150_250)).toBe(29_750);
    expect(remainingBarTimeMs(120_000, 60_000, 200_000)).toBe(0);
  });

  it("keeps counting against the wall-clock bucket when the last trade bar is stale", () => {
    expect(countdownBarStartMs(120_000, 60_000, 200_000)).toBe(180_000);
    expect(
      remainingBarTimeMs(
        countdownBarStartMs(120_000, 60_000, 200_000),
        60_000,
        200_000,
      ),
    ).toBe(40_000);
  });

  it("formats intraday and multi-hour countdowns like TradingView", () => {
    expect(formatBarCountdown(42_000)).toBe("00:42");
    expect(formatBarCountdown(60_001)).toBe("01:01");
    expect(formatBarCountdown(3_661_000)).toBe("01:01:01");
  });
});
