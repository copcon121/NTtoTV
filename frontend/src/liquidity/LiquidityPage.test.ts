import { describe, expect, it } from "vitest";

import {
  liquidityHistoryKindsChanged,
  panOffsetFromDrag,
  pricePanFromChartDrag,
  priceScaleFromAxisDrag,
  relativeLiquidityVolumeLabel,
  timeScaleFromAxisDrag,
  ttwVolumeSpikeLabel,
  validateLiquidityTrackerSettings,
  validateMarketExplorerSettings,
} from "./LiquidityPage";

describe("liquidity axis scaling", () => {
  it("zooms the time axis in when dragged right and out when dragged left", () => {
    expect(timeScaleFromAxisDrag(240, 100)).toBeLessThan(240);
    expect(timeScaleFromAxisDrag(240, -100)).toBeGreaterThan(240);
  });

  it("never exposes fewer than the minimum candle count", () => {
    expect(timeScaleFromAxisDrag(240, 10_000)).toBe(30);
  });

  it("zooms the price axis in when dragged upward and out when dragged down", () => {
    expect(priceScaleFromAxisDrag(1, 100)).toBeGreaterThan(1);
    expect(priceScaleFromAxisDrag(1, -100)).toBeLessThan(1);
  });

  it("clamps extreme price-axis drags", () => {
    expect(priceScaleFromAxisDrag(1, 10_000)).toBe(12);
    expect(priceScaleFromAxisDrag(1, -10_000)).toBe(0.25);
  });
});

describe("liquidity chart panning", () => {
  it("creates future space when the latest chart is dragged left", () => {
    expect(panOffsetFromDrag(0, -100, 5, 500, 180)).toBe(-20);
  });

  it("returns through latest before panning into history", () => {
    expect(panOffsetFromDrag(-20, 150, 5, 500, 180)).toBe(10);
  });

  it("clamps future and historical panning limits", () => {
    expect(panOffsetFromDrag(0, -10_000, 5, 500, 180)).toBe(-180);
    expect(panOffsetFromDrag(0, 10_000, 5, 500, 180)).toBe(500);
  });

  it("moves the price viewport with vertical chart dragging", () => {
    expect(pricePanFromChartDrag(0, -80, 500)).toBe(-80);
    expect(pricePanFromChartDrag(-80, 130, 500)).toBe(50);
  });

  it("clamps extreme vertical chart dragging", () => {
    expect(pricePanFromChartDrag(0, -10_000, 500)).toBe(-1_500);
    expect(pricePanFromChartDrag(0, 10_000, 500)).toBe(1_500);
  });
});

describe("liquidity tracker settings", () => {
  const settings = {
    relativeEnabled: true,
    relativeTrigger: 50,
    relativeDomFrom: 20,
    relativeDomTo: 100,
    absoluteEnabled: true,
    absoluteTrigger: 500,
    absoluteDomFrom: 1,
    absoluteDomTo: 10,
    longTermEnabled: true,
    longTermTrigger: 500,
    longTermDomFrom: 1,
    longTermDomTo: 80,
    longTermMinAgeSeconds: 30,
  };

  it("accepts the default detection settings", () => {
    expect(validateLiquidityTrackerSettings(settings)).toBeNull();
  });

  it("rejects reversed DOM ranges", () => {
    expect(
      validateLiquidityTrackerSettings({
        ...settings,
        relativeDomFrom: 101,
      }),
    ).toContain("Relative DOM");
  });

  it("invalidates only the history group whose detector config changed", () => {
    expect(
      liquidityHistoryKindsChanged(settings, {
        ...settings,
        relativeTrigger: 20,
      }),
    ).toEqual(["relative"]);
    expect(
      liquidityHistoryKindsChanged(settings, {
        ...settings,
        absoluteDomTo: 12,
        longTermMinAgeSeconds: 5,
      }),
    ).toEqual(["absolute", "long_term"]);
  });
});

describe("TTW relative liquidity labels", () => {
  it("renders added liquidity as a positive depth delta", () => {
    expect(relativeLiquidityVolumeLabel({ action: "added", change: 25 })).toBe("+25");
  });

  it("renders removed liquidity as a negative depth delta", () => {
    expect(relativeLiquidityVolumeLabel({ action: "removed", change: 30 })).toBe("-30");
  });
});

describe("TTW V-Spike labels", () => {
  it("renders the original sell-side price, ratio, and sell/buy volume order", () => {
    expect(ttwVolumeSpikeLabel({
      side: "sell",
      price: 4190.9,
      priceRangeTicks: 13,
      ratio: 55 / 3,
      value: 55,
      oppositeVolume: 3,
    })).toEqual({
      title: "Sell V-Spike at 4190.9",
      priceChange: "-1.3",
      ratio: "18.3",
      sellVolume: "55",
      buyVolume: "3",
    });
  });

  it("keeps sell/buy volume order for a buy V-Spike", () => {
    expect(ttwVolumeSpikeLabel({
      side: "buy",
      price: 4201.2,
      priceRangeTicks: 8,
      ratio: 20,
      value: 60,
      oppositeVolume: 3,
    })).toEqual({
      title: "Buy V-Spike at 4201.2",
      priceChange: "0.8",
      ratio: "20",
      sellVolume: "3",
      buyVolume: "60",
    });
  });
});

describe("Market Explorer settings", () => {
  const signal = {
    enabled: true,
    askLevel: 500,
    bidLevel: 500,
    displayMode: "standard" as const,
    pullbackDurationMinutes: 0,
    pullbackPriceChangeTicks: 0,
    buyColor: "#ef4048",
    sellColor: "#edf2f4",
    markerShape: "triangle" as const,
    markerSize: 2,
    variableSize: false,
    alertSound: false,
    bookmapAlertMessage: "disabled" as const,
  };
  const volumeSpike = {
    enabled: true,
    triggerVolume: 800,
    maximumDurationSeconds: 1,
    priceRangeTicks: 8,
    ratioGreaterEqual: 10,
    buyColor: "#20bea6",
    sellColor: "#ef4050",
    markerShape: "triangle" as const,
    markerSize: 2,
    variableSize: false,
    alertSound: false,
    bookmapAlertMessage: "disabled" as const,
  };
  const absorption = {
    enabled: true,
    triggerVolume: 1000,
    maximumDurationSeconds: 1,
    buyColor: "#ef4050",
    sellColor: "#51bea2",
    markerShape: "flag" as const,
    markerSize: 2,
    variableSize: false,
    alertSound: false,
    bookmapAlertMessage: "disabled" as const,
  };
  const settings = {
    lineEnabled: true,
    halftimeSeconds: 60,
    buyLineColor: "#20bea6",
    sellLineColor: "#ef4050",
    signal,
    volumeSpike,
    absorption,
  };

  it("accepts the TTW-compatible defaults", () => {
    expect(validateMarketExplorerSettings(settings)).toBeNull();
  });

  it("rejects invalid MV Stop and Volume Spike thresholds", () => {
    expect(
      validateMarketExplorerSettings({
        ...settings,
        signal: { ...signal, askLevel: 0 },
      }),
    ).toContain("Ask level");
    expect(validateMarketExplorerSettings({
      ...settings,
      volumeSpike: { ...volumeSpike, ratioGreaterEqual: 0 },
    })).toContain("ratio");
  });
});
