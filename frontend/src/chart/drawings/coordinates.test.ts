import { describe, expect, it } from "vitest";

import { anchorToCoordinate, anchorToLogical } from "./coordinates";
import type { AnchorPoint } from "./types";

function makeChart(
  exactCoordinateTimes = new Map<number, number>(),
  timeIndexes = new Map<number, number>(),
) {
  const timeScale = {
    coordinateToLogical: (x: number) => x / 10,
    logicalToCoordinate: (logical: number) => logical * 10,
    timeToCoordinate: (time: number) => exactCoordinateTimes.get(time) ?? null,
    timeToIndex: (time: number) => timeIndexes.get(time) ?? null,
  };
  return { timeScale: () => timeScale };
}

function makeSeries(times: readonly number[]) {
  return {
    data: () => times.map((time) => ({ time })),
    dataByIndex: (index: number) => ({ time: times[index] }),
    priceToCoordinate: (price: number) => price,
    coordinateToPrice: (y: number) => y,
  };
}

describe("drawing coordinate anchors", () => {
  it("prefers timestamp coordinates over stale logical indexes", () => {
    const times = [0, 60, 120, 180, 240, 300, 360];
    const chart = makeChart(new Map([[300, 555]]), indexesForTimes(times));
    const series = makeSeries(times);
    const anchor: AnchorPoint = { time: 300 as never, price: 10, logical: 2 };

    expect(anchorToCoordinate(chart as never, series as never, anchor)).toBe(555);
    expect(anchorToLogical(chart as never, series as never, anchor)).toBe(5);
  });

  it("interpolates timestamp anchors that are between bars", () => {
    const times = [0, 60, 120, 180, 240, 360];
    const chart = makeChart(new Map(), indexesForTimes(times));
    const series = makeSeries(times);
    const anchor: AnchorPoint = { time: 300 as never, price: 10, logical: 99 };

    expect(anchorToCoordinate(chart as never, series as never, anchor)).toBe(45);
    expect(anchorToLogical(chart as never, series as never, anchor)).toBe(4.5);
  });

  it("falls back to logical when the chart has no timestamp data", () => {
    const chart = makeChart();
    const series = makeSeries([]);
    const anchor: AnchorPoint = { time: 300 as never, price: 10, logical: 7 };

    expect(anchorToCoordinate(chart as never, series as never, anchor)).toBe(70);
    expect(anchorToLogical(chart as never, series as never, anchor)).toBe(7);
  });
});

function indexesForTimes(times: readonly number[]): Map<number, number> {
  return new Map(times.map((time, index) => [time, index]));
}
