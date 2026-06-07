import { useEffect, useMemo, useRef, useState } from "react";

import {
  ApiClient,
  type AuthUser,
  type Mt5Account,
  type Mt5ConnectInput,
  type Mt5Symbol,
} from "./api/client";
import { AlertPanel } from "./alerts/AlertPanel";
import {
  type Alert,
  type TelegramNotificationConfig,
  type TelegramNotificationInput,
} from "./alerts/types";
import { ChartContainer, type OrderControl } from "./chart/ChartContainer";
import { DrawingToolbar } from "./chart/DrawingToolbar";
import {
  IndicatorToggles,
  DEFAULT_BIG_TRADE_SETTINGS,
  DEFAULT_FOOTPRINT_SETTINGS,
} from "./chart/IndicatorToggles";
import type { BigTradeSettings, FootprintSettings } from "./chart/IndicatorToggles";
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
import { DEFAULT_SMC_SETTINGS, type SmcSettings } from "./chart/smc";
import { HistoryLoader } from "./cache/historyLoader";
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
  type OrderLine,
  type OrderLineField,
} from "./chart/lightweightChartsAdapter";
import {
  MarketOrderBar,
  type MarketOrderSettings,
} from "./orders/MarketOrderBar";
import { Mt5AccountDialog } from "./orders/Mt5AccountDialog";
import { ChartSocket } from "./socket/ChartSocket";
import {
  type AlertEventMessage,
  type ChartEventType,
  type TradingOrder,
  type Timeframe,
} from "./socket/messages";
import type { ChartProfilePayload } from "./profiles/types";
import { StatusIndicator, type ConnectionState } from "./status/StatusIndicator";
import type { DrawingState, DrawingToolType } from "./chart/drawings/types";
import {
  DEFAULT_TIMEZONE_OFFSET_MINUTES,
  TIMEZONE_OFFSET_OPTIONS,
  formatUtcOffset,
  normalizeTimezoneOffsetMinutes,
} from "./chart/timezone";

const SYMBOL = "GC";
export const CHART_CONTRACT = SYMBOL;
const DEFAULT_PROFILE_ID = "default";
const ACTIVE_PROFILE_STORAGE_KEY = "gc-chart-platform.active-profile";
const DEFAULT_CHART_BACKGROUND = "#101010";
const SOCKET_IDLE_TIMEOUT_MS = 45_000;
const SOCKET_TRANSITION_TIMEOUT_MS = 10_000;
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
export const GLOBAL_SUBSCRIBED_EVENTS: ChartEventType[] = [
  "quote_update",
  "big_trade",
  "alert_event",
  "order_update",
  "position_update",
  "account_update",
  "basis_update",
  "risk_update",
  "status",
];
export const TIMEFRAME_SUBSCRIBED_EVENTS: ChartEventType[] = [
  "bar_update",
  "volume_delta_update",
];
export const FOOTPRINT_SUBSCRIBED_EVENTS: ChartEventType[] = [
  "footprint_update",
];
const EMPTY_BARS: readonly Bar[] = [];
const EMPTY_VOLUME_DELTA: readonly VolumeDeltaDatum[] = [];
const EMPTY_BIG_TRADES: readonly BigTradeMarker[] = [];
const EMPTY_FOOTPRINT_BARS: ReadonlyMap<number, FootprintBar> = new Map();
const DEFERRED_INDICATOR_LOAD_MS = 75;
const DEFERRED_OVERLAY_LOAD_MS = 250;
const INITIAL_VOLUME_DELTA_LIMIT = 2_000;
const INITIAL_BIG_TRADE_LIMIT = DEFAULT_BIG_TRADE_SETTINGS.maxVisible;
const DRAWINGS_AUTOSAVE_DELAY_MS = 90_000;
const MARKET_ORDER_SETTINGS_STORAGE_KEY = "gc-chart-platform.market-order-settings";
const DEFAULT_MARKET_ORDER_SETTINGS: MarketOrderSettings = {
  volumeLots: 0.1,
  slDistanceGc: 3,
  tpDistanceGc: 6,
};

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
    const entry = order.entryGc ?? order.fillPriceGcEstimate;
    const sideTitle = order.side.toUpperCase();
    if (isFinitePrice(entry)) {
      lines.push({
        id: orderLineId(order.id, "entryGc"),
        orderId: order.id,
        field: "entryGc",
        price: entry,
        side: order.side,
        status: order.status,
        editable: order.status !== "filled",
        title: `${sideTitle} ${order.status === "filled" ? "fill" : order.kind}`,
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
  const price = order.entryGc ?? order.fillPriceGcEstimate;
  return isFinitePrice(price) ? price : undefined;
}

function estimateOrderPnl(
  order: TradingOrder,
  currentPrice: number | undefined,
  symbol: Mt5Symbol | undefined,
): number | undefined {
  if (order.status !== "filled") return undefined;
  const entry = orderEntryGc(order);
  if (entry === undefined || currentPrice === undefined) return undefined;
  const direction = order.side === "buy" ? 1 : -1;
  const tickSize = symbol?.tickSize && symbol.tickSize > 0 ? symbol.tickSize : 0.01;
  const tickValue = symbol?.pipValue && symbol.pipValue > 0 ? symbol.pipValue : 1;
  return ((currentPrice - entry) * direction / tickSize) * tickValue * order.volumeLots;
}

function formatPnl(value: number | undefined): string | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  const sign = value > 0 ? "+" : "";
  return `${sign}$${value.toFixed(2)}`;
}

function toOrderControls(
  orders: readonly TradingOrder[],
  currentPrice: number | undefined,
  symbol: Mt5Symbol | undefined,
  closingIds: ReadonlySet<string>,
  cancellingIds: ReadonlySet<string>,
): OrderControl[] {
  const controls: OrderControl[] = [];
  for (const order of orders) {
    if (order.symbolInternal !== SYMBOL || !isOpenTradingOrder(order)) continue;
    const entry = orderEntryGc(order);
    if (entry === undefined) continue;
    const pnl = estimateOrderPnl(order, currentPrice, symbol);
    const status = order.status === "filled" ? "fill" : order.status;
    controls.push({
      id: `${order.id}:action`,
      orderId: order.id,
      price: entry,
      side: order.side,
      title: `${order.side.toUpperCase()} ${status}`,
      detail: `${order.volumeLots.toFixed(2)} lot @ ${entry.toFixed(1)}`,
      pnlText: formatPnl(pnl),
      pnlValue: pnl,
      canClose: order.status === "filled" && order.brokerPositionTicket != null,
      canCancel:
        order.status === "pending_submit" ||
        order.status === "submitted" ||
        order.status === "working" ||
        order.status === "sync_paused" ||
        order.status === "sync_error",
      closing: closingIds.has(order.id),
      cancelling: cancellingIds.has(order.id),
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
    options: drawing.options ? { ...drawing.options } : undefined,
  }));
}

function profileDrawings(drawings: readonly DrawingState[]): DrawingState[] {
  return cloneDrawings(drawings.filter((drawing) => drawing.tool !== "order_bracket"));
}

/** Resolve the backend base URLs.
 *
 * REST and WebSocket intentionally stay same-origin. In dev, Vite proxies
 * `/api` and `/ws` to the same backend process; connecting the browser directly
 * to `:8000` can hit a different backend when multiple local/public servers are
 * running, which makes refresh-loaded history work while live updates stall.
 */
export function resolveEndpoints(
  location: Pick<Location, "protocol" | "host"> = window.location,
): { api: string; ws: string } {
  const wsProto = location.protocol === "https:" ? "wss" : "ws";
  const ws = `${wsProto}://${location.host}/ws/chart`;
  return { api: "/api", ws };
}

/**
 * LiveApp — the composed, runnable application.
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
  const [socketGeneration, setSocketGeneration] = useState(0);
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
  const [loadedOverlayContract, setLoadedOverlayContract] = useState<
    string | undefined
  >(undefined);
  const [bigTrades, setBigTrades] = useState<readonly BigTradeMarker[]>([]);
  const [showFootprint, setShowFootprint] = useState(false);
  const [showBigTrades, setShowBigTrades] = useState(true);
  const [ema, setEma] = useState({ enabled: false, period: 200, color: "#2962ff" });
  const [smc, setSmc] = useState<SmcSettings>(() => ({ ...DEFAULT_SMC_SETTINGS }));
  const [outsideBar, setOutsideBar] = useState<OutsideBarSettings>(() => ({
    ...DEFAULT_OUTSIDE_BAR_SETTINGS,
  }));
  const [footprintSettings, setFootprintSettings] = useState<FootprintSettings>(
    () => ({ ...DEFAULT_FOOTPRINT_SETTINGS }),
  );
  const [bigTradeSettings, setBigTradeSettings] = useState<BigTradeSettings>(
    () => ({ ...DEFAULT_BIG_TRADE_SETTINGS }),
  );
  const [chartBackgroundColor, setChartBackgroundColor] = useState(
    DEFAULT_CHART_BACKGROUND,
  );
  const [timezoneOffsetMinutes, setTimezoneOffsetMinutes] = useState(
    DEFAULT_TIMEZONE_OFFSET_MINUTES,
  );
  const [alerts, setAlerts] = useState<readonly Alert[]>([]);
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
  const [authUser, setAuthUser] = useState<AuthUser | undefined>(undefined);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthDialogMode>("login");
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState("");
  const [mt5Account, setMt5Account] = useState<Mt5Account | undefined>(undefined);
  const [mt5Symbol, setMt5Symbol] = useState<Mt5Symbol | undefined>(undefined);
  const [mt5DialogOpen, setMt5DialogOpen] = useState(false);
  const [mt5Pending, setMt5Pending] = useState(false);
  const [mt5Error, setMt5Error] = useState("");
  const [orders, setOrders] = useState<readonly TradingOrder[]>([]);
  const [closingOrderIds, setClosingOrderIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [cancellingOrderIds, setCancellingOrderIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [latestPrice, setLatestPrice] = useState<number | undefined>(undefined);
  const [marketOrderSettings, setMarketOrderSettings] =
    useState<MarketOrderSettings>(() => readMarketOrderSettings());
  const [orderPending, setOrderPending] = useState(false);
  const [orderError, setOrderError] = useState("");
  // TradingView-style "Add alert at {price}" menu, anchored at the click point.
  const [alertMenu, setAlertMenu] = useState<
    { price: number; x: number; y: number } | undefined
  >(undefined);
  const [activeTool, setActiveTool] = useState<DrawingToolType | null>(null);
  const [drawingCount, setDrawingCount] = useState(0);
  const [deleteAllSignal, setDeleteAllSignal] = useState(0);
  const [removeDrawingIds, setRemoveDrawingIds] = useState<readonly string[]>([]);
  const [drawings, setDrawings] = useState<readonly DrawingState[]>([]);
  const [drawingsLoadKey, setDrawingsLoadKey] = useState(0);
  const [profileId, setProfileId] = useState(DEFAULT_PROFILE_ID);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileHydrated, setProfileHydrated] = useState(false);
  const profileIdRef = useRef(profileId);
  profileIdRef.current = profileId;
  const submittedOrderDrawingIdsRef = useRef(new Set<string>());
  const invalidOrderDrawingIdsRef = useRef(new Set<string>());

  const profilePayload = useMemo<ChartProfilePayload>(
    () => ({
      version: 1,
      timeframe,
      chartBackgroundColor,
      showFootprint,
      showBigTrades,
      ema: { ...ema },
      smc: { ...smc },
      outsideBar: { ...outsideBar },
      footprintSettings: { ...footprintSettings },
      bigTradeSettings: { ...bigTradeSettings },
      marketOrderSettings: { ...marketOrderSettings },
      timezoneOffsetMinutes,
      drawings: profileDrawings(drawings),
    }),
    [
      bigTradeSettings,
      chartBackgroundColor,
      drawings,
      ema,
      footprintSettings,
      marketOrderSettings,
      outsideBar,
      showBigTrades,
      showFootprint,
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

  const historyLoader = useRef<HistoryLoader | null>(null);
  const screenshotCaptureRef = useRef<(() => string | undefined) | undefined>(
    undefined,
  );
  const telegramSentRef = useRef<string | undefined>(undefined);
  if (historyLoader.current === null) {
    historyLoader.current = new HistoryLoader(
      (url) => fetch(url),
      cache,
      { basePath: endpoints.api },
    );
  }
  const currentSeriesKey = seriesDataKey(SYMBOL, contract, timeframe);
  const hasLoadedCurrentSeries = loadedSeriesKey === currentSeriesKey;

  useEffect(() => {
    persistMarketOrderSettings(marketOrderSettings);
  }, [marketOrderSettings]);

  // Connect the socket once and keep it for the component's lifetime. Status
  // + alert handlers are attached here; subscription management lives in its
  // own effect below so status churn never tears down the connection.
  useEffect(() => {
    const reconnect = () => {
      socket.ensureConnected(SOCKET_IDLE_TIMEOUT_MS, SOCKET_TRANSITION_TIMEOUT_MS);
    };
    const offOpen = socket.onOpen(() => {
      setConnection("connected");
      // Re-fetch REST history after reconnect so bars missed while the socket
      // was unavailable are patched without requiring a browser reload.
      setSocketGeneration((generation) => generation + 1);
    });
    const offClose = socket.onClose(() => setConnection("disconnected"));
    socket.connect();
    const reconnectTimer = window.setInterval(reconnect, 1500);
    const offStatus = socket.on("status", (msg) => {
      setConnection((prev) => (prev === msg.state ? prev : msg.state));
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
      }
    });
    const offOrder = socket.on("order_update", (msg) => {
      setOrders((prev) => {
        const without = prev.filter((order) => order.id !== msg.order.id);
        return isOpenTradingOrder(msg.order) ? [msg.order, ...without] : without;
      });
    });
    return () => {
      window.clearInterval(reconnectTimer);
      offOpen();
      offClose();
      offStatus();
      offAlert();
      offOrder();
      socket.close();
    };
  }, [socket]);

  // Global events do not belong to a bar timeframe. Keep them subscribed once
  // so changing 1m -> 5m does not mix global and timeframe-scoped unsubscribe
  // bookkeeping on the backend.
  useEffect(() => {
    socket.subscribe(SYMBOL, GLOBAL_SUBSCRIBED_EVENTS);
    socket.subscribe(SYMBOL, FOOTPRINT_SUBSCRIBED_EVENTS, "1m");
    return () => {
      socket.unsubscribe(SYMBOL, GLOBAL_SUBSCRIBED_EVENTS);
      socket.unsubscribe(SYMBOL, FOOTPRINT_SUBSCRIBED_EVENTS, "1m");
    };
  }, [socket]);

  // Resolve profile-scoped alerts when the active profile changes.
  useEffect(() => {
    if (!authUser || !profileHydrated) {
      setAlerts([]);
      setLastAlert(undefined);
      return;
    }
    let cancelled = false;
    setLastAlert(undefined);
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
        });
        if (!cancelled) {
          setLoadedSeriesKey(requestedSeriesKey);
          setBars(history.bars);
          setLatestPrice(history.bars[history.bars.length - 1]?.close);
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
                  setVolumeDelta(delta.map((point) => ({
                    time: point.time,
                    delta: point.delta,
                    deltaHigh: point.deltaHigh,
                    deltaLow: point.deltaLow,
                    openDelta: point.openDelta,
                    closeDelta: point.closeDelta,
                  })));
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
    setLoadedOverlayContract(undefined);
    setFootprintBars(new Map());
    setBigTrades([]);
  }, [contract]);

  useEffect(() => {
    if (!hasLoadedCurrentSeries || loadedOverlayContract === contract) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const [footprint, initialBigTrades] = await Promise.allSettled([
          api.footprint(SYMBOL, contract),
          api.bigTrades(SYMBOL, contract, INITIAL_BIG_TRADE_LIMIT),
        ]);
        if (cancelled) return;
        if (footprint.status === "fulfilled") {
          setFootprintBars(new Map(footprint.value.map((bar) => [bar.time, bar])));
        }
        if (initialBigTrades.status === "fulfilled") {
          setBigTrades((prev) => reduceBigTrades(prev, initialBigTrades.value));
        }
        setLoadedOverlayContract(contract);
      })();
    }, DEFERRED_OVERLAY_LOAD_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [api, contract, hasLoadedCurrentSeries, loadedOverlayContract]);

  useEffect(() => {
    const matchesChartContract = (messageContract: string) =>
      contract === SYMBOL || messageContract === contract;
    const offBarPrice = socket.on("bar_update", (msg) => {
      if (
        msg.symbol === SYMBOL &&
        matchesChartContract(msg.contract) &&
        msg.tf === timeframe
      ) {
        setLatestPrice(msg.bar.close);
      }
    });
    const offQuotePrice = socket.on("quote_update", (msg) => {
      if (msg.symbol === SYMBOL && matchesChartContract(msg.contract)) {
        setLatestPrice((msg.bid + msg.ask) / 2);
      }
    });
    const offFootprint = socket.on("footprint_update", (msg) => {
      if (
        msg.symbol !== SYMBOL ||
        !matchesChartContract(msg.contract) ||
        msg.tf !== "1m"
      ) {
        return;
      }
      setFootprintBars((prev) => mergeFootprint(prev, msg));
    });
    const offBigTrade = socket.on("big_trade", (msg) => {
      if (msg.symbol !== SYMBOL || !matchesChartContract(msg.contract)) {
        return;
      }
      setBigTrades((prev) => applyBigTrade(prev, msg).markers);
    });
    return () => {
      offBarPrice();
      offQuotePrice();
      offFootprint();
      offBigTrade();
    };
  }, [socket, contract, timeframe]);

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
    void api.deleteAlert(id, profileId);
  };
  const onCreateAlert = (input: {
    type: Alert["type"];
    params: Record<string, number | boolean>;
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
        /* ignore — surfaced by the disabled state in a later iteration */
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
        setProfileHydrated(true);
      }
    })();
  };
  const onMarketOrder = (side: "buy" | "sell") => {
    const marketGcPrice =
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
          ...(marketGcPrice !== undefined ? { entryGc: roundGcPrice(marketGcPrice) } : {}),
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
      } catch (error) {
        setOrderError(error instanceof Error ? error.message : "Chart order failed");
      } finally {
        setOrderPending(false);
      }
    })();
  };

  const onDrawingsStateChange = (state: DrawingState[]) => {
    setDrawings(state);
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
    const order = orders.find((item) => item.id === parsed.orderId);
    if (!order) return;
    if (parsed.field === "entryGc" && order.status === "filled") {
      setOrderError("Filled positions cannot modify entry.");
      return;
    }
    const level = roundGcPrice(price);
    const patch: Parameters<ApiClient["patchOrder"]>[1] = {
      expectedVersion: order.version,
    };
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
      } catch (error) {
        setOrderError(error instanceof Error ? error.message : "Close order failed");
        try {
          setOrders(await api.orders(true));
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
      } catch (error) {
        setOrderError(error instanceof Error ? error.message : "Cancel order failed");
        try {
          setOrders(await api.orders(true));
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
  // Create a price-crosses-level alert at the price the user right-clicked.
  const onConfirmAlertAtPrice = (price: number) => {
    const rounded = roundGcPrice(price);
    onCreateAlert({ type: "price_crosses_level", params: { level: rounded } });
    setAlertMenu(undefined);
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
    const emaPeriod = Number(payload.ema?.period ?? 200);
    if (isTimeframe(payload.timeframe)) {
      setTimeframe(payload.timeframe);
    }
    setChartBackgroundColor(
      typeof payload.chartBackgroundColor === "string"
        ? payload.chartBackgroundColor
        : DEFAULT_CHART_BACKGROUND,
    );
    setShowFootprint(Boolean(payload.showFootprint));
    setShowBigTrades(payload.showBigTrades !== false);
    setEma({
      enabled: Boolean(payload.ema?.enabled),
      period: Number.isFinite(emaPeriod)
        ? Math.max(1, Math.round(emaPeriod))
        : 200,
      color: typeof payload.ema?.color === "string" ? payload.ema.color : "#2962ff",
    });
    setSmc({ ...DEFAULT_SMC_SETTINGS, ...(payload.smc ?? {}) });
    setOutsideBar(normalizeOutsideBarSettings(payload.outsideBar));
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

    if (profileResult.status === "fulfilled") {
      applyProfilePayload(profileResult.value.payload);
      setProfileId(normalizeProfileId(profileResult.value.id));
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
      const [symbolResult, orderResult] = await Promise.allSettled([
        api.mt5Symbol(),
        api.orders(true),
      ]);
      setMt5Symbol(symbolResult.status === "fulfilled" ? symbolResult.value : undefined);
      setOrders(orderResult.status === "fulfilled" ? orderResult.value : []);
    } else {
      setMt5Symbol(undefined);
      setOrders([]);
      if (options.openMt5Setup) {
        setMt5Error("");
        setMt5DialogOpen(true);
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
        const [symbolResult, orderResult] = await Promise.allSettled([
          api.mt5Symbol(),
          api.orders(true),
        ]);
        setMt5Symbol(symbolResult.status === "fulfilled" ? symbolResult.value : undefined);
        setOrders(orderResult.status === "fulfilled" ? orderResult.value : []);
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
  const orderLines = useMemo(() => toOrderLines(orders), [orders]);
  const orderControls = useMemo(
    () =>
      toOrderControls(
        orders,
        latestPrice,
        mt5Symbol,
        closingOrderIds,
        cancellingOrderIds,
      ),
    [orders, latestPrice, mt5Symbol, closingOrderIds, cancellingOrderIds],
  );
  const chartBars = hasLoadedCurrentSeries ? bars : EMPTY_BARS;
  const chartVolumeDelta = hasLoadedCurrentSeries && volumeDeltaSeriesKey === currentSeriesKey
    ? volumeDelta
    : EMPTY_VOLUME_DELTA;
  const chartFootprintBars = hasLoadedCurrentSeries
    ? footprintBars
    : EMPTY_FOOTPRINT_BARS;
  const chartBigTrades = hasLoadedCurrentSeries ? bigTrades : EMPTY_BIG_TRADES;

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
    <div className="app-shell">
      <Toolbar>
        <SymbolContractLabel symbol={SYMBOL} contract={contract} hideContract />
        <TimeframeSelector value={timeframe} onChange={setTimeframe} />
        <IndicatorToggles
          footprint={showFootprint}
          bigTrades={showBigTrades}
          ema={ema}
          smc={smc}
          outsideBar={outsideBar}
          footprintSettings={footprintSettings}
          bigTradeSettings={bigTradeSettings}
          footprintDisabled={timeframe !== "1m"}
          onFootprintChange={setShowFootprint}
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
        <div className="alert-popover">
          <AlertToolbarButton
            open={alertPanelOpen}
            alertCount={alerts.length}
            onClick={() => setAlertPanelOpen((open) => !open)}
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
          activeTool={activeTool}
          drawingCount={drawingCount}
          onToolSelect={setActiveTool}
          onDeleteAll={() => {
            setDeleteAllSignal((s) => s + 1);
            setDrawingCount(0);
            setDrawings([]);
            submittedOrderDrawingIdsRef.current.clear();
            invalidOrderDrawingIdsRef.current.clear();
            setActiveTool(null);
          }}
        />
        <div className="chart-stack">
          <ChartContainer
            symbol={SYMBOL}
            contract={contract}
            timeframe={timeframe}
            bars={chartBars}
            volumeDelta={chartVolumeDelta}
            footprintBars={chartFootprintBars}
            bigTrades={chartBigTrades}
            alertLines={alertLines}
            orderLines={orderLines}
            orderControls={orderControls}
            ema={ema}
            smc={smc}
            outsideBar={outsideBar}
            showFootprint={showFootprint && timeframe === "1m"}
            showBigTrades={showBigTrades}
            bigTradeSettings={bigTradeSettings}
            chartBackgroundColor={chartBackgroundColor}
            timezoneOffsetMinutes={timezoneOffsetMinutes}
            socket={socket}
            onRequestAlertAtPrice={setAlertMenu}
            onAlertDragCommit={onAlertDragCommit}
            onOrderDragCommit={onOrderDragCommit}
            onOrderClose={onCloseOrder}
            onOrderCancel={onCancelOrder}
            priceSnap={roundGcPrice}
            activeTool={activeTool}
            onToolDeselect={() => setActiveTool(null)}
            onDrawingCountChange={setDrawingCount}
            drawings={drawings}
            drawingsLoadKey={drawingsLoadKey}
            onDrawingsChange={onDrawingsStateChange}
            deleteAllSignal={deleteAllSignal}
            removeDrawingIds={removeDrawingIds}
            footprintSettings={footprintSettings}
            onScreenshotCaptureReady={(capture) => {
              screenshotCaptureRef.current = capture;
            }}
          />
          <MarketOrderBar
            account={mt5Account}
            pending={orderPending}
            error={orderError}
            openOrderCount={orders.length}
            settings={marketOrderSettings}
            onSettingsChange={(settings) =>
              setMarketOrderSettings(sanitizeMarketOrderSettings(settings))
            }
            onMarketOrder={onMarketOrder}
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
          onSubmit={onSubmitMt5Account}
          onClose={() => setMt5DialogOpen(false)}
        />
        {alertMenu !== undefined && (
          <>
            <div
              className="alert-menu-backdrop"
              onClick={() => setAlertMenu(undefined)}
              onContextMenu={(e) => {
                e.preventDefault();
                setAlertMenu(undefined);
              }}
            />
            <div
              className="alert-menu"
              role="menu"
              style={{ left: alertMenu.x, top: alertMenu.y }}
            >
              <button
                type="button"
                role="menuitem"
                className="alert-menu-item"
                onClick={() => onConfirmAlertAtPrice(alertMenu.price)}
              >
                Add alert at {(Math.round(alertMenu.price * 10) / 10).toFixed(1)}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
