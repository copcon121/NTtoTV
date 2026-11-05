import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChartSocket } from "../socket/ChartSocket";
import type { SiStopChain } from "../socket/messages";
import { DEFAULT_SI_STOP_SETTINGS } from "./siStops";
import { useSiStops } from "./useSiStops";
import { playLiquiditySound } from "./alertSounds";

vi.mock("./alertSounds", () => ({ playLiquiditySound: vi.fn() }));

function chain(patch: Partial<SiStopChain> = {}): SiStopChain {
  return { type: "si_stop", source: "rithmic", method: "aggressor_chain", status: "completed",
    symbol: "GC", contract: "GC", sourceContract: "GC 12-26", sessionId: "s1", chainId: "live",
    sequence: 1, side: "buy", startTime: 10_000, time: 10_001, completedTime: 10_002,
    price: 2700.1, firstPrice: 2700, vwap: 2700.05, executedVolume: 10,
    executionCount: 2, aggressorCount: 2, throughPriceLevels: true, endReason: "depth", ...patch };
}

class Socket {
  isOpen = true;
  listener?: (row: SiStopChain) => void;
  closed?: () => void;
  subscribe = vi.fn(); unsubscribe = vi.fn();
  on(_type: string, listener: (row: SiStopChain) => void) { this.listener = listener; return () => { this.listener = undefined; }; }
  onOpen(_listener: () => void) { return () => {}; }
  onClose(listener: () => void) { this.closed = listener; return () => {}; }
}

const snapshot = (chains: SiStopChain[] = [], sessionId = "s1") => ({
  source: "rithmic", symbol: "GC", contract: "GC", sourceContract: "GC 12-26",
  sessionId, connected: true, synchronized: true, chains,
});
const response = (data: unknown) => ({ ok: true, json: async () => data });
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(10_000); vi.clearAllMocks(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("SI Stops stream/bootstrap", () => {
  it("keeps completed history, throttles painting and alerts once per fresh chain", async () => {
    const historic = chain({ chainId: "historic", startTime: 8000, time: 8999, completedTime: 9000 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(snapshot([historic]))));
    const socket = new Socket();
    const toast = vi.fn();
    const { result, unmount } = renderHook(() => useSiStops(socket as unknown as ChartSocket, "/api",
      { ...DEFAULT_SI_STOP_SETTINGS, alertSound: true, showToast: true }, true, "beep", toast));
    await flush();
    expect(result.current.chains).toEqual([historic]);
    expect(playLiquiditySound).not.toHaveBeenCalled();
    act(() => { socket.listener!(chain()); socket.listener!(chain()); });
    expect(playLiquiditySound).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(result.current.chains).toHaveLength(1);
    act(() => { vi.advanceTimersByTime(80); });
    expect(result.current.chains).toHaveLength(2);
    unmount();
    expect(socket.unsubscribe).toHaveBeenCalledWith("GC", ["si_stop"]);
  });

  it("late REST cannot replace a completed live chain or replay its sound", async () => {
    let resolve!: (value: unknown) => void;
    const fetch = vi.fn().mockResolvedValueOnce(response(snapshot())).mockImplementationOnce(() =>
      new Promise((done) => { resolve = done; }));
    vi.stubGlobal("fetch", fetch);
    const socket = new Socket();
    const { result } = renderHook(() => useSiStops(socket as unknown as ChartSocket, "/api",
      { ...DEFAULT_SI_STOP_SETTINGS, alertSound: true }, true, "beep", vi.fn()));
    await flush();
    act(() => { vi.advanceTimersByTime(10_000); });
    const live = chain({ startTime: 20_000, time: 20_001, completedTime: 20_002 });
    act(() => { socket.listener!(live); vi.advanceTimersByTime(80); });
    resolve(response(snapshot([{ ...live, executedVolume: 999 }])));
    await flush();
    expect(result.current.chains).toEqual([live]);
    expect(playLiquiditySound).toHaveBeenCalledTimes(1);
  });

  it("a queued old-session chain cannot roll back newer bootstrap metadata", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(snapshot([], "s2"))));
    const socket = new Socket();
    const { result } = renderHook(() => useSiStops(socket as unknown as ChartSocket, "/api",
      { ...DEFAULT_SI_STOP_SETTINGS, alertSound: true }, true, "beep", vi.fn()));
    await flush();
    act(() => { socket.listener!(chain()); vi.advanceTimersByTime(80); });
    expect(result.current.sessionId).toBe("s2");
    expect(result.current.chains).toHaveLength(1);
    expect(playLiquiditySound).not.toHaveBeenCalled();
  });

  it("a disconnected request cannot restore stale source readiness", async () => {
    let resolve!: (value: unknown) => void;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise((done) => { resolve = done; })));
    const socket = new Socket();
    const { result } = renderHook(() => useSiStops(socket as unknown as ChartSocket, "/api",
      DEFAULT_SI_STOP_SETTINGS, true, "beep", vi.fn()));
    act(() => { socket.isOpen = false; socket.closed!(); });
    resolve(response(snapshot([chain()])));
    await flush();
    expect(result.current.connected).toBe(false);
    expect(result.current.synchronized).toBe(false);
    expect(result.current.chains).toEqual([]);
  });
});
