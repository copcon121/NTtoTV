import { describe, expect, it } from "vitest";

import {
  barDurationForTimeframe,
  barEndForTimeframe,
  countdownBarStartMs,
  formatBarCountdown,
  remainingObservedBarTimeMs,
  remainingBarTimeMs,
  shouldUseObservedBarCountdown,
} from "./barCountdown";

describe("bar countdown", () => {
  it("maps chart timeframes to their bar durations", () => {
    expect(barDurationForTimeframe("15s")).toBe(15_000);
    expect(barDurationForTimeframe("1m")).toBe(60_000);
    expect(barDurationForTimeframe("15m")).toBe(15 * 60_000);
    expect(barDurationForTimeframe("4h")).toBe(4 * 60 * 60_000);
    expect(barDurationForTimeframe("1D")).toBe(24 * 60 * 60_000);
  });

  it("counts down from the current bar close and never goes negative", () => {
    expect(remainingBarTimeMs(120_000, 60_000, 150_250)).toBe(29_750);
    expect(remainingBarTimeMs(120_000, 60_000, 200_000)).toBe(0);
  });

  it("uses GC session opens across leap months and daylight-saving changes", () => {
    expect(barEndForTimeframe(Date.parse("2024-01-31T23:00:00Z"), "1M"))
      .toBe(Date.parse("2024-02-29T23:00:00Z"));
    expect(barEndForTimeframe(Date.parse("2024-02-29T23:00:00Z"), "1M"))
      .toBe(Date.parse("2024-03-31T22:00:00Z"));
    expect(barEndForTimeframe(Date.parse("2024-03-03T23:00:00Z"), "1W"))
      .toBe(Date.parse("2024-03-10T22:00:00Z"));
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

  it("uses an observed countdown when the feed opens a future bar", () => {
    expect(shouldUseObservedBarCountdown(180_000, 60_000, 167_000)).toBe(true);
    expect(remainingObservedBarTimeMs(10_000, 60_000, 10_000)).toBe(60_000);
    expect(remainingObservedBarTimeMs(10_000, 60_000, 13_250)).toBe(56_750);
  });

  it("does not use observed countdown for the local wall-clock bucket", () => {
    expect(shouldUseObservedBarCountdown(120_000, 60_000, 167_000)).toBe(false);
  });

  it("formats intraday and multi-hour countdowns like TradingView", () => {
    expect(formatBarCountdown(42_000)).toBe("00:42");
    expect(formatBarCountdown(60_001)).toBe("01:01");
    expect(formatBarCountdown(3_661_000)).toBe("01:01:01");
  });
});
