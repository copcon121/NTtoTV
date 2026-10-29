import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChartSocket } from "../socket/ChartSocket";
import type { IcebergUpdateMessage } from "../socket/messages";
import { IcebergAlertTracker, useIcebergAlerts } from "./useIcebergAlerts";
import { playLiquiditySound } from "./alertSounds";

vi.mock("./alertSounds", () => ({ playLiquiditySound: vi.fn() }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const now = 100_000;
const row: IcebergUpdateMessage = {
  type: "iceberg_update", symbol: "GC", contract: "GC", source: "rithmic", method: "native",
  sessionId: "session-1", sourceContract: "GC 12-26", orderId: "one", side: "buy",
  price: 4200, time: now, firstSeenTime: now, detectedTime: now,
  lastTradeTime: now, endTime: null, executedVolume: 50, displayedSize: 10,
  refillCount: 2, status: "active", detectionReason: "refill", sequence: 2,
};

describe("iceberg sound qualification", () => {
  it("retains per-order notification history when Auto raises or lowers its threshold", () => {
    const tracker = new IcebergAlertTracker(50, now);
    expect(tracker.accept(row, now)).toBe(true);
    tracker.setMinVolume(100);
    expect(tracker.accept({ ...row, sequence: 3, executedVolume: 75 }, now)).toBe(false);
    expect(tracker.accept({ ...row, sequence: 4, executedVolume: 100 }, now)).toBe(false);
    tracker.setMinVolume(10);
    expect(tracker.accept({ ...row, sequence: 5, executedVolume: 110 }, now)).toBe(false);
    tracker.setMinVolume(100);
    const small = { ...row, orderId: "small", executedVolume: 20 };
    expect(tracker.accept(small, now)).toBe(false);
    tracker.setMinVolume(10);
    expect(tracker.accept({ ...small, sequence: 3 }, now)).toBe(false);
  });
  it("uses US min 10 and other-session min 5 with the same crossing rules", () => {
    const at = Date.parse("2026-10-28T11:59:59Z"); // 18:59:59 UTC+7
    const usTime = Date.parse("2026-10-28T12:00:00Z");
    const tracker = new IcebergAlertTracker({ us: 10, other: 5 }, at);
    tracker.seed([{ ...row, detectedTime: at, time: at, sequence: 1, executedVolume: 4 }]);
    // A refill after 19:00 retains the session in which the iceberg appeared.
    expect(tracker.accept({ ...row, detectedTime: at, time: usTime, executedVolume: 5 }, usTime)).toBe(true);
    expect(tracker.accept({ ...row, detectedTime: at, time: usTime, sequence: 3, executedVolume: 10 }, usTime)).toBe(false);
    const us = { ...row, orderId: "us", detectedTime: usTime, time: usTime, executedVolume: 9 };
    expect(tracker.accept(us, usTime)).toBe(false);
    expect(tracker.accept({ ...us, sequence: 3, executedVolume: 10 }, usTime)).toBe(true);
    expect(tracker.accept({ ...us, sequence: 4, executedVolume: 20 }, usTime)).toBe(false);
  });

  it("sounds once when a tracked order crosses the volume filter, including an older detection", () => {
    const tracker = new IcebergAlertTracker(50, now);
    tracker.seed([{ ...row, detectedTime: 10, executedVolume: 20, sequence: 1 }]);
    expect(tracker.accept({ ...row, detectedTime: 10 }, now)).toBe(true);
    expect(tracker.accept({ ...row, executedVolume: 100, sequence: 3 }, now)).toBe(false);
    expect(tracker.accept({ ...row, status: "executed", sequence: 4 }, now)).toBe(false);
  });

  it("keeps snapshots, pre-existing orders and stale transport replays silent", () => {
    const tracker = new IcebergAlertTracker(50, now);
    tracker.seed([row]);
    expect(tracker.accept({ ...row, sequence: 3 }, now)).toBe(false);
    expect(tracker.accept({ ...row, orderId: "old", detectedTime: now - 1 }, now)).toBe(false);
    expect(tracker.accept({ ...row, orderId: "stale", time: now - 20_000 }, now)).toBe(false);
    expect(tracker.accept({ ...row, orderId: "stale", sequence: 3 }, now)).toBe(false);
  });

  it("ignores duplicate/out-of-order refills and canceled or invalidated orders", () => {
    const tracker = new IcebergAlertTracker(50, now);
    tracker.seed([{ ...row, sequence: 5, executedVolume: 20 }]);
    expect(tracker.accept(row, now)).toBe(false);
    expect(tracker.accept({ ...row, sequence: 6, status: "canceled" }, now)).toBe(false);
    expect(tracker.accept({ ...row, orderId: "bad", status: "invalidated" }, now)).toBe(false);
    expect(tracker.accept({ ...row, orderId: "filled", status: "executed" }, now)).toBe(true);
  });
});

describe("iceberg live audio lifecycle", () => {
  it("does not re-arm a live order when the threshold changes between socket updates", () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    let update: (message: IcebergUpdateMessage) => void = () => {};
    const socket = { on: vi.fn((_event, handler) => { update = handler; return vi.fn(); }) } as unknown as ChartSocket;
    const book = { sessionId: "session-1", sourceContract: "GC 12-26", synchronized: true,
      connected: true, sourceConnected: true, icebergs: [], retiredSessions: [] };
    const { rerender } = renderHook(({ threshold }) => useIcebergAlerts(socket, book, true, threshold, "voice"),
      { initialProps: { threshold: 50 } });
    act(() => update(row));
    expect(playLiquiditySound).toHaveBeenCalledTimes(1);
    rerender({ threshold: 100 });
    act(() => update({ ...row, sequence: 3, executedVolume: 100 }));
    expect(playLiquiditySound).toHaveBeenCalledTimes(1);
  });
  it("gates on live source readiness and preferences, then uses the selected sound", () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    let update: (message: IcebergUpdateMessage) => void = () => {};
    const off = vi.fn();
    const socket = { on: vi.fn((_event, handler) => { update = handler; return off; }) } as unknown as ChartSocket;
    const book = { sessionId: "session-1", sourceContract: "GC 12-26", synchronized: true,
      connected: true, sourceConnected: true, icebergs: [row], retiredSessions: [] };
    const { rerender, unmount } = renderHook(({ enabled, synchronized }) =>
      useIcebergAlerts(socket, { ...book, synchronized }, enabled, 50, "voice"),
    { initialProps: { enabled: false, synchronized: true } });
    act(() => update({ ...row, orderId: "disabled" }));
    rerender({ enabled: true, synchronized: false });
    act(() => update({ ...row, orderId: "unsynced" }));
    rerender({ enabled: true, synchronized: true });
    act(() => update({ ...row, orderId: "wrong-session", sessionId: "old" }));
    act(() => update({ ...row, orderId: "wrong-symbol", symbol: "ES" }));
    expect(playLiquiditySound).not.toHaveBeenCalled();
    act(() => update({ ...row, orderId: "new" }));
    expect(playLiquiditySound).toHaveBeenCalledTimes(1);
    expect(playLiquiditySound).toHaveBeenCalledWith("iceberg", "voice");
    unmount();
    expect(off).toHaveBeenCalled();
  });
});
