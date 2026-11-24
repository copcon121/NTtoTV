import { useEffect, useMemo, useRef, useState } from "react";

import { ApiClient } from "../api/client";
import { barEndForTimeframe } from "../chart/barCountdown";
import type { Bar, FootprintRow, Timeframe } from "../socket/messages";
import type { FootprintBar } from "./footprintModel";

const MINUTE_MS = 60_000;
export const MAX_CHART_FOOTPRINT_MINUTES = 5000;
const EMPTY_BARS: ReadonlyMap<number, FootprintBar> = new Map();

export interface ChartFootprintRange { from: number; to: number }

interface ChartFootprintOptions {
  symbol: string;
  contract: string;
  timeframe: Timeframe;
  bars: readonly Bar[];
  range: ChartFootprintRange | undefined;
  liveBars: ReadonlyMap<number, FootprintBar>;
  enabled: boolean;
  suspendRealtime: boolean;
  api?: Pick<ApiClient, "footprintDetails">;
}

function profileForRows(rows: FootprintRow[]) {
  const volumes = rows.map((row) => row.bid + row.ask);
  const total = volumes.reduce((sum, volume) => sum + volume, 0);
  const pocIndex = volumes.indexOf(Math.max(...volumes));
  let upper = pocIndex;
  let lower = pocIndex;
  let accumulated = volumes[pocIndex];
  while (accumulated < total * 0.7 && (upper > 0 || lower < rows.length - 1)) {
    const above = upper > 0 ? volumes[upper - 1] : -1;
    const below = lower < rows.length - 1 ? volumes[lower + 1] : -1;
    if (above >= below) accumulated += volumes[--upper];
    else accumulated += volumes[++lower];
  }
  return { poc: rows[pocIndex].price, pocVolume: volumes[pocIndex], vah: rows[upper].price, val: rows[lower].price };
}

/** Sum actual M1 ladders into the chart's existing bar intervals. */
export function aggregateChartFootprint(
  minuteBars: ReadonlyMap<number, FootprintBar>,
  chartBars: readonly Bar[],
  timeframe: Timeframe,
): ReadonlyMap<number, FootprintBar> {
  if (timeframe === "15s" || timeframe === "30s") return EMPTY_BARS;
  const source = [...minuteBars.values()].filter((bar) => bar.tf === "1m" && bar.rows.length > 0).sort((a, b) => a.time - b.time);
  const chart = [...chartBars].sort((a, b) => a.time - b.time);
  const result = new Map<number, FootprintBar>();
  let sourceIndex = 0;
  for (let chartIndex = 0; chartIndex < chart.length; chartIndex++) {
    const candle = chart[chartIndex];
    const end = Math.min(barEndForTimeframe(candle.time, timeframe), chart[chartIndex + 1]?.time ?? Infinity);
    while (sourceIndex < source.length && source[sourceIndex].time < candle.time) sourceIndex++;
    const startIndex = sourceIndex;
    const byPrice = new Map<number, FootprintRow>();
    while (sourceIndex < source.length && source[sourceIndex].time < end) {
      for (const row of source[sourceIndex].rows) {
        const price = Math.round(row.price * 1e10) / 1e10;
        const previous = byPrice.get(price);
        byPrice.set(price, { price, bid: (previous?.bid ?? 0) + row.bid, ask: (previous?.ask ?? 0) + row.ask, imbalance: null });
      }
      sourceIndex++;
    }
    if (sourceIndex === startIndex || byPrice.size === 0) continue;
    const rows = [...byPrice.values()].sort((a, b) => b.price - a.price);
    const bid = rows.reduce((sum, row) => sum + row.bid, 0);
    const ask = rows.reduce((sum, row) => sum + row.ask, 0);
    const high = rows[0];
    const low = rows[rows.length - 1];
    result.set(candle.time, {
      ...source[startIndex], tf: timeframe, time: candle.time,
      open: candle.open, high: candle.high, low: candle.low, close: candle.close,
      rows, ...profileForRows(rows), barDelta: ask - bid,
      buyPct: ask + bid > 0 ? ask / (ask + bid) : 0,
      sellPct: ask + bid > 0 ? bid / (ask + bid) : 0,
      stackedImbalance: [],
      unfinishedAuction: { high: high.bid > 0 && high.ask > 0, low: low.bid > 0 && low.ask > 0 },
    });
  }
  return result;
}

interface HistoryState {
  key: string;
  bars: ReadonlyMap<number, FootprintBar>;
  liveAtRequest: ReadonlyMap<number, FootprintBar>;
  loading: boolean;
  error?: string;
}

export function useChartFootprint({
  symbol, contract, timeframe, bars, range, liveBars, enabled, suspendRealtime, api: providedApi,
}: ChartFootprintOptions): { bars: ReadonlyMap<number, FootprintBar>; loading: boolean; error?: string } {
  const defaultApi = useMemo(() => new ApiClient(), []);
  const api = providedApi ?? defaultApi;
  const from = range ? Math.floor(range.from / MINUTE_MS) * MINUTE_MS : undefined;
  const to = range ? Math.floor(range.to) : undefined;
  const seriesKey = `${symbol}/${contract}/${timeframe}`;
  const rangeKey = `${seriesKey}/${from}/${to}`;
  const supported = timeframe !== "15s" && timeframe !== "30s";
  const tooWide = !suspendRealtime && from !== undefined && to !== undefined && Math.floor(to / MINUTE_MS) - from / MINUTE_MS + 1 > MAX_CHART_FOOTPRINT_MINUTES;
  const liveRef = useRef(liveBars);
  liveRef.current = liveBars;
  const [history, setHistory] = useState<HistoryState>();

  useEffect(() => {
    if (!enabled || !supported || suspendRealtime || from === undefined || to === undefined || from > to || tooWide) return;
    let cancelled = false;
    const liveAtRequest = liveRef.current;
    setHistory({ key: rangeKey, bars: EMPTY_BARS, liveAtRequest, loading: true });
    const timer = window.setTimeout(() => {
      void api.footprintDetails(symbol, contract, { from, to }).then((response) => {
        if (cancelled) return;
        const next = new Map(response.bars.filter((bar) => bar.symbol === symbol && bar.contract === contract && bar.tf === "1m" && bar.time >= from && bar.time <= to).map((bar) => [bar.time, bar]));
        setHistory({ key: rangeKey, bars: next, liveAtRequest, loading: false });
      }).catch((cause: unknown) => {
        if (!cancelled) setHistory({ key: rangeKey, bars: EMPTY_BARS, liveAtRequest, loading: false, error: cause instanceof Error ? cause.message : "Could not load footprint ladders." });
      });
    }, 200);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [api, symbol, contract, supported, enabled, suspendRealtime, from, to, rangeKey, tooWide]);

  const current = history?.key === rangeKey ? history : undefined;
  const footprint = useMemo(() => {
    if (!enabled || !supported || tooWide || from === undefined || to === undefined) return EMPTY_BARS;
    const merged = new Map(suspendRealtime ? EMPTY_BARS : current?.bars);
    for (const [time, bar] of liveBars) {
      if (bar.symbol !== symbol || bar.contract !== contract || bar.tf !== "1m" || time < from || time > to) continue;
      // A response replaces the snapshot present when its request began.
      // Updates arriving during or after that request retain priority.
      if (suspendRealtime || !merged.has(time) || current?.liveAtRequest.get(time) !== bar) merged.set(time, bar);
    }
    return aggregateChartFootprint(merged, bars, timeframe);
  }, [enabled, supported, tooWide, from, to, suspendRealtime, current, liveBars, symbol, contract, bars, timeframe]);

  return {
    bars: footprint,
    loading: enabled && !suspendRealtime && (current?.loading ?? false),
    error: !enabled || suspendRealtime ? undefined : tooWide ? "Zoom in to load footprint ladders for at most 5000 M1 bars." : current?.error,
  };
}
