import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type ChartPortFactory,
  type DisposableChartPort,
  type VolumeDeltaDatum,
  type AlertLine,
  type EmaLineData,
  type OrderLine,
  type PriceLineSelection,
  type SmcAiSignalMarker,
  type SmcOverlay,
  type OutsideBarSettings,
  DEFAULT_OUTSIDE_BAR_SETTINGS,
  DEFAULT_BIG_TRADE_SETTINGS,
  ChartContainer,
  filterBigTradeMarkers,
} from "./index";
import { type BigTradeMarker } from "./indicatorReducer";
import { DEFAULT_SMC_SETTINGS } from "./smc";
import type { BarSeries } from "./index";
import { type Bar } from "../cache/types";
import { ChartSocket, SocketReadyState, type WebSocketLike } from "../socket";
import type {
  BarUpdateMessage,
  FvgSignalUpdateMessage,
  VolumeDeltaUpdateMessage,
} from "../socket/messages";

afterEach(() => {
  cleanup();
});

function bar(time: number, close = time, volume = 1): Bar {
  return { time, open: close, high: close, low: close, close, volume };
}

function ohlc(
  time: number,
  open: number,
  high: number,
  low: number,
  close: number,
): Bar {
  return { time, open, high, low, close, volume: 1 };
}

/** A fake disposable port capturing render calls + dispose. */
class FakePort implements DisposableChartPort {
  setBarsCalls: BarSeries[] = [];
  updateBarCalls: Bar[] = [];
  displayTimeOffsetCalls: number[] = [];
  timezoneOffsetCalls: number[] = [];
  barCountdownDurationCalls: number[] = [];
  setVolumeVisibleCalls: boolean[] = [];
  setVolumeDeltaVisibleCalls: boolean[] = [];
  setCvdVisibleCalls: boolean[] = [];
  setVolumeDeltaCalls: VolumeDeltaDatum[][] = [];
  updateVolumeDeltaCalls: VolumeDeltaDatum[] = [];
  setFvgSignalsCalls: FvgSignalUpdateMessage[][] = [];
  setFvgGraderVisibleCalls: boolean[] = [];
  setEmaLinesCalls: EmaLineData[][] = [];
  updateEmaLineCalls: { id: string; point: { time: number; value: number } }[] = [];
  clearEmaLinesCalls = 0;
  setBigTradesCalls: BigTradeMarker[][] = [];
  setSmcAiSignalsCalls: SmcAiSignalMarker[][] = [];
  setAlertLinesCalls: AlertLine[][] = [];
  setOrderLinesCalls: OrderLine[][] = [];
  setSmcOverlayCalls: SmcOverlay[] = [];
  setOutsideBarCalls: OutsideBarSettings[] = [];
  contextMenuHandlers: ((info: { price: number; x: number; y: number }) => void)[] = [];
  alertDragHandlers: {
    onPreview?: (id: string, price: number) => void;
    onCommit?: (id: string, price: number) => void;
    snap?: (price: number) => number;
  }[] = [];
  orderDragHandlers: {
    onPreview?: (id: string, price: number) => void;
    onCommit?: (id: string, price: number) => void;
    onCommitBatch?: (updates: readonly { id: string; price: number }[]) => void;
    snap?: (price: number) => number;
  }[] = [];
  selectedPriceLine: PriceLineSelection | undefined;
  screenshotDataUrl = "data:image/png;base64,abc";
  disposed = false;

  setBars(bars: BarSeries): void {
    this.setBarsCalls.push(bars.slice());
  }
  updateBar(b: Bar): void {
    this.updateBarCalls.push({ ...b });
  }
  takeScreenshotDataUrl(): string | undefined {
    return this.screenshotDataUrl;
  }
  setDisplayTimeOffset(offsetMs: number): void {
    this.displayTimeOffsetCalls.push(offsetMs);
  }
  setTimezoneOffsetMinutes(offsetMinutes: number): void {
    this.timezoneOffsetCalls.push(offsetMinutes);
  }
  setBarCountdownDuration(durationMs: number): void {
    this.barCountdownDurationCalls.push(durationMs);
  }
  setVolumeVisible(visible: boolean): void {
    this.setVolumeVisibleCalls.push(visible);
  }
  setVolumeDeltaVisible(visible: boolean): void {
    this.setVolumeDeltaVisibleCalls.push(visible);
  }
  setCvdVisible(visible: boolean): void {
    this.setCvdVisibleCalls.push(visible);
  }
  setVolumeDelta(points: readonly VolumeDeltaDatum[]): void {
    this.setVolumeDeltaCalls.push(points.map((point) => ({ ...point })));
  }
  updateVolumeDelta(point: VolumeDeltaDatum): void {
    this.updateVolumeDeltaCalls.push({ ...point });
  }
  setFvgSignals(signals: ReadonlyMap<number, FvgSignalUpdateMessage>): void {
    this.setFvgSignalsCalls.push(
      [...signals.values()].map((signal) => ({ ...signal })),
    );
  }
  setFvgGraderVisible(visible: boolean): void {
    this.setFvgGraderVisibleCalls.push(visible);
  }
  setEmaLines(lines: readonly EmaLineData[]): void {
    this.setEmaLinesCalls.push(
      lines.map((line) => ({
        ...line,
        points: line.points.map((point) => ({ ...point })),
      })),
    );
  }
  updateEmaLine(id: string, point: { time: number; value: number }): void {
    this.updateEmaLineCalls.push({ id, point: { ...point } });
  }
  clearEmaLines(): void {
    this.clearEmaLinesCalls += 1;
  }
  setBigTrades(markers: readonly BigTradeMarker[]): void {
    this.setBigTradesCalls.push(markers.map((marker) => ({ ...marker })));
  }
  setSmcAiSignals(markers: readonly SmcAiSignalMarker[]): void {
    this.setSmcAiSignalsCalls.push(markers.map((marker) => ({ ...marker })));
  }
  setAlertLines(lines: readonly AlertLine[]): void {
    this.setAlertLinesCalls.push(lines.map((line) => ({ ...line })));
  }
  setOrderLines(lines: readonly OrderLine[]): void {
    this.setOrderLinesCalls.push(lines.map((line) => ({ ...line })));
  }
  setSmcOverlay(overlay: SmcOverlay): void {
    this.setSmcOverlayCalls.push({
      markers: overlay.markers.map((marker) => ({ ...marker })),
      zones: overlay.zones.map((zone) => ({ ...zone })),
      lines: overlay.lines.map((line) => ({ ...line })),
      swingTrend: overlay.swingTrend,
      internalTrend: overlay.internalTrend,
    });
  }
  setOutsideBar(settings: OutsideBarSettings): void {
    this.setOutsideBarCalls.push({ ...settings });
  }
  subscribeContextMenu(
    handler: (info: { price: number; x: number; y: number }) => void,
  ): () => void {
    this.contextMenuHandlers.push(handler);
    return () => {
      this.contextMenuHandlers = this.contextMenuHandlers.filter(
        (h) => h !== handler,
      );
    };
  }
  subscribeAlertDrag(handlers: {
    onPreview?: (id: string, price: number) => void;
    onCommit?: (id: string, price: number) => void;
    snap?: (price: number) => number;
  }): () => void {
    this.alertDragHandlers.push(handlers);
    return () => {
      this.alertDragHandlers = this.alertDragHandlers.filter((h) => h !== handlers);
    };
  }
  subscribeOrderDrag(handlers: {
    onPreview?: (id: string, price: number) => void;
    onCommit?: (id: string, price: number) => void;
    onCommitBatch?: (updates: readonly { id: string; price: number }[]) => void;
    snap?: (price: number) => number;
  }): () => void {
    this.orderDragHandlers.push(handlers);
    return () => {
      this.orderDragHandlers = this.orderDragHandlers.filter((h) => h !== handlers);
    };
  }
  getSelectedPriceLine(): PriceLineSelection | undefined {
    return this.selectedPriceLine === undefined
      ? undefined
      : { ...this.selectedPriceLine };
  }
  clearSelectedPriceLine(): void {
    this.selectedPriceLine = undefined;
  }
  dispose(): void {
    this.disposed = true;
  }
}

/** Minimal synchronous mock WebSocket for ChartSocket. */
class MockWebSocket implements WebSocketLike {
  readyState: number = SocketReadyState.OPEN;
  sent: string[] = [];
  onopen: ((this: unknown, ev: unknown) => unknown) | null = null;
  onclose: ((this: unknown, ev: unknown) => unknown) | null = null;
  onerror: ((this: unknown, ev: unknown) => unknown) | null = null;
  onmessage: ((this: unknown, ev: { data: unknown }) => unknown) | null = null;

  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.readyState = SocketReadyState.CLOSED;
  }
  /** Simulate the server delivering a frame to the client. */
  deliver(message: unknown): void {
    this.onmessage?.call(this, { data: JSON.stringify(message) });
  }
}

function barUpdate(
  bar: Bar,
  overrides: Partial<BarUpdateMessage> = {},
): BarUpdateMessage {
  return {
    type: "bar_update",
    symbol: "GC",
    contract: "GC 08-26",
    tf: "1m",
    bar,
    closed: false,
    ...overrides,
  };
}

function deltaUpdate(
  time: number,
  delta: number,
  overrides: Partial<VolumeDeltaUpdateMessage> = {},
): VolumeDeltaUpdateMessage {
  return {
    type: "volume_delta_update",
    symbol: "GC",
    contract: "GC 08-26",
    tf: "1m",
    time,
    volume: Math.abs(delta),
    buyVolume: delta > 0 ? delta : 0,
    sellVolume: delta < 0 ? Math.abs(delta) : 0,
    delta,
    deltaHigh: Math.max(delta, 0),
    deltaLow: Math.min(delta, 0),
    openDelta: 0,
    closeDelta: delta,
    ...overrides,
  };
}

describe("ChartContainer", () => {
  it("bulk-loads initial history once via the port", () => {
    const port = new FakePort();
    const factory: ChartPortFactory = () => port;

    render(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(20), bar(10)]}
        portFactory={factory}
      />,
    );

    expect(port.setBarsCalls).toHaveLength(1);
    expect(port.setBarsCalls[0].map((b) => b.time)).toEqual([10, 20]);
    expect(port.displayTimeOffsetCalls).toContain(0);
  });

  it("updates display time offset when the timeframe changes", () => {
    const port = new FakePort();
    const factory: ChartPortFactory = () => port;

    const { rerender } = render(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10)]}
        portFactory={factory}
      />,
    );

    rerender(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="5m"
        bars={[bar(300)]}
        portFactory={factory}
      />,
    );

    expect(port.displayTimeOffsetCalls).toContain(0);
    expect(port.barCountdownDurationCalls).toContain(5 * 60_000);
  });

  it("updates the chart timezone without rebuilding the port", () => {
    const port = new FakePort();
    const factory: ChartPortFactory = () => port;

    const { rerender } = render(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10)]}
        timezoneOffsetMinutes={0}
        portFactory={factory}
      />,
    );

    rerender(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10)]}
        timezoneOffsetMinutes={7 * 60}
        portFactory={factory}
      />,
    );

    expect(port.timezoneOffsetCalls).toEqual([0, 7 * 60]);
    expect(port.disposed).toBe(false);
  });

  it("passes Outside Bar settings to the chart port and updates them", () => {
    const port = new FakePort();
    const factory: ChartPortFactory = () => port;
    const enabled = {
      ...DEFAULT_OUTSIDE_BAR_SETTINGS,
      enabled: true,
    };

    const { rerender } = render(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10)]}
        outsideBar={enabled}
        portFactory={factory}
      />,
    );

    const recolored = { ...enabled, bullColor: "#123456" };
    rerender(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10)]}
        outsideBar={recolored}
        portFactory={factory}
      />,
    );

    expect(port.setOutsideBarCalls).toEqual([enabled, recolored]);
  });

  it("toggles the TradingView-style volume overlay through the port", () => {
    const port = new FakePort();
    const factory: ChartPortFactory = () => port;

    const { rerender } = render(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10)]}
        showVolume
        portFactory={factory}
      />,
    );

    rerender(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10)]}
        showVolume={false}
        portFactory={factory}
      />,
    );

    expect(port.setVolumeVisibleCalls).toEqual([true, false]);
  });

  it("toggles the volume delta overlay through the port", () => {
    const port = new FakePort();
    const factory: ChartPortFactory = () => port;

    const { rerender } = render(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10)]}
        showVolumeDelta
        portFactory={factory}
      />,
    );

    rerender(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10)]}
        showVolumeDelta={false}
        portFactory={factory}
      />,
    );

    expect(port.setVolumeDeltaVisibleCalls).toEqual([true, false]);
  });

  it("toggles the Wave Delta line through the port", () => {
    const port = new FakePort();
    const factory: ChartPortFactory = () => port;

    const { rerender } = render(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10)]}
        showCvd
        portFactory={factory}
      />,
    );

    rerender(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10)]}
        showCvd={false}
        portFactory={factory}
      />,
    );

    expect(port.setCvdVisibleCalls).toEqual([true, false]);
  });

  it("loads FVG Signal Grader colors and toggles their visibility", () => {
    const port = new FakePort();
    const factory: ChartPortFactory = () => port;
    const signal: FvgSignalUpdateMessage = {
      type: "fvg_signal_update",
      symbol: "GC",
      contract: "GC",
      tf: "1m",
      time: 10,
      direction: 1,
      level: 5,
      pulse: 5,
      top: 101,
      bottom: 100.5,
      breakoutRatio: 1.8,
      phase: "confirmed",
    };

    const { rerender } = render(
      <ChartContainer
        symbol="GC"
        contract="GC"
        timeframe="1m"
        bars={[bar(10)]}
        fvgSignals={new Map([[signal.time, signal]])}
        showFvgGrader
        portFactory={factory}
      />,
    );

    rerender(
      <ChartContainer
        symbol="GC"
        contract="GC"
        timeframe="1m"
        bars={[bar(10)]}
        fvgSignals={new Map([[signal.time, signal]])}
        showFvgGrader={false}
        portFactory={factory}
      />,
    );

    expect(
      port.setFvgSignalsCalls[port.setFvgSignalsCalls.length - 1],
    ).toEqual([signal]);
    expect(port.setFvgGraderVisibleCalls).toEqual([true, false]);
  });

  it("supplies a screenshot capture callback while mounted", () => {
    const port = new FakePort();
    const factory: ChartPortFactory = () => port;
    const onScreenshotCaptureReady = vi.fn();

    const { unmount } = render(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10)]}
        portFactory={factory}
        onScreenshotCaptureReady={onScreenshotCaptureReady}
      />,
    );

    const capture = onScreenshotCaptureReady.mock.calls[0][0] as () => string;
    expect(capture()).toBe("data:image/png;base64,abc");
    unmount();
    expect(onScreenshotCaptureReady).toHaveBeenLastCalledWith(undefined);
  });

  it("applies matching realtime bar_update events incrementally (Req 11.3)", () => {
    const port = new FakePort();
    const factory: ChartPortFactory = () => port;
    const ws = new MockWebSocket();
    const socket = new ChartSocket({ url: "ws://x/ws/chart", factory: () => ws });
    socket.connect();

    render(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10), bar(20)]}
        socket={socket}
        portFactory={factory}
      />,
    );

    ws.deliver(barUpdate(bar(30)));
    ws.deliver(barUpdate(bar(30, 99)));

    expect(port.setBarsCalls).toHaveLength(1); // never a second full load
    expect(port.updateBarCalls.map((b) => b.time)).toEqual([30, 30]);
    expect(port.updateBarCalls[1].close).toBe(99);
  });

  it("loads and updates volume delta on the lower MyVolumeDelta-style candles", () => {
    const port = new FakePort();
    const factory: ChartPortFactory = () => port;
    const ws = new MockWebSocket();
    const socket = new ChartSocket({ url: "ws://x/ws/chart", factory: () => ws });
    socket.connect();

    render(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10)]}
        volumeDelta={[
          { time: 10, delta: 5, deltaHigh: 8, deltaLow: -2, openDelta: 1, closeDelta: 5 },
          { time: 20, delta: -3, deltaHigh: 2, deltaLow: -6, openDelta: -1, closeDelta: -3 },
        ]}
        socket={socket}
        portFactory={factory}
      />,
    );

    ws.deliver(deltaUpdate(30, 9, { cumulativeDelta: 25 }));
    ws.deliver(deltaUpdate(40, -4, { contract: "GC 10-26" }));

    expect(port.setVolumeDeltaCalls).toHaveLength(1);
    expect(port.setVolumeDeltaCalls[0]).toEqual([
      { time: 10, delta: 5, deltaHigh: 8, deltaLow: -2, openDelta: 1, closeDelta: 5 },
      { time: 20, delta: -3, deltaHigh: 2, deltaLow: -6, openDelta: -1, closeDelta: -3 },
    ]);
    expect(port.updateVolumeDeltaCalls).toEqual([
      {
        time: 30,
        delta: 9,
        deltaHigh: 9,
        deltaLow: 0,
        openDelta: 0,
        closeDelta: 9,
        cumulativeDelta: 25,
      },
    ]);
  });

  it("draws the primary EMA and optional EMA 200 as separate lines", () => {
    const port = new FakePort();
    const factory: ChartPortFactory = () => port;

    render(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10), bar(20)]}
        ema={{
          enabled: true,
          period: 21,
          color: "#2962ff",
          showEma200: true,
          ema200Color: "#e0b341",
        }}
        portFactory={factory}
      />,
    );

    const lines = port.setEmaLinesCalls[0];
    expect(lines.map((line) => line.id)).toEqual(["primary", "ema-200"]);
    expect(lines[0].points).toHaveLength(2);
    expect(lines[1].points).toHaveLength(2);
    expect(lines[0].color).toBe("#2962ff");
    expect(lines[1].color).toBe("#e0b341");
  });

  it("updates both EMA lines from matching realtime bar updates", () => {
    const port = new FakePort();
    const factory: ChartPortFactory = () => port;
    const ws = new MockWebSocket();
    const socket = new ChartSocket({ url: "ws://x/ws/chart", factory: () => ws });
    socket.connect();

    render(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10), bar(20)]}
        ema={{
          enabled: true,
          period: 21,
          color: "#2962ff",
          showEma200: true,
          ema200Color: "#e0b341",
        }}
        socket={socket}
        portFactory={factory}
      />,
    );

    ws.deliver(barUpdate(bar(30)));

    expect(port.updateEmaLineCalls.map((call) => call.id)).toEqual([
      "primary",
      "ema-200",
    ]);
  });

  it("loads and clears BigTrade markers through the port", () => {
    const port = new FakePort();
    const factory: ChartPortFactory = () => port;
    const markers: BigTradeMarker[] = [
      { time: 10, price: 4500.1, volume: 40, side: "buy" },
      { time: 20, price: 4499.9, volume: 55, side: "sell" },
    ];

    const { rerender } = render(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10)]}
        bigTrades={markers}
        showBigTrades
        portFactory={factory}
      />,
    );

    rerender(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10)]}
        bigTrades={markers}
        showBigTrades={false}
        portFactory={factory}
      />,
    );

    expect(port.setBigTradesCalls[0]).toEqual(markers);
    expect(port.setBigTradesCalls[port.setBigTradesCalls.length - 1]).toEqual([]);
  });

  it("loads SMC AI signal markers through the port", () => {
    const port = new FakePort();
    const factory: ChartPortFactory = () => port;
    const signals: SmcAiSignalMarker[] = [
      {
        id: "sig-1",
        time: 10,
        price: 4500.1,
        side: "long",
        zoneType: "fvg",
        huntType: "sweep_low",
        confirmation: "outside_bar",
        outcome: "win",
        netR: 1.9,
        text: "AI L FVG",
      },
    ];

    render(
      <ChartContainer
        symbol="GC"
        contract="GC"
        timeframe="1m"
        bars={[bar(10)]}
        smcAiSignals={signals}
        portFactory={factory}
      />,
    );

    expect(port.setSmcAiSignalsCalls[0]).toEqual(signals);
  });

  it("filters BigTrade markers by display min volume and max visible", () => {
    const markers: BigTradeMarker[] = [
      { time: 10, price: 4500.1, volume: 20, side: "buy" },
      { time: 20, price: 4500.2, volume: 35, side: "buy" },
      { time: 30, price: 4500.3, volume: 50, side: "sell" },
      { time: 40, price: 4500.4, volume: 70, side: "sell" },
    ];

    expect(
      filterBigTradeMarkers(markers, { minVolume: 30, maxVisible: 2 }),
    ).toEqual(markers.slice(2));
  });

  it("filters BigTrade markers by New York session thresholds", () => {
    const asia = Date.UTC(2026, 5, 16, 2, 0); // 22:00 ET previous day
    const asiaEnd = Date.UTC(2026, 5, 16, 5, 59); // 01:59 ET
    const euStart = Date.UTC(2026, 5, 16, 6, 0); // 02:00 ET
    const eu = Date.UTC(2026, 5, 16, 11, 0); // 07:00 ET
    const us = Date.UTC(2026, 5, 16, 14, 0); // 10:00 ET
    const markers: BigTradeMarker[] = [
      { time: asia, price: 4500.1, volume: 30, side: "buy" },
      { time: asiaEnd, price: 4500.2, volume: 30, side: "buy" },
      { time: euStart, price: 4500.3, volume: 49, side: "buy" },
      { time: eu, price: 4500.4, volume: 50, side: "sell" },
      { time: us, price: 4500.5, volume: 99, side: "sell" },
      { time: us + 1, price: 4500.6, volume: 100, side: "buy" },
    ];

    expect(filterBigTradeMarkers(markers, DEFAULT_BIG_TRADE_SETTINGS)).toEqual([
      markers[0],
      markers[1],
      markers[3],
      markers[5],
    ]);
  });

  it("computes and draws the SMC overlay from loaded bars", () => {
    vi.useFakeTimers();
    try {
      const port = new FakePort();
      const factory: ChartPortFactory = () => port;
      const smc = {
        ...DEFAULT_SMC_SETTINGS,
        enabled: true,
        swingLength: 2,
        internalLength: 1,
      };

      render(
        <ChartContainer
          symbol="GC"
          contract="GC 08-26"
          timeframe="1m"
          bars={[
            ohlc(0, 9.5, 10, 9, 9.5),
            ohlc(1, 11.5, 12, 11, 11.5),
            ohlc(2, 10.5, 11, 10, 10.5),
            ohlc(3, 9.5, 10, 9, 9.5),
            ohlc(4, 10, 11, 8, 10),
            ohlc(5, 12.5, 13, 9, 12.5),
          ]}
          smc={smc}
          portFactory={factory}
        />,
      );

      // SMC overlay computation is deferred by 100ms to avoid blocking the
      // initial chart render.
      vi.advanceTimersByTime(100);

      const overlay = port.setSmcOverlayCalls[0];
      expect(overlay.lines.some((line) => line.label === "BOS")).toBe(true);
      expect(overlay.zones.some((zone) => zone.kind === "ob")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("refreshes the SMC overlay after matching realtime bar updates", () => {
    vi.useFakeTimers();
    try {
      const port = new FakePort();
      const factory: ChartPortFactory = () => port;
      const ws = new MockWebSocket();
      const socket = new ChartSocket({ url: "ws://x/ws/chart", factory: () => ws });
      socket.connect();
      const smc = {
        ...DEFAULT_SMC_SETTINGS,
        enabled: true,
        swingLength: 2,
        internalLength: 1,
      };

      render(
        <ChartContainer
          symbol="GC"
          contract="GC 08-26"
          timeframe="1m"
          bars={[
            ohlc(0, 9.5, 10, 9, 9.5),
            ohlc(1, 11.5, 12, 11, 11.5),
            ohlc(2, 10.5, 11, 10, 10.5),
            ohlc(3, 9.5, 10, 9, 9.5),
            ohlc(4, 10, 11, 8, 10),
          ]}
          smc={smc}
          socket={socket}
          portFactory={factory}
        />,
      );

      ws.deliver(barUpdate(ohlc(5, 12.5, 13, 9, 12.5)));

      // SMC overlay recomputation is throttled to max once per 500ms during
      // realtime updates to avoid blocking the main thread on every tick.
      vi.advanceTimersByTime(500);

      const overlay = port.setSmcOverlayCalls[port.setSmcOverlayCalls.length - 1];
      expect(overlay.lines.some((line) => line.label === "BOS")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores bar_update events for a different series", () => {
    const port = new FakePort();
    const factory: ChartPortFactory = () => port;
    const ws = new MockWebSocket();
    const socket = new ChartSocket({ url: "ws://x/ws/chart", factory: () => ws });
    socket.connect();

    render(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10)]}
        socket={socket}
        portFactory={factory}
      />,
    );

    ws.deliver(barUpdate(bar(30), { contract: "GC 10-26" })); // wrong contract
    ws.deliver(barUpdate(bar(30), { tf: "5m" })); // wrong timeframe
    ws.deliver(barUpdate(bar(30), { symbol: "ES" })); // wrong symbol

    expect(port.updateBarCalls).toHaveLength(0);
  });

  it("does not repaint when an in-progress bar is unchanged (Req 12.4)", () => {
    const port = new FakePort();
    const factory: ChartPortFactory = () => port;
    const ws = new MockWebSocket();
    const socket = new ChartSocket({ url: "ws://x/ws/chart", factory: () => ws });
    socket.connect();

    render(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10), bar(20)]}
        socket={socket}
        portFactory={factory}
      />,
    );

    ws.deliver(barUpdate(bar(20))); // identical to existing bar at time 20
    expect(port.updateBarCalls).toHaveLength(0);
  });

  it("draws alert level lines through the port and updates on change", () => {
    const port = new FakePort();
    const factory: ChartPortFactory = () => port;

    const { rerender } = render(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10)]}
        alertLines={[{ id: "a1", price: 2345, title: "cross", enabled: true }]}
        portFactory={factory}
      />,
    );

    rerender(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10)]}
        alertLines={[
          { id: "a1", price: 2345, title: "cross", enabled: false },
          { id: "a2", price: 2350, title: "close >", enabled: true },
        ]}
        portFactory={factory}
      />,
    );

    expect(port.setAlertLinesCalls[0]).toEqual([
      { id: "a1", price: 2345, title: "cross", enabled: true },
    ]);
    expect(port.setAlertLinesCalls[port.setAlertLinesCalls.length - 1]).toEqual([
      { id: "a1", price: 2345, title: "cross", enabled: false },
      { id: "a2", price: 2350, title: "close >", enabled: true },
    ]);
  });

  it("forwards a context-menu request with the price under the pointer", () => {
    const port = new FakePort();
    const factory: ChartPortFactory = () => port;
    const onRequestAlertAtPrice = vi.fn();

    render(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10)]}
        portFactory={factory}
        onRequestAlertAtPrice={onRequestAlertAtPrice}
      />,
    );

    expect(port.contextMenuHandlers).toHaveLength(1);
    port.contextMenuHandlers[0]({ price: 4563.2, x: 120, y: 80 });
    expect(onRequestAlertAtPrice).toHaveBeenCalledWith({
      price: 4563.2,
      x: 120,
      y: 80,
    });
  });

  it("forwards a committed alert-line drag with snapping", () => {
    const port = new FakePort();
    const factory: ChartPortFactory = () => port;
    const onAlertDragCommit = vi.fn();

    render(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10)]}
        alertLines={[{ id: "a1", price: 2345, enabled: true }]}
        portFactory={factory}
        onAlertDragCommit={onAlertDragCommit}
        priceSnap={(p) => Math.round(p * 10) / 10}
      />,
    );

    expect(port.alertDragHandlers).toHaveLength(1);
    const handlers = port.alertDragHandlers[0];
    expect(handlers.snap?.(2345.07)).toBe(2345.1);
    handlers.onCommit?.("a1", 2350.1);
    expect(onAlertDragCommit).toHaveBeenCalledWith("a1", 2350.1);
  });

  it("deletes the selected alert line with Delete", () => {
    const port = new FakePort();
    port.selectedPriceLine = { kind: "alert", id: "a1" };
    const factory: ChartPortFactory = () => port;
    const onAlertDelete = vi.fn();

    render(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10)]}
        alertLines={[{ id: "a1", price: 2345, enabled: true }]}
        portFactory={factory}
        onAlertDelete={onAlertDelete}
      />,
    );

    fireEvent.keyDown(document, { key: "Delete" });

    expect(onAlertDelete).toHaveBeenCalledWith("a1");
    expect(port.selectedPriceLine).toBeUndefined();
  });

  it("draws order lines and forwards committed order-line drags", () => {
    const port = new FakePort();
    const factory: ChartPortFactory = () => port;
    const onOrderDragCommit = vi.fn();
    const orderLines: OrderLine[] = [
      {
        id: "ord_1:entryGc",
        orderId: "ord_1",
        field: "entryGc",
        price: 2348.5,
        side: "buy",
        status: "working",
        title: "BUY limit",
      },
      {
        id: "ord_1:slGc",
        orderId: "ord_1",
        field: "slGc",
        price: 2345.5,
        side: "buy",
        status: "working",
        title: "SL",
      },
    ];

    render(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10)]}
        orderLines={orderLines}
        portFactory={factory}
        onOrderDragCommit={onOrderDragCommit}
        priceSnap={(p) => Math.round(p * 10) / 10}
      />,
    );

    expect(port.setOrderLinesCalls[0]).toEqual(orderLines);
    expect(port.orderDragHandlers).toHaveLength(1);
    const handlers = port.orderDragHandlers[0];
    expect(handlers.snap?.(2348.56)).toBe(2348.6);
    handlers.onCommit?.("ord_1:slGc", 2346.1);
    expect(onOrderDragCommit).toHaveBeenCalledWith("ord_1:slGc", 2346.1);
  });

  it("forwards batched order-line drags", () => {
    const port = new FakePort();
    const factory: ChartPortFactory = () => port;
    const onOrderDragBatchCommit = vi.fn();

    render(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10)]}
        orderLines={[]}
        portFactory={factory}
        onOrderDragBatchCommit={onOrderDragBatchCommit}
      />,
    );

    expect(port.orderDragHandlers).toHaveLength(1);
    const updates = [
      { id: "ord_1:slGc", price: 2346.1 },
      { id: "ord_1:tpGc", price: 2351.2 },
    ];
    port.orderDragHandlers[0].onCommitBatch?.(updates);

    expect(onOrderDragBatchCommit).toHaveBeenCalledWith(updates);
  });

  it("disposes the port on unmount", () => {
    const port = new FakePort();
    const factory: ChartPortFactory = () => port;

    const { unmount } = render(
      <ChartContainer
        symbol="GC"
        contract="GC 08-26"
        timeframe="1m"
        bars={[bar(10)]}
        portFactory={factory}
      />,
    );

    unmount();
    expect(port.disposed).toBe(true);
  });
});
