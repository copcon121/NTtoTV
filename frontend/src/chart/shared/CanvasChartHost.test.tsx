import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createChart } from "lightweight-charts";
import { CanvasChartHost } from "./CanvasChartHost";
import type { ChartSyncConfig } from "./sync";
vi.mock("lightweight-charts", async importOriginal => ({ ...await importOriginal<object>(), createChart: vi.fn() }));

const config: ChartSyncConfig = { widgetId: "fp", instanceId: "mount", epoch: "e", workspaceId: "w", groupId: "A", revision: 0, symbol: "GC", contract: "GC", mode: "live", syncViewport: true, syncDrawings: false, drawings: [] };
const bars = [1_000_000, 1_060_000, 1_600_000].map(time => ({ time, open: 4200, high: 4202, low: 4198, close: 4201 }));
let resize: () => void;
function setup() {
  let range: { from: number; to: number } | null = null;
  let data: Array<{ time: number }> = [];
  const listeners = new Set<() => void>(), dataListeners = new Set<() => void>();
  const scale = { options: () => ({ barSpacing: 10 }), getVisibleLogicalRange: () => range,
    setVisibleLogicalRange: vi.fn((next: typeof range) => { range = next; listeners.forEach(fn => fn()); }),
    fitContent: () => scale.setVisibleLogicalRange({ from: 0, to: Math.max(1, data.length - 1) }),
    subscribeVisibleLogicalRangeChange: (fn: () => void) => listeners.add(fn), unsubscribeVisibleLogicalRangeChange: (fn: () => void) => listeners.delete(fn),
    timeToIndex: (t: number) => data.findIndex(d => d.time === t), timeToCoordinate: (t: number) => data.findIndex(d => d.time === t) * 10,
    logicalToCoordinate: (i: number) => i * 10, coordinateToLogical: (x: number) => x / 10 };
  const series = { data: vi.fn(() => data), setData: vi.fn((next: typeof data) => { data = next; dataListeners.forEach(fn => fn()); }),
    subscribeDataChanged: (fn: () => void) => dataListeners.add(fn), unsubscribeDataChanged: (fn: () => void) => dataListeners.delete(fn),
    priceScale: () => ({ setVisibleRange: vi.fn() }), priceToCoordinate: (p: number) => 4205 - p, coordinateToPrice: (y: number) => 4205 - y,
    attachPrimitive: vi.fn(), detachPrimitive: vi.fn() };
  const chart = { addSeries: () => series, timeScale: () => scale, paneSize: () => ({ width: 600, height: 300 }), applyOptions: vi.fn(), remove: vi.fn(),
    subscribeClick: vi.fn(), unsubscribeClick: vi.fn(), subscribeCrosshairMove: vi.fn(), unsubscribeCrosshairMove: vi.fn() };
  vi.mocked(createChart).mockReturnValue(chart as never);
  return { chart, series, scale };
}
const renderProjection = (p: { viewport: unknown }) => <output data-testid="projection">{JSON.stringify(p.viewport)}</output>;
function flush() { act(() => vi.advanceTimersByTime(100)); }
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("ResizeObserver", class { constructor(fn: () => void) { resize = fn; } observe() {} disconnect() {} });
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => setTimeout(() => fn(0), 16)); vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id)); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe("specialized Canvas lightweight host", () => {
  it("projects real loaded UTC data, retains viewport across resize and rebuilds calendar on history changes", () => {
    const h = setup(), publish = vi.fn();
    const view = render(<CanvasChartHost bars={bars} sync={{ config, publish }} title="Footprint">{renderProjection}</CanvasChartHost>); flush();
    expect(screen.getByTestId("projection").textContent).toBe(JSON.stringify({ fromUtcMs: bars[0].time, toUtcMs: bars[2].time }));
    act(() => resize()); flush(); expect(publish).not.toHaveBeenCalled();
    const next = [bars[0], bars[1], { ...bars[2], time: 2_200_000 }];
    view.rerender(<CanvasChartHost bars={next} sync={{ config, publish }} title="Footprint">{renderProjection}</CanvasChartHost>); flush();
    expect(screen.getByTestId("projection").textContent).toContain("2200000");
    expect(h.series.setData).toHaveBeenCalledTimes(2);
  });
  it("runs linked zoom/Latest commands once and ACKs do not reset history or echo", () => {
    const h = setup(), publish = vi.fn();
    const view = render(<CanvasChartHost bars={bars} sync={{ config, publish }} navigation={{ revision: 0 }} title="Liquidity">{renderProjection}</CanvasChartHost>); flush();
    view.rerender(<CanvasChartHost bars={bars} sync={{ config, publish }} navigation={{ revision: 1, factor: 2 }} title="Liquidity">{renderProjection}</CanvasChartHost>); flush();
    expect(h.scale.getVisibleLogicalRange()).toEqual({ from: -1, to: 3 });
    expect(publish).toHaveBeenCalledTimes(1);
    const viewport = publish.mock.calls[0][0].viewport;
    view.rerender(<CanvasChartHost bars={bars} sync={{ config: { ...config, revision: 1, viewport }, publish }} navigation={{ revision: 1 }} title="Liquidity">{renderProjection}</CanvasChartHost>); flush();
    expect(h.series.setData).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledTimes(1);
    view.rerender(<CanvasChartHost bars={bars} sync={{ config: { ...config, revision: 1, viewport }, publish }} navigation={{ revision: 2, latest: true, visibleBars: 2 }} title="Liquidity">{renderProjection}</CanvasChartHost>); flush();
    expect(h.scale.getVisibleLogicalRange()).toEqual({ from: 2, to: 4 });
    expect(publish).toHaveBeenCalledTimes(2);
  });
});
