import {
  MismatchDirection,
  type Coordinate,
  type IChartApiBase,
  type ISeriesApi,
  type Logical,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

import type { AnchorPoint } from "./types";

interface ChartPoint {
  x: number;
  y: number;
}

type CandleSeries = ISeriesApi<"Candlestick", Time>;
type ChartApi = IChartApiBase<Time>;

export function anchorToCoordinate(
  chart: ChartApi,
  anchor: AnchorPoint,
): Coordinate | null {
  if (Number.isFinite(anchor.logical)) {
    return chart.timeScale().logicalToCoordinate(anchor.logical as Logical);
  }
  return chart.timeScale().timeToCoordinate(anchor.time as Time);
}

export function anchorToLogical(
  chart: ChartApi,
  anchor: AnchorPoint,
): Logical | null {
  if (Number.isFinite(anchor.logical)) {
    return anchor.logical as Logical;
  }
  const x = chart.timeScale().timeToCoordinate(anchor.time as Time);
  return x === null ? null : chart.timeScale().coordinateToLogical(x);
}

export function anchorToPoint(
  chart: ChartApi,
  series: CandleSeries,
  anchor: AnchorPoint,
): ChartPoint | null {
  const x = anchorToCoordinate(chart, anchor);
  const y = series.priceToCoordinate(anchor.price);
  if (x === null || y === null) return null;
  return { x: x as number, y: y as number };
}

export function anchorFromPoint(
  chart: ChartApi,
  series: CandleSeries,
  point: ChartPoint,
): AnchorPoint | null {
  const logical = chart.timeScale().coordinateToLogical(point.x);
  const price = series.coordinateToPrice(point.y);
  if (logical === null || price === null) return null;
  return {
    time: timeForLogical(chart, series, logical),
    price: price as number,
    logical: logical as number,
  };
}

function timeForLogical(
  chart: ChartApi,
  series: CandleSeries,
  logical: Logical,
): UTCTimestamp {
  const logicalNumber = logical as number;
  const leftLogical = Math.floor(logicalNumber);
  const leftData = series.dataByIndex(leftLogical, MismatchDirection.NearestLeft);
  const rightData = series.dataByIndex(leftLogical, MismatchDirection.NearestRight);
  const baseData = numericTime(leftData) !== undefined ? leftData : rightData;
  const baseTime = numericTime(baseData) ?? lastNumericTime(series) ?? 0;
  const baseIndex =
    baseData && numericTime(baseData) !== undefined
      ? chart.timeScale().timeToIndex(baseTime as Time, true)
      : null;
  const step = estimateStepSeconds(series);
  const delta = logicalNumber - (baseIndex ?? leftLogical);
  return Math.round(baseTime + delta * step) as UTCTimestamp;
}

function numericTime(data: { time: Time } | null | undefined): number | undefined {
  return typeof data?.time === "number" ? data.time : undefined;
}

function lastNumericTime(series: CandleSeries): number | undefined {
  const data = series.data();
  for (let i = data.length - 1; i >= 0; i--) {
    const time = numericTime(data[i]);
    if (time !== undefined) return time;
  }
  return undefined;
}

function estimateStepSeconds(series: CandleSeries): number {
  const data = series.data();
  const diffs: number[] = [];
  let previous: number | undefined;
  for (const item of data.slice(Math.max(0, data.length - 80))) {
    const time = numericTime(item);
    if (time === undefined) continue;
    if (previous !== undefined && time > previous) {
      diffs.push(time - previous);
    }
    previous = time;
  }
  if (diffs.length === 0) return 60;
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)] || 60;
}
