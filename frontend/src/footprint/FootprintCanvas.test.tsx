import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type FootprintUpdateMessage } from "../socket/messages";
import { FootprintCanvas, drawFootprint } from "./FootprintCanvas";
import { type FootprintViewport } from "./footprintModel";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function fp(time: number, poc = 100.1): FootprintUpdateMessage {
  return {
    type: "footprint_update",
    symbol: "GC",
    contract: "GC 08-26",
    tf: "1m",
    time,
    rows: [
      { price: 100.1, bid: 2, ask: 7, imbalance: "ask" },
      { price: 100.0, bid: 4, ask: 0, imbalance: null },
    ],
    open: 100.0,
    high: 100.1,
    low: 100.0,
    close: 100.1,
    poc,
    pocVolume: 9,
    vah: 100.1,
    val: 100.0,
    barDelta: 5,
    buyPct: 0.6,
    sellPct: 0.4,
    stackedImbalance: [],
    unfinishedAuction: { high: false, low: true },
  };
}

/** A recording 2D context double sufficient for drawFootprint. */
function makeCtx() {
  return {
    clearRectCalls: 0,
    fillRectCalls: 0,
    fillTextCalls: 0,
    texts: [] as string[],
    fillStyle: "",
    strokeStyle: "",
    font: "",
    textBaseline: "",
    textAlign: "",
    lineWidth: 1,
    strokeRectCalls: 0,
    strokeCalls: 0,
    lineDash: [] as number[],
    saveCalls: 0,
    restoreCalls: 0,
    fillCalls: 0,
    clearRect() {
      this.clearRectCalls += 1;
    },
    fillRect() {
      this.fillRectCalls += 1;
    },
    fill() {
      this.fillCalls += 1;
    },
    fillText(text: string) {
      this.fillTextCalls += 1;
      this.texts.push(text);
    },
    strokeRect() {
      this.strokeRectCalls += 1;
    },
    beginPath() {},
    rect() {},
    clip() {},
    save() {
      this.saveCalls += 1;
    },
    restore() {
      this.restoreCalls += 1;
    },
    moveTo() {},
    lineTo() {},
    ellipse() {},
    stroke() {
      this.strokeCalls += 1;
    },
    setLineDash(dash: number[]) {
      this.lineDash = dash;
    },
  };
}

const viewport: FootprintViewport = {
  priceToY: (p) => (200 - p) * 2,
  width: 300,
  height: 200,
};

describe("drawFootprint (Req 14.2, 19.4)", () => {
  it("clears then draws a cell + label per row per bar", () => {
    const ctx = makeCtx();
    const bars = [fp(0), fp(60000)];
    drawFootprint(
      ctx as unknown as CanvasRenderingContext2D,
      { bars, viewport },
      {
        showVA: true,
        vaPercent: 70,
        imbalanceMinVolume: 10,
        showImbalance: true,
        showUnfinishedAuction: true,
      },
    );
    expect(ctx.clearRectCalls).toBe(1);
    expect(ctx.fillRectCalls).toBeGreaterThan(0);
    expect(ctx.fillTextCalls).toBeGreaterThan(0);
    expect(ctx.strokeRectCalls).toBeGreaterThan(0);
  });

  it("keeps VA hidden by default, matching the NT indicator default", () => {
    const ctx = makeCtx();
    drawFootprint(ctx as unknown as CanvasRenderingContext2D, {
      bars: [fp(0)],
      viewport,
    });
    expect(ctx.fillRectCalls).toBe(0);
    expect(ctx.fillTextCalls).toBeGreaterThan(0);
  });

  it("formats large cell volume with the NT auto K/M scale", () => {
    const ctx = makeCtx();
    const bar = fp(0);
    bar.rows = [
      { price: 100.1, bid: 1500, ask: 0, imbalance: null },
      { price: 100.0, bid: 0, ask: 2, imbalance: null },
    ];
    drawFootprint(ctx as unknown as CanvasRenderingContext2D, {
      bars: [bar],
      viewport,
    });
    expect(ctx.texts).toContain("1.5K");
  });

  it("recomputes imbalance from the current min-volume setting", () => {
    const bar = fp(0);
    bar.rows = [
      { price: 100.1, bid: 0, ask: 9, imbalance: null },
      { price: 100.0, bid: 4, ask: 0, imbalance: null },
    ];

    const strict = makeCtx();
    drawFootprint(
      strict as unknown as CanvasRenderingContext2D,
      { bars: [bar], viewport },
      {
        showVA: false,
        vaPercent: 70,
        imbalanceMinVolume: 10,
        showImbalance: true,
        showUnfinishedAuction: true,
      },
    );
    expect(strict.fillCalls).toBe(0);

    const loose = makeCtx();
    drawFootprint(
      loose as unknown as CanvasRenderingContext2D,
      { bars: [bar], viewport },
      {
        showVA: false,
        vaPercent: 70,
        imbalanceMinVolume: 1,
        showImbalance: true,
        showUnfinishedAuction: true,
      },
    );
    expect(loose.fillCalls).toBeGreaterThan(0);
  });

  it("draws nothing but a clear when there are no bars", () => {
    const ctx = makeCtx();
    drawFootprint(ctx as unknown as CanvasRenderingContext2D, { bars: [], viewport });
    expect(ctx.clearRectCalls).toBe(1);
    expect(ctx.fillRectCalls).toBe(0);
  });
});

describe("FootprintCanvas component (Req 14.6, 14.7, 14.8)", () => {
  let ctx: ReturnType<typeof makeCtx>;

  beforeEach(() => {
    ctx = makeCtx();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
  });

  it("draws on first mount", () => {
    const bars = new Map([[0, fp(0)]]);
    render(<FootprintCanvas bars={bars} viewport={viewport} now={() => 0} />);
    expect(ctx.clearRectCalls).toBe(1);
  });

  it("renders standalone mode with a custom display count", () => {
    const bars = new Map(Array.from({ length: 50 }, (_, i) => [i * 60000, fp(i)]));
    const { container } = render(
      <FootprintCanvas
        bars={bars}
        viewport={{ ...viewport, width: 2200, height: 500 }}
        now={() => 0}
        displayCount={50}
        layout="standalone"
      />,
    );
    expect(ctx.clearRectCalls).toBe(1);
    expect(container.querySelector("canvas")).toHaveClass(
      "footprint-canvas-standalone",
    );
  });

  it("retains the rendering when bars/viewport are unchanged (Req 14.6, 14.7)", () => {
    const bars = new Map([[0, fp(0)]]);
    const { rerender } = render(
      <FootprintCanvas bars={bars} viewport={viewport} now={() => 0} />,
    );
    const afterFirst = ctx.clearRectCalls;
    // Re-render with the SAME map + viewport: no redraw.
    rerender(<FootprintCanvas bars={bars} viewport={viewport} now={() => 0} />);
    expect(ctx.clearRectCalls).toBe(afterFirst);
  });

  it("throttles a rapid data change to a trailing draw (Req 14.8)", () => {
    vi.useFakeTimers();
    let clock = 0;
    const now = () => clock;
    const bars1 = new Map([[0, fp(0, 100.1)]]);
    const { rerender } = render(
      <FootprintCanvas bars={bars1} viewport={viewport} throttleMs={100} now={now} />,
    );
    expect(ctx.clearRectCalls).toBe(1); // initial draw at t=0

    // A data change 50ms later is within the throttle window -> deferred.
    clock = 50;
    const bars2 = new Map([[0, fp(0, 100.2)]]);
    rerender(
      <FootprintCanvas bars={bars2} viewport={viewport} throttleMs={100} now={now} />,
    );
    expect(ctx.clearRectCalls).toBe(1); // not yet redrawn

    // Advance to the trailing edge: the deferred draw fires.
    clock = 100;
    vi.advanceTimersByTime(60);
    expect(ctx.clearRectCalls).toBe(2);
    vi.useRealTimers();
  });
});
