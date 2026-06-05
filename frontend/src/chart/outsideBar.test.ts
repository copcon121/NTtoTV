import { describe, expect, it } from "vitest";

import {
  DEFAULT_OUTSIDE_BAR_SETTINGS,
  isOutsideBar,
  normalizeOutsideBarSettings,
  outsideBarColor,
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
      }),
    ).toEqual({
      enabled: true,
      bullColor: DEFAULT_OUTSIDE_BAR_SETTINGS.bullColor,
      bearColor: "#abc",
    });
  });
});
