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
  series: CandleSeries,
  anchor: AnchorPoint,
): Coordinate | null {
  const timeCoordinate = coordinateForTime(chart, series, anchor.time);
  if (timeCoordinate !== null) {
    return timeCoordinate;
  }
  return coordinateForLogical(chart, anchor.logical);
}

export function anchorToLogical(
  chart: ChartApi,
  series: CandleSeries,
  anchor: AnchorPoint,
): Logical | null {
  const timeLogical = logicalForTime(chart, series, anchor.time);
  if (timeLogical !== null) {
    return timeLogical;
  }
  return Number.isFinite(anchor.logical) ? (anchor.logical as Logical) : null;
}

export function anchorToPoint(
  chart: ChartApi,
  series: CandleSeries,
  anchor: AnchorPoint,
): ChartPoint | null {
  const x = anchorToCoordinate(chart, series, anchor);
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

function coordinateForTime(
  chart: ChartApi,
  series: CandleSeries,
  time: UTCTimestamp,
): Coordinate | null {
  if (!Number.isFinite(time)) return null;
  const exact = chart.timeScale().timeToCoordinate(time as Time);
  if (exact !== null) return exact;
  const logical = logicalForTime(chart, series, time);
  return logical === null ? null : chart.timeScale().logicalToCoordinate(logical);
}

function coordinateForLogical(
  chart: ChartApi,
  logical: number | undefined,
): Coordinate | null {
  return Number.isFinite(logical)
    ? chart.timeScale().logicalToCoordinate(logical as Logical)
    : null;
}

function logicalForTime(
  chart: ChartApi,
  series: CandleSeries,
  targetTime: UTCTimestamp,
): Logical | null {
  if (!Number.isFinite(targetTime)) return null;
  const data = series
    .data()
    .map((item, index) => ({ index, time: numericTime(item) }))
    .filter((item): item is { index: number; time: number } => item.time !== undefined);
  if (data.length === 0) return null;

  let low = 0;
  let high = data.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const item = data[mid];
    if (item.time === targetTime) {
      return logicalForDataPoint(chart, item) as Logical;
    }
    if (item.time < targetTime) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const right = low < data.length ? data[low] : undefined;
  const left = high >= 0 ? data[high] : undefined;
  if (left !== undefined && right !== undefined && right.time > left.time) {
    const leftLogical = logicalForDataPoint(chart, left);
    const rightLogical = logicalForDataPoint(chart, right);
    const ratio = (targetTime - left.time) / (right.time - left.time);
    return (leftLogical + ratio * (rightLogical - leftLogical)) as Logical;
  }

  const step = estimateStepSeconds(series);
  if (left !== undefined) {
    return (logicalForDataPoint(chart, left) + (targetTime - left.time) / step) as Logical;
  }
  if (right !== undefined) {
    return (logicalForDataPoint(chart, right) - (right.time - targetTime) / step) as Logical;
  }
  return null;
}

function logicalForDataPoint(
  chart: ChartApi,
  item: { index: number; time: number },
): number {
  const index = chart.timeScale().timeToIndex(item.time as Time, false);
  return index === null ? item.index : (index as number);
}
