import { describe, expect, it } from "vitest";
import type { MarketDataStatusMessage } from "../socket/messages";
import { HistorySyncRefreshTracker } from "./historySync";

const status = (state: NonNullable<MarketDataStatusMessage["historySync"]>["state"], at: number | null): MarketDataStatusMessage => ({
  type: "market_data_status", symbol: "GC", time: 1, preferredSource: "rithmic", sources: {},
  historySync: { state, connected: true, lastSuccessAt: at },
});

describe("automatic history repair refresh", () => {
  it("refreshes the chart once per successful repair and ignores progress and stale replays", () => {
    const tracker = new HistorySyncRefreshTracker();
    expect(tracker.accept(status("syncing", null))).toBe(false);
    expect(tracker.accept(status("synced", 100))).toBe(true);
    expect(tracker.accept(status("synced", 100))).toBe(false);
    expect(tracker.accept(status("error", 100))).toBe(false);
    expect(tracker.accept(status("synced", 99))).toBe(false);
    expect(tracker.accept(status("synced", 200))).toBe(true);
    expect(tracker.accept({ ...status("synced", 300), symbol: "ES" })).toBe(false);
    expect(tracker.accept(status("synced", Number.NaN))).toBe(false);
  });
});
