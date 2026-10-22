import { describe, expect, it } from "vitest";

import {
  liquidityHistoryKindsChanged,
  liquidityEventMatchesSettings,
  liquidityLineLabel,
  liquidityLineMatchesSettings,
  isLongTermLiquidityLine,
  longTermTouchMatchesSettings,
  longTermTouchBubbleRadius,
  mergeLiveLine,
  mergeHistoryBars,
  panOffsetFromDrag,
  pricePanFromChartDrag,
  priceFromChartY,
  priceScaleFromAxisDrag,
  relativeLiquidityVolumeLabel,
  timeScaleFromAxisDrag,
  ttwVolumeSpikeLabel,
  validateLiquidityTrackerSettings,
  validateMarketExplorerSettings,
} from "./LiquidityPage";

describe("liquidity bar reconciliation", () => {
  it("repairs a stale closed bar from REST while preserving the live websocket bar", () => {
    const staleClosed = {
      time: 60_000,
      open: 4187.3,
      high: 4187.3,
      low: 4187.3,
      close: 4187.3,
      volume: 1,
    };
    const authoritativeClosed = {
      time: 60_000,
      open: 4184.8,
      high: 4185.4,
      low: 4182.5,
      close: 4184,
      volume: 111,
    };
    const restLive = {
      time: 120_000,
      open: 4184,
      high: 4185,
      low: 4184,
      close: 4184.5,
      volume: 5,
    };
    const socketLive = { ...restLive, high: 4186, close: 4185.5, volume: 9 };

    const result = mergeHistoryBars(
      [authoritativeClosed, restLive],
      [staleClosed, socketLive],
      0,
      120_000,
    );

    expect(result).toEqual([authoritativeClosed, socketLive]);
  });
});

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

  it("maps crosshair Y through the price pane rather than the full chart", () => {
    const plotTop = 18;
    const pricePlotHeight = 360;
    const priceMin = 4174;
    const priceMax = 4182;
    const linePrice = 4178;
    const lineY = plotTop +
      ((priceMax - linePrice) / (priceMax - priceMin)) * pricePlotHeight;

    expect(priceFromChartY(
      lineY,
      plotTop,
      pricePlotHeight,
      priceMin,
      priceMax,
    )).toBeCloseTo(linePrice, 10);
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

const longTermSettings = {
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

describe("Long-term liquidity touch bubbles", () => {
  it("grows with executed volume and caps oversized bubbles", () => {
    expect(longTermTouchBubbleRadius(25)).toBeGreaterThan(
      longTermTouchBubbleRadius(4),
    );
    expect(longTermTouchBubbleRadius(100_000)).toBe(24);
  });

  it("uses Long-term settings instead of Absolute settings", () => {
    const settings = {
      relativeEnabled: true,
      relativeTrigger: 50,
      relativeDomFrom: 20,
      relativeDomTo: 100,
      absoluteEnabled: false,
      absoluteTrigger: 500,
      absoluteDomFrom: 1,
      absoluteDomTo: 10,
      longTermEnabled: true,
      longTermTrigger: 10,
      longTermDomFrom: 1,
      longTermDomTo: 80,
      longTermMinAgeSeconds: 30,
    };
    expect(liquidityEventMatchesSettings({
      sequence: -1,
      time: 31_000,
      eventKind: "long_term_touch",
      action: "touch",
      side: "bid",
      price: 4191.2,
      size: 5,
      previousSize: 10,
      change: 5,
      threshold: 10,
      domDistance: 2,
      strength: 5,
      lineStartTime: 1_000,
    }, settings)).toBe(true);
  });

  it("filters touches by the current Long-term DOM range without deleting them", () => {
    expect(liquidityEventMatchesSettings({
      sequence: -1,
      time: 31_000,
      eventKind: "long_term_touch",
      action: "touch",
      side: "ask",
      price: 4191,
      size: 3,
      previousSize: 12,
      change: 3,
      threshold: 500,
      domDistance: 81,
      strength: 3,
      lineStartTime: 1_000,
    }, longTermSettings)).toBe(false);
  });

  it("keeps short-term candidates visible and classifies age separately", () => {
    const baseLine = {
      lineId: "ask:41910:1000",
      side: "ask" as const,
      price: 4191,
      startedAt: 1_000,
      lastAt: 31_000,
      endedAt: 31_000,
      currentSize: 500,
      peakSize: 600,
      threshold: 500,
      domDistance: 20,
      active: false,
    };
    expect(liquidityLineMatchesSettings(baseLine, longTermSettings, 31_000)).toBe(true);
    expect(liquidityLineMatchesSettings(
      { ...baseLine, endedAt: 30_999, lastAt: 30_999 },
      longTermSettings,
      30_999,
    )).toBe(true);
    expect(liquidityLineMatchesSettings(
      { ...baseLine, domDistance: 81 },
      longTermSettings,
      31_000,
    )).toBe(false);
    expect(isLongTermLiquidityLine(baseLine, longTermSettings, 31_000)).toBe(true);
    expect(isLongTermLiquidityLine(
      { ...baseLine, endedAt: 30_999, lastAt: 30_999 },
      longTermSettings,
      30_999,
    )).toBe(false);
  });

  it("alerts only when a touch belongs to a mature long-term line", () => {
    const touch = {
      time: 4 * 60 * 60 * 1_000,
      threshold: 500,
      domDistance: 20,
      lineStartTime: 0,
    };
    const fourHours = { ...longTermSettings, longTermMinAgeSeconds: 4 * 60 * 60 };

    expect(longTermTouchMatchesSettings(touch, fourHours)).toBe(true);
    expect(longTermTouchMatchesSettings({ ...touch, time: touch.time - 1 }, fourHours)).toBe(false);
  });

  it("keeps the original volume label until the line becomes long-term", () => {
    const line = {
      price: 4191,
      currentSize: 500,
      startedAt: 0,
      lastAt: 60_000,
      endedAt: null,
    };
    const fourHours = { longTermMinAgeSeconds: 4 * 60 * 60 };

    expect(liquidityLineLabel(line, fourHours, 60_000)).toBe("500 @ 4191.0");
    expect(liquidityLineLabel(line, fourHours, 4 * 60 * 60 * 1_000)).toBe(
      "LT · 500 @ 4191.0",
    );
  });

  it("ends a liquidity line when the direct feed reports that liquidity was eaten", () => {
    const current = new Map([["bid:41910:1000", {
      lineId: "bid:41910:1000",
      side: "bid" as const,
      price: 4191,
      startedAt: 1_000,
      lastAt: 2_000,
      endedAt: null,
      currentSize: 500,
      peakSize: 600,
      threshold: 500,
      domDistance: 2,
      active: true,
    }]]);
    const ended = mergeLiveLine(current, {
      type: "liquidity_update",
      symbol: "GC",
      contract: "GC",
      sequence: 2,
      time: 3_000,
      eventKind: "long_term",
      action: "end",
      side: "bid",
      price: 4191,
      size: 0,
      previousSize: 500,
      change: 500,
      threshold: 500,
      domDistance: 2,
      strength: 1,
      lineId: "bid:41910:1000",
      lineStartTime: 1_000,
      snapshot: false,
    });

    expect(ended.get("bid:41910:1000")).toMatchObject({
      active: false,
      endedAt: 3_000,
    });
  });
});

describe("liquidity history refiltering", () => {
  it("hides legacy touched-line removal markers", () => {
    const touchedLineRemoval = {
      sequence: 18,
      time: 2_000,
      eventKind: "relative" as const,
      action: "removed" as const,
      side: "bid" as const,
      price: 4190,
      size: 0,
      previousSize: 12,
      change: 12,
      threshold: 500,
      domDistance: 0,
      strength: 0.24,
      lineId: "bid:41900:1000",
      lineStartTime: 1_000,
    };

    expect(liquidityEventMatchesSettings(
      touchedLineRemoval,
      longTermSettings,
    )).toBe(false);
    expect(liquidityEventMatchesSettings(
      touchedLineRemoval,
      { ...longTermSettings, relativeEnabled: false },
    )).toBe(false);
  });

  it("uses measured relative change instead of the detector's old trigger", () => {
    const historical = {
      sequence: 1,
      time: 1_000,
      eventKind: "relative" as const,
      action: "added" as const,
      side: "bid" as const,
      price: 4190,
      size: 25,
      previousSize: 0,
      change: 25,
      threshold: 10,
      domDistance: 20,
      strength: 2.5,
    };
    expect(liquidityEventMatchesSettings(
      historical,
      { ...longTermSettings, relativeTrigger: 20 },
    )).toBe(true);
    expect(liquidityEventMatchesSettings(
      historical,
      { ...longTermSettings, relativeTrigger: 30 },
    )).toBe(false);
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
    alertMessage: "disabled" as const,
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
    alertMessage: "disabled" as const,
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
    alertMessage: "disabled" as const,
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
