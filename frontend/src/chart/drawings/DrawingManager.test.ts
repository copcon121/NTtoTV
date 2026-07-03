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

function pointerEvent(type: string, x: number, y: number) {
  const event = new MouseEvent(type, {
      bubbles: true,
      button: 0,
      clientX: x,
      clientY: y,
  });
  Object.defineProperty(event, "pointerId", { value: 1 });
  return event;
}

function pointerDown(container: HTMLElement, x: number, y: number) {
  container.dispatchEvent(
    pointerEvent("pointerdown", x, y),
  );
}

function pointerMove(container: HTMLElement, x: number, y: number) {
  container.dispatchEvent(
    pointerEvent("pointermove", x, y),
  );
}

function pointerUp(container: HTMLElement, x: number, y: number) {
  container.dispatchEvent(
    pointerEvent("pointerup", x, y),
  );
}

function doubleClick(container: HTMLElement, x: number, y: number) {
  container.dispatchEvent(
    new MouseEvent("dblclick", {
      bubbles: true,
      button: 0,
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

function pressShift() {
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      bubbles: true,
      key: "Shift",
    }),
  );
}

function releaseShift() {
  document.dispatchEvent(
    new KeyboardEvent("keyup", {
      bubbles: true,
      key: "Shift",
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

  it("shows selected drawing actions, locks movement, and unlocks again", () => {
    const { clickHandlers, container, manager } = makeHarness();
    manager.startDrawing("trendline");
    placeAnchors(clickHandlers, [
      { x: 10, y: 20 },
      { x: 60, y: 80 },
    ]);

    pointerDown(container, 35, 50);
    pointerUp(container, 35, 50);

    const lockButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Lock drawing"]',
    );
    expect(lockButton).not.toBeNull();
    lockButton!.click();

    expect(manager.exportState()[0].locked).toBe(true);
    pointerDown(container, 35, 50);
    pointerMove(container, 55, 70);
    pointerUp(container, 55, 70);
    expect(
      manager.exportState()[0].anchors.map((anchor) => ({
        logical: anchor.logical,
        price: anchor.price,
      })),
    ).toEqual([
      { logical: 10, price: 20 },
      { logical: 60, price: 80 },
    ]);

    const unlockButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Unlock drawing"]',
    );
    expect(unlockButton).not.toBeNull();
    unlockButton!.click();
    pointerDown(container, 35, 50);
    pointerMove(container, 45, 65);
    pointerUp(container, 45, 65);

    expect(manager.exportState()[0].locked).toBeUndefined();
    expect(
      manager.exportState()[0].anchors.map((anchor) => ({
        logical: anchor.logical,
        price: anchor.price,
      })),
    ).toEqual([
      { logical: 20, price: 35 },
      { logical: 70, price: 95 },
    ]);

    manager.dispose();
    container.remove();
  });

  it("deletes the selected drawing from the floating action button", () => {
    const { clickHandlers, container, manager } = makeHarness();
    manager.startDrawing("horizontal_ray");
    placeAnchors(clickHandlers, [{ x: 20, y: 40 }]);

    pointerDown(container, 100, 40);
    pointerUp(container, 100, 40);

    const deleteButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Delete drawing"]',
    );
    expect(deleteButton).not.toBeNull();
    deleteButton!.click();

    expect(manager.exportState()).toEqual([]);

    manager.dispose();
    container.remove();
  });

  it("changes trendline width and dash style from selected drawing actions", () => {
    const { clickHandlers, container, manager } = makeHarness();
    manager.startDrawing("trendline");
    placeAnchors(clickHandlers, [
      { x: 10, y: 20 },
      { x: 60, y: 80 },
    ]);

    pointerDown(container, 35, 50);
    pointerUp(container, 35, 50);

    const boldButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Use bold line"]',
    );
    expect(boldButton).not.toBeNull();
    boldButton!.click();
    expect(manager.exportState()[0].options?.lineWidth).toBe(3);
    expect(
      container.querySelector<HTMLButtonElement>('button[aria-label="Use thin line"]'),
    ).not.toBeNull();

    const dashedButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Use dashed line"]',
    );
    expect(dashedButton).not.toBeNull();
    dashedButton!.click();
    expect(manager.exportState()[0].options?.lineStyle).toBe("dashed");
    expect(
      container.querySelector<HTMLButtonElement>('button[aria-label="Use solid line"]'),
    ).not.toBeNull();

    manager.dispose();
    container.remove();
  });

  it("adds and clears a note on a selected line drawing", () => {
    const prompt = vi.spyOn(window, "prompt");
    prompt.mockReturnValueOnce(" breakout retest ");
    const { clickHandlers, container, manager } = makeHarness();
    manager.startDrawing("trendline");
    placeAnchors(clickHandlers, [
      { x: 10, y: 20 },
      { x: 60, y: 80 },
    ]);

    pointerDown(container, 35, 50);
    pointerUp(container, 35, 50);

    const addNoteButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Add line note"]',
    );
    expect(addNoteButton).not.toBeNull();
    addNoteButton!.click();

    expect(prompt).toHaveBeenCalledWith("Line note", "");
    expect(manager.exportState()[0].options?.noteText).toBe("breakout retest");
    const editNoteButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Edit line note"]',
    );
    expect(editNoteButton).not.toBeNull();

    prompt.mockReturnValueOnce(" ");
    editNoteButton!.click();

    expect(prompt).toHaveBeenLastCalledWith("Line note", "breakout retest");
    expect(manager.exportState()[0].options?.noteText).toBeUndefined();

    prompt.mockRestore();
    manager.dispose();
    container.remove();
  });

  it("changes horizontal ray style from selected drawing actions", () => {
    const prompt = vi.spyOn(window, "prompt");
    prompt.mockReturnValueOnce("HTF level");
    const { clickHandlers, container, manager } = makeHarness();
    manager.startDrawing("horizontal_ray");
    placeAnchors(clickHandlers, [{ x: 20, y: 40 }]);

    pointerDown(container, 100, 40);
    pointerUp(container, 100, 40);

    container.querySelector<HTMLButtonElement>(
      'button[aria-label="Use bold line"]',
    )!.click();
    container.querySelector<HTMLButtonElement>(
      'button[aria-label="Use dashed line"]',
    )!.click();
    container.querySelector<HTMLButtonElement>(
      'button[aria-label="Add line note"]',
    )!.click();

    const [ray] = manager.exportState();
    expect(ray.tool).toBe("horizontal_ray");
    expect(ray.options?.lineWidth).toBe(3);
    expect(ray.options?.lineStyle).toBe("dashed");
    expect(ray.options?.noteText).toBe("HTF level");

    prompt.mockRestore();
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

describe("DrawingManager brush tool", () => {
  it("places brush drawings from a pointer drag", () => {
    const { attached, container, manager } = makeHarness();
    manager.startDrawing("brush");

    pointerDown(container, 10, 20);
    pointerMove(container, 20, 30);
    pointerMove(container, 34, 38);
    pointerUp(container, 34, 38);

    const [brush] = manager.exportState();
    expect(attached).toHaveLength(1);
    expect(brush.tool).toBe("brush");
    expect(
      brush.anchors.map((anchor) => ({
        logical: anchor.logical,
        price: anchor.price,
      })),
    ).toEqual([
      { logical: 10, price: 20 },
      { logical: 20, price: 30 },
      { logical: 34, price: 38 },
    ]);

    manager.dispose();
    container.remove();
  });

  it("moves a brush drawing when dragging its stroke", () => {
    const { container, manager } = makeHarness();
    manager.startDrawing("brush");

    pointerDown(container, 10, 20);
    pointerMove(container, 20, 30);
    pointerMove(container, 30, 40);
    pointerUp(container, 30, 40);

    pointerDown(container, 20, 30);
    pointerMove(container, 30, 45);
    pointerUp(container, 30, 45);

    const [brush] = manager.exportState();
    expect(
      brush.anchors.map((anchor) => ({
        logical: anchor.logical,
        price: anchor.price,
      })),
    ).toEqual([
      { logical: 20, price: 35 },
      { logical: 30, price: 45 },
      { logical: 40, price: 55 },
    ]);

    manager.dispose();
    container.remove();
  });

  it("keeps brush placement active after a click without a stroke", () => {
    const { container, manager } = makeHarness();
    manager.startDrawing("brush");

    pointerDown(container, 10, 20);
    pointerUp(container, 10, 20);
    expect(manager.exportState()).toEqual([]);

    pointerDown(container, 20, 30);
    pointerMove(container, 35, 42);
    pointerUp(container, 35, 42);

    const [brush] = manager.exportState();
    expect(brush.tool).toBe("brush");
    expect(brush.anchors).toHaveLength(2);

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

  it("updates an existing trendline preview when Shift is pressed or released", () => {
    const { attached, clickHandlers, container, crosshairHandlers, manager } =
      makeHarness();
    manager.startDrawing("trendline");

    clickHandlers[0]({ point: { x: 10, y: 20 }, paneIndex: 0 });
    crosshairHandlers[0]({
      point: { x: 70, y: 85 },
      paneIndex: 0,
    });

    const preview = attached[0] as TrendLinePrimitive;
    expect(preview.anchors[1].price).toBe(85);

    pressShift();
    expect(preview.anchors[0].price).toBe(20);
    expect(preview.anchors[1].price).toBe(20);
    expect(preview.anchors[1].logical).toBe(70);

    releaseShift();
    expect(preview.anchors[1].price).toBe(85);

    manager.dispose();
    container.remove();
  });

  it("uses held Shift for the final trendline click even without event modifier data", () => {
    const { clickHandlers, container, manager } = makeHarness();
    manager.startDrawing("trendline");

    clickHandlers[0]({ point: { x: 10, y: 20 }, paneIndex: 0 });
    pressShift();
    clickHandlers[0]({ point: { x: 70, y: 85 }, paneIndex: 0 });
    releaseShift();

    const [trendline] = manager.exportState();
    expect(trendline.tool).toBe("trendline");
    expect(trendline.anchors[0].price).toBe(20);
    expect(trendline.anchors[1].price).toBe(20);

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

  it("selects fixed-range delta profiles by their frame and deletes them", () => {
    const { clickHandlers, container, manager } = makeHarness();
    manager.startDrawing("fixed_range_delta_profile");

    clickHandlers[0]({ point: { x: 20, y: 40 }, paneIndex: 0 });
    clickHandlers[0]({ point: { x: 80, y: 90 }, paneIndex: 0 });

    pointerDown(container, 20, 65);
    pointerUp(container, 20, 65);
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

    pointerDown(container, 20, 65);
    pointerUp(container, 20, 65);
    pointerDown(container, 80, 65);
    pointerMove(container, 110, 65);
    pointerUp(container, 110, 65);

    const [profile] = manager.exportState();
    expect(profile.anchors[0].logical).toBe(20);
    expect(profile.anchors[0].price).toBe(40);
    expect(profile.anchors[1].logical).toBe(110);
    expect(profile.anchors[1].price).toBe(90);

    manager.dispose();
    container.remove();
  });

  it("auto-fits fixed-range delta profile vertical bounds to loaded ladder rows", () => {
    const { clickHandlers, container, manager } = makeHarness();
    manager.startDrawing("fixed_range_delta_profile");

    clickHandlers[0]({ point: { x: 20, y: 10 }, paneIndex: 0 });
    clickHandlers[0]({ point: { x: 80, y: 150 }, paneIndex: 0 });

    const [created] = manager.exportState();
    manager.setFixedRangeDeltaProfile(created.id, {
      status: "ready",
      profile: {
        symbol: "GC",
        contract: "GC",
        tf: "1m",
        from: 1,
        to: 2,
        rowTicks: 100,
        valueAreaPct: 0.7,
        poc: 55,
        vah: 55,
        val: 45,
        totalVolume: 30,
        totalDelta: 0,
        maxAbsDelta: 0,
        coveredBars: 2,
        source: "minute_bars",
        rows: [
          { price: 45, bidVolume: 5, askVolume: 5, totalVolume: 10, delta: 0 },
          { price: 55, bidVolume: 10, askVolume: 10, totalVolume: 20, delta: 0 },
        ],
      },
    });

    const [profile] = manager.exportState();
    expect(profile.anchors[0].price).toBe(40);
    expect(profile.anchors[1].price).toBe(60);

    manager.dispose();
    container.remove();
  });

  it("does not select or move fixed-range delta profiles from the interior", () => {
    const { clickHandlers, container, manager } = makeHarness();
    manager.startDrawing("fixed_range_delta_profile");

    clickHandlers[0]({ point: { x: 20, y: 40 }, paneIndex: 0 });
    clickHandlers[0]({ point: { x: 80, y: 90 }, paneIndex: 0 });

    pointerDown(container, 50, 65);
    pointerMove(container, 70, 75);
    pointerUp(container, 70, 75);
    pressDelete();

    const [profile] = manager.exportState();
    expect(profile.tool).toBe("fixed_range_delta_profile");
    expect(profile.anchors[0].logical).toBe(20);
    expect(profile.anchors[0].price).toBe(40);
    expect(profile.anchors[1].logical).toBe(80);
    expect(profile.anchors[1].price).toBe(90);

    manager.dispose();
    container.remove();
  });

  it("switches fixed-range delta profile mode from the double-click settings", () => {
    const { clickHandlers, container, manager } = makeHarness();
    manager.startDrawing("fixed_range_delta_profile", {
      fixedRangeProfileMode: "volume",
    });

    clickHandlers[0]({ point: { x: 20, y: 40 }, paneIndex: 0 });
    clickHandlers[0]({ point: { x: 80, y: 90 }, paneIndex: 0 });

    doubleClick(container, 50, 65);
    const item = container.querySelector<HTMLButtonElement>(
      '.drawing-profile-context-item[data-mode="delta"]',
    );
    expect(item).not.toBeNull();
    item?.click();

    const [profile] = manager.exportState();
    expect(profile.options?.fixedRangeProfileMode).toBe("delta");

    manager.dispose();
    container.remove();
  });

  it("toggles fixed-range delta profile extend right from the double-click settings", () => {
    const { clickHandlers, container, manager } = makeHarness();
    manager.startDrawing("fixed_range_delta_profile", {
      fixedRangeProfileMode: "volume",
    });

    clickHandlers[0]({ point: { x: 20, y: 40 }, paneIndex: 0 });
    clickHandlers[0]({ point: { x: 80, y: 90 }, paneIndex: 0 });

    doubleClick(container, 50, 65);
    const item = container.querySelector<HTMLButtonElement>(
      '.drawing-profile-context-item[data-extend-right="toggle"]',
    );
    expect(item).not.toBeNull();
    expect(item).toHaveAttribute("aria-checked", "false");
    item?.click();

    const [profile] = manager.exportState();
    expect(profile.options?.fixedRangeProfileExtendRight).toBe(true);

    manager.dispose();
    container.remove();
  });

  it("toggles fixed-range delta profile developing POC from the double-click settings", () => {
    const { clickHandlers, container, manager } = makeHarness();
    manager.startDrawing("fixed_range_delta_profile", {
      fixedRangeProfileMode: "volume",
    });

    clickHandlers[0]({ point: { x: 20, y: 40 }, paneIndex: 0 });
    clickHandlers[0]({ point: { x: 80, y: 90 }, paneIndex: 0 });

    doubleClick(container, 50, 65);
    const item = container.querySelector<HTMLButtonElement>(
      '.drawing-profile-context-item[data-developing-poc="toggle"]',
    );
    expect(item).not.toBeNull();
    expect(item).toHaveAttribute("aria-checked", "false");
    item?.click();

    const [profile] = manager.exportState();
    expect(profile.options?.fixedRangeProfileDevelopingPoc).toBe(true);

    manager.dispose();
    container.remove();
  });

  it("updates fixed-range delta profile opacity from the settings sliders", () => {
    const { clickHandlers, container, manager } = makeHarness();
    manager.startDrawing("fixed_range_delta_profile", {
      fixedRangeProfileMode: "volume",
    });

    clickHandlers[0]({ point: { x: 20, y: 40 }, paneIndex: 0 });
    clickHandlers[0]({ point: { x: 80, y: 90 }, paneIndex: 0 });

    doubleClick(container, 50, 65);
    const va = container.querySelector<HTMLInputElement>(
      'input[data-opacity="valueAreaOpacity"]',
    );
    const outside = container.querySelector<HTMLInputElement>(
      'input[data-opacity="outsideValueAreaOpacity"]',
    );
    expect(va).not.toBeNull();
    expect(outside).not.toBeNull();

    va!.value = "70";
    va!.dispatchEvent(new Event("input", { bubbles: true }));
    outside!.value = "25";
    outside!.dispatchEvent(new Event("input", { bubbles: true }));

    const [profile] = manager.exportState();
    expect(profile.options?.fixedRangeProfileValueAreaOpacity).toBe(0.7);
    expect(profile.options?.fixedRangeProfileOutsideValueAreaOpacity).toBe(0.25);

    manager.dispose();
    container.remove();
  });
});
