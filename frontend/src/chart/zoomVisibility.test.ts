import { describe, expect, it } from "vitest";

import {
  MIN_DENSE_OVERLAY_BAR_SPACING,
  shouldRenderDenseOverlay,
} from "./zoomVisibility";

describe("dense overlay zoom visibility", () => {
  it("hides dense TDU, mGann, Sweep Reversal, and BigTrade overlays below the normal one-bar spacing", () => {
    expect(
      shouldRenderDenseOverlay(MIN_DENSE_OVERLAY_BAR_SPACING - 0.01),
    ).toBe(false);
  });

  it("shows them at the threshold and closer zoom levels", () => {
    expect(shouldRenderDenseOverlay(MIN_DENSE_OVERLAY_BAR_SPACING)).toBe(true);
    expect(shouldRenderDenseOverlay(MIN_DENSE_OVERLAY_BAR_SPACING + 4)).toBe(
      true,
    );
  });
});
