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

function withClose(source: Bar, close: number): Bar {
  return { ...source, open: close, close };
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

const BEARISH_IMPULSE_DELTAS = delta([
  [4, -30],
  [5, -40],
  [6, -30],
  [7, 10],
  [8, 10],
  [9, 10],
  [10, 10],
  [11, -40],
  [12, -30],
  [13, -30],
  [14, -30],
  [15, 20],
  [16, 20],
]);

const BULLISH_IMPULSE_DELTAS = delta([
  [5, 20],
  [6, 20],
  [7, 20],
  [8, 20],
  [9, 20],
  [10, -10],
  [11, -10],
  [12, -10],
  [13, 30],
  [14, 30],
  [15, 30],
  [16, 40],
  [17, -20],
  [18, -20],
]);

function bearishImpulseBars(): Bar[] {
  return [
    bar(0, 10, 10),
    bar(1, 11, 10.5),
    bar(2, 13, 11),
    bar(3, 15, 12),
    bar(4, 14.5, 11),
    bar(5, 13, 10.2),
    bar(6, 12, 9.8),
    bar(7, 12.5, 10.2),
    bar(8, 13, 10.8),
    bar(9, 14, 12.5),
    bar(10, 14.5, 13),
    bar(11, 13.5, 12),
    bar(12, 12, 10.5),
    bar(13, 10, 9),
    bar(14, 9, 8),
    bar(15, 10, 8.5),
    bar(16, 11, 9),
  ];
}

function bullishImpulseBars(): Bar[] {
  const bars = [
    bar(0, 15, 15),
    bar(1, 14.5, 14),
    bar(2, 14, 13),
    bar(3, 13, 12),
    bar(4, 12, 10),
    bar(5, 11, 10.5),
    bar(6, 12, 11),
    bar(7, 13, 12),
    bar(8, 14, 13),
    bar(9, 15.2, 14),
    bar(10, 14.5, 13),
    bar(11, 13.5, 12),
    bar(12, 12.5, 10.5),
    bar(13, 13.5, 11.5),
    bar(14, 14.5, 12.5),
    bar(15, 15.5, 13.5),
    bar(16, 17, 14.5),
    bar(17, 16, 14),
    bar(18, 15, 13),
  ];
  return bars.map((source) =>
    source.time >= 13 && source.time <= 16 ? withVolume(source, 2) : source,
  );
}

describe("MGannSwing model", () => {
  it("uses fixed swing-2 pivots and appends a live leg for the zigzag line", () => {
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

    expect(MGANN_SWING_SIZE).toBe(2);
    expect(overlay.line).toEqual([
      { time: 0, value: 10 },
      { time: 3, value: 13 },
      { time: 6, value: 9.5 },
      { time: 10, value: 14.5 },
      { time: 14, value: 8.5 },
      { time: 17, value: 13.5 },
      { time: 19, value: 9 },
    ]);
    expect(
      overlay.waveDeltaLabels.map((label) => ({
        time: label.time,
        value: label.value,
      })),
    ).toEqual([
      { time: 3, value: 100 },
      { time: 6, value: -80 },
      { time: 10, value: 40 },
      { time: 14, value: 10 },
      { time: 17, value: 20 },
      { time: 19, value: -10 },
    ]);
  });

  it("refines confirmed swing lows to the lowest wick before the next high pivot", () => {
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
      { time: 0, value: 9 },
      { time: 3, value: 13 },
      { time: 8, value: 7.5 },
      { time: 10, value: 16 },
      { time: 13, value: 8 },
    ]);
  });

  it("builds NT-style # and SP signals from wave volume and VolumeDelta", () => {
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
      withClose(bar(14, 11, 8.5), 9),
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
      ]),
      { smartFilter: false },
    );

    expect(overlay.signals.map((signal) => signal.labels)).toEqual([
      ["SP"],
      ["#"],
    ]);
    expect(overlay.signals.map((signal) => signal.time)).toEqual([14, 17]);
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
      bars.slice(0, 16),
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
        startIndex: 3,
        endIndex: 14,
        w1Length: expect.closeTo(5.2, 5),
        w3Length: expect.closeTo(6.5, 5),
        w1Volume: 3,
        w3Volume: 4,
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
      { time: 6, value: -100 },
      { time: 10, value: 40 },
      { time: 14, value: -130 },
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
      3,
      6,
      10,
      14,
      16,
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
        startIndex: 4,
        endIndex: 16,
        w1Length: expect.closeTo(5.2, 5),
        w3Length: expect.closeTo(6.5, 5),
        w1Volume: 5,
        w3Volume: 8,
        w1Delta: 100,
        w3Delta: 130,
      }),
    ]);
  });

  it("rejects impulses when W3 does not break the prior swing level", () => {
    const bars = bearishImpulseBars().map((source) =>
      source.time === 14 ? { ...source, low: 9.8 } : source,
    );

    const overlay = buildMgannSwingOverlay(bars, BEARISH_IMPULSE_DELTAS, {
      smartFilter: false,
    });

    expect(overlay.impulseWaves).toEqual([]);
  });

  it("rejects bearish impulses when W2 wick breaks the W1 high", () => {
    const bars = bearishImpulseBars().map((source) =>
      source.time === 10 ? { ...source, high: 15.2 } : source,
    );

    const overlay = buildMgannSwingOverlay(bars, BEARISH_IMPULSE_DELTAS, {
      smartFilter: false,
    });

    expect(overlay.impulseWaves).toEqual([]);
  });

  it("rejects bullish impulses when W2 wick breaks the W1 low", () => {
    const bars = bullishImpulseBars().map((source) =>
      source.time === 12 ? { ...source, low: 9.9 } : source,
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
      withClose(bar(10, 14.5, 11.5), 12),
      bar(11, 14, 11.5),
      bar(12, 13, 10.5),
      bar(13, 12, 9),
      withClose(bar(14, 11, 8.5), 11),
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
      ]),
      { smartFilter: false },
    );

    expect(overlay.signals.find((signal) => signal.time === 14)?.labels).toEqual([
      "SP",
    ]);
    expect(overlay.signals.some((signal) => signal.labels.includes("UT"))).toBe(
      false,
    );
  });

  it("wraps NT # labels in brackets when the pivot close chain confirms trend", () => {
    const bars = [
      bar(0, 10, 10),
      bar(1, 11, 10.5),
      bar(2, 12, 11),
      withClose(bar(3, 16, 14), 15),
      bar(4, 12.5, 11.5),
      bar(5, 12, 10.5),
      bar(6, 11, 9.5),
      bar(7, 12, 10.5),
      bar(8, 13.5, 11.5),
      bar(9, 14, 12),
      withClose(bar(10, 15, 13), 14),
      bar(11, 14, 11.5),
      bar(12, 13, 10.5),
      bar(13, 12, 9),
      bar(14, 11, 8.5),
      bar(15, 10, 9),
      bar(16, 12, 10),
      withClose(bar(17, 14, 12), 13),
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
      ]),
      { smartFilter: false },
    );

    expect(overlay.signals.find((signal) => signal.time === 17)?.labels).toEqual([
      "[#]",
    ]);
  });

  it("can apply the NT-style Smart Filter to signals", () => {
    const prefix = Array.from({ length: 220 }, (_, index) =>
      bar(index, index + 2, index + 1),
    );
    const pattern = shiftBars(
      [
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
      ],
      prefix.length,
      300,
    );
    const bars = [...prefix, ...pattern];
    const deltas = delta(
      [
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
      ].map(([time, value]) => [time + prefix.length, value] as [number, number]),
    );

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
