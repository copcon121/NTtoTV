import type {
  TrendAnalyzerMarker,
  TrendAnalyzerPoint,
} from "../socket/messages";

export interface TrendAnalyzerHistoryResponse {
  symbol: string;
  contract: string;
  sourceContract?: string | null;
  from: number;
  to: number;
  settings: {
    candleInterval: "5m";
    numberOfCandles: 15;
    multiplier: 3;
    switchTicks: 3;
  };
  points: TrendAnalyzerPoint[];
  markers: TrendAnalyzerMarker[];
}

export const TREND_ANALYZER_STYLES = {
  1: { buy: "#33ff33", sell: "#ff0066" },
  2: { buy: "#ccff00", sell: "#cc00cc" },
} as const;

const MAX_POINTS = 100_000;
const MAX_MARKERS = 20_000;

export function mergeTrendPoints(
  first: TrendAnalyzerPoint[],
  second: TrendAnalyzerPoint[],
  cutoff: number,
): TrendAnalyzerPoint[] {
  const merged = new Map<string, TrendAnalyzerPoint>();
  for (const point of [...first, ...second]) {
    merged.set(`${point.instance}:${point.side}:${point.time}`, point);
  }
  const ordered = [...merged.values()]
    .sort((a, b) => a.time - b.time || a.instance - b.instance || a.side.localeCompare(b.side))
  const context = new Map<string, TrendAnalyzerPoint>();
  for (const point of ordered) {
    if (point.time < cutoff) context.set(`${point.instance}:${point.side}`, point);
  }
  return [...context.values(), ...ordered.filter((point) => point.time >= cutoff)]
    .sort((a, b) => a.time - b.time || a.instance - b.instance || a.side.localeCompare(b.side))
    .slice(-MAX_POINTS);
}

export function mergeTrendMarkers(
  first: TrendAnalyzerMarker[],
  second: TrendAnalyzerMarker[],
  cutoff: number,
): TrendAnalyzerMarker[] {
  const merged = new Map<string, TrendAnalyzerMarker>();
  for (const marker of [...first, ...second]) {
    if (marker.time < cutoff) continue;
    merged.set(
      `${marker.instance}:${marker.kind}:${marker.side}:${marker.time}:${marker.linePrice}`,
      marker,
    );
  }
  return [...merged.values()]
    .sort((a, b) => a.time - b.time || a.instance - b.instance || a.kind.localeCompare(b.kind))
    .slice(-MAX_MARKERS);
}

/** Include the last point before the viewport so changed-only lines reach its left edge. */
export function trendSeriesInRange(
  points: TrendAnalyzerPoint[],
  instance: 1 | 2,
  side: "buy" | "sell",
  from: number,
  to: number,
): TrendAnalyzerPoint[] {
  const series = points.filter(
    (point) => point.instance === instance && point.side === side && point.time <= to,
  );
  const inRange = series.filter((point) => point.time >= from);
  const prior = [...series].reverse().find((point) => point.time < from);
  return prior ? [prior, ...inRange] : inRange;
}
