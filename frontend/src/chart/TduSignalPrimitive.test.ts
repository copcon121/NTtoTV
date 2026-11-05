import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { IChartApiBase, ISeriesApi, Time } from "lightweight-charts";
import { describe, expect, it, vi } from "vitest";

import { TduSignalPrimitive, type RenderableTduSignal } from "./TduSignalPrimitive";
import { DEFAULT_TDU_SETTINGS, normalizeTduSettings, tduMomentumForSettings } from "./tduSettings";

function signal(overrides: Partial<RenderableTduSignal> = {}): RenderableTduSignal {
  return {
    time: 1 as Time,
    open: 100,
    high: 110,
    low: 100,
    close: 108,
    momentumDirection: 1,
    momentumLevel: 3,
    deltaDivergence: 0,
    ...overrides,
  };
}

function drawing() {
  const primitive = new TduSignalPrimitive();
  primitive.chart = {
    timeScale: () => ({
      options: () => ({ barSpacing: 10 }),
      getVisibleRange: () => null,
      timeToCoordinate: () => 50,
    }),
  } as unknown as IChartApiBase<Time>;
  primitive.series = {
    priceToCoordinate: (price: number) => 200 - price,
  } as unknown as ISeriesApi<"Candlestick", Time>;

  const context = {
    save: vi.fn(), restore: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    closePath: vi.fn(), fill: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
  };
  const target = {
    useBitmapCoordinateSpace: (draw: (scope: unknown) => void) => draw({
      context, horizontalPixelRatio: 1, verticalPixelRatio: 1,
    }),
  } as unknown as CanvasRenderingTarget2D;

  return {
    primitive,
    context,
    draw: (next: RenderableTduSignal) => {
      primitive.setSignals([next]);
      primitive.updateAllViews();
      primitive.paneViews()[0].renderer()?.draw(target);
    },
  };
}

describe("TDU momentum candle filter", () => {
  it("reclassifies the same measurement when numeric level thresholds change", () => {
    const { primitive, draw, context } = drawing();
    const next = signal({ momentumSamples: [[45, 10, 1]] });
    draw(next);
    expect(context.fill).toHaveBeenCalledTimes(1);
    context.fill.mockClear();
    primitive.setSettings({ level1Sigma: 3, level2Sigma: 4, level3Sigma: 5 });
    draw(next);
    expect(context.fill).toHaveBeenCalledTimes(2);
    context.fill.mockClear();
    primitive.setSettings({ level1Sigma: 5, level2Sigma: 6, level3Sigma: 7 });
    draw(next);
    expect(context.fill).not.toHaveBeenCalled();
  });

  it("creates a signal below the original default threshold", () => {
    const { primitive, draw, context } = drawing();
    primitive.setSettings({ level1Sigma: 2, level2Sigma: 3, level3Sigma: 4 });
    draw(signal({ momentumLevel: 0, momentumDirection: 0, momentumSamples: [[35, 10, -1]] }));
    expect(context.fill).toHaveBeenCalledTimes(2);
  });

  it("keeps the maximum level and last qualifying direction for each threshold", () => {
    const next = signal({ momentumSamples: [[60, 10, 1], [50, 10, -1]] });
    expect(tduMomentumForSettings(next, DEFAULT_TDU_SETTINGS)).toEqual({ level: 3, direction: -1 });
    expect(tduMomentumForSettings(next, normalizeTduSettings({ level1Sigma: 5.5, level2Sigma: 6.5, level3Sigma: 7.5 })))
      .toEqual({ level: 1, direction: 1 });
    expect(tduMomentumForSettings(signal({ momentumSamples: [[10, 0, -1]] }), DEFAULT_TDU_SETTINGS))
      .toEqual({ level: 3, direction: -1 });
  });

  it("does not reclassify legacy levels without underlying measurements", () => {
    const { primitive, draw, context } = drawing();
    primitive.setSettings({ level1Sigma: 3, level2Sigma: 4, level3Sigma: 5 });
    draw(signal());
    expect(context.fill).not.toHaveBeenCalled();
    primitive.setSettings(DEFAULT_TDU_SETTINGS);
    draw(signal());
    expect(context.fill).toHaveBeenCalledTimes(3);
  });

  it("rejects unordered and nonfinite threshold profiles", () => {
    expect(normalizeTduSettings({ level1Sigma: 6, level2Sigma: 5, level3Sigma: 4 })).toEqual(DEFAULT_TDU_SETTINGS);
    expect(normalizeTduSettings({ level3Sigma: NaN })).toEqual(DEFAULT_TDU_SETTINGS);
  });

  it.each([1, 2, 3] as const)("independently hides level %i without changing other levels", (level) => {
    const { primitive, draw, context } = drawing();
    primitive.setSettings({ ...DEFAULT_TDU_SETTINGS, [`showLevel${level}`]: false });
    for (const momentumLevel of [1, 2, 3]) {
      for (const momentumDirection of [-1, 1]) {
        context.fill.mockClear();
        draw(signal({ momentumLevel, momentumDirection }));
        expect(context.fill).toHaveBeenCalledTimes(momentumLevel === level ? 0 : momentumLevel);
      }
    }
  });

  it("applies setting changes immediately and keeps divergence when all levels are hidden", () => {
    const { primitive, draw, context } = drawing();
    const next = signal({ deltaDivergence: 1 });
    primitive.setSettings({ showLevel1: false, showLevel2: false, showLevel3: false });
    draw(next);
    expect(context.fill).not.toHaveBeenCalled();
    expect(context.fillRect).toHaveBeenCalledOnce();
    primitive.setSettings(DEFAULT_TDU_SETTINGS);
    draw(next);
    expect(context.fill).toHaveBeenCalledTimes(3);
  });

  it("uses the configured body threshold and allows disabling the filter", () => {
    const { primitive, draw, context } = drawing();
    const next = signal({ close: 104 });
    draw(next);
    expect(context.fill).toHaveBeenCalledTimes(3);
    context.fill.mockClear();
    primitive.setSettings({ minBodyPercent: 50 });
    draw(next);
    expect(context.fill).not.toHaveBeenCalled();
    primitive.setSettings({ filterSmallBody: false });
    draw(signal({ close: 100 }));
    expect(context.fill).toHaveBeenCalledTimes(3);
  });

  it("defaults old profiles and clamps invalid thresholds", () => {
    expect(normalizeTduSettings()).toEqual(DEFAULT_TDU_SETTINGS);
    expect(normalizeTduSettings({ showLevel2: false })).toEqual({ ...DEFAULT_TDU_SETTINGS, showLevel2: false });
    expect(normalizeTduSettings({ minBodyPercent: NaN }).minBodyPercent).toBe(35);
    expect(normalizeTduSettings({ minBodyPercent: -1 }).minBodyPercent).toBe(0);
    expect(normalizeTduSettings({ minBodyPercent: 120 }).minBodyPercent).toBe(100);
  });

  it.each([
    ["flat bar", 100, 100, 100, 100],
    ["doji", 100, 110, 90, 100],
    ["near doji", 100, 110, 90, 100.1],
    ["two long wicks", 100, 110, 90, 103],
    ["long upper wick", 100, 110, 100, 102],
    ["long lower wick", 108, 110, 100, 110],
    ["35 percent body boundary", 100, 120, 100, 107],
  ])("hides buy and sell triangles on a %s", (_name, open, high, low, close) => {
    for (const momentumDirection of [-1, 1]) {
      const { draw, context } = drawing();
      draw(signal({ open, high, low, close, momentumDirection }));
      expect(context.fill).not.toHaveBeenCalled();
    }
  });

  it.each([1, 2, 3])("keeps all %i triangles on directional candles", (momentumLevel) => {
    for (const [open, close, momentumDirection] of [[100, 108, 1], [108, 100, -1]]) {
      const { draw, context } = drawing();
      draw(signal({ open, close, momentumDirection, momentumLevel }));
      expect(context.fill).toHaveBeenCalledTimes(momentumLevel);
    }
  });

  it("keeps triangles just above the small-body threshold", () => {
    const { draw, context } = drawing();
    draw(signal({ high: 120, close: 107.1 }));
    expect(context.fill).toHaveBeenCalledTimes(3);
  });

  it.each([-1, 1])("preserves delta divergence %i on filtered bars", (deltaDivergence) => {
    const { draw, context } = drawing();
    draw(signal({ close: 100, deltaDivergence }));
    expect(context.fill).not.toHaveBeenCalled();
    expect(context.fillRect).toHaveBeenCalledOnce();
    expect(context.strokeRect).toHaveBeenCalledOnce();
  });

  it("hides and restores triangles as a live candle changes shape", () => {
    const { draw, context, primitive } = drawing();
    for (const [close, count] of [[108, 3], [101, 0], [109, 3]]) {
      context.fill.mockClear();
      draw(signal({ close }));
      expect(context.fill).toHaveBeenCalledTimes(count);
      expect(primitive.signals[0].momentumLevel).toBe(3);
    }
  });
});
