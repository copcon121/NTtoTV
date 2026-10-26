import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { buildHistoryUrl, type HistoryResponse } from "../cache/historyLoader";
import { ApiClient } from "../api/client";
import {
  BIG_TRADE_SESSIONS,
  bigTradeMinVolumeForTime,
  normalizeBigTradeSessionMinVolumes,
  type BigTradeSession,
} from "../chart/bigTradeSessions";
import {
  DEFAULT_BIG_TRADE_SETTINGS,
  MAX_BIG_TRADE_VISIBLE,
  normalizeBigTradeMaxVisible,
  type BigTradeSettings,
} from "../chart/IndicatorToggles";
import {
  bubbleRadius,
  reduceBigTradesCapped,
  type BigTradeMarker,
} from "../chart/indicatorReducer";
import { resolveEndpoints } from "../endpoints";
import type {
  ChartProfilePayload,
  LiquidityChartProfileState,
} from "../profiles/types";
import { ChartSocket } from "../socket/ChartSocket";
import type {
  Bar,
  BigTradeMessage,
  LiquidityAction,
  LiquidityEventKind,
  LiquidityUpdateMessage,
  MarketExplorerSignal,
  MarketExplorerUpdateMessage,
  Timeframe,
} from "../socket/messages";
import {
  DEFAULT_HEATMAP_SETTINGS,
  heatmapLineEnd,
  heatmapLineVisible,
  knownLineSamples,
  liquidityHeatmapAlpha,
  liquidityHeatmapSegments,
  liquidityLiveProjection,
  mergeSizeSamples,
  normalizeHeatmapSettings,
  removeHeatmapSpeckles,
  type LiquidityHeatmapSettings,
  type LiquiditySizeSample,
} from "./heatmap";

const SYMBOL = "GC";
const CONTRACT = "GC";
const RETENTION_MS = 24 * 60 * 60 * 1_000;
const MIN_VISIBLE_BARS = 30;
const MAX_EVENTS = 20_000;
const MAX_MARKET_VOLUME_SAMPLES = 20_000;
const MAX_MARKET_VOLUME_SIGNALS = 2_000;
const MAX_BIG_TRADES = 500;
const BIG_TRADE_SOUND_COOLDOWN_MS = 250;
const LIQUIDITY_PROFILE_STORAGE_KEY = "gc-chart-platform.liquidity-chart";
const LIQUIDITY_PROFILE_SAVE_DELAY_MS = 1_200;
const PRICE_AXIS_WIDTH = 78;
const TIME_AXIS_HEIGHT = 28;
const MIN_PRICE_SCALE = 0.25;
const MAX_PRICE_SCALE = 12;
const MAX_FUTURE_SPACE_RATIO = 0.75;
const TTW_RELATIVE_BID_COLOR = "#c8ffc8";
const TTW_RELATIVE_ASK_COLOR = "#ff9696";
const TTW_RELATIVE_LABEL_FONT = "600 12px Segoe UI, sans-serif";
const TTW_VSPIKE_TICK_SIZE = 0.1;
const VWAP_COLOR = "#f5c542";
const GC_SESSION_OPEN_HOUR_CT = 17;
const DAY_MS = 24 * 60 * 60 * 1_000;
const CHICAGO_SESSION_CLOCK = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

type LiquidityTimeframe = Extract<Timeframe, "30s" | "1m" | "5m">;

function liquidityTimeframeMs(tf: LiquidityTimeframe): number {
  return tf === "30s" ? 30_000 : tf === "1m" ? 60_000 : 300_000;
}

function defaultLiquidityVisibleBars(tf: LiquidityTimeframe): number {
  return tf === "30s" ? 480 : tf === "1m" ? 240 : 144;
}

function maxLiquidityVisibleBars(tf: LiquidityTimeframe): number {
  return tf === "30s" ? 2_880 : tf === "1m" ? 1_440 : 288;
}

interface LiquidityEvent {
  sequence: number;
  time: number;
  eventKind: Exclude<LiquidityEventKind, "long_term">;
  action: LiquidityAction;
  side: "bid" | "ask";
  price: number;
  size: number;
  previousSize: number;
  change: number;
  threshold: number;
  domDistance: number | null;
  strength: number;
  lineId?: string;
  lineStartTime?: number | null;
}

interface LiquidityLine {
  lineId: string;
  side: "bid" | "ask";
  price: number;
  startedAt: number;
  lastAt: number;
  endedAt: number | null;
  currentSize: number;
  peakSize: number;
  threshold: number;
  domDistance: number | null;
  active: boolean;
  samples?: LiquiditySizeSample[];
}

interface LiquidityHistoryResponse {
  symbol: string;
  contract: string;
  tf: LiquidityTimeframe;
  from: number;
  to: number;
  retentionHours: number;
  events: LiquidityEvent[];
  lines: LiquidityLine[];
}

interface BigTradeHistoryResponse {
  symbol: string;
  contract: string;
  trades: Array<Pick<BigTradeMessage, "tradeId" | "time" | "price" | "volume" | "side">>;
}

interface Filters {
  longTerm: boolean;
  relative: boolean;
  absolute: boolean;
}

export interface LiquidityTrackerSettings {
  relativeEnabled: boolean;
  relativeTrigger: number;
  relativeDomFrom: number;
  relativeDomTo: number;
  absoluteEnabled: boolean;
  absoluteTrigger: number;
  absoluteDomFrom: number;
  absoluteDomTo: number;
  longTermEnabled: boolean;
  longTermTrigger: number;
  longTermDomFrom: number;
  longTermDomTo: number;
  longTermMinAgeSeconds: number;
}

interface LiquiditySettingsResponse {
  settings: LiquidityTrackerSettings;
  sentToBookmap?: boolean;
  historyCleared?: LiquidityEventKind[];
  historyRefiltered?: LiquidityEventKind[];
  historyDeleted?: {
    events: number;
    lines: number;
  };
}

type MarketExplorerDisplayMode = "standard" | "immediately";
type MarketExplorerMarkerShape = "arrow" | "triangle" | "circle" | "flag";
type MarketExplorerToggleMode = "disabled" | "enabled";

export interface MarketExplorerSignalSettings {
  enabled: boolean;
  askLevel: number;
  bidLevel: number;
  displayMode: MarketExplorerDisplayMode;
  pullbackDurationMinutes: number;
  pullbackPriceChangeTicks: number;
  buyColor: string;
  sellColor: string;
  markerShape: MarketExplorerMarkerShape;
  markerSize: number;
  variableSize: boolean;
  alertSound: boolean;
  bookmapAlertMessage: MarketExplorerToggleMode;
}

export interface VolumeSpikeSettings {
  enabled: boolean;
  triggerVolume: number;
  maximumDurationSeconds: number;
  priceRangeTicks: number;
  ratioGreaterEqual: number;
  buyColor: string;
  sellColor: string;
  markerShape: MarketExplorerMarkerShape;
  markerSize: number;
  variableSize: boolean;
  alertSound: boolean;
  bookmapAlertMessage: MarketExplorerToggleMode;
}

export interface AbsorptionSettings {
  enabled: boolean;
  triggerVolume: number;
  maximumDurationSeconds: number;
  buyColor: string;
  sellColor: string;
  markerShape: MarketExplorerMarkerShape;
  markerSize: number;
  variableSize: boolean;
  alertSound: boolean;
  bookmapAlertMessage: MarketExplorerToggleMode;
}

export interface MarketExplorerSettings {
  lineEnabled: boolean;
  halftimeSeconds: number;
  buyLineColor: string;
  sellLineColor: string;
  signal: MarketExplorerSignalSettings;
  volumeSpike: VolumeSpikeSettings;
  absorption: AbsorptionSettings;
}

interface MarketVolumeSample {
  time: number;
  value: number;
  buyVolume: number;
  sellVolume: number;
  price: number;
}

interface MarketExplorerHistoryResponse {
  symbol: string;
  contract: string;
  samples: MarketVolumeSample[];
  signals: MarketExplorerSignal[];
}

interface MarketExplorerSettingsResponse {
  settings: MarketExplorerSettings;
}

const DEFAULT_TRACKER_SETTINGS: LiquidityTrackerSettings = {
  relativeEnabled: true,
  relativeTrigger: 50,
  relativeDomFrom: 20,
  relativeDomTo: 100,
  absoluteEnabled: true,
  absoluteTrigger: 500,
  absoluteDomFrom: 1,
  absoluteDomTo: 10,
  longTermEnabled: true,
  longTermTrigger: 500,
  longTermDomFrom: 1,
  longTermDomTo: 80,
  longTermMinAgeSeconds: 4 * 60 * 60,
};

const DEFAULT_FILTERS: Filters = {
  longTerm: true,
  relative: true,
  absolute: true,
};

function normalizeLiquidityBigTradeSettings(input: unknown): BigTradeSettings {
  const source = input !== null && typeof input === "object"
    ? input as Partial<BigTradeSettings>
    : {};
  const sessionMinVolumes = normalizeBigTradeSessionMinVolumes(source);
  return {
    minVolume: Math.min(
      sessionMinVolumes.asia,
      sessionMinVolumes.eu,
      sessionMinVolumes.us,
    ),
    maxVisible: normalizeBigTradeMaxVisible(source.maxVisible),
    soundEnabled: source.soundEnabled === true,
    sessionMinVolumes,
  };
}

function finiteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeLiquidityChartProfileState(
  input: unknown,
  sharedProfile: Partial<Pick<
    ChartProfilePayload,
    "showBigTrades" | "bigTradeSettings"
  >> = {},
): LiquidityChartProfileState {
  const source = input !== null && typeof input === "object"
    ? input as Partial<LiquidityChartProfileState>
    : {};
  const tf: LiquidityTimeframe =
    source.timeframe === "30s" || source.timeframe === "5m"
      ? source.timeframe
      : "1m";
  const filterSource = source.filters ?? DEFAULT_FILTERS;
  const defaultVisibleBars = defaultLiquidityVisibleBars(tf);
  return {
    version: 1,
    heatmap: normalizeHeatmapSettings(source.heatmap),
    timeframe: tf,
    visibleBars: clamp(
      Math.round(finiteNumber(source.visibleBars, defaultVisibleBars)),
      MIN_VISIBLE_BARS,
      maxLiquidityVisibleBars(tf),
    ),
    offsetBars: Math.round(finiteNumber(source.offsetBars, 0)),
    priceScale: clamp(
      finiteNumber(source.priceScale, 1),
      MIN_PRICE_SCALE,
      MAX_PRICE_SCALE,
    ),
    pricePanPx: finiteNumber(source.pricePanPx, 0),
    filters: {
      longTerm: filterSource.longTerm !== false,
      relative: filterSource.relative !== false,
      absolute: filterSource.absolute !== false,
    },
    showVwap: source.showVwap !== false,
    showBigTrades:
      sharedProfile.showBigTrades ?? source.showBigTrades ?? true,
    bigTradeSettings: normalizeLiquidityBigTradeSettings(
      sharedProfile.bigTradeSettings ?? source.bigTradeSettings,
    ),
  };
}

function readLocalLiquidityProfile(): LiquidityChartProfileState | undefined {
  try {
    const raw = window.localStorage.getItem(LIQUIDITY_PROFILE_STORAGE_KEY);
    return raw ? normalizeLiquidityChartProfileState(JSON.parse(raw)) : undefined;
  } catch {
    return undefined;
  }
}

function persistLocalLiquidityProfile(state: LiquidityChartProfileState): void {
  try {
    window.localStorage.setItem(LIQUIDITY_PROFILE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Server profile persistence remains available when storage is restricted. */
  }
}

const DEFAULT_MARKET_EXPLORER_SIGNAL: MarketExplorerSignalSettings = {
  enabled: true,
  askLevel: 500,
  bidLevel: 500,
  displayMode: "standard",
  pullbackDurationMinutes: 0,
  pullbackPriceChangeTicks: 0,
  buyColor: "#ef4048",
  sellColor: "#edf2f4",
  markerShape: "triangle",
  markerSize: 2,
  variableSize: false,
  alertSound: false,
  bookmapAlertMessage: "disabled",
};

const DEFAULT_VOLUME_SPIKE: VolumeSpikeSettings = {
  enabled: true,
  triggerVolume: 800,
  maximumDurationSeconds: 1,
  priceRangeTicks: 8,
  ratioGreaterEqual: 10,
  buyColor: "#20bea6",
  sellColor: "#ef4050",
  markerShape: "triangle",
  markerSize: 2,
  variableSize: false,
  alertSound: false,
  bookmapAlertMessage: "disabled",
};

const DEFAULT_ABSORPTION: AbsorptionSettings = {
  enabled: true,
  triggerVolume: 1000,
  maximumDurationSeconds: 1,
  buyColor: "#ef4050",
  sellColor: "#51bea2",
  markerShape: "flag",
  markerSize: 2,
  variableSize: false,
  alertSound: false,
  bookmapAlertMessage: "disabled",
};

const DEFAULT_MARKET_EXPLORER_SETTINGS: MarketExplorerSettings = {
  lineEnabled: true,
  halftimeSeconds: 60,
  buyLineColor: "#20bea6",
  sellLineColor: "#ef4050",
  signal: { ...DEFAULT_MARKET_EXPLORER_SIGNAL },
  volumeSpike: { ...DEFAULT_VOLUME_SPIKE },
  absorption: { ...DEFAULT_ABSORPTION },
};

function cloneMarketExplorerSettings(
  source = DEFAULT_MARKET_EXPLORER_SETTINGS,
): MarketExplorerSettings {
  return {
    ...source,
    signal: { ...source.signal },
    volumeSpike: { ...source.volumeSpike },
    absorption: { ...source.absorption },
  };
}

type NumericTrackerSetting = {
  [Key in keyof LiquidityTrackerSettings]: LiquidityTrackerSettings[Key] extends number
    ? Key
    : never;
}[keyof LiquidityTrackerSettings];

interface CanvasSize {
  width: number;
  height: number;
}

type DragState =
  | {
      mode: "pan";
      pointerId: number;
      startX: number;
      startY: number;
      startOffset: number;
      startPricePanPx: number;
    }
  | {
      mode: "scale-time";
      pointerId: number;
      startX: number;
      startVisibleBars: number;
    }
  | {
      mode: "scale-price";
      pointerId: number;
      startY: number;
      startPriceScale: number;
    };

type InteractionMode = "idle" | DragState["mode"];

interface HoverPoint {
  x: number;
  y: number;
}

export interface SessionVwapPoint {
  time: number;
  value: number;
  sessionKey: string;
}

export function gcSessionKey(time: number): string {
  const parts = CHICAGO_SESSION_CLOCK.formatToParts(new Date(time));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const year = value("year");
  const month = value("month");
  const day = value("day");
  const hour = value("hour") % 24;
  const localDate = Date.UTC(year, month - 1, day) -
    (hour < GC_SESSION_OPEN_HOUR_CT ? DAY_MS : 0);
  const sessionDate = new Date(localDate);
  return [
    sessionDate.getUTCFullYear(),
    String(sessionDate.getUTCMonth() + 1).padStart(2, "0"),
    String(sessionDate.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function sessionVwapPoints(bars: readonly Bar[]): SessionVwapPoint[] {
  const points: SessionVwapPoint[] = [];
  let activeSession = "";
  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;
  for (const bar of bars) {
    const sessionKey = gcSessionKey(bar.time);
    if (sessionKey !== activeSession) {
      activeSession = sessionKey;
      cumulativePriceVolume = 0;
      cumulativeVolume = 0;
    }
    const volume = Math.max(0, Number(bar.volume));
    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    if (Number.isFinite(volume) && volume > 0 && Number.isFinite(typicalPrice)) {
      cumulativePriceVolume += typicalPrice * volume;
      cumulativeVolume += volume;
    }
    if (cumulativeVolume > 0) {
      points.push({
        time: bar.time,
        value: cumulativePriceVolume / cumulativeVolume,
        sessionKey,
      });
    }
  }
  return points;
}

export function LiquidityPage() {
  const endpoints = useMemo(() => resolveEndpoints(), []);
  const api = useMemo(() => new ApiClient({ basePath: endpoints.api }), [endpoints.api]);
  const socket = useMemo(() => new ChartSocket({ url: endpoints.ws }), [endpoints.ws]);
  const requestSequence = useRef(0);
  const [tf, setTf] = useState<LiquidityTimeframe>("1m");
  const [bars, setBars] = useState<Bar[]>([]);
  const [events, setEvents] = useState<LiquidityEvent[]>([]);
  const [lines, setLines] = useState<Map<string, LiquidityLine>>(new Map());
  const [marketVolumeSamples, setMarketVolumeSamples] = useState<MarketVolumeSample[]>([]);
  const [marketVolumeSignals, setMarketVolumeSignals] = useState<MarketExplorerSignal[]>([]);
  const [bigTrades, setBigTrades] = useState<readonly BigTradeMarker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<"connected" | "disconnected">(
    "disconnected",
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [visibleBars, setVisibleBars] = useState(240);
  const [offsetBars, setOffsetBars] = useState(0);
  const [priceScale, setPriceScale] = useState(1);
  const [pricePanPx, setPricePanPx] = useState(0);
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS });
  const [heatmapSettings, setHeatmapSettings] = useState<LiquidityHeatmapSettings>(DEFAULT_HEATMAP_SETTINGS);
  const [heatmapDraft, setHeatmapDraft] = useState<LiquidityHeatmapSettings>(DEFAULT_HEATMAP_SETTINGS);
  const [showVwap, setShowVwap] = useState(true);
  const [showBigTrades, setShowBigTrades] = useState(true);
  const showBigTradesRef = useRef(showBigTrades);
  const [bigTradeSettings, setBigTradeSettings] = useState<BigTradeSettings>(() =>
    normalizeLiquidityBigTradeSettings(DEFAULT_BIG_TRADE_SETTINGS)
  );
  const [bigTradeDraft, setBigTradeDraft] = useState<BigTradeSettings>(() =>
    normalizeLiquidityBigTradeSettings(DEFAULT_BIG_TRADE_SETTINGS)
  );
  const bigTradeSettingsRef = useRef(bigTradeSettings);
  const lastBigTradeSoundAtRef = useRef(0);
  const [profileHydrated, setProfileHydrated] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const [trackerSettings, setTrackerSettings] = useState<LiquidityTrackerSettings>(
    DEFAULT_TRACKER_SETTINGS,
  );
  const trackerSettingsRef = useRef(trackerSettings);
  const [settingsDraft, setSettingsDraft] = useState<LiquidityTrackerSettings>(
    DEFAULT_TRACKER_SETTINGS,
  );
  const [marketExplorerSettings, setMarketExplorerSettings] =
    useState<MarketExplorerSettings>(() => cloneMarketExplorerSettings());
  const [marketExplorerDraft, setMarketExplorerDraft] =
    useState<MarketExplorerSettings>(() => cloneMarketExplorerSettings());
  const marketExplorerSettingsRef = useRef(marketExplorerSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);
  const [marketExplorerToast, setMarketExplorerToast] = useState<string | null>(null);

  useEffect(() => {
    trackerSettingsRef.current = trackerSettings;
  }, [trackerSettings]);

  useEffect(() => {
    bigTradeSettingsRef.current = bigTradeSettings;
  }, [bigTradeSettings]);

  useEffect(() => {
    showBigTradesRef.current = showBigTrades;
  }, [showBigTrades]);

  useEffect(() => {
    marketExplorerSettingsRef.current = marketExplorerSettings;
  }, [marketExplorerSettings]);

  useEffect(() => {
    let cancelled = false;
    const localState = readLocalLiquidityProfile();
    void api
      .meProfile()
      .then((profile) => {
        if (cancelled) return;
        const payload = profile.payload;
        const state = normalizeLiquidityChartProfileState(
          payload.liquidityChart,
          payload,
        );
        setTf(state.timeframe);
        setVisibleBars(state.visibleBars);
        setOffsetBars(state.offsetBars);
        setPriceScale(state.priceScale);
        setPricePanPx(state.pricePanPx);
        setFilters({ ...state.filters });
        setHeatmapSettings(normalizeHeatmapSettings(state.heatmap));
        setShowVwap(state.showVwap);
        setShowBigTrades(state.showBigTrades);
        setBigTradeSettings(state.bigTradeSettings);
        setBigTradeDraft(state.bigTradeSettings);
      })
      .catch(() => {
        if (cancelled || localState === undefined) return;
        setTf(localState.timeframe);
        setVisibleBars(localState.visibleBars);
        setOffsetBars(localState.offsetBars);
        setPriceScale(localState.priceScale);
        setPricePanPx(localState.pricePanPx);
        setFilters({ ...localState.filters });
        setHeatmapSettings(normalizeHeatmapSettings(localState.heatmap));
        setShowVwap(localState.showVwap);
        setShowBigTrades(localState.showBigTrades);
        setBigTradeSettings(localState.bigTradeSettings);
        setBigTradeDraft(localState.bigTradeSettings);
      })
      .finally(() => {
        if (!cancelled) setProfileHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const liquidityProfileState = useMemo<LiquidityChartProfileState>(
    () => ({
      version: 1,
      heatmap: heatmapSettings,
      timeframe: tf,
      visibleBars,
      offsetBars,
      priceScale,
      pricePanPx,
      filters: { ...filters },
      showVwap,
      showBigTrades,
      bigTradeSettings: {
        ...bigTradeSettings,
        sessionMinVolumes: {
          ...normalizeBigTradeSessionMinVolumes(bigTradeSettings),
        },
      },
    }),
    [
      bigTradeSettings,
      filters,
      heatmapSettings,
      offsetBars,
      pricePanPx,
      priceScale,
      showBigTrades,
      showVwap,
      tf,
      visibleBars,
    ],
  );

  useEffect(() => {
    if (!profileHydrated) return;
    persistLocalLiquidityProfile(liquidityProfileState);
    const timer = window.setTimeout(() => {
      void api.saveMeLiquidityChart(liquidityProfileState).catch(() => {
        /* Guests and temporarily offline users keep the local snapshot. */
      });
    }, LIQUIDITY_PROFILE_SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [api, liquidityProfileState, profileHydrated]);

  useEffect(() => {
    if (marketExplorerToast === null) return;
    const timer = window.setTimeout(() => setMarketExplorerToast(null), 5_000);
    return () => window.clearTimeout(timer);
  }, [marketExplorerToast]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const cutoff = clock - RETENTION_MS;
    setLines((current) => {
      let changed = false;
      const next = new Map<string, LiquidityLine>();
      for (const line of current.values()) {
        if ((line.endedAt ?? line.lastAt) < cutoff) {
          changed = true;
          continue;
        }
        const samples = line.samples;
        const firstRetained = samples?.findIndex((sample) => sample.time >= cutoff) ?? -1;
        if (samples && firstRetained > 1) {
          changed = true;
          next.set(line.lineId, { ...line, samples: samples.slice(firstRetained - 1) });
        } else {
          next.set(line.lineId, line);
        }
      }
      return changed ? next : current;
    });
  }, [clock]);

  useEffect(() => {
    const offOpen = socket.onOpen(() => setConnection("connected"));
    const offClose = socket.onClose(() => setConnection("disconnected"));
    socket.connect();
    const reconnectTimer = window.setInterval(() => socket.ensureConnected(), 5_000);
    return () => {
      window.clearInterval(reconnectTimer);
      offOpen();
      offClose();
      socket.close(1000, "liquidity page unmount");
    };
  }, [socket]);

  useEffect(() => {
    socket.subscribe(SYMBOL, ["bar_update"], tf);
    socket.subscribe(SYMBOL, ["liquidity_update"]);
    socket.subscribe(SYMBOL, ["market_explorer_update"]);
    socket.subscribe(SYMBOL, ["big_trade"]);
    const offBar = socket.on("bar_update", (message) => {
      if (message.symbol !== SYMBOL || message.contract !== CONTRACT || message.tf !== tf) {
        return;
      }
      setBars((current) => mergeBars(current, [message.bar], Date.now() - RETENTION_MS));
    });
    const offLiquidity = socket.on("liquidity_update", (message) => {
      if (message.symbol !== SYMBOL || message.contract !== CONTRACT) return;
      if (message.eventKind === "relative" && message.lineId) return;
      if (message.eventKind === "long_term") {
        setLines((current) => mergeLiveLine(current, message));
      } else {
        const next = toMarker(message);
        setEvents((current) => mergeEvents(current, [next], Date.now() - RETENTION_MS));
        if (
          message.eventKind === "long_term_touch" &&
          longTermTouchMatchesSettings(message, trackerSettingsRef.current)
        ) {
          playLongTermLiquidityTouchTone(message.side);
        }
      }
    });
    const offMarketExplorer = socket.on("market_explorer_update", (message) => {
      if (message.symbol !== SYMBOL || message.contract !== CONTRACT) return;
      const cutoff = Date.now() - RETENTION_MS;
      setMarketVolumeSamples((current) =>
        mergeMarketVolumeSamples(current, [marketVolumeSampleFromUpdate(message)], cutoff),
      );
      if (message.signals.length > 0) {
        setMarketVolumeSignals((current) =>
          mergeMarketVolumeSignals(current, message.signals, cutoff),
        );
        notifyMarketVolumeSignals(
          message.signals,
          marketExplorerSettingsRef.current,
          setMarketExplorerToast,
        );
      }
    });
    const offBigTrade = socket.on("big_trade", (message) => {
      if (message.symbol !== SYMBOL || message.contract !== CONTRACT) return;
      setBigTrades((current) =>
        reduceBigTradesCapped(current, [message], MAX_BIG_TRADES),
      );
      const settings = bigTradeSettingsRef.current;
      const now = Date.now();
      if (
        showBigTradesRef.current &&
        settings.soundEnabled === true &&
        message.volume >= bigTradeMinVolumeForTime(message.time, settings) &&
        now - lastBigTradeSoundAtRef.current >= BIG_TRADE_SOUND_COOLDOWN_MS
      ) {
        lastBigTradeSoundAtRef.current = now;
        playBigTradeSound();
      }
    });
    return () => {
      offBar();
      offLiquidity();
      offMarketExplorer();
      offBigTrade();
      socket.unsubscribe(SYMBOL, ["bar_update"], tf);
      socket.unsubscribe(SYMBOL, ["liquidity_update"]);
      socket.unsubscribe(SYMBOL, ["market_explorer_update"]);
      socket.unsubscribe(SYMBOL, ["big_trade"]);
    };
  }, [socket, tf]);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    const to = Date.now();
    const from = to - RETENTION_MS;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const historyUrl = buildHistoryUrl(
      { symbol: SYMBOL, contract: CONTRACT, timeframe: tf, from, to, limit: 2_000 },
      endpoints.api,
    );
    const liquidityParams = new URLSearchParams({
      symbol: SYMBOL,
      contract: CONTRACT,
      tf,
      from: String(from),
      to: String(to),
      limit: String(MAX_EVENTS),
    });
    const marketExplorerParams = new URLSearchParams({
      symbol: SYMBOL,
      contract: CONTRACT,
      from: String(from),
      to: String(to),
      limit: String(MAX_MARKET_VOLUME_SAMPLES),
    });
    const bigTradeParams = new URLSearchParams({
      symbol: SYMBOL,
      contract: CONTRACT,
      from: String(from),
      to: String(to),
      limit: String(MAX_BIG_TRADES),
      cacheOnly: "true",
    });

    Promise.all([
      fetch(historyUrl, { signal: controller.signal }).then(readJson<HistoryResponse>),
      fetch(`${endpoints.api}/liquidity?${liquidityParams}`, {
        signal: controller.signal,
      }).then(readJson<LiquidityHistoryResponse>),
      fetch(`${endpoints.api}/market-explorer?${marketExplorerParams}`, {
        signal: controller.signal,
      }).then(readJson<MarketExplorerHistoryResponse>),
      fetch(`${endpoints.api}/big-trades?${bigTradeParams}`, {
        signal: controller.signal,
      })
        .then(readJson<BigTradeHistoryResponse>)
        .catch((): BigTradeHistoryResponse => ({
          symbol: SYMBOL,
          contract: CONTRACT,
          trades: [],
        })),
    ])
      .then(([history, liquidity, marketExplorer, bigTradeHistory]) => {
        if (sequence !== requestSequence.current) return;
        const timeframeMs = liquidityTimeframeMs(tf);
        const liveBucketTime = to - to % timeframeMs;
        setBars((current) =>
          mergeHistoryBars(history.bars, current, from, liveBucketTime)
        );
        setEvents((current) => mergeEvents(liquidity.events, current, from));
        setLines((current) => mergeHistoryLines(liquidity.lines, current));
        setMarketVolumeSamples((current) =>
          mergeMarketVolumeSamples(marketExplorer.samples, current, from),
        );
        setMarketVolumeSignals((current) =>
          mergeMarketVolumeSignals(marketExplorer.signals, current, from),
        );
        setBigTrades((current) =>
          mergeLiquidityBigTrades(bigTradeHistory.trades, current, from),
        );
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted || sequence !== requestSequence.current) return;
        setError(cause instanceof Error ? cause.message : "Liquidity data load failed");
      })
      .finally(() => {
        if (sequence === requestSequence.current) setLoading(false);
      });

    return () => controller.abort();
  }, [endpoints.api, reloadKey, tf]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch(`${endpoints.api}/liquidity/settings`, { signal: controller.signal }).then(
        readJson<LiquiditySettingsResponse>,
      ),
      fetch(`${endpoints.api}/market-explorer/settings`, {
        signal: controller.signal,
      }).then(readJson<MarketExplorerSettingsResponse>),
    ])
      .then(([liquidity, marketExplorer]) => {
        setTrackerSettings(liquidity.settings);
        setSettingsDraft(liquidity.settings);
        setMarketExplorerSettings(marketExplorer.settings);
        setMarketExplorerDraft(cloneMarketExplorerSettings(marketExplorer.settings));
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setSettingsError(
            cause instanceof Error ? cause.message : "Liquidity settings load failed",
          );
        }
      });
    return () => controller.abort();
  }, [endpoints.api]);

  const selectTimeframe = (next: LiquidityTimeframe) => {
    setTf(next);
    setVisibleBars(defaultLiquidityVisibleBars(next));
    setOffsetBars(0);
    setPriceScale(1);
    setPricePanPx(0);
  };

  const configuredEvents = events.filter((event) =>
    liquidityEventMatchesSettings(event, trackerSettings)
  );
  const configuredLines = [...lines.values()].filter((line) =>
    liquidityLineMatchesSettings(line, trackerSettings, clock)
  );
  const maxVisible = maxLiquidityVisibleBars(tf);
  const zoom = useCallback(
    (factor: number) => {
      setVisibleBars((current) =>
        clamp(Math.round(current * factor), MIN_VISIBLE_BARS, maxVisible),
      );
    },
    [maxVisible],
  );

  const openSettings = () => {
    setHeatmapDraft({ ...heatmapSettings });
    setSettingsDraft({ ...trackerSettings });
    setMarketExplorerDraft(cloneMarketExplorerSettings(marketExplorerSettings));
    setBigTradeDraft(normalizeLiquidityBigTradeSettings(bigTradeSettings));
    setSettingsError(null);
    setSettingsNotice(null);
    setSettingsOpen(true);
  };
  const updateSettingNumber = (field: NumericTrackerSetting, value: number) => {
    if (!Number.isFinite(value)) return;
    setSettingsDraft((current) => ({ ...current, [field]: Math.round(value) }));
  };
  const updateMarketExplorerSignal = (patch: Partial<MarketExplorerSignalSettings>) => {
    setMarketExplorerDraft((current) => ({
      ...current,
      signal: { ...current.signal, ...patch },
    }));
  };
  const updateBigTradeSessionVolume = (
    session: BigTradeSession,
    value: number,
  ) => {
    if (!Number.isFinite(value)) return;
    setBigTradeDraft((current) => {
      const sessionMinVolumes = {
        ...normalizeBigTradeSessionMinVolumes(current),
        [session]: Math.round(value),
      };
      return {
        ...current,
        minVolume: Math.min(
          sessionMinVolumes.asia,
          sessionMinVolumes.eu,
          sessionMinVolumes.us,
        ),
        sessionMinVolumes,
      };
    });
  };
  const saveSettings = async () => {
    const validationError =
      validateLiquidityTrackerSettings(settingsDraft) ??
      validateMarketExplorerSettings(marketExplorerDraft) ??
      validateBigTradeSettings(bigTradeDraft);
    if (validationError) {
      setSettingsError(validationError);
      return;
    }
    setSettingsSaving(true);
    setSettingsError(null);
    try {
      const [liquidityPayload, marketExplorerPayload] = await Promise.all([
        fetch(`${endpoints.api}/liquidity/settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settingsDraft),
        }).then(readJson<LiquiditySettingsResponse>),
        fetch(`${endpoints.api}/market-explorer/settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(marketExplorerDraft),
        }).then(readJson<MarketExplorerSettingsResponse>),
      ]);
      const refilteredKinds = new Set(
        liquidityPayload.historyRefiltered ??
          liquidityPayload.historyCleared ??
          liquidityHistoryKindsChanged(trackerSettings, liquidityPayload.settings),
      );
      setTrackerSettings(liquidityPayload.settings);
      setSettingsDraft(liquidityPayload.settings);
      if (refilteredKinds.size > 0) setReloadKey((current) => current + 1);
      setMarketExplorerSettings(marketExplorerPayload.settings);
      setMarketExplorerDraft(cloneMarketExplorerSettings(marketExplorerPayload.settings));
      const nextBigTradeSettings = normalizeLiquidityBigTradeSettings(bigTradeDraft);
      setHeatmapSettings(normalizeHeatmapSettings(heatmapDraft));
      setBigTradeSettings(nextBigTradeSettings);
      setBigTradeDraft(nextBigTradeSettings);
      setSettingsNotice(
        liquidityPayload.sentToBookmap
          ? "Saved detectors and BigTrade profile settings"
          : "Saved Rithmic detectors + BigTrade profile; Bookmap will sync on reconnect",
      );
    } catch (cause) {
      setSettingsError(cause instanceof Error ? cause.message : "Save failed");
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <div className="liquidity-page">
      <header className="liquidity-toolbar">
        <nav className="liquidity-nav" aria-label="Chart pages">
          <a href="/">Chart</a>
          <a href="/fp">FP</a>
          <a href="/mp">MP</a>
        </nav>
        <div className="liquidity-title">
          <span>GC Liquidity + Market Explorer</span>
          <span>Liquidity Heatmap + MV Stop, Volume Spike and Absorption</span>
        </div>
        <div className="liquidity-segmented" aria-label="Timeframe">
          {(["30s", "1m", "5m"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={tf === value}
              onClick={() => selectTimeframe(value)}
            >
              {value.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="liquidity-filters" aria-label="Liquidity layers">
          <FilterToggle
            label="Heatmap"
            checked={filters.longTerm}
            onChange={(checked) => setFilters((value) => ({ ...value, longTerm: checked }))}
          />
          <FilterToggle
            label="Relative"
            checked={filters.relative}
            onChange={(checked) => setFilters((value) => ({ ...value, relative: checked }))}
          />
          <FilterToggle
            label="Absolute"
            checked={filters.absolute}
            onChange={(checked) => setFilters((value) => ({ ...value, absolute: checked }))}
          />
          <FilterToggle
            label="VWAP"
            checked={showVwap}
            onChange={setShowVwap}
          />
          <FilterToggle
            label="BigTrade"
            checked={showBigTrades}
            onChange={setShowBigTrades}
          />
        </div>
        <div className="liquidity-actions">
          <button type="button" title="Zoom out" onClick={() => zoom(1.25)}>−</button>
          <button type="button" title="Zoom in" onClick={() => zoom(0.8)}>+</button>
          <button type="button" onClick={() => setOffsetBars(0)}>Latest</button>
          <button type="button" onClick={openSettings}>Settings</button>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)}>
            Reload
          </button>
        </div>
        <div className={`liquidity-connection is-${connection}`}>
          <span aria-hidden="true" />
          {loading ? "Loading" : error ?? connection}
        </div>
      </header>

      {settingsOpen ? (
        <div
          className="liquidity-settings-backdrop"
          role="presentation"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setSettingsOpen(false);
          }}
        >
          <section
            className="liquidity-settings-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Liquidity tracker settings"
          >
            <header>
              <div>
                <strong>Liquidity + Market Explorer Settings</strong>
                <span>Applied to active Bookmap/Rithmic depth and aggressor trades</span>
              </div>
              <button type="button" onClick={() => setSettingsOpen(false)} aria-label="Close settings">
                ×
              </button>
            </header>

            <div className="liquidity-settings-groups">
              <fieldset className="liquidity-settings-group">
                <legend>Liquidity Heatmap</legend>
                <div className="liquidity-settings-fields">
                  <SettingNumber
                    label="Minimum lifetime (seconds)"
                    disabled={false}
                    help="Hide liquidity that disappears before this age. Default 60 seconds removes brief flashes; 0 disables the age filter. Tiny lines under 3 pixels are also hidden."
                    value={heatmapDraft.minDurationSeconds}
                    min={0} max={600}
                    onChange={(value) => setHeatmapDraft((current) => normalizeHeatmapSettings({ ...current, minDurationSeconds: value }))}
                  />
                  <SettingNumber
                    label="Full intensity (x trigger)"
                    disabled={false}
                    help="Size reaching this multiple of the line trigger gets the strongest color. Added size brightens only the new segment; reduced size dims it."
                    value={heatmapDraft.saturationMultiple}
                    min={2} max={20}
                    onChange={(value) => setHeatmapDraft((current) => normalizeHeatmapSettings({ ...current, saturationMultiple: value }))}
                  />
                  <SettingNumber
                    label="Contrast"
                    disabled={false}
                    help="Higher values dim smaller levels more strongly. Color uses a stable volume scale across timeframes and zoom levels."
                    value={heatmapDraft.contrast}
                    min={0.3} max={3} step={0.1}
                    onChange={(value) => setHeatmapDraft((current) => normalizeHeatmapSettings({ ...current, contrast: value }))}
                  />
                </div>
              </fieldset>
              <LiquiditySettingsGroup
                title="Relative Liquidity Change"
                help="So sánh size hiện tại với lần cập nhật trước tại cùng mức giá để đánh dấu thanh khoản được thêm hoặc rút. Khi giá giao dịch đúng tại một Short/Long-term line rồi line biến mất, phần size bị rút cũng hiện bằng marker Relative âm."
                enableHelp="Tắt mục này sẽ ngừng tạo marker Relative mới. Marker cũ trong lịch sử 24 giờ vẫn được giữ lại."
                enabled={settingsDraft.relativeEnabled}
                onEnabledChange={(relativeEnabled) =>
                  setSettingsDraft((current) => ({ ...current, relativeEnabled }))
                }
              >
                <SettingNumber
                  label="Trigger liquidity"
                  help="Độ thay đổi tối thiểu của size tại một mức giá. TTW GC gốc dùng 50 contracts; marker hiển thị chênh lệch có dấu, ví dụ +50 hoặc -50. Giảm ngưỡng sẽ nhạy hơn nhưng nhiều nhiễu hơn."
                  value={settingsDraft.relativeTrigger}
                  min={1}
                  max={1_000_000}
                  disabled={!settingsDraft.relativeEnabled}
                  onChange={(value) => updateSettingNumber("relativeTrigger", value)}
                />
                <SettingNumber
                  label="DOM level from"
                  help="Khoảng cách gần nhất tính từ best bid hoặc best ask. Mức 0 là giá mua/bán tốt nhất; mức 20 bắt đầu theo dõi từ vị trí cách thị trường 20 ticks."
                  value={settingsDraft.relativeDomFrom}
                  min={0}
                  max={5_000}
                  disabled={!settingsDraft.relativeEnabled}
                  onChange={(value) => updateSettingNumber("relativeDomFrom", value)}
                />
                <SettingNumber
                  label="DOM level to"
                  help="Khoảng cách xa nhất được theo dõi. Chỉ các mức DOM từ From đến To mới tạo tín hiệu. Tăng giá trị sẽ quét sâu hơn nhưng có thể thu thêm thanh khoản ít liên quan đến timing hiện tại."
                  value={settingsDraft.relativeDomTo}
                  min={0}
                  max={5_000}
                  disabled={!settingsDraft.relativeEnabled}
                  onChange={(value) => updateSettingNumber("relativeDomTo", value)}
                />
              </LiquiditySettingsGroup>

              <LiquiditySettingsGroup
                title="Absolute Liquidity Change"
                help="Theo dõi tổng size đang nằm tại mỗi mức giá và báo khi size vượt qua một ngưỡng tuyệt đối, không phụ thuộc mức thay đổi của lần cập nhật."
                enableHelp="Tắt mục này sẽ ngừng tạo marker Absolute mới. Dữ liệu đã ghi trong lịch sử 24 giờ không bị xóa."
                enabled={settingsDraft.absoluteEnabled}
                onEnabledChange={(absoluteEnabled) =>
                  setSettingsDraft((current) => ({ ...current, absoluteEnabled }))
                }
              >
                <SettingNumber
                  label="Trigger liquidity"
                  help="Tổng size tối thiểu tại một mức giá để tạo tín hiệu Absolute. Ví dụ 500 nghĩa là tín hiệu xuất hiện khi size đi từ dưới 500 lên 500 contracts hoặc cao hơn. Tín hiệu được tái kích hoạt sau khi size giảm xuống dưới khoảng 90% ngưỡng."
                  value={settingsDraft.absoluteTrigger}
                  min={1}
                  max={1_000_000}
                  disabled={!settingsDraft.absoluteEnabled}
                  onChange={(value) => updateSettingNumber("absoluteTrigger", value)}
                />
                <SettingNumber
                  label="DOM level from"
                  help="Mức DOM gần nhất được kiểm tra, tính từ best bid/best ask. Mức 0 là giá tốt nhất; đặt 1 sẽ bỏ qua chính best bid và best ask."
                  value={settingsDraft.absoluteDomFrom}
                  min={0}
                  max={5_000}
                  disabled={!settingsDraft.absoluteEnabled}
                  onChange={(value) => updateSettingNumber("absoluteDomFrom", value)}
                />
                <SettingNumber
                  label="DOM level to"
                  help="Mức DOM xa nhất được kiểm tra. Khoảng nhỏ tập trung gần giá hiện tại; khoảng lớn nhìn sâu hơn vào order book nhưng thường có nhiều lệnh xa giá."
                  value={settingsDraft.absoluteDomTo}
                  min={0}
                  max={5_000}
                  disabled={!settingsDraft.absoluteEnabled}
                  onChange={(value) => updateSettingNumber("absoluteDomTo", value)}
                />
              </LiquiditySettingsGroup>

              <LiquiditySettingsGroup
                title="Long-term Liquidity Lines"
                help="Liquidity line vẫn hiển thị ngay khi đạt ngưỡng như trước. Hệ thống theo dõi tuổi ngầm; chỉ line tồn tại liên tục đủ thời gian cấu hình mới hiện label Long-term và phát âm báo khi giá khớp vào dải."
                enableHelp="Tắt mục này sẽ ngừng theo dõi và tạo liquidity line mới. Các line đang hoạt động sẽ được kết thúc khi cấu hình được áp dụng."
                enabled={settingsDraft.longTermEnabled}
                onEnabledChange={(longTermEnabled) =>
                  setSettingsDraft((current) => ({ ...current, longTermEnabled }))
                }
              >
                <SettingNumber
                  label="Trigger liquidity"
                  help="Size tối thiểu để một mức giá bắt đầu tạo liquidity line. Cách hiển thị line không đổi; tuổi line chỉ quyết định label Long-term và âm báo."
                  value={settingsDraft.longTermTrigger}
                  min={1}
                  max={1_000_000}
                  disabled={!settingsDraft.longTermEnabled}
                  onChange={(value) => updateSettingNumber("longTermTrigger", value)}
                />
                <SettingNumber
                  label="DOM level from"
                  help="Khoảng cách gần nhất từ best bid/best ask mà liquidity-line tracker bắt đầu quan sát. Mức 0 bao gồm giá tốt nhất hiện tại."
                  value={settingsDraft.longTermDomFrom}
                  min={0}
                  max={5_000}
                  disabled={!settingsDraft.longTermEnabled}
                  onChange={(value) => updateSettingNumber("longTermDomFrom", value)}
                />
                <SettingNumber
                  label="DOM level to"
                  help="Khoảng cách xa nhất từ best bid/best ask mà liquidity-line tracker quan sát. Chỉ các mức nằm trong khoảng From–To mới có thể tạo đường."
                  value={settingsDraft.longTermDomTo}
                  min={0}
                  max={5_000}
                  disabled={!settingsDraft.longTermEnabled}
                  onChange={(value) => updateSettingNumber("longTermDomTo", value)}
                />
                <SettingNumber
                  label="Long-term after (hours)"
                  help="Số giờ line phải tồn tại liên tục trước khi được gọi là Long-term. Mặc định 4 giờ. Nếu size giảm dưới khoảng 90% ngưỡng, line kết thúc và lần xuất hiện sau sẽ tính tuổi lại từ đầu."
                  value={settingsDraft.longTermMinAgeSeconds / 3_600}
                  min={0.25}
                  max={24}
                  step={0.25}
                  disabled={!settingsDraft.longTermEnabled}
                  onChange={(value) =>
                    updateSettingNumber("longTermMinAgeSeconds", value * 3_600)
                  }
                />
              </LiquiditySettingsGroup>
              <MarketExplorerSettingsEditor
                settings={marketExplorerDraft}
                onLineChange={(patch) =>
                  setMarketExplorerDraft((current) => ({ ...current, ...patch }))
                }
                onSignalChange={updateMarketExplorerSignal}
                onVolumeSpikeChange={(patch) =>
                  setMarketExplorerDraft((current) => ({
                    ...current,
                    volumeSpike: { ...current.volumeSpike, ...patch },
                  }))
                }
                onAbsorptionChange={(patch) =>
                  setMarketExplorerDraft((current) => ({
                    ...current,
                    absorption: { ...current.absorption, ...patch },
                  }))
                }
              />
              <fieldset className="liquidity-settings-group">
                <legend>BigTrade</legend>
                <div className="liquidity-settings-fields">
                  {BIG_TRADE_SESSIONS.map(({ key, label }) => (
                    <SettingNumber
                      key={key}
                      label={`${label} min volume`}
                      help={`Minimum executed volume shown during the ${label} session, using the same New York session buckets as the main-chart indicator.`}
                      value={normalizeBigTradeSessionMinVolumes(bigTradeDraft)[key]}
                      min={0}
                      max={100_000}
                      disabled={false}
                      onChange={(value) => updateBigTradeSessionVolume(key, value)}
                    />
                  ))}
                  <SettingNumber
                    label="Display limit"
                    help="Maximum number of newest BigTrade bubbles retained for display."
                    value={bigTradeDraft.maxVisible}
                    min={1}
                    max={MAX_BIG_TRADE_VISIBLE}
                    disabled={false}
                    onChange={(value) =>
                      setBigTradeDraft((current) => ({
                        ...current,
                        maxVisible: Math.round(value),
                      }))
                    }
                  />
                  <label className="liquidity-settings-field market-explorer-check-field">
                    <span>Sound</span>
                    <input
                      type="checkbox"
                      aria-label="BigTrade sound"
                      checked={bigTradeDraft.soundEnabled === true}
                      onChange={(event) =>
                        setBigTradeDraft((current) => ({
                          ...current,
                          soundEnabled: event.currentTarget.checked,
                        }))
                      }
                    />
                  </label>
                </div>
              </fieldset>
            </div>

            <footer>
              <div className={settingsError ? "is-error" : "is-ok"}>
                {settingsError ?? settingsNotice ?? "Changes affect new depth updates."}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSettingsDraft({ ...DEFAULT_TRACKER_SETTINGS });
                  setMarketExplorerDraft(cloneMarketExplorerSettings());
                  setBigTradeDraft(
                    normalizeLiquidityBigTradeSettings(DEFAULT_BIG_TRADE_SETTINGS),
                  );
                  setSettingsError(null);
                  setSettingsNotice(null);
                }}
              >
                Defaults
              </button>
              <button type="button" onClick={() => setSettingsOpen(false)}>Cancel</button>
              <button type="button" className="is-primary" disabled={settingsSaving} onClick={saveSettings}>
                {settingsSaving ? "Saving…" : "Save & Apply"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      <LiquidityCanvas
        bars={bars}
        events={configuredEvents}
        lines={configuredLines}
        marketVolumeSamples={marketVolumeSamples}
        marketVolumeSignals={marketVolumeSignals}
        marketExplorerSettings={marketExplorerSettings}
        showVwap={showVwap}
        bigTrades={bigTrades}
        showBigTrades={showBigTrades}
        bigTradeSettings={bigTradeSettings}
        trackerSettings={trackerSettings}
        heatmapSettings={heatmapSettings}
        tf={tf}
        filters={filters}
        visibleBars={visibleBars}
        offsetBars={offsetBars}
        priceScale={priceScale}
        pricePanPx={pricePanPx}
        now={clock}
        onOffsetChange={setOffsetBars}
        onPriceScaleChange={setPriceScale}
        onPricePanChange={setPricePanPx}
        onVisibleBarsChange={(value) =>
          setVisibleBars(clamp(value, MIN_VISIBLE_BARS, maxVisible))
        }
        onZoom={zoom}
      />

      <footer className="liquidity-legend">
        <span><i className="is-bid-line" /> heatmap bid</span>
        <span><i className="is-ask-line" /> heatmap ask</span>
        <span>Brighter = more resting size; hide levels &lt; {heatmapSettings.minDurationSeconds}s</span>
        <span><i className="is-relative-bid" /> relative bid ±volume</span>
        <span><i className="is-relative-ask" /> relative ask ±volume</span>
        <span><i className="is-absolute" /> absolute threshold</span>
        <span><i style={{ background: VWAP_COLOR }} /> session VWAP</span>
        <span><i style={{ background: "rgba(30, 144, 255, 0.8)" }} /> BigTrade buy</span>
        <span><i style={{ background: "rgba(220, 20, 60, 0.8)" }} /> BigTrade sell</span>
        <span><i style={{ background: marketExplorerSettings.buyLineColor }} /> MV Stop buy</span>
        <span><i style={{ background: marketExplorerSettings.sellLineColor }} /> MV Stop sell</span>
        <span><i style={{ background: marketExplorerSettings.volumeSpike.buyColor }} /> Volume Spike</span>
        <span><i style={{ background: marketExplorerSettings.absorption.sellColor }} /> Absorption</span>
        <span>No raw full-depth data is stored</span>
      </footer>
      {marketExplorerToast ? (
        <div className="liquidity-market-explorer-toast">{marketExplorerToast}</div>
      ) : null}
    </div>
  );
}

function LiquidityCanvas({
  bars,
  events,
  lines,
  marketVolumeSamples,
  marketVolumeSignals,
  marketExplorerSettings,
  showVwap,
  bigTrades,
  showBigTrades,
  bigTradeSettings,
  trackerSettings,
  heatmapSettings,
  tf,
  filters,
  visibleBars,
  offsetBars,
  priceScale,
  pricePanPx,
  now,
  onOffsetChange,
  onPriceScaleChange,
  onPricePanChange,
  onVisibleBarsChange,
  onZoom,
}: {
  bars: Bar[];
  events: LiquidityEvent[];
  lines: LiquidityLine[];
  marketVolumeSamples: MarketVolumeSample[];
  marketVolumeSignals: MarketExplorerSignal[];
  marketExplorerSettings: MarketExplorerSettings;
  showVwap: boolean;
  bigTrades: readonly BigTradeMarker[];
  showBigTrades: boolean;
  bigTradeSettings: BigTradeSettings;
  trackerSettings: LiquidityTrackerSettings;
  heatmapSettings: LiquidityHeatmapSettings;
  tf: LiquidityTimeframe;
  filters: Filters;
  visibleBars: number;
  offsetBars: number;
  priceScale: number;
  pricePanPx: number;
  now: number;
  onOffsetChange: (value: number) => void;
  onPriceScaleChange: (value: number) => void;
  onPricePanChange: (value: number) => void;
  onVisibleBarsChange: (value: number) => void;
  onZoom: (factor: number) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0 });
  const [interaction, setInteraction] = useState<InteractionMode>("idle");
  const [hover, setHover] = useState<HoverPoint | null>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => {
      const rect = host.getBoundingClientRect();
      setSize({ width: Math.max(1, rect.width), height: Math.max(1, rect.height) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const maxOffset = Math.max(0, bars.length - MIN_VISIBLE_BARS);
  const maxFutureOffset = Math.max(
    1,
    Math.floor(visibleBars * MAX_FUTURE_SPACE_RATIO),
  );
  const safeOffset = clamp(offsetBars, -maxFutureOffset, maxOffset);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width <= 0 || size.height <= 0) return;
    drawLiquidityChart(canvas, size, {
      bars,
      events,
      lines,
      marketVolumeSamples,
      marketVolumeSignals,
      marketExplorerSettings,
      showVwap,
      bigTrades,
      showBigTrades,
      bigTradeSettings,
      trackerSettings,
      heatmapSettings,
      tf,
      filters,
      visibleBars,
      offsetBars: safeOffset,
      priceScale,
      pricePanPx,
      now: Math.max(now, Date.now()),
      hover,
    });
  }, [
    bars,
    bigTrades,
    bigTradeSettings,
    events,
    filters,
    hover,
    lines,
    marketExplorerSettings,
    trackerSettings,
    heatmapSettings,
    marketVolumeSamples,
    marketVolumeSignals,
    now,
    pricePanPx,
    priceScale,
    safeOffset,
    size,
    showBigTrades,
    showVwap,
    tf,
    visibleBars,
  ]);

  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x >= size.width - PRICE_AXIS_WIDTH) {
      dragRef.current = {
        mode: "scale-price",
        pointerId: event.pointerId,
        startY: event.clientY,
        startPriceScale: priceScale,
      };
      setInteraction("scale-price");
    } else if (y >= size.height - TIME_AXIS_HEIGHT) {
      dragRef.current = {
        mode: "scale-time",
        pointerId: event.pointerId,
        startX: event.clientX,
        startVisibleBars: visibleBars,
      };
      setInteraction("scale-time");
    } else {
      dragRef.current = {
        mode: "pan",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startOffset: safeOffset,
        startPricePanPx: pricePanPx,
      };
      setInteraction("pan");
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setHover({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.mode === "scale-price") {
      const delta = drag.startY - event.clientY;
      onPriceScaleChange(priceScaleFromAxisDrag(drag.startPriceScale, delta));
      return;
    }
    if (drag.mode === "scale-time") {
      const delta = event.clientX - drag.startX;
      onVisibleBarsChange(timeScaleFromAxisDrag(drag.startVisibleBars, delta));
      return;
    }
    const plotWidth = Math.max(1, size.width - 14 - PRICE_AXIS_WIDTH);
    const plotHeight = Math.max(1, size.height - 18 - TIME_AXIS_HEIGHT);
    const pixelsPerBar = plotWidth / Math.max(1, visibleBars);
    onPricePanChange(
      pricePanFromChartDrag(
        drag.startPricePanPx,
        event.clientY - drag.startY,
        plotHeight,
      ),
    );
    onOffsetChange(
      panOffsetFromDrag(
        drag.startOffset,
        event.clientX - drag.startX,
        pixelsPerBar,
        maxOffset,
        maxFutureOffset,
      ),
    );
  };
  const pointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
    setInteraction("idle");
  };
  const wheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    onZoom(event.deltaY > 0 ? 1.15 : 0.87);
  };
  const doubleClick = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x >= size.width - PRICE_AXIS_WIDTH) {
      onPriceScaleChange(1);
      onPricePanChange(0);
    } else if (y >= size.height - TIME_AXIS_HEIGHT) {
      onVisibleBarsChange(defaultLiquidityVisibleBars(tf));
      onOffsetChange(0);
    }
  };
  const idleAxis =
    hover && hover.x >= size.width - PRICE_AXIS_WIDTH
      ? "scale-price"
      : hover && hover.y >= size.height - TIME_AXIS_HEIGHT
        ? "scale-time"
        : "idle";
  const cursorMode = interaction === "idle" ? idleAxis : interaction;

  return (
    <main
      ref={hostRef}
      className={`liquidity-canvas-shell is-${cursorMode}`}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerUp}
      onDoubleClick={doubleClick}
      onPointerLeave={() => {
        if (!dragRef.current) setHover(null);
      }}
      onWheel={wheel}
    >
      <canvas ref={canvasRef} aria-label="GC liquidity timing chart" />
      {bars.length === 0 ? (
        <div className="liquidity-empty">Waiting for GC candle and liquidity data…</div>
      ) : null}
    </main>
  );
}

function marketExplorerSignalStyle(
  settings: MarketExplorerSettings,
  signal: MarketExplorerSignal,
): MarketExplorerSignalSettings | VolumeSpikeSettings | AbsorptionSettings {
  if (signal.kind === "volume_spike") return settings.volumeSpike;
  if (signal.kind === "absorption") return settings.absorption;
  return settings.signal;
}

function marketExplorerSignalLabel(signal: MarketExplorerSignal): string {
  if (signal.kind === "volume_spike") return "VS";
  if (signal.kind === "absorption") return "ABS";
  return "MV1";
}

export interface TtwVolumeSpikeLabel {
  title: string;
  priceChange: string;
  ratio: string;
  sellVolume: string;
  buyVolume: string;
}

/** Payload and number formats used by TTW's Buy/Sell V-Spike callout. */
export function ttwVolumeSpikeLabel(
  signal: Pick<
    MarketExplorerSignal,
    "side" | "price" | "priceRangeTicks" | "ratio" | "value" | "oppositeVolume"
  >,
): TtwVolumeSpikeLabel {
  const oppositeVolume = Math.max(0, signal.oppositeVolume ?? 0);
  const priceChange =
    (signal.side === "buy" ? 1 : -1) *
    Math.abs(signal.priceRangeTicks ?? 0) *
    TTW_VSPIKE_TICK_SIZE;
  const ratio = oppositeVolume <= 0 || !Number.isFinite(signal.ratio) || signal.ratio >= 1e9
    ? "∞"
    : Math.abs(signal.ratio).toFixed(1).replace(/\.0$/, "");
  return {
    title: `${signal.side === "buy" ? "Buy" : "Sell"} V-Spike at ${signal.price.toFixed(1)}`,
    priceChange: priceChange.toFixed(1),
    ratio,
    sellVolume: formatCompactVolume(signal.side === "sell" ? signal.value : oppositeVolume),
    buyVolume: formatCompactVolume(signal.side === "buy" ? signal.value : oppositeVolume),
  };
}

function drawTtwVolumeSpikeSignal(
  context: CanvasRenderingContext2D,
  signal: MarketExplorerSignal,
  style: VolumeSpikeSettings,
  x: number,
  y: number,
  plotLeft: number,
  plotRight: number,
  plotTop: number,
  plotBottom: number,
) {
  const label = ttwVolumeSpikeLabel(signal);
  const isBuy = signal.side === "buy";
  const sideColor = isBuy ? style.buyColor : style.sellColor;
  const ratioColor = style.buyColor;
  const labelWidth = 142;
  const labelHeight = 43;
  const labelCenterX = clamp(
    x,
    plotLeft + labelWidth / 2,
    plotRight - labelWidth / 2,
  );
  const preferredTop = isBuy ? y - 62 - labelHeight : y + 62;
  const labelTop = clamp(preferredTop, plotTop + 3, plotBottom - labelHeight - 3);
  const labelBelow = labelTop > y;
  const stemEndY = labelBelow ? labelTop - 4 : labelTop + labelHeight + 4;

  context.save();
  context.setLineDash([]);
  context.strokeStyle = sideColor;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x, y + (labelBelow ? 4 : -4));
  context.lineTo(x, stemEndY);
  context.stroke();
  context.fillStyle = sideColor;
  context.beginPath();
  context.arc(x, y, 3.5, 0, Math.PI * 2);
  context.fill();

  const labelLeft = labelCenterX - labelWidth / 2;
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.font = "600 11px Segoe UI, sans-serif";
  const titlePrefix = isBuy ? "Buy V-Spike" : "Sell V-Spike";
  const titleY = labelTop + 7;
  context.fillStyle = sideColor;
  context.fillText(titlePrefix, labelLeft, titleY);
  context.fillStyle = "#d9e0e6";
  context.fillText(
    ` at ${signal.price.toFixed(1)}`,
    labelLeft + context.measureText(titlePrefix).width,
    titleY,
  );

  context.font = "600 10px Segoe UI, sans-serif";
  context.fillStyle = sideColor;
  context.fillText(`P: ${label.priceChange}`, labelLeft, labelTop + 22);
  context.fillStyle = ratioColor;
  context.fillText(`R: ${label.ratio}`, labelLeft, labelTop + 36);

  context.textAlign = "right";
  context.fillStyle = style.buyColor;
  context.fillText(label.buyVolume, labelLeft + labelWidth, labelTop + 36);
  const buyWidth = context.measureText(label.buyVolume).width;
  context.fillStyle = "#d9e0e6";
  context.fillText(" / ", labelLeft + labelWidth - buyWidth, labelTop + 36);
  const slashWidth = context.measureText(" / ").width;
  context.fillStyle = style.sellColor;
  context.fillText(
    label.sellVolume,
    labelLeft + labelWidth - buyWidth - slashWidth,
    labelTop + 36,
  );
  context.restore();
}

function drawSessionVwap(
  context: CanvasRenderingContext2D,
  points: readonly SessionVwapPoint[],
  timeframeMs: number,
  xAt: (time: number) => number,
  yAt: (price: number) => number,
  plotRight: number,
) {
  if (points.length === 0) return;
  context.save();
  context.strokeStyle = VWAP_COLOR;
  context.lineWidth = 2;
  context.setLineDash([]);
  context.beginPath();
  let previousSession = "";
  for (const point of points) {
    const x = xAt(point.time + timeframeMs / 2);
    const y = yAt(point.value);
    if (point.sessionKey !== previousSession) {
      context.moveTo(x, y);
      previousSession = point.sessionKey;
    } else {
      context.lineTo(x, y);
    }
  }
  context.stroke();

  const latest = points[points.length - 1];
  const latestX = xAt(latest.time + timeframeMs / 2);
  const latestY = yAt(latest.value);
  context.fillStyle = VWAP_COLOR;
  context.beginPath();
  context.arc(latestX, latestY, 2.5, 0, Math.PI * 2);
  context.fill();

  const label = `VWAP ${latest.value.toFixed(1)}`;
  context.font = "600 10px Segoe UI, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  const labelWidth = Math.ceil(context.measureText(label).width) + 10;
  const labelHeight = 18;
  const labelCenterX = plotRight - labelWidth / 2 - 4;
  roundedRectPath(
    context,
    labelCenterX - labelWidth / 2,
    latestY - labelHeight / 2,
    labelWidth,
    labelHeight,
    3,
  );
  context.fillStyle = "rgba(38, 31, 5, 0.9)";
  context.fill();
  context.strokeStyle = "rgba(245, 197, 66, 0.75)";
  context.lineWidth = 1;
  context.stroke();
  context.fillStyle = "#fff5c2";
  context.fillText(label, labelCenterX, latestY + 0.5);
  context.restore();
}

function drawLiquidityChart(
  canvas: HTMLCanvasElement,
  size: CanvasSize,
  data: {
    bars: Bar[];
    events: LiquidityEvent[];
    lines: LiquidityLine[];
    marketVolumeSamples: MarketVolumeSample[];
    marketVolumeSignals: MarketExplorerSignal[];
    marketExplorerSettings: MarketExplorerSettings;
    showVwap: boolean;
    bigTrades: readonly BigTradeMarker[];
    showBigTrades: boolean;
    bigTradeSettings: BigTradeSettings;
    trackerSettings: LiquidityTrackerSettings;
    heatmapSettings: LiquidityHeatmapSettings;
    tf: LiquidityTimeframe;
    filters: Filters;
    visibleBars: number;
    offsetBars: number;
    priceScale: number;
    pricePanPx: number;
    now: number;
    hover: HoverPoint | null;
  },
) {
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(size.width * ratio);
  canvas.height = Math.round(size.height * ratio);
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.fillStyle = "#0b0f14";
  context.fillRect(0, 0, size.width, size.height);

  const left = 14;
  const right = PRICE_AXIS_WIDTH;
  const top = 18;
  const bottom = TIME_AXIS_HEIGHT;
  const plotWidth = Math.max(1, size.width - left - right);
  const plotHeight = Math.max(1, size.height - top - bottom);
  const stopPaneHeight = data.marketExplorerSettings.lineEnabled
    ? clamp(plotHeight * 0.24, 88, 170)
    : 0;
  const paneGap = stopPaneHeight > 0 ? 10 : 0;
  const pricePlotHeight = Math.max(1, plotHeight - stopPaneHeight - paneGap);
  const stopPaneTop = top + pricePlotHeight + paneGap;
  const tfMs = liquidityTimeframeMs(data.tf);
  const pastOffset = Math.max(0, Math.floor(data.offsetBars));
  const futureSlots = Math.max(0, -Math.floor(data.offsetBars));
  const endIndex = Math.max(0, data.bars.length - pastOffset);
  const occupiedSlots = Math.max(1, data.visibleBars - futureSlots);
  const startIndex = Math.max(0, endIndex - occupiedSlots);
  const visible = data.bars.slice(startIndex, endIndex);
  if (visible.length === 0) return;
  const latestBar = data.bars[data.bars.length - 1];
  const showCurrentPrice = endIndex === data.bars.length && latestBar !== undefined;
  const currentPrice = latestBar?.close;
  const timeFrom = visible[0].time;
  const timeTo = visible[visible.length - 1].time + tfMs * (futureSlots + 1);
  const markerEvents = data.events.filter(
    (event) =>
      event.time >= timeFrom &&
      event.time <= timeTo &&
      (event.eventKind === "relative"
        ? data.filters.relative
        : event.eventKind === "absolute"
          ? data.filters.absolute
          : data.filters.longTerm),
  );
  const eligibleBigTrades = eligibleLiquidityBigTrades(
    data.bigTrades,
    data.showBigTrades,
    data.bigTradeSettings,
  );
  const visibleBigTrades = eligibleBigTrades.filter(
    (trade) => trade.time >= timeFrom && trade.time <= timeTo,
  );
  const visibleVwapPoints = data.showVwap
    ? sessionVwapPoints(data.bars).filter(
        (point) => point.time >= timeFrom && point.time <= timeTo,
      )
    : [];
  const lineItems = data.lines.filter((line) => {
    const effectiveEnd = heatmapLineEnd(line, data.now);
    return line.startedAt <= timeTo && effectiveEnd >= timeFrom &&
      heatmapLineVisible(line, data.heatmapSettings, data.now, plotWidth / (timeTo - timeFrom));
  });
  const rawMarketVolumeSamples = data.marketVolumeSamples.filter(
    (sample) => sample.time >= timeFrom && sample.time <= timeTo,
  );
  const marketVolumeStride = Math.max(
    1,
    Math.ceil(rawMarketVolumeSamples.length / Math.max(1, plotWidth * 2)),
  );
  const marketVolumeSamples = rawMarketVolumeSamples.filter(
    (_sample, index) =>
      index % marketVolumeStride === 0 || index === rawMarketVolumeSamples.length - 1,
  );
  const marketVolumeSignals = data.marketVolumeSignals.filter(
    (signal) => signal.time >= timeFrom && signal.time <= timeTo,
  );
  const prices = visible.flatMap((bar) => [bar.low, bar.high]);
  // Fit visible candles. Distant depth levels and other overlays are clipped
  // to this price viewport instead of compressing the candle chart.
  if (showCurrentPrice && currentPrice !== undefined) prices.push(currentPrice);
  const dataMin = Math.min(...prices);
  const dataMax = Math.max(...prices);
  const dataCenterPrice = (dataMin + dataMax) / 2;
  const baseSpan = Math.max(0.5, dataMax - dataMin) * 1.16;
  const scaledSpan =
    baseSpan /
    clamp(data.priceScale, MIN_PRICE_SCALE, MAX_PRICE_SCALE);
  const centerPrice =
    dataCenterPrice +
    (clamp(data.pricePanPx, -pricePlotHeight * 3, pricePlotHeight * 3) /
      pricePlotHeight) *
    scaledSpan;
  const priceMin = centerPrice - scaledSpan / 2;
  const priceMax = centerPrice + scaledSpan / 2;
  const priceSpan = priceMax - priceMin;
  const xAt = (time: number) => left + ((time - timeFrom) / (timeTo - timeFrom)) * plotWidth;
  const yAt = (price: number) =>
    top + ((priceMax - price) / priceSpan) * pricePlotHeight;

  context.font = "11px Segoe UI, sans-serif";
  context.textBaseline = "middle";
  for (let index = 0; index <= 5; index += 1) {
    const y = top + (pricePlotHeight * index) / 5;
    const price = priceMax - (priceSpan * index) / 5;
    context.strokeStyle = "#1d2732";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(left, Math.round(y) + 0.5);
    context.lineTo(left + plotWidth, Math.round(y) + 0.5);
    context.stroke();
    context.fillStyle = "#8d9aaa";
    context.fillText(price.toFixed(1), left + plotWidth + 7, y);
  }
  for (let index = 0; index <= 6; index += 1) {
    const x = left + (plotWidth * index) / 6;
    const time = timeFrom + ((timeTo - timeFrom) * index) / 6;
    context.strokeStyle = "#151e27";
    context.beginPath();
    context.moveTo(Math.round(x) + 0.5, top);
    context.lineTo(Math.round(x) + 0.5, top + plotHeight);
    context.stroke();
    context.fillStyle = "#718093";
    context.textAlign = index === 0 ? "left" : index === 6 ? "right" : "center";
    context.fillText(formatTime(time), x, top + plotHeight + 17);
  }
  context.save();
  context.beginPath();
  context.rect(left, top, plotWidth, pricePlotHeight);
  context.clip();

  if (data.filters.longTerm) {
    for (const line of lineItems) {
      if (line.price < priceMin || line.price > priceMax) continue;
      const projection = showCurrentPrice
        ? liquidityLiveProjection(line, timeFrom, timeTo, data.now)
        : null;
      const y = yAt(line.price);
      const color = line.side === "bid" ? "0, 214, 143" : "255, 82, 103";
      // Each row covers one real GC tick. Adjacent occupied levels naturally
      // form a wider band, without inventing prices by widening a big order.
      const height = clamp(Math.abs(yAt(line.price - 0.05) - yAt(line.price + 0.05)) * 0.9, 1, 12);
      const segments = removeHeatmapSpeckles(
        liquidityHeatmapSegments(line, timeFrom, timeTo, data.now),
        plotWidth / (timeTo - timeFrom),
      );
      for (const segment of segments) {
        const x1 = xAt(segment.from);
        const x2 = xAt(segment.to);
        const alpha = segment.size === null ? 0.3
          : liquidityHeatmapAlpha(segment.size, line.threshold, data.heatmapSettings);
        context.fillStyle = `rgba(${color}, ${alpha})`;
        context.fillRect(x1, y - height / 2, x2 - x1, height);
      }
      // Dashed continuation shows the current book in future chart space;
      // historical size bands above still stop at their actual observation.
      if (projection) {
        context.strokeStyle = `rgba(${color}, ${liquidityHeatmapAlpha(projection.size, line.threshold, data.heatmapSettings)})`;
        context.lineWidth = height;
        context.setLineDash([6, 4]);
        context.beginPath();
        context.moveTo(xAt(projection.from), y);
        context.lineTo(xAt(projection.to), y);
        context.stroke();
        context.setLineDash([]);
      }
      const x2 = xAt(projection?.to ?? Math.min(timeTo, heatmapLineEnd(line, data.now)));
      if (projection && x2 > left + plotWidth - 120) {
        context.fillStyle = `rgb(${color})`;
        context.textAlign = "right";
        const label = liquidityLineLabel(line, data.trackerSettings, data.now);
        context.fillText(label, x2 - 5, y - 8);
      }
    }
  }

  context.setLineDash([]);
  const candleSlot = plotWidth / Math.max(1, data.visibleBars);
  const candleWidth = clamp(candleSlot * 0.62, 1, 10);
  for (const bar of visible) {
    const x = xAt(bar.time + tfMs / 2);
    const up = bar.close >= bar.open;
    const color = up ? "#9aa6b2" : "#536170";
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x, yAt(bar.high));
    context.lineTo(x, yAt(bar.low));
    context.stroke();
    const bodyTop = yAt(Math.max(bar.open, bar.close));
    const bodyBottom = yAt(Math.min(bar.open, bar.close));
    context.fillRect(
      x - candleWidth / 2,
      bodyTop,
      candleWidth,
      Math.max(1, bodyBottom - bodyTop),
    );
  }

  drawSessionVwap(
    context,
    visibleVwapPoints,
    tfMs,
    xAt,
    yAt,
    left + plotWidth,
  );

  if (
    showCurrentPrice &&
    currentPrice !== undefined &&
    currentPrice >= priceMin &&
    currentPrice <= priceMax
  ) {
    const currentY = yAt(currentPrice);
    context.strokeStyle = "rgba(72, 187, 255, 0.9)";
    context.lineWidth = 1;
    context.setLineDash([5, 4]);
    context.beginPath();
    context.moveTo(left, currentY);
    context.lineTo(left + plotWidth, currentY);
    context.stroke();
    context.setLineDash([]);
  }


  for (const signal of marketVolumeSignals) {
    const style = marketExplorerSignalStyle(data.marketExplorerSettings, signal);
    if (!style?.enabled) continue;
    const x = xAt(signal.time);
    const y = yAt(signal.price);
    if (signal.kind === "volume_spike") {
      drawTtwVolumeSpikeSignal(
        context,
        signal,
        data.marketExplorerSettings.volumeSpike,
        x,
        y,
        left,
        left + plotWidth,
        top,
        top + pricePlotHeight,
      );
      continue;
    }
    const isBuy = signal.side === "buy";
    const pointsUp = signal.kind === "absorption" ? !isBuy : isBuy;
    const size = clamp(
      style.variableSize ? style.markerSize * signal.ratio * 2.2 : style.markerSize * 3,
      4,
      17,
    );
    context.fillStyle = isBuy ? style.buyColor : style.sellColor;
    context.strokeStyle = "rgba(9, 14, 18, 0.82)";
    context.lineWidth = 1;
    context.beginPath();
    if (style.markerShape === "circle") {
      context.arc(x, y, size, 0, Math.PI * 2);
    } else if (style.markerShape === "flag") {
      context.rect(x - size, y - size * 0.72, size * 1.45, size * 1.45);
    } else if (pointsUp) {
      context.moveTo(x, y - size);
      context.lineTo(x + size, y + size);
      context.lineTo(x - size, y + size);
      context.closePath();
    } else {
      context.moveTo(x, y + size);
      context.lineTo(x + size, y - size);
      context.lineTo(x - size, y - size);
      context.closePath();
    }
    context.fill();
    context.stroke();
    if (style.markerShape === "flag") {
      context.fillStyle = "rgba(238, 244, 248, 0.9)";
      const square = Math.max(1.5, size * 0.32);
      context.fillRect(x - size * 0.78, y - square, square, square);
      context.fillRect(x - size * 0.78 + square, y, square, square);
      context.fillStyle = isBuy ? style.buyColor : style.sellColor;
      context.beginPath();
      const tipX = x + size * 1.45;
      if (pointsUp) {
        context.moveTo(tipX, y - size * 0.9);
        context.lineTo(x + size * 0.55, y + size * 0.55);
        context.lineTo(x + size * 1.2, y + size * 0.55);
      } else {
        context.moveTo(tipX, y + size * 0.9);
        context.lineTo(x + size * 0.55, y - size * 0.55);
        context.lineTo(x + size * 1.2, y - size * 0.55);
      }
      context.closePath();
      context.fill();
    }
    context.fillStyle = isBuy ? style.buyColor : style.sellColor;
    context.font = "bold 10px Segoe UI, sans-serif";
    context.textAlign = "center";
    context.fillText(
      marketExplorerSignalLabel(signal),
      x,
      y + (pointsUp ? size + 9 : -size - 9),
    );
  }

  for (const event of markerEvents) {
    const x = xAt(event.time);
    const y = yAt(event.price);
    if (event.eventKind === "long_term_touch") {
      drawLongTermLiquidityTouchBubble(context, event, x, y);
      continue;
    }
    const radius = clamp(3 + Math.min(4, event.strength), 3, 7);
    if (event.eventKind === "relative") {
      drawTtwRelativeLiquidityMarker(
        context,
        event,
        x,
        y,
        left,
        left + plotWidth,
        top,
        top + pricePlotHeight,
      );
    } else if (event.eventKind === "absolute") {
      const color = event.side === "bid" ? "#00d68f" : "#ff5267";
      context.fillStyle = color;
      context.strokeStyle = "#ffd166";
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(x, y - radius);
      context.lineTo(x + radius, y);
      context.lineTo(x, y + radius);
      context.lineTo(x - radius, y);
      context.closePath();
      context.fill();
      context.stroke();
    }
  }

  const maxBigTradeVolume = eligibleBigTrades.reduce(
    (maximum, trade) => Math.max(maximum, trade.volume),
    0,
  );
  for (const trade of visibleBigTrades) {
    drawBigTradeBubble(
      context,
      trade,
      xAt(trade.time),
      yAt(trade.price),
      bubbleRadius(trade.volume, maxBigTradeVolume, 13, 30),
    );
  }

  if (
    data.hover &&
    data.hover.x >= left &&
    data.hover.x <= left + plotWidth &&
    data.hover.y >= top &&
    data.hover.y <= top + pricePlotHeight
  ) {
    const hoverTime = timeFrom + ((data.hover.x - left) / plotWidth) * (timeTo - timeFrom);
    const hoverPrice = priceFromChartY(
      data.hover.y,
      top,
      pricePlotHeight,
      priceMin,
      priceMax,
    );
    context.strokeStyle = "rgba(190, 205, 220, 0.55)";
    context.lineWidth = 1;
    context.setLineDash([3, 3]);
    context.beginPath();
    context.moveTo(data.hover.x, top);
    context.lineTo(data.hover.x, top + pricePlotHeight);
    context.moveTo(left, data.hover.y);
    context.lineTo(left + plotWidth, data.hover.y);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = "#dbe7f3";
    context.textAlign = "right";
    context.fillText(hoverPrice.toFixed(1), left + plotWidth - 5, data.hover.y - 8);
    context.textAlign = "center";
    context.fillText(formatDateTime(hoverTime), data.hover.x, top + 9);
  }
  context.restore();

  if (
    showCurrentPrice &&
    currentPrice !== undefined &&
    currentPrice >= priceMin &&
    currentPrice <= priceMax
  ) {
    const currentY = yAt(currentPrice);
    const labelHeight = 18;
    context.fillStyle = "#48bbff";
    context.fillRect(
      left + plotWidth,
      currentY - labelHeight / 2,
      PRICE_AXIS_WIDTH,
      labelHeight,
    );
    context.fillStyle = "#07131d";
    context.font = "700 11px Segoe UI, sans-serif";
    context.textAlign = "left";
    context.fillText(currentPrice.toFixed(1), left + plotWidth + 7, currentY);
  }

  if (stopPaneHeight > 0) {
    context.fillStyle = "#0a1118";
    context.fillRect(left, stopPaneTop, plotWidth, stopPaneHeight);
    context.strokeStyle = "#40505f";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(left, stopPaneTop - paneGap / 2 + 0.5);
    context.lineTo(left + plotWidth, stopPaneTop - paneGap / 2 + 0.5);
    context.stroke();

    const configuredThreshold = Math.max(
      1,
      data.marketExplorerSettings.signal.askLevel,
      data.marketExplorerSettings.signal.bidLevel,
    );
    const observed = Math.max(
      configuredThreshold,
      ...rawMarketVolumeSamples.map((sample) => Math.abs(sample.value)),
    );
    const volumeExtent = observed * 1.12;
    const stopY = (value: number) =>
      stopPaneTop + ((volumeExtent - value) / (volumeExtent * 2)) * stopPaneHeight;
    const zeroY = stopY(0);
    context.strokeStyle = "#52616d";
    context.setLineDash([4, 4]);
    context.beginPath();
    context.moveTo(left, zeroY + 0.5);
    context.lineTo(left + plotWidth, zeroY + 0.5);
    context.stroke();
    context.setLineDash([]);

    context.save();
    context.beginPath();
    context.rect(left, stopPaneTop, plotWidth, stopPaneHeight);
    context.clip();
    context.lineWidth = 2;
    for (let index = 1; index < marketVolumeSamples.length; index += 1) {
      const previous = marketVolumeSamples[index - 1];
      const current = marketVolumeSamples[index];
      context.strokeStyle =
        current.value >= 0
          ? data.marketExplorerSettings.buyLineColor
          : data.marketExplorerSettings.sellLineColor;
      context.beginPath();
      context.moveTo(xAt(previous.time), stopY(previous.value));
      context.lineTo(xAt(current.time), stopY(current.value));
      context.stroke();
    }
    context.restore();

    context.font = "bold 11px Segoe UI, sans-serif";
    context.textAlign = "left";
    context.fillStyle = "#c7d2dc";
    context.fillText(
      `MV Stop (${data.marketExplorerSettings.halftimeSeconds}s)`,
      left + 7,
      stopPaneTop + 11,
    );
    context.font = "10px Segoe UI, sans-serif";
    context.textAlign = "left";
    context.fillStyle = "#7f8e9c";
    context.fillText(formatCompactVolume(volumeExtent), left + plotWidth + 6, stopPaneTop + 6);
    context.fillText("0", left + plotWidth + 6, zeroY);
    context.fillText(
      formatCompactVolume(-volumeExtent),
      left + plotWidth + 6,
      stopPaneTop + stopPaneHeight - 6,
    );

    if (
      data.hover &&
      data.hover.x >= left &&
      data.hover.x <= left + plotWidth &&
      data.hover.y >= stopPaneTop &&
      data.hover.y <= stopPaneTop + stopPaneHeight
    ) {
      const hoverVolume =
        volumeExtent - ((data.hover.y - stopPaneTop) / stopPaneHeight) * volumeExtent * 2;
      context.strokeStyle = "rgba(190, 205, 220, 0.55)";
      context.setLineDash([3, 3]);
      context.beginPath();
      context.moveTo(data.hover.x, stopPaneTop);
      context.lineTo(data.hover.x, stopPaneTop + stopPaneHeight);
      context.moveTo(left, data.hover.y);
      context.lineTo(left + plotWidth, data.hover.y);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = "#dbe7f3";
      context.textAlign = "right";
      context.fillText(
        formatCompactVolume(hoverVolume),
        left + plotWidth - 5,
        data.hover.y - 8,
      );
    }
  }
}

/**
 * TTW's Relative Liquidity Change callback emits a signed formatted depth
 * delta. Added and removed signals both use a Dot marker; the sign in the
 * volume label carries the action.
 */
export function relativeLiquidityVolumeLabel(
  event: Pick<LiquidityEvent, "action" | "change">,
): string {
  const prefix = event.action === "removed" ? "-" : "+";
  return `${prefix}${formatCompactVolume(Math.abs(event.change))}`;
}

export function longTermTouchBubbleRadius(volume: number): number {
  return clamp(5 + Math.sqrt(Math.max(1, volume)) * 1.7, 6.5, 24);
}

function eligibleLiquidityBigTrades(
  markers: readonly BigTradeMarker[],
  enabled: boolean,
  settings: BigTradeSettings,
): readonly BigTradeMarker[] {
  if (!enabled) return [];
  const filtered = markers.filter(
    (marker) =>
      marker.volume >= bigTradeMinVolumeForTime(marker.time, settings),
  );
  const maxVisible = normalizeBigTradeMaxVisible(settings.maxVisible);
  return filtered.length > maxVisible
    ? filtered.slice(-maxVisible)
    : filtered;
}

export function visibleLiquidityBigTrades(
  markers: readonly BigTradeMarker[],
  timeFrom: number,
  timeTo: number,
  enabled = true,
  settings = DEFAULT_BIG_TRADE_SETTINGS,
): readonly BigTradeMarker[] {
  return eligibleLiquidityBigTrades(markers, enabled, settings).filter(
    (marker) => marker.time >= timeFrom && marker.time <= timeTo,
  );
}

function bigTradeTextSize(
  context: CanvasRenderingContext2D,
  label: string,
  radius: number,
): number {
  let size = Math.round(
    Math.max(10, Math.min(16, radius * (label.length >= 3 ? 0.58 : 0.68))),
  );
  const maxWidth = radius * 1.55;
  while (size > 8) {
    context.font = `400 ${size}px Arial, sans-serif`;
    if (context.measureText(label).width <= maxWidth) break;
    size -= 1;
  }
  return size;
}

function drawBigTradeBubble(
  context: CanvasRenderingContext2D,
  trade: BigTradeMarker,
  x: number,
  y: number,
  radius: number,
) {
  const isBuy = trade.side === "buy";
  context.save();
  context.beginPath();
  context.arc(x, y, Math.max(5, radius), 0, Math.PI * 2);
  context.fillStyle = isBuy
    ? "rgba(30, 144, 255, 0.18)"
    : "rgba(220, 20, 60, 0.18)";
  context.fill();
  context.lineWidth = 1.25;
  context.strokeStyle = isBuy
    ? "rgba(12, 95, 190, 0.30)"
    : "rgba(170, 12, 42, 0.30)";
  context.stroke();

  const label = `${Math.round(trade.volume)}`;
  const fontSize = bigTradeTextSize(context, label, radius);
  context.font = `400 ${fontSize}px Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 2;
  context.strokeStyle = "rgba(0, 0, 0, 0.32)";
  context.strokeText(label, x, y);
  context.fillStyle = "#ffffff";
  context.fillText(label, x, y);
  context.restore();
}

function drawLongTermLiquidityTouchBubble(
  context: CanvasRenderingContext2D,
  event: LiquidityEvent,
  x: number,
  y: number,
) {
  const radius = longTermTouchBubbleRadius(event.size);
  const isBidConsumption = event.side === "bid";
  const gradient = context.createRadialGradient(
    x - radius * 0.3,
    y - radius * 0.35,
    Math.max(1, radius * 0.08),
    x,
    y,
    radius,
  );
  if (isBidConsumption) {
    gradient.addColorStop(0, "rgba(255, 126, 108, 0.96)");
    gradient.addColorStop(0.55, "rgba(210, 64, 55, 0.9)");
    gradient.addColorStop(1, "rgba(87, 22, 22, 0.86)");
  } else {
    gradient.addColorStop(0, "rgba(91, 236, 174, 0.96)");
    gradient.addColorStop(0.55, "rgba(24, 169, 119, 0.9)");
    gradient.addColorStop(1, "rgba(10, 75, 58, 0.86)");
  }

  context.save();
  context.fillStyle = gradient;
  context.strokeStyle = isBidConsumption
    ? "rgba(255, 116, 104, 0.7)"
    : "rgba(77, 229, 164, 0.7)";
  context.lineWidth = 1.25;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = "rgba(255, 255, 255, 0.94)";
  context.font = `700 ${clamp(radius * 0.7, 8, 12)}px Segoe UI, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(formatCompactVolume(event.size), x, y + 0.5);
  context.restore();
}

function drawTtwRelativeLiquidityMarker(
  context: CanvasRenderingContext2D,
  event: LiquidityEvent,
  x: number,
  y: number,
  plotLeft: number,
  plotRight: number,
  plotTop: number,
  plotBottom: number,
) {
  const color = event.side === "bid"
    ? TTW_RELATIVE_BID_COLOR
    : TTW_RELATIVE_ASK_COLOR;
  const radius = clamp(
    4.5 + Math.min(4.5, Math.sqrt(Math.max(1, event.strength))),
    5.5,
    9,
  );

  context.save();
  context.fillStyle = color;
  context.strokeStyle = "rgba(8, 12, 16, 0.82)";
  context.lineWidth = 1.25;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  const label = relativeLiquidityVolumeLabel(event);
  context.font = TTW_RELATIVE_LABEL_FONT;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const labelHeight = 18;
  const labelWidth = Math.ceil(context.measureText(label).width) + 8;
  const labelCenterX = clamp(
    x,
    plotLeft + labelWidth / 2,
    plotRight - labelWidth / 2,
  );
  const aboveY = y - radius - 4 - labelHeight / 2;
  const belowY = y + radius + 4 + labelHeight / 2;
  const labelCenterY = aboveY - labelHeight / 2 >= plotTop
    ? aboveY
    : Math.min(belowY, plotBottom - labelHeight / 2);
  const labelLeft = labelCenterX - labelWidth / 2;
  const labelTop = labelCenterY - labelHeight / 2;

  context.fillStyle = "rgba(16, 18, 21, 0.92)";
  roundedRectPath(context, labelLeft, labelTop, labelWidth, labelHeight, 3);
  context.fill();
  context.strokeStyle = "rgba(255, 255, 255, 0.16)";
  context.lineWidth = 1;
  context.stroke();
  context.fillStyle = "#f7f8fa";
  context.fillText(label, labelCenterX, labelCenterY + 0.5);
  context.restore();
}

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function FilterToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      {label}
    </label>
  );
}

function MarketExplorerSettingsEditor({
  settings,
  onLineChange,
  onSignalChange,
  onVolumeSpikeChange,
  onAbsorptionChange,
}: {
  settings: MarketExplorerSettings;
  onLineChange: (patch: Partial<MarketExplorerSettings>) => void;
  onSignalChange: (patch: Partial<MarketExplorerSignalSettings>) => void;
  onVolumeSpikeChange: (patch: Partial<VolumeSpikeSettings>) => void;
  onAbsorptionChange: (patch: Partial<AbsorptionSettings>) => void;
}) {
  const signal = settings.signal;
  const spike = settings.volumeSpike;
  const absorption = settings.absorption;
  return (
    <>
      <fieldset className="liquidity-settings-group market-explorer-settings-group">
        <legend>Market Volume Stop Line</legend>
        <div className="liquidity-settings-enable-row">
          <label className="liquidity-settings-enable">
            <input
              type="checkbox"
              checked={settings.lineEnabled}
              onChange={(event) => onLineChange({ lineEnabled: event.currentTarget.checked })}
            />
            Enable
          </label>
          <SettingHelp
            label="Market Volume Stop Line"
            text="Buy aggressor volume minus sell aggressor volume, exponentially decayed with the selected half-life."
          />
        </div>
        <div className={settings.lineEnabled ? "liquidity-settings-fields" : "liquidity-settings-fields is-disabled"}>
          <SettingNumber
            label="Halftime (seconds)"
            help="TTW half-life. After this many seconds, an old trade contributes half of its original volume."
            value={settings.halftimeSeconds}
            min={1}
            max={3_600}
            disabled={!settings.lineEnabled}
            onChange={(halftimeSeconds) => onLineChange({ halftimeSeconds })}
          />
          <MarketExplorerColorField
            label="Ask / buy line"
            value={settings.buyLineColor}
            disabled={!settings.lineEnabled}
            onChange={(buyLineColor) => onLineChange({ buyLineColor })}
          />
          <MarketExplorerColorField
            label="Bid / sell line"
            value={settings.sellLineColor}
            disabled={!settings.lineEnabled}
            onChange={(sellLineColor) => onLineChange({ sellLineColor })}
          />
        </div>
      </fieldset>

      <fieldset className="liquidity-settings-group market-explorer-settings-group">
        <legend>Market Volume Stop Signal 1</legend>
        <MarketExplorerEnableRow
          checked={signal.enabled}
          label="Market Volume Stop Signal 1"
          help="Standard marks the running extreme after a 10% fallback. Immediately marks the threshold crossing."
          onChange={(enabled) => onSignalChange({ enabled })}
        />
        <div className={signal.enabled ? "liquidity-settings-fields" : "liquidity-settings-fields is-disabled"}>
          <SettingNumber
            label="Signal Level Ask"
            help="Positive buy-aggressor imbalance threshold."
            value={signal.askLevel}
            min={1}
            max={10_000_000}
            disabled={!signal.enabled}
            onChange={(askLevel) => onSignalChange({ askLevel })}
          />
          <SettingNumber
            label="Signal Level Bid"
            help="Absolute negative sell-aggressor imbalance threshold."
            value={signal.bidLevel}
            min={1}
            max={10_000_000}
            disabled={!signal.enabled}
            onChange={(bidLevel) => onSignalChange({ bidLevel })}
          />
          <MarketExplorerSelectField
            label="Display mode"
            value={signal.displayMode}
            disabled={!signal.enabled}
            options={[["standard", "Standard"], ["immediately", "Immediately"]]}
            onChange={(displayMode) =>
              onSignalChange({ displayMode: displayMode as MarketExplorerDisplayMode })
            }
          />
          <SettingNumber
            label="Pullback Duration [mins]"
            help="Suppress repeated signals inside this time window."
            value={signal.pullbackDurationMinutes}
            min={0}
            max={1_440}
            disabled={!signal.enabled}
            onChange={(pullbackDurationMinutes) => onSignalChange({ pullbackDurationMinutes })}
          />
          <SettingNumber
            label="Pullback Price Change [ticks/cents]"
            help="Adverse price change required to release duplicate suppression."
            value={signal.pullbackPriceChangeTicks}
            min={0}
            max={100_000}
            disabled={!signal.enabled}
            onChange={(pullbackPriceChangeTicks) => onSignalChange({ pullbackPriceChangeTicks })}
          />
          <MarketExplorerAppearanceFields
            buyLabel="Buy Market Volume Stop 1"
            sellLabel="Sell Market Volume Stop 1"
            settings={signal}
            disabled={!signal.enabled}
            onChange={onSignalChange}
          />
        </div>
      </fieldset>

      <fieldset className="liquidity-settings-group market-explorer-settings-group">
        <legend>Volume Spike Signal</legend>
        <MarketExplorerEnableRow
          checked={spike.enabled}
          label="Volume Spike Signal"
          help="TTW burst: same-side volume must cover the price range and ratio, then the marker is fixed at the burst extreme after fallback."
          onChange={(enabled) => onVolumeSpikeChange({ enabled })}
        />
        <div className={spike.enabled ? "liquidity-settings-fields" : "liquidity-settings-fields is-disabled"}>
          <MarketExplorerColorField label="Buy Volume Spike Signal" value={spike.buyColor} disabled={!spike.enabled} onChange={(buyColor) => onVolumeSpikeChange({ buyColor })} />
          <MarketExplorerColorField label="Sell Volume Spike Signal" value={spike.sellColor} disabled={!spike.enabled} onChange={(sellColor) => onVolumeSpikeChange({ sellColor })} />
          <SettingNumber label="Trigger Volume" help="Minimum same-side aggressor volume in the rolling burst." value={spike.triggerVolume} min={1} max={10_000_000} disabled={!spike.enabled} onChange={(triggerVolume) => onVolumeSpikeChange({ triggerVolume })} />
          <SettingNumber label="Maximum Duration [s]" help="Rolling TTW burst window, evaluated every 100 ms." value={spike.maximumDurationSeconds} min={0.1} max={60} disabled={!spike.enabled} onChange={(maximumDurationSeconds) => onVolumeSpikeChange({ maximumDurationSeconds })} />
          <SettingNumber label="Price Range [ticks/cents]" help="Required directional price travel inside the burst." value={spike.priceRangeTicks} min={1} max={100_000} disabled={!spike.enabled} onChange={(priceRangeTicks) => onVolumeSpikeChange({ priceRangeTicks })} />
          <SettingNumber label="Ratio greater / equal" help="Same-side peak volume divided by opposite-side volume." value={spike.ratioGreaterEqual} min={1} max={1_000_000} disabled={!spike.enabled} onChange={(ratioGreaterEqual) => onVolumeSpikeChange({ ratioGreaterEqual })} />
          <MarketExplorerAppearanceFields buyLabel="Buy Volume Spike Signal" sellLabel="Sell Volume Spike Signal" settings={spike} disabled={!spike.enabled} hideColors onChange={onVolumeSpikeChange} />
        </div>
      </fieldset>

      <fieldset className="liquidity-settings-group market-explorer-settings-group">
        <legend>Absorption Signal</legend>
        <MarketExplorerEnableRow
          checked={absorption.enabled}
          label="Absorption Signal"
          help="TTW absorption: large one-sided aggression remains inside fewer than two ticks, then marks the peak when the cluster breaks or fades."
          onChange={(enabled) => onAbsorptionChange({ enabled })}
        />
        <div className={absorption.enabled ? "liquidity-settings-fields" : "liquidity-settings-fields is-disabled"}>
          <MarketExplorerColorField label="Buy Absorption Signal" value={absorption.buyColor} disabled={!absorption.enabled} onChange={(buyColor) => onAbsorptionChange({ buyColor })} />
          <MarketExplorerColorField label="Sell Absorption Signal" value={absorption.sellColor} disabled={!absorption.enabled} onChange={(sellColor) => onAbsorptionChange({ sellColor })} />
          <SettingNumber label="Trigger Volume" help="Minimum same-side aggressor volume held inside the two-tick absorption range." value={absorption.triggerVolume} min={1} max={10_000_000} disabled={!absorption.enabled} onChange={(triggerVolume) => onAbsorptionChange({ triggerVolume })} />
          <SettingNumber label="Maximum Duration [s]" help="Rolling TTW absorption window, evaluated every 100 ms." value={absorption.maximumDurationSeconds} min={0.1} max={60} disabled={!absorption.enabled} onChange={(maximumDurationSeconds) => onAbsorptionChange({ maximumDurationSeconds })} />
          <MarketExplorerAppearanceFields buyLabel="Buy Absorption Signal" sellLabel="Sell Absorption Signal" settings={absorption} disabled={!absorption.enabled} hideColors onChange={onAbsorptionChange} />
        </div>
      </fieldset>
    </>
  );
}

type MarketExplorerAppearance = Pick<
  VolumeSpikeSettings,
  "buyColor" | "sellColor" | "markerShape" | "markerSize" | "variableSize" | "alertSound" | "bookmapAlertMessage"
>;

function MarketExplorerEnableRow({
  checked,
  label,
  help,
  onChange,
}: {
  checked: boolean;
  label: string;
  help: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="liquidity-settings-enable-row">
      <label className="liquidity-settings-enable">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} />
        Enable
      </label>
      <SettingHelp label={label} text={help} />
    </div>
  );
}

function MarketExplorerAppearanceFields({
  buyLabel,
  sellLabel,
  settings,
  disabled,
  hideColors = false,
  onChange,
}: {
  buyLabel: string;
  sellLabel: string;
  settings: MarketExplorerAppearance;
  disabled: boolean;
  hideColors?: boolean;
  onChange: (patch: Partial<MarketExplorerAppearance>) => void;
}) {
  return (
    <>
      {!hideColors ? (
        <>
          <MarketExplorerColorField label={buyLabel} value={settings.buyColor} disabled={disabled} onChange={(buyColor) => onChange({ buyColor })} />
          <MarketExplorerColorField label={sellLabel} value={settings.sellColor} disabled={disabled} onChange={(sellColor) => onChange({ sellColor })} />
        </>
      ) : null}
      <MarketExplorerSelectField
        label="Marker shape"
        value={settings.markerShape}
        disabled={disabled}
        options={[["triangle", "Triangle"], ["arrow", "Arrow"], ["circle", "Circle"], ["flag", "Flag"]]}
        onChange={(markerShape) => onChange({ markerShape: markerShape as MarketExplorerMarkerShape })}
      />
      <SettingNumber label="Marker size" help="Base marker size from 1 to 5." value={settings.markerSize} min={1} max={5} disabled={disabled} onChange={(markerSize) => onChange({ markerSize })} />
      <MarketExplorerCheckField label="Variable marker size" checked={settings.variableSize} disabled={disabled} onChange={(variableSize) => onChange({ variableSize })} />
      <MarketExplorerCheckField label="Alert Sound" checked={settings.alertSound} disabled={disabled} onChange={(alertSound) => onChange({ alertSound })} />
      <MarketExplorerSelectField
        label="Bookmap Alert Message"
        value={settings.bookmapAlertMessage}
        disabled={disabled}
        options={[["disabled", "Disabled"], ["enabled", "Enabled"]]}
        onChange={(bookmapAlertMessage) => onChange({ bookmapAlertMessage: bookmapAlertMessage as MarketExplorerToggleMode })}
      />
    </>
  );
}

function MarketExplorerColorField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="liquidity-settings-field market-explorer-color-field">
      <span>{label}</span>
      <input
        type="color"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}

function MarketExplorerSelectField({
  label,
  value,
  disabled,
  options,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <label className="liquidity-settings-field market-explorer-select-field">
      <span>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {options.map(([option, text]) => <option value={option} key={option}>{text}</option>)}
      </select>
    </label>
  );
}

function MarketExplorerCheckField({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="liquidity-settings-field market-explorer-check-field">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    </label>
  );
}

function LiquiditySettingsGroup({
  title,
  help,
  enableHelp,
  enabled,
  onEnabledChange,
  children,
}: {
  title: string;
  help: string;
  enableHelp: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  children: ReactNode;
}) {
  return (
    <fieldset className="liquidity-settings-group">
      <legend>
        <span className="liquidity-settings-label-with-help">
          <span>{title}</span>
          <SettingHelp label={title} text={help} />
        </span>
      </legend>
      <div className="liquidity-settings-enable-row">
        <label className="liquidity-settings-enable">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.currentTarget.checked)}
          />
          Enable
        </label>
        <SettingHelp label={`${title} Enable`} text={enableHelp} />
      </div>
      <div className={enabled ? "liquidity-settings-fields" : "liquidity-settings-fields is-disabled"}>
        {children}
      </div>
    </fieldset>
  );
}

function SettingNumber({
  label,
  help,
  value,
  min,
  max,
  step = 1,
  disabled,
  onChange,
}: {
  label: string;
  help: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const inputId = useId();
  return (
    <div className="liquidity-settings-field">
      <div className="liquidity-settings-label-with-help">
        <label htmlFor={inputId}>{label}</label>
        <SettingHelp label={label} text={help} />
      </div>
      <input
        id={inputId}
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
    </div>
  );
}

function SettingHelp({ label, text }: { label: string; text: string }) {
  const tooltipId = useId();
  return (
    <span className="liquidity-setting-help">
      <button
        type="button"
        className="liquidity-setting-help-button"
        aria-label={`Giải thích ${label}`}
        aria-describedby={tooltipId}
      >
        ?
      </button>
      <span id={tooltipId} className="liquidity-setting-tooltip" role="tooltip">
        {text}
      </span>
    </span>
  );
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return (await response.json()) as T;
}

function mergeBars(first: Bar[], second: Bar[], cutoff: number): Bar[] {
  const merged = new Map<number, Bar>();
  for (const bar of [...first, ...second]) {
    if (bar.time >= cutoff) merged.set(bar.time, bar);
  }
  return [...merged.values()].sort((a, b) => a.time - b.time);
}

export function mergeHistoryBars(
  history: Bar[],
  current: Bar[],
  cutoff: number,
  liveBucketTime: number,
): Bar[] {
  const merged = new Map<number, Bar>();
  for (const bar of current) {
    if (bar.time >= cutoff) merged.set(bar.time, bar);
  }
  // REST is authoritative for every completed bucket and repairs partial bars
  // retained by a browser that missed websocket updates while disconnected.
  for (const bar of history) {
    if (bar.time >= cutoff) merged.set(bar.time, bar);
  }
  // A websocket update can arrive after the REST request was issued. Preserve
  // only that live bucket over the response snapshot.
  for (const bar of current) {
    if (bar.time >= liveBucketTime && bar.time >= cutoff) {
      merged.set(bar.time, bar);
    }
  }
  return [...merged.values()].sort((a, b) => a.time - b.time);
}

function marketVolumeSampleFromUpdate(
  message: MarketExplorerUpdateMessage,
): MarketVolumeSample {
  return {
    time: message.time,
    value: message.value,
    buyVolume: message.buyVolume,
    sellVolume: message.sellVolume,
    price: message.price,
  };
}

function mergeMarketVolumeSamples(
  first: MarketVolumeSample[],
  second: MarketVolumeSample[],
  cutoff: number,
): MarketVolumeSample[] {
  const merged = new Map<number, MarketVolumeSample>();
  for (const sample of [...first, ...second]) {
    if (sample.time >= cutoff) merged.set(sample.time, sample);
  }
  return [...merged.values()]
    .sort((left, right) => left.time - right.time)
    .slice(-MAX_MARKET_VOLUME_SAMPLES);
}

function mergeMarketVolumeSignals(
  first: MarketExplorerSignal[],
  second: MarketExplorerSignal[],
  cutoff: number,
): MarketExplorerSignal[] {
  const merged = new Map<string, MarketExplorerSignal>();
  for (const signal of [...first, ...second]) {
    if (signal.detectionTime >= cutoff) merged.set(signal.signalId, signal);
  }
  return [...merged.values()]
    .sort((left, right) => left.detectionTime - right.detectionTime)
    .slice(-MAX_MARKET_VOLUME_SIGNALS);
}

export function mergeLiquidityBigTrades(
  history: readonly BigTradeMarker[],
  realtime: readonly BigTradeMarker[],
  cutoff: number,
  maxMarkers = MAX_BIG_TRADES,
): readonly BigTradeMarker[] {
  const retainedHistory = history.filter((trade) => trade.time >= cutoff);
  const retainedRealtime = realtime.filter((trade) => trade.time >= cutoff);
  return reduceBigTradesCapped(
    [],
    [...retainedHistory, ...retainedRealtime],
    maxMarkers,
  );
}

function notifyMarketVolumeSignals(
  signals: MarketExplorerSignal[],
  settings: MarketExplorerSettings,
  showToast: (message: string) => void,
) {
  for (const signal of signals) {
    const config = marketExplorerSignalStyle(settings, signal);
    if (!config.enabled) continue;
    const bullish = signal.kind === "absorption"
      ? signal.side === "sell"
      : signal.side === "buy";
    if (config.alertSound) playMarketExplorerTone(bullish);
    if (config.bookmapAlertMessage === "enabled") {
      const label = signal.kind === "volume_spike"
        ? "Volume Spike"
        : signal.kind === "absorption"
          ? "Absorption"
          : "Market Volume Stop";
      showToast(
        `${label} ${signal.side.toUpperCase()} / ${formatCompactVolume(signal.value)} @ ${signal.price.toFixed(1)}`,
      );
    }
  }
}

function playMarketExplorerTone(isBuy: boolean) {
  if (typeof window === "undefined" || !window.AudioContext) return;
  const context = new window.AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = isBuy ? 880 : 440;
  gain.gain.setValueAtTime(0.08, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.18);
  oscillator.addEventListener("ended", () => void context.close());
}

function playBigTradeSound(): void {
  try {
    const Ctx =
      (globalThis as { AudioContext?: typeof AudioContext }).AudioContext ??
      (globalThis as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (Ctx === undefined) return;
    const context = new Ctx();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 660;
    gain.gain.value = 0.3;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.15);
    oscillator.addEventListener("ended", () => void context.close());
  } catch {
    /* Sound is optional and must not interrupt realtime rendering. */
  }
}

function playLongTermLiquidityTouchTone(side: "bid" | "ask") {
  if (typeof window === "undefined" || !window.AudioContext) return;
  const context = new window.AudioContext();
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.1, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.32);
  gain.connect(context.destination);
  for (const [index, frequency] of (side === "bid" ? [660, 880] : [880, 660]).entries()) {
    const oscillator = context.createOscillator();
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    oscillator.start(context.currentTime + index * 0.11);
    oscillator.stop(context.currentTime + index * 0.11 + 0.14);
    if (index === 1) oscillator.addEventListener("ended", () => void context.close());
  }
}

function eventKey(event: LiquidityEvent): string {
  return [event.time, event.sequence, event.eventKind, event.action, event.side, event.price].join(":");
}

function mergeEvents(
  first: LiquidityEvent[],
  second: LiquidityEvent[],
  cutoff: number,
): LiquidityEvent[] {
  const merged = new Map<string, LiquidityEvent>();
  for (const event of [...first, ...second]) {
    if (event.time >= cutoff) merged.set(eventKey(event), event);
  }
  return [...merged.values()]
    .sort((a, b) => a.time - b.time)
    .slice(-MAX_EVENTS);
}

export function mergeHistoryLines(
  history: LiquidityLine[],
  current: Map<string, LiquidityLine>,
): Map<string, LiquidityLine> {
  const merged = new Map<string, LiquidityLine>();
  for (const line of history) merged.set(line.lineId, line);
  for (const line of current.values()) {
    const existing = merged.get(line.lineId);
    if (!existing) {
      merged.set(line.lineId, line);
    } else {
      merged.set(line.lineId, {
        ...(line.lastAt >= existing.lastAt ? line : existing),
        samples: mergeSizeSamples(knownLineSamples(existing), knownLineSamples(line)),
      });
    }
  }
  return merged;
}

export function mergeLiveLine(
  current: Map<string, LiquidityLine>,
  message: LiquidityUpdateMessage,
): Map<string, LiquidityLine> {
  if (!message.lineId) return current;
  const next = new Map(current);
  const existing = next.get(message.lineId);
  const samples = mergeSizeSamples(existing ? knownLineSamples(existing) : [], [{
    time: message.time, size: message.size, active: message.action !== "end",
  }]);
  if (existing && existing.lastAt > message.time) {
    next.set(message.lineId, { ...existing, samples });
    return next;
  }
  const active = message.action !== "end";
  next.set(message.lineId, {
    lineId: message.lineId,
    side: message.side,
    price: message.price,
    startedAt: message.lineStartTime ?? existing?.startedAt ?? message.time,
    lastAt: message.time,
    endedAt: active ? null : message.time,
    currentSize: message.size,
    peakSize: Math.max(existing?.peakSize ?? 0, message.size, message.previousSize),
    threshold: message.threshold,
    domDistance: message.domDistance,
    active,
    samples,
  });
  return next;
}

function toMarker(message: LiquidityUpdateMessage): LiquidityEvent {
  return {
    sequence: message.sequence,
    time: message.time,
    eventKind: message.eventKind as Exclude<LiquidityEventKind, "long_term">,
    action: message.action,
    side: message.side,
    price: message.price,
    size: message.size,
    previousSize: message.previousSize,
    change: message.change,
    threshold: message.threshold,
    domDistance: message.domDistance,
    strength: message.strength,
    lineId: message.lineId,
    lineStartTime: message.lineStartTime,
  };
}

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatTime(time: number): string {
  return timeFormatter.format(new Date(time));
}

function formatDateTime(time: number): string {
  return dateTimeFormatter.format(new Date(time));
}

function formatCompactVolume(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(0);
}

export function liquidityLineLabel(
  line: Pick<
    LiquidityLine,
    "price" | "currentSize" | "startedAt" | "lastAt" | "endedAt"
  >,
  settings: Pick<LiquidityTrackerSettings, "longTermMinAgeSeconds">,
  evaluationTime = Date.now(),
): string {
  const currentLabel = `${line.currentSize} @ ${line.price.toFixed(1)}`;
  return isLongTermLiquidityLine(line, settings, evaluationTime)
    ? `LT · ${currentLabel}`
    : currentLabel;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function timeScaleFromAxisDrag(
  startVisibleBars: number,
  horizontalDragPx: number,
): number {
  return Math.max(
    MIN_VISIBLE_BARS,
    Math.round(startVisibleBars * Math.exp(-horizontalDragPx * 0.007)),
  );
}

export function priceScaleFromAxisDrag(
  startScale: number,
  upwardDragPx: number,
): number {
  return clamp(
    startScale * Math.exp(upwardDragPx * 0.007),
    MIN_PRICE_SCALE,
    MAX_PRICE_SCALE,
  );
}

export function panOffsetFromDrag(
  startOffset: number,
  horizontalDragPx: number,
  pixelsPerBar: number,
  maxPastOffset: number,
  maxFutureOffset: number,
): number {
  const deltaBars = Math.round(horizontalDragPx / Math.max(1, pixelsPerBar));
  return clamp(
    startOffset + deltaBars,
    -Math.max(0, maxFutureOffset),
    Math.max(0, maxPastOffset),
  );
}

const LIQUIDITY_HISTORY_SETTING_FIELDS: Array<[
  LiquidityEventKind,
  Array<keyof LiquidityTrackerSettings>,
]> = [
  [
    "relative",
    ["relativeEnabled", "relativeTrigger", "relativeDomFrom", "relativeDomTo"],
  ],
  [
    "absolute",
    ["absoluteEnabled", "absoluteTrigger", "absoluteDomFrom", "absoluteDomTo"],
  ],
  [
    "long_term",
    [
      "longTermEnabled",
      "longTermTrigger",
      "longTermDomFrom",
      "longTermDomTo",
      "longTermMinAgeSeconds",
    ],
  ],
];

export function liquidityHistoryKindsChanged(
  previous: LiquidityTrackerSettings,
  next: LiquidityTrackerSettings,
): LiquidityEventKind[] {
  return LIQUIDITY_HISTORY_SETTING_FIELDS
    .filter(([, fields]) => fields.some((field) => previous[field] !== next[field]))
    .map(([kind]) => kind);
}

export function liquidityEventMatchesSettings(
  event: LiquidityEvent,
  settings: LiquidityTrackerSettings,
): boolean {
  if (event.eventKind === "relative" && event.lineId) {
    return false;
  }
  if (event.eventKind === "long_term_touch") {
    return longTermTouchMatchesSettings(event, settings);
  }
  const relative = event.eventKind === "relative";
  const enabled = relative ? settings.relativeEnabled : settings.absoluteEnabled;
  const trigger = relative ? settings.relativeTrigger : settings.absoluteTrigger;
  const domFrom = relative ? settings.relativeDomFrom : settings.absoluteDomFrom;
  const domTo = relative ? settings.relativeDomTo : settings.absoluteDomTo;
  if (!enabled || event.domDistance === null ||
    event.domDistance < domFrom || event.domDistance > domTo) return false;
  if (relative) return event.change >= trigger;
  return event.size >= trigger && event.previousSize < trigger;
}

export function liquidityLineMatchesSettings(
  line: LiquidityLine,
  settings: LiquidityTrackerSettings,
  _evaluationTime = Date.now(),
): boolean {
  if (!settings.longTermEnabled || line.threshold !== settings.longTermTrigger ||
    line.domDistance === null ||
    line.domDistance < settings.longTermDomFrom ||
    line.domDistance > settings.longTermDomTo) return false;
  return true;
}

export function isLongTermLiquidityLine(
  line: Pick<LiquidityLine, "startedAt" | "lastAt" | "endedAt">,
  settings: Pick<LiquidityTrackerSettings, "longTermMinAgeSeconds">,
  evaluationTime = Date.now(),
): boolean {
  const observedUntil = line.endedAt ?? Math.max(line.lastAt, evaluationTime);
  return observedUntil - line.startedAt >= settings.longTermMinAgeSeconds * 1_000;
}

export function longTermTouchMatchesSettings(
  event: Pick<
    LiquidityEvent,
    "time" | "threshold" | "domDistance" | "lineStartTime"
  >,
  settings: LiquidityTrackerSettings,
): boolean {
  return settings.longTermEnabled &&
    event.threshold === settings.longTermTrigger &&
    event.domDistance !== null &&
    event.domDistance >= settings.longTermDomFrom &&
    event.domDistance <= settings.longTermDomTo &&
    event.lineStartTime != null &&
    event.time - event.lineStartTime >= settings.longTermMinAgeSeconds * 1_000;
}

export function validateLiquidityTrackerSettings(
  settings: LiquidityTrackerSettings,
): string | null {
  const limits: Array<[NumericTrackerSetting, number, number]> = [
    ["relativeTrigger", 1, 1_000_000],
    ["relativeDomFrom", 0, 5_000],
    ["relativeDomTo", 0, 5_000],
    ["absoluteTrigger", 1, 1_000_000],
    ["absoluteDomFrom", 0, 5_000],
    ["absoluteDomTo", 0, 5_000],
    ["longTermTrigger", 1, 1_000_000],
    ["longTermDomFrom", 0, 5_000],
    ["longTermDomTo", 0, 5_000],
    ["longTermMinAgeSeconds", 1, 24 * 60 * 60],
  ];
  for (const [field, min, max] of limits) {
    const value = settings[field];
    if (!Number.isInteger(value) || value < min || value > max) {
      return `${field} must be an integer from ${min} to ${max}`;
    }
  }
  if (settings.relativeDomFrom > settings.relativeDomTo) {
    return "Relative DOM level to must be greater than or equal to level from";
  }
  if (settings.absoluteDomFrom > settings.absoluteDomTo) {
    return "Absolute DOM level to must be greater than or equal to level from";
  }
  if (settings.longTermDomFrom > settings.longTermDomTo) {
    return "Long-term DOM level to must be greater than or equal to level from";
  }
  return null;
}

export function validateBigTradeSettings(
  settings: BigTradeSettings,
): string | null {
  const sessionMinVolumes = normalizeBigTradeSessionMinVolumes(settings);
  for (const { key, label } of BIG_TRADE_SESSIONS) {
    const value = sessionMinVolumes[key];
    if (!Number.isInteger(value) || value < 0 || value > 100_000) {
      return `BigTrade ${label} minimum must be an integer from 0 to 100000`;
    }
  }
  if (
    !Number.isInteger(settings.maxVisible) ||
    settings.maxVisible < 1 ||
    settings.maxVisible > MAX_BIG_TRADE_VISIBLE
  ) {
    return `BigTrade display limit must be an integer from 1 to ${MAX_BIG_TRADE_VISIBLE}`;
  }
  return null;
}

export function validateMarketExplorerSettings(
  settings: MarketExplorerSettings,
): string | null {
  if (
    !Number.isInteger(settings.halftimeSeconds) ||
    settings.halftimeSeconds < 1 ||
    settings.halftimeSeconds > 3_600
  ) {
    return "Market Explorer halftime must be an integer from 1 to 3600";
  }
  const colorPattern = /^#[0-9a-f]{6}$/i;
  if (!colorPattern.test(settings.buyLineColor) || !colorPattern.test(settings.sellLineColor)) {
    return "Market Explorer line colors must use #RRGGBB";
  }
  const signal = settings.signal;
  if (!Number.isFinite(signal.askLevel) || signal.askLevel < 0.01) {
    return "Market Volume Stop Signal 1 Ask level must be positive";
  }
  if (!Number.isFinite(signal.bidLevel) || signal.bidLevel < 0.01) {
    return "Market Volume Stop Signal 1 Bid level must be positive";
  }
  if (!Number.isInteger(signal.pullbackDurationMinutes) || signal.pullbackDurationMinutes < 0 || signal.pullbackDurationMinutes > 1_440) {
    return "Market Volume Stop Signal 1 pullback duration must be from 0 to 1440";
  }
  if (!Number.isInteger(signal.pullbackPriceChangeTicks) || signal.pullbackPriceChangeTicks < 0 || signal.pullbackPriceChangeTicks > 100_000) {
    return "Market Volume Stop Signal 1 pullback price must be from 0 to 100000";
  }
  if (!Number.isFinite(settings.volumeSpike.triggerVolume) || settings.volumeSpike.triggerVolume < 0.01) {
    return "Volume Spike trigger volume must be positive";
  }
  if (!Number.isFinite(settings.volumeSpike.maximumDurationSeconds) || settings.volumeSpike.maximumDurationSeconds < 0.1 || settings.volumeSpike.maximumDurationSeconds > 60) {
    return "Volume Spike maximum duration must be from 0.1 to 60 seconds";
  }
  if (!Number.isInteger(settings.volumeSpike.priceRangeTicks) || settings.volumeSpike.priceRangeTicks < 1) {
    return "Volume Spike price range must be a positive integer";
  }
  if (!Number.isFinite(settings.volumeSpike.ratioGreaterEqual) || settings.volumeSpike.ratioGreaterEqual < 1) {
    return "Volume Spike ratio must be at least 1";
  }
  if (!Number.isFinite(settings.absorption.triggerVolume) || settings.absorption.triggerVolume < 0.01) {
    return "Absorption trigger volume must be positive";
  }
  if (!Number.isFinite(settings.absorption.maximumDurationSeconds) || settings.absorption.maximumDurationSeconds < 0.1 || settings.absorption.maximumDurationSeconds > 60) {
    return "Absorption maximum duration must be from 0.1 to 60 seconds";
  }
  const appearances: Array<[string, MarketExplorerAppearance]> = [
    ["Market Volume Stop Signal 1", signal],
    ["Volume Spike", settings.volumeSpike],
    ["Absorption", settings.absorption],
  ];
  for (const [label, appearance] of appearances) {
    if (!Number.isInteger(appearance.markerSize) || appearance.markerSize < 1 || appearance.markerSize > 5) {
      return `${label} marker size must be from 1 to 5`;
    }
    if (!colorPattern.test(appearance.buyColor) || !colorPattern.test(appearance.sellColor)) {
      return `${label} colors must use #RRGGBB`;
    }
  }
  return null;
}

export function pricePanFromChartDrag(
  startPanPx: number,
  verticalDragPx: number,
  plotHeight: number,
): number {
  const limit = Math.max(1, plotHeight) * 3;
  return clamp(startPanPx + verticalDragPx, -limit, limit);
}

export function priceFromChartY(
  y: number,
  plotTop: number,
  pricePlotHeight: number,
  priceMin: number,
  priceMax: number,
): number {
  const span = priceMax - priceMin;
  return priceMax - ((y - plotTop) / Math.max(1, pricePlotHeight)) * span;
}
