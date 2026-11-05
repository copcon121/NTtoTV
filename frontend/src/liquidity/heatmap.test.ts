import { describe, expect, it } from "vitest";
import {
  DEFAULT_HEATMAP_SETTINGS,
  drawLiquidityLevel,
  heatmapLineVisible,
  liquidityHeatmapAlpha,
  liquidityHeatmapSegments,
  liquidityLiveProjection,
  liquidityLineAppearance,
  liquidityLineColor,
  mergeSizeSamples,
  normalizeHeatmapSettings,
  removeHeatmapSpeckles,
  type HeatmapLine,
} from "./heatmap";

const line: HeatmapLine = {
  startedAt: 0, lastAt: 90_000, endedAt: null, active: true, currentSize: 700,
  samples: [
    { time: 0, size: 500, active: true },
    { time: 30_000, size: 1200, active: true },
    { time: 60_000, size: 700, active: true },
    { time: 90_000, size: 700, active: true },
  ],
};

describe("liquidity heatmap", () => {
  it("changes opacity for resting, ended, stale and legacy lines without changing width or color", () => {
    for (const [size, ended, stale] of [
      [700, false, false], [700, true, false], [700, false, true], [null, false, false],
    ] as const) {
      const original = liquidityLineAppearance(size, 500, DEFAULT_HEATMAP_SETTINGS, ended, stale);
      const fadedSettings = { ...DEFAULT_HEATMAP_SETTINGS, opacity: 0.5 };
      const faded = liquidityLineAppearance(size, 500, fadedSettings, ended, stale);
      const strong = liquidityLineAppearance(size, 500, { ...DEFAULT_HEATMAP_SETTINGS, opacity: 2 }, ended, stale);
      expect(faded).toEqual({ ...original, alpha: original.alpha * 0.5 });
      expect(strong).toEqual({ ...original, alpha: Math.min(1, original.alpha * 2) });
      expect(liquidityLineColor(size, 500, fadedSettings, "add", "bid"))
        .toBe(liquidityLineColor(size, 500, DEFAULT_HEATMAP_SETTINGS, "add", "bid"));
    }
    expect(recordStrokes(line, 100_000, true, { ...DEFAULT_HEATMAP_SETTINGS, opacity: 0 })).toEqual([]);
    expect(normalizeHeatmapSettings({ opacity: -1 }).opacity).toBe(0);
    expect(normalizeHeatmapSettings({ opacity: 9 }).opacity).toBe(2);
    expect(normalizeHeatmapSettings({ opacity: NaN }).opacity).toBe(1);
  });

  it("restores brightness and width after a refill is reduced, with separate add/remove colors", () => {
    const original = liquidityLineAppearance(500, 500, DEFAULT_HEATMAP_SETTINGS);
    const refill = liquidityLineAppearance(1500, 500, DEFAULT_HEATMAP_SETTINGS);
    const reduced = liquidityLineAppearance(500, 500, DEFAULT_HEATMAP_SETTINGS);
    expect(refill.alpha).toBeGreaterThan(original.alpha);
    expect(refill.width).toBeGreaterThan(original.width);
    expect(reduced).toEqual(original);
    expect(liquidityLineColor(1500, 500, DEFAULT_HEATMAP_SETTINGS, "add", "bid"))
      .not.toBe(liquidityLineColor(1500, 500, DEFAULT_HEATMAP_SETTINGS, "remove", "bid"));
    expect(liquidityLineAppearance(100000, 500, DEFAULT_HEATMAP_SETTINGS).width).toBeLessThanOrEqual(5);
  });

  it("draws resting levels solid, including future space, and preserves each historical size", () => {
    const strokes = recordStrokes({ ...line, currentSize: 500, samples: [
      { time: 0, size: 500, active: true },
      { time: 30_000, size: 1500, active: true },
      { time: 60_000, size: 500, active: true },
      { time: 90_000, size: 500, active: true },
    ] });
    expect(strokes).toHaveLength(4);
    expect(strokes.every((stroke) => stroke.dash.length === 0)).toBe(true);
    expect(strokes[1].width).toBeGreaterThan(strokes[0].width);
    expect(strokes[2].width).toBe(strokes[0].width);
    expect(strokes[2].color).not.toBe(strokes[0].color);
    expect(strokes[3].color).toBe(strokes[2].color);
    expect(strokes[3].to).toBe(300_000);
  });

  it("draws completed levels dashed up to their end, and never treats stale data as consumption", () => {
    const completed = recordStrokes({ ...line, active: false, currentSize: 0,
      endedAt: 90_000, samples: [...line.samples!.slice(0, -1),
        { time: 90_000, size: 0, active: false }] });
    expect(completed.length).toBeGreaterThan(0);
    expect(completed.every((stroke) => stroke.dash.join(",") === "5,4")).toBe(true);
    expect(Math.max(...completed.map((stroke) => stroke.to))).toBe(90_000);
    const stale = recordStrokes(line, 200_000);
    expect(stale.every((stroke) => stroke.dash.length === 0)).toBe(true);
    expect(Math.max(...stale.map((stroke) => stroke.to))).toBe(90_000);
    const historical = recordStrokes(line, 100_000, false);
    expect(Math.max(...historical.map((stroke) => stroke.to))).toBe(100_000);
  });
  it("shows current resting size across the right margin without extending recorded history", () => {
    expect(liquidityLiveProjection(line, 0, 300_000, 100_000)).toEqual({
      from: 100_000, to: 300_000, size: 700,
    });
    expect(liquidityHeatmapSegments(line, 100_000, 300_000, 100_000)).toEqual([]);
    expect(liquidityLiveProjection(line, 150_000, 300_000, 100_000)?.from).toBe(150_000);
    expect(liquidityLiveProjection(line, 0, 90_000, 100_000)).toBeNull();
  });

  it("removes the live continuation on withdrawal or stale data", () => {
    expect(liquidityLiveProjection({ ...line, active: false }, 0, 500_000, 100_000)).toBeNull();
    expect(liquidityLiveProjection({ ...line, endedAt: 95_000 }, 0, 500_000, 100_000)).toBeNull();
    expect(liquidityLiveProjection({ ...line, currentSize: 0 }, 0, 500_000, 100_000)).toBeNull();
    expect(liquidityLiveProjection(line, 0, 500_000, 180_001)).toBeNull();
    expect(liquidityLiveProjection(line, 0, 500_000, 80_000)).toBeNull();
  });

  it("removes isolated dots while keeping continuous walls with rapid size changes", () => {
    const segments = [
      { from: 0, to: 1000, size: 500 },
      { from: 1000, to: 2000, size: 1200 },
      { from: 2000, to: 4000, size: 700 },
      { from: 10000, to: 11000, size: 900 },
      { from: 20000, to: 21000, size: 1000 },
    ];
    expect(removeHeatmapSpeckles(segments, 0.001)).toEqual(segments.slice(0, 3));
  });

  it("keeps the original size of each segment when liquidity refills then reduces", () => {
    expect(liquidityHeatmapSegments(line, 0, 180_000, 100_000)).toEqual([
      { from: 0, to: 30_000, size: 500 },
      { from: 30_000, to: 60_000, size: 1200 },
      { from: 60_000, to: 100_000, size: 700 },
    ]);
    const alpha = (size: number) => liquidityHeatmapAlpha(size, 500, DEFAULT_HEATMAP_SETTINGS);
    expect(alpha(1200)).toBeGreaterThan(alpha(700));
    expect(alpha(700)).toBeGreaterThan(alpha(500));
    expect(alpha(2000)).toBeCloseTo(0.94);
    expect(alpha(100000)).toBe(alpha(2000));
    expect(alpha(0)).toBe(0);
  });

  it("stops on withdrawal, without drawing the terminal size backwards or across a reopening", () => {
    const ended = { ...line, lastAt: 80_000, endedAt: 80_000, active: false,
      currentSize: 0, samples: [
        { time: 0, size: 500, active: true },
        { time: 20_000, size: 0, active: false },
        { time: 50_000, size: 900, active: true },
        { time: 80_000, size: 0, active: false },
      ] };
    expect(liquidityHeatmapSegments(ended, 0, 180_000, 100_000)).toEqual([
      { from: 0, to: 20_000, size: 500 },
      { from: 50_000, to: 80_000, size: 900 },
    ]);
  });

  it("clips historical sizes at the viewport edges and never extends into future space", () => {
    expect(liquidityHeatmapSegments(line, 40_000, 70_000, 100_000)).toEqual([
      { from: 40_000, to: 60_000, size: 1200 },
      { from: 60_000, to: 70_000, size: 700 },
    ]);
  });

  it("preserves legacy presence without inventing historical sizes", () => {
    expect(liquidityHeatmapSegments({ ...line, samples: [] }, 0, 180_000, 100_000)).toEqual([
      { from: 0, to: 90_000, size: null },
      { from: 90_000, to: 100_000, size: 700 },
    ]);
  });

  it("keeps an ended legacy band even when its final size is zero", () => {
    const legacy = { ...line, samples: [], active: false, currentSize: 0,
      lastAt: 180_000, endedAt: 180_000 };
    expect(heatmapLineVisible(legacy, DEFAULT_HEATMAP_SETTINGS, 200_000, 0.001)).toBe(true);
    expect(liquidityHeatmapSegments(legacy, 30_000, 200_000, 200_000)).toEqual([
      { from: 30_000, to: 180_000, size: null },
    ]);
    expect(removeHeatmapSpeckles(
      liquidityHeatmapSegments(legacy, 30_000, 200_000, 200_000), 0.001,
    )).toHaveLength(1);
  });

  it("retains the earlier presence when new samples arrive after migration", () => {
    const migrated = { ...line, samples: [
      { time: 60_000, size: 500, active: true },
      { time: 90_000, size: 1200, active: true },
    ] };
    expect(liquidityHeatmapSegments(migrated, 0, 180_000, 100_000)).toEqual([
      { from: 0, to: 60_000, size: null },
      { from: 60_000, to: 90_000, size: 500 },
      { from: 90_000, to: 100_000, size: 1200 },
    ]);
  });

  it("leaves a gap during a stale or disconnected period", () => {
    expect(liquidityHeatmapSegments({ ...line, lastAt: 300_000, samples: [
      { time: 0, size: 500, active: true },
      { time: 300_000, size: 700, active: true },
    ] }, 0, 400_000, 310_000)).toEqual([
      { from: 0, to: 90_000, size: 500 },
      { from: 300_000, to: 310_000, size: 700 },
    ]);
  });

  it("hides brief flashes and subpixel lines, while preserving stable levels", () => {
    const short = { ...line, endedAt: 15_000, active: false };
    expect(heatmapLineVisible(short, DEFAULT_HEATMAP_SETTINGS, 120_000, 0.001)).toBe(false);
    expect(heatmapLineVisible(line, DEFAULT_HEATMAP_SETTINGS, 120_000, 0.001)).toBe(true);
    expect(heatmapLineVisible(line, DEFAULT_HEATMAP_SETTINGS, 120_000, 0.00001)).toBe(false);
    expect(heatmapLineVisible({ ...line, samples: [], lastAt: 119_000 }, DEFAULT_HEATMAP_SETTINGS, 120_000, 0.001)).toBe(true);
    expect(heatmapLineVisible(short, { ...DEFAULT_HEATMAP_SETTINGS, minDurationSeconds: 0 }, 120_000, 0.001)).toBe(true);
    // Stale candidates must not age into visible levels just because time passes.
    expect(heatmapLineVisible({ ...short, endedAt: null, active: true, lastAt: 15_000 }, DEFAULT_HEATMAP_SETTINGS, 200_000, 0.001)).toBe(false);
  });

  it("deduplicates REST/socket overlap and retains the size entering the retention window", () => {
    const day = 86_400_000;
    expect(mergeSizeSamples([
      { time: 0, size: 500, active: true },
      { time: 1000, size: 600, active: true },
      { time: day + 2000, size: 700, active: true },
    ], [
      { time: day + 2000, size: 800, active: true },
    ])).toEqual([
      { time: 1000, size: 600, active: true },
      { time: day + 2000, size: 800, active: true },
    ]);
  });

  it("restores defaults for old profiles and bounds invalid settings", () => {
    expect(normalizeHeatmapSettings(undefined)).toEqual(DEFAULT_HEATMAP_SETTINGS);
    expect(normalizeHeatmapSettings({ minDurationSeconds: -1, contrast: NaN, saturationMultiple: 999 })).toEqual({
      minDurationSeconds: 0, contrast: 1, saturationMultiple: 20, opacity: 1,
    });
  });
});

function recordStrokes(input: HeatmapLine, now = 100_000, showLive = true, settings = DEFAULT_HEATMAP_SETTINGS) {
  const strokes: Array<{ width: number; color: string; dash: number[]; to: number }> = [];
  let dash: number[] = [];
  let to = 0;
  const context = {
    strokeStyle: "", lineWidth: 1, lineCap: "butt",
    save() {}, restore() {}, beginPath() {}, moveTo() {},
    setLineDash(value: number[]) { dash = value; },
    lineTo(x: number) { to = x; },
    stroke() { strokes.push({ width: this.lineWidth, color: this.strokeStyle, dash, to }); },
  };
  drawLiquidityLevel(context as unknown as CanvasRenderingContext2D,
    { ...input, side: "bid", threshold: 500 }, {
      from: 0, to: 300_000, now, showLive, y: 50,
      pixelsPerMs: 0.001, xAt: (time) => time, settings,
    });
  return strokes;
}
