import { describe, expect, it } from "vitest";
import { drawLiquidityCrosshair, liquidityCrosshairAt, type LiquidityCrosshairViewport } from "./crosshair";

const view: LiquidityCrosshairViewport = {
  left: 10, width: 400, top: 20, priceHeight: 200, deltaTop: 230, deltaHeight: 100,
  from: 0, to: 240_000, tfMs: 60_000, priceMin: 4000, priceMax: 4100, deltaExtent: 100,
};
const delta = [{ time: 60_000, delta: -25 }, { time: 120_000, delta: 0 }];

describe("shared LQ crosshair", () => {
  it("selects the same candle and actual delta from either panel", () => {
    const price = liquidityCrosshairAt({ x: 164, y: 70 }, view, delta)!;
    const volume = liquidityCrosshairAt({ x: 164, y: 255 }, view, delta)!;
    expect(price).toMatchObject({ x: 160, time: 60_000, pane: "price", value: 4075, delta: -25 });
    expect(volume).toMatchObject({ x: price.x, time: price.time, pane: "delta", value: 50, delta: -25 });
  });

  it.each([70, 255])("draws the guide through both panels when hovering at y=%s", (y) => {
    const paths: Array<[string, number, number]> = [];
    const labels: string[] = [];
    const context = {
      save() {}, restore() {}, setLineDash() {}, beginPath() {}, stroke() {},
      fillRect() {}, arc() {}, fill() {},
      moveTo(x: number, pointY: number) { paths.push(["move", x, pointY]); },
      lineTo(x: number, pointY: number) { paths.push(["line", x, pointY]); },
      measureText(text: string) { return { width: text.length * 6 }; },
      fillText(text: string) { labels.push(text); },
    };
    drawLiquidityCrosshair(context as unknown as CanvasRenderingContext2D,
      { x: 164, y }, view, delta, (time) => `time:${time}`, String);
    expect(paths.slice(0, 4)).toEqual([
      ["move", 160, 20], ["line", 160, 220],
      ["move", 160, 230], ["line", 160, 330],
    ]);
    expect(labels).toContain("time:60000");
    expect(labels).toContain("Delta: -25");
  });

  it("keeps zero delta distinct from missing data and never borrows an adjacent bar", () => {
    expect(liquidityCrosshairAt({ x: 250, y: 70 }, view, delta)?.delta).toBe(0);
    expect(liquidityCrosshairAt({ x: 350, y: 70 }, view, delta)?.delta).toBeNull();
    expect(liquidityCrosshairAt({ x: 410, y: 70 }, view, delta)?.time).toBe(180_000);
  });

  it("hides outside the plot and keeps only the time guide in the pane gap", () => {
    expect(liquidityCrosshairAt(null, view, delta)).toBeNull();
    expect(liquidityCrosshairAt({ x: 411, y: 70 }, view, delta)).toBeNull();
    expect(liquidityCrosshairAt({ x: 164, y: 331 }, view, delta)).toBeNull();
    expect(liquidityCrosshairAt({ x: 164, y: 225 }, view, delta))
      .toMatchObject({ time: 60_000, pane: "gap", value: null });
  });
});
