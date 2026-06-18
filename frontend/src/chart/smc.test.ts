import { describe, expect, it } from "vitest";

import { type Bar } from "../cache/types";
import { DEFAULT_SMC_SETTINGS, computeSmcOverlay } from "./smc";

function bar(
  time: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume = 1,
): Bar {
  return { time, open, high, low, close, volume };
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

  it("filters weak FVG zones when auto threshold is enabled", () => {
    const bars = [
      bar(0, 100, 101, 99, 100.5),
      bar(60_000, 100.5, 101.5, 99.5, 100),
      bar(120_000, 100, 101.4, 99.4, 100.4),
      bar(180_000, 100.4, 101.2, 99.2, 100),
      bar(240_000, 100, 101, 99, 100.2),
      bar(300_000, 100.95, 101.08, 100.9, 101.05),
      bar(360_000, 101.15, 101.4, 101.1, 101.3),
    ];
    const baseSettings = {
      ...DEFAULT_SMC_SETTINGS,
      enabled: true,
      swingLength: 1,
      internalLength: 1,
      showPremiumDiscount: false,
      showSwingOrderBlocks: false,
      showInternalOrderBlocks: false,
      maxFairValueGaps: 30,
    };

    const autoOverlay = computeSmcOverlay(bars, baseSettings);
    const manualOverlay = computeSmcOverlay(bars, {
      ...baseSettings,
      fvgAutoThreshold: false,
    });

    expect(autoOverlay.zones.filter((zone) => zone.kind === "fvg")).toEqual([]);
    expect(manualOverlay.zones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "fvg",
          direction: 1,
          top: 101.1,
          bottom: 101,
        }),
      ]),
    );
  });

  it("uses rolling FVG body threshold instead of all-history volatility", () => {
    const bars = [
      bar(0, 100, 111, 99, 110),
      bar(60_000, 110, 111, 99, 100),
      bar(120_000, 100, 111, 99, 110),
      bar(180_000, 100, 100.2, 99.8, 100.1),
      bar(240_000, 100.1, 100.2, 99.8, 100),
      bar(300_000, 100, 100.1, 99.9, 100.05),
      bar(360_000, 100.05, 100.35, 100, 100.3),
      bar(420_000, 100.3, 100.45, 100.2, 100.35),
    ];
    const baseSettings = {
      ...DEFAULT_SMC_SETTINGS,
      enabled: true,
      swingLength: 1,
      internalLength: 1,
      showPremiumDiscount: false,
      showSwingOrderBlocks: false,
      showInternalOrderBlocks: false,
      maxFairValueGaps: 30,
    };

    const rollingOverlay = computeSmcOverlay(bars, {
      ...baseSettings,
      fvgThresholdLookback: 3,
    });
    const longOverlay = computeSmcOverlay(bars, {
      ...baseSettings,
      fvgThresholdLookback: 20,
    });

    expect(rollingOverlay.zones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "fvg",
          direction: 1,
          top: 100.2,
          bottom: 100.1,
        }),
      ]),
    );
    expect(longOverlay.zones.filter((zone) => zone.kind === "fvg")).toEqual([]);
  });

  it("can require a volume anomaly for FVG zones", () => {
    const bars = [
      bar(0, 9.5, 10, 9, 9.5, 100),
      bar(60_000, 11.2, 12, 11, 11.5, 5),
      bar(120_000, 13.2, 14, 13, 13.5, 100),
    ];
    const baseSettings = {
      ...DEFAULT_SMC_SETTINGS,
      enabled: true,
      swingLength: 1,
      internalLength: 1,
      fvgAutoThreshold: false,
      showPremiumDiscount: false,
      showSwingOrderBlocks: false,
      showInternalOrderBlocks: false,
      maxFairValueGaps: 30,
    };

    const withoutVolumeFilter = computeSmcOverlay(bars, baseSettings);
    const withVolumeFilter = computeSmcOverlay(bars, {
      ...baseSettings,
      fvgVolumeConfirmation: true,
    });

    expect(withoutVolumeFilter.zones.some((zone) => zone.kind === "fvg")).toBe(true);
    expect(withVolumeFilter.zones.filter((zone) => zone.kind === "fvg")).toEqual([]);
  });

  it("omits mitigated FVG zones from the active display limit", () => {
    const overlay = computeSmcOverlay(
      [
        bar(0, 9.5, 10, 9, 9.5),
        bar(60_000, 11.2, 12, 11, 11.5),
        bar(120_000, 13.2, 14, 13, 13.5),
        bar(180_000, 10.5, 13.2, 9.5, 10.5),
      ],
      {
        ...DEFAULT_SMC_SETTINGS,
        enabled: true,
        swingLength: 1,
        internalLength: 1,
        showPremiumDiscount: false,
        showSwingOrderBlocks: false,
        showInternalOrderBlocks: false,
        maxFairValueGaps: 30,
      },
    );

    expect(overlay.zones.filter((zone) => zone.kind === "fvg")).toEqual([]);
  });

  it("keeps unfilled FVG zones active beyond the generic zone age", () => {
    const bars = [
      bar(0, 9.5, 10, 9, 9.5),
      bar(60_000, 11.2, 12, 11, 11.5),
      bar(120_000, 13.2, 14, 13, 13.5),
    ];
    for (let i = 3; i < 230; i += 1) {
      bars.push(bar(i * 60_000, 13.6, 14.5, 13.2, 13.8));
    }

    const overlay = computeSmcOverlay(
      bars,
      {
        ...DEFAULT_SMC_SETTINGS,
        enabled: true,
        swingLength: 1,
        internalLength: 1,
        maxZoneAge: 220,
        showPremiumDiscount: false,
        showSwingOrderBlocks: false,
        showInternalOrderBlocks: false,
        maxFairValueGaps: 30,
      },
    );

    expect(overlay.zones.filter((zone) => zone.kind === "fvg")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          startTime: 60_000,
          top: 13,
          bottom: 10,
        }),
      ]),
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
