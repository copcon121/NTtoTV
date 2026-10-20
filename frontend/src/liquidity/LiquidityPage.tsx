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
import { resolveEndpoints } from "../endpoints";
import { ChartSocket } from "../socket/ChartSocket";
import type {
  Bar,
  LiquidityAction,
  LiquidityEventKind,
  LiquidityUpdateMessage,
  MarketExplorerSignal,
  MarketExplorerUpdateMessage,
  Timeframe,
  TrendAnalyzerMarker,
  TrendAnalyzerPoint,
} from "../socket/messages";
import {
  TREND_ANALYZER_STYLES,
  mergeTrendMarkers,
  mergeTrendPoints,
  trendSeriesInRange,
  type TrendAnalyzerHistoryResponse,
} from "./trendAnalyzer";

const SYMBOL = "GC";
const CONTRACT = "GC";
const RETENTION_MS = 24 * 60 * 60 * 1_000;
const ACTIVE_LINE_STALE_MS = 90_000;
const MIN_VISIBLE_BARS = 30;
const MAX_EVENTS = 20_000;
const MAX_MARKET_VOLUME_SAMPLES = 20_000;
const MAX_MARKET_VOLUME_SIGNALS = 2_000;
const PRICE_AXIS_WIDTH = 78;
const TIME_AXIS_HEIGHT = 28;
const MIN_PRICE_SCALE = 0.25;
const MAX_PRICE_SCALE = 12;
const MAX_FUTURE_SPACE_RATIO = 0.75;
const TTW_RELATIVE_BID_COLOR = "#c8ffc8";
const TTW_RELATIVE_ASK_COLOR = "#ff9696";
const TTW_RELATIVE_LABEL_FONT = "600 12px Segoe UI, sans-serif";
const TTW_VSPIKE_TICK_SIZE = 0.1;

type LiquidityTimeframe = Extract<Timeframe, "1m" | "5m">;

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

interface Filters {
  longTerm: boolean;
  relative: boolean;
  absolute: boolean;
  trend1: boolean;
  trend2: boolean;
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

export function LiquidityPage() {
  const endpoints = useMemo(() => resolveEndpoints(), []);
  const socket = useMemo(() => new ChartSocket({ url: endpoints.ws }), [endpoints.ws]);
  const requestSequence = useRef(0);
  const [tf, setTf] = useState<LiquidityTimeframe>("1m");
  const [bars, setBars] = useState<Bar[]>([]);
  const [events, setEvents] = useState<LiquidityEvent[]>([]);
  const [lines, setLines] = useState<Map<string, LiquidityLine>>(new Map());
  const [marketVolumeSamples, setMarketVolumeSamples] = useState<MarketVolumeSample[]>([]);
  const [marketVolumeSignals, setMarketVolumeSignals] = useState<MarketExplorerSignal[]>([]);
  const [trendPoints, setTrendPoints] = useState<TrendAnalyzerPoint[]>([]);
  const [trendMarkers, setTrendMarkers] = useState<TrendAnalyzerMarker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<"connected" | "disconnected">(
    "disconnected",
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [visibleBars, setVisibleBars] = useState(240);
  const [offsetBars, setOffsetBars] = useState(0);
  const [filters, setFilters] = useState<Filters>({
    longTerm: true,
    relative: true,
    absolute: true,
    trend1: true,
    trend2: true,
  });
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
    marketExplorerSettingsRef.current = marketExplorerSettings;
  }, [marketExplorerSettings]);

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
    socket.subscribe(SYMBOL, ["trend_analyzer_update"]);
    const offBar = socket.on("bar_update", (message) => {
      if (message.symbol !== SYMBOL || message.contract !== CONTRACT || message.tf !== tf) {
        return;
      }
      setBars((current) => mergeBars(current, [message.bar], Date.now() - RETENTION_MS));
    });
    const offLiquidity = socket.on("liquidity_update", (message) => {
      if (message.symbol !== SYMBOL || message.contract !== CONTRACT) return;
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
    const offTrendAnalyzer = socket.on("trend_analyzer_update", (message) => {
      if (message.symbol !== SYMBOL || message.contract !== CONTRACT) return;
      const cutoff = Date.now() - RETENTION_MS;
      setTrendPoints((current) => mergeTrendPoints(current, message.points, cutoff));
      setTrendMarkers((current) => mergeTrendMarkers(current, message.markers, cutoff));
    });
    return () => {
      offBar();
      offLiquidity();
      offMarketExplorer();
      offTrendAnalyzer();
      socket.unsubscribe(SYMBOL, ["bar_update"], tf);
      socket.unsubscribe(SYMBOL, ["liquidity_update"]);
      socket.unsubscribe(SYMBOL, ["market_explorer_update"]);
      socket.unsubscribe(SYMBOL, ["trend_analyzer_update"]);
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
    const trendAnalyzerParams = new URLSearchParams({
      symbol: SYMBOL,
      contract: CONTRACT,
      from: String(from),
      to: String(to),
      limit: "50000",
    });

    Promise.all([
      fetch(historyUrl, { signal: controller.signal }).then(readJson<HistoryResponse>),
      fetch(`${endpoints.api}/liquidity?${liquidityParams}`, {
        signal: controller.signal,
      }).then(readJson<LiquidityHistoryResponse>),
      fetch(`${endpoints.api}/market-explorer?${marketExplorerParams}`, {
        signal: controller.signal,
      }).then(readJson<MarketExplorerHistoryResponse>),
      fetch(`${endpoints.api}/trend-analyzer?${trendAnalyzerParams}`, {
        signal: controller.signal,
      }).then(readJson<TrendAnalyzerHistoryResponse>),
    ])
      .then(([history, liquidity, marketExplorer, trendAnalyzer]) => {
        if (sequence !== requestSequence.current) return;
        const timeframeMs = tf === "1m" ? 60_000 : 300_000;
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
        setTrendPoints((current) =>
          mergeTrendPoints(trendAnalyzer.points, current, from),
        );
        setTrendMarkers((current) =>
          mergeTrendMarkers(trendAnalyzer.markers, current, from),
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
    setVisibleBars(next === "1m" ? 240 : 144);
    setOffsetBars(0);
  };

  const configuredEvents = events.filter((event) =>
    liquidityEventMatchesSettings(event, trackerSettings)
  );
  const configuredLines = [...lines.values()].filter((line) =>
    liquidityLineMatchesSettings(line, trackerSettings, clock)
  );
  const maxVisible = tf === "1m" ? 1_440 : 288;
  const zoom = useCallback(
    (factor: number) => {
      setVisibleBars((current) =>
        clamp(Math.round(current * factor), MIN_VISIBLE_BARS, maxVisible),
      );
    },
    [maxVisible],
  );

  const openSettings = () => {
    setSettingsDraft({ ...trackerSettings });
    setMarketExplorerDraft(cloneMarketExplorerSettings(marketExplorerSettings));
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
  const saveSettings = async () => {
    const validationError =
      validateLiquidityTrackerSettings(settingsDraft) ??
      validateMarketExplorerSettings(marketExplorerDraft);
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
      setSettingsNotice(
        liquidityPayload.sentToBookmap
          ? "Saved and sent to Bookmap"
          : "Saved; Market Explorer is live and liquidity will apply on Bookmap reconnect",
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
          <span>TTW TrendAnalyzerPro + MV Stop, Volume Spike and Absorption</span>
        </div>
        <div className="liquidity-segmented" aria-label="Timeframe">
          {(["1m", "5m"] as const).map((value) => (
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
            label="Long-term"
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
            label="Trend #1"
            checked={filters.trend1}
            onChange={(checked) => setFilters((value) => ({ ...value, trend1: checked }))}
          />
          <FilterToggle
            label="Trend #2"
            checked={filters.trend2}
            onChange={(checked) => setFilters((value) => ({ ...value, trend2: checked }))}
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
                <span>Applied to Bookmap depth and aggressor trades</span>
              </div>
              <button type="button" onClick={() => setSettingsOpen(false)} aria-label="Close settings">
                ×
              </button>
            </header>

            <div className="liquidity-settings-groups">
              <LiquiditySettingsGroup
                title="Relative Liquidity Change"
                help="So sánh size hiện tại với lần cập nhật trước tại cùng mức giá để đánh dấu thanh khoản được thêm hoặc rút."
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
        trendPoints={trendPoints}
        trendMarkers={trendMarkers}
        trackerSettings={trackerSettings}
        tf={tf}
        filters={filters}
        visibleBars={visibleBars}
        offsetBars={offsetBars}
        now={clock}
        onOffsetChange={setOffsetBars}
        onVisibleBarsChange={(value) =>
          setVisibleBars(clamp(value, MIN_VISIBLE_BARS, maxVisible))
        }
        onZoom={zoom}
      />

      <footer className="liquidity-legend">
        <span><i className="is-bid-line" /> long-term bid</span>
        <span><i className="is-ask-line" /> long-term ask</span>
        <span><i className="is-relative-bid" /> relative bid ±volume</span>
        <span><i className="is-relative-ask" /> relative ask ±volume</span>
        <span><i className="is-absolute" /> absolute threshold</span>
        <span><i style={{ background: marketExplorerSettings.buyLineColor }} /> MV Stop buy</span>
        <span><i style={{ background: marketExplorerSettings.sellLineColor }} /> MV Stop sell</span>
        <span><i style={{ background: marketExplorerSettings.volumeSpike.buyColor }} /> Volume Spike</span>
        <span><i style={{ background: marketExplorerSettings.absorption.sellColor }} /> Absorption</span>
        <span><i style={{ background: TREND_ANALYZER_STYLES[1].buy }} /> Trend #1 buy/sell</span>
        <span><i style={{ background: TREND_ANALYZER_STYLES[2].buy }} /> Trend #2 buy/sell</span>
        <span>TA: 5m x 15, multiplier 3.0, switch 3 ticks</span>
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
  trendPoints,
  trendMarkers,
  trackerSettings,
  tf,
  filters,
  visibleBars,
  offsetBars,
  now,
  onOffsetChange,
  onVisibleBarsChange,
  onZoom,
}: {
  bars: Bar[];
  events: LiquidityEvent[];
  lines: LiquidityLine[];
  marketVolumeSamples: MarketVolumeSample[];
  marketVolumeSignals: MarketExplorerSignal[];
  marketExplorerSettings: MarketExplorerSettings;
  trendPoints: TrendAnalyzerPoint[];
  trendMarkers: TrendAnalyzerMarker[];
  trackerSettings: LiquidityTrackerSettings;
  tf: LiquidityTimeframe;
  filters: Filters;
  visibleBars: number;
  offsetBars: number;
  now: number;
  onOffsetChange: (value: number) => void;
  onVisibleBarsChange: (value: number) => void;
  onZoom: (factor: number) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0 });
  const [interaction, setInteraction] = useState<InteractionMode>("idle");
  const [hover, setHover] = useState<HoverPoint | null>(null);
  const [priceScale, setPriceScale] = useState(1);
  const [pricePanPx, setPricePanPx] = useState(0);

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

  useEffect(() => {
    setPriceScale(1);
    setPricePanPx(0);
  }, [tf]);

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
      trendPoints,
      trendMarkers,
      trackerSettings,
      tf,
      filters,
      visibleBars,
      offsetBars: safeOffset,
      priceScale,
      pricePanPx,
      now,
      hover,
    });
  }, [
    bars,
    events,
    filters,
    hover,
    lines,
    marketExplorerSettings,
    trendMarkers,
    trendPoints,
    trackerSettings,
    marketVolumeSamples,
    marketVolumeSignals,
    now,
    pricePanPx,
    priceScale,
    safeOffset,
    size,
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
      setPriceScale(priceScaleFromAxisDrag(drag.startPriceScale, delta));
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
    setPricePanPx(
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
      setPriceScale(1);
      setPricePanPx(0);
    } else if (y >= size.height - TIME_AXIS_HEIGHT) {
      onVisibleBarsChange(tf === "1m" ? 240 : 144);
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

function drawTrendAnalyzerLines(
  context: CanvasRenderingContext2D,
  points: TrendAnalyzerPoint[],
  filters: Filters,
  timeFrom: number,
  timeTo: number,
  xAt: (time: number) => number,
  yAt: (price: number) => number,
) {
  context.save();
  context.lineWidth = 2;
  context.lineJoin = "miter";
  context.setLineDash([]);
  // Draw #2 first so #1 has the same top-layer precedence seen in Bookmap.
  for (const instance of [2, 1] as const) {
    if (instance === 1 ? !filters.trend1 : !filters.trend2) continue;
    for (const side of ["buy", "sell"] as const) {
      const series = trendSeriesInRange(points, instance, side, timeFrom, timeTo);
      if (series.length === 0) continue;
      context.strokeStyle = TREND_ANALYZER_STYLES[instance][side];
      context.beginPath();
      let drawing = false;
      let previousPrice: number | null = null;
      for (const point of series) {
        if (point.price === null) {
          drawing = false;
          previousPrice = null;
          continue;
        }
        const x = xAt(Math.max(timeFrom, point.time));
        const y = yAt(point.price);
        if (!drawing || previousPrice === null) {
          context.moveTo(x, y);
          drawing = true;
        } else {
          context.lineTo(x, yAt(previousPrice));
          context.lineTo(x, y);
        }
        previousPrice = point.price;
      }
      if (drawing && previousPrice !== null) {
        context.lineTo(xAt(timeTo), yAt(previousPrice));
      }
      context.stroke();
    }
  }
  context.restore();
}

function drawTrendAnalyzerMarkers(
  context: CanvasRenderingContext2D,
  markers: TrendAnalyzerMarker[],
  xAt: (time: number) => number,
  yAt: (price: number) => number,
) {
  context.save();
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (const instance of [2, 1] as const) {
    for (const marker of markers) {
      if (marker.instance !== instance) continue;
      const color = TREND_ANALYZER_STYLES[instance][marker.side];
      const x = xAt(marker.time);
      const lineY = yAt(marker.linePrice);
      context.fillStyle = color;
      context.strokeStyle = "rgba(5, 9, 12, 0.9)";
      context.lineWidth = 1;
      if (marker.kind === "new_candle") {
        context.beginPath();
        context.arc(x, lineY, 2.5, 0, Math.PI * 2);
        context.fill();
        continue;
      }

      const isBuy = marker.side === "buy";
      const centerY = lineY + (isBuy ? 9 : -9);
      const size = 7;
      context.beginPath();
      if (isBuy) {
        context.moveTo(x, centerY - size);
        context.lineTo(x + size, centerY + size);
        context.lineTo(x - size, centerY + size);
      } else {
        context.moveTo(x, centerY + size);
        context.lineTo(x + size, centerY - size);
        context.lineTo(x - size, centerY - size);
      }
      context.closePath();
      context.fill();
      context.stroke();
      context.font = "600 10px Segoe UI, sans-serif";
      context.fillStyle = color;
      context.fillText(
        marker.marketPrice.toFixed(1),
        x,
        centerY + (isBuy ? size + 9 : -size - 9),
      );
    }
  }
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
    trendPoints: TrendAnalyzerPoint[];
    trendMarkers: TrendAnalyzerMarker[];
    trackerSettings: LiquidityTrackerSettings;
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
  const tfMs = data.tf === "1m" ? 60_000 : 300_000;
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
  const lineItems = data.lines.filter((line) => {
    const fresh = line.active && data.now - line.lastAt <= ACTIVE_LINE_STALE_MS;
    const effectiveEnd = fresh ? timeTo : (line.endedAt ?? line.lastAt);
    return line.startedAt <= timeTo && effectiveEnd >= timeFrom;
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
  const trendEnabled = (instance: 1 | 2) =>
    instance === 1 ? data.filters.trend1 : data.filters.trend2;
  const visibleTrendPoints = ([1, 2] as const).flatMap((instance) =>
    trendEnabled(instance)
      ? (["buy", "sell"] as const).flatMap((side) =>
          trendSeriesInRange(data.trendPoints, instance, side, timeFrom, timeTo),
        )
      : [],
  );
  const visibleTrendMarkers = data.trendMarkers.filter(
    (marker) =>
      trendEnabled(marker.instance) &&
      marker.time >= timeFrom &&
      marker.time <= timeTo,
  );
  const prices = visible.flatMap((bar) => [bar.low, bar.high]);
  if (markerEvents.length > 0) {
    prices.push(...markerEvents.map((event) => event.price));
  }
  if (data.filters.longTerm) prices.push(...lineItems.map((line) => line.price));
  prices.push(...marketVolumeSignals.map((signal) => signal.price));
  prices.push(
    ...visibleTrendPoints.flatMap((point) =>
      point.price === null ? [] : [point.price],
    ),
    ...visibleTrendMarkers.map((marker) => marker.linePrice),
  );
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
      const fresh = line.active && data.now - line.lastAt <= ACTIVE_LINE_STALE_MS;
      const effectiveEnd = fresh ? timeTo : (line.endedAt ?? line.lastAt);
      const x1 = xAt(Math.max(timeFrom, line.startedAt));
      const x2 = xAt(Math.min(timeTo, effectiveEnd));
      if (x2 < left || x1 > left + plotWidth) continue;
      const y = yAt(line.price);
      const color = line.side === "bid" ? "0, 214, 143" : "255, 82, 103";
      context.strokeStyle = `rgba(${color}, ${fresh ? 0.9 : 0.36})`;
      context.lineWidth = 1 + Math.min(4, line.peakSize / Math.max(1, line.threshold));
      context.setLineDash(fresh ? [] : [5, 4]);
      context.beginPath();
      context.moveTo(x1, y);
      context.lineTo(x2, y);
      context.stroke();
      if (fresh && x2 > left + plotWidth - 120) {
        context.setLineDash([]);
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

  drawTrendAnalyzerLines(
    context,
    data.trendPoints,
    data.filters,
    timeFrom,
    timeTo,
    xAt,
    yAt,
  );
  drawTrendAnalyzerMarkers(context, visibleTrendMarkers, xAt, yAt);

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

function mergeHistoryLines(
  history: LiquidityLine[],
  current: Map<string, LiquidityLine>,
): Map<string, LiquidityLine> {
  const merged = new Map<string, LiquidityLine>();
  for (const line of history) merged.set(line.lineId, line);
  for (const line of current.values()) {
    const existing = merged.get(line.lineId);
    if (!existing || line.lastAt >= existing.lastAt) merged.set(line.lineId, line);
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
