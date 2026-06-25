import { describe, expect, it, vi } from "vitest";

import { DrawingManager } from "./DrawingManager";
import { type RectanglePrimitive } from "./RectanglePrimitive";
import { type TrendLinePrimitive } from "./TrendLinePrimitive";
import type { DrawingToolType } from "./types";

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

function placeAnchors(
  clickHandlers: Array<(param: unknown) => void>,
  anchors: Array<{ x: number; y: number }>,
) {
  for (const anchor of anchors) {
    clickHandlers[0]({ point: anchor, paneIndex: 0 });
  }
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

function pointerMove(container: HTMLElement, x: number, y: number) {
  container.dispatchEvent(
    new MouseEvent("pointermove", {
      bubbles: true,
      clientX: x,
      clientY: y,
    }),
  );
}

function pointerUp(container: HTMLElement, x: number, y: number) {
  container.dispatchEvent(
    new MouseEvent("pointerup", {
      bubbles: true,
      clientX: x,
      clientY: y,
    }),
  );
}

function pressDelete() {
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      bubbles: true,
      key: "Delete",
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
    pointerDown(container, 10, 50);
    expect(rectangle.selected).toBe(true);
    expect(priceAxisView!.visible()).toBe(true);
    expect(chart.applyOptions).toHaveBeenCalledWith({
      handleScroll: false,
      handleScale: false,
    });
    pointerUp(container, 30, 50);

    pointerDown(container, 180, 150);
    expect(rectangle.selected).toBe(false);
    expect(priceAxisView!.visible()).toBe(false);

    manager.dispose();
    container.remove();
  });

  it("resizes a selected rectangle from an edge handle", () => {
    const { clickHandlers, container, manager } = makeHarness();
    manager.startDrawing("rectangle");
    placeRectangle(clickHandlers);

    pointerDown(container, 10, 50);
    pointerUp(container, 30, 50);
    pointerDown(container, 35, 20);
    pointerMove(container, 35, 10);
    pointerUp(container, 35, 10);

    const [rectangle] = manager.exportState();
    expect(rectangle.anchors[0].logical).toBe(10);
    expect(rectangle.anchors[0].price).toBe(10);
    expect(rectangle.anchors[1].logical).toBe(60);
    expect(rectangle.anchors[1].price).toBe(80);

    manager.dispose();
    container.remove();
  });
});

describe("DrawingManager body dragging", () => {
  it.each([
    {
      tool: "trendline",
      anchors: [
        { x: 10, y: 20 },
        { x: 60, y: 80 },
      ],
      grab: { x: 35, y: 50 },
      move: { x: 45, y: 65 },
      expected: [
        { logical: 20, price: 35 },
        { logical: 70, price: 95 },
      ],
    },
    {
      tool: "horizontal_ray",
      anchors: [{ x: 20, y: 40 }],
      grab: { x: 100, y: 40 },
      move: { x: 115, y: 55 },
      expected: [{ logical: 35, price: 55 }],
    },
    {
      tool: "fixed_range_delta_profile",
      anchors: [
        { x: 20, y: 40 },
        { x: 80, y: 90 },
      ],
      grab: { x: 50, y: 160 },
      move: { x: 70, y: 160 },
      expected: [
        { logical: 40, price: 40 },
        { logical: 100, price: 90 },
      ],
    },
    {
      tool: "price_range",
      anchors: [
        { x: 10, y: 20 },
        { x: 60, y: 80 },
      ],
      grab: { x: 35, y: 50 },
      move: { x: 45, y: 65 },
      expected: [
        { logical: 20, price: 35 },
        { logical: 70, price: 95 },
      ],
    },
    {
      tool: "order_bracket",
      anchors: [
        { x: 10, y: 50 },
        { x: 80, y: 40 },
        { x: 80, y: 70 },
      ],
      grab: { x: 40, y: 50 },
      move: { x: 55, y: 65 },
      expected: [
        { logical: 25, price: 65 },
        { logical: 95, price: 55 },
        { logical: 95, price: 85 },
      ],
    },
    {
      tool: "vertical_line",
      anchors: [{ x: 50, y: 30 }],
      grab: { x: 50, y: 160 },
      move: { x: 70, y: 160 },
      expected: [{ logical: 70, price: 30 }],
    },
  ] satisfies Array<{
    tool: DrawingToolType;
    anchors: Array<{ x: number; y: number }>;
    grab: { x: number; y: number };
    move: { x: number; y: number };
    expected: Array<{ logical: number; price: number }>;
  }>)("moves $tool when dragging its body", ({ tool, anchors, grab, move, expected }) => {
    const { clickHandlers, container, manager } = makeHarness();
    manager.startDrawing(tool);
    placeAnchors(clickHandlers, anchors);

    pointerDown(container, grab.x, grab.y);
    pointerMove(container, move.x, move.y);
    pointerUp(container, move.x, move.y);

    const [drawing] = manager.exportState();
    expect(drawing.tool).toBe(tool);
    expect(
      drawing.anchors.map((anchor) => ({
        logical: anchor.logical,
        price: anchor.price,
      })),
    ).toEqual(expected);

    manager.dispose();
    container.remove();
  });

  it("moves rectangles only when dragging the frame", () => {
    const { clickHandlers, container, manager } = makeHarness();
    manager.startDrawing("rectangle");
    placeRectangle(clickHandlers);

    pointerDown(container, 10, 50);
    pointerMove(container, 25, 65);
    pointerUp(container, 25, 65);

    const [drawing] = manager.exportState();
    expect(drawing.tool).toBe("rectangle");
    expect(
      drawing.anchors.map((anchor) => ({
        logical: anchor.logical,
        price: anchor.price,
      })),
    ).toEqual([
      { logical: 25, price: 35 },
      { logical: 75, price: 95 },
    ]);

    manager.dispose();
    container.remove();
  });

  it("lets rectangle interiors pass through for chart dragging", () => {
    const { chart, clickHandlers, container, manager } = makeHarness();
    manager.startDrawing("rectangle");
    placeRectangle(clickHandlers);
    chart.applyOptions.mockClear();

    pointerDown(container, 30, 50);
    pointerMove(container, 45, 65);
    pointerUp(container, 45, 65);

    const [drawing] = manager.exportState();
    expect(drawing.tool).toBe("rectangle");
    expect(
      drawing.anchors.map((anchor) => ({
        logical: anchor.logical,
        price: anchor.price,
      })),
    ).toEqual([
      { logical: 10, price: 20 },
      { logical: 60, price: 80 },
    ]);
    expect(chart.applyOptions).not.toHaveBeenCalledWith({
      handleScroll: false,
      handleScale: false,
    });

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
    manager.startDrawing("fixed_range_delta_profile", {
      fixedRangeProfileMode: "volume",
    });

    clickHandlers[0]({ point: { x: 20, y: 40 }, paneIndex: 0 });
    clickHandlers[0]({ point: { x: 80, y: 90 }, paneIndex: 0 });

    const [profile] = manager.exportState();
    expect(profile.tool).toBe("fixed_range_delta_profile");
    expect(profile.anchors).toHaveLength(2);
    expect(profile.anchors[0].logical).toBe(20);
    expect(profile.anchors[1].logical).toBe(80);
    expect(profile.options?.fixedRangeProfileMode).toBe("volume");

    manager.dispose();
    container.remove();
  });

  it("selects fixed-range delta profiles by full-height range and deletes them", () => {
    const { clickHandlers, container, manager } = makeHarness();
    manager.startDrawing("fixed_range_delta_profile");

    clickHandlers[0]({ point: { x: 20, y: 40 }, paneIndex: 0 });
    clickHandlers[0]({ point: { x: 80, y: 90 }, paneIndex: 0 });

    pointerDown(container, 50, 160);
    pointerUp(container, 50, 160);
    pressDelete();

    expect(manager.exportState()).toEqual([]);

    manager.dispose();
    container.remove();
  });

  it("resizes fixed-range delta profiles from their vertical range handles", () => {
    const { clickHandlers, container, manager } = makeHarness();
    manager.startDrawing("fixed_range_delta_profile");

    clickHandlers[0]({ point: { x: 20, y: 40 }, paneIndex: 0 });
    clickHandlers[0]({ point: { x: 80, y: 90 }, paneIndex: 0 });

    pointerDown(container, 50, 160);
    pointerUp(container, 50, 160);
    pointerDown(container, 80, 160);
    pointerMove(container, 110, 160);
    pointerUp(container, 110, 160);

    const [profile] = manager.exportState();
    expect(profile.anchors[0].logical).toBe(20);
    expect(profile.anchors[0].price).toBe(40);
    expect(profile.anchors[1].logical).toBe(110);
    expect(profile.anchors[1].price).toBe(90);

    manager.dispose();
    container.remove();
  });
});
