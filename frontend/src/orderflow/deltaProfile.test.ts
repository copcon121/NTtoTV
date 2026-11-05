import { describe, expect, it } from "vitest";
import { fixedRangeProfileRowTicks } from "./deltaProfile";

describe("fixed range profile row ticks", () => {
  it("uses the saved resolution for both request modes", () => {
    for (const mode of ["volume", "delta"] as const) {
      expect(fixedRangeProfileRowTicks(5, mode)).toBe(5);
      expect(fixedRangeProfileRowTicks(1, mode)).toBe(1);
    }
  });

  it("preserves legacy defaults for missing or invalid settings", () => {
    for (const value of [undefined, 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(fixedRangeProfileRowTicks(value, "volume")).toBe(1);
      expect(fixedRangeProfileRowTicks(value, "delta")).toBe(2);
    }
  });
});
