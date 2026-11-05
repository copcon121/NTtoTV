import { afterEach, describe, expect, it, vi } from "vitest";

import type { Bar } from "../cache/types";
import { LightweightChartsAdapter, type VolumeDeltaDatum } from "./lightweightChartsAdapter";
import { DEFAULT_OUTSIDE_BAR_SETTINGS } from "./outsideBar";
import { DEFAULT_MGANN_SWING_SETTINGS, type MgannSwingOverlay } from "./mgannSwing";
import { XKontrolEngine } from "./xKontrol";

afterEach(() => vi.restoreAllMocks());

const candle = (time: number, close = 4201): Bar => ({
  time, open: 4200, high: 4210, low: 4190, close, volume: close,
});
const delta = (time: number, value: number): VolumeDeltaDatum => ({
  time, volume: 100, buyVolume: 60, sellVolume: 40,
  delta: value, deltaHigh: 40, deltaLow: -40, openDelta: 0, closeDelta: value,
});

function liveChart() {
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(id => { frames.delete(id); });
  const frame = () => {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(0);
  };
  const bars = [candle(60_000), candle(120_000)];
  const engine = new XKontrolEngine();
  engine.setBars(bars);
  const state = {
    candleBars: bars, xKontrolEngine: engine,
    closedBarTimes: new Set([60_000]), barsByTime: new Map(), volumeDeltaByTime: new Map(),
    deferredBarTimes: new Set(), deferredVolumeDeltaTimes: new Set(),
    mgannOverlayRevision: 0, mgannImpulseColors: new Map<number, string>(),
    tduSignalsByTime: new Map(), fvgSignalsByTime: new Map(),
    volumeVisible: true, volumeDeltaVisible: true, gcPushMomentumVisible: true,
    candleLastRenderedTime: 120_000, volumeLastRenderedTime: 120_000,
    replayMomentumIndex: -1, displayTimeOffsetMs: 0, barCountdownDurationMs: 60_000,
    latestBar: bars[1], outsideBar: DEFAULT_OUTSIDE_BAR_SETTINGS,
    candleSeries: { update: vi.fn(), setData: vi.fn() },
    volumeSeries: { update: vi.fn() }, deltaSeries: { update: vi.fn() },
    deltaColors: { positiveBody: "green", positiveBorder: "green", negativeBody: "red", negativeBorder: "red" },
    renderTduSignals: vi.fn(), renderXKontrolSignals: vi.fn(),
    renderSessionMarkers: vi.fn(), updateBarCountdown: vi.fn(),
    scheduleMgannRender: vi.fn(), updateGcPushMomentumAt: vi.fn(),
  };
  const adapter: LightweightChartsAdapter = Object.assign(
    Object.create(LightweightChartsAdapter.prototype), state,
  );
  return { adapter, state, frame, frames };
}

describe("live chart burst rendering", () => {
  it("paints the latest bar and delta once while retaining closed/new buckets", () => {
    const { adapter, state, frame } = liveChart();
    for (let tick = 0; tick < 20; tick++) {
      adapter.updateBar(candle(120_000, 4201 + tick / 10), false);
      adapter.updateVolumeDelta(delta(120_000, tick));
    }
    adapter.updateBar(candle(120_000, 4203), true);
    adapter.updateBar(candle(180_000, 4204), false);
    adapter.updateVolumeDelta(delta(180_000, 30));
    expect(state.candleSeries.update).not.toHaveBeenCalled();
    expect(state.closedBarTimes.has(120_000)).toBe(true);
    frame();
    expect(state.candleSeries.update).toHaveBeenCalledTimes(2);
    expect(state.candleSeries.update.mock.calls.map(call => call[0].close)).toEqual([4203, 4204]);
    expect(state.deltaSeries.update).toHaveBeenCalledTimes(2);
    expect(state.deltaSeries.update.mock.calls.map(call => call[0].close)).toEqual([19, 30]);
    expect(state.candleSeries.setData).not.toHaveBeenCalled();
    expect(state.renderTduSignals).toHaveBeenCalledTimes(1);
    expect(state.renderXKontrolSignals).toHaveBeenCalledTimes(1);
    // The preceding bucket is finalized before advancing the warmup window.
    expect(state.updateGcPushMomentumAt).toHaveBeenCalledTimes(1);
    expect(state.updateGcPushMomentumAt).toHaveBeenNthCalledWith(1, 1);
    frame();
    expect(state.updateGcPushMomentumAt).toHaveBeenCalledTimes(2);
    expect(state.updateGcPushMomentumAt).toHaveBeenNthCalledWith(2, 2);
  });

  it("skips identical forming snapshots and appends several new buckets in order", () => {
    const { adapter, state, frame, frames } = liveChart();
    adapter.updateBar(candle(120_000), false);
    expect(frames.size).toBe(0);
    adapter.updateBar(candle(180_000), true);
    adapter.updateBar(candle(240_000), false);
    frame();
    const calls = state.candleSeries.update.mock.calls;
    expect(calls.map(call => call[0].time)).toEqual([180, 240]);
    // Historical=true would reject a not-yet-rendered bucket in Lightweight Charts.
    expect(calls.every(call => call[1] === false)).toBe(true);
  });

  it("keeps a historical correction when a newer live bar arrives in the same burst", () => {
    const { adapter, state, frame } = liveChart();
    adapter.updateBar(candle(60_000, 4205), true);
    adapter.updateBar(candle(120_000, 4206), false);
    frame();
    frame();
    expect(state.candleSeries.update.mock.calls.map(call => call[0].close)).toEqual([4205, 4206]);
    expect(state.updateGcPushMomentumAt).toHaveBeenCalledTimes(1);
    expect(state.updateGcPushMomentumAt).toHaveBeenCalledWith(0);
  });

  it("holds a pending paint during a pan and catches up on release", () => {
    const { adapter, state, frame } = liveChart();
    adapter.updateBar(candle(120_000, 4202), false);
    const internal = adapter as unknown as {
      realtimeInteractionActive: boolean;
      flushDeferredRealtimeUpdates(): void;
    };
    internal.realtimeInteractionActive = true;
    frame();
    adapter.updateBar(candle(120_000, 4207), false);
    expect(state.candleSeries.update).not.toHaveBeenCalled();
    internal.realtimeInteractionActive = false;
    internal.flushDeferredRealtimeUpdates();
    expect(state.candleSeries.update).toHaveBeenCalledTimes(1);
    expect(state.candleSeries.update.mock.calls[0][0].close).toBe(4207);
  });

  it("removes old impulse colors and paints changed candles without replacing history", () => {
    const { adapter, state } = liveChart();
    Object.assign(adapter, {
      mgannSwingVisible: true, denseOverlaysVisibleForZoom: true,
      mgannSwingSettings: DEFAULT_MGANN_SWING_SETTINGS,
      mgannImpulseColors: new Map([[0, "old-color"], [1, "old-color"]]),
    });
    const overlay: MgannSwingOverlay = {
      line: [], liveLine: [], signals: [], waveDeltaLabels: [],
      waveDeltaBoxes: [], waveDeltaValues: [], impulseWaves: [],
    };
    (adapter as unknown as { updateMgannImpulseCandles(o: MgannSwingOverlay): void })
      .updateMgannImpulseCandles(overlay);
    expect(state.candleSeries.update).toHaveBeenCalledTimes(2);
    expect(state.candleSeries.update.mock.calls.every(call => call[0].color !== "old-color")).toBe(true);
    expect(state.candleSeries.setData).not.toHaveBeenCalled();
  });
});
