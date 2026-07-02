import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ApiClient } from "../api/client";
import { DEFAULT_FOOTPRINT_SETTINGS } from "../chart/IndicatorToggles";
import { resolveEndpoints } from "../endpoints";
import { ChartSocket } from "../socket/ChartSocket";
import type { ChartEventType } from "../socket/messages";
import { FootprintCanvas } from "./FootprintCanvas";
import {
  type FootprintBar,
  mergeFootprint,
  selectDisplayBars,
} from "./footprintModel";
import { parseFootprintSearchTime } from "./timeSearch";

const SYMBOL = "GC";
const CHART_CONTRACT = SYMBOL;
const DEFAULT_LATEST_COUNT = 50;
const MIN_LATEST_COUNT = 10;
const MAX_LATEST_COUNT = 100;
const DEFAULT_HISTORY_CONTEXT = 3;
const MIN_HISTORY_CONTEXT = 3;
const MAX_HISTORY_CONTEXT = 20;
const FOOTPRINT_EVENTS: ChartEventType[] = ["footprint_update"];
const MIN_BAR_WIDTH_PX = 56;
const MIN_CANVAS_HEIGHT_PX = 360;
const STANDALONE_ROW_HEIGHT_PX = 18;
const MAX_CANVAS_HEIGHT_PX = 16_000;
const identityPriceToY = (price: number) => price;

type PageMode = "latest" | "history";

export function FootprintPage() {
  const endpoints = useMemo(() => resolveEndpoints(), []);
  const api = useMemo(() => new ApiClient({ basePath: endpoints.api }), [endpoints.api]);
  const socket = useMemo(() => new ChartSocket({ url: endpoints.ws }), [endpoints.ws]);
  const requestSeq = useRef(0);
  const [canvasHostRef, canvasHostSize] = useElementSize();

  const [mode, setMode] = useState<PageMode>("latest");
  const [bars, setBars] = useState<ReadonlyMap<number, FootprintBar>>(new Map());
  const [barCount, setBarCount] = useState(DEFAULT_LATEST_COUNT);
  const [barCountInput, setBarCountInput] = useState(String(DEFAULT_LATEST_COUNT));
  const [searchInput, setSearchInput] = useState("");
  const [contextInput, setContextInput] = useState(String(DEFAULT_HISTORY_CONTEXT));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<"connected" | "disconnected">(
    "disconnected",
  );
  const [historyMeta, setHistoryMeta] = useState<{
    at: number;
    context: number;
    targetFound: boolean;
  } | null>(null);

  const loadLatest = useCallback(
    async (nextCount: number) => {
      const seq = ++requestSeq.current;
      setLoading(true);
      setError(null);
      setHistoryMeta(null);
      try {
        const result = await api.footprintDetails(SYMBOL, CHART_CONTRACT, {
          count: nextCount,
        });
        if (seq !== requestSeq.current) return;
        setMode("latest");
        setBars(mapFromBars(result.bars));
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setError(errorMessage(err));
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
        }
      }
    },
    [api],
  );

  const loadHistory = useCallback(
    async (at: number, context: number) => {
      const seq = ++requestSeq.current;
      setLoading(true);
      setError(null);
      try {
        const result = await api.footprintDetails(SYMBOL, CHART_CONTRACT, {
          at,
          context,
        });
        if (seq !== requestSeq.current) return;
        setMode("history");
        setHistoryMeta({
          at,
          context,
          targetFound: result.targetFound ?? false,
        });
        setBars(mapFromBars(result.bars));
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setError(errorMessage(err));
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
        }
      }
    },
    [api],
  );

  useEffect(() => {
    void loadLatest(DEFAULT_LATEST_COUNT);
  }, [loadLatest]);

  useEffect(() => {
    const offOpen = socket.onOpen(() => setConnection("connected"));
    const offClose = socket.onClose(() => setConnection("disconnected"));
    socket.connect();
    const reconnectTimer = window.setInterval(() => {
      socket.ensureConnected();
    }, 5_000);
    return () => {
      window.clearInterval(reconnectTimer);
      offOpen();
      offClose();
      socket.close(1000, "footprint page unmount");
    };
  }, [socket]);

  useEffect(() => {
    if (mode !== "latest") return;
    socket.subscribe(SYMBOL, FOOTPRINT_EVENTS, "1m");
    const offFootprint = socket.on("footprint_update", (msg) => {
      if (
        msg.symbol !== SYMBOL ||
        msg.tf !== "1m" ||
        (CHART_CONTRACT !== SYMBOL && msg.contract !== CHART_CONTRACT)
      ) {
        return;
      }
      setBars((prev) =>
        trimBarsMap(mergeFootprint(prev, msg), Math.max(1, barCount)),
      );
    });
    return () => {
      offFootprint();
      socket.unsubscribe(SYMBOL, FOOTPRINT_EVENTS, "1m");
    };
  }, [barCount, mode, socket]);

  const visibleBars = useMemo(() => selectDisplayBars(bars, barCount), [bars, barCount]);
  const canvasWidth = Math.max(
    canvasHostSize.width,
    Math.max(1, barCount) * MIN_BAR_WIDTH_PX + 20,
  );
  const canvasHeight = Math.min(
    MAX_CANVAS_HEIGHT_PX,
    Math.max(
      canvasHostSize.height,
      MIN_CANVAS_HEIGHT_PX,
      estimateStandaloneCanvasHeight(visibleBars),
    ),
  );
  const viewport = useMemo(
    () => ({
      priceToY: identityPriceToY,
      width: canvasWidth,
      height: canvasHeight,
      textColor: "#000000",
    }),
    [canvasHeight, canvasWidth],
  );
  const statusText = statusFor({
    mode,
    loading,
    error,
    connection,
    visibleCount: visibleBars.length,
    historyMeta,
  });

  const submitLatest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextCount = clampInteger(
      barCountInput,
      MIN_LATEST_COUNT,
      MAX_LATEST_COUNT,
      DEFAULT_LATEST_COUNT,
    );
    setBarCount(nextCount);
    setBarCountInput(String(nextCount));
    void loadLatest(nextCount);
  };

  const submitHistory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const at = parseFootprintSearchTime(searchInput);
    if (at === null) {
      setError("Invalid time");
      return;
    }
    const context = clampInteger(
      contextInput,
      MIN_HISTORY_CONTEXT,
      MAX_HISTORY_CONTEXT,
      DEFAULT_HISTORY_CONTEXT,
    );
    const nextCount = context * 2 + 1;
    setContextInput(String(context));
    setBarCount(nextCount);
    void loadHistory(at, context);
  };

  return (
    <div className="footprint-page">
      <header className="footprint-page-toolbar">
        <a className="footprint-page-back" href="/">
          Chart
        </a>
        <div className="footprint-page-title">
          <span>GC Footprint</span>
          <span>{mode === "latest" ? "Latest" : "History"}</span>
        </div>
        <form className="footprint-page-form" onSubmit={submitLatest}>
          <label>
            Bars
            <input
              type="number"
              min={MIN_LATEST_COUNT}
              max={MAX_LATEST_COUNT}
              value={barCountInput}
              onChange={(event) => setBarCountInput(event.currentTarget.value)}
            />
          </label>
          <button type="submit">Latest</button>
        </form>
        <form className="footprint-page-form footprint-page-search" onSubmit={submitHistory}>
          <label>
            Time
            <input
              type="text"
              value={searchInput}
              placeholder="20:00 1/7"
              onChange={(event) => setSearchInput(event.currentTarget.value)}
            />
          </label>
          <label>
            Context
            <input
              type="number"
              min={MIN_HISTORY_CONTEXT}
              max={MAX_HISTORY_CONTEXT}
              value={contextInput}
              onChange={(event) => setContextInput(event.currentTarget.value)}
            />
          </label>
          <button type="submit">History</button>
        </form>
        <div className="footprint-page-status" aria-live="polite">
          {statusText}
        </div>
      </header>
      <main ref={canvasHostRef} className="footprint-page-canvas-shell">
        <FootprintCanvas
          bars={bars}
          viewport={viewport}
          settings={DEFAULT_FOOTPRINT_SETTINGS}
          displayCount={barCount}
          layout="standalone"
        />
      </main>
    </div>
  );
}

function mapFromBars(bars: readonly FootprintBar[]): Map<number, FootprintBar> {
  return new Map(bars.map((bar) => [bar.time, bar]));
}

function estimateStandaloneCanvasHeight(bars: readonly FootprintBar[]): number {
  if (bars.length === 0) return MIN_CANVAS_HEIGHT_PX;
  const prices = bars
    .flatMap((bar) => [
      bar.open,
      bar.high,
      bar.low,
      bar.close,
      bar.poc,
      ...bar.rows.map((row) => row.price),
    ])
    .filter(isFiniteNumber);
  if (prices.length === 0) return MIN_CANVAS_HEIGHT_PX;

  const priceStep = inferPriceStep(bars);
  let minPrice = Math.min(...prices);
  let maxPrice = Math.max(...prices);
  if (minPrice >= maxPrice) {
    minPrice -= 20 * priceStep;
    maxPrice += 20 * priceStep;
  }
  minPrice -= 5 * priceStep;
  maxPrice += 5 * priceStep;
  const levels = Math.max(10, Math.ceil((maxPrice - minPrice) / priceStep) + 1);
  return levels * STANDALONE_ROW_HEIGHT_PX + 80;
}

function inferPriceStep(bars: readonly FootprintBar[]): number {
  const prices = Array.from(
    new Set(bars.flatMap((bar) => bar.rows.map((row) => row.price))),
  ).sort((a, b) => a - b);
  const diffs: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) diffs.push(diff);
  }
  return diffs.length > 0 ? Math.max(0.000001, Math.min(...diffs)) : 0.1;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function trimBarsMap(
  bars: ReadonlyMap<number, FootprintBar>,
  count: number,
): Map<number, FootprintBar> {
  return mapFromBars(selectDisplayBars(bars, count));
}

function clampInteger(
  value: string,
  min: number,
  max: number,
  fallback: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Request failed";
}

function statusFor(input: {
  mode: PageMode;
  loading: boolean;
  error: string | null;
  connection: "connected" | "disconnected";
  visibleCount: number;
  historyMeta: { at: number; context: number; targetFound: boolean } | null;
}): string {
  if (input.loading) return "Loading";
  if (input.error) return input.error;
  if (input.mode === "history" && input.historyMeta) {
    const state = input.historyMeta.targetFound ? "found" : "nearest";
    return `${formatTime(input.historyMeta.at)} ${state} - ${input.visibleCount} bars`;
  }
  return `${input.visibleCount} bars - ${input.connection}`;
}

function formatTime(time: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(time));
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
