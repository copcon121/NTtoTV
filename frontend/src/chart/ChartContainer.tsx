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
import { applyBarUpdate } from "./barReducer";
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
import type { SmcWorkerRequest, SmcWorkerResponse } from "./smcWorker";
import {
  computeSweepReversalOverlay,
  type SweepReversalOverlay,
  type SweepReversalSettings,
} from "./sweepReversal";
import {
  type LightweightChartsAdapterOptions,
  type VolumeDeltaDatum,
  type AlertLine,
  type AlertSignalMarker,
  type CrosshairPosition,
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
  normalizeBigTradeMaxVisible,
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
  TduSignalUpdateMessage,
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
import {
  DEFAULT_TIMEZONE_OFFSET_MINUTES,
  TIMEZONE_OFFSET_OPTIONS,
  formatCrosshairTimeForOffset,
  formatUtcOffset,
  normalizeTimezoneOffsetMinutes,
} from "./timezone";
import {
  displayOffsetForTimeframe,
  footprintEnabledForTimeframe,
} from "./timeframeRange";
import type { DeltaProfileData, DeltaProfileLoadState } from "../orderflow/deltaProfile";
import { DEFAULT_SESSION_VOLUME_PROFILE_WIDTH_PX } from "./sessionVolumeProfileSettings";
import {
  DEFAULT_GC_PUSH_MOMENTUM_SETTINGS,
  normalizeGcPushMomentumSettings,
  type GcPushMomentumSettings,
} from "./gcPushMomentum";
import {
  DEFAULT_XKONTROL_DISPLAY_SETTINGS,
  normalizeXKontrolDisplaySettings,
  type XKontrolDisplaySettings,
} from "./xKontrol";
import {
  calculateSupertrend,
  DEFAULT_SUPERTREND_SETTINGS,
  normalizeSupertrendSettings,
  updateSupertrendRuntime,
  type SupertrendOverlay,
  type SupertrendPoint,
  type SupertrendRuntimeState,
  type SupertrendSettings,
} from "./supertrend";

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
  setBarCountdownVisible?(visible: boolean): void;
  /** Coalesce related bulk history setters into one animation-frame render. */
  setBulkRenderCoalescing?(enabled: boolean): void;
  scrollToLatest?(force?: boolean): void;
  setVolumeVisible?(visible: boolean): void;
  setVolumeDeltaVisible?(visible: boolean): void;
  setXKontrolVisible?(visible: boolean): void;
  setXKontrolSettings?(settings: XKontrolDisplaySettings): void;
  setGcPushMomentumVisible?(visible: boolean): void;
  setGcPushMomentumSettings?(settings: GcPushMomentumSettings): void;
  setCvdVisible?(visible: boolean): void;
  setMgannSwingVisible?(visible: boolean): void;
  setMgannSwingSettings?(settings: MgannSwingSettings): void;
  setVolumeDelta?(points: readonly VolumeDeltaDatum[]): void;
  updateVolumeDelta?(point: VolumeDeltaDatum): void;
  setFvgSignals?(signals: ReadonlyMap<number, FvgSignalUpdateMessage>): void;
  updateFvgSignal?(signal: FvgSignalUpdateMessage): void;
  setFvgGraderVisible?(visible: boolean): void;
  setTduSignals?(signals: ReadonlyMap<number, TduSignalUpdateMessage>): void;
  updateTduSignal?(signal: TduSignalUpdateMessage): void;
  setTduSignalsVisible?(visible: boolean): void;
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
  setSupertrendOverlay?(
    overlay: SupertrendOverlay,
    settings: Partial<SupertrendSettings>,
  ): void;
  updateSupertrendPoint?(
    point: SupertrendPoint,
    confirmed: boolean,
    settings: Partial<SupertrendSettings>,
  ): void;
  clearSupertrend?(): void;
  setSmcOverlay?(overlay: SmcOverlay): void;
  setSweepReversalOverlay?(overlay: SweepReversalOverlay): void;
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
  subscribeCrosshairPosition?(
    handler: (position: CrosshairPosition | undefined) => void,
  ): () => void;
  subscribeBarClick?(handler: (bar: Bar | undefined) => void): () => void;
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
  /** Actual timeframe of `bars` when a requested 15s load fell back to 1m. */
  barsTimeframe?: Timeframe;
  /** Initial volume-delta history for the lower MyVolumeDelta-style candles. */
  volumeDelta?: readonly VolumeDeltaDatum[];
  /** Initial/live footprint bars keyed by M1 bar time. */
  footprintBars?: ReadonlyMap<number, FootprintBar>;
  /** Initial/live FVG Signal Grader candle colors keyed by M1 source-bar time. */
  fvgSignals?: ReadonlyMap<number, FvgSignalUpdateMessage>;
  /** Original TDU momentum triangles and candle/delta divergence. */
  tduSignals?: ReadonlyMap<number, TduSignalUpdateMessage>;
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
  /** Pine-v4-compatible ATR trailing regime overlay. Disabled by default. */
  supertrend?: Partial<SupertrendSettings>;
  /** Show the M1 footprint overlay on the supported 15s/1m chart timeframes. */
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
  /** Show the MBoxWave XKontrol signal dots on the footprint overlay. */
  showXKontrol?: boolean;
  /** Select which XKontrol strength levels are rendered. */
  xKontrolSettings?: Partial<XKontrolDisplaySettings>;
  /** Show volatility-normalized price push in its own pane (M1/M5 UI feature). */
  showGcPushMomentum?: boolean;
  /** Show original-style TDU signals directly inside price bars. */
  showTduSignals?: boolean;
  /** GC Push Momentum calculation settings. */
  gcPushMomentumSettings?: Partial<GcPushMomentumSettings>;
  /** Show current wave delta as an MBox histogram at the bottom of the chart. */
  showCvd?: boolean;
  /** Show MGannSwing price swingline/signals. */
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
  /** Standalone close-based Sweep Reversal overlay config. */
  sweepReversal?: Partial<SweepReversalSettings>;
  /** Recolor candles that engulf the prior bar's high and low. */
  outsideBar?: OutsideBarSettings;
  /** Main chart background color. */
  chartBackgroundColor?: string;
  /** Display timezone offset for axis labels, in minutes from UTC. */
  timezoneOffsetMinutes?: number;
  /** Change the chart timezone from the bottom-right timezone control. */
  onTimezoneOffsetChange?: (offsetMinutes: number) => void;
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
  onRealtimeBar?: (bar: Bar, closed?: boolean) => void;
  /** Fired when a loaded candle is clicked, used to choose a replay start. */
  onBarClick?: (bar: Bar) => void;
  /** Keep receiving realtime bars without painting them over replay history. */
  suspendRealtime?: boolean;
  /** Keep the newest revealed replay candle in view. */
  followLatestBar?: boolean;
  /** Fired when the user manually pans/zooms the chart surface. */
  onChartNavigate?: () => void;
  /** Applies replay selection cursor styling to the chart surface. */
  replaySelecting?: boolean;
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

function sweepClosedBars(
  bars: readonly Bar[],
  timeframe: Timeframe,
  nowMs = Date.now(),
): readonly Bar[] {
  const capped = bars.slice(-10_000);
  const latest = capped[capped.length - 1];
  if (
    latest !== undefined &&
    latest.time + barDurationForTimeframe(timeframe) > nowMs
  ) {
    return capped.slice(0, -1);
  }
  return capped;
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

/**
 * Replay projections are immutable prefixes of one snapshot.  Return the first
 * appended index when `next` keeps the same prefix by identity; `undefined`
 * means the projection was replaced or moved backwards and needs a bulk load.
 *
 * Checking the two prefix edges is deliberately O(1).  Replay slices retain
 * the snapshot's item identities, so an async history replacement fails this
 * check while an ordinary one-bar reveal succeeds.
 */
function replayAppendStart<T>(
  previous: readonly T[],
  next: readonly T[],
): number | undefined {
  if (previous.length > next.length) return undefined;
  if (previous.length === 0) return 0;
  if (
    previous[0] !== next[0] ||
    previous[previous.length - 1] !== next[previous.length - 1]
  ) {
    return undefined;
  }
  return previous.length;
}

/** Values newly appended to an immutable replay map, or undefined on replace. */
function replayMapAppends<T>(
  previous: ReadonlyMap<number, T>,
  next: ReadonlyMap<number, T>,
): readonly T[] | undefined {
  if (previous.size > next.size) return undefined;
  for (const [time, value] of previous) {
    if (next.get(time) !== value) return undefined;
  }
  const appended: T[] = [];
  for (const [time, value] of next) {
    if (!previous.has(time)) appended.push(value);
  }
  return appended;
}

export function filterBigTradeMarkers(
  markers: readonly BigTradeMarker[],
  settings: BigTradeSettings,
): readonly BigTradeMarker[] {
  const maxVisible = normalizeBigTradeMaxVisible(settings.maxVisible);
  const filtered = markers.filter(
    (marker) => marker.volume >= bigTradeMinVolumeForTime(marker.time, settings),
  );
  return filtered.length > maxVisible ? filtered.slice(-maxVisible) : filtered;
}

function ChartTimezoneControl({
  offsetMinutes,
  onChange,
}: {
  offsetMinutes: number;
  onChange?: (offsetMinutes: number) => void;
}) {
  const normalizedOffset = normalizeTimezoneOffsetMinutes(offsetMinutes);
  const timezoneLabel = formatUtcOffset(normalizedOffset);
  const label = timezoneLabel;
  const options = useMemo(() => {
    if (
      TIMEZONE_OFFSET_OPTIONS.some(
        (option) => option.offsetMinutes === normalizedOffset,
      )
    ) {
      return TIMEZONE_OFFSET_OPTIONS;
    }
    return [
      ...TIMEZONE_OFFSET_OPTIONS,
      { offsetMinutes: normalizedOffset, label },
    ].sort((left, right) => left.offsetMinutes - right.offsetMinutes);
  }, [normalizedOffset, timezoneLabel]);

  return (
    <div
      className="chart-timezone-control"
      aria-label={`Chart timezone: ${timezoneLabel}`}
      title={`Chart timezone: ${label}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <span aria-hidden="true">{label}</span>
      {onChange && (
        <select
          aria-label="Chart timezone"
          value={normalizedOffset}
          onChange={(event) =>
            onChange(normalizeTimezoneOffsetMinutes(event.currentTarget.value))
          }
        >
          {options.map((option) => (
            <option key={option.offsetMinutes} value={option.offsetMinutes}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export function ChartContainer({
  symbol,
  contract,
  timeframe,
  bars,
  barsTimeframe = timeframe,
  volumeDelta,
  footprintBars,
  fvgSignals,
  tduSignals,
  bigTrades,
  smcAiSignals,
  alertLines,
  alertSignals,
  orderLines,
  orderControls,
  ema,
  supertrend = DEFAULT_SUPERTREND_SETTINGS,
  showFootprint = false,
  sessionVolumeProfile = null,
  sessionVolumeProfileWidth = DEFAULT_SESSION_VOLUME_PROFILE_WIDTH_PX,
  sessionVolumeProfileDevelopingPoc = true,
  showVolume = true,
  showVolumeDelta = true,
  showXKontrol = false,
  xKontrolSettings = DEFAULT_XKONTROL_DISPLAY_SETTINGS,
  showGcPushMomentum = false,
  showTduSignals = true,
  gcPushMomentumSettings = DEFAULT_GC_PUSH_MOMENTUM_SETTINGS,
  showCvd = false,
  showMgannSwing = false,
  mgannSwing = DEFAULT_MGANN_SWING_SETTINGS,
  showBigTrades = true,
  showFvgGrader = true,
  bigTradeSettings = DEFAULT_BIG_TRADE_SETTINGS,
  smc,
  sweepReversal,
  outsideBar = DEFAULT_OUTSIDE_BAR_SETTINGS,
  chartBackgroundColor = "#d3d3d3",
  timezoneOffsetMinutes = DEFAULT_TIMEZONE_OFFSET_MINUTES,
  onTimezoneOffsetChange,
  socket,
  options,
  portFactory = defaultPortFactory,
  onCrosshairMove,
  onScreenshotCaptureReady,
  onRequestAlertAtPrice,
  onAlertDragCommit,
  onAlertDelete,
  onRealtimeBar,
  onBarClick,
  suspendRealtime = false,
  followLatestBar = false,
  onChartNavigate,
  replaySelecting = false,
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
  const showMgannSwingForTimeframe = showMgannSwing;
  const smcThrottleRef = useRef<number | undefined>(undefined);
  const smcWorkerRef = useRef<Worker | undefined>(undefined);
  const smcWorkerBusyRef = useRef(false);
  const smcRequestIdRef = useRef(0);
  const smcLatestRequestIdRef = useRef(0);
  const smcInFlightRequestRef = useRef<SmcWorkerRequest | undefined>(undefined);
  const smcPendingRequestRef = useRef<SmcWorkerRequest | undefined>(undefined);
  const smcDeferredOverlayRef = useRef<
    { requestId: number; overlay: SmcOverlay } | undefined
  >(undefined);
  const chartInteractionActiveRef = useRef(false);
  const [footprintViewport, setFootprintViewport] =
    useState<FootprintViewport | null>(null);
  const footprintRenderEnabledRef = useRef(false);
  footprintRenderEnabledRef.current =
    showFootprint && footprintEnabledForTimeframe(timeframe);
  const [positionedOrderControls, setPositionedOrderControls] = useState<
    readonly PositionedOrderControl[]
  >([]);
  const [crosshairTime, setCrosshairTime] = useState<
    CrosshairPosition | undefined
  >();
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
  const realtimeBarRef = useRef<
    ((bar: Bar, closed?: boolean) => void) | undefined
  >(onRealtimeBar);
  realtimeBarRef.current = onRealtimeBar;
  const barClickRef = useRef<((bar: Bar) => void) | undefined>(onBarClick);
  barClickRef.current = onBarClick;
  const suspendRealtimeRef = useRef(suspendRealtime);
  suspendRealtimeRef.current = suspendRealtime;
  const chartNavigateRef = useRef(onChartNavigate);
  chartNavigateRef.current = onChartNavigate;
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
  const orderControlsRef = useRef(orderControls);
  orderControlsRef.current = orderControls;
  // Running EMA state for incremental live updates. `closedValue` is the EMA at
  // the most recent fully-closed bar (the base for the in-progress bar);
  // `time` is the current bar's time; `displayValue` is the EMA currently drawn
  // for `time`. Tracking the closed base separately avoids compounding when the
  // same in-progress bar updates many times.
  const emaStateRef = useRef<Map<string, EmaLineState>>(new Map());
  const supertrendRuntimeRef = useRef<SupertrendRuntimeState>();
  const supertrendClosedByTimeRef = useRef(new Map<number, boolean>());
  const supertrendSeriesRef = useRef<string>();
  const supertrendLiveOnlyBarsRef = useRef<readonly Bar[]>([]);
  const barsTimeframeRef = useRef(barsTimeframe);
  barsTimeframeRef.current = barsTimeframe;
  const renderedBarsInputRef = useRef<readonly Bar[]>();
  const renderedBarsSeriesRef = useRef<string>();
  const renderedBarsReplayRef = useRef(false);
  const emaBarsInputRef = useRef<readonly Bar[]>();
  const emaBarsSeriesRef = useRef<string>();
  const emaReplayRef = useRef(false);
  const emaConfigKeyRef = useRef<string>();
  const volumeDeltaInputRef = useRef<readonly VolumeDeltaDatum[]>();
  const volumeDeltaSeriesRef = useRef<string>();
  const volumeDeltaReplayRef = useRef(false);
  const fvgSignalsInputRef = useRef<ReadonlyMap<number, FvgSignalUpdateMessage>>();
  const fvgSignalsSeriesRef = useRef<string>();
  const fvgSignalsReplayRef = useRef(false);
  const tduSignalsInputRef = useRef<ReadonlyMap<number, TduSignalUpdateMessage>>();
  const bigTradesInputRef = useRef<readonly BigTradeMarker[]>();
  const bigTradesSeriesRef = useRef<string>();
  const bigTradesReplayRef = useRef(false);
  const smcAiSignalsInputRef = useRef<readonly SmcAiSignalMarker[]>();
  const smcAiSignalsSeriesRef = useRef<string>();
  const smcAiSignalsReplayRef = useRef(false);
  const alertSignalsInputRef = useRef<readonly AlertSignalMarker[]>();
  const alertSignalsSeriesRef = useRef<string>();
  const alertSignalsReplayRef = useRef(false);
  // Latest EMA config, read by the live bar handler without re-subscribing.
  const emaConfigRef = useRef(ema);
  emaConfigRef.current = ema;
  const supertrendConfigRef = useRef(supertrend);
  supertrendConfigRef.current = supertrend;
  const smcConfigRef = useRef(smc);
  smcConfigRef.current = smc;
  const sweepReversalConfigRef = useRef(sweepReversal);
  sweepReversalConfigRef.current = sweepReversal;
  const drawingsChangeRef = useRef(onDrawingsChange);
  drawingsChangeRef.current = onDrawingsChange;
  const screenshotCaptureReadyRef = useRef(onScreenshotCaptureReady);
  screenshotCaptureReadyRef.current = onScreenshotCaptureReady;
  const displayedBigTrades = useMemo(
    () => filterBigTradeMarkers(bigTrades ?? [], bigTradeSettings),
    [bigTrades, bigTradeSettings],
  );

  const applySmcFallback = useCallback((request: SmcWorkerRequest) => {
    const overlay = computeSmcOverlay(request.bars, request.settings);
    if (request.requestId !== smcLatestRequestIdRef.current) return;
    if (chartInteractionActiveRef.current) {
      smcDeferredOverlayRef.current = { requestId: request.requestId, overlay };
      return;
    }
    portRef.current?.setSmcOverlay?.(overlay);
  }, []);

  const dispatchSmcWorkerRequest = useCallback(
    (request: SmcWorkerRequest) => {
      const worker = smcWorkerRef.current;
      if (worker === undefined) {
        applySmcFallback(request);
        return;
      }
      smcWorkerBusyRef.current = true;
      smcInFlightRequestRef.current = request;
      try {
        worker.postMessage(request);
      } catch {
        worker.terminate();
        smcWorkerRef.current = undefined;
        smcWorkerBusyRef.current = false;
        smcInFlightRequestRef.current = undefined;
        applySmcFallback(request);
      }
    },
    [applySmcFallback],
  );

  const requestSmcComputation = useCallback(
    (nextBars: readonly Bar[], settings?: Partial<SmcSettings>) => {
      const request: SmcWorkerRequest = {
        requestId: ++smcRequestIdRef.current,
        bars: nextBars,
        settings,
      };
      smcLatestRequestIdRef.current = request.requestId;
      smcDeferredOverlayRef.current = undefined;

      if (!settings?.enabled || nextBars.length === 0) {
        smcPendingRequestRef.current = undefined;
        portRef.current?.setSmcOverlay?.(
          computeSmcOverlay(nextBars, settings),
        );
        return;
      }
      if (smcWorkerBusyRef.current) {
        // A volatile burst can arrive faster than one full-history SMC pass.
        // Keep only the newest snapshot so the worker queue never grows.
        smcPendingRequestRef.current = request;
        return;
      }
      dispatchSmcWorkerRequest(request);
    },
    [dispatchSmcWorkerRequest],
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

  const refreshFootprintViewport = useCallback(() => {
    if (!footprintRenderEnabledRef.current) {
      setFootprintViewport((current) => (current === null ? current : null));
      return;
    }
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
  }, []);

  const refreshOrderControlPositions = useCallback(() => {
    const port = portRef.current;
    const controls = orderControlsRef.current;
    if (!port?.priceToCoordinate || !controls || controls.length === 0) {
      setPositionedOrderControls((current) =>
        current.length === 0 ? current : [],
      );
      return;
    }
    const paneHeight = Math.max(1, port.createFootprintViewport?.(1, 1).height ?? 1);
    const topMax = Math.max(
      ORDER_CONTROL_MIN_TOP_PX,
      paneHeight - ORDER_CONTROL_MAX_BOTTOM_PAD_PX,
    );
    const raw = controls.flatMap((control) => {
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
  }, []);

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

    // Full SMC detection is intentionally kept off pointer/wheel navigation.
    // The latest websocket bar is still merged by the controller and the next
    // idle SMC pass catches up after the gesture.
    let wheelIdleTimer: number | undefined;
    const onChartPointerDown = (event: PointerEvent) => {
      if (event.button === 0) {
        chartInteractionActiveRef.current = true;
        chartNavigateRef.current?.();
      }
    };
    const onChartPointerEnd = () => {
      chartInteractionActiveRef.current = false;
      const deferred = smcDeferredOverlayRef.current;
      if (deferred?.requestId === smcLatestRequestIdRef.current) {
        smcDeferredOverlayRef.current = undefined;
        portRef.current?.setSmcOverlay?.(deferred.overlay);
      }
    };
    const onChartWheel = () => {
      chartInteractionActiveRef.current = true;
      chartNavigateRef.current?.();
      if (wheelIdleTimer !== undefined) window.clearTimeout(wheelIdleTimer);
      wheelIdleTimer = window.setTimeout(() => {
        wheelIdleTimer = undefined;
        chartInteractionActiveRef.current = false;
        const deferred = smcDeferredOverlayRef.current;
        if (deferred?.requestId === smcLatestRequestIdRef.current) {
          smcDeferredOverlayRef.current = undefined;
          portRef.current?.setSmcOverlay?.(deferred.overlay);
        }
      }, 160);
    };
    host.addEventListener("pointerdown", onChartPointerDown, { passive: true });
    host.addEventListener("wheel", onChartWheel, { passive: true });
    window.addEventListener("pointerup", onChartPointerEnd);
    window.addEventListener("pointercancel", onChartPointerEnd);

    // Wire the crosshair readout when the port supports it (real adapter).
    let disposeCrosshair: (() => void) | undefined;
    const maybe = port as DisposableChartPort & {
      subscribeCrosshair?: (h: (bar: Bar | undefined) => void) => () => void;
      subscribeCrosshairPosition?: (
        h: (position: CrosshairPosition | undefined) => void,
      ) => () => void;
    };
    if (
      typeof maybe.subscribeCrosshair === "function" &&
      crosshairRef.current !== undefined
    ) {
      disposeCrosshair = maybe.subscribeCrosshair((bar) =>
        crosshairRef.current?.(bar),
      );
    }
    const disposeCrosshairPosition =
      typeof maybe.subscribeCrosshairPosition === "function"
        ? maybe.subscribeCrosshairPosition(setCrosshairTime)
        : undefined;
    const disposeBarClick =
      typeof port.subscribeBarClick === "function"
        ? port.subscribeBarClick((bar) => {
            if (bar !== undefined) barClickRef.current?.(bar);
          })
        : undefined;

    let disposeVisibleRange: (() => void) | undefined;
    if (typeof port.subscribeVisibleLogicalRange === "function") {
      // The chart library can emit a left-edge range while initially laying out
      // data. Only arm lazy history after an actual navigation gesture so the
      // initial three-day M1 window cannot cascade into loading all history.
      let historyNavigationArmed = false;
      const armHistoryNavigation = () => {
        historyNavigationArmed = true;
      };
      host.addEventListener("pointerdown", armHistoryNavigation, { passive: true });
      host.addEventListener("wheel", armHistoryNavigation, { passive: true });
      disposeVisibleRange = port.subscribeVisibleLogicalRange((info) => {
        if (
          historyNavigationArmed &&
          info !== null &&
          info.barsBefore < HISTORY_EDGE_THRESHOLD_BARS
        ) {
          historyNavigationArmed = false;
          requestMoreHistoryRef.current?.();
        }
      });
      const disposeRangeSubscription = disposeVisibleRange;
      disposeVisibleRange = () => {
        host.removeEventListener("pointerdown", armHistoryNavigation);
        host.removeEventListener("wheel", armHistoryNavigation);
        disposeRangeSubscription();
      };
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
      mgr.attach(adapter.chartApi, adapter.candleSeriesApi, host, {
        byIndex: (paneIndex) => adapter.drawingPaneTargetByIndex(paneIndex),
        byId: (paneId) => adapter.drawingPaneTargetById(paneId),
      });
    }
    drawingManagerRef.current = mgr;

    return () => {
      mgr.dispose();
      drawingManagerRef.current = null;
      host.removeEventListener("pointerdown", onChartPointerDown);
      host.removeEventListener("wheel", onChartWheel);
      window.removeEventListener("pointerup", onChartPointerEnd);
      window.removeEventListener("pointercancel", onChartPointerEnd);
      if (wheelIdleTimer !== undefined) window.clearTimeout(wheelIdleTimer);
      chartInteractionActiveRef.current = false;
      disposeCrosshair?.();
      disposeCrosshairPosition?.();
      disposeBarClick?.();
      setCrosshairTime(undefined);
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
    if (typeof Worker === "undefined") return;

    let worker: Worker;
    try {
      worker = new Worker(new URL("./smcWorker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      return;
    }
    smcWorkerRef.current = worker;
    worker.onmessage = (event: MessageEvent<SmcWorkerResponse>) => {
      const response = event.data;
      smcWorkerBusyRef.current = false;
      smcInFlightRequestRef.current = undefined;
      if (
        "overlay" in response &&
        response.requestId === smcLatestRequestIdRef.current
      ) {
        if (chartInteractionActiveRef.current) {
          smcDeferredOverlayRef.current = response;
        } else {
          portRef.current?.setSmcOverlay?.(response.overlay);
        }
      }
      const pending = smcPendingRequestRef.current;
      smcPendingRequestRef.current = undefined;
      if (pending !== undefined) {
        dispatchSmcWorkerRequest(pending);
      }
    };
    worker.onerror = () => {
      const fallback =
        smcPendingRequestRef.current ?? smcInFlightRequestRef.current;
      smcPendingRequestRef.current = undefined;
      smcInFlightRequestRef.current = undefined;
      smcWorkerBusyRef.current = false;
      worker.terminate();
      if (smcWorkerRef.current === worker) {
        smcWorkerRef.current = undefined;
      }
      if (fallback !== undefined) {
        applySmcFallback(fallback);
      }
    };

    return () => {
      smcLatestRequestIdRef.current = ++smcRequestIdRef.current;
      smcPendingRequestRef.current = undefined;
      smcInFlightRequestRef.current = undefined;
      smcDeferredOverlayRef.current = undefined;
      smcWorkerBusyRef.current = false;
      worker.terminate();
      if (smcWorkerRef.current === worker) {
        smcWorkerRef.current = undefined;
      }
    };
  }, [applySmcFallback, dispatchSmcWorkerRequest]);

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
  }, [refreshFootprintViewport, refreshOrderControlPositions]);

  // Load initial history in bulk. During replay, immutable one-bar prefix growth
  // is applied incrementally; entering, rewinding, or replacing the snapshot
  // still performs one authoritative bulk load.
  useEffect(() => {
    portRef.current?.setDisplayTimeOffset?.(displayOffsetForTimeframe(timeframe));
  }, [timeframe]);

  useEffect(() => {
    portRef.current?.setBarCountdownDuration?.(
      barDurationForTimeframe(timeframe),
    );
  }, [timeframe]);

  useEffect(() => {
    portRef.current?.setBarCountdownVisible?.(!suspendRealtime);
  }, [suspendRealtime]);

  useEffect(() => {
    const port = portRef.current;
    if (port?.setBulkRenderCoalescing === undefined) return;
    // Replay changes bars, delta, and FVG together on entry/backward seeks.
    // Normal live rendering remains immediate.
    port.setBulkRenderCoalescing(suspendRealtime);
  }, [suspendRealtime]);

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
    // XKontrol now belongs to the footprint canvas, not the candle pane.
    portRef.current?.setXKontrolVisible?.(false);
  }, [showXKontrol]);

  useEffect(() => {
    portRef.current?.setXKontrolSettings?.(
      normalizeXKontrolDisplaySettings(xKontrolSettings),
    );
  }, [xKontrolSettings]);

  useEffect(() => {
    portRef.current?.setGcPushMomentumSettings?.(
      normalizeGcPushMomentumSettings({
        ...gcPushMomentumSettings,
        barDurationMs: barDurationForTimeframe(timeframe),
      }),
    );
  }, [gcPushMomentumSettings, timeframe]);

  useEffect(() => {
    portRef.current?.setGcPushMomentumVisible?.(showGcPushMomentum);
    refreshFootprintViewport();
    drawingManagerRef.current?.requestUpdateAll();
    const frame = window.requestAnimationFrame(() => {
      refreshFootprintViewport();
      drawingManagerRef.current?.requestUpdateAll();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [showGcPushMomentum, refreshFootprintViewport]);

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
    portRef.current?.setTduSignalsVisible?.(showTduSignals);
  }, [showTduSignals]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) {
      return;
    }
    const nextBars = bars ?? [];
    const seriesKey = `${symbol}\u0000${contract}\u0000${timeframe}`;
    const previousBars = renderedBarsInputRef.current;
    const sameReplaySeries =
      suspendRealtime &&
      renderedBarsReplayRef.current &&
      renderedBarsSeriesRef.current === seriesKey &&
      previousBars !== undefined;
    const appendStart = sameReplaySeries
      ? replayAppendStart(previousBars, nextBars)
      : undefined;
    const bulkLoaded = appendStart === undefined;

    let rendered = true;
    if (appendStart !== undefined) {
      if (appendStart === nextBars.length) {
        rendered = false;
      } else if (appendStart + 1 === nextBars.length) {
        controller.apply(nextBars[appendStart], true);
      } else {
        // A batched timer reveal is uncommon, but applying the suffix remains
        // incremental and avoids a full chart/indicator rebuild.
        for (let index = appendStart; index < nextBars.length; index += 1) {
          controller.apply(nextBars[index], true);
        }
      }
    } else {
      controller.load(nextBars);
    }
    renderedBarsInputRef.current = nextBars;
    renderedBarsSeriesRef.current = seriesKey;
    renderedBarsReplayRef.current = suspendRealtime;
    if (!rendered) return;
    if (followLatestBar && !(suspendRealtime && bulkLoaded)) {
      portRef.current?.scrollToLatest?.();
    }
    drawingManagerRef.current?.requestUpdateAll();
    refreshFootprintViewport();
    const frame = window.requestAnimationFrame(() => {
      // Replay bulk setters flush in the preceding animation-frame callback.
      // Refresh coordinates once more against the newly revealed price scale.
      if (suspendRealtime && bulkLoaded) {
        if (followLatestBar) portRef.current?.scrollToLatest?.(true);
        refreshFootprintViewport();
      }
      drawingManagerRef.current?.requestUpdateAll();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [symbol, contract, timeframe, bars, suspendRealtime]);

  // Load or replace the lower volume-delta candle series for this series.
  useEffect(() => {
    const next = volumeDelta ?? [];
    const seriesKey = `${symbol}\u0000${contract}\u0000${timeframe}`;
    const previous = volumeDeltaInputRef.current;
    const appendStart =
      suspendRealtime &&
      volumeDeltaReplayRef.current &&
      volumeDeltaSeriesRef.current === seriesKey &&
      previous !== undefined
        ? replayAppendStart(previous, next)
        : undefined;
    if (appendStart === undefined || portRef.current?.updateVolumeDelta === undefined) {
      portRef.current?.setVolumeDelta?.(next);
    } else {
      for (let index = appendStart; index < next.length; index += 1) {
        portRef.current.updateVolumeDelta(next[index]);
      }
    }
    volumeDeltaInputRef.current = next;
    volumeDeltaSeriesRef.current = seriesKey;
    volumeDeltaReplayRef.current = suspendRealtime;
  }, [symbol, contract, timeframe, volumeDelta, suspendRealtime]);

  useEffect(() => {
    const next = fvgSignals ?? new Map<number, FvgSignalUpdateMessage>();
    const seriesKey = `${symbol}\u0000${contract}\u0000${timeframe}`;
    const previous = fvgSignalsInputRef.current;
    const appended =
      suspendRealtime &&
      fvgSignalsReplayRef.current &&
      fvgSignalsSeriesRef.current === seriesKey &&
      previous !== undefined
        ? replayMapAppends(previous, next)
        : undefined;
    if (appended === undefined || portRef.current?.updateFvgSignal === undefined) {
      portRef.current?.setFvgSignals?.(next);
    } else {
      for (const signal of appended) portRef.current.updateFvgSignal(signal);
    }
    fvgSignalsInputRef.current = next;
    fvgSignalsSeriesRef.current = seriesKey;
    fvgSignalsReplayRef.current = suspendRealtime;
  }, [symbol, contract, timeframe, fvgSignals, suspendRealtime]);

  useEffect(() => {
    const next = tduSignals ?? new Map<number, TduSignalUpdateMessage>();
    if (tduSignalsInputRef.current === next) return;
    portRef.current?.setTduSignals?.(next);
    tduSignalsInputRef.current = next;
  }, [symbol, contract, timeframe, tduSignals]);

  useEffect(() => {
    portRef.current?.setChartBackgroundColor?.(chartBackgroundColor);
    refreshFootprintViewport();
  }, [chartBackgroundColor]);

  useEffect(() => {
    portRef.current?.setTimezoneOffsetMinutes?.(timezoneOffsetMinutes);
  }, [timezoneOffsetMinutes]);

  useEffect(() => {
    const next = showBigTrades ? displayedBigTrades : [];
    const seriesKey = `${symbol}\u0000${contract}\u0000${timeframe}`;
    const previous = bigTradesInputRef.current;
    const appendStart =
      suspendRealtime &&
      bigTradesReplayRef.current &&
      bigTradesSeriesRef.current === seriesKey &&
      previous !== undefined
        ? replayAppendStart(previous, next)
        : undefined;
    if (appendStart === undefined || portRef.current?.updateBigTrade === undefined) {
      portRef.current?.setBigTrades?.(next);
    } else {
      for (let index = appendStart; index < next.length; index += 1) {
        portRef.current.updateBigTrade(next[index]);
      }
    }
    bigTradesInputRef.current = next;
    bigTradesSeriesRef.current = seriesKey;
    bigTradesReplayRef.current = suspendRealtime;
  }, [
    symbol,
    contract,
    timeframe,
    displayedBigTrades,
    showBigTrades,
    suspendRealtime,
  ]);

  useEffect(() => {
    const next = smcAiSignals ?? [];
    const seriesKey = `${symbol}\u0000${contract}\u0000${timeframe}`;
    const previous = smcAiSignalsInputRef.current;
    const unchanged =
      suspendRealtime &&
      smcAiSignalsReplayRef.current &&
      smcAiSignalsSeriesRef.current === seriesKey &&
      previous !== undefined &&
      replayAppendStart(previous, next) === next.length;
    if (!unchanged) portRef.current?.setSmcAiSignals?.(next);
    smcAiSignalsInputRef.current = next;
    smcAiSignalsSeriesRef.current = seriesKey;
    smcAiSignalsReplayRef.current = suspendRealtime;
  }, [symbol, contract, timeframe, smcAiSignals, suspendRealtime]);

  useEffect(() => {
    const next = alertSignals ?? [];
    const seriesKey = `${symbol}\u0000${contract}\u0000${timeframe}`;
    const previous = alertSignalsInputRef.current;
    const unchanged =
      suspendRealtime &&
      alertSignalsReplayRef.current &&
      alertSignalsSeriesRef.current === seriesKey &&
      previous !== undefined &&
      replayAppendStart(previous, next) === next.length;
    if (!unchanged) portRef.current?.setAlertSignals?.(next);
    alertSignalsInputRef.current = next;
    alertSignalsSeriesRef.current = seriesKey;
    alertSignalsReplayRef.current = suspendRealtime;
  }, [symbol, contract, timeframe, alertSignals, suspendRealtime]);

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
    const nextBars = bars ?? [];
    const seriesKey = `${symbol}\u0000${contract}\u0000${timeframe}`;
    const configKey = configs
      .map((config) => `${config.id}:${config.period}:${config.color}:${config.lineWidth ?? ""}`)
      .join("|");
    const previousBars = emaBarsInputRef.current;
    const appendStart =
      suspendRealtime &&
      emaReplayRef.current &&
      emaBarsSeriesRef.current === seriesKey &&
      emaConfigKeyRef.current === configKey &&
      previousBars !== undefined
        ? replayAppendStart(previousBars, nextBars)
        : undefined;
    const rememberInputs = () => {
      emaBarsInputRef.current = nextBars;
      emaBarsSeriesRef.current = seriesKey;
      emaReplayRef.current = suspendRealtime;
      emaConfigKeyRef.current = configKey;
    };

    if (appendStart !== undefined && appendStart === nextBars.length) {
      rememberInputs();
      return;
    }
    if (
      appendStart !== undefined &&
      appendStart + 1 === nextBars.length &&
      configs.length > 0 &&
      port.updateEmaLine !== undefined &&
      configs.every((config) => emaStateRef.current.has(config.id))
    ) {
      const appendedBar = nextBars[appendStart];
      const nextState = new Map(emaStateRef.current);
      for (const config of configs) {
        const prior = nextState.get(config.id)!;
        const value = nextEma(prior.displayValue, appendedBar.close, config.period);
        port.updateEmaLine(config.id, { time: appendedBar.time, value });
        nextState.set(config.id, {
          closedValue: prior.displayValue,
          time: appendedBar.time,
          displayValue: value,
        });
      }
      emaStateRef.current = nextState;
      rememberInputs();
      return;
    }
    if (configs.length === 0) {
      if (port.clearEmaLines) {
        port.clearEmaLines();
      } else {
        port.clearEma?.();
      }
      emaStateRef.current = new Map();
      rememberInputs();
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
    rememberInputs();
  }, [
    symbol,
    contract,
    timeframe,
    bars,
    suspendRealtime,
    ema?.enabled,
    ema?.period,
    ema?.color,
    ema?.showEma200,
    ema?.ema200Color,
  ]);

  // Supertrend owns a separate pair of line series and marker layer. History,
  // replay seeks, backfills, settings changes and revisions all rebuild from
  // the merged bars; the socket path below advances only the latest candle.
  useEffect(() => {
    const port = portRef.current;
    if (!port) return;
    const settings = normalizeSupertrendSettings(supertrend);
    const seriesKey = `${symbol}\u0000${contract}\u0000${timeframe}`;
    if (supertrendSeriesRef.current !== seriesKey) {
      supertrendSeriesRef.current = seriesKey;
      supertrendClosedByTimeRef.current.clear();
      supertrendLiveOnlyBarsRef.current = [];
    }
    const historyMatchesRequestedTimeframe = barsTimeframe === timeframe;
    const nextBars = suspendRealtime
      ? historyMatchesRequestedTimeframe
        ? (bars ?? [])
        : []
      : historyMatchesRequestedTimeframe
        ? (controllerRef.current?.bars ?? bars ?? [])
        : supertrendLiveOnlyBarsRef.current;
    if (!settings.enabled) {
      port.clearSupertrend?.();
      supertrendRuntimeRef.current = undefined;
      return;
    }

    const confirmations = supertrendClosedByTimeRef.current;
    nextBars.forEach((bar, index) => {
      if (bar.closed !== undefined) {
        confirmations.set(bar.time, bar.closed);
      } else if (suspendRealtime || index < nextBars.length - 1) {
        confirmations.set(bar.time, true);
      } else if (!confirmations.has(bar.time)) {
        confirmations.set(bar.time, false);
      }
    });
    const calculated = calculateSupertrend(nextBars, settings, {
      assumeLastBarClosed: suspendRealtime,
      confirmedByTime: confirmations,
    });
    supertrendRuntimeRef.current = calculated.runtime;
    port.setSupertrendOverlay?.(calculated.overlay, settings);
  }, [
    symbol,
    contract,
    timeframe,
    bars,
    barsTimeframe,
    suspendRealtime,
    supertrend,
  ]);

  useEffect(() => {
    // Defer SMC recomputation by 100ms so the chart renders bars first
    // without blocking the main thread on O(n) structure detection.
    let timer: number | undefined;
    const computeWhenIdle = () => {
      if (chartInteractionActiveRef.current) {
        timer = window.setTimeout(computeWhenIdle, 100);
        return;
      }
      requestSmcComputation(bars ?? [], smc);
    };
    timer = window.setTimeout(computeWhenIdle, 100);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [symbol, contract, timeframe, bars, smc, requestSmcComputation]);

  useEffect(() => {
    const closedBars = sweepClosedBars(bars ?? [], timeframe);
    portRef.current?.setSweepReversalOverlay?.(
      computeSweepReversalOverlay(closedBars, sweepReversal),
    );
  }, [symbol, contract, timeframe, bars, sweepReversal]);

  useEffect(() => {
    refreshFootprintViewport();
  }, [showFootprint, refreshFootprintViewport]);

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
      if (suspendRealtimeRef.current) {
        realtimeBarRef.current?.(message.bar, message.closed);
        return;
      }
      const outcome = controller.apply(message.bar, message.closed);
      realtimeBarRef.current?.(message.bar, message.closed);

      // Only schedule order position refresh when there are active order
      // controls, avoiding needless rAF work on every tick.
      if ((orderControlsRef.current?.length ?? 0) > 0) {
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
            if (ctrl && cfg?.enabled && !chartInteractionActiveRef.current) {
              requestSmcComputation(ctrl.bars, cfg);
            }
          }, 500);
        }
      }

      if (message.closed && sweepReversalConfigRef.current?.enabled) {
        portRef.current?.setSweepReversalOverlay?.(
          computeSweepReversalOverlay(
            controller.bars.slice(-10_000),
            sweepReversalConfigRef.current,
          ),
        );
      }

      const supertrendSettings = normalizeSupertrendSettings(
        supertrendConfigRef.current,
      );
      const supertrendUsesLiveOnlyBars = barsTimeframeRef.current !== timeframe;
      if (supertrendUsesLiveOnlyBars) {
        supertrendLiveOnlyBarsRef.current = applyBarUpdate(
          supertrendLiveOnlyBarsRef.current,
          message.bar,
        ).bars;
      }
      if (
        (outcome.rendered || supertrendUsesLiveOnlyBars) &&
        supertrendSettings.enabled &&
        portRef.current
      ) {
        const confirmations = supertrendClosedByTimeRef.current;
        const runtime = supertrendRuntimeRef.current;
        if (
          runtime?.currentTime !== undefined &&
          message.bar.time > runtime.currentTime
        ) {
          confirmations.set(runtime.currentTime, true);
        }
        confirmations.set(message.bar.time, message.closed === true);
        const update =
          runtime === undefined
            ? undefined
            : updateSupertrendRuntime(
                runtime,
                message.bar,
                message.closed === true,
                supertrendSettings,
              );
        const supertrendPort = portRef.current;
        if (update !== undefined && supertrendPort.updateSupertrendPoint) {
          if (update.committedPoint !== undefined) {
            supertrendPort.updateSupertrendPoint(
              update.committedPoint,
              true,
              supertrendSettings,
            );
          }
          supertrendPort.updateSupertrendPoint(
            update.point,
            update.confirmed,
            supertrendSettings,
          );
          supertrendRuntimeRef.current = update.state;
        } else {
          // Historical insert/overwrite, or a minimal test port without the
          // incremental method: recompute from the controller's merged bars.
          const calculated = calculateSupertrend(
            supertrendUsesLiveOnlyBars
              ? supertrendLiveOnlyBarsRef.current
              : controller.bars,
            supertrendSettings,
            { confirmedByTime: confirmations },
          );
          supertrendRuntimeRef.current = calculated.runtime;
          supertrendPort.setSupertrendOverlay?.(
            calculated.overlay,
            supertrendSettings,
          );
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
      if (suspendRealtimeRef.current) {
        return;
      }
      port.updateVolumeDelta({
        time: message.time,
        volume: message.volume,
        buyVolume: message.buyVolume,
        sellVolume: message.sellVolume,
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
  }, [
    socket,
    symbol,
    contract,
    timeframe,
    refreshOrderControlPositions,
    requestSmcComputation,
  ]);

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
      className={`chart-container${replaySelecting ? " is-replay-selecting" : ""}`}
      aria-label="Chart"
      data-symbol={symbol}
      data-contract={contract}
      data-timeframe={timeframe}
    >
      <div ref={hostRef} className="chart-host" />
      {crosshairTime?.isWhitespace && (
        <div
          className="chart-crosshair-time"
          style={{
            left: `${(() => {
              const width = hostRef.current?.clientWidth ?? 0;
              if (width <= 0) return crosshairTime.x;
              const halfLabelWidth = 96;
              return Math.min(
                Math.max(crosshairTime.x, halfLabelWidth),
                Math.max(halfLabelWidth, width - halfLabelWidth),
              );
            })()}px`,
          }}
          aria-hidden="true"
        >
          {formatCrosshairTimeForOffset(
            crosshairTime.time,
            timezoneOffsetMinutes,
          )}
        </div>
      )}
      <ChartTimezoneControl
        offsetMinutes={timezoneOffsetMinutes}
        onChange={onTimezoneOffsetChange}
      />
      {showFootprint &&
        footprintEnabledForTimeframe(timeframe) &&
        footprintViewport !== null && (
        <FootprintCanvas
          bars={footprintBars ?? new Map()}
          viewport={footprintViewport}
          settings={footprintSettings}
          showXKontrol={showXKontrol}
          xKontrolSettings={xKontrolSettings}
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
