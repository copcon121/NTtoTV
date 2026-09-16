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

const stepEstimateCache = new WeakMap<
  CandleSeries,
  { dataLength: number; lastTime: number | undefined; step: number }
>();

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
  const lastTime = numericTime(data[data.length - 1]);
  const cached = stepEstimateCache.get(series);
  if (
    cached !== undefined &&
    cached.dataLength === data.length &&
    cached.lastTime === lastTime
  ) {
    return cached.step;
  }
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
  let step = 60;
  if (diffs.length > 0) {
    diffs.sort((a, b) => a - b);
    step = diffs[Math.floor(diffs.length / 2)] || 60;
  }
  stepEstimateCache.set(series, { dataLength: data.length, lastTime, step });
  return step;
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
  const data = series.data();
  if (data.length === 0) return null;

  // Candle data in this app always uses numeric UTC timestamps. Search the
  // source array directly: drawing primitives call this path on every chart
  // pan frame for anchors outside the loaded history, so materialising a full
  // mapped/filtered copy here turns a single lookup into thousands of object
  // allocations per anchor and causes severe M1 navigation stalls.
  if (
    numericTime(data[0]) === undefined ||
    numericTime(data[data.length - 1]) === undefined
  ) {
    return null;
  }

  let low = 0;
  let high = data.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const itemTime = numericTime(data[mid]);
    if (itemTime === undefined) return null;
    if (itemTime === targetTime) {
      return logicalForDataPoint(chart, mid, itemTime) as Logical;
    }
    if (itemTime < targetTime) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const rightTime = low < data.length ? numericTime(data[low]) : undefined;
  const leftTime = high >= 0 ? numericTime(data[high]) : undefined;
  if (
    leftTime !== undefined &&
    rightTime !== undefined &&
    rightTime > leftTime
  ) {
    const leftLogical = logicalForDataPoint(chart, high, leftTime);
    const rightLogical = logicalForDataPoint(chart, low, rightTime);
    const ratio = (targetTime - leftTime) / (rightTime - leftTime);
    return (leftLogical + ratio * (rightLogical - leftLogical)) as Logical;
  }

  const step = estimateStepSeconds(series);
  if (leftTime !== undefined) {
    return (
      logicalForDataPoint(chart, high, leftTime) +
      (targetTime - leftTime) / step
    ) as Logical;
  }
  if (rightTime !== undefined) {
    return (
      logicalForDataPoint(chart, low, rightTime) -
      (rightTime - targetTime) / step
    ) as Logical;
  }
  return null;
}

function logicalForDataPoint(
  chart: ChartApi,
  index: number,
  time: number,
): number {
  const logicalIndex = chart.timeScale().timeToIndex(time as Time, false);
  return logicalIndex === null ? index : (logicalIndex as number);
}
