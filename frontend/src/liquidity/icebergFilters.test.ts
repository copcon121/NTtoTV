import { describe, expect, it } from "vitest";
import type { NativeIcebergState } from "../socket/messages";
import { calculateIcebergAutoThreshold, DEFAULT_ICEBERG_FILTERS, normalizeIcebergFilters } from "./icebergFilters";
import { layoutIcebergBadges } from "./icebergs";

const now = 10_000_000;
const row = (patch: Partial<NativeIcebergState> = {}): NativeIcebergState => ({
  symbol: "GC", contract: "GC", source: "rithmic", sourceContract: "GC 12-26", method: "native",
  sessionId: "one", orderId: "one", side: "buy", price: 4200, status: "executed",
  detectedTime: now - 120_000, firstSeenTime: now - 121_000, time: now - 60_000,
  lastTradeTime: now - 60_000, endTime: now - 60_000,
  executedVolume: 10, displayedSize: 0, refillCount: 0, detectionReason: "overfill", sequence: 1,
  ...patch,
});

describe("SI automatic volume threshold", () => {
  it("uses population SD with integer truncation and includes zero-refill completed orders", () => {
    const result = calculateIcebergAutoThreshold([5, 10, 15].map((executedVolume) => row({ executedVolume })), DEFAULT_ICEBERG_FILTERS, now);
    expect(result).toMatchObject({ threshold: 14, sampleCount: 3, mean: 10, calculatedAt: now });
    expect(result.standardDeviation).toBeCloseTo(Math.sqrt(50 / 3));
    expect(calculateIcebergAutoThreshold([row({ executedVolume: 5 }), row({ executedVolume: 10 })],
      { ...DEFAULT_ICEBERG_FILTERS, standardDeviations: 10 }, now).threshold).toBe(10);
  });

  it("samples completed executed/canceled orders by detection time, excluding active, invalidated and future states", () => {
    const result = calculateIcebergAutoThreshold([
      row(), row({ status: "canceled", executedVolume: 20, detectedTime: now - 3_600_000 }),
      row({ status: "active", executedVolume: 1000, endTime: null }),
      row({ status: "invalidated", executedVolume: 1000 }),
      row({ detectedTime: now - 3_600_001, executedVolume: 1000 }),
      row({ endTime: now + 1, executedVolume: 1000 }),
      row({ detectedTime: now + 1, executedVolume: 1000 }),
    ], DEFAULT_ICEBERG_FILTERS, now);
    expect(result).toMatchObject({ threshold: 20, sampleCount: 2, mean: 15, standardDeviation: 5 });
    expect(calculateIcebergAutoThreshold([row({ status: "canceled" })],
      { ...DEFAULT_ICEBERG_FILTERS, showCanceled: false }, now)).toMatchObject({ threshold: 0, sampleCount: 0 });
    expect(calculateIcebergAutoThreshold([], DEFAULT_ICEBERG_FILTERS, now)).toMatchObject({ threshold: 0, sampleCount: 0 });
  });

  it("enables Auto for older profiles and preserves an explicitly saved manual preference", () => {
    expect(normalizeIcebergFilters(undefined)).toEqual(DEFAULT_ICEBERG_FILTERS);
    expect(normalizeIcebergFilters({ automatic: false, lookbackMinutes: -1, standardDeviations: NaN,
      filteredOpacity: 2, showFiltered: true })).toMatchObject({ automatic: false,
      lookbackMinutes: 1, standardDeviations: 1, filteredOpacity: 1, showFiltered: true });
  });
});

const view = {
  from: now - 300_000, to: now, now, timeframeMs: 60_000,
  left: 0, right: 1000, top: 0, bottom: 400,
  xAt: (time: number) => (time - now + 300_000) / 1000, yAt: (price: number) => 200 - (price - 4200) * 10,
  filter: { settings: { ...DEFAULT_ICEBERG_FILTERS }, autoThreshold: 20, sessionMinVolumes: { us: 10, other: 5 } },
};

describe("SI individual then aggregate display filtering", () => {
  it("does not let individually rejected orders boost a qualified group or qualify themselves by summing", () => {
    const rows = [row({ orderId: "small-1", executedVolume: 12 }), row({ orderId: "small-2", executedVolume: 12 }),
      row({ orderId: "large", executedVolume: 25 })];
    const badges = layoutIcebergBadges(rows, view, () => 14);
    expect(badges.map((badge) => badge.text)).toEqual(["25"]);
    const withFaded = layoutIcebergBadges(rows, { ...view, filter: { ...view.filter,
      settings: { ...view.filter.settings, showFiltered: true } } }, () => 14);
    expect(withFaded.map((badge) => [badge.text, badge.filtered])).toEqual([["25", false], ["24", true]]);
    expect(layoutIcebergBadges(rows, { ...view, filter: { ...view.filter,
      settings: { ...view.filter.settings, aggregateMinVolume: 30 } } }, () => 14)).toEqual([]);
  });

  it("applies hidden/faded behavior to active orders consistently, with an explicit active bypass", () => {
    const active = row({ status: "active", executedVolume: 5, endTime: null });
    expect(layoutIcebergBadges([active], view, () => 14)).toEqual([]);
    const bypass = layoutIcebergBadges([active], { ...view, filter: { ...view.filter,
      settings: { ...view.filter.settings, applyToActive: false } } }, () => 14);
    expect(bypass).toHaveLength(1);
    expect(bypass[0].filtered).toBe(false);
    expect(layoutIcebergBadges([active], { ...view, filter: { ...view.filter,
      settings: { ...view.filter.settings, showActive: false, applyToActive: false } } }, () => 14)).toEqual([]);
  });

  it("uses absolute screen time distance, weighted prices and candle anchors regardless of input order", () => {
    const rows = [row({ orderId: "a", executedVolume: 20 }),
      row({ orderId: "b", detectedTime: now - 100_000, executedVolume: 40, price: 4201 })];
    const badges = layoutIcebergBadges(rows, view, () => 14);
    expect(badges).toHaveLength(1);
    expect(badges[0].text).toBe("60");
    expect(badges[0].anchorY).toBeCloseTo(view.yAt(4200 + 2 / 3));
    const weightedTime = now - 120_000 + 20_000 * 2 / 3;
    expect(badges[0].anchorX).toBe(view.xAt(Math.floor(weightedTime / 60_000) * 60_000 + 30_000));
    expect(layoutIcebergBadges([...rows].reverse(), view, () => 14)).toEqual(badges);
    expect(layoutIcebergBadges([rows[0], { ...rows[1], detectedTime: now - 20_000 }], view, () => 14)).toHaveLength(2);
    expect(layoutIcebergBadges(rows, { ...view, filter: { ...view.filter,
      settings: { ...view.filter.settings, aggregate: false } } }, () => 14)).toHaveLength(2);
  });

  it("keeps zero-volume aggregation finite and manual thresholds attached to detection sessions", () => {
    const zero = layoutIcebergBadges([row({ orderId: "a", executedVolume: 0 }), row({ orderId: "b", executedVolume: 0 })],
      { ...view, filter: { ...view.filter, autoThreshold: 0 } }, () => 14);
    expect(zero[0].text).toBe("0");
    expect(Number.isFinite(zero[0].anchorX)).toBe(true);
    expect(layoutIcebergBadges([row({ executedVolume: 4 })], { ...view, filter: { ...view.filter,
      settings: { ...view.filter.settings, automatic: false } } }, () => 14)).toEqual([]);
  });
});
