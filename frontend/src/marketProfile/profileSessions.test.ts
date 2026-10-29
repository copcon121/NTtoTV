import { describe, expect, it } from "vitest";

import { profileSessionWindow } from "./profileSessions";

describe("US COMEX profile window", () => {
  it.each([
    ["2026-01-12T23:00:00Z", "2026-01-13T22:00:00Z", "2026-01-13"],
    ["2026-10-27T22:00:00Z", "2026-10-28T21:00:00Z", "2026-10-28"],
  ])("keeps 19:00-04:00 UTC+7 across exchange DST (%s)", (start, close, tradeDate) => {
    const day = { start: Date.parse(start), end: Date.parse(close) - 1, tradeDate };
    expect(profileSessionWindow(day, "us-comex")).toEqual({
      start: Date.parse(`${tradeDate}T19:00:00+07:00`),
      end: Date.parse(`${tradeDate}T00:00:00+07:00`) + 28 * 3_600_000 - 1,
    });
    expect(profileSessionWindow(day, "full")).toEqual({ start: day.start, end: day.end });
  });

  it("does not extend beyond an exchange session's supplied close", () => {
    const day = {
      start: Date.parse("2026-10-27T22:00:00Z"),
      end: Date.parse("2026-10-28T18:00:00Z") - 1,
      tradeDate: "2026-10-28",
    };
    expect(profileSessionWindow(day, "us-comex").end).toBe(day.end);
  });
});
