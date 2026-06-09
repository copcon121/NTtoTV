import { describe, expect, it } from "vitest";

import { isPriceInsideValueArea } from "./FixedRangeDeltaProfilePrimitive";

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
