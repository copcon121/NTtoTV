import { describe, expect, it } from "vitest";
import type { NativeIcebergState } from "../socket/messages";
import {
  emptyNativeIcebergBook, isNativeIceberg, MAX_NATIVE_ICEBERGS,
  reconcileNativeIcebergSnapshot, updateNativeIcebergBook, type NativeIcebergSnapshot,
} from "./nativeIcebergs";

function row(patch: Partial<NativeIcebergState> = {}): NativeIcebergState {
  return { symbol: "GC", contract: "GC", source: "rithmic", sourceContract: "GC 12-26",
    sessionId: "session-1", orderId: "order-1", side: "buy", price: 2800,
    time: 120_000, firstSeenTime: 100_000, detectedTime: 110_000,
    lastTradeTime: 120_000, endTime: null, executedVolume: 12, displayedSize: 4,
    refillCount: 1, status: "active", detectionReason: "refill", sequence: 2,
    method: "native", ...patch };
}

function snapshot(icebergs: NativeIcebergState[], patch: Partial<NativeIcebergSnapshot> = {}): NativeIcebergSnapshot {
  return { symbol: "GC", contract: "GC", source: "rithmic", sourceContract: "GC 12-26",
    sessionId: "session-1", synchronized: true, connected: true, icebergs, ...patch };
}

describe("native iceberg reconciliation", () => {
  it("retains yesterday's history across refresh and drops states older than the server cutoff", () => {
    const now = 1_800_000_000_000;
    const cutoff = now - 48 * 60 * 60_000;
    const yesterday = row({ time: now - 30 * 60 * 60_000, detectedTime: now - 30 * 60 * 60_000,
      status: "executed", endTime: now - 30 * 60 * 60_000 });
    const expired = row({ orderId: "expired", time: cutoff - 1 });
    const previous = reconcileNativeIcebergSnapshot(emptyNativeIcebergBook(), snapshot([yesterday, expired]), []);
    const refreshed = reconcileNativeIcebergSnapshot(previous, snapshot([yesterday], { from: cutoff }), []);
    expect(refreshed.icebergs).toEqual([yesterday]);
  });

  it("keeps the live terminal update when a slower REST snapshot arrives", () => {
    const live = row({ sequence: 5, status: "executed", executedVolume: 18, endTime: 121_000 });
    const book = updateNativeIcebergBook(emptyNativeIcebergBook(), live);
    const merged = reconcileNativeIcebergSnapshot(book, snapshot([row()]), [live]);
    expect(merged.icebergs).toEqual([live]);
    expect(merged.synchronized).toBe(true);
    expect(updateNativeIcebergBook(merged, row())).toBe(merged);
  });

  it("rejects a stale bootstrap session after the live stream has switched", () => {
    const old = updateNativeIcebergBook(emptyNativeIcebergBook(), row());
    const next = row({ sessionId: "session-2", sequence: 1 });
    const book = updateNativeIcebergBook(old, next);
    expect(reconcileNativeIcebergSnapshot(book, snapshot([row()]), [next])).toBe(book);
    expect(updateNativeIcebergBook(book, row({ sequence: 100 }))).toBe(book);
    expect(book.icebergs.find((item) => item.sessionId === "session-1")?.status).toBe("invalidated");
  });

  it("keeps completed history with reused order IDs in a new session", () => {
    const old = row({ status: "executed", endTime: 121_000 });
    const current = row({ sessionId: "session-2", sequence: 1 });
    const book = reconcileNativeIcebergSnapshot(emptyNativeIcebergBook(),
      snapshot([old, current], { sessionId: "session-2" }), []);
    expect(book.icebergs).toHaveLength(2);
    expect(book.icebergs.find((item) => item.sessionId === "session-1")?.status).toBe("executed");
    expect(book.sessionId).toBe("session-2");
  });

  it("removes old-contract states at a physical contract switch", () => {
    const old = reconcileNativeIcebergSnapshot(emptyNativeIcebergBook(), snapshot([row()]), []);
    const next = row({ sourceContract: "GC 02-27", sessionId: "session-2", sequence: 1 });
    const book = updateNativeIcebergBook(old, next);
    expect(book.icebergs).toEqual([next]);
    expect(book.synchronized).toBe(false);
    expect(reconcileNativeIcebergSnapshot(book, snapshot([row()]), [next])).toBe(book);
  });

  it("bounds retained orders and rejects malformed quantities", () => {
    const rows = Array.from({ length: MAX_NATIVE_ICEBERGS + 20 }, (_, i) =>
      row({ orderId: String(i), time: 120_000 + i }));
    const book = reconcileNativeIcebergSnapshot(emptyNativeIcebergBook(), snapshot(rows), []);
    expect(book.icebergs).toHaveLength(MAX_NATIVE_ICEBERGS);
    expect(book.icebergs[0].orderId).toBe("20");
    expect(isNativeIceberg(row({ executedVolume: Number.NaN }))).toBe(false);
    expect(isNativeIceberg(row({ displayedSize: -1 }))).toBe(false);
  });
});
