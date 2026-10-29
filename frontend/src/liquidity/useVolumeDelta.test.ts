import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChartSocket } from "../socket/ChartSocket";
import type { VolumeDeltaUpdateMessage } from "../socket/messages";
import { useVolumeDelta } from "./useVolumeDelta";

const NOW = 1_800_000_000_000;

function setup() {
  let delta: ((message: VolumeDeltaUpdateMessage) => void) | undefined;
  let open: (() => void) | undefined;
  const socket = {
    subscribe: vi.fn(), unsubscribe: vi.fn(),
    on: vi.fn((_type: string, handler: typeof delta) => {
      delta = handler;
      return () => { delta = undefined; };
    }),
    onOpen: vi.fn((handler: () => void) => {
      open = handler;
      return () => { open = undefined; };
    }),
  };
  const requests: Array<{
    url: string; signal: AbortSignal; resolve: (response: Response) => void;
  }> = [];
  vi.stubGlobal("fetch", vi.fn((url: string, init: RequestInit) => new Promise<Response>((resolve) => {
    requests.push({ url, signal: init.signal as AbortSignal, resolve });
  })));
  const respond = async (index: number, bars: Array<{ time: number; delta: number }>) => {
    await act(async () => {
      requests[index].resolve({ ok: true, json: async () => ({ bars }) } as Response);
    });
  };
  const emit = (overrides: Partial<VolumeDeltaUpdateMessage> = {}) => act(() => delta?.({
    type: "volume_delta_update", symbol: "GC", contract: "GC", tf: "1m", time: NOW,
    volume: 300, buyVolume: 200, sellVolume: 100, delta: 100,
    deltaHigh: 100, deltaLow: 0, openDelta: 0, closeDelta: 100, ...overrides,
  }));
  return { socket, client: socket as unknown as ChartSocket, requests, respond, emit,
    reconnect: () => act(() => open?.()),
  };
}

beforeEach(() => { vi.spyOn(Date, "now").mockReturnValue(NOW); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("LQ per-bar Volume Delta", () => {
  it("loads two days of 15s history while preserving the live delta over a late snapshot", async () => {
    const env = setup();
    const { result, unmount } = renderHook(() => useVolumeDelta(env.client, "/api", "15s", 15_000, 0));
    expect(env.socket.subscribe).toHaveBeenCalledWith("GC", ["volume_delta_update"], "15s");
    expect(env.requests).toHaveLength(3);
    const pages = env.requests.map((request) => new URL(request.url, "https://example.test").searchParams);
    expect(pages.every((page) => page.get("tf") === "15s" && page.get("limit") === "5000")).toBe(true);
    expect(Number(pages[0].get("from"))).toBe(NOW - 48 * 60 * 60_000);
    expect(Number(pages[0].get("to")) + 1).toBe(Number(pages[1].get("from")));
    expect(Number(pages[1].get("to")) + 1).toBe(Number(pages[2].get("from")));
    expect(Number(pages[2].get("to"))).toBe(NOW);
    env.emit({ tf: "15s", delta: 75 });
    env.emit({ tf: "30s", delta: -900 });
    await env.respond(2, [{ time: NOW - 15_000, delta: -20 }, { time: NOW, delta: 10 }]);
    await env.respond(1, []);
    const oldest = NOW - 48 * 60 * 60_000;
    await env.respond(0, [{ time: oldest, delta: 30 }]);
    expect(result.current.bars).toEqual([
      { time: oldest, delta: 30 }, { time: NOW - 15_000, delta: -20 }, { time: NOW, delta: 75 },
    ]);
    unmount();
    expect(env.requests.every((request) => request.signal.aborted)).toBe(true);
    expect(env.socket.unsubscribe).toHaveBeenCalledWith("GC", ["volume_delta_update"], "15s");
  });

  it("keeps the realtime candle over a REST snapshot, without accepting other series", async () => {
    const env = setup();
    const { result } = renderHook(() => useVolumeDelta(env.client, "/api", "1m", 60_000, 0));
    env.emit();
    env.emit({ tf: "5m", delta: -900 });
    env.emit({ contract: "GC 12-26", delta: -800 });
    env.emit({ symbol: "ES", delta: -700 });
    await env.respond(0, [{ time: NOW - 60_000, delta: -25 }, { time: NOW, delta: 20 }]);
    expect(result.current.bars).toEqual([
      { time: NOW - 60_000, delta: -25 }, { time: NOW, delta: 100 },
    ]);
    expect(env.requests[0].url).toContain("/api/orderflow/volume-delta?symbol=GC&contract=GC&tf=1m");
  });

  it("clears old timeframe data and ignores late responses after switching", async () => {
    const env = setup();
    const { result, rerender, unmount } = renderHook(
      ({ tf }: { tf: "1m" | "5m" }) => useVolumeDelta(env.client, "/api", tf, tf === "1m" ? 60_000 : 300_000, 0),
      { initialProps: { tf: "1m" } },
    );
    env.emit();
    rerender({ tf: "5m" });
    expect(result.current.bars).toEqual([]);
    expect(env.requests[0].signal.aborted).toBe(true);
    await env.respond(0, [{ time: NOW, delta: 800 }]);
    expect(result.current.bars).toEqual([]);
    await env.respond(1, [{ time: NOW, delta: -50 }]);
    expect(result.current.bars).toEqual([{ time: NOW, delta: -50 }]);
    expect(env.socket.unsubscribe).toHaveBeenCalledWith("GC", ["volume_delta_update"], "1m");
    unmount();
    expect(env.socket.unsubscribe).toHaveBeenCalledWith("GC", ["volume_delta_update"], "5m");
  });

  it("repairs closed bars on reconnect and replaces updates instead of accumulating them", async () => {
    const env = setup();
    const { result } = renderHook(() => useVolumeDelta(env.client, "/api", "1m", 60_000, 0));
    await env.respond(0, [{ time: NOW - 60_000, delta: 15 }]);
    env.emit({ delta: 40 });
    env.emit({ delta: 60 });
    env.reconnect();
    await env.respond(1, [{ time: NOW - 60_000, delta: -30 }, { time: NOW, delta: 45 }]);
    expect(result.current.bars).toEqual([
      { time: NOW - 60_000, delta: -30 }, { time: NOW, delta: 60 },
    ]);
  });

  it("keeps the viewport during a history repair and accepts repaired closed deltas", async () => {
    const env = setup();
    const { result, rerender, unmount } = renderHook(
      ({ reloadKey }) => useVolumeDelta(env.client, "/api", "1m", 60_000, reloadKey),
      { initialProps: { reloadKey: 0 } },
    );
    await env.respond(0, [{ time: NOW - 120_000, delta: 15 }]);
    env.emit({ delta: 60 });
    rerender({ reloadKey: 1 });
    expect(result.current.bars).toEqual([
      { time: NOW - 120_000, delta: 15 }, { time: NOW, delta: 60 },
    ]);
    await env.respond(1, [
      { time: NOW - 120_000, delta: -30 }, { time: NOW - 60_000, delta: 20 },
      { time: NOW, delta: 45 },
    ]);
    expect(result.current.bars).toEqual([
      { time: NOW - 120_000, delta: -30 }, { time: NOW - 60_000, delta: 20 },
      { time: NOW, delta: 60 },
    ]);
    unmount();
  });
});
