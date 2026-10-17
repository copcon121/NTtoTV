import { describe, expect, it } from "vitest";

import {
  floorToMinuteMs,
  footprintSessionStartMs,
  parseFootprintSearchTime,
} from "./timeSearch";

describe("footprintSessionStartMs", () => {
  it("uses 05:00 UTC+7 for the current session", () => {
    expect(footprintSessionStartMs(new Date("2026-07-01T00:00:00.000Z"))).toBe(
      Date.parse("2026-06-30T22:00:00.000Z"),
    );
  });

  it("uses the previous day before the UTC+7 session boundary", () => {
    expect(footprintSessionStartMs(new Date("2026-06-30T21:59:00.000Z"))).toBe(
      Date.parse("2026-06-29T22:00:00.000Z"),
    );
  });

  it("switches sessions exactly at 05:00 UTC+7", () => {
    expect(footprintSessionStartMs(new Date("2026-06-30T22:00:00.000Z"))).toBe(
      Date.parse("2026-06-30T22:00:00.000Z"),
    );
  });
});

describe("parseFootprintSearchTime", () => {
  const now = new Date(2026, 6, 1, 12, 0, 0, 0);

  it("parses time then DD/MM using the current year", () => {
    expect(parseFootprintSearchTime("20:00 1/7", now)).toBe(
      new Date(2026, 6, 1, 20, 0, 0, 0).getTime(),
    );
  });

  it("parses DD/MM then time using the current year", () => {
    expect(parseFootprintSearchTime("1/7 20:00", now)).toBe(
      new Date(2026, 6, 1, 20, 0, 0, 0).getTime(),
    );
  });

  it("parses ISO local date-time and floors seconds to the minute", () => {
    expect(parseFootprintSearchTime("2026-07-01 20:00:44", now)).toBe(
      floorToMinuteMs(new Date(2026, 6, 1, 20, 0, 44, 0).getTime()),
    );
  });

  it("rejects invalid dates", () => {
    expect(parseFootprintSearchTime("31/2 20:00", now)).toBeNull();
  });
});
