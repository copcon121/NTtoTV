import { describe, expect, it } from "vitest";

import type { Bar } from "../cache/types";
import goldenFixture from "../../../test-fixtures/supertrend/pine_v4_supertrend_golden.json";
import {
  DEFAULT_SUPERTREND_SETTINGS,
  advanceSupertrend,
  calculateSupertrend,
  initialSupertrendAccumulator,
  normalizeSupertrendSettings,
  supertrendMarkerForPoint,
  updateSupertrendRuntime,
} from "./supertrend";

function bar(
  time: number,
  open: number,
  high: number,
  low: number,
  close: number,
  closed?: boolean,
): Bar {
  return { time, open, high, low, close, volume: 1, closed };
}

const BARS = [
  bar(0, 10, 11, 9, 10),
  bar(1, 10, 12, 10, 11),
  bar(2, 11, 13, 11, 12),
  bar(3, 12, 14, 12, 13),
  bar(4, 13, 13, 8, 9),
  bar(5, 9, 10, 6, 7),
  bar(6, 7, 15, 7, 14),
];

describe("Supertrend Pine-v4 parity", () => {
  it("normalizes unsafe profile and settings values", () => {
    expect(
      normalizeSupertrendSettings({
        enabled: true,
        period: 999,
        multiplier: -5,
        atrMethod: "sma",
        source: "ohlc4",
        bullColor: "",
      }),
    ).toEqual({
      ...DEFAULT_SUPERTREND_SETTINGS,
      enabled: true,
      period: 500,
      multiplier: 0.1,
      atrMethod: "sma",
      source: "ohlc4",
    });
  });

  it("matches Wilder RMA seeding, recurrence, bands and flips", () => {
    const result = calculateSupertrend(BARS, {
      enabled: true,
      period: 3,
      multiplier: 1,
    });

    expect(result.points.slice(0, 2).map((point) => point.atr)).toEqual([
      undefined,
      undefined,
    ]);
    expect(result.points[2].atr).toBeCloseTo(2, 10);
    expect(result.points[4].atr).toBeCloseTo(3, 10);
    expect(result.points[5].atr).toBeCloseTo(10 / 3, 10);
    expect(result.points[2]).toMatchObject({ up: 10, down: 14, trend: 1 });
    expect(result.points[3]).toMatchObject({ up: 11, down: 14, trend: 1 });
    expect(result.points[4]).toMatchObject({
      up: 11,
      down: 13.5,
      trend: -1,
      sellSignal: true,
    });
    expect(result.points[6]).toMatchObject({
      trend: 1,
      buySignal: true,
    });
  });

  it("supports the Pine alternative SMA ATR without changing the band recurrence", () => {
    const result = calculateSupertrend(BARS, {
      period: 3,
      multiplier: 1,
      atrMethod: "sma",
    });

    expect(result.points[2].atr).toBeUndefined();
    expect(result.points[3].atr).toBeCloseTo(2, 10);
    expect(result.points[4].atr).toBeCloseTo(3, 10);
    expect(result.points[5].atr).toBeCloseTo(11 / 3, 10);
    expect(result.points[6].atr).toBeCloseTo(17 / 3, 10);
  });

  it("matches the shared language-neutral RMA and SMA golden vectors", () => {
    const fixtureBars = goldenFixture.bars as Bar[];
    const toleranceDigits = 10;
    const cases = [
      ["rma", goldenFixture.expected.wilderRma],
      ["sma", goldenFixture.expected.simpleSma],
    ] as const;

    for (const [atrMethod, expected] of cases) {
      const result = calculateSupertrend(fixtureBars, {
        period: goldenFixture.settings.period,
        multiplier: goldenFixture.settings.multiplier,
        source: "hl2",
        atrMethod,
      });
      result.points.forEach((point, index) => {
        const vector = expected[index];
        if (vector.atr === null) expect(point.atr).toBeUndefined();
        else expect(point.atr).toBeCloseTo(vector.atr, toleranceDigits);
        if (vector.finalLower === null) expect(point.up).toBeUndefined();
        else expect(point.up).toBeCloseTo(vector.finalLower, toleranceDigits);
        if (vector.finalUpper === null) expect(point.down).toBeUndefined();
        else expect(point.down).toBeCloseTo(vector.finalUpper, toleranceDigits);
        expect(point.trend).toBe(vector.trend);
        expect(point.buySignal).toBe(vector.buySignal);
        expect(point.sellSignal).toBe(vector.sellSignal);
      });
    }
  });

  it("emits whitespace on the inactive line so trend flips cannot bridge", () => {
    const { overlay } = calculateSupertrend(BARS, {
      period: 3,
      multiplier: 1,
    });

    expect(overlay.bullish[3]).toEqual({ time: 3, value: 11 });
    expect(overlay.bullish[4]).toEqual({ time: 4 });
    expect(overlay.bearish[3]).toEqual({ time: 3 });
    expect(overlay.bearish[4]).toEqual({ time: 4, value: 13.5 });
  });
});

describe("Supertrend realtime state", () => {
  const settings = normalizeSupertrendSettings({
    enabled: true,
    period: 3,
    multiplier: 1,
  });

  it("re-evaluates repeated updates of one open candle from the same closed base", () => {
    const seed = calculateSupertrend(BARS.slice(0, 3), settings, {
      assumeLastBarClosed: true,
    });
    const first = updateSupertrendRuntime(
      seed.runtime,
      bar(3, 12, 16, 12, 15),
      false,
      settings,
    );
    expect(first).toBeDefined();
    const finalBar = bar(3, 12, 14, 9, 10);
    const second = updateSupertrendRuntime(
      first!.state,
      finalBar,
      false,
      settings,
    );
    const bulk = calculateSupertrend([...BARS.slice(0, 3), finalBar], settings);

    expect(second?.point).toEqual(bulk.points[3]);
    expect(second?.point.atr).toBeCloseTo(3, 10);
  });

  it("passes the shared same-timestamp rollback probe", () => {
    const fixtureBars = goldenFixture.bars as Bar[];
    const baseBars = fixtureBars.filter(
      (value) => value.time <= goldenFixture.realtimeRollbackProbe.baseThroughTime,
    );
    const base = calculateSupertrend(baseBars, {
      period: goldenFixture.settings.period,
      multiplier: goldenFixture.settings.multiplier,
      atrMethod: "rma",
      source: "hl2",
    }, { assumeLastBarClosed: true });

    let liveState = base.runtime;
    for (const snapshot of goldenFixture.realtimeRollbackProbe.snapshots) {
      const update = updateSupertrendRuntime(
        liveState,
        snapshot.bar,
        false,
        {
          period: goldenFixture.settings.period,
          multiplier: goldenFixture.settings.multiplier,
          atrMethod: "rma",
          source: "hl2",
        },
      );
      expect(update).toBeDefined();
      liveState = update!.state;
      expect(update!.point.atr).toBeCloseTo(snapshot.expected.atr, 10);
      expect(update!.point.up).toBeCloseTo(snapshot.expected.finalLower, 10);
      expect(update!.point.down).toBeCloseTo(snapshot.expected.finalUpper, 10);
      expect(update!.point.trend).toBe(snapshot.expected.trend);
      expect(update!.point.buySignal).toBe(snapshot.expected.buySignal);
      expect(update!.point.sellSignal).toBe(snapshot.expected.sellSignal);
    }
  });

  it("never creates a marker until the flip candle is confirmed closed", () => {
    const seed = calculateSupertrend(BARS.slice(0, 4), settings, {
      assumeLastBarClosed: true,
    });
    const provisional = updateSupertrendRuntime(
      seed.runtime,
      BARS[4],
      false,
      settings,
    );
    expect(provisional?.point.sellSignal).toBe(true);
    expect(
      supertrendMarkerForPoint(provisional!.point, false, settings, 0),
    ).toBeUndefined();

    const confirmed = updateSupertrendRuntime(
      provisional!.state,
      BARS[4],
      true,
      settings,
    );
    expect(
      supertrendMarkerForPoint(confirmed!.point, true, settings, 0),
    ).toEqual({ time: 4, direction: -1, value: 13.5, text: "Sell" });
  });

  it("uses explicit history closed flags and treats an unknown live tail as provisional", () => {
    const explicitOpen = BARS.map((value, index) => ({
      ...value,
      closed: index < BARS.length - 1,
    }));
    const result = calculateSupertrend(explicitOpen, settings, {
      signalWarmupBars: 0,
    });
    expect(result.overlay.markers.map((marker) => marker.time)).toEqual([4]);

    const replay = calculateSupertrend(BARS, settings, {
      assumeLastBarClosed: true,
      signalWarmupBars: 0,
    });
    expect(replay.overlay.markers.map((marker) => marker.time)).toEqual([4, 6]);
  });

  it("rebuilds deterministically after a historical revision", () => {
    const before = calculateSupertrend(BARS, settings);
    const revisedBars = BARS.map((value, index) =>
      index === 1 ? { ...value, high: 20 } : value,
    );
    const revised = calculateSupertrend(revisedBars, settings);

    expect(revised.points[2].atr).not.toBeCloseTo(before.points[2].atr!, 10);
    let accumulator = initialSupertrendAccumulator();
    const folded = revisedBars.map((value) => {
      const step = advanceSupertrend(accumulator, value, settings);
      accumulator = step.accumulator;
      return step.point;
    });
    expect(folded).toEqual(revised.points);
  });
});
