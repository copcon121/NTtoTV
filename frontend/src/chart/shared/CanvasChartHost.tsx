import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { CandlestickSeries, ColorType, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { workspaceColors } from "../../workspace/themes";
import { useWorkspaceTheme } from "../../workspace/useWorkspaceTheme";
import { ChartSyncLayer, type SharedChartProjection } from "./ChartSyncLayer";
import type { ChartSyncConnection } from "./sync";
import { logicalToTime, timeToLogical } from "./coordinates";
import type { Bar } from "../../cache/types";
import "./shared.css";

export type SharedHostBar = Pick<Bar, "time" | "open" | "high" | "low" | "close">;
export interface HostNavigation { revision: number; factor?: number; latest?: boolean; visibleBars?: number }
export function CanvasChartHost({ bars, sync, children, title, bottomMargin = 0.1, navigation, localDrawingActive, onSharedEditingChange }: {
  bars: readonly SharedHostBar[]; sync: ChartSyncConnection; children: (projection: SharedChartProjection) => ReactNode; title: string; bottomMargin?: number;
  navigation?: HostNavigation; localDrawingActive?: boolean; onSharedEditingChange?: (editing: boolean) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const chartRoot = useRef<HTMLDivElement>(null);
  const [binding, setBinding] = useState<{ chart: IChartApi; series: ISeriesApi<"Candlestick">; container: HTMLElement }>();
  const [projection, setProjection] = useState<SharedChartProjection>();
  const theme = useWorkspaceTheme();
  const colors = workspaceColors(theme);
  useLayoutEffect(() => {
    const container = chartRoot.current;
    if (!container) return;
    const chart = createChart(container, { autoSize: true, layout: { background: { type: ColorType.Solid, color: theme.background }, textColor: theme.text },
      grid: { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } },
      timeScale: { timeVisible: true, secondsVisible: true, minBarSpacing: 2, maxBarSpacing: 250 }, rightPriceScale: { minimumWidth: 78, scaleMargins: { top: 0.07, bottom: bottomMargin } },
      handleScroll: { vertTouchDrag: false, horzTouchDrag: true }, handleScale: { pinch: true } });
    const series = chart.addSeries(CandlestickSeries, { upColor: "#00000000", downColor: "#00000000", wickVisible: false, borderVisible: false, lastValueVisible: false, priceLineVisible: false });
    setBinding({ chart, series, container });
    return () => { queueMicrotask(() => chart.remove()); };
  }, []);
  useEffect(() => { binding?.chart.applyOptions({ layout: { background: { type: ColorType.Solid, color: theme.background }, textColor: theme.text }, grid: { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } } }); }, [binding, theme]);
  useLayoutEffect(() => {
    if (!binding) return;
    const sorted = [...new Map(bars.map(bar => [bar.time, bar])).values()].sort((a, b) => a.time - b.time);
    const previous = binding.chart.timeScale().getVisibleLogicalRange();
    binding.series.setData(sorted.map(bar => ({ ...bar, time: bar.time / 1000 as UTCTimestamp })));
    const requested = sync.config?.syncViewport ? sync.config.viewport : undefined;
    if (requested) {
      const times = sorted.map(b => b.time);
      const from = timeToLogical(times, requested.fromUtcMs), to = timeToLogical(times, requested.toUtcMs);
      if (from !== null && to !== null) binding.chart.timeScale().setVisibleLogicalRange({ from, to });
    } else if (!previous) binding.chart.timeScale().fitContent();
    else binding.chart.timeScale().setVisibleLogicalRange(previous);
  }, [binding, bars, sync.config?.epoch]);
  const update = useCallback((next: SharedChartProjection) => setProjection(next), []);
  const navigationApplied = useRef(navigation?.revision ?? 0);
  useLayoutEffect(() => {
    if (!binding || !navigation || navigationApplied.current === navigation.revision) return;
    const times = binding.series.data().map(bar => Number(bar.time) * 1000);
    const previous = binding.chart.timeScale().getVisibleLogicalRange();
    if (!previous || !times.length) return;
    navigationApplied.current = navigation.revision;
    const span = Math.max(2, navigation.visibleBars ?? (previous.to - previous.from) * (navigation.factor ?? 1));
    const center = (previous.to + previous.from) / 2;
    const to = navigation.latest ? times.length + 1 : center + span / 2;
    const from = to - span;
    binding.chart.timeScale().setVisibleLogicalRange({ from, to });
    const fromUtcMs = logicalToTime(times, from), toUtcMs = logicalToTime(times, to);
    if (fromUtcMs !== null && toUtcMs !== null && fromUtcMs >= 0 && toUtcMs > fromUtcMs && sync.config?.syncViewport) sync.publish({ viewport: { fromUtcMs, toUtcMs } });
  }, [binding, navigation, bars]);
  const outside = sync.config?.viewport && bars.length && (sync.config.viewport.fromUtcMs < bars[0].time || sync.config.viewport.toUtcMs > bars[bars.length - 1].time + 60_000);
  return <div ref={root} className="shared-canvas-chart-host" aria-label={`${title} linked chart`}>
    <div ref={chartRoot} className="shared-canvas-chart-native" role="img" aria-label={`${title} pan and zoom canvas`} />
    {projection && <div className="shared-canvas-chart-overlay">{children(projection)}</div>}
    {binding && <ChartSyncLayer {...binding} sync={sync} showDrawingMenu onProjectionChange={update} suspendEditing={localDrawingActive} onEditingChange={onSharedEditingChange} />}
    {outside ? <div className="shared-chart-coverage" role="status">Part of the linked time range has no loaded data.</div> : null}
  </div>;
}
