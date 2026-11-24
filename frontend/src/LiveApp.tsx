import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UTCTimestamp } from "lightweight-charts";

import {
  ApiClient,
  type AlertSignalRestRow,
  type AiScanCandidate,
  type AuthUser,
  type Mt5Account,
  type ExnessConnectInput,
  type BrokerTicket,
  type Mt5OpenTrades,
  type Mt5PendingOrder,
  type Mt5Symbol,
  type Mt5TradePatchInput,
  type SupertrendTrailing,
  type VolumeDeltaBar,
} from "./api/client";
import { AlertPanel } from "./alerts/AlertPanel";
import {
  type Alert,
  type TelegramNotificationConfig,
  type TelegramNotificationInput,
  type WebPushNotificationConfig,
} from "./alerts/types";
import { ChartContainer, type ChartDrawingActions, type OrderControl } from "./chart/ChartContainer";
import { DrawingToolbar } from "./chart/DrawingToolbar";
import { DEFAULT_CHART_BACKGROUND } from "./chart/theme";
import {
  IndicatorToggles,
  DEFAULT_BIG_TRADE_SETTINGS,
  DEFAULT_EMA_SETTINGS,
  DEFAULT_FVG_SIGNAL_LIMIT,
  DEFAULT_MGANN_BREAK_SIGNAL_HISTORY_BARS,
  DEFAULT_MGANN_BREAK_SIGNAL_LIMIT,
  DEFAULT_FOOTPRINT_SETTINGS,
  normalizeEmaSettings,
  normalizeBigTradeMaxVisible,
  normalizeFvgSignalLimit,
  normalizeMgannBreakSignalHistoryBars,
  normalizeMgannBreakSignalLimit,
} from "./chart/IndicatorToggles";
import type {
  BigTradeSettings,
  EmaSettings,
  FootprintSettings,
} from "./chart/IndicatorToggles";
import { TIMEFRAMES, TimeframeSelector } from "./chart/TimeframeSelector";
import { SymbolContractLabel } from "./chart/SymbolContractLabel";
import {
  BarReplayControls,
  type BarReplayPhase,
} from "./chart/BarReplayControls";
import {
  barReplayDelayMs,
  findReplayBarIndex,
  replayBarsThrough,
  replayCursorBeforeSelection,
  timedMapThrough,
  timedValuesBefore,
  type BarReplaySpeed,
} from "./chart/barReplay";
import { barEndForTimeframe } from "./chart/barCountdown";
import {
  type BigTradeMarker,
  reduceBigTradesCapped,
} from "./chart/indicatorReducer";
import {
  DEFAULT_OUTSIDE_BAR_SETTINGS,
  type OutsideBarSettings,
  normalizeOutsideBarSettings,
} from "./chart/outsideBar";
import {
  DEFAULT_MGANN_SWING_SETTINGS,
  normalizeMgannSwingSettings,
  type MgannSwingSettings,
} from "./chart/mgannSwing";
import {
  DEFAULT_MGANN_BREAK_SETTINGS,
  MGANN_BREAK_SETTINGS_VERSION,
  mgannBreakAlertParams,
  mgannBreakSettingsFromProfile,
  mgannBreakSettingsMatchParams,
  type MgannBreakSettings,
} from "./chart/mgannBreak";
import {
  DEFAULT_XKONTROL_DISPLAY_SETTINGS,
  normalizeXKontrolDisplaySettings,
  XKONTROL_HISTORY_BARS,
  type XKontrolDisplaySettings,
} from "./chart/xKontrol";
import { bigTradeMinVolumeForTime } from "./chart/bigTradeSessions";
import { DEFAULT_SMC_SETTINGS, type SmcSettings } from "./chart/smc";
import {
  DEFAULT_SWEEP_REVERSAL_SETTINGS,
  normalizeSweepReversalSettings,
  type SweepReversalSettings,
} from "./chart/sweepReversal";
import {
  calculateSupertrend,
  DEFAULT_SUPERTREND_SETTINGS,
  normalizeSupertrendSettings,
  type SupertrendSettings,
} from "./chart/supertrend";
import {
  DEFAULT_SESSION_VOLUME_PROFILE_WIDTH_PX,
  DEFAULT_SESSION_VOLUME_PROFILE_ROW_TICKS,
  DEFAULT_SESSION_VOLUME_PROFILE_DAYS,
  normalizeSessionVolumeProfileWidth,
  normalizeSessionVolumeProfileRowTicks,
  normalizeSessionVolumeProfileDays,
  computeSessionVolumeProfileFromMs,
} from "./chart/sessionVolumeProfileSettings";
import {
  HistoryLoader,
  buildHistoryUrl,
  type HistoryResponse,
} from "./cache/historyLoader";
import { MemoryCache } from "./cache/memoryCache";
import { type Bar } from "./cache/types";
import { AuthDialog, type AuthDialogMode } from "./auth/AuthDialog";
import {
  type FootprintBar,
  mergeFootprintCapped,
} from "./footprint/footprintModel";
import {
  type VolumeDeltaDatum,
  type AlertLine,
  type AlertSignalMarker,
  type OrderLine,
  type OrderLineDragUpdate,
  type OrderLineField,
  type SmcAiSignalMarker,
} from "./chart/lightweightChartsAdapter";
import {
  MarketOrderBar,
  type MarketOrderRow,
  type MarketOrderSettings,
} from "./orders/MarketOrderBar";
import { ExnessAccountDialog } from "./orders/ExnessAccountDialog";
import {
  applyOrderDragPreviews,
  reconcileOrderDragPreviews,
  type OrderDragPreview,
  type OrderDragPrices,
} from "./orders/orderDragPreview";
import { ChartSocket } from "./socket/ChartSocket";
import {
  type AccountPositionUpdate,
  type AlertEventMessage,
  type BigTradeMessage,
  type ChartEventType,
  type FootprintUpdateMessage,
  type FvgSignalUpdateMessage,
  type TduSignalUpdateMessage,
  type TradingAccount,
  type TradingOrder,
  type TradingPosition,
  type PnlPerPriceUnit,
  type Timeframe,
} from "./socket/messages";
import type { ChartProfilePayload } from "./profiles/types";
import type {
  DeltaProfileData,
  DeltaProfileLoadState,
  DeltaProfileSource,
} from "./orderflow/deltaProfile";
import type {
  DrawingState,
  DrawingToolType,
  FixedRangeProfileMode,
} from "./chart/drawings/types";
import {
  displayOffsetForTimeframe,
  footprintEnabledForTimeframe,
  fixedRangeMsFromAnchors,
  tduSignalsEnabledForTimeframe,
} from "./chart/timeframeRange";
import {
  DEFAULT_TIMEZONE_OFFSET_MINUTES,
  normalizeTimezoneOffsetMinutes,
} from "./chart/timezone";
import { resolveEndpoints } from "./endpoints";
import {
  isWebPushSupported,
  subscribeBrowserWebPush,
  unsubscribeBrowserWebPush,
} from "./webPush";

import { AiScanPanel } from "./workspace/AiScanPanel";
import { ScanAiSparkleIcon } from "./chart/scanAi/ScanAiIcon";
import { ScanAiSettingsPopover } from "./chart/scanAi/ScanAiSettingsPopover";
import { loadScanSettings, saveScanSettings, scanSettingsScope, SCAN_SETTINGS_EVENT, type ScanSettings } from "./chart/scanAi/settings";
import { alreadyDrawn, prepareSuggestions, similarScanGeometry } from "./chart/scanAi/geometry";
import type {
  ScanAiDensity,
  ScanAiDepth,
  ScanAiGroup,
  ScanAiState,
  ScanAiStrength,
  ScanAiSuggestion,
} from "./chart/scanAi/types";
import { DEFAULT_INSTRUMENT } from "./workspace/instruments";
import { MiniChartPanel } from "./workspace/MiniChartPanel";
import { scanDrawing } from "./workspace/scanDrawing";
import { DEFAULT_THEME, applyWorkspaceTheme, resolveWorkspaceTheme } from "./workspace/themes";
import type { WorkspacePanel, WorkspacePanelType } from "./workspace/types";
import { chartPanel, MAIN_CHART, useWorkspaces } from "./workspace/useWorkspaces";
import { PANEL_NAMES, WorkspaceBoard } from "./workspace/WorkspaceBoard";
import { WorkspaceToolbar } from "./workspace/WorkspaceToolbar";
import { WidgetFrame } from "./workspace/WidgetFrame";
import { WidgetLinkMenu } from "./workspace/WidgetLinkMenu";
import { canLinkPanel } from "./workspace/syncSettings";
import { useWorkspaceSync } from "./workspace/useWorkspaceSync";
import { normalizeDenseOverlayBarSpacing } from "./chart/zoomVisibility";

export { resolveEndpoints } from "./endpoints";

const SYMBOL = "GC";
export const CHART_CONTRACT = SYMBOL;
const DEFAULT_PROFILE_ID = "default";
const ACTIVE_PROFILE_STORAGE_KEY = "gc-chart-platform.active-profile";
const DENSE_OVERLAY_SPACING_STORAGE_KEY = "gc-chart-platform.dense-overlay-spacing";
const PROFILE_HOT_SNAPSHOT_STORAGE_KEY = "gc-chart-platform.profile-hot-snapshot";
const PROFILE_HOT_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1_000;
const LEGACY_DEFAULT_CHART_BACKGROUNDS = new Set(["#101010", "#d3d3d3"]);
const SOCKET_IDLE_TIMEOUT_MS = 45_000;
const SOCKET_TRANSITION_TIMEOUT_MS = 10_000;
const PROFILE_TIMEFRAMES = new Set(TIMEFRAMES);

function normalizeChartBackgroundColor(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_CHART_BACKGROUND;
  }
  return LEGACY_DEFAULT_CHART_BACKGROUNDS.has(value.trim().toLowerCase())
    ? DEFAULT_CHART_BACKGROUND
    : value;
}

const TIMEFRAME_RANK: Record<Timeframe, number> = {
  "15s": 0.25,
  "30s": 0.5,
  "1m": 1,
  "3m": 3,
  "5m": 5,
  "15m": 15,
  "30m": 30,
  "1h": 60,
  "4h": 240,
  "1D": 1440,
  "1W": 10080,
  "1M": 44640,
};
export const GLOBAL_SUBSCRIBED_EVENTS: ChartEventType[] = [
  "quote_update",
  "alert_event",
  "order_update",
  "account_update",
];
export const BIG_TRADE_SUBSCRIBED_EVENTS: ChartEventType[] = ["big_trade"];
export const TIMEFRAME_SUBSCRIBED_EVENTS: ChartEventType[] = [
  "bar_update",
  "volume_delta_update",
  "fvg_signal_update",
  "tdu_signal_update",
];
export const FOOTPRINT_SUBSCRIBED_EVENTS: ChartEventType[] = [
  "footprint_update",
];
const EMPTY_BARS: readonly Bar[] = [];
const EMPTY_VOLUME_DELTA: readonly VolumeDeltaDatum[] = [];
const EMPTY_BIG_TRADES: readonly BigTradeMarker[] = [];
const EMPTY_SMC_AI_SIGNALS: readonly SmcAiSignalMarker[] = [];
const EMPTY_ALERT_SIGNAL_MARKERS: readonly AlertSignalMarker[] = [];
const EMPTY_ALERT_LINES: readonly AlertLine[] = [];
const EMPTY_ORDER_LINES: readonly OrderLine[] = [];
const EMPTY_ORDER_CONTROLS: readonly OrderControl[] = [];
const EMPTY_FOOTPRINT_BARS: ReadonlyMap<number, FootprintBar> = new Map();
const EMPTY_FVG_SIGNALS: ReadonlyMap<number, FvgSignalUpdateMessage> = new Map();
const EMPTY_TDU_SIGNALS: ReadonlyMap<number, TduSignalUpdateMessage> = new Map();
const SUB_MINUTE_HISTORY_FALLBACK_TF: Timeframe = "1m";
const DEFERRED_INDICATOR_LOAD_MS = 75;
const DEFERRED_OVERLAY_LOAD_MS = 250;
const REALTIME_OVERLAY_CATCH_UP_MS = 10_000;
const FVG_GRADER_CATCH_UP_MS = 30_000;
const RESUME_REFRESH_THROTTLE_MS = 2_000;
const DEFAULT_INITIAL_HISTORY_LIMIT = 5_000;
const M1_INITIAL_HISTORY_DAYS = 3;
const M1_INITIAL_HISTORY_LIMIT = M1_INITIAL_HISTORY_DAYS * 24 * 60;
const M1_HISTORY_WINDOW_MS = M1_INITIAL_HISTORY_DAYS * 24 * 60 * 60 * 1_000;
const DEFAULT_HISTORY_BACKFILL_LIMIT = 5_000;
const M1_HISTORY_BACKFILL_LIMIT = 24 * 60;
const INITIAL_VOLUME_DELTA_LIMIT = 2_000;
// Keep enough raw markers for session-volume filtering and the chart primitive
// to render up to its 500-marker display budget.
const INITIAL_BIG_TRADE_LIMIT = 500;
const DRAWINGS_AUTOSAVE_DELAY_MS = 90_000;
const VOLUME_PROFILE_ROW_TICKS = 1;
const DELTA_PROFILE_ROW_TICKS = 2;
const DELTA_PROFILE_VALUE_AREA_PCT = 68;
const DELTA_PROFILE_REFRESH_DELAY_MS = 1_000;
const ORDER_REFRESH_INTERVAL_MS = 1_000;
const ENABLE_REALTIME_FOOTPRINT_UPDATES = true;
// Match the chart/canvas cadence so a backend burst cannot force an extra
// React render halfway between two visible frames.
const REALTIME_RENDER_BATCH_MS = 100;
const MAX_RETAINED_BIG_TRADE_MARKERS = INITIAL_BIG_TRADE_LIMIT;
const MAX_RETAINED_LIVE_FOOTPRINT_BARS = XKONTROL_HISTORY_BARS;
const BAR_REPLAY_HISTORY_LIMIT = 5_000;

interface BarReplayDataset {
  id: string;
  seriesKey: string;
  bars: readonly Bar[];
  barsTimeframe: Timeframe;
  volumeDelta: readonly VolumeDeltaDatum[];
  footprintBars: ReadonlyMap<number, FootprintBar>;
  fvgSignals: ReadonlyMap<number, FvgSignalUpdateMessage>;
  bigTrades: readonly BigTradeMarker[];
  smcAiSignals: readonly SmcAiSignalMarker[];
  alertSignals: readonly AlertSignalMarker[];
}
const BIG_TRADE_SOUND_COOLDOWN_MS = 250;
const MARKET_ORDER_SETTINGS_STORAGE_KEY = "gc-chart-platform.market-order-settings";
const DEFAULT_MARKET_ORDER_SETTINGS: MarketOrderSettings = {
  volumeLots: 0.1,
  slDistanceGc: 3,
  tpDistanceGc: 6,
  takeProfit1rEnabled: true,
  autoSupertrendAfter1rEnabled: false,
  sizingMode: "lots",
  riskAmount: 100,
};
const EMPTY_MT5_OPEN_TRADES: Mt5OpenTrades = { positions: [], orders: [] };

/** Play a short beep via the Web Audio API when a big trade arrives. */
function playBigTradeSound(): void {
  try {
    const Ctx =
      (globalThis as { AudioContext?: typeof AudioContext }).AudioContext ??
      (globalThis as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (Ctx === undefined) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 660;
    gain.gain.value = 0.3;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // ignore â€” sound is a non-critical enhancement
  }
}

export interface ChartLimitOrderDraft {
  source: "chart_bracket";
  side: "buy" | "sell";
  kind: "limit";
  volumeLots: number;
  entryGc: number;
  referenceGc: number;
  slGc: number;
  tpGc: number;
  gcAnchored: true;
  takeProfit1rEnabled: boolean;
  autoSupertrendAfter1rEnabled: boolean;
}

export interface ChartMenuState {
  price: number;
  x: number;
  y: number;
  openedAt?: number;
  referencePrice?: number;
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function seriesDataKey(
  symbol: string,
  contract: string,
  timeframe: Timeframe,
): string {
  return `${symbol}\u0000${contract}\u0000${timeframe}`;
}

/** Alert types that carry a numeric price `level` to draw on the chart (Req 16.5). */
const LEVEL_ALERT_TYPES = new Set<Alert["type"]>([
  "price_crosses_level",
  "bar_closes_above",
  "bar_closes_below",
]);

/** Short axis label per level-based alert type. */
const ALERT_LINE_TITLES: Record<string, string> = {
  price_crosses_level: "\u25B6",
  bar_closes_above: "close >",
  bar_closes_below: "close <",
};

const MGANN_SWEEP_ALERT_TYPES = new Set<Alert["type"]>([
  "mgann_break_ls",
  "mgann_sweep",
  "mgann_big_trade_sweep",
]);

/** Map configured alerts to the price lines the chart should draw. */
function toAlertLines(alerts: readonly Alert[]): AlertLine[] {
  const lines: AlertLine[] = [];
  for (const alert of alerts) {
    if (alert.symbol !== SYMBOL || !LEVEL_ALERT_TYPES.has(alert.type)) continue;
    const level = Number(alert.params.level);
    if (!Number.isFinite(level)) continue;
    lines.push({
      id: alert.id,
      price: level,
      title: ALERT_LINE_TITLES[alert.type] ?? "alert",
      enabled: alert.enabled,
    });
  }
  return lines;
}

/** Keep the default M1 chart to roughly three calendar days of minute bars. */
export function initialHistoryWindow(
  timeframe: Timeframe,
  nowMs = Date.now(),
): { from?: number; to?: number; limit: number } {
  if (timeframe !== "1m") {
    return { limit: DEFAULT_INITIAL_HISTORY_LIMIT };
  }
  return {
    from: nowMs - M1_HISTORY_WINDOW_MS,
    to: nowMs,
    limit: M1_INITIAL_HISTORY_LIMIT,
  };
}

/** Load older M1 history one day at a time after the user reaches the left edge. */
export function historyBackfillLimit(timeframe: Timeframe): number {
  return timeframe === "1m"
    ? M1_HISTORY_BACKFILL_LIMIT
    : DEFAULT_HISTORY_BACKFILL_LIMIT;
}

function alertEventToSignalMarker(
  event: AlertEventMessage,
): AlertSignalMarker | undefined {
  if (!MGANN_SWEEP_ALERT_TYPES.has(event.alertType as Alert["type"])) {
    return undefined;
  }
  if (event.direction !== 1 && event.direction !== -1) {
    return undefined;
  }
  const direction = event.direction;
  return {
    id: `${event.alertId}:${event.time}:${direction}`,
    time: event.time,
    price: event.price,
    direction,
    text: direction > 0 ? "Break L" : "Break S",
  };
}

function alertSignalRowToMarker(
  row: AlertSignalRestRow,
): AlertSignalMarker | undefined {
  if (row.direction !== 1 && row.direction !== -1) {
    return undefined;
  }
  const direction = row.direction;
  return {
    id: row.id,
    time: row.time,
    price: row.price,
    direction,
    text: row.text ?? (direction > 0 ? "Break L" : "Break S"),
  };
}

function alertSignalMarkerKey(marker: AlertSignalMarker): string {
  return `${marker.time}:${marker.direction}`;
}

function mergeAlertSignalMarker<T extends AlertSignalMarker>(
  current: readonly T[],
  marker: T,
): readonly T[] {
  const key = alertSignalMarkerKey(marker);
  let replaced = false;
  const next = current.map((item) => {
    if (alertSignalMarkerKey(item) !== key) return item;
    replaced = true;
    return item.id.includes(":hist:") && !marker.id.includes(":hist:")
      ? marker
      : item;
  });
  if (!replaced) {
    next.push(marker);
  }
  return next.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
}

function replaceHistoricalAlertSignalMarkers(
  current: readonly AlertSignalMarker[],
  historical: readonly AlertSignalMarker[],
): readonly AlertSignalMarker[] {
  const byKey = new Map<string, AlertSignalMarker>();
  for (const marker of current) {
    if (!marker.id.includes(":hist:")) {
      byKey.set(alertSignalMarkerKey(marker), marker);
    }
  }
  for (const marker of historical) {
    const key = alertSignalMarkerKey(marker);
    if (!byKey.has(key)) {
      byKey.set(key, marker);
    }
  }
  return Array.from(byKey.values()).sort(
    (a, b) => a.time - b.time || a.id.localeCompare(b.id),
  );
}

export function mergeMt5AccountUpdate(
  current: Mt5Account | undefined,
  update: TradingAccount,
): Mt5Account | undefined {
  if (current === undefined || current.accountId !== update.accountId) {
    return current;
  }
  const floatingPnl =
    typeof update.equity === "number" && typeof update.balance === "number"
      ? update.equity - update.balance
      : current.floatingPnl;
  const next = {
    ...current,
    tradeMode: update.tradeMode,
    balance: update.balance,
    equity: update.equity,
    freeMargin: update.freeMargin,
    floatingPnl,
  };
  return mt5AccountsEqual(current, next) ? current : next;
}

export function mergeMt5OpenTradeProfitUpdates(
  current: Mt5OpenTrades,
  updates: readonly AccountPositionUpdate[] | undefined,
): Mt5OpenTrades {
  if (updates === undefined) return current;
  const byTicket = new Map(
    updates.map((update) => [update.brokerPositionTicket, update]),
  );
  let changed = false;
  const positions = current.positions
    .filter((position) => {
      const keep = byTicket.has(position.brokerPositionTicket);
      if (!keep) changed = true;
      return keep;
    })
    .map((position) => {
      const update = byTicket.get(position.brokerPositionTicket);
      if (!update) return position;
      const profit =
        typeof update.profit === "number" && Number.isFinite(update.profit)
          ? update.profit
          : position.profit;
      const next = {
        ...position,
        profit,
        updatedAt: update.updatedAt,
      };
      if (
        next.profit === position.profit &&
        next.updatedAt === position.updatedAt
      ) {
        return position;
      }
      changed = true;
      return next;
    });
  return changed ? { ...current, positions } : current;
}

export function mt5AccountsEqual(
  left: Mt5Account | undefined,
  right: Mt5Account | undefined,
): boolean {
  return (
    left?.accountId === right?.accountId &&
    left?.login === right?.login &&
    left?.server === right?.server &&
    left?.symbolBroker === right?.symbolBroker &&
    left?.tradeMode === right?.tradeMode &&
    left?.currency === right?.currency &&
    left?.balance === right?.balance &&
    left?.equity === right?.equity &&
    left?.margin === right?.margin &&
    left?.freeMargin === right?.freeMargin &&
    left?.floatingPnl === right?.floatingPnl &&
    left?.accountStateAt === right?.accountStateAt &&
    left?.accountStateStale === right?.accountStateStale &&
    left?.connected === right?.connected &&
    left?.error === right?.error &&
    JSON.stringify(left?.uncertainActions) === JSON.stringify(right?.uncertainActions)
  );
}

const OPEN_ORDER_STATUSES = new Set<TradingOrder["status"]>([
  "pending_submit",
  "submitted",
  "working",
  "filled",
  "sync_paused",
  "sync_error",
]);

function isFinitePrice(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isOpenTradingOrder(order: TradingOrder): boolean {
  return OPEN_ORDER_STATUSES.has(order.status);
}

function rejectedOrderMessage(order: TradingOrder): string {
  if (order.status !== "rejected") return "";
  return order.rejectReason ?? "Broker rejected order";
}

function roundGcPrice(price: number): number {
  return Math.round(price * 10) / 10;
}

export function buildChartLimitOrderDraft(input: {
  entryPrice: number;
  referencePrice: number | undefined;
  settings: MarketOrderSettings;
  symbol?: Mt5Symbol;
  accountCurrency?: string;
}): ChartLimitOrderDraft | undefined {
  const referencePrice = input.referencePrice;
  if (
    !Number.isFinite(input.entryPrice) ||
    typeof referencePrice !== "number" ||
    !Number.isFinite(referencePrice)
  ) {
    return undefined;
  }
  const settings = sanitizeMarketOrderSettings(input.settings);
  const entryGc = roundGcPrice(input.entryPrice);
  const referenceGc = roundGcPrice(referencePrice);
  if (entryGc === referenceGc) return undefined;
  const side: "buy" | "sell" = entryGc < referenceGc ? "buy" : "sell";
  const slGc =
    side === "buy"
      ? roundGcPrice(entryGc - settings.slDistanceGc)
      : roundGcPrice(entryGc + settings.slDistanceGc);
  const tpGc =
    side === "buy"
      ? roundGcPrice(entryGc + settings.tpDistanceGc)
      : roundGcPrice(entryGc - settings.tpDistanceGc);
  const volumeLots = resolveOrderVolumeLots({
    settings,
    entryGc,
    slGc,
    symbol: input.symbol,
    accountCurrency: input.accountCurrency,
  });
  if (volumeLots === undefined) return undefined;
  return {
    source: "chart_bracket",
    side,
    kind: "limit",
    volumeLots,
    entryGc,
    referenceGc,
    slGc,
    tpGc,
    gcAnchored: true,
    takeProfit1rEnabled: settings.takeProfit1rEnabled,
    autoSupertrendAfter1rEnabled:
      settings.takeProfit1rEnabled && settings.autoSupertrendAfter1rEnabled,
  };
}

function sanitizeMarketOrderSettings(
  value: Partial<MarketOrderSettings> | null | undefined,
): MarketOrderSettings {
  const volumeLots = Number(value?.volumeLots);
  const slDistanceGc = Number(value?.slDistanceGc);
  const tpDistanceGc = Number(value?.tpDistanceGc);
  const riskAmount = Number(value?.riskAmount);
  return {
    volumeLots: Number.isFinite(volumeLots)
      ? Math.max(0.01, Math.round(volumeLots * 100) / 100)
      : DEFAULT_MARKET_ORDER_SETTINGS.volumeLots,
    slDistanceGc: Number.isFinite(slDistanceGc)
      ? Math.max(0.1, roundGcPrice(slDistanceGc))
      : DEFAULT_MARKET_ORDER_SETTINGS.slDistanceGc,
    tpDistanceGc: Number.isFinite(tpDistanceGc)
      ? Math.max(0.1, roundGcPrice(tpDistanceGc))
      : DEFAULT_MARKET_ORDER_SETTINGS.tpDistanceGc,
    takeProfit1rEnabled:
      value?.takeProfit1rEnabled === undefined
        ? DEFAULT_MARKET_ORDER_SETTINGS.takeProfit1rEnabled
        : value.takeProfit1rEnabled === true,
    autoSupertrendAfter1rEnabled: value?.autoSupertrendAfter1rEnabled === true,
    sizingMode: value?.sizingMode === "risk" ? "risk" : "lots",
    riskAmount: Number.isFinite(riskAmount)
      ? Math.max(1, Math.round(riskAmount * 100) / 100)
      : DEFAULT_MARKET_ORDER_SETTINGS.riskAmount,
  };
}

export function calculateRiskBasedLots(input: {
  riskAmount: number;
  entryGc: number;
  stopGc: number;
  symbol?: Mt5Symbol;
  accountCurrency?: string;
}): number | undefined {
  if (
    !Number.isFinite(input.riskAmount) ||
    input.riskAmount <= 0 ||
    !Number.isFinite(input.entryGc) ||
    !Number.isFinite(input.stopGc) ||
    input.symbol === undefined
  ) {
    return undefined;
  }

  const { tickSize, pipValue: tickValue, minLot, maxLot, lotStep } = input.symbol;
  if (
    !Number.isFinite(tickSize) ||
    tickSize <= 0 ||
    !Number.isFinite(tickValue) ||
    tickValue <= 0 ||
    !Number.isFinite(minLot) ||
    minLot <= 0 ||
    !Number.isFinite(maxLot) ||
    maxLot < minLot ||
    !Number.isFinite(lotStep) ||
    lotStep <= 0
  ) {
    return undefined;
  }
  const stopDistance = Math.abs(input.entryGc - input.stopGc);
  if (stopDistance <= 0) return undefined;
  const riskPerLot = (stopDistance / tickSize) * tickValue;
  if (!Number.isFinite(riskPerLot) || riskPerLot <= 0) return undefined;

  // Risk and the broker's tick value both use account currency, including USC.
  const rawLots = input.riskAmount / riskPerLot;
  if (!Number.isFinite(rawLots) || rawLots <= 0) return undefined;

  // Floor to the broker's step so the rounded size does not exceed the target risk.
  const steppedLots = Math.floor((rawLots + lotStep * 1e-9) / lotStep) * lotStep;
  // Do not force the broker minimum if it would exceed the user's risk budget.
  if (steppedLots < minLot - lotStep * 1e-9) return undefined;
  const boundedLots = Math.min(maxLot, Math.max(minLot, steppedLots));
  return Number(boundedLots.toFixed(8));
}

export function resolveOrderVolumeLots(input: {
  settings: MarketOrderSettings;
  entryGc: number;
  slGc: number;
  symbol?: Mt5Symbol;
  accountCurrency?: string;
}): number | undefined {
  const settings = sanitizeMarketOrderSettings(input.settings);
  if (settings.sizingMode !== "risk") return settings.volumeLots;
  if (input.symbol === undefined) return undefined;
  return calculateRiskBasedLots({
    riskAmount: settings.riskAmount ?? DEFAULT_MARKET_ORDER_SETTINGS.riskAmount ?? 100,
    entryGc: input.entryGc,
    stopGc: input.slGc,
    symbol: input.symbol,
    accountCurrency: input.accountCurrency,
  });
}

function supertrendAfter1rOrderFields(
  enabled: boolean,
  timeframe: Timeframe,
  settings: SupertrendSettings,
) {
  const normalized = normalizeSupertrendSettings(settings);
  return {
    autoSupertrendAfter1rEnabled: enabled,
    ...(enabled
      ? {
          trailingTimeframe: timeframe,
          trailingPeriod: normalized.period,
          trailingMultiplier: normalized.multiplier,
          trailingAtrMethod: normalized.atrMethod,
          trailingSource: normalized.source,
        }
      : {}),
  };
}

function readMarketOrderSettings(
  storage: Pick<Storage, "getItem"> | undefined = browserStorage(),
): MarketOrderSettings {
  try {
    const raw = storage?.getItem(MARKET_ORDER_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_MARKET_ORDER_SETTINGS;
    return sanitizeMarketOrderSettings(JSON.parse(raw) as Partial<MarketOrderSettings>);
  } catch {
    return DEFAULT_MARKET_ORDER_SETTINGS;
  }
}

function persistMarketOrderSettings(
  settings: MarketOrderSettings,
  storage: Pick<Storage, "setItem"> | undefined = browserStorage(),
): void {
  try {
    storage?.setItem(
      MARKET_ORDER_SETTINGS_STORAGE_KEY,
      JSON.stringify(sanitizeMarketOrderSettings(settings)),
    );
  } catch {
    /* Trading settings still work for the current session. */
  }
}

function orderLineId(orderId: string, field: OrderLineField): string {
  return `${orderId}:${field}`;
}

function parseOrderLineId(id: string):
  | { orderId: string; field: OrderLineField }
  | undefined {
  const index = id.lastIndexOf(":");
  if (index <= 0) return undefined;
  const field = id.slice(index + 1);
  if (field !== "entryGc" && field !== "slGc" && field !== "tpGc") {
    return undefined;
  }
  return { orderId: id.slice(0, index), field };
}

function toOrderLines(
  orders: readonly TradingOrder[],
  modifyingIds?: ReadonlySet<string>,
): OrderLine[] {
  const lines: OrderLine[] = [];
  for (const order of orders) {
    if (
      order.symbolInternal !== SYMBOL ||
      !isOpenTradingOrder(order)
    ) {
      continue;
    }
    const entry = orderEntryGc(order);
    const sideTitle = order.side.toUpperCase();
    const hasBrokerPosition = order.brokerPositionTicket != null;
    const isModifying =
      order.basisStale || order.actionPending ||
      modifyingIds?.has(order.id) ||
      modifyingIds?.has(appOrderRowKey(order.id));
    if (isFinitePrice(entry)) {
      lines.push({
        id: orderLineId(order.id, "entryGc"),
        orderId: order.id,
        field: "entryGc",
        price: entry,
        side: order.side,
        status: order.status,
        editable: !hasBrokerPosition && order.status !== "filled" && !isModifying,
        title: `${sideTitle} ${hasBrokerPosition || order.status === "filled" ? "fill" : order.kind}`,
      });
    }
    if (isFinitePrice(order.slGc)) {
      lines.push({
        id: orderLineId(order.id, "slGc"),
        orderId: order.id,
        field: "slGc",
        price: order.slGc,
        side: order.side,
        status: order.status,
        title: "SL",
        editable: !isModifying,
      });
    }
    if (isFinitePrice(order.tpGc)) {
      lines.push({
        id: orderLineId(order.id, "tpGc"),
        orderId: order.id,
        field: "tpGc",
        price: order.tpGc,
        side: order.side,
        status: order.status,
        title: "TP",
        editable: !isModifying,
      });
    }
  }
  return lines;
}

function orderEntryGc(order: TradingOrder): number | undefined {
  const price =
    order.status === "filled" || order.status === "sync_error"
      ? order.fillPriceGcEstimate ?? order.entryGc
      : order.entryGc ?? order.fillPriceGcEstimate;
  return isFinitePrice(price) ? price : undefined;
}

function estimateOrderPnl(
  order: TradingOrder,
  currentPrice: number | undefined,
  symbol: Mt5Symbol | undefined,
): number | undefined {
  if (order.status !== "filled" && order.brokerPositionTicket == null) {
    return undefined;
  }
  const entry = orderEntryGc(order);
  if (entry === undefined || currentPrice === undefined) return undefined;
  const direction = order.side === "buy" ? 1 : -1;
  const tickSize = symbol?.tickSize && symbol.tickSize > 0 ? symbol.tickSize : 0.01;
  const tickValue = symbol?.pipValue && symbol.pipValue > 0 ? symbol.pipValue : 1;
  return ((currentPrice - entry) * direction / tickSize) * tickValue * order.volumeLots;
}

function estimatePnlAtPrice(input: {
  side: "buy" | "sell";
  volumeLots: number;
  entryGc: number | undefined;
  exitGc: number | undefined;
  symbol: Mt5Symbol | undefined;
}): number | undefined {
  if (input.entryGc === undefined || input.exitGc === undefined) return undefined;
  const tickSize =
    input.symbol?.tickSize && input.symbol.tickSize > 0
      ? input.symbol.tickSize
      : 0.01;
  const tickValue =
    input.symbol?.pipValue && input.symbol.pipValue > 0
      ? input.symbol.pipValue
      : 1;
  const direction = input.side === "buy" ? 1 : -1;
  return (
    ((input.exitGc - input.entryGc) * direction) /
    tickSize *
    tickValue *
    input.volumeLots
  );
}

function formatPnl(value: number | undefined): string | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  const sign = value > 0 ? "+" : "";
  return `${sign}$${value.toFixed(2)}`;
}

export function formatProfit(
  value: number | undefined | null,
  currency?: string,
  stale?: boolean,
): string | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  const sign = value > 0 ? "+" : "";
  const absFormatted = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const prefix = value < 0 ? "-" : sign;
  const cur = currency?.trim().toUpperCase();
  let text = "";
  if (cur === "USC") {
    text = `${prefix}${absFormatted} USC`;
  } else if (cur === "USD" || cur === "$") {
    text = `${prefix}$${absFormatted}`;
  } else if (cur) {
    text = `${prefix}${absFormatted} ${cur}`;
  } else {
    text = `${prefix}$${absFormatted}`;
  }
  return stale ? `${text} (stale)` : text;
}

function mt5PositionKey(ticket: BrokerTicket): string {
  return `mt5pos:${ticket}`;
}

function mt5OrderKey(ticket: BrokerTicket): string {
  return `mt5order:${ticket}`;
}

function appOrderRowKey(orderId: string): string {
  return `app:${orderId}`;
}

function supertrendTrailingRowKey(trailing: SupertrendTrailing): string {
  return trailing.targetType === "order"
    ? appOrderRowKey(trailing.targetId)
    : mt5PositionKey(trailing.targetId);
}

function supertrendTrailingMap(
  trailings: readonly SupertrendTrailing[],
): ReadonlyMap<string, SupertrendTrailing> {
  return new Map(trailings.map((trailing) => [supertrendTrailingRowKey(trailing), trailing]));
}

export function hasLiveSupertrendTrailing(
  trailings: ReadonlyMap<string, SupertrendTrailing>,
  positions: readonly TradingPosition[],
): boolean {
  if (trailings.size === 0 || positions.length === 0) return false;
  const openPositionTickets = new Set(
    positions.map((position) => position.brokerPositionTicket),
  );
  return [...trailings.values()].some((trailing) =>
    openPositionTickets.has(trailing.brokerPositionTicket),
  );
}

export function supertrendTrailingActivationError(
  side: "buy" | "sell",
  price: number | undefined,
  chartBars: readonly Bar[],
  settings: SupertrendSettings,
): string | undefined {
  if (!isFinitePrice(price) || chartBars.length === 0) {
    return "Cannot enable Trailing: current SuperTrend data is unavailable.";
  }
  const points = calculateSupertrend(chartBars, settings).points;
  const point = points[points.length - 1];
  if (!point) {
    return "Cannot enable Trailing: current SuperTrend data is unavailable.";
  }
  if (side === "buy") {
    if (point.trend !== 1 || point.up === undefined || price <= point.up) {
      return "Cannot enable BUY Trailing: price must be above the green SuperTrend line.";
    }
    return undefined;
  }
  if (point.trend !== -1 || point.down === undefined || price >= point.down) {
    return "Cannot enable SELL Trailing: price must be below the red SuperTrend line.";
  }
  return undefined;
}

function parseActionRowId(id: string):
  | { source: "app"; orderId: string }
  | { source: "mt5pos"; ticket: string }
  | { source: "mt5order"; ticket: string }
  | undefined {
  if (id.startsWith("app:")) {
    const orderId = id.slice("app:".length);
    return orderId ? { source: "app", orderId } : undefined;
  }
  if (id.startsWith("mt5pos:")) {
    const ticket = id.slice("mt5pos:".length);
    return /^[0-9]{1,20}$/.test(ticket) ? { source: "mt5pos", ticket } : undefined;
  }
  if (id.startsWith("mt5order:")) {
    const ticket = id.slice("mt5order:".length);
    return /^[0-9]{1,20}$/.test(ticket) ? { source: "mt5order", ticket } : undefined;
  }
  return undefined;
}

function appBrokerPositionTickets(orders: readonly TradingOrder[]): Set<BrokerTicket> {
  return new Set(
    orders
      .map((order) => order.brokerPositionTicket)
      .filter((ticket): ticket is BrokerTicket => ticket != null),
  );
}

function appBrokerOrderTickets(orders: readonly TradingOrder[]): Set<BrokerTicket> {
  return new Set(
    orders
      .map((order) => order.brokerOrderTicket)
      .filter((ticket): ticket is BrokerTicket => ticket != null),
  );
}

function manualPositionLines(
  positions: readonly TradingPosition[],
  appOrders: readonly TradingOrder[],
  modifyingIds?: ReadonlySet<string>,
): OrderLine[] {
  const appTickets = appBrokerPositionTickets(appOrders);
  const lines: OrderLine[] = [];
  for (const position of positions) {
    if (appTickets.has(position.brokerPositionTicket)) continue;
    const orderId = mt5PositionKey(position.brokerPositionTicket);
    const ticketStr = String(position.brokerPositionTicket);
    const isModifying = position.actionPending || modifyingIds?.has(orderId) || modifyingIds?.has(ticketStr);
    const entry = position.entryGcEstimate;
    if (isFinitePrice(entry)) {
      lines.push({
        id: orderLineId(orderId, "entryGc"),
        orderId,
        field: "entryGc",
        price: entry,
        side: position.side,
        status: "filled",
        title: `${position.side.toUpperCase()} manual`,
        editable: false,
      });
    }
    if (isFinitePrice(position.slGc)) {
      lines.push({
        id: orderLineId(orderId, "slGc"),
        orderId,
        field: "slGc",
        price: position.slGc,
        side: position.side,
        status: "filled",
        title: "SL",
        editable: position.basisStale !== true && !isModifying,
      });
    }
    if (isFinitePrice(position.tpGc)) {
      lines.push({
        id: orderLineId(orderId, "tpGc"),
        orderId,
        field: "tpGc",
        price: position.tpGc,
        side: position.side,
        status: "filled",
        title: "TP",
        editable: position.basisStale !== true && !isModifying,
      });
    }
  }
  return lines;
}

function manualPendingOrderLines(
  pendingOrders: readonly Mt5PendingOrder[],
  appOrders: readonly TradingOrder[],
  modifyingIds?: ReadonlySet<string>,
): OrderLine[] {
  const appTickets = appBrokerOrderTickets(appOrders);
  const lines: OrderLine[] = [];
  for (const pending of pendingOrders) {
    if (appTickets.has(pending.brokerOrderTicket)) continue;
    const orderId = mt5OrderKey(pending.brokerOrderTicket);
    const ticketStr = String(pending.brokerOrderTicket);
    const isModifying = pending.actionPending || modifyingIds?.has(orderId) || modifyingIds?.has(ticketStr);
    if (isFinitePrice(pending.entryGc)) {
      lines.push({
        id: orderLineId(orderId, "entryGc"),
        orderId,
        field: "entryGc",
        price: pending.entryGc,
        side: pending.side,
        status: "working",
        title: `${pending.side.toUpperCase()} ${pending.kind}`,
        editable: pending.basisStale !== true && !isModifying,
      });
    }
    if (isFinitePrice(pending.slGc)) {
      lines.push({
        id: orderLineId(orderId, "slGc"),
        orderId,
        field: "slGc",
        price: pending.slGc,
        side: pending.side,
        status: "working",
        title: "SL",
        editable: pending.basisStale !== true && !isModifying,
      });
    }
    if (isFinitePrice(pending.tpGc)) {
      lines.push({
        id: orderLineId(orderId, "tpGc"),
        orderId,
        field: "tpGc",
        price: pending.tpGc,
        side: pending.side,
        status: "working",
        title: "TP",
        editable: pending.basisStale !== true && !isModifying,
      });
    }
  }
  return lines;
}

function toMarketOrderRows(
  orders: readonly TradingOrder[],
  currentPrice: number | undefined,
  symbol: Mt5Symbol | undefined,
  mt5OpenTrades: Mt5OpenTrades,
  closingIds: ReadonlySet<string>,
  cancellingIds: ReadonlySet<string>,
  breakingEvenIds: ReadonlySet<string>,
  supertrendTrailings: ReadonlyMap<string, SupertrendTrailing>,
  supertrendTrailingPendingIds: ReadonlySet<string>,
  account?: Mt5Account,
  modifyingIds: ReadonlySet<string> = new Set(),
  closing50Ids: ReadonlySet<string> = new Set(),
): MarketOrderRow[] {
  const isExness = account?.provider === "exness" || account !== undefined;
  const rows: MarketOrderRow[] = [];
  const brokerPositionsByTicket = new Map(
    mt5OpenTrades.positions.map((position) => [
      position.brokerPositionTicket,
      position,
    ]),
  );
  for (const order of orders) {
    if (order.symbolInternal !== SYMBOL || !isOpenTradingOrder(order)) continue;
    const entry = order.entryBroker ?? undefined;
    if (entry === undefined) continue;
    const brokerPosition =
      order.brokerPositionTicket == null
        ? undefined
        : brokerPositionsByTicket.get(order.brokerPositionTicket);
    let pnl: number | undefined;
    let pnlText: string | undefined;
    if (isExness) {
      if (brokerPosition?.profit != null) {
        pnl = brokerPosition.profit;
        const cur = brokerPosition.profitCurrency || brokerPosition.currency || account?.currency;
        pnlText = formatProfit(pnl, cur, brokerPosition.profitStale);
      }
    } else {
      pnl = brokerPosition?.profit ?? estimateOrderPnl(order, currentPrice, symbol);
      pnlText = formatPnl(pnl);
    }
    const hasBrokerPosition = order.brokerPositionTicket != null;
    const status = hasBrokerPosition || order.status === "filled" ? "fill" : order.status === "working" ? order.kind : order.status;
    const rowId = appOrderRowKey(order.id);
    const ticketStr = order.brokerPositionTicket != null ? String(order.brokerPositionTicket) : undefined;
    const trailing = supertrendTrailings.get(rowId);
    const hasPendingAction =
      order.actionPending ||
      (order.status !== "working" && !hasBrokerPosition) ||
      Boolean((order as { pendingAction?: unknown }).pendingAction) ||
      Boolean((brokerPosition as { pendingAction?: unknown })?.pendingAction);
    const isBePending =
      breakingEvenIds.has(rowId) ||
      breakingEvenIds.has(order.id) ||
      (ticketStr != null && breakingEvenIds.has(ticketStr));
    const isClose50Pending =
      closing50Ids.has(rowId) ||
      closing50Ids.has(order.id) ||
      (ticketStr != null && closing50Ids.has(ticketStr));
    const isClosePending =
      closingIds.has(order.id) ||
      closingIds.has(rowId) ||
      (ticketStr != null && closingIds.has(ticketStr));
    const isCancelPending =
      cancellingIds.has(order.id) ||
      cancellingIds.has(rowId);
    const isModifyPending =
      modifyingIds.has(order.id) ||
      modifyingIds.has(rowId) ||
      (ticketStr != null && modifyingIds.has(ticketStr));

    rows.push({
      id: rowId,
      side: order.side,
      title: `${order.side.toUpperCase()} ${status}`,
      detail: `${order.volumeLots.toFixed(2)} @ ${entry.toFixed(symbol?.digits ?? 3)}`,
      pnlText,
      pnlValue: pnl,
      volumeLots: order.volumeLots,
      action:
        hasBrokerPosition &&
        (order.status === "filled" || order.status === "sync_error")
          ? "close"
          : "cancel",
      canBreakEven: brokerPosition !== undefined,
      breakEvenPending: isBePending,
      close50Pending: isClose50Pending,
      canSupertrendTrail: hasBrokerPosition && order.source !== "auto_mgann",
      supertrendTrailing: trailing !== undefined,
      supertrendTrailingPending: supertrendTrailingPendingIds.has(rowId),
      supertrendTrailingTimeframe: trailing?.timeframe,
      pending:
        isClosePending ||
        isCancelPending ||
        isModifyPending ||
        isBePending ||
        isClose50Pending ||
        hasPendingAction,
    });
  }
  const appPositionTickets = appBrokerPositionTickets(orders);
  for (const position of mt5OpenTrades.positions) {
    if (appPositionTickets.has(position.brokerPositionTicket)) continue;
    const rowId = mt5PositionKey(position.brokerPositionTicket);
    const ticketStr = String(position.brokerPositionTicket);
    const trailing = supertrendTrailings.get(rowId);
    const cur = position.profitCurrency || position.currency || account?.currency;
    const pnl = position.profit != null ? position.profit : undefined;
    const pnlText = formatProfit(pnl, cur, position.profitStale);
    const hasPendingAction = position.actionPending || Boolean((position as { pendingAction?: unknown }).pendingAction);
    const isBePending =
      breakingEvenIds.has(rowId) ||
      breakingEvenIds.has(ticketStr);
    const isClose50Pending =
      closing50Ids.has(rowId) ||
      closing50Ids.has(ticketStr);
    const isClosePending =
      closingIds.has(rowId) ||
      closingIds.has(ticketStr);
    const isModifyPending =
      modifyingIds.has(rowId) ||
      modifyingIds.has(ticketStr);

    rows.push({
      id: rowId,
      side: position.side,
      title: `${position.side.toUpperCase()} manual`,
      detail: `${position.volumeLots.toFixed(2)} @ ${position.entryBroker.toFixed(symbol?.digits ?? 3)}`,
      pnlText,
      pnlValue: pnl,
      volumeLots: position.volumeLots,
      action: "close",
      canBreakEven: true,
      breakEvenPending: isBePending,
      close50Pending: isClose50Pending,
      canSupertrendTrail: true,
      supertrendTrailing: trailing !== undefined,
      supertrendTrailingPending: supertrendTrailingPendingIds.has(rowId),
      supertrendTrailingTimeframe: trailing?.timeframe,
      pending:
        isClosePending ||
        isModifyPending ||
        isBePending ||
        isClose50Pending ||
        hasPendingAction,
    });
  }
  const appOrderTickets = appBrokerOrderTickets(orders);
  for (const pending of mt5OpenTrades.orders) {
    if (appOrderTickets.has(pending.brokerOrderTicket)) continue;
    const rowId = mt5OrderKey(pending.brokerOrderTicket);
    const ticketStr = String(pending.brokerOrderTicket);
    rows.push({
      id: rowId,
      side: pending.side,
      title: `${pending.side.toUpperCase()} ${pending.kind}`,
      detail: `${pending.volumeLots.toFixed(2)} @ ${pending.entryBroker.toFixed(symbol?.digits ?? 3)}`,
      action: "cancel",
      volumeLots: pending.volumeLots,
      pending:
        pending.actionPending ||
        cancellingIds.has(rowId) ||
        cancellingIds.has(ticketStr) ||
        modifyingIds.has(rowId) ||
        modifyingIds.has(ticketStr),
    });
  }
  return rows;
}

function toOrderControls(
  orders: readonly TradingOrder[],
  currentPrice: number | undefined,
  symbol: Mt5Symbol | undefined,
  mt5OpenTrades: Mt5OpenTrades,
  closingIds: ReadonlySet<string>,
  cancellingIds: ReadonlySet<string>,
  account?: Mt5Account,
  modifyingIds: ReadonlySet<string> = new Set(),
): OrderControl[] {
  const isExness = account?.provider === "exness" || account !== undefined;
  const controls: OrderControl[] = [];
  const brokerPositionsByTicket = new Map(
    mt5OpenTrades.positions.map((position) => [
      position.brokerPositionTicket,
      position,
    ]),
  );

  const brokerOrdersByTicket = new Map(mt5OpenTrades.orders.map((order) => [order.brokerOrderTicket, order]));
  const pushBracketControls = (input: {
    actionId: string;
    orderId: string;
    side: "buy" | "sell";
    volumeLots: number;
    entry: number | undefined;
    sl: number | null | undefined;
    tp: number | null | undefined;
    pnlValue?: number;
    pnlPerPriceUnit?: PnlPerPriceUnit;
    pnlText?: string;
    canClose?: boolean;
    canCancel?: boolean;
    closing?: boolean;
    cancelling?: boolean;
  }) => {
    if (isFinitePrice(input.entry)) {
      controls.push({
        id: `${input.actionId}:entry`,
        orderId: input.orderId,
        actionId: input.actionId,
        level: "entry",
        price: input.entry,
        side: input.side,
        title: "ENTRY",
        detail: `${input.volumeLots.toFixed(2)} @ ${input.entry.toFixed(1)}`,
        pnlText: input.pnlText ?? formatPnl(input.pnlValue),
        pnlValue: input.pnlValue,
        canClose: input.canClose,
        canCancel: input.canCancel,
        closing: input.closing,
        cancelling: input.cancelling,
      });
    }
    for (const [level, price] of [["sl", input.sl], ["tp", input.tp]] as const) {
      if (!isFinitePrice(price)) continue;
      const rates = input.pnlPerPriceUnit;
      let pnlValue: number | undefined;
      let pnlText: string | undefined;
      if (isExness) {
        if (rates && isFinitePrice(input.entry)) {
          const move = (price - input.entry) * (input.side === "buy" ? 1 : -1);
          pnlValue = move * (move >= 0 ? rates.gain : rates.loss) * input.volumeLots;
          const sign = pnlValue >= 0.005 ? "+" : pnlValue <= -0.005 ? "-" : "";
          const unit = rates.currency === "USD" ? "$" : `${rates.currency} `;
          const amount = Math.abs(pnlValue).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          pnlText = `${sign}${unit}${amount}${rates.stale ? " (stale)" : ""}`;
        }
      } else {
        pnlValue = estimatePnlAtPrice({
          side: input.side,
          volumeLots: input.volumeLots,
          entryGc: input.entry,
          exitGc: price,
          symbol,
        });
        pnlText = formatPnl(pnlValue);
      }
      controls.push({
        id: `${input.actionId}:${level}`,
        orderId: input.orderId,
        actionId: input.actionId,
        level,
        price,
        side: input.side,
        title: level === "sl" ? "SL" : "TP",
        detail: price.toFixed(1),
        pnlText,
        pnlValue,
      });
    }
  };

  for (const order of orders) {
    if (order.symbolInternal !== SYMBOL || !isOpenTradingOrder(order)) continue;
    const entry = orderEntryGc(order);
    const brokerPosition =
      order.brokerPositionTicket == null
        ? undefined
        : brokerPositionsByTicket.get(order.brokerPositionTicket);
    const hasBrokerPosition = order.brokerPositionTicket != null;
    const actionId = appOrderRowKey(order.id);
    const brokerOrder = order.brokerOrderTicket == null ? undefined : brokerOrdersByTicket.get(order.brokerOrderTicket);
    let pnlValue: number | undefined;
    let pnlText: string | undefined;
    if (isExness) {
      if (brokerPosition?.profit != null) {
        pnlValue = brokerPosition.profit;
        const cur = brokerPosition.profitCurrency || brokerPosition.currency || account?.currency;
        pnlText = formatProfit(pnlValue, cur, brokerPosition.profitStale);
      }
    } else {
      pnlValue = brokerPosition?.profit ?? estimateOrderPnl(order, currentPrice, symbol);
      pnlText = formatPnl(pnlValue);
    }
    pushBracketControls({
      actionId,
      orderId: order.id,
      side: order.side,
      volumeLots: order.volumeLots,
      entry,
      sl: order.slGc,
      tp: order.tpGc,
      pnlPerPriceUnit: brokerPosition?.pnlPerPriceUnit ?? brokerOrder?.pnlPerPriceUnit,
      pnlValue,
      pnlText,
      canClose:
        hasBrokerPosition &&
        (order.status === "filled" || order.status === "sync_error"),
      canCancel:
        !hasBrokerPosition &&
        order.status !== "filled" &&
        order.status !== "sync_error",
      closing:
        order.actionPending ||
        closingIds.has(order.id) ||
        closingIds.has(actionId) ||
        modifyingIds.has(order.id) ||
        modifyingIds.has(actionId),
      cancelling:
        order.actionPending ||
        cancellingIds.has(order.id) ||
        cancellingIds.has(actionId) ||
        modifyingIds.has(order.id) ||
        modifyingIds.has(actionId),
    });
  }

  const appPositionTickets = appBrokerPositionTickets(orders);
  for (const position of mt5OpenTrades.positions) {
    if (appPositionTickets.has(position.brokerPositionTicket)) continue;
    const actionId = mt5PositionKey(position.brokerPositionTicket);
    const ticketStr = String(position.brokerPositionTicket);
    const cur = position.profitCurrency || position.currency || account?.currency;
    const pnlValue = position.profit != null ? position.profit : undefined;
    const pnlText = formatProfit(pnlValue, cur, position.profitStale);
    pushBracketControls({
      actionId,
      orderId: actionId,
      side: position.side,
      volumeLots: position.volumeLots,
      entry: position.entryGcEstimate,
      sl: position.slGc,
      tp: position.tpGc,
      pnlPerPriceUnit: position.pnlPerPriceUnit,
      pnlValue,
      pnlText,
      canClose: true,
      closing:
        position.actionPending ||
        closingIds.has(actionId) ||
        closingIds.has(ticketStr) ||
        modifyingIds.has(actionId) ||
        modifyingIds.has(ticketStr),
    });
  }

  const appOrderTickets = appBrokerOrderTickets(orders);
  for (const pending of mt5OpenTrades.orders) {
    if (appOrderTickets.has(pending.brokerOrderTicket)) continue;
    const actionId = mt5OrderKey(pending.brokerOrderTicket);
    const ticketStr = String(pending.brokerOrderTicket);
    pushBracketControls({
      actionId,
      orderId: actionId,
      side: pending.side,
      volumeLots: pending.volumeLots,
      entry: isFinitePrice(pending.entryGc) ? pending.entryGc : undefined,
      sl: pending.slGc,
      tp: pending.tpGc,
      pnlPerPriceUnit: pending.pnlPerPriceUnit,
      canCancel: true,
      cancelling:
        pending.actionPending ||
        cancellingIds.has(actionId) ||
        cancellingIds.has(ticketStr) ||
        modifyingIds.has(actionId) ||
        modifyingIds.has(ticketStr),
    });
  }

  return controls;
}

function normalizeProfileId(value: string | null | undefined): string {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : DEFAULT_PROFILE_ID;
}

function browserStorage(): Pick<Storage, "getItem" | "setItem"> | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export interface ProfileHotSnapshot {
  version: 1;
  userId: string;
  profileId: string;
  savedAt: number;
  payload: ChartProfilePayload;
}

/** Read the browser-local active profile, falling back safely for restricted storage. */
export function readActiveProfileId(
  storage: Pick<Storage, "getItem"> | undefined = browserStorage(),
): string {
  try {
    return normalizeProfileId(storage?.getItem(ACTIVE_PROFILE_STORAGE_KEY));
  } catch {
    return DEFAULT_PROFILE_ID;
  }
}

/** Remember the active profile so browser refresh restores the same workspace. */
export function persistActiveProfileId(
  profileId: string,
  storage: Pick<Storage, "setItem"> | undefined = browserStorage(),
): void {
  try {
    storage?.setItem(ACTIVE_PROFILE_STORAGE_KEY, normalizeProfileId(profileId));
  } catch {
    /* Profile loading still works when browser storage is unavailable. */
  }
}

export function readProfileHotSnapshot(
  userId: string,
  storage: Pick<Storage, "getItem"> | undefined = browserStorage(),
  now = Date.now(),
): ProfileHotSnapshot | undefined {
  try {
    const raw = storage?.getItem(PROFILE_HOT_SNAPSHOT_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<ProfileHotSnapshot>;
    const savedAt = Number(parsed.savedAt);
    if (
      parsed.version !== 1 ||
      parsed.userId !== userId ||
      typeof parsed.profileId !== "string" ||
      !Number.isFinite(savedAt) ||
      parsed.payload?.version !== 1
    ) {
      return undefined;
    }
    if (
      savedAt > now + 60_000 ||
      now - savedAt > PROFILE_HOT_SNAPSHOT_MAX_AGE_MS
    ) {
      return undefined;
    }
    return {
      version: 1,
      userId,
      profileId: normalizeProfileId(parsed.profileId),
      savedAt,
      payload: parsed.payload,
    };
  } catch {
    return undefined;
  }
}

export function persistProfileHotSnapshot(
  userId: string,
  profileId: string,
  payload: ChartProfilePayload,
  storage: Pick<Storage, "setItem"> | undefined = browserStorage(),
  now = Date.now(),
): void {
  try {
    storage?.setItem(
      PROFILE_HOT_SNAPSHOT_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        userId,
        profileId: normalizeProfileId(profileId),
        savedAt: now,
        payload,
      } satisfies ProfileHotSnapshot),
    );
  } catch {
    /* Server-side profile persistence still works without browser storage. */
  }
}

function isTimeframe(value: unknown): value is Timeframe {
  return typeof value === "string" && PROFILE_TIMEFRAMES.has(value as Timeframe);
}

function AlertToolbarButton({
  open,
  alertCount,
  onClick,
}: {
  open: boolean;
  alertCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`alert-toolbar-button${open ? " is-open" : ""}`}
      title="Alerts"
      aria-label="Alerts"
      aria-expanded={open}
      onClick={onClick}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
        <path d="M19 2v4" />
        <path d="M21 4h-4" />
      </svg>
      {alertCount > 0 && (
        <span className="alert-toolbar-badge">{alertCount}</span>
      )}
    </button>
  );
}

export function ChartContextMenu({
  menu,
  limitDraft,
  orderPending = false,
  onClose,
  onAddAlert,
  onPlaceLimitOrder,
}: {
  menu: ChartMenuState;
  limitDraft?: ChartLimitOrderDraft;
  orderPending?: boolean;
  onClose: () => void;
  onAddAlert: (price: number) => void;
  onPlaceLimitOrder: (draft: ChartLimitOrderDraft) => void;
}) {
  const alertPrice = roundGcPrice(menu.price);
  return (
    <>
      <div
        className="chart-menu-backdrop"
        onClick={() => {
          const ignoreInitialBackdropClick =
            menu.openedAt !== undefined && Date.now() - menu.openedAt < 650;
          if (ignoreInitialBackdropClick) return;
          onClose();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          onClose();
        }}
      />
      <div
        className="chart-menu"
        role="menu"
        style={{ left: menu.x, top: menu.y }}
      >
        <button
          type="button"
          role="menuitem"
          className="chart-menu-item"
          onClick={() => onAddAlert(menu.price)}
        >
          Add alert at {alertPrice.toFixed(1)}
        </button>
        {limitDraft !== undefined && (
          <button
            type="button"
            role="menuitem"
            className={`chart-menu-item chart-menu-order ${limitDraft.side}`}
            disabled={orderPending}
            onClick={() => onPlaceLimitOrder(limitDraft)}
          >
            {orderPending
              ? "Placing..."
              : `Place ${limitDraft.side.toUpperCase()} LIMIT at ${limitDraft.entryGc.toFixed(1)}`}
          </button>
        )}
      </div>
    </>
  );
}

function formatTelegramAlertMessage(event: AlertEventMessage): string {
  const time = new Date(event.time).toISOString().replace("T", " ").slice(0, 19);
  return [
    event.message,
    `${event.symbol} ${event.contract}`,
    `Price: ${event.price.toFixed(1)}`,
    `Time: ${time} UTC`,
  ].join("\n");
}

function cloneDrawings(drawings: readonly DrawingState[]): DrawingState[] {
  return drawings.map((drawing) => ({
    ...drawing,
    anchors: drawing.anchors.map((anchor) => ({ ...anchor })),
    options: drawing.options
      ? {
          ...drawing.options,
          fibLevels: drawing.options.fibLevels?.map((level) => ({ ...level })),
        }
      : undefined,
  }));
}

function profileDrawings(drawings: readonly DrawingState[]): DrawingState[] {
  return cloneDrawings(drawings.filter((drawing) => drawing.tool !== "order_bracket"));
}

function fvgSignalsEqual(
  current: ReadonlyMap<number, FvgSignalUpdateMessage>,
  nextSignals: readonly FvgSignalUpdateMessage[],
): boolean {
  const active = nextSignals.filter(
    (signal) => signal.phase !== "clear" && signal.pulse !== 0,
  );
  if (current.size !== active.length) return false;
  for (const signal of active) {
    const existing = current.get(signal.time);
    if (
      existing === undefined ||
      existing.direction !== signal.direction ||
      existing.level !== signal.level ||
      existing.pulse !== signal.pulse ||
      existing.top !== signal.top ||
      existing.bottom !== signal.bottom ||
      existing.breakoutRatio !== signal.breakoutRatio ||
      existing.phase !== signal.phase
    ) {
      return false;
    }
  }
  return true;
}

function replayVolumeDelta(rows: readonly VolumeDeltaBar[]): readonly VolumeDeltaDatum[] {
  let runningCvd = 0;
  return rows.map((point) => {
    const explicit = point.cumulativeDelta;
    const cumulativeDelta =
      explicit !== undefined && Number.isFinite(explicit)
        ? explicit
        : runningCvd + point.closeDelta;
    runningCvd = cumulativeDelta;
    return {
      time: point.time,
      volume: point.volume,
      buyVolume: point.buyVolume,
      sellVolume: point.sellVolume,
      delta: point.delta,
      deltaHigh: point.deltaHigh,
      deltaLow: point.deltaLow,
      openDelta: point.openDelta,
      closeDelta: point.closeDelta,
      cumulativeDelta,
    };
  });
}

export function drawingVisibleOnTimeframe(
  drawing: DrawingState,
  timeframe: Timeframe,
): boolean {
  const sourceTimeframe = drawing.sourceTimeframe;
  if (sourceTimeframe === undefined) return true;
  return TIMEFRAME_RANK[timeframe] <= TIMEFRAME_RANK[sourceTimeframe];
}

export function visibleDrawingsForTimeframe(
  drawings: readonly DrawingState[],
  timeframe: Timeframe,
): DrawingState[] {
  return cloneDrawings(
    drawings.filter((drawing) => drawingVisibleOnTimeframe(drawing, timeframe)),
  );
}

function ReplayToolbarButton({
  phase,
  disabled,
  onClick,
}: {
  phase: BarReplayPhase;
  disabled: boolean;
  onClick: () => void;
}) {
  const active = phase !== "idle";
  return (
    <button
      type="button"
      className={`bar-replay-toolbar-button${active ? " is-active" : ""}`}
      title={
        phase === "active"
          ? "Exit Bar Replay and return to live chart"
          : phase === "selecting"
            ? "Cancel replay selection"
            : "Bar Replay"
      }
      aria-label={phase === "active" ? "Exit Bar Replay" : "Bar Replay"}
      aria-pressed={active}
      disabled={disabled && phase === "idle"}
      onClick={onClick}
    >
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 11a8 8 0 1 0-2.3 5.7" />
        <path d="M20 4v7h-7" />
        <path d="m10 8 5 4-5 4z" fill="currentColor" stroke="none" />
      </svg>
    </button>
  );
}

export function mergeVisibleDrawingState(
  previous: readonly DrawingState[],
  visibleState: readonly DrawingState[],
  timeframe: Timeframe,
): DrawingState[] {
  const visibleById = new Map(
    visibleState.map((drawing) => [
      drawing.id,
      {
        ...drawing,
        anchors: drawing.anchors.map((anchor) => ({ ...anchor })),
        options: drawing.options ? { ...drawing.options } : undefined,
      },
    ]),
  );
  const seen = new Set<string>();
  const next: DrawingState[] = [];

  for (const existing of previous) {
    const incoming = visibleById.get(existing.id);
    if (incoming !== undefined) {
      seen.add(existing.id);
      next.push({
        ...incoming,
        sourceTimeframe: existing.sourceTimeframe ?? incoming.sourceTimeframe ?? timeframe,
      });
      continue;
    }
    if (!drawingVisibleOnTimeframe(existing, timeframe)) {
      next.push({
        ...existing,
        anchors: existing.anchors.map((anchor) => ({ ...anchor })),
        options: existing.options ? { ...existing.options } : undefined,
      });
    }
  }

  for (const incoming of visibleById.values()) {
    if (seen.has(incoming.id)) continue;
    next.push({
      ...incoming,
      sourceTimeframe: incoming.sourceTimeframe ?? timeframe,
    });
  }

  return next;
}

function fixedRangeDeltaProfileDrawings(
  drawings: readonly DrawingState[],
): DrawingState[] {
  return drawings.filter(
    (drawing) =>
      drawing.tool === "fixed_range_delta_profile" && drawing.anchors.length >= 2,
  );
}

function extendRightFixedRangeProfiles(
  drawings: readonly DrawingState[],
  latestBarTimeMs: number | undefined,
  timeframe: Timeframe,
): { drawings: DrawingState[]; changed: boolean } {
  if (!Number.isFinite(latestBarTimeMs)) {
    return { drawings: [...drawings], changed: false };
  }
  const latestAnchorTime = Math.floor(
    ((latestBarTimeMs as number) + displayOffsetForTimeframe(timeframe)) / 1000,
  ) as UTCTimestamp;
  let changed = false;
  const next = drawings.map((drawing) => {
    if (
      drawing.tool !== "fixed_range_delta_profile" ||
      drawing.anchors.length < 2 ||
      drawing.options?.fixedRangeProfileExtendRight !== true
    ) {
      return drawing;
    }
    const firstTime = Number(drawing.anchors[0].time);
    const secondTime = Number(drawing.anchors[1].time);
    const rightIndex = firstTime >= secondTime ? 0 : 1;
    if (Number(drawing.anchors[rightIndex].time) >= latestAnchorTime) {
      return drawing;
    }
    changed = true;
    const anchors = drawing.anchors.map((anchor, index) =>
      index === rightIndex
        ? {
            ...anchor,
            time: latestAnchorTime,
            logical: undefined,
          }
        : { ...anchor },
    );
    return {
      ...drawing,
      anchors,
      options: drawing.options ? { ...drawing.options } : undefined,
    };
  });
  return { drawings: next, changed };
}

function footprintTouchesFixedRange(
  footprintTime: number,
  drawing: DrawingState,
  timeframe: Timeframe,
): boolean {
  const range = fixedRangeMsFromAnchors(drawing.anchors, timeframe);
  if (range === null) return false;
  const footprintEnd = footprintTime + 60_000 - 1;
  return footprintTime <= range.to && footprintEnd >= range.from;
}

export function appShellClassName(chartFocusMode: boolean): string {
  return chartFocusMode ? "app-shell chart-focus" : "app-shell";
}

export function bigTradesEnabledForTimeframe(timeframe: Timeframe): boolean {
  return timeframe === "15s" || timeframe === "1m";
}

export function outsideBarSettingsForTimeframe(
  settings: OutsideBarSettings,
  timeframe: Timeframe,
): OutsideBarSettings {
  return {
    ...settings,
    enabled: settings.enabled && timeframe === "5m",
  };
}

function normalizeFixedRangeProfileMode(
  mode: unknown,
): FixedRangeProfileMode {
  return mode === "delta" || mode === "bidAsk" ? "delta" : "volume";
}

function fixedRangeDeltaProfileSource(
  mode: FixedRangeProfileMode,
): DeltaProfileSource {
  return mode === "volume" ? "minute_bars" : "footprint_cache";
}

function fixedRangeDeltaProfileRowTicks(mode: FixedRangeProfileMode): number {
  return mode === "delta" ? DELTA_PROFILE_ROW_TICKS : VOLUME_PROFILE_ROW_TICKS;
}

/**
 * LiveApp â€” the composed, runnable application.
 *
 * Wires the tested modules into a working app against a live backend:
 *   - ApiClient loads profile/alert state while chart data uses `contract=GC`;
 *   - ChartSocket connects to `/ws/chart` and subscribes to chart events;
 *   - HistoryLoader seeds the MemoryCache, then ChartContainer renders + applies
 *     realtime bar_update events incrementally;
 *   - alert events update the AlertPanel and chart markers.
 *
 * The unit-tested `App` shell remains for the layout-chrome tests; this is the
 * integration entry point mounted by `main.tsx`.
 */
export function LiveApp() {
  const endpoints = useMemo(resolveEndpoints, []);
  const api = useMemo(() => new ApiClient({ basePath: endpoints.api }), [endpoints.api]);
  const cache = useMemo(() => new MemoryCache(), []);
  const socket = useMemo(() => new ChartSocket({ url: endpoints.ws }), [endpoints.ws]);

  const [timeframe, setTimeframe] = useState<Timeframe>("1m");
  const [profileTimeframe, setProfileTimeframe] = useState<Timeframe>("1m");
  const contract = CHART_CONTRACT;
  const [socketGeneration, setSocketGeneration] = useState(0);
  const [overlayRefreshNonce, setOverlayRefreshNonce] = useState(0);
  const [bars, setBars] = useState<readonly Bar[]>([]);
  const [loadedBarsTimeframe, setLoadedBarsTimeframe] =
    useState<Timeframe>("1m");
  const [loadedSeriesKey, setLoadedSeriesKey] = useState<string | undefined>(
    undefined,
  );
  const [volumeDelta, setVolumeDelta] = useState<readonly VolumeDeltaDatum[]>([]);
  const [volumeDeltaSeriesKey, setVolumeDeltaSeriesKey] = useState<
    string | undefined
  >(undefined);
  const [footprintBars, setFootprintBars] = useState<ReadonlyMap<number, FootprintBar>>(
    () => new Map(),
  );
  const [fvgSignals, setFvgSignals] = useState<
    ReadonlyMap<number, FvgSignalUpdateMessage>
  >(() => new Map());
  const [fvgSignalSeriesKey, setFvgSignalSeriesKey] = useState<
    string | undefined
  >(undefined);
  const [tduSignals, setTduSignals] = useState<
    ReadonlyMap<number, TduSignalUpdateMessage>
  >(() => new Map());
  const [tduSignalSeriesKey, setTduSignalSeriesKey] = useState<
    string | undefined
  >(undefined);
  const [loadedOverlayContract, setLoadedOverlayContract] = useState<
    string | undefined
  >(undefined);
  const [bigTrades, setBigTrades] = useState<readonly BigTradeMarker[]>([]);
  const [smcAiSignals, setSmcAiSignals] = useState<readonly SmcAiSignalMarker[]>([]);
  const [alertSignalMarkers, setAlertSignalMarkers] = useState<
    readonly AlertSignalMarker[]
  >([]);
  const [replaySelecting, setReplaySelecting] = useState(false);
  const [replaySelectionError, setReplaySelectionError] = useState("");
  const [replayDataset, setReplayDataset] = useState<BarReplayDataset>();
  const [replayCursorIndex, setReplayCursorIndex] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState<BarReplaySpeed>(1);
  const [replayFollowLatest, setReplayFollowLatest] = useState(true);
  const [indicatorsVisible, setIndicatorsVisible] = useState(true);
  const [orderLevelsVisible, setOrderLevelsVisible] = useState(true);
  const [showDailyVolumeProfile, setShowDailyVolumeProfile] = useState(false);
  const [dailyVolumeProfileWidth, setDailyVolumeProfileWidth] = useState(
    DEFAULT_SESSION_VOLUME_PROFILE_WIDTH_PX,
  );
  const [dailyVolumeProfileRowTicks, setDailyVolumeProfileRowTicks] = useState(
    DEFAULT_SESSION_VOLUME_PROFILE_ROW_TICKS,
  );
  const [dailyVolumeProfileDays, setDailyVolumeProfileDays] = useState(
    DEFAULT_SESSION_VOLUME_PROFILE_DAYS,
  );
  const [
    showDailyVolumeProfileDevelopingPoc,
    setShowDailyVolumeProfileDevelopingPoc,
  ] = useState(true);
  const [sessionVolumeProfile, setSessionVolumeProfile] =
    useState<DeltaProfileData | null>(null);
  const [showVolumeDelta, setShowVolumeDelta] = useState(false);
  const [showXKontrol, setShowXKontrol] = useState(false);
  const [xKontrolSettings, setXKontrolSettings] =
    useState<XKontrolDisplaySettings>(() => ({
      ...DEFAULT_XKONTROL_DISPLAY_SETTINGS,
    }));
  const [showTduSignals, setShowTduSignals] = useState(true);
  const [denseOverlayMinBarSpacing, setDenseOverlayMinBarSpacing] = useState(() => {
    try {
      const stored = localStorage.getItem(DENSE_OVERLAY_SPACING_STORAGE_KEY);
      return normalizeDenseOverlayBarSpacing(stored === null ? undefined : Number(stored));
    } catch {
      return normalizeDenseOverlayBarSpacing(undefined);
    }
  });
  useEffect(() => {
    try { localStorage.setItem(DENSE_OVERLAY_SPACING_STORAGE_KEY, String(denseOverlayMinBarSpacing)); } catch {
      // Keep the setting active when browser storage is unavailable.
    }
  }, [denseOverlayMinBarSpacing]);
  const [showMgannSwing, setShowMgannSwing] = useState(false);
  const [mgannSwing, setMgannSwing] = useState<MgannSwingSettings>(() => ({
    ...DEFAULT_MGANN_SWING_SETTINGS,
  }));
  const mgannSwingDisabled = false;
  const showMgannSwingForTimeframe = showMgannSwing;
  const showMgannWaveDelta =
    showMgannSwingForTimeframe && mgannSwing.showWaveDelta;
  const [showFvgGrader, setShowFvgGrader] = useState(true);
  const [showMgannBreak, setShowMgannBreak] = useState(true);
  const [mgannBreakSettings, setMgannBreakSettings] =
    useState<MgannBreakSettings>(() => ({ ...DEFAULT_MGANN_BREAK_SETTINGS }));
  const [mgannBreakLatestClosedTime, setMgannBreakLatestClosedTime] =
    useState<number>();
  const [fvgSignalLimit, setFvgSignalLimit] = useState(DEFAULT_FVG_SIGNAL_LIMIT);
  const [mgannBreakSignalHistoryBars, setMgannBreakSignalHistoryBars] = useState(
    DEFAULT_MGANN_BREAK_SIGNAL_HISTORY_BARS,
  );
  const [mgannBreakSignalLimit, setMgannBreakSignalLimit] = useState(
    DEFAULT_MGANN_BREAK_SIGNAL_LIMIT,
  );
  const [showBigTrades, setShowBigTrades] = useState(true);
  const [ema, setEma] = useState<EmaSettings>(() => ({ ...DEFAULT_EMA_SETTINGS }));
  const [supertrend, setSupertrend] = useState<SupertrendSettings>(() => ({
    ...DEFAULT_SUPERTREND_SETTINGS,
  }));
  const [smc, setSmc] = useState<SmcSettings>(() => ({ ...DEFAULT_SMC_SETTINGS }));
  const [sweepReversal, setSweepReversal] = useState<SweepReversalSettings>(
    () => ({ ...DEFAULT_SWEEP_REVERSAL_SETTINGS }),
  );
  const [outsideBar, setOutsideBar] = useState<OutsideBarSettings>(() => ({
    ...DEFAULT_OUTSIDE_BAR_SETTINGS,
    enabled: true,
  }));
  const [footprintSettings, setFootprintSettings] = useState<FootprintSettings>(
    () => ({ ...DEFAULT_FOOTPRINT_SETTINGS }),
  );
  const [bigTradeSettings, setBigTradeSettings] = useState<BigTradeSettings>(
    () => ({ ...DEFAULT_BIG_TRADE_SETTINGS }),
  );
  const bigTradeSettingsRef = useRef(bigTradeSettings);
  bigTradeSettingsRef.current = bigTradeSettings;
  const [chartBackgroundColor, setChartBackgroundColor] = useState(
    DEFAULT_CHART_BACKGROUND,
  );
  const [timezoneOffsetMinutes, setTimezoneOffsetMinutes] = useState(
    DEFAULT_TIMEZONE_OFFSET_MINUTES,
  );
  const [alerts, setAlerts] = useState<readonly Alert[]>([]);
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;
  const mgannBreakSettingsRef = useRef(mgannBreakSettings);
  mgannBreakSettingsRef.current = mgannBreakSettings;
  const [lastAlert, setLastAlert] = useState<AlertEventMessage | undefined>(undefined);
  const [alertPanelOpen, setAlertPanelOpen] = useState(false);
  const [telegramConfig, setTelegramConfig] =
    useState<TelegramNotificationConfig>({
      enabled: false,
      chatId: "",
      sendScreenshot: true,
      hasBotToken: false,
    });
  const [telegramStatus, setTelegramStatus] = useState("");
  const [webPushConfig, setWebPushConfig] = useState<WebPushNotificationConfig>({
    enabled: false,
    subscriptionCount: 0,
    publicKey: "",
  });
  const [webPushStatus, setWebPushStatus] = useState("");
  const [webPushSupported, setWebPushSupported] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | undefined>(undefined);
  const authUserIdRef = useRef<string | undefined>(undefined);
  authUserIdRef.current = authUser?.id;
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthDialogMode>("login");
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState("");
  const [mt5Account, setMt5Account] = useState<Mt5Account | undefined>(undefined);
  const [executionEnabled, setExecutionEnabled] = useState(false);
  // A temporary capability failure must leave the manual panel visible and
  // locked. Recover through read-only capability checks without a new login.
  useEffect(() => {
    if (!authUser || executionEnabled) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      void api.execution().then((execution) => {
        if (!cancelled) {
          setExecutionEnabled(execution.enabled);
        }
      });
    }, 5_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [api, authUser, executionEnabled]);
  const [mt5Symbol, setMt5Symbol] = useState<Mt5Symbol | undefined>(undefined);
  const mt5SymbolRef = useRef<Mt5Symbol | undefined>(undefined);
  mt5SymbolRef.current = mt5Symbol;
  const [mt5DialogOpen, setMt5DialogOpen] = useState(false);
  const [mt5Pending, setMt5Pending] = useState(false);
  const [mt5Error, setMt5Error] = useState("");
  const [orders, setOrders] = useState<readonly TradingOrder[]>([]);
  const [mt5OpenTrades, setMt5OpenTrades] = useState<Mt5OpenTrades>(
    EMPTY_MT5_OPEN_TRADES,
  );
  const [closingOrderIds, setClosingOrderIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [cancellingOrderIds, setCancellingOrderIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [breakingEvenOrderIds, setBreakingEvenOrderIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [closing50OrderIds, setClosing50OrderIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [modifyingOrderIds, setModifyingOrderIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const activeOrderEditsRef = useRef(new Set<string>());
  const [orderDragPreviews, setOrderDragPreviews] = useState<ReadonlyMap<string, OrderDragPreview>>(() => new Map());
  const tradingRefreshRef = useRef({ requested: 0, applied: 0 });
  const [supertrendTrailings, setSupertrendTrailings] = useState<
    ReadonlyMap<string, SupertrendTrailing>
  >(() => new Map());
  const hadLiveSupertrendTrailingRef = useRef(false);
  const [supertrendTrailingPendingIds, setSupertrendTrailingPendingIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [latestPrice, setLatestPrice] = useState<number | undefined>(undefined);
  const latestPriceRef = useRef<number | undefined>(undefined);
  const latestPriceConsumersActiveRef = useRef(false);
  latestPriceConsumersActiveRef.current =
    orders.length > 0 ||
    mt5OpenTrades.positions.length > 0 ||
    mt5OpenTrades.orders.length > 0;
  const [marketOrderSettings, setMarketOrderSettings] =
    useState<MarketOrderSettings>(() => readMarketOrderSettings());
  const [orderPending, setOrderPending] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [exnessActionError, setExnessActionError] = useState("");
  const visibleOrderError = orderError || mt5Account?.error || exnessActionError;

  const resetOrderPendingAndOptimisticState = useCallback(() => {
    activeSubmissionTokenRef.current = 0;
    orderSubmittingRef.current = false;
    setOrderPending(false);
    setClosingOrderIds(new Set());
    setCancellingOrderIds(new Set());
    setBreakingEvenOrderIds(new Set());
    setClosing50OrderIds(new Set());
    setModifyingOrderIds(new Set());
    setSupertrendTrailingPendingIds(new Set());
    activeOrderEditsRef.current = new Set();
    setOrderDragPreviews(new Map());
    setOrderError("");
    setExnessActionError("");
  }, []);

  const accountGenerationRef = useRef(0);
  const symbolRequestIdRef = useRef(0);
  const orderSubmittingRef = useRef(false);
  const activeSubmissionTokenRef = useRef(0);
  const submissionTokenCounterRef = useRef(0);
  const connectedAccountKey = mt5Account?.connected
    ? `${authUser?.id ?? ""}:${mt5Account.accountId ?? mt5Account.login ?? ""}`
    : "";
  const connectedAccountKeyRef = useRef(connectedAccountKey);
  connectedAccountKeyRef.current = connectedAccountKey;
  const prevConnectedAccountKeyRef = useRef(connectedAccountKey);
  useEffect(() => {
    if (prevConnectedAccountKeyRef.current !== connectedAccountKey) {
      prevConnectedAccountKeyRef.current = connectedAccountKey;
      accountGenerationRef.current += 1;
      setMt5Symbol(undefined);
      mt5SymbolRef.current = undefined;
      resetOrderPendingAndOptimisticState();
    }
  }, [connectedAccountKey, resetOrderPendingAndOptimisticState]);
  // TradingView-style chart context menu, anchored at the click point.
  const [chartMenu, setChartMenu] = useState<ChartMenuState | undefined>(
    undefined,
  );
  const [activeTool, setActiveTool] = useState<DrawingToolType | null>(null);
  const fixedRangeProfileMode: FixedRangeProfileMode = "volume";
  const [chartFocusMode, setChartFocusMode] = useState(false);
  const [drawingCount, setDrawingCount] = useState(0);
  const [deleteAllSignal, setDeleteAllSignal] = useState(0);
  const [removeDrawingIds, setRemoveDrawingIds] = useState<readonly string[]>([]);
  const [drawings, setDrawings] = useState<readonly DrawingState[]>([]);
  const [drawingsLoadKey, setDrawingsLoadKey] = useState(0);
  const [fixedRangeDeltaProfiles, setFixedRangeDeltaProfiles] = useState<
    ReadonlyMap<string, DeltaProfileLoadState>
  >(() => new Map());
  const [extendRightLiveBar, setExtendRightLiveBar] = useState<
    { seriesKey: string; time: number } | undefined
  >(undefined);
  const [deltaProfileRefreshNonce, setDeltaProfileRefreshNonce] = useState(0);
  const [profileId, setProfileId] = useState(DEFAULT_PROFILE_ID);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileHydrated, setProfileHydrated] = useState(false);
  const workspace = useWorkspaces(api, authUser?.id, profileHydrated, chartBackgroundColor);
  const workspaceId = workspace.active?.id;
  const payload = workspace.active?.payload;
  const panels = payload?.panels ?? [];
  const charts = panels.filter((panel) => panel.type === "chart");
  const mainPanel = charts.find((panel) => panel.id === MAIN_CHART);
  const [instrument, setInstrument] = useState(DEFAULT_INSTRUMENT);
  const [selection, setSelection] = useState<{ workspaceId?: string; panelId: string }>();
  const [visualSelection, setVisualSelection] = useState<{ workspaceId?: string; panelId: string }>();
  const activatePanel = (panelId: string) => {
    const panel = panels.find(item => item.id === panelId);
    if (!panel) return;
    setVisualSelection({ workspaceId, panelId });
    if (panel.type === "chart") setSelection({ workspaceId, panelId });
  };
  const [zoomed, setZoomed] = useState<{ workspaceId?: string; panelId: string }>();
  const [workspaceFullscreen, setWorkspaceFullscreen] = useState(false);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? true);
  const [openScanChartId, setOpenScanChartId] = useState<string>();
  const [scanStates, setScanStates] = useState<Record<string, {
    active: boolean;
    loading: boolean;
    error: string | null;
    settingsOpen: boolean;
    suggestions: ScanAiSuggestion[];
    addedIds: Set<string>;
    groups: Set<ScanAiGroup>;
    state: ScanAiState | "auto";
    strength: ScanAiStrength;
    density: ScanAiDensity;
    depth: ScanAiDepth;
    targetsAndStop: boolean;
    patterns: string[];
  }>>({});
  const scanStatesRef = useRef(scanStates); scanStatesRef.current = scanStates;
  const scanRequests = useRef(new Map<string, number>());
  const acceptedScanGeometry = useRef(new Map<string, ScanAiSuggestion[]>());
  const [drawingToolsOpen, setDrawingToolsOpen] = useState(false);
  const [footprintZoomSelecting, setFootprintZoomSelecting] = useState(false);
  const [autoFootprintPanels, setAutoFootprintPanels] = useState<ReadonlySet<string>>(() => new Set());
  const updateAutoFootprintPanel = useCallback((id: string, visible: boolean) => {
    setAutoFootprintPanels((current) => {
      if (current.has(id) === visible) return current;
      const next = new Set(current);
      if (visible) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  useEffect(() => setFootprintZoomSelecting(false), [timeframe, workspaceId]);
  const [scanPreview, setScanPreview] = useState<{ key: string; drawing: DrawingState }>();
  const shellRef = useRef<HTMLDivElement>(null);
  const chartDrawingActions = useRef(new Map<string, ChartDrawingActions>());
  const fullscreenPanelId = zoomed?.workspaceId === workspaceId && panels.some((panel) => panel.id === zoomed?.panelId)
    ? zoomed?.panelId : undefined;
  const fullscreenChartId = charts.some((panel) => panel.id === fullscreenPanelId) ? fullscreenPanelId : undefined;
  const selectedChart = charts.find((panel) => panel.id === fullscreenChartId)
    ?? charts.find((panel) => selection?.workspaceId === workspaceId && panel.id === selection?.panelId)
    ?? charts[0];
  const selectedTimeframe = selectedChart?.id === MAIN_CHART ? timeframe : selectedChart?.timeframe ?? "1m";
  const savedTheme = payload?.theme ?? DEFAULT_THEME;
  const theme = useMemo(() => resolveWorkspaceTheme(savedTheme, systemDark), [savedTheme, systemDark]);
  const mainTimeframe = payload?.useChartProfile && authUser ? profileTimeframe : mainPanel?.timeframe ?? "1m";
  const workspaceTimeframes = [...new Set<Timeframe>([timeframe, ...charts.flatMap((panel) => panel.timeframe ?? [])])].sort().join(",");
  const chartKey = (id: string) => `${workspaceId}/${id}`;

  useEffect(() => {
    let cancelled = false;
    void api.instruments().then((catalog) => {
      const active = catalog.find((item) => item.symbol === SYMBOL);
      if (!cancelled && active) setInstrument(active);
    }).catch(() => { /* Keep the built-in GC instrument during reconnect. */ });
    return () => { cancelled = true; };
  }, [api]);

  useEffect(() => {
    const scheme = window.matchMedia?.("(prefers-color-scheme: dark)");
    const change = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    scheme?.addEventListener("change", change);
    return () => scheme?.removeEventListener("change", change);
  }, []);

  useEffect(() => {
    if (workspaceId) applyWorkspaceTheme(theme, true);
  }, [theme, workspaceId]);

  useEffect(() => {
    if (!authUser || !payload || payload.tradingAccountInitialized || !charts.length) return;
    workspace.update((current) => {
      if (current.tradingAccountInitialized) return current;
      const hasAccount = current.panels.some((panel) => panel.type === "tradingAccount");
      const canAdd = !hasAccount && current.panels.length < 12;
      return {
        ...current,
        tradingAccountInitialized: true,
        panels: canAdd ? [...current.panels, { id: crypto.randomUUID(), type: "tradingAccount" }] : current.panels,
      };
    });
  }, [authUser, workspaceId, payload]);

  useEffect(() => {
    setTimeframe(mainTimeframe);
    setReplaySelecting(false);
    setReplaySelectionError("");
    setReplayPlaying(false);
    setReplayDataset(undefined);
    setScanPreview(undefined);
  }, [workspaceId, mainTimeframe]);

  useEffect(() => setOpenScanChartId(undefined), [workspaceId]);

  useEffect(() => {
    const handleFullscreen = () => setWorkspaceFullscreen(document.fullscreenElement === shellRef.current);
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setZoomed(undefined);
      setWorkspaceFullscreen(false);
    };
    document.addEventListener("fullscreenchange", handleFullscreen);
    window.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreen);
      window.removeEventListener("keydown", escape);
    };
  }, []);

  useEffect(() => {
    if (!profileHydrated) return;
    const subscriptions = workspaceTimeframes.split(",") as Timeframe[];
    for (const tf of subscriptions) socket.subscribe(SYMBOL, TIMEFRAME_SUBSCRIBED_EVENTS, tf);
    return () => {
      for (const tf of subscriptions) socket.unsubscribe(SYMBOL, TIMEFRAME_SUBSCRIBED_EVENTS, tf);
    };
  }, [socket, workspaceTimeframes, profileHydrated]);
  const profileIdRef = useRef(profileId);
  profileIdRef.current = profileId;
  const submittedOrderDrawingIdsRef = useRef(new Set<string>());
  const invalidOrderDrawingIdsRef = useRef(new Set<string>());
  const drawingsRef = useRef(drawings);
  drawingsRef.current = drawings;
  const deltaProfileRequestKeysRef = useRef(new Map<string, string>());
  const deltaProfileFetchKeysRef = useRef(new Map<string, string>());
  const deltaProfileRefreshTimerRef = useRef<number | undefined>(undefined);
  const latestPriceThrottleRef = useRef<number | undefined>(undefined);
  const latestPricePendingRef = useRef<number | undefined>(undefined);
  const pendingFootprintRef = useRef<FootprintUpdateMessage | undefined>(undefined);
  const footprintRenderTimerRef = useRef<number | undefined>(undefined);
  const pendingBigTradesRef = useRef<BigTradeMessage[]>([]);
  const bigTradeRenderTimerRef = useRef<number | undefined>(undefined);
  const lastBigTradeSoundAtRef = useRef(0);

  const publishLatestPrice = useCallback((price: number) => {
    latestPriceRef.current = price;
    if (!latestPriceConsumersActiveRef.current) {
      latestPricePendingRef.current = undefined;
      return;
    }
    latestPricePendingRef.current = price;
    if (latestPriceThrottleRef.current !== undefined) return;

    const flush = () => {
      const pending = latestPricePendingRef.current;
      latestPricePendingRef.current = undefined;
      if (pending !== undefined && latestPriceConsumersActiveRef.current) {
        setLatestPrice(pending);
      }
      latestPriceThrottleRef.current = window.setTimeout(() => {
        latestPriceThrottleRef.current = undefined;
        if (latestPricePendingRef.current !== undefined) {
          flush();
        }
      }, 250);
    };

    flush();
  }, []);

  const profilePayload = useMemo<ChartProfilePayload>(
    () => ({
      version: 1,
      timeframe: profileTimeframe,
      chartBackgroundColor,
      showVolume: true,
      showVolumeDelta,
      showXKontrol,
      xKontrol: { ...xKontrolSettings },
      showTduSignals,
      denseOverlayMinBarSpacing,
      showDailyVolumeProfile,
      dailyVolumeProfileWidth,
      showDailyVolumeProfileDevelopingPoc,
      dailyVolumeProfileRowTicks,
      dailyVolumeProfileDays,
      showCvd: showMgannWaveDelta,
      showMgannSwing,
      mgannSwing: { ...mgannSwing },
      showFvgGrader,
      showMgannBreak,
      mgannBreak: { ...mgannBreakSettings },
      mgannBreakSettingsVersion: MGANN_BREAK_SETTINGS_VERSION,
      fvgSignalLimit,
      mgannBreakSignalHistoryBars,
      mgannBreakSignalLimit,
      showBigTrades,
      ema: { ...ema },
      supertrend: { ...supertrend },
      smc: { ...smc },
      sweepReversal: { ...sweepReversal },
      outsideBar: { ...outsideBar },
      footprintSettings: { ...footprintSettings },
      bigTradeSettings: { ...bigTradeSettings },
      marketOrderSettings: { ...marketOrderSettings },
      timezoneOffsetMinutes,
      fixedRangeProfileMode,
      drawings: profileDrawings(drawings),
    }),
    [
      bigTradeSettings,
      chartBackgroundColor,
      dailyVolumeProfileWidth,
      dailyVolumeProfileRowTicks,
      dailyVolumeProfileDays,
      denseOverlayMinBarSpacing,
      drawings,
      ema,
      footprintSettings,
      fvgSignalLimit,
      mgannBreakSignalHistoryBars,
      mgannBreakSignalLimit,
      mgannBreakSettings,
      fixedRangeProfileMode,
      marketOrderSettings,
      mgannSwing,
      outsideBar,
      showBigTrades,
      fvgSignalLimit,
      showMgannBreak,
      showMgannSwing,
      showVolumeDelta,
      showXKontrol,
      showDailyVolumeProfile,
      showDailyVolumeProfileDevelopingPoc,
      showMgannWaveDelta,
      showTduSignals,
      showFvgGrader,
      smc,
      supertrend,
      sweepReversal,
      profileTimeframe,
      timezoneOffsetMinutes,
      xKontrolSettings,
    ],
  );

  const profilePayloadSignature = useMemo(
    () => JSON.stringify(profilePayload),
    [profilePayload],
  );
  const [profileSyncedSignature, setProfileSyncedSignature] =
    useState(profilePayloadSignature);
  const profilePayloadSignatureRef = useRef(profilePayloadSignature);
  profilePayloadSignatureRef.current = profilePayloadSignature;

  const markProfileSyncedIfCurrent = (signature: string) => {
    setProfileSyncedSignature((current) =>
      profilePayloadSignatureRef.current === signature ? signature : current,
    );
  };

  const deleteAllDrawings = useCallback(() => {
    setDeleteAllSignal((s) => s + 1);
    setDrawingCount(0);
    setDrawings([]);
    submittedOrderDrawingIdsRef.current.clear();
    invalidOrderDrawingIdsRef.current.clear();
    setActiveTool(null);
  }, []);

  const toggleChartFocusMode = useCallback(() => {
    setChartFocusMode((focus) => !focus);
  }, []);

  const historyLoader = useRef<HistoryLoader | null>(null);
  const screenshotCaptureRef = useRef<(() => string | undefined) | undefined>(
    undefined,
  );
  const deselectActiveTool = useCallback(() => { setActiveTool(null); setFootprintZoomSelecting(false); }, []);
  const registerScreenshotCapture = useCallback(
    (capture: (() => string | undefined) | undefined) => {
      screenshotCaptureRef.current = capture;
    },
    [],
  );
  const telegramSentRef = useRef<string | undefined>(undefined);
  const resumeRefreshAtRef = useRef(0);
  if (historyLoader.current === null) {
    historyLoader.current = new HistoryLoader(
      (url) => fetch(url),
      cache,
      { basePath: endpoints.api },
    );
  }
  const currentSeriesKey = seriesDataKey(SYMBOL, contract, timeframe);
  const realtimeFootprintEnabled =
    ENABLE_REALTIME_FOOTPRINT_UPDATES && autoFootprintPanels.size > 0;
  const realtimeBigTradesEnabled =
    indicatorsVisible &&
    showBigTrades &&
    bigTradesEnabledForTimeframe(timeframe);
  const activeSeriesKeyRef = useRef(currentSeriesKey);
  activeSeriesKeyRef.current = currentSeriesKey;
  const historyBackfillRef = useRef<{
    seriesKey: string;
    pending: boolean;
    exhaustedBefore?: number;
  }>({
    seriesKey: currentSeriesKey,
    pending: false,
  });
  if (historyBackfillRef.current.seriesKey !== currentSeriesKey) {
    historyBackfillRef.current = {
      seriesKey: currentSeriesKey,
      pending: false,
    };
  }
  const hasLoadedCurrentSeries = loadedSeriesKey === currentSeriesKey;
  const replayActive = replayDataset?.seriesKey === currentSeriesKey;
  const workspaceSync = useWorkspaceSync(authUser?.id ?? "guest", {
    workspaceId: workspaceId ?? "", symbol: instrument.symbol, contract, mode: "live",
  }, payload, workspace.update, replayActive ? [MAIN_CHART] : []);
  const replayPhase: BarReplayPhase = replayActive
    ? "active"
    : replaySelecting
      ? "selecting"
      : "idle";

  const exitBarReplay = useCallback(() => {
    setReplaySelecting(false);
    setReplaySelectionError("");
    setReplayPlaying(false);
    setReplayFollowLatest(true);
    setReplayDataset(undefined);
    const live = cache.get({ symbol: SYMBOL, contract, timeframe });
    if (live !== undefined) {
      setLoadedSeriesKey(currentSeriesKey);
      setBars(live.bars.slice());
      setLoadedBarsTimeframe(timeframe);
    }
    // Catch up Volume Delta/FVG and any REST overlays that changed during replay.
    setSocketGeneration((generation) => generation + 1);
    setOverlayRefreshNonce((nonce) => nonce + 1);
  }, [cache, contract, currentSeriesKey, timeframe]);

  const beginBarReplaySelection = useCallback(() => {
    const loaded = cache.get({ symbol: SYMBOL, contract, timeframe })?.bars ?? bars;
    if (loaded.length < 3) {
      setReplaySelectionError("Load at least three candles before starting replay");
      return;
    }
    setReplayDataset(undefined);
    setReplayPlaying(false);
    setReplayFollowLatest(true);
    setReplaySelectionError("");
    setActiveTool(null);
    setReplaySelecting(true);
  }, [bars, cache, contract, timeframe]);

  const cancelBarReplaySelection = useCallback(() => {
    setReplaySelecting(false);
    setReplaySelectionError("");
  }, []);

  const selectBarReplayStart = useCallback(
    (selectedBar: Bar) => {
      if (!replaySelecting) return;
      const cachedSource = cache.get({ symbol: SYMBOL, contract, timeframe });
      const sourceBars = (cachedSource?.bars ?? bars).slice();
      const selectedIndex = findReplayBarIndex(sourceBars, selectedBar.time);
      if (selectedIndex <= 0) {
        setReplaySelectionError("Choose a candle after the first loaded candle");
        return;
      }
      if (selectedIndex >= sourceBars.length - 1) {
        setReplaySelectionError("Choose an earlier candle so replay has future bars");
        return;
      }

      const id = `${currentSeriesKey}:${Date.now()}:${selectedBar.time}`;
      const snapshot: BarReplayDataset = {
        id,
        seriesKey: currentSeriesKey,
        bars: sourceBars,
        barsTimeframe:
          cachedSource === undefined ? loadedBarsTimeframe : timeframe,
        volumeDelta: volumeDelta.slice(),
        footprintBars: new Map(footprintBars),
        fvgSignals: new Map(fvgSignals),
        bigTrades: bigTrades.slice(),
        smcAiSignals: smcAiSignals.slice(),
        alertSignals: alertSignalMarkers.slice(),
      };
      setReplayDataset(snapshot);
      setReplayCursorIndex(replayCursorBeforeSelection(selectedIndex));
      setReplayPlaying(false);
      setReplayFollowLatest(true);
      setReplaySelecting(false);
      setReplaySelectionError("");

      const range = {
        from: sourceBars[0].time,
        to: barEndForTimeframe(sourceBars[sourceBars.length - 1].time, timeframe) - 1,
      };
      void Promise.allSettled([
        api.volumeDelta(
          SYMBOL,
          contract,
          timeframe,
          BAR_REPLAY_HISTORY_LIMIT,
          range,
        ),
        timeframe === "1m"
          ? api.fvgSignals(SYMBOL, contract, BAR_REPLAY_HISTORY_LIMIT, range)
          : Promise.resolve<FvgSignalUpdateMessage[]>([]),
        api.bigTrades(SYMBOL, contract, BAR_REPLAY_HISTORY_LIMIT, range, true),
      ]).then(([deltaResult, fvgResult, bigTradeResult]) => {
        setReplayDataset((current) => {
          if (current?.id !== id) return current;
          const nextFvg = new Map<number, FvgSignalUpdateMessage>();
          const loadedFvg = fvgResult.status === "fulfilled" ? fvgResult.value : undefined;
          if (loadedFvg !== undefined) {
            for (const signal of loadedFvg) {
              if (signal.phase !== "clear" && signal.pulse !== 0) {
                nextFvg.set(signal.time, signal);
              }
            }
          }
          return {
            ...current,
            volumeDelta:
              deltaResult.status === "fulfilled"
                ? replayVolumeDelta(deltaResult.value)
                : current.volumeDelta,
            fvgSignals: loadedFvg === undefined ? current.fvgSignals : nextFvg,
            bigTrades:
              bigTradeResult.status === "fulfilled"
                ? bigTradeResult.value
                : current.bigTrades,
          };
        });
      });
    },
    [
      alertSignalMarkers,
      api,
      bars,
      loadedBarsTimeframe,
      bigTrades,
      cache,
      contract,
      currentSeriesKey,
      footprintBars,
      fvgSignals,
      replaySelecting,
      smcAiSignals,
      timeframe,
      volumeDelta,
    ],
  );

  const stepBarReplay = useCallback((direction: -1 | 1) => {
    setReplayPlaying(false);
    setReplayCursorIndex((current) => {
      const last = Math.max(0, (replayDataset?.bars.length ?? 1) - 1);
      return Math.min(last, Math.max(0, current + direction));
    });
  }, [replayDataset]);

  useEffect(() => {
    if (!replayActive || !replayPlaying || replayDataset === undefined) return;
    if (replayCursorIndex >= replayDataset.bars.length - 1) {
      setReplayPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setReplayCursorIndex((current) => Math.min(current + 1, replayDataset.bars.length - 1));
    }, barReplayDelayMs(replaySpeed));
    return () => window.clearTimeout(timer);
  }, [replayActive, replayCursorIndex, replayDataset, replayPlaying, replaySpeed]);

  useEffect(() => {
    if (!replayActive && !replaySelecting) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, select, textarea, button, [contenteditable='true']")) return;
      if (event.key === "Escape") {
        if (replayActive) exitBarReplay();
        else cancelBarReplaySelection();
        event.preventDefault();
      } else if (replayActive && event.code === "Space") {
        setReplayPlaying((playing) => !playing);
        event.preventDefault();
      } else if (replayActive && event.key === "ArrowRight") {
        stepBarReplay(1);
        event.preventDefault();
      } else if (replayActive && event.key === "ArrowLeft") {
        stepBarReplay(-1);
        event.preventDefault();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [
    cancelBarReplaySelection,
    exitBarReplay,
    replayActive,
    replaySelecting,
    stepBarReplay,
  ]);

  useEffect(() => {
    if (replayDataset !== undefined && replayDataset.seriesKey !== currentSeriesKey) {
      setReplayDataset(undefined);
      setReplayPlaying(false);
    }
    setReplaySelecting(false);
    setReplaySelectionError("");
  }, [currentSeriesKey, replayDataset]);

  const hasLiveTrailing = hasLiveSupertrendTrailing(
    supertrendTrailings,
    mt5OpenTrades.positions,
  );
  useEffect(() => {
    const hadLiveTrailing = hadLiveSupertrendTrailingRef.current;
    hadLiveSupertrendTrailingRef.current = hasLiveTrailing;
    if (hasLiveTrailing && !supertrend.enabled) {
      setSupertrend((current) =>
        current.enabled ? current : { ...current, enabled: true },
      );
    } else if (!hasLiveTrailing && hadLiveTrailing && supertrend.enabled) {
      setSupertrend((current) =>
        current.enabled ? { ...current, enabled: false } : current,
      );
    }
  }, [hasLiveTrailing, supertrend.enabled]);

  const firstLoadedBarTime = hasLoadedCurrentSeries ? bars[0]?.time : undefined;
  const latestLoadedBarTime = hasLoadedCurrentSeries
    ? bars[bars.length - 1]?.time
    : undefined;
  const latestExtendRightBarTime =
    extendRightLiveBar?.seriesKey === currentSeriesKey
      ? Math.max(latestLoadedBarTime ?? 0, extendRightLiveBar.time)
      : latestLoadedBarTime;

  const refreshTradingState = useCallback(async () => {
    if (!executionEnabled) return undefined;
    const requestedUser = authUserIdRef.current;
    if (!requestedUser) return undefined;
    const sequence = ++tradingRefreshRef.current.requested;
    const snapshot = await api.exnessState().catch(() => undefined);
    if (!snapshot || authUserIdRef.current !== requestedUser || sequence < tradingRefreshRef.current.applied) return undefined;
    tradingRefreshRef.current.applied = sequence;
    const account = snapshot.account ?? undefined;
    const snapshotAccountKey = account?.connected
      ? `${requestedUser}:${account.accountId ?? account.login ?? ""}`
      : "";
    if (connectedAccountKeyRef.current !== snapshotAccountKey) {
      accountGenerationRef.current += 1;
      setMt5Symbol(undefined);
      mt5SymbolRef.current = undefined;
      resetOrderPendingAndOptimisticState();
    }
    setMt5Account((current) => mt5AccountsEqual(current, account) ? current : account);
    if (account?.connected && (!mt5SymbolRef.current || (mt5SymbolRef.current.pipValue ?? 0) <= 0)) {
      const targetGen = accountGenerationRef.current;
      const reqId = ++symbolRequestIdRef.current;
      void api.mt5Symbol().then((symbol) => {
        if (
          authUserIdRef.current === requestedUser &&
          connectedAccountKeyRef.current === snapshotAccountKey &&
          accountGenerationRef.current === targetGen &&
          symbolRequestIdRef.current === reqId
        ) {
          setMt5Symbol(symbol);
          mt5SymbolRef.current = symbol;
        }
      }).catch(() => {});
    }
    setOrders((current) => JSON.stringify(current) === JSON.stringify(snapshot.orders) ? current : snapshot.orders);
    setMt5OpenTrades((current) => JSON.stringify(current) === JSON.stringify(snapshot.trades) ? current : snapshot.trades);
    setSupertrendTrailings(supertrendTrailingMap(snapshot.trailings));
    setExnessActionError(snapshot.actionError ?? "");
    setOrderDragPreviews((current) => reconcileOrderDragPreviews(current, sequence, snapshot));
    return { orders: snapshot.orders, openTrades: snapshot.trades };
  }, [api, executionEnabled]);

  useEffect(() => {
    if (!authUser || !executionEnabled) return;
    void refreshTradingState();
  }, [authUser, executionEnabled, refreshTradingState]);

  useEffect(() => {
    if (!authUser || !connectedAccountKey || !executionEnabled) return;
    let cancelled = false;
    const targetGen = accountGenerationRef.current;
    const reqId = ++symbolRequestIdRef.current;
    void api.mt5Symbol().then((symbol) => {
      if (
        !cancelled &&
        authUserIdRef.current === authUser.id &&
        connectedAccountKeyRef.current === connectedAccountKey &&
        accountGenerationRef.current === targetGen &&
        symbolRequestIdRef.current === reqId
      ) {
        setMt5Symbol(symbol);
        mt5SymbolRef.current = symbol;
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [api, authUser, executionEnabled, connectedAccountKey]);

  const scheduleDeltaProfileRefresh = useCallback(() => {
    if (deltaProfileRefreshTimerRef.current !== undefined) {
      window.clearTimeout(deltaProfileRefreshTimerRef.current);
    }
    deltaProfileRefreshTimerRef.current = window.setTimeout(() => {
      deltaProfileRefreshTimerRef.current = undefined;
      setDeltaProfileRefreshNonce((nonce) => nonce + 1);
    }, DELTA_PROFILE_REFRESH_DELAY_MS);
  }, []);
  const onChartRealtimeBar = useCallback(
    (bar: Bar, closed?: boolean) => {
      cache.append(
        { symbol: SYMBOL, contract, timeframe },
        [{ ...bar, ...(closed !== undefined ? { closed } : {}) }],
      );
      if (closed === true && timeframe === "1m") {
        setMgannBreakLatestClosedTime(bar.time);
      }
      setExtendRightLiveBar((current) =>
        current?.seriesKey === currentSeriesKey && current.time === bar.time
          ? current
          : { seriesKey: currentSeriesKey, time: bar.time },
      );
      if (
        fixedRangeDeltaProfileDrawings(drawingsRef.current).some(
          (drawing) => drawing.options?.fixedRangeProfileExtendRight === true,
        )
      ) {
        scheduleDeltaProfileRefresh();
      }
    },
    [cache, contract, currentSeriesKey, scheduleDeltaProfileRefresh, timeframe],
  );

  const requestMoreHistory = useCallback(() => {
    if (!profileHydrated || !hasLoadedCurrentSeries || bars.length === 0) {
      return;
    }
    const firstBar = bars[0];
    if (!Number.isFinite(firstBar.time) || firstBar.time <= 0) {
      return;
    }
    const state = historyBackfillRef.current;
    if (
      state.pending ||
      state.seriesKey !== currentSeriesKey ||
      state.exhaustedBefore === firstBar.time
    ) {
      return;
    }

    state.pending = true;
    const requestedSeriesKey = currentSeriesKey;
    const requestKey = { symbol: SYMBOL, contract, timeframe };
    const to = firstBar.time - 1;
    const backfillLimit = historyBackfillLimit(timeframe);

    void (async () => {
      try {
        const response = await fetch(
          buildHistoryUrl(
            {
              ...requestKey,
              to,
              limit: backfillLimit,
            },
            endpoints.api,
          ),
        );
        if (!response.ok) return;
        const body = (await response.json()) as Partial<HistoryResponse> | null;
        const fetchedBars = Array.isArray(body?.bars) ? body.bars : [];
        if (activeSeriesKeyRef.current !== requestedSeriesKey) return;

        if (fetchedBars.length === 0) {
          state.exhaustedBefore = firstBar.time;
          return;
        }

        cache.merge(requestKey, fetchedBars, {
          from: fetchedBars[0].time,
          to,
        });
        if (fetchedBars.length < backfillLimit) {
          state.exhaustedBefore = fetchedBars[0].time;
        }
        const nextSeries = cache.get(requestKey)?.bars ?? [];
        setLoadedSeriesKey(requestedSeriesKey);
        setBars(nextSeries);
        // A successful 15s backfill replaces the temporary 1m fallback with
        // bars from the requested series. Recursive indicators must follow
        // that real source timeframe from this point onward.
        setLoadedBarsTimeframe(timeframe);
      } finally {
        if (historyBackfillRef.current.seriesKey === requestedSeriesKey) {
          historyBackfillRef.current.pending = false;
        }
      }
    })();
  }, [
    bars,
    cache,
    contract,
    currentSeriesKey,
    endpoints.api,
    hasLoadedCurrentSeries,
    profileHydrated,
    timeframe,
  ]);

  useEffect(() => {
    persistMarketOrderSettings(marketOrderSettings);
  }, [marketOrderSettings]);

  useEffect(() => {
    if (!authUser || !profileHydrated) return;
    const timer = window.setTimeout(() => {
      persistProfileHotSnapshot(authUser.id, profileId, profilePayload);
    }, 2_000);
    return () => window.clearTimeout(timer);
  }, [authUser, profileHydrated, profileId, profilePayload]);

  useEffect(() => {
    if (!authUser || !profileHydrated) return;
    const persistSnapshot = () => {
      persistProfileHotSnapshot(authUser.id, profileId, profilePayload);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") persistSnapshot();
    };
    window.addEventListener("pagehide", persistSnapshot);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", persistSnapshot);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [authUser, profileHydrated, profileId, profilePayload]);

  useEffect(
    () => () => {
      if (deltaProfileRefreshTimerRef.current !== undefined) {
        window.clearTimeout(deltaProfileRefreshTimerRef.current);
        deltaProfileRefreshTimerRef.current = undefined;
      }
    },
    [],
  );

  useEffect(() => {
    const extended = extendRightFixedRangeProfiles(
      drawings,
      latestExtendRightBarTime,
      timeframe,
    );
    if (!extended.changed) return;
    setDrawings(extended.drawings);
    setDrawingsLoadKey((key) => key + 1);
  }, [drawings, latestExtendRightBarTime, timeframe]);

  useEffect(() => {
    const jobs = fixedRangeDeltaProfileDrawings(drawings).flatMap((drawing) => {
      const range = fixedRangeMsFromAnchors(drawing.anchors, timeframe);
      if (range === null) return [];
      const mode = normalizeFixedRangeProfileMode(
        drawing.options?.fixedRangeProfileMode,
      );
      const source = fixedRangeDeltaProfileSource(mode);
      const rowTicks = fixedRangeDeltaProfileRowTicks(mode);
      const requestKey = [
        contract,
        timeframe,
        range.from,
        range.to,
        source,
        rowTicks,
        DELTA_PROFILE_VALUE_AREA_PCT,
      ].join(":");
      const fetchKey = `${requestKey}:${deltaProfileRefreshNonce}`;
      return [{ drawing, range, requestKey, fetchKey, source, rowTicks }];
    });
    const activeIds = new Set(jobs.map((job) => job.drawing.id));
    for (const id of [...deltaProfileRequestKeysRef.current.keys()]) {
      if (!activeIds.has(id)) {
        deltaProfileRequestKeysRef.current.delete(id);
        deltaProfileFetchKeysRef.current.delete(id);
      }
    }
    const jobsToFetch = jobs.filter((job) => {
      if (deltaProfileFetchKeysRef.current.get(job.drawing.id) === job.fetchKey) {
        return false;
      }
      deltaProfileRequestKeysRef.current.set(job.drawing.id, job.requestKey);
      deltaProfileFetchKeysRef.current.set(job.drawing.id, job.fetchKey);
      return true;
    });

    setFixedRangeDeltaProfiles((prev) => {
      const next = new Map(prev);
      for (const id of [...next.keys()]) {
        if (!activeIds.has(id)) next.delete(id);
      }
      for (const job of jobsToFetch) {
        const current = next.get(job.drawing.id);
        if (!current || current.status !== "ready") {
          next.set(job.drawing.id, { status: "loading" });
        }
      }
      return next;
    });

    for (const job of jobsToFetch) {
      void api
        .deltaProfile({
          symbol: SYMBOL,
          contract,
          from: job.range.from,
          to: job.range.to,
          rowTicks: job.rowTicks,
          valueAreaPct: DELTA_PROFILE_VALUE_AREA_PCT,
          source: job.source,
        })
        .then((profile) => {
          if (
            deltaProfileRequestKeysRef.current.get(job.drawing.id) !== job.requestKey
          ) {
            return;
          }
          setFixedRangeDeltaProfiles((prev) => {
            const next = new Map(prev);
            next.set(job.drawing.id, { status: "ready", profile });
            return next;
          });
        })
        .catch((error) => {
          if (
            deltaProfileRequestKeysRef.current.get(job.drawing.id) !== job.requestKey
          ) {
            return;
          }
          setFixedRangeDeltaProfiles((prev) => {
            const current = prev.get(job.drawing.id);
            if (current?.status === "ready") {
              return prev;
            }
            const next = new Map(prev);
            next.set(job.drawing.id, {
              status: "error",
              error: error instanceof Error ? error.message : "Delta profile failed",
            });
            return next;
          });
        });
    }
  }, [
    api,
    contract,
    deltaProfileRefreshNonce,
    drawings,
    timeframe,
  ]);

  // Fetch delta profile for the session volume profile (right-edge histogram).
  useEffect(() => {
    if (!showDailyVolumeProfile) {
      setSessionVolumeProfile(null);
      return;
    }
    const safeDays = normalizeSessionVolumeProfileDays(dailyVolumeProfileDays);
    const safeRowTicks = normalizeSessionVolumeProfileRowTicks(dailyVolumeProfileRowTicks);
    let cancelled = false;
    const fetchProfile = () => {
      const now = Date.now();
      const fromMs = computeSessionVolumeProfileFromMs(now, safeDays);
      void api
        .deltaProfile({
          symbol: SYMBOL,
          contract,
          from: fromMs,
          to: now,
          rowTicks: safeRowTicks,
          valueAreaPct: DELTA_PROFILE_VALUE_AREA_PCT,
          source: "footprint_cache",
        })
        .then((profile) => {
          if (!cancelled) setSessionVolumeProfile(profile);
        })
        .catch(() => {
          if (!cancelled) setSessionVolumeProfile(null);
        });
    };
    fetchProfile();
    const timer = window.setInterval(fetchProfile, 65_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [api, contract, showDailyVolumeProfile, dailyVolumeProfileDays, dailyVolumeProfileRowTicks]);

  // Connect once and refresh chart data when the socket reconnects.
  useEffect(() => {
    const reconnect = () => {
      socket.ensureConnected(SOCKET_IDLE_TIMEOUT_MS, SOCKET_TRANSITION_TIMEOUT_MS);
    };
    const offOpen = socket.onOpen(() => {
      // Re-fetch REST history after reconnect so bars missed while the socket
      // was unavailable are patched without requiring a browser reload. Overlay
      // events can be missed the same way, so refresh them from REST too.
      setSocketGeneration((generation) => generation + 1);
      setOverlayRefreshNonce((generation) => generation + 1);
    });
    socket.connect();
    const reconnectTimer = window.setInterval(reconnect, 5000);
    const offAlert = socket.on("alert_event", (msg) => {
      if ((msg.profileId ?? DEFAULT_PROFILE_ID) === profileIdRef.current) {
        if (msg.alertType !== "price_crosses_level") {
          setAlerts((prev) =>
            prev.map((alert) =>
              alert.id === msg.alertId && alert.params.repeat !== true
                ? { ...alert, enabled: false }
                : alert,
            ),
          );
        }
        setLastAlert(msg);
        const marker = alertEventToSignalMarker(msg);
        const sourceAlert = alertsRef.current.find(
          (alert) => alert.id === msg.alertId,
        );
        if (
          marker !== undefined &&
          sourceAlert !== undefined &&
          mgannBreakSettingsMatchParams(
            mgannBreakSettingsRef.current,
            sourceAlert.params,
          )
        ) {
          setAlertSignalMarkers((prev) => mergeAlertSignalMarker(prev, marker));
        }
      }
    });
    return () => {
      window.clearInterval(reconnectTimer);
      offOpen();
      offAlert();
      socket.close();
    };
  }, [socket]);

  useEffect(() => {
    const refreshAfterResume = () => {
      if (document.visibilityState === "hidden") {
        return;
      }
      const now = Date.now();
      if (now - resumeRefreshAtRef.current < RESUME_REFRESH_THROTTLE_MS) {
        return;
      }
      resumeRefreshAtRef.current = now;
      socket.ensureConnected(SOCKET_IDLE_TIMEOUT_MS, SOCKET_TRANSITION_TIMEOUT_MS);
      setSocketGeneration((generation) => generation + 1);
      setOverlayRefreshNonce((generation) => generation + 1);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshAfterResume();
      }
    };
    window.addEventListener("pageshow", refreshAfterResume);
    window.addEventListener("focus", refreshAfterResume);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pageshow", refreshAfterResume);
      window.removeEventListener("focus", refreshAfterResume);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [socket]);

  // Keep always-needed global events subscribed once. Heavy overlays are
  // subscribed separately only while they are visible.
  useEffect(() => {
    socket.subscribe(SYMBOL, GLOBAL_SUBSCRIBED_EVENTS);
    return () => {
      socket.unsubscribe(SYMBOL, GLOBAL_SUBSCRIBED_EVENTS);
    };
  }, [socket]);

  useEffect(() => {
    if (!realtimeFootprintEnabled) {
      return;
    }
    socket.subscribe(SYMBOL, FOOTPRINT_SUBSCRIBED_EVENTS, "1m");
    return () => {
      socket.unsubscribe(SYMBOL, FOOTPRINT_SUBSCRIBED_EVENTS, "1m");
    };
  }, [socket, realtimeFootprintEnabled]);

  useEffect(() => {
    if (!realtimeBigTradesEnabled) {
      return;
    }
    socket.subscribe(SYMBOL, BIG_TRADE_SUBSCRIBED_EVENTS);
    return () => {
      socket.unsubscribe(SYMBOL, BIG_TRADE_SUBSCRIBED_EVENTS);
    };
  }, [socket, realtimeBigTradesEnabled]);

  // Resolve profile-scoped alerts when the active profile changes.
  useEffect(() => {
    if (!authUser || !profileHydrated) {
      setAlerts([]);
      setLastAlert(undefined);
      setAlertSignalMarkers([]);
      return;
    }
    let cancelled = false;
    setLastAlert(undefined);
    setAlertSignalMarkers([]);
    void (async () => {
      try {
        const a = await api.alerts(profileId);
        if (!cancelled) setAlerts(a);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, authUser, profileHydrated, profileId]);

  useEffect(() => {
    setWebPushSupported(isWebPushSupported());
  }, []);

  useEffect(() => {
    if (!authUser || !profileHydrated) {
      setTelegramConfig({
        enabled: false,
        chatId: "",
        sendScreenshot: true,
        hasBotToken: false,
      });
      setTelegramStatus("");
      return;
    }
    let cancelled = false;
    setTelegramStatus("");
    void (async () => {
      try {
        const config = await api.telegramConfig(profileId);
        if (!cancelled) setTelegramConfig(config);
      } catch {
        if (!cancelled) {
          setTelegramConfig({
            enabled: false,
            chatId: "",
            sendScreenshot: true,
            hasBotToken: false,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, authUser, profileHydrated, profileId]);

  useEffect(() => {
    if (!authUser || !profileHydrated) {
      setWebPushConfig({
        enabled: false,
        subscriptionCount: 0,
        publicKey: "",
      });
      setWebPushStatus("");
      return;
    }
    let cancelled = false;
    setWebPushStatus("");
    void (async () => {
      try {
        const config = await api.webPushConfig(profileId);
        if (!cancelled) setWebPushConfig(config);
      } catch {
        if (!cancelled) {
          setWebPushConfig({
            enabled: false,
            subscriptionCount: 0,
            publicKey: "",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, authUser, profileHydrated, profileId]);

  // (Re)subscribe + load history whenever the charted series identity changes.
  useEffect(() => {
    if (!profileHydrated) return;
    const requestedSeriesKey = seriesDataKey(SYMBOL, contract, timeframe);
    let cancelled = false;
    let deltaTimer: number | undefined;
    void (async () => {
      try {
        const initialWindow = initialHistoryWindow(timeframe);
        let history = await historyLoader.current!.load({
          symbol: SYMBOL,
          contract,
          timeframe,
          ...initialWindow,
        });
        let indicatorTimeframe = timeframe;
        if (timeframe === "15s" && history.bars.length === 0) {
          const fallbackWindow = initialHistoryWindow(
            SUB_MINUTE_HISTORY_FALLBACK_TF,
          );
          history = await historyLoader.current!.load({
            symbol: SYMBOL,
            contract,
            timeframe: SUB_MINUTE_HISTORY_FALLBACK_TF,
            ...fallbackWindow,
          });
          indicatorTimeframe = SUB_MINUTE_HISTORY_FALLBACK_TF;
        }
        if (!cancelled) {
          setLoadedSeriesKey(requestedSeriesKey);
          setBars(history.bars);
          setLoadedBarsTimeframe(indicatorTimeframe);
          const loadedLatestPrice = history.bars[history.bars.length - 1]?.close;
          latestPriceRef.current = loadedLatestPrice;
          setLatestPrice(loadedLatestPrice);
          setSmcAiSignals([]);
          deltaTimer = window.setTimeout(() => {
            void (async () => {
              try {
                const delta = await api.volumeDelta(
                  SYMBOL,
                  contract,
                  indicatorTimeframe,
                  INITIAL_VOLUME_DELTA_LIMIT,
                );
                if (!cancelled) {
                  setVolumeDeltaSeriesKey(requestedSeriesKey);
                  let runningCvd = 0;
                  setVolumeDelta(delta.map((point) => {
                    const explicit = point.cumulativeDelta;
                    const cumulativeDelta =
                      explicit !== undefined && Number.isFinite(explicit)
                        ? explicit
                        : runningCvd + point.closeDelta;
                    runningCvd = cumulativeDelta;
                    return {
                      time: point.time,
                      volume: point.volume,
                      buyVolume: point.buyVolume,
                      sellVolume: point.sellVolume,
                      delta: point.delta,
                      deltaHigh: point.deltaHigh,
                      deltaLow: point.deltaLow,
                      openDelta: point.openDelta,
                      closeDelta: point.closeDelta,
                      cumulativeDelta,
                    };
                  }));
                }
              } catch {
                if (!cancelled) {
                  setVolumeDeltaSeriesKey(requestedSeriesKey);
                  setVolumeDelta([]);
                }
              }
            })();
          }, DEFERRED_INDICATOR_LOAD_MS);
        }
      } catch {
        if (!cancelled) {
          setLoadedSeriesKey(requestedSeriesKey);
          setBars([]);
          setLoadedBarsTimeframe(timeframe);
          latestPriceRef.current = undefined;
          setLatestPrice(undefined);
          setVolumeDeltaSeriesKey(requestedSeriesKey);
          setVolumeDelta([]);
          setSmcAiSignals([]);
        }
      }
    })();
    return () => {
      cancelled = true;
      if (deltaTimer !== undefined) {
        window.clearTimeout(deltaTimer);
      }
    };
  }, [api, socket, contract, timeframe, socketGeneration, profileHydrated]);

  useEffect(() => {
    if (
      !profileHydrated ||
      !hasLoadedCurrentSeries ||
      timeframe !== "1m" ||
      firstLoadedBarTime === undefined ||
      latestLoadedBarTime === undefined
    ) {
      setAlertSignalMarkers((prev) =>
        prev.some((marker) => marker.id.includes(":hist:"))
          ? prev.filter((marker) => !marker.id.includes(":hist:"))
          : prev,
      );
      return;
    }

    const latestSignalTime = Math.max(
      latestLoadedBarTime,
      mgannBreakLatestClosedTime ?? latestLoadedBarTime,
    );
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const signals = await api.mgannBigTradeSweepSignals({
            symbol: SYMBOL,
            contract,
            timeframe,
            profileId,
            from: Math.max(
              firstLoadedBarTime,
              latestSignalTime -
                mgannBreakSignalHistoryBars * 60_000,
            ),
            to: latestSignalTime,
            limit: mgannBreakSignalLimit,
            settings: mgannBreakSettings,
          });
          if (!cancelled) {
            setAlertSignalMarkers((prev) =>
              replaceHistoricalAlertSignalMarkers(
                prev,
                signals.flatMap((signal) => {
                  const marker = alertSignalRowToMarker(signal);
                  return marker === undefined ? [] : [marker];
                }),
              ),
            );
          }
        } catch {
          if (!cancelled) {
            setAlertSignalMarkers((prev) =>
              prev.some((marker) => marker.id.includes(":hist:"))
                ? prev.filter((marker) => !marker.id.includes(":hist:"))
                : prev,
            );
          }
        }
      })();
    }, DEFERRED_OVERLAY_LOAD_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    api,
    contract,
    firstLoadedBarTime,
    hasLoadedCurrentSeries,
    latestLoadedBarTime,
    mgannBreakLatestClosedTime,
    mgannBreakSignalHistoryBars,
    mgannBreakSignalLimit,
    mgannBreakSettings,
    profileHydrated,
    profileId,
    timeframe,
  ]);

  useEffect(() => {
    setLoadedOverlayContract(undefined);
    setFootprintBars(new Map());
    setFvgSignals(new Map());
    setFvgSignalSeriesKey(undefined);
    setTduSignals(new Map());
    setTduSignalSeriesKey(undefined);
    setBigTrades([]);
    setSmcAiSignals([]);
  }, [contract]);

  useEffect(() => {
    if (!realtimeFootprintEnabled) {
      setLoadedOverlayContract(undefined);
      return;
    }
    if (!hasLoadedCurrentSeries || loadedOverlayContract === contract) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        let footprint: Awaited<ReturnType<ApiClient["footprint"]>> | undefined;
        try {
          footprint = await api.footprint(
            SYMBOL,
            contract,
            MAX_RETAINED_LIVE_FOOTPRINT_BARS,
          );
        } catch {
          footprint = undefined;
        }
        if (cancelled) return;
        if (footprint !== undefined) {
          setFootprintBars(new Map(footprint.map((bar) => [bar.time, bar])));
        }
        setLoadedOverlayContract(contract);
      })();
    }, DEFERRED_OVERLAY_LOAD_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    api,
    contract,
    hasLoadedCurrentSeries,
    loadedOverlayContract,
    realtimeFootprintEnabled,
  ]);

  useEffect(() => {
    if (!realtimeBigTradesEnabled || !hasLoadedCurrentSeries) {
      return;
    }
    let cancelled = false;
    const loadBigTrades = () => {
      if (document.visibilityState === "hidden") {
        return;
      }
      void (async () => {
        const bigTradeResult = await Promise.allSettled([
          api.bigTrades(SYMBOL, contract, INITIAL_BIG_TRADE_LIMIT),
        ]);
        if (cancelled) {
          return;
        }
        const loadedBigTrades =
          bigTradeResult[0].status === "fulfilled"
            ? bigTradeResult[0].value
            : undefined;
        if (loadedBigTrades !== undefined) {
          setBigTrades((prev) =>
            reduceBigTradesCapped(
              prev,
              loadedBigTrades,
              MAX_RETAINED_BIG_TRADE_MARKERS,
            ),
          );
        }
      })();
    };
    const timer = window.setTimeout(loadBigTrades, DEFERRED_OVERLAY_LOAD_MS);
    const interval = window.setInterval(
      loadBigTrades,
      REALTIME_OVERLAY_CATCH_UP_MS,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [
    api,
    contract,
    timeframe,
    hasLoadedCurrentSeries,
    overlayRefreshNonce,
    realtimeBigTradesEnabled,
  ]);

  useEffect(() => {
    if (timeframe !== "1m") {
      return;
    }
    if (!hasLoadedCurrentSeries || !showFvgGrader) {
      return;
    }
    let cancelled = false;
    const loadFvgSignals = () => {
      if (document.visibilityState === "hidden") {
        return;
      }
      void api
        .fvgSignals(SYMBOL, contract, fvgSignalLimit)
        .then((signals) => {
          if (cancelled) return;
          setFvgSignals((prev) => {
            if (fvgSignalsEqual(prev, signals)) {
              return prev;
            }
            const next = new Map<number, FvgSignalUpdateMessage>();
            for (const signal of signals) {
              if (signal.phase !== "clear" && signal.pulse !== 0) {
                next.set(signal.time, signal);
              }
            }
            return next;
          });
          setFvgSignalSeriesKey(currentSeriesKey);
        })
        .catch(() => {
          if (cancelled) return;
          setFvgSignalSeriesKey((key) =>
            key === currentSeriesKey ? key : currentSeriesKey,
          );
        });
    };
    const timer = window.setTimeout(loadFvgSignals, DEFERRED_OVERLAY_LOAD_MS);
    const interval = window.setInterval(loadFvgSignals, FVG_GRADER_CATCH_UP_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [
    api,
    contract,
    timeframe,
    hasLoadedCurrentSeries,
    currentSeriesKey,
    overlayRefreshNonce,
    showFvgGrader,
    fvgSignalLimit,
  ]);

  useEffect(() => {
    if (
      !hasLoadedCurrentSeries ||
      !showTduSignals ||
      !tduSignalsEnabledForTimeframe(timeframe)
    ) {
      return;
    }
    let cancelled = false;
    const loadTduSignals = () => {
      if (document.visibilityState === "hidden") return;
      void api
        .tduSignals(SYMBOL, contract, timeframe, DEFAULT_INITIAL_HISTORY_LIMIT)
        .then((signals) => {
          if (cancelled) return;
          setTduSignals(
            new Map(signals.map((signal) => [signal.time, signal] as const)),
          );
          setTduSignalSeriesKey(currentSeriesKey);
        })
        .catch(() => {
          if (!cancelled) setTduSignalSeriesKey(currentSeriesKey);
        });
    };
    const timer = window.setTimeout(loadTduSignals, DEFERRED_OVERLAY_LOAD_MS);
    const interval = window.setInterval(
      loadTduSignals,
      REALTIME_OVERLAY_CATCH_UP_MS,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [
    api,
    contract,
    timeframe,
    hasLoadedCurrentSeries,
    currentSeriesKey,
    showTduSignals,
  ]);

  useEffect(() => {
    const matchesChartContract = (messageContract: string) =>
      contract === SYMBOL || messageContract === contract;
    const flushFootprint = () => {
      footprintRenderTimerRef.current = undefined;
      const pending = pendingFootprintRef.current;
      pendingFootprintRef.current = undefined;
      if (pending === undefined) return;
      setFootprintBars((prev) =>
        mergeFootprintCapped(
          prev,
          pending,
          MAX_RETAINED_LIVE_FOOTPRINT_BARS,
        ),
      );
      if (
        fixedRangeDeltaProfileDrawings(drawingsRef.current).some((drawing) =>
          footprintTouchesFixedRange(pending.time, drawing, timeframe),
        )
      ) {
        scheduleDeltaProfileRefresh();
      }
    };
    const queueFootprintRender = (message: FootprintUpdateMessage) => {
      // Footprint is latest-state data for the forming 1m bar. Replace the
      // pending snapshot so a burst causes one React render, not one per frame.
      pendingFootprintRef.current = message;
      if (footprintRenderTimerRef.current !== undefined) return;
      footprintRenderTimerRef.current = window.setTimeout(
        flushFootprint,
        REALTIME_RENDER_BATCH_MS,
      );
    };
    const flushBigTrades = () => {
      bigTradeRenderTimerRef.current = undefined;
      const pending = pendingBigTradesRef.current;
      pendingBigTradesRef.current = [];
      if (pending.length === 0) return;
      setBigTrades((prev) =>
        reduceBigTradesCapped(
          prev,
          pending,
          MAX_RETAINED_BIG_TRADE_MARKERS,
        ),
      );

      // A burst should produce at most one audible notification. Creating an
      // AudioContext per trade is especially expensive during volatile moves.
      const bts = bigTradeSettingsRef.current;
      const now = Date.now();
      if (
        bts.soundEnabled &&
        now - lastBigTradeSoundAtRef.current >= BIG_TRADE_SOUND_COOLDOWN_MS &&
        pending.some(
          (message) =>
            message.volume >= bigTradeMinVolumeForTime(message.time, bts),
        )
      ) {
        lastBigTradeSoundAtRef.current = now;
        playBigTradeSound();
      }
    };
    const queueBigTradeRender = (message: BigTradeMessage) => {
      pendingBigTradesRef.current.push(message);
      if (bigTradeRenderTimerRef.current !== undefined) return;
      bigTradeRenderTimerRef.current = window.setTimeout(
        flushBigTrades,
        REALTIME_RENDER_BATCH_MS,
      );
    };
    const offBarPrice = socket.on("bar_update", (msg) => {
      if (
        msg.symbol === SYMBOL &&
        matchesChartContract(msg.contract) &&
        msg.tf === timeframe
      ) {
        publishLatestPrice(msg.bar.close);
      }
    });
    const offQuotePrice = socket.on("quote_update", (msg) => {
      if (msg.symbol === SYMBOL && matchesChartContract(msg.contract)) {
        publishLatestPrice((msg.bid + msg.ask) / 2);
      }
    });
    const offFootprint = realtimeFootprintEnabled
      ? socket.on("footprint_update", (msg) => {
          if (
            msg.symbol !== SYMBOL ||
            !matchesChartContract(msg.contract) ||
            msg.tf !== "1m"
          ) {
            return;
          }
          queueFootprintRender(msg);
        })
      : () => {};
    const offBigTrade = realtimeBigTradesEnabled
      ? socket.on("big_trade", (msg) => {
          if (
            msg.symbol !== SYMBOL ||
            !matchesChartContract(msg.contract)
          ) {
            return;
          }
          queueBigTradeRender(msg);
        })
      : () => {};
    const offFvgSignal = socket.on("fvg_signal_update", (msg) => {
      if (
        msg.symbol !== SYMBOL ||
        !matchesChartContract(msg.contract) ||
        msg.tf !== "1m"
      ) {
        return;
      }
      setFvgSignalSeriesKey(seriesDataKey(SYMBOL, contract, "1m"));
      setFvgSignals((prev) => {
        const next = new Map(prev);
        if (msg.phase === "clear" || msg.pulse === 0) {
          next.delete(msg.time);
        } else {
          next.set(msg.time, msg);
        }
        return next;
      });
    });
    const offTduSignal = socket.on("tdu_signal_update", (msg) => {
      if (
        msg.symbol !== SYMBOL ||
        !matchesChartContract(msg.contract) ||
        !tduSignalsEnabledForTimeframe(timeframe) ||
        msg.tf !== timeframe
      ) {
        return;
      }
      setTduSignalSeriesKey(seriesDataKey(SYMBOL, contract, timeframe));
      setTduSignals((prev) => {
        const next = new Map(prev);
        next.set(msg.time, msg);
        return next;
      });
    });
    return () => {
      offBarPrice();
      offQuotePrice();
      offFootprint();
      offBigTrade();
      offFvgSignal();
      offTduSignal();
      if (footprintRenderTimerRef.current !== undefined) {
        window.clearTimeout(footprintRenderTimerRef.current);
        footprintRenderTimerRef.current = undefined;
      }
      pendingFootprintRef.current = undefined;
      if (bigTradeRenderTimerRef.current !== undefined) {
        window.clearTimeout(bigTradeRenderTimerRef.current);
        bigTradeRenderTimerRef.current = undefined;
      }
      pendingBigTradesRef.current = [];
      if (latestPriceThrottleRef.current !== undefined) {
        window.clearTimeout(latestPriceThrottleRef.current);
        latestPriceThrottleRef.current = undefined;
      }
      latestPricePendingRef.current = undefined;
    };
  }, [
    socket,
    contract,
    timeframe,
    scheduleDeltaProfileRefresh,
    publishLatestPrice,
    realtimeFootprintEnabled,
    realtimeBigTradesEnabled,
  ]);

  const onToggleAlert = (id: string, enabled: boolean) => {
    if (!authUser) {
      onTradingLogin();
      return;
    }
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, enabled } : a)));
    void api.patchAlert(id, enabled, profileId);
  };
  const onDeleteAlert = (id: string) => {
    if (!authUser) {
      onTradingLogin();
      return;
    }
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    setAlertSignalMarkers((prev) =>
      prev.filter((marker) => !marker.id.startsWith(`${id}:`)),
    );
    void api.deleteAlert(id, profileId);
  };
  const onCreateAlert = (input: {
    type: Alert["type"];
    params: Record<string, number | string | boolean>;
  }) => {
    if (!authUser) {
      onTradingLogin();
      return;
    }
    void (async () => {
      try {
        const created = await api.createAlert({
          symbol: SYMBOL,
          type: input.type,
          params: input.params,
          profileId,
        });
        setAlerts((prev) => [...prev, created]);
      } catch {
        /* ignore â€” surfaced by the disabled state in a later iteration */
      }
    })();
  };
  const onSaveTelegram = (input: TelegramNotificationInput) => {
    if (!authUser) {
      onTradingLogin();
      return;
    }
    setTelegramStatus("Saving...");
    void (async () => {
      try {
        const saved = await api.saveTelegramConfig(input, profileId);
        setTelegramConfig(saved);
        setTelegramStatus("Saved");
      } catch (error) {
        setTelegramStatus(
          error instanceof Error ? `Save failed: ${error.message}` : "Save failed",
        );
      }
    })();
  };
  const onTestTelegram = () => {
    if (!authUser) {
      onTradingLogin();
      return;
    }
    setTelegramStatus("Sending test...");
    void (async () => {
      try {
        await api.testTelegramConfig(profileId);
        setTelegramStatus("Test sent");
      } catch (error) {
        setTelegramStatus(
          error instanceof Error ? `Test failed: ${error.message}` : "Test failed",
        );
      }
    })();
  };
  const onCreateSweepReversalAlert = () => {
    const settings = normalizeSweepReversalSettings(sweepReversal);
    onCreateAlert({
      type: "sweep_reversal",
      params: {
        timeframe,
        swingLength: settings.swingLength,
        atrLength: settings.atrLength,
        minPenetrationAtr: settings.minPenetrationAtr,
        structureLength: settings.structureLength,
        maxConfirmationBars: settings.maxConfirmationBars,
        minDisplacementAtr: settings.minDisplacementAtr,
        equalSwingFilter: settings.equalSwingFilter,
        liquidityMinPivots: settings.liquidityMinPivots,
        liquidityLookbackBars: settings.liquidityLookbackBars,
        liquidityAtrLength: settings.liquidityAtrLength,
        liquidityAtrMargin: settings.liquidityAtrMargin,
        repeat: true,
      },
    });
  };
  const onCreateSupertrendAlert = () => {
    if (timeframe === "15s") return;
    const settings = normalizeSupertrendSettings(supertrend);
    onCreateAlert({
      type: "supertrend_direction_change",
      params: {
        timeframe,
        period: settings.period,
        multiplier: settings.multiplier,
        atrMethod: settings.atrMethod,
        source: settings.source,
        direction: "both",
        repeat: true,
      },
    });
  };
  const onCreateMgannBreakAlert = () => {
    onCreateAlert({
      type: "mgann_break_ls",
      params: mgannBreakAlertParams(mgannBreakSettings),
    });
  };
  const onMgannBreakSettingsChange = (next: MgannBreakSettings) => {
    setAlertSignalMarkers([]);
    setMgannBreakSettings(next);
  };
  const onEnableWebPush = () => {
    if (!authUser) {
      onTradingLogin();
      return;
    }
    if (!webPushSupported) {
      setWebPushStatus("Not supported here");
      return;
    }
    setWebPushStatus("Requesting permission...");
    void (async () => {
      try {
        const config = webPushConfig.publicKey
          ? webPushConfig
          : await api.webPushConfig(profileId);
        const subscription = await subscribeBrowserWebPush(config.publicKey);
        const saved = await api.saveWebPushSubscription(subscription, profileId);
        setWebPushConfig(saved);
        setWebPushStatus("Enabled on this device");
      } catch (error) {
        setWebPushStatus(
          error instanceof Error ? `Enable failed: ${error.message}` : "Enable failed",
        );
      }
    })();
  };
  const onDisableWebPush = () => {
    if (!authUser) {
      onTradingLogin();
      return;
    }
    setWebPushStatus("Disabling...");
    void (async () => {
      try {
        const endpoint = await unsubscribeBrowserWebPush();
        if (endpoint) {
          await api.deleteWebPushSubscription(endpoint, profileId);
        }
        const saved = await api.saveWebPushConfig({ enabled: false }, profileId);
        setWebPushConfig(saved);
        setWebPushStatus("Disabled");
      } catch (error) {
        setWebPushStatus(
          error instanceof Error ? `Disable failed: ${error.message}` : "Disable failed",
        );
      }
    })();
  };
  const onTestWebPush = () => {
    if (!authUser) {
      onTradingLogin();
      return;
    }
    setWebPushStatus("Sending test...");
    void (async () => {
      try {
        const result = await api.testWebPushConfig(profileId);
        if (result.removed > 0) {
          setWebPushConfig(await api.webPushConfig(profileId));
        }
        if (result.sent > 0 && result.failed === 0) {
          setWebPushStatus(`Test sent to ${result.sent} device${result.sent === 1 ? "" : "s"}`);
        } else if (result.sent > 0) {
          setWebPushStatus(
            `Test sent to ${result.sent}, failed on ${result.failed}`,
          );
        } else if (result.reason === "disabled") {
          setWebPushStatus("Web Push is disabled");
        } else if (result.reason === "no_subscriptions") {
          setWebPushStatus("No device subscription");
        } else if (result.failed > 0) {
          setWebPushStatus(`Test failed on ${result.failed} device${result.failed === 1 ? "" : "s"}`);
        } else {
          setWebPushStatus("No notification sent");
        }
      } catch (error) {
        setWebPushStatus(
          error instanceof Error ? `Test failed: ${error.message}` : "Test failed",
        );
      }
    })();
  };
  const onTradingLogin = () => {
    setAuthMode("login");
    setAuthError("");
    setAuthDialogOpen(true);
  };
  const onOpenMt5Account = () => {
    if (!authUser) {
      onTradingLogin();
      return;
    }
    setMt5Error("");
    setMt5DialogOpen(true);
  };
  const onLogout = () => {
    authUserIdRef.current = undefined;
    setMt5DialogOpen(false);
    void (async () => {
      try {
        await api.logout();
      } catch {
        /* Local state still clears if the session was already gone. */
      } finally {
        setAuthUser(undefined);
        setExecutionEnabled(false);
        setShowVolumeDelta(false);
        setMt5Account(undefined);
        setMt5Symbol(undefined);
        setOrders([]);
        setMt5OpenTrades(EMPTY_MT5_OPEN_TRADES);
        setSupertrendTrailings(new Map());
        resetOrderPendingAndOptimisticState();
        setAlerts([]);
        setLastAlert(undefined);
        setTelegramConfig({
          enabled: false,
          chatId: "",
          sendScreenshot: true,
          hasBotToken: false,
        });
        setOrderError("");
        setAuthDialogOpen(false);
        setMt5DialogOpen(false);
        setProfileId(DEFAULT_PROFILE_ID);
        setProfileTimeframe("1m");
        setDrawings([]);
        setDrawingsLoadKey((key) => key + 1);
        setProfileHydrated(true);
      }
    })();
  };
  const onMarketOrder = (side: "buy" | "sell") => {
    if (orderSubmittingRef.current || orderPending || !authUser) return;
    orderSubmittingRef.current = true;
    const submissionToken = ++submissionTokenCounterRef.current;
    activeSubmissionTokenRef.current = submissionToken;
    const requestedUser = authUser.id;
    const requestedAccountKey = connectedAccountKeyRef.current;
    const submissionGen = accountGenerationRef.current;
    setOrderPending(true);
    setOrderError("");
    void (async () => {
      try {
        let currentSymbol = mt5SymbolRef.current ?? mt5Symbol;
        if (
          marketOrderSettings.sizingMode === "risk" &&
          (!currentSymbol || (currentSymbol.pipValue ?? 0) <= 0) &&
          mt5Account?.connected
        ) {
          try {
            const reqId = ++symbolRequestIdRef.current;
            const fetchedSymbol = await api.mt5Symbol();
            if (
              authUserIdRef.current === requestedUser &&
              connectedAccountKeyRef.current === requestedAccountKey &&
              accountGenerationRef.current === submissionGen &&
              symbolRequestIdRef.current === reqId
            ) {
              currentSymbol = fetchedSymbol;
              setMt5Symbol(fetchedSymbol);
              mt5SymbolRef.current = fetchedSymbol;
            }
          } catch {}
        }
        if (
          authUserIdRef.current !== requestedUser ||
          connectedAccountKeyRef.current !== requestedAccountKey ||
          accountGenerationRef.current !== submissionGen
        ) {
          return;
        }
        const marketGcReference =
          latestPriceRef.current ??
          latestPrice ??
          (hasLoadedCurrentSeries ? bars[bars.length - 1]?.close : undefined);
        const marketVolumeLots = resolveOrderVolumeLots({
          settings: marketOrderSettings,
          entryGc: 0,
          slGc: marketOrderSettings.slDistanceGc,
          symbol: currentSymbol,
          accountCurrency: mt5Account?.currency,
        });
        if (marketVolumeLots === undefined) {
          setOrderError("Risk sizing needs Exness instrument data and a valid stop distance.");
          return;
        }
        const order = await api.createOrder({
          source: "market_bar",
          side,
          kind: "market",
          volumeLots: marketVolumeLots,
          ...(marketGcReference !== undefined
            ? { referenceGc: roundGcPrice(marketGcReference) }
            : {}),
          slDistanceGc: marketOrderSettings.slDistanceGc,
          tpDistanceGc: marketOrderSettings.tpDistanceGc,
          takeProfit1rEnabled: marketOrderSettings.takeProfit1rEnabled,
          ...supertrendAfter1rOrderFields(
            marketOrderSettings.takeProfit1rEnabled &&
              marketOrderSettings.autoSupertrendAfter1rEnabled,
            timeframe,
            supertrend,
          ),
          gcAnchored: false,
          idempotencyKey: newIdempotencyKey(),
        });
        if (
          authUserIdRef.current !== requestedUser ||
          connectedAccountKeyRef.current !== requestedAccountKey ||
          accountGenerationRef.current !== submissionGen
        ) {
          return;
        }
        setOrderError(rejectedOrderMessage(order));
        await refreshTradingState();
      } catch (error) {
        if (
          authUserIdRef.current === requestedUser &&
          connectedAccountKeyRef.current === requestedAccountKey &&
          accountGenerationRef.current === submissionGen
        ) {
          setOrderError(error instanceof Error ? error.message : "Order failed");
        }
      } finally {
        if (activeSubmissionTokenRef.current === submissionToken) {
          activeSubmissionTokenRef.current = 0;
          orderSubmittingRef.current = false;
        }
        if (
          authUserIdRef.current === requestedUser &&
          connectedAccountKeyRef.current === requestedAccountKey &&
          accountGenerationRef.current === submissionGen
        ) {
          setOrderPending(false);
        }
      }
    })();
  };

  const removeTransientDrawing = (id: string) => {
    setRemoveDrawingIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const submitOrderBracketDrawing = (drawing: DrawingState) => {
    if (drawing.anchors.length < 3) return;
    const [entryAnchor, slAnchor, tpAnchor] = drawing.anchors;
    const entryGc = roundGcPrice(entryAnchor.price);
    const slGc = roundGcPrice(slAnchor.price);
    const tpGc = roundGcPrice(tpAnchor.price);
    const isBuy = slGc < entryGc && tpGc > entryGc;
    const isSell = slGc > entryGc && tpGc < entryGc;
    if (!isBuy && !isSell) {
      invalidOrderDrawingIdsRef.current.add(drawing.id);
      setOrderError("Order bracket invalid: SL and TP must be on opposite sides of entry.");
      removeTransientDrawing(drawing.id);
      return;
    }
    if (!mt5Account) {
      setOrderError("Connect your account before placing chart orders.");
      return;
    }
    const volumeLots = resolveOrderVolumeLots({
      settings: marketOrderSettings,
      entryGc,
      slGc,
      symbol: mt5Symbol,
      accountCurrency: mt5Account?.currency,
    });
    if (volumeLots === undefined) {
      setOrderError("Risk sizing requires a valid Entry-to-SL distance and broker symbol data.");
      return;
    }
    submittedOrderDrawingIdsRef.current.add(drawing.id);
    const side: "buy" | "sell" = isBuy ? "buy" : "sell";
    const latestBar = hasLoadedCurrentSeries ? bars[bars.length - 1] : undefined;
    const referencePrice = latestBar?.close ?? entryGc;
    const kind =
      side === "buy"
        ? entryGc <= referencePrice ? "limit" : "stop"
        : entryGc >= referencePrice ? "limit" : "stop";
    setOrderPending(true);
    setOrderError("");
    void (async () => {
      try {
        const order = await api.createOrder({
          source: "chart_bracket",
          side,
          kind,
          autoPendingKind: true,
          volumeLots,
          entryGc,
          referenceGc: roundGcPrice(referencePrice),
          slGc,
          tpGc,
          takeProfit1rEnabled:
            kind === "limit" && marketOrderSettings.takeProfit1rEnabled,
          ...supertrendAfter1rOrderFields(
            kind === "limit" &&
              marketOrderSettings.takeProfit1rEnabled &&
              marketOrderSettings.autoSupertrendAfter1rEnabled,
            timeframe,
            supertrend,
          ),
          gcAnchored: false,
          idempotencyKey: newIdempotencyKey(),
        });
        setOrderError(rejectedOrderMessage(order));
        removeTransientDrawing(drawing.id);
        await refreshTradingState();
      } catch (error) {
        setOrderError(error instanceof Error ? error.message : "Chart order failed");
      } finally {
        setOrderPending(false);
      }
    })();
  };

  const onDrawingsStateChange = (state: DrawingState[], panelId?: string) => {
    if (panelId) savePanelDrawings(panelId, state);
    else setDrawings((previous) => mergeVisibleDrawingState(previous, state, timeframe));
    for (const drawing of state) {
      if (
        drawing.tool === "order_bracket" &&
        !submittedOrderDrawingIdsRef.current.has(drawing.id) &&
        !invalidOrderDrawingIdsRef.current.has(drawing.id)
      ) {
        submitOrderBracketDrawing(drawing);
      }
    }
  };

  const onOrderDragBatchCommit = (updates: readonly OrderLineDragUpdate[]) => {
    const groups = new Map<string, {
      levels: Mt5TradePatchInput;
      deltas: Partial<Record<OrderLineField, number>>;
      prices: OrderDragPrices;
    }>();
    for (const update of updates) {
      const line = parseOrderLineId(update.id);
      if (!line) continue;
      const group = groups.get(line.orderId) ?? { levels: {}, deltas: {}, prices: {} };
      if (update.startPrice !== undefined) {
        const move = roundGcPrice(roundGcPrice(update.price) - roundGcPrice(update.startPrice));
        if (move === 0) continue;
        group.deltas[line.field] = move;
        group.prices[line.field] = update.startPrice + move;
      } else {
        group.levels[line.field] = roundGcPrice(update.price);
        group.prices[line.field] = roundGcPrice(update.price);
      }
      groups.set(line.orderId, group);
    }
    for (const [orderId, { levels, deltas, prices }] of groups) {
      const external = parseActionRowId(orderId);
      const edits = activeOrderEditsRef.current;
      if (edits.has(orderId) || modifyingOrderIds.has(orderId)) continue;
      edits.add(orderId);
      const requestedUser = authUserIdRef.current;
      const key = newIdempotencyKey();
      const changes = {
        ...levels,
        ...(Object.keys(deltas).length ? { priceDeltas: deltas } : {}),
        idempotencyKey: key,
      };
      setOrderDragPreviews((current) => new Map(current).set(orderId, { key, prices }));
      setOrderError("");
      setModifyingOrderIds((prev) => new Set(prev).add(orderId));
      void (async () => {
        let accepted = false;
        try {
          if (external?.source === "mt5pos") {
            await api.patchMt5Position(external.ticket, changes);
          } else if (external?.source === "mt5order") {
            await api.patchMt5Order(external.ticket, changes);
          } else {
            await api.patchOrder(orderId, changes);
          }
          accepted = true;
        } catch (error) {
          if (authUserIdRef.current === requestedUser) {
            setOrderError(error instanceof Error ? error.message : "Modify order failed");
          }
        } finally {
          if (authUserIdRef.current === requestedUser) {
            const checkFrom = tradingRefreshRef.current.requested + 1;
            setOrderDragPreviews((current) => {
              const preview = current.get(orderId);
              if (preview?.key !== key) return current;
              const next = new Map(current);
              if (accepted) next.set(orderId, { ...preview, checkFrom });
              else next.delete(orderId);
              return next;
            });
            await refreshTradingState();
            if (authUserIdRef.current === requestedUser) setModifyingOrderIds((prev) => {
              const next = new Set(prev);
              next.delete(orderId);
              return next;
            });
          }
          edits.delete(orderId);
        }
      })();
    }
  };

  const onOrderDragCommit = (id: string, price: number) => {
    onOrderDragBatchCommit([{ id, price }]);
  };

  const onCloseOrder = (orderId: string) => {
    const rowId = appOrderRowKey(orderId);
    if (closingOrderIds.has(orderId) || closingOrderIds.has(rowId)) return;
    setOrderError("");
    setClosingOrderIds((prev) => new Set(prev).add(orderId).add(rowId));
    const idempotencyKey = `close-${orderId}-${Date.now()}`;
    void (async () => {
      try {
        await api.closeOrder(orderId, undefined, idempotencyKey);
        for (let attempt = 0; attempt < 15; attempt++) {
          await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 300 : 600));
          const state = await refreshTradingState();
          if (!state) break;
          const order = state.orders?.find((o) => o.id === orderId);
          const stillOpen = order ? isOpenTradingOrder(order) && order.status === "filled" : false;
          if (!stillOpen) break;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
          await refreshTradingState();
        } else {
          setOrderError(msg || "Close order failed");
          try {
            await refreshTradingState();
          } catch {
            /* Keep the current state if refresh also fails. */
          }
        }
      } finally {
        setClosingOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(orderId);
          next.delete(rowId);
          return next;
        });
      }
    })();
  };

  const onCancelOrder = (orderId: string) => {
    const rowId = appOrderRowKey(orderId);
    if (cancellingOrderIds.has(orderId) || cancellingOrderIds.has(rowId)) return;
    setOrderError("");
    setCancellingOrderIds((prev) => new Set(prev).add(orderId).add(rowId));
    const idempotencyKey = `cancel-${orderId}-${Date.now()}`;
    void (async () => {
      try {
        await api.cancelOrder(orderId, idempotencyKey);
        for (let attempt = 0; attempt < 15; attempt++) {
          await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 300 : 600));
          const state = await refreshTradingState();
          if (!state) break;
          const order = state.orders?.find((o) => o.id === orderId);
          if (!order || !isOpenTradingOrder(order)) break;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
          await refreshTradingState();
        } else {
          setOrderError(msg || "Cancel order failed");
          try {
            await refreshTradingState();
          } catch {
            /* Keep the current state if refresh also fails. */
          }
        }
      } finally {
        setCancellingOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(orderId);
          next.delete(rowId);
          return next;
        });
      }
    })();
  };

  const onOrderRowBreakEven = (rowId: string) => {
    const parsed = parseActionRowId(rowId);
    if (!parsed || parsed.source === "mt5order" || breakingEvenOrderIds.has(rowId)) return;
    const idKey = parsed.source === "app" ? parsed.orderId : rowId;
    if (modifyingOrderIds.has(rowId) || modifyingOrderIds.has(idKey)) return;
    const requestedUser = authUserIdRef.current;
    setOrderError("");
    setBreakingEvenOrderIds((prev) => new Set(prev).add(rowId));
    setModifyingOrderIds((prev) => new Set(prev).add(rowId).add(idKey));
    void (async () => {
      try {
        const patch = { breakEven: true, idempotencyKey: newIdempotencyKey() };
        if (parsed.source === "app") {
          await api.patchOrder(parsed.orderId, patch);
        } else {
          await api.patchMt5Position(parsed.ticket, patch);
        }
      } catch (error) {
        if (authUserIdRef.current === requestedUser) {
          setOrderError(error instanceof Error ? error.message : "Break-even failed");
        }
      } finally {
        if (authUserIdRef.current === requestedUser) {
          await refreshTradingState();
          if (authUserIdRef.current === requestedUser) {
            setBreakingEvenOrderIds((prev) => {
              const next = new Set(prev);
              next.delete(rowId);
              return next;
            });
            setModifyingOrderIds((prev) => {
              const next = new Set(prev);
              next.delete(rowId);
              next.delete(idKey);
              return next;
            });
          }
        }
      }
    })();
  };

  const onOrderRowSupertrendTrailing = (rowId: string) => {
    const parsed = parseActionRowId(rowId);
    if (!parsed || supertrendTrailingPendingIds.has(rowId)) return;
    let targetType: SupertrendTrailing["targetType"];
    let targetId: string | number;
    let targetSide: "buy" | "sell";
    if (parsed.source === "app") {
      const order = orders.find((item) => item.id === parsed.orderId);
      if (!order || order.source === "auto_mgann" || order.brokerPositionTicket == null) {
        setOrderError("SuperTrend trailing is only available for manual open positions");
        return;
      }
      targetType = "order";
      targetId = parsed.orderId;
      targetSide = order.side;
    } else if (parsed.source === "mt5pos") {
      const position = mt5OpenTrades.positions.find(
        (item) => String(item.brokerPositionTicket) === parsed.ticket,
      );
      if (!position) {
        setOrderError("Position not found");
        return;
      }
      targetType = "position";
      targetId = parsed.ticket;
      targetSide = position.side;
    } else {
      return;
    }

    const active = supertrendTrailings.get(rowId);
    const settings = normalizeSupertrendSettings(supertrend);
    if (active === undefined) {
      const currentPrice =
        latestPriceRef.current ??
        latestPrice ??
        (hasLoadedCurrentSeries ? bars[bars.length - 1]?.close : undefined);
      const activationError = supertrendTrailingActivationError(
        targetSide,
        currentPrice,
        hasLoadedCurrentSeries ? bars : [],
        settings,
      );
      if (activationError !== undefined) {
        setOrderError(activationError);
        window.alert(activationError);
        return;
      }
    }
    setOrderError("");
    setSupertrendTrailingPendingIds((prev) => new Set(prev).add(rowId));
    void (async () => {
      try {
        if (active !== undefined) {
          await api.disableSupertrendTrailing(targetType, targetId);
          setSupertrendTrailings((prev) => {
            const next = new Map(prev);
            next.delete(rowId);
            return next;
          });
        } else {
          const trailing = await api.enableSupertrendTrailing(targetType, targetId, {
            timeframe,
            period: settings.period,
            multiplier: settings.multiplier,
            atrMethod: settings.atrMethod,
            source: settings.source,
          });
          setSupertrendTrailings((prev) => {
            const next = new Map(prev);
            next.set(rowId, trailing);
            return next;
          });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "SuperTrend trailing failed";
        setOrderError(message);
        if (active === undefined) window.alert(message);
        try {
          setSupertrendTrailings(
            supertrendTrailingMap(await api.supertrendTrailings()),
          );
        } catch {
          /* Keep the current state if refresh also fails. */
        }
      } finally {
        setSupertrendTrailingPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(rowId);
          return next;
        });
      }
    })();
  };

  const onOrderRowClose = (rowId: string) => {
    const parsed = parseActionRowId(rowId);
    if (!parsed) return;
    if (parsed.source === "app") {
      onCloseOrder(parsed.orderId);
      return;
    }
    if (parsed.source !== "mt5pos") return;
    const ticket = parsed.ticket;
    if (closingOrderIds.has(rowId) || closingOrderIds.has(ticket)) return;
    setOrderError("");
    setClosingOrderIds((prev) => new Set(prev).add(rowId).add(ticket));
    const idempotencyKey = `close-${ticket}-${Date.now()}`;
    void (async () => {
      try {
        await api.closeMt5Position(ticket, undefined, idempotencyKey);
        for (let attempt = 0; attempt < 15; attempt++) {
          await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 300 : 600));
          const state = await refreshTradingState();
          if (!state) break;
          const stillOpen = state.openTrades?.positions.some(
            (p) => String(p.brokerPositionTicket) === ticket,
          );
          if (!stillOpen) break;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
          await refreshTradingState();
        } else {
          setOrderError(msg || "Close position failed");
          try {
            await refreshTradingState();
          } catch {
            /* Keep the current state if refresh also fails. */
          }
        }
      } finally {
        setClosingOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(rowId);
          next.delete(ticket);
          return next;
        });
      }
    })();
  };

  const onOrderRowClose50Percent = (rowId: string, volumeLots: number) => {
    const parsed = parseActionRowId(rowId);
    if (!parsed) return;
    const idKey = parsed.source === "app" ? parsed.orderId : parsed.ticket;
    if (
      closing50OrderIds.has(rowId) ||
      closing50OrderIds.has(idKey) ||
      closingOrderIds.has(rowId) ||
      closingOrderIds.has(idKey)
    ) {
      return;
    }

    const halfVolume = Math.max(0.01, Math.round(volumeLots * 50) / 100);
    const targetVolume = Math.max(0.01, Math.round((volumeLots - halfVolume) * 100) / 100);

    setOrderError("");
    setClosing50OrderIds((prev) => new Set(prev).add(rowId).add(idKey));
    setClosingOrderIds((prev) => new Set(prev).add(rowId).add(idKey));

    if (parsed.source === "app") {
      const orderId = parsed.orderId;
      const appRowId = appOrderRowKey(orderId);
      const idempotencyKey = `close50-${orderId}-${Date.now()}`;
      void (async () => {
        try {
          await api.closeOrder(orderId, halfVolume, idempotencyKey);
          for (let attempt = 0; attempt < 15; attempt++) {
            await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 300 : 600));
            const state = await refreshTradingState();
            if (!state) break;
            const ord = state.orders?.find((o) => o.id === orderId);
            if (!ord || ord.volumeLots <= targetVolume + 0.005 || !isOpenTradingOrder(ord)) break;
          }
        } catch (error) {
          setOrderError(error instanceof Error ? error.message : "Close position failed");
          try {
            await refreshTradingState();
          } catch {
            /* Keep the current state if refresh also fails. */
          }
        } finally {
          setClosing50OrderIds((prev) => {
            const next = new Set(prev);
            next.delete(rowId);
            next.delete(orderId);
            next.delete(appRowId);
            return next;
          });
          setClosingOrderIds((prev) => {
            const next = new Set(prev);
            next.delete(rowId);
            next.delete(orderId);
            next.delete(appRowId);
            return next;
          });
        }
      })();
      return;
    }
    if (parsed.source !== "mt5pos") return;
    const ticket = parsed.ticket;
    const idempotencyKey = `close50-${ticket}-${Date.now()}`;
    void (async () => {
      try {
        await api.closeMt5Position(ticket, halfVolume, idempotencyKey);
        for (let attempt = 0; attempt < 15; attempt++) {
          await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 300 : 600));
          const state = await refreshTradingState();
          if (!state) break;
          const pos = state.openTrades?.positions.find((p) => String(p.brokerPositionTicket) === ticket);
          if (!pos || pos.volumeLots <= targetVolume + 0.005) break;
        }
      } catch (error) {
        setOrderError(error instanceof Error ? error.message : "Close position failed");
        try {
          await refreshTradingState();
        } catch {
          /* Keep the current state if refresh also fails. */
        }
      } finally {
        setClosing50OrderIds((prev) => {
          const next = new Set(prev);
          next.delete(rowId);
          next.delete(ticket);
          return next;
        });
        setClosingOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(rowId);
          next.delete(ticket);
          return next;
        });
      }
    })();
  };

  const onOrderRowCancel = (rowId: string) => {
    const parsed = parseActionRowId(rowId);
    if (!parsed) return;
    if (parsed.source === "app") {
      onCancelOrder(parsed.orderId);
      return;
    }
    if (parsed.source !== "mt5order") return;
    const ticket = parsed.ticket;
    if (cancellingOrderIds.has(rowId) || cancellingOrderIds.has(ticket)) return;
    setOrderError("");
    setCancellingOrderIds((prev) => new Set(prev).add(rowId).add(ticket));
    const idempotencyKey = `cancel-${ticket}-${Date.now()}`;
    void (async () => {
      try {
        await api.cancelMt5Order(ticket, idempotencyKey);
        for (let attempt = 0; attempt < 15; attempt++) {
          await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 300 : 600));
          const state = await refreshTradingState();
          if (!state) break;
          const stillThere = state.openTrades?.orders.some(
            (o) => String(o.brokerOrderTicket) === ticket,
          );
          if (!stillThere) break;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
          await refreshTradingState();
        } else {
          setOrderError(msg || "Cancel order failed");
          try {
            await refreshTradingState();
          } catch {
            /* Keep the current state if refresh also fails. */
          }
        }
      } finally {
        setCancellingOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(rowId);
          next.delete(ticket);
          return next;
        });
      }
    })();
  };
  const currentChartReferencePrice = () =>
    latestPriceRef.current ??
    latestPrice ??
    (hasLoadedCurrentSeries ? bars[bars.length - 1]?.close : undefined);

  const onRequestChartMenu = (info: { price: number; x: number; y: number }) => {
    setChartMenu({
      ...info,
      openedAt: Date.now(),
      referencePrice: currentChartReferencePrice(),
    });
  };

  // Create a price-crosses-level alert at the price the user right-clicked.
  const onConfirmAlertAtPrice = (price: number) => {
    const rounded = roundGcPrice(price);
    onCreateAlert({ type: "price_crosses_level", params: { level: rounded } });
    setChartMenu(undefined);
  };

  const onConfirmLimitOrderDraft = (draft: ChartLimitOrderDraft) => {
    setChartMenu(undefined);
    if (orderPending) return;
    if (!mt5Account) {
      setOrderError("Connect your account before placing chart orders.");
      return;
    }
    setOrderPending(true);
    setOrderError("");
    void (async () => {
      try {
        const order = await api.createOrder({
          ...draft,
          gcAnchored: false,
          ...supertrendAfter1rOrderFields(
            draft.takeProfit1rEnabled && draft.autoSupertrendAfter1rEnabled,
            timeframe,
            supertrend,
          ),
          idempotencyKey: newIdempotencyKey(),
        });
        setOrderError(rejectedOrderMessage(order));
        await refreshTradingState();
      } catch (error) {
        setOrderError(error instanceof Error ? error.message : "Chart order failed");
      } finally {
        setOrderPending(false);
      }
    })();
  };
  // Persist a dragged alert line's new level (optimistic + PATCH).
  const onAlertDragCommit = (id: string, price: number) => {
    const level = roundGcPrice(price);
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, params: { ...a.params, level } } : a,
      ),
    );
    void api.patchAlertParams(id, { level }, profileId);
  };
  const applyProfilePayload = (payload: ChartProfilePayload) => {
    if (isTimeframe(payload.timeframe)) {
      setProfileTimeframe(payload.timeframe);
      setTimeframe(payload.timeframe);
    }
    setChartBackgroundColor(normalizeChartBackgroundColor(payload.chartBackgroundColor));
    setShowVolumeDelta(payload.showVolumeDelta !== false);
    setShowXKontrol(payload.showXKontrol === true);
    setXKontrolSettings(normalizeXKontrolDisplaySettings(payload.xKontrol));
    setShowTduSignals(payload.showTduSignals !== false);
    setDenseOverlayMinBarSpacing(normalizeDenseOverlayBarSpacing(payload.denseOverlayMinBarSpacing));
    setShowDailyVolumeProfile(Boolean(payload.showDailyVolumeProfile));
    setDailyVolumeProfileWidth(
      normalizeSessionVolumeProfileWidth(payload.dailyVolumeProfileWidth),
    );
    setShowDailyVolumeProfileDevelopingPoc(
      payload.showDailyVolumeProfileDevelopingPoc !== false,
    );
    setDailyVolumeProfileRowTicks(
      normalizeSessionVolumeProfileRowTicks(payload.dailyVolumeProfileRowTicks),
    );
    setDailyVolumeProfileDays(
      normalizeSessionVolumeProfileDays(payload.dailyVolumeProfileDays),
    );
    setShowMgannSwing(payload.showMgannSwing === true);
    setMgannSwing(
      normalizeMgannSwingSettings({
        ...(payload.mgannSwing ?? {}),
        showWaveDelta:
          payload.mgannSwing?.showWaveDelta ?? (payload.showCvd !== false),
      }),
    );
    setShowFvgGrader(payload.showFvgGrader !== false);
    setShowMgannBreak(payload.showMgannBreak !== false);
    setMgannBreakSettings(
      mgannBreakSettingsFromProfile(
        payload.mgannBreak,
        payload.mgannBreakSettingsVersion,
      ),
    );
    setFvgSignalLimit(normalizeFvgSignalLimit(payload.fvgSignalLimit));
    setMgannBreakSignalHistoryBars(
      normalizeMgannBreakSignalHistoryBars(payload.mgannBreakSignalHistoryBars),
    );
    setMgannBreakSignalLimit(
      normalizeMgannBreakSignalLimit(payload.mgannBreakSignalLimit),
    );
    setShowBigTrades(payload.showBigTrades !== false);
    setEma(normalizeEmaSettings(payload.ema));
    setSupertrend(normalizeSupertrendSettings(payload.supertrend));
    setSmc({ ...DEFAULT_SMC_SETTINGS, ...(payload.smc ?? {}) });
    setSweepReversal(normalizeSweepReversalSettings(payload.sweepReversal));
    setOutsideBar(
      payload.outsideBar
        ? normalizeOutsideBarSettings(payload.outsideBar)
        : { ...DEFAULT_OUTSIDE_BAR_SETTINGS, enabled: true },
    );
    setFootprintSettings({
      ...DEFAULT_FOOTPRINT_SETTINGS,
      ...(payload.footprintSettings ?? {}),
    });
    setBigTradeSettings({
      ...DEFAULT_BIG_TRADE_SETTINGS,
      ...(payload.bigTradeSettings ?? {}),
      maxVisible: normalizeBigTradeMaxVisible(
        payload.bigTradeSettings?.maxVisible,
      ),
    });
    if (payload.marketOrderSettings) {
      setMarketOrderSettings(sanitizeMarketOrderSettings(payload.marketOrderSettings));
    }
    setTimezoneOffsetMinutes(
      normalizeTimezoneOffsetMinutes(payload.timezoneOffsetMinutes),
    );
    const nextDrawings = Array.isArray(payload.drawings)
      ? cloneDrawings(payload.drawings)
      : [];
    deltaProfileRequestKeysRef.current.clear();
    deltaProfileFetchKeysRef.current.clear();
    setFixedRangeDeltaProfiles(new Map());
    setDrawings(nextDrawings);
    setDrawingsLoadKey((key) => key + 1);
    setDrawingCount(nextDrawings.length);
    setActiveTool(null);
  };

  async function loadAuthenticatedState(user: AuthUser): Promise<void> {
    authUserIdRef.current = user.id;
    setAuthUser(user);
    setProfileLoading(true);
    setProfileHydrated(false);
    setOrderError("");

    const execution = await api.execution();
    const canTrade = execution.enabled;
    setExecutionEnabled(canTrade);
    const [profileResult, statusResult] = await Promise.allSettled([
      api.meProfile(),
      canTrade ? api.mt5Status() : Promise.resolve(
        { connected: false } as Awaited<ReturnType<ApiClient["mt5Status"]>>,
      ),
    ]);

    const hotSnapshot = readProfileHotSnapshot(user.id);
    if (profileResult.status === "fulfilled") {
      if (hotSnapshot && hotSnapshot.savedAt > profileResult.value.updatedAt) {
        applyProfilePayload(hotSnapshot.payload);
        setProfileId(hotSnapshot.profileId);
      } else {
        applyProfilePayload(profileResult.value.payload);
        setProfileId(normalizeProfileId(profileResult.value.id));
      }
    } else if (hotSnapshot) {
      applyProfilePayload(hotSnapshot.payload);
      setProfileId(hotSnapshot.profileId);
    } else {
      setShowVolumeDelta(true);
      setProfileId(user.id);
    }

    const connectedAccount =
      statusResult.status === "fulfilled" && (statusResult.value.connected || statusResult.value.account?.provider === "exness")
        ? statusResult.value.account ?? undefined
        : undefined;
    setMt5Account(connectedAccount);
    if (statusResult.status === "fulfilled" && !statusResult.value.connected) {
      setOrderError(statusResult.value.error ?? "");
    } else if (connectedAccount) {
      setOrderError("");
    }

    resetOrderPendingAndOptimisticState();
    if (!connectedAccount) {
      setMt5Symbol(undefined);
      setOrders([]);
      setMt5OpenTrades(EMPTY_MT5_OPEN_TRADES);
      setSupertrendTrailings(new Map());
    }

    setProfileSyncedSignature("");
    setProfileLoading(false);
    setProfileHydrated(true);
  }

  useEffect(() => {
    let cancelled = false;
    setProfileLoading(true);
    void (async () => {
      try {
        const user = await api.me();
        if (cancelled) return;
        if (user) {
          await loadAuthenticatedState(user);
        } else {
          setAuthUser(undefined);
          setShowVolumeDelta(false);
          setMt5Account(undefined);
          setMt5Symbol(undefined);
          setOrders([]);
          setMt5OpenTrades(EMPTY_MT5_OPEN_TRADES);
          setSupertrendTrailings(new Map());
          resetOrderPendingAndOptimisticState();
          setProfileId(DEFAULT_PROFILE_ID);
          setProfileLoading(false);
          setProfileHydrated(true);
        }
      } catch {
        if (!cancelled) {
          setAuthUser(undefined);
          setShowVolumeDelta(false);
          setProfileLoading(false);
          setProfileHydrated(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const tradingAccountId = mt5Account?.accountId;
  useEffect(() => {
    if (!authUser || !tradingAccountId || !executionEnabled) return;
    let cancelled = false;
    let timer: number | undefined;
    const refresh = () => {
      void refreshTradingState().finally(() => {
        if (!cancelled) timer = window.setTimeout(refresh, ORDER_REFRESH_INTERVAL_MS);
      });
    };
    timer = window.setTimeout(refresh, ORDER_REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [authUser, tradingAccountId, executionEnabled, refreshTradingState]);

  const onAuthSubmit = (input: {
    username: string;
    password: string;
    mode: AuthDialogMode;
    inviteCode?: string;
  }) => {
    setAuthPending(true);
    setAuthError("");
    void (async () => {
      try {
        const user =
          input.mode === "register"
            ? await api.register(input.username, input.password, input.inviteCode)
            : await api.login(input.username, input.password);
        setAuthDialogOpen(false);
        await loadAuthenticatedState(user);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "Login failed");
      } finally {
        setAuthPending(false);
      }
    })();
  };

  const onSubmitExnessAccount = (input: ExnessConnectInput) => {
    if (!authUser) { onTradingLogin(); return; }
    const requestedUser = authUser.id;
    setMt5Pending(true);
    setMt5Error("");
    void (async () => {
      try {
        const account = await api.connectExness(input);
        if (authUserIdRef.current !== requestedUser) return;
        setMt5Account(account);
        setMt5DialogOpen(false);
        await refreshTradingState();
      } catch (error) {
        if (authUserIdRef.current === requestedUser) setMt5Error(error instanceof Error ? error.message : "Exness connection failed");
      } finally { if (authUserIdRef.current === requestedUser) setMt5Pending(false); }
    })();
  };

  // Alert level lines drawn on the candle scale (Req 16.5). Recomputed only
  // when the alert set changes.
  const alertLines = useMemo(() => toAlertLines(alerts), [alerts]);
  const chartOrderState = useMemo(
    () => applyOrderDragPreviews(orders, mt5OpenTrades, orderDragPreviews),
    [orders, mt5OpenTrades, orderDragPreviews],
  );
  const orderLines = useMemo(
    () =>
      [
        ...toOrderLines(chartOrderState.orders, modifyingOrderIds),
        ...manualPositionLines(chartOrderState.trades.positions, chartOrderState.orders, modifyingOrderIds),
        ...manualPendingOrderLines(chartOrderState.trades.orders, chartOrderState.orders, modifyingOrderIds),
      ],
    [chartOrderState, modifyingOrderIds],
  );
  const orderRows = useMemo(
    () =>
      toMarketOrderRows(
        orders,
        latestPrice,
        mt5Symbol,
        mt5OpenTrades,
        closingOrderIds,
        cancellingOrderIds,
        breakingEvenOrderIds,
        supertrendTrailings,
        supertrendTrailingPendingIds,
        mt5Account,
        modifyingOrderIds,
        closing50OrderIds,
      ),
    [
      orders,
      latestPrice,
      mt5Symbol,
      mt5OpenTrades,
      closingOrderIds,
      cancellingOrderIds,
      breakingEvenOrderIds,
      supertrendTrailings,
      supertrendTrailingPendingIds,
      mt5Account,
      modifyingOrderIds,
      closing50OrderIds,
    ],
  );
  const orderControls = useMemo(
    () =>
      toOrderControls(
        chartOrderState.orders,
        latestPrice,
        mt5Symbol,
        chartOrderState.trades,
        closingOrderIds,
        cancellingOrderIds,
        mt5Account,
        modifyingOrderIds,
      ),
    [
      chartOrderState,
      latestPrice,
      mt5Symbol,
      closingOrderIds,
      cancellingOrderIds,
      mt5Account,
      modifyingOrderIds,
    ],
  );
  const replayBars = replayDataset?.bars;
  const replayVolumeDeltaData = replayDataset?.volumeDelta;
  const replayFootprintBars = replayDataset?.footprintBars;
  const replayFvgSignals = replayDataset?.fvgSignals;
  const replayBigTrades = replayDataset?.bigTrades;
  const replaySmcAiSignals = replayDataset?.smcAiSignals;
  const replayAlertSignals = replayDataset?.alertSignals;
  const replayCurrentBar = replayActive ? replayBars?.[replayCursorIndex] : undefined;
  const replayCutoffExclusive = replayCurrentBar === undefined
    ? undefined
    : barEndForTimeframe(replayCurrentBar.time, timeframe);
  // Keep replay projections independent from live state. The websocket keeps
  // updating `bars` and overlays behind the replay snapshot; including those
  // live collections in a replay memo would create a fresh prefix and repaint
  // the whole chart even while replay is paused.
  const replayChartBars = useMemo(
    () =>
      replayActive && replayBars !== undefined
        ? replayBarsThrough(replayBars, replayCursorIndex)
        : undefined,
    [replayActive, replayBars, replayCursorIndex],
  );
  const chartBars = replayActive
    ? replayChartBars ?? EMPTY_BARS
    : hasLoadedCurrentSeries
      ? bars
      : EMPTY_BARS;
  const replayChartVolumeDelta = useMemo(
    () =>
      replayActive && replayVolumeDeltaData !== undefined && replayCurrentBar !== undefined
        ? timedValuesBefore(replayVolumeDeltaData, replayCurrentBar.time + 1)
        : undefined,
    [replayActive, replayCurrentBar?.time, replayVolumeDeltaData],
  );
  const chartVolumeDelta = replayActive
    ? replayChartVolumeDelta ?? EMPTY_VOLUME_DELTA
    : hasLoadedCurrentSeries && volumeDeltaSeriesKey === currentSeriesKey
      ? volumeDelta
      : EMPTY_VOLUME_DELTA;
  const replayChartFootprintBars = useMemo(
    () =>
      replayActive && replayFootprintBars !== undefined && replayCurrentBar !== undefined
        ? timedMapThrough(replayFootprintBars, replayCurrentBar.time)
        : undefined,
    [replayActive, replayCurrentBar?.time, replayFootprintBars],
  );
  const chartFootprintBars = replayActive
    ? replayChartFootprintBars ?? EMPTY_FOOTPRINT_BARS
    : hasLoadedCurrentSeries
      ? footprintBars
      : EMPTY_FOOTPRINT_BARS;
  const replayChartFvgSignals = useMemo(
    () =>
      replayActive && replayFvgSignals !== undefined && replayCurrentBar !== undefined
        ? timedMapThrough(replayFvgSignals, replayCurrentBar.time)
        : undefined,
    [replayActive, replayCurrentBar?.time, replayFvgSignals],
  );
  const chartFvgSignals =
    indicatorsVisible &&
    hasLoadedCurrentSeries &&
    showFvgGrader &&
    timeframe === "1m" &&
    (replayActive || fvgSignalSeriesKey === currentSeriesKey)
      ? replayActive
        ? replayChartFvgSignals ?? EMPTY_FVG_SIGNALS
        : fvgSignals
      : EMPTY_FVG_SIGNALS;
  const chartTduSignals =
    indicatorsVisible &&
    !replayActive &&
    hasLoadedCurrentSeries &&
    showTduSignals &&
    tduSignalsEnabledForTimeframe(timeframe) &&
    tduSignalSeriesKey === currentSeriesKey
      ? tduSignals
      : EMPTY_TDU_SIGNALS;
  const bigTradeOverlayEnabled = bigTradesEnabledForTimeframe(timeframe);
  const replayChartBigTrades = useMemo(
    () =>
      replayActive && replayBigTrades !== undefined && replayCutoffExclusive !== undefined
        ? timedValuesBefore(replayBigTrades, replayCutoffExclusive)
        : undefined,
    [replayActive, replayCutoffExclusive, replayBigTrades],
  );
  const chartBigTrades =
    indicatorsVisible && hasLoadedCurrentSeries && showBigTrades && bigTradeOverlayEnabled
      ? replayActive
        ? replayChartBigTrades ?? EMPTY_BIG_TRADES
        : bigTrades
      : EMPTY_BIG_TRADES;
  const replayChartSmcAiSignals = useMemo(
    () =>
      replayActive && replaySmcAiSignals !== undefined && replayCutoffExclusive !== undefined
        ? timedValuesBefore(replaySmcAiSignals, replayCutoffExclusive)
        : undefined,
    [replayActive, replayCutoffExclusive, replaySmcAiSignals],
  );
  const chartSmcAiSignals =
    indicatorsVisible && hasLoadedCurrentSeries && timeframe === "1m"
      ? replayActive
        ? replayChartSmcAiSignals ?? EMPTY_SMC_AI_SIGNALS
        : smcAiSignals
      : EMPTY_SMC_AI_SIGNALS;
  const replayChartAlertSignals = useMemo(
    () =>
      replayActive && replayAlertSignals !== undefined && replayCutoffExclusive !== undefined
        ? timedValuesBefore(replayAlertSignals, replayCutoffExclusive)
        : undefined,
    [replayActive, replayCutoffExclusive, replayAlertSignals],
  );
  const chartAlertSignals =
    indicatorsVisible && hasLoadedCurrentSeries && timeframe === "1m" && showMgannBreak
      ? replayActive
        ? replayChartAlertSignals ?? EMPTY_ALERT_SIGNAL_MARKERS
        : alertSignalMarkers
      : EMPTY_ALERT_SIGNAL_MARKERS;
  const effectiveOutsideBar = useMemo(
    () => outsideBarSettingsForTimeframe(outsideBar, timeframe),
    [outsideBar, timeframe],
  );
  const visibleEma = useMemo(
    () =>
      indicatorsVisible
        ? ema
        : { ...ema, enabled: false, showEma200: false },
    [ema, indicatorsVisible],
  );
  const visibleSupertrend = useMemo(
    () =>
      indicatorsVisible
        ? supertrend
        : { ...supertrend, enabled: false },
    [indicatorsVisible, supertrend],
  );
  const visibleSmc = useMemo(
    () => (indicatorsVisible ? smc : { ...smc, enabled: false }),
    [indicatorsVisible, smc],
  );
  const visibleSweepReversal = useMemo(
    () =>
      indicatorsVisible
        ? sweepReversal
        : { ...sweepReversal, enabled: false },
    [indicatorsVisible, sweepReversal],
  );
  const visibleOutsideBar = useMemo(
    () =>
      indicatorsVisible
        ? effectiveOutsideBar
        : { ...effectiveOutsideBar, enabled: false },
    [effectiveOutsideBar, indicatorsVisible],
  );
  const visibleDrawings = useMemo(
    () => visibleDrawingsForTimeframe(drawings, timeframe),
    [drawings, timeframe],
  );
  const visibleDrawingsLoadKey = `${drawingsLoadKey}:${timeframe}`;
  const chartMenuLimitDraft = !executionEnabled || chartMenu === undefined
    ? undefined
    : buildChartLimitOrderDraft({
        entryPrice: chartMenu.price,
        referencePrice: chartMenu.referencePrice,
        settings: marketOrderSettings,
        symbol: mt5Symbol,
        accountCurrency: mt5Account?.currency,
      });

  useEffect(() => {
    if (
      !authUser ||
      !profileHydrated ||
      profileLoading ||
      profileSaving ||
      profilePayloadSignature === profileSyncedSignature
    ) {
      return;
    }

    const payload = profilePayload;
    const savedProfileSignature = profilePayloadSignature;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          setProfileSaving(true);
          const saved = await api.saveMeProfile({ name: authUser.username, payload });
          setProfileId(normalizeProfileId(saved.id));
          markProfileSyncedIfCurrent(savedProfileSignature);
        } catch {
          /* Keep the profile dirty so the next render/change can retry. */
        } finally {
          setProfileSaving(false);
        }
      })();
    }, DRAWINGS_AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [
    api,
    authUser,
    profileHydrated,
    profileId,
    profileLoading,
    profilePayload,
    profilePayloadSignature,
    profileSaving,
    profileSyncedSignature,
  ]);

  useEffect(() => {
    if (!lastAlert || !telegramConfig.enabled) return;
    const key = `${profileId}:${lastAlert.alertId}:${lastAlert.time}`;
    if (telegramSentRef.current === key) return;
    telegramSentRef.current = key;
    const screenshotDataUrl = telegramConfig.sendScreenshot
      ? screenshotCaptureRef.current?.()
      : undefined;
    void api.sendTelegramAlert({
      event: lastAlert,
      message: formatTelegramAlertMessage(lastAlert),
      screenshotDataUrl,
      profileId,
    });
  }, [api, lastAlert, profileId, telegramConfig.enabled, telegramConfig.sendScreenshot]);

  const hasScanWidget = panels.some((panel) => panel.type === "aiScan");
  function scanTimeframeFor(panel: WorkspacePanel) {
    return panel.id === MAIN_CHART ? loadedBarsTimeframe : panel.timeframe ?? "1m";
  }
  const scanKey = (id: string, tf: Timeframe) => `${chartKey(id)}:${tf}:${replayDataset?.id ?? ""}`;

  const scanScope = (panelId: string) => scanSettingsScope(authUser?.id, workspaceId, panelId);
  const scanContext = JSON.stringify([authUser?.id, workspaceId, instrument.symbol, contract,
    loadedBarsTimeframe, replayDataset?.id, replayActive, panels.map(p => [p.id, p.timeframe])]);
  const scanContextRef = useRef(scanContext); scanContextRef.current = scanContext;
  useEffect(() => {
    scanRequests.current.clear();
    setScanStates({});
    setScanPreview(undefined);
  }, [scanContext]);

  function defaultScanState(panelId = MAIN_CHART) {
    const settings = loadScanSettings(scanScope(panelId));
    return {
      ...settings, groups: new Set(settings.groups),
      active: false, loading: false, error: null as string | null,
      settingsOpen: false, suggestions: [] as ScanAiSuggestion[], addedIds: new Set<string>(),
    };
  }
  function existingScanDrawings(panelId: string): readonly DrawingState[] {
    return panelId === MAIN_CHART && payload?.useChartProfile && authUser
      ? visibleDrawings : panels.find(p => p.id === panelId)?.drawings ?? [];
  }
  const runScanForChart = useCallback(
    async (panelId: string, customSettings?: Partial<ReturnType<typeof defaultScanState>>) => {
      const panel = panels.find(p => p.id === panelId);
      if (!panel) return;
      const tf = scanTimeframeFor(panel);
      const current = scanStatesRef.current[panelId] ?? defaultScanState(panelId);
      const merged = { ...current, ...customSettings };
      const context = scanContext;
      const requestId = (scanRequests.current.get(panelId) ?? 0) + 1;
      scanRequests.current.set(panelId, requestId);
      const isCurrent = () => scanContextRef.current === context && scanRequests.current.get(panelId) === requestId;
      setScanStates(prev => ({ ...prev, [panelId]: {
        ...merged, loading: true, error: null, active: true, suggestions: [],
      } }));
      try {
        const res: any = await api.aiScan({
          symbol: instrument.symbol, contract, timeframe: tf,
          depth: merged.depth, density: merged.density, strength: merged.strength,
          groups: Array.from(merged.groups), patterns: merged.patterns,
          targetsAndStop: merged.targetsAndStop,
          states: merged.state === "auto" ? ["waiting", "in_play", "tested"] : [merged.state],
          endTime: panelId === MAIN_CHART && replayActive ? chartBars[chartBars.length - 1]?.time : undefined,
        });
        if (!isCurrent()) return;
        const rawList = Array.isArray(res?.suggestions) ? res.suggestions : (res?.candidates ?? []).map((c: any) => ({
          ...c, group: c.type.startsWith("fibonacci") ? "fibonacci" : c.type === "elliott_wave" ? "elliott" : "lines",
          label: c.label, state: "waiting", strength: "moderate", score: Math.round(c.score * 100),
          drawingTool: c.drawingTool ?? (c.type.startsWith("fibonacci") ? "fib_retracement" : c.type === "elliott_wave" ? "path" : "trendline"),
          anchors: (c.anchors ?? []).map((a: any) => ({ time: Math.round(a.time > 1e11 ? a.time / 1000 : a.time), price: a.price })),
        }));
        const accepted = acceptedScanGeometry.current.get(scanKey(panelId, tf)) ?? [];
        const normalizedList = prepareSuggestions(rawList).filter(s =>
          merged.groups.has(s.group) && !alreadyDrawn(s, existingScanDrawings(panelId), tf)
          && !accepted.some(a => similarScanGeometry(s, a)));
        setScanStates(prev => {
          if (!isCurrent()) return prev;
          const s = prev[panelId] ?? defaultScanState(panelId);
          return { ...prev, [panelId]: { ...s, active: true, loading: false, suggestions: normalizedList } };
        });
      } catch (err: any) {
        if (!isCurrent()) return;
        setScanStates(prev => {
          if (!isCurrent()) return prev;
          const s = prev[panelId] ?? defaultScanState(panelId);
          return { ...prev, [panelId]: { ...s, loading: false, error: err?.message ?? "Chart scan failed" } };
        });
      }
    },
    [panels, loadedBarsTimeframe, instrument.symbol, contract, replayActive, chartBars, api, scanContext],
  );
  const scanRunnerRef = useRef(runScanForChart); scanRunnerRef.current = runScanForChart;
  useEffect(() => {
    const sync = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      for (const panel of panels.filter(p => p.type === "chart")) {
        if (event.type !== "storage" && detail?.scope !== scanScope(panel.id)) continue;
        const settings = loadScanSettings(scanScope(panel.id));
        const patch = { ...settings, groups: new Set(settings.groups) };
        const active = scanStatesRef.current[panel.id]?.active;
        scanRequests.current.set(panel.id, (scanRequests.current.get(panel.id) ?? 0) + 1);
        setScanStates(prev => ({ ...prev, [panel.id]: {
          ...(prev[panel.id] ?? defaultScanState(panel.id)), ...patch, suggestions: [], loading: false,
        } }));
        if (active) void scanRunnerRef.current(panel.id, patch);
      }
    };
    window.addEventListener(SCAN_SETTINGS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SCAN_SETTINGS_EVENT, sync);
      window.removeEventListener("storage", sync);
      scanRequests.current.clear();
    };
  }, [workspaceId, authUser?.id, panels.map(p => p.id).join("|")]);
  function updateScanSettings(panelId: string, patch: Partial<ScanSettings>) {
    saveScanSettings(scanScope(panelId), { ...loadScanSettings(scanScope(panelId)), ...patch });
  }

  const handleToggleScan = useCallback(
    (panelId: string) => {
      const current = scanStates[panelId];
      if (current?.active) {
        scanRequests.current.set(panelId, (scanRequests.current.get(panelId) ?? 0) + 1);
        setScanStates((prev) => ({
          ...prev,
          [panelId]: {
            ...(prev[panelId] ?? defaultScanState()),
            active: false,
            loading: false,
            suggestions: [],
            settingsOpen: false,
          },
        }));
      } else {
        void runScanForChart(panelId);
      }
    },
    [scanStates, runScanForChart],
  );

  const handleToggleScanSettings = useCallback((panelId: string) => {
    setScanStates((prev) => {
      const current = prev[panelId] ?? defaultScanState(panelId);
      return {
        ...prev,
        [panelId]: {
          ...current,
          settingsOpen: !current.settingsOpen,
        },
      };
    });
  }, [authUser?.id, workspaceId]);

  const handleAddScanSuggestion = useCallback(
    (panelId: string, sug: ScanAiSuggestion) => {
      const panel = panels.find((p) => p.id === panelId);
      const scanTf = panel ? scanTimeframeFor(panel) : "1m";
      const drawing = scanDrawing(sug, scanTf, theme.accent);
      const actions = chartDrawingActions.current.get(chartKey(panelId));
      if (!actions) return;
      const key = scanKey(panelId, scanTf);
      const accepted = acceptedScanGeometry.current.get(key) ?? [];
      if (alreadyDrawn(sug, existingScanDrawings(panelId), scanTf) || accepted.some(a => similarScanGeometry(sug, a))) return;
      acceptedScanGeometry.current.set(key, [...accepted, sug]);
      actions?.add([drawing]);

      setScanStates((prev) => {
        const cur = prev[panelId];
        if (!cur) return prev;
        const nextAdded = new Set(cur.addedIds);
        nextAdded.add(sug.id);
        return {
          ...prev,
          [panelId]: {
            ...cur,
            addedIds: nextAdded,
            suggestions: cur.suggestions.filter((s) => s.id !== sug.id),
          },
        };
      });
    },
    [panels, loadedBarsTimeframe, theme.accent, workspaceId, visibleDrawings, payload?.useChartProfile, authUser],
  );

  function registerChartActions(id: string) {
    const key = chartKey(id);
    return (actions?: ChartDrawingActions) => {
      if (actions) chartDrawingActions.current.set(key, actions);
      else chartDrawingActions.current.delete(key);
    };
  }

  function previewForChart(id: string, tf: Timeframe) {
    return scanPreview?.key === scanKey(id, id === MAIN_CHART ? loadedBarsTimeframe : tf) ? scanPreview?.drawing : undefined;
  }

  function addPanel(type: WorkspacePanelType) {
    const id = type === "chart" && !mainPanel ? MAIN_CHART : crypto.randomUUID();
    workspace.update((current) => {
      if (current.panels.length >= 12 || (type === "chart" && charts.length >= 4)) return current;
      if (type === "aiScan" && hasScanWidget) return current;
      if (type === "tradingAccount" && current.panels.some((panel) => panel.type === "tradingAccount")) return current;
      const panel = type === "chart" ? chartPanel(id, selectedTimeframe) : { id, type };
      return { ...current, panels: [...current.panels, panel], tradingAccountInitialized: current.tradingAccountInitialized || type === "tradingAccount" };
    });
    if (type === "chart") setSelection({ workspaceId, panelId: id });
    setVisualSelection({ workspaceId, panelId: id });
  }

  function removePanel(id: string) {
    scanRequests.current.set(id, (scanRequests.current.get(id) ?? 0) + 1);
    if (openScanChartId === id) setOpenScanChartId(undefined);
    setScanStates((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    workspace.update((current) => ({ ...current, panels: current.panels.filter((panel) => panel.id !== id) }));
    if (zoomed?.panelId === id) setZoomed(undefined);
    setScanPreview(undefined);
  }

  function movePanel(from: string, to: string) {
    workspace.update((current) => {
      if (from === to) return current;
      const next = [...current.panels];
      const fromIndex = next.findIndex((panel) => panel.id === from);
      const toIndex = next.findIndex((panel) => panel.id === to);
      if (fromIndex < 0 || toIndex < 0) return current;
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { ...current, panels: next };
    });
  }

  function changePanelTimeframe(panelId: string, next: Timeframe) {
    setScanPreview(undefined);
    setScanStates((prev) => {
      const cur = prev[panelId];
      if (!cur) return prev;
      return { ...prev, [panelId]: { ...cur, suggestions: [] } };
    });
    if (panelId === MAIN_CHART && payload?.useChartProfile && authUser) setProfileTimeframe(next);
    workspace.update((current) => ({
      ...current,
      panels: current.panels.map((panel) => panel.id === panelId ? { ...panel, timeframe: next } : panel),
    }));
  }

  async function toggleWorkspaceFullscreen() {
    if (document.fullscreenElement === shellRef.current) {
      await document.exitFullscreen();
    } else if (workspaceFullscreen) {
      setWorkspaceFullscreen(false);
    } else {
      try {
        if (!shellRef.current?.requestFullscreen) throw new Error("Fullscreen unavailable");
        await shellRef.current.requestFullscreen();
      } catch {
        setWorkspaceFullscreen(true);
      }
    }
  }

  function savePanelDrawings(id: string, state: DrawingState[]) {
    workspace.update((current) => {
      const panel = current.panels.find((item) => item.id === id);
      if (!panel || JSON.stringify(panel.drawings ?? []) === JSON.stringify(state)) return current;
      return { ...current, panels: current.panels.map((item) => item.id === id ? { ...item, drawings: state } : item) };
    });
  }

  function renderScan(chart: WorkspacePanel | undefined, close?: () => void) {
    if (!chart) return <div className="workspace-empty">Add a chart to run a scan.</div>;
    const id = chart.id;
    const scanTimeframe = scanTimeframeFor(chart);
    const key = scanKey(id, scanTimeframe);
    const actions = () => chartDrawingActions.current.get(chartKey(id));
    const add = (items: readonly AiScanCandidate[]) => items.forEach(item => handleAddScanSuggestion(id, item as unknown as ScanAiSuggestion));
    return <AiScanPanel
      key={key}
      settingsScope={scanScope(id)}
      existingDrawings={existingScanDrawings(id)}
      api={api}
      instrument={instrument}
      timeframe={scanTimeframe}
      contract={contract}
      endTime={id === MAIN_CHART && replayActive ? chartBars[chartBars.length - 1]?.time : undefined}
      onPreview={(candidate) => setScanPreview(candidate ? { key, drawing: scanDrawing(candidate, scanTimeframe, theme.accent, true) } : undefined)}
      onAdd={(item) => add([item])}
      onAddAll={add}
      onUndo={() => actions()?.undo()}
      onClose={() => { setScanPreview(undefined); setOpenScanChartId(undefined); close?.(); }}
    />;
  }

  function alertPanel(open: boolean, embedded = false) {
    return (
            <AlertPanel
              embedded={embedded}
              open={open}
              alerts={alerts}
              lastEvent={embedded ? undefined : lastAlert}
              onToggle={onToggleAlert}
              onDelete={onDeleteAlert}
              onCreate={onCreateAlert}
              telegram={telegramConfig}
              onTelegramSave={onSaveTelegram}
              onTelegramTest={onTestTelegram}
              telegramStatus={telegramStatus}
              webPush={webPushConfig}
              onWebPushEnable={onEnableWebPush}
              onWebPushDisable={onDisableWebPush}
              onWebPushTest={onTestWebPush}
              webPushStatus={webPushStatus}
              webPushSupported={webPushSupported}
            />
    );
  }

  function renderChartControls(panel: WorkspacePanel) {
    const primary = panel.id === MAIN_CHART;
    return (
      <div className="workspace-chart-controls" role="toolbar" aria-label="Chart toolbar">
        {primary && (
          <button
            type="button"
            className="workspace-drawing-toggle"
            aria-label={drawingToolsOpen ? "Close drawing tools" : "Open drawing tools"}
            title={drawingToolsOpen ? "Close drawing tools" : "Open drawing tools"}
            aria-controls="workspace-drawing-tools"
            aria-expanded={drawingToolsOpen}
            onClick={() => {
              if (drawingToolsOpen) deselectActiveTool();
              setDrawingToolsOpen(!drawingToolsOpen);
            }}
          >
            <span aria-hidden="true">{drawingToolsOpen ? "‹" : "›"}</span>
          </button>
        )}
        <SymbolContractLabel symbol={instrument.displaySymbol} contract={instrument.venue} />
        <TimeframeSelector value={primary ? timeframe : panel.timeframe ?? "1m"} onChange={(next) => changePanelTimeframe(panel.id, next)} />
        <div className="workspace-scan-toolbar-group">
          <button
            type="button"
            className={`workspace-scan-toggle ${scanStates[panel.id]?.active ? "is-active" : ""}`}
            aria-label={scanStates[panel.id]?.active ? "Disable AI Scan" : "Enable AI Scan"}
            title="AI Scan - chart suggestions"
            aria-pressed={scanStates[panel.id]?.active ?? false}
            disabled={scanStates[panel.id]?.loading}
            onClick={() => handleToggleScan(panel.id)}
          >
            {scanStates[panel.id]?.loading ? (
              <span className="workspace-scan-spinner" aria-hidden="true" />
            ) : (
              <ScanAiSparkleIcon />
            )}
            <span>Scan AI</span>
          </button>
          <button
            type="button"
            className="workspace-scan-settings-btn"
            aria-label="AI Scan filter settings"
            title="AI Scan suggestion settings"
            aria-expanded={scanStates[panel.id]?.settingsOpen ?? false}
            onClick={() => handleToggleScanSettings(panel.id)}
          >
            <span aria-hidden="true">⚙</span>
          </button>
          {scanStates[panel.id]?.settingsOpen && (
            <ScanAiSettingsPopover
              groups={scanStates[panel.id]?.groups ?? defaultScanState(panel.id).groups}
              strength={scanStates[panel.id]?.strength ?? defaultScanState(panel.id).strength}
              density={scanStates[panel.id]?.density ?? defaultScanState(panel.id).density}
              depth={scanStates[panel.id]?.depth ?? defaultScanState(panel.id).depth}
              targetsAndStop={scanStates[panel.id]?.targetsAndStop ?? defaultScanState(panel.id).targetsAndStop}
              patterns={scanStates[panel.id]?.patterns ?? defaultScanState(panel.id).patterns}
              state={scanStates[panel.id]?.state ?? defaultScanState(panel.id).state}
              onStateChange={state => updateScanSettings(panel.id, { state })}
              onPatternsChange={patterns => updateScanSettings(panel.id, { patterns })}
              onToggleGroup={group => {
                const groups = loadScanSettings(scanScope(panel.id)).groups;
                updateScanSettings(panel.id, { groups: groups.includes(group) ? groups.filter(g => g !== group) : [...groups, group] });
              }}
              onChangeStrength={strength => updateScanSettings(panel.id, { strength })}
              onChangeDensity={density => updateScanSettings(panel.id, { density })}
              onChangeDepth={depth => updateScanSettings(panel.id, { depth })}
              onToggleTargetsAndStop={targetsAndStop => updateScanSettings(panel.id, { targetsAndStop })}
              onRescan={() => void runScanForChart(panel.id)}
              onClose={() => handleToggleScanSettings(panel.id)}
            />
          )}
        </div>
        {primary && <>
          <IndicatorToggles
            indicatorsVisible={indicatorsVisible}
            denseOverlayMinBarSpacing={denseOverlayMinBarSpacing}
            onDenseOverlayMinBarSpacingChange={setDenseOverlayMinBarSpacing}
            volumeDelta={showVolumeDelta}
            xKontrol={showXKontrol}
            xKontrolSettings={xKontrolSettings}
            tduSignals={showTduSignals}
            mgannSwing={showMgannSwing}
            mgannSwingSettings={mgannSwing}
            fvgGrader={showFvgGrader}
            mgannBreak={showMgannBreak}
            mgannBreakSettings={mgannBreakSettings}
            fvgSignalLimit={fvgSignalLimit}
            mgannBreakSignalHistoryBars={mgannBreakSignalHistoryBars}
            mgannBreakSignalLimit={mgannBreakSignalLimit}
            bigTrades={showBigTrades && bigTradeOverlayEnabled}
            ema={ema}
            supertrend={supertrend}
            smc={smc}
            sweepReversal={sweepReversal}
            outsideBar={effectiveOutsideBar}
            footprintSettings={footprintSettings}
            bigTradeSettings={bigTradeSettings}
            mgannSwingDisabled={mgannSwingDisabled}
            tduSignalsDisabled={!tduSignalsEnabledForTimeframe(timeframe)}
            fvgGraderDisabled={timeframe !== "1m"}
            bigTradeDisabled={!bigTradeOverlayEnabled}
            dailyVolumeProfile={showDailyVolumeProfile}
            dailyVolumeProfileWidth={dailyVolumeProfileWidth}
            dailyVolumeProfileDevelopingPoc={showDailyVolumeProfileDevelopingPoc}
            dailyVolumeProfileRowTicks={dailyVolumeProfileRowTicks}
            dailyVolumeProfileDays={dailyVolumeProfileDays}
            onDailyVolumeProfileChange={setShowDailyVolumeProfile}
            onDailyVolumeProfileWidthChange={setDailyVolumeProfileWidth}
            onDailyVolumeProfileDevelopingPocChange={
              setShowDailyVolumeProfileDevelopingPoc
            }
            onDailyVolumeProfileRowTicksChange={setDailyVolumeProfileRowTicks}
            onDailyVolumeProfileDaysChange={setDailyVolumeProfileDays}
            onVolumeDeltaChange={setShowVolumeDelta}
            onXKontrolChange={setShowXKontrol}
            onXKontrolSettingsChange={setXKontrolSettings}
            onTduSignalsChange={setShowTduSignals}
            onMgannSwingChange={setShowMgannSwing}
            onMgannSwingSettingsChange={setMgannSwing}
            onFvgGraderChange={setShowFvgGrader}
            onMgannBreakChange={setShowMgannBreak}
            onMgannBreakSettingsChange={onMgannBreakSettingsChange}
            onCreateMgannBreakAlert={onCreateMgannBreakAlert}
            onFvgSignalLimitChange={setFvgSignalLimit}
            onMgannBreakSignalHistoryBarsChange={setMgannBreakSignalHistoryBars}
            onMgannBreakSignalLimitChange={setMgannBreakSignalLimit}
            onBigTradesChange={setShowBigTrades}
            onEmaChange={setEma}
            onSupertrendChange={setSupertrend}
            onCreateSupertrendAlert={onCreateSupertrendAlert}
            supertrendAlertDisabled={timeframe === "15s"}
            onSmcChange={setSmc}
            onSweepReversalChange={setSweepReversal}
            onCreateSweepReversalAlert={onCreateSweepReversalAlert}
            onOutsideBarChange={setOutsideBar}
            onFootprintSettingsChange={setFootprintSettings}
            onBigTradeSettingsChange={setBigTradeSettings}
          />
          <div className="toolbar-alert-group">
            <ReplayToolbarButton
              phase={replayPhase}
              disabled={!hasLoadedCurrentSeries || bars.length < 3}
              onClick={() => {
                if (replayActive) {
                  exitBarReplay();
                } else if (replaySelecting) {
                  cancelBarReplaySelection();
                } else {
                  beginBarReplaySelection();
                }
              }}
            />
            <div className="alert-popover">
              <AlertToolbarButton
                open={alertPanelOpen}
                alertCount={alerts.length}
                onClick={() =>
                  setAlertPanelOpen((open) => {
                    return !open;
                  })
                }
              />
              {alertPanel(alertPanelOpen)}
            </div>
          </div>
        </>}
      </div>
    );
  }

  function renderTradingAccount() {
    const connected = authUser && executionEnabled && mt5Account && mt5Account.connected !== false;
    const accountLabel = mt5Account
      ? `${mt5Account.server || mt5Account.provider || "Broker"} · ${mt5Account.login || mt5Account.accountId}`
      : "";
    return (
      <section className="trading-account-widget" aria-label="Broker account">
        {connected ? (
          <>
            <div className="trading-account-summary">
              <strong title={accountLabel}>{accountLabel}</strong>
            </div>
            {replayActive ? (
              <p className="trading-account-note">Exit replay to manage orders.</p>
            ) : (
              <MarketOrderBar
                account={mt5Account}
                pending={orderPending}
                error={visibleOrderError || undefined}
                openOrderCount={orderRows.length}
                orderRows={orderRows}
                settings={marketOrderSettings}
                onSettingsChange={(settings) => {
                  setMarketOrderSettings(sanitizeMarketOrderSettings(settings));
                  setOrderError((prev) =>
                    prev.startsWith("Risk sizing") ? "" : prev
                  );
                }}
                onMarketOrder={onMarketOrder}
                onOrderRowBreakEven={onOrderRowBreakEven}
                onOrderRowSupertrendTrailing={onOrderRowSupertrendTrailing}
                onOrderRowClose={onOrderRowClose}
                onOrderRowClose50Percent={onOrderRowClose50Percent}
                onOrderRowCancel={onOrderRowCancel}
              />
            )}
          </>
        ) : (
          <div className="trading-account-connect">
            <h2>Connect your trading account</h2>
            <button
              type="button"
              className="trading-account-connect-button"
              disabled={Boolean(authUser && !executionEnabled)}
              onClick={onOpenMt5Account}
            >{authUser ? "Connect Account" : "Login to connect"}</button>
            {authUser && !executionEnabled && <p>Broker connection is currently unavailable.</p>}
            {authUser && visibleOrderError && <p role="alert">{visibleOrderError}</p>}
          </div>
        )}
      </section>
    );
  }

  function renderWidget(panel: WorkspacePanel) {
    const tf = panel.timeframe ?? "1m";
    switch (panel.type) {
      case "chart": return <MiniChartPanel
        sync={workspaceSync.connection(panel.id)}
        onAutoFootprintVisibilityChange={(visible) => updateAutoFootprintPanel(panel.id, visible)}
        denseOverlayMinBarSpacing={denseOverlayMinBarSpacing}
        autoFootprint={indicatorsVisible}
        api={api}
        socket={socket}
        instrument={instrument}
        contract={contract}
        timeframe={tf}
        theme={theme}
        timezoneOffsetMinutes={timezoneOffsetMinutes}
        drawings={panel.drawings}
        onDrawingsChange={(state) => savePanelDrawings(panel.id, state)}
        onDrawingActionsReady={registerChartActions(panel.id)}
        previewDrawing={previewForChart(panel.id, tf)}
        scanDrafts={scanStates[panel.id]?.active ? {
          suggestions: scanStates[panel.id]?.suggestions ?? [],
          onAddSuggestion: (sug) => handleAddScanSuggestion(panel.id, sug),
        } : undefined}
        drawingKeyboardActive={selectedChart?.id === panel.id}
      />;
      case "aiScan": return renderScan(selectedChart, () => removePanel(panel.id));
      case "alerts": return alertPanel(true, true);
      case "tradingAccount": return renderTradingAccount();
      case "footprint": return <WidgetFrame path="/fp" name={PANEL_NAMES.footprint} theme={theme} widgetId={panel.id} relay={workspaceSync} onActivate={() => activatePanel(panel.id)} />;
      case "marketProfile": return <WidgetFrame path="/mp" name={PANEL_NAMES.marketProfile} theme={theme} widgetId={panel.id} relay={workspaceSync} onActivate={() => activatePanel(panel.id)} />;
      case "liquidity": return <WidgetFrame path="/lq" name={PANEL_NAMES.liquidity} theme={theme} widgetId={panel.id} relay={workspaceSync} onActivate={() => activatePanel(panel.id)} />;
    }
  }

  return (
    <div ref={shellRef} className={appShellClassName(chartFocusMode) + (workspaceFullscreen ? " workspace-is-fullscreen" : "")}>
      <WorkspaceToolbar
        workspaces={workspace.workspaces}
        activeWorkspaceId={workspaceId ?? ""}
        theme={savedTheme}
        fullscreen={workspaceFullscreen}
        requestPending={workspace.requestPending || !workspace.ready}
        hasActiveWorkspace={Boolean(payload)}
        panelCount={panels.length}
        chartCount={charts.length}
        hasTradingAccount={panels.some((panel) => panel.type === "tradingAccount")}
        onSelect={workspace.select}
        onCreate={(template) => { void workspace.create(template); }}
        onRename={workspace.rename}
        onRemove={(id) => { void workspace.remove(id); }}
        onAddPanel={addPanel}
        onThemeChange={(nextTheme) => workspace.update((current) => ({ ...current, theme: nextTheme }))}
        onFullscreen={() => void toggleWorkspaceFullscreen()}
        accountControls={
          <div className="workspace-account" role="group" aria-label="Account controls">
            {authUser ? (
              <>
                <button type="button" onClick={onLogout}>
                  Logout
                </button>
              </>
            ) : (
              <button type="button" onClick={onTradingLogin}>
                Login
              </button>
            )}
          </div>
        }
      />
      {workspace.error && <div className="workspace-error" role="alert">{workspace.error} <button type="button" onClick={workspace.retrySave}>Retry</button></div>}
      <main className="chart-area">
        {payload && <WorkspaceBoard
          key={workspaceId}
          panels={panels}
          layout={payload.layout}
          selectedId={visualSelection && visualSelection.workspaceId === workspaceId && panels.some(panel => panel.id === visualSelection.panelId)
            ? visualSelection.panelId : selectedChart?.id ?? panels[0]?.id}
          fullscreenId={fullscreenPanelId}
          compactTradingAccount={Boolean(authUser)}
          onAccountSettings={authUser && executionEnabled && mt5Account && mt5Account.connected !== false ? onOpenMt5Account : undefined}
          onSelect={activatePanel}
          onFullscreen={(panelId) => setZoomed(fullscreenPanelId === panelId ? undefined : { workspaceId, panelId })}
          onRemove={removePanel}
          onMove={movePanel}
          onResize={(layout) => workspace.update((current) => ({ ...current, layout }))}
          renderChartControls={renderChartControls}
          renderLinkControls={panel => canLinkPanel(panel) ? <WidgetLinkMenu name={PANEL_NAMES[panel.type]}
            paused={panel.id === MAIN_CHART && replayActive}
            value={panel.sync} onChange={sync => workspace.update(current => ({ ...current,
              panels: current.panels.map(item => item.id === panel.id ? { ...item, sync } : item),
            }))} /> : null}
          renderPanel={(panel) => <>
            {panel.id !== MAIN_CHART ? renderWidget(panel) : <div className="workspace-primary-chart">
              <div id="workspace-drawing-tools" className="workspace-drawing-rail" hidden={!drawingToolsOpen}>
                <DrawingToolbar
                  activeTool={activeTool}
                  drawingCount={drawingCount}
                  onToolSelect={(tool) => { setFootprintZoomSelecting(false); setActiveTool(tool); }}
                  footprintZoomSelecting={footprintZoomSelecting}
                  footprintZoomDisabled={!footprintEnabledForTimeframe(timeframe)}
                  onFootprintZoomSelect={() => { setActiveTool(null); setFootprintZoomSelecting((selecting) => !selecting); }}
                  onDeleteAll={deleteAllDrawings}
                  indicatorsVisible={indicatorsVisible}
                  onIndicatorsVisibleChange={setIndicatorsVisible}
                  orderLevelsVisible={orderLevelsVisible}
                  onOrderLevelsVisibleChange={setOrderLevelsVisible}
                  showOrderLevelsToggle={executionEnabled}
                />
              </div>
              <div className="chart-stack">
                <ChartContainer
                  symbol={SYMBOL}
                  contract={contract}
                  timeframe={timeframe}
                  bars={chartBars}
                  barsTimeframe={
                    replayActive
                      ? replayDataset?.barsTimeframe ?? loadedBarsTimeframe
                      : loadedBarsTimeframe
                  }
                  volumeDelta={chartVolumeDelta}
                  footprintBars={chartFootprintBars}
                  fvgSignals={chartFvgSignals}
                  tduSignals={chartTduSignals}
                  bigTrades={chartBigTrades}
                  smcAiSignals={chartSmcAiSignals}
                  alertSignals={chartAlertSignals}
                  alertLines={replayActive ? EMPTY_ALERT_LINES : alertLines}
                  orderLines={executionEnabled && !replayActive && orderLevelsVisible ? orderLines : EMPTY_ORDER_LINES}
                  orderControls={executionEnabled && !replayActive && orderLevelsVisible ? orderControls : EMPTY_ORDER_CONTROLS}
                  ema={visibleEma}
                  supertrend={visibleSupertrend}
                  smc={visibleSmc}
                  sweepReversal={visibleSweepReversal}
                  outsideBar={visibleOutsideBar}
                  sessionVolumeProfile={
                    indicatorsVisible && showDailyVolumeProfile && !replayActive
                      ? sessionVolumeProfile
                      : null
                  }
                  sessionVolumeProfileWidth={dailyVolumeProfileWidth}
                  sessionVolumeProfileDevelopingPoc={
                    showDailyVolumeProfileDevelopingPoc
                  }
                  showVolume
                  showVolumeDelta={indicatorsVisible && showVolumeDelta}
                  showXKontrol={indicatorsVisible && showXKontrol}
                  xKontrolSettings={xKontrolSettings}
                  showTduSignals={
                    indicatorsVisible &&
                    showTduSignals &&
                    tduSignalsEnabledForTimeframe(timeframe) &&
                    !replayActive
                  }
                  showCvd={indicatorsVisible && showMgannWaveDelta}
                  showMgannSwing={indicatorsVisible && showMgannSwingForTimeframe}
                  mgannSwing={mgannSwing}
                  autoFootprint={indicatorsVisible}
                  footprintApi={api}
                  onAutoFootprintVisibilityChange={(visible) => updateAutoFootprintPanel(MAIN_CHART, visible)}
                  footprintZoomSelecting={footprintZoomSelecting}
                  onFootprintZoomSelectionComplete={() => setFootprintZoomSelecting(false)}
                  denseOverlayMinBarSpacing={denseOverlayMinBarSpacing}
                  showFvgGrader={indicatorsVisible && showFvgGrader && timeframe === "1m"}
                  showBigTrades={indicatorsVisible && showBigTrades && bigTradeOverlayEnabled}
                  bigTradeSettings={bigTradeSettings}
                  chartBackgroundColor={theme.background}
                  chartTheme={theme}
                  timezoneOffsetMinutes={timezoneOffsetMinutes}
                  onTimezoneOffsetChange={setTimezoneOffsetMinutes}
                  socket={socket}
                  suspendRealtime={replayActive}
                  followLatestBar={replayActive && replayFollowLatest}
                  onChartNavigate={
                    replayActive ? () => setReplayFollowLatest(false) : undefined
                  }
                  replaySelecting={replaySelecting}
                  onBarClick={replaySelecting ? selectBarReplayStart : undefined}
                  onRequestAlertAtPrice={replayActive ? undefined : onRequestChartMenu}
                  onRealtimeBar={onChartRealtimeBar}
                  onRequestMoreHistory={replayActive ? undefined : requestMoreHistory}
                  onAlertDragCommit={replayActive ? undefined : onAlertDragCommit}
                  onAlertDelete={replayActive ? undefined : onDeleteAlert}
                  onOrderDragCommit={executionEnabled && !replayActive ? onOrderDragCommit : undefined}
                  onOrderDragBatchCommit={executionEnabled && !replayActive ? onOrderDragBatchCommit : undefined}
                  onOrderClose={executionEnabled && !replayActive ? onOrderRowClose : undefined}
                  onOrderCancel={executionEnabled && !replayActive ? onOrderRowCancel : undefined}
                  priceSnap={roundGcPrice}
                  activeTool={activeTool}
                  fixedRangeProfileMode={fixedRangeProfileMode}
                  onToolDeselect={deselectActiveTool}
                  onDrawingCountChange={setDrawingCount}
                  sync={replayActive ? undefined : workspaceSync.connection(panel.id)}
                  drawings={payload.useChartProfile && authUser ? visibleDrawings : mainPanel?.drawings}
                  drawingsLoadKey={payload.useChartProfile && authUser ? visibleDrawingsLoadKey : timeframe}
                  onDrawingsChange={(state) => onDrawingsStateChange(state, payload.useChartProfile && authUser ? undefined : panel.id)}
                  onDrawingActionsReady={registerChartActions(panel.id)}
                  previewDrawing={previewForChart(panel.id, timeframe)}
                  scanDrafts={scanStates[panel.id]?.active ? {
                    suggestions: scanStates[panel.id]?.suggestions ?? [],
                    onAddSuggestion: (sug) => handleAddScanSuggestion(panel.id, sug),
                  } : undefined}
                  drawingKeyboardActive={selectedChart?.id === panel.id}
                  deleteAllSignal={deleteAllSignal}
                  removeDrawingIds={removeDrawingIds}
                  fixedRangeDeltaProfiles={fixedRangeDeltaProfiles}
                  footprintSettings={footprintSettings}
                  onScreenshotCaptureReady={registerScreenshotCapture}
                >
                  <BarReplayControls
                    phase={replayPhase}
                    playing={replayPlaying}
                    speed={replaySpeed}
                    currentBar={replayActive ? replayCursorIndex + 1 : 0}
                    totalBars={replayDataset?.bars.length ?? 0}
                    selectionError={replaySelectionError}
                    onCancelSelection={cancelBarReplaySelection}
                    onTogglePlaying={() => {
                      if (
                        replayDataset !== undefined &&
                        replayCursorIndex < replayDataset.bars.length - 1
                      ) {
                        setReplayPlaying((playing) => !playing);
                      }
                    }}
                    onStepBack={() => stepBarReplay(-1)}
                    onStepForward={() => stepBarReplay(1)}
                    onSpeedChange={setReplaySpeed}
                    onExit={exitBarReplay}
                  />
                  <div className="chart-quick-controls" aria-label="Quick chart controls">
                    <button
                      type="button"
                      className="chart-focus-toggle"
                      aria-pressed={chartFocusMode}
                      onClick={toggleChartFocusMode}
                    >
                      {chartFocusMode ? "Exit" : "Focus"}
                    </button>
                  </div>
                </ChartContainer>
              </div>
            </div>}
          </>}
        />}
        {!payload && !workspace.error && (
          <div className="workspace-empty" role="status">
            {workspace.ready ? "Choose + to create a workspace." : "Loading workspace…"}
          </div>
        )}
        <AuthDialog
          open={authDialogOpen}
          mode={authMode}
          pending={authPending}
          error={authError}
          usernameHint={authUser?.username ?? "local"}
          onModeChange={(mode) => {
            setAuthMode(mode);
            setAuthError("");
          }}
          onSubmit={onAuthSubmit}
          onClose={() => setAuthDialogOpen(false)}
        />
        {executionEnabled && <ExnessAccountDialog
          open={mt5DialogOpen}
          account={mt5Account}
          profileName={authUser?.username}
          pending={mt5Pending}
          error={mt5Error}
          onSubmit={onSubmitExnessAccount}
          onAcknowledgeUncertain={(key) => {
            const requestedUser = authUserIdRef.current;
            setMt5Pending(true);
            setMt5Error("");
            void api.acknowledgeUncertainExecution(key).then((account) => {
              if (authUserIdRef.current === requestedUser) {
                setMt5Account(account);
                return refreshTradingState();
              }
            }).catch((error: unknown) => {
              if (authUserIdRef.current === requestedUser) setMt5Error(error instanceof Error ? error.message : "Review failed");
            }).finally(() => { if (authUserIdRef.current === requestedUser) setMt5Pending(false); });
          }}
          onClose={() => setMt5DialogOpen(false)}
        />}
        {chartMenu !== undefined && (
          <ChartContextMenu
            menu={chartMenu}
            limitDraft={chartMenuLimitDraft}
            orderPending={orderPending}
            onClose={() => setChartMenu(undefined)}
            onAddAlert={onConfirmAlertAtPrice}
            onPlaceLimitOrder={onConfirmLimitOrderDraft}
          />
        )}
      </main>
    </div>
  );
}
