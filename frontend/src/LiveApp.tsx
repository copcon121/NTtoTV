import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UTCTimestamp } from "lightweight-charts";

import {
  ApiClient,
  type AlertSignalRestRow,
  type AnalystEventAiState,
  type AnalystReport,
  type AuthUser,
  type Mt5Account,
  type Mt5ConnectInput,
  type Mt5OpenTrades,
  type Mt5PendingOrder,
  type Mt5Symbol,
  type Mt5Terminal,
} from "./api/client";
import { AlertPanel } from "./alerts/AlertPanel";
import {
  type Alert,
  type TelegramNotificationConfig,
  type TelegramNotificationInput,
  type WebPushNotificationConfig,
} from "./alerts/types";
import { ChartContainer, type OrderControl } from "./chart/ChartContainer";
import { DrawingToolbar } from "./chart/DrawingToolbar";
import {
  IndicatorToggles,
  DEFAULT_BIG_TRADE_SETTINGS,
  DEFAULT_EMA_SETTINGS,
  DEFAULT_FVG_SIGNAL_LIMIT,
  DEFAULT_FOOTPRINT_SETTINGS,
  normalizeEmaSettings,
  normalizeFvgSignalLimit,
} from "./chart/IndicatorToggles";
import type {
  BigTradeSettings,
  EmaSettings,
  FootprintSettings,
} from "./chart/IndicatorToggles";
import { TimeframeSelector } from "./chart/TimeframeSelector";
import { SymbolContractLabel } from "./chart/SymbolContractLabel";
import { Toolbar } from "./chart/Toolbar";
import {
  type BigTradeMarker,
  applyBigTrade,
  reduceBigTrades,
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
import { bigTradeMinVolumeForTime } from "./chart/bigTradeSessions";
import { DEFAULT_SMC_SETTINGS, type SmcSettings } from "./chart/smc";
import {
  DEFAULT_SESSION_VOLUME_PROFILE_WIDTH_PX,
  normalizeSessionVolumeProfileWidth,
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
  mergeFootprint,
} from "./footprint/footprintModel";
import {
  type VolumeDeltaDatum,
  type AlertLine,
  type AlertSignalMarker,
  type OrderLine,
  type OrderLineField,
  type SmcAiSignalMarker,
} from "./chart/lightweightChartsAdapter";
import {
  MarketOrderBar,
  type MarketOrderRow,
  type MarketOrderSettings,
} from "./orders/MarketOrderBar";
import { Mt5AccountDialog } from "./orders/Mt5AccountDialog";
import { ChartSocket } from "./socket/ChartSocket";
import {
  type AccountPositionUpdate,
  type AlertEventMessage,
  type ChartEventType,
  type FvgSignalUpdateMessage,
  type TradingAccount,
  type TradingOrder,
  type TradingPosition,
  type Timeframe,
} from "./socket/messages";
import type { ChartProfilePayload } from "./profiles/types";
import type {
  DeltaProfileData,
  DeltaProfileLoadState,
  DeltaProfileSource,
} from "./orderflow/deltaProfile";
import { StatusIndicator, type ConnectionState } from "./status/StatusIndicator";
import type {
  DrawingState,
  DrawingToolType,
  FixedRangeProfileMode,
} from "./chart/drawings/types";
import {
  displayOffsetForTimeframe,
  fixedRangeMsFromAnchors,
} from "./chart/timeframeRange";
import {
  DEFAULT_TIMEZONE_OFFSET_MINUTES,
  TIMEZONE_OFFSET_OPTIONS,
  formatUtcOffset,
  normalizeTimezoneOffsetMinutes,
} from "./chart/timezone";
import { resolveEndpoints } from "./endpoints";
import {
  isWebPushSupported,
  subscribeBrowserWebPush,
  unsubscribeBrowserWebPush,
} from "./webPush";

export { resolveEndpoints } from "./endpoints";

const SYMBOL = "GC";
export const CHART_CONTRACT = SYMBOL;
const DEFAULT_PROFILE_ID = "default";
const ACTIVE_PROFILE_STORAGE_KEY = "gc-chart-platform.active-profile";
const PROFILE_HOT_SNAPSHOT_STORAGE_KEY = "gc-chart-platform.profile-hot-snapshot";
const PROFILE_HOT_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1_000;
const LEGACY_DEFAULT_CHART_BACKGROUND = "#101010";
const DEFAULT_CHART_BACKGROUND = "#d3d3d3";
const SOCKET_IDLE_TIMEOUT_MS = 45_000;
const SOCKET_TRANSITION_TIMEOUT_MS = 10_000;
const DISCONNECT_STATUS_DEBOUNCE_MS = 1_500;
const DEGRADED_STATUS_TTL_MS = 8_000;
const PROFILE_TIMEFRAMES = new Set<Timeframe>([
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "4h",
  "1D",
]);

function normalizeChartBackgroundColor(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_CHART_BACKGROUND;
  }
  return value.trim().toLowerCase() === LEGACY_DEFAULT_CHART_BACKGROUND
    ? DEFAULT_CHART_BACKGROUND
    : value;
}

const TIMEFRAME_RANK: Record<Timeframe, number> = {
  "1m": 1,
  "3m": 3,
  "5m": 5,
  "15m": 15,
  "30m": 30,
  "1h": 60,
  "4h": 240,
  "1D": 1440,
};
export const GLOBAL_SUBSCRIBED_EVENTS: ChartEventType[] = [
  "quote_update",
  "alert_event",
  "order_update",
  "position_update",
  "account_update",
  "basis_update",
  "risk_update",
  "status",
];
export const BIG_TRADE_SUBSCRIBED_EVENTS: ChartEventType[] = ["big_trade"];
export const TIMEFRAME_SUBSCRIBED_EVENTS: ChartEventType[] = [
  "bar_update",
  "volume_delta_update",
  "fvg_signal_update",
];
export const FOOTPRINT_SUBSCRIBED_EVENTS: ChartEventType[] = [
  "footprint_update",
];
const EMPTY_BARS: readonly Bar[] = [];
const EMPTY_VOLUME_DELTA: readonly VolumeDeltaDatum[] = [];
const EMPTY_BIG_TRADES: readonly BigTradeMarker[] = [];
const EMPTY_SMC_AI_SIGNALS: readonly SmcAiSignalMarker[] = [];
const EMPTY_ALERT_SIGNAL_MARKERS: readonly AlertSignalMarker[] = [];
const EMPTY_FOOTPRINT_BARS: ReadonlyMap<number, FootprintBar> = new Map();
const EMPTY_FVG_SIGNALS: ReadonlyMap<number, FvgSignalUpdateMessage> = new Map();
const DEFERRED_INDICATOR_LOAD_MS = 75;
const DEFERRED_OVERLAY_LOAD_MS = 250;
const REALTIME_OVERLAY_CATCH_UP_MS = 10_000;
const FVG_GRADER_CATCH_UP_MS = 30_000;
const RESUME_REFRESH_THROTTLE_MS = 2_000;
const INITIAL_HISTORY_LIMIT = 5_000;
const HISTORY_BACKFILL_LIMIT = 5_000;
const HISTORICAL_ALERT_SIGNAL_BAR_LIMIT = 1_000;
const INITIAL_VOLUME_DELTA_LIMIT = 2_000;
const INITIAL_BIG_TRADE_LIMIT = DEFAULT_BIG_TRADE_SETTINGS.maxVisible;
const DRAWINGS_AUTOSAVE_DELAY_MS = 90_000;
const VOLUME_PROFILE_ROW_TICKS = 1;
const DELTA_PROFILE_ROW_TICKS = 2;
const SESSION_VP_START_UTC_HOUR = 22;
const DELTA_PROFILE_VALUE_AREA_PCT = 68;
const DELTA_PROFILE_REFRESH_DELAY_MS = 1_000;
const ORDER_REFRESH_INTERVAL_MS = 5_000;
const ENABLE_REALTIME_FOOTPRINT_UPDATES = true;
const MARKET_ORDER_SETTINGS_STORAGE_KEY = "gc-chart-platform.market-order-settings";
const DEFAULT_MARKET_ORDER_SETTINGS: MarketOrderSettings = {
  volumeLots: 0.1,
  slDistanceGc: 3,
  tpDistanceGc: 6,
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
  price_crosses_level: "cross",
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
  const historicalParts = marker.id.split(":hist:");
  if (historicalParts.length === 2) {
    const [alertId, rest] = historicalParts;
    const [time, direction] = rest.split(":");
    if (alertId && time && direction) {
      return `${alertId}:${time}:${direction}`;
    }
  }
  const parts = marker.id.split(":");
  if (parts.length >= 3) {
    const direction = parts[parts.length - 1];
    const time = parts[parts.length - 2];
    const alertId = parts.slice(0, -2).join(":");
    if (alertId && time && direction) {
      return `${alertId}:${time}:${direction}`;
    }
  }
  return `${marker.id}:${marker.time}:${marker.direction}`;
}

function mergeAlertSignalMarker(
  current: readonly AlertSignalMarker[],
  marker: AlertSignalMarker,
): readonly AlertSignalMarker[] {
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
  const next = {
    ...current,
    tradeMode: update.tradeMode,
    balance: update.balance,
    equity: update.equity,
    freeMargin: update.freeMargin,
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

function mt5AccountsEqual(
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
    left?.freeMargin === right?.freeMargin
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
  return {
    source: "chart_bracket",
    side,
    kind: "limit",
    volumeLots: settings.volumeLots,
    entryGc,
    referenceGc,
    slGc,
    tpGc,
    gcAnchored: true,
  };
}

function sanitizeMarketOrderSettings(
  value: Partial<MarketOrderSettings> | null | undefined,
): MarketOrderSettings {
  const volumeLots = Number(value?.volumeLots);
  const slDistanceGc = Number(value?.slDistanceGc);
  const tpDistanceGc = Number(value?.tpDistanceGc);
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

function toOrderLines(orders: readonly TradingOrder[]): OrderLine[] {
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
    if (isFinitePrice(entry)) {
      lines.push({
        id: orderLineId(order.id, "entryGc"),
        orderId: order.id,
        field: "entryGc",
        price: entry,
        side: order.side,
        status: order.status,
        editable: !hasBrokerPosition && order.status !== "filled",
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

function mt5PositionKey(ticket: number): string {
  return `mt5pos:${ticket}`;
}

function mt5OrderKey(ticket: number): string {
  return `mt5order:${ticket}`;
}

function appOrderRowKey(orderId: string): string {
  return `app:${orderId}`;
}

function parseActionRowId(id: string):
  | { source: "app"; orderId: string }
  | { source: "mt5pos"; ticket: number }
  | { source: "mt5order"; ticket: number }
  | undefined {
  if (id.startsWith("app:")) {
    const orderId = id.slice("app:".length);
    return orderId ? { source: "app", orderId } : undefined;
  }
  if (id.startsWith("mt5pos:")) {
    const ticket = Number(id.slice("mt5pos:".length));
    return Number.isInteger(ticket) ? { source: "mt5pos", ticket } : undefined;
  }
  if (id.startsWith("mt5order:")) {
    const ticket = Number(id.slice("mt5order:".length));
    return Number.isInteger(ticket) ? { source: "mt5order", ticket } : undefined;
  }
  return undefined;
}

function appBrokerPositionTickets(orders: readonly TradingOrder[]): Set<number> {
  return new Set(
    orders
      .map((order) => order.brokerPositionTicket)
      .filter((ticket): ticket is number => ticket != null),
  );
}

function appBrokerOrderTickets(orders: readonly TradingOrder[]): Set<number> {
  return new Set(
    orders
      .map((order) => order.brokerOrderTicket)
      .filter((ticket): ticket is number => ticket != null),
  );
}

function manualPositionLines(
  positions: readonly TradingPosition[],
  appOrders: readonly TradingOrder[],
): OrderLine[] {
  const appTickets = appBrokerPositionTickets(appOrders);
  const lines: OrderLine[] = [];
  for (const position of positions) {
    if (appTickets.has(position.brokerPositionTicket)) continue;
    const orderId = mt5PositionKey(position.brokerPositionTicket);
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
        editable: position.basisStale !== true,
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
        editable: position.basisStale !== true,
      });
    }
  }
  return lines;
}

function manualPendingOrderLines(
  pendingOrders: readonly Mt5PendingOrder[],
  appOrders: readonly TradingOrder[],
): OrderLine[] {
  const appTickets = appBrokerOrderTickets(appOrders);
  const lines: OrderLine[] = [];
  for (const pending of pendingOrders) {
    if (appTickets.has(pending.brokerOrderTicket)) continue;
    const orderId = mt5OrderKey(pending.brokerOrderTicket);
    if (isFinitePrice(pending.entryGc)) {
      lines.push({
        id: orderLineId(orderId, "entryGc"),
        orderId,
        field: "entryGc",
        price: pending.entryGc,
        side: pending.side,
        status: "working",
        title: `${pending.side.toUpperCase()} ${pending.kind}`,
        editable: pending.basisStale !== true,
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
        editable: pending.basisStale !== true,
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
        editable: pending.basisStale !== true,
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
): MarketOrderRow[] {
  const rows: MarketOrderRow[] = [];
  const brokerPositionsByTicket = new Map(
    mt5OpenTrades.positions.map((position) => [
      position.brokerPositionTicket,
      position,
    ]),
  );
  for (const order of orders) {
    if (order.symbolInternal !== SYMBOL || !isOpenTradingOrder(order)) continue;
    const entry = orderEntryGc(order);
    if (entry === undefined) continue;
    const brokerPosition =
      order.brokerPositionTicket == null
        ? undefined
        : brokerPositionsByTicket.get(order.brokerPositionTicket);
    const pnl = brokerPosition?.profit ?? estimateOrderPnl(order, currentPrice, symbol);
    const hasBrokerPosition = order.brokerPositionTicket != null;
    const status = hasBrokerPosition || order.status === "filled" ? "fill" : order.status;
    const rowId = appOrderRowKey(order.id);
    rows.push({
      id: rowId,
      side: order.side,
      title: `${order.side.toUpperCase()} ${status}`,
      detail: `${order.volumeLots.toFixed(2)} @ ${entry.toFixed(1)}`,
      pnlText: formatPnl(pnl),
      pnlValue: pnl,
      volumeLots: order.volumeLots,
      action:
        hasBrokerPosition &&
        (order.status === "filled" || order.status === "sync_error")
          ? "close"
          : "cancel",
      canBreakEven: hasBrokerPosition && brokerPosition?.basisStale !== true,
      breakEvenPending: breakingEvenIds.has(rowId),
      pending: closingIds.has(order.id) || cancellingIds.has(order.id),
    });
  }
  const appPositionTickets = appBrokerPositionTickets(orders);
  for (const position of mt5OpenTrades.positions) {
    if (appPositionTickets.has(position.brokerPositionTicket)) continue;
    const entry = position.entryGcEstimate;
    const rowId = mt5PositionKey(position.brokerPositionTicket);
    rows.push({
      id: rowId,
      side: position.side,
      title: `${position.side.toUpperCase()} manual`,
      detail: `${position.volumeLots.toFixed(2)} @ ${
        isFinitePrice(entry) ? entry.toFixed(1) : position.entryBroker.toFixed(3)
      }`,
      pnlText: formatPnl(position.profit),
      pnlValue: position.profit,
      volumeLots: position.volumeLots,
      action: "close",
      canBreakEven: isFinitePrice(entry) && position.basisStale !== true,
      breakEvenPending: breakingEvenIds.has(rowId),
      pending: closingIds.has(rowId),
    });
  }
  const appOrderTickets = appBrokerOrderTickets(orders);
  for (const pending of mt5OpenTrades.orders) {
    if (appOrderTickets.has(pending.brokerOrderTicket)) continue;
    rows.push({
      id: mt5OrderKey(pending.brokerOrderTicket),
      side: pending.side,
      title: `${pending.side.toUpperCase()} ${pending.kind}`,
      detail: `${pending.volumeLots.toFixed(2)} @ ${
        isFinitePrice(pending.entryGc)
          ? pending.entryGc.toFixed(1)
          : pending.entryBroker.toFixed(3)
      }`,
      action: "cancel",
      volumeLots: pending.volumeLots,
      pending: cancellingIds.has(mt5OrderKey(pending.brokerOrderTicket)),
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
): OrderControl[] {
  const controls: OrderControl[] = [];
  const brokerPositionsByTicket = new Map(
    mt5OpenTrades.positions.map((position) => [
      position.brokerPositionTicket,
      position,
    ]),
  );

  const pushBracketControls = (input: {
    actionId: string;
    orderId: string;
    side: "buy" | "sell";
    volumeLots: number;
    entry: number | undefined;
    sl: number | null | undefined;
    tp: number | null | undefined;
    pnlValue?: number;
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
        pnlText: formatPnl(input.pnlValue),
        pnlValue: input.pnlValue,
        canClose: input.canClose,
        canCancel: input.canCancel,
        closing: input.closing,
        cancelling: input.cancelling,
      });
    }
    if (isFinitePrice(input.sl)) {
      const pnlValue = estimatePnlAtPrice({
        side: input.side,
        volumeLots: input.volumeLots,
        entryGc: input.entry,
        exitGc: input.sl,
        symbol,
      });
      controls.push({
        id: `${input.actionId}:sl`,
        orderId: input.orderId,
        actionId: input.actionId,
        level: "sl",
        price: input.sl,
        side: input.side,
        title: "SL",
        detail: input.sl.toFixed(1),
        pnlText: formatPnl(pnlValue),
        pnlValue,
      });
    }
    if (isFinitePrice(input.tp)) {
      const pnlValue = estimatePnlAtPrice({
        side: input.side,
        volumeLots: input.volumeLots,
        entryGc: input.entry,
        exitGc: input.tp,
        symbol,
      });
      controls.push({
        id: `${input.actionId}:tp`,
        orderId: input.orderId,
        actionId: input.actionId,
        level: "tp",
        price: input.tp,
        side: input.side,
        title: "TP",
        detail: input.tp.toFixed(1),
        pnlText: formatPnl(pnlValue),
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
    pushBracketControls({
      actionId,
      orderId: order.id,
      side: order.side,
      volumeLots: order.volumeLots,
      entry,
      sl: order.slGc,
      tp: order.tpGc,
      pnlValue: brokerPosition?.profit ?? estimateOrderPnl(order, currentPrice, symbol),
      canClose:
        hasBrokerPosition &&
        (order.status === "filled" || order.status === "sync_error"),
      canCancel:
        !hasBrokerPosition &&
        order.status !== "filled" &&
        order.status !== "sync_error",
      closing: closingIds.has(order.id),
      cancelling: cancellingIds.has(order.id),
    });
  }

  const appPositionTickets = appBrokerPositionTickets(orders);
  for (const position of mt5OpenTrades.positions) {
    if (appPositionTickets.has(position.brokerPositionTicket)) continue;
    const actionId = mt5PositionKey(position.brokerPositionTicket);
    pushBracketControls({
      actionId,
      orderId: actionId,
      side: position.side,
      volumeLots: position.volumeLots,
      entry: position.entryGcEstimate,
      sl: position.slGc,
      tp: position.tpGc,
      pnlValue: position.profit,
      canClose: true,
      closing: closingIds.has(actionId),
    });
  }

  const appOrderTickets = appBrokerOrderTickets(orders);
  for (const pending of mt5OpenTrades.orders) {
    if (appOrderTickets.has(pending.brokerOrderTicket)) continue;
    const actionId = mt5OrderKey(pending.brokerOrderTicket);
    pushBracketControls({
      actionId,
      orderId: actionId,
      side: pending.side,
      volumeLots: pending.volumeLots,
      entry: isFinitePrice(pending.entryGc) ? pending.entryGc : undefined,
      sl: pending.slGc,
      tp: pending.tpGc,
      canCancel: true,
      cancelling: cancellingIds.has(actionId),
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

function TimezoneControl({
  offsetMinutes,
  onChange,
}: {
  offsetMinutes: number;
  onChange: (offsetMinutes: number) => void;
}) {
  const normalizedOffset = normalizeTimezoneOffsetMinutes(offsetMinutes);
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
      {
        offsetMinutes: normalizedOffset,
        label: formatUtcOffset(normalizedOffset),
      },
    ].sort((a, b) => a.offsetMinutes - b.offsetMinutes);
  }, [normalizedOffset]);

  return (
    <label
      className="timezone-control"
      title={`Chart timezone: ${formatUtcOffset(normalizedOffset)}`}
    >
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
    </label>
  );
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

const ANALYST_LABELS: Record<string, string> = {
  no_trade: "KhÃ´ng giao dá»‹ch",
  wait_for_buy: "Chá» mua",
  wait_for_sell: "Chá» bÃ¡n",
  buy_candidate: "á»¨ng viÃªn mua",
  sell_candidate: "á»¨ng viÃªn bÃ¡n",
  bullish: "ThiÃªn mua",
  bearish: "ThiÃªn bÃ¡n",
  range: "Äi ngang",
  unknown: "ChÆ°a rÃµ",
  wait: "Chá»",
  candidate: "CÃ³ setup",
};

function analystLabel(value: string): string {
  return ANALYST_LABELS[value] ?? value.replace(/_/g, " ");
}

function formatAnalystTimestamp(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return "";
  }
}

function formatAnalystConfidence(confidence: number): string {
  return `${Math.round(Math.max(0, Math.min(1, confidence)) * 100)}%`;
}

function analystEventAiLabel(state: AnalystEventAiState | undefined): string {
  if (!state) return "Not loaded";
  if (!state.available || !state.llmEnabled) return "Not configured";
  return state.enabled ? "On" : "Off";
}

function AnalystPanel({
  open,
  pending,
  report,
  error,
  eventAi,
  eventAiPending,
  authenticated,
  onRun,
  onToggleEventAi,
  onClose,
}: {
  open: boolean;
  pending: boolean;
  report?: AnalystReport;
  error: string;
  eventAi?: AnalystEventAiState;
  eventAiPending: boolean;
  authenticated: boolean;
  onRun: () => void;
  onToggleEventAi: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="analyst-panel" role="dialog" aria-label="BÃ¡o cÃ¡o AI nháº­n Ä‘á»‹nh">
      <div className="analyst-panel-header">
        <div>
          <div className="analyst-panel-title">AI nháº­n Ä‘á»‹nh</div>
          {report && (
            <div className="analyst-panel-time">
              {formatAnalystTimestamp(report.createdAt)}
            </div>
          )}
        </div>
        <div className="analyst-panel-actions">
          <button type="button" onClick={onRun} disabled={pending || !authenticated}>
            {pending ? "Äang cháº¡y" : "Kiá»ƒm tra"}
          </button>
          <button type="button" aria-label="ÄÃ³ng AI nháº­n Ä‘á»‹nh" onClick={onClose}>
            x
          </button>
        </div>
      </div>
      {error && <div className="analyst-panel-error">{error}</div>}
      {authenticated && (
      <div className="analyst-auto-send-control">
        <div>
          <span>Event scanner LLM</span>
          <strong>{analystEventAiLabel(eventAi)}</strong>
        </div>
        <button
          type="button"
          disabled={eventAiPending || !eventAi?.available || !eventAi.llmEnabled}
          onClick={onToggleEventAi}
        >
          {eventAiPending ? "Saving" : eventAi?.enabled ? "Off" : "On"}
        </button>
      </div>
      )}
      {pending && <div className="analyst-panel-muted">Äang Ä‘á»c tráº¡ng thÃ¡i thá»‹ trÆ°á»ng...</div>}
      {!report && !pending ? (
        <div className="analyst-panel-muted">ChÆ°a cÃ³ nháº­n Ä‘á»‹nh AI.</div>
      ) : null}
      {report && (
        <div className="analyst-report">
          <div className="analyst-report-grid">
            <div>
              <span>Quyáº¿t Ä‘á»‹nh</span>
              <strong>{analystLabel(report.decision)}</strong>
            </div>
            <div>
              <span>Xu hÆ°á»›ng</span>
              <strong>{analystLabel(report.bias)}</strong>
            </div>
            <div>
              <span>Äá»™ tin cáº­y</span>
              <strong>{formatAnalystConfidence(report.confidence)}</strong>
            </div>
            <div>
              <span>Rá»§i ro</span>
              <strong>{analystLabel(report.riskState)}</strong>
            </div>
          </div>
          <ul className="analyst-reasons">
            {report.reason.map((reason, index) => (
              <li key={`${report.reportId}:${index}`}>{reason}</li>
            ))}
          </ul>
          <div className="analyst-condition">
            <span>VÃ´ hiá»‡u náº¿u</span>
            <p>{report.invalidIf}</p>
          </div>
          <div className="analyst-condition">
            <span>XÃ¡c nháº­n tiáº¿p theo</span>
            <p>{report.nextConfirmation}</p>
          </div>
          <div className="analyst-auto-trade">Auto-trade Ä‘ang táº¯t</div>
        </div>
      )}
    </div>
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
  return timeframe === "1m";
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
 *   - status events drive the StatusIndicator; alert_event drives the AlertPanel.
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
  const contract = CHART_CONTRACT;
  const [connection, setConnection] = useState<ConnectionState>("disconnected");
  const disconnectStatusTimerRef = useRef<number | undefined>(undefined);
  const degradedStatusTimerRef = useRef<number | undefined>(undefined);
  const [socketGeneration, setSocketGeneration] = useState(0);
  const [overlayRefreshNonce, setOverlayRefreshNonce] = useState(0);
  const [bars, setBars] = useState<readonly Bar[]>([]);
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
  const [loadedOverlayContract, setLoadedOverlayContract] = useState<
    string | undefined
  >(undefined);
  const [bigTrades, setBigTrades] = useState<readonly BigTradeMarker[]>([]);
  const [smcAiSignals, setSmcAiSignals] = useState<readonly SmcAiSignalMarker[]>([]);
  const [alertSignalMarkers, setAlertSignalMarkers] = useState<
    readonly AlertSignalMarker[]
  >([]);
  const [showVolume, setShowVolume] = useState(true);
  const [showDailyVolumeProfile, setShowDailyVolumeProfile] = useState(false);
  const [dailyVolumeProfileWidth, setDailyVolumeProfileWidth] = useState(
    DEFAULT_SESSION_VOLUME_PROFILE_WIDTH_PX,
  );
  const [
    showDailyVolumeProfileDevelopingPoc,
    setShowDailyVolumeProfileDevelopingPoc,
  ] = useState(true);
  const [sessionVolumeProfile, setSessionVolumeProfile] =
    useState<DeltaProfileData | null>(null);
  const [showVolumeDelta, setShowVolumeDelta] = useState(true);
  const [showMgannSwing, setShowMgannSwing] = useState(false);
  const [mgannSwing, setMgannSwing] = useState<MgannSwingSettings>(() => ({
    ...DEFAULT_MGANN_SWING_SETTINGS,
  }));
  const mgannSwingDisabled = timeframe === "1m";
  const showMgannSwingForTimeframe = showMgannSwing && !mgannSwingDisabled;
  const showMgannWaveDelta =
    showMgannSwingForTimeframe && mgannSwing.showWaveDelta;
  const [showFootprint, setShowFootprint] = useState(false);
  const [showFvgGrader, setShowFvgGrader] = useState(true);
  const [fvgSignalLimit, setFvgSignalLimit] = useState(DEFAULT_FVG_SIGNAL_LIMIT);
  const [showBigTrades, setShowBigTrades] = useState(true);
  const [ema, setEma] = useState<EmaSettings>(() => ({ ...DEFAULT_EMA_SETTINGS }));
  const [smc, setSmc] = useState<SmcSettings>(() => ({ ...DEFAULT_SMC_SETTINGS }));
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
  const [lastAlert, setLastAlert] = useState<AlertEventMessage | undefined>(undefined);
  const [alertPanelOpen, setAlertPanelOpen] = useState(false);
  const [analystPanelOpen, setAnalystPanelOpen] = useState(false);
  const [analystReport, setAnalystReport] = useState<AnalystReport | undefined>(
    undefined,
  );
  const [analystEventAi, setAnalystEventAi] = useState<
    AnalystEventAiState | undefined
  >(undefined);
  const [analystPending, setAnalystPending] = useState(false);
  const [analystEventAiPending, setAnalystEventAiPending] = useState(false);
  const [analystError, setAnalystError] = useState("");
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
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthDialogMode>("login");
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState("");
  const [mt5Account, setMt5Account] = useState<Mt5Account | undefined>(undefined);
  const [mt5Symbol, setMt5Symbol] = useState<Mt5Symbol | undefined>(undefined);
  const [mt5DialogOpen, setMt5DialogOpen] = useState(false);
  const [mt5Terminals, setMt5Terminals] = useState<Mt5Terminal[]>([]);
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
  const [latestPrice, setLatestPrice] = useState<number | undefined>(undefined);
  const [marketOrderSettings, setMarketOrderSettings] =
    useState<MarketOrderSettings>(() => readMarketOrderSettings());
  const [orderPending, setOrderPending] = useState(false);
  const [orderError, setOrderError] = useState("");
  // TradingView-style chart context menu, anchored at the click point.
  const [chartMenu, setChartMenu] = useState<ChartMenuState | undefined>(
    undefined,
  );
  const [activeTool, setActiveTool] = useState<DrawingToolType | null>(null);
  const fixedRangeProfileMode: FixedRangeProfileMode = "volume";
  const [chartFocusMode, setChartFocusMode] = useState(false);
  const [marketOrderDrawerOpen, setMarketOrderDrawerOpen] = useState(false);
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

  const publishLatestPrice = useCallback((price: number) => {
    latestPricePendingRef.current = price;
    if (latestPriceThrottleRef.current !== undefined) return;

    const flush = () => {
      const pending = latestPricePendingRef.current;
      latestPricePendingRef.current = undefined;
      if (pending !== undefined) {
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
      timeframe,
      chartBackgroundColor,
      showVolume,
      showVolumeDelta,
      showDailyVolumeProfile,
      dailyVolumeProfileWidth,
      showDailyVolumeProfileDevelopingPoc,
      showCvd: showMgannWaveDelta,
      showMgannSwing,
      mgannSwing: { ...mgannSwing },
      showFootprint,
      showFvgGrader,
      fvgSignalLimit,
      showBigTrades,
      ema: { ...ema },
      smc: { ...smc },
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
      drawings,
      ema,
      footprintSettings,
      fvgSignalLimit,
      fixedRangeProfileMode,
      marketOrderSettings,
      mgannSwing,
      outsideBar,
      showBigTrades,
      showFootprint,
      fvgSignalLimit,
      showMgannSwing,
      showVolume,
      showVolumeDelta,
      showDailyVolumeProfile,
      showDailyVolumeProfileDevelopingPoc,
      showMgannWaveDelta,
      showFvgGrader,
      smc,
      timeframe,
      timezoneOffsetMinutes,
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
    setMarketOrderDrawerOpen(false);
  }, []);

  const historyLoader = useRef<HistoryLoader | null>(null);
  const screenshotCaptureRef = useRef<(() => string | undefined) | undefined>(
    undefined,
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
  const firstLoadedBarTime = hasLoadedCurrentSeries ? bars[0]?.time : undefined;
  const latestLoadedBarTime = hasLoadedCurrentSeries
    ? bars[bars.length - 1]?.time
    : undefined;
  const latestExtendRightBarTime =
    extendRightLiveBar?.seriesKey === currentSeriesKey
      ? Math.max(latestLoadedBarTime ?? 0, extendRightLiveBar.time)
      : latestLoadedBarTime;

  const applyMt5Status = useCallback(
    (status: Awaited<ReturnType<ApiClient["mt5Status"]>>) => {
      const account = status.account;
      if (status.connected && account) {
        setMt5Account((current) =>
          mt5AccountsEqual(current, account) ? current : account,
        );
        return;
      }
      setMt5Account(undefined);
      setMt5Symbol(undefined);
      setOrders([]);
      setMt5OpenTrades(EMPTY_MT5_OPEN_TRADES);
      if (status.error) {
        setOrderError(status.error);
      }
    },
    [],
  );

  const refreshTradingState = useCallback(async () => {
    const [ordersResult, openTradesResult, statusResult] = await Promise.allSettled([
      api.orders(true),
      api.mt5OpenTrades(),
      api.mt5Status(),
    ]);
    if (ordersResult.status === "fulfilled") {
      setOrders(ordersResult.value);
    }
    if (openTradesResult.status === "fulfilled") {
      setMt5OpenTrades(openTradesResult.value);
    }
    if (statusResult.status === "fulfilled") {
      applyMt5Status(statusResult.value);
    }
  }, [api, applyMt5Status]);

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
    (bar: Bar) => {
      cache.append({ symbol: SYMBOL, contract, timeframe }, [bar]);
      setExtendRightLiveBar({ seriesKey: currentSeriesKey, time: bar.time });
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

    void (async () => {
      try {
        const response = await fetch(
          buildHistoryUrl(
            {
              ...requestKey,
              to,
              limit: HISTORY_BACKFILL_LIMIT,
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
        if (fetchedBars.length < HISTORY_BACKFILL_LIMIT) {
          state.exhaustedBefore = fetchedBars[0].time;
        }
        const nextSeries = cache.get(requestKey)?.bars ?? [];
        setLoadedSeriesKey(requestedSeriesKey);
        setBars(nextSeries);
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

  // Fetch delta profile for the current daily session (right-edge histogram).
  useEffect(() => {
    if (!showDailyVolumeProfile) {
      setSessionVolumeProfile(null);
      return;
    }
    const now = Date.now();
    const d = new Date(now);
    const hour = d.getUTCHours();
    const sessionStart = new Date(Date.UTC(
      d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
      SESSION_VP_START_UTC_HOUR, 0, 0, 0,
    ));
    if (hour < SESSION_VP_START_UTC_HOUR) {
      sessionStart.setUTCDate(sessionStart.getUTCDate() - 1);
    }
    const fromMs = sessionStart.getTime();
    let cancelled = false;
    const fetchProfile = () => {
      void api
        .deltaProfile({
          symbol: SYMBOL,
          contract,
          from: fromMs,
          to: Date.now(),
          rowTicks: DELTA_PROFILE_ROW_TICKS,
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
  }, [api, contract, showDailyVolumeProfile]);

  useEffect(() => {
    let cancelled = false;
    const loadLatest = () => {
      void api
        .analystLatest(SYMBOL, contract)
        .then((report) => {
          if (!cancelled) setAnalystReport(report ?? undefined);
        })
        .catch(() => {
          if (!cancelled) setAnalystReport(undefined);
        });
    };
    loadLatest();
    const shouldPoll = analystPanelOpen || analystEventAi?.enabled === true;
    const timer = shouldPoll ? window.setInterval(loadLatest, 10_000) : undefined;
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [api, contract, analystEventAi?.enabled, analystPanelOpen]);

  useEffect(() => {
    if (!authUser || !profileHydrated) {
      setAnalystEventAi(undefined);
      return;
    }
    let cancelled = false;
    void api
      .analystEventAi(profileId)
      .then((state) => {
        if (!cancelled) setAnalystEventAi(state);
      })
      .catch(() => {
        if (!cancelled) setAnalystEventAi(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [api, authUser, profileHydrated, profileId]);

  // Connect the socket once and keep it for the component's lifetime. Status
  // + alert handlers are attached here; subscription management lives in its
  // own effect below so status churn never tears down the connection.
  useEffect(() => {
    const clearDisconnectStatusTimer = () => {
      if (disconnectStatusTimerRef.current === undefined) return;
      window.clearTimeout(disconnectStatusTimerRef.current);
      disconnectStatusTimerRef.current = undefined;
    };
    const clearDegradedStatusTimer = () => {
      if (degradedStatusTimerRef.current === undefined) return;
      window.clearTimeout(degradedStatusTimerRef.current);
      degradedStatusTimerRef.current = undefined;
    };
    const markConnected = () => {
      clearDisconnectStatusTimer();
      clearDegradedStatusTimer();
      setConnection("connected");
    };
    const reconnect = () => {
      socket.ensureConnected(SOCKET_IDLE_TIMEOUT_MS, SOCKET_TRANSITION_TIMEOUT_MS);
    };
    const offOpen = socket.onOpen(() => {
      markConnected();
      // Re-fetch REST history after reconnect so bars missed while the socket
      // was unavailable are patched without requiring a browser reload. Overlay
      // events can be missed the same way, so refresh them from REST too.
      setSocketGeneration((generation) => generation + 1);
      setOverlayRefreshNonce((generation) => generation + 1);
    });
    const offClose = socket.onClose(() => {
      clearDisconnectStatusTimer();
      clearDegradedStatusTimer();
      disconnectStatusTimerRef.current = window.setTimeout(() => {
        disconnectStatusTimerRef.current = undefined;
        setConnection("disconnected");
      }, DISCONNECT_STATUS_DEBOUNCE_MS);
    });
    socket.connect();
    const reconnectTimer = window.setInterval(reconnect, 5000);
    const offStatus = socket.on("status", (msg) => {
      if (msg.state === "connected") {
        markConnected();
        return;
      }
      if (msg.state === "degraded") {
        clearDisconnectStatusTimer();
        clearDegradedStatusTimer();
        setConnection("degraded");
        degradedStatusTimerRef.current = window.setTimeout(() => {
          degradedStatusTimerRef.current = undefined;
          if (socket.isOpen) {
            setConnection("connected");
          }
        }, DEGRADED_STATUS_TTL_MS);
        return;
      }
      clearDisconnectStatusTimer();
      clearDegradedStatusTimer();
      setConnection("disconnected");
    });
    const offAlert = socket.on("alert_event", (msg) => {
      if ((msg.profileId ?? DEFAULT_PROFILE_ID) === profileIdRef.current) {
        setAlerts((prev) =>
          prev.map((alert) =>
            alert.id === msg.alertId && alert.params.repeat !== true
              ? { ...alert, enabled: false }
              : alert,
          ),
        );
        setLastAlert(msg);
        const marker = alertEventToSignalMarker(msg);
        if (marker !== undefined) {
          setAlertSignalMarkers((prev) => mergeAlertSignalMarker(prev, marker));
        }
      }
    });
    const offOrder = socket.on("order_update", (msg) => {
      setOrders((prev) => {
        const without = prev.filter((order) => order.id !== msg.order.id);
        return isOpenTradingOrder(msg.order) ? [msg.order, ...without] : without;
      });
    });
    const offAccount = socket.on("account_update", (msg) => {
      if (msg.symbol !== SYMBOL) return;
      setMt5Account((current) => mergeMt5AccountUpdate(current, msg.account));
      setMt5OpenTrades((current) =>
        mergeMt5OpenTradeProfitUpdates(current, msg.positions),
      );
    });
    return () => {
      window.clearInterval(reconnectTimer);
      clearDisconnectStatusTimer();
      clearDegradedStatusTimer();
      offOpen();
      offClose();
      offStatus();
      offAlert();
      offOrder();
      offAccount();
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

  // Keep always-needed global events subscribed once; BigTrade is subscribed
  // separately only on 1m because rendering those markers is expensive.
  useEffect(() => {
    socket.subscribe(SYMBOL, GLOBAL_SUBSCRIBED_EVENTS);
    if (ENABLE_REALTIME_FOOTPRINT_UPDATES) {
      socket.subscribe(SYMBOL, FOOTPRINT_SUBSCRIBED_EVENTS, "1m");
    }
    return () => {
      socket.unsubscribe(SYMBOL, GLOBAL_SUBSCRIBED_EVENTS);
      if (ENABLE_REALTIME_FOOTPRINT_UPDATES) {
        socket.unsubscribe(SYMBOL, FOOTPRINT_SUBSCRIBED_EVENTS, "1m");
      }
    };
  }, [socket]);

  useEffect(() => {
    if (!bigTradesEnabledForTimeframe(timeframe)) {
      return;
    }
    socket.subscribe(SYMBOL, BIG_TRADE_SUBSCRIBED_EVENTS);
    return () => {
      socket.unsubscribe(SYMBOL, BIG_TRADE_SUBSCRIBED_EVENTS);
    };
  }, [socket, timeframe]);

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
    socket.subscribe(SYMBOL, TIMEFRAME_SUBSCRIBED_EVENTS, timeframe);
    let cancelled = false;
    let deltaTimer: number | undefined;
    void (async () => {
      try {
        const history = await historyLoader.current!.load({
          symbol: SYMBOL,
          contract,
          timeframe,
          limit: INITIAL_HISTORY_LIMIT,
        });
        if (!cancelled) {
          setLoadedSeriesKey(requestedSeriesKey);
          setBars(history.bars);
          setLatestPrice(history.bars[history.bars.length - 1]?.close);
          setSmcAiSignals([]);
          deltaTimer = window.setTimeout(() => {
            void (async () => {
              try {
                const delta = await api.volumeDelta(
                  SYMBOL,
                  contract,
                  timeframe,
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
      socket.unsubscribe(SYMBOL, TIMEFRAME_SUBSCRIBED_EVENTS, timeframe);
    };
  }, [api, socket, contract, timeframe, socketGeneration, profileHydrated]);

  useEffect(() => {
    const hasEnabledMgannSweepAlert = alerts.some(
      (alert) =>
        alert.symbol === SYMBOL &&
        MGANN_SWEEP_ALERT_TYPES.has(alert.type) &&
        alert.enabled,
    );
    if (
      !authUser ||
      !profileHydrated ||
      !hasLoadedCurrentSeries ||
      timeframe !== "1m" ||
      firstLoadedBarTime === undefined ||
      latestLoadedBarTime === undefined ||
      !hasEnabledMgannSweepAlert
    ) {
      setAlertSignalMarkers((prev) =>
        prev.some((marker) => marker.id.includes(":hist:"))
          ? prev.filter((marker) => !marker.id.includes(":hist:"))
          : prev,
      );
      return;
    }

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
              latestLoadedBarTime - HISTORICAL_ALERT_SIGNAL_BAR_LIMIT * 60_000,
            ),
            to: latestLoadedBarTime,
            limit: 500,
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
    alerts,
    authUser,
    contract,
    firstLoadedBarTime,
    hasLoadedCurrentSeries,
    latestLoadedBarTime,
    profileHydrated,
    profileId,
    timeframe,
  ]);

  useEffect(() => {
    setLoadedOverlayContract(undefined);
    setFootprintBars(new Map());
    setFvgSignals(new Map());
    setFvgSignalSeriesKey(undefined);
    setBigTrades([]);
    setSmcAiSignals([]);
  }, [contract]);

  useEffect(() => {
    if (!bigTradesEnabledForTimeframe(timeframe)) {
      setLoadedOverlayContract(undefined);
      setBigTrades((prev) => (prev.length === 0 ? prev : []));
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
          footprint = await api.footprint(SYMBOL, contract);
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
  }, [api, contract, timeframe, hasLoadedCurrentSeries, loadedOverlayContract]);

  useEffect(() => {
    if (!bigTradesEnabledForTimeframe(timeframe)) {
      return;
    }
    if (!hasLoadedCurrentSeries) {
      return;
    }
    if (!showBigTrades) {
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
          setBigTrades((prev) => reduceBigTrades(prev, loadedBigTrades));
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
    showBigTrades,
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
    const matchesChartContract = (messageContract: string) =>
      contract === SYMBOL || messageContract === contract;
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
    const offFootprint = ENABLE_REALTIME_FOOTPRINT_UPDATES
      ? socket.on("footprint_update", (msg) => {
          if (
            msg.symbol !== SYMBOL ||
            !matchesChartContract(msg.contract) ||
            msg.tf !== "1m"
          ) {
            return;
          }
          setFootprintBars((prev) => mergeFootprint(prev, msg));
          if (
            fixedRangeDeltaProfileDrawings(drawingsRef.current).some((drawing) =>
              footprintTouchesFixedRange(msg.time, drawing, timeframe),
            )
          ) {
            scheduleDeltaProfileRefresh();
          }
        })
      : () => {};
    const offBigTrade = socket.on("big_trade", (msg) => {
      if (
        !bigTradesEnabledForTimeframe(timeframe) ||
        msg.symbol !== SYMBOL ||
        !matchesChartContract(msg.contract)
      ) {
        return;
      }
      setBigTrades((prev) => applyBigTrade(prev, msg).markers);
      // Play sound if enabled and volume meets session threshold
      const bts = bigTradeSettingsRef.current;
      if (
        bts.soundEnabled &&
        msg.volume >= bigTradeMinVolumeForTime(msg.time, bts)
      ) {
        playBigTradeSound();
      }
    });
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
    return () => {
      offBarPrice();
      offQuotePrice();
      offFootprint();
      offBigTrade();
      offFvgSignal();
      if (latestPriceThrottleRef.current !== undefined) {
        window.clearTimeout(latestPriceThrottleRef.current);
        latestPriceThrottleRef.current = undefined;
      }
      latestPricePendingRef.current = undefined;
    };
  }, [socket, contract, timeframe, scheduleDeltaProfileRefresh, publishLatestPrice]);

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
  const onToggleAnalystPanel = () => {
    if (!authUser) {
      onTradingLogin();
      return;
    }
    setAnalystPanelOpen((open) => {
      const next = !open;
      if (next) setAlertPanelOpen(false);
      return next;
    });
  };
  const onRunAnalyst = () => {
    if (!authUser) {
      onTradingLogin();
      return;
    }
    if (analystPending) return;
    setAnalystPanelOpen(true);
    setAlertPanelOpen(false);
    setAnalystPending(true);
    setAnalystError("");
    void (async () => {
      try {
        const result = await api.runAnalyst(SYMBOL, contract, profileId);
        if (result.report) {
          setAnalystReport(result.report);
        }
        if (result.error) {
          setAnalystError(result.error);
        } else if (!result.report) {
          setAnalystError(
            result.llmEnabled
              ? "LLM khÃ´ng tráº£ vá» nháº­n Ä‘á»‹nh."
              : "LLM Ä‘ang táº¯t.",
          );
        }
      } catch (error) {
        setAnalystError(
          error instanceof Error ? error.message : "KhÃ´ng gá»i Ä‘Æ°á»£c AI nháº­n Ä‘á»‹nh.",
        );
      } finally {
        setAnalystPending(false);
      }
    })();
  };
  const onToggleAnalystEventAi = () => {
    if (!authUser) {
      onTradingLogin();
      return;
    }
    if (
      analystEventAiPending ||
      !analystEventAi?.available ||
      !analystEventAi.llmEnabled
    ) {
      return;
    }
    const nextEnabled = !analystEventAi.enabled;
    setAnalystEventAiPending(true);
    setAnalystError("");
    void (async () => {
      try {
        const next = await api.setAnalystEventAi(nextEnabled, profileId);
        setAnalystEventAi(next);
      } catch (error) {
        setAnalystError(
          error instanceof Error
            ? error.message
            : "KhÃ´ng Ä‘á»•i Ä‘Æ°á»£c cháº¿ Ä‘á»™ tá»± gá»­i AI.",
        );
      } finally {
        setAnalystEventAiPending(false);
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
    void api.mt5Terminals().then(setMt5Terminals);
  };
  const onLogout = () => {
    void (async () => {
      try {
        await api.logout();
      } catch {
        /* Local state still clears if the session was already gone. */
      } finally {
        setAuthUser(undefined);
        setMt5Account(undefined);
        setMt5Symbol(undefined);
        setOrders([]);
        setMt5OpenTrades(EMPTY_MT5_OPEN_TRADES);
        setAlerts([]);
        setLastAlert(undefined);
        setAnalystEventAi(undefined);
        setAnalystPanelOpen(false);
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
        setProfileHydrated(true);
      }
    })();
  };
  const onMarketOrder = (side: "buy" | "sell") => {
    const marketGcReference =
      latestPrice ?? (hasLoadedCurrentSeries ? bars[bars.length - 1]?.close : undefined);
    setOrderPending(true);
    setOrderError("");
    void (async () => {
      try {
        const order = await api.createOrder({
          source: "market_bar",
          side,
          kind: "market",
          volumeLots: marketOrderSettings.volumeLots,
          ...(marketGcReference !== undefined
            ? { referenceGc: roundGcPrice(marketGcReference) }
            : {}),
          slDistanceGc: marketOrderSettings.slDistanceGc,
          tpDistanceGc: marketOrderSettings.tpDistanceGc,
          gcAnchored: true,
          idempotencyKey: newIdempotencyKey(),
        });
        setOrders((prev) => {
          const without = prev.filter((item) => item.id !== order.id);
          return isOpenTradingOrder(order) ? [order, ...without] : without;
        });
        setOrderError(rejectedOrderMessage(order));
        await refreshTradingState();
      } catch (error) {
        setOrderError(error instanceof Error ? error.message : "Order failed");
      } finally {
        setOrderPending(false);
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
      setOrderError("Connect MT5 before placing chart orders.");
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
          volumeLots: marketOrderSettings.volumeLots,
          entryGc,
          referenceGc: roundGcPrice(referencePrice),
          slGc,
          tpGc,
          gcAnchored: true,
          idempotencyKey: newIdempotencyKey(),
        });
        setOrders((prev) => {
          const without = prev.filter((item) => item.id !== order.id);
          return isOpenTradingOrder(order) ? [order, ...without] : without;
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

  const onDrawingsStateChange = (state: DrawingState[]) => {
    setDrawings((previous) => mergeVisibleDrawingState(previous, state, timeframe));
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

  const onOrderDragCommit = (id: string, price: number) => {
    const parsed = parseOrderLineId(id);
    if (!parsed) return;
    if (parsed.orderId.startsWith("mt5pos:")) {
      const ticket = Number(parsed.orderId.slice("mt5pos:".length));
      if (!Number.isInteger(ticket)) return;
      if (parsed.field === "entryGc") {
        setOrderError("Filled MT5 positions cannot modify entry.");
        return;
      }
      const level = roundGcPrice(price);
      const patch: { slGc?: number; tpGc?: number } = {};
      if (parsed.field === "slGc") patch.slGc = level;
      if (parsed.field === "tpGc") patch.tpGc = level;
      setOrderError("");
      setMt5OpenTrades((prev) => ({
        ...prev,
        positions: prev.positions.map((position) =>
          position.brokerPositionTicket === ticket
            ? { ...position, ...patch }
            : position,
        ),
      }));
      void (async () => {
        try {
          await api.patchMt5Position(ticket, patch);
          setMt5OpenTrades(await api.mt5OpenTrades());
        } catch (error) {
          setOrderError(error instanceof Error ? error.message : "Modify MT5 position failed");
          try {
            setMt5OpenTrades(await api.mt5OpenTrades());
          } catch {
            /* Keep the current state if refresh also fails. */
          }
        }
      })();
      return;
    }
    if (parsed.orderId.startsWith("mt5order:")) {
      const ticket = Number(parsed.orderId.slice("mt5order:".length));
      if (!Number.isInteger(ticket)) return;
      const level = roundGcPrice(price);
      const patch: { entryGc?: number; slGc?: number; tpGc?: number } = {};
      patch[parsed.field] = level;
      setOrderError("");
      setMt5OpenTrades((prev) => ({
        ...prev,
        orders: prev.orders.map((order) =>
          order.brokerOrderTicket === ticket ? { ...order, ...patch } : order,
        ),
      }));
      void (async () => {
        try {
          await api.patchMt5Order(ticket, patch);
          setMt5OpenTrades(await api.mt5OpenTrades());
        } catch (error) {
          setOrderError(error instanceof Error ? error.message : "Modify MT5 order failed");
          try {
            setMt5OpenTrades(await api.mt5OpenTrades());
          } catch {
            /* Keep the current state if refresh also fails. */
          }
        }
      })();
      return;
    }
    const order = orders.find((item) => item.id === parsed.orderId);
    if (!order) return;
    if (parsed.field === "entryGc" && order.status === "filled") {
      setOrderError("Filled positions cannot modify entry.");
      return;
    }
    const level = roundGcPrice(price);
    const patch: Parameters<ApiClient["patchOrder"]>[1] = {};
    patch[parsed.field] = level;
    setOrderError("");
    setOrders((prev) =>
      prev.map((item) =>
        item.id === parsed.orderId ? { ...item, [parsed.field]: level } : item,
      ),
    );
    void (async () => {
      try {
        const updated = await api.patchOrder(parsed.orderId, patch);
        setOrders((prev) => {
          const without = prev.filter((item) => item.id !== updated.id);
          return isOpenTradingOrder(updated) ? [updated, ...without] : without;
        });
      } catch (error) {
        setOrderError(error instanceof Error ? error.message : "Modify order failed");
        try {
          setOrders(await api.orders(true));
        } catch {
          /* Keep the optimistic state if refresh also fails. */
        }
      }
    })();
  };

  const onOrderDragBatchCommit = (
    updates: readonly { id: string; price: number }[],
  ) => {
    const parsedUpdates = updates.flatMap((update) => {
      const parsed = parseOrderLineId(update.id);
      return parsed
        ? [{ ...parsed, id: update.id, price: roundGcPrice(update.price) }]
        : [];
    });
    if (parsedUpdates.length === 0) return;
    if (parsedUpdates.length === 1) {
      const update = parsedUpdates[0];
      onOrderDragCommit(update.id, update.price);
      return;
    }
    const byOrderId = new Map<string, typeof parsedUpdates>();
    for (const update of parsedUpdates) {
      byOrderId.set(update.orderId, [
        ...(byOrderId.get(update.orderId) ?? []),
        update,
      ]);
    }
    for (const [orderId, group] of byOrderId) {
      if (group.length === 1) {
        const update = group[0];
        onOrderDragCommit(update.id, update.price);
        continue;
      }
      if (orderId.startsWith("mt5pos:")) {
        const ticket = Number(orderId.slice("mt5pos:".length));
        if (!Number.isInteger(ticket)) continue;
        const patch: { slGc?: number; tpGc?: number } = {};
        for (const update of group) {
          if (update.field === "slGc") patch.slGc = update.price;
          if (update.field === "tpGc") patch.tpGc = update.price;
        }
        if (patch.slGc === undefined && patch.tpGc === undefined) continue;
        setOrderError("");
        setMt5OpenTrades((prev) => ({
          ...prev,
          positions: prev.positions.map((position) =>
            position.brokerPositionTicket === ticket
              ? { ...position, ...patch }
              : position,
          ),
        }));
        void (async () => {
          try {
            await api.patchMt5Position(ticket, patch);
            setMt5OpenTrades(await api.mt5OpenTrades());
          } catch (error) {
            setOrderError(error instanceof Error ? error.message : "Modify MT5 position failed");
            try {
              setMt5OpenTrades(await api.mt5OpenTrades());
            } catch {
              /* Keep the optimistic state if refresh also fails. */
            }
          }
        })();
        continue;
      }
      if (orderId.startsWith("mt5order:")) {
        const ticket = Number(orderId.slice("mt5order:".length));
        if (!Number.isInteger(ticket)) continue;
        const patch: { entryGc?: number; slGc?: number; tpGc?: number } = {};
        for (const update of group) {
          patch[update.field] = update.price;
        }
        setOrderError("");
        setMt5OpenTrades((prev) => ({
          ...prev,
          orders: prev.orders.map((order) =>
            order.brokerOrderTicket === ticket ? { ...order, ...patch } : order,
          ),
        }));
        void (async () => {
          try {
            await api.patchMt5Order(ticket, patch);
            setMt5OpenTrades(await api.mt5OpenTrades());
          } catch (error) {
            setOrderError(error instanceof Error ? error.message : "Modify MT5 order failed");
            try {
              setMt5OpenTrades(await api.mt5OpenTrades());
            } catch {
              /* Keep the optimistic state if refresh also fails. */
            }
          }
        })();
        continue;
      }
      const order = orders.find((item) => item.id === orderId);
      if (!order) continue;
      const patch: Parameters<ApiClient["patchOrder"]>[1] = {};
      for (const update of group) {
        if (update.field === "entryGc" && order.status === "filled") continue;
        patch[update.field] = update.price;
      }
      if (
        patch.entryGc === undefined &&
        patch.slGc === undefined &&
        patch.tpGc === undefined
      ) {
        continue;
      }
      setOrderError("");
      setOrders((prev) =>
        prev.map((item) =>
          item.id === orderId ? { ...item, ...patch } : item,
        ),
      );
      void (async () => {
        try {
          const updated = await api.patchOrder(orderId, patch);
          setOrders((prev) => {
            const without = prev.filter((item) => item.id !== updated.id);
            return isOpenTradingOrder(updated) ? [updated, ...without] : without;
          });
        } catch (error) {
          setOrderError(error instanceof Error ? error.message : "Modify order failed");
          try {
            setOrders(await api.orders(true));
          } catch {
            /* Keep the optimistic state if refresh also fails. */
          }
        }
      })();
    }
  };

  const onCloseOrder = (orderId: string) => {
    if (closingOrderIds.has(orderId)) return;
    setOrderError("");
    setClosingOrderIds((prev) => new Set(prev).add(orderId));
    void (async () => {
      try {
        const closed = await api.closeOrder(orderId);
        setOrders((prev) => {
          const without = prev.filter((item) => item.id !== closed.id);
          return isOpenTradingOrder(closed) ? [closed, ...without] : without;
        });
        await refreshTradingState();
      } catch (error) {
        setOrderError(error instanceof Error ? error.message : "Close order failed");
        try {
          await refreshTradingState();
        } catch {
          /* Keep the current state if refresh also fails. */
        }
      } finally {
        setClosingOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });
      }
    })();
  };

  const onCancelOrder = (orderId: string) => {
    if (cancellingOrderIds.has(orderId)) return;
    setOrderError("");
    setCancellingOrderIds((prev) => new Set(prev).add(orderId));
    void (async () => {
      try {
        const cancelled = await api.cancelOrder(orderId);
        setOrders((prev) => {
          const without = prev.filter((item) => item.id !== cancelled.id);
          return isOpenTradingOrder(cancelled) ? [cancelled, ...without] : without;
        });
        await refreshTradingState();
      } catch (error) {
        setOrderError(error instanceof Error ? error.message : "Cancel order failed");
        try {
          await refreshTradingState();
        } catch {
          /* Keep the current state if refresh also fails. */
        }
      } finally {
        setCancellingOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(orderId);
          return next;
        });
      }
    })();
  };

  const onOrderRowBreakEven = (rowId: string) => {
    const parsed = parseActionRowId(rowId);
    if (!parsed || breakingEvenOrderIds.has(rowId)) return;
    setOrderError("");
    setBreakingEvenOrderIds((prev) => new Set(prev).add(rowId));
    void (async () => {
      try {
        if (parsed.source === "app") {
          const order = orders.find((item) => item.id === parsed.orderId);
          if (!order) throw new Error("Order not found");
          const entry = orderEntryGc(order);
          if (entry === undefined || order.brokerPositionTicket == null) {
            throw new Error("Break-even is only available for open positions");
          }
          const level = roundGcPrice(entry);
          setOrders((prev) =>
            prev.map((item) =>
              item.id === parsed.orderId ? { ...item, slGc: level } : item,
            ),
          );
          const updated = await api.patchOrder(parsed.orderId, { slGc: level });
          setOrders((prev) => {
            const without = prev.filter((item) => item.id !== updated.id);
            return isOpenTradingOrder(updated) ? [updated, ...without] : without;
          });
          return;
        }
        if (parsed.source === "mt5pos") {
          const position = mt5OpenTrades.positions.find(
            (item) => item.brokerPositionTicket === parsed.ticket,
          );
          const entry = position?.entryGcEstimate;
          if (!position || !isFinitePrice(entry) || position.basisStale === true) {
            throw new Error("Break-even is unavailable for this MT5 position");
          }
          const level = roundGcPrice(entry);
          setMt5OpenTrades((prev) => ({
            ...prev,
            positions: prev.positions.map((item) =>
              item.brokerPositionTicket === parsed.ticket
                ? { ...item, slGc: level }
                : item,
            ),
          }));
          await api.patchMt5Position(parsed.ticket, { slGc: level });
          setMt5OpenTrades(await api.mt5OpenTrades());
          return;
        }
        throw new Error("Break-even is only available for open positions");
      } catch (error) {
        setOrderError(error instanceof Error ? error.message : "Break-even failed");
        try {
          const [ordersResult, openTradesResult] = await Promise.allSettled([
            api.orders(true),
            api.mt5OpenTrades(),
          ]);
          if (ordersResult.status === "fulfilled") {
            setOrders(ordersResult.value);
          }
          if (openTradesResult.status === "fulfilled") {
            setMt5OpenTrades(openTradesResult.value);
          }
        } catch {
          /* Keep the optimistic state if refresh also fails. */
        }
      } finally {
        setBreakingEvenOrderIds((prev) => {
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
    if (parsed.source !== "mt5pos" || closingOrderIds.has(rowId)) return;
    setOrderError("");
    setClosingOrderIds((prev) => new Set(prev).add(rowId));
    void (async () => {
      try {
        await api.closeMt5Position(parsed.ticket);
        await refreshTradingState();
      } catch (error) {
        setOrderError(error instanceof Error ? error.message : "Close MT5 position failed");
        try {
          await refreshTradingState();
        } catch {
          /* Keep the current state if refresh also fails. */
        }
      } finally {
        setClosingOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(rowId);
          return next;
        });
      }
    })();
  };

  const onOrderRowClose50Percent = (rowId: string, volumeLots: number) => {
    const parsed = parseActionRowId(rowId);
    if (!parsed) return;

    const halfVolume = Math.max(0.01, Math.round(volumeLots * 50) / 100);

    if (parsed.source === "app") {
      if (closingOrderIds.has(parsed.orderId)) return;
      setOrderError("");
      setClosingOrderIds((prev) => new Set(prev).add(parsed.orderId));
      void (async () => {
        try {
          const updated = await api.closeOrder(parsed.orderId, halfVolume);
          setOrders((prev) => {
            const without = prev.filter((item) => item.id !== updated.id);
            return isOpenTradingOrder(updated) ? [updated, ...without] : without;
          });
          await refreshTradingState();
        } catch (error) {
          setOrderError(error instanceof Error ? error.message : "Close position failed");
          try {
            await refreshTradingState();
          } catch {
            /* Keep the current state if refresh also fails. */
          }
        } finally {
          setClosingOrderIds((prev) => {
            const next = new Set(prev);
            next.delete(parsed.orderId);
            return next;
          });
        }
      })();
      return;
    }
    if (parsed.source !== "mt5pos" || closingOrderIds.has(rowId)) return;

    setOrderError("");
    setClosingOrderIds((prev) => new Set(prev).add(rowId));
    void (async () => {
      try {
        await api.closeMt5Position(parsed.ticket, halfVolume);
        await refreshTradingState();
      } catch (error) {
        setOrderError(error instanceof Error ? error.message : "Close MT5 position failed");
        try {
          await refreshTradingState();
        } catch {
          /* Keep the current state if refresh also fails. */
        }
      } finally {
        setClosingOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(rowId);
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
    if (parsed.source !== "mt5order" || cancellingOrderIds.has(rowId)) return;
    setOrderError("");
    setCancellingOrderIds((prev) => new Set(prev).add(rowId));
    void (async () => {
      try {
        await api.cancelMt5Order(parsed.ticket);
        await refreshTradingState();
      } catch (error) {
        setOrderError(error instanceof Error ? error.message : "Cancel MT5 order failed");
        try {
          await refreshTradingState();
        } catch {
          /* Keep the current state if refresh also fails. */
        }
      } finally {
        setCancellingOrderIds((prev) => {
          const next = new Set(prev);
          next.delete(rowId);
          return next;
        });
      }
    })();
  };
  const currentChartReferencePrice = () =>
    latestPrice ?? (hasLoadedCurrentSeries ? bars[bars.length - 1]?.close : undefined);

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
      setOrderError("Connect MT5 before placing chart orders.");
      return;
    }
    setOrderPending(true);
    setOrderError("");
    void (async () => {
      try {
        const order = await api.createOrder({
          ...draft,
          idempotencyKey: newIdempotencyKey(),
        });
        setOrders((prev) => {
          const without = prev.filter((item) => item.id !== order.id);
          return isOpenTradingOrder(order) ? [order, ...without] : without;
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
      setTimeframe(payload.timeframe);
    }
    setChartBackgroundColor(normalizeChartBackgroundColor(payload.chartBackgroundColor));
    setShowFootprint(Boolean(payload.showFootprint));
    setShowVolume(payload.showVolume !== false);
    setShowVolumeDelta(payload.showVolumeDelta !== false);
    setShowDailyVolumeProfile(Boolean(payload.showDailyVolumeProfile));
    setDailyVolumeProfileWidth(
      normalizeSessionVolumeProfileWidth(payload.dailyVolumeProfileWidth),
    );
    setShowDailyVolumeProfileDevelopingPoc(
      payload.showDailyVolumeProfileDevelopingPoc !== false,
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
    setFvgSignalLimit(normalizeFvgSignalLimit(payload.fvgSignalLimit));
    setShowBigTrades(payload.showBigTrades !== false);
    setEma(normalizeEmaSettings(payload.ema));
    setSmc({ ...DEFAULT_SMC_SETTINGS, ...(payload.smc ?? {}) });
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

  async function loadAuthenticatedState(
    user: AuthUser,
    options: { openMt5Setup?: boolean } = {},
  ): Promise<void> {
    setAuthUser(user);
    setProfileLoading(true);
    setProfileHydrated(false);
    setOrderError("");

    const [profileResult, statusResult] = await Promise.allSettled([
      api.meProfile(),
      api.mt5Status(),
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
      setProfileId(user.id);
    }

    const connectedAccount =
      statusResult.status === "fulfilled" && statusResult.value.connected
        ? statusResult.value.account ?? undefined
        : undefined;
    setMt5Account(connectedAccount);
    if (statusResult.status === "fulfilled" && !statusResult.value.connected) {
      setOrderError(statusResult.value.error ?? "");
    } else if (connectedAccount) {
      setOrderError("");
    }

    if (connectedAccount) {
      const [symbolResult, orderResult, openTradesResult] = await Promise.allSettled([
        api.mt5Symbol(),
        api.orders(true),
        api.mt5OpenTrades(),
      ]);
      setMt5Symbol(symbolResult.status === "fulfilled" ? symbolResult.value : undefined);
      setOrders(orderResult.status === "fulfilled" ? orderResult.value : []);
      setMt5OpenTrades(
        openTradesResult.status === "fulfilled"
          ? openTradesResult.value
          : EMPTY_MT5_OPEN_TRADES,
      );
    } else {
      setMt5Symbol(undefined);
      setOrders([]);
      setMt5OpenTrades(EMPTY_MT5_OPEN_TRADES);
      if (options.openMt5Setup) {
        setMt5Error("");
        setMt5DialogOpen(true);
        void api.mt5Terminals().then(setMt5Terminals);
      }
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
          await loadAuthenticatedState(user, { openMt5Setup: true });
        } else {
          setAuthUser(undefined);
          setMt5Account(undefined);
          setMt5Symbol(undefined);
          setOrders([]);
          setMt5OpenTrades(EMPTY_MT5_OPEN_TRADES);
          setProfileId(DEFAULT_PROFILE_ID);
          setProfileLoading(false);
          setProfileHydrated(true);
        }
      } catch {
        if (!cancelled) {
          setAuthUser(undefined);
          setProfileLoading(false);
          setProfileHydrated(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    if (!authUser || !mt5Account) return;
    let cancelled = false;
    const refreshOrders = () => {
      void Promise.allSettled([
        api.orders(true),
        api.mt5OpenTrades(),
        api.mt5Status(),
      ]).then(([ordersResult, openTradesResult, statusResult]) => {
        if (cancelled) return;
        if (ordersResult.status === "fulfilled") {
          const next = ordersResult.value;
          setOrders((prev) => {
            if (prev.length !== next.length) return next;
            for (let i = 0; i < prev.length; i++) {
              if (prev[i].id !== next[i].id || prev[i].status !== next[i].status) return next;
            }
            return prev;
          });
        }
        if (openTradesResult.status === "fulfilled") {
          const next = openTradesResult.value;
          setMt5OpenTrades((prev) => {
            if (
              prev.positions.length !== next.positions.length ||
              prev.orders.length !== next.orders.length
            ) return next;
            for (let i = 0; i < prev.positions.length; i++) {
              if (
                prev.positions[i].brokerPositionTicket !== next.positions[i].brokerPositionTicket ||
                prev.positions[i].profit !== next.positions[i].profit
              ) return next;
            }
            return prev;
          });
        }
        if (statusResult.status === "fulfilled") {
          applyMt5Status(statusResult.value);
        }
      });
    };
    const timer = window.setInterval(refreshOrders, ORDER_REFRESH_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshOrders();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [api, applyMt5Status, authUser, mt5Account]);

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
        await loadAuthenticatedState(user, { openMt5Setup: true });
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "Login failed");
      } finally {
        setAuthPending(false);
      }
    })();
  };

  const onSubmitMt5Account = (input: Mt5ConnectInput) => {
    if (!authUser) {
      onTradingLogin();
      return;
    }
    setMt5Pending(true);
    setMt5Error("");
    void (async () => {
      try {
        const account = await api.connectMt5(input);
        setMt5Account(account);
        const [symbolResult, orderResult, openTradesResult] = await Promise.allSettled([
          api.mt5Symbol(),
          api.orders(true),
          api.mt5OpenTrades(),
        ]);
        setMt5Symbol(symbolResult.status === "fulfilled" ? symbolResult.value : undefined);
        setOrders(orderResult.status === "fulfilled" ? orderResult.value : []);
        setMt5OpenTrades(
          openTradesResult.status === "fulfilled"
            ? openTradesResult.value
            : EMPTY_MT5_OPEN_TRADES,
        );
        setOrderError("");
        setMt5DialogOpen(false);
      } catch (error) {
        setMt5Error(error instanceof Error ? error.message : "Account save failed");
      } finally {
        setMt5Pending(false);
      }
    })();
  };

  // Alert level lines drawn on the candle scale (Req 16.5). Recomputed only
  // when the alert set changes.
  const alertLines = useMemo(() => toAlertLines(alerts), [alerts]);
  const orderLines = useMemo(
    () =>
      [
        ...toOrderLines(orders),
        ...manualPositionLines(mt5OpenTrades.positions, orders),
        ...manualPendingOrderLines(mt5OpenTrades.orders, orders),
      ],
    [orders, mt5OpenTrades],
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
      ),
    [
      orders,
      latestPrice,
      mt5Symbol,
      mt5OpenTrades,
      closingOrderIds,
      cancellingOrderIds,
      breakingEvenOrderIds,
    ],
  );
  const orderControls = useMemo(
    () =>
      toOrderControls(
        orders,
        latestPrice,
        mt5Symbol,
        mt5OpenTrades,
        closingOrderIds,
        cancellingOrderIds,
      ),
    [
      orders,
      latestPrice,
      mt5Symbol,
      mt5OpenTrades,
      closingOrderIds,
      cancellingOrderIds,
    ],
  );
  const chartBars = hasLoadedCurrentSeries ? bars : EMPTY_BARS;
  const chartVolumeDelta = hasLoadedCurrentSeries && volumeDeltaSeriesKey === currentSeriesKey
    ? volumeDelta
    : EMPTY_VOLUME_DELTA;
  const chartFootprintBars = hasLoadedCurrentSeries
    ? footprintBars
    : EMPTY_FOOTPRINT_BARS;
  const chartFvgSignals =
    hasLoadedCurrentSeries &&
    showFvgGrader &&
    timeframe === "1m" &&
    fvgSignalSeriesKey === currentSeriesKey
      ? fvgSignals
      : EMPTY_FVG_SIGNALS;
  const bigTradeOverlayEnabled = bigTradesEnabledForTimeframe(timeframe);
  const chartBigTrades = hasLoadedCurrentSeries && showBigTrades && bigTradeOverlayEnabled
    ? bigTrades
    : EMPTY_BIG_TRADES;
  const chartSmcAiSignals = hasLoadedCurrentSeries && timeframe === "1m"
    ? smcAiSignals
    : EMPTY_SMC_AI_SIGNALS;
  const chartAlertSignals = hasLoadedCurrentSeries && timeframe === "1m"
    ? alertSignalMarkers
    : EMPTY_ALERT_SIGNAL_MARKERS;
  const effectiveOutsideBar = useMemo(
    () => outsideBarSettingsForTimeframe(outsideBar, timeframe),
    [outsideBar, timeframe],
  );
  const visibleDrawings = useMemo(
    () => visibleDrawingsForTimeframe(drawings, timeframe),
    [drawings, timeframe],
  );
  const visibleDrawingsLoadKey = `${drawingsLoadKey}:${timeframe}`;
  const chartMenuLimitDraft =
    chartMenu === undefined
      ? undefined
      : buildChartLimitOrderDraft({
          entryPrice: chartMenu.price,
          referencePrice: chartMenu.referencePrice,
          settings: marketOrderSettings,
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

  return (
    <div className={appShellClassName(chartFocusMode)}>
      <Toolbar>
        <SymbolContractLabel symbol={SYMBOL} contract={contract} hideContract />
        <nav className="toolbar-page-links" aria-label="Chart pages">
          <a href="/fp">FP</a>
          <a href="/mp">MP</a>
        </nav>
        <TimeframeSelector value={timeframe} onChange={setTimeframe} />
        <IndicatorToggles
          volume={showVolume}
          volumeDelta={showVolumeDelta}
          mgannSwing={showMgannSwing}
          mgannSwingSettings={mgannSwing}
          footprint={showFootprint}
          fvgGrader={showFvgGrader}
          fvgSignalLimit={fvgSignalLimit}
          bigTrades={showBigTrades && bigTradeOverlayEnabled}
          ema={ema}
          smc={smc}
          outsideBar={effectiveOutsideBar}
          footprintSettings={footprintSettings}
          bigTradeSettings={bigTradeSettings}
          mgannSwingDisabled={mgannSwingDisabled}
          footprintDisabled={timeframe !== "1m"}
          fvgGraderDisabled={timeframe !== "1m"}
          bigTradeDisabled={!bigTradeOverlayEnabled}
          dailyVolumeProfile={showDailyVolumeProfile}
          dailyVolumeProfileWidth={dailyVolumeProfileWidth}
          dailyVolumeProfileDevelopingPoc={showDailyVolumeProfileDevelopingPoc}
          onVolumeChange={setShowVolume}
          onDailyVolumeProfileChange={setShowDailyVolumeProfile}
          onDailyVolumeProfileWidthChange={setDailyVolumeProfileWidth}
          onDailyVolumeProfileDevelopingPocChange={
            setShowDailyVolumeProfileDevelopingPoc
          }
          onVolumeDeltaChange={setShowVolumeDelta}
          onMgannSwingChange={setShowMgannSwing}
          onMgannSwingSettingsChange={setMgannSwing}
          onFootprintChange={setShowFootprint}
          onFvgGraderChange={setShowFvgGrader}
          onFvgSignalLimitChange={setFvgSignalLimit}
          onBigTradesChange={setShowBigTrades}
          onEmaChange={setEma}
          onSmcChange={setSmc}
          onOutsideBarChange={setOutsideBar}
          onFootprintSettingsChange={setFootprintSettings}
          onBigTradeSettingsChange={setBigTradeSettings}
        />
        <div className="account-toolbar" aria-label="Account controls">
          {authUser ? (
            <>
              <button type="button" onClick={onOpenMt5Account}>
                Account
              </button>
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
        <label className="chart-bg-control" title="Chart background">
          <span
            className="chart-bg-swatch"
            style={{ background: chartBackgroundColor }}
            aria-hidden="true"
          />
          <input
            type="color"
            aria-label="Chart background color"
            value={chartBackgroundColor}
            onChange={(e) => setChartBackgroundColor(e.currentTarget.value)}
          />
        </label>
        <div className="analyst-popover">
          <button
            type="button"
            className={`analyst-toolbar-button${analystPanelOpen ? " is-open" : ""}`}
            title="AI nháº­n Ä‘á»‹nh"
            aria-label="AI nháº­n Ä‘á»‹nh"
            aria-expanded={analystPanelOpen}
            onClick={onToggleAnalystPanel}
          >
            AI
          </button>
          <AnalystPanel
            open={analystPanelOpen}
            pending={analystPending}
            report={analystReport}
            error={analystError}
            eventAi={analystEventAi}
            eventAiPending={analystEventAiPending}
            authenticated={Boolean(authUser)}
            onRun={onRunAnalyst}
            onToggleEventAi={onToggleAnalystEventAi}
            onClose={() => setAnalystPanelOpen(false)}
          />
        </div>
        <div className="alert-popover">
          <AlertToolbarButton
            open={alertPanelOpen}
            alertCount={alerts.length}
            onClick={() =>
              setAlertPanelOpen((open) => {
                const next = !open;
                if (next) setAnalystPanelOpen(false);
                return next;
              })
            }
          />
          <AlertPanel
            open={alertPanelOpen}
            alerts={alerts}
            lastEvent={lastAlert}
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
        </div>
        <TimezoneControl
          offsetMinutes={timezoneOffsetMinutes}
          onChange={setTimezoneOffsetMinutes}
        />
        <StatusIndicator state={connection} />
      </Toolbar>
      <main className="chart-area">
        <DrawingToolbar
          className="drawing-toolbar-desktop"
          activeTool={activeTool}
          drawingCount={drawingCount}
          onToolSelect={setActiveTool}
          onDeleteAll={deleteAllDrawings}
        />
        <div className="chart-stack">
          <ChartContainer
            symbol={SYMBOL}
            contract={contract}
            timeframe={timeframe}
            bars={chartBars}
            volumeDelta={chartVolumeDelta}
            footprintBars={chartFootprintBars}
            fvgSignals={chartFvgSignals}
            bigTrades={chartBigTrades}
            smcAiSignals={chartSmcAiSignals}
            alertSignals={chartAlertSignals}
            alertLines={alertLines}
            orderLines={orderLines}
            orderControls={orderControls}
            ema={ema}
            smc={smc}
            outsideBar={effectiveOutsideBar}
            sessionVolumeProfile={showDailyVolumeProfile ? sessionVolumeProfile : null}
            sessionVolumeProfileWidth={dailyVolumeProfileWidth}
            sessionVolumeProfileDevelopingPoc={
              showDailyVolumeProfileDevelopingPoc
            }
            showVolume={showVolume}
            showVolumeDelta={showVolumeDelta}
            showCvd={showMgannWaveDelta}
            showMgannSwing={showMgannSwingForTimeframe}
            mgannSwing={mgannSwing}
            showFootprint={showFootprint && timeframe === "1m"}
            showFvgGrader={showFvgGrader && timeframe === "1m"}
            showBigTrades={showBigTrades && bigTradeOverlayEnabled}
            bigTradeSettings={bigTradeSettings}
            chartBackgroundColor={chartBackgroundColor}
            timezoneOffsetMinutes={timezoneOffsetMinutes}
            socket={socket}
            onRequestAlertAtPrice={onRequestChartMenu}
            onRealtimeBar={onChartRealtimeBar}
            onRequestMoreHistory={requestMoreHistory}
            onAlertDragCommit={onAlertDragCommit}
            onAlertDelete={onDeleteAlert}
            onOrderDragCommit={onOrderDragCommit}
            onOrderDragBatchCommit={onOrderDragBatchCommit}
            onOrderClose={onOrderRowClose}
            onOrderCancel={onOrderRowCancel}
            priceSnap={roundGcPrice}
            activeTool={activeTool}
            fixedRangeProfileMode={fixedRangeProfileMode}
            onToolDeselect={() => setActiveTool(null)}
            onDrawingCountChange={setDrawingCount}
            drawings={visibleDrawings}
            drawingsLoadKey={visibleDrawingsLoadKey}
            onDrawingsChange={onDrawingsStateChange}
            deleteAllSignal={deleteAllSignal}
            removeDrawingIds={removeDrawingIds}
            fixedRangeDeltaProfiles={fixedRangeDeltaProfiles}
            footprintSettings={footprintSettings}
            onScreenshotCaptureReady={(capture) => {
              screenshotCaptureRef.current = capture;
            }}
          >
            <button
              type="button"
              className="chart-focus-toggle"
              aria-pressed={chartFocusMode}
              onClick={toggleChartFocusMode}
            >
              {chartFocusMode ? "Exit" : "Focus"}
            </button>
            <DrawingToolbar
              className="drawing-toolbar-mobile"
              activeTool={activeTool}
              drawingCount={drawingCount}
              onToolSelect={setActiveTool}
              onDeleteAll={deleteAllDrawings}
            />
          </ChartContainer>
          <MarketOrderBar
            account={mt5Account}
            pending={orderPending}
            error={orderError}
            variant={chartFocusMode ? "drawer" : "default"}
            drawerOpen={marketOrderDrawerOpen}
            onDrawerOpenChange={setMarketOrderDrawerOpen}
            openOrderCount={orderRows.length}
            orderRows={orderRows}
            settings={marketOrderSettings}
            onSettingsChange={(settings) =>
              setMarketOrderSettings(sanitizeMarketOrderSettings(settings))
            }
            onMarketOrder={onMarketOrder}
            onOrderRowBreakEven={onOrderRowBreakEven}
            onOrderRowClose={onOrderRowClose}
            onOrderRowClose50Percent={onOrderRowClose50Percent}
            onOrderRowCancel={onOrderRowCancel}
          />
        </div>
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
        <Mt5AccountDialog
          open={mt5DialogOpen}
          account={mt5Account}
          pending={mt5Pending}
          error={mt5Error}
          terminals={mt5Terminals}
          onSubmit={onSubmitMt5Account}
          onClose={() => setMt5DialogOpen(false)}
        />
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
