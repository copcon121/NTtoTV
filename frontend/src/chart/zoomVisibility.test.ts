import { describe, expect, it } from "vitest";

import {
  MIN_DENSE_OVERLAY_BAR_SPACING,
  normalizeDenseOverlayBarSpacing,
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

  it("uses a configurable threshold and permits zero to disable auto-hide", () => {
    expect(shouldRenderDenseOverlay(8, 10)).toBe(false);
    expect(shouldRenderDenseOverlay(10, 10)).toBe(true);
    expect(shouldRenderDenseOverlay(1, 0)).toBe(true);
    expect(shouldRenderDenseOverlay(NaN, 0)).toBe(false);
  });

  it("keeps older profiles at six pixels and constrains saved values", () => {
    expect(normalizeDenseOverlayBarSpacing(undefined)).toBe(6);
    expect(normalizeDenseOverlayBarSpacing(NaN)).toBe(6);
    expect(normalizeDenseOverlayBarSpacing(-1)).toBe(0);
    expect(normalizeDenseOverlayBarSpacing(200)).toBe(100);
    expect(normalizeDenseOverlayBarSpacing(7.5)).toBe(7.5);
  });
});
