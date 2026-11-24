import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWidgetSync } from "./useWidgetSync";
import { SYNC_PROTOCOL, type ChartSyncConfig } from "./sync";

const context = { symbol: "GC", contract: "GC", timeframe: "1m" as const };
const config: ChartSyncConfig = { widgetId: "fp", instanceId: "mount-one", epoch: "epoch-one", revision: 0, workspaceId: "workspace", groupId: "A", symbol: "GC", contract: "GC", mode: "live", syncViewport: true, syncDrawings: true, drawings: [] };
let parent: { postMessage: ReturnType<typeof vi.fn> };
function receive(c = config, origin = window.location.origin, source: unknown = parent) {
  act(() => window.dispatchEvent(new MessageEvent("message", { origin, source: source as Window, data: { protocol: SYNC_PROTOCOL, type: "config", config: c } })));
}
beforeEach(() => { vi.useFakeTimers(); window.history.replaceState({}, "", "/fp?widgetId=fp&mountId=mount-one"); parent = { postMessage: vi.fn() }; vi.stubGlobal("parent", parent); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); window.history.replaceState({}, "", "/"); });
describe("child widget handshake", () => {
  it("retries hello with exact parent mount identity, accepts trusted init without echo", () => {
    const { result } = renderHook(() => useWidgetSync(context));
    expect(parent.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "hello", instanceId: "mount-one" }), window.location.origin);
    act(() => vi.advanceTimersByTime(500));
    expect(parent.postMessage).toHaveBeenCalledTimes(2);
    receive();
    expect(result.current.config?.epoch).toBe("epoch-one");
    act(() => vi.advanceTimersByTime(1500));
    expect(parent.postMessage).toHaveBeenCalledTimes(2);
  });
  it("rejects other origins/windows/mounts/contexts and retired config revisions/epochs", () => {
    const { result } = renderHook(() => useWidgetSync(context));
    receive(config, "https://other.example"); receive(config, window.location.origin, window);
    receive({ ...config, instanceId: "retired-mount" }); receive({ ...config, contract: "SI" });
    expect(result.current.config).toBeUndefined();
    receive({ ...config, revision: 3 }); receive({ ...config, revision: 2 });
    expect(result.current.config?.revision).toBe(3);
    receive({ ...config, epoch: "epoch-two", revision: 0 }); receive({ ...config, revision: 9 });
    expect(result.current.config?.epoch).toBe("epoch-two");
  });
  it("publishes sequenced updates only for allowed channels and matching live/replay scope", () => {
    const { result, rerender } = renderHook(({ mode }) => useWidgetSync({ ...context, mode }), { initialProps: { mode: "live" as "live" | "replay" } });
    receive({ ...config, syncDrawings: false }); parent.postMessage.mockClear();
    act(() => result.current.publish({ drawingOps: [{ op: "delete", id: "x" }] }));
    expect(parent.postMessage).not.toHaveBeenCalled();
    const viewport = { fromUtcMs: 1000, toUtcMs: 2000 };
    act(() => { result.current.publish({ viewport }); result.current.publish({ viewport }); });
    expect(parent.postMessage.mock.calls[0][0]).toMatchObject({ type: "update", instanceId: "mount-one", epoch: "epoch-one", baseRevision: 0, sequence: 1, change: { viewport } });
    expect(parent.postMessage.mock.calls[1][0].sequence).toBe(2);
    rerender({ mode: "replay" }); parent.postMessage.mockClear(); receive();
    expect(result.current.config).toBeUndefined();
    act(() => result.current.publish({ viewport }));
    expect(parent.postMessage).not.toHaveBeenCalled();
  });
});
