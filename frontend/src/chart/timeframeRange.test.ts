import { describe, expect, it } from "vitest";
import type { AnchorPoint } from "./drawings/types";
import {
  displayOffsetForTimeframe,
  fixedRangeMsFromAnchors,
  footprintEnabledForTimeframe,
  gcPushMomentumEnabledForTimeframe,
  tduSignalsEnabledForTimeframe,
} from "./timeframeRange";

function ts(value: number): AnchorPoint["time"] {
  return value as AnchorPoint["time"];
}

describe("fixedRangeMsFromAnchors", () => {
  it("converts 1m display anchor times back to backend bucket ms", () => {
    const anchors: AnchorPoint[] = [
      { time: ts(1_780_358_400), price: 4514.1 },
      { time: ts(1_780_358_460), price: 4515.1 },
    ];

    expect(fixedRangeMsFromAnchors(anchors, "1m")).toEqual({
      from: 1_780_358_400_000,
      to: 1_780_358_519_999,
    });
  });

  it("converts 15s display anchor times back to backend bucket ms", () => {
    const anchors: AnchorPoint[] = [
      { time: ts(1_780_358_400), price: 4514.1 },
      { time: ts(1_780_358_415), price: 4515.1 },
    ];

    expect(fixedRangeMsFromAnchors(anchors, "15s")).toEqual({
      from: 1_780_358_400_000,
      to: 1_780_358_429_999,
    });
  });

  it("orders reversed anchors and uses the timeframe-specific close offset", () => {
    const anchors: AnchorPoint[] = [
      { time: ts(1_780_358_700), price: 4515.1 },
      { time: ts(1_780_358_400), price: 4514.1 },
    ];

    expect(displayOffsetForTimeframe("5m")).toBe(0);
    expect(fixedRangeMsFromAnchors(anchors, "5m")).toEqual({
      from: 1_780_358_400_000,
      to: 1_780_358_999_999,
    });
  });

  it("returns null until both anchors exist", () => {
    expect(
      fixedRangeMsFromAnchors([{ time: ts(1_780_358_460), price: 4514.1 }], "1m"),
    ).toBeNull();
  });
});

describe("footprintEnabledForTimeframe", () => {
  it("allows the M1 footprint overlay on both 15s and 1m charts", () => {
    expect(footprintEnabledForTimeframe("15s")).toBe(true);
    expect(footprintEnabledForTimeframe("1m")).toBe(true);
    expect(footprintEnabledForTimeframe("5m")).toBe(false);
    expect(footprintEnabledForTimeframe("1D")).toBe(false);
  });
});

describe("gcPushMomentumEnabledForTimeframe", () => {
  it("supports M1 and M5 only", () => {
    expect(gcPushMomentumEnabledForTimeframe("1m")).toBe(true);
    expect(gcPushMomentumEnabledForTimeframe("5m")).toBe(true);
    expect(gcPushMomentumEnabledForTimeframe("3m")).toBe(false);
    expect(gcPushMomentumEnabledForTimeframe("15m")).toBe(false);
  });
});

describe("tduSignalsEnabledForTimeframe", () => {
  it("supports M1 and M5 only", () => {
    expect(tduSignalsEnabledForTimeframe("1m")).toBe(true);
    expect(tduSignalsEnabledForTimeframe("5m")).toBe(true);
    expect(tduSignalsEnabledForTimeframe("15s")).toBe(false);
    expect(tduSignalsEnabledForTimeframe("3m")).toBe(false);
    expect(tduSignalsEnabledForTimeframe("15m")).toBe(false);
    expect(tduSignalsEnabledForTimeframe("1D")).toBe(false);
  });
});
