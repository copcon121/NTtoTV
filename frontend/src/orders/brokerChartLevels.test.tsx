import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TradingOrder, TradingPosition } from "../socket/messages";
import { projectBrokerOrder, stabilizeBrokerChartLevels, useBrokerChartPositions } from "./brokerChartLevels";

const position: TradingPosition = {
  brokerPositionTicket: 7, symbolBroker: "XAUUSDm", side: "buy",
  volumeLots: 0.1, entryBroker: 3915, entryGcEstimate: 3940,
  slBroker: 3910.4, slGc: 3935.4, tpBroker: 3952.5, tpGc: 3977.5,
  profit: 65.4, updatedAt: 1,
};
const order = {
  id: "order-7", source: "market_bar", kind: "market", gcAnchored: false,
  side: "buy", symbolBroker: "XAUUSDm",
  brokerPositionTicket: 7, fillPriceBroker: 3915, fillPriceGcEstimate: 3940,
  slBroker: 3910.4, slGc: 3935.4, tpBroker: 3952.5, tpGc: 3977.5,
} as TradingOrder;

describe("broker chart levels after partial take profit", () => {
  it("aligns confirmed broker break-even with the stable entry after a partial close", () => {
    const incoming = { ...position, volumeLots: 0.05, entryGcEstimate: 3929.4,
      slBroker: position.entryBroker, slGc: 3929.4 };
    const [projected] = stabilizeBrokerChartLevels([position], [incoming], [order]);
    expect(projected.entryGcEstimate).toBe(3940);
    expect(projected.slGc).toBe(3940);
    expect(projected.slBroker).toBe(projected.entryBroker);
    expect(projected.tpBroker).toBe(position.tpBroker);
  });
  it("preserves entry, SL and TP after 50% close when only volume, profit and basis change", () => {
    const incoming = { ...position, volumeLots: 0.05, profit: 32.7,
      entryGcEstimate: 3929.4, slGc: 3924.8, tpGc: 3966.9, updatedAt: 2 };
    const [projected] = stabilizeBrokerChartLevels([position], [incoming], [order]);
    expect(projected.entryGcEstimate).toBe(3940);
    expect(projected.slGc).toBe(3935.4);
    expect(projected.tpGc).toBe(3977.5);
    expect(projected.volumeLots).toBe(0.05);
    expect(projected.profit).toBe(32.7);
    expect(projected.entryBroker).toBe(position.entryBroker);
    expect(projected.slBroker).toBe(position.slBroker);
    expect(projected.tpBroker).toBe(position.tpBroker);
    expect(incoming.entryGcEstimate).toBe(3929.4);
  });

  it("updates TP edited in MT5 while keeping unchanged entry and SL stable", () => {
    const incoming = { ...position, volumeLots: 0.05, tpBroker: 3942.5,
      entryGcEstimate: 3929.4, slGc: 3924.8, tpGc: 3956.9, updatedAt: 3 };
    const [projected] = stabilizeBrokerChartLevels([position], [incoming], [order]);
    expect(projected.entryGcEstimate).toBe(3940);
    expect(projected.slGc).toBe(3935.4);
    expect(projected.tpGc).toBe(3956.9);
    expect(projected.tpBroker).toBe(3942.5);
  });

  it("updates a real SL edit and removes broker-deleted stops", () => {
    const incoming = { ...position, entryGcEstimate: 3929.4,
      slBroker: 3918, slGc: 3932.4, tpBroker: null, tpGc: null };
    const [projected] = stabilizeBrokerChartLevels([position], [incoming], []);
    expect(projected.entryGcEstimate).toBe(3940);
    expect(projected.slGc).toBe(3932.4);
    expect(projected.tpGc).toBeUndefined();
    expect(projected.tpBroker).toBeNull();
  });

  it("uses saved web-order levels on first load only while broker prices match", () => {
    const incoming = { ...position, entryGcEstimate: 3929.4, slGc: 3924.8,
      tpBroker: 3942.5, tpGc: 3956.9 };
    const [projected] = stabilizeBrokerChartLevels([], [incoming], [order]);
    expect(projected.entryGcEstimate).toBe(3940);
    expect(projected.slGc).toBe(3935.4);
    expect(projected.tpGc).toBe(3956.9);
  });

  it("does not carry chart levels across a changed position side or symbol", () => {
    for (const change of [{ side: "sell" as const }, { symbolBroker: "XAUUSDc" }]) {
      const incoming = { ...position, ...change, entryGcEstimate: 3929.4,
        slGc: 3924.8, tpGc: 3966.9 };
      expect(stabilizeBrokerChartLevels([position], [incoming], [order])[0]).toEqual(incoming);
    }
  });

  it("accepts a changed broker entry instead of hiding a changed average fill", () => {
    const incoming = { ...position, entryBroker: 3917, entryGcEstimate: 3931.4 };
    expect(stabilizeBrokerChartLevels([position], [incoming], [order])[0].entryGcEstimate)
      .toBe(3931.4);
  });

  it("preserves manual MT5 position levels across refreshes and resets at account change", () => {
    const { result, rerender } = renderHook(
      ({ positions, owner }) => useBrokerChartPositions(positions, [], owner),
      { initialProps: { positions: [position], owner: "user-a:account-a" } },
    );
    const incoming = { ...position, volumeLots: 0.05, entryGcEstimate: 3929.4,
      slGc: 3924.8, tpGc: 3966.9 };
    rerender({ positions: [incoming], owner: "user-a:account-a" });
    expect(result.current[0].entryGcEstimate).toBe(3940);
    rerender({ positions: [incoming], owner: "user-b:account-b" });
    expect(result.current[0].entryGcEstimate).toBe(3929.4);
  });

  it("forgets closed positions before the broker reuses a ticket", () => {
    const { result, rerender } = renderHook(
      ({ positions }) => useBrokerChartPositions(positions, [], "account"),
      { initialProps: { positions: [position] } },
    );
    rerender({ positions: [] });
    const incoming = { ...position, entryGcEstimate: 3929.4 };
    rerender({ positions: [incoming] });
    expect(result.current[0].entryGcEstimate).toBe(3929.4);
  });

  it("shows an MT5 TP edit for GC-anchored chart orders without moving entry or SL", () => {
    const chartOrder = { ...order, source: "chart_bracket" as const,
      kind: "limit" as const, gcAnchored: true };
    const incoming = { ...position, tpBroker: 3942.5, tpGc: 3956.9,
      entryGcEstimate: 3929.4, slGc: 3924.8 };
    const [stable] = stabilizeBrokerChartLevels([position], [incoming], [chartOrder]);
    const projected = projectBrokerOrder(chartOrder, stable);
    expect(projected.fillPriceGcEstimate).toBe(3940);
    expect(projected.slGc).toBe(3935.4);
    expect(projected.tpGc).toBe(3956.9);
    expect(projected.tpBroker).toBe(3942.5);
    expect(chartOrder.tpGc).toBe(3977.5);
    expect(projectBrokerOrder(chartOrder, undefined)).toBe(chartOrder);
  });

  it("shows broker-deleted stops for GC-anchored orders", () => {
    const chartOrder = { ...order, source: "chart_bracket" as const, gcAnchored: true };
    const projected = projectBrokerOrder(chartOrder,
      { ...position, slBroker: null, slGc: null, tpBroker: null, tpGc: null });
    expect(projected.slGc).toBeNull();
    expect(projected.tpGc).toBeNull();
    expect(projected.fillPriceGcEstimate).toBe(chartOrder.fillPriceGcEstimate);
  });
});
