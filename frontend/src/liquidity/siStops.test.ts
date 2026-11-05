import { describe, expect, it } from "vitest";
import type { SiStopChain } from "../socket/messages";
import { DEFAULT_SI_STOP_SETTINGS, isSiStopChain, mergeSiStops, normalizeSiStopSettings,
  SiStopAlertTracker, siStopAutoThreshold, siStopPasses } from "./siStops";
import { siStopGroups } from "./drawSiStops";

export function stop(patch: Partial<SiStopChain> = {}): SiStopChain {
  return { type: "si_stop", source: "rithmic", symbol: "GC", contract: "GC", sourceContract: "GC 12-26",
    method: "aggressor_chain", status: "completed", sessionId: "s1", chainId: "s1:1", sequence: 1,
    side: "buy", time: 2000, startTime: 1000, completedTime: 2001, price: 2700.1, firstPrice: 2700,
    vwap: 2700.05, executedVolume: 10, executionCount: 2, aggressorCount: 2,
    throughPriceLevels: true, endReason: "depth", ...patch };
}

describe("completed SI Stops", () => {
  it("accepts completed chains and rejects provisional or malformed input", () => {
    expect(isSiStopChain(stop())).toBe(true);
    expect(isSiStopChain({ ...stop(), status: "pending" })).toBe(false);
    expect(isSiStopChain(stop({ completedTime: 1999 }))).toBe(false);
    expect(isSiStopChain(stop({ vwap: Number.NaN }))).toBe(false);
    expect(isSiStopChain(stop({ executionCount: 11 }))).toBe(false);
  });

  it("keeps live immutable chains through stale REST and reconnects without joining IDs", () => {
    const live = stop();
    const second = stop({ sessionId: "s2", chainId: "s2:1", sequence: 1 });
    const rows = mergeSiStops([live], [stop({ executedVolume: 999 }), second], 0);
    expect(rows).toEqual([live, second]);
    expect(mergeSiStops(rows, [], 2001)).toEqual([]);
  });

  it("has independent SI defaults instead of migrating the legacy MV threshold", () => {
    const settings = normalizeSiStopSettings({ askLevel: 500, bidLevel: 500 });
    expect(settings.minVolume).toBe(50);
    expect(settings.alertMinVolume).toBe(10);
    expect(settings.alertSound).toBe(false);
    expect(settings.buyColor).toBe("#35d6b0");
    expect(normalizeSiStopSettings({ enabled: false, minVolume: -1, buyColor: "bad" })).toMatchObject({
      enabled: false, minVolume: 0, buyColor: "#35d6b0",
    });
  });

  it("upgrades the saved zero-minimum preset to fixed 50 only once", () => {
    const upgraded = normalizeSiStopSettings({ version: 1, minVolume: 0, automatic: true,
      aggregateMinVolume: 50, buyColor: "#123456", alertMinVolume: 10 });
    expect(upgraded).toMatchObject({ version: 2, minVolume: 50, automatic: false,
      aggregateMinVolume: 50, buyColor: "#123456", alertMinVolume: 10 });
    const changed = normalizeSiStopSettings({ ...upgraded, minVolume: 0, automatic: true });
    expect(normalizeSiStopSettings(changed)).toMatchObject({ version: 2, minVolume: 0, automatic: true });
    expect(normalizeSiStopSettings({ version: 1, minVolume: 75, automatic: true }))
      .toMatchObject({ version: 2, minVolume: 75, automatic: true });
  });

  it("samples completed chains before display filtering and excludes future completion", () => {
    const now = 100_000;
    const rows = [stop({ executedVolume: 10 }), stop({ chainId: "2", executedVolume: 20 }),
      stop({ chainId: "3", executedVolume: 1000, completedTime: now + 1 })];
    expect(siStopAutoThreshold(rows, DEFAULT_SI_STOP_SETTINGS, now)).toEqual({ threshold: 20, sampleCount: 2 });
    expect(siStopAutoThreshold([], DEFAULT_SI_STOP_SETTINGS, now)).toEqual({ threshold: 0, sampleCount: 0 });
    expect(siStopPasses(stop(), { ...DEFAULT_SI_STOP_SETTINGS, throughPriceLevelsOnly: true }, 10)).toBe(true);
    expect(siStopPasses(stop({ throughPriceLevels: false }), { ...DEFAULT_SI_STOP_SETTINGS, throughPriceLevelsOnly: true }, 10)).toBe(false);
  });

  it("alerts once only for fresh completed chains; history and threshold changes cannot rearm", () => {
    const tracker = new SiStopAlertTracker(2000);
    const settings = { ...DEFAULT_SI_STOP_SETTINGS, alertMinVolume: 10 };
    const historic = stop({ chainId: "historic", completedTime: 1999, time: 1998 });
    tracker.seed([historic]);
    expect(tracker.accept(historic, settings, 2001)).toBe(false);
    expect(tracker.accept(stop(), settings, 2001)).toBe(true);
    expect(tracker.accept(stop(), { ...settings, alertMinVolume: 0 }, 2002)).toBe(false);
    expect(tracker.accept(stop({ chainId: "stale" }), settings, 20_000)).toBe(false);
    expect(tracker.accept(stop({ chainId: "small", executedVolume: 5 }), settings, 2002)).toBe(false);
    expect(tracker.accept(stop({ chainId: "small", executedVolume: 5 }), { ...settings, alertMinVolume: 1 }, 2002)).toBe(false);
  });
});

describe("SI Stops visual aggregation", () => {
  const view = { from: 0, to: 10000, timeframeMs: 1000, left: 0, right: 1000, top: 0, bottom: 1000,
    xAt: (time: number) => time / 10, yAt: (price: number) => price / 10, hover: null,
    settings: { ...DEFAULT_SI_STOP_SETTINGS }, threshold: 10 };

  it("aggregates only the same side and keeps individually rejected chains separate", () => {
    const rows = [stop(), stop({ chainId: "2", executedVolume: 20 }),
      stop({ chainId: "3", executedVolume: 2 }), stop({ chainId: "4", side: "sell" })];
    const groups = siStopGroups(rows, view, (s) => s.length * 7);
    expect(groups.map((g) => g.volume)).toEqual([30, 10]);
    expect(groups[0].rows).toHaveLength(2);
  });

  it("uses aggregate minimum after grouping and optionally fades rejected groups", () => {
    const rows = [stop(), stop({ chainId: "2" })];
    expect(siStopGroups(rows, { ...view, settings: { ...view.settings, aggregateMinVolume: 25 } }, () => 30)).toEqual([]);
    const groups = siStopGroups(rows, { ...view, settings: { ...view.settings, aggregateMinVolume: 25, showFiltered: true } }, () => 30);
    expect(groups[0].volume).toBe(20);
    expect(groups[0].filtered).toBe(true);
  });

  it("filters small chains before grouping even when their group totals 50 contracts", () => {
    const rows = Array.from({ length: 15 }, (_, i) => stop({ chainId: `group:${i}`,
      executedVolume: i < 5 ? 4 : 3, executionCount: i < 3 ? 3 : 2 }));
    const grouped = siStopGroups(rows, { ...view, threshold: 0,
      settings: { ...view.settings, aggregateMinVolume: 50 } }, () => 30);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].volume).toBe(50);
    expect(grouped[0].rows).toHaveLength(15);
    expect(grouped[0].rows.reduce((n, row) => n + row.executionCount, 0)).toBe(33);
    expect(siStopGroups(rows, { ...view, threshold: 50 }, () => 30)).toEqual([]);
  });
});
