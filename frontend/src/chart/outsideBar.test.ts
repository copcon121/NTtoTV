import { describe, expect, it } from "vitest";

import {
  DEFAULT_OUTSIDE_BAR_SETTINGS,
  isOutsideBar,
  normalizeOutsideBarSettings,
  outsideBarColor,
  outsideBarSignal,
} from "./outsideBar";
import { type Bar } from "../cache/types";

function ohlc(
  open: number,
  high: number,
  low: number,
  close: number,
  time = 1,
): Bar {
  return { time, open, high, low, close, volume: 1 };
}

describe("outsideBar", () => {
  it("detects only bars whose range exceeds both sides of the prior bar", () => {
    const previous = ohlc(10, 12, 8, 11);

    expect(isOutsideBar(ohlc(11, 13, 7, 12), previous)).toBe(true);
    expect(isOutsideBar(ohlc(11, 12, 7, 12), previous)).toBe(false);
    expect(isOutsideBar(ohlc(11, 13, 8, 12), previous)).toBe(false);
    expect(isOutsideBar(ohlc(11, 13, 7, 12), undefined)).toBe(false);
  });

  it("returns the bullish or bearish configured color", () => {
    const previous = ohlc(10, 12, 8, 11);
    const settings = {
      ...DEFAULT_OUTSIDE_BAR_SETTINGS,
      enabled: true,
    };

    expect(outsideBarColor(ohlc(11, 13, 7, 12), previous, settings)).toBe(
      "#00f329",
    );
    expect(outsideBarColor(ohlc(12, 13, 7, 11), previous, settings)).toBe(
      "#ff9800",
    );
  });

  it("leaves disabled and doji outside bars unstyled", () => {
    const previous = ohlc(10, 12, 8, 11);

    expect(
      outsideBarColor(ohlc(11, 13, 7, 12), previous, DEFAULT_OUTSIDE_BAR_SETTINGS),
    ).toBeUndefined();
    expect(
      outsideBarColor(
        ohlc(11, 13, 7, 11),
        previous,
        { ...DEFAULT_OUTSIDE_BAR_SETTINGS, enabled: true },
      ),
    ).toBeUndefined();
  });

  it("normalizes missing and invalid profile settings", () => {
    expect(
      normalizeOutsideBarSettings({
        enabled: true,
        bullColor: "bad",
        bearColor: "#abc",
        deltaFilter: {
          enabled: true,
          lookbackBars: 999,
          minSamples: 1,
          deltaMultiplier: 0,
          requireRangeExpansion: false,
        },
      }),
    ).toEqual({
      enabled: true,
      bullColor: DEFAULT_OUTSIDE_BAR_SETTINGS.bullColor,
      bearColor: "#abc",
      deltaFilter: {
        ...DEFAULT_OUTSIDE_BAR_SETTINGS.deltaFilter,
        enabled: true,
        lookbackBars: 500,
        minSamples: 3,
        deltaMultiplier: 0.1,
        requireRangeExpansion: false,
      },
    });
  });

  it("filters outside bars against recent M1 delta samples", () => {
    const bars: Bar[] = Array.from({ length: 22 }, (_, index) =>
      ({ ...ohlc(100, 101, 99, 100, index), volume: 100 }),
    );
    bars.push({ time: 22, open: 100, high: 102.5, low: 98.5, close: 99, volume: 130 });
    const deltaByTime = new Map(
      bars.map((bar, index) => [
        bar.time,
        { time: bar.time, closeDelta: index === 22 ? -80 : 50 },
      ]),
    );
    const settings = {
      ...DEFAULT_OUTSIDE_BAR_SETTINGS,
      enabled: true,
      deltaFilter: {
        ...DEFAULT_OUTSIDE_BAR_SETTINGS.deltaFilter,
        enabled: true,
      },
    };

    expect(
      outsideBarSignal(bars[22], bars[21], settings, {
        bars,
        index: 22,
        deltaByTime,
      }),
    ).toBe("sell");
    expect(
      outsideBarColor(bars[22], bars[21], settings, {
        bars,
        index: 22,
        deltaByTime,
      }),
    ).toBe(settings.bearColor);
  });

  it("ignores current volume when the delta filter passes", () => {
    const bars: Bar[] = Array.from({ length: 22 }, (_, index) =>
      ({ ...ohlc(100, 101, 99, 100, index), volume: 100 }),
    );
    bars.push({ time: 22, open: 100, high: 102.5, low: 98.5, close: 99, volume: 1 });
    const deltaByTime = new Map(
      bars.map((bar, index) => [
        bar.time,
        { time: bar.time, closeDelta: index === 22 ? -80 : 50 },
      ]),
    );
    const settings = {
      ...DEFAULT_OUTSIDE_BAR_SETTINGS,
      enabled: true,
      deltaFilter: {
        ...DEFAULT_OUTSIDE_BAR_SETTINGS.deltaFilter,
        enabled: true,
      },
    };

    expect(
      outsideBarColor(bars[22], bars[21], settings, {
        bars,
        index: 22,
        deltaByTime,
      }),
    ).toBe(settings.bearColor);
  });

  it("does not pass the delta filter when current delta is not elevated", () => {
    const bars: Bar[] = Array.from({ length: 22 }, (_, index) =>
      ({ ...ohlc(100, 101, 99, 100, index), volume: 100 }),
    );
    bars.push({ time: 22, open: 100, high: 102.5, low: 98.5, close: 99, volume: 130 });
    const deltaByTime = new Map(
      bars.map((bar, index) => [
        bar.time,
        { time: bar.time, closeDelta: index === 22 ? -30 : 50 },
      ]),
    );
    const settings = {
      ...DEFAULT_OUTSIDE_BAR_SETTINGS,
      enabled: true,
      deltaFilter: {
        ...DEFAULT_OUTSIDE_BAR_SETTINGS.deltaFilter,
        enabled: true,
      },
    };

    expect(
      outsideBarColor(bars[22], bars[21], settings, {
        bars,
        index: 22,
        deltaByTime,
      }),
    ).toBeUndefined();
  });
});
