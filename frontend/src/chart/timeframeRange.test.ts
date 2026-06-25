import { describe, expect, it } from "vitest";
import type { AnchorPoint } from "./drawings/types";
import {
  displayOffsetForTimeframe,
  fixedRangeMsFromAnchors,
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

