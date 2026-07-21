// chart module â€” ChartContainer React component.
//
// Hosts the Lightweight Charts instance (candle + volume series) and wires it to
// the incremental series controller (design.md "Frontend Modules": ChartContainer,
// Req 11.3, 12.4, 19.1, 19.2).
//
// Data flow:
//  - `bars` (initial REST history from the HistoryLoader/MemoryCache) is loaded
//    once via the controller's single bulk `setBars` (Req 11.2 -> 11.3 initial
//    load). It is re-loaded only when the series identity (symbol/contract/tf)
//    or the history array itself changes â€” an allowed full repaint (Req 12.4).
//  - realtime `bar_update` messages from the ChartSocket that match this
//    container's (symbol, contract, tf) are folded through the controller, which
//    issues an incremental `series.update()` and skips the call entirely when the
//    incoming bar is unchanged (Req 11.3 incremental, Req 12.4 no needless repaint).
//
// The Lightweight Charts dependency is created through an injectable adapter
// factory so the component can be exercised under jsdom with a fake port; the
// pure merge logic lives in `barReducer.ts` and is property-tested in task 12.4.

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  type AlertSignalMarker,
  type EmaLineData,
  type OrderLine,
  type PriceLineSelection,
  type SmcAiSignalMarker,
  type VisibleLogicalRangeInfo,
  LightweightChartsAdapter,
} from "./lightweightChartsAdapter";
import { type Bar } from "../cache/types";
import { FootprintCanvas } from "../footprint/FootprintCanvas";
import {
  DEFAULT_EMA_SETTINGS,
  DEFAULT_BIG_TRADE_SETTINGS,
  type EmaSettings,
  type BigTradeSettings,
  type FootprintSettings,
} from "./IndicatorToggles";
import {
  DEFAULT_MGANN_SWING_SETTINGS,
  normalizeMgannSwingSettings,
  type MgannSwingSettings,
} from "./mgannSwing";
import { bigTradeMinVolumeForTime } from "./bigTradeSessions";
import {
  type FootprintBar,
  type FootprintViewport,
} from "../footprint/footprintModel";
import type { ChartSocket } from "../socket/ChartSocket";
import type {
  BarUpdateMessage,
  FvgSignalUpdateMessage,
  Timeframe,
  VolumeDeltaUpdateMessage,
} from "../socket/messages";
import { DrawingManager } from "./drawings/DrawingManager";
import type {
  DrawingState,
  DrawingToolType,
  FixedRangeProfileMode,
} from "./drawings/types";
import { barDurationForTimeframe } from "./barCountdown";
import { DEFAULT_TIMEZONE_OFFSET_MINUTES } from "./timezone";
import { displayOffsetForTimeframe } from "./timeframeRange";
import type { DeltaProfileData, DeltaProfileLoadState } from "../orderflow/deltaProfile";
import { DEFAULT_SESSION_VOLUME_PROFILE_WIDTH_PX } from "./sessionVolumeProfileSettings";

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
  setVolumeVisible?(visible: boolean): void;
  setVolumeDeltaVisible?(visible: boolean): void;
  setCvdVisible?(visible: boolean): void;
  setMgannSwingVisible?(visible: boolean): void;
  setMgannSwingSettings?(settings: MgannSwingSettings): void;
  setVolumeDelta?(points: readonly VolumeDeltaDatum[]): void;
  updateVolumeDelta?(point: VolumeDeltaDatum): void;
  setFvgSignals?(signals: ReadonlyMap<number, FvgSignalUpdateMessage>): void;
  updateFvgSignal?(signal: FvgSignalUpdateMessage): void;
  setFvgGraderVisible?(visible: boolean): void;
  setBigTrades?(markers: readonly BigTradeMarker[]): void;
  updateBigTrade?(marker: BigTradeMarker): void;
  setSmcAiSignals?(markers: readonly SmcAiSignalMarker[]): void;
  setAlertSignals?(markers: readonly AlertSignalMarker[]): void;
  setAlertLines?(lines: readonly AlertLine[]): void;
  setOrderLines?(lines: readonly OrderLine[]): void;
  getSelectedPriceLine?(): PriceLineSelection | undefined;
  clearSelectedPriceLine?(): void;
  priceToCoordinate?(price: number): number | null;
  setEma?(points: readonly EmaPoint[], color?: string): void;
  setEmaLines?(lines: readonly EmaLineData[]): void;
  updateEma?(point: EmaPoint): void;
  updateEmaLine?(id: string, point: EmaPoint): void;
  clearEma?(): void;
  clearEmaLines?(): void;
  setSmcOverlay?(overlay: SmcOverlay): void;
  setOutsideBar?(settings: OutsideBarSettings): void;
  setSessionVolumeProfile?(data: import("../orderflow/deltaProfile").DeltaProfileData | null): void;
  setSessionVolumeProfileWidth?(widthPx: number): void;
  setSessionVolumeProfileDevelopingPoc?(visible: boolean): void;
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
  subscribeOrderDrag?(handlers: {
    onPreview?: (id: string, price: number) => void;
    onCommit?: (id: string, price: number) => void;
    onCommitBatch?: (updates: readonly { id: string; price: number }[]) => void;
    snap?: (price: number) => number;
  }): () => void;
  subscribeVisibleLogicalRange?(
    handler: (info: VisibleLogicalRangeInfo | null) => void,
  ): () => void;
}

/** Factory that builds the rendering port for a container element. */
export type ChartPortFactory = (
  container: HTMLElement,
  options?: LightweightChartsAdapterOptions,
) => DisposableChartPort;

export interface OrderControl {
  id: string;
  orderId: string;
  actionId?: string;
  level?: "entry" | "sl" | "tp";
  price: number;
  side: "buy" | "sell";
  title: string;
  detail?: string;
  pnlText?: string;
  pnlValue?: number;
  canClose?: boolean;
  canCancel?: boolean;
  closing?: boolean;
  cancelling?: boolean;
}

interface PositionedOrderControl extends OrderControl {
  top: number;
}

const defaultPortFactory: ChartPortFactory = (container, options) =>
  new LightweightChartsAdapter(container, options);

const PRIMARY_EMA_LINE_ID = "primary";
const EMA_200_LINE_ID = "ema-200";
const EMA_200_PERIOD = 200;
const HISTORY_EDGE_THRESHOLD_BARS = 120;
const ORDER_CONTROL_MIN_TOP_PX = 18;
const ORDER_CONTROL_MAX_BOTTOM_PAD_PX = 18;
const ORDER_CONTROL_MIN_GAP_PX = 30;

interface EmaLineConfig {
  id: string;
  period: number;
  color: string;
  lineWidth?: 1 | 2 | 3 | 4;
}

interface EmaLineState {
  closedValue: number | undefined;
  time: number;
  displayValue: number;
}

function normalizedEmaPeriod(value: number | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed >= 1
    ? Math.max(1, Math.round(parsed))
    : fallback;
}

function emaLineConfigs(ema?: Partial<EmaSettings>): EmaLineConfig[] {
  const configs: EmaLineConfig[] = [];
  if (ema?.enabled) {
    configs.push({
      id: PRIMARY_EMA_LINE_ID,
      period: normalizedEmaPeriod(ema.period, DEFAULT_EMA_SETTINGS.period),
      color:
        typeof ema.color === "string"
          ? ema.color
          : DEFAULT_EMA_SETTINGS.color,
      lineWidth: 1,
    });
  }
  if (ema?.showEma200) {
    configs.push({
      id: EMA_200_LINE_ID,
      period: EMA_200_PERIOD,
      color:
        typeof ema.ema200Color === "string"
          ? ema.ema200Color
          : DEFAULT_EMA_SETTINGS.ema200Color,
      lineWidth: 1,
    });
  }
  return configs;
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
  /** Initial/live FVG Signal Grader candle colors keyed by M1 source-bar time. */
  fvgSignals?: ReadonlyMap<number, FvgSignalUpdateMessage>;
  /** Initial/live BigTrade markers. */
  bigTrades?: readonly BigTradeMarker[];
  /** Read-only Phase 0 SMC AI entry markers. */
  smcAiSignals?: readonly SmcAiSignalMarker[];
  /** Alert level lines to draw on the candle price scale (Req 16.5). */
  alertLines?: readonly AlertLine[];
  /** Discrete alert signal arrows, e.g. mGann Break L/S markers. */
  alertSignals?: readonly AlertSignalMarker[];
  /** Live order entry/SL/TP levels to draw on the candle price scale. */
  orderLines?: readonly OrderLine[];
  /** Action chips aligned to order fill/entry lines. */
  orderControls?: readonly OrderControl[];
  /**
   * EMA overlay config. When `enabled`, an EMA line of `period` (default 200)
   * is drawn on the candle scale, computed from `bars` (Req 19.3 â€” explicitly
   * added overlay). `color` restyles the line.
   */
  ema?: Partial<EmaSettings>;
  /** Show the footprint canvas overlay. Footprint is M1-only. */
  showFootprint?: boolean;
  /** Session volume profile data for the right-edge histogram. */
  sessionVolumeProfile?: DeltaProfileData | null;
  /** Session volume profile histogram width in CSS pixels. */
  sessionVolumeProfileWidth?: number;
  /** Show the session developing POC and value-area paths. */
  sessionVolumeProfileDevelopingPoc?: boolean;
  /** Show TradingView-style volume histogram at the bottom of the chart. */
  showVolume?: boolean;
  /** Show MyVolumeDelta-style candles at the bottom of the chart. */
  showVolumeDelta?: boolean;
  /** Show current wave delta as an MBox histogram at the bottom of the chart. */
  showCvd?: boolean;
  /** Show MGannSwing price swingline/signals. MGannSwing is hidden on M1. */
  showMgannSwing?: boolean;
  /** MGannSwing sub-settings. */
  mgannSwing?: Partial<MgannSwingSettings>;
  /** Show BigTrade markers on the candle series. */
  showBigTrades?: boolean;
  /** Show FVG Signal Grader candle recoloring. FVG grading is M1-only. */
  showFvgGrader?: boolean;
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
  /** Fired when the selected alert line is deleted with Delete/Backspace. */
  onAlertDelete?: (id: string) => void;
  /** Fired after a matching realtime bar update is applied to the chart. */
  onRealtimeBar?: (bar: Bar) => void;
  /** Fired when the visible range gets close to the oldest loaded bars. */
  onRequestMoreHistory?: () => void;
  /** Fired when an order line is dragged and released. */
  onOrderDragCommit?: (id: string, price: number) => void;
  /** Fired when one selected order group has multiple pending line edits. */
  onOrderDragBatchCommit?: (
    updates: readonly { id: string; price: number }[],
  ) => void;
  /** Fired from an order action chip. */
  onOrderClose?: (orderId: string) => void;
  /** Fired from a pending/working order action chip. */
  onOrderCancel?: (orderId: string) => void;
  /** Snap a dragged price to the instrument tick (e.g. round to 0.1 for GC). */
  priceSnap?: (price: number) => number;
  /** Active drawing tool type (null = no tool selected). */
  activeTool?: DrawingToolType | null;
  /** Mode used when placing new fixed-range profile drawings. */
  fixedRangeProfileMode?: FixedRangeProfileMode;
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
  /** Completed drawing ids to remove after parent-side handling. */
  removeDrawingIds?: readonly string[];
  /** Computed fixed-range delta profiles keyed by drawing id. */
  fixedRangeDeltaProfiles?: ReadonlyMap<string, DeltaProfileLoadState>;
  /** Footprint display settings. */
  footprintSettings?: FootprintSettings;
  /** Optional overlay controls rendered inside the chart frame. */
  children?: ReactNode;
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
    (contract === symbol || message.contract === contract) &&
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
    (contract === symbol || message.contract === contract) &&
    message.tf === timeframe
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function filterBigTradeMarkers(
  markers: readonly BigTradeMarker[],
  settings: BigTradeSettings,
): readonly BigTradeMarker[] {
  const rawMaxVisible = Math.round(Number(settings.maxVisible));
  const maxVisible = Number.isFinite(rawMaxVisible)
    ? Math.max(1, rawMaxVisible)
    : DEFAULT_BIG_TRADE_SETTINGS.maxVisible;
  const filtered = markers.filter(
    (marker) => marker.volume >= bigTradeMinVolumeForTime(marker.time, settings),
  );
  return filtered.length > maxVisible ? filtered.slice(-maxVisible) : filtered;
}

export function ChartContainer({
  symbol,
  contract,
  timeframe,
  bars,
  volumeDelta,
  footprintBars,
  fvgSignals,
  bigTrades,
  smcAiSignals,
  alertLines,
  alertSignals,
  orderLines,
  orderControls,
  ema,
  showFootprint = false,
  sessionVolumeProfile = null,
  sessionVolumeProfileWidth = DEFAULT_SESSION_VOLUME_PROFILE_WIDTH_PX,
  sessionVolumeProfileDevelopingPoc = true,
  showVolume = true,
  showVolumeDelta = true,
  showCvd = false,
  showMgannSwing = false,
  mgannSwing = DEFAULT_MGANN_SWING_SETTINGS,
  showBigTrades = true,
  showFvgGrader = true,
  bigTradeSettings = DEFAULT_BIG_TRADE_SETTINGS,
  smc,
  outsideBar = DEFAULT_OUTSIDE_BAR_SETTINGS,
  chartBackgroundColor = "#d3d3d3",
  timezoneOffsetMinutes = DEFAULT_TIMEZONE_OFFSET_MINUTES,
  socket,
  options,
  portFactory = defaultPortFactory,
  onCrosshairMove,
  onScreenshotCaptureReady,
  onRequestAlertAtPrice,
  onAlertDragCommit,
  onAlertDelete,
  onRealtimeBar,
  onRequestMoreHistory,
  onOrderDragCommit,
  onOrderDragBatchCommit,
  onOrderClose,
  onOrderCancel,
  priceSnap,
  activeTool,
  fixedRangeProfileMode = "volume",
  onToolDeselect,
  onDrawingCountChange,
  drawings,
  drawingsLoadKey,
  onDrawingsChange,
  deleteAllSignal,
  removeDrawingIds,
  fixedRangeDeltaProfiles,
  footprintSettings,
  children,
}: ChartContainerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const portRef = useRef<DisposableChartPort | null>(null);
  const controllerRef = useRef<ChartSeriesController | null>(null);
  const drawingManagerRef = useRef<DrawingManager | null>(null);
  const showMgannSwingForTimeframe = showMgannSwing && timeframe !== "1m";
  const smcThrottleRef = useRef<number | undefined>(undefined);
  const [footprintViewport, setFootprintViewport] =
    useState<FootprintViewport | null>(null);
  const [positionedOrderControls, setPositionedOrderControls] = useState<
    readonly PositionedOrderControl[]
  >([]);
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
  const alertDeleteRef = useRef<((id: string) => void) | undefined>(
    onAlertDelete,
  );
  alertDeleteRef.current = onAlertDelete;
  const realtimeBarRef = useRef<((bar: Bar) => void) | undefined>(onRealtimeBar);
  realtimeBarRef.current = onRealtimeBar;
  const requestMoreHistoryRef = useRef<(() => void) | undefined>(
    onRequestMoreHistory,
  );
  requestMoreHistoryRef.current = onRequestMoreHistory;
  const orderDragCommitRef = useRef<
    ((id: string, price: number) => void) | undefined
  >(onOrderDragCommit);
  orderDragCommitRef.current = onOrderDragCommit;
  const orderDragBatchCommitRef = useRef<
    ((updates: readonly { id: string; price: number }[]) => void) | undefined
  >(onOrderDragBatchCommit);
  orderDragBatchCommitRef.current = onOrderDragBatchCommit;
  const priceSnapRef = useRef<((price: number) => number) | undefined>(priceSnap);
  priceSnapRef.current = priceSnap;
  // Running EMA state for incremental live updates. `closedValue` is the EMA at
  // the most recent fully-closed bar (the base for the in-progress bar);
  // `time` is the current bar's time; `displayValue` is the EMA currently drawn
  // for `time`. Tracking the closed base separately avoids compounding when the
  // same in-progress bar updates many times.
  const emaStateRef = useRef<Map<string, EmaLineState>>(new Map());
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

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const preventBrowserGesture = (event: Event) => {
      event.preventDefault();
    };
    const options: AddEventListenerOptions = { capture: true, passive: false };

    // iOS Safari can still browser-zoom a canvas despite viewport meta; keep
    // native gestures off the chart surface so Lightweight Charts owns pinch.
    host.addEventListener("gesturestart", preventBrowserGesture, options);
    host.addEventListener("gesturechange", preventBrowserGesture, options);
    host.addEventListener("gestureend", preventBrowserGesture, options);
    return () => {
      host.removeEventListener("gesturestart", preventBrowserGesture, options);
      host.removeEventListener("gesturechange", preventBrowserGesture, options);
      host.removeEventListener("gestureend", preventBrowserGesture, options);
    };
  }, []);

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

  const refreshOrderControlPositions = useCallback(() => {
    const port = portRef.current;
    if (!port?.priceToCoordinate || !orderControls || orderControls.length === 0) {
      setPositionedOrderControls([]);
      return;
    }
    const paneHeight = Math.max(1, port.createFootprintViewport?.(1, 1).height ?? 1);
    const topMax = Math.max(
      ORDER_CONTROL_MIN_TOP_PX,
      paneHeight - ORDER_CONTROL_MAX_BOTTOM_PAD_PX,
    );
    const raw = orderControls.flatMap((control) => {
      const y = port.priceToCoordinate?.(control.price);
      if (y === null || y === undefined || !Number.isFinite(y)) return [];
      const top = Math.min(
        Math.max(ORDER_CONTROL_MIN_TOP_PX, Math.round(y as number)),
        topMax,
      );
      return [{ ...control, top }];
    });
    const sorted = raw.sort((left, right) => left.top - right.top);
    let previousTop = Number.NEGATIVE_INFINITY;
    const next = sorted.map((control) => {
      const top = Math.min(
        Math.max(control.top, previousTop + ORDER_CONTROL_MIN_GAP_PX),
        topMax,
      );
      previousTop = top;
      return { ...control, top };
    });
    for (let index = next.length - 2; index >= 0; index -= 1) {
      const maxTop = next[index + 1].top - ORDER_CONTROL_MIN_GAP_PX;
      if (next[index].top > maxTop) {
        next[index] = {
          ...next[index],
          top: Math.max(ORDER_CONTROL_MIN_TOP_PX, maxTop),
        };
      }
    }
    setPositionedOrderControls(next);
  }, [orderControls]);

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

    let disposeVisibleRange: (() => void) | undefined;
    if (typeof port.subscribeVisibleLogicalRange === "function") {
      disposeVisibleRange = port.subscribeVisibleLogicalRange((info) => {
        if (info !== null && info.barsBefore < HISTORY_EDGE_THRESHOLD_BARS) {
          requestMoreHistoryRef.current?.();
        }
      });
    }

    // Wire the right-click / long-press "Add alert at price" affordance.
    let disposeContextMenu: (() => void) | undefined;
    if (typeof port.subscribeContextMenu === "function") {
      disposeContextMenu = port.subscribeContextMenu((info) =>
        alertAtPriceRef.current?.(info),
      );
    }

    // Wire order-line dragging before alert dragging so order levels win when
    // two price lines overlap.
    let disposeOrderDrag: (() => void) | undefined;
    if (typeof port.subscribeOrderDrag === "function") {
      disposeOrderDrag = port.subscribeOrderDrag({
        onCommit: (id, price) => orderDragCommitRef.current?.(id, price),
        onCommitBatch: (updates) => orderDragBatchCommitRef.current?.(updates),
        snap: (price) => priceSnapRef.current?.(price) ?? price,
      });
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
      disposeVisibleRange?.();
      disposeContextMenu?.();
      disposeOrderDrag?.();
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
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.key !== "Delete" && event.key !== "Backspace") ||
        isEditableTarget(event.target)
      ) {
        return;
      }
      const selected = portRef.current?.getSelectedPriceLine?.();
      if (selected?.kind !== "alert" || alertDeleteRef.current === undefined) {
        return;
      }
      portRef.current?.clearSelectedPriceLine?.();
      alertDeleteRef.current(selected.id);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    refreshFootprintViewport();
    refreshOrderControlPositions();
    const onResize = () => {
      refreshFootprintViewport();
      refreshOrderControlPositions();
    };
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
  }, [refreshOrderControlPositions]);

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
    portRef.current?.setVolumeVisible?.(showVolume);
  }, [showVolume]);

  useEffect(() => {
    portRef.current?.setVolumeDeltaVisible?.(showVolumeDelta);
  }, [showVolumeDelta]);

  useEffect(() => {
    portRef.current?.setCvdVisible?.(showCvd);
  }, [showCvd]);

  useEffect(() => {
    portRef.current?.setSessionVolumeProfileWidth?.(sessionVolumeProfileWidth);
  }, [sessionVolumeProfileWidth]);

  useEffect(() => {
    portRef.current?.setSessionVolumeProfileDevelopingPoc?.(
      sessionVolumeProfileDevelopingPoc,
    );
  }, [sessionVolumeProfileDevelopingPoc]);

  useEffect(() => {
    portRef.current?.setSessionVolumeProfile?.(sessionVolumeProfile ?? null);
  }, [sessionVolumeProfile]);

  useEffect(() => {
    portRef.current?.setMgannSwingVisible?.(showMgannSwingForTimeframe);
  }, [showMgannSwingForTimeframe]);

  useEffect(() => {
    portRef.current?.setMgannSwingSettings?.(
      normalizeMgannSwingSettings(mgannSwing),
    );
  }, [mgannSwing]);

  useEffect(() => {
    portRef.current?.setFvgGraderVisible?.(showFvgGrader);
  }, [showFvgGrader]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) {
      return;
    }
    portRef.current?.setDisplayTimeOffset?.(displayOffsetForTimeframe(timeframe));
    controller.load(bars ?? []);
    drawingManagerRef.current?.requestUpdateAll();
    refreshFootprintViewport();
    const frame = window.requestAnimationFrame(() => {
      drawingManagerRef.current?.requestUpdateAll();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [symbol, contract, timeframe, bars]);

  // Load or replace the lower volume-delta candle series for this series.
  useEffect(() => {
    portRef.current?.setDisplayTimeOffset?.(displayOffsetForTimeframe(timeframe));
    portRef.current?.setVolumeDelta?.(volumeDelta ?? []);
  }, [symbol, contract, timeframe, volumeDelta]);

  useEffect(() => {
    portRef.current?.setFvgSignals?.(fvgSignals ?? new Map());
  }, [symbol, contract, timeframe, fvgSignals]);

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

  useEffect(() => {
    portRef.current?.setSmcAiSignals?.(smcAiSignals ?? []);
  }, [symbol, contract, timeframe, smcAiSignals]);

  useEffect(() => {
    portRef.current?.setAlertSignals?.(alertSignals ?? []);
  }, [symbol, contract, timeframe, alertSignals]);

  // Draw alert level lines on the candle price scale (Req 16.5). Re-applied on
  // any change to the alert set; the adapter diffs by id so unchanged lines are
  // not repainted.
  useEffect(() => {
    portRef.current?.setAlertLines?.(alertLines ?? []);
  }, [symbol, contract, alertLines]);

  useEffect(() => {
    portRef.current?.setOrderLines?.(orderLines ?? []);
    const frame = window.requestAnimationFrame(refreshOrderControlPositions);
    return () => window.cancelAnimationFrame(frame);
  }, [symbol, contract, orderLines, refreshOrderControlPositions]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(refreshOrderControlPositions);
    return () => window.cancelAnimationFrame(frame);
  }, [symbol, contract, timeframe, bars, orderControls, refreshOrderControlPositions]);

  // EMA overlay (Req 19.3). Recompute from the loaded bars whenever the bars,
  // series identity, or EMA config changes. Disabled lines are removed.
  useEffect(() => {
    const port = portRef.current;
    if (!port) return;
    const configs = emaLineConfigs(ema);
    if (configs.length === 0) {
      if (port.clearEmaLines) {
        port.clearEmaLines();
      } else {
        port.clearEma?.();
      }
      emaStateRef.current = new Map();
      return;
    }
    const nextState = new Map<string, EmaLineState>();
    const lines = configs.map((config) => {
      const series = emaSeries(bars ?? [], config.period);
      const last = series[series.length - 1];
      const prev = series[series.length - 2];
      if (last !== undefined) {
        nextState.set(config.id, {
          closedValue: prev ? prev.value : undefined,
          time: last.time,
          displayValue: last.value,
        });
      }
      return {
        id: config.id,
        points: series,
        color: config.color,
        lineWidth: config.lineWidth,
      };
    });
    if (port.setEmaLines) {
      port.setEmaLines(lines);
    } else if (lines.length > 0) {
      port.setEma?.(lines[0].points, lines[0].color);
    }
    emaStateRef.current = nextState;
  }, [
    symbol,
    contract,
    timeframe,
    bars,
    ema?.enabled,
    ema?.period,
    ema?.color,
    ema?.showEma200,
    ema?.ema200Color,
  ]);

  useEffect(() => {
    // Defer SMC recomputation by 100ms so the chart renders bars first
    // without blocking the main thread on O(n) structure detection.
    const timer = window.setTimeout(() => {
      portRef.current?.setSmcOverlay?.(computeSmcOverlay(bars ?? [], smc));
    }, 100);
    return () => window.clearTimeout(timer);
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
      realtimeBarRef.current?.(message.bar);

      // Only schedule order position refresh when there are active order
      // controls, avoiding needless rAF work on every tick.
      if (orderControls && orderControls.length > 0) {
        window.requestAnimationFrame(refreshOrderControlPositions);
      }

      // Throttle SMC overlay recomputation: computeSmcOverlay is O(n) over the
      // entire bar array, so running it on every realtime tick (multiple per
      // second) blocks the main thread and causes visible freezing. Debounce to
      // max once per 500ms during live streaming.
      const smcCfg = smcConfigRef.current;
      if (outcome.rendered && smcCfg?.enabled) {
        if (smcThrottleRef.current === undefined) {
          smcThrottleRef.current = window.setTimeout(() => {
            smcThrottleRef.current = undefined;
            const ctrl = controllerRef.current;
            const cfg = smcConfigRef.current;
            if (ctrl && cfg?.enabled) {
              portRef.current?.setSmcOverlay?.(
                computeSmcOverlay(ctrl.bars, cfg),
              );
            }
          }, 500);
        }
      }

      // Advance the EMA overlay for the same bar when enabled. An in-progress
      // bar (same time as the last EMA point) recomputes from the prior closed
      // EMA; a new bar steps forward and becomes the new base.
      const emaCfg = emaConfigRef.current;
      const port = portRef.current;
      const emaConfigs = emaLineConfigs(emaCfg);
      if (emaConfigs.length > 0 && port) {
        const stateById = emaStateRef.current;
        const bar = message.bar;
        for (const config of emaConfigs) {
          const state = stateById.get(config.id);
          let closedValue: number | undefined;
          if (state === undefined) {
            // No prior EMA: seed from this close.
            closedValue = undefined;
          } else if (bar.time > state.time) {
            // A new bar started: the previous bar's displayed EMA is now closed.
            closedValue = state.displayValue;
          } else {
            // Same in-progress bar: keep the same closed base so repeated
            // updates don't compound.
            closedValue = state.closedValue;
          }
          const value = nextEma(closedValue, bar.close, config.period);
          stateById.set(config.id, {
            closedValue,
            time: bar.time,
            displayValue: value,
          });
          const point = { time: bar.time, value };
          if (port.updateEmaLine) {
            port.updateEmaLine(config.id, point);
          } else if (config.id === PRIMARY_EMA_LINE_ID) {
            port.updateEma?.(point);
          }
        }
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
        ...(message.cumulativeDelta !== undefined
          ? { cumulativeDelta: message.cumulativeDelta }
          : {}),
      });
    });
    return () => {
      dispose();
      disposeDelta();
      if (smcThrottleRef.current !== undefined) {
        window.clearTimeout(smcThrottleRef.current);
        smcThrottleRef.current = undefined;
      }
    };
  }, [socket, symbol, contract, timeframe, orderControls, refreshOrderControlPositions]);

  // Drawing tool activation / deactivation.
  useEffect(() => {
    const mgr = drawingManagerRef.current;
    if (!mgr) return;
    if (activeTool) {
      mgr.startDrawing(
        activeTool,
        activeTool === "fixed_range_delta_profile"
          ? { fixedRangeProfileMode }
          : undefined,
      );
    } else {
      mgr.cancelDrawing();
    }
  }, [activeTool, fixedRangeProfileMode]);

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
    if (fixedRangeDeltaProfiles) {
      for (const [id, state] of fixedRangeDeltaProfiles) {
        mgr.setFixedRangeDeltaProfile(id, state);
      }
    }
    appliedDrawingsLoadKey.current = drawingsLoadKey;
  }, [drawingsLoadKey, drawings, fixedRangeDeltaProfiles]);

  // Delete all drawings when the signal increments.
  const prevDeleteSignal = useRef(deleteAllSignal ?? 0);
  useEffect(() => {
    const current = deleteAllSignal ?? 0;
    if (current > prevDeleteSignal.current) {
      drawingManagerRef.current?.removeAllDrawings();
    }
    prevDeleteSignal.current = current;
  }, [deleteAllSignal]);

  useEffect(() => {
    if (!removeDrawingIds || removeDrawingIds.length === 0) return;
    const mgr = drawingManagerRef.current;
    if (!mgr) return;
    for (const id of removeDrawingIds) {
      mgr.removeDrawing(id);
    }
  }, [removeDrawingIds]);

  useEffect(() => {
    const mgr = drawingManagerRef.current;
    if (!mgr || !fixedRangeDeltaProfiles) return;
    for (const [id, state] of fixedRangeDeltaProfiles) {
      mgr.setFixedRangeDeltaProfile(id, state);
    }
  }, [fixedRangeDeltaProfiles]);

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
      {positionedOrderControls.length > 0 && (
        <div className="order-action-rail" aria-label="Open order actions">
          {positionedOrderControls.map((control) => (
            <div
              key={control.id}
              className={`order-action-chip ${control.side} ${
                control.level ?? "entry"
              }${
                (control.pnlValue ?? 0) < 0 ? " losing" : " winning"
              }`}
              style={{ top: control.top }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="order-action-body">
                <span className="order-action-title">{control.title}</span>
                <span className="order-action-value">
                  {control.pnlText ?? control.detail ?? ""}
                </span>
              </div>
              {control.canCancel ? (
                <button
                  type="button"
                  aria-label={`Cancel ${control.title}`}
                  disabled={control.cancelling}
                  onClick={() => onOrderCancel?.(control.actionId ?? control.orderId)}
                >
                  {control.cancelling ? "..." : "X"}
                </button>
              ) : control.canClose ? (
                <button
                  type="button"
                  aria-label={`Close ${control.title}`}
                  disabled={control.closing}
                  onClick={() => onOrderClose?.(control.actionId ?? control.orderId)}
                >
                  {control.closing ? "..." : "X"}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}
