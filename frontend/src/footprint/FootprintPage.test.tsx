import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FootprintPage,
  canvasHeightForFootprint,
  centerFootprintBarInView,
  footprintBarIndexAtCanvasX,
  isPointerOnPriceAxis,
} from "./FootprintPage";
import type { FootprintBar } from "./footprintModel";

vi.mock("../api/client", () => ({
  ApiClient: class {
    footprintDetails() {
      return new Promise(() => {});
    }
  },
}));

vi.mock("../socket/ChartSocket", () => ({
  ChartSocket: class {
    onOpen() {
      return () => {};
    }

    onClose() {
      return () => {};
    }

    on() {
      return () => {};
    }

    connect() {}

    ensureConnected() {}

    close() {}

    subscribe() {}

    unsubscribe() {}
  },
}));

vi.mock("./FootprintCanvas", () => ({
  FootprintCanvas: () => null,
}));

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function footprintBar(time: number, price: number): FootprintBar {
  return {
    type: "footprint_update",
    symbol: "GC",
    contract: "GC",
    tf: "1m",
    time,
    rows: [
      { price, bid: 1, ask: 1, imbalance: null },
      { price: price + 0.1, bid: 1, ask: 1, imbalance: null },
    ],
    open: price,
    high: price + 0.1,
    low: price,
    close: price,
    poc: price,
    pocVolume: 2,
    vah: price + 0.1,
    val: price,
    barDelta: 0,
    buyPct: 0.5,
    sellPct: 0.5,
    stackedImbalance: [],
    unfinishedAuction: { high: false, low: false },
  };
}

describe("FootprintPage", () => {
  it("maps replay clicks to footprint columns and excludes the price axis", () => {
    const base = {
      rectLeft: 0,
      scrollLeft: 0,
      canvasWidth: 1_000,
      barCount: 10,
    };

    expect(footprintBarIndexAtCanvasX({ ...base, clientX: 20 })).toBe(0);
    expect(footprintBarIndexAtCanvasX({ ...base, clientX: 111 })).toBe(1);
    expect(footprintBarIndexAtCanvasX({ ...base, clientX: 921 })).toBe(9);
    expect(footprintBarIndexAtCanvasX({ ...base, clientX: 922 })).toBe(-1);
    expect(
      footprintBarIndexAtCanvasX({
        ...base,
        rectLeft: 100,
        scrollLeft: 500,
        clientX: 150,
      }),
    ).toBe(5);
  });

  it("centers a distant history target and detects the sticky price axis", () => {
    const bars = Array.from({ length: 1_001 }, (_, index) =>
      footprintBar(index * 60_000, 4_000 + index / 10),
    );
    const element = {
      clientWidth: 1_440,
      clientHeight: 849,
      scrollWidth: 32_000,
      scrollHeight: 10_000,
      scrollLeft: 0,
      scrollTop: 0,
      getBoundingClientRect: () => ({ left: 100 }),
    } as unknown as HTMLElement;

    centerFootprintBarInView(element, {
      bars,
      barCount: bars.length,
      targetTime: bars[500].time,
      rowHeightPx: 18,
      canvasWidth: 32_000,
      canvasHeight: 10_000,
    });

    expect(element.scrollLeft).toBeGreaterThan(15_000);
    expect(element.scrollLeft).toBeLessThan(15_600);
    expect(element.scrollTop).toBeGreaterThan(8_000);
    expect(isPointerOnPriceAxis({ clientX: 1_460 }, element)).toBe(true);
    expect(isPointerOnPriceAxis({ clientX: 1_400 }, element)).toBe(false);
  });

  it("defaults to 500 bars while keeping the full intraday limit available", () => {
    render(<FootprintPage />);

    const barsInput = screen.getByRole("spinbutton", { name: "Bars" });
    expect(barsInput).toHaveValue(500);
    expect(barsInput).toHaveAttribute("max", "1440");
    expect(screen.getByRole("spinbutton", { name: "Context" })).toHaveAttribute(
      "max",
      "500",
    );
  });

  it("keeps a wide 500-bar canvas at least as tall as its visible host", () => {
    expect(
      canvasHeightForFootprint({
        bars: [],
        displayBarCount: 500,
        canvasWidth: 28_020,
        hostHeight: 849,
        rowHeightPx: 18,
      }),
    ).toBe(849);
  });

  it("retains vertical pan room for a wide 500-bar price range", () => {
    expect(
      canvasHeightForFootprint({
        bars: [
          {
            type: "footprint_update",
            symbol: "GC",
            contract: "GC",
            tf: "1m",
            time: 0,
            rows: [
              { price: 4167.5, bid: 1, ask: 1, imbalance: null },
              { price: 4167.6, bid: 1, ask: 1, imbalance: null },
              { price: 4220.4, bid: 1, ask: 1, imbalance: null },
            ],
            open: 4167.5,
            high: 4220.4,
            low: 4167.5,
            close: 4220.4,
            poc: 4220.4,
            pocVolume: 2,
            vah: 4220.4,
            val: 4167.5,
            barDelta: 0,
            buyPct: 0.5,
            sellPct: 0.5,
            stackedImbalance: [],
            unfinishedAuction: { high: false, low: false },
          },
        ],
        displayBarCount: 500,
        canvasWidth: 28_020,
        hostHeight: 849,
        rowHeightPx: 18,
      }),
    ).toBeGreaterThan(849);
  });

  it("toggles all XKontrol levels without retaining the React event", () => {
    render(
      <StrictMode>
        <FootprintPage />
      </StrictMode>,
    );

    const settingsButton = screen.getByRole("button", { name: "Settings" });
    expect(settingsButton).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByLabelText("XKontrol Level 1 Initial"),
    ).not.toBeInTheDocument();
    fireEvent.click(settingsButton);
    expect(settingsButton).toHaveAttribute("aria-expanded", "true");

    const levels = [
      screen.getByLabelText("XKontrol Level 1 Initial"),
      screen.getByLabelText("XKontrol Level 2 Strong"),
      screen.getByLabelText("XKontrol Level 3 Total"),
    ];

    for (const level of levels) {
      expect(level).toBeChecked();
      fireEvent.click(level);
      expect(level).not.toBeChecked();
    }

    fireEvent.keyDown(document, { key: "Escape" });
    expect(settingsButton).toHaveAttribute("aria-expanded", "false");
  });
});
