import {
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
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
  Timeframe,
} from "../socket/messages";

const SYMBOL = "GC";
const CONTRACT = "GC";
const RETENTION_MS = 24 * 60 * 60 * 1_000;
const ACTIVE_LINE_STALE_MS = 90_000;
const MIN_VISIBLE_BARS = 30;
const MAX_EVENTS = 20_000;
const PRICE_AXIS_WIDTH = 78;
const TIME_AXIS_HEIGHT = 28;
const MIN_PRICE_SCALE = 0.25;
const MAX_PRICE_SCALE = 12;
const MAX_FUTURE_SPACE_RATIO = 0.75;

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
}

const DEFAULT_TRACKER_SETTINGS: LiquidityTrackerSettings = {
  relativeEnabled: true,
  relativeTrigger: 300,
  relativeDomFrom: 20,
  relativeDomTo: 80,
  absoluteEnabled: true,
  absoluteTrigger: 500,
  absoluteDomFrom: 1,
  absoluteDomTo: 10,
  longTermEnabled: true,
  longTermTrigger: 500,
  longTermDomFrom: 1,
  longTermDomTo: 80,
  longTermMinAgeSeconds: 30,
};

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
      startOffset: number;
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
  });
  const [clock, setClock] = useState(Date.now());
  const [trackerSettings, setTrackerSettings] = useState<LiquidityTrackerSettings>(
    DEFAULT_TRACKER_SETTINGS,
  );
  const [settingsDraft, setSettingsDraft] = useState<LiquidityTrackerSettings>(
    DEFAULT_TRACKER_SETTINGS,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);

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
      }
    });
    return () => {
      offBar();
      offLiquidity();
      socket.unsubscribe(SYMBOL, ["bar_update"], tf);
      socket.unsubscribe(SYMBOL, ["liquidity_update"]);
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

    Promise.all([
      fetch(historyUrl, { signal: controller.signal }).then(readJson<HistoryResponse>),
      fetch(`${endpoints.api}/liquidity?${liquidityParams}`, {
        signal: controller.signal,
      }).then(readJson<LiquidityHistoryResponse>),
    ])
      .then(([history, liquidity]) => {
        if (sequence !== requestSequence.current) return;
        setBars((current) => mergeBars(history.bars, current, from));
        setEvents((current) => mergeEvents(liquidity.events, current, from));
        setLines((current) => mergeHistoryLines(liquidity.lines, current));
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
    fetch(`${endpoints.api}/liquidity/settings`, { signal: controller.signal })
      .then(readJson<LiquiditySettingsResponse>)
      .then((payload) => {
        setTrackerSettings(payload.settings);
        setSettingsDraft(payload.settings);
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

  const activeLines = [...lines.values()].filter(
    (line) => line.active && clock - line.lastAt <= ACTIVE_LINE_STALE_MS,
  );
  const bidLines = activeLines.filter((line) => line.side === "bid").length;
  const askLines = activeLines.length - bidLines;
  const recentCutoff = clock - 60 * 60 * 1_000;
  const recentEvents = events.filter((event) => event.time >= recentCutoff);
  const added = recentEvents.filter((event) => event.action === "added").length;
  const removed = recentEvents.filter((event) => event.action === "removed").length;
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
    setSettingsError(null);
    setSettingsNotice(null);
    setSettingsOpen(true);
  };
  const updateSettingNumber = (field: NumericTrackerSetting, value: number) => {
    if (!Number.isFinite(value)) return;
    setSettingsDraft((current) => ({ ...current, [field]: Math.round(value) }));
  };
  const saveSettings = async () => {
    const validationError = validateLiquidityTrackerSettings(settingsDraft);
    if (validationError) {
      setSettingsError(validationError);
      return;
    }
    setSettingsSaving(true);
    setSettingsError(null);
    try {
      const payload = await fetch(`${endpoints.api}/liquidity/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsDraft),
      }).then(readJson<LiquiditySettingsResponse>);
      setTrackerSettings(payload.settings);
      setSettingsDraft(payload.settings);
      setSettingsNotice(
        payload.sentToBookmap
          ? "Saved and sent to Bookmap"
          : "Saved; it will apply when Bookmap reconnects",
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
          <span>GC Liquidity</span>
          <span>24h compact depth signals</span>
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

      <section className="liquidity-summary" aria-label="Liquidity summary">
        <Summary label="Active bid lines" value={bidLines} tone="bid" />
        <Summary label="Active ask lines" value={askLines} tone="ask" />
        <Summary label="Added · 1h" value={added} tone="bid" />
        <Summary label="Removed · 1h" value={removed} tone="ask" />
        <div className="liquidity-summary-note">
          Drag chart to pan/add right space · long-term ≥{trackerSettings.longTermTrigger}
          {" "}for {trackerSettings.longTermMinAgeSeconds}s
        </div>
      </section>

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
                <strong>Liquidity Tracker Settings</strong>
                <span>Applied to Bookmap full-depth detection</span>
              </div>
              <button type="button" onClick={() => setSettingsOpen(false)} aria-label="Close settings">
                ×
              </button>
            </header>

            <div className="liquidity-settings-groups">
              <LiquiditySettingsGroup
                title="Relative Liquidity Change"
                enabled={settingsDraft.relativeEnabled}
                onEnabledChange={(relativeEnabled) =>
                  setSettingsDraft((current) => ({ ...current, relativeEnabled }))
                }
              >
                <SettingNumber
                  label="Trigger liquidity"
                  value={settingsDraft.relativeTrigger}
                  min={1}
                  max={1_000_000}
                  onChange={(value) => updateSettingNumber("relativeTrigger", value)}
                />
                <SettingNumber
                  label="DOM level from"
                  value={settingsDraft.relativeDomFrom}
                  min={0}
                  max={5_000}
                  onChange={(value) => updateSettingNumber("relativeDomFrom", value)}
                />
                <SettingNumber
                  label="DOM level to"
                  value={settingsDraft.relativeDomTo}
                  min={0}
                  max={5_000}
                  onChange={(value) => updateSettingNumber("relativeDomTo", value)}
                />
              </LiquiditySettingsGroup>

              <LiquiditySettingsGroup
                title="Absolute Liquidity Change"
                enabled={settingsDraft.absoluteEnabled}
                onEnabledChange={(absoluteEnabled) =>
                  setSettingsDraft((current) => ({ ...current, absoluteEnabled }))
                }
              >
                <SettingNumber
                  label="Trigger liquidity"
                  value={settingsDraft.absoluteTrigger}
                  min={1}
                  max={1_000_000}
                  onChange={(value) => updateSettingNumber("absoluteTrigger", value)}
                />
                <SettingNumber
                  label="DOM level from"
                  value={settingsDraft.absoluteDomFrom}
                  min={0}
                  max={5_000}
                  onChange={(value) => updateSettingNumber("absoluteDomFrom", value)}
                />
                <SettingNumber
                  label="DOM level to"
                  value={settingsDraft.absoluteDomTo}
                  min={0}
                  max={5_000}
                  onChange={(value) => updateSettingNumber("absoluteDomTo", value)}
                />
              </LiquiditySettingsGroup>

              <LiquiditySettingsGroup
                title="Long-term Liquidity Lines"
                enabled={settingsDraft.longTermEnabled}
                onEnabledChange={(longTermEnabled) =>
                  setSettingsDraft((current) => ({ ...current, longTermEnabled }))
                }
              >
                <SettingNumber
                  label="Trigger liquidity"
                  value={settingsDraft.longTermTrigger}
                  min={1}
                  max={1_000_000}
                  onChange={(value) => updateSettingNumber("longTermTrigger", value)}
                />
                <SettingNumber
                  label="DOM level from"
                  value={settingsDraft.longTermDomFrom}
                  min={0}
                  max={5_000}
                  onChange={(value) => updateSettingNumber("longTermDomFrom", value)}
                />
                <SettingNumber
                  label="DOM level to"
                  value={settingsDraft.longTermDomTo}
                  min={0}
                  max={5_000}
                  onChange={(value) => updateSettingNumber("longTermDomTo", value)}
                />
                <SettingNumber
                  label="Minimum age (seconds)"
                  value={settingsDraft.longTermMinAgeSeconds}
                  min={1}
                  max={3_600}
                  onChange={(value) => updateSettingNumber("longTermMinAgeSeconds", value)}
                />
              </LiquiditySettingsGroup>
            </div>

            <footer>
              <div className={settingsError ? "is-error" : "is-ok"}>
                {settingsError ?? settingsNotice ?? "Changes affect new depth updates."}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSettingsDraft({ ...DEFAULT_TRACKER_SETTINGS });
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
        events={events}
        lines={[...lines.values()]}
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
        <span><i className="is-added" /> relative added</span>
        <span><i className="is-removed" /> relative removed</span>
        <span><i className="is-absolute" /> absolute threshold</span>
        <span>No raw full-depth data is stored</span>
      </footer>
    </div>
  );
}

function LiquidityCanvas({
  bars,
  events,
  lines,
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
      tf,
      filters,
      visibleBars,
      offsetBars: safeOffset,
      priceScale,
      now,
      hover,
    });
  }, [
    bars,
    events,
    filters,
    hover,
    lines,
    now,
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
        startOffset: safeOffset,
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
    const pixelsPerBar = plotWidth / Math.max(1, visibleBars);
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

function drawLiquidityChart(
  canvas: HTMLCanvasElement,
  size: CanvasSize,
  data: {
    bars: Bar[];
    events: LiquidityEvent[];
    lines: LiquidityLine[];
    tf: LiquidityTimeframe;
    filters: Filters;
    visibleBars: number;
    offsetBars: number;
    priceScale: number;
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
  const tfMs = data.tf === "1m" ? 60_000 : 300_000;
  const pastOffset = Math.max(0, Math.floor(data.offsetBars));
  const futureSlots = Math.max(0, -Math.floor(data.offsetBars));
  const endIndex = Math.max(0, data.bars.length - pastOffset);
  const occupiedSlots = Math.max(1, data.visibleBars - futureSlots);
  const startIndex = Math.max(0, endIndex - occupiedSlots);
  const visible = data.bars.slice(startIndex, endIndex);
  if (visible.length === 0) return;
  const timeFrom = visible[0].time;
  const timeTo = visible[visible.length - 1].time + tfMs * (futureSlots + 1);
  const markerEvents = data.events.filter(
    (event) => event.time >= timeFrom && event.time <= timeTo,
  );
  const lineItems = data.lines.filter((line) => {
    const fresh = line.active && data.now - line.lastAt <= ACTIVE_LINE_STALE_MS;
    const effectiveEnd = fresh ? timeTo : (line.endedAt ?? line.lastAt);
    return line.startedAt <= timeTo && effectiveEnd >= timeFrom;
  });
  const prices = visible.flatMap((bar) => [bar.low, bar.high]);
  if (data.filters.relative || data.filters.absolute) {
    prices.push(...markerEvents.map((event) => event.price));
  }
  if (data.filters.longTerm) prices.push(...lineItems.map((line) => line.price));
  const dataMin = Math.min(...prices);
  const dataMax = Math.max(...prices);
  const centerPrice = (dataMin + dataMax) / 2;
  const baseSpan = Math.max(0.5, dataMax - dataMin) * 1.16;
  const scaledSpan =
    baseSpan /
    clamp(data.priceScale, MIN_PRICE_SCALE, MAX_PRICE_SCALE);
  const priceMin = centerPrice - scaledSpan / 2;
  const priceMax = centerPrice + scaledSpan / 2;
  const priceSpan = priceMax - priceMin;
  const xAt = (time: number) => left + ((time - timeFrom) / (timeTo - timeFrom)) * plotWidth;
  const yAt = (price: number) => top + ((priceMax - price) / priceSpan) * plotHeight;

  context.font = "11px Segoe UI, sans-serif";
  context.textBaseline = "middle";
  for (let index = 0; index <= 5; index += 1) {
    const y = top + (plotHeight * index) / 5;
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
  context.rect(left, top, plotWidth, plotHeight);
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
        context.fillText(`${line.currentSize} @ ${line.price.toFixed(1)}`, x2 - 5, y - 8);
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

  for (const event of markerEvents) {
    if (event.eventKind === "relative" && !data.filters.relative) continue;
    if (event.eventKind === "absolute" && !data.filters.absolute) continue;
    const x = xAt(event.time);
    const y = yAt(event.price);
    const color = event.side === "bid" ? "#00d68f" : "#ff5267";
    const radius = clamp(3 + Math.min(4, event.strength), 3, 7);
    if (event.eventKind === "absolute") {
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
    } else if (event.action === "removed") {
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(x - radius, y - radius);
      context.lineTo(x + radius, y + radius);
      context.moveTo(x + radius, y - radius);
      context.lineTo(x - radius, y + radius);
      context.stroke();
    } else {
      context.fillStyle = color;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }

  if (
    data.hover &&
    data.hover.x >= left &&
    data.hover.x <= left + plotWidth &&
    data.hover.y >= top &&
    data.hover.y <= top + plotHeight
  ) {
    const hoverTime = timeFrom + ((data.hover.x - left) / plotWidth) * (timeTo - timeFrom);
    const hoverPrice = priceMax - ((data.hover.y - top) / plotHeight) * priceSpan;
    context.strokeStyle = "rgba(190, 205, 220, 0.55)";
    context.lineWidth = 1;
    context.setLineDash([3, 3]);
    context.beginPath();
    context.moveTo(data.hover.x, top);
    context.lineTo(data.hover.x, top + plotHeight);
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

function LiquiditySettingsGroup({
  title,
  enabled,
  onEnabledChange,
  children,
}: {
  title: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="liquidity-settings-group">
      <legend>{title}</legend>
      <label className="liquidity-settings-enable">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onEnabledChange(event.currentTarget.checked)}
        />
        Enable
      </label>
      <div className={enabled ? "liquidity-settings-fields" : "liquidity-settings-fields is-disabled"}>
        {children}
      </div>
    </fieldset>
  );
}

function SettingNumber({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="liquidity-settings-field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        step={1}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
    </label>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "bid" | "ask";
}) {
  return (
    <div className={`liquidity-summary-item is-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
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

function mergeLiveLine(
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
    ["longTermMinAgeSeconds", 1, 3_600],
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
