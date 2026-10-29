import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChartSocket } from "../socket/ChartSocket";
import type { IcebergUpdateMessage } from "../socket/messages";
import { useNativeIcebergs } from "./useNativeIcebergs";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const live: IcebergUpdateMessage = {
  type: "iceberg_update", symbol: "GC", contract: "GC", source: "rithmic",
  sourceContract: "GC 12-26", sessionId: "session-1", orderId: "order-1",
  side: "sell", price: 2800, time: 120_000, firstSeenTime: 100_000,
  detectedTime: 110_000, lastTradeTime: 120_000, endTime: null,
  executedVolume: 20, displayedSize: 3, refillCount: 2, status: "active",
  detectionReason: "refill", sequence: 4, method: "native",
};

function client() {
  let update: (row: IcebergUpdateMessage) => void = () => {};
  let opened = () => {};
  let closed = () => {};
  const socket = {
    isOpen: true,
    on: vi.fn((_type: string, handler: typeof update) => { update = handler; return vi.fn(); }),
    onOpen: vi.fn((handler: () => void) => { opened = handler; return vi.fn(); }),
    onClose: vi.fn((handler: () => void) => { closed = handler; return vi.fn(); }),
    subscribe: vi.fn(), unsubscribe: vi.fn(),
  };
  return { socket: socket as unknown as ChartSocket, update: (row = live) => update(row),
    open: () => opened(), close: () => closed(), unsubscribe: socket.unsubscribe };
}

function response(rows = [live]) {
  return { ok: true, json: async () => ({ symbol: "GC", contract: "GC", source: "rithmic",
    sourceContract: "GC 12-26", sessionId: "session-1", synchronized: true,
    connected: true, icebergs: rows }) } as Response;
}

describe("native iceberg live/bootstrap lifecycle", () => {
  it("subscribes before fetching, keeps racing live updates and filters locally", async () => {
    const source = client();
    let resolve!: (value: Response) => void;
    const fetcher = vi.fn((_url: RequestInfo | URL, _init?: RequestInit) =>
      new Promise<Response>((done) => { resolve = done; }));
    vi.stubGlobal("fetch", fetcher);
    const { result, rerender, unmount } = renderHook(({ minVolume }) =>
      useNativeIcebergs(source.socket, "/api", "GC", "GC", true, minVolume),
    { initialProps: { minVolume: 1 } });
    act(() => source.update());
    await act(async () => resolve(response([{ ...live, sequence: 1, executedVolume: 10 }])));
    await waitFor(() => expect(result.current.synchronized).toBe(true));
    expect(result.current.icebergs[0].executedVolume).toBe(20);
    expect(fetcher.mock.calls[0][0]).toContain("/api/orderflow/icebergs?");
    rerender({ minVolume: 21 });
    expect(result.current.icebergs).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    unmount();
    expect(source.unsubscribe).toHaveBeenCalledWith("GC", ["iceberg_update"]);
  });

  it("clears readiness on close and refreshes the snapshot on reconnect", async () => {
    const source = client();
    const fetcher = vi.fn(async () => response());
    vi.stubGlobal("fetch", fetcher);
    const { result } = renderHook(() => useNativeIcebergs(source.socket, "/api", "GC", "GC", true, 1));
    await waitFor(() => expect(result.current.synchronized).toBe(true));
    act(() => source.close());
    expect(result.current.connected).toBe(false);
    expect(result.current.synchronized).toBe(false);
    act(() => source.open());
    await waitFor(() => expect(result.current.synchronized).toBe(true));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.current.connected).toBe(true);
  });
});
