import { describe, expect, it } from "vitest";

import {
  buildMgannSwingOverlay,
  MGANN_SWING_SIZE,
  normalizeMgannSwingSettings,
} from "./mgannSwing";
import type { Bar } from "../cache/types";

function bar(time: number, high: number, low: number): Bar {
  const close = (high + low) / 2;
  return { time, open: close, high, low, close, volume: 1 };
}

function withVolume(source: Bar, volume: number): Bar {
  return { ...source, volume };
}

function shiftBars(bars: readonly Bar[], timeOffset: number, priceOffset: number): Bar[] {
  return bars.map((source) => ({
    time: source.time + timeOffset,
    open: source.open + priceOffset,
    high: source.high + priceOffset,
    low: source.low + priceOffset,
    close: source.close + priceOffset,
    volume: source.volume,
  }));
}

function delta(points: readonly [number, number][]) {
  return new Map(
    points.map(([time, closeDelta]) => [
      time,
      {
        time,
        delta: closeDelta * 10,
        closeDelta,
      },
    ]),
  );
}

function internalFiveSwingBars(
  pivotPrices: readonly number[],
  tailPrice: number,
  wide = false,
): Bar[] {
  const step = MGANN_SWING_SIZE + 1;
  const firstPivotIndex = MGANN_SWING_SIZE;
  const lastPivotIndex = firstPivotIndex + (pivotPrices.length - 1) * step;
  const endIndex = lastPivotIndex + MGANN_SWING_SIZE;
  const out: Bar[] = [];
  const previousPrice = pivotPrices[1] ?? pivotPrices[0];

  for (let index = 0; index <= endIndex; index += 1) {
    let value: number;
    if (index <= firstPivotIndex) {
      value =
        previousPrice +
        ((pivotPrices[0] - previousPrice) * index) / firstPivotIndex;
    } else if (index <= lastPivotIndex) {
      const segment = Math.min(
        Math.floor((index - firstPivotIndex) / step),
        pivotPrices.length - 2,
      );
      const offset = index - firstPivotIndex - segment * step;
      const start = pivotPrices[segment];
      const end = pivotPrices[segment + 1];
      value = start + ((end - start) * offset) / step;
    } else {
      const offset = index - lastPivotIndex;
      const start = pivotPrices[pivotPrices.length - 1];
      value = start + ((tailPrice - start) * offset) / MGANN_SWING_SIZE;
    }

    out.push(wide ? bar(index, value + 0.5, value - 0.5) : bar(index, value, value));
  }

  return out;
}

const BEARISH_IMPULSE_DELTAS = delta([
  [12, -20],
  [13, -20],
  [14, -20],
  [15, -20],
  [16, -10],
  [17, -10],
  [18, 10],
  [19, 10],
  [20, 5],
  [21, 5],
  [22, 5],
  [23, 5],
  [24, -30],
  [25, -30],
  [26, -20],
  [27, -20],
  [28, -15],
  [29, -15],
]);

const BULLISH_IMPULSE_DELTAS = delta([
  [12, 20],
  [13, 20],
  [14, 20],
  [15, 20],
  [16, 10],
  [17, 10],
  [18, -10],
  [19, -10],
  [20, -5],
  [21, -5],
  [22, -5],
  [23, -5],
  [24, 30],
  [25, 30],
  [26, 20],
  [27, 20],
  [28, 15],
  [29, 15],
]);

function bearishImpulseBars(): Bar[] {
  return internalFiveSwingBars([12, 15.2, 10, 14, 7.5, 12], 11);
}

function bullishImpulseBars(): Bar[] {
  const bars = internalFiveSwingBars([13, 9.8, 15, 11, 17.5, 12], 13);
  return bars.map((source) =>
    source.time >= 24 && source.time <= 29 ? withVolume(source, 2) : source,
  );
}

describe("MGannSwing model", () => {
  it("uses fixed SMC internal-5 confirmed pivots for the zigzag line", () => {
    const bars = [
      bar(0, 10, 10),
      bar(1, 11, 10.5),
      bar(2, 12, 11),
      bar(3, 13, 12),
      bar(4, 12.5, 11.5),
      bar(5, 12, 10.5),
      bar(6, 11, 9.5),
      bar(7, 12, 10.5),
      bar(8, 13.5, 11.5),
      bar(9, 14, 12),
      bar(10, 14.5, 12.5),
      bar(11, 14, 11.5),
      bar(12, 13, 10.5),
      bar(13, 12, 9),
      bar(14, 11, 8.5),
      bar(15, 10, 9),
      bar(16, 12, 10),
      bar(17, 13.5, 11),
      bar(18, 12, 10),
      bar(19, 11, 9),
    ];

    const overlay = buildMgannSwingOverlay(
      bars,
      delta([
        [1, 30],
        [2, 30],
        [3, 40],
        [4, -20],
        [5, -30],
        [6, -30],
        [7, 10],
        [8, 10],
        [9, 10],
        [10, 10],
        [11, 2],
        [12, 3],
        [13, 2],
        [14, 3],
        [15, 5],
        [16, 5],
        [17, 10],
        [18, -4],
        [19, -6],
      ]),
      { waveDeltaNumbersImpulseOnly: false },
    );

    expect(MGANN_SWING_SIZE).toBe(5);
    expect(overlay.line).toEqual([
      { time: 6, value: 9.5 },
      { time: 10, value: 14.5 },
      { time: 14, value: 8.5 },
    ]);
    expect(
      overlay.waveDeltaLabels.map((label) => ({
        time: label.time,
        value: label.value,
      })),
    ).toEqual([
      { time: 10, value: 40 },
      { time: 14, value: 10 },
    ]);
  });

  it("uses SMC internal-5 confirmed pivots without segment-extreme refinement", () => {
    const bars = [
      bar(0, 10, 9),
      bar(1, 11, 10),
      bar(2, 12, 11),
      bar(3, 13, 12),
      bar(4, 12, 10),
      bar(5, 11, 9),
      bar(6, 12, 8),
      bar(7, 13, 9),
      bar(8, 14, 7.5),
      bar(9, 15, 10),
      bar(10, 16, 11),
      bar(11, 15, 10),
      bar(12, 14, 9),
      bar(13, 13, 8),
    ];

    const overlay = buildMgannSwingOverlay(bars, delta([]), {
      smartFilter: false,
      waveDeltaNumbersImpulseOnly: false,
    });

    expect(overlay.line).toEqual([
      { time: 8, value: 7.5 },
    ]);
  });

  it("builds NT-style # signals from internal-5 waves", () => {
    const bars = internalFiveSwingBars([10, 16, 12, 15, 13, 14], 11);

    const overlay = buildMgannSwingOverlay(bars, delta([]), {
      smartFilter: false,
    });
    expect(overlay.signals.map((signal) => signal.labels)).toEqual([["#"]]);
    expect(overlay.signals.map((signal) => signal.time)).toEqual([35]);
  });

  it("normalizes missing settings to line and signals enabled", () => {
    expect(normalizeMgannSwingSettings({ showSignals: false })).toEqual({
      showWaveDelta: true,
      showWaveDeltaNumbers: false,
      waveDeltaNumbersImpulseOnly: true,
      showSwingLine: true,
      showSignals: false,
      showImpulseWaves: true,
      impulseLengthMultiplier: 1.1,
      impulseVolumeMultiplier: 1.2,
      impulseBreakTicks: 1,
      smartFilter: true,
    });
  });

  it("detects a confirmed bearish impulse wave after W4 confirms W3", () => {
    const bars = bearishImpulseBars();
    const beforeConfirmation = buildMgannSwingOverlay(
      bars.slice(0, 34),
      BEARISH_IMPULSE_DELTAS,
      { smartFilter: false },
    );
    const confirmed = buildMgannSwingOverlay(bars, BEARISH_IMPULSE_DELTAS, {
      smartFilter: false,
    });

    expect(beforeConfirmation.impulseWaves).toEqual([]);
    expect(confirmed.impulseWaves).toEqual([
      expect.objectContaining({
        direction: -1,
        startIndex: 11,
        endIndex: 29,
        w1Length: expect.closeTo(5.2, 5),
        w3Length: expect.closeTo(6.5, 5),
        w1Volume: 6,
        w3Volume: 6,
        w1Delta: -100,
        w3Delta: -130,
      }),
    ]);
    expect(
      confirmed.waveDeltaLabels.map((label) => ({
        time: label.time,
        value: label.value,
      })),
    ).toEqual([
      { time: 17, value: -100 },
      { time: 23, value: 40 },
      { time: 29, value: -130 },
    ]);
  });

  it("can show full wave delta numbers when impulse-only mode is disabled", () => {
    const overlay = buildMgannSwingOverlay(
      bearishImpulseBars(),
      BEARISH_IMPULSE_DELTAS,
      {
        smartFilter: false,
        waveDeltaNumbersImpulseOnly: false,
      },
    );

    expect(overlay.waveDeltaLabels.map((label) => label.time)).toEqual([
      11,
      17,
      23,
      29,
      35,
    ]);
  });

  it("detects a confirmed bullish impulse wave as the bearish mirror", () => {
    const overlay = buildMgannSwingOverlay(
      bullishImpulseBars(),
      BULLISH_IMPULSE_DELTAS,
      {
        smartFilter: false,
      },
    );

    expect(overlay.impulseWaves).toEqual([
      expect.objectContaining({
        direction: 1,
        startIndex: 11,
        endIndex: 29,
        w1Length: expect.closeTo(5.2, 5),
        w3Length: expect.closeTo(6.5, 5),
        w1Volume: 6,
        w3Volume: 12,
        w1Delta: 100,
        w3Delta: 130,
      }),
    ]);
  });

  it("rejects impulses when W3 does not break the prior swing level", () => {
    const bars = internalFiveSwingBars([7, 15.2, 10, 14, 9.95, 12], 11);

    const overlay = buildMgannSwingOverlay(bars, BEARISH_IMPULSE_DELTAS, {
      smartFilter: false,
    });

    expect(overlay.impulseWaves).toEqual([]);
  });

  it("rejects bearish impulses when W2 wick breaks the W1 high", () => {
    const bars = bearishImpulseBars().map((source) =>
      source.time === 23 ? { ...source, high: 15.3 } : source,
    );

    const overlay = buildMgannSwingOverlay(bars, BEARISH_IMPULSE_DELTAS, {
      smartFilter: false,
    });

    expect(overlay.impulseWaves).toEqual([]);
  });

  it("rejects bullish impulses when W2 wick breaks the W1 low", () => {
    const bars = bullishImpulseBars().map((source) =>
      source.time === 23 ? { ...source, low: 9.7 } : source,
    );

    const overlay = buildMgannSwingOverlay(bars, BULLISH_IMPULSE_DELTAS, {
      smartFilter: false,
    });

    expect(overlay.impulseWaves).toEqual([]);
  });

  it("rejects impulses when W3 fails configured length or volume thresholds", () => {
    const bars = bearishImpulseBars();

    const strictLength = buildMgannSwingOverlay(bars, BEARISH_IMPULSE_DELTAS, {
      smartFilter: false,
      impulseLengthMultiplier: 2,
    });
    const strictDelta = buildMgannSwingOverlay(bars, BEARISH_IMPULSE_DELTAS, {
      smartFilter: false,
      impulseVolumeMultiplier: 2,
    });

    expect(strictLength.impulseWaves).toEqual([]);
    expect(strictDelta.impulseWaves).toEqual([]);
  });

  it("places NT Spring/UpThrust signals on the prior pivot", () => {
    const bars = internalFiveSwingBars([10, 16, 12, 15, 11, 14], 12, true);
    const overlay = buildMgannSwingOverlay(bars, delta([]), {
      smartFilter: false,
    });

    expect(overlay.signals.find((signal) => signal.time === 29)?.labels).toEqual([
      "SP",
    ]);
    expect(overlay.signals.some((signal) => signal.labels.includes("UT"))).toBe(
      false,
    );
  });

  it("wraps NT # labels in brackets when the pivot close chain confirms trend", () => {
    const bars = internalFiveSwingBars([10, 16, 12, 15, 11, 14], 12, true);
    const overlay = buildMgannSwingOverlay(bars, delta([]), {
      smartFilter: false,
    });

    expect(overlay.signals.find((signal) => signal.time === 35)?.labels).toEqual([
      "[#]",
    ]);
  });

  it("can apply the NT-style Smart Filter to signals", () => {
    const prefix = Array.from({ length: 220 }, (_, index) =>
      bar(index, index + 2, index + 1),
    );
    const pattern = shiftBars(
      internalFiveSwingBars([10, 16, 12, 15, 13, 14], 11),
      prefix.length,
      300,
    );
    const bars = [...prefix, ...pattern];
    const deltas = delta([]);

    const unfiltered = buildMgannSwingOverlay(bars, deltas, {
      smartFilter: false,
    });
    const filtered = buildMgannSwingOverlay(bars, deltas, {
      smartFilter: true,
    });

    expect(unfiltered.signals.length).toBeGreaterThan(filtered.signals.length);
    expect(filtered.signals.every((signal) => signal.kind === "low")).toBe(true);
  });
});
