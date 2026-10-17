import {
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { ApiClient } from "../api/client";
import {
  DEFAULT_FOOTPRINT_SETTINGS,
  type FootprintSettings,
} from "../chart/IndicatorToggles";
import {
  DEFAULT_XKONTROL_DISPLAY_SETTINGS,
  XKONTROL_HISTORY_BARS,
  type XKontrolDisplaySettings,
} from "../chart/xKontrol";
import {
  BarReplayControls,
  type BarReplayPhase,
} from "../chart/BarReplayControls";
import {
  barReplayDelayMs,
  replayCursorBeforeSelection,
  type BarReplaySpeed,
} from "../chart/barReplay";
import { resolveEndpoints } from "../endpoints";
import { ChartSocket } from "../socket/ChartSocket";
import type { ChartEventType } from "../socket/messages";
import { FootprintCanvas } from "./FootprintCanvas";
import {
  type FootprintBar,
  mergeFootprint,
  selectDisplayBars,
} from "./footprintModel";
import { footprintSessionStartMs, parseFootprintSearchTime } from "./timeSearch";

const SYMBOL = "GC";
const CHART_CONTRACT = SYMBOL;
const DEFAULT_LATEST_COUNT = 500;
const MIN_LATEST_COUNT = 10;
const MAX_LATEST_COUNT = 24 * 60;
const DEFAULT_HISTORY_CONTEXT = 3;
const MIN_HISTORY_CONTEXT = 3;
const MAX_HISTORY_CONTEXT = 500;
const FOOTPRINT_EVENTS: ChartEventType[] = ["footprint_update"];
const DEFAULT_BAR_WIDTH_PX = 64;
const MIN_BAR_WIDTH_PX = 18;
const MAX_BAR_WIDTH_PX = 180;
const MIN_CANVAS_HEIGHT_PX = 360;
const DEFAULT_ROW_HEIGHT_PX = 18;
const MIN_ROW_HEIGHT_PX = 5;
const MAX_ROW_HEIGHT_PX = 32;
const PRICE_AXIS_HIT_WIDTH_PX = 86;
const SCALE_DRAG_SENSITIVITY = 0.08;
const MAX_VIRTUAL_CANVAS_HEIGHT_PX = 50_000;
const MAX_CANVAS_WIDTH_PX = 32_000;
const STANDALONE_PLOT_LEFT_PX = 20;
const STANDALONE_PLOT_RIGHT_INSET_PX = 78;
const DEFAULT_PAGE_FOOTPRINT_SETTINGS: FootprintSettings = {
  ...DEFAULT_FOOTPRINT_SETTINGS,
  showVA: true,
  showOrderflowsGaps: true,
};
const identityPriceToY = (price: number) => price;

type PageMode = "latest" | "history";
type FootprintNumberSettingKey =
  | "vaPercent"
  | "absorptionPercent"
  | "absorptionDepth"
  | "absorptionFilter";
interface ChartPointerState {
  pointerId: number;
  clientX: number;
  clientY: number;
}

type ChartDragState =
  | {
    mode: "pan";
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  }
  | {
    mode: "scale";
    pointerId: number;
    startY: number;
    rowHeightPx: number;
  }
  | {
    mode: "pinch";
    pointerIds: [number, number];
    startDistanceX: number;
    startDistanceY: number;
    originX: number;
    originY: number;
    scrollLeft: number;
    scrollTop: number;
    rowHeightPx: number;
    barWidthPx: number;
    canvasWidth: number;
    canvasHeight: number;
  };

export function FootprintPage() {
  const endpoints = useMemo(() => resolveEndpoints(), []);
  const api = useMemo(() => new ApiClient({ basePath: endpoints.api }), [endpoints.api]);
  const socket = useMemo(() => new ChartSocket({ url: endpoints.ws }), [endpoints.ws]);
  const requestSeq = useRef(0);
  const loadedSessionStartRef = useRef<number | null>(null);
  const dragStateRef = useRef<ChartDragState | null>(null);
  const activePointersRef = useRef<Map<number, ChartPointerState>>(new Map());
  const canvasShellRef = useRef<HTMLElement | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);
  const pendingLatestScrollRef = useRef(false);
  const pendingCenterTimeRef = useRef<number | null>(null);
  const [measureCanvasHostRef, canvasHostSize] = useElementSize();
  const canvasHostRef = useCallback(
    (node: HTMLElement | null) => {
      canvasShellRef.current = node;
      measureCanvasHostRef(node);
    },
    [measureCanvasHostRef],
  );

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
  const [isDraggingChart, setIsDraggingChart] = useState(false);
  const [isScalingPrice, setIsScalingPrice] = useState(false);
  const [isPinchingChart, setIsPinchingChart] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [replaySelecting, setReplaySelecting] = useState(false);
  const [replaySelectionError, setReplaySelectionError] = useState("");
  const [replaySelectionBars, setReplaySelectionBars] = useState<
    readonly FootprintBar[]
  >([]);
  const [replayDataset, setReplayDataset] = useState<
    readonly FootprintBar[] | undefined
  >();
  const [replayCursorIndex, setReplayCursorIndex] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState<BarReplaySpeed>(1);
  const [centerRequestNonce, setCenterRequestNonce] = useState(0);
  const [barWidthPx, setBarWidthPx] = useState(DEFAULT_BAR_WIDTH_PX);
  const [rowHeightPx, setRowHeightPx] = useState(DEFAULT_ROW_HEIGHT_PX);
  const [footprintSettings, setFootprintSettings] = useState<FootprintSettings>(
    () => ({ ...DEFAULT_PAGE_FOOTPRINT_SETTINGS }),
  );
  const [showXKontrol, setShowXKontrol] = useState(true);
  const [xKontrolSettings, setXKontrolSettings] =
    useState<XKontrolDisplaySettings>(() => ({
      ...DEFAULT_XKONTROL_DISPLAY_SETTINGS,
    }));
  const [vaPercentInput, setVaPercentInput] = useState(
    String(DEFAULT_PAGE_FOOTPRINT_SETTINGS.vaPercent),
  );
  const [absorptionPercentInput, setAbsorptionPercentInput] = useState(
    String(DEFAULT_PAGE_FOOTPRINT_SETTINGS.absorptionPercent),
  );
  const [absorptionDepthInput, setAbsorptionDepthInput] = useState(
    String(DEFAULT_PAGE_FOOTPRINT_SETTINGS.absorptionDepth),
  );
  const [absorptionFilterInput, setAbsorptionFilterInput] = useState(
    String(DEFAULT_PAGE_FOOTPRINT_SETTINGS.absorptionFilter),
  );
  const [scrollView, setScrollView] = useState({ left: 0, top: 0 });
  const [historyMeta, setHistoryMeta] = useState<{
    at: number;
    context: number;
    targetFound: boolean;
  } | null>(null);

  useEffect(() => {
    if (!isSettingsOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!settingsMenuRef.current?.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSettingsOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isSettingsOpen]);

  const loadLatest = useCallback(
    async () => {
      const seq = ++requestSeq.current;
      const sessionStart = footprintSessionStartMs();
      setLoading(true);
      setError(null);
      setHistoryMeta(null);
      try {
        const result = await api.footprintDetails(SYMBOL, CHART_CONTRACT, {
          from: sessionStart,
        });
        if (seq !== requestSeq.current) return;
        loadedSessionStartRef.current = sessionStart;
        pendingLatestScrollRef.current = true;
        pendingCenterTimeRef.current = null;
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
        pendingLatestScrollRef.current = false;
        pendingCenterTimeRef.current = at;
        setMode("history");
        setHistoryMeta({
          at,
          context,
          targetFound: result.targetFound ?? false,
        });
        setBars(mapFromBars(result.bars));
        setCenterRequestNonce((nonce) => nonce + 1);
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
    void loadLatest();
  }, [loadLatest]);

  useEffect(() => {
    if (mode !== "latest") return;
    const timer = window.setInterval(() => {
      if (loadedSessionStartRef.current !== footprintSessionStartMs()) {
        void loadLatest();
      }
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [loadLatest, mode]);

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
        trimBarsMap(
          mergeFootprint(prev, msg),
          Math.max(1, barCount, XKONTROL_HISTORY_BARS),
        ),
      );
    });
    return () => {
      offFootprint();
      socket.unsubscribe(SYMBOL, FOOTPRINT_EVENTS, "1m");
    };
  }, [barCount, mode, socket]);

  const liveVisibleBars = useMemo(
    () => selectDisplayBars(bars, barCount),
    [bars, barCount],
  );
  const replayActive = replayDataset !== undefined;
  const replayPhase: BarReplayPhase = replayActive
    ? "active"
    : replaySelecting
      ? "selecting"
      : "idle";
  const replaySourceBars = replayActive
    ? replayDataset
    : replaySelecting
      ? replaySelectionBars
      : liveVisibleBars;
  const visibleBars = useMemo(
    () =>
      replayDataset === undefined
        ? replaySourceBars
        : replayDataset.slice(0, replayCursorIndex + 1),
    [replayCursorIndex, replayDataset, replaySourceBars],
  );
  const renderBars = useMemo(
    () =>
      replayActive || replaySelecting ? mapFromBars(visibleBars) : bars,
    [bars, replayActive, replaySelecting, visibleBars],
  );
  const displayBarCount = Math.max(1, replaySourceBars.length);
  const canvasWidth = canvasWidthForBarWidth(
    displayBarCount,
    canvasHostSize.width,
    barWidthPx,
  );
  const canvasHeight = canvasHeightForFootprint({
    bars: visibleBars,
    displayBarCount,
    canvasWidth,
    hostHeight: canvasHostSize.height,
    rowHeightPx,
  });
  const viewport = useMemo(
    () => ({
      priceToY: identityPriceToY,
      width: canvasWidth,
      height: canvasHeight,
      textColor: "#000000",
    }),
    [canvasHeight, canvasWidth],
  );
  const updateScrollView = useCallback((element: HTMLElement) => {
    setScrollView({ left: element.scrollLeft, top: element.scrollTop });
  }, []);
  useLayoutEffect(() => {
    if (!pendingLatestScrollRef.current || mode !== "latest" || visibleBars.length === 0) {
      return;
    }
    const element = canvasShellRef.current;
    if (!element) return;
    const frame = window.requestAnimationFrame(() => {
      scrollLatestBarIntoView(element, {
        bars: visibleBars,
        barCount: displayBarCount,
        rowHeightPx,
        canvasWidth,
        canvasHeight,
      });
      updateScrollView(element);
      pendingLatestScrollRef.current = false;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    canvasHeight,
    canvasWidth,
    displayBarCount,
    mode,
    rowHeightPx,
    updateScrollView,
    visibleBars,
  ]);
  useLayoutEffect(() => {
    const targetTime = pendingCenterTimeRef.current;
    if (targetTime === null || visibleBars.length === 0) return;
    const element = canvasShellRef.current;
    if (!element) return;
    const frame = window.requestAnimationFrame(() => {
      centerFootprintBarInView(element, {
        bars: visibleBars,
        barCount: displayBarCount,
        targetTime,
        rowHeightPx,
        canvasWidth,
        canvasHeight,
      });
      updateScrollView(element);
      pendingCenterTimeRef.current = null;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    canvasHeight,
    canvasWidth,
    centerRequestNonce,
    displayBarCount,
    rowHeightPx,
    updateScrollView,
    visibleBars,
  ]);
  const liveStatusText = statusFor({
    mode,
    loading,
    error,
    connection,
    visibleCount: visibleBars.length,
    historyMeta,
    rowHeightPx,
  });
  const statusText = replayActive
    ? `Replay ${replayCursorIndex + 1}/${replayDataset.length} - ${liveStatusText}`
    : replaySelecting
      ? `Select replay start - ${liveStatusText}`
      : liveStatusText;

  const exitBarReplay = useCallback(() => {
    setReplaySelecting(false);
    setReplaySelectionError("");
    setReplaySelectionBars([]);
    setReplayPlaying(false);
    setReplayDataset(undefined);
    pendingLatestScrollRef.current = mode === "latest";
  }, [mode]);

  const beginBarReplaySelection = useCallback(() => {
    if (liveVisibleBars.length < 3) return;
    setReplayDataset(undefined);
    setReplayPlaying(false);
    setReplaySelectionError("");
    setReplaySelectionBars(liveVisibleBars.slice());
    setReplaySelecting(true);
    setIsSettingsOpen(false);
  }, [liveVisibleBars]);

  const cancelBarReplaySelection = useCallback(() => {
    setReplaySelecting(false);
    setReplaySelectionError("");
    setReplaySelectionBars([]);
  }, []);

  const selectBarReplayStart = useCallback(
    (event: Pick<ReactPointerEvent<HTMLElement>, "clientX" | "currentTarget">) => {
      if (!replaySelecting) return;
      const target = event.currentTarget;
      const selectedIndex = footprintBarIndexAtCanvasX({
        clientX: event.clientX,
        rectLeft: target.getBoundingClientRect().left,
        scrollLeft: target.scrollLeft,
        canvasWidth,
        barCount: replaySelectionBars.length,
      });
      if (selectedIndex < 0) {
        setReplaySelectionError("Click inside a footprint bar");
        return;
      }
      if (selectedIndex <= 0) {
        setReplaySelectionError("Choose a bar after the first loaded bar");
        return;
      }
      if (selectedIndex >= replaySelectionBars.length - 1) {
        setReplaySelectionError("Choose an earlier bar so replay has future bars");
        return;
      }

      setReplayDataset(replaySelectionBars.slice());
      setReplayCursorIndex(replayCursorBeforeSelection(selectedIndex));
      setReplayPlaying(false);
      setReplaySelecting(false);
      setReplaySelectionError("");
    },
    [canvasWidth, replaySelecting, replaySelectionBars],
  );

  const stepBarReplay = useCallback(
    (direction: -1 | 1) => {
      setReplayPlaying(false);
      setReplayCursorIndex((current) => {
        const last = Math.max(0, (replayDataset?.length ?? 1) - 1);
        return Math.min(last, Math.max(0, current + direction));
      });
    },
    [replayDataset],
  );

  useEffect(() => {
    if (!replayActive || !replayPlaying || replayDataset === undefined) return;
    if (replayCursorIndex >= replayDataset.length - 1) {
      setReplayPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setReplayCursorIndex((current) =>
        Math.min(current + 1, replayDataset.length - 1),
      );
    }, barReplayDelayMs(replaySpeed));
    return () => window.clearTimeout(timer);
  }, [
    replayActive,
    replayCursorIndex,
    replayDataset,
    replayPlaying,
    replaySpeed,
  ]);

  useEffect(() => {
    if (!replayActive && !replaySelecting) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, select, textarea, button, [contenteditable='true']")) {
        return;
      }
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

  useLayoutEffect(() => {
    if (!replayActive || visibleBars.length === 0) return;
    const element = canvasShellRef.current;
    if (!element) return;
    const frame = window.requestAnimationFrame(() => {
      scrollReplayBarIntoView(element, {
        bars: visibleBars,
        barCount: displayBarCount,
        barIndex: replayCursorIndex,
        rowHeightPx,
        canvasWidth,
        canvasHeight,
      });
      updateScrollView(element);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    canvasHeight,
    canvasWidth,
    displayBarCount,
    replayActive,
    replayCursorIndex,
    rowHeightPx,
    updateScrollView,
    visibleBars,
  ]);

  const submitLatest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    exitBarReplay();
    const nextCount = clampInteger(
      barCountInput,
      MIN_LATEST_COUNT,
      MAX_LATEST_COUNT,
      DEFAULT_LATEST_COUNT,
    );
    setBarCount(nextCount);
    setBarCountInput(String(nextCount));
    void loadLatest();
  };

  const submitHistory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const at = parseFootprintSearchTime(searchInput);
    if (at === null) {
      setError("Invalid time");
      return;
    }
    exitBarReplay();
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

  const startChartDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (replaySelecting) {
      selectBarReplayStart(event);
      event.preventDefault();
      return;
    }
    const target = event.currentTarget;
    activePointersRef.current.set(event.pointerId, {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    });
    target.setPointerCapture(event.pointerId);

    if (startPinchGesture(target)) {
      event.preventDefault();
      return;
    }

    if (isPointerOnPriceAxis(event, target)) {
      dragStateRef.current = {
        mode: "scale",
        pointerId: event.pointerId,
        startY: event.clientY,
        rowHeightPx,
      };
      setIsScalingPrice(true);
    } else {
      dragStateRef.current = {
        mode: "pan",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        scrollLeft: target.scrollLeft,
        scrollTop: target.scrollTop,
      };
      setIsDraggingChart(true);
    }
    event.preventDefault();
  };

  const moveChartDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const pointer = activePointersRef.current.get(event.pointerId);
    if (pointer) {
      pointer.clientX = event.clientX;
      pointer.clientY = event.clientY;
    }

    const drag = dragStateRef.current;
    if (!drag) return;
    const target = event.currentTarget;
    if (drag.mode === "pinch") {
      const first = activePointersRef.current.get(drag.pointerIds[0]);
      const second = activePointersRef.current.get(drag.pointerIds[1]);
      if (!first || !second) return;
      const distances = pinchDistances(first, second);
      const nextBarWidth = clampBarWidth(
        drag.barWidthPx * pinchScaleRatio(drag.startDistanceX, distances.x),
      );
      const nextRowHeight = clampRowHeight(
        drag.rowHeightPx * pinchScaleRatio(drag.startDistanceY, distances.y),
      );
      const nextCanvasWidth = canvasWidthForBarWidth(
        displayBarCount,
        canvasHostSize.width,
        nextBarWidth,
      );
      const nextCanvasHeight = canvasHeightForFootprint({
        bars: visibleBars,
        displayBarCount,
        canvasWidth: nextCanvasWidth,
        hostHeight: canvasHostSize.height,
        rowHeightPx: nextRowHeight,
      });
      const nextScrollLeft =
        ((drag.scrollLeft + drag.originX) / Math.max(1, drag.canvasWidth)) *
          nextCanvasWidth -
        drag.originX;
      const nextScrollTop =
        ((drag.scrollTop + drag.originY) / Math.max(1, drag.canvasHeight)) *
          nextCanvasHeight -
        drag.originY;

      setBarWidthPx(nextBarWidth);
      setRowHeightPx(nextRowHeight);
      scrollElementAfterRender(target, nextScrollLeft, nextScrollTop, updateScrollView);
      event.preventDefault();
      return;
    }

    if (drag.pointerId !== event.pointerId) return;
    if (drag.mode === "scale") {
      const deltaY = event.clientY - drag.startY;
      setRowHeightPx(
        clampRowHeight(drag.rowHeightPx - deltaY * SCALE_DRAG_SENSITIVITY),
      );
    } else {
      target.scrollLeft = drag.scrollLeft - (event.clientX - drag.startX);
      target.scrollTop = drag.scrollTop - (event.clientY - drag.startY);
      updateScrollView(target);
    }
    event.preventDefault();
  };

  const stopChartDrag = (event: ReactPointerEvent<HTMLElement>) => {
    activePointersRef.current.delete(event.pointerId);
    const drag = dragStateRef.current;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!drag) return;
    if (drag.mode === "pinch") {
      if (drag.pointerIds.includes(event.pointerId)) {
        dragStateRef.current = null;
        setIsPinchingChart(false);
        setIsDraggingChart(false);
        setIsScalingPrice(false);
      }
      return;
    }
    if (drag.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    setIsDraggingChart(false);
    setIsScalingPrice(false);
  };

  const startPinchGesture = (target: HTMLElement): boolean => {
    const pointers = Array.from(activePointersRef.current.values());
    if (pointers.length < 2) return false;
    const [first, second] = pointers.slice(-2);
    const rect = target.getBoundingClientRect();
    const distances = pinchDistances(first, second);
    dragStateRef.current = {
      mode: "pinch",
      pointerIds: [first.pointerId, second.pointerId],
      startDistanceX: distances.x,
      startDistanceY: distances.y,
      originX: (first.clientX + second.clientX) / 2 - rect.left,
      originY: (first.clientY + second.clientY) / 2 - rect.top,
      scrollLeft: target.scrollLeft,
      scrollTop: target.scrollTop,
      rowHeightPx,
      barWidthPx,
      canvasWidth,
      canvasHeight,
    };
    setIsPinchingChart(true);
    setIsDraggingChart(false);
    setIsScalingPrice(false);
    return true;
  };

  const resetPriceScale = (event: ReactMouseEvent<HTMLElement>) => {
    if (!isPointerOnPriceAxis(event, event.currentTarget)) return;
    const targetTime = replayActive
      ? visibleBars[visibleBars.length - 1]?.time
      : mode === "history" && historyMeta
        ? historyMeta.at
        : visibleBars[visibleBars.length - 1]?.time;
    if (targetTime !== undefined) {
      pendingCenterTimeRef.current = targetTime;
      setCenterRequestNonce((nonce) => nonce + 1);
    }
    setRowHeightPx(DEFAULT_ROW_HEIGHT_PX);
  };

  const commitFootprintNumberSetting = (
    key: FootprintNumberSettingKey,
    value: string,
    setValue: (next: string) => void,
    min: number,
    max: number,
  ) => {
    const next = clampInteger(value, min, max, footprintSettings[key]);
    setValue(String(next));
    setFootprintSettings((prev) => ({ ...prev, [key]: next }));
  };

  return (
    <div className="footprint-page">
      <header className="footprint-page-toolbar">
        <a className="footprint-page-back" href="/">
          Chart
        </a>
        <a className="footprint-page-back" href="/mp">
          MP
        </a>
        <a className="footprint-page-back" href="/lq">
          LQ
        </a>
        <div className="footprint-page-title">
          <span>GC Footprint</span>
          <span>{mode === "latest" ? "From 05:00 UTC+7" : "History"}</span>
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
        <button
          type="button"
          className={`footprint-page-replay-button${
            replayPhase !== "idle" ? " is-active" : ""
          }`}
          title={
            replayActive
              ? "Exit Bar Replay and return to live footprint"
              : replaySelecting
                ? "Cancel replay selection"
                : "Bar Replay"
          }
          aria-label={replayActive ? "Exit Bar Replay" : "Bar Replay"}
          aria-pressed={replayPhase !== "idle"}
          disabled={liveVisibleBars.length < 3 && replayPhase === "idle"}
          onClick={() => {
            if (replayActive) exitBarReplay();
            else if (replaySelecting) cancelBarReplaySelection();
            else beginBarReplaySelection();
          }}
        >
          <svg
            width="18"
            height="18"
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
          Replay
        </button>
        <div className="footprint-page-settings" ref={settingsMenuRef}>
          <button
            type="button"
            className="footprint-page-settings-button"
            aria-expanded={isSettingsOpen}
            aria-controls="footprint-display-settings"
            onClick={() => setIsSettingsOpen((open) => !open)}
          >
            Settings
            <span className="footprint-page-settings-chevron" aria-hidden="true" />
          </button>
          {isSettingsOpen ? (
            <form
              id="footprint-display-settings"
              className="footprint-page-form footprint-page-settings-panel"
              aria-label="Footprint display settings"
              onSubmit={(event) => event.preventDefault()}
            >
              <fieldset className="footprint-page-settings-group">
                <legend>Value Area</legend>
                <div className="footprint-page-settings-controls">
          <label className="footprint-page-toggle">
            <input
              type="checkbox"
              checked={footprintSettings.showVA}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setFootprintSettings((prev) => ({
                  ...prev,
                  showVA: checked,
                }));
              }}
            />
            VA
          </label>
          <label>
            VA %
            <input
              type="number"
              min={10}
              max={95}
              value={vaPercentInput}
              onChange={(event) => setVaPercentInput(event.currentTarget.value)}
              onBlur={() =>
                commitFootprintNumberSetting(
                  "vaPercent",
                  vaPercentInput,
                  setVaPercentInput,
                  10,
                  95,
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitFootprintNumberSetting(
                    "vaPercent",
                    vaPercentInput,
                    setVaPercentInput,
                    10,
                    95,
                  );
                  event.currentTarget.blur();
                }
              }}
            />
          </label>
                </div>
              </fieldset>
              <fieldset className="footprint-page-settings-group">
                <legend>Orderflow Gaps</legend>
                <div className="footprint-page-settings-controls">
          <label className="footprint-page-toggle">
            <input
              type="checkbox"
              aria-label="Orderflows Gaps on Footprint"
              checked={footprintSettings.showOrderflowsGaps}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setFootprintSettings((prev) => ({
                  ...prev,
                  showOrderflowsGaps: checked,
                }));
              }}
            />
            OF Gap
          </label>
          <label className="footprint-page-toggle">
            <input
              type="checkbox"
              aria-label="Orderflows Gaps swing filter"
              checked={footprintSettings.orderflowsGapsUseSwingFilter}
              disabled={!footprintSettings.showOrderflowsGaps}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setFootprintSettings((prev) => ({
                  ...prev,
                  orderflowsGapsUseSwingFilter: checked,
                }));
              }}
            />
            OFG Swing 5
          </label>
                </div>
              </fieldset>
              <fieldset className="footprint-page-settings-group footprint-page-settings-group-wide">
                <legend>Absorption</legend>
                <div className="footprint-page-settings-controls">
          <label className="footprint-page-toggle">
            <input
              type="checkbox"
              checked={footprintSettings.showAbsorption}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setFootprintSettings((prev) => ({
                  ...prev,
                  showAbsorption: checked,
                }));
              }}
            />
            Absorption
          </label>
          <label>
            Abs %
            <input
              type="number"
              min={0}
              max={500}
              value={absorptionPercentInput}
              onChange={(event) =>
                setAbsorptionPercentInput(event.currentTarget.value)
              }
              onBlur={() =>
                commitFootprintNumberSetting(
                  "absorptionPercent",
                  absorptionPercentInput,
                  setAbsorptionPercentInput,
                  0,
                  500,
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitFootprintNumberSetting(
                    "absorptionPercent",
                    absorptionPercentInput,
                    setAbsorptionPercentInput,
                    0,
                    500,
                  );
                  event.currentTarget.blur();
                }
              }}
            />
          </label>
          <label>
            Depth
            <input
              type="number"
              min={0}
              max={100}
              value={absorptionDepthInput}
              onChange={(event) =>
                setAbsorptionDepthInput(event.currentTarget.value)
              }
              onBlur={() =>
                commitFootprintNumberSetting(
                  "absorptionDepth",
                  absorptionDepthInput,
                  setAbsorptionDepthInput,
                  0,
                  100,
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitFootprintNumberSetting(
                    "absorptionDepth",
                    absorptionDepthInput,
                    setAbsorptionDepthInput,
                    0,
                    100,
                  );
                  event.currentTarget.blur();
                }
              }}
            />
          </label>
          <label>
            Filter
            <input
              type="number"
              min={0}
              max={100000}
              value={absorptionFilterInput}
              onChange={(event) =>
                setAbsorptionFilterInput(event.currentTarget.value)
              }
              onBlur={() =>
                commitFootprintNumberSetting(
                  "absorptionFilter",
                  absorptionFilterInput,
                  setAbsorptionFilterInput,
                  0,
                  100000,
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitFootprintNumberSetting(
                    "absorptionFilter",
                    absorptionFilterInput,
                    setAbsorptionFilterInput,
                    0,
                    100000,
                  );
                  event.currentTarget.blur();
                }
              }}
            />
          </label>
                </div>
              </fieldset>
              <fieldset className="footprint-page-settings-group footprint-page-settings-group-wide">
                <legend>XKontrol</legend>
                <div className="footprint-page-settings-controls">
          <label className="footprint-page-toggle">
            <input
              type="checkbox"
              aria-label="XKontrol on Footprint"
              checked={showXKontrol}
              onChange={(event) => setShowXKontrol(event.currentTarget.checked)}
            />
            XKontrol
          </label>
          <label className="footprint-page-toggle">
            <input
              type="checkbox"
              aria-label="XKontrol Level 1 Initial"
              checked={xKontrolSettings.showInitial}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setXKontrolSettings((prev) => ({
                  ...prev,
                  showInitial: checked,
                }));
              }}
            />
            XK L1
          </label>
          <label className="footprint-page-toggle">
            <input
              type="checkbox"
              aria-label="XKontrol Level 2 Strong"
              checked={xKontrolSettings.showStrong}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setXKontrolSettings((prev) => ({
                  ...prev,
                  showStrong: checked,
                }));
              }}
            />
            XK L2
          </label>
          <label className="footprint-page-toggle">
            <input
              type="checkbox"
              aria-label="XKontrol Level 3 Total"
              checked={xKontrolSettings.showTotal}
              onChange={(event) => {
                const checked = event.currentTarget.checked;
                setXKontrolSettings((prev) => ({
                  ...prev,
                  showTotal: checked,
                }));
              }}
            />
            XK L3
          </label>
                </div>
              </fieldset>
            </form>
          ) : null}
        </div>
        <div className="footprint-page-status" aria-live="polite">
          {statusText}
        </div>
      </header>
      <div className="footprint-page-chart-wrap">
        <main
          ref={canvasHostRef}
          className={`footprint-page-canvas-shell${isDraggingChart ? " is-dragging" : ""
            }${isScalingPrice ? " is-scaling-price" : ""}${isPinchingChart ? " is-pinching" : ""
            }${replaySelecting ? " is-replay-selecting" : ""}`}
          onPointerDown={startChartDrag}
          onPointerMove={moveChartDrag}
          onPointerUp={stopChartDrag}
          onPointerCancel={stopChartDrag}
          onDoubleClick={resetPriceScale}
          onScroll={(event) => updateScrollView(event.currentTarget)}
        >
          <div
            className="footprint-page-canvas-stage"
            style={{ width: canvasWidth, height: canvasHeight }}
          >
            <FootprintCanvas
              bars={renderBars}
              viewport={viewport}
              settings={footprintSettings}
              displayCount={displayBarCount}
              rowHeightPx={rowHeightPx}
              renderHeightPx={canvasHostSize.height}
              scrollTopPx={scrollView.top}
              layout="standalone"
              showXKontrol={showXKontrol}
              xKontrolSettings={xKontrolSettings}
            />
          </div>
        </main>
        <FootprintStickyAxes
          bars={visibleBars}
          barCount={displayBarCount}
          rowHeightPx={rowHeightPx}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          viewportWidth={canvasHostSize.width}
          viewportHeight={canvasHostSize.height}
          scrollLeft={scrollView.left}
          scrollTop={scrollView.top}
        />
        <BarReplayControls
          phase={replayPhase}
          playing={replayPlaying}
          speed={replaySpeed}
          currentBar={replayActive ? replayCursorIndex + 1 : 0}
          totalBars={replayDataset?.length ?? 0}
          selectionError={replaySelectionError}
          onCancelSelection={cancelBarReplaySelection}
          onTogglePlaying={() => {
            if (
              replayDataset !== undefined &&
              replayCursorIndex < replayDataset.length - 1
            ) {
              setReplayPlaying((playing) => !playing);
            }
          }}
          onStepBack={() => stepBarReplay(-1)}
          onStepForward={() => stepBarReplay(1)}
          onSpeedChange={setReplaySpeed}
          onExit={exitBarReplay}
        />
      </div>
    </div>
  );
}

function mapFromBars(bars: readonly FootprintBar[]): Map<number, FootprintBar> {
  return new Map(bars.map((bar) => [bar.time, bar]));
}

function canvasWidthForBarWidth(
  displayBarCount: number,
  hostWidth: number,
  barWidthPx: number,
): number {
  return Math.min(
    MAX_CANVAS_WIDTH_PX,
    Math.max(hostWidth, displayBarCount * barWidthPx + 20),
  );
}

export function footprintBarIndexAtCanvasX(input: {
  clientX: number;
  rectLeft: number;
  scrollLeft: number;
  canvasWidth: number;
  barCount: number;
}): number {
  if (input.barCount <= 0 || input.canvasWidth <= 0) return -1;
  const canvasX = input.clientX - input.rectLeft + input.scrollLeft;
  const plotRight = input.canvasWidth - STANDALONE_PLOT_RIGHT_INSET_PX;
  if (canvasX < STANDALONE_PLOT_LEFT_PX || canvasX >= plotRight) return -1;
  const barWidth =
    (plotRight - STANDALONE_PLOT_LEFT_PX) / input.barCount;
  if (!(barWidth > 0)) return -1;
  return Math.min(
    input.barCount - 1,
    Math.floor((canvasX - STANDALONE_PLOT_LEFT_PX) / barWidth),
  );
}

export function canvasHeightForFootprint(input: {
  bars: readonly FootprintBar[];
  displayBarCount: number;
  canvasWidth: number;
  hostHeight: number;
  rowHeightPx: number;
}): number {
  const minimumVisibleHeight = Math.min(
    MAX_VIRTUAL_CANVAS_HEIGHT_PX,
    Math.max(MIN_CANVAS_HEIGHT_PX, Math.round(input.hostHeight)),
  );
  // This is the virtual scroll height, not the backing bitmap height. Keeping
  // those separate lets wide datasets retain their full vertical price range
  // without allocating a width x full-height canvas.
  return Math.min(
    MAX_VIRTUAL_CANVAS_HEIGHT_PX,
    Math.max(
      minimumVisibleHeight,
      estimateStandaloneCanvasHeight(input.bars, input.rowHeightPx),
    ),
  );
}

function FootprintStickyAxes({
  bars,
  barCount,
  rowHeightPx,
  canvasWidth,
  canvasHeight,
  viewportWidth,
  viewportHeight,
  scrollLeft,
  scrollTop,
}: {
  bars: readonly FootprintBar[];
  barCount: number;
  rowHeightPx: number;
  canvasWidth: number;
  canvasHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  scrollLeft: number;
  scrollTop: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, viewportWidth, viewportHeight);
    if (bars.length === 0 || viewportWidth <= 0 || viewportHeight <= 0) return;

    const layout = computeStandaloneLayout({
      bars,
      barCount,
      rowHeightPx,
      canvasWidth,
      canvasHeight,
    });
    if (!layout) return;

    drawStickyPriceAxis(ctx, layout, {
      width: viewportWidth,
      height: viewportHeight,
      scrollTop,
    });
    drawStickyTimeAxis(ctx, bars, layout, {
      width: viewportWidth,
      height: viewportHeight,
      scrollLeft,
    });
  }, [
    barCount,
    bars,
    canvasHeight,
    canvasWidth,
    rowHeightPx,
    scrollLeft,
    scrollTop,
    viewportHeight,
    viewportWidth,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="footprint-page-axis-overlay"
      width={Math.max(1, viewportWidth)}
      height={Math.max(1, viewportHeight)}
      aria-hidden="true"
    />
  );
}

function estimateStandaloneCanvasHeight(
  bars: readonly FootprintBar[],
  rowHeightPx: number,
): number {
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
  return levels * rowHeightPx + 80;
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

function computeStandaloneLayout(input: {
  bars: readonly FootprintBar[];
  barCount: number;
  rowHeightPx: number;
  canvasWidth: number;
  canvasHeight: number;
}): {
  dataMinPrice: number;
  dataMaxPrice: number;
  priceStep: number;
  rowH: number;
  contentTop: number;
  contentBottom: number;
  plotLeft: number;
  plotRight: number;
  barW: number;
  yForPrice: (price: number) => number;
} | null {
  const prices = input.bars
    .flatMap((bar) => [
      bar.open,
      bar.high,
      bar.low,
      bar.close,
      bar.poc,
      ...bar.rows.map((row) => row.price),
    ])
    .filter(isFiniteNumber);
  if (prices.length === 0) return null;

  const priceStep = inferPriceStep(input.bars);
  let dataMinPrice = Math.min(...prices);
  let dataMaxPrice = Math.max(...prices);
  if (dataMinPrice >= dataMaxPrice) {
    dataMinPrice -= 20 * priceStep;
    dataMaxPrice += 20 * priceStep;
  }
  dataMinPrice -= 5 * priceStep;
  dataMaxPrice += 5 * priceStep;

  const panelY = 20;
  const panelH = Math.max(40, input.canvasHeight - 40);
  const panelBottom = panelY + panelH;
  const contentTop = panelY + 25;
  const contentBottom = panelBottom - 34;
  const contentHeight = contentBottom - contentTop;
  if (contentHeight <= 0) return null;

  const priceRange = Math.max(priceStep, dataMaxPrice - dataMinPrice);
  const rowH = Math.max(1, Math.min(32, input.rowHeightPx));
  const visibleRange = Math.max(priceRange, (contentHeight / rowH) * priceStep);
  const viewportTopPrice =
    dataMaxPrice + Math.max(0, visibleRange - priceRange) / 2;
  const plotLeft = STANDALONE_PLOT_LEFT_PX;
  const plotRight = input.canvasWidth - STANDALONE_PLOT_RIGHT_INSET_PX;
  const plotW = Math.max(20, plotRight - plotLeft);
  const barW = plotW / Math.max(1, input.barCount);
  return {
    dataMinPrice,
    dataMaxPrice,
    priceStep,
    rowH,
    contentTop,
    contentBottom,
    plotLeft,
    plotRight,
    barW,
    yForPrice: (price: number) =>
      contentTop + ((viewportTopPrice - price) / priceStep) * rowH,
  };
}

function scrollLatestBarIntoView(
  element: HTMLElement,
  input: {
    bars: readonly FootprintBar[];
    barCount: number;
    rowHeightPx: number;
    canvasWidth: number;
    canvasHeight: number;
  },
): void {
  const maxLeft = Math.max(0, element.scrollWidth - element.clientWidth);
  element.scrollLeft = maxLeft;

  const latest = input.bars[input.bars.length - 1];
  const layout = computeStandaloneLayout(input);
  if (!latest || !layout) return;

  const targetPrice = isFiniteNumber(latest.close)
    ? latest.close
    : isFiniteNumber(latest.poc)
      ? latest.poc
      : null;
  if (targetPrice === null) return;

  const maxTop = Math.max(0, element.scrollHeight - element.clientHeight);
  element.scrollTop = clampScroll(
    layout.yForPrice(targetPrice) - element.clientHeight / 2,
    maxTop,
  );
}

export function centerFootprintBarInView(
  element: HTMLElement,
  input: {
    bars: readonly FootprintBar[];
    barCount: number;
    targetTime: number;
    rowHeightPx: number;
    canvasWidth: number;
    canvasHeight: number;
  },
): void {
  const targetIndex = nearestFootprintBarIndex(input.bars, input.targetTime);
  const target = input.bars[targetIndex];
  const layout = computeStandaloneLayout(input);
  if (!target || !layout) return;

  const targetX =
    layout.plotLeft + layout.barW * targetIndex + layout.barW / 2;
  const usableViewportWidth = Math.max(
    1,
    element.clientWidth - PRICE_AXIS_HIT_WIDTH_PX,
  );
  element.scrollLeft = clampScroll(
    targetX - usableViewportWidth / 2,
    Math.max(0, element.scrollWidth - element.clientWidth),
  );

  const targetPrice = isFiniteNumber(target.close)
    ? target.close
    : isFiniteNumber(target.poc)
      ? target.poc
      : null;
  if (targetPrice === null) return;
  element.scrollTop = clampScroll(
    layout.yForPrice(targetPrice) - element.clientHeight / 2,
    Math.max(0, element.scrollHeight - element.clientHeight),
  );
}

function nearestFootprintBarIndex(
  bars: readonly FootprintBar[],
  targetTime: number,
): number {
  if (bars.length === 0) return -1;
  let low = 0;
  let high = bars.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (bars[middle].time < targetTime) low = middle + 1;
    else high = middle;
  }
  if (low === 0) return 0;
  if (low === bars.length) return bars.length - 1;
  return targetTime - bars[low - 1].time <= bars[low].time - targetTime
    ? low - 1
    : low;
}

function scrollReplayBarIntoView(
  element: HTMLElement,
  input: {
    bars: readonly FootprintBar[];
    barCount: number;
    barIndex: number;
    rowHeightPx: number;
    canvasWidth: number;
    canvasHeight: number;
  },
): void {
  const current = input.bars[input.bars.length - 1];
  const layout = computeStandaloneLayout(input);
  if (!current || !layout) return;

  const barX =
    layout.plotLeft + layout.barW * input.barIndex + layout.barW / 2;
  const viewportX = barX - element.scrollLeft;
  const leftMargin = 48;
  const rightMargin = Math.max(
    leftMargin,
    element.clientWidth - PRICE_AXIS_HIT_WIDTH_PX - 48,
  );
  let nextLeft = element.scrollLeft;
  if (viewportX < leftMargin) {
    nextLeft = barX - leftMargin;
  } else if (viewportX > rightMargin) {
    nextLeft = barX - rightMargin;
  }
  element.scrollLeft = clampScroll(
    nextLeft,
    Math.max(0, element.scrollWidth - element.clientWidth),
  );

  const targetPrice = isFiniteNumber(current.close)
    ? current.close
    : isFiniteNumber(current.poc)
      ? current.poc
      : null;
  if (targetPrice === null) return;
  const priceY = layout.yForPrice(targetPrice);
  const viewportY = priceY - element.scrollTop;
  const topMargin = 48;
  const bottomMargin = Math.max(topMargin, element.clientHeight - 70);
  let nextTop = element.scrollTop;
  if (viewportY < topMargin) {
    nextTop = priceY - topMargin;
  } else if (viewportY > bottomMargin) {
    nextTop = priceY - bottomMargin;
  }
  element.scrollTop = clampScroll(
    nextTop,
    Math.max(0, element.scrollHeight - element.clientHeight),
  );
}

function clampScroll(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, value));
}

function drawStickyPriceAxis(
  ctx: CanvasRenderingContext2D,
  layout: NonNullable<ReturnType<typeof computeStandaloneLayout>>,
  viewport: { width: number; height: number; scrollTop: number },
): void {
  const axisW = 64;
  const axisX = Math.max(0, viewport.width - axisW);
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  ctx.fillRect(axisX, 0, axisW, viewport.height);

  ctx.strokeStyle = "#737373";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(axisX, 0);
  ctx.lineTo(axisX, viewport.height);
  ctx.stroke();

  const labelEvery = Math.max(1, Math.ceil(24 / Math.max(1, layout.rowH)));
  const minTick = Math.floor(layout.dataMinPrice / layout.priceStep);
  const maxTick = Math.ceil(layout.dataMaxPrice / layout.priceStep);
  ctx.font = "11px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#666666";
  for (let tick = minTick; tick <= maxTick; tick++) {
    if ((tick - minTick) % labelEvery !== 0 && tick !== maxTick) continue;
    const price = roundPrice(tick * layout.priceStep);
    const y = layout.yForPrice(price) - viewport.scrollTop;
    if (y < -16 || y > viewport.height + 16) continue;
    ctx.fillText(formatAxisPrice(price, layout.priceStep), axisX + 6, y);
  }
}

function drawStickyTimeAxis(
  ctx: CanvasRenderingContext2D,
  bars: readonly FootprintBar[],
  layout: NonNullable<ReturnType<typeof computeStandaloneLayout>>,
  viewport: { width: number; height: number; scrollLeft: number },
): void {
  const axisH = 34;
  const axisY = Math.max(0, viewport.height - axisH);
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  ctx.fillRect(0, axisY, viewport.width, axisH);

  ctx.strokeStyle = "#737373";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, axisY + 6);
  ctx.lineTo(viewport.width, axisY + 6);
  ctx.stroke();

  const every = Math.max(1, Math.ceil(58 / Math.max(1, layout.barW)));
  ctx.fillStyle = "#666666";
  ctx.font = "11px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  bars.forEach((bar, index) => {
    if (index !== 0 && index !== bars.length - 1 && index % every !== 0) {
      return;
    }
    const x = layout.plotLeft + layout.barW * index + layout.barW / 2 - viewport.scrollLeft;
    if (x < -40 || x > viewport.width + 40) return;
    ctx.fillText(formatAxisTime(bar.time), x, axisY + 11);
  });
}

function roundPrice(price: number): number {
  return Math.round(price * 1e10) / 1e10;
}

function formatAxisPrice(price: number, priceStep: number): string {
  const decimals =
    priceStep < 1
      ? Math.min(4, Math.max(1, Math.ceil(Math.abs(Math.log10(priceStep)))))
      : 0;
  return price.toFixed(decimals);
}

function formatAxisTime(time: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(time));
}

export function isPointerOnPriceAxis(
  event: Pick<ReactPointerEvent<HTMLElement>, "clientX"> | Pick<ReactMouseEvent<HTMLElement>, "clientX">,
  element: HTMLElement,
): boolean {
  const rect = element.getBoundingClientRect();
  const viewportX = event.clientX - rect.left;
  return viewportX >= element.clientWidth - PRICE_AXIS_HIT_WIDTH_PX;
}

function pinchDistances(
  first: ChartPointerState,
  second: ChartPointerState,
): { x: number; y: number } {
  return {
    x: Math.abs(second.clientX - first.clientX),
    y: Math.abs(second.clientY - first.clientY),
  };
}

function pinchScaleRatio(startDistance: number, currentDistance: number): number {
  if (!Number.isFinite(startDistance) || !Number.isFinite(currentDistance)) return 1;
  if (startDistance < 24 || currentDistance < 1) return 1;
  return Math.min(2.85, Math.max(0.35, currentDistance / startDistance));
}

function scrollElementAfterRender(
  element: HTMLElement,
  left: number,
  top: number,
  updateScrollView: (element: HTMLElement) => void,
): void {
  const apply = () => {
    element.scrollLeft = clampScroll(left, Math.max(0, element.scrollWidth - element.clientWidth));
    element.scrollTop = clampScroll(top, Math.max(0, element.scrollHeight - element.clientHeight));
    updateScrollView(element);
  };
  apply();
  window.requestAnimationFrame(apply);
}

function clampBarWidth(value: number): number {
  const clamped = Math.min(MAX_BAR_WIDTH_PX, Math.max(MIN_BAR_WIDTH_PX, value));
  return Math.round(clamped * 4) / 4;
}

function clampRowHeight(value: number): number {
  const clamped = Math.min(MAX_ROW_HEIGHT_PX, Math.max(MIN_ROW_HEIGHT_PX, value));
  return Math.round(clamped * 4) / 4;
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
  rowHeightPx: number;
}): string {
  if (input.loading) return "Loading";
  if (input.error) return input.error;
  const scale = `scale ${input.rowHeightPx.toFixed(0)}px`;
  if (input.mode === "history" && input.historyMeta) {
    const state = input.historyMeta.targetFound ? "found" : "nearest";
    return `${formatTime(input.historyMeta.at)} ${state} - ${input.visibleCount} bars - ${scale}`;
  }
  return `${input.visibleCount} bars - ${input.connection} - ${scale}`;
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
  (node: HTMLElement | null) => void,
  { width: number; height: number },
] {
  const nodeRef = useRef<HTMLElement | null>(null);
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
    (node: HTMLElement | null) => {
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
