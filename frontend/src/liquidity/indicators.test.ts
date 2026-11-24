import { describe, expect, it } from "vitest";
import { gcSessionKey, mergeLiquidityBigTrades, normalizeLiquidityIndicators, sessionVwapPoints, visibleLiquidityBigTrades } from "./indicators";
import type { Bar } from "../socket/messages";

describe("restored Liquidity indicators", () => {
  const settings = normalizeLiquidityIndicators({}).bigTradeSettings;
  const trade = { tradeId: 1, time: 1000, side: "buy" as const, price: 4000, volume: 150 };
  it("reconciles cumulative REST/socket executions without duplicate or shrinking bubbles", () => {
    expect(mergeLiquidityBigTrades([trade], [{ ...trade, volume: 300 }], 0)).toEqual([{ ...trade, volume: 300 }]);
    expect(mergeLiquidityBigTrades([{ ...trade, volume: 400 }], [{ ...trade, volume: 300 }], 0)).toEqual([{ ...trade, volume: 400 }]);
    expect(mergeLiquidityBigTrades([trade], [], 1001)).toEqual([]);
  });
  it("keeps distinct executions at the same timestamp and bounds history", () => {
    const trades = Array.from({ length: 600 }, (_, index) => ({ ...trade, tradeId: index, time: index }));
    const merged = mergeLiquidityBigTrades(trades, [], 0);
    expect(merged).toHaveLength(500);
    expect(merged[0].time).toBe(100);
    expect(mergeLiquidityBigTrades([trade, { ...trade, tradeId: 2, side: "sell" }], [], 0)).toHaveLength(2);
  });
  it("uses Asia, EU and US thresholds before applying the visible bubble budget", () => {
    const times = ["2026-10-26T00:00:00Z", "2026-10-26T08:00:00Z", "2026-10-26T14:00:00Z"].map(Date.parse);
    const trades = times.flatMap((time, index) => [
      { ...trade, time, tradeId: index * 2, volume: [30, 50, 100][index] },
      { ...trade, time, tradeId: index * 2 + 1, volume: [29, 49, 99][index] },
    ]);
    expect(visibleLiquidityBigTrades(trades, settings).map((value) => value.volume)).toEqual([30, 50, 100]);
    expect(visibleLiquidityBigTrades(trades, { ...settings, maxVisible: 1 })[0].volume).toBe(100);
  });
  it("recovers old preferences and normalizes legacy volume settings", () => {
    expect(normalizeLiquidityIndicators({ showVwap: false, bigTradeSettings: { minVolume: 45, maxVisible: 9999 } }))
      .toMatchObject({ showVwap: false, showBigTrades: true,
        bigTradeSettings: { maxVisible: 500, sessionMinVolumes: { asia: 45, eu: 45, us: 45 } } });
  });
});

describe("GC session VWAP", () => {
  const bar = (time: string, price: number, volume: number): Bar => ({
    time: Date.parse(time), open: price, high: price + 1, low: price - 1, close: price, volume,
  });
  it("weights typical price by volume and resets at 17:00 Chicago", () => {
    const bars = [bar("2026-10-26T00:00:00Z", 2, 1), bar("2026-10-26T00:01:00Z", 4, 3), bar("2026-10-26T22:00:00Z", 10, 5)];
    expect(sessionVwapPoints(bars).map((point) => point.value)).toEqual([2, 3.5, 10]);
    expect(sessionVwapPoints([...bars].reverse())).toEqual(sessionVwapPoints(bars));
  });
  it("uses the correct session boundary across daylight saving changes", () => {
    expect(gcSessionKey(Date.parse("2026-11-01T22:59:00Z"))).toBe("2026-11-01");
    expect(gcSessionKey(Date.parse("2026-11-01T23:00:00Z"))).toBe("2026-11-02");
    expect(gcSessionKey(Date.parse("2026-10-26T21:59:00Z"))).toBe("2026-10-26");
    expect(gcSessionKey(Date.parse("2026-10-26T22:00:00Z"))).toBe("2026-10-27");
  });
  it("does not fabricate a VWAP before volume exists and carries through empty bars", () => {
    expect(sessionVwapPoints([bar("2026-10-26T00:00:00Z", 2, 0)])).toEqual([]);
    const points = sessionVwapPoints([bar("2026-10-26T00:00:00Z", 2, 1), bar("2026-10-26T00:01:00Z", 100, 0)]);
    expect(points.map((point) => point.value)).toEqual([2, 2]);
  });
});
