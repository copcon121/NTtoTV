import { describe, expect, it } from "vitest";

import {
  formatClockForOffset,
  formatCrosshairTimeForOffset,
  formatTickMarkForOffset,
  formatUtcOffset,
  normalizeTimezoneOffsetMinutes,
} from "./timezone";

describe("timezone formatting", () => {
  it("formats UTC offsets with TradingView-style labels", () => {
    expect(formatUtcOffset(0)).toBe("UTC");
    expect(formatUtcOffset(7 * 60)).toBe("UTC+7");
    expect(formatUtcOffset(-(5 * 60 + 30))).toBe("UTC-5:30");
  });

  it("shifts intraday tick marks by the selected offset", () => {
    const utcTime = Date.UTC(2026, 5, 3, 4, 0, 0) / 1_000;

    expect(formatTickMarkForOffset(utcTime, 7 * 60, "time")).toBe("11:00");
  });

  it("uses the shifted date for day and crosshair labels", () => {
    const utcTime = Date.UTC(2026, 5, 3, 20, 30, 0) / 1_000;

    expect(formatTickMarkForOffset(utcTime, 7 * 60, "day")).toBe("4 Jun");
    expect(formatCrosshairTimeForOffset(utcTime, 7 * 60)).toBe(
      "2026-06-04 03:30 UTC+7",
    );
  });

  it("formats the live clock in the selected offset", () => {
    const nowMs = Date.UTC(2026, 5, 3, 4, 38, 34);

    expect(formatClockForOffset(nowMs, 7 * 60)).toBe("11:38:34");
  });

  it("normalizes invalid and out-of-range offsets", () => {
    expect(normalizeTimezoneOffsetMinutes("420")).toBe(420);
    expect(normalizeTimezoneOffsetMinutes("bad", 0)).toBe(0);
    expect(normalizeTimezoneOffsetMinutes(20 * 60)).toBe(14 * 60);
  });
});
