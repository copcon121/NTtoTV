import { describe, expect, it, vi } from "vitest";

import {
  MIN_DENSE_OVERLAY_BAR_SPACING,
  shouldRenderDenseOverlay,
  normalizeDenseOverlayMinSpacing,
  readDenseOverlayMinSpacing,
  persistDenseOverlayMinSpacing,
} from "./zoomVisibility";

describe("dense overlay zoom visibility", () => {
  it("shows overlays at a user-selected smaller spacing and hides below it", () => {
    expect(shouldRenderDenseOverlay(3, 3)).toBe(true);
    expect(shouldRenderDenseOverlay(2.99, 3)).toBe(false);
    expect(shouldRenderDenseOverlay(8, 10)).toBe(false);
  });

  it("keeps overlays visible at every valid zoom when auto-hide is disabled", () => {
    expect(shouldRenderDenseOverlay(0.5, 0)).toBe(true);
    expect(shouldRenderDenseOverlay(0, 0)).toBe(true);
    expect(shouldRenderDenseOverlay(NaN, 0)).toBe(false);
  });

  it("clamps thresholds and defaults invalid settings", () => {
    expect(normalizeDenseOverlayMinSpacing(-5)).toBe(0);
    expect(normalizeDenseOverlayMinSpacing(999)).toBe(30);
    for (const invalid of [NaN, Infinity, undefined, null, "3"]) {
      expect(normalizeDenseOverlayMinSpacing(invalid)).toBe(6);
    }
  });

  it("restores a saved threshold including always-visible mode", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    expect(readDenseOverlayMinSpacing(storage)).toBe(6);
    persistDenseOverlayMinSpacing(2.5, storage);
    expect(readDenseOverlayMinSpacing(storage)).toBe(2.5);
    persistDenseOverlayMinSpacing(0, storage);
    expect(readDenseOverlayMinSpacing(storage)).toBe(0);
  });

  it("tolerates corrupt or blocked browser storage", () => {
    expect(readDenseOverlayMinSpacing({ getItem: () => "{bad" })).toBe(6);
    expect(readDenseOverlayMinSpacing({ getItem: () => "null" })).toBe(6);
    expect(readDenseOverlayMinSpacing({ getItem: () => { throw new Error(); } })).toBe(6);
    expect(() => persistDenseOverlayMinSpacing(3, { setItem: vi.fn(() => { throw new Error(); }) })).not.toThrow();
  });

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
