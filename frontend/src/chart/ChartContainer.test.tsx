import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type ChartPortFactory,
  type DisposableChartPort,
  type VolumeDeltaDatum,
  type AlertLine,
  type SmcOverlay,
  type OutsideBarSettings,
  DEFAULT_OUTSIDE_BAR_SETTINGS,
  ChartContainer,
  filterBigTradeMarkers,
} from "./index";
import { type BigTradeMarker } from "./indicatorReducer";
import { DEFAULT_SMC_SETTINGS } from "./smc";
import type { BarSeries } from "./index";
import { type Bar } from "../cache/types";
import { ChartSocket, SocketReadyState, type WebSocketLike } from "../socket";
import type { BarUpdateMessage, VolumeDeltaUpdateMessage } from "../socket/messages";

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
  setVolumeDeltaCalls: VolumeDeltaDatum[][] = [];
  updateVolumeDeltaCalls: VolumeDeltaDatum[] = [];
  setBigTradesCalls: BigTradeMarker[][] = [];
  setAlertLinesCalls: AlertLine[][] = [];
  setSmcOverlayCalls: SmcOverlay[] = [];
  setOutsideBarCalls: OutsideBarSettings[] = [];
  contextMenuHandlers: ((info: { price: number; x: number; y: number }) => void)[] = [];
  alertDragHandlers: {
    onPreview?: (id: string, price: number) => void;
    onCommit?: (id: string, price: number) => void;
    snap?: (price: number) => number;
  }[] = [];
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
  setVolumeDelta(points: readonly VolumeDeltaDatum[]): void {
    this.setVolumeDeltaCalls.push(points.map((point) => ({ ...point })));
  }
  updateVolumeDelta(point: VolumeDeltaDatum): void {
    this.updateVolumeDeltaCalls.push({ ...point });
  }
  setBigTrades(markers: readonly BigTradeMarker[]): void {
    this.setBigTradesCalls.push(markers.map((marker) => ({ ...marker })));
  }
  setAlertLines(lines: readonly AlertLine[]): void {
    this.setAlertLinesCalls.push(lines.map((line) => ({ ...line })));
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
    expect(port.displayTimeOffsetCalls).toContain(60_000);
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

    expect(port.displayTimeOffsetCalls).toContain(60_000);
    expect(port.displayTimeOffsetCalls).toContain(5 * 60_000);
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

    ws.deliver(deltaUpdate(30, 9));
    ws.deliver(deltaUpdate(40, -4, { contract: "GC 10-26" }));

    expect(port.setVolumeDeltaCalls).toHaveLength(1);
    expect(port.setVolumeDeltaCalls[0]).toEqual([
      { time: 10, delta: 5, deltaHigh: 8, deltaLow: -2, openDelta: 1, closeDelta: 5 },
      { time: 20, delta: -3, deltaHigh: 2, deltaLow: -6, openDelta: -1, closeDelta: -3 },
    ]);
    expect(port.updateVolumeDeltaCalls).toEqual([
      { time: 30, delta: 9, deltaHigh: 9, deltaLow: 0, openDelta: 0, closeDelta: 9 },
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

  it("computes and draws the SMC overlay from loaded bars", () => {
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

    const overlay = port.setSmcOverlayCalls[0];
    expect(overlay.lines.some((line) => line.label === "BOS")).toBe(true);
    expect(overlay.zones.some((zone) => zone.kind === "ob")).toBe(true);
  });

  it("refreshes the SMC overlay after matching realtime bar updates", () => {
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

    const overlay = port.setSmcOverlayCalls[port.setSmcOverlayCalls.length - 1];
    expect(overlay.lines.some((line) => line.label === "BOS")).toBe(true);
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
