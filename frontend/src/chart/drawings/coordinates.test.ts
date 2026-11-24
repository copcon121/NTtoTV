import { describe, expect, it } from "vitest";

import { anchorFromPoint, anchorToCoordinate, anchorToLogical, coordinateForLogical, logicalForCoordinate } from "./coordinates";
import type { AnchorPoint } from "./types";

function makeChart(
  exactCoordinateTimes = new Map<number, number>(),
  timeIndexes = new Map<number, number>(),
) {
  const timeScale = {
    coordinateToLogical: (x: number) => Math.ceil(x / 10),
    logicalToCoordinate: (logical: number) => Number.isInteger(logical) ? logical * 10 : 0,
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
  it("interpolates native integer coordinates for fractional, negative and future positions", () => {
    const chart = makeChart();
    for (const logical of [-1.75, -0.5, 0, 0.5, 2.25, 100.5]) {
      expect(coordinateForLogical(chart as never, logical)).toBeCloseTo(logical * 10);
      expect(logicalForCoordinate(chart as never, logical * 10)).toBeCloseTo(logical);
    }
    expect(coordinateForLogical(chart as never, undefined)).toBeNull();
    expect(coordinateForLogical(chart as never, NaN)).toBeNull();
    expect(coordinateForLogical({ timeScale: () => ({ logicalToCoordinate: () => null }) } as never, 0.5)).toBeNull();
    expect(logicalForCoordinate(chart as never, Infinity)).toBeNull();
  });
  it("roundtrips fractional anchors across gaps and global indicator-only logical positions", () => {
    const times = [1000, 1060, 1600], indices = new Map([[1000, 0], [1060, 2], [1600, 4]]);
    const chart = makeChart(new Map(), indices), series = makeSeries(times);
    const anchor = anchorFromPoint(chart as never, series as never, { x: 25, y: 10 })!;
    expect(anchor.time).toBe(1195);
    expect(anchorToCoordinate(chart as never, series as never, anchor)).toBe(25);
  });
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

  it("searches loaded bars without mapping the full series for an old anchor", () => {
    const times = Array.from({ length: 4_320 }, (_, index) => 1_000 + index * 60);
    const chart = makeChart(new Map(), indexesForTimes(times));
    const data = times.map((time) => ({ time }));
    let sliceCalls = 0;
    const guardedData = new Proxy(data, {
      get(target, property, receiver) {
        if (property === "map" || property === "filter") {
          throw new Error("full-series allocation is not allowed during lookup");
        }
        if (property === "slice") {
          return (...args: Parameters<typeof target.slice>) => {
            sliceCalls += 1;
            return target.slice(...args);
          };
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const series = {
      ...makeSeries(times),
      data: () => guardedData,
    };
    const anchor: AnchorPoint = { time: 0 as never, price: 10, logical: -20 };

    expect(anchorToLogical(chart as never, series as never, anchor)).toBeCloseTo(
      -1_000 / 60,
    );
    expect(
      anchorToLogical(chart as never, series as never, {
        ...anchor,
        time: -60 as never,
      }),
    ).toBeCloseTo(-1_060 / 60);
    expect(sliceCalls).toBe(1);
  });
});

function indexesForTimes(times: readonly number[]): Map<number, number> {
  return new Map(times.map((time, index) => [time, index]));
}
