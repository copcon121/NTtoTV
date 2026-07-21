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
          top: 10,
          bottom: 8,
        }),
      ]),
    );
  });

  it("anchors bearish BOS order blocks to the lower high after the broken low", () => {
    const rows: Bar[] = [
      bar(0, 88, 90, 85, 88),
      bar(1, 119, 120, 118, 119),
    ];

    for (let index = 2; index < 10; index += 1) {
      rows.push(bar(index, 92, 95, 90, 92));
    }
    rows.push(bar(10, 86, 92, 80, 85));
    for (let index = 11; index <= 60; index += 1) {
      rows.push(bar(index, 90, 94, 84, 90));
    }
    for (let index = 61; index <= 64; index += 1) {
      rows.push(bar(index, 92, 96, 88, 92));
    }
    rows.push(bar(65, 96, 100, 95, 96));
    rows.push(bar(66, 81, 99, 78, 79));
    for (let index = 67; index <= 116; index += 1) {
      rows.push(bar(index, 88, 94, 76, 88));
    }

    const overlay = computeSmcOverlay(rows, {
      ...DEFAULT_SMC_SETTINGS,
      enabled: true,
      showInternal: false,
      showPremiumDiscount: false,
      swingLength: 50,
      internalLength: 5,
    });

    expect(overlay.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "BOS",
          direction: -1,
          scope: "swing",
        }),
      ]),
    );
    expect(overlay.markers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "LH",
          time: 65,
          scope: "swing",
        }),
      ]),
    );
    expect(overlay.zones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "ob",
          scope: "swing",
          direction: -1,
          top: 100,
          bottom: 95,
          startTime: 65,
        }),
      ]),
    );
    expect(overlay.zones).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "ob",
          scope: "swing",
          direction: -1,
          top: 120,
          bottom: 118,
        }),
      ]),
    );
  });

  it("promotes the next higher swing bearish order block after the nearest one is broken", () => {
    const rows: Bar[] = [
      bar(0, 88, 90, 85, 88),
      bar(1, 119, 120, 118, 119),
    ];

    for (let index = 2; index < 10; index += 1) {
      rows.push(bar(index, 92, 95, 90, 92));
    }
    rows.push(bar(10, 86, 92, 80, 85));
    for (let index = 11; index <= 60; index += 1) {
      rows.push(bar(index, 90, 94, 84, 90));
    }
    for (let index = 61; index <= 64; index += 1) {
      rows.push(bar(index, 92, 96, 88, 92));
    }
    rows.push(bar(65, 96, 100, 95, 96));
    rows.push(bar(66, 81, 99, 78, 79));
    for (let index = 67; index <= 116; index += 1) {
      rows.push(bar(index, 88, 94, 76, 88));
    }
    rows.push(bar(117, 98, 102, 94, 101));

    const overlay = computeSmcOverlay(rows, {
      ...DEFAULT_SMC_SETTINGS,
      enabled: true,
      showInternal: false,
      showPremiumDiscount: false,
      swingLength: 50,
      internalLength: 5,
    });

    expect(overlay.zones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "ob",
          scope: "swing",
          direction: -1,
          top: 120,
          bottom: 118,
          startTime: 1,
        }),
      ]),
    );
    expect(overlay.zones).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "ob",
          scope: "swing",
          direction: -1,
          top: 100,
          bottom: 95,
        }),
      ]),
    );
  });

  it("extends structure break lines past the break bar using 30-minute spacing", () => {
    const thirtyMinutes = 30 * 60_000;
    const overlay = computeSmcOverlay(
      [
        bar(0, 9.5, 10, 9, 9.5),
        bar(thirtyMinutes, 11.5, 12, 11, 11.5),
        bar(2 * thirtyMinutes, 10.5, 11, 10, 10.5),
        bar(3 * thirtyMinutes, 9.5, 10, 9, 9.5),
        bar(4 * thirtyMinutes, 10, 11, 8, 10),
        bar(5 * thirtyMinutes, 12.5, 13, 9, 12.5),
      ],
      {
        ...DEFAULT_SMC_SETTINGS,
        enabled: true,
        swingLength: 2,
        internalLength: 1,
      },
    );

    const line = overlay.lines.find(
      (candidate) => candidate.scope === "swing" && candidate.label === "BOS",
    );

    expect(line).toEqual(
      expect.objectContaining({
        startTime: thirtyMinutes,
        endTime: 35 * thirtyMinutes,
        labelTime: 5 * thirtyMinutes,
        price: 12,
      }),
    );
  });

  it("extends only swing structure lines while keeping internal lines at the break bar", () => {
    const minute = 60_000;
    const rows = [
      [0, 100, 101.11, 96.38, 97.89],
      [1, 97.89, 99.68, 96.78, 99.53],
      [2, 99.53, 103.4, 99.48, 101.73],
      [3, 101.73, 103.59, 100.46, 102.84],
      [4, 102.84, 106.08, 102.14, 103.57],
      [5, 103.57, 110, 102.59, 107.42],
      [6, 107.42, 110.47, 106.77, 108.88],
      [7, 108.88, 109.09, 104.76, 105.71],
      [8, 105.71, 107.83, 101, 102.75],
      [9, 102.75, 103.54, 99.53, 101.79],
      [10, 101.79, 105.76, 100.78, 105.23],
      [11, 105.23, 110.26, 103.59, 109.1],
      [12, 109.1, 112.08, 106.2, 108.83],
      [13, 108.83, 113.39, 105.9, 110.52],
      [14, 110.52, 111.63, 105.7, 107.76],
      [15, 107.76, 109.23, 104.54, 105.06],
      [16, 105.06, 108.42, 104.07, 105.8],
      [17, 105.8, 108.66, 101.26, 101.96],
      [18, 101.96, 104.69, 100.8, 104.61],
      [19, 104.61, 105.64, 100.59, 100.98],
      [20, 100.98, 104.68, 100.54, 103.46],
      [21, 103.46, 106.73, 100.66, 104.35],
      [22, 104.35, 104.44, 97.44, 100.44],
    ] as const;
    const overlay = computeSmcOverlay(
      rows.map(([index, open, high, low, close]) =>
        bar(index * minute, open, high, low, close),
      ),
      {
        ...DEFAULT_SMC_SETTINGS,
        enabled: true,
        showInternal: true,
        swingLength: 2,
        internalLength: 1,
        structureLineExtendBars: 10,
      },
    );

    const swingLine = overlay.lines.find(
      (line) => line.scope === "swing" && line.label === "BOS",
    );
    const internalLine = overlay.lines.find(
      (line) => line.scope === "internal" && line.label === "CHoCH",
    );

    expect(swingLine).toEqual(
      expect.objectContaining({
        startTime: 6 * minute,
        endTime: 23 * minute,
        labelTime: 13 * minute,
        price: 110.47,
      }),
    );
    expect(internalLine).toEqual(
      expect.objectContaining({
        startTime: 20 * minute,
        endTime: 22 * minute,
        labelTime: 22 * minute,
        price: 100.54,
      }),
    );
  });

  it("keeps the full candle for normal-range bullish order blocks", () => {
    const overlay = computeSmcOverlay(
      [
        bar(0, 9.5, 10, 9, 9.5),
        bar(1, 11.5, 12, 11, 11.5),
        bar(2, 10.5, 11, 10, 10.5),
        bar(3, 9.5, 10, 9, 9.5),
        bar(4, 9.8, 10.5, 8.9, 10.1),
        bar(5, 12.5, 13, 9, 12.5),
      ],
      {
        ...DEFAULT_SMC_SETTINGS,
        enabled: true,
        swingLength: 2,
        internalLength: 1,
      },
    );

    expect(overlay.zones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "ob",
          direction: 1,
          top: 10.5,
          bottom: 8.9,
        }),
      ]),
    );
  });

  it("keeps external bearish order blocks until price closes through them", () => {
    const rows = [
      bar(0, 9.5, 10, 9, 9.5),
      bar(1, 7.5, 8, 7, 7.5),
      bar(2, 8.5, 9, 8, 8.5),
      bar(3, 9.4, 10, 9, 9.4),
      bar(4, 8.7, 9, 8, 8.7),
      bar(5, 8.6, 9.5, 6.5, 6.8),
      bar(6, 9.2, 10.2, 8.8, 9.7),
    ];
    const settings = {
      ...DEFAULT_SMC_SETTINGS,
      enabled: true,
      showInternal: false,
      showPremiumDiscount: false,
      swingLength: 1,
      internalLength: 1,
    };

    const wickSweepOverlay = computeSmcOverlay(rows, settings);
    expect(wickSweepOverlay.zones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "ob",
          scope: "swing",
          direction: -1,
          top: 10,
          bottom: 9,
        }),
      ]),
    );

    const closeThroughOverlay = computeSmcOverlay(
      [...rows, bar(7, 9.8, 10.4, 9.6, 10.1)],
      settings,
    );
    expect(closeThroughOverlay.zones).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "ob",
          scope: "swing",
          direction: -1,
          top: 10,
          bottom: 9,
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
        maxZoneAge: 500,
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
