import { describe, expect, it } from "vitest";

import type { Bar } from "../cache/types";
import {
  DEFAULT_XKONTROL_DISPLAY_SETTINGS,
  XKontrolEngine,
  calculateXKontrol,
  normalizeXKontrolDisplaySettings,
  xKontrolLevelVisible,
  type XKontrolCode,
} from "./xKontrol";

function bar(
  index: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number,
): Bar {
  return { time: index * 60_000, open, high, low, close, volume };
}

function deterministicBars(count: number): Bar[] {
  const bars: Bar[] = [];
  let price = 2_600;
  for (let index = 0; index < count; index += 1) {
    const drift = (((index * 17) % 11) - 5) * 0.13;
    const open = price;
    const close = open + drift;
    bars.push(
      bar(
        index,
        open,
        Math.max(open, close) + 0.2 + ((index * 7) % 5) * 0.1,
        Math.min(open, close) - 0.2 - ((index * 3) % 4) * 0.1,
        close,
        80 + ((index * 37) % 700),
      ),
    );
    price = close;
  }
  return bars;
}

function nonZeroCodes(
  codes: readonly XKontrolCode[],
  from = 0,
  to = codes.length,
): Array<[number, XKontrolCode]> {
  const result: Array<[number, XKontrolCode]> = [];
  for (let index = from; index < Math.min(to, codes.length); index += 1) {
    if (codes[index] !== 0) result.push([index, codes[index]]);
  }
  return result;
}

describe("XKontrolEngine", () => {
  it("normalizes and applies the three independent display levels", () => {
    expect(normalizeXKontrolDisplaySettings()).toEqual(
      DEFAULT_XKONTROL_DISPLAY_SETTINGS,
    );
    const settings = normalizeXKontrolDisplaySettings({
      showInitial: false,
      showStrong: true,
      showTotal: false,
    });
    expect(xKontrolLevelVisible(1, settings)).toBe(false);
    expect(xKontrolLevelVisible(2, settings)).toBe(true);
    expect(xKontrolLevelVisible(3, settings)).toBe(false);
  });

  it("matches the native 20-bar gate and first eligible Total signal", () => {
    const bars = Array.from({ length: 20 }, (_, index) =>
      bar(index, 9_000 + index, 9_100 + index, 8_900 + index, 9_050 + index, 1_000_000),
    );
    bars.push(bar(20, 2_600, 2_601, 2_599.8, 2_600.7, 100));

    const engine = new XKontrolEngine();
    engine.setBars(bars);

    expect(engine.codes.slice(0, 20)).toEqual(new Array(20).fill(0));
    expect(engine.codes[20]).toBe(3);
    expect(engine.signals(bars)).toEqual([
      {
        time: 20 * 60_000,
        price: 2_599.8,
        code: 3,
        side: "offers",
        level: 3,
      },
    ]);
  });

  it("recalculates the active slot while retaining OnPriceChange state", () => {
    const bars = deterministicBars(20);
    const engine = new XKontrolEngine();
    engine.setBars(bars);

    expect(engine.appendBar(bar(20, 2_600, 2_601, 2_599.8, 2_600.7, 100))).toBe(3);
    expect(engine.updateLastBar(bar(20, 2_600.7, 2_601, 2_599, 2_599.5, 100))).toBe(0);
    expect(engine.updateLastBar(bar(20, 2_600, 2_601, 2_599.8, 2_600.7, 100))).toBe(3);
    expect(engine.length).toBe(21);
  });

  it("keeps the recovered float32/ring behaviour across the 300-slot wrap", () => {
    const bars = deterministicBars(360);
    const engine = new XKontrolEngine();
    engine.setBars(bars);

    expect(nonZeroCodes(engine.codes, 20, 60)).toEqual([
      [20, 3],
      [27, 3],
      [29, 1],
      [31, 3],
      [33, -3],
      [40, 1],
      [44, -2],
      [48, -3],
      [51, 3],
      [55, -3],
      [59, -2],
    ]);
    expect(nonZeroCodes(engine.codes, 290)).toEqual([
      [291, 1],
      [295, 3],
      [297, -1],
      [299, -3],
      [304, 2],
      [308, -1],
      [315, 2],
      [319, -2],
      [324, 1],
      [325, -1],
      [326, 2],
      [328, 3],
      [330, -3],
      [337, 3],
      [343, -1],
      [348, 2],
      [350, 3],
      [352, -3],
      [358, -2],
      [359, 2],
    ]);
    expect(calculateXKontrol(bars)).toEqual(engine.signals(bars));
  });

  it("rejects a non-positive tick size", () => {
    expect(() => new XKontrolEngine(0)).toThrow(/tickSize/);
  });
});
