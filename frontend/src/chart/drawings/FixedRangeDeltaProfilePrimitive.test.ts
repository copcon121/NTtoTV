import { describe, expect, it } from "vitest";

import {
  isPriceInsideValueArea,
  normalizeFixedRangeProfileMode,
  profileHistogramWidth,
} from "./FixedRangeDeltaProfilePrimitive";

describe("FixedRangeDeltaProfilePrimitive value area rows", () => {
  it("keeps prices between VAL and VAH in the value area", () => {
    expect(isPriceInsideValueArea(4514.2, 4514.4, 4514.0)).toBe(true);
    expect(isPriceInsideValueArea(4514.0, 4514.4, 4514.0)).toBe(true);
    expect(isPriceInsideValueArea(4514.4, 4514.4, 4514.0)).toBe(true);
    expect(isPriceInsideValueArea(4513.9, 4514.4, 4514.0)).toBe(false);
    expect(isPriceInsideValueArea(4514.5, 4514.4, 4514.0)).toBe(false);
  });

  it("does not fade rows when the profile has no valid value area", () => {
    expect(isPriceInsideValueArea(4514.2, null, 4514.0)).toBe(true);
    expect(isPriceInsideValueArea(4514.2, 4514.4, null)).toBe(true);
    expect(isPriceInsideValueArea(4514.2, Number.NaN, 4514.0)).toBe(true);
  });
});

describe("FixedRangeDeltaProfilePrimitive mode", () => {
  it("defaults legacy or invalid profile mode to volume", () => {
    expect(normalizeFixedRangeProfileMode(undefined)).toBe("volume");
    expect(normalizeFixedRangeProfileMode("delta")).toBe("delta");
    expect(normalizeFixedRangeProfileMode("bidAsk")).toBe("delta");
    expect(normalizeFixedRangeProfileMode("volume")).toBe("volume");
  });
});

describe("FixedRangeDeltaProfilePrimitive histogram lane", () => {
  it("keeps the profile lane anchored left instead of filling a wide box", () => {
    expect(profileHistogramWidth(200)).toBe(144);
    expect(profileHistogramWidth(1000)).toBe(560);
  });
});
