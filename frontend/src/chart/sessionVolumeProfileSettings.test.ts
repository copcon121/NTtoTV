import { describe, expect, it } from "vitest";
import { normalizeSessionVolumeProfileRowTicks } from "./sessionVolumeProfileSettings";

describe("session Volume Profile row ticks", () => {
  it("keeps saved positive integer resolution", () => {
    expect(normalizeSessionVolumeProfileRowTicks(1)).toBe(1);
    expect(normalizeSessionVolumeProfileRowTicks(10)).toBe(10);
  });

  it("uses the legacy 2-tick default for absent or invalid profile settings", () => {
    for (const value of [undefined, null, "", "5", 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(normalizeSessionVolumeProfileRowTicks(value)).toBe(2);
    }
  });
});
