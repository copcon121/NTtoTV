// chart module — ChartContainer React component.
//
// Hosts the Lightweight Charts instance (candle + volume series) and wires it to
// the incremental series controller (design.md "Frontend Modules": ChartContainer,
// Req 11.3, 12.4, 19.1, 19.2).
//
// Data flow:
//  - `bars` (initial REST history from the HistoryLoader/MemoryCache) is loaded
//    once via the controller's single bulk `setBars` (Req 11.2 -> 11.3 initial
//    load). It is re-loaded only when the series identity (symbol/contract/tf)
//    or the history array itself changes — an allowed full repaint (Req 12.4).
//  - realtime `bar_update` messages from the ChartSocket that match this
//    container's (symbol, contract, tf) are folded through the controller, which
//    issues an incremental `series.update()` and skips the call entirely when the
//    incoming bar is unchanged (Req 11.3 incremental, Req 12.4 no needless repaint).
//
// The Lightweight Charts dependency is created through an injectable adapter
// factory so the component can be exercised under jsdom with a fake port; the
// pure merge logic lives in `barReducer.ts` and is property-tested in task 12.4.

import { useEffect, useMemo, useRef, useState } from "react";

import { type BigTradeMarker } from "./indicatorReducer";
import { type ChartSeriesPort, ChartSeriesController } from "./chartSeriesController";
import { type EmaPoint, emaSeries, nextEma } from "./ema";
import {
  DEFAULT_OUTSIDE_BAR_SETTINGS,
  type OutsideBarSettings,
} from "./outsideBar";
import {
  type SmcOverlay,
  type SmcSettings,
  computeSmcOverlay,
} from "./smc";
import {
  type LightweightChartsAdapterOptions,
  type VolumeDeltaDatum,
  type AlertLine,
  LightweightChartsAdapter,
} from "./lightweightChartsAdapter";
import { type Bar } from "../cache/types";
import { FootprintCanvas } from "../footprint/FootprintCanvas";
import {
  DEFAULT_BIG_TRADE_SETTINGS,
  type BigTradeSettings,
  type FootprintSettings,
} from "./IndicatorToggles";
import {
  type FootprintBar,
  type FootprintViewport,
} from "../footprint/footprintModel";
import type { ChartSocket } from "../socket/ChartSocket";
import type { BarUpdateMessage, Timeframe, VolumeDeltaUpdateMessage } from "../socket/messages";
import { DrawingManager } from "./drawings/DrawingManager";
import type { DrawingState, DrawingToolType } from "./drawings/types";
import { barDurationForTimeframe } from "./barCountdown";
import { DEFAULT_TIMEZONE_OFFSET_MINUTES } from "./timezone";

/**
 * A disposable rendering port. The default factory builds a
 * {@link LightweightChartsAdapter}; tests can inject a fake to avoid a real
 * canvas.
 */
export interface DisposableChartPort extends ChartSeriesPort {
  dispose(): void;
  setDisplayTimeOffset?(offsetMs: number): void;
  setTimezoneOffsetMinutes?(offsetMinutes: number): void;
  takeScreenshotDataUrl?(): string | undefined;
  setBarCountdownDuration?(durationMs: number): void;
  setVolumeDelta?(points: readonly VolumeDeltaDatum[]): void;
  updateVolumeDelta?(point: VolumeDeltaDatum): void;
  setBigTrades?(markers: readonly BigTradeMarker[]): void;
  updateBigTrade?(marker: BigTradeMarker): void;
  setAlertLines?(lines: readonly AlertLine[]): void;
  setEma?(points: readonly EmaPoint[], color?: string): void;
  updateEma?(point: EmaPoint): void;
  clearEma?(): void;
  setSmcOverlay?(overlay: SmcOverlay): void;
  setOutsideBar?(settings: OutsideBarSettings): void;
  setChartBackgroundColor?(color: string): void;
  createFootprintViewport?(width: number, height: number): FootprintViewport;
  subscribeContextMenu?(
    handler: (info: { price: number; x: number; y: number }) => void,
  ): () => void;
  subscribeAlertDrag?(handlers: {
    onPreview?: (id: string, price: number) => void;
    onCommit?: (id: string, price: number) => void;
    snap?: (price: number) => number;
  }): () => void;
}

/** Factory that builds the rendering port for a container element. */
export type ChartPortFactory = (
  container: HTMLElement,
  options?: LightweightChartsAdapterOptions,
) => DisposableChartPort;

const defaultPortFactory: ChartPortFactory = (container, options) =>
  new LightweightChartsAdapter(container, options);

const TIMEFRAME_DISPLAY_OFFSET_MS: Record<Timeframe, number> = {
  "1m": 60_000,
  "3m": 3 * 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "30m": 30 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1D": 0,
};

function displayOffsetForTimeframe(timeframe: Timeframe): number {
  return TIMEFRAME_DISPLAY_OFFSET_MS[timeframe];
}

export interface ChartContainerProps {
  symbol: string;
  contract: string;
  timeframe: Timeframe;
  /** Initial history bars (from the MemoryCache / HistoryLoader). */
  bars?: readonly Bar[];
  /** Initial volume-delta history for the lower MyVolumeDelta-style candles. */
  volumeDelta?: readonly VolumeDeltaDatum[];
  /** Initial/live footprint bars keyed by M1 bar time. */
  footprintBars?: ReadonlyMap<number, FootprintBar>;
  /** Initial/live BigTrade markers. */
  bigTrades?: readonly BigTradeMarker[];
  /** Alert level lines to draw on the candle price scale (Req 16.5). */
  alertLines?: readonly AlertLine[];
  /**
   * EMA overlay config. When `enabled`, an EMA line of `period` (default 200)
   * is drawn on the candle scale, computed from `bars` (Req 19.3 — explicitly
   * added overlay). `color` restyles the line.
   */
  ema?: { enabled: boolean; period?: number; color?: string };
  /** Show the footprint canvas overlay. Footprint is M1-only. */
  showFootprint?: boolean;
  /** Show BigTrade markers on the candle series. */
  showBigTrades?: boolean;
  /** BigTrade display-only filters. */
  bigTradeSettings?: BigTradeSettings;
  /** SMC overlay config. Disabled clears all SMC markers/zones. */
  smc?: SmcSettings;
  /** Recolor candles that engulf the prior bar's high and low. */
  outsideBar?: OutsideBarSettings;
  /** Main chart background color. */
  chartBackgroundColor?: string;
  /** Display timezone offset for axis labels, in minutes from UTC. */
  timezoneOffsetMinutes?: number;
  /** Chart socket whose `bar_update` events drive incremental updates. */
  socket?: ChartSocket;
  /** Options forwarded to the Lightweight Charts adapter. */
  options?: LightweightChartsAdapterOptions;
  /** Injectable rendering-port factory (defaults to the real adapter). */
  portFactory?: ChartPortFactory;
  /**
   * Optional crosshair-move callback (Req 19.5). Invoked with the OHLCV bar
   * under the crosshair, or `undefined` when off-series. Only wired when the
   * port supports `subscribeCrosshair` (the real adapter does; fakes need not).
  */
  onCrosshairMove?: (bar: Bar | undefined) => void;
  /** Supplies a chart screenshot capture function to the parent while mounted. */
  onScreenshotCaptureReady?: (
    capture: (() => string | undefined) | undefined,
  ) => void;
  /**
   * Right-click / long-press on the chart, reporting the price under the
   * pointer and the local pointer coordinates so the caller can show a
   * TradingView-style "Add alert at {price}" menu (Req 16.5).
   */
  onRequestAlertAtPrice?: (info: { price: number; x: number; y: number }) => void;
  /**
   * Fired when an alert line is dragged to a new price and released, so the
   * parent can persist the new level (Req 16.5).
   */
  onAlertDragCommit?: (id: string, price: number) => void;
  /** Snap a dragged price to the instrument tick (e.g. round to 0.1 for GC). */
  priceSnap?: (price: number) => number;
  /** Active drawing tool type (null = no tool selected). */
  activeTool?: DrawingToolType | null;
  /** Called when drawing placement completes (deselects the tool). */
  onToolDeselect?: () => void;
  /** Called when the drawing count changes. */
  onDrawingCountChange?: (count: number) => void;
  /** Serialized drawings loaded from / saved to a server-side profile. */
  drawings?: readonly DrawingState[];
  /** Increment or change to replace chart drawings from `drawings`. */
  drawingsLoadKey?: number | string;
  /** Called whenever completed drawings change. */
  onDrawingsChange?: (drawings: DrawingState[]) => void;
  /** Increment to trigger delete-all drawings. */
  deleteAllSignal?: number;
  /** Footprint display settings. */
  footprintSettings?: FootprintSettings;
}

/** True when a `bar_update` message targets this container's series. */
function matchesSeries(
  message: BarUpdateMessage,
  symbol: string,
  contract: string,
  timeframe: Timeframe,
): boolean {
  return (
    message.symbol === symbol &&
    message.contract === contract &&
    message.tf === timeframe
  );
}

function matchesVolumeDeltaSeries(
  message: VolumeDeltaUpdateMessage,
  symbol: string,
  contract: string,
  timeframe: Timeframe,
): boolean {
  return (
    message.symbol === symbol &&
    message.contract === contract &&
    message.tf === timeframe
  );
}

export function filterBigTradeMarkers(
  markers: readonly BigTradeMarker[],
  settings: BigTradeSettings,
): readonly BigTradeMarker[] {
  const rawMinVolume = Math.round(Number(settings.minVolume));
  const rawMaxVisible = Math.round(Number(settings.maxVisible));
  const minVolume = Number.isFinite(rawMinVolume)
    ? Math.max(0, rawMinVolume)
    : DEFAULT_BIG_TRADE_SETTINGS.minVolume;
  const maxVisible = Number.isFinite(rawMaxVisible)
    ? Math.max(1, rawMaxVisible)
    : DEFAULT_BIG_TRADE_SETTINGS.maxVisible;
  const filtered = markers.filter((marker) => marker.volume >= minVolume);
  return filtered.length > maxVisible ? filtered.slice(-maxVisible) : filtered;
}

export function ChartContainer({
  symbol,
  contract,
  timeframe,
  bars,
  volumeDelta,
  footprintBars,
  bigTrades,
  alertLines,
  ema,
  showFootprint = false,
  showBigTrades = true,
  bigTradeSettings = DEFAULT_BIG_TRADE_SETTINGS,
  smc,
  outsideBar = DEFAULT_OUTSIDE_BAR_SETTINGS,
  chartBackgroundColor = "#101010",
  timezoneOffsetMinutes = DEFAULT_TIMEZONE_OFFSET_MINUTES,
  socket,
  options,
  portFactory = defaultPortFactory,
  onCrosshairMove,
  onScreenshotCaptureReady,
  onRequestAlertAtPrice,
  onAlertDragCommit,
  priceSnap,
  activeTool,
  onToolDeselect,
  onDrawingCountChange,
  drawings,
  drawingsLoadKey,
  onDrawingsChange,
  deleteAllSignal,
  footprintSettings,
}: ChartContainerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const portRef = useRef<DisposableChartPort | null>(null);
  const controllerRef = useRef<ChartSeriesController | null>(null);
  const drawingManagerRef = useRef<DrawingManager | null>(null);
  const [footprintViewport, setFootprintViewport] =
    useState<FootprintViewport | null>(null);
  // Keep the latest crosshair callback without re-subscribing on every render.
  const crosshairRef = useRef<((bar: Bar | undefined) => void) | undefined>(
    onCrosshairMove,
  );
  crosshairRef.current = onCrosshairMove;
  // Same for the alert-at-price (context menu) callback.
  const alertAtPriceRef = useRef<
    ((info: { price: number; x: number; y: number }) => void) | undefined
  >(onRequestAlertAtPrice);
  alertAtPriceRef.current = onRequestAlertAtPrice;
  // Drag-commit + snap callbacks, kept in refs so the mount subscription is stable.
  const alertDragCommitRef = useRef<
    ((id: string, price: number) => void) | undefined
  >(onAlertDragCommit);
  alertDragCommitRef.current = onAlertDragCommit;
  const priceSnapRef = useRef<((price: number) => number) | undefined>(priceSnap);
  priceSnapRef.current = priceSnap;
  // Running EMA state for incremental live updates. `closedValue` is the EMA at
  // the most recent fully-closed bar (the base for the in-progress bar);
  // `time` is the current bar's time; `displayValue` is the EMA currently drawn
  // for `time`. Tracking the closed base separately avoids compounding when the
  // same in-progress bar updates many times.
  const emaStateRef = useRef<
    { closedValue: number | undefined; time: number; displayValue: number } | undefined
  >(undefined);
  // Latest EMA config, read by the live bar handler without re-subscribing.
  const emaConfigRef = useRef(ema);
  emaConfigRef.current = ema;
  const smcConfigRef = useRef(smc);
  smcConfigRef.current = smc;
  const drawingsChangeRef = useRef(onDrawingsChange);
  drawingsChangeRef.current = onDrawingsChange;
  const screenshotCaptureReadyRef = useRef(onScreenshotCaptureReady);
  screenshotCaptureReadyRef.current = onScreenshotCaptureReady;
  const displayedBigTrades = useMemo(
    () => filterBigTradeMarkers(bigTrades ?? [], bigTradeSettings),
    [bigTrades, bigTradeSettings],
  );

  // Create the chart port + controller once per mount. The factory is captured
  // in a memo so re-renders don't rebuild the chart.
  const factory = useMemo(() => portFactory, [portFactory]);

  const refreshFootprintViewport = () => {
    const host = hostRef.current;
    const port = portRef.current;
    if (!host || !port?.createFootprintViewport) {
      setFootprintViewport(null);
      return;
    }
    const rect = host.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || host.clientWidth));
    const height = Math.max(1, Math.round(rect.height || host.clientHeight));
    setFootprintViewport(port.createFootprintViewport(width, height));
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    const port = factory(host, {
      ...options,
      displayTimeOffsetMs: displayOffsetForTimeframe(timeframe),
      barCountdownDurationMs: barDurationForTimeframe(timeframe),
      chartBackgroundColor,
      timezoneOffsetMinutes,
      outsideBar,
    });
    portRef.current = port;
    controllerRef.current = new ChartSeriesController(port);
    screenshotCaptureReadyRef.current?.(() => port.takeScreenshotDataUrl?.());

    // Wire the crosshair readout when the port supports it (real adapter).
    let disposeCrosshair: (() => void) | undefined;
    const maybe = port as DisposableChartPort & {
      subscribeCrosshair?: (h: (bar: Bar | undefined) => void) => () => void;
    };
    if (typeof maybe.subscribeCrosshair === "function") {
      disposeCrosshair = maybe.subscribeCrosshair((bar) =>
        crosshairRef.current?.(bar),
      );
    }

    // Wire the right-click / long-press "Add alert at price" affordance.
    let disposeContextMenu: (() => void) | undefined;
    if (typeof port.subscribeContextMenu === "function") {
      disposeContextMenu = port.subscribeContextMenu((info) =>
        alertAtPriceRef.current?.(info),
      );
    }

    // Wire alert-line dragging: live preview moves the line; release persists.
    let disposeAlertDrag: (() => void) | undefined;
    if (typeof port.subscribeAlertDrag === "function") {
      disposeAlertDrag = port.subscribeAlertDrag({
        onCommit: (id, price) => alertDragCommitRef.current?.(id, price),
        snap: (price) => priceSnapRef.current?.(price) ?? price,
      });
    }

    // Attach the DrawingManager to the chart. The adapter exposes the chart
    // and candle series so the manager can attach primitives.
    const mgr = new DrawingManager();
    const adapter = port as LightweightChartsAdapter;
    if (adapter.chartApi && adapter.candleSeriesApi) {
      mgr.attach(adapter.chartApi, adapter.candleSeriesApi, host);
    }
    drawingManagerRef.current = mgr;

    return () => {
      mgr.dispose();
      drawingManagerRef.current = null;
      disposeCrosshair?.();
      disposeContextMenu?.();
      disposeAlertDrag?.();
      screenshotCaptureReadyRef.current?.(undefined);
      port.dispose();
      portRef.current = null;
      controllerRef.current = null;
    };
    // options is intentionally read once at mount; changing it later does not
    // rebuild the chart (style-only and out of scope for this task).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factory]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    refreshFootprintViewport();
    const onResize = () => refreshFootprintViewport();
    window.addEventListener("resize", onResize);
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(onResize);
      observer.observe(host);
    }
    return () => {
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
    };
  }, []);

  // Load (or reload) initial history when the series identity or the bars array
  // changes. This is the single allowed bulk load / full repaint (Req 12.4).
  useEffect(() => {
    portRef.current?.setBarCountdownDuration?.(
      barDurationForTimeframe(timeframe),
    );
  }, [timeframe]);

  useEffect(() => {
    portRef.current?.setOutsideBar?.(outsideBar);
  }, [outsideBar]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) {
      return;
    }
    portRef.current?.setDisplayTimeOffset?.(displayOffsetForTimeframe(timeframe));
    controller.load(bars ?? []);
    refreshFootprintViewport();
  }, [symbol, contract, timeframe, bars]);

  // Load or replace the lower volume-delta candle series for this series.
  useEffect(() => {
    portRef.current?.setDisplayTimeOffset?.(displayOffsetForTimeframe(timeframe));
    portRef.current?.setVolumeDelta?.(volumeDelta ?? []);
  }, [symbol, contract, timeframe, volumeDelta]);

  useEffect(() => {
    portRef.current?.setChartBackgroundColor?.(chartBackgroundColor);
    refreshFootprintViewport();
  }, [chartBackgroundColor]);

  useEffect(() => {
    portRef.current?.setTimezoneOffsetMinutes?.(timezoneOffsetMinutes);
  }, [timezoneOffsetMinutes]);

  useEffect(() => {
    portRef.current?.setBigTrades?.(showBigTrades ? displayedBigTrades : []);
  }, [symbol, contract, displayedBigTrades, showBigTrades]);

  // Draw alert level lines on the candle price scale (Req 16.5). Re-applied on
  // any change to the alert set; the adapter diffs by id so unchanged lines are
  // not repainted.
  useEffect(() => {
    portRef.current?.setAlertLines?.(alertLines ?? []);
  }, [symbol, contract, alertLines]);

  // EMA overlay (Req 19.3). Recompute from the loaded bars whenever the bars,
  // series identity, or EMA config change. Disabled -> clear the line.
  useEffect(() => {
    const port = portRef.current;
    if (!port) return;
    if (!ema?.enabled) {
      port.clearEma?.();
      emaStateRef.current = undefined;
      return;
    }
    const period = ema.period ?? 200;
    const series = emaSeries(bars ?? [], period);
    port.setEma?.(series, ema.color);
    const last = series[series.length - 1];
    const prev = series[series.length - 2];
    emaStateRef.current = last
      ? {
          closedValue: prev ? prev.value : undefined,
          time: last.time,
          displayValue: last.value,
        }
      : undefined;
  }, [symbol, contract, timeframe, bars, ema?.enabled, ema?.period, ema?.color]);

  useEffect(() => {
    portRef.current?.setSmcOverlay?.(computeSmcOverlay(bars ?? [], smc));
  }, [symbol, contract, timeframe, bars, smc]);

  useEffect(() => {
    if (showFootprint) {
      refreshFootprintViewport();
    }
  }, [footprintBars, showFootprint]);

  // Subscribe to realtime bar_update events and apply them incrementally.
  useEffect(() => {
    if (!socket) {
      return;
    }
    const dispose = socket.on("bar_update", (message) => {
      const controller = controllerRef.current;
      if (!controller) {
        return;
      }
      if (!matchesSeries(message, symbol, contract, timeframe)) {
        return;
      }
      const outcome = controller.apply(message.bar);

      const smcCfg = smcConfigRef.current;
      if (outcome.rendered && smcCfg?.enabled) {
        portRef.current?.setSmcOverlay?.(
          computeSmcOverlay(controller.bars, smcCfg),
        );
      }

      // Advance the EMA overlay for the same bar when enabled. An in-progress
      // bar (same time as the last EMA point) recomputes from the prior closed
      // EMA; a new bar steps forward and becomes the new base.
      const emaCfg = emaConfigRef.current;
      const port = portRef.current;
      if (emaCfg?.enabled && port?.updateEma) {
        const period = emaCfg.period ?? 200;
        const state = emaStateRef.current;
        const bar = message.bar;
        let closedValue: number | undefined;
        if (state === undefined) {
          // No prior EMA: seed from this close.
          closedValue = undefined;
        } else if (bar.time > state.time) {
          // A new bar started: the previous bar's displayed EMA is now closed.
          closedValue = state.displayValue;
        } else {
          // Same in-progress bar: keep the same closed base so repeated updates
          // don't compound.
          closedValue = state.closedValue;
        }
        const value = nextEma(closedValue, bar.close, period);
        emaStateRef.current = { closedValue, time: bar.time, displayValue: value };
        port.updateEma({ time: bar.time, value });
      }
    });
    const disposeDelta = socket.on("volume_delta_update", (message) => {
      const port = portRef.current;
      if (!port?.updateVolumeDelta) {
        return;
      }
      if (!matchesVolumeDeltaSeries(message, symbol, contract, timeframe)) {
        return;
      }
      port.updateVolumeDelta({
        time: message.time,
        delta: message.delta,
        deltaHigh: message.deltaHigh,
        deltaLow: message.deltaLow,
        openDelta: message.openDelta,
        closeDelta: message.closeDelta,
      });
    });
    return () => {
      dispose();
      disposeDelta();
    };
  }, [socket, symbol, contract, timeframe]);

  // Drawing tool activation / deactivation.
  useEffect(() => {
    const mgr = drawingManagerRef.current;
    if (!mgr) return;
    if (activeTool) {
      mgr.startDrawing(activeTool);
    } else {
      mgr.cancelDrawing();
    }
  }, [activeTool]);

  // Notify parent of drawing count changes.
  useEffect(() => {
    const mgr = drawingManagerRef.current;
    if (!mgr || !onDrawingCountChange) return;
    return mgr.onCountChange((count) => {
      onDrawingCountChange(count);
      // Auto-deselect tool after placement completes
      if (activeTool) {
        onToolDeselect?.();
      }
    });
  }, [onDrawingCountChange, onToolDeselect, activeTool]);

  // Stream drawing state up to the parent so profile saves include drawings.
  useEffect(() => {
    const mgr = drawingManagerRef.current;
    if (!mgr) return;
    return mgr.onStateChange((state) => drawingsChangeRef.current?.(state));
  }, []);

  // Replace drawings only when the caller explicitly changes the load key.
  const appliedDrawingsLoadKey = useRef<number | string | undefined>(undefined);
  useEffect(() => {
    const mgr = drawingManagerRef.current;
    if (!mgr || drawingsLoadKey === undefined) return;
    if (appliedDrawingsLoadKey.current === drawingsLoadKey) return;
    mgr.loadState(drawings ?? []);
    appliedDrawingsLoadKey.current = drawingsLoadKey;
  }, [drawingsLoadKey, drawings]);

  // Delete all drawings when the signal increments.
  const prevDeleteSignal = useRef(deleteAllSignal ?? 0);
  useEffect(() => {
    const current = deleteAllSignal ?? 0;
    if (current > prevDeleteSignal.current) {
      drawingManagerRef.current?.removeAllDrawings();
    }
    prevDeleteSignal.current = current;
  }, [deleteAllSignal]);

  return (
    <div
      className="chart-container"
      aria-label="Chart"
      data-symbol={symbol}
      data-contract={contract}
      data-timeframe={timeframe}
    >
      <div ref={hostRef} className="chart-host" />
      {showFootprint && timeframe === "1m" && footprintViewport !== null && (
        <FootprintCanvas
          bars={footprintBars ?? new Map()}
          viewport={footprintViewport}
          settings={footprintSettings}
        />
      )}
    </div>
  );
}
