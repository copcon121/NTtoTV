import { describe, expect, it } from "vitest";

import { type Bar } from "../cache/types";
import type { FvgSignalUpdateMessage } from "../socket/messages";
import {
  VOLUME_OVERLAY_PRICE_SCALE_ID,
  VOLUME_OVERLAY_SCALE_MARGINS,
  VOLUME_DELTA_OVERLAY_PRICE_SCALE_ID,
  VOLUME_DELTA_OVERLAY_SCALE_MARGINS,
  CVD_OVERLAY_PRICE_SCALE_ID,
  CVD_OVERLAY_SCALE_MARGINS,
  fvgSignalColor,
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

describe("lightweightChartsAdapter CVD overlay", () => {
  it("uses a dedicated line price scale near the chart bottom", () => {
    expect(CVD_OVERLAY_PRICE_SCALE_ID).toBe("cvd-overlay");
    expect(CVD_OVERLAY_SCALE_MARGINS).toEqual({
      top: 0.72,
      bottom: 0.04,
    });
  });
});

describe("FVG Signal Grader candle colors", () => {
  it("maps bull and bear ultimate signals to cyan and magenta", () => {
    expect(fvgSignalColor(signal(5))).toBe("cyan");
    expect(fvgSignalColor(signal(-5))).toBe("magenta");
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
});
