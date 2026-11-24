import {
  MismatchDirection,
  type Coordinate,
  type IChartApiBase,
  type ISeriesApi,
  type Logical,
  type SeriesType,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

import type { AnchorPoint } from "./types";

interface ChartPoint {
  x: number;
  y: number;
}

type DrawingSeries = ISeriesApi<SeriesType, Time>;
type ChartApi = IChartApiBase<Time>;

const stepEstimateCache = new WeakMap<
  DrawingSeries,
  { dataLength: number; lastTime: number | undefined; step: number }
>();

export function anchorToCoordinate(
  chart: ChartApi,
  series: DrawingSeries,
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
  series: DrawingSeries,
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
  series: DrawingSeries,
  anchor: AnchorPoint,
): ChartPoint | null {
  const x = anchorToCoordinate(chart, series, anchor);
  const y = series.priceToCoordinate(anchor.price);
  if (x === null || y === null) return null;
  return { x: x as number, y: y as number };
}

export function anchorFromPoint(
  chart: ChartApi,
  series: DrawingSeries,
  point: ChartPoint,
): AnchorPoint | null {
  const logical = logicalForCoordinate(chart, point.x);
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
  series: DrawingSeries,
  logical: Logical,
): UTCTimestamp {
  const logicalNumber = logical as number;
  const values = series.data();
  // Use the actual loaded calendar for fractional anchors across session/data gaps.
  // A median bar step is only meaningful outside covered history.
  let low = 0, high = values.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const time = numericTime(values[mid]);
    if (time === undefined) break;
    const index = logicalForDataPoint(chart, mid, time);
    if (index === logicalNumber) return time as UTCTimestamp;
    if (index < logicalNumber) low = mid + 1; else high = mid - 1;
  }
  const leftTime = numericTime(values[high]), rightTime = numericTime(values[low]);
  if (leftTime !== undefined && rightTime !== undefined && leftTime < rightTime) {
    const leftIndex = logicalForDataPoint(chart, high, leftTime), rightIndex = logicalForDataPoint(chart, low, rightTime);
    return (leftTime + (logicalNumber - leftIndex) / (rightIndex - leftIndex) * (rightTime - leftTime)) as UTCTimestamp;
  }
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

function lastNumericTime(series: DrawingSeries): number | undefined {
  const data = series.data();
  for (let i = data.length - 1; i >= 0; i--) {
    const time = numericTime(data[i]);
    if (time !== undefined) return time;
  }
  return undefined;
}

function estimateStepSeconds(series: DrawingSeries): number {
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
  series: DrawingSeries,
  time: UTCTimestamp,
): Coordinate | null {
  if (!Number.isFinite(time)) return null;
  const exact = chart.timeScale().timeToCoordinate(time as Time);
  if (exact !== null) return exact;
  const logical = logicalForTime(chart, series, time);
  return coordinateForLogical(chart, logical ?? undefined);
}

export function coordinateForLogical(
  chart: ChartApi,
  logical: number | undefined,
): Coordinate | null {
  if (logical === undefined || !Number.isFinite(logical)) return null;
  const scale = chart.timeScale();
  const left = Math.floor(logical);
  const leftX = scale.logicalToCoordinate(left as Logical);
  if (leftX === null || !Number.isFinite(leftX)) return null;
  if (logical === left) return leftX;
  // lightweight-charts accepts integer indices here and returns zero for fractions.
  // UTC anchors and half-bar candle centers need the continuous native spacing.
  const rightX = scale.logicalToCoordinate((left + 1) as Logical);
  return rightX === null || !Number.isFinite(rightX) ? null
    : (leftX + (logical - left) * (rightX - leftX)) as Coordinate;
}

export function logicalForCoordinate(chart: ChartApi, x: number): Logical | null {
  if (!Number.isFinite(x)) return null;
  const scale = chart.timeScale();
  const nearest = scale.coordinateToLogical(x);
  if (nearest === null || !Number.isFinite(nearest)) return null;
  // The inverse native API snaps to an integer too. Recover the continuous
  // position from its neighbouring native coordinates instead of losing UTC.
  const left = Math.floor(nearest);
  const leftX = scale.logicalToCoordinate(left as Logical);
  const rightX = scale.logicalToCoordinate((left + 1) as Logical);
  if (leftX === null || rightX === null || !Number.isFinite(leftX) || !Number.isFinite(rightX) || rightX === leftX) return null;
  return (left + (x - leftX) / (rightX - leftX)) as Logical;
}

function logicalForTime(
  chart: ChartApi,
  series: DrawingSeries,
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
