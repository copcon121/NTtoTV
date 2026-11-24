import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChartSyncLayer } from "./ChartSyncLayer";
import { type ChartSyncConfig, type SharedDrawing } from "./sync";

const base: ChartSyncConfig = { widgetId: "fp", instanceId: "mount", workspaceId: "w", groupId: "A", epoch: "e", revision: 0, symbol: "GC", contract: "GC", mode: "live", syncViewport: true, syncDrawings: true, drawings: [] };
const times = [1_000, 1_060, 1_600];
function harness() {
  const rangeHandlers = new Set<() => void>();
  const data = times.map(time => ({ time, open: 2, high: 4, low: 1, close: 3 }));
  let range = { from: 0, to: 2 };
  const scale = { options: () => ({ barSpacing: 10 }), getVisibleLogicalRange: () => range,
    setVisibleLogicalRange: vi.fn((next: typeof range) => { range = next; rangeHandlers.forEach(fn => fn()); }),
    subscribeVisibleLogicalRangeChange: (fn: () => void) => rangeHandlers.add(fn), unsubscribeVisibleLogicalRangeChange: (fn: () => void) => rangeHandlers.delete(fn),
    logicalToCoordinate: (logical: number) => Number.isInteger(logical) ? logical * 10 : 0, coordinateToLogical: (x: number) => Math.ceil(x / 10),
    timeToCoordinate: (time: number) => times.includes(time) ? times.indexOf(time) * 10 : null,
    timeToIndex: (time: number) => times.includes(time) ? times.indexOf(time) : null };
  const chart = { timeScale: () => scale, applyOptions: vi.fn(), paneSize: () => ({ width: 240, height: 180 }),
    subscribeClick: vi.fn(), unsubscribeClick: vi.fn(), subscribeCrosshairMove: vi.fn(), unsubscribeCrosshairMove: vi.fn() };
  const series = { data: () => data, dataByIndex: (i: number) => data[i], priceToCoordinate: (price: number) => price, coordinateToPrice: (y: number) => y,
    priceScale: () => ({ setVisibleRange: vi.fn() }),
    attachPrimitive: vi.fn((p: { attached?: (v: unknown) => void }) => p.attached?.({ chart, series, requestUpdate: vi.fn() })),
    detachPrimitive: vi.fn((p: { detached?: () => void }) => p.detached?.()) };
  const container = document.createElement("div"); document.body.appendChild(container);
  return { chart: chart as never, series: series as never, container, scale, primitiveSeries: series };
}
function flush() { act(() => vi.advanceTimersByTime(100)); }
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => setTimeout(() => fn(0), 16));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  vi.stubGlobal("PointerEvent", MouseEvent);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); document.body.innerHTML = ""; });
describe("native chart shared layer", () => {
  it("keeps half-bar candles and off-bar UTC anchors distinct on an integer-only native scale", () => {
    const h = harness(), projection = vi.fn();
    render(<ChartSyncLayer {...h} sync={{ config: base, publish: vi.fn() }} onProjectionChange={projection} />);
    flush();
    const p = projection.mock.calls[projection.mock.calls.length - 1][0];
    const utc = [970_000, 1_030_000, 1_090_000, 1_330_000, 1_630_000];
    const xs = utc.map(time => p.timeToX(time));
    expect(xs[1]).toBe(5);
    expect(xs[3]).toBe(15);
    expect(new Set(xs).size).toBe(utc.length);
    for (let i = 0; i < utc.length; i++) expect(p.xToTime(xs[i])).toBeCloseTo(utc[i], 3);
  });
  it("applies remote state/UTC viewport without echo, and publishes native gestures only", () => {
    const h = harness(), publish = vi.fn(), projection = vi.fn();
    const drawing: SharedDrawing = { id: "shared-a", tool: "rectangle", anchors: [{ utcMs: 1_000_000, price: 30 }, { utcMs: 1_600_000, price: 50 }] };
    const cfg = { ...base, viewport: { fromUtcMs: 1_030_000, toUtcMs: 1_330_000 }, drawings: [drawing] };
    const view = render(<ChartSyncLayer {...h} sync={{ config: cfg, publish }} onProjectionChange={projection} />);
    flush();
    expect(h.scale.setVisibleLogicalRange).toHaveBeenCalledWith({ from: 0.5, to: 1.5 });
    expect(projection.mock.calls[0][0].timeToX(1_330_000)).toBe(15);
    expect(publish).not.toHaveBeenCalled();
    const attachedCount = h.primitiveSeries.attachPrimitive.mock.calls.length;
    fireEvent.pointerDown(h.container, { clientX: 10, clientY: 80, button: 0 });
    view.rerender(<ChartSyncLayer {...h} sync={{ config: { ...cfg, revision: 1, viewport: { fromUtcMs: 1_000_000, toUtcMs: 1_600_000 } }, publish }} onProjectionChange={projection} />);
    flush();
    expect(publish).not.toHaveBeenCalled();
    expect(h.primitiveSeries.attachPrimitive.mock.calls.length).toBe(attachedCount);
    act(() => h.scale.setVisibleLogicalRange({ from: 0.25, to: 1.25 })); flush();
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0][0].viewport).toEqual({ fromUtcMs: 1_015_000, toUtcMs: 1_195_000 });
    fireEvent.pointerUp(window); flush();
  });
  it("creates, updates and deletes stable manual identities using the actual drawing manager", () => {
    const h = harness(), publish = vi.fn();
    render(<ChartSyncLayer {...h} sync={{ config: base, publish }} showDrawingMenu />); flush();
    fireEvent.click(screen.getByRole("button", { name: "Trend Line" }));
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0][0].toolSelection?.tool).toBe("trendline");
    publish.mockClear();
    const hit = screen.getByLabelText("Shared drawing canvas");
    fireEvent.click(hit, { clientX: 5, clientY: 30 });
    expect(publish).not.toHaveBeenCalled(); // placement preview is private
    fireEvent.pointerMove(hit, { clientX: 15, clientY: 50 });
    expect(publish).not.toHaveBeenCalled();
    fireEvent.click(hit, { clientX: 15, clientY: 50 });
    const created = publish.mock.calls[0][0].drawingOps[0].drawing;
    expect(created.id).toMatch(/^shared-/);
    expect(created.anchors).toEqual([{ utcMs: 1_030_000, price: 30 }, { utcMs: 1_330_000, price: 50 }]);
    fireEvent.pointerDown(hit, { clientX: 5, clientY: 30, button: 0 });
    fireEvent.pointerMove(hit, { clientX: 6, clientY: 35 });
    fireEvent.pointerUp(hit, { clientX: 6, clientY: 35 });
    const updated = publish.mock.calls.flatMap(call => call[0].drawingOps ?? []).filter(op => op.op === "upsert");
    expect(updated.length).toBeGreaterThan(1);
    expect(updated[updated.length - 1].drawing.id).toBe(created.id);
    fireEvent.click(screen.getByRole("button", { name: "Clear drawings" }));
    expect(publish.mock.calls[publish.mock.calls.length - 1][0]).toEqual({ drawingOps: [{ op: "delete", id: created.id }] });
  });
  it("supports one-anchor vertical lines and clears received group layers without deleting local geometry", () => {
    const h = harness(), publish = vi.fn();
    const view = render(<ChartSyncLayer {...h} sync={{ config: base, publish }} showDrawingMenu />); flush();
    fireEvent.click(screen.getByRole("button", { name: "Vertical Line" }));
    expect(publish).toHaveBeenCalledTimes(1);
    publish.mockClear();
    fireEvent.click(screen.getByLabelText("Shared drawing canvas"), { clientX: 10, clientY: 40 });
    expect(publish.mock.calls[0][0].drawingOps[0].drawing.tool).toBe("vertical_line");
    publish.mockClear();
    view.rerender(<ChartSyncLayer {...h} sync={{ config: { ...base, epoch: "other-group", groupId: "B" }, publish }} showDrawingMenu />);
    flush(); expect(publish).not.toHaveBeenCalled();
    expect(h.primitiveSeries.detachPrimitive).toHaveBeenCalled();
  });
  it("cancels partial old-group placements and releases input when drawing linking is disabled", () => {
    const h = harness(), publish = vi.fn();
    const view = render(<ChartSyncLayer {...h} sync={{ config: base, publish }} showDrawingMenu />); flush();
    fireEvent.click(screen.getByRole("button", { name: "Trend Line" }));
    expect(publish).toHaveBeenCalledTimes(1);
    publish.mockClear();
    const hit = screen.getByLabelText("Shared drawing canvas");
    fireEvent.click(hit, { clientX: 5, clientY: 30 });
    view.rerender(<ChartSyncLayer {...h} sync={{ config: { ...base, epoch: "new", groupId: "B", syncDrawings: false }, publish }} showDrawingMenu />);
    expect(hit.className).not.toContain("is-editing");
    publish.mockClear();
    fireEvent.click(hit, { clientX: 15, clientY: 50 });
    expect(publish).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Draw Tool")).toBeNull();
  });
});
