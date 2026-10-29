import { describe, expect, it, vi } from "vitest";
import type { NativeIcebergState } from "../socket/messages";
import { drawNativeIcebergs, icebergEndTime, layoutIcebergBadges, visibleIcebergs } from "./icebergs";

function row(patch: Partial<NativeIcebergState> = {}): NativeIcebergState {
  return {
    symbol: "GC", contract: "GC", source: "rithmic", sourceContract: "GC 12-26",
    sessionId: "session-1", orderId: "order-1", side: "buy", price: 2800,
    time: 120_000, firstSeenTime: 100_000, detectedTime: 110_000,
    lastTradeTime: 120_000, endTime: null, executedVolume: 12, displayedSize: 4,
    refillCount: 1, status: "active", detectionReason: "refill", sequence: 2,
    method: "native", ...patch,
  };
}

describe("liquidity iceberg lifetimes", () => {
  it("keeps an active order in view after its detection candle scrolls away", () => {
    const active = row();
    expect(visibleIcebergs([active], 180_000, 240_000, 220_000)).toEqual([active]);
    expect(icebergEndTime(active, 220_000)).toBe(220_000);
  });

  it("clips terminal history and excludes detections beyond the observed time", () => {
    const ended = row({ status: "executed", endTime: 150_000 });
    const future = row({ detectedTime: 250_000 });
    expect(visibleIcebergs([ended, future], 180_000, 300_000, 220_000)).toEqual([]);
    expect(visibleIcebergs([ended], 140_000, 160_000, 220_000)).toEqual([ended]);
    expect(icebergEndTime(ended, 220_000)).toBe(150_000);
  });

  it("draws passive executed quantity on the price pane and skips off-screen prices", () => {
    const ctx = {
      save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(), beginPath: vi.fn(),
      moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fillRect: vi.fn(),
      strokeRect: vi.fn(), fillText: vi.fn(), measureText: () => ({ width: 14 }),
      quadraticCurveTo: vi.fn(), closePath: vi.fn(), fill: vi.fn(),
    };
    drawNativeIcebergs(ctx as unknown as CanvasRenderingContext2D,
      [row(), row({ orderId: "outside", price: 2900 })], {
        from: 100_000, to: 240_000, now: 220_000,
        timeframeMs: 10_000,
        left: 10, right: 500, top: 10, bottom: 300,
        xAt: (time) => (time - 100_000) / 1000 + 10,
        yAt: (price) => price === 2800 ? 100 : -10,
      });
    expect(ctx.fillText).toHaveBeenCalledTimes(1);
    expect(ctx.fillText.mock.calls[0][0]).toBe("12");
    expect(ctx.moveTo).toHaveBeenCalledWith(20, 100);
    expect(ctx.lineTo).toHaveBeenCalledWith(130, 100);
  });

  it("combines nearby same-side totals visually while preserving distinct order identities", () => {
    const rows = [row(), row({ orderId: "order-2", executedVolume: 8 }),
      row({ orderId: "ask-1", side: "sell", executedVolume: 30 })];
    const view = {
      from: 100_000, to: 240_000, now: 220_000,
      timeframeMs: 10_000,
      left: 10, right: 500, top: 10, bottom: 300,
      xAt: (time: number) => (time - 100_000) / 1000 + 10,
      yAt: () => 100,
    };
    const badges = layoutIcebergBadges(rows, view, () => 14);
    expect(badges).toHaveLength(2);
    const bid = badges.find((badge) => badge.rows[0].side === "buy")!;
    expect(bid.text).toBe("20");
    expect(bid.rows.map((item) => item.orderId)).toEqual(["order-1", "order-2"]);
    expect(bid.anchorX).toBe(25);
    expect(bid.y + bid.height).toBeLessThan(100);
    expect(badges.find((badge) => badge.rows[0].side === "sell")!.y).toBeGreaterThan(100);
    expect(rows[0].executedVolume).toBe(12);
  });

  it("reveals side and lifecycle details only when hovering a compact badge", () => {
    const ctx = {
      save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(), beginPath: vi.fn(),
      moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), fillRect: vi.fn(),
      fillText: vi.fn(), measureText: (text: string) => ({ width: text.length * 6 }),
      quadraticCurveTo: vi.fn(), closePath: vi.fn(), fill: vi.fn(),
    };
    const view = {
      from: 100_000, to: 240_000, now: 220_000,
      timeframeMs: 10_000,
      left: 10, right: 500, top: 10, bottom: 300,
      xAt: (time: number) => (time - 100_000) / 1000 + 10, yAt: () => 100,
    };
    const badge = layoutIcebergBadges([row()], view, (text) => text.length * 6)[0];
    drawNativeIcebergs(ctx as unknown as CanvasRenderingContext2D, [row()], {
      ...view, hover: { x: badge.x + 2, y: badge.y + 2 },
    });
    const labels = ctx.fillText.mock.calls.map((call) => call[0]);
    expect(labels).toEqual(["12", "BID iceberg - 12 executed", "active - 1 order - 1 refill"]);
  });

  it.each([15_000, 30_000, 60_000, 300_000])(
    "anchors zero-refill and refill ICE to the same detection candle at %i ms",
    (timeframeMs) => {
      const view = {
        from: 0, to: 600_000, now: 400_000, timeframeMs,
        left: 10, right: 1000, top: 10, bottom: 300,
        xAt: (time: number) => time / 1000 + 10, yAt: () => 100,
      };
      const refill = layoutIcebergBadges([row()], view, () => 14)[0];
      const overfill = layoutIcebergBadges([
        row({ detectionReason: "overfill", refillCount: 0, displayedSize: 0 }),
      ], view, () => 14)[0];
      expect(overfill.anchorX).toBe(
        view.xAt(Math.floor(110_000 / timeframeMs) * timeframeMs + timeframeMs / 2),
      );
      expect(overfill.anchorX).toBe(refill.anchorX);
      expect(overfill.x).toBe(refill.x);
      expect(overfill.y).toBe(refill.y);
    },
  );

  it("keeps the detection anchor through updates, completion, pan and future whitespace", () => {
    const view = {
      from: 0, to: 300_000, now: 220_000, timeframeMs: 60_000,
      left: 10, right: 1000, top: 10, bottom: 300,
      xAt: (time: number) => time / 1000 + 10, yAt: () => 100,
    };
    const active = layoutIcebergBadges([row()], view, () => 14)[0];
    const ended = layoutIcebergBadges([
      row({ time: 180_000, endTime: 180_000, status: "executed" }),
    ], { ...view, now: 400_000, to: 600_000 }, () => 14)[0];
    expect(active.anchorX).toBe(100);
    expect(ended.anchorX).toBe(active.anchorX);
    const zoomed = layoutIcebergBadges([row()], {
      ...view, xAt: (time) => view.xAt(time) * 2 - 50,
    }, () => 14)[0];
    expect(zoomed.anchorX).toBe(150);
  });

  it("retains off-screen order traces without pinning their badges to a visible edge", () => {
    const view = {
      from: 180_000, to: 300_000, now: 220_000, timeframeMs: 60_000,
      left: 10, right: 1000, top: 10, bottom: 300,
      xAt: (time: number) => (time - 180_000) / 1000 + 10, yAt: () => 100,
    };
    expect(visibleIcebergs([row()], view.from, view.to, view.now)).toHaveLength(1);
    expect(layoutIcebergBadges([row()], view, () => 14)).toEqual([]);
  });

  it("keeps same-price ICE from separate candles separate when zoomed out", () => {
    const view = {
      from: 0, to: 300_000, now: 220_000, timeframeMs: 60_000,
      left: 10, right: 1000, top: 10, bottom: 300,
      xAt: (time: number) => time / 10_000 + 10, yAt: () => 100,
    };
    const badges = layoutIcebergBadges([
      row(), row({ orderId: "next-candle", detectedTime: 130_000, time: 140_000 }),
    ], view, () => 14);
    expect(badges).toHaveLength(2);
    expect(new Set(badges.map((badge) => badge.anchorX)).size).toBe(2);
  });
});
