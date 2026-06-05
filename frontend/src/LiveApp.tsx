import { useEffect, useMemo, useRef, useState } from "react";

import { ApiClient, type ProfileListItem } from "./api/client";
import { AlertPanel } from "./alerts/AlertPanel";
import {
  type Alert,
  type TelegramNotificationConfig,
  type TelegramNotificationInput,
} from "./alerts/types";
import { ChartContainer } from "./chart/ChartContainer";
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
import {
  type FootprintBar,
  mergeFootprint,
} from "./footprint/footprintModel";
import { type VolumeDeltaDatum, type AlertLine } from "./chart/lightweightChartsAdapter";
import { ChartSocket } from "./socket/ChartSocket";
import {
  type AlertEventMessage,
  type ChartEventType,
  type Timeframe,
} from "./socket/messages";
import type { ChartProfilePayload } from "./profiles/types";
import { StatusIndicator, type ConnectionState } from "./status/StatusIndicator";
import type { DrawingState, DrawingToolType } from "./chart/drawings/types";
import {
  DEFAULT_TIMEZONE_OFFSET_MINUTES,
  TIMEZONE_OFFSET_OPTIONS,
  formatClockForOffset,
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

function normalizeProfileId(value: string | null | undefined): string {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : DEFAULT_PROFILE_ID;
}

function profileDisplayName(profile: Pick<ProfileListItem, "id" | "name">): string {
  return profile.name.trim() || profile.id;
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
  const [nowMs, setNowMs] = useState(() => Date.now());
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

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <label
      className="timezone-control"
      title={`Chart timezone: ${formatUtcOffset(normalizedOffset)}`}
    >
      <span className="timezone-clock" aria-hidden="true">
        {formatClockForOffset(nowMs, normalizedOffset)}
      </span>
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

function serializeDrawings(drawings: readonly DrawingState[]): string {
  return JSON.stringify(cloneDrawings(drawings));
}

function upsertProfileChoice(
  choices: readonly ProfileListItem[],
  profile: ProfileListItem,
): ProfileListItem[] {
  const without = choices.filter((item) => item.id !== profile.id);
  return [profile, ...without];
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
  // TradingView-style "Add alert at {price}" menu, anchored at the click point.
  const [alertMenu, setAlertMenu] = useState<
    { price: number; x: number; y: number } | undefined
  >(undefined);
  const [activeTool, setActiveTool] = useState<DrawingToolType | null>(null);
  const [drawingCount, setDrawingCount] = useState(0);
  const [deleteAllSignal, setDeleteAllSignal] = useState(0);
  const [drawings, setDrawings] = useState<readonly DrawingState[]>([]);
  const drawingsSignature = useMemo(() => serializeDrawings(drawings), [drawings]);
  const [drawingsSyncedSignature, setDrawingsSyncedSignature] =
    useState(drawingsSignature);
  const [drawingsLoadKey, setDrawingsLoadKey] = useState(0);
  const initialProfileId = useMemo(() => readActiveProfileId(), []);
  const [profileId, setProfileId] = useState(initialProfileId);
  const [profileInput, setProfileInput] = useState(initialProfileId);
  const [profileOptions, setProfileOptions] = useState<readonly ProfileListItem[]>([]);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileDeleting, setProfileDeleting] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileHydrated, setProfileHydrated] = useState(false);
  const profileIdRef = useRef(profileId);
  profileIdRef.current = profileId;
  const drawingsSignatureRef = useRef(drawingsSignature);
  drawingsSignatureRef.current = drawingsSignature;

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
      timezoneOffsetMinutes,
      drawings: cloneDrawings(drawings),
    }),
    [
      bigTradeSettings,
      chartBackgroundColor,
      drawings,
      ema,
      footprintSettings,
      outsideBar,
      showBigTrades,
      showFootprint,
      smc,
      timeframe,
      timezoneOffsetMinutes,
    ],
  );

  const markDrawingsSyncedIfCurrent = (signature: string) => {
    setDrawingsSyncedSignature((current) =>
      drawingsSignatureRef.current === signature ? signature : current,
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
    return () => {
      window.clearInterval(reconnectTimer);
      offOpen();
      offClose();
      offStatus();
      offAlert();
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const profiles = await api.profiles();
        if (!cancelled) setProfileOptions(profiles);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  // Resolve profile-scoped alerts when the active profile changes.
  useEffect(() => {
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
  }, [api, profileId]);

  useEffect(() => {
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
  }, [api, profileId]);

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
      offFootprint();
      offBigTrade();
    };
  }, [socket, contract]);

  const onToggleAlert = (id: string, enabled: boolean) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, enabled } : a)));
    void api.patchAlert(id, enabled, profileId);
  };
  const onDeleteAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    void api.deleteAlert(id, profileId);
  };
  const onCreateAlert = (input: {
    type: Alert["type"];
    params: Record<string, number | boolean>;
  }) => {
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
  // Create a price-crosses-level alert at the price the user right-clicked.
  const onConfirmAlertAtPrice = (price: number) => {
    const rounded = Math.round(price * 10) / 10; // GC tick is 0.1
    onCreateAlert({ type: "price_crosses_level", params: { level: rounded } });
    setAlertMenu(undefined);
  };
  // Persist a dragged alert line's new level (optimistic + PATCH).
  const onAlertDragCommit = (id: string, price: number) => {
    const level = Math.round(price * 10) / 10; // GC tick is 0.1
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, params: { ...a.params, level } } : a,
      ),
    );
    void api.patchAlertParams(id, { level }, profileId);
  };
  const buildProfilePayload = (): ChartProfilePayload => profilePayload;

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
    setTimezoneOffsetMinutes(
      normalizeTimezoneOffsetMinutes(payload.timezoneOffsetMinutes),
    );
    const nextDrawings = Array.isArray(payload.drawings)
      ? cloneDrawings(payload.drawings)
      : [];
    const nextDrawingsSignature = serializeDrawings(nextDrawings);
    drawingsSignatureRef.current = nextDrawingsSignature;
    setDrawingsSyncedSignature(nextDrawingsSignature);
    setDrawings(nextDrawings);
    setDrawingsLoadKey((key) => key + 1);
    setDrawingCount(nextDrawings.length);
    setActiveTool(null);
  };

  // Restore the last successfully loaded/saved profile after a browser refresh.
  // The payload remains server-side; localStorage stores only the active id.
  useEffect(() => {
    let cancelled = false;
    setProfileLoading(true);
    void (async () => {
      try {
        const profile = await api.profile(initialProfileId);
        if (!cancelled) {
          applyProfilePayload(profile.payload);
          setProfileId(profile.id);
          setProfileInput(profile.id);
        }
      } catch {
        if (!cancelled && initialProfileId !== DEFAULT_PROFILE_ID) {
          persistActiveProfileId(DEFAULT_PROFILE_ID);
          setProfileId(DEFAULT_PROFILE_ID);
          setProfileInput(DEFAULT_PROFILE_ID);
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
          setProfileHydrated(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, initialProfileId]);

  const onSaveProfile = () => {
    const id = normalizeProfileId(profileInput);
    const existing = profileChoices.find((profile) => profile.id === id);
    const name = existing ? profileDisplayName(existing) : id;
    setProfileInput(id);
    setProfileSaving(true);
    const payload = buildProfilePayload();
    const savedDrawingsSignature = drawingsSignature;
    void (async () => {
      try {
        const saved = await api.saveProfile(id, {
          name,
          payload,
        });
        setProfileOptions((prev) => upsertProfileChoice(prev, saved));
        setProfileId(id);
        persistActiveProfileId(id);
        markDrawingsSyncedIfCurrent(savedDrawingsSignature);
      } catch {
        /* ignore */
      } finally {
        setProfileSaving(false);
      }
    })();
  };

  const onLoadProfile = () => {
    const id = normalizeProfileId(profileInput);
    setProfileInput(id);
    setProfileLoading(true);
    void (async () => {
      try {
        const profile = await api.profile(id);
        applyProfilePayload(profile.payload);
        setProfileId(profile.id);
        setProfileInput(profile.id);
        persistActiveProfileId(profile.id);
      } catch {
        /* ignore */
      } finally {
        setProfileLoading(false);
      }
    })();
  };

  const onCreateProfile = () => {
    const name = window.prompt("Profile name");
    if (name === null) return;
    const id = name.trim();
    if (!id) return;
    setProfileInput(id);
    setProfileSaving(true);
    const payload = buildProfilePayload();
    const savedDrawingsSignature = drawingsSignature;
    void (async () => {
      try {
        const saved = await api.saveProfile(id, {
          name: id,
          payload,
        });
        setProfileOptions((prev) => upsertProfileChoice(prev, saved));
        setProfileId(saved.id);
        setProfileInput(saved.id);
        persistActiveProfileId(saved.id);
        markDrawingsSyncedIfCurrent(savedDrawingsSignature);
      } catch {
        /* ignore */
      } finally {
        setProfileSaving(false);
      }
    })();
  };

  const onDeleteProfile = () => {
    const id = normalizeProfileId(profileInput);
    if (id === DEFAULT_PROFILE_ID || profileDeleting) return;
    const selected = profileChoices.find((profile) => profile.id === id);
    if (!window.confirm(`Delete profile "${selected ? profileDisplayName(selected) : id}"?`)) return;
    setProfileDeleting(true);
    void (async () => {
      try {
        await api.deleteProfile(id);
        setProfileOptions((prev) => prev.filter((profile) => profile.id !== id));
        if (id === profileId) {
          persistActiveProfileId(DEFAULT_PROFILE_ID);
          setProfileId(DEFAULT_PROFILE_ID);
          try {
            const fallback = await api.profile(DEFAULT_PROFILE_ID);
            applyProfilePayload(fallback.payload);
            setProfileInput(fallback.id);
          } catch {
            setProfileInput(DEFAULT_PROFILE_ID);
          }
        } else {
          setProfileInput(profileId);
        }
      } catch {
        /* ignore */
      } finally {
        setProfileDeleting(false);
      }
    })();
  };

  // Alert level lines drawn on the candle scale (Req 16.5). Recomputed only
  // when the alert set changes.
  const alertLines = useMemo(() => toAlertLines(alerts), [alerts]);
  const profileChoices = useMemo(() => {
    const byId = new Map<string, ProfileListItem>();
    for (const option of profileOptions) {
      byId.set(option.id, option);
    }
    for (const id of [profileInput, profileId, DEFAULT_PROFILE_ID]) {
      const normalized = normalizeProfileId(id);
      if (!byId.has(normalized)) {
        byId.set(normalized, {
          id: normalized,
          name: normalized,
          createdAt: 0,
          updatedAt: 0,
        });
      }
    }
    return [...byId.values()];
  }, [profileId, profileInput, profileOptions]);
  const selectedProfile = profileChoices.find((profile) => profile.id === profileInput);
  const canDeleteSelectedProfile =
    normalizeProfileId(profileInput) !== DEFAULT_PROFILE_ID && selectedProfile !== undefined;
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
      profileLoading ||
      profileSaving ||
      drawingsSignature === drawingsSyncedSignature
    ) {
      return;
    }

    const id = normalizeProfileId(profileId);
    const existing = profileOptions.find((profile) => profile.id === id);
    const name = existing ? profileDisplayName(existing) : id;
    const payload = profilePayload;
    const savedDrawingsSignature = drawingsSignature;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const saved = await api.saveProfile(id, { name, payload });
          setProfileOptions((prev) => upsertProfileChoice(prev, saved));
          markDrawingsSyncedIfCurrent(savedDrawingsSignature);
        } catch {
          /* Keep the drawings dirty so the next render/change can retry. */
        }
      })();
    }, DRAWINGS_AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [
    api,
    drawingsSignature,
    drawingsSyncedSignature,
    profileId,
    profileLoading,
    profileOptions,
    profilePayload,
    profileSaving,
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
        <div className="profile-control" title={`Active profile: ${profileId}`}>
          <select
            aria-label="Profile id"
            value={profileInput}
            onChange={(e) => setProfileInput(e.currentTarget.value)}
          >
            {profileChoices.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profileDisplayName(profile)}
              </option>
            ))}
          </select>
          <button type="button" onClick={onLoadProfile} disabled={profileLoading}>
            Load
          </button>
          <button type="button" onClick={onSaveProfile} disabled={profileSaving}>
            Save
          </button>
          <button type="button" onClick={onCreateProfile} disabled={profileSaving}>
            New
          </button>
          <button
            type="button"
            className="profile-danger-button"
            onClick={onDeleteProfile}
            disabled={profileDeleting || !canDeleteSelectedProfile}
          >
            Delete
          </button>
        </div>
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
            setActiveTool(null);
          }}
        />
        <ChartContainer
          symbol={SYMBOL}
          contract={contract}
          timeframe={timeframe}
          bars={chartBars}
          volumeDelta={chartVolumeDelta}
          footprintBars={chartFootprintBars}
          bigTrades={chartBigTrades}
          alertLines={alertLines}
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
          priceSnap={(price) => Math.round(price * 10) / 10}
          activeTool={activeTool}
          onToolDeselect={() => setActiveTool(null)}
          onDrawingCountChange={setDrawingCount}
          drawings={drawings}
          drawingsLoadKey={drawingsLoadKey}
          onDrawingsChange={setDrawings}
          deleteAllSignal={deleteAllSignal}
          footprintSettings={footprintSettings}
          onScreenshotCaptureReady={(capture) => {
            screenshotCaptureRef.current = capture;
          }}
        />
        <TimezoneControl
          offsetMinutes={timezoneOffsetMinutes}
          onChange={setTimezoneOffsetMinutes}
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
