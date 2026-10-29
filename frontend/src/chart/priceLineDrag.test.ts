import { afterEach, describe, expect, it, vi } from "vitest";

import { LightweightChartsAdapter, type OrderLine } from "./lightweightChartsAdapter";

afterEach(() => document.body.replaceChildren());

function pointer(target: HTMLElement, type: string, y: number) {
  const event = new MouseEvent(type, {
    bubbles: true, cancelable: true, button: 0, clientX: 100, clientY: y,
  });
  Object.defineProperty(event, "pointerId", { value: 1 });
  target.dispatchEvent(event);
}

function dragChart() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const prices = new Map<string, { price: number }>();
  const series = {
    priceToCoordinate: (price: number) => price,
    coordinateToPrice: (y: number) => y,
    createPriceLine: (options: { price: number }) => {
      const current = { ...options };
      prices.set(String(options.price), current);
      return { applyOptions: (next: object) => Object.assign(current, next) };
    },
    removePriceLine: vi.fn(),
  };
  // Exercise the real adapter's pointer listeners with a deterministic price
  // scale, without constructing a canvas renderer in jsdom.
  const adapter: LightweightChartsAdapter = Object.assign(
    Object.create(LightweightChartsAdapter.prototype),
    {
      container, candleSeries: series,
      chart: { paneSize: () => ({ width: 600, height: 400 }), applyOptions: vi.fn() },
      orderLinesById: new Map(), orderLineMeta: new Map(),
      priceLineDragHandles: new Map(), priceLineDragConfigs: new Map(),
      pendingOrderLineCommits: new Map(),
    },
  );
  const lines: OrderLine[] = [
    { id: "ord:entryGc", orderId: "ord", field: "entryGc", price: 100,
      side: "buy", status: "filled", editable: false },
    { id: "ord:slGc", orderId: "ord", field: "slGc", price: 80,
      side: "buy", status: "filled" },
    { id: "ord:tpGc", orderId: "ord", field: "tpGc", price: 120,
      side: "buy", status: "filled" },
  ];
  adapter.setOrderLines(lines);
  return { adapter, container, prices, lines };
}

describe("live order line dragging", () => {
  it.each([
    { field: "slGc", start: 80, target: 85 },
    { field: "tpGc", start: 120, target: 135 },
  ])("keeps the chosen $field through account updates and commits it on release", ({ field, start, target }) => {
    const { adapter, container, prices, lines } = dragChart();
    const onCommitBatch = vi.fn();
    const dispose = adapter.subscribeOrderDrag({ onCommitBatch });
    pointer(container, "pointerdown", 100);
    pointer(container, "pointerup", 100);
    const handle = container.querySelector<HTMLDivElement>(`[data-line-id="ord:${field}"]`)!;
    expect(handle.hidden).toBe(false);
    pointer(handle, "pointerdown", start);
    pointer(container, "pointermove", target);
    expect(prices.get(String(start))?.price).toBe(target);

    // Profit updates rerender the original broker snapshot before pointerup.
    adapter.setOrderLines(lines);
    adapter.setOrderLines(lines);
    expect(prices.get(String(start))?.price).toBe(target);
    expect(handle.style.top).toBe(`${target}px`);
    expect(onCommitBatch).not.toHaveBeenCalled();
    pointer(container, "pointerup", target);
    expect(onCommitBatch).toHaveBeenCalledTimes(1);
    expect(onCommitBatch).toHaveBeenCalledWith([
      { id: `ord:${field}`, price: target },
    ]);

    // Once released, confirmed broker updates can move the level normally.
    adapter.setOrderLines(lines.map((line) => line.field === field
      ? { ...line, price: target + 1 } : line));
    expect(prices.get(String(start))?.price).toBe(target + 1);
    dispose();
  });
});
