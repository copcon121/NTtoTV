import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WebSocketLike } from "../socket/ChartSocket";
import type { BarUpdateMessage } from "../socket/messages";
import { useCurrentPrice } from "./useCurrentPrice";

const sockets: TestSocket[] = [];

class TestSocket implements WebSocketLike {
  readyState = 0;
  onopen: WebSocketLike["onopen"] = null;
  onclose: WebSocketLike["onclose"] = null;
  onerror: WebSocketLike["onerror"] = null;
  onmessage: WebSocketLike["onmessage"] = null;
  send = vi.fn();
  close = vi.fn(() => { this.readyState = 3; });

  constructor() { sockets.push(this); }
  open() {
    this.readyState = 1;
    this.onopen?.call(this, {});
  }
  receive(message: BarUpdateMessage) {
    this.onmessage?.call(this, { data: JSON.stringify(message) });
  }
}

function update(time: number, close: number, extra: Partial<BarUpdateMessage> = {}): BarUpdateMessage {
  return {
    type: "bar_update", symbol: "GC", contract: "GC", tf: "1m", closed: false,
    bar: { time, open: close, high: close, low: close, close, volume: 1 },
    ...extra,
  };
}

describe("MP current price", () => {
  beforeEach(() => {
    sockets.length = 0;
    vi.stubGlobal("WebSocket", TestSocket);
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("tracks the logical GC price without reverting to older bars or other series", () => {
    const { result, unmount } = renderHook(() => useCurrentPrice("/api", "ws://localhost/ws/chart"));
    act(() => sockets[0].open());
    expect(sockets[0].send).toHaveBeenCalledWith(JSON.stringify({
      type: "subscribe", symbol: "GC", events: ["bar_update"], tf: "1m",
    }));
    act(() => {
      sockets[0].receive(update(120_000, 4500.1));
      sockets[0].receive(update(120_000, 4500.2));
      sockets[0].receive(update(60_000, 4400));
      sockets[0].receive(update(180_000, 4600, { contract: "GC 12-26" }));
      sockets[0].receive(update(180_000, 4600, { symbol: "ES" }));
      sockets[0].receive(update(180_000, 4600, { tf: "5m" }));
      sockets[0].receive(update(180_000, NaN));
    });
    expect(result.current).toEqual({ price: 4500.2, time: 120_000 });
    unmount();
    expect(sockets[0].close).toHaveBeenCalledOnce();
  });

  it("loads the latest cached price when the socket opens, including a quiet market", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ bars: [update(120_000, 4501.5).bar] })));
    const { result } = renderHook(() => useCurrentPrice("/api", "ws://localhost/ws/chart"));
    act(() => sockets[0].open());
    await waitFor(() => expect(result.current).toEqual({ price: 4501.5, time: 120_000 }));
    expect(fetch).toHaveBeenCalledWith("/api/history?symbol=GC&tf=1m&contract=GC&limit=1", expect.objectContaining({
      credentials: "same-origin", cache: "no-store",
    }));
  });

  it("keeps a live update that arrives while the initial snapshot is in flight", async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((done) => { resolve = done; })));
    const { result } = renderHook(() => useCurrentPrice("/api", "ws://localhost/ws/chart"));
    act(() => {
      sockets[0].open();
      sockets[0].receive(update(120_000, 4502.5));
    });
    await act(async () => { resolve(Response.json({ bars: [update(120_000, 4501).bar] })); });
    expect(result.current).toEqual({ price: 4502.5, time: 120_000 });
  });
});
