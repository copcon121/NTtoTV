import { describe, expect, it } from "vitest";

import { type Bar } from "../cache/types";
import { DEFAULT_SMC_SETTINGS, computeSmcOverlay } from "./smc";

function bar(
  time: number,
  open: number,
  high: number,
  low: number,
  close: number,
): Bar {
  return { time, open, high, low, close, volume: 1 };
}

describe("SMC overlay", () => {
  it("detects a bullish BOS and keeps the created bullish order block active", () => {
    const overlay = computeSmcOverlay(
      [
        bar(0, 9.5, 10, 9, 9.5),
        bar(1, 11.5, 12, 11, 11.5),
        bar(2, 10.5, 11, 10, 10.5),
        bar(3, 9.5, 10, 9, 9.5),
        bar(4, 10, 11, 8, 10),
        bar(5, 12.5, 13, 9, 12.5),
      ],
      {
        ...DEFAULT_SMC_SETTINGS,
        enabled: true,
        swingLength: 2,
        internalLength: 1,
      },
    );

    expect(overlay.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "BOS",
          direction: 1,
          scope: "swing",
        }),
      ]),
    );
    expect(overlay.zones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "ob",
          direction: 1,
          top: 11,
          bottom: 8,
        }),
      ]),
    );
  });

  it("returns an empty overlay when disabled", () => {
    const overlay = computeSmcOverlay(
      [bar(0, 1, 2, 1, 2)],
      { ...DEFAULT_SMC_SETTINGS, enabled: false },
    );

    expect(overlay.markers).toEqual([]);
    expect(overlay.zones).toEqual([]);
    expect(overlay.lines).toEqual([]);
  });

  it("does not emit internal swing labels when internal structure is enabled", () => {
    const overlay = computeSmcOverlay(
      [
        bar(0, 9.5, 10, 9, 9.5),
        bar(1, 11.5, 12, 11, 11.5),
        bar(2, 10.5, 11, 10, 10.5),
        bar(3, 9.5, 10, 9, 9.5),
        bar(4, 10, 11, 8, 10),
        bar(5, 12.5, 13, 9, 12.5),
      ],
      {
        ...DEFAULT_SMC_SETTINGS,
        enabled: true,
        showInternal: true,
        swingLength: 2,
        internalLength: 1,
      },
    );

    expect(overlay.markers.some((marker) => marker.label.startsWith("iH"))).toBe(false);
    expect(overlay.markers.some((marker) => marker.label.startsWith("iL"))).toBe(false);
  });

  it("caps FVG zones to the configured bar extension", () => {
    const overlay = computeSmcOverlay(
      [
        bar(0, 9.5, 10, 9, 9.5),
        bar(60_000, 10.7, 11, 10.5, 10.8),
        bar(120_000, 12.2, 13, 12, 12.5),
        bar(180_000, 12.5, 13.5, 12.2, 13),
        bar(240_000, 13, 14, 12.8, 13.5),
      ],
      {
        ...DEFAULT_SMC_SETTINGS,
        enabled: true,
        swingLength: 1,
        internalLength: 1,
        fvgExtendBars: 3,
      },
    );

    const fvg = overlay.zones.find((zone) => zone.kind === "fvg");
    expect(fvg).toEqual(
      expect.objectContaining({
        startTime: 60_000,
        endTime: 240_000,
        extendBars: 3,
      }),
    );
  });

  it("draws premium, equilibrium, and discount zones from the live swing range", () => {
    const overlay = computeSmcOverlay(
      [
        bar(0, 9.5, 10, 9, 9.5),
        bar(1, 11.5, 12, 11, 11.5),
        bar(2, 10.5, 11, 10, 10.5),
        bar(3, 9.5, 10, 9, 9.5),
        bar(4, 10, 11, 8, 10),
        bar(5, 12.5, 13, 9, 12.5),
        bar(6, 11.5, 12, 10, 11.5),
      ],
      {
        ...DEFAULT_SMC_SETTINGS,
        enabled: true,
        swingLength: 2,
        internalLength: 1,
        showPremiumDiscount: true,
      },
    );

    expect(overlay.zones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "pd",
          pdKind: "premium",
          label: "Premium",
          startTime: 4,
          endTime: 6,
          top: 13,
          bottom: 12.75,
        }),
        expect.objectContaining({
          kind: "pd",
          pdKind: "equilibrium",
          label: "EQ",
          startTime: 4,
          endTime: 6,
          top: 10.625,
          bottom: 10.375,
        }),
        expect.objectContaining({
          kind: "pd",
          pdKind: "discount",
          label: "Discount",
          startTime: 4,
          endTime: 6,
          top: 8.25,
          bottom: 8,
        }),
      ]),
    );
  });

  it("omits premium and discount zones when disabled", () => {
    const overlay = computeSmcOverlay(
      [
        bar(0, 9.5, 10, 9, 9.5),
        bar(1, 11.5, 12, 11, 11.5),
        bar(2, 10.5, 11, 10, 10.5),
        bar(3, 9.5, 10, 9, 9.5),
        bar(4, 10, 11, 8, 10),
        bar(5, 12.5, 13, 9, 12.5),
        bar(6, 11.5, 12, 10, 11.5),
      ],
      {
        ...DEFAULT_SMC_SETTINGS,
        enabled: true,
        swingLength: 2,
        internalLength: 1,
        showPremiumDiscount: false,
      },
    );

    expect(overlay.zones.some((zone) => zone.kind === "pd")).toBe(false);
  });
});
