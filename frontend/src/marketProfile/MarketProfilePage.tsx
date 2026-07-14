import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ApiClient } from "../api/client";
import { buildHistoryUrl, type HistoryResponse } from "../cache/historyLoader";
import type { Bar } from "../cache/types";
import { resolveEndpoints } from "../endpoints";
import type { DeltaProfileData, DeltaProfileRow, DeltaProfileSource } from "../orderflow/deltaProfile";
import type { Timeframe } from "../socket/messages";

const SYMBOL = "GC";
const CHART_CONTRACT = SYMBOL;
const DEFAULT_DAYS = 5;
const MIN_DAYS = 1;
const MAX_DAYS = 20;
const SESSION_TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
const SESSION_OPEN_LOCAL_HOUR = 5;
const SESSION_CLOSE_LOCAL_HOUR = 4;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_TRADING_MS =
  ((24 + SESSION_CLOSE_LOCAL_HOUR - SESSION_OPEN_LOCAL_HOUR) % 24) * HOUR_MS;
const PRICE_AXIS_WIDTH = 74;
const TIME_AXIS_HEIGHT = 34;
const TOP_PADDING = 24;
const LEFT_PADDING = 16;
const PROFILE_WIDTH_FRACTION = 0.32;
const PROFILE_ROW_TICKS = 5;
const GC_TICK_SIZE = 0.1;
const PROFILE_PRICE_STEP = PROFILE_ROW_TICKS * GC_TICK_SIZE;
const PRICE_AXIS_LABEL_STEP = 5;
const TPO_BRACKET_MS = 30 * 60 * 1000;
const TPO_VALUE_AREA_PCT = 70;
const TPO_POC_COLOR = "#ff00d4";
const TPO_OUTSIDE_VA_COLOR = "#00d020";
const TPO_UPPER_VA_COLOR = "#666666";
const TPO_LOWER_VA_COLOR = "#d8d8d8";
const TPO_BODY_COLOR = "#8e8e8e";
const TPO_VOLUME_BODY_COLOR = "#8b8b8b";
const TPO_VOLUME_EDGE_COLOR = "#00158f";
const MIN_VIEW_SCALE = 0.35;
const MAX_VIEW_SCALE = 8;
const X_SCALE_SENSITIVITY = 0.003;
const Y_SCALE_SENSITIVITY = 0.003;

type MarketProfileTimeframe = Extract<Timeframe, "5m" | "15m">;
type ProfileMode = "volume" | "delta" | "tpo";

interface TpoRow {
  price: number;
  bracketIndices: number[];
  count: number;
}

interface TpoProfile {
  rows: TpoRow[];
  step: number;
  bracketCount: number;
  totalCount: number;
  maxCount: number;
  poc: number | null;
  vah: number | null;
  val: number | null;
}

interface MarketProfileDay {
  start: number;
  end: number;
  bars: Bar[];
  profile: DeltaProfileData | null;
  tpo: TpoProfile | null;
}

interface MarketProfileState {
  days: MarketProfileDay[];
  bars: Bar[];
  from: number;
  to: number;
}

interface MarketProfileView {
  xScale: number;
  yScale: number;
  xOffset: number;
  yOffset: number;
}

type MarketProfileDragMode = "pan" | "scale-x" | "scale-y";
type MarketProfileInteractionMode = MarketProfileDragMode | "pinch";

interface MarketProfilePointerState {
  pointerId: number;
  clientX: number;
  clientY: number;
}

interface MarketProfileDragState {
  mode: MarketProfileDragMode;
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  view: MarketProfileView;
}

interface MarketProfilePinchState {
  mode: "pinch";
  pointerIds: [number, number];
  startDistanceX: number;
  startDistanceY: number;
  originX: number;
  originY: number;
  view: MarketProfileView;
}

type MarketProfileInteractionState = MarketProfileDragState | MarketProfilePinchState;

const DEFAULT_MARKET_PROFILE_VIEW: MarketProfileView = {
  xScale: 1,
  yScale: 1,
  xOffset: 0,
  yOffset: 0,
};

export function MarketProfilePage() {
  const endpoints = useMemo(() => resolveEndpoints(), []);
  const api = useMemo(() => new ApiClient({ basePath: endpoints.api }), [endpoints.api]);
  const [tf, setTf] = useState<MarketProfileTimeframe>("15m");
  const [profileMode, setProfileMode] = useState<ProfileMode>("volume");
  const [dayCount, setDayCount] = useState(DEFAULT_DAYS);
  const [dayInput, setDayInput] = useState(String(DEFAULT_DAYS));
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<MarketProfileState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const now = Date.now();
    const starts = recentSessionStarts(dayCount, now);
    const from = starts[0];
    const to = Math.min(now, sessionEndForStart(starts[starts.length - 1]));

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const bars = await loadHistoryBars({
          tf,
          from,
          to,
          basePath: endpoints.api,
        });
        const source: DeltaProfileSource =
          profileMode === "delta" ? "footprint_cache" : "minute_bars";
        const profiles = await Promise.all(
          starts.map((start) =>
            api.deltaProfile({
              symbol: SYMBOL,
              contract: CHART_CONTRACT,
              from: start,
              to: Math.min(sessionEndForStart(start), to),
              rowTicks: PROFILE_ROW_TICKS,
              valueAreaPct: 70,
              source,
            }),
          ),
        );
        if (cancelled) return;
        setState({
          bars,
          from,
          to,
          days: starts.map((start, index) => {
            const end = sessionEndForStart(start);
            const dayBars = bars.filter((bar) => bar.time >= start && bar.time <= end);
            return {
              start,
              end,
              bars: dayBars,
              profile: profiles[index] ?? null,
              tpo: buildTpoProfile(dayBars, start, end),
            };
          }),
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Market profile load failed");
          setState(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [api, dayCount, endpoints.api, profileMode, reloadKey, tf]);

  const submitDays = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = clampInteger(dayInput, MIN_DAYS, MAX_DAYS, DEFAULT_DAYS);
    setDayCount(next);
    setDayInput(String(next));
  };

  const status = loading
    ? "Loading"
    : error
      ? error
      : state
        ? `${state.bars.length} ${tf} bars - ${formatProfileMode(profileMode)}`
          + ` - ${PROFILE_ROW_TICKS} ticks/profile row`
        : "No data";

  return (
    <div className="market-profile-page">
      <header className="market-profile-toolbar">
        <a className="market-profile-link" href="/">
          Chart
        </a>
        <a className="market-profile-link" href="/fp">
          FP
        </a>
        <div className="market-profile-title">
          <span>GC Market Profile</span>
          <span>Daily</span>
        </div>
        <form className="market-profile-form" onSubmit={submitDays}>
          <label>
            Days
            <input
              type="number"
              min={MIN_DAYS}
              max={MAX_DAYS}
              value={dayInput}
              onChange={(event) => setDayInput(event.currentTarget.value)}
            />
          </label>
          <button type="submit">Load</button>
        </form>
        <div className="market-profile-segmented" aria-label="Timeframe">
          {(["15m", "5m"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={tf === value}
              onClick={() => setTf(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="market-profile-segmented" aria-label="Profile mode">
          {(["volume", "delta", "tpo"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={profileMode === value}
              onClick={() => setProfileMode(value)}
            >
              {formatProfileMode(value)}
            </button>
          ))}
        </div>
        <button
          className="market-profile-reload"
          type="button"
          onClick={() => setReloadKey((value) => value + 1)}
        >
          Reload
        </button>
        <div className="market-profile-status" aria-live="polite">
          {status}
        </div>
      </header>
      <main className="market-profile-chart">
        <MarketProfileCanvas data={state} profileMode={profileMode} />
      </main>
    </div>
  );
}

function MarketProfileCanvas({
  data,
  profileMode,
}: {
  data: MarketProfileState | null;
  profileMode: ProfileMode;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<MarketProfileInteractionState | null>(null);
  const activePointersRef = useRef<Map<number, MarketProfilePointerState>>(new Map());
  const [hostRef, size] = useElementSize();
  const [view, setView] = useState<MarketProfileView>(DEFAULT_MARKET_PROFILE_VIEW);
  const [interaction, setInteraction] = useState<MarketProfileInteractionMode | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawMarketProfile(ctx, data, profileMode, size.width, size.height, view);
  }, [data, profileMode, size.height, size.width, view]);

  useEffect(() => {
    setView(DEFAULT_MARKET_PROFILE_VIEW);
  }, [data?.from, data?.to]);

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    activePointersRef.current.set(event.pointerId, {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    });
    event.currentTarget.setPointerCapture(event.pointerId);

    if (startPinchGesture(event.currentTarget)) {
      event.preventDefault();
      return;
    }

    const mode = dragModeForPoint(
      localX,
      localY,
      size.width,
      size.height,
      event.shiftKey,
    );
    dragRef.current = {
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: localX,
      originY: localY,
      view,
    };
    setInteraction(mode);
    event.preventDefault();
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = activePointersRef.current.get(event.pointerId);
    if (pointer) {
      pointer.clientX = event.clientX;
      pointer.clientY = event.clientY;
    }

    const drag = dragRef.current;
    if (!drag) return;
    const plot = marketProfilePlot(size.width, size.height);

    if (drag.mode === "pinch") {
      const first = activePointersRef.current.get(drag.pointerIds[0]);
      const second = activePointersRef.current.get(drag.pointerIds[1]);
      if (!first || !second) return;
      const distances = pinchDistances(first, second);
      const nextXScale = clampScale(
        drag.view.xScale * pinchScaleRatio(drag.startDistanceX, distances.x),
      );
      const nextYScale = clampScale(
        drag.view.yScale * pinchScaleRatio(drag.startDistanceY, distances.y),
      );
      let next = scaleMarketProfileView(
        drag.view,
        "x",
        nextXScale,
        drag.originX,
        plot,
      );
      next = scaleMarketProfileView(next, "y", nextYScale, drag.originY, plot);
      setView(next);
      event.preventDefault();
      return;
    }

    if (drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (drag.mode === "pan") {
      setView(
        normalizeMarketProfileView(
          {
            ...drag.view,
            xOffset: drag.view.xOffset + dx,
            yOffset: drag.view.yOffset + dy,
          },
          plot,
        ),
      );
    } else if (drag.mode === "scale-x") {
      const nextScale = clampScale(
        drag.view.xScale * Math.exp(dx * X_SCALE_SENSITIVITY),
      );
      setView(scaleMarketProfileView(drag.view, "x", nextScale, drag.originX, plot));
    } else {
      const nextScale = clampScale(
        drag.view.yScale * Math.exp(-dy * Y_SCALE_SENSITIVITY),
      );
      setView(scaleMarketProfileView(drag.view, "y", nextScale, drag.originY, plot));
    }
    event.preventDefault();
  };

  const stopDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(event.pointerId);
    const drag = dragRef.current;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!drag) return;
    if (drag.mode === "pinch") {
      if (drag.pointerIds.includes(event.pointerId)) {
        dragRef.current = null;
        setInteraction(null);
      }
      return;
    }
    if (drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setInteraction(null);
  };

  const startPinchGesture = (target: HTMLDivElement): boolean => {
    const pointers = Array.from(activePointersRef.current.values());
    if (pointers.length < 2) return false;
    const [first, second] = pointers.slice(-2);
    const rect = target.getBoundingClientRect();
    const distances = pinchDistances(first, second);
    dragRef.current = {
      mode: "pinch",
      pointerIds: [first.pointerId, second.pointerId],
      startDistanceX: distances.x,
      startDistanceY: distances.y,
      originX: (first.clientX + second.clientX) / 2 - rect.left,
      originY: (first.clientY + second.clientY) / 2 - rect.top,
      view,
    };
    setInteraction("pinch");
    return true;
  };

  return (
    <div
      ref={hostRef}
      className={`market-profile-canvas-shell${interaction ? ` is-${interaction}` : ""}`}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onDoubleClick={() => setView(DEFAULT_MARKET_PROFILE_VIEW)}
    >
      <canvas
        ref={canvasRef}
        width={size.width}
        height={size.height}
        aria-label="Market profile"
      />
    </div>
  );
}

async function loadHistoryBars(input: {
  tf: MarketProfileTimeframe;
  from: number;
  to: number;
  basePath: string;
}): Promise<Bar[]> {
  const url = buildHistoryUrl(
    {
      symbol: SYMBOL,
      contract: CHART_CONTRACT,
      timeframe: input.tf,
      from: input.from,
      to: input.to,
      limit: 5000,
    },
    input.basePath,
  );
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(`history request failed: ${response.status}`);
  }
  const body = (await response.json()) as Partial<HistoryResponse> | null;
  if (!body || !Array.isArray(body.bars)) {
    throw new Error("history response is missing bars");
  }
  return body.bars
    .filter((bar) => isFiniteNumber(bar.time) && isFiniteNumber(bar.close))
    .sort((a, b) => a.time - b.time);
}

function marketProfilePlot(width: number, height: number) {
  return {
    left: LEFT_PADDING,
    top: TOP_PADDING,
    right: Math.max(LEFT_PADDING + 20, width - PRICE_AXIS_WIDTH),
    bottom: Math.max(TOP_PADDING + 20, height - TIME_AXIS_HEIGHT),
  };
}

function drawMarketProfile(
  ctx: CanvasRenderingContext2D,
  data: MarketProfileState | null,
  profileMode: ProfileMode,
  width: number,
  height: number,
  view: MarketProfileView,
): void {
  ctx.clearRect(0, 0, width, height);
  const tpoStyle = profileMode === "tpo";
  ctx.fillStyle = tpoStyle ? "#000000" : "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const plot = marketProfilePlot(width, height);
  const plotWidth = Math.max(1, plot.right - plot.left);
  const plotHeight = Math.max(1, plot.bottom - plot.top);

  if (!data || data.days.length === 0) {
    drawEmptyState(ctx, width, height);
    return;
  }

  const bounds = priceBounds(data);
  if (!bounds) {
    drawEmptyState(ctx, width, height);
    return;
  }

  const compressedTime = (time: number) => compressedSessionPosition(data.days, time);
  const xDomain = Math.max(1, data.days.length);
  const xForTime = (time: number) =>
    plot.left +
    (compressedTime(time) / xDomain) *
      plotWidth *
      view.xScale +
    view.xOffset;
  const yForPrice = (price: number) =>
    plot.top +
    ((bounds.max - price) / Math.max(0.000001, bounds.max - bounds.min)) *
      plotHeight *
      view.yScale +
    view.yOffset;

  drawGrid(ctx, plot, bounds, data.days, xForTime, yForPrice, tpoStyle);
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.left, plot.top, plotWidth, plotHeight);
  ctx.clip();
  drawSessionProfiles(ctx, data.days, profileMode, xForTime, yForPrice, plot);
  if (!tpoStyle) {
    drawLine(ctx, data.bars, xForTime, yForPrice, plot);
  }
  drawOpenMarkers(ctx, data.days, xForTime, yForPrice, tpoStyle);
  ctx.restore();
  drawAxes(ctx, plot, bounds, data.days, xForTime, yForPrice, tpoStyle);
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  plot: { left: number; top: number; right: number; bottom: number },
  bounds: { min: number; max: number; step: number },
  days: readonly MarketProfileDay[],
  xForTime: (time: number) => number,
  yForPrice: (price: number) => number,
  dark = false,
): void {
  ctx.save();
  ctx.strokeStyle = dark ? "rgba(255, 255, 255, 0.09)" : "rgba(0, 0, 0, 0.12)";
  ctx.lineWidth = 1;
  ctx.setLineDash(dark ? [1, 6] : [2, 4]);
  const firstPrice = Math.ceil(bounds.min / PRICE_AXIS_LABEL_STEP) * PRICE_AXIS_LABEL_STEP;
  const lastPrice = Math.floor(bounds.max / PRICE_AXIS_LABEL_STEP) * PRICE_AXIS_LABEL_STEP;
  for (let price = lastPrice; price >= firstPrice; price -= PRICE_AXIS_LABEL_STEP) {
    const y = yForPrice(price);
    if (y < plot.top - 20 || y > plot.bottom + 20) continue;
    ctx.beginPath();
    ctx.moveTo(plot.left, y);
    ctx.lineTo(plot.right, y);
    ctx.stroke();
  }
  if (!dark) {
    ctx.setLineDash([5, 6]);
    for (const day of days) {
      const x = xForTime(day.start);
      if (x < plot.left - 40 || x > plot.right + 40) continue;
      ctx.beginPath();
      ctx.moveTo(x, plot.top);
      ctx.lineTo(x, plot.bottom);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = dark ? "rgba(255, 255, 255, 0.5)" : "#d0d0d0";
  ctx.strokeRect(plot.left, plot.top, plot.right - plot.left, plot.bottom - plot.top);
  ctx.restore();
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  bars: readonly Bar[],
  xForTime: (time: number) => number,
  yForPrice: (price: number) => number,
  plot: { left: number; right: number },
): void {
  const points = bars.filter((bar) => isFiniteNumber(bar.close));
  if (points.length === 0) return;

  const gradient = ctx.createLinearGradient(0, 0, ctx.canvas.width, 0);
  gradient.addColorStop(0, "#0ea5e9");
  gradient.addColorStop(1, "#b020ff");
  ctx.save();
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  let drew = false;
  let lastX = -Infinity;
  points.forEach((bar, index) => {
    const x = xForTime(bar.time);
    const y = yForPrice(bar.close);
    if (
      index !== 0 &&
      index !== points.length - 1 &&
      x >= plot.left &&
      x <= plot.right &&
      x - lastX < 0.75
    ) {
      return;
    }
    if (!drew || x < plot.left - 50 || x > plot.right + 50) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    drew = true;
    lastX = x;
  });
  ctx.stroke();
  ctx.restore();
}

function drawSessionProfiles(
  ctx: CanvasRenderingContext2D,
  days: readonly MarketProfileDay[],
  profileMode: ProfileMode,
  xForTime: (time: number) => number,
  yForPrice: (price: number) => number,
  plot: { left: number; top: number; right: number; bottom: number },
): void {
  for (const day of days) {
    const x0 = xForTime(day.start);
    const x1 = xForTime(day.end);
    if (x1 < plot.left || x0 > plot.right) continue;
    if (profileMode === "tpo") {
      drawTpoSessionProfile(ctx, day, x0, x1, yForPrice, plot);
      continue;
    }

    if (!day.profile || day.profile.rows.length === 0) continue;
    const sessionWidth = Math.max(20, x1 - x0);
    const profileWidth = Math.max(28, sessionWidth * PROFILE_WIDTH_FRACTION);
    const profileLeft = x0 + 8;
    const profileRight = Math.min(plot.right - 4, profileLeft + profileWidth);
    const profileVisible = profileRight > plot.left && profileLeft < plot.right;
    const maxVolume = Math.max(1, ...day.profile.rows.map((row) => row.totalVolume));
    const maxDelta = Math.max(1, ...day.profile.rows.map((row) => Math.abs(row.delta)));
    const rowStep = inferProfileStep(day.profile.rows);

    if (profileVisible) {
      for (const row of day.profile.rows) {
        const y = yForPrice(row.price);
        const yNext = yForPrice(row.price - rowStep);
        const h = Math.max(1, Math.abs(yNext - y) * 0.82);
        if (profileMode === "delta") {
          const w = (Math.abs(row.delta) / maxDelta) * profileWidth;
          ctx.fillStyle = row.delta >= 0 ? "rgba(0, 139, 139, 0.68)" : "rgba(239, 68, 68, 0.66)";
          ctx.fillRect(profileLeft, y - h / 2, w, h);
        } else {
          const w = (row.totalVolume / maxVolume) * profileWidth;
          ctx.fillStyle = "rgba(37, 99, 235, 0.52)";
          ctx.fillRect(profileLeft, y - h / 2, w, h);
        }
      }
    }

    drawProfileLevel(ctx, "VAH", day.profile.vah, "#1d4ed8", x0, x1, yForPrice, plot);
    drawProfileLevel(ctx, "VAL", day.profile.val, "#1d4ed8", x0, x1, yForPrice, plot);
    drawProfileLevel(ctx, "POC", day.profile.poc, "#e600ff", x0, x1, yForPrice, plot);
  }
}

function drawTpoSessionProfile(
  ctx: CanvasRenderingContext2D,
  day: MarketProfileDay,
  x0: number,
  x1: number,
  yForPrice: (price: number) => number,
  plot: { left: number; top: number; right: number; bottom: number },
): void {
  const sessionWidth = Math.max(20, x1 - x0);
  const tpo = day.tpo;
  if (tpo && tpo.rows.length > 0) {
    const profileLeft = x0 + 8;
    const desiredWidth = Math.max(28, sessionWidth * 0.52);
    const cellWidth = clampNumber(
      desiredWidth / Math.max(1, tpo.maxCount),
      2,
      10,
    );
    const actualWidth = cellWidth * tpo.maxCount;
    const profileVisible = profileLeft + actualWidth > plot.left && profileLeft < plot.right;

    if (profileVisible) {
      ctx.save();
      for (const row of tpo.rows) {
        const y = yForPrice(row.price);
        const yNext = yForPrice(row.price - tpo.step);
        const h = Math.max(1, Math.abs(yNext - y) * 0.88);
        if (y + h < plot.top || y - h > plot.bottom) continue;
        const isPoc = isPriceNear(row.price, tpo.poc, tpo.step);
        const cellColor = tpoCellColor(row.price, tpo);
        const cellGap = cellWidth >= 4 ? 1 : 0.4;
        const rowTop = y - h / 2;
        const rowHeight = Math.max(1, h - 0.75);

        if (isPoc) {
          const rowWidth = row.bracketIndices.length * cellWidth;
          ctx.fillStyle = TPO_POC_COLOR;
          ctx.fillRect(profileLeft, rowTop, Math.max(cellWidth, rowWidth), rowHeight);
          continue;
        }

        for (let cellIndex = 0; cellIndex < row.count; cellIndex++) {
          const x = profileLeft + cellIndex * cellWidth;
          if (x + cellWidth < plot.left || x > plot.right) continue;
          ctx.fillStyle = cellColor;
          ctx.fillRect(x, rowTop, Math.max(1, cellWidth - cellGap), rowHeight);
        }
      }
      ctx.restore();
    }

    drawProfileLevel(ctx, "VAH", tpo.vah, "#00ff3c", x0, x1, yForPrice, plot, true);
    drawProfileLevel(ctx, "VAL", tpo.val, "#ff2f2f", x0, x1, yForPrice, plot, true);
    drawProfileLevel(ctx, "POC", tpo.poc, TPO_POC_COLOR, x0, x1, yForPrice, plot, true);
  }

  if (day.profile && day.profile.rows.length > 0) {
    const volumeWidth = Math.max(18, Math.min(78, sessionWidth * 0.2));
    drawTpoVolumeProfileOverlay(
      ctx,
      day.profile,
      x1 - volumeWidth - 8,
      volumeWidth,
      yForPrice,
      plot,
    );
  }

  drawTpoDayFrame(ctx, day, x0, x1, yForPrice, plot);
}

function drawTpoVolumeProfileOverlay(
  ctx: CanvasRenderingContext2D,
  profile: DeltaProfileData,
  left: number,
  width: number,
  yForPrice: (price: number) => number,
  plot: { left: number; top: number; right: number; bottom: number },
): void {
  if (left + width < plot.left || left > plot.right) return;
  const maxVolume = Math.max(1, ...profile.rows.map((row) => row.totalVolume));
  const rowStep = inferProfileStep(profile.rows);
  const renderRows = profile.rows
    .filter((row) => row.totalVolume > 0)
    .map((row) => {
      const y = yForPrice(row.price);
      const yNext = yForPrice(row.price - rowStep);
      const h = Math.max(1, Math.abs(yNext - y) * 0.82);
      return { row, y, h };
    });
  if (renderRows.length === 0) return;

  ctx.save();
  for (const { row, y, h } of renderRows) {
    if (y + h < plot.top || y - h > plot.bottom) continue;
    const w = (row.totalVolume / maxVolume) * width;
    const isPoc = isPriceNear(row.price, profile.poc, rowStep);
    const inValueArea = isPriceInsideRange(row.price, profile.vah, profile.val);
    ctx.fillStyle = isPoc
      ? TPO_POC_COLOR
      : inValueArea
        ? TPO_VOLUME_BODY_COLOR
        : TPO_VOLUME_EDGE_COLOR;
    ctx.fillRect(left, y - h / 2, Math.max(1, w), Math.max(1, h - 0.6));
  }
  ctx.restore();
}

function drawTpoDayFrame(
  ctx: CanvasRenderingContext2D,
  day: MarketProfileDay,
  x0: number,
  x1: number,
  yForPrice: (price: number) => number,
  plot: { left: number; top: number; right: number; bottom: number },
): void {
  const prices = [
    ...day.bars.flatMap((bar) => [bar.high, bar.low]),
    ...(day.tpo?.rows.map((row) => row.price) ?? []),
    ...(day.profile?.rows.map((row) => row.price) ?? []),
    day.tpo?.poc,
    day.tpo?.vah,
    day.tpo?.val,
    day.profile?.poc,
    day.profile?.vah,
    day.profile?.val,
  ].filter(isFiniteNumber);
  if (prices.length === 0) return;

  const step = day.tpo?.step ?? (day.profile ? inferProfileStep(day.profile.rows) : PROFILE_PRICE_STEP);
  const top = Math.max(plot.top, yForPrice(Math.max(...prices) + step / 2));
  const bottom = Math.min(plot.bottom, yForPrice(Math.min(...prices) - step / 2));
  const left = Math.max(plot.left, x0);
  const right = Math.min(plot.right, x1);
  if (right <= left || bottom <= top) return;

  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 5]);
  ctx.strokeRect(left, top, right - left, bottom - top);
  ctx.restore();
}

function tpoCellColor(price: number, tpo: TpoProfile): string {
  if (isPriceNear(price, tpo.poc, tpo.step)) return TPO_POC_COLOR;
  if (!isPriceInsideRange(price, tpo.vah, tpo.val)) return TPO_OUTSIDE_VA_COLOR;
  if (isFiniteNumber(tpo.poc)) {
    if (price > tpo.poc) return TPO_UPPER_VA_COLOR;
    if (price < tpo.poc) return TPO_LOWER_VA_COLOR;
  }
  return TPO_BODY_COLOR;
}

function isPriceNear(price: number, level: number | null, step: number): boolean {
  return isFiniteNumber(level) && Math.abs(price - level) <= step / 2;
}

function isPriceInsideRange(price: number, high: number | null, low: number | null): boolean {
  if (!isFiniteNumber(high) || !isFiniteNumber(low)) return false;
  return price >= Math.min(high, low) && price <= Math.max(high, low);
}

function drawProfileLevel(
  ctx: CanvasRenderingContext2D,
  label: string,
  price: number | null,
  color: string,
  x0: number,
  x1: number,
  yForPrice: (price: number) => number,
  plot: { left: number; top: number; right: number; bottom: number },
  dark = false,
): void {
  if (!isFiniteNumber(price)) return;
  const y = yForPrice(price);
  const visibleLeft = Math.max(plot.left, Math.min(x0, x1));
  const visibleRight = Math.min(plot.right, Math.max(x0, x1));
  if (visibleRight <= visibleLeft) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = label === "POC" ? 2.6 : 1.8;
  ctx.setLineDash(dark && label !== "POC" ? [] : []);
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();

  const text = `${label} ${formatPrice(price, GC_TICK_SIZE)}`;
  const fontSize = 12;
  const labelHeight = fontSize + 5;
  const horizontalPadding = 4;
  const verticalPadding = 2;
  ctx.fillStyle = color;
  ctx.font = `bold ${fontSize}px Segoe UI, Arial`;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";

  const textWidth = ctx.measureText(text).width;
  const labelMinX = Math.max(plot.left + horizontalPadding, visibleLeft + 3);
  const labelMaxX = Math.max(
    labelMinX,
    Math.min(plot.right - textWidth - horizontalPadding, visibleRight - textWidth - 3),
  );
  const labelX = clampNumber(visibleLeft + 3, labelMinX, labelMaxX);
  const baselineY =
    y - 3 - labelHeight < plot.top ? y + labelHeight + 3 : y - 3;
  const boxTop = baselineY - labelHeight;
  const boxLeft = labelX - horizontalPadding;
  const boxWidth = textWidth + horizontalPadding * 2;

  ctx.fillStyle = dark ? "rgba(0, 0, 0, 0.76)" : "rgba(255, 255, 255, 0.82)";
  ctx.fillRect(boxLeft, boxTop, boxWidth, labelHeight);
  ctx.fillStyle = color;
  ctx.fillText(text, labelX, baselineY - verticalPadding);
  ctx.restore();
}

function drawOpenMarkers(
  ctx: CanvasRenderingContext2D,
  days: readonly MarketProfileDay[],
  xForTime: (time: number) => number,
  yForPrice: (price: number) => number,
  dark = false,
): void {
  ctx.save();
  for (const day of days) {
    const open = day.bars[0]?.open;
    if (isFiniteNumber(open)) {
      const x = xForTime(day.start);
      const y = yForPrice(open);
      ctx.fillStyle = dark ? "#ff9d00" : "#1d4ed8";
      if (dark) {
        ctx.fillRect(x + 4, y - 5, 8, 10);
      } else {
        ctx.beginPath();
        ctx.moveTo(x + 12, y);
        ctx.lineTo(x + 2, y - 7);
        ctx.lineTo(x + 2, y + 7);
        ctx.closePath();
        ctx.fill();
      }
    }

    const close = sessionCloseMarker(day);
    if (!close) continue;
    const x = xForTime(close.time);
    const y = yForPrice(close.price);
    ctx.fillStyle = dark ? "#ff4d6d" : "#dc2626";
    ctx.beginPath();
    ctx.moveTo(x - 12, y);
    ctx.lineTo(x - 2, y - 7);
    ctx.lineTo(x - 2, y + 7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawAxes(
  ctx: CanvasRenderingContext2D,
  plot: { left: number; top: number; right: number; bottom: number },
  bounds: { min: number; max: number; step: number },
  days: readonly MarketProfileDay[],
  xForTime: (time: number) => number,
  yForPrice: (price: number) => number,
  dark = false,
): void {
  ctx.save();
  ctx.fillStyle = dark ? "#000000" : "rgba(255, 255, 255, 0.96)";
  ctx.fillRect(plot.right, 0, PRICE_AXIS_WIDTH, ctx.canvas.height);
  ctx.fillRect(0, plot.bottom, ctx.canvas.width, TIME_AXIS_HEIGHT);

  ctx.strokeStyle = dark ? "#e5e7eb" : "#b8b8b8";
  ctx.beginPath();
  ctx.moveTo(plot.right, plot.top);
  ctx.lineTo(plot.right, plot.bottom);
  ctx.moveTo(plot.left, plot.bottom);
  ctx.lineTo(plot.right, plot.bottom);
  ctx.stroke();

  ctx.fillStyle = dark ? "#ffffff" : "#666666";
  ctx.font = "11px Segoe UI, Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const firstPrice = Math.ceil(bounds.min / PRICE_AXIS_LABEL_STEP) * PRICE_AXIS_LABEL_STEP;
  const lastPrice = Math.floor(bounds.max / PRICE_AXIS_LABEL_STEP) * PRICE_AXIS_LABEL_STEP;
  for (let price = lastPrice; price >= firstPrice; price -= PRICE_AXIS_LABEL_STEP) {
    const y = yForPrice(price);
    if (y < plot.top - 14 || y > plot.bottom + 14) continue;
    ctx.fillText(formatPrice(price, PRICE_AXIS_LABEL_STEP), plot.right + 8, y);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = dark ? "#ffffff" : "#666666";
  for (const day of days) {
    const x = xForTime(day.start + DAY_MS / 2);
    if (x < plot.left - 40 || x > plot.right + 40) continue;
    ctx.fillText(formatSessionDate(day.start), x, plot.bottom + 9);
  }
  ctx.restore();
}

function drawEmptyState(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.fillStyle = "#666666";
  ctx.font = "13px Segoe UI, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("No market profile data", width / 2, height / 2);
}

function dragModeForPoint(
  x: number,
  y: number,
  width: number,
  height: number,
  scaleXInPlot = false,
): MarketProfileDragMode {
  const plot = marketProfilePlot(width, height);
  if (x >= plot.right) return "scale-y";
  if (y >= plot.bottom) return "scale-x";
  if (scaleXInPlot) return "scale-x";
  return "pan";
}

function pinchDistances(
  first: MarketProfilePointerState,
  second: MarketProfilePointerState,
): { x: number; y: number } {
  return {
    x: Math.abs(second.clientX - first.clientX),
    y: Math.abs(second.clientY - first.clientY),
  };
}

function pinchScaleRatio(startDistance: number, currentDistance: number): number {
  if (!Number.isFinite(startDistance) || !Number.isFinite(currentDistance)) return 1;
  if (startDistance < 24 || currentDistance < 1) return 1;
  return clampNumber(currentDistance / startDistance, 0.35, 2.85);
}

function scaleMarketProfileView(
  view: MarketProfileView,
  axis: "x" | "y",
  nextScale: number,
  origin: number,
  plot: ReturnType<typeof marketProfilePlot>,
): MarketProfileView {
  if (axis === "x") {
    const rel = clampNumber(origin - plot.left, 0, Math.max(1, plot.right - plot.left));
    const baseAtOrigin = (rel - view.xOffset) / view.xScale;
    return normalizeMarketProfileView(
      {
        ...view,
        xScale: nextScale,
        xOffset: rel - baseAtOrigin * nextScale,
      },
      plot,
    );
  }

  const rel = clampNumber(origin - plot.top, 0, Math.max(1, plot.bottom - plot.top));
  const baseAtOrigin = (rel - view.yOffset) / view.yScale;
  return normalizeMarketProfileView(
    {
      ...view,
      yScale: nextScale,
      yOffset: rel - baseAtOrigin * nextScale,
    },
    plot,
  );
}

function normalizeMarketProfileView(
  view: MarketProfileView,
  plot: ReturnType<typeof marketProfilePlot>,
): MarketProfileView {
  const xScale = clampScale(view.xScale);
  const yScale = clampScale(view.yScale);
  const plotWidth = Math.max(1, plot.right - plot.left);
  const plotHeight = Math.max(1, plot.bottom - plot.top);
  return {
    xScale,
    yScale,
    xOffset: clampOffsetForScale(view.xOffset, xScale, plotWidth),
    yOffset: clampOffsetForScale(view.yOffset, yScale, plotHeight),
  };
}

function clampScale(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return clampNumber(value, MIN_VIEW_SCALE, MAX_VIEW_SCALE);
}

function clampOffsetForScale(value: number, scale: number, size: number): number {
  if (scale >= 1) {
    return clampNumber(value, size * (1 - scale), 0);
  }
  return clampNumber(value, 0, size * (1 - scale));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildTpoProfile(
  bars: readonly Bar[],
  start: number,
  end: number,
): TpoProfile | null {
  const validBars = bars.filter(
    (bar) =>
      isFiniteNumber(bar.time) &&
      isFiniteNumber(bar.high) &&
      isFiniteNumber(bar.low) &&
      bar.time >= start &&
      bar.time <= end,
  );
  if (validBars.length === 0) return null;

  const step = PROFILE_PRICE_STEP;
  const bracketCount = Math.max(1, Math.ceil((end - start + 1) / TPO_BRACKET_MS));
  const rowsByIndex = new Map<number, Set<number>>();

  for (const bar of validBars) {
    const bracketIndex = Math.floor((bar.time - start) / TPO_BRACKET_MS);
    if (bracketIndex < 0 || bracketIndex >= bracketCount) continue;

    const low = Math.min(bar.low, bar.high);
    const high = Math.max(bar.low, bar.high);
    const lowIndex = Math.floor(low / step);
    const highIndex = Math.floor(high / step);

    for (let rowIndex = lowIndex; rowIndex <= highIndex; rowIndex++) {
      let brackets = rowsByIndex.get(rowIndex);
      if (!brackets) {
        brackets = new Set<number>();
        rowsByIndex.set(rowIndex, brackets);
      }
      brackets.add(bracketIndex);
    }
  }

  const rows = Array.from(rowsByIndex.entries())
    .map(([rowIndex, brackets]) => {
      const bracketIndices = Array.from(brackets).sort((a, b) => a - b);
      return {
        price: roundProfilePrice(rowIndex * step),
        bracketIndices,
        count: bracketIndices.length,
      };
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.price - a.price);

  if (rows.length === 0) return null;

  const totalCount = rows.reduce((sum, row) => sum + row.count, 0);
  const maxCount = Math.max(1, ...rows.map((row) => row.count));
  const levels = computeTpoLevels(rows, totalCount);

  return {
    rows,
    step,
    bracketCount,
    totalCount,
    maxCount,
    poc: levels.poc,
    vah: levels.vah,
    val: levels.val,
  };
}

function computeTpoLevels(
  rows: readonly TpoRow[],
  totalCount: number,
): { poc: number | null; vah: number | null; val: number | null } {
  if (rows.length === 0 || totalCount <= 0) {
    return { poc: null, vah: null, val: null };
  }

  const ascending = [...rows].sort((a, b) => a.price - b.price);
  const meanPrice =
    ascending.reduce((sum, row) => sum + row.price * row.count, 0) / totalCount;
  let pocIndex = 0;
  for (let i = 1; i < ascending.length; i++) {
    const row = ascending[i];
    const current = ascending[pocIndex];
    if (
      row.count > current.count ||
      (row.count === current.count &&
        Math.abs(row.price - meanPrice) < Math.abs(current.price - meanPrice))
    ) {
      pocIndex = i;
    }
  }

  const target = (totalCount * TPO_VALUE_AREA_PCT) / 100;
  let lowIndex = pocIndex;
  let highIndex = pocIndex;
  let included = ascending[pocIndex].count;

  while (included < target && (lowIndex > 0 || highIndex < ascending.length - 1)) {
    const belowCount = lowIndex > 0 ? ascending[lowIndex - 1].count : -1;
    const aboveCount =
      highIndex < ascending.length - 1 ? ascending[highIndex + 1].count : -1;

    if (aboveCount >= belowCount) {
      highIndex += 1;
      included += ascending[highIndex].count;
    } else {
      lowIndex -= 1;
      included += ascending[lowIndex].count;
    }
  }

  return {
    poc: ascending[pocIndex].price,
    vah: ascending[highIndex].price,
    val: ascending[lowIndex].price,
  };
}

function roundProfilePrice(price: number): number {
  return Number(price.toFixed(10));
}

function formatProfileMode(mode: ProfileMode): string {
  if (mode === "volume") return "Volume";
  if (mode === "delta") return "Delta";
  return "TPO";
}

function priceBounds(data: MarketProfileState): { min: number; max: number; step: number } | null {
  const prices = [
    ...data.bars.flatMap((bar) => [bar.high, bar.low, bar.close, bar.open]),
    ...data.days.flatMap((day) =>
      day.profile
        ? [
          day.profile.poc,
          day.profile.vah,
          day.profile.val,
          ...day.profile.rows.map((row) => row.price),
        ]
        : [],
    ),
    ...data.days.flatMap((day) =>
      day.tpo
        ? [
          day.tpo.poc,
          day.tpo.vah,
          day.tpo.val,
          ...day.tpo.rows.map((row) => row.price),
        ]
        : [],
    ),
  ].filter(isFiniteNumber);
  if (prices.length === 0) return null;
  const step = inferPriceStep(prices);
  let min = Math.min(...prices) - step * 4;
  let max = Math.max(...prices) + step * 4;
  if (min >= max) {
    min -= step * 10;
    max += step * 10;
  }
  return { min, max, step };
}

function inferPriceStep(prices: readonly number[]): number {
  const sorted = Array.from(new Set(prices.filter(isFiniteNumber))).sort((a, b) => a - b);
  let minDiff = Infinity;
  for (let i = 1; i < sorted.length; i++) {
    const diff = sorted[i] - sorted[i - 1];
    if (diff > 0 && diff < minDiff) minDiff = diff;
  }
  return Number.isFinite(minDiff) ? minDiff : 0.1;
}

function inferProfileStep(rows: readonly DeltaProfileRow[]): number {
  return inferPriceStep(rows.map((row) => row.price));
}

function recentSessionStarts(count: number, now: number): number[] {
  const starts: number[] = [];
  let cursor = sessionStartForUtc(now);
  let scanned = 0;
  const maxScan = count + 14;
  while (starts.length < count && scanned < maxScan) {
    if (isTradingSessionStart(cursor)) {
      starts.push(cursor);
    }
    cursor -= DAY_MS;
    scanned += 1;
  }
  return starts.reverse();
}

function sessionStartForUtc(time: number): number {
  const local = new Date(time + SESSION_TZ_OFFSET_MS);
  let start =
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
      SESSION_OPEN_LOCAL_HOUR,
      0,
      0,
      0,
    ) - SESSION_TZ_OFFSET_MS;
  if (time < start) start -= DAY_MS;
  return start;
}

function sessionEndForStart(start: number): number {
  return sessionCloseForStart(start) - 1;
}

function sessionCloseForStart(start: number): number {
  return start + SESSION_TRADING_MS;
}

function isTradingSessionStart(start: number): boolean {
  const weekday = new Date(start + SESSION_TZ_OFFSET_MS).getUTCDay();
  return weekday >= 1 && weekday <= 5;
}

function sessionCloseMarker(day: MarketProfileDay): { time: number; price: number } | null {
  if (day.bars.length === 0) return null;
  const closeTime = sessionCloseForStart(day.start);
  const bars = day.bars
    .filter((bar) => bar.time < closeTime && isFiniteNumber(bar.close))
    .sort((a, b) => a.time - b.time);
  const closeBar = bars[bars.length - 1];
  if (!closeBar) return null;

  const interval = inferBarIntervalMs(bars);
  if (closeBar.time + interval < closeTime - 1) return null;

  return {
    time: closeTime,
    price: closeBar.close,
  };
}

function inferBarIntervalMs(bars: readonly Bar[]): number {
  for (let index = 1; index < bars.length; index++) {
    const diff = bars[index].time - bars[index - 1].time;
    if (diff > 0 && diff <= TPO_BRACKET_MS) return diff;
  }
  return TPO_BRACKET_MS;
}

function compressedSessionPosition(
  days: readonly MarketProfileDay[],
  time: number,
): number {
  if (days.length === 0) return 0;
  for (let index = 0; index < days.length; index++) {
    const start = days[index].start;
    const end = sessionEndForStart(start);
    if (time >= start && time <= end) {
      return index + clampNumber((time - start) / DAY_MS, 0, 1);
    }
  }
  if (time < days[0].start) return 0;
  for (let index = days.length - 1; index >= 0; index--) {
    if (time >= days[index].start) return index + 1;
  }
  return days.length;
}

function formatSessionDate(time: number): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: "Asia/Bangkok",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(time));
}

function formatPrice(price: number, step: number): string {
  const decimals = step < 1 ? Math.min(4, Math.max(1, Math.ceil(Math.abs(Math.log10(step))))) : 0;
  return price.toFixed(decimals);
}

function clampInteger(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function useElementSize(): [
  (node: HTMLDivElement | null) => void,
  { width: number; height: number },
] {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 900, height: 520 });

  const measure = useCallback(() => {
    const node = nodeRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setSize({
      width: Math.max(1, Math.round(rect.width || node.clientWidth || 900)),
      height: Math.max(1, Math.round(rect.height || node.clientHeight || 520)),
    });
  }, []);

  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      nodeRef.current = node;
      measure();
    },
    [measure],
  );

  useEffect(() => {
    measure();
    const node = nodeRef.current;
    if (!node) return;
    window.addEventListener("resize", measure);
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      observer.observe(node);
    }
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [measure]);

  return [ref, size];
}
