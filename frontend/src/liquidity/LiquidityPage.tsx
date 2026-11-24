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
import { useLiquidityHistoryRecovery } from "./useLiquidityHistoryRecovery";
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
  type VolumeDeltaPoint,
} from "../chart/indicatorReducer";
import { resolveEndpoints } from "../endpoints";
import type {
  ChartProfilePayload,
  LiquidityChartProfileState,
} from "../profiles/types";
import { ChartSocket } from "../socket/ChartSocket";
import { useNativeIcebergs } from "../orderflow/useNativeIcebergs";
import type {
  Bar,
  BigTradeMessage,
  LiquidityAction,
  LiquidityEventKind,
  LiquidityUpdateMessage,
  MarketExplorerSignal,
  NativeIcebergState,
  SiStopChain,
  Timeframe,
} from "../socket/messages";
import {
  DEFAULT_HEATMAP_SETTINGS,
  drawLiquidityLevel,
  heatmapLineEnd,
  heatmapLineVisible,
  knownLineSamples,
  mergeSizeSamples,
  normalizeHeatmapSettings,
  type LiquidityHeatmapSettings,
  type LiquiditySizeSample,
} from "./heatmap";
import { useVolumeDelta } from "./useVolumeDelta";
import { LIQUIDITY_CANDLE_RETENTION_MS, LIQUIDITY_HISTORY_PAGE_LIMIT, liquidityHistoryRanges } from "./historyRanges";
import { drawLiquidityCrosshair } from "./crosshair";
import { LineOpacityControl } from "./LineOpacityControl";
import { drawNativeIcebergs } from "./icebergs";
import {
  DEFAULT_ALERT_SOUNDS, SOUND_OPTIONS, normalizeAlertSounds, playLiquiditySound, unlockAlertAudio,
  type LiquidityAlertSounds, type LiquiditySound, type LiquiditySoundEvent,
} from "./alertSounds";
import { useIcebergAlerts } from "./useIcebergAlerts";
import {
  DEFAULT_ICEBERG_SESSION_MIN_VOLUMES,
  normalizeIcebergSessionMinVolumes, type IcebergSessionMinVolumes,
} from "./icebergSessions";
import { DEFAULT_ICEBERG_FILTERS, normalizeIcebergFilters, type IcebergFilterContext } from "./icebergFilters";
import { useIcebergAutoThreshold } from "./useIcebergAutoThreshold";
import { useSiStops } from "./useSiStops";
import { DEFAULT_SI_STOP_SETTINGS, normalizeSiStopSettings, siStopAutoThreshold, type SiStopSettings } from "./siStops";
import { drawSiStops } from "./drawSiStops";
import { SiStopSettingsEditor } from "./SiStopSettingsEditor";
import { SettingHelp, SettingFieldLabel } from "./SettingHelp";
import { useWorkspaceTheme } from "../workspace/useWorkspaceTheme";
import { useWidgetSync } from "../chart/shared/useWidgetSync";
import { CanvasChartHost, type HostNavigation } from "../chart/shared/CanvasChartHost";
import type { ChartSyncConnection } from "../chart/shared/sync";
import type { SharedChartProjection } from "../chart/shared/ChartSyncLayer";
import { workspaceColors, type WorkspaceColors } from "../workspace/themes";

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
const SETTINGS_SECTIONS = [
  ["heatmap", "Liquidity Heatmap"],
  ["relative", "Relative Liquidity"],
  ["absolute", "Absolute Liquidity"],
  ["longTerm", "Long-term Lines"],
  ["siStops", "SI Stops"],
  ["volumeSpike", "Volume Spike"],
  ["absorption", "Absorption"],
  ["bigTrade", "BigTrade"],
  ["iceberg", "Iceberg"],
  ["sounds", "Alert sounds"],
] as const;
type SettingsSection = typeof SETTINGS_SECTIONS[number][0];
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

type LiquidityTimeframe = Extract<Timeframe, "15s" | "30s" | "1m" | "5m">;

function liquidityTimeframeMs(tf: LiquidityTimeframe): number {
  return tf === "15s" ? 15_000 : tf === "30s" ? 30_000 : tf === "1m" ? 60_000 : 300_000;
}

function defaultLiquidityVisibleBars(tf: LiquidityTimeframe): number {
  return tf === "15s" ? 960 : tf === "30s" ? 480 : tf === "1m" ? 240 : 144;
}

function maxLiquidityVisibleBars(tf: LiquidityTimeframe): number {
  return LIQUIDITY_CANDLE_RETENTION_MS / liquidityTimeframeMs(tf);
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

interface MarketExplorerHistoryResponse {
  symbol: string;
  contract: string;
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
    source.timeframe === "15s" || source.timeframe === "30s" || source.timeframe === "5m"
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
    showNativeIcebergs: source.showNativeIcebergs !== false,
    nativeIcebergSessionMinVolumes: normalizeIcebergSessionMinVolumes(source.nativeIcebergSessionMinVolumes),
    nativeIcebergFilters: normalizeIcebergFilters(source.nativeIcebergFilters),
    siStops: normalizeSiStopSettings(source.siStops),
    alertSounds: normalizeAlertSounds(source.alertSounds),
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
  const sync = useWidgetSync({ symbol: SYMBOL, contract: CONTRACT, timeframe: tf });
  const [linkedNavigation, setLinkedNavigation] = useState<HostNavigation>({ revision: 0 });
  const linked = !!sync.config?.groupId && (sync.config.syncViewport || sync.config.syncDrawings);
  const [bars, setBars] = useState<Bar[]>([]);
  const [events, setEvents] = useState<LiquidityEvent[]>([]);
  const [lines, setLines] = useState<Map<string, LiquidityLine>>(new Map());
  const [marketVolumeSignals, setMarketVolumeSignals] = useState<MarketExplorerSignal[]>([]);
  const [bigTrades, setBigTrades] = useState<readonly BigTradeMarker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<"connected" | "disconnected">(
    "disconnected",
  );
  const [reloadKey, setReloadKey] = useState(0);
  useLiquidityHistoryRecovery(socket, setReloadKey);
  const { bars: volumeDelta, error: volumeDeltaError } = useVolumeDelta(
    socket, endpoints.api, tf, liquidityTimeframeMs(tf), reloadKey,
  );
  const [visibleBars, setVisibleBars] = useState(240);
  const [offsetBars, setOffsetBars] = useState(0);
  const [priceScale, setPriceScale] = useState(1);
  const [pricePanPx, setPricePanPx] = useState(0);
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS });
  const [filtersDraft, setFiltersDraft] = useState<Filters>({ ...DEFAULT_FILTERS });
  const [heatmapSettings, setHeatmapSettings] = useState<LiquidityHeatmapSettings>(DEFAULT_HEATMAP_SETTINGS);
  const [heatmapDraft, setHeatmapDraft] = useState<LiquidityHeatmapSettings>(DEFAULT_HEATMAP_SETTINGS);
  const [showVwap, setShowVwap] = useState(true);
  const [showBigTrades, setShowBigTrades] = useState(true);
  const [showNativeIcebergs, setShowNativeIcebergs] = useState(true);
  const [nativeIcebergSessionMinVolumes, setNativeIcebergSessionMinVolumes] =
    useState<IcebergSessionMinVolumes>({ ...DEFAULT_ICEBERG_SESSION_MIN_VOLUMES });
  const [icebergFilters, setIcebergFilters] = useState({ ...DEFAULT_ICEBERG_FILTERS });
  const [icebergDraft, setIcebergDraft] = useState({
    enabled: true, sessionMinVolumes: { ...DEFAULT_ICEBERG_SESSION_MIN_VOLUMES }, filters: { ...DEFAULT_ICEBERG_FILTERS },
  });
  const [showBigTradesDraft, setShowBigTradesDraft] = useState(true);
  const [alertSounds, setAlertSounds] = useState<LiquidityAlertSounds>({ ...DEFAULT_ALERT_SOUNDS });
  const [alertSoundsDraft, setAlertSoundsDraft] = useState<LiquidityAlertSounds>({ ...DEFAULT_ALERT_SOUNDS });
  const alertSoundsRef = useRef(alertSounds);
  alertSoundsRef.current = alertSounds;
  const nativeIcebergs = useNativeIcebergs(
    socket, endpoints.api, SYMBOL, CONTRACT, showNativeIcebergs, 1,
  );
  const icebergAuto = useIcebergAutoThreshold(nativeIcebergs.icebergs, icebergFilters,
    nativeIcebergs.synchronized, nativeIcebergs.sessionId);
  const icebergFilter = useMemo<IcebergFilterContext>(() => ({ settings: icebergFilters,
    autoThreshold: icebergAuto.threshold, sessionMinVolumes: nativeIcebergSessionMinVolumes }),
  [icebergFilters, icebergAuto.threshold, nativeIcebergSessionMinVolumes]);
  const chartIcebergs = useMemo(() => showNativeIcebergs
    ? nativeIcebergs.icebergs.filter((row) =>
      row.status !== "active" || (nativeIcebergs.connected && nativeIcebergs.synchronized)) : [],
  [showNativeIcebergs, nativeIcebergs.icebergs, nativeIcebergs.connected, nativeIcebergs.synchronized]);
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
  const [marketExplorerToast, setMarketExplorerToast] = useState<string | null>(null);
  const [siStopSettings, setSiStopSettings] = useState<SiStopSettings>(() => normalizeSiStopSettings(undefined));
  const [siStopDraft, setSiStopDraft] = useState<SiStopSettings>(() => normalizeSiStopSettings(undefined));
  const siStops = useSiStops(socket, endpoints.api, siStopSettings, profileHydrated,
    alertSounds.volumeStop, setMarketExplorerToast);
  useIcebergAlerts(socket, nativeIcebergs, profileHydrated && showNativeIcebergs && alertSounds.icebergEnabled,
    icebergFilters.automatic ? icebergAuto.threshold : nativeIcebergSessionMinVolumes, alertSounds.iceberg);
  const [clock, setClock] = useState(Date.now());
  const siStopRowsRef = useRef(siStops.chains);
  siStopRowsRef.current = siStops.chains;
  const siStopSampleMinute = Math.floor(clock / 60_000);
  // Match SI's minute refresh; settings/bootstrap changes recalculate immediately.
  const siStopAuto = useMemo(() => siStopAutoThreshold(siStopRowsRef.current, siStopSettings, Date.now()),
    [siStopSampleMinute, siStopSettings.automatic, siStopSettings.intervalMinutes,
      siStopSettings.standardDeviations, siStops.sessionId, siStops.synchronized]);
  const siStopThreshold = siStopSettings.automatic ? siStopAuto.threshold : siStopSettings.minVolume;
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
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("heatmap");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);

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
        setShowNativeIcebergs(state.showNativeIcebergs !== false);
        setNativeIcebergSessionMinVolumes(normalizeIcebergSessionMinVolumes(state.nativeIcebergSessionMinVolumes));
        setIcebergFilters(normalizeIcebergFilters(state.nativeIcebergFilters));
        setSiStopSettings(normalizeSiStopSettings(state.siStops));
        setAlertSounds(normalizeAlertSounds(state.alertSounds));
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
        setShowNativeIcebergs(localState.showNativeIcebergs !== false);
        setNativeIcebergSessionMinVolumes(normalizeIcebergSessionMinVolumes(localState.nativeIcebergSessionMinVolumes));
        setIcebergFilters(normalizeIcebergFilters(localState.nativeIcebergFilters));
        setSiStopSettings(normalizeSiStopSettings(localState.siStops));
        setAlertSounds(normalizeAlertSounds(localState.alertSounds));
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
      showNativeIcebergs,
      nativeIcebergSessionMinVolumes,
      nativeIcebergFilters: icebergFilters,
      siStops: siStopSettings,
      alertSounds,
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
      showNativeIcebergs,
      nativeIcebergSessionMinVolumes,
      icebergFilters,
      siStopSettings,
      alertSounds,
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
    const unlock = () => unlockAlertAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

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
    const reconnectTimer = window.setInterval(() => socket.ensureConnected(45_000, 10_000), 5_000);
    return () => {
      window.clearInterval(reconnectTimer);
      offOpen();
      offClose();
      socket.close(1000, "liquidity page unmount");
    };
  }, [socket]);

  useEffect(() => {
    setBars([]);
    socket.subscribe(SYMBOL, ["bar_update"], tf);
    socket.subscribe(SYMBOL, ["liquidity_update"]);
    socket.subscribe(SYMBOL, ["market_explorer_update"]);
    socket.subscribe(SYMBOL, ["big_trade"]);
    socket.subscribe(SYMBOL, ["market_data_status"]);
    const offBar = socket.on("bar_update", (message) => {
      if (message.symbol !== SYMBOL || message.contract !== CONTRACT || message.tf !== tf) {
        return;
      }
      setBars((current) => mergeBars(current, [message.bar], Date.now() - LIQUIDITY_CANDLE_RETENTION_MS));
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
          longTermTouchMatchesSettings(message, trackerSettingsRef.current) &&
          alertSoundsRef.current.longTermEnabled
        ) {
          playLiquiditySound("longTerm", alertSoundsRef.current.longTerm);
        }
      }
    });
    const offMarketExplorer = socket.on("market_explorer_update", (message) => {
      if (message.symbol !== SYMBOL || message.contract !== CONTRACT) return;
      const cutoff = Date.now() - RETENTION_MS;
      if (message.signals.length > 0) {
        setMarketVolumeSignals((current) =>
          mergeMarketVolumeSignals(current, message.signals, cutoff),
        );
        notifyMarketVolumeSignals(
          message.signals,
          marketExplorerSettingsRef.current,
          setMarketExplorerToast,
          alertSoundsRef.current,
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
        playLiquiditySound("bigTrade", alertSoundsRef.current.bigTrade);
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
      socket.unsubscribe(SYMBOL, ["market_data_status"]);
    };
  }, [socket, tf]);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    const to = Date.now();
    const from = to - RETENTION_MS;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const barsFrom = to - LIQUIDITY_CANDLE_RETENTION_MS;
    const historyRanges = liquidityHistoryRanges(barsFrom, to, liquidityTimeframeMs(tf));
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

    const candleHistory = Promise.all(historyRanges.map((range) => fetch(buildHistoryUrl({
        symbol: SYMBOL, contract: CONTRACT, timeframe: tf, ...range,
        limit: LIQUIDITY_HISTORY_PAGE_LIMIT,
      }, endpoints.api), { signal: controller.signal }).then(readJson<HistoryResponse>)))
      .then((pages) => {
        if (controller.signal.aborted || sequence !== requestSequence.current) return;
        const timeframeMs = liquidityTimeframeMs(tf);
        const liveBucketTime = to - to % timeframeMs;
        setBars((current) => mergeHistoryBars(
          pages.flatMap((page) => page.bars), current, barsFrom, liveBucketTime,
        ));
      });
    Promise.allSettled([
      candleHistory,
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
        if (controller.signal.aborted || sequence !== requestSequence.current) return;
        if (liquidity.status === "fulfilled") {
          setEvents((current) => mergeEvents(liquidity.value.events, current, from));
          setLines((current) => mergeHistoryLines(liquidity.value.lines, current));
        }
        if (marketExplorer.status === "fulfilled") {
          setMarketVolumeSignals((current) =>
            mergeMarketVolumeSignals(marketExplorer.value.signals, current, from));
        }
        if (bigTradeHistory.status === "fulfilled") {
          setBigTrades((current) => mergeLiquidityBigTrades(bigTradeHistory.value.trades, current, from));
        }
        const failure = [history, liquidity, marketExplorer, bigTradeHistory].find(
          (result) => result.status === "rejected",
        );
        if (failure?.status === "rejected") {
          setError(failure.reason instanceof Error ? failure.reason.message : "Liquidity data load failed");
        }
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted || sequence !== requestSequence.current) return;
        setError(cause instanceof Error ? cause.message : "Liquidity data load failed");
      })
      .finally(() => {
        if (!controller.signal.aborted && sequence === requestSequence.current) setLoading(false);
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
      if (linked) { setLinkedNavigation(current => ({ revision: current.revision + 1, factor })); return; }
      setVisibleBars((current) =>
        clamp(Math.round(current * factor), MIN_VISIBLE_BARS, maxVisible),
      );
    },
    [maxVisible, linked],
  );

  const openSettings = () => {
    unlockAlertAudio();
    setFiltersDraft({ ...filters });
    setShowBigTradesDraft(showBigTrades);
    setIcebergDraft({ enabled: showNativeIcebergs, sessionMinVolumes: { ...nativeIcebergSessionMinVolumes }, filters: { ...icebergFilters } });
    setSiStopDraft({ ...siStopSettings });
    setAlertSoundsDraft({ ...alertSounds });
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
      setFilters({ ...filtersDraft });
      setShowBigTrades(showBigTradesDraft);
      setShowNativeIcebergs(icebergDraft.enabled);
      setNativeIcebergSessionMinVolumes(normalizeIcebergSessionMinVolumes(icebergDraft.sessionMinVolumes));
      setIcebergFilters(normalizeIcebergFilters(icebergDraft.filters));
      setSiStopSettings(normalizeSiStopSettings(siStopDraft));
      setAlertSounds(normalizeAlertSounds(alertSoundsDraft));
      setBigTradeSettings(nextBigTradeSettings);
      setBigTradeDraft(nextBigTradeSettings);
      setSettingsNotice("Saved detectors, layers and sound settings");
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
          <span>GC Liquidity</span>
          <span>Liquidity Heatmap + Volume Delta, SI Stops, Volume Spike and Absorption</span>
        </div>
        <div className="liquidity-segmented" aria-label="Timeframe">
          {(["15s", "30s", "1m", "5m"] as const).map((value) => (
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
          <LineOpacityControl
            value={heatmapSettings.opacity}
            onChange={(opacity) => setHeatmapSettings((current) => ({ ...current, opacity }))}
          />
          <FilterToggle
            label="VWAP"
            checked={showVwap}
            onChange={setShowVwap}
          />
        </div>
        <div className="liquidity-actions">
          <button type="button" title="Zoom out" onClick={() => zoom(1.25)}>−</button>
          <button type="button" title="Zoom in" onClick={() => zoom(0.8)}>+</button>
          <button type="button" onClick={() => { if (linked) setLinkedNavigation(current => ({ revision: current.revision + 1, latest: true })); else setOffsetBars(0); }}>Latest</button>
          <button type="button" className="liquidity-icon-button" title="Settings" aria-label="Settings" onClick={openSettings}>⚙</button>
          <button type="button" className="liquidity-icon-button" title="Reload" aria-label="Reload" onClick={() => setReloadKey((value) => value + 1)}>
            ↻
          </button>
        </div>
        <div className={`liquidity-connection is-${connection}`}>
          <span aria-hidden="true" />
          {loading ? "Loading" : error ?? volumeDeltaError ?? connection}
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
                <strong>LQ Settings</strong>
              </div>
              <button type="button" onClick={() => setSettingsOpen(false)} aria-label="Close settings">
                ×
              </button>
            </header>

            <label className="liquidity-settings-category">
              Category
              <select value={settingsSection} onChange={(event) => setSettingsSection(event.currentTarget.value as SettingsSection)}>
                {SETTINGS_SECTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>

            <div className="liquidity-settings-groups">
              <fieldset className="liquidity-settings-group" hidden={settingsSection !== "heatmap"}>
                <legend>Liquidity Heatmap</legend>
                <LayerSetting label="Enable Heatmap" checked={filtersDraft.longTerm}
                  help="Show or hide the liquidity heatmap on the chart. The age and intensity settings below affect only the display of collected lines."
                  onChange={(longTerm) => setFiltersDraft((current) => ({ ...current, longTerm }))} />
                <div className="liquidity-settings-fields">
                  <SettingNumber
                    label="Minimum lifetime (seconds)"
                    disabled={false}
                    help="Show only liquidity that has lasted at least this many seconds. The 60-second default filters brief appearances; 0 disables the age filter. Line segments shorter than 3 pixels remain hidden."
                    value={heatmapDraft.minDurationSeconds}
                    min={0} max={600}
                    onChange={(value) => setHeatmapDraft((current) => normalizeHeatmapSettings({ ...current, minDurationSeconds: value }))}
                  />
                  <SettingNumber
                    label="Full intensity (x trigger)"
                    disabled={false}
                    help="Size at this multiple of Trigger liquidity reaches maximum intensity. For example, trigger 10 with factor 4 gives maximum intensity at size 40. Size changes brighten or darken only new line segments."
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
                hidden={settingsSection !== "relative"}
                title="Relative Liquidity Change"
                help="Compare the current size with the previous update at the same price to mark added or removed liquidity. When a trade hits a Short/Long-term line and the line disappears, the removed size also appears as a negative Relative marker."
                enableHelp="Turning this off stops new Relative markers. Existing markers in the 24-hour history are retained."
                enabled={settingsDraft.relativeEnabled}
                onEnabledChange={(relativeEnabled) =>
                  setSettingsDraft((current) => ({ ...current, relativeEnabled }))
                }
              >
                <LayerSetting label="Show Relative on chart" checked={filtersDraft.relative}
                  help="Show or hide received Relative liquidity-change markers. This changes the display layer without disabling the Relative tracker."
                  onChange={(relative) => setFiltersDraft((current) => ({ ...current, relative }))} />
                <SettingNumber
                  label="Trigger liquidity"
                  help="Minimum size change at one price level. The original TTW GC setting uses 50 contracts. Markers show the signed change, such as +50 or -50. Lower thresholds are more sensitive but produce more noise."
                  value={settingsDraft.relativeTrigger}
                  min={1}
                  max={1_000_000}
                  disabled={!settingsDraft.relativeEnabled}
                  onChange={(value) => updateSettingNumber("relativeTrigger", value)}
                />
                <SettingNumber
                  label="DOM level from"
                  help="Nearest distance from the best bid or ask. Level 0 is the best price; level 20 starts tracking 20 ticks away from the market."
                  value={settingsDraft.relativeDomFrom}
                  min={0}
                  max={5_000}
                  disabled={!settingsDraft.relativeEnabled}
                  onChange={(value) => updateSettingNumber("relativeDomFrom", value)}
                />
                <SettingNumber
                  label="DOM level to"
                  help="Farthest tracked distance. Only DOM levels from From to To generate signals. Larger values scan deeper but may include liquidity less relevant to current timing."
                  value={settingsDraft.relativeDomTo}
                  min={0}
                  max={5_000}
                  disabled={!settingsDraft.relativeEnabled}
                  onChange={(value) => updateSettingNumber("relativeDomTo", value)}
                />
              </LiquiditySettingsGroup>

              <LiquiditySettingsGroup
                hidden={settingsSection !== "absolute"}
                title="Absolute Liquidity Change"
                help="Track the total resting size at each price level and signal when it crosses an absolute threshold, regardless of the size change in the latest update."
                enableHelp="Turning this off stops new Absolute markers. Recorded 24-hour history is retained."
                enabled={settingsDraft.absoluteEnabled}
                onEnabledChange={(absoluteEnabled) =>
                  setSettingsDraft((current) => ({ ...current, absoluteEnabled }))
                }
              >
                <LayerSetting label="Show Absolute on chart" checked={filtersDraft.absolute}
                  help="Show or hide markers for liquidity reaching the absolute threshold. This changes the display layer without disabling the Absolute tracker."
                  onChange={(absolute) => setFiltersDraft((current) => ({ ...current, absolute }))} />
                <SettingNumber
                  label="Trigger liquidity"
                  help="Minimum total size at one price level to trigger an Absolute signal. For example, 500 triggers when size rises from below 500 to at least 500 contracts. The signal rearms after size drops below about 90% of the threshold."
                  value={settingsDraft.absoluteTrigger}
                  min={1}
                  max={1_000_000}
                  disabled={!settingsDraft.absoluteEnabled}
                  onChange={(value) => updateSettingNumber("absoluteTrigger", value)}
                />
                <SettingNumber
                  label="DOM level from"
                  help="Nearest DOM level checked, measured from the best bid or ask. Level 0 is the best price; 1 excludes the best bid and ask themselves."
                  value={settingsDraft.absoluteDomFrom}
                  min={0}
                  max={5_000}
                  disabled={!settingsDraft.absoluteEnabled}
                  onChange={(value) => updateSettingNumber("absoluteDomFrom", value)}
                />
                <SettingNumber
                  label="DOM level to"
                  help="Farthest DOM level checked. A small range focuses near the current price; a large range looks deeper into the order book and often includes more distant orders."
                  value={settingsDraft.absoluteDomTo}
                  min={0}
                  max={5_000}
                  disabled={!settingsDraft.absoluteEnabled}
                  onChange={(value) => updateSettingNumber("absoluteDomTo", value)}
                />
              </LiquiditySettingsGroup>

              <LiquiditySettingsGroup
                hidden={settingsSection !== "longTerm"}
                title="Long-term Liquidity Lines"
                help="Liquidity lines appear as soon as the size threshold is reached. Age is tracked in the background; only lines lasting continuously for the configured duration receive a Long-term label and sound when trades hit the band."
                enableHelp="Turning this off stops tracking and creating new liquidity lines. Active lines end when the settings are applied."
                enabled={settingsDraft.longTermEnabled}
                onEnabledChange={(longTermEnabled) =>
                  setSettingsDraft((current) => ({ ...current, longTermEnabled }))
                }
              >
                <SoundSetting event="longTerm" label="Long-term touch" enabled={alertSoundsDraft.longTermEnabled}
                  sound={alertSoundsDraft.longTerm}
                  onEnabledChange={(longTermEnabled) => setAlertSoundsDraft((current) => ({ ...current, longTermEnabled }))}
                  onSoundChange={(longTerm) => setAlertSoundsDraft((current) => ({ ...current, longTerm }))} />
                <SettingNumber
                  label="Trigger liquidity"
                  help="Minimum size at a price level to start a liquidity line. Display behavior is unchanged; line age determines only the Long-term label and sound."
                  value={settingsDraft.longTermTrigger}
                  min={1}
                  max={1_000_000}
                  disabled={!settingsDraft.longTermEnabled}
                  onChange={(value) => updateSettingNumber("longTermTrigger", value)}
                />
                <SettingNumber
                  label="DOM level from"
                  help="Nearest distance from the best bid or ask observed by the liquidity-line tracker. Level 0 includes the current best price."
                  value={settingsDraft.longTermDomFrom}
                  min={0}
                  max={5_000}
                  disabled={!settingsDraft.longTermEnabled}
                  onChange={(value) => updateSettingNumber("longTermDomFrom", value)}
                />
                <SettingNumber
                  label="DOM level to"
                  help="Farthest distance from the best bid or ask observed by the liquidity-line tracker. Only levels within the From–To range can create lines."
                  value={settingsDraft.longTermDomTo}
                  min={0}
                  max={5_000}
                  disabled={!settingsDraft.longTermEnabled}
                  onChange={(value) => updateSettingNumber("longTermDomTo", value)}
                />
                <SettingNumber
                  label="Long-term after (hours)"
                  help="Hours a line must last continuously to qualify as Long-term. Default: 4 hours. If size drops below about 90% of the threshold, the line ends and its next appearance starts with age zero."
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
              <SiStopSettingsEditor settings={siStopDraft} onChange={setSiStopDraft} hidden={settingsSection !== "siStops"} />
              <MarketExplorerSettingsEditor
                section={settingsSection}
                settings={marketExplorerDraft}
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
              <fieldset className="liquidity-settings-group" hidden={settingsSection !== "bigTrade"}>
                <legend>BigTrade</legend>
                <LayerSetting label="Enable BigTrade" checked={showBigTradesDraft} onChange={setShowBigTradesDraft}
                  help="Show or hide large-trade bubbles. The volume threshold and enabled state are shared with BigTrade on the main chart. These are large trades rather than stop or iceberg signals." />
                <div className="liquidity-settings-fields">
                  {BIG_TRADE_SESSIONS.map(({ key, label }) => (
                    <SettingNumber
                      key={key}
                      label={`${label} min volume`}
                      help={`Minimum executed volume to show a BigTrade in the ${label} session, using New York time as on the main chart. The unit is contracts rather than trade count. These windows differ from the Iceberg UTC+7 schedule.`}
                      value={normalizeBigTradeSessionMinVolumes(bigTradeDraft)[key]}
                      min={0}
                      max={100_000}
                      disabled={false}
                      onChange={(value) => updateBigTradeSessionVolume(key, value)}
                    />
                  ))}
                  <SettingNumber
                    label="Display limit"
                    help="Number of recent BigTrade bubbles retained for display. For example, 100 retains up to 100 bubbles; this does not set a trade volume threshold."
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
                  <SoundSetting event="bigTrade" label="BigTrade" enabled={bigTradeDraft.soundEnabled === true}
                    sound={alertSoundsDraft.bigTrade}
                    onEnabledChange={(soundEnabled) => setBigTradeDraft((current) => ({ ...current, soundEnabled }))}
                    onSoundChange={(bigTrade) => setAlertSoundsDraft((current) => ({ ...current, bigTrade }))} />
                </div>
              </fieldset>
              <fieldset className="liquidity-settings-group" hidden={settingsSection !== "iceberg"}>
                <legend>Iceberg</legend>
                <LayerSetting label="Enable Iceberg" checked={icebergDraft.enabled}
                  help="Show or hide ICE detected from Rithmic MBO. Each ICE has its own state and total executed volume. Turning Iceberg off also stops ICE alerts on this page."
                  onChange={(enabled) => setIcebergDraft((current) => ({ ...current, enabled }))} />
                <div className="liquidity-settings-fields">
                  <LayerSetting label="Auto volume threshold" checked={icebergDraft.filters.automatic}
                    help="Calculate minimum volume automatically from executed/canceled ICE in the lookback window, updating each minute. Auto replaces the US and Other sessions thresholds below."
                    onChange={(automatic) => setIcebergDraft((current) => ({ ...current, filters: { ...current.filters, automatic } }))} />
                  <SettingNumber label="Auto lookback (minutes)"
                    help="Lookback in minutes for sampling executed/canceled ICE detected during that window. Active and invalidated ICE are excluded. The threshold updates each minute."
                    value={icebergDraft.filters.lookbackMinutes} min={1} max={2880}
                    disabled={!icebergDraft.enabled || !icebergDraft.filters.automatic}
                    onChange={(lookbackMinutes) => setIcebergDraft((current) => ({ ...current, filters: { ...current.filters, lookbackMinutes } }))} />
                  <SettingNumber label="Auto SD multiplier"
                    help="Minimum for each ICE = mean volume + this factor × standard deviation, rounded down and capped at the largest sample. Higher factors generally filter more strictly. With no samples, the threshold is 0."
                    value={icebergDraft.filters.standardDeviations} min={0} max={10} step={0.1}
                    disabled={!icebergDraft.enabled || !icebergDraft.filters.automatic}
                    onChange={(standardDeviations) => setIcebergDraft((current) => ({ ...current, filters: { ...current.filters, standardDeviations } }))} />
                  <span className="liquidity-sound-hint">Applied Auto: {icebergAuto.threshold} contracts / {icebergAuto.sampleCount} completed orders. Settings changes apply on Save.</span>
                  {([
                    ["us", "US min (19:00-04:00)"],
                    ["other", "Other sessions min (04:00-19:00)"],
                  ] as const).map(([session, label]) => (
                    <SettingNumber key={session} label={label}
                      help="Minimum executed contracts per ICE when Auto is off. The session uses detection time in fixed UTC+7: US 19:00–04:00; other hours 04:00–19:00. Auto replaces these thresholds when enabled."
                      value={icebergDraft.sessionMinVolumes[session]} min={1} max={1_000_000} disabled={!icebergDraft.enabled || icebergDraft.filters.automatic}
                      onChange={(value) => {
                        if (Number.isFinite(value)) setIcebergDraft((current) => ({ ...current,
                          sessionMinVolumes: { ...current.sessionMinVolumes, [session]: clamp(Math.round(value), 1, 1_000_000) },
                        }));
                      }} />
                  ))}
                  <span className="liquidity-sound-hint">UTC+7. The session follows when each iceberg first appears. Defaults: US 10, other sessions 5.</span>
                  {([
                    ["applyToActive", "Apply volume threshold to active ICE", "Apply minimum volume to active ICE too. Turn off to see active ICE early, even when executed volume is still small."],
                    ["aggregate", "Group nearby same-side icons", "Group nearby ICE icons on the same bid/ask side for readability. The group label shows total volume; each ICE keeps its own identity and state."],
                    ["showFiltered", "Show below-threshold icons faded", "Fade ICE that fail the filters instead of hiding them. Filtered ICE form separate groups and do not contribute to groups that pass the threshold."],
                    ["showActive", "Show active ICE", "Show ICE still being tracked in the synchronized MBO session. Volume is the quantity executed so far rather than the entire hidden size."],
                    ["showExecuted", "Show executed ICE", "Show historical traces of ICE that ended after executing all of the tracked quantity."],
                    ["showCanceled", "Show canceled ICE", "Show historical traces of canceled ICE. Volume remains the quantity executed before cancellation rather than the canceled quantity."],
                    ["showInvalidated", "Show invalidated historical ICE", "Show historical ICE that can no longer be tracked reliably, such as after a session change, reconnect, or consistency loss. Invalidated does not mean the exchange confirmed cancellation."],
                  ] as const).map(([key, label, help]) => (
                    <LayerSetting key={key} label={label} help={help} checked={icebergDraft.filters[key]}
                      onChange={(checked) => setIcebergDraft((current) => ({ ...current, filters: { ...current.filters, [key]: checked } }))} />
                  ))}
                  <SettingNumber label="Group minimum volume" help="Minimum total contracts after filtering individual ICE and grouping. Excluded ICE cannot contribute to passing groups. 0 disables this additional threshold."
                    value={icebergDraft.filters.aggregateMinVolume} min={0} max={1_000_000} disabled={!icebergDraft.enabled}
                    onChange={(aggregateMinVolume) => setIcebergDraft((current) => ({ ...current, filters: { ...current.filters, aggregateMinVolume } }))} />
                  <SettingNumber label="Group time area" help="Horizontal grouping distance on screen rather than seconds. 10 is about one icon width. Increase to group farther apart; groups may change with zoom. Icons stay anchored to candle centers."
                    value={icebergDraft.filters.timeArea} min={0} max={1000} disabled={!icebergDraft.enabled || !icebergDraft.filters.aggregate}
                    onChange={(timeArea) => setIcebergDraft((current) => ({ ...current, filters: { ...current.filters, timeArea } }))} />
                  <SettingNumber label="Group price area" help="Vertical grouping distance on screen rather than ticks. 10 is about one icon height. Totals are combined for display only; each ICE retains its identity and state."
                    value={icebergDraft.filters.priceArea} min={0} max={1000} disabled={!icebergDraft.enabled || !icebergDraft.filters.aggregate}
                    onChange={(priceArea) => setIcebergDraft((current) => ({ ...current, filters: { ...current.filters, priceArea } }))} />
                  <SettingNumber label="Filtered opacity (%)" help="Opacity of below-threshold ICE: 0% is transparent; 100% is fully visible. Used only when faded below-threshold icons are enabled. State-specific opacity still applies separately."
                    value={Math.round(icebergDraft.filters.filteredOpacity * 100)} min={0} max={100} disabled={!icebergDraft.enabled || !icebergDraft.filters.showFiltered}
                    onChange={(value) => setIcebergDraft((current) => ({ ...current, filters: { ...current.filters, filteredOpacity: value / 100 } }))} />
                  <SoundSetting event="iceberg" label="ICE volume reached" enabled={alertSoundsDraft.icebergEnabled}
                    sound={alertSoundsDraft.iceberg}
                    onEnabledChange={(icebergEnabled) => setAlertSoundsDraft((current) => ({ ...current, icebergEnabled }))}
                    onSoundChange={(iceberg) => setAlertSoundsDraft((current) => ({ ...current, iceberg }))} />
                  <span className="liquidity-sound-hint">Voice reads “Iceberg”. If speech is unavailable, a chime is used. Sounds follow the volume filter while Iceberg is enabled.</span>
                </div>
              </fieldset>
              <fieldset className="liquidity-settings-group" hidden={settingsSection !== "sounds"}>
                <legend>Market Explorer sounds</legend>
                <div className="liquidity-settings-fields">
                  {([
                    ["volumeSpike", "Volume Spike", "volumeSpike"],
                    ["absorption", "Absorption", "absorption"],
                  ] as const).map(([event, label, key]) => (
                    <SoundSetting key={event} event={event} label={label}
                      enabled={marketExplorerDraft[key].alertSound} sound={alertSoundsDraft[event]}
                      onEnabledChange={(alertSound) => setMarketExplorerDraft((current) => ({
                        ...current, [key]: { ...current[key], alertSound },
                      }))}
                      onSoundChange={(sound) => setAlertSoundsDraft((current) => ({ ...current, [event]: sound }))} />
                  ))}
                  <SoundSetting event="volumeStop" label="SI Stops" enabled={siStopDraft.alertSound}
                    sound={alertSoundsDraft.volumeStop}
                    onEnabledChange={(alertSound) => setSiStopDraft((current) => ({ ...current, alertSound }))}
                    onSoundChange={(volumeStop) => setAlertSoundsDraft((current) => ({ ...current, volumeStop }))} />
                </div>
              </fieldset>
            </div>

            <footer>
              <div className={settingsError ? "is-error" : "is-ok"}>
                {settingsError ?? settingsNotice}
              </div>
              <button
                type="button"
                onClick={() => {
                  setHeatmapDraft({ ...DEFAULT_HEATMAP_SETTINGS });
                  setFiltersDraft({ ...DEFAULT_FILTERS });
                  setShowBigTradesDraft(true);
                  setIcebergDraft({ enabled: true, sessionMinVolumes: { ...DEFAULT_ICEBERG_SESSION_MIN_VOLUMES }, filters: { ...DEFAULT_ICEBERG_FILTERS } });
                  setSiStopDraft({ ...DEFAULT_SI_STOP_SETTINGS });
                  setAlertSoundsDraft({ ...DEFAULT_ALERT_SOUNDS });
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
        navigation={linkedNavigation}
        sync={sync}
        bars={bars}
        icebergs={chartIcebergs}
        icebergFilter={icebergFilter}
        siStops={siStops.chains}
        siStopSettings={siStopSettings}
        siStopThreshold={siStopThreshold}
        events={configuredEvents}
        lines={configuredLines}
        volumeDelta={volumeDelta}
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

      {marketExplorerToast ? (
        <div className="liquidity-market-explorer-toast">{marketExplorerToast}</div>
      ) : null}
    </div>
  );
}

function LiquidityCanvas({
  navigation,
  sync,
  bars,
  icebergs,
  icebergFilter,
  siStops,
  siStopSettings,
  siStopThreshold,
  events,
  lines,
  volumeDelta,
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
  navigation: HostNavigation;
  sync: ChartSyncConnection;
  bars: Bar[];
  icebergs: readonly NativeIcebergState[];
  icebergFilter: IcebergFilterContext;
  siStops: readonly SiStopChain[];
  siStopSettings: SiStopSettings;
  siStopThreshold: number;
  events: LiquidityEvent[];
  lines: LiquidityLine[];
  volumeDelta: readonly VolumeDeltaPoint[];
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
  const theme = useWorkspaceTheme();
  const colors = useMemo(() => workspaceColors(theme), [theme]);
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

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width <= 0 || size.height <= 0) return;
    drawLiquidityChart(canvas, size, {
      colors,
      bars,
      icebergs,
      icebergFilter,
      siStops,
      siStopSettings,
      siStopThreshold,
      events,
      lines,
      volumeDelta,
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
    colors,
    bars,
    icebergs,
    icebergFilter,
    siStops,
    siStopSettings,
    siStopThreshold,
    bigTrades,
    bigTradeSettings,
    events,
    filters,
    hover,
    lines,
    marketExplorerSettings,
    trackerSettings,
    heatmapSettings,
    volumeDelta,
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

  if (sync.config?.groupId && (sync.config.syncViewport || sync.config.syncDrawings)) return <CanvasChartHost title="Liquidity" bars={bars} sync={sync} bottomMargin={0.3} navigation={navigation}>
    {projection => <LinkedLiquidityPlot projection={projection} data={{ colors, bars, icebergs, icebergFilter, siStops, siStopSettings,
      siStopThreshold, events, lines, volumeDelta, marketVolumeSignals, marketExplorerSettings, showVwap, bigTrades, showBigTrades,
      bigTradeSettings, trackerSettings, heatmapSettings, tf, filters, visibleBars, offsetBars: safeOffset, priceScale, pricePanPx,
      now: Math.max(now, Date.now()), hover: null }} />}
  </CanvasChartHost>;

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

function LinkedLiquidityPlot({ data, projection }: { data: Parameters<typeof drawLiquidityChart>[2]; projection: SharedChartProjection }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    if (ref.current) drawLiquidityChart(ref.current, { width: projection.width, height: projection.height }, data, projection);
  }, [data, projection]);
  return <canvas ref={ref} style={{ width: projection.width, height: projection.height }} aria-label="GC liquidity event overlay" />;
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
  textColor: string,
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
  context.fillStyle = textColor;
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
  context.fillStyle = textColor;
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
    colors: WorkspaceColors;
    bars: Bar[];
    icebergs: readonly NativeIcebergState[];
    icebergFilter: IcebergFilterContext;
    siStops: readonly SiStopChain[];
    siStopSettings: SiStopSettings;
    siStopThreshold: number;
    events: LiquidityEvent[];
    lines: LiquidityLine[];
    volumeDelta: readonly VolumeDeltaPoint[];
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
  projection?: SharedChartProjection,
) {
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  const bitmapWidth = Math.round(size.width * ratio);
  const bitmapHeight = Math.round(size.height * ratio);
  // Assigning even the same dimension clears the bitmap and resets its context.
  // Background snapshots should repaint the existing surface, not recreate it.
  if (canvas.width !== bitmapWidth) canvas.width = bitmapWidth;
  if (canvas.height !== bitmapHeight) canvas.height = bitmapHeight;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, size.width, size.height);
  if (!projection) { context.fillStyle = data.colors.background; context.fillRect(0, 0, size.width, size.height); }

  const left = projection ? 0 : 14;
  const right = projection ? 0 : PRICE_AXIS_WIDTH;
  const top = projection ? 0 : 18;
  const bottom = projection ? 0 : TIME_AXIS_HEIGHT;
  const plotWidth = Math.max(1, size.width - left - right);
  const plotHeight = Math.max(1, size.height - top - bottom);
  const stopPaneHeight = clamp(plotHeight * 0.24, 88, 170);
  const paneGap = stopPaneHeight > 0 ? 10 : 0;
  const pricePlotHeight = Math.max(1, plotHeight - stopPaneHeight - paneGap);
  const stopPaneTop = top + pricePlotHeight + paneGap;
  const tfMs = liquidityTimeframeMs(data.tf);
  const pastOffset = Math.max(0, Math.floor(data.offsetBars));
  const futureSlots = Math.max(0, -Math.floor(data.offsetBars));
  const endIndex = Math.max(0, data.bars.length - pastOffset);
  const occupiedSlots = Math.max(1, data.visibleBars - futureSlots);
  const startIndex = Math.max(0, endIndex - occupiedSlots);
  const visible = projection ? data.bars.filter(bar => bar.time + tfMs >= projection.viewport.fromUtcMs && bar.time <= projection.viewport.toUtcMs) : data.bars.slice(startIndex, endIndex);
  if (visible.length === 0) return;
  const latestBar = data.bars[data.bars.length - 1];
  const showCurrentPrice = endIndex === data.bars.length && latestBar !== undefined;
  const currentPrice = latestBar?.close;
  const timeFrom = projection?.viewport.fromUtcMs ?? visible[0].time;
  const timeTo = projection?.viewport.toUtcMs ?? visible[visible.length - 1].time + tfMs * (futureSlots + 1);
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
  const visibleVolumeDelta = data.volumeDelta.filter(
    (bar) => bar.time >= timeFrom && bar.time < timeTo,
  );
  const volumeExtent = Math.max(1, ...visibleVolumeDelta.map((bar) => Math.abs(bar.delta))) * 1.12;
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
  const priceMin = projection?.yToPrice(pricePlotHeight) ?? centerPrice - scaledSpan / 2;
  const priceMax = projection?.yToPrice(top) ?? centerPrice + scaledSpan / 2;
  const priceSpan = priceMax - priceMin;
  const xAt = (time: number) => projection ? projection.timeToX(time) ?? -1e6 : left + ((time - timeFrom) / (timeTo - timeFrom)) * plotWidth;
  const yAt = (price: number) =>
    projection ? projection.priceToY(price) : top + ((priceMax - price) / priceSpan) * pricePlotHeight;

  context.font = "11px Segoe UI, sans-serif";
  context.textBaseline = "middle";
  for (let index = 0; !projection && index <= 5; index += 1) {
    const y = top + (pricePlotHeight * index) / 5;
    const price = priceMax - (priceSpan * index) / 5;
    context.strokeStyle = data.colors.grid;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(left, Math.round(y) + 0.5);
    context.lineTo(left + plotWidth, Math.round(y) + 0.5);
    context.stroke();
    context.fillStyle = data.colors.text;
    context.fillText(price.toFixed(1), left + plotWidth + 7, y);
  }
  for (let index = 0; !projection && index <= 6; index += 1) {
    const x = left + (plotWidth * index) / 6;
    const time = timeFrom + ((timeTo - timeFrom) * index) / 6;
    context.strokeStyle = data.colors.grid;
    context.beginPath();
    context.moveTo(Math.round(x) + 0.5, top);
    context.lineTo(Math.round(x) + 0.5, top + plotHeight);
    context.stroke();
    context.fillStyle = data.colors.text;
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
      const y = yAt(line.price);
      const labelX = drawLiquidityLevel(context, line, {
        from: timeFrom, to: timeTo, now: data.now,
        pixelsPerMs: plotWidth / (timeTo - timeFrom),
        showLive: showCurrentPrice, y, xAt,
        settings: data.heatmapSettings,
      });
      if (labelX !== null && labelX > left + plotWidth - 120) {
        const labelOpacity = Math.min(1, data.heatmapSettings.opacity);
        context.fillStyle = line.side === "bid"
          ? `rgba(0, 214, 143, ${labelOpacity})` : `rgba(255, 82, 103, ${labelOpacity})`;
        context.textAlign = "right";
        const label = liquidityLineLabel(line, data.trackerSettings, data.now);
        context.fillText(label, labelX - 5, y - 8);
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
    !projection && showCurrentPrice &&
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
        data.colors.text,
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
      data.colors,
    );
  }

  drawNativeIcebergs(context, data.icebergs, {
    from: timeFrom, to: timeTo, now: data.now,
    left, right: left + plotWidth, top, bottom: top + pricePlotHeight,
    xAt, yAt, timeframeMs: tfMs, hover: data.hover, filter: data.icebergFilter,
  });
  drawSiStops(context, data.siStops, {
    from: timeFrom, to: timeTo, timeframeMs: tfMs,
    left, right: left + plotWidth, top, bottom: top + pricePlotHeight,
    xAt, yAt, hover: data.hover, settings: data.siStopSettings, threshold: data.siStopThreshold,
  });
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
    context.fillStyle = data.colors.panel;
    context.fillRect(left, stopPaneTop, plotWidth, stopPaneHeight);
    context.strokeStyle = data.colors.border;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(left, stopPaneTop - paneGap / 2 + 0.5);
    context.lineTo(left + plotWidth, stopPaneTop - paneGap / 2 + 0.5);
    context.stroke();

    const stopY = (value: number) =>
      stopPaneTop + ((volumeExtent - value) / (volumeExtent * 2)) * stopPaneHeight;
    const zeroY = stopY(0);
    context.strokeStyle = data.colors.crosshair;
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
    for (const bar of visibleVolumeDelta) {
      if (bar.delta === 0) continue;
      const x = xAt(bar.time + tfMs / 2);
      const y = stopY(bar.delta);
      context.fillStyle = bar.delta > 0 ? "#00d68f" : "#ff5267";
      context.fillRect(x - candleWidth / 2, Math.min(y, zeroY), candleWidth,
        Math.max(1, Math.abs(zeroY - y)));
    }
    context.restore();

    context.font = "bold 11px Segoe UI, sans-serif";
    context.textAlign = "left";
    context.fillStyle = data.colors.text;
    context.fillText(
      `Volume Delta (${data.tf})`,
      left + 7,
      stopPaneTop + 11,
    );
    context.font = "10px Segoe UI, sans-serif";
    context.textAlign = "left";
    context.fillStyle = data.colors.muted;
    context.fillText(formatCompactVolume(volumeExtent), left + plotWidth + 6, stopPaneTop + 6);
    context.fillText("0", left + plotWidth + 6, zeroY);
    context.fillText(
      formatCompactVolume(-volumeExtent),
      left + plotWidth + 6,
      stopPaneTop + stopPaneHeight - 6,
    );

  }
  drawLiquidityCrosshair(context, data.hover, {
    left, width: plotWidth, top, priceHeight: pricePlotHeight,
    deltaTop: stopPaneTop, deltaHeight: stopPaneHeight,
    from: timeFrom, to: timeTo, tfMs, priceMin, priceMax,
    deltaExtent: volumeExtent,
  }, visibleVolumeDelta, formatDateTime, formatCompactVolume, data.colors);

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
  colors: WorkspaceColors,
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
  context.strokeStyle = colors.background;
  context.strokeText(label, x, y);
  context.fillStyle = colors.text;
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

function LayerSetting({ label, help, checked, onChange }: {
  label: string; help: string; checked: boolean; onChange: (checked: boolean) => void;
}) {
  return <div className="liquidity-settings-enable-row">
    <FilterToggle label={label} checked={checked} onChange={onChange} />
    <SettingHelp label={label} text={help} />
  </div>;
}

function SoundSetting({ event, label, enabled, sound, onEnabledChange, onSoundChange }: {
  event: LiquiditySoundEvent; label: string; enabled: boolean; sound: LiquiditySound;
  onEnabledChange: (enabled: boolean) => void; onSoundChange: (sound: LiquiditySound) => void;
}) {
  const help = {
    longTerm: "Play a sound when a trade hits a liquidity line old enough to qualify as Long-term. Younger lines do not trigger this alert.",
    volumeStop: "Play a sound for a newly completed SI chain that meets Alert minimum volume and the alert conditions. Uses each chain rather than grouped marker volume. Historical chains are not replayed.",
    volumeSpike: "Play a sound for a new Volume Spike while Volume Spike is enabled.",
    absorption: "Play a sound for new Absorption while Absorption is enabled.",
    bigTrade: "Play a sound for a new BigTrade meeting the current session volume threshold. A cooldown prevents overlapping sounds; the threshold is shared with BigTrade on the chart.",
    iceberg: "Play a sound when a new ICE crosses the applicable volume threshold while Iceberg is enabled. Each ICE is tracked separately; loading history does not repeat alerts.",
  }[event];
  return (
    <div className="liquidity-sound-setting">
      <div className="liquidity-settings-enable-row">
        <label className="liquidity-settings-enable">
          <input type="checkbox" checked={enabled} aria-label={`${label} sound`}
            onChange={(e) => onEnabledChange(e.currentTarget.checked)} />
          {label} sound
        </label>
        <SettingHelp label={`${label} sound`} text={help} />
      </div>
      <div className="liquidity-sound-choice">
        <select aria-label={`${label} sound type`} value={sound}
          onChange={(e) => onSoundChange(e.currentTarget.value as LiquiditySound)}>
          {SOUND_OPTIONS.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
        </select>
        <SettingHelp label={`${label} sound type`} text="Choose the alert sound: Chime plays a bell; Voice reads the signal name. If speech is unavailable, the browser uses a chime. Test previews the sound only." />
        <button type="button" aria-label={`Preview ${label} sound`}
          title="Preview the selected sound without creating a signal or enabling alerts."
          onClick={() => { unlockAlertAudio(); playLiquiditySound(event, sound, true); }}>Test</button>
      </div>
    </div>
  );
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
  section,
  settings,
  onVolumeSpikeChange,
  onAbsorptionChange,
}: {
  section: SettingsSection;
  settings: MarketExplorerSettings;
  onVolumeSpikeChange: (patch: Partial<VolumeSpikeSettings>) => void;
  onAbsorptionChange: (patch: Partial<AbsorptionSettings>) => void;
}) {
  const spike = settings.volumeSpike;
  const absorption = settings.absorption;
  return (
    <>
      <fieldset className="liquidity-settings-group market-explorer-settings-group" hidden={section !== "volumeSpike"}>
        <legend>Volume Spike Signal</legend>
        <MarketExplorerEnableRow
          checked={spike.enabled}
          label="Volume Spike Signal"
          help="Detect a surge of aggressive buying or selling meeting the volume, price range, and opposite-side ratio thresholds. The marker is finalized at the surge extreme after price pulls back."
          onChange={(enabled) => onVolumeSpikeChange({ enabled })}
        />
        <div className={spike.enabled ? "liquidity-settings-fields" : "liquidity-settings-fields is-disabled"}>
          <MarketExplorerColorField label="Buy Volume Spike Signal" value={spike.buyColor} disabled={!spike.enabled} onChange={(buyColor) => onVolumeSpikeChange({ buyColor })} />
          <MarketExplorerColorField label="Sell Volume Spike Signal" value={spike.sellColor} disabled={!spike.enabled} onChange={(sellColor) => onVolumeSpikeChange({ sellColor })} />
          <SettingNumber label="Trigger Volume" help="Minimum total contracts executed aggressively on the same side within the surge window, rather than the volume of one order." value={spike.triggerVolume} min={1} max={10_000_000} disabled={!spike.enabled} onChange={(triggerVolume) => onVolumeSpikeChange({ triggerVolume })} />
          <SettingNumber label="Maximum Duration [s]" help="Rolling surge window in seconds, checked every 100 ms. For example, 1 measures volume and movement over the most recent second." value={spike.maximumDurationSeconds} min={0.1} max={60} disabled={!spike.enabled} onChange={(maximumDurationSeconds) => onVolumeSpikeChange({ maximumDurationSeconds })} />
          <SettingNumber label="Price Range [ticks/cents]" help="Minimum price movement in the surge direction during the window, in ticks. For GC, 1 tick = 0.1 price units. This is a price range rather than a candle count." value={spike.priceRangeTicks} min={1} max={100_000} disabled={!spike.enabled} onChange={(priceRangeTicks) => onVolumeSpikeChange({ priceRangeTicks })} />
          <SettingNumber label="Ratio greater / equal" help="Peak same-side volume divided by opposite-side volume. For example, 3 requires the aggressive side to be at least three times stronger than the opposite side." value={spike.ratioGreaterEqual} min={1} max={1_000_000} disabled={!spike.enabled} onChange={(ratioGreaterEqual) => onVolumeSpikeChange({ ratioGreaterEqual })} />
          <MarketExplorerAppearanceFields buyLabel="Buy Volume Spike Signal" sellLabel="Sell Volume Spike Signal" settings={spike} disabled={!spike.enabled} hideColors onChange={onVolumeSpikeChange} />
        </div>
      </fieldset>

      <fieldset className="liquidity-settings-group market-explorer-settings-group" hidden={section !== "absorption"}>
        <legend>Absorption Signal</legend>
        <MarketExplorerEnableRow
          checked={absorption.enabled}
          label="Absorption Signal"
          help="Detect large aggressive volume held within a narrow range under two ticks. The marker is finalized at the cluster peak when the cluster ends or weakens. This indicates absorption without confirming an iceberg."
          onChange={(enabled) => onAbsorptionChange({ enabled })}
        />
        <div className={absorption.enabled ? "liquidity-settings-fields" : "liquidity-settings-fields is-disabled"}>
          <MarketExplorerColorField label="Buy Absorption Signal" value={absorption.buyColor} disabled={!absorption.enabled} onChange={(buyColor) => onAbsorptionChange({ buyColor })} />
          <MarketExplorerColorField label="Sell Absorption Signal" value={absorption.sellColor} disabled={!absorption.enabled} onChange={(sellColor) => onAbsorptionChange({ sellColor })} />
          <SettingNumber label="Trigger Volume" help="Minimum total aggressive contracts on the same side held in an absorption range under two ticks, rather than resting DOM size." value={absorption.triggerVolume} min={1} max={10_000_000} disabled={!absorption.enabled} onChange={(triggerVolume) => onAbsorptionChange({ triggerVolume })} />
          <SettingNumber label="Maximum Duration [s]" help="Rolling window for measuring absorption volume, in seconds, checked every 100 ms. Longer windows can accumulate more volume." value={absorption.maximumDurationSeconds} min={0.1} max={60} disabled={!absorption.enabled} onChange={(maximumDurationSeconds) => onAbsorptionChange({ maximumDurationSeconds })} />
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
        help="Choose the chart marker shape: triangle, arrow, circle, or flag. This does not change signal conditions."
        value={settings.markerShape}
        disabled={disabled}
        options={[["triangle", "Triangle"], ["arrow", "Arrow"], ["circle", "Circle"], ["flag", "Flag"]]}
        onChange={(markerShape) => onChange({ markerShape: markerShape as MarketExplorerMarkerShape })}
      />
      <SettingNumber label="Marker size" help="Base marker size, from 1 (small) to 5 (large). This does not set a volume threshold or signal confidence." value={settings.markerSize} min={1} max={5} disabled={disabled} onChange={(markerSize) => onChange({ markerSize })} />
      <MarketExplorerCheckField label="Variable marker size" help="Vary marker size with signal strength. Turn off to give every marker the same base size." checked={settings.variableSize} disabled={disabled} onChange={(variableSize) => onChange({ variableSize })} />
      <MarketExplorerSelectField
        label="Bookmap Alert Message"
        help="Notification option for the legacy Bookmap bridge. It does not apply to the current direct Rithmic source; LQ sounds are configured separately under Market Explorer sounds."
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
  const inputId = useId();
  return (
    <div className="liquidity-settings-field market-explorer-color-field">
      <SettingFieldLabel label={label} htmlFor={inputId}
        help={`Marker color for ${label} on the chart. Colors distinguish trade direction without changing volume or detection conditions.`} />
      <input
        id={inputId}
        type="color"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </div>
  );
}

function MarketExplorerSelectField({
  label,
  help,
  value,
  disabled,
  options,
  onChange,
}: {
  label: string;
  help: string;
  value: string;
  disabled: boolean;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  const inputId = useId();
  return (
    <div className="liquidity-settings-field market-explorer-select-field">
      <SettingFieldLabel label={label} help={help} htmlFor={inputId} />
      <select
        id={inputId}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {options.map(([option, text]) => <option value={option} key={option}>{text}</option>)}
      </select>
    </div>
  );
}

function MarketExplorerCheckField({
  label,
  help,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  help: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  const inputId = useId();
  return (
    <div className="liquidity-settings-field market-explorer-check-field">
      <SettingFieldLabel label={label} help={help} htmlFor={inputId} />
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    </div>
  );
}

function LiquiditySettingsGroup({
  hidden,
  title,
  help,
  enableHelp,
  enabled,
  onEnabledChange,
  children,
}: {
  hidden: boolean;
  title: string;
  help: string;
  enableHelp: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  children: ReactNode;
}) {
  return (
    <fieldset className="liquidity-settings-group" hidden={hidden}>
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

export function mergeMarketVolumeSignals(
  first: MarketExplorerSignal[],
  second: MarketExplorerSignal[],
  cutoff: number,
): MarketExplorerSignal[] {
  const merged = new Map<string, MarketExplorerSignal>();
  for (const signal of [...first, ...second]) {
    if (signal.kind !== "market_volume_stop" && signal.detectionTime >= cutoff) merged.set(signal.signalId, signal);
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
  sounds: LiquidityAlertSounds,
) {
  for (const signal of signals) {
    if (signal.kind === "market_volume_stop") continue;
    const config = marketExplorerSignalStyle(settings, signal);
    if (!config.enabled) continue;
    const event = signal.kind === "volume_spike" ? "volumeSpike"
      : signal.kind === "absorption" ? "absorption" : "volumeStop";
    if (config.alertSound) playLiquiditySound(event, sounds[event]);
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
  second: "2-digit",
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
