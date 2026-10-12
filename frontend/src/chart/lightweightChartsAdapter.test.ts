import { describe, expect, it } from "vitest";

import { type Bar } from "../cache/types";
import type { FvgSignalUpdateMessage } from "../socket/messages";
import {
  VOLUME_OVERLAY_PRICE_SCALE_ID,
  VOLUME_OVERLAY_SCALE_MARGINS,
  VOLUME_DELTA_OVERLAY_PRICE_SCALE_ID,
  VOLUME_DELTA_OVERLAY_SCALE_MARGINS,
  WAVE_DELTA_OVERLAY_PRICE_SCALE_ID,
  WAVE_DELTA_OVERLAY_SCALE_MARGINS,
  buildSupertrendLineSegments,
  buildWaveDeltaDivergences,
  buildWaveDeltaLineData,
  buildWaveDeltaMboxData,
  fvgSignalColor,
  gcPushMomentumColor,
  gcPushMomentumWaveDisplayStates,
  gcPushMomentumSeriesVisibility,
  isMgannImpulseTimeframeDuration,
  isSessionHighlightTimeframeDuration,
  isUtcPlus7SessionHighlightTime,
  recentGcPushMomentumPoints,
  tduDeltaDivergence,
  toBarDisplayTimestamp,
  toCandle,
  toGcPushEarlyDivergenceMarker,
  toGcPushEarlyDivergenceMomentumLines,
  toGcPushEarlyDivergencePriceLines,
  toGcPushDivergenceMomentumLines,
  toGcPushDivergencePriceLines,
  toGcPushMomentumHistogram,
  toGcPushMomentumPushLine,
  toGcPushMomentumSignalLine,
  toSupertrendSignalDot,
  toUtcTimestamp,
} from "./lightweightChartsAdapter";
import type { GcPushMomentumPoint } from "./gcPushMomentum";
import type {
  GcPushMomentumDivergence,
  GcPushMomentumEarlyDivergence,
} from "./gcPushMomentumDivergence";
import { DEFAULT_OUTSIDE_BAR_SETTINGS } from "./outsideBar";

function bar(time: number, open: number, high: number, low: number, close: number): Bar {
  return { time, open, high, low, close, volume: 1 };
}

function signal(
  pulse: number,
  level = Math.abs(pulse),
): FvgSignalUpdateMessage {
  return {
    type: "fvg_signal_update",
    symbol: "GC",
    contract: "GC",
    tf: "1m",
    time: 3_600_000,
    direction: Math.sign(pulse),
    level,
    pulse,
    top: 101,
    bottom: 100.5,
    breakoutRatio: 1.8,
    phase: "confirmed",
  };
}

describe("lightweightChartsAdapter time conversion", () => {
  it("converts raw ms timestamps to Lightweight UTC seconds with display offset", () => {
    expect(toUtcTimestamp(1_234, 1_000)).toBe(2);
  });

  it("anchors BigTrade marker time to the active bar bucket", () => {
    // 12:34:27.500 in a 1m chart belongs on the 12:35:00 displayed candle,
    // matching NinjaTrader's BarIndex-based BigTrade placement.
    const base = Date.UTC(2026, 5, 3, 12, 34, 0);
    const tradeTime = base + 27_500;
    expect(toBarDisplayTimestamp(tradeTime, 60_000, 60_000)).toBe(
      Math.floor((base + 60_000) / 1_000),
    );
  });

  it("anchors BigTrade marker time to coarser timeframe buckets", () => {
    const tradeTime = Date.UTC(2026, 5, 3, 12, 7, 42);
    const bucketStart = Date.UTC(2026, 5, 3, 12, 5, 0);
    expect(toBarDisplayTimestamp(tradeTime, 5 * 60_000, 5 * 60_000)).toBe(
      Math.floor((bucketStart + 5 * 60_000) / 1_000),
    );
  });

  it("marks chart bars displayed at 08:00 and 20:00 UTC+7", () => {
    const displayOffsetMs = 0;
    const eightAm = Date.UTC(2026, 5, 3, 1, 0, 0);
    const eightOhOneAm = Date.UTC(2026, 5, 3, 1, 1, 0);
    const eightPm = Date.UTC(2026, 5, 3, 13, 0, 0);
    const ordinaryBar = Date.UTC(2026, 5, 3, 1, 59, 0);

    expect(isUtcPlus7SessionHighlightTime(eightAm, displayOffsetMs)).toBe(true);
    expect(isUtcPlus7SessionHighlightTime(eightOhOneAm, displayOffsetMs)).toBe(false);
    expect(isUtcPlus7SessionHighlightTime(eightPm, displayOffsetMs)).toBe(true);
    expect(isUtcPlus7SessionHighlightTime(ordinaryBar, displayOffsetMs)).toBe(false);
  });

  it("only shows session highlights on M1 and M5", () => {
    expect(isSessionHighlightTimeframeDuration(60_000)).toBe(true);
    expect(isSessionHighlightTimeframeDuration(5 * 60_000)).toBe(true);
    expect(isSessionHighlightTimeframeDuration(15 * 60_000)).toBe(false);
    expect(isSessionHighlightTimeframeDuration(60 * 60_000)).toBe(false);
  });
});

describe("lightweightChartsAdapter volume delta overlay", () => {
  it("uses a fixed overlay price scale near the chart bottom", () => {
    expect(VOLUME_DELTA_OVERLAY_PRICE_SCALE_ID).toBe("volume-delta-overlay");
    expect(VOLUME_DELTA_OVERLAY_SCALE_MARGINS).toEqual({
      top: 0.8,
      bottom: 0.02,
    });
  });
});

describe("lightweightChartsAdapter volume overlay", () => {
  it("uses a dedicated histogram price scale pinned to the chart bottom", () => {
    expect(VOLUME_OVERLAY_PRICE_SCALE_ID).toBe("volume-overlay");
    expect(VOLUME_OVERLAY_SCALE_MARGINS).toEqual({
      top: 0.76,
      bottom: 0,
    });
  });
});

describe("lightweightChartsAdapter Supertrend line breaks", () => {
  it("renders alternating trends as disjoint segments instead of bridged bands", () => {
    const segments = buildSupertrendLineSegments({
      bullish: [
        { time: 1, value: 98 },
        { time: 2, value: 99 },
        { time: 3 },
        { time: 4 },
        { time: 5, value: 101 },
        { time: 6 },
        { time: 7, value: 103 },
      ],
      bearish: [
        { time: 1 },
        { time: 2 },
        { time: 3, value: 104 },
        { time: 4, value: 103 },
        { time: 5 },
        { time: 6 },
        { time: 7 },
      ],
      markers: [],
    });

    expect(segments).toEqual([
      {
        direction: 1,
        points: [
          { time: 1, value: 98 },
          { time: 2, value: 99 },
        ],
      },
      {
        direction: -1,
        points: [
          { time: 3, value: 104 },
          { time: 4, value: 103 },
        ],
      },
      { direction: 1, points: [{ time: 5, value: 101 }] },
      { direction: 1, points: [{ time: 7, value: 103 }] },
    ]);
  });

  it("never returns two active lines when malformed input overlaps", () => {
    expect(
      buildSupertrendLineSegments({
        bullish: [{ time: 1, value: 99 }],
        bearish: [{ time: 1, value: 101 }],
        markers: [],
      }),
    ).toEqual([
      { direction: 1, points: [{ time: 1, value: 99 }] },
    ]);
  });

  it("limits Supertrend line rendering to the latest 500 bars", () => {
    const bullish = Array.from({ length: 505 }, (_, index) => ({
      time: index + 1,
      value: 100 + index,
    }));
    const bearish = bullish.map(({ time }) => ({ time }));
    const segments = buildSupertrendLineSegments({
      bullish,
      bearish,
      markers: [],
    });

    expect(segments).toHaveLength(1);
    expect(segments[0].points).toHaveLength(500);
    expect(segments[0].points[0].time).toBe(6);
    expect(segments[0].points[499].time).toBe(505);
  });

  it("renders a tiny price-anchored dot without arrow or Buy/Sell text", () => {
    const dot = toSupertrendSignalDot(
      {
        time: 2_000,
        direction: -1,
        value: 103.5,
        text: "Sell",
      },
      { bullColor: "green", bearColor: "red" },
      1_000,
    );

    expect(dot).toEqual({
      time: 3,
      position: "atPriceMiddle",
      price: 103.5,
      shape: "circle",
      color: "red",
      id: "supertrend:-1:2000",
      size: 0,
    });
    expect(dot).not.toHaveProperty("text");
  });
});

describe("lightweightChartsAdapter wave delta overlay", () => {
  it("uses a dedicated MBox price scale near the chart bottom", () => {
    expect(WAVE_DELTA_OVERLAY_PRICE_SCALE_ID).toBe("wave-delta-overlay");
    expect(WAVE_DELTA_OVERLAY_SCALE_MARGINS).toEqual({
      top: 0.72,
      bottom: 0.04,
    });
  });

  it("builds hidden wave delta scale data from the MGannSwing internal-5 model", () => {
    const bars = [
      bar(1, 10, 10, 9, 9.5),
      bar(2, 9.5, 11, 9.4, 10.8),
      bar(3, 10.8, 12, 10, 11.7),
      bar(4, 11.7, 11.8, 9, 9.2),
      bar(5, 9.2, 11, 8, 8.4),
    ];
    const deltas = new Map(
      [5, 6, 7, -8, -9].map((closeDelta, index) => [
        bars[index].time,
        {
          time: bars[index].time,
          delta: closeDelta,
          deltaHigh: Math.max(0, closeDelta),
          deltaLow: Math.min(0, closeDelta),
          openDelta: closeDelta,
          closeDelta,
        },
      ]),
    );

    const values = buildWaveDeltaLineData(bars, deltas).map((point) => point.value);

    expect(values).toEqual([5, 11, 18, 10, 1]);
  });

  it("builds MBox wave delta segments from MGann pivots", () => {
    const bars = [
      bar(0, 10, 10, 10, 10),
      bar(1_000, 10.75, 11, 10.5, 10.75),
      bar(2_000, 11.5, 12, 11, 11.5),
      bar(3_000, 12.5, 13, 12, 12.5),
      bar(4_000, 12, 12.5, 11.5, 12),
      bar(5_000, 11.25, 12, 10.5, 11.25),
      bar(6_000, 10.25, 11, 9.5, 10.25),
      bar(7_000, 11.25, 12, 10.5, 11.25),
      bar(8_000, 12.5, 13.5, 11.5, 12.5),
      bar(9_000, 13, 14, 12, 13),
      bar(10_000, 13.5, 14.5, 12.5, 13.5),
      bar(11_000, 12.75, 14, 11.5, 12.75),
      bar(12_000, 11.75, 13, 10.5, 11.75),
      bar(13_000, 10.5, 12, 9, 10.5),
      bar(14_000, 9.75, 11, 8.5, 9.75),
      bar(15_000, 9.5, 10, 9, 9.5),
      bar(16_000, 11, 12, 10, 11),
      bar(17_000, 12.25, 13.5, 11, 12.25),
      bar(18_000, 11, 12, 10, 11),
      bar(19_000, 10, 11, 9, 10),
    ];
    const deltas = new Map(
      bars.map((bar) => [
        bar.time,
        {
          time: bar.time,
          delta: 1,
          deltaHigh: 1,
          deltaLow: 0,
          openDelta: 1,
          closeDelta: 1,
        },
      ]),
    );

    const boxes = buildWaveDeltaMboxData(bars, deltas);

    expect(
      boxes.map((box) => ({
        startTime: box.startTime,
        endTime: box.endTime,
        value: box.value,
        direction: box.direction,
        fillColor: box.fillColor,
      })),
    ).toEqual([
      {
        startTime: 6,
        endTime: 10,
        value: 4,
        direction: 1,
        fillColor: "rgba(90, 130, 220, 0.45)",
      },
      {
        startTime: 10,
        endTime: 14,
        value: 4,
        direction: -1,
        fillColor: "rgba(120, 70, 190, 0.45)",
      },
    ]);
  });

  it("detects confirmed three-pivot bearish divergence", () => {
    const bars = [
      bar(1, 8.5, 9, 8, 8.7),
      bar(2, 9.5, 10, 9, 9.7),
      bar(3, 11, 12, 10, 11.5),
      bar(4, 10.5, 11, 9, 9.5),
      bar(5, 9.5, 10, 8, 8.8),
      bar(6, 10, 11, 9, 10.5),
      bar(7, 13, 14, 11, 13.5),
      bar(8, 11.5, 12, 10, 10.8),
      bar(9, 10.5, 11, 9, 9.8),
      bar(10, 12, 13, 10, 12.5),
      bar(11, 15, 16, 12, 15.5),
      bar(12, 13, 14, 11, 12.8),
      bar(13, 12, 13, 10, 11.5),
    ];
    const deltas = new Map(
      [30, 20, 10, -30, -20, 5, -5, -20, -20, -5, -30, -10, -10].map(
        (closeDelta, index) => [
          bars[index].time,
          {
            time: bars[index].time,
            delta: closeDelta,
            deltaHigh: Math.max(0, closeDelta),
            deltaLow: Math.min(0, closeDelta),
            openDelta: closeDelta,
            closeDelta,
          },
        ],
      ),
    );

    const signals = buildWaveDeltaDivergences(bars, deltas);

    expect(signals).toEqual([
      expect.objectContaining({
        direction: -1,
        pricePivots: [
          expect.objectContaining({ time: 3, price: 12, waveValue: 60 }),
          expect.objectContaining({ time: 7, price: 14, waveValue: 30 }),
          expect.objectContaining({ time: 11, price: 16, waveValue: -10 }),
        ],
      }),
    ]);
  });

  it("enables MGann impulse coloring only on M1 and M5 durations", () => {
    expect(isMgannImpulseTimeframeDuration(60_000)).toBe(true);
    expect(isMgannImpulseTimeframeDuration(300_000)).toBe(true);
    expect(isMgannImpulseTimeframeDuration(180_000)).toBe(false);
    expect(isMgannImpulseTimeframeDuration(900_000)).toBe(false);
  });
});

describe("lightweightChartsAdapter GC Push Momentum", () => {
  const point: GcPushMomentumPoint = {
    time: 60_000,
    push: 2,
    smoothedPush: 1.5,
    signal: 1.25,
    histogram: 0.75,
    histogramChange: 0.25,
    acceleration: 1,
    efficiency: 0.8,
    strong: true,
    flowState: "confirmed",
  };

  it("keeps the histogram visible when optional lines are off", () => {
    expect(gcPushMomentumSeriesVisibility(false)).toEqual({
      histogram: true,
      push: false,
      signal: false,
    });
    expect(gcPushMomentumSeriesVisibility(true)).toEqual({
      histogram: true,
      push: true,
      signal: true,
    });
  });

  it("limits GC Push Momentum rendering to the latest 500 bars", () => {
    const points = Array.from({ length: 505 }, (_, index) => ({
      ...point,
      time: (index + 1) * 60_000,
    }));
    const recent = recentGcPushMomentumPoints(points);

    expect(recent).toHaveLength(500);
    expect(recent[0].time).toBe(6 * 60_000);
    expect(recent[499].time).toBe(505 * 60_000);
  });

  it("renders Push-minus-Signal and dims the unclosed preview", () => {
    const closed = toGcPushMomentumHistogram(point, true);
    const preview = toGcPushMomentumHistogram(point, false);

    expect(closed.value).toBe(0.75);
    expect(preview.value).toBe(0.75);
    expect(closed.color).not.toBe(preview.color);
    expect(preview.color).toContain("0.34");
  });

  it("maps Push and Signal to separate line data", () => {
    expect(toGcPushMomentumPushLine(point)).toEqual({ time: 60, value: 1.5 });
    expect(toGcPushMomentumSignalLine(point)).toEqual({
      time: 60,
      value: 1.25,
    });
  });

  it("uses four MACD-style histogram expansion colors", () => {
    expect(gcPushMomentumColor(point, true)).toContain("0, 200, 83");
    expect(
      gcPushMomentumColor({ ...point, histogramChange: -0.1 }, true),
    ).toContain("76, 139, 103");
    expect(
      gcPushMomentumColor(
        { ...point, histogram: -0.75, histogramChange: -0.25 },
        true,
      ),
    ).toContain("255, 23, 68");
    expect(
      gcPushMomentumColor(
        { ...point, histogram: -0.75, histogramChange: 0.1 },
        true,
      ),
    ).toContain("183, 87, 83");
  });

  it("projects every MGann down-wave histogram below zero in red", () => {
    const display = toGcPushMomentumHistogram(point, true, 0, "mgann_wave", {
      direction: -1,
      confirmed: true,
      expanding: true,
    });

    expect(display.value).toBe(-0.75);
    expect(display.color).toContain("255, 23, 68");
  });

  it("projects MGann up waves above zero and dims a developing wave", () => {
    const display = toGcPushMomentumHistogram(point, true, 0, "mgann_wave", {
      direction: 1,
      confirmed: false,
      expanding: false,
    });

    expect(display.value).toBe(0.75);
    expect(display.color).toContain("76, 139, 103");
    expect(display.color).toContain("0.34");
  });

  it("resets MGann momentum expansion at each wave boundary", () => {
    const bars = [0, 60_000, 120_000, 180_000].map((time) =>
      bar(time, 100, 101, 99, 100),
    );
    const points: GcPushMomentumPoint[] = [
      { ...point, time: 60_000, histogram: -0.5 },
      { ...point, time: 120_000, histogram: 0.25 },
      { ...point, time: 180_000, histogram: 0.1 },
    ];
    const states = gcPushMomentumWaveDisplayStates(bars, points, [
      {
        id: "down",
        startIndex: 0,
        endIndex: 2,
        direction: -1,
        confirmed: true,
      },
      {
        id: "up",
        startIndex: 2,
        endIndex: 3,
        direction: 1,
        confirmed: false,
      },
    ]);

    expect(states.get(60_000)).toMatchObject({
      direction: -1,
      expanding: true,
    });
    expect(states.get(120_000)).toMatchObject({
      direction: -1,
      expanding: false,
    });
    expect(states.get(180_000)).toMatchObject({
      direction: 1,
      confirmed: false,
      expanding: true,
    });
  });

  it("maps confirmed Push divergence onto price and momentum panes", () => {
    const divergence: GcPushMomentumDivergence = {
      id: "push-div:-1:60000:120000:180000",
      direction: -1,
      confirmedAt: 300_000,
      score: 1.5,
      pricePivots: [
        { index: 1, time: 60_000, price: 100, pushIndex: 1, pushTime: 60_000, pushValue: 3 },
        { index: 2, time: 120_000, price: 101, pushIndex: 2, pushTime: 120_000, pushValue: 2 },
        { index: 3, time: 180_000, price: 102, pushIndex: 3, pushTime: 180_000, pushValue: 1 },
      ],
    };

    expect(toGcPushDivergencePriceLines([divergence])).toEqual([
      expect.objectContaining({
        startTime: 60,
        startValue: 100,
        endTime: 180,
        endValue: 102,
        label: "Push Bear Div 3",
        dashed: true,
      }),
    ]);
    expect(toGcPushDivergenceMomentumLines([divergence])).toEqual([
      expect.objectContaining({
        startTime: 60,
        startValue: 3,
        endTime: 180,
        endValue: 1,
        dashed: true,
      }),
    ]);
  });

  it("maps Swing-5-confirmed Div 2 and marks its confirmation bar", () => {
    const divergence: GcPushMomentumEarlyDivergence = {
      id: "push-div-early:-1:60000:180000:300000",
      direction: -1,
      confirmedAt: 300_000,
      confirmationPrice: 98,
      displacementAtr: 1.4,
      breakByWick: false,
      confirmationSwing: {
        index: 2,
        time: 120_000,
        price: 99,
        kind: "low",
      },
      score: 1.2,
      pricePivots: [
        { index: 1, time: 60_000, price: 100, pushIndex: 1, pushTime: 60_000, pushValue: 3 },
        { index: 3, time: 180_000, price: 102, pushIndex: 3, pushTime: 180_000, pushValue: 1 },
      ],
    };

    expect(toGcPushEarlyDivergencePriceLines([divergence])).toEqual([
      expect.objectContaining({
        startTime: 60,
        startValue: 100,
        endTime: 180,
        endValue: 102,
        label: "Push Bear Div 2",
      }),
    ]);
    expect(toGcPushEarlyDivergenceMomentumLines([divergence])).toEqual([
      expect.objectContaining({
        startTime: 60,
        startValue: 3,
        endTime: 180,
        endValue: 1,
        autoscale: true,
      }),
    ]);
    expect(toGcPushEarlyDivergenceMarker(divergence)).toMatchObject({
      time: 300,
      position: "aboveBar",
      shape: "arrowDown",
      text: "Bear Div 2",
    });
  });
});

describe("TDU candle-color delta divergence", () => {
  it("marks bearish candles with positive delta", () => {
    expect(tduDeltaDivergence(101, 100, 25)).toBe(-1);
  });

  it("marks bullish candles with negative delta", () => {
    expect(tduDeltaDivergence(100, 101, -25)).toBe(1);
  });

  it("ignores matching direction, zero delta, and doji bars", () => {
    expect(tduDeltaDivergence(100, 101, 25)).toBe(0);
    expect(tduDeltaDivergence(101, 100, -25)).toBe(0);
    expect(tduDeltaDivergence(100, 101, 0)).toBe(0);
    expect(tduDeltaDivergence(100, 100, 25)).toBe(0);
  });
});

describe("FVG Signal Grader candle colors", () => {
  it("maps bull and bear ultimate signals to cyan and magenta", () => {
    expect(fvgSignalColor(signal(5))).toBe("cyan");
    expect(fvgSignalColor(signal(-5))).toBe("magenta");
  });

  it("keeps bear level 3 distinct from the default down candle", () => {
    expect(fvgSignalColor(signal(-3))).toBe("#ff4500");
    expect(fvgSignalColor(signal(-3))).not.toBe("#8b0000");
  });

  it("uses FVG color before session and Outside Bar recoloring", () => {
    const previous = bar(3_540_000, 100, 100.5, 99.5, 100);
    const current = bar(3_600_000, 99.8, 101, 99, 100.8);
    const outsideBar = {
      ...DEFAULT_OUTSIDE_BAR_SETTINGS,
      enabled: true,
      bullColor: "#123456",
    };

    const candle = toCandle(
      current,
      0,
      previous,
      outsideBar,
      {},
      signal(1),
    );

    expect(candle.color).toBe("lightgreen");
    expect(candle.borderColor).toBe("lightgreen");
    expect(candle.wickColor).toBe("lightgreen");
  });

  it("uses FVG color before MGann impulse recoloring", () => {
    const current = bar(3_600_000, 99.8, 101, 99, 100.8);

    const candle = toCandle(
      current,
      0,
      undefined,
      DEFAULT_OUTSIDE_BAR_SETTINGS,
      {},
      signal(-3),
      "#ff8c00",
    );

    expect(candle.color).toBe("#ff4500");
    expect(candle.borderColor).toBe("#ff4500");
    expect(candle.wickColor).toBe("#ff4500");
  });

  it("uses MGann impulse color before session and Outside Bar recoloring", () => {
    const previous = bar(3_540_000, 100, 100.5, 99.5, 100);
    const current = bar(3_600_000, 99.8, 101, 99, 100.8);
    const outsideBar = {
      ...DEFAULT_OUTSIDE_BAR_SETTINGS,
      enabled: true,
      bullColor: "#123456",
    };

    const candle = toCandle(
      current,
      0,
      previous,
      outsideBar,
      {},
      undefined,
      "#00a6a6",
    );

    expect(candle.color).toBe("#00a6a6");
    expect(candle.borderColor).toBe("#00a6a6");
    expect(candle.wickColor).toBe("#00a6a6");
  });
});
