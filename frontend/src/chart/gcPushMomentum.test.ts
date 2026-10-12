import { describe, expect, it } from "vitest";

import { type Bar } from "../cache/types";
import {
  DEFAULT_GC_PUSH_MOMENTUM_SETTINGS,
  calculateGcPushMomentum,
  normalizeGcPushMomentumSettings,
  type GcPushMomentumDelta,
  type GcPushMomentumSettings,
} from "./gcPushMomentum";

const MINUTE = 60_000;

function barsFromReturns(
  returns: readonly number[],
  start = 100,
  scale = 1,
  startTime = 0,
  durationMs = MINUTE,
): Bar[] {
  let close = start * scale;
  const bars: Bar[] = [
    { time: startTime, open: close, high: close, low: close, close, volume: 100 },
  ];
  for (let index = 0; index < returns.length; index += 1) {
    const previous = close;
    close *= Math.exp(returns[index]);
    bars.push({
      time: startTime + (index + 1) * durationMs,
      open: previous,
      high: Math.max(previous, close),
      low: Math.min(previous, close),
      close,
      volume: 100,
    });
  }
  return bars;
}

function testSettings(
  overrides: Partial<GcPushMomentumSettings> = {},
): GcPushMomentumSettings {
  return normalizeGcPushMomentumSettings({
    ...DEFAULT_GC_PUSH_MOMENTUM_SETTINGS,
    horizonBars: 2,
    accelerationBars: 1,
    volatilityHalfLifeBars: 4,
    efficiencyLookbackBars: 2,
    warmupBars: 4,
    percentileLookbackBars: 8,
    strongPercentile: 0.75,
    flowPercentile: 0.5,
    barDurationMs: MINUTE,
    ...overrides,
  });
}

function deltasFor(
  bars: readonly Bar[],
  signedRatio: number,
  missingTime?: number,
): GcPushMomentumDelta[] {
  return bars
    .filter((bar) => bar.time !== missingTime)
    .map((bar) => ({ time: bar.time, volume: 100, delta: 100 * signedRatio }));
}

function last<T>(values: readonly T[]): T | undefined {
  return values[values.length - 1];
}

describe("GC Push Momentum", () => {
  it("keeps constant-price output finite and non-strong", () => {
    const bars = barsFromReturns(new Array(12).fill(0));
    const points = calculateGcPushMomentum(bars, [], testSettings());

    expect(points.length).toBeGreaterThan(0);
    for (const point of points) {
      expect(Number.isFinite(point.push)).toBe(true);
      expect(Number.isFinite(point.acceleration)).toBe(true);
      expect(point.push).toBe(0);
      expect(point.strong).toBe(false);
      expect(point.flowState).toBe("unavailable");
    }
  });

  it("is invariant to a change of price scale", () => {
    const returns = [0.001, 0.002, -0.001, 0.003, 0.001, -0.002, 0.004, 0.002];
    const base = calculateGcPushMomentum(
      barsFromReturns(returns, 100, 1),
      [],
      testSettings(),
    );
    const scaled = calculateGcPushMomentum(
      barsFromReturns(returns, 100, 25),
      [],
      testSettings(),
    );

    expect(scaled).toHaveLength(base.length);
    base.forEach((point, index) => {
      expect(scaled[index].push).toBeCloseTo(point.push, 10);
      expect(scaled[index].smoothedPush).toBeCloseTo(point.smoothedPush, 10);
      expect(scaled[index].signal).toBeCloseTo(point.signal, 10);
      expect(scaled[index].histogram).toBeCloseTo(point.histogram, 10);
      expect(scaled[index].acceleration).toBeCloseTo(point.acceleration, 10);
      expect(scaled[index].efficiency).toBeCloseTo(point.efficiency, 10);
    });
  });

  it("builds a causal EMA signal and Push-minus-Signal histogram", () => {
    const settings = testSettings({
      pushSmoothingBars: 3,
      signalSmoothingBars: 3,
    });
    const points = calculateGcPushMomentum(
      barsFromReturns([
        0.001, -0.001, 0.002, 0.001, -0.002, 0.003, 0.004, -0.001,
      ]),
      [],
      settings,
    );

    expect(points.length).toBeGreaterThan(1);
    expect(points[0].smoothedPush).toBeCloseTo(points[0].push, 12);
    expect(points[0].signal).toBeCloseTo(points[0].smoothedPush, 12);
    expect(points[0].histogram).toBeCloseTo(0, 12);
    for (let index = 1; index < points.length; index += 1) {
      const expectedSmoothedPush =
        0.5 * points[index].push + 0.5 * points[index - 1].smoothedPush;
      const expectedSignal =
        0.5 * points[index].smoothedPush + 0.5 * points[index - 1].signal;
      expect(points[index].smoothedPush).toBeCloseTo(expectedSmoothedPush, 12);
      expect(points[index].signal).toBeCloseTo(expectedSignal, 12);
      expect(points[index].histogram).toBeCloseTo(
        points[index].smoothedPush - points[index].signal,
        12,
      );
      expect(points[index].histogramChange).toBeCloseTo(
        points[index].histogram - points[index - 1].histogram,
        12,
      );
    }
  });

  it("mirrors direction when every log return is negated", () => {
    const returns = [0.001, 0.002, -0.001, 0.003, 0.001, -0.002, 0.004, 0.002];
    const positive = calculateGcPushMomentum(
      barsFromReturns(returns),
      [],
      testSettings(),
    );
    const inverse = calculateGcPushMomentum(
      barsFromReturns(returns.map((value) => -value)),
      [],
      testSettings(),
    );

    positive.forEach((point, index) => {
      expect(inverse[index].push).toBeCloseTo(-point.push, 10);
      expect(inverse[index].acceleration).toBeCloseTo(-point.acceleration, 10);
      expect(inverse[index].efficiency).toBeCloseTo(point.efficiency, 10);
    });
  });

  it("does not revise historical values when a future shock is appended", () => {
    const returns = [0.001, -0.001, 0.002, 0.001, -0.002, 0.001, 0.002, -0.001];
    const bars = barsFromReturns(returns);
    const before = calculateGcPushMomentum(bars, [], testSettings());
    const after = calculateGcPushMomentum(
      [...bars, ...barsFromReturns([0.2], bars[bars.length - 1].close, 1, bars[bars.length - 1].time).slice(1)],
      [],
      testSettings(),
    );

    expect(after.slice(0, before.length)).toEqual(before);
  });

  it("carries a warmed model across a gap but refills structural lookbacks", () => {
    const first = barsFromReturns(new Array(12).fill(0.001));
    const second = barsFromReturns(
      new Array(3).fill(0.001),
      first[first.length - 1].close,
      1,
      first[first.length - 1].time + 10 * MINUTE,
    );
    const points = calculateGcPushMomentum(
      [...first, ...second],
      [],
      testSettings({ warmupBars: 8 }),
    );
    const resumed = points.filter((point) => point.time >= second[0].time);

    expect(resumed.map((point) => point.time)).toEqual([
      second[0].time + 2 * MINUTE,
      second[0].time + 3 * MINUTE,
    ]);
    expect(resumed[0].smoothedPush).toBeCloseTo(resumed[0].push, 12);
    expect(resumed[0].signal).toBeCloseTo(resumed[0].smoothedPush, 12);
    expect(resumed[0].histogram).toBeCloseTo(0, 12);
  });

  it("uses the configured five-minute duration when detecting M5 gaps", () => {
    const fiveMinutes = 5 * MINUTE;
    const first = barsFromReturns(
      new Array(12).fill(0.001),
      100,
      1,
      0,
      fiveMinutes,
    );
    const second = barsFromReturns(
      new Array(3).fill(0.001),
      first[first.length - 1].close,
      1,
      first[first.length - 1].time + 60 * MINUTE,
      fiveMinutes,
    );
    const points = calculateGcPushMomentum(
      [...first, ...second],
      [],
      testSettings({ barDurationMs: fiveMinutes, warmupBars: 8 }),
    );
    const resumed = points.filter((point) => point.time >= second[0].time);

    expect(resumed.map((point) => point.time)).toEqual([
      second[0].time + 2 * fiveMinutes,
      second[0].time + 3 * fiveMinutes,
    ]);
  });

  it("uses exact delta volume and distinguishes confirm, conflict, and missing", () => {
    const bars = barsFromReturns(new Array(12).fill(0.001));
    const settings = testSettings({ warmupBars: 4 });
    const confirmed = calculateGcPushMomentum(
      bars,
      deltasFor(bars, 0.4),
      settings,
    );
    const conflict = calculateGcPushMomentum(
      bars,
      deltasFor(bars, -0.4),
      settings,
    );
    const missing = calculateGcPushMomentum(
      bars,
      deltasFor(bars, 0.4, bars[bars.length - 1].time),
      settings,
    );

    expect(last(confirmed)?.flowRatio).toBeCloseTo(0.4, 10);
    expect(last(confirmed)?.flowState).toBe("confirmed");
    expect(last(conflict)?.flowState).toBe("conflict");
    expect(last(missing)?.flowState).toBe("unavailable");
  });

  it("uses only prior observations for a spike's strong threshold", () => {
    const quiet = new Array(12).fill(0).map((_, index) => (index % 2 ? -0.001 : 0.001));
    const baselineBars = barsFromReturns(quiet);
    const baseline = calculateGcPushMomentum(baselineBars, [], testSettings());
    const withSpike = calculateGcPushMomentum(
      [
        ...baselineBars,
        ...barsFromReturns(
          [0.08],
          baselineBars[baselineBars.length - 1].close,
          1,
          baselineBars[baselineBars.length - 1].time,
        ).slice(1),
      ],
      [],
      testSettings(),
    );

    expect(withSpike.slice(0, baseline.length)).toEqual(baseline);
    expect(last(withSpike)?.strong).toBe(true);
    expect(Math.abs(last(withSpike)?.push ?? 0)).toBeGreaterThan(
      last(withSpike)?.strongThreshold ?? Number.POSITIVE_INFINITY,
    );
  });

  it("normalizes malformed persisted settings", () => {
    const normalized = normalizeGcPushMomentumSettings({
      displayMode: "broken" as GcPushMomentumSettings["displayMode"],
      showLines: true,
      showDivergence: false,
      horizonBars: Number.NaN,
      pushSmoothingBars: 0,
      signalSmoothingBars: 0,
      accelerationBars: -10,
      strongPercentile: 5,
      flowPercentile: -1,
      epsilon: 0,
    });

    expect(normalized.displayMode).toBe(
      DEFAULT_GC_PUSH_MOMENTUM_SETTINGS.displayMode,
    );
    expect(normalized.showLines).toBe(true);
    expect(normalized.showDivergence).toBe(false);
    expect(normalized.horizonBars).toBe(DEFAULT_GC_PUSH_MOMENTUM_SETTINGS.horizonBars);
    expect(normalized.pushSmoothingBars).toBe(1);
    expect(normalized.signalSmoothingBars).toBe(1);
    expect(normalized.accelerationBars).toBe(1);
    expect(normalized.strongPercentile).toBe(1);
    expect(normalized.flowPercentile).toBe(0);
    expect(normalized.epsilon).toBeGreaterThan(0);
  });
});
