import { describe, expect, it } from "vitest";

import {
  panOffsetFromDrag,
  priceScaleFromAxisDrag,
  timeScaleFromAxisDrag,
} from "./LiquidityPage";

describe("liquidity axis scaling", () => {
  it("zooms the time axis in when dragged right and out when dragged left", () => {
    expect(timeScaleFromAxisDrag(240, 100)).toBeLessThan(240);
    expect(timeScaleFromAxisDrag(240, -100)).toBeGreaterThan(240);
  });

  it("never exposes fewer than the minimum candle count", () => {
    expect(timeScaleFromAxisDrag(240, 10_000)).toBe(30);
  });

  it("zooms the price axis in when dragged upward and out when dragged down", () => {
    expect(priceScaleFromAxisDrag(1, 100)).toBeGreaterThan(1);
    expect(priceScaleFromAxisDrag(1, -100)).toBeLessThan(1);
  });

  it("clamps extreme price-axis drags", () => {
    expect(priceScaleFromAxisDrag(1, 10_000)).toBe(12);
    expect(priceScaleFromAxisDrag(1, -10_000)).toBe(0.25);
  });
});

describe("liquidity chart panning", () => {
  it("creates future space when the latest chart is dragged left", () => {
    expect(panOffsetFromDrag(0, -100, 5, 500, 180)).toBe(-20);
  });

  it("returns through latest before panning into history", () => {
    expect(panOffsetFromDrag(-20, 150, 5, 500, 180)).toBe(10);
  });

  it("clamps future and historical panning limits", () => {
    expect(panOffsetFromDrag(0, -10_000, 5, 500, 180)).toBe(-180);
    expect(panOffsetFromDrag(0, 10_000, 5, 500, 180)).toBe(500);
  });
});
