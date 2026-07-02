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
  buildWaveDeltaDivergences,
  buildWaveDeltaLineData,
  fvgSignalColor,
  isMgannImpulseTimeframeDuration,
  isUtcPlus7SessionHighlightTime,
  toBarDisplayTimestamp,
  toCandle,
  toUtcTimestamp,
} from "./lightweightChartsAdapter";
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

  it("marks chart bars displayed at 08:01 and 20:01 UTC+7", () => {
    const oneMinute = 60_000;
    const oldEightAm = Date.UTC(2026, 5, 3, 0, 59, 0);
    const eightOhOneAm = Date.UTC(2026, 5, 3, 1, 0, 0);
    const eightOhOnePm = Date.UTC(2026, 5, 3, 13, 0, 0);
    const ordinaryBar = Date.UTC(2026, 5, 3, 1, 1, 0);

    expect(isUtcPlus7SessionHighlightTime(oldEightAm, oneMinute)).toBe(false);
    expect(isUtcPlus7SessionHighlightTime(eightOhOneAm, oneMinute)).toBe(true);
    expect(isUtcPlus7SessionHighlightTime(eightOhOnePm, oneMinute)).toBe(true);
    expect(isUtcPlus7SessionHighlightTime(ordinaryBar, oneMinute)).toBe(false);
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

describe("lightweightChartsAdapter wave delta overlay", () => {
  it("uses a dedicated line price scale near the chart bottom", () => {
    expect(WAVE_DELTA_OVERLAY_PRICE_SCALE_ID).toBe("wave-delta-overlay");
    expect(WAVE_DELTA_OVERLAY_SCALE_MARGINS).toEqual({
      top: 0.72,
      bottom: 0.04,
    });
  });

  it("builds the wave delta line from the MGannSwing swing-2 model", () => {
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

    expect(values).toEqual([5, 6, 13, -8, -17]);
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
          expect.objectContaining({ time: 3, price: 12, waveValue: 30 }),
          expect.objectContaining({ time: 7, price: 14, waveValue: 5 }),
          expect.objectContaining({ time: 11, price: 16, waveValue: -5 }),
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
