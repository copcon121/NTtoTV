import { act, cleanup, renderHook } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChartSocket } from "../socket/ChartSocket";
import type { MarketDataStatusMessage } from "../socket/messages";
import { useLiquidityHistoryRecovery } from "./useLiquidityHistoryRecovery";

function setup() {
  let open = () => {};
  let status = (_message: MarketDataStatusMessage) => {};
  const offOpen = vi.fn();
  const offStatus = vi.fn();
  const socket = {
    ensureConnected: vi.fn(),
    onOpen: vi.fn((handler: () => void) => { open = handler; return offOpen; }),
    on: vi.fn((_type: string, handler: typeof status) => { status = handler; return offStatus; }),
  };
  const hook = renderHook(() => {
    const [generation, setGeneration] = useState(0);
    useLiquidityHistoryRecovery(socket as unknown as ChartSocket, setGeneration);
    return generation;
  });
  return { ...hook, socket, open: () => act(open),
    status: (message: MarketDataStatusMessage) => act(() => status(message)), offOpen, offStatus };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_800_000_000_000);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("LQ history recovery", () => {
  it("refreshes after every socket reopen and once per successful backend repair", () => {
    const env = setup();
    env.open();
    env.open();
    expect(env.result.current).toBe(2);
    const message = { type: "market_data_status", symbol: "GC",
      historySync: { state: "synced", lastSuccessAt: 1000 },
    } as MarketDataStatusMessage;
    env.status(message);
    env.status(message);
    env.status({ ...message, historySync: { ...message.historySync, lastSuccessAt: 2000,
      state: "syncing" } } as MarketDataStatusMessage);
    expect(env.result.current).toBe(3);
    env.status({ ...message, historySync: { state: "synced", connected: true, lastSuccessAt: 2000 } });
    expect(env.result.current).toBe(4);
  });

  it("repairs after resume or network recovery and coalesces browser resume events", () => {
    const env = setup();
    act(() => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("pageshow"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(env.result.current).toBe(1);
    expect(env.socket.ensureConnected).toHaveBeenCalledWith(45_000, 10_000);
    act(() => vi.advanceTimersByTime(3000));
    act(() => window.dispatchEvent(new Event("online")));
    expect(env.result.current).toBe(2);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => vi.advanceTimersByTime(3000));
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(env.result.current).toBe(2);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(env.result.current).toBe(3);
    env.unmount();
    act(() => vi.advanceTimersByTime(3000));
    act(() => window.dispatchEvent(new Event("focus")));
    expect(env.socket.ensureConnected).toHaveBeenCalledTimes(3);
    expect(env.offOpen).toHaveBeenCalledOnce();
    expect(env.offStatus).toHaveBeenCalledOnce();
  });
});
