import { describe, expect, it } from "vitest";

import { smcTimeRangeIntersects } from "./SmcOverlayPrimitive";

describe("smcTimeRangeIntersects", () => {
  it("keeps objects that overlap the visible time range", () => {
    expect(smcTimeRangeIntersects(90, 110, 100, 200)).toBe(true);
    expect(smcTimeRangeIntersects(150, 170, 100, 200)).toBe(true);
    expect(smcTimeRangeIntersects(190, 210, 100, 200)).toBe(true);
  });

  it("drops objects fully outside the visible time range", () => {
    expect(smcTimeRangeIntersects(10, 90, 100, 200)).toBe(false);
    expect(smcTimeRangeIntersects(210, 220, 100, 200)).toBe(false);
  });

  it("treats an open-ended active zone as extending to the right", () => {
    expect(smcTimeRangeIntersects(10, undefined, 100, 200)).toBe(true);
    expect(smcTimeRangeIntersects(210, undefined, 100, 200)).toBe(false);
  });
});
