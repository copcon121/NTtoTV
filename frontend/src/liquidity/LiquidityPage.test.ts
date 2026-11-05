import { describe, expect, it } from "vitest";

import {
  gcSessionKey,
  liquidityHistoryKindsChanged,
  liquidityEventMatchesSettings,
  liquidityLineLabel,
  liquidityLineMatchesSettings,
  isLongTermLiquidityLine,
  longTermTouchMatchesSettings,
  longTermTouchBubbleRadius,
  mergeLiquidityBigTrades,
  mergeLiveLine,
  mergeHistoryLines,
  mergeHistoryBars,
  panOffsetFromDrag,
  pricePanFromChartDrag,
  priceFromChartY,
  priceScaleFromAxisDrag,
  normalizeLiquidityChartProfileState,
  relativeLiquidityVolumeLabel,
  sessionVwapPoints,
  timeScaleFromAxisDrag,
  ttwVolumeSpikeLabel,
  validateLiquidityTrackerSettings,
  validateMarketExplorerSettings,
  validateBigTradeSettings,
  visibleLiquidityBigTrades,
  mergeMarketVolumeSignals,
} from "./LiquidityPage";

describe("SI Stops profile and MV Stop retirement", () => {
  it("persists independent SI settings without inheriting the old net-volume threshold", () => {
    const state = normalizeLiquidityChartProfileState({ siStops: { minVolume: 25, automatic: true, alertMinVolume: 50 } });
    expect(state.siStops).toMatchObject({ minVolume: 25, automatic: true, alertMinVolume: 50, enabled: true });
    expect(normalizeLiquidityChartProfileState({}).siStops?.minVolume).toBe(50);
  });

  it("keeps Volume Spike and Absorption history while excluding legacy MV Stop markers", () => {
    const base = { signalId: "old", kind: "market_volume_stop" as const, signalIndex: 1,
      detectionTime: 2000, time: 1000, side: "buy" as const, threshold: 500, value: 600, ratio: 1, price: 2700 };
    const spike = { ...base, signalId: "vs", kind: "volume_spike" as const };
    const absorption = { ...base, signalId: "abs", kind: "absorption" as const };
    expect(mergeMarketVolumeSignals([base, spike], [base, absorption], 0)).toEqual([spike, absorption]);
  });
});

describe("liquidity bar reconciliation", () => {
  it("merges REST heatmap history with newer socket samples without reopening an ended level", () => {
    const history = {
      lineId: "bid:4200", side: "bid" as const, price: 4200,
      startedAt: 1000, lastAt: 3000, endedAt: 3000, active: false,
      currentSize: 0, peakSize: 1200, threshold: 500, domDistance: 20,
      samples: [
        { time: 1000, size: 500, active: true },
        { time: 2000, size: 1200, active: true },
        { time: 3000, size: 0, active: false },
      ],
    };
    const live = { ...history, lastAt: 2000, endedAt: null, active: true,
      currentSize: 1200, samples: [history.samples[1]] };
    const merged = mergeHistoryLines([history], new Map([[live.lineId, live]]));
    expect(merged.get(history.lineId)?.active).toBe(false);
    expect(merged.get(history.lineId)?.samples).toEqual(history.samples);
    const delayed = mergeLiveLine(merged, {
      type: "liquidity_update", symbol: "GC", contract: "GC", sequence: 10,
      time: 1500, eventKind: "long_term", action: "update", side: "bid",
      price: 4200, size: 700, previousSize: 500, change: 200,
      threshold: 500, domDistance: 20, strength: 1.4,
      lineId: history.lineId, lineStartTime: 1000, snapshot: false,
    });
    expect(delayed.get(history.lineId)?.active).toBe(false);
    expect(delayed.get(history.lineId)?.samples?.map((sample) => sample.size)).toEqual([500, 700, 1200, 0]);
  });

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

  it("ends a liquidity line when Bookmap reports that liquidity was eaten", () => {
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

describe("BigTrade overlay", () => {
  it("applies the existing session threshold and visible time range", () => {
    const usSession = Date.UTC(2026, 0, 15, 14, 0);
    const markers = [
      { tradeId: 1, time: usSession, price: 4190, volume: 99, side: "buy" as const },
      { tradeId: 2, time: usSession + 1, price: 4190.1, volume: 100, side: "sell" as const },
      { tradeId: 3, time: usSession + 60_000, price: 4190.2, volume: 150, side: "buy" as const },
    ];

    expect(
      visibleLiquidityBigTrades(markers, usSession, usSession + 10_000),
    ).toEqual([markers[1]]);
    expect(
      visibleLiquidityBigTrades(markers, usSession, usSession + 10_000, false),
    ).toEqual([]);
  });

  it("deduplicates REST and realtime trades and keeps the newest capped tail", () => {
    const history = [
      { tradeId: 1, time: 1_000, price: 4190, volume: 40, side: "buy" as const },
      { tradeId: 2, time: 2_000, price: 4191, volume: 50, side: "sell" as const },
    ];
    const realtime = [
      { tradeId: 2, time: 2_000, price: 4191, volume: 55, side: "sell" as const },
      { tradeId: 3, time: 3_000, price: 4192, volume: 60, side: "buy" as const },
    ];

    expect(mergeLiquidityBigTrades(history, realtime, 0, 2)).toEqual([
      realtime[0],
      realtime[1],
    ]);
  });

  it("uses editable session thresholds and display limit", () => {
    const usSession = Date.UTC(2026, 0, 15, 14, 0);
    const markers = [
      { tradeId: 1, time: usSession, price: 4190, volume: 119, side: "buy" as const },
      { tradeId: 2, time: usSession + 1, price: 4191, volume: 120, side: "sell" as const },
      { tradeId: 3, time: usSession + 2, price: 4192, volume: 140, side: "buy" as const },
    ];
    const settings = {
      minVolume: 40,
      maxVisible: 1,
      soundEnabled: true,
      sessionMinVolumes: { asia: 40, eu: 60, us: 120 },
    };

    expect(
      visibleLiquidityBigTrades(
        markers,
        usSession,
        usSession + 10_000,
        true,
        settings,
      ),
    ).toEqual([markers[2]]);
    expect(validateBigTradeSettings(settings)).toBeNull();
  });
});

describe("liquidity profile state", () => {
  it("restores independent sound choices alongside existing layer preferences", () => {
    expect(normalizeLiquidityChartProfileState({
      alertSounds: { icebergEnabled: true, iceberg: "voice", bigTrade: "pulse", longTermEnabled: false },
      filters: { longTerm: false, relative: false, absolute: true },
    })).toMatchObject({
      alertSounds: { icebergEnabled: true, iceberg: "voice", bigTrade: "pulse", longTermEnabled: false },
      filters: { longTerm: false, relative: false, absolute: true },
    });
  });
  it("retains the selected line opacity when restoring a profile", () => {
    expect(normalizeLiquidityChartProfileState({ heatmap: { opacity: 0.45 } }).heatmap?.opacity).toBe(0.45);
  });
  it("persists heatmap intensity and short-lived level filtering", () => {
    const state = normalizeLiquidityChartProfileState({
      heatmap: { minDurationSeconds: 90, saturationMultiple: 6, contrast: 1.5 },
    });
    expect(state.heatmap).toEqual({ minDurationSeconds: 90, saturationMultiple: 6, contrast: 1.5, opacity: 1 });
    expect(normalizeLiquidityChartProfileState({}).heatmap?.minDurationSeconds).toBe(60);
  });
  it("restores a 30s viewport", () => {
    const state = normalizeLiquidityChartProfileState({
      version: 1,
      timeframe: "30s",
      visibleBars: 480,
    });

    expect(state.timeframe).toBe("30s");
    expect(state.visibleBars).toBe(480);
  });

  it("restores a 15s viewport with a four-hour default and a two-day zoom limit", () => {
    expect(normalizeLiquidityChartProfileState({ timeframe: "15s" })).toMatchObject({
      timeframe: "15s", visibleBars: 960,
    });
    const saved = normalizeLiquidityChartProfileState({ timeframe: "15s", visibleBars: 1_500 });
    expect(normalizeLiquidityChartProfileState(JSON.parse(JSON.stringify(saved))))
      .toMatchObject({ timeframe: "15s", visibleBars: 1_500 });
    expect(normalizeLiquidityChartProfileState({ timeframe: "15s", visibleBars: 20_000 }).visibleBars)
      .toBe(11_520);
  });

  it("restores independent iceberg session filters across profile saves", () => {
    const state = normalizeLiquidityChartProfileState({
      showNativeIcebergs: false, nativeIcebergSessionMinVolumes: { us: 25, other: 8 },
    });
    expect(normalizeLiquidityChartProfileState(JSON.parse(JSON.stringify(state)))).toMatchObject({
      showNativeIcebergs: false, nativeIcebergSessionMinVolumes: { us: 25, other: 8 },
    });
    expect(normalizeLiquidityChartProfileState({ nativeIcebergSessionMinVolumes: { us: -5, other: 7 } }))
      .toMatchObject({ showNativeIcebergs: true, nativeIcebergSessionMinVolumes: { us: 1, other: 7 } });
    expect(normalizeLiquidityChartProfileState({ nativeIcebergMinVolume: 1 }))
      .toMatchObject({ nativeIcebergSessionMinVolumes: { us: 10, other: 5 } });
  });

  it("migrates older ICE profiles to Auto and round-trips explicit filter preferences", () => {
    expect(normalizeLiquidityChartProfileState({})).toMatchObject({
      nativeIcebergFilters: { automatic: true, lookbackMinutes: 60, standardDeviations: 1, applyToActive: true },
    });
    const saved = normalizeLiquidityChartProfileState({ nativeIcebergFilters: {
      automatic: false, showFiltered: true, aggregateMinVolume: 25, showCanceled: false,
    } });
    expect(normalizeLiquidityChartProfileState(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(saved.nativeIcebergFilters).toMatchObject({ automatic: false, showFiltered: true,
      aggregateMinVolume: 25, showCanceled: false });
  });

  it("restores chart viewport and lets shared BigTrade settings stay authoritative", () => {
    const state = normalizeLiquidityChartProfileState(
      {
        version: 1,
        timeframe: "5m",
        visibleBars: 96,
        offsetBars: 12,
        priceScale: 1.4,
        pricePanPx: -30,
        filters: {
          longTerm: true,
          relative: false,
          absolute: true,
          trend1: false,
          trend2: true,
        },
        showVwap: false,
        showBigTrades: false,
        bigTradeSettings: {
          minVolume: 10,
          maxVisible: 20,
          sessionMinVolumes: { asia: 10, eu: 20, us: 30 },
        },
      },
      {
        showBigTrades: true,
        bigTradeSettings: {
          minVolume: 40,
          maxVisible: 250,
          soundEnabled: true,
          sessionMinVolumes: { asia: 40, eu: 60, us: 120 },
        },
      },
    );

    expect(state).toMatchObject({
      timeframe: "5m",
      visibleBars: 96,
      offsetBars: 12,
      priceScale: 1.4,
      pricePanPx: -30,
      filters: { relative: false },
      showVwap: false,
      showBigTrades: true,
      bigTradeSettings: {
        maxVisible: 250,
        soundEnabled: true,
        sessionMinVolumes: { asia: 40, eu: 60, us: 120 },
      },
    });
  });
});

describe("session VWAP", () => {
  it("resets the GC session at 17:00 Chicago across standard and daylight time", () => {
    expect(gcSessionKey(Date.UTC(2026, 0, 15, 22, 59))).toBe("2026-01-14");
    expect(gcSessionKey(Date.UTC(2026, 0, 15, 23, 0))).toBe("2026-01-15");
    expect(gcSessionKey(Date.UTC(2026, 6, 15, 21, 59))).toBe("2026-07-14");
    expect(gcSessionKey(Date.UTC(2026, 6, 15, 22, 0))).toBe("2026-07-15");
  });

  it("accumulates HLC3 by volume and starts fresh in the next session", () => {
    const firstSession = Date.UTC(2026, 0, 15, 23, 0);
    const nextSession = Date.UTC(2026, 0, 16, 23, 0);
    const bars = [
      { time: firstSession, open: 100, high: 100, low: 100, close: 100, volume: 10 },
      { time: firstSession + 60_000, open: 110, high: 110, low: 110, close: 110, volume: 30 },
      { time: nextSession, open: 120, high: 120, low: 120, close: 120, volume: 5 },
    ];

    expect(sessionVwapPoints(bars).map((point) => point.value)).toEqual([
      100,
      107.5,
      120,
    ]);
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
