import { describe, expect, it, vi } from "vitest";

import { DrawingManager } from "./DrawingManager";
import { type RectanglePrimitive } from "./RectanglePrimitive";
import { type TrendLinePrimitive } from "./TrendLinePrimitive";

function makeHarness() {
  const clickHandlers: Array<(param: unknown) => void> = [];
  const crosshairHandlers: Array<(param: unknown) => void> = [];
  const attached: unknown[] = [];

  const timeScale = {
    coordinateToLogical: (x: number) => x,
    logicalToCoordinate: (logical: number) => logical,
    timeToCoordinate: (time: number) => time,
    timeToIndex: (time: number) => time,
  };
  const chart = {
    applyOptions: vi.fn(),
    paneSize: vi.fn(() => ({ width: 240, height: 180 })),
    timeScale: () => timeScale,
    subscribeClick: vi.fn((handler: (param: unknown) => void) => {
      clickHandlers.push(handler);
    }),
    unsubscribeClick: vi.fn((handler: (param: unknown) => void) => {
      const index = clickHandlers.indexOf(handler);
      if (index >= 0) clickHandlers.splice(index, 1);
    }),
    subscribeCrosshairMove: vi.fn((handler: (param: unknown) => void) => {
      crosshairHandlers.push(handler);
    }),
    unsubscribeCrosshairMove: vi.fn((handler: (param: unknown) => void) => {
      const index = crosshairHandlers.indexOf(handler);
      if (index >= 0) crosshairHandlers.splice(index, 1);
    }),
  };
  const series = {
    attachPrimitive: vi.fn((primitive: unknown) => {
      attached.push(primitive);
      (primitive as { attached?: (params: unknown) => void }).attached?.({
        chart,
        series,
        requestUpdate: vi.fn(),
      });
    }),
    detachPrimitive: vi.fn((primitive: unknown) => {
      const index = attached.indexOf(primitive);
      if (index >= 0) attached.splice(index, 1);
      (primitive as { detached?: () => void }).detached?.();
    }),
    coordinateToPrice: (y: number) => y,
    priceToCoordinate: (price: number) => price,
    dataByIndex: (index: number) => ({ time: index }),
    data: () => [{ time: 0 }, { time: 60 }],
  };

  const container = document.createElement("div");
  Object.defineProperty(container, "getBoundingClientRect", {
    value: () => ({
      left: 0,
      top: 0,
      width: 240,
      height: 180,
      right: 240,
      bottom: 180,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  });
  document.body.appendChild(container);

  const manager = new DrawingManager();
  manager.attach(chart as never, series as never, container);
  return { attached, chart, clickHandlers, container, crosshairHandlers, manager };
}

function placeRectangle(clickHandlers: Array<(param: unknown) => void>) {
  clickHandlers[0]({ point: { x: 10, y: 20 }, paneIndex: 0 });
  clickHandlers[0]({ point: { x: 60, y: 80 }, paneIndex: 0 });
}

function pointerDown(container: HTMLElement, x: number, y: number) {
  container.dispatchEvent(
    new MouseEvent("pointerdown", {
      bubbles: true,
      button: 0,
      clientX: x,
      clientY: y,
    }),
  );
}

describe("DrawingManager selection", () => {
  it("keeps rectangle edit handles hidden until the drawing is selected", () => {
    const { attached, chart, clickHandlers, container, manager } = makeHarness();
    manager.startDrawing("rectangle");
    placeRectangle(clickHandlers);

    const rectangle = attached[0] as RectanglePrimitive;
    const priceAxisView = rectangle.priceAxisViews()[0] as
      | { visible: () => boolean }
      | undefined;
    expect(priceAxisView).toBeDefined();
    expect(rectangle.selected).toBe(false);
    expect(priceAxisView!.visible()).toBe(false);

    chart.applyOptions.mockClear();
    pointerDown(container, 30, 50);
    expect(rectangle.selected).toBe(true);
    expect(priceAxisView!.visible()).toBe(true);
    expect(chart.applyOptions).not.toHaveBeenCalledWith({
      handleScroll: false,
      handleScale: false,
    });

    pointerDown(container, 180, 150);
    expect(rectangle.selected).toBe(false);
    expect(priceAxisView!.visible()).toBe(false);

    manager.dispose();
    container.remove();
  });
});

describe("DrawingManager trendline constraints", () => {
  it("keeps the trendline horizontal when the second click is made with Shift", () => {
    const { clickHandlers, container, manager } = makeHarness();
    manager.startDrawing("trendline");

    clickHandlers[0]({ point: { x: 10, y: 20 }, paneIndex: 0 });
    clickHandlers[0]({
      point: { x: 70, y: 85 },
      paneIndex: 0,
      sourceEvent: { shiftKey: true },
    });

    const [trendline] = manager.exportState();
    expect(trendline.tool).toBe("trendline");
    expect(trendline.anchors[0].price).toBe(20);
    expect(trendline.anchors[1].price).toBe(20);
    expect(trendline.anchors[1].logical).toBe(70);

    manager.dispose();
    container.remove();
  });

  it("previews a horizontal trendline while Shift is held", () => {
    const { attached, clickHandlers, container, crosshairHandlers, manager } =
      makeHarness();
    manager.startDrawing("trendline");

    clickHandlers[0]({ point: { x: 10, y: 20 }, paneIndex: 0 });
    crosshairHandlers[0]({
      point: { x: 70, y: 85 },
      paneIndex: 0,
      sourceEvent: { shiftKey: true },
    });

    const preview = attached[0] as TrendLinePrimitive;
    expect(preview.id.startsWith("preview-")).toBe(true);
    expect(preview.anchors[0].price).toBe(20);
    expect(preview.anchors[1].price).toBe(20);
    expect(preview.anchors[1].logical).toBe(70);

    manager.dispose();
    container.remove();
  });
});

describe("DrawingManager fixed range delta profile", () => {
  it("places and exports fixed-range delta profile drawings", () => {
    const { clickHandlers, container, manager } = makeHarness();
    manager.startDrawing("fixed_range_delta_profile");

    clickHandlers[0]({ point: { x: 20, y: 40 }, paneIndex: 0 });
    clickHandlers[0]({ point: { x: 80, y: 90 }, paneIndex: 0 });

    const [profile] = manager.exportState();
    expect(profile.tool).toBe("fixed_range_delta_profile");
    expect(profile.anchors).toHaveLength(2);
    expect(profile.anchors[0].logical).toBe(20);
    expect(profile.anchors[1].logical).toBe(80);

    manager.dispose();
    container.remove();
  });
});
