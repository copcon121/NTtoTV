import { describe, expect, it } from "vitest";

import { profileSessionWindow, profileSessionWindows } from "./profileSessions";

describe("US COMEX profile window", () => {
  it.each([
    ["2026-01-12T23:00:00Z", "2026-01-13T22:00:00Z", "2026-01-13"],
    ["2026-10-27T22:00:00Z", "2026-10-28T21:00:00Z", "2026-10-28"],
  ])("keeps full 20:00-20:00 profiles with a 04:00 close across DST (%s)", (start, close, tradeDate) => {
    const day = { start: Date.parse(start), end: Date.parse(close) - 1, tradeDate };
    expect(profileSessionWindow(day, "us-comex")).toEqual({
      start: Date.parse(`${tradeDate}T00:00:00+07:00`) - 4 * 3_600_000,
      end: Date.parse(`${tradeDate}T20:00:00+07:00`) - 1,
      closeTime: Date.parse(`${tradeDate}T04:00:00+07:00`),
    });
    expect(profileSessionWindow(day, "full")).toEqual({ start: day.start, end: day.end });
  });

  it("keeps the display window fixed when the exchange closes early", () => {
    const day = {
      start: Date.parse("2026-10-27T22:00:00Z"),
      end: Date.parse("2026-10-28T18:00:00Z") - 1,
      tradeDate: "2026-10-28",
    };
    expect(profileSessionWindow(day, "us-comex")).toEqual({
      start: Date.parse("2026-10-27T20:00:00+07:00"),
      end: Date.parse("2026-10-28T20:00:00+07:00") - 1,
      closeTime: Date.parse("2026-10-28T04:00:00+07:00"),
    });
  });

  it("keeps the current Asia/EU data before 20:00, then rolls immediately at 20:00", () => {
    const day = {
      start: Date.parse("2026-01-12T23:00:00Z"),
      end: Date.parse("2026-01-13T22:00:00Z") - 1,
      tradeDate: "2026-01-13",
    };
    const open = Date.parse("2026-01-13T20:00:00+07:00");
    expect(profileSessionWindows([day], "us-comex", open - 1)).toEqual([
      profileSessionWindow(day, "us-comex"),
    ]);
    expect(profileSessionWindows([day], "us-comex", open)).toEqual([{
      start: open,
      end: Date.parse("2026-01-14T20:00:00+07:00") - 1,
      closeTime: Date.parse("2026-01-14T04:00:00+07:00"),
    }]);
  });

  it("deduplicates adjacent exchange days and preserves the requested profile count", () => {
    const days = [13, 14].map((date) => ({
      start: Date.parse(`2026-01-${date - 1}T23:00:00Z`),
      end: Date.parse(`2026-01-${date}T22:00:00Z`) - 1,
      tradeDate: `2026-01-${date}`,
    }));
    const windows = profileSessionWindows(days, "us-comex", Date.parse("2026-01-14T21:00:00+07:00"));
    expect(windows).toHaveLength(2);
    expect(windows[0].start).toBe(Date.parse("2026-01-13T20:00:00+07:00"));
    expect(windows[1].start).toBe(windows[0].end + 1);
    for (const window of windows) expect(window.end - window.start + 1).toBe(24 * 3_600_000);
  });

  it("retains Friday US and Monday Asia/EU without introducing an empty Saturday profile", () => {
    const days = [
      { start: Date.parse("2026-10-29T22:00:00Z"), end: Date.parse("2026-10-30T21:00:00Z") - 1, tradeDate: "2026-10-30" },
      { start: Date.parse("2026-11-01T23:00:00Z"), end: Date.parse("2026-11-02T22:00:00Z") - 1, tradeDate: "2026-11-02" },
    ];
    const windows = profileSessionWindows(days, "us-comex", Date.parse("2026-11-02T14:00:00+07:00"));
    expect(windows.map((window) => window.start)).toEqual([
      Date.parse("2026-10-30T20:00:00+07:00"),
      Date.parse("2026-11-01T20:00:00+07:00"),
    ]);
  });
});
